import type { GameRoomHostApi } from "../../../shared/host/activation.js";
import type { FateKnotsCombatRuntimeState } from "../shared/combat-runtime.js";
import type { FateKnotsRunState, FateKnotsUniversePackage } from "../shared/contracts.js";
import {
  FATE_KNOTS_RUN_STORE_KEY,
  FATE_KNOTS_UNIVERSE_STORE_KEY,
  activateFateKnotsRun,
  activateFateKnotsUniverse,
  deleteFateKnotsRun,
  deleteFateKnotsUniverse,
  getActiveFateKnotsRunSnapshot,
  getActiveFateKnotsUniverse,
  loadFateKnotsRunStore,
  loadFateKnotsUniverseStore,
  saveFateKnotsRunSnapshot,
  saveFateKnotsUniverse,
  type FateKnotsPersistedRunSnapshot,
  type FateKnotsPersistenceIssue,
  type FateKnotsPersistenceMutationResult,
  type FateKnotsRunStore,
  type FateKnotsUniverseStore,
} from "./persistence.js";
import {
  readFateKnotsJsonFile,
  resolveFateKnotsDurableStoragePaths,
  writeFateKnotsJsonFile,
} from "./storage-bridge.js";

const FATE_KNOTS_DURABLE_HYDRATED_KEY = "game-room:fate-knots:durable-hydrated:v1";
const FATE_KNOTS_DURABLE_STORAGE_ERROR_KEY = "game-room:fate-knots:durable-storage-error:v1";
const FATE_KNOTS_DURABLE_ENVELOPE_SCHEMA_VERSION = 1;

interface FateKnotsDurableEnvelope {
  schemaVersion: typeof FATE_KNOTS_DURABLE_ENVELOPE_SCHEMA_VERSION;
  universes: FateKnotsUniverseStore;
  runs: FateKnotsRunStore;
}

export type FateKnotsDurableMutationResult<T> = FateKnotsPersistenceMutationResult<T> & {
  storageError?: string;
};

export interface FateKnotsDurableHydrationResult {
  ok: boolean;
  persistenceIssueCount: number;
  storageError: string | null;
}

