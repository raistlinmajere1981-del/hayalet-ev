import { LogCategory } from "@shared/logging-core";
import { getErrorMessage } from "@shared/index.js";
/**
 * AnalyzeController - Analyze odası controller'ı (Orchestrator)
 *
 * Alt modüller:
 * - analyze/message-renderer.js: Mesaj render işlemleri
 * - analyze/upload-handler.js: Dosya yükleme işlemleri
 * - analyze/context-menu.js: Context menu ve modal
 * - analyze/draft-manager.js: Taslak yönetimi
 */

import { SettingsManager } from "../modules/settings-manager.js";
import { TrafficManager } from "../modules/traffic-manager.js";
import { CoreEngine } from "../modules/core-engine.js";
import { Logger } from "../modules/logger/index.js";
import { AppState } from "../modules/app-state.js";
import { getMimeTypeFromPath } from "../constants/index.js";
import { SlotController, SlotEvent } from "../modules/slot-controller.js";
import { ButtonStates } from "../ui/button-states.js";

import { renderMessages, resetMessageRenderState } from "./analyze/message-renderer.js";
import type { RenderCallbacks } from "./analyze/message-renderer.js";
import { renderUploadList, addUploadFiles, removeUploadFile } from "./analyze/upload-handler.js";
import type { StagedFile } from "./analyze/upload-handler.js";
import {
  initContextMenu,
  initReadModal,
  showContextMenu,
  showReadModal,
} from "./analyze/context-menu.js";
import { initDraft, loadDraft, persistDraft } from "./analyze/draft-manager.js";

interface ConversationSelectedDetail {
  provider?: "ai1" | "ai2";
  isNew?: boolean;
}

interface DraftState {
  message: string;
  files: StagedFile[];
}

function isConversationSelectedDetail(value: unknown): value is ConversationSelectedDetail {
  if (value === null || value === undefined || typeof value !== "object") {
    return false;
  }

  const maybe = value as Record<string, unknown>;
  const provider = maybe["provider"];
  const isNew = maybe["isNew"];

  const providerValid = provider === undefined || provider === "ai1" || provider === "ai2";
  const isNewValid = isNew === undefined || typeof isNew === "boolean";

  return providerValid && isNewValid;
}

function isDraftState(value: unknown): value is DraftState {
  if (value === null || value === undefined || typeof value !== "object") {
    return false;
  }

  const maybe = value as Record<string, unknown>;
  return typeof maybe["message"] === "string" && Array.isArray(maybe["files"]);
}

export class AnalyzeController {
  stagedFiles: StagedFile[];
  lastMessages: { ai1: string; ai2: string };
  _slotActiveStates: { ai1: boolean; ai2: boolean };
  beforeUnloadHandler: (() => void) | null;
  _unsubSettings: (() => void) | null;
  _unsubSlotController: (() => void) | null;
  _unsubAppState: (() => void) | null;
  _boundActions: boolean;

  constructor() {
    this.stagedFiles = [];
    this.lastMessages = { ai1: "", ai2: "" };
    this._slotActiveStates = { ai1: false, ai2: false };
    this.beforeUnloadHandler = null;
    this._unsubSettings = null;
    this._unsubSlotController = null;
    this._unsubAppState = null;
    this._boundActions = false;
  }

