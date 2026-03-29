import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import {
  applyFateKnotsCombatAction,
  buildFateKnotsCombatTurnId,
  cloneFateKnotsCombatState,
  createFateKnotsCombatState,
  getAvailableFateKnotsCombatActions,
  getCurrentFateKnotsCombatTurn,
  settleAutomaticFateKnotsCombatTurns,
} from "../../rooms/game-room/main-functions/fate-knots/host/combat-engine.js";
import { loadFateKnotsContentRegistry } from "../../rooms/game-room/main-functions/fate-knots/host/content-loader.js";

test("Fate Knots combat engine public surface stays split across state and turn runtimes", () => {
  const combatEngineSource = readFileSync(
    "rooms/game-room/main-functions/fate-knots/host/combat-engine.js",
    "utf8"
  );
  const combatStateSource = readFileSync(
    "rooms/game-room/main-functions/fate-knots/host/combat-state.js",
    "utf8"
  );
  const combatTurnsSource = readFileSync(
    "rooms/game-room/main-functions/fate-knots/host/combat-turns.js",
    "utf8"
  );

  assert.match(combatEngineSource, /\.\/combat-state\.js/);
  assert.match(combatEngineSource, /\.\/combat-turns\.js/);
  assert.match(combatStateSource, /export function createFateKnotsCombatState\(options\)/);
  assert.match(combatStateSource, /export function cloneFateKnotsCombatState\(candidate\)/);
  assert.match(combatTurnsSource, /export function applyFateKnotsCombatAction\(combat, seatId, actionId, cardsById\)/);
  assert.match(combatTurnsSource, /export function settleAutomaticFateKnotsCombatTurns\(combat, enemyActionsById\)/);
});

function createCombatFixture() {
  const content = loadFateKnotsContentRegistry();
  const encounter = content.encountersById.get("well-entity");
  assert.ok(encounter);

  const combat = createFateKnotsCombatState({
    participants: [
      {
        seatId: "user",
        nickname: "Raistlin",
        selection: {
          avatarId: "ranger_avatar",
          classId: "ranger",
          backgroundId: "traveler",
        },
      },
      {
        seatId: "ai1",
        nickname: "Atlas",
        selection: {
          avatarId: "warrior_avatar",
          classId: "warrior",
          backgroundId: "former_soldier",
        },
      },
    ],
    encounter,
    classesById: content.classesById,
    startingEnergy: content.combatConfig.startingEnergy,
  });

  return { content, combat };
}

test("Fate Knots combat engine builds a playable opening turn from generated content", () => {
  const { content, combat } = createCombatFixture();

  const turn = getCurrentFateKnotsCombatTurn(combat);
  assert.equal(turn?.seatId, "user");
  assert.equal(turn?.side, "party");
  assert.equal(buildFateKnotsCombatTurnId(combat), "well-entity:1:0:user");
  assert.match(combat.log[0] ?? "", /pale thing climbs into the square/i);

  const actions = getAvailableFateKnotsCombatActions(combat, "user", content.cardsById);
  assert.deepEqual(
    actions.map((action) => action.id),
    ["quick-strike", "position", "dodge", "risk-strike"]
  );
  assert.equal(actions.every((action) => action.available === true), true);

  const clone = cloneFateKnotsCombatState(combat);
  assert.ok(clone);
  assert.notEqual(clone, combat);
  clone.party[0].hp -= 1;
  assert.notEqual(clone.party[0].hp, combat.party[0].hp);
});

test("Fate Knots combat engine applies a user card, advances to the enemy, and settles the automatic turn", () => {
  const { content, combat } = createCombatFixture();
  const enemyHpBefore = combat.enemy.hp;

  const actionResult = applyFateKnotsCombatAction(combat, "user", "quick-strike", content.cardsById);
  assert.equal(actionResult.success, true);
  assert.equal(combat.enemy.hp < enemyHpBefore, true);
  assert.match(combat.log.at(-1) ?? "", /Quick Strike/i);
  assert.equal(getCurrentFateKnotsCombatTurn(combat)?.side, "enemy");

  settleAutomaticFateKnotsCombatTurns(combat, content.enemyActionsById);

  assert.equal(getCurrentFateKnotsCombatTurn(combat)?.seatId, "ai1");
  assert.equal(combat.party.some((member) => member.hp < member.maxHp), true);
  assert.equal(
    combat.log.some((entry) => /uses (Lash|Pierce|Shriek)/.test(entry)),
    true
  );
  assert.equal(combat.outcome, "pending");
});

test("Fate Knots combat engine rejects invalid or out-of-turn actions without mutating the encounter", () => {
  const { content, combat } = createCombatFixture();
  const enemyHpBefore = combat.enemy.hp;

  const wrongSeatResult = applyFateKnotsCombatAction(combat, "ai1", "guard", content.cardsById);
  assert.equal(wrongSeatResult.success, false);
  assert.equal(wrongSeatResult.reason, "turn-mismatch");

  const missingCardResult = applyFateKnotsCombatAction(combat, "user", "missing-card", content.cardsById);
  assert.equal(missingCardResult.success, false);
  assert.equal(missingCardResult.reason, "invalid-card");
  assert.equal(combat.enemy.hp, enemyHpBefore);
  assert.equal(getCurrentFateKnotsCombatTurn(combat)?.seatId, "user");
});
