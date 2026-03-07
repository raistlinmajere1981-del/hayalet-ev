/**
 * File drag and drop method
 * Simulates drag-and-drop file upload
 * Provider-agnostic implementation using runtime config for DOM selectors
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
  const uploadTargetCandidates = getRuntimeConfigCandidates(
    runtimeConfig?.uploadTargetSelectors ??
      runtimeConfig?.selectors?.["inputField"] ?? ["textarea", "form"]
  );
  const previewCandidates = getRuntimeSelectorCandidates(runtimeConfig, "filePreview");
  const dropScript = `(async function() {
    const files = ${filesPayload};
    const uploadTargetCandidates = ${JSON.stringify(uploadTargetCandidates)};
    const previewSelectorCandidates = ${JSON.stringify(previewCandidates)};
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

    const cleanupDragOverlay = (): unknown => {
      const config = window.__hayalet_provider_config;
      
      let overlaySelectors = [
        '[data-dnd-overlay]',
        '[data-testid*="drop"]',
        '[data-testid*="drag"]',
        '.drag-overlay',
        '.drag-drop-overlay',
        '.file-drop-target',
        '.dnd-active-overlay'
      ];
      
      if (
        Array.isArray(config?.filters?.dragOverlaySelectors) &&
        config.filters.dragOverlaySelectors.length
      ) {
        overlaySelectors = config.filters.dragOverlaySelectors;
      }

      let criticalSelectors = [
        'textarea',
        'input[type="text"]',
        'input[type="search"]',
        '[contenteditable="true"]',
        '[data-message-author-role]'
      ];
      
      if (config?.criticalSelectors) {
        criticalSelectors = config.criticalSelectors;
      }

      const isCritical = (node): unknown => {
        if (!node) return false;
        if (node === document.body || node === document.documentElement) return true;
        return criticalSelectors.some((sel) => {
          try { 
            return node.matches?.(sel) || !!node.querySelector?.(sel); 
          } catch (_) { 
            return false; 
          }
        });
      };

      overlaySelectors.forEach((selector) => {
        document.querySelectorAll(selector).forEach((overlay) => {
          if (isCritical(overlay)) return;
          
          const rect = overlay.getBoundingClientRect();
          const style = getComputedStyle(overlay);
          const isLarge = rect.width >= window.innerWidth * 0.25 && rect.height >= window.innerHeight * 0.25;
          const isFloating = style.position === 'fixed' || style.position === 'absolute';
          
          if (isLarge && isFloating) {
            const textContent = overlay.textContent?.toLowerCase() ?? '';
            let containsDragText = false;
            
            let textMatchers = ['sürükleyin', 'drop', 'dosya', 'file'];
            if (config?.filters?.dragTextMatchers) {
              textMatchers = config.filters.dragTextMatchers;
            }
            
            for (const matcher of textMatchers) {
              if (textContent.includes(matcher.toLowerCase())) {
                containsDragText = true;
                break;
              }
            }
            
            if (containsDragText) {
              try {
                overlay.remove();
              } catch (_) {
                overlay.style.display = 'none';
              }
            }
          }
        });
      });
    };

    cleanupDragOverlay();

    const config = window.__hayalet_provider_config;

    function querySelectorDeep(selector) {
      try {
        const direct = document.querySelector(selector);
        if (direct) return direct;
      } catch (err) {
        console.warn("[Hayalet-DragDrop] querySelector failed", err);
      }

      const all = Array.from(document.querySelectorAll("*"));
      for (const el of all) {
        const sr = el.shadowRoot;
        if (!sr) continue;
        try {
          const found = sr.querySelector(selector);
          if (found) return found;
        } catch (err) {
          console.warn("[Hayalet-DragDrop] shadowRoot query failed", err);
        }
      }
      return null;
    }

    function sleep(ms) {
      return new Promise((resolve) => setTimeout(resolve, ms));
    }

    let target = null;
    for (let attempt = 0; attempt < 8 && !target; attempt++) {
      for (const selector of uploadTargetCandidates) {
        try {
          const el = querySelectorDeep(selector);
          if (el) {
            target = el;
            break;
          }
        } catch (err) {
          console.warn("[Hayalet-DragDrop] target resolution failed", err);
        }
      }
      if (!target) {
        await sleep(120);
      }
    }

    if (!target) {
      target = document.body;
    }

    if (!target) {
      return { success: false, message: 'Drop hedefi bulunamadı' };
    }

    let cx = 10;
    let cy = 10;
    try {
      const rect = target?.getBoundingClientRect?.();
      if (rect) {
        cx = Math.round(rect.left + rect.width / 2);
        cy = Math.round(rect.top + rect.height / 2);
      }
    } catch (err) {
      console.warn("[Hayalet-DragDrop] getBoundingClientRect failed", err);
    }

    try {
      dataTransfer.dropEffect = 'copy';
      dataTransfer.effectAllowed = 'all';
    } catch (err) {
      console.warn("[Hayalet-DragDrop] dataTransfer config failed", err);
    }

    const dragEnterEvent = new DragEvent('dragenter', {
      bubbles: true,
      cancelable: true,
      composed: true,
      clientX: cx,
      clientY: cy,
      dataTransfer: dataTransfer
    });

    const dragOverEvent = new DragEvent('dragover', {
      bubbles: true,
      cancelable: true,
      composed: true,
      clientX: cx,
      clientY: cy,
      dataTransfer: dataTransfer
    });

    const dropEvent = new DragEvent('drop', {
      bubbles: true,
      cancelable: true,
      composed: true,
      clientX: cx,
      clientY: cy,
      dataTransfer: dataTransfer
    });

    const dropTarget = target ?? document.body;

    return new Promise((resolve) => {
      try { dropTarget.dispatchEvent(dragEnterEvent); } catch (err) {
        console.warn("[Hayalet-DragDrop] dragenter dispatch failed", err);
      }

      setTimeout(() => {
        try { dropTarget.dispatchEvent(dragOverEvent); } catch (err) {
          console.warn("[Hayalet-DragDrop] dragover dispatch failed", err);
        }
        setTimeout(() => {
          try { dropTarget.dispatchEvent(dropEvent); } catch (err) {
            console.warn("[Hayalet-DragDrop] drop dispatch failed", err);
          }

          setTimeout(() => {
            const config = window.__hayalet_provider_config;
            let previewSelectors = [
              'uploader-file-preview',
              '.file-preview-wrapper',
              '[data-test-id="image-preview"]',
              '[data-testid*="attachment"]',
              '[data-testid*="file"]',
              '.attachment-preview',
              '.file-attachment'
            ];

            if (previewSelectorCandidates.length) {
              previewSelectors = previewSelectorCandidates;
            } else if (config?.selectors?.filePreview) {
              previewSelectors = Array.isArray(config.selectors.filePreview)
                ? config.selectors.filePreview
                : [config.selectors.filePreview];
            }

            const hasPreview = previewSelectors.some((sel) => {
              try {
                return !!document.querySelector(sel);
              } catch (_) {
                return false;
              }
            });
            
            const providerName = config?.name ?? config?.id ?? 'Provider';

            resolve({
              success: hasPreview,
              message: hasPreview
                ? 'Dosyalar drag-drop ile eklendi'
                : 'Drag-drop tetiklendi ama ' + providerName + ' dosyayı kabul etmedi (preview oluşmadı)',
              count: dataTransfer.files.length,
              target: (target?.tagName ?? 'unknown').toLowerCase() + (target?.id ? '#' + target.id : ''),
            });
          }, 600);
        }, 80);
      }, 80);
    });
  })();`;

  const result = (await webview.executeJavaScript?.(dropScript)) as
    | { success?: boolean; message?: string; count?: number }
    | undefined;
  return {
    success: result?.success === true,
    message: result?.message ?? "Dosya drag-drop denemesi yapıldı",
    count: result?.count ?? files.length,
  };
}
