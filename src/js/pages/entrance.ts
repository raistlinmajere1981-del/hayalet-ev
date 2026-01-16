import { LogManager } from "../modules/log-manager.js";
import { SettingsManager } from "../modules/settings-manager.js";
import { AppState } from "../modules/app-state.js";
import { CoreEngine } from "../modules/core-engine.js";
import { SlotController, SlotEvent } from "../modules/slot-controller.js";
import { TrafficManager } from "../modules/traffic-manager.js";
import { getMimeTypeFromPath } from "../constants/index.js";

import { UserPanel } from "./entrance/user-panel.js";
import { SlotPanel } from "./entrance/slot-panel.js";
import { AccountPanel } from "./entrance/account-panel.js";
import { WhisperPanel } from "./entrance/whisper-panel.js";
import { WebviewPanel } from "./entrance/webview-panel.js";

export class EntranceHallController {
  defaultsApplied: boolean;
  userPanel: UserPanel;
  slotPanelAi1: SlotPanel;
  slotPanelAi2: SlotPanel;
  accountPanel: AccountPanel;
  whisperPanel: WhisperPanel;
  webviewPanel: WebviewPanel;
  _unsubSettings: (() => void) | null = null;
  _unsubSlotController: (() => void) | null = null;

  constructor() {
    this.defaultsApplied = false;
    
    // Sub-controllers
    this.userPanel = new UserPanel(SettingsManager);
    this.slotPanelAi1 = new SlotPanel("ai1", SettingsManager);
    this.slotPanelAi2 = new SlotPanel("ai2", SettingsManager);
    this.accountPanel = new AccountPanel(SettingsManager);
    this.whisperPanel = new WhisperPanel();
    this.webviewPanel = new WebviewPanel();
  }

  async init() {
    // Init sub-controllers
    this.userPanel.init();
    this.slotPanelAi1.init();
    this.slotPanelAi2.init();
    this.accountPanel.init();
    this.whisperPanel.init();
    this.webviewPanel.init();

    this.setupEventListeners();
    await this.loadUserSettings();
    await this.applyDefaultConnections();
    this.updateUI();
    
    // Setup webviews
    await this.webviewPanel.setupWebviews();
    this.webviewPanel.applyGating(SettingsManager.getSnapshot(), ["*"]);
    this.webviewPanel.updateUrlDisplay("ai1", TrafficManager.state.ai1);
    this.webviewPanel.updateUrlDisplay("ai2", TrafficManager.state.ai2);
    this.webviewPanel.subscribeToTraffic();

    // Global listeners
    if (!this._unsubSettings) {
      this._unsubSettings = SettingsManager.subscribe(
        ({ settings, changedPaths }) => {
          this.applySettingsToUI(settings, changedPaths);
          this.webviewPanel.applyGating(settings, changedPaths);
          
          // Re-render sub-panels if needed
          if (changedPaths.includes("*") || changedPaths.some(p => p.startsWith("accounts"))) {
            this.accountPanel.render();
            this.slotPanelAi1.render();
            this.slotPanelAi2.render();
          }
          if (changedPaths.includes("*") || changedPaths.some(p => p.startsWith("user"))) {
            this.userPanel.render();
          }
        },
      );
    }

    if (!this._unsubSlotController) {
      this._unsubSlotController = SlotController.on(SlotEvent.STATE_CHANGED, () => {
        this.updateUI();
        this.webviewPanel.applyGating(SettingsManager.getSnapshot(), ["*"]);
      });
    }
  }

  setupEventListeners() {
    try {
      ["ai1", "ai2"].forEach((u) => {
        const btn = document.getElementById(`${u}-toggle-btn`);
        if (btn) {
          btn.addEventListener("click", async () => {
            if (SlotController.isConnected(u)) await this.disconnectUser(u);
            else await this.connectUser(u);
          });
        }
      });
    } catch (error) {
      LogManager.addEvent("entrance", "error", `Event listener setup hatası: ${error.message}`);
    }
  }

  async loadUserSettings() {
    try {
      const settings = await SettingsManager.load();
      this.applySettingsToUI(settings, ["*"]);
    } catch (error) {
      LogManager.addEvent("entrance", "error", `Settings yükleme hatası: ${error.message}`);
    }
  }

  applySettingsToUI(settings, _changedPaths = []) {
    if (!settings) settings = SettingsManager.getSnapshot();

    const ai1Nickname = AppState.getNickname("ai1");
    const ai2Nickname = AppState.getNickname("ai2");

    // Nicknames are now handled by UserPanel/SlotPanel render mostly, 
    // but the card headers might need direct update
    const ai1NickEl = document.getElementById("ai1-nickname");
    const ai2NickEl = document.getElementById("ai2-nickname");

    if (ai1NickEl) ai1NickEl.textContent = ai1Nickname;
    if (ai2NickEl) ai2NickEl.textContent = ai2Nickname;

    const getAvatar = (provider) => AppState.getAvatar(provider);
    this.updateAvatar("user", getAvatar("user"));
    this.updateAvatar("ai1", getAvatar("ai1"));
    this.updateAvatar("ai2", getAvatar("ai2"));

    this.updateUI();
  }

