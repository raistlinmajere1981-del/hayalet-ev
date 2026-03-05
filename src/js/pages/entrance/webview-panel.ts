import type { WebviewTag } from "electron";
import { LogCategory } from "@shared/logging-core";
import { Logger } from "../../modules/logger/index.js";
import { getErrorMessage } from "@shared/index.js";
import { SettingsManager } from "../../modules/settings-manager.js";
import { AppState } from "../../modules/app-state.js";
import { SlotController } from "../../modules/slot-controller.js";
import { TrafficManager } from "../../modules/traffic-manager.js";
import { ProviderRegistry } from "../../modules/webview/provider-registry.js";
import { WebviewManager } from "../../modules/webview-manager.js";

import type { AppSettings } from "@shared/settings.js";
import type { ProviderTestSuite, ProviderTestResult } from "@shared/provider.js";

type SlotType = "ai1" | "ai2";

type TrafficManagerState = (typeof TrafficManager.state)[SlotType];

interface SlotState {
  hasAccount: boolean;
  connected: boolean;
  connecting: boolean;
  active: boolean;
}

interface WebviewElement extends HTMLElement {
  getWebContentsId?: () => number;
  getURL?: () => string;
  executeJavaScript?: (script: string) => Promise<unknown>;
  openDevTools?: () => void;
}

export class WebviewPanel {
  ai1Webview: HTMLElement | null;
  ai2Webview: HTMLElement | null;
  trafficUnsub: (() => void) | null;
  loadLogState: Record<string, { lastStart: number; lastStop: number }>;
  sessionUrlSaveTimers: Record<SlotType, ReturnType<typeof setTimeout> | null>;

  constructor() {
    this.ai1Webview = null;
    this.ai2Webview = null;
    this.trafficUnsub = null;
    this.loadLogState = {
      ai1: { lastStart: 0, lastStop: 0 },
      ai2: { lastStart: 0, lastStop: 0 },
    };
    this.sessionUrlSaveTimers = {
      ai1: null,
      ai2: null,
    };
  }

  init(): void {
    this.setupEventListeners();
  }

  setupEventListeners(): void {
    try {
      const ai1DevtoolsBtn = document.getElementById("ai1-devtools-btn");
      if (ai1DevtoolsBtn) {
        ai1DevtoolsBtn.addEventListener("click", () => {
          this.openDevTools("ai1");
        });
      }

      const ai2DevtoolsBtn = document.getElementById("ai2-devtools-btn");
      if (ai2DevtoolsBtn) {
        ai2DevtoolsBtn.addEventListener("click", () => {
          this.openDevTools("ai2");
        });
      }

      const ai1TestBtn = document.getElementById("ai1-test-btn");
      if (ai1TestBtn) {
        ai1TestBtn.addEventListener("click", () => {
          void this.handleTestClick("ai1");
        });
      }

      const ai2TestBtn = document.getElementById("ai2-test-btn");
      if (ai2TestBtn) {
        ai2TestBtn.addEventListener("click", () => {
          void this.handleTestClick("ai2");
        });
      }
    } catch (err) {
      const error = /** @type {Error} */ err;
      Logger.error(LogCategory.ENTRANCE, `Event listener setup hatası: ${getErrorMessage(error)}`);
    }
  }

  subscribeToTraffic(): void {
    this.trafficUnsub ??= TrafficManager.onUpdate(
      ({ provider, state }: { provider?: string; state?: unknown }) => {
        if (provider !== undefined && provider !== "") {
          this.updateUrlDisplay(provider, state as TrafficManagerState);
        } else {
          (["ai1", "ai2"] as SlotType[]).forEach((p) => {
            this.updateUrlDisplay(p, TrafficManager.state[p]);
          });
        }
      }
    );
  }

  applyTitles(): void {
    const ai1Title = document.getElementById("ai1-title");
    const ai2Title = document.getElementById("ai2-title");
    if (ai1Title) ai1Title.textContent = AppState.getNickname("ai1");
    if (ai2Title) ai2Title.textContent = AppState.getNickname("ai2");
  }

