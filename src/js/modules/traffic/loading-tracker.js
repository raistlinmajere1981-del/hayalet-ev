import { ProviderRegistry } from "../webview/provider-registry.js";
import { AppState } from "../app-state.js";
import { isDefaultPage } from "../webview/methods/shared/url-utils.js";

export class LoadingTracker {
  constructor(config) {
    this.config = config;
  }

  /**
   * Scroll to bottom of the webview
   * @param {string} provider - Provider identifier
   * @param {Object} webview - Webview element
   * @returns {Promise<boolean>} True if scrolled successfully
   */
  async scrollToBottom(provider, webview) {
    if (!webview || webview.isDestroyed?.()) return false;
    
    // FIX: Webview'ın DOM'a attach olduğunu ve hazır olduğunu kontrol et
    try {
      if (typeof webview.getWebContentsId !== "function") return false;
      webview.getWebContentsId(); // Hazır değilse hata fırlatır
      if (webview.isLoading?.()) return false;
    } catch (_) {
      return false;
    }
    
    const providerId = AppState.getProviderIdForSlot(provider) || "";
    const cfg = providerId ? ProviderRegistry.get(providerId) : null;
    const scrollerSelectors = cfg?.scrollerSelectors || [
      "div.flex.h-full.flex-col.overflow-y-auto",
      "main div.overflow-y-auto",
      "main section.overflow-y-auto",
      'div[role="main"] .overflow-y-auto',
    ];
    const contentContainers = cfg?.contentContainers || [
      "main",
      "section",
      "div",
      "article",
    ];
    
    const script = `(() => {
      const scrollerSelectors = ${JSON.stringify(scrollerSelectors)};
      const contentContainers = ${JSON.stringify(contentContainers)};
      
      const findChatScroller = () => {
        for (const sel of scrollerSelectors) {
          try {
            const el = document.querySelector(sel);
            if (el) {
              const style = getComputedStyle(el);
              const gap = el.scrollHeight - el.clientHeight;
              const isScrollable = gap > 12 && (style.overflowY === 'auto' || style.overflowY === 'scroll');
              
              if (isScrollable) {
                return el;
              }
              
              const scrollableChild = el.querySelector('[class*="overflow-y"]');
              if (scrollableChild) {
                const childStyle = getComputedStyle(scrollableChild);
                const childGap = scrollableChild.scrollHeight - scrollableChild.clientHeight;
                if (childGap > 12 && (childStyle.overflowY === 'auto' || childStyle.overflowY === 'scroll')) {
                  return scrollableChild;
                }
              }
              
              return el;
            }
          } catch (_) { /* noop */ }
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
          if (gap > 8 && el.clientHeight > 120) {
            const priority = (style.overflowY === 'auto' || style.overflowY === 'scroll') ? gap * 2 : gap;
            candidates.push({ el, gap, priority });
          }
        };
        pushIfScrollable(document.scrollingElement);
        pushIfScrollable(document.documentElement);
        pushIfScrollable(document.body);
        for (const tag of contentContainers) {
          try {
            const list = document.querySelectorAll(tag);
            for (let i = 0; i < list.length && i < 250; i += 1) {
              pushIfScrollable(list[i]);
            }
          } catch (_) { /* noop */ }
        }
        candidates.sort((a, b) => b.priority - a.priority);
        return (candidates[0] && candidates[0].el) || document.scrollingElement || document.documentElement || document.body;
      };
      
      const scroller = findChatScroller() || findFallbackScroller();
      if (!scroller) return false;
      
      try {
        const scrollHeight = scroller.scrollHeight;
        const clientHeight = scroller.clientHeight;
        const maxScroll = scrollHeight - clientHeight;
        
        const scrollMethods = [
          () => { scroller.scrollTop = maxScroll; },
          () => { scroller.scrollTop = scrollHeight; },
          () => { scroller.scrollTop = 999999; },
          () => { if (scroller.scrollTo) scroller.scrollTo({ top: maxScroll, behavior: 'auto' }); },
          () => { if (scroller.scrollTo) scroller.scrollTo({ top: scrollHeight, behavior: 'auto' }); },
          () => { if (scroller.scrollTo) scroller.scrollTo({ top: 999999, behavior: 'auto' }); },
          () => { if (scroller.scrollTo) scroller.scrollTo({ top: maxScroll, behavior: 'instant' }); },
          () => { if (scroller.scrollTo) scroller.scrollTo(0, maxScroll); },
        ];
        
        let bestScrollTop = scroller.scrollTop || 0;
        const maxAttempts = 12;
        
        for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
          for (const method of scrollMethods) {
            try {
              method();
              const newScrollTop = scroller.scrollTop || 0;
              if (newScrollTop > bestScrollTop) {
                bestScrollTop = newScrollTop;
              }
            } catch (_) { void 0; }
          }
          
          const currentTop = scroller.scrollTop || 0;
          const currentHeight = scroller.scrollHeight || 0;
          const currentClient = scroller.clientHeight || 0;
          const gap = Math.abs(currentHeight - currentTop - currentClient);
          
          if (gap < 8) {
            return true;
          }
          
          if (attempt < maxAttempts - 1) {
            const start = Date.now();
            while (Date.now() - start < 10) { /* busy wait 10ms */ }
          }
        }
        
        const finalTop = scroller.scrollTop || 0;
        const finalHeight = scroller.scrollHeight || 0;
        const finalClient = scroller.clientHeight || 0;
        const finalGap = Math.abs(finalHeight - finalTop - finalClient);
        return finalGap < 8;
      } catch (_) { 
        return false; 
      }
    })();`;
    
    try {
      return await webview.executeJavaScript(script, true);
    } catch (_) {
      return false;
    }
  }

