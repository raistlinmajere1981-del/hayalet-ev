import type { InstalledRoomFeatureRecord, InstalledRoomRecord } from "@shared/index.js";
import type { SlotStateInfo } from "../../../types/assistant.js";
import { AppState } from "../../modules/app-state.js";
import { AppI18n } from "../../modules/i18n/index.js";
import { SlotController } from "../../modules/slot-controller.js";

export type RoomHostMessage = Record<string, unknown>;

type RoomSlotId = "ai1" | "ai2" | "us1";

export function buildRoomSlotContext(slotId: RoomSlotId): Record<string, unknown> {
  if (slotId === "us1") {
    const identity = AppState.getUs1Identity();
    const connected = AppState.isUs1Connected();

    return {
      slotId,
      label: slotId.toUpperCase(),
      nickname: AppState.getNickname(slotId),
      assigned: identity !== null,
      connected,
      ready: identity !== null && connected,
      state: connected ? "connected" : identity !== null ? "assigned" : "empty",
      urlExcluded: false,
      providerId: "us1",
      accountId: AppState.getUs1ArchiveAccountId(),
      remoteUserId: identity?.remoteUserId ?? null,
    };
  }

  const slotState = SlotController.getState(slotId) as SlotStateInfo | null;
  const account = AppState.getAccountForSlot(slotId);
  const connected = slotState?.state === "connected";
  const ready =
    slotState !== null &&
    slotState.state === "connected" &&
    slotState.urlExcluded !== true &&
    account !== null;

  return {
    slotId,
    label: slotId.toUpperCase(),
    nickname: AppState.getNickname(slotId),
    assigned: account !== null,
    connected,
    ready,
    state: slotState?.state ?? "empty",
    urlExcluded: slotState?.urlExcluded === true,
    providerId: slotState?.providerId ?? null,
    accountId: account?.id ?? slotState?.accountId ?? null,
  };
}

export function buildRoomRuntimeContextPayload(options: {
  activeFeature: InstalledRoomFeatureRecord | null;
  reason: string;
  room: InstalledRoomRecord;
  sceneFeature: InstalledRoomFeatureRecord | null;
  sceneFeatureOpen: boolean;
}): RoomHostMessage {
  const { activeFeature, reason, room, sceneFeature, sceneFeatureOpen } = options;

  return {
    type: "host-context",
    reason,
    locale: AppI18n.getLocale(),
    translations: AppI18n.getNamespaceCatalog(["rooms", room.id]),
    room: {
      id: room.id,
      name: room.name,
      version: room.version,
      runtimeEntryPath: room.runtimeEntryPath,
      hostEntryPath: room.hostEntryPath,
      defaultFeatureId: room.defaultFeatureId,
    },
    user: {
      nickname: AppState.getNickname("user"),
    },
    slots: {
      ai1: buildRoomSlotContext("ai1"),
      ai2: buildRoomSlotContext("ai2"),
      us1: buildRoomSlotContext("us1"),
    },
    features: room.features.map((feature) => ({
      id: feature.id,
      name: feature.name,
      description: feature.description ?? "",
    })),
    activeFeature:
      activeFeature === null
        ? null
        : {
            id: activeFeature.id,
            name: activeFeature.name,
            description: activeFeature.description ?? "",
          },
    presentation: {
      mode: sceneFeatureOpen ? "scene-view" : "classic",
      sceneEnabled: room.scene !== undefined,
      sceneViewId: sceneFeature?.scene?.view.id ?? null,
    },
  };
}
