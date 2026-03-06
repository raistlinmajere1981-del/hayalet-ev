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

import { LogCategory, LogLevel } from "@shared/logging-core";
import { ASISTAN_TIMEOUTS } from "@timeouts";
import { Logger } from "../../modules/logger/index.js";
import { SettingsManager } from "../../modules/settings-manager.js";
import { AppState } from "../../modules/app-state.js";
import { SlotController, SlotState } from "../../modules/slot-controller.js";
import { TrafficManager } from "../../modules/traffic-manager.js";
import { ProviderRegistry } from "../../modules/webview/provider-registry.js";
import type { ProviderTestSuite, ProviderTestResult } from "@shared/provider.js";
import type { AppSettings } from "@shared/settings.js";
import { ConnectButtonState } from "@shared/asistan.js";
import type {
  ButtonStateConfig,
  WebviewElement,
  SlotStateInfo,
  AsistanTrafficState,
  AsistanProviderAdapter,
} from "@shared/asistan.js";
import { AsistanProviderRegistry } from "./provider-registry.js";
import { formatConnectionIndicatorText } from "./connection-indicator.js";
import { resolveAsistanConnectButtonState } from "./connect-flow.js";
import {
  createGhostHandoffRuntimePatch,
  shouldAutoEnableKeepServersOnClose,
} from "./ghost-handoff.js";
import { resolveOverlayStage, shouldKeepOverlayVisibleForToolsReady } from "./overlay-stage.js";
import type { OverlayStage } from "./overlay-stage.js";
import { resolveSystemActiveServerStatus } from "./system-server-control.js";
import { CharacterOverlay } from "./character-overlay.js";
import { MemoryOverlay } from "./memory-overlay.js";

export class AsistanController {
  _unsubSettings: (() => void) | null;
  _unsubSlot: (() => void) | null;
  _unsubTraffic: (() => void) | null;
  _unsubAppState: (() => void) | null;
  _isServerRunning: boolean;
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

  _normalizeOpencodePort(raw: unknown): number {
    if (
      typeof raw === "number" &&
      Number.isInteger(raw) &&
      raw >= 1024 &&
      raw <= 65535
    ) {
      return raw;
    }
    return 4096;
  }

  _getOpencodePreferences(): { binaryPath: string | null; defaultPort: number } {
    const settings = SettingsManager.getSnapshot() as AppSettings | null;
    const rawPath = settings?.assistants?.opencode?.binaryPath;
    const binaryPath =
      typeof rawPath === "string" && rawPath.trim() !== "" ? rawPath.trim() : null;
    const defaultPort = this._normalizeOpencodePort(settings?.assistants?.opencode?.defaultPort);
    return { binaryPath, defaultPort };
  }

  _setOpencodeIndicatorState(
    state: "checking" | "ready" | "missing" | "error",
    text: string,
    title = ""
  ): void {
    if (this.opencodeIndicatorText) {
      this.opencodeIndicatorText.textContent = text;
    }
    if (this.opencodeIndicator) {
      this.opencodeIndicator.title = title;
    }

    const indicator = this.opencodeIndicator;
    const dot = this.opencodeIndicatorDot;
    if (!indicator || !dot) return;

    indicator.classList.remove("is-ready", "is-missing", "is-error");
    dot.classList.remove("status-ready", "status-missing", "status-error", "status-checking");

    if (state === "ready") {
      indicator.classList.add("is-ready");
      dot.classList.add("status-ready");
      return;
    }

    if (state === "missing") {
      indicator.classList.add("is-missing");
      dot.classList.add("status-missing");
      return;
    }

    if (state === "error") {
      indicator.classList.add("is-error");
      dot.classList.add("status-error");
      return;
    }

    dot.classList.add("status-checking");
  }

  _refreshOpencodeDoctorStatus(): void {
    const settings = SettingsManager.getSnapshot() as AppSettings | null;
    const opencode = settings?.assistants?.opencode;
    const defaultPort = this._normalizeOpencodePort(opencode?.defaultPort);
    const binaryPath =
      typeof opencode?.binaryPath === "string" && opencode.binaryPath.trim() !== ""
        ? opencode.binaryPath.trim()
        : null;
    const version =
      typeof opencode?.version === "string" && opencode.version.trim() !== ""
        ? opencode.version.trim()
        : null;

    const titleLines = [`Varsayılan port: ${String(defaultPort)}`];
    if (binaryPath !== null) {
      titleLines.push(`Path: ${binaryPath}`);
    }

    if (version !== null) {
      this._setOpencodeIndicatorState("ready", `OpenCode v${version}`, titleLines.join("\n"));
      return;
    }

    this._setOpencodeIndicatorState("missing", "OpenCode bulunamadı", titleLines.join("\n"));
  }

