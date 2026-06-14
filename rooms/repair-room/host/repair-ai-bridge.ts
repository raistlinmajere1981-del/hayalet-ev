import {
  REPAIR_KNOWLEDGE_PACK_SCHEMA_VERSION,
  REPAIR_PROTOCOL_KEYS,
  REPAIR_PROTOCOL_SCENARIOS,
  REPAIR_ROOM_ID,
} from "../shared/repair-constants.js";
import type {
  RepairAiSeverity,
  RepairChatTurn,
  RepairCommonFailure,
  RepairImageRect,
  RepairKnowledgePack,
  RepairKnowledgePackResource,
  RepairMeasurementEvent,
  RepairOperatorProfile,
  RepairSession,
  RepairTestPoint,
  RepairWizardDraft,
} from "../shared/types/index.js";
import type { RepairAiTargetSlot } from "../shared/ui/state.js";

export type RepairAiDispatchBridge = (
  payload: Record<string, unknown>
) => Promise<unknown> | unknown;

export const REPAIR_AI_TARGET_SLOT: RepairAiTargetSlot = "ai2";

export interface RepairAiChatReplyRequest {
  dispatchBridge?: RepairAiDispatchBridge;
  locale: string;
  operatorProfile: RepairOperatorProfile;
  operatorTurn: RepairChatTurn;
  recentTurns: RepairChatTurn[];
  session: RepairSession | null;
  targetSlot?: RepairAiTargetSlot;
}

export interface RepairAiChatReplyResult {
  success: boolean;
  text: string | null;
  contextRefs: string[];
  message?: string;
}

interface RepairAiChatReplyPayload {
  replyText: string;
  contextRefs: string[];
}

export interface RepairAiTacticalObservation {
  kind: RepairAiSeverity;
  text: string;
  region: RepairImageRect | null;
  contextRefs: string[];
  linkedEventIds: string[];
  linkedMeasurementIds: string[];
}

export interface RepairAiTacticalObservationRequest {
  dispatchBridge?: RepairAiDispatchBridge;
  locale: string;
  operatorProfile: RepairOperatorProfile;
  session: RepairSession;
  targetSlot?: RepairAiTargetSlot;
  triggeringEvent: RepairMeasurementEvent;
}

export interface RepairAiTacticalObservationResult {
  success: boolean;
  observations: RepairAiTacticalObservation[];
  message?: string;
}

export interface RepairAiKnowledgeResearchRequest {
  dispatchBridge?: RepairAiDispatchBridge;
  draft: RepairWizardDraft;
  locale: string;
  operatorProfile: RepairOperatorProfile;
  targetSlot?: RepairAiTargetSlot;
}

export interface RepairAiKnowledgeResearchResult {
  success: boolean;
  contextRefs: string[];
  pack: RepairKnowledgePack | null;
  message?: string;
}

function toRecord(value: unknown): Record<string, unknown> {
  return value !== null && typeof value === "object" && Array.isArray(value) === false
    ? (value as Record<string, unknown>)
    : {};
}

function asNonEmptyString(value: unknown): string | null {
  return typeof value === "string" && value.trim() !== "" ? value.trim() : null;
}

function asStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => asNonEmptyString(item))
    .filter((item): item is string => item !== null);
}

