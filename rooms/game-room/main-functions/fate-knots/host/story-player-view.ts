import type {
  FateKnotsRunState,
  FateKnotsStoryTransitionKind,
  FateKnotsUniversePackage,
} from "../shared/contracts.js";
import { buildFateKnotsStoryView } from "../shared/story-progression.js";

export interface FateKnotsPlayerStoryTransition {
  transitionId: string;
  label: string;
  kind: FateKnotsStoryTransitionKind;
}

export interface FateKnotsPlayerStoryView {
  runId: string;
  revision: number;
  visibleFacts: string[];
  availableTransitions: FateKnotsPlayerStoryTransition[];
}

/**
 * Small spoiler-safe story projection shared by local renderer and future US1
 * transport. It deliberately excludes hidden knot ids, transition requirements,
 * progression patches, encounters and finale internals.
 */
export function buildFateKnotsPlayerStoryView(
  universe: FateKnotsUniversePackage,
  run: FateKnotsRunState
): FateKnotsPlayerStoryView {
  const story = buildFateKnotsStoryView(universe, run);
  return {
    runId: run.runId,
    revision: run.revision,
    visibleFacts: story.visibleFacts.slice(),
    availableTransitions: story.availableTransitions.map((transition) => ({
      transitionId: transition.id,
      label: transition.label,
      kind: transition.kind,
    })),
  };
}
