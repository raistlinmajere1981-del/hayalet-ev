import { AppState } from "../../../modules/app-state.js";
import { SlotController } from "../../../modules/slot-controller.js";
import { TrafficManager } from "../../../modules/traffic-manager.js";

export type SceneCharacterSlot = "ai0" | "ai1" | "ai2" | "us1";
export type SceneCharacterState = "inactive" | "connected" | "thinking" | "loading";

export function getSceneCharacterState(slot: SceneCharacterSlot): SceneCharacterState {
  const trafficState = TrafficManager.state[slot];

  if (trafficState?.status.loading === "busy") {
    return "loading";
  }

  if (trafficState?.status.thinking === "busy") {
    return "thinking";
  }

  if (slot === "us1") {
    return AppState.isUs1Connected() ? "connected" : "inactive";
  }

  return SlotController.isConnected(slot) ? "connected" : "inactive";
}

export function getSceneCharacterStateClass(slot: SceneCharacterSlot): string {
  return `is-${getSceneCharacterState(slot)}`;
}
