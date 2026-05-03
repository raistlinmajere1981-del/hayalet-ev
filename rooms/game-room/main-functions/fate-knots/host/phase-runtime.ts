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
  type FateKnotsEnemyAction,
  type FateKnotsCombatState,
} from "./combat-engine.js";
import { createDecisionState, type normalizeFateKnotsState } from "./models.js";

type FateKnotsHostState = ReturnType<typeof normalizeFateKnotsState>;
type FateKnotsParticipantState = FateKnotsHostState["participants"][number];
type FateKnotsSharedContext = ReturnType<typeof loadContext>;
type FateKnotsCreateCombatOptions = Parameters<typeof createFateKnotsCombatState>[0];
type FateKnotsCombatParticipant = NonNullable<FateKnotsCreateCombatOptions["participants"]>[number];

interface FateKnotsScenarioChoiceRecord extends Record<string, unknown> {
  id: string;
  label: string;
  nextStepId?: string;
  encounterId?: string;
}

interface FateKnotsScenarioStepRecord extends Record<string, unknown> {
  id: string;
  title: string;
  body: string;
  locationId?: string;
  choices: FateKnotsScenarioChoiceRecord[];
}

interface FateKnotsPhaseContentRegistry {
  scenarioStepsById: Map<string, FateKnotsScenarioStepRecord>;
  encountersById: Map<string, FateKnotsCreateCombatOptions["encounter"]>;
  classesById: NonNullable<FateKnotsCreateCombatOptions["classesById"]>;
  combatConfig: {
    startingEnergy: number;
  };
  enemyActionsById: Map<string, FateKnotsEnemyAction>;
}

interface FateKnotsPhaseDispatchResult {
  success: boolean;
  seatId?: string;
}

interface RoomApi {
  getState(key: string): unknown;
  setState(key: string, value: unknown): void;
  getLocale?(): unknown;
  notifyRoom?(eventType: string, data: unknown): void;
}

interface FateKnotsPhaseRuntimeDeps {
  clearAmbientPromptKeys(state: FateKnotsHostState): void;
  clearCombatPromptKey(state: FateKnotsHostState, seatId: string): void;
  clearDecisionPromptKey(state: FateKnotsHostState, seatId: string): void;
  dispatchAmbientPrompts(api: RoomApi, state: FateKnotsHostState): Promise<void>;
  dispatchCombatPrompt(
    api: RoomApi,
    state: FateKnotsHostState,
    contentRegistry: FateKnotsPhaseContentRegistry
  ): Promise<FateKnotsPhaseDispatchResult>;
  dispatchDecisionPrompts(
    api: RoomApi,
    state: FateKnotsHostState,
    contentRegistry: FateKnotsPhaseContentRegistry
  ): Promise<FateKnotsPhaseDispatchResult>;
  listPendingDecisionSeats(state: FateKnotsHostState): string[];
  markDesync(
    state: FateKnotsHostState,
    reason: string,
    pendingSeatIds: string[],
    statusKey: string,
    now: number
  ): void;
  maybeMarkSeatLossOrTimeout(
    state: FateKnotsHostState,
    context: FateKnotsSharedContext,
    now: number
  ): void;
  persistRunSummary(
    api: RoomApi,
    state: FateKnotsHostState,
    outcome: string,
    title: string,
    summary: string
  ): void;
  resetPromptDispatchState(state: FateKnotsHostState): void;
  setCombatWaiting(state: FateKnotsHostState, now: number): void;
  setDecisionWaiting(state: FateKnotsHostState, now: number): void;
  setIdleWaiting(state: FateKnotsHostState): void;
}

function readCombatState(state: FateKnotsHostState): FateKnotsCombatState | null {
  return state.combat ? (state.combat as unknown as FateKnotsCombatState) : null;
}

