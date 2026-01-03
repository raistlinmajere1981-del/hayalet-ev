// AppState - global aktif sağlayıcı/konuşma durumunu tutan yapı
import { getNickname as getHelperNickname } from "./settings-helpers.js";
import { SettingsContext } from "./settings-context.js";

class AppStateClass {
  constructor() {
    this.activeProvider = null;
    this.activeConversations = {};
    this.connections = { human: true, ai1: false, ai2: false };
    this.nicknames = { human: "User", ai1: "AI1", ai2: "AI2" };
    this.listeners = [];
    this.chat = {
      activeTargets: ["ai1"],
      titleByProvider: { ai1: "", ai2: "" },
    };
  }

  init(defaultProvider = "ai1") {
    this.activeProvider = defaultProvider;
    this.activeConversations = { ai1: null, ai2: null };
    this.connections = { human: true, ai1: false, ai2: false };
    this.nicknames = { human: "User", ai1: "AI1", ai2: "AI2" };
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

  setConnection(provider, connected) {
    this.connections[provider] = !!connected;
    this.notify();
  }

  setNicknames(nicks = {}) {
    this.nicknames = { ...this.nicknames, ...nicks };
    this.notify();
  }

  getNickname(provider) {
    // For ai1/ai2, use helper to get nickname from active account
    if (provider === "ai1" || provider === "ai2") {
      const settings = SettingsContext.get();
      if (settings) {
        return getHelperNickname(settings, provider);
      }
    }
    
    return (
      this.nicknames[provider] ||
      (provider === "human" ? "User" : provider.toUpperCase())
    );
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

  getConnection(provider) {
    return !!this.connections[provider];
  }

  getState() {
    return {
      provider: this.activeProvider,
      conversations: { ...this.activeConversations },
      connections: { ...this.connections },
      nicknames: { ...this.nicknames },
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
        console.warn("AppState listener error:", err);
      }
    });
  }
}

export const AppState = new AppStateClass();
