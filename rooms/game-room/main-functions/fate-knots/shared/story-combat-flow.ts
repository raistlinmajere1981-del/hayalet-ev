import type {
  FateKnotsCombatResultPackage,
  FateKnotsRunState,
  FateKnotsStatusDefinition,
  FateKnotsUniversePackage,
} from "./contracts.js";
import type { FateKnotsCombatRuntimeState } from "./combat-runtime.js";
import { exitFateKnotsCombat, type FateKnotsRunFlowIssue } from "./run-flow.js";
import {
  clearFateKnotsStoryCombatTracking,
  resolveFateKnotsStoryCombatOutcome,
  type FateKnotsStoryProgressionIssue,
} from "./story-progression.js";
import type { FateKnotsRulesConfig } from "../rules/config.js";

export type FateKnotsStoryCombatExitIssue =
  | { code: "story-outcome-failed"; storyIssues: FateKnotsStoryProgressionIssue[] }
  | { code: "combat-exit-failed"; combatIssues: FateKnotsRunFlowIssue[] }
  | { code: "story-cleanup-failed"; storyIssues: FateKnotsStoryProgressionIssue[] };

export interface FateKnotsStoryCombatExitResult {
  ok: boolean;
  run: FateKnotsRunState;
  issues: FateKnotsStoryCombatExitIssue[];
}

/**
 * Canonical terminal combat exit for story-driven encounters.
 *
 * Story progression is calculated while terminal combat is still attached so
 * victory/retreat can reference the exact encounter. The regular combat authority
 * then settles HP/status/runtime state and removes combat.
 *
 * When encounter loot exists, story transition/encounter tracking deliberately
 * survives the combat exit until unanimous loot settlement. The ids prove which
 * authored combat/encounter produced the pending pool; they are not a hidden
 * finale destination or completion flag. Loot settlement always returns through
 * normal exploration and then clears this tracking. Non-loot exits clear it
 * immediately.
 */
export function exitFateKnotsStoryCombat(
  universe: FateKnotsUniversePackage,
  runInput: FateKnotsRunState,
  context: {
    runtime: FateKnotsCombatRuntimeState;
    statuses: readonly FateKnotsStatusDefinition[];
    rules: FateKnotsRulesConfig;
    resultPackage: FateKnotsCombatResultPackage;
  }
): FateKnotsStoryCombatExitResult {
  const storyOutcome = resolveFateKnotsStoryCombatOutcome(universe, runInput);
  if (!storyOutcome.ok) {
    return {
      ok: false,
      run: structuredClone(runInput),
      issues: [{ code: "story-outcome-failed", storyIssues: storyOutcome.issues }],
    };
  }

  const combat = storyOutcome.run.activeCombat;
  if (!combat) {
    return {
      ok: false,
      run: structuredClone(runInput),
      issues: [{ code: "combat-exit-failed", combatIssues: [{ code: "no-active-combat" }] }],
    };
  }

  const exited = exitFateKnotsCombat(storyOutcome.run, {
    combat,
    runtime: context.runtime,
    statuses: context.statuses,
    rules: context.rules,
    resultPackage: context.resultPackage,
    ...(storyOutcome.nextPhase ? { nextPhase: storyOutcome.nextPhase } : {}),
  });
  if (!exited.ok) {
    return {
      ok: false,
      run: structuredClone(runInput),
      issues: [{ code: "combat-exit-failed", combatIssues: exited.issues }],
    };
  }

  if (exited.run.phase === "loot") {
    if (!exited.run.activeStoryTransitionId || !exited.run.activeEncounterId) {
      return {
        ok: false,
        run: structuredClone(runInput),
        issues: [
          { code: "story-cleanup-failed", storyIssues: [{ code: "combat-transition-required" }] },
        ],
      };
    }
    return { ok: true, run: exited.run, issues: [] };
  }

  const cleaned = clearFateKnotsStoryCombatTracking(exited.run);
  if (!cleaned.ok) {
    return {
      ok: false,
      run: structuredClone(runInput),
      issues: [{ code: "story-cleanup-failed", storyIssues: cleaned.issues }],
    };
  }

  return { ok: true, run: cleaned.run, issues: [] };
}
