// NOTE: CDP connections execute JavaScript remotely in Electron.

import WebSocket from "ws";
import { CDP_TIMEOUTS } from "@timeouts";
import { createMcpTranslatorSync } from "./i18n/index.js";

const CDP_PORT = process.env["CDP_PORT"] ?? 9222;
const CDP_HOST = process.env["CDP_HOST"] ?? "localhost";

function cdpConnectionT(key: string, params?: Record<string, string | number | boolean>): string {
  return createMcpTranslatorSync()(`mcpServer.cdpTools.connectionErrors.${key}`, params);
}

export interface CDPTarget {
  id: string;
  type: string;
  title: string;
  url: string;
  webSocketDebuggerUrl: string;
}

interface CDPResponse {
  id?: number;
  result?: Record<string, unknown>;
  error?: { code: number; message: string };
  exceptionDetails?: {
    exception?: { description?: string };
    text?: string;
  };
}

interface EvaluateResult {
  result?: { value?: unknown };
  exceptionDetails?: {
    exception?: { description?: string };
    text?: string;
  };
}

export async function discoverTargets(): Promise<CDPTarget[]> {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => {
      controller.abort();
    }, CDP_TIMEOUTS.TARGET_DISCOVERY);

    const response = await fetch(`http://${CDP_HOST}:${CDP_PORT}/json`, {
      signal: controller.signal,
    });
    clearTimeout(timeoutId);

    if (!response.ok) {
      throw new Error(
        cdpConnectionT("httpStatus", {
          status: response.status,
          statusText: response.statusText,
        })
      );
    }
    return (await response.json()) as CDPTarget[];
  } catch (error) {
    const err = error as Error & { code?: string };

    if (err.name === "AbortError") {
      const timeoutError = new Error(
        cdpConnectionT("connectionTimeout", { port: CDP_PORT })
      ) as Error & { cause?: unknown };
      timeoutError.cause = error;
      throw timeoutError;
    }

    if (err.code === "ECONNREFUSED" || err.message.includes("ECONNREFUSED")) {
      const connectionError = new Error(
        cdpConnectionT("connectionRefused", { port: CDP_PORT })
      ) as Error & { cause?: unknown };
      connectionError.cause = error;
      throw connectionError;
    }

    if (err.message.includes("fetch failed")) {
      const fetchError = new Error(cdpConnectionT("fetchFailed", { port: CDP_PORT })) as Error & {
        cause?: unknown;
      };
      fetchError.cause = error;
      throw fetchError;
    }

    throw error;
  }
}

export function pickPreferredTarget(targets: CDPTarget[]): CDPTarget | null {
  // NOTE: Prefer a "page" target first.
  const pageTarget = targets.find((t) => t.type === "page");
  if (pageTarget) return pageTarget;

  // NOTE: Fall back to the first target if no "page" target is available.
  return targets[0] ?? null;
}

async function findMainWindow(): Promise<CDPTarget | null> {
  const targets = await discoverTargets();
  return pickPreferredTarget(targets);
}

export async function findTargetById(targetId: string): Promise<CDPTarget | null> {
  const targets = await discoverTargets();
  return targets.find((target) => target.id === targetId) ?? null;
}

export async function resolveTarget(targetId?: string): Promise<CDPTarget> {
  if (targetId !== undefined && targetId !== "") {
    const target = await findTargetById(targetId);
    if (target !== null) return target;
    throw new Error(cdpConnectionT("targetNotFound", { targetId }));
  }

  const target = await findMainWindow();
  if (target !== null) return target;
  throw new Error(cdpConnectionT("windowNotFound"));
}

async function connectToTarget(wsUrl: string): Promise<WebSocket> {
  return await new Promise((resolve, reject) => {
    let resolved = false;
    const ws = new WebSocket(wsUrl);

    ws.on("open", () => {
      if (!resolved) {
        resolved = true;
        resolve(ws);
      }
    });

    ws.on("error", (err: Error) => {
      if (!resolved) {
        resolved = true;
        reject(new Error(cdpConnectionT("websocketError", { message: err.message })));
      }
    });

    setTimeout(() => {
      if (!resolved) {
        resolved = true;
        ws.terminate();
        reject(new Error(cdpConnectionT("websocketTimeout")));
      }
    }, CDP_TIMEOUTS.WEBSOCKET_CONNECT);
  });
}

