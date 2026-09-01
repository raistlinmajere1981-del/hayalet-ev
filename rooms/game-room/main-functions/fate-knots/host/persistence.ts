import type { GameRoomHostApi } from "../../../shared/host/activation.js";
import {
  FATE_KNOTS_PHASES,
  FATE_KNOTS_SCHEMA_VERSION,
  type FateKnotsCombatState,
  type FateKnotsRunState,
  type FateKnotsUniversePackage,
} from "../shared/contracts.js";
import {
  normalizeFateKnotsUniversePackage,
  type FateKnotsUniverseValidationIssue,
} from "../forge/universe-validation.js";
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

function readStringArray(value: unknown): string[] | null {
  return Array.isArray(value) && value.every((entry) => typeof entry === "string")
    ? value.slice()
    : null;
}

function cloneJson<T>(value: T): T {
  // Persisted Fate Knots state is intentionally JSON-only. Cloning at this
  // boundary prevents UI/host references from mutating stored snapshots.
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
  if (value["activeLocationId"] !== null && typeof value["activeLocationId"] !== "string") {
    return false;
  }
  if (
    !readStringArray(value["revealedLocationIds"]) ||
    !readStringArray(value["revealedKnotIds"]) ||
    !readStringArray(value["completedKnotIds"]) ||
    !readStringArray(value["partyActorIds"]) ||
    !readStringArray(value["teamPoolItemIds"])
  ) {
    return false;
  }
  if (!Array.isArray(value["actors"])) return false;
  if (value["finaleUnlocked"] !== true && value["finaleUnlocked"] !== false) return false;
  if (value["result"] !== "active" && value["result"] !== "completed" && value["result"] !== "failed") {
    return false;
  }

  const activeCombat = value["activeCombat"];
  const phase = value["phase"];
  if (activeCombat === null) {
    if (isCombatPhase(phase)) return false;
  } else {
    if (!isRecord(activeCombat) || !readNonEmptyString(activeCombat["combatId"])) return false;
    if (!isCombatPhase(activeCombat["phase"]) || activeCombat["phase"] !== phase) return false;
    if (!Array.isArray(activeCombat["actors"]) || !Array.isArray(activeCombat["commits"])) return false;
  }

  if (value["result"] === "completed" && phase !== "completed") return false;
  if (value["result"] === "failed" && phase !== "failed") return false;
  if (value["result"] === "active" && (phase === "completed" || phase === "failed")) return false;
  return true;
}

function isCombatRuntimeShape(value: unknown): value is FateKnotsCombatRuntimeState {
  if (!isRecord(value) || !Array.isArray(value["actorRuntime"])) return false;
  if (
    !Array.isArray(value["retreatRequestedTeamIds"]) ||
    value["retreatRequestedTeamIds"].some(
      (teamId) => teamId !== "party" && teamId !== "opposition"
    )
  ) {
    return false;
  }

  return value["actorRuntime"].every((actor) => {
    if (!isRecord(actor) || !readNonEmptyString(actor["actorId"])) return false;
    if (typeof actor["shield"] !== "number" || !Number.isFinite(actor["shield"]) || actor["shield"] < 0) {
      return false;
    }
    return Array.isArray(actor["statModifiers"]) && Array.isArray(actor["timedStatuses"]);
  });
}

function runtimeMatchesCombat(
  combat: FateKnotsCombatState,
  runtime: FateKnotsCombatRuntimeState
): boolean {
  const combatActorIds = new Set(
    combat.actors
      .map((actor) => readNonEmptyString((actor as unknown as Record<string, unknown>)["actorId"]))
      .filter((actorId): actorId is string => actorId !== null)
  );
  const runtimeActorIds = new Set(runtime.actorRuntime.map((actor) => actor.actorId));
  if (combatActorIds.size !== combat.actors.length || combatActorIds.size !== runtimeActorIds.size) {
    return false;
  }
  for (const actorId of combatActorIds) {
    if (!runtimeActorIds.has(actorId)) return false;
  }
  return true;
}

