import {
  FEATURE_ID,
  ROOM_ID,
  getDefaultFeatureRecords,
  normalizeFeatureId,
  sanitizeFeatureRecord,
} from "./feature-meta.js";
import { normalizeLocale } from "./text.js";

export function createSlotState(slotId) {
  return {
    slotId: slotId,
    nickname: slotId.toUpperCase(),
    assigned: false,
    connected: false,
    ready: false,
    state: "empty",
    urlExcluded: false,
    accountId: null,
    remoteUserId: null,
  };
}

export function normalizeSlot(candidate, slotId) {
  const source =
    candidate && typeof candidate === "object" && Array.isArray(candidate) === false
      ? candidate
      : {};
  const nickname =
    typeof source.nickname === "string" && source.nickname.trim() !== ""
      ? source.nickname.trim()
      : slotId.toUpperCase();
  const assigned = source.assigned === true;
  const connected = source.connected === true;
  const urlExcluded = source.urlExcluded === true;
  const ready = source.ready === true || (assigned && connected && urlExcluded !== true);

  return {
    slotId: slotId,
    nickname: nickname,
    assigned: assigned,
    connected: connected,
    ready: ready,
    state:
      typeof source.state === "string" && source.state.trim() !== ""
        ? source.state.trim()
        : "empty",
    urlExcluded: urlExcluded,
    accountId:
      typeof source.accountId === "string" && source.accountId.trim() !== ""
        ? source.accountId.trim()
        : null,
    remoteUserId:
      typeof source.remoteUserId === "string" && source.remoteUserId.trim() !== ""
        ? source.remoteUserId.trim()
        : null,
  };
}

export function sanitizeContext(payload) {
  const source =
    payload && typeof payload === "object" && Array.isArray(payload) === false ? payload : {};
  const slotsSource =
    source.slots && typeof source.slots === "object" && Array.isArray(source.slots) === false
      ? source.slots
      : {};
  const userSource =
    source.user && typeof source.user === "object" && Array.isArray(source.user) === false
      ? source.user
      : {};
  const defaultFeatures = getDefaultFeatureRecords();
  const featureMap = new Map(
    defaultFeatures.map(function (feature) {
      return [feature.id, feature];
    })
  );
  if (Array.isArray(source.features)) {
    source.features.forEach(function (feature) {
      const normalized = sanitizeFeatureRecord(feature, FEATURE_ID);
      featureMap.set(normalized.id, normalized);
    });
  }
  const features = Array.from(featureMap.values());
  const activeFeature = sanitizeFeatureRecord(
    source.activeFeature,
    normalizeFeatureId(
      source.room &&
        typeof source.room === "object" &&
        Array.isArray(source.room) === false &&
        typeof source.room.defaultFeatureId === "string"
        ? source.room.defaultFeatureId
        : FEATURE_ID
    )
  );

  return {
    room:
      source.room && typeof source.room === "object" && Array.isArray(source.room) === false
        ? source.room
        : { id: ROOM_ID },
    presentation:
      source.presentation &&
      typeof source.presentation === "object" &&
      Array.isArray(source.presentation) === false
        ? source.presentation
        : { mode: "classic" },
    user: {
      nickname:
        typeof userSource.nickname === "string" && userSource.nickname.trim() !== ""
          ? userSource.nickname.trim()
          : "User",
    },
    features: features,
    activeFeature:
      features.find(function (feature) {
        return feature.id === activeFeature.id;
      }) || activeFeature,
    slots: {
      ai1: normalizeSlot(slotsSource.ai1, "ai1"),
      ai2: normalizeSlot(slotsSource.ai2, "ai2"),
      us1: normalizeSlot(slotsSource.us1, "us1"),
    },
  };
}

export function readLocale(api) {
  return normalizeLocale(
    typeof api.getLocale === "function" ? api.getLocale() : api.getState("locale")
  );
}

export function getActiveFeatureId(context) {
  return normalizeFeatureId(
    context && context.activeFeature ? context.activeFeature.id : FEATURE_ID
  );
}

export function loadContext(api) {
  return sanitizeContext(api.getState("xox-context"));
}

export function saveContext(api, payload) {
  const context = sanitizeContext(payload);
  api.setState("xox-context", context);
  return context;
}
