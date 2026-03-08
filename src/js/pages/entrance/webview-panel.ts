import type { WebviewTag } from "electron";
import { LogCategory } from "@shared/logging-core";
import { Logger } from "../../modules/logger/index.js";
import { getErrorMessage } from "@shared/index.js";
import { SettingsManager } from "../../modules/settings-manager.js";
import { AppState } from "../../modules/app-state.js";
import { SlotController } from "../../modules/slot-controller.js";
import { TrafficManager } from "../../modules/traffic-manager.js";
import { deliverToAsistan } from "../../modules/asistan-delivery.js";
import { ProviderRegistry } from "../../modules/webview/provider-registry.js";
import { WebviewManager } from "../../modules/webview-manager.js";
import {
  buildScenarioCompletionMessage,
  buildScenarioProgressSummary,
  buildScenarioStatusCounts,
  filterScenarioDisplayRows,
  resolveScenarioSurface,
  type ScenarioStatusFilter,
} from "../shared/provider-test-presentation.js";

import type { AppSettings } from "@shared/settings.js";
import type {
  ProviderScenarioCommandReport,
  ProviderScenarioProgressEvent,
  ProviderTestProgressEvent,
  ProviderTestResult,
  ProviderTestSuite,
  ProviderWebviewSyncMode,
} from "@shared/provider.js";

type SlotType = "ai1" | "ai2";

type TrafficManagerState = (typeof TrafficManager.state)[SlotType];

interface SlotState {
  hasAccount: boolean;
  connected: boolean;
  connecting: boolean;
  active: boolean;
}

interface ScenarioOverlayState {
  scenarioId: string;
  scenarioTitle: string;
  syncMode: ProviderWebviewSyncMode;
  testedSlot: SlotType;
  hostSlot: SlotType;
  providerName: string;
  phase: "launcher" | "running" | "completed";
  deliveryInFlight: boolean;
  filter: ScenarioStatusFilter;
  runId: string | null;
  commands: ProviderScenarioCommandReport[];
  message: string;
  suite: ProviderTestSuite | null;
}

interface WebviewElement extends HTMLElement {
  getWebContentsId?: () => number;
  getURL?: () => string;
  executeJavaScript?: (script: string) => Promise<unknown>;
  openDevTools?: () => void;
}

export class WebviewPanel {
  ai1Webview: HTMLElement | null;
  ai2Webview: HTMLElement | null;
  trafficUnsub: (() => void) | null;
  loadLogState: Record<string, { lastStart: number; lastStop: number }>;
  sessionUrlSaveTimers: Record<SlotType, ReturnType<typeof setTimeout> | null>;
  scenarioOverlayState: ScenarioOverlayState | null;
  providerTestProgressHandler: ((event: ProviderTestProgressEvent) => void) | null;

  constructor() {
    this.ai1Webview = null;
    this.ai2Webview = null;
    this.trafficUnsub = null;
    this.loadLogState = {
      ai1: { lastStart: 0, lastStop: 0 },
      ai2: { lastStart: 0, lastStop: 0 },
    };
    this.sessionUrlSaveTimers = {
      ai1: null,
      ai2: null,
    };
    this.scenarioOverlayState = null;
    this.providerTestProgressHandler = null;
  }

  init(): void {
    this.setupEventListeners();
  }

  setupEventListeners(): void {
    try {
      const ai1DevtoolsBtn = document.getElementById("ai1-devtools-btn");
      if (ai1DevtoolsBtn) {
        ai1DevtoolsBtn.addEventListener("click", () => {
          this.openDevTools("ai1");
        });
      }

      const ai2DevtoolsBtn = document.getElementById("ai2-devtools-btn");
      if (ai2DevtoolsBtn) {
        ai2DevtoolsBtn.addEventListener("click", () => {
          this.openDevTools("ai2");
        });
      }

      const ai1TestBtn = document.getElementById("ai1-test-btn");
      if (ai1TestBtn) {
        ai1TestBtn.addEventListener("click", () => {
          this.handleTestClick("ai1");
        });
      }

      const ai1SyncBtn = document.getElementById("ai1-sync-btn");
      if (ai1SyncBtn) {
        ai1SyncBtn.addEventListener("click", () => {
          this.handleSyncClick("ai1");
        });
      }

      const ai2TestBtn = document.getElementById("ai2-test-btn");
      if (ai2TestBtn) {
        ai2TestBtn.addEventListener("click", () => {
          this.handleTestClick("ai2");
        });
      }

      const ai2SyncBtn = document.getElementById("ai2-sync-btn");
      if (ai2SyncBtn) {
        ai2SyncBtn.addEventListener("click", () => {
          this.handleSyncClick("ai2");
        });
      }
    } catch (err) {
      const error = /** @type {Error} */ err;
      Logger.error(LogCategory.ENTRANCE, `Event listener setup hatası: ${getErrorMessage(error)}`);
    }
  }

  subscribeToTraffic(): void {
    this.trafficUnsub ??= TrafficManager.onUpdate(
      ({ provider, state }: { provider?: string; state?: unknown }) => {
        if (provider !== undefined && provider !== "") {
          this.updateUrlDisplay(provider, state as TrafficManagerState);
        } else {
          (["ai1", "ai2"] as SlotType[]).forEach((p) => {
            this.updateUrlDisplay(p, TrafficManager.state[p]);
          });
        }
      }
    );
  }

  applyTitles(): void {
    const ai1Title = document.getElementById("ai1-title");
    const ai2Title = document.getElementById("ai2-title");
    if (ai1Title) ai1Title.textContent = AppState.getNickname("ai1");
    if (ai2Title) ai2Title.textContent = AppState.getNickname("ai2");
  }

  updateUrlDisplay(provider: string, state: TrafficManagerState | undefined): void {
    const urlDisplay = document.getElementById(`${provider}-url-display`);
    if (!urlDisplay) return;

    const hasAccount = !!AppState.getAccountForSlot(provider);
    if (!hasAccount) {
      urlDisplay.textContent = "Slot boş - Hesap atanmadı";
      return;
    }

    const href = state?.lastHref ?? "";
    if (href !== "") {
      urlDisplay.textContent = href;
    } else {
      urlDisplay.textContent = "-";
    }
  }