  async init(): Promise<void> {
    await this.loadSettings();
    this.applyAvatars();
    this.applyNames();

    this._unsubSettings ??= SettingsManager.subscribe(
      ({ changedPaths }: { changedPaths: string[] }) => {
        const shouldRefreshAnalyzeHeader =
          changedPaths.includes("*") ||
          changedPaths.some(
            (path) =>
              path.startsWith("user") ||
              path.startsWith("accounts") ||
              path.startsWith("asistanAccounts") ||
              path.startsWith("slots") ||
              path.startsWith("asistanSlot")
          );

        if (!shouldRefreshAnalyzeHeader) {
          return;
        }

        this.applyAvatars();
        this.applyNames();
        this.updateConnectionStates();
      }
    );

    this.bindActions();
    TrafficManager.onUpdate(() => {
      this.updateSendButtonState();
    });

    this._unsubSlotController ??= SlotController.on(SlotEvent.STATE_CHANGED, () => {
      this.applyNames();
      this.updateConnectionStates();
    });

    this._unsubAppState ??= AppState.subscribe(() => {
      this.applyNames();
    });

    this.updateConnectionStates();
    this.refreshUploads();

    initContextMenu();
    initReadModal();
    await this._initDraftSystem();

    window.addEventListener("conversation-selected", (e) => {
      const rawDetail: unknown = (e as CustomEvent<unknown>).detail;
      const detail = isConversationSelectedDetail(rawDetail) ? rawDetail : {};
      Logger.debug(LogCategory.ANALYZE, "conversation-selected event received", { detail });
      if (detail.provider !== undefined) {
        if (detail.isNew === true) {
          Logger.debug(
            LogCategory.ANALYZE,
            `New conversation selected for ${detail.provider} - clearing messages`
          );
          this._clearSlotMessages(detail.provider);
        } else {
          Logger.debug(LogCategory.ANALYZE, `Rendering messages for provider: ${detail.provider}`);
          void this._renderMessages(detail.provider);
        }
      } else {
        Logger.warn(LogCategory.ANALYZE, "conversation-selected event without provider", {
          detail,
        });
      }
    });
  }

  async loadSettings(): Promise<void> {
    await SettingsManager.load();
  }

  applyAvatars(): void {
    const avatarTargets: Array<{ provider: "user" | "ai1" | "ai2"; elementId: string }> = [
      { provider: "ai1", elementId: "avatar-ai1" },
      { provider: "ai2", elementId: "avatar-ai2" },
      { provider: "user", elementId: "avatar-user-compose" },
    ];

    avatarTargets.forEach(({ provider, elementId }) => {
      const configuredPath = AppState.getAvatar(provider);
      const candidates =
        provider === "user"
          ? ["src/assets/user.png", configuredPath, "src/assets/default.png"]
          : [configuredPath];
      const electronApi = window.electronAPI;

      const el = document.getElementById(elementId);
      if (!el) return;

      if (electronApi === undefined) {
        el.textContent = "";
        return;
      }

      const filteredCandidates = candidates.filter(
        (candidate, index, arr) => candidate !== "" && arr.indexOf(candidate) === index
      );

      const tryLoad = (index: number): void => {
        const candidate = filteredCandidates[index];
        if (candidate === undefined) {
          el.textContent = "";
          return;
        }

        electronApi
          .readFile(candidate)
          .then((data) => {
            const base64 = String(data ?? "");
            if (base64 === "") {
              tryLoad(index + 1);
              return;
            }

            const mime = getMimeTypeFromPath(candidate);
            el.innerHTML = `<img src="data:${mime};base64,${base64}" alt="${provider} avatar" class="img-cover" />`;
          })
          .catch(() => {
            tryLoad(index + 1);
          });
      };

      tryLoad(0);
    });
  }

  applyNames(): void {
    const nickUser = AppState.getNickname("user");
    const nickAi1 = AppState.getNickname("ai1");
    const nickAi2 = AppState.getNickname("ai2");

    const nameAi1 = document.getElementById("name-ai1");
    const nameAi2 = document.getElementById("name-ai2");
    if (nameAi1) nameAi1.textContent = nickAi1;
    if (nameAi2) nameAi2.textContent = nickAi2;

    const sendLabelAi1 = document.getElementById("send-ai1-label");
    const sendLabelAi2 = document.getElementById("send-ai2-label");
    const nameUserCompose = document.getElementById("name-user-compose");
    if (sendLabelAi1) sendLabelAi1.textContent = nickAi1;
    if (sendLabelAi2) sendLabelAi2.textContent = nickAi2;
    if (nameUserCompose) nameUserCompose.textContent = nickUser;
  }

