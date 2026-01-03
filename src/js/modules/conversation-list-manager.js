// @ts-nocheck
import { CoreEngine } from "./core-engine.js";
import { LogManager } from "./log-manager.js";

class ConversationListManagerClass {
  constructor() {
    this.selects = {
      ai1: document.getElementById("conversation-ai1"),
      ai2: document.getElementById("conversation-ai2"),
    };
    this.entries = [];
    this.currentSelections = { ai1: "new", ai2: "new" };
  }

  async init() {
    await this.refresh({ silent: true });
    this.bindEvents();
  }

  bindEvents() {
    for (const provider in this.selects) {
      this.selects[provider]?.addEventListener("change", () =>
        this.handleConversationChange(provider),
      );
    }
  }

  handleConversationChange(provider, options = { isInitial: false }) {
    const select = this.selects[provider];
    if (!select) return;

    const conversationId = select.value;
    this.currentSelections[provider] = conversationId;

    const entry = this.entries.find((e) => e.id === conversationId);
    CoreEngine.navigateTo(provider, entry?.webUrl || null);

    if (!options.isInitial) {
      LogManager.addEvent(
        "conversation",
        "info",
        `User selected: ${provider} -> ${conversationId}`,
      );
    }
  }

  async refresh(
    options = { silent: false, forceSelectId: null, skipNotify: false },
  ) {
    try {
      this.entries = (await window.electronAPI?.readArchivesIndex?.()) || [];
      this.renderAll(options);
      if (options.forceSelectId) {
        this.updateSelection(options.forceSelectId, { silent: true });
      }
      // After refresh from sync, notify analyze page to update messages (unless skipped)
      if (!options.skipNotify) {
        window.dispatchEvent(
          new CustomEvent("conversation-selected", {
            detail: { provider: "ai1" },
          }),
        );
        window.dispatchEvent(
          new CustomEvent("conversation-selected", {
            detail: { provider: "ai2" },
          }),
        );
      }
    } catch (error) {
      LogManager.addEvent(
        "conversation",
        "error",
        `Listeyi yenileme hatası: ${error.message}`,
      );
    }
  }

  renderAll(options = {}) {
    for (const provider in this.selects) {
      this.render(provider, options);
    }
  }

  render(provider, options = {}) {
    const select = this.selects[provider];
    if (!select) return;

    const currentVal = options.silent
      ? select.value
      : this.currentSelections[provider] || "new";

    select.innerHTML = "";

    const newOption = new Option("Yeni Sohbet", "new");
    newOption.dataset.url = "";
    newOption.dataset.folder = "";
    select.appendChild(newOption);

    const providerEntries = this.entries.filter((e) => e.provider === provider);
    providerEntries.sort((a, b) => b.mtime - a.mtime);

    for (const entry of providerEntries) {
      const option = new Option(entry.title || entry.id, entry.id);
      option.dataset.folder = entry.folder || "";
      option.dataset.url = entry.webUrl || "";
      select.appendChild(option);
    }

    select.value = currentVal;
    if (select.selectedIndex === -1) {
      select.value = "new";
    }
    this.currentSelections[provider] = select.value;
  }

  updateSelection(conversationId, options = { silent: false }) {
    const entry = this.entries.find((e) => e.id === conversationId);
    if (!entry) return;

    const { provider } = entry;
    const select = this.selects[provider];
    if (select && select.value !== conversationId) {
      select.value = conversationId;
      this.currentSelections[provider] = conversationId;
      if (!options.silent) {
        this.handleConversationChange(provider);
      }
    }
  }
}

export const ConversationListManager = new ConversationListManagerClass();
