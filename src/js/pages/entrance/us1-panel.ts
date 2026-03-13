import type { AppSettings, MailTransportAccountConfig, RemoteUserIdentity } from "@shared/settings.js";
import type { Us1MailAccountDraft } from "@shared/us1-mail.js";

import { AppState } from "../../modules/app-state.js";
import { TrafficManager } from "../../modules/traffic-manager.js";
import { t as entranceT } from "./i18n.js";

interface SettingsManagerLike {
  getSnapshot(): AppSettings;
  save(settings: Record<string, unknown>): Promise<boolean>;
  reload?(): Promise<AppSettings>;
  load?(options?: { force?: boolean }): Promise<AppSettings>;
}

type FeedbackKind = "success" | "error" | "info";

export class Us1Panel {
  settingsManager: SettingsManagerLike;
  selectedMailAccountId: string | null = null;
  selectedRemoteUserId: string | null = null;

  constructor(settingsManager: SettingsManagerLike) {
    this.settingsManager = settingsManager;
  }

  init(): void {
    this.setupListeners();
    this.render();
  }

  setupListeners(): void {
    const mailAccountSelect = document.getElementById("us1-mail-account-select") as HTMLSelectElement | null;
    mailAccountSelect?.addEventListener("change", (event) => {
      this.selectedMailAccountId = this.readSelectValue(event.target as HTMLSelectElement);
      this.selectedRemoteUserId = null;
      this.render();
    });

    const providerSelect = document.getElementById("us1-mail-provider-select") as HTMLSelectElement | null;
    providerSelect?.addEventListener("change", () => {
      this.renderMailAccountFormState();
    });

    const authTypeSelect = document.getElementById("us1-mail-auth-type-select") as HTMLSelectElement | null;
    authTypeSelect?.addEventListener("change", () => {
      this.renderMailAccountFormState();
    });

    document.getElementById("us1-mail-save-btn")?.addEventListener("click", () => {
      void this.handleSaveMailAccount(false);
    });

    document.getElementById("us1-mail-verify-btn")?.addEventListener("click", () => {
      void this.handleSaveMailAccount(true);
    });

    document.getElementById("us1-mail-delete-btn")?.addEventListener("click", () => {
      void this.handleDeleteMailAccount();
    });

    const remoteUserSelect = document.getElementById("us1-remote-user-select") as HTMLSelectElement | null;
    remoteUserSelect?.addEventListener("change", (event) => {
      this.selectedRemoteUserId = this.readSelectValue(event.target as HTMLSelectElement);
      this.render();
    });

    document.getElementById("us1-remote-invite-btn")?.addEventListener("click", () => {
      void this.handleInviteRemoteUser();
    });

    document.getElementById("us1-remote-accept-btn")?.addEventListener("click", () => {
      void this.handleAcceptRemoteUser();
    });

    document.getElementById("us1-remote-refresh-btn")?.addEventListener("click", () => {
      void this.handleRefreshRemoteUsers();
    });

    const slotUserSelect = document.getElementById("us1-identity-select") as HTMLSelectElement | null;
    slotUserSelect?.addEventListener("change", (event) => {
      const selectedRemoteUserId = this.readSelectValue(event.target as HTMLSelectElement);
      void this.updateUs1Slot({
        selectedRemoteUserId,
        connectionState: "disconnected",
      });
    });

    const catchCheck = document.getElementById("us1-catch-check") as HTMLInputElement | null;
    catchCheck?.addEventListener("change", (event) => {
      void this.updateUs1Slot({
        catchCommands: (event.target as HTMLInputElement).checked,
      });
    });

    document.getElementById("us1-connect-btn")?.addEventListener("click", () => {
      if (AppState.hasUs1Identity() === false || AppState.isUs1Connected() === true) {
        return;
      }
      void this.updateUs1Slot({ connectionState: "connected" });
    });

    document.getElementById("us1-disconnect-btn")?.addEventListener("click", () => {
      if (AppState.isUs1Connected() === false) {
        return;
      }
      void this.updateUs1Slot({ connectionState: "disconnected" });
    });
  }