  /**
   * Handle probe data for loading tracking
   * @param {string} provider - Provider identifier (ai1/ai2)
   * @param {Object} viewState - Current state
   * @param {Object} data - Probe data containing scroll info
   * @param {number} now - Current timestamp
   * @param {Object} webview - Webview element
   * @param {string} currentHref - Current URL
   * @returns {Object} { indicator: string, newState: Object, event: Object|null }
   */
  async handleProbe(provider, viewState, data, now, webview, currentHref) {
    let indicator = viewState.status?.loading || "busy";
    let event = null;

    if (currentHref && currentHref !== viewState.lastHref) {
      viewState.lastHref = currentHref;
      
      this.startLoading(viewState, now);
      indicator = "busy";
      event = {
        type: "loading-started",
        message: `loading started for ${provider}: ${currentHref}`,
      };
    }

    if (viewState.loadingActive) {
      const result = await this.checkLoadingEnd(
        provider,
        viewState,
        data,
        now,
        webview,
        currentHref
      );

      if (result.shouldEnd) {
        indicator = "idle";
        event = {
          type: "loading-ended",
          message: `loading ended (${result.reason}) for ${provider}: ${currentHref}`,
        };
      } else {
        indicator = "busy";
      }

      viewState = result.newState;
    }

    return { indicator, newState: viewState, event };
  }

  /**
   * Initialize loading state for a provider
   * @param {Object} viewState - The provider's state object
   * @param {number} now - Current timestamp
   */
  startLoading(viewState, now) {
    viewState.loadingActive = true;
    viewState.loadingStartTime = now;
    viewState.loadingScrollAppeared = false;
    viewState.lastScrollChange = 0;
    viewState.lastAutoScrollAt = 0;
    return viewState;
  }

