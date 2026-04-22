import { Logger } from "../../../modules/logger/index.js";
import { LogCategory } from "@shared/logging-core";
import { DEFAULT_APP_LANGUAGE, type AppLanguage, type LanguageDescriptor } from "@shared/i18n.js";
import type {
  TranscriptManagedModelId,
  TranscriptManagedModelStatus,
  TranscriptModelVariant,
  TranscriptRuntimeStatus,
} from "@shared/transcript.js";
import { getErrorMessage } from "@shared/index.js";
import { normalizeAppLanguage } from "../../../../../shared/i18n/locale.js";
import { AppI18n, formatLanguageLabel } from "../../../modules/i18n/index.js";
import type { AppSettings, GoogleDriveSettings } from "@shared/settings.js";
import {
  ensureTranscriptRuntime,
  getTranscriptStatus,
  installTranscriptModel,
  listTranscriptModels,
  removeTranscriptModel,
} from "../../../modules/transcript/electron-client.js";
import { t as entranceT } from "../panel-i18n.js";

interface SettingsManager {
  getSnapshot(): AppSettings;
  save(settings: Record<string, unknown>): Promise<boolean>;
}

interface GDriveExchangeCodeResult {
  success?: boolean;
  account?: string;
}

type TranscriptPanelBusyState =
  | {
      kind: "refresh" | "ensure";
      modelId?: null;
    }
  | {
      kind: "install" | "remove";
      modelId: TranscriptManagedModelId;
    }
  | null;

