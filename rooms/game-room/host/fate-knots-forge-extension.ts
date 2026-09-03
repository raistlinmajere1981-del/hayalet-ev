import {
  createFateKnotsUniverseThroughForge,
  getFateKnotsForgeProgress,
  getFateKnotsForgeReadiness,
  hasFateKnotsAssetMaterializer,
} from "../main-functions/fate-knots/host/forge-service.js";
import {
  FATE_KNOTS_DEFAULT_FORGE_EXECUTION_POLICY,
  FATE_KNOTS_FORGE_ASSET_PROVIDERS,
  FATE_KNOTS_FORGE_AUTHORING_PROVIDERS,
  readFateKnotsForgeExecutionPolicy,
} from "../main-functions/fate-knots/host/forge-provider-policy.js";
import type { FateKnotsTransportApi } from "../main-functions/fate-knots/host/transport.js";
import { loadContext } from "../shared/host/context-state.js";
import type { GameRoomHostApi } from "../shared/host/activation.js";

export const FATE_KNOTS_FORGE_COMMAND_NAMES = {
  getCapabilities: "GameRoomFateKnotsGetForgeCapabilities",
  createUniverse: "GameRoomFateKnotsCreateUniverse",
} as const;

type GameRoomHostRuntime = {
  activate(api: GameRoomHostApi): unknown;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function readRegisteredRoomArgs(payload: unknown): Record<string, unknown> {
  if (!isRecord(payload)) return {};
  const roomArgs = payload["roomArgs"];
  return isRecord(roomArgs) ? roomArgs : {};
}

function readBrief(value: unknown): string | null | undefined {
  if (value === undefined) return undefined;
  if (value === null) return null;
  if (typeof value !== "string") return undefined;
  const normalized = value.trim();
  return normalized === "" ? null : normalized.slice(0, 8_000);
}

function getCapabilities(api: GameRoomHostApi & FateKnotsTransportApi) {
  const context = loadContext(api);
  const readiness = getFateKnotsForgeReadiness(api);
  return {
    ok: true as const,
    defaults: { ...FATE_KNOTS_DEFAULT_FORGE_EXECUTION_POLICY },
    authoringProviders: FATE_KNOTS_FORGE_AUTHORING_PROVIDERS.map((provider) => ({
      provider,
      available:
        typeof api.dispatchBridge === "function" && context.slots[provider].dispatchable === true,
    })),
    assetProviders: FATE_KNOTS_FORGE_ASSET_PROVIDERS.map((provider) => ({
      provider,
      available: hasFateKnotsAssetMaterializer(provider),
    })),
    storageAvailable: readiness.storageAvailable,
    busy: readiness.busy,
    progress: getFateKnotsForgeProgress(api),
  };
}

/**
 * Adds the first production World Forge entry point. Provider selection stays
 * execution-only: the renderer chooses authoring/media backends before creation,
 * while the accepted Universe Package remains provider-neutral canonical data.
 */
export function extendGameRoomHostRuntimeWithFateKnotsForge<T extends GameRoomHostRuntime>(
  baseRuntime: T
): T {
  return {
    ...baseRuntime,
    activate(api: GameRoomHostApi) {
      const activated = baseRuntime.activate(api);
      const transportApi = api as GameRoomHostApi & FateKnotsTransportApi;

      api.registerCommand?.(
        FATE_KNOTS_FORGE_COMMAND_NAMES.getCapabilities,
        function () {
          return getCapabilities(transportApi);
        },
        {
          description: "Read Fate Knots World Forge provider and storage readiness.",
          scope: "room-ui",
          exposure: "internal",
        }
      );

      api.registerCommand?.(
        FATE_KNOTS_FORGE_COMMAND_NAMES.createUniverse,
        async function (payload: unknown) {
          const roomArgs = readRegisteredRoomArgs(payload);
          const policyResult = readFateKnotsForgeExecutionPolicy(roomArgs["executionPolicy"]);
          if (!policyResult.ok) {
            return {
              ok: false as const,
              error: "invalid-payload" as const,
              message: policyResult.message,
              capabilities: getCapabilities(transportApi),
            };
          }

          const brief = readBrief(roomArgs["brief"]);
          if (roomArgs["brief"] !== undefined && brief === undefined) {
            return {
              ok: false as const,
              error: "invalid-payload" as const,
              message: "Fate Knots World Forge brief must be text or null.",
              capabilities: getCapabilities(transportApi),
            };
          }

          const policy = policyResult.policy;
          const context = loadContext(api);
          if (
            typeof transportApi.dispatchBridge !== "function" ||
            context.slots[policy.authoringProvider].dispatchable !== true
          ) {
            return {
              ok: false as const,
              error: "authoring-provider-unavailable" as const,
              message: `${policy.authoringProvider.toUpperCase()} is not dispatchable for World Forge.`,
              capabilities: getCapabilities(transportApi),
            };
          }
          if (!hasFateKnotsAssetMaterializer(policy.assetProvider)) {
            return {
              ok: false as const,
              error: "asset-provider-unavailable" as const,
              message: `${policy.assetProvider} has no registered Fate Knots asset materializer.`,
              capabilities: getCapabilities(transportApi),
            };
          }

          const readiness = getFateKnotsForgeReadiness(transportApi, policy);
          if (readiness.busy) {
            return {
              ok: false as const,
              error: "forge-busy" as const,
              message: "Fate Knots World Forge is already running.",
              capabilities: getCapabilities(transportApi),
            };
          }
          if (!readiness.storageAvailable) {
            return {
              ok: false as const,
              error: "storage-unavailable" as const,
              message: "Fate Knots durable storage is unavailable.",
              capabilities: getCapabilities(transportApi),
            };
          }

          const result = await createFateKnotsUniverseThroughForge(transportApi, {
            ...(brief !== undefined ? { brief } : {}),
            executionPolicy: policy,
          });
          if (result === null) {
            return {
              ok: false as const,
              error: "forge-unavailable" as const,
              message: "Fate Knots World Forge could not start with the selected providers.",
              capabilities: getCapabilities(transportApi),
            };
          }
          if (!result.ok) {
            return {
              ok: false as const,
              error: "forge-failed" as const,
              code: result.code,
              message: result.message,
              requestId: result.request.requestId,
              capabilities: getCapabilities(transportApi),
            };
          }

          return {
            ok: true as const,
            universeId: result.universe.universeId,
            requestId: result.request.requestId,
            provenanceWarning: result.provenanceWarning ?? null,
            capabilities: getCapabilities(transportApi),
          };
        },
        {
          description: "Create and persist one Fate Knots universe through provider-aware World Forge.",
          scope: "room-ui",
          exposure: "internal",
        }
      );

      return activated;
    },
  };
}
