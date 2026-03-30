import { attachAsset, normalizeText } from "./content-loader-shared.js";
import type { FateKnotsAssetRegistry } from "./asset-registry.js";

interface FateKnotsWorldManifestRecord extends Record<string, unknown> {
  version?: unknown;
  mapAssetId?: unknown;
  startingLocationId?: unknown;
  nodes?: unknown;
  scenarioId?: unknown;
  entryStepId?: unknown;
  steps?: unknown;
  id?: unknown;
  label?: unknown;
  locationAssetId?: unknown;
  sceneAssetId?: unknown;
  marker?: unknown;
  xPct?: unknown;
  yPct?: unknown;
  connections?: unknown;
  title?: unknown;
  locationId?: unknown;
  speaker?: unknown;
  body?: unknown;
  choices?: unknown;
  npcAssetIds?: unknown;
  itemAssetIds?: unknown;
  creatureAssetIds?: unknown;
  summary?: unknown;
  nextStepId?: unknown;
  encounterId?: unknown;
}

export function normalizeMapManifest(assetRegistry: FateKnotsAssetRegistry, raw: unknown) {
  const source: FateKnotsWorldManifestRecord =
    raw && typeof raw === "object" && Array.isArray(raw) === false
      ? (raw as FateKnotsWorldManifestRecord)
      : {};
  return {
    version:
      typeof source.version === "number" && Number.isInteger(source.version) ? source.version : 1,
    mapAssetId: normalizeText(source.mapAssetId),
    mapAsset: attachAsset(assetRegistry, source.mapAssetId, "map"),
    startingLocationId: normalizeText(source.startingLocationId),
    nodes: Array.isArray(source.nodes)
      ? source.nodes.map(function (entry: unknown) {
          const node: FateKnotsWorldManifestRecord =
            entry && typeof entry === "object" && Array.isArray(entry) === false
              ? (entry as FateKnotsWorldManifestRecord)
              : {};
          return {
            id: normalizeText(node.id),
            label: normalizeText(node.label),
            locationAssetId: normalizeText(node.locationAssetId),
            sceneAssetId: normalizeText(node.sceneAssetId),
            marker:
              node.marker && typeof node.marker === "object" && Array.isArray(node.marker) === false
                ? (function () {
                    const marker = node.marker as FateKnotsWorldManifestRecord;
                    return {
                      xPct: Number.isFinite(marker.xPct) ? Number(marker.xPct) : 0,
                      yPct: Number.isFinite(marker.yPct) ? Number(marker.yPct) : 0,
                    };
                  })()
                : { xPct: 0, yPct: 0 },
            connections: Array.isArray(node.connections)
              ? node.connections.map(normalizeText).filter(Boolean)
              : [],
            locationAsset: attachAsset(assetRegistry, node.locationAssetId, "location-card"),
            sceneAsset: attachAsset(assetRegistry, node.sceneAssetId, "scene"),
          };
        })
      : [],
  };
}

export function normalizeScenarioManifest(assetRegistry: FateKnotsAssetRegistry, raw: unknown) {
  const source: FateKnotsWorldManifestRecord =
    raw && typeof raw === "object" && Array.isArray(raw) === false
      ? (raw as FateKnotsWorldManifestRecord)
      : {};
  return {
    version:
      typeof source.version === "number" && Number.isInteger(source.version) ? source.version : 1,
    scenarioId: normalizeText(source.scenarioId) || "intro",
    entryStepId: normalizeText(source.entryStepId),
    steps: Array.isArray(source.steps)
      ? source.steps.map(function (entry: unknown) {
          const step: FateKnotsWorldManifestRecord =
            entry && typeof entry === "object" && Array.isArray(entry) === false
              ? (entry as FateKnotsWorldManifestRecord)
              : {};
          const npcAssetIds = Array.isArray(step.npcAssetIds)
            ? step.npcAssetIds.map(normalizeText).filter(Boolean)
            : [];
          const itemAssetIds = Array.isArray(step.itemAssetIds)
            ? step.itemAssetIds.map(normalizeText).filter(Boolean)
            : [];
          const creatureAssetIds = Array.isArray(step.creatureAssetIds)
            ? step.creatureAssetIds.map(normalizeText).filter(Boolean)
            : [];
          return {
            id: normalizeText(step.id),
            title: normalizeText(step.title),
            locationId: normalizeText(step.locationId),
            sceneAssetId: normalizeText(step.sceneAssetId),
            speaker: normalizeText(step.speaker),
            body: normalizeText(step.body),
            choices: Array.isArray(step.choices)
              ? step.choices.map(function (choice: unknown) {
                  const nextChoice: FateKnotsWorldManifestRecord =
                    choice && typeof choice === "object" && Array.isArray(choice) === false
                      ? (choice as FateKnotsWorldManifestRecord)
                      : {};
                  return {
                    id: normalizeText(nextChoice.id),
                    label: normalizeText(nextChoice.label),
                    summary: normalizeText(nextChoice.summary),
                    nextStepId: normalizeText(nextChoice.nextStepId),
                    encounterId: normalizeText(nextChoice.encounterId),
                  };
                })
              : [],
            sceneAsset: attachAsset(assetRegistry, step.sceneAssetId, "scene"),
            npcs: npcAssetIds.map(function (assetId: string) {
              return attachAsset(assetRegistry, assetId, "npc");
            }),
            items: itemAssetIds.map(function (assetId: string) {
              return attachAsset(assetRegistry, assetId, "item");
            }),
            creatures: creatureAssetIds.map(function (assetId: string) {
              return attachAsset(assetRegistry, assetId, "creature");
            }),
          };
        })
      : [],
  };
}
