import { loadContext, readLocale } from "../../../shared/host/context-state.js";
import { FATE_KNOTS_FEATURE_ID, ROOM_ID } from "../../../shared/host/feature-meta.js";
import { normalizeLocale, translate } from "../../../shared/host/text.js";
import {
  FATE_KNOTS_HISTORY_STATE_KEY,
  FATE_KNOTS_MAX_HISTORY_ENTRIES,
  FATE_KNOTS_PROFILE_STATE_KEY,
  FATE_KNOTS_SCHEMA_VERSION,
  FATE_KNOTS_SAVE_SLOT_STATE_KEY,
  FATE_KNOTS_STATE_KEY,
  FATE_KNOTS_STATUS_COPY,
} from "./constants.js";
import {
  buildFateKnotsCombatTurnId,
  cloneFateKnotsCombatState,
  getAvailableFateKnotsCombatActions,
  getCurrentFateKnotsCombatTurn,
  type FateKnotsCombatCard,
  type FateKnotsCombatState,
  type FateKnotsCombatant,
  type FateKnotsEnemy,
  type FateKnotsTurnEntry,
} from "./combat-engine.js";
import {
  createInitialFateKnotsState,
  normalizeHistoryEntry,
  normalizeHistoryState,
  normalizeFateKnotsState,
  normalizeProfileState,
  normalizeSaveSlotState,
} from "./models.js";

type FateKnotsHostState = ReturnType<typeof normalizeFateKnotsState>;
type FateKnotsParticipantState = FateKnotsHostState["participants"][number];
type FateKnotsSelectionState = FateKnotsParticipantState["selection"];
type FateKnotsHistoryState = ReturnType<typeof normalizeHistoryState>;
type FateKnotsProfileState = ReturnType<typeof normalizeProfileState>;
type FateKnotsSaveSlotState = ReturnType<typeof normalizeSaveSlotState>;
type FateKnotsSharedContext = ReturnType<typeof loadContext>;

interface RoomApi {
  getState(key: string): unknown;
  setState(key: string, value: unknown): void;
  getLocale?(): unknown;
  notifyRoom?(eventType: string, data: unknown): void;
}

interface FateKnotsCatalogEntryRecord extends Record<string, unknown> {
  id: string;
  label?: string;
  summary?: string;
  description?: string;
  perk?: string;
  stats?: Record<string, unknown>;
  startingDeck?: string[];
  asset?: unknown;
}

interface FateKnotsScenarioChoiceRecord extends Record<string, unknown> {
  id: string;
  label: string;
  summary: string;
  nextStepId?: string;
  encounterId?: string;
}

interface FateKnotsScenarioStepRecord extends Record<string, unknown> {
  id: string;
  title: string;
  body: string;
  locationId?: string;
  choices: FateKnotsScenarioChoiceRecord[];
}

interface FateKnotsMapNodeRecord extends Record<string, unknown> {
  id: string;
}

interface FateKnotsEncounterRecord extends Record<string, unknown> {
  id: string;
  asset?: unknown;
}

interface FateKnotsUiAssetRecord extends Record<string, unknown> {
  id: string;
  kind?: string;
}

interface FateKnotsContentRegistry {
  classesById: Map<string, FateKnotsCatalogEntryRecord>;
  avatarsById: Map<string, FateKnotsCatalogEntryRecord>;
  backgroundsById: Map<string, FateKnotsCatalogEntryRecord>;
  scenarioStepsById: Map<string, FateKnotsScenarioStepRecord>;
  mapNodesById: Map<string, FateKnotsMapNodeRecord>;
  encountersById: Map<string, FateKnotsEncounterRecord>;
  cardsById: Map<string, FateKnotsCombatCard>;
  selections: {
    avatars: FateKnotsCatalogEntryRecord[];
    classes: FateKnotsCatalogEntryRecord[];
    backgrounds: FateKnotsCatalogEntryRecord[];
  };
  map: Record<string, unknown>;
  assetRegistry: {
    assets?: unknown[];
  } | null;
  assetCoverage: Record<string, unknown>;
  errors: string[];
}

interface FateKnotsSelectionView extends Record<string, unknown> {
  avatarId: string | null;
  classId: string | null;
  backgroundId: string | null;
  locked: boolean;
  autoAssigned: boolean;
  avatar: FateKnotsCatalogEntryRecord | null;
  class: FateKnotsCatalogEntryRecord | null;
  background: FateKnotsCatalogEntryRecord | null;
}

