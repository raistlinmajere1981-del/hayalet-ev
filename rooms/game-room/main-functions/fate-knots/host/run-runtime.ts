import { normalizeFateKnotsCanonicalUniversePackage } from "../forge/canonical-universe.js";
import {
  FATE_KNOTS_PLAYER_SEAT_IDS,
  createFateKnotsRunFromSetup,
  startFateKnotsRun,
  type FateKnotsPlayerSeatId,
  type FateKnotsRunPartyAssignment,
  type FateKnotsRunSetupIssue,
} from "./run-setup.js";
import { buildFateKnotsHubSnapshot, type FateKnotsHubSnapshot } from "./hub-state.js";
import {
  readFateKnotsRunLibrary,
  readFateKnotsUniverseLibrary,
  saveFateKnotsRun,
  saveFateKnotsSessionSelection,
  type FateKnotsPersistenceApi,
  type FateKnotsPersistenceIssue,
} from "./persistence.js";
import {
  clearFateKnotsRunSetupSeatSelections,
  getFateKnotsRunSetupSeatSelection,
} from "./run-setup-seat-coordination.js";

export const FATE_KNOTS_RUN_COMMAND_NAMES = {
  createRun: "GameRoomFateKnotsCreateRun",
  startRun: "GameRoomFateKnotsStartRun",
} as const;

type FateKnotsRunCommandName =
  (typeof FATE_KNOTS_RUN_COMMAND_NAMES)[keyof typeof FATE_KNOTS_RUN_COMMAND_NAMES];

type GenericRecord = Record<string, unknown>;

export interface FateKnotsRunCommandIssue {
  source: "payload" | "persistence" | "universe" | "run-setup" | "seat";
  code: string;
  value?: string;
}

export type FateKnotsRunCommandResult =
  | {
      ok: true;
      runId: string;
      phase: "run-setup" | "exploration";
      hub: FateKnotsHubSnapshot;
      issues: [];
    }
  | {
      ok: false;
      error:
        | "invalid-payload"
        | "player-seat-unavailable"
        | "seat-selection-required"
        | "universe-not-found"
        | "run-not-found"
        | "universe-rejected"
        | "run-setup-rejected"
        | "persistence-rejected";
      hub: FateKnotsHubSnapshot;
      issues: FateKnotsRunCommandIssue[];
    };

export interface FateKnotsRunCommandDependencies {
  createRunId?: () => string;
  isPlayerSeatAvailable?: (seatId: FateKnotsPlayerSeatId) => boolean;
}

let runIdSequence = 0;

function defaultCreateRunId(): string {
  runIdSequence += 1;
  return `fk-${Date.now().toString(36)}-${runIdSequence.toString(36)}`;
}

