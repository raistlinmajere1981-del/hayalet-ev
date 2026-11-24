import {
  createFateKnotsRunFromSetup,
  startFateKnotsRun,
} from "../../rooms/game-room/main-functions/fate-knots/host/run-setup.ts";
import { getFateKnotsExplorationConsensus } from "../../rooms/game-room/main-functions/fate-knots/host/exploration-consensus.ts";
import assert from "node:assert/strict";
import test from "node:test";

import { DEFAULT_FATE_KNOTS_RULES } from "../../rooms/game-room/main-functions/fate-knots/rules/config.ts";
import {
  leaveFateKnotsCamp,
  settleFateKnotsCampRecovery,
} from "../../rooms/game-room/main-functions/fate-knots/shared/camp.ts";
import type {
  FateKnotsCombatResultPackage,
  FateKnotsRunState,
  FateKnotsUniversePackage,
} from "../../rooms/game-room/main-functions/fate-knots/shared/contracts.ts";
import { buildFateKnotsEncounterCombat } from "../../rooms/game-room/main-functions/fate-knots/shared/encounter.ts";
import {
  enterFateKnotsCombat,
  updateFateKnotsActiveCombat,
} from "../../rooms/game-room/main-functions/fate-knots/shared/run-flow.ts";
import { completeFateKnotsRun } from "../../rooms/game-room/main-functions/fate-knots/shared/run-phase.ts";
import { exitFateKnotsStoryCombat } from "../../rooms/game-room/main-functions/fate-knots/shared/story-combat-flow.ts";
import { resolveFateKnotsStoryLootDecision } from "../../rooms/game-room/main-functions/fate-knots/shared/story-loot-flow.ts";
import {
  applyFateKnotsStoryTransition,
  getFateKnotsLegalStoryTransitions,
} from "../../rooms/game-room/main-functions/fate-knots/shared/story-progression.ts";

function createUniverse(): FateKnotsUniversePackage {
  return {
    schemaVersion: 1,
    universeId: "headless-flow-v1",
    title: "Headless Flow Fixture",
    premise: "Combat and loot prepare the party for an authored terminal choice.",
    createdAt: "2026-09-03T00:00:00.000Z",
    theme: {
      id: "theme",
      name: "Fixture",
      backgroundAssetId: "background",
      closedBookAssetId: "closed-book",
      openPageAssetId: "open-page",
      cardFrameByKind: {},
      visualTags: [],
    },
    music: {
      id: "music",
      instrumentTags: [],
      moodTags: [],
      stateCueIds: {},
    },
    assets: [],
    locations: [
      {
        id: "gate",
        name: "Gate",
        description: "The guardian stands here.",
        sceneAssetIds: [],
        tags: [],
      },
      {
        id: "sanctum",
        name: "Sanctum",
        description: "The party may camp and later resolve the objective here.",
        sceneAssetIds: [],
        tags: [],
        campAllowed: true,
      },
    ],
    map: {
      startNodeId: "gate-node",
      nodes: [
        { id: "gate-node", locationId: "gate", label: "Gate", initiallyRevealed: true },
        {
          id: "sanctum-node",
          locationId: "sanctum",
          label: "Sanctum",
          initiallyRevealed: false,
        },
      ],
      edges: [],
    },
    story: {
      startKnotId: "gate-knot",
      knots: [
        {
          id: "gate-knot",
          locationId: "gate",
          visibleFacts: ["A guardian blocks the sanctum."],
          initiallyRevealed: true,
        },
        {
          id: "sanctum-knot",
          locationId: "sanctum",
          visibleFacts: ["The real objective remains after the guardian."],
          initiallyRevealed: false,
        },
      ],
      transitions: [
        {
          id: "guardian-fight",
          fromKnotId: "gate-knot",
          toKnotId: "sanctum-knot",
          label: "Face the guardian",
          kind: "combat",
          encounterId: "guardian",
          onVictory: { completeKnotIds: ["gate-knot"] },
        },
        {
          id: "camp-here",
          fromKnotId: "sanctum-knot",
          label: "Camp here",
          kind: "camp",
        },
        {
          id: "resolve-objective",
          fromKnotId: "sanctum-knot",
          label: "Resolve the objective",
          kind: "finale",
          requirements: {
            completedKnotIds: ["gate-knot"],
            ownedCardIds: ["guardian-key"],
          },
        },
      ],
      encounters: [
        {
          id: "guardian",
          locationId: "sanctum",
          opponentCharacterIds: ["guardian-character"],
          lootCardIds: ["guardian-key"],
        },
      ],
    },
    npcs: [],
    npcRoles: [],
    characters: [
      {
        id: "hero",
        name: "Hero",
        portraitAssetId: "hero-portrait",
        tags: ["player-template"],
        playerSelectable: true,
        startingPosition: { row: "front", range: "near" },
        baseStats: { maxHp: 10, attack: 2, defense: 2, speed: 2, energy: 3 },
        startingCardIds: [],
        startingEquipmentIds: [],
      },
      {
        id: "guardian-character",
        name: "Guardian",
        portraitAssetId: "guardian-portrait",
        tags: [],
        playerSelectable: false,
        startingPosition: { row: "front", range: "near" },
        baseStats: { maxHp: 8, attack: 2, defense: 1, speed: 1, energy: 2 },
        startingCardIds: [],
        startingEquipmentIds: [],
        combatController: { kind: "policy", policyId: "first-legal" },
      },
    ],
    cards: [
      {
        id: "guardian-key",
        kind: "item",
        name: "Guardian Key",
        tags: [],
        effects: [],
        presentation: [],
      },
    ],
    equipment: [],
    statuses: [],
    hiddenKnotIds: ["sanctum-knot"],
    finale: {
      id: "objective",
      conflictSummary: "Resolve the sanctum objective after acquiring the key.",
      finaleLocationId: "sanctum",
      requiredKnotIds: ["gate-knot"],
      requiredItemIds: ["guardian-key"],
      finalEncounterId: "guardian",
      successConditionId: "objective-resolved",
      epilogueConditionIds: [],
    },
  };
}

