import type { AppSettings, MailTransportAccountConfig } from "@shared/settings.js";
import { getRemoteEmailAccounts } from "@shared/settings.js";
import type { Us1MailAccountDraft } from "@shared/us1-mail.js";
import { buildRemoteEmailAccountId } from "@shared/archive.js";

import { AppState } from "../../modules/app-state.js";
import { ConversationListManager } from "../../modules/conversation-list-manager.js";
import { TrafficManager } from "../../modules/traffic-manager.js";
import { getErrorMessage } from "@shared/index.js";
import { formatTime, t as entranceT } from "./i18n.js";

interface SettingsManagerLike {
  getSnapshot(): AppSettings;
  save(settings: Record<string, unknown>): Promise<boolean>;
  reload?(): Promise<AppSettings>;
  load?(options?: { force?: boolean }): Promise<AppSettings>;
}

type FeedbackKind = "success" | "error" | "info" | "warning";

interface ActiveRemoteBinding {
  accountId: string;
  remoteUserId: string;
  email: string;
  nickname: string;
}

interface ReportEntry {
  id: string;
  at: number;
  kind: FeedbackKind;
  message: string;
}

export interface Us1SceneState {
  connected: boolean;
  canConnect: boolean;
  connectDisabledReason: string | null;
  catchCommands: boolean;
  resumeLastSession: boolean;
  rememberConnectionStatus: boolean;
}

export class Us1Panel {
  settingsManager: SettingsManagerLike;
  reportEntries: ReportEntry[] = [];
  loadingBusy = false;

  constructor(settingsManager: SettingsManagerLike) {
    this.settingsManager = settingsManager;
  }

  init(): void {
    this.setupListeners();
    this.render();
  }

  setupListeners(): void {
    const providerSelect = document.getElementById(
      "us1-mail-provider-select"
    ) as HTMLSelectElement | null;
    providerSelect?.addEventListener("change", () => {
      this.renderMailAccountFormState();
    });

    const authTypeSelect = document.getElementById(
      "us1-mail-auth-type-select"
    ) as HTMLSelectElement | null;
    authTypeSelect?.addEventListener("change", () => {
      this.renderMailAccountFormState();
    });

    document.getElementById("us1-mail-verify-btn")?.addEventListener("click", () => {
      void this.handleSaveMailAccount(true);
    });

    document.getElementById("us1-mail-delete-btn")?.addEventListener("click", () => {
      void this.handleDeleteMailAccount();
    });

    document.getElementById("us1-mail-gmail-open-security")?.addEventListener("click", () => {
      const electronApi = window.electronAPI;
      if (electronApi) {
        void electronApi.openPath("https://myaccount.google.com/apppasswords");
      }
    });

    const slotUserSelect = document.getElementById(
      "us1-identity-select"
    ) as HTMLSelectElement | null;
    slotUserSelect?.addEventListener("change", (event) => {
      const selectedAccountId = this.readSelectValue(event.target as HTMLSelectElement);
      void this.handleSlotSelectionChange(selectedAccountId);
    });

    const catchCheck = document.getElementById("us1-catch-check") as HTMLInputElement | null;
    catchCheck?.addEventListener("change", (event) => {
      void this.updateUs1Slot({
        catchCommands: (event.target as HTMLInputElement).checked,
      });
    });

    const resumeCheck = document.getElementById(
      "us1-resume-last-session-check"
    ) as HTMLInputElement | null;
    resumeCheck?.addEventListener("change", (event) => {
      void this.updateUs1Slot({
        resumeLastSession: (event.target as HTMLInputElement).checked,
      });
    });

    const rememberConnectionCheck = document.getElementById(
      "us1-remember-connection-check"
    ) as HTMLInputElement | null;
    rememberConnectionCheck?.addEventListener("change", (event) => {
      const checked = (event.target as HTMLInputElement).checked;
      void this.updateUs1Slot({
        rememberConnectionStatus: checked,
        lastConnectionState: AppState.isUs1Connected() === true ? "connected" : "disconnected",
      });
    });

    document.getElementById("us1-toggle-btn")?.addEventListener("click", () => {
      if (AppState.isUs1Connected() === true) {
        void this.handleDisconnect();
      } else {
        void this.handleConnect();
      }
    });

    document.getElementById("us1-sync-messages-btn")?.addEventListener("click", () => {
      void this.handleManualMailCheck();
    });
  }