export function createFateKnotsPhaseRuntime(deps: FateKnotsPhaseRuntimeDeps) {
  function getCombatStatusKey(state: FateKnotsHostState): string {
    const combat = readCombatState(state);
    const turn = combat ? getCurrentFateKnotsCombatTurn(combat) : null;
    return turn?.seatId === "user"
      ? "combatTurnUser"
      : turn?.seatId === "us1"
        ? "combatTurnRemote"
        : "combatTurnAi";
  }

  function startScenarioStep(
    state: FateKnotsHostState,
    contentRegistry: FateKnotsPhaseContentRegistry,
    stepId: string,
    now: number
  ): void {
    const step = contentRegistry.scenarioStepsById.get(stepId) || null;
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
      participantIds: state.participants.map(function (participant: FateKnotsParticipantState) {
        return participant.seatId;
      }),
      now,
      timeoutMs: FATE_KNOTS_WAIT_TIMEOUT_MS,
    });
    state.participants.forEach(function (participant: FateKnotsParticipantState) {
      participant.decisionChoiceId = null;
    });
    state.scenarioLog.push(`${step.title}: ${step.body}`);
    state.statusKey = "waitingDecision";
    deps.setDecisionWaiting(state, now);
  }

  function finalizeRun(
    api: RoomApi,
    state: FateKnotsHostState,
    outcome: string,
    title: string,
    summary: string
  ): void {
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

  function resolveDecisionProgress(
    api: RoomApi,
    state: FateKnotsHostState,
    contentRegistry: FateKnotsPhaseContentRegistry,
    now: number
  ): void {
    const currentStep =
      state.currentStepId && contentRegistry.scenarioStepsById.get(state.currentStepId)
        ? contentRegistry.scenarioStepsById.get(state.currentStepId) || null
        : null;
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
    const unanimousChoiceId =
      voteValues.length > 0 &&
      voteValues.every(function (choiceId: string) {
        return choiceId === voteValues[0];
      })
        ? voteValues[0] || null
        : null;

    if (!unanimousChoiceId) {
      state.decision.conflict = true;
      deps.markDesync(state, "decision-conflict", [], "decisionConflict", now);
      return;
    }

    state.decision.resolvedChoiceId = unanimousChoiceId;
    const choice =
      currentStep.choices.find(function (entry: FateKnotsScenarioChoiceRecord) {
        return entry.id === unanimousChoiceId;
      }) || null;
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
      const encounter = contentRegistry.encountersById.get(choice.encounterId) || null;
      const combatParticipants: FateKnotsCombatParticipant[] = state.participants.map(function (
        participant: FateKnotsParticipantState
      ) {
        return {
          seatId: participant.seatId,
          nickname: participant.nickname,
          selection: {
            classId: participant.selection.classId || "",
            backgroundId: participant.selection.backgroundId || "",
          },
        };
      });
      const combatOptions: FateKnotsCreateCombatOptions = {
        participants: combatParticipants,
        classesById: contentRegistry.classesById,
        startingEnergy: contentRegistry.combatConfig.startingEnergy,
      };
      if (encounter) {
        combatOptions.encounter = encounter;
      }
      const combat = createFateKnotsCombatState(combatOptions);

      state.combat = combat as unknown as FateKnotsHostState["combat"];
      state.dmNarration = null;
      state.npcBanter = null;
      deps.resetPromptDispatchState(state);
      state.phase = FATE_KNOTS_PHASES.combat;
      state.statusKey = "combatTurnUser";
      deps.setCombatWaiting(state, now);
      settleAutomaticFateKnotsCombatTurns(combat, contentRegistry.enemyActionsById);

      if (combat.outcome === "victory") {
        finalizeRun(
          api,
          state,
          "victory",
          "Village Secured",
          "The party held the line and the first Fate Knots slice ends in victory."
        );
        return;
      }
      if (combat.outcome === "defeat") {
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

  async function advancePendingWork(
    api: RoomApi,
    state: FateKnotsHostState,
    contentRegistry: FateKnotsPhaseContentRegistry,
    now: number
  ): Promise<{ success: boolean }> {
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
      const combat = readCombatState(state);
      const turn = combat ? getCurrentFateKnotsCombatTurn(combat) : null;
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

  function recoverDecisionConflict(state: FateKnotsHostState, now: number): void {
    if (!state.decision) {
      return;
    }

    state.participants.forEach(function (participant: FateKnotsParticipantState) {
      if (participant.seatId !== "user") {
        participant.decisionChoiceId = null;
        delete state.decision?.votes[participant.seatId];
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

  function prepareSync(state: FateKnotsHostState, now: number): void {
    if (state.phase === FATE_KNOTS_PHASES.scenario && state.decision?.conflict === true) {
      recoverDecisionConflict(state, now);
      return;
    }

    if (state.phase === FATE_KNOTS_PHASES.scenario) {
      state.waiting.pendingSeatIds.forEach(function (seatId: string) {
        deps.clearDecisionPromptKey(state, seatId);
      });
      deps.clearAmbientPromptKeys(state);
      deps.setDecisionWaiting(state, now);
      state.statusKey = "waitingDecision";
      return;
    }

    if (state.phase === FATE_KNOTS_PHASES.combat) {
      const combat = readCombatState(state);
      const turn = combat ? getCurrentFateKnotsCombatTurn(combat) : null;
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
