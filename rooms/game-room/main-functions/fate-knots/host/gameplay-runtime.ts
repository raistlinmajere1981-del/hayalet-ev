import { normalizeFateKnotsCanonicalUniversePackage } from "../forge/canonical-universe.js";
import {
  buildFateKnotsGameplayState,
  type FateKnotsGameplayState,
  type FateKnotsGameplayStateIssue,
} from "./gameplay-state.js";
import {
  readFateKnotsRunLibrary,
  readFateKnotsUniverseLibrary,
  type FateKnotsPersistenceApi,
  type FateKnotsPersistenceIssue,
} from "./persistence.js";

export const FATE_KNOTS_GAMEPLAY_COMMAND_NAMES = {
  getGameplayState: "GameRoomFateKnotsGetGameplayState",
} as const;

export interface FateKnotsGameplayCommandIssue {
  source: "payload" | "persistence" | "universe" | "gameplay-state";
  code: string;
  value?: string;
}

export type FateKnotsGameplayCommandResult =
  | { ok: true; state: FateKnotsGameplayState; issues: [] }
  | {
      ok: false;
      error:
        | "invalid-payload"
        | "run-not-found"
        | "universe-not-found"
        | "universe-rejected"
        | "gameplay-state-rejected"
        | "persistence-rejected";
      state: null;
      issues: FateKnotsGameplayCommandIssue[];
    };

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function readRunId(payload: unknown): string | null {
  if (!isRecord(payload)) return null;
  const value = payload["runId"];
  return typeof value === "string" && value.trim() !== "" ? value.trim() : null;
}

function persistenceIssues(issues: FateKnotsPersistenceIssue[]): FateKnotsGameplayCommandIssue[] {
  return issues.map((entry) => ({
    source: "persistence" as const,
    code: entry.code,
    ...(entry.entryId ? { value: entry.entryId } : {}),
  }));
}

function gameplayIssues(issues: FateKnotsGameplayStateIssue[]): FateKnotsGameplayCommandIssue[] {
  return issues.map((entry) => ({
    source: "gameplay-state" as const,
    code: entry.code,
    ...(entry.value ? { value: entry.value } : {}),
  }));
}

/**
 * Read-only renderer authority for an already persisted run.
 *
 * The command never returns raw canonical Universe/Run objects. All output is
 * rebuilt through buildFateKnotsGameplayState so hidden canon, enemy commits and
 * opposition card ownership remain host-side.
 */
export function createFateKnotsGameplayCommands(
  api: FateKnotsPersistenceApi
): Record<string, (payload?: unknown) => FateKnotsGameplayCommandResult> {
  return {
    [FATE_KNOTS_GAMEPLAY_COMMAND_NAMES.getGameplayState](payload?: unknown) {
      const runId = readRunId(payload);
      if (!runId) {
        return {
          ok: false,
          error: "invalid-payload",
          state: null,
          issues: [{ source: "payload", code: "invalid-run-id" }],
        };
      }

      const runRead = readFateKnotsRunLibrary(api);
      if (runRead.issues.length > 0) {
        return {
          ok: false,
          error: "persistence-rejected",
          state: null,
          issues: persistenceIssues(runRead.issues),
        };
      }
      const run = runRead.value.runs.find((entry) => entry.runId === runId);
      if (!run) {
        return {
          ok: false,
          error: "run-not-found",
          state: null,
          issues: [{ source: "gameplay-state", code: "run-not-found", value: runId }],
        };
      }

      const universeRead = readFateKnotsUniverseLibrary(api);
      if (universeRead.issues.length > 0) {
        return {
          ok: false,
          error: "persistence-rejected",
          state: null,
          issues: persistenceIssues(universeRead.issues),
        };
      }
      const storedUniverse = universeRead.value.universes.find(
        (universe) => universe.universeId === run.universeId
      );
      if (!storedUniverse) {
        return {
          ok: false,
          error: "universe-not-found",
          state: null,
          issues: [
            { source: "universe", code: "universe-not-found", value: run.universeId },
          ],
        };
      }

      const canonical = normalizeFateKnotsCanonicalUniversePackage(storedUniverse);
      if (!canonical.valid || !canonical.package) {
        return {
          ok: false,
          error: "universe-rejected",
          state: null,
          issues: canonical.issues.map((entry) => ({
            source: "universe" as const,
            code: entry.code,
            value: entry.path,
          })),
        };
      }

      const projected = buildFateKnotsGameplayState(canonical.package, run);
      if (!projected.ok) {
        return {
          ok: false,
          error: "gameplay-state-rejected",
          state: null,
          issues: gameplayIssues(projected.issues),
        };
      }

      return { ok: true, state: projected.state, issues: [] };
    },
  };
}
