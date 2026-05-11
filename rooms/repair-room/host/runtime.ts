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
  RepairAnnotationTool,
  RepairChatTurn,
  RepairEvent,
  RepairInstrumentKind,
  RepairKnowledgePackProgress,
  RepairMultimeterReading,
  RepairOperatorProfileTabId,
  RepairPanelId,
  RepairSession,
  RepairSessionListItem,
  RepairWizardDraft,
  RepairWizardState,
  RepairWorkbenchTool,
} from "../shared/types/index.js";
import {
  createInitialRepairRuntimeState,
  type RepairRuntimeState,
} from "./state/repair-runtime-state.js";
import { createRepairRuntimeStore, type RepairRuntimeStore } from "./state/repair-runtime-store.js";
import {
  createRepairUiSnapshot,
  createRepairUiSnapshotMeta,
} from "./state/repair-selectors.js";

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
const OPERATOR_PROFILE_TABS: ReadonlySet<string> = new Set(["overview", "tools", "skills", "preferences"]);

function nowIso(): string {
  return new Date().toISOString();
}

function unrefTimer(timer: ReturnType<typeof setInterval> | ReturnType<typeof setTimeout>): void {
  if (typeof timer === "object" && timer !== null && typeof timer.unref === "function") {
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
    .sort((a, b) => Number(a.isArchived) - Number(b.isArchived) || b.updatedAt.localeCompare(a.updatedAt));
}

function getActiveSession(state: RepairRuntimeState): RepairSession | null {
  return state.activeSessionId === null ? null : (state.sessions[state.activeSessionId] ?? null);
}

function safeString(value: unknown): string | null {
  return typeof value === "string" && value.trim() !== "" ? value.trim() : null;
}

function safeNumber(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
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

function isAnnotationTool(value: unknown): value is RepairAnnotationTool {
  return typeof value === "string" && ANNOTATION_TOOLS.has(value);
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

function createEventId(prefix: string, iso: string): string {
  return `${prefix}-${iso.replace(/[^0-9]/g, "").slice(0, 14)}`;
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

function patchWizardDraftFromPayload(payload: Record<string, unknown>): Partial<RepairWizardDraft> | null {
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
  const id = `repair-draft-${iso.replace(/[^0-9]/g, "").slice(4, 14)}`;
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
  tool: RepairAnnotationTool,
  payload: Record<string, unknown>
): RepairEvent {
  const xPx = safeNumber(payload["xPx"]) ?? 520;
  const yPx = safeNumber(payload["yPx"]) ?? 320;
  const widthPx = Math.max(tool === "arrow" ? 1 : 28, safeNumber(payload["widthPx"]) ?? 112);
  const heightPx = Math.max(tool === "arrow" ? 0 : 28, safeNumber(payload["heightPx"]) ?? 84);
  const label = safeString(payload["label"]) ?? (tool === "measurement-pin" ? "Measurement pin" : "Operator annotation");
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
    color: safeString(payload["color"]) ?? "#56c8de",
  };
}

function createMeasurementReading(iso: string, payload: Record<string, unknown>): RepairMultimeterReading {
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

function setActiveSessionDerivedState(store: RepairRuntimeStore, session: RepairSession | null): void {
  const timeline = store.getState().workbench.timeline;
  const playheadMs = getSessionTimelineMs(session);
  store.dispatch({ type: "phase/set", phase: phaseForSession(session) });
  store.dispatch({
    type: "workbench/set-timeline",
    playheadMs,
    zoom: timeline.zoom,
    rangeStartMs: null,
    rangeEndMs: null,
    autoFollowLive: session?.status === "in-progress",
  });
  store.dispatch({
    type: "knowledge-pack/set",
    pack: session?.knowledgePack ?? null,
    attachedToSessionId: session?.knowledgePack === null ? null : (session?.id ?? null),
  });
  store.dispatch({
    type: "tactical-feed/set",
    items: session === null ? [] : buildMockTacticalFeed(session.events, session.startedAt).slice(0, FEED_INITIAL_VISIBLE_COUNT),
  });
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
        const playheadMs = Math.max(getSessionTimelineMs(session) + 1000, getLiveTimelinePlayheadMs(session));
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
            const alreadyVisible = current.tacticalFeed.some((feedItem) => feedItem.eventId === item.eventId);
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
        const resetProgress = progressSeed.map((item): RepairKnowledgePackProgress => ({
          ...item,
          completed: false,
        }));

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

        resetProgress.forEach((progress, index) => {
          const timeoutId = setTimeout(() => {
            const wizard = store.getState().wizard;
            const nextProgress = wizard.researchProgress.map((item) =>
              item.step === progress.step ? { ...item, completed: true } : item
            );
            store.dispatch({
              type: "wizard/set",
              wizard: {
                ...wizard,
                researchProgress: nextProgress,
                foundResources:
                  index >= 1 ? MOCK_REPAIR_WIZARD_INITIAL.foundResources.slice(0, Math.min(index + 1, 4)) : [],
                generatedKnowledgePackId:
                  index === resetProgress.length - 1 ? "bn44-00932a" : wizard.generatedKnowledgePackId,
                currentStep: index === resetProgress.length - 1 ? "ready" : "ai-research",
              },
            });
            if (index === resetProgress.length - 1) {
              store.dispatch({ type: "phase/set", phase: "session-active" });
            }
            researchTimeouts.delete(timeoutId);
          }, 700 + index * 650);
          unrefTimer(timeoutId);
          researchTimeouts.add(timeoutId);
        });
      }

      function startLiveLoops(): void {
        if (clockInterval === null) {
          clockInterval = setInterval(() => {
            const nowMs = Date.now();
            const iso = new Date(nowMs).toISOString();
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
              });
            }
          }, REPAIR_AMBIENT_CLOCK_INTERVAL_MS);
          unrefTimer(clockInterval);
        }

        if (measurementInterval === null) {
          measurementInterval = setInterval(() => {
            const state = store.getState();
            const session = getActiveSession(state);
            if (session?.status !== "in-progress" || state.workbench.isFrozen) return;
            const display = MEASUREMENT_DRIFT_SEQUENCE[measurementTick % MEASUREMENT_DRIFT_SEQUENCE.length] ?? "0.000";
            measurementTick += 1;
            const reading = createMeasurementReading(nowIso(), {
              rawDisplay: display,
              range: state.measurement.current.range,
              channel: "COM/VΩ",
              unit: state.measurement.current.unit || "V",
              reference: "Live drift sample",
            });
            store.dispatch({ type: "measurement/append-reading", reading });
            store.dispatch({
              type: "measurement/set-display",
              display,
              value: display === "OL" ? null : Number(display),
              hold: false,
            });
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
        store.dispatch({ type: "session/upsert", session: nextSession });
        resetLiveTimelineAnchor(nextSession);

        const feedItem = repairEventToTacticalFeedItem(event, session.startedAt);
        if (feedItem !== null) {
          store.dispatch({ type: "tactical-feed/append", item: feedItem });
        }
        const timeline = store.getState().workbench.timeline;
        if (timeline.autoFollowLive) {
          store.dispatch({
            type: "workbench/set-timeline",
            playheadMs: getSessionTimelineMs(nextSession),
            zoom: timeline.zoom,
            rangeStartMs: timeline.rangeStartMs,
            rangeEndMs: timeline.rangeEndMs,
            autoFollowLive: true,
          });
        }
        return true;
      }

      function setSessionAndList(session: RepairSession): void {
        const nextSessions = {
          ...store.getState().sessions,
          [session.id]: session,
        };
        store.dispatch({ type: "session/upsert", session });
        store.dispatch({ type: "session-list/set", list: buildSessionList(nextSessions) });
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
          store.dispatch({ type: "chat/append-turn", turn: reply });
          store.dispatch({ type: "chat/set-pending", turnId: null });
        }, delay);
        unrefTimer(timeoutId);
      }

      store.subscribe(() => {
        pushState();
      });

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
            api.log(
              "info",
              `[${REPAIR_ROOM_ID}] ui-ready phase=${store.getState().phase}`
            );
            return { success: true };
          }
          case REPAIR_UI_COMMANDS.activateSession: {
            const sessionId = safeString(flat["sessionId"]);
            const session = sessionId === null ? null : (store.getState().sessions[sessionId] ?? null);
            store.dispatch({ type: "session/activate", sessionId: session?.id ?? null });
            setActiveSessionDerivedState(store, session);
            resetLiveTimelineAnchor(session);
            scheduleFeedStream();
            return { success: true };
          }
          case REPAIR_UI_COMMANDS.createSession: {
            const iso = nowIso();
            const session = createDraftSession(store.getState(), iso);
            setSessionAndList(session);
            store.dispatch({ type: "session/activate", sessionId: session.id });
            setActiveSessionDerivedState(store, session);
            resetLiveTimelineAnchor(session);
            return { success: true };
          }
          case REPAIR_UI_COMMANDS.updateSession: {
            const wizardPatch = patchWizardDraftFromPayload(flat);
            if (wizardPatch !== null) {
              store.dispatch({ type: "wizard/patch-draft", patch: wizardPatch });
            }
            const state = store.getState();
            const session = getActiveSession(state);
            if (session === null) return { success: wizardPatch !== null, message: "active session is required" };
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
            setSessionAndList(nextSession);
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
            setSessionAndList(nextSession);
            if (store.getState().activeSessionId === sessionId) {
              store.dispatch({ type: "session/activate", sessionId: null });
              setActiveSessionDerivedState(store, null);
              resetLiveTimelineAnchor(null);
            }
            return { success: true };
          }
          case REPAIR_UI_COMMANDS.advanceWizard: {
            const requested = safeString(flat["step"]);
            const current = store.getState().wizard.currentStep;
            const currentIndex = Math.max(0, WIZARD_STEP_ORDER.indexOf(current));
            const fallbackStep =
              WIZARD_STEP_ORDER[Math.min(currentIndex + 1, WIZARD_STEP_ORDER.length - 1)] ?? "ready";
            const nextStep = WIZARD_STEP_ORDER.includes(requested as RepairWizardState["currentStep"])
              ? (requested as RepairWizardState["currentStep"])
              : fallbackStep;
            if (nextStep === "ai-research") {
              scheduleResearchStream();
              return { success: true };
            }
            store.dispatch({ type: "wizard/advance", step: nextStep });
            store.dispatch({ type: "phase/set", phase: nextStep === "ready" ? "session-active" : "wizard-active" });
            return { success: true };
          }
          case REPAIR_UI_COMMANDS.attachKnowledgePack: {
            const packId = safeString(flat["packId"]) ?? "bn44-00932a";
            const state = store.getState();
            const session = getActiveSession(state);
            const pack = MOCK_REPAIR_KNOWLEDGE_PACKS[packId] ?? null;
            if (session === null || pack === null) return { success: false, message: "session and pack are required" };
            const nextSession: RepairSession = {
              ...session,
              status: "in-progress",
              knowledgePackId: pack.id,
              knowledgePack: pack,
              updatedAt: nowIso(),
            };
            setSessionAndList(nextSession);
            store.dispatch({ type: "knowledge-pack/set", pack, attachedToSessionId: session.id });
            store.dispatch({ type: "phase/set", phase: "session-active" });
            resetLiveTimelineAnchor(nextSession);
            scheduleFeedStream();
            return { success: true };
          }
          case REPAIR_UI_COMMANDS.setActiveTool: {
            const tool = flat["tool"];
            if (!isWorkbenchTool(tool)) return { success: false, message: "valid tool is required" };
            const viewport = store.getState().workbench.viewport;
            if (tool === "zoom-in" || tool === "zoom-out") {
              const nextZoom = Math.min(4, Math.max(0.5, viewport.zoom + (tool === "zoom-in" ? 0.25 : -0.25)));
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
              if (session === null) return { success: false, message: "active session is required" };
              return {
                success: appendEventToActiveSession(
                  createSnapshotEvent(session.id, createLiveSessionIso(session), "Manual workbench snapshot captured.")
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
            store.dispatch({
              type: "workbench/set-frozen",
              isFrozen: next,
              frozenAt: next ? iso : null,
            });
            if (next && session !== null) {
              appendEventToActiveSession({
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
            return { success: true };
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
                ? createSnapshotEvent(session.id, iso, safeString(flat["caption"]) ?? "Snapshot captured.")
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
            store.dispatch({ type: "workbench/set-focus-event", eventId });
            return { success: true };
          }
          case REPAIR_UI_COMMANDS.scrubTimeline: {
            const session = getActiveSession(store.getState());
            const positionMs = safeNumber(flat["positionMs"]);
            if (session === null || positionMs === null) return { success: false, message: "positionMs is required" };
            const start = Date.parse(session.startedAt);
            const target = start + positionMs;
            const closest = session.events.reduce<RepairEvent | null>((best, event) => {
              if (best === null) return event;
              return Math.abs(Date.parse(event.occurredAt) - target) <
                Math.abs(Date.parse(best.occurredAt) - target)
                ? event
                : best;
            }, null);
            store.dispatch({ type: "workbench/set-focus-event", eventId: closest?.id ?? null });
            const timeline = store.getState().workbench.timeline;
            store.dispatch({
              type: "workbench/set-timeline",
              playheadMs: Math.max(0, positionMs),
              zoom: timeline.zoom,
              rangeStartMs: timeline.rangeStartMs,
              rangeEndMs: timeline.rangeEndMs,
              autoFollowLive: false,
            });
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
              setSessionAndList(nextSession);
              store.dispatch({ type: "workbench/set-focus-event", eventId: existingEventId });
              return { success: true };
            }
            const reading = createMeasurementReading(iso, flat);
            const event = createMeasurementEvent(session.id, iso, reading, flat);
            store.dispatch({ type: "measurement/append-reading", reading });
            store.dispatch({
              type: "measurement/set-display",
              display: reading.rawDisplay,
              value: reading.value,
              hold: false,
            });
            return { success: appendEventToActiveSession(event) };
          }
          case REPAIR_UI_COMMANDS.dismissAiMark: {
            const eventId = safeString(flat["eventId"]);
            const session = getActiveSession(store.getState());
            if (session === null || eventId === null) return { success: false, message: "eventId is required" };
            const nextEvents = session.events.map((event) => {
              if (event.id !== eventId) return event;
              if (event.kind === "ai-mark") return { ...event, dismissed: true };
              if (event.kind === "risk-flag") return { ...event, acknowledged: true };
              return event;
            });
            setSessionAndList({ ...session, events: nextEvents, updatedAt: nowIso() });
            return { success: true };
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
            store.dispatch({ type: "chat/append-turn", turn });
            store.dispatch({ type: "chat/set-pending", turnId: turn.id });
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
          case REPAIR_UI_COMMANDS.updateLayout: {
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
            const focusMode = flat["focusMode"];
            if (typeof focusMode === "boolean") {
              store.dispatch({ type: "layout/set-focus-mode", focusMode });
              return { success: true };
            }
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
              store.dispatch({ type: "layout/set-operator-profile-tab", tabId: operatorProfileTabId });
              return { success: true };
            }
            const viewportZoom = safeNumber(flat["viewportZoom"]);
            const panXPx = safeNumber(flat["panXPx"]);
            const panYPx = safeNumber(flat["panYPx"]);
            if (viewportZoom !== null || panXPx !== null || panYPx !== null) {
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
            const timelineZoom = safeNumber(flat["timelineZoom"]);
            const timelineRangeStartMs = safeNumber(flat["timelineRangeStartMs"]);
            const timelineRangeEndMs = safeNumber(flat["timelineRangeEndMs"]);
            const clearTimelineRange = flat["clearTimelineRange"] === true;
            if (
              timelineZoom !== null ||
              timelineRangeStartMs !== null ||
              timelineRangeEndMs !== null ||
              clearTimelineRange
            ) {
              const timeline = store.getState().workbench.timeline;
              const rangeStartMs = clearTimelineRange
                ? null
                : (timelineRangeStartMs ?? timeline.rangeStartMs);
              const rangeEndMs = clearTimelineRange
                ? null
                : (timelineRangeEndMs ?? timeline.rangeEndMs);
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
            return { success: false, message: "layout payload is empty" };
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
