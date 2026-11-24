import type { FateKnotsPersistenceApi } from "./persistence.js";
import type { FateKnotsPlayerSeatId } from "./run-setup.js";

const FATE_KNOTS_RUN_SETUP_SEAT_STATE_KEY = "game-room:fate-knots:run-setup-seats:v1";
const FATE_KNOTS_RUN_SETUP_SEAT_SCHEMA_VERSION = 1;

interface FateKnotsRunSetupSeatEntry {
  universeId: string;
  selections: Partial<Record<FateKnotsPlayerSeatId, string>>;
}

interface FateKnotsRunSetupSeatStore {
  schemaVersion: typeof FATE_KNOTS_RUN_SETUP_SEAT_SCHEMA_VERSION;
  entries: FateKnotsRunSetupSeatEntry[];
}

export interface FateKnotsRunSetupSeatProjection {
  universeId: string;
  selections: Partial<Record<FateKnotsPlayerSeatId, string>>;
}

function emptyStore(): FateKnotsRunSetupSeatStore {
  return { schemaVersion: FATE_KNOTS_RUN_SETUP_SEAT_SCHEMA_VERSION, entries: [] };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function readStore(api: FateKnotsPersistenceApi): FateKnotsRunSetupSeatStore {
  const raw = api.getState(FATE_KNOTS_RUN_SETUP_SEAT_STATE_KEY);
  if (!isRecord(raw) || raw["schemaVersion"] !== FATE_KNOTS_RUN_SETUP_SEAT_SCHEMA_VERSION) {
    return emptyStore();
  }
  const rawEntries = raw["entries"];
  if (!Array.isArray(rawEntries)) return emptyStore();

  const entries: FateKnotsRunSetupSeatEntry[] = [];
  for (const rawEntry of rawEntries) {
    if (!isRecord(rawEntry)) continue;
    const universeId =
      typeof rawEntry["universeId"] === "string" ? rawEntry["universeId"].trim() : "";
    if (!universeId) continue;
    const rawSelections = isRecord(rawEntry["selections"]) ? rawEntry["selections"] : {};
    const selections: Partial<Record<FateKnotsPlayerSeatId, string>> = {};
    for (const seatId of ["user", "ai2", "us1"] as const) {
      const characterId = rawSelections[seatId];
      if (typeof characterId === "string" && characterId.trim() !== "") {
        selections[seatId] = characterId.trim();
      }
    }
    entries.push({ universeId, selections });
  }
  return { schemaVersion: FATE_KNOTS_RUN_SETUP_SEAT_SCHEMA_VERSION, entries };
}

function writeStore(api: FateKnotsPersistenceApi, store: FateKnotsRunSetupSeatStore): void {
  api.setState(FATE_KNOTS_RUN_SETUP_SEAT_STATE_KEY, structuredClone(store));
}

export function readFateKnotsRunSetupSeatProjection(
  api: FateKnotsPersistenceApi,
  universeId: string
): FateKnotsRunSetupSeatProjection {
  const entry = readStore(api).entries.find((candidate) => candidate.universeId === universeId);
  return {
    universeId,
    selections: entry ? { ...entry.selections } : {},
  };
}

export function setFateKnotsRunSetupSeatSelection(
  api: FateKnotsPersistenceApi,
  universeId: string,
  seatId: FateKnotsPlayerSeatId,
  characterId: string | null
): FateKnotsRunSetupSeatProjection {
  const store = readStore(api);
  const existing = store.entries.find((entry) => entry.universeId === universeId);
  const selections = existing ? { ...existing.selections } : {};
  if (characterId === null) delete selections[seatId];
  else selections[seatId] = characterId;

  const nextEntry: FateKnotsRunSetupSeatEntry = { universeId, selections };
  writeStore(api, {
    schemaVersion: FATE_KNOTS_RUN_SETUP_SEAT_SCHEMA_VERSION,
    entries: [...store.entries.filter((entry) => entry.universeId !== universeId), nextEntry],
  });
  return { universeId, selections: { ...selections } };
}

export function getFateKnotsRunSetupSeatSelection(
  api: FateKnotsPersistenceApi,
  universeId: string,
  seatId: FateKnotsPlayerSeatId
): string | null {
  return readFateKnotsRunSetupSeatProjection(api, universeId).selections[seatId] ?? null;
}

export function clearFateKnotsRunSetupSeatSelections(
  api: FateKnotsPersistenceApi,
  universeId: string
): void {
  const store = readStore(api);
  writeStore(api, {
    schemaVersion: FATE_KNOTS_RUN_SETUP_SEAT_SCHEMA_VERSION,
    entries: store.entries.filter((entry) => entry.universeId !== universeId),
  });
}
