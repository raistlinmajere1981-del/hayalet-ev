// @ts-nocheck
// Ayarlar sayfası controller'ı
import { LogManager } from "../modules/log-manager.js";
import { SettingsManager } from "../modules/settings-manager.js";

export class SettingsController {
  constructor() {
    this.settings = null;
  }

  getEl(id) {
    return document.getElementById(`settings-${id}`);
  }

  async init() {
    await this.loadSettings();
    this.setupEventListeners();
    this.populateForm();

    // Keep UI in sync with settings changes from other pages
    this._unsubscribe = SettingsManager.subscribe((s) => {
      this.settings = s;
      this.populateForm();
    });
  }

  async loadSettings() {
    this.settings = await SettingsManager.load();
  }

  setupEventListeners() {
    try {
      const humanAvatarBtn = this.getEl("human-avatar-browse");
      if (humanAvatarBtn) {
        humanAvatarBtn.addEventListener("click", () => {
          this.browseAvatar("human");
        });
      }

      const gdStart = document.getElementById("settings-googledrive-start");
      const gdToggle = document.getElementById("settings-googledrive-toggle");
      
      if (gdStart) {
        gdStart.addEventListener("click", async () => {
          try {
            const res = await window.electronAPI?.googledriveStartAuth?.();
            const statusEl = document.getElementById(
              "settings-googledrive-status",
            );
            if (res?.success) {
              if (statusEl)
                statusEl.textContent =
                  "Tarayıcıda açıldı. Yetkilendirme kodunu yapıştırın.";
            } else {
              if (statusEl)
                statusEl.textContent = `Başlatılamadı: ${res?.message || "hata"}`;
            }
          } catch (err) {
            console.error("googledrive start error", err);
          }
        });
      }
      
      // Persist auth code on edit (no explicit save button)
      try {
        const gdAuth = document.getElementById("settings-googledrive-authcode");
        if (gdAuth && !gdAuth.__bound) {
          // @ts-ignore
          gdAuth.__bound = true;
          gdAuth.addEventListener("change", async (e) => {
            const code = String(e?.target?.value || "").trim();
            await SettingsManager.set("human.googledrive.authorizationCode", code);
          });
          gdAuth.addEventListener("blur", async (e) => {
            const code = String(e?.target?.value || "").trim();
            await SettingsManager.set("human.googledrive.authorizationCode", code);
          });
        }
      } catch (_) {
        void 0;
      }

      // Toggle button: Connect or Disconnect based on current state
      if (gdToggle) {
        gdToggle.addEventListener("click", async () => {
          try {
            // Get current connection state from settings
            await this.loadSettings();
            const isConnected = this.settings?.human?.googledrive?.connected || false;
            const statusEl = document.getElementById("settings-googledrive-status");
            
            if (isConnected) {
              // Disconnect - only disconnect, keep credentials
              if (statusEl) statusEl.textContent = "Bağlantı kesiliyor...";
              const res = await window.electronAPI?.googledriveDisconnect?.();
              
              if (res?.success) {
                if (statusEl)
                  statusEl.textContent = "Google Drive bağlantısı kesildi.";
                // Don't reload - just update button state manually
                this.settings.human.googledrive.connected = false;
                this.settings.human.googledrive.account = "";
                this.updateGoogleDriveButton();
              } else if (statusEl) {
                statusEl.textContent = `Hata: ${res?.message || "kesilemedi"}`;
              }
            } else {
              // Connect - save all credentials first
              const clientIdEl = document.getElementById("settings-googledrive-clientid");
              const clientSecretEl = document.getElementById("settings-googledrive-clientsecret");
              const codeEl = document.getElementById("settings-googledrive-authcode");
              
              const clientId = clientIdEl?.value?.trim() || "";
              const clientSecret = clientSecretEl?.value?.trim() || "";
              const code = codeEl?.value?.trim() || "";
              
              // Save credentials first
              if (clientId) {
                await SettingsManager.set("human.googledrive.clientId", clientId);
              }
              if (clientSecret) {
                await SettingsManager.set("human.googledrive.clientSecret", clientSecret);
              }
              
              if (!code) {
                if (statusEl)
                  statusEl.textContent = "Yetkilendirme kodunu girin.";
                return;
              }
              
              if (statusEl) statusEl.textContent = "Bağlanıyor...";
              
              // Save auth code
              await SettingsManager.set("human.googledrive.authorizationCode", code);
              
              const res = await window.electronAPI?.googledriveExchangeCode?.(code);
              if (res?.success) {
                if (statusEl)
                  statusEl.textContent = `Bağlandı: ${res.account || ""}`;
                // Update local state
                this.settings.human.googledrive.connected = true;
                this.settings.human.googledrive.account = res.account || "";
                this.updateGoogleDriveButton();
              } else {
                if (statusEl)
                  statusEl.textContent = `Bağlantı hatası: ${res?.message || "hata"}`;
              }
            }
          } catch (err) {
            console.error("googledrive toggle error", err);
            const statusEl = document.getElementById("settings-googledrive-status");
            if (statusEl) statusEl.textContent = `Hata: ${err.message}`;
          }
        });
      }

      document
        .getElementById("create-account-btn")
        ?.addEventListener("click", () => {
          this.createAccount();
        });

      // Human nickname update
      document
        .getElementById("settings-human-nickname-update")
        ?.addEventListener("click", async () => {
          const nick = this.getEl("human-nickname")?.value?.trim() || "";
          await SettingsManager.set("human.nickname", nick);
          this.showFeedback("Takma ad güncellendi", "success");
        });

      // Slot method updates (realtime)
      ["ai1", "ai2"].forEach((slot) => {
        this.getEl(`${slot}-message-method`)?.addEventListener(
          "change",
          async (e) => {
            await SettingsManager.set(`${slot}.messageMethod`, e.target.value);
          },
        );
        this.getEl(`${slot}-file-method`)?.addEventListener("change", async (e) => {
          await SettingsManager.set(`${slot}.fileMethod`, e.target.value);
        });
      });

      document
        .getElementById("new-account-avatar-browse")
        ?.addEventListener("click", () => {
          const emailEl = document.getElementById("new-account-email");
          const providerEl = document.getElementById("new-account-provider");
          const accountInfo = {
            email: emailEl?.value?.trim() || "",
            provider: providerEl?.value || "",
          };
          this.browseAvatar("new-account", accountInfo);
        });

      ["ai1", "ai2"].forEach((slot) => {
        const selectEl = document.getElementById(`settings-${slot}-account`);
        if (selectEl) {
          selectEl.addEventListener("change", (e) => {
            const accountId = e.target.value || null;
            this.handleSlotAccountChange(slot, accountId);
          });
        }
      });
    } catch (error) {
      console.error("Error setting up Settings event listeners:", error);
    }
  }

