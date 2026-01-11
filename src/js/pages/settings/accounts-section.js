import { getMimeTypeFromPath } from "../../constants/index.js";

export class AccountsSection {
  constructor(settingsManager) {
    this.settingsManager = settingsManager;
    this._newAccountAvatarPath = null;
  }

  init() {
    this.setupListeners();
    this.render();
  }

  setupListeners() {
    const createBtn = document.getElementById("settings-create-account");
    if (createBtn) {
      createBtn.addEventListener("click", () => this.createAccount());
    }

    const avatarBrowseBtn = document.getElementById(
      "new-account-avatar-browse",
    );
    if (avatarBrowseBtn) {
      avatarBrowseBtn.addEventListener("click", () =>
        this.browseNewAccountAvatar(),
      );
    }
  }

  async render() {
    await this.renderAccountList();
    await this.renderNewAccountAvatarPreview();
  }

  async renderAccountList() {
    const accountListEl = document.getElementById("account-list");
    if (!accountListEl) return;

    const settings = this.settingsManager.getSnapshot();
    const accounts = settings?.accounts || [];

    accountListEl.innerHTML = "";

    if (!accounts.length) {
      accountListEl.innerHTML =
        '<p class="form-hint">Henüz hesap eklenmedi</p>';
      return;
    }

    for (const acc of accounts) {
      const item = document.createElement("div");
      item.className = "account-item";
      item.innerHTML = `
        <div id="account-avatar-${this.escapeHtml(acc.id)}" class="account-avatar">
          <div class="avatar-placeholder">👤</div>
        </div>
        <div class="account-info">
          <div><strong>${this.escapeHtml(acc.nickname || acc.email)}</strong></div>
          <div class="form-hint">${this.escapeHtml(acc.email)} - ${this.escapeHtml(acc.provider)}</div>
        </div>
        <button class="account-delete-btn" data-account-id="${this.escapeHtml(acc.id)}">Sil</button>
      `;

      const deleteBtn = item.querySelector(".account-delete-btn");
      if (deleteBtn) {
        deleteBtn.addEventListener("click", () => {
          const id = deleteBtn.getAttribute("data-account-id");
          this.deleteAccount(id);
        });
      }

      accountListEl.appendChild(item);

      this.renderAccountAvatar(acc.id, acc.avatarPath);
    }
  }

  async renderAccountAvatar(accountId, avatarPath) {
    const previewEl = document.getElementById(`account-avatar-${accountId}`);
    if (!previewEl) return;

    if (avatarPath) {
      try {
        const data = await window.electronAPI?.readFile(avatarPath);
        const mimeType = getMimeTypeFromPath(avatarPath);
        previewEl.innerHTML = `<img src="data:${mimeType};base64,${data}" alt="Account avatar">`;
      } catch {
        previewEl.innerHTML = '<div class="avatar-placeholder">👤</div>';
      }
    } else {
      previewEl.innerHTML = '<div class="avatar-placeholder">👤</div>';
    }
  }

  async renderNewAccountAvatarPreview() {
    const previewEl = document.getElementById("new-account-avatar-preview");
    if (!previewEl) return;

    const avatarPath = this._newAccountAvatarPath;
    if (avatarPath) {
      try {
        const data = await window.electronAPI?.readFile(avatarPath);
        const mimeType = getMimeTypeFromPath(avatarPath);
        previewEl.innerHTML = `<img src="data:${mimeType};base64,${data}" alt="Yeni hesap avatar">`;
      } catch {
        previewEl.innerHTML = '<div class="avatar-placeholder">👤</div>';
      }
    } else {
      previewEl.innerHTML = '<div class="avatar-placeholder">👤</div>';
    }
  }

  async browseNewAccountAvatar() {
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

      this._newAccountAvatarPath = result.filePaths[0];
      await this.renderNewAccountAvatarPreview();
    } catch (err) {
      console.error("Avatar browse error:", err);
      this.showFeedback(`Avatar seçme hatası: ${err.message}`, "error");
    }
  }

  async createAccount() {
    const emailEl = /** @type {HTMLInputElement|null} */ (
      document.getElementById("new-account-email")
    );
    const providerEl = /** @type {HTMLSelectElement|null} */ (
      document.getElementById("new-account-provider")
    );
    const nicknameEl = /** @type {HTMLInputElement|null} */ (
      document.getElementById("new-account-nickname")
    );

    const email = emailEl?.value?.trim();
    const provider = providerEl?.value;
    const nickname = nicknameEl?.value?.trim() || provider || "Account";

    if (!email || !provider) {
      this.showFeedback("Email ve provider gerekli", "error");
      return;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      this.showFeedback("Geçerli bir email adresi girin", "error");
      return;
    }

    if (nickname.length > 50) {
      this.showFeedback("Nickname 50 karakterden uzun olamaz", "error");
      return;
    }

    try {
      const settings = this.settingsManager.getSnapshot();
      const accounts = settings?.accounts || [];

      const accountId = `acc-${provider}-${Date.now().toString(36)}`;

      let finalAvatarPath = "";
      if (this._newAccountAvatarPath) {
        const copied = await window.electronAPI?.copyToAssets(
          this._newAccountAvatarPath,
          "account",
          { id: accountId, email, provider },
        );
        finalAvatarPath = copied?.path || "";
      }

      this._newAccountAvatarPath = null;

      const newAccount = {
        id: accountId,
        email,
        provider,
        nickname,
        avatarPath: finalAvatarPath,
      };

      const updated = { ...settings, accounts: [...accounts, newAccount] };
      await this.settingsManager.save(updated);

      if (emailEl) emailEl.value = "";
      if (nicknameEl) nicknameEl.value = "";
      if (providerEl) providerEl.selectedIndex = 0;

      await this.renderAccountList();
      await this.renderNewAccountAvatarPreview();

      this.showFeedback("Hesap oluşturuldu", "success");
    } catch (err) {
      console.error("Create account error:", err);
      this.showFeedback(
        `Hesap oluşturulurken hata oluştu: ${err.message}`,
        "error",
      );
    }
  }

  async deleteAccount(accountId) {
    if (!confirm("Bu hesabı silmek istediğinizden emin misiniz?")) return;

    try {
      const settings = this.settingsManager.getSnapshot();
      const accounts = settings?.accounts || [];
      const account = accounts.find((a) => a.id === accountId);

      if (!account) {
        this.showFeedback("Hesap bulunamadı", "error");
        return;
      }

      const updatedAccounts = accounts.filter((a) => a.id !== accountId);

      const slots = { ...settings.slots };
      if (slots.ai1?.accountId === accountId) {
        slots.ai1 = { ...slots.ai1, accountId: null };
      }
      if (slots.ai2?.accountId === accountId) {
        slots.ai2 = { ...slots.ai2, accountId: null };
      }

      const updated = { ...settings, accounts: updatedAccounts, slots };
      await this.settingsManager.save(updated);

      if (account.avatarPath) {
        try {
          await window.electronAPI?.deleteAsset?.(account.avatarPath);
        } catch {
        }
      }

      await this.render();
      this.showFeedback("Hesap silindi", "success");
    } catch (err) {
      console.error("Delete account error:", err);
      this.showFeedback(
        `Hesap silinirken hata oluştu: ${err.message}`,
        "error",
      );
    }
  }

  escapeHtml(text) {
    if (!text) return "";
    const div = document.createElement("div");
    div.textContent = text;
    return div.innerHTML;
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
