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

export interface FateKnotsDurableMutationResult<T>
  extends FateKnotsPersistenceMutationResult<T> {
  storageError?: string;
}

export interface FateKnotsDurableHydrationResult {
  ok: boolean;
  persistenceIssueCount: number;
  storageError: string | null;
}

function cloneJson<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function readStorageError(api: Pick<GameRoomHostApi, "getState">): string | null {
  const value = api.getState(FATE_KNOTS_DURABLE_STORAGE_ERROR_KEY);
  return typeof value === "string" && value.trim() !== "" ? value.trim() : null;
}

function setStorageError(
  api: Pick<GameRoomHostApi, "setState">,
  value: string | null
): void {
  api.setState(FATE_KNOTS_DURABLE_STORAGE_ERROR_KEY, value);
}

function restoreCacheValue(
  api: Pick<GameRoomHostApi, "setState">,
  key: string,
  value: unknown
): void {
  api.setState(key, cloneJson(value));
}

async function writeUniverseCache(api: GameRoomHostApi): Promise<void> {
  const paths = await resolveFateKnotsDurableStoragePaths();
  await writeFateKnotsJsonFile(paths.universesPath, loadFateKnotsUniverseStore(api).store);
}

async function writeRunCache(api: GameRoomHostApi): Promise<void> {
  const paths = await resolveFateKnotsDurableStoragePaths();
  await writeFateKnotsJsonFile(paths.runsPath, loadFateKnotsRunStore(api).store);
}

async function writeBothCaches(api: GameRoomHostApi): Promise<void> {
  await writeUniverseCache(api);
  await writeRunCache(api);
}

/**
 * Hydrates the validated in-memory Fate Knots stores from durable room storage.
 * RoomHostRuntime's state map is only a hot cache; the JSON files under
 * room-storage/game-room/fate-knots are the restart-safe source of persisted
 * Universe Packages and Run snapshots.
 */
