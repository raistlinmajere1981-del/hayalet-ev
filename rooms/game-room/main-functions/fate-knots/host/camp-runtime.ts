import { normalizeFateKnotsCanonicalUniversePackage } from "../forge/canonical-universe.js";
import {
  leaveFateKnotsCamp,
  setFateKnotsCampEquipment,
  settleFateKnotsCampRecovery,
  type FateKnotsCampIssue,
} from "../shared/camp.js";
import type { FateKnotsRunState, FateKnotsUniversePackage } from "../shared/contracts.js";
import {
  loadFateKnotsRunStore,
  loadFateKnotsUniverseStore,
  saveFateKnotsRunSnapshot,
  type FateKnotsPersistenceApi,
  type FateKnotsPersistenceIssue,
} from "./persistence.js";

export type FateKnotsCampPlayerSeatId = "user" | "ai2" | "us1";

export const FATE_KNOTS_CAMP_COMMAND_NAMES = {
  open: "GameRoomFateKnotsOpenCamp",
  get: "GameRoomFateKnotsGetCampState",
  setLocalEquipment: "GameRoomFateKnotsSetCampEquipment",
  setAi2Equipment: "GameRoomFateKnotsAi2SetCampEquipment",
  setRemoteEquipment: "GameRoomFateKnotsRemoteSetCampEquipment",
  readyLocal: "GameRoomFateKnotsReadyCamp",
  readyAi2: "GameRoomFateKnotsAi2ReadyCamp",
  readyRemote: "GameRoomFateKnotsRemoteReadyCamp",
} as const;

const CAMP_COORDINATION_STATE_KEY = "game-room:fate-knots:camp-coordination:v1";
const PLAYER_SEATS: readonly FateKnotsCampPlayerSeatId[] = ["user", "ai2", "us1"];

interface FateKnotsCampHotState {
  runId: string;
  activeKnotId: string | null;
  activeLocationId: string;
  readySeatIds: FateKnotsCampPlayerSeatId[];
}

export interface FateKnotsCampStateProjection {
  runId: string;
  runRevision: number;
  activeLocationId: string;
  activeSeatIds: FateKnotsCampPlayerSeatId[];
  readySeatIds: FateKnotsCampPlayerSeatId[];
  exited: boolean;
}

export interface FateKnotsCampCommandIssue {
  source: "payload" | "persistence" | "universe" | "camp";
  code: string;
  value?: string;
}

export type FateKnotsCampCommandResult =
  | { ok: true; state: FateKnotsCampStateProjection; issues: [] }
  | {
      ok: false;
      error:
        | "invalid-payload"
        | "run-not-found"
        | "universe-not-found"
        | "universe-rejected"
        | "persistence-rejected"
        | "camp-rejected"
        | "seat-not-active"
        | "seat-ambiguous"
        | "seat-already-ready"
        | "save-rejected";
      state: null;
      issues: FateKnotsCampCommandIssue[];
    };

