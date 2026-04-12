import {
  LABORATORY_MEDIA_STAGES,
  LABORATORY_ROOM_ID,
  createLaboratoryWorkbenchState,
  normalizeLaboratoryLocale,
} from "../host/runtime-primitives.js";

export const LABORATORY_SLOT_IDS = ["ai1", "ai2", "us1"] as const;
export const LABORATORY_STAGE_IDS = [...LABORATORY_MEDIA_STAGES];

export type LaboratoryPresentationMode = "classic" | "scene-view";

export interface LaboratoryWorkbenchContext {
  schemaVersion: number;
  experienceId: string;
  mode: string;
  primaryFeatureId: string;
  activeModuleId: string;
  availableModuleIds: string[];
  selectedModuleIds: string[];
}

export interface LaboratoryRoomShellContext {
  room: { id: string; name: string };
  user: { nickname: string };
  locale: string;
  featureId: string;
  workbench: LaboratoryWorkbenchContext;
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
  const overrideRoom = overrides["room"];
  const room =
    overrideRoom && typeof overrideRoom === "object" && Array.isArray(overrideRoom) === false
      ? (overrideRoom as Record<string, unknown>)
      : {};
  const overrideUser = overrides["user"];
  const user =
    overrideUser && typeof overrideUser === "object" && Array.isArray(overrideUser) === false
      ? (overrideUser as Record<string, unknown>)
      : {};
  const overridePresentation = overrides["presentation"];
  const presentation =
    overridePresentation &&
    typeof overridePresentation === "object" &&
    Array.isArray(overridePresentation) === false
      ? (overridePresentation as Record<string, unknown>)
      : {};
  const overrideTranslations = overrides["translations"];
  const translations =
    overrideTranslations &&
    typeof overrideTranslations === "object" &&
    Array.isArray(overrideTranslations) === false
      ? (overrideTranslations as Record<string, unknown>)
      : {};
  const overrideSlots = overrides["slots"];
  const slots =
    overrideSlots && typeof overrideSlots === "object" && Array.isArray(overrideSlots) === false
      ? (overrideSlots as Record<string, unknown>)
      : {};
  const overrideWorkbench = overrides["workbench"];
  const workbenchOverrides =
    overrideWorkbench &&
    typeof overrideWorkbench === "object" &&
    Array.isArray(overrideWorkbench) === false
      ? (overrideWorkbench as Record<string, unknown>)
      : {};
  const workbench = createLaboratoryWorkbenchState({
    ...workbenchOverrides,
    activeModuleId: overrides["featureId"] ?? workbenchOverrides["activeModuleId"],
  });

  return {
    room: {
      id: LABORATORY_ROOM_ID,
      name:
        typeof room["name"] === "string" && room["name"].trim() !== ""
          ? room["name"].trim()
          : "Laboratory",
    },
    user: {
      nickname:
        typeof user["nickname"] === "string" && user["nickname"].trim() !== ""
          ? user["nickname"].trim()
          : "Operator",
    },
    locale: normalizeLaboratoryLocale(overrides["locale"]),
    featureId: workbench.activeModuleId,
    workbench,
    roomId:
      typeof overrides["roomId"] === "string" && overrides["roomId"].trim() !== ""
        ? overrides["roomId"].trim()
        : LABORATORY_ROOM_ID,
    presentation: createLaboratoryPresentationState(
      typeof presentation["mode"] === "string" ? presentation["mode"] : undefined,
      typeof presentation["uiScale"] === "number" || typeof presentation["uiScale"] === "string"
        ? presentation["uiScale"]
        : undefined
    ),
    translations,
    slots,
  };
}