  updateGoogleDriveButton() {
    try {
      const gd = this.settings.human?.googledrive || {};
      const gdStatus = document.getElementById("settings-googledrive-status");
      const gdToggle = document.getElementById("settings-googledrive-toggle");
      
      if (gdStatus)
        gdStatus.textContent = gd.connected ? `Bağlı: ${gd.account || ""}` : "";
      
      // Update toggle button text based on connection state
      if (gdToggle) {
        if (gd.connected) {
          gdToggle.textContent = "Bağlantıyı Kes";
          gdToggle.className = "btn btn-danger";
        } else {
          gdToggle.textContent = "Bağlan";
          gdToggle.className = "btn btn-primary";
        }
      }
    } catch (err) {
      /* noop */
    }
  }

  populateForm() {
    if (!this.settings) return;

    this.populateAccountDropdowns();

    this.getEl("human-nickname").value = this.settings.human.nickname || "User";
    // human-avatar-path input removed
    // Avatar preview removed from UI

    try {
      const gd = this.settings.human?.googledrive || {};
      const gdClient = document.getElementById("settings-googledrive-clientid");
      const gdSecret = document.getElementById(
        "settings-googledrive-clientsecret",
      );
      const gdAuth = document.getElementById("settings-googledrive-authcode");
      
      if (gdClient) gdClient.value = gd.clientId || "";
      if (gdSecret) gdSecret.value = gd.clientSecret || "";
      if (gdAuth) gdAuth.value = gd.authorizationCode || "";
      
      // Update button state
      this.updateGoogleDriveButton();
    } catch (err) {
      /* noop */
    }

    this.updateSlotFromAccount("ai1");
    this.updateSlotFromAccount("ai2");

    this.getEl("ai1-message-method").value =
      this.settings.ai1.messageMethod || this.settings.general.messageMethod;
    this.getEl("ai1-file-method").value =
      this.settings.ai1.fileMethod || this.settings.general.fileMethod;
    this.getEl("ai2-message-method").value =
      this.settings.ai2.messageMethod || this.settings.general.messageMethod;
    this.getEl("ai2-file-method").value =
      this.settings.ai2.fileMethod || this.settings.general.fileMethod;
  }

