/**
 * Selector Validator
 *
 * CDP üzerinden webview'larda selector'ları test eder.
 */

import WebSocket from "ws";
import { discoverTargets, sendCDPCommand } from "./cdp-connection.js";
import { createMcpTranslatorSync } from "./i18n/index.js";
import type { FlatSelector, ProviderConfig } from "./provider-config.js";

// ============================================
// Types
// ============================================

export interface ElementInfo {
  tagName: string;
  id?: string;
  className?: string;
  textContent?: string;
  attributes?: Record<string, string>;
  boundingRect?: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
  isVisible?: boolean;
  isEnabled?: boolean;
}

export interface SelectorTestResult {
  selector: string;
  found: boolean;
  count: number;
  error?: string;
  sample?: ElementInfo;
}

export interface ValidationResult {
  category: string;
  key: string;
  selector: string;
  found: boolean;
  count: number;
  error?: string;
  sample?: ElementInfo;
}

export interface ProviderValidationResult {
  provider: string;
  url: string;
  timestamp: string;
  connected: boolean;
  error?: string;
  results: ValidationResult[];
  summary: {
    total: number;
    valid: number;
    invalid: number;
    successRate: string;
  };
}

export interface WebviewTarget {
  id: string;
  type: string;
  title: string;
  url: string;
  webSocketDebuggerUrl: string;
  provider?: string;
}

function selectorValidatorT(
  key: string,
  params?: Record<string, string | number | boolean>
): string {
  return createMcpTranslatorSync()(`mcpServer.cdpTools.connectionErrors.${key}`, params);
}

// ============================================
// Webview Discovery
// ============================================

/**
 * Tüm webview target'larını bul ve provider'a göre etiketle
 */
export async function discoverWebviews(
  providerConfigs: ProviderConfig[]
): Promise<WebviewTarget[]> {
  const targets = await discoverTargets();

  return targets
    .filter((t) => t.type === "page" || t.type === "webview")
    .map((t) => {
      // URL'e göre provider belirle
      let provider: string | undefined;
      for (const config of providerConfigs) {
        if (t.url.includes(config.baseUrl.replace("https://", "").replace("http://", ""))) {
          provider = config.id;
          break;
        }
      }

      const target: {
        id: string;
        type: string;
        title: string;
        url: string;
        webSocketDebuggerUrl: string;
        provider?: string;
      } = {
        id: t.id,
        type: t.type,
        title: t.title,
        url: t.url,
        webSocketDebuggerUrl: t.webSocketDebuggerUrl,
      };
      if (provider !== undefined) {
        target.provider = provider;
      }
      return target;
    });
}

/**
 * Belirli bir provider'ın webview'ını bul
 */
export async function findProviderWebview(
  provider: string,
  providerConfigs: ProviderConfig[]
): Promise<WebviewTarget | null> {
  const webviews = await discoverWebviews(providerConfigs);
  return webviews.find((w) => w.provider === provider) ?? null;
}

// ============================================
// CDP Connection for Webview
// ============================================

/**
 * Webview'a bağlan
 */
async function connectToWebview(wsUrl: string, timeout = 10000): Promise<WebSocket> {
  return await new Promise((resolve, reject) => {
    const ws = new WebSocket(wsUrl);

    const timeoutId = setTimeout(() => {
      ws.close();
      reject(new Error(selectorValidatorT("websocketTimeout")));
    }, timeout);

    ws.on("open", () => {
      clearTimeout(timeoutId);
      resolve(ws);
    });

    ws.on("error", (err) => {
      clearTimeout(timeoutId);
      reject(new Error(selectorValidatorT("websocketError", { message: err.message })));
    });
  });
}

// ============================================
// Selector Testing
// ============================================

/**
 * Webview'da tek bir selector'ı test et
 */
