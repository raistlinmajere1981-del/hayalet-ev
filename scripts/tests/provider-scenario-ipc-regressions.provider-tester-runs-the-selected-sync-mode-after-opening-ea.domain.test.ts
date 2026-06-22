import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import { ProviderTester } from "../../electron/provider-tester/index.ts";
import type { WebviewTag } from "../../electron/provider-tester/types.ts";

const preloadPath = "electron/preload.cjs";
const handlerPath = "electron/handlers/ipc-provider.ts";
const testerPath = "electron/provider-tester/index.ts";
const globalTypesPath = "src/js/global.d.ts";
const scenarioRunnerPath = "electron/provider-tester/scenario-runner.ts";
const testerTypesPath = "electron/provider-tester/types.ts";
const testerUtilsPath = "electron/provider-tester/utils.ts";
const testerInteractivePath = "electron/provider-tester/interactive-tests.ts";
const sharedScenarioPath = "src/js/modules/webview/providers/shared/scenarios.ts";
const pathsPath = "electron/paths.ts";
const opencodeServerManagerPath = "electron/opencode-server-manager.ts";


describe("provider tester runs the selected sync mode after opening each session URL", () => {
void test("provider tester runs the selected sync mode after opening each session URL", async () => {
  let sidebarOpen = false;
  let currentUrl = "https://chatgpt.com/c/current";
  const syncCalls: string[] = [];

  const fakeWebview = {
    getURL: () => currentUrl,
    loadURL: (url: string) => {
      currentUrl = url;
    },
    executeJavaScript: (script: string) => {
      if (script.includes("syncSidebarProbe")) {
        const wasOpen = sidebarOpen;
        sidebarOpen = true;
        return {
          syncSidebarProbe: true,
          closeVisible: wasOpen,
          openFound: true,
          clickedOpen: !wasOpen,
        };
      }

      if (script.includes("syncHistorySessions")) {
        return {
          syncHistorySessions: true,
          sessions: [
            { title: "First chat", url: "/c/abc" },
            { title: "Second chat", url: "/c/def" },
          ],
        };
      }

      return null;
    },
    addEventListener: () => {},
  };

  const config = {
    id: "chatgpt",
    name: "ChatGPT",
    baseUrl: "https://chatgpt.com",
    loginUrl: "https://chatgpt.com/auth/login",
    lastVerified: "2026-03-07",
    selectors: {
      sendButton: "button",
      stopButton: "button.stop",
      inputField: "textarea",
      messageContainer: "main",
    },
    inputType: "direct",
    scrollerSelectors: [],
    scrapeSelectors: {
      preferred: "main",
      fallback: "main",
    },
    fileInputSelectors: [],
    uploadTargetSelectors: [],
    criticalSelectors: [],
    contentContainers: [],
    excludedUrls: [],
    filters: {
      selectors: [],
      hosts: [],
      blockResourceTypes: [],
    },
    telemetry: {
      endpoints: [],
      tokenPaths: [],
    },
    webviewSync: {
      readiness: "verified",
      sidebar: {
        openButtonSelectors: ['button[data-testid="open-sidebar-button"]'],
        closeButtonSelectors: ['button[data-testid="close-sidebar-button"]'],
      },
      history: {
        containerSelectors: ["#history"],
        itemSelectors: ['#history a[href^="/c/"]'],
        titleSelectors: ['span[dir="auto"]'],
      },
    },
    scenarios: {
      webviewSync: {
        id: "webview-sync",
        title: "Injected Sync",
        commands: [
          {
            id: "open-sidebar-click",
            label: "Open Sidebar Click",
            action: "click",
            target: "sync-sidebar-open-button",
            onFail: "abort",
          },
          {
            id: "wait-sidebar-ready",
            label: "Wait Sidebar Ready",
            action: "wait",
            target: "sync-sidebar-ready",
            params: { timeoutMs: 3000 },
            onFail: "abort",
          },
          {
            id: "check-sidebar-ready",
            label: "Check Sidebar Ready",
            action: "check",
            target: "sync-sidebar-ready",
            onFail: "abort",
          },
          {
            id: "collect-session-urls",
            label: "Collect Session Urls",
            action: "collect-session-urls",
            saveAs: "syncSessions",
            onFail: "abort",
          },
          {
            id: "soft-sync-session",
            label: "Soft Sync Session",
            action: "sync-session",
            forEach: "syncSessions",
            params: { mode: "soft" },
            whenSyncModes: ["soft", "full", "clean"],
            onFail: "abort",
          },
          {
            id: "navigate-session",
            label: "Navigate Session",
            action: "navigate",
            forEach: "syncSessions",
            whenSyncModes: ["full", "clean"],
            onFail: "abort",
          },
          {
            id: "sync-session",
            label: "Sync Session",
            action: "sync-session",
            forEach: "syncSessions",
            params: { modeSource: "syncMode" },
            whenSyncModes: ["full", "clean"],
            onFail: "abort",
          },
          {
            id: "refresh-conversation-list",
            label: "Refresh Conversation List",
            action: "refresh-conversation-list",
            onFail: "abort",
          },
        ],
      },
    },
  };

  const tester = new ProviderTester(fakeWebview as unknown as WebviewTag, config as never, "ai1", undefined, {
    emitProgress: undefined,
    syncMode: "clean",
    commandStartDelayMs: 0,
    navigationObservationDelayMs: 0,
  });
  const testerOverrides = tester as unknown as {
    observeLoadingIndicatorAfterNavigation: () => Promise<"busy" | "idle" | "missing">;
    runSoftSyncForSession: (session: {
      url: string;
    }) => Promise<{ status: string; message: string }>;
    runFullSyncForSession: (session: {
      url: string;
    }) => Promise<{ status: string; message: string }>;
    runCleanSyncForSession: (session: {
      url: string;
    }) => Promise<{ status: string; message: string }>;
  };
  testerOverrides.observeLoadingIndicatorAfterNavigation = async () => {
    await Promise.resolve();
    return "idle" as const;
  };
  testerOverrides.runSoftSyncForSession = async (session) => {
    await Promise.resolve();
    syncCalls.push(`soft:${session.url}`);
    return { status: "pass", message: "soft ok" };
  };
  testerOverrides.runFullSyncForSession = async (session) => {
    await Promise.resolve();
    syncCalls.push(`full:${session.url}`);
    return { status: "pass", message: "full ok" };
  };
  testerOverrides.runCleanSyncForSession = async (session) => {
    await Promise.resolve();
    syncCalls.push(`clean:${session.url}`);
    return { status: "pass", message: "clean ok" };
  };

  const result = await tester.runScenario("webview-sync");

  assert.deepEqual(syncCalls, [
    "soft:https://chatgpt.com/c/abc",
    "soft:https://chatgpt.com/c/def",
    "clean:https://chatgpt.com/c/abc",
    "clean:https://chatgpt.com/c/def",
  ]);
  assert.equal(
    result.results.filter((entry) => entry.message === "soft ok").length,
    2
  );
  assert.equal(
    result.results.filter((entry) => entry.message === "clean ok").length,
    2
  );
  assert.match(
    result.results.at(-1)?.message ?? "",
    /Conversation list refreshed|Konuşma listesi yenilendi/
  );
});
void test("provider tester skips navigation entirely during soft sync", async () => {
  let sidebarOpen = false;
  let currentUrl = "https://chatgpt.com/c/current";
  const callOrder: string[] = [];

  const fakeWebview = {
    getURL: () => currentUrl,
    loadURL: async (url: string) => {
      currentUrl = url;
      callOrder.push("load:start");
      await new Promise<void>((resolve) => {
        setTimeout(() => {
          callOrder.push("load:resolve");
          resolve();
        }, 10);
      });
    },
    executeJavaScript: (script: string) => {
      if (script.includes("syncSidebarProbe")) {
        const wasOpen = sidebarOpen;
        sidebarOpen = true;
        return {
          syncSidebarProbe: true,
          closeVisible: wasOpen,
          openFound: true,
          clickedOpen: !wasOpen,
        };
      }

      if (script.includes("syncHistorySessions")) {
        return {
          syncHistorySessions: true,
          sessions: [{ title: "First chat", url: "/c/abc" }],
        };
      }

      return null;
    },
    addEventListener: () => {},
  };

  const config = {
    id: "chatgpt",
    name: "ChatGPT",
    baseUrl: "https://chatgpt.com",
    loginUrl: "https://chatgpt.com/auth/login",
    lastVerified: "2026-03-07",
    selectors: {
      sendButton: "button",
      stopButton: "button.stop",
      inputField: "textarea",
      messageContainer: "main",
    },
    inputType: "direct",
    scrollerSelectors: [],
    scrapeSelectors: {
      preferred: "main",
      fallback: "main",
    },
    fileInputSelectors: [],
    uploadTargetSelectors: [],
    criticalSelectors: [],
    contentContainers: [],
    excludedUrls: [],
    filters: {
      selectors: [],
      hosts: [],
      blockResourceTypes: [],
    },
    telemetry: {
      endpoints: [],
      tokenPaths: [],
    },
    webviewSync: {
      readiness: "verified",
      sidebar: {
        openButtonSelectors: ['button[data-testid="open-sidebar-button"]'],
        closeButtonSelectors: ['button[data-testid="close-sidebar-button"]'],
      },
      history: {
        containerSelectors: ["#history"],
        itemSelectors: ['#history a[href^="/c/"]'],
        titleSelectors: ['span[dir="auto"]'],
      },
    },
    scenarios: {
      webviewSync: {
        id: "webview-sync",
        title: "Injected Sync",
        commands: [
          {
            id: "open-sidebar-click",
            label: "Open Sidebar Click",
            action: "click",
            target: "sync-sidebar-open-button",
            onFail: "abort",
          },
          {
            id: "wait-sidebar-ready",
            label: "Wait Sidebar Ready",
            action: "wait",
            target: "sync-sidebar-ready",
            params: { timeoutMs: 3000 },
            onFail: "abort",
          },
          {
            id: "check-sidebar-ready",
            label: "Check Sidebar Ready",
            action: "check",
            target: "sync-sidebar-ready",
            onFail: "abort",
          },
          {
            id: "collect-session-urls",
            label: "Collect Session Urls",
            action: "collect-session-urls",
            saveAs: "syncSessions",
            onFail: "abort",
          },
          {
            id: "soft-sync-session",
            label: "Soft Sync Session",
            action: "sync-session",
            forEach: "syncSessions",
            params: { mode: "soft" },
            whenSyncModes: ["soft", "full", "clean"],
            onFail: "abort",
          },
          {
            id: "navigate-session",
            label: "Navigate Session",
            action: "navigate",
            forEach: "syncSessions",
            whenSyncModes: ["full", "clean"],
            onFail: "abort",
          },
          {
            id: "sync-session",
            label: "Sync Session",
            action: "sync-session",
            forEach: "syncSessions",
            params: { modeSource: "syncMode" },
            whenSyncModes: ["full", "clean"],
            onFail: "abort",
          },
          {
            id: "refresh-conversation-list",
            label: "Refresh Conversation List",
            action: "refresh-conversation-list",
            onFail: "abort",
          },
        ],
      },
    },
  };

  const tester = new ProviderTester(fakeWebview as unknown as WebviewTag, config as never, "ai1", undefined, {
    emitProgress: undefined,
    syncMode: "soft",
    commandStartDelayMs: 0,
    navigationObservationDelayMs: 0,
  });
  const testerOverrides = tester as unknown as {
    runSoftSyncForSession: (session: {
      url: string;
    }) => Promise<{ status: string; message: string }>;
  };
  testerOverrides.runSoftSyncForSession = async () => {
    await Promise.resolve();
    callOrder.push("soft-sync");
    return { status: "pass", message: "soft ok" };
  };

  await tester.runScenario("webview-sync");

  assert.deepEqual(callOrder, ["soft-sync"]);
  assert.equal(currentUrl, "https://chatgpt.com/c/current");
});
void test("provider tester refreshes metadata without changing the current page during soft sync", async () => {
  let sidebarOpen = false;
  let currentUrl = "https://chatgpt.com/c/current";
  const syncCalls: string[] = [];

  const fakeWebview = {
    getURL: () => currentUrl,
    loadURL: (url: string) => {
      currentUrl = url;
    },
    executeJavaScript: (script: string) => {
      if (script.includes("syncSidebarProbe")) {
        const wasOpen = sidebarOpen;
        sidebarOpen = true;
        return {
          syncSidebarProbe: true,
          closeVisible: wasOpen,
          openFound: true,
          clickedOpen: !wasOpen,
        };
      }

      if (script.includes("syncHistorySessions")) {
        return {
          syncHistorySessions: true,
          sessions: [{ title: "First chat", url: "/c/abc" }],
        };
      }

      return null;
    },
    addEventListener: () => {},
  };

  const config = {
    id: "chatgpt",
    name: "ChatGPT",
    baseUrl: "https://chatgpt.com",
    loginUrl: "https://chatgpt.com/auth/login",
    lastVerified: "2026-03-07",
    selectors: {
      sendButton: "button",
      stopButton: "button.stop",
      inputField: "textarea",
      messageContainer: "main",
    },
    inputType: "direct",
    scrollerSelectors: [],
    scrapeSelectors: {
      preferred: "main",
      fallback: "main",
    },
    fileInputSelectors: [],
    uploadTargetSelectors: [],
    criticalSelectors: [],
    contentContainers: [],
    excludedUrls: [],
    filters: {
      selectors: [],
      hosts: [],
      blockResourceTypes: [],
    },
    telemetry: {
      endpoints: [],
      tokenPaths: [],
    },
    webviewSync: {
      readiness: "verified",
      sidebar: {
        openButtonSelectors: ['button[data-testid="open-sidebar-button"]'],
        closeButtonSelectors: ['button[data-testid="close-sidebar-button"]'],
      },
      history: {
        containerSelectors: ["#history"],
        itemSelectors: ['#history a[href^="/c/"]'],
        titleSelectors: ['span[dir="auto"]'],
      },
    },
    scenarios: {
      webviewSync: {
        id: "webview-sync",
        title: "Injected Sync",
        commands: [
          {
            id: "open-sidebar-click",
            label: "Open Sidebar Click",
            action: "click",
            target: "sync-sidebar-open-button",
            onFail: "abort",
          },
          {
            id: "wait-sidebar-ready",
            label: "Wait Sidebar Ready",
            action: "wait",
            target: "sync-sidebar-ready",
            params: { timeoutMs: 3000 },
            onFail: "abort",
          },
          {
            id: "check-sidebar-ready",
            label: "Check Sidebar Ready",
            action: "check",
            target: "sync-sidebar-ready",
            onFail: "abort",
          },
          {
            id: "collect-session-urls",
            label: "Collect Session Urls",
            action: "collect-session-urls",
            saveAs: "syncSessions",
            onFail: "abort",
          },
          {
            id: "soft-sync-session",
            label: "Soft Sync Session",
            action: "sync-session",
            forEach: "syncSessions",
            params: { mode: "soft" },
            whenSyncModes: ["soft", "full", "clean"],
            onFail: "abort",
          },
          {
            id: "navigate-session",
            label: "Navigate Session",
            action: "navigate",
            forEach: "syncSessions",
            whenSyncModes: ["full", "clean"],
            onFail: "abort",
          },
          {
            id: "sync-session",
            label: "Sync Session",
            action: "sync-session",
            forEach: "syncSessions",
            params: { modeSource: "syncMode" },
            whenSyncModes: ["full", "clean"],
            onFail: "abort",
          },
          {
            id: "refresh-conversation-list",
            label: "Refresh Conversation List",
            action: "refresh-conversation-list",
            onFail: "abort",
          },
        ],
      },
    },
  };

  const tester = new ProviderTester(fakeWebview as unknown as WebviewTag, config as never, "ai1", undefined, {
    emitProgress: undefined,
    syncMode: "soft",
    commandStartDelayMs: 0,
    navigationObservationDelayMs: 0,
  });
  const testerOverrides = tester as unknown as {
    runSoftSyncForSession: (session: {
      url: string;
    }) => Promise<{ status: string; message: string }>;
  };
  testerOverrides.runSoftSyncForSession = async (session) => {
    await Promise.resolve();
    syncCalls.push(session.url);
    return { status: "pass", message: "soft ok" };
  };

  const result = await tester.runScenario("webview-sync");

  assert.deepEqual(syncCalls, ["https://chatgpt.com/c/abc"]);
  assert.equal(currentUrl, "https://chatgpt.com/c/current");
  assert.equal(result.commands[4]?.status, "pass");
  assert.equal(result.results[4]?.message, "soft ok");
  assert.match(
    result.results[5]?.message ?? "",
    /Conversation list refreshed|Konuşma listesi yenilendi/
  );
});
void test("renderer global types expose generic provider scenario APIs", () => {
  const content = readFileSync(globalTypesPath, "utf8");

  assert.match(content, /runProviderScenario:/);
  assert.match(content, /cancelProviderScenario:/);
  assert.match(content, /onProviderScenarioProgress:/);
});
});
