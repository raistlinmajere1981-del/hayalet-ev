import { extendGameRoomHostRuntimeWithFateKnotsExploration } from "./fate-knots-exploration-extension.js";
import createGameRoomHostRuntime, { teamTetrisEngine } from "./runtime.js";

export { teamTetrisEngine };
export default extendGameRoomHostRuntimeWithFateKnotsExploration(createGameRoomHostRuntime());
