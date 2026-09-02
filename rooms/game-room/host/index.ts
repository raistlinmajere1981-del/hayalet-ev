import { extendGameRoomHostRuntimeWithFateKnotsCampSocial } from "./fate-knots-camp-social-extension.js";
import { extendGameRoomHostRuntimeWithFateKnotsExploration } from "./fate-knots-exploration-extension.js";
import createGameRoomHostRuntime, { teamTetrisEngine } from "./runtime.js";

export { teamTetrisEngine };

const fateKnotsExplorationRuntime = extendGameRoomHostRuntimeWithFateKnotsExploration(
  createGameRoomHostRuntime()
);

export default extendGameRoomHostRuntimeWithFateKnotsCampSocial(fateKnotsExplorationRuntime);
