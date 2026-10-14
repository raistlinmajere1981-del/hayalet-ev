import type {
  FateKnotsActorState,
  FateKnotsCardDefinition,
  FateKnotsCombatActionCommit,
  FateKnotsCombatState,
  FateKnotsCombatTurnConfig,
  FateKnotsEquipmentDefinition,
  FateKnotsStatusDefinition,
} from "./contracts.js";
import {
  evaluateFateKnotsCardLegality,
  type FateKnotsCardCatalog,
  type FateKnotsCardLegalityIssue,
} from "./card-legality.js";

export type FateKnotsCombatFlowIssueCode =
  | "combat-not-active"
  | "wrong-phase"
  | "actor-not-found"
  | "actor-fallen"
  | "movement-budget-exceeded"
  | "action-budget-exceeded"
  | "movement-card-not-found"
  | "action-card-not-found"
  | "movement-slot-requires-movement-card"
  | "action-slot-requires-action-card"
  | "movement-card-illegal"
  | "action-card-illegal"
  | "commit-incomplete";

export interface FateKnotsCombatFlowIssue {
  code: FateKnotsCombatFlowIssueCode;
  actorId?: string;
  cardId?: string;
  legalityIssues?: FateKnotsCardLegalityIssue[];
}

export interface FateKnotsCombatFlowResult {
  ok: boolean;
  state: FateKnotsCombatState;
  issues: FateKnotsCombatFlowIssue[];
}

export interface FateKnotsCombatCommitCatalog extends FateKnotsCardCatalog {
  cards: readonly FateKnotsCardDefinition[];
  equipment: readonly FateKnotsEquipmentDefinition[];
  statuses: readonly FateKnotsStatusDefinition[];
}

const COMBAT_ACTION_CARD_KINDS = new Set<FateKnotsCardDefinition["kind"]>([
  "attack",
  "defense",
  "ability",
  "item",
]);

function cloneCommit(commit: FateKnotsCombatActionCommit): FateKnotsCombatActionCommit {
  const cloned: FateKnotsCombatActionCommit = {
    actorId: commit.actorId,
    committed: commit.committed,
  };
  if (commit.movementCardId !== undefined) cloned.movementCardId = commit.movementCardId;
  if (commit.actionCardId !== undefined) cloned.actionCardId = commit.actionCardId;
  if (commit.primaryTargetId !== undefined) cloned.primaryTargetId = commit.primaryTargetId;
  if (commit.secondaryTargetId !== undefined) cloned.secondaryTargetId = commit.secondaryTargetId;
  return cloned;
}

function cloneState(state: FateKnotsCombatState): FateKnotsCombatState {
  return {
    ...state,
    config: { ...state.config },
    actors: state.actors.map((actor) => ({
      ...actor,
      position: { ...actor.position },
      ownedCardIds: actor.ownedCardIds.slice(),
      availableCardIds: actor.availableCardIds.slice(),
      equipmentIds: actor.equipmentIds.slice(),
      statusIds: actor.statusIds.slice(),
      injuryIds: actor.injuryIds.slice(),
    })),
    commits: state.commits.map(cloneCommit),
  };
}

function failed(
  state: FateKnotsCombatState,
  issues: FateKnotsCombatFlowIssue[]
): FateKnotsCombatFlowResult {
  return { ok: false, state: cloneState(state), issues };
}

function succeeded(state: FateKnotsCombatState): FateKnotsCombatFlowResult {
  return { ok: true, state: cloneState(state), issues: [] };
}

function getCard(
  cards: readonly FateKnotsCardDefinition[],
  cardId: string | null | undefined
): FateKnotsCardDefinition | null {
  if (!cardId) return null;
  return cards.find((card) => card.id === cardId) ?? null;
}

function getActor(
  actors: readonly FateKnotsActorState[],
  actorId: string
): FateKnotsActorState | null {
  return actors.find((actor) => actor.actorId === actorId) ?? null;
}

