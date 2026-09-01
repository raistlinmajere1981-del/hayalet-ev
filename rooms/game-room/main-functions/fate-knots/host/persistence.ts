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
import { parseFateKnotsUniversePackage } from "../forge/universe-boundary.js";
import type { FateKnotsUniverseValidationIssue } from "../forge/universe-validation.js";
import type { FateKnotsCombatRuntimeState } from "../shared/combat-runtime.js";

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
  | "universe-already-exists"
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

const SEAT_IDS = new Set(["user", "ai1", "ai0", "ai2", "us1"]);
const MODIFIER_STAT_IDS = new Set(["maxHp", "attack", "defense", "speed"]);

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function readNonEmptyString(value: unknown): string | null {
  return typeof value === "string" && value.trim() !== "" ? value.trim() : null;
}

function isNullableString(value: unknown): boolean {
  return value === null || readNonEmptyString(value) !== null;
}

function isOptionalNullableString(value: unknown): boolean {
  return value === undefined || isNullableString(value);
}

function readStringArray(value: unknown): string[] | null {
  return Array.isArray(value) && value.every((entry) => typeof entry === "string" && entry.trim() !== "")
    ? value.map((entry) => entry.trim())
    : null;
}

function hasUniqueStrings(values: readonly string[]): boolean {
  return new Set(values).size === values.length;
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function cloneJson<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function normalizeSavedAt(value: unknown): string {
  return readNonEmptyString(value) ?? new Date(0).toISOString();
}

function isCombatPhase(value: unknown): value is FateKnotsCombatState["phase"] {
  return (
    value === "combat-discussion" ||
    value === "combat-commit" ||
    value === "combat-resolution" ||
    value === "combat-aftermath"
  );
}

function isActorShape(value: unknown): value is FateKnotsActorState {
  if (!isRecord(value)) return false;
  if (!readNonEmptyString(value["actorId"]) || !readNonEmptyString(value["characterId"])) return false;
  if (value["teamId"] !== "party" && value["teamId"] !== "opposition") return false;
  if (value["seatId"] !== undefined && value["seatId"] !== null) {
    if (typeof value["seatId"] !== "string" || !SEAT_IDS.has(value["seatId"])) return false;
  }
  for (const key of ["hp", "maxHp", "attack", "defense", "speed", "energy"] as const) {
    if (!isFiniteNumber(value[key])) return false;
  }
  if ((value["hp"] as number) < 0 || (value["maxHp"] as number) < 0 || (value["energy"] as number) < 0) return false;
  if (value["fallen"] !== true && value["fallen"] !== false) return false;
  const position = value["position"];
  if (!isRecord(position) || (position["row"] !== "front" && position["row"] !== "rear")) return false;
  if (position["range"] !== "engaged" && position["range"] !== "near" && position["range"] !== "far") return false;
  for (const key of ["ownedCardIds", "availableCardIds", "equipmentIds", "statusIds", "injuryIds"] as const) {
    if (!readStringArray(value[key])) return false;
  }
  return true;
}

function isCommitShape(value: unknown, actorIds: ReadonlySet<string>): value is FateKnotsCombatActionCommit {
  if (!isRecord(value)) return false;
  const actorId = readNonEmptyString(value["actorId"]);
  if (!actorId || !actorIds.has(actorId)) return false;
  if (value["committed"] !== true && value["committed"] !== false) return false;
  for (const key of ["movementCardId", "actionCardId", "primaryTargetId", "secondaryTargetId"] as const) {
    if (!isOptionalNullableString(value[key])) return false;
  }
  return true;
}

function isCombatShape(value: unknown): value is FateKnotsCombatState {
  if (!isRecord(value) || !readNonEmptyString(value["combatId"])) return false;
  if (!isCombatPhase(value["phase"])) return false;
  if (typeof value["turnIndex"] !== "number" || !Number.isInteger(value["turnIndex"]) || value["turnIndex"] < 0) return false;
  if (value["result"] !== "active" && value["result"] !== "party-victory" && value["result"] !== "party-defeat" && value["result"] !== "retreat") return false;
  const config = value["config"];
  if (!isRecord(config)) return false;
  for (const key of ["maxMovementCards", "maxActionCards"] as const) {
    if (typeof config[key] !== "number" || !Number.isInteger(config[key]) || config[key] < 0) return false;
  }
  if (!Array.isArray(value["actors"]) || !value["actors"].every(isActorShape)) return false;
  const actorIds = value["actors"].map((actor) => (actor as FateKnotsActorState).actorId);
  if (!hasUniqueStrings(actorIds)) return false;
  const actorIdSet = new Set(actorIds);
  if (!Array.isArray(value["commits"]) || !value["commits"].every((commit) => isCommitShape(commit, actorIdSet))) return false;
  const commitActorIds = value["commits"].map((commit) => (commit as FateKnotsCombatActionCommit).actorId);
  return hasUniqueStrings(commitActorIds);
}

function isRunShape(value: unknown): value is FateKnotsRunState {
  if (!isRecord(value)) return false;
  if (value["schemaVersion"] !== FATE_KNOTS_SCHEMA_VERSION) return false;
  if (!readNonEmptyString(value["runId"]) || !readNonEmptyString(value["universeId"])) return false;
  if (
    typeof value["phase"] !== "string" ||
    !FATE_KNOTS_PHASES.includes(value["phase"] as FateKnotsRunState["phase"])
  ) {
    return false;
  }
  if (
    typeof value["revision"] !== "number" ||
    !Number.isInteger(value["revision"]) ||
    value["revision"] < 0
  ) {
    return false;
  }
  if (
    !isNullableString(value["activeLocationId"]) ||
    !isNullableString(value["activeKnotId"]) ||
    !isNullableString(value["activeStoryTransitionId"]) ||
    !isNullableString(value["activeEncounterId"])
  ) {
    return false;
  }
  if (value["activeEncounterId"] !== null && value["activeStoryTransitionId"] === null) return false;

  const revealedLocationIds = readStringArray(value["revealedLocationIds"]);
  const revealedKnotIds = readStringArray(value["revealedKnotIds"]);
  const completedKnotIds = readStringArray(value["completedKnotIds"]);
  const partyActorIds = readStringArray(value["partyActorIds"]);
  const teamPoolItemIds = readStringArray(value["teamPoolItemIds"]);
  if (!revealedLocationIds || !revealedKnotIds || !completedKnotIds || !partyActorIds || !teamPoolItemIds) return false;
  if (!hasUniqueStrings(revealedLocationIds) || !hasUniqueStrings(revealedKnotIds) || !hasUniqueStrings(completedKnotIds) || !hasUniqueStrings(partyActorIds)) return false;

  if (!Array.isArray(value["actors"]) || !value["actors"].every(isActorShape)) return false;
  const actors = value["actors"] as FateKnotsActorState[];
  const actorIds = actors.map((actor) => actor.actorId);
  if (!hasUniqueStrings(actorIds)) return false;
  const actorById = new Map(actors.map((actor) => [actor.actorId, actor] as const));
  if (partyActorIds.some((actorId) => actorById.get(actorId)?.teamId !== "party")) return false;

  if (value["finaleUnlocked"] !== true && value["finaleUnlocked"] !== false) return false;
  if (value["result"] !== "active" && value["result"] !== "completed" && value["result"] !== "failed") return false;

  const activeCombat = value["activeCombat"];
  const phase = value["phase"];
  if (activeCombat === null) {
    if (isCombatPhase(phase)) return false;
  } else {
    if (!isCombatShape(activeCombat) || activeCombat.phase !== phase) return false;
    if (value["activeStoryTransitionId"] === null || value["activeEncounterId"] === null) return false;
    const combatActorIds = new Set(activeCombat.actors.map((actor) => actor.actorId));
    if (partyActorIds.some((actorId) => !combatActorIds.has(actorId))) return false;
  }

  if (value["result"] === "completed" && phase !== "completed") return false;
  if (value["result"] === "failed" && phase !== "failed") return false;
  if (value["result"] === "active" && (phase === "completed" || phase === "failed")) return false;
  return true;
}

function isCombatRuntimeShape(value: unknown): value is FateKnotsCombatRuntimeState {
  if (!isRecord(value) || !Array.isArray(value["actorRuntime"])) return false;
  const retreatIds = readStringArray(value["retreatRequestedTeamIds"]);
  if (!retreatIds || retreatIds.some((teamId) => teamId !== "party" && teamId !== "opposition") || !hasUniqueStrings(retreatIds)) return false;

  const actorIds: string[] = [];
  for (const actor of value["actorRuntime"]) {
    if (!isRecord(actor)) return false;
    const actorId = readNonEmptyString(actor["actorId"]);
    if (!actorId) return false;
    actorIds.push(actorId);
    if (!isFiniteNumber(actor["shield"]) || actor["shield"] < 0) return false;
    if (!Array.isArray(actor["statModifiers"]) || !Array.isArray(actor["timedStatuses"])) return false;
    for (const modifier of actor["statModifiers"]) {
      if (!isRecord(modifier) || !readNonEmptyString(modifier["effectId"])) return false;
      if (typeof modifier["statId"] !== "string" || !MODIFIER_STAT_IDS.has(modifier["statId"])) return false;
      if (!isFiniteNumber(modifier["delta"])) return false;
    }
    for (const timed of actor["timedStatuses"]) {
      if (!isRecord(timed) || !readNonEmptyString(timed["effectId"]) || !readNonEmptyString(timed["statusId"])) return false;
      if (typeof timed["remainingTurns"] !== "number" || !Number.isInteger(timed["remainingTurns"]) || timed["remainingTurns"] <= 0) return false;
      if (typeof timed["appliedTurnIndex"] !== "number" || !Number.isInteger(timed["appliedTurnIndex"]) || timed["appliedTurnIndex"] < 0) return false;
    }
  }
  return hasUniqueStrings(actorIds);
}

function runtimeMatchesCombat(
  combat: FateKnotsCombatState,
  runtime: FateKnotsCombatRuntimeState
): boolean {
  const combatActorIds = combat.actors.map((actor) => actor.actorId);
  const runtimeActorIds = runtime.actorRuntime.map((actor) => actor.actorId);
  if (!hasUniqueStrings(combatActorIds) || !hasUniqueStrings(runtimeActorIds)) return false;
  if (combatActorIds.length !== runtimeActorIds.length) return false;
  const runtimeSet = new Set(runtimeActorIds);
  return combatActorIds.every((actorId) => runtimeSet.has(actorId));
}

function normalizeRunSnapshot(candidate: unknown): FateKnotsPersistedRunSnapshot | null {
  if (!isRecord(candidate) || !isRunShape(candidate["run"])) return null;
  const run = cloneJson(candidate["run"]);
  const runtimeCandidate = candidate["combatRuntime"];

  if (run.activeCombat) {
    if (!isCombatRuntimeShape(runtimeCandidate)) return null;
    const combatRuntime = cloneJson(runtimeCandidate);
    if (!runtimeMatchesCombat(run.activeCombat, combatRuntime)) return null;
    return { run, combatRuntime, savedAt: normalizeSavedAt(candidate["savedAt"]) };
  }

  if (runtimeCandidate !== null && runtimeCandidate !== undefined) return null;
  return { run, combatRuntime: null, savedAt: normalizeSavedAt(candidate["savedAt"]) };
}

function createEmptyUniverseStore(): FateKnotsUniverseStore {
  return { schemaVersion: FATE_KNOTS_PERSISTENCE_SCHEMA_VERSION, activeUniverseId: null, entries: [] };
}

function createEmptyRunStore(): FateKnotsRunStore {
  return { schemaVersion: FATE_KNOTS_PERSISTENCE_SCHEMA_VERSION, activeRunId: null, entries: [] };
}

function mutationBlockedByIssues<T>(issues: FateKnotsPersistenceIssue[]): FateKnotsPersistenceMutationResult<T> | null {
  return issues.length > 0 ? { ok: false, value: null, issues } : null;
}

export function loadFateKnotsUniverseStore(api: GameRoomHostApi): FateKnotsUniverseStoreLoadResult {
  const candidate = api.getState(FATE_KNOTS_UNIVERSE_STORE_KEY);
  if (candidate === undefined || candidate === null) return { store: createEmptyUniverseStore(), issues: [] };
  if (!isRecord(candidate) || candidate["schemaVersion"] !== FATE_KNOTS_PERSISTENCE_SCHEMA_VERSION || !Array.isArray(candidate["entries"]) || !isNullableString(candidate["activeUniverseId"])) {
    return { store: createEmptyUniverseStore(), issues: [{ code: "invalid-store" }] };
  }

  const issues: FateKnotsPersistenceIssue[] = [];
  const entries: FateKnotsUniverseStoreEntry[] = [];
  const universeIds = new Set<string>();
  for (const rawEntry of candidate["entries"]) {
    if (!isRecord(rawEntry)) {
      issues.push({ code: "invalid-universe-entry" });
      continue;
    }
    const normalized = parseFateKnotsUniversePackage(rawEntry["universe"]);
    if (!normalized.valid || !normalized.package) {
      issues.push({ code: "invalid-universe-entry", universeIssues: normalized.issues });
      continue;
    }
    if (universeIds.has(normalized.package.universeId)) {
      issues.push({ code: "invalid-store", entryId: normalized.package.universeId });
      continue;
    }
    universeIds.add(normalized.package.universeId);
    entries.push({ universe: normalized.package, savedAt: normalizeSavedAt(rawEntry["savedAt"]) });
  }

  const activeCandidate = readNonEmptyString(candidate["activeUniverseId"]);
  const activeUniverseId = activeCandidate && universeIds.has(activeCandidate) ? activeCandidate : null;
  if (candidate["activeUniverseId"] !== null && activeUniverseId === null) issues.push({ code: "invalid-store" });
  return { store: { schemaVersion: FATE_KNOTS_PERSISTENCE_SCHEMA_VERSION, activeUniverseId, entries }, issues };
}

export function saveFateKnotsUniverse(
  api: GameRoomHostApi,
  candidate: unknown,
  savedAt = new Date().toISOString()
): FateKnotsPersistenceMutationResult<FateKnotsUniversePackage> {
  const normalized = parseFateKnotsUniversePackage(candidate);
  if (!normalized.valid || !normalized.package) {
    return { ok: false, value: null, issues: [{ code: "invalid-universe-entry", universeIssues: normalized.issues }] };
  }

  const loaded = loadFateKnotsUniverseStore(api);
  const blocked = mutationBlockedByIssues<FateKnotsUniversePackage>(loaded.issues);
  if (blocked) return blocked;
  const runs = loadFateKnotsRunStore(api);
  const runBlocked = mutationBlockedByIssues<FateKnotsUniversePackage>(runs.issues);
  if (runBlocked) return runBlocked;

  const universe = normalized.package;
  const existing = loaded.store.entries.find((entry) => entry.universe.universeId === universe.universeId);
  if (existing) {
    if (JSON.stringify(existing.universe) !== JSON.stringify(universe)) {
      return { ok: false, value: null, issues: [{ code: "universe-already-exists", entryId: universe.universeId }] };
    }
    return { ok: true, value: cloneJson(existing.universe), issues: [] };
  }

  const activeRun = runs.store.activeRunId
    ? runs.store.entries.find((entry) => entry.run.runId === runs.store.activeRunId) ?? null
    : null;
  const entries = [...loaded.store.entries, { universe: cloneJson(universe), savedAt }];
  const store: FateKnotsUniverseStore = {
    schemaVersion: FATE_KNOTS_PERSISTENCE_SCHEMA_VERSION,
    activeUniverseId: activeRun?.run.universeId ?? universe.universeId,
    entries,
  };
  api.setState(FATE_KNOTS_UNIVERSE_STORE_KEY, store);
  return { ok: true, value: cloneJson(universe), issues: [] };
}

export function loadFateKnotsRunStore(api: GameRoomHostApi): FateKnotsRunStoreLoadResult {
  const candidate = api.getState(FATE_KNOTS_RUN_STORE_KEY);
  const universeResult = loadFateKnotsUniverseStore(api);
  const universeIds = new Set(universeResult.store.entries.map((entry) => entry.universe.universeId));

  if (candidate === undefined || candidate === null) return { store: createEmptyRunStore(), issues: universeResult.issues.slice() };
  if (!isRecord(candidate) || candidate["schemaVersion"] !== FATE_KNOTS_PERSISTENCE_SCHEMA_VERSION || !Array.isArray(candidate["entries"]) || !isNullableString(candidate["activeRunId"])) {
    return { store: createEmptyRunStore(), issues: [...universeResult.issues, { code: "invalid-store" }] };
  }

  const issues: FateKnotsPersistenceIssue[] = [...universeResult.issues];
  const entries: FateKnotsPersistedRunSnapshot[] = [];
  const runIds = new Set<string>();
  for (const rawEntry of candidate["entries"]) {
    const snapshot = normalizeRunSnapshot(rawEntry);
    if (!snapshot) {
      issues.push({ code: "invalid-run-entry" });
      continue;
    }
    if (runIds.has(snapshot.run.runId)) {
      issues.push({ code: "invalid-store", entryId: snapshot.run.runId });
      continue;
    }
    runIds.add(snapshot.run.runId);
    if (!universeIds.has(snapshot.run.universeId)) {
      issues.push({ code: "run-universe-not-found", entryId: snapshot.run.runId });
      continue;
    }
    entries.push(snapshot);
  }

  const activeCandidate = readNonEmptyString(candidate["activeRunId"]);
  const activeRunId = activeCandidate && runIds.has(activeCandidate) ? activeCandidate : null;
  if (candidate["activeRunId"] !== null && activeRunId === null) issues.push({ code: "invalid-store" });
  return { store: { schemaVersion: FATE_KNOTS_PERSISTENCE_SCHEMA_VERSION, activeRunId, entries }, issues };
}

export function saveFateKnotsRunSnapshot(
  api: GameRoomHostApi,
  runInput: FateKnotsRunState,
  combatRuntimeInput: FateKnotsCombatRuntimeState | null,
  savedAt = new Date().toISOString()
): FateKnotsPersistenceMutationResult<FateKnotsPersistedRunSnapshot> {
  const universeStore = loadFateKnotsUniverseStore(api);
  const universeBlocked = mutationBlockedByIssues<FateKnotsPersistedRunSnapshot>(universeStore.issues);
  if (universeBlocked) return universeBlocked;
  if (!universeStore.store.entries.some((entry) => entry.universe.universeId === runInput.universeId)) {
    return { ok: false, value: null, issues: [{ code: "run-universe-not-found", entryId: runInput.runId }] };
  }

  const snapshot = normalizeRunSnapshot({ run: runInput, combatRuntime: combatRuntimeInput, savedAt });
  if (!snapshot) {
    const code: FateKnotsPersistenceIssueCode = runInput.activeCombat
      ? combatRuntimeInput
        ? "combat-runtime-actor-mismatch"
        : "combat-runtime-required"
      : combatRuntimeInput
        ? "unexpected-combat-runtime"
        : "invalid-run-entry";
    return { ok: false, value: null, issues: [{ code, entryId: runInput.runId }] };
  }

  const loaded = loadFateKnotsRunStore(api);
  const blocked = mutationBlockedByIssues<FateKnotsPersistedRunSnapshot>(loaded.issues);
  if (blocked) return blocked;
  const entries = loaded.store.entries.filter((entry) => entry.run.runId !== snapshot.run.runId);
  entries.push(cloneJson(snapshot));
  const store: FateKnotsRunStore = { schemaVersion: FATE_KNOTS_PERSISTENCE_SCHEMA_VERSION, activeRunId: snapshot.run.runId, entries };
  api.setState(FATE_KNOTS_RUN_STORE_KEY, store);
  api.setState(FATE_KNOTS_UNIVERSE_STORE_KEY, { ...universeStore.store, activeUniverseId: snapshot.run.universeId });
  return { ok: true, value: cloneJson(snapshot), issues: [] };
}

export function getActiveFateKnotsUniverse(api: GameRoomHostApi): FateKnotsUniversePackage | null {
  const store = loadFateKnotsUniverseStore(api).store;
  if (!store.activeUniverseId) return null;
  const entry = store.entries.find((candidate) => candidate.universe.universeId === store.activeUniverseId);
  return entry ? cloneJson(entry.universe) : null;
}

export function getActiveFateKnotsRunSnapshot(api: GameRoomHostApi): FateKnotsPersistedRunSnapshot | null {
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
  const blocked = mutationBlockedByIssues<FateKnotsUniversePackage>(loaded.issues);
  if (blocked) return blocked;
  const entry = loaded.store.entries.find((candidate) => candidate.universe.universeId === universeId);
  if (!entry) return { ok: false, value: null, issues: [{ code: "universe-not-found", entryId: universeId }] };

  const runs = loadFateKnotsRunStore(api);
  const runBlocked = mutationBlockedByIssues<FateKnotsUniversePackage>(runs.issues);
  if (runBlocked) return runBlocked;
  const activeRun = runs.store.activeRunId
    ? runs.store.entries.find((candidate) => candidate.run.runId === runs.store.activeRunId) ?? null
    : null;
  if (activeRun && activeRun.run.universeId !== universeId) {
    api.setState(FATE_KNOTS_RUN_STORE_KEY, { ...runs.store, activeRunId: null });
  }
  api.setState(FATE_KNOTS_UNIVERSE_STORE_KEY, { ...loaded.store, activeUniverseId: universeId });
  return { ok: true, value: cloneJson(entry.universe), issues: [] };
}

export function activateFateKnotsRun(
  api: GameRoomHostApi,
  runId: string
): FateKnotsPersistenceMutationResult<FateKnotsPersistedRunSnapshot> {
  const loaded = loadFateKnotsRunStore(api);
  const blocked = mutationBlockedByIssues<FateKnotsPersistedRunSnapshot>(loaded.issues);
  if (blocked) return blocked;
  const entry = loaded.store.entries.find((candidate) => candidate.run.runId === runId);
  if (!entry) return { ok: false, value: null, issues: [{ code: "run-not-found", entryId: runId }] };
  const universeActivation = activateFateKnotsUniverse(api, entry.run.universeId);
  if (!universeActivation.ok) return { ok: false, value: null, issues: universeActivation.issues };
  api.setState(FATE_KNOTS_RUN_STORE_KEY, { ...loaded.store, activeRunId: runId });
  return { ok: true, value: cloneJson(entry), issues: [] };
}

export function deleteFateKnotsRun(
  api: GameRoomHostApi,
  runId: string
): FateKnotsPersistenceMutationResult<FateKnotsRunStore> {
  const loaded = loadFateKnotsRunStore(api);
  const blocked = mutationBlockedByIssues<FateKnotsRunStore>(loaded.issues);
  if (blocked) return blocked;
  if (!loaded.store.entries.some((entry) => entry.run.runId === runId)) {
    return { ok: false, value: null, issues: [{ code: "run-not-found", entryId: runId }] };
  }
  const store: FateKnotsRunStore = {
    ...loaded.store,
    activeRunId: loaded.store.activeRunId === runId ? null : loaded.store.activeRunId,
    entries: loaded.store.entries.filter((entry) => entry.run.runId !== runId),
  };
  api.setState(FATE_KNOTS_RUN_STORE_KEY, store);
  return { ok: true, value: cloneJson(store), issues: [] };
}

export function deleteFateKnotsUniverse(
  api: GameRoomHostApi,
  universeId: string
): FateKnotsPersistenceMutationResult<FateKnotsUniverseStore> {
  const universes = loadFateKnotsUniverseStore(api);
  const universeBlocked = mutationBlockedByIssues<FateKnotsUniverseStore>(universes.issues);
  if (universeBlocked) return universeBlocked;
  if (!universes.store.entries.some((entry) => entry.universe.universeId === universeId)) {
    return { ok: false, value: null, issues: [{ code: "universe-not-found", entryId: universeId }] };
  }

  const runs = loadFateKnotsRunStore(api);
  const runBlocked = mutationBlockedByIssues<FateKnotsUniverseStore>(runs.issues);
  if (runBlocked) return runBlocked;
  const removedRunIds = new Set(
    runs.store.entries.filter((entry) => entry.run.universeId === universeId).map((entry) => entry.run.runId)
  );
  const nextRuns: FateKnotsRunStore = {
    ...runs.store,
    activeRunId: runs.store.activeRunId && removedRunIds.has(runs.store.activeRunId) ? null : runs.store.activeRunId,
    entries: runs.store.entries.filter((entry) => entry.run.universeId !== universeId),
  };
  api.setState(FATE_KNOTS_RUN_STORE_KEY, nextRuns);

  const nextUniverses: FateKnotsUniverseStore = {
    ...universes.store,
    activeUniverseId: universes.store.activeUniverseId === universeId ? null : universes.store.activeUniverseId,
    entries: universes.store.entries.filter((entry) => entry.universe.universeId !== universeId),
  };
  api.setState(FATE_KNOTS_UNIVERSE_STORE_KEY, nextUniverses);
  return { ok: true, value: cloneJson(nextUniverses), issues: [] };
}