  private getMailAccounts(settings: AppSettings): MailTransportAccountConfig[] {
    return settings.integrations?.mailTransport?.accounts ?? [];
  }

  private getEditableMailAccount(settings: AppSettings): MailTransportAccountConfig | null {
    return (
      settings.integrations?.mailTransport?.localAccount ??
      this.getMailAccounts(settings)[0] ??
      null
    );
  }

  private getVerifiedLocalMailAccount(settings: AppSettings): MailTransportAccountConfig | null {
    const localAccount = settings.integrations?.mailTransport?.localAccount ?? null;
    if (localAccount?.connectionState === "connected") {
      return localAccount;
    }
    return null;
  }

  private getActiveRemoteBindings(settings: AppSettings): ActiveRemoteBinding[] {
    return getRemoteEmailAccounts(settings.accounts)
      .map((account) => {
        const remoteUserId = this.normalizeText(account.remoteEmail?.remoteUserId);
        if (remoteUserId === null || account.remoteEmail?.handshakeState !== "active") {
          return null;
        }

        const derivedAccountId = buildRemoteEmailAccountId(remoteUserId);
        const accountId = derivedAccountId !== "" ? derivedAccountId : account.id;
        const email = `${account.email}`.trim();
        const fallbackNickname = email.split("@")[0] ?? email;
        const nicknameCandidate = `${account.nickname ?? fallbackNickname}`.trim();
        const nickname = nicknameCandidate !== "" ? nicknameCandidate : fallbackNickname;
        return {
          accountId,
          remoteUserId,
          email,
          nickname,
        };
      })
      .filter((binding): binding is ActiveRemoteBinding => binding !== null)
      .sort((left, right) => {
        const leftLabel = `${left.nickname} ${left.email}`.toLowerCase();
        const rightLabel = `${right.nickname} ${right.email}`.toLowerCase();
        return leftLabel.localeCompare(rightLabel, "tr");
      });
  }

  private resolveSelectedBinding(
    settings: AppSettings,
    bindings: ActiveRemoteBinding[]
  ): ActiveRemoteBinding | null {
    const selectedAccountId = this.normalizeText(settings.us1Slot?.selectedAccountId);
    const selectedRemoteUserId = this.normalizeText(settings.us1Slot?.selectedRemoteUserId);

    return (
      bindings.find((binding) => binding.accountId === selectedAccountId) ??
      bindings.find((binding) => binding.remoteUserId === selectedRemoteUserId) ??
      null
    );
  }

  private readSelectValue(select: HTMLSelectElement | null): string | null {
    if (select === null || select.value.trim() === "") {
      return null;
    }
    return select.value.trim();
  }

  private normalizeText(value: string | null | undefined): string | null {
    if (typeof value !== "string") {
      return null;
    }
    const trimmed = value.trim();
    return trimmed === "" ? null : trimmed;
  }

  private async reloadSettings(): Promise<void> {
    if (typeof this.settingsManager.reload === "function") {
      await this.settingsManager.reload();
      return;
    }
    if (typeof this.settingsManager.load === "function") {
      await this.settingsManager.load({ force: true });
    }
  }

  private async handleSaveMailAccount(verifyAfterSave: boolean): Promise<void> {
    const electronApi = window.electronAPI;
    if (electronApi === undefined) {
      this.showFeedback(entranceT("us1.feedback.electronUnavailable"), "error");
      return;
    }

    const settings = this.settingsManager.getSnapshot();
    const selectedMailAccount = this.getEditableMailAccount(settings);
    const draft = this.collectMailAccountDraft(selectedMailAccount?.id ?? null);
    if (draft.email === "") {
      this.showFeedback(entranceT("us1.feedback.mailEmailRequired"), "error");
      return;
    }

    const result = await electronApi.us1UpsertMailAccount(draft, { verifyAfterSave });
    await this.reloadSettings();
    this.render();

    if (result.success) {
      const message = verifyAfterSave
        ? entranceT("us1.feedback.mailVerifySuccess")
        : entranceT("us1.feedback.mailSaveSuccess");
      this.addReport(message, "success");
      this.showFeedback(message, "success");
      return;
    }

    const errorMessage = result.error ?? entranceT("us1.feedback.operationFailed");
    this.addReport(errorMessage, "error");
    this.showFeedback(errorMessage, "error");
  }

