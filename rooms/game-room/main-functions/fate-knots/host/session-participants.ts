import type {
  GameRoomContextState,
  GameRoomSlotState,
} from "../../../shared/types/room-shell-contracts.js";
import { FATE_KNOTS_SUPPORTED_AI_SEATS, FATE_KNOTS_SUPPORTED_REMOTE_SEATS } from "./constants.js";
import { normalizeExcludedSeats } from "./models-memory.js";
import { createHeroSelection, createParticipant, type normalizeFateKnotsState } from "./models.js";
import { loadFateKnotsProfile, saveFateKnotsProfile } from "./state.js";

type FateKnotsState = ReturnType<typeof normalizeFateKnotsState>;
type FateKnotsParticipant = ReturnType<typeof createParticipant>;
type FateKnotsSelection = ReturnType<typeof createHeroSelection>;
type FateKnotsDecisionState = NonNullable<FateKnotsState["decision"]>;
type FateKnotsRoomApi = Parameters<typeof loadFateKnotsProfile>[0];

type FateKnotsSelectionIdField = "avatarId" | "classId" | "backgroundId";
type FateKnotsSelectionPayload = Partial<
  Pick<FateKnotsSelection, "avatarId" | "classId" | "backgroundId">
>;
type FateKnotsCatalogEntry = {
  id: string;
};

type FateKnotsContentRegistry = {
  avatarsById: Map<string, unknown>;
  classesById: Map<string, unknown>;
  backgroundsById: Map<string, unknown>;
  selections: {
    avatars: FateKnotsCatalogEntry[];
    classes: FateKnotsCatalogEntry[];
    backgrounds: FateKnotsCatalogEntry[];
  };
};

type FateKnotsProfileLike = {
  avatarId?: unknown;
  classId?: unknown;
  backgroundId?: unknown;
  updatedAt?: unknown;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && Array.isArray(value) === false;
}

function readContextSlot(context: GameRoomContextState, seatId: string): GameRoomSlotState | null {
  if (seatId === "ai1") {
    return context.slots.ai1;
  }
  if (seatId === "ai2") {
    return context.slots.ai2;
  }
  if (seatId === "us1") {
    return context.slots.us1;
  }
  return null;
}

function readCatalogEntryId(entry: FateKnotsCatalogEntry | null): string | null {
  return entry && typeof entry.id === "string" && entry.id !== "" ? entry.id : null;
}

export function getUserParticipant(state: FateKnotsState): FateKnotsParticipant | null {
  return (
    state.participants.find(function (participant: FateKnotsParticipant) {
      return participant.seatId === "user";
    }) || null
  );
}

export function getParticipant(state: FateKnotsState, seatId: string): FateKnotsParticipant | null {
  return (
    state.participants.find(function (participant: FateKnotsParticipant) {
      return participant.seatId === seatId;
    }) || null
  );
}

export function listPendingDecisionSeats(state: FateKnotsState): string[] {
  if (!state.decision) {
    return [];
  }
  const decision: FateKnotsDecisionState = state.decision;
  return decision.participantIds.filter(function (seatId: string) {
    return !decision.votes[seatId];
  });
}

function hashString(value: unknown) {
  const source = String(value || "fate-knots");
  let hash = 0;
  for (let index = 0; index < source.length; index += 1) {
    hash = (hash * 31 + source.charCodeAt(index)) >>> 0;
  }
  return hash;
}

function pickDeterministicEntry<T>(list: T[], seed: string, offset: number): T | null {
  if (!Array.isArray(list) || list.length === 0) {
    return null;
  }
  return list[(hashString(`${seed}:${offset}`) + offset) % list.length] || null;
}

function isKnownSelectionId(
  contentRegistry: FateKnotsContentRegistry,
  fieldName: FateKnotsSelectionIdField,
  value: unknown
): value is string {
  if (typeof value !== "string" || value === "") {
    return false;
  }
  if (fieldName === "avatarId") {
    return contentRegistry.avatarsById.has(value) === true;
  }
  if (fieldName === "classId") {
    return contentRegistry.classesById.has(value) === true;
  }
  return contentRegistry.backgroundsById.has(value) === true;
}

function sanitizeStoredProfile(
  contentRegistry: FateKnotsContentRegistry,
  profile: unknown
): FateKnotsSelection {
  const source: FateKnotsProfileLike = isRecord(profile) ? profile : {};
  const next = createHeroSelection();
  next.avatarId = isKnownSelectionId(contentRegistry, "avatarId", source.avatarId)
    ? source.avatarId
    : null;
  next.classId = isKnownSelectionId(contentRegistry, "classId", source.classId)
    ? source.classId
    : null;
  next.backgroundId = isKnownSelectionId(contentRegistry, "backgroundId", source.backgroundId)
    ? source.backgroundId
    : null;
  next.updatedAt =
    typeof source.updatedAt === "number" && Number.isFinite(source.updatedAt)
      ? source.updatedAt
      : null;
  return next;
}

