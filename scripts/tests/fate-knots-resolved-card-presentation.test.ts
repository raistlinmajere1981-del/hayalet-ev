import test from "node:test";
import assert from "node:assert/strict";

import { buildFateKnotsResolvedCardPresentationSnapshot } from "../../rooms/game-room/main-functions/fate-knots/host/resolved-card-presentation.ts";
import type {
  FateKnotsPresentationEvent,
  FateKnotsUniversePackage,
} from "../../rooms/game-room/main-functions/fate-knots/shared/contracts.ts";

const universe = {
  cards: [
    {
      id: "enemy-card",
      kind: "attack",
      name: "Sudden Lunge",
      description: "The now-visible strike.",
      artAssetId: "enemy-card-art",
      tags: ["enemy-secret-before-resolution"],
      requirements: [{ targetTeam: "party" }],
      effects: [{ id: "secret-mechanics", kind: "damage", target: "primaryTarget", value: 7 }],
      presentation: [
        {
          cueId: "lunge-resolve",
          animationId: "lunge-animation",
          soundEffectId: "blade-sfx",
          applyTo: "casterAndTarget",
          timing: "onResolve",
        },
        {
          cueId: "unused-secret-cue",
          animationId: "unused-animation",
          applyTo: "card",
          timing: "onSelect",
        },
      ],
    },
  ],
  assets: [
    {
      id: "enemy-card-art",
      kind: "other",
      path: "cards/enemy-card.webp",
      mimeType: "image/webp",
      tags: ["illustration"],
    },
  ],
} as unknown as FateKnotsUniversePackage;

const resolvedEvent: FateKnotsPresentationEvent = {
  eventId: "combat-1:3",
  type: "card-resolved",
  actorId: "enemy-actor",
  targetIds: ["player-actor"],
  cardId: "enemy-card",
  cueIds: ["lunge-resolve"],
};

void test("resolved card snapshot reveals only public presentation identity after resolution", () => {
  const result = buildFateKnotsResolvedCardPresentationSnapshot(universe, resolvedEvent);
  assert.equal(result.ok, true);
  if (!result.ok) return;

  assert.equal(result.snapshot.cardId, "enemy-card");
  assert.equal(result.snapshot.name, "Sudden Lunge");
  assert.equal(result.snapshot.art?.path, "cards/enemy-card.webp");
  assert.deepEqual(result.snapshot.cues.map((cue) => cue.cueId), ["lunge-resolve"]);

  const serialized = JSON.stringify(result.snapshot);
  assert.equal(serialized.includes("secret-mechanics"), false);
  assert.equal(serialized.includes("enemy-secret-before-resolution"), false);
  assert.equal(serialized.includes("unused-secret-cue"), false);
  assert.equal(serialized.includes("targetTeam"), false);
  assert.equal(serialized.includes("value"), false);
});

void test("resolved card snapshot refuses non-resolution events", () => {
  const result = buildFateKnotsResolvedCardPresentationSnapshot(universe, {
    ...resolvedEvent,
    type: "card-selected",
  });
  assert.equal(result.ok, false);
  if (!result.ok) assert.deepEqual(result.issues, [{ code: "not-card-resolved-event" }]);
});

void test("resolved card snapshot rejects cue ids that are not declared by the resolved card", () => {
  const result = buildFateKnotsResolvedCardPresentationSnapshot(universe, {
    ...resolvedEvent,
    cueIds: ["unknown-cue"],
  });
  assert.equal(result.ok, false);
  if (!result.ok) assert.deepEqual(result.issues, [{ code: "cue-not-found", value: "unknown-cue" }]);
});
