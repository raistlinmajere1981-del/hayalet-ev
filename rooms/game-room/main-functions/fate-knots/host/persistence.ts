import type { GameRoomHostApi } from "../../../shared/host/activation.js";
import {
  FATE_KNOTS_PHASES,
  FATE_KNOTS_SCHEMA_VERSION,
  type FateKnotsActorState,
  type FateKnotsCombatActionCommit,
  type FateKnotsCombatState,
  type FateKnotsRunState,
  type FateKnotsUniversePackage,
} from "../shared/contracts.js";
import {
  normalizeFateKnotsUniversePackage,
  type FateKnotsUniverseValidationIssue,
} from "../forge/universe-validation.js";
import type {
  FateKnotsCombatActorRuntimeState,
  FateKnotsCombatModifierStatId,
  FateKnotsCombatRuntimeState,
  FateKnotsCombatStatModifier,
  FateKnotsTimedStatusInstance,
} from "../shared/combat-runtime.js";

export const FATE_KNOTS_UNIVERSE_STORE_KEY = "game-room:fate-knots:universes:v1";
export const FATE_KNOTS_RUN_STORE_KEY = "game-room:fate-knots:runs:v1";
export const FATE_KNOTS_PERSISTENCE_SCHEMA_VERSION = 1;

export interface FateKnotsUniverseStoreEntry {
  universe: FateKnotsUniversePackage;
  savedAt: string;
}

export interface FateKnotsUniverseStore {
  schemaVersion: typeof FATE_KNOTS_PERSISTENCE_SCHEMA_VERSION;
  activeUniverseId: string | null;
  entries: FateKnotsUniverseStoreEntry[];
}

export interface FateKnotsPersistedRunSnapshot {
  run: FateKnotsRunState;
  combatRuntime: FateKnotsCombatRuntimeState | null;
  savedAt: string;
}

export interface FateKnotsRunStore {
  schemaVersion: typeof FATE_KNOTS_PERSISTENCE_SCHEMA_VERSION;
  activeRunId: string | null;
  entries: FateKnotsPersistedRunSnapshot[];
}

export type FateKnotsPersistenceIssueCode =
  | "invalid-store"
  | "invalid-universe-entry"
  | "invalid-run-entry"
  | "universe-not-found"
  | "run-not-found"
  | "run-universe-not-found"
  | "combat-runtime-required"
  | "unexpected-combat-runtime"
  | "combat-runtime-actor-mismatch";

export interface FateKnotsPersistenceIssue {
  code: FateKnotsPersistenceIssueCode;
  entryId?: string;
  universeIssues?: FateKnotsUniverseValidationIssue[];
}

export interface FateKnotsUniverseStoreLoadResult {
  store: FateKnotsUniverseStore;
  issues: FateKnotsPersistenceIssue[];
}

export interface FateKnotsRunStoreLoadResult {
  store: FateKnotsRunStore;
  issues: FateKnotsPersistenceIssue[];
}