  getLocalMailAccounts(settings: AppSettings): MailTransportAccountConfig[] {
    return settings.integrations?.mailTransport?.accounts ?? [];
  }

  getRemoteUsers(settings: AppSettings, mailAccountId: string | null = null): RemoteUserIdentity[] {
    const remoteUsers = settings.remoteUsers ?? [];
    if (mailAccountId === null) {
      return remoteUsers;
    }
    return remoteUsers.filter((remoteUser) => remoteUser.linkedMailAccountId === mailAccountId);
  }

  getActiveRemoteUsers(settings: AppSettings): RemoteUserIdentity[] {
    return this.getRemoteUsers(settings).filter((identity) => identity.handshakeState === "active");
  }

  resolveSelectedMailAccount(settings: AppSettings): MailTransportAccountConfig | null {
    const accounts = this.getLocalMailAccounts(settings);
    const preferredMailAccountId =
      this.selectedMailAccountId ??
      this.getRemoteUsers(settings).find((remoteUser) => remoteUser.remoteUserId === settings.us1Slot?.selectedRemoteUserId)
        ?.linkedMailAccountId ??
      accounts.find((account) => account.enabled !== false && account.connectionState === "connected")?.id ??
      accounts.find((account) => account.enabled !== false)?.id ??
      accounts[0]?.id ??
      null;

    this.selectedMailAccountId =
      preferredMailAccountId !== null && accounts.some((account) => account.id === preferredMailAccountId)
        ? preferredMailAccountId
        : null;

    return accounts.find((account) => account.id === this.selectedMailAccountId) ?? null;
  }

  resolveSelectedRemoteUser(settings: AppSettings, mailAccountId: string | null): RemoteUserIdentity | null {
    const remoteUsers = this.getRemoteUsers(settings, mailAccountId);
    const preferredRemoteUserId =
      this.selectedRemoteUserId ??
      settings.us1Slot?.selectedRemoteUserId ??
      remoteUsers[0]?.remoteUserId ??
      null;

    this.selectedRemoteUserId =
      preferredRemoteUserId !== null &&
      remoteUsers.some((remoteUser) => remoteUser.remoteUserId === preferredRemoteUserId)
        ? preferredRemoteUserId
        : null;

    return remoteUsers.find((remoteUser) => remoteUser.remoteUserId === this.selectedRemoteUserId) ?? null;
  }

  readSelectValue(select: HTMLSelectElement | null): string | null {
    if (select === null || select.value.trim() === "") {
      return null;
    }
    return select.value.trim();
  }

  async reloadSettings(): Promise<void> {
    if (typeof this.settingsManager.reload === "function") {
      await this.settingsManager.reload();
      return;
    }
    if (typeof this.settingsManager.load === "function") {
      await this.settingsManager.load({ force: true });
    }
  }

  async handleSaveMailAccount(verifyAfterSave: boolean): Promise<void> {
    const electronApi = window.electronAPI;
    if (electronApi === undefined) {
      this.showFeedback(entranceT("us1.feedback.electronUnavailable"), "error");
      return;
    }

    const draft = this.collectMailAccountDraft();
    if (draft.email === "") {
      this.showFeedback(entranceT("us1.feedback.mailEmailRequired"), "error");
      return;
    }

    const result = await electronApi.us1UpsertMailAccount(draft, { verifyAfterSave });
    await this.reloadSettings();
    this.selectedMailAccountId = result.localMailAccount?.mailAccountId ?? this.selectedMailAccountId;
    this.render();

    if (result.success) {
      this.showFeedback(
        verifyAfterSave === true
          ? entranceT("us1.feedback.mailVerifySuccess")
          : entranceT("us1.feedback.mailSaveSuccess"),
        "success"
      );
      return;
    }

    this.showFeedback(result.error ?? entranceT("us1.feedback.operationFailed"), "error");
  }