export interface FateKnotsDurableCommandFailure {
  ok: false;
  error: "persistence-rejected";
  issues: FateKnotsPersistenceIssue[];
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function cloneJson<T>(value: T): T {
  if (value === undefined || value === null) return value;
  return JSON.parse(JSON.stringify(value)) as T;
}

function readStorageError(api: Pick<GameRoomHostApi, "getState">): string | null {
  const value = api.getState(FATE_KNOTS_DURABLE_STORAGE_ERROR_KEY);
  return typeof value === "string" && value.trim() !== "" ? value.trim() : null;
}

function setStorageError(api: Pick<GameRoomHostApi, "setState">, value: string | null): void {
  api.setState(FATE_KNOTS_DURABLE_STORAGE_ERROR_KEY, value);
}

function restoreCacheValue(
  api: Pick<GameRoomHostApi, "setState">,
  key: string,
  value: unknown
): void {
  api.setState(key, cloneJson(value));
}

function uniqueIssueCount(api: GameRoomHostApi): number {
  const universeIssues = loadFateKnotsUniverseStore(api).issues;
  const runIssues = loadFateKnotsRunStore(api).issues;
  const fingerprints = new Set(
    [...universeIssues, ...runIssues].map(
      (issue) =>
        `${issue.code}\u0000${issue.entryId ?? ""}\u0000${JSON.stringify(issue.universeIssues ?? [])}`
    )
  );
  return fingerprints.size;
}

function buildValidatedEnvelope(api: GameRoomHostApi): FateKnotsDurableEnvelope {
  const universes = loadFateKnotsUniverseStore(api);
  const runs = loadFateKnotsRunStore(api);
  if (universes.issues.length > 0 || runs.issues.length > 0) {
    throw new Error(
      "Fate Knots durable state contains validation issues and cannot be overwritten."
    );
  }
  return {
    schemaVersion: FATE_KNOTS_DURABLE_ENVELOPE_SCHEMA_VERSION,
    universes: cloneJson(universes.store),
    runs: cloneJson(runs.store),
  };
}

async function writeStateEnvelope(api: GameRoomHostApi): Promise<void> {
  const paths = await resolveFateKnotsDurableStoragePaths();
  await writeFateKnotsJsonFile(paths.statePath, buildValidatedEnvelope(api));
}

function hydrateCachesFromEnvelope(
  api: GameRoomHostApi,
  raw: unknown
): { ok: boolean; issueCount: number; error: string | null } {
  if (
    !isRecord(raw) ||
    raw["schemaVersion"] !== FATE_KNOTS_DURABLE_ENVELOPE_SCHEMA_VERSION ||
    raw["universes"] === undefined ||
    raw["runs"] === undefined
  ) {
    return { ok: false, issueCount: 1, error: "Fate Knots durable state envelope is invalid." };
  }

  api.setState(FATE_KNOTS_UNIVERSE_STORE_KEY, cloneJson(raw["universes"]));
  api.setState(FATE_KNOTS_RUN_STORE_KEY, cloneJson(raw["runs"]));
  const universes = loadFateKnotsUniverseStore(api);
  const runs = loadFateKnotsRunStore(api);
  const issueCount = uniqueIssueCount(api);
  if (universes.issues.length > 0 || runs.issues.length > 0) {
    return {
      ok: false,
      issueCount,
      error: `Fate Knots durable state failed ${issueCount} validation check(s).`,
    };
  }

  api.setState(FATE_KNOTS_UNIVERSE_STORE_KEY, cloneJson(universes.store));
  api.setState(FATE_KNOTS_RUN_STORE_KEY, cloneJson(runs.store));
  return { ok: true, issueCount: 0, error: null };
}

/**
 * Hydrates one crash-atomic Universe+Run envelope. Legacy split JSON stores are
 * accepted only as a one-time migration source when the envelope does not yet
 * exist. Invalid persisted data is left fail-closed in the hot cache and is
 * never silently sanitized then written back over the source file.
 */
export async function hydrateFateKnotsDurablePersistence(
  api: GameRoomHostApi
): Promise<FateKnotsDurableHydrationResult> {
  if (api.getState(FATE_KNOTS_DURABLE_HYDRATED_KEY) === true) {
    const storageError = readStorageError(api);
    return {
      ok: storageError === null,
      persistenceIssueCount: uniqueIssueCount(api) + (storageError === null ? 0 : 1),
      storageError,
    };
  }

  try {
    const paths = await resolveFateKnotsDurableStoragePaths();
    const envelopeRaw = await readFateKnotsJsonFile(paths.statePath);
    if (envelopeRaw !== null) {
      const hydration = hydrateCachesFromEnvelope(api, envelopeRaw);
      api.setState(FATE_KNOTS_DURABLE_HYDRATED_KEY, true);
      setStorageError(api, hydration.error);
      return {
        ok: hydration.ok,
        persistenceIssueCount: hydration.issueCount + (hydration.error === null ? 0 : 1),
        storageError: hydration.error,
      };
    }

    const [universeRaw, runRaw] = await Promise.all([
      readFateKnotsJsonFile(paths.universesPath),
      readFateKnotsJsonFile(paths.runsPath),
    ]);
    api.setState(FATE_KNOTS_UNIVERSE_STORE_KEY, universeRaw);
    api.setState(FATE_KNOTS_RUN_STORE_KEY, runRaw);
    const universes = loadFateKnotsUniverseStore(api);
    const runs = loadFateKnotsRunStore(api);
    const issueCount = uniqueIssueCount(api);
    if (universes.issues.length > 0 || runs.issues.length > 0) {
      const message = `Legacy Fate Knots persistence failed ${issueCount} validation check(s).`;
      api.setState(FATE_KNOTS_DURABLE_HYDRATED_KEY, true);
      setStorageError(api, message);
      return {
        ok: false,
        persistenceIssueCount: issueCount + 1,
        storageError: message,
      };
    }

    api.setState(FATE_KNOTS_UNIVERSE_STORE_KEY, cloneJson(universes.store));
    api.setState(FATE_KNOTS_RUN_STORE_KEY, cloneJson(runs.store));
    if (universeRaw !== null || runRaw !== null) {
      await writeStateEnvelope(api);
    }
    api.setState(FATE_KNOTS_DURABLE_HYDRATED_KEY, true);
    setStorageError(api, null);
    return { ok: true, persistenceIssueCount: 0, storageError: null };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    api.setState(FATE_KNOTS_DURABLE_HYDRATED_KEY, true);
    setStorageError(api, message);
    return {
      ok: false,
      persistenceIssueCount: uniqueIssueCount(api) + 1,
      storageError: message,
    };
  }
}

async function persistStateMutation<T>(
  api: GameRoomHostApi,
  mutate: () => FateKnotsPersistenceMutationResult<T>
): Promise<FateKnotsDurableMutationResult<T>> {
  const existingStorageError = readStorageError(api);
  if (existingStorageError !== null) {
    return { ok: false, value: null, issues: [], storageError: existingStorageError };
  }

  const previousUniverse = cloneJson(api.getState(FATE_KNOTS_UNIVERSE_STORE_KEY));
  const previousRun = cloneJson(api.getState(FATE_KNOTS_RUN_STORE_KEY));
  const result = mutate();
  if (!result.ok) return result;

  try {
    await writeStateEnvelope(api);
    setStorageError(api, null);
    return result;
  } catch (error) {
    restoreCacheValue(api, FATE_KNOTS_UNIVERSE_STORE_KEY, previousUniverse);
    restoreCacheValue(api, FATE_KNOTS_RUN_STORE_KEY, previousRun);
    const storageError = error instanceof Error ? error.message : String(error);
    setStorageError(api, storageError);
    return {
      ok: false,
      value: null,
      issues: result.issues,
      storageError,
    };
  }
}

function durableCommandFailure(message: string): FateKnotsDurableCommandFailure {
  return {
    ok: false,
    error: "persistence-rejected",
    issues: [
      {
        code: "durable-storage-error",
        detail: message,
      },
    ],
  };
}

/**
 * Commits one intent-level host command through the same crash-atomic envelope
 * used by the stricter Stage C runtime. Failed multi-step commands are rolled
 * back so a partial cache mutation cannot become later canonical state.
 */
export async function persistFateKnotsCommandMutation<T extends { ok: boolean }>(
  api: GameRoomHostApi,
  mutate: () => T | Promise<T>
): Promise<T | FateKnotsDurableCommandFailure> {
  const existingStorageError = readStorageError(api);
  if (existingStorageError !== null) return durableCommandFailure(existingStorageError);

  const previousUniverse = cloneJson(api.getState(FATE_KNOTS_UNIVERSE_STORE_KEY));
  const previousRun = cloneJson(api.getState(FATE_KNOTS_RUN_STORE_KEY));
  const result = await mutate();
  if (!result.ok) {
    restoreCacheValue(api, FATE_KNOTS_UNIVERSE_STORE_KEY, previousUniverse);
    restoreCacheValue(api, FATE_KNOTS_RUN_STORE_KEY, previousRun);
    return result;
  }

  try {
    await writeStateEnvelope(api);
    setStorageError(api, null);
    return result;
  } catch (error) {
    restoreCacheValue(api, FATE_KNOTS_UNIVERSE_STORE_KEY, previousUniverse);
    restoreCacheValue(api, FATE_KNOTS_RUN_STORE_KEY, previousRun);
    const storageError = error instanceof Error ? error.message : String(error);
    setStorageError(api, storageError);
    return durableCommandFailure(storageError);
  }
}

export async function saveFateKnotsUniverseDurable(
  api: GameRoomHostApi,
  candidate: unknown,
  savedAt = new Date().toISOString()
): Promise<FateKnotsDurableMutationResult<FateKnotsUniversePackage>> {
  return await persistStateMutation(api, () => saveFateKnotsUniverse(api, candidate, savedAt));
}

export async function saveFateKnotsRunSnapshotDurable(
  api: GameRoomHostApi,
  run: FateKnotsRunState,
  combatRuntime: FateKnotsCombatRuntimeState | null,
  savedAt = new Date().toISOString()
): Promise<FateKnotsDurableMutationResult<FateKnotsPersistedRunSnapshot>> {
  return await persistStateMutation(api, () =>
    saveFateKnotsRunSnapshot(api, run, combatRuntime, savedAt)
  );
}

export async function activateFateKnotsUniverseDurable(
  api: GameRoomHostApi,
  universeId: string
): Promise<FateKnotsDurableMutationResult<FateKnotsUniversePackage>> {
  return await persistStateMutation(api, () => activateFateKnotsUniverse(api, universeId));
}

export async function activateFateKnotsRunDurable(
  api: GameRoomHostApi,
  runId: string
): Promise<FateKnotsDurableMutationResult<FateKnotsPersistedRunSnapshot>> {
  return await persistStateMutation(api, () => activateFateKnotsRun(api, runId));
}

export async function deleteFateKnotsRunDurable(
  api: GameRoomHostApi,
  runId: string
): Promise<FateKnotsDurableMutationResult<FateKnotsRunStore>> {
  return await persistStateMutation(api, () => deleteFateKnotsRun(api, runId));
}

export async function deleteFateKnotsUniverseDurable(
  api: GameRoomHostApi,
  universeId: string
): Promise<FateKnotsDurableMutationResult<FateKnotsUniverseStore>> {
  return await persistStateMutation(api, () => deleteFateKnotsUniverse(api, universeId));
}

export function getActiveFateKnotsUniverseDurable(
  api: GameRoomHostApi
): FateKnotsUniversePackage | null {
  return getActiveFateKnotsUniverse(api);
}

export function getActiveFateKnotsRunSnapshotDurable(
  api: GameRoomHostApi
): FateKnotsPersistedRunSnapshot | null {
  return getActiveFateKnotsRunSnapshot(api);
}

export function getFateKnotsDurableStorageError(api: GameRoomHostApi): string | null {
  return readStorageError(api);
}
