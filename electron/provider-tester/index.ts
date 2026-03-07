import { existsSync } from "fs";
import { join } from "path";
import { pathToFileURL } from "url";

import type {
  ProviderConfig,
  ProviderScenarioActionId,
  ProviderScenarioDefinition,
  ProviderScenarioId,
  ProviderScenarioStepDefinition,
  ProviderSessionPreview,
  ProviderTestProgressEvent,
  ProviderTestResult,
  ProviderTestSuite,
  ProviderTestStep,
  ProviderTestSlot,
  ProviderWebviewSyncConfig,
  ProviderWebviewSyncMode,
  TestStatus,
} from "../../src/types/provider.ts";

import type { ProviderTestRunOptions, RendererShell, TestContext, WebviewTag } from "./types.ts";
import {
  createClickElement,
  createExecuteScript,
  createIsElementVisible,
  createSkipResult,
  createTestSelector,
  waitForCondition,
} from "./utils.ts";
import {
  runScenario as runConfiguredScenario,
  type ScenarioStepDefinition as RuntimeScenarioStepDefinition,
  type ScenarioStepResult,
  type ScenarioStepSeverity,
} from "./scenario-runner.ts";
import { testExcludedUrl } from "./preflight-tests.ts";
import {
  testAttachButton,
  testCriticalSelectors,
  testFileInput,
  testInputField,
  testUploadTarget,
} from "./dom-tests.ts";
import {
  testAIResponseInspect,
  testFileUpload,
  testInputFieldAccessibility,
  testMicrophoneButton,
  testSendButtonDisabled,
  testSendButtonEnabled,
  testSendMessage,
  testStopButtonWhileThinking,
  testTextInjection,
  testUserMessageInspect,
} from "./interactive-tests.ts";
import {
  testAssistantMessageScraping,
  testMessageContainer,
  testStopButton,
  testVoiceButton,
} from "./scraping-tests.ts";

const STATUS_COLOR = {
  busy: "rgb(231, 76, 60)",
  idle: "rgb(46, 204, 113)",
} as const;

const NAVIGATION_OBSERVATION_DELAY_MS = 4_000;

function generateRunId(
  slot: ProviderTestSlot,
  providerId: string,
  scenarioId: ProviderScenarioId
): string {
  const suffix = Math.random().toString(36).slice(2, 8);
  return `provider-scenario-${scenarioId}-${slot}-${providerId}-${Date.now()}-${suffix}`;
}

function resolveDefaultUrl(config: ProviderConfig): string {
  const path = config.defaultPaths?.[0] ?? "";
  if (typeof path === "string" && path !== "") {
    return new URL(path, config.baseUrl).toString();
  }
  return config.baseUrl;
}

function aggregateStatus(results: ProviderTestResult[]): TestStatus {
  if (results.some((result) => result.status === "fail")) return "fail";
  if (results.some((result) => result.status === "warning")) return "warning";
  if (results.every((result) => result.status === "skip")) return "skip";
  return "pass";
}

function aggregateMessage(results: ProviderTestResult[], fallback: string): string {
  const firstFail = results.find((result) => result.status === "fail");
  if (firstFail) return firstFail.message;
  const firstWarning = results.find((result) => result.status === "warning");
  if (firstWarning) return firstWarning.message;
  const firstSkip = results.find((result) => result.status === "skip");
  if (firstSkip) return firstSkip.message;
  return results[results.length - 1]?.message ?? fallback;
}

function createShellResult(
  id: string,
  name: string,
  category: ProviderTestResult["category"],
  status: TestStatus,
  message: string,
  details: ProviderTestResult["details"] = undefined,
  duration = 0
): ProviderTestResult {
  return {
    id,
    name,
    category,
    status,
    message,
    ...(details !== undefined ? { details } : {}),
    duration,
    timestamp: Date.now(),
  };
}

interface SyncSessionPreviewItem {
  title: string;
  url: string;
}

interface SyncSessionOutcome {
  status: TestStatus;
  message: string;
}

interface DatabaseSyncResult {
  success: boolean;
  error?: string;
  added?: number;
  total?: number;
}

interface ConversationMetadataResult {
  success: boolean;
  error?: string;
  data?: {
    conversationId: string;
    created: boolean;
    title: string;
    titleUpdated: boolean;
  };
}

interface ResetConversationResult {
  success: boolean;
  error?: string;
  data?: {
    conversationId: string;
    deletedCount: number;
  };
}

function normalizeSyncMode(syncMode?: ProviderWebviewSyncMode): ProviderWebviewSyncMode {
  return syncMode ?? "full";
}

async function importModuleByPath(modulePath: string): Promise<unknown> {
  return await import(pathToFileURL(modulePath).href);
}

async function resolveProjectRoot(): Promise<string> {
  const { Paths: projectPaths } = (await import("../paths.ts")) as {
    Paths: {
      getProjectRoot(): string;
    };
  };

  return projectPaths.getProjectRoot();
}