  updateConnectionStates(): void {
    const composeInput = document.getElementById("compose-input") as HTMLTextAreaElement | null;
    const uploadBtn = document.getElementById("upload-add-btn") as HTMLButtonElement | null;
    const sendBtn = document.getElementById("compose-send-btn") as HTMLButtonElement | null;
    if (composeInput) composeInput.disabled = false;
    if (uploadBtn) uploadBtn.disabled = false;
    if (sendBtn) sendBtn.disabled = false;

    const ai1Connected = SlotController.isConnected("ai1");
    const ai2Connected = SlotController.isConnected("ai2");
    const ai1HasAccount = !!AppState.getAccountForSlot("ai1");
    const ai2HasAccount = !!AppState.getAccountForSlot("ai2");

    (["ai1", "ai2"] as const).forEach((slot) => {
      const hasAccount = slot === "ai1" ? ai1HasAccount : ai2HasAccount;
      const connected = slot === "ai1" ? ai1Connected : ai2Connected;
      const isActive = hasAccount && connected;
      const wasActive = this._slotActiveStates[slot];

      this._updateSlotUI(slot, hasAccount, connected);

      if (wasActive && !isActive) {
        this._clearSlotMessages(slot);
      }

      this._slotActiveStates[slot] = isActive;
    });

    this._updateGridLayout(ai1Connected, ai2Connected);

    this._updateAIAIControls();
  }

  _updateSlotUI(slot: string, hasAccount: boolean, connected: boolean): void {
    const card = document.getElementById(`card-${slot}`);
    const status = document.getElementById(`status-${slot}`);
    const sendToggle = document.getElementById(`send-${slot}`);
    const messageArea = document.getElementById(`${slot}-message-area`);

    if (status) {
      if (!hasAccount) status.textContent = "Slot boş";
      else if (connected) status.textContent = "Bağlı";
      else status.textContent = "Bağlı değil";
    }

    if (card) {
      card.classList.toggle("slot-empty", !hasAccount);
      card.classList.toggle("slot-disconnected", hasAccount && !connected);
      card.classList.toggle("slot-connected", hasAccount && connected);
    }

    if (sendToggle) {
      (sendToggle as HTMLInputElement).disabled = !hasAccount || !connected;
      if (!hasAccount || !connected) (sendToggle as HTMLInputElement).checked = false;
    }

    if (messageArea) {
      messageArea.style.opacity = !hasAccount || !connected ? "0.5" : "1";
      messageArea.style.pointerEvents = !hasAccount || !connected ? "none" : "auto";
    }
  }

  _updateGridLayout(ai1Connected: boolean, ai2Connected: boolean): void {
    const grid = document.querySelector(".conversation-grid");
    const cardAi1 = document.getElementById("card-ai1");
    const cardAi2 = document.getElementById("card-ai2");

    if (!grid) return;

    const onlyAi1 = ai1Connected && !ai2Connected;
    const onlyAi2 = !ai1Connected && ai2Connected;
    const singleAi = onlyAi1 || onlyAi2;

    grid.classList.toggle("single-ai", singleAi);

    if (cardAi1) cardAi1.classList.toggle("hidden-slot", onlyAi2);
    if (cardAi2) cardAi2.classList.toggle("hidden-slot", onlyAi1);
  }

  _updateAIAIControls(): void {
    const ai1Assigned = !!AppState.getAccountForSlot("ai1");
    const ai2Assigned = !!AppState.getAccountForSlot("ai2");
    const ai1Connected = SlotController.isConnected("ai1") === true;
    const ai2Connected = SlotController.isConnected("ai2") === true;
    const bothAIsConnected = ai1Connected && ai2Connected;
    const aiChatEnabled = ai1Assigned && ai2Assigned && bothAIsConnected;

    const analyzeBtn = document.getElementById("compose-start-btn") as HTMLButtonElement | null;
    if (analyzeBtn) analyzeBtn.disabled = !aiChatEnabled;

    const analyzeStopBtn = document.getElementById("compose-stop-btn") as HTMLButtonElement | null;
    if (analyzeStopBtn) analyzeStopBtn.disabled = !aiChatEnabled;

    this._updateCrossCheckboxState();
  }

