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
import { LogManager } from "../modules/log-manager.js";
import { AppState } from "../modules/app-state.js";
import { getMimeTypeFromPath } from "../constants/index.js";
import { SlotController, SlotEvent } from "../modules/slot-controller.js";
import { ButtonStates } from "../ui/button-states.js";

import { renderMessages } from "./analyze/message-renderer.js";
import { renderUploadList, addUploadFiles, removeUploadFile } from "./analyze/upload-handler.js";
import { initContextMenu, initReadModal, showContextMenu, showReadModal } from "./analyze/context-menu.js";
import { initDraft, loadDraft, persistDraft } from "./analyze/draft-manager.js";

export class AnalyzeController {
  stagedFiles: any[];
  lastMessages: { ai1: string; ai2: string };
  beforeUnloadHandler: (() => void) | null;
  _unsubSettings: (() => void) | null;
  _unsubSlotController: (() => void) | null;
  _unsubAppState: (() => void) | null;
  _boundActions: boolean;

  constructor() {
    this.stagedFiles = [];
    this.lastMessages = { ai1: "", ai2: "" };
    this.beforeUnloadHandler = null;
    this._unsubSettings = null;
    this._unsubSlotController = null;
    this._unsubAppState = null;
    this._boundActions = false;
  }

  // ============================================
  // ============================================

  async init() {
    await this.loadSettings();
    this.applyAvatars();
    this.applyNames();

    if (!this._unsubSettings) {
      this._unsubSettings = SettingsManager.subscribe(() => {
        this.applyAvatars();
        this.applyNames();
        this.updateConnectionStates();
      });
    }

    this.bindActions();
    TrafficManager.onUpdate(() => this.updateSendButtonState());

    if (!this._unsubSlotController) {
      this._unsubSlotController = SlotController.on(SlotEvent.STATE_CHANGED, () => {
        this.applyNames();
        this.updateConnectionStates();
      });
    }

    if (!this._unsubAppState) {
      this._unsubAppState = AppState.subscribe(() => {
        this.applyNames();
      });
    }

    await this.updateConnectionStates();
    await this.refreshUploads();
    
    initContextMenu();
    initReadModal();
    await this._initDraftSystem();

    this._setupRelayListener();

    window.addEventListener("conversation-selected", (e) => {
      const detail = (e as CustomEvent).detail;
      if (detail?.provider) {
        this._renderMessages(detail.provider);
      }
    });
  }

  async loadSettings() {
    await SettingsManager.load();
  }

  // ============================================
  // ============================================

  applyAvatars() {
    ["ai1", "ai2"].forEach((provider) => {
      const path = AppState.getAvatar(provider);
      
      const el = document.getElementById(`avatar-${provider}`);
      if (!el) return;
      
      if (!path || !window.electronAPI?.readFile) {
        el.textContent = "";
        return;
      }
      
      window.electronAPI.readFile(path)
        .then((data) => {
          if (!data) {
            el.textContent = "";
            return;
          }
          const mime = getMimeTypeFromPath(path);
          el.innerHTML = `<img src="data:${mime};base64,${data}" alt="${provider} avatar" class="img-cover" />`;
        })
        .catch(() => {
          el.textContent = "";
        });
    });
  }

  applyNames() {
    const nickAi1 = AppState.getNickname("ai1");
    const nickAi2 = AppState.getNickname("ai2");

    const nameAi1 = document.getElementById("name-ai1");
    const nameAi2 = document.getElementById("name-ai2");
    if (nameAi1) nameAi1.textContent = nickAi1;
    if (nameAi2) nameAi2.textContent = nickAi2;

    const sendLabelAi1 = document.getElementById("send-ai1-label");
    const sendLabelAi2 = document.getElementById("send-ai2-label");
    if (sendLabelAi1) sendLabelAi1.textContent = nickAi1;
    if (sendLabelAi2) sendLabelAi2.textContent = nickAi2;

    const relayLabelAi1 = document.getElementById("relay-ai1-label");
    const relayLabelAi2 = document.getElementById("relay-ai2-label");
    if (relayLabelAi1) relayLabelAi1.textContent = nickAi1;
    if (relayLabelAi2) relayLabelAi2.textContent = nickAi2;

    const aiChatBtn = document.getElementById("ai-chat-start");
    if (aiChatBtn) {
      aiChatBtn.textContent = `${nickAi1} - ${nickAi2} Sohbet Başlat`;
    }
  }

  // ============================================
  // ============================================