  private async handleDeleteMailAccount(): Promise<void> {
    const electronApi = window.electronAPI;
    const settings = this.settingsManager.getSnapshot();
    const selectedMailAccount = this.getEditableMailAccount(settings);
    if (electronApi === undefined || selectedMailAccount === null) {
      this.showFeedback(entranceT("us1.feedback.mailAccountRequired"), "error");
      return;
    }

    const result = await electronApi.us1DeleteMailAccount({
      mailAccountId: selectedMailAccount.id,
    });
    await this.reloadSettings();
    this.render();

    if (result.success) {
      const message = entranceT("us1.feedback.mailDeleteSuccess");
      this.addReport(message, "success");
      this.showFeedback(message, "success");
      return;
    }

    const errorMessage = result.error ?? entranceT("us1.feedback.operationFailed");
    this.addReport(errorMessage, "error");
    this.showFeedback(errorMessage, "error");
  }

  private async handleSlotSelectionChange(selectedAccountId: string | null): Promise<void> {
    const settings = this.settingsManager.getSnapshot();
    const binding = this.getActiveRemoteBindings(settings).find(
      (candidate) => candidate.accountId === selectedAccountId
    );

    await this.updateUs1Slot({
      selectedAccountId: binding?.accountId ?? null,
      selectedRemoteUserId: binding?.remoteUserId ?? null,
      ...this.buildUs1ConnectionStatePatch("disconnected", settings),
    });
  }

  private buildUs1ConnectionStatePatch(
    state: "connected" | "disconnected",
    settings: AppSettings = this.settingsManager.getSnapshot()
  ): Partial<NonNullable<AppSettings["us1Slot"]>> {
    return settings.us1Slot?.rememberConnectionStatus === true
      ? { connectionState: state, lastConnectionState: state }
      : { connectionState: state };
  }

  private async handleConnect(): Promise<void> {
    const electronApi = window.electronAPI;
    const settings = this.settingsManager.getSnapshot();
    const verifiedLocalMailAccount = this.getVerifiedLocalMailAccount(settings);
    const activeBindings = this.getActiveRemoteBindings(settings);
    const selectedBinding = this.resolveSelectedBinding(settings, activeBindings);

    if (electronApi === undefined || typeof electronApi.us1SyncMessages !== "function") {
      this.showFeedback(entranceT("us1.feedback.electronUnavailable"), "error");
      return;
    }
    if (verifiedLocalMailAccount === null) {
      this.showFeedback(entranceT("us1.status.noConnectedMailAccount"), "warning");
      return;
    }
    if (selectedBinding === null) {
      this.showFeedback(entranceT("us1.status.empty"), "warning");
      return;
    }
    if (AppState.isUs1Connected() === true) {
      return;
    }

    this.loadingBusy = true;
    this.syncIndicators(AppState.isUs1Connected());

    try {
      await this.updateUs1Slot({
        selectedAccountId: selectedBinding.accountId,
        selectedRemoteUserId: selectedBinding.remoteUserId,
        ...this.buildUs1ConnectionStatePatch("connected", settings),
      });

      const result = await electronApi.us1SyncMessages();
      await this.reloadSettings();
      this.render();

      if (result.success !== true) {
        throw new Error(result.error ?? entranceT("us1.feedback.operationFailed"));
      }

      const processedCount = result.processedCount ?? result.fetchedCount ?? 0;
      await ConversationListManager.refresh({
        silent: true,
        provider: "us1",
        ...(typeof result.conversationId === "string" && result.conversationId !== ""
          ? { forceSelectId: result.conversationId }
          : {}),
      });
      const message = entranceT("us1.feedback.connectSuccess", {
        count: String(processedCount),
      });
      this.addReport(message, "success");
      this.showFeedback(message, "success");
    } catch (error) {
      await this.updateUs1Slot(this.buildUs1ConnectionStatePatch("disconnected"));
      const errorMessage = getErrorMessage(error);
      this.addReport(errorMessage, "error");
      this.showFeedback(errorMessage, "error");
    } finally {
      this.loadingBusy = false;
      this.render();
    }
  }

