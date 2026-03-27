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
  FATE_KNOTS_COMMAND_NAMES,
  FATE_KNOTS_COMMAND_COPY,
  FATE_KNOTS_CONTENT_STATE_KEY,
  FATE_KNOTS_MAX_PACKET_TEXT_LENGTH,
  FATE_KNOTS_PHASES,
  FATE_KNOTS_SUPPORTED_AI_SEATS,
  FATE_KNOTS_SUPPORTED_REMOTE_SEATS,
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
  readFateKnotsDmPacketPayload,
  readFateKnotsNpcBanterPayload,
  readFateKnotsSelectionPayload,
  readFateKnotsSyncPayload,
  resolveFateKnotsSeatId,
} from "./payloads.js";
import {
  appendFateKnotsHistory,
  loadFateKnotsProfile,
  loadFateKnotsSaveSlot,
  loadFateKnotsState,
  pushFateKnotsState,
  refreshFateKnotsState,
  resetFateKnotsState,
  saveFateKnotsProfile,
  saveFateKnotsSaveSlot,
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

function isKnownSelectionId(contentRegistry, fieldName, value) {
  if (!value) {
    return false;
  }
  if (fieldName === "avatarId") {
    return contentRegistry.avatarsById.has(value) === true;
  }
  if (fieldName === "classId") {
    return contentRegistry.classesById.has(value) === true;
  }
  if (fieldName === "backgroundId") {
    return contentRegistry.backgroundsById.has(value) === true;
  }
  return false;
}

function sanitizeStoredProfile(contentRegistry, profile) {
  if (!profile || typeof profile !== "object") {
    return createHeroSelection();
  }
  const next = createHeroSelection();
  next.avatarId = isKnownSelectionId(contentRegistry, "avatarId", profile.avatarId) ? profile.avatarId : null;
  next.classId = isKnownSelectionId(contentRegistry, "classId", profile.classId) ? profile.classId : null;
  next.backgroundId = isKnownSelectionId(contentRegistry, "backgroundId", profile.backgroundId)
    ? profile.backgroundId
    : null;
  next.updatedAt = typeof profile.updatedAt === "number" ? profile.updatedAt : null;
  return next;
}

function buildAutoAssignedSelection(contentRegistry, sessionId, offsetSeed) {
  const avatar = pickDeterministicEntry(contentRegistry.selections.avatars, sessionId, offsetSeed);
  const classDef = pickDeterministicEntry(contentRegistry.selections.classes, sessionId, offsetSeed + 11);
  const background = pickDeterministicEntry(contentRegistry.selections.backgrounds, sessionId, offsetSeed + 23);
  return {
    avatarId: avatar?.id || null,
    classId: classDef?.id || null,
    backgroundId: background?.id || null,
    locked: true,
    autoAssigned: true,
    updatedAt: Date.now(),
  };
}

function resetPromptDispatchState(state) {
  state.dispatch = {
    decisionPromptKeys: {},
    combatPromptKeys: {},
    dmPromptKey: null,
    npcPromptKey: null,
  };
}

function clearDecisionPromptKey(state, seatId) {
  if (state.dispatch && state.dispatch.decisionPromptKeys && seatId) {
    delete state.dispatch.decisionPromptKeys[seatId];
  }
}

function clearCombatPromptKey(state, seatId) {
  if (state.dispatch && state.dispatch.combatPromptKeys && seatId) {
    delete state.dispatch.combatPromptKeys[seatId];
  }
}

function clearAmbientPromptKeys(state) {
  if (!state.dispatch) {
    resetPromptDispatchState(state);
    return;
  }
  state.dispatch.dmPromptKey = null;
  state.dispatch.npcPromptKey = null;
}

function updateTransportFromSendResult(state, sendResult, fallbackRemoteUserId) {
  if (!state.transport || typeof state.transport !== "object") {
    state.transport = {
      localSessionId: null,
      remoteUserId: null,
    };
  }
  if (sendResult && typeof sendResult.localSessionId === "string" && sendResult.localSessionId !== "") {
    state.transport.localSessionId = sendResult.localSessionId;
  }
  if (sendResult && typeof sendResult.remoteUserId === "string" && sendResult.remoteUserId !== "") {
    state.transport.remoteUserId = sendResult.remoteUserId;
    return;
  }
  if (fallbackRemoteUserId) {
    state.transport.remoteUserId = fallbackRemoteUserId;
  }
}

function getUs1RemoteUserId(api, state, context) {
  const identity =
    typeof api.getUs1Identity === "function" && api.getUs1Identity()
      ? api.getUs1Identity()
      : null;
  return (
    context?.slots?.us1?.remoteUserId ||
    state.transport?.remoteUserId ||
    identity?.remoteUserId ||
    null
  );
}

function buildRunParticipants(context, contentRegistry, sessionId, profile, remoteUserId) {
  const profileSelection = sanitizeStoredProfile(contentRegistry, profile);
  const userParticipant = createParticipant({
    seatId: "user",
    provider: "room-ui",
    type: "local-user",
    nickname: context?.user?.nickname || "User",
    ready: true,
    connected: true,
    selection: profileSelection,
  });

  const aiParticipants = FATE_KNOTS_SUPPORTED_AI_SEATS.filter(function (seatId) {
    return context?.slots?.[seatId]?.ready === true;
  }).map(function (seatId, index) {
    const slot = context.slots[seatId];
    return createParticipant({
      seatId,
      provider: seatId,
      type: "ai",
      nickname: slot.nickname,
      ready: slot.ready === true,
      connected: slot.connected !== false,
      selection: buildAutoAssignedSelection(contentRegistry, sessionId, index),
    });
  });

  const remoteParticipants = FATE_KNOTS_SUPPORTED_REMOTE_SEATS.filter(function (seatId) {
    return context?.slots?.[seatId]?.ready === true;
  }).map(function (seatId, index) {
    const slot = context.slots[seatId];
    return createParticipant({
      seatId,
      provider: seatId,
      type: "remote-user",
      nickname: slot.nickname || "Remote",
      ready: slot.ready === true,
      connected: slot.connected !== false,
      selection: buildAutoAssignedSelection(contentRegistry, sessionId, index + 37),
    });
  });

  return {
    participants: [userParticipant, ...aiParticipants, ...remoteParticipants],
    excludedSeats: [],
    transport: {
      localSessionId: null,
      remoteUserId: remoteUserId || null,
    },
  };
}

function sanitizePacketText(text) {
  if (typeof text !== "string") {
    return "";
  }
  return text.replace(/\s+/g, " ").trim().slice(0, FATE_KNOTS_MAX_PACKET_TEXT_LENGTH);
}

function buildDecisionPrompt(state, step, context, commandName) {
  const choiceLines = step.choices
    .map(function (choice) {
      return `- ${choice.id}: ${choice.label} | ${choice.summary}`;
    })
    .join("\n");

  return [
    "Fate Knots common-decision update from the Game Room.",
    "Reply with exactly one command line.",
    `Use ++cmd:${commandName}({"sessionId":"${state.sessionId}","stepId":"${step.id}","choiceId":"<choice-id>"})`,
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

function buildCombatPrompt(state, contentRegistry, commandName) {
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
    `Use ++cmd:${commandName}({"sessionId":"${state.sessionId}","encounterId":"${state.combat.encounterId}","turnId":"${turnId}","actionId":"<card-id>"})`,
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

function buildDmPrompt(state) {
  const summary = {
    phase: state.phase,
    statusKey: state.statusKey,
    currentStepId: state.currentStepId,
    encounterId: state.combat?.encounterId || null,
    waiting: state.waiting,
    recentStory: state.scenarioLog.slice(-3),
    recentCombat: state.combat?.log?.slice(-3) || [],
  };
  return [
    "Fate Knots additive narration request.",
    "Reply with exactly one command line.",
    `Use ++cmd:${FATE_KNOTS_COMMAND_NAMES.dmPacket}({"sessionId":"${state.sessionId}","phase":"${state.phase}","stepId":"${state.currentStepId || ""}","encounterId":"${state.combat?.encounterId || ""}","turnId":"${buildFateKnotsCombatTurnId(state.combat) || ""}","text":"<one short narration sentence>"})`,
    "Keep the response player-visible only. Do not change rules, reveal secrets, or add a second command.",
    "",
    JSON.stringify(summary, null, 2),
  ].join("\n");
}

function buildNpcPrompt(state, seatId) {
  const summary = {
    phase: state.phase,
    seatId,
    seatNickname: getParticipant(state, seatId)?.nickname || seatId,
    currentStepId: state.currentStepId,
    encounterId: state.combat?.encounterId || null,
    waiting: state.waiting,
    recentStory: state.scenarioLog.slice(-2),
    recentCombat: state.combat?.log?.slice(-2) || [],
  };
  return [
    "Fate Knots short companion banter request.",
    "Reply with exactly one command line.",
    `Use ++cmd:${FATE_KNOTS_COMMAND_NAMES.npcBanter}({"sessionId":"${state.sessionId}","phase":"${state.phase}","seatId":"${seatId}","stepId":"${state.currentStepId || ""}","encounterId":"${state.combat?.encounterId || ""}","turnId":"${buildFateKnotsCombatTurnId(state.combat) || ""}","text":"<one short in-world line>"})`,
    "Keep it short, supportive, and player-visible. Do not add a second command.",
    "",
    JSON.stringify(summary, null, 2),
  ].join("\n");
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
  if (pendingSeatIds.length === 1 && pendingSeatIds[0] === "us1") {
    state.statusKey = "remotePending";
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
    state.statusKey = turn.seatId === "us1" ? "combatTurnRemote" : "combatTurnAi";
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
    const promptKey = `${state.sessionId}:decision:${state.currentStepId}:${seatId}`;
    if (state.dispatch?.decisionPromptKeys?.[seatId] === promptKey) {
      continue;
    }
    if (seatId === "us1") {
      const remoteUserId = getUs1RemoteUserId(api, state, context);
      if (remoteUserId && typeof api.selectUs1RemoteUser === "function") {
        const selected = await api.selectUs1RemoteUser(remoteUserId);
        if (selected !== true) {
          return { success: false, seatId };
        }
      }
      const sendResult = await api.sendUs1Message({
        localSessionId: state.transport?.localSessionId || null,
        text: buildDecisionPrompt(state, step, context, FATE_KNOTS_COMMAND_NAMES.remoteChoice),
        roomEvent: {
          roomId: ROOM_ID,
          featureId: FATE_KNOTS_FEATURE_ID,
          eventType: "prompt",
          promptKind: "decision",
          sessionId: state.sessionId,
          stepId: state.currentStepId,
          seatId,
        },
      });
      if (!sendResult || sendResult.success !== true) {
        return { success: false, seatId };
      }
      updateTransportFromSendResult(state, sendResult, remoteUserId);
      state.dispatch.decisionPromptKeys[seatId] = promptKey;
      continue;
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
      text: buildDecisionPrompt(state, step, context, FATE_KNOTS_COMMAND_NAMES.aiChoice),
    });
    if (!messageResult || messageResult.success !== true) {
      return { success: false, seatId };
    }
    state.dispatch.decisionPromptKeys[seatId] = promptKey;
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
  const promptKey = `${state.sessionId}:combat:${buildFateKnotsCombatTurnId(state.combat)}:${turn.seatId}`;
  if (state.dispatch?.combatPromptKeys?.[turn.seatId] === promptKey) {
    return { success: true };
  }
  if (turn.seatId === "us1") {
    const context = loadContext(api);
    const remoteUserId = getUs1RemoteUserId(api, state, context);
    if (remoteUserId && typeof api.selectUs1RemoteUser === "function") {
      const selected = await api.selectUs1RemoteUser(remoteUserId);
      if (selected !== true) {
        return { success: false, seatId: turn.seatId };
      }
    }
    const sendResult = await api.sendUs1Message({
      localSessionId: state.transport?.localSessionId || null,
      text: buildCombatPrompt(state, contentRegistry, FATE_KNOTS_COMMAND_NAMES.remoteCombatAction),
      roomEvent: {
        roomId: ROOM_ID,
        featureId: FATE_KNOTS_FEATURE_ID,
        eventType: "prompt",
        promptKind: "combat",
        sessionId: state.sessionId,
        encounterId: state.combat.encounterId,
        turnId: buildFateKnotsCombatTurnId(state.combat),
        seatId: turn.seatId,
      },
    });
    if (!sendResult || sendResult.success !== true) {
      return { success: false, seatId: turn.seatId };
    }
    updateTransportFromSendResult(state, sendResult, remoteUserId);
    state.dispatch.combatPromptKeys[turn.seatId] = promptKey;
    return { success: true };
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
    text: buildCombatPrompt(state, contentRegistry, FATE_KNOTS_COMMAND_NAMES.aiCombatAction),
  });
  if (!messageResult || messageResult.success !== true) {
    return { success: false, seatId: turn.seatId };
  }
  state.dispatch.combatPromptKeys[turn.seatId] = promptKey;
  return { success: true };
}

async function dispatchAmbientPrompts(api, state) {
  const context = loadContext(api);
  const readyAiSeats = FATE_KNOTS_SUPPORTED_AI_SEATS.filter(function (seatId) {
    return context?.slots?.[seatId]?.ready === true;
  });
  if (readyAiSeats.length === 0) {
    return;
  }

  let ambientKey = null;
  if (state.phase === FATE_KNOTS_PHASES.scenario && state.decision) {
    const blockingAi = listPendingDecisionSeats(state).filter(function (seatId) {
      return seatId !== "user";
    });
    if (blockingAi.length > 0) {
      return;
    }
    ambientKey = `scenario:${state.currentStepId}:${state.decision.updatedAt || 0}`;
  } else if (state.phase === FATE_KNOTS_PHASES.combat && state.combat) {
    const turn = getCurrentFateKnotsCombatTurn(state.combat);
    if (turn && turn.side === "party" && turn.seatId !== "user") {
      return;
    }
    ambientKey = `combat:${state.combat.encounterId}:${buildFateKnotsCombatTurnId(state.combat) || "idle"}`;
  } else if (state.phase === FATE_KNOTS_PHASES.result) {
    ambientKey = `result:${state.sessionId}:${state.result.outcome}`;
  }

  if (!ambientKey) {
    return;
  }

  const dmSeatId = readyAiSeats[0];
  if (dmSeatId && state.dispatch?.dmPromptKey !== `${ambientKey}:dm:${dmSeatId}`) {
    const protocolResult = await api.sendProtocol({
      room: ROOM_ID,
      scenario: "fate-knots-ai-dm",
      targets: [dmSeatId],
      context: {
        featureId: FATE_KNOTS_FEATURE_ID,
        sessionId: state.sessionId,
        phase: state.phase,
      },
    });
    if (protocolResult && protocolResult.success === true) {
      const messageResult = await api.sendMessage({
        provider: dmSeatId,
        page: FATE_KNOTS_PAGE_ID,
        text: buildDmPrompt(state),
      });
      if (messageResult && messageResult.success === true) {
        state.dispatch.dmPromptKey = `${ambientKey}:dm:${dmSeatId}`;
      }
    }
  }

  const npcSeatId = readyAiSeats[1];
  if (npcSeatId && state.dispatch?.npcPromptKey !== `${ambientKey}:npc:${npcSeatId}`) {
    const protocolResult = await api.sendProtocol({
      room: ROOM_ID,
      scenario: "fate-knots-ai-npc",
      targets: [npcSeatId],
      context: {
        featureId: FATE_KNOTS_FEATURE_ID,
        sessionId: state.sessionId,
        phase: state.phase,
      },
    });
    if (protocolResult && protocolResult.success === true) {
      const messageResult = await api.sendMessage({
        provider: npcSeatId,
        page: FATE_KNOTS_PAGE_ID,
        text: buildNpcPrompt(state, npcSeatId),
      });
      if (messageResult && messageResult.success === true) {
        state.dispatch.npcPromptKey = `${ambientKey}:npc:${npcSeatId}`;
      }
    }
  }
}

function persistProfileFromUser(api, state) {
  const userParticipant = getUserParticipant(state);
  if (!userParticipant || isSelectionComplete(userParticipant.selection) !== true) {
    return loadFateKnotsProfile(api);
  }
  return saveFateKnotsProfile(api, {
    avatarId: userParticipant.selection.avatarId,
    classId: userParticipant.selection.classId,
    backgroundId: userParticipant.selection.backgroundId,
    updatedAt: Date.now(),
  });
}

function persistRunSummary(api, state, outcome, title, summary) {
  appendFateKnotsHistory(api, {
    sessionId: state.sessionId,
    outcome,
    title,
    summary,
    locationId: state.currentLocationId,
    timestamp: Date.now(),
    roster: state.participants.map(function (participant) {
      return {
        seatId: participant.seatId,
        nickname: participant.nickname,
        type: participant.type,
      };
    }),
  });
  saveFateKnotsSaveSlot(api, {
    hasResumeData: false,
    lastCompletedSessionId: state.sessionId,
    lastOutcome: outcome,
    updatedAt: Date.now(),
  });
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
    state.dmNarration = null;
    state.npcBanter = null;
    clearAmbientPromptKeys(state);
    setIdleWaiting(state);
    return;
  }
  state.phase = FATE_KNOTS_PHASES.scenario;
  state.currentStepId = step.id;
  state.currentLocationId = step.locationId || state.currentLocationId;
  state.dmNarration = null;
  state.npcBanter = null;
  resetPromptDispatchState(state);
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

function finalizeRun(api, state, outcome, title, summary) {
  state.phase = FATE_KNOTS_PHASES.result;
  state.result = {
    outcome,
    title,
    summary,
    continueHint: "Reset to replay the slice.",
  };
  state.dmNarration = null;
  state.npcBanter = null;
  clearDecisionPromptKey(state, "ai1");
  clearDecisionPromptKey(state, "ai2");
  clearDecisionPromptKey(state, "us1");
  clearCombatPromptKey(state, "ai1");
  clearCombatPromptKey(state, "ai2");
  clearCombatPromptKey(state, "us1");
  clearAmbientPromptKeys(state);
  state.statusKey = outcome === "victory" ? "resultVictory" : "resultDefeat";
  setIdleWaiting(state);
  persistRunSummary(api, state, outcome, title, summary);
}

function resolveDecisionProgress(api, state, contentRegistry, now) {
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
    state.dmNarration = null;
    state.npcBanter = null;
    resetPromptDispatchState(state);
    state.phase = FATE_KNOTS_PHASES.combat;
    state.statusKey = "combatTurnUser";
    setCombatWaiting(state, now);
    settleAutomaticFateKnotsCombatTurns(state.combat, contentRegistry.enemyActionsById);
    if (state.combat.outcome === "victory") {
      finalizeRun(
        api,
        state,
        "victory",
        "Village Secured",
        "The party held the line and the first Fate Knots slice ends in victory."
      );
      return;
    }
    if (state.combat.outcome === "defeat") {
      finalizeRun(
        api,
        state,
        "defeat",
        "The Knot Tightens",
        "The party fell before it could stabilize the square."
      );
      return;
    }
    const turn = getCurrentFateKnotsCombatTurn(state.combat);
    state.statusKey =
      turn?.seatId === "user"
        ? "combatTurnUser"
        : turn?.seatId === "us1"
          ? "combatTurnRemote"
          : "combatTurnAi";
    setCombatWaiting(state, now);
    return;
  }

  finalizeRun(
    api,
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
    await dispatchAmbientPrompts(api, state);
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
    await dispatchAmbientPrompts(api, state);
  }

  if (state.phase === FATE_KNOTS_PHASES.result) {
    await dispatchAmbientPrompts(api, state);
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
  state.dmNarration = null;
  state.npcBanter = null;
  clearAmbientPromptKeys(state);
  clearDecisionPromptKey(state, "ai1");
  clearDecisionPromptKey(state, "ai2");
  clearDecisionPromptKey(state, "us1");
  setDecisionWaiting(state, now);
  state.statusKey = "waitingDecision";
}

async function handleStart(api) {
  const contentRegistry = ensureFateKnotsContent(api);
  const context = loadContext(api);
  const profile = loadFateKnotsProfile(api);
  const saveSlot = loadFateKnotsSaveSlot(api);
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
  const runConfig = buildRunParticipants(
    context,
    contentRegistry,
    sessionId,
    profile,
    getUs1RemoteUserId(api, state, context)
  );

  state.active = true;
  state.phase = FATE_KNOTS_PHASES.characterCreation;
  state.statusKey = "characterCreation";
  state.sessionId = sessionId;
  state.rosterLocked = true;
  state.participants = runConfig.participants;
  state.excludedSeats = runConfig.excludedSeats;
  state.transport = runConfig.transport;
  saveFateKnotsSaveSlot(api, {
    ...saveSlot,
    hasResumeData: false,
    updatedAt: now,
  });
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
  persistProfileFromUser(api, state);
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
  persistProfileFromUser(api, state);
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
  clearDecisionPromptKey(state, seatId);
  resolveDecisionProgress(api, state, contentRegistry, Date.now());
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

  clearCombatPromptKey(state, seatId);
  settleAutomaticFateKnotsCombatTurns(state.combat, contentRegistry.enemyActionsById);
  if (state.combat.outcome === "victory") {
    finalizeRun(
      api,
      state,
      "victory",
      "Village Secured",
      "The first Fate Knots combat hook resolves in the party's favor."
    );
  } else if (state.combat.outcome === "defeat") {
    finalizeRun(
      api,
      state,
      "defeat",
      "The Knot Tightens",
      "The party fell before it could stabilize the well square."
    );
  } else {
    const turn = getCurrentFateKnotsCombatTurn(state.combat);
    state.statusKey =
      turn?.seatId === "user"
        ? "combatTurnUser"
        : turn?.seatId === "us1"
          ? "combatTurnRemote"
          : "combatTurnAi";
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
    if (Array.isArray(state.waiting?.pendingSeatIds)) {
      state.waiting.pendingSeatIds.forEach(function (seatId) {
        clearDecisionPromptKey(state, seatId);
      });
    }
    clearAmbientPromptKeys(state);
    setDecisionWaiting(state, now);
    state.statusKey = "waitingDecision";
  } else if (state.phase === FATE_KNOTS_PHASES.combat) {
    const turn = getCurrentFateKnotsCombatTurn(state.combat);
    if (turn?.seatId) {
      clearCombatPromptKey(state, turn.seatId);
    }
    clearAmbientPromptKeys(state);
    state.statusKey =
      turn?.seatId === "user"
        ? "combatTurnUser"
        : turn?.seatId === "us1"
          ? "combatTurnRemote"
          : "combatTurnAi";
    setCombatWaiting(state, now);
  } else if (state.phase === FATE_KNOTS_PHASES.result) {
    clearAmbientPromptKeys(state);
  }

  await advancePendingWork(api, state, contentRegistry, now);
  pushFateKnotsState(api, state, contentRegistry);
  return { success: true, message: commandMessage(locale, "syncQueued") };
}

function handleDmPacket(api, payload) {
  const contentRegistry = ensureFateKnotsContent(api);
  const state = loadFateKnotsState(api);
  const locale = readLocale(api);
  const activeSession = ensureActiveSession(state, locale);
  if (activeSession) {
    pushFateKnotsState(api, state, contentRegistry);
    return activeSession;
  }

  const packet = readFateKnotsDmPacketPayload(payload);
  const stale = validateSessionId(state.sessionId, packet.sessionId, locale);
  if (stale) {
    pushFateKnotsState(api, state, contentRegistry);
    return stale;
  }
  const seatId = resolveFateKnotsSeatId(payload);
  if (!FATE_KNOTS_SUPPORTED_AI_SEATS.includes(seatId || "")) {
    pushFateKnotsState(api, state, contentRegistry);
    return { success: false, message: commandMessage(locale, "providerMismatch") };
  }
  const text = sanitizePacketText(packet.text);
  if (!text) {
    pushFateKnotsState(api, state, contentRegistry);
    return { success: false, message: commandMessage(locale, "invalidPacket") };
  }

  state.dmNarration = {
    kind: "dm",
    seatId,
    phase: packet.phase || state.phase,
    text,
    stepId: packet.stepId || state.currentStepId || null,
    encounterId: packet.encounterId || state.combat?.encounterId || null,
    turnId: packet.turnId || buildFateKnotsCombatTurnId(state.combat) || null,
    updatedAt: Date.now(),
  };
  pushFateKnotsState(api, state, contentRegistry);
  return { success: true, message: commandMessage(locale, "dmPacketAccepted") };
}

function handleNpcBanter(api, payload) {
  const contentRegistry = ensureFateKnotsContent(api);
  const state = loadFateKnotsState(api);
  const locale = readLocale(api);
  const activeSession = ensureActiveSession(state, locale);
  if (activeSession) {
    pushFateKnotsState(api, state, contentRegistry);
    return activeSession;
  }

  const packet = readFateKnotsNpcBanterPayload(payload);
  const stale = validateSessionId(state.sessionId, packet.sessionId, locale);
  if (stale) {
    pushFateKnotsState(api, state, contentRegistry);
    return stale;
  }
  const providerSeatId = resolveFateKnotsSeatId(payload);
  if (!FATE_KNOTS_SUPPORTED_AI_SEATS.includes(providerSeatId || "")) {
    pushFateKnotsState(api, state, contentRegistry);
    return { success: false, message: commandMessage(locale, "providerMismatch") };
  }
  const speakerSeatId = packet.seatId || providerSeatId;
  const text = sanitizePacketText(packet.text);
  if (!text) {
    pushFateKnotsState(api, state, contentRegistry);
    return { success: false, message: commandMessage(locale, "invalidPacket") };
  }

  state.npcBanter = {
    kind: "npc",
    seatId: speakerSeatId,
    phase: packet.phase || state.phase,
    text,
    stepId: packet.stepId || state.currentStepId || null,
    encounterId: packet.encounterId || state.combat?.encounterId || null,
    turnId: packet.turnId || buildFateKnotsCombatTurnId(state.combat) || null,
    updatedAt: Date.now(),
  };
  pushFateKnotsState(api, state, contentRegistry);
  return { success: true, message: commandMessage(locale, "npcBanterAccepted") };
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
  if (state.transport && context?.slots?.us1?.remoteUserId) {
    state.transport.remoteUserId = context.slots.us1.remoteUserId;
  }
  updateContentSummary(state, contentRegistry);
  api.setState("xox-context", context);
  api.setState(FATE_KNOTS_CONTENT_STATE_KEY, contentRegistry);
  api.setState("fate-knots-game", state);
}

export {
  handleCharacterSelect,
  handleChoice,
  handleCombatAction,
  handleDmPacket,
  handleEnd,
  handleNpcBanter,
  handleReady,
  handleReset,
  handleSync,
  handleStart,
};