async function loadProviderModule(providerId: string): Promise<Record<string, unknown> | null> {
  const providerModuleTs = join(
    await resolveProjectRoot(),
    "src",
    "js",
    "modules",
    "webview",
    "providers",
    providerId,
    "index.ts"
  );
  const providerModuleJs = join(
    process.resourcesPath,
    "app.asar",
    "src",
    "js",
    "modules",
    "webview",
    "providers",
    providerId,
    "index.js"
  );
  const providerModulePath = existsSync(providerModuleTs) ? providerModuleTs : providerModuleJs;
  if (!existsSync(providerModulePath)) {
    return null;
  }

  const imported = await importModuleByPath(providerModulePath);
  return typeof imported === "object" && imported !== null
    ? (imported as Record<string, unknown>)
    : null;
}

async function loadDatabaseManager(): Promise<{
  syncMessages: (...args: unknown[]) => Promise<DatabaseSyncResult>;
  upsertConversationMetadata: (...args: unknown[]) => Promise<ConversationMetadataResult>;
  resetConversationMessages: (...args: unknown[]) => Promise<ResetConversationResult>;
}> {
  const imported = (await import("../database/index.ts")) as {
    databaseManager: {
      syncMessages: (...args: unknown[]) => Promise<DatabaseSyncResult>;
      upsertConversationMetadata: (...args: unknown[]) => Promise<ConversationMetadataResult>;
      resetConversationMessages: (...args: unknown[]) => Promise<ResetConversationResult>;
    };
  };
  return imported.databaseManager;
}

function normalizeScrapedMessages(messages: unknown[]): Array<{
  role: "user" | "assistant";
  text: string;
  index: number;
  domId?: string;
  contentHash?: string;
}> {
  return messages.flatMap((message, index) => {
    if (typeof message !== "object" || message === null) {
      return [];
    }

    const maybe = message as Record<string, unknown>;
    const role =
      maybe["role"] === "user" ? "user" : maybe["role"] === "assistant" ? "assistant" : null;
    const text =
      typeof maybe["text"] === "string"
        ? maybe["text"]
        : typeof maybe["content"] === "string"
          ? maybe["content"]
          : "";
    if (role === null || text.trim() === "") {
      return [];
    }

    return [
      {
        role,
        text: text.trim(),
        index,
        ...(typeof maybe["domId"] === "string" && maybe["domId"] !== ""
          ? { domId: maybe["domId"] }
          : {}),
        ...(typeof maybe["contentHash"] === "string" && maybe["contentHash"] !== ""
          ? { contentHash: maybe["contentHash"] }
          : {}),
      },
    ];
  });
}

export class ProviderTester {
  private webview: WebviewTag;
  private config: ProviderConfig;
  private slot: ProviderTestSlot;
  private results: ProviderTestResult[] = [];
  private startTime = 0;
  private ctx: TestContext;
  private shell: RendererShell | null;
  private emitProgress: ((event: ProviderTestProgressEvent) => void) | undefined;
  private runId = "";
  private syncSessions: SyncSessionPreviewItem[] = [];
  private syncMode: ProviderWebviewSyncMode;
  private navigationObservationDelayMs: number;

  constructor(
    webview: WebviewTag,
    config: ProviderConfig,
    slot: ProviderTestSlot,
    shell?: RendererShell,
    options: ProviderTestRunOptions = { emitProgress: undefined }
  ) {
    this.webview = webview;
    this.config = config;
    this.slot = slot;
    this.shell = shell ?? null;
    this.emitProgress = options.emitProgress;
    this.syncMode = normalizeSyncMode(options.syncMode);
    this.navigationObservationDelayMs =
      options.navigationObservationDelayMs ?? NAVIGATION_OBSERVATION_DELAY_MS;

    const executeScript = createExecuteScript(webview);
    this.ctx = {
      slot,
      webview,
      config,
      appLanguage: options.appLanguage ?? "tr",
      ...(this.shell !== null ? { shell: this.shell } : {}),
      executeScript,
      executeShellScript: async (script: string): Promise<unknown> => {
        if (this.shell === null) return null;
        return await this.shell.executeJavaScript(script);
      },
      clickElement: createClickElement(executeScript),
      isElementVisible: createIsElementVisible(executeScript),
      waitForCondition,
      createSkipResult,
      testSelector: createTestSelector(executeScript),
    };
  }

  async runTestSuite(): Promise<ProviderTestSuite> {
    return await this.runScenario("webview-test");
  }

  async runScenario(scenarioId: ProviderScenarioId): Promise<ProviderTestSuite> {
    this.startTime = Date.now();
    this.results = [];
    this.syncSessions = [];
    this.runId = generateRunId(this.slot, this.config.id, scenarioId);
    this.assertScenarioReadiness(scenarioId);
    const scenarioDefinition = this.resolveScenarioDefinition(scenarioId);

    const scenario = await runConfiguredScenario({
      runId: this.runId,
      scenarioId,
      slot: this.slot,
      providerId: this.config.id,
      ...(this.emitProgress !== undefined ? { emitProgress: this.emitProgress } : {}),
      steps: scenarioDefinition.steps.map((step) => this.createRuntimeScenarioStep(step)),
    });

    return this.generateReport(
      scenario.scenarioId,
      scenario.steps,
      scenario.aborted,
      scenario.abortReason
    );
  }

  private pushResult(result: ProviderTestResult): ProviderTestResult {
    this.results.push(result);
    return result;
  }

