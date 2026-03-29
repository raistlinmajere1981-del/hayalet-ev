import { readLocale } from "../../../shared/host/context-state.js";
import { FATE_KNOTS_FEATURE_ID, ROOM_ID } from "../../../shared/host/feature-meta.js";
import { normalizeLocale, translate } from "../../../shared/host/text.js";
import {
  FATE_KNOTS_HISTORY_STATE_KEY,
  FATE_KNOTS_MAX_HISTORY_ENTRIES,
  FATE_KNOTS_PROFILE_STATE_KEY,
  FATE_KNOTS_SCHEMA_VERSION,
  FATE_KNOTS_SAVE_SLOT_STATE_KEY,
  FATE_KNOTS_STATE_KEY,
  FATE_KNOTS_STATUS_COPY,
} from "./constants.js";
import {
  buildFateKnotsCombatTurnId,
  cloneFateKnotsCombatState,
  getAvailableFateKnotsCombatActions,
  getCurrentFateKnotsCombatTurn,
} from "./combat-engine.js";
import {
  createInitialFateKnotsState,
  normalizeHistoryEntry,
  normalizeHistoryState,
  normalizeFateKnotsState,
  normalizeProfileState,
  normalizeSaveSlotState,
} from "./models.js";

function cloneJsonValue(value) {
  return value === undefined ? undefined : JSON.parse(JSON.stringify(value));
}

export function resolveFateKnotsStatusText(state) {
  const message = translate(state.locale, FATE_KNOTS_STATUS_COPY, state.statusKey);
  if (message) {
    return message;
  }
  if (state.waiting && state.waiting.reason) {
    return state.waiting.reason;
  }
  return translate(state.locale, FATE_KNOTS_STATUS_COPY, "idle");
}

export function loadFateKnotsState(api) {
  return normalizeFateKnotsState(api.getState(FATE_KNOTS_STATE_KEY), readLocale(api));
}

export function saveFateKnotsState(api, state) {
  const normalized = normalizeFateKnotsState(state, readLocale(api));
  normalized.locale = normalizeLocale(readLocale(api));
  api.setState(FATE_KNOTS_STATE_KEY, normalized);
  return normalized;
}

export function resetFateKnotsState(api, statusKey = "idle") {
  const nextState = createInitialFateKnotsState(readLocale(api));
  nextState.statusKey = statusKey;
  nextState.compatibility.mode = statusKey === "idle" ? "fresh" : "reset-safe";
  return saveFateKnotsState(api, nextState);
}

export function loadFateKnotsProfile(api) {
  return normalizeProfileState(api.getState(FATE_KNOTS_PROFILE_STATE_KEY));
}

export function saveFateKnotsProfile(api, profile) {
  const normalized = normalizeProfileState(profile);
  api.setState(FATE_KNOTS_PROFILE_STATE_KEY, normalized);
  return normalized;
}

export function loadFateKnotsHistory(api) {
  return normalizeHistoryState(api.getState(FATE_KNOTS_HISTORY_STATE_KEY));
}

export function saveFateKnotsHistory(api, history) {
  const normalized = normalizeHistoryState(history);
  api.setState(FATE_KNOTS_HISTORY_STATE_KEY, normalized);
  return normalized;
}

export function appendFateKnotsHistory(api, entry) {
  const nextEntry = normalizeHistoryEntry(entry);
  if (nextEntry.timestamp === null) {
    return loadFateKnotsHistory(api);
  }
  const nextHistory = [nextEntry]
    .concat(
      loadFateKnotsHistory(api).filter(function (item) {
        return item.sessionId !== nextEntry.sessionId;
      })
    )
    .slice(0, FATE_KNOTS_MAX_HISTORY_ENTRIES);
  return saveFateKnotsHistory(api, nextHistory);
}

export function loadFateKnotsSaveSlot(api) {
  return normalizeSaveSlotState(api.getState(FATE_KNOTS_SAVE_SLOT_STATE_KEY));
}

export function saveFateKnotsSaveSlot(api, saveSlot) {
  const normalized = normalizeSaveSlotState(saveSlot);
  api.setState(FATE_KNOTS_SAVE_SLOT_STATE_KEY, normalized);
  return normalized;
}

function resolveSelectionView(selection, contentRegistry) {
  const avatar = selection.avatarId ? contentRegistry.avatarsById.get(selection.avatarId) || null : null;
  const classDef = selection.classId ? contentRegistry.classesById.get(selection.classId) || null : null;
  const background = selection.backgroundId
    ? contentRegistry.backgroundsById.get(selection.backgroundId) || null
    : null;
  return {
    avatarId: selection.avatarId,
    classId: selection.classId,
    backgroundId: selection.backgroundId,
    locked: selection.locked,
    autoAssigned: selection.autoAssigned,
    avatar,
    class: classDef,
    background,
  };
}

function resolveParticipantView(participant, contentRegistry, combatState) {
  const combatant = combatState
    ? combatState.party.find(function (entry) {
        return entry.seatId === participant.seatId;
      }) || null
    : null;
  return {
    seatId: participant.seatId,
    provider: participant.provider,
    type: participant.type,
    nickname: participant.nickname,
    ready: participant.ready,
    connected: participant.connected,
    active: participant.active,
    selection: resolveSelectionView(participant.selection, contentRegistry),
    decisionChoiceId: participant.decisionChoiceId,
    combat: combatant
      ? {
          hp: combatant.hp,
          maxHp: combatant.maxHp,
          energy: combatant.energy,
          maxEnergy: combatant.maxEnergy,
          status: cloneJsonValue(combatant.status),
        }
      : null,
  };
}

