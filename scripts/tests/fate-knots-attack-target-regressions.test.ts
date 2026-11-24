import assert from "node:assert/strict";
import test from "node:test";
import { evaluateFateKnotsCardLegality } from "../../rooms/game-room/main-functions/fate-knots/shared/card-legality.ts";
import { buildFateKnotsActorCombatLegalOptions } from "../../rooms/game-room/main-functions/fate-knots/shared/combat-options.ts";
import type {
  FateKnotsActorState,
  FateKnotsCardDefinition,
  FateKnotsCombatState,
} from "../../rooms/game-room/main-functions/fate-knots/shared/contracts.ts";

const attack: FateKnotsCardDefinition = {
  id: "strike",
  kind: "attack",
  name: "Strike",
  tags: [],
  effects: [{ id: "hit", kind: "damage", target: "primaryTarget", value: 5 }],
  presentation: [],
};
function actor(
  actorId: string,
  teamId: FateKnotsActorState["teamId"],
  fallen = false
): FateKnotsActorState {
  return {
    actorId,
    characterId: actorId,
    teamId,
    hp: fallen ? 0 : 10,
    maxHp: 10,
    attack: 2,
    defense: 2,
    speed: 2,
    energy: 3,
    fallen,
    position: { row: "front", range: "near" },
    ownedCardIds: ["strike"],
    availableCardIds: ["strike"],
    equipmentIds: [],
    statusIds: [],
    injuryIds: [],
  };
}
const hero = actor("hero", "party"),
  friend = actor("friend", "party"),
  enemy = actor("enemy", "opposition"),
  fallen = actor("fallen", "opposition", true);
function check(
  card: FateKnotsCardDefinition,
  actor: FateKnotsActorState,
  target: FateKnotsActorState | null
) {
  return evaluateFateKnotsCardLegality(card, {
    phase: "combat-commit",
    actor,
    target,
    cards: [card],
    equipment: [],
    statuses: [],
  });
}
void test("ordinary direct damage attacks default to standing opposing actors for either team", () => {
  assert.equal(check(attack, hero, enemy).legal, true);
  assert.equal(check(attack, enemy, hero).legal, true);
  assert.equal(check(attack, hero, hero).legal, false);
  assert.equal(check(attack, hero, friend).legal, false);
  assert.equal(check(attack, enemy, enemy).legal, false);
  assert.equal(check(attack, hero, fallen).legal, false);
  assert.equal(check(attack, hero, null).legal, false);
});
void test("explicit target team and life state are not silently overridden", () => {
  assert.equal(
    check({ ...attack, requirements: [{ targetTeam: "self" }] }, hero, hero).legal,
    true
  );
  assert.equal(
    check(
      { ...attack, requirements: [{ targetTeam: "any", targetLifeState: "any" }] },
      hero,
      fallen
    ).legal,
    true
  );
  assert.equal(
    check({ ...attack, requirements: [{ targetTeam: "party" }] }, enemy, hero).legal,
    true
  );
  assert.equal(
    check({ ...attack, requirements: [{ targetTeam: "party" }] }, hero, enemy).legal,
    false
  );
});
void test("player and enemy legal-option projections cannot offer unintended friendly damage", () => {
  const state = { actors: [hero, friend, enemy, fallen] } as FateKnotsCombatState;
  const catalog = { cards: [attack], equipment: [], statuses: [] };
  assert.deepEqual(
    buildFateKnotsActorCombatLegalOptions(state, hero, catalog).actionOptions[0]
      ?.legalPrimaryTargetIds,
    ["enemy"]
  );
  assert.deepEqual(
    buildFateKnotsActorCombatLegalOptions(state, enemy, catalog).actionOptions[0]
      ?.legalPrimaryTargetIds,
    ["hero", "friend"]
  );
});
