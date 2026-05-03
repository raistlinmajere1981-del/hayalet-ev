import type { InstalledRoomFeatureRecord, InstalledRoomRecord } from "@shared/index.js";
import { buildRoomRuntimeContextPayload, type RoomHostMessage } from "./runtime-context.js";
import { sendRoomHostContext, syncRoomRuntimeContext } from "./runtime-sync.js";
import type { RoomWebviewElement } from "./runtime-messaging.js";

interface CreateRoomPageRuntimeContextRuntimeParams {
  getActiveFeature: () => InstalledRoomFeatureRecord | null;
  getPage: () => HTMLElement | null;
  getRoom: () => InstalledRoomRecord;
  getSceneFeature: () => InstalledRoomFeatureRecord | null;
  isSceneFeatureOpen: () => boolean;
  pendingHostMessages: WeakMap<RoomWebviewElement, RoomHostMessage[]>;
}

interface RoomPageRuntimeContextRuntime {
  buildPayload: (reason: string) => RoomHostMessage;
  sendHostContext: (webview: RoomWebviewElement, reason: string) => void;
  sync: (reason: string) => Promise<void>;
}

export function createRoomPageRuntimeContextRuntime(
  deps: CreateRoomPageRuntimeContextRuntimeParams
): RoomPageRuntimeContextRuntime {
  function buildPayload(reason: string): RoomHostMessage {
    const room = deps.getRoom();

    return buildRoomRuntimeContextPayload({
      activeFeature: deps.getActiveFeature(),
      reason,
      room,
      sceneFeature: deps.getSceneFeature(),
      sceneFeatureOpen: deps.isSceneFeatureOpen(),
    });
  }

  function sendHostContext(webview: RoomWebviewElement, reason: string): void {
    sendRoomHostContext({
      payload: buildPayload(reason),
      pendingHostMessages: deps.pendingHostMessages,
      webview,
    });
  }

  async function sync(reason: string): Promise<void> {
    await syncRoomRuntimeContext({
      getPage: deps.getPage,
      payload: buildPayload(reason),
      pendingHostMessages: deps.pendingHostMessages,
      roomId: deps.getRoom().id,
    });
  }

  return {
    buildPayload,
    sendHostContext,
    sync,
  };
}
