import { existsSync } from "fs";
import { join } from "path";
import { pathToFileURL } from "url";
import {
  PROVIDER_SCENARIO_DELAYS,
  PROVIDER_SCENARIO_TIMEOUTS,
  PROVIDER_TEST_INTERVALS,
  PROVIDER_TEST_TIMEOUTS,
} from "../../shared/timeouts.ts";
import { DEFAULT_APP_LANGUAGE } from "../../src/types/i18n.ts";

import type {
  ProviderConfig,
  ProviderScenarioCommandDefinition,
  ProviderScenarioDefinition,
  ProviderScenarioId,
  ProviderSessionPreview,
  ProviderTestProgressEvent,
  ProviderTestResult,
  ProviderTestSuite,
  ProviderTestSlot,
  ProviderWebviewSyncConfig,
  ProviderWebviewSyncMode,
  TestStatus,
} from "../../src/types/provider.ts";

import type {
  ProviderTesterDatabaseManager,
  ProviderTestRunOptions,
  RendererShell,
  TestContext,
  WebviewTag,
} from "./types.ts";
import {
  createClickElement,
  createExecuteScript,
  createIsElementVisible,
  createSkipResult,
  createTestSelector,
  waitForCondition,
} from "./utils.ts";
import {
  runCommandScenario as runConfiguredCommandScenario,
  ScenarioCancelledError,
  type ScenarioCommandContext,
  type ScenarioCommandDefinition as RuntimeScenarioCommandDefinition,
  type ScenarioCommandRun,
  type ScenarioCommandResult,
  type ScenarioCommandSeverity,
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
  details?: ProviderTestResult["details"];
  output?: Record<string, unknown>;
}

interface AggregatedCommandStepResult {
  status: TestStatus;
  message: string;
}