function getTarget(
  actors: readonly FateKnotsActorState[],
  actorId: string | null | undefined
): FateKnotsActorState | null {
  if (!actorId) return null;
  return getActor(actors, actorId);
}

function validateCardLegality(
  state: FateKnotsCombatState,
  actor: FateKnotsActorState,
  card: FateKnotsCardDefinition,
  commit: FateKnotsCombatActionCommit,
  catalog: FateKnotsCombatCommitCatalog
): FateKnotsCardLegalityIssue[] {
  const primaryTarget = getTarget(state.actors, commit.primaryTargetId);
  return evaluateFateKnotsCardLegality(card, {
    phase: "combat-commit",
    actor,
    target: primaryTarget,
    cards: catalog.cards,
    equipment: catalog.equipment,
    statuses: catalog.statuses,
  }).issues;
}

function validateCommit(
  state: FateKnotsCombatState,
  commit: FateKnotsCombatActionCommit,
  catalog: FateKnotsCombatCommitCatalog
): FateKnotsCombatFlowIssue[] {
  const issues: FateKnotsCombatFlowIssue[] = [];
  const actor = getActor(state.actors, commit.actorId);

  if (!actor) {
    issues.push({ code: "actor-not-found", actorId: commit.actorId });
    return issues;
  }
  if (actor.fallen) {
    issues.push({ code: "actor-fallen", actorId: commit.actorId });
    return issues;
  }

  const movementCount = commit.movementCardId ? 1 : 0;
  const actionCount = commit.actionCardId ? 1 : 0;
  if (movementCount > state.config.maxMovementCards) {
    issues.push({ code: "movement-budget-exceeded", actorId: commit.actorId });
  }
  if (actionCount > state.config.maxActionCards) {
    issues.push({ code: "action-budget-exceeded", actorId: commit.actorId });
  }

  if (commit.movementCardId) {
    const card = getCard(catalog.cards, commit.movementCardId);
    if (!card) {
      issues.push({
        code: "movement-card-not-found",
        actorId: commit.actorId,
        cardId: commit.movementCardId,
      });
    } else if (card.kind !== "movement") {
      issues.push({
        code: "movement-slot-requires-movement-card",
        actorId: commit.actorId,
        cardId: card.id,
      });
    } else {
      const legalityIssues = validateCardLegality(state, actor, card, commit, catalog);
      if (legalityIssues.length > 0) {
        issues.push({
          code: "movement-card-illegal",
          actorId: commit.actorId,
          cardId: card.id,
          legalityIssues,
        });
      }
    }
  }

  if (commit.actionCardId) {
    const card = getCard(catalog.cards, commit.actionCardId);
    if (!card) {
      issues.push({
        code: "action-card-not-found",
        actorId: commit.actorId,
        cardId: commit.actionCardId,
      });
    } else if (!COMBAT_ACTION_CARD_KINDS.has(card.kind)) {
      issues.push({
        code: "action-slot-requires-action-card",
        actorId: commit.actorId,
        cardId: card.id,
      });
    } else {
      const legalityIssues = validateCardLegality(state, actor, card, commit, catalog);
      if (legalityIssues.length > 0) {
        issues.push({
          code: "action-card-illegal",
          actorId: commit.actorId,
          cardId: card.id,
          legalityIssues,
        });
      }
    }
  }

  return issues;
}

function replaceCommit(
  commits: readonly FateKnotsCombatActionCommit[],
  commit: FateKnotsCombatActionCommit
): FateKnotsCombatActionCommit[] {
  return [
    ...commits.filter((candidate) => candidate.actorId !== commit.actorId).map(cloneCommit),
    cloneCommit(commit),
  ];
}

export function createFateKnotsCombatState(
  combatId: string,
  actors: readonly FateKnotsActorState[],
  config: FateKnotsCombatTurnConfig
): FateKnotsCombatState {
  return {
    combatId,
    turnIndex: 0,
    phase: "combat-discussion",
    config: { ...config },
    actors: actors.map((actor) => ({
      ...actor,
      position: { ...actor.position },
      ownedCardIds: actor.ownedCardIds.slice(),
      availableCardIds: actor.availableCardIds.slice(),
      equipmentIds: actor.equipmentIds.slice(),
      statusIds: actor.statusIds.slice(),
      injuryIds: actor.injuryIds.slice(),
    })),
    commits: [],
    result: "active",
  };
}

