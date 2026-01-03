// @ts-nocheck
// Ana salon (Giriş) sayfası controller'ı
import { LogManager } from "../modules/log-manager.js";
import { SettingsManager } from "../modules/settings-manager.js";
import { AppState } from "../modules/app-state.js";
import { CoreEngine } from "../modules/core-engine.js";
import { getAvatarPath } from "../modules/settings-helpers.js";

export class EntranceHallController {
  constructor() {
    this.users = {
      human: { connected: true, nickname: "Kullanıcı" },
      ai1: { connected: true, nickname: "AI1" },
      ai2: { connected: true, nickname: "AI2" },
    };
    this.defaultsApplied = false;
    this.overdueWhispers = [];
    this.whisperListEl = null;
  }

  async init() {
    this.setupEventListeners();
    await this.loadUserSettings();
    await this.applyDefaultConnections();
    this.updateUI();
    this.renderPending();

    // Realtime settings sync (avatar/nickname changes)
    if (!this._unsubSettings) {
      this._unsubSettings = SettingsManager.subscribe(async () => {
        await this.loadUserSettings();
        this.updateUI();
      });
    }
  }

  setupEventListeners() {
    try {
      ["human", "ai1", "ai2"].forEach((u) => {
        const btn = document.getElementById(`${u}-toggle-btn`);
        if (btn) {
          btn.addEventListener("click", async () => {
            if (this.users[u].connected) await this.disconnectUser(u);
            else await this.connectUser(u);
          });
        }
      });

      this.whisperListEl = document.getElementById("whisper-pending-list");
      this.whisperListEl?.addEventListener("click", (ev) =>
        this.handleWhisperListClick(ev),
      );
      document
        .getElementById("whisper-clear-btn")
        ?.addEventListener("click", () => {
          this.handleWhisperClear();
          this.renderPending();
        });
    } catch (error) {
      console.error("Error setting up EntranceHall event listeners:", error);
    }
  }

  async loadUserSettings() {
    try {
      const settings = await SettingsManager.load();

      this.users.human.nickname = AppState.getNickname("human");
      this.users.ai1.nickname = AppState.getNickname("ai1");
      this.users.ai2.nickname = AppState.getNickname("ai2");

      document.getElementById("human-nickname").textContent =
        this.users.human.nickname;
      document.getElementById("ai1-nickname").textContent =
        this.users.ai1.nickname;
      document.getElementById("ai2-nickname").textContent =
        this.users.ai2.nickname;

      this.updateAvatar("human", getAvatarPath(settings, "human"));
      this.updateAvatar("ai1", getAvatarPath(settings, "ai1"));
      this.updateAvatar("ai2", getAvatarPath(settings, "ai2"));
    } catch (error) {
      console.error("Error loading user settings:", error);
      this.users.human.nickname = AppState.getNickname("human");
      this.users.ai1.nickname = AppState.getNickname("ai1");
      this.users.ai2.nickname = AppState.getNickname("ai2");

      document.getElementById("human-nickname").textContent =
        this.users.human.nickname;
      document.getElementById("ai1-nickname").textContent =
        this.users.ai1.nickname;
      document.getElementById("ai2-nickname").textContent =
        this.users.ai2.nickname;
    }
  }

  async updateAvatar(userType, avatarPath) {
    if (!avatarPath) return;

    try {
      if (window.electronAPI?.readFile) {
        const imageData = await window.electronAPI.readFile(avatarPath);
        if (imageData) {
          const ext = avatarPath.split(".").pop().toLowerCase();
          const mimeTypes = {
            jpg: "image/jpeg",
            jpeg: "image/jpeg",
            png: "image/png",
            gif: "image/gif",
            webp: "image/webp",
          };
          const mimeType = mimeTypes[ext] || "image/png";

          const avatarElement = document.getElementById(`${userType}-avatar`);
          if (avatarElement) {
            avatarElement.innerHTML = `<img src="data:${mimeType};base64,${imageData}" alt="${userType} avatar" style="width: 100%; height: 100%; object-fit: cover;">`;
          }
        }
      }
    } catch (error) {
      console.error(`Error loading avatar for ${userType}:`, error);
    }
  }

  async connectUser(userType) {
    if (this.users[userType].connected) {
      return;
    }

    const nickname = AppState.getNickname(userType);
    LogManager.addEvent("entrance", "info", `${nickname} bağlanıyor...`);

    if (userType === "human") {
      this.users.human.connected = true;
      this.updateUserStatus("human", true);
      CoreEngine.setConnection("human", true);
      LogManager.addEvent("entrance", "success", "İnsan kullanıcı bağlandı");
      return;
    }

    // AI slots require an assigned account
    const settings = await SettingsManager.load();
    const hasAccount = !!settings?.[userType]?.activeAccountId;
    if (!hasAccount) {
      this.users[userType].connected = false;
      this.updateUserStatus(userType, false);
      CoreEngine.setConnection(userType, false);
      this.showFeedback?.(`${userType.toUpperCase()} için hesap atanmadı`, "warning");
      LogManager.addEvent(
        "entrance",
        "warning",
        `${userType} connect blocked: no account assigned`,
      );
      return;
    }

    this.users[userType].connected = true;
    this.updateUserStatus(userType, true);
    CoreEngine.setConnection(userType, true);
    LogManager.addEvent("entrance", "success", `${nickname} bağlandı`);
  }

