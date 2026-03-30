import { loadContext } from "../../../shared/host/context-state.js";
import {
  FATE_KNOTS_PHASES,
  FATE_KNOTS_WAIT_MODES,
  FATE_KNOTS_WAIT_TIMEOUT_MS,
} from "./constants.js";
import {
  createFateKnotsCombatState,
  getCurrentFateKnotsCombatTurn,
  settleAutomaticFateKnotsCombatTurns,
} from "./combat-engine.js";
import { createDecisionState } from "./models.js";

type RoomApi = {
  getState: (key: string) => unknown;
  setState: (key: string, value: unknown) => void;
  getLocale?: () => unknown;
  notifyRoom?: (eventType: string, data: unknown) => void;
};

export function createFateKnotsPhaseRuntime(deps: any) {
  function getCombatStatusKey(state: any) {
    const turn = getCurrentFateKnotsCombatTurn(state.combat);
    return turn?.seatId === "user"
      ? "combatTurnUser"
      : turn?.seatId === "us1"
        ? "combatTurnRemote"
        : "combatTurnAi";
  }

  function startScenarioStep(state: any, contentRegistry: any, stepId: string, now: number) {
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
      deps.clearAmbientPromptKeys(state);
      deps.setIdleWaiting(state);
      return;
    }
    state.phase = FATE_KNOTS_PHASES.scenario;
    state.currentStepId = step.id;
    state.currentLocationId = step.locationId || state.currentLocationId;
    state.dmNarration = null;
    state.npcBanter = null;
    deps.resetPromptDispatchState(state);
    state.decision = createDecisionState({
      stepId: step.id,
      choices: step.choices,
      participantIds: state.participants.map(function (participant: any) {
        return participant.seatId;
      }),
      now,
      timeoutMs: FATE_KNOTS_WAIT_TIMEOUT_MS,
    });
    state.participants.forEach(function (participant: any) {
      participant.decisionChoiceId = null;
    });
    state.scenarioLog.push(`${step.title}: ${step.body}`);
    state.statusKey = "waitingDecision";
    deps.setDecisionWaiting(state, now);
  }

  function finalizeRun(api: RoomApi, state: any, outcome: string, title: string, summary: string) {
    state.phase = FATE_KNOTS_PHASES.result;
    state.result = {
      outcome,
      title,
      summary,
      continueHint: "Reset to replay the slice.",
    };
    state.dmNarration = null;
    state.npcBanter = null;
    deps.clearDecisionPromptKey(state, "ai1");
    deps.clearDecisionPromptKey(state, "ai2");
    deps.clearDecisionPromptKey(state, "us1");
    deps.clearCombatPromptKey(state, "ai1");
    deps.clearCombatPromptKey(state, "ai2");
    deps.clearCombatPromptKey(state, "us1");
    deps.clearAmbientPromptKeys(state);
    state.statusKey = outcome === "victory" ? "resultVictory" : "resultDefeat";
    deps.setIdleWaiting(state);
    deps.persistRunSummary(api, state, outcome, title, summary);
  }

  function resolveDecisionProgress(api: RoomApi, state: any, contentRegistry: any, now: number) {
    const currentStep = contentRegistry.scenarioStepsById.get(state.currentStepId);
    if (!state.decision || !currentStep) {
      return;
    }
    const pendingSeatIds = deps.listPendingDecisionSeats(state);
    if (pendingSeatIds.length > 0) {
      state.statusKey = "waitingDecision";
      deps.setDecisionWaiting(state, now);
      return;
    }

    const voteValues = Object.values(state.decision.votes);
    const unanimousChoiceId = voteValues.every(function (choiceId: any) {
      return choiceId === voteValues[0];
    })
      ? voteValues[0]
      : null;

    if (!unanimousChoiceId) {
      state.decision.conflict = true;
      deps.markDesync(state, "decision-conflict", [], "decisionConflict", now);
      return;
    }

    state.decision.resolvedChoiceId = unanimousChoiceId;
    const choice = currentStep.choices.find(function (entry: any) {
      return entry.id === unanimousChoiceId;
    });
    if (!choice) {
      deps.markDesync(state, "missing-choice", [], "decisionConflict", now);
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
      deps.resetPromptDispatchState(state);
      state.phase = FATE_KNOTS_PHASES.combat;
      state.statusKey = "combatTurnUser";
      deps.setCombatWaiting(state, now);
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
      state.statusKey = getCombatStatusKey(state);
      deps.setCombatWaiting(state, now);
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

  async function advancePendingWork(api: RoomApi, state: any, contentRegistry: any, now: number) {
    deps.maybeMarkSeatLossOrTimeout(state, loadContext(api), now);
    if (state.waiting.mode === FATE_KNOTS_WAIT_MODES.desync) {
      return { success: false };
    }

    if (state.phase === FATE_KNOTS_PHASES.scenario) {
      const result = await deps.dispatchDecisionPrompts(api, state, contentRegistry);
      if (!result.success) {
        deps.markDesync(
          state,
          `dispatch-failed:${result.seatId || "unknown"}`,
          result.seatId ? [result.seatId] : [],
          "seatUnavailable",
          now
        );
        return { success: false };
      }
      await deps.dispatchAmbientPrompts(api, state);
      return { success: true };
    }

    if (state.phase === FATE_KNOTS_PHASES.combat) {
      const turn = getCurrentFateKnotsCombatTurn(state.combat);
      if (turn?.side === "party" && turn.seatId !== "user") {
        const result = await deps.dispatchCombatPrompt(api, state, contentRegistry);
        if (!result.success) {
          deps.markDesync(
            state,
            `dispatch-failed:${result.seatId || "unknown"}`,
            result.seatId ? [result.seatId] : [],
            "seatUnavailable",
            now
          );
          return { success: false };
        }
      }
      await deps.dispatchAmbientPrompts(api, state);
    }

    if (state.phase === FATE_KNOTS_PHASES.result) {
      await deps.dispatchAmbientPrompts(api, state);
    }

    return { success: true };
  }

  function recoverDecisionConflict(state: any, now: number) {
    if (!state.decision) {
      return;
    }
    state.participants.forEach(function (participant: any) {
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
    deps.clearAmbientPromptKeys(state);
    deps.clearDecisionPromptKey(state, "ai1");
    deps.clearDecisionPromptKey(state, "ai2");
    deps.clearDecisionPromptKey(state, "us1");
    deps.setDecisionWaiting(state, now);
    state.statusKey = "waitingDecision";
  }

  function prepareSync(state: any, now: number) {
    if (state.phase === FATE_KNOTS_PHASES.scenario && state.decision?.conflict === true) {
      recoverDecisionConflict(state, now);
      return;
    }

    if (state.phase === FATE_KNOTS_PHASES.scenario) {
      if (Array.isArray(state.waiting?.pendingSeatIds)) {
        state.waiting.pendingSeatIds.forEach(function (seatId: string) {
          deps.clearDecisionPromptKey(state, seatId);
        });
      }
      deps.clearAmbientPromptKeys(state);
      deps.setDecisionWaiting(state, now);
      state.statusKey = "waitingDecision";
      return;
    }

    if (state.phase === FATE_KNOTS_PHASES.combat) {
      const turn = getCurrentFateKnotsCombatTurn(state.combat);
      if (turn?.seatId) {
        deps.clearCombatPromptKey(state, turn.seatId);
      }
      deps.clearAmbientPromptKeys(state);
      state.statusKey = getCombatStatusKey(state);
      deps.setCombatWaiting(state, now);
      return;
    }

    if (state.phase === FATE_KNOTS_PHASES.result) {
      deps.clearAmbientPromptKeys(state);
    }
  }

  return {
    advancePendingWork,
    finalizeRun,
    getCombatStatusKey,
    prepareSync,
    recoverDecisionConflict,
    resolveDecisionProgress,
    startScenarioStep,
  };
}
