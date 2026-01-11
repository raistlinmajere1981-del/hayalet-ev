
export class GoogleDriveSection {
  constructor(settingsManager) {
    this.settingsManager = settingsManager;
  }

  init() {
    this.setupListeners();
    this.render();
  }

  setupListeners() {
    const startBtn = document.getElementById("settings-googledrive-start");
    if (startBtn) {
      startBtn.addEventListener("click", () => this.startAuth());
    }

    const toggleBtn = document.getElementById("settings-googledrive-toggle");
    if (toggleBtn) {
      toggleBtn.addEventListener("click", () => this.toggleConnection());
    }

    const authCodeEl = /** @type {HTMLInputElement|null} */ (
      document.getElementById("settings-googledrive-authcode")
    );
    if (authCodeEl) {
      authCodeEl.addEventListener("change", (e) => {
        const target = /** @type {HTMLInputElement} */ (e.target);
        this.saveAuthCode(target.value);
      });
      authCodeEl.addEventListener("blur", (e) => {
        const target = /** @type {HTMLInputElement} */ (e.target);
        this.saveAuthCode(target.value);
      });
    }
  }

  async render() {
    const settings = this.settingsManager.getSnapshot();
    const gd = settings?.integrations?.googledrive || {};

    const clientIdEl = /** @type {HTMLInputElement|null} */ (
      document.getElementById("settings-googledrive-clientid")
    );
    const clientSecretEl = /** @type {HTMLInputElement|null} */ (
      document.getElementById("settings-googledrive-clientsecret")
    );
    const authCodeEl = /** @type {HTMLInputElement|null} */ (
      document.getElementById("settings-googledrive-authcode")
    );

    if (clientIdEl) clientIdEl.value = gd.clientId || "";
    if (clientSecretEl) clientSecretEl.value = gd.clientSecret || "";
    if (authCodeEl) authCodeEl.value = gd.authorizationCode || "";

    const statusEl = document.getElementById("settings-googledrive-status");
    const toggleBtn = document.getElementById("settings-googledrive-toggle");

    if (statusEl) {
      statusEl.textContent = gd.connected ? "Bağlı" : "Bağlı değil";
      statusEl.className = gd.connected
        ? "status-connected"
        : "status-disconnected";
    }

    if (toggleBtn) {
      toggleBtn.textContent = gd.connected ? "Bağlantıyı kes" : "Bağlan";
    }
  }

  async startAuth() {
    try {
      const res = await window.electronAPI?.googledriveStartAuth?.();
      const statusEl = document.getElementById("settings-googledrive-status");
      if (statusEl) {
        statusEl.textContent = res?.authUrl
          ? "Tarayıcı açıldı, kodu kopyalayın"
          : "Hata";
        statusEl.className = res?.authUrl ? "status-info" : "status-error";
      }
      if (res?.authUrl) {
        this.showFeedback(
          "Tarayıcıda Google OAuth açıldı, kodu kopyalayın",
          "info",
        );
      } else {
        this.showFeedback("OAuth başlatma hatası", "error");
      }
    } catch (err) {
      console.error("Google Drive start auth error:", err);
      this.showFeedback(`OAuth başlatma hatası: ${err.message}`, "error");
    }
  }

  async toggleConnection() {
    const settings = this.settingsManager.getSnapshot();
    const gd = settings?.integrations?.googledrive || {};
    const isConnected = gd.connected || false;

    if (isConnected) {
      try {
        const res = await window.electronAPI?.googledriveDisconnect?.();
        if (res?.success) {
          const updated = {
            ...settings,
            integrations: {
              ...settings.integrations,
              googledrive: { ...gd, connected: false, account: "" },
            },
          };
          await this.settingsManager.save(updated);
          await this.render();
          this.showFeedback("Google Drive bağlantısı kesildi", "success");
        } else {
          this.showFeedback("Bağlantı kesme hatası", "error");
        }
      } catch (err) {
        console.error("Google Drive disconnect error:", err);
        this.showFeedback(`Bağlantı kesme hatası: ${err.message}`, "error");
      }
    } else {
      const clientIdEl = /** @type {HTMLInputElement|null} */ (
        document.getElementById("settings-googledrive-clientid")
      );
      const clientSecretEl = /** @type {HTMLInputElement|null} */ (
        document.getElementById("settings-googledrive-clientsecret")
      );
      const codeEl = /** @type {HTMLInputElement|null} */ (
        document.getElementById("settings-googledrive-authcode")
      );

      const clientId = clientIdEl?.value?.trim() || "";
      const clientSecret = clientSecretEl?.value?.trim() || "";
      const code = codeEl?.value?.trim() || "";

      if (!clientId || !clientSecret || !code) {
        this.showFeedback(
          "Client ID, Client Secret ve Authorization Code gerekli",
          "error",
        );
        return;
      }

      try {
        const updated = {
          ...settings,
          integrations: {
            ...settings.integrations,
            googledrive: {
              ...gd,
              clientId,
              clientSecret,
              authorizationCode: code,
            },
          },
        };
        await this.settingsManager.save(updated);

        const res = await window.electronAPI?.googledriveExchangeCode?.(code);
        if (res?.success) {
          const finalUpdated = {
            ...updated,
            integrations: {
              ...updated.integrations,
              googledrive: {
                ...updated.integrations.googledrive,
                connected: true,
                account: res.account || "",
              },
            },
          };
          await this.settingsManager.save(finalUpdated);
          await this.render();
          this.showFeedback("Google Drive bağlandı", "success");
        } else {
          this.showFeedback(`Bağlantı hatası: ${res?.error || "bilinmeyen"}`, "error");
        }
      } catch (err) {
        console.error("Google Drive connect error:", err);
        this.showFeedback(`Bağlantı hatası: ${err.message}`, "error");
      }
    }
  }

  async saveAuthCode(code) {
    const trimmed = String(code || "").trim();
    if (!trimmed) return;

    const settings = this.settingsManager.getSnapshot();
    const gd = settings?.integrations?.googledrive || {};
    const updated = {
      ...settings,
      integrations: {
        ...settings.integrations,
        googledrive: { ...gd, authorizationCode: trimmed },
      },
    };
    await this.settingsManager.save(updated);
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
