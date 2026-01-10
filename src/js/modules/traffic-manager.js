/**
 * TrafficManager - Webview traffic gösterge takibi (Orchestrator)
 * 
 * Alt modüller:
 * - traffic/loading-tracker.js: Sayfa yükleme durumu
 * - traffic/thinking-tracker.js: AI thinking durumu
 * - traffic/send-tracker.js: Send button durumu
 * - traffic/probe-script-builder.js: Probe script oluşturucu
 * - traffic/webview-events.js: Webview event yönetimi
 */

import { LogManager } from "./log-manager.js";
import { SettingsManager } from "./settings-manager.js";
import { ProviderRegistry } from "./webview/provider-registry.js";
import { LoadingTracker } from "./traffic/loading-tracker.js";
import { ThinkingTracker } from "./traffic/thinking-tracker.js";
import { SendTracker } from "./traffic/send-tracker.js";
import { buildProbeScript } from "./traffic/probe-script-builder.js";
import { attachWebviewEvents, detachWebviewEvents, hasHandlers, normalizeHref } from "./traffic/webview-events.js";
import { isUrlExcluded as checkUrlExcluded } from "./webview/methods/shared/url-utils.js";

// ============================================
// CONFIGURATION
// ============================================
const TIMING_CONFIG = {
  pollIntervalMs: 2000,
  loading: {
    maxWaitForScrollMs: 15000,
    autoScrollIntervalMs: 1000,
    noScrollChangeTimeoutMs: 2000,
  },
  thinking: {
    minHoldMs: 4000,
    stopButtonDetectionTimeoutMs: 2000,
  },
};

const STATUS_COLORS = {
  busy: "#e74c3c",
  idle: "#2ecc71",
};

const defaultStatus = () => ({
  loading: "busy",
  thinking: "idle",
  send: "busy",
});

const defaultState = () => ({
  status: defaultStatus(),
  lastHref: "",
  lastSendSeen: 0,
  loadingActive: false,
  loadingStartTime: 0,
  loadingScrollAppeared: false,
  lastScrollChange: 0,
  lastAutoScrollAt: 0,
  loadingJustEnded: false,
  loadingEndedAt: 0,
  stopButtonLastSeen: 0,
  stopButtonDisappearedAt: 0,
  thinkingJustEnded: false,
  thinkingEndedAt: 0,
  polling: false,
  readyState: "loading",
  sendState: "not-found",
  thinkingState: "idle",
});

// ============================================
// TRAFFIC MANAGER CLASS
// ============================================
class TrafficManagerClass {
  constructor() {
    this.indicators = { ai1: {}, ai2: {} };
    this.state = { ai1: defaultState(), ai2: defaultState() };
    this.listeners = [];
    this.webviews = {};
    this.pollTimer = null;
    this._runners = {};

    // Trackers
    this.loadingTracker = new LoadingTracker(TIMING_CONFIG);
    this.thinkingTracker = new ThinkingTracker(TIMING_CONFIG);
    this.sendTracker = new SendTracker(TIMING_CONFIG);
  }

  // ============================================
  // URL EXCLUSION
  // ============================================

  isUrlExcluded(providerSlot, url) {
    const settings = SettingsManager.getSnapshot();
    const accountId = settings.slots?.[providerSlot]?.accountId;
    const account = accountId ? settings.accounts?.find(acc => acc.id === accountId) : null;
    const providerId = account?.provider || "";
    if (!providerId || !url) return false;

    const cfg = ProviderRegistry.get(providerId);
    if (!cfg?.excludedUrls?.length) return false;

    return checkUrlExcluded(url, cfg.excludedUrls);
  }

  // ============================================
  // LISTENER API
  // ============================================

  onUpdate(listener) {
    if (typeof listener !== "function") return () => {};
    this.listeners.push(listener);
    return () => {
      this.listeners = this.listeners.filter((l) => l !== listener);
    };
  }

  notifyListeners(provider) {
    const snapshot = { provider, state: this.state[provider] };
    this.listeners.forEach((listener) => {
      try {
        listener(snapshot);
      } catch (_err) {
        // Silent
      }
    });
  }