  async disconnectUser(userType) {
    if (!this.users[userType].connected) {
      return;
    }

    const nickname = AppState.getNickname(userType);
    LogManager.addEvent(
      "entrance",
      "info",
      `${nickname} bağlantısı kesiliyor...`,
    );

    this.users[userType].connected = false;
    this.updateUserStatus(userType, false);
    CoreEngine.setConnection(userType, false);

    LogManager.addEvent(
      "entrance",
      "success",
      `${nickname} bağlantısı kesildi`,
    );
  }

  updateUserStatus(userType, connected) {
    const statusDot = document.getElementById(`${userType}-status-dot`);
    const statusText = document.getElementById(`${userType}-status-text`);
    const toggleBtn = document.getElementById(`${userType}-toggle-btn`);

    if (connected) {
      statusDot.classList.add("connected");
      statusText.textContent = "Bağlı";
      if (toggleBtn) {
        toggleBtn.textContent = "Bağlantıyı Kes";
        toggleBtn.classList.remove("btn-primary");
        toggleBtn.classList.add("btn-secondary");
      }
    } else {
      statusDot.classList.remove("connected");
      statusText.textContent = "Bağlı Değil";
      if (toggleBtn) {
        toggleBtn.textContent = "Bağlan";
        toggleBtn.classList.remove("btn-secondary");
        toggleBtn.classList.add("btn-primary");
      }
    }
  }

  async updateUI() {
    const settings = await SettingsManager.load();
    
    Object.keys(this.users).forEach((userType) => {
      this.updateUserStatus(userType, this.users[userType].connected);
      
      // Disable connect button for empty AI slots
      if (userType === "ai1" || userType === "ai2") {
        const hasAccount = !!settings?.[userType]?.activeAccountId;
        const toggleBtn = document.getElementById(`${userType}-toggle-btn`);
        if (toggleBtn) {
          toggleBtn.disabled = !hasAccount;
          if (!hasAccount) {
            toggleBtn.title = "Bu slot için hesap atanmadı";
          } else {
            toggleBtn.title = "";
          }
        }
      }
    });
    this.renderPending();
  }

  async renderPending() {
    await this.renderWhispers();
  }

  async renderWhispers() {
    const listEl =
      this.whisperListEl || document.getElementById("whisper-pending-list");
    if (!listEl) return;
    const now = Date.now();
    const chatList = (await CoreEngine.whisper("list", { user: "ai1" })) || [];
    const ai2List = (await CoreEngine.whisper("list", { user: "ai2" })) || [];
    const records = [...chatList, ...ai2List].filter(
      (rec) => !rec.done && (rec.when || 0) <= now,
    );
    this.overdueWhispers = records
      .slice()
      .sort((a, b) => (a.when || 0) - (b.when || 0));
    listEl.innerHTML = "";
    if (!this.overdueWhispers.length) {
      listEl.innerHTML = '<div class="empty">Kayıt yok</div>';
      return;
    }
    this.overdueWhispers.forEach((rec) => {
      const row = document.createElement("div");
      row.className = "pending-row";
      row.dataset.id = rec.id;
      row.dataset.provider = rec.user;
      const when = rec.when ? new Date(rec.when).toLocaleString("tr-TR") : "-";
      const text = document.createElement("div");
      text.className = "pending-text";
      text.textContent = `${rec.user} | ${when} | ${rec.text}`;
      const del = document.createElement("button");
      del.className = "pending-remove";
      del.textContent = "×";
      del.title = "Sil";
      del.addEventListener("click", async (e) => {
        e.stopPropagation();
        await CoreEngine.whisper("remove", { user: rec.user, id: rec.id });
        this.renderWhispers();
      });
      row.appendChild(text);
      row.appendChild(del);
      listEl.appendChild(row);
    });
  }

  async onShow() {
    CoreEngine.pauseWhispers();
    await this.loadUserSettings();
    await this.applyDefaultConnections();
    this.updateUI();
  }

  onHide() {
    CoreEngine.resumeWhispers(true);
    try {
      this._unsubSettings?.();
      this._unsubSettings = null;
    } catch (_) {
      void 0;
    }
  }

  handleWhisperClear() {
    this.overdueWhispers.forEach((rec) =>
      CoreEngine.whisper("remove", { user: rec.user, id: rec.id }),
    );
    this.overdueWhispers = [];
  }

  handleWhisperListClick(ev) {
    const targetRow = ev.target.closest(".pending-row");
    if (!targetRow || ev.target.classList.contains("pending-remove")) return;
    targetRow.classList.toggle("selected");
  }

  async applyDefaultConnections() {
    if (this.defaultsApplied) return;
    const settings = await SettingsManager.load();

    // human always true
    this.users.human.connected = true;
    this.updateUserStatus("human", true);
    CoreEngine.setConnection("human", true);

    // ai slots: connected only if account assigned
    ["ai1", "ai2"].forEach((u) => {
      const hasAccount = !!settings?.[u]?.activeAccountId;
      this.users[u].connected = hasAccount;
      this.updateUserStatus(u, hasAccount);
      CoreEngine.setConnection(u, hasAccount);
    });

    this.defaultsApplied = true;
  }

}
