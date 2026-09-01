import type { GameRoomHostApi } from "../../../shared/host/activation.js";
import { readArgs } from "../../../shared/host/command-args.js";
import type { FateKnotsCombatRuntimeState } from "../shared/combat-runtime.js";
import type { FateKnotsRunState } from "../shared/contracts.js";
import {
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
} from "./persistence.js";

export const FATE_KNOTS_COMMAND_NAMES = {
  refresh: "GameRoomFateKnotsRefresh",
  saveUniverse: "GameRoomFateKnotsSaveUniverse",
  activateUniverse: "GameRoomFateKnotsActivateUniverse",
  deleteUniverse: "GameRoomFateKnotsDeleteUniverse",
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
  activeUniverse: ReturnType<typeof getActiveFateKnotsUniverse>;
  activeRun: ReturnType<typeof getActiveFateKnotsRunSnapshot>;
  persistenceIssueCount: number;
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

function result(success: boolean, message: string, state?: FateKnotsHostState) {
  return state ? { success, message, state } : { success, message };
}

export function buildFateKnotsHostState(api: FateKnotsRuntimeApi): FateKnotsHostState {
  const universes = loadFateKnotsUniverseStore(api);
  const runs = loadFateKnotsRunStore(api);
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
    activeUniverse: getActiveFateKnotsUniverse(api),
    activeRun: getActiveFateKnotsRunSnapshot(api),
    persistenceIssueCount: universes.issues.length + runs.issues.length,
  };
}

export function pushFateKnotsState(api: FateKnotsRuntimeApi): FateKnotsHostState {
  const state = buildFateKnotsHostState(api);
  api.notifyRoom?.("fate-knots-state", { state });
  return state;
}

export function initializeFateKnotsState(api: FateKnotsRuntimeApi): FateKnotsHostState {
  const state = pushFateKnotsState(api);
  if (state.persistenceIssueCount > 0) {
    api.log("warn", `Fate Knots persistence loaded with ${state.persistenceIssueCount} rejected entry issue(s).`);
  }
  return state;
}

export function handleFateKnotsRefresh(api: FateKnotsRuntimeApi) {
  return result(true, "Fate Knots state refreshed.", pushFateKnotsState(api));
}

export function handleFateKnotsSaveUniverse(api: FateKnotsRuntimeApi, payload: unknown) {
  const candidate = readObjectArg(payload, "universe");
  const saved = saveFateKnotsUniverse(api, candidate);
  if (!saved.ok) return result(false, "Fate Knots universe package was rejected.");
  return result(true, "Fate Knots universe saved.", pushFateKnotsState(api));
}

export function handleFateKnotsActivateUniverse(api: FateKnotsRuntimeApi, payload: unknown) {
  const universeId = readStringArg(payload, "universeId");
  if (!universeId) return result(false, "Fate Knots universeId is required.");
  const activated = activateFateKnotsUniverse(api, universeId);
  if (!activated.ok) return result(false, "Fate Knots universe was not found.");
  return result(true, "Fate Knots universe activated.", pushFateKnotsState(api));
}

export function handleFateKnotsDeleteUniverse(api: FateKnotsRuntimeApi, payload: unknown) {
  const universeId = readStringArg(payload, "universeId");
  if (!universeId) return result(false, "Fate Knots universeId is required.");
  const deleted = deleteFateKnotsUniverse(api, universeId);
  if (!deleted.ok) return result(false, "Fate Knots universe was not found.");
  return result(true, "Fate Knots universe deleted.", pushFateKnotsState(api));
}

export function handleFateKnotsSaveRun(api: FateKnotsRuntimeApi, payload: unknown) {
  const runCandidate = readObjectArg(payload, "run");
  if (!isRecord(runCandidate)) return result(false, "Fate Knots run snapshot is required.");
  const runtimeCandidate = readObjectArg(payload, "combatRuntime");
  const combatRuntime =
    runtimeCandidate === undefined || runtimeCandidate === null
      ? null
      : (runtimeCandidate as FateKnotsCombatRuntimeState);
  const saved = saveFateKnotsRunSnapshot(
    api,
    runCandidate as unknown as FateKnotsRunState,
    combatRuntime
  );
  if (!saved.ok) return result(false, "Fate Knots run snapshot was rejected.");
  return result(true, "Fate Knots run saved.", pushFateKnotsState(api));
}

export function handleFateKnotsActivateRun(api: FateKnotsRuntimeApi, payload: unknown) {
  const runId = readStringArg(payload, "runId");
  if (!runId) return result(false, "Fate Knots runId is required.");
  const activated = activateFateKnotsRun(api, runId);
  if (!activated.ok) return result(false, "Fate Knots run was not found.");
  return result(true, "Fate Knots run activated.", pushFateKnotsState(api));
}

export function handleFateKnotsDeleteRun(api: FateKnotsRuntimeApi, payload: unknown) {
  const runId = readStringArg(payload, "runId");
  if (!runId) return result(false, "Fate Knots runId is required.");
  const deleted = deleteFateKnotsRun(api, runId);
  if (!deleted.ok) return result(false, "Fate Knots run was not found.");
  return result(true, "Fate Knots run deleted.", pushFateKnotsState(api));
}
