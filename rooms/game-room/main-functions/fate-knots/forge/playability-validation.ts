import type { FateKnotsUniversePackage } from "../shared/contracts.js";
import {
  FATE_KNOTS_OPPOSITION_TEMPLATE_TAG,
  FATE_KNOTS_PLAYER_TEMPLATE_TAG,
} from "../shared/run-setup.js";

export type FateKnotsPlayabilityIssueCode =
  | "player-template-missing"
  | "encounter-uses-player-template"
  | "opponent-template-missing-controller"
  | "story-has-no-transition";

export interface FateKnotsPlayabilityIssue {
  code: FateKnotsPlayabilityIssueCode;
  characterId?: string;
  encounterId?: string;
}

export interface FateKnotsPlayabilityValidationResult {
  valid: boolean;
  issues: FateKnotsPlayabilityIssue[];
}

/**
 * Small V1 playability gate layered on structural Universe validation.
 * It intentionally does not score prose, balance or art quality.
 */
export function validateFateKnotsPlayableUniverse(
  universe: FateKnotsUniversePackage
): FateKnotsPlayabilityValidationResult {
  const issues: FateKnotsPlayabilityIssue[] = [];
  const characterById = new Map(universe.characters.map((character) => [character.id, character] as const));
  const playerTemplates = universe.characters.filter((character) =>
    character.tags.includes(FATE_KNOTS_PLAYER_TEMPLATE_TAG)
  );

  if (playerTemplates.length === 0) issues.push({ code: "player-template-missing" });
  if (universe.story.transitions.length === 0) issues.push({ code: "story-has-no-transition" });

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
      if (
        character.tags.includes(FATE_KNOTS_OPPOSITION_TEMPLATE_TAG) &&
        character.combatController == null
      ) {
        issues.push({
          code: "opponent-template-missing-controller",
          encounterId: encounter.id,
          characterId,
        });
      }
    }
  }

  return { valid: issues.length === 0, issues };
}
