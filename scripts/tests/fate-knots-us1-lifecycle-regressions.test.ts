import assert from "node:assert/strict";
import test from "node:test";
import { existsSync, readFileSync } from "node:fs";

void test("Fate Knots US1 stays an intent-only remote mirror of World Host authority", () => {
  const driverPath =
    "rooms/game-room/main-functions/fate-knots/host/us1-player-lifecycle.ts";
  const extensionPath = "rooms/game-room/host/fate-knots-us1-lifecycle-extension.ts";
  const uiPath = "rooms/game-room/main-functions/fate-knots/ui/us1-lifecycle.js";

  [driverPath, extensionPath, uiPath].forEach((filePath) => {
    assert.equal(existsSync(filePath), true, filePath);
  });

  const driver = readFileSync(driverPath, "utf8");
  assert.match(driver, /GameRoomFateKnotsRequestUs1RunCharacter/);
  assert.match(driver, /GameRoomFateKnotsCancelUs1RunCharacter/);
  assert.match(driver, /GameRoomFateKnotsUs1ClientSync/);
  assert.match(driver, /GameRoomFateKnotsRemoteSelectRunCharacter/);
  assert.match(driver, /GameRoomFateKnotsRemoteChooseExploration/);
  assert.match(driver, /GameRoomFateKnotsRemoteCompleteCombatMove/);
  assert.match(driver, /GameRoomFateKnotsRemoteProposeLoot/);
  assert.match(driver, /GameRoomFateKnotsRemoteReadyCamp/);
  assert.match(driver, /GameRoomFateKnotsRemoteSpeakNpc/);
  assert.match(driver, /FATE_KNOTS_COMBAT_OPTION_COMMAND_NAMES\.getRemoteOptions/);
  assert.match(driver, /FATE_KNOTS_COMBAT_DISCUSSION_COMMAND_NAMES\.getRemote/);
  assert.match(driver, /buildUs1RoomBridgeCommand/);
  assert.match(driver, /toSlot: "us1"/);
  assert.doesNotMatch(driver, /saveFateKnotsRunSnapshot/);
  assert.doesNotMatch(driver, /seatId:\s*"us1"/);

  const extension = readFileSync(extensionPath, "utf8");
  assert.match(extension, /originalRegisterCommand\.call/);
  assert.match(extension, /scope: "us1"/);
  assert.match(extension, /scope: "room-ui"/);
  assert.match(extension, /forwardFateKnotsUs1ClientIntent/);
  assert.match(extension, /dispatchFateKnotsUs1LifecycleIfNeeded/);
  assert.match(extension, /fate-knots-us1-mirror-state/);

  const ui = readFileSync(uiPath, "utf8");
  assert.match(ui, /GameRoomFateKnotsRequestUs1RunCharacter/);
  assert.match(ui, /GameRoomFateKnotsCancelUs1RunCharacter/);
  assert.match(ui, /GameRoomFateKnotsUs1ClientSelectCharacter/);
  assert.match(ui, /GameRoomFateKnotsUs1ClientChooseExploration/);
  assert.match(ui, /GameRoomFateKnotsUs1ClientCompleteCombatMove/);
  assert.match(ui, /GameRoomFateKnotsUs1ClientProposeLoot/);
  assert.match(ui, /GameRoomFateKnotsUs1ClientReadyCamp/);
  assert.match(ui, /GameRoomFateKnotsUs1ClientSpeakNpc/);
  assert.doesNotMatch(ui, /GameRoomFateKnotsRemoteChooseExploration/);

  const bridge = readFileSync(
    "rooms/game-room/main-functions/fate-knots/ui/bridge.js",
    "utf8"
  );
  assert.match(bridge, /GameRoomFateKnotsUs1MirrorUi/);
  assert.match(bridge, /fate-knots-us1-mirror-state/);
  assert.match(bridge, /hasMirrorState/);

  const indexHtml = readFileSync("rooms/game-room/ui/index.html", "utf8");
  const hubIndex = indexHtml.indexOf("../main-functions/fate-knots/ui/hub.js");
  const ai2Index = indexHtml.indexOf("../main-functions/fate-knots/ui/ai2-lifecycle.js");
  const us1Index = indexHtml.indexOf("../main-functions/fate-knots/ui/us1-lifecycle.js");
  const gameplayIndex = indexHtml.indexOf("../main-functions/fate-knots/ui/gameplay.js");
  assert.ok(hubIndex >= 0);
  assert.ok(hubIndex < ai2Index);
  assert.ok(ai2Index < us1Index);
  assert.ok(us1Index < gameplayIndex);
});
