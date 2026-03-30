import { normalizeText } from "../../../shared/host/text.js";

export function readFateKnotsArgs(payload: unknown) {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    return {};
  }
  const obj = payload as Record<string, unknown>;
  if (
    obj["roomArgs"] &&
    typeof obj["roomArgs"] === "object" &&
    Array.isArray(obj["roomArgs"]) === false
  ) {
    return obj["roomArgs"];
  }
  return payload;
}

export function resolveFateKnotsSeatId(payload: unknown) {
  const obj = payload && typeof payload === "object" ? (payload as Record<string, unknown>) : {};
  const provider = normalizeText(obj["provider"]);
  if (provider === "room-ui") {
    return "user";
  }
  if (provider === "ai1" || provider === "ai2" || provider === "us1") {
    return provider;
  }
  const args = readFateKnotsArgs(payload) as Record<string, unknown>;
  const seatId = normalizeText(args["seatId"]);
  if (seatId === "user" || seatId === "ai1" || seatId === "ai2" || seatId === "us1") {
    return seatId;
  }
  return null;
}

export function readFateKnotsSelectionPayload(payload: unknown) {
  const args = readFateKnotsArgs(payload) as Record<string, unknown>;
  return {
    avatarId: normalizeText(args["avatarId"]) || null,
    classId: normalizeText(args["classId"]) || null,
    backgroundId: normalizeText(args["backgroundId"]) || null,
  };
}

export function readFateKnotsChoicePayload(payload: unknown) {
  const args = readFateKnotsArgs(payload) as Record<string, unknown>;
  return {
    sessionId: normalizeText(args["sessionId"]) || null,
    stepId: normalizeText(args["stepId"]) || null,
    choiceId: normalizeText(args["choiceId"]) || null,
  };
}

export function readFateKnotsCombatPayload(payload: unknown) {
  const args = readFateKnotsArgs(payload) as Record<string, unknown>;
  return {
    sessionId: normalizeText(args["sessionId"]) || null,
    encounterId: normalizeText(args["encounterId"]) || null,
    turnId: normalizeText(args["turnId"]) || null,
    actionId: normalizeText(args["actionId"]) || null,
  };
}

export function readFateKnotsSyncPayload(payload: unknown) {
  const args = readFateKnotsArgs(payload) as Record<string, unknown>;
  return {
    sessionId: normalizeText(args["sessionId"]) || null,
    mode: normalizeText(args["mode"]) || null,
  };
}

export function readFateKnotsDmPacketPayload(payload: unknown) {
  const args = readFateKnotsArgs(payload) as Record<string, unknown>;
  return {
    sessionId: normalizeText(args["sessionId"]) || null,
    phase: normalizeText(args["phase"]) || null,
    stepId: normalizeText(args["stepId"]) || null,
    encounterId: normalizeText(args["encounterId"]) || null,
    turnId: normalizeText(args["turnId"]) || null,
    text: normalizeText(args["text"]),
  };
}

export function readFateKnotsNpcBanterPayload(payload: unknown) {
  const args = readFateKnotsArgs(payload) as Record<string, unknown>;
  return {
    sessionId: normalizeText(args["sessionId"]) || null,
    phase: normalizeText(args["phase"]) || null,
    seatId: normalizeText(args["seatId"]) || null,
    stepId: normalizeText(args["stepId"]) || null,
    encounterId: normalizeText(args["encounterId"]) || null,
    turnId: normalizeText(args["turnId"]) || null,
    text: normalizeText(args["text"]),
  };
}
