import {
  fateKnotsCombatCardsManifest,
  fateKnotsCombatConfigManifest,
  fateKnotsIntroScenarioManifest,
  fateKnotsMapManifest,
  fateKnotsSelectionsManifest,
} from "../data/runtime-content.module.js";
import {
  getFateKnotsAsset,
  listFateKnotsAssetsByKind,
  loadFateKnotsAssetRegistry,
} from "./asset-registry.js";

const featureDir = "main-functions/fate-knots";
const dataDir = `${featureDir}/data`;

function normalizeText(value) {
  return typeof value === "string" ? value.trim() : "";
}

function readGeneratedManifest(relativePath, value, fallback) {
  const manifestPath = `${dataDir}/${relativePath}`;
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {
      path: manifestPath,
      value: fallback,
      error: `missing-generated-manifest:${relativePath}`,
    };
  }
  return {
    path: manifestPath,
    value,
    error: null,
  };
}

function attachAsset(assetRegistry, assetId, expectedKind) {
  const asset = getFateKnotsAsset(assetRegistry, assetId, expectedKind);
  return {
    assetId: normalizeText(assetId),
    asset,
    uiSrc: asset.uiSrc,
    src: asset.src,
  };
}

function normalizeSelectionEntry(candidate, defaults) {
  const source =
    candidate && typeof candidate === "object" && Array.isArray(candidate) === false
      ? candidate
      : {};
  return {
    id: normalizeText(source.id) || defaults.id,
    label: normalizeText(source.label) || defaults.label,
    assetId: normalizeText(source.assetId) || defaults.assetId,
    summary: normalizeText(source.summary) || defaults.summary,
    perk: normalizeText(source.perk) || defaults.perk,
    stats:
      source.stats && typeof source.stats === "object" && Array.isArray(source.stats) === false
        ? source.stats
        : defaults.stats,
    startingDeck: Array.isArray(source.startingDeck)
      ? source.startingDeck.map(normalizeText).filter(Boolean)
      : defaults.startingDeck,
  };
}

function normalizeSelectionsManifest(assetRegistry, raw) {
  const source = raw && typeof raw === "object" && Array.isArray(raw) === false ? raw : {};
  return {
    version:
      typeof source.version === "number" && Number.isInteger(source.version) ? source.version : 1,
    avatars: Array.isArray(source.avatars)
      ? source.avatars.map(function (entry) {
          const normalized = normalizeSelectionEntry(entry, {
            id: "avatar",
            label: "Unknown Avatar",
            assetId: "",
            summary: "",
            perk: "",
            stats: null,
            startingDeck: [],
          });
          return {
            ...normalized,
            ...attachAsset(assetRegistry, normalized.assetId, "avatar"),
          };
        })
      : [],
    classes: Array.isArray(source.classes)
      ? source.classes.map(function (entry) {
          const normalized = normalizeSelectionEntry(entry, {
            id: "class",
            label: "Unknown Class",
            assetId: "",
            summary: "",
            perk: "",
            stats: {},
            startingDeck: [],
          });
          return {
            ...normalized,
            ...attachAsset(assetRegistry, normalized.assetId, "class"),
          };
        })
      : [],
    backgrounds: Array.isArray(source.backgrounds)
      ? source.backgrounds.map(function (entry) {
          const normalized = normalizeSelectionEntry(entry, {
            id: "background",
            label: "Unknown Background",
            assetId: "",
            summary: "",
            perk: "",
            stats: null,
            startingDeck: [],
          });
          return {
            ...normalized,
            ...attachAsset(assetRegistry, normalized.assetId, "background"),
          };
        })
      : [],
  };
}