  private pushResults(results: ProviderTestResult[]): ProviderTestResult[] {
    results.forEach((result) => this.results.push(result));
    return results;
  }

  private summarizeStep(results: ProviderTestResult[], fallback: string): ScenarioStepResult {
    return {
      status: aggregateStatus(results),
      message: aggregateMessage(results, fallback),
    };
  }

  private emitScenarioStepProgress(stepId: string, message: string): void {
    this.emitProgress?.({
      runId: this.runId,
      scenarioId: "webview-sync",
      slot: this.slot,
      providerId: this.config.id,
      type: "step-start",
      stepId,
      status: "running",
      message,
      timestamp: Date.now(),
    });
  }

  private resolveScenarioDefinition(scenarioId: ProviderScenarioId): ProviderScenarioDefinition {
    const scenario = Object.values(this.config.scenarios ?? {}).find(
      (candidate) => candidate.id === scenarioId
    );

    if (scenario === undefined) {
      throw new Error(`Unsupported provider scenario: ${scenarioId}`);
    }

    return scenario;
  }

  private createRuntimeScenarioStep(
    step: ProviderScenarioStepDefinition
  ): RuntimeScenarioStepDefinition {
    return {
      id: step.id,
      name: step.label,
      severity: this.resolveScenarioStepSeverity(step),
      delayAfterMs: this.resolveScenarioStepDelay(step.action),
      run: this.resolveScenarioStepRunner(step.action),
    };
  }

  private assertScenarioReadiness(scenarioId: ProviderScenarioId): void {
    if (scenarioId !== "webview-sync") {
      return;
    }

    const syncConfig = this.getWebviewSyncConfig();
    if (syncConfig.readiness !== "verified") {
      throw new Error(`Provider ${this.config.id} webview-sync is not verified`);
    }
  }

  private resolveScenarioStepSeverity(step: ProviderScenarioStepDefinition): ScenarioStepSeverity {
    if (step.onFail === "abort") {
      return "core";
    }

    if (step.action === "assert-provider-capabilities") {
      return "provider";
    }

    return "soft";
  }

  private resolveScenarioStepDelay(action: ProviderScenarioActionId): number {
    switch (action) {
      case "open-sidebar":
        return 250;
      case "collect-session-urls":
        return 150;
      case "open-session-urls":
      case "wait-loading-idle":
        return 250;
      case "report":
        return 0;
      case "navigate-default":
      case "send-and-wait-thinking":
        return 700;
      case "assert-attach-flow":
        return 400;
      case "assert-disabled-send":
      case "assert-drag-drop-surface":
      case "inject-prompt":
      case "assert-enabled-send":
      case "assert-final-bubbles":
      case "assert-scroll-behavior":
      case "assert-provider-capabilities":
        return 350;
      default:
        return 350;
    }
  }

  private resolveScenarioStepRunner(
    action: ProviderScenarioActionId
  ): () => Promise<ScenarioStepResult> {
    switch (action) {
      case "open-sidebar":
        return async (): Promise<ScenarioStepResult> => await this.runOpenSidebarStep();
      case "collect-session-urls":
        return async (): Promise<ScenarioStepResult> => await this.runCollectSessionUrlsStep();
      case "open-session-urls":
        return async (): Promise<ScenarioStepResult> => await this.runOpenSessionUrlsStep();
      case "wait-loading-idle":
        return async (): Promise<ScenarioStepResult> => await this.runWaitLoadingIdleStep();
      case "report":
        return async (): Promise<ScenarioStepResult> =>
          await Promise.resolve(this.runSyncReportStep());
      case "navigate-default":
        return async (): Promise<ScenarioStepResult> => await this.runResetDefaultPageStep();
      case "assert-disabled-send":
        return async (): Promise<ScenarioStepResult> => await this.runDisabledSendStep();
      case "assert-drag-drop-surface":
        return async (): Promise<ScenarioStepResult> => await this.runDragDropStep();
      case "inject-prompt":
        return async (): Promise<ScenarioStepResult> => await this.runInjectMessageStep();
      case "assert-enabled-send":
        return async (): Promise<ScenarioStepResult> => await this.runEnabledSendStep();
      case "assert-attach-flow":
        return async (): Promise<ScenarioStepResult> => await this.runAttachFileStep();
      case "send-and-wait-thinking":
        return async (): Promise<ScenarioStepResult> => await this.runSendThinkingStep();
      case "assert-final-bubbles":
        return async (): Promise<ScenarioStepResult> => await this.runFinalBubblesStep();
      case "assert-scroll-behavior":
        return async (): Promise<ScenarioStepResult> => await this.runScrollStep();
      case "assert-provider-capabilities":
        return async (): Promise<ScenarioStepResult> => await this.runProviderCapabilitiesStep();
      default:
        throw new Error(`Unsupported provider scenario action: ${action}`);
    }
  }

  private getWebviewSyncConfig(): ProviderWebviewSyncConfig {
    if (this.config.webviewSync === undefined) {
      throw new Error(`Provider ${this.config.id} is missing webviewSync config`);
    }

    return this.config.webviewSync;
  }

