import { SettingsManager } from "./settings-manager.js";
import { Logger, LogCategory } from "./logger/index.js";
import type {
  Account,
  AppSettings,
  RemoteUserIdentity,
  Us1SlotSettings,
} from "@shared/settings.js";
import { getRemoteEmailAccounts, isAiProviderAccount } from "@shared/settings.js";
import { AppI18n } from "./i18n/index.js";
import {
  buildRemoteEmailAccountId,
  extractUs1RemoteIdentityIdFromAccountId,
  isUs1ProjectedAccountId,
  isRemoteEmailAccountId,
  type ArchiveProviderKey,
} from "@shared/archive.js";

interface AppStateSnapshot {
  activeProvider: string | null;
  activeConversations: Record<string, string | null>;
  chat: {
    activeTargets: string[];
    titleByProvider: Record<string, string>;
  };
  assistantRelay: {
    active: boolean;
    sourceSlot: string | null;
  };
}

function getDefaultUserNickname(): string {
  return AppI18n.t("entrance.user.defaultNickname");
}

function isLegacyDefaultNickname(value: string): boolean {
  const normalized = value
    .trim()
    .toLocaleLowerCase("tr-TR")
    .normalize("NFKD")
    .replace(/\p{Diacritic}/gu, "")
    .replace(/\u0131/g, "i");

  return normalized === "user" || normalized === "user";
}

class AppStateClass {
  activeProvider: string | null;
  activeConversations: Record<string, string | null>;
  listeners: ((state: AppStateSnapshot) => void)[];
  chat: {
    activeTargets: string[];
    titleByProvider: Record<string, string>;
  };
  assistantRelay: {
    active: boolean;
    sourceSlot: string | null;
  };

  constructor() {
    this.activeProvider = null;
    this.activeConversations = {};
    this.listeners = [];
    this.chat = {
      activeTargets: ["ai1"],
      titleByProvider: { ai0: "", ai1: "", ai2: "", us1: "" },
    };
    this.assistantRelay = {
      active: false,
      sourceSlot: null,
    };
  }

  init(defaultProvider = "ai1"): void {
    this.activeProvider = defaultProvider;
    this.activeConversations = { ai0: null, ai1: null, ai2: null, us1: null };
    this.chat = {
      activeTargets: ["ai1"],
      titleByProvider: { ai0: "", ai1: "", ai2: "", us1: "" },
    };
    this.assistantRelay = {
      active: false,
      sourceSlot: null,
    };
    this.notify();
  }

  setActiveProvider(provider: string): void {
    this.activeProvider = provider;
    this.notify();
  }

  setActiveConversation(provider: string, conversationId: string | null): void {
    this.activeConversations[provider] = conversationId;
    this.notify();
  }

  getSettings(): AppSettings | null {
    return SettingsManager.getSnapshot() as AppSettings | null;
  }

  getAccountForSlot(slot: string): Account | null {
    const settings = this.getSettings();

    if (settings === null) return null;

    if (slot === "ai0") {
      const accountId = settings.assistantSlot?.accountId;
      if (accountId === undefined || accountId === "") return null;
      return settings.assistantAccounts?.find((acc) => acc.id === accountId) ?? null;
    }

    const accountId = settings.slots[slot]?.accountId;
    if (accountId === undefined || accountId === "") return null;
    const account = settings.accounts.find((acc) => acc.id === accountId) ?? null;
    return isAiProviderAccount(account) ? account : null;
  }

  getRemoteUsers(): RemoteUserIdentity[] {
    const settings = this.getSettings();
    if (settings === null || !Array.isArray(settings.remoteUsers)) {
      return [];
    }
    return settings.remoteUsers;
  }

  getUs1SlotSettings(): Us1SlotSettings {
    const settings = this.getSettings();
    return (
      settings?.us1Slot ?? {
        selectedRemoteUserId: null,
        selectedAccountId: null,
        connectionState: "disconnected",
        catchCommands: false,
      }
    );
  }