  async setupWebviews(): Promise<void> {
    try {
      const ai1WebviewEl = document.getElementById("ai1-webview") as WebviewTag | null;
      const ai2WebviewEl = document.getElementById("ai2-webview") as WebviewTag | null;

      // NOTE: Webview registration is done in app.ts to avoid duplicate registration
      if (ai1WebviewEl && !this.ai1Webview) {
        this.ai1Webview = ai1WebviewEl;
      }

      if (ai2WebviewEl && !this.ai2Webview) {
        this.ai2Webview = ai2WebviewEl;
      }

      const ai1Mount = document.getElementById("ai1-webview-mount");
      const ai2Mount = document.getElementById("ai2-webview-mount");

      if (ai1WebviewEl && ai1Mount && !ai1Mount.contains(ai1WebviewEl)) {
        SlotController.ensureWebviewMounted("ai1");
      }

      if (ai2WebviewEl && ai2Mount && !ai2Mount.contains(ai2WebviewEl)) {
        SlotController.ensureWebviewMounted("ai2");
      }

      const ai1HasAccount = !!AppState.getAccountForSlot("ai1");

      const ai1EventsSetup = ai1WebviewEl?.dataset["eventsSetup"];
      if (
        ai1WebviewEl &&
        ai1HasAccount &&
        (ai1EventsSetup === undefined || ai1EventsSetup === "")
      ) {
        const ai1ProviderId = AppState.getProviderIdForSlot("ai1") ?? "";

        this.setupWebviewEvents("ai1", ai1WebviewEl, ai1ProviderId);
        ai1WebviewEl.dataset["eventsSetup"] = "true";

        const ai1PreloadAttr = ai1WebviewEl.getAttribute("preload");
        if (
          window.electronAPI?.getPreloadPath !== undefined &&
          (ai1PreloadAttr === null || ai1PreloadAttr === "")
        ) {
          try {
            const preloadPath = await window.electronAPI.getPreloadPath("ai1");
            if (preloadPath !== "") {
              ai1WebviewEl.setAttribute("preload", preloadPath);
              this.addLog("ai1", "info", `Preload script ayarlandı: ${preloadPath}`);
            }
          } catch (err) {
            const error = err as Error;
            Logger.warn(
              LogCategory.ENTRANCE,
              `AI1 preload path ayarlanamadı: ${getErrorMessage(error)}`
            );
            this.addLog("ai1", "warning", "Preload script ayarlanamadı...");
          }
        }
      }

      const ai2HasAccount = !!AppState.getAccountForSlot("ai2");

      const ai2EventsSetup = ai2WebviewEl?.dataset["eventsSetup"];
      if (
        ai2WebviewEl &&
        ai2HasAccount &&
        (ai2EventsSetup === undefined || ai2EventsSetup === "")
      ) {
        const ai2ProviderId = AppState.getProviderIdForSlot("ai2") ?? "";

        this.setupWebviewEvents("ai2", ai2WebviewEl, ai2ProviderId);
        ai2WebviewEl.dataset["eventsSetup"] = "true";

        const ai2PreloadAttr = ai2WebviewEl.getAttribute("preload");
        if (
          window.electronAPI?.getPreloadPath !== undefined &&
          (ai2PreloadAttr === null || ai2PreloadAttr === "")
        ) {
          try {
            const preloadPath = await window.electronAPI.getPreloadPath("ai2");
            if (preloadPath !== "") {
              ai2WebviewEl.setAttribute("preload", preloadPath);
              this.addLog("ai2", "info", `Preload script ayarlandı: ${preloadPath}`, {
                visibility: 2,
              });
            }
          } catch (err) {
            const error = err as Error;
            Logger.warn(
              LogCategory.ENTRANCE,
              `AI2 preload path ayarlanamadı: ${getErrorMessage(error)}`
            );
            this.addLog("ai2", "warning", "Preload script ayarlanamadı...");
          }
        }
      }
    } catch (err) {
      const error = err as Error;
      Logger.error(LogCategory.ENTRANCE, `Webview setup hatası: ${getErrorMessage(error)}`);
    }
  }

  getSlotState(settings: AppSettings | null, provider: string): SlotState {
    const slots = settings?.slots as Record<string, { accountId?: string }> | undefined;
    const slot = slots?.[provider] ?? {};
    const hasAccount = slot.accountId !== undefined && slot.accountId !== "";
    const connected = SlotController.isConnected(provider) === true;
    const connecting = SlotController.isTransitioning(provider) === true;
    return {
      hasAccount,
      connected,
      connecting,
      active: hasAccount && (connected || connecting),
    };
  }

  setDevtoolsEnabled(provider: string, enabled: boolean): void {
    const btn = document.getElementById(`${provider}-devtools-btn`) as HTMLButtonElement | null;
    if (!btn) return;
    btn.disabled = !enabled;
    btn.classList.toggle("disabled", !enabled);
  }

  setTestButtonEnabled(provider: string, enabled: boolean): void {
    const btn = document.getElementById(`${provider}-test-btn`) as HTMLButtonElement | null;
    if (!btn) return;
    btn.disabled = !enabled;
    btn.classList.toggle("disabled", !enabled);

    if (!enabled) {
      btn.title = "Slot'a hesap atanmadı";
    } else {
      btn.title = `${provider.toUpperCase()} provider test`;
    }
  }

  setSyncButtonEnabled(provider: string, enabled: boolean): void {
    const btn = document.getElementById(`${provider}-sync-btn`) as HTMLButtonElement | null;
    if (!btn) return;
    btn.disabled = !enabled;
    btn.classList.toggle("disabled", !enabled);

    if (!enabled) {
      btn.title = "Provider sync icin hazir degil";
    } else {
      btn.title = `${provider.toUpperCase()} provider sync`;
    }
  }

  hasVerifiedSyncScenario(slot: SlotType): boolean {
    const providerId = AppState.getProviderIdForSlot(slot);
    if (providerId == null || providerId === "") {
      return false;
    }

    const providerConfig = ProviderRegistry.get(providerId) as {
      webviewSync?: { readiness?: string };
    } | null;
    return providerConfig?.webviewSync?.readiness === "verified";
  }

  isScenarioOverlayHost(slot: SlotType): boolean {
    return this.scenarioOverlayState?.hostSlot === slot;
  }

