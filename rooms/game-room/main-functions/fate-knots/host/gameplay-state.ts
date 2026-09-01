import type {
  FateKnotsAssetKind,
  FateKnotsCardDefinition,
  FateKnotsCardKind,
  FateKnotsCombatState,
  FateKnotsPhase,
  FateKnotsPosition,
  FateKnotsPresentationCue,
  FateKnotsResolutionPriorityTier,
  FateKnotsRunState,
  FateKnotsSeatId,
  FateKnotsTeamId,
  FateKnotsUniversePackage,
} from "../shared/contracts.js";

export interface FateKnotsGameplayPresentationCueSummary {
  cueId: string;
  animationId: string | null;
  soundEffectId: string | null;
  applyTo: FateKnotsPresentationCue["applyTo"];
  timing: FateKnotsPresentationCue["timing"];
  statusVisualId: string | null;
}

export interface FateKnotsGameplayCardSummary {
  cardId: string;
  kind: FateKnotsCardKind;
  name: string;
  description: string;
  artAssetId: string | null;
  tags: string[];
  presentation: FateKnotsGameplayPresentationCueSummary[];
  resolutionPriority: FateKnotsResolutionPriorityTier;
  consumable: boolean;
}

export interface FateKnotsGameplayEquipmentSummary {
  equipmentId: string;
  name: string;
  slot: string;
  tags: string[];
}

export interface FateKnotsGameplayStatusSummary {
  statusId: string;
  name: string;
  description: string;
  tags: string[];
  persistent: boolean;
  presentation: FateKnotsGameplayPresentationCueSummary[];
}

export interface FateKnotsGameplayAssetSummary {
  assetId: string;
  kind: FateKnotsAssetKind;
  path: string;
  mimeType: string | null;
  tags: string[];
}

export interface FateKnotsGameplayThemeSummary {
  themeId: string;
  name: string;
  backgroundAssetId: string;
  closedBookAssetId: string;
  openPageAssetId: string;
  mapStyleAssetId: string | null;
  iconFamilyId: string | null;
  cardFrameByKind: Partial<Record<FateKnotsCardKind, string>>;
  bookmarkAssetIds: string[];
  transitionAssetIds: string[];
  visualTags: string[];
}

export interface FateKnotsGameplayLocationSummary {
  locationId: string;
  name: string;
  description: string;
  sceneAssetIds: string[];
  tags: string[];
  campAllowed: boolean;
}

export interface FateKnotsGameplayMapNodeSummary {
  nodeId: string;
  locationId: string;
  label: string;
  mapPosition: { x: number; y: number } | null;
}

export interface FateKnotsGameplayMapEdgeSummary {
  edgeId: string;
  fromNodeId: string;
  toNodeId: string;
}

export interface FateKnotsGameplayPartyActorSummary {
  actorId: string;
  characterId: string;
  seatId: FateKnotsSeatId | null;
  name: string;
  portraitAssetId: string;
  hp: number;
  maxHp: number;
  attack: number;
  defense: number;
  speed: number;
  energy: number;
  fallen: boolean;
  position: FateKnotsPosition;
  ownedCardIds: string[];
  availableCardIds: string[];
  equipmentIds: string[];
  statusIds: string[];
  injuryIds: string[];
}

export interface FateKnotsGameplayCombatActorSummary {
  actorId: string;
  teamId: FateKnotsTeamId;
  hp: number;
  maxHp: number;
  fallen: boolean;
  position: FateKnotsPosition;
  statusIds: string[];
  injuryIds: string[];
}

export interface FateKnotsGameplayCombatSummary {
  combatId: string;
  turnIndex: number;
  phase: FateKnotsCombatState["phase"];
  result: FateKnotsCombatState["result"];
  actors: FateKnotsGameplayCombatActorSummary[];
}