  private async handleDisconnect(): Promise<void> {
    if (AppState.isUs1Connected() === false) {
      return;
    }

    await this.updateUs1Slot(this.buildUs1ConnectionStatePatch("disconnected"));
    const message = entranceT("us1.feedback.disconnectSuccess");
    this.addReport(message, "info");
    this.showFeedback(message, "info");
  }

  private async handleManualMailCheck(): Promise<void> {
    const electronApi = window.electronAPI;
    if (electronApi === undefined || typeof electronApi.us1SyncMessages !== "function") {
      this.showFeedback(entranceT("us1.feedback.electronUnavailable"), "error");
      return;
    }
    if (AppState.isUs1Connected() !== true) {
      this.showFeedback(entranceT("us1.feedback.syncRequiresConnection"), "warning");
      return;
    }

    this.loadingBusy = true;
    this.syncIndicators(true);

    try {
      const result = await electronApi.us1SyncMessages();
      await this.reloadSettings();
      this.render();

      if (result.success !== true) {
        throw new Error(result.error ?? entranceT("us1.feedback.operationFailed"));
      }

      const processedCount = result.processedCount ?? result.fetchedCount ?? 0;
      await ConversationListManager.refresh({
        silent: true,
        provider: "us1",
        ...(typeof result.conversationId === "string" && result.conversationId !== ""
          ? { forceSelectId: result.conversationId }
          : {}),
      });
      const message = entranceT("us1.feedback.syncSuccess", {
        count: String(processedCount),
      });
      this.addReport(message, "success");
      this.showFeedback(message, "success");
    } catch (error) {
      const errorMessage = getErrorMessage(error);
      this.addReport(errorMessage, "error");
      this.showFeedback(errorMessage, "error");
    } finally {
      this.loadingBusy = false;
      this.render();
    }
  }

  private collectMailAccountDraft(mailAccountId: string | null): Us1MailAccountDraft {
    const providerType =
      (document.getElementById("us1-mail-provider-select") as HTMLSelectElement | null)?.value ===
      "custom-imap-smtp"
        ? "custom-imap-smtp"
        : "gmail";
    const authType =
      providerType === "gmail"
        ? "password"
        : (document.getElementById("us1-mail-auth-type-select") as HTMLSelectElement | null)
              ?.value === "oauth2"
          ? "oauth2"
          : "password";

    const gmailEmailInput = document.getElementById(
      "us1-mail-gmail-email-easy"
    ) as HTMLInputElement | null;
    const gmailPasswordInput = document.getElementById(
      "us1-mail-gmail-password-easy"
    ) as HTMLInputElement | null;
    const emailInput = document.getElementById("us1-mail-email-input") as HTMLInputElement | null;
    const email =
      providerType === "gmail"
        ? (gmailEmailInput?.value.trim().toLowerCase() ?? "")
        : (emailInput?.value.trim().toLowerCase() ?? "");

    const imapPort = this.readNumberInput("us1-mail-imap-port-input");
    const smtpPort = this.readNumberInput("us1-mail-smtp-port-input");

    return {
      ...(mailAccountId !== null ? { mailAccountId } : {}),
      providerType,
      email,
      enabled: true,
      authType,
      imap:
        providerType === "gmail"
          ? { host: "imap.gmail.com", port: 993, secure: true }
          : {
              host:
                (
                  document.getElementById("us1-mail-imap-host-input") as HTMLInputElement | null
                )?.value.trim() ?? "",
              secure:
                (document.getElementById("us1-mail-imap-secure-check") as HTMLInputElement | null)
                  ?.checked ?? false,
              ...(imapPort !== undefined ? { port: imapPort } : {}),
            },
      smtp:
        providerType === "gmail"
          ? { host: "smtp.gmail.com", port: 465, secure: true }
          : {
              host:
                (
                  document.getElementById("us1-mail-smtp-host-input") as HTMLInputElement | null
                )?.value.trim() ?? "",
              secure:
                (document.getElementById("us1-mail-smtp-secure-check") as HTMLInputElement | null)
                  ?.checked ?? false,
              ...(smtpPort !== undefined ? { port: smtpPort } : {}),
            },
      auth: {
        user: email,
        password:
          providerType === "gmail"
            ? (gmailPasswordInput?.value.trim().replace(/\s/g, "") ?? "")
            : ((document.getElementById("us1-mail-password-input") as HTMLInputElement | null)
                ?.value ?? ""),
        accessToken:
          (document.getElementById("us1-mail-access-token-input") as HTMLInputElement | null)
            ?.value ?? "",
        refreshToken:
          (document.getElementById("us1-mail-refresh-token-input") as HTMLInputElement | null)
            ?.value ?? "",
        clientId:
          (document.getElementById("us1-mail-client-id-input") as HTMLInputElement | null)?.value ??
          "",
        clientSecret:
          (document.getElementById("us1-mail-client-secret-input") as HTMLInputElement | null)
            ?.value ?? "",
      },
    };
  }