  openScenarioLauncher(slot: SlotType, scenarioId: string, scenarioTitle: string): void {
    if (this.scenarioOverlayState?.phase === "running") {
      return;
    }

    const surface = resolveScenarioSurface(slot);
    if (surface.kind !== "overlay") {
      return;
    }

    this.scenarioOverlayState = {
      scenarioId,
      scenarioTitle,
      syncMode: "full",
      testedSlot: slot,
      hostSlot: surface.hostSlot,
      providerName: AppState.getNickname(slot),
      phase: "launcher",
      deliveryInFlight: false,
      filter: "all",
      runId: null,
      commands: [],
      message: "Senaryoyu baslatinca ilerleme adimlari burada gorunur.",
      suite: null,
    };

    this.renderScenarioOverlay();
  }

  closeScenarioOverlay(): void {
    const state = this.scenarioOverlayState;
    if (!state) return;

    this.resetScenarioOverlayState(state);
    this.applyGating(SettingsManager.getSnapshot(), ["*"]);
  }

  private resetScenarioOverlayState(state: ScenarioOverlayState): void {
    const overlayEl = document.getElementById(`${state.hostSlot}-scenario-overlay`);
    if (overlayEl) {
      overlayEl.innerHTML = "";
      overlayEl.className = "webview-overlay hidden scenario-slot-overlay";
    }

    const mountEl = document.getElementById(`${state.hostSlot}-webview-mount`);
    mountEl?.classList.remove("webview-content-blocked");

    this.scenarioOverlayState = null;
  }

  private requestScenarioCancellation(runId: string | null): void {
    if (runId === null || runId.trim() === "") {
      return;
    }

    const electronApi = window.electronAPI;
    if (electronApi === undefined) {
      return;
    }

    void electronApi.cancelProviderScenario({ runId }).catch((error) => {
      Logger.warn(
        LogCategory.ENTRANCE,
        `Scenario cancel request failed: ${getErrorMessage(error as Error)}`
      );
    });
  }

  private shouldDismissScenarioOverlayForSlotState(state: SlotState): boolean {
    return !state.hasAccount || (!state.connected && !state.connecting);
  }

  private dismissScenarioOverlayForUnavailableSlot(options?: { cancelActiveRun?: boolean }): void {
    const state = this.scenarioOverlayState;
    if (!state) {
      return;
    }

    if (options?.cancelActiveRun === true) {
      this.requestScenarioCancellation(state.runId);
    }

    this.resetScenarioOverlayState(state);
  }

  updateScenarioProgress(event: ProviderScenarioProgressEvent): void {
    const state = this.scenarioOverlayState;
    if (event.slot !== state?.testedSlot) return;
    if (state.runId !== null && event.runId !== state.runId) return;

    state.runId ??= event.runId;

    if (event.type === "started") {
      state.phase = "running";
      state.message = `${state.providerName} ${state.scenarioTitle} hazirlaniyor`;
    }

    if (
      (event.type === "command-start" || event.type === "command-complete") &&
      event.commandReport !== undefined
    ) {
      const commandReport = event.commandReport;
      const existing = state.commands.find((command) => command.id === commandReport.id);
      if (existing) {
        Object.assign(existing, commandReport);
      } else {
        state.commands.push({ ...commandReport });
      }
      state.message = event.message ?? state.message;
    }

    if (event.type === "completed") {
      state.phase = "completed";
      state.message = event.message ?? state.message;
    }

    this.renderScenarioOverlay();
  }