  private getUs1RemoteAccount(settings: AppSettings | null = null): Account | null {
    const effectiveSettings = settings ?? this.getSettings();
    if (effectiveSettings === null) {
      return null;
    }

    const remoteAccounts = getRemoteEmailAccounts(effectiveSettings.accounts);
    const selectedAccountId =
      typeof effectiveSettings.us1Slot?.selectedAccountId === "string"
        ? effectiveSettings.us1Slot.selectedAccountId.trim()
        : "";
    if (selectedAccountId !== "") {
      const selectedAccount =
        remoteAccounts.find((account) => account.id === selectedAccountId) ?? null;
      if (selectedAccount?.remoteEmail?.handshakeState === "active") {
        return selectedAccount;
      }
    }

    const selectedRemoteUserId =
      typeof effectiveSettings.us1Slot?.selectedRemoteUserId === "string"
        ? effectiveSettings.us1Slot.selectedRemoteUserId.trim()
        : "";
    if (selectedRemoteUserId === "") {
      return null;
    }

    return (
      remoteAccounts.find(
        (account) =>
          account.remoteEmail?.remoteUserId === selectedRemoteUserId &&
          account.remoteEmail.handshakeState === "active"
      ) ?? null
    );
  }

  getUs1Identity(): RemoteUserIdentity | null {
    const settings = this.getSettings();
    const remoteAccount = this.getUs1RemoteAccount(settings);
    const remoteState = remoteAccount?.remoteEmail ?? null;
    if (remoteAccount !== null && remoteState !== null) {
      return {
        remoteUserId: remoteState.remoteUserId,
        email: remoteAccount.email,
        ...(remoteAccount.nickname !== undefined ? { nickname: remoteAccount.nickname } : {}),
        ...(remoteAccount.avatar !== undefined ? { avatar: remoteAccount.avatar } : {}),
        ...(remoteAccount.avatarPath !== undefined
          ? { avatarPath: remoteAccount.avatarPath }
          : {}),
        handshakeState: remoteState.handshakeState,
        profileRevision: remoteState.profileRevision,
        linkedMailAccountId: remoteState.linkedLocalMailAccountId,
        ...(remoteState.inviteMessageId !== undefined
          ? { inviteMessageId: remoteState.inviteMessageId ?? null }
          : {}),
        ...(remoteState.acceptMessageId !== undefined
          ? { acceptMessageId: remoteState.acceptMessageId ?? null }
          : {}),
        ...(remoteState.threadMessageId !== undefined
          ? { threadMessageId: remoteState.threadMessageId ?? null }
          : {}),
        ...(remoteState.lastTransportMessageId !== undefined
          ? { lastTransportMessageId: remoteState.lastTransportMessageId ?? null }
          : {}),
        ...(remoteState.lastSyncAt !== undefined ? { lastSyncAt: remoteState.lastSyncAt } : {}),
        ...(remoteState.lastError !== undefined ? { lastError: remoteState.lastError ?? null } : {}),
        ...(remoteState.sessionAlias !== undefined
          ? { sessionAlias: remoteState.sessionAlias ?? null }
          : {}),
      };
    }

    const selectedRemoteUserId =
      typeof settings?.us1Slot?.selectedRemoteUserId === "string"
        ? settings.us1Slot.selectedRemoteUserId.trim()
        : typeof settings?.us1Slot?.selectedAccountId === "string"
          ? extractUs1RemoteIdentityIdFromAccountId(settings.us1Slot.selectedAccountId)
          : null;
    if (selectedRemoteUserId === null || selectedRemoteUserId === "") {
      return null;
    }

    return this.getRemoteUsers().find(
      (identity) =>
        identity.remoteUserId === selectedRemoteUserId && identity.handshakeState === "active"
    ) ?? null;
  }

  hasUs1Identity(): boolean {
    return this.getUs1Identity() !== null;
  }

  isUs1Connected(): boolean {
    return this.getUs1SlotSettings().connectionState === "connected" && this.hasUs1Identity();
  }

  getUs1ArchiveAccountId(): string | null {
    const remoteAccount = this.getUs1RemoteAccount();
    if (remoteAccount?.id) {
      return remoteAccount.id;
    }

    const identity = this.getUs1Identity();
    if (identity?.remoteUserId === undefined || identity.remoteUserId === "") {
      return null;
    }

    const selectedAccountId = this.getUs1SlotSettings().selectedAccountId;
    const derivedAccountId = buildRemoteEmailAccountId(identity.remoteUserId);
    const accountId =
      (typeof selectedAccountId === "string" && selectedAccountId.trim() !== ""
        ? selectedAccountId.trim()
        : null) ??
      derivedAccountId;
    return accountId !== "" ? accountId : null;
  }