function createRun(): FateKnotsRunState {
  return {
    schemaVersion: 1,
    runId: "run-1",
    universeId: "headless-flow-v1",
    phase: "exploration",
    revision: 1,
    activeLocationId: "gate",
    activeKnotId: "gate-knot",
    activeStoryTransitionId: null,
    activeEncounterId: null,
    revealedLocationIds: ["gate"],
    revealedKnotIds: ["gate-knot"],
    completedKnotIds: [],
    partyActorIds: ["hero-actor"],
    actors: [
      {
        actorId: "hero-actor",
        characterId: "hero",
        seatId: "user",
        teamId: "party",
        hp: 7,
        maxHp: 10,
        attack: 2,
        defense: 2,
        speed: 2,
        energy: 1,
        fallen: false,
        position: { row: "front", range: "near" },
        ownedCardIds: [],
        availableCardIds: [],
        equipmentIds: [],
        statusIds: [],
        injuryIds: [],
      },
    ],
    teamPoolItemIds: [],
    activeCombat: null,
    finaleUnlocked: false,
    result: "active",
  };
}

void test("headless run returns through exploration and only an authored finale transition completes it", () => {
  const universe = createUniverse();
  const initial = createRun();

  const startedStoryCombat = applyFateKnotsStoryTransition(universe, initial, "guardian-fight");
  assert.equal(startedStoryCombat.ok, true, JSON.stringify(startedStoryCombat.issues));
  assert.equal(startedStoryCombat.run.phase, "transition");
  assert.equal(startedStoryCombat.run.activeStoryTransitionId, "guardian-fight");
  assert.equal(startedStoryCombat.run.activeEncounterId, "guardian");

  const encounter = buildFateKnotsEncounterCombat(
    universe,
    startedStoryCombat.run,
    "guardian",
    "combat-1",
    DEFAULT_FATE_KNOTS_RULES.combat.turn
  );
  assert.equal(encounter.ok, true, JSON.stringify(encounter.issues));
  assert.ok(encounter.combat);
  assert.ok(encounter.runtime);

  const entered = enterFateKnotsCombat(startedStoryCombat.run, encounter.combat);
  assert.equal(entered.ok, true, JSON.stringify(entered.issues));
  assert.equal(entered.run.phase, "combat-discussion");

  const terminalCombat = structuredClone(encounter.combat);
  terminalCombat.phase = "combat-aftermath";
  terminalCombat.result = "party-victory";
  const enemy = terminalCombat.actors.find((actor) => actor.teamId === "opposition");
  assert.ok(enemy);
  enemy.hp = 0;
  enemy.fallen = true;

  const storedTerminal = updateFateKnotsActiveCombat(entered.run, terminalCombat);
  assert.equal(storedTerminal.ok, true, JSON.stringify(storedTerminal.issues));

  const resultPackage: FateKnotsCombatResultPackage = {
    combatId: "combat-1",
    result: "party-victory",
    turns: 1,
    fallenActorIds: [enemy.actorId],
    survivingActorIds: ["hero-actor"],
    resolvedEffects: [],
    lootSourceId: "guardian",
    narrativeFacts: ["The guardian was defeated."],
  };
  const exitedCombat = exitFateKnotsStoryCombat(universe, storedTerminal.run, {
    runtime: encounter.runtime,
    statuses: universe.statuses,
    rules: DEFAULT_FATE_KNOTS_RULES,
    resultPackage,
  });
  assert.equal(exitedCombat.ok, true, JSON.stringify(exitedCombat.issues));
  assert.equal(exitedCombat.run.phase, "loot");
  assert.equal(exitedCombat.run.result, "active");
  assert.equal(exitedCombat.run.activeStoryTransitionId, "guardian-fight");
  assert.equal(exitedCombat.run.activeEncounterId, "guardian");
  assert.deepEqual(exitedCombat.run.teamPoolItemIds, ["guardian-key"]);

  const settledLoot = resolveFateKnotsStoryLootDecision(universe, exitedCombat.run, {
    runRevision: exitedCombat.run.revision,
    allocations: [
      {
        poolIndex: 0,
        cardId: "guardian-key",
        recipientActorId: "hero-actor",
      },
    ],
    approvedActorIds: ["hero-actor"],
  });
  assert.equal(settledLoot.ok, true, JSON.stringify(settledLoot.issues));
  assert.equal(settledLoot.run.phase, "exploration");
  assert.equal(settledLoot.run.result, "active");
  assert.equal(settledLoot.run.activeStoryTransitionId, null);
  assert.equal(settledLoot.run.activeEncounterId, null);
  assert.equal(settledLoot.run.finaleUnlocked, true);

  const legalAfterLoot = getFateKnotsLegalStoryTransitions(universe, settledLoot.run).map(
    (transition) => transition.id
  );
  assert.deepEqual(legalAfterLoot.sort(), ["camp-here", "resolve-objective"].sort());

  const enteredCamp = applyFateKnotsStoryTransition(universe, settledLoot.run, "camp-here");
  assert.equal(enteredCamp.ok, true, JSON.stringify(enteredCamp.issues));
  assert.equal(enteredCamp.run.phase, "camp");
  assert.equal(enteredCamp.run.activeLocationId, "sanctum");
  assert.equal(enteredCamp.run.activeKnotId, "sanctum-knot");
  assert.equal(enteredCamp.run.activeStoryTransitionId, null);

  const recovered = settleFateKnotsCampRecovery(universe, enteredCamp.run);
  assert.equal(recovered.ok, true, JSON.stringify(recovered.issues));
  assert.equal(recovered.run.actors[0]?.hp, 10);
  assert.equal(recovered.run.actors[0]?.energy, 3);

  const leftCamp = leaveFateKnotsCamp(universe, recovered.run);
  assert.equal(leftCamp.ok, true, JSON.stringify(leftCamp.issues));
  assert.equal(leftCamp.run.phase, "exploration");
  assert.equal(leftCamp.run.finaleUnlocked, true);

  const genericCompletion = completeFateKnotsRun({ ...leftCamp.run, phase: "finale" });
  assert.equal(genericCompletion.ok, false);
  assert.equal(genericCompletion.issues[0]?.code, "terminal-success-owned-by-story");

  const completed = applyFateKnotsStoryTransition(universe, leftCamp.run, "resolve-objective");
  assert.equal(completed.ok, true, JSON.stringify(completed.issues));
  assert.equal(completed.run.phase, "completed");
  assert.equal(completed.run.result, "completed");
  assert.equal(completed.run.activeStoryTransitionId, null);
  assert.equal(completed.run.activeEncounterId, null);
  assert.equal(completed.run.activeCombat, null);
});