  renderScenarioOverlay(): void {
    const state = this.scenarioOverlayState;
    if (!state) return;

    const overlayEl = document.getElementById(`${state.hostSlot}-scenario-overlay`);
    const mountEl = document.getElementById(`${state.hostSlot}-webview-mount`);
    if (!overlayEl || !mountEl) return;

    overlayEl.className = "webview-overlay scenario-slot-overlay scenario-overlay";
    overlayEl.classList.remove("hidden");
    mountEl.classList.add("webview-content-blocked");

    const displayCommands =
      state.commands.length > 0 ? state.commands : (state.suite?.commands ?? []);
    const summary = buildScenarioProgressSummary({
      slot: state.testedSlot,
      providerName: state.providerName,
      scenarioTitle: state.scenarioTitle,
      commands: displayCommands,
    });
    const counts = buildScenarioStatusCounts({ commands: displayCommands });
    const rows = filterScenarioDisplayRows({
      filter: state.filter,
      commands: displayCommands,
    });
    const isRunning = state.phase === "running";
    const canDeliverToAsistan =
      state.scenarioId === "webview-test" && state.phase === "completed" && state.suite !== null;
    const summaryMarkup = `
      <div class="scenario-overlay__summary" role="tablist" aria-label="Sonuc filtreleri">
        <button class="scenario-summary-chip scenario-summary-chip--pass${state.filter === "pass" ? " is-active" : ""}" type="button" data-filter-status="pass">
          ${counts.pass} pass
        </button>
        <button class="scenario-summary-chip scenario-summary-chip--fail${state.filter === "fail" ? " is-active" : ""}" type="button" data-filter-status="fail">
          ${counts.fail} fail
        </button>
        <button class="scenario-summary-chip scenario-summary-chip--warning${state.filter === "warning" ? " is-active" : ""}" type="button" data-filter-status="warning">
          ${counts.warning} warning
        </button>
        <button class="scenario-summary-chip scenario-summary-chip--skip${state.filter === "skip" ? " is-active" : ""}" type="button" data-filter-status="skip">
          ${counts.skip} skip
        </button>
      </div>
    `;
    const syncModeMarkup =
      state.scenarioId === "webview-sync"
        ? `
            <div class="scenario-sync-mode" role="group" aria-label="Sync modu secimi">
              <button class="scenario-sync-mode__option${state.syncMode === "soft" ? " is-active" : ""}" type="button" data-sync-mode="soft" ${isRunning ? "disabled" : ""}>Soft</button>
              <button class="scenario-sync-mode__option${state.syncMode === "full" ? " is-active" : ""}" type="button" data-sync-mode="full" ${isRunning ? "disabled" : ""}>Full</button>
              <button class="scenario-sync-mode__option${state.syncMode === "clean" ? " is-active" : ""}" type="button" data-sync-mode="clean" ${isRunning ? "disabled" : ""}>Clean</button>
            </div>
          `
        : "";

    const stepMarkup =
      rows.length === 0
        ? `<div class="scenario-empty">${state.filter === "all" ? "Henüz adim baslamadi." : "Bu filtre icin sonuc yok."}</div>`
        : rows
            .map((row) => {
              const messageClass =
                row.id.startsWith("navigate-session") ||
                row.id.startsWith("sync-session") ||
                row.id.startsWith("soft-sync-session") ||
                row.id === "open-session-urls" ||
                row.id === "sync-open-session-urls"
                  ? "scenario-step__message scenario-step__message--sync-progress"
                  : "scenario-step__message";
              const sessionPreview = row.sessionPreview;
              const previewSessionCount = sessionPreview?.sessions.length ?? 0;
              const previewMarkup =
                sessionPreview !== undefined && previewSessionCount > 0
                  ? `
                        <div class="scenario-step__preview-list" aria-label="Toplanan sessionlar">
                          <div class="scenario-step__preview-header">${sessionPreview.total} session bulundu</div>
                          ${sessionPreview.sessions
                            .map(
                              (session) => `
                                <div class="scenario-step__preview-item">
                                  <span class="scenario-step__preview-title">${session.title}</span>
                                  <span class="scenario-step__preview-url">${session.url}</span>
                                </div>
                              `
                            )
                            .join("")}
                        </div>
                      `
                  : "";

              return `
                    <div class="scenario-step scenario-step--${row.status}">
                      <div class="scenario-step__body">
                        <span class="scenario-step__name">${row.name}</span>
                        ${row.message !== "" ? `<span class="${messageClass}">${row.message}</span>` : ""}
                        ${previewMarkup}
                      </div>
                      <span class="scenario-step__status">${row.status}</span>
                    </div>
                  `;
            })
            .join("");

    overlayEl.innerHTML = `
      <div class="scenario-overlay__header">
            <div>
              <div class="scenario-overlay__eyebrow">${state.testedSlot.toUpperCase()} ${state.scenarioTitle}</div>
              <div class="overlay-title">${summary.title}</div>
              <div class="overlay-subtitle">${state.message}</div>
            </div>
        <button class="btn btn-ghost btn-sm scenario-overlay__close" type="button" ${isRunning ? "disabled" : ""}>Kapat</button>
      </div>
          <div class="scenario-overlay__meta">
            <span>${summary.completedSteps}/${summary.totalSteps} adim tamamlandi</span>
            <span>${summary.activeStepId ?? "hazir"}</span>
          </div>
          ${syncModeMarkup}
          ${summaryMarkup}
          <div class="scenario-overlay__steps">${stepMarkup}</div>
              <div class="scenario-overlay__actions">
                <button class="btn btn-primary btn-sm scenario-overlay__start" type="button" ${isRunning ? "disabled" : ""}>
                  ${state.phase === "launcher" ? "Senaryoyu Baslat" : "Tekrar Calistir"}
                </button>
                ${
                  isRunning
                    ? '<button class="btn btn-secondary btn-sm scenario-overlay__stop" type="button">Durdur</button>'
                    : ""
                }
                ${state.suite ? '<button class="btn btn-secondary btn-sm scenario-overlay__copy" type="button">JSON Kopyala</button>' : ""}
                ${
                  canDeliverToAsistan
                    ? `<button class="btn btn-secondary btn-sm scenario-overlay__send-asistan" type="button" ${state.deliveryInFlight ? "disabled" : ""}>${
                        state.deliveryInFlight ? "Asistana Iletiliyor" : "Sonuclari Asistana Ilet"
                      }</button>`
                    : ""
                }
              </div>
        `;

    this.scrollScenarioOverlayToBottom(overlayEl);

    overlayEl.querySelector(".scenario-overlay__close")?.addEventListener("click", () => {
      this.closeScenarioOverlay();
    });
    overlayEl.querySelector(".scenario-overlay__start")?.addEventListener("click", () => {
      void this.startScenarioTest(state.testedSlot);
    });
    overlayEl.querySelector(".scenario-overlay__stop")?.addEventListener("click", () => {
      void this.stopScenarioTest();
    });
    overlayEl.querySelectorAll<HTMLElement>("[data-sync-mode]").forEach((button) => {
      button.addEventListener("click", () => {
        const nextMode = button.dataset["syncMode"] as ProviderWebviewSyncMode | undefined;
        if (nextMode === undefined) return;
        state.syncMode = nextMode;
        this.renderScenarioOverlay();
      });
    });
    overlayEl.querySelector(".scenario-overlay__copy")?.addEventListener("click", () => {
      if (state.suite) {
        void this.copyScenarioSuiteJson(state.suite).catch((error) => {
          state.message = getErrorMessage(error as Error);
          this.renderScenarioOverlay();
        });
      }
    });
    overlayEl.querySelector(".scenario-overlay__send-asistan")?.addEventListener("click", () => {
      void this.deliverScenarioResultsToAsistan();
    });
    overlayEl.querySelectorAll<HTMLElement>("[data-filter-status]").forEach((button) => {
      button.addEventListener("click", () => {
        const filter = button.dataset["filterStatus"] as ScenarioStatusFilter | undefined;
        if (filter === undefined) return;
        state.filter = state.filter === filter ? "all" : filter;
        this.renderScenarioOverlay();
      });
    });
  }

  private scrollScenarioOverlayToBottom(overlayEl: HTMLElement): void {
    const stepsEl = overlayEl.querySelector<HTMLElement>(".scenario-overlay__steps");
    if (!stepsEl) return;

    const scrollToBottom = (): void => {
      stepsEl.scrollTop = stepsEl.scrollHeight;
    };

    scrollToBottom();
    requestAnimationFrame(scrollToBottom);
  }

  private async copyTextToClipboard(text: string): Promise<boolean> {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch {
      const textarea = document.createElement("textarea");
      textarea.value = text;
      textarea.setAttribute("readonly", "true");
      textarea.style.position = "fixed";
      textarea.style.top = "0";
      textarea.style.left = "-9999px";
      textarea.style.opacity = "0";
      document.body.appendChild(textarea);

      try {
        textarea.focus();
        textarea.select();
        return document.execCommand("copy");
      } finally {
        textarea.remove();
      }
    }
  }

  private async copyScenarioSuiteJson(results: ProviderTestSuite): Promise<void> {
    const copied = await this.copyTextToClipboard(JSON.stringify(results, null, 2));
    if (!copied) {
      throw new Error("Clipboard kopyalama basarisiz");
    }

    Logger.info(LogCategory.ENTRANCE, "Test results copied to clipboard");
  }

