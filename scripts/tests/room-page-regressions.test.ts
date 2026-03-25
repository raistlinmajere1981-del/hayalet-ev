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
  const roomsCssSource = readFileSync("src/styles/rooms.css", "utf8");
  const mainCssSource = readFileSync("src/styles/main.css", "utf8");
  const gameRoomUiCssSource = readFileSync("rooms/game-room/ui/style.css", "utf8");
  const laboratoryUiCssSource = readFileSync("rooms/laboratory/ui/style.css", "utf8");

  assert.match(source, /private sceneFeatureId: string \| null = null;/);
  assert.match(
    source,
    /private getPageShellVariant\(\): "standard" \| "immersive-stage" \{\s*return this\.room\.scene\?\.chrome\?\.pageShellVariant \?\? "standard";\s*\}/
  );
  assert.match(
    source,
    /private usesImmersivePageShell\(\): boolean \{\s*return this\.getPageShellVariant\(\) === "immersive-stage";\s*\}/
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
  assert.match(source, /room-shell room-shell--immersive/);
  assert.match(source, /<div class="room-shell-topline"\$\{showFeatureStrip \? "" : " hidden"\}>/);
  assert.match(source, /room-runtime-mount room-runtime-mount--stage/);
  assert.match(source, /room-feature-strip room-feature-strip--header/);
  assert.match(source, /if \(this\.isSceneFeatureOpen\(\)\) \{\s*return this\.getSceneRuntimeSlot\(page\);/);
  assert.match(source, /await RoomHostRuntime\.handleRuntimeMessage\(this\.room\.id, "room-event", payload\);/);
  assert.doesNotMatch(source, /roomPageT\("page\.badge"\)/);
  assert.doesNotMatch(source, /data-room-role="title"/);
  assert.doesNotMatch(source, /data-room-role="subtitle"/);
  assert.doesNotMatch(source, /roomPageT\("page\.featuresTitle"\)/);
  assert.doesNotMatch(source, /roomPageT\("page\.runtimeTitle"\)/);
  assert.doesNotMatch(source, /data-room-role="runtime-status"/);
  assert.doesNotMatch(source, /data-room-role="runtime-event"/);
  assert.doesNotMatch(source, /room-feature-panel/);
  assert.doesNotMatch(source, /room-feature-chip__summary/);
  assert.match(roomsCssSource, /\.rooms-page \{\s*position: relative;[\s\S]*height: 100%;/);
  assert.match(roomsCssSource, /\.room-page-shell \{\s*position: relative;[\s\S]*flex: 1 1 auto;[\s\S]*height: 100%;/);
  assert.match(roomsCssSource, /\.room-shell-stage--immersive \{\s*display: flex;[\s\S]*flex: 1 1 auto;[\s\S]*padding: 0;/);
  assert.match(roomsCssSource, /\.room-shell-panel--runtime \{\s*display: flex;[\s\S]*flex: 1 1 auto;[\s\S]*padding: 0;/);
  assert.match(roomsCssSource, /\.room-runtime-mount--stage \{\s*border: 0;[\s\S]*border-radius: inherit;/);
  assert.doesNotMatch(roomsCssSource, /\.room-feature-panel/);
  assert.doesNotMatch(roomsCssSource, /\.room-feature-chip__summary/);
  assert.match(mainCssSource, /\.room-runtime-mount \{\s*flex: 1;[\s\S]*min-height: 0;[\s\S]*height: 100%;/);
  assert.match(gameRoomUiCssSource, /body\[data-presentation-mode="scene-view"\] \.xox-shell \{\s*min-height: 100%;[\s\S]*padding: 0;/);
  assert.match(laboratoryUiCssSource, /body\[data-presentation-mode="scene-view"\] \.lab-shell \{\s*height: 100%;[\s\S]*padding: 0;/);
});

test("installed laboratory manifest keeps the subtitle-analysis scene contract for room-page routing", () => {
  const manifest = JSON.parse(readFileSync("data/rooms/laboratory/manifest.json", "utf8"));
  const subtitleFeature = Array.isArray(manifest.features)
    ? manifest.features.find((feature) => feature.id === "subtitle-analysis")
    : null;

  assert.equal(subtitleFeature?.scene?.hotspot?.id, "laboratory-subtitle-analysis");
  assert.equal(subtitleFeature?.scene?.view?.id, "subtitle-analysis-console");
});
