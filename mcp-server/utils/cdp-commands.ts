/**
 * CDP UI Otomasyon Komutları
 * 
 * Electron içindeki DOM elementleriyle etkileşim için
 * yüksek seviye komutlar.
 */

import WebSocket from "ws";
import { withConnection, evaluateJS, sendCDPCommand } from "./cdp-connection.js";

/** Click result */
interface ClickResult {
  success: boolean;
  error?: string;
  tagName?: string;
  id?: string;
  className?: string;
  textContent?: string;
}

/** Element info */
interface ElementInfo {
  exists: boolean;
  selector: string;
  tagName?: string;
  id?: string;
  className?: string;
  visible?: boolean;
  bounds?: { x: number; y: number; width: number; height: number };
  disabled?: boolean;
  textContent?: string;
}

/** Element list item */
interface ElementListItem {
  index: number;
  tagName: string;
  id?: string;
  className?: string;
  textContent?: string;
  visible: boolean;
}

/** Window info */
interface WindowInfo {
  title: string;
  url: string;
  innerWidth: number;
  innerHeight: number;
  outerWidth: number;
  outerHeight: number;
  devicePixelRatio: number;
  scrollX: number;
  scrollY: number;
}

/** Key modifiers */
interface KeyModifiers {
  ctrl?: boolean;
  alt?: boolean;
  shift?: boolean;
  meta?: boolean;
}

/**
 * Selector ile element'e tıkla
 */
export async function clickBySelector(selector: string): Promise<ClickResult> {
  return withConnection(async (ws: WebSocket) => {
    const script = `
      (function() {
        const el = document.querySelector(${JSON.stringify(selector)});
        if (!el) return { success: false, error: "Element bulunamadı: " + ${JSON.stringify(selector)} };
        el.click();
        return { success: true, tagName: el.tagName, id: el.id, className: el.className };
      })()
    `;
    return evaluateJS(ws, script) as Promise<ClickResult>;
  });
}

/**
 * Metin içeriğine göre element'e tıkla
 */
export async function clickByText(text: string, tagName = "*"): Promise<ClickResult> {
  return withConnection(async (ws: WebSocket) => {
    const script = `
      (function() {
        const xpath = "//${tagName}[contains(text(), ${JSON.stringify(text)})]";
        const result = document.evaluate(xpath, document, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null);
        const el = result.singleNodeValue;
        if (!el) return { success: false, error: "Metin içeren element bulunamadı: " + ${JSON.stringify(text)} };
        el.click();
        return { success: true, tagName: el.tagName, textContent: el.textContent.substring(0, 50) };
      })()
    `;
    return evaluateJS(ws, script) as Promise<ClickResult>;
  });
}

/**
 * Input alanına değer yaz
 */
export async function fillInput(
  selector: string, 
  value: string, 
  clear = true
): Promise<{ success: boolean; error?: string; newValue?: string }> {
  return withConnection(async (ws: WebSocket) => {
    const script = `
      (function() {
        const el = document.querySelector(${JSON.stringify(selector)});
        if (!el) return { success: false, error: "Input bulunamadı: " + ${JSON.stringify(selector)} };
        
        if (${clear}) el.value = "";
        el.value = ${JSON.stringify(value)};
        
        // Input event'lerini tetikle
        el.dispatchEvent(new Event("input", { bubbles: true }));
        el.dispatchEvent(new Event("change", { bubbles: true }));
        
        return { success: true, newValue: el.value };
      })()
    `;
    return evaluateJS(ws, script) as Promise<{ success: boolean; error?: string; newValue?: string }>;
  });
}

/**
 * Sayfa yapısını al (debug için)
 */
export async function getPageStructure(maxDepth = 3): Promise<Record<string, unknown>> {
  return withConnection(async (ws: WebSocket) => {
    const script = `
      (function() {
        function getStructure(el, depth, maxDepth) {
          if (depth > maxDepth || !el) return null;
          
          const children = Array.from(el.children || [])
            .slice(0, 10) // Max 10 child per element
            .map(child => getStructure(child, depth + 1, maxDepth))
            .filter(Boolean);
          
          return {
            tag: el.tagName?.toLowerCase(),
            id: el.id || undefined,
            class: el.className || undefined,
            text: el.childNodes.length === 1 && el.childNodes[0].nodeType === 3 
              ? el.textContent?.substring(0, 30) 
              : undefined,
            children: children.length > 0 ? children : undefined,
          };
        }
        
        return {
          title: document.title,
          url: window.location.href,
          body: getStructure(document.body, 0, ${maxDepth}),
        };
      })()
    `;
    return evaluateJS(ws, script) as Promise<Record<string, unknown>>;
  });
}

