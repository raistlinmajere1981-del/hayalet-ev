import type { RepairAiMarkEvent, RepairMeasurementEvent } from "../types/index.js";
import type { RepairUiState, RepairUiSnapshotMeta } from "./state.js";

export interface RepairStateHostMessage {
  type: "repair-state";
  snapshot: RepairUiState;
  meta: RepairUiSnapshotMeta;
}

export interface RepairFeedEventHostMessage {
  type: "repair-feed-event";
  event: RepairAiMarkEvent;
}

export interface RepairMeasurementReadingHostMessage {
  type: "repair-measurement-reading";
  reading: RepairMeasurementEvent;
}

export interface RepairChatReplyHostMessage {
  type: "repair-chat-reply";
  turnId: string;
  text: string;
  occurredAt: string;
  contextRefs: string[];
}

export interface RepairResearchProgressHostMessage {
  type: "repair-research-progress";
  step:
    | "searching-device-info"
    | "finding-schematics"
    | "collecting-board-images"
    | "analyzing-common-failures"
    | "preparing-knowledge-pack"
    | "complete";
  completed: boolean;
}

export interface RepairTranscriptIngressHostMessage {
  type: "transcript-ingress";
  requestId: string;
  text: string;
  source: "pc-mic" | "android-bridge" | "synthetic-test";
  target: string | null;
  isFinal: boolean;
  createdAt: string;
  metadata: Record<string, unknown> | null;
}

export type RepairHostMessage =
  | RepairStateHostMessage
  | RepairFeedEventHostMessage
  | RepairMeasurementReadingHostMessage
  | RepairChatReplyHostMessage
  | RepairResearchProgressHostMessage
  | RepairTranscriptIngressHostMessage;

type RepairHostMessageRecord = Record<string, unknown>;

function toRecord(value: unknown): RepairHostMessageRecord {
  return value !== null && typeof value === "object" && Array.isArray(value) === false
    ? (value as RepairHostMessageRecord)
    : {};
}

function unwrapHostPayload(value: unknown): RepairHostMessageRecord {
  const envelope = toRecord(value);
  const payload = toRecord(envelope["payload"]);
  return Object.keys(payload).length > 0 ? payload : envelope;
}

export function normalizeRepairHostMessage(value: unknown): RepairHostMessage | null {
  const envelope = toRecord(value);
  const type = typeof envelope["type"] === "string" ? envelope["type"] : "";
  const payload = unwrapHostPayload(value);

  if (type === "repair-state") {
    const snapshot = payload["snapshot"];
    const meta = payload["meta"];
    if (
      typeof snapshot === "object" &&
      snapshot !== null &&
      typeof meta === "object" &&
      meta !== null
    ) {
      return { type, snapshot: snapshot as RepairUiState, meta: meta as RepairUiSnapshotMeta };
    }
  }

  if (type === "repair-feed-event") {
    const event = payload["event"];
    if (typeof event === "object" && event !== null) {
      return { type, event: event as RepairAiMarkEvent };
    }
  }

  if (type === "repair-measurement-reading") {
    const reading = payload["reading"];
    if (typeof reading === "object" && reading !== null) {
      return { type, reading: reading as RepairMeasurementEvent };
    }
  }

  if (type === "repair-chat-reply") {
    const turnId = payload["turnId"];
    const text = payload["text"];
    const occurredAt = payload["occurredAt"];
    const contextRefs = payload["contextRefs"];
    if (
      typeof turnId === "string" &&
      typeof text === "string" &&
      typeof occurredAt === "string" &&
      Array.isArray(contextRefs)
    ) {
      return {
        type,
        turnId,
        text,
        occurredAt,
        contextRefs: contextRefs.filter((entry): entry is string => typeof entry === "string"),
      };
    }
  }

  if (type === "repair-research-progress") {
    const step = payload["step"];
    const completed = payload["completed"];
    if (typeof step === "string" && typeof completed === "boolean") {
      return { type, step: step as RepairResearchProgressHostMessage["step"], completed };
    }
  }

  if (type === "transcript-ingress") {
    const requestId = payload["requestId"];
    const text = payload["text"];
    const source = payload["source"];
    const target = payload["target"];
    const isFinal = payload["isFinal"];
    const createdAt = payload["createdAt"];
    const metadata = payload["metadata"];
    if (
      typeof requestId === "string" &&
      typeof text === "string" &&
      (source === "pc-mic" || source === "android-bridge" || source === "synthetic-test") &&
      (target === null || typeof target === "string") &&
      typeof isFinal === "boolean" &&
      typeof createdAt === "string" &&
      (metadata === null ||
        (typeof metadata === "object" && metadata !== null && Array.isArray(metadata) === false))
    ) {
      return {
        type,
        requestId,
        text,
        source,
        target,
        isFinal,
        createdAt,
        metadata: metadata as Record<string, unknown> | null,
      };
    }
  }

  return null;
}

export function isRepairHostMessage(value: unknown): value is RepairHostMessage {
  return normalizeRepairHostMessage(value) !== null;
}