export function openFateKnotsCombatCommitPhase(
  state: FateKnotsCombatState
): FateKnotsCombatFlowResult {
  if (state.result !== "active") return failed(state, [{ code: "combat-not-active" }]);
  if (state.phase !== "combat-discussion") return failed(state, [{ code: "wrong-phase" }]);

  const next = cloneState(state);
  next.phase = "combat-commit";
  next.commits = [];
  return succeeded(next);
}

/**
 * Stores one actor's current plan. Re-submitting before resolution replaces the
 * actor's previous plan, preserving the no-timer discussion/commit model.
 */
export function setFateKnotsCombatCommit(
  state: FateKnotsCombatState,
  commit: FateKnotsCombatActionCommit,
  catalog: FateKnotsCombatCommitCatalog
): FateKnotsCombatFlowResult {
  if (state.result !== "active") return failed(state, [{ code: "combat-not-active" }]);
  if (state.phase !== "combat-commit") return failed(state, [{ code: "wrong-phase" }]);

  const normalizedCommit = cloneCommit({ ...commit, committed: true });
  const issues = validateCommit(state, normalizedCommit, catalog);
  if (issues.length > 0) return failed(state, issues);

  const next = cloneState(state);
  next.commits = replaceCommit(next.commits, normalizedCommit);
  return succeeded(next);
}

export function getFateKnotsRequiredCombatCommitActorIds(state: FateKnotsCombatState): string[] {
  return state.actors.filter((actor) => !actor.fallen).map((actor) => actor.actorId);
}

export function isFateKnotsCombatCommitComplete(state: FateKnotsCombatState): boolean {
  const required = getFateKnotsRequiredCombatCommitActorIds(state);
  const committed = new Set(
    state.commits.filter((commit) => commit.committed).map((commit) => commit.actorId)
  );
  return required.every((actorId) => committed.has(actorId));
}

/**
 * Enters resolution only after every currently standing actor has a commit.
 * This function deliberately does not choose initiative/order. Resolution order
 * remains an explicit later rule rather than an accidental array-order rule.
 */
export function beginFateKnotsCombatResolution(
  state: FateKnotsCombatState
): FateKnotsCombatFlowResult {
  if (state.result !== "active") return failed(state, [{ code: "combat-not-active" }]);
  if (state.phase !== "combat-commit") return failed(state, [{ code: "wrong-phase" }]);
  if (!isFateKnotsCombatCommitComplete(state)) {
    return failed(state, [{ code: "commit-incomplete" }]);
  }

  const next = cloneState(state);
  next.phase = "combat-resolution";
  return succeeded(next);
}

export function openFateKnotsCombatAftermath(
  state: FateKnotsCombatState
): FateKnotsCombatFlowResult {
  if (state.result !== "active") return failed(state, [{ code: "combat-not-active" }]);
  if (state.phase !== "combat-resolution") return failed(state, [{ code: "wrong-phase" }]);

  const next = cloneState(state);
  next.phase = "combat-aftermath";
  return succeeded(next);
}

/**
 * Starts the next turn only after aftermath has settled. Terminal combat result
 * evaluation is intentionally handled by the combat authority before calling
 * this function.
 */
export function openNextFateKnotsCombatDiscussion(
  state: FateKnotsCombatState
): FateKnotsCombatFlowResult {
  if (state.result !== "active") return failed(state, [{ code: "combat-not-active" }]);
  if (state.phase !== "combat-aftermath") return failed(state, [{ code: "wrong-phase" }]);

  const next = cloneState(state);
  next.turnIndex += 1;
  next.phase = "combat-discussion";
  next.commits = [];
  return succeeded(next);
}