  private readNumberInput(elementId: string): number | undefined {
    const value =
      (document.getElementById(elementId) as HTMLInputElement | null)?.value.trim() ?? "";
    if (value === "") {
      return undefined;
    }
    const parsed = Number.parseInt(value, 10);
    return Number.isFinite(parsed) ? parsed : undefined;
  }

  private async updateUs1Slot(patch: Partial<NonNullable<AppSettings["us1Slot"]>>): Promise<void> {
    const settings = this.settingsManager.getSnapshot();
    await this.settingsManager.save({
      ...settings,
      us1Slot: {
        ...settings.us1Slot,
        ...patch,
      },
    });
    await this.reloadSettings();
    this.render();
  }

  getSceneState(): Us1SceneState {
    const settings = this.settingsManager.getSnapshot();
    const verifiedLocalMailAccount = this.getVerifiedLocalMailAccount(settings);
    const activeBindings = this.getActiveRemoteBindings(settings);
    const selectedBinding = this.resolveSelectedBinding(settings, activeBindings);
    const connected = AppState.isUs1Connected();

    let connectDisabledReason: string | null = null;
    if (verifiedLocalMailAccount === null) {
      connectDisabledReason = entranceT("us1.status.noConnectedMailAccount");
    } else if (activeBindings.length === 0) {
      connectDisabledReason = entranceT("us1.status.noUsers");
    } else if (selectedBinding === null) {
      connectDisabledReason = entranceT("us1.status.empty");
    }

    return {
      connected,
      canConnect: connected || connectDisabledReason === null,
      connectDisabledReason,
      catchCommands: settings.us1Slot?.catchCommands === true,
      resumeLastSession: settings.us1Slot?.resumeLastSession ?? true,
      rememberConnectionStatus: settings.us1Slot?.rememberConnectionStatus === true,
    };
  }

  async selectSceneBinding(accountId: string | null): Promise<void> {
    await this.handleSlotSelectionChange(accountId);
  }

  async toggleSceneConnection(): Promise<void> {
    if (AppState.isUs1Connected() === true) {
      await this.handleDisconnect();
      return;
    }

    await this.handleConnect();
  }

  async updateScenePreferences(
    patch: Partial<
      Pick<
        NonNullable<AppSettings["us1Slot"]>,
        "catchCommands" | "resumeLastSession" | "rememberConnectionStatus"
      >
    >
  ): Promise<void> {
    const nextPatch: Partial<NonNullable<AppSettings["us1Slot"]>> = { ...patch };
    if (Object.prototype.hasOwnProperty.call(nextPatch, "rememberConnectionStatus")) {
      nextPatch.lastConnectionState =
        AppState.isUs1Connected() === true ? "connected" : "disconnected";
    }

    await this.updateUs1Slot(nextPatch);
  }

