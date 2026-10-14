import type { GameRoomHostApi } from "../../../shared/host/activation.js";
import type { FateKnotsSessionRef } from "./transport.js";

const FATE_KNOTS_SESSION_STATE_KEY = "game-room.fate-knots.transport-sessions.v1";
const FATE_KNOTS_SESSION_STATE_VERSION = 1;

export interface FateKnotsTransportSessionState {
  version: typeof FATE_KNOTS_SESSION_STATE_VERSION;
  forge: {
    requestId: string;
    sessionRef: FateKnotsSessionRef;
  } | null;
  dmByRunId: Array<{
    runId: string;
    sessionRef: FateKnotsSessionRef;
  }>;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && Array.isArray(value) === false;
}

function normalizeSessionRef(value: unknown): FateKnotsSessionRef | null {
  if (!isRecord(value)) return null;
  const next: FateKnotsSessionRef = {};
  for (const key of ["id", "conversationId", "threadId", "openHint"] as const) {
    const entry = value[key];
    if (typeof entry === "string" && entry.trim() !== "") next[key] = entry.trim();
  }
  return Object.keys(next).length > 0 ? next : null;
}

export function createEmptyFateKnotsTransportSessionState(): FateKnotsTransportSessionState {
  return {
    version: FATE_KNOTS_SESSION_STATE_VERSION,
    forge: null,
    dmByRunId: [],
  };
}

export function loadFateKnotsTransportSessionState(
  api: Pick<GameRoomHostApi, "getState">
): FateKnotsTransportSessionState {
  const raw = api.getState(FATE_KNOTS_SESSION_STATE_KEY);
  if (!isRecord(raw) || raw["version"] !== FATE_KNOTS_SESSION_STATE_VERSION) {
    return createEmptyFateKnotsTransportSessionState();
  }

  let forge: FateKnotsTransportSessionState["forge"] = null;
  if (isRecord(raw["forge"])) {
    const requestId =
      typeof raw["forge"]["requestId"] === "string" ? raw["forge"]["requestId"].trim() : "";
    const sessionRef = normalizeSessionRef(raw["forge"]["sessionRef"]);
    if (requestId !== "" && sessionRef !== null) forge = { requestId, sessionRef };
  }

  const dmByRunId = Array.isArray(raw["dmByRunId"])
    ? raw["dmByRunId"].flatMap((entry) => {
        if (!isRecord(entry)) return [];
        const runId = typeof entry["runId"] === "string" ? entry["runId"].trim() : "";
        const sessionRef = normalizeSessionRef(entry["sessionRef"]);
        return runId !== "" && sessionRef !== null ? [{ runId, sessionRef }] : [];
      })
    : [];

  const deduped = new Map<string, FateKnotsSessionRef>();
  dmByRunId.forEach((entry) => deduped.set(entry.runId, entry.sessionRef));

  return {
    version: FATE_KNOTS_SESSION_STATE_VERSION,
    forge,
    dmByRunId: Array.from(deduped, ([runId, sessionRef]) => ({ runId, sessionRef })),
  };
}

function save(
  api: Pick<GameRoomHostApi, "setState">,
  state: FateKnotsTransportSessionState
): FateKnotsTransportSessionState {
  const snapshot: FateKnotsTransportSessionState = {
    version: FATE_KNOTS_SESSION_STATE_VERSION,
    forge:
      state.forge === null
        ? null
        : { requestId: state.forge.requestId, sessionRef: { ...state.forge.sessionRef } },
    dmByRunId: state.dmByRunId.map((entry) => ({
      runId: entry.runId,
      sessionRef: { ...entry.sessionRef },
    })),
  };
  api.setState(FATE_KNOTS_SESSION_STATE_KEY, snapshot);
  return snapshot;
}

export function setFateKnotsForgeSession(
  api: Pick<GameRoomHostApi, "getState" | "setState">,
  requestId: string,
  sessionRef: FateKnotsSessionRef
): FateKnotsTransportSessionState {
  const current = loadFateKnotsTransportSessionState(api);
  return save(api, {
    ...current,
    forge: { requestId: requestId.trim(), sessionRef: { ...sessionRef } },
  });
}

export function clearFateKnotsForgeSession(
  api: Pick<GameRoomHostApi, "getState" | "setState">
): FateKnotsTransportSessionState {
  const current = loadFateKnotsTransportSessionState(api);
  return save(api, { ...current, forge: null });
}

export function getFateKnotsDmSession(
  api: Pick<GameRoomHostApi, "getState">,
  runId: string
): FateKnotsSessionRef | null {
  const normalizedRunId = runId.trim();
  return (
    loadFateKnotsTransportSessionState(api).dmByRunId.find(
      (entry) => entry.runId === normalizedRunId
    )?.sessionRef ?? null
  );
}

export function setFateKnotsDmSession(
  api: Pick<GameRoomHostApi, "getState" | "setState">,
  runId: string,
  sessionRef: FateKnotsSessionRef
): FateKnotsTransportSessionState {
  const normalizedRunId = runId.trim();
  const current = loadFateKnotsTransportSessionState(api);
  const next = current.dmByRunId.filter((entry) => entry.runId !== normalizedRunId);
  next.push({ runId: normalizedRunId, sessionRef: { ...sessionRef } });
  return save(api, { ...current, dmByRunId: next });
}

export function deleteFateKnotsDmSession(
  api: Pick<GameRoomHostApi, "getState" | "setState">,
  runId: string
): FateKnotsTransportSessionState {
  const normalizedRunId = runId.trim();
  const current = loadFateKnotsTransportSessionState(api);
  return save(api, {
    ...current,
    dmByRunId: current.dmByRunId.filter((entry) => entry.runId !== normalizedRunId),
  });
}
