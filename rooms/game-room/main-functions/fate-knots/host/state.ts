import { readLocale } from "../../../shared/host/context-state.js";
import { FATE_KNOTS_FEATURE_ID, ROOM_ID } from "../../../shared/host/feature-meta.js";

export interface FateKnotsPlaceholderState {
  roomId: string;
  featureId: string;
  schemaVersion: number;
  active: boolean;
  phase: "blank-slate" | "ready";
  locale: string;
  revision: number;
}

interface FateKnotsStateApi {
  getLocale?: () => unknown;
  getState: (key: string) => unknown;
  setState: (key: string, value: unknown) => unknown;
  notifyRoom?: (eventType: string, data: unknown) => void;
}

const FATE_KNOTS_STATE_KEY = "gameRoom.fateKnots";
const FATE_KNOTS_SCHEMA_VERSION = 1;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && Array.isArray(value) === false;
}

function normalizePhase(value: unknown, active: boolean): FateKnotsPlaceholderState["phase"] {
  return value === "ready" || active === true ? "ready" : "blank-slate";
}

export function createFateKnotsPlaceholderState(
  locale: string,
  active = false
): FateKnotsPlaceholderState {
  return {
    roomId: ROOM_ID,
    featureId: FATE_KNOTS_FEATURE_ID,
    schemaVersion: FATE_KNOTS_SCHEMA_VERSION,
    active,
    phase: active ? "ready" : "blank-slate",
    locale,
    revision: 0,
  };
}

export function normalizeFateKnotsState(
  candidate: unknown,
  localeFallback: string
): FateKnotsPlaceholderState {
  const source = isRecord(candidate) ? candidate : {};
  const active = source["active"] === true;
  const locale = typeof source["locale"] === "string" ? source["locale"] : localeFallback;
  const revision = Number.isFinite(source["revision"]) ? Number(source["revision"]) : 0;

  return {
    ...createFateKnotsPlaceholderState(locale, active),
    phase: normalizePhase(source["phase"], active),
    revision,
  };
}

export function loadFateKnotsState(api: FateKnotsStateApi): FateKnotsPlaceholderState {
  return normalizeFateKnotsState(api.getState(FATE_KNOTS_STATE_KEY), readLocale(api));
}

export function saveFateKnotsState(
  api: FateKnotsStateApi,
  state: FateKnotsPlaceholderState
): FateKnotsPlaceholderState {
  api.setState(FATE_KNOTS_STATE_KEY, state);
  return state;
}

export function resetFateKnotsState(
  api: FateKnotsStateApi,
  phase: string
): FateKnotsPlaceholderState {
  const nextState = createFateKnotsPlaceholderState(readLocale(api), phase === "ready");
  return saveFateKnotsState(api, nextState);
}

export function pushFateKnotsState(
  api: FateKnotsStateApi,
  state: FateKnotsPlaceholderState = loadFateKnotsState(api)
): FateKnotsPlaceholderState {
  const savedState = saveFateKnotsState(api, state);
  api.notifyRoom?.("fate-knots-state", { state: savedState });
  return savedState;
}