  updateUrlDisplay(provider: string, state: TrafficManagerState | undefined): void {
    const urlDisplay = document.getElementById(`${provider}-url-display`);
    if (!urlDisplay) return;

    const hasAccount = !!AppState.getAccountForSlot(provider);
    if (!hasAccount) {
      urlDisplay.textContent = "Slot boş - Hesap atanmadı";
      return;
    }

    const href = state?.lastHref ?? "";
    if (href !== "") {
      urlDisplay.textContent = href;
    } else {
      urlDisplay.textContent = "-";
    }
  }

  async setupWebviews(): Promise<void> {
    try {
      const ai1WebviewEl = document.getElementById("ai1-webview") as WebviewTag | null;
      const ai2WebviewEl = document.getElementById("ai2-webview") as WebviewTag | null;

      // NOTE: Webview registration is done in app.ts to avoid duplicate registration
      if (ai1WebviewEl && !this.ai1Webview) {
        this.ai1Webview = ai1WebviewEl;
      }

      if (ai2WebviewEl && !this.ai2Webview) {
        this.ai2Webview = ai2WebviewEl;
      }

      const ai1Mount = document.getElementById("ai1-webview-mount");
      const ai2Mount = document.getElementById("ai2-webview-mount");

      if (ai1WebviewEl && ai1Mount && !ai1Mount.contains(ai1WebviewEl)) {
        SlotController.ensureWebviewMounted("ai1");
      }

      if (ai2WebviewEl && ai2Mount && !ai2Mount.contains(ai2WebviewEl)) {
        SlotController.ensureWebviewMounted("ai2");
      }

      const ai1HasAccount = !!AppState.getAccountForSlot("ai1");

      const ai1EventsSetup = ai1WebviewEl?.dataset["eventsSetup"];
      if (
        ai1WebviewEl &&
        ai1HasAccount &&
        (ai1EventsSetup === undefined || ai1EventsSetup === "")
      ) {
        const ai1ProviderId = AppState.getProviderIdForSlot("ai1") ?? "";

        this.setupWebviewEvents("ai1", ai1WebviewEl, ai1ProviderId);
        ai1WebviewEl.dataset["eventsSetup"] = "true";

        const ai1PreloadAttr = ai1WebviewEl.getAttribute("preload");
        if (
          window.electronAPI?.getPreloadPath !== undefined &&
          (ai1PreloadAttr === null || ai1PreloadAttr === "")
        ) {
          try {
            const preloadPath = await window.electronAPI.getPreloadPath("ai1");
            if (preloadPath !== "") {
              ai1WebviewEl.setAttribute("preload", preloadPath);
              this.addLog("ai1", "info", `Preload script ayarlandı: ${preloadPath}`);
            }
          } catch (err) {
            const error = err as Error;
            Logger.warn(
              LogCategory.ENTRANCE,
              `AI1 preload path ayarlanamadı: ${getErrorMessage(error)}`
            );
            this.addLog("ai1", "warning", "Preload script ayarlanamadı...");
          }
        }
      }

      const ai2HasAccount = !!AppState.getAccountForSlot("ai2");

      const ai2EventsSetup = ai2WebviewEl?.dataset["eventsSetup"];
      if (
        ai2WebviewEl &&
        ai2HasAccount &&
        (ai2EventsSetup === undefined || ai2EventsSetup === "")
      ) {
        const ai2ProviderId = AppState.getProviderIdForSlot("ai2") ?? "";

        this.setupWebviewEvents("ai2", ai2WebviewEl, ai2ProviderId);
        ai2WebviewEl.dataset["eventsSetup"] = "true";

        const ai2PreloadAttr = ai2WebviewEl.getAttribute("preload");
        if (
          window.electronAPI?.getPreloadPath !== undefined &&
          (ai2PreloadAttr === null || ai2PreloadAttr === "")
        ) {
          try {
            const preloadPath = await window.electronAPI.getPreloadPath("ai2");
            if (preloadPath !== "") {
              ai2WebviewEl.setAttribute("preload", preloadPath);
              this.addLog("ai2", "info", `Preload script ayarlandı: ${preloadPath}`, {
                visibility: 2,
              });
            }
          } catch (err) {
            const error = err as Error;
            Logger.warn(
              LogCategory.ENTRANCE,
              `AI2 preload path ayarlanamadı: ${getErrorMessage(error)}`
            );
            this.addLog("ai2", "warning", "Preload script ayarlanamadı...");
          }
        }
      }
    } catch (err) {
      const error = err as Error;
      Logger.error(LogCategory.ENTRANCE, `Webview setup hatası: ${getErrorMessage(error)}`);
    }
  }

