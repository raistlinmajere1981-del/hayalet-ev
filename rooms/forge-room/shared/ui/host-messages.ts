import {
  createEmptyForgeRoomSnapshot,
  type ForgeRoomSnapshot,
  type ForgeUiContextState,
} from "./state.js";

type ForgeUnknownRecord = Record<string, unknown>;

function toRecord(value: unknown): ForgeUnknownRecord {
  return value !== null && typeof value === "object" && Array.isArray(value) === false
    ? (value as ForgeUnknownRecord)
    : {};
}

function asNonEmptyString(value: unknown, fallback: string): string {
  return typeof value === "string" && value.trim() !== "" ? value.trim() : fallback;
}

export type ForgeHostMessage =
  | {
      type: "forge-state";
      snapshot?: unknown;
      meta?: unknown;
    }
  | {
      type: "host-context";
      [key: string]: unknown;
    }
  | {
      type: "command-result";
      command?: unknown;
      result?: unknown;
    };

export function sanitizeForgeUiContext(payload: unknown): ForgeUiContextState {
  const source = toRecord(payload);
  const room = toRecord(source["room"]);
  const user = toRecord(source["user"]);
  const activeFeature = toRecord(source["activeFeature"]);
  return {
    roomId: asNonEmptyString(room["id"], "forge-room"),
    roomName: asNonEmptyString(room["name"], "Forge Room"),
    featureId: asNonEmptyString(activeFeature["id"], "forge-workbench"),
    locale: asNonEmptyString(source["locale"], "en"),
    translations: toRecord(source["translations"]),
    userNickname: asNonEmptyString(user["nickname"], "Operator"),
  };
}

export function sanitizeForgeRoomSnapshot(payload: unknown): ForgeRoomSnapshot {
  const source = toRecord(payload);
  const fallback = createEmptyForgeRoomSnapshot();
  return {
    activeSessionId:
      typeof source["activeSessionId"] === "string" && source["activeSessionId"].trim() !== ""
        ? source["activeSessionId"]
        : null,
    currentGoal:
      source["currentGoal"] !== null &&
      typeof source["currentGoal"] === "object" &&
      Array.isArray(source["currentGoal"]) === false
        ? (source["currentGoal"] as ForgeRoomSnapshot["currentGoal"])
        : null,
    draftTasks: Array.isArray(source["draftTasks"])
      ? (source["draftTasks"] as ForgeRoomSnapshot["draftTasks"])
      : fallback.draftTasks,
    draftSourceText:
      typeof source["draftSourceText"] === "string" ? source["draftSourceText"] : null,
    validationMessages: Array.isArray(source["validationMessages"])
      ? source["validationMessages"].filter(
          (entry): entry is string => typeof entry === "string" && entry.trim() !== ""
        )
      : fallback.validationMessages,
    decisionTrace: Array.isArray(source["decisionTrace"])
      ? source["decisionTrace"].filter(
          (entry): entry is string => typeof entry === "string" && entry.trim() !== ""
        )
      : fallback.decisionTrace,
    approvedTasks: Array.isArray(source["approvedTasks"])
      ? (source["approvedTasks"] as ForgeRoomSnapshot["approvedTasks"])
      : fallback.approvedTasks,
    assignments: Array.isArray(source["assignments"])
      ? (source["assignments"] as ForgeRoomSnapshot["assignments"])
      : fallback.assignments,
    exports: Array.isArray(source["exports"])
      ? (source["exports"] as ForgeRoomSnapshot["exports"])
      : fallback.exports,
    exportSummary:
      source["exportSummary"] !== null &&
      typeof source["exportSummary"] === "object" &&
      Array.isArray(source["exportSummary"]) === false
        ? (source["exportSummary"] as ForgeRoomSnapshot["exportSummary"])
        : fallback.exportSummary,
    operatorProfile:
      source["operatorProfile"] !== null &&
      typeof source["operatorProfile"] === "object" &&
      Array.isArray(source["operatorProfile"]) === false
        ? (source["operatorProfile"] as ForgeRoomSnapshot["operatorProfile"])
        : fallback.operatorProfile,
    preflight:
      source["preflight"] !== null &&
      typeof source["preflight"] === "object" &&
      Array.isArray(source["preflight"]) === false
        ? (source["preflight"] as ForgeRoomSnapshot["preflight"])
        : fallback.preflight,
    responses: Array.isArray(source["responses"])
      ? (source["responses"] as ForgeRoomSnapshot["responses"])
      : fallback.responses,
    sessionContextSelection:
      source["sessionContextSelection"] !== null &&
      typeof source["sessionContextSelection"] === "object" &&
      Array.isArray(source["sessionContextSelection"]) === false
        ? (source["sessionContextSelection"] as ForgeRoomSnapshot["sessionContextSelection"])
        : fallback.sessionContextSelection,
    runOverride:
      source["runOverride"] !== null &&
      typeof source["runOverride"] === "object" &&
      Array.isArray(source["runOverride"]) === false
        ? (source["runOverride"] as ForgeRoomSnapshot["runOverride"])
        : fallback.runOverride,
    runSignature:
      source["runSignature"] !== null &&
      typeof source["runSignature"] === "object" &&
      Array.isArray(source["runSignature"]) === false
        ? (source["runSignature"] as ForgeRoomSnapshot["runSignature"])
        : fallback.runSignature,
    conflicts: Array.isArray(source["conflicts"])
      ? (source["conflicts"] as ForgeRoomSnapshot["conflicts"])
      : fallback.conflicts,
    syntheses: Array.isArray(source["syntheses"])
      ? (source["syntheses"] as ForgeRoomSnapshot["syntheses"])
      : fallback.syntheses,
    selectedSynthesisId:
      typeof source["selectedSynthesisId"] === "string" &&
      source["selectedSynthesisId"].trim() !== ""
        ? source["selectedSynthesisId"]
        : null,
    coordinatorState:
      source["coordinatorState"] !== null &&
      typeof source["coordinatorState"] === "object" &&
      Array.isArray(source["coordinatorState"]) === false
        ? (source["coordinatorState"] as ForgeRoomSnapshot["coordinatorState"])
        : fallback.coordinatorState,
    sessionList: Array.isArray(source["sessionList"])
      ? (source["sessionList"] as ForgeRoomSnapshot["sessionList"])
      : fallback.sessionList,
  };
}
