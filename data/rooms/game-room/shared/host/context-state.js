import {
  FEATURE_ID,
  getDefaultFeatureRecords,
  normalizeFeatureId,
  sanitizeFeatureRecord
} from "./feature-meta.js";
import { normalizeLocale } from "./text.js";
import {
  createGameRoomContextState,
  createGameRoomSlotState
} from "../types/room-shell-contracts.js";
function isRecord(value) {
  return typeof value === "object" && value !== null && Array.isArray(value) === false;
}
export function createSlotState(slotId) {
  return createGameRoomSlotState(slotId);
}
export function normalizeSlot(candidate, slotId) {
  const source = isRecord(candidate) ? candidate : {};
  const nickname = typeof source.nickname === "string" && source.nickname.trim() !== "" ? source.nickname.trim() : slotId.toUpperCase();
  const assigned = source.assigned === true;
  const connected = source.connected === true;
  const urlExcluded = source.urlExcluded === true;
  const ready = source.ready === true || assigned && connected && urlExcluded !== true;
  return {
    slotId,
    nickname,
    assigned,
    connected,
    ready,
    state: typeof source.state === "string" && source.state.trim() !== "" ? source.state.trim() : "empty",
    urlExcluded,
    accountId: typeof source.accountId === "string" && source.accountId.trim() !== "" ? source.accountId.trim() : null,
    remoteUserId: typeof source.remoteUserId === "string" && source.remoteUserId.trim() !== "" ? source.remoteUserId.trim() : null
  };
}
export function sanitizeContext(payload) {
  const source = isRecord(payload) ? payload : {};
  const fallbackContext = createGameRoomContextState();
  const slotsSource = isRecord(source.slots) ? source.slots : {};
  const userSource = isRecord(source.user) ? source.user : {};
  const defaultFeatures = getDefaultFeatureRecords();
  const featureMap = new Map(
    defaultFeatures.map((feature) => [feature.id, feature])
  );
  if (Array.isArray(source.features)) {
    source.features.forEach((feature) => {
      const normalized = sanitizeFeatureRecord(feature, FEATURE_ID);
      featureMap.set(normalized.id, normalized);
    });
  }
  const features = Array.from(featureMap.values());
  const roomSource = isRecord(source.room) ? source.room : {};
  const activeFeature = sanitizeFeatureRecord(
    source.activeFeature,
    normalizeFeatureId(
      typeof roomSource.defaultFeatureId === "string" ? roomSource.defaultFeatureId : FEATURE_ID
    )
  );
  return {
    room: isRecord(source.room) ? source.room : fallbackContext.room,
    presentation: isRecord(source.presentation) ? source.presentation : { mode: "classic" },
    user: {
      nickname: typeof userSource.nickname === "string" && userSource.nickname.trim() !== "" ? userSource.nickname.trim() : fallbackContext.user.nickname
    },
    features,
    activeFeature: features.find((feature) => feature.id === activeFeature.id) || activeFeature,
    slots: {
      ai1: normalizeSlot(slotsSource.ai1, "ai1"),
      ai2: normalizeSlot(slotsSource.ai2, "ai2"),
      us1: normalizeSlot(slotsSource.us1, "us1")
    }
  };
}
export function readLocale(api) {
  return normalizeLocale(
    typeof api.getLocale === "function" ? api.getLocale() : api.getState("locale")
  );
}
export function getActiveFeatureId(context) {
  return normalizeFeatureId(context?.activeFeature?.id);
}
export function loadContext(api) {
  return sanitizeContext(api.getState("xox-context"));
}
export function saveContext(api, payload) {
  const context = sanitizeContext(payload);
  api.setState("xox-context", context);
  return context;
}
