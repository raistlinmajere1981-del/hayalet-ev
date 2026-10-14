import type { FateKnotsRunState, FateKnotsUniversePackage } from "./contracts.js";
import type { FateKnotsCombatRuntimeState } from "./combat-runtime.js";
import {
  executeFateKnotsCombatResolution,
  type FateKnotsCombatResolutionCatalog,
  type FateKnotsCombatResolutionExecutionResult,
} from "./combat-resolution-executor.js";

export type FateKnotsRunCombatResolutionIssueCode =
  "no-active-combat" | "combat-resolution-failed" | "reveal-knot-not-found";

export interface FateKnotsRunCombatResolutionIssue {
  code: FateKnotsRunCombatResolutionIssueCode;
  revealId?: string;
}

export interface FateKnotsRunCombatResolutionResult {
  ok: boolean;
  run: FateKnotsRunState;
  runtime: FateKnotsCombatRuntimeState;
  execution: FateKnotsCombatResolutionExecutionResult | null;
  issues: FateKnotsRunCombatResolutionIssue[];
}

function unique(values: readonly string[]): string[] {
  return Array.from(new Set(values));
}

/**
 * Run-owned combat resolution authority. The lower executor deliberately defers
 * `run-reveal` patches because it only owns combat state. This composition layer
 * consumes every successful deferred reveal in the same returned Run mutation so
 * a card effect cannot resolve mechanically and then disappear.
 *
 * V1 revealId semantics are intentionally small: revealId references one
 * canonical story knot. It does not evaluate scripts or invent another reveal
 * namespace.
 */
export function executeFateKnotsRunCombatResolution(
  universe: FateKnotsUniversePackage,
  runInput: FateKnotsRunState,
  runtimeInput: FateKnotsCombatRuntimeState,
  catalog: FateKnotsCombatResolutionCatalog
): FateKnotsRunCombatResolutionResult {
  const activeCombat = runInput.activeCombat;
  if (!activeCombat) {
    return {
      ok: false,
      run: structuredClone(runInput),
      runtime: structuredClone(runtimeInput),
      execution: null,
      issues: [{ code: "no-active-combat" }],
    };
  }

  const execution = executeFateKnotsCombatResolution(activeCombat, runtimeInput, catalog);
  if (!execution.ok) {
    return {
      ok: false,
      run: structuredClone(runInput),
      runtime: structuredClone(runtimeInput),
      execution,
      issues: [{ code: "combat-resolution-failed" }],
    };
  }

  const knotById = new Map(universe.story.knots.map((knot) => [knot.id, knot] as const));
  const revealIds = execution.deferredRunPatches.map((patch) => patch.revealId);
  const missingRevealId = revealIds.find((revealId) => !knotById.has(revealId));
  if (missingRevealId) {
    return {
      ok: false,
      run: structuredClone(runInput),
      runtime: structuredClone(runtimeInput),
      execution,
      issues: [{ code: "reveal-knot-not-found", revealId: missingRevealId }],
    };
  }

  const run = structuredClone(runInput);
  run.activeCombat = structuredClone(execution.combat);
  run.phase = execution.combat.phase;
  run.revealedKnotIds = unique([...run.revealedKnotIds, ...revealIds]);
  run.revision += 1;

  return {
    ok: true,
    run,
    runtime: structuredClone(execution.runtime),
    execution,
    issues: [],
  };
}