  private async resolveSlotAccountId(): Promise<string> {
    if (this.shell === null) {
      return "";
    }

    const accountId = await this.shell.executeJavaScript(`
      window.AppState?.getAccountForSlot?.(${JSON.stringify(this.slot)})?.id ?? ""
    `);
    return typeof accountId === "string" ? accountId : "";
  }

  private async refreshConversationList(): Promise<void> {
    if (this.shell === null) {
      return;
    }

    await this.shell.executeJavaScript(`
      window.ConversationListManager?.refresh?.({
        silent: true,
        skipNotify: true,
        provider: ${JSON.stringify(this.slot)},
      })
    `);
  }

  private async scrapeActiveConversationMessages(): Promise<
    Array<{
      role: "user" | "assistant";
      text: string;
      index: number;
      domId?: string;
      contentHash?: string;
    }>
  > {
    const providerModule = await loadProviderModule(this.config.id);
    const scrapeMessages = providerModule?.["scrapeMessages"];
    if (typeof scrapeMessages !== "function") {
      throw new Error(`Provider scraper not found for ${this.config.id}`);
    }

    const rawMessages = (await this.webview.executeJavaScript(`
      (${scrapeMessages.toString()})();
    `)) as unknown[] | null;
    return normalizeScrapedMessages(Array.isArray(rawMessages) ? rawMessages : []);
  }

  private async performFullSyncForSession(
    session: SyncSessionPreviewItem,
    accountId: string
  ): Promise<{ added: number; total: number }> {
    const databaseManager = await loadDatabaseManager();
    const messages = await this.scrapeActiveConversationMessages();
    const syncResult = await databaseManager.syncMessages(null, {
      accountId,
      webUrl: session.url,
      messages,
    });

    if (syncResult.success !== true) {
      throw new Error(syncResult.error ?? `Message sync failed for ${session.url}`);
    }

    const metadataResult = await databaseManager.upsertConversationMetadata(null, {
      accountId,
      webUrl: session.url,
      provider: this.config.id,
      title: session.title,
    });
    if (metadataResult.success !== true) {
      throw new Error(
        metadataResult.error ?? `Conversation metadata sync failed for ${session.url}`
      );
    }

    return {
      added: syncResult.added ?? 0,
      total: syncResult.total ?? messages.length,
    };
  }

  protected async runSoftSyncForSession(
    session: SyncSessionPreviewItem
  ): Promise<SyncSessionOutcome> {
    const accountId = await this.resolveSlotAccountId();
    if (accountId === "") {
      return { status: "fail", message: `No account assigned for ${this.slot}` };
    }

    const databaseManager = await loadDatabaseManager();
    const result = await databaseManager.upsertConversationMetadata(null, {
      accountId,
      webUrl: session.url,
      provider: this.config.id,
      title: session.title,
    });
    if (result.success !== true) {
      return { status: "fail", message: result.error ?? `Soft sync failed for ${session.url}` };
    }

    await this.refreshConversationList();
    return { status: "pass", message: `Soft sync saved ${session.title}` };
  }

  protected async runFullSyncForSession(
    session: SyncSessionPreviewItem
  ): Promise<SyncSessionOutcome> {
    const accountId = await this.resolveSlotAccountId();
    if (accountId === "") {
      return { status: "fail", message: `No account assigned for ${this.slot}` };
    }

    try {
      const syncResult = await this.performFullSyncForSession(session, accountId);
      await this.refreshConversationList();
      return {
        status: "pass",
        message: `Full sync added ${syncResult.added} messages for ${session.title}`,
      };
    } catch (error) {
      return { status: "fail", message: (error as Error).message };
    }
  }

  protected async runCleanSyncForSession(
    session: SyncSessionPreviewItem
  ): Promise<SyncSessionOutcome> {
    const accountId = await this.resolveSlotAccountId();
    if (accountId === "") {
      return { status: "fail", message: `No account assigned for ${this.slot}` };
    }

    const databaseManager = await loadDatabaseManager();
    const resetResult = await databaseManager.resetConversationMessages(null, {
      accountId,
      webUrl: session.url,
    });
    if (resetResult.success !== true) {
      return {
        status: "fail",
        message: resetResult.error ?? `Clean reset failed for ${session.url}`,
      };
    }

    try {
      const syncResult = await this.performFullSyncForSession(session, accountId);
      await this.refreshConversationList();
      return {
        status: "pass",
        message: `Clean sync reset ${resetResult.data?.deletedCount ?? 0} messages and imported ${syncResult.added} for ${session.title}`,
      };
    } catch (error) {
      return { status: "fail", message: (error as Error).message };
    }
  }