interface ScenarioCommandExecutionInput {
  command: ProviderScenarioCommandDefinition;
  session?: SyncSessionPreviewItem;
  index?: number;
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

async function loadDatabaseManager(): Promise<ProviderTesterDatabaseManager> {
  const imported = (await import("../database/index.ts")) as {
    databaseManager: ProviderTesterDatabaseManager;
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
  private abortSignal: AbortSignal | undefined;
  private commandStartDelayMs: number | undefined;
  private navigationObservationDelayMs: number;
  private databaseManager: ProviderTesterDatabaseManager | null;
  private defaultUrlOverride: string | undefined;

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
    this.runId = options.runId ?? "";
    this.syncMode = normalizeSyncMode(options.syncMode);
    this.abortSignal = options.abortSignal;
    this.commandStartDelayMs = options.commandStartDelayMs;
    this.navigationObservationDelayMs =
      options.navigationObservationDelayMs ?? PROVIDER_SCENARIO_TIMEOUTS.NAVIGATION_SETTLE;
    this.databaseManager = options.databaseManager ?? null;
    this.defaultUrlOverride =
      typeof options.defaultUrlOverride === "string" && options.defaultUrlOverride.trim() !== ""
        ? options.defaultUrlOverride.trim()
        : undefined;

    const executeScript = createExecuteScript(webview);
    this.ctx = {
      slot,
      webview,
      config,
      appLanguage: options.appLanguage ?? DEFAULT_APP_LANGUAGE,
      ...(this.abortSignal !== undefined ? { abortSignal: this.abortSignal } : {}),
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
    this.runId =
      this.runId !== "" ? this.runId : generateRunId(this.slot, this.config.id, scenarioId);
    this.assertScenarioReadiness(scenarioId);
    const scenarioDefinition = this.resolveScenarioDefinition(scenarioId);

    const scenario = await runConfiguredCommandScenario({
      runId: this.runId,
      scenarioId,
      slot: this.slot,
      providerId: this.config.id,
      ...(this.emitProgress !== undefined ? { emitProgress: this.emitProgress } : {}),
      ...(this.commandStartDelayMs !== undefined
        ? { commandStartDelayMs: this.commandStartDelayMs }
        : {}),
      ...(this.abortSignal !== undefined ? { signal: this.abortSignal } : {}),
      commands: scenarioDefinition.commands.map((command) =>
        this.createRuntimeScenarioCommand(command)
      ),
    });
    this.results = scenario.results;

    return this.generateReport(
      scenario.scenarioId,
      scenario.aborted,
      scenario.abortReason,
      scenario.commands
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

  private summarizeStep(
    results: ProviderTestResult[],
    fallback: string
  ): AggregatedCommandStepResult {
    return {
      status: aggregateStatus(results),
      message: aggregateMessage(results, fallback),
    };
  }

  private throwIfCancelled(): void {
    if (this.abortSignal?.aborted === true) {
      throw new ScenarioCancelledError();
    }
  }

  private async waitForDelay(delayMs: number): Promise<void> {
    if (!Number.isFinite(delayMs) || delayMs <= 0) {
      this.throwIfCancelled();
      return;
    }

    await new Promise<void>((resolve, reject) => {
      const timeoutId = setTimeout(() => {
        this.abortSignal?.removeEventListener("abort", handleAbort);
        resolve();
      }, delayMs);

      const handleAbort = (): void => {
        clearTimeout(timeoutId);
        this.abortSignal?.removeEventListener("abort", handleAbort);
        reject(new ScenarioCancelledError());
      };

      this.abortSignal?.addEventListener("abort", handleAbort, { once: true });
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

  private createRuntimeScenarioCommand(
    command: ProviderScenarioCommandDefinition
  ): RuntimeScenarioCommandDefinition {
    return {
      id: command.id,
      name: command.label,
      action: command.action,
      severity: this.resolveScenarioCommandSeverity(command),
      delayAfterMs: this.resolveScenarioCommandDelay(command.action),
      resolveRuns: (context) => this.resolveScenarioCommandRuns(command, context),
    };
  }

  private resolveScenarioCommandSeverity(
    command: ProviderScenarioCommandDefinition
  ): ScenarioCommandSeverity {
    if (command.onFail === "abort") {
      return "core";
    }

    if (command.action === "check" || command.action === "assert-provider-capabilities") {
      return "provider";
    }

    return "soft";
  }

  private resolveScenarioCommandDelay(action: string): number {
    switch (action) {
      case "click":
      case "wait":
      case "check":
      case "collect-session-urls":
        return action === "click"
          ? PROVIDER_SCENARIO_DELAYS.COMMAND_CLICK
          : action === "wait"
            ? PROVIDER_SCENARIO_DELAYS.COMMAND_WAIT
            : action === "check"
              ? PROVIDER_SCENARIO_DELAYS.COMMAND_CHECK
              : PROVIDER_SCENARIO_DELAYS.COMMAND_COLLECT_SESSION_URLS;
      case "navigate":
        return PROVIDER_SCENARIO_DELAYS.COMMAND_NAVIGATE;
      case "sync-session":
        return PROVIDER_SCENARIO_DELAYS.COMMAND_SYNC_SESSION;
      case "refresh-conversation-list":
        return PROVIDER_SCENARIO_DELAYS.COMMAND_REFRESH_CONVERSATION_LIST;
      case "navigate-default":
        return PROVIDER_SCENARIO_DELAYS.STEP_NAVIGATE_DEFAULT;
      case "assert-disabled-send":
        return PROVIDER_SCENARIO_DELAYS.STEP_ASSERT_DISABLED_SEND;
      case "assert-drag-drop-surface":
        return PROVIDER_SCENARIO_DELAYS.STEP_ASSERT_DRAG_DROP_SURFACE;
      case "inject-prompt":
        return PROVIDER_SCENARIO_DELAYS.STEP_INJECT_PROMPT;
      case "assert-enabled-send":
        return PROVIDER_SCENARIO_DELAYS.STEP_ASSERT_ENABLED_SEND;
      case "assert-attach-flow":
        return PROVIDER_SCENARIO_DELAYS.STEP_ASSERT_ATTACH_FLOW;
      case "send-and-wait-thinking":
        return PROVIDER_SCENARIO_DELAYS.STEP_SEND_AND_WAIT_THINKING;
      case "assert-final-bubbles":
        return PROVIDER_SCENARIO_DELAYS.STEP_ASSERT_FINAL_BUBBLES;
      case "assert-scroll-behavior":
        return PROVIDER_SCENARIO_DELAYS.STEP_ASSERT_SCROLL_BEHAVIOR;
      case "assert-provider-capabilities":
        return PROVIDER_SCENARIO_DELAYS.STEP_ASSERT_PROVIDER_CAPABILITIES;
      default:
        return PROVIDER_SCENARIO_DELAYS.COMMAND_DEFAULT;
    }
  }

  private matchesScenarioCommandSyncMode(command: ProviderScenarioCommandDefinition): boolean {
    if ((command.whenSyncModes?.length ?? 0) === 0) {
      return true;
    }

    return command.whenSyncModes?.includes(this.syncMode) ?? false;
  }

  private isSyncSessionPreviewItem(value: unknown): value is SyncSessionPreviewItem {
    if (typeof value !== "object" || value === null) {
      return false;
    }

    const maybe = value as Record<string, unknown>;
    return typeof maybe["title"] === "string" && typeof maybe["url"] === "string";
  }

  private resolveScenarioCommandRuns(
    command: ProviderScenarioCommandDefinition,
    context: ScenarioCommandContext
  ): ScenarioCommandRun[] {
    if (!this.matchesScenarioCommandSyncMode(command)) {
      return [];
    }

    if (command.forEach === undefined) {
      return [
        this.createScenarioCommandRun(command, {
          command,
        }),
      ];
    }

    const sourceItems = context.values[command.forEach];
    const sessions = Array.isArray(sourceItems)
      ? sourceItems.filter((item): item is SyncSessionPreviewItem =>
          this.isSyncSessionPreviewItem(item)
        )
      : [];

    if (sessions.length === 0) {
      return [this.createEmptyScenarioCommandRun(command, command.forEach)];
    }

    return sessions.map((session, index) =>
      this.createScenarioCommandRun(command, {
        command,
        session,
        index,
        total: sessions.length,
      })
    );
  }

  private createEmptyScenarioCommandRun(
    command: ProviderScenarioCommandDefinition,
    sourceKey: string
  ): ScenarioCommandRun {
    return {
      stepId: command.id,
      stepName: command.label,
      action: command.action,
      input: {
        source: sourceKey,
      },
      run: (): ScenarioCommandResult => {
        const start = Date.now();
        const result = createShellResult(
          command.id,
          command.label,
          "advanced",
          "fail",
          `Scenario command source is empty: ${sourceKey}`,
          undefined,
          Date.now() - start
        );
        return {
          status: "fail",
          message: result.message,
          result,
          output: {
            source: sourceKey,
            empty: true,
          },
        };
      },
    };
  }

  private createScenarioCommandRun(
    command: ProviderScenarioCommandDefinition,
    input: ScenarioCommandExecutionInput
  ): ScenarioCommandRun {
    const stepId =
      input.index === undefined ? command.id : `${command.id}-${(input.index ?? 0) + 1}`;
    const stepName = this.resolveScenarioCommandRunName(command, input);
    const scenarioCommandRun: ScenarioCommandRun = {
      stepId,
      stepName,
      action: command.action,
      run: async (): Promise<ScenarioCommandResult> =>
        await this.executeScenarioCommandRun(
          {
            ...input,
            command,
          },
          stepId,
          stepName
        ),
    };

    if (command.saveAs !== undefined) {
      scenarioCommandRun.saveOutputAs = command.saveAs;
    }

    const commandInput = this.buildScenarioCommandInput(command, input);
    if (commandInput !== undefined) {
      scenarioCommandRun.input = commandInput;
    }

    return scenarioCommandRun;
  }

  private resolveScenarioCommandRunName(
    command: ProviderScenarioCommandDefinition,
    input: ScenarioCommandExecutionInput
  ): string {
    if (input.session === undefined || input.index === undefined || input.total === undefined) {
      return command.label;
    }

    return `${command.label} ${input.index + 1}/${input.total} - ${input.session.title}`;
  }

  private buildScenarioCommandInput(
    command: ProviderScenarioCommandDefinition,
    input: ScenarioCommandExecutionInput
  ): Record<string, unknown> | undefined {
    const baseInput: Record<string, unknown> = {};

    if (command.target !== undefined) {
      baseInput["target"] = command.target;
    }
    if (command.params !== undefined) {
      baseInput["params"] = command.params;
    }
    if (input.session !== undefined) {
      baseInput["session"] = {
        title: input.session.title,
        url: input.session.url,
      };
    }
    if (input.index !== undefined && input.total !== undefined) {
      baseInput["index"] = input.index + 1;
      baseInput["total"] = input.total;
    }

    return Object.keys(baseInput).length > 0 ? baseInput : undefined;
  }

  private async executeScenarioCommandRun(
    input: ScenarioCommandExecutionInput,
    stepId: string,
    stepName: string
  ): Promise<ScenarioCommandResult> {
    this.throwIfCancelled();

    switch (input.command.action) {
      case "navigate-default":
        return await this.executeAggregatedTestScenarioCommand(
          stepId,
          stepName,
          "preflight",
          async () => await this.runResetDefaultPageStep()
        );
      case "assert-disabled-send":
        return await this.executeAggregatedTestScenarioCommand(
          stepId,
          stepName,
          "interactive",
          async () => await this.runDisabledSendStep()
        );
      case "assert-drag-drop-surface":
        return await this.executeAggregatedTestScenarioCommand(
          stepId,
          stepName,
          "dom",
          async () => await this.runDragDropStep()
        );
      case "inject-prompt":
        return await this.executeAggregatedTestScenarioCommand(
          stepId,
          stepName,
          "interactive",
          async () => await this.runInjectMessageStep()
        );
      case "assert-enabled-send":
        return await this.executeAggregatedTestScenarioCommand(
          stepId,
          stepName,
          "interactive",
          async () => await this.runEnabledSendStep()
        );
      case "assert-attach-flow":
        return await this.executeAggregatedTestScenarioCommand(
          stepId,
          stepName,
          "interactive",
          async () => await this.runAttachFileStep()
        );
      case "send-and-wait-thinking":
        return await this.executeAggregatedTestScenarioCommand(
          stepId,
          stepName,
          "interactive",
          async () => await this.runSendThinkingStep()
        );
      case "assert-final-bubbles":
        return await this.executeAggregatedTestScenarioCommand(
          stepId,
          stepName,
          "scraping",
          async () => await this.runFinalBubblesStep()
        );
      case "assert-scroll-behavior":
        return await this.executeAggregatedTestScenarioCommand(
          stepId,
          stepName,
          "scraping",
          async () => await this.runScrollStep()
        );
      case "assert-provider-capabilities":
        return await this.executeAggregatedTestScenarioCommand(
          stepId,
          stepName,
          "advanced",
          async () => await this.runProviderCapabilitiesStep()
        );
      case "click":
        return await this.executeClickScenarioCommand(input.command, stepId, stepName);
      case "wait":
        return await this.executeWaitScenarioCommand(input.command, stepId, stepName);
      case "check":
        return await this.executeCheckScenarioCommand(input.command, stepId, stepName);
      case "collect-session-urls":
        return await this.executeCollectSessionUrlsScenarioCommand(stepId, stepName);
      case "navigate":
        return await this.executeNavigateScenarioCommand(input.session, stepId, stepName);
      case "sync-session":
        return await this.executeSyncSessionScenarioCommand(
          input.command,
          input.session,
          stepId,
          stepName
        );
      case "refresh-conversation-list":
        return await this.executeRefreshConversationListScenarioCommand(stepId, stepName);
      default:
        return this.createUnsupportedScenarioCommandResult(input.command.action, stepId, stepName);
    }
  }

  private async executeAggregatedTestScenarioCommand(
    stepId: string,
    stepName: string,
    fallbackCategory: ProviderTestResult["category"],
    run: () => Promise<AggregatedCommandStepResult>
  ): Promise<ScenarioCommandResult> {
    const start = Date.now();
    const beforeResults = this.results.length;

    try {
      this.throwIfCancelled();
      const summary = await run();
      this.throwIfCancelled();

      const capturedResults = this.results.slice(beforeResults);
      this.results.length = beforeResults;
      const detailSource = [...capturedResults]
        .reverse()
        .find((result) => result.details !== undefined);
      const category = capturedResults[0]?.category ?? fallbackCategory;
      const result = createShellResult(
        stepId,
        stepName,
        category,
        summary.status,
        summary.message,
        detailSource?.details,
        Date.now() - start
      );

      return {
        status: summary.status,
        message: summary.message,
        result,
        ...(capturedResults.length > 0 ? { results: capturedResults } : {}),
        output: {
          capturedResultCount: capturedResults.length,
        },
      };
    } catch (error) {
      this.results.length = beforeResults;
      if (error instanceof ScenarioCancelledError) {
        throw error;
      }

      const result = createShellResult(
        stepId,
        stepName,
        fallbackCategory,
        "fail",
        error instanceof Error ? error.message : String(error),
        undefined,
        Date.now() - start
      );
      return {
        status: "fail",
        message: result.message,
        result,
      };
    }
  }

  private createUnsupportedScenarioCommandResult(
    action: string,
    stepId: string,
    stepName: string
  ): ScenarioCommandResult {
    const result = createShellResult(
      stepId,
      stepName,
      "advanced",
      "fail",
      `Unsupported scenario command action: ${action}`
    );

    return {
      status: "fail",
      message: result.message,
      result,
      output: {
        action,
      },
    };
  }

  private getScenarioCommandTimeoutMs(
    command: ProviderScenarioCommandDefinition,
    fallbackMs: number
  ): number {
    const timeoutMs = command.params?.["timeoutMs"];
    return typeof timeoutMs === "number" && Number.isFinite(timeoutMs) && timeoutMs > 0
      ? timeoutMs
      : fallbackMs;
  }

  private resolveScenarioCommandSyncMode(
    command: ProviderScenarioCommandDefinition
  ): ProviderWebviewSyncMode {
    const explicitMode = command.params?.["mode"];
    if (explicitMode === "soft" || explicitMode === "full" || explicitMode === "clean") {
      return explicitMode;
    }

    if (command.params?.["modeSource"] === "syncMode") {
      return this.syncMode;
    }

    return this.syncMode;
  }

  private async executeClickScenarioCommand(
    command: ProviderScenarioCommandDefinition,
    stepId: string,
    stepName: string
  ): Promise<ScenarioCommandResult> {
    const start = Date.now();
    if (command.target !== "sync-sidebar-open-button") {
      return this.createUnsupportedScenarioCommandResult(
        `click:${command.target ?? "unknown"}`,
        stepId,
        stepName
      );
    }

    const beforeState = await this.probeSyncSidebar(false);
    const alreadyOpen = beforeState.historyVisible || beforeState.closeVisible;
    if (alreadyOpen) {
      const result = createShellResult(
        stepId,
        stepName,
        "preflight",
        "pass",
        "Sidebar already open",
        undefined,
        Date.now() - start
      );
      return {
        status: "pass",
        message: result.message,
        result,
        output: {
          target: command.target,
          clicked: false,
          alreadyOpen: true,
        },
      };
    }

    if (!beforeState.openFound) {
      const result = createShellResult(
        stepId,
        stepName,
        "preflight",
        "fail",
        "Sidebar open button not found",
        undefined,
        Date.now() - start
      );
      return {
        status: "fail",
        message: result.message,
        result,
        output: {
          target: command.target,
          clicked: false,
          alreadyOpen: false,
        },
      };
    }

    const afterClickState = await this.probeSyncSidebar(true);
    const clicked = afterClickState.clickedOpen;
    const becameVisible = afterClickState.historyVisible || afterClickState.closeVisible;
    const status: TestStatus = clicked || becameVisible ? "pass" : "fail";
    const message = clicked
      ? "Sidebar open button clicked"
      : becameVisible
        ? "Sidebar became visible"
        : "Sidebar open button click failed";
    const result = createShellResult(
      stepId,
      stepName,
      "preflight",
      status,
      message,
      undefined,
      Date.now() - start
    );

    return {
      status,
      message,
      result,
      output: {
        target: command.target,
        clicked,
        alreadyOpen: false,
        historyVisible: afterClickState.historyVisible,
        closeVisible: afterClickState.closeVisible,
      },
    };
  }

  private async executeWaitScenarioCommand(
    command: ProviderScenarioCommandDefinition,
    stepId: string,
    stepName: string
  ): Promise<ScenarioCommandResult> {
    const start = Date.now();
    if (command.target !== "sync-sidebar-ready") {
      return this.createUnsupportedScenarioCommandResult(
        `wait:${command.target ?? "unknown"}`,
        stepId,
        stepName
      );
    }

    const timeoutMs = this.getScenarioCommandTimeoutMs(
      command,
      PROVIDER_SCENARIO_TIMEOUTS.SIDEBAR_READY
    );
    const ready = await waitForCondition(
      async () => {
        const state = await this.probeSyncSidebar(false);
        return state.historyVisible || state.closeVisible;
      },
      timeoutMs,
      this.abortSignal
    );
    const state = await this.probeSyncSidebar(false);
    const result = createShellResult(
      stepId,
      stepName,
      "preflight",
      ready ? "pass" : "fail",
      ready ? "Sidebar ready" : "Sidebar did not become ready",
      undefined,
      Date.now() - start
    );

    return {
      status: result.status,
      message: result.message,
      result,
      output: {
        target: command.target,
        timeoutMs,
        ready,
        historyVisible: state.historyVisible,
        closeVisible: state.closeVisible,
      },
    };
  }

  private async executeCheckScenarioCommand(
    command: ProviderScenarioCommandDefinition,
    stepId: string,
    stepName: string
  ): Promise<ScenarioCommandResult> {
    const start = Date.now();
    if (command.target !== "sync-sidebar-ready") {
      return this.createUnsupportedScenarioCommandResult(
        `check:${command.target ?? "unknown"}`,
        stepId,
        stepName
      );
    }

    const state = await this.probeSyncSidebar(false);
    const ready = state.historyVisible || state.closeVisible;
    const result = createShellResult(
      stepId,
      stepName,
      "preflight",
      ready ? "pass" : "fail",
      ready ? "Sidebar is visible" : "Sidebar is not visible",
      undefined,
      Date.now() - start
    );

    return {
      status: result.status,
      message: result.message,
      result,
      output: {
        target: command.target,
        ready,
        historyVisible: state.historyVisible,
        closeVisible: state.closeVisible,
        openFound: state.openFound,
      },
    };
  }

  private async executeCollectSessionUrlsScenarioCommand(
    stepId: string,
    stepName: string
  ): Promise<ScenarioCommandResult> {
    const start = Date.now();
    const sessions = await this.collectVisibleSyncSessions();
    this.syncSessions = sessions;
    const preview = this.buildSyncSessionPreview();
    const status: TestStatus = sessions.length > 0 ? "pass" : "fail";
    const message =
      sessions.length > 0
        ? `Collected ${sessions.length} visible sessions`
        : "No visible sessions found in sidebar";
    const result = createShellResult(
      stepId,
      stepName,
      "scraping",
      status,
      message,
      {
        selector: sessions.map((session) => session.url).join(", "),
        ...(preview.total > 0 ? { sessionPreview: preview } : {}),
      },
      Date.now() - start
    );

    return {
      status,
      message,
      result,
      output: sessions.map((session) => ({
        title: session.title,
        url: session.url,
      })),
    };
  }

  private async executeNavigateScenarioCommand(
    session: SyncSessionPreviewItem | undefined,
    stepId: string,
    stepName: string
  ): Promise<ScenarioCommandResult> {
    const start = Date.now();
    if (session === undefined) {
      const result = createShellResult(
        stepId,
        stepName,
        "interactive",
        "fail",
        "Navigate command is missing a session"
      );
      return {
        status: "fail",
        message: result.message,
        result,
      };
    }

    try {
      await this.webview.loadURL(session.url);
      const loadingState = await this.observeLoadingIndicatorAfterNavigation();
      const finalUrl = this.webview.getURL();
      const result = createShellResult(
        stepId,
        stepName,
        "interactive",
        "pass",
        `Opened ${session.title}; loading indicator settled as ${loadingState}`,
        {
          selector: session.url,
        },
        Date.now() - start
      );

      return {
        status: "pass",
        message: result.message,
        result,
        output: {
          title: session.title,
          url: session.url,
          finalUrl,
          matched: finalUrl === session.url,
          loadingState,
        },
      };
    } catch (error) {
      const result = createShellResult(
        stepId,
        stepName,
        "interactive",
        "fail",
        (error as Error).message,
        {
          selector: session.url,
          error: (error as Error).message,
        },
        Date.now() - start
      );
      return {
        status: "fail",
        message: result.message,
        result,
        output: {
          title: session.title,
          url: session.url,
        },
      };
    }
  }

  private async executeSyncSessionScenarioCommand(
    command: ProviderScenarioCommandDefinition,
    session: SyncSessionPreviewItem | undefined,
    stepId: string,
    stepName: string
  ): Promise<ScenarioCommandResult> {
    const start = Date.now();
    if (session === undefined) {
      const result = createShellResult(
        stepId,
        stepName,
        "interactive",
        "fail",
        "Sync command is missing a session"
      );
      return {
        status: "fail",
        message: result.message,
        result,
      };
    }

    const syncMode = this.resolveScenarioCommandSyncMode(command);
    const outcome =
      syncMode === "soft"
        ? await this.runSoftSyncForSession(session)
        : syncMode === "clean"
          ? await this.runCleanSyncForSession(session)
          : await this.runFullSyncForSession(session);
    const result = createShellResult(
      stepId,
      stepName,
      "interactive",
      outcome.status,
      outcome.message,
      outcome.details,
      Date.now() - start
    );

    return {
      status: outcome.status,
      message: outcome.message,
      result,
      output: {
        syncMode,
        ...(outcome.output ?? {}),
      },
    };
  }

  private async executeRefreshConversationListScenarioCommand(
    stepId: string,
    stepName: string
  ): Promise<ScenarioCommandResult> {
    const start = Date.now();
    await this.refreshConversationList();
    const result = createShellResult(
      stepId,
      stepName,
      "advanced",
      "pass",
      "Conversation list refreshed",
      undefined,
      Date.now() - start
    );

    return {
      status: "pass",
      message: result.message,
      result,
      output: {
        refreshed: this.shell !== null,
      },
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

  private getWebviewSyncConfig(): ProviderWebviewSyncConfig {
    if (this.config.webviewSync === undefined) {
      throw new Error(`Provider ${this.config.id} is missing webviewSync config`);
    }

    return this.config.webviewSync;
  }

  private async resolveDatabaseManager(): Promise<ProviderTesterDatabaseManager> {
    if (this.databaseManager !== null) {
      return this.databaseManager;
    }

    this.databaseManager = await loadDatabaseManager();
    return this.databaseManager;
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
  ): Promise<{
    added: number;
    total: number;
    metadata?: ConversationMetadataResult["data"];
  }> {
    const databaseManager = await this.resolveDatabaseManager();
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
      metadata: metadataResult.data,
    };
  }

  protected async runSoftSyncForSession(
    session: SyncSessionPreviewItem
  ): Promise<SyncSessionOutcome> {
    const accountId = await this.resolveSlotAccountId();
    if (accountId === "") {
      return { status: "fail", message: `No account assigned for ${this.slot}` };
    }

    const databaseManager = await this.resolveDatabaseManager();
    const result = await databaseManager.upsertConversationMetadata(null, {
      accountId,
      webUrl: session.url,
      provider: this.config.id,
      title: session.title,
    });
    if (result.success !== true) {
      return { status: "fail", message: result.error ?? `Soft sync failed for ${session.url}` };
    }

    return {
      status: "pass",
      message: `Soft sync saved ${session.title}`,
      details: {
        selector: session.url,
      },
      output: {
        title: session.title,
        url: session.url,
        conversationId: result.data?.conversationId ?? "",
        created: result.data?.created ?? false,
        titleUpdated: result.data?.titleUpdated ?? false,
      },
    };
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
      return {
        status: "pass",
        message: `Full sync added ${syncResult.added} messages for ${session.title}`,
        details: {
          selector: session.url,
        },
        output: {
          title: session.title,
          url: session.url,
          added: syncResult.added,
          total: syncResult.total,
          conversationId: syncResult.metadata?.conversationId ?? "",
          created: syncResult.metadata?.created ?? false,
          titleUpdated: syncResult.metadata?.titleUpdated ?? false,
        },
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

    const databaseManager = await this.resolveDatabaseManager();
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
      return {
        status: "pass",
        message: `Clean sync reset ${resetResult.data?.deletedCount ?? 0} messages and imported ${syncResult.added} for ${session.title}`,
        details: {
          selector: session.url,
        },
        output: {
          title: session.title,
          url: session.url,
          deletedCount: resetResult.data?.deletedCount ?? 0,
          added: syncResult.added,
          total: syncResult.total,
          conversationId: syncResult.metadata?.conversationId ?? "",
          created: syncResult.metadata?.created ?? false,
          titleUpdated: syncResult.metadata?.titleUpdated ?? false,
        },
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

  private async runResetDefaultPageStep(): Promise<AggregatedCommandStepResult> {
    const results: ProviderTestResult[] = [];
    const defaultUrl = this.defaultUrlOverride ?? resolveDefaultUrl(this.config);
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
        `Loading indicator settled as ${loadingState}`
      )
    );
    results.push(urlCheck);

    this.pushResults(results);
    return this.summarizeStep(results, "Default page reset failed");
  }

  private async runDisabledSendStep(): Promise<AggregatedCommandStepResult> {
    const results = this.pushResults([
      await testInputField(this.ctx),
      await testInputFieldAccessibility(this.ctx),
      await testSendButtonDisabled(this.ctx),
      createShellResult(
        "send-indicator-disabled",
        "Send Indicator Disabled",
        "interactive",
        (await this.waitForShellIndicator("send", "busy", PROVIDER_TEST_TIMEOUTS.SEND_INDICATOR))
          ? "pass"
          : "fail",
        (await this.readShellIndicator("send")) === "busy"
          ? "Topbar send indicator is busy/disabled"
          : "Topbar send indicator did not show disabled state"
      ),
    ]);

    return this.summarizeStep(results, "Disabled send state failed");
  }

  private async runDragDropStep(): Promise<AggregatedCommandStepResult> {
    const results = this.pushResults([
      await testUploadTarget(this.ctx),
      await testCriticalSelectors(this.ctx),
    ]);

    return this.summarizeStep(results, "Drag and drop surface failed");
  }

  private async runInjectMessageStep(): Promise<AggregatedCommandStepResult> {
    const results = this.pushResults([await testTextInjection(this.ctx)]);
    return this.summarizeStep(results, "Message injection failed");
  }

  private async runEnabledSendStep(): Promise<AggregatedCommandStepResult> {
    const enabledResult = await testSendButtonEnabled(this.ctx);
    const indicatorStatus = await this.waitForShellIndicator(
      "send",
      "idle",
      PROVIDER_TEST_TIMEOUTS.SEND_INDICATOR
    );
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

  private async runAttachFileStep(): Promise<AggregatedCommandStepResult> {
    const results = this.pushResults([
      await testAttachButton(this.ctx),
      await testFileInput(this.ctx),
      await testFileUpload(this.ctx),
    ]);
    return this.summarizeStep(results, "Attach step completed with warnings");
  }

  private async runSendThinkingStep(): Promise<AggregatedCommandStepResult> {
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

  private async runFinalBubblesStep(): Promise<AggregatedCommandStepResult> {
    const results = this.pushResults([
      await testUserMessageInspect(this.ctx),
      await testAIResponseInspect(this.ctx),
      await testAssistantMessageScraping(this.ctx),
      await testMessageContainer(this.ctx),
    ]);
    return this.summarizeStep(results, "Final message bubble checks failed");
  }

  private async runScrollStep(): Promise<AggregatedCommandStepResult> {
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

  private async runProviderCapabilitiesStep(): Promise<AggregatedCommandStepResult> {
    const results = this.pushResults([
      await testMicrophoneButton(this.ctx),
      await testVoiceButton(this.ctx),
    ]);
    return this.summarizeStep(results, "Provider capability checks completed");
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
      timeout,
      this.abortSignal
    );
  }

  protected async observeLoadingIndicatorAfterNavigation(): Promise<"busy" | "idle" | "missing"> {
    if (this.shell === null) {
      return "missing";
    }

    const waitForSettledState = async (): Promise<"idle" | "missing"> => {
      this.throwIfCancelled();
      const state = await this.readShellIndicator("loading");
      if (state === "busy") {
        await this.waitForDelay(PROVIDER_TEST_INTERVALS.POLL);
        return await waitForSettledState();
      }

      if (this.navigationObservationDelayMs > 0) {
        await this.waitForDelay(this.navigationObservationDelayMs);
      }

      return state;
    };

    return await waitForSettledState();
  }

  private generateReport(
    scenarioId: ProviderScenarioId,
    aborted: boolean,
    abortReason?: string,
    commands: ProviderTestSuite["commands"] = []
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
      commands,
      aborted,
      ...(aborted && abortReason !== undefined ? { abortReason } : {}),
    };
  }
}
