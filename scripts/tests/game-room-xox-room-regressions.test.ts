import test from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";

import { validateRoomManifest } from "../../src/types/rooms.ts";

const requiredFiles = [
  "rooms/game-room/manifest.json",
  "rooms/game-room/host/index.ts",
  "rooms/game-room/host/runtime.js",
  "rooms/game-room/ui/index.html",
  "rooms/game-room/ui/context-runtime.js",
  "rooms/game-room/ui/index.ts",
  "rooms/game-room/ui/game-room-ui-bootstrap.js",
  "rooms/game-room/ui/game-room-ui-state-message-runtime.js",
  "rooms/game-room/ui/game-room-ui-runtime.js",
  "rooms/game-room/ui/style.css",
  "rooms/game-room/shared/host/feature-meta.ts",
  "rooms/game-room/shared/host/text.ts",
  "rooms/game-room/shared/host/context-state.ts",
  "rooms/game-room/shared/host/activation.ts",
  "rooms/game-room/shared/host/command-registry.ts",
  "rooms/game-room/shared/host/command-args.ts",
  "rooms/game-room/shared/ui/feature-contract.js",
  "rooms/game-room/shared/ui/scroll-runtime.js",
  "rooms/game-room/shared/types/room-shell-contracts.ts",
  "rooms/game-room/main-functions/xox/host/runtime.js",
  "rooms/game-room/shared/styles/base.css",
  "rooms/game-room/i18n/en.json",
  "rooms/game-room/i18n/tr.json",
  "rooms/game-room/main-functions/xox/protocols/game-room-xox-user-start.md",
  "rooms/game-room/main-functions/xox/protocols/game-room-xox-ai-start.md",
  "rooms/game-room/main-functions/xox/host/copy.js",
  "rooms/game-room/main-functions/xox/host/runtime-match.js",
  "rooms/game-room/main-functions/xox/host/runtime-sync.js",
  "rooms/game-room/main-functions/xox/host/state-core.js",
  "rooms/game-room/main-functions/xox/host/state-invites.js",
  "rooms/game-room/main-functions/xox/host/state-room-runtime.js",
  "rooms/game-room/main-functions/xox/host/state.js",
  "rooms/game-room/main-functions/xox/host/us1-invite-runtime.js",
  "rooms/game-room/main-functions/xox/host/us1-sync-runtime.js",
  "rooms/game-room/main-functions/xox/host/us1-runtime.js",
  "rooms/game-room/main-functions/xox/ui/state-runtime.js",
  "rooms/game-room/main-functions/xox/ui/render-runtime.js",
  "rooms/game-room/main-functions/xox/ui/module.js",
  "rooms/game-room/main-functions/xox/styles.css",
  "rooms/game-room/main-functions/xox/styles/layout.css",
  "rooms/game-room/main-functions/xox/styles/presentation.css",
  "rooms/game-room/main-functions/xox/styles/board.css",
  "rooms/game-room/main-functions/xox/styles/scene-view.css",
  "rooms/game-room/shared/assets/room-background.webp",
  "rooms/game-room/main-functions/xox/assets/xox-view.webp",
];

test("game-room workspace keeps the required XOX package files", () => {
  requiredFiles.forEach((filePath) => {
    assert.equal(existsSync(filePath), true, filePath);
  });
});

test("game-room manifest validates with the XOX-first room contract", () => {
  const manifest = JSON.parse(readFileSync("rooms/game-room/manifest.json", "utf8"));
  const validation = validateRoomManifest(manifest);

  assert.equal(validation.valid, true);
  assert.equal(validation.manifest?.id, "game-room");
  assert.equal(validation.manifest?.defaultFeatureId, "xox");
  assert.deepEqual(
    validation.manifest?.features.map((feature) => feature.id),
    ["xox", "team-tetris", "fate-knots"]
  );
  assert.equal(validation.manifest?.runtime.uiEntry, "ui/index.html");
  assert.equal(validation.manifest?.runtime.hostEntry, "host/index.js");
  assert.equal(validation.manifest?.scene?.characterRosterPreset, "connected-plus-user");
  assert.equal(validation.manifest?.scene?.characters?.length, 3);
  assert.equal(validation.manifest?.scene?.chrome?.pageShellVariant, "immersive-stage");
});

