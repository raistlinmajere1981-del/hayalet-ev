import type { SlotStateInfo } from "../../../types/assistant.js";
import { AppState } from "../app-state.js";
import { SlotController, SlotEvent } from "../slot-controller.js";

export const ROOM_PRESENCE_SLOT_IDS = ["ai1", "ai2", "us1"] as const;

export type RoomPresenceSlotId = (typeof ROOM_PRESENCE_SLOT_IDS)[number];

export interface RoomPresenceUserSnapshot {
  nickname: string;
  avatar: string | null;
}

export interface RoomPresenceSlotSnapshot {
  slotId: RoomPresenceSlotId;
  label: string;
  nickname: string;
  avatar: string | null;
  assigned: boolean;
  connected: boolean;
  ready: boolean;
  state: string;
  urlExcluded: boolean;
  providerId: string | null;
  accountId: string | null;
  remoteUserId: string | null;
}

export interface RoomPresenceSnapshot {
  schemaVersion: 1;
  updatedAt: number;
  user: RoomPresenceUserSnapshot;
  slots: Record<RoomPresenceSlotId, RoomPresenceSlotSnapshot>;
}

interface BindRoomPresenceSubscriptionsParams {
  subscriptions: Array<() => void>;
  onPresenceChange: () => void;
}

function readAvatar(value: string): string | null {
  const normalized = value.trim();
  return normalized !== "" ? normalized : null;
}

export function buildRoomUserPresenceSnapshot(): RoomPresenceUserSnapshot {
  return {
    nickname: AppState.getNickname("user"),
    avatar: readAvatar(AppState.getAvatar("user")),
  };
}

export function buildRoomSlotPresenceSnapshot(
  slotId: RoomPresenceSlotId
): RoomPresenceSlotSnapshot {
  if (slotId === "us1") {
    const identity = AppState.getUs1Identity();
    const connected = AppState.isUs1Connected();

    return {
      slotId,
      label: slotId.toUpperCase(),
      nickname: AppState.getNickname(slotId),
      avatar: readAvatar(AppState.getAvatar(slotId)),
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
    avatar: readAvatar(AppState.getAvatar(slotId)),
    assigned: account !== null,
    connected,
    ready,
    state: slotState?.state ?? "empty",
    urlExcluded: slotState?.urlExcluded === true,
    providerId: slotState?.providerId ?? null,
    accountId: account?.id ?? slotState?.accountId ?? null,
    remoteUserId: null,
  };
}

export function createRoomPresenceSnapshot(
  user: RoomPresenceUserSnapshot,
  slots: Record<RoomPresenceSlotId, RoomPresenceSlotSnapshot>,
  updatedAt: number = Date.now()
): RoomPresenceSnapshot {
  return {
    schemaVersion: 1,
    updatedAt,
    user,
    slots,
  };
}

export function buildRoomPresenceSnapshot(): RoomPresenceSnapshot {
  const slots = {
    ai1: buildRoomSlotPresenceSnapshot("ai1"),
    ai2: buildRoomSlotPresenceSnapshot("ai2"),
    us1: buildRoomSlotPresenceSnapshot("us1"),
  };

  return createRoomPresenceSnapshot(buildRoomUserPresenceSnapshot(), slots);
}

export function bindRoomPresenceSubscriptions({
  subscriptions,
  onPresenceChange,
}: BindRoomPresenceSubscriptionsParams): void {
  if (subscriptions.length > 0) {
    return;
  }

  [
    SlotEvent.STATE_CHANGED,
    SlotEvent.ACCOUNT_ASSIGNED,
    SlotEvent.ACCOUNT_REMOVED,
    SlotEvent.URL_EXCLUDED,
    SlotEvent.URL_INCLUDED,
    SlotEvent.CONNECT_COMPLETE,
    SlotEvent.CONNECT_FAILED,
    SlotEvent.DISCONNECT_COMPLETE,
  ].forEach((eventName) => {
    subscriptions.push(SlotController.on(eventName, onPresenceChange));
  });

  subscriptions.push(AppState.subscribe(onPresenceChange));
}