let cdpCommandId = 1;

function rawDataToText(data: WebSocket.RawData): string {
  if (typeof data === "string") return data;
  if (Buffer.isBuffer(data)) return data.toString("utf8");
  if (data instanceof ArrayBuffer) {
    return new TextDecoder().decode(new Uint8Array(data));
  }
  if (Array.isArray(data)) {
    return Buffer.concat(data).toString("utf8");
  }
  return "";
}

export async function sendCDPCommand(
  ws: WebSocket,
  method: string,
  params: Record<string, unknown> = {},
  timeout: number = CDP_TIMEOUTS.COMMAND_DEFAULT
): Promise<Record<string, unknown>> {
  return await new Promise((resolve, reject) => {
    const id = cdpCommandId++;
    const messageHandler = (data: WebSocket.RawData): void => {
      try {
        const response = JSON.parse(rawDataToText(data)) as CDPResponse;
        if (response.id === id) {
          clearTimeout(timeoutId);
          ws.off("message", messageHandler);
          if (response.error) {
            reject(new Error(cdpConnectionT("cdpError", { message: response.error.message })));
          } else {
            resolve(response.result ?? {});
          }
        }
      } catch {
        // NOTE: Ignore JSON parse errors and keep listening.
      }
    };

    const timeoutId = setTimeout(() => {
      ws.off("message", messageHandler);
      reject(new Error(cdpConnectionT("commandTimeout", { method })));
    }, timeout);

    ws.on("message", messageHandler);

    try {
      ws.send(JSON.stringify({ id, method, params }));
    } catch (e) {
      const err = e as Error;
      ws.off("message", messageHandler);
      reject(new Error(cdpConnectionT("websocketSendError", { message: err.message })));
      return;
    }
  });
}

export async function evaluateJS(
  ws: WebSocket,
  expression: string,
  awaitPromise = true,
  timeout?: number
): Promise<unknown> {
  const result = (await sendCDPCommand(
    ws,
    "Runtime.evaluate",
    {
      expression,
      awaitPromise,
      returnByValue: true,
    },
    timeout
  )) as EvaluateResult;

  if (result.exceptionDetails) {
    throw new Error(
      cdpConnectionT("javascriptError", {
        message:
          result.exceptionDetails.exception?.description ??
          result.exceptionDetails.text ??
          cdpConnectionT("unknown"),
      })
    );
  }

  return result.result?.value;
}

export async function withConnection<T>(action: (ws: WebSocket) => Promise<T>): Promise<T> {
  return await withTargetConnection(undefined, async (ws) => await action(ws));
}

export async function withTargetConnection<T>(
  targetId: string | undefined,
  action: (ws: WebSocket, target: CDPTarget) => Promise<T>,
  options: { enableRuntime?: boolean } = {}
): Promise<T> {
  const target = await resolveTarget(targetId);

  if (target.webSocketDebuggerUrl === "") {
    throw new Error(cdpConnectionT("targetMissingWebSocket", { targetId: target.id }));
  }

  const ws = await connectToTarget(target.webSocketDebuggerUrl);

  try {
    if (options.enableRuntime !== false) {
      await sendCDPCommand(ws, "Runtime.enable");
    }
    return await action(ws, target);
  } finally {
    ws.close();
  }
}

interface ConnectionStatus {
  connected: boolean;
  port: string | number;
  targetsCount?: number;
  mainWindow?: {
    title: string;
    url: string;
    type: string;
  } | null;
  error?: string;
}

export async function checkConnection(): Promise<ConnectionStatus> {
  try {
    const targets = await discoverTargets();
    const mainWindow = targets.find((t) => t.type === "page");

    return {
      connected: true,
      port: CDP_PORT,
      targetsCount: targets.length,
      mainWindow: mainWindow
        ? {
            title: mainWindow.title,
            url: mainWindow.url,
            type: mainWindow.type,
          }
        : null,
    };
  } catch (error) {
    const err = error as Error;
    return {
      connected: false,
      port: CDP_PORT,
      error: err.message,
    };
  }
}
