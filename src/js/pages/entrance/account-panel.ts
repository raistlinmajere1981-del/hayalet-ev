import { getMimeTypeFromPath, generateAccountId } from "../../constants/index.js";
import { LogCategory } from "@shared/logging-core";
import { getErrorMessage } from "@shared/index.js";
import { Logger } from "../../modules/logger/index.js";
import type { AppSettings, Account } from "@shared/settings.js";
import { t as entranceT } from "./i18n.js";

interface SettingsManager {
  getSnapshot(): AppSettings;
  save(settings: Record<string, unknown>): Promise<boolean>;
}

export class AccountPanel {
  _newAccountAvatarPath: string | null;
  _editingAccountId: string | null;
  settingsManager: SettingsManager;

  constructor(settingsManager: SettingsManager) {
    this.settingsManager = settingsManager;
    this._newAccountAvatarPath = null;
    this._editingAccountId = null;
  }

  init(): void {
    this.setupListeners();
    this.render();
  }

  setupListeners(): void {
    const createBtn = document.getElementById("settings-create-account");
    if (createBtn) {
      createBtn.addEventListener("click", () => {
        void this.handleSaveAccount();
      });
    }

    const cancelBtn = document.getElementById("settings-cancel-edit");
    if (cancelBtn) {
      cancelBtn.addEventListener("click", () => {
        this.cancelEdit();
      });
    }

    const avatarBrowseBtn = document.getElementById("new-account-avatar-browse");
    if (avatarBrowseBtn) {
      avatarBrowseBtn.addEventListener("click", () => void this.browseNewAccountAvatar());
    }
  }

  render(): void {
    this.renderAccountList();
  }

  renderAccountList(): void {
    const accountListEl = document.getElementById("account-list");
    if (!accountListEl) return;

    const settings = this.settingsManager.getSnapshot();
    const accounts = settings.accounts;

    accountListEl.innerHTML = "";

    if (accounts.length === 0) {
      accountListEl.innerHTML = `<div class="empty-message">${entranceT("accounts.empty")}</div>`;
      return;
    }

    for (const acc of accounts) {
      const item = document.createElement("div");
      item.className = "account-row";
      if (this._editingAccountId === acc.id) {
        item.classList.add("editing");
      }

      item.innerHTML = `
        <div id="account-avatar-${this.escapeHtml(acc.id)}" class="account-avatar-2row">
          <div class="avatar-placeholder img-cover"></div>
        </div>
        <div class="account-info-grid">
          <div class="account-info-top">
            <span class="account-nick">${this.escapeHtml(acc.nickname ?? acc.email)}</span>
            <span class="account-provider">${acc.provider}</span>
            <div class="account-actions">
              <button class="btn btn-ghost btn-xs edit-btn" title="${this.escapeHtml(entranceT("accounts.editTitle"))}" data-id="${this.escapeHtml(acc.id)}">✎</button>
              <button class="btn btn-ghost btn-xs delete-btn" title="${this.escapeHtml(entranceT("accounts.deleteTitle"))}" data-id="${this.escapeHtml(acc.id)}">×</button>
            </div>
          </div>
          <div class="account-email">${this.escapeHtml(acc.email)}</div>
        </div>
      `;

      const editBtn = item.querySelector(".edit-btn");
      editBtn?.addEventListener("click", () => {
        this.startEdit(acc);
      });

      const deleteBtn = item.querySelector(".delete-btn");
      deleteBtn?.addEventListener("click", () => {
        void this.deleteAccount(acc.id);
      });

      accountListEl.appendChild(item);
      void this.renderAccountAvatar(acc.id, acc.avatarPath);
    }
  }