function normalizeRunSnapshot(candidate: unknown): FateKnotsPersistedRunSnapshot | null {
  if (!isRecord(candidate) || !isRunShape(candidate["run"])) return null;
  const run = cloneJson(candidate["run"]);
  const runtimeCandidate = candidate["combatRuntime"];

  if (run.activeCombat) {
    if (!isCombatRuntimeShape(runtimeCandidate)) return null;
    const combatRuntime = cloneJson(runtimeCandidate);
    if (!runtimeMatchesCombat(run.activeCombat, combatRuntime)) return null;
    return {
      run,
      combatRuntime,
      savedAt: normalizeSavedAt(candidate["savedAt"]),
    };
  }

  if (runtimeCandidate !== null && runtimeCandidate !== undefined) return null;
  return {
    run,
    combatRuntime: null,
    savedAt: normalizeSavedAt(candidate["savedAt"]),
  };
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

export function loadFateKnotsUniverseStore(api: GameRoomHostApi): FateKnotsUniverseStoreLoadResult {
  const candidate = api.getState(FATE_KNOTS_UNIVERSE_STORE_KEY);
  if (candidate === undefined || candidate === null) {
    return { store: createEmptyUniverseStore(), issues: [] };
  }
  if (!isRecord(candidate) || candidate["schemaVersion"] !== FATE_KNOTS_PERSISTENCE_SCHEMA_VERSION) {
    return { store: createEmptyUniverseStore(), issues: [{ code: "invalid-store" }] };
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
      issues.push({ code: "invalid-universe-entry", universeIssues: normalized.issues });
      continue;
    }
    entries.push({
      universe: normalized.package,
      savedAt: normalizeSavedAt(rawEntry["savedAt"]),
    });
  }

  const activeCandidate = readNonEmptyString(candidate["activeUniverseId"]);
  const activeUniverseId =
    activeCandidate && entries.some((entry) => entry.universe.universeId === activeCandidate)
      ? activeCandidate
      : null;
  return {
    store: {
      schemaVersion: FATE_KNOTS_PERSISTENCE_SCHEMA_VERSION,
      activeUniverseId,
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
  const universeStore = loadFateKnotsUniverseStore(api).store;
  const universeIds = new Set(
    universeStore.entries.map((entry) => entry.universe.universeId)
  );

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
    const snapshot = normalizeRunSnapshot(rawEntry);
    if (!snapshot) {
      issues.push({ code: "invalid-run-entry" });
      continue;
    }
    if (!universeIds.has(snapshot.run.universeId)) {
      issues.push({ code: "run-universe-not-found", entryId: snapshot.run.runId });
      continue;
    }
    entries.push(snapshot);
  }

  const activeCandidate = readNonEmptyString(candidate["activeRunId"]);
  const activeRunId =
    activeCandidate && entries.some((entry) => entry.run.runId === activeCandidate)
      ? activeCandidate
      : null;
  return {
    store: {
      schemaVersion: FATE_KNOTS_PERSISTENCE_SCHEMA_VERSION,
      activeRunId,
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

  const snapshot = normalizeRunSnapshot({
    run: runInput,
    combatRuntime: combatRuntimeInput,
    savedAt,
  });
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
  const entries = loaded.store.entries.filter((entry) => entry.run.runId !== snapshot.run.runId);
  entries.push(cloneJson(snapshot));
  const store: FateKnotsRunStore = {
    schemaVersion: FATE_KNOTS_PERSISTENCE_SCHEMA_VERSION,
    activeRunId: snapshot.run.runId,
    entries,
  };
  api.setState(FATE_KNOTS_RUN_STORE_KEY, store);
  return { ok: true, value: cloneJson(snapshot), issues: loaded.issues };
}

export function getActiveFateKnotsUniverse(api: GameRoomHostApi): FateKnotsUniversePackage | null {
  const store = loadFateKnotsUniverseStore(api).store;
  if (!store.activeUniverseId) return null;
  const entry = store.entries.find(
    (candidate) => candidate.universe.universeId === store.activeUniverseId
  );
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
  const entry = loaded.store.entries.find(
    (candidate) => candidate.universe.universeId === universeId
  );
  if (!entry) {
    return {
      ok: false,
      value: null,
      issues: [{ code: "universe-not-found", entryId: universeId }],
    };
  }
  api.setState(FATE_KNOTS_UNIVERSE_STORE_KEY, {
    ...loaded.store,
    activeUniverseId: universeId,
  });
  return { ok: true, value: cloneJson(entry.universe), issues: loaded.issues };
}

export function activateFateKnotsRun(
  api: GameRoomHostApi,
  runId: string
): FateKnotsPersistenceMutationResult<FateKnotsPersistedRunSnapshot> {
  const loaded = loadFateKnotsRunStore(api);
  const entry = loaded.store.entries.find((candidate) => candidate.run.runId === runId);
  if (!entry) {
    return { ok: false, value: null, issues: [{ code: "run-not-found", entryId: runId }] };
  }
  const universeActivation = activateFateKnotsUniverse(api, entry.run.universeId);
  if (!universeActivation.ok) {
    return { ok: false, value: null, issues: universeActivation.issues };
  }
  api.setState(FATE_KNOTS_RUN_STORE_KEY, {
    ...loaded.store,
    activeRunId: runId,
  });
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
    return {
      ok: false,
      value: null,
      issues: [{ code: "universe-not-found", entryId: universeId }],
    };
  }

  const runs = loadFateKnotsRunStore(api);
  const removedRunIds = new Set(
    runs.store.entries
      .filter((entry) => entry.run.universeId === universeId)
      .map((entry) => entry.run.runId)
  );
  const nextRuns: FateKnotsRunStore = {
    ...runs.store,
    activeRunId:
      runs.store.activeRunId && removedRunIds.has(runs.store.activeRunId)
        ? null
        : runs.store.activeRunId,
    entries: runs.store.entries.filter((entry) => entry.run.universeId !== universeId),
  };
  api.setState(FATE_KNOTS_RUN_STORE_KEY, nextRuns);

  const nextUniverses: FateKnotsUniverseStore = {
    ...universes.store,
    activeUniverseId:
      universes.store.activeUniverseId === universeId ? null : universes.store.activeUniverseId,
    entries: universes.store.entries.filter(
      (entry) => entry.universe.universeId !== universeId
    ),
  };
  api.setState(FATE_KNOTS_UNIVERSE_STORE_KEY, nextUniverses);
  return {
    ok: true,
    value: cloneJson(nextUniverses),
    issues: [...universes.issues, ...runs.issues],
  };
}
