import type { GameRoomHostApi } from "../../../shared/host/activation.js";
import type { FateKnotsAssetMaterializerAdapter } from "../forge/materializer.js";
import { getFateKnotsDurableStorageError } from "./durable-persistence.js";
import type { FateKnotsTransportApi } from "./transport.js";
import {
  runFateKnotsWorldForge,
  type FateKnotsWorldForgePipelineResult,
  type FateKnotsWorldForgeProgress,
} from "./world-forge-orchestrator.js";

const FATE_KNOTS_FORGE_PROGRESS_KEY = "game-room:fate-knots:forge-progress:v1";

export type FateKnotsForgeBlocker =
  | "ai1-transport-unavailable"
  | "asset-materializer-unavailable"
  | "storage-unavailable";

export interface FateKnotsForgeReadiness {
  ready: boolean;
  blockers: FateKnotsForgeBlocker[];
  ai1TransportAvailable: boolean;
  materializerAvailable: boolean;
  storageAvailable: boolean;
  progress: FateKnotsWorldForgeProgress | null;
}

let materializerAdapter: FateKnotsAssetMaterializerAdapter | null = null;

function isProgress(value: unknown): value is FateKnotsWorldForgeProgress {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return false;
  const record = value as Record<string, unknown>;
  return (
    typeof record["requestId"] === "string" &&
    typeof record["universeId"] === "string" &&
    typeof record["stage"] === "string" &&
    typeof record["completedAssets"] === "number" &&
    typeof record["totalAssets"] === "number" &&
    typeof record["message"] === "string"
  );
}

/**
 * Registers the concrete image materializer supplied by the local/provider
 * integration layer. The headless Fate Knots package never imports provider DOM
 * code directly; removing the adapter makes World Forge fail closed.
 */
export function registerFateKnotsAssetMaterializer(
  adapter: FateKnotsAssetMaterializerAdapter | null
): void {
  materializerAdapter = adapter;
}

export function hasFateKnotsAssetMaterializer(): boolean {
  return materializerAdapter !== null;
}

export function getFateKnotsForgeProgress(
  api: Pick<GameRoomHostApi, "getState">
): FateKnotsWorldForgeProgress | null {
  const value = api.getState(FATE_KNOTS_FORGE_PROGRESS_KEY);
  return isProgress(value) ? { ...value } : null;
}

export function clearFateKnotsForgeProgress(
  api: Pick<GameRoomHostApi, "setState">
): void {
  api.setState(FATE_KNOTS_FORGE_PROGRESS_KEY, null);
}

function setProgress(
  api: Pick<GameRoomHostApi, "setState">,
  event: FateKnotsWorldForgeProgress
): void {
  api.setState(FATE_KNOTS_FORGE_PROGRESS_KEY, { ...event });
}

export function getFateKnotsForgeReadiness(
  api: GameRoomHostApi & Partial<FateKnotsTransportApi>
): FateKnotsForgeReadiness {
  const ai1TransportAvailable = typeof api.dispatchBridge === "function";
  const materializerAvailable = materializerAdapter !== null;
  const storageAvailable = getFateKnotsDurableStorageError(api) === null;
  const blockers: FateKnotsForgeBlocker[] = [];
  if (!ai1TransportAvailable) blockers.push("ai1-transport-unavailable");
  if (!materializerAvailable) blockers.push("asset-materializer-unavailable");
  if (!storageAvailable) blockers.push("storage-unavailable");

  return {
    ready: blockers.length === 0,
    blockers,
    ai1TransportAvailable,
    materializerAvailable,
    storageAvailable,
    progress: getFateKnotsForgeProgress(api),
  };
}

export async function createFateKnotsUniverseThroughForge(
  api: GameRoomHostApi & FateKnotsTransportApi,
  options: {
    brief?: string | null;
    onProgress?: (event: FateKnotsWorldForgeProgress) => void;
  } = {}
): Promise<FateKnotsWorldForgePipelineResult | null> {
  const adapter = materializerAdapter;
  if (adapter === null) return null;

  return await runFateKnotsWorldForge(api, adapter, {
    ...(options.brief !== undefined ? { brief: options.brief } : {}),
    onProgress(event) {
      setProgress(api, event);
      options.onProgress?.({ ...event });
    },
  });
}