  getSlotState(settings: AppSettings | null, provider: string): SlotState {
    const slots = settings?.slots as Record<string, { accountId?: string }> | undefined;
    const slot = slots?.[provider] ?? {};
    const hasAccount = slot.accountId !== undefined && slot.accountId !== "";
    const connected = SlotController.isConnected(provider) === true;
    const connecting = SlotController.isTransitioning(provider) === true;
    return {
      hasAccount,
      connected,
      connecting,
      active: hasAccount && (connected || connecting),
    };
  }

  setDevtoolsEnabled(provider: string, enabled: boolean): void {
    const btn = document.getElementById(`${provider}-devtools-btn`) as HTMLButtonElement | null;
    if (!btn) return;
    btn.disabled = !enabled;
    btn.classList.toggle("disabled", !enabled);
  }

  setTestButtonEnabled(provider: string, enabled: boolean): void {
    const btn = document.getElementById(`${provider}-test-btn`) as HTMLButtonElement | null;
    if (!btn) return;
    btn.disabled = !enabled;
    btn.classList.toggle("disabled", !enabled);

    if (!enabled) {
      btn.title = "Slot'a hesap atanmadı";
    } else {
      btn.title = `${provider.toUpperCase()} provider test`;
    }
  }

  async handleTestClick(slot: "ai1" | "ai2"): Promise<void> {
    const btn = document.getElementById(`${slot}-test-btn`) as HTMLButtonElement | null;
    if (!btn || btn.disabled === true) return;

    try {
      btn.classList.add("testing");
      btn.disabled = true;
      btn.innerHTML = "⏳";

      Logger.info(LogCategory.ENTRANCE, `Starting provider test for ${slot}`);

      const results = await window.electronAPI?.testProvider({ slot });

      if (!results) {
        throw new Error("Test failed: No results returned");
      }

      Logger.info(
        LogCategory.ENTRANCE,
        `Test completed: ${results.passed}/${results.totalTests} passed`
      );

      this.showTestResultsModal(results);
    } catch (error) {
      Logger.error(
        LogCategory.ENTRANCE,
        `Provider test failed: ${getErrorMessage(error as Error)}`
      );

      const errorModal = await import("../../ui/modal-manager.js");
      errorModal.ModalManager.open({
        title: "❌ Test Failed",
        content: `<div class="error-message">
          <p><strong>Test execution failed:</strong></p>
          <p>${getErrorMessage(error as Error)}</p>
        </div>`,
        buttons: [
          {
            text: "Close",
            class: "btn-primary",
            onClick: (): void => {
              errorModal.ModalManager.close();
            },
          },
        ],
      });
    } finally {
      btn.classList.remove("testing");
      btn.disabled = false;
      btn.innerHTML = "🧪";
    }
  }

