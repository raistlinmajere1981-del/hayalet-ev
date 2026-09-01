export const FATE_KNOTS_SCHEMA_VERSION = 1;

export const FATE_KNOTS_PHASES = [
  "hub",
  "world-forge",
  "run-setup",
  "exploration",
  "transition",
  "combat-discussion",
  "combat-commit",
  "combat-resolution",
  "combat-aftermath",
  "loot",
  "camp",
  "finale",
  "completed",
  "failed",
] as const;

export type FateKnotsPhase = (typeof FATE_KNOTS_PHASES)[number];

export const FATE_KNOTS_SEAT_IDS = ["user", "ai1", "ai0", "ai2", "us1"] as const;
export type FateKnotsSeatId = (typeof FATE_KNOTS_SEAT_IDS)[number];

export type FateKnotsRole = "player" | "dm" | "npc-actor";

export interface FateKnotsSeatContract {
  seatId: FateKnotsSeatId;
  role: FateKnotsRole;
  required: boolean;
  active: boolean;
  connected: boolean;
  ready: boolean;
  displayName: string;
  avatarAssetId?: string | null;
}

export const FATE_KNOTS_FIXED_ROLES: Readonly<Record<FateKnotsSeatId, FateKnotsRole>> = {
  user: "player",
  ai1: "dm",
  ai0: "npc-actor",
  ai2: "player",
  us1: "player",
};

export type FateKnotsRow = "front" | "rear";
export type FateKnotsRange = "engaged" | "near" | "far";

export interface FateKnotsPosition {
  row: FateKnotsRow;
  range: FateKnotsRange;
}

export type FateKnotsTeamId = "party" | "opposition";

export const FATE_KNOTS_CARD_KINDS = [
  "character",
  "movement",
  "attack",
  "defense",
  "ability",
  "item",
  "equipment",
  "status",
  "injury",
  "choice",
  "event",
] as const;

export type FateKnotsCardKind = (typeof FATE_KNOTS_CARD_KINDS)[number];

export const FATE_KNOTS_RESOLUTION_PRIORITY_TIERS = ["fast", "normal", "heavy"] as const;
export type FateKnotsResolutionPriorityTier =
  (typeof FATE_KNOTS_RESOLUTION_PRIORITY_TIERS)[number];

export type FateKnotsEnemyControllerKind = "policy" | "ai0";

export type FateKnotsEnemyControllerDefinition =
  | {
      kind: "policy";
      policyId: string;
    }
  | {
      kind: "ai0";
      policyId?: null;
    };

export type FateKnotsMechanicalEffectTarget =
  | "self"
  | "primaryTarget"
  | "secondaryTarget"
  | "allAllies"
  | "allEnemies"
  | "ownTeam"
  | "run";

export type FateKnotsEffectKind =
  | "damage"
  | "heal"
  | "shield"
  | "apply-status"
  | "remove-status"
  | "move"
  | "modify-stat"
  | "modify-resource"
  | "grant-card"
  | "revoke-card"
  | "consume"
  | "reveal"
  | "retreat";

export type FateKnotsStatId =
  | "maxHp"
  | "hp"
  | "attack"
  | "defense"
  | "speed"
  | "energy";

export interface FateKnotsCardRequirement {
  phases?: FateKnotsPhase[];
  rows?: FateKnotsRow[];
  ranges?: FateKnotsRange[];
  requiredCardTags?: string[];
  requiredEquipmentTags?: string[];
  forbiddenStatusIds?: string[];
  targetTeam?: FateKnotsTeamId | "self" | "any";
  targetRows?: FateKnotsRow[];
  targetRanges?: FateKnotsRange[];
  targetLifeState?: "standing" | "fallen" | "any";
  actorMustBeStanding?: boolean;
}

export interface FateKnotsCardEffect {
  id: string;
  kind: FateKnotsEffectKind;
  target: FateKnotsMechanicalEffectTarget;
  value?: number;
  statId?: FateKnotsStatId;
  statusId?: string;
  cardId?: string;
  durationTurns?: number;
  moveTo?: Partial<FateKnotsPosition>;
  revealId?: string;
  tags?: string[];
}

export type FateKnotsPresentationApplyTo =
  | "card"
  | "self"
  | "primaryTarget"
  | "secondaryTarget"
  | "allAllies"
  | "allEnemies"
  | "casterAndTarget"
  | "battlefield"
  | "pageOverlay";

export type FateKnotsPresentationTiming =
  | "onSelect"
  | "onCommit"
  | "beforeResolve"
  | "onResolve"
  | "afterResolve"
  | "persistent";

