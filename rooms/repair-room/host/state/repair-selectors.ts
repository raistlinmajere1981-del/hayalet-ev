import { isRepairAiEvent, type RepairSession } from "../../shared/types/index.js";
import type { RepairUiSnapshotMeta, RepairUiState } from "../../shared/ui/state.js";
import type { RepairRuntimeState } from "./repair-runtime-state.js";

export function selectActiveSession(state: RepairRuntimeState): RepairSession | null {
  if (state.activeSessionId === null) {
    return null;
  }
  return state.sessions[state.activeSessionId] ?? null;
}

export function createRepairUiSnapshot(state: RepairRuntimeState): RepairUiState {
  const activeSession = selectActiveSession(state);
  return {
    phase: state.phase,
    sessions: {
      activeId: state.activeSessionId,
      list: state.sessionList,
      detail: activeSession,
    },
    workbench: state.workbench,
    tacticalFeed: state.tacticalFeed,
    wizard: state.wizard,
    knowledgePack: state.knowledgePack,
    operatorProfile: {
      profile: state.operatorProfile,
      adaptation: state.operatorAdaptation,
      isDirty: false,
    },
    measurement: state.measurement,
    chat: state.chat,
    layout: state.layout,
    ambient: {
      nowIso: state.ambientNowIso,
      sessionDurationMs:
        activeSession === null ? 0 : Math.max(0, state.workbench.timeline.playheadMs),
    },
  };
}

export function createRepairUiSnapshotMeta(state: RepairRuntimeState): RepairUiSnapshotMeta {
  const activeSession = selectActiveSession(state);
  const visibleFeedEventIds = new Set(state.tacticalFeed.map((item) => item.eventId));
  return {
    schemaVersion: 1,
    generatedAt: state.ambientNowIso,
    events:
      activeSession?.events.filter((event) =>
        isRepairAiEvent(event) ? visibleFeedEventIds.has(event.id) : true
      ) ?? [],
  };
}
