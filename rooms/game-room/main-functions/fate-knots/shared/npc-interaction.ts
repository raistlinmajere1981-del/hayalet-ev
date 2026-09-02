import type {
  FateKnotsRunState,
  FateKnotsStoryTransitionKind,
  FateKnotsUniversePackage,
} from "./contracts.js";
import { getFateKnotsLegalStoryTransitions } from "./story-progression.js";

export const FATE_KNOTS_NPC_INTERACTION_TAG_PREFIX = "interaction:";

export interface FateKnotsNpcInteractionOption {
  id: string;
  label: string;
  kind: FateKnotsStoryTransitionKind;
}

export type FateKnotsNpcInteractionIssueCode =
  | "universe-run-mismatch"
  | "run-not-active"
  | "exploration-phase-required"
  | "npc-not-found"
  | "npc-not-at-active-location";

export interface FateKnotsNpcInteractionIssue {
  code: FateKnotsNpcInteractionIssueCode;
  npcId?: string;
}

export type FateKnotsNpcInteractionOptionsResult =
  | { ok: true; options: FateKnotsNpcInteractionOption[]; issues: [] }
  | { ok: false; options: []; issues: FateKnotsNpcInteractionIssue[] };

function interactionIdsFromRoleTags(roleTags: readonly string[]): string[] {
  return Array.from(
    new Set(
      roleTags
        .filter((tag) => tag.startsWith(FATE_KNOTS_NPC_INTERACTION_TAG_PREFIX))
        .map((tag) => tag.slice(FATE_KNOTS_NPC_INTERACTION_TAG_PREFIX.length).trim())
        .filter(Boolean)
    )
  );
}

/**
 * Returns the bounded mechanical interactions an NPC may propose right now.
 *
 * V1 deliberately reuses canonical story transitions instead of adding a second
 * social/quest scripting language. World Forge binds an NPC to authored story
 * transitions through roleTags such as `interaction:ask-warden-about-pass`.
 * Runtime intersects those ids with the engine's currently legal transitions.
 *
 * AI0 may select one id as a proposal in dialogue, but the selection does not
 * mutate canon. If the proposal advances the story, active player seats still
 * choose that same canonical transition through exploration consensus.
 */
export function getFateKnotsNpcInteractionOptions(
  universe: FateKnotsUniversePackage,
  run: FateKnotsRunState,
  npcId: string
): FateKnotsNpcInteractionOptionsResult {
  if (universe.universeId !== run.universeId) {
    return { ok: false, options: [], issues: [{ code: "universe-run-mismatch" }] };
  }
  if (run.result !== "active") {
    return { ok: false, options: [], issues: [{ code: "run-not-active" }] };
  }
  if (run.phase !== "exploration") {
    return { ok: false, options: [], issues: [{ code: "exploration-phase-required" }] };
  }
  const npc = universe.npcs.find((entry) => entry.id === npcId);
  if (!npc) return { ok: false, options: [], issues: [{ code: "npc-not-found", npcId }] };
  if (npc.locationId !== run.activeLocationId) {
    return {
      ok: false,
      options: [],
      issues: [{ code: "npc-not-at-active-location", npcId }],
    };
  }

  const authoredIds = new Set(interactionIdsFromRoleTags(npc.roleTags));
  const options = getFateKnotsLegalStoryTransitions(universe, run)
    .filter((transition) => authoredIds.has(transition.id))
    .map((transition) => ({
      id: transition.id,
      label: transition.label,
      kind: transition.kind,
    }));
  return { ok: true, options, issues: [] };
}
