import type { GameRoomHostApi } from "../../../shared/host/activation.js";
import { readArgs } from "../../../shared/host/command-args.js";
import type { FateKnotsCombatRuntimeState } from "../shared/combat-runtime.js";
import type { FateKnotsRunState } from "../shared/contracts.js";
import {
  createFateKnotsRunFromSelections,
  listFateKnotsPlayerTemplates,
  type FateKnotsPlayerTemplateView,
  type FateKnotsRunSetupSelection,
} from "../shared/run-setup.js";
import {
  getFateKnotsDurableStorageError,
  getActiveFateKnotsRunSnapshotDurable,
  getActiveFateKnotsUniverseDurable,
  hydrateFateKnotsDurablePersistence,
  saveFateKnotsRunSnapshotDurable,
  saveFateKnotsUniverseDurable,
  activateFateKnotsRunDurable,
  activateFateKnotsUniverseDurable,
  deleteFateKnotsRunDurable,
  deleteFateKnotsUniverseDurable,
} from "./durable-persistence.js";
import {
  loadFateKnotsRunStore,
  loadFateKnotsUniverseStore,
} from "./persistence.js";

export const FATE_KNOTS_COMMAND_NAMES = {
  refresh: "GameRoomFateKnotsRefresh",
  saveUniverse: "GameRoomFateKnotsSaveUniverse",
  activateUniverse: "GameRoomFateKnotsActivateUniverse",
  deleteUniverse: "GameRoomFateKnotsDeleteUniverse",
  createRun: "GameRoomFateKnotsCreateRun",
  saveRun: "GameRoomFateKnotsSaveRun",
  activateRun: "GameRoomFateKnotsActivateRun",
  deleteRun: "GameRoomFateKnotsDeleteRun",
} as const;

interface FateKnotsRuntimeApi extends GameRoomHostApi {
  notifyRoom?(eventType: string, data: unknown): void;
}

export interface FateKnotsHostUniverseSummary {
  universeId: string;
  title: string;
  premise: string;
  savedAt: string;
}

export interface FateKnotsHostRunSummary {
  runId: string;
  universeId: string;
  phase: FateKnotsRunState["phase"];
  revision: number;
  result: FateKnotsRunState["result"];
  savedAt: string;
}