  private buildAsistanDeliveryMessage(results: ProviderTestSuite): string {
    const completionMessage = buildScenarioCompletionMessage({
      passed: results.passed,
      totalTests: results.totalTests,
      commands: results.commands,
      ...(results.aborted !== undefined ? { aborted: results.aborted } : {}),
      ...(results.abortReason !== undefined ? { abortReason: results.abortReason } : {}),
    });
    const notableResults = results.results
      .filter((result) => result.status === "fail" || result.status === "warning")
      .slice(0, 8);
    const lines = [
      `Entrance ${results.scenarioId} sonucu`,
      `Slot: ${results.slot.toUpperCase()}`,
      `Provider: ${results.providerName}`,
      `Ozet: ${completionMessage}`,
      `Sure: ${(results.totalDuration / 1000).toFixed(1)}s`,
      `Pass: ${results.passed} | Fail: ${results.failed} | Warning: ${results.warnings} | Skip: ${results.skipped}`,
    ];

    if (
      results.aborted === true &&
      results.abortReason !== undefined &&
      results.abortReason !== ""
    ) {
      lines.push(`Abort: ${results.abortReason}`);
    }

    if (notableResults.length > 0) {
      lines.push("", "Dikkat ceken sonuclar:");
      notableResults.forEach((result) => {
        lines.push(`- [${result.status}] ${result.name}: ${result.message}`);
      });
    } else {
      lines.push("", "Tum kontroller gecti veya yalnizca bilgi amacli sonuc dondu.");
    }

    if (results.runId !== undefined && results.runId !== "") {
      lines.push("", `Run ID: ${results.runId}`);
    }

    return lines.join("\n");
  }

  async deliverScenarioResultsToAsistan(): Promise<void> {
    const state = this.scenarioOverlayState;
    if (
      !state ||
      state.deliveryInFlight === true ||
      state.scenarioId !== "webview-test" ||
      state.suite === null
    ) {
      return;
    }

    state.deliveryInFlight = true;
    state.message = "Sonuclar Asistan'a iletiliyor";
    this.renderScenarioOverlay();

    try {
      const deliveryMessage = this.buildAsistanDeliveryMessage(state.suite);
      const result = await deliverToAsistan({
        message: deliveryMessage,
        page: "entrance-webview-test",
        metadata: {
          slot: state.testedSlot,
          scenarioId: state.scenarioId,
          runId: state.suite.runId ?? "",
        },
      });

      if (result.success !== true) {
        throw new Error(result.message ?? "Asistan teslimi basarisiz");
      }

      state.message = "Sonuclar Asistan'a iletildi";
      Logger.info(LogCategory.ENTRANCE, "Scenario results delivered to Asistan", {
        slot: state.testedSlot,
        scenarioId: state.scenarioId,
      });
    } catch (error) {
      state.message = getErrorMessage(error as Error);
      Logger.error(
        LogCategory.ENTRANCE,
        `Scenario results could not be delivered to Asistan: ${getErrorMessage(error as Error)}`
      );
    } finally {
      state.deliveryInFlight = false;
      this.renderScenarioOverlay();
    }
  }

  async startScenarioTest(slot: SlotType): Promise<void> {
    if (
      this.scenarioOverlayState?.testedSlot !== slot ||
      this.providerTestProgressHandler !== null
    ) {
      return;
    }
    const state = this.scenarioOverlayState;
    const electronApi = window.electronAPI;
    if (electronApi === undefined) {
      throw new Error("Electron API unavailable");
    }

    const handler = (event: ProviderScenarioProgressEvent): void => {
      this.updateScenarioProgress(event);
    };
    this.providerTestProgressHandler = handler;
    electronApi.onProviderScenarioProgress(handler);

    try {
      state.phase = "running";
      state.deliveryInFlight = false;
      state.filter = "all";
      state.commands = [];
      state.runId = null;
      state.suite = null;
      state.message = `${state.providerName} ${state.scenarioTitle} baslatildi`;
      this.renderScenarioOverlay();

      const scenarioRequest =
        state.scenarioId === "webview-sync"
          ? {
              slot,
              scenarioId: state.scenarioId,
              syncMode: state.syncMode,
            }
          : {
              slot,
              scenarioId: state.scenarioId,
            };
      const results = (await electronApi.runProviderScenario(scenarioRequest)) as ProviderTestSuite;

      if (results.refreshedConfig) {
        ProviderRegistry.update(results.refreshedConfig.id, results.refreshedConfig);
        const activeWebview = SlotController.getWebview(slot) as
          | (HTMLElement & { send?: (channel: string, ...args: unknown[]) => void })
          | null;
        activeWebview?.send?.("hayalet-set-provider", {
          providerId: results.refreshedConfig.id,
          slot,
        });
      }

      state.phase = "completed";
      state.runId = results.runId ?? state.runId;
      state.commands = results.commands;
      state.suite = results;
      const completionMessage = buildScenarioCompletionMessage({
        passed: results.passed,
        totalTests: results.totalTests,
        commands: state.commands,
        ...(results.aborted !== undefined ? { aborted: results.aborted } : {}),
        ...(results.abortReason !== undefined ? { abortReason: results.abortReason } : {}),
      });
      state.message = completionMessage;
      this.renderScenarioOverlay();

      Logger.info(
        LogCategory.ENTRANCE,
        `Scenario completed: ${state.scenarioId} ${completionMessage}`
      );
    } catch (error) {
      state.phase = "completed";
      state.message = getErrorMessage(error as Error);
      this.renderScenarioOverlay();

      Logger.error(
        LogCategory.ENTRANCE,
        `Scenario failed: ${state.scenarioId} ${getErrorMessage(error as Error)}`
      );
    } finally {
      const progressHandler = this.providerTestProgressHandler;
      electronApi.offProviderScenarioProgress(progressHandler);
      this.providerTestProgressHandler = null;
    }
  }

  async stopScenarioTest(): Promise<void> {
    const state = this.scenarioOverlayState;
    const electronApi = window.electronAPI;
    if (state?.phase !== "running" || electronApi === undefined) {
      return;
    }

    if (state.runId === null) {
      state.message = "Durdurma istegi icin senaryo baslatiliyor";
      this.renderScenarioOverlay();
      return;
    }

    state.message = "Durdurma istegi gonderildi";
    this.renderScenarioOverlay();

    try {
      await electronApi.cancelProviderScenario({ runId: state.runId });
    } catch (error) {
      state.message = getErrorMessage(error as Error);
      this.renderScenarioOverlay();
    }
  }