  render(): void {
    const settings = this.settingsManager.getSnapshot();
    const editableMailAccount = this.getEditableMailAccount(settings);
    const verifiedLocalMailAccount = this.getVerifiedLocalMailAccount(settings);
    const activeBindings = this.getActiveRemoteBindings(settings);
    const selectedBinding = this.resolveSelectedBinding(settings, activeBindings);
    const connected = AppState.isUs1Connected();

    this.renderMailAccountIdentity(editableMailAccount, verifiedLocalMailAccount);
    this.renderMailAccountForm(editableMailAccount);
    this.renderMailAccountFormState();
    this.renderSlotSelect(activeBindings, selectedBinding);
    this.renderReportLog();

    const catchCheck = document.getElementById("us1-catch-check") as HTMLInputElement | null;
    if (catchCheck) {
      catchCheck.checked = settings.us1Slot?.catchCommands === true;
    }

    const resumeCheck = document.getElementById(
      "us1-resume-last-session-check"
    ) as HTMLInputElement | null;
    if (resumeCheck) {
      resumeCheck.checked = settings.us1Slot?.resumeLastSession ?? true;
    }

    const rememberConnectionCheck = document.getElementById(
      "us1-remember-connection-check"
    ) as HTMLInputElement | null;
    if (rememberConnectionCheck) {
      rememberConnectionCheck.checked = settings.us1Slot?.rememberConnectionStatus === true;
    }

    const toggleBtn = document.getElementById("us1-toggle-btn") as HTMLButtonElement | null;
    if (toggleBtn) {
      if (selectedBinding === null) {
        toggleBtn.textContent = entranceT("slot.selectAccount");
        toggleBtn.disabled = true;
        toggleBtn.classList.remove("btn-secondary");
        toggleBtn.classList.add("btn-primary");
      } else if (connected) {
        toggleBtn.textContent = entranceT("slot.disconnect");
        toggleBtn.disabled = false;
        toggleBtn.classList.remove("btn-primary");
        toggleBtn.classList.add("btn-secondary");
      } else {
        toggleBtn.textContent = entranceT("slot.connect");
        toggleBtn.disabled = false;
        toggleBtn.classList.remove("btn-secondary");
        toggleBtn.classList.add("btn-primary");
      }
    }

    const statusText = document.getElementById("us1-status-text");
    if (statusText) {
      statusText.textContent = this.getSlotStatusText(
        editableMailAccount,
        verifiedLocalMailAccount,
        activeBindings.length,
        selectedBinding,
        connected
      );
    }

    const hintText = document.getElementById("us1-phase-hint");
    if (hintText) {
      hintText.textContent = this.getPhaseHint(
        editableMailAccount,
        verifiedLocalMailAccount,
        activeBindings.length
      );
    }

    this.syncIndicators(connected);
  }

  private renderMailAccountIdentity(
    editableMailAccount: MailTransportAccountConfig | null,
    verifiedLocalMailAccount: MailTransportAccountConfig | null
  ): void {
    const verifiedEmailEl = document.getElementById("us1-mail-verified-email");
    if (verifiedEmailEl) {
      verifiedEmailEl.textContent =
        verifiedLocalMailAccount?.email ?? entranceT("us1.mailAccount.verifiedEmpty");
    }

    const statusEl = document.getElementById("us1-mail-account-status");
    if (statusEl) {
      statusEl.textContent = this.getMailAccountStatusText(editableMailAccount);
    }
  }