void test("legacy finale phase cannot be used as a privileged combat entry", () => {
  const universe = createUniverse();
  const transition = applyFateKnotsStoryTransition(universe, createRun(), "guardian-fight");
  assert.equal(transition.ok, true);
  const encounter = buildFateKnotsEncounterCombat(
    universe,
    transition.run,
    "guardian",
    "combat-legacy",
    DEFAULT_FATE_KNOTS_RULES.combat.turn
  );
  assert.equal(encounter.ok, true);
  assert.ok(encounter.combat);

  const legacyFinaleRun: FateKnotsRunState = {
    ...transition.run,
    phase: "finale",
  };
  const entered = enterFateKnotsCombat(legacyFinaleRun, encounter.combat);
  assert.equal(entered.ok, false);
  assert.equal(entered.issues[0]?.code, "invalid-combat-entry-phase");
});

void test("real host run start initializes the authored story and solo exploration choices", () => {
  const universe = createUniverse();
  const created = createFateKnotsRunFromSetup(universe, {
    runId: "solo-start",
    party: [{ seatId: "user", characterId: "hero" }],
  });
  assert.ok(created.ok);
  assert.equal(created.run.activeKnotId, null);
  const started = startFateKnotsRun(universe, created.run);
  assert.ok(started.ok);
  assert.equal(started.run.activeKnotId, universe.story.startKnotId);
  assert.ok(started.run.revealedKnotIds.includes(universe.story.startKnotId));
  assert.equal(started.run.revision, 1);
  const state = new Map<string, unknown>();
  const api = {
    getState: (key: string) => state.get(key),
    setState: (key: string, value: unknown) => state.set(key, value),
  };
  const projected = getFateKnotsExplorationConsensus(api, universe, started.run);
  assert.ok(projected.ok);
  assert.deepEqual(projected.state.activeSeatIds, ["user"]);
  assert.ok(projected.state.availableTransitions.some((t) => t.id === "guardian-fight"));
  assert.equal(created.run.activeKnotId, null);
});
void test("host run start rejects inconsistent story and map starts", () => {
  const universe = createUniverse();
  const created = createFateKnotsRunFromSetup(universe, {
    runId: "bad-start",
    party: [{ seatId: "user", characterId: "hero" }],
  });
  assert.ok(created.ok);
  universe.map.startNodeId = "sanctum-node";
  assert.equal(startFateKnotsRun(universe, created.run).ok, false);
});