  /**
   * Check if loading should end based on current state
   * @param {string} provider - Provider identifier (ai1/ai2)
   * @param {Object} viewState - Current state
   * @param {Object} data - Probe data containing scroll, sendState, etc.
   * @param {number} now - Current timestamp
   * @param {Object} webview - Webview element for scrolling
   * @param {string} [currentUrl] - Current URL for default page detection
   * @returns {Object} { shouldEnd: boolean, reason: string, newState: Object }
   */
  async checkLoadingEnd(provider, viewState, data, now, webview, currentUrl = "") {
    if (!viewState.loadingActive) {
      return { shouldEnd: false, reason: null, newState: viewState };
    }

    const scroll = data.scroll || {};
    const loadingElapsed = now - viewState.loadingStartTime;

    // Default page kontrolü - scroll yerine send button varlığı ile loading sonlandır
    const providerId = AppState.getProviderIdForSlot(provider) || "";
    const onDefaultPage = isDefaultPage(currentUrl, providerId);
    
    if (onDefaultPage) {
      // Default page'de scroll yok, send butonu bulunduğunda (aktif veya pasif) loading biter
      // sendState: "enabled" (aktif), "disabled" (pasif), "missing" (bulunamadı)
      const sendButtonFound = data.sendState === "enabled" || data.sendState === "disabled";
      
      if (sendButtonFound) {
        return {
          shouldEnd: true,
          reason: "default page ready (send button found)",
          newState: this.endLoading(viewState, now),
        };
      }
      
      // Default page için daha kısa timeout (5 saniye)
      if (loadingElapsed > 5000) {
        return {
          shouldEnd: true,
          reason: "default page timeout",
          newState: this.endLoading(viewState, now),
        };
      }
      
      return { shouldEnd: false, reason: null, newState: viewState };
    }

    const scrollGap = (scroll.scrollHeight || 0) - (scroll.clientHeight || 0);
    const hasScroll = scrollGap > 12;
    const scrollChanged =
      scroll.lastChange && scroll.lastChange !== viewState.lastScrollChange;

    if (scrollChanged) {
      viewState.lastScrollChange = scroll.lastChange;
    }

    if (loadingElapsed > this.config.loading.maxWaitForScrollMs) {
      return {
        shouldEnd: true,
        reason: "timeout",
        newState: this.endLoading(viewState, now),
      };
    }

    if (!hasScroll) {
      return { shouldEnd: false, reason: null, newState: viewState };
    }

    if (hasScroll && !viewState.loadingScrollAppeared) {
      viewState.loadingScrollAppeared = true;
      viewState.lastScrollChange = scroll.lastChange || now;
    }

    if (viewState.loadingScrollAppeared) {
      const atBottom = scroll.atBottom || false;
      const timeSinceLastScroll = now - (viewState.lastAutoScrollAt || 0);

      if (
        !atBottom &&
        timeSinceLastScroll >= this.config.loading.autoScrollIntervalMs
      ) {
        try {
          const scrolled = await this.scrollToBottom(provider, webview);
          viewState.lastAutoScrollAt = now;
          if (scrolled) {
            viewState.loadingScrollAppeared = true;
            viewState.lastScrollChange = Date.now();
          }
        } catch (_) {
          viewState.lastAutoScrollAt = now;
        }
      }

      if (viewState.lastScrollChange > 0) {
        const timeSinceLastScrollChange = now - viewState.lastScrollChange;
        if (
          timeSinceLastScrollChange >=
          this.config.loading.noScrollChangeTimeoutMs
        ) {
          return {
            shouldEnd: true,
            reason: "no more scroll",
            newState: this.endLoading(viewState, now),
          };
        }
      }
    }

    return { shouldEnd: false, reason: null, newState: viewState };
  }

  /**
   * End loading state
   * @param {Object} viewState - The provider's state object
   * @param {number} now - Current timestamp
   * @returns {Object} Updated state
   */
  endLoading(viewState, now) {
    viewState.loadingActive = false;
    viewState.loadingJustEnded = true;
    viewState.loadingEndedAt = now;
    return viewState;
  }

  /**
   * Clear the "just ended" flag after a delay
   * @param {Object} viewState - The provider's state object
   * @returns {Object} Updated state
   */
  clearJustEnded(viewState) {
    viewState.loadingJustEnded = false;
    return viewState;
  }
}