  async _openOpencodeSettingsModal(): Promise<void> {
    const prefs = this._getOpencodePreferences();
    const modalModule = await import("../../ui/modal-manager.js");
    const electronApi = window.electronAPI;

    const content = document.createElement("div");
    content.className = "opencode-settings-modal";
    content.innerHTML = `
      <div class="opencode-settings-row">
        <label>Binary Path</label>
        <input
          class="input opencode-settings-input"
          type="text"
          placeholder="PATH'teki opencode için boş bırakın"
          data-role="binary-path"
        />
        <p class="opencode-settings-help">
          Boş bırakırsan sistem PATH içindeki <code>opencode</code> komutu kullanılır.
        </p>
      </div>
      <div class="opencode-settings-actions">
        <button class="btn btn-secondary btn-sm" data-action="browse" type="button">Dosya Seç</button>
        <button class="btn btn-ghost btn-sm" data-action="reset" type="button">PATH Kullan</button>
        <button class="btn btn-ghost btn-sm" data-action="check" type="button">Kontrol Et</button>
      </div>
      <div class="opencode-settings-row">
        <label>Default Port</label>
        <input
          class="input opencode-settings-input"
          type="number"
          min="1024"
          max="65535"
          step="1"
          data-role="default-port"
        />
      </div>
      <div class="opencode-settings-check" data-role="check-result"></div>
    `;

    const binaryInput = content.querySelector<HTMLInputElement>('[data-role="binary-path"]');
    const portInput = content.querySelector<HTMLInputElement>('[data-role="default-port"]');
    const checkResult = content.querySelector<HTMLElement>('[data-role="check-result"]');
    const browseBtn = content.querySelector<HTMLButtonElement>('[data-action="browse"]');
    const resetBtn = content.querySelector<HTMLButtonElement>('[data-action="reset"]');
    const checkBtn = content.querySelector<HTMLButtonElement>('[data-action="check"]');

    if (binaryInput) binaryInput.value = prefs.binaryPath ?? "";
    if (portInput) portInput.value = String(prefs.defaultPort);

    const setCheckResult = (
      message: string,
      tone: "normal" | "success" | "error" = "normal"
    ): void => {
      if (!checkResult) return;
      checkResult.textContent = message;
      if (tone === "success") {
        checkResult.style.color = "var(--color-success)";
      } else if (tone === "error") {
        checkResult.style.color = "var(--color-error)";
      } else {
        checkResult.style.color = "var(--text-secondary)";
      }
    };

    let lastValidation: { binaryPath: string | null; version: string | null } | null = null;

    const runDoctorCheck = async (): Promise<void> => {
      if (electronApi === undefined || typeof electronApi.opencodeServeDoctor !== "function") {
        setCheckResult("OpenCode doctor IPC bulunamadı.", "error");
        return;
      }

      const value = binaryInput?.value.trim() ?? "";
      setCheckResult("Kontrol ediliyor...");

      try {
        const result = await electronApi.opencodeServeDoctor(
          value !== "" ? { binaryPath: value } : undefined
        );
        if (result.success !== true || result.available !== true) {
          lastValidation = null;
          setCheckResult(`Kontrol başarısız: ${result.error ?? "Bilinmeyen hata"}`, "error");
          return;
        }

        const detectedPath =
          typeof result.resolvedPath === "string" && result.resolvedPath.trim() !== ""
            ? result.resolvedPath.trim()
            : value !== ""
              ? value
              : null;
        const detectedVersion =
          typeof result.version === "string" && result.version.trim() !== ""
            ? result.version.trim()
            : null;

        if (binaryInput && detectedPath !== null) {
          binaryInput.value = detectedPath;
        }

        lastValidation = {
          binaryPath: detectedPath,
          version: detectedVersion,
        };

        setCheckResult(
          `Kurulu: ${detectedVersion !== null ? `v${detectedVersion}` : "sürüm bilinmiyor"}`,
          "success"
        );
      } catch (error) {
        lastValidation = null;
        setCheckResult(`Kontrol hatası: ${(error as Error).message}`, "error");
      }
    };

    browseBtn?.addEventListener("click", () => {
      void (async (): Promise<void> => {
        if (electronApi === undefined || typeof electronApi.showOpenDialog !== "function") {
          setCheckResult("Dosya seçici API bulunamadı.", "error");
          return;
        }
        const selected = await electronApi.showOpenDialog({
          title: "OpenCode Binary Seç",
          properties: ["openFile"],
        });
        const pickedPath = selected.filePaths[0];
        if (selected.canceled || pickedPath === undefined) return;
        if (binaryInput) binaryInput.value = pickedPath;
        setCheckResult("Binary path seçildi.");
      })();
    });

    resetBtn?.addEventListener("click", () => {
      if (binaryInput) binaryInput.value = "";
      setCheckResult("PATH içindeki opencode kullanılacak.");
    });

    checkBtn?.addEventListener("click", () => {
      void runDoctorCheck();
    });

    modalModule.ModalManager.open({
      title: "OpenCode Ayarları",
      content,
      size: "medium",
      buttons: [
        { label: "Vazgeç", variant: "secondary" },
        {
          label: "Kaydet",
          variant: "primary",
          closeOnClick: false,
          onClick: (): void => {
            void (async (): Promise<void> => {
              const normalizedPath = binaryInput?.value.trim() ?? "";
              const normalizedPortText = portInput?.value.trim() ?? "";
              const parsedPort = Number.parseInt(normalizedPortText, 10);
              if (
                Number.isInteger(parsedPort) !== true ||
                parsedPort < 1024 ||
                parsedPort > 65535
              ) {
                setCheckResult("Default port 1024-65535 aralığında olmalı.", "error");
                return;
              }

              await runDoctorCheck();
              if (lastValidation === null) {
                setCheckResult("Kaydetmeden önce geçerli bir OpenCode binary doğrulaması gerekli.", "error");
                return;
              }

              await SettingsManager.set("assistants.opencode", {
                binaryPath: lastValidation.binaryPath ?? (normalizedPath !== "" ? normalizedPath : null),
                defaultPort: parsedPort,
                version: lastValidation.version,
              });

              setCheckResult("Ayarlar kaydedildi.", "success");
              Logger.info(LogCategory.ASISTAN_CORE, "OpenCode ayarları güncellendi", {
                binaryPath: lastValidation.binaryPath ?? (normalizedPath !== "" ? normalizedPath : null),
                defaultPort: parsedPort,
                version: lastValidation.version,
              });
              this._refreshOpencodeDoctorStatus();
              modalModule.ModalManager.close();
            })();
          },
        },
      ],
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
    const runtimePatch = createGhostHandoffRuntimePatch(this._generateWorkflowSessionId());
    await this._updateAssistantRuntimeState(runtimePatch);

    const electronApi = window.electronAPI;
    if (electronApi === undefined || typeof electronApi.windowClose !== "function") {
      Logger.error(LogCategory.ASISTAN_CORE, "Ghost handoff için pencere kapatma API bulunamadı");
      await this._updateAssistantRuntimeState({ desiredMode: "soft", phase: "idle" });
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

  _generateWorkflowSessionId(): string {
    return `wf-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
  }

  async _syncAssistantRuntimeDefaults(): Promise<void> {
    const electronApi = window.electronAPI;
    if (electronApi === undefined || typeof electronApi.assistantRuntimeRead !== "function") return;

    try {
      const response = await electronApi.assistantRuntimeRead();
      const state = response.state;
      if (!response.success || state === undefined) {
        await electronApi.assistantRuntimeWrite({
          workflowSessionId: this._generateWorkflowSessionId(),
          desiredMode: "soft",
          phase: "idle",
        });
        return;
      }

      if (state.workflowSessionId === "") {
        await electronApi.assistantRuntimeWrite({
          workflowSessionId: this._generateWorkflowSessionId(),
        });
      }
    } catch (error) {
      Logger.warn(LogCategory.ASISTAN_CORE, "Asistan runtime varsayılanları yazılamadı", {
        error: (error as Error).message,
      });
    }
  }

  async _updateAssistantRuntimeState(patch: Record<string, unknown>): Promise<void> {
    const electronApi = window.electronAPI;
    if (electronApi === undefined || typeof electronApi.assistantRuntimeWrite !== "function")
      return;

    try {
      const payload = { ...patch };
      if (
        (payload["workflowSessionId"] === undefined || payload["workflowSessionId"] === "") &&
        (payload["phase"] === "preparing-handoff" || payload["phase"] === "in-ghost")
      ) {
        payload["workflowSessionId"] = this._generateWorkflowSessionId();
      }
      await electronApi.assistantRuntimeWrite(payload);
    } catch (error) {
      Logger.warn(LogCategory.ASISTAN_CORE, "Asistan runtime state güncellenemedi", {
        error: (error as Error).message,
      });
    }
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
    if (!this.providerSelect) return;

    this.providerSelect.innerHTML = "";

    const asistanProviders = ProviderRegistry.getAllAsistan();
    const providerList = Array.isArray(asistanProviders) ? asistanProviders : [];
    providerList.forEach((provider) => {
      if (!this._isProviderOption(provider)) return;
      const opt = document.createElement("option");
      opt.value = provider.id;
      opt.textContent = provider.name;
      this.providerSelect?.appendChild(opt);
    });

    const settings = SettingsManager.getSnapshot() as AppSettings | null;
    const asistanAccounts = settings?.asistanAccounts as
      | { id: string; provider?: string }[]
      | undefined;
    const asistanSlot = settings?.asistanSlot as { accountId?: string } | undefined;
    const account = asistanAccounts?.find((acc) => acc.id === asistanSlot?.accountId);
    if (
      account?.provider !== undefined &&
      account.provider !== "" &&
      this.providerSelect.querySelector(`option[value="${account.provider}"]`) !== null
    ) {
      this.providerSelect.value = account.provider;
    }
  }

  _setupEventListeners(): void {
    this.connectBtn?.addEventListener("click", () => {
      void this._toggleConnection();
    });

    this.ghostAgentBtn?.addEventListener("click", () => {
      void this._handleGhostAgentButtonClick();
    });

    this.resumeLastSessionCheckbox?.addEventListener("change", () => {
      void this._saveResumeTogglePreference(this.resumeLastSessionCheckbox?.checked === true);
    });

    this.keepServersOnAppCloseCheckbox?.addEventListener("change", () => {
      void this._saveKeepServersOnClosePreference(
        this.keepServersOnAppCloseCheckbox?.checked === true
      );
    });

    this.catchCommandsCheckbox?.addEventListener("change", () => {
      void this._saveAsistanCatchCommandsPreference(this.catchCommandsCheckbox?.checked === true);
    });

    this.providerSelect?.addEventListener("change", () => {
      void this._onProviderChange();
    });

    this.opencodeSettingsBtn?.addEventListener("click", () => {
      void this._openOpencodeSettingsModal();
    });

    this.memoryBtn?.addEventListener("click", () => {
      this.memoryOverlay.open();
    });

    this.devtoolsBtn?.addEventListener("click", () => {
      this._openDevTools();
    });

    this.testBtn?.addEventListener("click", () => {
      void this._handleTestClick();
    });

    // Webview içinden gelen MCP toggle mesajlarını dinle
    const ai0Webview = document.getElementById("ai0-webview");
    ai0Webview?.addEventListener("ipc-message", ((
      event: Event & { channel?: string; args?: unknown[] }
    ) => {
      if (event.channel === "mcp-toggle-change") {
        const data = event.args?.[0] as { server: string; enabled: boolean } | undefined;
        if (data?.server != null) {
          void this._onMcpToggleFromHealth(data.server, data.enabled);
        }
      }
      if (event.channel === "opencode-ui-connect-stage") {
        const data = event.args?.[0] as { title?: string; subtitle?: string } | undefined;
        const selectedProviderId = this.providerSelect?.value ?? this._activeAdapter?.id;
        const providerIdForStageEvent = "opencode-ui";
        const canShowStage =
          selectedProviderId === providerIdForStageEvent &&
          (this._connectFlowActive || this._providerToolsReady !== true);

        if (canShowStage) {
          const title = typeof data?.title === "string" ? data.title.trim() : "";
          const subtitle = typeof data?.subtitle === "string" ? data.subtitle.trim() : "";
          if (title !== "" && subtitle !== "") {
            this._setConnectOverlayStage({ title, subtitle });
            this._updateConnectionUI();
          }
        }
      }

      if (event.channel === "opencode-ui-tools-ready") {
        const data = event.args?.[0] as
          | { ready?: boolean; mcpStatus?: string; unresolvedServers?: string[] }
          | undefined;
        const selectedProviderId = this.providerSelect?.value ?? this._activeAdapter?.id;
        const providerIdForToolsReadyEvent = "opencode-ui";
        if (selectedProviderId === providerIdForToolsReadyEvent) {
          this._providerToolsReady = data?.ready === true;

          if (this._providerToolsReady !== true) {
            const unresolved = Array.isArray(data?.unresolvedServers)
              ? data.unresolvedServers.filter((item): item is string => typeof item === "string")
              : [];
            const unresolvedPreview = unresolved.slice(0, 3).join(", ");
            const mcpStatus = typeof data?.mcpStatus === "string" ? data.mcpStatus.trim() : "";

            this._setConnectOverlayStage({
              title: "MCP sunucuları bekleniyor",
              subtitle:
                unresolvedPreview !== ""
                  ? `Beklenen MCP: ${unresolvedPreview}`
                  : mcpStatus !== ""
                    ? `MCP durumu: ${mcpStatus}`
                    : "MCP sunucuları hazırlanıyor",
            });
          }

          this._updateConnectionUI();
        }
      }

      if (event.channel === "opencode-ui-session-changed") {
        const data = event.args?.[0] as { sessionId?: string | null } | undefined;
        const sessionId = data?.sessionId;
        if (typeof sessionId === "string" && sessionId !== "") {
          void this._saveLastOpencodeUiSessionId(sessionId);
          void this._updateAssistantRuntimeState({
            workflowSessionId: sessionId,
            phase: "idle",
          });
        }
      }

      if (event.channel === "assistant-runtime-control") {
        const data = event.args?.[0] as Record<string, unknown> | undefined;
        if (data !== undefined) {
          void this._updateAssistantRuntimeState(data);
        }
      }
    }) as EventListener);
  }

  _isConnected(): boolean {
    const slotState = SlotController.getState("ai0") as SlotStateInfo | null;
    return slotState?.state === SlotState.CONNECTED || this._isServerRunning;
  }

  _setButtonState(state: ConnectButtonState, errorMsg?: string): void {
    if (!this.connectBtn) return;

    const stateConfig: Record<ConnectButtonState, ButtonStateConfig> = {
      [ConnectButtonState.IDLE]: {
        text: "Başlat",
        classes: ["btn-primary"],
        disabled: false,
      },
      [ConnectButtonState.STARTING]: {
        text: "Başlatılıyor...",
        classes: ["btn-primary"],
        disabled: true,
      },
      [ConnectButtonState.CANCEL_CONNECTING]: {
        text: "Bağlantıyı İptal",
        classes: ["btn-danger"],
        disabled: false,
      },
      [ConnectButtonState.CONNECTED]: {
        text: "Bağlantıyı Kes",
        classes: ["btn-danger"],
        disabled: false,
      },
      [ConnectButtonState.STOPPING]: {
        text: "Kesiliyor...",
        classes: ["btn-primary"],
        disabled: true,
      },
      [ConnectButtonState.ERROR]: {
        text: errorMsg ?? "Hata!",
        classes: ["btn-primary"],
        disabled: false,
      },
      [ConnectButtonState.SUCCESS_START]: {
        text: "Bağlandı!",
        classes: ["btn-primary"],
        disabled: false,
      },
      [ConnectButtonState.SUCCESS_STOP]: {
        text: "Kesildi!",
        classes: ["btn-primary"],
        disabled: false,
      },
    };

    const config = stateConfig[state];

    this.connectBtn.className = "btn " + config.classes.join(" ");
    this.connectBtn.textContent = config.text;
    this.connectBtn.disabled = config.disabled;

    this.connectBtn.style.opacity = "";
    this.connectBtn.style.transform = "";
    this.connectBtn.style.transition = "";
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

  _getOpencodeUiDbPath(settings: AppSettings | null): string {
    const accounts = settings?.asistanAccounts as
      | Array<{ id?: string; provider?: string; dbPath?: string | null }>
      | undefined;
    const assignedAccountId = settings?.asistanSlot?.accountId;

    const assignedAccount =
      typeof assignedAccountId === "string" && assignedAccountId !== ""
        ? accounts?.find((account) => account.id === assignedAccountId)
        : undefined;

    if (
      assignedAccount?.provider === "opencode-ui" &&
      typeof assignedAccount.dbPath === "string" &&
      assignedAccount.dbPath.trim() !== ""
    ) {
      return assignedAccount.dbPath.trim();
    }

    const providerAccount = accounts?.find((account) => account.provider === "opencode-ui");
    if (
      providerAccount?.dbPath !== undefined &&
      providerAccount.dbPath !== null &&
      typeof providerAccount.dbPath === "string"
    ) {
      return providerAccount.dbPath.trim();
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

        const dbPath = this._getOpencodeUiDbPath(settings);
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

  _resolveSystemServerStatus(): { running: boolean; adapterId?: string; port?: number } {
    const statuses = AsistanProviderRegistry.getAllAdapters().map((registeredAdapter) => {
      const status = registeredAdapter.getServerStatus();
      return {
        adapterId: registeredAdapter.id,
        running: status.running === true,
        ...(typeof status.port === "number" ? { port: status.port } : {}),
      };
    });

    return resolveSystemActiveServerStatus(statuses);
  }

  async _stopSystemActiveServers(): Promise<void> {
    const stopResults = await Promise.all(
      AsistanProviderRegistry.getAllAdapters().map(async (registeredAdapter) => {
        try {
          const result = await registeredAdapter.stopServer();
          if (result.success !== true && typeof result.error === "string" && result.error !== "") {
            return `${registeredAdapter.id}: ${result.error}`;
          }
        } catch (error) {
          const message = error instanceof Error ? error.message : String(error);
          return `${registeredAdapter.id}: ${message}`;
        }
        return null;
      })
    );

    const errors = stopResults.filter((value): value is string => typeof value === "string");

    this._isServerRunning = false;
    this._updateServerStatus({ running: false });

    if (errors.length > 0) {
      throw new Error(errors.join(" | "));
    }
  }

  async _toggleConnection(options: { forceResume?: boolean } = {}): Promise<void> {
    const slotState = SlotController.getState("ai0") as SlotStateInfo | null;
    const adapter = this._activeAdapter;
    const systemServerStatus = this._resolveSystemServerStatus();
    this._isServerRunning = systemServerStatus.running;

    if (!adapter) {
      Logger.error(LogCategory.ASISTAN_CORE, "Aktif adapter bulunamadı");
      this._setButtonState(ConnectButtonState.ERROR, "Adapter yok");
      return;
    }

    const isConnecting = slotState?.state === SlotState.CONNECTING || this._connectFlowActive;
    if (isConnecting) {
      this._setButtonState(ConnectButtonState.STOPPING);
      this._cancelConnectFlow();

      try {
        Logger.info(LogCategory.ASISTAN_CORE, "Asistan bağlantı isteği iptal edildi", {
          slotState: slotState?.state,
        });

        if (slotState?.state === SlotState.CONNECTING) {
          await SlotController.disconnect("ai0");
        }

        await this._stopSystemActiveServers();
        this._setButtonState(ConnectButtonState.SUCCESS_STOP);
      } catch (err) {
        const error = err as Error;
        this._setButtonState(ConnectButtonState.ERROR, error.message);
      } finally {
        this._finishConnectFlow();
        await new Promise((resolve) =>
          setTimeout(resolve, ASISTAN_TIMEOUTS.STAGE_TRANSITION_SHORT)
        );
        this._updateConnectionUI();
      }
      return;
    }

    if (slotState?.state === SlotState.CONNECTED || this._isServerRunning) {
      this._setButtonState(ConnectButtonState.STOPPING);

      try {
        Logger.debug(LogCategory.ASISTAN_CORE, "Webview disconnect başlatılıyor", {
          slotState: slotState?.state,
        });

        if (slotState?.state === SlotState.CONNECTED) {
          await SlotController.disconnect("ai0");
        }

        Logger.debug(LogCategory.ASISTAN_CORE, "Sistem aktif sunucuları durduruluyor");
        await this._stopSystemActiveServers();

        this._providerToolsReady = true;

        this._setButtonState(ConnectButtonState.SUCCESS_STOP);
        Logger.panel(LogCategory.ASISTAN_CORE, LogLevel.INFO, "Asistan bağlantısı kesildi");

        await new Promise((resolve) => setTimeout(resolve, ASISTAN_TIMEOUTS.STAGE_TRANSITION_MID));
        this._updateConnectionUI();
      } catch (err) {
        const error = err as Error;
        Logger.error(LogCategory.ASISTAN_CORE, "Bağlantı kesme hatası", {
          error: error.message,
        });

        this._isServerRunning = false;
        this._providerToolsReady = true;
        this._updateServerStatus({ running: false });

        this._setButtonState(ConnectButtonState.ERROR, error.message);
        await new Promise((resolve) => setTimeout(resolve, ASISTAN_TIMEOUTS.STAGE_TRANSITION_MID));
        this._updateConnectionUI();
      }
      return;
    }

    if (slotState?.state === SlotState.ASSIGNED || slotState?.state === SlotState.EMPTY) {
      const connectSignal = this._beginConnectFlow();
      const providerId = this.providerSelect?.value ?? adapter.id;
      this._providerToolsReady = providerId === "opencode-ui" ? false : true;

      this._setConnectOverlayStage(null);
      this._setButtonState(ConnectButtonState.CANCEL_CONNECTING);
      this._updateConnectionUI();

      try {
        const result = await adapter.startServer("auto");

        if (this._isConnectFlowCancelled(connectSignal)) {
          return;
        }

        if (result.success === true && result.url !== undefined && result.url !== "") {
          this._isServerRunning = true;

          const targetUrl = this._resolveConnectUrl(result.url, providerId, options);

          const serverReady =
            result.alreadyRunning === true
              ? true
              : await adapter.waitForReady(result.url, 90000, connectSignal);

          if (this._isConnectFlowCancelled(connectSignal)) {
            return;
          }

          if (!serverReady) {
            await this._stopSystemActiveServers();

            Logger.error(LogCategory.ASISTAN_CORE, `${adapter.name} server timeout`, {
              url: result.url,
            });

            return;
          }

          const serverStatus = adapter.getServerStatus();
          this._updateServerStatus({
            running: true,
            ...(typeof serverStatus.port === "number" ? { port: serverStatus.port } : {}),
          });

          await SettingsManager.set("assistants.lastConnected", providerId);

          if (targetUrl !== "") {
            await SlotController.connect("ai0", { url: targetUrl });
          } else {
            await SlotController.connect("ai0", {});
          }

          if (this._isConnectFlowCancelled(connectSignal)) {
            return;
          }

          Logger.success(LogCategory.ASISTAN_CORE, "Asistan bağlantısı başlatıldı", {
            url: targetUrl,
          });
        } else {
          Logger.error(LogCategory.ASISTAN_CORE, `${adapter.name} server başlatılamadı`, {
            error: result.error,
          });
        }
      } finally {
        this._finishConnectFlow();
        this._updateConnectionUI();
      }
    }
  }

  _updateServerStatus(status: { running: boolean; port?: number }): void {
    const statusText = document.querySelector("#asistan-status-text");
    const statusDetails = document.querySelector("#asistan-status-details");
    const statusDot = document.querySelector("#asistan-status-dot");

    if (!statusText) return;

    statusText.textContent = formatConnectionIndicatorText({
      isConnected: status.running,
      isServerRunning: status.running,
      ...(typeof status.port === "number" ? { port: status.port } : {}),
    });

    if (statusDetails) {
      statusDetails.textContent = "";
    }

    if (status.running) {
      statusDot?.classList.remove("status-disconnected", "status-error");
      statusDot?.classList.add("status-connected");
    } else {
      statusDot?.classList.remove("status-connected", "status-error");
      statusDot?.classList.add("status-disconnected");
    }
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

      this._showTestResultsModal(results);
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

  _showTestResultsModal(results: ProviderTestSuite): void {
    void import("../../ui/modal-manager.js").then((module) => {
      const { ModalManager: modalManager } = module;

      const content = this._generateTestResultsHTML(results);

      modalManager.open({
        title: `🧪 Test Results - ${results.providerName} (${results.slot.toUpperCase()})`,
        content,
        size: "large",
        buttons: [
          {
            text: "📋 Copy JSON",
            class: "btn-ghost",
            onClick: (): void => {
              void navigator.clipboard.writeText(JSON.stringify(results, null, 2));
              Logger.info(LogCategory.ASISTAN_CORE, "Test results copied to clipboard");
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

  _generateTestResultsHTML(results: ProviderTestSuite): string {
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

          if (test.details.element) {
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

  _updateConnectionUI(): void {
    const slotState = SlotController.getState("ai0") as SlotStateInfo | null;

    const isConnected = slotState?.state === SlotState.CONNECTED;
    const isConnecting = slotState?.state === SlotState.CONNECTING;
    const isConnectingUi = isConnecting || this._connectFlowActive;
    const isError = slotState?.state === SlotState.ERROR;
    const hasAccount = slotState?.accountId !== undefined && slotState.accountId !== "";
    const providerId = this.providerSelect?.value ?? this._activeAdapter?.id;
    const shouldHoldToolsReadyOverlay = shouldKeepOverlayVisibleForToolsReady({
      ...(typeof providerId === "string" && providerId !== "" ? { providerId } : {}),
      isConnected,
      connectFlowActive: this._connectFlowActive,
      toolsReady: this._providerToolsReady,
    });

    const webviewEl = document.getElementById("ai0-webview");
    const mountEl = document.getElementById("ai0-webview-mount");
    const overlayEl = document.getElementById("ai0-webview-overlay");

    if (webviewEl && mountEl && !mountEl.contains(webviewEl)) {
      SlotController.ensureWebviewMounted("ai0");
      webviewEl.style.cssText = "position: relative; top: 0; left: 0; width: 100%; height: 100%;";
    }

    if (webviewEl !== null && webviewEl.dataset["eventsSetup"] === undefined) {
      this._setupWebviewEvents(webviewEl);
      webviewEl.dataset["eventsSetup"] = "true";
    }

    let overlayVisible = false;

    if (overlayEl) {
      overlayEl.classList.remove("hidden", "empty", "disconnected", "connecting", "error");

      if (!hasAccount) {
        overlayVisible = true;
        this._updateOverlay(
          overlayEl,
          "empty",
          "🤖",
          "Asistan Seçilmedi",
          "Provider seçip bağlanın"
        );
      } else if (isConnectingUi) {
        overlayVisible = true;
        const stage = resolveOverlayStage({
          ...(typeof providerId === "string" && providerId !== "" ? { providerId } : {}),
          connectFlowActive: this._connectFlowActive,
          stage: this._connectOverlayStage,
        });
        this._updateOverlay(overlayEl, "connecting", "🔄", stage.title, stage.subtitle);
      } else if (shouldHoldToolsReadyOverlay) {
        overlayVisible = true;
        const holdTitle =
          typeof this._connectOverlayStage?.title === "string" &&
          this._connectOverlayStage.title.trim() !== ""
            ? this._connectOverlayStage.title
            : "Tool listesi yükleniyor";
        const holdSubtitle =
          typeof this._connectOverlayStage?.subtitle === "string" &&
          this._connectOverlayStage.subtitle.trim() !== ""
            ? this._connectOverlayStage.subtitle
            : "MCP tool listesi hazırlanıyor";

        this._updateOverlay(overlayEl, "connecting", "🔄", holdTitle, holdSubtitle);
      } else if (isError) {
        overlayVisible = true;
        this._updateOverlay(
          overlayEl,
          "error",
          "❌",
          "Bağlantı Hatası",
          slotState.error ?? "Tekrar deneyin"
        );
      } else if (!isConnected) {
        overlayVisible = true;
        this._updateOverlay(
          overlayEl,
          "disconnected",
          "⚡",
          "Asistan Bağlı Değil",
          "Bağlan butonuna tıklayın"
        );
      } else {
        overlayEl.classList.add("hidden");
        if (webviewEl) {
          SlotController.ensureWebviewAttached("ai0");
        }
      }
    }

    if (mountEl) {
      mountEl.classList.toggle("webview-content-blocked", overlayVisible);
    }

    const buttonState = resolveAsistanConnectButtonState({
      ...(slotState?.state !== undefined ? { slotState: slotState.state } : {}),
      isServerRunning: this._isServerRunning,
      connectFlowActive: this._connectFlowActive,
    });
    this._setButtonState(buttonState);

    if (this.ghostAgentBtn) {
      this.ghostAgentBtn.disabled = isConnectingUi;
    }

    if (this.devtoolsBtn) {
      this.devtoolsBtn.disabled = !isConnected;
    }

    if (this.testBtn) {
      this.testBtn.disabled = !isConnected;
      if (!isConnected) {
        this.testBtn.title = "Asistan bağlı değil";
      } else {
        this.testBtn.title = "AI0 provider test";
      }
    }

    if (this.statusDot) {
      this.statusDot.classList.toggle("connected", isConnected);
    }
    const systemServerStatus = this._resolveSystemServerStatus();
    this._isServerRunning = systemServerStatus.running;

    const serverRunning = systemServerStatus.running;

    if (this.statusText) {
      this.statusText.textContent = formatConnectionIndicatorText({
        isConnected,
        isServerRunning: serverRunning,
        ...(typeof systemServerStatus.port === "number" ? { port: systemServerStatus.port } : {}),
      });
    }

    if (this.urlDisplay !== null) {
      if (slotState?.currentUrl !== undefined && slotState.currentUrl !== "") {
        this.urlDisplay.textContent = slotState.currentUrl;
      } else {
        this.urlDisplay.textContent = "-";
      }
    }
  }

  _updateOverlay(
    overlayEl: HTMLElement | null,
    stateClass: string,
    _icon: string, // Unused - CSS spinner kullanılıyor
    title: string,
    subtitle: string
  ): void {
    if (!overlayEl) return;

    overlayEl.className = `webview-overlay ${stateClass}`; // Reset + state class

    const titleEl = overlayEl.querySelector(".overlay-title");
    const subtitleEl = overlayEl.querySelector(".overlay-subtitle");

    if (titleEl) titleEl.textContent = title;
    if (subtitleEl) subtitleEl.textContent = subtitle;
  }

  _updateConnectedAIList(): void {
    if (!this.connectedList) return;

    const badges = [];

    if (SlotController.isConnected("ai1") === true) {
      const nickname = AppState.getNickname("ai1");
      badges.push(`<span class="ai-badge ai1">${nickname}</span>`);
    }

    if (SlotController.isConnected("ai2") === true) {
      const nickname = AppState.getNickname("ai2");
      badges.push(`<span class="ai-badge ai2">${nickname}</span>`);
    }

    if (badges.length === 0) {
      this.connectedList.innerHTML = '<span class="ai-badge inactive">Bağlı AI yok</span>';
    } else {
      this.connectedList.innerHTML = badges.join("");
    }
  }

  _updateTrafficUI(trafficState: AsistanTrafficState | null): void {
    const state = trafficState as AsistanTrafficState;
    const status = state.state?.status;
    if (status === undefined) return;

    const { loading, thinking, send } = status;
    const slotState = SlotController.getState("ai0") as SlotStateInfo | null;
    const isConnected = slotState?.state === SlotState.CONNECTED;

    if (!isConnected) return;

    if (this.statusDot) {
      this.statusDot.classList.remove("loading", "thinking", "send-disabled");

      if (loading === "busy") {
        this.statusDot.classList.add("loading");
      } else if (thinking === "busy") {
        this.statusDot.classList.add("thinking");
      } else if (send === "busy") {
        this.statusDot.classList.add("send-disabled");
      }
    }

    if (this.statusText) {
      if (loading === "busy") {
        this.statusText.textContent = "Yükleniyor...";
      } else if (thinking === "busy") {
        this.statusText.textContent = "Düşünüyor...";
      } else if (send === "busy") {
        this.statusText.textContent = "Gönderilemiyor";
      } else {
        this.statusText.textContent = "";
      }
    }
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
      changedPaths.some(
        (path) => path === "assistants" || path.startsWith("assistants.opencode")
      );

    if (shouldRefreshOpencodeIndicator) {
      this._refreshOpencodeDoctorStatus();
    }

  }

  _setupWebviewEvents(webviewEl: WebviewElement): void {
    webviewEl.addEventListener("did-stop-loading", () => {
      void (async (): Promise<void> => {
        try {
          if (typeof webviewEl.getWebContentsId !== "function") return;
          webviewEl.getWebContentsId();
        } catch (_) {
          return;
        }

        const currentProviderId =
          this.providerSelect?.value ?? AppState.getProviderIdForSlot("ai0");
        const cfg =
          typeof currentProviderId === "string" && currentProviderId !== ""
            ? ProviderRegistry.getAny(currentProviderId)
            : null;
        if (cfg !== null) {
          try {
            const configScript = `
              (function() {
                try {
                  window.__hayalet_slot = "ai0";
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

        this._syncDisabledMcpToHealth();
      })();
    });

    webviewEl.addEventListener("did-navigate", () => {
      try {
        const url = webviewEl.getURL?.() ?? "";
        if (this.urlDisplay) {
          this.urlDisplay.textContent = url;
        }

        const providerId = this.providerSelect?.value ?? AppState.getProviderIdForSlot("ai0");
        if (providerId === "opencode") {
          this._scheduleSaveLastOpencodeUrl(url);
        }
      } catch (_) {}
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
