import { FEATURE_ID, ROOM_ID } from "../../../shared/host/feature-meta.js";
import { normalizeText } from "../../../shared/host/text.js";
function isRecord(value) {
  return typeof value === "object" && value !== null && Array.isArray(value) === false;
}
export function normalizeInviteEntry(candidate) {
  const source = isRecord(candidate) ? candidate : {};
  const inviteId = normalizeText(source["inviteId"]) || normalizeText(source["matchId"]);
  const matchId = normalizeText(source["matchId"]) || inviteId;
  return {
    roomId: normalizeText(source["roomId"]),
    featureId: normalizeText(source["featureId"]),
    inviteId,
    matchId,
    remoteUserId: normalizeText(source["remoteUserId"]),
    nickname: normalizeText(source["nickname"]) || normalizeText(source["senderNickname"]) || "US1",
    senderEmail: normalizeText(source["senderEmail"]),
    note: normalizeText(source["note"]),
    starter: source["starter"] === "opponent" ? "opponent" : "user",
    localSessionId: normalizeText(source["localSessionId"]),
    conversationId: normalizeText(source["conversationId"]),
    transportMessageId: normalizeText(source["transportMessageId"]),
    sentAt: typeof source["sentAt"] === "number" && Number.isFinite(source["sentAt"]) && source["sentAt"] >= 0 ? Math.trunc(source["sentAt"]) : null
  };
}
export function normalizeInviteInbox(value) {
  if (!Array.isArray(value)) {
    return [];
  }
  return value.map((entry) => normalizeInviteEntry(entry)).filter((entry) => entry.matchId !== "" && entry.remoteUserId !== "");
}
export function normalizePendingInvite(value) {
  if (isRecord(value) === false) {
    return null;
  }
  const source = value;
  const matchId = normalizeText(source["matchId"]) || normalizeText(source["inviteId"]);
  const remoteUserId = normalizeText(source["remoteUserId"]);
  if (matchId === "" || remoteUserId === "") {
    return null;
  }
  return {
    direction: source["direction"] === "incoming" ? "incoming" : "outgoing",
    inviteId: matchId,
    matchId,
    remoteUserId,
    nickname: normalizeText(source["nickname"]) || "US1",
    note: normalizeText(source["note"]),
    starter: source["starter"] === "opponent" ? "opponent" : "user",
    localSessionId: normalizeText(source["localSessionId"]),
    conversationId: normalizeText(source["conversationId"])
  };
}
export function createPendingInvite(direction, inviteEntry) {
  const source = isRecord(inviteEntry) ? inviteEntry : {};
  const matchId = normalizeText(source["matchId"]) || normalizeText(source["inviteId"]);
  return {
    direction: direction === "incoming" ? "incoming" : "outgoing",
    roomId: normalizeText(source["roomId"]) || ROOM_ID,
    featureId: normalizeText(source["featureId"]) || FEATURE_ID,
    inviteId: matchId,
    matchId,
    remoteUserId: normalizeText(source["remoteUserId"]),
    nickname: normalizeText(source["nickname"]) || "US1",
    note: normalizeText(source["note"]),
    starter: source["starter"] === "opponent" ? "opponent" : "user",
    localSessionId: normalizeText(source["localSessionId"]),
    conversationId: normalizeText(source["conversationId"])
  };
}