interface FateKnotsCampContext {
  run: FateKnotsRunState;
  universe: FateKnotsUniversePackage;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function readNonEmptyString(value: unknown): string | null {
  return typeof value === "string" && value.trim() !== "" ? value.trim() : null;
}

function readRunId(payload: unknown): string | null {
  return isRecord(payload) ? readNonEmptyString(payload["runId"]) : null;
}

function readEquipmentPayload(payload: unknown): {
  runId: string;
  slot: string;
  equipmentId: string | null;
} | null {
  if (!isRecord(payload)) return null;
  const runId = readNonEmptyString(payload["runId"]);
  const slot = readNonEmptyString(payload["slot"]);
  const rawEquipmentId = payload["equipmentId"];
  if (!runId || !slot) return null;
  if (rawEquipmentId !== null && typeof rawEquipmentId !== "string") return null;
  const equipmentId =
    typeof rawEquipmentId === "string" && rawEquipmentId.trim() !== ""
      ? rawEquipmentId.trim()
      : null;
  return { runId, slot, equipmentId };
}

function persistenceIssues(issues: FateKnotsPersistenceIssue[]): FateKnotsCampCommandIssue[] {
  return issues.map((issue) => ({
    source: "persistence" as const,
    code: issue.code,
    ...(issue.entryId ? { value: issue.entryId } : {}),
  }));
}

function campIssues(issues: FateKnotsCampIssue[]): FateKnotsCampCommandIssue[] {
  return issues.map((issue) => ({
    source: "camp" as const,
    code: issue.code,
    ...(issue.equipmentId
      ? { value: issue.equipmentId }
      : issue.actorId
        ? { value: issue.actorId }
        : issue.locationId
          ? { value: issue.locationId }
          : issue.slot
            ? { value: issue.slot }
            : {}),
  }));
}

function fail(
  error: Exclude<FateKnotsCampCommandResult, { ok: true }>["error"],
  issues: FateKnotsCampCommandIssue[]
): FateKnotsCampCommandResult {
  return { ok: false, error, state: null, issues };
}

function loadContext(
  api: FateKnotsPersistenceApi,
  runId: string
): { ok: true; context: FateKnotsCampContext } | { ok: false; result: FateKnotsCampCommandResult } {
  const runs = loadFateKnotsRunStore(api);
  if (runs.issues.length > 0) {
    return { ok: false, result: fail("persistence-rejected", persistenceIssues(runs.issues)) };
  }
  const snapshot = runs.store.entries.find((entry) => entry.run.runId === runId) ?? null;
  if (!snapshot) {
    return {
      ok: false,
      result: fail("run-not-found", [{ source: "camp", code: "run-not-found", value: runId }]),
    };
  }

  const universes = loadFateKnotsUniverseStore(api);
  if (universes.issues.length > 0) {
    return {
      ok: false,
      result: fail("persistence-rejected", persistenceIssues(universes.issues)),
    };
  }
  const storedUniverse = universes.store.entries.find(
    (entry) => entry.universe.universeId === snapshot.run.universeId
  )?.universe;
  if (!storedUniverse) {
    return {
      ok: false,
      result: fail("universe-not-found", [
        { source: "universe", code: "universe-not-found", value: snapshot.run.universeId },
      ]),
    };
  }

  const canonical = normalizeFateKnotsCanonicalUniversePackage(storedUniverse);
  if (!canonical.valid || !canonical.package) {
    return {
      ok: false,
      result: fail(
        "universe-rejected",
        canonical.issues.map((issue) => ({
          source: "universe" as const,
          code: issue.code,
          value: issue.path,
        }))
      ),
    };
  }
  return { ok: true, context: { run: snapshot.run, universe: canonical.package } };
}

function activePlayerSeats(run: FateKnotsRunState): {
  seats: FateKnotsCampPlayerSeatId[];
  ambiguousSeatId: FateKnotsCampPlayerSeatId | null;
} {
  const partyIds = new Set(run.partyActorIds);
  const counts = new Map<FateKnotsCampPlayerSeatId, number>();
  for (const actor of run.actors) {
    if (!partyIds.has(actor.actorId)) continue;
    const seatId = actor.seatId;
    if (!seatId || !PLAYER_SEATS.includes(seatId as FateKnotsCampPlayerSeatId)) continue;
    const playerSeatId = seatId as FateKnotsCampPlayerSeatId;
    counts.set(playerSeatId, (counts.get(playerSeatId) ?? 0) + 1);
  }
  for (const seatId of PLAYER_SEATS) {
    if ((counts.get(seatId) ?? 0) > 1) return { seats: [], ambiguousSeatId: seatId };
  }
  return {
    seats: PLAYER_SEATS.filter((seatId) => counts.get(seatId) === 1),
    ambiguousSeatId: null,
  };
}

function actorIdForSeat(run: FateKnotsRunState, seatId: FateKnotsCampPlayerSeatId): string | null {
  const partyIds = new Set(run.partyActorIds);
  const matches = run.actors.filter(
    (actor) => partyIds.has(actor.actorId) && actor.seatId === seatId
  );
  return matches.length === 1 ? (matches[0]?.actorId ?? null) : null;
}

function readHotState(value: unknown): FateKnotsCampHotState | null {
  if (!isRecord(value)) return null;
  const runId = readNonEmptyString(value["runId"]);
  const activeLocationId = readNonEmptyString(value["activeLocationId"]);
  const activeKnotId =
    value["activeKnotId"] === null ? null : readNonEmptyString(value["activeKnotId"]);
  if (!runId || !activeLocationId || (activeKnotId === null && value["activeKnotId"] !== null))
    return null;
  if (!Array.isArray(value["readySeatIds"])) return null;
  const readySeatIds = value["readySeatIds"].filter(
    (seatId): seatId is FateKnotsCampPlayerSeatId =>
      typeof seatId === "string" && PLAYER_SEATS.includes(seatId as FateKnotsCampPlayerSeatId)
  );
  return { runId, activeKnotId, activeLocationId, readySeatIds: Array.from(new Set(readySeatIds)) };
}

function scopedHotState(
  api: FateKnotsPersistenceApi,
  run: FateKnotsRunState
): FateKnotsCampHotState {
  const activeLocationId = run.activeLocationId ?? "";
  const stored = readHotState(api.getState(CAMP_COORDINATION_STATE_KEY));
  if (
    stored &&
    stored.runId === run.runId &&
    stored.activeKnotId === run.activeKnotId &&
    stored.activeLocationId === activeLocationId
  ) {
    return stored;
  }
  const fresh: FateKnotsCampHotState = {
    runId: run.runId,
    activeKnotId: run.activeKnotId,
    activeLocationId,
    readySeatIds: [],
  };
  api.setState(CAMP_COORDINATION_STATE_KEY, fresh);
  return fresh;
}

function project(
  api: FateKnotsPersistenceApi,
  run: FateKnotsRunState,
  exited = false
): FateKnotsCampCommandResult {
  if (run.phase !== "camp" && !exited) {
    return fail("camp-rejected", [{ source: "camp", code: "camp-phase-required" }]);
  }
  const seatResult = activePlayerSeats(run);
  if (seatResult.ambiguousSeatId) {
    return fail("seat-ambiguous", [
      { source: "camp", code: "seat-ambiguous", value: seatResult.ambiguousSeatId },
    ]);
  }
  const hot = exited
    ? {
        runId: run.runId,
        activeKnotId: run.activeKnotId,
        activeLocationId: run.activeLocationId ?? "",
        readySeatIds: [],
      }
    : scopedHotState(api, run);
  const readySeatIds = hot.readySeatIds.filter((seatId) => seatResult.seats.includes(seatId));
  return {
    ok: true,
    state: {
      runId: run.runId,
      runRevision: run.revision,
      activeLocationId: run.activeLocationId ?? "",
      activeSeatIds: seatResult.seats,
      readySeatIds,
      exited,
    },
    issues: [],
  };
}

function saveRun(
  api: FateKnotsPersistenceApi,
  run: FateKnotsRunState
): FateKnotsCampCommandResult | null {
  const saved = saveFateKnotsRunSnapshot(api, run, null);
  if (!saved.ok) return fail("save-rejected", persistenceIssues(saved.issues));
  return null;
}

function openCamp(api: FateKnotsPersistenceApi, payload: unknown): FateKnotsCampCommandResult {
  const runId = readRunId(payload);
  if (!runId) return fail("invalid-payload", [{ source: "payload", code: "invalid-run-id" }]);
  const loaded = loadContext(api, runId);
  if (!loaded.ok) return loaded.result;
  const settled = settleFateKnotsCampRecovery(loaded.context.universe, loaded.context.run);
  if (!settled.ok) return fail("camp-rejected", campIssues(settled.issues));
  if (settled.changed) {
    const saveFailure = saveRun(api, settled.run);
    if (saveFailure) return saveFailure;
  }
  return project(api, settled.run);
}

function getState(api: FateKnotsPersistenceApi, payload: unknown): FateKnotsCampCommandResult {
  const runId = readRunId(payload);
  if (!runId) return fail("invalid-payload", [{ source: "payload", code: "invalid-run-id" }]);
  const loaded = loadContext(api, runId);
  if (!loaded.ok) return loaded.result;
  return project(api, loaded.context.run);
}

function setEquipment(
  api: FateKnotsPersistenceApi,
  payload: unknown,
  seatId: FateKnotsCampPlayerSeatId
): FateKnotsCampCommandResult {
  const request = readEquipmentPayload(payload);
  if (!request) {
    return fail("invalid-payload", [{ source: "payload", code: "invalid-equipment-request" }]);
  }
  const loaded = loadContext(api, request.runId);
  if (!loaded.ok) return loaded.result;
  const seats = activePlayerSeats(loaded.context.run);
  if (seats.ambiguousSeatId) {
    return fail("seat-ambiguous", [
      { source: "camp", code: "seat-ambiguous", value: seats.ambiguousSeatId },
    ]);
  }
  if (!seats.seats.includes(seatId)) {
    return fail("seat-not-active", [{ source: "camp", code: "seat-not-active", value: seatId }]);
  }
  const hot = scopedHotState(api, loaded.context.run);
  if (hot.readySeatIds.includes(seatId)) {
    return fail("seat-already-ready", [
      { source: "camp", code: "seat-already-ready", value: seatId },
    ]);
  }
  const actorId = actorIdForSeat(loaded.context.run, seatId);
  if (!actorId) {
    return fail("seat-ambiguous", [{ source: "camp", code: "seat-ambiguous", value: seatId }]);
  }
  const changed = setFateKnotsCampEquipment(
    loaded.context.universe,
    loaded.context.run,
    actorId,
    request.slot,
    request.equipmentId
  );
  if (!changed.ok) return fail("camp-rejected", campIssues(changed.issues));
  if (changed.changed) {
    const saveFailure = saveRun(api, changed.run);
    if (saveFailure) return saveFailure;
  }
  return project(api, changed.run);
}

function ready(
  api: FateKnotsPersistenceApi,
  payload: unknown,
  seatId: FateKnotsCampPlayerSeatId
): FateKnotsCampCommandResult {
  const runId = readRunId(payload);
  if (!runId) return fail("invalid-payload", [{ source: "payload", code: "invalid-run-id" }]);
  const loaded = loadContext(api, runId);
  if (!loaded.ok) return loaded.result;
  const seats = activePlayerSeats(loaded.context.run);
  if (seats.ambiguousSeatId) {
    return fail("seat-ambiguous", [
      { source: "camp", code: "seat-ambiguous", value: seats.ambiguousSeatId },
    ]);
  }
  if (!seats.seats.includes(seatId)) {
    return fail("seat-not-active", [{ source: "camp", code: "seat-not-active", value: seatId }]);
  }

  const hot = scopedHotState(api, loaded.context.run);
  if (hot.readySeatIds.includes(seatId)) {
    return fail("seat-already-ready", [
      { source: "camp", code: "seat-already-ready", value: seatId },
    ]);
  }
  hot.readySeatIds = [...hot.readySeatIds, seatId];
  api.setState(CAMP_COORDINATION_STATE_KEY, hot);

  const allReady =
    seats.seats.length > 0 && seats.seats.every((id) => hot.readySeatIds.includes(id));
  if (!allReady) return project(api, loaded.context.run);

  const exited = leaveFateKnotsCamp(loaded.context.universe, loaded.context.run);
  if (!exited.ok) return fail("camp-rejected", campIssues(exited.issues));
  const saveFailure = saveRun(api, exited.run);
  if (saveFailure) return saveFailure;
  api.setState(CAMP_COORDINATION_STATE_KEY, null);
  return project(api, exited.run, true);
}

export function createFateKnotsCampCommands(
  api: FateKnotsPersistenceApi
): Record<string, (payload?: unknown) => FateKnotsCampCommandResult> {
  return {
    [FATE_KNOTS_CAMP_COMMAND_NAMES.open](payload?: unknown) {
      return openCamp(api, payload);
    },
    [FATE_KNOTS_CAMP_COMMAND_NAMES.get](payload?: unknown) {
      return getState(api, payload);
    },
    [FATE_KNOTS_CAMP_COMMAND_NAMES.setLocalEquipment](payload?: unknown) {
      return setEquipment(api, payload, "user");
    },
    [FATE_KNOTS_CAMP_COMMAND_NAMES.setAi2Equipment](payload?: unknown) {
      return setEquipment(api, payload, "ai2");
    },
    [FATE_KNOTS_CAMP_COMMAND_NAMES.setRemoteEquipment](payload?: unknown) {
      return setEquipment(api, payload, "us1");
    },
    [FATE_KNOTS_CAMP_COMMAND_NAMES.readyLocal](payload?: unknown) {
      return ready(api, payload, "user");
    },
    [FATE_KNOTS_CAMP_COMMAND_NAMES.readyAi2](payload?: unknown) {
      return ready(api, payload, "ai2");
    },
    [FATE_KNOTS_CAMP_COMMAND_NAMES.readyRemote](payload?: unknown) {
      return ready(api, payload, "us1");
    },
  };
}
