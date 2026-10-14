import test from "node:test";
import assert from "node:assert/strict";

import { buildFateKnotsGameplayState } from "../../rooms/game-room/main-functions/fate-knots/host/gameplay-state.ts";
import type {
  FateKnotsRunState,
  FateKnotsUniversePackage,
} from "../../rooms/game-room/main-functions/fate-knots/shared/contracts.ts";

const universe: FateKnotsUniversePackage = {
  schemaVersion: 1,
  universeId: "universe-1",
  title: "Visible Test World",
  premise: "A premise that stays canonical.",
  createdAt: "2026-09-01T00:00:00.000Z",
  theme: {
    id: "theme-1",
    name: "Theme",
    backgroundAssetId: "asset-bg",
    closedBookAssetId: "asset-cover",
    openPageAssetId: "asset-page",
    cardFrameByKind: {},
    visualTags: [],
  },
  music: {
    id: "music-1",
    instrumentTags: [],
    moodTags: [],
    stateCueIds: {},
  },
  assets: [
    { id: "asset-bg", kind: "background", path: "bg.webp" },
    { id: "asset-cover", kind: "book-cover", path: "cover.webp" },
    { id: "asset-page", kind: "book-page", path: "page.webp" },
    { id: "scene-visible", kind: "scene", path: "visible.webp" },
    { id: "portrait-player", kind: "portrait", path: "player.webp" },
    { id: "portrait-enemy", kind: "portrait", path: "enemy.webp" },
    { id: "card-art-player", kind: "other", path: "player-card.webp" },
    { id: "card-art-enemy", kind: "other", path: "enemy-card.webp" },
  ],
  locations: [
    {
      id: "location-visible",
      name: "Visible Square",
      description: "The square the party can currently see.",
      sceneAssetIds: ["scene-visible"],
      tags: ["public"],
      campAllowed: true,
    },
    {
      id: "location-hidden",
      name: "Hidden Vault",
      description: "location-hidden-secret-description",
      sceneAssetIds: [],
      tags: ["hidden"],
    },
  ],
  map: {
    startNodeId: "node-visible",
    nodes: [
      {
        id: "node-visible",
        locationId: "location-visible",
        label: "Square",
        initiallyRevealed: true,
        mapPosition: { x: 0.2, y: 0.4 },
      },
      {
        id: "node-hidden",
        locationId: "location-hidden",
        label: "node-hidden-secret-label",
        initiallyRevealed: false,
      },
    ],
    edges: [
      {
        id: "edge-hidden",
        fromNodeId: "node-visible",
        toNodeId: "node-hidden",
        initiallyRevealed: false,
        travelCardIds: ["enemy-secret-card"],
        tags: ["edge-hidden-secret-tag"],
      },
    ],
  },
  story: {
    startKnotId: "knot-visible",
    knots: [
      {
        id: "knot-visible",
        locationId: "location-visible",
        visibleFacts: ["The square is open."],
        initiallyRevealed: true,
      },
      {
        id: "hidden-knot-secret-id",
        locationId: "location-hidden",
        visibleFacts: ["A sealed route exists."],
        initiallyRevealed: false,
      },
    ],
    transitions: [
      {
        id: "transition-combat",
        fromKnotId: "knot-visible",
        label: "Defend the square",
        kind: "combat",
        encounterId: "encounter-secret",
      },
    ],
    encounters: [
      {
        id: "encounter-secret",
        locationId: "location-visible",
        opponentCharacterIds: ["character-enemy"],
      },
    ],
  },
  npcs: [
    {
      id: "npc-secret",
      name: "Hidden NPC",
      locationId: "location-hidden",
      roleTags: ["secret"],
      publicSummary: "npc-secret-public-summary",
      rolePacketId: "npc-role-secret",
    },
  ],
  npcRoles: [
    {
      id: "npc-role-secret",
      npcId: "npc-secret",
      personaFacts: ["npc-secret-persona"],
      knownFacts: ["npc-secret-known-fact"],
      relationshipFacts: [],
    },
  ],
  characters: [
    {
      id: "character-player",
      name: "Player Hero",
      portraitAssetId: "portrait-player",
      tags: ["hero"],
      playerSelectable: true,
      startingPosition: { row: "front", range: "near" },
      baseStats: { maxHp: 10, attack: 2, defense: 2, speed: 3, energy: 4 },
      startingCardIds: ["player-card"],
      startingEquipmentIds: ["equipment-1"],
    },
    {
      id: "character-enemy",
      name: "Enemy",
      portraitAssetId: "portrait-enemy",
      tags: ["enemy"],
      playerSelectable: false,
      startingPosition: { row: "front", range: "engaged" },
      baseStats: { maxHp: 8, attack: 3, defense: 1, speed: 2, energy: 0 },
      startingCardIds: ["enemy-secret-card"],
      startingEquipmentIds: [],
      combatController: { kind: "policy", policyId: "test-policy" },
    },
  ],
  cards: [
    {
      id: "player-card",
      kind: "attack",
      name: "Visible Strike",
      description: "Deal a visible attack.",
      artAssetId: "card-art-player",
      tags: ["visible"],
      effects: [
        {
          id: "player-effect",
          kind: "reveal",
          target: "run",
          revealId: "hidden-knot-secret-id",
        },
      ],
      presentation: [],
      resolutionPriority: "fast",
    },
    {
      id: "enemy-secret-card",
      kind: "attack",
      name: "enemy-secret-card-name",
      description: "enemy-secret-card-description",
      artAssetId: "card-art-enemy",
      tags: ["secret"],
      effects: [],
      presentation: [],
    },
    {
      id: "equipment-card",
      kind: "equipment",
      name: "Visible Coat",
      description: "A coat.",
      tags: [],
      effects: [],
      presentation: [],
      sourceId: "equipment-1",
    },
  ],
  equipment: [
    {
      id: "equipment-1",
      name: "Visible Coat",
      slot: "body",
      tags: ["visible"],
      grantedCardIds: [],
    },
  ],
  statuses: [
    {
      id: "status-visible",
      name: "Marked",
      description: "A visible combat mark.",
      tags: ["visible"],
      persistent: false,
    },
  ],
  hiddenKnotIds: ["hidden-knot-secret-id"],
  finale: {
    id: "finale-secret-id",
    conflictSummary: "finale-secret-summary",
    finaleLocationId: "location-hidden",
    requiredKnotIds: ["hidden-knot-secret-id"],
    successConditionId: "finale-secret-condition",
    epilogueConditionIds: ["finale-secret-epilogue"],
  },
};

