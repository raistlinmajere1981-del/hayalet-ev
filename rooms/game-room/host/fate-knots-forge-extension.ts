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
  type FateKnotsForgeAuthoringProvider,
} from "../main-functions/fate-knots/host/forge-provider-policy.js";
import {
  readFateKnotsAi0ImageCapabilityStatus,
  type FateKnotsAi0ImageCapabilityStatus,
} from "../main-functions/fate-knots/host/electron-bridge.js";
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

function isAuthoringProviderSelectable(
  api: GameRoomHostApi & FateKnotsTransportApi,
  provider: FateKnotsForgeAuthoringProvider
): boolean {
  if (typeof api.dispatchBridge !== "function") return false;
  const slot = loadContext(api).slots[provider];
  return slot.assigned === true && slot.urlExcluded !== true;
}

async function getCapabilities(
  api: GameRoomHostApi & FateKnotsTransportApi,
  ai0StatusOverride?: FateKnotsAi0ImageCapabilityStatus
) {
  const readiness = getFateKnotsForgeReadiness(api);
  const ai0Status =
    ai0StatusOverride ??
    (hasFateKnotsAssetMaterializer("ai0-local")
      ? await readFateKnotsAi0ImageCapabilityStatus()
      : null);
  return {
    ok: true as const,
    defaults: { ...FATE_KNOTS_DEFAULT_FORGE_EXECUTION_POLICY },
    authoringProviders: FATE_KNOTS_FORGE_AUTHORING_PROVIDERS.map((provider) => ({
      provider,
      available: isAuthoringProviderSelectable(api, provider),
    })),
    assetProviders: FATE_KNOTS_FORGE_ASSET_PROVIDERS.map((provider) => ({
      provider,
      available:
        provider === "ai0-local"
          ? hasFateKnotsAssetMaterializer(provider) && ai0Status?.available === true
          : hasFateKnotsAssetMaterializer(provider),
    })),
    ai0ImageStatus: ai0Status,
    storageAvailable: readiness.storageAvailable,
    busy: readiness.busy,
    progress: getFateKnotsForgeProgress(api),
  };
}

/**
 * Adds the production World Forge entry point. Provider selection stays
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
        async function () {
          return await getCapabilities(transportApi);
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
              capabilities: await getCapabilities(transportApi),
            };
          }

          const brief = readBrief(roomArgs["brief"]);
          if (roomArgs["brief"] !== undefined && brief === undefined) {
            return {
              ok: false as const,
              error: "invalid-payload" as const,
              message: "Fate Knots World Forge brief must be text or null.",
              capabilities: await getCapabilities(transportApi),
            };
          }

          const policy = policyResult.policy;
          if (!isAuthoringProviderSelectable(transportApi, policy.authoringProvider)) {
            return {
              ok: false as const,
              error: "authoring-provider-unavailable" as const,
              message: `${policy.authoringProvider.toUpperCase()} is not assigned to an available Forge slot.`,
              capabilities: await getCapabilities(transportApi),
            };
          }
          if (!hasFateKnotsAssetMaterializer(policy.assetProvider)) {
            return {
              ok: false as const,
              error: "asset-provider-unavailable" as const,
              message: `${policy.assetProvider} has no registered Fate Knots asset materializer.`,
              capabilities: await getCapabilities(transportApi),
            };
          }

          let ai0Status: FateKnotsAi0ImageCapabilityStatus | undefined;
          if (policy.assetProvider === "ai0-local") {
            ai0Status = await readFateKnotsAi0ImageCapabilityStatus();
            if (!ai0Status.available) {
              return {
                ok: false as const,
                error: "asset-provider-unavailable" as const,
                message: ai0Status.reason ?? "AI0 Local image generation is unavailable.",
                capabilities: await getCapabilities(transportApi, ai0Status),
              };
            }
          }

          const readiness = getFateKnotsForgeReadiness(transportApi, policy);
          if (readiness.busy) {
            return {
              ok: false as const,
              error: "forge-busy" as const,
              message: "Fate Knots World Forge is already running.",
              capabilities: await getCapabilities(transportApi, ai0Status),
            };
          }
          if (!readiness.storageAvailable) {
            return {
              ok: false as const,
              error: "storage-unavailable" as const,
              message: "Fate Knots durable storage is unavailable.",
              capabilities: await getCapabilities(transportApi, ai0Status),
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
              capabilities: await getCapabilities(transportApi, ai0Status),
            };
          }
          if (!result.ok) {
            return {
              ok: false as const,
              error: "forge-failed" as const,
              code: result.code,
              message: result.message,
              requestId: result.request.requestId,
              capabilities: await getCapabilities(transportApi, ai0Status),
            };
          }

          return {
            ok: true as const,
            universeId: result.universe.universeId,
            requestId: result.request.requestId,
            provenanceWarning: result.provenanceWarning ?? null,
            capabilities: await getCapabilities(transportApi, ai0Status),
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
