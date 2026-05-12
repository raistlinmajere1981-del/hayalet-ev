import { getActiveFeatureId } from "../../../shared/host/context-state.js";
import { FATE_KNOTS_FEATURE_ID } from "../../../shared/host/feature-meta.js";
import { FATE_KNOTS_COMMAND_NAMES } from "./constants.js";
import {
  createFateKnotsPlaceholderState,
  loadFateKnotsState,
  pushFateKnotsState,
  resetFateKnotsState,
} from "./state.js";

interface FateKnotsRuntimeApi {
  getLocale?: () => unknown;
  getState: (key: string) => unknown;
  setState: (key: string, value: unknown) => unknown;
  notifyRoom?: (eventType: string, data: unknown) => void;
}

type FateKnotsContextLike = { activeFeature?: { id?: unknown } } | null | undefined;

function readLocale(api: FateKnotsRuntimeApi): string {
  const locale = api.getLocale?.();
  return typeof locale === "string" && locale.trim() !== "" ? locale : "en";
}

export function handleStart(api: FateKnotsRuntimeApi): { success: true; message: string } {
  const previous = loadFateKnotsState(api);
  pushFateKnotsState(api, {
    ...createFateKnotsPlaceholderState(readLocale(api), true),
    revision: previous.revision + 1,
  });
  return { success: true, message: "Fate Knots blank slate is ready." };
}

export function handleReset(api: FateKnotsRuntimeApi): { success: true; message: string } {
  resetFateKnotsState(api, "blank-slate");
  pushFateKnotsState(api);
  return { success: true, message: "Fate Knots placeholder reset." };
}

export async function dispatchPendingWork(api: FateKnotsRuntimeApi): Promise<{ success: true }> {
  pushFateKnotsState(api);
  return { success: true };
}

export function syncFromContext(api: FateKnotsRuntimeApi, payload: unknown): { success: true } {
  const context =
    typeof payload === "object" && payload !== null && "context" in payload
      ? ((payload as { context?: unknown }).context as FateKnotsContextLike)
      : (payload as FateKnotsContextLike);
  if (getActiveFeatureId(context) === FATE_KNOTS_FEATURE_ID) {
    pushFateKnotsState(api);
  }
  return { success: true };
}

export { FATE_KNOTS_COMMAND_NAMES };