const run: FateKnotsRunState = {
  schemaVersion: 1,
  runId: "run-1",
  universeId: "universe-1",
  phase: "combat-discussion",
  revision: 7,
  activeLocationId: "location-visible",
  activeKnotId: "knot-visible",
  activeStoryTransitionId: "transition-combat",
  activeEncounterId: "encounter-secret",
  revealedLocationIds: ["location-visible"],
  revealedKnotIds: ["hidden-knot-secret-id"],
  completedKnotIds: [],
  partyActorIds: ["actor-player"],
  actors: [
    {
      actorId: "actor-player",
      characterId: "character-player",
      seatId: "user",
      teamId: "party",
      hp: 9,
      maxHp: 10,
      attack: 2,
      defense: 2,
      speed: 3,
      energy: 4,
      fallen: false,
      position: { row: "front", range: "near" },
      ownedCardIds: ["player-card", "equipment-card"],
      availableCardIds: ["player-card"],
      equipmentIds: ["equipment-1"],
      statusIds: ["status-visible"],
      injuryIds: [],
    },
  ],
  teamPoolItemIds: [],
  activeCombat: {
    combatId: "combat-1",
    turnIndex: 2,
    phase: "combat-discussion",
    config: { maxMovementCards: 1, maxActionCards: 1 },
    actors: [
      {
        actorId: "actor-player",
        characterId: "character-player",
        seatId: "user",
        teamId: "party",
        hp: 9,
        maxHp: 10,
        attack: 2,
        defense: 2,
        speed: 3,
        energy: 4,
        fallen: false,
        position: { row: "front", range: "near" },
        ownedCardIds: ["player-card", "equipment-card"],
        availableCardIds: ["player-card"],
        equipmentIds: ["equipment-1"],
        statusIds: ["status-visible"],
        injuryIds: [],
      },
      {
        actorId: "actor-enemy",
        characterId: "character-enemy",
        teamId: "opposition",
        hp: 8,
        maxHp: 8,
        attack: 3,
        defense: 1,
        speed: 2,
        energy: 0,
        fallen: false,
        position: { row: "front", range: "engaged" },
        ownedCardIds: ["enemy-secret-card"],
        availableCardIds: ["enemy-secret-card"],
        equipmentIds: [],
        statusIds: [],
        injuryIds: [],
      },
    ],
    commits: [
      {
        actorId: "actor-enemy",
        actionCardId: "enemy-secret-card",
        primaryTargetId: "actor-player",
        committed: true,
      },
    ],
    result: "active",
  },
  finaleUnlocked: false,
  result: "active",
};

