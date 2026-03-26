import test from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
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
  const shellLayoutSource = readFileSync("src/js/pages/room-page/shell-layout.ts", "utf8");
  const runtimeContextSource = readFileSync("src/js/pages/room-page/runtime-context.ts", "utf8");
  const runtimeEventsSource = readFileSync("src/js/pages/room-page/runtime-events.ts", "utf8");
  const runtimeMessagingSource = readFileSync(
    "src/js/pages/room-page/runtime-messaging.ts",
    "utf8"
  );
  const roomsCssSource = readFileSync("src/styles/rooms.css", "utf8");
  const roomsPageCssSource = readFileSync("src/styles/rooms/page.css", "utf8");
  const roomsShellCssSource = readFileSync("src/styles/rooms/shell.css", "utf8");
  const mainCssSource = readFileSync("src/styles/main.css", "utf8");
  const gameRoomUiCssSource = readFileSync("rooms/game-room/ui/style.css", "utf8");
  const gameRoomXoxCssSource = readFileSync("rooms/game-room/main-functions/xox/styles.css", "utf8");
  const laboratoryUiCssSource = readFileSync("rooms/laboratory/ui/style.css", "utf8");
  const laboratoryShellCssSource = readFileSync("rooms/laboratory/shared/styles/shell.css", "utf8");

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
  assert.match(source, /return buildRoomRuntimeContextPayload\(\{/);
  assert.match(runtimeContextSource, /translations:\s*AppI18n\.getNamespaceCatalog\(\["rooms", room\.id\]\)/);
  assert.match(runtimeContextSource, /ai1:\s*buildRoomSlotContext\("ai1"\)/);
  assert.match(runtimeContextSource, /ai2:\s*buildRoomSlotContext\("ai2"\)/);
  assert.match(runtimeContextSource, /us1:\s*buildRoomSlotContext\("us1"\)/);
  assert.match(runtimeContextSource, /if \(slotId === "us1"\)/);
  assert.match(runtimeContextSource, /accountId:\s*AppState\.getUs1ArchiveAccountId\(\)/);
  assert.match(runtimeContextSource, /remoteUserId:\s*identity\?\.remoteUserId \?\? null/);
  assert.match(runtimeContextSource, /mode:\s*sceneFeatureOpen \? "scene-view" : "classic"/);
  assert.match(runtimeContextSource, /sceneViewId:\s*sceneFeature\?\.scene\?\.view\.id \?\? null/);
  assert.match(source, /\.\/room-page\/shell-layout\.js/);
  assert.match(source, /\.\/room-page\/runtime-events\.js/);
  assert.match(source, /const viewOpen = sceneEnabled && this\.getSceneFeature\(\)\?\.scene !== undefined;/);
  assert.match(source, /this\.sceneFeatureId = null;/);
  assert.match(shellLayoutSource, /export function ensureRoomPageShell\(/);
  assert.match(shellLayoutSource, /export function renderRoomFeatureButtons\(/);
  assert.match(runtimeEventsSource, /export function updateRoomRuntimeStatus\(/);
  assert.match(runtimeEventsSource, /export function bindRoomRuntimeEvents\(/);
  assert.match(runtimeEventsSource, /webview\.addEventListener\("did-start-loading"/);
  assert.match(runtimeEventsSource, /ipcEvent\.channel === "room-ready"/);
  assert.match(runtimeEventsSource, /ipcEvent\.channel === "room-command"/);
  assert.match(runtimeEventsSource, /ipcEvent\.channel === "room-event"/);
  assert.match(shellLayoutSource, /room-shell room-shell--immersive/);
  assert.match(shellLayoutSource, /<div class="room-shell-topline"\$\{options\.showFeatureStrip \? "" : " hidden"\}>/);
  assert.match(shellLayoutSource, /room-runtime-mount room-runtime-mount--stage/);
  assert.match(shellLayoutSource, /room-feature-strip room-feature-strip--header/);
  assert.match(source, /if \(this\.isSceneFeatureOpen\(\)\) \{\s*return this\.getSceneRuntimeSlot\(page\);/);
  assert.match(source, /await RoomHostRuntime\.handleRuntimeMessage\(this\.room\.id, "room-event", payload\);/);
  assert.match(source, /sendRoomRuntimeMessage\(this\.pendingHostMessages, webview, payload\)/);
  assert.match(runtimeMessagingSource, /export function sendRoomRuntimeMessage\(/);
  assert.match(runtimeMessagingSource, /export function flushPendingRoomHostMessages\(/);
  assert.match(runtimeMessagingSource, /export function describeRoomCommand\(/);
  assert.match(runtimeMessagingSource, /return `\+\+cmd:\$\{command\.trim\(\)\}`;/);
  assert.doesNotMatch(source, /roomPageT\("page\.badge"\)/);
  assert.doesNotMatch(source, /data-room-role="title"/);
  assert.doesNotMatch(source, /data-room-role="subtitle"/);
  assert.doesNotMatch(source, /roomPageT\("page\.featuresTitle"\)/);
  assert.doesNotMatch(source, /roomPageT\("page\.runtimeTitle"\)/);
  assert.doesNotMatch(source, /data-room-role="runtime-status"/);
  assert.doesNotMatch(source, /data-room-role="runtime-event"/);
  assert.doesNotMatch(source, /room-feature-panel/);
  assert.doesNotMatch(source, /room-feature-chip__summary/);
  assert.match(roomsCssSource, /@import "\.\/rooms\/page\.css";/);
  assert.match(roomsCssSource, /@import "\.\/rooms\/classic\.css";/);
  assert.match(roomsCssSource, /@import "\.\/rooms\/shell\.css";/);
  assert.match(roomsCssSource, /@import "\.\/rooms\/scene\.css";/);
  assert.match(roomsPageCssSource, /\.rooms-page \{\s*position: relative;[\s\S]*height: 100%;/);
  assert.match(
    roomsShellCssSource,
    /\.room-page-shell \{\s*position: relative;[\s\S]*flex: 1 1 auto;[\s\S]*height: 100%;/
  );
  assert.match(
    roomsShellCssSource,
    /\.room-shell-stage--immersive \{\s*display: flex;[\s\S]*flex: 1 1 auto;[\s\S]*padding: 0;/
  );
  assert.match(
    roomsShellCssSource,
    /\.room-shell-panel--runtime \{\s*display: flex;[\s\S]*flex: 1 1 auto;[\s\S]*padding: 0;/
  );
  assert.match(
    roomsShellCssSource,
    /\.room-runtime-mount--stage \{\s*border: 0;[\s\S]*border-radius: inherit;/
  );
  assert.doesNotMatch(roomsCssSource, /\.room-feature-panel/);
  assert.doesNotMatch(roomsCssSource, /\.room-feature-chip__summary/);
  assert.match(mainCssSource, /\.room-runtime-mount \{\s*flex: 1;[\s\S]*min-height: 0;[\s\S]*height: 100%;/);
  assert.match(gameRoomUiCssSource, /@import "\.\.\/shared\/styles\/base\.css";/);
  assert.match(gameRoomUiCssSource, /@import "\.\.\/main-functions\/xox\/styles\.css";/);
  assert.match(
    gameRoomXoxCssSource,
    /body\[data-presentation-mode="scene-view"\] \.xox-shell \{\s*min-height: 100%;[\s\S]*padding: 0;/
  );
  assert.match(laboratoryUiCssSource, /@import "\.\.\/shared\/styles\/shell\.css";/);
  assert.match(laboratoryUiCssSource, /@import "\.\.\/main-functions\/media-analysis\/styles\.css";/);
  assert.match(
    laboratoryShellCssSource,
    /body\[data-presentation-mode="scene-view"\] \.lab-shell \{\s*height: 100%;[\s\S]*padding: 0;/
  );
});

test("installed laboratory manifest keeps the subtitle-analysis scene contract for room-page routing", () => {
  const manifestPath = existsSync("data/rooms/laboratory/manifest.json")
    ? "data/rooms/laboratory/manifest.json"
    : "rooms/laboratory/manifest.json";
  const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
  const audioFeature = Array.isArray(manifest.features)
    ? manifest.features.find((feature) => feature.id === "audio-analysis")
    : null;
  const subtitleFeature = Array.isArray(manifest.features)
    ? manifest.features.find((feature) => feature.id === "subtitle-analysis")
    : null;

  assert.equal(audioFeature?.scene?.hotspot?.id, "laboratory-audio-analysis");
  assert.equal(audioFeature?.scene?.view?.id, "audio-analysis-console");
  assert.equal(
    audioFeature?.scene?.view?.backgroundSrc,
    "main-functions/audio-analysis/assets/sound-analysis.webp"
  );
  assert.equal(subtitleFeature?.scene?.hotspot?.id, "laboratory-subtitle-analysis");
  assert.equal(subtitleFeature?.scene?.view?.id, "subtitle-analysis-console");
  assert.equal(
    subtitleFeature?.scene?.view?.backgroundSrc,
    "main-functions/subtitle-analysis/assets/subtitle-analysis.webp"
  );
});