export async function hydrateFateKnotsDurablePersistence(
  api: GameRoomHostApi
): Promise<FateKnotsDurableHydrationResult> {
  if (api.getState(FATE_KNOTS_DURABLE_HYDRATED_KEY) === true) {
    const universeIssues = loadFateKnotsUniverseStore(api).issues.length;
    const runIssues = loadFateKnotsRunStore(api).issues.length;
    return {
      ok: readStorageError(api) === null,
      persistenceIssueCount: universeIssues + runIssues,
      storageError: readStorageError(api),
    };
  }

  try {
    const paths = await resolveFateKnotsDurableStoragePaths();
    const [universeRaw, runRaw] = await Promise.all([
      readFateKnotsJsonFile(paths.universesPath),
      readFateKnotsJsonFile(paths.runsPath),
    ]);

    api.setState(FATE_KNOTS_UNIVERSE_STORE_KEY, universeRaw);
    api.setState(FATE_KNOTS_RUN_STORE_KEY, runRaw);

    const universes = loadFateKnotsUniverseStore(api);
    api.setState(FATE_KNOTS_UNIVERSE_STORE_KEY, cloneJson(universes.store));
    const runs = loadFateKnotsRunStore(api);
    api.setState(FATE_KNOTS_RUN_STORE_KEY, cloneJson(runs.store));
    api.setState(FATE_KNOTS_DURABLE_HYDRATED_KEY, true);
    setStorageError(api, null);

    return {
      ok: true,
      persistenceIssueCount: universes.issues.length + runs.issues.length,
      storageError: null,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    api.setState(FATE_KNOTS_UNIVERSE_STORE_KEY, null);
    api.setState(FATE_KNOTS_RUN_STORE_KEY, null);
    api.setState(FATE_KNOTS_DURABLE_HYDRATED_KEY, true);
    setStorageError(api, message);
    return {
      ok: false,
      persistenceIssueCount: 0,
      storageError: message,
    };
  }
}

async function persistSingleMutation<T>(
  api: GameRoomHostApi,
  storeKey: string,
  mutate: () => FateKnotsPersistenceMutationResult<T>,
  write: () => Promise<void>
): Promise<FateKnotsDurableMutationResult<T>> {
  const previous = cloneJson(api.getState(storeKey));
  const result = mutate();
  if (!result.ok) return result;

  try {
    await write();
    setStorageError(api, null);
    return result;
  } catch (error) {
    restoreCacheValue(api, storeKey, previous);
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

async function persistDualMutation<T>(
  api: GameRoomHostApi,
  mutate: () => FateKnotsPersistenceMutationResult<T>
): Promise<FateKnotsDurableMutationResult<T>> {
  const previousUniverse = cloneJson(api.getState(FATE_KNOTS_UNIVERSE_STORE_KEY));
  const previousRun = cloneJson(api.getState(FATE_KNOTS_RUN_STORE_KEY));
  const result = mutate();
  if (!result.ok) return result;

  try {
    await writeBothCaches(api);
    setStorageError(api, null);
    return result;
  } catch (error) {
    restoreCacheValue(api, FATE_KNOTS_UNIVERSE_STORE_KEY, previousUniverse);
    restoreCacheValue(api, FATE_KNOTS_RUN_STORE_KEY, previousRun);
    const storageError = error instanceof Error ? error.message : String(error);
    setStorageError(api, storageError);
    try {
      await writeBothCaches(api);
    } catch {
      // The original durable error remains authoritative. Cache is already rolled back.
    }
    return {
      ok: false,
      value: null,
      issues: result.issues,
      storageError,
    };
  }
}

export async function saveFateKnotsUniverseDurable(
  api: GameRoomHostApi,
  candidate: unknown,
  savedAt = new Date().toISOString()
): Promise<FateKnotsDurableMutationResult<FateKnotsUniversePackage>> {
  return await persistSingleMutation(
    api,
    FATE_KNOTS_UNIVERSE_STORE_KEY,
    () => saveFateKnotsUniverse(api, candidate, savedAt),
    async () => await writeUniverseCache(api)
  );
}

export async function saveFateKnotsRunSnapshotDurable(
  api: GameRoomHostApi,
  run: FateKnotsRunState,
  combatRuntime: FateKnotsCombatRuntimeState | null,
  savedAt = new Date().toISOString()
): Promise<FateKnotsDurableMutationResult<FateKnotsPersistedRunSnapshot>> {
  return await persistSingleMutation(
    api,
    FATE_KNOTS_RUN_STORE_KEY,
    () => saveFateKnotsRunSnapshot(api, run, combatRuntime, savedAt),
    async () => await writeRunCache(api)
  );
}

export async function activateFateKnotsUniverseDurable(
  api: GameRoomHostApi,
  universeId: string
): Promise<FateKnotsDurableMutationResult<FateKnotsUniversePackage>> {
  return await persistSingleMutation(
    api,
    FATE_KNOTS_UNIVERSE_STORE_KEY,
    () => activateFateKnotsUniverse(api, universeId),
    async () => await writeUniverseCache(api)
  );
}

export async function activateFateKnotsRunDurable(
  api: GameRoomHostApi,
  runId: string
): Promise<FateKnotsDurableMutationResult<FateKnotsPersistedRunSnapshot>> {
  return await persistDualMutation(api, () => activateFateKnotsRun(api, runId));
}

export async function deleteFateKnotsRunDurable(
  api: GameRoomHostApi,
  runId: string
): Promise<FateKnotsDurableMutationResult<FateKnotsRunStore>> {
  return await persistSingleMutation(
    api,
    FATE_KNOTS_RUN_STORE_KEY,
    () => deleteFateKnotsRun(api, runId),
    async () => await writeRunCache(api)
  );
}

export async function deleteFateKnotsUniverseDurable(
  api: GameRoomHostApi,
  universeId: string
): Promise<FateKnotsDurableMutationResult<FateKnotsUniverseStore>> {
  return await persistDualMutation(api, () => deleteFateKnotsUniverse(api, universeId));
}

export function getActiveFateKnotsUniverseDurable(api: GameRoomHostApi): FateKnotsUniversePackage | null {
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
