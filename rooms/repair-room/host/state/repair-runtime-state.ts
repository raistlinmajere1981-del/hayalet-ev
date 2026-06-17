import { REPAIR_ROOM_ID } from "../../shared/repair-constants.js";
import {
  MOCK_REPAIR_ACTIVE_SESSION_ID,
  MOCK_REPAIR_MEASUREMENT_STATE,
  MOCK_REPAIR_SESSIONS,
  MOCK_REPAIR_SESSION_LIST,
  MOCK_REPAIR_CHAT_TURNS,
  MOCK_REPAIR_OPERATOR_PROFILE,
  MOCK_REPAIR_WIZARD_INITIAL,
  buildMockRepairAiAdaptation,
  buildMockTacticalFeed,
} from "../../shared/data/index.js";
import type {
  RepairAiAdaptationHints,
  RepairChatState,
  RepairLayoutState,
  RepairMeasurementState,
  RepairOperatorProfile,
  RepairOverlayLayerId,
  RepairPanelId,
  RepairLivePreviewState,
  RepairSession,
  RepairSessionListItem,
  RepairWizardState,
  RepairWorkbenchState,
} from "../../shared/types/index.js";
import type {
  RepairAiDispatchState,
  RepairKnowledgePackPanelState,
  RepairOperationsSnapshot,
  RepairStorageState,
  RepairTacticalFeedItem,
  RepairUiPhase,
} from "../../shared/ui/state.js";
import {
  createRepairDefaultAiDispatchState,
  createRepairDefaultStorageState,
} from "../../shared/ui/state.js";

export interface RepairRuntimeState {
  roomId: string;
  phase: RepairUiPhase;
  activeSessionId: string | null;
  sessionList: RepairSessionListItem[];
  sessions: Record<string, RepairSession>;
  workbench: RepairWorkbenchState;
  tacticalFeed: RepairTacticalFeedItem[];
  wizard: RepairWizardState;
  knowledgePack: RepairKnowledgePackPanelState;
  operatorProfile: RepairOperatorProfile;
  operatorAdaptation: RepairAiAdaptationHints;
  measurement: RepairMeasurementState;
  chat: RepairChatState;
  layout: RepairLayoutState;
  operationsStatus: RepairOperationsSnapshot | null;
  livePreview: RepairLivePreviewState | null;
  aiDispatch: RepairAiDispatchState;
  storage: RepairStorageState;
  ambientNowIso: string;
}

function createCollapsedPanelMap(): Record<RepairPanelId, boolean> {
  return {
    "session-rail": false,
    "workbench-stage": false,
    "tactical-feed": false,
    "session-wizard": false,
    "knowledge-pack": false,
    "visual-timeline": false,
    "operator-profile": false,
    "repair-settings": false,
    chat: false,
    measurement: false,
    "room-sync": false,
  };
}

function createVisibleLayersMap(): Record<RepairOverlayLayerId, boolean> {
  return {
    grid: true,
    "ai-marks": true,
    annotations: true,
    "measurement-pins": true,
    focus: true,
    "operator-annotations": true,
    "ai-annotations": true,
    measurements: true,
    risks: true,
    notes: true,
    knowledge: true,
  };
}

export function createInitialRepairRuntimeState(nowIso: string): RepairRuntimeState {
  const activeSession = MOCK_REPAIR_SESSIONS[MOCK_REPAIR_ACTIVE_SESSION_ID] ?? null;
  const activeSessionDurationMs =
    activeSession === null
      ? 0
      : Math.max(0, Date.parse(activeSession.updatedAt) - Date.parse(activeSession.startedAt));
  const tacticalFeed =
    activeSession === null
      ? []
      : buildMockTacticalFeed(activeSession.events, activeSession.startedAt).slice(0, 3);

  return {
    roomId: REPAIR_ROOM_ID,
    phase: activeSession === null ? "idle" : "session-active",
    activeSessionId: activeSession?.id ?? null,
    sessionList: MOCK_REPAIR_SESSION_LIST,
    sessions: MOCK_REPAIR_SESSIONS,
    workbench: {
      activeTool: "select",
      isFrozen: false,
      frozenAt: null,
      viewport: { zoom: 1, panXPx: 0, panYPx: 0 },
      timeline: {
        playheadMs: activeSessionDurationMs,
        zoom: 1,
        rangeStartMs: null,
        rangeEndMs: null,
        autoFollowLive: true,
        replayMode: "live",
        replaySpeed: 1,
        isPlaying: true,
        liveEdgeMs: activeSessionDurationMs,
      },
      cursor: { xPx: 1280, yPx: 720, gridX: 16, gridY: 16 },
      liveSource: { available: true, connected: false, sourceType: "image" },
      visibleLayers: createVisibleLayersMap(),
      hoveredEventId: null,
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
      contextualCursor: "inspect",
      operationalMode: "live",
      aiMarks: [],
      measurementEvidence: [],
      focusMode: false,
      investigationModeEnabled: false,
    },
    tacticalFeed,
    wizard: MOCK_REPAIR_WIZARD_INITIAL,
    knowledgePack: {
      pack: activeSession?.knowledgePack ?? null,
      attachedToSessionId: activeSession?.id ?? null,
      previewTabId: "schematic-preview",
      focusedSpatialRefId: null,
    },
    operatorProfile: MOCK_REPAIR_OPERATOR_PROFILE,
    operatorAdaptation: buildMockRepairAiAdaptation(MOCK_REPAIR_OPERATOR_PROFILE),
    measurement: MOCK_REPAIR_MEASUREMENT_STATE,
    chat: {
      turns: MOCK_REPAIR_CHAT_TURNS,
      composerDraft: "",
      pendingReplyId: null,
    },
    layout: {
      collapsedPanels: createCollapsedPanelMap(),
      operationalProfile: "novice",
      voiceGuidance: {
        ambientListeningState: "idle",
        spokenGuidanceMode: "brief",
        handsBusyMode: false,
      },
      interactionSettings: {
        androidCompanionEnabled: true,
        dictationRoute: "local",
        ttsRoute: "local",
        cameraFeedPreference: "manual",
        dictationSubmitMode: "composer",
        autoReadAiReplies: true,
      },
      attentionBudget: {
        windowMs: 180000,
        maxAiInterruptions: 2,
      },
      operatorProfileTabId: "tools",
      settingsOverlayOpen: false,
      settingsOverlayTabId: "repair-controls",
      focusMode: false,
      ambientClock: nowIso,
    },
    operationsStatus: null,
    livePreview: null,
    aiDispatch: createRepairDefaultAiDispatchState("ai2"),
    storage: createRepairDefaultStorageState(MOCK_REPAIR_SESSION_LIST.length),
    ambientNowIso: nowIso,
  };
}