  bindActions(): void {
    if (this._boundActions) return;
    this._boundActions = true;

    document.getElementById("compose-start-btn")?.addEventListener("click", () => {
      void this.handleAnalyzeStart();
    });

    document.getElementById("compose-stop-btn")?.addEventListener("click", () => {
      void this.handleAnalyzeStop();
    });

    // Double-click prevention: Check if button is already in loading state
    const sendBtn = document.getElementById("compose-send-btn") as HTMLButtonElement | null;
    if (sendBtn) {
      sendBtn.addEventListener("click", () => {
        if (ButtonStates.isLoading(sendBtn)) {
          Logger.debug(LogCategory.ANALYZE, "Send button clicked while loading - ignoring");
          return;
        }
        this.handleSend();
      });
    }

    document.getElementById("upload-add-btn")?.addEventListener("click", () => {
      void this.handleUploadClick();
    });
    document.getElementById("compose-input")?.addEventListener("input", () => {
      this.updateSendButtonState();
    });

    // Ctrl+Enter ile mesaj gönderme (double-click prevention ile)
    document.getElementById("compose-input")?.addEventListener("keydown", (e) => {
      if (e.ctrlKey && e.key === "Enter") {
        e.preventDefault();
        const sendBtn = document.getElementById("compose-send-btn") as HTMLButtonElement | null;
        if (sendBtn && ButtonStates.isLoading(sendBtn)) {
          Logger.debug(LogCategory.ANALYZE, "Ctrl+Enter pressed while sending - ignoring");
          return;
        }
        this.handleSend();
      }
    });

    ["send-ai1", "send-ai2", "send-cross"].forEach((id) => {
      document.getElementById(id)?.addEventListener("change", () => {
        this.updateSendButtonState();
      });
    });
  }

  _clearSlotMessages(provider: string): void {
    resetMessageRenderState(provider);
    const container = document.getElementById(`messages-${provider}`);
    if (container) {
      container.innerHTML = "";
    }
    this.lastMessages[provider as "ai1" | "ai2"] = "";
    Logger.info(LogCategory.ANALYZE, `${provider} mesajları temizlendi (Yeni Sohbet)`);
  }

  async _renderMessages(provider: "ai1" | "ai2"): Promise<void> {
    Logger.debug(LogCategory.ANALYZE, `_renderMessages called for: ${provider}`);
    const callbacks: RenderCallbacks = {
      onContextMenu: (e: MouseEvent, payload: { provider: string; text: string }) => {
        showContextMenu(e, payload, () => {
          this.updateSendButtonState();
        });
      },
      onDoubleClick: (payload: { provider: string; text: string }) => {
        showReadModal(payload);
      },
    };
    const result = await renderMessages(provider, callbacks);
    Logger.debug(LogCategory.ANALYZE, `_renderMessages completed for ${provider}`, {
      lastMessage: result.lastMessage.substring(0, 50),
    });
    this.lastMessages[provider] = result.lastMessage;
  }

  refreshUploads(): void {
    this._renderUploadList();
  }

  async handleUploadClick(): Promise<void> {
    const btn = document.getElementById("upload-add-btn") as HTMLButtonElement | null;
    if (btn?.disabled === true) return;
    if (btn) btn.disabled = true;

    try {
      this.stagedFiles = await addUploadFiles(this.stagedFiles);
      this._renderUploadList();
    } finally {
      if (btn) btn.disabled = false;
    }
  }

  _renderUploadList(): void {
    renderUploadList(this.stagedFiles, (name) => {
      this.stagedFiles = removeUploadFile(this.stagedFiles, name);
      this._renderUploadList();
    });
    this.updateSendButtonState();
  }

  async _initDraftSystem(): Promise<void> {
    initDraft();
    const draftResult = await loadDraft();
    const draft = isDraftState(draftResult) ? draftResult : { message: "", files: [] };

    const textarea = document.getElementById("compose-input") as HTMLTextAreaElement | null;
    if (textarea) textarea.value = draft.message;
    this.stagedFiles = draft.files;
    this._renderUploadList();

    this.beforeUnloadHandler = (): void => {
      this._persistDraft();
    };
    window.addEventListener("beforeunload", this.beforeUnloadHandler);
  }