  showTestResultsModal(results: ProviderTestSuite): void {
    void import("../../ui/modal-manager.js").then((module) => {
      const { ModalManager: modalManager } = module;

      const content = this.generateTestResultsHTML(results);

      modalManager.open({
        title: `🧪 Test Results - ${results.providerName} (${results.slot.toUpperCase()})`,
        content,
        size: "large",
        buttons: [
          {
            text: "📋 Copy JSON",
            class: "btn-ghost",
            onClick: (): void => {
              void navigator.clipboard.writeText(JSON.stringify(results, null, 2));
              Logger.info(LogCategory.ENTRANCE, "Test results copied to clipboard");
            },
          },
          {
            text: "✖ Close",
            class: "btn-primary",
            onClick: (): void => {
              modalManager.close();
            },
          },
        ],
      });
    });
  }

  generateTestResultsHTML(results: ProviderTestSuite): string {
    const { passed, failed, skipped, warnings, totalTests, totalDuration, aborted, abortReason } =
      results;

    let html = `
      <div class="test-results-summary">
        <div class="test-stats">
          <span class="stat-item stat-pass">✅ ${passed} Passed</span>
          <span class="stat-item stat-fail">❌ ${failed} Failed</span>
          ${warnings > 0 ? `<span class="stat-item stat-warning">⚠️ ${warnings} Warnings</span>` : ""}
          ${skipped > 0 ? `<span class="stat-item stat-skip">⏭️ ${skipped} Skipped</span>` : ""}
        </div>
        <div class="test-meta">
          <span>⏱️ Duration: ${(totalDuration / 1000).toFixed(2)}s</span>
          <span>📊 Total: ${totalTests} tests</span>
        </div>
        ${aborted === true ? `<div class="test-aborted">⚠️ Aborted: ${abortReason ?? "unknown"}</div>` : ""}
      </div>
    `;

    const categories: Record<string, ProviderTestResult[]> = {};
    results.results.forEach((result) => {
      categories[result.category] ??= [];
      categories[result.category]?.push(result);
    });

    const categoryEmoji: Record<string, string> = {
      preflight: "🚀",
      dom: "📋",
      interactive: "🎮",
      scraping: "📝",
      advanced: "🔬",
    };

    const categoryNames: Record<string, string> = {
      preflight: "Pre-flight Checks",
      dom: "DOM Tests",
      interactive: "Interactive Tests",
      scraping: "Scraping Tests",
      advanced: "Advanced Tests",
    };

    for (const [category, tests] of Object.entries(categories)) {
      html += `
        <div class="test-category">
          <h3 class="category-title">${categoryEmoji[category] ?? "📦"} ${categoryNames[category] ?? category}</h3>
          <div class="test-results-list">
      `;

      tests.forEach((test) => {
        const statusEmoji: Record<string, string> = {
          pass: "✅",
          fail: "❌",
          skip: "⏭️",
          warning: "⚠️",
        };

        html += `
          <div class="test-result-item test-${test.status}">
            <div class="test-header">
              <span class="test-status">${statusEmoji[test.status] ?? "•"}</span>
              <span class="test-name">${test.name}</span>
              <span class="test-duration">${test.duration}ms</span>
            </div>
            <div class="test-message">${test.message}</div>
        `;

        if (test.details) {
          html += '<div class="test-details">';

          if (test.details.selector !== undefined && test.details.selector !== "") {
            html += `<div class="detail-item"><strong>Selector:</strong> <code>${test.details.selector}</code></div>`;
          }

          if (test.details.error !== undefined && test.details.error !== "") {
            html += `<div class="detail-item detail-error"><strong>Error:</strong> ${test.details.error}</div>`;
          }

          if (test.details.element !== undefined) {
            const el = test.details.element;
            html += `<div class="detail-item"><strong>Element:</strong> ${el.tagName} (visible: ${String(el.visible)}, enabled: ${String(el.enabled)})</div>`;
            if (el.textContent !== undefined && el.textContent !== "") {
              html += `<div class="detail-item"><strong>Text:</strong> ${el.textContent.slice(0, 50)}...</div>`;
            }
          }

          html += "</div>";
        }

        html += "</div>";
      });

      html += `
          </div>
        </div>
      `;
    }

    return html;
  }