export interface FateKnotsHostState {
  featureId: "fate-knots";
  activeUniverseId: string | null;
  activeRunId: string | null;
  universes: FateKnotsHostUniverseSummary[];
  runs: FateKnotsHostRunSummary[];
  activeUniverse: ReturnType<typeof getActiveFateKnotsUniverseDurable>;
  activeRun: ReturnType<typeof getActiveFateKnotsRunSnapshotDurable>;
  playerTemplates: FateKnotsPlayerTemplateView[];
  persistenceIssueCount: number;
  storageError: string | null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function readStringArg(payload: unknown, key: string): string | null {
  const args = readArgs(payload);
  const value = args[key];
  return typeof value === "string" && value.trim() !== "" ? value.trim() : null;
}

function readObjectArg(payload: unknown, key: string): unknown {
  const args = readArgs(payload);
  return args[key];
}

function readRunSelections(payload: unknown): FateKnotsRunSetupSelection[] | null {
  const value = readObjectArg(payload, "selections");
  if (!Array.isArray(value)) return null;
  const selections: FateKnotsRunSetupSelection[] = [];
  for (const item of value) {
    if (!isRecord(item)) return null;
    const seatId = item["seatId"];
    const characterId = typeof item["characterId"] === "string" ? item["characterId"].trim() : "";
    if ((seatId !== "user" && seatId !== "ai2" && seatId !== "us1") || characterId === "") {
      return null;
    }
    selections.push({ seatId, characterId });
  }
  return selections;
}

function createRunId(): string {
  const uuid = globalThis.crypto?.randomUUID?.();
  const suffix = uuid ? uuid.replace(/-/g, "") : `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 10)}`;
  return `run-${suffix}`;
}

function result(success: boolean, message: string, state?: FateKnotsHostState) {
  return state ? { success, message, state } : { success, message };
}

export function buildFateKnotsHostState(api: FateKnotsRuntimeApi): FateKnotsHostState {
  const universes = loadFateKnotsUniverseStore(api);
  const runs = loadFateKnotsRunStore(api);
  const storageError = getFateKnotsDurableStorageError(api);
  const activeUniverse = getActiveFateKnotsUniverseDurable(api);
  return {
    featureId: "fate-knots",
    activeUniverseId: universes.store.activeUniverseId,
    activeRunId: runs.store.activeRunId,
    universes: universes.store.entries.map((entry) => ({
      universeId: entry.universe.universeId,
      title: entry.universe.title,
      premise: entry.universe.premise,
      savedAt: entry.savedAt,
    })),
    runs: runs.store.entries.map((entry) => ({
      runId: entry.run.runId,
      universeId: entry.run.universeId,
      phase: entry.run.phase,
      revision: entry.run.revision,
      result: entry.run.result,
      savedAt: entry.savedAt,
    })),
    activeUniverse,
    activeRun: getActiveFateKnotsRunSnapshotDurable(api),
    playerTemplates: activeUniverse ? listFateKnotsPlayerTemplates(activeUniverse) : [],
    persistenceIssueCount:
      universes.issues.length + runs.issues.length + (storageError === null ? 0 : 1),
    storageError,
  };
}

export function pushFateKnotsState(api: FateKnotsRuntimeApi): FateKnotsHostState {
  const state = buildFateKnotsHostState(api);
  api.notifyRoom?.("fate-knots-state", { state });
  return state;
}

export async function initializeFateKnotsState(
  api: FateKnotsRuntimeApi
): Promise<FateKnotsHostState> {
  const hydration = await hydrateFateKnotsDurablePersistence(api);
  const state = pushFateKnotsState(api);
  if (state.persistenceIssueCount > 0) {
    api.log(
      "warn",
      `Fate Knots persistence loaded with ${state.persistenceIssueCount} issue(s).${hydration.storageError ? ` storage=${hydration.storageError}` : ""}`
    );
  }
  return state;
}

export function handleFateKnotsRefresh(api: FateKnotsRuntimeApi) {
  return result(true, "Fate Knots state refreshed.", pushFateKnotsState(api));
}

export async function handleFateKnotsSaveUniverse(
  api: FateKnotsRuntimeApi,
  payload: unknown
) {
  const candidate = readObjectArg(payload, "universe");
  const saved = await saveFateKnotsUniverseDurable(api, candidate);
  if (!saved.ok) {
    return result(
      false,
      saved.storageError
        ? `Fate Knots universe could not be persisted: ${saved.storageError}`
        : "Fate Knots universe package was rejected."
    );
  }
  return result(true, "Fate Knots universe saved.", pushFateKnotsState(api));
}

export async function handleFateKnotsActivateUniverse(
  api: FateKnotsRuntimeApi,
  payload: unknown
) {
  const universeId = readStringArg(payload, "universeId");
  if (!universeId) return result(false, "Fate Knots universeId is required.");
  const activated = await activateFateKnotsUniverseDurable(api, universeId);
  if (!activated.ok) {
    return result(
      false,
      activated.storageError
        ? `Fate Knots universe activation could not be persisted: ${activated.storageError}`
        : "Fate Knots universe was not found."
    );
  }
  return result(true, "Fate Knots universe activated.", pushFateKnotsState(api));
}

export async function handleFateKnotsDeleteUniverse(
  api: FateKnotsRuntimeApi,
  payload: unknown
) {
  const universeId = readStringArg(payload, "universeId");
  if (!universeId) return result(false, "Fate Knots universeId is required.");
  const deleted = await deleteFateKnotsUniverseDurable(api, universeId);
  if (!deleted.ok) {
    return result(
      false,
      deleted.storageError
        ? `Fate Knots universe deletion could not be persisted: ${deleted.storageError}`
        : "Fate Knots universe was not found."
    );
  }
  return result(true, "Fate Knots universe deleted.", pushFateKnotsState(api));
}

export async function handleFateKnotsCreateRun(
  api: FateKnotsRuntimeApi,
  payload: unknown
) {
  const universe = getActiveFateKnotsUniverseDurable(api);
  if (!universe) return result(false, "Activate a Fate Knots universe before creating a run.");
  const selections = readRunSelections(payload);
  if (!selections) return result(false, "Fate Knots run selections are invalid.");
  const runId = readStringArg(payload, "runId") ?? createRunId();
  const created = createFateKnotsRunFromSelections(universe, runId, selections);
  if (!created.ok || !created.run) {
    return result(
      false,
      `Fate Knots run setup was rejected: ${created.issues.map((issue) => issue.code).join(", ")}`
    );
  }
  const saved = await saveFateKnotsRunSnapshotDurable(api, created.run, null);
  if (!saved.ok) {
    return result(
      false,
      saved.storageError
        ? `Fate Knots run could not be persisted: ${saved.storageError}`
        : "Fate Knots run snapshot was rejected."
    );
  }
  return result(true, "Fate Knots run created.", pushFateKnotsState(api));
}

export async function handleFateKnotsSaveRun(api: FateKnotsRuntimeApi, payload: unknown) {
  const runCandidate = readObjectArg(payload, "run");
  if (!isRecord(runCandidate)) return result(false, "Fate Knots run snapshot is required.");
  const runtimeCandidate = readObjectArg(payload, "combatRuntime");
  const combatRuntime =
    runtimeCandidate === undefined || runtimeCandidate === null
      ? null
      : (runtimeCandidate as FateKnotsCombatRuntimeState);
  const saved = await saveFateKnotsRunSnapshotDurable(
    api,
    runCandidate as unknown as FateKnotsRunState,
    combatRuntime
  );
  if (!saved.ok) {
    return result(
      false,
      saved.storageError
        ? `Fate Knots run could not be persisted: ${saved.storageError}`
        : "Fate Knots run snapshot was rejected."
    );
  }
  return result(true, "Fate Knots run saved.", pushFateKnotsState(api));
}

export async function handleFateKnotsActivateRun(
  api: FateKnotsRuntimeApi,
  payload: unknown
) {
  const runId = readStringArg(payload, "runId");
  if (!runId) return result(false, "Fate Knots runId is required.");
  const activated = await activateFateKnotsRunDurable(api, runId);
  if (!activated.ok) {
    return result(
      false,
      activated.storageError
        ? `Fate Knots run activation could not be persisted: ${activated.storageError}`
        : "Fate Knots run was not found."
    );
  }
  return result(true, "Fate Knots run activated.", pushFateKnotsState(api));
}

export async function handleFateKnotsDeleteRun(api: FateKnotsRuntimeApi, payload: unknown) {
  const runId = readStringArg(payload, "runId");
  if (!runId) return result(false, "Fate Knots runId is required.");
  const deleted = await deleteFateKnotsRunDurable(api, runId);
  if (!deleted.ok) {
    return result(
      false,
      deleted.storageError
        ? `Fate Knots run deletion could not be persisted: ${deleted.storageError}`
        : "Fate Knots run was not found."
    );
  }
  return result(true, "Fate Knots run deleted.", pushFateKnotsState(api));
}
