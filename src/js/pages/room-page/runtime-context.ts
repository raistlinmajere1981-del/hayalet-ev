import type { InstalledRoomFeatureRecord, InstalledRoomRecord } from "@shared/index.js";
import { AppI18n } from "../../modules/i18n/index.js";
import {
  buildRoomSlotPresenceSnapshot,
  buildRoomUserPresenceSnapshot,
  createRoomPresenceSnapshot,
  type RoomPresenceSlotSnapshot,
  type RoomPresenceSlotId,
} from "../../modules/rooms/room-presence.js";
import { getAppUiScale, getSceneUiScale } from "../../ui/theme/ui-scale-state.js";

export type RoomHostMessage = Record<string, unknown>;

type RoomSlotId = RoomPresenceSlotId;

export function buildRoomSlotContext(slotId: RoomSlotId): RoomPresenceSlotSnapshot {
  return buildRoomSlotPresenceSnapshot(slotId);
}

export function buildRoomRuntimeContextPayload(options: {
  activeFeature: InstalledRoomFeatureRecord | null;
  reason: string;
  room: InstalledRoomRecord;
  sceneFeature: InstalledRoomFeatureRecord | null;
  sceneFeatureOpen: boolean;
}): RoomHostMessage {
  const { activeFeature, reason, room, sceneFeature, sceneFeatureOpen } = options;
  const user = buildRoomUserPresenceSnapshot();
  const slots = {
    ai1: buildRoomSlotContext("ai1"),
    ai2: buildRoomSlotContext("ai2"),
    us1: buildRoomSlotContext("us1"),
  };
  const presence = createRoomPresenceSnapshot(user, slots);

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
    user,
    slots,
    presence,
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
      uiScale: sceneFeatureOpen ? getSceneUiScale() : getAppUiScale(),
      sceneEnabled: room.scene !== undefined,
      sceneViewId: sceneFeature?.scene?.view.id ?? null,
    },
  };
}