  _persistDraft(): void {
    const composeInput = document.getElementById("compose-input") as HTMLTextAreaElement | null;
    const message = composeInput ? composeInput.value : "";
    void persistDraft(message, this.stagedFiles);
  }

  handleSend(): void {
    const msg = (
      (document.getElementById("compose-input") as HTMLTextAreaElement | null)?.value ?? ""
    ).trim();
    const hasFiles = this.stagedFiles.length > 0;
    const sendAi1 = (document.getElementById("send-ai1") as HTMLInputElement | null)?.checked;
    const sendAi2 = (document.getElementById("send-ai2") as HTMLInputElement | null)?.checked;
    const cross = (document.getElementById("send-cross") as HTMLInputElement | null)?.checked;
    const sendBtn = document.getElementById("compose-send-btn") as HTMLButtonElement | null;

    const shouldSendAi1 = sendAi1 === true;
    const shouldSendAi2 = sendAi2 === true;
    const shouldCross = cross === true;

    if ((!shouldSendAi1 && !shouldSendAi2) || (msg === "" && !hasFiles)) return;

    if (sendBtn) {
      ButtonStates.setLoading(sendBtn, "Gönderiliyor...");
    }

    Logger.debug(LogCategory.ANALYZE, "Gönderim başlatılıyor");

    const targets: string[] = [];
    const textByProvider: Record<string, string> = {};
    const archiveFolders: Record<string, string> = {};

    if (shouldSendAi1) {
      let text = msg;
      if (shouldCross && shouldSendAi2) {
        const otherName = AppState.getNickname("ai2");
        const otherMsg = this.lastMessages.ai2.trim();
        text = otherMsg !== "" ? `${otherName} : ${otherMsg} | ${msg}` : msg;
      }
      textByProvider["ai1"] = text;
      targets.push("ai1");
      archiveFolders["ai1"] = this._getConversationFolder("ai1");
    }

    if (shouldSendAi2) {
      let text = msg;
      if (shouldCross && shouldSendAi1) {
        const otherName = AppState.getNickname("ai1");
        const otherMsg = this.lastMessages.ai1.trim();
        text = otherMsg !== "" ? `${otherName} : ${otherMsg} | ${msg}` : msg;
      }
      textByProvider["ai2"] = text;
      targets.push("ai2");
      archiveFolders["ai2"] = this._getConversationFolder("ai2");
    }

    const texts = targets.map((p) => textByProvider[p] ?? msg);
    const allSame = texts.every((t) => t === texts[0]);
    const attachList = [...this.stagedFiles];

    const sendFlow = async (): Promise<void> => {
      try {
        if (allSame) {
          await CoreEngine.sendBatch({
            targets,
            text: texts[0] ?? "",
            attachments: attachList,
            page: "analyze",
            archiveFolders,
          });
        } else {
          await targets.reduce(async (prev, provider) => {
            await prev;
            await CoreEngine.sendBatch({
              targets: [provider],
              text: textByProvider[provider] ?? "",
              attachments: attachList,
              page: "analyze",
              archiveFolders,
            });
          }, Promise.resolve());
        }
        if (sendBtn) {
          ButtonStates.setSuccess(sendBtn, "Gönderildi!", 1500);
        }
        Logger.success(LogCategory.ANALYZE, "Mesaj gönderildi");
      } catch (error) {
        if (sendBtn) {
          ButtonStates.setError(sendBtn, "Hata!", 1500);
        }
        Logger.error(LogCategory.ANALYZE, `Gönderim hatası: ${getErrorMessage(error)}`);
      }
    };

    void sendFlow().finally(() => {
      this.stagedFiles = [];
      this._renderUploadList();
      const composeInput = document.getElementById("compose-input") as HTMLTextAreaElement | null;
      if (composeInput) composeInput.value = "";

      setTimeout(() => {
        this.updateSendButtonState();
      }, 1600);
    });
  }

