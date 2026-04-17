import {
  SLOT_PRESENCE_SLOT_IDS,
  SlotPresenceStore,
  type SlotPresenceSlotId,
  type SlotPresenceSnapshot,
  type SlotPresenceUserSnapshot,
} from "../slot-presence-store.js";

export const ROOM_PRESENCE_SLOT_IDS = SLOT_PRESENCE_SLOT_IDS;

export type RoomPresenceSlotId = SlotPresenceSlotId;
export type RoomPresenceUserSnapshot = SlotPresenceUserSnapshot;
export type RoomPresenceSnapshot = SlotPresenceSnapshot;
export type RoomPresenceSlotSnapshot = RoomPresenceSnapshot["slots"][RoomPresenceSlotId];

interface BindRoomPresenceSubscriptionsParams {
  subscriptions: Array<() => void>;
  onPresenceChange: () => void;
}

function cloneValue<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

export function buildRoomUserPresenceSnapshot(): RoomPresenceUserSnapshot {
  return SlotPresenceStore.getUser();
}

export function buildRoomAssistantPresenceSnapshot(): RoomPresenceSnapshot["assistant"] {
  return SlotPresenceStore.getAssistant();
}

export function buildRoomSlotPresenceSnapshot(
  slotId: RoomPresenceSlotId
): RoomPresenceSlotSnapshot {
  return SlotPresenceStore.getSlot(slotId);
}

export function createRoomPresenceSnapshot(
  user: RoomPresenceUserSnapshot,
  slots: Record<RoomPresenceSlotId, RoomPresenceSlotSnapshot>,
  assistant: RoomPresenceSnapshot["assistant"] = buildRoomAssistantPresenceSnapshot(),
  updatedAt: number = Date.now()
): RoomPresenceSnapshot {
  return {
    schemaVersion: 1,
    updatedAt,
    user: cloneValue(user),
    assistant: cloneValue(assistant),
    slots: cloneValue(slots),
  };
}

export function buildRoomPresenceSnapshot(): RoomPresenceSnapshot {
  return SlotPresenceStore.getSnapshot();
}

export function bindRoomPresenceSubscriptions({
  subscriptions,
  onPresenceChange,
}: BindRoomPresenceSubscriptionsParams): void {
  if (subscriptions.length > 0) {
    return;
  }

  subscriptions.push(
    SlotPresenceStore.subscribe(() => {
      onPresenceChange();
    })
  );
}