  async handleDeleteMailAccount(): Promise<void> {
    const electronApi = window.electronAPI;
    const mailAccountId = this.selectedMailAccountId;
    if (electronApi === undefined || mailAccountId === null) {
      this.showFeedback(entranceT("us1.feedback.mailAccountRequired"), "error");
      return;
    }

    const result = await electronApi.us1DeleteMailAccount({ mailAccountId });
    await this.reloadSettings();
    this.selectedMailAccountId = null;
    this.selectedRemoteUserId = null;
    this.render();

    if (result.success) {
      this.showFeedback(entranceT("us1.feedback.mailDeleteSuccess"), "success");
      return;
    }

    this.showFeedback(result.error ?? entranceT("us1.feedback.operationFailed"), "error");
  }

  async handleInviteRemoteUser(): Promise<void> {
    const electronApi = window.electronAPI;
    const selectedMailAccountId = this.selectedMailAccountId;
    if (electronApi === undefined) {
      this.showFeedback(entranceT("us1.feedback.electronUnavailable"), "error");
      return;
    }
    if (selectedMailAccountId === null) {
      this.showFeedback(entranceT("us1.feedback.mailAccountRequired"), "error");
      return;
    }

    const remoteEmailInput = document.getElementById("us1-remote-email-input") as HTMLInputElement | null;
    const remoteNicknameInput = document.getElementById("us1-remote-nickname-input") as HTMLInputElement | null;
    const email = remoteEmailInput?.value.trim().toLowerCase() ?? "";
    const nickname = remoteNicknameInput?.value.trim() ?? "";

    if (email === "") {
      this.showFeedback(entranceT("us1.feedback.remoteEmailRequired"), "error");
      return;
    }

    const result = await electronApi.us1InviteRemoteUser({
      mailAccountId: selectedMailAccountId,
      email,
      nickname,
    });
    await this.reloadSettings();
    this.selectedRemoteUserId = result.remoteUser?.remoteUserId ?? email;
    this.render();

    if (result.success) {
      this.showFeedback(entranceT("us1.feedback.inviteSent"), "success");
      return;
    }

    this.showFeedback(result.error ?? entranceT("us1.feedback.operationFailed"), "error");
  }

  async handleAcceptRemoteUser(): Promise<void> {
    const electronApi = window.electronAPI;
    const remoteUserId = this.selectedRemoteUserId;
    if (electronApi === undefined) {
      this.showFeedback(entranceT("us1.feedback.electronUnavailable"), "error");
      return;
    }
    if (remoteUserId === null) {
      this.showFeedback(entranceT("us1.feedback.remoteUserRequired"), "error");
      return;
    }

    const result = await electronApi.us1AcceptRemoteUser({ remoteUserId });
    await this.reloadSettings();
    this.render();

    if (result.success) {
      this.showFeedback(entranceT("us1.feedback.acceptSent"), "success");
      return;
    }

    this.showFeedback(result.error ?? entranceT("us1.feedback.operationFailed"), "error");
  }

  async handleRefreshRemoteUsers(): Promise<void> {
    const electronApi = window.electronAPI;
    if (electronApi === undefined) {
      this.showFeedback(entranceT("us1.feedback.electronUnavailable"), "error");
      return;
    }

    const result = await electronApi.us1SyncRemoteUsers({
      ...(this.selectedMailAccountId !== null ? { mailAccountId: this.selectedMailAccountId } : {}),
      limit: 25,
    });
    await this.reloadSettings();
    this.render();

    if (result.success) {
      this.showFeedback(
        entranceT("us1.feedback.syncSuccess", {
          count: String(result.processedCount ?? 0),
        }),
        "success"
      );
      return;
    }

    this.showFeedback(result.error ?? entranceT("us1.feedback.operationFailed"), "error");
  }

