import { Logger } from "../../modules/logger/index.js";
import { LogCategory } from "@shared/logging-core";
import { getErrorMessage } from "@shared/index.js";
import type { AppSettings, GoogleDriveSettings } from "@shared/settings.js";

interface SettingsManager {
  getSnapshot(): AppSettings;
  save(settings: Record<string, unknown>): Promise<boolean>;
}

interface GDriveExchangeCodeResult {
  success?: boolean;
  account?: string;
}

function isGDriveExchangeCodeResult(value: unknown): value is GDriveExchangeCodeResult {
  if (value === null || value === undefined || typeof value !== "object") {
    return false;
  }
  const maybe = value as Record<string, unknown>;
  const successIsValid = maybe["success"] === undefined || typeof maybe["success"] === "boolean";
  const accountIsValid = maybe["account"] === undefined || typeof maybe["account"] === "string";
  return successIsValid && accountIsValid;
}

export class UserPanel {
  settingsManager: SettingsManager;

  constructor(settingsManager: SettingsManager) {
    this.settingsManager = settingsManager;
  }

  init(): void {
    this.setupListeners();
    this.render();
  }

  setupListeners(): void {
    const nickInput = document.getElementById("user-nickname-input") as HTMLInputElement | null;
    if (nickInput) {
      nickInput.addEventListener("blur", () => {
        void this.saveNickname();
      });
      nickInput.addEventListener("keydown", (e) => {
        if (e.key === "Enter") {
          nickInput.blur(); // Triggers save via blur
        }
      });
    }

    document.getElementById("user-avatar-edit-btn")?.addEventListener("click", () => {
      void this.browseAvatar();
    });

    document.getElementById("gdrive-start-auth")?.addEventListener("click", () => {
      void this.startGDriveAuth();
    });
    document.getElementById("gdrive-connect-btn")?.addEventListener("click", () => {
      void this.toggleGDriveConnection();
    });
    document.getElementById("gdrive-auth-code")?.addEventListener("change", (e) => {
      void this.saveGDriveCode((e.target as HTMLInputElement).value);
    });

    document.getElementById("app-language-select")?.addEventListener("change", (e) => {
      void this.saveAppLanguage((e.target as HTMLSelectElement).value);
    });
  }

  render(): void {
    const settings = this.settingsManager.getSnapshot();
    const user = settings.user ?? {};
    const integrations = settings.integrations ?? {};
    const gd = (integrations.googledrive ?? {}) as Partial<GoogleDriveSettings> & {
      clientId?: string;
      clientSecret?: string;
      authorizationCode?: string;
    };

    const nickInput = document.getElementById("user-nickname-input") as HTMLInputElement | null;
    if (nickInput && document.activeElement !== nickInput) {
      nickInput.value = user.nickname ?? "Kullanıcı";
    }

    const gdStatus = document.getElementById("gdrive-status-dot");
    const gdText = document.getElementById("gdrive-status-text");
    const gdBtn = document.getElementById("gdrive-connect-btn");
    const isConnected = gd.connected === true;

    if (gdStatus) {
      gdStatus.style.backgroundColor = isConnected ? "#4CAF50" : "#ccc";
    }
    if (gdText) {
      gdText.textContent = isConnected ? "Drive Bağlı" : "Drive Bağlı Değil";
    }
    if (gdBtn) {
      gdBtn.textContent = isConnected ? "Bağlantıyı Kes" : "Bağlan";
      gdBtn.classList.toggle("btn-danger", isConnected);
      gdBtn.classList.toggle("btn-primary", !isConnected);
    }

    const clientIdEl = document.getElementById("gdrive-client-id") as HTMLInputElement | null;
    const clientSecretEl = document.getElementById(
      "gdrive-client-secret"
    ) as HTMLInputElement | null;
    const authCodeEl = document.getElementById("gdrive-auth-code") as HTMLInputElement | null;
    const appLanguageEl = document.getElementById(
      "app-language-select"
    ) as HTMLSelectElement | null;

    if (clientIdEl) clientIdEl.value = gd.clientId ?? "";
    if (clientSecretEl) clientSecretEl.value = gd.clientSecret ?? "";
    if (authCodeEl) authCodeEl.value = gd.authorizationCode ?? "";
    if (appLanguageEl) appLanguageEl.value = settings.general?.language ?? "tr";
  }