  private async probeSyncSidebar(clickOpen: boolean): Promise<{
    syncSidebarProbe: boolean;
    openFound: boolean;
    closeVisible: boolean;
    historyVisible: boolean;
    clickedOpen: boolean;
  }> {
    const syncConfig = this.getWebviewSyncConfig();

    return (await this.ctx.executeScript(`
      (() => {
        const openSelectors = ${JSON.stringify(syncConfig.sidebar.openButtonSelectors)};
        const closeSelectors = ${JSON.stringify(syncConfig.sidebar.closeButtonSelectors)};
        const historySelectors = ${JSON.stringify(syncConfig.history.containerSelectors)};
        const shouldClickOpen = ${clickOpen ? "true" : "false"};
        const isVisible = (el) => {
          if (!(el instanceof Element)) return false;
          const rect = el.getBoundingClientRect();
          const style = window.getComputedStyle(el);
          return rect.width > 0 && rect.height > 0 && style.display !== 'none' && style.visibility !== 'hidden';
        };
        const findVisible = (selectors) => {
          for (const selector of selectors) {
            const el = document.querySelector(selector);
            if (isVisible(el)) return el;
          }
          return null;
        };
        const openButton = findVisible(openSelectors);
        const beforeClose = findVisible(closeSelectors);
        const beforeHistory = findVisible(historySelectors);
        let clickedOpen = false;
        if (!beforeClose && !beforeHistory && shouldClickOpen && openButton instanceof HTMLElement) {
          openButton.click();
          clickedOpen = true;
        }
        const afterClose = findVisible(closeSelectors);
        const afterHistory = findVisible(historySelectors);
        return {
          syncSidebarProbe: true,
          openFound: openButton !== null,
          closeVisible: afterClose !== null,
          historyVisible: afterHistory !== null,
          clickedOpen,
        };
      })()
    `)) as {
      syncSidebarProbe: boolean;
      openFound: boolean;
      closeVisible: boolean;
      historyVisible: boolean;
      clickedOpen: boolean;
    };
  }

  private async runOpenSidebarStep(): Promise<ScenarioStepResult> {
    const start = Date.now();
    const initialState = await this.probeSyncSidebar(false);

    if (initialState.historyVisible || initialState.closeVisible) {
      const result = createShellResult(
        "sync-open-sidebar",
        "Open Sidebar",
        "preflight",
        "pass",
        "Sidebar already open",
        undefined,
        Date.now() - start
      );
      this.pushResult(result);
      return this.summarizeStep([result], "Sidebar already open");
    }

    if (!initialState.openFound) {
      const result = createShellResult(
        "sync-open-sidebar",
        "Open Sidebar",
        "preflight",
        "fail",
        "Sidebar open button not found",
        undefined,
        Date.now() - start
      );
      this.pushResult(result);
      return this.summarizeStep([result], "Sidebar open button not found");
    }

    await this.probeSyncSidebar(true);

    const becameVisible = await waitForCondition(async () => {
      const state = await this.probeSyncSidebar(false);
      return state.historyVisible || state.closeVisible;
    }, 3000);

    const result = createShellResult(
      "sync-open-sidebar",
      "Open Sidebar",
      "preflight",
      becameVisible ? "pass" : "fail",
      becameVisible ? "Sidebar opened" : "Sidebar did not open",
      undefined,
      Date.now() - start
    );
    this.pushResult(result);
    return this.summarizeStep([result], "Sidebar did not open");
  }

  private normalizeSyncSessions(rawSessions: SyncSessionPreviewItem[]): SyncSessionPreviewItem[] {
    const unique = new Map<string, SyncSessionPreviewItem>();

    for (const session of rawSessions) {
      const title = session.title.trim();
      if (title.length === 0) {
        continue;
      }

      try {
        const url = new URL(session.url, this.config.baseUrl).toString();
        if (!unique.has(url)) {
          unique.set(url, { title, url });
        }
      } catch {
        continue;
      }
    }

    return [...unique.values()];
  }

  private buildSyncSessionPreview(): ProviderSessionPreview {
    return {
      total: this.syncSessions.length,
      sessions: this.syncSessions.map((session) => ({
        title: session.title,
        url: session.url,
      })),
    };
  }

  private async collectVisibleSyncSessions(): Promise<SyncSessionPreviewItem[]> {
    const syncConfig = this.getWebviewSyncConfig();
    const result = (await this.ctx.executeScript(`
      (() => {
        const itemSelectors = ${JSON.stringify(syncConfig.history.itemSelectors)};
        const titleSelectors = ${JSON.stringify(syncConfig.history.titleSelectors)};
        const isVisible = (el) => {
          if (!(el instanceof Element)) return false;
          const rect = el.getBoundingClientRect();
          const style = window.getComputedStyle(el);
          return rect.width > 0 && rect.height > 0 && style.display !== 'none' && style.visibility !== 'hidden';
        };
        const extractTitle = (item) => {
          for (const selector of titleSelectors) {
            const titleEl = item.querySelector(selector);
            const text = titleEl?.textContent?.trim();
            if (text) return text;
          }
          return item.textContent?.trim() ?? '';
        };
        const sessions = [];
        for (const selector of itemSelectors) {
          for (const item of document.querySelectorAll(selector)) {
            if (!(item instanceof HTMLElement) || !isVisible(item)) continue;
            const href = item.getAttribute('href') ?? item.closest('a')?.getAttribute('href') ?? '';
            const title = extractTitle(item);
            if (!href || !title) continue;
            sessions.push({ title, url: href });
          }
        }
        return { syncHistorySessions: true, sessions };
      })()
    `)) as {
      syncHistorySessions: boolean;
      sessions: SyncSessionPreviewItem[];
    };

    return this.normalizeSyncSessions(result.sessions);
  }

