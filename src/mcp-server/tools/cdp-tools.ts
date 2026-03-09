/**
 * CDP Tools - TypeScript
 */

import type { ToolResult } from "@shared/index-mcp.js";

/**
 * CDP (Chrome DevTools Protocol) MCP Tools
 *
 * Tool handlers for remotely controlling the Electron application.
 */

import { checkConnection, discoverTargets as _discoverTargets } from "../utils/cdp-connection.js";
import { createMcpTranslatorSync } from "../utils/i18n/index.js";

import {
  clickBySelector,
  clickByText,
  fillInput,
  getPageStructure,
  checkElement,
  findElements,
  takeScreenshot,
  getWindowInfo,
  scrollTo,
  pressKey,
  executeScript,
} from "../utils/cdp-commands.js";

import { logToolError } from "../utils/mcp-logger.js";

function cdpT(key: string, params?: Record<string, string | number | boolean>): string {
  return createMcpTranslatorSync()(`mcpServer.cdpTools.${key}`, params);
}

/**
 * Log CDP errors and return an error result
 */
function cdpError(
  toolName: string,
  error: Error,
  key = "errors.generic",
  params?: Record<string, string | number | boolean>
): ToolResult {
  logToolError(toolName, error, {});
  return {
    content: [
      {
        type: "text",
        text: cdpT(key, {
          message: error.message,
          ...(params ?? {}),
        }),
      },
    ],
    isError: true,
  };
}

function isNonEmptyString(value: string | undefined): value is string {
  return value !== undefined && value.length > 0;
}

/**
 * Check the Electron connection status
 */
export async function checkElectronConnection(): Promise<ToolResult> {
  try {
    const status = await checkConnection();

    if (status.connected) {
      const notAvailable = cdpT("common.notAvailable");
      return {
        content: [
          {
            type: "text",
            text: cdpT("checkConnection.connected", {
              port: status.port,
              targetsCount: status.targetsCount ?? 0,
              title: status.mainWindow?.title ?? notAvailable,
              url: status.mainWindow?.url ?? notAvailable,
              windowType: status.mainWindow?.type ?? notAvailable,
            }),
          },
        ],
      };
    } else {
      return {
        content: [
          {
            type: "text",
            text: cdpT("checkConnection.disconnected", {
              error: status.error ?? cdpT("common.unknown"),
              port: status.port,
            }),
          },
        ],
      };
    }
  } catch (err) {
    return cdpError("hev_check_electron_connection", err as Error, "errors.connectionCheck");
  }
}

/**
 * Send a command to Electron (execute JavaScript)
 */
export async function sendCommandToElectron(
  args: Record<string, unknown> = {}
): Promise<ToolResult> {
  const { command, description } = args as { command?: string; description?: string };

  if (command == null || command === "") {
    return {
      content: [{ type: "text", text: cdpT("sendCommand.missingCommand") }],
      isError: true,
    };
  }

  try {
    const result = await executeScript(command);

    return {
      content: [
        {
          type: "text",
          text: cdpT("sendCommand.success", {
            suffix:
              isNonEmptyString(description) === true
                ? cdpT("sendCommand.descriptionSuffix", { description })
                : "",
            result: JSON.stringify(result, null, 2),
          }),
        },
      ],
    };
  } catch (err) {
    return cdpError("hev_send_command_to_electron", err as Error, "errors.command");
  }
}

