import {
  FATE_KNOTS_SUPPORTED_AI_SEATS,
  FATE_KNOTS_SUPPORTED_REMOTE_SEATS,
} from "./constants.js";
import {
  createHeroSelection,
  createParticipant,
} from "./models.js";
import {
  loadFateKnotsProfile,
  saveFateKnotsProfile,
} from "./state.js";

export function getUserParticipant(state) {
  return (
    state.participants.find(function (participant) {
      return participant.seatId === "user";
    }) || null
  );
}

export function getParticipant(state, seatId) {
  return (
    state.participants.find(function (participant) {
      return participant.seatId === seatId;
    }) || null
  );
}

export function listPendingDecisionSeats(state) {
  if (!state.decision) {
    return [];
  }
  return state.decision.participantIds.filter(function (seatId) {
    return !state.decision.votes[seatId];
  });
}

function hashString(value) {
  const source = String(value || "fate-knots");
  let hash = 0;
  for (let index = 0; index < source.length; index += 1) {
    hash = (hash * 31 + source.charCodeAt(index)) >>> 0;
  }
  return hash;
}

function pickDeterministicEntry(list, seed, offset) {
  if (!Array.isArray(list) || list.length === 0) {
    return null;
  }
  return list[(hashString(`${seed}:${offset}`) + offset) % list.length] || null;
}

function isKnownSelectionId(contentRegistry, fieldName, value) {
  if (!value) {
    return false;
  }
  if (fieldName === "avatarId") {
    return contentRegistry.avatarsById.has(value) === true;
  }
  if (fieldName === "classId") {
    return contentRegistry.classesById.has(value) === true;
  }
  if (fieldName === "backgroundId") {
    return contentRegistry.backgroundsById.has(value) === true;
  }
  return false;
}

function sanitizeStoredProfile(contentRegistry, profile) {
  if (!profile || typeof profile !== "object") {
    return createHeroSelection();
  }
  const next = createHeroSelection();
  next.avatarId = isKnownSelectionId(contentRegistry, "avatarId", profile.avatarId)
    ? profile.avatarId
    : null;
  next.classId = isKnownSelectionId(contentRegistry, "classId", profile.classId)
    ? profile.classId
    : null;
  next.backgroundId = isKnownSelectionId(contentRegistry, "backgroundId", profile.backgroundId)
    ? profile.backgroundId
    : null;
  next.updatedAt = typeof profile.updatedAt === "number" ? profile.updatedAt : null;
  return next;
}

function buildAutoAssignedSelection(contentRegistry, sessionId, offsetSeed) {
  const avatar = pickDeterministicEntry(contentRegistry.selections.avatars, sessionId, offsetSeed);
  const classDef = pickDeterministicEntry(contentRegistry.selections.classes, sessionId, offsetSeed + 11);
  const background = pickDeterministicEntry(contentRegistry.selections.backgrounds, sessionId, offsetSeed + 23);
  return {
    avatarId: avatar?.id || null,
    classId: classDef?.id || null,
    backgroundId: background?.id || null,
    locked: true,
    autoAssigned: true,
    updatedAt: Date.now(),
  };
}

export function buildRunParticipants(context, contentRegistry, sessionId, profile, remoteUserId) {
  const profileSelection = sanitizeStoredProfile(contentRegistry, profile);
  const userParticipant = createParticipant({
    seatId: "user",
    provider: "room-ui",
    type: "local-user",
    nickname: context?.user?.nickname || "User",
    ready: true,
    connected: true,
    selection: profileSelection,
  });

  const aiParticipants = FATE_KNOTS_SUPPORTED_AI_SEATS.filter(function (seatId) {
    return context?.slots?.[seatId]?.ready === true;
  }).map(function (seatId, index) {
    const slot = context.slots[seatId];
    return createParticipant({
      seatId,
      provider: seatId,
      type: "ai",
      nickname: slot.nickname,
      ready: slot.ready === true,
      connected: slot.connected !== false,
      selection: buildAutoAssignedSelection(contentRegistry, sessionId, index),
    });
  });

  const remoteParticipants = FATE_KNOTS_SUPPORTED_REMOTE_SEATS.filter(function (seatId) {
    return context?.slots?.[seatId]?.ready === true;
  }).map(function (seatId, index) {
    const slot = context.slots[seatId];
    return createParticipant({
      seatId,
      provider: seatId,
      type: "remote-user",
      nickname: slot.nickname || "Remote",
      ready: slot.ready === true,
      connected: slot.connected !== false,
      selection: buildAutoAssignedSelection(contentRegistry, sessionId, index + 37),
    });
  });

  return {
    participants: [userParticipant, ...aiParticipants, ...remoteParticipants],
    excludedSeats: [],
    transport: {
      localSessionId: null,
      remoteUserId: remoteUserId || null,
    },
  };
}

export function isSelectionComplete(selection) {
  return !!(selection?.avatarId && selection?.classId && selection?.backgroundId);
}

export function validateSelectionPayload(selectionPayload, contentRegistry) {
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

export function applySelectionPayload(participant, selectionPayload, now) {
  participant.selection.avatarId = selectionPayload.avatarId || participant.selection.avatarId;
  participant.selection.classId = selectionPayload.classId || participant.selection.classId;
  participant.selection.backgroundId =
    selectionPayload.backgroundId || participant.selection.backgroundId;
  participant.selection.updatedAt = now;
}

export function persistProfileFromUser(api, state) {
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
