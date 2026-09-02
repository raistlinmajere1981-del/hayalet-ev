import test from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";

void test("Fate Knots functional gameplay UI uses only player-safe combat intents", () => {
  const gameplay = readFileSync(
    "rooms/game-room/main-functions/fate-knots/ui/gameplay.js",
    "utf8"
  );

  assert.match(gameplay, /GameRoomFateKnotsGetCombatOptions/);
  assert.match(gameplay, /GameRoomFateKnotsGetCombatDiscussion/);
  assert.match(gameplay, /GameRoomFateKnotsSendCombatMessage/);
  assert.match(gameplay, /GameRoomFateKnotsCompleteCombatMove/);
  assert.match(gameplay, /GameRoomFateKnotsActivateUniverse/);
  assert.match(gameplay, /Hamleyi tamamla/);
  assert.match(gameplay, /Ortak savaş sohbeti/);
  assert.match(gameplay, /legalPrimaryTargetIds/);
  assert.match(gameplay, /isLocalReady\(\)/);
  assert.match(gameplay, /targetIsRequired\(\)/);

  assert.doesNotMatch(gameplay, /GameRoomFateKnotsSaveUniverse/);
  assert.doesNotMatch(gameplay, /GameRoomFateKnotsSaveRun/);
  assert.doesNotMatch(gameplay, /hiddenKnotIds/);
  assert.doesNotMatch(gameplay, /npcRoles/);
  assert.doesNotMatch(gameplay, /finale/);
  assert.doesNotMatch(gameplay, /\.commits\b/);
  assert.doesNotMatch(gameplay, /seatId\s*:/);
  assert.doesNotMatch(gameplay, /actorId\s*:/);
});

void test("Fate Knots gameplay renderer is loaded before its bridge and can return explicitly to Hub", () => {
  const indexHtml = readFileSync("rooms/game-room/ui/index.html", "utf8");
  const bridge = readFileSync(
    "rooms/game-room/main-functions/fate-knots/ui/bridge.js",
    "utf8"
  );
  const runtimeSync = readFileSync(
    "rooms/game-room/main-functions/fate-knots/host/runtime-sync.ts",
    "utf8"
  );

  const gameplayIndex = indexHtml.indexOf("../main-functions/fate-knots/ui/gameplay.js");
  const bridgeIndex = indexHtml.indexOf("../main-functions/fate-knots/ui/bridge.js");
  assert.ok(gameplayIndex >= 0 && gameplayIndex < bridgeIndex);
  assert.match(indexHtml, /main-functions\/fate-knots\/ui\/gameplay\.css/);
  assert.equal(
    existsSync("rooms/game-room/main-functions/fate-knots/ui/gameplay.css"),
    true
  );

  assert.match(bridge, /gameplayUi\.hasGameplayState\(\)/);
  assert.match(bridge, /gameplayUi\.render\(root\)/);
  assert.match(bridge, /gameplayUi\.dispose\(\)/);

  assert.match(runtimeSync, /state: gameplayState/);
  assert.doesNotMatch(runtimeSync, /if \(gameplayState !== null\)/);
});

void test("Fate Knots combat target UI intersects engine-provided target sets instead of inventing legality", () => {
  const gameplay = readFileSync(
    "rooms/game-room/main-functions/fate-knots/ui/gameplay.js",
    "utf8"
  );

  assert.match(gameplay, /function legalTargetIds\(\)/);
  assert.match(gameplay, /option\.targetRequired === true/);
  assert.match(gameplay, /allowed\.has\(actorId\)/);
  assert.match(gameplay, /legalTargetIds\(\)\.includes\(state\.primaryTargetId\)/);
  assert.doesNotMatch(gameplay, /evaluateFateKnotsCardLegality/);
  assert.doesNotMatch(gameplay, /buildFateKnotsAvailableCardIds/);
});
