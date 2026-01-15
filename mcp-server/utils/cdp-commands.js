/**
 * CDP UI Otomasyon Komutları
 * 
 * Electron içindeki DOM elementleriyle etkileşim için
 * yüksek seviye komutlar.
 */

import { withConnection, evaluateJS, sendCDPCommand } from "./cdp-connection.js";

/**
 * Selector ile element'e tıkla
 * @param {string} selector - CSS selector
 * @returns {Promise<Object>} Sonuç
 */
export async function clickBySelector(selector) {
  return withConnection(async (ws) => {
    const script = `
      (function() {
        const el = document.querySelector(${JSON.stringify(selector)});
        if (!el) return { success: false, error: "Element bulunamadı: " + ${JSON.stringify(selector)} };
        el.click();
        return { success: true, tagName: el.tagName, id: el.id, className: el.className };
      })()
    `;
    return evaluateJS(ws, script);
  });
}

/**
 * Metin içeriğine göre element'e tıkla
 * @param {string} text - Aranacak metin
 * @param {string} tagName - Opsiyonel tag filtresi (button, a, div vb.)
 * @returns {Promise<Object>} Sonuç
 */
export async function clickByText(text, tagName = "*") {
  return withConnection(async (ws) => {
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
    return evaluateJS(ws, script);
  });
}

/**
 * Input alanına değer yaz
 * @param {string} selector - CSS selector
 * @param {string} value - Yazılacak değer
 * @param {boolean} clear - Önce mevcut değeri temizle
 * @returns {Promise<Object>} Sonuç
 */
export async function fillInput(selector, value, clear = true) {
  return withConnection(async (ws) => {
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
    return evaluateJS(ws, script);
  });
}

/**
 * Sayfa yapısını al (debug için)
 * @param {number} maxDepth - Maksimum derinlik
 * @returns {Promise<Object>} DOM yapısı
 */
export async function getPageStructure(maxDepth = 3) {
  return withConnection(async (ws) => {
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
    return evaluateJS(ws, script);
  });
}

/**
 * Element'in varlığını kontrol et
 * @param {string} selector - CSS selector
 * @returns {Promise<Object>} Element bilgisi
 */
export async function checkElement(selector) {
  return withConnection(async (ws) => {
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
    return evaluateJS(ws, script);
  });
}

/**
 * Tüm eşleşen elementleri bul
 * @param {string} selector - CSS selector
 * @param {number} limit - Maksimum sonuç sayısı
 * @returns {Promise<Array>} Element listesi
 */
export async function findElements(selector, limit = 20) {
  return withConnection(async (ws) => {
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
    return evaluateJS(ws, script);
  });
}

/**
 * Screenshot al (CDP üzerinden)
 * @param {string} format - "png" veya "jpeg"
 * @param {number} quality - JPEG kalitesi (1-100)
 * @returns {Promise<string>} Base64 encoded image
 */
export async function takeScreenshot(format = "png", quality = 80) {
  return withConnection(async (ws) => {
    const result = await sendCDPCommand(ws, "Page.captureScreenshot", {
      format,
      quality: format === "jpeg" ? quality : undefined,
    });
    return result.data; // Base64 encoded
  });
}

/**
 * Pencere boyutunu al
 * @returns {Promise<Object>} Pencere boyutları
 */
export async function getWindowInfo() {
  return withConnection(async (ws) => {
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
    return evaluateJS(ws, script);
  });
}

/**
 * Belirli bir konuma scroll yap
 * @param {number} x - X koordinatı
 * @param {number} y - Y koordinatı
 * @param {string} behavior - "smooth" veya "instant"
 * @returns {Promise<Object>} Yeni scroll pozisyonu
 */
export async function scrollTo(x = 0, y = 0, behavior = "smooth") {
  return withConnection(async (ws) => {
    const script = `
      (function() {
        window.scrollTo({ top: ${y}, left: ${x}, behavior: ${JSON.stringify(behavior)} });
        return { scrollX: window.scrollX, scrollY: window.scrollY };
      })()
    `;
    return evaluateJS(ws, script);
  });
}

/**
 * Keyboard event gönder
 * @param {string} key - Tuş adı (Enter, Escape, Tab vb.)
 * @param {Object} modifiers - { ctrl, alt, shift, meta }
 * @returns {Promise<Object>} Sonuç
 */
export async function pressKey(key, modifiers = {}) {
  return withConnection(async (ws) => {
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
    return evaluateJS(ws, script);
  });
}

/**
 * Arbitrary JavaScript çalıştır
 * @param {string} code - JavaScript kodu
 * @returns {Promise<any>} Çalıştırma sonucu
 */
export async function executeScript(code) {
  return withConnection(async (ws) => {
    return evaluateJS(ws, code);
  });
}

