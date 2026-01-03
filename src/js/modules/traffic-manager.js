// @ts-nocheck
// Traffic Manager - gösterge takibi (yeni kurallara göre düzenlenmiştir)
import { LogManager } from "./log-manager.js";
import { SettingsContext } from "./settings-context.js";
import { ProviderRegistry } from "./webview/provider-registry.js";
import { LoadingTracker } from "./traffic/loading-tracker.js";
import { ThinkingTracker } from "./traffic/thinking-tracker.js";
import { SendTracker } from "./traffic/send-tracker.js";

// ============================================
const TIMING_CONFIG = {
  pollIntervalMs: 1000,

  loading: {
    maxWaitForScrollMs: 15000, // 15 seconds for scroll detection
    autoScrollIntervalMs: 1000,
    noScrollChangeTimeoutMs: 2000,
  },

  thinking: {
    minHoldMs: 4000,
    stopButtonDetectionTimeoutMs: 2000,
  },
};

const STATUS_COLORS = {
  busy: "#e74c3c",   // Red - active/processing
  idle: "#2ecc71",   // Green - ready/idle
};

const defaultStatus = () => ({
  loading: "busy",  // Red initially (page loading)
  thinking: "idle", // Green (not thinking)
  send: "busy",     // Red initially (button not found yet)
});

const defaultState = () => ({
  status: defaultStatus(),
  lastHref: "",
  lastSendSeen: 0,
  // Loading state - managed by LoadingTracker
  loadingActive: false,
  loadingStartTime: 0,
  loadingScrollAppeared: false,
  lastScrollChange: 0,
  lastAutoScrollAt: 0,
  loadingJustEnded: false,
  loadingEndedAt: 0,
  // Thinking state - managed by ThinkingTracker
  stopButtonLastSeen: 0,
  stopButtonDisappearedAt: 0,
  thinkingJustEnded: false,
  thinkingEndedAt: 0,
  // Internal polling state
  polling: false,
  // Derived states for backward compatibility
  readyState: "loading",
  sendState: "not-found",
  thinkingState: "idle",
});

// ============================================
class TrafficManagerClass {
  constructor() {
    this.indicators = {
      ai1: {},
      ai2: {},
    };
    this.state = {
      ai1: defaultState(),
      ai2: defaultState(),
    };
    this.listeners = [];
    this.webviews = {};
    this.pollTimer = null;
    this._runners = {};
    this._webviewHandlers = {};
    
    // Initialize trackers
    this.loadingTracker = new LoadingTracker(TIMING_CONFIG);
    this.thinkingTracker = new ThinkingTracker(TIMING_CONFIG);
    this.sendTracker = new SendTracker(TIMING_CONFIG);
  }

  isUrlExcluded(providerSlot, url) {
    const providerId = SettingsContext.get(`${providerSlot}.providerId`);
    if (!providerId || !url) return false;

    const cfg = ProviderRegistry.get(providerId);
    if (!cfg?.excludedUrls?.length) return false;

    const normalizedUrl = url.split("?")[0].split("#")[0].replace(/\/+$/, "");

    for (const excluded of cfg.excludedUrls) {
      const normalizedExcluded = excluded
        .split("?")[0]
        .split("#")[0]
        .replace(/\/+$/, "");

      if (excluded.includes("*")) {
        const pattern = normalizedExcluded.replace(/\*/g, ".*");
        const regex = new RegExp(`^${pattern}$`);
        if (regex.test(normalizedUrl)) return true;
      } else {
        if (normalizedUrl === normalizedExcluded) return true;
      }
    }

    return false;
  }

  // ============================================

  onUpdate(listener) {
    if (typeof listener !== "function")
      return () => {
        /* noop */
      };
    this.listeners.push(listener);
    return () => {
      this.listeners = this.listeners.filter((l) => l !== listener);
    };
  }

  init() {
    this.cacheIndicators();
    this.refreshIndicators("ai1");
    this.refreshIndicators("ai2");
  }

  cacheIndicators() {
    this.indicators.ai1.loading = document.getElementById(
      "ai1-loading-indicator",
    );
    this.indicators.ai1.send = document.getElementById("ai1-send-indicator");
    this.indicators.ai1.thinking = document.getElementById(
      "ai1-thinking-indicator",
    );

    this.indicators.ai2.loading = document.getElementById(
      "ai2-loading-indicator",
    );
    this.indicators.ai2.send = document.getElementById("ai2-send-indicator");
    this.indicators.ai2.thinking = document.getElementById(
      "ai2-thinking-indicator",
    );
  }

