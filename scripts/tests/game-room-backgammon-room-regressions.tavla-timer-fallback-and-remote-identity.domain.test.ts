import test from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import vm from "node:vm";

import { validateRoomManifest } from "../../src/types/rooms.ts";
import { loadWorkspaceScriptForVm } from "./helpers/room-workspace-script.ts";

describe("Tavla timer fallback and remote identity", () => {
  void test("game-room Tavla render scheduler supports timer fallback and clears failures", () => {
    const harness = createGameRoomUiCoalescingHarness("timeout");

    harness.runtime.handleHostMessage({
      type: "backgammon-state",
      payload: {
        state: {
          active: true,
        },
      },
    });
    harness.runtime.handleHostMessage({
      type: "command-result",
      command: "GameRoomBackgammonReset",
      result: {
        success: true,
        message: "Reset.",
      },
    });

    assert.equal(harness.getTimerCount(), 1);
    assert.equal(harness.getRenderAttempts(), 0);
    harness.flushTimer();
    assert.equal(harness.getRenderAttempts(), 1);

    harness.setRenderFailure(true);
    harness.runtime.handleHostMessage({
      type: "backgammon-state",
      payload: {
        state: {
          active: false,
        },
      },
    });
    assert.equal(harness.getTimerCount(), 1);
    assert.throws(() => {
      harness.flushTimer();
    }, /render failed/);
    assert.equal(harness.getRenderAttempts(), 2);

    harness.setRenderFailure(false);
    harness.runtime.handleHostMessage({
      type: "backgammon-state",
      payload: {
        state: {
          active: true,
        },
      },
    });
    assert.equal(harness.getTimerCount(), 1);
    harness.flushTimer();
    assert.equal(harness.getRenderAttempts(), 3);
  });
  void test("game-room Tavla UI forwards remote identity with invite actions", () => {
    const uiModuleSource = loadWorkspaceScriptForVm(
      "rooms/game-room/main-functions/backgammon/ui/module.ts"
    );
    const uiStateRuntimeSource = loadWorkspaceScriptForVm(
      "rooms/game-room/main-functions/backgammon/ui/state-runtime.ts"
    );
    const backgammonStageRuntimeSource = loadWorkspaceScriptForVm(
      "rooms/game-room/main-functions/backgammon/ui/backgammon-stage-runtime.ts"
    );
    const uiRenderRuntimeSource = loadWorkspaceScriptForVm(
      "rooms/game-room/main-functions/backgammon/ui/render-runtime.ts"
    );
    const indexHtmlSource = readFileSync("rooms/game-room/ui/index.html", "utf8");
    const runtimeSource = loadWorkspaceScriptForVm(
      "rooms/game-room/main-functions/backgammon/host/runtime.ts"
    );
    const stylesSource = readFileSync(
      "rooms/game-room/main-functions/backgammon/styles.css",
      "utf8"
    );
    const stateSource = loadWorkspaceScriptForVm(
      "rooms/game-room/main-functions/backgammon/host/state.ts"
    );
    const stateCoreSource = loadWorkspaceScriptForVm(
      "rooms/game-room/main-functions/backgammon/host/state-core.ts"
    );
    const stateInvitesSource = loadWorkspaceScriptForVm(
      "rooms/game-room/main-functions/backgammon/host/state-invites.ts"
    );
    const stateRoomRuntimeSource = loadWorkspaceScriptForVm(
      "rooms/game-room/main-functions/backgammon/host/state-room-runtime.ts"
    );
    const runtimeMatchSource = loadWorkspaceScriptForVm(
      "rooms/game-room/main-functions/backgammon/host/runtime-match.ts"
    );
    const runtimeSyncSource = loadWorkspaceScriptForVm(
      "rooms/game-room/main-functions/backgammon/host/runtime-sync.ts"
    );
    const us1RuntimeSource = loadWorkspaceScriptForVm(
      "rooms/game-room/main-functions/backgammon/host/us1-runtime.ts"
    );
    const us1InviteRuntimeSource = loadWorkspaceScriptForVm(
      "rooms/game-room/main-functions/backgammon/host/us1-invite-runtime.ts"
    );
    const us1SyncRuntimeSource = loadWorkspaceScriptForVm(
      "rooms/game-room/main-functions/backgammon/host/us1-sync-runtime.ts"
    );

    assert.match(indexHtmlSource, /<script src="\.\/context-runtime\.js"><\/script>/);
    assert.match(indexHtmlSource, /shared\/vendor\/konva\.min\.js/);
    assert.match(indexHtmlSource, /main-functions\/backgammon\/ui\/backgammon-stage-runtime\.js/);
    assert.ok(
      indexHtmlSource.indexOf("shared/vendor/konva.min.js") <
        indexHtmlSource.indexOf("main-functions/backgammon/ui/backgammon-stage-runtime.js")
    );
    assert.ok(
      indexHtmlSource.indexOf("main-functions/backgammon/ui/backgammon-stage-runtime.js") <
        indexHtmlSource.indexOf("main-functions/backgammon/ui/render-runtime.js")
    );
    assert.match(indexHtmlSource, /<script src="\.\/game-room-ui-bootstrap\.js"><\/script>/);
    assert.match(
      indexHtmlSource,
      /<script src="\.\/game-room-ui-state-message-runtime\.js"><\/script>/
    );
    assert.match(indexHtmlSource, /main-functions\/backgammon\/ui\/state-runtime\.js/);
    assert.match(indexHtmlSource, /main-functions\/backgammon\/ui\/render-runtime\.js/);
    assert.match(stylesSource, /@import "\.\/styles\/layout\.css"/);
    assert.match(stylesSource, /@import "\.\/styles\/presentation\.css"/);
    assert.match(stylesSource, /@import "\.\/styles\/board\.css"/);
    assert.match(stylesSource, /@import "\.\/styles\/scene-view\.css"/);
    assert.match(uiModuleSource, /createBackgammonUiStateRuntime/);
    assert.match(uiModuleSource, /createBackgammonUiRenderRuntime/);
    assert.match(backgammonStageRuntimeSource, /createBackgammonStageRuntime/);
    assert.match(backgammonStageRuntimeSource, /renderBackgammonStage/);
    assert.match(backgammonStageRuntimeSource, /function flushStageDraw/);
    assert.match(backgammonStageRuntimeSource, /stageInstance\.draw\(\)/);
    assert.match(backgammonStageRuntimeSource, /flushStageDraw\(stage\)/);
    assert.match(
      backgammonStageRuntimeSource,
      /group\.add\(die\);\s*if \(animate\) \{\s*try \{\s*die\.to/
    );
    assert.match(backgammonStageRuntimeSource, /draggable/);
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
    assert.match(
      us1InviteRuntimeSource,
      /export function createGameRoomBackgammonUs1InviteRuntime/
    );
    assert.match(us1SyncRuntimeSource, /export function createGameRoomBackgammonUs1SyncRuntime/);
    assert.match(
      uiStateRuntimeSource,
      /sendRoomCommand\("GameRoomBackgammonAcceptInvite",\s*\{\s*(inviteId:\s*inviteId|inviteId),\s*(remoteUserId:\s*remoteUserId|remoteUserId)\s*,?\s*\}\s*\)/
    );
    assert.match(
      uiStateRuntimeSource,
      /sendRoomCommand\("GameRoomBackgammonRejectInvite",\s*\{\s*(inviteId:\s*inviteId|inviteId),\s*(remoteUserId:\s*remoteUserId|remoteUserId)\s*,?\s*\}\s*\)/
    );
    assert.match(uiRenderRuntimeSource, /function renderBootstrap\(root\)/);
    assert.match(runtimeSource, /GameRoomBackgammonStart/);
  });
});
