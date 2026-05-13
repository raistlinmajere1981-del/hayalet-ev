import {
  REPAIR_AMBIENT_CLOCK_INTERVAL_MS,
  REPAIR_CHAT_REPLY_MAX_DELAY_MS,
  REPAIR_CHAT_REPLY_MIN_DELAY_MS,
  REPAIR_FEED_EVENT_MAX_DELAY_MS,
  REPAIR_FEED_EVENT_MIN_DELAY_MS,
  REPAIR_HOST_MESSAGES,
  REPAIR_LOCAL_OWNER_SCOPE_ID,
  REPAIR_MEASUREMENT_DRIFT_INTERVAL_MS,
  REPAIR_ROOM_ID,
  REPAIR_SESSION_SCHEMA_VERSION,
  REPAIR_UI_COLORS,
  REPAIR_UI_COMMANDS,
} from "../shared/repair-constants.js";
import {
  MOCK_REPAIR_KNOWLEDGE_PACKS,
  MOCK_REPAIR_PCB_IMAGES,
  MOCK_REPAIR_WIZARD_INITIAL,
  buildMockTacticalFeed,
  repairEventToTacticalFeedItem,
} from "../shared/data/index.js";
import type {
  RepairAiMarkLifecycleState,
  RepairAnnotationTool,
  RepairChatTurn,
  RepairEvent,
  RepairImagePoint,
  RepairImageRect,
  RepairInvestigationRegionCreatedEvent,
  RepairInvestigationRegionUpdatedEvent,
  RepairInvestigationRegionStatus,
  RepairInstrumentKind,
  RepairKnowledgeSpatialRef,
  RepairKnowledgePackProgress,
  RepairMultimeterReading,
  RepairOperatorProfileTabId,
  RepairOverlayEntityRef,
  RepairPanelId,
  RepairSession,
  RepairSessionListItem,
  RepairWizardDraft,
  RepairWizardState,
  RepairWorkbenchDrawTool,
  RepairWorkbenchTool,
} from "../shared/types/index.js";
import { createReplayRuntimeController } from "./repair-replay-runtime.js";
import {
  createInitialRepairRuntimeState,
  type RepairRuntimeState,
} from "./state/repair-runtime-state.js";
import { createRepairRuntimeStore, type RepairRuntimeStore } from "./state/repair-runtime-store.js";
import { createRepairUiSnapshot, createRepairUiSnapshotMeta } from "./state/repair-selectors.js";

interface RepairRoomApi {
  log: (level: string, message: string) => void;
  notifyRoom: (type: string, payload?: Record<string, unknown>) => void;
  getState?: (key: string) => unknown;
  setState?: (key: string, value: unknown) => unknown;
}

interface RepairCommandPayload {
  roomArgs?: Record<string, unknown>;
  roomPayload?: Record<string, unknown>;
  [key: string]: unknown;
}

const FEED_INITIAL_VISIBLE_COUNT = 3;
const MEASUREMENT_DRIFT_SEQUENCE = ["0.000", "0.001", "0.002", "0.001", "0.000", "OL"];
const WIZARD_STEP_ORDER: RepairWizardState["currentStep"][] = [
  "device-info",
  "symptoms",
  "ai-research",
  "ready",
];
const REPAIR_TOOLS: ReadonlySet<string> = new Set([
  "select",
  "pan",
  "zoom-in",
  "zoom-out",
  "rect",
  "circle",
  "freehand",
  "arrow",
  "text",
  "measurement-pin",
  "freeze-frame",
  "snapshot",
  "ruler",
]);
const ANNOTATION_TOOLS: ReadonlySet<string> = new Set([
  "rect",
  "circle",
  "freehand",
  "arrow",
  "text",
  "measurement-pin",
  "measurement-link",
]);
const AI_MARK_LIFECYCLE_STATES: ReadonlySet<string> = new Set([
  "detected",
  "acknowledged",
  "investigating",
  "resolved",
  "dismissed",
  "expired",
]);
const INVESTIGATION_REGION_STATUSES: ReadonlySet<string> = new Set([
  "draft",
  "active",
  "watching",
  "resolved",
  "dismissed",
]);
const OVERLAY_ENTITY_KINDS: ReadonlySet<string> = new Set([
  "event",
  "investigation-region",
  "temporary-spatial-region",
  "knowledge-region",
  "measurement-relationship",
  "live-edge",
]);
const PANEL_IDS: ReadonlySet<string> = new Set([
  "session-rail",
  "workbench-stage",
  "tactical-feed",
  "session-wizard",
  "knowledge-pack",
  "visual-timeline",
  "operator-profile",
  "chat",
  "measurement",
  "room-sync",
]);
const INSTRUMENT_KINDS: ReadonlySet<string> = new Set(["multimeter", "power-supply", "signal-gen"]);
const OPERATOR_PROFILE_TABS: ReadonlySet<string> = new Set([
  "overview",
  "tools",
  "skills",
  "preferences",
]);

function nowIso(): string {
  return new Date().toISOString();
}

function unrefTimer(timer: ReturnType<typeof setInterval> | ReturnType<typeof setTimeout>): void {
  if (typeof timer === "object" && typeof timer.unref === "function") {
    timer.unref();
  }
}

function buildSessionList(sessions: Record<string, RepairSession>): RepairSessionListItem[] {
  return Object.values(sessions)
    .map((session) => ({
      id: session.id,
      title: session.title,
      deviceLabel: session.deviceInfo.deviceLabel,
      boardCode: session.deviceInfo.boardCode,
      serialNumber: session.deviceInfo.serialNumber,
      status: session.status,
      riskLevel: session.riskLevel,
      updatedAt: session.updatedAt,
      isArchived: session.status === "archived",
    }))
    .sort(
      (a, b) =>
        Number(a.isArchived) - Number(b.isArchived) || b.updatedAt.localeCompare(a.updatedAt)
    );
}

function getActiveSession(state: RepairRuntimeState): RepairSession | null {
  return state.activeSessionId === null ? null : (state.sessions[state.activeSessionId] ?? null);
}

function safeString(value: unknown): string | null {
  return typeof value === "string" && value.trim() !== "" ? value.trim() : null;
}

function safeStringArray(value: unknown): string[] | null {
  if (!Array.isArray(value)) return null;
  return value.map((item) => safeString(item)).filter((item): item is string => item !== null);
}

function uniqueStringList(values: string[]): string[] {
  return Array.from(new Set(values));
}

