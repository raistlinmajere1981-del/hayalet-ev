import {
  LABORATORY_FEATURE_IDS,
  LABORATORY_MEDIA_FEATURE_ID,
  LABORATORY_MEDIA_STAGES,
  LABORATORY_ROOM_ID,
  normalizeLaboratoryLocale,
} from "../host/runtime-primitives.js";

export const LABORATORY_SLOT_IDS = ["ai1", "ai2", "us1"] as const;
export const LABORATORY_STAGE_IDS = [...LABORATORY_MEDIA_STAGES];

export type LaboratoryPresentationMode = "classic" | "scene-view";

export interface LaboratoryRoomShellContext {
  room: { id: string; name: string };
  user: { nickname: string };
  locale: string;
  featureId: string;
  roomId: string;
  presentation: {
    mode: LaboratoryPresentationMode;
    uiScale: number;
  };
  translations: Record<string, unknown>;
  slots: Record<string, unknown>;
}

export function createLaboratoryPresentationState(
  mode: string = "classic",
  uiScale: number | string = 100
): { mode: LaboratoryPresentationMode; uiScale: number } {
  const numericScale =
    typeof uiScale === "number"
      ? uiScale
      : typeof uiScale === "string"
        ? Number.parseInt(uiScale, 10)
        : Number.NaN;
  const normalizedScale =
    Number.isFinite(numericScale) && numericScale > 0 ? Math.round(numericScale) : 100;

  return {
    mode: mode === "scene-view" ? "scene-view" : "classic",
    uiScale: Math.max(70, Math.min(130, normalizedScale)),
  };
}

export function createLaboratoryRoomShellContext(
  overrides: Record<string, unknown> = {}
): LaboratoryRoomShellContext {
  const room =
    overrides.room && typeof overrides.room === "object" && Array.isArray(overrides.room) === false
      ? (overrides.room as Record<string, unknown>)
      : {};
  const user =
    overrides.user && typeof overrides.user === "object" && Array.isArray(overrides.user) === false
      ? (overrides.user as Record<string, unknown>)
      : {};
  const presentation =
    overrides.presentation &&
    typeof overrides.presentation === "object" &&
    Array.isArray(overrides.presentation) === false
      ? (overrides.presentation as Record<string, unknown>)
      : {};
  const translations =
    overrides.translations &&
    typeof overrides.translations === "object" &&
    Array.isArray(overrides.translations) === false
      ? (overrides.translations as Record<string, unknown>)
      : {};
  const slots =
    overrides.slots && typeof overrides.slots === "object" && Array.isArray(overrides.slots) === false
      ? (overrides.slots as Record<string, unknown>)
      : {};

  return {
    room: {
      id: LABORATORY_ROOM_ID,
      name: typeof room.name === "string" && room.name.trim() !== "" ? room.name.trim() : "Laboratory",
    },
    user: {
      nickname:
        typeof user.nickname === "string" && user.nickname.trim() !== ""
          ? user.nickname.trim()
          : "Operator",
    },
    locale: normalizeLaboratoryLocale(overrides.locale),
    featureId:
      typeof overrides.featureId === "string" && LABORATORY_FEATURE_IDS.includes(overrides.featureId)
        ? overrides.featureId
        : LABORATORY_MEDIA_FEATURE_ID,
    roomId:
      typeof overrides.roomId === "string" && overrides.roomId.trim() !== ""
        ? overrides.roomId.trim()
        : LABORATORY_ROOM_ID,
    presentation: createLaboratoryPresentationState(
      typeof presentation.mode === "string" ? presentation.mode : undefined,
      typeof presentation.uiScale === "number" || typeof presentation.uiScale === "string"
        ? presentation.uiScale
        : undefined
    ),
    translations,
    slots,
  };
}