  updateSlotFromAccount(slot) {
    const activeAccountId = this.settings?.[slot]?.activeAccountId;
    const account = activeAccountId
      ? this.getAccountById?.(activeAccountId)
      : null;

    if (account) {
      this.settings[slot].providerId = account.provider;
      this.settings[slot].nickname = account.nickname;
      this.settings[slot].avatarPath = account.avatarPath || "";
      // Avatar preview removed from UI
    }
  }

  // saveSettings/resetSettings removed: changes are applied immediately

  async browseAvatar(userType, accountInfo = null) {
    try {
      if (window.electronAPI?.showOpenDialog) {
        const result = await window.electronAPI.showOpenDialog({
          filters: [
            {
              name: "Images",
              extensions: ["jpg", "jpeg", "png", "gif", "webp"],
            },
          ],
        });

        let selectedPath = null;
        try {
          if (!result) selectedPath = null;
          else if (typeof result === "string") selectedPath = result;
          else if (Array.isArray(result) && result.length)
            selectedPath = result[0];
          else if (
            result.filePaths &&
            Array.isArray(result.filePaths) &&
            result.filePaths.length
          )
            selectedPath = result.filePaths[0];
          else if (result.path && typeof result.path === "string")
            selectedPath = result.path;
        } catch (err) {
          selectedPath = null;
        }

        if (selectedPath) {
          if (userType === "new-account") {
            // Preview only; copy will happen when creating the account
            this._newAccountAvatarSourcePath = selectedPath;
            this.updateNewAccountAvatarPreview(selectedPath);
            return;
          }

          const roleName = userType === "human" ? "user" : userType;
          const copied = await window.electronAPI?.copyToAssets?.(
            selectedPath,
            roleName,
            accountInfo,
          );
          const targetPath = copied?.path || selectedPath;

          if (userType === "human") {
            await SettingsManager.set("human.avatarPath", targetPath);
            // Avatar preview removed from UI
          } else {
            // Avatar preview removed from UI
          }
        } else {
          LogManager.addEvent(
            "settings",
            "warning",
            "Avatar seçimi iptal edildi veya geçersiz yol döndü",
          );
        }
      } else {
        const input = document.createElement("input");
        input.type = "file";
        input.accept = "image/*";
        input.onchange = (e) => {
          const file = e.target.files[0];
          if (file) {
            const url = URL.createObjectURL(file);
            if (userType === "human") {
              SettingsManager.set("human.avatarPath", url);
              // Avatar preview removed from UI
            } else if (userType === "new-account") {
              this._newAccountAvatarSourcePath = url;
              this.updateNewAccountAvatarPreview(url);
            } else {
              // Avatar preview removed from UI
            }
          }
        };
        input.click();
      }
    } catch (error) {
      console.error("Error browsing avatar:", error);
      LogManager.addEvent(
        "settings",
        "error",
        `Avatar seçilirken hata: ${error.message}`,
      );
    }
  }