  applyGating(settings: AppSettings | null, _changedPaths: string[] = []): void {
    settings ??= SettingsManager.getSnapshot();
    this.applyTitles();

    const providers: SlotType[] = ["ai1", "ai2"];

    for (const provider of providers) {
      const state = this.getSlotState(settings, provider);
      const webviewEl = document.getElementById(`${provider}-webview`);
      const overlayEl = document.getElementById(`${provider}-webview-overlay`);
      const urlDisplay = document.getElementById(`${provider}-url-display`);

      if (!state.hasAccount) {
        this.setDevtoolsEnabled(provider, false);
        this.setTestButtonEnabled(provider, false);
        if (urlDisplay) urlDisplay.textContent = "";
        if (webviewEl) webviewEl.style.display = "none";
        if (overlayEl) {
          overlayEl.className = "webview-overlay empty"; // State class
          const title = overlayEl.querySelector(".overlay-title");
          const subtitle = overlayEl.querySelector(".overlay-subtitle");
          if (title) title.textContent = "Hesap Atanmadı";
          if (subtitle) subtitle.textContent = "Settings'ten hesap atayın";
        }
        continue;
      }

      if (!state.connected && !state.connecting) {
        this.setDevtoolsEnabled(provider, false);
        if (urlDisplay) urlDisplay.textContent = "";
        if (overlayEl) {
          overlayEl.className = "webview-overlay disconnected"; // State class
          const title = overlayEl.querySelector(".overlay-title");
          const subtitle = overlayEl.querySelector(".overlay-subtitle");
          if (title) title.textContent = "Bağlı Değil";
          if (subtitle) subtitle.textContent = "Bağlan butonuna tıklayın";
        }
        if (webviewEl) webviewEl.style.display = "none";
        continue;
      }

      if (state.connecting) {
        this.setDevtoolsEnabled(provider, false);
        if (overlayEl) {
          overlayEl.className = "webview-overlay connecting"; // State class + spinner animation
          const title = overlayEl.querySelector(".overlay-title");
          const subtitle = overlayEl.querySelector(".overlay-subtitle");
          if (title) title.textContent = "Bağlanıyor...";
          if (subtitle) subtitle.textContent = "Lütfen bekleyin";
        }
        const mountId = `${provider}-webview-mount`;
        const mountEl = document.getElementById(mountId);
        if (webviewEl && mountEl && !mountEl.contains(webviewEl)) {
          SlotController.ensureWebviewMounted(provider);
        }
        if (webviewEl) {
          SlotController.ensureWebviewAttached(provider);
        }
        continue;
      }

      this.setDevtoolsEnabled(provider, true);
      this.setTestButtonEnabled(provider, true);

      if (overlayEl) {
        overlayEl.classList.add("hidden");
      }

      const mountId = `${provider}-webview-mount`;
      const mountEl = document.getElementById(mountId);
      if (webviewEl && mountEl && !mountEl.contains(webviewEl)) {
        SlotController.ensureWebviewMounted(provider);
      }

      if (webviewEl) {
        SlotController.ensureWebviewAttached(provider);
      }

      if (provider === "ai1" && !this.ai1Webview) {
        void this.setupWebviews();
      }
      if (provider === "ai2" && !this.ai2Webview) {
        void this.setupWebviews();
      }
    }
  }

