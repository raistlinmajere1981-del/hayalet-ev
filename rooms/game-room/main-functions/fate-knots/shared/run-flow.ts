import type {
  FateKnotsActorState,
  FateKnotsCombatResultPackage,
  FateKnotsCombatState,
  FateKnotsPhase,
  FateKnotsRunState,
  FateKnotsStatusDefinition,
} from "./contracts.js";
import type { FateKnotsCombatRuntimeState } from "./combat-runtime.js";
import {
  closeFateKnotsTerminalCombat,
  type FateKnotsCombatClosureIssue,
} from "./combat-closure.js";
import {
  settleFateKnotsPartyVictory,
  type FateKnotsPostCombatSettlementIssue,
} from "./post-combat-settlement.js";
import type { FateKnotsRulesConfig } from "../rules/config.js";

/**
 * `finale` remains in this compatibility union because older story/runtime types
 * may still carry that token, but V1 run-flow rejects it in `isAllowedExitPhase`.
 */
export type FateKnotsCombatExitNextPhase = "exploration" | "transition" | "loot" | "finale";

export type FateKnotsRunFlowIssueCode =
  | "run-not-active"
  | "active-combat-exists"
  | "invalid-combat-entry-phase"
  | "invalid-combat-start-state"
  | "no-active-combat"
  | "combat-id-mismatch"
  | "combat-result-mismatch"
  | "next-phase-required"
  | "invalid-next-phase"
  | "combat-closure-failed"
  | "victory-settlement-failed";

export interface FateKnotsRunFlowIssue {
  code: FateKnotsRunFlowIssueCode;
  closureIssues?: FateKnotsCombatClosureIssue[];
  settlementIssues?: FateKnotsPostCombatSettlementIssue[];
}

export interface FateKnotsRunFlowResult {
  ok: boolean;
  run: FateKnotsRunState;
  issues: FateKnotsRunFlowIssue[];
}

export interface FateKnotsCombatExitContext {
  /** Latest combat snapshot returned by combat flow/resolution. */
  combat: FateKnotsCombatState;
  runtime: FateKnotsCombatRuntimeState;
  statuses: readonly FateKnotsStatusDefinition[];
  rules: FateKnotsRulesConfig;
  resultPackage: FateKnotsCombatResultPackage;
  nextPhase?: FateKnotsCombatExitNextPhase;
}

function cloneActor(actor: FateKnotsActorState): FateKnotsActorState {
  return {
    ...actor,
    position: { ...actor.position },
    ownedCardIds: actor.ownedCardIds.slice(),
    availableCardIds: actor.availableCardIds.slice(),
    equipmentIds: actor.equipmentIds.slice(),
    statusIds: actor.statusIds.slice(),
    injuryIds: actor.injuryIds.slice(),
  };
}

function cloneCombat(combat: FateKnotsCombatState): FateKnotsCombatState {
  return {
    ...combat,
    config: { ...combat.config },
    actors: combat.actors.map(cloneActor),
    commits: combat.commits.map((commit) => ({ ...commit })),
  };
}

function cloneRun(run: FateKnotsRunState): FateKnotsRunState {
  return {
    ...run,
    revealedLocationIds: run.revealedLocationIds.slice(),
    revealedKnotIds: run.revealedKnotIds.slice(),
    completedKnotIds: run.completedKnotIds.slice(),
    partyActorIds: run.partyActorIds.slice(),
    actors: run.actors.map(cloneActor),
    teamPoolItemIds: run.teamPoolItemIds.slice(),
    activeCombat: run.activeCombat ? cloneCombat(run.activeCombat) : null,
  };
}

function failed(run: FateKnotsRunState, issues: FateKnotsRunFlowIssue[]): FateKnotsRunFlowResult {
  return { ok: false, run: cloneRun(run), issues };
}

function isCombatEntryPhase(phase: FateKnotsPhase): boolean {
  return phase === "exploration" || phase === "transition";
}

function isAllowedExitPhase(
  result: FateKnotsCombatState["result"],
  phase: FateKnotsCombatExitNextPhase | undefined
): boolean {
  if (!phase) return false;
  if (result === "party-victory") {
    return phase === "exploration" || phase === "loot";
  }
  if (result === "retreat") {
    return phase === "exploration" || phase === "transition";
  }
  return false;
}

/**
 * Attaches an already-created headless combat to an active run.
 *
 * Encounter creation remains a separate engine responsibility. This function
 * does not invent enemies, cards or starting positions; it only makes combat
 * the authoritative run phase. Story-driven combat normally enters from the
 * short-lived `transition` phase; there is no privileged runtime `finale`
 * combat path in V1.
 */
