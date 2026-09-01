import { buildFateKnotsAvailableCardIds } from "../shared/card-legality.js";
import {
  FATE_KNOTS_SCHEMA_VERSION,
  type FateKnotsActorState,
  type FateKnotsCharacterDefinition,
  type FateKnotsRunState,
  type FateKnotsSeatId,
  type FateKnotsUniversePackage,
} from "../shared/contracts.js";

export const FATE_KNOTS_PLAYER_SEAT_IDS = ["user", "ai2", "us1"] as const;
export type FateKnotsPlayerSeatId = (typeof FATE_KNOTS_PLAYER_SEAT_IDS)[number];

export interface FateKnotsRunPartyAssignment {
  seatId: FateKnotsPlayerSeatId;
  characterId: string;
}

export interface FateKnotsCreateRunRequest {
  runId: string;
  party: FateKnotsRunPartyAssignment[];
}

export type FateKnotsRunSetupIssueCode =
  | "invalid-run-id"
  | "missing-local-player"
  | "invalid-player-seat"
  | "duplicate-player-seat"
  | "duplicate-character"
  | "character-not-found"
  | "character-not-player-selectable"
  | "run-universe-mismatch"
  | "run-not-active"
  | "run-not-in-setup"
  | "start-node-not-found"
  | "start-location-not-found";

export interface FateKnotsRunSetupIssue {
  code: FateKnotsRunSetupIssueCode;
  seatId?: FateKnotsSeatId;
  characterId?: string;
  value?: string;
}

export type FateKnotsRunSetupResult =
  | { ok: true; run: FateKnotsRunState; issues: [] }
  | { ok: false; run: null; issues: FateKnotsRunSetupIssue[] };

function unique(values: readonly string[]): string[] {
  return Array.from(new Set(values));
}

function isPlayerSeatId(value: unknown): value is FateKnotsPlayerSeatId {
  return value === "user" || value === "ai2" || value === "us1";
}

function buildPartyActor(
  seatId: FateKnotsPlayerSeatId,
  character: FateKnotsCharacterDefinition,
  universe: FateKnotsUniversePackage
): FateKnotsActorState {
  const actor: FateKnotsActorState = {
    actorId: `player:${seatId}`,
    characterId: character.id,
    seatId,
    teamId: "party",
    hp: character.baseStats.maxHp,
    maxHp: character.baseStats.maxHp,
    attack: character.baseStats.attack,
    defense: character.baseStats.defense,
    speed: character.baseStats.speed,
    energy: character.baseStats.energy,
    fallen: false,
    position: { ...character.startingPosition },
    ownedCardIds: character.startingCardIds.slice(),
    availableCardIds: [],
    equipmentIds: character.startingEquipmentIds.slice(),
    statusIds: [],
    injuryIds: [],
  };

  actor.availableCardIds = buildFateKnotsAvailableCardIds(actor, {
    cards: universe.cards,
    equipment: universe.equipment,
    statuses: universe.statuses,
  });
  return actor;
}

/**
 * Creates the canonical run shell after player-character choices are locked.
 *
 * World state is intentionally not revealed here. A run remains in run-setup
 * until startFateKnotsRun explicitly opens the canonical start node.
 */