  setupWebviewEvents(
    type: SlotType,
    webviewEl: WebviewElement,
    providerId: string | null = null
  ): void {
    const scheduleSessionUrlSave = (slot: SlotType, url: string): void => {
      const normalizedUrl = url.trim();
      if (normalizedUrl === "") return;

      const settings = SettingsManager.getSnapshot();
      if (settings.slots[slot].resumeLastSession !== true) {
        return;
      }

      const timer = this.sessionUrlSaveTimers[slot];
      if (timer !== null) {
        clearTimeout(timer);
      }

      this.sessionUrlSaveTimers[slot] = setTimeout(() => {
        this.sessionUrlSaveTimers[slot] = null;
        void this.persistLastSessionUrl(slot, normalizedUrl);
      }, 700);
    };

    webviewEl.addEventListener("did-start-loading", () => {
      try {
        if (typeof webviewEl.getWebContentsId !== "function") return;
        webviewEl.getWebContentsId();
      } catch (_) {
        return;
      }

      let currentUrl = "";
      try {
        currentUrl = webviewEl.getURL?.() ?? "";
      } catch (_) {
        // URL okunamadıysa boş kalsın
      }
      const isExcluded = WebviewManager.isUrlExcluded(type, currentUrl);

      const state = this.loadLogState[type] ?? { lastStart: 0, lastStop: 0 };
      const now = Date.now();

      if (isExcluded !== true && now - state.lastStart > 1200) {
        this.addLog(type, "info", "Sayfa yükleniyor...", { visibility: 3 });
        state.lastStart = now;
      }
      this.loadLogState[type] = state;
    });

    webviewEl.addEventListener("did-stop-loading", () => {
      void (async (): Promise<void> => {
        try {
          if (typeof webviewEl.getWebContentsId !== "function") return;
          webviewEl.getWebContentsId();
        } catch (_) {
          return;
        }

        const state = this.loadLogState[type] ?? { lastStart: 0, lastStop: 0 };
        const now = Date.now();

        if (now - state.lastStop > 1200) {
          this.addLog(type, "info", "Sayfa yükleme tamamlandı", { visibility: 3 });
          state.lastStop = now;
        }
        this.loadLogState[type] = state;

        let currentUrl: string;
        try {
          currentUrl = webviewEl.getURL?.() ?? "";
        } catch (_) {
          return;
        }

        const isExcluded = WebviewManager.isUrlExcluded(type, currentUrl);
        if (isExcluded === true) return;

        scheduleSessionUrlSave(type, currentUrl);

        const slotProviderId = AppState.getProviderIdForSlot(type);
        const currentProviderId = slotProviderId ?? providerId;
        const cfg =
          currentProviderId !== null && currentProviderId !== ""
            ? ProviderRegistry.get(currentProviderId)
            : null;
        if (cfg !== null) {
          try {
            const configScript = `
              (function() {
                try {
                  window.__hayalet_slot = ${JSON.stringify(type)};
                  window.__hayalet_provider_config = ${JSON.stringify(cfg)};
                  return true;
                } catch (e) {
                  console.error('[Hayalet-Config-Inject] Failed:', e);
                  return false;
                }
              })();
            `;
            await webviewEl.executeJavaScript?.(configScript);
          } catch (_err) {
            void _err;
          }
        }
      })();
    });

    webviewEl.addEventListener("did-navigate-in-page", () => {
      try {
        const currentUrl = webviewEl.getURL?.() ?? "";
        const isExcluded = WebviewManager.isUrlExcluded(type, currentUrl);
        if (isExcluded === true) {
          return;
        }
        scheduleSessionUrlSave(type, currentUrl);
      } catch (_) {}
    });

    webviewEl.addEventListener("console-message", (event: Event) => {
      const consoleEvent = event as Event & { message: string; level: number };
      const { message, level } = consoleEvent;

      // Level: 0=log, 1=warn, 2=error, 3=debug
      const logLevel = level === 2 ? "error" : level === 1 ? "warn" : "debug";
      if (logLevel === "error") {
        Logger.error(LogCategory.WEBVIEW, new Error(`[Webview ${type.toUpperCase()}] ${message}`), {
          source: `${type}-webview`,
          slotId: type,
        });
      } else if (logLevel === "warn") {
        Logger.warn(LogCategory.WEBVIEW, `[Webview ${type.toUpperCase()}] ${message}`, {
          source: `${type}-webview`,
          slotId: type,
        });
      } else {
        Logger.debug(LogCategory.WEBVIEW, `[Webview ${type.toUpperCase()}] ${message}`, {
          source: `${type}-webview`,
          slotId: type,
        });
      }
    });

    webviewEl.addEventListener(
      "ipc-message",
      (event: Event & { channel?: string; args?: unknown[] }) => {
        try {
          if (event.channel === undefined || event.channel === "") return;
          if (event.channel === "provider-usage") {
            const payload = event.args?.[0] as { tokens?: string | string[] } | null;
            if (payload !== null) {
              const titleEl = document.getElementById(`${type}-title`);
              if (titleEl) {
                const base = AppState.getNickname(type);
                const tokens = Array.isArray(payload.tokens)
                  ? payload.tokens.join(",")
                  : String(payload.tokens ?? "");
                titleEl.textContent = tokens !== "" ? `${base} — tokens: ${tokens}` : base;
              }
            }
          }
        } catch (err) {
          const error = err as Error;
          Logger.warn(
            LogCategory.ENTRANCE,
            `IPC message handler hatası: ${getErrorMessage(error)}`
          );
        }
      }
    );

    webviewEl.addEventListener(
      "did-fail-load",
      (event: Event & { errorCode?: number; errorDescription?: string }) => {
        if (event.errorCode !== -3 && event.errorCode !== -102) {
          this.addLog(
            type,
            "error",
            `Yükleme hatası (${event.errorCode ?? 0}): ${event.errorDescription ?? "Bilinmeyen hata"}`
          );
        } else if (event.errorCode === -3) {
          this.addLog(type, "info", "Yükleme iptal edildi (normal)");
        }
      }
    );
  }

