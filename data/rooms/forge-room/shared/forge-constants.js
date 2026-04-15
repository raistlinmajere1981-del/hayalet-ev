export const FORGE_ROOM_ID = "forge-room";
export const FORGE_WORKBENCH_FEATURE_ID = "forge-workbench";
export const FORGE_TARGET_ROOM_ID = "repair-room";
export const FORGE_SESSION_SCHEMA_VERSION = 2;
export const FORGE_HANDOFF_SCHEMA_VERSION = 1;
export const FORGE_BREAKDOWN_MIN_TASKS = 3;
export const FORGE_BREAKDOWN_MAX_TASKS = 7;
export const FORGE_BREAKDOWN_MAX_REGENERATIONS = 1;
export const FORGE_UI_COMMANDS = {
  applyDraftText: "ForgeRoomApplyDraftText",
  approveDraft: "ForgeRoomApproveDraft",
  createSession: "ForgeRoomCreateSession",
  dispatchAssignments: "ForgeRoomDispatchAssignments",
  exportHandoff: "ForgeRoomExportHandoff",
  exportHandoffCheck: "ForgeRoomExportHandoffCheck",
  generateDraft: "ForgeRoomGenerateDraft",
  generateSynthesis: "ForgeRoomGenerateSynthesis",
  loadLatestSession: "ForgeRoomLoadLatestSession",
  removeDraftTask: "ForgeRoomRemoveDraftTask",
  resolveConflict: "ForgeRoomResolveConflict",
  saveSession: "ForgeRoomSaveSession",
  selectSynthesis: "ForgeRoomSelectSynthesis",
  uiReady: "ForgeRoomUiReady",
  updateApprovedTask: "ForgeRoomUpdateApprovedTask",
  upsertDraftTask: "ForgeRoomUpsertDraftTask",
  updateGoal: "ForgeRoomUpdateGoal"
};
export const FORGE_PROTOCOL_KEYS = {
  breakdownArchitect: "forge-room-breakdown-architect",
  synthesis: "forge-room-synthesis",
  taskResponse: "forge-room-task-response"
};
export const FORGE_PROTOCOL_SCENARIOS = {
  breakdownArchitect: "forge-workbench-breakdown-architect",
  synthesis: "forge-workbench-synthesis",
  taskResponse: "forge-workbench-task-response"
};