export async function testSelector(ws: WebSocket, selector: string): Promise<SelectorTestResult> {
  try {
    // JavaScript'te selector'ı test et
    const jsCode = `
      (() => {
        try {
          const elements = document.querySelectorAll(${JSON.stringify(selector)});
          
          if (elements.length === 0) {
            return { found: false, count: 0 };
          }
          
          const el = elements[0];
          const rect = el.getBoundingClientRect();
          const style = window.getComputedStyle(el);
          
          return {
            found: true,
            count: elements.length,
            sample: {
              tagName: el.tagName,
              id: el.id ?? undefined,
              className: el.className?.toString()?.slice(0, 150) ?? undefined,
              textContent: el.textContent?.slice(0, 100)?.trim() ?? undefined,
              attributes: Object.fromEntries(
                Array.from(el.attributes ?? [])
                  .slice(0, 10)
                  .map(a => [a.name, a.value?.slice(0, 50)])
              ),
              boundingRect: {
                x: Math.round(rect.x),
                y: Math.round(rect.y),
                width: Math.round(rect.width),
                height: Math.round(rect.height)
              },
              isVisible: rect.width > 0 && rect.height > 0 && style.display !== 'none' && style.visibility !== 'hidden',
              isEnabled: !el.disabled
            }
          };
        } catch (e) {
          return { found: false, count: 0, error: e.message };
        }
      })()
    `;

    const result = await sendCDPCommand(ws, "Runtime.evaluate", {
      expression: jsCode,
      returnByValue: true,
      awaitPromise: false,
    });

    const value = (result as { result?: { value?: SelectorTestResult } }).result?.value;

    if (!value) {
      return {
        selector,
        found: false,
        count: 0,
        error: createMcpTranslatorSync()("mcpServer.devTools.selectorValidator.noResult"),
      };
    }

    const testResult: {
      selector: string;
      found: boolean;
      count: number;
      error?: string;
      sample?: ElementInfo;
    } = {
      selector,
      found: value.found,
      count: value.count,
    };
    if (value.error !== undefined) {
      testResult.error = value.error;
    }
    if (value.sample !== undefined) {
      testResult.sample = value.sample;
    }
    return testResult;
  } catch (error) {
    return {
      selector,
      found: false,
      count: 0,
      error: (error as Error).message,
    };
  }
}

/**
 * Webview'da element inspect et (detaylı)
 */
export async function inspectElement(
  ws: WebSocket,
  selector: string,
  options: {
    includeStyles?: boolean;
    includeParent?: boolean;
    includeChildren?: boolean;
    maxElements?: number;
  } = {}
): Promise<{
  found: boolean;
  count: number;
  elements: ElementInfo[];
  error?: string;
}> {
  const {
    includeStyles = false,
    includeParent = false,
    includeChildren = false,
    maxElements = 5,
  } = options;

  try {
    const jsCode = `
      (() => {
        try {
          const elements = document.querySelectorAll(${JSON.stringify(selector)});
          
          if (elements.length === 0) {
            return { found: false, count: 0, elements: [] };
          }
          
          const results = [];
          const limit = Math.min(elements.length, ${maxElements});
          
          for (let i = 0; i < limit; i++) {
            const el = elements[i];
            const rect = el.getBoundingClientRect();
            const style = window.getComputedStyle(el);
            
            const info = {
              tagName: el.tagName,
              id: el.id ?? undefined,
              className: el.className?.toString()?.slice(0, 200) ?? undefined,
              textContent: el.textContent?.slice(0, 150)?.trim() ?? undefined,
              attributes: Object.fromEntries(
                Array.from(el.attributes ?? [])
                  .map(a => [a.name, a.value?.slice(0, 100)])
              ),
              boundingRect: {
                x: Math.round(rect.x),
                y: Math.round(rect.y),
                width: Math.round(rect.width),
                height: Math.round(rect.height)
              },
              isVisible: rect.width > 0 && rect.height > 0 && style.display !== 'none' && style.visibility !== 'hidden',
              isEnabled: !el.disabled
            };
            
            ${
              includeStyles
                ? `
            info.computedStyles = {
              display: style.display,
              visibility: style.visibility,
              opacity: style.opacity,
              position: style.position,
              zIndex: style.zIndex
            };
            `
                : ""
            }
            
            ${
              includeParent
                ? `
            if (el.parentElement) {
              info.parent = {
                tagName: el.parentElement.tagName,
                id: el.parentElement.id ?? undefined,
                className: el.parentElement.className?.toString()?.slice(0, 100) ?? undefined
              };
            }
            `
                : ""
            }
            
            ${
              includeChildren
                ? `
            info.children = Array.from(el.children).slice(0, 5).map(c => ({
              tagName: c.tagName,
              className: c.className?.toString()?.slice(0, 50) ?? undefined
            }));
            `
                : ""
            }
            
            results.push(info);
          }
          
          return { found: true, count: elements.length, elements: results };
        } catch (e) {
          return { found: false, count: 0, elements: [], error: e.message };
        }
      })()
    `;

    const result = await sendCDPCommand(ws, "Runtime.evaluate", {
      expression: jsCode,
      returnByValue: true,
      awaitPromise: false,
    });

    const value = (
      result as {
        result?: {
          value?: { found: boolean; count: number; elements: ElementInfo[]; error?: string };
        };
      }
    ).result?.value;

    if (!value) {
      return { found: false, count: 0, elements: [], error: "Sonuç alınamadı" };
    }

    return value;
  } catch (error) {
    return {
      found: false,
      count: 0,
      elements: [],
      error: (error as Error).message,
    };
  }
}