  handleTestClick(slot: "ai1" | "ai2"): void {
    const btn = document.getElementById(`${slot}-test-btn`) as HTMLButtonElement | null;
    if (!btn || btn.disabled === true) return;
    if (this.scenarioOverlayState?.phase === "running") return;

    this.collapseSettingsAccordion();
    this.openScenarioLauncher(slot, "webview-test", "webview-test");
  }

  handleSyncClick(slot: "ai1" | "ai2"): void {
    const btn = document.getElementById(`${slot}-sync-btn`) as HTMLButtonElement | null;
    if (!btn || btn.disabled === true) return;
    if (this.scenarioOverlayState?.phase === "running") return;

    this.collapseSettingsAccordion();
    this.openScenarioLauncher(slot, "webview-sync", "webview-sync");
  }

  collapseSettingsAccordion(): void {
    const content = document.getElementById("settings-accordion-content");
    const toggle = document.getElementById("settings-accordion-toggle");
    if (!content || !toggle) return;

    if (content.classList.contains("open")) {
      content.classList.remove("open");
      toggle.setAttribute("aria-expanded", "false");
    }
  }

  showTestResultsModal(results: ProviderTestSuite): void {
    void import("../../ui/modal-manager.js").then((module) => {
      const { ModalManager: modalManager } = module;

      const content = this.generateTestResultsHTML(results);

      modalManager.open({
        title: `🧪 Test Results - ${results.providerName} (${results.slot.toUpperCase()})`,
        content,
        size: "large",
        buttons: [
          {
            text: "📋 Copy JSON",
            class: "btn-ghost",
            onClick: (): void => {
              void this.copyScenarioSuiteJson(results).catch((error) => {
                Logger.error(
                  LogCategory.ENTRANCE,
                  `Test results copy failed: ${getErrorMessage(error as Error)}`
                );
              });
            },
          },
          {
            text: "✖ Close",
            class: "btn-primary",
            onClick: (): void => {
              modalManager.close();
            },
          },
        ],
      });
    });
  }

  generateTestResultsHTML(results: ProviderTestSuite): string {
    const { passed, failed, skipped, warnings, totalTests, totalDuration, aborted, abortReason } =
      results;

    let html = `
      <div class="test-results-summary">
        <div class="test-stats">
          <span class="stat-item stat-pass">✅ ${passed} Passed</span>
          <span class="stat-item stat-fail">❌ ${failed} Failed</span>
          ${warnings > 0 ? `<span class="stat-item stat-warning">⚠️ ${warnings} Warnings</span>` : ""}
          ${skipped > 0 ? `<span class="stat-item stat-skip">⏭️ ${skipped} Skipped</span>` : ""}
        </div>
        <div class="test-meta">
          <span>⏱️ Duration: ${(totalDuration / 1000).toFixed(2)}s</span>
          <span>📊 Total: ${totalTests} tests</span>
        </div>
        ${aborted === true ? `<div class="test-aborted">⚠️ Aborted: ${abortReason ?? "unknown"}</div>` : ""}
      </div>
    `;

    const categories: Record<string, ProviderTestResult[]> = {};
    results.results.forEach((result) => {
      categories[result.category] ??= [];
      categories[result.category]?.push(result);
    });

    const categoryEmoji: Record<string, string> = {
      preflight: "🚀",
      dom: "📋",
      interactive: "🎮",
      scraping: "📝",
      advanced: "🔬",
    };

    const categoryNames: Record<string, string> = {
      preflight: "Pre-flight Checks",
      dom: "DOM Tests",
      interactive: "Interactive Tests",
      scraping: "Scraping Tests",
      advanced: "Advanced Tests",
    };

    for (const [category, tests] of Object.entries(categories)) {
      html += `
        <div class="test-category">
          <h3 class="category-title">${categoryEmoji[category] ?? "📦"} ${categoryNames[category] ?? category}</h3>
          <div class="test-results-list">
      `;

      tests.forEach((test) => {
        const statusEmoji: Record<string, string> = {
          pass: "✅",
          fail: "❌",
          skip: "⏭️",
          warning: "⚠️",
        };

        html += `
          <div class="test-result-item test-${test.status}">
            <div class="test-header">
              <span class="test-status">${statusEmoji[test.status] ?? "•"}</span>
              <span class="test-name">${test.name}</span>
              <span class="test-duration">${test.duration}ms</span>
            </div>
            <div class="test-message">${test.message}</div>
        `;

        if (test.details) {
          html += '<div class="test-details">';

          if (test.details.selector !== undefined && test.details.selector !== "") {
            html += `<div class="detail-item"><strong>Selector:</strong> <code>${test.details.selector}</code></div>`;
          }

          if (test.details.error !== undefined && test.details.error !== "") {
            html += `<div class="detail-item detail-error"><strong>Error:</strong> ${test.details.error}</div>`;
          }

          if (test.details.element !== undefined) {
            const el = test.details.element;
            html += `<div class="detail-item"><strong>Element:</strong> ${el.tagName} (visible: ${String(el.visible)}, enabled: ${String(el.enabled)})</div>`;
            if (el.textContent !== undefined && el.textContent !== "") {
              html += `<div class="detail-item"><strong>Text:</strong> ${el.textContent.slice(0, 50)}...</div>`;
            }
          }

          html += "</div>";
        }

        html += "</div>";
      });

      html += `
          </div>
        </div>
      `;
    }

    return html;
  }