  collectMailAccountDraft(): Us1MailAccountDraft {
    const providerType =
      (document.getElementById("us1-mail-provider-select") as HTMLSelectElement | null)?.value ===
      "custom-imap-smtp"
        ? "custom-imap-smtp"
        : "gmail";
    const authType =
      (document.getElementById("us1-mail-auth-type-select") as HTMLSelectElement | null)?.value === "oauth2"
        ? "oauth2"
        : "password";

    const imapPort = this.readNumberInput("us1-mail-imap-port-input");
    const smtpPort = this.readNumberInput("us1-mail-smtp-port-input");

    return {
      mailAccountId: this.selectedMailAccountId,
      providerType,
      email: (document.getElementById("us1-mail-email-input") as HTMLInputElement | null)?.value.trim() ?? "",
      enabled: true,
      authType,
      imap: {
        host: (document.getElementById("us1-mail-imap-host-input") as HTMLInputElement | null)?.value.trim() ?? "",
        secure: (document.getElementById("us1-mail-imap-secure-check") as HTMLInputElement | null)?.checked ?? false,
        ...(imapPort !== undefined ? { port: imapPort } : {}),
      },
      smtp: {
        host: (document.getElementById("us1-mail-smtp-host-input") as HTMLInputElement | null)?.value.trim() ?? "",
        secure: (document.getElementById("us1-mail-smtp-secure-check") as HTMLInputElement | null)?.checked ?? false,
        ...(smtpPort !== undefined ? { port: smtpPort } : {}),
      },
      auth: {
        user: (document.getElementById("us1-mail-email-input") as HTMLInputElement | null)?.value.trim() ?? "",
        password:
          (document.getElementById("us1-mail-password-input") as HTMLInputElement | null)?.value ?? "",
        accessToken:
          (document.getElementById("us1-mail-access-token-input") as HTMLInputElement | null)?.value ?? "",
        refreshToken:
          (document.getElementById("us1-mail-refresh-token-input") as HTMLInputElement | null)?.value ?? "",
        clientId:
          (document.getElementById("us1-mail-client-id-input") as HTMLInputElement | null)?.value ?? "",
        clientSecret:
          (document.getElementById("us1-mail-client-secret-input") as HTMLInputElement | null)?.value ?? "",
      },
    };
  }

  readNumberInput(elementId: string): number | undefined {
    const value = (document.getElementById(elementId) as HTMLInputElement | null)?.value.trim() ?? "";
    if (value === "") {
      return undefined;
    }
    const parsed = Number.parseInt(value, 10);
    return Number.isFinite(parsed) ? parsed : undefined;
  }

