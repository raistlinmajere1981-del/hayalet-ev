import assert from "node:assert/strict";
import test from "node:test";
import { existsSync, readFileSync } from "node:fs";

void test("Fate Knots AI2 lifecycle dispatches bounded seat-owned decisions", () => {
  const driverPath =
    "rooms/game-room/main-functions/fate-knots/host/ai2-player-lifecycle.ts";
  const extensionPath = "rooms/game-room/host/fate-knots-ai2-lifecycle-extension.ts";
  const uiPath = "rooms/game-room/main-functions/fate-knots/ui/ai2-lifecycle.js";

  [driverPath, extensionPath, uiPath].forEach((filePath) => {
    assert.equal(existsSync(filePath), true, filePath);
  });

  const driver = readFileSync(driverPath, "utf8");
  assert.match(driver, /GameRoomFateKnotsRequestAi2RunCharacter/);
  assert.match(driver, /GameRoomFateKnotsAi2SelectRunCharacter/);
  assert.match(driver, /FATE_KNOTS_EXPLORATION_CONSENSUS_COMMAND_NAMES\.chooseAi2/);
  assert.match(driver, /GameRoomFateKnotsAi2CompleteCombatMove/);
  assert.match(driver, /FATE_KNOTS_CAMP_COMMAND_NAMES\.readyAi2/);
  assert.match(driver, /FATE_KNOTS_LOOT_COMMAND_NAMES\.approveAi2/);
  assert.match(driver, /action: "message\.send"/);
  assert.match(driver, /toSlot: "ai2"/);
  assert.match(driver, /room\.expectedCommandCapture/);
  assert.match(driver, /GameRoomFateKnotsAi2GetCombatOptions/);
  assert.doesNotMatch(driver, /GameRoomFateKnotsRemoteCompleteCombatMove/);

  const extension = readFileSync(extensionPath, "utf8");
  assert.match(extension, /originalRegisterCommand/);
  assert.match(extension, /wrapCommandHandler/);
  assert.match(extension, /dispatchFateKnotsAi2LifecycleIfNeeded/);
  assert.match(extension, /requestFateKnotsAi2RunCharacter/);
  assert.match(extension, /scope: "room-ui"/);

  const ui = readFileSync(uiPath, "utf8");
  assert.match(ui, /GameRoomFateKnotsRequestAi2RunCharacter/);
  assert.match(ui, /title !== "AI2"/);

  const indexHtml = readFileSync("rooms/game-room/ui/index.html", "utf8");
  const hubIndex = indexHtml.indexOf("../main-functions/fate-knots/ui/hub.js");
  const lifecycleIndex = indexHtml.indexOf("../main-functions/fate-knots/ui/ai2-lifecycle.js");
  const gameplayIndex = indexHtml.indexOf("../main-functions/fate-knots/ui/gameplay.js");
  assert.ok(hubIndex >= 0);
  assert.ok(hubIndex < lifecycleIndex);
  assert.ok(lifecycleIndex < gameplayIndex);
});
