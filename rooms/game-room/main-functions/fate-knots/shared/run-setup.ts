import {
  FATE_KNOTS_SCHEMA_VERSION,
  type FateKnotsActorState,
  type FateKnotsCharacterDefinition,
  type FateKnotsRunState,
  type FateKnotsSeatId,
  type FateKnotsUniversePackage,
} from "./contracts.js";
import { buildFateKnotsAvailableCardIds } from "./card-legality.js";
import { initializeFateKnotsStoryProgression } from "./story-progression.js";

export const FATE_KNOTS_PLAYER_TEMPLATE_TAG = "player-template";
export const FATE_KNOTS_OPPOSITION_TEMPLATE_TAG = "opposition-template";

export const FATE_KNOTS_V1_PARTY_START_POSITION = Object.freeze({
  row: "front" as const,
  range: "near" as const,
});

export type FateKnotsPlayerSeatId = Extract<FateKnotsSeatId, "user" | "ai2" | "us1">;

export interface FateKnotsRunSetupSelection {
  seatId: FateKnotsPlayerSeatId;
  characterId: string;
}

export interface FateKnotsPlayerTemplateView {
  characterId: string;
  name: string;
  portraitAssetId: string;
  maxHp: number;
  attack: number;
  defense: number;
  speed: number;
  energy: number;
  startingCardIds: string[];
  startingEquipmentIds: string[];
}

export type FateKnotsRunSetupIssueCode =
  | "run-id-required"
  | "user-selection-required"
  | "duplicate-seat-selection"
  | "duplicate-character-selection"
  | "character-not-found"
  | "character-not-player-template"
  | "story-initialization-failed";

export interface FateKnotsRunSetupIssue {
  code: FateKnotsRunSetupIssueCode;
  seatId?: FateKnotsPlayerSeatId;
  characterId?: string;
}

export interface FateKnotsRunSetupResult {
  ok: boolean;
  run: FateKnotsRunState | null;
  issues: FateKnotsRunSetupIssue[];
}

export function listFateKnotsPlayerTemplates(
  universe: FateKnotsUniversePackage
): FateKnotsPlayerTemplateView[] {
  return universe.characters
    .filter((character) => character.tags.includes(FATE_KNOTS_PLAYER_TEMPLATE_TAG))
    .map((character) => ({
      characterId: character.id,
      name: character.name,
      portraitAssetId: character.portraitAssetId,
      maxHp: character.baseStats.maxHp,
      attack: character.baseStats.attack,
      defense: character.baseStats.defense,
      speed: character.baseStats.speed,
      energy: character.baseStats.energy,
      startingCardIds: character.startingCardIds.slice(),
      startingEquipmentIds: character.startingEquipmentIds.slice(),
    }));
}

function buildPartyActor(
  universe: FateKnotsUniversePackage,
  runId: string,
  seatId: FateKnotsPlayerSeatId,
  character: FateKnotsCharacterDefinition
): FateKnotsActorState {
  const actor: FateKnotsActorState = {
    actorId: `${runId}:party:${seatId}`,
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
    position: { ...FATE_KNOTS_V1_PARTY_START_POSITION },
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
 * V1 run setup deliberately chooses complete spoiler-safe character templates.
 * It does not introduce a class/origin point-buy builder before the first
 * playable version. The resulting actors enter the same fixed front+near start
 * position and reposition through normal movement cards.
 */
export function createFateKnotsRunFromSelections(
  universe: FateKnotsUniversePackage,
  runIdInput: string,
  selections: readonly FateKnotsRunSetupSelection[]
): FateKnotsRunSetupResult {
  const runId = runIdInput.trim();
  if (runId === "") return { ok: false, run: null, issues: [{ code: "run-id-required" }] };

  const issues: FateKnotsRunSetupIssue[] = [];
  const seatIds = new Set<FateKnotsPlayerSeatId>();
  const characterIds = new Set<string>();
  const characterById = new Map(
    universe.characters.map((character) => [character.id, character] as const)
  );
  const actors: FateKnotsActorState[] = [];

  for (const selection of selections) {
    const characterId = selection.characterId.trim();
    if (seatIds.has(selection.seatId)) {
      issues.push({ code: "duplicate-seat-selection", seatId: selection.seatId });
      continue;
    }
    seatIds.add(selection.seatId);

    if (characterIds.has(characterId)) {
      issues.push({
        code: "duplicate-character-selection",
        seatId: selection.seatId,
        characterId,
      });
      continue;
    }
    characterIds.add(characterId);

    const character = characterById.get(characterId);
    if (!character) {
      issues.push({ code: "character-not-found", seatId: selection.seatId, characterId });
      continue;
    }
    if (!character.tags.includes(FATE_KNOTS_PLAYER_TEMPLATE_TAG)) {
      issues.push({
        code: "character-not-player-template",
        seatId: selection.seatId,
        characterId,
      });
      continue;
    }
    actors.push(buildPartyActor(universe, runId, selection.seatId, character));
  }

  if (!seatIds.has("user")) issues.push({ code: "user-selection-required" });
  if (issues.length > 0) return { ok: false, run: null, issues };

  const baseRun: FateKnotsRunState = {
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

  const initialized = initializeFateKnotsStoryProgression(universe, baseRun);
  if (!initialized.ok) {
    return { ok: false, run: null, issues: [{ code: "story-initialization-failed" }] };
  }
  const run = initialized.run;
  run.phase = "exploration";
  run.revision += 1;
  return { ok: true, run, issues: [] };
}
