/**
 * ProbeScriptBuilder - Webview probe script oluşturucu
 * 
 * Bu modül webview içinde çalıştırılacak probe script'ini oluşturur.
 * Probe script:
 * - Send/Stop/Voice butonlarını tespit eder
 * - Scroll durumunu takip eder
 * - Kullanıcı etkileşimlerini dinler
 */

import { ProviderRegistry } from "../webview/provider-registry.js";
import { AppState } from "../app-state.js";

/**
 * Provider için probe script'i oluştur
 */
export function buildProbeScript(provider: string): string {
  const providerId = AppState.getProviderIdForSlot(provider) || "";
  const cfg = providerId ? ProviderRegistry.get(providerId) : null;
  
  if (!cfg) {
    return `// No config for provider: ${JSON.stringify(providerId)}`; 
  }

  // sendButtonBase varsa onu kullan (disabled kontrolü script içinde yapılır)
  // yoksa sendButton kullan (eski davranış)
  const selectors = cfg.selectors as { sendButtonBase?: string; sendButton?: string; stopButton?: string; voiceButton?: string };
  const sendSel = selectors.sendButtonBase || selectors.sendButton || "";
  const stopSel = selectors.stopButton || "";
  const voiceSel = selectors.voiceButton || "";
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