  async updateUs1Slot(patch: Partial<NonNullable<AppSettings["us1Slot"]>>): Promise<void> {
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

  render(): void {
    const settings = this.settingsManager.getSnapshot();
    const selectedMailAccount = this.resolveSelectedMailAccount(settings);
    const remoteUsers = this.getRemoteUsers(settings, selectedMailAccount?.id ?? null);
    const selectedRemoteUser = this.resolveSelectedRemoteUser(settings, selectedMailAccount?.id ?? null);
    const activeRemoteUsers = this.getActiveRemoteUsers(settings);
    const selectedSlotRemoteUserId = settings.us1Slot?.selectedRemoteUserId ?? null;
    const selectedSlotRemoteUser =
      activeRemoteUsers.find((identity) => identity.remoteUserId === selectedSlotRemoteUserId) ?? null;
    const connected = AppState.isUs1Connected();

    this.renderMailAccountSelect(settings, selectedMailAccount);
    this.renderMailAccountForm(selectedMailAccount);
    this.renderRemoteUserSelect(remoteUsers, selectedRemoteUser);
    this.renderRemoteUserForm(selectedRemoteUser);
    this.renderSlotSelect(activeRemoteUsers, selectedSlotRemoteUser);

    const catchCheck = document.getElementById("us1-catch-check") as HTMLInputElement | null;
    if (catchCheck) {
      catchCheck.checked = settings.us1Slot?.catchCommands === true;
    }

    const connectBtn = document.getElementById("us1-connect-btn") as HTMLButtonElement | null;
    if (connectBtn) {
      connectBtn.disabled = selectedSlotRemoteUser === null || connected;
    }

    const disconnectBtn = document.getElementById("us1-disconnect-btn") as HTMLButtonElement | null;
    if (disconnectBtn) {
      disconnectBtn.disabled = connected === false;
    }

    const statusText = document.getElementById("us1-status-text");
    if (statusText) {
      statusText.textContent = this.getSlotStatusText(selectedMailAccount, activeRemoteUsers.length, selectedSlotRemoteUser, connected);
    }

    const hintText = document.getElementById("us1-phase-hint");
    if (hintText) {
      hintText.textContent = this.getPhaseHint(selectedMailAccount, activeRemoteUsers.length);
    }

    this.syncIndicators(connected);
  }

  renderMailAccountSelect(settings: AppSettings, selectedMailAccount: MailTransportAccountConfig | null): void {
    const mailAccountSelect = document.getElementById("us1-mail-account-select") as HTMLSelectElement | null;
    if (mailAccountSelect === null) {
      return;
    }

    const accounts = this.getLocalMailAccounts(settings);
    mailAccountSelect.innerHTML = "";

    const placeholder = document.createElement("option");
    placeholder.value = "";
    placeholder.textContent =
      accounts.length > 0 ? entranceT("us1.mailAccount.selectPlaceholder") : entranceT("us1.mailAccount.empty");
    mailAccountSelect.appendChild(placeholder);

    accounts.forEach((account) => {
      const option = document.createElement("option");
      option.value = account.id;
      option.textContent = `${account.email} · ${this.getMailAccountStateLabel(account)}`;
      mailAccountSelect.appendChild(option);
    });

    mailAccountSelect.value = selectedMailAccount?.id ?? "";
    mailAccountSelect.disabled = accounts.length === 0;
  }

  renderMailAccountForm(selectedMailAccount: MailTransportAccountConfig | null): void {
    const providerSelect = document.getElementById("us1-mail-provider-select") as HTMLSelectElement | null;
    const emailInput = document.getElementById("us1-mail-email-input") as HTMLInputElement | null;
    const authTypeSelect = document.getElementById("us1-mail-auth-type-select") as HTMLSelectElement | null;
    const passwordInput = document.getElementById("us1-mail-password-input") as HTMLInputElement | null;
    const accessTokenInput = document.getElementById("us1-mail-access-token-input") as HTMLInputElement | null;
    const refreshTokenInput = document.getElementById("us1-mail-refresh-token-input") as HTMLInputElement | null;
    const clientIdInput = document.getElementById("us1-mail-client-id-input") as HTMLInputElement | null;
    const clientSecretInput = document.getElementById("us1-mail-client-secret-input") as HTMLInputElement | null;
    const imapHostInput = document.getElementById("us1-mail-imap-host-input") as HTMLInputElement | null;
    const imapPortInput = document.getElementById("us1-mail-imap-port-input") as HTMLInputElement | null;
    const imapSecureCheck = document.getElementById("us1-mail-imap-secure-check") as HTMLInputElement | null;
    const smtpHostInput = document.getElementById("us1-mail-smtp-host-input") as HTMLInputElement | null;
    const smtpPortInput = document.getElementById("us1-mail-smtp-port-input") as HTMLInputElement | null;
    const smtpSecureCheck = document.getElementById("us1-mail-smtp-secure-check") as HTMLInputElement | null;

    if (providerSelect) providerSelect.value = selectedMailAccount?.providerType ?? "gmail";
    if (emailInput) emailInput.value = selectedMailAccount?.email ?? "";
    if (authTypeSelect) authTypeSelect.value = selectedMailAccount?.authType ?? "password";
    if (passwordInput) passwordInput.value = selectedMailAccount?.auth.password ?? "";
    if (accessTokenInput) accessTokenInput.value = selectedMailAccount?.auth.accessToken ?? "";
    if (refreshTokenInput) refreshTokenInput.value = selectedMailAccount?.auth.refreshToken ?? "";
    if (clientIdInput) clientIdInput.value = selectedMailAccount?.auth.clientId ?? "";
    if (clientSecretInput) clientSecretInput.value = selectedMailAccount?.auth.clientSecret ?? "";
    if (imapHostInput) imapHostInput.value = selectedMailAccount?.imap.host ?? "";
    if (imapPortInput) imapPortInput.value = selectedMailAccount?.imap.port ? String(selectedMailAccount.imap.port) : "";
    if (imapSecureCheck) imapSecureCheck.checked = selectedMailAccount?.imap.secure ?? true;
    if (smtpHostInput) smtpHostInput.value = selectedMailAccount?.smtp.host ?? "";
    if (smtpPortInput) smtpPortInput.value = selectedMailAccount?.smtp.port ? String(selectedMailAccount.smtp.port) : "";
    if (smtpSecureCheck) smtpSecureCheck.checked = selectedMailAccount?.smtp.secure ?? true;

    this.renderMailAccountFormState();

    const accountStatus = document.getElementById("us1-mail-account-status");
    if (accountStatus) {
      accountStatus.textContent = this.getMailAccountStatusText(selectedMailAccount);
    }

    const deleteBtn = document.getElementById("us1-mail-delete-btn") as HTMLButtonElement | null;
    if (deleteBtn) {
      deleteBtn.disabled = selectedMailAccount === null;
    }
  }

  renderMailAccountFormState(): void {
    const providerType =
      (document.getElementById("us1-mail-provider-select") as HTMLSelectElement | null)?.value ?? "gmail";
    const authType =
      (document.getElementById("us1-mail-auth-type-select") as HTMLSelectElement | null)?.value ?? "password";

    document
      .querySelectorAll<HTMLElement>("[data-us1-mail-custom]")
      .forEach((element) => element.classList.toggle("is-hidden", providerType !== "custom-imap-smtp"));
    document
      .querySelectorAll<HTMLElement>("[data-us1-mail-password]")
      .forEach((element) => element.classList.toggle("is-hidden", authType !== "password"));
    document
      .querySelectorAll<HTMLElement>("[data-us1-mail-oauth]")
      .forEach((element) => element.classList.toggle("is-hidden", authType !== "oauth2"));
  }

  renderRemoteUserSelect(remoteUsers: RemoteUserIdentity[], selectedRemoteUser: RemoteUserIdentity | null): void {
    const remoteUserSelect = document.getElementById("us1-remote-user-select") as HTMLSelectElement | null;
    if (remoteUserSelect === null) {
      return;
    }

    remoteUserSelect.innerHTML = "";

    const placeholder = document.createElement("option");
    placeholder.value = "";
    placeholder.textContent =
      remoteUsers.length > 0 ? entranceT("us1.remote.selectPlaceholder") : entranceT("us1.remote.empty");
    remoteUserSelect.appendChild(placeholder);

    remoteUsers.forEach((remoteUser) => {
      const option = document.createElement("option");
      option.value = remoteUser.remoteUserId;
      option.textContent = `${remoteUser.nickname || remoteUser.email} · ${this.getRemoteUserStateLabel(remoteUser)}`;
      remoteUserSelect.appendChild(option);
    });

    remoteUserSelect.value = selectedRemoteUser?.remoteUserId ?? "";
    remoteUserSelect.disabled = remoteUsers.length === 0;

    const remoteStatus = document.getElementById("us1-remote-user-status");
    if (remoteStatus) {
      remoteStatus.textContent = this.getRemoteUserStatusText(selectedRemoteUser);
    }

    const acceptBtn = document.getElementById("us1-remote-accept-btn") as HTMLButtonElement | null;
    if (acceptBtn) {
      acceptBtn.disabled = selectedRemoteUser?.handshakeState !== "handshake_pending";
    }
  }

  renderRemoteUserForm(selectedRemoteUser: RemoteUserIdentity | null): void {
    const emailInput = document.getElementById("us1-remote-email-input") as HTMLInputElement | null;
    const nicknameInput = document.getElementById("us1-remote-nickname-input") as HTMLInputElement | null;

    if (emailInput) {
      emailInput.value = selectedRemoteUser?.email ?? "";
    }
    if (nicknameInput) {
      nicknameInput.value = selectedRemoteUser?.nickname ?? "";
    }

    const inviteBtn = document.getElementById("us1-remote-invite-btn") as HTMLButtonElement | null;
    if (inviteBtn) {
      inviteBtn.disabled =
        this.selectedMailAccountId === null ||
        this.getSelectedMailAccountConnectionState() !== "connected";
    }

    const refreshBtn = document.getElementById("us1-remote-refresh-btn") as HTMLButtonElement | null;
    if (refreshBtn) {
      refreshBtn.disabled = this.selectedMailAccountId === null;
    }
  }

  renderSlotSelect(activeRemoteUsers: RemoteUserIdentity[], selectedRemoteUser: RemoteUserIdentity | null): void {
    const slotUserSelect = document.getElementById("us1-identity-select") as HTMLSelectElement | null;
    if (slotUserSelect === null) {
      return;
    }

    slotUserSelect.innerHTML = "";

    const placeholder = document.createElement("option");
    placeholder.value = "";
    placeholder.textContent =
      activeRemoteUsers.length > 0 ? entranceT("us1.selectPlaceholder") : entranceT("us1.noReadyUsers");
    slotUserSelect.appendChild(placeholder);

    activeRemoteUsers.forEach((identity) => {
      const option = document.createElement("option");
      option.value = identity.remoteUserId;
      option.textContent = `${identity.nickname || identity.email} (${identity.email})`;
      slotUserSelect.appendChild(option);
    });

    slotUserSelect.value = selectedRemoteUser?.remoteUserId ?? "";
    slotUserSelect.disabled = activeRemoteUsers.length === 0;
  }

  getMailAccountStatusText(selectedMailAccount: MailTransportAccountConfig | null): string {
    if (selectedMailAccount === null) {
      return entranceT("us1.mailAccount.status.none");
    }
    return entranceT(`us1.mailAccount.status.${selectedMailAccount.connectionState ?? "disconnected"}`);
  }

  getMailAccountStateLabel(selectedMailAccount: MailTransportAccountConfig): string {
    return entranceT(`us1.mailAccount.state.${selectedMailAccount.connectionState ?? "disconnected"}`);
  }

  getRemoteUserStatusText(selectedRemoteUser: RemoteUserIdentity | null): string {
    if (selectedRemoteUser === null) {
      return entranceT("us1.remote.status.none");
    }
    return entranceT(`us1.remote.status.${selectedRemoteUser.handshakeState}`);
  }

  getRemoteUserStateLabel(remoteUser: RemoteUserIdentity): string {
    return entranceT(`us1.remote.state.${remoteUser.handshakeState}`);
  }

  getSelectedMailAccountConnectionState(): "connected" | "disconnected" | "error" {
    const settings = this.settingsManager.getSnapshot();
    const selectedMailAccount = this.resolveSelectedMailAccount(settings);
    return selectedMailAccount?.connectionState ?? "disconnected";
  }

  getSlotStatusText(
    selectedMailAccount: MailTransportAccountConfig | null,
    activeUserCount: number,
    selectedRemoteUser: RemoteUserIdentity | null,
    connected: boolean
  ): string {
    if (selectedMailAccount === null) {
      return entranceT("us1.status.noMailAccount");
    }
    if (selectedMailAccount.connectionState !== "connected") {
      return entranceT("us1.status.noConnectedMailAccount");
    }
    if (activeUserCount === 0) {
      return entranceT("us1.status.noUsers");
    }
    if (selectedRemoteUser === null) {
      return entranceT("us1.status.empty");
    }
    if (connected) {
      return entranceT("us1.status.connected");
    }
    return entranceT("us1.status.ready");
  }

  getPhaseHint(selectedMailAccount: MailTransportAccountConfig | null, activeUserCount: number): string {
    if (selectedMailAccount === null) {
      return entranceT("us1.phaseHintNoMailAccount");
    }
    if (selectedMailAccount.connectionState !== "connected") {
      return entranceT("us1.phaseHintVerifyMail");
    }
    if (activeUserCount === 0) {
      return entranceT("us1.phaseHintHandshake");
    }
    return entranceT("us1.phaseHint");
  }

  showFeedback(message: string, kind: FeedbackKind = "info"): void {
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

  syncIndicators(connected: boolean): void {
    TrafficManager.setIndicator("us1", "loading", "idle");
    TrafficManager.setIndicator("us1", "thinking", "idle");
    TrafficManager.setIndicator("us1", "send", connected ? "idle" : "busy");
  }
}