  attachWebview(provider, webviewEl) {
    if (!provider || provider === "human" || !webviewEl) return;
    this.webviews[provider] = webviewEl;
    LogManager.addEvent(
      "traffic",
      "info",
      `attachWebview called for ${provider}`,
    );

    // If handlers already attached, do not re-attach
    if (this._webviewHandlers[provider]) {
      this.startPolling();
      return;
    }

    const ensureBridge = () => {
      const script = this.buildProbeScript(provider);
      webviewEl.executeJavaScript(script).catch(() => {
        /* noop */
      });
    };

    const handleNavEvent = (url, _eventType) => {
      let href = "";
      if (url) {
        href = this.normalizeHref(url, provider);
      } else {
        try {
          href = this.normalizeHref(webviewEl.getURL?.(), provider);
        } catch (err) {
          href = "";
        }
      }
      if (!href) return;

      if (href === "about:blank" || href.startsWith("data:")) {
        return;
      }

      const viewState = this.state[provider] || defaultState();

      if (href && href !== viewState.lastHref) {
        viewState.lastHref = href;
        // Delegated to LoadingTracker
        this.loadingTracker.startLoading(viewState, Date.now());
        this.state[provider] = viewState;
        this.setIndicator(provider, "loading", "busy");
      }
    };

    const domReadyHandler = () => {
      ensureBridge();
      try {
        handleNavEvent(webviewEl.getURL?.(), "dom-ready");
      } catch (e) {
        /* noop */
      }
    };

    const failLoadHandler = () => this.setAllUnreachable(provider);

    const listeners = {
      didStartLoading: (e) => handleNavEvent(e?.url, "did-start-loading"),
      didStartNavigation: (e) => handleNavEvent(e?.url, "did-start-navigation"),
      willNavigate: (e) => handleNavEvent(e?.url, "will-navigate"),
      didNavigate: (e) => handleNavEvent(e?.url, "did-navigate"),
      didNavigateInPage: (e) => handleNavEvent(e?.url, "did-navigate-in-page"),
      domReady: domReadyHandler,
      failLoad: failLoadHandler,
    };

    this._webviewHandlers[provider] = {
      handleNavEvent,
      domReadyHandler,
      failLoadHandler,
      listeners,
    };

    webviewEl.addEventListener("did-start-loading", listeners.didStartLoading);
    webviewEl.addEventListener(
      "did-start-navigation",
      listeners.didStartNavigation,
    );
    webviewEl.addEventListener("will-navigate", listeners.willNavigate);
    webviewEl.addEventListener("did-navigate", listeners.didNavigate);
    webviewEl.addEventListener(
      "did-navigate-in-page",
      listeners.didNavigateInPage,
    );
    webviewEl.addEventListener("dom-ready", listeners.domReady);
    webviewEl.addEventListener("did-fail-load", listeners.failLoad);
    LogManager.addEvent(
      "traffic",
      "info",
      `event listeners attached for ${provider}`,
    );
    this.startPolling();
  }

  // Remove previously attached listeners for a provider's webview.
  detachWebview(provider) {
    if (!provider) return;
    const webviewEl = this.webviews[provider];
    const handlers = this._webviewHandlers[provider];
    if (!handlers || !webviewEl) return;
    try {
      const l = handlers.listeners || {};
      try {
        webviewEl.removeEventListener("did-start-loading", l.didStartLoading);
      } catch (_) {
        void 0;
      }
      try {
        webviewEl.removeEventListener(
          "did-start-navigation",
          l.didStartNavigation,
        );
      } catch (_) {
        void 0;
      }
      try {
        webviewEl.removeEventListener("will-navigate", l.willNavigate);
      } catch (_) {
        void 0;
      }
      try {
        webviewEl.removeEventListener("did-navigate", l.didNavigate);
      } catch (_) {
        void 0;
      }
      try {
        webviewEl.removeEventListener(
          "did-navigate-in-page",
          l.didNavigateInPage,
        );
      } catch (_) {
        void 0;
      }
      try {
        webviewEl.removeEventListener("dom-ready", l.domReady);
      } catch (_) {
        void 0;
      }
      try {
        webviewEl.removeEventListener("did-fail-load", l.failLoad);
      } catch (_) {
        void 0;
      }
    } catch (err) {
      /* noop */
    }
    delete this._webviewHandlers[provider];
    this.setAllUnreachable(provider);
    LogManager.addEvent(
      "traffic",
      "info",
      `detachWebview called for ${provider}`,
    );
  }

