import { loadContext } from "../../../shared/host/context-state.js";
import {
  FATE_KNOTS_FEATURE_ID,
  FATE_KNOTS_PAGE_ID,
  ROOM_ID,
} from "../../../shared/host/feature-meta.js";
import {
  FATE_KNOTS_COMMAND_NAMES,
  FATE_KNOTS_PHASES,
  FATE_KNOTS_SUPPORTED_AI_SEATS,
} from "./constants.js";
import { buildFateKnotsCombatTurnId, getCurrentFateKnotsCombatTurn } from "./combat-engine.js";

type RoomApi = {
  getState: (key: string) => unknown;
  setState: (key: string, value: unknown) => void;
  getLocale?: () => unknown;
  notifyRoom?: (eventType: string, data: unknown) => void;
  sendProtocol?: (options: any) => Promise<any>;
  sendMessage?: (options: any) => Promise<any>;
  sendUs1Message?: (options: any) => Promise<any>;
  selectUs1RemoteUser?: (remoteUserId: string) => Promise<any>;
};

export function createFateKnotsPromptRuntime(deps: any) {
  const getParticipant = deps.getParticipant;
  const listPendingDecisionSeats = deps.listPendingDecisionSeats;
  const getUs1RemoteUserId = deps.getUs1RemoteUserId;
  const updateTransportFromSendResult = deps.updateTransportFromSendResult;

  function buildDecisionPrompt(state: any, step: any, context: any, commandName: string) {
    const choiceLines = step.choices
      .map(function (choice: any) {
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

  function buildCombatPrompt(state: any, contentRegistry: any, commandName: string) {
    const turn = getCurrentFateKnotsCombatTurn(state.combat);
    const turnId = buildFateKnotsCombatTurnId(state.combat);
    const actor = getParticipant(state, turn?.seatId || "") || { nickname: turn?.seatId || "Seat" };
    const actions = state.combat
      ? state.combat.party.find(function (member: any) {
          return member.seatId === turn?.seatId;
        })?.deck || []
      : [];
    const actionPacket = actions
      .map(function (actionId: string) {
        return contentRegistry.cardsById.get(actionId) || null;
      })
      .filter(Boolean)
      .map(function (card: any) {
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
            hp: state.combat.party.find((member: any) => member.seatId === turn?.seatId)?.hp || 0,
            energy:
              state.combat.party.find((member: any) => member.seatId === turn?.seatId)?.energy || 0,
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

  function buildDmPrompt(state: any) {
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

  function buildNpcPrompt(state: any, seatId: string) {
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

  async function sendProtocolSafe(api: RoomApi, options: any) {
    if (typeof api.sendProtocol !== "function") {
      return null;
    }
    return await api.sendProtocol(options);
  }

  async function sendMessageSafe(api: RoomApi, options: any) {
    if (typeof api.sendMessage !== "function") {
      return null;
    }
    return await api.sendMessage(options);
  }

  async function sendUs1MessageSafe(api: RoomApi, options: any) {
    if (typeof api.sendUs1Message !== "function") {
      return null;
    }
    return await api.sendUs1Message(options);
  }

  async function dispatchDecisionPrompts(api: RoomApi, state: any, contentRegistry: any) {
    if (!state.decision || !state.currentStepId) {
      return { success: true };
    }
    const context = loadContext(api);
    const step = contentRegistry.scenarioStepsById.get(state.currentStepId);
    if (!step) {
      return { success: false };
    }
    const pendingSeats = listPendingDecisionSeats(state).filter(function (seatId: string) {
      return seatId !== "user";
    });
    // NOTE: Each seat prompt updates shared dispatch and transport state, so delivery stays sequential.
    /* eslint-disable no-await-in-loop */
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
        const sendResult = await sendUs1MessageSafe(api, {
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
      const protocolResult = await sendProtocolSafe(api, {
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
      const messageResult = await sendMessageSafe(api, {
        provider: seatId,
        page: FATE_KNOTS_PAGE_ID,
        text: buildDecisionPrompt(state, step, context, FATE_KNOTS_COMMAND_NAMES.aiChoice),
      });
      if (!messageResult || messageResult.success !== true) {
        return { success: false, seatId };
      }
      state.dispatch.decisionPromptKeys[seatId] = promptKey;
    }
    /* eslint-enable no-await-in-loop */
    return { success: true };
  }

  async function dispatchCombatPrompt(api: RoomApi, state: any, contentRegistry: any) {
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
      const sendResult = await sendUs1MessageSafe(api, {
        localSessionId: state.transport?.localSessionId || null,
        text: buildCombatPrompt(
          state,
          contentRegistry,
          FATE_KNOTS_COMMAND_NAMES.remoteCombatAction
        ),
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
    const protocolResult = await sendProtocolSafe(api, {
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
    const messageResult = await sendMessageSafe(api, {
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

  async function dispatchAmbientPrompts(api: RoomApi, state: any) {
    const context = loadContext(api);
    const readyAiSeats = FATE_KNOTS_SUPPORTED_AI_SEATS.filter(function (seatId: string) {
      return context?.slots?.[seatId as keyof typeof context.slots]?.ready === true;
    });
    if (readyAiSeats.length === 0) {
      return;
    }

    let ambientKey = null;
    if (state.phase === FATE_KNOTS_PHASES.scenario && state.decision) {
      const blockingAi = listPendingDecisionSeats(state).filter(function (seatId: string) {
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
      const protocolResult = await sendProtocolSafe(api, {
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
        const messageResult = await sendMessageSafe(api, {
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
      const protocolResult = await sendProtocolSafe(api, {
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
        const messageResult = await sendMessageSafe(api, {
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

  return {
    buildDecisionPrompt: buildDecisionPrompt,
    buildCombatPrompt: buildCombatPrompt,
    buildDmPrompt: buildDmPrompt,
    buildNpcPrompt: buildNpcPrompt,
    dispatchDecisionPrompts: dispatchDecisionPrompts,
    dispatchCombatPrompt: dispatchCombatPrompt,
    dispatchAmbientPrompts: dispatchAmbientPrompts,
  };
}