function buildAutoAssignedSelection(
  contentRegistry: FateKnotsContentRegistry,
  sessionId: string,
  offsetSeed: number
): FateKnotsSelection {
  const avatar = pickDeterministicEntry(contentRegistry.selections.avatars, sessionId, offsetSeed);
  const classDef = pickDeterministicEntry(
    contentRegistry.selections.classes,
    sessionId,
    offsetSeed + 11
  );
  const background = pickDeterministicEntry(
    contentRegistry.selections.backgrounds,
    sessionId,
    offsetSeed + 23
  );

  return {
    avatarId: readCatalogEntryId(avatar),
    classId: readCatalogEntryId(classDef),
    backgroundId: readCatalogEntryId(background),
    locked: true,
    autoAssigned: true,
    updatedAt: Date.now(),
  };
}

export function buildRunParticipants(
  context: GameRoomContextState,
  contentRegistry: FateKnotsContentRegistry,
  sessionId: string,
  profile: unknown,
  remoteUserId: string | null
) {
  const profileSelection = sanitizeStoredProfile(contentRegistry, profile);
  const userParticipant = createParticipant({
    seatId: "user",
    provider: "room-ui",
    type: "local-user",
    nickname: context.user.nickname || "User",
    ready: true,
    connected: true,
    selection: profileSelection,
  });

  const aiParticipants = FATE_KNOTS_SUPPORTED_AI_SEATS.map(function (
    seatId: string,
    index: number
  ) {
    const slot = readContextSlot(context, seatId);
    if (!slot || slot.ready !== true) {
      return null;
    }
    return createParticipant({
      seatId,
      provider: seatId,
      type: "ai",
      nickname: slot.nickname,
      ready: true,
      connected: slot.connected !== false,
      selection: buildAutoAssignedSelection(contentRegistry, sessionId, index),
    });
  }).filter((participant): participant is FateKnotsParticipant => participant !== null);

  const remoteParticipants = FATE_KNOTS_SUPPORTED_REMOTE_SEATS.map(function (
    seatId: string,
    index: number
  ) {
    const slot = readContextSlot(context, seatId);
    if (!slot || slot.ready !== true) {
      return null;
    }
    return createParticipant({
      seatId,
      provider: seatId,
      type: "remote-user",
      nickname: slot.nickname || "Remote",
      ready: true,
      connected: slot.connected !== false,
      selection: buildAutoAssignedSelection(contentRegistry, sessionId, index + 37),
    });
  }).filter((participant): participant is FateKnotsParticipant => participant !== null);

  return {
    participants: [userParticipant, ...aiParticipants, ...remoteParticipants],
    excludedSeats: normalizeExcludedSeats([]),
    transport: {
      localSessionId: null,
      remoteUserId: remoteUserId || null,
    },
  };
}

export function isSelectionComplete(selection: FateKnotsSelection) {
  return !!(selection.avatarId && selection.classId && selection.backgroundId);
}

export function validateSelectionPayload(
  selectionPayload: FateKnotsSelectionPayload,
  contentRegistry: FateKnotsContentRegistry
) {
  if (
    selectionPayload.avatarId &&
    contentRegistry.avatarsById.has(selectionPayload.avatarId) !== true
  ) {
    return false;
  }
  if (
    selectionPayload.classId &&
    contentRegistry.classesById.has(selectionPayload.classId) !== true
  ) {
    return false;
  }
  if (
    selectionPayload.backgroundId &&
    contentRegistry.backgroundsById.has(selectionPayload.backgroundId) !== true
  ) {
    return false;
  }
  return true;
}

export function applySelectionPayload(
  participant: FateKnotsParticipant,
  selectionPayload: FateKnotsSelectionPayload,
  now: number
) {
  participant.selection.avatarId = selectionPayload.avatarId || participant.selection.avatarId;
  participant.selection.classId = selectionPayload.classId || participant.selection.classId;
  participant.selection.backgroundId =
    selectionPayload.backgroundId || participant.selection.backgroundId;
  participant.selection.updatedAt = now;
}

export function persistProfileFromUser(api: FateKnotsRoomApi, state: FateKnotsState) {
  const userParticipant = getUserParticipant(state);
  if (!userParticipant || isSelectionComplete(userParticipant.selection) !== true) {
    return loadFateKnotsProfile(api);
  }
  return saveFateKnotsProfile(api, {
    avatarId: userParticipant.selection.avatarId,
    classId: userParticipant.selection.classId,
    backgroundId: userParticipant.selection.backgroundId,
    updatedAt: Date.now(),
  });
}
