import { generateUniqueId } from "../../constants/index.js";
import {
  getErrorMessage,
  type CommandPayload,
  type CommandProvider,
  type SlotBridgeAction,
  type SlotBridgeAttachmentDescriptor,
  type SlotBridgeConnectPolicy,
  type SlotBridgeEnvelope,
  type SlotBridgeProtocolDescriptor,
  type SlotBridgeReply,
  type SlotBridgeResult,
  type SlotBridgeSessionRef,
} from "@shared/index.js";
import { AppState } from "../app-state.js";
import { resolveComposedProtocolMessage } from "../protocol-message-composer.js";
import { ProtocolHandler } from "../protocol-handler.js";
import { RoomCommandRegistry } from "../rooms/room-command-registry.js";
import { SlotController } from "../slot-controller.js";
import { TrafficManager } from "../traffic-manager.js";
import { replaceProtocolTagsWithResolver } from "../../../../shared/protocol-tags.js";
import { getSlotBridgeCoreEngine, type SlotBridgeCoreEngineRef } from "./slot-bridge-runtime.js";

export const SLOT_BRIDGE_COMMAND_NAME = "SlotBridge";

export const SLOT_BRIDGE_ACTIONS = [
  "message.send",
  "message.sendWait",
  "message.sendWithAttachments",
  "file.send",
  "connection.ensure",
  "session.open",
  "session.switch",
  "room.command",
] as const satisfies readonly SlotBridgeAction[];

export type SlotBridgeActionKey = (typeof SLOT_BRIDGE_ACTIONS)[number];
export type SlotBridgeActionCategory = "ai0" | "ai1-ai2" | "us1";

interface SlotBridgeConversationListManagerRef {
  refresh(options: { silent?: boolean; forceSelectId?: string; provider?: string }): Promise<void>;
  updateSelection(
    conversationId: string,
    options?: { silent?: boolean; provider?: string | null }
  ): boolean;
}

interface SlotBridgeWebviewRef {
  executeJavaScript(script: string): Promise<unknown>;
}

interface SlotBridgeWebviewManagerRef {
  syncProvider(provider: string, opts?: Record<string, unknown>): Promise<unknown>;
  resolveWebview(provider: string): SlotBridgeWebviewRef | null;
}

const SLOT_BRIDGE_ACTION_SET = new Set<string>(SLOT_BRIDGE_ACTIONS);
const SLOT_BRIDGE_TIMEOUT_MS = 45_000;

const SLOT_BRIDGE_ACTION_CATEGORIES: Record<SlotBridgeActionKey, SlotBridgeActionCategory[]> = {
  "message.send": ["ai0", "ai1-ai2", "us1"],
  "message.sendWait": ["ai0", "ai1-ai2", "us1"],
  "message.sendWithAttachments": ["ai0", "ai1-ai2", "us1"],
  "file.send": ["ai0", "ai1-ai2", "us1"],
  "connection.ensure": ["ai0", "ai1-ai2"],
  "session.open": ["ai0", "ai1-ai2"],
  "session.switch": ["ai0", "ai1-ai2", "us1"],
  "room.command": ["ai0", "ai1-ai2", "us1"],
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && Array.isArray(value) === false;
}

function normalizeSlotBridgeAction(value: unknown): SlotBridgeActionKey | null {
  if (typeof value !== "string") {
    return null;
  }
  const normalized = value.trim();
  return SLOT_BRIDGE_ACTION_SET.has(normalized) ? (normalized as SlotBridgeActionKey) : null;
}

export function getSlotBridgeAction(value: unknown): SlotBridgeActionKey | null {
  return normalizeSlotBridgeAction(value);
}

export function getSlotBridgeActionCategories(
  action: SlotBridgeActionKey
): SlotBridgeActionCategory[] {
  return SLOT_BRIDGE_ACTION_CATEGORIES[action];
}

function normalizeCommandProvider(value: unknown): CommandProvider | null {
  if (typeof value !== "string") {
    return null;
  }
  const normalized = value.trim();
  return normalized === "ai0" ||
    normalized === "ai1" ||
    normalized === "ai2" ||
    normalized === "room-ui" ||
    normalized === "us1" ||
    normalized === "user" ||
    normalized === "system"
    ? normalized
    : null;
}

function normalizeSlotId(value: unknown): "ai0" | "ai1" | "ai2" | null {
  return value === "ai0" || value === "ai1" || value === "ai2" ? value : null;
}

function normalizeMessageTarget(value: unknown): "ai0" | "ai1" | "ai2" | "us1" | null {
  return value === "us1" ? "us1" : normalizeSlotId(value);
}

function readCommandProviderArray(value: unknown): CommandProvider[] {
  if (!Array.isArray(value)) {
    return [];
  }

  const next: CommandProvider[] = [];
  value.forEach((item) => {
    const normalized = normalizeCommandProvider(item);
    if (normalized !== null && next.includes(normalized) !== true) {
      next.push(normalized);
    }
  });
  return next;
}

function normalizeConnectPolicy(value: unknown, force: boolean): SlotBridgeConnectPolicy {
  if (value === "never" || value === "ensure" || value === "require-ready") {
    return value;
  }
  return force ? "ensure" : "never";
}

function readTimeoutMs(value: unknown, fallback = SLOT_BRIDGE_TIMEOUT_MS): number {
  if (typeof value !== "number" || Number.isFinite(value) !== true) {
    return fallback;
  }
  return Math.max(1_000, Math.trunc(value));
}

