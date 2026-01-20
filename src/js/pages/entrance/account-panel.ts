import { getMimeTypeFromPath, generateAccountId } from "../../constants/index.js";
import { getErrorMessage } from "../../types/index.js";
import { LogManager } from "../../modules/log-manager.js";

export class AccountPanel {
  settingsManager: any;
  _newAccountAvatarPath: string | null;
  _editingAccountId: string | null;

  constructor(settingsManager: any) {
    this.settingsManager = settingsManager;
    this._newAccountAvatarPath = null;
    this._editingAccountId = null;
  }

  init() {
    this.setupListeners();
    this.render();
  }

  setupListeners() {
    const createBtn = document.getElementById("settings-create-account");
    if (createBtn) {
      createBtn.addEventListener("click", () => this.handleSaveAccount());
    }

    const cancelBtn = document.getElementById("settings-cancel-edit");
    if (cancelBtn) {
      cancelBtn.addEventListener("click", () => this.cancelEdit());
    }

    const avatarBrowseBtn = document.getElementById("new-account-avatar-browse");
    if (avatarBrowseBtn) {
      avatarBrowseBtn.addEventListener("click", () => this.browseNewAccountAvatar());
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
      accountListEl.innerHTML = '<div class="empty-message">Henüz hesap yok</div>';
      return;
    }

    for (const acc of accounts) {
      const item = document.createElement("div");
      item.className = "account-row";
      // Highlight if editing
      if (this._editingAccountId === acc.id) {
        item.classList.add("editing");
      }
      
      item.innerHTML = `
        <div id="account-avatar-${this.escapeHtml(acc.id)}" class="account-mini-avatar">
          <div class="avatar-placeholder img-cover"></div>
        </div>
        <div class="account-info-compact">
          <div class="account-nick">${this.escapeHtml(acc.nickname || acc.email)}</div>
          <div class="account-sub">
             <span class="badge ${acc.provider}">${this.escapeHtml(acc.provider)}</span>
             <span style="opacity: 0.7;">${this.escapeHtml(acc.email)}</span>
          </div>
        </div>
        <div style="display: flex; gap: 4px;">
           <button class="icon-btn-text edit-btn" title="Düzenle" data-id="${this.escapeHtml(acc.id)}">✎</button>
           <button class="icon-btn-text delete-btn" title="Sil" data-id="${this.escapeHtml(acc.id)}">×</button>
        </div>
      `;

      const editBtn = item.querySelector(".edit-btn");
      editBtn?.addEventListener("click", () => this.startEdit(acc));

      const deleteBtn = item.querySelector(".delete-btn");
      deleteBtn?.addEventListener("click", () => this.deleteAccount(acc.id));

      accountListEl.appendChild(item);
      this.renderAccountAvatar(acc.id, acc.avatarPath);
    }
  }

