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
  assert.match(bridge, /dispatchFateKnotsEvent\("fate-knots-gameplay-state", message\)/);

  const gameplayBranch = bridge.slice(
    bridge.indexOf('message.type === "fate-knots-gameplay-state"'),
    bridge.indexOf('message.type === "fate-knots-combat-discussion-state"')
  );
  assert.match(gameplayBranch, /handoffGameplayState\(message\)/);
  assert.doesNotMatch(gameplayBranch, /render\(\)/);
  assert.doesNotMatch(gameplayBranch, /base\.handleHostMessage/);
});

void test("Fate Knots bridge hands shared combat discussion to the gameplay surface without Hub rerender", () => {
  const bridge = readFileSync(
    "rooms/game-room/main-functions/fate-knots/ui/bridge.js",
    "utf8"
  );

  assert.match(bridge, /function handoffCombatDiscussionState\(message\)/);
  assert.match(bridge, /gameplayUi\.handleCombatDiscussionState\(message\)/);
  assert.match(bridge, /dispatchFateKnotsEvent\("fate-knots-combat-discussion-state", message\)/);
  assert.match(bridge, /message\.type === "fate-knots-combat-discussion-state"/);

  const discussionBranch = bridge.slice(
    bridge.indexOf('message.type === "fate-knots-combat-discussion-state"'),
    bridge.indexOf("if (isFateKnotsCommandResult(message))")
  );
  assert.match(discussionBranch, /handoffCombatDiscussionState\(message\)/);
  assert.doesNotMatch(discussionBranch, /render\(\)/);
  assert.doesNotMatch(discussionBranch, /base\.handleHostMessage/);
});
