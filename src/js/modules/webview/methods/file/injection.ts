/**
 * File injection method
 * Direct file input element manipulation
 * Provider-agnostic implementation using runtime config
 */

import { waitForDomReady } from "../shared/file-utils.js";
import { validateFiles, createErrorResponse } from "../shared/file-utils.js";
import {
  getRuntimeConfigCandidates,
  getRuntimeProviderConfig,
  getRuntimeSelectorCandidates,
} from "../shared/runtime-selectors.js";

interface FilePayload {
  name: string;
  path?: string;
  base64?: string;
  mimeType?: string;
}

export async function attachFiles(
  webview: HTMLElement,
  { files }: { files: FilePayload[] }
): Promise<{
  success: boolean;
  message: string;
  count?: number;
  errors?: unknown[];
  injected?: boolean;
}> {
  await waitForDomReady(webview);

  const validation = validateFiles(files);
  if (!validation.valid) {
    return createErrorResponse(validation.message ?? "Validation failed");
  }

  const filesPayload = JSON.stringify(files);
  const runtimeConfig = await getRuntimeProviderConfig(webview);
  const inputSelectors = getRuntimeConfigCandidates(
    runtimeConfig?.fileInputSelectors ?? ['input[type="file"][multiple]', 'input[type="file"]']
  );
  const attachButtonCandidates = getRuntimeSelectorCandidates(runtimeConfig, "attachButton");
  const injectScript = `(async function() {
    const files = ${filesPayload};
    const inputSelectorCandidates = ${JSON.stringify(inputSelectors)};
    const attachButtonCandidates = ${JSON.stringify(attachButtonCandidates)};
    if (!files.length) {
      return { success: false, message: 'Dosya listesi boş' };
    }

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
      const f = new File([bytes], file.name, { type: file.mimeType ?? 'application/octet-stream' });
      dataTransfer.items.add(f);
    });

    const config = window.__hayalet_provider_config;
    for (const selector of attachButtonCandidates) {
      try {
        const btn = document.querySelector(selector);
        if (btn) {
          btn.click();
          break;
        }
      } catch (err) {
        console.warn("[Hayalet-Injection] attach button click failed", err);
      }
    }

    function querySelectorDeep(selector) {
      try {
        const direct = document.querySelector(selector);
        if (direct) return direct;
      } catch (err) {
        console.warn("[Hayalet-Injection] querySelector failed", err);
      }

      const all = Array.from(document.querySelectorAll("*"));
      for (const el of all) {
        const sr = el.shadowRoot;
        if (!sr) continue;
        try {
          const found = sr.querySelector(selector);
          if (found) return found;
        } catch (err) {
          console.warn("[Hayalet-Injection] shadowRoot query failed", err);
        }
      }
      return null;
    }
    
    let input = null;
    for (const selector of inputSelectorCandidates) {
      try {
        input = querySelectorDeep(selector);
      } catch (_) {
        input = input ?? null;
      }
      if (input) break;
    }

    if (!input) {
      return { 
        success: false, 
        message: 'Dosya inputu bulunamadı. Denenen selectorlar: ' + inputSelectorCandidates.join(', ') 
      };
    }

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

  const result = (await webview.executeJavaScript?.(injectScript)) as
    | { success?: boolean; message?: string; count?: number }
    | undefined;
  return {
    success: result?.success === true,
    message: result?.message ?? "Dosya inject denemesi yapıldı",
    count: result?.count ?? files.length,
  };
}
