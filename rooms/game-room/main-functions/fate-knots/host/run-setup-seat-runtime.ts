import { normalizeFateKnotsCanonicalUniversePackage } from "../forge/canonical-universe.js";
import {
  loadFateKnotsUniverseStore,
  type FateKnotsPersistenceApi,
  type FateKnotsPersistenceIssue,
} from "./persistence.js";
import {
  readFateKnotsRunSetupSeatProjection,
  setFateKnotsRunSetupSeatSelection,
  type FateKnotsRunSetupSeatProjection,
} from "./run-setup-seat-coordination.js";
import { buildFateKnotsRunSetupSnapshot, type FateKnotsRunSetupSnapshot } from "./run-setup-state.js";
import type { FateKnotsPlayerSeatId } from "./run-setup.js";

export const FATE_KNOTS_RUN_SETUP_SEAT_COMMAND_NAMES = {
  getAi2: "GameRoomFateKnotsAi2GetRunSetup",
  getRemote: "GameRoomFateKnotsRemoteGetRunSetup",
  selectLocal: "GameRoomFateKnotsSelectRunCharacter",
  selectAi2: "GameRoomFateKnotsAi2SelectRunCharacter",
  selectRemote: "GameRoomFateKnotsRemoteSelectRunCharacter",
} as const;

export interface FateKnotsRunSetupSeatIssue {
  source: "payload" | "persistence" | "universe" | "seat";
  code: string;
  value?: string;
}

type SetupResult =
  | { ok: true; setup: FateKnotsRunSetupSnapshot; issues: [] }
  | { ok: false; error: string; setup: null; issues: FateKnotsRunSetupSeatIssue[] };

type SelectionResult =
  | { ok: true; state: FateKnotsRunSetupSeatProjection; issues: [] }
  | { ok: false; error: string; state: null; issues: FateKnotsRunSetupSeatIssue[] };

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function readString(value: unknown): string | null {
  return typeof value === "string" && value.trim() !== "" ? value.trim() : null;
}

function persistenceIssues(issues: FateKnotsPersistenceIssue[]): FateKnotsRunSetupSeatIssue[] {
  return issues.map((issue) => ({
    source: "persistence" as const,
    code: issue.code,
    ...(issue.entryId ? { value: issue.entryId } : {}),
  }));
}

function loadSetup(
  api: FateKnotsPersistenceApi,
  universeId: string
): SetupResult {
  const universes = loadFateKnotsUniverseStore(api);
  if (universes.issues.length > 0) {
    return { ok: false, error: "persistence-rejected", setup: null, issues: persistenceIssues(universes.issues) };
  }
  const stored = universes.store.entries.find((entry) => entry.universe.universeId === universeId)?.universe;
  if (!stored) {
    return {
      ok: false,
      error: "universe-not-found",
      setup: null,
      issues: [{ source: "universe", code: "universe-not-found", value: universeId }],
    };
  }
  const canonical = normalizeFateKnotsCanonicalUniversePackage(stored);
  if (!canonical.valid || !canonical.package) {
    return {
      ok: false,
      error: "universe-rejected",
      setup: null,
      issues: canonical.issues.map((issue) => ({
        source: "universe" as const,
        code: issue.code,
        value: issue.path,
      })),
    };
  }
  return { ok: true, setup: buildFateKnotsRunSetupSnapshot(canonical.package), issues: [] };
}

function readUniverseId(payload: unknown): string | null {
  return isRecord(payload) ? readString(payload["universeId"]) : null;
}

function select(
  api: FateKnotsPersistenceApi,
  payload: unknown,
  seatId: FateKnotsPlayerSeatId
): SelectionResult {
  if (!isRecord(payload)) {
    return { ok: false, error: "invalid-payload", state: null, issues: [{ source: "payload", code: "invalid-selection" }] };
  }
  const universeId = readString(payload["universeId"]);
  const rawCharacterId = payload["characterId"];
  const characterId = rawCharacterId === null ? null : readString(rawCharacterId);
  if (!universeId || (rawCharacterId !== null && !characterId)) {
    return { ok: false, error: "invalid-payload", state: null, issues: [{ source: "payload", code: "invalid-selection" }] };
  }

  const setup = loadSetup(api, universeId);
  if (!setup.ok) return { ok: false, error: setup.error, state: null, issues: setup.issues };

  if (characterId !== null && !setup.setup.characters.some((character) => character.characterId === characterId)) {
    return {
      ok: false,
      error: "character-not-player-selectable",
      state: null,
      issues: [{ source: "universe", code: "character-not-player-selectable", value: characterId }],
    };
  }

  const current = readFateKnotsRunSetupSeatProjection(api, universeId);
  if (
    characterId !== null &&
    Object.entries(current.selections).some(
      ([otherSeatId, selectedCharacterId]) => otherSeatId !== seatId && selectedCharacterId === characterId
    )
  ) {
    return {
      ok: false,
      error: "character-already-selected",
      state: null,
      issues: [{ source: "seat", code: "character-already-selected", value: characterId }],
    };
  }

  return {
    ok: true,
    state: setFateKnotsRunSetupSeatSelection(api, universeId, seatId, characterId),
    issues: [],
  };
}

export function createFateKnotsRunSetupSeatCommands(api: FateKnotsPersistenceApi) {
  return {
    [FATE_KNOTS_RUN_SETUP_SEAT_COMMAND_NAMES.getAi2](payload?: unknown): SetupResult {
      const universeId = readUniverseId(payload);
      if (!universeId) {
        return { ok: false, error: "invalid-payload", setup: null, issues: [{ source: "payload", code: "invalid-universe-id" }] };
      }
      return loadSetup(api, universeId);
    },
    [FATE_KNOTS_RUN_SETUP_SEAT_COMMAND_NAMES.getRemote](payload?: unknown): SetupResult {
      const universeId = readUniverseId(payload);
      if (!universeId) {
        return { ok: false, error: "invalid-payload", setup: null, issues: [{ source: "payload", code: "invalid-universe-id" }] };
      }
      return loadSetup(api, universeId);
    },
    [FATE_KNOTS_RUN_SETUP_SEAT_COMMAND_NAMES.selectLocal](payload?: unknown): SelectionResult {
      return select(api, payload, "user");
    },
    [FATE_KNOTS_RUN_SETUP_SEAT_COMMAND_NAMES.selectAi2](payload?: unknown): SelectionResult {
      return select(api, payload, "ai2");
    },
    [FATE_KNOTS_RUN_SETUP_SEAT_COMMAND_NAMES.selectRemote](payload?: unknown): SelectionResult {
      return select(api, payload, "us1");
    },
  };
}
