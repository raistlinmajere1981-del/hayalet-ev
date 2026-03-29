import { attachAsset, normalizeText } from "./content-loader-shared.js";

export function normalizeCombatCardsManifest(assetRegistry, raw) {
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
    cardMap: new Map(
      cards.map(function (card) {
        return [card.id, card];
      })
    ),
  };
}

export function normalizeCombatConfigManifest(assetRegistry, raw) {
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