function safeNumber(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function safeImagePoint(value: unknown): RepairImagePoint | null {
  if (typeof value !== "object" || value === null) return null;
  const record = value as Record<string, unknown>;
  const xPx = safeNumber(record["xPx"]);
  const yPx = safeNumber(record["yPx"]);
  if (xPx === null || yPx === null) return null;
  return { xPx, yPx };
}

function safeImageRect(value: unknown): RepairImageRect | null {
  if (typeof value !== "object" || value === null) return null;
  const record = value as Record<string, unknown>;
  const xPx = safeNumber(record["xPx"]);
  const yPx = safeNumber(record["yPx"]);
  const widthPx = safeNumber(record["widthPx"]);
  const heightPx = safeNumber(record["heightPx"]);
  if (xPx === null || yPx === null || widthPx === null || heightPx === null) return null;
  return {
    xPx,
    yPx,
    widthPx: Math.max(1, widthPx),
    heightPx: Math.max(1, heightPx),
  };
}

function safeOverlayEntityRef(value: unknown): RepairOverlayEntityRef | null {
  if (typeof value !== "object" || value === null) return null;
  const record = value as Record<string, unknown>;
  const kind = safeString(record["kind"]);
  const id = safeString(record["id"]);
  if (kind === null || id === null || !OVERLAY_ENTITY_KINDS.has(kind)) return null;
  return { kind: kind as RepairOverlayEntityRef["kind"], id };
}

function safeOverlayEntityRefs(value: unknown): RepairOverlayEntityRef[] | null {
  if (!Array.isArray(value)) return null;
  return value
    .map(safeOverlayEntityRef)
    .filter((ref): ref is RepairOverlayEntityRef => ref !== null);
}

function isInvestigationRegionStatus(value: unknown): value is RepairInvestigationRegionStatus {
  return typeof value === "string" && INVESTIGATION_REGION_STATUSES.has(value);
}

function clampWorkbenchPan(
  panXPx: number,
  panYPx: number,
  zoom: number,
  session: RepairSession | null
): { panXPx: number; panYPx: number } {
  const image = session?.pcbImage ?? null;
  const maxX = image === null ? 2000 : Math.max(0, image.widthPx * Math.max(0, zoom - 1));
  const maxY = image === null ? 1200 : Math.max(0, image.heightPx * Math.max(0, zoom - 1));
  return {
    panXPx: Math.max(-maxX, Math.min(maxX, panXPx)),
    panYPx: Math.max(-maxY, Math.min(maxY, panYPx)),
  };
}

function isWorkbenchTool(value: unknown): value is RepairWorkbenchTool {
  return typeof value === "string" && REPAIR_TOOLS.has(value);
}

function isAnnotationTool(value: unknown): value is RepairWorkbenchDrawTool {
  return typeof value === "string" && ANNOTATION_TOOLS.has(value);
}

function isAiMarkLifecycleState(value: unknown): value is RepairAiMarkLifecycleState {
  return typeof value === "string" && AI_MARK_LIFECYCLE_STATES.has(value);
}

function isPanelId(value: unknown): value is RepairPanelId {
  return typeof value === "string" && PANEL_IDS.has(value);
}

function isInstrumentKind(value: unknown): value is RepairInstrumentKind {
  return typeof value === "string" && INSTRUMENT_KINDS.has(value);
}

function isOperatorProfileTab(value: unknown): value is RepairOperatorProfileTabId {
  return typeof value === "string" && OPERATOR_PROFILE_TABS.has(value);
}

function createEventId(prefix: string, _iso: string): string {
  return `${prefix}-${globalThis.crypto.randomUUID()}`;
}

function getAnnotationMetaTool(tool: RepairWorkbenchDrawTool): RepairAnnotationTool {
  if (tool === "measurement-pin") return "measurement-link";
  if (tool === "circle") return "rect";
  return tool;
}

function phaseForSession(session: RepairSession | null): RepairRuntimeState["phase"] {
  if (session === null) return "idle";
  if (session.status === "paused") return "session-paused";
  if (session.status === "draft" || session.status === "research" || session.status === "ready") {
    return "wizard-active";
  }
  return "session-active";
}

function getSessionTimelineMs(session: RepairSession | null): number {
  if (session === null) return 0;
  const lastEventMs =
    session.events.length === 0
      ? 0
      : Math.max(
          ...session.events.map((event) =>
            Math.max(0, Date.parse(event.occurredAt) - Date.parse(session.startedAt))
          )
        );
  return Math.max(0, lastEventMs);
}

function patchWizardDraftFromPayload(
  payload: Record<string, unknown>
): Partial<RepairWizardDraft> | null {
  const draftPayload = payload["wizardDraft"];
  if (typeof draftPayload === "object" && draftPayload !== null) {
    const raw = draftPayload as Record<string, unknown>;
    const patch: Partial<RepairWizardDraft> = {};
    const stringFields: Array<keyof Omit<RepairWizardDraft, "primarySymptoms">> = [
      "manufacturer",
      "model",
      "boardCode",
      "serialNumber",
      "intakeNotes",
      "symptomFreeText",
    ];
    stringFields.forEach((field) => {
      const value = raw[field];
      if (typeof value === "string") {
        patch[field] = value;
      }
    });
    const symptoms = raw["primarySymptoms"];
    if (Array.isArray(symptoms)) {
      patch.primarySymptoms = symptoms.filter((item): item is string => typeof item === "string");
    }
    return Object.keys(patch).length === 0 ? null : patch;
  }

  const field = safeString(payload["wizardField"]);
  const value = payload["value"];
  if (
    field === "manufacturer" ||
    field === "model" ||
    field === "boardCode" ||
    field === "serialNumber" ||
    field === "intakeNotes" ||
    field === "symptomFreeText"
  ) {
    return typeof value === "string" ? { [field]: value } : null;
  }
  if (field === "primarySymptoms" && Array.isArray(value)) {
    return { primarySymptoms: value.filter((item): item is string => typeof item === "string") };
  }
  return null;
}

function createDraftSession(state: RepairRuntimeState, iso: string): RepairSession {
  const draft = state.wizard.draft;
  const id = createEventId("repair-draft", iso);
  const boardCode = draft.boardCode.trim() || "BOARD-PENDING";
  return {
    schemaVersion: REPAIR_SESSION_SCHEMA_VERSION,
    id,
    roomId: REPAIR_ROOM_ID,
    ownerScopeId: REPAIR_LOCAL_OWNER_SCOPE_ID,
    title: `RR-${iso.slice(5, 10).replace("-", "")}-${iso.slice(11, 16).replace(":", "")}`,
    status: "draft",
    riskLevel: "medium",
    deviceInfo: {
      deviceLabel: draft.model.trim() || "Bench intake draft",
      manufacturer: draft.manufacturer.trim() || "Unknown",
      model: draft.model.trim() || "Model pending",
      boardCode,
      serialNumber: draft.serialNumber.trim() || "S/N pending",
      intakeNotes: draft.intakeNotes.trim() || "Awaiting intake notes.",
    },
    symptoms: {
      primarySymptoms: draft.primarySymptoms,
      freeText: draft.symptomFreeText.trim() || "Symptoms pending.",
      reportedAt: iso,
    },
    pcbImage: MOCK_REPAIR_PCB_IMAGES["psu-2025-0510"] ?? null,
    knowledgePackId: null,
    knowledgePack: null,
    events: [
      {
        kind: "session-start",
        id: createEventId("evt-draft-start", iso),
        sessionId: id,
        occurredAt: iso,
        source: "system",
        linkedEventIds: [],
        title: "Draft repair session opened",
      },
    ],
    sessionNotes: "Draft session created from Repair Room wizard.",
    startedAt: iso,
    updatedAt: iso,
    archivedAt: null,
  };
}

function createSnapshotEvent(sessionId: string, iso: string, caption: string): RepairEvent {
  return {
    kind: "snapshot",
    id: createEventId("evt-snap", iso),
    sessionId,
    occurredAt: iso,
    source: "operator",
    linkedEventIds: [],
    thumbnailSrc: null,
    caption,
  };
}

function createAnnotationEvent(
  sessionId: string,
  iso: string,
  tool: RepairWorkbenchDrawTool,
  payload: Record<string, unknown>
): RepairEvent {
  const xPx = safeNumber(payload["xPx"]) ?? 520;
  const yPx = safeNumber(payload["yPx"]) ?? 320;
  const widthPx = Math.max(tool === "arrow" ? 1 : 28, safeNumber(payload["widthPx"]) ?? 112);
  const heightPx = Math.max(tool === "arrow" ? 0 : 28, safeNumber(payload["heightPx"]) ?? 84);
  const label =
    safeString(payload["label"]) ??
    (tool === "measurement-pin" ? "Measurement pin" : "Operator annotation");
  return {
    kind: "annotation",
    id: createEventId("evt-anno", iso),
    sessionId,
    occurredAt: iso,
    source: "operator",
    linkedEventIds: [],
    tool,
    region: tool === "measurement-pin" ? null : { xPx, yPx, widthPx, heightPx },
    point: tool === "measurement-pin" ? { xPx, yPx } : null,
    label,
    color: safeString(payload["color"]) ?? REPAIR_UI_COLORS.cyan,
    meta: {
      author: "operator",
      tool: getAnnotationMetaTool(tool),
      label,
      color: safeString(payload["color"]) ?? REPAIR_UI_COLORS.cyan,
      linkedMeasurementIds:
        typeof payload["linkedMeasurementId"] === "string" ? [payload["linkedMeasurementId"]] : [],
      linkedEventIds:
        typeof payload["linkedEventId"] === "string" ? [payload["linkedEventId"]] : [],
    },
  };
}

function createMeasurementReading(
  iso: string,
  payload: Record<string, unknown>
): RepairMultimeterReading {
  const rawDisplay = safeString(payload["rawDisplay"]) ?? "0.002";
  const value = rawDisplay === "OL" ? null : (safeNumber(payload["value"]) ?? Number(rawDisplay));
  return {
    id: createEventId("reading", iso),
    occurredAt: iso,
    mode: "dc-voltage",
    range: safeString(payload["range"]) ?? "20 V",
    channel: safeString(payload["channel"]) ?? "COM/VΩ",
    rawDisplay,
    value: Number.isFinite(value) ? value : null,
    unit: safeString(payload["unit"]) ?? "V",
    reference: safeString(payload["reference"]) ?? "Manual probe",
  };
}

function createMeasurementEvent(
  sessionId: string,
  iso: string,
  reading: RepairMultimeterReading,
  payload: Record<string, unknown>
): RepairEvent {
  return {
    kind: "measurement",
    id: createEventId("evt-meas", iso),
    sessionId,
    occurredAt: iso,
    source: "instrument",
    linkedEventIds: [],
    instrumentId: "multimeter-fnirsi-dmt99",
    channel: reading.channel,
    mode: "DCV",
    range: reading.range,
    value: reading.value,
    rawDisplay: reading.rawDisplay,
    unit: reading.unit,
    pinAt: {
      xPx: safeNumber(payload["xPx"]) ?? 624,
      yPx: safeNumber(payload["yPx"]) ?? 320,
    },
    reference: reading.reference,
  };
}

function getRegionFromKnowledgeSpatialRef(
  spatialRef: RepairKnowledgeSpatialRef
): RepairImageRect | null {
  if (spatialRef.region !== null && spatialRef.region !== undefined) return spatialRef.region;
  if (spatialRef.point !== null && spatialRef.point !== undefined) {
    return {
      xPx: Math.max(0, spatialRef.point.xPx - 24),
      yPx: Math.max(0, spatialRef.point.yPx - 24),
      widthPx: 48,
      heightPx: 48,
    };
  }
  return null;
}

function findKnowledgeSpatialRegion(
  session: RepairSession,
  spatialRefId: string
): { id: string; label: string; region: RepairImageRect; linkedEventIds: string[] } | null {
  const pack = session.knowledgePack;
  if (pack === null) return null;

  for (const failure of pack.commonFailures) {
    if (
      failure.id !== spatialRefId ||
      failure.spatialRef === null ||
      failure.spatialRef === undefined
    ) {
      continue;
    }
    const region = getRegionFromKnowledgeSpatialRef(failure.spatialRef);
    if (region !== null) {
      return {
        id: failure.id,
        label: failure.label,
        region,
        linkedEventIds:
          failure.spatialRef.linkedSnapshotId === null ||
          failure.spatialRef.linkedSnapshotId === undefined
            ? []
            : [failure.spatialRef.linkedSnapshotId],
      };
    }
  }

  for (const point of pack.testPoints) {
    if (point.id !== spatialRefId) continue;
    const region =
      point.spatialRef === null || point.spatialRef === undefined
        ? point.pinAt === null
          ? null
          : {
              xPx: Math.max(0, point.pinAt.xPx - 24),
              yPx: Math.max(0, point.pinAt.yPx - 24),
              widthPx: 48,
              heightPx: 48,
            }
        : getRegionFromKnowledgeSpatialRef(point.spatialRef);
    if (region !== null) {
      return {
        id: point.id,
        label: point.label,
        region,
        linkedEventIds:
          point.spatialRef?.linkedSnapshotId === null ||
          point.spatialRef?.linkedSnapshotId === undefined
            ? []
            : [point.spatialRef.linkedSnapshotId],
      };
    }
  }

  for (const resource of pack.resources) {
    const spatialRefs = resource.spatialRefs ?? [];
    for (let index = 0; index < spatialRefs.length; index += 1) {
      const spatialRef = spatialRefs[index];
      const id = `${resource.id}:spatial-${index}`;
      if (spatialRef === undefined || id !== spatialRefId) continue;
      const region = getRegionFromKnowledgeSpatialRef(spatialRef);
      if (region !== null) {
        return {
          id,
          label: spatialRef.label,
          region,
          linkedEventIds:
            spatialRef.linkedSnapshotId === null || spatialRef.linkedSnapshotId === undefined
              ? []
              : [spatialRef.linkedSnapshotId],
        };
      }
    }
  }

  return null;
}

function collectKnowledgePromotionLinkage(
  state: RepairRuntimeState,
  session: RepairSession,
  spatialRefId: string,
  fallbackLinkedEventIds: string[]
): {
  linkedEventIds: string[];
  measurementEventIds: string[];
  annotationEventIds: string[];
  aiMarkEventIds: string[];
} {
  const projectedKnowledge = createRepairUiSnapshotMeta(state).replay.knowledgeRegions.find(
    (entry) => entry.id === spatialRefId
  );
  const measurementEventIds = uniqueStringList(projectedKnowledge?.relatedMeasurementIds ?? []);
  const aiMarkEventIds = uniqueStringList(projectedKnowledge?.relatedAiMarkIds ?? []);
  const linkedEventIds = uniqueStringList([
    ...fallbackLinkedEventIds,
    ...(projectedKnowledge?.linkedEventIds ?? []),
    ...measurementEventIds,
    ...aiMarkEventIds,
  ]);
  const relatedEventIds = new Set([...linkedEventIds, ...measurementEventIds, ...aiMarkEventIds]);
  const annotationEventIds = new Set<string>();

  session.events.forEach((event) => {
    if (event.kind === "measurement" && measurementEventIds.includes(event.id)) {
      event.linkedAnnotationIds?.forEach((id) => annotationEventIds.add(id));
      return;
    }

    if (
      (event.kind === "ai-mark" || event.kind === "risk-flag") &&
      aiMarkEventIds.includes(event.id)
    ) {
      event.linkedAnnotationIds?.forEach((id) => annotationEventIds.add(id));
      return;
    }

    if (event.kind !== "annotation") return;
    const metaLinkedMeasurementIds = event.meta?.linkedMeasurementIds ?? [];
    const metaLinkedEventIds = event.meta?.linkedEventIds ?? [];
    if (
      event.linkedEventIds.some((id) => relatedEventIds.has(id)) ||
      metaLinkedMeasurementIds.some((id) => measurementEventIds.includes(id)) ||
      metaLinkedEventIds.some((id) => relatedEventIds.has(id))
    ) {
      annotationEventIds.add(event.id);
    }
  });

  const normalizedAnnotationEventIds = uniqueStringList(
    [...annotationEventIds].filter((id) =>
      session.events.some((event) => event.id === id && event.kind === "annotation")
    )
  );

  return {
    linkedEventIds: uniqueStringList([...linkedEventIds, ...normalizedAnnotationEventIds]),
    measurementEventIds,
    annotationEventIds: normalizedAnnotationEventIds,
    aiMarkEventIds,
  };
}

function getEventIdFromOverlayRef(ref: RepairOverlayEntityRef | null): string | null {
  return ref?.kind === "event" ? ref.id : null;
}

function createInvestigationRegionCreatedEvent(
  session: RepairSession,
  iso: string,
  payload: {
    label: string;
    region: RepairImageRect;
    status: RepairInvestigationRegionStatus;
    color: string;
    sourceRef: RepairOverlayEntityRef | null;
    knowledgeSpatialRefId: string | null;
    promotedFromTemporaryRegionId: string | null;
    linkedEventIds: string[];
    measurementEventIds: string[];
    annotationEventIds: string[];
    aiMarkEventIds: string[];
  }
): RepairInvestigationRegionCreatedEvent {
  return {
    kind: "investigation-region-created",
    id: createEventId("evt-region", iso),
    sessionId: session.id,
    occurredAt: iso,
    source: "operator",
    linkedEventIds: payload.linkedEventIds,
    regionId: createEventId("region", iso),
    label: payload.label,
    region: payload.region,
    status: payload.status,
    color: payload.color,
    sourceRef: payload.sourceRef,
    knowledgeSpatialRefId: payload.knowledgeSpatialRefId,
    promotedFromTemporaryRegionId: payload.promotedFromTemporaryRegionId,
    measurementEventIds: payload.measurementEventIds,
    annotationEventIds: payload.annotationEventIds,
    aiMarkEventIds: payload.aiMarkEventIds,
  };
}

function createInvestigationRegionUpdatedEvent(
  session: RepairSession,
  iso: string,
  payload: {
    regionId: string;
    label?: string;
    region?: RepairImageRect;
    status?: RepairInvestigationRegionStatus;
    color?: string;
    sourceRef?: RepairOverlayEntityRef | null;
    knowledgeSpatialRefId?: string | null;
    promotedFromTemporaryRegionId?: string | null;
    linkedEventIds: string[];
    measurementEventIds?: string[];
    annotationEventIds?: string[];
    aiMarkEventIds?: string[];
  }
): RepairInvestigationRegionUpdatedEvent {
  const event: RepairInvestigationRegionUpdatedEvent = {
    kind: "investigation-region-updated",
    id: createEventId("evt-region-update", iso),
    sessionId: session.id,
    occurredAt: iso,
    source: "operator",
    linkedEventIds: payload.linkedEventIds,
    regionId: payload.regionId,
  };
  if (payload.label !== undefined) event.label = payload.label;
  if (payload.region !== undefined) event.region = payload.region;
  if (payload.status !== undefined) event.status = payload.status;
  if (payload.color !== undefined) event.color = payload.color;
  if (payload.sourceRef !== undefined) event.sourceRef = payload.sourceRef;
  if (payload.knowledgeSpatialRefId !== undefined) {
    event.knowledgeSpatialRefId = payload.knowledgeSpatialRefId;
  }
  if (payload.promotedFromTemporaryRegionId !== undefined) {
    event.promotedFromTemporaryRegionId = payload.promotedFromTemporaryRegionId;
  }
  if (payload.measurementEventIds !== undefined)
    event.measurementEventIds = payload.measurementEventIds;
  if (payload.annotationEventIds !== undefined)
    event.annotationEventIds = payload.annotationEventIds;
  if (payload.aiMarkEventIds !== undefined) event.aiMarkEventIds = payload.aiMarkEventIds;
  return event;
}

function setActiveSessionDerivedState(
  store: RepairRuntimeStore,
  session: RepairSession | null
): void {
  const timeline = store.getState().workbench.timeline;
  const playheadMs = getSessionTimelineMs(session);
  store.dispatchMany([
    { type: "phase/set", phase: phaseForSession(session) },
    {
      type: "workbench/set-timeline",
      playheadMs,
      zoom: timeline.zoom,
      rangeStartMs: null,
      rangeEndMs: null,
      autoFollowLive: session?.status === "in-progress",
    },
    {
      type: "knowledge-pack/set",
      pack: session?.knowledgePack ?? null,
      attachedToSessionId: session?.knowledgePack === null ? null : (session?.id ?? null),
    },
    {
      type: "tactical-feed/set",
      items:
        session === null
          ? []
          : buildMockTacticalFeed(session.events, session.startedAt).slice(
              0,
              FEED_INITIAL_VISIBLE_COUNT
            ),
    },
  ]);
}

/**
 * Phase 1 Repair Room host runtime.
 *
 * Responsibilities at this phase:
 *  - hydrate the runtime store from diegetic mock data
 *  - push state snapshots to the UI via api.notifyRoom("repair-state", …)
 *  - accept UI commands and update the store deterministically
 *
 * Out of scope: filesystem persistence, real AİÖ pipeline, real instruments, real camera.
 */
export default function createRepairRoomHostRuntime() {
  return {
    activate(api: RepairRoomApi) {
      const store = createRepairRuntimeStore(createInitialRepairRuntimeState(nowIso()));
      const feedTimeouts = new Set<ReturnType<typeof setTimeout>>();
      const researchTimeouts = new Set<ReturnType<typeof setTimeout>>();
      let clockInterval: ReturnType<typeof setInterval> | null = null;
      let measurementInterval: ReturnType<typeof setInterval> | null = null;
      let measurementTick = 0;
      let chatReplyTick = 0;
      let liveTimelineSessionId = store.getState().activeSessionId;
      let liveTimelineAnchorAtMs = Date.now();
      let liveTimelineBaseMs = getSessionTimelineMs(getActiveSession(store.getState()));
      const replayController = createReplayRuntimeController(store, () =>
        getActiveSession(store.getState())
      );

      function resetLiveTimelineAnchor(session: RepairSession | null): void {
        liveTimelineSessionId = session?.id ?? null;
        liveTimelineAnchorAtMs = Date.now();
        liveTimelineBaseMs = getSessionTimelineMs(session);
      }

      function getLiveTimelinePlayheadMs(session: RepairSession, nowMs = Date.now()): number {
        if (liveTimelineSessionId !== session.id) {
          resetLiveTimelineAnchor(session);
        }
        return Math.max(
          getSessionTimelineMs(session),
          liveTimelineBaseMs + Math.max(0, nowMs - liveTimelineAnchorAtMs)
        );
      }

      function createLiveSessionIso(session: RepairSession): string {
        const playheadMs = Math.max(
          getSessionTimelineMs(session) + 1000,
          getLiveTimelinePlayheadMs(session)
        );
        return new Date(Date.parse(session.startedAt) + playheadMs).toISOString();
      }

      function pushState(): void {
        const state = store.getState();
        api.notifyRoom(REPAIR_HOST_MESSAGES.state, {
          snapshot: createRepairUiSnapshot(state),
          meta: createRepairUiSnapshotMeta(state),
        });
      }

      function clearFeedStream(): void {
        feedTimeouts.forEach((timeoutId) => {
          clearTimeout(timeoutId);
        });
        feedTimeouts.clear();
      }

      function clearResearchStream(): void {
        researchTimeouts.forEach((timeoutId) => {
          clearTimeout(timeoutId);
        });
        researchTimeouts.clear();
      }

      function scheduleFeedStream(): void {
        clearFeedStream();
        const state = store.getState();
        const session = getActiveSession(state);
        if (session === null || session.status !== "in-progress") return;

        const visibleIds = new Set(state.tacticalFeed.map((item) => item.eventId));
        const pending = buildMockTacticalFeed(session.events, session.startedAt).filter(
          (item) => !visibleIds.has(item.eventId)
        );

        let elapsedMs = 0;
        pending.forEach((item, index) => {
          const delay =
            index % 2 === 0 ? REPAIR_FEED_EVENT_MIN_DELAY_MS : REPAIR_FEED_EVENT_MAX_DELAY_MS;
          elapsedMs += delay;
          const timeoutId = setTimeout(() => {
            const current = store.getState();
            const currentSession = getActiveSession(current);
            const alreadyVisible = current.tacticalFeed.some(
              (feedItem) => feedItem.eventId === item.eventId
            );
            if (currentSession?.id === session.id && alreadyVisible === false) {
              store.dispatch({ type: "tactical-feed/append", item });
            }
            feedTimeouts.delete(timeoutId);
          }, elapsedMs);
          unrefTimer(timeoutId);
          feedTimeouts.add(timeoutId);
        });
      }

      function scheduleResearchStream(): void {
        clearResearchStream();
        const currentWizard = store.getState().wizard;
        const progressSeed =
          currentWizard.researchProgress.length > 0
            ? currentWizard.researchProgress
            : MOCK_REPAIR_WIZARD_INITIAL.researchProgress;
        const resetProgress = progressSeed.map(
          (item): RepairKnowledgePackProgress => ({
            ...item,
            completed: false,
          })
        );

        store.dispatchMany([
          {
            type: "wizard/set",
            wizard: {
              ...currentWizard,
              currentStep: "ai-research",
              researchProgress: resetProgress,
              foundResources: [],
              generatedKnowledgePackId: null,
            },
          },
          { type: "phase/set", phase: "wizard-active" },
        ]);

        resetProgress.forEach((progress, index) => {
          const timeoutId = setTimeout(
            () => {
              const wizard = store.getState().wizard;
              const nextProgress = wizard.researchProgress.map((item) =>
                item.step === progress.step ? { ...item, completed: true } : item
              );
              store.batch(() => {
                store.dispatch({
                  type: "wizard/set",
                  wizard: {
                    ...wizard,
                    researchProgress: nextProgress,
                    foundResources:
                      index >= 1
                        ? MOCK_REPAIR_WIZARD_INITIAL.foundResources.slice(0, Math.min(index + 1, 4))
                        : [],
                    generatedKnowledgePackId:
                      index === resetProgress.length - 1
                        ? "bn44-00932a"
                        : wizard.generatedKnowledgePackId,
                    currentStep: index === resetProgress.length - 1 ? "ready" : "ai-research",
                  },
                });
                if (index === resetProgress.length - 1) {
                  store.dispatch({ type: "phase/set", phase: "session-active" });
                }
              });
              researchTimeouts.delete(timeoutId);
            },
            700 + index * 650
          );
          unrefTimer(timeoutId);
          researchTimeouts.add(timeoutId);
        });
      }

      function startLiveLoops(): void {
        if (clockInterval === null) {
          clockInterval = setInterval(() => {
            const nowMs = Date.now();
            const iso = new Date(nowMs).toISOString();
            store.batch(() => {
              store.dispatch({ type: "ambient/tick", nowIso: iso });
              const state = store.getState();
              const session = getActiveSession(state);
              const timeline = state.workbench.timeline;
              if (session?.status === "in-progress" && timeline.autoFollowLive) {
                store.dispatch({
                  type: "workbench/set-timeline",
                  playheadMs: getLiveTimelinePlayheadMs(session, nowMs),
                  zoom: timeline.zoom,
                  rangeStartMs: timeline.rangeStartMs,
                  rangeEndMs: timeline.rangeEndMs,
                  autoFollowLive: true,
                  replayMode: "live",
                  isPlaying: true,
                  liveEdgeMs: getSessionTimelineMs(session),
                });
              }
            });
          }, REPAIR_AMBIENT_CLOCK_INTERVAL_MS);
          unrefTimer(clockInterval);
        }

        if (measurementInterval === null) {
          measurementInterval = setInterval(() => {
            const state = store.getState();
            const session = getActiveSession(state);
            if (session?.status !== "in-progress" || state.workbench.isFrozen) return;
            const display =
              MEASUREMENT_DRIFT_SEQUENCE[measurementTick % MEASUREMENT_DRIFT_SEQUENCE.length] ??
              "0.000";
            measurementTick += 1;
            const reading = createMeasurementReading(nowIso(), {
              rawDisplay: display,
              range: state.measurement.current.range,
              channel: "COM/VΩ",
              unit: state.measurement.current.unit || "V",
              reference: "Live drift sample",
            });
            store.dispatchMany([
              { type: "measurement/append-reading", reading },
              {
                type: "measurement/set-display",
                display,
                value: display === "OL" ? null : Number(display),
                hold: false,
              },
            ]);
          }, REPAIR_MEASUREMENT_DRIFT_INTERVAL_MS);
          unrefTimer(measurementInterval);
        }

        scheduleFeedStream();
      }

      function appendEventToActiveSession(event: RepairEvent): boolean {
        const state = store.getState();
        const session = getActiveSession(state);
        if (session === null) return false;

        const nextSession = {
          ...session,
          events: [...session.events, event],
          updatedAt: event.occurredAt,
        };
        const feedItem = repairEventToTacticalFeedItem(event, session.startedAt);
        const timeline = store.getState().workbench.timeline;
        store.batch(() => {
          store.dispatch({ type: "session/upsert", session: nextSession });
          if (feedItem !== null) {
            store.dispatch({ type: "tactical-feed/append", item: feedItem });
          }
          if (timeline.autoFollowLive) {
            store.dispatch({
              type: "workbench/set-timeline",
              playheadMs: getSessionTimelineMs(nextSession),
              zoom: timeline.zoom,
              rangeStartMs: timeline.rangeStartMs,
              rangeEndMs: timeline.rangeEndMs,
              autoFollowLive: true,
              replayMode: "live",
              isPlaying: true,
              liveEdgeMs: getSessionTimelineMs(nextSession),
            });
          }
        });
        resetLiveTimelineAnchor(nextSession);
        return true;
      }

      function setSessionAndList(session: RepairSession): void {
        const nextSessions = {
          ...store.getState().sessions,
          [session.id]: session,
        };
        store.dispatchMany([
          { type: "session/upsert", session },
          { type: "session-list/set", list: buildSessionList(nextSessions) },
        ]);
      }

      function scheduleChatReply(operatorTurn: RepairChatTurn): void {
        const state = store.getState();
        const session = getActiveSession(state);
        const replyIndex = chatReplyTick;
        chatReplyTick += 1;
        const delay =
          replyIndex % 2 === 0 ? REPAIR_CHAT_REPLY_MIN_DELAY_MS : REPAIR_CHAT_REPLY_MAX_DELAY_MS;
        const timeoutId = setTimeout(() => {
          const current = store.getState();
          if (current.chat.pendingReplyId !== operatorTurn.id) return;
          const reply: RepairChatTurn = {
            id: createEventId("chat-ai", nowIso()),
            role: "ai",
            text:
              session === null
                ? "I have the bench context open. Select a session and I will pin the next diagnostic step."
                : `For ${session.deviceInfo.boardCode}, keep the next probe on 5V_STBY and confirm the reading before rework.`,
            occurredAt: nowIso(),
            contextRefs: session === null ? [] : [session.id, session.deviceInfo.boardCode],
          };
          store.dispatchMany([
            { type: "chat/append-turn", turn: reply },
            { type: "chat/set-pending", turnId: null },
          ]);
        }, delay);
        unrefTimer(timeoutId);
      }

      store.subscribe(() => {
        pushState();
      });

      function applyViewportUpdate(flat: Record<string, unknown>): {
        success: boolean;
        message?: string;
      } {
        const viewportZoom = safeNumber(flat["viewportZoom"] ?? flat["zoom"]);
        const panXPx = safeNumber(flat["panXPx"]);
        const panYPx = safeNumber(flat["panYPx"]);
        if (viewportZoom === null && panXPx === null && panYPx === null) {
          return { success: false, message: "viewport payload is empty" };
        }
        const viewport = store.getState().workbench.viewport;
        const nextZoom = Math.min(4, Math.max(0.5, viewportZoom ?? viewport.zoom));
        const nextPan = clampWorkbenchPan(
          panXPx ?? viewport.panXPx,
          panYPx ?? viewport.panYPx,
          nextZoom,
          getActiveSession(store.getState())
        );
        store.dispatch({
          type: "workbench/set-viewport",
          zoom: nextZoom,
          panXPx: nextPan.panXPx,
          panYPx: nextPan.panYPx,
        });
        return { success: true };
      }

      function applyTimelineUpdate(flat: Record<string, unknown>): {
        success: boolean;
        message?: string;
      } {
        const replayAction = safeString(flat["replayAction"]);
        if (replayAction === "play") {
          replayController.play();
          return { success: true };
        }
        if (replayAction === "pause") {
          replayController.pause();
          return { success: true };
        }
        if (replayAction === "live") {
          replayController.followLive();
          return { success: true };
        }
        const replaySpeed = safeNumber(flat["replaySpeed"]);
        if (replaySpeed !== null) {
          replayController.setSpeed(replaySpeed);
          return { success: true };
        }
        const timelineZoom = safeNumber(flat["timelineZoom"] ?? flat["zoom"]);
        const timelineRangeStartMs = safeNumber(
          flat["timelineRangeStartMs"] ?? flat["rangeStartMs"]
        );
        const timelineRangeEndMs = safeNumber(flat["timelineRangeEndMs"] ?? flat["rangeEndMs"]);
        const clearTimelineRange = flat["clearTimelineRange"] === true;
        if (
          timelineZoom === null &&
          timelineRangeStartMs === null &&
          timelineRangeEndMs === null &&
          clearTimelineRange === false
        ) {
          return { success: false, message: "timeline payload is empty" };
        }
        const timeline = store.getState().workbench.timeline;
        const rangeStartMs = clearTimelineRange
          ? null
          : (timelineRangeStartMs ?? timeline.rangeStartMs);
        const rangeEndMs = clearTimelineRange ? null : (timelineRangeEndMs ?? timeline.rangeEndMs);
        store.dispatch({
          type: "workbench/set-timeline",
          playheadMs: timeline.playheadMs,
          zoom: Math.min(4, Math.max(0.25, timelineZoom ?? timeline.zoom)),
          rangeStartMs,
          rangeEndMs,
          autoFollowLive: timeline.autoFollowLive,
        });
        return { success: true };
      }

      function applyPanelLayoutUpdate(flat: Record<string, unknown>): {
        success: boolean;
        message?: string;
      } {
        const panelId = flat["panelId"];
        const collapsed = flat["collapsed"];
        if (isPanelId(panelId) && typeof collapsed === "boolean") {
          store.dispatch({ type: "layout/collapse-panel", panelId, collapsed });
          return { success: true };
        }
        const pinned = flat["pinned"];
        if (isPanelId(panelId) && typeof pinned === "boolean") {
          store.dispatch({ type: "layout/pin-panel", panelId, pinned });
          return { success: true };
        }
        return { success: false, message: "panel layout payload is empty" };
      }

      function applyPanelTabUpdate(flat: Record<string, unknown>): {
        success: boolean;
        message?: string;
      } {
        const previewTabId = safeString(flat["previewTabId"]);
        if (
          previewTabId === "schematic-preview" ||
          previewTabId === "board-view" ||
          previewTabId === "notes"
        ) {
          store.dispatch({ type: "knowledge-pack/set-preview-tab", tabId: previewTabId });
          return { success: true };
        }
        const instrumentKind = flat["instrumentKind"];
        if (isInstrumentKind(instrumentKind)) {
          store.dispatch({ type: "measurement/set-instrument", instrumentKind });
          return { success: true };
        }
        const operatorProfileTabId = flat["operatorProfileTabId"];
        if (isOperatorProfileTab(operatorProfileTabId)) {
          store.dispatch({
            type: "layout/set-operator-profile-tab",
            tabId: operatorProfileTabId,
          });
          return { success: true };
        }
        const spatialRefId = safeString(flat["spatialRefId"]);
        if (spatialRefId !== null) {
          store.dispatchMany([
            { type: "knowledge-pack/set-spatial-focus", spatialRefId },
            { type: "knowledge-pack/set-preview-tab", tabId: "board-view" },
          ]);
          return { success: true };
        }
        return { success: false, message: "panel tab payload is empty" };
      }

      function refsEqual(left: RepairOverlayEntityRef, right: RepairOverlayEntityRef): boolean {
        return left.kind === right.kind && left.id === right.id;
      }

      function dedupeOverlayRefs(refs: RepairOverlayEntityRef[]): RepairOverlayEntityRef[] {
        const seen = new Set<string>();
        const next: RepairOverlayEntityRef[] = [];
        refs.forEach((ref) => {
          const key = `${ref.kind}:${ref.id}`;
          if (seen.has(key)) return;
          seen.add(key);
          next.push(ref);
        });
        return next;
      }

      function applyOverlayEntitySelection(params: {
        refs: RepairOverlayEntityRef[];
        mode: string | null;
        inspectorRef: RepairOverlayEntityRef | null;
        focusJump: boolean;
      }): void {
        const current = store.getState().workbench.selection.selectedEntityRefs;
        const nextRefs =
          params.mode === "add"
            ? dedupeOverlayRefs([...current, ...params.refs])
            : params.mode === "toggle"
              ? params.refs.reduce<RepairOverlayEntityRef[]>((selection, ref) => {
                  return selection.some((candidate) => refsEqual(candidate, ref))
                    ? selection.filter((candidate) => !refsEqual(candidate, ref))
                    : [...selection, ref];
                }, current)
              : dedupeOverlayRefs(params.refs);
        const inspectorRef = params.inspectorRef ?? params.refs.at(-1) ?? nextRefs.at(-1) ?? null;
        const selectedEventIds = nextRefs
          .filter((ref) => ref.kind === "event")
          .map((ref) => ref.id);
        const inspectorEventId = getEventIdFromOverlayRef(inspectorRef);
        store.dispatch({
          type: "workbench/set-selection",
          focusedEventId: inspectorEventId,
          selection: {
            selectedEntityRefs: nextRefs,
            selectedEventIds,
            inspectorEntityRef: inspectorRef,
            inspectorEventId,
            focusJumpEntityRef: params.focusJump ? inspectorRef : null,
            focusJumpEventId: params.focusJump ? inspectorEventId : null,
          },
        });
      }

      function clampSessionPoint(
        session: RepairSession,
        point: RepairImagePoint
      ): RepairImagePoint {
        const image = session.pcbImage;
        return {
          xPx: Math.max(0, Math.min(image?.widthPx ?? 1600, point.xPx)),
          yPx: Math.max(0, Math.min(image?.heightPx ?? 900, point.yPx)),
        };
      }

      function moveSessionRect(
        session: RepairSession,
        rect: RepairImageRect,
        delta: RepairImagePoint
      ): RepairImageRect {
        const image = session.pcbImage;
        const maxX = Math.max(0, (image?.widthPx ?? 1600) - rect.widthPx);
        const maxY = Math.max(0, (image?.heightPx ?? 900) - rect.heightPx);
        return {
          ...rect,
          xPx: Math.max(0, Math.min(maxX, rect.xPx + delta.xPx)),
          yPx: Math.max(0, Math.min(maxY, rect.yPx + delta.yPx)),
        };
      }

      function getEventNudgeCenter(event: RepairEvent): RepairImagePoint | null {
        if (event.kind === "measurement" && event.pinAt !== null) return event.pinAt;
        if (event.kind === "annotation") {
          if (event.point !== null) return event.point;
          if (event.region !== null) {
            return {
              xPx: event.region.xPx + event.region.widthPx / 2,
              yPx: event.region.yPx + event.region.heightPx / 2,
            };
          }
        }
        if ((event.kind === "ai-mark" || event.kind === "risk-flag") && event.region !== null) {
          return {
            xPx: event.region.xPx + event.region.widthPx / 2,
            yPx: event.region.yPx + event.region.heightPx / 2,
          };
        }
        return null;
      }

      function getNudgeTargetDelta(params: {
        center: RepairImagePoint;
        requestedDelta: RepairImagePoint;
        hardSnap: boolean;
        selectedKeys: Set<string>;
        snapTargets: Array<{ key: string; point: RepairImagePoint }>;
      }): RepairImagePoint {
        if (!params.hardSnap) return params.requestedDelta;
        const moved = {
          xPx: params.center.xPx + params.requestedDelta.xPx,
          yPx: params.center.yPx + params.requestedDelta.yPx,
        };
        const snap = params.snapTargets.reduce<{
          point: RepairImagePoint;
          distancePx: number;
        } | null>((best, target) => {
          if (params.selectedKeys.has(target.key)) return best;
          const distancePx = Math.hypot(moved.xPx - target.point.xPx, moved.yPx - target.point.yPx);
          if (distancePx > 14 || (best !== null && best.distancePx <= distancePx)) return best;
          return { point: target.point, distancePx };
        }, null);
        if (snap === null) return params.requestedDelta;
        return {
          xPx: params.requestedDelta.xPx + snap.point.xPx - moved.xPx,
          yPx: params.requestedDelta.yPx + snap.point.yPx - moved.yPx,
        };
      }

      function nudgeOverlaySelection(
        requestedDelta: RepairImagePoint,
        hardSnap: boolean
      ): { success: boolean; message?: string } {
        const state = store.getState();
        const session = getActiveSession(state);
        if (session === null) return { success: false, message: "active session is required" };
        const selectedRefs = state.workbench.selection.selectedEntityRefs;
        if (selectedRefs.length === 0) return { success: true };

        const selectedKeys = new Set(selectedRefs.map((ref) => `${ref.kind}:${ref.id}`));
        const replay = createRepairUiSnapshotMeta(state).replay;
        const snapTargets: Array<{ key: string; point: RepairImagePoint }> = [];
        session.events.forEach((event) => {
          const center = getEventNudgeCenter(event);
          if (center !== null) snapTargets.push({ key: `event:${event.id}`, point: center });
        });
        replay.investigationRegions.forEach((region) => {
          snapTargets.push({
            key: `investigation-region:${region.regionId}`,
            point: {
              xPx: region.region.xPx + region.region.widthPx / 2,
              yPx: region.region.yPx + region.region.heightPx / 2,
            },
          });
        });
        replay.knowledgeRegions.forEach((region) => {
          snapTargets.push({
            key: `knowledge-region:${region.id}`,
            point: {
              xPx: region.region.xPx + region.region.widthPx / 2,
              yPx: region.region.yPx + region.region.heightPx / 2,
            },
          });
        });

        const updatedEvents = session.events.map((event) => {
          const ref: RepairOverlayEntityRef = { kind: "event", id: event.id };
          if (!selectedKeys.has(`${ref.kind}:${ref.id}`)) return event;
          const center = getEventNudgeCenter(event);
          if (center === null) return event;
          const delta = getNudgeTargetDelta({
            center,
            requestedDelta,
            hardSnap,
            selectedKeys,
            snapTargets,
          });
          if (event.kind === "measurement" && event.pinAt !== null) {
            return {
              ...event,
              pinAt: clampSessionPoint(session, {
                xPx: event.pinAt.xPx + delta.xPx,
                yPx: event.pinAt.yPx + delta.yPx,
              }),
            };
          }
          if (event.kind === "annotation") {
            return {
              ...event,
              region: event.region === null ? null : moveSessionRect(session, event.region, delta),
              point:
                event.point === null
                  ? null
                  : clampSessionPoint(session, {
                      xPx: event.point.xPx + delta.xPx,
                      yPx: event.point.yPx + delta.yPx,
                    }),
            };
          }
          return event;
        });

        const iso = createLiveSessionIso(session);
        const regionUpdates = selectedRefs.flatMap((ref) => {
          if (ref.kind !== "investigation-region") return [];
          const region = replay.investigationRegions.find(
            (candidate) => candidate.regionId === ref.id
          );
          if (region === undefined) return [];
          const center = {
            xPx: region.region.xPx + region.region.widthPx / 2,
            yPx: region.region.yPx + region.region.heightPx / 2,
          };
          const delta = getNudgeTargetDelta({
            center,
            requestedDelta,
            hardSnap,
            selectedKeys,
            snapTargets,
          });
          return [
            createInvestigationRegionUpdatedEvent(session, iso, {
              regionId: region.regionId,
              region: moveSessionRect(session, region.region, delta),
              linkedEventIds: region.linkage.eventIds,
              measurementEventIds: region.linkage.measurementEventIds,
              annotationEventIds: region.linkage.annotationEventIds,
              aiMarkEventIds: region.linkage.aiMarkEventIds,
            }),
          ];
        });

        const eventsChanged = updatedEvents.some((event, index) => event !== session.events[index]);
        if (!eventsChanged && regionUpdates.length === 0) return { success: true };
        const nextSession: RepairSession = {
          ...session,
          events: [...updatedEvents, ...regionUpdates],
          updatedAt: iso,
        };
        store.batch(() => {
          setSessionAndList(nextSession);
          regionUpdates.forEach((event) => {
            const feedItem = repairEventToTacticalFeedItem(event, session.startedAt);
            if (feedItem !== null) {
              store.dispatch({ type: "tactical-feed/append", item: feedItem });
            }
          });
        });
        return { success: true };
      }

      function applyFocusUpdate(flat: Record<string, unknown>): {
        success: boolean;
        message?: string;
      } {
        let handled = false;

        if ("hoveredEntityRef" in flat) {
          const hoveredEntityRef = safeOverlayEntityRef(flat["hoveredEntityRef"]);
          store.dispatch({
            type: "workbench/set-selection",
            selection: {
              hoveredEntityRef,
              hoveredEventId: getEventIdFromOverlayRef(hoveredEntityRef),
            },
          });
          handled = true;
        }

        if ("hoveredEventId" in flat) {
          const hoveredEventId = safeString(flat["hoveredEventId"]);
          store.dispatch({
            type: "workbench/set-selection",
            selection: {
              hoveredEventId,
              hoveredEntityRef:
                hoveredEventId === null ? null : { kind: "event", id: hoveredEventId },
            },
          });
          handled = true;
        }

        if (flat["clearSelection"] === true || flat["deselect"] === true) {
          store.dispatch({
            type: "workbench/set-selection",
            focusedEventId: null,
            selection: {
              hoveredEventId: null,
              hoveredEntityRef: null,
              selectedEventIds: [],
              selectedEntityRefs: [],
              inspectorEventId: null,
              inspectorEntityRef: null,
              focusJumpEventId: null,
              focusJumpEntityRef: null,
            },
          });
          return { success: true };
        }

        const selectedEntityRefs = safeOverlayEntityRefs(
          flat["selectedEntityRefs"] ?? flat["refs"]
        );
        if (selectedEntityRefs !== null) {
          applyOverlayEntitySelection({
            refs: selectedEntityRefs,
            mode: safeString(flat["selectionMode"] ?? flat["mode"]),
            inspectorRef: safeOverlayEntityRef(flat["inspectorEntityRef"] ?? flat["inspectorRef"]),
            focusJump: flat["focusJump"] !== false,
          });
          return { success: true };
        }

        const selectedEventIds = safeStringArray(flat["selectedEventIds"]);
        if (selectedEventIds !== null) {
          const inspectorEventId =
            safeString(flat["inspectorEventId"]) ?? selectedEventIds.at(-1) ?? null;
          store.dispatch({
            type: "workbench/set-selection",
            focusedEventId: inspectorEventId,
            selection: {
              selectedEventIds,
              selectedEntityRefs: selectedEventIds.map((id) => ({ kind: "event", id })),
              inspectorEventId,
              inspectorEntityRef:
                inspectorEventId === null ? null : { kind: "event", id: inspectorEventId },
              focusJumpEventId: safeString(flat["focusJumpEventId"]) ?? inspectorEventId,
              focusJumpEntityRef:
                inspectorEventId === null ? null : { kind: "event", id: inspectorEventId },
            },
          });
          return { success: true };
        }

        const ref = safeOverlayEntityRef(flat["ref"] ?? flat["entityRef"]);
        if (ref !== null) {
          applyOverlayEntitySelection({
            refs: [ref],
            mode: safeString(flat["selectionMode"]),
            inspectorRef: ref,
            focusJump: flat["focusJump"] !== false,
          });
          return { success: true };
        }

        const eventId = safeString(flat["eventId"]);
        if (eventId !== null) {
          const selectionMode = safeString(flat["selectionMode"]);
          const currentSelection = store.getState().workbench.selection.selectedEventIds;
          const additive = selectionMode === "add" || selectionMode === "toggle";
          if (flat["jumpToEvent"] === true && additive === false) {
            replayController.jump(eventId);
            return { success: true };
          }

          const nextSelection =
            selectionMode === "add"
              ? Array.from(new Set([...currentSelection, eventId]))
              : selectionMode === "toggle"
                ? currentSelection.includes(eventId)
                  ? currentSelection.filter((selectedId) => selectedId !== eventId)
                  : [...currentSelection, eventId]
                : [eventId];
          const inspectorEventId = nextSelection.includes(eventId)
            ? eventId
            : (nextSelection.at(-1) ?? null);
          store.dispatch({
            type: "workbench/set-selection",
            focusedEventId: inspectorEventId,
            selection: {
              selectedEventIds: nextSelection,
              selectedEntityRefs: nextSelection.map((id) => ({ kind: "event", id })),
              inspectorEventId,
              inspectorEntityRef:
                inspectorEventId === null ? null : { kind: "event", id: inspectorEventId },
              focusJumpEventId: flat["focusJump"] === false ? null : (inspectorEventId ?? eventId),
              focusJumpEntityRef:
                flat["focusJump"] === false || inspectorEventId === null
                  ? null
                  : { kind: "event", id: inspectorEventId },
            },
          });
          return { success: true };
        }

        const focusMode = flat["focusMode"];
        if (typeof focusMode === "boolean") {
          store.dispatchMany([
            { type: "layout/set-focus-mode", focusMode },
            { type: "workbench/set-focus-mode", focusMode },
          ]);
          return { success: true };
        }
        const investigationMode = flat["investigationModeEnabled"] ?? flat["investigationMode"];
        if (typeof investigationMode === "boolean") {
          store.dispatch({ type: "workbench/set-investigation-mode", enabled: investigationMode });
          return { success: true };
        }
        const nudgeDelta = safeImagePoint(flat["nudgeDelta"]);
        if (nudgeDelta !== null) {
          return nudgeOverlaySelection(nudgeDelta, flat["hardSnap"] === true);
        }
        return handled ? { success: true } : { success: false, message: "focus payload is empty" };
      }

      function applyLayoutCompatibilityUpdate(flat: Record<string, unknown>): {
        success: boolean;
        message?: string;
      } {
        const panelResult = applyPanelLayoutUpdate(flat);
        if (panelResult.success) return panelResult;
        const focusResult = applyFocusUpdate(flat);
        if (focusResult.success) return focusResult;
        const tabResult = applyPanelTabUpdate(flat);
        if (tabResult.success) return tabResult;
        const viewportResult = applyViewportUpdate(flat);
        if (viewportResult.success) return viewportResult;
        const timelineResult = applyTimelineUpdate(flat);
        if (timelineResult.success) return timelineResult;
        return { success: false, message: "layout payload is empty" };
      }

      function handleCommand(
        command: string,
        payload: RepairCommandPayload = {}
      ): { success: boolean; message?: string } {
        const flat = {
          ...(payload.roomArgs ?? {}),
          ...(payload.roomPayload ?? {}),
          ...payload,
        };

        switch (command) {
          case REPAIR_UI_COMMANDS.uiReady: {
            pushState();
            startLiveLoops();
            if (store.getState().wizard.currentStep === "ai-research") {
              scheduleResearchStream();
            }
            api.log("info", `[${REPAIR_ROOM_ID}] ui-ready phase=${store.getState().phase}`);
            return { success: true };
          }
          case REPAIR_UI_COMMANDS.activateSession: {
            const sessionId = safeString(flat["sessionId"]);
            const session =
              sessionId === null ? null : (store.getState().sessions[sessionId] ?? null);
            store.batch(() => {
              store.dispatch({ type: "session/activate", sessionId: session?.id ?? null });
              setActiveSessionDerivedState(store, session);
            });
            resetLiveTimelineAnchor(session);
            scheduleFeedStream();
            return { success: true };
          }
          case REPAIR_UI_COMMANDS.createSession: {
            const iso = nowIso();
            const session = createDraftSession(store.getState(), iso);
            store.batch(() => {
              setSessionAndList(session);
              store.dispatch({ type: "session/activate", sessionId: session.id });
              setActiveSessionDerivedState(store, session);
            });
            resetLiveTimelineAnchor(session);
            return { success: true };
          }
          case REPAIR_UI_COMMANDS.updateSession: {
            const wizardPatch = patchWizardDraftFromPayload(flat);
            const state = store.getState();
            const session = getActiveSession(state);
            if (session === null) {
              if (wizardPatch !== null) {
                store.dispatch({ type: "wizard/patch-draft", patch: wizardPatch });
              }
              return { success: wizardPatch !== null, message: "active session is required" };
            }
            const iso = nowIso();
            const nextSession: RepairSession = {
              ...session,
              deviceInfo: {
                ...session.deviceInfo,
                model: safeString(flat["model"]) ?? session.deviceInfo.model,
                boardCode: safeString(flat["boardCode"]) ?? session.deviceInfo.boardCode,
                serialNumber: safeString(flat["serialNumber"]) ?? session.deviceInfo.serialNumber,
                intakeNotes: safeString(flat["intakeNotes"]) ?? session.deviceInfo.intakeNotes,
              },
              symptoms: {
                ...session.symptoms,
                freeText: safeString(flat["symptomFreeText"]) ?? session.symptoms.freeText,
              },
              updatedAt: iso,
            };
            store.batch(() => {
              if (wizardPatch !== null) {
                store.dispatch({ type: "wizard/patch-draft", patch: wizardPatch });
              }
              setSessionAndList(nextSession);
            });
            return { success: true };
          }
          case REPAIR_UI_COMMANDS.archiveSession: {
            const sessionId = safeString(flat["sessionId"]) ?? store.getState().activeSessionId;
            if (sessionId === null) return { success: false, message: "sessionId is required" };
            const session = store.getState().sessions[sessionId];
            if (session === undefined) return { success: false, message: "session was not found" };
            const iso = nowIso();
            const nextSession: RepairSession = {
              ...session,
              status: "archived",
              archivedAt: iso,
              updatedAt: iso,
            };
            const wasActive = store.getState().activeSessionId === sessionId;
            store.batch(() => {
              setSessionAndList(nextSession);
              if (wasActive) {
                store.dispatch({ type: "session/activate", sessionId: null });
                setActiveSessionDerivedState(store, null);
              }
            });
            if (wasActive) {
              resetLiveTimelineAnchor(null);
            }
            return { success: true };
          }
          case REPAIR_UI_COMMANDS.advanceWizard: {
            const requested = safeString(flat["step"]);
            const current = store.getState().wizard.currentStep;
            const currentIndex = Math.max(0, WIZARD_STEP_ORDER.indexOf(current));
            const fallbackStep =
              WIZARD_STEP_ORDER[Math.min(currentIndex + 1, WIZARD_STEP_ORDER.length - 1)] ??
              "ready";
            const nextStep = WIZARD_STEP_ORDER.includes(
              requested as RepairWizardState["currentStep"]
            )
              ? (requested as RepairWizardState["currentStep"])
              : fallbackStep;
            if (nextStep === "ai-research") {
              scheduleResearchStream();
              return { success: true };
            }
            store.dispatchMany([
              { type: "wizard/advance", step: nextStep },
              {
                type: "phase/set",
                phase: nextStep === "ready" ? "session-active" : "wizard-active",
              },
            ]);
            return { success: true };
          }
          case REPAIR_UI_COMMANDS.attachKnowledgePack: {
            const packId = safeString(flat["packId"]) ?? "bn44-00932a";
            const state = store.getState();
            const session = getActiveSession(state);
            const pack = MOCK_REPAIR_KNOWLEDGE_PACKS[packId] ?? null;
            if (session === null || pack === null)
              return { success: false, message: "session and pack are required" };
            const nextSession: RepairSession = {
              ...session,
              status: "in-progress",
              knowledgePackId: pack.id,
              knowledgePack: pack,
              updatedAt: nowIso(),
            };
            store.batch(() => {
              setSessionAndList(nextSession);
              store.dispatch({
                type: "knowledge-pack/set",
                pack,
                attachedToSessionId: session.id,
              });
              store.dispatch({ type: "phase/set", phase: "session-active" });
            });
            resetLiveTimelineAnchor(nextSession);
            scheduleFeedStream();
            return { success: true };
          }
          case REPAIR_UI_COMMANDS.setActiveTool: {
            const tool = flat["tool"];
            if (!isWorkbenchTool(tool))
              return { success: false, message: "valid tool is required" };
            const viewport = store.getState().workbench.viewport;
            if (tool === "zoom-in" || tool === "zoom-out") {
              const nextZoom = Math.min(
                4,
                Math.max(0.5, viewport.zoom + (tool === "zoom-in" ? 0.25 : -0.25))
              );
              const nextPan = clampWorkbenchPan(
                viewport.panXPx,
                viewport.panYPx,
                nextZoom,
                getActiveSession(store.getState())
              );
              store.dispatch({
                type: "workbench/set-viewport",
                zoom: nextZoom,
                panXPx: nextPan.panXPx,
                panYPx: nextPan.panYPx,
              });
              return { success: true };
            }
            if (tool === "snapshot") {
              const session = getActiveSession(store.getState());
              if (session === null)
                return { success: false, message: "active session is required" };
              return {
                success: appendEventToActiveSession(
                  createSnapshotEvent(
                    session.id,
                    createLiveSessionIso(session),
                    "Manual workbench snapshot captured."
                  )
                ),
              };
            }
            if (tool === "freeze-frame") {
              return handleCommand(REPAIR_UI_COMMANDS.toggleFreezeFrame, {});
            }
            store.dispatch({ type: "workbench/set-tool", tool });
            return { success: true };
          }
          case REPAIR_UI_COMMANDS.toggleFreezeFrame: {
            const state = store.getState();
            const session = getActiveSession(state);
            const next = state.workbench.isFrozen === false;
            const iso = session === null ? nowIso() : createLiveSessionIso(session);
            let success = true;
            store.batch(() => {
              store.dispatch({
                type: "workbench/set-frozen",
                isFrozen: next,
                frozenAt: next ? iso : null,
              });
              store.dispatch({
                type: "workbench/set-timeline",
                playheadMs: state.workbench.timeline.playheadMs,
                zoom: state.workbench.timeline.zoom,
                rangeStartMs: state.workbench.timeline.rangeStartMs,
                rangeEndMs: state.workbench.timeline.rangeEndMs,
                autoFollowLive: next === false && state.workbench.timeline.autoFollowLive,
                replayMode: next ? "freeze" : state.workbench.timeline.replayMode,
                isPlaying: next === false && state.workbench.timeline.isPlaying,
              });
              if (next && session !== null) {
                success = appendEventToActiveSession({
                  kind: "freeze-frame",
                  id: createEventId("evt-freeze", iso),
                  sessionId: session.id,
                  occurredAt: iso,
                  source: "operator",
                  linkedEventIds: [],
                  durationMs: 0,
                  reason: "Operator froze the live workbench frame.",
                });
              }
            });
            return { success };
          }
          case REPAIR_UI_COMMANDS.toggleOverlayLayer: {
            const layerId = safeString(flat["layerId"]);
            const visible = flat["visible"];
            if (layerId === null || typeof visible !== "boolean") {
              return { success: false, message: "layerId and visible are required" };
            }
            if (layerId in store.getState().workbench.visibleLayers) {
              store.dispatch({
                type: "workbench/toggle-layer",
                layerId: layerId as keyof RepairRuntimeState["workbench"]["visibleLayers"],
                visible,
              });
            }
            return { success: true };
          }
          case REPAIR_UI_COMMANDS.addTimelineEvent: {
            const session = getActiveSession(store.getState());
            if (session === null) return { success: false, message: "active session is required" };
            const iso = createLiveSessionIso(session);
            const kind = safeString(flat["kind"]);
            const event =
              kind === "snapshot"
                ? createSnapshotEvent(
                    session.id,
                    iso,
                    safeString(flat["caption"]) ?? "Snapshot captured."
                  )
                : createAnnotationEvent(
                    session.id,
                    iso,
                    isAnnotationTool(flat["tool"]) ? flat["tool"] : "rect",
                    flat
                  );
            return { success: appendEventToActiveSession(event) };
          }
          case REPAIR_UI_COMMANDS.jumpToEvent: {
            const eventId = safeString(flat["eventId"]);
            replayController.jump(eventId);
            return { success: true };
          }
          case REPAIR_UI_COMMANDS.scrubTimeline: {
            const session = getActiveSession(store.getState());
            const positionMs = safeNumber(flat["positionMs"]);
            if (session === null || positionMs === null)
              return { success: false, message: "positionMs is required" };
            const start = Date.parse(session.startedAt);
            const target = start + positionMs;
            const closest = session.events.reduce<RepairEvent | null>((best, event) => {
              if (best === null) return event;
              return Math.abs(Date.parse(event.occurredAt) - target) <
                Math.abs(Date.parse(best.occurredAt) - target)
                ? event
                : best;
            }, null);
            store.dispatchMany([
              { type: "workbench/set-focus-event", eventId: closest?.id ?? null },
            ]);
            replayController.scrub(positionMs);
            return { success: true };
          }
          case REPAIR_UI_COMMANDS.addMeasurement: {
            const session = getActiveSession(store.getState());
            if (session === null) return { success: false, message: "active session is required" };
            const iso = createLiveSessionIso(session);
            const existingEventId = safeString(flat["eventId"]);
            if (existingEventId !== null) {
              const nextSession: RepairSession = {
                ...session,
                updatedAt: iso,
                events: session.events.map((event) =>
                  event.kind === "measurement" && event.id === existingEventId
                    ? {
                        ...event,
                        pinAt: {
                          xPx: safeNumber(flat["xPx"]) ?? event.pinAt?.xPx ?? 624,
                          yPx: safeNumber(flat["yPx"]) ?? event.pinAt?.yPx ?? 320,
                        },
                      }
                    : event
                ),
              };
              store.batch(() => {
                setSessionAndList(nextSession);
                store.dispatch({ type: "workbench/set-focus-event", eventId: existingEventId });
              });
              return { success: true };
            }
            const reading = createMeasurementReading(iso, flat);
            const event = createMeasurementEvent(session.id, iso, reading, flat);
            let success = true;
            store.batch(() => {
              store.dispatch({ type: "measurement/append-reading", reading });
              store.dispatch({
                type: "measurement/set-display",
                display: reading.rawDisplay,
                value: reading.value,
                hold: false,
              });
              success = appendEventToActiveSession(event);
            });
            return { success };
          }
          case REPAIR_UI_COMMANDS.dismissAiMark: {
            const eventId = safeString(flat["eventId"]);
            const session = getActiveSession(store.getState());
            if (session === null || eventId === null)
              return { success: false, message: "eventId is required" };
            const target = session.events.find((event) => event.id === eventId);
            if (target?.kind !== "ai-mark") {
              return { success: false, message: "ai mark target is required" };
            }
            const iso = createLiveSessionIso(session);
            const lifecycleState = isAiMarkLifecycleState(flat["state"])
              ? flat["state"]
              : "dismissed";
            const lifecycleEvent: RepairEvent = {
              kind: "ai-mark-lifecycle",
              id: createEventId("evt-ai-life", iso),
              sessionId: session.id,
              occurredAt: iso,
              source: "operator",
              linkedEventIds: [target.id],
              targetEventId: target.id,
              state: lifecycleState,
              reason: safeString(flat["reason"]) ?? `Operator moved AI mark to ${lifecycleState}.`,
            };
            return { success: appendEventToActiveSession(lifecycleEvent) };
          }
          case REPAIR_UI_COMMANDS.sendChatTurn: {
            const text = safeString(flat["text"]);
            if (text === null) return { success: false, message: "text is required" };
            const activeSessionId = store.getState().activeSessionId;
            const turn: RepairChatTurn = {
              id: createEventId("chat-operator", nowIso()),
              role: "operator",
              text,
              occurredAt: nowIso(),
              contextRefs: activeSessionId === null ? [] : [activeSessionId],
            };
            store.dispatchMany([
              { type: "chat/append-turn", turn },
              { type: "chat/set-pending", turnId: turn.id },
            ]);
            scheduleChatReply(turn);
            return { success: true };
          }
          case REPAIR_UI_COMMANDS.updateOperatorProfile: {
            const profile = store.getState().operatorProfile;
            const displayName = safeString(flat["displayName"]);
            store.dispatch({
              type: "operator-profile/set",
              profile: {
                ...profile,
                displayName: displayName ?? profile.displayName,
                updatedAt: nowIso(),
              },
            });
            return { success: true };
          }
          case REPAIR_UI_COMMANDS.updateViewport:
            return applyViewportUpdate(flat);
          case REPAIR_UI_COMMANDS.updateTimeline:
            return applyTimelineUpdate(flat);
          case REPAIR_UI_COMMANDS.updatePanelLayout:
            return applyPanelLayoutUpdate(flat);
          case REPAIR_UI_COMMANDS.updatePanelTab:
            return applyPanelTabUpdate(flat);
          case REPAIR_UI_COMMANDS.updateFocus:
            return applyFocusUpdate(flat);
          case REPAIR_UI_COMMANDS.updateLayout:
            return applyLayoutCompatibilityUpdate(flat);
          case REPAIR_UI_COMMANDS.toggleInvestigationMode: {
            const enabled =
              typeof flat["enabled"] === "boolean"
                ? flat["enabled"]
                : !store.getState().workbench.investigationModeEnabled;
            store.dispatch({ type: "workbench/set-investigation-mode", enabled });
            return { success: true };
          }
          case REPAIR_UI_COMMANDS.selectOverlayEntities: {
            const refs = safeOverlayEntityRefs(flat["refs"] ?? flat["selectedEntityRefs"]);
            if (refs === null) return { success: false, message: "refs are required" };
            applyOverlayEntitySelection({
              refs,
              mode: safeString(flat["mode"] ?? flat["selectionMode"]),
              inspectorRef: safeOverlayEntityRef(
                flat["inspectorRef"] ?? flat["inspectorEntityRef"]
              ),
              focusJump: flat["focusJump"] !== false,
            });
            return { success: true };
          }
          case REPAIR_UI_COMMANDS.focusOverlayEntity: {
            const ref = safeOverlayEntityRef(flat["ref"] ?? flat["entityRef"]);
            if (ref === null) return { success: false, message: "ref is required" };
            if (ref.kind === "event" && flat["focusJump"] !== false) {
              replayController.jump(ref.id);
            }
            if (ref.kind === "live-edge") {
              replayController.followLive();
            }
            applyOverlayEntitySelection({
              refs: ref.kind === "live-edge" ? [] : [ref],
              mode: "replace",
              inspectorRef: ref,
              focusJump: flat["focusJump"] !== false,
            });
            if (ref.kind !== "event") {
              store.dispatch({ type: "workbench/focus-entity", ref, eventId: null });
            }
            return { success: true };
          }
          case REPAIR_UI_COMMANDS.focusInvestigationRegion: {
            const regionId = safeString(flat["regionId"]);
            if (regionId === null) return { success: false, message: "regionId is required" };
            const ref: RepairOverlayEntityRef = { kind: "investigation-region", id: regionId };
            store.dispatchMany([
              { type: "workbench/set-investigation-mode", enabled: true },
              { type: "workbench/focus-entity", ref, eventId: null },
              {
                type: "workbench/set-selection",
                focusedEventId: null,
                selection: {
                  selectedEventIds: [],
                  selectedEntityRefs: [ref],
                  inspectorEventId: null,
                  inspectorEntityRef: ref,
                  focusJumpEventId: null,
                  focusJumpEntityRef: ref,
                },
              },
            ]);
            return { success: true };
          }
          case REPAIR_UI_COMMANDS.focusKnowledgeSpatialRef: {
            const spatialRefId = safeString(flat["spatialRefId"]);
            if (spatialRefId === null)
              return { success: false, message: "spatialRefId is required" };
            const ref: RepairOverlayEntityRef = { kind: "knowledge-region", id: spatialRefId };
            store.dispatchMany([
              { type: "knowledge-pack/set-spatial-focus", spatialRefId },
              { type: "knowledge-pack/set-preview-tab", tabId: "board-view" },
              { type: "workbench/set-investigation-mode", enabled: true },
              { type: "workbench/focus-entity", ref, eventId: null },
              {
                type: "workbench/set-selection",
                focusedEventId: null,
                selection: {
                  selectedEventIds: [],
                  selectedEntityRefs: [ref],
                  inspectorEventId: null,
                  inspectorEntityRef: ref,
                  focusJumpEventId: null,
                  focusJumpEntityRef: ref,
                },
              },
            ]);
            return { success: true };
          }
          case REPAIR_UI_COMMANDS.promoteKnowledgeRegion: {
            const session = getActiveSession(store.getState());
            const spatialRefId = safeString(flat["spatialRefId"]);
            if (session === null || spatialRefId === null) {
              return { success: false, message: "active session and spatialRefId are required" };
            }
            const knowledgeRegion = findKnowledgeSpatialRegion(session, spatialRefId);
            if (knowledgeRegion === null) {
              return { success: false, message: "knowledge spatial ref was not found" };
            }
            const linkage = collectKnowledgePromotionLinkage(
              store.getState(),
              session,
              spatialRefId,
              knowledgeRegion.linkedEventIds
            );
            const iso = createLiveSessionIso(session);
            const event = createInvestigationRegionCreatedEvent(session, iso, {
              label: safeString(flat["label"]) ?? knowledgeRegion.label,
              region: safeImageRect(flat["region"]) ?? knowledgeRegion.region,
              status: isInvestigationRegionStatus(flat["status"]) ? flat["status"] : "active",
              color: safeString(flat["color"]) ?? REPAIR_UI_COLORS.cyan,
              sourceRef: { kind: "knowledge-region", id: spatialRefId },
              knowledgeSpatialRefId: spatialRefId,
              promotedFromTemporaryRegionId: `tmp-knowledge-${spatialRefId}`,
              linkedEventIds: linkage.linkedEventIds,
              measurementEventIds: linkage.measurementEventIds,
              annotationEventIds: linkage.annotationEventIds,
              aiMarkEventIds: linkage.aiMarkEventIds,
            });
            let success = false;
            store.batch(() => {
              success = appendEventToActiveSession(event);
              if (success) {
                store.dispatchMany([
                  { type: "workbench/set-investigation-mode", enabled: true },
                  { type: "knowledge-pack/set-spatial-focus", spatialRefId },
                  {
                    type: "workbench/set-selection",
                    focusedEventId: null,
                    selection: {
                      selectedEventIds: [],
                      selectedEntityRefs: [{ kind: "investigation-region", id: event.regionId }],
                      inspectorEventId: null,
                      inspectorEntityRef: { kind: "investigation-region", id: event.regionId },
                      focusJumpEventId: null,
                      focusJumpEntityRef: { kind: "investigation-region", id: event.regionId },
                    },
                  },
                ]);
              }
            });
            return { success };
          }
          case REPAIR_UI_COMMANDS.focusLiveEdge: {
            replayController.followLive();
            const ref: RepairOverlayEntityRef = { kind: "live-edge", id: "live-edge" };
            store.dispatchMany([
              { type: "workbench/focus-entity", ref, eventId: null },
              {
                type: "workbench/set-selection",
                focusedEventId: null,
                selection: {
                  hoveredEventId: null,
                  hoveredEntityRef: null,
                  selectedEventIds: [],
                  selectedEntityRefs: [],
                  inspectorEventId: null,
                  inspectorEntityRef: ref,
                  focusJumpEventId: null,
                  focusJumpEntityRef: ref,
                },
              },
            ]);
            return { success: true };
          }
          default:
            api.log(
              "warn",
              `[${REPAIR_ROOM_ID}] unsupported command='${command}' phase=${store.getState().phase}`
            );
            return { success: false, message: `unsupported command: ${command}` };
        }
      }

      const commandEntries = Object.values(REPAIR_UI_COMMANDS).map((commandName) => [
        commandName,
        (commandPayload: RepairCommandPayload = {}) => handleCommand(commandName, commandPayload),
      ]);
      const commands = Object.fromEntries(commandEntries) as Record<
        string,
        (commandPayload?: RepairCommandPayload) => { success: boolean; message?: string }
      >;

      api.log("info", "Repair Room host activated.");

      return {
        onRoomReady(payload: unknown) {
          void payload;
          const result = handleCommand(REPAIR_UI_COMMANDS.uiReady, {});
          if (result.success === false && result.message !== undefined) {
            api.log("warn", `[${REPAIR_ROOM_ID}] room-ready failed: ${result.message}`);
          }
        },
        commands,
        handleCommand,
        getStateSnapshot(): { state: RepairRuntimeState } {
          return { state: store.getState() };
        },
        dispose() {
          clearFeedStream();
          clearResearchStream();
          if (clockInterval !== null) {
            clearInterval(clockInterval);
            clockInterval = null;
          }
          if (measurementInterval !== null) {
            clearInterval(measurementInterval);
            measurementInterval = null;
          }
          api.log("info", "Repair Room host disposed.");
        },
      };
    },
  };
}
