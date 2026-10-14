import { FATE_KNOTS_PAGE_ID } from "../../../shared/host/feature-meta.js";
import type { FateKnotsForgeAuthoringProvider } from "./forge-provider-policy.js";
import {
  dispatchFateKnotsAi1JsonPrompt,
  openFateKnotsAi1Session,
  type FateKnotsAi1JsonTransportResult,
  type FateKnotsAi1SessionOpenResult,
  type FateKnotsSessionRef,
  type FateKnotsTransportApi,
} from "./transport.js";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function readBridgeSuccess(value: unknown): boolean {
  return isRecord(value) && value["success"] === true;
}

function readBridgeMessage(value: unknown): string {
  if (!isRecord(value)) return "Fate Knots Forge provider transport failed.";
  for (const candidate of [value["message"], value["error"]]) {
    if (typeof candidate === "string" && candidate.trim() !== "") return candidate.trim();
  }
  return "Fate Knots Forge provider transport failed.";
}

function readBridgeReplyText(value: unknown): string {
  if (!isRecord(value)) return "";
  const reply = isRecord(value["reply"]) ? value["reply"] : null;
  if (reply !== null && typeof reply["text"] === "string") return reply["text"].trim();
  const data = isRecord(value["data"]) ? value["data"] : null;
  const dataReply = data !== null && isRecord(data["reply"]) ? data["reply"] : null;
  return dataReply !== null && typeof dataReply["text"] === "string"
    ? dataReply["text"].trim()
    : "";
}

function readBridgeSessionRef(value: unknown): FateKnotsSessionRef | null {
  if (!isRecord(value) || !isRecord(value["session"])) return null;
  const source = value["session"];
  const session: FateKnotsSessionRef = {};
  for (const key of ["id", "conversationId", "threadId", "openHint"] as const) {
    const entry = source[key];
    if (typeof entry === "string" && entry.trim() !== "") session[key] = entry.trim();
  }
  return Object.keys(session).length > 0 ? session : null;
}

function parseJsonObject(text: string): Record<string, unknown> | null {
  const trimmed = text.trim();
  const fenced = /^```(?:json)?\s*([\s\S]*?)\s*```$/i.exec(trimmed);
  const normalized = (fenced?.[1] ?? trimmed).trim();
  if (normalized === "") return null;
  try {
    const parsed = JSON.parse(normalized) as unknown;
    return isRecord(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

/**
 * World Forge authoring deliberately uses conversational provider slots. AI2
 * remains an independent gameplay seat; choosing it here only selects which
 * provider authors this one universe before the run lifecycle exists.
 */
export async function openFateKnotsForgeProviderSession(
  api: FateKnotsTransportApi,
  provider: FateKnotsForgeAuthoringProvider,
  title: string
): Promise<FateKnotsAi1SessionOpenResult> {
  if (provider === "ai1") return await openFateKnotsAi1Session(api, title);
  if (typeof api.dispatchBridge !== "function") {
    return {
      ok: false,
      code: "bridge-unavailable",
      message: "Fate Knots AI2 SlotBridge transport is unavailable for World Forge.",
    };
  }

  let raw: unknown;
  try {
    raw = await api.dispatchBridge({
      action: "session.open",
      toSlot: provider,
      connectPolicy: "ensure",
      payload: {
        title: title.trim() || "Fate Knots World Forge",
        page: FATE_KNOTS_PAGE_ID,
      },
    });
  } catch (error) {
    return {
      ok: false,
      code: "provider-failed",
      message: error instanceof Error ? error.message : String(error),
    };
  }

  if (!readBridgeSuccess(raw)) {
    return { ok: false, code: "provider-failed", message: readBridgeMessage(raw) };
  }
  const sessionRef = readBridgeSessionRef(raw);
  if (sessionRef === null) {
    return {
      ok: false,
      code: "session-missing",
      message: "Fate Knots AI2 World Forge session opened without a usable session reference.",
    };
  }
  return { ok: true, sessionRef };
}

export async function dispatchFateKnotsForgeProviderJsonPrompt(
  api: FateKnotsTransportApi,
  provider: FateKnotsForgeAuthoringProvider,
  prompt: string,
  options: { sessionRef?: FateKnotsSessionRef | null; timeoutMs?: number } = {}
): Promise<FateKnotsAi1JsonTransportResult> {
  if (provider === "ai1") {
    return await dispatchFateKnotsAi1JsonPrompt(api, prompt, options);
  }
  if (typeof api.dispatchBridge !== "function") {
    return {
      ok: false,
      code: "bridge-unavailable",
      message: "Fate Knots AI2 SlotBridge transport is unavailable for World Forge.",
    };
  }

  let raw: unknown;
  try {
    raw = await api.dispatchBridge({
      action: "message.sendWait",
      timeoutMs: options.timeoutMs ?? 180_000,
      toSlot: provider,
      connectPolicy: "ensure",
      ...(options.sessionRef ? { sessionRef: options.sessionRef } : {}),
      payload: {
        page: FATE_KNOTS_PAGE_ID,
        text: prompt,
      },
    });
  } catch (error) {
    return {
      ok: false,
      code: "provider-failed",
      message: error instanceof Error ? error.message : String(error),
    };
  }

  if (!readBridgeSuccess(raw)) {
    return { ok: false, code: "provider-failed", message: readBridgeMessage(raw) };
  }
  const value = parseJsonObject(readBridgeReplyText(raw));
  if (value === null) {
    return {
      ok: false,
      code: "invalid-json",
      message: "Fate Knots AI2 World Forge response was not a JSON object.",
    };
  }
  return {
    ok: true,
    value,
    sessionRef: readBridgeSessionRef(raw) ?? options.sessionRef ?? null,
  };
}
