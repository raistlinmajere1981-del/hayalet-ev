import {
  createEmptyForgeRoomSnapshot
} from "./state.js";
function toRecord(value) {
  return value !== null && typeof value === "object" && Array.isArray(value) === false ? value : {};
}
function asNonEmptyString(value, fallback) {
  return typeof value === "string" && value.trim() !== "" ? value.trim() : fallback;
}
export function sanitizeForgeUiContext(payload) {
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
    userNickname: asNonEmptyString(user["nickname"], "Operator")
  };
}
export function sanitizeForgeRoomSnapshot(payload) {
  const source = toRecord(payload);
  const fallback = createEmptyForgeRoomSnapshot();
  return {
    activeSessionId: typeof source["activeSessionId"] === "string" && source["activeSessionId"].trim() !== "" ? source["activeSessionId"] : null,
    currentGoal: source["currentGoal"] !== null && typeof source["currentGoal"] === "object" && Array.isArray(source["currentGoal"]) === false ? source["currentGoal"] : null,
    draftTasks: Array.isArray(source["draftTasks"]) ? source["draftTasks"] : fallback.draftTasks,
    draftSourceText: typeof source["draftSourceText"] === "string" ? source["draftSourceText"] : null,
    validationMessages: Array.isArray(source["validationMessages"]) ? source["validationMessages"].filter(
      (entry) => typeof entry === "string" && entry.trim() !== ""
    ) : fallback.validationMessages,
    decisionTrace: Array.isArray(source["decisionTrace"]) ? source["decisionTrace"].filter(
      (entry) => typeof entry === "string" && entry.trim() !== ""
    ) : fallback.decisionTrace,
    approvedTasks: Array.isArray(source["approvedTasks"]) ? source["approvedTasks"] : fallback.approvedTasks,
    assignments: Array.isArray(source["assignments"]) ? source["assignments"] : fallback.assignments,
    exports: Array.isArray(source["exports"]) ? source["exports"] : fallback.exports,
    exportSummary: source["exportSummary"] !== null && typeof source["exportSummary"] === "object" && Array.isArray(source["exportSummary"]) === false ? source["exportSummary"] : fallback.exportSummary,
    operatorProfile: source["operatorProfile"] !== null && typeof source["operatorProfile"] === "object" && Array.isArray(source["operatorProfile"]) === false ? source["operatorProfile"] : fallback.operatorProfile,
    preflight: source["preflight"] !== null && typeof source["preflight"] === "object" && Array.isArray(source["preflight"]) === false ? source["preflight"] : fallback.preflight,
    responses: Array.isArray(source["responses"]) ? source["responses"] : fallback.responses,
    runOverride: source["runOverride"] !== null && typeof source["runOverride"] === "object" && Array.isArray(source["runOverride"]) === false ? source["runOverride"] : fallback.runOverride,
    runSignature: source["runSignature"] !== null && typeof source["runSignature"] === "object" && Array.isArray(source["runSignature"]) === false ? source["runSignature"] : fallback.runSignature,
    conflicts: Array.isArray(source["conflicts"]) ? source["conflicts"] : fallback.conflicts,
    syntheses: Array.isArray(source["syntheses"]) ? source["syntheses"] : fallback.syntheses,
    selectedSynthesisId: typeof source["selectedSynthesisId"] === "string" && source["selectedSynthesisId"].trim() !== "" ? source["selectedSynthesisId"] : null,
    coordinatorState: source["coordinatorState"] !== null && typeof source["coordinatorState"] === "object" && Array.isArray(source["coordinatorState"]) === false ? source["coordinatorState"] : fallback.coordinatorState,
    sessionList: Array.isArray(source["sessionList"]) ? source["sessionList"] : fallback.sessionList
  };
}
