import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

void test("gameplay projection exposes visible presentation cues without card mechanics", () => {
  const gameplay = readFileSync(
    "rooms/game-room/main-functions/fate-knots/host/gameplay-state.ts",
    "utf8"
  );

  assert.match(gameplay, /FateKnotsGameplayPresentationCueSummary/);
  assert.match(gameplay, /presentation: card\.presentation\.map\(summarizeCue\)/);
  assert.match(gameplay, /presentation: status\.presentation\?\.map\(summarizeCue\) \?\? \[\]/);
  assert.match(gameplay, /animationId: cue\.animationId \?\? null/);
  assert.match(gameplay, /soundEffectId: cue\.soundEffectId \?\? null/);
  assert.match(gameplay, /statusVisualId: cue\.statusVisualId \?\? null/);

  const cardSummary = gameplay.slice(
    gameplay.indexOf("export interface FateKnotsGameplayCardSummary"),
    gameplay.indexOf("export interface FateKnotsGameplayEquipmentSummary")
  );
  assert.doesNotMatch(cardSummary, /effects:/);
  assert.doesNotMatch(cardSummary, /requirements:/);
});