  async saveAppLanguage(language: string): Promise<void> {
    const nextLanguage = language === "en" ? "en" : "tr";
    const current = this.settingsManager.getSnapshot();

    if (current.general?.language === nextLanguage) {
      return;
    }

    const updated = {
      ...current,
      general: { ...current.general, language: nextLanguage },
    };
    await this.settingsManager.save(updated);
  }

  async saveNickname(): Promise<void> {
    const input = document.getElementById("user-nickname-input") as HTMLInputElement | null;
    const nick = input?.value.trim() ?? "";

    if (nick !== "") {
      const current = this.settingsManager.getSnapshot();
      if (current.user?.nickname === nick) return;

      const updated = {
        ...current,
        user: { ...current.user, nickname: nick },
      };
      await this.settingsManager.save(updated);
    } else {
      this.render();
    }
  }

  async browseAvatar(): Promise<void> {
    try {
      const electronApi = window.electronAPI;
      if (!electronApi) return;
      const result = await electronApi.showOpenDialog({
        title: "Avatar seç",
        buttonLabel: "Seç",
        filters: [{ name: "Resimler", extensions: ["png", "jpg", "jpeg", "gif", "webp"] }],
        properties: ["openFile"],
      });

      if (result.canceled === true || result.filePaths.length === 0) return;

      const selectedPath = result.filePaths[0] ?? "";
      if (selectedPath === "") return;
      const copied = await electronApi.copyToAssets(selectedPath, "user", null);
      const targetPath = copied?.path ?? selectedPath;

      const current = this.settingsManager.getSnapshot();
      const updated = {
        ...current,
        user: { ...current.user, avatarPath: targetPath },
      };
      await this.settingsManager.save(updated);
    } catch (err) {
      Logger.error(LogCategory.ENTRANCE, `User avatar hatası: ${getErrorMessage(err)}`);
    }
  }

  async startGDriveAuth(): Promise<void> {
    try {
      const electronApi = window.electronAPI;
      if (!electronApi) return;
      await electronApi.googledriveStartAuth();
    } catch (err) {
      Logger.error(LogCategory.ENTRANCE, `GDrive auth hatası: ${getErrorMessage(err)}`);
    }
  }

  async saveGDriveCode(code: string): Promise<void> {
    const trimmed = String(code).trim();
    if (trimmed === "") return;
    const settings = this.settingsManager.getSnapshot();
    const integrations = settings.integrations ?? {};
    const gd = (integrations.googledrive ?? {}) as Partial<GoogleDriveSettings> & {
      authorizationCode?: string;
    };
    const updated = {
      ...settings,
      integrations: {
        ...settings.integrations,
        googledrive: { ...gd, authorizationCode: trimmed },
      },
    };
    await this.settingsManager.save(updated);
  }

  async toggleGDriveConnection(): Promise<void> {
    const settings = this.settingsManager.getSnapshot();
    const integrations = settings.integrations ?? {};
    const gd = (integrations.googledrive ?? {}) as Partial<GoogleDriveSettings>;
    const electronApi = window.electronAPI;
    if (!electronApi) return;

    if (gd.connected === true) {
      try {
        await electronApi.googledriveDisconnect();
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
        Logger.error(LogCategory.ENTRANCE, `GDrive disconnect hatası: ${getErrorMessage(e)}`);
      }
    } else {
      const clientId = (
        document.getElementById("gdrive-client-id") as HTMLInputElement
      ).value.trim();
      const clientSecret = (
        document.getElementById("gdrive-client-secret") as HTMLInputElement
      ).value.trim();
      const code = (document.getElementById("gdrive-auth-code") as HTMLInputElement).value.trim();

      if (clientId === "" || clientSecret === "" || code === "") return;

      const updated = {
        ...settings,
        integrations: {
          ...settings.integrations,
          googledrive: { ...gd, clientId, clientSecret, authorizationCode: code },
        },
      };
      await this.settingsManager.save(updated);

      try {
        const rawRes: unknown = await electronApi.googledriveExchangeCode(code);
        const res = isGDriveExchangeCodeResult(rawRes) ? rawRes : null;
        if (res?.success === true) {
          const finalUpdated = {
            ...updated,
            integrations: {
              ...updated.integrations,
              googledrive: {
                ...updated.integrations.googledrive,
                connected: true,
                account: res.account ?? "",
              },
            },
          };
          await this.settingsManager.save(finalUpdated);
          this.render();
        }
      } catch (e) {
        Logger.error(LogCategory.ENTRANCE, `GDrive code exchange hatası: ${getErrorMessage(e)}`);
      }
    }
  }
}
