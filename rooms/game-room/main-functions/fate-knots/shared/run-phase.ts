import type { FateKnotsPhase, FateKnotsRunState } from "./contracts.js";

export type FateKnotsNonCombatRunPhase =
  "run-setup" | "exploration" | "transition" | "loot" | "camp";

export type FateKnotsRunPhaseIssueCode =
  | "run-not-active"
  | "active-combat-exists"
  | "combat-phase-owned-by-combat-flow"
  | "unsupported-source-phase"
  | "transition-not-allowed"
  | "unresolved-loot"
  | "terminal-success-owned-by-story";

export interface FateKnotsRunPhaseIssue {
  code: FateKnotsRunPhaseIssueCode;
  fromPhase?: FateKnotsPhase;
  toPhase?: FateKnotsPhase;
}

export interface FateKnotsRunPhaseResult {
  ok: boolean;
  run: FateKnotsRunState;
  issues: FateKnotsRunPhaseIssue[];
}

const ALLOWED_NON_COMBAT_TRANSITIONS: Readonly<
  Record<FateKnotsNonCombatRunPhase, readonly FateKnotsNonCombatRunPhase[]>
> = {
  "run-setup": ["exploration"],
  exploration: ["transition", "loot", "camp"],
  transition: ["exploration", "loot", "camp"],
  loot: ["exploration", "camp"],
  camp: ["exploration", "transition"],
};

function cloneRun(run: FateKnotsRunState): FateKnotsRunState {
  return {
    ...run,
    revealedLocationIds: run.revealedLocationIds.slice(),
    revealedKnotIds: run.revealedKnotIds.slice(),
    completedKnotIds: run.completedKnotIds.slice(),
    partyActorIds: run.partyActorIds.slice(),
    actors: run.actors.map((actor) => ({
      ...actor,
      position: { ...actor.position },
      ownedCardIds: actor.ownedCardIds.slice(),
      availableCardIds: actor.availableCardIds.slice(),
      equipmentIds: actor.equipmentIds.slice(),
      statusIds: actor.statusIds.slice(),
      injuryIds: actor.injuryIds.slice(),
    })),
    teamPoolItemIds: run.teamPoolItemIds.slice(),
    activeCombat: run.activeCombat
      ? {
          ...run.activeCombat,
          config: { ...run.activeCombat.config },
          actors: run.activeCombat.actors.map((actor) => ({
            ...actor,
            position: { ...actor.position },
            ownedCardIds: actor.ownedCardIds.slice(),
            availableCardIds: actor.availableCardIds.slice(),
            equipmentIds: actor.equipmentIds.slice(),
            statusIds: actor.statusIds.slice(),
            injuryIds: actor.injuryIds.slice(),
          })),
          commits: run.activeCombat.commits.map((commit) => ({ ...commit })),
        }
      : null,
  };
}

function fail(run: FateKnotsRunState, issue: FateKnotsRunPhaseIssue): FateKnotsRunPhaseResult {
  return { ok: false, run: cloneRun(run), issues: [issue] };
}

function isCombatPhase(phase: FateKnotsPhase): boolean {
  return (
    phase === "combat-discussion" ||
    phase === "combat-commit" ||
    phase === "combat-resolution" ||
    phase === "combat-aftermath"
  );
}

function isNonCombatRunPhase(phase: FateKnotsPhase): phase is FateKnotsNonCombatRunPhase {
  return phase in ALLOWED_NON_COMBAT_TRANSITIONS;
}

/**
 * Advances only already-authorized non-combat run phases. Story logic decides
 * which destination is appropriate; this helper only rejects impossible or
 * authority-crossing transitions. V1 deliberately has no generic transition
 * into a privileged `finale` phase: finale is an authored terminal story choice.
 */
export function transitionFateKnotsRunPhase(
  runInput: FateKnotsRunState,
  toPhase: FateKnotsNonCombatRunPhase
): FateKnotsRunPhaseResult {
  if (runInput.result !== "active") return fail(runInput, { code: "run-not-active" });
  if (runInput.activeCombat) return fail(runInput, { code: "active-combat-exists" });
  if (isCombatPhase(runInput.phase)) {
    return fail(runInput, {
      code: "combat-phase-owned-by-combat-flow",
      fromPhase: runInput.phase,
      toPhase,
    });
  }
  if (!isNonCombatRunPhase(runInput.phase)) {
    return fail(runInput, { code: "unsupported-source-phase", fromPhase: runInput.phase, toPhase });
  }
  if (runInput.phase === "loot" && runInput.teamPoolItemIds.length > 0) {
    return fail(runInput, { code: "unresolved-loot", fromPhase: runInput.phase, toPhase });
  }
  if (!ALLOWED_NON_COMBAT_TRANSITIONS[runInput.phase].includes(toPhase)) {
    return fail(runInput, { code: "transition-not-allowed", fromPhase: runInput.phase, toPhase });
  }

  const run = cloneRun(runInput);
  run.phase = toPhase;
  run.revision += 1;
  return { ok: true, run, issues: [] };
}

/**
 * Compatibility guard for old callers. V1 terminal success is owned exclusively
 * by `applyFateKnotsStoryTransition` when a currently legal authored
 * `kind: "finale"` transition is chosen. Generic phase code cannot complete a
 * scenario or turn a legacy `finale` phase into success.
 */
export function completeFateKnotsRun(runInput: FateKnotsRunState): FateKnotsRunPhaseResult {
  return fail(runInput, {
    code: "terminal-success-owned-by-story",
    fromPhase: runInput.phase,
  });
}
