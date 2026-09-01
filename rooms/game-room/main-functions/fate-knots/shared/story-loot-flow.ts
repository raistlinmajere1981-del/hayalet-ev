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
  type FateKnotsStoryProgressionIssue,
} from "./story-progression.js";

export type FateKnotsStoryLootIssue =
  | { code: "story-loot-tracking-required" }
  | { code: "loot-decision-failed"; lootIssues: FateKnotsLootDecisionIssue[] }
  | { code: "story-loot-cleanup-failed"; storyIssues: FateKnotsStoryProgressionIssue[] };

export interface FateKnotsStoryLootResult {
  ok: boolean;
  run: FateKnotsRunState;
  nextPhase: "exploration" | "finale" | null;
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
 * allocation consumes the pool, this helper uses those canonical ids to choose
 * the only valid post-loot destination, then clears tracking atomically.
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

  const nextPhase: "exploration" | "finale" =
    universe.finale.finalEncounterId === encounter.id ? "finale" : "exploration";
  const beforeCleanup = structuredClone(resolved.run);
  beforeCleanup.phase = nextPhase;
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
    nextPhase,
    assigned: resolved.assigned,
    leftBehindCardIds: resolved.leftBehindCardIds,
    issues: [],
  };
}