  private renderMailAccountForm(selectedMailAccount: MailTransportAccountConfig | null): void {
    const providerSelect = document.getElementById(
      "us1-mail-provider-select"
    ) as HTMLSelectElement | null;
    const gmailEmailInput = document.getElementById(
      "us1-mail-gmail-email-easy"
    ) as HTMLInputElement | null;
    const gmailPasswordInput = document.getElementById(
      "us1-mail-gmail-password-easy"
    ) as HTMLInputElement | null;
    const emailInput = document.getElementById("us1-mail-email-input") as HTMLInputElement | null;
    const authTypeSelect = document.getElementById(
      "us1-mail-auth-type-select"
    ) as HTMLSelectElement | null;
    const passwordInput = document.getElementById(
      "us1-mail-password-input"
    ) as HTMLInputElement | null;
    const accessTokenInput = document.getElementById(
      "us1-mail-access-token-input"
    ) as HTMLInputElement | null;
    const refreshTokenInput = document.getElementById(
      "us1-mail-refresh-token-input"
    ) as HTMLInputElement | null;
    const clientIdInput = document.getElementById(
      "us1-mail-client-id-input"
    ) as HTMLInputElement | null;
    const clientSecretInput = document.getElementById(
      "us1-mail-client-secret-input"
    ) as HTMLInputElement | null;
    const imapHostInput = document.getElementById(
      "us1-mail-imap-host-input"
    ) as HTMLInputElement | null;
    const imapPortInput = document.getElementById(
      "us1-mail-imap-port-input"
    ) as HTMLInputElement | null;
    const imapSecureCheck = document.getElementById(
      "us1-mail-imap-secure-check"
    ) as HTMLInputElement | null;
    const smtpHostInput = document.getElementById(
      "us1-mail-smtp-host-input"
    ) as HTMLInputElement | null;
    const smtpPortInput = document.getElementById(
      "us1-mail-smtp-port-input"
    ) as HTMLInputElement | null;
    const smtpSecureCheck = document.getElementById(
      "us1-mail-smtp-secure-check"
    ) as HTMLInputElement | null;

    if (providerSelect) providerSelect.value = selectedMailAccount?.providerType ?? "gmail";
    if (gmailEmailInput) gmailEmailInput.value = selectedMailAccount?.email ?? "";
    if (gmailPasswordInput) gmailPasswordInput.value = selectedMailAccount?.auth.password ?? "";
    if (emailInput) emailInput.value = selectedMailAccount?.email ?? "";
    if (authTypeSelect) authTypeSelect.value = selectedMailAccount?.authType ?? "password";
    if (passwordInput) passwordInput.value = selectedMailAccount?.auth.password ?? "";
    if (accessTokenInput) accessTokenInput.value = selectedMailAccount?.auth.accessToken ?? "";
    if (refreshTokenInput) refreshTokenInput.value = selectedMailAccount?.auth.refreshToken ?? "";
    if (clientIdInput) clientIdInput.value = selectedMailAccount?.auth.clientId ?? "";
    if (clientSecretInput) clientSecretInput.value = selectedMailAccount?.auth.clientSecret ?? "";
    if (imapHostInput) imapHostInput.value = selectedMailAccount?.imap.host ?? "";
    if (imapPortInput) {
      const imapPort = selectedMailAccount?.imap.port;
      imapPortInput.value =
        typeof imapPort === "number" && Number.isFinite(imapPort) ? String(imapPort) : "";
    }
    if (imapSecureCheck) imapSecureCheck.checked = selectedMailAccount?.imap.secure ?? true;
    if (smtpHostInput) smtpHostInput.value = selectedMailAccount?.smtp.host ?? "";
    if (smtpPortInput) {
      const smtpPort = selectedMailAccount?.smtp.port;
      smtpPortInput.value =
        typeof smtpPort === "number" && Number.isFinite(smtpPort) ? String(smtpPort) : "";
    }
    if (smtpSecureCheck) smtpSecureCheck.checked = selectedMailAccount?.smtp.secure ?? true;

    const deleteBtn = document.getElementById("us1-mail-delete-btn") as HTMLButtonElement | null;
    if (deleteBtn) {
      deleteBtn.disabled = selectedMailAccount === null;
    }
  }

  private renderMailAccountFormState(): void {
    const providerSelect = document.getElementById(
      "us1-mail-provider-select"
    ) as HTMLSelectElement | null;
    const authTypeSelect = document.getElementById(
      "us1-mail-auth-type-select"
    ) as HTMLSelectElement | null;
    const providerType = providerSelect?.value ?? "gmail";
    const authType = authTypeSelect?.value ?? "password";

    if (providerType === "gmail" && authTypeSelect) {
      authTypeSelect.value = "password";
    }

    document
      .querySelectorAll<HTMLElement>("[data-us1-mail-custom]")
      .forEach((element) =>
        element.classList.toggle("is-hidden", providerType !== "custom-imap-smtp")
      );

    document
      .querySelectorAll<HTMLElement>("[data-us1-mail-gmail-helper]")
      .forEach((element) => element.classList.toggle("is-hidden", providerType !== "gmail"));

    document
      .querySelectorAll<HTMLElement>("[data-us1-mail-manual-fields]")
      .forEach((element) => element.classList.toggle("is-hidden", providerType === "gmail"));

    document
      .querySelectorAll<HTMLElement>("[data-us1-mail-password]")
      .forEach((element) =>
        element.classList.toggle("is-hidden", authType !== "password" || providerType === "gmail")
      );

    document
      .querySelectorAll<HTMLElement>("[data-us1-mail-oauth]")
      .forEach((element) =>
        element.classList.toggle("is-hidden", authType !== "oauth2" || providerType === "gmail")
      );
  }

