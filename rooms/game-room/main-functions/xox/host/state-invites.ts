import { FEATURE_ID, ROOM_ID } from "../../../shared/host/feature-meta.js";
import { normalizeText } from "../../../shared/host/text.js";

export function normalizeInviteEntry(candidate: any) {
  const source =
    candidate && typeof candidate === "object" && Array.isArray(candidate) === false
      ? candidate
      : {};
  const inviteId = normalizeText(source.inviteId) || normalizeText(source.matchId);
  const matchId = normalizeText(source.matchId) || inviteId;
  return {
    roomId: normalizeText(source.roomId),
    featureId: normalizeText(source.featureId),
    inviteId: inviteId,
    matchId: matchId,
    remoteUserId: normalizeText(source.remoteUserId),
    nickname: normalizeText(source.nickname) || normalizeText(source.senderNickname) || "US1",
    senderEmail: normalizeText(source.senderEmail),
    note: normalizeText(source.note),
    starter: source.starter === "opponent" ? "opponent" : "user",
    localSessionId: normalizeText(source.localSessionId),
    conversationId: normalizeText(source.conversationId),
    transportMessageId: normalizeText(source.transportMessageId),
    sentAt:
      typeof source.sentAt === "number" && Number.isFinite(source.sentAt) && source.sentAt >= 0
        ? Math.trunc(source.sentAt)
        : null,
  };
}

export function normalizeInviteInbox(value: any) {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map(function (entry: any) {
      return normalizeInviteEntry(entry);
    })
    .filter(function (entry: any) {
      return entry.matchId !== "" && entry.remoteUserId !== "";
    });
}

export function normalizePendingInvite(value: any) {
  if (value === null || value === undefined || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }

  const source = value;
  const matchId = normalizeText(source.matchId) || normalizeText(source.inviteId);
  const remoteUserId = normalizeText(source.remoteUserId);
  if (matchId === "" || remoteUserId === "") {
    return null;
  }

  return {
    direction: source.direction === "incoming" ? "incoming" : "outgoing",
    inviteId: matchId,
    matchId: matchId,
    remoteUserId: remoteUserId,
    nickname: normalizeText(source.nickname) || "US1",
    note: normalizeText(source.note),
    starter: source.starter === "opponent" ? "opponent" : "user",
    localSessionId: normalizeText(source.localSessionId),
    conversationId: normalizeText(source.conversationId),
  };
}

export function createPendingInvite(direction: any, inviteEntry: any) {
  const matchId = inviteEntry.matchId || inviteEntry.inviteId;
  return {
    direction: direction === "incoming" ? "incoming" : "outgoing",
    roomId: inviteEntry.roomId || ROOM_ID,
    featureId: inviteEntry.featureId || FEATURE_ID,
    inviteId: matchId,
    matchId: matchId,
    remoteUserId: inviteEntry.remoteUserId,
    nickname: inviteEntry.nickname,
    note: inviteEntry.note,
    starter: inviteEntry.starter,
    localSessionId: inviteEntry.localSessionId,
    conversationId: inviteEntry.conversationId,
  };
}
