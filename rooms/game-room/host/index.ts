import { extendGameRoomHostRuntimeWithFateKnotsCampSocial } from "./fate-knots-camp-social-extension.js";
import { extendGameRoomHostRuntimeWithFateKnotsExploration } from "./fate-knots-exploration-extension.js";
import { extendGameRoomHostRuntimeWithFateKnotsLoot } from "./fate-knots-loot-extension.js";
import { extendGameRoomHostRuntimeWithFateKnotsRunSetupSeats } from "./fate-knots-run-setup-extension.js";
import createGameRoomHostRuntime, { teamTetrisEngine } from "./runtime.js";

export { teamTetrisEngine };

const fateKnotsExplorationRuntime = extendGameRoomHostRuntimeWithFateKnotsExploration(
  createGameRoomHostRuntime()
);
const fateKnotsCampSocialRuntime = extendGameRoomHostRuntimeWithFateKnotsCampSocial(
  fateKnotsExplorationRuntime
);
const fateKnotsLootRuntime = extendGameRoomHostRuntimeWithFateKnotsLoot(fateKnotsCampSocialRuntime);

export default extendGameRoomHostRuntimeWithFateKnotsRunSetupSeats(fateKnotsLootRuntime);
