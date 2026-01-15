import { LogManager } from "../../modules/log-manager.js";
import { SettingsManager } from "../../modules/settings-manager.js";
import { AppState } from "../../modules/app-state.js";
import { CoreEngine } from "../../modules/core-engine.js";
import { SlotController, SlotEvent } from "../../modules/slot-controller.js";
import { getMimeTypeFromPath } from "../../constants/index.js";

import { UserPanel } from "./user-panel.js";
import { SlotPanel } from "./slot-panel.js";
import { AccountPanel } from "./account-panel.js";
import { WhisperPanel } from "./whisper-panel.js";

export class EntranceHallController {
  constructor() {
    this.defaultsApplied = false;
    
    // Sub-controllers
    this.userPanel = new UserPanel(SettingsManager);
    this.slotPanelAi1 = new SlotPanel("ai1", SettingsManager);
    this.slotPanelAi2 = new SlotPanel("ai2", SettingsManager);
    this.accountPanel = new AccountPanel(SettingsManager);
    this.whisperPanel = new WhisperPanel();
  }

  async init() {
    // Init sub-controllers
    this.userPanel.init();
    this.slotPanelAi1.init();
    this.slotPanelAi2.init();
    this.accountPanel.init();
    this.whisperPanel.init();

    this.setupEventListeners();
    await this.loadUserSettings();
    await this.applyDefaultConnections();
    this.updateUI();

    // Global listeners
    if (!this._unsubSettings) {
      this._unsubSettings = SettingsManager.subscribe(
        ({ settings, changedPaths }) => {
          this.applySettingsToUI(settings, changedPaths);
          
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
      console.error("Error setting up EntranceHall event listeners:", error);
    }
  }

  async loadUserSettings() {
    try {
      const settings = await SettingsManager.load();
      this.applySettingsToUI(settings, ["*"]);
    } catch (error) {
      console.error("Error loading user settings:", error);
    }
  }

  applySettingsToUI(settings, _changedPaths = []) {
    if (!settings) settings = SettingsManager.getSnapshot();

    const userNickname = AppState.getNickname("user");
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
      console.error(`Error loading avatar for ${userType}:`, error);
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
      this.updateUserStatus(userType, false);
      LogManager.addEvent("entrance", "warning", `${userType} connect blocked: no account assigned`);
      return;
    }

    await CoreEngine.setConnection(userType, true);
    this.updateUserStatus(userType);
    LogManager.addEvent("entrance", "success", `${nickname} bağlandı`);
  }

  async disconnectUser(userType) {
    if (userType === "user") return;
    const currentlyConnected = SlotController.isConnected(userType);
    if (!currentlyConnected) return;

    const nickname = AppState.getNickname(userType);
    LogManager.addEvent("entrance", "info", `${nickname} bağlantısı kesiliyor...`);

    if (userType !== "user") {
      await CoreEngine.setConnection(userType, false);
    }

    this.updateUserStatus(userType);
    LogManager.addEvent("entrance", "success", `${nickname} bağlantısı kesildi`);
  }

  async updateUserStatus(userType) {
    const settings = SettingsManager.getSnapshot();
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
      if (!hasAccount) {
        toggleBtn.textContent = "Hesap Seçin";
        toggleBtn.disabled = true;
      } else if (connected) {
        toggleBtn.textContent = "Bağlantıyı Kes";
        toggleBtn.disabled = false;
        toggleBtn.classList.remove("btn-primary");
        toggleBtn.classList.add("btn-secondary");
      } else {
        toggleBtn.textContent = "Bağlan";
        toggleBtn.disabled = false;
        toggleBtn.classList.remove("btn-secondary");
        toggleBtn.classList.add("btn-primary");
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
    } catch (e) {
      // ignore
    }
    this.defaultsApplied = true;
  }
}