type TranscriptRuntimePanelState = {
  busy: TranscriptPanelBusyState;
  error: string | null;
  loaded: boolean;
  models: TranscriptManagedModelStatus[];
  status: TranscriptRuntimeStatus | null;
};

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
  languageRenderVersion: number;
  transcriptPanelState: TranscriptRuntimePanelState;

  constructor(settingsManager: SettingsManager) {
    this.settingsManager = settingsManager;
    this.languageRenderVersion = 0;
    this.transcriptPanelState = {
      busy: null,
      error: null,
      loaded: false,
      models: [],
      status: null,
    };
  }

  init(): void {
    this.setupListeners();
    void this.renderLanguageSection(DEFAULT_APP_LANGUAGE);
    this.render();
    void this.refreshTranscriptRuntimePanel();
  }

  setupListeners(): void {
    const nickInput = document.getElementById("user-nickname-input") as HTMLInputElement | null;
    const avatarEditBtn = document.getElementById("user-avatar-edit-btn");
    if (nickInput) {
      nickInput.addEventListener("blur", (): void => {
        void this.saveNickname();
      });
      nickInput.addEventListener("keydown", (e): void => {
        if (e.key === "Enter") {
          nickInput.blur();
        }
      });
    }

    const handleAvatarEdit = (): void => {
      void this.browseAvatar();
    };

    if (avatarEditBtn instanceof HTMLElement) {
      avatarEditBtn.onclick = (): void => {
        handleAvatarEdit();
      };
      avatarEditBtn.onkeydown = (event: KeyboardEvent): void => {
        if (event.key !== "Enter" && event.key !== " ") {
          return;
        }

        event.preventDefault();
        handleAvatarEdit();
      };
    }

    const gdriveStartAuthBtn = document.getElementById("gdrive-start-auth");
    if (gdriveStartAuthBtn instanceof HTMLElement) {
      gdriveStartAuthBtn.onclick = (): void => {
        void this.startGDriveAuth();
      };
    }

    const gdriveConnectBtn = document.getElementById("gdrive-connect-btn");
    if (gdriveConnectBtn instanceof HTMLElement) {
      gdriveConnectBtn.onclick = (): void => {
        void this.toggleGDriveConnection();
      };
    }

    const gdriveAuthCodeInput = document.getElementById(
      "gdrive-auth-code"
    ) as HTMLInputElement | null;
    if (gdriveAuthCodeInput !== null) {
      gdriveAuthCodeInput.onchange = (event): void => {
        void this.saveGDriveCode((event.target as HTMLInputElement).value);
      };
    }

    const appLanguageSelect = document.getElementById(
      "app-language-select"
    ) as HTMLSelectElement | null;
    if (appLanguageSelect !== null) {
      appLanguageSelect.onchange = (event): void => {
        void this.saveAppLanguage((event.target as HTMLSelectElement).value);
      };
    }

    const transcriptProfileSelect = document.getElementById(
      "app-transcript-profile-select"
    ) as HTMLSelectElement | null;
    if (transcriptProfileSelect !== null) {
      transcriptProfileSelect.onchange = (event): void => {
        void this.saveTranscriptModelVariant((event.target as HTMLSelectElement).value);
      };
    }

    const transcriptRuntimeEnsureBtn = document.getElementById("app-transcript-runtime-ensure-btn");
    if (transcriptRuntimeEnsureBtn instanceof HTMLElement) {
      transcriptRuntimeEnsureBtn.onclick = (): void => {
        void this.ensureActiveTranscriptRuntime();
      };
    }

    const transcriptRuntimeRefreshBtn = document.getElementById(
      "app-transcript-runtime-refresh-btn"
    );
    if (transcriptRuntimeRefreshBtn instanceof HTMLElement) {
      transcriptRuntimeRefreshBtn.onclick = (): void => {
        void this.refreshTranscriptRuntimePanel();
      };
    }

    const transcriptRuntimeModels = document.getElementById("app-transcript-runtime-models");
    if (transcriptRuntimeModels instanceof HTMLElement) {
      transcriptRuntimeModels.addEventListener("click", (event): void => {
        const target = event.target instanceof HTMLElement ? event.target : null;
        const button = target?.closest<HTMLElement>("[data-transcript-model-action]");
        if (!(button instanceof HTMLElement)) {
          return;
        }

        const modelId = this.normalizeTranscriptModelId(button.dataset["transcriptModelId"]);
        if (modelId === null) {
          return;
        }

        const action = button.dataset["transcriptModelAction"];
        if (action === "install") {
          void this.installTranscriptRuntimeModel(modelId);
          return;
        }
        if (action === "remove") {
          void this.removeTranscriptRuntimeModel(modelId);
        }
      });
    }
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
      nickInput.value = user.nickname ?? entranceT("user.defaultNickname");
    }

    const gdStatus = document.getElementById("gdrive-status-dot");
    const gdBtn = document.getElementById("gdrive-connect-btn");
    const isConnected = gd.connected === true;
    const driveStatusLabel = isConnected
      ? AppI18n.t("entrance.user.googleDrive.connected")
      : AppI18n.t("entrance.user.googleDrive.disconnected");

    if (gdStatus instanceof HTMLElement) {
      gdStatus.classList.toggle("is-connected", isConnected);
      gdStatus.classList.toggle("is-error", !isConnected);
      gdStatus.classList.remove("is-warning");
      gdStatus.title = driveStatusLabel;
      gdStatus.setAttribute("aria-label", driveStatusLabel);
    }
    if (gdBtn) {
      gdBtn.textContent = isConnected
        ? AppI18n.t("entrance.user.googleDrive.disconnect")
        : AppI18n.t("entrance.user.googleDrive.connect");
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
    const transcriptProfileLabelEl = document.getElementById("app-transcript-profile-label");
    const transcriptProfileEl = document.getElementById(
      "app-transcript-profile-select"
    ) as HTMLSelectElement | null;
    const transcriptProfileHintEl = document.getElementById("app-transcript-profile-hint");

    if (clientIdEl) clientIdEl.value = gd.clientId ?? "";
    if (clientSecretEl) clientSecretEl.value = gd.clientSecret ?? "";
    if (authCodeEl) authCodeEl.value = gd.authorizationCode ?? "";
    if (appLanguageEl) {
      appLanguageEl.value = settings.general?.language ?? DEFAULT_APP_LANGUAGE;
    }
    if (transcriptProfileLabelEl) {
      transcriptProfileLabelEl.textContent = AppI18n.t("entrance.user.transcriptProfile.label");
    }
    if (transcriptProfileHintEl) {
      transcriptProfileHintEl.textContent = AppI18n.t("entrance.user.transcriptProfile.hint");
    }
    if (transcriptProfileEl) {
      const lightOption = transcriptProfileEl.querySelector<HTMLOptionElement>("option[value='light']");
      const fullOption = transcriptProfileEl.querySelector<HTMLOptionElement>("option[value='full']");
      if (lightOption) {
        lightOption.textContent = AppI18n.t("entrance.user.transcriptProfile.options.light");
      }
      if (fullOption) {
        fullOption.textContent = AppI18n.t("entrance.user.transcriptProfile.options.full");
      }
      transcriptProfileEl.value = settings.general?.transcriptModelVariant ?? "full";
    }

    this.renderTranscriptRuntimePanel();
    void this.renderLanguageSection(settings.general?.language ?? DEFAULT_APP_LANGUAGE);
  }

  private async renderLanguageSection(language: AppLanguage): Promise<void> {
    const renderVersion = ++this.languageRenderVersion;
    const nextLanguage = normalizeAppLanguage(language);

    await AppI18n.setLocale(nextLanguage);
    let languages = await AppI18n.listLanguages();
    if (renderVersion !== this.languageRenderVersion) {
      return;
    }

    if (languages.some((item) => item.locale === nextLanguage) === false) {
      languages = [
        ...languages,
        {
          locale: nextLanguage,
          nativeName: nextLanguage,
          selectorLanguage: nextLanguage === "en" ? "en" : "tr",
          source: "external",
        } satisfies LanguageDescriptor,
      ];
    }

    const labelEl = document.getElementById("app-language-label");
    const selectEl = document.getElementById("app-language-select") as HTMLSelectElement | null;

    if (labelEl) {
      labelEl.textContent = AppI18n.t("entrance.user.language.label");
    }

    if (!selectEl) {
      return;
    }

    const fragment = document.createDocumentFragment();
    for (const descriptor of languages) {
      fragment.append(new Option(formatLanguageLabel(descriptor), descriptor.locale));
    }

    selectEl.replaceChildren(fragment);
    selectEl.value = nextLanguage;
  }

  async saveAppLanguage(language: string): Promise<void> {
    const nextLanguage = normalizeAppLanguage(language);
    const current = this.settingsManager.getSnapshot();

    if (current.general?.language === nextLanguage) {
      return;
    }

    const updated = {
      ...current,
      general: { ...current.general, language: nextLanguage },
    };
    await this.settingsManager.save(updated);
    await this.refreshTranscriptRuntimePanel();
  }

  async saveTranscriptModelVariant(value: string): Promise<void> {
    const nextVariant: TranscriptModelVariant = value === "light" ? "light" : "full";
    const current = this.settingsManager.getSnapshot();

    if (current.general?.transcriptModelVariant === nextVariant) {
      return;
    }

    const updated = {
      ...current,
      general: { ...current.general, transcriptModelVariant: nextVariant },
    };
    await this.settingsManager.save(updated);
    await this.refreshTranscriptRuntimePanel();
  }

  private async ensureActiveTranscriptRuntime(): Promise<void> {
    this.transcriptPanelState.busy = { kind: "ensure", modelId: null };
    this.transcriptPanelState.error = null;
    this.renderTranscriptRuntimePanel();

    try {
      const status = await ensureTranscriptRuntime();
      const models = await listTranscriptModels();
      this.transcriptPanelState = {
        busy: null,
        error: null,
        loaded: true,
        models,
        status,
      };
    } catch (error) {
      this.transcriptPanelState.busy = null;
      this.transcriptPanelState.loaded = true;
      this.transcriptPanelState.error = getErrorMessage(error);
    }

    this.renderTranscriptRuntimePanel();
  }

  private async refreshTranscriptRuntimePanel(): Promise<void> {
    this.transcriptPanelState.busy = { kind: "refresh", modelId: null };
    this.transcriptPanelState.error = null;
    this.renderTranscriptRuntimePanel();

    try {
      const [status, models] = await Promise.all([getTranscriptStatus(), listTranscriptModels()]);
      this.transcriptPanelState = {
        busy: null,
        error: null,
        loaded: true,
        models,
        status,
      };
    } catch (error) {
      this.transcriptPanelState.busy = null;
      this.transcriptPanelState.loaded = true;
      this.transcriptPanelState.error = getErrorMessage(error);
    }

    this.renderTranscriptRuntimePanel();
  }

  private async installTranscriptRuntimeModel(modelId: TranscriptManagedModelId): Promise<void> {
    this.transcriptPanelState.busy = { kind: "install", modelId };
    this.transcriptPanelState.error = null;
    this.renderTranscriptRuntimePanel();

    try {
      const result = await installTranscriptModel(modelId);
      if (result === null) {
        throw new Error("Transcript runtime bridge is unavailable.");
      }
      await this.refreshTranscriptRuntimePanel();
    } catch (error) {
      this.transcriptPanelState.busy = null;
      this.transcriptPanelState.error = getErrorMessage(error);
      this.renderTranscriptRuntimePanel();
    }
  }

  private async removeTranscriptRuntimeModel(modelId: TranscriptManagedModelId): Promise<void> {
    this.transcriptPanelState.busy = { kind: "remove", modelId };
    this.transcriptPanelState.error = null;
    this.renderTranscriptRuntimePanel();

    try {
      const result = await removeTranscriptModel(modelId);
      if (result === null) {
        throw new Error("Transcript runtime bridge is unavailable.");
      }
      await this.refreshTranscriptRuntimePanel();
    } catch (error) {
      this.transcriptPanelState.busy = null;
      this.transcriptPanelState.error = getErrorMessage(error);
      this.renderTranscriptRuntimePanel();
    }
  }

  private renderTranscriptRuntimePanel(): void {
    const labelEl = document.getElementById("app-transcript-runtime-label");
    const statusLabelEl = document.getElementById("app-transcript-runtime-status-label");
    const statusValueEl = document.getElementById("app-transcript-runtime-status-value");
    const activeLanguageLabelEl = document.getElementById(
      "app-transcript-runtime-active-language-label"
    );
    const activeLanguageEl = document.getElementById("app-transcript-runtime-active-language");
    const activeModelLabelEl = document.getElementById("app-transcript-runtime-active-model-label");
    const activeModelEl = document.getElementById("app-transcript-runtime-active-model");
    const hintEl = document.getElementById("app-transcript-runtime-hint");
    const feedbackEl = document.getElementById("app-transcript-runtime-feedback");
    const ensureBtn = document.getElementById(
      "app-transcript-runtime-ensure-btn"
    ) as HTMLButtonElement | null;
    const refreshBtn = document.getElementById(
      "app-transcript-runtime-refresh-btn"
    ) as HTMLButtonElement | null;
    const modelsEl = document.getElementById("app-transcript-runtime-models");

    if (labelEl) {
      labelEl.textContent = AppI18n.t("entrance.user.transcriptRuntime.label");
    }
    if (statusLabelEl) {
      statusLabelEl.textContent = AppI18n.t("entrance.user.transcriptRuntime.statusLabel");
    }
    if (activeLanguageLabelEl) {
      activeLanguageLabelEl.textContent = AppI18n.t(
        "entrance.user.transcriptRuntime.activeLanguageLabel"
      );
    }
    if (activeModelLabelEl) {
      activeModelLabelEl.textContent = AppI18n.t("entrance.user.transcriptRuntime.activeModelLabel");
    }
    if (hintEl) {
      hintEl.textContent = AppI18n.t("entrance.user.transcriptRuntime.hint");
    }

    const status = this.transcriptPanelState.status;
    const activeModel =
      status === null
        ? null
        : (this.transcriptPanelState.models.find((entry) => entry.modelId === status.modelId) ??
          null);
    const statusKey = status?.state ?? "missing-runtime";
    const activeLanguage = status?.activeLanguage ?? "tr";

    if (statusValueEl) {
      statusValueEl.textContent = AppI18n.t(`entrance.user.transcriptRuntime.states.${statusKey}`);
    }
    if (activeLanguageEl) {
      activeLanguageEl.textContent = AppI18n.t(
        `entrance.user.transcriptRuntime.languages.${activeLanguage}`
      );
    }
    if (activeModelEl) {
      activeModelEl.textContent = activeModel
        ? this.getTranscriptRuntimeModelTitle(activeModel)
        : status?.modelId ?? "--";
    }

    if (ensureBtn) {
      ensureBtn.textContent = AppI18n.t("entrance.user.transcriptRuntime.actions.prepare");
      ensureBtn.disabled = this.transcriptPanelState.busy !== null;
    }
    if (refreshBtn) {
      refreshBtn.textContent = AppI18n.t("entrance.user.transcriptRuntime.actions.refresh");
      refreshBtn.disabled = this.transcriptPanelState.busy !== null;
    }

    if (feedbackEl) {
      if (this.transcriptPanelState.error !== null) {
        feedbackEl.textContent = this.transcriptPanelState.error;
      } else if (this.transcriptPanelState.loaded !== true) {
        feedbackEl.textContent = AppI18n.t("entrance.user.transcriptRuntime.loading");
      } else {
        feedbackEl.textContent = status?.message ?? "";
      }
    }

    if (modelsEl) {
      if (this.transcriptPanelState.models.length === 0) {
        modelsEl.innerHTML = `
          <div class="user-profile-inline__runtime-model">
            <div class="user-profile-inline__runtime-status-text">${this.escapeHtml(
              AppI18n.t("entrance.user.transcriptRuntime.empty")
            )}</div>
          </div>
        `;
      } else {
        modelsEl.innerHTML = this.transcriptPanelState.models
          .map((model) => this.renderTranscriptRuntimeModelCard(model, status))
          .join("");
      }
    }
  }

  private renderTranscriptRuntimeModelCard(
    model: TranscriptManagedModelStatus,
    status: TranscriptRuntimeStatus | null
  ): string {
    const isActive = status?.modelId === model.modelId;
    const busyState = this.transcriptPanelState.busy;
    const isBusyForModel =
      busyState !== null &&
      (busyState.kind === "install" || busyState.kind === "remove") &&
      busyState.modelId === model.modelId;
    const canRemove = model.ready === true && isActive !== true;
    const action =
      canRemove === true
        ? "remove"
        : model.installed === true && model.ready !== true
          ? "install"
          : model.installed === true
            ? null
            : "install";
    const actionLabel =
      canRemove === true
        ? AppI18n.t("entrance.user.transcriptRuntime.actions.remove")
        : model.installed === true && model.ready !== true
          ? AppI18n.t("entrance.user.transcriptRuntime.actions.repair")
          : model.installed === true
            ? AppI18n.t("entrance.user.transcriptRuntime.actions.active")
            : AppI18n.t("entrance.user.transcriptRuntime.actions.install");
    const footerStatus = model.ready
      ? AppI18n.t("entrance.user.transcriptRuntime.states.ready")
      : model.installed
        ? AppI18n.t("entrance.user.transcriptRuntime.actions.repair")
        : AppI18n.t("entrance.user.transcriptRuntime.states.missing-runtime");

    return `
      <article class="user-profile-inline__runtime-model" data-active="${isActive ? "true" : "false"}">
        <div class="user-profile-inline__runtime-model-head">
          <div class="user-profile-inline__runtime-model-title">
            <strong>${this.escapeHtml(this.getTranscriptRuntimeModelTitle(model))}</strong>
            <span class="user-profile-inline__runtime-model-meta">${this.escapeHtml(
              this.getTranscriptRuntimeModelMeta(model)
            )}</span>
          </div>
          ${
            isActive
              ? `<span class="user-profile-inline__runtime-badge">${this.escapeHtml(
                  AppI18n.t("entrance.user.transcriptRuntime.actions.active")
                )}</span>`
              : ""
          }
        </div>
        <div class="user-profile-inline__runtime-model-footer">
          <span class="user-profile-inline__runtime-status-text">${this.escapeHtml(
            model.lastError ?? footerStatus
          )}</span>
          <button
            class="btn btn-secondary btn-sm"
            type="button"
            data-transcript-model-action="${action ?? ""}"
            data-transcript-model-id="${this.escapeHtml(model.modelId)}"
            ${action === null || this.transcriptPanelState.busy !== null || isBusyForModel ? "disabled" : ""}
          >
            ${this.escapeHtml(actionLabel)}
          </button>
        </div>
      </article>
    `;
  }

  private getTranscriptRuntimeModelTitle(model: TranscriptManagedModelStatus): string {
    const languageLabel = AppI18n.t(`entrance.user.transcriptRuntime.languages.${model.locale}`);
    const variantLabel = AppI18n.t(
      `entrance.user.transcriptProfile.options.${model.variant === "light" ? "light" : "full"}`
    );
    return `${languageLabel} · ${variantLabel}`;
  }

  private getTranscriptRuntimeModelMeta(model: TranscriptManagedModelStatus): string {
    const familyLabel = AppI18n.t(`entrance.user.transcriptRuntime.families.${model.family}`);
    return `${model.modelId} · ${familyLabel}`;
  }

  private normalizeTranscriptModelId(value: string | undefined): TranscriptManagedModelId | null {
    switch (value) {
      case undefined:
        return null;
      case "tiny":
      case "base":
      case "tiny.en":
      case "base.en":
        return value;
      default:
        return null;
    }
  }

  private escapeHtml(value: string): string {
    return value
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#39;");
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
        title: AppI18n.t("entrance.user.dialog.avatarTitle"),
        buttonLabel: AppI18n.t("entrance.user.dialog.selectButton"),
        filters: [
          {
            name: AppI18n.t("entrance.user.dialog.imageFilterName"),
            extensions: ["png", "jpg", "jpeg", "gif", "webp"],
          },
        ],
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
      Logger.error(
        LogCategory.ENTRANCE,
        entranceT("logs.userAvatarError", { message: getErrorMessage(err) })
      );
    }
  }

  async startGDriveAuth(): Promise<void> {
    try {
      const electronApi = window.electronAPI;
      if (!electronApi) return;
      await electronApi.googledriveStartAuth();
    } catch (err) {
      Logger.error(
        LogCategory.ENTRANCE,
        entranceT("logs.googleDriveAuthError", { message: getErrorMessage(err) })
      );
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
        Logger.error(
          LogCategory.ENTRANCE,
          entranceT("logs.googleDriveDisconnectError", { message: getErrorMessage(e) })
        );
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
        Logger.error(
          LogCategory.ENTRANCE,
          entranceT("logs.googleDriveCodeExchangeError", { message: getErrorMessage(e) })
        );
      }
    }
  }
}