export async function toggleMcpPanelServers(
  args: Record<string, unknown> = {}
): Promise<ToolResult> {
  const serversRaw = Array.isArray(args["servers"]) ? args["servers"] : [];
  const servers = serversRaw
    .filter((item): item is string => typeof item === "string")
    .map((item) => item.trim().toLowerCase())
    .filter((item) => item !== "");

  const providerRaw = args["provider"];
  const provider = providerRaw === "opencode" || providerRaw === "auto" ? providerRaw : "auto";

  const settleMsRaw = args["settleMs"];
  const settleMs =
    typeof settleMsRaw === "number" && Number.isFinite(settleMsRaw)
      ? Math.max(1000, Math.min(120000, Math.round(settleMsRaw)))
      : 4000;

  const cycleRaw = args["cycles"];
  const cycles =
    typeof cycleRaw === "number" && Number.isFinite(cycleRaw)
      ? Math.max(1, Math.min(5, Math.round(cycleRaw)))
      : 1;

  const targetServers = servers.length > 0 ? servers : ["context7", "grep_app", "hayalet-ev"];

  const payload = JSON.stringify({
    provider,
    settleMs,
    cycles,
    servers: targetServers,
  });

  const webviewScript = `(async () => {
    const options = ${payload};
    const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
    const normalize = (value) => (value || "").replace(/\\s+/g, " ").trim().toLowerCase();
    const waitUntil = async (predicate, timeoutMs, pollMs) => {
      const start = Date.now();
      while (Date.now() - start < timeoutMs) {
        if (predicate() === true) {
          return true;
        }
        await wait(pollMs);
      }
      return false;
    };

    const detectProvider = () => {
      if (options.provider !== "auto") return options.provider;
      if (document.querySelector("button[role=tab]") !== null) {
        return "opencode";
      }
      return "unknown";
    };

    const openOpencodeMcpPanel = async () => {
      for (let i = 0; i < 8; i++) {
        const statusTrigger = document.querySelector("button[aria-haspopup=dialog]");
        if (statusTrigger !== null) {
          const expanded = statusTrigger.getAttribute("aria-expanded") === "true";
          if (!expanded) {
            statusTrigger.click();
          }
          await wait(250);
        }

        const tabs = Array.from(document.querySelectorAll("button[role=tab]"));
        const mcpTab = tabs.find((tab) => normalize(tab.textContent).includes("mcp"));
        if (mcpTab !== undefined) {
          mcpTab.click();
          await wait(300);
          return true;
        }

        await wait(300);
      }

      return false;
    };

    const findOpencodeSwitch = (name) => {
      const rows = Array.from(document.querySelectorAll("button"));

      const row = rows.find((button) => {
        const label = button.querySelector("span");
        if (normalize(label?.textContent) !== name) return false;
        return button.querySelector('input[type="checkbox"][role="switch"]') !== null;
      });

      if (!row) return null;
      return row.querySelector("input[type=checkbox][role=switch]");
    };

    const findRovodevSwitch = (name) => {
      const input = document.querySelector(
        '#mcp-list input[type=checkbox][data-mcp-name="' + name + '"]'
      );
      if (input !== null) return input;

      const rows = Array.from(document.querySelectorAll("#mcp-list .ds-item-row"));
      const row = rows.find((el) => normalize(el.textContent).includes(name));
      if (!row) return null;
      return row.querySelector("input[type=checkbox][data-mcp-name]");
    };

    const getSwitch = (name, mode) => {
      if (mode === "opencode") return findOpencodeSwitch(name);
      return findRovodevSwitch(name);
    };

    const captureStates = (mode) => {
      const out = {};
      for (const server of options.servers) {
        const input = getSwitch(server, mode);
        out[server] = input
          ? {
              checked: input.checked === true,
              ariaChecked: input.getAttribute("aria-checked"),
              id: input.id || null,
            }
          : null;
      }
      return out;
    };

    const mode = detectProvider();
    if (mode === "unknown") {
      return { ok: false, stage: "detect", reason: "mcp-panel-not-detected" };
    }

    if (mode === "opencode") {
      const opened = await openOpencodeMcpPanel();
      if (!opened) {
        return { ok: false, stage: "open-opencode-panel", reason: "mcp-tab-not-found" };
      }
    }

    const missing = options.servers.filter((name) => getSwitch(name, mode) === null);
    if (missing.length > 0) {
      return { ok: false, stage: "resolve-switches", reason: "servers-not-found", missing, mode };
    }

    const before = captureStates(mode);
    const actions = [];
    const stateTimeoutMs = Math.max(12000, options.settleMs * 6);
    const minOffMs = Math.max(5000, options.settleMs);

    for (let cycle = 0; cycle < options.cycles; cycle++) {
      for (const name of options.servers) {
        let input = getSwitch(name, mode);
        if (input === null) continue;

        const wasChecked = input.checked === true;
        let offConfirmed = false;
        let readyForOn = false;

        if (wasChecked) {
          input.click();
          offConfirmed = await waitUntil(() => {
            const current = getSwitch(name, mode);
            return current !== null && current.checked === false;
          }, stateTimeoutMs, 350);
        } else {
          offConfirmed = true;
        }

        await wait(minOffMs);

        readyForOn = await waitUntil(() => {
          const current = getSwitch(name, mode);
          return current !== null && current.disabled !== true;
        }, stateTimeoutMs, 400);

        const stateAfterOffInput = getSwitch(name, mode);
        const stateAfterOff = stateAfterOffInput?.checked === true;
        let onAttempts = 0;
        let onConfirmed = false;

        while (onAttempts < 8) {
          input = getSwitch(name, mode);
          if (input === null) break;
          if (input.checked === true) {
            onConfirmed = true;
            break;
          }

          if (input.disabled === true) {
            onAttempts += 1;
            await wait(Math.max(1000, Math.floor(options.settleMs / 2)));
            continue;
          }

          input.click();
          onAttempts += 1;
          const enabled = await waitUntil(() => {
            const current = getSwitch(name, mode);
            return current !== null && current.checked === true;
          }, Math.max(5000, options.settleMs * 2), 300);

          if (enabled) {
            onConfirmed = true;
            break;
          }

          await wait(Math.max(1000, Math.floor(options.settleMs / 3)));
        }

        const finalInput = getSwitch(name, mode);

        actions.push({
          cycle: cycle + 1,
          server: name,
          before: wasChecked,
          mid: stateAfterOff,
          offConfirmed,
          readyForOn,
          onAttempts,
          onConfirmed,
          after: finalInput?.checked === true,
        });
      }
    }

    return {
      ok: true,
      mode,
      settleMs: options.settleMs,
      cycles: options.cycles,
      before,
      actions,
      after: captureStates(mode),
    };
  })();`;

  const command = `(async () => {
    const ai0Webview = document.querySelector("#ai0-webview");
    if (!ai0Webview || typeof ai0Webview.executeJavaScript !== "function") {
      return { ok: false, stage: "bootstrap", reason: "ai0-webview-not-ready" };
    }
    return await ai0Webview.executeJavaScript(${JSON.stringify(webviewScript)});
  })();`;

  try {
    const commandTimeout = Math.min(
      240_000,
      60_000 +
        cycles *
          targetServers.length *
          (Math.max(5000, settleMs) + Math.max(1200, Math.floor(settleMs / 2)) * 8)
    );

    const result = await executeScript(command, commandTimeout);
    return {
      content: [
        {
          type: "text",
          text: JSON.stringify(result, null, 2),
        },
      ],
      isError:
        typeof result === "object" && result !== null && (result as { ok?: boolean }).ok !== true,
    };
  } catch (err) {
    return cdpError("hev_toggle_mcp_panel_servers", err as Error, "errors.toggleMcpPanel");
  }
}

