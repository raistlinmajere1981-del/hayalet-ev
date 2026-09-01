import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

void test("Fate Knots card art remains an optional accepted asset binding", () => {
  const contracts = readFileSync(
    "rooms/game-room/main-functions/fate-knots/shared/contracts.ts",
    "utf8"
  );
  const canonical = readFileSync(
    "rooms/game-room/main-functions/fate-knots/forge/canonical-universe.ts",
    "utf8"
  );
  const gameplay = readFileSync(
    "rooms/game-room/main-functions/fate-knots/host/gameplay-state.ts",
    "utf8"
  );
  const assetContract = readFileSync(
    "rooms/game-room/main-functions/fate-knots/FORGE-ASSET-CONTRACT.md",
    "utf8"
  );

  assert.match(contracts, /artAssetId\?: string \| null/);

  assert.match(canonical, /validateCardArtContract/);
  assert.match(canonical, /new Set\(universe\.assets\.map\(\(asset\) => asset\.id\)\)/);
  assert.match(canonical, /const rawCard = card as unknown/);
  assert.match(canonical, /const rawArtAssetId = rawCard\["artAssetId"\]/);
  assert.match(canonical, /typeof rawArtAssetId !== "string"/);
  assert.match(canonical, /code: "invalid-field-type", path: `cards\[\$\{index\}\]\.artAssetId`/);
  assert.match(canonical, /cards\[\$\{index\}\]\.artAssetId/);
  assert.match(canonical, /code: "missing-reference"/);

  assert.match(gameplay, /artAssetId: card\.artAssetId \?\? null/);
  assert.match(gameplay, /\.\.\.cards\.map\(\(card\) => card\.artAssetId\)/);
  assert.doesNotMatch(gameplay, /opposition.*artAssetId:/);

  assert.match(assetContract, /FateKnotsCardDefinition\.artAssetId/);
  assert.match(assetContract, /sourceId.*must not be reused as an art pointer/);
});
