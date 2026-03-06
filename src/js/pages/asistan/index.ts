/**
 * AsistanController - Asistan (AI0) Sayfası Yöneticisi
 *
 * Provider seçimi, bağlantı yönetimi, webview kontrolü ve
 * AI-Asistan relay işlemlerini yönetir.
 *
 * Server yönetimi provider adapter'lara delege edilir.
 * Yeni provider eklemek için:
 * 1. AsistanProviderAdapter interface'ini implement edin
 * 2. provider-registry.ts'de kaydedin
 */

import { LogCategory } from "@shared/logging-core";
import { ASISTAN_TIMEOUTS } from "@timeouts";
import { Logger } from "../../modules/logger/index.js";
import { SettingsManager } from "../../modules/settings-manager.js";
import { AppState } from "../../modules/app-state.js";
import { SlotController, SlotState } from "../../modules/slot-controller.js";
import { TrafficManager } from "../../modules/traffic-manager.js";
import { ProviderRegistry } from "../../modules/webview/provider-registry.js";
import type { AppSettings } from "@shared/settings.js";
import type {
  ConnectButtonState,
  WebviewElement,
  SlotStateInfo,
  AsistanTrafficState,
  AsistanProviderAdapter,
} from "@shared/asistan.js";
import { AsistanProviderRegistry } from "./provider-registry.js";
import {
  createGhostHandoffRuntimePatch,
  shouldAutoEnableKeepServersOnClose,
} from "./ghost-handoff.js";
import type { OverlayStage } from "./overlay-stage.js";
import {
  generateWorkflowSessionId,
  syncAssistantRuntimeDefaults,
  updateAssistantRuntimeState,
} from "./assistant-runtime.js";
import { detectSystemActiveServerStatus } from "./system-server-control.js";
import { toggleAsistanConnection } from "./connection-lifecycle.js";
import { updateAsistanConnectionUI } from "./connection-ui.js";
import { CharacterOverlay } from "./character-overlay.js";
import { MemoryOverlay } from "./memory-overlay.js";
import { refreshOpencodeDoctorStatus, openOpencodeSettingsModal } from "./opencode-doctor.js";
import { resolveOpencodeUiDbPath } from "./opencode-preferences.js";
import { openTestResultsModal } from "./test-results-modal.js";
import { bindAsistanBasicEvents } from "./event-bindings.js";
import { populateAsistanProviderSelect } from "./provider-select.js";
import { bindAsistanPrimaryWebviewEvents, bindAsistanWebviewIpcEvents } from "./webview-bindings.js";
import {
  applyConnectButtonState,
  renderConnectedAiList,
  updateOverlayView,
  updateServerStatusView,
  updateTrafficStatusView,
} from "./view-helpers.js";

export class AsistanController {
  _unsubSettings: (() => void) | null;
  _unsubSlot: (() => void) | null;
  _unsubTraffic: (() => void) | null;
  _unsubAppState: (() => void) | null;
  _isServerRunning: boolean;
  _systemServerPort: number | null;
  _activeAdapter: AsistanProviderAdapter | null;
  _disabledMcpServers: Set<string>;
  _opencodeUrlSaveTimer: ReturnType<typeof setTimeout> | null;
  _lastSavedOpencodeUrl: string | null;
  _connectAbortController: AbortController | null;
  _connectFlowActive: boolean;
  _connectOverlayStage: OverlayStage | null;
  _providerToolsReady: boolean;
  providerSelect: HTMLSelectElement | null;
  connectBtn: HTMLButtonElement | null;
  ghostAgentBtn: HTMLButtonElement | null;
  resumeLastSessionCheckbox: HTMLInputElement | null;
  keepServersOnAppCloseCheckbox: HTMLInputElement | null;
  catchCommandsCheckbox: HTMLInputElement | null;
  connectedList: HTMLElement | null;
  devtoolsBtn: HTMLButtonElement | null;
  testBtn: HTMLButtonElement | null;
  urlDisplay: HTMLElement | null;
  titleEl: HTMLElement | null;
  statusDot: HTMLElement | null;
  statusText: HTMLElement | null;
  opencodeIndicator: HTMLElement | null;
  opencodeIndicatorDot: HTMLElement | null;
  opencodeIndicatorText: HTMLElement | null;
  opencodeSettingsBtn: HTMLButtonElement | null;
  characterOverlay: CharacterOverlay;
  memoryOverlay: MemoryOverlay;
  memoryBtn: HTMLButtonElement | null;

