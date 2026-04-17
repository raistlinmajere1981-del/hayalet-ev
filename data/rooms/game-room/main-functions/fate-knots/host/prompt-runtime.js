import { loadContext } from "../../../shared/host/context-state.js";
import { buildRoomBridgeCommand } from "../../../shared/host/slot-bridge-command.js";
import {
  FATE_KNOTS_FEATURE_ID,
  FATE_KNOTS_PAGE_ID,
  ROOM_ID
} from "../../../shared/host/feature-meta.js";
import {
  FATE_KNOTS_COMMAND_NAMES,
  FATE_KNOTS_PHASES,
  FATE_KNOTS_SUPPORTED_AI_SEATS
} from "./constants.js";
import {
  buildFateKnotsCombatTurnId,
  cloneFateKnotsCombatState,
  getCurrentFateKnotsCombatTurn
} from "./combat-engine.js";
function readCombatState(state) {
  return state.combat ? cloneFateKnotsCombatState(state.combat) : null;
}
function buildRoomEvent(event) {
  return event;
}
export function createFateKnotsPromptRuntime(deps) {
  const getParticipant = deps.getParticipant;
  const listPendingDecisionSeats = deps.listPendingDecisionSeats;
  const getUs1RemoteUserId = deps.getUs1RemoteUserId;
  const updateTransportFromSendResult = deps.updateTransportFromSendResult;
  function buildDecisionPrompt(state, step, context, commandName) {
    const choiceLines = step.choices.map(function(choice) {
      return `- ${choice.id}: ${choice.label} | ${choice.summary}`;
    }).join("\n");
    return [
      "Fate Knots common-decision update from the Game Room.",
      "Reply with exactly one command line.",
      `Use ${buildRoomBridgeCommand(commandName, {
        sessionId: state.sessionId,
        stepId: step.id,
        choiceId: "<choice-id>"
      })}`,
      "Do not add prose, markdown, or a second command.",
      "",
      `Party lead: ${context.user.nickname || "User"}`,
      `Step: ${step.title}`,
      step.body,
      "",
      "Choices:",
      choiceLines
    ].join("\n");
  }
  function buildCombatPrompt(state, contentRegistry, commandName) {
    const combat = readCombatState(state);
    const turn = combat ? getCurrentFateKnotsCombatTurn(combat) : null;
    const turnId = combat ? buildFateKnotsCombatTurnId(combat) : "";
    const actorParticipant = turn ? getParticipant(state, turn.seatId) : null;
    const actorNickname = actorParticipant?.nickname || turn?.seatId || "Seat";
    const actorCombatant = combat && turn ? combat.party.find(function(member) {
      return member.seatId === turn.seatId;
    }) || null : null;
    const actions = actorCombatant ? actorCombatant.deck : [];
    const actionPacket = actions.map(function(actionId) {
      return contentRegistry.cardsById.get(actionId) || null;
    }).filter(function(card) {
      return card !== null;
    }).map(function(card) {
      return {
        id: card.id,
        label: card.label,
        cost: card.cost,
        type: card.type,
        power: card.power,
        guard: card.guard,
        heal: card.heal,
        focus: card.focus,
        counter: card.counter,
        evasion: card.evasion,
        poison: card.poison,
        stun: card.stun,
        selfDamage: card.selfDamage
      };
    });
    return [
      "Fate Knots combat update from the Game Room.",
      "Reply with exactly one command line.",
      `Use ${buildRoomBridgeCommand(commandName, {
        sessionId: state.sessionId,
        encounterId: combat?.encounterId || "",
        turnId,
        actionId: "<card-id>"
      })}`,
      "Do not add prose, markdown, or a second command.",
      "",
      JSON.stringify(
        {
          sessionId: state.sessionId,
          encounterId: combat?.encounterId || "",
          turnId,
          actor: {
            seatId: turn?.seatId || "",
            nickname: actorNickname,
            hp: actorCombatant?.hp || 0,
            energy: actorCombatant?.energy || 0
          },
          enemy: combat ? {
            label: combat.enemy.label,
            hp: combat.enemy.hp,
            maxHp: combat.enemy.maxHp
          } : null,
          actions: actionPacket,
          recentLog: combat ? combat.log.slice(-5) : []
        },
        null,
        2
      )
    ].join("\n");
  }
  function buildDmPrompt(state) {
    const combat = readCombatState(state);
    const summary = {
      phase: state.phase,
      statusKey: state.statusKey,
      currentStepId: state.currentStepId,
      encounterId: combat?.encounterId || null,
      waiting: state.waiting,
      recentStory: state.scenarioLog.slice(-3),
      recentCombat: combat ? combat.log.slice(-3) : []
    };
    return [
      "Fate Knots additive narration request.",
      "Reply with exactly one command line.",
      `Use ${buildRoomBridgeCommand(FATE_KNOTS_COMMAND_NAMES.dmPacket, {
        sessionId: state.sessionId,
        phase: state.phase,
        stepId: state.currentStepId || "",
        encounterId: combat?.encounterId || "",
        turnId: combat ? buildFateKnotsCombatTurnId(combat) : "",
        text: "<one short narration sentence>"
      })}`,
      "Keep the response player-visible only. Do not change rules, reveal secrets, or add a second command.",
      "",
      JSON.stringify(summary, null, 2)
    ].join("\n");
  }
  function buildNpcPrompt(state, seatId) {
    const combat = readCombatState(state);
    const participant = getParticipant(state, seatId);
    const summary = {
      phase: state.phase,
      seatId,
      seatNickname: participant?.nickname || seatId,
      currentStepId: state.currentStepId,
      encounterId: combat?.encounterId || null,
      waiting: state.waiting,
      recentStory: state.scenarioLog.slice(-2),
      recentCombat: combat ? combat.log.slice(-2) : []
    };
    return [
      "Fate Knots short companion banter request.",
      "Reply with exactly one command line.",
      `Use ${buildRoomBridgeCommand(FATE_KNOTS_COMMAND_NAMES.npcBanter, {
        sessionId: state.sessionId,
        phase: state.phase,
        seatId,
        stepId: state.currentStepId || "",
        encounterId: combat?.encounterId || "",
        turnId: combat ? buildFateKnotsCombatTurnId(combat) : "",
        text: "<one short in-world line>"
      })}`,
      "Keep it short, supportive, and player-visible. Do not add a second command.",
      "",
      JSON.stringify(summary, null, 2)
    ].join("\n");
  }
  async function sendBridgeMessageSafe(api, options) {
    if (typeof api.dispatchBridge !== "function") {
      return null;
    }
    return await api.dispatchBridge({
      action: "message.send",
      toSlot: options.provider,
      payload: {
        text: options.text,
        page: options.page,
        ...options.protocol !== void 0 ? {
          protocol: {
            room: options.protocol.room,
            scenario: options.protocol.scenario,
            context: options.protocol.context
          }
        } : {}
      }
    });
  }
  async function sendUs1MessageSafe(api, options) {
    if (typeof api.sendUs1Message !== "function") {
      return null;
    }
    return await api.sendUs1Message(options);
  }
  async function dispatchDecisionPrompts(api, state, contentRegistry) {
    if (!state.decision || !state.currentStepId) {
      return { success: true };
    }
    const context = loadContext(api);
    const step = contentRegistry.scenarioStepsById.get(state.currentStepId) || null;
    if (!step) {
      return { success: false };
    }
    const pendingSeats = listPendingDecisionSeats(state).filter(function(seatId) {
      return seatId !== "user";
    });
    for (const seatId of pendingSeats) {
      const participant = getParticipant(state, seatId);
      if (!participant || participant.ready !== true) {
        return { success: false, seatId };
      }
      const promptKey = `${state.sessionId}:decision:${state.currentStepId}:${seatId}`;
      if (state.dispatch.decisionPromptKeys[seatId] === promptKey) {
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
        const sendResult = await sendUs1MessageSafe(api, {
          localSessionId: state.transport.localSessionId,
          text: buildDecisionPrompt(state, step, context, FATE_KNOTS_COMMAND_NAMES.remoteChoice),
          roomEvent: buildRoomEvent({
            roomId: ROOM_ID,
            featureId: FATE_KNOTS_FEATURE_ID,
            eventType: "prompt",
            promptKind: "decision",
            sessionId: state.sessionId,
            stepId: state.currentStepId,
            seatId
          })
        });
        if (!sendResult || sendResult.success !== true) {
          return { success: false, seatId };
        }
        updateTransportFromSendResult(state, sendResult, remoteUserId);
        state.dispatch.decisionPromptKeys[seatId] = promptKey;
        continue;
      }
      const messageResult = await sendBridgeMessageSafe(api, {
        provider: seatId,
        page: FATE_KNOTS_PAGE_ID,
        text: buildDecisionPrompt(state, step, context, FATE_KNOTS_COMMAND_NAMES.aiChoice),
        protocol: {
          room: ROOM_ID,
          scenario: "fate-knots-ai-decision",
          targets: [seatId],
          context: {
            featureId: FATE_KNOTS_FEATURE_ID,
            sessionId: state.sessionId,
            stepId: state.currentStepId
          }
        }
      });
      if (!messageResult || messageResult.success !== true) {
        return { success: false, seatId };
      }
      state.dispatch.decisionPromptKeys[seatId] = promptKey;
    }
    return { success: true };
  }
  async function dispatchCombatPrompt(api, state, contentRegistry) {
    const combat = readCombatState(state);
    const turn = combat ? getCurrentFateKnotsCombatTurn(combat) : null;
    if (!combat || !turn || turn.side !== "party" || turn.seatId === "user") {
      return { success: true };
    }
    const participant = getParticipant(state, turn.seatId);
    if (!participant || participant.ready !== true) {
      return { success: false, seatId: turn.seatId };
    }
    const promptKey = `${state.sessionId}:combat:${buildFateKnotsCombatTurnId(combat)}:${turn.seatId}`;
    if (state.dispatch.combatPromptKeys[turn.seatId] === promptKey) {
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
      const sendResult = await sendUs1MessageSafe(api, {
        localSessionId: state.transport.localSessionId,
        text: buildCombatPrompt(
          state,
          contentRegistry,
          FATE_KNOTS_COMMAND_NAMES.remoteCombatAction
        ),
        roomEvent: buildRoomEvent({
          roomId: ROOM_ID,
          featureId: FATE_KNOTS_FEATURE_ID,
          eventType: "prompt",
          promptKind: "combat",
          sessionId: state.sessionId,
          encounterId: combat.encounterId,
          turnId: buildFateKnotsCombatTurnId(combat),
          seatId: turn.seatId
        })
      });
      if (!sendResult || sendResult.success !== true) {
        return { success: false, seatId: turn.seatId };
      }
      updateTransportFromSendResult(state, sendResult, remoteUserId);
      state.dispatch.combatPromptKeys[turn.seatId] = promptKey;
      return { success: true };
    }
    const messageResult = await sendBridgeMessageSafe(api, {
      provider: turn.seatId,
      page: FATE_KNOTS_PAGE_ID,
      text: buildCombatPrompt(state, contentRegistry, FATE_KNOTS_COMMAND_NAMES.aiCombatAction),
      protocol: {
        room: ROOM_ID,
        scenario: "fate-knots-ai-combat",
        targets: [turn.seatId],
        context: {
          featureId: FATE_KNOTS_FEATURE_ID,
          sessionId: state.sessionId,
          encounterId: combat.encounterId
        }
      }
    });
    if (!messageResult || messageResult.success !== true) {
      return { success: false, seatId: turn.seatId };
    }
    state.dispatch.combatPromptKeys[turn.seatId] = promptKey;
    return { success: true };
  }
  async function dispatchAmbientPrompts(api, state) {
    const context = loadContext(api);
    const readyAiSeats = FATE_KNOTS_SUPPORTED_AI_SEATS.filter(function(seatId) {
      return context.slots[seatId].ready === true;
    });
    if (readyAiSeats.length === 0) {
      return;
    }
    const combat = readCombatState(state);
    let ambientKey = null;
    if (state.phase === FATE_KNOTS_PHASES.scenario && state.decision) {
      const blockingAi = listPendingDecisionSeats(state).filter(function(seatId) {
        return seatId !== "user";
      });
      if (blockingAi.length > 0) {
        return;
      }
      ambientKey = `scenario:${state.currentStepId}:${state.decision.updatedAt || 0}`;
    } else if (state.phase === FATE_KNOTS_PHASES.combat && combat) {
      const turn = getCurrentFateKnotsCombatTurn(combat);
      if (turn && turn.side === "party" && turn.seatId !== "user") {
        return;
      }
      ambientKey = `combat:${combat.encounterId}:${buildFateKnotsCombatTurnId(combat) || "idle"}`;
    } else if (state.phase === FATE_KNOTS_PHASES.result) {
      ambientKey = `result:${state.sessionId}:${state.result.outcome}`;
    }
    if (!ambientKey) {
      return;
    }
    const dmSeatId = readyAiSeats[0];
    if (dmSeatId && state.dispatch.dmPromptKey !== `${ambientKey}:dm:${dmSeatId}`) {
      const messageResult = await sendBridgeMessageSafe(api, {
        provider: dmSeatId,
        page: FATE_KNOTS_PAGE_ID,
        text: buildDmPrompt(state),
        protocol: {
          room: ROOM_ID,
          scenario: "fate-knots-ai-dm",
          targets: [dmSeatId],
          context: {
            featureId: FATE_KNOTS_FEATURE_ID,
            sessionId: state.sessionId,
            phase: state.phase
          }
        }
      });
      if (messageResult && messageResult.success === true) {
        state.dispatch.dmPromptKey = `${ambientKey}:dm:${dmSeatId}`;
      }
    }
    const npcSeatId = readyAiSeats[1];
    if (npcSeatId && state.dispatch.npcPromptKey !== `${ambientKey}:npc:${npcSeatId}`) {
      const messageResult = await sendBridgeMessageSafe(api, {
        provider: npcSeatId,
        page: FATE_KNOTS_PAGE_ID,
        text: buildNpcPrompt(state, npcSeatId),
        protocol: {
          room: ROOM_ID,
          scenario: "fate-knots-ai-npc",
          targets: [npcSeatId],
          context: {
            featureId: FATE_KNOTS_FEATURE_ID,
            sessionId: state.sessionId,
            phase: state.phase
          }
        }
      });
      if (messageResult && messageResult.success === true) {
        state.dispatch.npcPromptKey = `${ambientKey}:npc:${npcSeatId}`;
      }
    }
  }
  return {
    buildDecisionPrompt,
    buildCombatPrompt,
    buildDmPrompt,
    buildNpcPrompt,
    dispatchDecisionPrompts,
    dispatchCombatPrompt,
    dispatchAmbientPrompts
  };
}
