import type { FateKnotsPhase } from "../shared/contracts.js";
import {
  FATE_KNOTS_PERSISTENCE_VERSION,
  FATE_KNOTS_SESSION_STATE_KEY,
  readFateKnotsRunLibrary,
  readFateKnotsSessionState,
  readFateKnotsUniverseLibrary,
  type FateKnotsPersistenceApi,
  type FateKnotsPersistenceIssue,
} from "./persistence.js";

export interface FateKnotsHubUniverseSummary {
  universeId: string;
  title: string;
  createdAt: string;
  runIds: string[];
}

export interface FateKnotsHubRunSummary {
  runId: string;
  universeId: string;
  phase: FateKnotsPhase;
  revision: number;
  result: "active" | "completed" | "failed";
  canContinue: boolean;
}

export interface FateKnotsHubSnapshot {
  storageVersion: number;
  universes: FateKnotsHubUniverseSummary[];
  runs: FateKnotsHubRunSummary[];
  activeUniverseId: string | null;
  activeRunId: string | null;
  hasStorageIssues: boolean;
  issues: FateKnotsPersistenceIssue[];
}

function invalidSelectionIssue(entryId: string): FateKnotsPersistenceIssue {
  return {
    code: "invalid-session-selection",
    stateKey: FATE_KNOTS_SESSION_STATE_KEY,
    entryId,
  };
}

/**
 * Player-safe neutral Hub projection.
 *
 * This deliberately exposes saved-universe/run metadata only. It does not send
 * the canonical Universe Package, hidden knots, finale definition, NPC role
 * memory or other player-unknown world data to the neutral renderer.
 */
export function buildFateKnotsHubSnapshot(api: FateKnotsPersistenceApi): FateKnotsHubSnapshot {
  const universeRead = readFateKnotsUniverseLibrary(api);
  const runRead = readFateKnotsRunLibrary(api);
  const sessionRead = readFateKnotsSessionState(api);
  const issues = [...universeRead.issues, ...runRead.issues, ...sessionRead.issues];

  const universeIds = new Set(universeRead.value.universes.map((universe) => universe.universeId));
  const runById = new Map(runRead.value.runs.map((run) => [run.runId, run] as const));

  let activeUniverseId = sessionRead.value.activeUniverseId;
  let activeRunId = sessionRead.value.activeRunId;

  if (activeUniverseId !== null && !universeIds.has(activeUniverseId)) {
    issues.push(invalidSelectionIssue(activeUniverseId));
    activeUniverseId = null;
  }

  const activeRun = activeRunId === null ? null : runById.get(activeRunId) ?? null;
  if (activeRunId !== null && activeRun === null) {
    issues.push(invalidSelectionIssue(activeRunId));
    activeRunId = null;
  } else if (activeRun !== null) {
    if (!universeIds.has(activeRun.universeId)) {
      issues.push(invalidSelectionIssue(activeRun.universeId));
      activeRunId = null;
    } else if (activeUniverseId !== null && activeUniverseId !== activeRun.universeId) {
      issues.push({
        code: "run-universe-mismatch",
        stateKey: FATE_KNOTS_SESSION_STATE_KEY,
        entryId: activeRun.runId,
      });
      activeRunId = null;
    } else if (activeUniverseId === null) {
      activeUniverseId = activeRun.universeId;
    }
  }

  const runs: FateKnotsHubRunSummary[] = runRead.value.runs.map((run) => ({
    runId: run.runId,
    universeId: run.universeId,
    phase: run.phase,
    revision: run.revision,
    result: run.result,
    canContinue: run.result === "active" && run.phase !== "completed" && run.phase !== "failed",
  }));

  const universes: FateKnotsHubUniverseSummary[] = universeRead.value.universes.map((universe) => ({
    universeId: universe.universeId,
    title: universe.title,
    createdAt: universe.createdAt,
    runIds: runs.filter((run) => run.universeId === universe.universeId).map((run) => run.runId),
  }));

  return {
    storageVersion: FATE_KNOTS_PERSISTENCE_VERSION,
    universes,
    runs,
    activeUniverseId,
    activeRunId,
    hasStorageIssues: issues.length > 0,
    issues,
  };
}
