import type { FateKnotsUniversePackage } from "../shared/contracts.js";
import { isFateKnotsEnemyPolicyId } from "../shared/enemy-policy.js";
import { FATE_KNOTS_NPC_INTERACTION_TAG_PREFIX } from "../shared/npc-interaction.js";
import { FATE_KNOTS_PLAYER_TEMPLATE_TAG } from "../shared/run-setup.js";

export type FateKnotsPlayabilityIssueCode =
  | "player-template-missing"
  | "encounter-uses-player-template"
  | "encounter-opponent-missing-controller"
  | "encounter-policy-unknown"
  | "story-has-no-transition"
  | "finale-transition-missing"
  | "final-encounter-transition-missing"
  | "camp-transition-location-not-allowed"
  | "camp-transition-destination-not-supported"
  | "npc-interaction-transition-missing"
  | "npc-interaction-location-mismatch";

export interface FateKnotsPlayabilityIssue {
  code: FateKnotsPlayabilityIssueCode;
  characterId?: string;
  encounterId?: string;
  transitionId?: string;
  policyId?: string;
  npcId?: string;
  locationId?: string;
}

export interface FateKnotsPlayabilityValidationResult {
  valid: boolean;
  issues: FateKnotsPlayabilityIssue[];
}

/**
 * Small V1 playability gate layered on structural Universe validation.
 * It intentionally does not score prose, balance or art quality and does not
 * attempt generic graph reachability. Finale transitions are terminal success
 * routes; an optional final encounter is only required to be reachable through
 * an authored combat transition and is not treated as a special runtime phase.
 *
 * Camp is an action taken at the current story knot rather than a travel
 * destination. V1 camp transitions therefore stay at their source knot and that
 * source location must explicitly permit camp. NPC interactions likewise reuse
 * the bounded story graph rather than adding a second quest/social DSL.
 */
export function validateFateKnotsPlayableUniverse(
  universe: FateKnotsUniversePackage
): FateKnotsPlayabilityValidationResult {
  const issues: FateKnotsPlayabilityIssue[] = [];
  const characterById = new Map(
    universe.characters.map((character) => [character.id, character] as const)
  );
  const locationById = new Map(
    universe.locations.map((location) => [location.id, location] as const)
  );
  const knotById = new Map(universe.story.knots.map((knot) => [knot.id, knot] as const));
  const transitionById = new Map(
    universe.story.transitions.map((transition) => [transition.id, transition] as const)
  );
  const playerTemplates = universe.characters.filter((character) =>
    character.tags.includes(FATE_KNOTS_PLAYER_TEMPLATE_TAG)
  );

  if (playerTemplates.length === 0) issues.push({ code: "player-template-missing" });
  if (universe.story.transitions.length === 0) issues.push({ code: "story-has-no-transition" });

  const finaleTransitions = universe.story.transitions.filter(
    (transition) => transition.kind === "finale"
  );
  if (finaleTransitions.length === 0) {
    issues.push({ code: "finale-transition-missing" });
  }

  const finalEncounterId = universe.finale.finalEncounterId ?? null;
  if (finalEncounterId) {
    const finalEncounterTransition = universe.story.transitions.find(
      (transition) => transition.kind === "combat" && transition.encounterId === finalEncounterId
    );
    if (!finalEncounterTransition) {
      issues.push({
        code: "final-encounter-transition-missing",
        encounterId: finalEncounterId,
      });
    }
  }

  for (const transition of universe.story.transitions) {
    if (transition.kind !== "camp") continue;
    if (transition.toKnotId || transition.toLocationId) {
      issues.push({
        code: "camp-transition-destination-not-supported",
        transitionId: transition.id,
      });
    }
    const sourceKnot = knotById.get(transition.fromKnotId);
    const sourceLocationId = sourceKnot?.locationId ?? null;
    const sourceLocation = sourceLocationId ? locationById.get(sourceLocationId) : null;
    if (!sourceLocation || sourceLocation.campAllowed !== true) {
      issues.push({
        code: "camp-transition-location-not-allowed",
        transitionId: transition.id,
        ...(sourceLocationId ? { locationId: sourceLocationId } : {}),
      });
    }
  }

  for (const npc of universe.npcs) {
    for (const tag of npc.roleTags) {
      if (!tag.startsWith(FATE_KNOTS_NPC_INTERACTION_TAG_PREFIX)) continue;
      const transitionId = tag.slice(FATE_KNOTS_NPC_INTERACTION_TAG_PREFIX.length).trim();
      const transition = transitionId ? transitionById.get(transitionId) : undefined;
      if (!transition) {
        issues.push({
          code: "npc-interaction-transition-missing",
          npcId: npc.id,
          transitionId,
        });
        continue;
      }
      const sourceKnot = knotById.get(transition.fromKnotId);
      if (sourceKnot && sourceKnot.locationId !== npc.locationId) {
        issues.push({
          code: "npc-interaction-location-mismatch",
          npcId: npc.id,
          transitionId: transition.id,
          locationId: npc.locationId,
        });
      }
    }
  }

  for (const encounter of universe.story.encounters) {
    for (const characterId of encounter.opponentCharacterIds) {
      const character = characterById.get(characterId);
      if (!character) continue; // Structural validator reports the broken reference.
      if (character.tags.includes(FATE_KNOTS_PLAYER_TEMPLATE_TAG)) {
        issues.push({
          code: "encounter-uses-player-template",
          encounterId: encounter.id,
          characterId,
        });
      }

      const controller = character.combatController ?? null;
      if (!controller) {
        issues.push({
          code: "encounter-opponent-missing-controller",
          encounterId: encounter.id,
          characterId,
        });
        continue;
      }
      if (controller.kind === "policy" && !isFateKnotsEnemyPolicyId(controller.policyId)) {
        issues.push({
          code: "encounter-policy-unknown",
          encounterId: encounter.id,
          characterId,
          policyId: controller.policyId,
        });
      }
    }
  }

  return { valid: issues.length === 0, issues };
}
