import { registerFateKnotsAssetMaterializer } from "../main-functions/fate-knots/host/forge-service.js";
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
 * Installs the concrete World Forge image materializer for the lifetime of one
 * Game Room host activation. The adapter stays provider-neutral by going through
 * SlotBridge and the existing generated-image archive pipeline.
 */
export function extendGameRoomHostRuntimeWithFateKnotsMaterializer<T extends GameRoomHostRuntime>(
  baseRuntime: T
): T {
  return {
    ...baseRuntime,
    activate(api: GameRoomHostApi) {
      const transportApi = api as FateKnotsTransportApi;
      registerFateKnotsAssetMaterializer(createFateKnotsProviderAssetMaterializer(transportApi));

      let activated: ActivatedGameRoomHost;
      try {
        activated = baseRuntime.activate(api) as ActivatedGameRoomHost;
      } catch (error) {
        registerFateKnotsAssetMaterializer(null);
        throw error;
      }

      const baseDispose = activated.dispose;
      return {
        ...activated,
        dispose() {
          registerFateKnotsAssetMaterializer(null);
          baseDispose?.();
        },
      };
    },
  };
}
