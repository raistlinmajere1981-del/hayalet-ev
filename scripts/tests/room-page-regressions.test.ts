import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { toRoomRuntimeFileUrl } from "../../src/js/modules/rooms/room-runtime-url.ts";

test("toRoomRuntimeFileUrl normalizes linux paths", () => {
  assert.equal(
    toRoomRuntimeFileUrl("/workspace/data/rooms/game-room/ui/index.html"),
    "file:///workspace/data/rooms/game-room/ui/index.html"
  );
});

test("toRoomRuntimeFileUrl normalizes windows-style paths", () => {
  assert.equal(
    toRoomRuntimeFileUrl("C:\\rooms\\game-room\\ui\\index.html"),
    "file:///C:/rooms/game-room/ui/index.html"
  );
});

test("toRoomRuntimeFileUrl encodes reserved url characters", () => {
  assert.equal(
    toRoomRuntimeFileUrl("/tmp/a b#c/index.html"),
    "file:///tmp/a%20b%23c/index.html"
  );
});

test("room page syncs slot-aware host context and scene runtime routing", () => {
  const source = readFileSync("src/js/pages/room-page.ts", "utf8");

  assert.match(source, /private sceneFeatureId: string \| null = null;/);
  assert.match(
    source,
    /private isImmersiveGameRoom\(\): boolean \{\s*return this\.room\.id === "game-room" \|\| this\.room\.id === "laboratory";\s*\}/
  );
  assert.match(source, /private getSceneFeature\(\): InstalledRoomFeatureRecord \| null/);
  assert.match(source, /private bindRoomContextSubscriptions\(\): void/);
  assert.match(source, /SlotEvent\.STATE_CHANGED/);
  assert.match(source, /SlotEvent\.DISCONNECT_COMPLETE/);
  assert.match(source, /void this\.syncRuntimeContext\("slot-state"\)/);
  assert.match(source, /private buildRuntimeContextPayload\(reason: string\): RoomHostMessage/);
  assert.match(source, /translations:\s*AppI18n\.getNamespaceCatalog\(\["rooms", this\.room\.id\]\)/);
  assert.match(source, /ai1:\s*this\.buildSlotContext\("ai1"\)/);
  assert.match(source, /ai2:\s*this\.buildSlotContext\("ai2"\)/);
  assert.match(source, /us1:\s*this\.buildSlotContext\("us1"\)/);
  assert.match(source, /if \(slotId === "us1"\)/);
  assert.match(source, /accountId:\s*AppState\.getUs1ArchiveAccountId\(\)/);
  assert.match(source, /remoteUserId:\s*identity\?\.remoteUserId \?\? null/);
  assert.match(source, /const sceneFeature = this\.getSceneFeature\(\);/);
  assert.match(source, /mode:\s*this\.isSceneFeatureOpen\(\) \? "scene-view" : "classic"/);
  assert.match(source, /sceneViewId:\s*sceneFeature\?\.scene\?\.view\.id \?\? null/);
  assert.match(source, /const viewOpen = sceneEnabled && this\.getSceneFeature\(\)\?\.scene !== undefined;/);
  assert.match(source, /this\.sceneFeatureId = null;/);
  assert.match(source, /room-shell room-shell--game/);
  assert.match(source, /room-runtime-mount room-runtime-mount--stage/);
  assert.match(source, /if \(this\.isSceneFeatureOpen\(\)\) \{\s*return this\.getSceneRuntimeSlot\(page\);/);
  assert.match(source, /await RoomHostRuntime\.handleRuntimeMessage\(this\.room\.id, "room-event", payload\);/);
});
