import { SettingsManager } from "./settings-manager.js";
import { Logger, LogCategory } from "./logger/index.js";
import type { Account, AppSettings } from "@shared/settings.js";

interface AppStateSnapshot {
  activeProvider: string | null;
  activeConversations: Record<string, string | null>;
  chat: {
    activeTargets: string[];
    titleByProvider: Record<string, string>;
  };
  asistanRelay: {
    active: boolean;
    sourceSlot: string | null;
  };
}

class AppStateClass {
  activeProvider: string | null;
  activeConversations: Record<string, string | null>;
  listeners: ((state: AppStateSnapshot) => void)[];
  chat: {
    activeTargets: string[];
    titleByProvider: Record<string, string>;
  };
  asistanRelay: {
    active: boolean;
    sourceSlot: string | null;
  };

  constructor() {
    this.activeProvider = null;
    this.activeConversations = {};
    this.listeners = [];
    this.chat = {
      activeTargets: ["ai1"],
      titleByProvider: { ai0: "", ai1: "", ai2: "" },
    };
    this.asistanRelay = {
      active: false,
      sourceSlot: null, // "ai1" veya "ai2"
    };
  }

  init(defaultProvider = "ai1"): void {
    this.activeProvider = defaultProvider;
    this.activeConversations = { ai0: null, ai1: null, ai2: null };
    this.chat = {
      activeTargets: ["ai1"],
      titleByProvider: { ai0: "", ai1: "", ai2: "" },
    };
    this.asistanRelay = {
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
      const accountId = settings.asistanSlot?.accountId;
      if (accountId === undefined || accountId === "") return null;
      return settings.asistanAccounts?.find((acc) => acc.id === accountId) ?? null;
    }

    const accountId = settings.slots[slot]?.accountId;
    if (accountId === undefined || accountId === "") return null;
    return settings.accounts.find((acc) => acc.id === accountId) ?? null;
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
    const account = this.getAccountForSlot(provider);
    return account?.avatarPath ?? "";
  }

  getNickname(provider: string): string {
    const settings = this.getSettings();
    if (settings === null) {
      return provider === "user" ? "Kullanıcı" : provider.toUpperCase();
    }
    if (provider === "user") {
      return settings.user?.nickname ?? "Kullanıcı";
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

  setAsistanRelay(active: boolean, sourceSlot: string | null = null): void {
    this.asistanRelay = {
      active: !!active,
      sourceSlot: active ? sourceSlot : null,
    };
    this.notify();
  }

  getAsistanRelay(): { active: boolean; sourceSlot: string | null } {
    return { ...this.asistanRelay };
  }

  getState(): AppStateSnapshot {
    return {
      activeProvider: this.activeProvider,
      activeConversations: { ...this.activeConversations },
      chat: { ...this.chat, titleByProvider: { ...this.chat.titleByProvider } },
      asistanRelay: { ...this.asistanRelay },
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
        Logger.error(LogCategory.SYSTEM, `Listener error: ${(err as Error).message}`, {
          error: err,
        });
      }
    });
  }
}

const appState = new AppStateClass();
export { appState as AppState };
