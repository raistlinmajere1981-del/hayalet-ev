import { LogManager } from "../modules/log-manager.js";
import { getErrorMessage } from "../types/index.js";
import { SettingsManager } from "../modules/settings-manager.js";
import type { AppSettings } from "../types/settings.js";
import { AppState } from "../modules/app-state.js";
import { CoreEngine } from "../modules/core-engine.js";
import { SlotController, SlotEvent } from "../modules/slot-controller.js";
import { TrafficManager } from "../modules/traffic-manager.js";
import { getMimeTypeFromPath } from "../constants/index.js";
import { ButtonStates } from "../ui/button-states.js";

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
    this.setupReportPanel();
    await this.loadUserSettings();
    await this.applyDefaultConnections();
    this.updateUI();
    
    // Setup webviews
    await this.webviewPanel.setupWebviews();
    this.webviewPanel.applyGating(SettingsManager.getSnapshot(), ["*"]);
    this.webviewPanel.updateUrlDisplay("ai1", TrafficManager.state.ai1 as Record<string, unknown>);
    this.webviewPanel.updateUrlDisplay("ai2", TrafficManager.state.ai2 as Record<string, unknown>);
    this.webviewPanel.subscribeToTraffic();

    // Global listeners
    if (!this._unsubSettings) {
      this._unsubSettings = SettingsManager.subscribe(
        ({ settings, changedPaths }: { settings: unknown; changedPaths: string[] }) => {
          const typedSettings = settings as AppSettings;
          this.applySettingsToUI(typedSettings, changedPaths);
          this.webviewPanel.applyGating(typedSettings, changedPaths);
          
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
      // Slot connect/disconnect buttons
      ["ai1", "ai2"].forEach((u) => {
        const btn = document.getElementById(`${u}-toggle-btn`);
        if (btn) {
          btn.addEventListener("click", async () => {
            if (SlotController.isConnected(u)) await this.disconnectUser(u);
            else await this.connectUser(u);
          });
        }
      });

      // Settings accordion toggle
      const accordionToggle = document.getElementById("settings-accordion-toggle");
      const accordionContent = document.getElementById("settings-accordion-content");
      if (accordionToggle && accordionContent) {
        accordionToggle.addEventListener("click", () => {
          const isOpen = accordionContent.classList.contains("open");
          accordionContent.classList.toggle("open");
          accordionToggle.setAttribute("aria-expanded", String(!isOpen));
        });
      }
    } catch (error) {
      LogManager.addEvent("entrance", "error", `Event listener setup hatası: ${getErrorMessage(error)}`);
    }
  }

  setupReportPanel() {
    // Report modal açma butonu
    const reportModalOpen = document.getElementById("report-modal-open");
    const modal = document.getElementById("report-modal");
    const modalBody = document.getElementById("report-modal-body");
    const modalClose = document.getElementById("report-modal-close");
    const entranceReportContent = document.getElementById("entrance-report-content");

    const createLogElement = (entry: { timestamp: string; source: string; message: string; visibility?: number }, showVisibility = false) => {
      const line = document.createElement("div");
      line.className = "log-entry";
      const visibilityBadge = showVisibility ? `[L${entry.visibility || 3}] ` : "";
      line.textContent = `[${entry.timestamp}] ${visibilityBadge}[${entry.source}] ${entry.message}`;
      if (entry.visibility === 1) line.classList.add("log-toast");
      else if (entry.visibility === 2) line.classList.add("log-panel");
      return line;
    };

    const openModal = () => {
      if (!modal || !modalBody) return;
      modalBody.innerHTML = "";
      const all = LogManager.getVerboseLogs();
      [...all].reverse().forEach((entry) => {
        modalBody.appendChild(createLogElement(entry, true));
      });
      modal.classList.remove("hidden");
    };

    const closeModal = () => modal?.classList.add("hidden");

    reportModalOpen?.addEventListener("click", openModal);
    modal?.addEventListener("click", (e) => { if (e.target === modal) closeModal(); });
    modalClose?.addEventListener("click", closeModal);

    // Başlangıçta panel loglarını yükle
    if (entranceReportContent) {
      entranceReportContent.innerHTML = "";
      const panelLogs = LogManager.getPanelLogs();
      [...panelLogs].reverse().forEach((entry) => {
        entranceReportContent.appendChild(createLogElement(entry));
      });
    }

    // Canlı log dinleyicisi
    LogManager.onUpdate((entry) => {
      // Panel: Sadece visibility 1 ve 2
      if (entranceReportContent && entry.visibility <= 2) {
        const logEntry = createLogElement(entry);
        if (entranceReportContent.firstChild) {
          entranceReportContent.insertBefore(logEntry, entranceReportContent.firstChild);
        } else {
          entranceReportContent.appendChild(logEntry);
        }
      }

      // Modal: Tüm loglar - açıksa canlı güncelle
      if (modalBody && !modal?.classList.contains("hidden")) {
        const modalLine = createLogElement(entry, true);
        if (modalBody.firstChild) {
          modalBody.insertBefore(modalLine, modalBody.firstChild);
        } else {
          modalBody.appendChild(modalLine);
        }
      }
    });
  }

  async loadUserSettings() {
    try {
      const settings = await SettingsManager.load();
      this.applySettingsToUI(settings, ["*"] as string[]);
    } catch (error) {
      LogManager.addEvent("entrance", "error", `Settings yükleme hatası: ${getErrorMessage(error)}`);
    }
  }

  applySettingsToUI(settings: AppSettings, _changedPaths: string[] = []) {
    if (!settings) settings = SettingsManager.getSnapshot();

    const ai1Nickname = AppState.getNickname("ai1");
    const ai2Nickname = AppState.getNickname("ai2");

    // Nicknames are now handled by UserPanel/SlotPanel render mostly, 
    // but the card headers might need direct update
    const ai1NickEl = document.getElementById("ai1-nickname");
    const ai2NickEl = document.getElementById("ai2-nickname");

    if (ai1NickEl) ai1NickEl.textContent = ai1Nickname;
    if (ai2NickEl) ai2NickEl.textContent = ai2Nickname;

    const getAvatar = (provider: string) => AppState.getAvatar(provider);
    this.updateAvatar("user", getAvatar("user"));
    this.updateAvatar("ai1", getAvatar("ai1"));
    this.updateAvatar("ai2", getAvatar("ai2"));

    this.updateUI();
  }

  async updateAvatar(userType: string, avatarPath: string | null) {
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
      LogManager.addEvent("entrance", "error", `Avatar yükleme hatası: ${getErrorMessage(error)}`, { context: { userType } });
    }
  }

  async connectUser(userType: string) {
    const settings = await SettingsManager.load();
    const currentlyConnected = SlotController.isConnected(userType);

    if (currentlyConnected) return;
    if (userType === "user") return;

    const toggleBtn = document.getElementById(`${userType}-toggle-btn`) as HTMLButtonElement | null;
    const nickname = AppState.getNickname(userType);
    
    // Loading state
    if (toggleBtn) {
      ButtonStates.setLoading(toggleBtn, "Bağlanıyor...");
    }
    
    LogManager.addEvent("entrance", "info", `${nickname} bağlanıyor...`, { showToast: false });

    const hasAccount = !!settings?.slots?.[userType]?.accountId;
    if (!hasAccount) {
      if (toggleBtn) {
        ButtonStates.setError(toggleBtn, "Hesap Yok!", 1500);
      }
      this.updateUserStatus(userType);
      LogManager.addEvent("entrance", "warning", `${userType} connect blocked: no account assigned`);
      return;
    }

    const result = await CoreEngine.setConnection(userType, true, {});
    
    if (result?.success) {
      if (toggleBtn) {
        ButtonStates.setSuccess(toggleBtn, "Bağlandı!", 1500);
      }
      LogManager.addEvent("entrance", "success", `${nickname} bağlandı`, { visibility: 1 });
    } else {
      if (toggleBtn) {
        ButtonStates.setError(toggleBtn, "Hata!", 1500);
      }
      LogManager.addEvent("entrance", "error", `${nickname} bağlantı hatası: ${result?.message || "bilinmeyen"}`, { visibility: 1 });
    }
    
    // UI'ı güncelle (buton normal haline döner)
    setTimeout(() => this.updateUserStatus(userType), 1600);
  }

  async disconnectUser(userType: string) {
    if (userType === "user") return;
    const currentlyConnected = SlotController.isConnected(userType);
    if (!currentlyConnected) return;

    const toggleBtn = document.getElementById(`${userType}-toggle-btn`) as HTMLButtonElement | null;
    const nickname = AppState.getNickname(userType);
    
    // Loading state
    if (toggleBtn) {
      ButtonStates.setLoading(toggleBtn, "Kesiliyor...");
    }
    
    LogManager.addEvent("entrance", "info", `${nickname} bağlantısı kesiliyor...`, { showToast: false });

    const result = await CoreEngine.setConnection(userType, false, {});
    
    if (result?.success) {
      if (toggleBtn) {
        ButtonStates.setSuccess(toggleBtn, "Kesildi!", 1500);
      }
      LogManager.addEvent("entrance", "success", `${nickname} bağlantısı kesildi`);
    } else {
      if (toggleBtn) {
        ButtonStates.setError(toggleBtn, "Hata!", 1500);
      }
      LogManager.addEvent("entrance", "error", `${nickname} bağlantı kesme hatası: ${result?.message || "bilinmeyen"}`, { visibility: 1 });
    }
    
    // UI'ı güncelle (buton normal haline döner)
    setTimeout(() => this.updateUserStatus(userType), 1600);
  }

  async updateUserStatus(userType: string) {
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
    // NOT: Bu fonksiyon artık gereksiz. SlotController.init() içindeki
    // syncWithSettings() zaten tüm slotları doğru state'e getiriyor.
    // Çift disconnect çağrısını önlemek için bu fonksiyon devre dışı.
    // 
    // Eski kod referans için:
    // await CoreEngine.setConnection("ai1", false, { force: true });
    // await CoreEngine.setConnection("ai2", false, { force: true });
    this.defaultsApplied = true;
  }
}