export interface FateKnotsPresentationCue {
  cueId: string;
  animationId?: string | null;
  soundEffectId?: string | null;
  applyTo: FateKnotsPresentationApplyTo;
  timing: FateKnotsPresentationTiming;
  statusVisualId?: string | null;
}

export interface FateKnotsCardDefinition {
  id: string;
  kind: FateKnotsCardKind;
  name: string;
  description?: string;
  artAssetId?: string | null;
  tags: string[];
  requirements?: FateKnotsCardRequirement[];
  effects: FateKnotsCardEffect[];
  presentation: FateKnotsPresentationCue[];
  resolutionPriority?: FateKnotsResolutionPriorityTier;
  consumable?: boolean;
  sourceId?: string | null;
}

export interface FateKnotsEquipmentDefinition {
  id: string;
  name: string;
  slot: string;
  tags: string[];
  grantedCardIds: string[];
  removedCardIds?: string[];
}

export interface FateKnotsStatusDefinition {
  id: string;
  name: string;
  description?: string;
  tags: string[];
  persistent: boolean;
  maxStacks?: number;
  modifiers?: Array<{
    statId: FateKnotsStatId;
    value: number;
  }>;
  grantedCardIds?: string[];
  blockedCardTags?: string[];
  presentation?: FateKnotsPresentationCue[];
}

export interface FateKnotsCharacterDefinition {
  id: string;
  name: string;
  portraitAssetId: string;
  backgroundId?: string | null;
  tags: string[];
  playerSelectable: boolean;
  startingPosition: FateKnotsPosition;
  baseStats: {
    maxHp: number;
    attack: number;
    defense: number;
    speed: number;
    energy: number;
  };
  startingCardIds: string[];
  startingEquipmentIds: string[];
  combatController?: FateKnotsEnemyControllerDefinition | null;
  voiceProfileId?: string | null;
}

export interface FateKnotsNpcDefinition {
  id: string;
  name: string;
  portraitAssetId?: string | null;
  locationId: string;
  roleTags: string[];
  publicSummary: string;
  rolePacketId: string;
  voiceProfileId?: string | null;
  combatCharacterId?: string | null;
}

/**
 * Canonical AI0 knowledge boundary created during World Forge.
 * Runtime packets are rebuilt from this definition and current engine state;
 * AI0 session history or project memory is never authoritative NPC memory.
 */
export interface FateKnotsNpcRoleDefinition {
  id: string;
  npcId: string;
  personaFacts: string[];
  knownFacts: string[];
  relationshipFacts: string[];
}

export interface FateKnotsLocationDefinition {
  id: string;
  name: string;
  description: string;
  sceneAssetIds: string[];
  tags: string[];
  campAllowed?: boolean;
}

export interface FateKnotsMapNode {
  id: string;
  locationId: string;
  label: string;
  initiallyRevealed: boolean;
  mapPosition?: {
    x: number;
    y: number;
  } | null;
}

export interface FateKnotsMapEdge {
  id: string;
  fromNodeId: string;
  toNodeId: string;
  initiallyRevealed: boolean;
  travelCardIds?: string[];
  tags?: string[];
}

export interface FateKnotsMapDefinition {
  mapAssetId?: string | null;
  startNodeId: string;
  nodes: FateKnotsMapNode[];
  edges: FateKnotsMapEdge[];
}

export type FateKnotsAssetKind =
  | "background"
  | "book-cover"
  | "book-page"
  | "card-frame"
  | "icon"
  | "map"
  | "scene"
  | "portrait"
  | "transition"
  | "audio"
  | "other";

export interface FateKnotsAssetRef {
  id: string;
  kind: FateKnotsAssetKind;
  path: string;
  mimeType?: string | null;
  tags?: string[];
}

export interface FateKnotsThemePackage {
  id: string;
  name: string;
  backgroundAssetId: string;
  closedBookAssetId: string;
  openPageAssetId: string;
  mapStyleAssetId?: string | null;
  iconFamilyId?: string | null;
  cardFrameByKind: Partial<Record<FateKnotsCardKind, string>>;
  bookmarkAssetIds?: string[];
  transitionAssetIds?: string[];
  visualTags: string[];
}

export interface FateKnotsMusicIdentity {
  id: string;
  tempo?: number | null;
  meter?: string | null;
  scaleOrMode?: string | null;
  motif?: string | null;
  instrumentTags: string[];
  moodTags: string[];
  stateCueIds: Partial<
    Record<
      "exploration" | "travel" | "camp" | "tension" | "combat" | "victory" | "defeat" | "finale",
      string
    >
  >;
  fallbackCatalogId?: string | null;
}

