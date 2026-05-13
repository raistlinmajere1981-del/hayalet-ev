import type { RepairRuntimeAction } from "./repair-runtime-actions.js";
import type { RepairRuntimeState } from "./repair-runtime-state.js";

const RECENT_READINGS_LIMIT = 32;

export function reduceRepairRuntimeState(
  state: RepairRuntimeState,
  action: RepairRuntimeAction
): RepairRuntimeState {
  // NOTE: Repair Room reducer keeps state transitions explicit so the mock host runtime and
  // future real-data orchestration can both flow through a single audit-friendly path.
  switch (action.type) {
    case "phase/set":
      return { ...state, phase: action.phase };
    case "session/activate":
      return { ...state, activeSessionId: action.sessionId };
    case "session/upsert": {
      const next = {
        ...state.sessions,
        [action.session.id]: action.session,
      };
      return { ...state, sessions: next };
    }
    case "session-list/set":
      return { ...state, sessionList: action.list };
    case "workbench/set-tool":
      return {
        ...state,
        workbench: { ...state.workbench, activeTool: action.tool },
      };
    case "workbench/set-frozen":
      return {
        ...state,
        workbench: {
          ...state.workbench,
          isFrozen: action.isFrozen,
          frozenAt: action.frozenAt,
        },
      };
    case "workbench/set-cursor":
      return {
        ...state,
        workbench: {
          ...state.workbench,
          cursor: {
            xPx: action.xPx,
            yPx: action.yPx,
            gridX: action.gridX,
            gridY: action.gridY,
          },
        },
      };
    case "workbench/set-viewport":
      return {
        ...state,
        workbench: {
          ...state.workbench,
          viewport: {
            zoom: action.zoom,
            panXPx: action.panXPx,
            panYPx: action.panYPx,
          },
        },
      };
    case "workbench/set-timeline":
      return {
        ...state,
        workbench: {
          ...state.workbench,
          timeline: {
            playheadMs: action.playheadMs,
            zoom: action.zoom,
            rangeStartMs: action.rangeStartMs,
            rangeEndMs: action.rangeEndMs,
            autoFollowLive: action.autoFollowLive,
            replayMode: action.replayMode ?? state.workbench.timeline.replayMode,
            replaySpeed: action.replaySpeed ?? state.workbench.timeline.replaySpeed,
            isPlaying: action.isPlaying ?? state.workbench.timeline.isPlaying,
            liveEdgeMs: action.liveEdgeMs ?? state.workbench.timeline.liveEdgeMs,
          },
        },
      };
    case "workbench/toggle-layer":
      return {
        ...state,
        workbench: {
          ...state.workbench,
          visibleLayers: {
            ...state.workbench.visibleLayers,
            [action.layerId]: action.visible,
          },
        },
      };
    case "workbench/set-focus-event":
      return {
        ...state,
        workbench: {
          ...state.workbench,
          focusedEventId: action.eventId,
          selection: {
            ...state.workbench.selection,
            selectedEventIds: action.eventId === null ? [] : [action.eventId],
            inspectorEventId: action.eventId,
            focusJumpEventId: action.eventId,
          },
        },
      };
    case "workbench/set-selection":
      return {
        ...state,
        workbench: {
          ...state.workbench,
          focusedEventId:
            "focusedEventId" in action
              ? (action.focusedEventId ?? null)
              : state.workbench.focusedEventId,
          hoveredEventId:
            "hoveredEventId" in action.selection
              ? (action.selection.hoveredEventId ?? null)
              : state.workbench.hoveredEventId,
          selection: {
            ...state.workbench.selection,
            ...action.selection,
          },
        },
      };
    case "workbench/set-focus-mode":
      return {
        ...state,
        workbench: { ...state.workbench, focusMode: action.focusMode },
      };
    case "events/append": {
      const target = state.sessions[action.sessionId];
      if (target === undefined) {
        return state;
      }
      const nextSession = {
        ...target,
        events: [...target.events, action.event],
        updatedAt: action.event.occurredAt,
      };
      return {
        ...state,
        sessions: { ...state.sessions, [action.sessionId]: nextSession },
      };
    }
    case "tactical-feed/set":
      return { ...state, tacticalFeed: action.items };
    case "tactical-feed/append":
      return {
        ...state,
        tacticalFeed: [...state.tacticalFeed, action.item],
      };
    case "wizard/set":
      return { ...state, wizard: action.wizard };
    case "wizard/advance":
      return {
        ...state,
        wizard: { ...state.wizard, currentStep: action.step },
      };
    case "wizard/patch-draft":
      return {
        ...state,
        wizard: {
          ...state.wizard,
          draft: {
            ...state.wizard.draft,
            ...action.patch,
          },
        },
      };
    case "knowledge-pack/set":
      return {
        ...state,
        knowledgePack: {
          pack: action.pack,
          attachedToSessionId: action.attachedToSessionId,
          previewTabId: state.knowledgePack.previewTabId,
          focusedSpatialRefId: state.knowledgePack.focusedSpatialRefId,
        },
      };
    case "knowledge-pack/set-preview-tab":
      return {
        ...state,
        knowledgePack: { ...state.knowledgePack, previewTabId: action.tabId },
      };
    case "knowledge-pack/set-spatial-focus":
      return {
        ...state,
        knowledgePack: { ...state.knowledgePack, focusedSpatialRefId: action.spatialRefId },
      };
    case "operator-profile/set":
      return { ...state, operatorProfile: action.profile };
    case "measurement/append-reading": {
      const next = [action.reading, ...state.measurement.recent].slice(0, RECENT_READINGS_LIMIT);
      return {
        ...state,
        measurement: { ...state.measurement, recent: next },
      };
    }
    case "measurement/set-display":
      return {
        ...state,
        measurement: {
          ...state.measurement,
          current: {
            ...state.measurement.current,
            display: action.display,
            value: action.value,
            hold: action.hold,
          },
        },
      };
    case "measurement/set-instrument":
      return {
        ...state,
        measurement: {
          ...state.measurement,
          activeInstrumentKind: action.instrumentKind,
        },
      };
    case "chat/append-turn":
      return {
        ...state,
        chat: { ...state.chat, turns: [...state.chat.turns, action.turn] },
      };
    case "chat/set-composer":
      return {
        ...state,
        chat: { ...state.chat, composerDraft: action.draft },
      };
    case "chat/set-pending":
      return {
        ...state,
        chat: { ...state.chat, pendingReplyId: action.turnId },
      };
    case "layout/collapse-panel":
      return {
        ...state,
        layout: {
          ...state.layout,
          collapsedPanels: {
            ...state.layout.collapsedPanels,
            [action.panelId]: action.collapsed,
          },
        },
      };
    case "layout/pin-panel":
      return {
        ...state,
        layout: {
          ...state.layout,
          pinnedPanels: {
            ...state.layout.pinnedPanels,
            [action.panelId]: action.pinned,
          },
        },
      };
    case "layout/set-focus-mode":
      return {
        ...state,
        layout: { ...state.layout, focusMode: action.focusMode },
      };
    case "layout/set-operator-profile-tab":
      return {
        ...state,
        layout: { ...state.layout, operatorProfileTabId: action.tabId },
      };
    case "ambient/tick":
      return {
        ...state,
        ambientNowIso: action.nowIso,
        layout: { ...state.layout, ambientClock: action.nowIso },
      };
    default:
      return state;
  }
}
