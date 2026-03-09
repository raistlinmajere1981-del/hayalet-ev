/**
 * CDP UI Automation Commands
 *
 * High-level commands for interacting with DOM elements inside Electron.
 */

import type WebSocket from "ws";
import { withConnection, evaluateJS, sendCDPCommand } from "./cdp-connection.js";
import { CDP_TIMEOUTS } from "@timeouts";
import { createMcpTranslatorSync } from "./i18n/index.js";

const cdpCommandT = createMcpTranslatorSync();

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
 * Click an element by selector
 */
export async function clickBySelector(selector: string): Promise<ClickResult> {
  return await withConnection(async (ws: WebSocket) => {
    const script = `
      (function() {
        const el = document.querySelector(${JSON.stringify(selector)});
        if (!el) return { success: false, error: ${JSON.stringify(cdpCommandT("mcpServer.cdpTools.clickBySelector.notFound", { selector }))} };
        el.click();
        return { success: true, tagName: el.tagName, id: el.id, className: el.className };
      })()
    `;
    return await (evaluateJS(ws, script) as Promise<ClickResult>);
  });
}

/**
 * Click an element by matching visible text
 */
export async function clickByText(text: string, tagName = "*"): Promise<ClickResult> {
  return await withConnection(async (ws: WebSocket) => {
    const script = `
      (function() {
        const xpath = "//${tagName}[contains(text(), ${JSON.stringify(text)})]";
        const result = document.evaluate(xpath, document, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null);
        const el = result.singleNodeValue;
        if (!el) return { success: false, error: ${JSON.stringify(cdpCommandT("mcpServer.cdpTools.clickByText.notFound", { text, tagName }))} };
        el.click();
        return { success: true, tagName: el.tagName, textContent: el.textContent.substring(0, 50) };
      })()
    `;
    return await (evaluateJS(ws, script) as Promise<ClickResult>);
  });
}

/**
 * Fill an input field
 */
export async function fillInput(
  selector: string,
  value: string,
  clear = true
): Promise<{ success: boolean; error?: string; newValue?: string }> {
  return await withConnection(async (ws: WebSocket) => {
    const script = `
      (function() {
        const el = document.querySelector(${JSON.stringify(selector)});
        if (!el) return { success: false, error: ${JSON.stringify(cdpCommandT("mcpServer.cdpTools.fillInput.notFound", { selector }))} };
        
        if (${String(clear)}) el.value = "";
        el.value = ${JSON.stringify(value)};
        
        // Trigger input events.
        el.dispatchEvent(new Event("input", { bubbles: true }));
        el.dispatchEvent(new Event("change", { bubbles: true }));
        
        return { success: true, newValue: el.value };
      })()
    `;
    return await (evaluateJS(ws, script) as Promise<{
      success: boolean;
      error?: string;
      newValue?: string;
    }>);
  });
}

/**
 * Read the page structure (for debugging)
 */
export async function getPageStructure(maxDepth = 3): Promise<Record<string, unknown>> {
  return await withConnection(async (ws: WebSocket) => {
    const script = `
      (function() {
        function getStructure(el, depth, maxDepth) {
          if (depth > maxDepth || !el) return null;
          
          const children = Array.from(el.children ?? [])
            .slice(0, 10) // Max 10 child nodes per element.
            .map(child => getStructure(child, depth + 1, maxDepth))
            .filter(Boolean);
          
          return {
            tag: el.tagName?.toLowerCase(),
            id: el.id ?? undefined,
            class: el.className ?? undefined,
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
    return await (evaluateJS(ws, script) as Promise<Record<string, unknown>>);
  });
}

/**
 * Check whether an element exists
 */
export async function checkElement(selector: string): Promise<ElementInfo> {
  return await withConnection(async (ws: WebSocket) => {
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
    return await (evaluateJS(ws, script) as Promise<ElementInfo>);
  });
}

/**
 * Find all matching elements
 */
export async function findElements(selector: string, limit = 20): Promise<ElementListItem[]> {
  return await withConnection(async (ws: WebSocket) => {
    const script = `
      (function() {
        const elements = Array.from(document.querySelectorAll(${JSON.stringify(selector)})).slice(0, ${limit});
        return elements.map((el, index) => ({
          index,
          tagName: el.tagName,
          id: el.id ?? undefined,
          className: el.className ?? undefined,
          textContent: el.textContent?.substring(0, 50),
          visible: el.offsetWidth > 0 && el.offsetHeight > 0,
        }));
      })()
    `;
    return await (evaluateJS(ws, script) as Promise<ElementListItem[]>);
  });
}

/**
 * Capture a screenshot through CDP
 *
 * Note: On multi-monitor setups, screenshots can fail while the window is in the
 * background. Call Page.bringToFront first to improve reliability.
 */
export async function takeScreenshot(format = "png", quality = 80): Promise<string> {
  return await withConnection(async (ws: WebSocket) => {
    // Bring the window to the front first.
    await sendCDPCommand(ws, "Page.bringToFront", {}, CDP_TIMEOUTS.COMMAND_FAST);

    // Enable the Page domain.
    await sendCDPCommand(ws, "Page.enable", {}, CDP_TIMEOUTS.COMMAND_FAST);

    // Capture the screenshot.
    const result = await sendCDPCommand(
      ws,
      "Page.captureScreenshot",
      {
        format,
        quality: format === "jpeg" ? quality : undefined,
        fromSurface: true, // Read from the compositor surface for better reliability.
      },
      CDP_TIMEOUTS.SCREENSHOT
    );
    return result["data"] as string; // Base64 encoded.
  });
}

/**
 * Read the window dimensions
 */
export async function getWindowInfo(): Promise<WindowInfo> {
  return await withConnection(async (ws: WebSocket) => {
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
    return await (evaluateJS(ws, script) as Promise<WindowInfo>);
  });
}

/**
 * Scroll to a specific position
 */
export async function scrollTo(
  x = 0,
  y = 0,
  behavior: "smooth" | "instant" = "smooth"
): Promise<{ scrollX: number; scrollY: number }> {
  return await withConnection(async (ws: WebSocket) => {
    const script = `
      (function() {
        window.scrollTo({ top: ${y}, left: ${x}, behavior: ${JSON.stringify(behavior)} });
        return { scrollX: window.scrollX, scrollY: window.scrollY };
      })()
    `;
    return await (evaluateJS(ws, script) as Promise<{ scrollX: number; scrollY: number }>);
  });
}

/**
 * Send a keyboard event
 */
export async function pressKey(
  key: string,
  modifiers: KeyModifiers = {}
): Promise<{ success: boolean; key: string; target?: string }> {
  return await withConnection(async (ws: WebSocket) => {
    const script = `
      (function() {
        const event = new KeyboardEvent("keydown", {
          key: ${JSON.stringify(key)},
          ctrlKey: ${String(modifiers.ctrl === true)},
          altKey: ${String(modifiers.alt === true)},
          shiftKey: ${String(modifiers.shift === true)},
          metaKey: ${String(modifiers.meta === true)},
          bubbles: true,
        });
        document.activeElement.dispatchEvent(event);
        return { success: true, key: ${JSON.stringify(key)}, target: document.activeElement?.tagName };
      })()
    `;
    return await (evaluateJS(ws, script) as Promise<{
      success: boolean;
      key: string;
      target?: string;
    }>);
  });
}

/**
 * Execute arbitrary JavaScript
 */
export async function executeScript(code: string, timeout?: number): Promise<unknown> {
  return await withConnection(async (ws: WebSocket) => {
    return await evaluateJS(ws, code, true, timeout);
  });
}
