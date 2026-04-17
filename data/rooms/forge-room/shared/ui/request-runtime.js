import { FORGE_UI_COMMANDS } from "../forge-constants.js";
function getRoomApi() {
  return window.roomAPI ?? null;
}
function sendCommand(command, payload = {}) {
  const roomApi = getRoomApi();
  if (roomApi === null || typeof roomApi.sendCommand !== "function") {
    return false;
  }
  return roomApi.sendCommand(command, payload);
}
export function createForgeUiRequestRuntime() {
  return {
    applyDraftText(payload) {
      return sendCommand(FORGE_UI_COMMANDS.applyDraftText, payload);
    },
    approveDraft() {
      return sendCommand(FORGE_UI_COMMANDS.approveDraft);
    },
    createSession(payload = {}) {
      return sendCommand(FORGE_UI_COMMANDS.createSession, payload);
    },
    dispatchAssignments() {
      return sendCommand(FORGE_UI_COMMANDS.dispatchAssignments);
    },
    deleteSession(payload) {
      return sendCommand(FORGE_UI_COMMANDS.deleteSession, payload);
    },
    exportHandoff() {
      return sendCommand(FORGE_UI_COMMANDS.exportHandoff);
    },
    exportHandoffCheck() {
      return sendCommand(FORGE_UI_COMMANDS.exportHandoffCheck);
    },
    generateDraft(payload) {
      return sendCommand(FORGE_UI_COMMANDS.generateDraft, payload);
    },
    generateSynthesis() {
      return sendCommand(FORGE_UI_COMMANDS.generateSynthesis);
    },
    loadSession(payload) {
      return sendCommand(FORGE_UI_COMMANDS.loadSession, payload);
    },
    loadLatestSession() {
      return sendCommand(FORGE_UI_COMMANDS.loadLatestSession);
    },
    notifyUiReady() {
      return sendCommand(FORGE_UI_COMMANDS.uiReady);
    },
    runPreflight() {
      return sendCommand(FORGE_UI_COMMANDS.runPreflight);
    },
    resolveConflict(payload) {
      return sendCommand(FORGE_UI_COMMANDS.resolveConflict, payload);
    },
    removeDraftTask(payload) {
      return sendCommand(FORGE_UI_COMMANDS.removeDraftTask, payload);
    },
    saveSession() {
      return sendCommand(FORGE_UI_COMMANDS.saveSession);
    },
    selectSynthesis(payload) {
      return sendCommand(FORGE_UI_COMMANDS.selectSynthesis, payload);
    },
    updateContextCapsule(payload) {
      return sendCommand(FORGE_UI_COMMANDS.updateContextCapsule, payload);
    },
    updateApprovedTask(payload) {
      return sendCommand(FORGE_UI_COMMANDS.updateApprovedTask, payload);
    },
    upsertDraftTask(payload) {
      return sendCommand(FORGE_UI_COMMANDS.upsertDraftTask, payload);
    },
    updateGoal(payload) {
      return sendCommand(FORGE_UI_COMMANDS.updateGoal, payload);
    },
    updateOperatorProfile(payload) {
      return sendCommand(FORGE_UI_COMMANDS.updateOperatorProfile, payload);
    },
    updateSessionContext(payload) {
      return sendCommand(FORGE_UI_COMMANDS.updateSessionContext, payload);
    },
    updateRunOverride(payload) {
      return sendCommand(FORGE_UI_COMMANDS.updateRunOverride, payload);
    }
  };
}
