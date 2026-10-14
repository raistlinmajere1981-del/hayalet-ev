import type {
  FateKnotsCombatResultPackage,
  FateKnotsDmScenePacket,
  FateKnotsRunState,
  FateKnotsUniversePackage,
} from "./contracts.js";
import { buildFateKnotsDmScenePacket, type FateKnotsDmPacketIssue } from "./dm-packets.js";
import { buildFateKnotsStoryView } from "./story-progression.js";

export interface FateKnotsCanonicalDmScenePacketResult {
  ok: boolean;
  packet: FateKnotsDmScenePacket | null;
  issues: FateKnotsDmPacketIssue[] | Array<{ code: "universe-mismatch" }>;
}

/**
 * The runtime DM never receives caller-authored visible facts or transition ids.
 * Those fields are derived from the canonical story graph and current run state.
 */
export function buildFateKnotsCanonicalDmScenePacket(
  universe: FateKnotsUniversePackage,
  run: FateKnotsRunState,
  engineResultSummary: FateKnotsCombatResultPackage | null = null
): FateKnotsCanonicalDmScenePacketResult {
  if (universe.universeId !== run.universeId) {
    return { ok: false, packet: null, issues: [{ code: "universe-mismatch" }] };
  }

  const storyView = buildFateKnotsStoryView(universe, run);
  const built = buildFateKnotsDmScenePacket(run, {
    visibleFacts: storyView.visibleFacts,
    availableTransitionIds: storyView.availableTransitions.map((transition) => transition.id),
    engineResultSummary,
  });
  return built;
}