export interface FateKnotsGameplayState {
  universeId: string;
  runId: string;
  phase: FateKnotsPhase;
  revision: number;
  result: FateKnotsRunState["result"];
  theme: FateKnotsGameplayThemeSummary;
  assets: FateKnotsGameplayAssetSummary[];
  activeLocation: FateKnotsGameplayLocationSummary | null;
  map: {
    mapAssetId: string | null;
    nodes: FateKnotsGameplayMapNodeSummary[];
    edges: FateKnotsGameplayMapEdgeSummary[];
  };
  partyActors: FateKnotsGameplayPartyActorSummary[];
  cards: FateKnotsGameplayCardSummary[];
  equipment: FateKnotsGameplayEquipmentSummary[];
  statuses: FateKnotsGameplayStatusSummary[];
  lootCardIds: string[];
  combat: FateKnotsGameplayCombatSummary | null;
}

export type FateKnotsGameplayStateIssueCode =
  | "run-universe-mismatch"
  | "party-actor-not-found"
  | "character-not-found"
  | "active-location-not-revealed"
  | "location-not-found"
  | "card-not-found"
  | "equipment-not-found"
  | "status-not-found"
  | "asset-not-found";

export interface FateKnotsGameplayStateIssue {
  code: FateKnotsGameplayStateIssueCode;
  value?: string;
}

export type FateKnotsGameplayStateBuildResult =
  | { ok: true; state: FateKnotsGameplayState; issues: [] }
  | { ok: false; state: null; issues: FateKnotsGameplayStateIssue[] };

function unique(values: readonly string[]): string[] {
  return Array.from(new Set(values));
}

function compactStrings(values: readonly (string | null | undefined)[]): string[] {
  return unique(
    values.filter((value): value is string => typeof value === "string" && value !== "")
  );
}

function summarizeCue(cue: FateKnotsPresentationCue): FateKnotsGameplayPresentationCueSummary {
  return {
    cueId: cue.cueId,
    animationId: cue.animationId ?? null,
    soundEffectId: cue.soundEffectId ?? null,
    applyTo: cue.applyTo,
    timing: cue.timing,
    statusVisualId: cue.statusVisualId ?? null,
  };
}

function summarizeCard(card: FateKnotsCardDefinition): FateKnotsGameplayCardSummary {
  return {
    cardId: card.id,
    kind: card.kind,
    name: card.name,
    description: card.description ?? "",
    artAssetId: card.artAssetId ?? null,
    tags: card.tags.slice(),
    presentation: card.presentation.map(summarizeCue),
    resolutionPriority: card.resolutionPriority ?? "normal",
    consumable: card.consumable === true,
  };
}

function summarizeCombat(
  combat: FateKnotsCombatState | null
): FateKnotsGameplayCombatSummary | null {
  if (!combat) return null;
  return {
    combatId: combat.combatId,
    turnIndex: combat.turnIndex,
    phase: combat.phase,
    result: combat.result,
    actors: combat.actors.map((actor) => ({
      actorId: actor.actorId,
      teamId: actor.teamId,
      hp: actor.hp,
      maxHp: actor.maxHp,
      fallen: actor.fallen,
      position: { ...actor.position },
      statusIds: actor.statusIds.slice(),
      injuryIds: actor.injuryIds.slice(),
    })),
  };
}

/**
 * Builds the renderer-facing active-run projection without exposing canonical
 * hidden-world authority.
 *
 * Deliberately absent:
 * - hidden/revealed knot ids and finale definition
 * - NPC role packets and NPC hidden knowledge
 * - unrevealed locations/nodes/edges and their presentation assets
 * - combat commits and opposition card ownership/availability/artwork/cues
 * - raw card effects/reveal ids that may point at hidden canon
 *
 * Theme identity and presentation cues for player-visible cards/statuses are
 * safe player-facing presentation data. Asset paths are projected only for theme
 * resources and currently visible/referenced entities; the renderer never
 * receives the complete Universe Package asset catalog.
 *
 * The renderer receives enough public identity/state to compose the living book
 * but must use engine legality/presentation events rather than infer mechanics.
 */
