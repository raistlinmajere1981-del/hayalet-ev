import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

void test("Fate Knots bridge hands safe gameplay state to the future book runtime without drawing it", () => {
  const bridge = readFileSync(
    "rooms/game-room/main-functions/fate-knots/ui/bridge.js",
    "utf8"
  );

  assert.match(bridge, /function handoffGameplayState\(message\)/);
  assert.match(bridge, /global\.GameRoomFateKnotsGameplayUi/);
  assert.match(bridge, /gameplayUi\.handleState\(message\)/);
  assert.match(bridge, /message\.type === "fate-knots-gameplay-state"/);
  assert.match(bridge, /new global\.CustomEvent\("fate-knots-gameplay-state"/);
  assert.match(bridge, /detail: message/);

  const gameplayBranch = bridge.slice(
    bridge.indexOf('message.type === "fate-knots-gameplay-state"'),
    bridge.indexOf("if (isFateKnotsCommandResult(message))")
  );
  assert.match(gameplayBranch, /handoffGameplayState\(message\)/);
  assert.doesNotMatch(gameplayBranch, /render\(\)/);
  assert.doesNotMatch(gameplayBranch, /base\.handleHostMessage/);
});
