import type {
  ProviderConfig,
  ProviderTestProgressEvent,
  ProviderTestResult,
  ProviderTestSuite,
  ProviderTestStep,
  ProviderTestSlot,
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
import { runProviderTestScenario, type ScenarioStepResult } from "./scenario-runner.ts";
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

function generateRunId(slot: ProviderTestSlot, providerId: string): string {
  const suffix = Math.random().toString(36).slice(2, 8);
  return `provider-test-${slot}-${providerId}-${Date.now()}-${suffix}`;
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
    this.startTime = Date.now();
    this.results = [];
    this.runId = generateRunId(this.slot, this.config.id);

    const scenario = await runProviderTestScenario({
      runId: this.runId,
      slot: this.slot,
      providerId: this.config.id,
      ...(this.emitProgress !== undefined ? { emitProgress: this.emitProgress } : {}),
      steps: [
        {
          id: "reset-default-page",
          name: "Reset Default Page",
          severity: "core",
          delayAfterMs: 700,
          run: async (): Promise<ScenarioStepResult> => await this.runResetDefaultPageStep(),
        },
        {
          id: "disabled-send",
          name: "Disabled Send State",
          severity: "core",
          delayAfterMs: 350,
          run: async (): Promise<ScenarioStepResult> => await this.runDisabledSendStep(),
        },
        {
          id: "drag-drop-surface",
          name: "Drag And Drop Surface",
          severity: "core",
          delayAfterMs: 350,
          run: async (): Promise<ScenarioStepResult> => await this.runDragDropStep(),
        },
        {
          id: "inject-message",
          name: "Inject Message",
          severity: "core",
          delayAfterMs: 350,
          run: async (): Promise<ScenarioStepResult> => await this.runInjectMessageStep(),
        },
        {
          id: "enabled-send",
          name: "Enabled Send State",
          severity: "core",
          delayAfterMs: 350,
          run: async (): Promise<ScenarioStepResult> => await this.runEnabledSendStep(),
        },
        {
          id: "attach-file",
          name: "Attach File",
          severity: "soft",
          delayAfterMs: 400,
          run: async (): Promise<ScenarioStepResult> => await this.runAttachFileStep(),
        },
        {
          id: "send-thinking",
          name: "Send And Thinking",
          severity: "core",
          delayAfterMs: 700,
          run: async (): Promise<ScenarioStepResult> => await this.runSendThinkingStep(),
        },
        {
          id: "final-bubbles",
          name: "Final Message Bubbles",
          severity: "core",
          delayAfterMs: 350,
          run: async (): Promise<ScenarioStepResult> => await this.runFinalBubblesStep(),
        },
        {
          id: "scroll-behavior",
          name: "Scroll Behavior",
          severity: "core",
          delayAfterMs: 350,
          run: async (): Promise<ScenarioStepResult> => await this.runScrollStep(),
        },
        {
          id: "provider-capabilities",
          name: "Provider Capabilities",
          severity: "provider",
          delayAfterMs: 350,
          run: async (): Promise<ScenarioStepResult> => await this.runProviderCapabilitiesStep(),
        },
      ],
    });

    return this.generateReport(scenario.steps, scenario.aborted, scenario.abortReason);
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

  private async runResetDefaultPageStep(): Promise<ScenarioStepResult> {
    const results: ProviderTestResult[] = [];
    const defaultUrl = resolveDefaultUrl(this.config);
    const start = Date.now();
    const loadPromise = this.webview.loadURL(defaultUrl);
    const loadingStarted = await this.waitForShellIndicator("loading", "busy", 5000);
    await loadPromise;
    const loadingFinished = await this.waitForShellIndicator("loading", "idle", 10000);
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
        "loading-indicator-start",
        "Loading Indicator Start",
        "preflight",
        loadingStarted ? "pass" : "fail",
        loadingStarted ? "Loading indicator became busy" : "Loading indicator did not become busy"
      )
    );
    results.push(
      createShellResult(
        "loading-indicator-end",
        "Loading Indicator End",
        "preflight",
        loadingFinished ? "pass" : "fail",
        loadingFinished
          ? "Loading indicator returned to idle"
          : "Loading indicator did not return to idle"
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

  private generateReport(
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
