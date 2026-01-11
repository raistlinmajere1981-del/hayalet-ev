import { SettingsManager } from "./settings-manager.js";

class AppStateClass {
  constructor() {
    this.activeProvider = null;
    this.activeConversations = {};
    this.listeners = [];
    this.chat = {
      activeTargets: ["ai1"],
      titleByProvider: { ai1: "", ai2: "" },
    };
  }

  init(defaultProvider = "ai1") {
    this.activeProvider = defaultProvider;
    this.activeConversations = { ai1: null, ai2: null };
    this.chat = {
      activeTargets: ["ai1"],
      titleByProvider: { ai1: "", ai2: "" },
    };
    this.notify();
  }

  setActiveProvider(provider) {
    this.activeProvider = provider;
    this.notify();
  }

  setActiveConversation(provider, conversationId) {
    this.activeConversations[provider] = conversationId;
    this.notify();
  }

  getNickname(provider) {
    const settings = SettingsManager.getSnapshot();
    if (provider === "user") {
      return settings.user?.nickname || "Kullanıcı";
    }
    if (provider === "ai1" || provider === "ai2") {
      const accountId = settings.slots?.[provider]?.accountId;
      if (!accountId) return provider.toUpperCase();

      const accounts = Array.isArray(settings.accounts)
        ? settings.accounts
        : [];
      const account =
        accounts.find((acc) => acc && acc.id === accountId) || null;

      return (
        (account && (account.nickname || account.email)) ||
        provider.toUpperCase()
      );
    }
    return provider.toUpperCase();
  }


  setChatTargets(targets = []) {
    const uniq = Array.from(new Set(targets.filter(Boolean)));
    this.chat.activeTargets = uniq.length ? uniq : ["ai1"];
    this.notify();
  }

  setChatTitle(provider, title) {
    this.chat.titleByProvider = {
      ...this.chat.titleByProvider,
      [provider]: title || "",
    };
    this.notify();
  }

  getState() {
    return {
      provider: this.activeProvider,
      conversations: { ...this.activeConversations },
      chat: { ...this.chat, titleByProvider: { ...this.chat.titleByProvider } },
    };
  }

  subscribe(listener) {
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
      }
    });
  }
}

export const AppState = new AppStateClass();
