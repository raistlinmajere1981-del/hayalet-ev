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
    createSession() {
      return sendCommand(FORGE_UI_COMMANDS.createSession);
    },
    dispatchAssignments() {
      return sendCommand(FORGE_UI_COMMANDS.dispatchAssignments);
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
    loadLatestSession() {
      return sendCommand(FORGE_UI_COMMANDS.loadLatestSession);
    },
    removeDraftTask(payload) {
      return sendCommand(FORGE_UI_COMMANDS.removeDraftTask, payload);
    },
    notifyUiReady() {
      return sendCommand(FORGE_UI_COMMANDS.uiReady);
    },
    saveSession() {
      return sendCommand(FORGE_UI_COMMANDS.saveSession);
    },
    selectSynthesis(payload) {
      return sendCommand(FORGE_UI_COMMANDS.selectSynthesis, payload);
    },
    updateApprovedTask(payload) {
      return sendCommand(FORGE_UI_COMMANDS.updateApprovedTask, payload);
    },
    upsertDraftTask(payload) {
      return sendCommand(FORGE_UI_COMMANDS.upsertDraftTask, payload);
    },
    updateGoal(payload) {
      return sendCommand(FORGE_UI_COMMANDS.updateGoal, payload);
    }
  };
}