  // Start monitoring a specific provider. Polling will run only for started providers.
  async start(provider) {
    if (!provider || provider === "human") return;
    if (this._runners[provider]) return;
    this._runners[provider] = {
      startedAt: Date.now(),
      backoffMs: TIMING_CONFIG.pollIntervalMs,
      nextProbeAt: Date.now(),
    };
    LogManager.addEvent(
      "traffic",
      "info",
      `TrafficManager.start called for ${provider}`,
    );
    this.startPolling();
    this.setIndicator(
      provider,
      "loading",
      this.state[provider]?.status?.loading || "busy",
    );
  }

  // Stop monitoring a specific provider. Optionally force immediate stop.
  async stop(provider, { force: _force = false } = {}) {
    if (!provider || provider === "human") return;
    if (!this._runners[provider]) return;
    try {
      delete this._runners[provider];
      this.setAllUnreachable(provider);
      LogManager.addEvent(
        "traffic",
        "info",
        `TrafficManager.stop called for ${provider}`,
      );
    } catch (err) {
      LogManager.addEvent(
        "traffic",
        "error",
        `TrafficManager.stop error for ${provider}: ${err?.message || err}`,
      );
    }
    // if no more runners, clear global poll timer
    if (Object.keys(this._runners).length === 0 && this.pollTimer) {
      try {
        clearTimeout(this.pollTimer);
      } catch (_) {
        void 0;
      }
      this.pollTimer = null;
    }
  }
  // Adaptive polling loop using setTimeout and per-provider backoff
  startPolling() {
    if (this.pollTimer) return;
    LogManager.addEvent("traffic", "info", "startPolling loop started");
    const loop = async () => {
      try {
        const now = Date.now();
        const providers = Object.keys(this.webviews || {});
        for (const provider of providers) {
          const runner = this._runners[provider];
          if (!runner) continue;
          if (now < (runner.nextProbeAt || 0)) continue;
          try {
            const ok = await this.probe(provider);
            if (ok) {
              runner.backoffMs = TIMING_CONFIG.pollIntervalMs;
            } else {
              runner.backoffMs = Math.min(
                (runner.backoffMs || TIMING_CONFIG.pollIntervalMs) * 2,
                16000,
              );
            }
            runner.nextProbeAt =
              Date.now() + (runner.backoffMs || TIMING_CONFIG.pollIntervalMs);
          } catch (_) {
            runner.backoffMs = Math.min(
              (runner.backoffMs || TIMING_CONFIG.pollIntervalMs) * 2,
              16000,
            );
            runner.nextProbeAt =
              Date.now() + (runner.backoffMs || TIMING_CONFIG.pollIntervalMs);
          }
        }
      } catch (err) {
        /* noop */
      } finally {
        this.pollTimer = setTimeout(
          loop,
          Math.max(250, Math.floor(TIMING_CONFIG.pollIntervalMs / 4)),
        );
      }
    };
    loop();
  }
  //
  refreshIndicators(provider) {
    if (provider === "human") return;
    const st = this.state[provider] || defaultState();
    this.setIndicator(provider, "loading", st.status.loading);
    this.setIndicator(provider, "thinking", st.status.thinking);
    this.setIndicator(provider, "send", st.status.send);
  }

  setIndicator(provider, kind, status) {
    if (!provider || provider === "human") return;
    if (!this.state[provider]) {
      this.state[provider] = defaultState();
    }
    const viewState = this.state[provider];
    const prevStatus =
      viewState && viewState.status ? viewState.status[kind] : null;
    viewState.status = { ...viewState.status, [kind]: status };
    this.state[provider] = viewState;
    this.updateDerivedStates(provider);

    const dot = this.indicators[provider]?.[kind];
    if (dot) {
      const color = STATUS_COLORS[status] || STATUS_COLORS.busy;
      dot.style.display = "inline-block";
      dot.style.backgroundColor = color;
    }
    this.notifyListeners(provider);

    // Log only when the status actually changes to avoid noisy repeated logs
    try {
      if (prevStatus !== status) {
        LogManager.addEvent(
          "traffic",
          "debug",
          `setIndicator ${provider}:${kind} -> ${status}`,
        );
      }
    } catch (_) {
      /* noop */
    }
  }

