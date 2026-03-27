import test from "node:test";
import assert from "node:assert/strict";

import {
  getFateKnotsAsset,
  listFateKnotsAssetsByKind,
  loadFateKnotsAssetRegistry,
} from "../../rooms/game-room/main-functions/fate-knots/host/asset-registry.js";
import { loadFateKnotsContentRegistry } from "../../rooms/game-room/main-functions/fate-knots/host/content-loader.js";

test("Fate Knots asset registry exposes normalized portable assets across every V1 category", () => {
  const registry = loadFateKnotsAssetRegistry();

  assert.equal(registry.errors.length, 0);
  assert.deepEqual(registry.duplicateIds, []);
  assert.equal(registry.manifestPath, "main-functions/fate-knots/data/runtime-assets.manifest.json");
  assert.equal(registry.assets.length >= 90, true);

  const featureView = getFateKnotsAsset(registry, "fate-knots-view", "feature-view");
  assert.equal(featureView.placeholder, false);
  assert.equal(featureView.kind, "feature-view");
  assert.match(String(featureView.src ?? ""), /^main-functions\/fate-knots\//);

  [
    "avatar",
    "background",
    "class",
    "creature",
    "feature-view",
    "item",
    "location-card",
    "map",
    "npc",
    "scene",
    "ui-button",
    "ui-card-effect",
    "ui-card-template",
    "ui-combat-fx",
    "ui-combat-icon",
    "ui-dialogue",
    "ui-frame",
    "ui-map",
    "ui-overlay",
    "ui-status",
  ].forEach((kind) => {
    assert.equal(listFateKnotsAssetsByKind(registry, kind).length > 0, true, kind);
  });
});

test("Fate Knots asset registry keeps fallback and mismatch behavior deterministic", () => {
  const registry = loadFateKnotsAssetRegistry();

  const missingAsset = getFateKnotsAsset(registry, "missing-asset", "scene");
  assert.equal(missingAsset.placeholder, true);
  assert.equal(missingAsset.id, "missing-asset");
  assert.equal(missingAsset.kind, "scene");
  assert.equal(missingAsset.src, null);

  const mismatchedAsset = getFateKnotsAsset(registry, "fate-knots-view", "scene");
  assert.equal(mismatchedAsset.placeholder, false);
  assert.equal(mismatchedAsset.kind, "feature-view");
  assert.equal(mismatchedAsset.kindMismatch, true);
  assert.equal(mismatchedAsset.expectedKind, "scene");
});

test("Fate Knots content registry wires selections, scenario, combat, and coverage from generated manifests", () => {
  const content = loadFateKnotsContentRegistry();

  assert.equal(content.errors.length, 0);
  assert.equal(content.selections.avatars.length, 4);
  assert.equal(content.selections.classes.length, 4);
  assert.equal(content.selections.backgrounds.length, 4);
  assert.equal(content.map.startingLocationId, "village-gate");
  assert.equal(content.map.mapAsset.asset.id, "map_scenario_01");
  assert.equal(content.scenario.entryStepId, "gate-arrival");
  assert.equal(content.scenario.steps.length, 3);
  assert.equal(content.encountersById.has("well-entity"), true);
  assert.equal(content.enemyActionsById.has("shriek"), true);
  assert.equal(content.cardsById.has("stun"), true);
  assert.equal(content.assetCoverage.avatars, 4);
  assert.equal(content.assetCoverage.classes, 4);
  assert.equal(content.assetCoverage.backgrounds, 4);
  assert.equal(content.assetCoverage.npcs >= 3, true);
  assert.equal(content.assetCoverage.items >= 4, true);
  assert.equal(content.assetCoverage.creatures >= 1, true);
  assert.equal(content.assetCoverage.locations >= 3, true);
  assert.equal(content.assetCoverage.maps >= 1, true);
  assert.equal(content.assetCoverage.scenes >= 3, true);

  const entryStep = content.scenarioStepsById.get("gate-arrival");
  assert.ok(entryStep);
  assert.equal(entryStep?.sceneAsset.asset.id, "scene_village_gate");
  assert.equal(entryStep?.npcs[0]?.asset.id, "traveling_stranger");
  assert.equal(entryStep?.items[0]?.asset.id, "broken_lantern");
});