  async persistLastSessionUrl(slot: SlotType, url: string): Promise<void> {
    const settings = SettingsManager.getSnapshot();
    const accountId = settings.slots[slot].accountId;
    if (accountId === null || accountId === "") {
      return;
    }

    const accountIndex = settings.accounts.findIndex((account) => account.id === accountId);
    if (accountIndex === -1) {
      return;
    }

    const currentValue = settings.accounts[accountIndex]?.lastSessionUrl;
    if (currentValue === url) {
      return;
    }

    const updatedAccounts = [...settings.accounts];
    const account = updatedAccounts[accountIndex];
    if (account === undefined) {
      return;
    }

    updatedAccounts[accountIndex] = {
      ...account,
      lastSessionUrl: url,
      lastUsedAt: Date.now(),
    };

    await SettingsManager.save({
      ...settings,
      accounts: updatedAccounts,
    });
  }

  openDevTools(type: SlotType): void {
    try {
      const webview = type === "ai1" ? this.ai1Webview : this.ai2Webview;
      if (!webview) {
        this.addLog(type, "error", "Webview bulunamadı");
        return;
      }

      (webview as WebviewElement).openDevTools?.();
      this.addLog(type, "info", "DevTools açıldı");
    } catch (err) {
      const error = err as Error;
      Logger.error(LogCategory.ENTRANCE, `DevTools açma hatası: ${getErrorMessage(error)}`, {
        context: { type },
      });
      this.addLog(type, "error", `DevTools açma hatası: ${getErrorMessage(error)}`);
    }
  }

  addLog(_type: SlotType, level: string, message: string, meta?: Record<string, unknown>): void {
    if (level === "error") {
      Logger.error(LogCategory.WEBVIEW, message, meta);
    } else if (level === "warning") {
      Logger.warn(LogCategory.WEBVIEW, message, meta);
    } else if (level === "success") {
      Logger.info(LogCategory.WEBVIEW, `✅ ${message}`, meta);
    } else {
      Logger.info(LogCategory.WEBVIEW, message, meta);
    }
  }

  destroy(): void {
    if (this.trafficUnsub) {
      this.trafficUnsub();
      this.trafficUnsub = null;
    }

    (Object.keys(this.sessionUrlSaveTimers) as SlotType[]).forEach((slot) => {
      const timer = this.sessionUrlSaveTimers[slot];
      if (timer !== null) {
        clearTimeout(timer);
        this.sessionUrlSaveTimers[slot] = null;
      }
    });
  }
}