  setAllUnreachable(provider) {
    // When unreachable, set all to idle (green)
    this.setIndicator(provider, "loading", "idle");
    this.setIndicator(provider, "thinking", "idle");
    this.setIndicator(provider, "send", "busy"); // Red - no button found
    const st = this.state[provider] || defaultState();
    st.loadingActive = false;
    this.state[provider] = st;
  }

  notifyListeners(provider) {
    const snapshot = { provider, state: this.state[provider] };
    this.listeners.forEach((listener) => {
      try {
        listener(snapshot);
      } catch (err) {
        console.warn("TrafficManager listener error:", err);
      }
    });
  }


  buildProbeScript(provider) {
    const providerId = SettingsContext.get(`${provider}.providerId`);
    const cfg = providerId ? ProviderRegistry.get(providerId) : null;
    if (!cfg)
      return (
        'console.error("No config for provider: " + ' +
        JSON.stringify(providerId) +
        ")"
      );

    const sendSel = cfg.selectors.sendButton || "";
    const stopSel = cfg.selectors.stopButton || "";
    const voiceSel = cfg.selectors.voiceButton || "";
    const scrollerSels = cfg.scrollerSelectors || [];
    const contentContainers = cfg.contentContainers || [
      "main",
      "section",
      "div",
      "article",
    ];

    return `(() => {
      try {
        const sendSelector = ${JSON.stringify(sendSel)};
        const stopSelector = ${JSON.stringify(stopSel)};
        const voiceSelector = ${JSON.stringify(voiceSel)};
        const scrollerSelectors = ${JSON.stringify(scrollerSels)};
        const contentContainers = ${JSON.stringify(contentContainers)};
        const now = Date.now();
        const findSendButton = () => {
          try {
            return sendSelector ? document.querySelector(sendSelector) : null;
          } catch (_) {
            return null;
          }
        };
        const findStopButton = () => {
          try {
            return stopSelector ? document.querySelector(stopSelector) : null;
          } catch (_) {
            return null;
          }
        };
        const findVoiceButton = () => {
          try {
            return voiceSelector ? document.querySelector(voiceSelector) : null;
          } catch (_) {
            return null;
          }
        };
        const recordSend = () => {
          const slot = window.__codexState || (window.__codexState = {});
          slot.lastSend = Date.now();
        };
        const slot = window.__codexState || (window.__codexState = {});
        if (!slot.lastSend) slot.lastSend = 0;
        if (!slot.sendListenersAttached) {
          document.addEventListener('submit', () => recordSend(), true);
          document.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' && !e.shiftKey && (e.target?.tagName === 'TEXTAREA' || e.target?.getAttribute('contenteditable') === 'true')) recordSend();
          }, true);
          document.addEventListener('click', (e) => {
            const btn = e.target?.closest(sendSelector || stopSelector || 'button');
            if (btn) recordSend();
          }, true);
          [sendSelector, stopSelector].filter(Boolean).forEach((sel) => {
            document.addEventListener('mousedown', (ev) => {
              if (ev.target?.closest(sel)) recordSend();
            }, true);
            document.addEventListener('mouseup', (ev) => {
              if (ev.target?.closest(sel)) recordSend();
            }, true);
          });
          slot.sendListenersAttached = true;
        }
        const ensureScrollState = () => {
          if (!slot.scrollData) {
            slot.scrollData = { scrollTop: 0, scrollHeight: 0, clientHeight: 0, atBottom: false, lastChange: now };
          }
          return slot.scrollData;
        };
        const findChatScroller = () => {
          for (const sel of scrollerSelectors) {
            try {
              const el = document.querySelector(sel);
              if (el) return el;
            } catch (_) {}
          }
          return null;
        };
        const findFallbackScroller = () => {
          const candidates = [];
          const pushIfScrollable = (el) => {
            if (!el) return;
            const style = getComputedStyle(el);
            if (style.overflowY === 'hidden') return;
            const gap = el.scrollHeight - el.clientHeight;
            if (gap > 8 && el.clientHeight > 120) candidates.push({ el, gap });
          };
          pushIfScrollable(document.scrollingElement);
          pushIfScrollable(document.documentElement);
          pushIfScrollable(document.body);
          for (const tag of contentContainers) {
            try {
              const list = document.querySelectorAll(tag);
              for (let i = 0; i < list.length && i < 250; i += 1) pushIfScrollable(list[i]);
            } catch (_) { /* noop */ }
          }
          candidates.sort((a, b) => b.gap - a.gap);
          return (candidates[0] && candidates[0].el) || document.scrollingElement || document.documentElement || document.body;
        };
        const scrollData = ensureScrollState();
        let scroller = findChatScroller() || slot.scroller || findFallbackScroller();
        const updateScrollSnapshot = () => {
          if (!scroller || !scrollData) return;
          const top = scroller.scrollTop || 0;
          const height = scroller.scrollHeight || 0;
          const client = scroller.clientHeight || 0;
          const atBottom = height ? Math.abs(height - top - client) < 8 : false;
          if (scrollData.scrollHeight !== height || scrollData.clientHeight !== client || Math.abs(scrollData.scrollTop - top) > 1) {
            scrollData.lastChange = Date.now();
          }
          scrollData.scrollTop = top;
          scrollData.scrollHeight = height;
          scrollData.clientHeight = client;
          scrollData.atBottom = atBottom;
        };
        if (scroller && scroller !== slot.scroller) {
          if (slot.scroller && slot.scrollHandler) {
            try {
              slot.scroller.removeEventListener('scroll', slot.scrollHandler);
            } catch (_) {
              void 0;
            }
          }
          if (slot.scrollObserver) {
            try {
              slot.scrollObserver.disconnect();
            } catch (_) {
              void 0;
            }
          }
          slot.scroller = scroller;
          slot.scrollHandler = () => updateScrollSnapshot();
          scroller.addEventListener('scroll', slot.scrollHandler, { passive: true });
          slot.scrollObserver = new MutationObserver(() => { scrollData.lastMut = Date.now(); updateScrollSnapshot(); });
          slot.scrollObserver.observe(scroller, { childList: true, subtree: true });
          updateScrollSnapshot();
        } else {
          updateScrollSnapshot();
        }
        const atBottom = scrollData.atBottom;
        const sendBtn = findSendButton();
        const stopBtn = findStopButton();
        const voiceBtn = findVoiceButton();
        let sendState = 'missing';
        if (sendBtn) {
          const disabledAttr = sendBtn.disabled || sendBtn.getAttribute('aria-disabled') === 'true';
          const disabledStyle = getComputedStyle(sendBtn).pointerEvents === 'none';
          const disabledClass = /disabled|opacity-4|opacity-5|cursor-not-allowed/i.test(sendBtn.className || '');
          const disabledParent = sendBtn.closest('button[disabled], [aria-disabled="true"], [data-disabled="true"]');
          const disabled = disabledAttr || disabledStyle || disabledClass || disabledParent;
          sendState = disabled ? 'disabled' : 'enabled';
        }
        return {
          atBottom,
          sendState,
          stopVisible: !!stopBtn,
          voiceMode: !!voiceBtn,
          lastSend: slot.lastSend || 0,
          href: location.href,
          scroll: {
            scrollTop: scrollData.scrollTop,
            scrollHeight: scrollData.scrollHeight,
            clientHeight: scrollData.clientHeight,
            atBottom: scrollData.atBottom,
            lastChange: scrollData.lastChange,
          },
        };
      } catch (err) {
        return { error: String(err) };
      }
    })();`;
  }