  // ============================================
  // INITIALIZATION
  // ============================================

  init() {
    this.cacheIndicators();
    this.refreshIndicators("ai1");
    this.refreshIndicators("ai2");
  }

  cacheIndicators() {
    this.indicators.ai1.loading = document.getElementById("ai1-loading-indicator");
    this.indicators.ai1.send = document.getElementById("ai1-send-indicator");
    this.indicators.ai1.thinking = document.getElementById("ai1-thinking-indicator");
    this.indicators.ai2.loading = document.getElementById("ai2-loading-indicator");
    this.indicators.ai2.send = document.getElementById("ai2-send-indicator");
    this.indicators.ai2.thinking = document.getElementById("ai2-thinking-indicator");
  }

  // ============================================
  // WEBVIEW MANAGEMENT
  // ============================================

  attachWebview(provider, webviewEl) {
    if (!provider || !webviewEl) return;
    this.webviews[provider] = webviewEl;
    LogManager.addEvent("traffic", "info", `attachWebview called for ${provider}`);

    if (hasHandlers(provider)) return;

    attachWebviewEvents(provider, webviewEl, {
      onNavigation: (prov, href) => this._handleNavigation(prov, href),
      onDomReady: () => {},
      onFailLoad: (prov) => this.setAllUnreachable(prov),
      buildProbeScript,
    });
  }

  detachWebview(provider) {
    if (!provider) return;
    detachWebviewEvents(provider);
    this.setAllUnreachable(provider);
    LogManager.addEvent("traffic", "info", `detachWebview called for ${provider}`);
  }

  _handleNavigation(provider, href) {
    if (this.isUrlExcluded(provider, href)) return;

    const viewState = this.state[provider] || defaultState();

    if (href && href !== viewState.lastHref) {
      viewState.lastHref = href;
      this.loadingTracker.startLoading(viewState, Date.now());
      this.state[provider] = viewState;
      this.setIndicator(provider, "loading", "busy");
    }
  }

  // ============================================
  // START / STOP
  // ============================================

  async start(provider) {
    if (!provider) return;
    if (this._runners[provider]) return;
    this._runners[provider] = {
      startedAt: Date.now(),
      backoffMs: TIMING_CONFIG.pollIntervalMs,
      nextProbeAt: Date.now(),
    };
    LogManager.addEvent("traffic", "info", `TrafficManager.start called for ${provider}`);
    this.startPolling();
    this.setIndicator(provider, "loading", this.state[provider]?.status?.loading || "busy");
  }

  async stop(provider, { force: _force = false } = {}) {
    if (!provider) return;
    if (!this._runners[provider]) return;
    try {
      delete this._runners[provider];
      this.setAllUnreachable(provider);
      LogManager.addEvent("traffic", "info", `TrafficManager.stop called for ${provider}`);
    } catch (err) {
      LogManager.addEvent("traffic", "error", `TrafficManager.stop error for ${provider}: ${err?.message || err}`);
    }
    if (Object.keys(this._runners).length === 0 && this.pollTimer) {
      try { clearTimeout(this.pollTimer); } catch (_) { void 0; }
      this.pollTimer = null;
    }
  }

  // ============================================
  // POLLING
  // ============================================

