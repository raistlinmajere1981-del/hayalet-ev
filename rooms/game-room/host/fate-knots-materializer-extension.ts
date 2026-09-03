import { registerFateKnotsAssetMaterializerForProvider } from "../main-functions/fate-knots/host/forge-service.js";
import { createFateKnotsProviderAssetMaterializer } from "../main-functions/fate-knots/host/provider-asset-materializer.js";
import type { FateKnotsTransportApi } from "../main-functions/fate-knots/host/transport.js";
import type { GameRoomHostApi } from "../shared/host/activation.js";

type ActivatedGameRoomHost = {
  dispose?: () => void;
};

type GameRoomHostRuntime = {
  activate(api: GameRoomHostApi): unknown;
};

/**
 * Installs the existing conversational AI1 World Forge image materializer for
 * one Game Room host activation. Additional backends (notably ai0-local) own
 * their own registration and cannot silently replace this provider choice.
 */
export function extendGameRoomHostRuntimeWithFateKnotsMaterializer<T extends GameRoomHostRuntime>(
  baseRuntime: T
): T {
  return {
    ...baseRuntime,
    activate(api: GameRoomHostApi) {
      const transportApi = api as FateKnotsTransportApi;
      registerFateKnotsAssetMaterializerForProvider(
        "ai1",
        createFateKnotsProviderAssetMaterializer(transportApi)
      );

      let activated: ActivatedGameRoomHost;
      try {
        activated = baseRuntime.activate(api) as ActivatedGameRoomHost;
      } catch (error) {
        registerFateKnotsAssetMaterializerForProvider("ai1", null);
        throw error;
      }

      const baseDispose = activated.dispose;
      return {
        ...activated,
        dispose() {
          registerFateKnotsAssetMaterializerForProvider("ai1", null);
          baseDispose?.();
        },
      };
    },
  };
}
