import { normalizeFateKnotsCanonicalUniversePackage } from "../forge/canonical-universe.js";
import { buildFateKnotsRunSetupSnapshot, type FateKnotsRunSetupSnapshot } from "./run-setup-state.js";
import {
  readFateKnotsUniverseLibrary,
  type FateKnotsPersistenceApi,
  type FateKnotsPersistenceIssue,
} from "./persistence.js";

export const FATE_KNOTS_RUN_SETUP_COMMAND_NAMES = {
  getRunSetup: "GameRoomFateKnotsGetRunSetup",
} as const;

export interface FateKnotsRunSetupCommandIssue {
  source: "payload" | "persistence" | "universe";
  code: string;
  value?: string;
}

export type FateKnotsRunSetupCommandResult =
  | { ok: true; setup: FateKnotsRunSetupSnapshot; issues: [] }
  | {
      ok: false;
      error: "invalid-payload" | "universe-not-found" | "universe-rejected" | "persistence-rejected";
      setup: null;
      issues: FateKnotsRunSetupCommandIssue[];
    };

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function readUniverseId(payload: unknown): string | null {
  if (!isRecord(payload)) return null;
  const value = payload["universeId"];
  return typeof value === "string" && value.trim() !== "" ? value.trim() : null;
}

function persistenceIssues(issues: FateKnotsPersistenceIssue[]): FateKnotsRunSetupCommandIssue[] {
  return issues.map((entry) => ({
    source: "persistence" as const,
    code: entry.code,
    ...(entry.entryId ? { value: entry.entryId } : {}),
  }));
}

/**
 * Returns only player-safe character setup data for one accepted universe.
 * The neutral renderer never receives the full canonical Universe Package.
 */
export function createFateKnotsRunSetupCommands(
  api: FateKnotsPersistenceApi
): Record<string, (payload?: unknown) => FateKnotsRunSetupCommandResult> {
  return {
    [FATE_KNOTS_RUN_SETUP_COMMAND_NAMES.getRunSetup](payload?: unknown) {
      const universeId = readUniverseId(payload);
      if (!universeId) {
        return {
          ok: false,
          error: "invalid-payload",
          setup: null,
          issues: [{ source: "payload", code: "invalid-universe-id" }],
        };
      }

      const universeRead = readFateKnotsUniverseLibrary(api);
      if (universeRead.issues.length > 0) {
        return {
          ok: false,
          error: "persistence-rejected",
          setup: null,
          issues: persistenceIssues(universeRead.issues),
        };
      }

      const storedUniverse = universeRead.value.universes.find(
        (universe) => universe.universeId === universeId
      );
      if (!storedUniverse) {
        return {
          ok: false,
          error: "universe-not-found",
          setup: null,
          issues: [{ source: "universe", code: "universe-not-found", value: universeId }],
        };
      }

      const canonical = normalizeFateKnotsCanonicalUniversePackage(storedUniverse);
      if (!canonical.valid || !canonical.package) {
        return {
          ok: false,
          error: "universe-rejected",
          setup: null,
          issues: canonical.issues.map((entry) => ({
            source: "universe" as const,
            code: entry.code,
            value: entry.path,
          })),
        };
      }

      return {
        ok: true,
        setup: buildFateKnotsRunSetupSnapshot(canonical.package),
        issues: [],
      };
    },
  };
}
