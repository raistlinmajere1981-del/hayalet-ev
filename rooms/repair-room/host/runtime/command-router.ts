import {
  REPAIR_ROOM_ID,
  REPAIR_UI_COLORS,
  REPAIR_UI_COMMANDS,
} from "../../shared/repair-constants.js";
import { buildMockRepairAiAdaptation } from "../../shared/data/index.js";
import type {
  RepairChatTurn,
  RepairEvent,
  RepairInteractionSettingsState,
  RepairOverlayEntityRef,
  RepairSession,
  RepairVoiceGuidanceState,
  RepairWizardState,
} from "../../shared/types/index.js";
import type { ReplayRuntimeController } from "../repair-replay-runtime.js";
import type { RepairRuntimeState } from "../state/repair-runtime-state.js";
import type { RepairRuntimeStore } from "../state/repair-runtime-store.js";
import type { RepairAiController } from "./ai-controller.js";
import { isRepairAiTargetSlot } from "./ai-controller.js";
import {
  createAnnotationEvent,
  createEventId,
  createInvestigationRegionCreatedEvent,
  createMeasurementEvent,
  createMeasurementReading,
  createSnapshotEvent,
} from "./event-factory.js";
import {
  isAiMarkLifecycleState,
  isAmbientListeningState,
  isAnnotationTool,
  isCameraFeedPreference,
  isDictationRoute,
  isDictationSubmitMode,
  isInvestigationRegionStatus,
  isOperationalProfile,
  isSettingsOverlayTab,
  isSpokenGuidanceMode,
  isTtsRoute,
  isWorkbenchTool,
  normalizeRepairConsumablePatch,
  normalizeRepairPreferencesPatch,
  normalizeRepairSafetyPatch,
  normalizeRepairSkillsPatch,
  normalizeRepairToolPatch,
  safeImageRect,
  safeNumber,
  safeOverlayEntityRef,
  safeOverlayEntityRefs,
  safeRecord,
  safeString,
} from "./guards.js";
import type { RepairLayoutController } from "./layout-controller.js";
import type { RepairLiveController } from "./live-controller.js";
import type { RepairOperationsController } from "./operations-controller.js";
import {
  collectKnowledgePromotionLinkage,
  findKnowledgeSpatialRegion,
} from "./overlay-selection.js";
import type { RepairSessionController } from "./session-controller.js";
import {
  createDraftSession,
  getActiveSession,
  patchWizardDraftFromPayload,
} from "./session-helpers.js";
import type { RepairStorageController } from "./storage-controller.js";

export interface RepairCommandPayload {
  roomArgs?: Record<string, unknown>;
  roomPayload?: Record<string, unknown>;
  [key: string]: unknown;
}

export interface RepairCommandRouter {
  handleCommand: (
    command: string,
    payload?: RepairCommandPayload
  ) => {
    success: boolean;
    message?: string;
  };
}

const WIZARD_STEP_ORDER: RepairWizardState["currentStep"][] = [
  "device-info",
  "symptoms",
  "ai-research",
  "evidence-review",
  "ready",
];

function nowIso(): string {
  return new Date().toISOString();
}