  async renderAccountAvatar(accountId: string, avatarPath: string | null) {
    const previewEl = document.getElementById(`account-avatar-${accountId}`);
    if (!previewEl) return;

    if (avatarPath) {
      try {
        const data = await window.electronAPI?.readFile(avatarPath);
        const mimeType = getMimeTypeFromPath(avatarPath);
        previewEl.innerHTML = `<img src="data:${mimeType};base64,${data}" alt="Avatar" class="img-cover">`;
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

    // Show current editing avatar if available, otherwise new selection
    const avatarPath = this._newAccountAvatarPath;
    
    if (avatarPath) {
      try {
        const data = await window.electronAPI?.readFile(avatarPath);
        const mimeType = getMimeTypeFromPath(avatarPath);
        previewEl.innerHTML = `<img src="data:${mimeType};base64,${data}" alt="Preview" class="img-cover">`;
      } catch {
        previewEl.innerHTML = '<div class="avatar-placeholder">?</div>';
      }
    } else {
      previewEl.innerHTML = '<div class="avatar-placeholder">?</div>';
    }
  }

  startEdit(account: { id: string; email: string; provider: string; nickname?: string; avatarPath?: string }) {
    this._editingAccountId = account.id;
    this._newAccountAvatarPath = account.avatarPath ?? null; // Start with existing avatar

    const emailEl = document.getElementById("new-account-email") as HTMLInputElement | null;
    const providerEl = document.getElementById("new-account-provider") as HTMLSelectElement | null;
    const nicknameEl = document.getElementById("new-account-nickname") as HTMLInputElement | null;
    const btn = document.getElementById("settings-create-account");
    const cancelBtn = document.getElementById("settings-cancel-edit");
    const title = document.getElementById("account-form-title");

    if (emailEl) emailEl.value = account.email;
    if (providerEl) {
        providerEl.value = account.provider;
        providerEl.disabled = true; // Cannot change provider (id depends on it)
    }
    if (nicknameEl) nicknameEl.value = account.nickname || "";
    
    if (btn) btn.textContent = "Güncelle";
    if (cancelBtn) cancelBtn.classList.remove("hidden");
    if (title) title.textContent = "Hesabı Düzenle";

    this.render(); // Re-render list to show highlight
  }

  cancelEdit() {
    this._editingAccountId = null;
    this._newAccountAvatarPath = null;
    
    const emailEl = document.getElementById("new-account-email") as HTMLInputElement | null;
    const providerEl = document.getElementById("new-account-provider") as HTMLSelectElement | null;
    const nicknameEl = document.getElementById("new-account-nickname") as HTMLInputElement | null;
    const btn = document.getElementById("settings-create-account");
    const cancelBtn = document.getElementById("settings-cancel-edit");
    const title = document.getElementById("account-form-title");

    if (emailEl) emailEl.value = "";
    if (providerEl) {
        providerEl.value = "chatgpt";
        providerEl.disabled = false;
    }
    if (nicknameEl) nicknameEl.value = "";
    
    if (btn) btn.textContent = "Hesap Ekle";
    if (cancelBtn) cancelBtn.classList.add("hidden");
    if (title) title.textContent = "Yeni Hesap Ekle";

    this.render();
  }

  async browseNewAccountAvatar() {
    try {
      const result = await window.electronAPI?.showOpenDialog({
        title: "Avatar seç",
        buttonLabel: "Seç",
        filters: [{ name: "Resimler", extensions: ["png", "jpg", "jpeg", "gif", "webp"] }],
        properties: ["openFile"],
      });

      if (result?.canceled || !result?.filePaths?.length) return;

      this._newAccountAvatarPath = result.filePaths[0];
      await this.renderNewAccountAvatarPreview();
    } catch (err) {
      LogManager.addEvent("entrance", "error", `Avatar browse hatası: ${getErrorMessage(err)}`);
    }
  }

  async handleSaveAccount() {
    if (this._editingAccountId) {
        await this.updateAccount();
    } else {
        await this.createAccount();
    }
  }

  async createAccount() {
    const emailEl = document.getElementById("new-account-email") as HTMLInputElement | null;
    const providerEl = document.getElementById("new-account-provider") as HTMLSelectElement | null;
    const nicknameEl = document.getElementById("new-account-nickname") as HTMLInputElement | null;

    const email = emailEl?.value?.trim();
    const provider = providerEl?.value;
    const nickname = nicknameEl?.value?.trim() || provider || "Account";

    if (!email || !provider) {
      this.showFeedback("Email ve provider gerekli", "error");
      return;
    }

    try {
      const settings = this.settingsManager.getSnapshot();
      const accounts = settings?.accounts || [];

      const existingAccount = accounts.find(
        (a: { email: string; provider: string }) => a.email.toLowerCase() === email.toLowerCase() && a.provider === provider
      );
      if (existingAccount) {
        this.showFeedback("Bu hesap zaten kayıtlı", "error");
        return;
      }

      const accountId = generateAccountId(email, provider);
      let finalAvatarPath = "";
      
      if (this._newAccountAvatarPath) {
        const copied = await window.electronAPI?.copyToAssets(
          this._newAccountAvatarPath,
          "account",
          { id: accountId, email, provider },
        );
        finalAvatarPath = copied?.path || "";
      } else {
        finalAvatarPath = `src/assets/${provider}.png`;
      }

      const newAccount = {
        id: accountId,
        email,
        provider,
        nickname,
        avatarPath: finalAvatarPath,
      };

      await window.electronAPI?.dbInitAccount?.({ accountId });
      
      const updated = { ...settings, accounts: [...accounts, newAccount] };
      await this.settingsManager.save(updated);

      this.cancelEdit(); // Reset form
      this.showFeedback("Hesap oluşturuldu", "success");
    } catch (err) {
      LogManager.addEvent("entrance", "error", `Hesap oluşturma hatası: ${getErrorMessage(err)}`);
      this.showFeedback(`Hata: ${getErrorMessage(err)}`, "error");
    }
  }

  async updateAccount() {
    const emailEl = document.getElementById("new-account-email") as HTMLInputElement | null;
    const nicknameEl = document.getElementById("new-account-nickname") as HTMLInputElement | null;

    const email = emailEl?.value?.trim();
    const nickname = nicknameEl?.value?.trim();

    if (!email) {
      this.showFeedback("Email gerekli", "error");
      return;
    }

    try {
        const settings = this.settingsManager.getSnapshot();
        const accounts = settings?.accounts || [];
        const accountIndex = accounts.findIndex((a: { id: string }) => a.id === this._editingAccountId);

        if (accountIndex === -1) {
            this.showFeedback("Düzenlenen hesap bulunamadı", "error");
            this.cancelEdit();
            return;
        }

        const oldAccount = accounts[accountIndex];
        let finalAvatarPath = oldAccount.avatarPath;

        // If avatar changed (and isn't just the same path)
        if (this._newAccountAvatarPath && this._newAccountAvatarPath !== oldAccount.avatarPath) {
            const copied = await window.electronAPI?.copyToAssets(
                this._newAccountAvatarPath,
                "account",
                { id: oldAccount.id, email: oldAccount.email, provider: oldAccount.provider },
            );
            finalAvatarPath = copied?.path || finalAvatarPath;
        }

        const updatedAccount = {
            ...oldAccount,
            email: email, // Email update might affect ID technically, but we keep ID stable for now or block email edit? 
                          // Allowing email edit but keeping ID stable is safer for DB, but ID was based on email. 
                          // Let's assume ID is persistent.
            nickname: nickname || oldAccount.provider,
            avatarPath: finalAvatarPath
        };

        const newAccounts = [...accounts];
        newAccounts[accountIndex] = updatedAccount;

        const updated = { ...settings, accounts: newAccounts };
        await this.settingsManager.save(updated);

        this.cancelEdit();
        this.showFeedback("Hesap güncellendi", "success");

    } catch (err) {
        LogManager.addEvent("entrance", "error", `Hesap güncelleme hatası: ${getErrorMessage(err)}`);
        this.showFeedback(`Güncelleme hatası: ${getErrorMessage(err)}`, "error");
    }
  }

  async deleteAccount(accountId: string) {
    const result = await window.electronAPI?.showMessageBox?.({
      type: "question",
      buttons: ["İptal", "Sil"],
      defaultId: 0,
      cancelId: 0,
      title: "Hesap Silme",
      message: "Bu hesabı silmek istediğinizden emin misiniz?",
    });
    
    if (!result || result.response === 0) return;

    try {
      const settings = this.settingsManager.getSnapshot();
      const accounts = settings?.accounts || [];
      
      const updatedAccounts = accounts.filter((a: { id: string }) => a.id !== accountId);
      
      // Cleanup slots using this account
      const slots = { ...settings.slots };
      if (slots.ai1?.accountId === accountId) slots.ai1 = { ...slots.ai1, accountId: null };
      if (slots.ai2?.accountId === accountId) slots.ai2 = { ...slots.ai2, accountId: null };

      const updated = { ...settings, accounts: updatedAccounts, slots };
      await this.settingsManager.save(updated);

      if (this._editingAccountId === accountId) {
          this.cancelEdit();
      }

      this.showFeedback("Hesap silindi", "success");
    } catch (err) {
      this.showFeedback(`Hata: ${getErrorMessage(err)}`, "error");
    }
  }

  escapeHtml(text: string | null | undefined) {
    if (!text) return "";
    const div = document.createElement("div");
    div.textContent = text;
    return div.innerHTML;
  }

  showFeedback(message: string, type = "info") {
    // We can use a global feedback or one specific to the account section
    const statusEl = document.getElementById("account-status-msg");
    if (!statusEl) return;
    
    statusEl.textContent = message;
    statusEl.className = `status-msg ${type}`;
    statusEl.style.opacity = "1";
    
    setTimeout(() => {
        statusEl.style.opacity = "0";
    }, 3000);
  }
}
