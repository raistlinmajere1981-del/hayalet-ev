// NOTE: Server lifecycle is delegated to provider adapters.
// NOTE: To add a provider, implement AssistantProviderAdapter and register in provider-registry.ts.
import type { TranslationParams } from "@shared/i18n.js";
import { LogCategory } from "@shared/logging-core";
import { ASSISTANT_TIMEOUTS } from "@timeouts";
import { formatErrorWithDetail } from "../../../../shared/i18n/error-detail.js";
import { getMimeTypeFromPath } from "../../constants/index.js";
import { Logger } from "../../modules/logger/index.js";
import { FileManager } from "../../modules/file-manager.js";
import { AppI18n } from "../../modules/i18n/index.js";
import { resolveIpcErrorMessage } from "../../modules/ipc-errors.js";
import { SettingsManager } from "../../modules/settings-manager.js";
import { AppState } from "../../modules/app-state.js";
import { SlotController, SlotState } from "../../modules/slot-controller.js";
import { TrafficManager } from "../../modules/traffic-manager.js";
import { ThemeManager, type ThemeId } from "../../ui/theme-manager.js";
import { WebviewManager } from "../../modules/webview-manager.js";
import {
  registerAssistantDeliveryHandler,
  type AssistantDeliveryRequest,
  type AssistantDeliveryResult,
} from "../../modules/assistant-delivery.js";
import { ProviderRegistry } from "../../modules/webview/provider-registry.js";
import type { Account, AppSettings } from "@shared/settings.js";
import {
  ASSISTANT_SLOT_SETTINGS_KEY,
  isAssistantAccountsSettingsPath,
  isAssistantSlotSettingsPath,
} from "@shared/settings.js";
import type {
  ConnectButtonState,
  WebviewElement,
  SlotStateInfo,
  AssistantTrafficState,
  AssistantProviderAdapter,
} from "@shared/assistant.js";
import { AssistantProviderRegistry } from "./provider-registry.js";
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
import { toggleAssistantConnection } from "./connection-lifecycle.js";
import { updateAssistantConnectionUI } from "./connection-ui.js";
import { CharacterOverlay } from "./character-overlay.js";
import { MemoryOverlay } from "./memory-overlay.js";
import {
  handleOpencodeActionButtonClick,
  openOpencodeSettingsModal,
  refreshOpencodeDoctorStatus,
} from "./opencode-doctor.js";
import { resolveOpencodeUiDbPath } from "./opencode-preferences.js";
import { bindAssistantBasicEvents } from "./event-bindings.js";
import { populateAssistantProviderSelect } from "./provider-select.js";
import {
  buildScenarioProgressSummary,
  buildScenarioStatusCounts,
  filterScenarioDisplayRows,
  type ScenarioStatusFilter,
} from "../shared/provider-test-presentation.js";
import {
  bindAssistantPrimaryWebviewEvents,
  bindAssistantWebviewIpcEvents,
} from "./webview-bindings.js";
import {
  applyConnectButtonState,
  updateOverlayView,
  updateServerStatusView,
  updateTrafficStatusView,
} from "./view-helpers.js";
import type {
  ProviderScenarioCommandReport,
  ProviderScenarioProgressEvent,
  ProviderTestProgressEvent,
  ProviderTestSuite,
} from "@shared/provider.js";

interface ScenarioPanelState {
  scenarioId: string;
  scenarioTitle: string;
  providerName: string;
  phase: "launcher" | "running" | "completed";
  filter: ScenarioStatusFilter;
  runId: string | null;
  commands: ProviderScenarioCommandReport[];
  message: string;
  suite: ProviderTestSuite | null;
}

const ASSISTANT_CUSTOM_AVATAR_PATH = "src/assets/assistant.png";
const ASSISTANT_DEFAULT_AVATAR_PATH = "src/assets/opencode.png";

function assistantT(key: string, params?: TranslationParams): string {
  return AppI18n.t(`shell.assistant.${key}`, params);
}

function assistantError(key: string, detail?: unknown, params?: TranslationParams): string {
  return formatErrorWithDetail(assistantT(`errors.${key}`, params), detail);
}

function formatAssistantScenarioStatusLabel(status: string): string {
  switch (status) {
    case "pass":
    case "fail":
    case "warning":
    case "skip":
    case "running":
      return assistantT(`scenarioPanel.status.${status}`);
    default:
      return status;
  }
}

function buildAssistantScenarioCompletionMessage(input: {
  passed?: number;
  totalTests?: number;
  commands?: Array<Pick<ProviderScenarioCommandReport, "status">>;
  aborted?: boolean;
  abortReason?: string;
}): string {
  if (input.aborted === true) {
    return input.abortReason?.trim() !== "" && input.abortReason !== undefined
      ? input.abortReason
      : assistantT("scenarioPanel.completedAborted");
  }

  const fallbackCommands = input.commands ?? [];
  const passed =
    typeof input.passed === "number"
      ? input.passed
      : fallbackCommands.filter((command) => command.status === "pass").length;
  const totalTests =
    typeof input.totalTests === "number" ? input.totalTests : fallbackCommands.length;

  if (totalTests <= 0) {
    return assistantT("scenarioPanel.completedGeneric");
  }

  return assistantT("scenarioPanel.completedWithCounts", {
    passed,
    total: totalTests,
  });
}