  async handleProbe(provider, data, isStillLoading = false) {
    if (!this.state[provider]) {
      this.state[provider] = defaultState();
    }
    let viewState = this.state[provider];
    
    // Error handling
    if (!data || data.error) {
      try {
        LogManager.addEvent(
          "traffic",
          "warn",
          `probe data error for ${provider}: ${String(data?.error || "no-data")}`,
        );
      } catch (_) {
        /* noop */
      }
      this.setAllUnreachable(provider);
      return false;
    }

    // Skip if webview is still loading
    if (isStillLoading) {
      try {
        LogManager.addEvent(
          "traffic",
          "debug",
          `probe skipped for ${provider} because webview is still loading`,
        );
      } catch (_) {
        /* noop */
      }
      return;
    }

    const currentHref = this.normalizeHref(data.href, provider);

    // Skip if URL is excluded
    if (this.isUrlExcluded(provider, currentHref)) {
      try {
        LogManager.addEvent(
          "traffic",
          "debug",
          `URL excluded for ${provider}: ${currentHref}, probe skipped`,
        );
      } catch (_) {
        /* noop */
      }
      // URL excluded - set to idle states
      this.setIndicator(provider, "loading", "idle");
      this.setIndicator(provider, "thinking", "idle");
      this.setIndicator(provider, "send", "idle");
      return false;
    }

    const now = Date.now();
    const webview = this.webviews[provider];

    // ============================================
    // Delegate to trackers
    // ============================================

    // Loading tracking
    const loadingResult = await this.loadingTracker.handleProbe(
      provider,
      viewState,
      data,
      now,
      webview,
      currentHref
    );
    viewState = loadingResult.newState;
    this.setIndicator(provider, "loading", loadingResult.indicator);
    if (loadingResult.event) {
      this.logEvent(loadingResult.event);
      if (loadingResult.event.type === "loading-ended") {
        setTimeout(() => {
          try {
            const st = this.state[provider] || defaultState();
            this.loadingTracker.clearJustEnded(st);
            this.state[provider] = st;
          } catch (_) {
            void 0;
          }
        }, 1500);
      }
    }

    // Thinking tracking
    const thinkingResult = this.thinkingTracker.handleProbe(
      provider,
      viewState,
      data,
      now
    );
    viewState = thinkingResult.newState;
    this.setIndicator(provider, "thinking", thinkingResult.indicator);
    if (thinkingResult.event) {
      this.logEvent(thinkingResult.event);
      if (thinkingResult.event.type === "thinking-ended") {
        setTimeout(() => {
          try {
            const st = this.state[provider] || defaultState();
            this.thinkingTracker.clearJustEnded(st);
            this.state[provider] = st;
          } catch (_) {
            void 0;
          }
        }, 1500);
      }
    }

    // Send button tracking
    const sendResult = this.sendTracker.handleProbe(
      provider,
      viewState,
      data,
      now
    );
    viewState = sendResult.newState;
    this.setIndicator(provider, "send", sendResult.indicator);

    this.state[provider] = viewState;
    return true;
  }

