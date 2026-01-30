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
import { getErrorMessage } from "../types/index.js";
import { AppState } from "./app-state.js";
import { LoadingTracker } from "./traffic/loading-tracker.js";
import { ThinkingTracker } from "./traffic/thinking-tracker.js";
import { SendTracker } from "./traffic/send-tracker.js";
import { buildProbeScript } from "./traffic/probe-script-builder.js";
import { attachWebviewEvents, detachWebviewEvents, hasHandlers, normalizeHref } from "./traffic/webview-events.js";
import { isSlotUrlExcluded, isDefaultPage } from "./webview/methods/shared/url-utils.js";
import { INTERVALS, DELAYS } from "../constants/index.js";

// ============================================
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
  loading: "idle",
  thinking: "idle",
  send: "idle",
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
// ============================================
// ============================================
// ============================================
interface TrafficIndicator {
  loading?: boolean | HTMLElement | null;
  thinking?: boolean | HTMLElement | null;
  canSend?: boolean | HTMLElement | null;
  send?: HTMLElement | null;
}

interface TrafficState {
  status: {
    loading: string;
    thinking: string;
    send: string;
  };
  lastHref: string;
  lastSendSeen: number;
  loadingActive: boolean;
  loadingStartTime: number;
  loadingScrollAppeared: boolean;
  lastScrollChange: number;
  lastAutoScrollAt: number;
  loadingJustEnded: boolean;
  loadingEndedAt: number;
  stopButtonLastSeen: number;
  stopButtonDisappearedAt: number;
  thinkingJustEnded: boolean;
  thinkingEndedAt: number;
  polling: boolean;
  readyState: string;
  sendState: string;
  thinkingState: string;
}

interface ProbeRunner {
  timer?: ReturnType<typeof setTimeout>;
  running?: boolean;
  startedAt?: number;
  nextProbeAt?: number;
  probing?: boolean;
  backoffMs?: number;
}

type WebviewElement = HTMLElement & {
  isDestroyed?: () => boolean;
  getWebContentsId?: () => number;
  isLoading?: () => boolean;
  getWebContents?: () => { isLoading?: () => boolean };
  executeJavaScript?: (script: string) => Promise<unknown>;
};

class TrafficManagerClass {
  indicators: Record<string, TrafficIndicator>;
  state: Record<string, TrafficState>;
  listeners: ((snapshot: { provider: string; state: unknown }) => void)[];
  webviews: Record<string, WebviewElement>;
  pollTimer: ReturnType<typeof setInterval> | null;
  _runners: Record<string, ProbeRunner>;
  _skipNextLoading: Record<string, boolean>;
  loadingTracker: LoadingTracker;
  thinkingTracker: ThinkingTracker;
  sendTracker: SendTracker;

  constructor() {
    this.indicators = { ai0: {}, ai1: {}, ai2: {} };
    this.state = { ai0: defaultState(), ai1: defaultState(), ai2: defaultState() };
    this.listeners = [];
    this.webviews = {};
    this.pollTimer = null;
    this._runners = {};
    this._skipNextLoading = { ai0: false, ai1: false, ai2: false };

    this.loadingTracker = new LoadingTracker(TIMING_CONFIG);
    this.thinkingTracker = new ThinkingTracker(TIMING_CONFIG);
    this.sendTracker = new SendTracker(TIMING_CONFIG);
  }

  /**
   * Bir sonraki URL değişiminde loading tetiklemeyi atla
   * Mesaj gönderiminde default page'den çıkışta kullanılır
   * @param {string} provider - ai0, ai1, ai2
   */
  skipNextLoadingFor(provider: string) {
    if (provider && Object.prototype.hasOwnProperty.call(this._skipNextLoading, provider)) {
      this._skipNextLoading[provider] = true;
      // 5 saniye sonra otomatik reset (güvenlik için)
      setTimeout(() => {
        this._skipNextLoading[provider] = false;
      }, 5000);
    }
  }

  // ============================================
  // ============================================

  /** @deprecated Use isSlotUrlExcluded from url-utils.ts directly */
  isUrlExcluded(providerSlot: string, url: string) {
    return isSlotUrlExcluded(providerSlot, url);
  }