function parseJsonRecord(value: string): Record<string, unknown> | null {
  const trimmed = value.trim();
  if (trimmed === "") {
    return null;
  }

  try {
    const parsed = JSON.parse(trimmed) as unknown;
    return isRecord(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

function readSessionRef(value: unknown): SlotBridgeSessionRef | null {
  if (!isRecord(value)) {
    return null;
  }

  const id = typeof value["id"] === "string" ? value["id"].trim() : "";
  const conversationId =
    typeof value["conversationId"] === "string" ? value["conversationId"].trim() : "";
  const threadId = typeof value["threadId"] === "string" ? value["threadId"].trim() : "";
  const openHint = typeof value["openHint"] === "string" ? value["openHint"].trim() : "";

  if (id === "" && conversationId === "" && threadId === "" && openHint === "") {
    return null;
  }

  return {
    ...(id !== "" ? { id } : {}),
    ...(conversationId !== "" ? { conversationId } : {}),
    ...(threadId !== "" ? { threadId } : {}),
    ...(openHint !== "" ? { openHint } : {}),
  };
}

function toAttachmentDescriptor(value: unknown): SlotBridgeAttachmentDescriptor | null {
  if (!isRecord(value)) {
    return null;
  }

  const name =
    typeof value["name"] === "string" && value["name"].trim() !== "" ? value["name"].trim() : "";
  if (name === "") {
    return null;
  }

  const kind =
    value["kind"] === "attachment-ref" ||
    value["kind"] === "filesystem" ||
    value["kind"] === "archive-attachment" ||
    value["kind"] === "generated-image"
      ? value["kind"]
      : undefined;
  const ref = typeof value["ref"] === "string" ? value["ref"].trim() : "";
  const path = typeof value["path"] === "string" ? value["path"].trim() : "";
  const url = typeof value["url"] === "string" ? value["url"].trim() : "";
  const archivePath = typeof value["archivePath"] === "string" ? value["archivePath"].trim() : "";
  const mimeType = typeof value["mimeType"] === "string" ? value["mimeType"].trim() : "";
  const sourceSlot = normalizeSlotId(value["sourceSlot"]);
  const conversationId =
    typeof value["conversationId"] === "string" ? value["conversationId"].trim() : "";
  const messageId = typeof value["messageId"] === "string" ? value["messageId"].trim() : "";
  const size =
    typeof value["size"] === "number" && Number.isFinite(value["size"]) ? value["size"] : undefined;

  return {
    name,
    ...(kind !== undefined ? { kind } : {}),
    ...(ref !== "" ? { ref } : {}),
    ...(path !== "" ? { path } : {}),
    ...(url !== "" ? { url } : {}),
    ...(archivePath !== "" ? { archivePath } : {}),
    ...(mimeType !== "" ? { mimeType } : {}),
    ...(sourceSlot !== null ? { sourceSlot } : {}),
    ...(conversationId !== "" ? { conversationId } : {}),
    ...(messageId !== "" ? { messageId } : {}),
    ...(size !== undefined ? { size } : {}),
  };
}

function readAttachments(value: unknown): SlotBridgeAttachmentDescriptor[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.flatMap((item) => {
    const descriptor = toAttachmentDescriptor(item);
    return descriptor !== null ? [descriptor] : [];
  });
}

function readProtocolDescriptor(envelope: SlotBridgeEnvelope): SlotBridgeProtocolDescriptor | null {
  const actionPayload = isRecord(envelope.payload) ? envelope.payload : {};
  const protocolPayload = isRecord(actionPayload["protocol"]) ? actionPayload["protocol"] : {};
  const source = Object.keys(protocolPayload).length > 0 ? protocolPayload : actionPayload;

  const room =
    typeof source["room"] === "string" && source["room"].trim() !== "" ? source["room"].trim() : "";
  const scenario =
    typeof source["scenario"] === "string" && source["scenario"].trim() !== ""
      ? source["scenario"].trim()
      : "";
  const protocolKey =
    typeof source["protocolKey"] === "string" && source["protocolKey"].trim() !== ""
      ? source["protocolKey"].trim()
      : "";
  const fallbackTitle =
    typeof source["fallbackTitle"] === "string" && source["fallbackTitle"].trim() !== ""
      ? source["fallbackTitle"].trim()
      : typeof source["title"] === "string" && source["title"].trim() !== ""
        ? source["title"].trim()
        : "";
  const preface =
    typeof source["preface"] === "string" && source["preface"].trim() !== ""
      ? source["preface"].trim()
      : null;
  const textPosition =
    source["textPosition"] === "before" ||
    source["textPosition"] === "after" ||
    source["textPosition"] === "replace"
      ? source["textPosition"]
      : undefined;
  const context = isRecord(source["context"]) ? source["context"] : null;

  if (
    room === "" &&
    scenario === "" &&
    protocolKey === "" &&
    fallbackTitle === "" &&
    preface === null
  ) {
    return null;
  }

  return {
    ...(room !== "" ? { room } : {}),
    ...(scenario !== "" ? { scenario } : {}),
    ...(protocolKey !== "" ? { protocolKey } : {}),
    ...(fallbackTitle !== "" ? { fallbackTitle } : {}),
    ...(preface !== null ? { preface } : {}),
    ...(context !== null ? { context } : {}),
    ...(textPosition !== undefined ? { textPosition } : {}),
  };
}

function hasEnvelopeKeys(source: Record<string, unknown>): boolean {
  const envelopeKeys = [
    "action",
    "payload",
    "toSlot",
    "toSlots",
    "target",
    "targets",
    "replyToSlot",
    "delivery",
    "wait",
    "timeoutMs",
    "force",
    "connectPolicy",
    "sessionRef",
    "session",
    "attachments",
  ];
  return envelopeKeys.some((key) => key in source);
}

function buildActionPayload(
  source: Record<string, unknown>,
  fallback: Record<string, unknown>,
  rawArgs = ""
): Record<string, unknown> {
  if (Object.keys(fallback).length > 0 && hasEnvelopeKeys(source) === false) {
    return {
      ...fallback,
      ...(rawArgs.trim() !== "" && typeof fallback["rawArgs"] !== "string"
        ? { rawArgs: rawArgs.trim() }
        : {}),
    };
  }

  if (isRecord(source["payload"])) {
    const nestedPayload = source["payload"];
    return {
      ...fallback,
      ...nestedPayload,
      ...(rawArgs.trim() !== "" && typeof nestedPayload["rawArgs"] !== "string"
        ? { rawArgs: rawArgs.trim() }
        : {}),
    };
  }

  const knownKeys = new Set([
    "version",
    "reqId",
    "action",
    "fromSlot",
    "toSlot",
    "replyToSlot",
    "delivery",
    "wait",
    "timeoutMs",
    "force",
    "connectPolicy",
    "sessionRef",
    "session",
    "attachments",
  ]);

  const derived = Object.entries(source).reduce<Record<string, unknown>>((acc, [key, value]) => {
    if (knownKeys.has(key)) {
      return acc;
    }
    acc[key] = value;
    return acc;
  }, {});

  return Object.keys(derived).length > 0 ? { ...fallback, ...derived } : fallback;
}

function buildTopLevelActionPayload(payload: CommandPayload = {}): Record<string, unknown> {
  const knownKeys = new Set([
    "version",
    "reqId",
    "action",
    "fromSlot",
    "toSlot",
    "replyToSlot",
    "delivery",
    "wait",
    "timeoutMs",
    "force",
    "connectPolicy",
    "sessionRef",
    "session",
    "attachments",
    "payload",
    "args",
    "provider",
    "source",
    "target",
    "targets",
    "message",
  ]);

  return Object.entries(payload).reduce<Record<string, unknown>>((acc, [key, value]) => {
    if (knownKeys.has(key)) {
      return acc;
    }
    acc[key] = value;
    return acc;
  }, {});
}

function normalizeEnvelope(payload: CommandPayload = {}): SlotBridgeEnvelope {
  const parsedArgs = parseJsonRecord(typeof payload.args === "string" ? payload.args : "") ?? {};
  const directPayload = isRecord(payload["payload"]) ? payload["payload"] : {};
  const fallbackPayload = {
    ...buildTopLevelActionPayload(payload),
    ...directPayload,
  };
  const rawSessionRef =
    parsedArgs["sessionRef"] ??
    parsedArgs["session"] ??
    payload["sessionRef"] ??
    payload["session"] ??
    null;
  const fromSlot =
    normalizeCommandProvider(parsedArgs["fromSlot"]) ??
    normalizeCommandProvider(payload["fromSlot"]) ??
    normalizeCommandProvider(payload.provider) ??
    normalizeCommandProvider(payload.source) ??
    "system";
  const toSlot =
    normalizeCommandProvider(parsedArgs["toSlot"]) ??
    normalizeCommandProvider(parsedArgs["target"]) ??
    normalizeCommandProvider(payload["toSlot"]) ??
    normalizeCommandProvider(payload["target"]) ??
    null;
  const replyToSlot =
    normalizeCommandProvider(parsedArgs["replyToSlot"]) ??
    normalizeCommandProvider(payload["replyToSlot"]) ??
    fromSlot;
  const toSlots = readCommandProviderArray(
    parsedArgs["toSlots"] ??
      parsedArgs["targets"] ??
      payload["toSlots"] ??
      payload["targets"] ??
      directPayload["toSlots"] ??
      directPayload["targets"]
  );
  const force = parsedArgs["force"] === true || payload["force"] === true;
  const action =
    normalizeSlotBridgeAction(parsedArgs["action"]) ??
    normalizeSlotBridgeAction(payload["action"]) ??
    "message.send";

  return {
    version:
      typeof parsedArgs["version"] === "number" && Number.isFinite(parsedArgs["version"])
        ? Math.trunc(parsedArgs["version"])
        : typeof payload["version"] === "number" && Number.isFinite(payload["version"])
          ? Math.trunc(payload["version"])
          : 1,
    reqId:
      typeof parsedArgs["reqId"] === "string" && parsedArgs["reqId"].trim() !== ""
        ? parsedArgs["reqId"].trim()
        : typeof payload["reqId"] === "string" && payload["reqId"].trim() !== ""
          ? payload["reqId"].trim()
          : generateUniqueId("slotbridge"),
    action,
    fromSlot,
    toSlot,
    ...(toSlots.length > 0 ? { toSlots } : {}),
    replyToSlot,
    delivery:
      parsedArgs["delivery"] === "sync" || parsedArgs["delivery"] === "async"
        ? parsedArgs["delivery"]
        : action === "message.sendWait"
          ? "sync"
          : "async",
    wait: parsedArgs["wait"] === true || action === "message.sendWait",
    timeoutMs: readTimeoutMs(parsedArgs["timeoutMs"] ?? payload["timeoutMs"]),
    force,
    connectPolicy: normalizeConnectPolicy(parsedArgs["connectPolicy"], force),
    sessionRef: readSessionRef(rawSessionRef),
    payload: buildActionPayload(
      parsedArgs,
      fallbackPayload,
      typeof payload.args === "string" ? payload.args : ""
    ),
    attachments: readAttachments(parsedArgs["attachments"] ?? payload.attachments),
  };
}

function buildResult(
  envelope: SlotBridgeEnvelope,
  partial: Partial<SlotBridgeResult> = {}
): SlotBridgeResult {
  const success = partial.success !== false;
  const result: SlotBridgeResult = {
    success,
    ok: success,
    reply: partial.reply ?? null,
    session: partial.session ?? envelope.sessionRef ?? null,
    artifacts: partial.artifacts ?? [],
  };
  if (typeof envelope.reqId === "string" && envelope.reqId !== "") {
    result.reqId = envelope.reqId;
  }
  if (partial.code !== undefined) {
    result.code = partial.code;
  }
  if (partial.message !== undefined) {
    result.message = partial.message;
  }
  if (partial.error !== undefined) {
    result.error = partial.error;
  }
  if (partial.data !== undefined) {
    result.data = partial.data;
  }
  return result;
}

function buildErrorResult(
  envelope: SlotBridgeEnvelope,
  code: string,
  message: string,
  detail?: unknown
): SlotBridgeResult {
  return buildResult(envelope, {
    success: false,
    code,
    message,
    ...(detail !== undefined ? { error: getErrorMessage(detail) } : {}),
  });
}

function readActionText(envelope: SlotBridgeEnvelope, payload: CommandPayload): string {
  const actionPayload = isRecord(envelope.payload) ? envelope.payload : {};
  const candidates = [
    actionPayload["text"],
    actionPayload["message"],
    payload["text"],
    payload["message"],
  ];
  for (const candidate of candidates) {
    if (typeof candidate === "string" && candidate.trim() !== "") {
      return candidate.trim();
    }
  }
  return "";
}

function replaceProtocolTags(text: string): string {
  return replaceProtocolTagsWithResolver(text, (provider) => AppState.getNickname(provider));
}

async function resolveProtocolActionText(envelope: SlotBridgeEnvelope): Promise<string> {
  const protocol = readProtocolDescriptor(envelope);
  if (protocol === null) {
    return "";
  }

  const descriptor = ProtocolHandler.resolveDescriptor({
    context: protocol.context ?? {},
    fallbackTitle: protocol.fallbackTitle ?? "",
    ...(protocol.room !== undefined ? { room: protocol.room } : {}),
    ...(protocol.scenario !== undefined ? { scenario: protocol.scenario } : {}),
    ...(protocol.protocolKey !== undefined ? { protocolKey: protocol.protocolKey } : {}),
  });
  if (descriptor === null) {
    return "";
  }

  const resolved = await resolveComposedProtocolMessage({
    fallbackTitle: descriptor.fallbackTitle,
    ...(descriptor.protocolKey !== undefined ? { protocolKey: descriptor.protocolKey } : {}),
    ...(protocol.preface !== undefined ? { preface: protocol.preface } : {}),
  });
  return replaceProtocolTags(resolved.message);
}

function mergeActionText(
  text: string,
  protocolText: string,
  textPosition: SlotBridgeProtocolDescriptor["textPosition"] = "after"
): string {
  const plain = text.trim();
  const protocol = protocolText.trim();
  if (protocol === "") {
    return plain;
  }
  if (plain === "" || textPosition === "replace") {
    return protocol;
  }
  return textPosition === "before" ? `${plain}\n\n${protocol}` : `${protocol}\n\n${plain}`;
}

async function composeActionText(
  envelope: SlotBridgeEnvelope,
  payload: CommandPayload
): Promise<string> {
  const protocol = readProtocolDescriptor(envelope);
  const plainText = readActionText(envelope, payload);
  if (protocol === null) {
    return plainText;
  }

  const protocolText = await resolveProtocolActionText(envelope);
  return mergeActionText(plainText, protocolText, protocol.textPosition ?? "after");
}

function readActionPage(envelope: SlotBridgeEnvelope, payload: CommandPayload): string {
  const actionPayload = isRecord(envelope.payload) ? envelope.payload : {};
  const candidates = [actionPayload["page"], payload["page"]];
  for (const candidate of candidates) {
    if (typeof candidate === "string" && candidate.trim() !== "") {
      return candidate.trim();
    }
  }
  return `slot-bridge:${envelope.action}`;
}

function buildRequestMarker(reqId: string | undefined): string {
  const normalizedReqId = typeof reqId === "string" ? reqId.trim() : "";
  return normalizedReqId !== "" ? `<!-- hev-req:${normalizedReqId} -->` : "";
}

function appendRequestMarker(text: string, envelope: SlotBridgeEnvelope): string {
  const marker = buildRequestMarker(envelope.reqId);
  if (marker === "") {
    return text;
  }
  if (text.includes(marker)) {
    return text;
  }
  return text !== "" ? `${text}\n${marker}` : marker;
}

async function sleep(ms: number): Promise<void> {
  await new Promise<void>((resolve) => {
    window.setTimeout(resolve, ms);
  });
}

export const slotBridgeRuntime = {
  getConversationListManager: async (): Promise<SlotBridgeConversationListManagerRef> => {
    const module = await import("../conversation-list-manager.js");
    return module.ConversationListManager;
  },
  getCoreEngine: async (): Promise<SlotBridgeCoreEngineRef> => {
    const coreEngine = await Promise.resolve(getSlotBridgeCoreEngine());
    return coreEngine;
  },
  getWebviewManager: async (): Promise<SlotBridgeWebviewManagerRef> => {
    const module = await import("../webview-manager.js");
    return module.WebviewManager;
  },
};

async function getConversationListManager(): Promise<SlotBridgeConversationListManagerRef> {
  return await slotBridgeRuntime.getConversationListManager();
}

async function getCoreEngine(): Promise<SlotBridgeCoreEngineRef> {
  return await slotBridgeRuntime.getCoreEngine();
}

async function getWebviewManager(): Promise<SlotBridgeWebviewManagerRef> {
  return await slotBridgeRuntime.getWebviewManager();
}

type UnifiedMessageTarget = "ai0" | "ai1" | "ai2" | "us1";

type ReplyTrafficState = {
  loading: string;
  send: string;
  thinking: string;
};

type ResolvedSendAttachment = {
  name: string;
  path: string;
  mimeType?: string;
};

function readMessageTargets(envelope: SlotBridgeEnvelope): UnifiedMessageTarget[] {
  const direct = normalizeMessageTarget(envelope.toSlot);
  const list = (envelope.toSlots ?? [])
    .map((item) => normalizeMessageTarget(item))
    .filter((item): item is UnifiedMessageTarget => item !== null);
  const next = direct !== null ? [direct, ...list] : [...list];
  return next.filter((item, index) => next.indexOf(item) === index);
}

function isAiMessageTarget(target: UnifiedMessageTarget): target is "ai0" | "ai1" | "ai2" {
  return target === "ai0" || target === "ai1" || target === "ai2";
}

function readReplyTrafficState(targetSlot: UnifiedMessageTarget): ReplyTrafficState {
  if (!isAiMessageTarget(targetSlot)) {
    return {
      loading: "idle",
      send: "idle",
      thinking: "idle",
    };
  }

  const state = TrafficManager.getState(targetSlot);
  return {
    loading: state?.status.loading ?? "idle",
    send: state?.status.send ?? "idle",
    thinking: state?.status.thinking ?? "idle",
  };
}

function hasBusyReplyTraffic(targetSlot: UnifiedMessageTarget): boolean {
  const state = readReplyTrafficState(targetSlot);
  return state.loading === "busy" || state.send === "busy" || state.thinking === "busy";
}

type StructuredReplyState = "none" | "partial" | "complete";

function readStructuredReplyBody(text: string): { body: string; structured: boolean } {
  const trimmed = text.trim();
  if (trimmed === "") {
    return { body: "", structured: false };
  }

  const withoutJsonPrefix = trimmed.replace(/^json\b\s*/i, "").trimStart();
  if (withoutJsonPrefix.startsWith("```")) {
    const fencedBodyMatch = /^```(?:json)?\s*([\s\S]*?)\s*```$/i.exec(withoutJsonPrefix);
    if (fencedBodyMatch === null) {
      return { body: withoutJsonPrefix, structured: true };
    }
    const fencedBody = fencedBodyMatch[1] ?? "";
    return { body: fencedBody.trim(), structured: true };
  }

  return {
    body: withoutJsonPrefix,
    structured: withoutJsonPrefix.startsWith("{") || withoutJsonPrefix.startsWith("["),
  };
}

function findStructuredReplyBoundary(text: string): number | null {
  const startChar = text.charAt(0);
  if (startChar !== "{" && startChar !== "[") {
    return null;
  }

  let braceDepth = startChar === "{" ? 1 : 0;
  let bracketDepth = startChar === "[" ? 1 : 0;
  let inString = false;
  let escapeNext = false;

  for (let index = 1; index < text.length; index += 1) {
    const char = text.charAt(index);
    if (escapeNext) {
      escapeNext = false;
      continue;
    }

    if (inString) {
      if (char === "\\") {
        escapeNext = true;
      } else if (char === "\"") {
        inString = false;
      }
      continue;
    }

    if (char === "\"") {
      inString = true;
      continue;
    }

    if (char === "{") {
      braceDepth += 1;
      continue;
    }

    if (char === "}") {
      braceDepth -= 1;
      if (braceDepth < 0) {
        return null;
      }
    } else if (char === "[") {
      bracketDepth += 1;
    } else if (char === "]") {
      bracketDepth -= 1;
      if (bracketDepth < 0) {
        return null;
      }
    }

    if (braceDepth === 0 && bracketDepth === 0 && inString === false) {
      return index + 1;
    }
  }

  return null;
}

function readStructuredReplyState(text: string): StructuredReplyState {
  const { body, structured } = readStructuredReplyBody(text);
  if (!structured) {
    return "none";
  }

  const normalized = body.trim();
  if (normalized === "") {
    return "partial";
  }

  try {
    JSON.parse(normalized);
    return "complete";
  } catch {
    const boundary = findStructuredReplyBoundary(normalized);
    return boundary === null ? "partial" : "complete";
  }
}

function isSameReplySnapshot(left: SlotBridgeReply | null, right: SlotBridgeReply | null): boolean {
  if (left === null || right === null) {
    return false;
  }

  if (left.messageId !== right.messageId) {
    return false;
  }

  if ((left.text ?? "").trim() !== (right.text ?? "").trim()) {
    return false;
  }

  const leftAttachments = left.attachments ?? [];
  const rightAttachments = right.attachments ?? [];
  if (leftAttachments.length !== rightAttachments.length) {
    return false;
  }

  return leftAttachments.every((attachment, index) => {
    const other = rightAttachments[index];
    return (
      other !== undefined &&
      attachment.name === other.name &&
      attachment.path === other.path &&
      attachment.archivePath === other.archivePath
    );
  });
}

function getElectronApi():
  | {
      us1SendMessage?: (params: Record<string, unknown>) => Promise<unknown>;
      us1SyncMessages?: (params?: Record<string, unknown>) => Promise<unknown>;
      dbGetMessages?: (query: Record<string, unknown>) => Promise<unknown>;
      dbGetAttachments?: (query: Record<string, unknown>) => Promise<unknown>;
    }
  | undefined {
  return window.electronAPI as
    | {
        us1SendMessage?: (params: Record<string, unknown>) => Promise<unknown>;
        us1SyncMessages?: (params?: Record<string, unknown>) => Promise<unknown>;
        dbGetMessages?: (query: Record<string, unknown>) => Promise<unknown>;
        dbGetAttachments?: (query: Record<string, unknown>) => Promise<unknown>;
      }
    | undefined;
}

async function ensureConnected(
  slot: "ai0" | "ai1" | "ai2",
  envelope: SlotBridgeEnvelope
): Promise<{ success: boolean; message?: string }> {
  if (SlotController.isConnected(slot) === true) {
    return { success: true };
  }

  if (envelope.connectPolicy === "ensure") {
    const coreEngine = await getCoreEngine();
    return await coreEngine.setConnection(slot, true, { force: envelope.force === true });
  }

  if (envelope.connectPolicy === "require-ready") {
    return { success: false, message: `${slot.toUpperCase()} is not ready` };
  }

  return { success: false, message: `${slot.toUpperCase()} is offline` };
}

async function ensureMessageTarget(
  target: UnifiedMessageTarget,
  envelope: SlotBridgeEnvelope
): Promise<{ success: boolean; message?: string }> {
  if (target === "us1") {
    return AppState.isUs1Connected() === true
      ? { success: true }
      : { success: false, message: "US1 is offline" };
  }

  return await ensureConnected(target, envelope);
}

interface NormalizedReplyMessage {
  id: string;
  role: string;
  text: string;
  author?: string;
}

function normalizeReplyMessage(value: unknown): NormalizedReplyMessage | null {
  if (!isRecord(value)) {
    return null;
  }

  const id = typeof value["id"] === "string" ? value["id"].trim() : "";
  const role = typeof value["role"] === "string" ? value["role"].trim() : "";
  if (id === "" || role === "") {
    return null;
  }

  const textCandidates = [value["text"], value["content"]];
  const text = textCandidates
    .find((candidate): candidate is string => typeof candidate === "string")
    ?.trim();
  const author = typeof value["author"] === "string" ? value["author"].trim() : "";

  return {
    id,
    role,
    text: text ?? "",
    ...(author !== "" ? { author } : {}),
  };
}

async function listConversationMessages(
  slot: UnifiedMessageTarget,
  conversationId: string | null
): Promise<NormalizedReplyMessage[]> {
  const accountId = AppState.getArchiveAccountIdForProvider(slot);
  if (accountId === null || conversationId === null || conversationId === "") {
    return [];
  }

  const electronApi = getElectronApi();
  if (electronApi === undefined) {
    return [];
  }

  const dbGetMessages = electronApi.dbGetMessages;
  if (typeof dbGetMessages !== "function") {
    return [];
  }

  const raw = await dbGetMessages({
    accountId,
    conversationId,
  });
  const rows = isRecord(raw) && Array.isArray(raw["data"]) ? raw["data"] : [];
  return rows.flatMap((row) => {
    const normalized = normalizeReplyMessage(row);
    return normalized !== null ? [normalized] : [];
  });
}

function normalizeReplyAttachment(value: unknown): SlotBridgeAttachmentDescriptor | null {
  if (!isRecord(value)) {
    return null;
  }

  const messageId =
    typeof value["messageId"] === "string"
      ? value["messageId"].trim()
      : typeof value["message_id"] === "string"
        ? value["message_id"].trim()
        : "";
  if (messageId === "") {
    return null;
  }

  const originalName =
    typeof value["originalName"] === "string"
      ? value["originalName"].trim()
      : typeof value["original_name"] === "string"
        ? value["original_name"].trim()
        : "";
  if (originalName === "") {
    return null;
  }

  const storedPath =
    typeof value["storedPath"] === "string"
      ? value["storedPath"].trim()
      : typeof value["stored_path"] === "string"
        ? value["stored_path"].trim()
        : "";
  const mimeType =
    typeof value["mimeType"] === "string"
      ? value["mimeType"].trim()
      : typeof value["mime_type"] === "string"
        ? value["mime_type"].trim()
        : "";
  const storedName =
    typeof value["storedName"] === "string"
      ? value["storedName"].trim()
      : typeof value["stored_name"] === "string"
        ? value["stored_name"].trim()
        : "";
  const size =
    typeof value["size"] === "number" && Number.isFinite(value["size"]) ? value["size"] : undefined;

  return {
    name: originalName,
    kind: mimeType.startsWith("image/") ? "generated-image" : "archive-attachment",
    messageId,
    ...(storedPath !== "" ? { archivePath: storedPath, path: storedPath } : {}),
    ...(mimeType !== "" ? { mimeType } : {}),
    ...(storedName !== "" ? { id: storedName } : {}),
    ...(size !== undefined ? { size } : {}),
  };
}

async function listConversationAttachments(
  slot: UnifiedMessageTarget,
  conversationId: string | null
): Promise<SlotBridgeAttachmentDescriptor[]> {
  const accountId = AppState.getArchiveAccountIdForProvider(slot);
  if (accountId === null || conversationId === null || conversationId === "") {
    return [];
  }

  const raw = await getElectronApi()?.["dbGetAttachments"]?.({
    accountId,
    conversationId,
  });
  const rows = Array.isArray((raw as { data?: unknown[] } | undefined)?.data)
    ? ((raw as { data?: unknown[] }).data ?? [])
    : [];
  return rows.flatMap((row) => {
    const normalized = normalizeReplyAttachment(row);
    return normalized !== null ? [normalized] : [];
  });
}

async function readLatestArchivedReply(
  slot: UnifiedMessageTarget,
  conversationId: string | null,
  reqId?: string
): Promise<SlotBridgeReply | null> {
  const messages = await listConversationMessages(slot, conversationId);
  const marker = buildRequestMarker(reqId);
  const requestIndex =
    marker !== ""
      ? [...messages]
          .map((message, index) =>
            message.role === "user" && message.text.includes(marker) ? index : -1
          )
          .reduce(
            (latestIndex, currentIndex) =>
              currentIndex > latestIndex ? currentIndex : latestIndex,
            -1
          )
      : -1;
  const candidateMessages = requestIndex >= 0 ? messages.slice(requestIndex + 1) : messages;
  const latestAssistant = [...candidateMessages]
    .reverse()
    .find((message) => message.role === "assistant");
  if (latestAssistant === undefined) {
    return null;
  }

  const allAttachments = await listConversationAttachments(slot, conversationId);
  const attachments = allAttachments.filter(
    (attachment) => attachment.messageId === latestAssistant.id
  );

  return {
    text: latestAssistant.text,
    slot,
    provider: AppState.getProviderIdForSlot(slot) ?? slot,
    conversationId,
    messageId: latestAssistant.id,
    attachments,
  };
}

async function syncReplyTarget(
  target: UnifiedMessageTarget,
  envelope: SlotBridgeEnvelope,
  conversationId: string | null
): Promise<{ conversationId: string | null; generatedImagePendingCount: number }> {
  if (target === "us1") {
    const electronApi = getElectronApi();
    const localSessionId =
      envelope.sessionRef?.id?.trim() ??
      envelope.sessionRef?.conversationId?.trim() ??
      conversationId ??
      null;
    const syncResult = await electronApi?.us1SyncMessages?.({
      localSessionId,
    });
    const record = isRecord(syncResult) ? syncResult : {};
    return {
      conversationId:
        typeof record["conversationId"] === "string" && record["conversationId"] !== ""
          ? record["conversationId"]
          : conversationId,
      generatedImagePendingCount: 0,
    };
  }

  const webviewManager = await getWebviewManager();
  const syncResultRaw = await webviewManager.syncProvider(target, { from: "manual" });
  const syncResult = isRecord(syncResultRaw) ? syncResultRaw : null;
  return {
    conversationId:
      syncResult !== null &&
      typeof syncResult["conversationId"] === "string" &&
      syncResult["conversationId"] !== ""
        ? syncResult["conversationId"]
        : conversationId,
    generatedImagePendingCount:
      syncResult !== null && typeof syncResult["generatedImagePendingCount"] === "number"
        ? Math.max(0, Math.trunc(syncResult["generatedImagePendingCount"]))
        : 0,
  };
}

async function waitForReply(
  envelope: SlotBridgeEnvelope,
  targetSlot: UnifiedMessageTarget,
  previousReply: SlotBridgeReply | null
): Promise<SlotBridgeResult> {
  const busyReplyStableFallbackMs = 5000;
  const idlePartialReplyStallMs = 6000;
  const deadline = Date.now() + readTimeoutMs(envelope.timeoutMs);
  const pollReply = async (
    conversationId: string | null,
    stableCandidate: SlotBridgeReply | null,
    stablePollCount: number,
    stableSinceMs: number | null
  ): Promise<SlotBridgeResult> => {
    if (Date.now() > deadline) {
      return buildErrorResult(envelope, "TARGET_TIMEOUT", "Timed out while waiting for reply");
    }

    const syncResult = await syncReplyTarget(targetSlot, envelope, conversationId);
    const nextConversationId = syncResult.conversationId;

    const reply = await readLatestArchivedReply(targetSlot, nextConversationId, envelope.reqId);
    const replyChanged =
      reply !== null &&
      (previousReply?.messageId === undefined || previousReply.messageId !== reply.messageId);
    const pendingGeneratedImages = syncResult.generatedImagePendingCount;
    const hasReadableReply =
      reply !== null && ((reply.text ?? "").trim() !== "" || (reply.attachments?.length ?? 0) > 0);
    const replyStable = hasReadableReply && isSameReplySnapshot(stableCandidate, reply);
    const nextStableSinceMs =
      replyChanged && hasReadableReply && pendingGeneratedImages === 0
        ? replyStable
          ? stableSinceMs ?? Date.now()
          : Date.now()
        : null;
    const replyTrafficBusy = hasBusyReplyTraffic(targetSlot);
    const structuredReplyState =
      hasReadableReply && reply !== null ? readStructuredReplyState(reply.text ?? "") : "none";
    const nextStablePollCount =
      replyChanged && hasReadableReply && pendingGeneratedImages === 0
        ? replyStable
          ? stablePollCount + 1
          : 1
        : 0;
    const stableDurationMs =
      nextStableSinceMs !== null ? Math.max(0, Date.now() - nextStableSinceMs) : 0;
    const requiredStableDurationMs = replyTrafficBusy === true ? busyReplyStableFallbackMs : 0;
    const replySettled =
      structuredReplyState !== "partial" &&
      nextStablePollCount >= 2 &&
      stableDurationMs >= requiredStableDurationMs;

    if (
      replyChanged &&
      hasReadableReply &&
      pendingGeneratedImages === 0 &&
      replySettled
    ) {
      return buildResult(envelope, {
        reply,
        session: {
          ...(envelope.sessionRef ?? {}),
          ...(nextConversationId !== null ? { conversationId: nextConversationId } : {}),
        },
        artifacts: reply.attachments ?? [],
      });
    }

    if (
      replyChanged &&
      hasReadableReply &&
      pendingGeneratedImages === 0 &&
      replyTrafficBusy !== true &&
      structuredReplyState === "partial" &&
      nextStablePollCount >= 2 &&
      stableDurationMs >= idlePartialReplyStallMs
    ) {
      return buildResult(envelope, {
        success: false,
        code: "PARTIAL_REPLY_STALLED",
        message: "Reply stopped before completing.",
        reply,
        session: {
          ...(envelope.sessionRef ?? {}),
          ...(nextConversationId !== null ? { conversationId: nextConversationId } : {}),
        },
        artifacts: reply?.attachments ?? [],
        data: {
          partialReply: true,
        },
      });
    }

    const nextStableCandidate =
      replyChanged && hasReadableReply && pendingGeneratedImages === 0 ? reply : stableCandidate;

    await sleep(pendingGeneratedImages > 0 ? 900 : 500);
    return await pollReply(
      nextConversationId,
      nextStableCandidate,
      nextStablePollCount,
      nextStableSinceMs
    );
  };

  return await pollReply(envelope.sessionRef?.conversationId ?? null, null, 0, null);
}

function collectReplyForwardAttachments(
  reply: SlotBridgeReply | null
): Array<{ name: string; path: string }> {
  const seen = new Set<string>();
  return (reply?.attachments ?? []).flatMap((attachment) => {
    const path =
      typeof attachment.path === "string" && attachment.path !== ""
        ? attachment.path
        : typeof attachment.archivePath === "string" && attachment.archivePath !== ""
          ? attachment.archivePath
          : "";
    if (path === "") {
      return [];
    }

    const key = `${attachment.name}::${path}`;
    if (seen.has(key)) {
      return [];
    }
    seen.add(key);
    return [{ name: attachment.name, path }];
  });
}

function buildReplyForwardText(reply: SlotBridgeReply, targetSlot: UnifiedMessageTarget): string {
  const text = typeof reply.text === "string" ? reply.text.trim() : "";
  const senderTag = `<!-- hev-sender:${targetSlot} -->`;
  return text !== "" ? `${text}\n${senderTag}` : senderTag;
}

async function maybeForwardReplyToOrigin(
  envelope: SlotBridgeEnvelope,
  targetSlot: UnifiedMessageTarget,
  reply: SlotBridgeReply | null
): Promise<{ success: boolean; forwarded: boolean; message?: string }> {
  const replyToSlot = normalizeSlotId(envelope.replyToSlot);
  if (replyToSlot === null || replyToSlot === targetSlot || reply === null) {
    return { success: true, forwarded: false };
  }

  const ready = await ensureConnected(replyToSlot, envelope);
  if (ready.success !== true) {
    return {
      success: false,
      forwarded: false,
      message: ready.message ?? `Reply target ${replyToSlot.toUpperCase()} is not reachable`,
    };
  }

  const text = buildReplyForwardText(reply, targetSlot);
  const attachments = collectReplyForwardAttachments(reply);
  const coreEngine = await getCoreEngine();
  const sendResult =
    attachments.length > 0
      ? await coreEngine.sendBatch({
          targets: [replyToSlot],
          text,
          page: `slot-bridge:reply:${targetSlot}`,
          attachments,
        })
      : await coreEngine.sendMessage({
          provider: replyToSlot,
          text,
          page: `slot-bridge:reply:${targetSlot}`,
        });

  return sendResult.success === true
    ? { success: true, forwarded: true }
    : {
        success: false,
        forwarded: false,
        message:
          sendResult.message ?? `Reply could not be forwarded to ${replyToSlot.toUpperCase()}`,
      };
}

async function resolveArchiveAttachmentReference(
  descriptor: SlotBridgeAttachmentDescriptor
): Promise<string | null> {
  const ref = descriptor.ref?.trim() ?? "";
  if (ref === "") {
    return null;
  }

  if (ref.startsWith("archive:") !== true) {
    return null;
  }

  const parts = ref.split(":");
  if (parts.length < 5) {
    return null;
  }

  const sourceSlot = normalizeSlotId(parts[1]);
  const conversationId = parts[2]?.trim() ?? "";
  const messageId = parts[3]?.trim() ?? "";
  const originalName = parts.slice(4).join(":").trim();
  if (sourceSlot === null || conversationId === "" || messageId === "" || originalName === "") {
    return null;
  }

  const accountId = AppState.getArchiveAccountIdForProvider(sourceSlot);
  if (accountId === null) {
    return null;
  }

  const attachments = await listConversationAttachments(sourceSlot, conversationId);
  const match = attachments.find(
    (attachment) =>
      attachment.messageId === messageId &&
      attachment.name === originalName &&
      typeof attachment.path === "string" &&
      attachment.path !== ""
  );
  return typeof match?.path === "string" ? match.path : null;
}

async function resolveSendAttachmentPaths(
  envelope: SlotBridgeEnvelope
): Promise<ResolvedSendAttachment[]> {
  const fromSlot = envelope.fromSlot;
  const internalFilesystemAllowed =
    fromSlot === "room-ui" || fromSlot === "system" || fromSlot === "user";
  const attachments = Array.isArray(envelope.attachments) ? envelope.attachments : [];
  return await Promise.all(
    attachments.map(async (attachment) => {
      if (
        typeof attachment.path === "string" &&
        attachment.path !== "" &&
        internalFilesystemAllowed
      ) {
        return {
          name: attachment.name,
          path: attachment.path,
          ...(typeof attachment.mimeType === "string" && attachment.mimeType !== ""
            ? { mimeType: attachment.mimeType }
            : {}),
        };
      }

      const archivePath = await resolveArchiveAttachmentReference(attachment);
      if (archivePath !== null && archivePath !== "") {
        return {
          name: attachment.name,
          path: archivePath,
          ...(typeof attachment.mimeType === "string" && attachment.mimeType !== ""
            ? { mimeType: attachment.mimeType }
            : {}),
        };
      }

      throw new Error(`Attachment reference required for ${attachment.name}`);
    })
  );
}

async function sendUs1Message(
  envelope: SlotBridgeEnvelope,
  text: string,
  attachments: ResolvedSendAttachment[]
): Promise<SlotBridgeResult> {
  const electronApi = getElectronApi();
  const send = electronApi?.us1SendMessage;
  if (typeof send !== "function") {
    return buildErrorResult(envelope, "TARGET_UNREACHABLE", "US1 transport is unavailable");
  }

  const actionPayload = isRecord(envelope.payload) ? envelope.payload : {};
  const resultRaw = await send({
    text,
    localSessionId:
      envelope.sessionRef?.id?.trim() ?? envelope.sessionRef?.conversationId?.trim() ?? null,
    attachments: attachments.map((attachment) => ({
      path: attachment.path,
      name: attachment.name,
      ...(attachment.mimeType !== undefined ? { mimeType: attachment.mimeType } : {}),
    })),
    ...(isRecord(actionPayload["roomEvent"]) ? { roomEvent: actionPayload["roomEvent"] } : {}),
    ...(isRecord(actionPayload["roomCommand"])
      ? { roomCommand: actionPayload["roomCommand"] }
      : {}),
  });
  const result = isRecord(resultRaw) ? resultRaw : {};
  if (result["success"] !== true) {
    return buildErrorResult(
      envelope,
      "SEND_FAILED",
      typeof result["error"] === "string" ? result["error"] : "US1 message could not be sent"
    );
  }

  const session = {
    ...(envelope.sessionRef ?? {}),
    ...(typeof result["localSessionId"] === "string" && result["localSessionId"] !== ""
      ? { id: result["localSessionId"] }
      : {}),
    ...(typeof result["conversationId"] === "string" && result["conversationId"] !== ""
      ? { conversationId: result["conversationId"] }
      : {}),
  };

  return buildResult(envelope, {
    session,
    data: {
      ...(typeof result["remoteUserId"] === "string" && result["remoteUserId"] !== ""
        ? { remoteUserId: result["remoteUserId"] }
        : {}),
      ...(typeof result["transportMessageId"] === "string" && result["transportMessageId"] !== ""
        ? { transportMessageId: result["transportMessageId"] }
        : {}),
      ...(typeof result["archiveMessageId"] === "string" && result["archiveMessageId"] !== ""
        ? { archiveMessageId: result["archiveMessageId"] }
        : {}),
    },
  });
}

async function sendAiTargets(
  envelope: SlotBridgeEnvelope,
  targets: Array<"ai0" | "ai1" | "ai2">,
  text: string,
  attachments: ResolvedSendAttachment[],
  page: string
): Promise<SlotBridgeResult> {
  const coreEngine = await getCoreEngine();
  const sendResult =
    attachments.length > 0 || targets.length > 1
      ? await coreEngine.sendBatch({
          targets,
          text,
          page,
          attachments: attachments.map((attachment) => ({
            name: attachment.name,
            path: attachment.path,
          })),
        })
      : await coreEngine.sendMessage({
          text,
          page,
          ...(targets[0] !== undefined ? { provider: targets[0] } : {}),
        });

  return sendResult.success === true
    ? buildResult(envelope, {
        session: envelope.sessionRef ?? null,
      })
    : buildErrorResult(envelope, "SEND_FAILED", sendResult.message ?? "Message could not be sent");
}

async function runMessageAction(
  envelope: SlotBridgeEnvelope,
  payload: CommandPayload
): Promise<SlotBridgeResult> {
  const targets = readMessageTargets(envelope);
  if (targets.length === 0) {
    return buildErrorResult(envelope, "TARGET_REQUIRED", "Target slot is required");
  }

  if ((envelope.wait === true || envelope.action === "message.sendWait") && targets.length !== 1) {
    return buildErrorResult(
      envelope,
      "WAIT_SINGLE_TARGET_REQUIRED",
      "message.sendWait requires exactly one target"
    );
  }

  const readyResults = await Promise.all(
    targets.map(async (target) => ({
      target,
      ready: await ensureMessageTarget(target, envelope),
    }))
  );
  for (const { ready } of readyResults) {
    if (ready.success !== true) {
      return buildErrorResult(
        envelope,
        ready.message?.includes("offline") === true ? "TARGET_UNREACHABLE" : "CONNECT_FAILED",
        ready.message ?? "Target is not reachable"
      );
    }
  }

  let previousReply: SlotBridgeReply | null = null;
  const primaryTarget = targets[0] ?? null;
  if (envelope.wait === true || envelope.action === "message.sendWait") {
    if (primaryTarget !== null) {
      const baselineSync = await syncReplyTarget(
        primaryTarget,
        envelope,
        envelope.sessionRef?.conversationId ?? envelope.sessionRef?.id ?? null
      );
      previousReply = await readLatestArchivedReply(
        primaryTarget,
        baselineSync.conversationId,
        envelope.reqId
      );
    }
  }

  const text = appendRequestMarker(await composeActionText(envelope, payload), envelope);
  const page = readActionPage(envelope, payload);
  let attachments: ResolvedSendAttachment[] = [];
  if (Array.isArray(envelope.attachments) && envelope.attachments.length > 0) {
    try {
      attachments = await resolveSendAttachmentPaths(envelope);
    } catch (error) {
      return buildErrorResult(
        envelope,
        "ATTACHMENT_REFERENCE_REQUIRED",
        getErrorMessage(error),
        error
      );
    }
  }

  if (envelope.action === "file.send" && attachments.length === 0) {
    return buildErrorResult(envelope, "ATTACHMENT_REQUIRED", "At least one attachment is required");
  }

  if (text === "" && attachments.length === 0) {
    return buildErrorResult(envelope, "MESSAGE_REQUIRED", "Text is required for this action");
  }

  const aiTargets = targets.filter((target): target is "ai0" | "ai1" | "ai2" => target !== "us1");
  const us1Targets = targets.filter((target): target is "us1" => target === "us1");

  if (aiTargets.length > 0) {
    const aiResult = await sendAiTargets(envelope, aiTargets, text, attachments, page);
    if (aiResult.success !== true) {
      return aiResult;
    }
  }

  let us1Result: SlotBridgeResult | null = null;
  if (us1Targets.length > 0) {
    if (us1Targets.length > 1 || targets.length > aiTargets.length + 1) {
      return buildErrorResult(
        envelope,
        "TARGET_UNSUPPORTED",
        "US1 may only be addressed once per unified send action"
      );
    }
    us1Result = await sendUs1Message(envelope, text, attachments);
    if (us1Result.success !== true) {
      return us1Result;
    }
  }

  if (envelope.wait === true || envelope.action === "message.sendWait") {
    if (primaryTarget === null) {
      return buildErrorResult(envelope, "TARGET_REQUIRED", "Target slot is required");
    }

    const waitResult = await waitForReply(envelope, primaryTarget, previousReply);
    if (waitResult.success !== true) {
      return waitResult;
    }

    const forwardResult = await maybeForwardReplyToOrigin(
      envelope,
      primaryTarget,
      waitResult.reply ?? null
    );
    if (forwardResult.success !== true) {
      return buildErrorResult(
        envelope,
        "REPLY_FORWARD_FAILED",
        forwardResult.message ?? "Reply could not be forwarded"
      );
    }

    const baseData = isRecord(waitResult.data) ? waitResult.data : {};
    return buildResult(envelope, {
      reply: waitResult.reply ?? null,
      session: waitResult.session ?? envelope.sessionRef ?? null,
      artifacts: waitResult.artifacts ?? [],
      data: {
        ...baseData,
        replyForwarded: forwardResult.forwarded,
        replyForwardSlot: forwardResult.forwarded ? (envelope.replyToSlot ?? null) : null,
      },
    });
  }

  return us1Result ?? buildResult(envelope, { session: envelope.sessionRef ?? null });
}

async function runConnectionAction(envelope: SlotBridgeEnvelope): Promise<SlotBridgeResult> {
  const targetSlot = normalizeSlotId(envelope.toSlot);
  if (targetSlot === null) {
    return buildErrorResult(envelope, "TARGET_REQUIRED", "Target slot is required");
  }

  const coreEngine = await getCoreEngine();
  const result = await coreEngine.setConnection(targetSlot, true, {
    force: envelope.force === true,
  });
  return result.success === true
    ? buildResult(envelope)
    : buildErrorResult(
        envelope,
        "CONNECT_FAILED",
        result.message ?? "Connection could not be established"
      );
}

async function runRoomCommandAction(envelope: SlotBridgeEnvelope): Promise<SlotBridgeResult> {
  const actionPayload = isRecord(envelope.payload) ? envelope.payload : {};
  const commandNameCandidates = [
    actionPayload["commandName"],
    actionPayload["actionId"],
    actionPayload["roomCommand"],
  ];
  const commandName = commandNameCandidates
    .find(
      (candidate): candidate is string => typeof candidate === "string" && candidate.trim() !== ""
    )
    ?.trim();

  if (commandName === undefined) {
    return buildErrorResult(envelope, "ROOM_COMMAND_REQUIRED", "Room command is required");
  }

  const provider = envelope.fromSlot ?? "system";
  const roomPayload = isRecord(actionPayload["roomPayload"])
    ? actionPayload["roomPayload"]
    : Object.entries(actionPayload).reduce<Record<string, unknown>>((acc, [key, value]) => {
        if (
          key === "commandName" ||
          key === "actionId" ||
          key === "roomCommand" ||
          key === "rawArgs" ||
          key === "remoteUserId" ||
          key === "localSessionId" ||
          key === "transportMessageId"
        ) {
          return acc;
        }
        acc[key] = value;
        return acc;
      }, {});
  const rawArgs =
    typeof actionPayload["rawArgs"] === "string"
      ? actionPayload["rawArgs"]
      : JSON.stringify(roomPayload);
  const commandPayload = {
    provider,
    source: provider,
    roomPayload,
    args: rawArgs,
    roomId: actionPayload["roomId"],
    ...(typeof actionPayload["remoteUserId"] === "string" &&
    actionPayload["remoteUserId"].trim() !== ""
      ? { remoteUserId: actionPayload["remoteUserId"].trim() }
      : {}),
    ...(typeof actionPayload["localSessionId"] === "string" &&
    actionPayload["localSessionId"].trim() !== ""
      ? { localSessionId: actionPayload["localSessionId"].trim() }
      : {}),
    ...(typeof actionPayload["transportMessageId"] === "string" &&
    actionPayload["transportMessageId"].trim() !== ""
      ? { transportMessageId: actionPayload["transportMessageId"].trim() }
      : {}),
  };

  const result = await RoomCommandRegistry.run(commandName, commandPayload);
  return isRecord(result)
    ? buildResult(envelope, { data: result })
    : buildResult(envelope, { data: { result } });
}

async function runAi0SessionOpen(envelope: SlotBridgeEnvelope): Promise<SlotBridgeResult> {
  const webviewManager = await getWebviewManager();
  const webview = webviewManager.resolveWebview("ai0");
  if (webview === null) {
    return buildErrorResult(envelope, "TARGET_UNREACHABLE", "Assistant webview is not ready");
  }

  const requestedTitle =
    isRecord(envelope.payload) && typeof envelope.payload["title"] === "string"
      ? envelope.payload["title"]
      : "New session";

  const script = `
    (async function () {
      const createSession = window.APIClient?.createSession;
      if (typeof createSession !== "function") {
        return { success: false, error: "session.create unsupported" };
      }
      const title = ${JSON.stringify(requestedTitle)};
      const result = await createSession(title);
      const sessionId =
        typeof result?.sessionId === "string" && result.sessionId.trim() !== ""
          ? result.sessionId.trim()
          : "";
      if (sessionId === "") {
        return { success: false, error: "session id unavailable" };
      }
      if (typeof window.SessionStore?.setActiveSession === "function") {
        window.SessionStore.setActiveSession(sessionId);
      }
      if (typeof window.SessionStore?.setCurrentSession === "function") {
        window.SessionStore.setCurrentSession(sessionId);
      }
      window.electronAPI?.sendToHost?.("opencode-ui-session-changed", { sessionId });
      return { success: true, sessionId };
    })();
  `;

  const rawResult = await webview.executeJavaScript(script);
  const result = isRecord(rawResult) ? rawResult : {};
  if (result["success"] !== true) {
    return buildErrorResult(
      envelope,
      "SESSION_OPEN_FAILED",
      typeof result["error"] === "string" ? result["error"] : "Session could not be opened"
    );
  }

  const sessionId = typeof result["sessionId"] === "string" ? result["sessionId"].trim() : "";
  return buildResult(envelope, {
    session: {
      ...(envelope.sessionRef ?? {}),
      ...(sessionId !== "" ? { id: sessionId } : {}),
    },
  });
}

async function runAi0SessionSwitch(envelope: SlotBridgeEnvelope): Promise<SlotBridgeResult> {
  const sessionId =
    envelope.sessionRef?.id?.trim() ?? envelope.sessionRef?.conversationId?.trim() ?? "";
  if (sessionId === "") {
    return buildErrorResult(envelope, "SESSION_ID_REQUIRED", "Session id is required");
  }

  const webviewManager = await getWebviewManager();
  const webview = webviewManager.resolveWebview("ai0");
  if (webview === null) {
    return buildErrorResult(envelope, "TARGET_UNREACHABLE", "Assistant webview is not ready");
  }

  const script = `
    (function () {
      const sessionId = ${JSON.stringify(sessionId)};
      if (typeof window.SessionStore?.setActiveSession === "function") {
        window.SessionStore.setActiveSession(sessionId);
      } else if (typeof window.SessionStore?.setCurrentSession === "function") {
        window.SessionStore.setCurrentSession(sessionId);
      } else {
        return { success: false, error: "session.switch unsupported" };
      }
      window.electronAPI?.sendToHost?.("opencode-ui-session-changed", { sessionId });
      return { success: true, sessionId };
    })();
  `;

  const rawResult = await webview.executeJavaScript(script);
  const result = isRecord(rawResult) ? rawResult : {};
  if (result["success"] !== true) {
    return buildErrorResult(
      envelope,
      "SESSION_SWITCH_FAILED",
      typeof result["error"] === "string" ? result["error"] : "Session could not be selected"
    );
  }

  return buildResult(envelope, {
    session: {
      ...(envelope.sessionRef ?? {}),
      id: sessionId,
    },
  });
}

async function runSessionAction(envelope: SlotBridgeEnvelope): Promise<SlotBridgeResult> {
  const targetSlot = normalizeSlotId(envelope.toSlot);
  if (targetSlot === null) {
    return buildErrorResult(envelope, "TARGET_REQUIRED", "Target slot is required");
  }

  const readyEnvelope =
    envelope.connectPolicy === "never"
      ? { ...envelope, connectPolicy: "ensure" as const }
      : envelope;
  const ready = await ensureConnected(targetSlot, readyEnvelope);
  if (ready.success !== true) {
    return buildErrorResult(
      envelope,
      "TARGET_UNREACHABLE",
      ready.message ?? "Target is not reachable"
    );
  }

  if (targetSlot === "ai0") {
    return envelope.action === "session.open"
      ? await runAi0SessionOpen(envelope)
      : await runAi0SessionSwitch(envelope);
  }

  if (envelope.action === "session.open") {
    SlotController.navigate(targetSlot, null);
    return buildResult(envelope, {
      session: {
        ...(envelope.sessionRef ?? {}),
        conversationId: null,
      },
    });
  }

  const conversationId =
    envelope.sessionRef?.conversationId?.trim() ?? envelope.sessionRef?.id?.trim() ?? "";
  if (conversationId === "") {
    return buildErrorResult(envelope, "CONVERSATION_ID_REQUIRED", "Conversation id is required");
  }

  const conversationListManager = await getConversationListManager();
  await conversationListManager.refresh({
    silent: true,
    forceSelectId: conversationId,
    provider: targetSlot,
  });
  const updated = conversationListManager.updateSelection(conversationId, {
    provider: targetSlot,
    silent: false,
  });

  return updated
    ? buildResult(envelope, {
        session: {
          ...(envelope.sessionRef ?? {}),
          conversationId,
        },
      })
    : buildErrorResult(
        envelope,
        "SESSION_SWITCH_FAILED",
        `Conversation ${conversationId} was not found for ${targetSlot.toUpperCase()}`
      );
}

export async function slotBridgeHandler(payload: CommandPayload = {}): Promise<SlotBridgeResult> {
  const envelope = normalizeEnvelope(payload);

  try {
    switch (envelope.action) {
      case "message.send":
      case "message.sendWait":
      case "message.sendWithAttachments":
      case "file.send":
        return await runMessageAction(envelope, payload);
      case "connection.ensure":
        return await runConnectionAction(envelope);
      case "room.command":
        return await runRoomCommandAction(envelope);
      case "session.open":
      case "session.switch":
        return await runSessionAction(envelope);
      default:
        return buildErrorResult(envelope, "ACTION_UNSUPPORTED", "Unsupported action");
    }
  } catch (error) {
    return buildErrorResult(envelope, "SLOT_BRIDGE_FAILED", getErrorMessage(error), error);
  }
}
