import type {
  FateKnotsActorState,
  FateKnotsCardDefinition,
  FateKnotsCombatActionCommit,
  FateKnotsCombatState,
} from "./contracts.js";
import {
  buildFateKnotsAvailableCardIds,
  evaluateFateKnotsCardLegality,
  getFateKnotsLegalTargetIds,
} from "./card-legality.js";
import type { FateKnotsEnemyControllerCatalog } from "./enemy-controller.js";

export const FATE_KNOTS_ENEMY_POLICY_IDS = ["first-legal"] as const;
export type FateKnotsEnemyPolicyId = (typeof FATE_KNOTS_ENEMY_POLICY_IDS)[number];

const ACTION_KINDS = new Set<FateKnotsCardDefinition["kind"]>([
  "attack",
  "defense",
  "ability",
  "item",
]);

export function isFateKnotsEnemyPolicyId(value: string): value is FateKnotsEnemyPolicyId {
  return (FATE_KNOTS_ENEMY_POLICY_IDS as readonly string[]).includes(value);
}

function getActor(state: FateKnotsCombatState, actorId: string): FateKnotsActorState | null {
  return state.actors.find((actor) => actor.actorId === actorId) ?? null;
}

function sortedAvailableCards(
  actor: FateKnotsActorState,
  catalog: FateKnotsEnemyControllerCatalog,
  slot: "action" | "movement"
): FateKnotsCardDefinition[] {
  const available = new Set(buildFateKnotsAvailableCardIds(actor, catalog));
  return catalog.cards
    .filter((card) => available.has(card.id))
    .filter((card) =>
      slot === "movement" ? card.kind === "movement" : ACTION_KINDS.has(card.kind)
    )
    .slice()
    .sort((left, right) => left.id.localeCompare(right.id));
}

function chooseCard(
  state: FateKnotsCombatState,
  actor: FateKnotsActorState,
  catalog: FateKnotsEnemyControllerCatalog,
  slot: "action" | "movement"
): { cardId: string; primaryTargetId?: string } | null {
  for (const card of sortedAvailableCards(actor, catalog, slot)) {
    const withoutTarget = evaluateFateKnotsCardLegality(card, {
      phase: "combat-commit",
      actor,
      primaryTarget: null,
      cards: catalog.cards,
      equipment: catalog.equipment,
      statuses: catalog.statuses,
    });
    if (withoutTarget.legal) return { cardId: card.id };

    const legalTargets = getFateKnotsLegalTargetIds(
      card,
      {
        phase: "combat-commit",
        actor,
        cards: catalog.cards,
        equipment: catalog.equipment,
        statuses: catalog.statuses,
      },
      state.actors
    ).sort((left, right) => left.localeCompare(right));
    const primaryTargetId = legalTargets[0];
    if (primaryTargetId !== undefined) return { cardId: card.id, primaryTargetId };
  }
  return null;
}

/**
 * V1's only built-in policy is deliberately non-personality-driven. It exists
 * so simple opposition actors always have executable commit authority without
 * requiring AI0. It chooses one slot per turn to avoid inventing separate
 * movement/action target slots in the current commit contract:
 *
 * 1. first legal action by stable card id, then stable target id
 * 2. otherwise first legal movement by stable card id, then stable target id
 * 3. otherwise an explicit empty commit
 */
export function chooseFateKnotsFirstLegalEnemyCommit(
  state: FateKnotsCombatState,
  actorId: string,
  catalog: FateKnotsEnemyControllerCatalog
): FateKnotsCombatActionCommit | null {
  if (state.phase !== "combat-commit" || state.result !== "active") return null;
  const actor = getActor(state, actorId);
  if (!actor || actor.teamId !== "opposition" || actor.fallen) return null;

  const action = chooseCard(state, actor, catalog, "action");
  if (action) {
    return {
      actorId,
      committed: true,
      actionCardId: action.cardId,
      ...(action.primaryTargetId ? { primaryTargetId: action.primaryTargetId } : {}),
    };
  }

  const movement = chooseCard(state, actor, catalog, "movement");
  if (movement) {
    return {
      actorId,
      committed: true,
      movementCardId: movement.cardId,
      ...(movement.primaryTargetId ? { primaryTargetId: movement.primaryTargetId } : {}),
    };
  }

  return { actorId, committed: true };
}

export function chooseFateKnotsPolicyEnemyCommit(
  policyId: string,
  state: FateKnotsCombatState,
  actorId: string,
  catalog: FateKnotsEnemyControllerCatalog
): FateKnotsCombatActionCommit | null {
  if (policyId === "first-legal") {
    return chooseFateKnotsFirstLegalEnemyCommit(state, actorId, catalog);
  }
  return null;
}