test("game-room XOX UI forwards remote identity with invite actions", () => {
  const uiModuleSource = readFileSync("rooms/game-room/main-functions/xox/ui/module.js", "utf8");
  const uiStateRuntimeSource = readFileSync("rooms/game-room/main-functions/xox/ui/state-runtime.js", "utf8");
  const uiRenderRuntimeSource = readFileSync("rooms/game-room/main-functions/xox/ui/render-runtime.js", "utf8");
  const indexHtmlSource = readFileSync("rooms/game-room/ui/index.html", "utf8");
  const runtimeSource = readFileSync("rooms/game-room/main-functions/xox/host/runtime.js", "utf8");
  const stylesSource = readFileSync("rooms/game-room/main-functions/xox/styles.css", "utf8");
  const stateSource = readFileSync("rooms/game-room/main-functions/xox/host/state.js", "utf8");
  const stateCoreSource = readFileSync("rooms/game-room/main-functions/xox/host/state-core.js", "utf8");
  const stateInvitesSource = readFileSync("rooms/game-room/main-functions/xox/host/state-invites.js", "utf8");
  const stateRoomRuntimeSource = readFileSync(
    "rooms/game-room/main-functions/xox/host/state-room-runtime.js",
    "utf8"
  );
  const runtimeMatchSource = readFileSync("rooms/game-room/main-functions/xox/host/runtime-match.js", "utf8");
  const runtimeSyncSource = readFileSync("rooms/game-room/main-functions/xox/host/runtime-sync.js", "utf8");
  const us1RuntimeSource = readFileSync("rooms/game-room/main-functions/xox/host/us1-runtime.js", "utf8");
  const us1InviteRuntimeSource = readFileSync(
    "rooms/game-room/main-functions/xox/host/us1-invite-runtime.js",
    "utf8"
  );
  const us1SyncRuntimeSource = readFileSync(
    "rooms/game-room/main-functions/xox/host/us1-sync-runtime.js",
    "utf8"
  );

  assert.match(indexHtmlSource, /<script src="\.\/context-runtime\.js"><\/script>/);
  assert.match(indexHtmlSource, /<script src="\.\/game-room-ui-bootstrap\.js"><\/script>/);
  assert.match(indexHtmlSource, /<script src="\.\/game-room-ui-state-message-runtime\.js"><\/script>/);
  assert.match(indexHtmlSource, /main-functions\/xox\/ui\/state-runtime\.js/);
  assert.match(indexHtmlSource, /main-functions\/xox\/ui\/render-runtime\.js/);
  assert.match(stylesSource, /@import "\.\/styles\/layout\.css"/);
  assert.match(stylesSource, /@import "\.\/styles\/presentation\.css"/);
  assert.match(stylesSource, /@import "\.\/styles\/board\.css"/);
  assert.match(stylesSource, /@import "\.\/styles\/scene-view\.css"/);
  assert.match(uiModuleSource, /createXoxUiStateRuntime/);
  assert.match(uiModuleSource, /createXoxUiRenderRuntime/);
  assert.match(runtimeSource, /from "\.\/runtime-match\.js"/);
  assert.match(runtimeSource, /from "\.\/runtime-sync\.js"/);
  assert.match(stateSource, /from "\.\/state-core\.js"/);
  assert.match(stateSource, /from "\.\/state-invites\.js"/);
  assert.match(stateSource, /from "\.\/state-room-runtime\.js"/);
  assert.match(us1RuntimeSource, /from "\.\/us1-invite-runtime\.js"/);
  assert.match(us1RuntimeSource, /from "\.\/us1-sync-runtime\.js"/);
  assert.match(runtimeMatchSource, /export async function sendAiTurnUpdate/);
  assert.match(runtimeSyncSource, /export function syncFromContext/);
  assert.match(stateCoreSource, /export function createInitialState/);
  assert.match(stateInvitesSource, /export function normalizeInviteEntry/);
  assert.match(stateRoomRuntimeSource, /export function pushRoomState/);
  assert.match(us1InviteRuntimeSource, /export function createGameRoomXoxUs1InviteRuntime/);
  assert.match(us1SyncRuntimeSource, /export function createGameRoomXoxUs1SyncRuntime/);
  assert.match(
    uiStateRuntimeSource,
    /sendRoomCommand\("GameRoomXoxAcceptInvite",\s*\{\s*inviteId:\s*inviteId,\s*remoteUserId:\s*remoteUserId,\s*\}\s*\)/
  );
  assert.match(
    uiStateRuntimeSource,
    /sendRoomCommand\("GameRoomXoxRejectInvite",\s*\{\s*inviteId:\s*inviteId,\s*remoteUserId:\s*remoteUserId,\s*\}\s*\)/
  );
  assert.match(uiRenderRuntimeSource, /function renderBootstrap\(root\)/);
  assert.match(runtimeSource, /GameRoomXoxStart/);
});
