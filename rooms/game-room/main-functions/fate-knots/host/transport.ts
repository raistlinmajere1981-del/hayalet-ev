import type { GameRoomHostApi } from "../../../shared/host/activation.js";
import { FATE_KNOTS_PAGE_ID } from "../../../shared/host/feature-meta.js";
import {
  FATE_KNOTS_AI0_MINIMAL_POLICY,
  type FateKnotsAi0RuntimeRequest,
  type FateKnotsAi0RuntimeResponse,
  validateFateKnotsAi0RuntimeResponse,
} from "../shared/ai0-runtime.js";
import {
  FATE_KNOTS_AI1_RUNTIME_POLICY,
  type FateKnotsAi1RuntimeRequest,
  type FateKnotsAi1RuntimeResponse,
  validateFateKnotsAi1RuntimeResponse,
} from "../shared/ai1-runtime.js";
import { callFateKnotsAi0RoomTool } from "./electron-bridge.js";

const FATE_KNOTS_PROVIDER_TIMEOUT_MS = 180_000;

export interface FateKnotsTransportApi extends GameRoomHostApi {
  dispatchBridge?: (options: Record<string, unknown>) => Promise<unknown>;
}

export interface FateKnotsSessionRef {
  id?: string;
  conversationId?: string;
  threadId?: string;
  openHint?: string;
}

export type FateKnotsAi0TransportResult =
  | {
      ok: true;
      response: FateKnotsAi0RuntimeResponse;
      workspacePath: string;
      port: number;
    }
  | {
      ok: false;
      code: "bridge-unavailable" | "provider-failed" | "invalid-json" | "invalid-response";
      message: string;
    };

export type FateKnotsAi1TransportResult =
  | {
      ok: true;
      response: FateKnotsAi1RuntimeResponse;
      sessionRef: FateKnotsSessionRef | null;
    }
  | {
      ok: false;
      code: "bridge-unavailable" | "provider-failed" | "invalid-json" | "invalid-response";
      message: string;
    };

export type FateKnotsAi1SessionOpenResult =
  | { ok: true; sessionRef: FateKnotsSessionRef }
  | {
      ok: false;
      code: "bridge-unavailable" | "provider-failed" | "session-missing";
      message: string;
    };

export type FateKnotsAi1JsonTransportResult =
  | { ok: true; value: Record<string, unknown>; sessionRef: FateKnotsSessionRef | null }
  | { ok: false; code: "bridge-unavailable" | "provider-failed" | "invalid-json"; message: string };

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && Array.isArray(value) === false;
}

function readNullableString(
  record: Record<string, unknown>,
  key: string
): string | null | undefined {
  const value = record[key];
  if (value === null) return null;
  if (value === undefined) return undefined;
  return typeof value === "string" ? value : undefined;
}

function stripJsonFence(text: string): string {
  const trimmed = text.trim();
  const fenced = /^```(?:json)?\s*([\s\S]*?)\s*```$/i.exec(trimmed);
  return (fenced?.[1] ?? trimmed).trim();
}

