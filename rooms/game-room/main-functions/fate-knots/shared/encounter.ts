import type {
  FateKnotsActorState,
  FateKnotsCombatState,
  FateKnotsCombatTurnConfig,
  FateKnotsEncounterDefinition,
  FateKnotsRunState,
  FateKnotsUniversePackage,
} from "./contracts.js";
import { buildFateKnotsAvailableCardIds } from "./card-legality.js";
import { createFateKnotsCombatState } from "./combat-flow.js";
import {
  createFateKnotsCombatRuntimeState,
  type FateKnotsCombatRuntimeState,
} from "./combat-runtime.js";

export const FATE_KNOTS_V1_ENEMY_START_POSITION = Object.freeze({
  row: "front" as const,
  range: "near" as const,
});

export type FateKnotsEncounterBuildIssueCode =
  | "universe-mismatch"
  | "run-not-active"
  | "active-combat-exists"
  | "encounter-not-active"
  | "encounter-not-found"
  | "party-actor-not-found"
  | "opponent-character-not-found"
  | "actor-id-collision";

export interface FateKnotsEncounterBuildIssue {
  code: FateKnotsEncounterBuildIssueCode;
  actorId?: string;
  characterId?: string;
  encounterId?: string;
}

export interface FateKnotsEncounterBuildResult {
  ok: boolean;
  combat: FateKnotsCombatState | null;
  runtime: FateKnotsCombatRuntimeState | null;
  issues: FateKnotsEncounterBuildIssue[];
}

function cloneActor(actor: FateKnotsActorState): FateKnotsActorState {
  return {
    ...actor,
    position: { ...actor.position },
    ownedCardIds: actor.ownedCardIds.slice(),
    availableCardIds: actor.availableCardIds.slice(),
    equipmentIds: actor.equipmentIds.slice(),
    statusIds: actor.statusIds.slice(),
    injuryIds: actor.injuryIds.slice(),
  };
}

function rebuildAvailableCards(
  actor: FateKnotsActorState,
  universe: FateKnotsUniversePackage
): FateKnotsActorState {
  const next = cloneActor(actor);
  next.availableCardIds = buildFateKnotsAvailableCardIds(next, {
    cards: universe.cards,
    equipment: universe.equipment,
    statuses: universe.statuses,
  });
  return next;
}

/**
 * Creates a complete headless combat from a canonical story encounter.
 * V1 deliberately uses one fixed enemy opening position (`front + near`) rather
 * than adding an encounter-layout DSL before the first playable version.
 */
export function buildFateKnotsEncounterCombat(
  universe: FateKnotsUniversePackage,
  run: FateKnotsRunState,
  encounterId: string,
  combatId: string,
  config: FateKnotsCombatTurnConfig
): FateKnotsEncounterBuildResult {
  if (run.universeId !== universe.universeId) {
    return { ok: false, combat: null, runtime: null, issues: [{ code: "universe-mismatch" }] };
  }
  if (run.result !== "active") {
    return { ok: false, combat: null, runtime: null, issues: [{ code: "run-not-active" }] };
  }
  if (run.activeCombat) {
    return { ok: false, combat: null, runtime: null, issues: [{ code: "active-combat-exists" }] };
  }
  if (run.activeEncounterId !== encounterId || !run.activeStoryTransitionId) {
    return {
      ok: false,
      combat: null,
      runtime: null,
      issues: [{ code: "encounter-not-active", encounterId }],
    };
  }

  const encounter: FateKnotsEncounterDefinition | undefined = universe.story.encounters.find(
    (candidate) => candidate.id === encounterId
  );
  if (!encounter) {
    return {
      ok: false,
      combat: null,
      runtime: null,
      issues: [{ code: "encounter-not-found", encounterId }],
    };
  }

  const issues: FateKnotsEncounterBuildIssue[] = [];
  const actorById = new Map(run.actors.map((actor) => [actor.actorId, actor] as const));
  const partyActors: FateKnotsActorState[] = [];
  for (const actorId of run.partyActorIds) {
    const actor = actorById.get(actorId);
    if (!actor) {
      issues.push({ code: "party-actor-not-found", actorId });
      continue;
    }
    partyActors.push(rebuildAvailableCards(actor, universe));
  }

  const opponentActors: FateKnotsActorState[] = [];
  encounter.opponentCharacterIds.forEach((characterId, index) => {
    const character = universe.characters.find((candidate) => candidate.id === characterId);
    if (!character) {
      issues.push({ code: "opponent-character-not-found", characterId });
      return;
    }
    const actorId = `${encounter.id}:opposition:${index + 1}`;
    if (actorById.has(actorId) || opponentActors.some((actor) => actor.actorId === actorId)) {
      issues.push({ code: "actor-id-collision", actorId });
      return;
    }

    const actor: FateKnotsActorState = {
      actorId,
      characterId: character.id,
      teamId: "opposition",
      hp: character.baseStats.maxHp,
      maxHp: character.baseStats.maxHp,
      attack: character.baseStats.attack,
      defense: character.baseStats.defense,
      speed: character.baseStats.speed,
      energy: character.baseStats.energy,
      fallen: false,
      position: { ...FATE_KNOTS_V1_ENEMY_START_POSITION },
      ownedCardIds: character.startingCardIds.slice(),
      availableCardIds: [],
      equipmentIds: character.startingEquipmentIds.slice(),
      statusIds: [],
      injuryIds: [],
    };
    opponentActors.push(rebuildAvailableCards(actor, universe));
  });

  if (issues.length > 0) {
    return { ok: false, combat: null, runtime: null, issues };
  }

  const combat = createFateKnotsCombatState(combatId.trim(), [...partyActors, ...opponentActors], {
    ...config,
  });
  const runtime = createFateKnotsCombatRuntimeState(combat);
  return { ok: true, combat, runtime, issues: [] };
}
