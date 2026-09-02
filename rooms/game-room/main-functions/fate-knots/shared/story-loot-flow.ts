import type {
  FateKnotsCardDefinition,
  FateKnotsRunState,
  FateKnotsUniversePackage,
} from "./contracts.js";
import {
  resolveFateKnotsLootDecision,
  type FateKnotsLootDecision,
  type FateKnotsLootDecisionIssue,
} from "./loot.js";
import {
  clearFateKnotsStoryCombatTracking,
  computeFateKnotsFinaleUnlocked,
  type FateKnotsStoryProgressionIssue,
} from "./story-progression.js";

export type FateKnotsStoryLootIssue =
  | { code: "story-loot-tracking-required" }
  | { code: "loot-decision-failed"; lootIssues: FateKnotsLootDecisionIssue[] }
  | { code: "story-loot-cleanup-failed"; storyIssues: FateKnotsStoryProgressionIssue[] };

export interface FateKnotsStoryLootResult {
  ok: boolean;
  run: FateKnotsRunState;
  nextPhase: "exploration" | null;
  assigned: Array<{
    poolIndex: number;
    cardId: string;
    recipientActorId: string;
  }>;
  leftBehindCardIds: string[];
  issues: FateKnotsStoryLootIssue[];
}

function fail(run: FateKnotsRunState, issue: FateKnotsStoryLootIssue): FateKnotsStoryLootResult {
  return {
    ok: false,
    run: structuredClone(run),
    nextPhase: null,
    assigned: [],
    leftBehindCardIds: [],
    issues: [issue],
  };
}

/**
 * Canonical story-encounter loot settlement. Combat exit leaves the source
 * transition/encounter ids attached while loot is pending. Once the unanimous
 * allocation consumes the pool, this helper returns the run to normal
 * exploration at the already-applied combat destination and clears tracking
 * atomically.
 *
 * `finalEncounterId` is only optional scenario metadata in V1. Winning that
 * encounter, with or without loot, never creates a privileged finale phase and
 * never completes the run by itself. If the victory or newly assigned loot
 * satisfied objective prerequisites, the ordinary exploration story resolver
 * may expose an authored terminal `finale` transition afterwards.
 */
export function resolveFateKnotsStoryLootDecision(
  universe: FateKnotsUniversePackage,
  runInput: FateKnotsRunState,
  decision: FateKnotsLootDecision,
  cards: readonly FateKnotsCardDefinition[] = universe.cards
): FateKnotsStoryLootResult {
  if (
    runInput.phase !== "loot" ||
    !runInput.activeStoryTransitionId ||
    !runInput.activeEncounterId
  ) {
    return fail(runInput, { code: "story-loot-tracking-required" });
  }

  const transition = universe.story.transitions.find(
    (candidate) => candidate.id === runInput.activeStoryTransitionId
  );
  const encounter = universe.story.encounters.find(
    (candidate) => candidate.id === runInput.activeEncounterId
  );
  if (
    !transition ||
    transition.kind !== "combat" ||
    !encounter ||
    transition.encounterId !== encounter.id
  ) {
    return fail(runInput, { code: "story-loot-tracking-required" });
  }

  const resolved = resolveFateKnotsLootDecision(runInput, decision, cards);
  if (!resolved.ok) {
    return fail(runInput, { code: "loot-decision-failed", lootIssues: resolved.issues });
  }

  const beforeCleanup = structuredClone(resolved.run);
  beforeCleanup.phase = "exploration";
  beforeCleanup.finaleUnlocked = computeFateKnotsFinaleUnlocked(universe, beforeCleanup);
  const cleaned = clearFateKnotsStoryCombatTracking(beforeCleanup);
  if (!cleaned.ok) {
    return fail(runInput, {
      code: "story-loot-cleanup-failed",
      storyIssues: cleaned.issues,
    });
  }

  return {
    ok: true,
    run: cleaned.run,
    nextPhase: "exploration",
    assigned: resolved.assigned,
    leftBehindCardIds: resolved.leftBehindCardIds,
    issues: [],
  };
}
