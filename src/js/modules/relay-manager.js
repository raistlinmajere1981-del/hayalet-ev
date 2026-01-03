// @ts-nocheck
import { TrafficManager } from "./traffic-manager.js";
import { WebviewManager } from "./webview-manager.js";
import { LogManager } from "./log-manager.js";
import { AppState } from "./app-state.js";

class RelayManagerClass {
  constructor() {
    this.coreEngine = null;
    this.active = false;
    this._prevThinking = { ai1: "idle", ai2: "idle" };
    this._forwardCount = 0;
    this._providers = ["ai1", "ai2"];
    this._session = null;
    this._boundUpdate = this._onTrafficUpdate.bind(this);
  }

  init(coreEngine) {
    this.coreEngine = coreEngine;
    TrafficManager.onUpdate(this._boundUpdate);
  }

  isActive() {
    return !!this.active;
  }

  startSession(opts = {}) {
    this._providers =
      Array.isArray(opts.providers) && opts.providers.length
        ? opts.providers
        : ["ai1", "ai2"];
    this.active = true;
    this._forwardCount = 0;
    LogManager.addEvent(
      "relay",
      "info",
      `Relay started: ${this._providers.join(",")}`,
    );
    this._updateIndicator();
    try {
      window.dispatchEvent(
        new CustomEvent("relay-changed", { detail: { active: true } }),
      );
    } catch (e) {
      /* noop */
    }
  }

  /**
   * Start a sequential protocol session: send protocol first to providers[0],
   * then wait for its assistant reply, include it into protocol, send to providers[1],
   * and then activate relay to forward replies back and forth until stopped.
   * opts: { providers: ['ai1','ai2'], protocolPayload, attachments }
   */
  async startProtocolSession(opts = {}) {
    try {
      if (
        !opts ||
        !opts.protocolPayload ||
        !Array.isArray(opts.providers) ||
        opts.providers.length < 2
      ) {
        throw new Error("Invalid protocol session args");
      }
      const providers = opts.providers;
      const id = `relay-${Date.now()}-${Math.random().toString(16).slice(2)}`;
      this._session = {
        id,
        providers: [...providers],
        protocolPayload: { ...opts.protocolPayload },
        attachments: Array.isArray(opts.attachments)
          ? [...opts.attachments]
          : [],
        state: "sent-to-ai1",
        lastTexts: { [providers[0]]: "", [providers[1]]: "" },
        forwardCount: 0,
        createdAt: Date.now(),
      };
      this._providers = [...providers];
      this.active = true;
      const first = providers[0];
      const message = this._session.protocolPayload.message || "";
      const attachments = this._session.attachments || [];
      LogManager.addEvent(
        "relay",
        "info",
        `Protocol session ${id}: sending to ${first}`,
      );
      await this.coreEngine.sendToTargets({
        targets: [first],
        text: message,
        page: `protocol-relay`,
        attachments,
      });
      LogManager.addEvent(
        "relay",
        "info",
        `Protocol session ${id}: sent to ${first}`,
      );
      this._updateIndicator();
      try {
        window.dispatchEvent(
          new CustomEvent("relay-changed", { detail: { active: true } }),
        );
      } catch (e) {
        /* noop */
      }
    } catch (err) {
      LogManager.addEvent(
        "relay",
        "warning",
        `startProtocolSession error: ${err?.message || String(err)}`,
      );
    }
  }

  stopSession() {
    this.active = false;
    this._session = null;
    LogManager.addEvent("relay", "info", "Relay stopped");
    this._updateIndicator();
    try {
      window.dispatchEvent(
        new CustomEvent("relay-changed", { detail: { active: false } }),
      );
    } catch (e) {
      /* noop */
    }
  }

  stopProtocolSession() {
    try {
      if (this._session) {
        LogManager.addEvent(
          "relay",
          "info",
          `Protocol session ${this._session.id} stopped by user`,
        );
      }
      this._session = null;
      this.active = false;
      this._updateIndicator();
      try {
        window.dispatchEvent(
          new CustomEvent("relay-changed", { detail: { active: false } }),
        );
      } catch (e) {
        /* noop */
      }
    } catch (e) {
      /* noop */
    }
  }

  async _onTrafficUpdate(snapshot) {
    try {
      if (!this.active) return;
      const provider = snapshot?.provider;
      if (!provider || !this._providers.includes(provider)) return;
      const state = snapshot?.state || {};
      const currentThinking = state.thinkingState || "idle";
      const prev = this._prevThinking[provider] || "idle";
      this._prevThinking[provider] = currentThinking;
      if (prev !== "idle" && currentThinking === "idle") {
        await this._onThinkingComplete(provider);
      }
    } catch (err) {
      LogManager.addEvent(
        "relay",
        "warning",
        `Traffic update handler error: ${err?.message || String(err)}`,
      );
    }
  }

