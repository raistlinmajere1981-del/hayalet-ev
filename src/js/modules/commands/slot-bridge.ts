import { generateUniqueId } from "../../constants/index.js";
import {
  getErrorMessage,
  type CommandPayload,
  type CommandProvider,
  type SlotBridgeAction,
  type SlotBridgeAttachmentDescriptor,
  type SlotBridgeConnectPolicy,
  type SlotBridgeEnvelope,
  type SlotBridgeReply,
  type SlotBridgeResult,
  type SlotBridgeSessionRef,
} from "@shared/index.js";
import type { CoreEngine as CoreEngineInstance } from "../core-engine.js";
import { AppState } from "../app-state.js";
import { RoomCommandRegistry } from "../rooms/room-command-registry.js";
import { SlotController } from "../slot-controller.js";

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

type SlotBridgeCoreEngineRef = Pick<CoreEngineInstance, "setConnection" | "sendBatch" | "sendMessage">;

interface SlotBridgeConversationListManagerRef {
  refresh(options: {
    silent?: boolean;
    forceSelectId?: string;
    provider?: string;
  }): Promise<void>;
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
  "message.send": ["ai0", "ai1-ai2"],
  "message.sendWait": ["ai0", "ai1-ai2"],
  "message.sendWithAttachments": ["ai0", "ai1-ai2"],
  "file.send": ["ai0", "ai1-ai2"],
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

function normalizeConnectPolicy(
  value: unknown,
  force: boolean
): SlotBridgeConnectPolicy {
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
    typeof value["name"] === "string" && value["name"].trim() !== ""
      ? value["name"].trim()
      : "";
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
  const archivePath =
    typeof value["archivePath"] === "string" ? value["archivePath"].trim() : "";
  const mimeType = typeof value["mimeType"] === "string" ? value["mimeType"].trim() : "";
  const sourceSlot = normalizeSlotId(value["sourceSlot"]);
  const conversationId =
    typeof value["conversationId"] === "string" ? value["conversationId"].trim() : "";
  const messageId = typeof value["messageId"] === "string" ? value["messageId"].trim() : "";
  const size = typeof value["size"] === "number" && Number.isFinite(value["size"]) ? value["size"] : undefined;

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

function buildActionPayload(
  source: Record<string, unknown>,
  fallback: Record<string, unknown>
): Record<string, unknown> {
  if (isRecord(source["payload"])) {
    return { ...source["payload"] };
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

  return Object.keys(derived).length > 0 ? derived : fallback;
}

function normalizeEnvelope(payload: CommandPayload = {}): SlotBridgeEnvelope {
  const parsedArgs = parseJsonRecord(typeof payload.args === "string" ? payload.args : "") ?? {};
  const directPayload = isRecord(payload["payload"]) ? payload["payload"] : {};
  const rawSessionRef =
    parsedArgs["sessionRef"] ?? parsedArgs["session"] ?? payload["sessionRef"] ?? payload["session"] ?? null;
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
      (typeof parsedArgs["reqId"] === "string" && parsedArgs["reqId"].trim() !== ""
        ? parsedArgs["reqId"].trim()
        : typeof payload["reqId"] === "string" && payload["reqId"].trim() !== ""
          ? payload["reqId"].trim()
          : generateUniqueId("slotbridge")),
    action,
    fromSlot,
    toSlot,
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
    payload: buildActionPayload(parsedArgs, directPayload),
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

function readActionText(
  envelope: SlotBridgeEnvelope,
  payload: CommandPayload
): string {
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
    const module = await import("../core-engine.js");
    return module.CoreEngine;
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
  const text = textCandidates.find(
    (candidate): candidate is string => typeof candidate === "string"
  )?.trim();
  const author = typeof value["author"] === "string" ? value["author"].trim() : "";

  return {
    id,
    role,
    text: text ?? "",
    ...(author !== "" ? { author } : {}),
  };
}

async function listConversationMessages(
  slot: CommandProvider,
  conversationId: string | null
): Promise<NormalizedReplyMessage[]> {
  const normalizedSlot = slot === "ai0" || slot === "ai1" || slot === "ai2" || slot === "us1" ? slot : null;
  if (normalizedSlot === null) {
    return [];
  }

  const accountId = AppState.getArchiveAccountIdForProvider(normalizedSlot);
  if (accountId === null || conversationId === null || conversationId === "") {
    return [];
  }

  const electronApi = window.electronAPI;
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
  slot: CommandProvider,
  conversationId: string | null
): Promise<SlotBridgeAttachmentDescriptor[]> {
  const normalizedSlot = slot === "ai0" || slot === "ai1" || slot === "ai2" || slot === "us1" ? slot : null;
  if (normalizedSlot === null) {
    return [];
  }

  const accountId = AppState.getArchiveAccountIdForProvider(normalizedSlot);
  if (accountId === null || conversationId === null || conversationId === "") {
    return [];
  }

  const raw = await window.electronAPI?.["dbGetAttachments"]?.({
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
  slot: "ai0" | "ai1" | "ai2",
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
          .reduce((latestIndex, currentIndex) =>
            currentIndex > latestIndex ? currentIndex : latestIndex,
          -1)
      : -1;
  const candidateMessages =
    requestIndex >= 0 ? messages.slice(requestIndex + 1) : messages;
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
    provider: AppState.getProviderIdForSlot(slot),
    conversationId,
    messageId: latestAssistant.id,
    attachments,
  };
}

async function waitForReply(
  envelope: SlotBridgeEnvelope,
  targetSlot: "ai0" | "ai1" | "ai2",
  previousReply: SlotBridgeReply | null
): Promise<SlotBridgeResult> {
  const deadline = Date.now() + readTimeoutMs(envelope.timeoutMs);
  let conversationId = envelope.sessionRef?.conversationId ?? null;

  while (Date.now() <= deadline) {
    const webviewManager = await getWebviewManager();
    const syncResultRaw = await webviewManager.syncProvider(targetSlot, { from: "manual" });
    const syncResult = isRecord(syncResultRaw) ? syncResultRaw : null;
    if (syncResult !== null && typeof syncResult["conversationId"] === "string" && syncResult["conversationId"] !== "") {
      conversationId = syncResult["conversationId"];
    }

    const reply = await readLatestArchivedReply(targetSlot, conversationId, envelope.reqId);
    const replyChanged =
      reply !== null &&
      (previousReply?.messageId === undefined || previousReply.messageId !== reply.messageId);
    const pendingGeneratedImages =
      syncResult !== null && typeof syncResult["generatedImagePendingCount"] === "number"
        ? Math.max(0, Math.trunc(syncResult["generatedImagePendingCount"]))
        : 0;
    const hasReadableReply =
      reply !== null && ((reply.text ?? "").trim() !== "" || (reply.attachments?.length ?? 0) > 0);

    if (replyChanged && hasReadableReply && pendingGeneratedImages === 0) {
      return buildResult(envelope, {
        reply,
        session: {
          ...(envelope.sessionRef ?? {}),
          ...(conversationId !== null ? { conversationId } : {}),
        },
        artifacts: reply.attachments ?? [],
      });
    }

    await sleep(pendingGeneratedImages > 0 ? 900 : 500);
  }

  return buildErrorResult(envelope, "TARGET_TIMEOUT", "Timed out while waiting for reply");
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

function buildReplyForwardText(reply: SlotBridgeReply, targetSlot: "ai0" | "ai1" | "ai2"): string {
  const text = typeof reply.text === "string" ? reply.text.trim() : "";
  const senderTag = `<!-- hev-sender:${targetSlot} -->`;
  return text !== "" ? `${text}\n${senderTag}` : senderTag;
}

async function maybeForwardReplyToOrigin(
  envelope: SlotBridgeEnvelope,
  targetSlot: "ai0" | "ai1" | "ai2",
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
        message: sendResult.message ?? `Reply could not be forwarded to ${replyToSlot.toUpperCase()}`,
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
): Promise<Array<{ name: string; path: string }>> {
  const fromSlot = envelope.fromSlot;
  const internalFilesystemAllowed =
    fromSlot === "room-ui" || fromSlot === "system" || fromSlot === "user";
  const attachments = Array.isArray(envelope.attachments) ? envelope.attachments : [];
  const resolved: Array<{ name: string; path: string }> = [];

  for (const attachment of attachments) {
    if (typeof attachment.path === "string" && attachment.path !== "" && internalFilesystemAllowed) {
      resolved.push({ name: attachment.name, path: attachment.path });
      continue;
    }

    const archivePath = await resolveArchiveAttachmentReference(attachment);
    if (archivePath !== null && archivePath !== "") {
      resolved.push({ name: attachment.name, path: archivePath });
      continue;
    }

    throw new Error(`Attachment reference required for ${attachment.name}`);
  }

  return resolved;
}

async function runMessageAction(
  envelope: SlotBridgeEnvelope,
  payload: CommandPayload
): Promise<SlotBridgeResult> {
  const targetSlot = normalizeSlotId(envelope.toSlot);
  if (targetSlot === null) {
    return buildErrorResult(envelope, "TARGET_REQUIRED", "Target slot is required");
  }

  const ready = await ensureConnected(targetSlot, envelope);
  if (ready.success !== true) {
    return buildErrorResult(
      envelope,
      ready.message?.includes("offline") === true ? "TARGET_UNREACHABLE" : "CONNECT_FAILED",
      ready.message ?? "Target is not reachable"
    );
  }

  let previousReply: SlotBridgeReply | null = null;
  if (envelope.wait === true || envelope.action === "message.sendWait") {
    const webviewManager = await getWebviewManager();
    const baselineSyncRaw = await webviewManager.syncProvider(targetSlot, { from: "manual" });
    const baselineSync = isRecord(baselineSyncRaw) ? baselineSyncRaw : null;
    const baselineConversationId =
      baselineSync !== null && typeof baselineSync["conversationId"] === "string"
        ? baselineSync["conversationId"]
        : envelope.sessionRef?.conversationId ?? null;
    previousReply = await readLatestArchivedReply(
      targetSlot,
      baselineConversationId,
      envelope.reqId
    );
  }

  const text = appendRequestMarker(readActionText(envelope, payload), envelope);
  let attachments: Array<{ name: string; path: string }> = [];
  if (
    envelope.action === "message.sendWithAttachments" ||
    envelope.action === "file.send"
  ) {
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

  if ((envelope.action === "message.send" || envelope.action === "message.sendWait") && text === "") {
    return buildErrorResult(envelope, "MESSAGE_REQUIRED", "Text is required for this action");
  }

  const coreEngine = await getCoreEngine();
  const sendResult =
    attachments.length > 0
      ? await coreEngine.sendBatch({
          targets: [targetSlot],
          text,
          page: `slot-bridge:${envelope.action}`,
          attachments,
        })
      : await coreEngine.sendMessage({
          provider: targetSlot,
          text,
          page: `slot-bridge:${envelope.action}`,
        });

  if (sendResult.success !== true) {
    return buildErrorResult(
      envelope,
      "SEND_FAILED",
      sendResult.message ?? "Message could not be sent"
    );
  }

  if (envelope.wait === true || envelope.action === "message.sendWait") {
    const waitResult = await waitForReply(envelope, targetSlot, previousReply);
    if (waitResult.success !== true) {
      return waitResult;
    }

    const forwardResult = await maybeForwardReplyToOrigin(
      envelope,
      targetSlot,
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
        replyForwardSlot: forwardResult.forwarded ? envelope.replyToSlot ?? null : null,
      },
    });
  }

  return buildResult(envelope, {
    session: envelope.sessionRef ?? null,
  });
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

async function runRoomCommandAction(
  envelope: SlotBridgeEnvelope
): Promise<SlotBridgeResult> {
  const actionPayload = isRecord(envelope.payload) ? envelope.payload : {};
  const commandNameCandidates = [
    actionPayload["commandName"],
    actionPayload["actionId"],
    actionPayload["roomCommand"],
  ];
  const commandName = commandNameCandidates.find(
    (candidate): candidate is string => typeof candidate === "string" && candidate.trim() !== ""
  )?.trim();

  if (commandName === undefined) {
    return buildErrorResult(envelope, "ROOM_COMMAND_REQUIRED", "Room command is required");
  }

  const provider = envelope.fromSlot ?? "system";
  const roomPayload =
    isRecord(actionPayload["roomPayload"])
      ? actionPayload["roomPayload"]
      : Object.entries(actionPayload).reduce<Record<string, unknown>>((acc, [key, value]) => {
          if (key === "commandName" || key === "actionId" || key === "roomCommand") {
            return acc;
          }
          acc[key] = value;
          return acc;
        }, {});
  const rawArgs =
    typeof actionPayload["rawArgs"] === "string"
      ? actionPayload["rawArgs"]
      : JSON.stringify(roomPayload);

  const result = await RoomCommandRegistry.run(commandName, {
    provider,
    source: provider,
    roomPayload,
    args: rawArgs,
    roomId: actionPayload["roomId"],
  });
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
  const sessionId = envelope.sessionRef?.id?.trim() ?? envelope.sessionRef?.conversationId?.trim() ?? "";
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
    envelope.connectPolicy === "never" ? { ...envelope, connectPolicy: "ensure" as const } : envelope;
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

  const conversationId = envelope.sessionRef?.conversationId?.trim() ?? envelope.sessionRef?.id?.trim() ?? "";
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

export async function slotBridgeHandler(
  payload: CommandPayload = {}
): Promise<SlotBridgeResult> {
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
