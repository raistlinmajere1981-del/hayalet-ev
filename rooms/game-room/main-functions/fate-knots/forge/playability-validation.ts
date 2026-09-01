import type { FateKnotsUniversePackage } from "../shared/contracts.js";
import { isFateKnotsEnemyPolicyId } from "../shared/enemy-policy.js";
import { FATE_KNOTS_PLAYER_TEMPLATE_TAG } from "../shared/run-setup.js";

export type FateKnotsPlayabilityIssueCode =
  | "player-template-missing"
  | "encounter-uses-player-template"
  | "encounter-opponent-missing-controller"
  | "encounter-policy-unknown"
  | "story-has-no-transition"
  | "finale-transition-missing"
  | "final-encounter-transition-missing";

export interface FateKnotsPlayabilityIssue {
  code: FateKnotsPlayabilityIssueCode;
  characterId?: string;
  encounterId?: string;
  transitionId?: string;
  policyId?: string;
}

export interface FateKnotsPlayabilityValidationResult {
  valid: boolean;
  issues: FateKnotsPlayabilityIssue[];
}

/**
 * Small V1 playability gate layered on structural Universe validation.
 * It intentionally does not score prose, balance or art quality and does not
 * attempt generic graph reachability. The finale check only protects the fixed
 * V1 entry shape from an obvious dead end.
 */
export function validateFateKnotsPlayableUniverse(
  universe: FateKnotsUniversePackage
): FateKnotsPlayabilityValidationResult {
  const issues: FateKnotsPlayabilityIssue[] = [];
  const characterById = new Map(
    universe.characters.map((character) => [character.id, character] as const)
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
    const finaleEntryKnotIds = new Set(
      finaleTransitions.map((transition) => transition.toKnotId ?? transition.fromKnotId)
    );
    const finalEncounterTransition = universe.story.transitions.find(
      (transition) =>
        transition.kind === "combat" &&
        transition.encounterId === finalEncounterId &&
        finaleEntryKnotIds.has(transition.fromKnotId)
    );
    if (!finalEncounterTransition) {
      issues.push({
        code: "final-encounter-transition-missing",
        encounterId: finalEncounterId,
      });
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