  private async runCollectSessionUrlsStep(): Promise<ScenarioStepResult> {
    const start = Date.now();
    const sessions = await this.collectVisibleSyncSessions();
    this.syncSessions = sessions;

    const result = createShellResult(
      "sync-collect-session-urls",
      "Collect Session Urls",
      "scraping",
      sessions.length > 0 ? "pass" : "fail",
      sessions.length > 0
        ? `Collected ${sessions.length} visible sessions`
        : "No visible sessions found in sidebar",
      sessions.length > 0
        ? { selector: sessions.map((session) => session.url).join(", ") }
        : undefined,
      Date.now() - start
    );
    this.pushResult(result);
    return this.summarizeStep([result], "No visible sessions found in sidebar");
  }

  private async runOpenSessionUrlsStep(): Promise<ScenarioStepResult> {
    const start = Date.now();
    const stepId = "open-session-urls";
    const syncMode = this.syncMode;
    let syncedCount = 0;
    const loadingObservations: Array<"busy" | "idle" | "missing"> = [];

    if (this.syncSessions.length === 0) {
      const result = createShellResult(
        "sync-open-session-urls",
        "Open Session Urls",
        "interactive",
        "fail",
        "No collected session URLs available",
        undefined,
        Date.now() - start
      );
      this.pushResult(result);
      return this.summarizeStep([result], "No collected session URLs available");
    }

    const indexedSessions = [...this.syncSessions.entries()];
    const runSessionAt = async (position: number): Promise<ScenarioStepResult | null> => {
      const entry = indexedSessions[position];
      if (entry === undefined) {
        return null;
      }

      const [index, session] = entry;
      const current = await this.openAndSyncSessionUrl(
        session,
        index,
        indexedSessions.length,
        stepId,
        start,
        syncMode
      );
      loadingObservations.push(current.loadingState);
      if (current.failure !== null) {
        return current.failure;
      }
      syncedCount += 1;

      return await runSessionAt(position + 1);
    };

    const failedStep = await runSessionAt(0);
    if (failedStep !== null) {
      return failedStep;
    }

    const successMessage =
      syncMode === "soft"
        ? `Soft sync completed for ${syncedCount} session URLs`
        : syncMode === "clean"
          ? `Clean sync completed for ${syncedCount} session URLs`
          : `Opened ${syncedCount} session URLs and completed full sync`;
    const observationSummary = this.summarizeLoadingObservations(loadingObservations);
    const result = createShellResult(
      "sync-open-session-urls",
      "Open Session Urls",
      "interactive",
      "pass",
      `${successMessage}; loading indicator after ${this.navigationObservationDelayMs}ms: ${observationSummary}`,
      {
        selector: this.syncSessions.map((session) => session.url).join(", "),
        sessionPreview: this.buildSyncSessionPreview(),
      },
      Date.now() - start
    );
    this.pushResult(result);
    return this.summarizeStep([result], "Session URLs opened");
  }

  private async runWaitLoadingIdleStep(): Promise<ScenarioStepResult> {
    const start = Date.now();
    const loadingFinished = await this.waitForShellIndicator("loading", "idle", 10000);
    const currentState = await this.readShellIndicator("loading");
    const result = createShellResult(
      "wait-loading-idle",
      "Wait Loading Idle",
      "preflight",
      loadingFinished ? "pass" : "fail",
      loadingFinished
        ? "Loading indicator returned to idle"
        : `Loading indicator state remained ${currentState}`,
      undefined,
      Date.now() - start
    );
    this.pushResult(result);
    return this.summarizeStep([result], "Loading indicator did not return to idle");
  }

  private runSyncReportStep(): ScenarioStepResult {
    const start = Date.now();
    const preview = this.syncSessions
      .slice(0, 3)
      .map((session) => `${session.title} -> ${session.url}`)
      .join(" | ");
    const hasSessions = this.syncSessions.length > 0;

    const result = createShellResult(
      "sync-report-preview",
      "Report Sync Preview",
      "advanced",
      hasSessions ? "pass" : "warning",
      hasSessions ? `Preview: ${preview}` : "No visible sessions collected yet",
      hasSessions
        ? {
            sessionPreview: this.buildSyncSessionPreview(),
          }
        : undefined,
      Date.now() - start
    );
    this.pushResult(result);
    return this.summarizeStep([result], "No visible sessions collected yet");
  }

  private async runResetDefaultPageStep(): Promise<ScenarioStepResult> {
    const results: ProviderTestResult[] = [];
    const defaultUrl = resolveDefaultUrl(this.config);
    const start = Date.now();
    const loadPromise = this.webview.loadURL(defaultUrl);
    await loadPromise;
    const loadingState = await this.observeLoadingIndicatorAfterNavigation();
    const urlCheck = testExcludedUrl(this.ctx);

    results.push(
      createShellResult(
        "default-page-navigation",
        "Default Page Navigation",
        "preflight",
        "pass",
        `Navigated to ${defaultUrl}`,
        { selector: defaultUrl },
        Date.now() - start
      )
    );
    results.push(
      createShellResult(
        "loading-indicator-observation",
        "Loading Indicator Observation",
        "preflight",
        "pass",
        `Loading indicator observed as ${loadingState} after ${this.navigationObservationDelayMs}ms`
      )
    );
    results.push(urlCheck);

    this.pushResults(results);
    return this.summarizeStep(results, "Default page reset failed");
  }