export interface FateKnotsFinaleDefinition {
  id: string;
  conflictSummary: string;
  finaleLocationId: string;
  requiredKnotIds: string[];
  requiredItemIds?: string[];
  finalEncounterId?: string | null;
  finalChoiceCardIds?: string[];
  successConditionId: string;
  epilogueConditionIds: string[];
}

export interface FateKnotsUniversePackage {
  schemaVersion: number;
  universeId: string;
  title: string;
  premise: string;
  createdAt: string;
  theme: FateKnotsThemePackage;
  music: FateKnotsMusicIdentity;
  assets: FateKnotsAssetRef[];
  locations: FateKnotsLocationDefinition[];
  map: FateKnotsMapDefinition;
  npcs: FateKnotsNpcDefinition[];
  npcRoles: FateKnotsNpcRoleDefinition[];
  characters: FateKnotsCharacterDefinition[];
  cards: FateKnotsCardDefinition[];
  equipment: FateKnotsEquipmentDefinition[];
  statuses: FateKnotsStatusDefinition[];
  hiddenKnotIds: string[];
  finale: FateKnotsFinaleDefinition;
}

export interface FateKnotsActorState {
  actorId: string;
  characterId: string;
  seatId?: FateKnotsSeatId | null;
  teamId: FateKnotsTeamId;
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

export interface FateKnotsCombatActionCommit {
  actorId: string;
  movementCardId?: string | null;
  actionCardId?: string | null;
  primaryTargetId?: string | null;
  secondaryTargetId?: string | null;
  committed: boolean;
}

export interface FateKnotsCombatTurnConfig {
  maxMovementCards: number;
  maxActionCards: number;
}

export interface FateKnotsCombatState {
  combatId: string;
  turnIndex: number;
  phase: "combat-discussion" | "combat-commit" | "combat-resolution" | "combat-aftermath";
  config: FateKnotsCombatTurnConfig;
  actors: FateKnotsActorState[];
  commits: FateKnotsCombatActionCommit[];
  result: "active" | "party-victory" | "party-defeat" | "retreat";
}

export interface FateKnotsResolvedEffect {
  effectId: string;
  cardId: string;
  actorId: string;
  targetIds: string[];
  kind: FateKnotsEffectKind;
  value?: number;
  statusId?: string;
  resultingHp?: number;
  resultingPosition?: FateKnotsPosition;
  presentationCueIds: string[];
}

export interface FateKnotsCombatResultPackage {
  combatId: string;
  result: "party-victory" | "party-defeat" | "retreat";
  turns: number;
  fallenActorIds: string[];
  survivingActorIds: string[];
  resolvedEffects: FateKnotsResolvedEffect[];
  lootSourceId?: string | null;
  narrativeFacts: string[];
}

export interface FateKnotsPresentationEvent {
  eventId: string;
  type:
    | "card-selectable"
    | "card-selected"
    | "card-committed"
    | "target-valid"
    | "target-invalid"
    | "card-resolved"
    | "actor-fallen"
    | "status-applied"
    | "status-removed"
    | "position-changed"
    | "page-transition"
    | "scene-revealed"
    | "combat-started"
    | "combat-ended";
  actorId?: string | null;
  targetIds?: string[];
  cardId?: string | null;
  cueIds?: string[];
  payload?: Record<string, unknown>;
}

export interface FateKnotsRunState {
  schemaVersion: number;
  runId: string;
  universeId: string;
  phase: FateKnotsPhase;
  revision: number;
  activeLocationId: string | null;
  revealedLocationIds: string[];
  revealedKnotIds: string[];
  completedKnotIds: string[];
  partyActorIds: string[];
  actors: FateKnotsActorState[];
  teamPoolItemIds: string[];
  activeCombat: FateKnotsCombatState | null;
  finaleUnlocked: boolean;
  result: "active" | "completed" | "failed";
}

export interface FateKnotsDmScenePacket {
  universeId: string;
  runId: string;
  phase: FateKnotsPhase;
  locationId: string | null;
  visibleFacts: string[];
  playerSummaries: Array<{
    actorId: string;
    characterId: string;
    hp: number;
    maxHp: number;
    statusIds: string[];
    injuryIds: string[];
  }>;
  availableTransitionIds: string[];
  engineResultSummary?: FateKnotsCombatResultPackage | null;
}

export interface FateKnotsNpcRolePacket {
  universeId: string;
  runId: string;
  npcId: string;
  locationId: string;
  personaFacts: string[];
  knownFacts: string[];
  relationshipFacts: string[];
  legalInteractionIds: string[];
}