  // ============================================
  // ============================================

  onUpdate(listener: (snapshot: { provider: string; state: unknown }) => void) {
    if (typeof listener !== "function") return () => {};
    this.listeners.push(listener);
    return () => {
      this.listeners = this.listeners.filter((l) => l !== listener);
    };
  }

  notifyListeners(provider: string) {
    const snapshot = { provider, state: this.state[provider] };
    this.listeners.forEach((listener) => {
      try {
        listener(snapshot);
      } catch (_err) {
      }
    });
  }

  // ============================================
  // ============================================

  init() {
    this.cacheIndicators();
    this.refreshIndicators("ai0");
    this.refreshIndicators("ai1");
    this.refreshIndicators("ai2");
  }

  cacheIndicators() {
    // Asistan (AI0) göstergeleri
    if (this.indicators.ai0) {
      this.indicators.ai0.loading = document.getElementById("ai0-loading-indicator");
      this.indicators.ai0.send = document.getElementById("ai0-send-indicator");
      this.indicators.ai0.thinking = document.getElementById("ai0-thinking-indicator");
    }
    // AI1 göstergeleri
    if (this.indicators.ai1) {
      this.indicators.ai1.loading = document.getElementById("ai1-loading-indicator");
      this.indicators.ai1.send = document.getElementById("ai1-send-indicator");
      this.indicators.ai1.thinking = document.getElementById("ai1-thinking-indicator");
    }
    // AI2 göstergeleri
    if (this.indicators.ai2) {
      this.indicators.ai2.loading = document.getElementById("ai2-loading-indicator");
      this.indicators.ai2.send = document.getElementById("ai2-send-indicator");
      this.indicators.ai2.thinking = document.getElementById("ai2-thinking-indicator");
    }
  }

  // ============================================
  // Webview Attachment
  // ============================================

  attachWebview(provider: string, webviewEl: WebviewElement) {
    if (!provider || !webviewEl) return;
    this.webviews[provider] = webviewEl;

    if (hasHandlers(provider)) return;

    attachWebviewEvents(provider, webviewEl, {
      onNavigation: (prov: string, href: string) => this._handleNavigation(prov, href),
      onDomReady: () => {},
      onFailLoad: (prov: string) => this.setAllUnreachable(prov),
      buildProbeScript,
    });
  }

  detachWebview(provider: string) {
    if (!provider) return;
    detachWebviewEvents(provider);
    this.setAllUnreachable(provider);
  }

  _handleNavigation(provider: string, href: string) {
    if (this.isUrlExcluded(provider, href)) return;

    const viewState = this.state[provider] || defaultState();

    if (href && href !== viewState.lastHref) {
      const previousHref = viewState.lastHref;
      viewState.lastHref = href;
      
      // Default page'den conversation page'e geçiş kontrolü
      const providerId = AppState.getProviderIdForSlot(provider) || "";
      const wasOnDefaultPage = isDefaultPage(previousHref, providerId);
      const isOnDefaultPage = isDefaultPage(href, providerId);
      
      // Skip flag aktifse (mesaj gönderiminden kaynaklı URL değişimi)
      if (this._skipNextLoading[provider] && wasOnDefaultPage && !isOnDefaultPage) {
        this._skipNextLoading[provider] = false;
        this.state[provider] = viewState;
        // Loading başlatma, sadece thinking tracker takip edecek
        return;
      }
      
      this.loadingTracker.startLoading(viewState, Date.now());
      this.state[provider] = viewState;
      this.setIndicator(provider, "loading", "busy");
    }
  }

  // ============================================
  // ============================================

  async start(provider: string) {
    if (!provider) return;
    if (this._runners[provider]) return;
    this._runners[provider] = {
      startedAt: Date.now(),
      backoffMs: TIMING_CONFIG.pollIntervalMs,
      nextProbeAt: Date.now(),
      probing: false, // Race condition fix: probe lock flag
    };
    this.startPolling();
    this.setIndicator(provider, "loading", this.state[provider]?.status?.loading || "busy");
  }

