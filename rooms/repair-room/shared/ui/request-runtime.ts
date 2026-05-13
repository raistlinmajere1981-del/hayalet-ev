import { REPAIR_UI_COMMANDS } from "../repair-constants.js";
import type { RepairImageRect, RepairOverlayEntityRef } from "../types/index.js";

type RepairRoomApi = NonNullable<typeof window.roomAPI>;

function getRoomApi(): RepairRoomApi | null {
  return window.roomAPI ?? null;
}

function sendCommand(command: string, payload: Record<string, unknown> = {}): boolean {
  const roomApi = getRoomApi();
  if (roomApi === null || typeof roomApi.sendCommand !== "function") {
    return false;
  }
  return roomApi.sendCommand(command, payload);
}

export function createRepairUiRequestRuntime() {
  return {
    notifyUiReady() {
      return sendCommand(REPAIR_UI_COMMANDS.uiReady);
    },
    activateSession(payload: { sessionId: string }) {
      return sendCommand(REPAIR_UI_COMMANDS.activateSession, payload);
    },
    createSession(payload: Record<string, unknown> = {}) {
      return sendCommand(REPAIR_UI_COMMANDS.createSession, payload);
    },
    updateSession(payload: Record<string, unknown>) {
      return sendCommand(REPAIR_UI_COMMANDS.updateSession, payload);
    },
    archiveSession(payload: { sessionId: string }) {
      return sendCommand(REPAIR_UI_COMMANDS.archiveSession, payload);
    },
    advanceWizard(payload: { step?: string } = {}) {
      return sendCommand(REPAIR_UI_COMMANDS.advanceWizard, payload);
    },
    attachKnowledgePack(payload: { packId: string }) {
      return sendCommand(REPAIR_UI_COMMANDS.attachKnowledgePack, payload);
    },
    setActiveTool(payload: { tool: string }) {
      return sendCommand(REPAIR_UI_COMMANDS.setActiveTool, payload);
    },
    toggleFreezeFrame() {
      return sendCommand(REPAIR_UI_COMMANDS.toggleFreezeFrame);
    },
    toggleOverlayLayer(payload: { layerId: string; visible: boolean }) {
      return sendCommand(REPAIR_UI_COMMANDS.toggleOverlayLayer, payload);
    },
    addTimelineEvent(payload: Record<string, unknown>) {
      return sendCommand(REPAIR_UI_COMMANDS.addTimelineEvent, payload);
    },
    jumpToEvent(payload: { eventId: string }) {
      return sendCommand(REPAIR_UI_COMMANDS.jumpToEvent, payload);
    },
    scrubTimeline(payload: { positionMs: number }) {
      return sendCommand(REPAIR_UI_COMMANDS.scrubTimeline, payload);
    },
    addMeasurement(payload: Record<string, unknown>) {
      return sendCommand(REPAIR_UI_COMMANDS.addMeasurement, payload);
    },
    dismissAiMark(payload: { eventId: string; state?: string; reason?: string }) {
      return sendCommand(REPAIR_UI_COMMANDS.dismissAiMark, payload);
    },
    sendChatTurn(payload: { text: string }) {
      return sendCommand(REPAIR_UI_COMMANDS.sendChatTurn, payload);
    },
    updateOperatorProfile(payload: Record<string, unknown>) {
      return sendCommand(REPAIR_UI_COMMANDS.updateOperatorProfile, payload);
    },
    updateViewport(payload: Record<string, unknown>) {
      return sendCommand(REPAIR_UI_COMMANDS.updateViewport, payload);
    },
    updateTimeline(payload: Record<string, unknown>) {
      return sendCommand(REPAIR_UI_COMMANDS.updateTimeline, payload);
    },
    updatePanelLayout(payload: Record<string, unknown>) {
      return sendCommand(REPAIR_UI_COMMANDS.updatePanelLayout, payload);
    },
    updatePanelTab(payload: Record<string, unknown>) {
      return sendCommand(REPAIR_UI_COMMANDS.updatePanelTab, payload);
    },
    updateFocus(payload: Record<string, unknown>) {
      return sendCommand(REPAIR_UI_COMMANDS.updateFocus, payload);
    },
    updateLayout(payload: Record<string, unknown>) {
      return sendCommand(REPAIR_UI_COMMANDS.updateLayout, payload);
    },
    toggleInvestigationMode(payload: { enabled?: boolean } = {}) {
      return sendCommand(REPAIR_UI_COMMANDS.toggleInvestigationMode, payload);
    },
    selectOverlayEntities(payload: {
      refs: RepairOverlayEntityRef[];
      mode?: "replace" | "add" | "toggle";
      inspectorRef?: RepairOverlayEntityRef | null;
      focusJump?: boolean;
    }) {
      return sendCommand(REPAIR_UI_COMMANDS.selectOverlayEntities, payload);
    },
    focusOverlayEntity(payload: { ref: RepairOverlayEntityRef; focusJump?: boolean }) {
      return sendCommand(REPAIR_UI_COMMANDS.focusOverlayEntity, payload);
    },
    focusInvestigationRegion(payload: { regionId: string }) {
      return sendCommand(REPAIR_UI_COMMANDS.focusInvestigationRegion, payload);
    },
    focusKnowledgeSpatialRef(payload: { spatialRefId: string }) {
      return sendCommand(REPAIR_UI_COMMANDS.focusKnowledgeSpatialRef, payload);
    },
    promoteKnowledgeRegion(payload: {
      spatialRefId: string;
      label?: string;
      region?: RepairImageRect;
    }) {
      return sendCommand(REPAIR_UI_COMMANDS.promoteKnowledgeRegion, payload);
    },
    focusLiveEdge() {
      return sendCommand(REPAIR_UI_COMMANDS.focusLiveEdge);
    },
  };
}
