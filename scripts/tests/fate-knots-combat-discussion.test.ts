import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import {
  appendFateKnotsCombatDiscussionMessage,
  getFateKnotsCombatDiscussion,
} from "../../rooms/game-room/main-functions/fate-knots/host/combat-discussion.ts";
import type { FateKnotsRunState } from "../../rooms/game-room/main-functions/fate-knots/shared/contracts.ts";

function createApi() {
  const state = new Map<string, unknown>();
  return {
    getState(key: string) {
      return state.get(key);
    },
    setState(key: string, value: unknown) {
      state.set(key, value);
      return value;
    },
  };
}

function createRun(): FateKnotsRunState {
  const actors = [
    {
      actorId: "actor-user",
      characterId: "hero-user",
      seatId: "user" as const,
      teamId: "party" as const,
      hp: 10,
      maxHp: 10,
      attack: 1,
      defense: 1,
      speed: 1,
      energy: 1,
      fallen: false,
      position: { row: "front" as const, range: "near" as const },
      ownedCardIds: [],
      availableCardIds: [],
      equipmentIds: [],
      statusIds: [],
      injuryIds: [],
    },
    {
      actorId: "actor-ai2",
      characterId: "hero-ai2",
      seatId: "ai2" as const,
      teamId: "party" as const,
      hp: 10,
      maxHp: 10,
      attack: 1,
      defense: 1,
      speed: 1,
      energy: 1,
      fallen: false,
      position: { row: "rear" as const, range: "near" as const },
      ownedCardIds: [],
      availableCardIds: [],
      equipmentIds: [],
      statusIds: [],
      injuryIds: [],
    },
    {
      actorId: "actor-enemy",
      characterId: "enemy",
      seatId: null,
      teamId: "opposition" as const,
      hp: 10,
      maxHp: 10,
      attack: 1,
      defense: 1,
      speed: 1,
      energy: 1,
      fallen: false,
      position: { row: "front" as const, range: "near" as const },
      ownedCardIds: [],
      availableCardIds: [],
      equipmentIds: [],
      statusIds: [],
      injuryIds: [],
    },
  ];

  return {
    schemaVersion: 1,
    runId: "run-1",
    universeId: "universe-1",
    phase: "combat-discussion",
    revision: 2,
    activeLocationId: "location-1",
    activeKnotId: "knot-1",
    activeStoryTransitionId: "transition-1",
    activeEncounterId: "encounter-1",
    revealedLocationIds: ["location-1"],
    revealedKnotIds: ["knot-1"],
    completedKnotIds: [],
    partyActorIds: ["actor-user", "actor-ai2"],
    actors: structuredClone(actors),
    teamPoolItemIds: [],
    activeCombat: {
      combatId: "combat-1",
      turnIndex: 0,
      phase: "combat-discussion",
      config: { maxMovementCards: 1, maxActionCards: 1 },
      actors,
      commits: [],
      result: "active",
    },
    finaleUnlocked: false,
    result: "active",
  };
}