  async renderAccountAvatar(
    accountId: string,
    avatarPath: string | null | undefined
  ): Promise<void> {
    const previewEl = document.getElementById(`account-avatar-${accountId}`);
    if (!previewEl) return;
    const electronApi = window.electronAPI;

    if (avatarPath !== null && avatarPath !== undefined && avatarPath !== "") {
      try {
        if (!electronApi) {
          previewEl.innerHTML = '<div class="avatar-placeholder">👤</div>';
          return;
        }
        const data = await electronApi.readFile(avatarPath);
        const mimeType = getMimeTypeFromPath(avatarPath);
        previewEl.innerHTML = `<img src="data:${mimeType};base64,${String(data)}" alt="${this.escapeHtml(entranceT("accounts.avatarAlt"))}" class="img-cover">`;
      } catch {
        previewEl.innerHTML = '<div class="avatar-placeholder">👤</div>';
      }
    } else {
      previewEl.innerHTML = '<div class="avatar-placeholder">👤</div>';
    }
  }

  async renderNewAccountAvatarPreview(): Promise<void> {
    const previewEl = document.getElementById("new-account-avatar-preview");
    if (!previewEl) return;
    const electronApi = window.electronAPI;

    const avatarPath = this._newAccountAvatarPath;

    if (avatarPath !== null && avatarPath !== "") {
      try {
        if (!electronApi) {
          previewEl.innerHTML = '<div class="avatar-placeholder">?</div>';
          return;
        }
        const data = await electronApi.readFile(avatarPath);
        const mimeType = getMimeTypeFromPath(avatarPath);
        previewEl.innerHTML = `<img src="data:${mimeType};base64,${String(data)}" alt="${this.escapeHtml(entranceT("accounts.avatarPreviewAlt"))}" class="img-cover">`;
      } catch {
        previewEl.innerHTML = '<div class="avatar-placeholder">?</div>';
      }
    } else {
      previewEl.innerHTML = '<div class="avatar-placeholder">?</div>';
    }
  }

  startEdit(account: {
    id: string;
    email: string;
    provider: string;
    nickname?: string;
    avatarPath?: string;
  }): void {
    this._editingAccountId = account.id;
    this._newAccountAvatarPath = account.avatarPath ?? null;

    const emailEl = document.getElementById("new-account-email") as HTMLInputElement | null;
    const providerEl = document.getElementById("new-account-provider") as HTMLSelectElement | null;
    const nicknameEl = document.getElementById("new-account-nickname") as HTMLInputElement | null;
    const btn = document.getElementById("settings-create-account");
    const cancelBtn = document.getElementById("settings-cancel-edit");
    const title = document.getElementById("account-form-title");

    if (emailEl) emailEl.value = account.email;
    if (providerEl) {
      providerEl.value = account.provider;
      providerEl.disabled = true;
    }
    if (nicknameEl) nicknameEl.value = account.nickname ?? "";

    if (btn) btn.textContent = entranceT("accounts.form.updateAction");
    if (cancelBtn) cancelBtn.classList.remove("is-hidden");
    if (title) title.textContent = entranceT("accounts.form.editTitle");

    this.render();
  }

  cancelEdit(): void {
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

    if (btn) btn.textContent = entranceT("accounts.form.createAction");
    if (cancelBtn) cancelBtn.classList.add("is-hidden");
    if (title) title.textContent = entranceT("accounts.form.createTitle");
    this.render();
    void this.renderNewAccountAvatarPreview();
  }

  async browseNewAccountAvatar(): Promise<void> {
    try {
      const electronApi = window.electronAPI;
      if (!electronApi) return;
      const result = await electronApi.showOpenDialog({
        title: entranceT("accounts.dialog.avatarTitle"),
        buttonLabel: entranceT("accounts.dialog.selectButton"),
        filters: [
          {
            name: entranceT("accounts.dialog.imageFilterName"),
            extensions: ["png", "jpg", "jpeg", "gif", "webp"],
          },
        ],
        properties: ["openFile"],
      });

      if (result.canceled === true || result.filePaths.length === 0) return;

      this._newAccountAvatarPath = result.filePaths[0] ?? null;
      await this.renderNewAccountAvatarPreview();
    } catch (err) {
      Logger.error(
        LogCategory.ENTRANCE,
        entranceT("logs.accountAvatarBrowseError", { message: getErrorMessage(err) })
      );
    }
  }

  async handleSaveAccount(): Promise<void> {
    if (this._editingAccountId !== null && this._editingAccountId !== "") {
      await this.updateAccount();
    } else {
      await this.createAccount();
    }
  }