function resolveStepView(state, contentRegistry) {
  if (!state.currentStepId) {
    return null;
  }
  const step = contentRegistry.scenarioStepsById.get(state.currentStepId) || null;
  if (!step) {
    return null;
  }
  const location = step.locationId ? contentRegistry.mapNodesById.get(step.locationId) || null : null;
  return {
    ...cloneJsonValue(step),
    location,
  };
}

function resolveDecisionView(state) {
  if (!state.decision) {
    return null;
  }
  return {
    stepId: state.decision.stepId,
    choiceIds: state.decision.choiceIds.slice(),
    votes: cloneJsonValue(state.decision.votes),
    participantIds: state.decision.participantIds.slice(),
    resolvedChoiceId: state.decision.resolvedChoiceId,
    conflict: state.decision.conflict,
    pendingSeatIds: state.decision.participantIds.filter(function (seatId) {
      return !state.decision.votes[seatId];
    }),
    deadlineAt: state.decision.deadlineAt,
  };
}

function resolveCombatView(state, contentRegistry) {
  const combat = cloneFateKnotsCombatState(state.combat);
  if (!combat) {
    return null;
  }
  const turn = getCurrentFateKnotsCombatTurn(combat);
  const turnId = buildFateKnotsCombatTurnId(combat);
  const availableActions =
    turn && turn.side === "party"
      ? getAvailableFateKnotsCombatActions(combat, turn.seatId, contentRegistry.cardsById)
      : [];
  return {
    encounterId: combat.encounterId,
    outcome: combat.outcome,
    round: combat.round,
    turn,
    turnId,
    party: combat.party.map(function (member) {
      const participant = state.participants.find(function (entry) {
        return entry.seatId === member.seatId;
      }) || null;
      return {
        ...member,
        selection: participant ? resolveSelectionView(participant.selection, contentRegistry) : null,
      };
    }),
    enemy: {
      ...combat.enemy,
      asset: combat.enemy.assetId ? contentRegistry.encountersById.get(combat.enemy.id)?.asset || null : null,
    },
    recentLog: combat.log.slice(-8),
    availableActions,
  };
}

function resolveAmbientPacketView(packet) {
  if (!packet || typeof packet !== "object") {
    return null;
  }
  return cloneJsonValue(packet);
}

export function serializeFateKnotsState(api, state, context, contentRegistry) {
  const savedState = saveFateKnotsState(api, state);
  const combat = resolveCombatView(savedState, contentRegistry);
  return {
    roomId: ROOM_ID,
    featureId: FATE_KNOTS_FEATURE_ID,
    schemaVersion: FATE_KNOTS_SCHEMA_VERSION,
    active: savedState.active,
    phase: savedState.phase,
    statusKey: savedState.statusKey,
    status: resolveFateKnotsStatusText(savedState),
    compatibility: cloneJsonValue(savedState.compatibility),
    sessionId: savedState.sessionId,
    participantMode: savedState.participantMode,
    rosterLocked: savedState.rosterLocked,
    participants: savedState.participants.map(function (participant) {
      return resolveParticipantView(participant, contentRegistry, combat);
    }),
    excludedSeats: cloneJsonValue(savedState.excludedSeats),
    waiting: cloneJsonValue(savedState.waiting),
    map: {
      ...cloneJsonValue(contentRegistry.map),
      currentLocationId: savedState.currentLocationId,
    },
    currentStep: resolveStepView(savedState, contentRegistry),
    decision: resolveDecisionView(savedState),
    combat,
    result: cloneJsonValue(savedState.result),
    dmNarration: resolveAmbientPacketView(savedState.dmNarration),
    npcBanter: resolveAmbientPacketView(savedState.npcBanter),
    scenarioLog: savedState.scenarioLog.slice(-12),
    profile: loadFateKnotsProfile(api),
    history: loadFateKnotsHistory(api),
    saveSlot: loadFateKnotsSaveSlot(api),
    catalogs: {
      avatars: cloneJsonValue(contentRegistry.selections.avatars),
      classes: cloneJsonValue(contentRegistry.selections.classes),
      backgrounds: cloneJsonValue(contentRegistry.selections.backgrounds),
    },
    assetCoverage: cloneJsonValue(contentRegistry.assetCoverage),
    contentErrors: contentRegistry.errors.slice(),
    contentSummary: cloneJsonValue(savedState.contentSummary),
    transport: cloneJsonValue(savedState.transport),
    user: {
      nickname: context?.user?.nickname || "User",
    },
    uiAssets: {
      featureView: contentRegistry.assetRegistry.assetMap.get("fate-knots-view") || null,
    },
  };
}

export function pushFateKnotsState(api, state, contentRegistry) {
  const context = api.getState("xox-context") || {};
  api.notifyRoom("fate-knots-state", {
    state: serializeFateKnotsState(api, state, context, contentRegistry),
  });
  return loadFateKnotsState(api);
}

export function refreshFateKnotsState(api, contentRegistry) {
  return pushFateKnotsState(api, loadFateKnotsState(api), contentRegistry);
}
