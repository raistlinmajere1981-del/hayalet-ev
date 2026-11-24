import { createFateKnotsLootCommands } from "../../rooms/game-room/main-functions/fate-knots/host/loot-runtime.ts";
import {
  saveFateKnotsUniverse,
  saveFateKnotsRunSnapshot,
  loadFateKnotsRunStore,
} from "../../rooms/game-room/main-functions/fate-knots/host/persistence.ts";
import assert from "node:assert/strict";
import test from "node:test";

import type {
  FateKnotsRunState,
  FateKnotsUniversePackage,
} from "../../rooms/game-room/main-functions/fate-knots/shared/contracts.ts";
import { resolveFateKnotsStoryLootDecision } from "../../rooms/game-room/main-functions/fate-knots/shared/story-loot-flow.ts";

function createUniverse(): FateKnotsUniversePackage {
  return {
    schemaVersion: 1,
    universeId: "loot-finale-v1",
    title: "Loot Finale Fixture",
    premise: "Winning the marked encounter is not itself scenario completion.",
    createdAt: "2026-09-02T00:00:00.000Z",
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
        description: "The source scene.",
        sceneAssetIds: [],
        tags: [],
      },
      {
        id: "sanctum",
        name: "Sanctum",
        description: "The objective can now be resolved here.",
        sceneAssetIds: [],
        tags: [],
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
          visibleFacts: ["A guardian blocks the way."],
          initiallyRevealed: true,
        },
        {
          id: "sanctum-knot",
          locationId: "sanctum",
          visibleFacts: ["The guardian is gone; the real objective remains."],
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
          id: "resolve-objective",
          fromKnotId: "sanctum-knot",
          label: "Resolve the objective",
          kind: "finale",
          requirements: { completedKnotIds: ["gate-knot"] },
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
      conflictSummary: "Use what was learned beyond the guardian to resolve the objective.",
      finaleLocationId: "sanctum",
      requiredKnotIds: ["gate-knot"],
      requiredItemIds: ["guardian-key"],
      finalEncounterId: "guardian",
      successConditionId: "objective-resolved",
      epilogueConditionIds: [],
    },
  };
}

function createLootRun(): FateKnotsRunState {
  return {
    schemaVersion: 1,
    runId: "run-1",
    universeId: "loot-finale-v1",
    phase: "loot",
    revision: 12,
    activeLocationId: "sanctum",
    activeKnotId: "sanctum-knot",
    activeStoryTransitionId: "guardian-fight",
    activeEncounterId: "guardian",
    revealedLocationIds: ["gate", "sanctum"],
    revealedKnotIds: ["gate-knot", "sanctum-knot"],
    completedKnotIds: ["gate-knot"],
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
        energy: 2,
        fallen: false,
        position: { row: "front", range: "near" },
        ownedCardIds: [],
        availableCardIds: [],
        equipmentIds: [],
        statusIds: [],
        injuryIds: [],
      },
    ],
    teamPoolItemIds: ["guardian-key"],
    activeCombat: null,
    finaleUnlocked: false,
    result: "active",
  };
}

void test("final encounter loot returns to exploration and can unlock the authored success route", () => {
  const universe = createUniverse();
  const run = createLootRun();
  const result = resolveFateKnotsStoryLootDecision(universe, run, {
    runRevision: run.revision,
    allocations: [
      {
        poolIndex: 0,
        cardId: "guardian-key",
        recipientActorId: "hero-actor",
      },
    ],
    approvedActorIds: ["hero-actor"],
  });

  assert.equal(result.ok, true, JSON.stringify(result.issues));
  assert.equal(result.nextPhase, "exploration");
  assert.equal(result.run.phase, "exploration");
  assert.equal(result.run.result, "active");
  assert.equal(result.run.activeStoryTransitionId, null);
  assert.equal(result.run.activeEncounterId, null);
  assert.deepEqual(result.run.teamPoolItemIds, []);
  assert.deepEqual(result.run.actors[0]?.ownedCardIds, ["guardian-key"]);
  assert.equal(result.run.finaleUnlocked, true);
});

function hostFixture(multi = false) {
  const u = createUniverse();
  u.assets = [
    { id: "background", kind: "background", path: "background.png" },
    { id: "closed-book", kind: "book-cover", path: "closed.png" },
    { id: "open-page", kind: "book-page", path: "open.png" },
    { id: "hero-portrait", kind: "portrait", path: "hero.png" },
    { id: "guardian-portrait", kind: "portrait", path: "guardian.png" },
  ];
  const run = createLootRun();
  if (multi) {
    run.actors.push({ ...structuredClone(run.actors[0]!), actorId: "ai2-actor", seatId: "ai2" });
    run.partyActorIds.push("ai2-actor");
  }
  const state = new Map<string, unknown>();
  const api = {
    getState: (k: string) => state.get(k),
    setState: (k: string, v: unknown) => state.set(k, v),
  };
  const saved = saveFateKnotsUniverse(api, u);
  assert.ok(saved.ok, JSON.stringify(saved.issues));
  const savedRun = saveFateKnotsRunSnapshot(api, run, null);
  assert.ok(savedRun.ok, JSON.stringify(savedRun.issues));
  return {
    api,
    run,
    commands: createFateKnotsLootCommands(api),
    payload: { runId: run.runId, allocations: [{ poolIndex: 0, recipientActorId: "hero-actor" }] },
  };
}
void test("solo loot proposal commits immediately and cannot grant rewards twice", () => {
  const f = hostFixture();
  const result = f.commands["GameRoomFateKnotsProposeLoot"]!(f.payload);
  assert.ok(result.ok, JSON.stringify(result.issues));
  assert.equal(result.state.resolved, true);
  const saved = loadFateKnotsRunStore(f.api).store.entries[0]!.run;
  assert.equal(saved.phase, "exploration");
  assert.deepEqual(saved.actors[0]!.ownedCardIds, ["guardian-key"]);
  assert.equal(f.commands["GameRoomFateKnotsProposeLoot"]!(f.payload).ok, false);
});
void test("two player proposals still require both active seats and exact allocations", () => {
  const f = hostFixture(true);
  const first = f.commands["GameRoomFateKnotsProposeLoot"]!(f.payload);
  assert.ok(first.ok, JSON.stringify(first.issues));
  assert.equal(first.state.resolved, false);
  assert.equal(loadFateKnotsRunStore(f.api).store.entries[0]!.run.phase, "loot");
  const next = f.commands["GameRoomFateKnotsAi2ProposeLoot"]!(f.payload);
  assert.ok(next.ok, JSON.stringify(next.issues));
  assert.equal(next.state.resolved, true);
});
