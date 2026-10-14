import assert from "node:assert/strict";
import test from "node:test";

import { validateFateKnotsPlayableUniverse } from "../../rooms/game-room/main-functions/fate-knots/forge/playability-validation.ts";
import {
  leaveFateKnotsCamp,
  setFateKnotsCampEquipment,
  settleFateKnotsCampRecovery,
} from "../../rooms/game-room/main-functions/fate-knots/shared/camp.ts";
import type {
  FateKnotsRunState,
  FateKnotsUniversePackage,
} from "../../rooms/game-room/main-functions/fate-knots/shared/contracts.ts";
import { getFateKnotsNpcInteractionOptions } from "../../rooms/game-room/main-functions/fate-knots/shared/npc-interaction.ts";

function createUniverse(): FateKnotsUniversePackage {
  return {
    schemaVersion: 1,
    universeId: "camp-social-v1",
    title: "Camp Social Fixture",
    premise: "A bounded Fate Knots regression fixture.",
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
        id: "village",
        name: "Village",
        description: "A safe village square.",
        sceneAssetIds: [],
        tags: [],
        campAllowed: true,
      },
      {
        id: "mountain",
        name: "Mountain",
        description: "The objective waits beyond the pass.",
        sceneAssetIds: [],
        tags: [],
      },
    ],
    map: {
      startNodeId: "village-node",
      nodes: [
        {
          id: "village-node",
          locationId: "village",
          label: "Village",
          initiallyRevealed: true,
        },
        {
          id: "mountain-node",
          locationId: "mountain",
          label: "Mountain",
          initiallyRevealed: false,
        },
      ],
      edges: [],
    },
    story: {
      startKnotId: "village-knot",
      knots: [
        {
          id: "village-knot",
          locationId: "village",
          visibleFacts: ["A warden watches the mountain road."],
          initiallyRevealed: true,
        },
        {
          id: "pass-knot",
          locationId: "mountain",
          visibleFacts: ["The sealed pass is open."],
          initiallyRevealed: false,
        },
      ],
      transitions: [
        {
          id: "camp-here",
          fromKnotId: "village-knot",
          label: "Make camp",
          kind: "camp",
        },
        {
          id: "ask-warden",
          fromKnotId: "village-knot",
          label: "Ask the warden about the pass",
          kind: "scene",
          toKnotId: "pass-knot",
          onEnter: { revealKnotIds: ["pass-knot"], revealLocationIds: ["mountain"] },
        },
        {
          id: "resolve-objective",
          fromKnotId: "pass-knot",
          label: "Seal the threat",
          kind: "finale",
        },
      ],
      encounters: [],
    },
    npcs: [
      {
        id: "warden",
        name: "Warden",
        locationId: "village",
        roleTags: ["interaction:ask-warden"],
        publicSummary: "Keeper of the mountain road.",
        rolePacketId: "warden-role",
      },
    ],
    npcRoles: [
      {
        id: "warden-role",
        npcId: "warden",
        personaFacts: ["Guarded but practical."],
        knownFacts: ["The pass can be opened."],
        relationshipFacts: [],
      },
    ],
    characters: [
      {
        id: "traveler",
        name: "Traveler",
        portraitAssetId: "traveler-portrait",
        tags: ["player-template"],
        playerSelectable: true,
        startingPosition: { row: "front", range: "near" },
        baseStats: { maxHp: 10, attack: 2, defense: 2, speed: 2, energy: 3 },
        startingCardIds: ["sword-card"],
        startingEquipmentIds: [],
      },
    ],
    cards: [
      {
        id: "sword-card",
        kind: "equipment",
        name: "Sword",
        tags: ["weapon"],
        effects: [],
        presentation: [],
        sourceId: "sword",
      },
      {
        id: "slash",
        kind: "attack",
        name: "Slash",
        tags: ["weapon-technique"],
        effects: [{ id: "slash-damage", kind: "damage", target: "primaryTarget", value: 2 }],
        presentation: [],
      },
    ],
    equipment: [
      {
        id: "sword",
        name: "Sword",
        slot: "main-hand",
        tags: ["weapon"],
        grantedCardIds: ["slash"],
      },
    ],
    statuses: [],
    hiddenKnotIds: ["pass-knot"],
    finale: {
      id: "main-objective",
      conflictSummary: "Resolve the threat beyond the mountain pass.",
      finaleLocationId: "mountain",
      requiredKnotIds: ["pass-knot"],
      successConditionId: "threat-resolved",
      epilogueConditionIds: [],
    },
  };
}