export function createFateKnotsRunFromSetup(
  universe: FateKnotsUniversePackage,
  request: FateKnotsCreateRunRequest
): FateKnotsRunSetupResult {
  const issues: FateKnotsRunSetupIssue[] = [];
  const runId = request.runId.trim();
  if (!runId) issues.push({ code: "invalid-run-id" });

  const seenSeats = new Set<FateKnotsPlayerSeatId>();
  const seenCharacters = new Set<string>();
  const characterById = new Map(
    universe.characters.map((character) => [character.id, character] as const)
  );
  const acceptedAssignments: Array<{
    seatId: FateKnotsPlayerSeatId;
    character: FateKnotsCharacterDefinition;
  }> = [];

  request.party.forEach((assignment) => {
    if (!isPlayerSeatId(assignment.seatId)) {
      issues.push({
        code: "invalid-player-seat",
        seatId: assignment.seatId,
      });
      return;
    }
    if (seenSeats.has(assignment.seatId)) {
      issues.push({ code: "duplicate-player-seat", seatId: assignment.seatId });
      return;
    }
    seenSeats.add(assignment.seatId);

    const characterId = assignment.characterId.trim();
    if (seenCharacters.has(characterId)) {
      issues.push({ code: "duplicate-character", seatId: assignment.seatId, characterId });
      return;
    }
    seenCharacters.add(characterId);

    const character = characterById.get(characterId);
    if (!character) {
      issues.push({ code: "character-not-found", seatId: assignment.seatId, characterId });
      return;
    }
    if (character.playerSelectable !== true) {
      issues.push({
        code: "character-not-player-selectable",
        seatId: assignment.seatId,
        characterId,
      });
      return;
    }
    acceptedAssignments.push({ seatId: assignment.seatId, character });
  });

  if (!seenSeats.has("user")) issues.push({ code: "missing-local-player", seatId: "user" });
  if (issues.length > 0) return { ok: false, run: null, issues };

  const actors = acceptedAssignments.map(({ seatId, character }) =>
    buildPartyActor(seatId, character, universe)
  );

  const run: FateKnotsRunState = {
    schemaVersion: FATE_KNOTS_SCHEMA_VERSION,
    runId,
    universeId: universe.universeId,
    phase: "run-setup",
    revision: 0,
    activeLocationId: null,
    activeKnotId: null,
    activeStoryTransitionId: null,
    activeEncounterId: null,
    revealedLocationIds: [],
    revealedKnotIds: [],
    completedKnotIds: [],
    partyActorIds: actors.map((actor) => actor.actorId),
    actors,
    teamPoolItemIds: [],
    activeCombat: null,
    finaleUnlocked: false,
    result: "active",
  };

  return { ok: true, run, issues: [] };
}

/**
 * Opens the accepted universe for play without guessing a starting location.
 * Only Forge-authored map visibility is applied, plus the active start node
 * itself which must necessarily be visible once the run begins there.
 */
export function startFateKnotsRun(
  universe: FateKnotsUniversePackage,
  runInput: FateKnotsRunState
): FateKnotsRunSetupResult {
  if (runInput.universeId !== universe.universeId) {
    return {
      ok: false,
      run: null,
      issues: [{ code: "run-universe-mismatch", value: runInput.universeId }],
    };
  }
  if (runInput.result !== "active") {
    return { ok: false, run: null, issues: [{ code: "run-not-active" }] };
  }
  if (runInput.phase !== "run-setup" || runInput.activeCombat !== null) {
    return { ok: false, run: null, issues: [{ code: "run-not-in-setup" }] };
  }

  const startNode = universe.map.nodes.find((node) => node.id === universe.map.startNodeId);
  if (!startNode) {
    return {
      ok: false,
      run: null,
      issues: [{ code: "start-node-not-found", value: universe.map.startNodeId }],
    };
  }
  if (!universe.locations.some((location) => location.id === startNode.locationId)) {
    return {
      ok: false,
      run: null,
      issues: [{ code: "start-location-not-found", value: startNode.locationId }],
    };
  }

  const initiallyRevealedLocationIds = universe.map.nodes
    .filter((node) => node.initiallyRevealed)
    .map((node) => node.locationId);

  const run: FateKnotsRunState = {
    ...runInput,
    phase: "exploration",
    revision: runInput.revision + 1,
    activeLocationId: startNode.locationId,
    revealedLocationIds: unique([...initiallyRevealedLocationIds, startNode.locationId]),
    revealedKnotIds: runInput.revealedKnotIds.slice(),
    completedKnotIds: runInput.completedKnotIds.slice(),
    partyActorIds: runInput.partyActorIds.slice(),
    actors: runInput.actors.map((actor) => ({
      ...actor,
      position: { ...actor.position },
      ownedCardIds: actor.ownedCardIds.slice(),
      availableCardIds: actor.availableCardIds.slice(),
      equipmentIds: actor.equipmentIds.slice(),
      statusIds: actor.statusIds.slice(),
      injuryIds: actor.injuryIds.slice(),
    })),
    teamPoolItemIds: runInput.teamPoolItemIds.slice(),
  };

  return { ok: true, run, issues: [] };
}