  private async runDisabledSendStep(): Promise<ScenarioStepResult> {
    const results = this.pushResults([
      await testInputField(this.ctx),
      await testInputFieldAccessibility(this.ctx),
      await testSendButtonDisabled(this.ctx),
      createShellResult(
        "send-indicator-disabled",
        "Send Indicator Disabled",
        "interactive",
        (await this.waitForShellIndicator("send", "busy", 4000)) ? "pass" : "fail",
        (await this.readShellIndicator("send")) === "busy"
          ? "Topbar send indicator is busy/disabled"
          : "Topbar send indicator did not show disabled state"
      ),
    ]);

    return this.summarizeStep(results, "Disabled send state failed");
  }

  private async runDragDropStep(): Promise<ScenarioStepResult> {
    const results = this.pushResults([
      await testUploadTarget(this.ctx),
      await testCriticalSelectors(this.ctx),
    ]);

    return this.summarizeStep(results, "Drag and drop surface failed");
  }

  private async runInjectMessageStep(): Promise<ScenarioStepResult> {
    const results = this.pushResults([await testTextInjection(this.ctx)]);
    return this.summarizeStep(results, "Message injection failed");
  }

  private async runEnabledSendStep(): Promise<ScenarioStepResult> {
    const enabledResult = await testSendButtonEnabled(this.ctx);
    const indicatorStatus = await this.waitForShellIndicator("send", "idle", 4000);
    const indicatorNow = await this.readShellIndicator("send");
    const indicatorResult = createShellResult(
      "send-indicator-enabled",
      "Send Indicator Enabled",
      "interactive",
      indicatorStatus ? "pass" : "fail",
      indicatorNow === "idle"
        ? "Topbar send indicator is idle/enabled"
        : "Topbar send indicator did not return to enabled state"
    );
    const results = this.pushResults([enabledResult, indicatorResult]);
    return this.summarizeStep(results, "Enabled send state failed");
  }

  private async runAttachFileStep(): Promise<ScenarioStepResult> {
    const results = this.pushResults([
      await testAttachButton(this.ctx),
      await testFileInput(this.ctx),
      await testFileUpload(this.ctx),
    ]);
    return this.summarizeStep(results, "Attach step completed with warnings");
  }

  private async runSendThinkingStep(): Promise<ScenarioStepResult> {
    const sendResult = await testSendMessage(this.ctx);
    const thinkingBusy = await this.waitForShellIndicator("thinking", "busy", 8000);
    const thinkingResult = createShellResult(
      "thinking-indicator",
      "Thinking Indicator",
      "interactive",
      thinkingBusy ? "pass" : "fail",
      thinkingBusy
        ? "Topbar thinking indicator became busy"
        : "Thinking indicator did not become busy"
    );
    const stopResult = await testStopButtonWhileThinking(this.ctx);
    const stopScrapeResult = await testStopButton(this.ctx);
    const results = this.pushResults([sendResult, thinkingResult, stopResult, stopScrapeResult]);
    return this.summarizeStep(results, "Send/thinking step failed");
  }

  private async runFinalBubblesStep(): Promise<ScenarioStepResult> {
    const results = this.pushResults([
      await testUserMessageInspect(this.ctx),
      await testAIResponseInspect(this.ctx),
      await testAssistantMessageScraping(this.ctx),
      await testMessageContainer(this.ctx),
    ]);
    return this.summarizeStep(results, "Final message bubble checks failed");
  }

  private async runScrollStep(): Promise<ScenarioStepResult> {
    const start = Date.now();
    try {
      const checks = await Promise.all(
        this.config.scrollerSelectors.map(async (selector) => {
          const data = (await this.ctx.executeScript(`
            (function() {
              const el = document.querySelector(${JSON.stringify(selector)});
              if (!el) return { selector: ${JSON.stringify(selector)}, exists: false };
              const before = el.scrollTop;
              el.scrollTop = el.scrollHeight;
              const after = el.scrollTop;
              return {
                selector: ${JSON.stringify(selector)},
                exists: true,
                scrollHeight: el.scrollHeight,
                clientHeight: el.clientHeight,
                before,
                after,
                canScroll: el.scrollHeight > el.clientHeight,
                nearBottom: el.scrollHeight - el.clientHeight - after < 24
              };
            })()
          `)) as {
            selector: string;
            exists: boolean;
            scrollHeight?: number;
            clientHeight?: number;
            before?: number;
            after?: number;
            canScroll?: boolean;
            nearBottom?: boolean;
          };
          return data;
        })
      );

      const found = checks.find(
        (item) => item.exists && item.canScroll === true && item.nearBottom === true
      );
      const result = createShellResult(
        "scroll-behavior",
        "Scroll Behavior",
        "scraping",
        found !== undefined ? "pass" : "fail",
        found !== undefined
          ? "Scroll container reached the final response"
          : "No scroll container could reach the final response",
        {
          selector:
            found?.selector ??
            checks
              .filter((item) => item.exists)
              .map((item) => item.selector)
              .join(", "),
        },
        Date.now() - start
      );
      this.pushResult(result);
      return this.summarizeStep([result], "Scroll behavior failed");
    } catch (error) {
      const result = createShellResult(
        "scroll-behavior",
        "Scroll Behavior",
        "scraping",
        "fail",
        "Scroll behavior test failed",
        { error: (error as Error).message },
        Date.now() - start
      );
      this.pushResult(result);
      return this.summarizeStep([result], "Scroll behavior failed");
    }
  }

