import { extendGameRoomHostRuntimeWithFateKnotsAi2Lifecycle } from "./fate-knots-ai2-lifecycle-extension.js";
import { extendGameRoomHostRuntimeWithFateKnotsCampSocial } from "./fate-knots-camp-social-extension.js";
import { extendGameRoomHostRuntimeWithFateKnotsExploration } from "./fate-knots-exploration-extension.js";
import { extendGameRoomHostRuntimeWithFateKnotsLoot } from "./fate-knots-loot-extension.js";
import { extendGameRoomHostRuntimeWithFateKnotsMaterializer } from "./fate-knots-materializer-extension.js";
import { extendGameRoomHostRuntimeWithFateKnotsPlayerCombat } from "./fate-knots-player-combat-extension.js";
import { extendGameRoomHostRuntimeWithFateKnotsRunSetupSeats } from "./fate-knots-run-setup-extension.js";
import { extendGameRoomHostRuntimeWithFateKnotsUs1Lifecycle } from "./fate-knots-us1-lifecycle-extension.js";
import createGameRoomHostRuntime, { teamTetrisEngine } from "./runtime.js";

export { teamTetrisEngine };

const fateKnotsExplorationRuntime = extendGameRoomHostRuntimeWithFateKnotsExploration(
  createGameRoomHostRuntime()
);
const fateKnotsCampSocialRuntime = extendGameRoomHostRuntimeWithFateKnotsCampSocial(
  fateKnotsExplorationRuntime
);
const fateKnotsLootRuntime = extendGameRoomHostRuntimeWithFateKnotsLoot(fateKnotsCampSocialRuntime);
const fateKnotsRunSetupRuntime = extendGameRoomHostRuntimeWithFateKnotsRunSetupSeats(
  fateKnotsLootRuntime
);
const fateKnotsPlayerCombatRuntime = extendGameRoomHostRuntimeWithFateKnotsPlayerCombat(
  fateKnotsRunSetupRuntime
);
const fateKnotsAi2Runtime = extendGameRoomHostRuntimeWithFateKnotsAi2Lifecycle(
  fateKnotsPlayerCombatRuntime
);
const fateKnotsUs1Runtime = extendGameRoomHostRuntimeWithFateKnotsUs1Lifecycle(fateKnotsAi2Runtime);

export default extendGameRoomHostRuntimeWithFateKnotsMaterializer(fateKnotsUs1Runtime);