export interface FateKnotsPersistenceMutationResult<T> {
  ok: boolean;
  value: T | null;
  issues: FateKnotsPersistenceIssue[];
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function readNonEmptyString(value: unknown): string | null {
  return typeof value === "string" && value.trim() !== "" ? value.trim() : null;
}

function readNullableString(value: unknown): string | null | undefined {
  if (value === null || value === undefined) return value;
  return readNonEmptyString(value) ?? undefined;
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function isNonNegativeInteger(value: unknown): value is number {
  return isFiniteNumber(value) && Number.isInteger(value) && value >= 0;
}

function isPositiveInteger(value: unknown): value is number {
  return isFiniteNumber(value) && Number.isInteger(value) && value > 0;
}

function readStringArray(value: unknown): string[] | null {
  if (!Array.isArray(value) || value.some((entry) => typeof entry !== "string")) return null;
  return value.slice();
}

function isFateKnotsPhase(value: unknown): value is FateKnotsRunState["phase"] {
  return typeof value === "string" && FATE_KNOTS_PHASES.includes(value as FateKnotsRunState["phase"]);
}

function isCombatPhase(value: FateKnotsRunState["phase"]): value is FateKnotsCombatState["phase"] {
  return (
    value === "combat-discussion" ||
    value === "combat-commit" ||
    value === "combat-resolution" ||
    value === "combat-aftermath"
  );
}

function cloneJson<T>(value: T): T {
  // Fate Knots persisted state is deliberately JSON-only. Keeping persistence
  // cloning here prevents renderer/host references from mutating stored snapshots.
  return JSON.parse(JSON.stringify(value)) as T;
}

function normalizeActor(candidate: unknown): FateKnotsActorState | null {
  if (!isRecord(candidate)) return null;
  const actorId = readNonEmptyString(candidate["actorId"]);
  const characterId = readNonEmptyString(candidate["characterId"]);
  const teamId = candidate["teamId"];
  const position = candidate["position"];
  const seatId = readNullableString(candidate["seatId"]);
  const ownedCardIds = readStringArray(candidate["ownedCardIds"]);
  const availableCardIds = readStringArray(candidate["availableCardIds"]);
  const equipmentIds = readStringArray(candidate["equipmentIds"]);
  const statusIds = readStringArray(candidate["statusIds"]);
  const injuryIds = readStringArray(candidate["injuryIds"]);

  if (!actorId || !characterId) return null;
  if (teamId !== "party" && teamId !== "opposition") return null;
  if (!isRecord(position)) return null;
  if (position["row"] !== "front" && position["row"] !== "rear") return null;
  if (
    position["range"] !== "engaged" &&
    position["range"] !== "near" &&
    position["range"] !== "far"
  ) {
    return null;
  }
  if (
    !isFiniteNumber(candidate["hp"]) ||
    !isFiniteNumber(candidate["maxHp"]) ||
    !isFiniteNumber(candidate["attack"]) ||
    !isFiniteNumber(candidate["defense"]) ||
    !isFiniteNumber(candidate["speed"]) ||
    !isFiniteNumber(candidate["energy"])
  ) {
    return null;
  }
  if (candidate["hp"] < 0 || candidate["maxHp"] < 0 || candidate["energy"] < 0) return null;
  if (candidate["fallen"] !== true && candidate["fallen"] !== false) return null;
  if (!ownedCardIds || !availableCardIds || !equipmentIds || !statusIds || !injuryIds) return null;
  if (
    seatId !== undefined &&
    seatId !== null &&
    seatId !== "user" &&
    seatId !== "ai1" &&
    seatId !== "ai0" &&
    seatId !== "ai2" &&
    seatId !== "us1"
  ) {
    return null;
  }

  const actor: FateKnotsActorState = {
    actorId,
    characterId,
    teamId,
    hp: candidate["hp"],
    maxHp: candidate["maxHp"],
    attack: candidate["attack"],
    defense: candidate["defense"],
    speed: candidate["speed"],
    energy: candidate["energy"],
    fallen: candidate["fallen"],
    position: {
      row: position["row"],
      range: position["range"],
    },
    ownedCardIds,
    availableCardIds,
    equipmentIds,
    statusIds,
    injuryIds,
  };
  if (seatId !== undefined) actor.seatId = seatId;
  return actor;
}

function normalizeCommit(candidate: unknown): FateKnotsCombatActionCommit | null {
  if (!isRecord(candidate)) return null;
  const actorId = readNonEmptyString(candidate["actorId"]);
  if (!actorId || (candidate["committed"] !== true && candidate["committed"] !== false)) return null;

  const movementCardId = readNullableString(candidate["movementCardId"]);
  const actionCardId = readNullableString(candidate["actionCardId"]);
  const primaryTargetId = readNullableString(candidate["primaryTargetId"]);
  const secondaryTargetId = readNullableString(candidate["secondaryTargetId"]);
  if (
    movementCardId === undefined ||
    actionCardId === undefined ||
    primaryTargetId === undefined ||
    secondaryTargetId === undefined
  ) {
    return null;
  }

  const commit: FateKnotsCombatActionCommit = {
    actorId,
    committed: candidate["committed"],
  };
  commit.movementCardId = movementCardId;
  commit.actionCardId = actionCardId;
  commit.primaryTargetId = primaryTargetId;
  commit.secondaryTargetId = secondaryTargetId;
  return commit;
}

function normalizeCombat(candidate: unknown): FateKnotsCombatState | null {
  if (!isRecord(candidate)) return null;
  const combatId = readNonEmptyString(candidate["combatId"]);
  const phase = candidate["phase"];
  const result = candidate["result"];
  const config = candidate["config"];
  if (!combatId || !isNonNegativeInteger(candidate["turnIndex"])) return null;
  if (
    phase !== "combat-discussion" &&
    phase !== "combat-commit" &&
    phase !== "combat-resolution" &&
    phase !== "combat-aftermath"
  ) {
    return null;
  }
  if (
    result !== "active" &&
    result !== "party-victory" &&
    result !== "party-defeat" &&
    result !== "retreat"
  ) {
    return null;
  }
  if (!isRecord(config)) return null;
  if (!isNonNegativeInteger(config["maxMovementCards"]) || !isNonNegativeInteger(config["maxActionCards"])) {
    return null;
  }
  if (!Array.isArray(candidate["actors"]) || !Array.isArray(candidate["commits"])) return null;

  const actors = candidate["actors"].map(normalizeActor);
  const commits = candidate["commits"].map(normalizeCommit);
  if (actors.some((actor) => actor === null) || commits.some((commit) => commit === null)) return null;

  return {
    combatId,
    turnIndex: candidate["turnIndex"],
    phase,
    config: {
      maxMovementCards: config["maxMovementCards"],
      maxActionCards: config["maxActionCards"],
    },
    actors: actors as FateKnotsActorState[],
    commits: commits as FateKnotsCombatActionCommit[],
    result,
  };
}

function normalizeRun(candidate: unknown): FateKnotsRunState | null {
  if (!isRecord(candidate)) return null;
  const runId = readNonEmptyString(candidate["runId"]);
  const universeId = readNonEmptyString(candidate["universeId"]);
  const phase = candidate["phase"];
  const result = candidate["result"];
  const activeLocationId = readNullableString(candidate["activeLocationId"]);
  const revealedLocationIds = readStringArray(candidate["revealedLocationIds"]);
  const revealedKnotIds = readStringArray(candidate["revealedKnotIds"]);
  const completedKnotIds = readStringArray(candidate["completedKnotIds"]);
  const partyActorIds = readStringArray(candidate["partyActorIds"]);
  const teamPoolItemIds = readStringArray(candidate["teamPoolItemIds"]);

  if (candidate["schemaVersion"] !== FATE_KNOTS_SCHEMA_VERSION) return null;
  if (!runId || !universeId || !isFateKnotsPhase(phase) || !isNonNegativeInteger(candidate["revision"])) {
    return null;
  }
  if (activeLocationId === undefined) return null;
  if (!revealedLocationIds || !revealedKnotIds || !completedKnotIds || !partyActorIds || !teamPoolItemIds) {
    return null;
  }
  if (!Array.isArray(candidate["actors"])) return null;
  const actors = candidate["actors"].map(normalizeActor);
  if (actors.some((actor) => actor === null)) return null;
  if (result !== "active" && result !== "completed" && result !== "failed") return null;
  if (candidate["finaleUnlocked"] !== true && candidate["finaleUnlocked"] !== false) return null;

  const activeCombatRaw = candidate["activeCombat"];
  const activeCombat = activeCombatRaw === null ? null : normalizeCombat(activeCombatRaw);
  if (activeCombatRaw !== null && !activeCombat) return null;
  if (activeCombat && (!isCombatPhase(phase) || activeCombat.phase !== phase)) return null;
  if (!activeCombat && isCombatPhase(phase)) return null;
  if (result === "completed" && phase !== "completed") return null;
  if (result === "failed" && phase !== "failed") return null;
  if (result === "active" && (phase === "completed" || phase === "failed")) return null;

  const normalizedActors = actors as FateKnotsActorState[];
  const actorById = new Map(normalizedActors.map((actor) => [actor.actorId, actor] as const));
  if (
    partyActorIds.some((actorId) => {
      const actor = actorById.get(actorId);
      return !actor || actor.teamId !== "party";
    })
  ) {
    return null;
  }

  return {
    schemaVersion: FATE_KNOTS_SCHEMA_VERSION,
    runId,
    universeId,
    phase,
    revision: candidate["revision"],
    activeLocationId,
    revealedLocationIds,
    revealedKnotIds,
    completedKnotIds,
    partyActorIds,
    actors: normalizedActors,
    teamPoolItemIds,
    activeCombat,
    finaleUnlocked: candidate["finaleUnlocked"],
    result,
  };
}

function normalizeStatModifier(candidate: unknown): FateKnotsCombatStatModifier | null {
  if (!isRecord(candidate)) return null;
  const effectId = readNonEmptyString(candidate["effectId"]);
  const statId = candidate["statId"];
  if (!effectId || !isFiniteNumber(candidate["delta"])) return null;
  if (statId !== "maxHp" && statId !== "attack" && statId !== "defense" && statId !== "speed") {
    return null;
  }
  return {
    effectId,
    statId: statId as FateKnotsCombatModifierStatId,
    delta: candidate["delta"],
  };
}

function normalizeTimedStatus(candidate: unknown): FateKnotsTimedStatusInstance | null {
  if (!isRecord(candidate)) return null;
  const effectId = readNonEmptyString(candidate["effectId"]);
  const statusId = readNonEmptyString(candidate["statusId"]);
  if (!effectId || !statusId) return null;
  if (!isPositiveInteger(candidate["remainingTurns"]) || !isNonNegativeInteger(candidate["appliedTurnIndex"])) {
    return null;
  }
  return {
    effectId,
    statusId,
    remainingTurns: candidate["remainingTurns"],
    appliedTurnIndex: candidate["appliedTurnIndex"],
  };
}

function normalizeRuntimeActor(candidate: unknown): FateKnotsCombatActorRuntimeState | null {
  if (!isRecord(candidate)) return null;
  const actorId = readNonEmptyString(candidate["actorId"]);
  if (!actorId || !isFiniteNumber(candidate["shield"]) || candidate["shield"] < 0) return null;
  if (!Array.isArray(candidate["statModifiers"]) || !Array.isArray(candidate["timedStatuses"])) return null;
  const statModifiers = candidate["statModifiers"].map(normalizeStatModifier);
  const timedStatuses = candidate["timedStatuses"].map(normalizeTimedStatus);
  if (statModifiers.some((modifier) => modifier === null) || timedStatuses.some((status) => status === null)) {
    return null;
  }
  return {
    actorId,
    shield: candidate["shield"],
    statModifiers: statModifiers as FateKnotsCombatStatModifier[],
    timedStatuses: timedStatuses as FateKnotsTimedStatusInstance[],
  };
}

function normalizeCombatRuntime(candidate: unknown): FateKnotsCombatRuntimeState | null {
  if (!isRecord(candidate) || !Array.isArray(candidate["actorRuntime"])) return null;
  const actorRuntime = candidate["actorRuntime"].map(normalizeRuntimeActor);
  if (actorRuntime.some((actor) => actor === null)) return null;
  const retreatRequestedTeamIds = candidate["retreatRequestedTeamIds"];
  if (
    !Array.isArray(retreatRequestedTeamIds) ||
    retreatRequestedTeamIds.some((teamId) => teamId !== "party" && teamId !== "opposition")
  ) {
    return null;
  }
  return {
    actorRuntime: actorRuntime as FateKnotsCombatActorRuntimeState[],
    retreatRequestedTeamIds: retreatRequestedTeamIds.slice(),
  };
}

function runtimeMatchesCombat(
  combat: FateKnotsCombatState,
  runtime: FateKnotsCombatRuntimeState
): boolean {
  const combatActorIds = new Set(combat.actors.map((actor) => actor.actorId));
  const runtimeActorIds = new Set(runtime.actorRuntime.map((actor) => actor.actorId));
  if (combatActorIds.size !== runtimeActorIds.size) return false;
  for (const actorId of combatActorIds) {
    if (!runtimeActorIds.has(actorId)) return false;
  }
  return true;
}

function createEmptyUniverseStore(): FateKnotsUniverseStore {
  return {
    schemaVersion: FATE_KNOTS_PERSISTENCE_SCHEMA_VERSION,
    activeUniverseId: null,
    entries: [],
  };
}

function createEmptyRunStore(): FateKnotsRunStore {
  return {
    schemaVersion: FATE_KNOTS_PERSISTENCE_SCHEMA_VERSION,
    activeRunId: null,
    entries: [],
  };
}

function normalizeSavedAt(value: unknown): string {
  const savedAt = readNonEmptyString(value);
  return savedAt ?? new Date(0).toISOString();
}

export function loadFateKnotsUniverseStore(api: GameRoomHostApi): FateKnotsUniverseStoreLoadResult {
  const candidate = api.getState(FATE_KNOTS_UNIVERSE_STORE_KEY);
  if (candidate === undefined || candidate === null) {
    return { store: createEmptyUniverseStore(), issues: [] };
  }
  if (!isRecord(candidate) || candidate["schemaVersion"] !== FATE_KNOTS_PERSISTENCE_SCHEMA_VERSION) {
    return {
      store: createEmptyUniverseStore(),
      issues: [{ code: "invalid-store" }],
    };
  }

  const issues: FateKnotsPersistenceIssue[] = [];
  const entries: FateKnotsUniverseStoreEntry[] = [];
  const rawEntries = Array.isArray(candidate["entries"]) ? candidate["entries"] : [];

  for (const rawEntry of rawEntries) {
    if (!isRecord(rawEntry)) {
      issues.push({ code: "invalid-universe-entry" });
      continue;
    }
    const normalized = normalizeFateKnotsUniversePackage(rawEntry["universe"]);
    if (!normalized.valid || !normalized.package) {
      issues.push({
        code: "invalid-universe-entry",
        universeIssues: normalized.issues,
      });
      continue;
    }
    entries.push({
      universe: normalized.package,
      savedAt: normalizeSavedAt(rawEntry["savedAt"]),
    });
  }

  const ids = new Set(entries.map((entry) => entry.universe.universeId));
  const activeUniverseId = readNullableString(candidate["activeUniverseId"]);
  return {
    store: {
      schemaVersion: FATE_KNOTS_PERSISTENCE_SCHEMA_VERSION,
      activeUniverseId:
        activeUniverseId && activeUniverseId !== undefined && ids.has(activeUniverseId)
          ? activeUniverseId
          : null,
      entries,
    },
    issues,
  };
}

export function saveFateKnotsUniverse(
  api: GameRoomHostApi,
  candidate: unknown,
  savedAt = new Date().toISOString()
): FateKnotsPersistenceMutationResult<FateKnotsUniversePackage> {
  const normalized = normalizeFateKnotsUniversePackage(candidate);
  if (!normalized.valid || !normalized.package) {
    return {
      ok: false,
      value: null,
      issues: [{ code: "invalid-universe-entry", universeIssues: normalized.issues }],
    };
  }

  const loaded = loadFateKnotsUniverseStore(api);
  const universe = normalized.package;
  const entries = loaded.store.entries.filter(
    (entry) => entry.universe.universeId !== universe.universeId
  );
  entries.push({ universe: cloneJson(universe), savedAt });
  const store: FateKnotsUniverseStore = {
    schemaVersion: FATE_KNOTS_PERSISTENCE_SCHEMA_VERSION,
    activeUniverseId: universe.universeId,
    entries,
  };
  api.setState(FATE_KNOTS_UNIVERSE_STORE_KEY, store);
  return { ok: true, value: cloneJson(universe), issues: loaded.issues };
}

export function loadFateKnotsRunStore(api: GameRoomHostApi): FateKnotsRunStoreLoadResult {
  const candidate = api.getState(FATE_KNOTS_RUN_STORE_KEY);
  const universes = loadFateKnotsUniverseStore(api).store;
  const universeIds = new Set(universes.entries.map((entry) => entry.universe.universeId));
  if (candidate === undefined || candidate === null) {
    return { store: createEmptyRunStore(), issues: [] };
  }
  if (!isRecord(candidate) || candidate["schemaVersion"] !== FATE_KNOTS_PERSISTENCE_SCHEMA_VERSION) {
    return { store: createEmptyRunStore(), issues: [{ code: "invalid-store" }] };
  }

  const issues: FateKnotsPersistenceIssue[] = [];
  const entries: FateKnotsPersistedRunSnapshot[] = [];
  const rawEntries = Array.isArray(candidate["entries"]) ? candidate["entries"] : [];

  for (const rawEntry of rawEntries) {
    if (!isRecord(rawEntry)) {
      issues.push({ code: "invalid-run-entry" });
      continue;
    }
    const run = normalizeRun(rawEntry["run"]);
    if (!run) {
      issues.push({ code: "invalid-run-entry" });
      continue;
    }
    if (!universeIds.has(run.universeId)) {
      issues.push({ code: "run-universe-not-found", entryId: run.runId });
      continue;
    }

    const runtimeRaw = rawEntry["combatRuntime"];
    let combatRuntime: FateKnotsCombatRuntimeState | null = null;
    if (run.activeCombat) {
      combatRuntime = normalizeCombatRuntime(runtimeRaw);
      if (!combatRuntime) {
        issues.push({ code: "combat-runtime-required", entryId: run.runId });
        continue;
      }
      if (!runtimeMatchesCombat(run.activeCombat, combatRuntime)) {
        issues.push({ code: "combat-runtime-actor-mismatch", entryId: run.runId });
        continue;
      }
    } else if (runtimeRaw !== null && runtimeRaw !== undefined) {
      issues.push({ code: "unexpected-combat-runtime", entryId: run.runId });
      continue;
    }

    entries.push({
      run,
      combatRuntime,
      savedAt: normalizeSavedAt(rawEntry["savedAt"]),
    });
  }

  const ids = new Set(entries.map((entry) => entry.run.runId));
  const activeRunId = readNullableString(candidate["activeRunId"]);
  return {
    store: {
      schemaVersion: FATE_KNOTS_PERSISTENCE_SCHEMA_VERSION,
      activeRunId:
        activeRunId && activeRunId !== undefined && ids.has(activeRunId) ? activeRunId : null,
      entries,
    },
    issues,
  };
}

export function saveFateKnotsRunSnapshot(
  api: GameRoomHostApi,
  runInput: FateKnotsRunState,
  combatRuntimeInput: FateKnotsCombatRuntimeState | null,
  savedAt = new Date().toISOString()
): FateKnotsPersistenceMutationResult<FateKnotsPersistedRunSnapshot> {
  const universeStore = loadFateKnotsUniverseStore(api).store;
  if (!universeStore.entries.some((entry) => entry.universe.universeId === runInput.universeId)) {
    return {
      ok: false,
      value: null,
      issues: [{ code: "run-universe-not-found", entryId: runInput.runId }],
    };
  }

  const run = normalizeRun(runInput);
  if (!run) {
    return { ok: false, value: null, issues: [{ code: "invalid-run-entry", entryId: runInput.runId }] };
  }

  let combatRuntime: FateKnotsCombatRuntimeState | null = null;
  if (run.activeCombat) {
    if (!combatRuntimeInput) {
      return {
        ok: false,
        value: null,
        issues: [{ code: "combat-runtime-required", entryId: run.runId }],
      };
    }
    combatRuntime = normalizeCombatRuntime(combatRuntimeInput);
    if (!combatRuntime || !runtimeMatchesCombat(run.activeCombat, combatRuntime)) {
      return {
        ok: false,
        value: null,
        issues: [{ code: "combat-runtime-actor-mismatch", entryId: run.runId }],
      };
    }
  } else if (combatRuntimeInput) {
    return {
      ok: false,
      value: null,
      issues: [{ code: "unexpected-combat-runtime", entryId: run.runId }],
    };
  }

  const loaded = loadFateKnotsRunStore(api);
  const snapshot: FateKnotsPersistedRunSnapshot = {
    run: cloneJson(run),
    combatRuntime: combatRuntime ? cloneJson(combatRuntime) : null,
    savedAt,
  };
  const entries = loaded.store.entries.filter((entry) => entry.run.runId !== run.runId);
  entries.push(snapshot);
  const store: FateKnotsRunStore = {
    schemaVersion: FATE_KNOTS_PERSISTENCE_SCHEMA_VERSION,
    activeRunId: run.runId,
    entries,
  };
  api.setState(FATE_KNOTS_RUN_STORE_KEY, store);
  return { ok: true, value: cloneJson(snapshot), issues: loaded.issues };
}

export function getActiveFateKnotsUniverse(
  api: GameRoomHostApi
): FateKnotsUniversePackage | null {
  const store = loadFateKnotsUniverseStore(api).store;
  if (!store.activeUniverseId) return null;
  const entry = store.entries.find((candidate) => candidate.universe.universeId === store.activeUniverseId);
  return entry ? cloneJson(entry.universe) : null;
}

export function getActiveFateKnotsRunSnapshot(
  api: GameRoomHostApi
): FateKnotsPersistedRunSnapshot | null {
  const store = loadFateKnotsRunStore(api).store;
  if (!store.activeRunId) return null;
  const entry = store.entries.find((candidate) => candidate.run.runId === store.activeRunId);
  return entry ? cloneJson(entry) : null;
}

export function activateFateKnotsUniverse(
  api: GameRoomHostApi,
  universeId: string
): FateKnotsPersistenceMutationResult<FateKnotsUniversePackage> {
  const loaded = loadFateKnotsUniverseStore(api);
  const entry = loaded.store.entries.find((candidate) => candidate.universe.universeId === universeId);
  if (!entry) return { ok: false, value: null, issues: [{ code: "universe-not-found", entryId: universeId }] };
  const store = { ...loaded.store, activeUniverseId: universeId };
  api.setState(FATE_KNOTS_UNIVERSE_STORE_KEY, store);
  return { ok: true, value: cloneJson(entry.universe), issues: loaded.issues };
}

export function activateFateKnotsRun(
  api: GameRoomHostApi,
  runId: string
): FateKnotsPersistenceMutationResult<FateKnotsPersistedRunSnapshot> {
  const loaded = loadFateKnotsRunStore(api);
  const entry = loaded.store.entries.find((candidate) => candidate.run.runId === runId);
  if (!entry) return { ok: false, value: null, issues: [{ code: "run-not-found", entryId: runId }] };
  const universeActivation = activateFateKnotsUniverse(api, entry.run.universeId);
  if (!universeActivation.ok) return { ok: false, value: null, issues: universeActivation.issues };
  api.setState(FATE_KNOTS_RUN_STORE_KEY, { ...loaded.store, activeRunId: runId });
  return { ok: true, value: cloneJson(entry), issues: loaded.issues };
}

export function deleteFateKnotsRun(
  api: GameRoomHostApi,
  runId: string
): FateKnotsPersistenceMutationResult<FateKnotsRunStore> {
  const loaded = loadFateKnotsRunStore(api);
  if (!loaded.store.entries.some((entry) => entry.run.runId === runId)) {
    return { ok: false, value: null, issues: [{ code: "run-not-found", entryId: runId }] };
  }
  const store: FateKnotsRunStore = {
    ...loaded.store,
    activeRunId: loaded.store.activeRunId === runId ? null : loaded.store.activeRunId,
    entries: loaded.store.entries.filter((entry) => entry.run.runId !== runId),
  };
  api.setState(FATE_KNOTS_RUN_STORE_KEY, store);
  return { ok: true, value: cloneJson(store), issues: loaded.issues };
}

export function deleteFateKnotsUniverse(
  api: GameRoomHostApi,
  universeId: string
): FateKnotsPersistenceMutationResult<FateKnotsUniverseStore> {
  const universes = loadFateKnotsUniverseStore(api);
  if (!universes.store.entries.some((entry) => entry.universe.universeId === universeId)) {
    return { ok: false, value: null, issues: [{ code: "universe-not-found", entryId: universeId }] };
  }

  const runs = loadFateKnotsRunStore(api);
  const removedRunIds = new Set(
    runs.store.entries.filter((entry) => entry.run.universeId === universeId).map((entry) => entry.run.runId)
  );
  const nextRunStore: FateKnotsRunStore = {
    ...runs.store,
    activeRunId:
      runs.store.activeRunId && removedRunIds.has(runs.store.activeRunId)
        ? null
        : runs.store.activeRunId,
    entries: runs.store.entries.filter((entry) => entry.run.universeId !== universeId),
  };
  api.setState(FATE_KNOTS_RUN_STORE_KEY, nextRunStore);

  const store: FateKnotsUniverseStore = {
    ...universes.store,
    activeUniverseId:
      universes.store.activeUniverseId === universeId ? null : universes.store.activeUniverseId,
    entries: universes.store.entries.filter((entry) => entry.universe.universeId !== universeId),
  };
  api.setState(FATE_KNOTS_UNIVERSE_STORE_KEY, store);
  return { ok: true, value: cloneJson(store), issues: [...universes.issues, ...runs.issues] };
}