function isRecord(value: unknown): value is GenericRecord {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function readNonEmptyString(value: unknown): string | null {
  return typeof value === "string" && value.trim() !== "" ? value.trim() : null;
}

function readPlayerSeatId(value: unknown): FateKnotsPlayerSeatId | null {
  return typeof value === "string" &&
    FATE_KNOTS_PLAYER_SEAT_IDS.includes(value as FateKnotsPlayerSeatId)
    ? (value as FateKnotsPlayerSeatId)
    : null;
}

function readCreateRunPayload(payload: unknown): {
  universeId: string;
  party: FateKnotsRunPartyAssignment[];
} | null {
  if (!isRecord(payload)) return null;
  const universeId = readNonEmptyString(payload["universeId"]);
  const rawParty = payload["party"];
  if (!universeId || !Array.isArray(rawParty) || rawParty.length === 0) return null;

  const party: FateKnotsRunPartyAssignment[] = [];
  for (const value of rawParty) {
    if (!isRecord(value)) return null;
    const seatId = readPlayerSeatId(value["seatId"]);
    const characterId = readNonEmptyString(value["characterId"]);
    if (!seatId || !characterId) return null;
    party.push({ seatId, characterId });
  }
  return { universeId, party };
}

function readRunIdPayload(payload: unknown): string | null {
  return isRecord(payload) ? readNonEmptyString(payload["runId"]) : null;
}

function persistenceIssues(issues: FateKnotsPersistenceIssue[]): FateKnotsRunCommandIssue[] {
  return issues.map((entry) => ({
    source: "persistence" as const,
    code: entry.code,
    ...(entry.entryId ? { value: entry.entryId } : {}),
  }));
}

function setupIssues(issues: FateKnotsRunSetupIssue[]): FateKnotsRunCommandIssue[] {
  return issues.map((entry) => ({
    source: "run-setup" as const,
    code: entry.code,
    ...(entry.characterId
      ? { value: entry.characterId }
      : entry.value
        ? { value: entry.value }
        : entry.seatId
          ? { value: entry.seatId }
          : {}),
  }));
}

function failure(
  api: FateKnotsPersistenceApi,
  error: Exclude<FateKnotsRunCommandResult, { ok: true }>["error"],
  issues: FateKnotsRunCommandIssue[] = []
): FateKnotsRunCommandResult {
  return { ok: false, error, hub: buildFateKnotsHubSnapshot(api), issues };
}

function success(
  api: FateKnotsPersistenceApi,
  runId: string,
  phase: "run-setup" | "exploration"
): FateKnotsRunCommandResult {
  return { ok: true, runId, phase, hub: buildFateKnotsHubSnapshot(api), issues: [] };
}

function validateSeatOwnedSelections(
  api: FateKnotsPersistenceApi,
  universeId: string,
  party: readonly FateKnotsRunPartyAssignment[]
): FateKnotsRunCommandResult | null {
  for (const assignment of party) {
    if (assignment.seatId === "user") continue;
    const selectedCharacterId = getFateKnotsRunSetupSeatSelection(
      api,
      universeId,
      assignment.seatId
    );
    if (selectedCharacterId !== assignment.characterId) {
      return failure(api, "seat-selection-required", [
        {
          source: "seat",
          code: "seat-selection-required",
          value: assignment.seatId,
        },
      ]);
    }
  }
  return null;
}

/**
 * Intent-level run lifecycle commands. The room renderer chooses only an
 * accepted universe and player-character assignments; it never submits a raw
 * FateKnotsRunState for persistence.
 *
 * Optional player seats are ownership-bound: the World Host may decide whether
 * AI2/US1 participates, but the character assigned to such a seat must match the
 * latest choice submitted through that seat's own scoped setup command.
 */
export function createFateKnotsRunCommands(
  api: FateKnotsPersistenceApi,
  deps: FateKnotsRunCommandDependencies = {}
): Record<FateKnotsRunCommandName, (payload?: unknown) => FateKnotsRunCommandResult> {
  const createRunId = deps.createRunId ?? defaultCreateRunId;
  const isPlayerSeatAvailable = deps.isPlayerSeatAvailable ?? (() => true);

  return {
    [FATE_KNOTS_RUN_COMMAND_NAMES.createRun](payload?: unknown) {
      const request = readCreateRunPayload(payload);
      if (!request) {
        return failure(api, "invalid-payload", [{ source: "payload", code: "invalid-create-run" }]);
      }

      const unavailableSeat = request.party.find(
        (assignment) => assignment.seatId !== "user" && !isPlayerSeatAvailable(assignment.seatId)
      );
      if (unavailableSeat) {
        return failure(api, "player-seat-unavailable", [
          {
            source: "payload",
            code: "player-seat-unavailable",
            value: unavailableSeat.seatId,
          },
        ]);
      }

      const seatFailure = validateSeatOwnedSelections(api, request.universeId, request.party);
      if (seatFailure) return seatFailure;

      const universeRead = readFateKnotsUniverseLibrary(api);
      if (universeRead.issues.length > 0) {
        return failure(api, "persistence-rejected", persistenceIssues(universeRead.issues));
      }
      const storedUniverse = universeRead.value.universes.find(
        (universe) => universe.universeId === request.universeId
      );
      if (!storedUniverse) {
        return failure(api, "universe-not-found", [
          { source: "universe", code: "universe-not-found", value: request.universeId },
        ]);
      }

      const canonical = normalizeFateKnotsCanonicalUniversePackage(storedUniverse);
      if (!canonical.valid || !canonical.package) {
        return failure(
          api,
          "universe-rejected",
          canonical.issues.map((entry) => ({
            source: "universe" as const,
            code: entry.code,
            value: entry.path,
          }))
        );
      }

      const created = createFateKnotsRunFromSetup(canonical.package, {
        runId: createRunId(),
        party: request.party,
      });
      if (!created.ok) return failure(api, "run-setup-rejected", setupIssues(created.issues));

      const saved = saveFateKnotsRun(api, created.run);
      if (!saved.ok) return failure(api, "persistence-rejected", persistenceIssues(saved.issues));
      const selected = saveFateKnotsSessionSelection(api, {
        activeUniverseId: saved.value.universeId,
        activeRunId: saved.value.runId,
      });
      if (!selected.ok) {
        return failure(api, "persistence-rejected", persistenceIssues(selected.issues));
      }
      clearFateKnotsRunSetupSeatSelections(api, request.universeId);
      return success(api, saved.value.runId, "run-setup");
    },

    [FATE_KNOTS_RUN_COMMAND_NAMES.startRun](payload?: unknown) {
      const runId = readRunIdPayload(payload);
      if (!runId) {
        return failure(api, "invalid-payload", [{ source: "payload", code: "invalid-run-id" }]);
      }

      const runRead = readFateKnotsRunLibrary(api);
      if (runRead.issues.length > 0) {
        return failure(api, "persistence-rejected", persistenceIssues(runRead.issues));
      }
      const run = runRead.value.runs.find((entry) => entry.runId === runId);
      if (!run) {
        return failure(api, "run-not-found", [
          { source: "run-setup", code: "run-not-found", value: runId },
        ]);
      }

      const universeRead = readFateKnotsUniverseLibrary(api);
      if (universeRead.issues.length > 0) {
        return failure(api, "persistence-rejected", persistenceIssues(universeRead.issues));
      }
      const storedUniverse = universeRead.value.universes.find(
        (universe) => universe.universeId === run.universeId
      );
      if (!storedUniverse) {
        return failure(api, "universe-not-found", [
          { source: "universe", code: "universe-not-found", value: run.universeId },
        ]);
      }

      const canonical = normalizeFateKnotsCanonicalUniversePackage(storedUniverse);
      if (!canonical.valid || !canonical.package) {
        return failure(
          api,
          "universe-rejected",
          canonical.issues.map((entry) => ({
            source: "universe" as const,
            code: entry.code,
            value: entry.path,
          }))
        );
      }

      const started = startFateKnotsRun(canonical.package, run);
      if (!started.ok) return failure(api, "run-setup-rejected", setupIssues(started.issues));
      const saved = saveFateKnotsRun(api, started.run);
      if (!saved.ok) return failure(api, "persistence-rejected", persistenceIssues(saved.issues));
      const selected = saveFateKnotsSessionSelection(api, {
        activeUniverseId: saved.value.universeId,
        activeRunId: saved.value.runId,
      });
      if (!selected.ok) {
        return failure(api, "persistence-rejected", persistenceIssues(selected.issues));
      }
      return success(api, saved.value.runId, "exploration");
    },
  };
}