function parseJsonObject(text: string): Record<string, unknown> | null {
  const normalized = stripJsonFence(text);
  if (normalized === "") return null;
  try {
    const parsed = JSON.parse(normalized) as unknown;
    return isRecord(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

function readBridgeReplyText(value: unknown): string {
  if (!isRecord(value)) return "";
  const reply = isRecord(value["reply"]) ? value["reply"] : null;
  if (reply !== null && typeof reply["text"] === "string") {
    return reply["text"].trim();
  }
  const data = isRecord(value["data"]) ? value["data"] : null;
  const dataReply = data !== null && isRecord(data["reply"]) ? data["reply"] : null;
  if (dataReply !== null && typeof dataReply["text"] === "string") {
    return dataReply["text"].trim();
  }
  return "";
}

function readBridgeSuccess(value: unknown): boolean {
  return isRecord(value) && value["success"] === true;
}

function readBridgeMessage(value: unknown): string {
  if (!isRecord(value)) return "Provider transport failed.";
  const candidates = [value["message"], value["error"]];
  const found = candidates.find(
    (candidate): candidate is string => typeof candidate === "string" && candidate.trim() !== ""
  );
  return found?.trim() ?? "Provider transport failed.";
}

function readBridgeSessionRef(value: unknown): FateKnotsSessionRef | null {
  if (!isRecord(value) || !isRecord(value["session"])) return null;
  const source = value["session"];
  const session: FateKnotsSessionRef = {};
  for (const key of ["id", "conversationId", "threadId", "openHint"] as const) {
    const entry = source[key];
    if (typeof entry === "string" && entry.trim() !== "") {
      session[key] = entry.trim();
    }
  }
  return Object.keys(session).length > 0 ? session : null;
}

function coerceAi0Response(
  value: Record<string, unknown>,
  request: FateKnotsAi0RuntimeRequest
): FateKnotsAi0RuntimeResponse | null {
  const requestId = typeof value["requestId"] === "string" ? value["requestId"].trim() : "";
  if (requestId === "" || value["kind"] !== request.kind) return null;

  if (request.kind === "npc-dialogue") {
    const utterance = typeof value["utterance"] === "string" ? value["utterance"].trim() : "";
    if (utterance === "") return null;
    const selectedInteractionId = readNullableString(value, "selectedInteractionId");
    if (selectedInteractionId === undefined && value["selectedInteractionId"] !== undefined) {
      return null;
    }
    return {
      requestId,
      kind: "npc-dialogue",
      utterance,
      ...(selectedInteractionId !== undefined ? { selectedInteractionId } : {}),
    };
  }

  const actorId = typeof value["actorId"] === "string" ? value["actorId"].trim() : "";
  if (actorId === "") return null;
  const movementCardId = readNullableString(value, "movementCardId");
  const actionCardId = readNullableString(value, "actionCardId");
  const primaryTargetId = readNullableString(value, "primaryTargetId");
  const secondaryTargetId = readNullableString(value, "secondaryTargetId");
  const optionalKeys = [
    "movementCardId",
    "actionCardId",
    "primaryTargetId",
    "secondaryTargetId",
  ] as const;
  const optionalValues = [
    movementCardId,
    actionCardId,
    primaryTargetId,
    secondaryTargetId,
  ] as const;
  if (
    optionalValues.some(
      (entry, index) =>
        entry === undefined &&
        value[optionalKeys[index] as (typeof optionalKeys)[number]] !== undefined
    )
  ) {
    return null;
  }

  return {
    requestId,
    kind: "combat-choice",
    actorId,
    ...(movementCardId !== undefined ? { movementCardId } : {}),
    ...(actionCardId !== undefined ? { actionCardId } : {}),
    ...(primaryTargetId !== undefined ? { primaryTargetId } : {}),
    ...(secondaryTargetId !== undefined ? { secondaryTargetId } : {}),
  };
}

function coerceAi1Response(
  value: Record<string, unknown>,
  request: FateKnotsAi1RuntimeRequest
): FateKnotsAi1RuntimeResponse | null {
  const requestId = typeof value["requestId"] === "string" ? value["requestId"].trim() : "";
  const narration = typeof value["narration"] === "string" ? value["narration"].trim() : "";
  if (requestId === "" || narration === "" || value["kind"] !== request.kind) return null;
  return request.kind === "scene-narration"
    ? { requestId, kind: "scene-narration", narration }
    : { requestId, kind: "combat-result-narration", narration };
}

function buildAi0SystemPrompt(request: FateKnotsAi0RuntimeRequest): string {
  const responseContract =
    request.kind === "npc-dialogue"
      ? [
          "Return JSON with exactly: requestId, kind, utterance, and optional selectedInteractionId.",
          "kind must be npc-dialogue.",
          "selectedInteractionId must be null, omitted, or one of rolePacket.legalInteractionIds.",
        ]
      : [
          "Return JSON with exactly: requestId, kind, actorId, and optional movementCardId, actionCardId, primaryTargetId, secondaryTargetId.",
          "kind must be combat-choice.",
          "Choose only card ids and targets present in the supplied legal option lists.",
        ];
  return [FATE_KNOTS_AI0_MINIMAL_POLICY, ...responseContract].join("\n");
}

function buildAi1Prompt(request: FateKnotsAi1RuntimeRequest): string {
  return [
    FATE_KNOTS_AI1_RUNTIME_POLICY,
    "Return JSON with exactly: requestId, kind, narration.",
    `kind must be ${request.kind}.`,
    "Runtime request JSON:",
    JSON.stringify(request),
  ].join("\n");
}

export async function openFateKnotsAi1Session(
  api: FateKnotsTransportApi,
  title: string
): Promise<FateKnotsAi1SessionOpenResult> {
  if (typeof api.dispatchBridge !== "function") {
    return {
      ok: false,
      code: "bridge-unavailable",
      message: "Fate Knots AI1 SlotBridge transport is unavailable.",
    };
  }

  let result: unknown;
  try {
    result = await api.dispatchBridge({
      action: "session.open",
      toSlot: "ai1",
      payload: {
        title: title.trim() || "Fate Knots",
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

  if (!readBridgeSuccess(result)) {
    return { ok: false, code: "provider-failed", message: readBridgeMessage(result) };
  }
  const sessionRef = readBridgeSessionRef(result);
  if (sessionRef === null) {
    return {
      ok: false,
      code: "session-missing",
      message: "Fate Knots AI1 session was opened without a usable session reference.",
    };
  }
  return { ok: true, sessionRef };
}

export async function dispatchFateKnotsAi1JsonPrompt(
  api: FateKnotsTransportApi,
  prompt: string,
  options: { sessionRef?: FateKnotsSessionRef | null; timeoutMs?: number } = {}
): Promise<FateKnotsAi1JsonTransportResult> {
  if (typeof api.dispatchBridge !== "function") {
    return {
      ok: false,
      code: "bridge-unavailable",
      message: "Fate Knots AI1 SlotBridge transport is unavailable.",
    };
  }

  let rawResult: unknown;
  try {
    rawResult = await api.dispatchBridge({
      action: "message.sendWait",
      timeoutMs: options.timeoutMs ?? FATE_KNOTS_PROVIDER_TIMEOUT_MS,
      toSlot: "ai1",
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

  if (!readBridgeSuccess(rawResult)) {
    return { ok: false, code: "provider-failed", message: readBridgeMessage(rawResult) };
  }
  const parsed = parseJsonObject(readBridgeReplyText(rawResult));
  if (parsed === null) {
    return {
      ok: false,
      code: "invalid-json",
      message: "Fate Knots AI1 response was not a JSON object.",
    };
  }
  return {
    ok: true,
    value: parsed,
    sessionRef: readBridgeSessionRef(rawResult) ?? options.sessionRef ?? null,
  };
}

export async function dispatchFateKnotsAi0RuntimeRequest(
  request: FateKnotsAi0RuntimeRequest,
  universeId: string
): Promise<FateKnotsAi0TransportResult> {
  const result = await callFateKnotsAi0RoomTool({
    roomId: "game-room",
    operation: "fate-knots-ai0-call",
    requestId: request.requestId,
    universeId,
    policyText: FATE_KNOTS_AI0_MINIMAL_POLICY,
    systemPrompt: buildAi0SystemPrompt(request),
    payload: request,
    timeoutMs: FATE_KNOTS_PROVIDER_TIMEOUT_MS,
  });

  if (result.success !== true || result.fateKnotsAi0 === undefined) {
    return {
      ok: false,
      code:
        result.error?.includes("bridge is unavailable") === true
          ? "bridge-unavailable"
          : "provider-failed",
      message: result.error ?? "Fate Knots AI0 transport failed.",
    };
  }

  const parsed = parseJsonObject(result.fateKnotsAi0.text);
  if (parsed === null) {
    return {
      ok: false,
      code: "invalid-json",
      message: "Fate Knots AI0 response was not a JSON object.",
    };
  }
  const response = coerceAi0Response(parsed, request);
  if (response === null) {
    return {
      ok: false,
      code: "invalid-response",
      message: "Fate Knots AI0 response shape was invalid.",
    };
  }
  const validation = validateFateKnotsAi0RuntimeResponse(request, response);
  if (!validation.valid) {
    return {
      ok: false,
      code: "invalid-response",
      message: `Fate Knots AI0 response failed validation: ${validation.issues.map((issue) => issue.code).join(", ")}`,
    };
  }

  return {
    ok: true,
    response,
    workspacePath: result.fateKnotsAi0.workspacePath,
    port: result.fateKnotsAi0.port,
  };
}

export async function dispatchFateKnotsAi1RuntimeRequest(
  api: FateKnotsTransportApi,
  request: FateKnotsAi1RuntimeRequest,
  options: { sessionRef?: FateKnotsSessionRef | null } = {}
): Promise<FateKnotsAi1TransportResult> {
  const raw = await dispatchFateKnotsAi1JsonPrompt(api, buildAi1Prompt(request), options);
  if (!raw.ok) return raw;

  const response = coerceAi1Response(raw.value, request);
  if (response === null) {
    return {
      ok: false,
      code: "invalid-response",
      message: "Fate Knots AI1 response shape was invalid.",
    };
  }
  const validation = validateFateKnotsAi1RuntimeResponse(request, response);
  if (!validation.valid) {
    return {
      ok: false,
      code: "invalid-response",
      message: `Fate Knots AI1 response failed validation: ${validation.issues.map((issue) => issue.code).join(", ")}`,
    };
  }

  return {
    ok: true,
    response,
    sessionRef: raw.sessionRef,
  };
}
