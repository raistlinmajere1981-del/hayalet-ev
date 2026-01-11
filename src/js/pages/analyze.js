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

import { renderMessages } from "./analyze/message-renderer.js";
import { renderUploadList, addUploadFiles, removeUploadFile } from "./analyze/upload-handler.js";
import { initContextMenu, initReadModal, showContextMenu, showReadModal } from "./analyze/context-menu.js";
import { initDraft, loadDraft, persistDraft } from "./analyze/draft-manager.js";

export class AnalyzeController {
  constructor() {
    this.stagedFiles = [];
    this.lastMessages = { ai1: "", ai2: "" };
    this.beforeUnloadHandler = null;
    this._unsubSettings = null;
    this._unsubSlotController = null;
    this._unsubAppState = null;
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
      if (e.detail?.provider) {
        this._renderMessages(e.detail.provider);
      }
    });
  }

  async loadSettings() {
    await SettingsManager.load();
  }

  // ============================================
  // ============================================

  applyAvatars() {
    const settings = SettingsManager.getSnapshot();
    
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
          el.innerHTML = `<img src="data:${mime};base64,${data}" alt="${provider} avatar" />`;
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
    const settings = SettingsManager.getSnapshot();

    const composeInput = document.getElementById("compose-input");
    const uploadBtn = document.getElementById("upload-add-btn");
    const sendBtn = document.getElementById("compose-send-btn");
    if (composeInput) composeInput.disabled = false;
    if (uploadBtn) uploadBtn.disabled = false;
    if (sendBtn) sendBtn.disabled = false;

    ["ai1", "ai2"].forEach((slot) => {
      const hasAccount = !!AppState.getAccountForSlot(slot);
      const connected = SlotController.isConnected(slot);

      this._updateSlotUI(slot, hasAccount, connected);
    });

    this._updateAIAIControls();
  }

  _updateSlotUI(slot, hasAccount, connected) {
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
      sendToggle.disabled = !hasAccount || !connected;
      if (!hasAccount || !connected) sendToggle.checked = false;
    }

    if (messageArea) {
      messageArea.style.opacity = (!hasAccount || !connected) ? "0.5" : "1";
      messageArea.style.pointerEvents = (!hasAccount || !connected) ? "none" : "auto";
    }

    if (filterCount) {
      filterCount.disabled = !hasAccount || !connected;
    }
  }

  _updateAIAIControls() {
    const ai1Assigned = !!AppState.getAccountForSlot("ai1");
    const ai2Assigned = !!AppState.getAccountForSlot("ai2");
    const ai1Connected = SlotController.isConnected("ai1");
    const ai2Connected = SlotController.isConnected("ai2");
    const bothAIsConnected = ai1Connected && ai2Connected;
    const aiChatEnabled = ai1Assigned && ai2Assigned && bothAIsConnected;

    const aiChatBtn = document.getElementById("ai-chat-start");
    if (aiChatBtn) aiChatBtn.disabled = !aiChatEnabled;

    const relayRadioAi1 = document.querySelector('input[name="relay-starter"][value="ai1"]');
    const relayRadioAi2 = document.querySelector('input[name="relay-starter"][value="ai2"]');
    if (relayRadioAi1) relayRadioAi1.disabled = !aiChatEnabled;
    if (relayRadioAi2) relayRadioAi2.disabled = !aiChatEnabled;

    const analyzeBtn = document.getElementById("compose-start-btn");
    if (analyzeBtn) analyzeBtn.disabled = !aiChatEnabled;

    this._updateCrossCheckboxState();
  }

  // ============================================
  // ============================================

  bindActions() {
    document.getElementById("ai-chat-start")?.addEventListener("click", () => this.handleAIAIControl());
    document.getElementById("compose-start-btn")?.addEventListener("click", () => this.handleAnalyzeStart());
    document.getElementById("compose-send-btn")?.addEventListener("click", () => this.handleSend());
    document.getElementById("upload-add-btn")?.addEventListener("click", () => this.handleUploadClick());
    document.getElementById("filter-count-ai1")?.addEventListener("change", () => this._renderMessages("ai1"));
    document.getElementById("filter-count-ai2")?.addEventListener("change", () => this._renderMessages("ai2"));
    document.getElementById("compose-input")?.addEventListener("input", () => this.updateSendButtonState());
    
    ["send-ai1", "send-ai2", "send-cross"].forEach((id) => {
      document.getElementById(id)?.addEventListener("change", () => this.updateSendButtonState());
    });
  }

  // ============================================
  // ============================================

  async _renderMessages(provider) {
    const result = await renderMessages(provider, {
      onContextMenu: (e, payload) => showContextMenu(e, payload, () => this.updateSendButtonState()),
      onDoubleClick: (payload) => showReadModal(payload),
    });
    this.lastMessages[provider] = result.lastMessage;
  }

  // ============================================
  // ============================================

  async refreshUploads() {
    this._renderUploadList();
  }

  async handleUploadClick() {
    this.stagedFiles = await addUploadFiles(this.stagedFiles);
    this._renderUploadList();
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
    
    const textarea = document.getElementById("compose-input");
    if (textarea) textarea.value = draft.message;
    this.stagedFiles = draft.files;
    this._renderUploadList();

    this.beforeUnloadHandler = () => this._persistDraft();
    window.addEventListener("beforeunload", this.beforeUnloadHandler);
  }

  _persistDraft() {
    const composeInput = document.getElementById("compose-input");
    const message = composeInput ? composeInput.value : "";
    persistDraft(message, this.stagedFiles);
  }

  // ============================================
  // ============================================

  handleSend() {
    const msg = (document.getElementById("compose-input")?.value || "").trim();
    const hasFiles = this.stagedFiles.length > 0;
    const sendAi1 = document.getElementById("send-ai1")?.checked;
    const sendAi2 = document.getElementById("send-ai2")?.checked;
    const cross = document.getElementById("send-cross")?.checked;

    if ((!sendAi1 && !sendAi2) || (!msg && !hasFiles)) return;

    LogManager.addEvent("analyze", "info", "Gönderim başlatılıyor");

    const humanName = AppState.getNickname("user");
    const ts = this._formatTimestamp();
    const userLine = msg ? `${humanName} : ${msg} [${ts}]` : "";

    const targets = [];
    const textByProvider = {};
    const archiveFolders = {};

    if (sendAi1) {
      let text = userLine;
      if (cross && sendAi2) {
        const otherName = AppState.getNickname("ai2");
        const otherMsg = (this.lastMessages.ai2 || "").trim();
        text = otherMsg ? `${otherName} : ${otherMsg} | ${userLine}` : userLine;
      }
      textByProvider.ai1 = text;
      targets.push("ai1");
      archiveFolders.ai1 = this._getConversationFolder("ai1");
    }

    if (sendAi2) {
      let text = userLine;
      if (cross && sendAi1) {
        const otherName = AppState.getNickname("ai1");
        const otherMsg = (this.lastMessages.ai1 || "").trim();
        text = otherMsg ? `${otherName} : ${otherMsg} | ${userLine}` : userLine;
      }
      textByProvider.ai2 = text;
      targets.push("ai2");
      archiveFolders.ai2 = this._getConversationFolder("ai2");
    }

    const texts = targets.map((p) => textByProvider[p] || userLine);
    const allSame = texts.every((t) => t === texts[0]);
    const attachList = [...this.stagedFiles];

    const sendFlow = async () => {
      if (allSame) {
        await CoreEngine.sendBatch({ targets, text: texts[0], attachments: attachList, page: "analyze", archiveFolders });
      } else {
        for (const provider of targets) {
          await CoreEngine.sendBatch({ targets: [provider], text: textByProvider[provider], attachments: attachList, page: "analyze", archiveFolders });
        }
      }
    };

    sendFlow().finally(() => {
      this.stagedFiles = [];
      this._renderUploadList();
      const composeInput = document.getElementById("compose-input");
      if (composeInput) composeInput.value = "";
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

    const starter = document.querySelector('input[name="relay-starter"]:checked')?.value || "ai1";
    await CoreEngine.sendProtocol({ room: "analyze", scenario: "ai-ai", targets, mode: "aiRelaySequential", context: { starter } });
    if (btn) btn.textContent = `${nickAi1} - ${nickAi2} Sohbet Bitir`;
  }

  // ============================================
  // ============================================

  updateSendButtonState() {
    const btn = document.getElementById("compose-send-btn");
    if (!btn) return;

    const sendAi1 = document.getElementById("send-ai1")?.checked;
    const sendAi2 = document.getElementById("send-ai2")?.checked;
    const hasTarget = sendAi1 || sendAi2;
    const message = (document.getElementById("compose-input")?.value || "").trim();
    const hasContent = message || this.stagedFiles.length > 0;

    btn.disabled = !hasTarget || !hasContent;
    this._updateCrossCheckboxState();
  }

  _updateCrossCheckboxState() {
    const cross = document.getElementById("send-cross");
    const sendAi1 = document.getElementById("send-ai1");
    const sendAi2 = document.getElementById("send-ai2");

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
        const active = !!e?.detail?.active;
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

  _getConversationFolder(provider) {
    const select = document.getElementById(`conversation-${provider}`);
    const opt = select?.selectedOptions?.[0];
    const folder = opt?.dataset?.folder || "";
    return (!folder || opt?.value === "new") ? "" : folder;
  }

  _formatTimestamp() {
    const d = new Date();
    return d.toLocaleString("tr-TR", { year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" });
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
