import type {
  FateKnotsActorState,
  FateKnotsCardDefinition,
  FateKnotsCombatState,
  FateKnotsEquipmentDefinition,
  FateKnotsStatusDefinition,
} from "./contracts.js";
import {
  buildFateKnotsAvailableCardIds,
  evaluateFateKnotsCardLegality,
  type FateKnotsCardCatalog,
} from "./card-legality.js";

const ACTION_KINDS = new Set<FateKnotsCardDefinition["kind"]>([
  "attack",
  "defense",
  "ability",
  "item",
]);

export interface FateKnotsCombatOptionCatalog extends FateKnotsCardCatalog {
  cards: readonly FateKnotsCardDefinition[];
  equipment: readonly FateKnotsEquipmentDefinition[];
  statuses: readonly FateKnotsStatusDefinition[];
}

export interface FateKnotsCombatLegalCardOption {
  cardId: string;
  targetRequired: boolean;
  legalPrimaryTargetIds: string[];
}

export interface FateKnotsCombatLegalOptions {
  actorId: string;
  movementOptions: FateKnotsCombatLegalCardOption[];
  actionOptions: FateKnotsCombatLegalCardOption[];
}

export type FateKnotsCombatOptionsIssueCode =
  "combat-not-active" | "wrong-phase" | "actor-not-found" | "actor-fallen";

export interface FateKnotsCombatOptionsIssue {
  code: FateKnotsCombatOptionsIssueCode;
  actorId?: string;
}

export type FateKnotsCombatOptionsResult =
  | {
      ok: true;
      options: FateKnotsCombatLegalOptions;
      issues: [];
    }
  | {
      ok: false;
      options: null;
      issues: FateKnotsCombatOptionsIssue[];
    };

function getLegalTargets(
  state: FateKnotsCombatState,
  actor: FateKnotsActorState,
  card: FateKnotsCardDefinition,
  catalog: FateKnotsCombatOptionCatalog
): FateKnotsCombatLegalCardOption | null {
  const withoutTarget = evaluateFateKnotsCardLegality(card, {
    phase: "combat-commit",
    actor,
    target: null,
    cards: catalog.cards,
    equipment: catalog.equipment,
    statuses: catalog.statuses,
  });

  if (withoutTarget.legal) {
    return {
      cardId: card.id,
      targetRequired: false,
      legalPrimaryTargetIds: [],
    };
  }

  const legalPrimaryTargetIds = state.actors
    .filter(
      (target) =>
        evaluateFateKnotsCardLegality(card, {
          phase: "combat-commit",
          actor,
          target,
          cards: catalog.cards,
          equipment: catalog.equipment,
          statuses: catalog.statuses,
        }).legal
    )
    .map((target) => target.actorId);

  if (legalPrimaryTargetIds.length === 0) return null;

  return {
    cardId: card.id,
    targetRequired: true,
    legalPrimaryTargetIds,
  };
}

function buildLegalOptions(
  state: FateKnotsCombatState,
  actor: FateKnotsActorState,
  catalog: FateKnotsCombatOptionCatalog,
  slot: "movement" | "action"
): FateKnotsCombatLegalCardOption[] {
  const available = new Set(buildFateKnotsAvailableCardIds(actor, catalog));

  return catalog.cards
    .filter((card) => available.has(card.id))
    .filter((card) =>
      slot === "movement" ? card.kind === "movement" : ACTION_KINDS.has(card.kind)
    )
    .map((card) => getLegalTargets(state, actor, card, catalog))
    .filter((option): option is FateKnotsCombatLegalCardOption => option !== null);
}

/**
 * Low-level shared builder for a caller that has already validated the actor,
 * phase and controller/seat authority. Keeping this logic public prevents the
 * human renderer and AI0 enemy packet from drifting into separate legality
 * algorithms.
 */
export function buildFateKnotsActorCombatLegalOptions(
  state: FateKnotsCombatState,
  actor: FateKnotsActorState,
  catalog: FateKnotsCombatOptionCatalog
): FateKnotsCombatLegalOptions {
  return {
    actorId: actor.actorId,
    movementOptions: buildLegalOptions(state, actor, catalog, "movement"),
    actionOptions: buildLegalOptions(state, actor, catalog, "action"),
  };
}

/**
 * Engine-owned deterministic legality projection shared by human/player and AI0
 * callers. It exposes only currently legal card ids and primary-target ids; it
 * does not expose another actor's commits, ownership or hidden canon.
 *
 * Discussion may preview the same options that would be legal at commit time,
 * but this helper never changes phase or stores a commit. The authority that
 * decides when discussion closes remains outside this read-only helper.
 */
export function buildFateKnotsCombatLegalOptions(
  state: FateKnotsCombatState,
  actorId: string,
  catalog: FateKnotsCombatOptionCatalog
): FateKnotsCombatOptionsResult {
  if (state.result !== "active") {
    return { ok: false, options: null, issues: [{ code: "combat-not-active" }] };
  }
  if (state.phase !== "combat-discussion" && state.phase !== "combat-commit") {
    return { ok: false, options: null, issues: [{ code: "wrong-phase" }] };
  }

  const actor = state.actors.find((candidate) => candidate.actorId === actorId) ?? null;
  if (!actor) {
    return { ok: false, options: null, issues: [{ code: "actor-not-found", actorId }] };
  }
  if (actor.fallen) {
    return { ok: false, options: null, issues: [{ code: "actor-fallen", actorId }] };
  }

  return {
    ok: true,
    options: buildFateKnotsActorCombatLegalOptions(state, actor, catalog),
    issues: [],
  };
}