/**
 * Capture a screenshot of the Electron window
 */
export async function takeCdpScreenshot(args: Record<string, unknown>): Promise<ToolResult> {
  const {
    format = "png",
    quality = 80,
    savePath,
  } = args as { format?: string; quality?: number; savePath?: string };

  try {
    const base64Data = await takeScreenshot(format, quality);

    // Dosyaya kaydetme opsiyonu
    if (isNonEmptyString(savePath)) {
      const { writeFile } = await import("fs/promises");
      const buffer = Buffer.from(base64Data, "base64");
      await writeFile(savePath, buffer);

      return {
        content: [
          {
            type: "text",
            text: cdpT("takeScreenshot.saved", {
              savePath,
              sizeBytes: buffer.length,
            }),
          },
        ],
      };
    }

    // Return as Base64 (for small previews)
    return {
      content: [
        {
          type: "text",
          text: cdpT("takeScreenshot.preview", {
            format: format.toUpperCase(),
            sizeKB: Math.round((base64Data.length * 0.75) / 1024),
          }),
        },
      ],
    };
  } catch (err) {
    return cdpError("hev_take_cdp_screenshot", err as Error, "errors.screenshot");
  }
}

/**
 * Electron pencere bilgilerini al
 */
export async function getElectronWindowInfo(): Promise<ToolResult> {
  try {
    const info = await getWindowInfo();

    return {
      content: [
        {
          type: "text",
          text: cdpT("windowInfo.success", {
            title: info.title,
            url: info.url,
            innerWidth: info.innerWidth,
            innerHeight: info.innerHeight,
            outerWidth: info.outerWidth,
            outerHeight: info.outerHeight,
            devicePixelRatio: info.devicePixelRatio,
            scrollX: info.scrollX,
            scrollY: info.scrollY,
          }),
        },
      ],
    };
  } catch (err) {
    return cdpError("hev_get_electron_window_info", err as Error, "errors.windowInfo");
  }
}