interface FateKnotsParticipantView extends Record<string, unknown> {
  seatId: string;
  provider: string;
  type: string;
  nickname: string;
  ready: boolean;
  connected: boolean;
  active: boolean;
  selection: FateKnotsSelectionView;
  decisionChoiceId: string | null;
  combat: {
    hp: number;
    maxHp: number;
    energy: number;
    maxEnergy: number;
    status: FateKnotsCombatant["status"];
  } | null;
}

interface FateKnotsCombatView extends Record<string, unknown> {
  encounterId: string;
  outcome: string;
  round: number;
  turn: FateKnotsTurnEntry | null;
  turnId: string | null;
  party: Array<FateKnotsCombatant & { selection: FateKnotsSelectionView | null }>;
  enemy: FateKnotsEnemy & { asset: unknown | null };
  recentLog: string[];
  availableActions: Array<FateKnotsCombatCard & { available: boolean }>;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && Array.isArray(value) === false;
}

function cloneJsonValue<T>(value: T): T {
  return value === undefined ? value : (JSON.parse(JSON.stringify(value)) as T);
}

function readCombatState(state: FateKnotsHostState): FateKnotsCombatState | null {
  return state.combat ? cloneFateKnotsCombatState(state.combat) : null;
}

export function resolveFateKnotsStatusText(state: FateKnotsHostState): string {
  const message = translate(state.locale, FATE_KNOTS_STATUS_COPY, state.statusKey);
  if (message) {
    return message;
  }
  if (state.waiting.reason) {
    return state.waiting.reason;
  }
  return translate(state.locale, FATE_KNOTS_STATUS_COPY, "idle");
}

export function loadFateKnotsState(api: RoomApi): FateKnotsHostState {
  return normalizeFateKnotsState(api.getState(FATE_KNOTS_STATE_KEY), readLocale(api));
}

export function saveFateKnotsState(api: RoomApi, state: unknown): FateKnotsHostState {
  const normalized = normalizeFateKnotsState(state, readLocale(api));
  normalized.locale = normalizeLocale(readLocale(api));
  api.setState(FATE_KNOTS_STATE_KEY, normalized);
  return normalized;
}

export function resetFateKnotsState(api: RoomApi, statusKey = "idle"): FateKnotsHostState {
  const nextState = createInitialFateKnotsState(readLocale(api));
  nextState.statusKey = statusKey;
  nextState.compatibility.mode = statusKey === "idle" ? "fresh" : "reset-safe";
  return saveFateKnotsState(api, nextState);
}

export function loadFateKnotsProfile(api: RoomApi): FateKnotsProfileState {
  return normalizeProfileState(api.getState(FATE_KNOTS_PROFILE_STATE_KEY));
}

export function saveFateKnotsProfile(api: RoomApi, profile: unknown): FateKnotsProfileState {
  const normalized = normalizeProfileState(profile);
  api.setState(FATE_KNOTS_PROFILE_STATE_KEY, normalized);
  return normalized;
}

export function loadFateKnotsHistory(api: RoomApi): FateKnotsHistoryState {
  return normalizeHistoryState(api.getState(FATE_KNOTS_HISTORY_STATE_KEY));
}

export function saveFateKnotsHistory(api: RoomApi, history: unknown): FateKnotsHistoryState {
  const normalized = normalizeHistoryState(history);
  api.setState(FATE_KNOTS_HISTORY_STATE_KEY, normalized);
  return normalized;
}

export function appendFateKnotsHistory(api: RoomApi, entry: unknown): FateKnotsHistoryState {
  const nextEntry = normalizeHistoryEntry(entry);
  if (nextEntry.timestamp === null) {
    return loadFateKnotsHistory(api);
  }

  const nextHistory = [nextEntry]
    .concat(
      loadFateKnotsHistory(api).filter(function (item) {
        return item.sessionId !== nextEntry.sessionId;
      })
    )
    .slice(0, FATE_KNOTS_MAX_HISTORY_ENTRIES);

  return saveFateKnotsHistory(api, nextHistory);
}

export function loadFateKnotsSaveSlot(api: RoomApi): FateKnotsSaveSlotState {
  return normalizeSaveSlotState(api.getState(FATE_KNOTS_SAVE_SLOT_STATE_KEY));
}

