import type {
  FateKnotsCombatActionCommit,
  FateKnotsCombatState,
  FateKnotsUniversePackage,
} from "../shared/contracts.js";
import { chooseFateKnotsPolicyEnemyCommit } from "../shared/enemy-policy.js";
import { chooseFateKnotsAi0CombatCommit } from "./runtime-ai.js";

export type FateKnotsEnemyCombatCommitAuthorityResult =
  | { ok: true; commit: FateKnotsCombatActionCommit; authority: "policy" | "ai0" }
  | { ok: false; code: "actor-not-found" | "character-not-found" | "controller-missing" | "policy-unavailable" | "ai0-failed" };

/**
 * Single host-side authority router for opposition commits. Encounter validation
 * guarantees a controller exists, but runtime still fails closed if persisted or
 * corrupted state violates that invariant.
 */
export async function chooseFateKnotsEnemyCombatCommit(
  universe: FateKnotsUniversePackage,
  combat: FateKnotsCombatState,
  actorId: string
): Promise<FateKnotsEnemyCombatCommitAuthorityResult> {
  const actor = combat.actors.find((candidate) => candidate.actorId === actorId);
  if (!actor) return { ok: false, code: "actor-not-found" };

  const character = universe.characters.find((candidate) => candidate.id === actor.characterId);
  if (!character) return { ok: false, code: "character-not-found" };

  const controller = character.combatController ?? null;
  if (!controller) return { ok: false, code: "controller-missing" };

  if (controller.kind === "policy") {
    const commit = chooseFateKnotsPolicyEnemyCommit(controller.policyId, combat, actorId, {
      cards: universe.cards,
      equipment: universe.equipment,
      statuses: universe.statuses,
    });
    return commit
      ? { ok: true, commit, authority: "policy" }
      : { ok: false, code: "policy-unavailable" };
  }

  const ai0 = await chooseFateKnotsAi0CombatCommit(universe, combat, actorId);
  return ai0.ok
    ? { ok: true, commit: ai0.commit, authority: "ai0" }
    : { ok: false, code: "ai0-failed" };
}
