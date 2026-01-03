// @ts-nocheck
// Analyze odası controller'ı - temel veri bağlama (avatarlar, arşivler, örnek etkileşimler)
import { SettingsManager } from "../modules/settings-manager.js";
import { TrafficManager } from "../modules/traffic-manager.js";
import { CoreEngine } from "../modules/core-engine.js";
import { LogManager } from "../modules/log-manager.js";
import { AppState } from "../modules/app-state.js";
import { FileManager } from "../modules/file-manager.js";
import { getAvatarPath } from "../modules/settings-helpers.js";
// ConversationListManager was unused and removed to satisfy linter

export class AnalyzeController {
  constructor() {
    this.settings = null;
    this.uploadFiles = [];
    this.stagedFiles = [];
    this.contextMenu = null;
    this.readModal = null;
    this.lastMessages = { ai1: "", ai2: "" };
    this.analyzeSessionActive = false;
    this.aiAiSessionActive = false;
    this.draftPath = "";
    this.beforeUnloadHandler = null;
  }

  async init() {
    await this.loadSettings();
    this.applyAvatars();
    this.applyNames();

    // Realtime settings sync
    if (!this._unsubSettings) {
      this._unsubSettings = SettingsManager.subscribe((s) => {
        this.settings = s;
        this.applyAvatars();
        this.applyNames();
      });
    }
    this.bindActions();
    TrafficManager.onUpdate(() => this.updateSendButtonState());
    AppState.subscribe(() => this.updateConnectionStates());
    await this.updateConnectionStates(); // Initial call to set correct state
    await this.refreshUploads();
    this.initContextMenu();
    this.initReadModal();
    await this.initDraft();
    this.beforeUnloadHandler = () => {
      this.persistDraft();
    };
    window.addEventListener("beforeunload", this.beforeUnloadHandler);
    try {
      window.addEventListener("relay-changed", (e) => {
        const btn = document.getElementById("ai-chat-start");
        const nickAi1 = AppState.getNickname("ai1");
        const nickAi2 = AppState.getNickname("ai2");
        if (!btn) return;
        const active = !!e?.detail?.active;
        btn.textContent = active
          ? `${nickAi1} - ${nickAi2} Sohbet Bitir`
          : `${nickAi1} - ${nickAi2} Sohbet Başlat`;
      });
    } catch (e) {
      /* noop */
    }
    window.addEventListener("conversation-selected", (e) => {
      if (e.detail?.provider) {
        this.renderMessages(e.detail.provider);
      }
    });
  }

  async loadSettings() {
    this.settings = await SettingsManager.load();
  }

