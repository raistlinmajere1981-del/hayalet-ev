import {
  REPAIR_AMBIENT_CLOCK_INTERVAL_MS,
  REPAIR_FEED_EVENT_MAX_DELAY_MS,
  REPAIR_FEED_EVENT_MIN_DELAY_MS,
  REPAIR_HOST_MESSAGES,
  REPAIR_LOCAL_OWNER_SCOPE_ID,
  REPAIR_MEASUREMENT_DRIFT_INTERVAL_MS,
  REPAIR_PROTOCOL_KEYS,
  REPAIR_ROOM_ID,
  REPAIR_SESSION_SCHEMA_VERSION,
  REPAIR_UI_COLORS,
  REPAIR_UI_COMMANDS,
} from "../shared/repair-constants.js";
import { getRepairVoiceCommandPhraseMap } from "../shared/repair-action-registry.js";
import {
  requestRepairAiChatReply,
  requestRepairAiKnowledgeResearch,
  requestRepairAiTacticalObservations,
  type RepairAiDispatchBridge,
  type RepairAiRoomCommand,
  type RepairAiTacticalObservation,
} from "./repair-ai-bridge.js";
import { createRepairHostIoRuntime, type RepairHostIoRuntime } from "../shared/host/io-runtime.js";
import { readRepairRoomStorageDir } from "../shared/host/repair-paths.js";
import {
  createRepairSessionStorage,
  type RepairSessionStorageRuntime,
} from "./repair-session-storage.js";
import {
  MOCK_REPAIR_KNOWLEDGE_PACKS,
  MOCK_REPAIR_PCB_IMAGES,
  buildMockRepairAiAdaptation,
  buildMockTacticalFeed,
  repairEventToTacticalFeedItem,
} from "../shared/data/index.js";
import type {
  RepairAiMarkLifecycleState,
  RepairAmbientListeningState,
  RepairAnnotationTool,
  RepairConsumable,
  RepairChatTurn,
  RepairEvent,
  RepairImagePoint,
  RepairImageRect,
  RepairInteractionSettingsState,
  RepairInvestigationRegionCreatedEvent,
  RepairInvestigationRegionUpdatedEvent,
  RepairInvestigationRegionStatus,
  RepairInstrumentKind,
  RepairKnowledgePack,
  RepairKnowledgeSpatialRef,
  RepairKnowledgePackProgress,
  RepairLivePreviewState,
  RepairMeasurementEvent,
  RepairMultimeterReading,
  RepairOperationalProfile,
  RepairOperatorProfileTabId,
  RepairOperatorPreferences,
  RepairOverlayEntityRef,
  RepairPanelId,
  RepairSafetyItem,
  RepairSession,
  RepairSessionListItem,
  RepairSettingsOverlayTabId,
  RepairSpokenGuidanceMode,
  RepairSkillRecord,
  RepairTool,
  RepairVoiceGuidanceState,
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
import type {
  RepairAiDispatchChannel,
  RepairAiDispatchStatus,
  RepairAiTargetSlot,
  RepairOperationsSnapshot,
  RepairStorageState,
} from "../shared/ui/state.js";

interface RepairRoomApi {
  dispatchBridge?: RepairAiDispatchBridge;
  log: (level: string, message: string) => void;
  notifyRoom: (type: string, payload?: Record<string, unknown>) => void;
  operations?: {
    getStatus?: () => Promise<unknown> | unknown;
    subscribe?: (listener: (status: unknown) => void) => (() => void) | undefined;
  };
  capture?: {
    startDictation?: (requestId?: string) => Promise<RepairCaptureActionResult>;
    stopDictation?: (requestId: string) => Promise<RepairCaptureActionOutcome>;
    startAmbientListener?: (requestId?: string) => Promise<RepairCaptureActionResult>;
    stopAmbientListener?: (requestId: string) => Promise<RepairCaptureActionOutcome>;
    startCameraFeed?: (requestId?: string) => Promise<RepairCaptureActionResult>;
    stopCameraFeed?: (requestId?: string) => Promise<RepairCaptureActionResult>;
  };
  tts?: {
    speak?: (
      text: string,
      options?: { requestId?: string; mode?: "local" | "android"; language?: "tr" | "en" }
    ) => Promise<RepairTtsActionResult>;
    stop?: (requestId: string) => Promise<unknown>;
  };
  getLocale?: () => string;
  getState?: (key: string) => unknown;
  setState?: (key: string, value: unknown) => unknown;
}

interface RepairCommandPayload {
  roomArgs?: Record<string, unknown>;
  roomPayload?: Record<string, unknown>;
  [key: string]: unknown;
}

interface RepairCaptureActionOutcome {
  ok: boolean;
  message?: string;
  status?: unknown;
}

interface RepairCaptureActionResult {
  requestId: string;
  outcome: RepairCaptureActionOutcome;
}

interface RepairTtsActionResult {
  requestId: string;
  outcome: {
    status?: {
      status?: string;
      message?: string;
    };
  };
}

interface RepairRoomHostRuntimeOptions {
  autoHydrateStorage?: boolean;
  io?: RepairHostIoRuntime;
  storage?: RepairSessionStorageRuntime;
}

const FEED_INITIAL_VISIBLE_COUNT = 3;
const MEASUREMENT_DRIFT_SEQUENCE = ["0.000", "0.001", "0.002", "0.001", "0.000", "OL"];
const WIZARD_STEP_ORDER: RepairWizardState["currentStep"][] = [
  "device-info",
  "symptoms",
  "ai-research",
  "ready",
];
const REPAIR_RESEARCH_PROGRESS_TEMPLATE: RepairKnowledgePackProgress[] = [
  { step: "searching-device-info", label: "Reading device context", completed: false },
  { step: "finding-schematics", label: "Looking for schematic candidates", completed: false },
  { step: "collecting-board-images", label: "Collecting board references", completed: false },
  { step: "analyzing-common-failures", label: "Analyzing common failures", completed: false },
  { step: "preparing-knowledge-pack", label: "Preparing knowledge pack", completed: false },
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

function isRepairAiTargetSlot(value: unknown): value is RepairAiTargetSlot {
  return value === "ai1" || value === "ai2";
}

function normalizeRepairAiTargetSlot(
  value: unknown,
  fallback: RepairAiTargetSlot = "ai2"
): RepairAiTargetSlot {
  return isRepairAiTargetSlot(value) ? value : fallback;
}
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
  "repair-settings",
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
const OPERATIONAL_PROFILES: ReadonlySet<string> = new Set(["novice", "advanced"]);
const AMBIENT_LISTENING_STATES: ReadonlySet<string> = new Set(["idle", "listening", "muted"]);
const SPOKEN_GUIDANCE_MODES: ReadonlySet<string> = new Set(["silent", "brief", "step-by-step"]);
const DICTATION_ROUTES: ReadonlySet<string> = new Set(["local", "android"]);
const TTS_ROUTES: ReadonlySet<string> = new Set(["local", "android"]);
const CAMERA_FEED_PREFERENCES: ReadonlySet<string> = new Set(["manual", "android-feed"]);
const DICTATION_SUBMIT_MODES: ReadonlySet<string> = new Set(["composer", "send"]);
const SETTINGS_OVERLAY_TABS: ReadonlySet<string> = new Set(["repair-controls", "bench-operator"]);

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

function normalizeRepairOperationsSnapshot(value: unknown): RepairOperationsSnapshot | null {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return null;
  }
  const record = value as Record<string, unknown>;
  const records = record["records"];
  const updatedAt = safeNumber(record["updatedAt"]);
  if (!Array.isArray(records) || updatedAt === null) {
    return null;
  }

  return {
    updatedAt,
    records: records.flatMap((entry) => {
      if (typeof entry !== "object" || entry === null || Array.isArray(entry)) return [];
      const source = entry as Record<string, unknown>;
      const capability = safeString(source["capability"]);
      const startedAt = safeNumber(source["startedAt"]);
      const ownerSource = source["owner"];
      if (
        capability === null ||
        startedAt === null ||
        typeof ownerSource !== "object" ||
        ownerSource === null ||
        Array.isArray(ownerSource)
      ) {
        return [];
      }
      const ownerRecord = ownerSource as Record<string, unknown>;
      const ownerId = safeString(ownerRecord["id"]);
      if (ownerId === null) return [];
      const owner = {
        id: ownerId,
        label: safeString(ownerRecord["label"]) ?? ownerId,
      };
      const roomId = safeString(ownerRecord["roomId"]);
      return [
        {
          capability,
          owner: roomId === null ? owner : { ...owner, roomId },
          startedAt,
        },
      ];
    }),
  };
}

function safeNumber(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function safeRecord(value: unknown): Record<string, unknown> | null {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function normalizeRepairToolPatch(value: unknown, existing: RepairTool[]): RepairTool[] | null {
  if (!Array.isArray(value)) return null;
  const byId = new Map(existing.map((tool) => [tool.id, tool]));
  value.forEach((entry) => {
    const record = safeRecord(entry);
    const id = safeString(record?.["id"]);
    if (record === null || id === null) return;
    const current = byId.get(id);
    if (current === undefined) return;
    byId.set(id, {
      ...current,
      ...(typeof record["available"] === "boolean" ? { available: record["available"] } : {}),
      ...(typeof record["model"] === "string" || record["model"] === null
        ? { model: record["model"] }
        : {}),
      ...(typeof record["notes"] === "string" || record["notes"] === null
        ? { notes: record["notes"] }
        : {}),
    });
  });
  return existing.map((tool) => byId.get(tool.id) ?? tool);
}

function normalizeRepairConsumablePatch(
  value: unknown,
  existing: RepairConsumable[]
): RepairConsumable[] | null {
  if (!Array.isArray(value)) return null;
  const byId = new Map(existing.map((item) => [item.id, item]));
  value.forEach((entry) => {
    const record = safeRecord(entry);
    const id = safeString(record?.["id"]);
    if (record === null || id === null) return;
    const current = byId.get(id);
    if (current === undefined) return;
    byId.set(id, {
      ...current,
      ...(typeof record["available"] === "boolean" ? { available: record["available"] } : {}),
      ...(typeof record["notes"] === "string" || record["notes"] === null
        ? { notes: record["notes"] }
        : {}),
    });
  });
  return existing.map((item) => byId.get(item.id) ?? item);
}

function normalizeRepairSafetyPatch(
  value: unknown,
  existing: RepairSafetyItem[]
): RepairSafetyItem[] | null {
  if (!Array.isArray(value)) return null;
  const byId = new Map(existing.map((item) => [item.id, item]));
  value.forEach((entry) => {
    const record = safeRecord(entry);
    const id = safeString(record?.["id"]);
    if (record === null || id === null) return;
    const current = byId.get(id);
    if (current === undefined) return;
    byId.set(id, {
      ...current,
      ...(typeof record["available"] === "boolean" ? { available: record["available"] } : {}),
    });
  });
  return existing.map((item) => byId.get(item.id) ?? item);
}

function normalizeRepairSkillsPatch(
  value: unknown,
  existing: RepairSkillRecord[]
): RepairSkillRecord[] | null {
  if (!Array.isArray(value)) return null;
  const byId = new Map(existing.map((skill) => [skill.id, skill]));
  value.forEach((entry) => {
    const record = safeRecord(entry);
    const id = safeString(record?.["id"]);
    const proficiency = safeNumber(record?.["proficiency"]);
    if (record === null || id === null || proficiency === null) return;
    const current = byId.get(id);
    if (current === undefined) return;
    byId.set(id, {
      ...current,
      proficiency: Math.max(
        1,
        Math.min(5, Math.round(proficiency))
      ) as RepairSkillRecord["proficiency"],
    });
  });
  return existing.map((skill) => byId.get(skill.id) ?? skill);
}

function normalizeRepairPreferencesPatch(
  value: unknown,
  existing: RepairOperatorPreferences
): Partial<RepairOperatorPreferences> | null {
  const record = safeRecord(value);
  if (record === null) return null;
  const patch: Partial<RepairOperatorPreferences> = {};
  if (record["measurementSystem"] === "metric" || record["measurementSystem"] === "imperial") {
    patch.measurementSystem = record["measurementSystem"];
  }
  if (typeof record["annotationDefaultColor"] === "string") {
    patch.annotationDefaultColor = record["annotationDefaultColor"];
  }
  const strokeWidth = safeNumber(record["annotationDefaultStrokeWidth"]);
  if (strokeWidth !== null) {
    patch.annotationDefaultStrokeWidth = Math.max(1, Math.min(8, Math.round(strokeWidth)));
  }
  if (
    record["riskTolerance"] === "low" ||
    record["riskTolerance"] === "medium" ||
    record["riskTolerance"] === "high"
  ) {
    patch.riskTolerance = record["riskTolerance"];
  }
  if (
    record["aiVerbosity"] === "terse" ||
    record["aiVerbosity"] === "standard" ||
    record["aiVerbosity"] === "detailed"
  ) {
    patch.aiVerbosity = record["aiVerbosity"];
  }
  void existing;
  return Object.keys(patch).length === 0 ? null : patch;
}

function normalizeRepairLivePreview(value: unknown): RepairLivePreviewState | null {
  const record = safeRecord(value);
  if (record === null) return null;
  const source = record["source"];
  if (source !== "v4l2" && source !== "mjpeg-stream") return null;
  const devicePath = safeString(record["devicePath"]);
  const label = safeString(record["label"]);
  const width = safeNumber(record["width"]);
  const height = safeNumber(record["height"]);
  const fps = safeNumber(record["fps"]);
  if (devicePath === null || label === null || width === null || height === null || fps === null) {
    return null;
  }
  return {
    source,
    devicePath,
    streamUrl: safeString(record["streamUrl"]),
    contentType: safeString(record["contentType"]),
    label,
    width,
    height,
    fps,
  };
}

function getRepairCapturePreview(
  outcome: RepairCaptureActionOutcome
): RepairLivePreviewState | null {
  const status = safeRecord(outcome.status);
  if (status === null) return null;
  const scrcpy = safeRecord(status["scrcpy"]);
  const analyze = safeRecord(status["analyze"]);
  const scrcpyActiveSession = scrcpy === null ? null : safeRecord(scrcpy["activeSession"]);
  const scrcpyPreview = scrcpy === null ? null : scrcpy["previewVideo"];
  const scrcpyActivePreview =
    scrcpyActiveSession === null ? null : scrcpyActiveSession["previewVideo"];
  const analyzePreview = analyze === null ? null : analyze["previewVideo"];
  return (
    normalizeRepairLivePreview(scrcpyPreview) ??
    normalizeRepairLivePreview(scrcpyActivePreview) ??
    normalizeRepairLivePreview(analyzePreview)
  );
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

function isOperationalProfile(value: unknown): value is RepairOperationalProfile {
  return typeof value === "string" && OPERATIONAL_PROFILES.has(value);
}

function isAmbientListeningState(value: unknown): value is RepairAmbientListeningState {
  return typeof value === "string" && AMBIENT_LISTENING_STATES.has(value);
}

function isSpokenGuidanceMode(value: unknown): value is RepairSpokenGuidanceMode {
  return typeof value === "string" && SPOKEN_GUIDANCE_MODES.has(value);
}

function isDictationRoute(
  value: unknown
): value is RepairInteractionSettingsState["dictationRoute"] {
  return typeof value === "string" && DICTATION_ROUTES.has(value);
}

function isTtsRoute(value: unknown): value is RepairInteractionSettingsState["ttsRoute"] {
  return typeof value === "string" && TTS_ROUTES.has(value);
}

function isCameraFeedPreference(
  value: unknown
): value is RepairInteractionSettingsState["cameraFeedPreference"] {
  return typeof value === "string" && CAMERA_FEED_PREFERENCES.has(value);
}

function isDictationSubmitMode(
  value: unknown
): value is RepairInteractionSettingsState["dictationSubmitMode"] {
  return typeof value === "string" && DICTATION_SUBMIT_MODES.has(value);
}

function isSettingsOverlayTab(value: unknown): value is RepairSettingsOverlayTabId {
  return typeof value === "string" && SETTINGS_OVERLAY_TABS.has(value);
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

function createSnapshotEvent(
  sessionId: string,
  iso: string,
  caption: string,
  thumbnailSrc: string | null = null
): RepairEvent {
  return {
    kind: "snapshot",
    id: createEventId("evt-snap", iso),
    sessionId,
    occurredAt: iso,
    source: "operator",
    linkedEventIds: [],
    thumbnailSrc,
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
): RepairMeasurementEvent {
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
 *  - hydrate the runtime store from room-local session storage when available
 *  - push state snapshots to the UI via api.notifyRoom("repair-state", …)
 *  - accept UI commands and update the store deterministically
 *
 * Mock data remains the fallback when Electron room storage is unavailable.
 */
export default function createRepairRoomHostRuntime(options: RepairRoomHostRuntimeOptions = {}) {
  const ioRuntime = options.io ?? createRepairHostIoRuntime({ roomId: REPAIR_ROOM_ID });
  const sessionStorage = options.storage ?? createRepairSessionStorage(ioRuntime);
  const shouldAutoHydrateStorage = options.autoHydrateStorage !== false;

  return {
    activate(api: RepairRoomApi) {
      const store = createRepairRuntimeStore(createInitialRepairRuntimeState(nowIso()));
      const feedTimeouts = new Set<ReturnType<typeof setTimeout>>();
      let clockInterval: ReturnType<typeof setInterval> | null = null;
      let measurementInterval: ReturnType<typeof setInterval> | null = null;
      let measurementTick = 0;
      let disposed = false;
      let liveTimelineSessionId = store.getState().activeSessionId;
      let liveTimelineAnchorAtMs = Date.now();
      let liveTimelineBaseMs = getSessionTimelineMs(getActiveSession(store.getState()));
      let operationsUnsubscribe: (() => void) | null = null;
      let activeDictationRequestId: string | null = null;
      let activeAmbientRequestId: string | null = null;
      let activeCameraFeedRequestId: string | null = null;
      let activeTtsRequestId: string | null = null;
      let operationsProjectionBridgeStarted = false;
      let storageHydratePromise: Promise<void> | null = null;
      let operatorProfilePersistQueue: Promise<void> = Promise.resolve();
      let storagePersistQueue: Promise<void> = Promise.resolve();
      let storageReady = false;
      let storageRuntimePaths: unknown = null;
      const generatedKnowledgePacks = new Map<string, RepairKnowledgePack>();
      const storedChatTurnsBySessionId = new Map<string, RepairChatTurn[]>();
      const replayController = createReplayRuntimeController(store, () =>
        getActiveSession(store.getState())
      );

      function createRoomStorageState(
        status: RepairStorageState["status"],
        params: {
          message?: string | null;
          sessionCount?: number;
          storageDir?: string | null;
        } = {}
      ): RepairStorageState {
        return {
          mode: status === "ready" || status === "hydrating" ? "room-storage" : "mock",
          status,
          storageDir: params.storageDir ?? null,
          sessionCount: params.sessionCount ?? store.getState().sessionList.length,
          message: params.message ?? null,
        };
      }

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

      function setAiDispatchStatus(
        channel: RepairAiDispatchChannel,
        status: RepairAiDispatchStatus,
        params: { message?: string | null; contextRefs?: string[] } = {}
      ): void {
        const previous = store.getState().aiDispatch[channel];
        const iso = nowIso();
        store.dispatch({
          type: "ai-dispatch/set",
          channel,
          state: {
            ...previous,
            status,
            targetSlot: normalizeRepairAiTargetSlot(previous.targetSlot),
            startedAt: status === "pending" ? iso : previous.startedAt,
            completedAt: status === "pending" ? null : iso,
            message: params.message ?? null,
            contextRefs: params.contextRefs ?? previous.contextRefs,
          },
        });
      }

      function pushState(): void {
        const state = store.getState();
        api.notifyRoom(REPAIR_HOST_MESSAGES.state, {
          snapshot: createRepairUiSnapshot(state),
          meta: createRepairUiSnapshotMeta(state),
        });
      }

      function getSessionChatTurns(sessionId: string): RepairChatTurn[] {
        const state = store.getState();
        if (state.activeSessionId === sessionId) {
          return state.chat.turns;
        }
        return storedChatTurnsBySessionId.get(sessionId) ?? [];
      }

      function updateReadyStorageState(sessionCount = store.getState().sessionList.length): void {
        if (storageRuntimePaths === null) return;
        store.dispatch({
          type: "storage/set",
          storage: createRoomStorageState("ready", {
            message: "Room storage ready",
            sessionCount,
            storageDir: readRepairRoomStorageDir(storageRuntimePaths),
          }),
        });
      }

      function queuePersistSession(session: RepairSession): void {
        if (storageReady === false || storageRuntimePaths === null) {
          return;
        }

        const runtimePaths = storageRuntimePaths;
        const chatTurns = getSessionChatTurns(session.id);
        storedChatTurnsBySessionId.set(session.id, chatTurns);
        storagePersistQueue = storagePersistQueue
          .then(async () => {
            await sessionStorage.saveSessionRecord(runtimePaths, { session, chatTurns });
            if (disposed) return;
            updateReadyStorageState();
          })
          .catch((error: unknown) => {
            storageReady = false;
            storageRuntimePaths = null;
            if (disposed) return;
            api.log(
              "warn",
              `[${REPAIR_ROOM_ID}] session storage save failed: ${
                error instanceof Error ? error.message : String(error)
              }`
            );
            store.dispatch({
              type: "storage/set",
              storage: createRoomStorageState("error", {
                message: "Room storage error; using in-memory state.",
              }),
            });
          });
      }

      function queuePersistActiveSessionChat(): void {
        const state = store.getState();
        const session = getActiveSession(state);
        if (session === null) return;
        storedChatTurnsBySessionId.set(session.id, state.chat.turns);
        queuePersistSession(session);
      }

      function queuePersistOperatorProfile(): void {
        if (storageReady === false || storageRuntimePaths === null) return;
        const runtimePaths = storageRuntimePaths;
        const profile = store.getState().operatorProfile;
        operatorProfilePersistQueue = operatorProfilePersistQueue
          .then(async () => {
            await sessionStorage.saveOperatorProfileRecord(runtimePaths, profile);
            if (disposed) return;
            updateReadyStorageState();
          })
          .catch((error: unknown) => {
            storageReady = false;
            storageRuntimePaths = null;
            if (disposed) return;
            api.log(
              "warn",
              `[${REPAIR_ROOM_ID}] operator profile storage save failed: ${
                error instanceof Error ? error.message : String(error)
              }`
            );
            store.dispatch({
              type: "storage/set",
              storage: createRoomStorageState("error", {
                message: "Room storage error; using in-memory operator profile.",
              }),
            });
          });
      }

      function hydrateStorage(): Promise<void> {
        if (storageHydratePromise !== null) {
          return storageHydratePromise;
        }

        storageHydratePromise = (async () => {
          store.dispatch({
            type: "storage/set",
            storage: createRoomStorageState("hydrating", {
              message: "Room storage loading",
            }),
          });

          try {
            const runtimePaths = await ioRuntime.resolveRuntimePaths();
            const [records, storedOperatorProfile] = await Promise.all([
              sessionStorage.listSessionRecords(runtimePaths),
              sessionStorage.loadOperatorProfileRecord(runtimePaths),
            ]);
            if (disposed) return;

            storageRuntimePaths = runtimePaths;
            storageReady = true;
            storedChatTurnsBySessionId.clear();
            records.forEach((record) => {
              storedChatTurnsBySessionId.set(record.session.id, record.chatTurns);
            });

            const sessions = Object.fromEntries(
              records.map((record) => [record.session.id, record.session])
            );
            const sessionList = buildSessionList(sessions);
            const activeSession = records[0]?.session ?? null;
            store.batch(() => {
              store.dispatch({
                type: "session/hydrate",
                activeSessionId: activeSession?.id ?? null,
                sessions,
                sessionList,
              });
              store.dispatch({
                type: "chat/set-turns",
                turns:
                  activeSession === null
                    ? []
                    : (storedChatTurnsBySessionId.get(activeSession.id) ?? []),
              });
              if (storedOperatorProfile !== null) {
                store.dispatch({
                  type: "operator-profile/set",
                  adaptation: buildMockRepairAiAdaptation(storedOperatorProfile.profile),
                  profile: storedOperatorProfile.profile,
                });
              }
              setActiveSessionDerivedState(store, activeSession);
              store.dispatch({
                type: "storage/set",
                storage: createRoomStorageState("ready", {
                  message: "Room storage ready",
                  sessionCount: sessionList.length,
                  storageDir: readRepairRoomStorageDir(runtimePaths),
                }),
              });
            });
            resetLiveTimelineAnchor(activeSession);
            scheduleFeedStream();
          } catch (error: unknown) {
            storageReady = false;
            storageRuntimePaths = null;
            if (disposed) return;
            api.log(
              "debug",
              `[${REPAIR_ROOM_ID}] room storage unavailable: ${
                error instanceof Error ? error.message : String(error)
              }`
            );
            store.dispatch({
              type: "storage/set",
              storage: createRoomStorageState("fallback", {
                message: "Repair history unavailable; using current session only.",
              }),
            });
          }
        })();

        return storageHydratePromise;
      }

      function applyOperationsStatus(value: unknown): void {
        const status = normalizeRepairOperationsSnapshot(value);
        if (status === null) return;
        store.dispatch({ type: "operations/status-set", status });
        const capabilities = new Set(status.records.map((record) => record.capability));
        if (!capabilities.has("android-microphone")) {
          activeDictationRequestId = null;
        }
        if (!capabilities.has("ambient-listening")) {
          activeAmbientRequestId = null;
        }
        if (!capabilities.has("android-camera") && !capabilities.has("live-feed")) {
          activeCameraFeedRequestId = null;
          store.dispatch({ type: "operations/live-preview-set", preview: null });
        }
        if (!capabilities.has("local-tts") && !capabilities.has("android-tts")) {
          activeTtsRequestId = null;
        }
      }

      function createOperationRequestId(kind: string): string {
        return `${REPAIR_ROOM_ID}:${kind}:${globalThis.crypto.randomUUID()}`;
      }

      function logOperationFailure(kind: string, message: string): void {
        api.log("warn", `[${REPAIR_ROOM_ID}] ${kind} failed: ${message}`);
      }

      function getTtsLanguage(): "tr" | "en" {
        return (api.getLocale?.() ?? "tr").toLowerCase().startsWith("en") ? "en" : "tr";
      }

      function getCurrentGuidanceLine(): string {
        const state = createRepairUiSnapshot(store.getState());
        return state.guidance.voice.spokenLine ?? state.guidance.nextBestAction.text;
      }

      function isTerminalTtsStatus(status: string | undefined): boolean {
        return status === "done" || status === "stopped" || status === "failed";
      }

      function startDictationRequest(): { success: boolean; message?: string } {
        if (activeDictationRequestId !== null) {
          return { success: true, message: "dictation already active" };
        }
        if (typeof api.capture?.startDictation !== "function") {
          return { success: false, message: "capture dictation API is unavailable" };
        }
        if (store.getState().layout.interactionSettings.androidCompanionEnabled !== true) {
          return { success: false, message: "Android companion is disabled for Repair Room" };
        }
        const requestId = createOperationRequestId("dictation");
        activeDictationRequestId = requestId;
        void api.capture
          .startDictation(requestId)
          .then((result) => {
            activeDictationRequestId = result.requestId;
            if (result.outcome.ok !== true) {
              activeDictationRequestId = null;
              logOperationFailure("dictation", result.outcome.message ?? "unknown error");
            }
            pushState();
          })
          .catch((error: unknown) => {
            if (activeDictationRequestId === requestId) activeDictationRequestId = null;
            logOperationFailure(
              "dictation",
              error instanceof Error ? error.message : String(error)
            );
            pushState();
          });
        return { success: true };
      }

      function stopDictationRequest(): { success: boolean; message?: string } {
        if (activeDictationRequestId === null) {
          return { success: false, message: "Repair Room dictation is not active" };
        }
        if (typeof api.capture?.stopDictation !== "function") {
          return { success: false, message: "capture dictation API is unavailable" };
        }
        const requestId = activeDictationRequestId;
        void api.capture
          .stopDictation(requestId)
          .then((outcome) => {
            if (outcome.ok === true && activeDictationRequestId === requestId) {
              activeDictationRequestId = null;
            } else if (outcome.ok !== true) {
              logOperationFailure("stop dictation", outcome.message ?? "unknown error");
            }
            pushState();
          })
          .catch((error: unknown) => {
            logOperationFailure(
              "stop dictation",
              error instanceof Error ? error.message : String(error)
            );
            pushState();
          });
        return { success: true };
      }

      function startAmbientRequest(): { success: boolean; message?: string } {
        if (activeAmbientRequestId !== null) {
          return { success: true, message: "ambient listener already active" };
        }
        if (typeof api.capture?.startAmbientListener !== "function") {
          return { success: false, message: "capture ambient listener API is unavailable" };
        }
        if (store.getState().layout.interactionSettings.androidCompanionEnabled !== true) {
          return { success: false, message: "Android companion is disabled for Repair Room" };
        }
        const requestId = createOperationRequestId("ambient");
        activeAmbientRequestId = requestId;
        void api.capture
          .startAmbientListener(requestId)
          .then((result) => {
            activeAmbientRequestId = result.requestId;
            if (result.outcome.ok !== true) {
              activeAmbientRequestId = null;
              logOperationFailure("ambient listener", result.outcome.message ?? "unknown error");
            }
            pushState();
          })
          .catch((error: unknown) => {
            if (activeAmbientRequestId === requestId) activeAmbientRequestId = null;
            logOperationFailure(
              "ambient listener",
              error instanceof Error ? error.message : String(error)
            );
            pushState();
          });
        return { success: true };
      }

      function stopAmbientRequest(): { success: boolean; message?: string } {
        if (activeAmbientRequestId === null) {
          return { success: false, message: "Repair Room ambient listener is not active" };
        }
        if (typeof api.capture?.stopAmbientListener !== "function") {
          return { success: false, message: "capture ambient listener API is unavailable" };
        }
        const requestId = activeAmbientRequestId;
        void api.capture
          .stopAmbientListener(requestId)
          .then((outcome) => {
            if (outcome.ok === true && activeAmbientRequestId === requestId) {
              activeAmbientRequestId = null;
            } else if (outcome.ok !== true) {
              logOperationFailure("stop ambient listener", outcome.message ?? "unknown error");
            }
            pushState();
          })
          .catch((error: unknown) => {
            logOperationFailure(
              "stop ambient listener",
              error instanceof Error ? error.message : String(error)
            );
            pushState();
          });
        return { success: true };
      }

      function startCameraFeedRequest(): { success: boolean; message?: string } {
        if (activeCameraFeedRequestId !== null) {
          return { success: true, message: "camera feed already active" };
        }
        if (typeof api.capture?.startCameraFeed !== "function") {
          return { success: false, message: "capture camera feed API is unavailable" };
        }
        if (store.getState().layout.interactionSettings.androidCompanionEnabled !== true) {
          return { success: false, message: "Android companion is disabled for Repair Room" };
        }
        const requestId = createOperationRequestId("camera");
        activeCameraFeedRequestId = requestId;
        void api.capture
          .startCameraFeed(requestId)
          .then((result) => {
            activeCameraFeedRequestId = result.requestId;
            if (result.outcome.ok !== true) {
              activeCameraFeedRequestId = null;
              store.dispatch({ type: "operations/live-preview-set", preview: null });
              logOperationFailure("camera feed", result.outcome.message ?? "unknown error");
            } else {
              store.dispatch({
                type: "operations/live-preview-set",
                preview: getRepairCapturePreview(result.outcome),
              });
            }
            pushState();
          })
          .catch((error: unknown) => {
            if (activeCameraFeedRequestId === requestId) activeCameraFeedRequestId = null;
            store.dispatch({ type: "operations/live-preview-set", preview: null });
            logOperationFailure(
              "camera feed",
              error instanceof Error ? error.message : String(error)
            );
            pushState();
          });
        return { success: true };
      }

      function stopCameraFeedRequest(): { success: boolean; message?: string } {
        if (activeCameraFeedRequestId === null) {
          return { success: false, message: "Repair Room camera feed is not active" };
        }
        if (typeof api.capture?.stopCameraFeed !== "function") {
          return { success: false, message: "capture camera feed API is unavailable" };
        }
        const requestId = activeCameraFeedRequestId;
        void api.capture
          .stopCameraFeed(requestId)
          .then((result) => {
            if (result.outcome.ok === true && activeCameraFeedRequestId === requestId) {
              activeCameraFeedRequestId = null;
              store.dispatch({ type: "operations/live-preview-set", preview: null });
            } else if (result.outcome.ok !== true) {
              logOperationFailure("stop camera feed", result.outcome.message ?? "unknown error");
            }
            pushState();
          })
          .catch((error: unknown) => {
            logOperationFailure(
              "stop camera feed",
              error instanceof Error ? error.message : String(error)
            );
            pushState();
          });
        return { success: true };
      }

      function speakGuidanceRequest(textOverride: string | null): {
        success: boolean;
        message?: string;
      } {
        if (activeTtsRequestId !== null) {
          return { success: true, message: "TTS already active" };
        }
        if (typeof api.tts?.speak !== "function") {
          return { success: false, message: "TTS API is unavailable" };
        }
        const requestId = createOperationRequestId("tts");
        activeTtsRequestId = requestId;
        const text = textOverride ?? getCurrentGuidanceLine();
        const mode = store.getState().layout.interactionSettings.ttsRoute;
        void api.tts
          .speak(text, { requestId, mode, language: getTtsLanguage() })
          .then((result) => {
            activeTtsRequestId = result.requestId;
            const status = result.outcome.status?.status;
            if (status === "failed") {
              activeTtsRequestId = null;
              logOperationFailure("TTS", result.outcome.status?.message ?? "unknown error");
            } else if (isTerminalTtsStatus(status)) {
              activeTtsRequestId = null;
            }
            pushState();
          })
          .catch((error: unknown) => {
            if (activeTtsRequestId === requestId) activeTtsRequestId = null;
            logOperationFailure("TTS", error instanceof Error ? error.message : String(error));
            pushState();
          });
        return { success: true };
      }

      function stopSpeechRequest(): { success: boolean; message?: string } {
        if (activeTtsRequestId === null) {
          return { success: false, message: "Repair Room TTS is not active" };
        }
        if (typeof api.tts?.stop !== "function") {
          return { success: false, message: "TTS API is unavailable" };
        }
        const requestId = activeTtsRequestId;
        void api.tts
          .stop(requestId)
          .then(() => {
            if (activeTtsRequestId === requestId) activeTtsRequestId = null;
            pushState();
          })
          .catch((error: unknown) => {
            logOperationFailure("stop TTS", error instanceof Error ? error.message : String(error));
            pushState();
          });
        return { success: true };
      }

      function startOperationsProjectionBridge(): void {
        if (operationsProjectionBridgeStarted) return;
        operationsProjectionBridgeStarted = true;
        if (typeof api.operations?.getStatus === "function") {
          void Promise.resolve(api.operations.getStatus())
            .then((status) => {
              if (disposed) return;
              applyOperationsStatus(status);
              pushState();
            })
            .catch((error: unknown) => {
              api.log(
                "debug",
                `[${REPAIR_ROOM_ID}] operations status unavailable: ${
                  error instanceof Error ? error.message : String(error)
                }`
              );
            });
        }

        if (typeof api.operations?.subscribe === "function") {
          const unsubscribe = api.operations.subscribe((status) => {
            if (disposed) return;
            applyOperationsStatus(status);
            pushState();
          });
          if (typeof unsubscribe === "function") {
            operationsUnsubscribe = unsubscribe;
          }
        }
      }

      function clearFeedStream(): void {
        feedTimeouts.forEach((timeoutId) => {
          clearTimeout(timeoutId);
        });
        feedTimeouts.clear();
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

      function getKnowledgePack(packId: string): RepairKnowledgePack | null {
        return generatedKnowledgePacks.get(packId) ?? MOCK_REPAIR_KNOWLEDGE_PACKS[packId] ?? null;
      }

      function readGeneratedKnowledgePack(): RepairKnowledgePack | null {
        const packId = store.getState().wizard.generatedKnowledgePackId;
        return packId === null ? null : getKnowledgePack(packId);
      }

      async function startKnowledgeResearch(): Promise<void> {
        const currentWizard = store.getState().wizard;
        const resetProgress = REPAIR_RESEARCH_PROGRESS_TEMPLATE.map((item) => ({ ...item }));
        const targetSlot = normalizeRepairAiTargetSlot(
          store.getState().aiDispatch.research.targetSlot
        );

        store.batch(() => {
          store.dispatch({
            type: "wizard/set",
            wizard: {
              ...currentWizard,
              currentStep: "ai-research",
              researchProgress: resetProgress,
              foundResources: [],
              generatedKnowledgePackId: null,
            },
          });
          store.dispatch({ type: "phase/set", phase: "wizard-active" });
          setAiDispatchStatus("research", "pending", {
            message: "AI research is preparing the knowledge pack.",
            contextRefs: [
              currentWizard.draft.boardCode,
              currentWizard.draft.model,
              ...currentWizard.draft.primarySymptoms,
            ].filter((value) => value.trim() !== ""),
          });
        });

        const result = await requestRepairAiKnowledgeResearch({
          ...(typeof api.dispatchBridge === "function"
            ? { dispatchBridge: api.dispatchBridge }
            : {}),
          draft: currentWizard.draft,
          locale: typeof api.getLocale === "function" ? api.getLocale() : "en",
          operatorProfile: store.getState().operatorProfile,
          targetSlot,
        }).catch((error: unknown) => ({
          success: false,
          pack: null,
          contextRefs: [],
          message: error instanceof Error ? error.message : String(error),
        }));

        if (disposed) return;

        const researchedPack = result.pack;
        if (result.success !== true || researchedPack === null) {
          api.log(
            "debug",
            `[${REPAIR_ROOM_ID}] AI knowledge research failed: ${result.message ?? "unknown error"}`
          );
          setAiDispatchStatus("research", "failed", {
            message: result.message ?? "AI research did not return a knowledge pack.",
            contextRefs: result.contextRefs,
          });
          return;
        }

        generatedKnowledgePacks.set(researchedPack.id, researchedPack);
        const completedProgress = resetProgress.map((item) => ({ ...item, completed: true }));
        store.batch(() => {
          store.dispatch({
            type: "wizard/set",
            wizard: {
              ...store.getState().wizard,
              currentStep: "ready",
              researchProgress: completedProgress,
              foundResources: researchedPack.resources.map((resource) => ({
                id: resource.id,
                label: resource.label,
                kind: resource.kind,
              })),
              generatedKnowledgePackId: researchedPack.id,
            },
          });
          store.dispatch({
            type: "phase/set",
            phase: getActiveSession(store.getState()) === null ? "wizard-active" : "session-active",
          });
          setAiDispatchStatus("research", "succeeded", {
            message: "AI research prepared a knowledge pack.",
            contextRefs: result.contextRefs,
          });
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
          setSessionAndList(nextSession);
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

      function appendEventsToSession(sessionId: string, events: RepairEvent[]): boolean {
        if (events.length === 0) return true;
        const state = store.getState();
        const session = state.sessions[sessionId];
        if (session === undefined) return false;

        const nextSession: RepairSession = {
          ...session,
          events: [...session.events, ...events],
          updatedAt: events.at(-1)?.occurredAt ?? session.updatedAt,
        };
        const active = state.activeSessionId === sessionId;
        const feedItems = active
          ? events.flatMap((event) => {
              const item = repairEventToTacticalFeedItem(event, session.startedAt);
              return item === null ? [] : [item];
            })
          : [];
        const timeline = state.workbench.timeline;

        store.batch(() => {
          setSessionAndList(nextSession);
          feedItems.forEach((item) => {
            store.dispatch({ type: "tactical-feed/append", item });
          });
          if (active && timeline.autoFollowLive) {
            const liveEdgeMs = getSessionTimelineMs(nextSession);
            store.dispatch({
              type: "workbench/set-timeline",
              playheadMs: liveEdgeMs,
              zoom: timeline.zoom,
              rangeStartMs: timeline.rangeStartMs,
              rangeEndMs: timeline.rangeEndMs,
              autoFollowLive: true,
              replayMode: "live",
              isPlaying: true,
              liveEdgeMs,
            });
          }
        });
        if (active) {
          resetLiveTimelineAnchor(nextSession);
        }
        return true;
      }

      function setSessionAndList(
        session: RepairSession,
        options: { persist?: boolean } = {}
      ): void {
        const nextSessions = {
          ...store.getState().sessions,
          [session.id]: session,
        };
        store.dispatchMany([
          { type: "session/upsert", session },
          { type: "session-list/set", list: buildSessionList(nextSessions) },
        ]);
        if (options.persist !== false) {
          queuePersistSession(session);
        }
      }

      function createAiObservationEvents(params: {
        baseIso: string;
        measurementEvent: RepairMeasurementEvent;
        observations: RepairAiTacticalObservation[];
        session: RepairSession;
      }): RepairEvent[] {
        return params.observations.map((observation, index): RepairEvent => {
          const occurredAt = new Date(Date.parse(params.baseIso) + index * 250).toISOString();
          const linkedMeasurementIds = uniqueStringList([
            params.measurementEvent.id,
            ...observation.linkedMeasurementIds,
          ]);
          const linkedEventIds = uniqueStringList([
            params.measurementEvent.id,
            ...observation.linkedEventIds,
          ]);
          if (observation.kind === "risk") {
            return {
              kind: "risk-flag",
              id: createEventId("evt-ai-risk", occurredAt),
              sessionId: params.session.id,
              occurredAt,
              source: "ai",
              linkedEventIds,
              severity: "risk",
              message: observation.text,
              region: observation.region,
              acknowledged: false,
              linkedMeasurementIds,
              linkedAnnotationIds: [],
            };
          }

          return {
            kind: "ai-mark",
            id: createEventId("evt-ai-mark", occurredAt),
            sessionId: params.session.id,
            occurredAt,
            source: "ai",
            linkedEventIds,
            severity: observation.kind,
            region: observation.region,
            rationale: observation.text,
            protocolKey: REPAIR_PROTOCOL_KEYS.tacticalObserver,
            dismissed: false,
            lifecycleState: "detected",
            linkedMeasurementIds,
            linkedAnnotationIds: [],
            linkedNoteIds: [],
            linkedReplayEventIds: linkedEventIds,
          };
        });
      }

      async function requestMeasurementAiObservation(
        measurementEvent: RepairMeasurementEvent
      ): Promise<void> {
        const state = store.getState();
        const session = state.sessions[measurementEvent.sessionId];
        const dispatchBridge = api.dispatchBridge;
        if (session === undefined) return;
        const targetSlot = normalizeRepairAiTargetSlot(state.aiDispatch.tactical.targetSlot);
        const measurementRefs = uniqueStringList([
          measurementEvent.id,
          ...(measurementEvent.reference === null ? [] : [measurementEvent.reference]),
          session.id,
          session.deviceInfo.boardCode,
        ]);
        if (typeof dispatchBridge !== "function") {
          return;
        }

        setAiDispatchStatus("tactical", "pending", {
          message: `AI tactical observer is reviewing ${measurementEvent.reference}.`,
          contextRefs: measurementRefs,
        });

        const aiResult = await requestRepairAiTacticalObservations({
          dispatchBridge,
          locale: typeof api.getLocale === "function" ? api.getLocale() : "en",
          operatorProfile: state.operatorProfile,
          session,
          targetSlot,
          triggeringEvent: measurementEvent,
        }).catch((error: unknown) => ({
          success: false,
          observations: [],
          message: error instanceof Error ? error.message : String(error),
        }));

        if (aiResult.success !== true) {
          api.log(
            "debug",
            `[${REPAIR_ROOM_ID}] AI tactical observation skipped: ${
              aiResult.message ?? "unknown error"
            }`
          );
          setAiDispatchStatus("tactical", "failed", {
            message: aiResult.message ?? "AI tactical observer did not return observations.",
            contextRefs: measurementRefs,
          });
          return;
        }

        const currentState = store.getState();
        const currentSession = currentState.sessions[measurementEvent.sessionId];
        if (currentSession === undefined) return;
        const baseIso =
          currentState.activeSessionId === currentSession.id
            ? createLiveSessionIso(currentSession)
            : new Date(
                Math.max(
                  Date.parse(currentSession.updatedAt),
                  Date.parse(measurementEvent.occurredAt)
                ) + 1000
              ).toISOString();
        appendEventsToSession(
          currentSession.id,
          createAiObservationEvents({
            baseIso,
            measurementEvent,
            observations: aiResult.observations,
            session: currentSession,
          })
        );
        setAiDispatchStatus("tactical", "succeeded", {
          message: `AI tactical observer added ${aiResult.observations.length} observation${
            aiResult.observations.length === 1 ? "" : "s"
          }.`,
          contextRefs: uniqueStringList([
            ...measurementRefs,
            ...aiResult.observations.flatMap((observation) => observation.contextRefs),
          ]),
        });
      }

      function appendChatReply(
        operatorTurn: RepairChatTurn,
        text: string,
        contextRefs: string[]
      ): void {
        const current = store.getState();
        if (current.chat.pendingReplyId !== operatorTurn.id || disposed) return;
        const reply: RepairChatTurn = {
          id: createEventId("chat-ai", nowIso()),
          role: "ai",
          text,
          occurredAt: nowIso(),
          contextRefs,
        };
        store.dispatchMany([
          { type: "chat/append-turn", turn: reply },
          { type: "chat/set-pending", turnId: null },
        ]);
        queuePersistActiveSessionChat();
        if (store.getState().layout.interactionSettings.autoReadAiReplies) {
          const result = speakGuidanceRequest(reply.text);
          if (result.success === false && result.message !== undefined) {
            api.log("debug", `[${REPAIR_ROOM_ID}] auto-read skipped: ${result.message}`);
          }
        }
      }

      function failChatReply(
        operatorTurn: RepairChatTurn,
        message: string,
        contextRefs: string[]
      ): void {
        const current = store.getState();
        if (current.chat.pendingReplyId !== operatorTurn.id || disposed) return;
        store.dispatch({ type: "chat/set-pending", turnId: null });
        setAiDispatchStatus("chat", "failed", {
          message,
          contextRefs,
        });
        queuePersistActiveSessionChat();
      }

      function applyRepairAiRoomCommands(commands: RepairAiRoomCommand[]): {
        applied: number;
        failed: number;
      } {
        return commands.reduce(
          (summary, command) => {
            const result = handleCommand(command.commandName, command.payload);
            if (result.success) {
              summary.applied += 1;
            } else {
              summary.failed += 1;
              api.log(
                "warn",
                `[${REPAIR_ROOM_ID}] AI room command rejected command=${command.commandName} reason=${
                  result.message ?? "unknown"
                }`
              );
            }
            return summary;
          },
          { applied: 0, failed: 0 }
        );
      }

      async function requestChatReply(operatorTurn: RepairChatTurn): Promise<void> {
        const state = store.getState();
        const session = getActiveSession(state);
        const targetSlot = normalizeRepairAiTargetSlot(state.aiDispatch.chat.targetSlot);
        const baseContextRefs = session === null ? [] : [session.id, session.deviceInfo.boardCode];
        const dispatchBridge = api.dispatchBridge;
        const aiResult = await requestRepairAiChatReply({
          ...(typeof dispatchBridge === "function" ? { dispatchBridge } : {}),
          locale: typeof api.getLocale === "function" ? api.getLocale() : "en",
          operatorProfile: state.operatorProfile,
          operatorTurn,
          recentTurns: state.chat.turns,
          session,
          targetSlot,
        }).catch((error: unknown) => ({
          success: false,
          text: null,
          contextRefs: [],
          rejectedRoomCommandCount: 0,
          roomCommands: [],
          message: error instanceof Error ? error.message : String(error),
        }));
        if (aiResult.success !== true) {
          api.log(
            "debug",
            `[${REPAIR_ROOM_ID}] AI chat failed: ${aiResult.message ?? "unknown error"}`
          );
          failChatReply(
            operatorTurn,
            aiResult.message ?? "AI chat guidance did not return a reply.",
            uniqueStringList([...baseContextRefs, operatorTurn.id])
          );
          return;
        }
        const chatContextRefs = uniqueStringList([...baseContextRefs, ...aiResult.contextRefs]);
        if (aiResult.text === null) {
          failChatReply(
            operatorTurn,
            "AI chat guidance did not return readable text.",
            chatContextRefs
          );
          return;
        }
        const commandSummary = applyRepairAiRoomCommands(aiResult.roomCommands);
        const commandMessageParts = [
          aiResult.roomCommands.length > 0
            ? `${commandSummary.applied}/${aiResult.roomCommands.length} room command applied`
            : null,
          aiResult.rejectedRoomCommandCount > 0
            ? `${aiResult.rejectedRoomCommandCount} malformed room command ignored`
            : null,
          commandSummary.failed > 0 ? `${commandSummary.failed} room command failed` : null,
        ].filter((part): part is string => part !== null);
        setAiDispatchStatus("chat", commandSummary.failed > 0 ? "failed" : "succeeded", {
          message:
            commandMessageParts.length === 0
              ? "AI chat guidance returned a reply."
              : `AI chat guidance returned a reply; ${commandMessageParts.join(", ")}.`,
          contextRefs: chatContextRefs,
        });
        appendChatReply(operatorTurn, aiResult.text, chatContextRefs);
      }

      store.subscribe(() => {
        pushState();
      });
      startOperationsProjectionBridge();
      if (shouldAutoHydrateStorage) {
        void hydrateStorage();
      }

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
              void startKnowledgeResearch();
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
              if (storageReady) {
                store.dispatch({
                  type: "chat/set-turns",
                  turns: session === null ? [] : (storedChatTurnsBySessionId.get(session.id) ?? []),
                });
              }
              setActiveSessionDerivedState(store, session);
            });
            resetLiveTimelineAnchor(session);
            scheduleFeedStream();
            return { success: true };
          }
          case REPAIR_UI_COMMANDS.createSession: {
            const iso = nowIso();
            const generatedPack = readGeneratedKnowledgePack();
            const draftSession = createDraftSession(store.getState(), iso);
            const session: RepairSession =
              generatedPack === null
                ? draftSession
                : {
                    ...draftSession,
                    status: "ready",
                    knowledgePackId: generatedPack.id,
                    knowledgePack: generatedPack,
                    updatedAt: iso,
                  };
            if (storageReady) {
              storedChatTurnsBySessionId.set(session.id, []);
            }
            store.batch(() => {
              setSessionAndList(session);
              store.dispatch({ type: "session/activate", sessionId: session.id });
              if (storageReady) {
                store.dispatch({ type: "chat/set-turns", turns: [] });
              }
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
              void startKnowledgeResearch();
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
            const state = store.getState();
            const packId = safeString(flat["packId"]) ?? state.wizard.generatedKnowledgePackId;
            const session = getActiveSession(state);
            const pack = packId === null ? null : getKnowledgePack(packId);
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
                    safeString(flat["caption"]) ?? "Snapshot captured.",
                    safeString(flat["thumbnailSrc"] ?? flat["assetPath"] ?? flat["src"])
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
            store.batch(() => {
              store.dispatch({ type: "measurement/append-reading", reading });
              store.dispatch({
                type: "measurement/set-display",
                display: reading.rawDisplay,
                value: reading.value,
                hold: false,
              });
            });
            const success = appendEventToActiveSession(event);
            if (success) {
              void requestMeasurementAiObservation(event);
            }
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
          case REPAIR_UI_COMMANDS.setAiTargetSlot: {
            const targetSlot = flat["targetSlot"];
            if (!isRepairAiTargetSlot(targetSlot)) {
              return { success: false, message: "valid AI target slot is required" };
            }
            store.dispatch({ type: "ai-dispatch/set-target-slot", targetSlot });
            return { success: true };
          }
          case REPAIR_UI_COMMANDS.sendChatTurn: {
            const text = safeString(flat["text"]);
            if (text === null) return { success: false, message: "text is required" };
            const state = store.getState();
            const session = getActiveSession(state);
            const activeSessionId = state.activeSessionId;
            const turn: RepairChatTurn = {
              id: createEventId("chat-operator", nowIso()),
              role: "operator",
              text,
              occurredAt: nowIso(),
              contextRefs: activeSessionId === null ? [] : [activeSessionId],
            };
            store.batch(() => {
              store.dispatch({ type: "chat/append-turn", turn });
              store.dispatch({ type: "chat/set-composer", draft: "" });
              store.dispatch({ type: "chat/set-pending", turnId: turn.id });
              setAiDispatchStatus("chat", "pending", {
                message: "AI chat guidance is drafting a reply.",
                contextRefs: uniqueStringList([
                  ...(session === null ? [] : [session.id, session.deviceInfo.boardCode]),
                  turn.id,
                ]),
              });
            });
            queuePersistActiveSessionChat();
            void requestChatReply(turn);
            return { success: true };
          }
          case REPAIR_UI_COMMANDS.setChatComposer: {
            const draft = safeString(flat["draft"]) ?? "";
            store.dispatch({ type: "chat/set-composer", draft });
            return { success: true };
          }
          case REPAIR_UI_COMMANDS.updateOperatorProfile: {
            const profile = store.getState().operatorProfile;
            const displayName = safeString(flat["displayName"]);
            const profilePatch = safeRecord(flat["profile"]);
            const benchPatch = safeRecord(flat["bench"] ?? profilePatch?.["bench"]);
            const nextTools = normalizeRepairToolPatch(
              flat["tools"] ?? benchPatch?.["tools"],
              profile.bench.tools
            );
            const nextConsumables = normalizeRepairConsumablePatch(
              flat["consumables"] ?? benchPatch?.["consumables"],
              profile.bench.consumables
            );
            const nextSafety = normalizeRepairSafetyPatch(
              flat["safety"] ?? benchPatch?.["safety"],
              profile.bench.safety
            );
            const nextSkills = normalizeRepairSkillsPatch(
              flat["skills"] ?? profilePatch?.["skills"],
              profile.skills
            );
            const preferencePatch = normalizeRepairPreferencesPatch(
              flat["preferences"] ?? profilePatch?.["preferences"],
              profile.preferences
            );
            const nextProfile = {
              ...profile,
              bench: {
                tools: nextTools ?? profile.bench.tools,
                consumables: nextConsumables ?? profile.bench.consumables,
                safety: nextSafety ?? profile.bench.safety,
              },
              displayName:
                displayName ?? safeString(profilePatch?.["displayName"]) ?? profile.displayName,
              preferences: {
                ...profile.preferences,
                ...(preferencePatch ?? {}),
              },
              skills: nextSkills ?? profile.skills,
              updatedAt: nowIso(),
            };
            store.dispatch({
              type: "operator-profile/set",
              adaptation: buildMockRepairAiAdaptation(nextProfile),
              profile: nextProfile,
            });
            queuePersistActiveSessionChat();
            queuePersistOperatorProfile();
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
          case REPAIR_UI_COMMANDS.setOperationalProfile: {
            const profile = flat["profile"] ?? flat["operationalProfile"];
            if (!isOperationalProfile(profile)) {
              return { success: false, message: "valid operational profile is required" };
            }
            store.dispatch({ type: "layout/set-operational-profile", profile });
            return { success: true };
          }
          case REPAIR_UI_COMMANDS.setVoiceGuidance: {
            const ambientListeningState = flat["ambientListeningState"];
            const spokenGuidanceMode = flat["spokenGuidanceMode"];
            const handsBusyMode = flat["handsBusyMode"];
            if (
              ambientListeningState !== undefined &&
              !isAmbientListeningState(ambientListeningState)
            ) {
              return { success: false, message: "valid ambient listening state is required" };
            }
            if (spokenGuidanceMode !== undefined && !isSpokenGuidanceMode(spokenGuidanceMode)) {
              return { success: false, message: "valid spoken guidance mode is required" };
            }
            if (handsBusyMode !== undefined && typeof handsBusyMode !== "boolean") {
              return { success: false, message: "handsBusyMode must be boolean" };
            }
            const voiceGuidance: Partial<RepairVoiceGuidanceState> = {};
            if (isAmbientListeningState(ambientListeningState)) {
              voiceGuidance.ambientListeningState = ambientListeningState;
            }
            if (isSpokenGuidanceMode(spokenGuidanceMode)) {
              voiceGuidance.spokenGuidanceMode = spokenGuidanceMode;
            }
            if (typeof handsBusyMode === "boolean") {
              voiceGuidance.handsBusyMode = handsBusyMode;
            }
            store.dispatch({
              type: "layout/set-voice-guidance",
              voiceGuidance,
            });
            return { success: true };
          }
          case REPAIR_UI_COMMANDS.setInteractionSettings: {
            const androidCompanionEnabled = flat["androidCompanionEnabled"];
            const dictationRoute = flat["dictationRoute"];
            const ttsRoute = flat["ttsRoute"];
            const cameraFeedPreference = flat["cameraFeedPreference"];
            const dictationSubmitMode = flat["dictationSubmitMode"];
            const autoReadAiReplies = flat["autoReadAiReplies"];
            if (
              androidCompanionEnabled !== undefined &&
              typeof androidCompanionEnabled !== "boolean"
            ) {
              return { success: false, message: "androidCompanionEnabled must be boolean" };
            }
            if (dictationRoute !== undefined && !isDictationRoute(dictationRoute)) {
              return { success: false, message: "valid dictation route is required" };
            }
            if (ttsRoute !== undefined && !isTtsRoute(ttsRoute)) {
              return { success: false, message: "valid TTS route is required" };
            }
            if (
              cameraFeedPreference !== undefined &&
              !isCameraFeedPreference(cameraFeedPreference)
            ) {
              return { success: false, message: "valid camera feed preference is required" };
            }
            if (dictationSubmitMode !== undefined && !isDictationSubmitMode(dictationSubmitMode)) {
              return { success: false, message: "valid dictation submit mode is required" };
            }
            if (autoReadAiReplies !== undefined && typeof autoReadAiReplies !== "boolean") {
              return { success: false, message: "autoReadAiReplies must be boolean" };
            }
            const interactionSettings: Partial<RepairInteractionSettingsState> = {};
            if (typeof androidCompanionEnabled === "boolean") {
              interactionSettings.androidCompanionEnabled = androidCompanionEnabled;
            }
            if (isDictationRoute(dictationRoute)) {
              interactionSettings.dictationRoute = dictationRoute;
            }
            if (isTtsRoute(ttsRoute)) {
              interactionSettings.ttsRoute = ttsRoute;
            }
            if (isCameraFeedPreference(cameraFeedPreference)) {
              interactionSettings.cameraFeedPreference = cameraFeedPreference;
            }
            if (isDictationSubmitMode(dictationSubmitMode)) {
              interactionSettings.dictationSubmitMode = dictationSubmitMode;
            }
            if (typeof autoReadAiReplies === "boolean") {
              interactionSettings.autoReadAiReplies = autoReadAiReplies;
            }
            if (Object.keys(interactionSettings).length === 0) {
              return { success: false, message: "interaction settings update is required" };
            }
            store.dispatch({
              type: "layout/set-interaction-settings",
              interactionSettings,
            });
            return { success: true };
          }
          case REPAIR_UI_COMMANDS.setSettingsOverlay: {
            const open = flat["open"];
            const tabId = flat["tabId"];
            if (open !== undefined && typeof open !== "boolean") {
              return { success: false, message: "settings overlay open must be boolean" };
            }
            if (tabId !== undefined && !isSettingsOverlayTab(tabId)) {
              return { success: false, message: "valid settings overlay tab is required" };
            }
            if (open === undefined && tabId === undefined) {
              return { success: false, message: "settings overlay update is required" };
            }
            store.dispatch({
              type: "layout/set-settings-overlay",
              ...(typeof open === "boolean" ? { open } : {}),
              ...(isSettingsOverlayTab(tabId) ? { tabId } : {}),
            });
            return { success: true };
          }
          case REPAIR_UI_COMMANDS.startDictation:
            return startDictationRequest();
          case REPAIR_UI_COMMANDS.stopDictation:
            return stopDictationRequest();
          case REPAIR_UI_COMMANDS.startAmbientListener:
            return startAmbientRequest();
          case REPAIR_UI_COMMANDS.stopAmbientListener:
            return stopAmbientRequest();
          case REPAIR_UI_COMMANDS.startCameraFeed:
            return startCameraFeedRequest();
          case REPAIR_UI_COMMANDS.stopCameraFeed:
            return stopCameraFeedRequest();
          case REPAIR_UI_COMMANDS.speakGuidance: {
            return speakGuidanceRequest(safeString(flat["text"]));
          }
          case REPAIR_UI_COMMANDS.stopSpeech:
            return stopSpeechRequest();
          case REPAIR_UI_COMMANDS.setAttentionBudget: {
            const windowMs = safeNumber(flat["windowMs"]);
            const maxAiInterruptions = safeNumber(flat["maxAiInterruptions"]);
            if (windowMs === null && maxAiInterruptions === null) {
              return { success: false, message: "attention budget update is required" };
            }
            store.dispatch({
              type: "layout/set-attention-budget",
              attentionBudget: {
                ...(windowMs === null ? {} : { windowMs: Math.max(30000, Math.round(windowMs)) }),
                ...(maxAiInterruptions === null
                  ? {}
                  : { maxAiInterruptions: Math.max(1, Math.round(maxAiInterruptions)) }),
              },
            });
            return { success: true };
          }
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
            store.dispatchMany([
              { type: "workbench/focus-entity", ref: null, eventId: null },
              { type: "knowledge-pack/set-spatial-focus", spatialRefId: null },
              {
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
      startOperationsProjectionBridge();

      return {
        onRoomReady(payload: unknown) {
          void payload;
          const result = handleCommand(REPAIR_UI_COMMANDS.uiReady, {});
          if (result.success === false && result.message !== undefined) {
            api.log("warn", `[${REPAIR_ROOM_ID}] room-ready failed: ${result.message}`);
          }
        },
        commands,
        voiceCommands: getRepairVoiceCommandPhraseMap(),
        handleCommand,
        getStateSnapshot(): { state: RepairRuntimeState } {
          return { state: store.getState() };
        },
        hydrateStorage,
        flushStorage(): Promise<void> {
          return Promise.all([storagePersistQueue, operatorProfilePersistQueue]).then(() => {});
        },
        dispose() {
          disposed = true;
          if (
            activeDictationRequestId !== null &&
            typeof api.capture?.stopDictation === "function"
          ) {
            void api.capture.stopDictation(activeDictationRequestId);
            activeDictationRequestId = null;
          }
          if (
            activeAmbientRequestId !== null &&
            typeof api.capture?.stopAmbientListener === "function"
          ) {
            void api.capture.stopAmbientListener(activeAmbientRequestId);
            activeAmbientRequestId = null;
          }
          if (
            activeCameraFeedRequestId !== null &&
            typeof api.capture?.stopCameraFeed === "function"
          ) {
            void api.capture.stopCameraFeed(activeCameraFeedRequestId);
            activeCameraFeedRequestId = null;
            store.dispatch({ type: "operations/live-preview-set", preview: null });
          }
          if (activeTtsRequestId !== null && typeof api.tts?.stop === "function") {
            void api.tts.stop(activeTtsRequestId);
            activeTtsRequestId = null;
          }
          operationsUnsubscribe?.();
          operationsUnsubscribe = null;
          clearFeedStream();
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
