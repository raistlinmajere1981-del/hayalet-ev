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
    notifyUiReady() {
      return sendCommand(FORGE_UI_COMMANDS.uiReady);
    },
    runPreflight() {
      return sendCommand(FORGE_UI_COMMANDS.runPreflight);
    },
    resolveConflict(payload: {
      conflictId: string;
      preferredResponseId?: string | null;
      resolutionNote?: string | null;
      status: "open" | "resolved";
    }) {
      return sendCommand(FORGE_UI_COMMANDS.resolveConflict, payload);
    },
    removeDraftTask(payload: { taskId: string }) {
      return sendCommand(FORGE_UI_COMMANDS.removeDraftTask, payload);
    },
    saveSession() {
      return sendCommand(FORGE_UI_COMMANDS.saveSession);
    },
    selectSynthesis(payload: { synthesisId: string }) {
      return sendCommand(FORGE_UI_COMMANDS.selectSynthesis, payload);
    },
    updateContextCapsule(payload: {
      constraints: string[];
      relevantModules: string[];
      summary: string;
      taskId: string;
    }) {
      return sendCommand(FORGE_UI_COMMANDS.updateContextCapsule, payload);
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
    updateOperatorProfile(payload: {
      preferences: {
        mode: string | null;
        riskTolerance: string | null;
      };
      skill: {
        level: string | null;
        mechanical: string | null;
        measurement: string | null;
        soldering: string | null;
      };
      tools: {
        benchPowerSupply: boolean | null;
        hotAir: boolean | null;
        magnification: boolean | null;
        multimeter: boolean | null;
        solderingIron: boolean | null;
      };
    }) {
      return sendCommand(FORGE_UI_COMMANDS.updateOperatorProfile, payload);
    },
    updateSessionContext(payload: {
      preferences?: {
        mode?: boolean;
        riskTolerance?: boolean;
      };
      skill?: {
        level?: boolean;
        mechanical?: boolean;
        measurement?: boolean;
        soldering?: boolean;
      };
      tools?: {
        benchPowerSupply?: boolean;
        hotAir?: boolean;
        magnification?: boolean;
        multimeter?: boolean;
        solderingIron?: boolean;
      };
    }) {
      return sendCommand(FORGE_UI_COMMANDS.updateSessionContext, payload);
    },
    updateRunOverride(payload: {
      enableRovoPreAnalysis: boolean;
      notes: string;
      tools: {
        hotAir?: boolean;
      };
    }) {
      return sendCommand(FORGE_UI_COMMANDS.updateRunOverride, payload);
    },
  };
}
