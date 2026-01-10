// Loading Tracker - Webview yüklenme durumunu izler
// import { LogManager } from "../log-manager.js";
import { SettingsManager } from "../settings-manager.js";
import { ProviderRegistry } from "../webview/provider-registry.js";

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
    
    // Get provider from slot
    const settings = SettingsManager.getSnapshot();
    const accountId = settings.slots?.[provider]?.accountId;
    const account = accountId ? settings.accounts?.find(acc => acc.id === accountId) : null;
    const providerId = account?.provider || "";
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
              // Check if this element itself is scrollable
              const style = getComputedStyle(el);
              const gap = el.scrollHeight - el.clientHeight;
              const isScrollable = gap > 12 && (style.overflowY === 'auto' || style.overflowY === 'scroll');
              
              if (isScrollable) {
                return el;
              }
              
              // If not scrollable, look for scrollable child
              const scrollableChild = el.querySelector('[class*="overflow-y"]');
              if (scrollableChild) {
                const childStyle = getComputedStyle(scrollableChild);
                const childGap = scrollableChild.scrollHeight - scrollableChild.clientHeight;
                if (childGap > 12 && (childStyle.overflowY === 'auto' || childStyle.overflowY === 'scroll')) {
                  return scrollableChild;
                }
              }
              
              // Return element anyway if no better option
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
            // Prioritize elements with overflow-y: auto or scroll
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
        
        // Try multiple scroll methods for maximum compatibility
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
        const maxAttempts = 12; // Increased attempts
        
        for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
          // Try each method
          for (const method of scrollMethods) {
            try {
              method();
              const newScrollTop = scroller.scrollTop || 0;
              if (newScrollTop > bestScrollTop) {
                bestScrollTop = newScrollTop;
              }
            } catch (_) { void 0; }
          }
          
          // Check if we reached bottom
          const currentTop = scroller.scrollTop || 0;
          const currentHeight = scroller.scrollHeight || 0;
          const currentClient = scroller.clientHeight || 0;
          const gap = Math.abs(currentHeight - currentTop - currentClient);
          
          if (gap < 8) {
            return true; // Success!
          }
          
          // Small delay between attempts (not ideal but may help with dynamic content)
          if (attempt < maxAttempts - 1) {
            const start = Date.now();
            while (Date.now() - start < 10) { /* busy wait 10ms */ }
          }
        }
        
        // Final check
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

    // Check for href change - start loading
    if (currentHref && currentHref !== viewState.lastHref) {
      viewState.lastHref = currentHref;
      this.startLoading(viewState, now);
      indicator = "busy";
      event = {
        type: "loading-started",
        message: `loading started for ${provider}: ${currentHref}`,
      };
    }

    // Check if loading should end
    if (viewState.loadingActive) {
      const result = await this.checkLoadingEnd(
        provider,
        viewState,
        data,
        now,
        webview
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
   * @returns {Object} { shouldEnd: boolean, reason: string, newState: Object }
   */
  async checkLoadingEnd(provider, viewState, data, now, webview) {
    if (!viewState.loadingActive) {
      return { shouldEnd: false, reason: null, newState: viewState };
    }

    const scroll = data.scroll || {};
    // const sendState = data.sendState || "missing";
    // const voiceMode = !!data.voiceMode;

    const scrollGap = (scroll.scrollHeight || 0) - (scroll.clientHeight || 0);
    const hasScroll = scrollGap > 12;
    const scrollChanged =
      scroll.lastChange && scroll.lastChange !== viewState.lastScrollChange;
    const loadingElapsed = now - viewState.loadingStartTime;

    // Update scroll change time
    if (scrollChanged) {
      viewState.lastScrollChange = scroll.lastChange;
    }

    // Check 1: Maximum timeout
    if (loadingElapsed > this.config.loading.maxWaitForScrollMs) {
      return {
        shouldEnd: true,
        reason: "timeout",
        newState: this.endLoading(viewState, now),
      };
    }

    // Check 2: No scroll yet - keep waiting
    if (!hasScroll) {
      return { shouldEnd: false, reason: null, newState: viewState };
    }

    // Check 3: Scroll appeared - start tracking
    if (hasScroll && !viewState.loadingScrollAppeared) {
      viewState.loadingScrollAppeared = true;
      viewState.lastScrollChange = scroll.lastChange || now;
    }

    // Check 4: Auto-scroll and track scroll changes
    if (viewState.loadingScrollAppeared) {
      const atBottom = scroll.atBottom || false;
      const timeSinceLastScroll = now - (viewState.lastAutoScrollAt || 0);

      // Auto-scroll every second if not at bottom
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

      // Check 5: No scroll change for timeout period
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