function createRun(phase: FateKnotsRunState["phase"]): FateKnotsRunState {
  return {
    schemaVersion: 1,
    runId: "run-1",
    universeId: "camp-social-v1",
    phase,
    revision: 4,
    activeLocationId: "village",
    activeKnotId: "village-knot",
    activeStoryTransitionId: null,
    activeEncounterId: null,
    revealedLocationIds: ["village"],
    revealedKnotIds: ["village-knot"],
    completedKnotIds: [],
    partyActorIds: ["traveler-actor"],
    actors: [
      {
        actorId: "traveler-actor",
        characterId: "traveler",
        seatId: "user",
        teamId: "party",
        hp: 2,
        maxHp: 10,
        attack: 2,
        defense: 2,
        speed: 2,
        energy: 0,
        fallen: true,
        position: { row: "front", range: "near" },
        ownedCardIds: ["sword-card"],
        availableCardIds: ["sword-card"],
        equipmentIds: [],
        statusIds: ["persistent-mark"],
        injuryIds: ["old-injury"],
      },
    ],
    teamPoolItemIds: [],
    activeCombat: null,
    finaleUnlocked: false,
    result: "active",
  };
}

void test("camp recovery restores combat resources but preserves persistent state", () => {
  const universe = createUniverse();
  const result = settleFateKnotsCampRecovery(universe, createRun("camp"));
  assert.equal(result.ok, true);
  assert.equal(result.changed, true);
  assert.equal(result.run.revision, 5);
  const actor = result.run.actors[0];
  assert.ok(actor);
  assert.equal(actor.hp, 10);
  assert.equal(actor.energy, 3);
  assert.equal(actor.fallen, false);
  assert.deepEqual(actor.statusIds, ["persistent-mark"]);
  assert.deepEqual(actor.injuryIds, ["old-injury"]);

  const idempotent = settleFateKnotsCampRecovery(universe, result.run);
  assert.equal(idempotent.ok, true);
  assert.equal(idempotent.changed, false);
  assert.equal(idempotent.run.revision, 5);
});

void test("camp equipment requires physical ownership and rebuilds available techniques", () => {
  const universe = createUniverse();
  const recovered = settleFateKnotsCampRecovery(universe, createRun("camp"));
  assert.equal(recovered.ok, true);

  const equipped = setFateKnotsCampEquipment(
    universe,
    recovered.run,
    "traveler-actor",
    "main-hand",
    "sword"
  );
  assert.equal(equipped.ok, true);
  assert.equal(equipped.changed, true);
  assert.deepEqual(equipped.run.actors[0]?.equipmentIds, ["sword"]);
  assert.ok(equipped.run.actors[0]?.availableCardIds.includes("slash"));

  const left = leaveFateKnotsCamp(universe, equipped.run);
  assert.equal(left.ok, true);
  assert.equal(left.run.phase, "exploration");
});

void test("NPC mechanics expose only authored currently legal story transitions", () => {
  const universe = createUniverse();
  const options = getFateKnotsNpcInteractionOptions(universe, createRun("exploration"), "warden");
  assert.equal(options.ok, true);
  if (!options.ok) return;
  assert.deepEqual(options.options, [
    { id: "ask-warden", label: "Ask the warden about the pass", kind: "scene" },
  ]);
});

void test("playability gate accepts stay-put camps and rejects camp-as-travel", () => {
  const universe = createUniverse();
  const valid = validateFateKnotsPlayableUniverse(universe);
  assert.equal(valid.valid, true, JSON.stringify(valid.issues));

  const broken = structuredClone(universe);
  const camp = broken.story.transitions.find((transition) => transition.id === "camp-here");
  assert.ok(camp);
  camp.toLocationId = "mountain";
  const invalid = validateFateKnotsPlayableUniverse(broken);
  assert.equal(invalid.valid, false);
  assert.ok(
    invalid.issues.some((issue) => issue.code === "camp-transition-destination-not-supported")
  );
});
