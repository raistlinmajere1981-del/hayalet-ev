import { LogCategory } from "@shared/logging-core";
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

import { Logger } from "./logger/index.js";
import { getErrorMessage } from "@shared/index.js";
import { AppState } from "./app-state.js";
import { LoadingTracker } from "./traffic/loading-tracker.js";
import { ThinkingTracker } from "./traffic/thinking-tracker.js";
import { SendTracker } from "./traffic/send-tracker.js";
import { buildProbeScript } from "./traffic/probe-script-builder.js";
import {
  attachWebviewEvents,
  detachWebviewEvents,
  hasHandlers,
  normalizeHref,
} from "./traffic/webview-events.js";
import { isSlotUrlExcluded, isDefaultPage } from "./webview/methods/shared/url-utils.js";
import { INTERVALS, DELAYS } from "../constants/index.js";

type RawWebviewElement = HTMLElement & {
  getURL?: () => string;
  executeJavaScript?: (script: string) => Promise<unknown>;
  insertCSS?: (css: string) => Promise<void>;
  addEventListener?: (event: string, handler: (...args: unknown[]) => void) => void;
  removeEventListener?: (event: string, handler: (...args: unknown[]) => void) => void;
  isDestroyed?: () => boolean;
  getWebContentsId?: () => number;
  isLoading?: () => boolean;
  getWebContents?: () => { isLoading?: () => boolean };
};

type TrafficWebview = RawWebviewElement & {
  executeJavaScript: (script: string, userGesture?: boolean) => Promise<unknown>;
  addEventListener: (event: string, handler: (...args: unknown[]) => void) => void;
  removeEventListener: (event: string, handler: (...args: unknown[]) => void) => void;
};

