import type { GameRoomHostApi } from "../../../shared/host/activation.js";
import type { FateKnotsAssetMaterializerAdapter } from "../forge/materializer.js";
import { getFateKnotsDurableStorageError } from "./durable-persistence.js";
import {
  readFateKnotsForgeExecutionPolicy,
  type FateKnotsForgeAssetProvider,
  type FateKnotsForgeExecutionPolicy,
} from "./forge-provider-policy.js";
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
  | "storage-unavailable"
  | "forge-busy";

export interface FateKnotsForgeReadiness {
  ready: boolean;
  blockers: FateKnotsForgeBlocker[];
  ai1TransportAvailable: boolean;
  materializerAvailable: boolean;
  storageAvailable: boolean;
  busy: boolean;
  progress: FateKnotsWorldForgeProgress | null;
  policy: FateKnotsForgeExecutionPolicy;
}

const materializerAdapters = new Map<FateKnotsForgeAssetProvider, FateKnotsAssetMaterializerAdapter>();

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

function isBusyProgress(progress: FateKnotsWorldForgeProgress | null): boolean {
  return progress !== null && progress.stage !== "completed" && progress.stage !== "failed";
}

/**
 * Backward-compatible AI1 registration. Provider integrations that own another
 * materialization backend should use registerFateKnotsAssetMaterializerForProvider.
 */
export function registerFateKnotsAssetMaterializer(
  adapter: FateKnotsAssetMaterializerAdapter | null
): void {
  registerFateKnotsAssetMaterializerForProvider("ai1", adapter);
}

export function registerFateKnotsAssetMaterializerForProvider(
  provider: FateKnotsForgeAssetProvider,
  adapter: FateKnotsAssetMaterializerAdapter | null
): void {
  if (adapter === null) {
    materializerAdapters.delete(provider);
    return;
  }
  materializerAdapters.set(provider, adapter);
}

export function hasFateKnotsAssetMaterializer(
  provider: FateKnotsForgeAssetProvider = "ai1"
): boolean {
  return materializerAdapters.has(provider);
}

export function getFateKnotsForgeProgress(
  api: Pick<GameRoomHostApi, "getState">
): FateKnotsWorldForgeProgress | null {
  const value = api.getState(FATE_KNOTS_FORGE_PROGRESS_KEY);
  return isProgress(value) ? { ...value } : null;
}

export function clearFateKnotsForgeProgress(api: Pick<GameRoomHostApi, "setState">): void {
  api.setState(FATE_KNOTS_FORGE_PROGRESS_KEY, null);
}

function setProgress(
  api: Pick<GameRoomHostApi, "setState">,
  event: FateKnotsWorldForgeProgress
): void {
  api.setState(FATE_KNOTS_FORGE_PROGRESS_KEY, { ...event });
}

export function getFateKnotsForgeReadiness(
  api: GameRoomHostApi & Partial<FateKnotsTransportApi>,
  executionPolicy?: unknown
): FateKnotsForgeReadiness {
  const readPolicy = readFateKnotsForgeExecutionPolicy(executionPolicy);
  const policy = readPolicy.ok
    ? readPolicy.policy
    : { authoringProvider: "ai1" as const, assetProvider: "ai1" as const };
  const ai1TransportAvailable = typeof api.dispatchBridge === "function";
  const materializerAvailable = materializerAdapters.has(policy.assetProvider);
  const storageAvailable = getFateKnotsDurableStorageError(api) === null;
  const progress = getFateKnotsForgeProgress(api);
  const busy = isBusyProgress(progress);
  const blockers: FateKnotsForgeBlocker[] = [];
  if (!ai1TransportAvailable) blockers.push("ai1-transport-unavailable");
  if (!materializerAvailable) blockers.push("asset-materializer-unavailable");
  if (!storageAvailable) blockers.push("storage-unavailable");
  if (busy) blockers.push("forge-busy");

  return {
    ready: readPolicy.ok && blockers.length === 0,
    blockers,
    ai1TransportAvailable,
    materializerAvailable,
    storageAvailable,
    busy,
    progress,
    policy,
  };
}

export async function createFateKnotsUniverseThroughForge(
  api: GameRoomHostApi & FateKnotsTransportApi,
  options: {
    brief?: string | null;
    executionPolicy?: unknown;
    onProgress?: (event: FateKnotsWorldForgeProgress) => void;
  } = {}
): Promise<FateKnotsWorldForgePipelineResult | null> {
  const readPolicy = readFateKnotsForgeExecutionPolicy(options.executionPolicy);
  if (!readPolicy.ok) return null;
  const policy = readPolicy.policy;
  const adapter = materializerAdapters.get(policy.assetProvider) ?? null;
  if (adapter === null || isBusyProgress(getFateKnotsForgeProgress(api))) return null;

  return await runFateKnotsWorldForge(api, adapter, {
    ...(options.brief !== undefined ? { brief: options.brief } : {}),
    authoringProvider: policy.authoringProvider,
    onProgress(event) {
      setProgress(api, event);
      options.onProgress?.({ ...event });
    },
  });
}