  private renderSlotSelect(
    activeBindings: ActiveRemoteBinding[],
    selectedBinding: ActiveRemoteBinding | null
  ): void {
    const slotUserSelect = document.getElementById(
      "us1-identity-select"
    ) as HTMLSelectElement | null;
    if (slotUserSelect === null) {
      return;
    }

    slotUserSelect.innerHTML = "";

    const placeholder = document.createElement("option");
    placeholder.value = "";
    placeholder.textContent =
      activeBindings.length > 0
        ? entranceT("us1.selectPlaceholder")
        : entranceT("us1.noReadyUsers");
    slotUserSelect.appendChild(placeholder);

    activeBindings.forEach((binding) => {
      const option = document.createElement("option");
      option.value = binding.accountId;
      option.textContent = `${binding.nickname} (${binding.email})`;
      slotUserSelect.appendChild(option);
    });

    slotUserSelect.value = selectedBinding?.accountId ?? "";
    slotUserSelect.disabled = activeBindings.length === 0;
  }

  private getMailAccountStatusText(selectedMailAccount: MailTransportAccountConfig | null): string {
    if (selectedMailAccount === null) {
      return entranceT("us1.mailAccount.status.none");
    }
    return entranceT(
      `us1.mailAccount.status.${selectedMailAccount.connectionState ?? "disconnected"}`
    );
  }

  private getSlotStatusText(
    editableMailAccount: MailTransportAccountConfig | null,
    verifiedLocalMailAccount: MailTransportAccountConfig | null,
    activeUserCount: number,
    selectedBinding: ActiveRemoteBinding | null,
    connected: boolean
  ): string {
    if (editableMailAccount === null) {
      return entranceT("us1.status.noMailAccount");
    }
    if (verifiedLocalMailAccount === null) {
      return entranceT("us1.status.noConnectedMailAccount");
    }
    if (activeUserCount === 0) {
      return entranceT("us1.status.noUsers");
    }
    if (selectedBinding === null) {
      return entranceT("us1.status.empty");
    }
    if (connected) {
      return entranceT("us1.status.connected");
    }
    return entranceT("us1.status.ready");
  }

  private getPhaseHint(
    editableMailAccount: MailTransportAccountConfig | null,
    verifiedLocalMailAccount: MailTransportAccountConfig | null,
    activeUserCount: number
  ): string {
    if (editableMailAccount === null) {
      return entranceT("us1.phaseHintNoMailAccount");
    }
    if (verifiedLocalMailAccount === null) {
      return entranceT("us1.phaseHintVerifyMail");
    }
    if (activeUserCount === 0) {
      return entranceT("us1.phaseHintHandshake");
    }
    return entranceT("us1.phaseHint");
  }

  private addReport(message: string, kind: FeedbackKind = "info"): void {
    const trimmed = message.trim();
    if (trimmed === "") {
      return;
    }

    this.reportEntries = [
      {
        id: `${Date.now()}-${Math.random().toString(16).slice(2, 8)}`,
        at: Date.now(),
        kind,
        message: trimmed,
      },
      ...this.reportEntries,
    ].slice(0, 16);
  }

  private renderReportLog(): void {
    const reportEl = document.getElementById("us1-report-log");
    if (reportEl === null) {
      return;
    }

    reportEl.innerHTML = "";

    if (this.reportEntries.length === 0) {
      reportEl.innerHTML = `<div class="empty-message">${this.escapeHtml(
        entranceT("us1.reportEmpty")
      )}</div>`;
      return;
    }

    this.reportEntries.forEach((entry) => {
      const row = document.createElement("div");
      row.className = `us1-slot-panel__report-entry is-${entry.kind}`;
      row.innerHTML = `
        <span class="us1-slot-panel__report-time">${this.escapeHtml(formatTime(entry.at))}</span>
        <div>${this.escapeHtml(entry.message)}</div>
      `;
      reportEl.appendChild(row);
    });
  }

  private escapeHtml(text: string): string {
    if (text === "") {
      return "";
    }
    return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  }

  private showFeedback(message: string, kind: FeedbackKind = "info"): void {
    const statusEl = document.getElementById("us1-feedback-msg");
    if (statusEl === null) {
      return;
    }

    statusEl.textContent = message;
    statusEl.className = `ds-status-msg is-visible is-${kind}`;

    window.setTimeout(() => {
      statusEl.classList.remove("is-visible");
    }, 3200);
  }

  private syncIndicators(connected: boolean): void {
    TrafficManager.setIndicator("us1", "loading", this.loadingBusy ? "busy" : "idle");
    if (connected === false) {
      TrafficManager.setIndicator("us1", "thinking", "idle");
    }
    TrafficManager.setIndicator("us1", "send", connected ? "idle" : "busy");
  }
}