function normalizeMapManifest(assetRegistry, raw) {
  const source = raw && typeof raw === "object" && Array.isArray(raw) === false ? raw : {};
  return {
    version:
      typeof source.version === "number" && Number.isInteger(source.version) ? source.version : 1,
    mapAssetId: normalizeText(source.mapAssetId),
    mapAsset: attachAsset(assetRegistry, source.mapAssetId, "map"),
    startingLocationId: normalizeText(source.startingLocationId),
    nodes: Array.isArray(source.nodes)
      ? source.nodes.map(function (entry) {
          const node =
            entry && typeof entry === "object" && Array.isArray(entry) === false ? entry : {};
          return {
            id: normalizeText(node.id),
            label: normalizeText(node.label),
            locationAssetId: normalizeText(node.locationAssetId),
            sceneAssetId: normalizeText(node.sceneAssetId),
            marker:
              node.marker && typeof node.marker === "object" && Array.isArray(node.marker) === false
                ? {
                    xPct: Number.isFinite(node.marker.xPct) ? Number(node.marker.xPct) : 0,
                    yPct: Number.isFinite(node.marker.yPct) ? Number(node.marker.yPct) : 0,
                  }
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

function normalizeScenarioManifest(assetRegistry, raw) {
  const source = raw && typeof raw === "object" && Array.isArray(raw) === false ? raw : {};
  return {
    version:
      typeof source.version === "number" && Number.isInteger(source.version) ? source.version : 1,
    scenarioId: normalizeText(source.scenarioId) || "intro",
    entryStepId: normalizeText(source.entryStepId),
    steps: Array.isArray(source.steps)
      ? source.steps.map(function (entry) {
          const step =
            entry && typeof entry === "object" && Array.isArray(entry) === false ? entry : {};
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
              ? step.choices.map(function (choice) {
                  const nextChoice =
                    choice && typeof choice === "object" && Array.isArray(choice) === false
                      ? choice
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
            npcs: npcAssetIds.map(function (assetId) {
              return attachAsset(assetRegistry, assetId, "npc");
            }),
            items: itemAssetIds.map(function (assetId) {
              return attachAsset(assetRegistry, assetId, "item");
            }),
            creatures: creatureAssetIds.map(function (assetId) {
              return attachAsset(assetRegistry, assetId, "creature");
            }),
          };
        })
      : [],
  };
}

function normalizeCombatCardsManifest(assetRegistry, raw) {
  const source = raw && typeof raw === "object" && Array.isArray(raw) === false ? raw : {};
  const seen = new Set();
  const cards = [];

  if (Array.isArray(source.cards)) {
    source.cards.forEach(function (entry) {
      const card =
        entry && typeof entry === "object" && Array.isArray(entry) === false ? entry : {};
      const id = normalizeText(card.id);
      if (id === "" || seen.has(id)) {
        return;
      }
      seen.add(id);
      cards.push({
        id,
        label: normalizeText(card.label) || id,
        type: normalizeText(card.type) || "utility",
        iconAssetId: normalizeText(card.iconAssetId),
        power: Number.isFinite(card.power) ? Number(card.power) : 0,
        cost: Number.isFinite(card.cost) ? Number(card.cost) : 0,
        guard: Number.isFinite(card.guard) ? Number(card.guard) : 0,
        heal: Number.isFinite(card.heal) ? Number(card.heal) : 0,
        focus: Number.isFinite(card.focus) ? Number(card.focus) : 0,
        counter: Number.isFinite(card.counter) ? Number(card.counter) : 0,
        evasion: Number.isFinite(card.evasion) ? Number(card.evasion) : 0,
        poison: Number.isFinite(card.poison) ? Number(card.poison) : 0,
        speedBonus: Number.isFinite(card.speedBonus) ? Number(card.speedBonus) : 0,
        selfDamage: Number.isFinite(card.selfDamage) ? Number(card.selfDamage) : 0,
        stun: card.stun === true,
        description: normalizeText(card.description),
        iconAsset: attachAsset(assetRegistry, card.iconAssetId, "ui-combat-icon"),
      });
    });
  }

  return {
    version:
      typeof source.version === "number" && Number.isInteger(source.version) ? source.version : 1,
    cards,
    cardMap: new Map(cards.map(function (card) {
      return [card.id, card];
    })),
  };
}

function normalizeCombatConfigManifest(assetRegistry, raw) {
  const source = raw && typeof raw === "object" && Array.isArray(raw) === false ? raw : {};
  return {
    version:
      typeof source.version === "number" && Number.isInteger(source.version) ? source.version : 1,
    startingEnergy: Number.isFinite(source.startingEnergy) ? Number(source.startingEnergy) : 3,
    startingStatus: Array.isArray(source.startingStatus)
      ? source.startingStatus.map(normalizeText).filter(Boolean)
      : [],
    enemyActions: Array.isArray(source.enemyActions)
      ? source.enemyActions.map(function (entry) {
          const action =
            entry && typeof entry === "object" && Array.isArray(entry) === false ? entry : {};
          return {
            id: normalizeText(action.id),
            label: normalizeText(action.label) || normalizeText(action.id),
            power: Number.isFinite(action.power) ? Number(action.power) : 0,
            stun: action.stun === true,
          };
        })
      : [],
    encounters: Array.isArray(source.encounters)
      ? source.encounters.map(function (entry) {
          const encounter =
            entry && typeof entry === "object" && Array.isArray(entry) === false ? entry : {};
          return {
            id: normalizeText(encounter.id),
            label: normalizeText(encounter.label) || normalizeText(encounter.id),
            assetId: normalizeText(encounter.assetId),
            stats:
              encounter.stats && typeof encounter.stats === "object" && Array.isArray(encounter.stats) === false
                ? encounter.stats
                : {},
            actionSequence: Array.isArray(encounter.actionSequence)
              ? encounter.actionSequence.map(normalizeText).filter(Boolean)
              : [],
            introLog: normalizeText(encounter.introLog),
            asset: attachAsset(assetRegistry, encounter.assetId, "creature"),
          };
        })
      : [],
  };
}

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
    configSource.error,
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
    classesById: new Map(selections.classes.map(function (entry) {
      return [entry.id, entry];
    })),
    avatarsById: new Map(selections.avatars.map(function (entry) {
      return [entry.id, entry];
    })),
    backgroundsById: new Map(selections.backgrounds.map(function (entry) {
      return [entry.id, entry];
    })),
    scenarioStepsById: new Map(scenario.steps.map(function (entry) {
      return [entry.id, entry];
    })),
    mapNodesById: new Map(map.nodes.map(function (entry) {
      return [entry.id, entry];
    })),
    encountersById: new Map(combatConfig.encounters.map(function (entry) {
      return [entry.id, entry];
    })),
    enemyActionsById: new Map(combatConfig.enemyActions.map(function (entry) {
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
      scenes: listFateKnotsAssetsByKind(assetRegistry, "scene").length,
    },
    errors,
  };
}