  applyAvatars() {
    const map = {
      ai1: getAvatarPath(this.settings, "ai1"),
      ai2: getAvatarPath(this.settings, "ai2"),
    };
    Object.entries(map).forEach(([provider, path]) => {
      const el = document.getElementById(`avatar-${provider}`);
      if (!el) return;
      if (!path || !window.electronAPI?.readFile) {
        el.textContent = ""; // Leave empty if no avatar
        return;
      }
      window.electronAPI
        .readFile(path)
        .then((data) => {
          if (!data) {
            el.textContent = ""; // Leave empty if no avatar
            return;
          }
          const ext = path.split(".").pop().toLowerCase();
          const mime =
            {
              jpg: "image/jpeg",
              jpeg: "image/jpeg",
              png: "image/png",
              gif: "image/gif",
              webp: "image/webp",
            }[ext] || "image/png";
          el.innerHTML = `<img src="data:${mime};base64,${data}" alt="${provider} avatar" />`;
        })
        .catch(() => {
          el.textContent = ""; // Leave empty if no avatar
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

  async updateConnectionStates() {
    const connectedHuman = AppState.getConnection("human");

    const composeInput = document.getElementById("compose-input");
    const uploadBtn = document.getElementById("upload-add-btn");
    if (composeInput) composeInput.disabled = !connectedHuman;
    if (uploadBtn) uploadBtn.disabled = !connectedHuman;

    const settings = await SettingsManager.load();

    ["ai1", "ai2"].forEach((provider) => {
      const connected = AppState.getConnection(provider);
      const hasAccount = !!settings?.[provider]?.activeAccountId;
      const card = document.getElementById(`card-${provider}`);
      const status = document.getElementById(`status-${provider}`);
      
      // Keep card visible but mark as disconnected if no account or not connected
      if (card) {
        card.style.display = ""; // Always visible
        card.classList.toggle("disconnected", !hasAccount || !connected);
      }
      
      if (status) {
        status.textContent = !hasAccount 
          ? "Hesap atanmadı"
          : (connected ? "Bağlı" : "Bağlı değil");
      }
      const sendToggle = document.getElementById(`send-${provider}`);
      if (sendToggle) {
        // Disable send toggle if no account, no human connection, or AI not connected
        if (!hasAccount || !connectedHuman || !connected) {
          sendToggle.checked = false;
          sendToggle.disabled = true;
          sendToggle.dataset.userSet = "";
        } else {
          sendToggle.disabled = false;
          const userSet = sendToggle.dataset.userSet === "1";
          if (!userSet) {
            sendToggle.checked = true;
          }
        }
      }
    });

    const ai1HasAccount = !!settings?.ai1?.activeAccountId;
    const ai2HasAccount = !!settings?.ai2?.activeAccountId;
    const bothAIsConnected =
      AppState.getConnection("ai1") && AppState.getConnection("ai2");
    const bothHaveAccounts = ai1HasAccount && ai2HasAccount;
    
    const aiStart = document.getElementById("ai-chat-start");
    if (aiStart) aiStart.disabled = !bothAIsConnected || !bothHaveAccounts;

    const relayRadios = document.querySelectorAll(
      'input[name="relay-starter"]',
    );
    relayRadios.forEach((r) => {
      r.disabled = !bothAIsConnected || !bothHaveAccounts;
    });

    const analyzeStart = document.getElementById("compose-start-btn");
    if (analyzeStart)
      analyzeStart.disabled = !(bothAIsConnected && bothHaveAccounts && connectedHuman);

    const cross = document.getElementById("send-cross");
    if (cross && !connectedHuman) cross.disabled = true;

    this.updateSendButtonState();
  }

  bindActions() {
    document
      .getElementById("ai-chat-start")
      ?.addEventListener("click", () => this.handleAIAIControl());
    document
      .getElementById("compose-start-btn")
      ?.addEventListener("click", () => this.handleAnalyzeStart());
    document
      .getElementById("compose-send-btn")
      ?.addEventListener("click", () => this.handleSend());
    document
      .getElementById("upload-add-btn")
      ?.addEventListener("click", () => this.handleUploadClick());
    document
      .getElementById("filter-count-ai1")
      ?.addEventListener("change", () => this.renderMessages("ai1"));
    document
      .getElementById("filter-count-ai2")
      ?.addEventListener("change", () => this.renderMessages("ai2"));

    // Input changes
    document
      .getElementById("compose-input")
      ?.addEventListener("input", () => this.updateSendButtonState());
    ["send-ai1", "send-ai2", "send-cross"].forEach((id) => {
      document
        .getElementById(id)
        ?.addEventListener("change", () => this.updateSendButtonState());
    });
  }

  async renderMessages(provider) {
    const container = document.getElementById(`messages-${provider}`);
    const select = document.getElementById(`conversation-${provider}`);
    const filter = document.getElementById(`filter-count-${provider}`);
    if (!container) return;
    container.innerHTML = "";
    const selected = select?.selectedOptions?.[0];
    const folder = selected?.dataset?.folder || "";
    if (selected?.value === "new") {
      container.innerHTML =
        '<div class="message-placeholder">Yeni sohbet başlatılıyor...</div>';
      return;
    }
    if (!folder) {
      container.innerHTML =
        '<div class="message-placeholder">Sohbet seçilmedi.</div>';
      return;
    }
    try {
      const base64 = await window.electronAPI?.readFile?.(
        `${folder}/history.json`,
      );
      if (!base64) {
        container.innerHTML =
          '<div class="message-placeholder">Mesaj bulunamadı.</div>';
        return;
      }
      const json = JSON.parse(this.decodeBase64(base64));
      let items = Array.isArray(json) ? json : [];
      const limitVal = filter?.value;
      if (limitVal && limitVal !== "all") {
        const n = parseInt(limitVal, 10);
        if (!Number.isNaN(n)) {
          items = items.slice(-n);
        }
      }
      items.forEach((msg) => {
        const bubble = document.createElement("div");
        bubble.className = `msg-bubble ${msg.role === "assistant" ? "msg-ai" : "msg-user"}`;
        const meta = document.createElement("div");
        meta.className = "msg-meta";
        meta.textContent = msg.author || msg.role || "";
        const text = document.createElement("div");
        text.className = "msg-text";
        text.textContent = msg.text || "";
        bubble.appendChild(meta);
        bubble.appendChild(text);
        if (
          Array.isArray(msg.attachments) &&
          msg.attachments.length &&
          msg.role !== "assistant"
        ) {
          const attWrap = document.createElement("div");
          attWrap.className = "msg-attachments";
          msg.attachments.forEach((att) => {
            const link = document.createElement("button");
            link.className = "attachment-link";
            link.textContent = att.name || att.renamedName || "dosya";
            link.addEventListener("click", async () => {
              const targetPath =
                att.path ||
                (folder ? `${folder}/${att.renamedName || att.name}` : "");
              if (!targetPath) return;
              try {
                const res = await window.electronAPI?.openPath?.(targetPath);
                if (!res?.success) {
                  throw new Error(res?.message || "açılamadı");
                }
              } catch (err) {
                LogManager.addEvent(
                  "analyze",
                  "warning",
                  `Ek açılamadı: ${err.message}`,
                );
              }
            });
            attWrap.appendChild(link);
          });
          bubble.appendChild(attWrap);
        }
        bubble.addEventListener("contextmenu", (e) =>
          this.showContextMenu(e, { provider, text: msg.text || "" }),
        );
        bubble.addEventListener("dblclick", () =>
          this.showReadModal({ provider, text: msg.text || "" }),
        );
        container.appendChild(bubble);
      });
      if (!items.length) {
        container.innerHTML =
          '<div class="message-placeholder">Mesaj bulunamadı.</div>';
      }
      const lastAssistant = [...items]
        .reverse()
        .find((m) => m.role === "assistant" && (m.text || "").trim());
      this.lastMessages[provider] = lastAssistant?.text || "";
      container.scrollTop = container.scrollHeight;
    } catch (err) {
      container.innerHTML =
        '<div class="message-placeholder">Mesajlar okunamadı.</div>';
    }
  }

  decodeBase64(data) {
    try {
      const binary = atob(data);
      const bytes = new Uint8Array(binary.length);
      for (let i = 0; i < binary.length; i++) {
        bytes[i] = binary.charCodeAt(i);
      }
      const decoder = new TextDecoder("utf-8");
      return decoder.decode(bytes);
    } catch (err) {
      return "";
    }
  }

  async refreshUploads() {
    this.renderUploadList();
  }

  handleUploadClick() {
    this.addUploadFile();
  }

  renderUploadList() {
    const box = document.getElementById("upload-list");
    const info = document.querySelector(".files-header div");
    if (!box) return;
    box.innerHTML = "";
    if (!this.stagedFiles.length) {
      box.textContent = "Henüz dosya yok.";
      if (info) info.textContent = "Henüz dosya yok.";
      return;
    }
    if (info) info.textContent = `${this.stagedFiles.length} dosya eklendi.`;
    this.stagedFiles.forEach((file) => {
      const row = document.createElement("div");
      row.className = "upload-item";
      const name = document.createElement("span");
      name.textContent = file.name;
      const btn = document.createElement("button");
      btn.className = "upload-remove";
      btn.textContent = "×";
      btn.title = "Kaldır";
      btn.addEventListener("click", () => this.removeUploadFile(file.name));
      row.appendChild(name);
      row.appendChild(btn);
      box.appendChild(row);
    });
    this.updateSendButtonState();
  }

  async addUploadFile() {
    try {
      const selection = await window.electronAPI?.showOpenDialog?.({
        properties: ["openFile", "multiSelections"],
      });
      if (!selection) return;
      let paths = [];
      if (typeof selection === "string") {
        paths = [selection];
      } else if (Array.isArray(selection)) {
        paths = selection;
      } else if (selection && Array.isArray(selection.filePaths)) {
        paths = selection.filePaths;
      } else if (selection && typeof selection.path === "string") {
        paths = [selection.path];
      } else {
        paths = [];
      }
      if (!paths.length) return;
      const newEntries = paths.map((p) => {
        const parts = String(p).split(/[/\\]/);
        const name = parts.pop() || "dosya";
        return { name, path: p };
      });
      this.stagedFiles.push(...newEntries);
      this.renderUploadList();
    } catch (err) {
      /* noop */
    }
  }

  async removeUploadFile(name) {
    this.stagedFiles = this.stagedFiles.filter((f) => f.name !== name);
    this.renderUploadList();
  }
  initContextMenu() {
    this.contextMenu = document.createElement("div");
    this.contextMenu.className = "msg-context hidden";
    this.contextMenu.innerHTML = `
      <button data-action="read">Okuma modu</button>
      <button data-action="prepend">Mesajın başına ekle</button>
      <button data-action="append">Mesajın sonuna ekle</button>
    `;
    document.body.appendChild(this.contextMenu);
    document.addEventListener("click", () => this.hideContextMenu());
  }

  initReadModal() {
    this.readModal = document.getElementById("read-modal");
    const closeBtn = document.getElementById("read-modal-close");
    closeBtn?.addEventListener("click", () => this.hideReadModal());
  }

  showContextMenu(event, payload) {
    event.preventDefault();
    if (!this.contextMenu) return;
    this.contextMenu.dataset.provider = payload.provider;
    this.contextMenu.dataset.text = payload.text || "";
    this.contextMenu.style.left = `${event.pageX}px`;
    this.contextMenu.style.top = `${event.pageY}px`;
    this.contextMenu.classList.remove("hidden");
    this.contextMenu.querySelectorAll("button").forEach((btn) => {
      btn.onclick = (e) => {
        const action = e.currentTarget.dataset.action;
        this.handleContextAction(action, payload);
        this.hideContextMenu();
      };
    });
  }

  hideContextMenu() {
    this.contextMenu?.classList.add("hidden");
  }

  handleContextAction(action, payload) {
    if (action === "read") {
      this.showReadModal(payload);
      return;
    }
    if (action === "prepend" || action === "append") {
      const textarea = document.getElementById("compose-input");
      if (!textarea) return;
      const nickname = AppState.getNickname(payload.provider);
      const prefix = `${nickname} : `;
      const current = textarea.value || "";
      const newVal =
        action === "prepend"
          ? `${prefix}${payload.text}\n${current}`.trim()
          : `${current}\n${prefix}${payload.text}`.trim();
      textarea.value = newVal;
    }
  }

  showReadModal(payload) {
    if (!this.readModal) return;
    const body = document.getElementById("read-modal-body");
    if (body) {
      body.textContent = payload.text || "";
      body.scrollTop = 0;
    }
    this.readModal.classList.remove("hidden");
  }

  hideReadModal() {
    this.readModal?.classList.add("hidden");
  }

  async onShow() {
    await this.refreshUploads();
    this.updateSendButtonState();
  }

  getConversationFolder(provider) {
    const select = document.getElementById(`conversation-${provider}`);
    const opt = select?.selectedOptions?.[0];
    const folder = opt?.dataset?.folder || "";
    if (!folder || opt?.value === "new") return "";
    return folder;
  }

  handleSend() {
    const msg = (document.getElementById("compose-input")?.value || "").trim();
    const hasFiles = (this.stagedFiles || []).length > 0;
    const sendAi1 = document.getElementById("send-ai1")?.checked;
    const sendAi2 = document.getElementById("send-ai2")?.checked;
    const cross = document.getElementById("send-cross")?.checked;
    if ((!sendAi1 && !sendAi2) || (!msg && !hasFiles)) {
      return;
    }
    this.updateSendButtonState();
    LogManager.addEvent("analyze", "info", "Gönderim başlatılıyor");
    const humanName = AppState.getNickname("human");
    const ts = this.formatTimestamp();
    const userLine = msg ? `${humanName} : ${msg} [${ts}]` : "";
    const targets = [];
    const textByProvider = {};
    const archiveFolders = {};
    if (sendAi1) {
      let text = userLine;
      if (cross && sendAi2) {
        const otherName = AppState.getNickname("ai2");
        const otherMsg = (this.lastMessages.ai2 || "").trim();
        const prefixLine = otherMsg ? `${otherName} : ${otherMsg}` : "";
        text = prefixLine ? `${prefixLine} | ${userLine}` : userLine;
      }
      textByProvider.ai1 = text;
      targets.push("ai1");
      archiveFolders.ai1 = this.getConversationFolder("ai1");
    }
    if (sendAi2) {
      let text = userLine;
      if (cross && sendAi1) {
        const otherName = AppState.getNickname("ai1");
        const otherMsg = (this.lastMessages.ai1 || "").trim();
        const prefixLine = otherMsg ? `${otherName} : ${otherMsg}` : "";
        text = prefixLine ? `${prefixLine} | ${userLine}` : userLine;
      }
      textByProvider.ai2 = text;
      targets.push("ai2");
      archiveFolders.ai2 = this.getConversationFolder("ai2");
    }

    const texts = targets.map((p) => textByProvider[p] || userLine);
    const allSame = texts.every((t) => t === texts[0]);
    const sendFlow = async () => {
      const attachList = [...this.stagedFiles];
      if (allSame) {
        await CoreEngine.sendBatch({
          targets,
          text: texts[0],
          attachments: attachList,
          page: "analyze",
          archiveFolders,
        });
      } else {
        for (const provider of targets) {
          await CoreEngine.sendBatch({
            targets: [provider],
            text: textByProvider[provider],
            attachments: attachList,
            page: "analyze",
            archiveFolders,
          });
        }
      }
    };
    sendFlow().finally(() => {
      this.stagedFiles = [];
      this.renderUploadList();
      this.updateSendButtonState();
      const composeInput = document.getElementById("compose-input");
      if (composeInput) composeInput.value = "";
    });
  }

  async handleAnalyzeStart() {
    const targets = this.getConnectedAIs();
    if (!targets.length) {
      LogManager.addEvent(
        "analyze",
        "warning",
        "Analiz protokolü gönderilemedi: bağlı AI yok",
      );
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
    const targets = this.getConnectedAIs();
    const btn = document.getElementById("ai-chat-start");
    const nickAi1 = AppState.getNickname("ai1");
    const nickAi2 = AppState.getNickname("ai2");
    if (targets.length < 2) {
      LogManager.addEvent(
        "analyze",
        "warning",
        "AI-AI başlatılamadı: iki AI bağlı değil",
      );
      return;
    }
    const relayActive = !!(
      CoreEngine.relay &&
      CoreEngine.relay.isActive &&
      CoreEngine.relay.isActive()
    );
    if (relayActive) {
      await CoreEngine.sendProtocol({
        room: "analyze",
        scenario: "ai-ai-stop",
        targets,
      });
      if (btn) btn.textContent = `${nickAi1} - ${nickAi2} Sohbet Başlat`;
      return;
    }

    const starter =
      document.querySelector('input[name="relay-starter"]:checked')?.value ||
      "ai1";

    await CoreEngine.sendProtocol({
      room: "analyze",
      scenario: "ai-ai",
      targets,
      mode: "aiRelaySequential",
      context: { starter },
    });
    if (btn) btn.textContent = `${nickAi1} - ${nickAi2} Sohbet Bitir`;
  }

  getConnectedAIs() {
    const list = [];
    if (AppState.getConnection("ai1")) list.push("ai1");
    if (AppState.getConnection("ai2")) list.push("ai2");
    return list;
  }

  formatTimestamp() {
    const d = new Date();
    const parts = d.toLocaleString("tr-TR", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });
    return parts;
  }

  updateSendButtonState() {
    const btn = document.getElementById("compose-send-btn");
    if (!btn) return;
    const connectedHuman = AppState.getConnection("human");
    const sendAi1 = document.getElementById("send-ai1")?.checked;
    const sendAi2 = document.getElementById("send-ai2")?.checked;
    const cross = document.getElementById("send-cross");
    const bothSelected = !!sendAi1 && !!sendAi2;
    if (cross) {
      cross.disabled = !connectedHuman || !bothSelected;
      if (!bothSelected) cross.checked = false;
    }

    const hasTarget = !!sendAi1 || !!sendAi2;
    const message = (
      document.getElementById("compose-input")?.value || ""
    ).trim();
    const hasFiles = (this.stagedFiles || []).length > 0;
    const hasContent = !!message || hasFiles;

    btn.disabled = !connectedHuman || !hasTarget || !hasContent;
  }

  async initDraft() {
    try {
      const dirs = await FileManager.ensureDirs("archives");
      const baseDir = dirs?.archives || FileManager.getPath?.("archives") || "";
      if (!baseDir) return;
      this.draftPath = `${baseDir}/analyze-draft.json`;
      await this.loadDraft();
    } catch (err) {
      LogManager.addEvent(
        "analyze",
        "warning",
        `Draft yolu hazırlanamadı: ${err.message}`,
      );
    }
  }

  async loadDraft() {
    if (!this.draftPath || !window.electronAPI?.readFile) return;
    try {
      const base64 = await window.electronAPI.readFile(this.draftPath);
      if (!base64) return;
      const text = this.decodeBase64(base64);
      const parsed = JSON.parse(text || "{}");
      const msg = parsed.message || "";
      const files = Array.isArray(parsed.files) ? parsed.files : [];
      const textarea = document.getElementById("compose-input");
      if (textarea) textarea.value = msg;
      this.stagedFiles = files;
      this.renderUploadList();
    } catch (err) {
      LogManager.addEvent(
        "analyze",
        "warning",
        `Draft okunamadı: ${err.message}`,
      );
    }
  }

  async persistDraft() {
    if (!this.draftPath) return;
    try {
      const composeInput = document.getElementById("compose-input");
      const message = composeInput ? composeInput.value : "";
      const payload = { message, files: this.stagedFiles || [] };
      const json = JSON.stringify(payload, null, 2);
      await FileManager.writeFileAtomic(this.draftPath, json, "utf-8");
    } catch (err) {
      LogManager.addEvent(
        "analyze",
        "warning",
        `Draft yazılamadı: ${err.message}`,
      );
    }
  }


  onHide() {
    try {
      this._unsubSettings?.();
      this._unsubSettings = null;
    } catch (_) {
      void 0;
    }
    try {
      this.persistDraft();
    } catch (_) {
      void 0;
    }
    if (this.beforeUnloadHandler) {
      window.removeEventListener("beforeunload", this.beforeUnloadHandler);
      this.beforeUnloadHandler = null;
    }
  }
}