export function saveFateKnotsSaveSlot(api: RoomApi, saveSlot: unknown): FateKnotsSaveSlotState {
  const normalized = normalizeSaveSlotState(saveSlot);
  api.setState(FATE_KNOTS_SAVE_SLOT_STATE_KEY, normalized);
  return normalized;
}

function resolveSelectionView(
  selection: FateKnotsSelectionState,
  contentRegistry: FateKnotsContentRegistry
): FateKnotsSelectionView {
  const avatar = selection.avatarId
    ? contentRegistry.avatarsById.get(selection.avatarId) || null
    : null;
  const classDef = selection.classId
    ? contentRegistry.classesById.get(selection.classId) || null
    : null;
  const background = selection.backgroundId
    ? contentRegistry.backgroundsById.get(selection.backgroundId) || null
    : null;

  return {
    avatarId: selection.avatarId,
    classId: selection.classId,
    backgroundId: selection.backgroundId,
    locked: selection.locked,
    autoAssigned: selection.autoAssigned,
    avatar,
    class: classDef,
    background,
  };
}

function resolveParticipantView(
  participant: FateKnotsParticipantState,
  contentRegistry: FateKnotsContentRegistry,
  combatState: FateKnotsCombatState | null
): FateKnotsParticipantView {
  const combatant = combatState
    ? combatState.party.find(function (entry: FateKnotsCombatant) {
        return entry.seatId === participant.seatId;
      }) || null
    : null;

  return {
    seatId: participant.seatId,
    provider: participant.provider,
    type: participant.type,
    nickname: participant.nickname,
    ready: participant.ready,
    connected: participant.connected,
    active: participant.active,
    selection: resolveSelectionView(participant.selection, contentRegistry),
    decisionChoiceId: participant.decisionChoiceId,
    combat: combatant
      ? {
          hp: combatant.hp,
          maxHp: combatant.maxHp,
          energy: combatant.energy,
          maxEnergy: combatant.maxEnergy,
          status: cloneJsonValue(combatant.status),
        }
      : null,
  };
}

function resolveStepView(
  state: FateKnotsHostState,
  contentRegistry: FateKnotsContentRegistry
): (Record<string, unknown> & { location: FateKnotsMapNodeRecord | null }) | null {
  if (!state.currentStepId) {
    return null;
  }

  const step = contentRegistry.scenarioStepsById.get(state.currentStepId) || null;
  if (!step) {
    return null;
  }

  const location = step.locationId
    ? contentRegistry.mapNodesById.get(step.locationId) || null
    : null;
  return {
    ...cloneJsonValue(step),
    location,
  };
}

function resolveDecisionView(state: FateKnotsHostState): Record<string, unknown> | null {
  if (!state.decision) {
    return null;
  }

  return {
    stepId: state.decision.stepId,
    choiceIds: state.decision.choiceIds.slice(),
    votes: cloneJsonValue(state.decision.votes),
    participantIds: state.decision.participantIds.slice(),
    resolvedChoiceId: state.decision.resolvedChoiceId,
    conflict: state.decision.conflict,
    pendingSeatIds: state.decision.participantIds.filter(function (seatId: string) {
      return !state.decision?.votes[seatId];
    }),
    deadlineAt: state.decision.deadlineAt,
  };
}

function resolveCombatView(
  state: FateKnotsHostState,
  contentRegistry: FateKnotsContentRegistry
): FateKnotsCombatView | null {
  const combat = readCombatState(state);
  if (!combat) {
    return null;
  }

  const turn = getCurrentFateKnotsCombatTurn(combat);
  const turnId = buildFateKnotsCombatTurnId(combat);
  const availableActions =
    turn && turn.side === "party"
      ? getAvailableFateKnotsCombatActions(combat, turn.seatId, contentRegistry.cardsById)
      : [];

  return {
    encounterId: combat.encounterId,
    outcome: combat.outcome,
    round: combat.round,
    turn,
    turnId,
    party: combat.party.map(function (member: FateKnotsCombatant) {
      const participant =
        state.participants.find(function (entry: FateKnotsParticipantState) {
          return entry.seatId === member.seatId;
        }) || null;

      return {
        ...member,
        selection: participant
          ? resolveSelectionView(participant.selection, contentRegistry)
          : null,
      };
    }),
    enemy: {
      ...combat.enemy,
      asset: combat.enemy.assetId
        ? contentRegistry.encountersById.get(combat.enemy.id)?.asset || null
        : null,
    },
    recentLog: combat.log.slice(-8),
    availableActions,
  };
}