export function buildFateKnotsGameplayState(
  universe: FateKnotsUniversePackage,
  run: FateKnotsRunState
): FateKnotsGameplayStateBuildResult {
  if (run.universeId !== universe.universeId) {
    return {
      ok: false,
      state: null,
      issues: [{ code: "run-universe-mismatch", value: run.universeId }],
    };
  }

  const actorById = new Map(run.actors.map((actor) => [actor.actorId, actor] as const));
  const characterById = new Map(
    universe.characters.map((character) => [character.id, character] as const)
  );
  const cardById = new Map(universe.cards.map((card) => [card.id, card] as const));
  const equipmentById = new Map(
    universe.equipment.map((equipment) => [equipment.id, equipment] as const)
  );
  const statusById = new Map(universe.statuses.map((status) => [status.id, status] as const));
  const locationById = new Map(
    universe.locations.map((location) => [location.id, location] as const)
  );
  const assetById = new Map(universe.assets.map((asset) => [asset.id, asset] as const));
  const issues: FateKnotsGameplayStateIssue[] = [];

  const partyActors: FateKnotsGameplayPartyActorSummary[] = [];
  for (const actorId of run.partyActorIds) {
    const actor = actorById.get(actorId);
    if (!actor) {
      issues.push({ code: "party-actor-not-found", value: actorId });
      continue;
    }
    const character = characterById.get(actor.characterId);
    if (!character) {
      issues.push({ code: "character-not-found", value: actor.characterId });
      continue;
    }
    partyActors.push({
      actorId: actor.actorId,
      characterId: actor.characterId,
      seatId: actor.seatId ?? null,
      name: character.name,
      portraitAssetId: character.portraitAssetId,
      hp: actor.hp,
      maxHp: actor.maxHp,
      attack: actor.attack,
      defense: actor.defense,
      speed: actor.speed,
      energy: actor.energy,
      fallen: actor.fallen,
      position: { ...actor.position },
      ownedCardIds: actor.ownedCardIds.slice(),
      availableCardIds: actor.availableCardIds.slice(),
      equipmentIds: actor.equipmentIds.slice(),
      statusIds: actor.statusIds.slice(),
      injuryIds: actor.injuryIds.slice(),
    });
  }

  let activeLocation: FateKnotsGameplayLocationSummary | null = null;
  if (run.activeLocationId !== null) {
    if (!run.revealedLocationIds.includes(run.activeLocationId)) {
      issues.push({ code: "active-location-not-revealed", value: run.activeLocationId });
    } else {
      const location = locationById.get(run.activeLocationId);
      if (!location) {
        issues.push({ code: "location-not-found", value: run.activeLocationId });
      } else {
        activeLocation = {
          locationId: location.id,
          name: location.name,
          description: location.description,
          sceneAssetIds: location.sceneAssetIds.slice(),
          tags: location.tags.slice(),
          campAllowed: location.campAllowed === true,
        };
      }
    }
  }

  const revealedLocationIds = new Set(run.revealedLocationIds);
  const visibleNodes = universe.map.nodes.filter((node) =>
    revealedLocationIds.has(node.locationId)
  );
  const visibleNodeIds = new Set(visibleNodes.map((node) => node.id));

  const referencedCardIds = unique([
    ...partyActors.flatMap((actor) => actor.ownedCardIds),
    ...partyActors.flatMap((actor) => actor.availableCardIds),
    ...partyActors.flatMap((actor) => actor.injuryIds),
    ...run.teamPoolItemIds,
  ]);
  const cards: FateKnotsGameplayCardSummary[] = [];
  referencedCardIds.forEach((cardId) => {
    const card = cardById.get(cardId);
    if (!card) issues.push({ code: "card-not-found", value: cardId });
    else cards.push(summarizeCard(card));
  });

  const referencedEquipmentIds = unique(partyActors.flatMap((actor) => actor.equipmentIds));
  const equipment: FateKnotsGameplayEquipmentSummary[] = [];
  referencedEquipmentIds.forEach((equipmentId) => {
    const definition = equipmentById.get(equipmentId);
    if (!definition) issues.push({ code: "equipment-not-found", value: equipmentId });
    else {
      equipment.push({
        equipmentId: definition.id,
        name: definition.name,
        slot: definition.slot,
        tags: definition.tags.slice(),
      });
    }
  });

  const referencedStatusIds = unique([
    ...partyActors.flatMap((actor) => actor.statusIds),
    ...(run.activeCombat?.actors.flatMap((actor) => actor.statusIds) ?? []),
  ]);
  const statuses: FateKnotsGameplayStatusSummary[] = [];
  referencedStatusIds.forEach((statusId) => {
    const status = statusById.get(statusId);
    if (!status) issues.push({ code: "status-not-found", value: statusId });
    else {
      statuses.push({
        statusId: status.id,
        name: status.name,
        description: status.description ?? "",
        tags: status.tags.slice(),
        persistent: status.persistent,
        presentation: status.presentation?.map(summarizeCue) ?? [],
      });
    }
  });

  const theme: FateKnotsGameplayThemeSummary = {
    themeId: universe.theme.id,
    name: universe.theme.name,
    backgroundAssetId: universe.theme.backgroundAssetId,
    closedBookAssetId: universe.theme.closedBookAssetId,
    openPageAssetId: universe.theme.openPageAssetId,
    mapStyleAssetId: universe.theme.mapStyleAssetId ?? null,
    iconFamilyId: universe.theme.iconFamilyId ?? null,
    cardFrameByKind: { ...universe.theme.cardFrameByKind },
    bookmarkAssetIds: universe.theme.bookmarkAssetIds?.slice() ?? [],
    transitionAssetIds: universe.theme.transitionAssetIds?.slice() ?? [],
    visualTags: universe.theme.visualTags.slice(),
  };

  const referencedAssetIds = compactStrings([
    theme.backgroundAssetId,
    theme.closedBookAssetId,
    theme.openPageAssetId,
    theme.mapStyleAssetId,
    ...Object.values(theme.cardFrameByKind),
    ...theme.bookmarkAssetIds,
    ...theme.transitionAssetIds,
    universe.map.mapAssetId,
    ...(activeLocation?.sceneAssetIds ?? []),
    ...partyActors.map((actor) => actor.portraitAssetId),
    ...cards.map((card) => card.artAssetId),
  ]);
  const assets: FateKnotsGameplayAssetSummary[] = [];
  referencedAssetIds.forEach((assetId) => {
    const asset = assetById.get(assetId);
    if (!asset) {
      issues.push({ code: "asset-not-found", value: assetId });
      return;
    }
    assets.push({
      assetId: asset.id,
      kind: asset.kind,
      path: asset.path,
      mimeType: asset.mimeType ?? null,
      tags: asset.tags?.slice() ?? [],
    });
  });

  if (issues.length > 0) return { ok: false, state: null, issues };

  return {
    ok: true,
    state: {
      universeId: universe.universeId,
      runId: run.runId,
      phase: run.phase,
      revision: run.revision,
      result: run.result,
      theme,
      assets,
      activeLocation,
      map: {
        mapAssetId: universe.map.mapAssetId ?? null,
        nodes: visibleNodes.map((node) => ({
          nodeId: node.id,
          locationId: node.locationId,
          label: node.label,
          mapPosition: node.mapPosition ? { ...node.mapPosition } : null,
        })),
        edges: universe.map.edges
          .filter(
            (edge) =>
              edge.initiallyRevealed &&
              visibleNodeIds.has(edge.fromNodeId) &&
              visibleNodeIds.has(edge.toNodeId)
          )
          .map((edge) => ({
            edgeId: edge.id,
            fromNodeId: edge.fromNodeId,
            toNodeId: edge.toNodeId,
          })),
      },
      partyActors,
      cards,
      equipment,
      statuses,
      lootCardIds: run.phase === "loot" ? run.teamPoolItemIds.slice() : [],
      combat: summarizeCombat(run.activeCombat),
    },
    issues: [],
  };
}