function asFiniteNumber(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function asRepairAiSeverity(value: unknown): RepairAiSeverity | null {
  if (typeof value !== "string") return null;
  const normalized = value.trim().toLowerCase();
  if (normalized === "info" || normalized === "note") return "info";
  if (normalized === "suggestion" || normalized === "recommendation") return "suggestion";
  if (normalized === "action" || normalized === "next_step" || normalized === "next-step") {
    return "action";
  }
  if (normalized === "risk" || normalized === "warning" || normalized === "danger") {
    return "risk";
  }
  return null;
}

function asImageRect(value: unknown): RepairImageRect | null {
  const record = toRecord(value);
  const xPx = asFiniteNumber(record["xPx"]);
  const yPx = asFiniteNumber(record["yPx"]);
  const widthPx = asFiniteNumber(record["widthPx"]);
  const heightPx = asFiniteNumber(record["heightPx"]);
  if (xPx === null || yPx === null || widthPx === null || heightPx === null) return null;
  return {
    xPx,
    yPx,
    widthPx: Math.max(1, widthPx),
    heightPx: Math.max(1, heightPx),
  };
}

function asConfidence(value: unknown, fallback = 0.5): number {
  const numeric = asFiniteNumber(value);
  if (numeric === null) return fallback;
  return Math.max(0, Math.min(1, numeric));
}

function asNullableInteger(value: unknown): number | null {
  const numeric = asFiniteNumber(value);
  return numeric === null ? null : Math.max(1, Math.round(numeric));
}

function asResourceKind(value: unknown): RepairKnowledgePackResource["kind"] {
  const normalized = typeof value === "string" ? value.trim().toLowerCase() : "";
  if (
    normalized === "schematic" ||
    normalized === "board-image" ||
    normalized === "thread" ||
    normalized === "datasheet" ||
    normalized === "note"
  ) {
    return normalized;
  }
  if (normalized === "board_image" || normalized === "board image") return "board-image";
  return "note";
}

function slugifyRepairId(value: string, fallback: string): string {
  const slug = value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return slug === "" ? fallback : slug;
}

function readKnowledgeResources(value: unknown): RepairKnowledgePackResource[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((entry, index): RepairKnowledgePackResource[] => {
    const record = toRecord(entry);
    const label =
      asNonEmptyString(record["label"]) ??
      asNonEmptyString(record["title"]) ??
      asNonEmptyString(record["name"]);
    if (label === null) return [];
    const id =
      asNonEmptyString(record["id"]) ??
      `${asResourceKind(record["kind"])}-${slugifyRepairId(label, String(index + 1))}`;
    return [
      {
        id,
        label,
        kind: asResourceKind(record["kind"] ?? record["type"]),
        src: asNonEmptyString(record["src"]) ?? asNonEmptyString(record["url"]),
        source: asNonEmptyString(record["source"]) ?? "AI research",
        pages: asNullableInteger(record["pages"]),
        confidence: asConfidence(record["confidence"]),
      },
    ];
  });
}

function readCommonFailures(value: unknown): RepairCommonFailure[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((entry, index): RepairCommonFailure[] => {
    const record = toRecord(entry);
    const label =
      asNonEmptyString(record["label"]) ??
      asNonEmptyString(record["title"]) ??
      asNonEmptyString(record["failure"]);
    const recommendedAction =
      asNonEmptyString(record["recommendedAction"]) ??
      asNonEmptyString(record["action"]) ??
      asNonEmptyString(record["nextStep"]);
    if (label === null || recommendedAction === null) return [];
    return [
      {
        id:
          asNonEmptyString(record["id"]) ?? `failure-${slugifyRepairId(label, String(index + 1))}`,
        label,
        rationale: asNonEmptyString(record["rationale"]) ?? "AI research correlation.",
        affectedPart:
          asNonEmptyString(record["affectedPart"]) ?? asNonEmptyString(record["component"]),
        recommendedAction,
        confidence: asConfidence(record["confidence"]),
        spatialRef: null,
      },
    ];
  });
}

function readTestPoints(value: unknown): RepairTestPoint[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((entry, index): RepairTestPoint[] => {
    const record = toRecord(entry);
    const label =
      asNonEmptyString(record["label"]) ??
      asNonEmptyString(record["name"]) ??
      asNonEmptyString(record["id"]);
    const expectedValue = asFiniteNumber(record["expectedValue"] ?? record["value"]);
    const unit = asNonEmptyString(record["unit"]);
    if (label === null || expectedValue === null || unit === null) return [];
    return [
      {
        id: asNonEmptyString(record["id"]) ?? `tp-${slugifyRepairId(label, String(index + 1))}`,
        label,
        rail: asNonEmptyString(record["rail"]) ?? label,
        expectedValue,
        unit,
        tolerance: asFiniteNumber(record["tolerance"]),
        pinAt: null,
        spatialRef: null,
      },
    ];
  });
}

function readBridgeReplyText(result: Record<string, unknown>): string | null {
  const reply = toRecord(result["reply"]);
  return (
    asNonEmptyString(reply["text"]) ??
    asNonEmptyString(reply["content"]) ??
    asNonEmptyString(result["text"]) ??
    asNonEmptyString(result["content"]) ??
    asNonEmptyString(result["message"]) ??
    null
  );
}

function extractJsonValue(rawText: string): unknown | null {
  const trimmed = rawText.trim();
  if (trimmed === "") return null;

  const attempts = new Set<string>([trimmed]);
  const fenceMatches = trimmed.matchAll(/```(?:json)?\s*([\s\S]*?)```/gi);
  for (const match of fenceMatches) {
    if (typeof match[1] === "string" && match[1].trim() !== "") {
      attempts.add(match[1].trim());
    }
  }

  const objectStart = trimmed.indexOf("{");
  const objectEnd = trimmed.lastIndexOf("}");
  if (objectStart !== -1 && objectEnd > objectStart) {
    attempts.add(trimmed.slice(objectStart, objectEnd + 1).trim());
  }

  const arrayStart = trimmed.indexOf("[");
  const arrayEnd = trimmed.lastIndexOf("]");
  if (arrayStart !== -1 && arrayEnd > arrayStart) {
    attempts.add(trimmed.slice(arrayStart, arrayEnd + 1).trim());
  }

  for (const attempt of attempts) {
    try {
      return JSON.parse(attempt) as unknown;
    } catch {
      continue;
    }
  }

  return null;
}

function parseRepairAiChatReply(rawText: string): RepairAiChatReplyPayload | null {
  const parsed = toRecord(extractJsonValue(rawText));
  const replyText =
    asNonEmptyString(parsed["replyText"]) ??
    asNonEmptyString(parsed["text"]) ??
    asNonEmptyString(parsed["message"]) ??
    asNonEmptyString(parsed["guidance"]);
  if (replyText === null) return null;
  return {
    replyText,
    contextRefs: asStringArray(parsed["contextRefs"]),
  };
}

function readObservationEntries(value: unknown): unknown[] {
  if (Array.isArray(value)) return value;
  const parsed = toRecord(value);
  const candidates = [
    parsed["observations"],
    parsed["observation"],
    parsed["events"],
    parsed["items"],
    parsed["marks"],
  ];
  for (const candidate of candidates) {
    if (Array.isArray(candidate)) return candidate;
    if (Object.keys(toRecord(candidate)).length > 0) return [candidate];
  }
  return Object.keys(parsed).length > 0 ? [parsed] : [];
}

function parseRepairAiTacticalObservations(rawText: string): RepairAiTacticalObservation[] {
  const parsed = extractJsonValue(rawText);
  return readObservationEntries(parsed)
    .flatMap((entry): RepairAiTacticalObservation[] => {
      const record = toRecord(entry);
      const kind = asRepairAiSeverity(record["kind"] ?? record["severity"]);
      const text =
        asNonEmptyString(record["text"]) ??
        asNonEmptyString(record["body"]) ??
        asNonEmptyString(record["message"]) ??
        asNonEmptyString(record["rationale"]);
      if (kind === null || text === null) return [];
      return [
        {
          kind,
          text,
          region: asImageRect(record["region"] ?? record["rect"]),
          contextRefs: asStringArray(record["contextRefs"]),
          linkedEventIds: asStringArray(record["linkedEventIds"]),
          linkedMeasurementIds: asStringArray(record["linkedMeasurementIds"]),
        },
      ];
    })
    .slice(0, 3);
}

function parseRepairAiKnowledgePack(rawText: string): RepairKnowledgePack | null {
  const parsed = toRecord(extractJsonValue(rawText));
  const packRecord =
    Object.keys(toRecord(parsed["knowledgePack"])).length > 0
      ? toRecord(parsed["knowledgePack"])
      : parsed;
  const modelNumber =
    asNonEmptyString(packRecord["modelNumber"]) ??
    asNonEmptyString(packRecord["model"]) ??
    asNonEmptyString(packRecord["boardCode"]);
  const deviceLabel =
    asNonEmptyString(packRecord["deviceLabel"]) ??
    asNonEmptyString(packRecord["device"]) ??
    modelNumber;
  if (modelNumber === null || deviceLabel === null) return null;

  const resources = readKnowledgeResources(packRecord["resources"]);
  const commonFailures = readCommonFailures(
    packRecord["commonFailures"] ?? packRecord["knownFailures"]
  );
  const testPoints = readTestPoints(packRecord["testPoints"]);
  const notes = asStringArray(packRecord["notes"]);
  if (
    resources.length === 0 &&
    commonFailures.length === 0 &&
    testPoints.length === 0 &&
    notes.length === 0
  ) {
    return null;
  }

  return {
    schemaVersion: REPAIR_KNOWLEDGE_PACK_SCHEMA_VERSION,
    id:
      asNonEmptyString(packRecord["id"]) ??
      `ai-kp-${slugifyRepairId(modelNumber, String(Date.now()))}`,
    modelNumber,
    deviceLabel,
    stats: {
      schematics: resources.filter((resource) => resource.kind === "schematic").length,
      boardImages: resources.filter((resource) => resource.kind === "board-image").length,
      commonFailures: commonFailures.length,
      repairNotes: notes.length,
      testPoints: testPoints.length,
    },
    resources,
    commonFailures,
    testPoints,
    notes,
    createdAt: asNonEmptyString(packRecord["createdAt"]) ?? new Date().toISOString(),
  };
}

function summarizeSession(session: RepairSession | null): Record<string, unknown> {
  if (session === null) {
    return {
      active: false,
    };
  }

  return {
    active: true,
    id: session.id,
    title: session.title,
    status: session.status,
    riskLevel: session.riskLevel,
    deviceInfo: session.deviceInfo,
    symptoms: session.symptoms,
    knowledgePackId: session.knowledgePackId,
    recentEvents: session.events.slice(-8).map((event) => ({
      id: event.id,
      kind: event.kind,
      occurredAt: event.occurredAt,
      source: event.source,
      title: "title" in event ? event.title : undefined,
      label: "label" in event ? event.label : undefined,
      reference: "reference" in event ? event.reference : undefined,
      rawDisplay: "rawDisplay" in event ? event.rawDisplay : undefined,
      unit: "unit" in event ? event.unit : undefined,
    })),
  };
}

function summarizeOperatorProfile(profile: RepairOperatorProfile): Record<string, unknown> {
  return {
    displayName: profile.displayName,
    tools: profile.bench.tools
      .filter((tool) => tool.available)
      .map((tool) => ({
        category: tool.category,
        label: tool.label,
        capabilities: tool.capabilities,
        model: tool.model,
      })),
    safety: profile.bench.safety.filter((item) => item.available).map((item) => item.label),
    preferences: profile.preferences,
    skills: profile.skills,
  };
}

function buildRepairProjectRef(session: RepairSession | null): Record<string, unknown> | null {
  return session === null
    ? null
    : {
        roomId: REPAIR_ROOM_ID,
        projectId: session.id,
        title: session.title,
      };
}

function buildRepairAiChatPrompt(request: RepairAiChatReplyRequest): string {
  return JSON.stringify(
    {
      schemaVersion: 1,
      task: "repair-room-chat-guidance",
      locale: request.locale,
      outputSchema: {
        replyText: "short operator-facing guidance text",
        contextRefs: ["session/event/test-point ids that support the guidance"],
      },
      constraints: [
        "Return JSON only.",
        "Do not invent part designators, rails, or test points that are not present in context.",
        "Prioritize safety, verification, and reversible diagnostic steps.",
        "Keep replyText concise enough for a hands-busy repair bench.",
      ],
      operatorTurn: request.operatorTurn,
      recentTurns: request.recentTurns.slice(-8),
      session: summarizeSession(request.session),
      operatorProfile: summarizeOperatorProfile(request.operatorProfile),
    },
    null,
    2
  );
}

function buildRepairAiTacticalPrompt(request: RepairAiTacticalObservationRequest): string {
  return JSON.stringify(
    {
      schemaVersion: 1,
      task: "repair-room-tactical-observation",
      locale: request.locale,
      outputSchema: {
        observations: [
          {
            kind: "risk | suggestion | action | info",
            text: "short tactical feed line",
            region: "optional image-space rect {xPx,yPx,widthPx,heightPx}",
            linkedEventIds: ["event ids that support the observation"],
            linkedMeasurementIds: ["measurement event ids that support the observation"],
            contextRefs: ["other stable refs"],
          },
        ],
      },
      constraints: [
        "Return JSON only.",
        "Do not invent part designators, rails, or test points that are not present in context.",
        "Each observation text must be 140 characters or shorter.",
        "Return at most 3 observations.",
        "Use kind=risk only for immediate operator safety or equipment reliability risk.",
      ],
      triggeringEvent: request.triggeringEvent,
      session: summarizeSession(request.session),
      operatorProfile: summarizeOperatorProfile(request.operatorProfile),
    },
    null,
    2
  );
}

function buildRepairAiKnowledgeResearchPrompt(request: RepairAiKnowledgeResearchRequest): string {
  return JSON.stringify(
    {
      schemaVersion: 1,
      task: "repair-room-knowledge-research",
      locale: request.locale,
      outputSchema: {
        knowledgePack: {
          id: "stable lowercase id",
          modelNumber: "board/model identifier",
          deviceLabel: "operator-facing device label",
          resources: [
            {
              id: "resource id",
              label: "resource title",
              kind: "schematic | board-image | thread | datasheet | note",
              source: "source name or URL",
              pages: "number or null",
              confidence: "0..1",
            },
          ],
          commonFailures: [
            {
              id: "failure id",
              label: "short failure label",
              rationale: "why this failure is relevant",
              affectedPart: "part designator or null",
              recommendedAction: "safe diagnostic or repair action",
              confidence: "0..1",
            },
          ],
          testPoints: [
            {
              id: "test point id",
              label: "test point label",
              rail: "rail name",
              expectedValue: "number",
              unit: "V | Ohm | A | Hz",
              tolerance: "number or null",
            },
          ],
          notes: ["safety and diagnostic notes"],
        },
        contextRefs: ["source ids or session refs"],
      },
      constraints: [
        "Return JSON only.",
        "Do not invent exact service-manual availability; mark source as candidate when uncertain.",
        "Prioritize safe, reversible diagnostic steps.",
        "Keep commonFailures and testPoints limited to the provided device context.",
      ],
      draft: request.draft,
      operatorProfile: summarizeOperatorProfile(request.operatorProfile),
    },
    null,
    2
  );
}

export async function requestRepairAiChatReply(
  request: RepairAiChatReplyRequest
): Promise<RepairAiChatReplyResult> {
  if (typeof request.dispatchBridge !== "function") {
    return {
      success: false,
      text: null,
      contextRefs: [],
      message: "Repair AI dispatch bridge is unavailable.",
    };
  }

  const targetSlot = request.targetSlot ?? REPAIR_AI_TARGET_SLOT;
  const projectRef = buildRepairProjectRef(request.session);
  const bridgeResult = toRecord(
    await request.dispatchBridge({
      action: "message.sendWait",
      timeoutMs: 120000,
      toSlot: targetSlot,
      ...(projectRef !== null ? { projectRef } : {}),
      payload: {
        page: "repair-room:chat",
        text: buildRepairAiChatPrompt(request),
        protocol: {
          room: REPAIR_ROOM_ID,
          scenario: REPAIR_PROTOCOL_SCENARIOS.measurementCoach,
          protocolKey: REPAIR_PROTOCOL_KEYS.measurementCoach,
        },
      },
    })
  );

  if (bridgeResult["success"] !== true) {
    return {
      success: false,
      text: null,
      contextRefs: [],
      message: asNonEmptyString(bridgeResult["message"]) ?? "Repair AI dispatch failed.",
    };
  }

  const replyText = readBridgeReplyText(bridgeResult);
  if (replyText === null) {
    return {
      success: false,
      text: null,
      contextRefs: [],
      message: "Repair AI dispatch did not return readable text.",
    };
  }

  const parsed = parseRepairAiChatReply(replyText);
  if (parsed !== null) {
    return {
      success: true,
      text: parsed.replyText,
      contextRefs: parsed.contextRefs,
    };
  }

  return {
    success: true,
    text: replyText,
    contextRefs: [],
  };
}

export async function requestRepairAiKnowledgeResearch(
  request: RepairAiKnowledgeResearchRequest
): Promise<RepairAiKnowledgeResearchResult> {
  if (typeof request.dispatchBridge !== "function") {
    return {
      success: false,
      pack: null,
      contextRefs: [],
      message: "Repair AI dispatch bridge is unavailable.",
    };
  }

  const targetSlot = request.targetSlot ?? REPAIR_AI_TARGET_SLOT;
  const bridgeResult = toRecord(
    await request.dispatchBridge({
      action: "message.sendWait",
      timeoutMs: 120000,
      toSlot: targetSlot,
      payload: {
        page: "repair-room:knowledge-research",
        text: buildRepairAiKnowledgeResearchPrompt(request),
        protocol: {
          room: REPAIR_ROOM_ID,
          scenario: REPAIR_PROTOCOL_SCENARIOS.knowledgeResearch,
          protocolKey: REPAIR_PROTOCOL_KEYS.knowledgeResearch,
        },
      },
    })
  );

  if (bridgeResult["success"] !== true) {
    return {
      success: false,
      pack: null,
      contextRefs: [],
      message: asNonEmptyString(bridgeResult["message"]) ?? "Repair AI research dispatch failed.",
    };
  }

  const replyText = readBridgeReplyText(bridgeResult);
  if (replyText === null) {
    return {
      success: false,
      pack: null,
      contextRefs: [],
      message: "Repair AI research did not return readable text.",
    };
  }

  const parsed = toRecord(extractJsonValue(replyText));
  const pack = parseRepairAiKnowledgePack(replyText);
  if (pack === null) {
    return {
      success: false,
      pack: null,
      contextRefs: asStringArray(parsed["contextRefs"]),
      message: "Repair AI research did not return a usable knowledge pack.",
    };
  }

  return {
    success: true,
    pack,
    contextRefs: asStringArray(parsed["contextRefs"]),
  };
}

export async function requestRepairAiTacticalObservations(
  request: RepairAiTacticalObservationRequest
): Promise<RepairAiTacticalObservationResult> {
  if (typeof request.dispatchBridge !== "function") {
    return {
      success: false,
      observations: [],
      message: "Repair AI dispatch bridge is unavailable.",
    };
  }

  const targetSlot = request.targetSlot ?? REPAIR_AI_TARGET_SLOT;
  const projectRef = buildRepairProjectRef(request.session);
  const bridgeResult = toRecord(
    await request.dispatchBridge({
      action: "message.sendWait",
      timeoutMs: 120000,
      toSlot: targetSlot,
      ...(projectRef !== null ? { projectRef } : {}),
      payload: {
        page: "repair-room:tactical-observer",
        text: buildRepairAiTacticalPrompt(request),
        protocol: {
          room: REPAIR_ROOM_ID,
          scenario: REPAIR_PROTOCOL_SCENARIOS.tacticalObserver,
          protocolKey: REPAIR_PROTOCOL_KEYS.tacticalObserver,
        },
      },
    })
  );

  if (bridgeResult["success"] !== true) {
    return {
      success: false,
      observations: [],
      message: asNonEmptyString(bridgeResult["message"]) ?? "Repair AI dispatch failed.",
    };
  }

  const replyText = readBridgeReplyText(bridgeResult);
  if (replyText === null) {
    return {
      success: false,
      observations: [],
      message: "Repair AI dispatch did not return readable text.",
    };
  }

  const observations = parseRepairAiTacticalObservations(replyText);
  if (observations.length === 0) {
    return {
      success: false,
      observations: [],
      message: "Repair AI tactical reply did not contain observations.",
    };
  }

  return {
    success: true,
    observations,
  };
}