function resolveAmbientPacketView(
  packet: FateKnotsHostState["dmNarration"] | FateKnotsHostState["npcBanter"]
): Record<string, unknown> | null {
  return packet ? cloneJsonValue(packet) : null;
}

function buildUiAssetView(contentRegistry: FateKnotsContentRegistry) {
  const assetRegistry = isRecord(contentRegistry.assetRegistry)
    ? contentRegistry.assetRegistry
    : null;
  const assets = Array.isArray(assetRegistry?.assets) ? assetRegistry.assets : [];
  const byId: Record<string, FateKnotsUiAssetRecord> = {};

  assets.forEach(function (asset: unknown) {
    if (!isRecord(asset) || typeof asset["id"] !== "string") {
      return;
    }

    const kind = typeof asset["kind"] === "string" ? asset["kind"] : "";
    if (kind === "feature-view" || kind.startsWith("ui-")) {
      byId[asset["id"]] = cloneJsonValue(asset as FateKnotsUiAssetRecord);
    }
  });

  return {
    byId,
    featureView: byId["fate-knots-view"] || null,
  };
}

export function serializeFateKnotsState(
  api: RoomApi,
  state: FateKnotsHostState,
  context: FateKnotsSharedContext,
  contentRegistry: FateKnotsContentRegistry
) {
  const savedState = saveFateKnotsState(api, state);
  const combat = resolveCombatView(savedState, contentRegistry);
  const uiAssets = buildUiAssetView(contentRegistry);

  return {
    roomId: ROOM_ID,
    featureId: FATE_KNOTS_FEATURE_ID,
    schemaVersion: FATE_KNOTS_SCHEMA_VERSION,
    active: savedState.active,
    phase: savedState.phase,
    statusKey: savedState.statusKey,
    status: resolveFateKnotsStatusText(savedState),
    compatibility: cloneJsonValue(savedState.compatibility),
    sessionId: savedState.sessionId,
    participantMode: savedState.participantMode,
    rosterLocked: savedState.rosterLocked,
    participants: savedState.participants.map(function (participant: FateKnotsParticipantState) {
      return resolveParticipantView(participant, contentRegistry, readCombatState(savedState));
    }),
    excludedSeats: cloneJsonValue(savedState.excludedSeats),
    waiting: cloneJsonValue(savedState.waiting),
    map: {
      ...cloneJsonValue(contentRegistry.map),
      currentLocationId: savedState.currentLocationId,
    },
    currentStep: resolveStepView(savedState, contentRegistry),
    decision: resolveDecisionView(savedState),
    combat,
    result: cloneJsonValue(savedState.result),
    dmNarration: resolveAmbientPacketView(savedState.dmNarration),
    npcBanter: resolveAmbientPacketView(savedState.npcBanter),
    scenarioLog: savedState.scenarioLog.slice(-12),
    profile: loadFateKnotsProfile(api),
    history: loadFateKnotsHistory(api),
    saveSlot: loadFateKnotsSaveSlot(api),
    catalogs: {
      avatars: cloneJsonValue(contentRegistry.selections.avatars),
      classes: cloneJsonValue(contentRegistry.selections.classes),
      backgrounds: cloneJsonValue(contentRegistry.selections.backgrounds),
    },
    assetCoverage: cloneJsonValue(contentRegistry.assetCoverage),
    contentErrors: contentRegistry.errors.slice(),
    contentSummary: cloneJsonValue(savedState.contentSummary),
    transport: cloneJsonValue(savedState.transport),
    user: {
      nickname: context.user.nickname || "User",
    },
    uiAssets,
  };
}

export function pushFateKnotsState(
  api: RoomApi,
  state: FateKnotsHostState,
  contentRegistry: FateKnotsContentRegistry
): FateKnotsHostState {
  const context = loadContext(api);
  if (typeof api.notifyRoom === "function") {
    api.notifyRoom("fate-knots-state", {
      state: serializeFateKnotsState(api, state, context, contentRegistry),
    });
  }
  return loadFateKnotsState(api);
}

export function refreshFateKnotsState(
  api: RoomApi,
  contentRegistry: FateKnotsContentRegistry
): FateKnotsHostState {
  return pushFateKnotsState(api, loadFateKnotsState(api), contentRegistry);
}