  async createAccount(): Promise<void> {
    const emailEl = document.getElementById("new-account-email") as HTMLInputElement | null;
    const providerEl = document.getElementById("new-account-provider") as HTMLSelectElement | null;
    const nicknameEl = document.getElementById("new-account-nickname") as HTMLInputElement | null;

    const email = emailEl?.value.trim() ?? "";
    const provider = providerEl?.value ?? "";
    const nickname = nicknameEl?.value.trim() ?? provider;

    if (email === "" || provider === "") {
      this.showFeedback(entranceT("accounts.feedback.emailProviderRequired"), "error");
      return;
    }

    try {
      const settings = this.settingsManager.getSnapshot();
      const accounts = settings.accounts;

      const existingAccount = accounts.find(
        (a: { email: string; provider: string }) =>
          a.email.toLowerCase() === email.toLowerCase() && a.provider === provider
      );
      if (existingAccount) {
        this.showFeedback(entranceT("accounts.feedback.duplicate"), "error");
        return;
      }

      const accountId = generateAccountId(email, provider);
      let finalAvatarPath = "";

      if (this._newAccountAvatarPath !== null && this._newAccountAvatarPath !== "") {
        const electronApi = window.electronAPI;
        if (!electronApi) {
          this.showFeedback(entranceT("accounts.feedback.electronApiMissing"), "error");
          return;
        }
        const copied = await electronApi.copyToAssets(this._newAccountAvatarPath, "account", {
          id: accountId,
          email,
          provider,
        });
        finalAvatarPath = copied?.path ?? "";
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

      const electronApi = window.electronAPI;
      const dbInitAccount = electronApi?.["dbInitAccount"];
      if (!dbInitAccount) {
        this.showFeedback(entranceT("accounts.feedback.dbInitMissing"), "error");
        return;
      }
      const dbResult = (await dbInitAccount({ accountId })) as {
        success?: boolean;
        error?: string;
      };
      if (dbResult.success !== true) {
        this.showFeedback(
          entranceT("accounts.feedback.dbError", {
            message: dbResult.error ?? entranceT("logs.unknownMessage"),
          }),
          "error"
        );
        return;
      }

      const updated = { ...settings, accounts: [...accounts, newAccount] };
      await this.settingsManager.save(updated);

      this.cancelEdit();
      this.renderAccountList();

      window.dispatchEvent(new CustomEvent("account-list-updated"));

      Logger.success(LogCategory.ENTRANCE, entranceT("logs.accountCreateSuccess"));
    } catch (err) {
      Logger.error(
        LogCategory.ENTRANCE,
        entranceT("logs.accountCreateError", { message: getErrorMessage(err) })
      );
      this.showFeedback(
        entranceT("accounts.feedback.createError", { message: getErrorMessage(err) }),
        "error"
      );
    }
  }

  async updateAccount(): Promise<void> {
    const emailEl = document.getElementById("new-account-email") as HTMLInputElement | null;
    const nicknameEl = document.getElementById("new-account-nickname") as HTMLInputElement | null;

    const email = emailEl?.value.trim() ?? "";
    const nickname = nicknameEl?.value.trim() ?? "";

    if (email === "") {
      this.showFeedback(entranceT("accounts.feedback.emailRequired"), "error");
      return;
    }

    try {
      const settings = this.settingsManager.getSnapshot();
      const accounts = settings.accounts;
      const accountIndex = accounts.findIndex(
        (a: { id: string }) => a.id === this._editingAccountId
      );

      if (accountIndex === -1) {
        this.showFeedback(entranceT("accounts.feedback.editingMissing"), "error");
        this.cancelEdit();
        return;
      }

      const oldAccount = accounts[accountIndex];
      if (!oldAccount) {
        this.showFeedback(entranceT("accounts.feedback.accountMissing"), "error");
        return;
      }
      let finalAvatarPath = oldAccount.avatarPath;

      if (
        this._newAccountAvatarPath !== null &&
        this._newAccountAvatarPath !== "" &&
        this._newAccountAvatarPath !== oldAccount.avatarPath
      ) {
        const electronApi = window.electronAPI;
        if (!electronApi) {
          this.showFeedback(entranceT("accounts.feedback.electronApiMissing"), "error");
          return;
        }
        const copied = await electronApi.copyToAssets(this._newAccountAvatarPath, "account", {
          id: oldAccount.id,
          email: oldAccount.email,
          provider: oldAccount.provider,
        });
        finalAvatarPath = copied?.path ?? finalAvatarPath;
      }

      // NOTE: Keep account IDs stable even when emails change.
      const updatedAccount: Account = {
        ...oldAccount,
        email,
        nickname: nickname === "" ? oldAccount.provider : nickname,
        ...(finalAvatarPath !== "" ? { avatarPath: finalAvatarPath } : {}),
      };

      const newAccounts = [...accounts];
      newAccounts[accountIndex] = updatedAccount;

      const updated = { ...settings, accounts: newAccounts };
      await this.settingsManager.save(updated);

      this.cancelEdit();

      window.dispatchEvent(new CustomEvent("account-list-updated"));

      Logger.success(LogCategory.ENTRANCE, entranceT("logs.accountUpdateSuccess"));
    } catch (err) {
      Logger.error(
        LogCategory.ENTRANCE,
        entranceT("logs.accountUpdateError", { message: getErrorMessage(err) })
      );
      this.showFeedback(
        entranceT("accounts.feedback.updateError", { message: getErrorMessage(err) }),
        "error"
      );
    }
  }

  async deleteAccount(accountId: string): Promise<void> {
    const electronApi = window.electronAPI;
    if (!electronApi) return;
    const result = await electronApi.showMessageBox({
      type: "question",
      buttons: [
        entranceT("accounts.dialog.deleteCancel"),
        entranceT("accounts.dialog.deleteConfirm"),
      ],
      defaultId: 0,
      cancelId: 0,
      title: entranceT("accounts.dialog.deleteTitle"),
      message: entranceT("accounts.dialog.deleteMessage"),
    });

    if (result.response === 0) return;

    try {
      const settings = this.settingsManager.getSnapshot();
      const accounts = settings.accounts;

      const updatedAccounts = accounts.filter((a: { id: string }) => a.id !== accountId);

      try {
        const dbDeleteAccount = electronApi["dbDeleteAccount"];
        if (dbDeleteAccount) {
          await dbDeleteAccount({ accountId });
        }
      } catch (dbErr) {
        Logger.error(
          LogCategory.ENTRANCE,
          entranceT("logs.accountDeleteDataError", { message: getErrorMessage(dbErr) })
        );
      }

      const slots = { ...settings.slots };
      if (slots.ai1.accountId === accountId) slots.ai1 = { ...slots.ai1, accountId: null };
      if (slots.ai2.accountId === accountId) slots.ai2 = { ...slots.ai2, accountId: null };

      const updated = { ...settings, accounts: updatedAccounts, slots };
      await this.settingsManager.save(updated);

      if (this._editingAccountId === accountId) {
        this.cancelEdit();
      }

      this.renderAccountList();

      window.dispatchEvent(new CustomEvent("account-list-updated"));

      Logger.success(LogCategory.ENTRANCE, entranceT("logs.accountDeleteSuccess"));
    } catch (err) {
      this.showFeedback(
        entranceT("accounts.feedback.createError", { message: getErrorMessage(err) }),
        "error"
      );
    }
  }

  escapeHtml(text: string | null | undefined): string {
    if (text === null || text === undefined || text === "") return "";
    const div = document.createElement("div");
    div.textContent = text;
    return div.innerHTML;
  }

  showFeedback(message: string, type = "info"): void {
    const statusEl = document.getElementById("account-status-msg");
    if (!statusEl) return;

    const normalizedType = type.startsWith("is-") ? type : `is-${type}`;
    statusEl.textContent = message;
    statusEl.className = `ds-status-msg ${normalizedType}`;
    statusEl.classList.add("is-visible");


    setTimeout(() => {
      statusEl.classList.remove("is-visible");
    }, 3000);
  }
}
