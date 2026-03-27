import {
  getActiveFeatureId,
  loadContext,
  readLocale,
} from "../../../shared/host/context-state.js";
import {
  FATE_KNOTS_FEATURE_ID,
  FATE_KNOTS_PAGE_ID,
  ROOM_ID,
} from "../../../shared/host/feature-meta.js";
import { fillTemplate, translate } from "../../../shared/host/text.js";
import {
  FATE_KNOTS_COMMAND_COPY,
  FATE_KNOTS_CONTENT_STATE_KEY,
  FATE_KNOTS_PHASES,
  FATE_KNOTS_SUPPORTED_AI_SEATS,
  FATE_KNOTS_WAIT_MODES,
  FATE_KNOTS_WAIT_TIMEOUT_MS,
} from "./constants.js";
import { loadFateKnotsContentRegistry } from "./content-loader.js";
import {
  applyFateKnotsCombatAction,
  buildFateKnotsCombatTurnId,
  createFateKnotsCombatState,
  getCurrentFateKnotsCombatTurn,
  settleAutomaticFateKnotsCombatTurns,
} from "./combat-engine.js";
import {
  createDecisionState,
  createHeroSelection,
  createParticipant,
  createWaitingState,
} from "./models.js";
import {
  readFateKnotsChoicePayload,
  readFateKnotsCombatPayload,
  readFateKnotsSelectionPayload,
  readFateKnotsSyncPayload,
  resolveFateKnotsSeatId,
} from "./payloads.js";
import {
  loadFateKnotsState,
  pushFateKnotsState,
  refreshFateKnotsState,
  resetFateKnotsState,
} from "./state.js";

function commandMessage(locale, key, params) {
  return fillTemplate(translate(locale, FATE_KNOTS_COMMAND_COPY, key), params || {});
}

