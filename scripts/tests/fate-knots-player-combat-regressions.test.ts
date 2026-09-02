import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";

void test("AI2 and US1 combat reads stay seat-bound while discussion stays shared", () => {
  const options = readFileSync(
    "rooms/game-room/main-functions/fate-knots/host/combat-options-runtime.ts",
    "utf8"
  );
  const discussion = readFileSync(
    "rooms/game-room/main-functions/fate-knots/host/combat-discussion-runtime.ts",
    "utf8"
  );
  const turn = readFileSync(
    "rooms/game-room/main-functions/fate-knots/host/combat-turn-runtime.ts",
    "utf8"
  );
  const extension = readFileSync(
    "rooms/game-room/host/fate-knots-player-combat-extension.ts",
    "utf8"
  );

  assert.match(options, /GameRoomFateKnotsGetCombatOptions/);
  assert.match(options, /GameRoomFateKnotsAi2GetCombatOptions/);
  assert.match(options, /GameRoomFateKnotsRemoteGetCombatOptions/);
  assert.match(options, /buildSeatOptions\(api, payload, "user"\)/);
  assert.match(options, /buildSeatOptions\(api, payload, "ai2"\)/);
  assert.match(options, /buildSeatOptions\(api, payload, "us1"\)/);
  assert.doesNotMatch(options, /payload\["actorId"\]/);
  assert.doesNotMatch(options, /payload\["seatId"\]/);

  assert.match(discussion, /GameRoomFateKnotsAi2GetCombatDiscussion/);
  assert.match(discussion, /GameRoomFateKnotsRemoteGetCombatDiscussion/);
  assert.match(discussion, /GameRoomFateKnotsAi2CombatMessage/);
  assert.match(discussion, /GameRoomFateKnotsRemoteCombatMessage/);

  assert.match(turn, /GameRoomFateKnotsAi2CompleteCombatMove/);
  assert.match(turn, /GameRoomFateKnotsRemoteCompleteCombatMove/);
  assert.doesNotMatch(turn, /payload\["actorId"\]/);
  assert.doesNotMatch(turn, /payload\["seatId"\]/);

  assert.match(extension, /"ai-slots"/);
  assert.match(extension, /"us1"/);
  assert.match(extension, /getAi2Options/);
  assert.match(extension, /getRemoteOptions/);
  assert.match(extension, /getAi2/);
  assert.match(extension, /getRemote/);
});