export function enterFateKnotsCombat(
  runInput: FateKnotsRunState,
  combatInput: FateKnotsCombatState
): FateKnotsRunFlowResult {
  if (runInput.result !== "active") return failed(runInput, [{ code: "run-not-active" }]);
  if (runInput.activeCombat) return failed(runInput, [{ code: "active-combat-exists" }]);
  if (!isCombatEntryPhase(runInput.phase)) {
    return failed(runInput, [{ code: "invalid-combat-entry-phase" }]);
  }
  if (combatInput.result !== "active" || combatInput.phase !== "combat-discussion") {
    return failed(runInput, [{ code: "invalid-combat-start-state" }]);
  }

  const run = cloneRun(runInput);
  run.activeCombat = cloneCombat(combatInput);
  run.phase = "combat-discussion";
  run.revision += 1;
  return { ok: true, run, issues: [] };
}

/**
 * Stores the newest authoritative combat snapshot in the run after a phase,
 * commit, resolution or aftermath update. This prevents the run from retaining
 * the initial encounter snapshot while the headless combat engine advances.
 */
export function updateFateKnotsActiveCombat(
  runInput: FateKnotsRunState,
  combatInput: FateKnotsCombatState
): FateKnotsRunFlowResult {
  if (runInput.result !== "active") return failed(runInput, [{ code: "run-not-active" }]);
  if (!runInput.activeCombat) return failed(runInput, [{ code: "no-active-combat" }]);
  if (runInput.activeCombat.combatId !== combatInput.combatId) {
    return failed(runInput, [{ code: "combat-id-mismatch" }]);
  }

  const run = cloneRun(runInput);
  run.activeCombat = cloneCombat(combatInput);
  run.phase = combatInput.phase;
  run.revision += 1;
  return { ok: true, run, issues: [] };
}

function syncPartyActorsFromCombat(run: FateKnotsRunState, combat: FateKnotsCombatState): void {
  const combatByActorId = new Map(
    combat.actors
      .filter((actor) => actor.teamId === "party")
      .map((actor) => [actor.actorId, actor] as const)
  );

  run.actors = run.actors.map((actor) => {
    if (!run.partyActorIds.includes(actor.actorId)) return cloneActor(actor);
    const combatActor = combatByActorId.get(actor.actorId);
    if (!combatActor) return cloneActor(actor);

    return {
      ...cloneActor(actor),
      hp: combatActor.hp,
      energy: combatActor.energy,
      fallen: combatActor.fallen,
      ownedCardIds: combatActor.ownedCardIds.slice(),
      availableCardIds: combatActor.availableCardIds.slice(),
      equipmentIds: combatActor.equipmentIds.slice(),
      statusIds: combatActor.statusIds.slice(),
      injuryIds: combatActor.injuryIds.slice(),
    };
  });
}

/**
 * Closes terminal combat and returns authority to the run.
 *
 * The caller must explicitly provide the post-combat phase for victory/retreat.
 * This is deliberate: the rules engine should not guess whether a particular
 * victory opens loot or resumes exploration. Scenario completion is not a
 * combat exit phase; only an authored legal `kind: "finale"` story transition
 * may complete the run.
 *
 * Party defeat is the only automatic terminal run transition: it always becomes
 * `failed` and clears active combat.
 */
export function exitFateKnotsCombat(
  runInput: FateKnotsRunState,
  context: FateKnotsCombatExitContext
): FateKnotsRunFlowResult {
  if (runInput.result !== "active") return failed(runInput, [{ code: "run-not-active" }]);
  const activeCombat = runInput.activeCombat;
  if (!activeCombat) return failed(runInput, [{ code: "no-active-combat" }]);

  if (
    activeCombat.combatId !== context.combat.combatId ||
    context.combat.combatId !== context.resultPackage.combatId
  ) {
    return failed(runInput, [{ code: "combat-id-mismatch" }]);
  }
  if (context.combat.result !== context.resultPackage.result) {
    return failed(runInput, [{ code: "combat-result-mismatch" }]);
  }

  if (context.combat.result !== "party-defeat" && !context.nextPhase) {
    return failed(runInput, [{ code: "next-phase-required" }]);
  }
  if (
    context.combat.result !== "party-defeat" &&
    !isAllowedExitPhase(context.combat.result, context.nextPhase)
  ) {
    return failed(runInput, [{ code: "invalid-next-phase" }]);
  }

  const closed = closeFateKnotsTerminalCombat(context.combat, context.runtime, context.statuses);
  if (!closed.ok) {
    return failed(runInput, [{ code: "combat-closure-failed", closureIssues: closed.issues }]);
  }

  let settledCombat = closed.combat;
  if (settledCombat.result === "party-victory") {
    const settlement = settleFateKnotsPartyVictory(settledCombat, context.rules);
    if (!settlement.ok) {
      return failed(runInput, [
        {
          code: "victory-settlement-failed",
          settlementIssues: settlement.issues,
        },
      ]);
    }
    settledCombat = settlement.combat;
  }

  const run = cloneRun(runInput);
  syncPartyActorsFromCombat(run, settledCombat);
  run.activeCombat = null;
  run.revision += 1;

  if (settledCombat.result === "party-defeat") {
    run.phase = "failed";
    run.result = "failed";
    return { ok: true, run, issues: [] };
  }

  run.phase = context.nextPhase as FateKnotsCombatExitNextPhase;
  return { ok: true, run, issues: [] };
}