const TIMING_CONFIG = {
  pollIntervalMs: 4000, // Relay sırasında LatencyInfo birikimine karşı optimize edildi (4s)
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

const defaultStatus = (): { loading: string; thinking: string; send: string } => ({
  loading: "idle",
  thinking: "idle",
  send: "idle",
});

const defaultState = (): TrafficState => ({
  status: defaultStatus(),
  lastHref: "",
  lastSendSeen: 0,
  loadingActive: false,
  loadingFromDefaultTransition: false,
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
  loadingFromDefaultTransition: boolean;
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

class TrafficManagerClass {
  indicators: Record<string, TrafficIndicator>;
  state: Record<string, TrafficState>;
  listeners: ((snapshot: { provider: string; state: unknown }) => void)[];
  webviews: Record<string, TrafficWebview>;
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
  skipNextLoadingFor(provider: string): void {
    if (provider !== "" && Object.prototype.hasOwnProperty.call(this._skipNextLoading, provider)) {
      this._skipNextLoading[provider] = true;
      setTimeout(() => {
        void (this._skipNextLoading[provider] = false);
      }, 5000);
    }
  }

  /** @deprecated Use isSlotUrlExcluded from url-utils.ts directly */
  isUrlExcluded(providerSlot: string, url: string): boolean {
    return isSlotUrlExcluded(providerSlot, url);
  }

  onUpdate(listener: (snapshot: { provider: string; state: unknown }) => void): () => void {
    if (typeof listener !== "function") return () => {};
    this.listeners.push(listener);
    return (): void => {
      void (this.listeners = this.listeners.filter((l) => l !== listener));
    };
  }

  notifyListeners(provider: string): void {
    const snapshot = { provider, state: this.state[provider] };
    this.listeners.forEach((listener) => {
      try {
        listener(snapshot);
      } catch (_err) {
        // Error ignored
      }
    });
  }

  init(): void {
    this.cacheIndicators();
    this.refreshIndicators("ai0");
    this.refreshIndicators("ai1");
    this.refreshIndicators("ai2");
  }

  cacheIndicators(): void {
    // Asistan (AI0) göstergeleri
    if (this.indicators["ai0"]) {
      this.indicators["ai0"].loading = document.getElementById("ai0-loading-indicator");
      this.indicators["ai0"].send = document.getElementById("ai0-send-indicator");
      this.indicators["ai0"].thinking = document.getElementById("ai0-thinking-indicator");
    }
    // AI1 göstergeleri
    if (this.indicators["ai1"]) {
      this.indicators["ai1"].loading = document.getElementById("ai1-loading-indicator");
      this.indicators["ai1"].send = document.getElementById("ai1-send-indicator");
      this.indicators["ai1"].thinking = document.getElementById("ai1-thinking-indicator");
    }
    // AI2 göstergeleri
    if (this.indicators["ai2"]) {
      this.indicators["ai2"].loading = document.getElementById("ai2-loading-indicator");
      this.indicators["ai2"].send = document.getElementById("ai2-send-indicator");
      this.indicators["ai2"].thinking = document.getElementById("ai2-thinking-indicator");
    }
  }

  // Webview Attachment

  private toTrafficWebview(webviewEl: RawWebviewElement): TrafficWebview | null {
    if (typeof webviewEl.executeJavaScript !== "function") return null;
    if (typeof webviewEl.addEventListener !== "function") return null;
    if (typeof webviewEl.removeEventListener !== "function") return null;
    return webviewEl as TrafficWebview;
  }

  attachWebview(provider: string, webviewEl: RawWebviewElement): void {
    if (provider === "") return;
    const trafficWebview = this.toTrafficWebview(webviewEl);
    if (!trafficWebview) {
      Logger.warn(LogCategory.TRAFFIC, `Webview not attachable for ${provider}`);
      return;
    }
    this.webviews[provider] = trafficWebview;

    if (hasHandlers(provider)) return;

    attachWebviewEvents(provider, trafficWebview, {
      onNavigation: (prov: string, href: string) => {
        this._handleNavigation(prov, href);
      },
      onDomReady: () => {},
      onFailLoad: (prov: string) => {
        this.setAllUnreachable(prov);
      },
      buildProbeScript,
    });
  }

  detachWebview(provider: string): void {
    if (provider === "") return;
    detachWebviewEvents(provider);
    this.setAllUnreachable(provider);
  }

  _handleNavigation(provider: string, href: string): void {
    if (this.isUrlExcluded(provider, href) === true) return;

    const viewState = this.state[provider] ?? defaultState();

    if (href !== "" && href !== viewState.lastHref) {
      const previousHref = viewState.lastHref;
      viewState.lastHref = href;

      // Default page'den conversation page'e geçiş kontrolü
      const providerId = AppState.getProviderIdForSlot(provider) ?? "";
      const wasOnDefaultPage = isDefaultPage(previousHref, providerId);
      const isOnDefaultPage = isDefaultPage(href, providerId);

      if (this._skipNextLoading[provider] === true && wasOnDefaultPage && !isOnDefaultPage) {
        this._skipNextLoading[provider] = false;
        viewState.loadingFromDefaultTransition = false;
        this.state[provider] = viewState as Record<string, unknown> & TrafficState;
        return;
      }

      this.loadingTracker.startLoading(viewState, Date.now());
      viewState.loadingFromDefaultTransition = wasOnDefaultPage && !isOnDefaultPage;
      this.state[provider] = viewState as Record<string, unknown> & TrafficState;
      this.setIndicator(provider, "loading", "busy");
    }
  }

  start(provider: string): void {
    if (provider === "") return;
    if (this._runners[provider]) return;
    this._runners[provider] = {
      startedAt: Date.now(),
      backoffMs: TIMING_CONFIG.pollIntervalMs,
      nextProbeAt: Date.now(),
      probing: false, // Race condition fix: probe lock flag
    };
    this.startPolling();
    this.state[provider] ??= defaultState();
    const current = this.state[provider] ?? defaultState();
    this.setIndicator(provider, "loading", current.status.loading);
  }

  stop(provider: string, { force: _force = false } = {}): void {
    if (provider === "") return;
    if (!this._runners[provider]) return;
    try {
      delete this._runners[provider];
      this.setAllUnreachable(provider);
    } catch (err) {
      Logger.debug(
        LogCategory.TRAFFIC,
        `TrafficManager.stop error for ${provider}: ${getErrorMessage(err)}`,
        { provider, error: getErrorMessage(err) }
      );
    }
    if (Object.keys(this._runners).length === 0 && this.pollTimer) {
      try {
        clearTimeout(this.pollTimer);
      } catch (e) {
        Logger.debug(LogCategory.TRAFFIC, "Failed to clear poll timer", {
          error: getErrorMessage(e),
        });
      }
      this.pollTimer = null;
    }
  }

  /**
   * Cleanup method - tüm timer ve kaynakları temizle
   * Uygulama kapanırken çağrılmalı
   */
  destroy(): void {
    Object.keys(this._runners).forEach((provider) => {
      this.stop(provider);
    });
    if (this.pollTimer) {
      try {
        clearTimeout(this.pollTimer);
      } catch (e) {
        Logger.debug(LogCategory.TRAFFIC, "Failed to clear poll timer on destroy", {
          error: getErrorMessage(e),
        });
      }
      this.pollTimer = null;
    }
    this.listeners = [];
    Logger.info(LogCategory.TRAFFIC, "TrafficManager destroyed");
  }

  startPolling(): void {
    if (this.pollTimer) return;
    const loop = async (): Promise<void> => {
      try {
        const now = Date.now();
        const providers = Object.keys(this.webviews);
        const handleProvider = async (provider: string): Promise<void> => {
          const runner = this._runners[provider];
          if (!runner) return;
          if (now < (runner.nextProbeAt ?? 0)) return;
          // Race condition fix: Skip if already probing this provider
          if (runner.probing === true) return;

          try {
            runner.probing = true; // Lock
            const ok = await this.probe(provider);
            if (ok === true) {
              runner.backoffMs = TIMING_CONFIG.pollIntervalMs;
            } else {
              runner.backoffMs = Math.min(
                (runner.backoffMs ?? TIMING_CONFIG.pollIntervalMs) * 2,
                INTERVALS.BACKOFF_MAX
              );
            }
            runner.nextProbeAt = Date.now() + (runner.backoffMs ?? TIMING_CONFIG.pollIntervalMs);
          } catch (err) {
            Logger.debug(LogCategory.TRAFFIC, "Probe cycle failed", {
              provider,
              error: getErrorMessage(err),
            });
            runner.backoffMs = Math.min(
              (runner.backoffMs ?? TIMING_CONFIG.pollIntervalMs) * 2,
              INTERVALS.BACKOFF_MAX
            );
            runner.nextProbeAt = Date.now() + (runner.backoffMs ?? TIMING_CONFIG.pollIntervalMs);
          } finally {
            runner.probing = false; // Unlock
          }
        };
        await Promise.all(
          providers.map(async (provider) => {
            await handleProvider(provider);
          })
        );
      } catch (err) {
        Logger.debug(LogCategory.TRAFFIC, "Polling loop failed", {
          error: getErrorMessage(err),
        });
      } finally {
        this.pollTimer = setTimeout(
          () => {
            void loop();
          },
          Math.max(500, Math.floor(TIMING_CONFIG.pollIntervalMs / 3)) // 1000ms - daha az agresif polling
        );
      }
    };
    void loop();
  }

  async probe(provider: string): Promise<boolean> {
    if (provider === "") return false;
    const webview = this.webviews[provider];
    if (!webview || webview.isDestroyed?.() === true) return false;

    try {
      if (typeof webview.getWebContentsId !== "function") {
        return false;
      }
      webview.getWebContentsId();
    } catch (_) {
      return false;
    }

    const viewState = this.state[provider] ?? defaultState();
    if (viewState.polling) return false;
    viewState.polling = true;
    this.state[provider] = viewState as Record<string, unknown> & TrafficState;
    try {
      const script = buildProbeScript(provider);
      const webContents =
        typeof webview.getWebContents === "function" ? webview.getWebContents() : null;
      const isLoading =
        typeof webview.isLoading === "function"
          ? webview.isLoading() === true
          : webContents !== null && typeof webContents.isLoading === "function"
            ? webContents.isLoading() === true
            : false;

      if (isLoading) {
        return false;
      }

      const result = await webview.executeJavaScript(script);
      const data = result as {
        error?: string;
        href?: string;
        sendState?: string;
        thinkingState?: string;
        thinkingText?: string;
        messageCount?: number;
      } | null;

      if (data?.error !== undefined && data.error !== "") {
        Logger.error(LogCategory.TRAFFIC, `Probe error for ${provider}`, {
          provider,
          error: data.error,
        });
        return false;
      }

      const ok = await this.handleProbe(provider, data, isLoading);
      return ok === true;
    } catch (err) {
      Logger.debug(LogCategory.TRAFFIC, "Probe execution failed", {
        provider,
        error: getErrorMessage(err),
      });
      this.setAllUnreachable(provider);
      return false;
    } finally {
      viewState.polling = false;
      this.state[provider] = viewState as Record<string, unknown> & TrafficState;
    }
  }

  async handleProbe(
    provider: string,
    data: {
      error?: string;
      href?: string;
      sendState?: string;
      thinkingState?: string;
      thinkingText?: string;
      messageCount?: number;
    } | null,
    isStillLoading = false
  ): Promise<boolean> {
    this.state[provider] ??= defaultState();
    const viewState = this.state[provider];

    if (!data || (data.error !== undefined && data.error !== "")) {
      Logger.debug(
        LogCategory.TRAFFIC,
        `probe data error for ${provider}: ${String(data?.error ?? "no-data")}`,
        { provider, error: String(data?.error ?? "no-data") }
      );
      this.setAllUnreachable(provider);
      return false;
    }

    if (isStillLoading) {
      return false;
    }

    const currentHref = normalizeHref(data.href);

    if (this.isUrlExcluded(provider, currentHref) === true) {
      this.setIndicator(provider, "loading", "idle");
      this.setIndicator(provider, "thinking", "idle");
      this.setIndicator(provider, "send", "idle");
      return false;
    }

    const now = Date.now();
    const webview = this.webviews[provider];

    if (!webview) return false;

    const loadingResult = await this.loadingTracker.handleProbe(
      provider,
      viewState,
      data,
      now,
      webview,
      currentHref
    );
    Object.assign(viewState, loadingResult.newState);
    this.setIndicator(provider, "loading", loadingResult.indicator);
    if (loadingResult.indicator !== "busy") {
      viewState.loadingFromDefaultTransition = false;
    }
    if (loadingResult.event) {
      this.logEvent(loadingResult.event);
      if (loadingResult.event.type === "loading-ended") {
        setTimeout(() => {
          try {
            const st = this.state[provider] ?? defaultState();
            this.loadingTracker.clearJustEnded(st);
            this.state[provider] = st;
          } catch (err) {
            Logger.debug(LogCategory.TRAFFIC, "Failed to clear loadingJustEnded state", {
              provider,
              error: getErrorMessage(err),
            });
          }
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
            const st = this.state[provider] ?? defaultState();
            this.thinkingTracker.clearJustEnded(st);
            this.state[provider] = st;
          } catch (err) {
            Logger.debug(LogCategory.TRAFFIC, "Failed to clear thinkingJustEnded state", {
              provider,
              error: getErrorMessage(err),
            });
          }
        }, DELAYS.STATE_CLEAR);
      }
    }

    if (
      viewState.loadingFromDefaultTransition === true &&
      viewState.loadingActive === true &&
      viewState.status.loading === "busy" &&
      thinkingResult.indicator === "busy"
    ) {
      this.loadingTracker.endLoading(viewState, now);
      viewState.loadingFromDefaultTransition = false;
      this.setIndicator(provider, "loading", "idle");
      this.logEvent({ message: `loading synced to idle due to thinking for ${provider}` });
    }

    const sendResult = this.sendTracker.handleProbe(
      provider,
      viewState as Record<string, unknown> & TrafficState,
      data,
      now
    );
    Object.assign(viewState, sendResult.newState);
    this.setIndicator(provider, "send", sendResult.indicator);

    this.state[provider] = viewState as Record<string, unknown> & TrafficState;
    return true;
  }

  logEvent(event: { message: string }): void {
    try {
      Logger.debug(LogCategory.TRAFFIC, event.message);
    } catch (_) {
      /* noop */
    }
  }

  refreshIndicators(provider: string): void {
    if (provider === "") return;
    const st = this.state[provider] ?? defaultState();
    this.setIndicator(provider, "loading", st.status.loading);
    this.setIndicator(provider, "thinking", st.status.thinking);
    this.setIndicator(provider, "send", st.status.send);
  }

  setIndicator(provider: string, kind: string, status: string): void {
    if (provider === "") return;
    this.state[provider] ??= defaultState();
    const viewState = this.state[provider];
    viewState.status = { ...viewState.status, [kind]: status };
    this.state[provider] = viewState as Record<string, unknown> & TrafficState;
    this.updateDerivedStates(provider);

    const dot = this.indicators[provider]?.[kind as keyof TrafficIndicator];
    if (
      dot !== null &&
      dot !== undefined &&
      typeof dot !== "boolean" &&
      dot instanceof HTMLElement
    ) {
      const color = STATUS_COLORS[status as keyof typeof STATUS_COLORS];
      dot.style.display = "inline-block";
      dot.style.backgroundColor = color;

      if (kind === "loading" || kind === "thinking") {
        if (status === "busy") {
          dot.classList.add("pulse");
        } else {
          dot.classList.remove("pulse");
        }
      }
    }

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
  _updateClusterThinkingGlow(provider: string, status: string): void {
    const cluster = document.getElementById(`cluster-${provider}`);
    if (!cluster) return;

    if (status === "busy") {
      cluster.classList.add("thinking-active");
    } else {
      cluster.classList.remove("thinking-active");
    }
  }

  setAllUnreachable(provider: string): void {
    this.setIndicator(provider, "loading", "idle");
    this.setIndicator(provider, "thinking", "idle");
    this.setIndicator(provider, "send", "busy");
    const st = this.state[provider] ?? defaultState();
    st.loadingActive = false;
    st.loadingFromDefaultTransition = false;
    this.state[provider] = st;
  }

  updateDerivedStates(provider: string): void {
    const st = this.state[provider] ?? defaultState();
    st.readyState = st.status.loading === "idle" ? "ready" : "loading";
    st.sendState =
      st.status.send === "idle" ? "enabled" : st.status.send === "busy" ? "disabled" : "not-found";
    st.thinkingState = st.status.thinking === "busy" ? "thinking" : "idle";
    this.state[provider] = st;
  }

  async waitForSendEnabled(provider: string, timeout = 4000, interval = 100): Promise<boolean> {
    return await this.sendTracker.waitForSendEnabled(
      () => this.state[provider] ?? defaultState(),
      timeout,
      interval
    );
  }

  async waitForThinkingCoolDown(
    provider: string,
    coolDownMs = 5000,
    timeoutMs = 45000
  ): Promise<boolean> {
    const deadline = Date.now() + timeoutMs;
    const waitIdle = async (): Promise<boolean> =>
      await new Promise((resolve) => {
        const tick = (): void => {
          const st = this.state[provider] ?? defaultState();
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
    return await waitIdle().then(async () => {
      if (coolDownMs > 0) {
        await new Promise((r) => setTimeout(r, coolDownMs));
      }
      return true;
    });
  }

  signal(channel: string, status: string, message = ""): void {
    this.listeners.forEach((listener) => {
      try {
        listener({ provider: channel, state: { status, message } });
      } catch {
        // Listener error ignored to not break iteration
      }
    });
  }

  /**
   * Get current traffic state for a provider
   * @param {string} provider - ai0, ai1, ai2
   * @returns {TrafficState|null}
   */
  getState(provider: string): TrafficState | null {
    return this.state[provider] ?? null;
  }
}

const trafficManager = new TrafficManagerClass();
export { trafficManager as TrafficManager };