  async handleAnalyzeStart(): Promise<void> {
    const targets = this._getConnectedAIs();
    if (targets.length === 0) {
      Logger.warn(LogCategory.ANALYZE, "Analiz protokolü gönderilemedi: bağlı AI yok");
      return;
    }
    await CoreEngine.sendProtocol({
      room: "analyze",
      scenario: "user-ai-ai",
      targets,
      mode: targets.length >= 2 ? "aiRelay" : "normal",
    });
  }

  async handleAnalyzeStop(): Promise<void> {
    const targets = this._getConnectedAIs();
    if (targets.length === 0) {
      Logger.warn(LogCategory.ANALYZE, "Analiz sonlandırma mesajı gönderilemedi: bağlı AI yok");
      return;
    }

    await CoreEngine.sendProtocol({
      room: "analyze",
      scenario: "user-ai-ai-stop",
      targets,
    });
  }

  updateSendButtonState(): void {
    const btn = document.getElementById("compose-send-btn") as HTMLButtonElement | null;
    if (!btn) return;

    const sendAi1 = (document.getElementById("send-ai1") as HTMLInputElement | null)?.checked;
    const sendAi2 = (document.getElementById("send-ai2") as HTMLInputElement | null)?.checked;
    const hasTarget = sendAi1 === true || sendAi2 === true;
    const message = (
      (document.getElementById("compose-input") as HTMLTextAreaElement | null)?.value ?? ""
    ).trim();
    const hasContent = message !== "" || this.stagedFiles.length > 0;

    btn.disabled = !hasTarget || !hasContent;
    this._updateCrossCheckboxState();
  }

  _resetSendTargetsOnShow(): void {
    const sendAi1 = document.getElementById("send-ai1") as HTMLInputElement | null;
    const sendAi2 = document.getElementById("send-ai2") as HTMLInputElement | null;
    const cross = document.getElementById("send-cross") as HTMLInputElement | null;

    const ai1CanSend =
      AppState.getAccountForSlot("ai1") !== null && SlotController.isConnected("ai1") === true;
    const ai2CanSend =
      AppState.getAccountForSlot("ai2") !== null && SlotController.isConnected("ai2") === true;

    if (sendAi1) {
      sendAi1.checked = ai1CanSend;
    }
    if (sendAi2) {
      sendAi2.checked = ai2CanSend;
    }
    if (cross) {
      cross.checked = false;
    }

    this._updateCrossCheckboxState();
  }

  _updateCrossCheckboxState(): void {
    const cross = document.getElementById("send-cross") as HTMLInputElement | null;
    const sendAi1 = document.getElementById("send-ai1") as HTMLInputElement | null;
    const sendAi2 = document.getElementById("send-ai2") as HTMLInputElement | null;

    if (cross && sendAi1 && sendAi2) {
      const bothChecked = sendAi1.checked && sendAi2.checked;
      cross.disabled = !bothChecked;
      if (!bothChecked) cross.checked = false;
    }
  }

  _getConnectedAIs(): string[] {
    const list: string[] = [];
    if (SlotController.isConnected("ai1") === true) list.push("ai1");
    if (SlotController.isConnected("ai2") === true) list.push("ai2");
    return list;
  }

  _getConversationFolder(provider: string): string {
    const select = document.getElementById(`conversation-${provider}`) as HTMLSelectElement | null;
    if (!select) {
      return "";
    }
    const opt = select.selectedOptions[0];
    if (!opt || opt.value === "new") {
      return "";
    }
    return opt.dataset["folder"] ?? "";
  }

  onShow(): void {
    this.refreshUploads();
    this.updateConnectionStates();
    this._resetSendTargetsOnShow();
    this.updateSendButtonState();
  }

  onHide(): void {
    try {
      this._persistDraft();
    } catch (_) {
      /* noop */
    }

    if (this.beforeUnloadHandler) {
      window.removeEventListener("beforeunload", this.beforeUnloadHandler);
      this.beforeUnloadHandler = null;
    }
  }
}
