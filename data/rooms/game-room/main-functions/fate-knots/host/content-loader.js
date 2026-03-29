import {
  fateKnotsCombatCardsManifest,
  fateKnotsCombatConfigManifest,
  fateKnotsIntroScenarioManifest,
  fateKnotsMapManifest,
  fateKnotsSelectionsManifest
} from "../data/runtime-content.module.js";
import { listFateKnotsAssetsByKind, loadFateKnotsAssetRegistry } from "./asset-registry.js";
import { normalizeCombatCardsManifest, normalizeCombatConfigManifest } from "./content-loader-combat.js";
import { dataDir, featureDir, readGeneratedManifest } from "./content-loader-shared.js";
import { normalizeSelectionsManifest } from "./content-loader-selections.js";
import { normalizeMapManifest, normalizeScenarioManifest } from "./content-loader-world.js";
export function loadFateKnotsContentRegistry() {
  const assetRegistry = loadFateKnotsAssetRegistry();
  const selectionsSource = readGeneratedManifest(
    "selections.manifest.json",
    fateKnotsSelectionsManifest,
    {}
  );
  const mapSource = readGeneratedManifest("map.manifest.json", fateKnotsMapManifest, {});
  const scenarioSource = readGeneratedManifest(
    "scenarios/intro.manifest.json",
    fateKnotsIntroScenarioManifest,
    {}
  );
  const cardsSource = readGeneratedManifest(
    "combat/cards.manifest.json",
    fateKnotsCombatCardsManifest,
    {}
  );
  const configSource = readGeneratedManifest(
    "combat/config.manifest.json",
    fateKnotsCombatConfigManifest,
    {}
  );
  const selections = normalizeSelectionsManifest(assetRegistry, selectionsSource.value);
  const map = normalizeMapManifest(assetRegistry, mapSource.value);
  const scenario = normalizeScenarioManifest(assetRegistry, scenarioSource.value);
  const combatCards = normalizeCombatCardsManifest(assetRegistry, cardsSource.value);
  const combatConfig = normalizeCombatConfigManifest(assetRegistry, configSource.value);
  const errors = [
    ...assetRegistry.errors,
    selectionsSource.error,
    mapSource.error,
    scenarioSource.error,
    cardsSource.error,
    configSource.error
  ].filter(Boolean);
  return {
    featureDir,
    dataDir,
    assetRegistry,
    selections,
    map,
    scenario,
    combatCards,
    combatConfig,
    cardsById: combatCards.cardMap,
    classesById: new Map(selections.classes.map(function(entry) {
      return [entry.id, entry];
    })),
    avatarsById: new Map(selections.avatars.map(function(entry) {
      return [entry.id, entry];
    })),
    backgroundsById: new Map(selections.backgrounds.map(function(entry) {
      return [entry.id, entry];
    })),
    scenarioStepsById: new Map(scenario.steps.map(function(entry) {
      return [entry.id, entry];
    })),
    mapNodesById: new Map(map.nodes.map(function(entry) {
      return [entry.id, entry];
    })),
    encountersById: new Map(combatConfig.encounters.map(function(entry) {
      return [entry.id, entry];
    })),
    enemyActionsById: new Map(combatConfig.enemyActions.map(function(entry) {
      return [entry.id, entry];
    })),
    assetCoverage: {
      avatars: selections.avatars.length,
      classes: selections.classes.length,
      backgrounds: selections.backgrounds.length,
      npcs: listFateKnotsAssetsByKind(assetRegistry, "npc").length,
      items: listFateKnotsAssetsByKind(assetRegistry, "item").length,
      creatures: listFateKnotsAssetsByKind(assetRegistry, "creature").length,
      locations: listFateKnotsAssetsByKind(assetRegistry, "location-card").length,
      maps: listFateKnotsAssetsByKind(assetRegistry, "map").length,
      scenes: listFateKnotsAssetsByKind(assetRegistry, "scene").length
    },
    errors
  };
}