  async stop(provider: string, { force: _force = false } = {}) {
    if (!provider) return;
    if (!this._runners[provider]) return;
    try {
      delete this._runners[provider];
      this.setAllUnreachable(provider);
    } catch (err) {
      LogManager.addEvent("traffic", "error", `TrafficManager.stop error for ${provider}: ${getErrorMessage(err)}`);
    }
    if (Object.keys(this._runners).length === 0 && this.pollTimer) {
      try { clearTimeout(this.pollTimer); } catch (_) { void 0; }
      this.pollTimer = null;
    }
  }

  // ============================================
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
          // Race condition fix: Skip if already probing this provider
          if (runner.probing) continue;
          
          try {
            runner.probing = true; // Lock
            const ok = await this.probe(provider);
            if (ok) {
              runner.backoffMs = TIMING_CONFIG.pollIntervalMs;
            } else {
              runner.backoffMs = Math.min((runner.backoffMs || TIMING_CONFIG.pollIntervalMs) * 2, INTERVALS.BACKOFF_MAX);
            }
            runner.nextProbeAt = Date.now() + (runner.backoffMs || TIMING_CONFIG.pollIntervalMs);
          } catch (_) {
            runner.backoffMs = Math.min((runner.backoffMs || TIMING_CONFIG.pollIntervalMs) * 2, INTERVALS.BACKOFF_MAX);
            runner.nextProbeAt = Date.now() + (runner.backoffMs || TIMING_CONFIG.pollIntervalMs);
          } finally {
            runner.probing = false; // Unlock
          }
        }
      } catch (_err) {
      } finally {
        this.pollTimer = setTimeout(loop, Math.max(250, Math.floor(TIMING_CONFIG.pollIntervalMs / 4)));
      }
    };
    loop();
  }

  async probe(provider: string) {
    if (!provider) return;
    const webview = this.webviews[provider];
    if (!webview || webview.isDestroyed?.()) return;
    
    // FIX: Webview'ın DOM'a attach olup olmadığını kontrol et
    // getWebContentsId yoksa veya hata veriyorsa webview henüz hazır değil
    try {
      if (typeof webview.getWebContentsId !== "function") {
        return false;
      }
      // getWebContentsId çağrısı webview hazır değilse hata fırlatır
      webview.getWebContentsId();
    } catch (_) {
      // Webview henüz DOM'a attach olmamış, sessizce geç
      return false;
    }
    
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
      
      // isLoading true ise executeJavaScript çağırma
      if (isLoading) {
        return false;
      }
      
      if (!webview.executeJavaScript) {
        return false;
      }

      const result = await webview.executeJavaScript(script);
      const data = result as { error?: string; href?: string; sendState?: string; thinkingState?: string; thinkingText?: string; messageCount?: number } | null;
      
      if (data?.error) {
        LogManager.addEvent("probe", "error", `Probe error for ${provider}`, { error: data.error });
        return false;
      }

      const ok = await this.handleProbe(provider, data, isLoading);
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
  // Handle Probe Results
  // ============================================

  async handleProbe(provider: string, data: { error?: string; href?: string; sendState?: string; thinkingState?: string; thinkingText?: string; messageCount?: number } | null, isStillLoading = false) {
    if (!this.state[provider]) {
      this.state[provider] = defaultState();
    }
    const viewState = this.state[provider];

    if (!data || data.error) {
      LogManager.addEvent("traffic", "warn", `probe data error for ${provider}: ${String(data?.error || "no-data")}`);
      this.setAllUnreachable(provider);
      return false;
    }


    if (isStillLoading) {
      return;
    }

    const currentHref = normalizeHref(data.href);

    if (this.isUrlExcluded(provider, currentHref)) {
      this.setIndicator(provider, "loading", "idle");
      this.setIndicator(provider, "thinking", "idle");
      this.setIndicator(provider, "send", "idle");
      return false;
    }

    const now = Date.now();
    const webview = this.webviews[provider];

    if (!webview) return;
    
    const loadingResult = await this.loadingTracker.handleProbe(provider, viewState, data, now, webview, currentHref);
    Object.assign(viewState, loadingResult.newState);
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
        }, DELAYS.STATE_CLEAR);
      }
    }

    const thinkingResult = this.thinkingTracker.handleProbe(provider, viewState, data, now);
    Object.assign(viewState, thinkingResult.newState);
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
        }, DELAYS.STATE_CLEAR);
      }
    }

    const sendResult = this.sendTracker.handleProbe(provider, viewState, data, now);
    Object.assign(viewState, sendResult.newState);
    this.setIndicator(provider, "send", sendResult.indicator);

    this.state[provider] = viewState;
    return true;
  }

  logEvent(event: { message: string }) {
    try {
      LogManager.addEvent("traffic", "info", event.message);
    } catch (_) { /* noop */ }
  }

  // ============================================
  // ============================================

  refreshIndicators(provider: string) {
    if (!provider) return;
    const st = this.state[provider] || defaultState();
    this.setIndicator(provider, "loading", st.status.loading);
    this.setIndicator(provider, "thinking", st.status.thinking);
    this.setIndicator(provider, "send", st.status.send);
  }

  setIndicator(provider: string, kind: string, status: string) {
    if (!provider) return;
    if (!this.state[provider]) {
      this.state[provider] = defaultState();
    }
    const viewState = this.state[provider];
    viewState.status = { ...viewState.status, [kind]: status };
    this.state[provider] = viewState;
    this.updateDerivedStates(provider);

    const dot = this.indicators[provider]?.[kind as keyof TrafficIndicator];
    if (dot && typeof dot !== 'boolean' && dot instanceof HTMLElement) {
      const color = STATUS_COLORS[status as keyof typeof STATUS_COLORS] || STATUS_COLORS.busy;
      dot.style.display = "inline-block";
      dot.style.backgroundColor = color;
      
      // Loading ve thinking için sadece busy (kırmızı) durumunda pulse animasyonu
      if (kind === "loading" || kind === "thinking") {
        if (status === "busy") {
          dot.classList.add("pulse");
        } else {
          dot.classList.remove("pulse");
        }
      }
    }
    
    // Thinking durumunda cluster'a glow efekti ekle/kaldır
    if (kind === "thinking") {
      this._updateClusterThinkingGlow(provider, status);
    }
    
    this.notifyListeners(provider);

  }

  /**
   * Cluster'a thinking glow efekti ekle/kaldır
   * @param {string} provider - ai0, ai1, ai2
   * @param {string} status - busy veya idle
   */
  _updateClusterThinkingGlow(provider: string, status: string) {
    const cluster = document.getElementById(`cluster-${provider}`);
    if (!cluster) return;
    
    if (status === "busy") {
      cluster.classList.add("thinking-active");
    } else {
      cluster.classList.remove("thinking-active");
    }
  }

  setAllUnreachable(provider: string) {
    this.setIndicator(provider, "loading", "idle");
    this.setIndicator(provider, "thinking", "idle");
    this.setIndicator(provider, "send", "busy");
    const st = this.state[provider] || defaultState();
    st.loadingActive = false;
    this.state[provider] = st;
  }

  updateDerivedStates(provider: string) {
    const st = this.state[provider] || defaultState();
    st.readyState = st.status.loading === "idle" ? "ready" : "loading";
    st.sendState = st.status.send === "idle" ? "enabled" : st.status.send === "busy" ? "disabled" : "not-found";
    st.thinkingState = st.status.thinking === "busy" ? "thinking" : "idle";
    this.state[provider] = st;
  }

  // ============================================
  // ============================================

  waitForSendEnabled(provider: string, timeout = 4000, interval = 100) {
    return this.sendTracker.waitForSendEnabled(
      () => this.state[provider] || defaultState(),
      timeout,
      interval
    );
  }

  waitForThinkingCoolDown(provider: string, coolDownMs = 5000, timeoutMs = 45000) {
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
          setTimeout(tick, INTERVALS.THINKING_TICK);
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
  // ============================================

  signal(channel: string, status: string, message = "") {
    if (status === "error") {
    }
    this.listeners.forEach((listener) => {
      try {
        listener({ provider: channel || '', state: { status, message } });
      } catch (_err) {
      }
    });
  }
}

export const TrafficManager = new TrafficManagerClass();
