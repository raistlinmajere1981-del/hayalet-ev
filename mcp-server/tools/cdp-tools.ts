// NOTE: MCP tool handlers for CDP-driven Electron automation.

import type { ToolResult } from "../types/index-mcp.js";

import {
  checkConnection,
  discoverTargets as _discoverTargets,
  findTargetById,
  pickPreferredTarget,
  sendCDPCommand as dispatchCdpCommand,
  withTargetConnection,
} from "../utils/cdp-connection.js";
import { createMcpTranslatorSync } from "../utils/i18n/index.js";

import {
  checkElement,
  findElements,
  takeScreenshot,
  executeScript,
} from "../utils/cdp-commands.js";

import { logToolError } from "../utils/mcp-logger.js";

const COMMON_CDP_DOMAINS = [
  "Page",
  "Runtime",
  "Debugger",
  "DOM",
  "Network",
  "Console",
  "Memory",
  "Profiler",
  "Performance",
  "HeapProfiler",
];

function cdpT(key: string, params?: Record<string, string | number | boolean>): string {
  return createMcpTranslatorSync()(`mcpServer.cdpTools.${key}`, params);
}

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

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && Array.isArray(value) === false;
}

function stringifyJson(value: unknown): string {
  return JSON.stringify(value, null, 2);
}

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

export async function listCdpTargets(): Promise<ToolResult> {
  try {
    const targets = await _discoverTargets();

    if (targets.length === 0) {
      return {
        content: [{ type: "text", text: cdpT("listCdpTargets.noneFound") }],
      };
    }

    const preferredTarget = pickPreferredTarget(targets);
    const summary = targets.map((target, index) => ({
      index: index + 1,
      id: target.id,
      type: target.type,
      title: target.title === "" ? cdpT("common.empty") : target.title,
      url: target.url === "" ? cdpT("common.notAvailable") : target.url,
      connectable: target.webSocketDebuggerUrl !== "",
      isDefault: preferredTarget?.id === target.id,
    }));

    return {
      content: [
        {
          type: "text",
          text: cdpT("listCdpTargets.success", {
            count: summary.length,
            targets: stringifyJson(summary),
          }),
        },
      ],
    };
  } catch (err) {
    return cdpError("hev_list_cdp_targets", err as Error, "errors.listTargets");
  }
}

export async function getCdpTargetInfo(args: Record<string, unknown> = {}): Promise<ToolResult> {
  const { targetId } = args as { targetId?: string };

  if (isNonEmptyString(targetId) === false) {
    return {
      content: [{ type: "text", text: cdpT("getCdpTargetInfo.missingTargetId") }],
      isError: true,
    };
  }

  try {
    const target = await findTargetById(targetId);
    if (target === null) {
      return {
        content: [{ type: "text", text: cdpT("getCdpTargetInfo.notFound", { targetId }) }],
        isError: true,
      };
    }

    return {
      content: [
        {
          type: "text",
          text: cdpT("getCdpTargetInfo.success", {
            targetId: target.id,
            targetType: target.type,
            title: target.title === "" ? cdpT("common.empty") : target.title,
            url: target.url === "" ? cdpT("common.notAvailable") : target.url,
            connectable:
              target.webSocketDebuggerUrl !== "" ? cdpT("common.yes") : cdpT("common.no"),
            domains: COMMON_CDP_DOMAINS.join(", "),
          }),
        },
      ],
    };
  } catch (err) {
    return cdpError("hev_get_cdp_target_info", err as Error, "errors.targetInfo");
  }
}

export async function sendCdpCommand(args: Record<string, unknown> = {}): Promise<ToolResult> {
  const { targetId, domain, method, params, timeout } = args as {
    targetId?: string;
    domain?: string;
    method?: string;
    params?: unknown;
    timeout?: number;
  };

  if (isNonEmptyString(domain) === false || isNonEmptyString(method) === false) {
    return {
      content: [{ type: "text", text: cdpT("sendCdpCommand.missingDomainMethod") }],
      isError: true,
    };
  }

  if (params !== undefined && isRecord(params) === false) {
    return {
      content: [{ type: "text", text: cdpT("sendCdpCommand.invalidParams") }],
      isError: true,
    };
  }

  const timeoutMs =
    typeof timeout === "number" && Number.isFinite(timeout)
      ? Math.max(1_000, Math.min(120_000, Math.round(timeout)))
      : undefined;

  try {
    const result = await withTargetConnection(targetId, async (ws, target) => ({
      commandResult: await dispatchCdpCommand(ws, `${domain}.${method}`, params ?? {}, timeoutMs),
      resolvedTargetId: target.id,
    }));

    return {
      content: [
        {
          type: "text",
          text: cdpT("sendCdpCommand.success", {
            targetId: result.resolvedTargetId,
            command: `${domain}.${method}`,
            result: stringifyJson(result.commandResult),
          }),
        },
      ],
    };
  } catch (err) {
    return cdpError("hev_send_cdp_command", err as Error, "errors.cdpCommand");
  }
}

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

  const targetServers = servers.length > 0 ? servers : ["context7", "grep_app", "app"];

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

export async function takeCdpScreenshot(args: Record<string, unknown>): Promise<ToolResult> {
  const {
    format = "png",
    quality = 80,
    savePath,
  } = args as { format?: string; quality?: number; savePath?: string };

  try {
    const base64Data = await takeScreenshot(format, quality);

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
