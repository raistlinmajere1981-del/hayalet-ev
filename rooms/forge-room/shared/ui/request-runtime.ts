import { FORGE_UI_COMMANDS } from "../forge-constants.js";

type ForgeRoomApi = NonNullable<typeof window.roomAPI>;

function getRoomApi(): ForgeRoomApi | null {
  return window.roomAPI ?? null;
}

function sendCommand(command: string, payload: Record<string, unknown> = {}): boolean {
  const roomApi = getRoomApi();
  if (roomApi === null || typeof roomApi.sendCommand !== "function") {
    return false;
  }
  return roomApi.sendCommand(command, payload);
}

export function createForgeUiRequestRuntime() {
  return {
    applyDraftText(payload: { draftText: string }) {
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
    generateDraft(payload: {
      brief: string;
      constraints: string[];
      summary: string;
      targetRoomId: string;
    }) {
      return sendCommand(FORGE_UI_COMMANDS.generateDraft, payload);
    },
    generateSynthesis() {
      return sendCommand(FORGE_UI_COMMANDS.generateSynthesis);
    },
    loadLatestSession() {
      return sendCommand(FORGE_UI_COMMANDS.loadLatestSession);
    },
    removeDraftTask(payload: { taskId: string }) {
      return sendCommand(FORGE_UI_COMMANDS.removeDraftTask, payload);
    },
    notifyUiReady() {
      return sendCommand(FORGE_UI_COMMANDS.uiReady);
    },
    saveSession() {
      return sendCommand(FORGE_UI_COMMANDS.saveSession);
    },
    selectSynthesis(payload: { synthesisId: string }) {
      return sendCommand(FORGE_UI_COMMANDS.selectSynthesis, payload);
    },
    updateApprovedTask(payload: {
      compareSeatIds: string[];
      dispatchMode: string;
      personaPresetId: string | null;
      roleId: string;
      seatId: string;
      taskId: string;
    }) {
      return sendCommand(FORGE_UI_COMMANDS.updateApprovedTask, payload);
    },
    upsertDraftTask(payload: {
      checklist: string[];
      compareSeatIds: string[];
      dispatchMode: string;
      personaPresetId: string | null;
      roleId: string;
      seatId: string;
      summary: string;
      taskId?: string;
      title: string;
    }) {
      return sendCommand(FORGE_UI_COMMANDS.upsertDraftTask, payload);
    },
    updateGoal(payload: {
      brief: string;
      constraints: string[];
      summary: string;
      targetRoomId: string;
    }) {
      return sendCommand(FORGE_UI_COMMANDS.updateGoal, payload);
    },
  };
}