  _isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === "object" && value !== null;
  }

  _isProviderOption(value: unknown): value is { id: string; name: string } {
    return (
      this._isRecord(value) && typeof value["id"] === "string" && typeof value["name"] === "string"
    );
  }

  constructor() {
    this._unsubSettings = null;
    this._unsubSlot = null;
    this._unsubTraffic = null;
    this._unsubAppState = null;
    this._isServerRunning = false;
    this._systemServerPort = null;
    this._activeAdapter = null;
    this._disabledMcpServers = new Set();
    this._opencodeUrlSaveTimer = null;
    this._lastSavedOpencodeUrl = null;
    this._connectAbortController = null;
    this._connectFlowActive = false;
    this._connectOverlayStage = null;
    this._providerToolsReady = true;
    this.providerSelect = null;
    this.connectBtn = null;
    this.ghostAgentBtn = null;
    this.resumeLastSessionCheckbox = null;
    this.keepServersOnAppCloseCheckbox = null;
    this.catchCommandsCheckbox = null;
    this.connectedList = null;
    this.devtoolsBtn = null;
    this.testBtn = null;
    this.urlDisplay = null;
    this.titleEl = null;
    this.statusDot = null;
    this.statusText = null;
    this.opencodeIndicator = null;
    this.opencodeIndicatorDot = null;
    this.opencodeIndicatorText = null;
    this.opencodeSettingsBtn = null;
    this.characterOverlay = new CharacterOverlay();
    this.memoryOverlay = new MemoryOverlay();
    this.memoryBtn = null;
  }

  async init(): Promise<void> {
    await SettingsManager.load();

    this.providerSelect = document.getElementById(
      "asistan-provider-select"
    ) as HTMLSelectElement | null;
    this.connectBtn = document.getElementById("asistan-connect-btn") as HTMLButtonElement | null;
    this.ghostAgentBtn = document.getElementById(
      "asistan-ghost-agent-btn"
    ) as HTMLButtonElement | null;
    this.resumeLastSessionCheckbox = document.getElementById(
      "asistan-resume-last-session"
    ) as HTMLInputElement | null;
    this.keepServersOnAppCloseCheckbox = document.getElementById(
      "asistan-keep-servers-on-close"
    ) as HTMLInputElement | null;
    this.catchCommandsCheckbox = document.getElementById(
      "asistan-catch-commands-check"
    ) as HTMLInputElement | null;
    this.connectedList = document.getElementById("asistan-connected-list");
    this.devtoolsBtn = document.getElementById("asistan-devtools-btn") as HTMLButtonElement | null;
    this.testBtn = document.getElementById("ai0-test-btn") as HTMLButtonElement | null;
    this.urlDisplay = document.getElementById("asistan-url-display");
    this.titleEl = document.getElementById("asistan-title");
    this.statusDot = document.getElementById("asistan-status-dot");
    this.statusText = document.getElementById("asistan-status-text");
    this.opencodeIndicator = document.getElementById("asistan-opencode-indicator");
    this.opencodeIndicatorDot = document.getElementById("asistan-opencode-indicator-dot");
    this.opencodeIndicatorText = document.getElementById("asistan-opencode-indicator-text");
    this.opencodeSettingsBtn = document.getElementById(
      "asistan-opencode-settings-btn"
    ) as HTMLButtonElement | null;

    this._populateProviderSelect();
    this._initActiveAdapter();
    this._syncTogglePreferencesFromSettings();
    await this._syncAssistantRuntimeDefaults();

    // AI0 webview'e preload ata — URL yüklenmeden önce olmalı (IPC bridge için)
    const ai0Wv = document.getElementById("ai0-webview");
    const electronApi = window.electronAPI;
    if (ai0Wv !== null && ai0Wv.getAttribute("preload") === null) {
      try {
        if (electronApi === undefined) {
          return;
        }
        const pp = await electronApi.getPreloadPath("ai0");
        if (pp !== "") ai0Wv.setAttribute("preload", pp);
      } catch (_) {
        /* silent */
      }
    }

    this.memoryBtn = document.getElementById("asistan-memory-btn") as HTMLButtonElement | null;
    this.characterOverlay.init();
    this.memoryOverlay.init();
    this._setupEventListeners();
    this._refreshOpencodeDoctorStatus();
    this._unsubSettings = SettingsManager.subscribe(
      ({ settings, changedPaths }: { settings: unknown; changedPaths: string[] }) => {
        this._onSettingsChange(settings, changedPaths);
      }
    );

    this._unsubSlot = SlotController.subscribe((payload: unknown) => {
      const p = payload as { slot?: string; event?: string };
      if (p.slot === "ai0") {
        this._updateConnectionUI();
      }
      this._updateConnectedAIList();
    });

    this._unsubAppState = AppState.subscribe(() => {
      this._updateConnectedAIList();
    });

    this._unsubTraffic = TrafficManager.onUpdate(
      (snapshot: { ai0?: unknown; [key: string]: unknown }) => {
        if (snapshot.ai0 !== undefined) {
          this._updateTrafficUI(snapshot.ai0);
        }
      }
    );

    // Settings'ten disabled MCP listesini yükle
    this._loadDisabledMcpServers();

    this._updateConnectionUI();
    this._updateConnectedAIList();
    Logger.debug(LogCategory.ASISTAN_CORE, "AsistanController initialized");
  }

  _syncTogglePreferencesFromSettings(): void {
    const settings = SettingsManager.getSnapshot() as AppSettings | null;

    if (this.resumeLastSessionCheckbox) {
      const resumeValue = settings?.assistants?.resumeLastSession;
      this.resumeLastSessionCheckbox.checked =
        typeof resumeValue === "boolean" ? resumeValue : true;
    }

    if (this.keepServersOnAppCloseCheckbox) {
      const keepServersValue = settings?.assistants?.keepServersOnAppClose;
      this.keepServersOnAppCloseCheckbox.checked = keepServersValue === true;
    }

    if (this.catchCommandsCheckbox) {
      const catchCommandsValue = settings?.asistanSlot?.catchCommands;
      this.catchCommandsCheckbox.checked = catchCommandsValue === true;
    }
  }

  _refreshOpencodeDoctorStatus(): void {
    refreshOpencodeDoctorStatus({
      indicator: this.opencodeIndicator,
      indicatorDot: this.opencodeIndicatorDot,
      indicatorText: this.opencodeIndicatorText,
    });
  }

  async _openOpencodeSettingsModal(): Promise<void> {
    await openOpencodeSettingsModal({
      onSaved: () => {
        this._refreshOpencodeDoctorStatus();
      },
    });
  }

  _isResumeEnabled(options: { forceResume?: boolean } = {}): boolean {
    if (options.forceResume === true) return true;
    if (this.resumeLastSessionCheckbox !== null) {
      return this.resumeLastSessionCheckbox.checked;
    }
    const settings = SettingsManager.getSnapshot() as AppSettings | null;
    return settings?.assistants?.resumeLastSession !== false;
  }

  async _saveResumeTogglePreference(enabled: boolean): Promise<void> {
    try {
      await SettingsManager.set("assistants.resumeLastSession", enabled);
    } catch (error) {
      Logger.warn(LogCategory.ASISTAN_CORE, "Resume toggle kaydedilemedi", {
        error: (error as Error).message,
      });
    }
  }

  async _saveKeepServersOnClosePreference(enabled: boolean): Promise<void> {
    try {
      await SettingsManager.set("assistants.keepServersOnAppClose", enabled);
    } catch (error) {
      Logger.warn(LogCategory.ASISTAN_CORE, "Kapanis sunucu tercihi kaydedilemedi", {
        error: (error as Error).message,
      });
    }
  }

  async _saveAsistanCatchCommandsPreference(enabled: boolean): Promise<void> {
    try {
      await SettingsManager.set("asistanSlot.catchCommands", enabled);
    } catch (error) {
      Logger.warn(LogCategory.ASISTAN_CORE, "Asistan komut yakalama tercihi kaydedilemedi", {
        error: (error as Error).message,
      });
    }
  }

  async _ensureKeepServersOnCloseForGhostMode(): Promise<void> {
    const isChecked = this.keepServersOnAppCloseCheckbox?.checked === true;
    if (!shouldAutoEnableKeepServersOnClose(isChecked)) return;

    if (this.keepServersOnAppCloseCheckbox) {
      this.keepServersOnAppCloseCheckbox.checked = true;
    }

    await this._saveKeepServersOnClosePreference(true);
  }

  async _triggerGhostHandoff(): Promise<void> {
    const runtimePatch = createGhostHandoffRuntimePatch(generateWorkflowSessionId());
    await updateAssistantRuntimeState(runtimePatch);

    const electronApi = window.electronAPI;
    if (electronApi === undefined || typeof electronApi.windowClose !== "function") {
      Logger.error(LogCategory.ASISTAN_CORE, "Ghost handoff için pencere kapatma API bulunamadı");
      await updateAssistantRuntimeState({ desiredMode: "soft", phase: "idle" });
      return;
    }

    Logger.info(LogCategory.ASISTAN_CORE, "Ghost-agent handoff başlatıldı", {
      workflowSessionId: runtimePatch.workflowSessionId,
    });
    electronApi.windowClose();
  }

  async _handleGhostAgentButtonClick(): Promise<void> {
    await this._ensureKeepServersOnCloseForGhostMode();
    if (this._connectFlowActive) {
      this._cancelConnectFlow();
    }
    await this._triggerGhostHandoff();
  }

  async _saveLastOpencodeUiSessionId(sessionId: string | null): Promise<void> {
    if (sessionId === null || sessionId === "") return;
    const settings = SettingsManager.getSnapshot() as AppSettings | null;
    if (settings?.assistants?.lastOpencodeUiSessionId === sessionId) {
      return;
    }

    try {
      await SettingsManager.set("assistants.lastOpencodeUiSessionId", sessionId);
    } catch (error) {
      Logger.warn(LogCategory.ASISTAN_CORE, "OpenCode UI son session kaydedilemedi", {
        error: (error as Error).message,
      });
    }
  }

  async _syncAssistantRuntimeDefaults(): Promise<void> {
    await syncAssistantRuntimeDefaults();
  }

  async _updateAssistantRuntimeState(patch: Record<string, unknown>): Promise<void> {
    await updateAssistantRuntimeState(patch);
  }

  _scheduleSaveLastOpencodeUrl(url: string): void {
    if (url === "") return;

    if (this._opencodeUrlSaveTimer) {
      clearTimeout(this._opencodeUrlSaveTimer);
    }

    this._opencodeUrlSaveTimer = setTimeout(() => {
      void this._saveLastOpencodeUrl(url);
    }, ASISTAN_TIMEOUTS.STAGE_TRANSITION_SHORT);
  }

  async _saveLastOpencodeUrl(url: string): Promise<void> {
    if (url === "") return;
    if (this._lastSavedOpencodeUrl === url) return;

    const settings = SettingsManager.getSnapshot() as AppSettings | null;
    if (settings?.assistants?.lastOpencodeUrl === url) {
      this._lastSavedOpencodeUrl = url;
      return;
    }

    try {
      await SettingsManager.set("assistants.lastOpencodeUrl", url);
      this._lastSavedOpencodeUrl = url;
    } catch (error) {
      Logger.warn(LogCategory.ASISTAN_CORE, "OpenCode son URL kaydedilemedi", {
        error: (error as Error).message,
      });
    }
  }

  /**
   * Seçili provider'a göre aktif adapter'ı belirle
   */
  _initActiveAdapter(): void {
    const providerId = this.providerSelect?.value;
    if (providerId === undefined || providerId === "") {
      Logger.error(LogCategory.ASISTAN_CORE, "Provider seçilmedi, adapter atanamadı");
      return;
    }

    this._activeAdapter = AsistanProviderRegistry.getAdapter(providerId);

    if (!this._activeAdapter) {
      Logger.error(LogCategory.ASISTAN_CORE, `Adapter bulunamadı: ${providerId}`);
    }
  }

  _populateProviderSelect(): void {
    const asistanProviders = ProviderRegistry.getAllAsistan();
    const settings = SettingsManager.getSnapshot() as AppSettings | null;
    populateAsistanProviderSelect({
      providerSelect: this.providerSelect,
      providers: Array.isArray(asistanProviders) ? asistanProviders : [],
      settings,
      isProviderOption: (value: unknown): value is { id: string; name: string } =>
        this._isProviderOption(value),
    });
  }

  _setupEventListeners(): void {
    bindAsistanBasicEvents({
      connectBtn: this.connectBtn,
      ghostAgentBtn: this.ghostAgentBtn,
      resumeLastSessionCheckbox: this.resumeLastSessionCheckbox,
      keepServersOnAppCloseCheckbox: this.keepServersOnAppCloseCheckbox,
      catchCommandsCheckbox: this.catchCommandsCheckbox,
      providerSelect: this.providerSelect,
      opencodeSettingsBtn: this.opencodeSettingsBtn,
      memoryBtn: this.memoryBtn,
      devtoolsBtn: this.devtoolsBtn,
      testBtn: this.testBtn,
      onConnectClick: () => {
        void this._toggleConnection();
      },
      onGhostAgentClick: () => {
        void this._handleGhostAgentButtonClick();
      },
      onResumeLastSessionChange: (enabled: boolean) => {
        void this._saveResumeTogglePreference(enabled);
      },
      onKeepServersOnCloseChange: (enabled: boolean) => {
        void this._saveKeepServersOnClosePreference(enabled);
      },
      onCatchCommandsChange: (enabled: boolean) => {
        void this._saveAsistanCatchCommandsPreference(enabled);
      },
      onProviderChange: () => {
        void this._onProviderChange();
      },
      onOpencodeSettingsClick: () => {
        void this._openOpencodeSettingsModal();
      },
      onMemoryClick: () => {
        this.memoryOverlay.open();
      },
      onDevtoolsClick: () => {
        this._openDevTools();
      },
      onTestClick: () => {
        void this._handleTestClick();
      },
    });

    const ai0Webview = document.getElementById("ai0-webview");
    bindAsistanWebviewIpcEvents({
      webviewEl: ai0Webview,
      providerSelect: this.providerSelect,
      getActiveProviderId: () => this._activeAdapter?.id ?? null,
      isConnectFlowActive: () => this._connectFlowActive,
      getProviderToolsReady: () => this._providerToolsReady,
      setProviderToolsReady: (ready: boolean) => {
        this._providerToolsReady = ready;
      },
      setConnectOverlayStage: (stage: OverlayStage | null) => {
        this._setConnectOverlayStage(stage);
      },
      updateConnectionUI: () => {
        this._updateConnectionUI();
      },
      onMcpToggleFromHealth: async (server: string, enabled: boolean) => {
        await this._onMcpToggleFromHealth(server, enabled);
      },
      onOpencodeSessionChanged: async (sessionId: string) => {
        await this._saveLastOpencodeUiSessionId(sessionId);
        await this._updateAssistantRuntimeState({
          workflowSessionId: sessionId,
          phase: "idle",
        });
      },
      onAssistantRuntimeControl: async (patch: Record<string, unknown>) => {
        await this._updateAssistantRuntimeState(patch);
      },
    });
  }

  _isConnected(): boolean {
    const slotState = SlotController.getState("ai0") as SlotStateInfo | null;
    return slotState?.state === SlotState.CONNECTED || this._isServerRunning;
  }

  _setButtonState(state: ConnectButtonState, errorMsg?: string): void {
    applyConnectButtonState(this.connectBtn, state, errorMsg);
  }

  /**
   * Health webview'den MCP toggle değişikliği geldiğinde settings'e kaydeder.
   */
  async _onMcpToggleFromHealth(server: string, enabled: boolean): Promise<void> {
    if (enabled) {
      this._disabledMcpServers.delete(server);
    } else {
      this._disabledMcpServers.add(server);
    }

    // Settings'e kaydet (persistence)
    await this._saveDisabledMcpServers();

    Logger.info(
      LogCategory.ASISTAN_CORE,
      `MCP toggle kaydedildi: ${server} → ${enabled ? "aktif" : "pasif"}`,
      {
        disabledMcpServers: Array.from(this._disabledMcpServers),
      }
    );
  }

  _getResumeSessionId(providerId: string, options: { forceResume?: boolean }): string {
    if (!this._isResumeEnabled(options)) return "";

    const settings = SettingsManager.getSnapshot() as AppSettings | null;

    if (providerId === "opencode-ui") {
      const sessionId = settings?.assistants?.lastOpencodeUiSessionId;
      return typeof sessionId === "string" ? sessionId : "";
    }

    return "";
  }

  _resolveConnectUrl(
    baseUrl: string,
    providerId: string,
    options: { forceResume?: boolean }
  ): string {
    const settings = SettingsManager.getSnapshot() as AppSettings | null;

    if (providerId === "opencode-ui" && baseUrl !== "") {
      try {
        const parsed = new URL(baseUrl, window.location.origin);
        const resumeSessionId = this._getResumeSessionId(providerId, options);
        if (resumeSessionId !== "") {
          parsed.searchParams.set("resumeSessionId", resumeSessionId);
        }

        const dbPath = resolveOpencodeUiDbPath(settings);
        if (dbPath !== "") {
          parsed.searchParams.set("dbPath", dbPath);
        }

        return baseUrl.startsWith("/")
          ? `${parsed.pathname}${parsed.search}${parsed.hash}`
          : parsed.toString();
      } catch {
        return baseUrl;
      }
    }

    if (!this._isResumeEnabled(options)) {
      return baseUrl;
    }

    if (providerId === "opencode") {
      const savedUrl = settings?.assistants?.lastOpencodeUrl;
      if (typeof savedUrl === "string" && savedUrl !== "") {
        return savedUrl;
      }
      return baseUrl;
    }

    return baseUrl;
  }

  _beginConnectFlow(): AbortSignal {
    this._connectAbortController?.abort();
    this._connectAbortController = new AbortController();
    this._connectFlowActive = true;
    this._connectOverlayStage = null;
    return this._connectAbortController.signal;
  }

  _finishConnectFlow(): void {
    this._connectFlowActive = false;
    this._connectAbortController = null;
    this._connectOverlayStage = null;
  }

  _isConnectFlowCancelled(signal: AbortSignal): boolean {
    return signal.aborted === true;
  }

  _cancelConnectFlow(): void {
    this._connectAbortController?.abort();
    this._connectOverlayStage = null;
  }

  _setConnectOverlayStage(stage: OverlayStage | null): void {
    this._connectOverlayStage = stage;
  }

  async _resolveSystemServerStatus(): Promise<{ running: boolean; port?: number }> {
    return await detectSystemActiveServerStatus();
  }

  async _syncSystemServerStatus(options: { refreshUi?: boolean } = {}): Promise<void> {
    const status = await this._resolveSystemServerStatus();
    const nextPort = typeof status.port === "number" ? status.port : null;
    const changed = this._isServerRunning !== status.running || this._systemServerPort !== nextPort;

    this._isServerRunning = status.running;
    this._systemServerPort = nextPort;

    if (options.refreshUi === true || changed) {
      this._updateConnectionUI(true);
    }
  }

  async _stopSystemActiveServers(): Promise<void> {
    const electronApi = window.electronAPI;
    const adapter = this._activeAdapter;

    if (electronApi !== undefined && typeof electronApi.opencodeServeStop === "function") {
      const result = await electronApi.opencodeServeStop();
      if (result.success !== true && typeof result.error === "string" && result.error !== "") {
        throw new Error(result.error);
      }
    } else if (adapter !== null) {
      const result = await adapter.stopServer();
      if (result.success !== true && typeof result.error === "string" && result.error !== "") {
        throw new Error(result.error);
      }
    }

    this._systemServerPort = null;
    this._isServerRunning = false;
    this._updateServerStatus({ running: false });
  }

  async _toggleConnection(options: { forceResume?: boolean } = {}): Promise<void> {
    await toggleAsistanConnection(this, options);
  }

  _updateServerStatus(status: { running: boolean; port?: number }): void {
    updateServerStatusView(status, {
      statusText: document.querySelector("#asistan-status-text"),
      statusDetails: document.querySelector("#asistan-status-details"),
      statusDot: document.querySelector("#asistan-status-dot"),
    });
  }

  async _onProviderChange(): Promise<void> {
    const providerId = this.providerSelect?.value;
    if (providerId === undefined || providerId === "") return;

    // Adapter'ı güncelle
    this._activeAdapter = AsistanProviderRegistry.getAdapter(providerId);

    const provider = ProviderRegistry.getAsistan(providerId);
    if (!this._isProviderOption(provider)) return;

    this._providerToolsReady = providerId !== "opencode-ui";

    const settings = SettingsManager.getSnapshot() as AppSettings | null;
    const asistanAccounts = settings?.asistanAccounts as
      | { id: string; provider?: string }[]
      | undefined;
    const account = asistanAccounts?.find((acc) => acc.provider === providerId);

    if (account && settings) {
      const asistanSlot = settings.asistanSlot as { accountId?: string } | undefined;
      await SettingsManager.save({
        ...(settings as Record<string, unknown>),
        asistanSlot: {
          ...(asistanSlot as Record<string, unknown>),
          accountId: account.id,
        },
      });
    }

    await SettingsManager.set("assistants.preferred", providerId);

    if (this.titleEl) {
      this.titleEl.textContent = provider.name;
    }

    Logger.info(LogCategory.ASISTAN_CORE, `Provider değiştirildi: ${provider.name}`);
    this._updateConnectionUI();
  }

  _openDevTools(): void {
    const webview = document.getElementById("ai0-webview") as WebviewElement | null;

    if (webview && typeof webview.openDevTools === "function") {
      webview.openDevTools();
      Logger.debug(LogCategory.ASISTAN_CORE, "DevTools açıldı");
    } else {
      Logger.warn(LogCategory.ASISTAN_CORE, "Webview bulunamadı");
    }
  }

  async _handleTestClick(): Promise<void> {
    const btn = this.testBtn;
    if (!btn || btn.disabled) return;

    try {
      btn.classList.add("testing");
      btn.disabled = true;
      btn.innerHTML = "⏳";

      Logger.info(LogCategory.ASISTAN_CORE, "Starting provider test for ai0");

      const results = await window.electronAPI?.testProvider({ slot: "ai0" });

      if (!results) {
        throw new Error("Test failed: No results returned");
      }

      Logger.info(
        LogCategory.ASISTAN_CORE,
        `Test completed: ${results.passed}/${results.totalTests} passed`
      );

      await openTestResultsModal(results);
    } catch (error) {
      Logger.error(LogCategory.ASISTAN_CORE, `Provider test failed: ${(error as Error).message}`);

      const errorModal = await import("../../ui/modal-manager.js");
      errorModal.ModalManager.open({
        title: "❌ Test Failed",
        content: `<div class="error-message">
          <p><strong>Test execution failed:</strong></p>
          <p>${(error as Error).message}</p>
        </div>`,
        buttons: [
          {
            text: "Close",
            class: "btn-primary",
            onClick: (): void => {
              errorModal.ModalManager.close();
            },
          },
        ],
      });
    } finally {
      btn.classList.remove("testing");
      btn.disabled = false;
      btn.innerHTML = "🧪";
    }
  }

  _updateConnectionUI(skipSystemServerSync = false): void {
    updateAsistanConnectionUI(this, skipSystemServerSync);
  }

  _updateOverlay(
    overlayEl: HTMLElement | null,
    stateClass: string,
    _icon: string, // Unused - CSS spinner kullanılıyor
    title: string,
    subtitle: string
  ): void {
    updateOverlayView(overlayEl, stateClass, title, subtitle);
  }

  _updateConnectedAIList(): void {
    const nicknames = [];

    if (SlotController.isConnected("ai1") === true) {
      nicknames.push({ slotClass: "ai1", nickname: AppState.getNickname("ai1") });
    }

    if (SlotController.isConnected("ai2") === true) {
      nicknames.push({ slotClass: "ai2", nickname: AppState.getNickname("ai2") });
    }

    renderConnectedAiList(this.connectedList, nicknames);
  }

  _updateTrafficUI(trafficState: AsistanTrafficState | null): void {
    const state = trafficState as AsistanTrafficState;
    const status = state.state?.status;
    if (status === undefined) return;
    const slotState = SlotController.getState("ai0") as SlotStateInfo | null;
    const isConnected = slotState?.state === SlotState.CONNECTED;

    if (!isConnected) return;

    updateTrafficStatusView(state, {
      statusDot: this.statusDot,
      statusText: this.statusText,
    });
  }

  _onSettingsChange(_settings: unknown, changedPaths: string[] = []): void {
    const shouldRefreshProviderSelect =
      changedPaths.includes("*") ||
      changedPaths.some(
        (path) =>
          path.startsWith("asistanAccounts") ||
          path === "asistanSlot" ||
          path.startsWith("asistanSlot.accountId")
      );

    if (shouldRefreshProviderSelect) {
      this._populateProviderSelect();
    }

    const shouldRefreshToggles =
      changedPaths.includes("*") ||
      changedPaths.some(
        (path) =>
          path === "assistants" ||
          path.startsWith("assistants.resumeLastSession") ||
          path.startsWith("assistants.keepServersOnAppClose") ||
          path === "asistanSlot" ||
          path.startsWith("asistanSlot.catchCommands")
      );

    if (shouldRefreshToggles) {
      this._syncTogglePreferencesFromSettings();
    }

    const shouldRefreshOpencodeIndicator =
      changedPaths.includes("*") ||
      changedPaths.some((path) => path === "assistants" || path.startsWith("assistants.opencode"));

    if (shouldRefreshOpencodeIndicator) {
      this._refreshOpencodeDoctorStatus();
    }
  }

  _setupWebviewEvents(webviewEl: WebviewElement): void {
    bindAsistanPrimaryWebviewEvents({
      webviewEl,
      providerSelect: this.providerSelect,
      urlDisplay: this.urlDisplay,
      scheduleSaveLastOpencodeUrl: (url: string) => {
        this._scheduleSaveLastOpencodeUrl(url);
      },
      syncDisabledMcpToHealth: () => {
        this._syncDisabledMcpToHealth();
      },
    });
  }
  /**
   * Settings'ten disabled MCP sunucu listesini yükle
   */
  _loadDisabledMcpServers(): void {
    const settings = SettingsManager.getSnapshot() as AppSettings | null;
    const list = settings?.assistants?.disabledMcpServers;

    this._disabledMcpServers.clear();
    if (Array.isArray(list)) {
      for (const name of list) {
        if (typeof name === "string" && name !== "") {
          this._disabledMcpServers.add(name);
        }
      }
    }

    if (this._disabledMcpServers.size > 0) {
      Logger.info(LogCategory.ASISTAN_CORE, "Disabled MCP sunucuları yüklendi", {
        disabledMcpServers: Array.from(this._disabledMcpServers),
      });
    }
  }

  /**
   * Disabled MCP sunucu listesini settings'e kaydet
   */
  async _saveDisabledMcpServers(): Promise<void> {
    try {
      await SettingsManager.set(
        "assistants.disabledMcpServers",
        Array.from(this._disabledMcpServers)
      );
    } catch (e) {
      Logger.error(LogCategory.ASISTAN_CORE, "Disabled MCP listesi kaydedilemedi", {
        error: (e as Error).message,
      });
    }
  }

  /**
   * Health webview'e mevcut disabled MCP listesini gönder (senkronizasyon).
   */
  _syncDisabledMcpToHealth(): void {
    const ai0Webview = document.getElementById("ai0-webview") as WebviewElement | null;
    if (!ai0Webview) return;

    // Disabled MCP listesi varsa senkronize et
    if (this._disabledMcpServers.size > 0) {
      try {
        const disabledList = Array.from(this._disabledMcpServers);
        void ai0Webview.executeJavaScript?.(
          `(function() {
            try {
              if (typeof window.__setDisabledMcpServers === "function") {
                window.__setDisabledMcpServers(${JSON.stringify(disabledList)});
              }
            } catch(e) { console.warn("[MCP-Sync] failed:", e); }
          })();`
        );
      } catch (_) {
        // Webview henüz hazır değilse sessizce geç
      }
    }
  }

  onShow(): void {
    this._updateConnectionUI();
    this._updateConnectedAIList();
  }

  onHide(): void {}

  async destroy(): Promise<void> {
    if (this._isServerRunning) {
      await this._stopSystemActiveServers();
    }

    if (this._opencodeUrlSaveTimer) {
      clearTimeout(this._opencodeUrlSaveTimer);
      this._opencodeUrlSaveTimer = null;
    }
    this._unsubSettings?.();
    this._unsubSlot?.();
    this._unsubTraffic?.();
    this._unsubAppState?.();
  }
}