  async _onThinkingComplete(provider) {
    try {
      const res = await WebviewManager.syncConversation(provider);
      if (!res || !Array.isArray(res.messages)) return;
      const lastAssistant = [...res.messages]
        .reverse()
        .find((m) => m.role === "assistant" && (m.text || "").trim());
      if (!lastAssistant || !lastAssistant.text) return;
      const text = lastAssistant.text.trim();

      // If a protocol session is active, handle sequential flow
      if (this._session) {
        const s = this._session;
        const [a0, a1] = s.providers;
        // If waiting for ai1 response
        if (s.state === "sent-to-ai1" && provider === a0) {
          // avoid duplicate
          if (s.lastTexts[a0] === text) return;
          s.lastTexts[a0] = text;
          LogManager.addEvent(
            "relay",
            "info",
            `Protocol session ${s.id}: assistant ${a0} replied`,
            { excerpt: text.slice(0, 200) },
          );
          const baseMsg = s.protocolPayload?.message || "";
          const forwardText = `${baseMsg}\n\n[${a0}]: ${text}`;
          s.state = "sent-to-ai2";
          try {
            await this.coreEngine.sendToTargets({
              targets: [a1],
              text: forwardText,
              page: "protocol-relay",
              attachments: s.attachments,
            });
            LogManager.addEvent(
              "relay",
              "info",
              `Protocol session ${s.id}: forwarded AI1 -> AI2`,
            );
            this.active = true;
            this._updateIndicator();
            try {
              window.dispatchEvent(
                new CustomEvent("relay-changed", { detail: { active: true } }),
              );
            } catch (e) {
              /* noop */
            }
          } catch (e) {
            LogManager.addEvent(
              "relay",
              "warning",
              `Protocol session ${s.id}: forward to AI2 failed: ${e?.message || String(e)}`,
            );
          }
          return;
        }

        // If relay active, forward ai2 replies back to ai1
        if (
          (s.state === "sent-to-ai2" || s.state === "relay-active") &&
          provider === s.providers[1]
        ) {
          const aFirst = s.providers[0];
          if (s.lastTexts[s.providers[1]] === text) return;
          s.lastTexts[s.providers[1]] = text;
          s.state = "relay-active";
          s.forwardCount = (s.forwardCount || 0) + 1;
          LogManager.addEvent(
            "relay",
            "info",
            `Protocol session ${s.id}: forwarding AI2 -> AI1 (#${s.forwardCount})`,
            { excerpt: text.slice(0, 200) },
          );
          try {
            await this.coreEngine.sendMessage({
              provider: aFirst,
              text,
              page: "relay",
            });
          } catch (e) {
            LogManager.addEvent(
              "relay",
              "warning",
              `Protocol session ${s.id}: forward AI2->AI1 failed: ${e?.message || String(e)}`,
            );
          }
          this._updateIndicator();
          return;
        }
      }

      const other = provider === "ai1" ? "ai2" : "ai1";
      if (!AppState.getConnection(other)) {
        LogManager.addEvent(
          "relay",
          "info",
          `Relay skipped: target ${other} not connected`,
        );
        return;
      }

      this._forwardCount += 1;
      LogManager.addEvent(
        "relay",
        "info",
        `Relay forwarding (#${this._forwardCount}) from ${provider} -> ${other}`,
        { job: { from: provider, to: other }, excerpt: text.slice(0, 200) },
      );

      try {
        await this.coreEngine.sendMessage({
          provider: other,
          text,
          page: "relay",
        });
      } catch (err) {
        LogManager.addEvent(
          "relay",
          "warning",
          `Relay forwarding failed: ${err?.message || String(err)}`,
          { from: provider, to: other },
        );
      }
      this._updateIndicator();
    } catch (err) {
      LogManager.addEvent(
        "relay",
        "warning",
        `onThinkingComplete error: ${err?.message || String(err)}`,
      );
    }
  }

  _updateIndicator() {
    try {
      const el = document.getElementById("relay-indicator");
      if (!el) return;
      if (this.active) {
        el.textContent = `relay aktif (${this._forwardCount})`;
        el.classList.add("relay-active");
      } else {
        el.textContent = "relay pasif";
        el.classList.remove("relay-active");
      }
    } catch (e) {
      /* noop */
    }
  }
}

export const RelayManager = new RelayManagerClass();