  startPolling() {
    if (this.pollTimer) return;
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
              runner.backoffMs = Math.min((runner.backoffMs || TIMING_CONFIG.pollIntervalMs) * 2, 16000);
            }
            runner.nextProbeAt = Date.now() + (runner.backoffMs || TIMING_CONFIG.pollIntervalMs);
          } catch (_) {
            runner.backoffMs = Math.min((runner.backoffMs || TIMING_CONFIG.pollIntervalMs) * 2, 16000);
            runner.nextProbeAt = Date.now() + (runner.backoffMs || TIMING_CONFIG.pollIntervalMs);
          }
        }
      } catch (_err) {
        /* noop */
      } finally {
        this.pollTimer = setTimeout(loop, Math.max(250, Math.floor(TIMING_CONFIG.pollIntervalMs / 4)));
      }
    };
    loop();
  }

  async probe(provider) {
    if (!provider) return;
    const webview = this.webviews[provider];
    if (!webview || webview.isDestroyed?.()) return;
    const viewState = this.state[provider] || defaultState();
    if (viewState.polling) return;
    viewState.polling = true;
    this.state[provider] = viewState;
    try {
      const script = buildProbeScript(provider);
      const isLoading = typeof webview.isLoading === "function"
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

  // ============================================
  // PROBE HANDLING
  // ============================================

  async handleProbe(provider, data, isStillLoading = false) {
    if (!this.state[provider]) {
      this.state[provider] = defaultState();
    }
    let viewState = this.state[provider];

    if (!data || data.error) {
      LogManager.addEvent("traffic", "warn", `probe data error for ${provider}: ${String(data?.error || "no-data")}`);
      this.setAllUnreachable(provider);
      return false;
    }

    if (isStillLoading) {
      LogManager.addEvent("traffic", "debug", `probe skipped for ${provider} because webview is still loading`);
      return;
    }

    const currentHref = normalizeHref(data.href);

    if (this.isUrlExcluded(provider, currentHref)) {
      LogManager.addEvent("traffic", "debug", `URL excluded for ${provider}: ${currentHref}, probe skipped`);
      this.setIndicator(provider, "loading", "idle");
      this.setIndicator(provider, "thinking", "idle");
      this.setIndicator(provider, "send", "idle");
      return false;
    }

    const now = Date.now();
    const webview = this.webviews[provider];

    // Loading tracking
    const loadingResult = await this.loadingTracker.handleProbe(provider, viewState, data, now, webview, currentHref);
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
          } catch (_) { void 0; }
        }, 1500);
      }
    }

    // Thinking tracking
    const thinkingResult = this.thinkingTracker.handleProbe(provider, viewState, data, now);
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
          } catch (_) { void 0; }
        }, 1500);
      }
    }

    // Send button tracking
    const sendResult = this.sendTracker.handleProbe(provider, viewState, data, now);
    viewState = sendResult.newState;
    this.setIndicator(provider, "send", sendResult.indicator);

    this.state[provider] = viewState;
    return true;
  }

  logEvent(event) {
    try {
      LogManager.addEvent("traffic", "info", event.message);
    } catch (_) { /* noop */ }
  }

  // ============================================
  // INDICATOR MANAGEMENT
  // ============================================

  refreshIndicators(provider) {
    if (!provider) return;
    const st = this.state[provider] || defaultState();
    this.setIndicator(provider, "loading", st.status.loading);
    this.setIndicator(provider, "thinking", st.status.thinking);
    this.setIndicator(provider, "send", st.status.send);
  }

  setIndicator(provider, kind, status) {
    if (!provider) return;
    if (!this.state[provider]) {
      this.state[provider] = defaultState();
    }
    const viewState = this.state[provider];
    const prevStatus = viewState?.status?.[kind];
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

    if (prevStatus !== status) {
      LogManager.addEvent("traffic", "debug", `setIndicator ${provider}:${kind} -> ${status}`);
    }
  }

  setAllUnreachable(provider) {
    this.setIndicator(provider, "loading", "idle");
    this.setIndicator(provider, "thinking", "idle");
    this.setIndicator(provider, "send", "busy");
    const st = this.state[provider] || defaultState();
    st.loadingActive = false;
    this.state[provider] = st;
  }

  updateDerivedStates(provider) {
    const st = this.state[provider] || defaultState();
    st.readyState = st.status.loading === "idle" ? "ready" : "loading";
    st.sendState = st.status.send === "idle" ? "enabled" : st.status.send === "busy" ? "disabled" : "not-found";
    st.thinkingState = st.status.thinking === "busy" ? "thinking" : "idle";
    this.state[provider] = st;
  }

  // ============================================
  // WAIT METHODS
  // ============================================

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

  // ============================================
  // SIGNAL
  // ============================================

  signal(channel, status, message = "") {
    if (status === "error") {
      LogManager.addEvent("traffic", "error", `[${channel}] ${message || status}`);
    }
    this.listeners.forEach((listener) => {
      try {
        listener({ channel, status, message });
      } catch (_err) {
        // Silent
      }
    });
  }
}

export const TrafficManager = new TrafficManagerClass();
