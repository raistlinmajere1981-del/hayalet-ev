import { buildFateKnotsHubSnapshot, type FateKnotsHubSnapshot } from "./hub-state.js";
import {
  deleteFateKnotsRun,
  deleteFateKnotsUniverse,
  saveFateKnotsSessionSelection,
  type FateKnotsPersistenceApi,
  type FateKnotsPersistenceIssue,
} from "./persistence.js";

export const FATE_KNOTS_MANAGEMENT_COMMAND_NAMES = {
  getHubState: "GameRoomFateKnotsGetHubState",
  activateUniverse: "GameRoomFateKnotsActivateUniverse",
  activateRun: "GameRoomFateKnotsActivateRun",
  deleteRun: "GameRoomFateKnotsDeleteRun",
  deleteUniverse: "GameRoomFateKnotsDeleteUniverse",
} as const;

type FateKnotsManagementCommandName =
  (typeof FATE_KNOTS_MANAGEMENT_COMMAND_NAMES)[keyof typeof FATE_KNOTS_MANAGEMENT_COMMAND_NAMES];

type GenericRecord = Record<string, unknown>;

export type FateKnotsManagementCommandResult =
  | { ok: true; hub: FateKnotsHubSnapshot; issues: FateKnotsPersistenceIssue[] }
  | {
      ok: false;
      error: "invalid-payload" | "persistence-rejected";
      hub: FateKnotsHubSnapshot;
      issues: FateKnotsPersistenceIssue[];
    };

function isRecord(value: unknown): value is GenericRecord {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function readRequiredId(payload: unknown, key: "universeId" | "runId"): string | null {
  if (!isRecord(payload)) return null;
  const value = payload[key];
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : null;
}

function invalidPayload(api: FateKnotsPersistenceApi): FateKnotsManagementCommandResult {
  return {
    ok: false,
    error: "invalid-payload",
    hub: buildFateKnotsHubSnapshot(api),
    issues: [],
  };
}

function rejected(
  api: FateKnotsPersistenceApi,
  issues: FateKnotsPersistenceIssue[]
): FateKnotsManagementCommandResult {
  return {
    ok: false,
    error: "persistence-rejected",
    hub: buildFateKnotsHubSnapshot(api),
    issues,
  };
}

function accepted(api: FateKnotsPersistenceApi): FateKnotsManagementCommandResult {
  const hub = buildFateKnotsHubSnapshot(api);
  return { ok: true, hub, issues: hub.issues };
}

/**
 * Neutral-Hub management commands only.
 *
 * There is intentionally no raw SaveUniverse/SaveRun command here. Canonical
 * Universe Packages and Run States are persisted by host-owned Forge/engine
 * flows; the renderer may only select or delete already accepted records.
 */
export function createFateKnotsManagementCommands(
  api: FateKnotsPersistenceApi
): Record<FateKnotsManagementCommandName, (payload?: unknown) => FateKnotsManagementCommandResult> {
  return {
    [FATE_KNOTS_MANAGEMENT_COMMAND_NAMES.getHubState]() {
      return accepted(api);
    },

    [FATE_KNOTS_MANAGEMENT_COMMAND_NAMES.activateUniverse](payload?: unknown) {
      const universeId = readRequiredId(payload, "universeId");
      if (!universeId) return invalidPayload(api);
      const saved = saveFateKnotsSessionSelection(api, {
        activeUniverseId: universeId,
        activeRunId: null,
      });
      return saved.ok ? accepted(api) : rejected(api, saved.issues);
    },

    [FATE_KNOTS_MANAGEMENT_COMMAND_NAMES.activateRun](payload?: unknown) {
      const runId = readRequiredId(payload, "runId");
      if (!runId) return invalidPayload(api);
      const saved = saveFateKnotsSessionSelection(api, {
        activeUniverseId: null,
        activeRunId: runId,
      });
      return saved.ok ? accepted(api) : rejected(api, saved.issues);
    },

    [FATE_KNOTS_MANAGEMENT_COMMAND_NAMES.deleteRun](payload?: unknown) {
      const runId = readRequiredId(payload, "runId");
      if (!runId) return invalidPayload(api);
      const before = buildFateKnotsHubSnapshot(api);
      const deleted = deleteFateKnotsRun(api, runId);
      if (!deleted.ok) return rejected(api, deleted.issues);
      if (before.activeRunId === runId) {
        const selection = saveFateKnotsSessionSelection(api, {
          activeUniverseId: before.activeUniverseId,
          activeRunId: null,
        });
        if (!selection.ok) return rejected(api, selection.issues);
      }
      return accepted(api);
    },

    [FATE_KNOTS_MANAGEMENT_COMMAND_NAMES.deleteUniverse](payload?: unknown) {
      const universeId = readRequiredId(payload, "universeId");
      if (!universeId) return invalidPayload(api);
      const before = buildFateKnotsHubSnapshot(api);
      const deleted = deleteFateKnotsUniverse(api, universeId);
      if (!deleted.ok) return rejected(api, deleted.issues);
      if (before.activeUniverseId === universeId) {
        const selection = saveFateKnotsSessionSelection(api, {
          activeUniverseId: null,
          activeRunId: null,
        });
        if (!selection.ok) return rejected(api, selection.issues);
      }
      return accepted(api);
    },
  };
}
