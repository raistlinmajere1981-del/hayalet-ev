import type {
  FateKnotsCombatResultPackage,
  FateKnotsRunState,
  FateKnotsStatusDefinition,
  FateKnotsUniversePackage,
} from "./contracts.js";
import type { FateKnotsCombatRuntimeState } from "./combat-runtime.js";
import {
  exitFateKnotsCombat,
  type FateKnotsRunFlowIssue,
} from "./run-flow.js";
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
 * then settles HP/status/runtime state and removes combat. Only after that does
 * story tracking clear its transition/encounter ids. No successful intermediate
 * state violates the restart-safe persistence contract.
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