/**
 * Click an element by CSS selector
 */
export async function clickElementBySelector(args: Record<string, unknown>): Promise<ToolResult> {
  const { selector } = args as { selector?: string };

  if (!isNonEmptyString(selector)) {
    return {
      content: [{ type: "text", text: cdpT("clickBySelector.missingSelector") }],
      isError: true,
    };
  }

  try {
    const result = await clickBySelector(selector);

    if (result.success) {
      return {
        content: [
          {
            type: "text",
            text: cdpT("clickBySelector.success", {
              element: `<${result.tagName?.toLowerCase() ?? cdpT("common.unknown")}${isNonEmptyString(result.id) ? ` id="${result.id}"` : ""}${isNonEmptyString(result.className) ? ` class="${result.className}"` : ""}>`,
            }),
          },
        ],
      };
    } else {
      return {
        content: [{ type: "text", text: cdpT("clickBySelector.notFound", { selector }) }],
        isError: true,
      };
    }
  } catch (err) {
    return cdpError("hev_click_element_by_selector", err as Error, "errors.click");
  }
}

/**
 * Click an element by text content
 */
export async function clickElementByText(args: Record<string, unknown>): Promise<ToolResult> {
  const { text, tagName = "*" } = args as { text?: string; tagName?: string };

  if (!isNonEmptyString(text)) {
    return {
      content: [{ type: "text", text: cdpT("clickByText.missingText") }],
      isError: true,
    };
  }

  try {
    const result = await clickByText(text, tagName);

    if (result.success) {
      return {
        content: [
          {
            type: "text",
            text: cdpT("clickByText.success", {
              tagName: result.tagName?.toLowerCase() ?? cdpT("common.unknown"),
              textContent: result.textContent ?? cdpT("common.empty"),
            }),
          },
        ],
      };
    } else {
      return {
        content: [{ type: "text", text: cdpT("clickByText.notFound", { text, tagName }) }],
        isError: true,
      };
    }
  } catch (err) {
    return cdpError("hev_click_element_by_text", err as Error, "errors.click");
  }
}

/**
 * Fill a value into an input field
 */
export async function fillInputField(args: Record<string, unknown>): Promise<ToolResult> {
  const {
    selector,
    value,
    clear = true,
  } = args as { selector?: string; value?: string; clear?: boolean };

  if (!isNonEmptyString(selector) || value === undefined) {
    return {
      content: [{ type: "text", text: cdpT("fillInput.missingSelectorValue") }],
      isError: true,
    };
  }

  try {
    const result = await fillInput(selector, value, clear);

    if (result.success) {
      return {
        content: [
          {
            type: "text",
            text: cdpT("fillInput.success", {
              newValue: result.newValue ?? cdpT("common.empty"),
            }),
          },
        ],
      };
    } else {
      return {
        content: [{ type: "text", text: cdpT("fillInput.notFound", { selector }) }],
        isError: true,
      };
    }
  } catch (err) {
    return cdpError("hev_fill_input_field", err as Error, "errors.fillInput");
  }
}

/**
 * Retrieve the page structure (DOM tree)
 */
export async function getPageDomStructure(args: Record<string, unknown>): Promise<ToolResult> {
  const { maxDepth = 3 } = args as { maxDepth?: number };

  try {
    const structure = await getPageStructure(maxDepth);

    return {
      content: [
        {
          type: "text",
          text: cdpT("pageDomStructure.success", {
            title: String(structure["title"]),
            url: String(structure["url"]),
            body: JSON.stringify(structure["body"], null, 2),
          }),
        },
      ],
    };
  } catch (err) {
    return cdpError("hev_get_page_dom_structure", err as Error, "errors.pageDomStructure");
  }
}

/**
 * Find an element and show its details
 */
