import type {
  FateKnotsCardDefinition,
  FateKnotsCharacterDefinition,
  FateKnotsEquipmentDefinition,
  FateKnotsUniversePackage,
} from "../shared/contracts.js";

export interface FateKnotsRunSetupCardSummary {
  cardId: string;
  kind: FateKnotsCardDefinition["kind"];
  name: string;
  description: string;
}

export interface FateKnotsRunSetupEquipmentSummary {
  equipmentId: string;
  name: string;
  slot: string;
}

export interface FateKnotsRunSetupCharacterSummary {
  characterId: string;
  name: string;
  portraitAssetId: string;
  backgroundId: string | null;
  tags: string[];
  baseStats: FateKnotsCharacterDefinition["baseStats"];
  startingPosition: FateKnotsCharacterDefinition["startingPosition"];
  startingCards: FateKnotsRunSetupCardSummary[];
  startingEquipment: FateKnotsRunSetupEquipmentSummary[];
}

export interface FateKnotsRunSetupSnapshot {
  universeId: string;
  title: string;
  characters: FateKnotsRunSetupCharacterSummary[];
}

function summarizeCard(card: FateKnotsCardDefinition): FateKnotsRunSetupCardSummary {
  return {
    cardId: card.id,
    kind: card.kind,
    name: card.name,
    description: card.description ?? "",
  };
}

function summarizeEquipment(
  equipment: FateKnotsEquipmentDefinition
): FateKnotsRunSetupEquipmentSummary {
  return {
    equipmentId: equipment.id,
    name: equipment.name,
    slot: equipment.slot,
  };
}

/**
 * Builds the only Universe Package projection required by neutral run setup.
 *
 * It contains only player-selectable character identity and player-owned
 * starting mechanics. Map nodes, locations, NPCs, role packets, hidden knots,
 * finale data and unrelated cards/equipment are deliberately excluded.
 */
export function buildFateKnotsRunSetupSnapshot(
  universe: FateKnotsUniversePackage
): FateKnotsRunSetupSnapshot {
  const cardById = new Map(universe.cards.map((card) => [card.id, card] as const));
  const equipmentById = new Map(
    universe.equipment.map((equipment) => [equipment.id, equipment] as const)
  );

  return {
    universeId: universe.universeId,
    title: universe.title,
    characters: universe.characters
      .filter((character) => character.playerSelectable)
      .map((character) => ({
        characterId: character.id,
        name: character.name,
        portraitAssetId: character.portraitAssetId,
        backgroundId: character.backgroundId ?? null,
        tags: character.tags.slice(),
        baseStats: { ...character.baseStats },
        startingPosition: { ...character.startingPosition },
        startingCards: character.startingCardIds
          .map((cardId) => cardById.get(cardId))
          .filter((card): card is FateKnotsCardDefinition => card !== undefined)
          .map(summarizeCard),
        startingEquipment: character.startingEquipmentIds
          .map((equipmentId) => equipmentById.get(equipmentId))
          .filter(
            (equipment): equipment is FateKnotsEquipmentDefinition => equipment !== undefined
          )
          .map(summarizeEquipment),
      })),
  };
}
