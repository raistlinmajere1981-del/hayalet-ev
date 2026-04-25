import { attachAsset, normalizeText } from "./content-loader-shared.js";
export function normalizeMapManifest(assetRegistry, raw) {
  const source = raw && typeof raw === "object" && Array.isArray(raw) === false ? raw : {};
  return {
    version: typeof source.version === "number" && Number.isInteger(source.version) ? source.version : 1,
    mapAssetId: normalizeText(source.mapAssetId),
    mapAsset: attachAsset(assetRegistry, source.mapAssetId, "map"),
    startingLocationId: normalizeText(source.startingLocationId),
    nodes: Array.isArray(source.nodes) ? source.nodes.map(function(entry) {
      const node = entry && typeof entry === "object" && Array.isArray(entry) === false ? entry : {};
      return {
        id: normalizeText(node.id),
        label: normalizeText(node.label),
        locationAssetId: normalizeText(node.locationAssetId),
        sceneAssetId: normalizeText(node.sceneAssetId),
        marker: node.marker && typeof node.marker === "object" && Array.isArray(node.marker) === false ? (function() {
          const marker = node.marker;
          return {
            xPct: Number.isFinite(marker.xPct) ? Number(marker.xPct) : 0,
            yPct: Number.isFinite(marker.yPct) ? Number(marker.yPct) : 0
          };
        })() : { xPct: 0, yPct: 0 },
        connections: Array.isArray(node.connections) ? node.connections.map(normalizeText).filter(Boolean) : [],
        locationAsset: attachAsset(assetRegistry, node.locationAssetId, "location-card"),
        sceneAsset: attachAsset(assetRegistry, node.sceneAssetId, "scene")
      };
    }) : []
  };
}
export function normalizeScenarioManifest(assetRegistry, raw) {
  const source = raw && typeof raw === "object" && Array.isArray(raw) === false ? raw : {};
  return {
    version: typeof source.version === "number" && Number.isInteger(source.version) ? source.version : 1,
    scenarioId: normalizeText(source.scenarioId) || "intro",
    entryStepId: normalizeText(source.entryStepId),
    steps: Array.isArray(source.steps) ? source.steps.map(function(entry) {
      const step = entry && typeof entry === "object" && Array.isArray(entry) === false ? entry : {};
      const npcAssetIds = Array.isArray(step.npcAssetIds) ? step.npcAssetIds.map(normalizeText).filter(Boolean) : [];
      const itemAssetIds = Array.isArray(step.itemAssetIds) ? step.itemAssetIds.map(normalizeText).filter(Boolean) : [];
      const creatureAssetIds = Array.isArray(step.creatureAssetIds) ? step.creatureAssetIds.map(normalizeText).filter(Boolean) : [];
      return {
        id: normalizeText(step.id),
        title: normalizeText(step.title),
        locationId: normalizeText(step.locationId),
        sceneAssetId: normalizeText(step.sceneAssetId),
        speaker: normalizeText(step.speaker),
        body: normalizeText(step.body),
        choices: Array.isArray(step.choices) ? step.choices.map(function(choice) {
          const nextChoice = choice && typeof choice === "object" && Array.isArray(choice) === false ? choice : {};
          return {
            id: normalizeText(nextChoice.id),
            label: normalizeText(nextChoice.label),
            summary: normalizeText(nextChoice.summary),
            nextStepId: normalizeText(nextChoice.nextStepId),
            encounterId: normalizeText(nextChoice.encounterId)
          };
        }) : [],
        sceneAsset: attachAsset(assetRegistry, step.sceneAssetId, "scene"),
        npcs: npcAssetIds.map(function(assetId) {
          return attachAsset(assetRegistry, assetId, "npc");
        }),
        items: itemAssetIds.map(function(assetId) {
          return attachAsset(assetRegistry, assetId, "item");
        }),
        creatures: creatureAssetIds.map(function(assetId) {
          return attachAsset(assetRegistry, assetId, "creature");
        })
      };
    }) : []
  };
}