  applyGating(settings: AppSettings | null, _changedPaths: string[] = []): void {
    settings ??= SettingsManager.getSnapshot();
    this.applyTitles();

    const overlayState = this.scenarioOverlayState;
    if (overlayState) {
      const testedState = this.getSlotState(settings, overlayState.testedSlot);
      const hostState = this.getSlotState(settings, overlayState.hostSlot);
      const shouldDismissOverlay =
        this.shouldDismissScenarioOverlayForSlotState(testedState) ||
        this.shouldDismissScenarioOverlayForSlotState(hostState);

      if (shouldDismissOverlay) {
        this.dismissScenarioOverlayForUnavailableSlot({
          cancelActiveRun: overlayState.phase === "running",
        });
      }
    }

    const providers: SlotType[] = ["ai1", "ai2"];

    for (const provider of providers) {
      const state = this.getSlotState(settings, provider);
      const webviewEl = document.getElementById(`${provider}-webview`);
      const overlayEl = document.getElementById(`${provider}-webview-overlay`);
      const urlDisplay = document.getElementById(`${provider}-url-display`);
      const hasScenarioOverlay = this.isScenarioOverlayHost(provider);

      if (hasScenarioOverlay) {
        this.setDevtoolsEnabled(provider, state.connected);
        this.setTestButtonEnabled(provider, state.hasAccount);
        this.setSyncButtonEnabled(
          provider,
          state.hasAccount && this.hasVerifiedSyncScenario(provider)
        );
        if (webviewEl) {
          webviewEl.style.display = state.connected || state.connecting ? "" : "none";
        }
        this.renderScenarioOverlay();
        continue;
      }

      if (!state.hasAccount) {
        this.setDevtoolsEnabled(provider, false);
        this.setTestButtonEnabled(provider, false);
        this.setSyncButtonEnabled(provider, false);
        if (urlDisplay) urlDisplay.textContent = "";
        if (webviewEl) webviewEl.style.display = "none";
        if (overlayEl) {
          overlayEl.className = "webview-overlay empty"; // State class
          const title = overlayEl.querySelector(".overlay-title");
          const subtitle = overlayEl.querySelector(".overlay-subtitle");
          if (title) title.textContent = "Hesap Atanmadı";
          if (subtitle) subtitle.textContent = "Settings'ten hesap atayın";
        }
        continue;
      }

      if (!state.connected && !state.connecting) {
        this.setDevtoolsEnabled(provider, false);
        if (urlDisplay) urlDisplay.textContent = "";
        if (overlayEl) {
          overlayEl.className = "webview-overlay disconnected"; // State class
          const title = overlayEl.querySelector(".overlay-title");
          const subtitle = overlayEl.querySelector(".overlay-subtitle");
          if (title) title.textContent = "Bağlı Değil";
          if (subtitle) subtitle.textContent = "Bağlan butonuna tıklayın";
        }
        if (webviewEl) webviewEl.style.display = "none";
        continue;
      }

      if (state.connecting) {
        this.setDevtoolsEnabled(provider, false);
        if (overlayEl) {
          overlayEl.className = "webview-overlay connecting"; // State class + spinner animation
          const title = overlayEl.querySelector(".overlay-title");
          const subtitle = overlayEl.querySelector(".overlay-subtitle");
          if (title) title.textContent = "Bağlanıyor...";
          if (subtitle) subtitle.textContent = "Lütfen bekleyin";
        }
        const mountId = `${provider}-webview-mount`;
        const mountEl = document.getElementById(mountId);
        if (webviewEl && mountEl && !mountEl.contains(webviewEl)) {
          SlotController.ensureWebviewMounted(provider);
        }
        if (webviewEl) {
          SlotController.ensureWebviewAttached(provider);
        }
        continue;
      }

      this.setDevtoolsEnabled(provider, true);
      this.setTestButtonEnabled(provider, true);
      this.setSyncButtonEnabled(provider, this.hasVerifiedSyncScenario(provider));

      if (overlayEl) {
        overlayEl.classList.add("hidden");
      }

      const mountId = `${provider}-webview-mount`;
      const mountEl = document.getElementById(mountId);
      if (webviewEl && mountEl && !mountEl.contains(webviewEl)) {
        SlotController.ensureWebviewMounted(provider);
      }

      if (webviewEl) {
        SlotController.ensureWebviewAttached(provider);
      }

      if (provider === "ai1" && !this.ai1Webview) {
        void this.setupWebviews();
      }
      if (provider === "ai2" && !this.ai2Webview) {
        void this.setupWebviews();
      }
    }
  }