export function createRepairCommandRouter(params: {
  aiController: RepairAiController;
  api: { log: (level: string, message: string) => void };
  layoutController: RepairLayoutController;
  liveController: RepairLiveController;
  operationsController: RepairOperationsController;
  pushState: () => void;
  replayController: ReplayRuntimeController;
  sessionController: RepairSessionController;
  setActiveSessionDerivedState: (session: RepairSession | null) => void;
  storageController: RepairStorageController;
  store: RepairRuntimeStore;
}): RepairCommandRouter {
  const {
    aiController,
    api,
    layoutController,
    liveController,
    operationsController,
    pushState,
    replayController,
    sessionController,
    setActiveSessionDerivedState,
    storageController,
    store,
  } = params;

  function handleCommand(
    command: string,
    payload: RepairCommandPayload = {}
  ): { success: boolean; message?: string } {
    const { roomArgs: cmdRoomArgs, roomPayload: cmdRoomPayload, ...rest } = payload;
    const flat = {
      ...(cmdRoomArgs ?? {}),
      ...(cmdRoomPayload ?? {}),
      ...rest,
    };

    switch (command) {
      case REPAIR_UI_COMMANDS.uiReady: {
        pushState();
        liveController.startLiveLoops();
        api.log("info", `[${REPAIR_ROOM_ID}] ui-ready phase=${store.getState().phase}`);
        return { success: true };
      }
      case REPAIR_UI_COMMANDS.activateSession: {
        const sessionId = safeString(flat["sessionId"]);
        const session = sessionId === null ? null : (store.getState().sessions[sessionId] ?? null);
        store.batch(() => {
          store.dispatch({ type: "session/activate", sessionId: session?.id ?? null });
          if (storageController.isReady()) {
            store.dispatch({
              type: "chat/set-turns",
              turns: session === null ? [] : storageController.getSessionChatTurns(session.id),
            });
          }
          setActiveSessionDerivedState(session);
        });
        liveController.resetTimelineAnchor(session);
        liveController.scheduleFeedStream();
        return { success: true };
      }
      case REPAIR_UI_COMMANDS.createSession: {
        const iso = nowIso();
        const generatedPack = aiController.readGeneratedKnowledgePack();
        if (generatedPack !== null && !store.getState().wizard.evidenceReviewed) {
          return { success: false, message: "evidence review is required before creating session" };
        }
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
        if (storageController.isReady()) {
          storageController.setSessionChatTurns(session.id, []);
        }
        store.batch(() => {
          sessionController.setSessionAndList(session, { skipTransitionCheck: true });
          store.dispatch({ type: "session/activate", sessionId: session.id });
          if (storageController.isReady()) {
            store.dispatch({ type: "chat/set-turns", turns: [] });
          }
          setActiveSessionDerivedState(session);
        });
        liveController.resetTimelineAnchor(session);
        store.dispatch({
          type: "wizard/set",
          wizard: {
            ...store.getState().wizard,
            currentStep: "device-info",
            generatedKnowledgePackId: null,
            evidenceReviewed: false,
            researchProgress: [],
            foundResources: [],
          },
        });
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
          sessionController.setSessionAndList(nextSession, { skipTransitionCheck: true });
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
        const saved = sessionController.setSessionAndList(nextSession);
        if (!saved) {
          return { success: false, message: "illegal session transition to archived" };
        }
        store.batch(() => {
          if (wasActive) {
            store.dispatch({ type: "session/activate", sessionId: null });
            setActiveSessionDerivedState(null);
          }
        });
        if (wasActive) {
          liveController.resetTimelineAnchor(null);
        }
        return { success: true };
      }
      case REPAIR_UI_COMMANDS.deleteSession: {
        const sessionId = safeString(flat["sessionId"]) ?? store.getState().activeSessionId;
        if (sessionId === null) return { success: false, message: "sessionId is required" };
        const session = store.getState().sessions[sessionId];
        if (session === undefined) return { success: false, message: "session was not found" };
        const wasActive = store.getState().activeSessionId === sessionId;
        storageController.deleteSessionChatTurns(sessionId);
        store.batch(() => {
          sessionController.deleteSessionAndList(sessionId);
          if (wasActive) {
            store.dispatch({ type: "chat/set-turns", turns: [] });
            setActiveSessionDerivedState(null);
          }
        });
        if (wasActive) {
          liveController.resetTimelineAnchor(null);
          liveController.clearFeedStream();
        }
        storageController.updateReadyStorageState();
        storageController.queueDeleteSession(sessionId);
        return { success: true };
      }
      case REPAIR_UI_COMMANDS.advanceWizard: {
        const requested = safeString(flat["step"]);
        const wizard = store.getState().wizard;
        const current = wizard.currentStep;
        const currentIndex = Math.max(0, WIZARD_STEP_ORDER.indexOf(current));
        const fallbackStep =
          WIZARD_STEP_ORDER[Math.min(currentIndex + 1, WIZARD_STEP_ORDER.length - 1)] ?? "ready";
        const nextStep = WIZARD_STEP_ORDER.includes(requested as RepairWizardState["currentStep"])
          ? (requested as RepairWizardState["currentStep"])
          : fallbackStep;
        if (
          nextStep === "ready" &&
          wizard.generatedKnowledgePackId !== null &&
          !wizard.evidenceReviewed
        ) {
          store.dispatch({
            type: "wizard/set",
            wizard: {
              ...wizard,
              currentStep: "ready",
              evidenceReviewed: true,
            },
          });
          store.dispatch({ type: "phase/set", phase: "wizard-active" });
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
      case REPAIR_UI_COMMANDS.startKnowledgeResearch: {
        const targetSlot = flat["targetSlot"];
        if (targetSlot !== undefined && !isRepairAiTargetSlot(targetSlot)) {
          return { success: false, message: "valid AI target slot is required" };
        }
        void aiController.startKnowledgeResearch(targetSlot === undefined ? {} : { targetSlot });
        return { success: true };
      }
      case REPAIR_UI_COMMANDS.attachKnowledgePack: {
        const state = store.getState();
        const packId = safeString(flat["packId"]) ?? state.wizard.generatedKnowledgePackId;
        const session = getActiveSession(state);
        const pack = packId === null ? null : aiController.getKnowledgePack(packId);
        if (session === null || pack === null)
          return { success: false, message: "session and pack are required" };
        if (state.wizard.generatedKnowledgePackId === pack.id && !state.wizard.evidenceReviewed) {
          return { success: false, message: "evidence review is required before attaching" };
        }
        const nextSession: RepairSession = {
          ...session,
          status: "in-progress",
          knowledgePackId: pack.id,
          knowledgePack: pack,
          updatedAt: nowIso(),
        };
        const saved = sessionController.setSessionAndList(nextSession);
        if (!saved) {
          return { success: false, message: "illegal session transition to in-progress" };
        }
        store.batch(() => {
          store.dispatch({
            type: "knowledge-pack/set",
            pack,
            attachedToSessionId: session.id,
          });
          store.dispatch({ type: "phase/set", phase: "session-active" });
        });
        liveController.resetTimelineAnchor(nextSession);
        liveController.scheduleFeedStream();
        return { success: true };
      }
      case REPAIR_UI_COMMANDS.setActiveTool: {
        const tool = flat["tool"];
        if (!isWorkbenchTool(tool)) return { success: false, message: "valid tool is required" };
        const viewport = store.getState().workbench.viewport;
        if (tool === "zoom-in" || tool === "zoom-out") {
          const nextZoom = Math.min(
            4,
            Math.max(0.5, viewport.zoom + (tool === "zoom-in" ? 0.25 : -0.25))
          );
          return layoutController.applyViewportUpdate({
            viewportZoom: nextZoom,
            panXPx: viewport.panXPx,
            panYPx: viewport.panYPx,
          });
        }
        if (tool === "snapshot") {
          const session = getActiveSession(store.getState());
          if (session === null) return { success: false, message: "active session is required" };
          return {
            success: sessionController.appendEventToActiveSession(
              createSnapshotEvent(
                session.id,
                liveController.createLiveSessionIso(session),
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
        const iso = session === null ? nowIso() : liveController.createLiveSessionIso(session);
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
            success = sessionController.appendEventToActiveSession({
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
        const iso = liveController.createLiveSessionIso(session);
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
        return { success: sessionController.appendEventToActiveSession(event) };
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
        store.dispatchMany([{ type: "workbench/set-focus-event", eventId: closest?.id ?? null }]);
        replayController.scrub(positionMs);
        return { success: true };
      }
      case REPAIR_UI_COMMANDS.addMeasurement: {
        const session = getActiveSession(store.getState());
        if (session === null) return { success: false, message: "active session is required" };
        const iso = liveController.createLiveSessionIso(session);
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
            sessionController.setSessionAndList(nextSession, { skipTransitionCheck: true });
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
        const success = sessionController.appendEventToActiveSession(event);
        if (success) {
          void aiController.requestMeasurementAiObservation(event);
          void aiController.requestSessionRiskDetection();
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
        const iso = liveController.createLiveSessionIso(session);
        const lifecycleState = isAiMarkLifecycleState(flat["state"]) ? flat["state"] : "dismissed";
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
        return { success: sessionController.appendEventToActiveSession(lifecycleEvent) };
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
          aiController.setAiDispatchStatus("chat", "pending", {
            message: "AI chat guidance is drafting a reply.",
            contextRefs: Array.from(
              new Set([
                ...(session === null ? [] : [session.id, session.deviceInfo.boardCode]),
                turn.id,
              ])
            ),
          });
        });
        storageController.queuePersistActiveSessionChat();
        void aiController.requestChatReply(turn);
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
        storageController.queuePersistActiveSessionChat();
        storageController.queuePersistOperatorProfile();
        return { success: true };
      }
      case REPAIR_UI_COMMANDS.updateViewport:
        return layoutController.applyViewportUpdate(flat);
      case REPAIR_UI_COMMANDS.updateTimeline:
        return layoutController.applyTimelineUpdate(flat);
      case REPAIR_UI_COMMANDS.updatePanelLayout:
        return layoutController.applyPanelLayoutUpdate(flat);
      case REPAIR_UI_COMMANDS.updatePanelTab:
        return layoutController.applyPanelTabUpdate(flat);
      case REPAIR_UI_COMMANDS.updateFocus:
        return layoutController.applyFocusUpdate(flat);
      case REPAIR_UI_COMMANDS.updateLayout:
        return layoutController.applyLayoutCompatibilityUpdate(flat);
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
        if (androidCompanionEnabled !== undefined && typeof androidCompanionEnabled !== "boolean") {
          return { success: false, message: "androidCompanionEnabled must be boolean" };
        }
        if (dictationRoute !== undefined && !isDictationRoute(dictationRoute)) {
          return { success: false, message: "valid dictation route is required" };
        }
        if (ttsRoute !== undefined && !isTtsRoute(ttsRoute)) {
          return { success: false, message: "valid TTS route is required" };
        }
        if (cameraFeedPreference !== undefined && !isCameraFeedPreference(cameraFeedPreference)) {
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
        return operationsController.startDictationRequest();
      case REPAIR_UI_COMMANDS.stopDictation:
        return operationsController.stopDictationRequest();
      case REPAIR_UI_COMMANDS.startAmbientListener:
        return operationsController.startAmbientRequest();
      case REPAIR_UI_COMMANDS.stopAmbientListener:
        return operationsController.stopAmbientRequest();
      case REPAIR_UI_COMMANDS.startCameraFeed:
        return operationsController.startCameraFeedRequest();
      case REPAIR_UI_COMMANDS.stopCameraFeed:
        return operationsController.stopCameraFeedRequest();
      case REPAIR_UI_COMMANDS.speakGuidance: {
        return operationsController.speakGuidanceRequest(safeString(flat["text"]));
      }
      case REPAIR_UI_COMMANDS.stopSpeech:
        return operationsController.stopSpeechRequest();
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
        layoutController.applyOverlayEntitySelection({
          refs,
          mode: safeString(flat["mode"] ?? flat["selectionMode"]),
          inspectorRef: safeOverlayEntityRef(flat["inspectorRef"] ?? flat["inspectorEntityRef"]),
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
        layoutController.applyOverlayEntitySelection({
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
        if (spatialRefId === null) return { success: false, message: "spatialRefId is required" };
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
        const iso = liveController.createLiveSessionIso(session);
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
          success = sessionController.appendEventToActiveSession(event);
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

  return { handleCommand };
}