export class AssistantController {
  _unsubSettings: (() => void) | null;
  _unsubSlot: (() => void) | null;
  _unsubTraffic: (() => void) | null;
  _unsubAppState: (() => void) | null;
  _unsubI18n: (() => void) | null;
  _unsubTheme: (() => void) | null;
  _isServerRunning: boolean;
  _systemServerPort: number | null;
  _activeAdapter: AssistantProviderAdapter | null;
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
  devtoolsBtn: HTMLButtonElement | null;
  testBtn: HTMLButtonElement | null;
  urlDisplay: HTMLElement | null;
  statusDot: HTMLElement | null;
  statusText: HTMLElement | null;
  opencodeIndicator: HTMLElement | null;
  opencodeIndicatorDot: HTMLElement | null;
  opencodeIndicatorText: HTMLElement | null;
  opencodeActionBtn: HTMLButtonElement | null;
  opencodeSettingsBtn: HTMLButtonElement | null;
  characterOverlay: CharacterOverlay;
  memoryOverlay: MemoryOverlay;
  memoryBtn: HTMLButtonElement | null;
  testPanel: HTMLElement | null;
  scenarioPanelState: ScenarioPanelState | null;
  providerTestProgressHandler: ((event: ProviderTestProgressEvent) => void) | null;

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
    this._unsubI18n = null;
    this._unsubTheme = null;
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
    this.devtoolsBtn = null;
    this.testBtn = null;
    this.urlDisplay = null;
    this.statusDot = null;
    this.statusText = null;
    this.opencodeIndicator = null;
    this.opencodeIndicatorDot = null;
    this.opencodeIndicatorText = null;
    this.opencodeActionBtn = null;
    this.opencodeSettingsBtn = null;
    this.characterOverlay = new CharacterOverlay();
    this.memoryOverlay = new MemoryOverlay();
    this.memoryBtn = null;
    this.testPanel = null;
    this.scenarioPanelState = null;
    this.providerTestProgressHandler = null;
  }

  async init(): Promise<void> {
    await SettingsManager.load();

    this.providerSelect = document.getElementById(
      "assistant-provider-select"
    ) as HTMLSelectElement | null;
    this.connectBtn = document.getElementById("assistant-connect-btn") as HTMLButtonElement | null;
    this.ghostAgentBtn = document.getElementById(
      "assistant-ghost-agent-btn"
    ) as HTMLButtonElement | null;
    this.resumeLastSessionCheckbox = document.getElementById(
      "assistant-resume-last-session"
    ) as HTMLInputElement | null;
    this.keepServersOnAppCloseCheckbox = document.getElementById(
      "assistant-keep-servers-on-close"
    ) as HTMLInputElement | null;
    this.catchCommandsCheckbox = document.getElementById(
      "assistant-catch-commands-check"
    ) as HTMLInputElement | null;
    this.devtoolsBtn = document.getElementById(
      "assistant-devtools-btn"
    ) as HTMLButtonElement | null;
    this.testBtn = document.getElementById("ai0-test-btn") as HTMLButtonElement | null;
    this.urlDisplay = document.getElementById("assistant-url-display");
    this.statusDot = document.getElementById("assistant-status-dot");
    this.statusText = document.getElementById("assistant-status-text");
    this.opencodeIndicator = document.getElementById("assistant-opencode-indicator");
    this.opencodeIndicatorDot = document.getElementById("assistant-opencode-indicator-dot");
    this.opencodeIndicatorText = document.getElementById("assistant-opencode-indicator-text");
    this.opencodeActionBtn = document.getElementById(
      "assistant-opencode-action-btn"
    ) as HTMLButtonElement | null;
    this.opencodeSettingsBtn = document.getElementById(
      "assistant-opencode-settings-btn"
    ) as HTMLButtonElement | null;

    this._populateProviderSelect();
    this._initActiveAdapter();
    this._syncTogglePreferencesFromSettings();
    await this._syncAssistantRuntimeDefaults();
    await this._syncIdentityCard();

    // NOTE: Attach the preload to the AI0 webview before loading the URL for the IPC bridge.
    const ai0Wv = document.getElementById("ai0-webview");
    const electronApi = window.electronAPI;
    if (ai0Wv !== null && ai0Wv.getAttribute("preload") === null) {
      try {
        if (electronApi === undefined) {
          return;
        }
        const pp = await electronApi.getPreloadPath("ai0");
        if (pp !== "") ai0Wv.setAttribute("preload", pp);
      } catch (_) {}
    }

    this.memoryBtn = document.getElementById("assistant-memory-btn") as HTMLButtonElement | null;
    this.testPanel = document.getElementById("ai0-test-side-panel");
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
    });

    this._unsubAppState = AppState.subscribe(() => {
      void this._syncIdentityCard();
    });

    this._unsubTheme ??= ThemeManager.onChange((theme) => {
      this._syncOpencodeUiTheme(theme);
    });

    this._unsubI18n ??= AppI18n.subscribe(() => {
      this._updateConnectionUI(true);
      this._refreshOpencodeDoctorStatus();
      this.memoryOverlay.onLocaleChanged();
      if (this.scenarioPanelState !== null) {
        this._renderTestPanel();
      }
    });

    this._unsubTraffic = TrafficManager.onUpdate(
      (snapshot: { ai0?: unknown; [key: string]: unknown }) => {
        if (snapshot.ai0 !== undefined) {
          this._updateTrafficUI(snapshot.ai0);
        }
      }
    );

    this._loadDisabledMcpServers();
    registerAssistantDeliveryHandler(this._handleDeliveryRequest.bind(this));

    this._updateConnectionUI();
    Logger.debug(LogCategory.ASSISTANT_CORE, assistantT("logs.controllerInitialized"));
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
      const catchCommandsValue = settings?.assistantSlot?.catchCommands;
      this.catchCommandsCheckbox.checked = catchCommandsValue === true;
    }
  }

  _refreshOpencodeDoctorStatus(): void {
    refreshOpencodeDoctorStatus({
      indicator: this.opencodeIndicator,
      indicatorDot: this.opencodeIndicatorDot,
      indicatorText: this.opencodeIndicatorText,
      actionButton: this.opencodeActionBtn,
    });
  }

  async _handleOpencodeActionClick(): Promise<void> {
    await handleOpencodeActionButtonClick({
      indicator: this.opencodeIndicator,
      indicatorDot: this.opencodeIndicatorDot,
      indicatorText: this.opencodeIndicatorText,
      actionButton: this.opencodeActionBtn,
    });
  }

  async _openOpencodeSettingsModal(): Promise<void> {
    await openOpencodeSettingsModal({
      onSaved: () => {
        this._refreshOpencodeDoctorStatus();
      },
    });
  }

  async _syncIdentityCard(): Promise<void> {
    const nicknameEl = document.getElementById("assistant-nickname");
    if (nicknameEl != null) {
      nicknameEl.textContent = AppState.getNickname("ai0");
    }

    await this._updateAvatar(AppState.getAvatar("ai0"));
    this._updateIdentityStatusDot();
  }

  _bindIdentityAction(elementId: string, onActivate: () => void | Promise<void>): void {
    const element = document.getElementById(elementId);
    if (!(element instanceof HTMLElement)) {
      return;
    }

    element.addEventListener("click", () => {
      void onActivate();
    });
    element.addEventListener("keydown", (event: KeyboardEvent) => {
      if (event.key !== "Enter" && event.key !== " ") {
        return;
      }
      event.preventDefault();
      void onActivate();
    });
  }

  _getIdentityNicknameModalElements(): {
    overlay: HTMLElement | null;
    input: HTMLInputElement | null;
  } {
    return {
      overlay: document.getElementById("assistant-identity-modal"),
      input: document.getElementById(
        "assistant-identity-nickname-input"
      ) as HTMLInputElement | null,
    };
  }

  _openIdentityNicknameModal(): void {
    const { overlay, input } = this._getIdentityNicknameModalElements();
    if (!(overlay instanceof HTMLElement) || !(input instanceof HTMLInputElement)) {
      return;
    }

    input.value = AppState.getNickname("ai0");
    overlay.classList.remove("hidden");

    requestAnimationFrame(() => {
      input.focus();
      input.select();
    });
  }

  _closeIdentityNicknameModal(): void {
    const { overlay } = this._getIdentityNicknameModalElements();
    overlay?.classList.add("hidden");
  }

  _setupIdentityNicknameModalEvents(): void {
    const { overlay, input } = this._getIdentityNicknameModalElements();
    const closeBtn = document.getElementById("assistant-identity-modal-close");
    const cancelBtn = document.getElementById("assistant-identity-modal-cancel");
    const saveBtn = document.getElementById("assistant-identity-modal-save");

    closeBtn?.addEventListener("click", () => {
      this._closeIdentityNicknameModal();
    });
    cancelBtn?.addEventListener("click", () => {
      this._closeIdentityNicknameModal();
    });
    saveBtn?.addEventListener("click", () => {
      void this._saveIdentityNicknameFromModal();
    });
    overlay?.addEventListener("click", (event: MouseEvent) => {
      if (event.target === overlay) {
        this._closeIdentityNicknameModal();
      }
    });
    input?.addEventListener("keydown", (event: KeyboardEvent) => {
      if (event.key === "Enter") {
        event.preventDefault();
        void this._saveIdentityNicknameFromModal();
        return;
      }

      if (event.key === "Escape") {
        event.preventDefault();
        this._closeIdentityNicknameModal();
      }
    });
  }

  async _saveAssistantIdentityPatch(
    patch: Partial<Pick<Account, "nickname" | "avatarPath">>
  ): Promise<boolean> {
    const settings = SettingsManager.getSnapshot() as AppSettings | null;
    const assistantAccounts = Array.isArray(settings?.assistantAccounts)
      ? settings.assistantAccounts
      : [];

    if (settings === null || assistantAccounts.length === 0) {
      return false;
    }

    const nextAccounts = assistantAccounts.map((account) => {
      const nicknameChanged =
        typeof patch.nickname === "string" &&
        patch.nickname !== "" &&
        patch.nickname !== account.nickname;
      const avatarChanged =
        typeof patch.avatarPath === "string" &&
        patch.avatarPath !== "" &&
        patch.avatarPath !== account.avatarPath;

      if (!nicknameChanged && !avatarChanged) {
        return account;
      }

      return {
        ...account,
        ...(nicknameChanged ? { nickname: patch.nickname } : {}),
        ...(avatarChanged ? { avatarPath: patch.avatarPath } : {}),
      };
    });

    const hasChanges = nextAccounts.some((account, index) => {
      return account !== assistantAccounts[index];
    });

    if (!hasChanges) {
      return false;
    }

    await SettingsManager.save({
      ...(settings as Record<string, unknown>),
      assistantAccounts: nextAccounts,
    });
    return true;
  }

  _editIdentityNickname(): void {
    this._openIdentityNicknameModal();
  }

  async _saveIdentityNicknameFromModal(): Promise<void> {
    const { input } = this._getIdentityNicknameModalElements();
    if (!(input instanceof HTMLInputElement)) {
      return;
    }

    const currentNickname = AppState.getNickname("ai0");
    const nextNickname = input.value.trim().slice(0, 60);

    if (nextNickname === "") {
      input.focus();
      input.select();
      return;
    }

    if (nextNickname === currentNickname) {
      this._closeIdentityNicknameModal();
      return;
    }

    try {
      const updated = await this._saveAssistantIdentityPatch({ nickname: nextNickname });
      if (updated) {
        Logger.info(LogCategory.ASSISTANT_CORE, assistantT("logs.nicknameUpdated"), {
          nickname: nextNickname,
        });
      }

      this._closeIdentityNicknameModal();
    } catch (error) {
      Logger.error(LogCategory.ASSISTANT_CORE, assistantT("logs.nicknameUpdateFailed"), {
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  async _convertImageToPngBase64(sourceDataUrl: string): Promise<string> {
    return await new Promise((resolve, reject) => {
      const image = new Image();

      image.onload = (): void => {
        const width = image.naturalWidth > 0 ? image.naturalWidth : image.width;
        const height = image.naturalHeight > 0 ? image.naturalHeight : image.height;

        if (width === 0 || height === 0) {
          reject(new Error(assistantT("errors.avatarInvalidDimensions")));
          return;
        }

        const canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;

        const context = canvas.getContext("2d");
        if (context === null) {
          reject(new Error(assistantT("errors.avatarCanvasUnavailable")));
          return;
        }

        context.clearRect(0, 0, width, height);
        context.drawImage(image, 0, 0, width, height);

        const pngDataUrl = canvas.toDataURL("image/png");
        const base64 = pngDataUrl.split(",")[1] ?? "";

        if (base64 === "") {
          reject(new Error(assistantT("errors.avatarPngGenerationFailed")));
          return;
        }

        resolve(base64);
      };

      image.onerror = (): void => {
        reject(new Error(assistantT("errors.avatarImageLoadFailed")));
      };

      image.src = sourceDataUrl;
    });
  }

  async _editIdentityAvatar(): Promise<void> {
    const electronApi = window.electronAPI;
    if (
      electronApi === undefined ||
      typeof electronApi.showOpenDialog !== "function" ||
      typeof electronApi.readFile !== "function"
    ) {
      return;
    }

    try {
      const selection = await electronApi.showOpenDialog({
        title: assistantT("avatarDialog.title"),
        buttonLabel: assistantT("avatarDialog.buttonLabel"),
        filters: [
          {
            name: assistantT("avatarDialog.filterName"),
            extensions: ["png", "jpg", "jpeg", "gif", "webp"],
          },
        ],
        properties: ["openFile"],
      });

      if (selection.canceled === true || selection.filePaths.length === 0) {
        return;
      }

      const selectedPath = String(selection.filePaths[0] ?? "").trim();
      if (selectedPath === "") {
        return;
      }

      const sourceBase64 = await electronApi.readFile(selectedPath);
      if (typeof sourceBase64 !== "string" || sourceBase64 === "") {
        throw new Error(assistantT("errors.avatarFileReadFailed"));
      }

      const sourceDataUrl = `data:${getMimeTypeFromPath(selectedPath)};base64,${sourceBase64}`;
      const pngBase64 = await this._convertImageToPngBase64(sourceDataUrl);
      const savedPath = await FileManager.writeFileAtomic(
        ASSISTANT_CUSTOM_AVATAR_PATH,
        pngBase64,
        "base64"
      );

      if (savedPath === "") {
        throw new Error(assistantT("errors.avatarSaveFailed"));
      }

      const updated = await this._saveAssistantIdentityPatch({
        avatarPath: ASSISTANT_CUSTOM_AVATAR_PATH,
      });

      if (updated) {
        Logger.info(LogCategory.ASSISTANT_CORE, assistantT("logs.avatarUpdated"), {
          avatarPath: ASSISTANT_CUSTOM_AVATAR_PATH,
        });
      }
    } catch (error) {
      Logger.error(LogCategory.ASSISTANT_CORE, assistantT("logs.avatarUpdateFailed"), {
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  _getCurrentProviderLabel(): string {
    const selectedOption =
      this.providerSelect === null ? null : this.providerSelect.selectedOptions.item(0);
    const selectedProviderText = selectedOption === null ? null : selectedOption.textContent;
    const selectedProviderLabel =
      selectedProviderText === null ? undefined : selectedProviderText.trim();
    if (selectedProviderLabel !== undefined && selectedProviderLabel !== "") {
      return selectedProviderLabel;
    }

    const providerId = this._activeAdapter?.id ?? AppState.getProviderIdForSlot("ai0");
    if (providerId !== null && providerId !== "") {
      const provider = ProviderRegistry.getAssistant(providerId);
      if (this._isProviderOption(provider)) {
        return provider.name;
      }
      return providerId;
    }

    return AppState.getNickname("ai0");
  }

  _updateIdentityStatusDot(): void {
    const dot = document.getElementById("assistant-identity-status-dot");
    if (dot == null) {
      return;
    }

    const slotState = SlotController.getState("ai0") as SlotStateInfo | null;
    const isConnected = slotState?.state === SlotState.CONNECTED || this._isServerRunning;
    dot.classList.toggle("connected", isConnected);
  }

  async _updateAvatar(avatarPath: string | null): Promise<void> {
    const avatarElement = document.getElementById("ai0-avatar");
    if (avatarElement == null) {
      return;
    }

    const electronApi = window.electronAPI;
    if (!electronApi?.readFile) {
      avatarElement.innerHTML = "";
      avatarElement.style.backgroundImage = "";
      return;
    }

    const preferredAvatarPath = avatarPath ?? "";
    const candidates = [
      preferredAvatarPath !== ASSISTANT_DEFAULT_AVATAR_PATH ? preferredAvatarPath : "",
      ASSISTANT_CUSTOM_AVATAR_PATH,
      preferredAvatarPath,
      ASSISTANT_DEFAULT_AVATAR_PATH,
    ];
    const uniqueCandidates = candidates.filter(
      (candidate, index, arr) => candidate !== "" && arr.indexOf(candidate) === index
    );

    try {
      const tryLoadCandidate = async (index: number): Promise<boolean> => {
        const candidate = uniqueCandidates[index];
        if (candidate === undefined) {
          return false;
        }

        const imageData = await electronApi.readFile(candidate);
        if (typeof imageData !== "string" || imageData === "") {
          return await tryLoadCandidate(index + 1);
        }

        const mimeType = getMimeTypeFromPath(candidate);
        avatarElement.innerHTML = "";
        avatarElement.style.backgroundImage = `url(data:${mimeType};base64,${imageData})`;
        return true;
      };

      const loaded = await tryLoadCandidate(0);
      if (!loaded) {
        avatarElement.innerHTML = "";
        avatarElement.style.backgroundImage = "";
      }
    } catch (error) {
      Logger.error(LogCategory.ASSISTANT_CORE, assistantT("logs.avatarLoadFailed"), {
        error: error instanceof Error ? error.message : String(error),
      });
      avatarElement.innerHTML = "";
      avatarElement.style.backgroundImage = "";
    }
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
      Logger.warn(LogCategory.ASSISTANT_CORE, assistantT("logs.resumeToggleSaveFailed"), {
        error: (error as Error).message,
      });
    }
  }

  async _saveKeepServersOnClosePreference(enabled: boolean): Promise<void> {
    try {
      await SettingsManager.set("assistants.keepServersOnAppClose", enabled);
    } catch (error) {
      Logger.warn(LogCategory.ASSISTANT_CORE, assistantT("logs.keepServersPreferenceSaveFailed"), {
        error: (error as Error).message,
      });
    }
  }

  async _saveAssistantCatchCommandsPreference(enabled: boolean): Promise<void> {
    try {
      await SettingsManager.set(`${ASSISTANT_SLOT_SETTINGS_KEY}.catchCommands`, enabled);
    } catch (error) {
      Logger.warn(
        LogCategory.ASSISTANT_CORE,
        assistantT("logs.catchCommandsPreferenceSaveFailed"),
        {
          error: (error as Error).message,
        }
      );
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
      Logger.error(LogCategory.ASSISTANT_CORE, assistantT("logs.ghostCloseApiMissing"));
      await updateAssistantRuntimeState({ desiredMode: "soft", phase: "idle" });
      return;
    }

    Logger.info(LogCategory.ASSISTANT_CORE, assistantT("logs.ghostHandoffStarted"), {
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
      Logger.warn(LogCategory.ASSISTANT_CORE, assistantT("logs.opencodeUiSessionSaveFailed"), {
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
    }, ASSISTANT_TIMEOUTS.STAGE_TRANSITION_SHORT);
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
      Logger.warn(LogCategory.ASSISTANT_CORE, assistantT("logs.opencodeUrlSaveFailed"), {
        error: (error as Error).message,
      });
    }
  }

  _initActiveAdapter(): void {
    const providerId = this.providerSelect?.value;
    if (providerId === undefined || providerId === "") {
      Logger.error(LogCategory.ASSISTANT_CORE, assistantT("logs.providerNotSelected"));
      return;
    }

    this._activeAdapter = AssistantProviderRegistry.getAdapter(providerId);

    if (!this._activeAdapter) {
      Logger.error(LogCategory.ASSISTANT_CORE, assistantT("logs.adapterNotFound"), {
        providerId,
      });
    }
  }

  _populateProviderSelect(): void {
    const assistantProviders = ProviderRegistry.getAllAssistants();
    const settings = SettingsManager.getSnapshot() as AppSettings | null;
    populateAssistantProviderSelect({
      providerSelect: this.providerSelect,
      providers: Array.isArray(assistantProviders) ? assistantProviders : [],
      settings,
      isProviderOption: (value: unknown): value is { id: string; name: string } =>
        this._isProviderOption(value),
    });
  }

  _setupEventListeners(): void {
    bindAssistantBasicEvents({
      connectBtn: this.connectBtn,
      ghostAgentBtn: this.ghostAgentBtn,
      resumeLastSessionCheckbox: this.resumeLastSessionCheckbox,
      keepServersOnAppCloseCheckbox: this.keepServersOnAppCloseCheckbox,
      catchCommandsCheckbox: this.catchCommandsCheckbox,
      providerSelect: this.providerSelect,
      opencodeSettingsBtn: this.opencodeSettingsBtn,
      opencodeActionBtn: this.opencodeActionBtn,
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
        void this._saveAssistantCatchCommandsPreference(enabled);
      },
      onProviderChange: () => {
        void this._onProviderChange();
      },
      onOpencodeSettingsClick: () => {
        void this._openOpencodeSettingsModal();
      },
      onOpencodeActionClick: () => {
        void this._handleOpencodeActionClick();
      },
      onMemoryClick: () => {
        this.memoryOverlay.open();
      },
      onDevtoolsClick: () => {
        this._openDevTools();
      },
      onTestClick: () => {
        this._handleTestClick();
      },
    });

    this._bindIdentityAction("assistant-avatar-action", async () => {
      await this._editIdentityAvatar();
    });
    this._bindIdentityAction("assistant-nickname", () => {
      this._editIdentityNickname();
    });
    this._setupIdentityNicknameModalEvents();

    const ai0Webview = document.getElementById("ai0-webview");
    bindAssistantWebviewIpcEvents({
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

  async _onMcpToggleFromHealth(server: string, enabled: boolean): Promise<void> {
    if (enabled) {
      this._disabledMcpServers.delete(server);
    } else {
      this._disabledMcpServers.add(server);
    }

    await this._saveDisabledMcpServers();

    Logger.info(
      LogCategory.ASSISTANT_CORE,
      assistantT("logs.mcpToggleSaved", {
        server,
        state: assistantT(enabled ? "mcp.stateEnabled" : "mcp.stateDisabled"),
      }),
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

        parsed.searchParams.set("theme", ThemeManager.current);

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
      const stopErrorMessage = resolveIpcErrorMessage(result);
      if (result.success !== true && stopErrorMessage !== undefined && stopErrorMessage !== "") {
        throw new Error(assistantError("systemServerStopFailed", stopErrorMessage));
      }
    } else if (adapter !== null) {
      const result = await adapter.stopServer();
      const stopErrorMessage = resolveIpcErrorMessage(result) ?? result.error;
      if (result.success !== true && stopErrorMessage !== undefined && stopErrorMessage !== "") {
        throw new Error(assistantError("systemServerStopFailed", stopErrorMessage));
      }
    }

    this._systemServerPort = null;
    this._isServerRunning = false;
    this._updateServerStatus({ running: false });
  }

  async _toggleConnection(options: { forceResume?: boolean } = {}): Promise<void> {
    await toggleAssistantConnection(this, options);
  }

  async _handleDeliveryRequest(
    request: AssistantDeliveryRequest
  ): Promise<AssistantDeliveryResult> {
    const message = request.message.trim();
    if (message === "") {
      return {
        success: false,
        message: assistantT("runtime.deliveryEmpty"),
      };
    }

    try {
      await this._ensureReadyForDelivery();
      const sendResult = (await WebviewManager.send({
        provider: "ai0",
        text: message,
      })) as { success?: boolean; message?: string };

      if (sendResult.success !== true) {
        return {
          success: false,
          message: sendResult.message ?? assistantT("runtime.deliveryFailed"),
        };
      }

      Logger.info(LogCategory.ASSISTANT_CORE, assistantT("logs.deliveryCompleted"), {
        page: request.page ?? "generic",
      });

      return {
        success: true,
        message: assistantT("runtime.deliverySent"),
      };
    } catch (error) {
      const messageText = error instanceof Error ? error.message : String(error);
      Logger.error(LogCategory.ASSISTANT_CORE, assistantT("logs.deliveryFailed"), {
        page: request.page ?? "generic",
        error: messageText,
      });
      return {
        success: false,
        message: messageText,
      };
    }
  }

  async _ensureReadyForDelivery(): Promise<void> {
    const slotState = SlotController.getState("ai0") as SlotStateInfo | null;
    const hasAccount = slotState?.accountId !== undefined && slotState.accountId !== "";
    if (!hasAccount) {
      throw new Error(assistantT("runtime.accountMissing"));
    }

    if (slotState.state !== SlotState.CONNECTED) {
      const isConnecting = slotState.state === SlotState.CONNECTING || this._connectFlowActive;
      if (!isConnecting) {
        await this._toggleConnection();
      }
    }

    const connected = await this._waitForDeliveryCondition(() => {
      const nextState = SlotController.getState("ai0") as SlotStateInfo | null;
      return nextState?.state === SlotState.CONNECTED;
    });

    if (!connected) {
      throw new Error(assistantT("errors.connectionWaitTimeout"));
    }

    const ready = await this._waitForDeliveryCondition(() => {
      const nextState = SlotController.getState("ai0") as
        | (SlotStateInfo & {
            domReady?: boolean;
          })
        | null;
      const trafficState = TrafficManager.getState("ai0");
      const loadingReady =
        trafficState === null ||
        trafficState.readyState === "ready" ||
        trafficState.status.loading !== "busy";

      return (
        nextState?.state === SlotState.CONNECTED &&
        nextState.domReady === true &&
        this._providerToolsReady &&
        loadingReady
      );
    }, 60000);

    if (!ready) {
      throw new Error(assistantT("errors.webviewNotReady"));
    }
  }

  async _waitForDeliveryCondition(
    predicate: () => boolean,
    timeoutMs = 90000,
    intervalMs = 250
  ): Promise<boolean> {
    const startedAt = Date.now();

    const poll = async (): Promise<boolean> => {
      if (predicate()) {
        return true;
      }

      if (Date.now() - startedAt >= timeoutMs) {
        return false;
      }

      await new Promise<void>((resolve) => {
        window.setTimeout(resolve, intervalMs);
      });

      return await poll();
    };

    return await poll();
  }

  _updateServerStatus(status: { running: boolean; port?: number }): void {
    updateServerStatusView(status, {
      statusText: document.querySelector("#assistant-status-text"),
      statusDetails: document.querySelector("#assistant-status-details"),
      statusDot: document.querySelector("#assistant-status-dot"),
    });
  }

  async _onProviderChange(): Promise<void> {
    const providerId = this.providerSelect?.value;
    if (providerId === undefined || providerId === "") return;

    this._activeAdapter = AssistantProviderRegistry.getAdapter(providerId);

    const provider = ProviderRegistry.getAssistant(providerId);
    if (!this._isProviderOption(provider)) return;

    this._providerToolsReady = providerId !== "opencode-ui";

    const settings = SettingsManager.getSnapshot() as AppSettings | null;
    const assistantAccounts = settings?.assistantAccounts as
      | { id: string; provider?: string }[]
      | undefined;
    const account = assistantAccounts?.find((acc) => acc.provider === providerId);

    if (account && settings) {
      const assistantSlot = settings.assistantSlot as { accountId?: string } | undefined;
      await SettingsManager.save({
        ...(settings as Record<string, unknown>),
        assistantSlot: {
          ...(assistantSlot as Record<string, unknown>),
          accountId: account.id,
        },
      });
    }

    await SettingsManager.set("assistants.preferred", providerId);

    Logger.info(LogCategory.ASSISTANT_CORE, assistantT("logs.providerChanged"), {
      providerName: provider.name,
    });
    await this._syncIdentityCard();
    this._updateConnectionUI();
  }

  _openDevTools(): void {
    const webview = document.getElementById("ai0-webview") as WebviewElement | null;

    if (webview && typeof webview.openDevTools === "function") {
      webview.openDevTools();
      Logger.debug(LogCategory.ASSISTANT_CORE, assistantT("logs.devtoolsOpened"));
    } else {
      Logger.warn(LogCategory.ASSISTANT_CORE, assistantT("logs.webviewMissing"));
    }
  }

  _openScenarioPanel(scenarioId: string, scenarioTitle: string): void {
    if (this.scenarioPanelState?.phase === "running") {
      return;
    }

    this.scenarioPanelState = {
      scenarioId,
      scenarioTitle,
      providerName: this._getCurrentProviderLabel(),
      phase: "launcher",
      filter: "all",
      runId: null,
      commands: [],
      message: assistantT("runtime.scenarioHint"),
      suite: null,
    };
    this._renderTestPanel();
  }

  _closeTestPanel(): void {
    this.scenarioPanelState = null;
    this.testPanel?.classList.add("hidden");
  }

  _requestScenarioCancellation(runId: string | null): void {
    if (runId === null || runId.trim() === "") {
      return;
    }

    const electronApi = window.electronAPI;
    if (electronApi === undefined) {
      return;
    }

    void electronApi.cancelProviderScenario({ runId }).catch((error) => {
      Logger.warn(
        LogCategory.ASSISTANT_CORE,
        assistantT("logs.scenarioCancelFailed", {
          message: error instanceof Error ? error.message : String(error),
        })
      );
    });
  }

  _dismissScenarioPanelForUnavailableSlot(): void {
    const state = this.scenarioPanelState;
    if (!state) {
      return;
    }

    if (state.phase === "running") {
      this._requestScenarioCancellation(state.runId);
    }

    this._closeTestPanel();
  }

  _updateTestProgress(event: ProviderScenarioProgressEvent): void {
    const state = this.scenarioPanelState;
    if (!state || event.slot !== "ai0") return;
    if (state.runId !== null && event.runId !== state.runId) return;

    state.runId ??= event.runId;

    if (event.type === "started") {
      state.phase = "running";
      state.message = assistantT("runtime.scenarioPreparing", {
        providerName: state.providerName,
        scenarioTitle: state.scenarioTitle,
      });
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

    this._renderTestPanel();
  }

  _renderTestPanel(): void {
    const state = this.scenarioPanelState;
    const panel = this.testPanel;
    if (!state || !panel) return;

    panel.classList.remove("hidden");

    const displayCommands =
      state.commands.length > 0 ? state.commands : (state.suite?.commands ?? []);
    const summary = buildScenarioProgressSummary({
      slot: "ai0",
      providerName: state.providerName,
      scenarioTitle: state.scenarioTitle,
      commands: displayCommands,
    });
    const counts = buildScenarioStatusCounts({ commands: displayCommands });
    const rows = filterScenarioDisplayRows({
      filter: state.filter,
      commands: displayCommands,
    });
    const summaryMarkup = `
      <div class="scenario-overlay__summary" role="tablist" aria-label="${assistantT("scenarioPanel.resultsFilterAria")}">
        <button class="scenario-summary-chip scenario-summary-chip--pass${state.filter === "pass" ? " is-active" : ""}" type="button" data-filter-status="pass">
          ${counts.pass} ${assistantT("scenarioPanel.status.pass")}
        </button>
        <button class="scenario-summary-chip scenario-summary-chip--fail${state.filter === "fail" ? " is-active" : ""}" type="button" data-filter-status="fail">
          ${counts.fail} ${assistantT("scenarioPanel.status.fail")}
        </button>
        <button class="scenario-summary-chip scenario-summary-chip--warning${state.filter === "warning" ? " is-active" : ""}" type="button" data-filter-status="warning">
          ${counts.warning} ${assistantT("scenarioPanel.status.warning")}
        </button>
        <button class="scenario-summary-chip scenario-summary-chip--skip${state.filter === "skip" ? " is-active" : ""}" type="button" data-filter-status="skip">
          ${counts.skip} ${assistantT("scenarioPanel.status.skip")}
        </button>
      </div>
    `;

    const stepMarkup =
      rows.length === 0
        ? `<div class="scenario-empty">${state.filter === "all" ? assistantT("scenarioPanel.emptyNotStarted") : assistantT("scenarioPanel.emptyNoResults")}</div>`
        : rows
            .map(
              (row) => `
                    <div class="scenario-step scenario-step--${row.status}">
                      <div class="scenario-step__body">
                        <span class="scenario-step__name">${row.name}</span>
                        ${row.message !== "" ? `<span class="scenario-step__message">${row.message}</span>` : ""}
                      </div>
                      <span class="scenario-step__status">${formatAssistantScenarioStatusLabel(row.status)}</span>
                    </div>
                  `
            )
            .join("");

    panel.innerHTML = `
        <div class="assistant-test-panel__header">
          <div>
            <div class="scenario-overlay__eyebrow">AI0 ${state.scenarioTitle}</div>
            <div class="assistant-test-panel__title">${assistantT("scenarioPanel.runningTitle", { providerName: state.providerName, scenarioTitle: state.scenarioTitle })}</div>
            <div class="assistant-test-panel__subtitle">${state.message}</div>
          </div>
        <button class="btn btn-ghost btn-sm assistant-test-panel__close" type="button" ${state.phase === "running" ? "disabled" : ""}>${assistantT("scenarioPanel.closeButton")}</button>
      </div>
          <div class="scenario-overlay__meta">
            <span>${assistantT("scenarioPanel.stepsCompleted", { completed: summary.completedSteps, total: summary.totalSteps })}</span>
            <span>${summary.activeStepId ?? assistantT("scenarioPanel.readyState")}</span>
          </div>
          ${summaryMarkup}
          <div class="assistant-test-panel__steps">${stepMarkup}</div>
          <div class="assistant-test-panel__actions">
            <button class="btn btn-primary btn-sm assistant-test-panel__start" type="button" ${state.phase === "running" ? "disabled" : ""}>
              ${state.phase === "launcher" ? assistantT("scenarioPanel.startButton") : assistantT("scenarioPanel.rerunButton")}
            </button>
            ${
              state.phase === "running"
                ? `<button class="btn btn-secondary btn-sm assistant-test-panel__stop" type="button">${assistantT("scenarioPanel.stopButton")}</button>`
                : ""
            }
            ${state.suite ? `<button class="btn btn-secondary btn-sm assistant-test-panel__copy" type="button">${assistantT("scenarioPanel.copyJsonButton")}</button>` : ""}
          </div>
        `;

    panel.querySelector(".assistant-test-panel__close")?.addEventListener("click", () => {
      this._closeTestPanel();
    });
    panel.querySelector(".assistant-test-panel__start")?.addEventListener("click", () => {
      void this._startScenarioTest();
    });
    panel.querySelector(".assistant-test-panel__stop")?.addEventListener("click", () => {
      void this._stopScenarioTest();
    });
    panel.querySelector(".assistant-test-panel__copy")?.addEventListener("click", () => {
      if (state.suite) {
        void this._copyScenarioSuiteJson(state.suite).catch((error) => {
          state.message = error instanceof Error ? error.message : String(error);
          this._renderTestPanel();
        });
      }
    });
    panel.querySelectorAll<HTMLElement>("[data-filter-status]").forEach((button) => {
      button.addEventListener("click", () => {
        const filter = button.dataset["filterStatus"] as ScenarioStatusFilter | undefined;
        if (filter === undefined) return;
        state.filter = state.filter === filter ? "all" : filter;
        this._renderTestPanel();
      });
    });
  }

  async _copyTextToClipboard(text: string): Promise<boolean> {
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

  async _copyScenarioSuiteJson(results: ProviderTestSuite): Promise<void> {
    const copied = await this._copyTextToClipboard(JSON.stringify(results, null, 2));
    if (!copied) {
      throw new Error(assistantT("errors.clipboardCopyFailed"));
    }

    Logger.info(LogCategory.ASSISTANT_CORE, assistantT("logs.testResultsCopied"));
  }

  async _startScenarioTest(): Promise<void> {
    const state = this.scenarioPanelState;
    if (!state || this.providerTestProgressHandler !== null) return;

    const electronApi = window.electronAPI;
    if (electronApi === undefined) {
      throw new Error(assistantT("errors.electronApiUnavailable"));
    }

    const handler = (event: ProviderScenarioProgressEvent): void => {
      this._updateTestProgress(event);
    };
    this.providerTestProgressHandler = handler;
    electronApi.onProviderScenarioProgress(handler);

    try {
      state.phase = "running";
      state.filter = "all";
      state.runId = null;
      state.commands = [];
      state.suite = null;
      state.message = assistantT("runtime.scenarioStarted", {
        providerName: state.providerName,
        scenarioTitle: state.scenarioTitle,
      });
      this._renderTestPanel();

      const results = (await electronApi.runProviderScenario({
        slot: "ai0",
        scenarioId: state.scenarioId,
      })) as ProviderTestSuite;

      if (results.refreshedConfig) {
        ProviderRegistry.update(results.refreshedConfig.id, results.refreshedConfig);
        const activeWebview = SlotController.getWebview("ai0") as
          | (HTMLElement & { send?: (channel: string, ...args: unknown[]) => void })
          | null;
        activeWebview?.send?.("app-set-provider", {
          providerId: results.refreshedConfig.id,
          slot: "ai0",
        });
      }

      state.phase = "completed";
      state.runId = results.runId ?? state.runId;
      state.commands = results.commands;
      state.suite = results;
      const completionMessage = buildAssistantScenarioCompletionMessage({
        passed: results.passed,
        totalTests: results.totalTests,
        commands: state.commands,
        ...(results.aborted !== undefined ? { aborted: results.aborted } : {}),
        ...(results.abortReason !== undefined ? { abortReason: results.abortReason } : {}),
      });
      state.message = completionMessage;
      this._renderTestPanel();

      Logger.info(
        LogCategory.ASSISTANT_CORE,
        assistantT("logs.scenarioCompleted", {
          scenarioId: state.scenarioId,
          message: completionMessage,
        })
      );
    } catch (error) {
      state.phase = "completed";
      state.message = (error as Error).message;
      this._renderTestPanel();
      Logger.error(
        LogCategory.ASSISTANT_CORE,
        assistantT("logs.scenarioFailed", {
          scenarioId: state.scenarioId,
          message: (error as Error).message,
        })
      );
    } finally {
      const progressHandler = this.providerTestProgressHandler;
      electronApi.offProviderScenarioProgress(progressHandler);
      this.providerTestProgressHandler = null;
    }
  }

  async _stopScenarioTest(): Promise<void> {
    const state = this.scenarioPanelState;
    const electronApi = window.electronAPI;
    if (state?.phase !== "running" || electronApi === undefined) {
      return;
    }

    if (state.runId === null) {
      state.message = assistantT("runtime.scenarioStopPreparing");
      this._renderTestPanel();
      return;
    }

    state.message = assistantT("runtime.scenarioStopRequested");
    this._renderTestPanel();

    try {
      await electronApi.cancelProviderScenario({ runId: state.runId });
    } catch (error) {
      state.message = (error as Error).message;
      this._renderTestPanel();
    }
  }

  _handleTestClick(): void {
    const btn = this.testBtn;
    if (!btn || btn.disabled) return;
    if (this.scenarioPanelState?.phase === "running") return;

    this._openScenarioPanel("webview-test", "webview-test");
  }

  _updateConnectionUI(skipSystemServerSync = false): void {
    const slotState = SlotController.getState("ai0") as SlotStateInfo | null;
    const hasAccount = slotState?.accountId !== undefined && slotState.accountId !== "";
    const isConnected = slotState?.state === SlotState.CONNECTED;
    const isConnecting = slotState?.state === SlotState.CONNECTING || this._connectFlowActive;
    const shouldDismissScenarioPanel = !hasAccount || (!isConnected && !isConnecting);

    if (shouldDismissScenarioPanel) {
      this._dismissScenarioPanelForUnavailableSlot();
    }

    updateAssistantConnectionUI(this, skipSystemServerSync);
    this._updateIdentityStatusDot();
  }

  _updateOverlay(
    overlayEl: HTMLElement | null,
    stateClass: string,
    _icon: string,
    title: string,
    subtitle: string
  ): void {
    updateOverlayView(overlayEl, stateClass, title, subtitle);
  }

  _updateTrafficUI(trafficState: AssistantTrafficState | null): void {
    const state = trafficState as AssistantTrafficState;
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
        (path) => isAssistantAccountsSettingsPath(path) || isAssistantSlotSettingsPath(path)
      );

    if (shouldRefreshProviderSelect) {
      this._populateProviderSelect();
    }

    const shouldRefreshIdentity =
      changedPaths.includes("*") ||
      changedPaths.some(
        (path) =>
          isAssistantAccountsSettingsPath(path) ||
          isAssistantSlotSettingsPath(path) ||
          path === "assistants" ||
          path.startsWith("assistants.preferred")
      );

    if (shouldRefreshIdentity) {
      void this._syncIdentityCard();
    }

    const shouldRefreshToggles =
      changedPaths.includes("*") ||
      changedPaths.some(
        (path) =>
          path === "assistants" ||
          path.startsWith("assistants.resumeLastSession") ||
          path.startsWith("assistants.keepServersOnAppClose") ||
          isAssistantSlotSettingsPath(path)
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
    bindAssistantPrimaryWebviewEvents({
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
      Logger.info(LogCategory.ASSISTANT_CORE, assistantT("logs.disabledMcpLoaded"), {
        disabledMcpServers: Array.from(this._disabledMcpServers),
      });
    }
  }

  async _saveDisabledMcpServers(): Promise<void> {
    try {
      await SettingsManager.set(
        "assistants.disabledMcpServers",
        Array.from(this._disabledMcpServers)
      );
    } catch (e) {
      Logger.error(LogCategory.ASSISTANT_CORE, assistantT("logs.disabledMcpSaveFailed"), {
        error: (e as Error).message,
      });
    }
  }

  _syncDisabledMcpToHealth(): void {
    const ai0Webview = document.getElementById("ai0-webview") as WebviewElement | null;
    if (!ai0Webview) return;

    if (this._disabledMcpServers.size > 0) {
      try {
        const disabledList = Array.from(this._disabledMcpServers);
        void ai0Webview.executeJavaScript?.(
          `(function() {
            try {
              if (typeof window.__setDisabledMcpServers === "function") {
                window.__setDisabledMcpServers(${JSON.stringify(disabledList)});
              }
            } catch(e) { console.warn(${JSON.stringify(assistantT("mcpSyncFailed"))}, e); }
          })();`
        );
      } catch (_) {
        // NOTE: Ignore if the webview is not ready yet.
      }
    }
  }

  _syncOpencodeUiTheme(theme: ThemeId = ThemeManager.current): void {
    const ai0Webview = document.getElementById("ai0-webview") as WebviewElement | null;
    if (ai0Webview == null) {
      return;
    }

    const activeProviderId = this.providerSelect?.value ?? this._activeAdapter?.id ?? "";
    const currentUrl =
      typeof ai0Webview.getURL === "function" ? ai0Webview.getURL() ?? "" : ai0Webview.src ?? "";
    const shouldSyncTheme =
      activeProviderId === "opencode-ui" || currentUrl.includes("/pages/opencode-ui.html");

    if (!shouldSyncTheme) {
      return;
    }

    try {
      void ai0Webview.executeJavaScript?.(
        `(function() {
          try {
            const nextTheme = ${JSON.stringify(theme)};
            if (window.__ThemeManager && typeof window.__ThemeManager.set === "function") {
              window.__ThemeManager.set(nextTheme, true);
              return true;
            }

            document.documentElement.setAttribute("data-theme", nextTheme);
            try {
              localStorage.setItem("app-theme", nextTheme);
            } catch (_) {}
            return true;
          } catch (_) {
            return false;
          }
        })();`
      );
    } catch (_) {
      // NOTE: Ignore if the webview has not finished loading yet.
    }
  }

  onShow(): void {
    this._updateConnectionUI();
    this._syncOpencodeUiTheme();
  }

  onHide(): void {}

  async destroy(): Promise<void> {
    registerAssistantDeliveryHandler(null);

    const progressHandler = this.providerTestProgressHandler;
    if (progressHandler !== null) {
      window.electronAPI?.offProviderTestProgress(progressHandler);
      this.providerTestProgressHandler = null;
    }

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
    this._unsubI18n?.();
    this._unsubTheme?.();
    this.memoryOverlay.destroy();
  }
}