  // updateAvatarPreview removed - avatar previews removed from settings UI

  async updateNewAccountAvatarPreview(avatarPath) {
    const previewEl = document.getElementById("new-account-avatar-preview");
    if (!previewEl) return;

    if (!avatarPath) {
      previewEl.innerHTML = '<div class="avatar-placeholder-text">Avatar seçilmedi</div>';
      return;
    }

    // Check if it's a URL (blob) or file path
    if (avatarPath.startsWith("blob:")) {
      previewEl.innerHTML = `<img src="${avatarPath}" alt="New account avatar">`;
      return;
    }

    // File path - read via electron API
    if (window.electronAPI?.readFile) {
      try {
        const data = await window.electronAPI.readFile(avatarPath);
        if (!data) {
          previewEl.innerHTML = '<div class="avatar-placeholder-text">Avatar yüklenemedi</div>';
          return;
        }
        const ext = avatarPath.split(".").pop().toLowerCase();
        const mimeTypes = {
          jpg: "image/jpeg",
          jpeg: "image/jpeg",
          png: "image/png",
          gif: "image/gif",
          webp: "image/webp",
        };
        const mimeType = mimeTypes[ext] || "image/png";
        previewEl.innerHTML = `<img src="data:${mimeType};base64,${data}" alt="New account avatar">`;
      } catch (err) {
        previewEl.innerHTML = '<div class="avatar-placeholder-text">Avatar yüklenemedi</div>';
      }
    }
  }

  onShow() {
    this.loadSettings().then(() => {
      this.populateForm();
      this.renderAccountList();
      this.populateAccountDropdowns();
    });
  }

  renderAccountList() {
    const accountListEl = document.getElementById("account-list");
    if (!accountListEl) return;

    const accounts = this.settings?.accounts || [];
    accountListEl.innerHTML = "";

    if (accounts.length === 0) {
      accountListEl.innerHTML =
        '<div class="empty-message">Henüz hesap yok</div>';
      return;
    }

    accounts.forEach((account) => {
      const item = document.createElement("div");
      item.className = "account-item";
      item.innerHTML = `
        <div class="account-info">
          <div class="account-avatar" id="account-avatar-${account.id}">
            <div class="avatar-placeholder">👤</div>
          </div>
          <div class="account-details">
            <div class="account-email">${this.escapeHtml(account.email)}</div>
            <div class="account-nickname">${this.escapeHtml(account.nickname || account.email)}</div>
            <div class="account-provider">Provider: ${this.escapeHtml(account.provider)}</div>
          </div>
        </div>
        <div class="account-actions">
          <button class="btn btn-sm btn-danger account-delete-btn" data-account-id="${account.id}">Sil</button>
        </div>
      `;

      const deleteBtn = item.querySelector(".account-delete-btn");
      deleteBtn.addEventListener("click", () => this.deleteAccount(account.id));

      accountListEl.appendChild(item);

      // Update account avatar preview in the list
      if (account.avatarPath) {
        this.updateAccountAvatarPreview(account.id, account.avatarPath);
      }
    });
  }

  populateAccountDropdowns() {
    const ai1Select = document.getElementById("settings-ai1-account");
    const ai2Select = document.getElementById("settings-ai2-account");

    if (!ai1Select || !ai2Select) return;

    const accounts = this.settings?.accounts || [];
    const optionsHTML =
      '<option value="">-- Hesap Seç --</option>' +
      accounts
        .map(
          (acc) =>
            `<option value="${acc.id}">${this.escapeHtml(acc.nickname || acc.email)}</option>`,
        )
        .join("");

    ai1Select.innerHTML = optionsHTML;
    ai2Select.innerHTML = optionsHTML;

    ai1Select.value = this.settings?.ai1?.activeAccountId || "";
    ai2Select.value = this.settings?.ai2?.activeAccountId || "";
  }

