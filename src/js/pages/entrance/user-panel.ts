import { LogManager } from "../../modules/log-manager.js";
import { getErrorMessage } from "../../types/index.js";
import type { AppSettings, GoogleDriveSettings } from "../../types/settings.js";

interface SettingsManager {
  getSnapshot(): AppSettings;
  save(settings: Record<string, unknown>): Promise<boolean>;
}

export class UserPanel {
  settingsManager: SettingsManager;

  constructor(settingsManager: SettingsManager) {
    this.settingsManager = settingsManager;
  }

  init() {
    this.setupListeners();
    this.render();
  }

  setupListeners() {
    // Direct Nickname Edit (Blur & Enter)
    const nickInput = document.getElementById("user-nickname-input") as HTMLInputElement | null;
    if (nickInput) {
        nickInput.addEventListener("blur", () => this.saveNickname());
        nickInput.addEventListener("keydown", (e) => {
            if (e.key === "Enter") {
                nickInput.blur(); // Triggers save via blur
            }
        });
    }

    // Avatar Update
    document.getElementById("user-avatar-edit-btn")?.addEventListener("click", () => {
        this.browseAvatar();
    });

    // Google Drive - just auth buttons, no panel toggling anymore
    document.getElementById("gdrive-start-auth")?.addEventListener("click", () => this.startGDriveAuth());
    document.getElementById("gdrive-connect-btn")?.addEventListener("click", () => this.toggleGDriveConnection());
    document.getElementById("gdrive-auth-code")?.addEventListener("change", (e) => this.saveGDriveCode((e.target as HTMLInputElement).value));
  }

  async render() {
    const settings = this.settingsManager.getSnapshot();
    const user = settings?.user || {};
    const gd = (settings?.integrations?.googledrive || {}) as Partial<GoogleDriveSettings> & { clientId?: string; clientSecret?: string; authorizationCode?: string };

    // User Nickname - Directly update input value
    const nickInput = document.getElementById("user-nickname-input") as HTMLInputElement | null;
    if (nickInput && document.activeElement !== nickInput) {
        nickInput.value = user.nickname || "Kullanıcı";
    }

    // Google Drive Status
    const gdStatus = document.getElementById("gdrive-status-dot") as HTMLElement | null;
    const gdText = document.getElementById("gdrive-status-text");
    const gdBtn = document.getElementById("gdrive-connect-btn");
    
    if (gdStatus) {
        gdStatus.style.backgroundColor = gd.connected ? "#4CAF50" : "#ccc";
    }
    if (gdText) {
        gdText.textContent = gd.connected ? "Drive Bağlı" : "Drive Bağlı Değil";
    }
    if (gdBtn) {
        gdBtn.textContent = gd.connected ? "Bağlantıyı Kes" : "Bağlan";
        gdBtn.classList.toggle("btn-danger", gd.connected);
        gdBtn.classList.toggle("btn-primary", !gd.connected);
    }

    const clientIdEl = document.getElementById("gdrive-client-id") as HTMLInputElement | null;
    const clientSecretEl = document.getElementById("gdrive-client-secret") as HTMLInputElement | null;
    const authCodeEl = document.getElementById("gdrive-auth-code") as HTMLInputElement | null;

    if (clientIdEl) clientIdEl.value = gd.clientId || "";
    if (clientSecretEl) clientSecretEl.value = gd.clientSecret || "";
    if (authCodeEl) authCodeEl.value = gd.authorizationCode || "";
  }

  async saveNickname() {
    const input = document.getElementById("user-nickname-input") as HTMLInputElement | null;
    const nick = input?.value?.trim() || "";
    
    if (nick) {
        const current = this.settingsManager.getSnapshot();
        // Only save if changed
        if (current.user?.nickname === nick) return;

        const updated = {
            ...current,
            user: { ...current.user, nickname: nick }
        };
        await this.settingsManager.save(updated);
    } else {
        // Revert if empty
        this.render();
    }
  }

  async browseAvatar() {
    try {
      const result = await window.electronAPI?.showOpenDialog({
        title: "Avatar seç",
        buttonLabel: "Seç",
        filters: [{ name: "Resimler", extensions: ["png", "jpg", "jpeg", "gif", "webp"] }],
        properties: ["openFile"],
      });

      if (result?.canceled || !result?.filePaths?.length) return;

      const selectedPath = result.filePaths[0];
      if (!selectedPath) return;
      const copied = await window.electronAPI?.copyToAssets(selectedPath, "user", null);
      const targetPath = copied?.path || selectedPath;

      const current = this.settingsManager.getSnapshot();
      const updated = {
        ...current,
        user: { ...current.user, avatarPath: targetPath },
      };
      await this.settingsManager.save(updated);
    } catch (err) {
      LogManager.addEvent("entrance", "error", `User avatar hatası: ${getErrorMessage(err)}`);
    }
  }

  // Google Drive Logic (Simplified)
  async startGDriveAuth() {
    try {
        await window.electronAPI?.googledriveStartAuth?.();
    } catch (err) {
        LogManager.addEvent("entrance", "error", `GDrive auth hatası: ${getErrorMessage(err)}`);
    }
  }

  async saveGDriveCode(code: string) {
    const trimmed = String(code || "").trim();
    if (!trimmed) return;
    const settings = this.settingsManager.getSnapshot();
    const gd = (settings?.integrations?.googledrive || {}) as Partial<GoogleDriveSettings> & { authorizationCode?: string };
    const updated = {
      ...settings,
      integrations: {
        ...settings.integrations,
        googledrive: { ...gd, authorizationCode: trimmed },
      },
    };
    await this.settingsManager.save(updated);
  }

  async toggleGDriveConnection() {
    const settings = this.settingsManager.getSnapshot();
    const gd = (settings?.integrations?.googledrive || {}) as Partial<GoogleDriveSettings>;
    
    if (gd.connected) {
        try {
            await window.electronAPI?.googledriveDisconnect?.();
            const updated = {
                ...settings,
                integrations: {
                    ...settings.integrations,
                    googledrive: { ...gd, connected: false, account: "" },
                },
            };
            await this.settingsManager.save(updated);
            this.render();
        } catch (e) {
            LogManager.addEvent("entrance", "error", `GDrive disconnect hatası: ${getErrorMessage(e)}`);
        }
    } else {
        const clientId = (document.getElementById("gdrive-client-id") as HTMLInputElement)?.value?.trim() || "";
        const clientSecret = (document.getElementById("gdrive-client-secret") as HTMLInputElement)?.value?.trim() || "";
        const code = (document.getElementById("gdrive-auth-code") as HTMLInputElement)?.value?.trim() || "";

        if (!clientId || !clientSecret || !code) return;

        const updated = {
            ...settings,
            integrations: {
                ...settings.integrations,
                googledrive: { ...gd, clientId, clientSecret, authorizationCode: code },
            },
        };
        await this.settingsManager.save(updated);

        try {
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
                this.render();
            }
        } catch (e) {
            LogManager.addEvent("entrance", "error", `GDrive code exchange hatası: ${getErrorMessage(e)}`);
        }
    }
  }
}