// ============================================
// Provider Validation
// ============================================

/**
 * Provider'ın tüm selector'larını doğrula
 */
export async function validateProviderSelectors(
  webview: WebviewTarget,
  selectors: FlatSelector[],
  categories?: string[]
): Promise<ProviderValidationResult> {
  const timestamp = new Date().toISOString();

  // Kategori filtresi
  const filteredSelectors = categories
    ? selectors.filter((s) => categories.includes(s.category))
    : selectors;

  // Sonuç objesi
  const result: ProviderValidationResult = {
    provider: webview.provider ?? "unknown",
    url: webview.url,
    timestamp,
    connected: false,
    results: [],
    summary: {
      total: filteredSelectors.length,
      valid: 0,
      invalid: 0,
      successRate: "0%",
    },
  };

  // Webview'a bağlan
  let ws: WebSocket;
  try {
    ws = await connectToWebview(webview.webSocketDebuggerUrl);
    result.connected = true;

    // Runtime'ı etkinleştir
    await sendCDPCommand(ws, "Runtime.enable");
  } catch (error) {
    result.error = (error as Error).message;
    return result;
  }

  try {
    // Her selector'ı test et
    for (const sel of filteredSelectors) {
      // eslint-disable-next-line no-await-in-loop
      const testResult = await testSelector(ws, sel.selector);

      const validationResult: {
        category: string;
        key: string;
        selector: string;
        found: boolean;
        count: number;
        error?: string;
        sample?: ElementInfo;
      } = {
        category: sel.category,
        key: sel.key,
        selector: sel.selector,
        found: testResult.found,
        count: testResult.count,
      };
      if (testResult.error !== undefined) {
        validationResult.error = testResult.error;
      }
      if (testResult.sample !== undefined) {
        validationResult.sample = testResult.sample;
      }
      result.results.push(validationResult);

      if (testResult.found) {
        result.summary.valid++;
      } else {
        result.summary.invalid++;
      }
    }

    // Success rate hesapla
    const rate =
      result.summary.total > 0
        ? Math.round((result.summary.valid / result.summary.total) * 100)
        : 0;
    result.summary.successRate = `${rate}%`;
  } finally {
    ws.close();
  }

  return result;
}

/**
 * Provider'da tek element inspect et
 */
export async function inspectProviderElement(
  webview: WebviewTarget,
  selector: string,
  options?: {
    includeStyles?: boolean;
    includeParent?: boolean;
    includeChildren?: boolean;
  }
): Promise<{
  provider: string;
  url: string;
  selector: string;
  result: Awaited<ReturnType<typeof inspectElement>>;
}> {
  const ws = await connectToWebview(webview.webSocketDebuggerUrl);

  try {
    await sendCDPCommand(ws, "Runtime.enable");
    const result = await inspectElement(ws, selector, options);

    return {
      provider: webview.provider ?? "unknown",
      url: webview.url,
      selector,
      result,
    };
  } finally {
    ws.close();
  }
}