  async updateConnectionStates() {
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

    ["ai1", "ai2"].forEach((slot) => {
      const hasAccount = slot === "ai1" ? ai1HasAccount : ai2HasAccount;
      const connected = slot === "ai1" ? ai1Connected : ai2Connected;

      this._updateSlotUI(slot, hasAccount, connected);
    });

    // Tek AI bağlıysa layout'u ayarla
    this._updateGridLayout(ai1Connected, ai2Connected);

    this._updateAIAIControls();
  }

  _updateSlotUI(slot: string, hasAccount: boolean, connected: boolean) {
    const card = document.getElementById(`card-${slot}`);
    const status = document.getElementById(`status-${slot}`);
    const sendToggle = document.getElementById(`send-${slot}`);
    const messageArea = document.getElementById(`${slot}-message-area`);
    const filterCount = document.getElementById(`filter-count-${slot}`);

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
      messageArea.style.opacity = (!hasAccount || !connected) ? "0.5" : "1";
      messageArea.style.pointerEvents = (!hasAccount || !connected) ? "none" : "auto";
    }

    if (filterCount) {
      (filterCount as HTMLInputElement).disabled = !hasAccount || !connected;
    }
  }

  _updateGridLayout(ai1Connected: boolean, ai2Connected: boolean) {
    const grid = document.querySelector(".conversation-grid");
    const cardAi1 = document.getElementById("card-ai1");
    const cardAi2 = document.getElementById("card-ai2");
    
    if (!grid) return;
    
    const onlyAi1 = ai1Connected && !ai2Connected;
    const onlyAi2 = !ai1Connected && ai2Connected;
    const singleAi = onlyAi1 || onlyAi2;
    
    // Grid class'ını ayarla
    grid.classList.toggle("single-ai", singleAi);
    
    // Bağlı olmayan kartı gizle
    if (cardAi1) cardAi1.classList.toggle("hidden-slot", onlyAi2);
    if (cardAi2) cardAi2.classList.toggle("hidden-slot", onlyAi1);
  }

  _updateAIAIControls() {
    const ai1Assigned = !!AppState.getAccountForSlot("ai1");
    const ai2Assigned = !!AppState.getAccountForSlot("ai2");
    const ai1Connected = SlotController.isConnected("ai1");
    const ai2Connected = SlotController.isConnected("ai2");
    const bothAIsConnected = ai1Connected && ai2Connected;
    const aiChatEnabled = ai1Assigned && ai2Assigned && bothAIsConnected;

    const aiChatBtn = document.getElementById("ai-chat-start") as HTMLButtonElement | null;
    if (aiChatBtn) aiChatBtn.disabled = !aiChatEnabled;

    const relayRadioAi1 = document.querySelector('input[name="relay-starter"][value="ai1"]') as HTMLInputElement | null;
    const relayRadioAi2 = document.querySelector('input[name="relay-starter"][value="ai2"]') as HTMLInputElement | null;
    if (relayRadioAi1) relayRadioAi1.disabled = !aiChatEnabled;
    if (relayRadioAi2) relayRadioAi2.disabled = !aiChatEnabled;

    const analyzeBtn = document.getElementById("compose-start-btn") as HTMLButtonElement | null;
    if (analyzeBtn) analyzeBtn.disabled = !aiChatEnabled;

    this._updateCrossCheckboxState();
  }

  // ============================================
  // ============================================

  bindActions() {
    // Guard: Event listener'ları sadece bir kez bağla
    if (this._boundActions) return;
    this._boundActions = true;

    document.getElementById("ai-chat-start")?.addEventListener("click", () => this.handleAIAIControl());
    document.getElementById("compose-start-btn")?.addEventListener("click", () => this.handleAnalyzeStart());
    document.getElementById("compose-send-btn")?.addEventListener("click", () => this.handleSend());
    document.getElementById("upload-add-btn")?.addEventListener("click", () => this.handleUploadClick());
    document.getElementById("filter-count-ai1")?.addEventListener("change", () => this._renderMessages("ai1"));
    document.getElementById("filter-count-ai2")?.addEventListener("change", () => this._renderMessages("ai2"));
    document.getElementById("compose-input")?.addEventListener("input", () => this.updateSendButtonState());
    
    // Ctrl+Enter ile mesaj gönderme
    document.getElementById("compose-input")?.addEventListener("keydown", (e) => {
      if (e.ctrlKey && e.key === "Enter") {
        e.preventDefault();
        this.handleSend();
      }
    });
    
    ["send-ai1", "send-ai2", "send-cross"].forEach((id) => {
      document.getElementById(id)?.addEventListener("change", () => this.updateSendButtonState());
    });
  }

  // ============================================
  // ============================================

  async _renderMessages(provider: "ai1" | "ai2") {
    const result = await renderMessages(provider, {
      onContextMenu: (e: MouseEvent, payload: any) => showContextMenu(e, payload, () => this.updateSendButtonState()),
      onDoubleClick: (payload: any) => showReadModal(payload),
    });
    this.lastMessages[provider] = result.lastMessage;
  }

  // ============================================
  // ============================================

  async refreshUploads() {
    this._renderUploadList();
  }

  async handleUploadClick() {
    const btn = document.getElementById("upload-add-btn") as HTMLButtonElement | null;
    if (btn?.disabled) return;
    if (btn) btn.disabled = true;
    
    try {
      this.stagedFiles = await addUploadFiles(this.stagedFiles);
      this._renderUploadList();
    } finally {
      if (btn) btn.disabled = false;
    }
  }

  _renderUploadList() {
    renderUploadList(this.stagedFiles, (name) => {
      this.stagedFiles = removeUploadFile(this.stagedFiles, name);
      this._renderUploadList();
    });
    this.updateSendButtonState();
  }

  // ============================================
  // ============================================

  async _initDraftSystem() {
    await initDraft();
    const draft = await loadDraft();
    
    const textarea = document.getElementById("compose-input") as HTMLTextAreaElement | null;
    if (textarea) textarea.value = draft.message;
    this.stagedFiles = draft.files;
    this._renderUploadList();

    this.beforeUnloadHandler = () => this._persistDraft();
    window.addEventListener("beforeunload", this.beforeUnloadHandler);
  }

  _persistDraft() {
    const composeInput = document.getElementById("compose-input") as HTMLTextAreaElement | null;
    const message = composeInput ? composeInput.value : "";
    persistDraft(message, this.stagedFiles);
  }

  // ============================================
  // ============================================

  handleSend() {
    const msg = ((document.getElementById("compose-input") as HTMLTextAreaElement | null)?.value || "").trim();
    const hasFiles = this.stagedFiles.length > 0;
    const sendAi1 = (document.getElementById("send-ai1") as HTMLInputElement | null)?.checked;
    const sendAi2 = (document.getElementById("send-ai2") as HTMLInputElement | null)?.checked;
    const cross = (document.getElementById("send-cross") as HTMLInputElement | null)?.checked;
    const sendBtn = document.getElementById("compose-send-btn") as HTMLButtonElement | null;

    if ((!sendAi1 && !sendAi2) || (!msg && !hasFiles)) return;

    // Loading state
    if (sendBtn) {
      ButtonStates.setLoading(sendBtn, "Gönderiliyor...");
    }

    LogManager.addEvent("analyze", "info", "Gönderim başlatılıyor", { visibility: 2 });

    const targets: string[] = [];
    const textByProvider: Record<string, string> = {};
    const archiveFolders: Record<string, string> = {};

    if (sendAi1) {
      let text = msg;
      if (cross && sendAi2) {
        const otherName = AppState.getNickname("ai2");
        const otherMsg = (this.lastMessages.ai2 || "").trim();
        text = otherMsg ? `${otherName} : ${otherMsg} | ${msg}` : msg;
      }
      textByProvider.ai1 = text;
      targets.push("ai1");
      archiveFolders.ai1 = this._getConversationFolder("ai1");
    }

    if (sendAi2) {
      let text = msg;
      if (cross && sendAi1) {
        const otherName = AppState.getNickname("ai1");
        const otherMsg = (this.lastMessages.ai1 || "").trim();
        text = otherMsg ? `${otherName} : ${otherMsg} | ${msg}` : msg;
      }
      textByProvider.ai2 = text;
      targets.push("ai2");
      archiveFolders.ai2 = this._getConversationFolder("ai2");
    }

    const texts = targets.map((p) => textByProvider[p] || msg);
    const allSame = texts.every((t) => t === texts[0]);
    const attachList = [...this.stagedFiles];

    const sendFlow = async () => {
      try {
        if (allSame) {
          await CoreEngine.sendBatch({ targets, text: texts[0], attachments: attachList, page: "analyze", archiveFolders });
        } else {
          for (const provider of targets) {
            await CoreEngine.sendBatch({ targets: [provider], text: textByProvider[provider], attachments: attachList, page: "analyze", archiveFolders });
          }
        }
        // Success state
        if (sendBtn) {
          ButtonStates.setSuccess(sendBtn, "Gönderildi!", 1500);
        }
        LogManager.addEvent("analyze", "success", "Mesaj gönderildi", { visibility: 1 });
      } catch (error) {
        // Error state
        if (sendBtn) {
          ButtonStates.setError(sendBtn, "Hata!", 1500);
        }
        LogManager.addEvent("analyze", "error", `Gönderim hatası: ${error}`, { visibility: 1 });
      }
    };

    sendFlow().finally(() => {
      this.stagedFiles = [];
      this._renderUploadList();
      const composeInput = document.getElementById("compose-input") as HTMLTextAreaElement | null;
      if (composeInput) composeInput.value = "";
      
      // Reset button after animation completes
      setTimeout(() => this.updateSendButtonState(), 1600);
    });
  }

  async handleAnalyzeStart() {
    const targets = this._getConnectedAIs();
    if (!targets.length) {
      LogManager.addEvent("analyze", "warning", "Analiz protokolü gönderilemedi: bağlı AI yok");
      return;
    }
    await CoreEngine.sendProtocol({
      room: "analyze",
      scenario: "user-ai-ai",
      targets,
      mode: targets.length >= 2 ? "aiRelay" : "normal",
    });
  }

  async handleAIAIControl() {
    const targets = this._getConnectedAIs();
    const btn = document.getElementById("ai-chat-start");
    const nickAi1 = AppState.getNickname("ai1");
    const nickAi2 = AppState.getNickname("ai2");

    if (targets.length < 2) {
      LogManager.addEvent("analyze", "warning", "AI-AI başlatılamadı: iki AI bağlı değil");
      return;
    }

    const relayActive = !!(CoreEngine.relay?.isActive?.());

    if (relayActive) {
      await CoreEngine.sendProtocol({ room: "analyze", scenario: "ai-ai-stop", targets });
      if (btn) btn.textContent = `${nickAi1} - ${nickAi2} Sohbet Başlat`;
      return;
    }

    const starter = (document.querySelector('input[name="relay-starter"]:checked') as HTMLInputElement | null)?.value || "ai1";
    await CoreEngine.sendProtocol({ room: "analyze", scenario: "ai-ai", targets, mode: "aiRelaySequential", context: { starter } });
    if (btn) btn.textContent = `${nickAi1} - ${nickAi2} Sohbet Bitir`;
  }

  // ============================================
  // ============================================

  updateSendButtonState() {
    const btn = document.getElementById("compose-send-btn") as HTMLButtonElement | null;
    if (!btn) return;

    const sendAi1 = (document.getElementById("send-ai1") as HTMLInputElement | null)?.checked;
    const sendAi2 = (document.getElementById("send-ai2") as HTMLInputElement | null)?.checked;
    const hasTarget = sendAi1 || sendAi2;
    const message = ((document.getElementById("compose-input") as HTMLTextAreaElement | null)?.value || "").trim();
    const hasContent = message || this.stagedFiles.length > 0;

    btn.disabled = !hasTarget || !hasContent;
    this._updateCrossCheckboxState();
  }

  _updateCrossCheckboxState() {
    const cross = document.getElementById("send-cross") as HTMLInputElement | null;
    const sendAi1 = document.getElementById("send-ai1") as HTMLInputElement | null;
    const sendAi2 = document.getElementById("send-ai2") as HTMLInputElement | null;

    if (cross && sendAi1 && sendAi2) {
      const bothChecked = sendAi1.checked && sendAi2.checked;
      cross.disabled = !bothChecked;
      if (!bothChecked) cross.checked = false;
    }
  }

  // ============================================
  // ============================================

  _setupRelayListener() {
    try {
      window.addEventListener("relay-changed", (e) => {
        const btn = document.getElementById("ai-chat-start");
        const nickAi1 = AppState.getNickname("ai1");
        const nickAi2 = AppState.getNickname("ai2");
        if (!btn) return;
        const detail = (e as CustomEvent).detail;
        const active = !!detail?.active;
        btn.textContent = active ? `${nickAi1} - ${nickAi2} Sohbet Bitir` : `${nickAi1} - ${nickAi2} Sohbet Başlat`;
      });
    } catch (_e) { /* noop */ }
  }

  _getConnectedAIs() {
    const list = [];
    if (SlotController.isConnected("ai1")) list.push("ai1");
    if (SlotController.isConnected("ai2")) list.push("ai2");
    return list;
  }

  _getConversationFolder(provider: string) {
    const select = document.getElementById(`conversation-${provider}`) as HTMLSelectElement | null;
    if (!select) {
      return "";
    }
    const opt = select.selectedOptions?.[0];
    if (!opt || opt.value === "new") {
      return "";
    }
    return opt.dataset?.folder || "";
  }

  // ============================================
  // ============================================

  async onShow() {
    await this.refreshUploads();
    this.updateSendButtonState();
  }

  onHide() {
    try {
      this._persistDraft();
    } catch (_) { /* noop */ }

    if (this.beforeUnloadHandler) {
      window.removeEventListener("beforeunload", this.beforeUnloadHandler);
      this.beforeUnloadHandler = null;
    }
  }
}
