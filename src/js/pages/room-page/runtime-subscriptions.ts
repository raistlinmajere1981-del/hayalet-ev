import { AppState } from "../../modules/app-state.js";
import { SlotController, SlotEvent } from "../../modules/slot-controller.js";
import { TrafficManager } from "../../modules/traffic-manager.js";

interface BindRoomContextSubscriptionsParams {
  slotSubscriptions: Array<() => void>;
  syncContext: () => void;
  syncSceneCharacters: () => void;
}

export function bindRoomContextSubscriptions({
  slotSubscriptions,
  syncContext,
  syncSceneCharacters,
}: BindRoomContextSubscriptionsParams): void {
  if (slotSubscriptions.length > 0) {
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
    slotSubscriptions.push(
      SlotController.on(eventName, () => {
        syncContext();
        syncSceneCharacters();
      })
    );
  });

  slotSubscriptions.push(
    AppState.subscribe(() => {
      syncContext();
      syncSceneCharacters();
    })
  );

  slotSubscriptions.push(
    TrafficManager.onUpdate(() => {
      syncSceneCharacters();
    })
  );
}

export function clearRoomContextSubscriptions(slotSubscriptions: Array<() => void>): void {
  while (slotSubscriptions.length > 0) {
    const unsubscribe = slotSubscriptions.pop();
    try {
      unsubscribe?.();
    } catch {
      continue;
    }
  }
}