function buildSessionId() {
  return `fateknot_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

function ensureFateKnotsContent(api) {
  const cached = api.getState(FATE_KNOTS_CONTENT_STATE_KEY);
  if (cached && typeof cached === "object" && cached.assetRegistry && cached.cardsById instanceof Map) {
    return cached;
  }
  const loaded = loadFateKnotsContentRegistry();
  api.setState(FATE_KNOTS_CONTENT_STATE_KEY, loaded);
  return loaded;
}

function updateContentSummary(state, contentRegistry) {
  state.contentSummary = {
    assetErrors: Array.isArray(contentRegistry.assetRegistry?.errors)
      ? contentRegistry.assetRegistry.errors.length
      : 0,
    sourceErrors: Array.isArray(contentRegistry.errors) ? contentRegistry.errors.length : 0,
  };
  return state;
}

function getUserParticipant(state) {
  return (
    state.participants.find(function (participant) {
      return participant.seatId === "user";
    }) || null
  );
}

function getParticipant(state, seatId) {
  return (
    state.participants.find(function (participant) {
      return participant.seatId === seatId;
    }) || null
  );
}

function listPendingDecisionSeats(state) {
  if (!state.decision) {
    return [];
  }
  return state.decision.participantIds.filter(function (seatId) {
    return !state.decision.votes[seatId];
  });
}

function hashString(value) {
  const source = String(value || "fate-knots");
  let hash = 0;
  for (let index = 0; index < source.length; index += 1) {
    hash = (hash * 31 + source.charCodeAt(index)) >>> 0;
  }
  return hash;
}

function pickDeterministicEntry(list, seed, offset) {
  if (!Array.isArray(list) || list.length === 0) {
    return null;
  }
  return list[(hashString(`${seed}:${offset}`) + offset) % list.length] || null;
}

function buildRunParticipants(context, contentRegistry, sessionId) {
  const userParticipant = createParticipant({
    seatId: "user",
    provider: "room-ui",
    type: "local-user",
    nickname: context?.user?.nickname || "User",
    ready: true,
    connected: true,
    selection: createHeroSelection(),
  });

  const aiParticipants = FATE_KNOTS_SUPPORTED_AI_SEATS.filter(function (seatId) {
    return context?.slots?.[seatId]?.ready === true;
  }).map(function (seatId, index) {
    const slot = context.slots[seatId];
    const avatar = pickDeterministicEntry(contentRegistry.selections.avatars, sessionId, index);
    const classDef = pickDeterministicEntry(contentRegistry.selections.classes, sessionId, index + 11);
    const background = pickDeterministicEntry(
      contentRegistry.selections.backgrounds,
      sessionId,
      index + 23
    );

    return createParticipant({
      seatId,
      provider: seatId,
      type: "ai",
      nickname: slot.nickname,
      ready: slot.ready === true,
      connected: slot.connected !== false,
      selection: {
        avatarId: avatar?.id || null,
        classId: classDef?.id || null,
        backgroundId: background?.id || null,
        locked: true,
        autoAssigned: true,
        updatedAt: Date.now(),
      },
    });
  });

  const excludedSeats = [];
  if (context?.slots?.us1?.ready === true) {
    excludedSeats.push({
      seatId: "us1",
      reason: "v1-remote-deferred",
    });
  }

  return {
    participants: [userParticipant, ...aiParticipants],
    excludedSeats,
  };
}

function isSelectionComplete(selection) {
  return !!(selection?.avatarId && selection?.classId && selection?.backgroundId);
}

function validateSelectionPayload(selectionPayload, contentRegistry) {
  if (
    selectionPayload.avatarId &&
    contentRegistry.avatarsById.has(selectionPayload.avatarId) !== true
  ) {
    return false;
  }
  if (
    selectionPayload.classId &&
    contentRegistry.classesById.has(selectionPayload.classId) !== true
  ) {
    return false;
  }
  if (
    selectionPayload.backgroundId &&
    contentRegistry.backgroundsById.has(selectionPayload.backgroundId) !== true
  ) {
    return false;
  }
  return true;
}

function applySelectionPayload(participant, selectionPayload, now) {
  participant.selection.avatarId = selectionPayload.avatarId || participant.selection.avatarId;
  participant.selection.classId = selectionPayload.classId || participant.selection.classId;
  participant.selection.backgroundId =
    selectionPayload.backgroundId || participant.selection.backgroundId;
  participant.selection.updatedAt = now;
}

function setIdleWaiting(state) {
  state.waiting = createWaitingState(FATE_KNOTS_WAIT_MODES.idle, "", []);
}

function setDecisionWaiting(state, now) {
  const pendingSeatIds = listPendingDecisionSeats(state);
  if (pendingSeatIds.length === 0) {
    setIdleWaiting(state);
    return;
  }
  state.waiting = createWaitingState(
    FATE_KNOTS_WAIT_MODES.decision,
    "",
    pendingSeatIds,
    now,
    FATE_KNOTS_WAIT_TIMEOUT_MS
  );
}

function setCombatWaiting(state, now) {
  const turn = getCurrentFateKnotsCombatTurn(state.combat);
  if (!turn || state.combat?.outcome !== "pending") {
    setIdleWaiting(state);
    return;
  }
  if (turn.side === "party" && turn.seatId !== "user") {
    state.waiting = createWaitingState(
      FATE_KNOTS_WAIT_MODES.combat,
      "",
      [turn.seatId],
      now,
      FATE_KNOTS_WAIT_TIMEOUT_MS
    );
    return;
  }
  setIdleWaiting(state);
}

function markDesync(state, reason, pendingSeatIds, statusKey, now) {
  state.waiting = createWaitingState(FATE_KNOTS_WAIT_MODES.desync, reason, pendingSeatIds, now, 0);
  state.statusKey = statusKey;
}

function syncParticipantSeatStatus(state, context) {
  state.participants.forEach(function (participant) {
    if (participant.seatId === "user") {
      participant.ready = true;
      participant.connected = true;
      return;
    }
    const slot = context?.slots?.[participant.seatId] || null;
    participant.ready = slot?.ready === true;
    participant.connected = slot?.connected !== false;
    participant.nickname = slot?.nickname || participant.nickname;
  });
}

function maybeMarkSeatLossOrTimeout(state, context, now) {
  syncParticipantSeatStatus(state, context);
  if (!state.active) {
    return;
  }

  const missingSeat = state.participants.find(function (participant) {
    return participant.seatId !== "user" && participant.ready !== true;
  });
  if (missingSeat) {
    markDesync(state, `seat-unavailable:${missingSeat.seatId}`, [missingSeat.seatId], "seatUnavailable", now);
    return;
  }

  if (
    state.waiting &&
    state.waiting.mode !== FATE_KNOTS_WAIT_MODES.idle &&
    state.waiting.mode !== FATE_KNOTS_WAIT_MODES.desync &&
    typeof state.waiting.deadlineAt === "number" &&
    now > state.waiting.deadlineAt &&
    Array.isArray(state.waiting.pendingSeatIds) &&
    state.waiting.pendingSeatIds.length > 0
  ) {
    const statusKey =
      state.waiting.mode === FATE_KNOTS_WAIT_MODES.decision
        ? "decisionTimeout"
        : "combatTimeout";
    markDesync(state, `${state.waiting.mode}-timeout`, state.waiting.pendingSeatIds, statusKey, now);
  }
}

function buildDecisionPrompt(state, step, context) {
  const choiceLines = step.choices
    .map(function (choice) {
      return `- ${choice.id}: ${choice.label} | ${choice.summary}`;
    })
    .join("\n");

  return [
    "Fate Knots common-decision update from the Game Room.",
    "Reply with exactly one command line.",
    'Use ++cmd:GameRoomFateKnotsAiChoice({"sessionId":"' + state.sessionId + '","stepId":"' + step.id + '","choiceId":"<choice-id>"})',
    "Do not add prose, markdown, or a second command.",
    "",
    `Party lead: ${context?.user?.nickname || "User"}`,
    `Step: ${step.title}`,
    step.body,
    "",
    "Choices:",
    choiceLines,
  ].join("\n");
}

function buildCombatPrompt(state, contentRegistry) {
  const turn = getCurrentFateKnotsCombatTurn(state.combat);
  const turnId = buildFateKnotsCombatTurnId(state.combat);
  const actor = getParticipant(state, turn?.seatId || "") || { nickname: turn?.seatId || "Seat" };
  const actions = state.combat
    ? state.combat.party.find(function (member) {
        return member.seatId === turn?.seatId;
      })?.deck || []
    : [];
  const actionPacket = actions
    .map(function (actionId) {
      return contentRegistry.cardsById.get(actionId) || null;
    })
    .filter(Boolean)
    .map(function (card) {
      return {
        id: card.id,
        label: card.label,
        cost: card.cost,
        type: card.type,
        description: card.description,
      };
    });

  return [
    "Fate Knots combat update from the Game Room.",
    "Reply with exactly one command line.",
    'Use ++cmd:GameRoomFateKnotsAiCombatAction({"sessionId":"' + state.sessionId + '","encounterId":"' + state.combat.encounterId + '","turnId":"' + turnId + '","actionId":"<card-id>"})',
    "Do not add prose, markdown, or a second command.",
    "",
    JSON.stringify(
      {
        sessionId: state.sessionId,
        encounterId: state.combat.encounterId,
        turnId,
        actor: {
          seatId: turn?.seatId,
          nickname: actor.nickname,
          hp: state.combat.party.find((member) => member.seatId === turn?.seatId)?.hp || 0,
          energy: state.combat.party.find((member) => member.seatId === turn?.seatId)?.energy || 0,
        },
        enemy: {
          label: state.combat.enemy.label,
          hp: state.combat.enemy.hp,
          maxHp: state.combat.enemy.maxHp,
        },
        actions: actionPacket,
        recentLog: state.combat.log.slice(-5),
      },
      null,
      2
    ),
  ].join("\n");
}

async function dispatchDecisionPrompts(api, state, contentRegistry) {
  if (!state.decision || !state.currentStepId) {
    return { success: true };
  }
  const context = loadContext(api);
  const step = contentRegistry.scenarioStepsById.get(state.currentStepId);
  if (!step) {
    return { success: false };
  }
  const pendingSeats = listPendingDecisionSeats(state).filter(function (seatId) {
    return seatId !== "user";
  });
  for (const seatId of pendingSeats) {
    const participant = getParticipant(state, seatId);
    if (!participant || participant.ready !== true) {
      return { success: false, seatId };
    }
    const protocolResult = await api.sendProtocol({
      room: ROOM_ID,
      scenario: "fate-knots-ai-decision",
      targets: [seatId],
      context: {
        featureId: FATE_KNOTS_FEATURE_ID,
        sessionId: state.sessionId,
        stepId: state.currentStepId,
      },
    });
    if (!protocolResult || protocolResult.success !== true) {
      return { success: false, seatId };
    }
    const messageResult = await api.sendMessage({
      provider: seatId,
      page: FATE_KNOTS_PAGE_ID,
      text: buildDecisionPrompt(state, step, context),
    });
    if (!messageResult || messageResult.success !== true) {
      return { success: false, seatId };
    }
  }
  return { success: true };
}

async function dispatchCombatPrompt(api, state, contentRegistry) {
  const turn = getCurrentFateKnotsCombatTurn(state.combat);
  if (!turn || turn.side !== "party" || turn.seatId === "user") {
    return { success: true };
  }
  const participant = getParticipant(state, turn.seatId);
  if (!participant || participant.ready !== true) {
    return { success: false, seatId: turn.seatId };
  }
  const protocolResult = await api.sendProtocol({
    room: ROOM_ID,
    scenario: "fate-knots-ai-combat",
    targets: [turn.seatId],
    context: {
      featureId: FATE_KNOTS_FEATURE_ID,
      sessionId: state.sessionId,
      encounterId: state.combat.encounterId,
    },
  });
  if (!protocolResult || protocolResult.success !== true) {
    return { success: false, seatId: turn.seatId };
  }
  const messageResult = await api.sendMessage({
    provider: turn.seatId,
    page: FATE_KNOTS_PAGE_ID,
    text: buildCombatPrompt(state, contentRegistry),
  });
  if (!messageResult || messageResult.success !== true) {
    return { success: false, seatId: turn.seatId };
  }
  return { success: true };
}

function startScenarioStep(state, contentRegistry, stepId, now) {
  const step = contentRegistry.scenarioStepsById.get(stepId);
  if (!step) {
    state.phase = FATE_KNOTS_PHASES.result;
    state.statusKey = "resultDefeat";
    state.result = {
      outcome: "failed-load",
      title: "Missing Step",
      summary: `The scenario step ${stepId} could not be loaded.`,
      continueHint: "Reset to reload the slice.",
    };
    setIdleWaiting(state);
    return;
  }
  state.phase = FATE_KNOTS_PHASES.scenario;
  state.currentStepId = step.id;
  state.currentLocationId = step.locationId || state.currentLocationId;
  state.decision = createDecisionState({
    stepId: step.id,
    choices: step.choices,
    participantIds: state.participants.map(function (participant) {
      return participant.seatId;
    }),
    now,
    timeoutMs: FATE_KNOTS_WAIT_TIMEOUT_MS,
  });
  state.participants.forEach(function (participant) {
    participant.decisionChoiceId = null;
  });
  state.scenarioLog.push(`${step.title}: ${step.body}`);
  state.statusKey = "waitingDecision";
  setDecisionWaiting(state, now);
}

function finalizeRun(state, outcome, title, summary) {
  state.phase = FATE_KNOTS_PHASES.result;
  state.result = {
    outcome,
    title,
    summary,
    continueHint: "Reset to replay the slice.",
  };
  state.statusKey = outcome === "victory" ? "resultVictory" : "resultDefeat";
  setIdleWaiting(state);
}

function resolveDecisionProgress(state, contentRegistry, now) {
  const currentStep = contentRegistry.scenarioStepsById.get(state.currentStepId);
  if (!state.decision || !currentStep) {
    return;
  }
  const pendingSeatIds = listPendingDecisionSeats(state);
  if (pendingSeatIds.length > 0) {
    state.statusKey = "waitingDecision";
    setDecisionWaiting(state, now);
    return;
  }

  const voteValues = Object.values(state.decision.votes);
  const unanimousChoiceId = voteValues.every(function (choiceId) {
    return choiceId === voteValues[0];
  })
    ? voteValues[0]
    : null;

  if (!unanimousChoiceId) {
    state.decision.conflict = true;
    markDesync(state, "decision-conflict", [], "decisionConflict", now);
    return;
  }

  state.decision.resolvedChoiceId = unanimousChoiceId;
  const choice = currentStep.choices.find(function (entry) {
    return entry.id === unanimousChoiceId;
  });
  if (!choice) {
    markDesync(state, "missing-choice", [], "decisionConflict", now);
    return;
  }
  state.scenarioLog.push(`Shared decision: ${choice.label}`);

  if (choice.nextStepId) {
    startScenarioStep(state, contentRegistry, choice.nextStepId, now);
    return;
  }

  if (choice.encounterId) {
    const encounter = contentRegistry.encountersById.get(choice.encounterId);
    state.combat = createFateKnotsCombatState({
      participants: state.participants,
      encounter,
      classesById: contentRegistry.classesById,
      startingEnergy: contentRegistry.combatConfig.startingEnergy,
    });
    state.phase = FATE_KNOTS_PHASES.combat;
    state.statusKey = "combatTurnUser";
    setCombatWaiting(state, now);
    settleAutomaticFateKnotsCombatTurns(state.combat, contentRegistry.enemyActionsById);
    if (state.combat.outcome === "victory") {
      finalizeRun(
        state,
        "victory",
        "Village Secured",
        "The party held the line and the first Fate Knots slice ends in victory."
      );
      return;
    }
    if (state.combat.outcome === "defeat") {
      finalizeRun(
        state,
        "defeat",
        "The Knot Tightens",
        "The party fell before it could stabilize the square."
      );
      return;
    }
    const turn = getCurrentFateKnotsCombatTurn(state.combat);
    state.statusKey = turn?.seatId === "user" ? "combatTurnUser" : "combatTurnAi";
    setCombatWaiting(state, now);
    return;
  }

  finalizeRun(
    state,
    "victory",
    "Slice Complete",
    "The opening Fate Knots slice reached its current continuation hook."
  );
}

async function advancePendingWork(api, state, contentRegistry, now) {
  maybeMarkSeatLossOrTimeout(state, loadContext(api), now);
  if (state.waiting.mode === FATE_KNOTS_WAIT_MODES.desync) {
    return { success: false };
  }

  if (state.phase === FATE_KNOTS_PHASES.scenario) {
    const result = await dispatchDecisionPrompts(api, state, contentRegistry);
    if (!result.success) {
      markDesync(state, `dispatch-failed:${result.seatId || "unknown"}`, result.seatId ? [result.seatId] : [], "seatUnavailable", now);
      return { success: false };
    }
    return { success: true };
  }

  if (state.phase === FATE_KNOTS_PHASES.combat) {
    const turn = getCurrentFateKnotsCombatTurn(state.combat);
    if (turn?.side === "party" && turn.seatId !== "user") {
      const result = await dispatchCombatPrompt(api, state, contentRegistry);
      if (!result.success) {
        markDesync(state, `dispatch-failed:${result.seatId || "unknown"}`, result.seatId ? [result.seatId] : [], "seatUnavailable", now);
        return { success: false };
      }
    }
  }

  return { success: true };
}

function ensureActiveSession(state, locale) {
  if (!state.active || !state.sessionId) {
    return { success: false, message: commandMessage(locale, "notActive") };
  }
  return null;
}

function validateSessionId(expectedSessionId, payloadSessionId, locale) {
  if (payloadSessionId && expectedSessionId && payloadSessionId !== expectedSessionId) {
    return { success: false, message: commandMessage(locale, "stalePayload") };
  }
  return null;
}

function recoverDecisionConflict(state, now) {
  if (!state.decision) {
    return;
  }
  state.participants.forEach(function (participant) {
    if (participant.seatId !== "user") {
      participant.decisionChoiceId = null;
      delete state.decision.votes[participant.seatId];
    }
  });
  state.decision.conflict = false;
  state.decision.resolvedChoiceId = null;
  state.decision.updatedAt = now;
  setDecisionWaiting(state, now);
  state.statusKey = "waitingDecision";
}

async function handleStart(api) {
  const contentRegistry = ensureFateKnotsContent(api);
  const context = loadContext(api);
  const readyAiSeats = FATE_KNOTS_SUPPORTED_AI_SEATS.filter(function (seatId) {
    return context?.slots?.[seatId]?.ready === true;
  });
  if (readyAiSeats.length === 0) {
    refreshFateKnotsState(api, contentRegistry);
    return { success: false, message: commandMessage(readLocale(api), "needReadyCompanions") };
  }

  const sessionId = buildSessionId();
  const now = Date.now();
  const state = resetFateKnotsState(api, "idle");
  const runConfig = buildRunParticipants(context, contentRegistry, sessionId);

  state.active = true;
  state.phase = FATE_KNOTS_PHASES.characterCreation;
  state.statusKey = "characterCreation";
  state.sessionId = sessionId;
  state.rosterLocked = true;
  state.participants = runConfig.participants;
  state.excludedSeats = runConfig.excludedSeats;
  state.startedAt = now;
  state.updatedAt = now;
  updateContentSummary(state, contentRegistry);
  setIdleWaiting(state);
  pushFateKnotsState(api, state, contentRegistry);
  return { success: true, message: commandMessage(readLocale(api), "started") };
}

function handleReset(api) {
  const contentRegistry = ensureFateKnotsContent(api);
  pushFateKnotsState(api, resetFateKnotsState(api, "idle"), contentRegistry);
  return { success: true, message: commandMessage(readLocale(api), "reset") };
}

function handleCharacterSelect(api, payload) {
  const contentRegistry = ensureFateKnotsContent(api);
  const state = loadFateKnotsState(api);
  const activeSession = ensureActiveSession(state, readLocale(api));
  if (activeSession) {
    pushFateKnotsState(api, state, contentRegistry);
    return activeSession;
  }
  if (state.phase !== FATE_KNOTS_PHASES.characterCreation) {
    pushFateKnotsState(api, state, contentRegistry);
    return { success: false, message: commandMessage(readLocale(api), "wrongPhase") };
  }
  const userParticipant = getUserParticipant(state);
  if (!userParticipant || userParticipant.selection.locked === true) {
    pushFateKnotsState(api, state, contentRegistry);
    return { success: false, message: commandMessage(readLocale(api), "wrongPhase") };
  }

  const selectionPayload = readFateKnotsSelectionPayload(payload);
  if (validateSelectionPayload(selectionPayload, contentRegistry) !== true) {
    pushFateKnotsState(api, state, contentRegistry);
    return { success: false, message: commandMessage(readLocale(api), "invalidSelection") };
  }

  applySelectionPayload(userParticipant, selectionPayload, Date.now());
  updateContentSummary(state, contentRegistry);
  pushFateKnotsState(api, state, contentRegistry);
  return { success: true, message: commandMessage(readLocale(api), "selectionSaved") };
}

async function handleReady(api) {
  const contentRegistry = ensureFateKnotsContent(api);
  const state = loadFateKnotsState(api);
  const activeSession = ensureActiveSession(state, readLocale(api));
  if (activeSession) {
    pushFateKnotsState(api, state, contentRegistry);
    return activeSession;
  }
  if (state.phase !== FATE_KNOTS_PHASES.characterCreation) {
    pushFateKnotsState(api, state, contentRegistry);
    return { success: false, message: commandMessage(readLocale(api), "wrongPhase") };
  }

  const userParticipant = getUserParticipant(state);
  if (!userParticipant || isSelectionComplete(userParticipant.selection) !== true) {
    pushFateKnotsState(api, state, contentRegistry);
    return { success: false, message: commandMessage(readLocale(api), "incompleteSelection") };
  }

  userParticipant.selection.locked = true;
  userParticipant.selection.updatedAt = Date.now();
  const everyoneLocked = state.participants.every(function (participant) {
    return participant.selection.locked === true && isSelectionComplete(participant.selection) === true;
  });
  if (everyoneLocked) {
    startScenarioStep(state, contentRegistry, contentRegistry.scenario.entryStepId, Date.now());
    await advancePendingWork(api, state, contentRegistry, Date.now());
  }
  updateContentSummary(state, contentRegistry);
  pushFateKnotsState(api, state, contentRegistry);
  return { success: true, message: commandMessage(readLocale(api), "ready") };
}

async function handleChoice(api, payload) {
  const contentRegistry = ensureFateKnotsContent(api);
  const state = loadFateKnotsState(api);
  const locale = readLocale(api);
  const activeSession = ensureActiveSession(state, locale);
  if (activeSession) {
    pushFateKnotsState(api, state, contentRegistry);
    return activeSession;
  }
  if (state.phase !== FATE_KNOTS_PHASES.scenario || !state.decision) {
    pushFateKnotsState(api, state, contentRegistry);
    return { success: false, message: commandMessage(locale, "wrongPhase") };
  }

  const choicePayload = readFateKnotsChoicePayload(payload);
  const stale = validateSessionId(state.sessionId, choicePayload.sessionId, locale);
  if (stale) {
    pushFateKnotsState(api, state, contentRegistry);
    return stale;
  }
  if (choicePayload.stepId && choicePayload.stepId !== state.currentStepId) {
    pushFateKnotsState(api, state, contentRegistry);
    return { success: false, message: commandMessage(locale, "stalePayload") };
  }

  const seatId = resolveFateKnotsSeatId(payload);
  const participant = seatId ? getParticipant(state, seatId) : null;
  if (!seatId || !participant) {
    pushFateKnotsState(api, state, contentRegistry);
    return { success: false, message: commandMessage(locale, "providerMismatch") };
  }
  if (!state.decision.choiceIds.includes(choicePayload.choiceId || "")) {
    pushFateKnotsState(api, state, contentRegistry);
    return { success: false, message: commandMessage(locale, "invalidChoice") };
  }

  participant.decisionChoiceId = choicePayload.choiceId;
  state.decision.votes[seatId] = choicePayload.choiceId;
  state.decision.updatedAt = Date.now();
  state.decision.conflict = false;
  resolveDecisionProgress(state, contentRegistry, Date.now());
  await advancePendingWork(api, state, contentRegistry, Date.now());
  pushFateKnotsState(api, state, contentRegistry);
  return { success: true, message: commandMessage(locale, "choiceAccepted") };
}

async function handleCombatAction(api, payload) {
  const contentRegistry = ensureFateKnotsContent(api);
  const state = loadFateKnotsState(api);
  const locale = readLocale(api);
  const activeSession = ensureActiveSession(state, locale);
  if (activeSession) {
    pushFateKnotsState(api, state, contentRegistry);
    return activeSession;
  }
  if (state.phase !== FATE_KNOTS_PHASES.combat || !state.combat) {
    pushFateKnotsState(api, state, contentRegistry);
    return { success: false, message: commandMessage(locale, "wrongPhase") };
  }

  const combatPayload = readFateKnotsCombatPayload(payload);
  const stale = validateSessionId(state.sessionId, combatPayload.sessionId, locale);
  if (stale) {
    pushFateKnotsState(api, state, contentRegistry);
    return stale;
  }

  const currentTurnId = buildFateKnotsCombatTurnId(state.combat);
  if (combatPayload.turnId && currentTurnId && combatPayload.turnId !== currentTurnId) {
    pushFateKnotsState(api, state, contentRegistry);
    return { success: false, message: commandMessage(locale, "stalePayload") };
  }
  const seatId = resolveFateKnotsSeatId(payload);
  const currentTurn = getCurrentFateKnotsCombatTurn(state.combat);
  if (!seatId || !currentTurn || currentTurn.seatId !== seatId) {
    pushFateKnotsState(api, state, contentRegistry);
    return { success: false, message: commandMessage(locale, "providerMismatch") };
  }
  const result = applyFateKnotsCombatAction(state.combat, seatId, combatPayload.actionId, contentRegistry.cardsById);
  if (!result.success) {
    pushFateKnotsState(api, state, contentRegistry);
    return { success: false, message: commandMessage(locale, "invalidAction") };
  }

  settleAutomaticFateKnotsCombatTurns(state.combat, contentRegistry.enemyActionsById);
  if (state.combat.outcome === "victory") {
    finalizeRun(
      state,
      "victory",
      "Village Secured",
      "The first Fate Knots combat hook resolves in the party's favor."
    );
  } else if (state.combat.outcome === "defeat") {
    finalizeRun(
      state,
      "defeat",
      "The Knot Tightens",
      "The party fell before it could stabilize the well square."
    );
  } else {
    const turn = getCurrentFateKnotsCombatTurn(state.combat);
    state.statusKey = turn?.seatId === "user" ? "combatTurnUser" : "combatTurnAi";
    setCombatWaiting(state, Date.now());
    await advancePendingWork(api, state, contentRegistry, Date.now());
  }

  pushFateKnotsState(api, state, contentRegistry);
  return { success: true, message: commandMessage(locale, "combatActionAccepted") };
}

async function handleSync(api, payload) {
  const contentRegistry = ensureFateKnotsContent(api);
  const state = loadFateKnotsState(api);
  const locale = readLocale(api);
  const activeSession = ensureActiveSession(state, locale);
  if (activeSession) {
    pushFateKnotsState(api, state, contentRegistry);
    return activeSession;
  }

  const syncPayload = readFateKnotsSyncPayload(payload);
  const stale = validateSessionId(state.sessionId, syncPayload.sessionId, locale);
  if (stale) {
    pushFateKnotsState(api, state, contentRegistry);
    return stale;
  }

  const now = Date.now();
  maybeMarkSeatLossOrTimeout(state, loadContext(api), now);
  if (state.phase === FATE_KNOTS_PHASES.scenario && state.decision?.conflict === true) {
    recoverDecisionConflict(state, now);
  } else if (state.phase === FATE_KNOTS_PHASES.scenario) {
    setDecisionWaiting(state, now);
    state.statusKey = "waitingDecision";
  } else if (state.phase === FATE_KNOTS_PHASES.combat) {
    const turn = getCurrentFateKnotsCombatTurn(state.combat);
    state.statusKey = turn?.seatId === "user" ? "combatTurnUser" : "combatTurnAi";
    setCombatWaiting(state, now);
  }

  await advancePendingWork(api, state, contentRegistry, now);
  pushFateKnotsState(api, state, contentRegistry);
  return { success: true, message: commandMessage(locale, "syncQueued") };
}

function handleEnd(api) {
  const contentRegistry = ensureFateKnotsContent(api);
  pushFateKnotsState(api, resetFateKnotsState(api, "idle"), contentRegistry);
  return { success: true, message: commandMessage(readLocale(api), "ended") };
}

export async function dispatchPendingWork(api) {
  const contentRegistry = ensureFateKnotsContent(api);
  const state = loadFateKnotsState(api);
  await advancePendingWork(api, state, contentRegistry, Date.now());
  pushFateKnotsState(api, state, contentRegistry);
}

export function syncFromContext(api, options) {
  const contentRegistry = ensureFateKnotsContent(api);
  const state = loadFateKnotsState(api);
  const context = options?.context || loadContext(api);
  const previousActiveFeatureId = options?.previousActiveFeatureId || null;
  const activeFeatureId = options?.activeFeatureId || getActiveFeatureId(context);

  if (previousActiveFeatureId === FATE_KNOTS_FEATURE_ID && activeFeatureId !== FATE_KNOTS_FEATURE_ID) {
    resetFateKnotsState(api, "activeFeatureReset");
    return;
  }

  state.locale = readLocale(api);
  maybeMarkSeatLossOrTimeout(state, context, Date.now());
  updateContentSummary(state, contentRegistry);
  api.setState("xox-context", context);
  api.setState(FATE_KNOTS_CONTENT_STATE_KEY, contentRegistry);
  api.setState("fate-knots-game", state);
}

export {
  handleCharacterSelect,
  handleChoice,
  handleCombatAction,
  handleEnd,
  handleReady,
  handleReset,
  handleSync,
  handleStart,
};