  async updateAvatar(userType, avatarPath) {
    const avatarElement = document.getElementById(`${userType}-avatar`);
    if (!avatarElement) return;

    if (!avatarPath) {
      avatarElement.innerHTML = "";
      avatarElement.style.backgroundImage = "";
      return;
    }

    try {
      if (window.electronAPI?.readFile) {
        const imageData = await window.electronAPI.readFile(avatarPath);
        if (imageData) {
          const mimeType = getMimeTypeFromPath(avatarPath);
          avatarElement.innerHTML = ``;
          avatarElement.style.backgroundImage = `url(data:${mimeType};base64,${imageData})`;
        }
      }
    } catch (error) {
      LogManager.addEvent("entrance", "error", `Avatar yükleme hatası: ${error.message}`, { context: { userType } });
    }
  }

  async connectUser(userType) {
    const settings = await SettingsManager.load();
    const currentlyConnected = SlotController.isConnected(userType);

    if (currentlyConnected) return;
    if (userType === "user") return;

    const nickname = AppState.getNickname(userType);
    LogManager.addEvent("entrance", "info", `${nickname} bağlanıyor...`);

    const hasAccount = !!settings?.slots?.[userType]?.accountId;
    if (!hasAccount) {
      this.updateUserStatus(userType);
      LogManager.addEvent("entrance", "warning", `${userType} connect blocked: no account assigned`);
      return;
    }

    const result = await CoreEngine.setConnection(userType, true, {});
    this.updateUserStatus(userType);
    
    if (result?.success) {
      LogManager.addEvent("entrance", "success", `${nickname} bağlandı`);
    } else {
      LogManager.addEvent("entrance", "error", `${nickname} bağlantı hatası: ${result?.message || "bilinmeyen"}`);
    }
  }

  async disconnectUser(userType) {
    if (userType === "user") return;
    const currentlyConnected = SlotController.isConnected(userType);
    if (!currentlyConnected) return;

    const nickname = AppState.getNickname(userType);
    LogManager.addEvent("entrance", "info", `${nickname} bağlantısı kesiliyor...`);

    const result = await CoreEngine.setConnection(userType, false, {});
    this.updateUserStatus(userType);
    
    if (result?.success) {
      LogManager.addEvent("entrance", "success", `${nickname} bağlantısı kesildi`);
    } else {
      LogManager.addEvent("entrance", "error", `${nickname} bağlantı kesme hatası: ${result?.message || "bilinmeyen"}`);
    }
  }

  async updateUserStatus(userType) {
    const statusDot = document.getElementById(`${userType}-status-dot`);
    const statusText = document.getElementById(`${userType}-status-text`);
    const toggleBtn = document.getElementById(`${userType}-toggle-btn`);
    const avatarEl = document.getElementById(`${userType}-avatar`);

    if (userType === "user") {
        // User always "connected" in UI context
        if (avatarEl) avatarEl.style.opacity = "1";
        return;
    }

    const hasAccount = !!AppState.getAccountForSlot(userType);
    const connected = SlotController.isConnected(userType);

    if (avatarEl) {
      avatarEl.style.opacity = hasAccount && !connected ? "0.5" : "1";
    }

    if (statusDot) {
      if (!hasAccount) {
        statusDot.classList.remove("connected");
        statusDot.style.backgroundColor = "#999";
      } else if (connected) {
        statusDot.classList.add("connected");
        statusDot.style.backgroundColor = "#4CAF50";
      } else {
        statusDot.classList.remove("connected");
        statusDot.style.backgroundColor = "#FFA726";
      }
    }

    if (statusText) {
      statusText.textContent = !hasAccount ? "Hesap yok" : (connected ? "Bağlı" : "Bağlı değil");
    }

    if (toggleBtn) {
      const btn = toggleBtn as HTMLButtonElement;
      if (!hasAccount) {
        btn.textContent = "Hesap Seçin";
        btn.disabled = true;
      } else if (connected) {
        btn.textContent = "Bağlantıyı Kes";
        btn.disabled = false;
        btn.classList.remove("btn-primary");
        btn.classList.add("btn-secondary");
      } else {
        btn.textContent = "Bağlan";
        btn.disabled = false;
        btn.classList.remove("btn-secondary");
        btn.classList.add("btn-primary");
      }
    }
  }

  async updateUI() {
    ["user", "ai1", "ai2"].forEach((userType) => {
      this.updateUserStatus(userType);
    });
    this.whisperPanel.render();
  }

  async onShow() {
    CoreEngine.pauseWhispers();
    await this.loadUserSettings();
    this.updateUI();
  }

  onHide() {
    CoreEngine.resumeWhispers(true);
  }

  async applyDefaultConnections() {
    if (this.defaultsApplied) return;
    try {
      await CoreEngine.setConnection("ai1", false, { force: true });
      await CoreEngine.setConnection("ai2", false, { force: true });
    } catch (_e) {
      // Başlangıç bağlantı durumu ayarlanamadı - kritik değil
    }
    this.defaultsApplied = true;
  }
}
