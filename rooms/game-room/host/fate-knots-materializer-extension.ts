import { registerFateKnotsAssetMaterializerForProvider } from "../main-functions/fate-knots/host/forge-service.js";
import { createFateKnotsAi0LocalAssetMaterializer } from "../main-functions/fate-knots/host/ai0-local-asset-materializer.js";
import { createFateKnotsProviderAssetMaterializer } from "../main-functions/fate-knots/host/provider-asset-materializer.js";
import type { FateKnotsTransportApi } from "../main-functions/fate-knots/host/transport.js";
import type { GameRoomHostApi } from "../shared/host/activation.js";

type ActivatedGameRoomHost = {
  dispose?: () => void;
};

type GameRoomHostRuntime = {
  activate(api: GameRoomHostApi): unknown;
};

function unregisterMaterializers(): void {
  registerFateKnotsAssetMaterializerForProvider("ai1", null);
  registerFateKnotsAssetMaterializerForProvider("ai0-local", null);
}

/**
 * Installs both World Forge media backends for one Game Room host activation.
 * AI1 keeps the conversational SlotBridge/archive path. AI0 Local owns a
 * separate Electron/OpenCode image worker and stages real PNG files before they
 * enter the same managed-storage and canonical-asset validation pipeline.
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
      registerFateKnotsAssetMaterializerForProvider(
        "ai0-local",
        createFateKnotsAi0LocalAssetMaterializer(transportApi)
      );

      let activated: ActivatedGameRoomHost;
      try {
        activated = baseRuntime.activate(api) as ActivatedGameRoomHost;
      } catch (error) {
        unregisterMaterializers();
        throw error;
      }

      const baseDispose = activated.dispose;
      return {
        ...activated,
        dispose() {
          unregisterMaterializers();
          baseDispose?.();
        },
      };
    },
  };
}
