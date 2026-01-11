import { LogManager } from "../modules/log-manager.js";
import { SettingsManager } from "../modules/settings-manager.js";
import { AppState } from "../modules/app-state.js";
import { CoreEngine } from "../modules/core-engine.js";
import { SlotController, SlotEvent } from "../modules/slot-controller.js";

export class EntranceHallController {
  constructor() {
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

    if (!this._unsubSettings) {
      this._unsubSettings = SettingsManager.subscribe(
        ({ settings, changedPaths }) => {
          this.applySettingsToUI(settings, changedPaths);
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

    const userNickEl = document.getElementById("user-nickname");
    const ai1NickEl = document.getElementById("ai1-nickname");
    const ai2NickEl = document.getElementById("ai2-nickname");

    if (userNickEl) userNickEl.textContent = userNickname;
    if (ai1NickEl) ai1NickEl.textContent = ai1Nickname;
    if (ai2NickEl) ai2NickEl.textContent = ai2Nickname;

    const getAvatar = (provider) => {
      if (provider === "user") return settings.user?.avatarPath || "";
      if (provider === "ai1" || provider === "ai2") {
        const accountId = settings.slots?.[provider]?.accountId;
        if (!accountId) return "";
        const account = settings.accounts?.find((acc) => acc.id === accountId);
        return account?.avatarPath || "";
      }
      return "";
    };

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
          const ext = avatarPath.split(".").pop().toLowerCase();
          const mimeTypes = {
            jpg: "image/jpeg",
            jpeg: "image/jpeg",
            png: "image/png",
            gif: "image/gif",
            webp: "image/webp",
          };
          const mimeType = mimeTypes[ext] || "image/png";

          avatarElement.innerHTML = `<img src="data:${mimeType};base64,${imageData}" alt="${userType} avatar" style="width: 100%; height: 100%; object-fit: cover;">`;
        }
      }
    } catch (error) {
      console.error(`Error loading avatar for ${userType}:`, error);
    }
  }

  async connectUser(userType) {
    const settings = await SettingsManager.load();
    const currentlyConnected = SlotController.isConnected(userType);

    if (currentlyConnected) {
      return;
    }

    if (userType === "user") {
      return;
    }

    const nickname = AppState.getNickname(userType);
    LogManager.addEvent("entrance", "info", `${nickname} bağlanıyor...`);

    const hasAccount = !!settings?.slots?.[userType]?.accountId;
    if (!hasAccount) {
      this.updateUserStatus(userType, false);
      this.showFeedback?.(
        `${userType.toUpperCase()} için hesap atanmadı`,
        "warning",
      );
      LogManager.addEvent(
        "entrance",
        "warning",
        `${userType} connect blocked: no account assigned`,
      );
      return;
    }

    await CoreEngine.setConnection(userType, true);

    this.updateUserStatus(userType);
    LogManager.addEvent("entrance", "success", `${nickname} bağlandı`);
  }

  async disconnectUser(userType) {
    if (userType === "user") {
      return;
    }

    const currentlyConnected = SlotController.isConnected(userType);

    if (!currentlyConnected) {
      return;
    }

    const nickname = AppState.getNickname(userType);
    LogManager.addEvent(
      "entrance",
      "info",
      `${nickname} bağlantısı kesiliyor...`,
    );

    if (userType !== "user") {
      await CoreEngine.setConnection(userType, false);
    }

    this.updateUserStatus(userType);

    LogManager.addEvent(
      "entrance",
      "success",
      `${nickname} bağlantısı kesildi`,
    );
  }

  async updateUserStatus(userType) {
    const settings = SettingsManager.getSnapshot();
    const statusDot = document.getElementById(`${userType}-status-dot`);
    const statusText = document.getElementById(`${userType}-status-text`);
    const toggleBtn = document.getElementById(`${userType}-toggle-btn`);
    const avatarEl = document.getElementById(`${userType}-avatar`);

    if (userType === "user") {
      const connected = true;

      if (statusDot) {
        if (connected) {
          statusDot.classList.add("connected");
          statusDot.style.backgroundColor = "#4CAF50";
        } else {
          statusDot.classList.remove("connected");
          statusDot.style.backgroundColor = "#FFA726";
        }
      }

      if (statusText)
        statusText.textContent = connected ? "Bağlı" : "Bağlı değil";

      if (toggleBtn) {
        toggleBtn.textContent = connected ? "Bağlantıyı Kes" : "Bağlan";
        toggleBtn.disabled = false;
        toggleBtn.classList.toggle("btn-primary", !connected);
        toggleBtn.classList.toggle("btn-secondary", connected);
      }

      if (avatarEl) {
        const avatarPath = settings.user?.avatarPath || "";
        if (avatarPath) {
          try {
            const data = await window.electronAPI?.readFile(avatarPath);
            const ext = avatarPath.split(".").pop().toLowerCase();
            const mimeTypes = {
              png: "image/png",
              jpg: "image/jpeg",
              jpeg: "image/jpeg",
              gif: "image/gif",
              webp: "image/webp",
            };
            const mimeType = mimeTypes[ext] || "image/png";
            avatarEl.style.backgroundImage = `url(data:${mimeType};base64,${data})`;
          } catch {
            avatarEl.style.backgroundImage = "";
          }
        } else {
          avatarEl.style.backgroundImage = "";
        }
        avatarEl.style.opacity = connected ? "1" : "0.5";
      }

      return;
    }

    const hasAccount = !!settings.slots?.[userType]?.accountId;
    const connected = SlotController.isConnected(userType);

    if (avatarEl) {
      const accountId = settings.slots?.[userType]?.accountId;
      const account = accountId
        ? settings.accounts?.find((acc) => acc.id === accountId)
        : null;
      const avatarPath = account?.avatarPath || "";
      if (avatarPath) {
        try {
          const data = await window.electronAPI?.readFile(avatarPath);
          const ext = avatarPath.split(".").pop().toLowerCase();
          const mimeTypes = {
            png: "image/png",
            jpg: "image/jpeg",
            jpeg: "image/jpeg",
            gif: "image/gif",
            webp: "image/webp",
          };
          const mimeType = mimeTypes[ext] || "image/png";
          avatarEl.style.backgroundImage = `url(data:${mimeType};base64,${data})`;
        } catch {
          avatarEl.style.backgroundImage = "";
        }
      } else {
        avatarEl.style.backgroundImage = "";
      }
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
      if (!hasAccount) {
        statusText.textContent = "Hesap yok";
      } else if (connected) {
        statusText.textContent = "Bağlı";
      } else {
        statusText.textContent = "Bağlı değil";
      }
    }

    if (toggleBtn) {
      if (!hasAccount) {
        toggleBtn.textContent = "Hesap Ata";
        toggleBtn.disabled = true;
        toggleBtn.title = "Settings'ten hesap atayın";
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
    this.updateUI();
  }

  onHide() {
    CoreEngine.resumeWhispers(true);
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

    try {
      await CoreEngine.setConnection("ai1", false, { force: true });
    } catch (e) {
      LogManager.addEvent(
        "entrance",
        "warning",
        "ai1 immediate disconnect failed",
        { error: e instanceof Error ? e.message : String(e) },
      );
    }
    try {
      await CoreEngine.setConnection("ai2", false, { force: true });
    } catch (e) {
      LogManager.addEvent(
        "entrance",
        "warning",
        "ai2 immediate disconnect failed",
        { error: e instanceof Error ? e.message : String(e) },
      );
    }

    this.defaultsApplied = true;
  }
}
