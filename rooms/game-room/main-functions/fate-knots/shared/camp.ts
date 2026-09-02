import { buildFateKnotsAvailableCardIds } from "./card-legality.js";
import type {
  FateKnotsActorState,
  FateKnotsRunState,
  FateKnotsUniversePackage,
} from "./contracts.js";

export type FateKnotsCampIssueCode =
  | "universe-run-mismatch"
  | "run-not-active"
  | "camp-phase-required"
  | "active-combat-exists"
  | "camp-location-missing"
  | "camp-location-not-allowed"
  | "party-actor-not-found"
  | "character-not-found"
  | "equipment-not-found"
  | "equipment-slot-mismatch"
  | "equipment-card-not-owned";

export interface FateKnotsCampIssue {
  code: FateKnotsCampIssueCode;
  actorId?: string;
  characterId?: string;
  equipmentId?: string;
  slot?: string;
}

export interface FateKnotsCampMutationResult {
  ok: boolean;
  run: FateKnotsRunState;
  changed: boolean;
  issues: FateKnotsCampIssue[];
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

function cloneRun(run: FateKnotsRunState): FateKnotsRunState {
  return {
    ...run,
    revealedLocationIds: run.revealedLocationIds.slice(),
    revealedKnotIds: run.revealedKnotIds.slice(),
    completedKnotIds: run.completedKnotIds.slice(),
    partyActorIds: run.partyActorIds.slice(),
    actors: run.actors.map(cloneActor),
    teamPoolItemIds: run.teamPoolItemIds.slice(),
    activeCombat: run.activeCombat ? structuredClone(run.activeCombat) : null,
  };
}

function fail(run: FateKnotsRunState, issue: FateKnotsCampIssue): FateKnotsCampMutationResult {
  return { ok: false, run: cloneRun(run), changed: false, issues: [issue] };
}

function validateCampContext(
  universe: FateKnotsUniversePackage,
  run: FateKnotsRunState
): FateKnotsCampIssue | null {
  if (run.universeId !== universe.universeId) return { code: "universe-run-mismatch" };
  if (run.result !== "active") return { code: "run-not-active" };
  if (run.phase !== "camp") return { code: "camp-phase-required" };
  if (run.activeCombat) return { code: "active-combat-exists" };
  if (!run.activeLocationId) return { code: "camp-location-missing" };
  const location = universe.locations.find((entry) => entry.id === run.activeLocationId);
  if (!location) return { code: "camp-location-missing" };
  if (location.campAllowed !== true) return { code: "camp-location-not-allowed" };
  return null;
}

/**
 * Applies the intentionally small V1 camp recovery rule.
 *
 * Camp is not a resource-management simulation. Party actors recover to full HP
 * and their authored base energy, and fallen actors stand up. Persistent
 * statuses and injuries are deliberately preserved; they require explicit
 * authored removal mechanics.
 *
 * The operation is idempotent. Re-reading/re-entering an already settled camp
 * does not keep incrementing run revision.
 */
export function settleFateKnotsCampRecovery(
  universe: FateKnotsUniversePackage,
  runInput: FateKnotsRunState
): FateKnotsCampMutationResult {
  const contextIssue = validateCampContext(universe, runInput);
  if (contextIssue) return fail(runInput, contextIssue);

  const run = cloneRun(runInput);
  const partyIds = new Set(run.partyActorIds);
  let changed = false;

  for (const actorId of run.partyActorIds) {
    const actor = run.actors.find((entry) => entry.actorId === actorId);
    if (!actor) return fail(runInput, { code: "party-actor-not-found", actorId });
    const character = universe.characters.find((entry) => entry.id === actor.characterId);
    if (!character) {
      return fail(runInput, {
        code: "character-not-found",
        actorId,
        characterId: actor.characterId,
      });
    }

    const nextHp = actor.maxHp;
    const nextEnergy = character.baseStats.energy;
    if (actor.hp !== nextHp || actor.energy !== nextEnergy || actor.fallen) changed = true;
    actor.hp = nextHp;
    actor.energy = nextEnergy;
    actor.fallen = false;
  }

  // Non-party actors are not camp participants and remain untouched.
  run.actors = run.actors.map((actor) => (partyIds.has(actor.actorId) ? actor : cloneActor(actor)));
  if (changed) run.revision += 1;
  return { ok: true, run, changed, issues: [] };
}

/**
 * Changes one party actor's equipment only while camp is active.
 *
 * Physical ownership remains card-based: an equipment definition may be equipped
 * only when the actor owns at least one equipment card whose sourceId references
 * that definition. Slot replacement is deterministic and automatically rebuilds
 * the actor's available card set.
 */
export function setFateKnotsCampEquipment(
  universe: FateKnotsUniversePackage,
  runInput: FateKnotsRunState,
  actorId: string,
  slotInput: string,
  equipmentId: string | null
): FateKnotsCampMutationResult {
  const contextIssue = validateCampContext(universe, runInput);
  if (contextIssue) return fail(runInput, contextIssue);

  const slot = slotInput.trim();
  const run = cloneRun(runInput);
  if (!run.partyActorIds.includes(actorId)) {
    return fail(runInput, { code: "party-actor-not-found", actorId });
  }
  const actor = run.actors.find((entry) => entry.actorId === actorId);
  if (!actor) return fail(runInput, { code: "party-actor-not-found", actorId });

  let nextEquipmentId: string | null = null;
  if (equipmentId !== null) {
    const definition = universe.equipment.find((entry) => entry.id === equipmentId);
    if (!definition) return fail(runInput, { code: "equipment-not-found", actorId, equipmentId });
    if (definition.slot !== slot) {
      return fail(runInput, {
        code: "equipment-slot-mismatch",
        actorId,
        equipmentId,
        slot,
      });
    }
    const ownsRepresentation = universe.cards.some(
      (card) =>
        card.kind === "equipment" &&
        card.sourceId === definition.id &&
        actor.ownedCardIds.includes(card.id)
    );
    if (!ownsRepresentation) {
      return fail(runInput, { code: "equipment-card-not-owned", actorId, equipmentId });
    }
    nextEquipmentId = definition.id;
  }

  const equipmentById = new Map(universe.equipment.map((entry) => [entry.id, entry] as const));
  const retained = actor.equipmentIds.filter((id) => equipmentById.get(id)?.slot !== slot);
  const nextIds = nextEquipmentId ? [...retained, nextEquipmentId] : retained;
  const changed =
    nextIds.length !== actor.equipmentIds.length ||
    nextIds.some((id, index) => actor.equipmentIds[index] !== id);
  if (!changed) return { ok: true, run, changed: false, issues: [] };

  actor.equipmentIds = nextIds;
  actor.availableCardIds = buildFateKnotsAvailableCardIds(actor, {
    cards: universe.cards,
    equipment: universe.equipment,
    statuses: universe.statuses,
  });
  run.revision += 1;
  return { ok: true, run, changed: true, issues: [] };
}

/**
 * Canonical camp exit. Multiplayer readiness/consensus belongs to the host
 * coordination layer; this engine function only performs the final authorized
 * phase transition after every active player seat is ready.
 */
export function leaveFateKnotsCamp(
  universe: FateKnotsUniversePackage,
  runInput: FateKnotsRunState
): FateKnotsCampMutationResult {
  const contextIssue = validateCampContext(universe, runInput);
  if (contextIssue) return fail(runInput, contextIssue);
  const run = cloneRun(runInput);
  run.phase = "exploration";
  run.revision += 1;
  return { ok: true, run, changed: true, issues: [] };
}
