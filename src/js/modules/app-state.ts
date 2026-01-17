import { SettingsManager } from "./settings-manager.js";
import { LogManager } from "./log-manager.js";

class AppStateClass {
  activeProvider: string | null;
  activeConversations: Record<string, string | null>;
  listeners: ((state: any) => void)[];
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
    // Asistan (AI0) relay durumu
    this.asistanRelay = {
      active: false,
      sourceSlot: null, // "ai1" veya "ai2"
    };
  }

  init(defaultProvider = "ai1") {
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

  setActiveProvider(provider: string) {
    this.activeProvider = provider;
    this.notify();
  }

  setActiveConversation(provider: string, conversationId: string | null) {
    this.activeConversations[provider] = conversationId;
    this.notify();
  }

  getSettings() {
    return SettingsManager.getSnapshot();
  }

  getAccountForSlot(slot: string) {
    const settings = this.getSettings();
    
    // AI0 (Asistan) için asistanSlot ve asistanAccounts kullan
    if (slot === "ai0") {
      const accountId = settings.asistanSlot?.accountId;
      if (!accountId) return null;
      return settings.asistanAccounts?.find((acc: { id: string }) => acc.id === accountId) || null;
    }
    
    // AI1/AI2 için normal slots ve accounts kullan
    const accountId = settings.slots?.[slot]?.accountId;
    if (!accountId) return null;
    return settings.accounts?.find((acc: { id: string }) => acc.id === accountId) || null;
  }

  getProviderIdForSlot(slot: string) {
    const account = this.getAccountForSlot(slot);
    return account?.provider || null;
  }

  getAvatar(provider: string) {
    const settings = this.getSettings();
    if (provider === "user") {
      return settings.user?.avatarPath || "";
    }
    const account = this.getAccountForSlot(provider);
    return account?.avatarPath || "";
  }

  getNickname(provider: string) {
    const settings = this.getSettings();
    if (provider === "user") {
      return settings.user?.nickname || "Kullanıcı";
    }
    const account = this.getAccountForSlot(provider);
    return account?.nickname || account?.email || provider.toUpperCase();
  }


  setChatTargets(targets = []) {
    const uniq = Array.from(new Set(targets.filter(Boolean)));
    this.chat.activeTargets = uniq.length ? uniq : ["ai1"];
    this.notify();
  }

  setChatTitle(provider: string, title: string) {
    this.chat.titleByProvider = {
      ...this.chat.titleByProvider,
      [provider]: title || "",
    };
    this.notify();
  }

  // Asistan relay durumunu ayarla
  setAsistanRelay(active: boolean, sourceSlot: string | null = null) {
    this.asistanRelay = {
      active: !!active,
      sourceSlot: active ? sourceSlot : null,
    };
    this.notify();
  }

  getAsistanRelay() {
    return { ...this.asistanRelay };
  }

  getState() {
    return {
      provider: this.activeProvider,
      conversations: { ...this.activeConversations },
      chat: { ...this.chat, titleByProvider: { ...this.chat.titleByProvider } },
      asistanRelay: { ...this.asistanRelay },
    };
  }

  subscribe(listener: (state: ReturnType<AppStateClass["getState"]>) => void) {
    if (typeof listener === "function") {
      this.listeners.push(listener);
    }
    return () => {
      this.listeners = this.listeners.filter((l) => l !== listener);
    };
  }

  notify() {
    const snapshot = this.getState();
    this.listeners.forEach((listener) => {
      try {
        listener(snapshot);
      } catch (err) {
        LogManager.addEvent("app-state", "error", `Listener error: ${(err as Error).message}`);
      }
    });
  }
}

export const AppState = new AppStateClass();