void test("V1 combat discussion is bounded, party-only and noncanonical", () => {
  const api = createApi();
  const run = createRun();
  const before = structuredClone(run);

  const first = appendFateKnotsCombatDiscussionMessage(api, run, "user", "Önce yaklaşalım.");
  assert.equal(first.ok, true);
  const second = appendFateKnotsCombatDiscussionMessage(api, run, "user", "Ben önden giderim.");
  assert.equal(second.ok, true);
  const third = appendFateKnotsCombatDiscussionMessage(api, run, "ai2", "Ben arkadan desteklerim.");
  assert.equal(third.ok, true);

  assert.deepEqual(run, before, "chat must not mutate canonical run/combat state");
  assert.deepEqual(third.ok ? third.state.messages.map((entry) => entry.seatId) : [], [
    "user",
    "user",
    "ai2",
  ]);
  assert.deepEqual(third.ok ? third.state.messages.map((entry) => entry.index) : [], [0, 1, 2]);
  assert.deepEqual(third.ok ? third.state.activeSeatIds : [], ["user", "ai2"]);

  const ai0Attempt = appendFateKnotsCombatDiscussionMessage(api, run, "ai0", "hidden");
  assert.equal(ai0Attempt.ok, false);
  const ai1Attempt = appendFateKnotsCombatDiscussionMessage(api, run, "ai1", "hidden");
  assert.equal(ai1Attempt.ok, false);

  const committedRun = structuredClone(run);
  committedRun.phase = "combat-commit";
  committedRun.activeCombat!.phase = "combat-commit";
  committedRun.activeCombat!.commits = [{ actorId: "actor-user", committed: true }];
  const duringCommit = getFateKnotsCombatDiscussion(api, committedRun);
  assert.equal(duringCommit.ok, true);
  assert.deepEqual(duringCommit.ok ? duringCommit.state.readySeatIds : [], ["user"]);

  const nextTurn = structuredClone(run);
  nextTurn.activeCombat!.turnIndex = 1;
  const nextDiscussion = getFateKnotsCombatDiscussion(api, nextTurn);
  assert.equal(nextDiscussion.ok, true);
  assert.deepEqual(nextDiscussion.ok ? nextDiscussion.state.messages : [], []);

  const resolving = structuredClone(run);
  resolving.phase = "combat-resolution";
  resolving.activeCombat!.phase = "combat-resolution";
  const closed = appendFateKnotsCombatDiscussionMessage(api, resolving, "user", "late");
  assert.equal(closed.ok, false);
});

void test("combat discussion sender and CompleteMove authority stay host-bound", () => {
  const discussionRuntime = readFileSync(
    "rooms/game-room/main-functions/fate-knots/host/combat-discussion-runtime.ts",
    "utf8"
  );
  const turnRuntime = readFileSync(
    "rooms/game-room/main-functions/fate-knots/host/combat-turn-runtime.ts",
    "utf8"
  );
  const hostRuntime = readFileSync("rooms/game-room/host/runtime.ts", "utf8");
  const contract = readFileSync(
    "rooms/game-room/main-functions/fate-knots/COMBAT-DISCUSSION-V1.md",
    "utf8"
  );

  assert.match(contract, /no per-message recipient selection/i);
  assert.match(contract, /combat-discussion/);
  assert.match(contract, /combat-commit/);
  assert.match(contract, /AI0 opposition actors do not receive party combat discussion/);

  assert.match(discussionRuntime, /append\(api, payload, "user"\)/);
  assert.match(discussionRuntime, /append\(api, payload, "ai2"\)/);
  assert.match(discussionRuntime, /append\(api, payload, "us1"\)/);
  assert.doesNotMatch(discussionRuntime, /payload\["seatId"\]/);
  assert.doesNotMatch(discussionRuntime, /payload\["actorId"\]/);

  assert.match(turnRuntime, /openFateKnotsCombatCommitPhase/);
  assert.match(turnRuntime, /setFateKnotsCombatCommit/);
  assert.match(turnRuntime, /seat-already-committed/);
  assert.match(turnRuntime, /allPlayerPartyCommitted\(run\)/);
  assert.match(turnRuntime, /chooseFateKnotsEnemyCombatCommit/);
  assert.match(turnRuntime, /beginFateKnotsCombatResolution/);
  assert.doesNotMatch(turnRuntime, /executeFateKnotsRunCombatResolution/);
  assert.doesNotMatch(turnRuntime, /payload\["seatId"\]/);
  assert.doesNotMatch(turnRuntime, /payload\["actorId"\]/);

  assert.match(hostRuntime, /persistFateKnotsCommandMutation\(api, \(\) =>/);
  assert.match(hostRuntime, /FATE_KNOTS_COMBAT_TURN_COMMAND_NAMES\.completeLocal/);
  assert.match(hostRuntime, /FATE_KNOTS_COMBAT_DISCUSSION_COMMAND_NAMES\.sendAi2/);
  assert.match(hostRuntime, /FATE_KNOTS_COMBAT_DISCUSSION_COMMAND_NAMES\.sendRemote/);
});