  getArchiveAccountIdForProvider(provider: string): string | null {
    if (provider === "us1") {
      return this.getUs1ArchiveAccountId();
    }

    const account = this.getAccountForSlot(provider);
    return account?.id ?? null;
  }

  resolveArchiveProviderByAccountId(accountId: string): ArchiveProviderKey | null {
    if (accountId === "") {
      return null;
    }

    if (this.getAccountForSlot("ai1")?.id === accountId) {
      return "ai1";
    }

    if (this.getAccountForSlot("ai2")?.id === accountId) {
      return "ai2";
    }

    const us1AccountId = this.getUs1ArchiveAccountId();
    if (
      us1AccountId === accountId ||
      isUs1ProjectedAccountId(accountId) ||
      isRemoteEmailAccountId(accountId)
    ) {
      return "us1";
    }

    return null;
  }

  getProviderIdForSlot(slot: string): string | null {
    const account = this.getAccountForSlot(slot);
    return account?.provider ?? null;
  }

  getAvatar(provider: string): string {
    const settings = this.getSettings();
    if (settings === null) return "";
    if (provider === "user") {
      return settings.user?.avatarPath ?? "";
    }
    if (provider === "us1") {
      const identity = this.getUs1Identity();
      return identity?.avatarPath ?? identity?.avatar ?? "";
    }
    const account = this.getAccountForSlot(provider);
    return account?.avatarPath ?? "";
  }

  getNickname(provider: string): string {
    const settings = this.getSettings();
    if (settings === null) {
      return provider === "user" ? getDefaultUserNickname() : provider.toUpperCase();
    }
    if (provider === "user") {
      const nickname = settings.user?.nickname?.trim() ?? "";
      if (nickname === "" || isLegacyDefaultNickname(nickname)) {
        return getDefaultUserNickname();
      }
      return nickname;
    }
    if (provider === "us1") {
      const identity = this.getUs1Identity();
      return String(identity?.nickname ?? identity?.email ?? "US1");
    }
    const account = this.getAccountForSlot(provider);
    return String(account?.nickname ?? account?.email ?? provider.toUpperCase());
  }

  setChatTargets(targets: string[] = []): void {
    const uniq = Array.from(new Set(targets.filter((target) => target !== "")));
    this.chat.activeTargets = uniq.length > 0 ? uniq : ["ai1"];
    this.notify();
  }

  setChatTitle(provider: string, title: string): void {
    this.chat.titleByProvider = {
      ...this.chat.titleByProvider,
      [provider]: title,
    };
    this.notify();
  }

  setAssistantRelay(active: boolean, sourceSlot: string | null = null): void {
    this.assistantRelay = {
      active: !!active,
      sourceSlot: active ? sourceSlot : null,
    };
    this.notify();
  }

  getAssistantRelay(): { active: boolean; sourceSlot: string | null } {
    return { ...this.assistantRelay };
  }

  getState(): AppStateSnapshot {
    return {
      activeProvider: this.activeProvider,
      activeConversations: { ...this.activeConversations },
      chat: { ...this.chat, titleByProvider: { ...this.chat.titleByProvider } },
      assistantRelay: { ...this.assistantRelay },
    };
  }

  subscribe(listener: (state: ReturnType<AppStateClass["getState"]>) => void): () => void {
    if (typeof listener === "function") {
      this.listeners.push(listener);
    }
    return () => {
      this.listeners = this.listeners.filter((l) => l !== listener);
    };
  }

  notify(): void {
    const snapshot = this.getState();
    this.listeners.forEach((listener) => {
      try {
        listener(snapshot);
      } catch (err) {
        Logger.errorT(
          LogCategory.SYSTEM,
          "app.logs.appState.listenerError",
          {
            message: err instanceof Error ? err.message : String(err),
          },
          {
            error: err,
          }
        );
      }
    });
  }
}

const appState = new AppStateClass();
export { appState as AppState };
