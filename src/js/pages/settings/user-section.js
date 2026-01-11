import { getMimeTypeFromPath } from "../../constants/index.js";

export class UserSection {
  constructor(settingsManager, fileManager) {
    this.settingsManager = settingsManager;
    this.fileManager = fileManager;
  }

  init() {
    this.setupListeners();
    this.render();
  }

  setupListeners() {
    const nicknameBtn = document.getElementById(
      "settings-user-nickname-update",
    );
    if (nicknameBtn) {
      nicknameBtn.addEventListener("click", () => this.updateNickname());
    }

    const avatarBtn = document.getElementById("settings-user-avatar-browse");
    if (avatarBtn) {
      avatarBtn.addEventListener("click", () => this.browseAvatar());
    }
  }

  async render() {
    const settings = this.settingsManager.getSnapshot();
    const user = settings?.user || {};

    const nicknameEl = /** @type {HTMLInputElement|null} */ (
      document.getElementById("settings-user-nickname")
    );
    if (nicknameEl && document.activeElement !== nicknameEl) {
      nicknameEl.value = user.nickname || "Kullanıcı";
    }

    const avatarPreview = document.getElementById(
      "settings-user-avatar-preview",
    );
    if (avatarPreview) {
      if (user.avatarPath) {
        try {
          const data = await window.electronAPI?.readFile(user.avatarPath);
          const mimeType = getMimeTypeFromPath(user.avatarPath);
          avatarPreview.innerHTML = `<img src="data:${mimeType};base64,${data}" alt="Kullanıcı avatar">`;
        } catch {
          avatarPreview.innerHTML = '<div class="avatar-placeholder">👤</div>';
        }
      } else {
        avatarPreview.innerHTML = '<div class="avatar-placeholder">👤</div>';
      }
    }
  }

  async updateNickname() {
    const nicknameEl = /** @type {HTMLInputElement|null} */ (
      document.getElementById("settings-user-nickname")
    );
    const nick = nicknameEl?.value?.trim() || "";

    if (nick.length > 50) {
      this.showFeedback("Kullanıcı adı 50 karakterden uzun olamaz", "error");
      return;
    }

    const current = this.settingsManager.getSnapshot();
    const updated = {
      ...current,
      user: { ...current.user, nickname: nick || "Kullanıcı" },
    };
    await this.settingsManager.save(updated);

    this.showFeedback("Kullanıcı adı güncellendi", "success");
  }

  async browseAvatar() {
    try {
      const result = await window.electronAPI?.showOpenDialog({
        title: "Avatar seç",
        buttonLabel: "Seç",
        filters: [
          {
            name: "Resimler",
            extensions: ["png", "jpg", "jpeg", "gif", "webp"],
          },
        ],
        properties: ["openFile"],
      });

      if (result?.canceled || !result?.filePaths?.length) return;

      const selectedPath = result.filePaths[0];
      const copied = await window.electronAPI?.copyToAssets(
        selectedPath,
        "user",
        null,
      );
      const targetPath = copied?.path || selectedPath;

      const current = this.settingsManager.getSnapshot();
      const oldAvatarPath = current?.user?.avatarPath;
      if (oldAvatarPath && oldAvatarPath !== targetPath) {
        try {
          await window.electronAPI?.deleteAsset(oldAvatarPath);
        } catch (deleteErr) {
          console.warn("Eski avatar silinemedi:", deleteErr);
        }
      }

      const updated = {
        ...current,
        user: { ...current.user, avatarPath: targetPath },
      };
      await this.settingsManager.save(updated);

      await this.render();
      this.showFeedback("Avatar güncellendi", "success");
    } catch (err) {
      console.error("Avatar browse error:", err);
      this.showFeedback(
        `Avatar güncellenirken hata oluştu: ${err.message}`,
        "error",
      );
    }
  }

  showFeedback(message, type = "info") {
    const statusEl = document.getElementById("settings-status");
    if (!statusEl) return;

    statusEl.textContent = message;
    statusEl.className = `form-hint ${type}`;

    setTimeout(() => {
      if (statusEl) {
        statusEl.textContent = "";
        statusEl.className = "form-hint";
      }
    }, 3000);
  }
}