/**
 * Element'in varlığını kontrol et
 */
export async function checkElement(selector: string): Promise<ElementInfo> {
  return withConnection(async (ws: WebSocket) => {
    const script = `
      (function() {
        const el = document.querySelector(${JSON.stringify(selector)});
        if (!el) return { exists: false, selector: ${JSON.stringify(selector)} };
        
        const rect = el.getBoundingClientRect();
        return {
          exists: true,
          selector: ${JSON.stringify(selector)},
          tagName: el.tagName,
          id: el.id,
          className: el.className,
          visible: rect.width > 0 && rect.height > 0,
          bounds: { x: rect.x, y: rect.y, width: rect.width, height: rect.height },
          disabled: el.disabled,
          textContent: el.textContent?.substring(0, 100),
        };
      })()
    `;
    return evaluateJS(ws, script) as Promise<ElementInfo>;
  });
}

/**
 * Tüm eşleşen elementleri bul
 */
export async function findElements(selector: string, limit = 20): Promise<ElementListItem[]> {
  return withConnection(async (ws: WebSocket) => {
    const script = `
      (function() {
        const elements = Array.from(document.querySelectorAll(${JSON.stringify(selector)})).slice(0, ${limit});
        return elements.map((el, index) => ({
          index,
          tagName: el.tagName,
          id: el.id || undefined,
          className: el.className || undefined,
          textContent: el.textContent?.substring(0, 50),
          visible: el.offsetWidth > 0 && el.offsetHeight > 0,
        }));
      })()
    `;
    return evaluateJS(ws, script) as Promise<ElementListItem[]>;
  });
}

/**
 * Screenshot al (CDP üzerinden)
 */
export async function takeScreenshot(format = "png", quality = 80): Promise<string> {
  return withConnection(async (ws: WebSocket) => {
    // Page domain'ini etkinleştir (screenshot için gerekli)
    await sendCDPCommand(ws, "Page.enable", {}, 5000);
    
    // Screenshot al (daha uzun timeout - büyük sayfalar için)
    const result = await sendCDPCommand(ws, "Page.captureScreenshot", {
      format,
      quality: format === "jpeg" ? quality : undefined,
    }, 30000);
    return result.data as string; // Base64 encoded
  });
}

/**
 * Pencere boyutunu al
 */
export async function getWindowInfo(): Promise<WindowInfo> {
  return withConnection(async (ws: WebSocket) => {
    const script = `
      (function() {
        return {
          title: document.title,
          url: window.location.href,
          innerWidth: window.innerWidth,
          innerHeight: window.innerHeight,
          outerWidth: window.outerWidth,
          outerHeight: window.outerHeight,
          devicePixelRatio: window.devicePixelRatio,
          scrollX: window.scrollX,
          scrollY: window.scrollY,
        };
      })()
    `;
    return evaluateJS(ws, script) as Promise<WindowInfo>;
  });
}

/**
 * Belirli bir konuma scroll yap
 */
export async function scrollTo(
  x = 0, 
  y = 0, 
  behavior: "smooth" | "instant" = "smooth"
): Promise<{ scrollX: number; scrollY: number }> {
  return withConnection(async (ws: WebSocket) => {
    const script = `
      (function() {
        window.scrollTo({ top: ${y}, left: ${x}, behavior: ${JSON.stringify(behavior)} });
        return { scrollX: window.scrollX, scrollY: window.scrollY };
      })()
    `;
    return evaluateJS(ws, script) as Promise<{ scrollX: number; scrollY: number }>;
  });
}

/**
 * Keyboard event gönder
 */
export async function pressKey(
  key: string, 
  modifiers: KeyModifiers = {}
): Promise<{ success: boolean; key: string; target?: string }> {
  return withConnection(async (ws: WebSocket) => {
    const script = `
      (function() {
        const event = new KeyboardEvent("keydown", {
          key: ${JSON.stringify(key)},
          ctrlKey: ${!!modifiers.ctrl},
          altKey: ${!!modifiers.alt},
          shiftKey: ${!!modifiers.shift},
          metaKey: ${!!modifiers.meta},
          bubbles: true,
        });
        document.activeElement.dispatchEvent(event);
        return { success: true, key: ${JSON.stringify(key)}, target: document.activeElement?.tagName };
      })()
    `;
    return evaluateJS(ws, script) as Promise<{ success: boolean; key: string; target?: string }>;
  });
}

/**
 * Arbitrary JavaScript çalıştır
 */
export async function executeScript(code: string): Promise<unknown> {
  return withConnection(async (ws: WebSocket) => {
    return evaluateJS(ws, code);
  });
}
