import {
  LABORATORY_FEATURE_IDS,
  LABORATORY_MEDIA_FEATURE_ID,
  LABORATORY_MEDIA_STAGES,
  LABORATORY_ROOM_ID,
  normalizeLaboratoryLocale
} from "../host/runtime-primitives.js";
export const LABORATORY_SLOT_IDS = ["ai1", "ai2", "us1"];
export const LABORATORY_STAGE_IDS = [...LABORATORY_MEDIA_STAGES];
export function createLaboratoryPresentationState(mode = "classic", uiScale = 100) {
  const numericScale = typeof uiScale === "number" ? uiScale : typeof uiScale === "string" ? Number.parseInt(uiScale, 10) : Number.NaN;
  const normalizedScale = Number.isFinite(numericScale) && numericScale > 0 ? Math.round(numericScale) : 100;
  return {
    mode: mode === "scene-view" ? "scene-view" : "classic",
    uiScale: Math.max(70, Math.min(130, normalizedScale))
  };
}
export function createLaboratoryRoomShellContext(overrides = {}) {
  const overrideRoom = overrides["room"];
  const room = overrideRoom && typeof overrideRoom === "object" && Array.isArray(overrideRoom) === false ? overrideRoom : {};
  const overrideUser = overrides["user"];
  const user = overrideUser && typeof overrideUser === "object" && Array.isArray(overrideUser) === false ? overrideUser : {};
  const overridePresentation = overrides["presentation"];
  const presentation = overridePresentation && typeof overridePresentation === "object" && Array.isArray(overridePresentation) === false ? overridePresentation : {};
  const overrideTranslations = overrides["translations"];
  const translations = overrideTranslations && typeof overrideTranslations === "object" && Array.isArray(overrideTranslations) === false ? overrideTranslations : {};
  const overrideSlots = overrides["slots"];
  const slots = overrideSlots && typeof overrideSlots === "object" && Array.isArray(overrideSlots) === false ? overrideSlots : {};
  return {
    room: {
      id: LABORATORY_ROOM_ID,
      name: typeof room["name"] === "string" && room["name"].trim() !== "" ? room["name"].trim() : "Laboratory"
    },
    user: {
      nickname: typeof user["nickname"] === "string" && user["nickname"].trim() !== "" ? user["nickname"].trim() : "Operator"
    },
    locale: normalizeLaboratoryLocale(overrides["locale"]),
    featureId: typeof overrides["featureId"] === "string" && LABORATORY_FEATURE_IDS.includes(overrides["featureId"]) ? overrides["featureId"] : LABORATORY_MEDIA_FEATURE_ID,
    roomId: typeof overrides["roomId"] === "string" && overrides["roomId"].trim() !== "" ? overrides["roomId"].trim() : LABORATORY_ROOM_ID,
    presentation: createLaboratoryPresentationState(
      typeof presentation["mode"] === "string" ? presentation["mode"] : void 0,
      typeof presentation["uiScale"] === "number" || typeof presentation["uiScale"] === "string" ? presentation["uiScale"] : void 0
    ),
    translations,
    slots
  };
}
