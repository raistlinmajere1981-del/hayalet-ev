import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

void test("Fate Knots bridge renders the bounded gameplay surface when active-run state exists", () => {
  const bridge = readFileSync(
    "rooms/game-room/main-functions/fate-knots/ui/bridge.js",
    "utf8"
  );

  assert.match(bridge, /function handoffGameplayState\(message\)/);
  assert.match(bridge, /global\.GameRoomFateKnotsGameplayUi/);
  assert.match(bridge, /gameplayUi\.handleState\(message\)/);
  assert.match(bridge, /gameplayUi\.hasGameplayState\(\)/);
  assert.match(bridge, /gameplayUi\.render\(root\)/);
  assert.match(bridge, /message\.type === "fate-knots-gameplay-state"/);
  assert.match(bridge, /dispatchFateKnotsEvent\("fate-knots-gameplay-state", message\)/);

  const gameplayBranch = bridge.slice(
    bridge.indexOf('message.type === "fate-knots-gameplay-state"'),
    bridge.indexOf('message.type === "fate-knots-combat-discussion-state"')
  );
  assert.match(gameplayBranch, /handoffGameplayState\(message\)/);
  assert.match(gameplayBranch, /if \(isFateKnotsActive\(\)\) render\(\)/);
  assert.doesNotMatch(gameplayBranch, /base\.handleHostMessage/);
});

void test("Fate Knots bridge rerenders shared combat discussion inside the gameplay surface", () => {
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
  assert.match(discussionBranch, /if \(isFateKnotsActive\(\)\) render\(\)/);
  assert.doesNotMatch(discussionBranch, /base\.handleHostMessage/);
});

void test("Fate combat command results stay on gameplay UI instead of poisoning Hub messages", () => {
  const bridge = readFileSync(
    "rooms/game-room/main-functions/fate-knots/ui/bridge.js",
    "utf8"
  );

  assert.match(bridge, /const gameplayHandled = Boolean\(/);
  assert.match(bridge, /gameplayUi\.handleCommandResult\(message\)/);
  assert.match(bridge, /if \(gameplayHandled\) return;/);
  assert.match(bridge, /fateKnotsUi\.handleCommandResult\(message\)/);
});
