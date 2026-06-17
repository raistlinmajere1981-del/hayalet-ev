import type { RepairPanelId } from "../../shared/types/index.js";
import type { RepairUiSnapshotMeta, RepairUiState } from "../../shared/ui/state.js";

export function buildRepairPanelSignature(params: {
  meta: RepairUiSnapshotMeta;
  panelId: RepairPanelId;
  state: RepairUiState;
}): string {
  const { meta, panelId, state } = params;
  const timelineShape = state.workbench.timeline;
  const timelineLiveWindow = timelineShape.autoFollowLive
    ? Math.floor((timelineShape.playheadMs + 10000) / 10000)
    : 0;
  const layoutShape = {
    collapsed: state.layout.collapsedPanels[panelId],
    pinned: state.layout.pinnedPanels[panelId],
    visibility: state.guidance.panelVisibility.panels[panelId],
    primarySurface: state.guidance.panelVisibility.primarySurface,
    operationalProfile: state.guidance.operationalProfile,
    interactionSettings: state.layout.interactionSettings,
    settingsOverlayOpen: state.layout.settingsOverlayOpen,
    settingsOverlayTabId: state.layout.settingsOverlayTabId,
  };
  const guidanceShape = {
    phase: state.guidance.investigationPhase,
    nextBestAction: state.guidance.nextBestAction.text,
    recovery: state.guidance.recovery,
    aiInterruption: state.guidance.aiInterruption,
    focusCorridor: state.guidance.focusCorridor,
    rhythm: state.guidance.rhythm,
    voice: state.guidance.voice,
    feedDensity: state.guidance.panelVisibility.tacticalFeedDensity,
  };
  switch (panelId) {
    case "session-rail":
      return JSON.stringify({
        aid: state.sessions.activeId,
        list: state.sessions.list,
        wizard: state.wizard,
        layoutShape,
      });
    case "workbench-stage":
      return JSON.stringify({
        sessionImage: state.sessions.detail?.pcbImage?.src ?? null,
        sessionImageLabel: state.sessions.detail?.pcbImage?.label ?? null,
        tool: state.workbench.activeTool,
        frozen: state.workbench.isFrozen,
        frozenAt: state.workbench.frozenAt,
        contextualCursor: state.workbench.contextualCursor,
        operationalMode: state.workbench.operationalMode,
        investigationModeEnabled: state.workbench.investigationModeEnabled,
        liveSource: state.workbench.liveSource,
        viewport: state.workbench.viewport,
        layers: state.workbench.visibleLayers,
        cursor: state.workbench.cursor,
        operationsAvailable: state.operationsAvailable,
        operations: state.operations,
        voiceReadiness: state.voiceReadiness,
        guidanceShape,
        layoutShape,
      });
    case "tactical-feed":
      return JSON.stringify({
        aiDispatch: state.aiDispatch,
        feed: state.tacticalFeed.map((item) => [
          item.eventId,
          item.occurredAt,
          item.relativeLabel,
          item.severity,
          item.badge,
          item.body,
        ]),
        focusedEventId: state.workbench.focusedEventId,
        guidanceShape,
        layoutShape,
      });
    case "session-wizard":
      return JSON.stringify({ wizard: state.wizard, guidanceShape, layoutShape });
    case "knowledge-pack":
      return JSON.stringify({ knowledgePack: state.knowledgePack, guidanceShape, layoutShape });
    case "visual-timeline":
      return JSON.stringify({
        phase: state.phase,
        focusedEventId: state.workbench.focusedEventId,
        timelineShape: {
          zoom: timelineShape.zoom,
          rangeStartMs: timelineShape.rangeStartMs,
          rangeEndMs: timelineShape.rangeEndMs,
          autoFollowLive: timelineShape.autoFollowLive,
          isPlaying: timelineShape.isPlaying,
          replayMode: timelineShape.replayMode,
          replaySpeed: timelineShape.replaySpeed,
          liveWindow: timelineLiveWindow,
        },
        events: meta.events.map((event) => [event.id, event.kind, event.occurredAt]),
        imageSrc: state.sessions.detail?.pcbImage?.src ?? null,
        guidanceShape,
        layoutShape,
      });
    case "operator-profile":
      return JSON.stringify({
        profile: state.operatorProfile,
        operatorProfileTabId: state.layout.operatorProfileTabId,
        layoutShape,
      });
    case "repair-settings":
      return JSON.stringify({
        voiceGuidance: state.layout.voiceGuidance,
        interactionSettings: state.layout.interactionSettings,
        attentionBudget: state.layout.attentionBudget,
        operationsAvailable: state.operationsAvailable,
        operations: state.operations,
        voiceReadiness: state.voiceReadiness,
        guidanceShape,
        layoutShape,
      });
    case "chat":
      return JSON.stringify({ chat: state.chat, guidanceShape, layoutShape });
    case "measurement":
      return JSON.stringify({
        measurementShape: {
          activeInstrumentKind: state.measurement.activeInstrumentKind,
          instrumentId: state.measurement.current.instrumentId,
          kind: state.measurement.current.kind,
          label: state.measurement.current.label,
          mode: state.measurement.current.mode,
          range: state.measurement.current.range,
          hold: state.measurement.current.hold,
        },
        guidanceShape,
        layoutShape,
      });
    case "room-sync":
      return JSON.stringify({
        phase: state.phase,
        activeId: state.sessions.activeId,
        aiDispatch: state.aiDispatch,
        focusedEventId: state.workbench.focusedEventId,
        timelineShape: {
          liveWindow: timelineLiveWindow,
        },
        events: meta.events.length,
        latestEventId: meta.events.at(-1)?.id ?? null,
        guidanceShape,
        layoutShape,
      });
    default: {
      const exhaustivePanelId: never = panelId;
      return JSON.stringify({ panelId: exhaustivePanelId, layoutShape });
    }
  }
}
