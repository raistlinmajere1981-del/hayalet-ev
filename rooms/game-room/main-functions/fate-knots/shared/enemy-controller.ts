import type {
  FateKnotsActorState,
  FateKnotsCardDefinition,
  FateKnotsCombatActionCommit,
  FateKnotsCombatState,
  FateKnotsEnemyControllerDefinition,
  FateKnotsPosition,
  FateKnotsStatusDefinition,
  FateKnotsEquipmentDefinition,
  FateKnotsTeamId,
} from "./contracts.js";
import {
  buildFateKnotsActorCombatLegalOptions,
  type FateKnotsCombatLegalCardOption,
  type FateKnotsCombatOptionCatalog,
} from "./combat-options.js";

export interface FateKnotsEnemyVisibleActorState {
  actorId: string;
  teamId: FateKnotsTeamId;
  hp: number;
  maxHp: number;
  fallen: boolean;
  position: FateKnotsPosition;
  statusIds: string[];
  injuryIds: string[];
}

export type FateKnotsEnemyLegalCardOption = FateKnotsCombatLegalCardOption;

export interface FateKnotsAi0CombatDecisionRequest {
  combatId: string;
  turnIndex: number;
  actorId: string;
  ownActor: FateKnotsEnemyVisibleActorState;
  visibleActors: FateKnotsEnemyVisibleActorState[];
  movementOptions: FateKnotsEnemyLegalCardOption[];
  actionOptions: FateKnotsEnemyLegalCardOption[];
}

export interface FateKnotsEnemyDecision {
  actorId: string;
  movementCardId?: string | null;
  actionCardId?: string | null;
  primaryTargetId?: string | null;
  secondaryTargetId?: string | null;
}

export type FateKnotsEnemyControllerIssueCode =
  | "wrong-phase"
  | "actor-not-found"
  | "actor-not-opposition"
  | "actor-fallen"
  | "controller-not-ai0";

export interface FateKnotsEnemyControllerIssue {
  code: FateKnotsEnemyControllerIssueCode;
  actorId?: string;
}

export interface FateKnotsAi0RequestBuildResult {
  ok: boolean;
  request: FateKnotsAi0CombatDecisionRequest | null;
  issues: FateKnotsEnemyControllerIssue[];
}

export interface FateKnotsEnemyControllerCatalog extends FateKnotsCombatOptionCatalog {
  cards: readonly FateKnotsCardDefinition[];
  equipment: readonly FateKnotsEquipmentDefinition[];
  statuses: readonly FateKnotsStatusDefinition[];
}

function toVisibleActor(actor: FateKnotsActorState): FateKnotsEnemyVisibleActorState {
  return {
    actorId: actor.actorId,
    teamId: actor.teamId,
    hp: actor.hp,
    maxHp: actor.maxHp,
    fallen: actor.fallen,
    position: { ...actor.position },
    statusIds: actor.statusIds.slice(),
    injuryIds: actor.injuryIds.slice(),
  };
}

export function isFateKnotsAi0EnemyController(
  controller: FateKnotsEnemyControllerDefinition
): controller is Extract<FateKnotsEnemyControllerDefinition, { kind: "ai0" }> {
  return controller.kind === "ai0";
}

/**
 * Builds the complete combat packet AI0 is allowed to see when choosing an NPC
 * enemy move.
 *
 * Deliberately absent from this contract:
 * - player/AI2/US1 committed cards
 * - hidden pending targets
 * - hidden world/canon facts
 * - engine outcome calculations
 *
 * AI0 and player-facing option surfaces use the same shared deterministic
 * legality option builder. The returned decision must still be revalidated by
 * the normal commit/legality path.
 */
export function buildFateKnotsAi0CombatDecisionRequest(
  state: FateKnotsCombatState,
  actorId: string,
  controller: FateKnotsEnemyControllerDefinition,
  catalog: FateKnotsEnemyControllerCatalog
): FateKnotsAi0RequestBuildResult {
  if (state.phase !== "combat-commit") {
    return { ok: false, request: null, issues: [{ code: "wrong-phase" }] };
  }

  const actor = state.actors.find((candidate) => candidate.actorId === actorId);
  if (!actor) {
    return { ok: false, request: null, issues: [{ code: "actor-not-found", actorId }] };
  }
  if (actor.teamId !== "opposition") {
    return { ok: false, request: null, issues: [{ code: "actor-not-opposition", actorId }] };
  }
  if (actor.fallen) {
    return { ok: false, request: null, issues: [{ code: "actor-fallen", actorId }] };
  }
  if (!isFateKnotsAi0EnemyController(controller)) {
    return { ok: false, request: null, issues: [{ code: "controller-not-ai0", actorId }] };
  }

  const legalOptions = buildFateKnotsActorCombatLegalOptions(state, actor, catalog);

  return {
    ok: true,
    request: {
      combatId: state.combatId,
      turnIndex: state.turnIndex,
      actorId,
      ownActor: toVisibleActor(actor),
      visibleActors: state.actors.map(toVisibleActor),
      movementOptions: legalOptions.movementOptions,
      actionOptions: legalOptions.actionOptions,
    },
    issues: [],
  };
}

/**
 * Converts a controller choice into the same commit shape used by human/player
 * agents. It does not validate or store the commit; normal combat-flow does so.
 */
export function toFateKnotsEnemyCombatCommit(
  decision: FateKnotsEnemyDecision
): FateKnotsCombatActionCommit {
  const commit: FateKnotsCombatActionCommit = {
    actorId: decision.actorId,
    committed: true,
  };
  if (decision.movementCardId !== undefined) commit.movementCardId = decision.movementCardId;
  if (decision.actionCardId !== undefined) commit.actionCardId = decision.actionCardId;
  if (decision.primaryTargetId !== undefined) commit.primaryTargetId = decision.primaryTargetId;
  if (decision.secondaryTargetId !== undefined) commit.secondaryTargetId = decision.secondaryTargetId;
  return commit;
}

export interface FateKnotsPolicyControllerContext {
  controller: Extract<FateKnotsEnemyControllerDefinition, { kind: "policy" }>;
  combatId: string;
  turnIndex: number;
  actorId: string;
}

/**
 * Policy selection is intentionally only a contract here. Individual policy
 * heuristics (aggressive melee, defensive ranged, protector, etc.) are content
 * and balancing decisions and must be implemented as explicit deterministic
 * policy modules rather than silently improvised by the engine.
 */
export function createFateKnotsPolicyControllerContext(
  state: FateKnotsCombatState,
  actorId: string,
  controller: Extract<FateKnotsEnemyControllerDefinition, { kind: "policy" }>
): FateKnotsPolicyControllerContext {
  return {
    controller,
    combatId: state.combatId,
    turnIndex: state.turnIndex,
    actorId,
  };
}