export async function inspectElement(args: Record<string, unknown>): Promise<ToolResult> {
  const { selector } = args as { selector?: string };

  if (!isNonEmptyString(selector)) {
    return {
      content: [{ type: "text", text: cdpT("inspectElement.missingSelector") }],
      isError: true,
    };
  }

  try {
    const info = await checkElement(selector);

    if (info.exists) {
      return {
        content: [
          {
            type: "text",
            text: cdpT("inspectElement.success", {
              selector: info.selector,
              tagName: info.tagName ?? cdpT("common.unknown"),
              id: info.id ?? cdpT("common.none"),
              className: info.className ?? cdpT("common.none"),
              visible: info.visible === true ? cdpT("common.yes") : cdpT("common.no"),
              disabled: info.disabled === true ? cdpT("common.yes") : cdpT("common.no"),
              width: info.bounds?.width ?? 0,
              height: info.bounds?.height ?? 0,
              x: Math.round(info.bounds?.x ?? 0),
              y: Math.round(info.bounds?.y ?? 0),
              textContent: info.textContent ?? cdpT("common.empty"),
            }),
          },
        ],
      };
    } else {
      return {
        content: [{ type: "text", text: cdpT("inspectElement.notFound", { selector }) }],
      };
    }
  } catch (err) {
    return cdpError("hev_inspect_element", err as Error, "errors.inspectElement");
  }
}

/**
 * Birden fazla elementi bul
 */
export async function queryElements(args: Record<string, unknown>): Promise<ToolResult> {
  const { selector, limit = 20 } = args as { selector?: string; limit?: number };

  if (!isNonEmptyString(selector)) {
    return {
      content: [{ type: "text", text: cdpT("queryElements.missingSelector") }],
      isError: true,
    };
  }

  try {
    const elements = await findElements(selector, limit);

    if (elements.length === 0) {
      return {
        content: [{ type: "text", text: cdpT("queryElements.noneFound", { selector }) }],
      };
    }

    const list = elements
      .map(
        (el) =>
          `${el.index}. <${el.tagName.toLowerCase()}${isNonEmptyString(el.id) ? ` id="${el.id}"` : ""}> ${el.visible ? "👁" : "🚫"} "${el.textContent ?? ""}"`
      )
      .join("\n");

    return {
      content: [
        {
          type: "text",
          text: cdpT("queryElements.success", {
            count: elements.length,
            selector,
            list,
          }),
        },
      ],
    };
  } catch (err) {
    return cdpError("hev_query_elements", err as Error, "errors.queryElements");
  }
}

/**
 * Send a keyboard key
 */
export async function sendKeyPress(args: Record<string, unknown>): Promise<ToolResult> {
  const {
    key,
    ctrl = false,
    alt = false,
    shift = false,
    meta = false,
  } = args as { key?: string; ctrl?: boolean; alt?: boolean; shift?: boolean; meta?: boolean };

  if (!isNonEmptyString(key)) {
    return {
      content: [{ type: "text", text: cdpT("sendKeyPress.missingKey") }],
      isError: true,
    };
  }

  try {
    const result = await pressKey(key, { ctrl, alt, shift, meta });

    const modifiers = [ctrl && "Ctrl", alt && "Alt", shift && "Shift", meta && "Meta"]
      .filter(Boolean)
      .join("+");

    return {
      content: [
        {
          type: "text",
          text: cdpT("sendKeyPress.success", {
            keyCombo: `${modifiers !== "" ? modifiers + "+" : ""}${key}`,
            target: result.target?.toLowerCase() ?? cdpT("common.unknown"),
          }),
        },
      ],
    };
  } catch (err) {
    return cdpError("hev_send_key_press", err as Error, "errors.keyPress");
  }
}

/**
 * Sayfada scroll yap
 */
export async function scrollPage(args: Record<string, unknown>): Promise<ToolResult> {
  const {
    x = 0,
    y = 0,
    behavior = "smooth",
  } = args as { x?: number; y?: number; behavior?: "smooth" | "instant" };

  try {
    const result = await scrollTo(x, y, behavior);

    return {
      content: [
        {
          type: "text",
          text: cdpT("scrollPage.success", {
            scrollX: result.scrollX,
            scrollY: result.scrollY,
          }),
        },
      ],
    };
  } catch (err) {
    return cdpError("hev_scroll_page", err as Error, "errors.scroll");
  }
}