  private async runProviderCapabilitiesStep(): Promise<ScenarioStepResult> {
    const results = this.pushResults([
      await testMicrophoneButton(this.ctx),
      await testVoiceButton(this.ctx),
    ]);
    return this.summarizeStep(results, "Provider capability checks completed");
  }

  private async runSyncForSession(
    session: SyncSessionPreviewItem,
    syncMode: ProviderWebviewSyncMode
  ): Promise<SyncSessionOutcome> {
    switch (syncMode) {
      case "soft":
        return await this.runSoftSyncForSession(session);
      case "clean":
        return await this.runCleanSyncForSession(session);
      case "full":
        return await this.runFullSyncForSession(session);
      default:
        return await this.runFullSyncForSession(session);
    }
  }

  private async openAndSyncSessionUrl(
    session: SyncSessionPreviewItem,
    index: number,
    total: number,
    stepId: string,
    start: number,
    syncMode: ProviderWebviewSyncMode
  ): Promise<{ failure: ScenarioStepResult | null; loadingState: "busy" | "idle" | "missing" }> {
    this.emitScenarioStepProgress(
      stepId,
      `Opening ${index + 1}/${total}: ${session.title} - ${session.url}`
    );

    const loadPromise = this.webview.loadURL(session.url);
    await loadPromise;
    const loadingState = await this.observeLoadingIndicatorAfterNavigation();

    const syncOutcome = await this.runSyncForSession(session, syncMode);
    if (syncOutcome.status === "fail") {
      const result = createShellResult(
        "sync-open-session-urls",
        "Open Session Urls",
        "interactive",
        "fail",
        `${syncOutcome.message} (loading=${loadingState} after ${this.navigationObservationDelayMs}ms)`,
        {
          selector: session.url,
          sessionPreview: this.buildSyncSessionPreview(),
        },
        Date.now() - start
      );
      this.pushResult(result);
      return {
        failure: this.summarizeStep([result], syncOutcome.message),
        loadingState,
      };
    }

    return { failure: null, loadingState };
  }

  private summarizeLoadingObservations(states: Array<"busy" | "idle" | "missing">): string {
    const counts = states.reduce<Record<"busy" | "idle" | "missing", number>>(
      (acc, state) => {
        acc[state] += 1;
        return acc;
      },
      { busy: 0, idle: 0, missing: 0 }
    );

    return (["idle", "busy", "missing"] as const)
      .filter((state) => counts[state] > 0)
      .map((state) => `${counts[state]} ${state}`)
      .join(", ");
  }

  private async readShellIndicator(
    kind: "loading" | "send" | "thinking"
  ): Promise<"busy" | "idle" | "missing"> {
    if (this.shell === null) return "missing";

    const result = (await this.shell.executeJavaScript(`
      (function() {
        const el = document.getElementById(${JSON.stringify(`${this.slot}-${kind}-indicator`)});
        if (!el) return 'missing';
        const color = window.getComputedStyle(el).backgroundColor;
        if (color === ${JSON.stringify(STATUS_COLOR.busy)}) return 'busy';
        if (color === ${JSON.stringify(STATUS_COLOR.idle)}) return 'idle';
        return 'missing';
      })()
    `)) as "busy" | "idle" | "missing";

    return result;
  }

  private async waitForShellIndicator(
    kind: "loading" | "send" | "thinking",
    expected: "busy" | "idle",
    timeout: number
  ): Promise<boolean> {
    if (this.shell === null) return false;
    return await waitForCondition(
      async () => (await this.readShellIndicator(kind)) === expected,
      timeout
    );
  }

  protected async observeLoadingIndicatorAfterNavigation(): Promise<"busy" | "idle" | "missing"> {
    if (this.navigationObservationDelayMs > 0) {
      await new Promise((resolve) => setTimeout(resolve, this.navigationObservationDelayMs));
    }

    return await this.readShellIndicator("loading");
  }

  private generateReport(
    scenarioId: ProviderScenarioId,
    steps: ProviderTestStep[],
    aborted: boolean,
    abortReason?: string
  ): ProviderTestSuite {
    const totalDuration = Date.now() - this.startTime;
    const passed = this.results.filter((r) => r.status === "pass").length;
    const failed = this.results.filter((r) => r.status === "fail").length;
    const skipped = this.results.filter((r) => r.status === "skip").length;
    const warnings = this.results.filter((r) => r.status === "warning").length;

    return {
      runId: this.runId,
      scenarioId,
      providerId: this.config.id,
      providerName: this.config.name,
      slot: this.slot,
      url: this.webview.getURL(),
      timestamp: this.startTime,
      totalTests: this.results.length,
      passed,
      failed,
      skipped,
      warnings,
      totalDuration,
      results: this.results,
      steps,
      aborted,
      ...(aborted && abortReason !== undefined ? { abortReason } : {}),
    };
  }
}
