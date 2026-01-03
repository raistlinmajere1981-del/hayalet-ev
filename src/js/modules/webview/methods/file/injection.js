/**
 * File injection method
 * Direct file input element manipulation
 * Provider-agnostic implementation using runtime config
 */

import { waitForDomReady } from "../../../../app.js";
import { validateFiles, createErrorResponse } from "../shared/file-utils.js";

export async function attachFiles(webview, { files }) {
  await waitForDomReady(webview);

  // Validate files
  const validation = validateFiles(files);
  if (!validation.valid) {
    return createErrorResponse(validation.message);
  }

  const filesPayload = JSON.stringify(files);
  const injectScript = `(async function() {
    const files = ${filesPayload};
    if (!files.length) {
      return { success: false, message: 'Dosya listesi boş' };
    }

    // Convert base64 to File objects and DataTransfer
    function base64ToUint8(base64) {
      const binary = atob(base64);
      const len = binary.length;
      const bytes = new Uint8Array(len);
      for (let i = 0; i < len; i++) {
        bytes[i] = binary.charCodeAt(i);
      }
      return bytes;
    }

    const dataTransfer = new DataTransfer();
    files.forEach((file) => {
      const bytes = base64ToUint8(file.base64);
      const f = new File([bytes], file.name, { type: file.mimeType || 'application/octet-stream' });
      dataTransfer.items.add(f);
    });

    // Get file input selectors from config with fallbacks
    const config = window.__hayalet_provider_config;
    let inputSelectors = ['input[type="file"][multiple]', 'input[type="file"]']; // default fallback
    
    if (config && config.fileInputSelectors) {
      inputSelectors = config.fileInputSelectors;
    } else if (config && config.selectors && config.selectors.fileInput) {
      inputSelectors = [config.selectors.fileInput];
    }

    // Some providers (Gemini) create the <input type="file"> only after clicking an upload/attach button.
    const attachButtonSelector = config?.selectors?.attachButton;
    if (attachButtonSelector) {
      try {
        const btn = document.querySelector(attachButtonSelector);
        if (btn) btn.click();
      } catch (_) {}
    }

    // Helper: deep querySelector that also searches open shadow roots
    function querySelectorDeep(selector) {
      // 1) normal DOM
      try {
        const direct = document.querySelector(selector);
        if (direct) return direct;
      } catch (_) {}

      // 2) open shadow roots
      const all = Array.from(document.querySelectorAll("*"));
      for (const el of all) {
        const sr = el.shadowRoot;
        if (!sr) continue;
        try {
          const found = sr.querySelector(selector);
          if (found) return found;
        } catch (_) {}
      }
      return null;
    }

    // Find file input element
    let input = null;
    for (const selector of inputSelectors) {
      try {
        input = querySelectorDeep(selector);
      } catch (_) {
        input = input || null;
      }
      if (input) break;
    }

    if (!input) {
      return { 
        success: false, 
        message: 'Dosya inputu bulunamadı. Denenen selectorlar: ' + inputSelectors.join(', ') 
      };
    }

    // Set files and trigger events
    input.files = dataTransfer.files;
    input.dispatchEvent(new Event('input', { bubbles: true }));
    input.dispatchEvent(new Event('change', { bubbles: true }));

    return { 
      success: true, 
      message: 'Dosyalar input ile eklendi', 
      count: dataTransfer.files.length,
      foundSelector: input.tagName.toLowerCase() + (input.id ? '#' + input.id : '') + (input.className ? '.' + input.className.split(' ').join('.') : '')
    };
  })();`;

  const result = await webview.executeJavaScript(injectScript);
  return {
    success: !!result?.success,
    message: result?.message || "Dosya inject denemesi yapıldı",
    count: result?.count || files.length,
  };
}