  logEvent(event) {
    try {
      LogManager.addEvent("traffic", "info", event.message);
    } catch (_) {
      /* noop */
    }
  }

  normalizeHref(href, _provider) {
    if (!href) return "";
    const clean = href.split("?")[0].split("#")[0];
    return clean;
  }


  async probe(provider) {
    if (!provider || provider === "human") return;
    const webview = this.webviews[provider];
    if (!webview || webview.isDestroyed?.()) return;
    const viewState = this.state[provider] || defaultState();
    if (viewState.polling) return;
    viewState.polling = true;
    this.state[provider] = viewState;
    try {
      const script = this.buildProbeScript(provider);
      const isLoading =
        typeof webview.isLoading === "function"
          ? webview.isLoading()
          : typeof webview.getWebContents === "function"
            ? !!webview.getWebContents()?.isLoading?.()
            : false;
      const result = await webview.executeJavaScript(script, true);
      const ok = await this.handleProbe(provider, result, isLoading);
      return !!ok;
    } catch (_) {
      this.setAllUnreachable(provider);
      return false;
    } finally {
      viewState.polling = false;
      this.state[provider] = viewState;
    }
  }

  updateDerivedStates(provider) {
    const st = this.state[provider] || defaultState();
    st.readyState = st.status.loading === "idle" ? "ready" : "loading";
    st.sendState =
      st.status.send === "idle"
        ? "enabled"
        : st.status.send === "busy"
          ? "disabled"
          : "not-found";
    st.thinkingState = st.status.thinking === "busy" ? "thinking" : "idle";
    this.state[provider] = st;
  }

  waitForSendEnabled(provider, timeout = 4000, interval = 100) {
    return this.sendTracker.waitForSendEnabled(
      () => this.state[provider] || defaultState(),
      timeout,
      interval
    );
  }

  waitForThinkingCoolDown(provider, coolDownMs = 5000, timeoutMs = 45000) {
    const deadline = Date.now() + timeoutMs;
    const waitIdle = () =>
      new Promise((resolve) => {
        const tick = () => {
          const st = this.state[provider] || defaultState();
          if (st.status.thinking !== "busy") {
            resolve(true);
            return;
          }
          if (Date.now() > deadline) {
            resolve(false);
            return;
          }
          setTimeout(tick, 400);
        };
        tick();
      });
    return waitIdle().then(async () => {
      if (coolDownMs > 0) {
        await new Promise((r) => setTimeout(r, coolDownMs));
      }
      return true;
    });
  }

  signal(channel, status, message = "") {
    LogManager.addEvent(
      "traffic",
      status === "error" ? "error" : "info",
      `[${channel}] ${message || status}`,
    );
    this.listeners.forEach((listener) => {
      try {
        listener({ channel, status, message });
      } catch (err) {
        console.warn("TrafficManager listener error:", err);
      }
    });
  }
}

export const TrafficManager = new TrafficManagerClass();