void test("gameplay projection keeps visible run state while excluding hidden canon and enemy tactics", () => {
  const result = buildFateKnotsGameplayState(universe, run);
  assert.equal(result.ok, true);
  if (!result.ok) return;

  assert.equal(result.state.activeLocation?.name, "Visible Square");
  assert.equal(result.state.theme.themeId, "theme-1");
  assert.equal(result.state.theme.backgroundAssetId, "asset-bg");
  assert.deepEqual(
    result.state.map.nodes.map((node) => node.nodeId),
    ["node-visible"]
  );
  assert.deepEqual(result.state.map.edges, []);
  assert.deepEqual(result.state.cards.map((card) => card.cardId).sort(), [
    "equipment-card",
    "player-card",
  ]);
  assert.equal(
    result.state.cards.find((card) => card.cardId === "player-card")?.artAssetId,
    "card-art-player"
  );
  assert.deepEqual(
    result.state.equipment.map((entry) => entry.equipmentId),
    ["equipment-1"]
  );
  assert.deepEqual(
    result.state.statuses.map((entry) => entry.statusId),
    ["status-visible"]
  );
  assert.deepEqual(result.state.assets.map((asset) => asset.assetId).sort(), [
    "asset-bg",
    "asset-cover",
    "asset-page",
    "card-art-player",
    "portrait-player",
    "scene-visible",
  ]);

  assert.equal(result.state.combat?.actors.length, 2);
  const enemy = result.state.combat?.actors.find((actor) => actor.actorId === "actor-enemy");
  assert.ok(enemy);
  assert.equal("ownedCardIds" in enemy, false);
  assert.equal("availableCardIds" in enemy, false);

  const serialized = JSON.stringify(result.state);
  for (const forbidden of [
    "hidden-knot-secret-id",
    "finale-secret-id",
    "finale-secret-summary",
    "npc-secret",
    "npc-secret-persona",
    "location-hidden-secret-description",
    "node-hidden-secret-label",
    "edge-hidden-secret-tag",
    "enemy-secret-card",
    "portrait-enemy",
    "enemy.webp",
    "card-art-enemy",
    "enemy-card.webp",
  ]) {
    assert.equal(serialized.includes(forbidden), false, forbidden);
  }
});

void test("gameplay projection refuses an active location that is not revealed", () => {
  const result = buildFateKnotsGameplayState(universe, {
    ...run,
    activeCombat: null,
    phase: "exploration",
    activeLocationId: "location-hidden",
  });

  assert.equal(result.ok, false);
  if (!result.ok) {
    assert.deepEqual(result.issues, [
      { code: "active-location-not-revealed", value: "location-hidden" },
    ]);
  }
});
