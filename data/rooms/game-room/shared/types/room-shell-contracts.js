import { FEATURE_ID, ROOM_ID, getDefaultFeatureRecords } from "../host/feature-meta.js";
export const GAME_ROOM_SLOT_IDS = ["ai1", "ai2", "us1"];
export const GAME_ROOM_PRESENTATION_MODES = ["classic", "scene-view"];
export function createGameRoomSlotState(slotId) {
  return {
    slotId,
    label: slotId.toUpperCase(),
    nickname: slotId.toUpperCase(),
    avatar: null,
    assigned: false,
    connected: false,
    ready: false,
    state: "empty",
    urlExcluded: false,
    providerId: null,
    accountId: null,
    remoteUserId: null
  };
}
export function createGameRoomPresentationState(mode = "classic", uiScale = 100) {
  const normalizedMode = GAME_ROOM_PRESENTATION_MODES.includes(mode) ? mode : "classic";
  const numericScale = typeof uiScale === "number" ? uiScale : typeof uiScale === "string" ? Number.parseInt(uiScale, 10) : Number.NaN;
  const normalizedScale = Number.isFinite(numericScale) && numericScale > 0 ? Math.round(numericScale) : 100;
  return {
    mode: normalizedMode,
    uiScale: Math.max(70, Math.min(130, normalizedScale))
  };
}
export function createGameRoomContextState() {
  const featureRecords = getDefaultFeatureRecords();
  const activeFeature = featureRecords[0] || {
    id: FEATURE_ID,
    name: "XOX",
    description: ""
  };
  const user = {
    nickname: "User",
    avatar: null
  };
  const slots = {
    ai1: createGameRoomSlotState("ai1"),
    ai2: createGameRoomSlotState("ai2"),
    us1: createGameRoomSlotState("us1")
  };
  return {
    room: {
      id: ROOM_ID,
      name: "Game Room"
    },
    features: featureRecords,
    activeFeature,
    user,
    slots,
    presence: {
      user,
      slots: {
        ai1: { ...slots.ai1 },
        ai2: { ...slots.ai2 },
        us1: { ...slots.us1 }
      }
    }
  };
}
