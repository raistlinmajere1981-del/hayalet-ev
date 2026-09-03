import { runFateKnotsAi0ImageSmoke } from "../main-functions/fate-knots/host/ai0-local-image-smoke.js";
import type { GameRoomHostApi } from "../shared/host/activation.js";

export const FATE_KNOTS_AI0_IMAGE_SMOKE_COMMAND = "GameRoomFateKnotsTestAi0Image";

type GameRoomHostRuntime = {
  activate(api: GameRoomHostApi): unknown;
};

export function extendGameRoomHostRuntimeWithFateKnotsAi0ImageSmoke<T extends GameRoomHostRuntime>(
  baseRuntime: T
): T {
  return {
    ...baseRuntime,
    activate(api: GameRoomHostApi) {
      const activated = baseRuntime.activate(api);
      let running = false;

      api.registerCommand?.(
        FATE_KNOTS_AI0_IMAGE_SMOKE_COMMAND,
        async function () {
          if (running) {
            return {
              ok: false as const,
              error: "ai0-image-smoke-busy" as const,
              message: "Fate Knots AI0 image smoke test is already running.",
            };
          }

          running = true;
          try {
            const result = await runFateKnotsAi0ImageSmoke();
            api.log(
              result.ok ? "info" : "warn",
              result.ok
                ? "Fate Knots AI0 image smoke test promoted a real managed PNG."
                : "Fate Knots AI0 image smoke test failed: " + result.message
            );
            return result;
          } finally {
            running = false;
          }
        },
        {
          description:
            "Generate and promote one internal AI0 Local image without running World Forge.",
          scope: "room-ui",
          exposure: "internal",
        }
      );

      return activated;
    },
  };
}
