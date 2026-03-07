import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import { ProviderTester } from "../../electron/provider-tester/index.ts";

const preloadPath = "electron/preload.cjs";
const handlerPath = "electron/handlers/ipc-provider.ts";
const testerPath = "electron/provider-tester/index.ts";
const globalTypesPath = "src/js/global.d.ts";

test("preload exposes generic provider scenario APIs alongside test compatibility aliases", () => {
  const content = readFileSync(preloadPath, "utf8");

  assert.match(
    content,
    /runProviderScenario:\s*\(params\) => ipcRenderer\.invoke\("run-provider-scenario", params\)/
  );
  assert.match(content, /onProviderScenarioProgress:\s*\(callback\) =>/);
  assert.match(
    content,
    /testProvider:\s*\(params\) => ipcRenderer\.invoke\("test-provider", params\)/
  );
});

test("ipc provider handler registers a generic scenario entry point", () => {
  const content = readFileSync(handlerPath, "utf8");

  assert.match(content, /registerHandler\("run-provider-scenario"/);
  assert.match(content, /registerHandler\("test-provider"/);
  assert.match(content, /syncMode: request\.syncMode \?\? "full"/);
  assert.match(content, /const results = await tester\.runScenario\(scenarioId\);/);
  assert.doesNotMatch(content, /runTestSuite\(/);
});

test("provider tester exposes a scenario-oriented entry point", () => {
  const content = readFileSync(testerPath, "utf8");

  assert.match(content, /async runScenario\(/);
  assert.match(content, /scenarioId/);
});

test("provider tester resolves webview-test from provider config scenario definitions", async () => {
  const executed: string[] = [];

  const fakeWebview = {
    getURL: () => "https://chatgpt.com/c/test",
    loadURL: async () => {},
    executeJavaScript: async () => null,
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
    scenarios: {
      webviewTest: {
        id: "webview-test",
        title: "Injected Scenario",
        steps: [
          {
            id: "first-custom-step",
            label: "Injected Reset",
            action: "navigate-default",
            onFail: "abort",
          },
          {
            id: "last-custom-step",
            label: "Injected Capabilities",
            action: "assert-provider-capabilities",
            onFail: "warn",
          },
        ],
      },
    },
  };

  const tester = new ProviderTester(fakeWebview as never, config as never, "ai1");
  const testerOverrides = tester as unknown as Record<string, () => Promise<unknown>>;

  testerOverrides.runResetDefaultPageStep = async () => {
    executed.push("navigate-default");
    return { status: "pass", message: "reset ok" };
  };
  testerOverrides.runDisabledSendStep = async () => {
    executed.push("unexpected-disabled-send");
    return { status: "pass", message: "unexpected" };
  };
  testerOverrides.runDragDropStep = async () => {
    executed.push("unexpected-drag-drop");
    return { status: "pass", message: "unexpected" };
  };
  testerOverrides.runInjectMessageStep = async () => {
    executed.push("unexpected-inject-message");
    return { status: "pass", message: "unexpected" };
  };
  testerOverrides.runEnabledSendStep = async () => {
    executed.push("unexpected-enabled-send");
    return { status: "pass", message: "unexpected" };
  };
  testerOverrides.runAttachFileStep = async () => {
    executed.push("unexpected-attach-file");
    return { status: "pass", message: "unexpected" };
  };
  testerOverrides.runSendThinkingStep = async () => {
    executed.push("unexpected-send-thinking");
    return { status: "pass", message: "unexpected" };
  };
  testerOverrides.runFinalBubblesStep = async () => {
    executed.push("unexpected-final-bubbles");
    return { status: "pass", message: "unexpected" };
  };
  testerOverrides.runScrollStep = async () => {
    executed.push("unexpected-scroll-behavior");
    return { status: "pass", message: "unexpected" };
  };
  testerOverrides.runProviderCapabilitiesStep = async () => {
    executed.push("assert-provider-capabilities");
    return { status: "warning", message: "capabilities warning" };
  };

  const result = await tester.runScenario("webview-test");

  assert.deepEqual(executed, ["navigate-default", "assert-provider-capabilities"]);
  assert.ok(result.steps);
  assert.deepEqual(
    result.steps.map((step) => [step.id, step.name, step.status]),
    [
      ["first-custom-step", "Injected Reset", "pass"],
      ["last-custom-step", "Injected Capabilities", "warning"],
    ]
  );
});

test("provider tester runs webview-sync sidebar collection actions from provider config", async () => {
  let sidebarOpen = false;
  let currentUrl = "https://chatgpt.com/c/current";
  const loadedUrls: string[] = [];
  const indicatorChecks: Array<[string, string]> = [];
  const progressMessages: string[] = [];
  const syncCalls: string[] = [];

  const fakeWebview = {
    getURL: () => currentUrl,
    loadURL: async (url: string) => {
      loadedUrls.push(url);
      currentUrl = url;
    },
    executeJavaScript: async (script: string) => {
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
            { title: "Second chat", url: "https://chatgpt.com/c/def" },
            { title: "First chat", url: "/c/abc" },
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
        steps: [
          { id: "open-sidebar", label: "Open Sidebar", action: "open-sidebar", onFail: "abort" },
          {
            id: "collect-session-urls",
            label: "Collect Session Urls",
            action: "collect-session-urls",
            onFail: "abort",
          },
          {
            id: "open-session-urls",
            label: "Open Session Urls",
            action: "open-session-urls",
            onFail: "abort",
          },
          {
            id: "report-sync-preview",
            label: "Report Sync Preview",
            action: "report",
            onFail: "warn",
          },
        ],
      },
    },
  };

  const tester = new ProviderTester(fakeWebview as never, config as never, "ai1", undefined, {
    emitProgress: (event) => {
      if (event.type === "step-start" && event.stepId === "open-session-urls") {
        progressMessages.push(event.message ?? "");
      }
    },
  });
  const testerOverrides = tester as unknown as {
    waitForShellIndicator: (kind: string, expected: string, timeout: number) => Promise<boolean>;
    runFullSyncForSession: (session: {
      url: string;
    }) => Promise<{ status: string; message: string }>;
  };
  testerOverrides.waitForShellIndicator = async (kind, expected) => {
    indicatorChecks.push([kind, expected]);
    return true;
  };
  testerOverrides.runFullSyncForSession = async (session) => {
    syncCalls.push(`full:${session.url}`);
    return { status: "pass", message: "full ok" };
  };
  const result = await tester.runScenario("webview-sync");

  assert.ok(result.steps);
  assert.deepEqual(
    result.steps.map((step) => [step.id, step.status]),
    [
      ["open-sidebar", "pass"],
      ["collect-session-urls", "pass"],
      ["open-session-urls", "pass"],
      ["report-sync-preview", "pass"],
    ]
  );
  assert.equal(result.failed, 0);
  assert.deepEqual(loadedUrls, ["https://chatgpt.com/c/abc", "https://chatgpt.com/c/def"]);
  assert.deepEqual(syncCalls, ["full:https://chatgpt.com/c/abc", "full:https://chatgpt.com/c/def"]);
  assert.deepEqual(indicatorChecks, [
    ["loading", "busy"],
    ["loading", "idle"],
    ["loading", "busy"],
    ["loading", "idle"],
  ]);
  assert.match(result.results[0]?.message ?? "", /Sidebar opened|already open/);
  assert.equal(result.results[1]?.message, "Collected 2 visible sessions");
  assert.match(result.results[2]?.message ?? "", /Opened 2 session URLs/);
  assert.deepEqual(progressMessages, [
    "Open Session Urls",
    "Opening 1/2: First chat - https://chatgpt.com/c/abc",
    "Opening 2/2: Second chat - https://chatgpt.com/c/def",
  ]);
  assert.deepEqual(result.results[2]?.details?.sessionPreview, {
    total: 2,
    sessions: [
      { title: "First chat", url: "https://chatgpt.com/c/abc" },
      { title: "Second chat", url: "https://chatgpt.com/c/def" },
    ],
  });
  assert.deepEqual(result.results[3]?.details?.sessionPreview, {
    total: 2,
    sessions: [
      { title: "First chat", url: "https://chatgpt.com/c/abc" },
      { title: "Second chat", url: "https://chatgpt.com/c/def" },
    ],
  });
  assert.match(result.results[3]?.message ?? "", /First chat/);
  assert.match(result.results[3]?.message ?? "", /https:\/\/chatgpt\.com\/c\/abc/);
});

test("provider tester rejects webview-sync for estimated provider configs", async () => {
  const fakeWebview = {
    getURL: () => "https://gemini.google.com/app/test",
    loadURL: async () => {},
    executeJavaScript: async () => null,
    addEventListener: () => {},
  };

  const config = {
    id: "gemini",
    name: "Gemini",
    baseUrl: "https://gemini.google.com",
    loginUrl: "https://accounts.google.com",
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
      readiness: "estimated",
      sidebar: {
        openButtonSelectors: ["button"],
        closeButtonSelectors: ["button.close"],
      },
      history: {
        containerSelectors: ["nav"],
        itemSelectors: ["nav a"],
        titleSelectors: ["span"],
      },
    },
    scenarios: {
      webviewSync: {
        id: "webview-sync",
        title: "Estimated Sync",
        steps: [
          { id: "open-sidebar", label: "Open Sidebar", action: "open-sidebar", onFail: "abort" },
        ],
      },
    },
  };

  const tester = new ProviderTester(fakeWebview as never, config as never, "ai1");

  await assert.rejects(
    async () => await tester.runScenario("webview-sync"),
    /webview-sync is not verified/
  );
});

test("provider tester runs the selected sync mode after opening each session URL", async () => {
  let sidebarOpen = false;
  let currentUrl = "https://chatgpt.com/c/current";
  const syncCalls: string[] = [];

  const fakeWebview = {
    getURL: () => currentUrl,
    loadURL: async (url: string) => {
      currentUrl = url;
    },
    executeJavaScript: async (script: string) => {
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
        steps: [
          { id: "open-sidebar", label: "Open Sidebar", action: "open-sidebar", onFail: "abort" },
          {
            id: "collect-session-urls",
            label: "Collect Session Urls",
            action: "collect-session-urls",
            onFail: "abort",
          },
          {
            id: "open-session-urls",
            label: "Open Session Urls",
            action: "open-session-urls",
            onFail: "abort",
          },
          {
            id: "report-sync-preview",
            label: "Report Sync Preview",
            action: "report",
            onFail: "warn",
          },
        ],
      },
    },
  };

  const tester = new ProviderTester(fakeWebview as never, config as never, "ai1", undefined, {
    emitProgress: undefined,
    syncMode: "clean",
  });
  const testerOverrides = tester as unknown as {
    waitForShellIndicator: (kind: string, expected: string, timeout: number) => Promise<boolean>;
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
  testerOverrides.waitForShellIndicator = async () => true;
  testerOverrides.runSoftSyncForSession = async (session) => {
    syncCalls.push(`soft:${session.url}`);
    return { status: "pass", message: "soft ok" };
  };
  testerOverrides.runFullSyncForSession = async (session) => {
    syncCalls.push(`full:${session.url}`);
    return { status: "pass", message: "full ok" };
  };
  testerOverrides.runCleanSyncForSession = async (session) => {
    syncCalls.push(`clean:${session.url}`);
    return { status: "pass", message: "clean ok" };
  };

  const result = await tester.runScenario("webview-sync");

  assert.deepEqual(syncCalls, [
    "clean:https://chatgpt.com/c/abc",
    "clean:https://chatgpt.com/c/def",
  ]);
  assert.match(result.results[2]?.message ?? "", /Clean sync/);
});

test("renderer global types expose generic provider scenario APIs", () => {
  const content = readFileSync(globalTypesPath, "utf8");

  assert.match(content, /runProviderScenario:/);
  assert.match(content, /onProviderScenarioProgress:/);
});