  async createAccount() {
    const emailEl = document.getElementById("new-account-email");
    const providerEl = document.getElementById("new-account-provider");
    const nicknameEl = document.getElementById("new-account-nickname");
    const email = emailEl?.value?.trim();
    const provider = providerEl?.value;
    const nickname = nicknameEl?.value?.trim();
    const avatarPath = this._newAccountAvatarSourcePath || "";

    if (!email || !provider) {
      this.showFeedback("Email ve provider zorunludur", "error");
      return;
    }

    const accountData = {
      email,
      provider,
      nickname: nickname || email,
      avatarPath: avatarPath || "",
    };

    // Persist via main process (create-account IPC)
    const result = await window.electronAPI?.createAccount?.(accountData);
    if (result?.success) {
      // reload from central storage and publish
      await SettingsManager.reload();
    }
    if (result?.success) {
      this.showFeedback("Hesap başarıyla oluşturuldu", "success");
      await this.loadSettings();
      this.renderAccountList();
      this.populateAccountDropdowns();

      emailEl.value = "";
      nicknameEl.value = "";
      this._newAccountAvatarSourcePath = "";
      this.updateNewAccountAvatarPreview(""); // Clear preview
    } else {
      this.showFeedback(`Hesap oluşturulamadı: ${result?.message || result?.error || "hata"}`,
        "error",
      );
    }
  }

  async deleteAccount(accountId) {
    if (!confirm("Bu hesabı silmek istediğinize emin misiniz?")) {
      return;
    }

    try {
      this.settings.accounts = this.settings.accounts.filter(
        (acc) => acc.id !== accountId,
      );

      const ai1Id = this.settings.ai1?.activeAccountId;
      const ai2Id = this.settings.ai2?.activeAccountId;

      if (ai1Id === accountId) {
        this.settings.ai1.activeAccountId = null;
      }
      if (ai2Id === accountId) {
        this.settings.ai2.activeAccountId = null;
      }

      await SettingsManager.save(this.settings);

      this.showFeedback("Hesap silindi", "success");
      this.loadSettings().then(() => {
        this.renderAccountList();
        this.populateAccountDropdowns();
        this.populateForm();
      });
    } catch (error) {
      console.error("Hesap silme hatası:", error);
      this.showFeedback("Hesap silinirken hata oluştu", "error");
    }
  }

  async updateAccountAvatarPreview(accountId, avatarPath) {
    const previewEl = document.getElementById(`account-avatar-${accountId}`);
    if (!previewEl) return;

    if (avatarPath && window.electronAPI?.readFile) {
      window.electronAPI
        .readFile(avatarPath)
        .then((data) => {
          if (!data) return;
          const ext = avatarPath.split(".").pop().toLowerCase();
          const mimeTypes = {
            jpg: "image/jpeg",
            jpeg: "image/jpeg",
            png: "image/png",
            gif: "image/gif",
            webp: "image/webp",
          };
          const mimeType = mimeTypes[ext] || "image/png";
          previewEl.innerHTML = `<img src="data:${mimeType};base64,${data}" alt="Account avatar">`;
        })
        .catch(() => {});
    } else {
      previewEl.innerHTML = '<div class="avatar-placeholder">👤</div>';
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

  // setupAccountEventListeners is deprecated; listeners are wired in setupEventListeners()

  async handleSlotAccountChange(slot, accountId) {
    const result = await window.electronAPI?.assignAccountToSlot?.(slot, accountId);
    if (result?.success) {
      await SettingsManager.reload();
    }
    if (result?.success) {
      this.showFeedback(`${slot.toUpperCase()} slotu güncellendi`, "success");
      await this.loadSettings();
      this.populateForm();
      this.populateAccountDropdowns();
    } else {
      this.showFeedback(`Slot atama hatası: ${result?.message || result?.error || "hata"}`,
        "error",
      );
    }
  }
}