  setupWebviewEvents(
    type: SlotType,
    webviewEl: WebviewElement,
    providerId: string | null = null
  ): void {
    const scheduleSessionUrlSave = (slot: SlotType, url: string): void => {
      const normalizedUrl = url.trim();
      if (normalizedUrl === "") return;

      const settings = SettingsManager.getSnapshot();
      if (settings.slots[slot].resumeLastSession !== true) {
        return;
      }

      const timer = this.sessionUrlSaveTimers[slot];
      if (timer !== null) {
        clearTimeout(timer);
      }

      this.sessionUrlSaveTimers[slot] = setTimeout(() => {
        this.sessionUrlSaveTimers[slot] = null;
        void this.persistLastSessionUrl(slot, normalizedUrl);
      }, 700);
    };

    webviewEl.addEventListener("did-start-loading", () => {
      try {
        if (typeof webviewEl.getWebContentsId !== "function") return;
        webviewEl.getWebContentsId();
      } catch (_) {
        return;
      }

      let currentUrl = "";
      try {
        currentUrl = webviewEl.getURL?.() ?? "";
      } catch (_) {
        // URL okunamadıysa boş kalsın
      }
      const isExcluded = WebviewManager.isUrlExcluded(type, currentUrl);

      const state = this.loadLogState[type] ?? { lastStart: 0, lastStop: 0 };
      const now = Date.now();

      if (isExcluded !== true && now - state.lastStart > 1200) {
        this.addLog(type, "info", "Sayfa yükleniyor...", { visibility: 3 });
        state.lastStart = now;
      }
      this.loadLogState[type] = state;
    });

    webviewEl.addEventListener("did-stop-loading", () => {
      void (async (): Promise<void> => {
        try {
          if (typeof webviewEl.getWebContentsId !== "function") return;
          webviewEl.getWebContentsId();
        } catch (_) {
          return;
        }

        const state = this.loadLogState[type] ?? { lastStart: 0, lastStop: 0 };
        const now = Date.now();

        if (now - state.lastStop > 1200) {
          this.addLog(type, "info", "Sayfa yükleme tamamlandı", { visibility: 3 });
          state.lastStop = now;
        }
        this.loadLogState[type] = state;

        let currentUrl: string;
        try {
          currentUrl = webviewEl.getURL?.() ?? "";
        } catch (_) {
          return;
        }

        const isExcluded = WebviewManager.isUrlExcluded(type, currentUrl);
        if (isExcluded === true) return;

        scheduleSessionUrlSave(type, currentUrl);

        const slotProviderId = AppState.getProviderIdForSlot(type);
        const currentProviderId = slotProviderId ?? providerId;
        const cfg =
          currentProviderId !== null && currentProviderId !== ""
            ? ProviderRegistry.get(currentProviderId)
            : null;
        if (cfg !== null) {
          try {
            const configScript = `
              (function() {
                try {
                  window.__hayalet_slot = ${JSON.stringify(type)};
                  window.__hayalet_provider_config = ${JSON.stringify(cfg)};
                  return true;
                } catch (e) {
                  console.error('[Hayalet-Config-Inject] Failed:', e);
                  return false;
                }
              })();
            `;
            await webviewEl.executeJavaScript?.(configScript);
          } catch (_err) {
            void _err;
          }
        }
      })();
    });

    webviewEl.addEventListener("did-navigate-in-page", () => {
      try {
        const currentUrl = webviewEl.getURL?.() ?? "";
        const isExcluded = WebviewManager.isUrlExcluded(type, currentUrl);
        if (isExcluded === true) {
          return;
        }
        scheduleSessionUrlSave(type, currentUrl);
      } catch (_) {}
    });

    webviewEl.addEventListener("console-message", (event: Event) => {
      const consoleEvent = event as Event & { message: string; level: number };
      const { message, level } = consoleEvent;

      // Level: 0=log, 1=warn, 2=error, 3=debug
      const logLevel = level === 2 ? "error" : level === 1 ? "warn" : "debug";
      if (logLevel === "error") {
        Logger.error(LogCategory.WEBVIEW, new Error(`[Webview ${type.toUpperCase()}] ${message}`), {
          source: `${type}-webview`,
          slotId: type,
        });
      } else if (logLevel === "warn") {
        Logger.warn(LogCategory.WEBVIEW, `[Webview ${type.toUpperCase()}] ${message}`, {
          source: `${type}-webview`,
          slotId: type,
        });
      } else {
        Logger.debug(LogCategory.WEBVIEW, `[Webview ${type.toUpperCase()}] ${message}`, {
          source: `${type}-webview`,
          slotId: type,
        });
      }
    });

    webviewEl.addEventListener(
      "ipc-message",
      (event: Event & { channel?: string; args?: unknown[] }) => {
        try {
          if (event.channel === undefined || event.channel === "") return;
          if (event.channel === "provider-usage") {
            const payload = event.args?.[0] as { tokens?: string | string[] } | null;
            if (payload !== null) {
              const titleEl = document.getElementById(`${type}-title`);
              if (titleEl) {
                const base = AppState.getNickname(type);
                const tokens = Array.isArray(payload.tokens)
                  ? payload.tokens.join(",")
                  : String(payload.tokens ?? "");
                titleEl.textContent = tokens !== "" ? `${base} — tokens: ${tokens}` : base;
              }
            }
          }
        } catch (err) {
          const error = err as Error;
          Logger.warn(
            LogCategory.ENTRANCE,
            `IPC message handler hatası: ${getErrorMessage(error)}`
          );
        }
      }
    );

    webviewEl.addEventListener(
      "did-fail-load",
      (event: Event & { errorCode?: number; errorDescription?: string }) => {
        if (event.errorCode !== -3 && event.errorCode !== -102) {
          this.addLog(
            type,
            "error",
            `Yükleme hatası (${event.errorCode ?? 0}): ${event.errorDescription ?? "Bilinmeyen hata"}`
          );
        } else if (event.errorCode === -3) {
          this.addLog(type, "info", "Yükleme iptal edildi (normal)");
        }
      }
    );
  }

  async persistLastSessionUrl(slot: SlotType, url: string): Promise<void> {
    const settings = SettingsManager.getSnapshot();
    const accountId = settings.slots[slot].accountId;
    if (accountId === null || accountId === "") {
      return;
    }

    const accountIndex = settings.accounts.findIndex((account) => account.id === accountId);
    if (accountIndex === -1) {
      return;
    }

    const currentValue = settings.accounts[accountIndex]?.lastSessionUrl;
    if (currentValue === url) {
      return;
    }

    const updatedAccounts = [...settings.accounts];
    const account = updatedAccounts[accountIndex];
    if (account === undefined) {
      return;
    }

    updatedAccounts[accountIndex] = {
      ...account,
      lastSessionUrl: url,
      lastUsedAt: Date.now(),
    };

    await SettingsManager.save({
      ...settings,
      accounts: updatedAccounts,
    });
  }

  openDevTools(type: SlotType): void {
    try {
      const webview = type === "ai1" ? this.ai1Webview : this.ai2Webview;
      if (!webview) {
        this.addLog(type, "error", "Webview bulunamadı");
        return;
      }

      (webview as WebviewElement).openDevTools?.();
      this.addLog(type, "info", "DevTools açıldı");
    } catch (err) {
      const error = err as Error;
      Logger.error(LogCategory.ENTRANCE, `DevTools açma hatası: ${getErrorMessage(error)}`, {
        context: { type },
      });
      this.addLog(type, "error", `DevTools açma hatası: ${getErrorMessage(error)}`);
    }
  }

  addLog(_type: SlotType, level: string, message: string, meta?: Record<string, unknown>): void {
    if (level === "error") {
      Logger.error(LogCategory.WEBVIEW, message, meta);
    } else if (level === "warning") {
      Logger.warn(LogCategory.WEBVIEW, message, meta);
    } else if (level === "success") {
      Logger.info(LogCategory.WEBVIEW, `✅ ${message}`, meta);
    } else {
      Logger.info(LogCategory.WEBVIEW, message, meta);
    }
  }

  destroy(): void {
    const progressHandler = this.providerTestProgressHandler;
    if (progressHandler !== null) {
      window.electronAPI?.offProviderTestProgress(progressHandler);
      this.providerTestProgressHandler = null;
    }

    if (this.trafficUnsub) {
      this.trafficUnsub();
      this.trafficUnsub = null;
    }

    (Object.keys(this.sessionUrlSaveTimers) as SlotType[]).forEach((slot) => {
      const timer = this.sessionUrlSaveTimers[slot];
      if (timer !== null) {
        clearTimeout(timer);
        this.sessionUrlSaveTimers[slot] = null;
      }
    });
  }
}
