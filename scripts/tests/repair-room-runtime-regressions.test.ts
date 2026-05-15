import test from "node:test";
import assert from "node:assert/strict";
import createRepairRoomHostRuntime from "../../rooms/repair-room/host/runtime.ts";
import {
  createEmptyRepairReplayProjection,
  createRepairReplayProjection,
} from "../../rooms/repair-room/host/state/repair-replay-projection.ts";
import { REPAIR_UI_COMMANDS } from "../../rooms/repair-room/shared/repair-constants.ts";
import { normalizeRepairHostMessage } from "../../rooms/repair-room/shared/ui/host-messages.ts";
import { createRepairDefaultGuidanceProjection } from "../../rooms/repair-room/shared/ui/state.ts";

test("repair-room host exports room-page lifecycle hooks and command registry", () => {
  const notifications: Array<{ type: string; payload?: Record<string, unknown> }> = [];
  const logs: string[] = [];
  const runtime = createRepairRoomHostRuntime().activate({
    log: (_level, message) => {
      logs.push(message);
    },
    notifyRoom: (type, payload) => {
      notifications.push({ type, payload });
    },
  });

  assert.equal(typeof runtime.onRoomReady, "function");
  assert.equal(typeof runtime.commands[REPAIR_UI_COMMANDS.uiReady], "function");
  assert.ok(logs.some((entry) => entry.includes("Repair Room host activated.")));

  runtime.onRoomReady({ stage: "ui-ready" });

  const stateMessage = notifications.find((entry) => entry.type === "repair-state");
  const normalized = normalizeRepairHostMessage({
    type: stateMessage?.type,
    payload: stateMessage?.payload,
  });

  assert.ok(normalized);
  assert.equal(normalized.type, "repair-state");
  assert.equal(normalized.snapshot.sessions.activeId, "psu-2025-0510");
  assert.equal(normalized.snapshot.sessions.list.length, 4);
  assert.ok(normalized.snapshot.sessions.detail?.pcbImage);
  assert.equal(normalized.snapshot.tacticalFeed.length, 2);
  assert.equal(normalized.snapshot.guidance.operationalProfile, "novice");
  assert.equal(normalized.snapshot.guidance.panelVisibility.primarySurface, "measurement");
  assert.equal(normalized.snapshot.guidance.panelVisibility.tacticalFeedDensity, "minimal");
  assert.equal(normalized.snapshot.guidance.panelVisibility.panels.measurement, "expanded");
  assert.equal(normalized.snapshot.guidance.panelVisibility.panels["session-wizard"], "hidden");
  assert.equal(normalized.snapshot.guidance.overlaySaturation.maxVisibleRelationships, 4);
  assert.equal(normalized.snapshot.guidance.overlaySaturation.maxVisibleRegions, 5);
  assert.equal(normalized.snapshot.guidance.overlaySaturation.labelMode, "simplified");
  assert.equal(normalized.snapshot.guidance.rhythm.lifecycle.length, 6);
  assert.equal(
    normalized.snapshot.guidance.rhythm.lifecycle.includes(
      normalized.snapshot.guidance.investigationPhase
    ),
    true
  );
  assert.equal(normalized.snapshot.guidance.focusCorridor.active, false);
  assert.equal(normalized.snapshot.guidance.aiInterruption.attentionBudget.maxAiInterruptions, 2);
  assert.equal(normalized.snapshot.guidance.voice.spokenGuidanceMode, "brief");
  assert.equal(
    normalized.meta.events.some((event) => event.id === "evt-psu-ai-3"),
    true
  );

  const toggleFreeze = runtime.commands[REPAIR_UI_COMMANDS.toggleFreezeFrame];
  assert.equal(typeof toggleFreeze, "function");
  assert.equal(toggleFreeze().success, true);
  assert.equal(runtime.getStateSnapshot().state.workbench.isFrozen, true);

  runtime.dispose();
  assert.ok(logs.some((entry) => entry.includes("Repair Room host disposed.")));
});

test("repair-room runtime handles the advertised interactive Phase 1 commands", () => {
  const notifications: Array<{ type: string; payload?: Record<string, unknown> }> = [];
  const runtime = createRepairRoomHostRuntime().activate({
    log: () => {},
    notifyRoom: (type, payload) => {
      notifications.push({ type, payload });
    },
  });

  assert.equal(runtime.handleCommand(REPAIR_UI_COMMANDS.uiReady).success, true);
  assert.equal(runtime.getStateSnapshot().state.tacticalFeed.length, 3);
  assert.equal(runtime.getStateSnapshot().state.sessionList[0]?.serialNumber, "R21Z14CSN100123");
  const firstStatePayload = notifications.find((entry) => entry.type === "repair-state")
    ?.payload as { meta?: { events?: Array<{ id: string }> } } | undefined;
  assert.equal(
    firstStatePayload?.meta?.events?.some((event) => event.id === "evt-psu-ai-3"),
    true
  );

  assert.equal(
    runtime.handleCommand(REPAIR_UI_COMMANDS.toggleOverlayLayer, {
      layerId: "grid",
      visible: false,
    }).success,
    true
  );
  assert.equal(runtime.getStateSnapshot().state.workbench.visibleLayers.grid, false);

  assert.equal(
    runtime.handleCommand(REPAIR_UI_COMMANDS.setActiveTool, { tool: "zoom-in" }).success,
    true
  );
  assert.equal(runtime.getStateSnapshot().state.workbench.viewport.zoom, 1.25);

  assert.equal(
    runtime.handleCommand(REPAIR_UI_COMMANDS.addMeasurement, {
      xPx: 712,
      yPx: 304,
      rawDisplay: "0.002",
      reference: "U14 VCC",
    }).success,
    true
  );
  const measurementState = runtime.getStateSnapshot().state.measurement;
  assert.equal(measurementState.current.display, "0.002");
  assert.equal(measurementState.recent[0]?.reference, "U14 VCC");

  assert.equal(
    runtime.handleCommand(REPAIR_UI_COMMANDS.sendChatTurn, { text: "Check standby rail" }).success,
    true
  );
  const chatState = runtime.getStateSnapshot().state.chat;
  assert.equal(chatState.turns.at(-1)?.role, "operator");
  assert.equal(chatState.pendingReplyId, chatState.turns.at(-1)?.id);

  assert.ok(notifications.some((entry) => entry.type === "repair-state"));
});

test("repair-room Phase 3 arbitrates one calm guidance surface per profile", () => {
  const runtime = createRepairRoomHostRuntime().activate({
    log: () => {},
    notifyRoom: () => {},
  });

  let state = runtime.getStateSnapshot().state;
  let session = state.sessions[state.activeSessionId ?? ""];
  assert.ok(session);
  let projection = createRepairReplayProjection(state, session);
  assert.equal(projection.guidance.operationalProfile, "novice");
  assert.equal(projection.guidance.panelVisibility.primarySurface, "measurement");
  assert.equal(projection.guidance.panelVisibility.panels.measurement, "expanded");
  assert.equal(projection.guidance.panelVisibility.panels["tactical-feed"], "compact");
  assert.equal(projection.guidance.panelVisibility.panels["session-wizard"], "hidden");
  assert.equal(projection.guidance.panelVisibility.tacticalFeedDensity, "minimal");

  assert.equal(
    runtime.handleCommand(REPAIR_UI_COMMANDS.setOperationalProfile, { profile: "advanced" })
      .success,
    true
  );
  state = runtime.getStateSnapshot().state;
  session = state.sessions[state.activeSessionId ?? ""];
  assert.ok(session);
  projection = createRepairReplayProjection(state, session);
  assert.equal(projection.guidance.operationalProfile, "advanced");
  assert.equal(projection.guidance.overlaySaturation.maxVisibleRelationships, 12);
  assert.equal(projection.guidance.overlaySaturation.labelMode, "full");
  assert.equal(projection.guidance.panelVisibility.panels.chat, "compact");

  assert.equal(
    runtime.handleCommand(REPAIR_UI_COMMANDS.advanceWizard, { step: "device-info" }).success,
    true
  );
  state = runtime.getStateSnapshot().state;
  session = state.sessions[state.activeSessionId ?? ""];
  assert.ok(session);
  projection = createRepairReplayProjection(state, session);
  assert.equal(projection.guidance.panelVisibility.primarySurface, "session-wizard");
  assert.equal(projection.guidance.panelVisibility.panels["session-wizard"], "expanded");
  assert.equal(projection.guidance.panelVisibility.panels["tactical-feed"], "compact");

  runtime.dispose();
});

test("repair-room Phase 3 projects confidence, recovery, saturation, and voice hooks", () => {
  const runtime = createRepairRoomHostRuntime().activate({
    log: () => {},
    notifyRoom: () => {},
  });

  assert.equal(
    runtime.handleCommand(REPAIR_UI_COMMANDS.setVoiceGuidance, {
      ambientListeningState: "listening",
      spokenGuidanceMode: "brief",
      handsBusyMode: true,
    }).success,
    true
  );
  assert.equal(
    runtime.handleCommand(REPAIR_UI_COMMANDS.focusKnowledgeSpatialRef, {
      spatialRefId: "startup-resistor-open",
    }).success,
    true
  );
  const state = runtime.getStateSnapshot().state;
  const session = state.sessions[state.activeSessionId ?? ""];
  assert.ok(session);
  const projection = createRepairReplayProjection(state, session);

  assert.equal(projection.guidance.aiInterruption.confidence, "high");
  assert.equal(projection.guidance.aiInterruption.urgency, "high");
  assert.equal(projection.guidance.aiInterruption.evidenceDepth, "strong");
  assert.equal(projection.guidance.recovery.currentFocus, "Startup resistor open");
  assert.match(projection.guidance.recovery.whyThisRegionMatters, /measurement evidence/);
  assert.ok(projection.guidance.overlaySaturation.clutterScore > 0);
  assert.ok(
    projection.guidance.overlaySaturation.visibleRelationshipIds.length <=
      projection.guidance.overlaySaturation.maxVisibleRelationships
  );
  assert.deepEqual(projection.guidance.voice.voiceFocusTarget, {
    kind: "knowledge-region",
    id: "startup-resistor-open",
  });
  assert.equal(projection.guidance.voice.ambientListeningState, "listening");
  assert.equal(projection.guidance.voice.handsBusyMode, true);
  assert.equal(projection.guidance.voice.spokenGuidanceMode, "step-by-step");
  assert.equal(projection.guidance.focusCorridor.active, true);
  assert.equal(projection.guidance.focusCorridor.targetRef?.kind, "knowledge-region");
  assert.equal(
    projection.guidance.overlaySaturation.visibleRegionRefs.length <=
      projection.guidance.overlaySaturation.maxVisibleRegions,
    true
  );
  assert.equal(
    projection.guidance.overlaySaturation.visibleEventIds.length <=
      projection.guidance.overlaySaturation.maxSimultaneousHighlights,
    true
  );
  assert.equal(
    projection.guidance.overlaySaturation.activeAttentionRefs.length <=
      projection.guidance.overlaySaturation.maxSimultaneousHighlights,
    true
  );
  assert.equal(projection.guidance.rhythm.lifecycle[projection.guidance.rhythm.currentIndex], "verify");

  runtime.dispose();
});

test("repair-room Phase 3 keeps calm defaults and applies AI attention budget", () => {
  const defaultGuidance = createRepairDefaultGuidanceProjection();
  const emptyGuidance = createEmptyRepairReplayProjection().guidance;
  assert.deepEqual(emptyGuidance, defaultGuidance);

  const runtime = createRepairRoomHostRuntime().activate({
    log: () => {},
    notifyRoom: () => {},
  });
  assert.equal(
    runtime.handleCommand(REPAIR_UI_COMMANDS.setAttentionBudget, {
      windowMs: 240000,
      maxAiInterruptions: 1,
    }).success,
    true
  );
  const state = runtime.getStateSnapshot().state;
  const session = state.sessions[state.activeSessionId ?? ""];
  assert.ok(session);
  const projection = createRepairReplayProjection(state, session);

  assert.equal(projection.guidance.aiInterruption.attentionBudget.windowMs, 240000);
  assert.equal(projection.guidance.aiInterruption.attentionBudget.maxAiInterruptions, 1);
  assert.equal(
    projection.guidance.aiInterruption.attentionBudget.usedAiInterruptions <=
      projection.guidance.aiInterruption.attentionBudget.maxAiInterruptions,
    true
  );
  assert.ok(projection.guidance.aiInterruption.attentionBudget.usedAiInterruptions >= 1);
  assert.ok(projection.guidance.aiInterruption.attentionBudget.collapsedByBudgetCount >= 1);

  runtime.dispose();
});

test("repair-room runtime turns timeline jumps and layout controls into state", () => {
  const runtime = createRepairRoomHostRuntime().activate({
    log: () => {},
    notifyRoom: () => {},
  });

  const firstEvent = runtime.getStateSnapshot().state.sessions["psu-2025-0510"]?.events[0];
  assert.ok(firstEvent);

  assert.equal(
    runtime.handleCommand(REPAIR_UI_COMMANDS.jumpToEvent, { eventId: firstEvent.id }).success,
    true
  );
  assert.equal(runtime.getStateSnapshot().state.workbench.focusedEventId, firstEvent.id);

  assert.equal(
    runtime.handleCommand(REPAIR_UI_COMMANDS.updatePanelLayout, {
      panelId: "tactical-feed",
      collapsed: true,
    }).success,
    true
  );
  assert.equal(runtime.getStateSnapshot().state.layout.collapsedPanels["tactical-feed"], true);

  assert.equal(
    runtime.handleCommand(REPAIR_UI_COMMANDS.updatePanelTab, {
      previewTabId: "board-view",
    }).success,
    true
  );
  assert.equal(runtime.getStateSnapshot().state.knowledgePack.previewTabId, "board-view");

  assert.equal(
    runtime.handleCommand(REPAIR_UI_COMMANDS.updatePanelTab, {
      operatorProfileTabId: "preferences",
    }).success,
    true
  );
  assert.equal(runtime.getStateSnapshot().state.layout.operatorProfileTabId, "preferences");

  assert.equal(
    runtime.handleCommand(REPAIR_UI_COMMANDS.updateFocus, {
      focusMode: true,
    }).success,
    true
  );
  assert.equal(runtime.getStateSnapshot().state.layout.focusMode, true);

  assert.equal(
    runtime.handleCommand(REPAIR_UI_COMMANDS.updateLayout, {
      panelId: "tactical-feed",
      collapsed: false,
    }).success,
    true
  );
  assert.equal(runtime.getStateSnapshot().state.layout.collapsedPanels["tactical-feed"], false);
});

test("repair-room runtime keeps event log canonical while feed remains a visibility projection", () => {
  const notifications: Array<{ type: string; payload?: Record<string, unknown> }> = [];
  const runtime = createRepairRoomHostRuntime().activate({
    log: () => {},
    notifyRoom: (type, payload) => {
      notifications.push({ type, payload });
    },
  });

  assert.equal(runtime.handleCommand(REPAIR_UI_COMMANDS.uiReady).success, true);
  const payload = notifications.find((entry) => entry.type === "repair-state")?.payload as
    | {
        snapshot?: { tacticalFeed?: Array<{ eventId: string }> };
        meta?: { events?: Array<{ id: string }> };
      }
    | undefined;

  const feedIds = new Set(payload?.snapshot?.tacticalFeed?.map((item) => item.eventId) ?? []);
  assert.equal(feedIds.has("evt-psu-ai-3"), false);
  assert.equal(
    payload?.meta?.events?.some((event) => event.id === "evt-psu-ai-3"),
    true
  );
});

test("repair-room runtime publishes one coherent state snapshot per logical action", () => {
  const notifications: Array<{ type: string; payload?: Record<string, unknown> }> = [];
  const runtime = createRepairRoomHostRuntime().activate({
    log: () => {},
    notifyRoom: (type, payload) => {
      notifications.push({ type, payload });
    },
  });

  notifications.length = 0;
  assert.equal(runtime.handleCommand(REPAIR_UI_COMMANDS.toggleFreezeFrame).success, true);
  assert.equal(notifications.filter((entry) => entry.type === "repair-state").length, 1);

  notifications.length = 0;
  assert.equal(
    runtime.handleCommand(REPAIR_UI_COMMANDS.addMeasurement, {
      xPx: 712,
      yPx: 304,
      rawDisplay: "0.003",
      reference: "U14 VCC",
    }).success,
    true
  );
  assert.equal(notifications.filter((entry) => entry.type === "repair-state").length, 1);

  notifications.length = 0;
  assert.equal(
    runtime.handleCommand(REPAIR_UI_COMMANDS.sendChatTurn, { text: "Next rail?" }).success,
    true
  );
  assert.equal(notifications.filter((entry) => entry.type === "repair-state").length, 1);
});

test("repair-room runtime keeps P1 wizard, viewport, timeline, and pin edits stateful", () => {
  const runtime = createRepairRoomHostRuntime().activate({
    log: () => {},
    notifyRoom: () => {},
  });

  assert.equal(
    runtime.handleCommand(REPAIR_UI_COMMANDS.updateSession, {
      wizardField: "model",
      value: "BN44-00932A",
    }).success,
    true
  );
  assert.equal(runtime.getStateSnapshot().state.wizard.draft.model, "BN44-00932A");

  assert.equal(
    runtime.handleCommand(REPAIR_UI_COMMANDS.updateSession, {
      wizardField: "primarySymptoms",
      value: ["No Power", "No 5V_STBY"],
    }).success,
    true
  );
  assert.deepEqual(runtime.getStateSnapshot().state.wizard.draft.primarySymptoms, [
    "No Power",
    "No 5V_STBY",
  ]);

  assert.equal(
    runtime.handleCommand(REPAIR_UI_COMMANDS.advanceWizard, { step: "ai-research" }).success,
    true
  );
  const researchState = runtime.getStateSnapshot().state.wizard;
  assert.equal(researchState.currentStep, "ai-research");
  assert.equal(researchState.foundResources.length, 0);
  assert.ok(researchState.researchProgress.every((item) => item.completed === false));

  assert.equal(
    runtime.handleCommand(REPAIR_UI_COMMANDS.updateViewport, {
      viewportZoom: 1.75,
      panXPx: 36,
      panYPx: -18,
    }).success,
    true
  );
  assert.deepEqual(runtime.getStateSnapshot().state.workbench.viewport, {
    zoom: 1.75,
    panXPx: 36,
    panYPx: -18,
  });
  assert.equal(
    runtime.handleCommand(REPAIR_UI_COMMANDS.updateViewport, {
      panXPx: 999999,
      panYPx: -999999,
    }).success,
    true
  );
  assert.ok(runtime.getStateSnapshot().state.workbench.viewport.panXPx < 999999);
  assert.ok(runtime.getStateSnapshot().state.workbench.viewport.panYPx > -999999);

  assert.equal(
    runtime.handleCommand(REPAIR_UI_COMMANDS.scrubTimeline, { positionMs: 42000 }).success,
    true
  );
  assert.equal(runtime.getStateSnapshot().state.workbench.timeline.playheadMs, 42000);
  assert.equal(runtime.getStateSnapshot().state.workbench.timeline.autoFollowLive, false);

  assert.equal(
    runtime.handleCommand(REPAIR_UI_COMMANDS.updateTimeline, {
      timelineZoom: 1.5,
      timelineRangeStartMs: 27000,
      timelineRangeEndMs: 57000,
    }).success,
    true
  );
  assert.deepEqual(
    {
      zoom: runtime.getStateSnapshot().state.workbench.timeline.zoom,
      rangeStartMs: runtime.getStateSnapshot().state.workbench.timeline.rangeStartMs,
      rangeEndMs: runtime.getStateSnapshot().state.workbench.timeline.rangeEndMs,
    },
    {
      zoom: 1.5,
      rangeStartMs: 27000,
      rangeEndMs: 57000,
    }
  );

  const session =
    runtime.getStateSnapshot().state.sessions[
      runtime.getStateSnapshot().state.activeSessionId ?? ""
    ];
  const measurement = session?.events.find((event) => event.kind === "measurement");
  assert.ok(measurement);
  const eventCount = session.events.length;

  assert.equal(
    runtime.handleCommand(REPAIR_UI_COMMANDS.addMeasurement, {
      eventId: measurement.id,
      xPx: 111,
      yPx: 222,
      reference: "Dragged probe",
    }).success,
    true
  );

  const updatedSession = runtime.getStateSnapshot().state.sessions[session.id];
  const updatedMeasurement = updatedSession?.events.find((event) => event.id === measurement.id);
  assert.equal(updatedSession?.events.length, eventCount);
  assert.equal(updatedMeasurement?.kind, "measurement");
  if (updatedMeasurement?.kind === "measurement") {
    assert.deepEqual(updatedMeasurement.pinAt, { xPx: 111, yPx: 222 });
  }
  assert.equal(runtime.getStateSnapshot().state.workbench.focusedEventId, measurement.id);
});

test("repair-room Phase 2 projection restores replay state from the canonical event log", () => {
  const notifications: Array<{ type: string; payload?: Record<string, unknown> }> = [];
  const runtime = createRepairRoomHostRuntime().activate({
    log: () => {},
    notifyRoom: (type, payload) => {
      notifications.push({ type, payload });
    },
  });

  assert.equal(
    runtime.handleCommand(REPAIR_UI_COMMANDS.scrubTimeline, { positionMs: 16 * 60 * 1000 }).success,
    true
  );

  const payload = notifications.at(-1)?.payload as
    | {
        meta?: {
          replay?: {
            visibleEvents?: Array<{ id: string }>;
            overlayEvents?: Array<{ id: string }>;
            measurementEvidence?: Array<{ reference: string; history: string[] }>;
          };
        };
        snapshot?: {
          measurement?: { evidence?: Array<{ reference: string }> };
          workbench?: { measurementEvidence?: Array<{ reference: string }> };
        };
      }
    | undefined;

  assert.ok(payload?.meta?.replay);
  assert.equal(
    payload.meta.replay.visibleEvents?.some((event) => event.id === "evt-psu-meas-1"),
    true
  );
  assert.equal(
    payload.meta.replay.overlayEvents?.some((event) => event.id === "evt-psu-anno-1"),
    true
  );
  assert.equal(
    payload.meta.replay.measurementEvidence?.some((entry) => entry.reference.includes("C101")),
    true
  );
  assert.equal(
    payload.snapshot?.measurement?.evidence?.some((entry) => entry.reference.includes("C101")),
    true
  );
  assert.equal(
    payload.snapshot?.workbench?.measurementEvidence?.some((entry) =>
      entry.reference.includes("C101")
    ),
    true
  );
});

test("repair-room replay projection holds forensic overlay state during freeze frames", () => {
  const runtime = createRepairRoomHostRuntime().activate({
    log: () => {},
    notifyRoom: () => {},
  });
  const state = runtime.getStateSnapshot().state;
  const session = state.sessions["psu-2025-0510"];
  assert.ok(session);

  const frozenSession = {
    ...session,
    events: [
      ...session.events,
      {
        kind: "measurement" as const,
        id: "evt-freeze-inner-meas",
        sessionId: session.id,
        occurredAt: "2026-05-10T10:31:30.000Z",
        source: "instrument" as const,
        linkedEventIds: ["evt-psu-freeze-1"],
        instrumentId: "multimeter-fnirsi-dmt99",
        channel: "COM/VΩ",
        mode: "DCV",
        range: "20 V",
        value: 4.81,
        rawDisplay: "4.81",
        unit: "V",
        pinAt: { xPx: 900, yPx: 400 },
        reference: "Freeze-window reading",
      },
    ],
  };

  const projection = createRepairReplayProjection(
    {
      ...state,
      workbench: {
        ...state.workbench,
        timeline: {
          ...state.workbench.timeline,
          playheadMs: 13 * 60 * 1000 + 30 * 1000,
          autoFollowLive: false,
        },
      },
    },
    frozenSession
  );

  assert.equal(
    projection.visibleEvents.some((event) => event.id === "evt-freeze-inner-meas"),
    true
  );
  assert.equal(
    projection.overlayEvents.some((event) => event.id === "evt-freeze-inner-meas"),
    false
  );
  assert.equal(projection.activeFreezeFrameEventId, "evt-psu-freeze-1");
});

test("repair-room AI mark expiry is evaluated against replay playhead", () => {
  const runtime = createRepairRoomHostRuntime().activate({
    log: () => {},
    notifyRoom: () => {},
  });
  const state = runtime.getStateSnapshot().state;
  const session = state.sessions["psu-2025-0510"];
  assert.ok(session);

  const expiringSession = {
    ...session,
    events: [
      ...session.events,
      {
        kind: "ai-mark" as const,
        id: "evt-expiring-ai",
        sessionId: session.id,
        occurredAt: "2026-05-10T10:30:32.000Z",
        source: "ai" as const,
        linkedEventIds: [],
        severity: "suggestion" as const,
        region: { xPx: 100, yPx: 100, widthPx: 40, heightPx: 40 },
        rationale: "Short-lived replay mark.",
        protocolKey: "repair-room-tactical-observer",
        dismissed: false,
        lifecycleState: "detected" as const,
        expiresAt: "2026-05-10T10:30:40.000Z",
      },
    ],
  };

  const projection = createRepairReplayProjection(
    {
      ...state,
      workbench: {
        ...state.workbench,
        timeline: {
          ...state.workbench.timeline,
          playheadMs: 13 * 60 * 1000,
          autoFollowLive: false,
        },
      },
    },
    expiringSession
  );

  assert.equal(
    projection.visibleEvents.some((event) => event.id === "evt-expiring-ai"),
    true
  );
  assert.equal(projection.aiMarkEventIds.includes("evt-expiring-ai"), false);
});

test("repair-room timeline chips seek to exact event state and replay controls stay deterministic", () => {
  const runtime = createRepairRoomHostRuntime().activate({
    log: () => {},
    notifyRoom: () => {},
  });
  const session = runtime.getStateSnapshot().state.sessions["psu-2025-0510"];
  assert.ok(session);
  const target = session.events.find((event) => event.id === "evt-psu-meas-4");
  assert.ok(target);
  const expectedOffset = Date.parse(target.occurredAt) - Date.parse(session.startedAt);

  assert.equal(
    runtime.handleCommand(REPAIR_UI_COMMANDS.jumpToEvent, { eventId: target.id }).success,
    true
  );
  assert.equal(runtime.getStateSnapshot().state.workbench.focusedEventId, target.id);
  assert.equal(runtime.getStateSnapshot().state.workbench.timeline.playheadMs, expectedOffset);
  assert.equal(runtime.getStateSnapshot().state.workbench.timeline.autoFollowLive, false);

  assert.equal(
    runtime.handleCommand(REPAIR_UI_COMMANDS.updateTimeline, { replayAction: "play" }).success,
    true
  );
  assert.equal(runtime.getStateSnapshot().state.workbench.timeline.isPlaying, true);
  assert.equal(runtime.getStateSnapshot().state.workbench.timeline.replayMode, "replay");

  assert.equal(
    runtime.handleCommand(REPAIR_UI_COMMANDS.updateTimeline, { replaySpeed: 2 }).success,
    true
  );
  assert.equal(runtime.getStateSnapshot().state.workbench.timeline.replaySpeed, 2);

  assert.equal(
    runtime.handleCommand(REPAIR_UI_COMMANDS.updateTimeline, { replayAction: "live" }).success,
    true
  );
  assert.equal(runtime.getStateSnapshot().state.workbench.timeline.autoFollowLive, true);
  assert.equal(runtime.getStateSnapshot().state.workbench.timeline.replayMode, "live");
});

test("repair-room annotations and knowledge pack spatial focus are forensic records", () => {
  const runtime = createRepairRoomHostRuntime().activate({
    log: () => {},
    notifyRoom: () => {},
  });

  assert.equal(
    runtime.handleCommand(REPAIR_UI_COMMANDS.addTimelineEvent, {
      kind: "annotation",
      tool: "rect",
      xPx: 500,
      yPx: 260,
      label: "Confirmed cracked startup resistor",
      linkedMeasurementId: "evt-psu-meas-2",
      linkedEventId: "evt-psu-ai-2",
    }).success,
    true
  );

  const session = runtime.getStateSnapshot().state.sessions["psu-2025-0510"];
  const annotation = session?.events.at(-1);
  assert.equal(annotation?.kind, "annotation");
  if (annotation?.kind === "annotation") {
    assert.equal(annotation.meta?.author, "operator");
    assert.equal(annotation.meta?.tool, "rect");
    assert.deepEqual(annotation.meta?.linkedMeasurementIds, ["evt-psu-meas-2"]);
    assert.deepEqual(annotation.meta?.linkedEventIds, ["evt-psu-ai-2"]);
  }

  assert.equal(
    runtime.handleCommand(REPAIR_UI_COMMANDS.updatePanelTab, {
      spatialRefId: "startup-resistor-open",
    }).success,
    true
  );
  assert.equal(
    runtime.getStateSnapshot().state.knowledgePack.focusedSpatialRefId,
    "startup-resistor-open"
  );
  assert.equal(runtime.getStateSnapshot().state.knowledgePack.previewTabId, "board-view");
});

test("repair-room Phase 2.8 folds investigation regions from canonical replay events", () => {
  const runtime = createRepairRoomHostRuntime().activate({
    log: () => {},
    notifyRoom: () => {},
  });
  const state = runtime.getStateSnapshot().state;
  const session = state.sessions["psu-2025-0510"];
  assert.ok(session);

  const regionSession = {
    ...session,
    events: [
      ...session.events,
      {
        kind: "investigation-region-created" as const,
        id: "evt-region-create-1",
        sessionId: session.id,
        occurredAt: "2026-05-10T10:43:00.000Z",
        source: "operator" as const,
        linkedEventIds: ["evt-psu-meas-4"],
        regionId: "region-u14-chain",
        label: "U14 gate-driver chain",
        region: { xPx: 440, yPx: 245, widthPx: 140, heightPx: 110 },
        status: "active" as const,
        color: "rgb(86, 200, 222)",
        sourceRef: { kind: "event" as const, id: "evt-psu-ai-2" },
        measurementEventIds: ["evt-psu-meas-3", "evt-psu-meas-4"],
        annotationEventIds: ["evt-psu-anno-1"],
        aiMarkEventIds: ["evt-psu-ai-2"],
      },
      {
        kind: "investigation-region-updated" as const,
        id: "evt-region-update-1",
        sessionId: session.id,
        occurredAt: "2026-05-10T10:44:00.000Z",
        source: "operator" as const,
        linkedEventIds: ["evt-psu-meas-4"],
        regionId: "region-u14-chain",
        label: "U14 chain resolved",
        status: "resolved" as const,
      },
    ],
  };

  const projection = createRepairReplayProjection(
    {
      ...state,
      workbench: {
        ...state.workbench,
        timeline: {
          ...state.workbench.timeline,
          playheadMs: 30 * 60 * 1000,
          autoFollowLive: false,
        },
      },
    },
    regionSession
  );

  assert.equal(projection.investigationRegions.length, 1);
  assert.equal(projection.investigationRegions[0]?.regionId, "region-u14-chain");
  assert.equal(projection.investigationRegions[0]?.createdEventId, "evt-region-create-1");
  assert.equal(projection.investigationRegions[0]?.updatedEventId, "evt-region-update-1");
  assert.equal(projection.investigationRegions[0]?.status, "resolved");
  assert.deepEqual(projection.investigationRegions[0]?.linkage.measurementEventIds, [
    "evt-psu-meas-3",
    "evt-psu-meas-4",
  ]);
});

test("repair-room Phase 2.8 keeps investigation mode explicit and entity refs commandable", () => {
  const runtime = createRepairRoomHostRuntime().activate({
    log: () => {},
    notifyRoom: () => {},
  });

  assert.equal(
    runtime.handleCommand(REPAIR_UI_COMMANDS.toggleInvestigationMode, { enabled: true }).success,
    true
  );
  assert.equal(runtime.getStateSnapshot().state.workbench.investigationModeEnabled, true);

  assert.equal(
    runtime.handleCommand(REPAIR_UI_COMMANDS.selectOverlayEntities, {
      refs: [
        { kind: "event", id: "evt-psu-meas-3" },
        { kind: "knowledge-region", id: "startup-resistor-open" },
      ],
      mode: "replace",
    }).success,
    true
  );
  assert.deepEqual(runtime.getStateSnapshot().state.workbench.selection.selectedEventIds, [
    "evt-psu-meas-3",
  ]);
  assert.deepEqual(runtime.getStateSnapshot().state.workbench.selection.selectedEntityRefs, [
    { kind: "event", id: "evt-psu-meas-3" },
    { kind: "knowledge-region", id: "startup-resistor-open" },
  ]);

  assert.equal(
    runtime.handleCommand(REPAIR_UI_COMMANDS.focusOverlayEntity, {
      ref: { kind: "live-edge", id: "live-edge" },
    }).success,
    true
  );
  assert.equal(
    runtime.getStateSnapshot().state.workbench.selection.inspectorEntityRef?.kind,
    "live-edge"
  );
});

test("repair-room Phase 2.8 focuses investigation regions, relationships, and live edge explicitly", () => {
  const runtime = createRepairRoomHostRuntime().activate({
    log: () => {},
    notifyRoom: () => {},
  });

  assert.equal(
    runtime.handleCommand(REPAIR_UI_COMMANDS.promoteKnowledgeRegion, {
      spatialRefId: "startup-resistor-open",
    }).success,
    true
  );
  let state = runtime.getStateSnapshot().state;
  let session = state.sessions[state.activeSessionId ?? ""];
  assert.ok(session);
  const regionEvent = session.events.find(
    (event) =>
      event.kind === "investigation-region-created" &&
      event.knowledgeSpatialRefId === "startup-resistor-open"
  );
  assert.ok(regionEvent);

  assert.equal(
    runtime.handleCommand(REPAIR_UI_COMMANDS.focusInvestigationRegion, {
      regionId: regionEvent.regionId,
    }).success,
    true
  );
  state = runtime.getStateSnapshot().state;
  session = state.sessions[state.activeSessionId ?? ""];
  assert.ok(session);
  let projection = createRepairReplayProjection(state, session);
  assert.equal(state.workbench.investigationModeEnabled, true);
  assert.deepEqual(state.workbench.selection.inspectorEntityRef, {
    kind: "investigation-region",
    id: regionEvent.regionId,
  });
  assert.deepEqual(projection.activeSpatialFocus?.ref, {
    kind: "investigation-region",
    id: regionEvent.regionId,
  });
  assert.deepEqual(
    [...new Set(projection.measurementRelationships.map((relationship) => relationship.kind))].sort(),
    [
      "investigation-group",
      "linked-ai-mark",
      "linked-annotation",
      "previous-event",
      "rail",
    ]
  );

  const relationship = projection.measurementRelationships[0];
  assert.ok(relationship);
  assert.equal(
    runtime.handleCommand(REPAIR_UI_COMMANDS.focusOverlayEntity, {
      ref: { kind: "measurement-relationship", id: relationship.id },
    }).success,
    true
  );
  state = runtime.getStateSnapshot().state;
  session = state.sessions[state.activeSessionId ?? ""];
  assert.ok(session);
  projection = createRepairReplayProjection(state, session);
  assert.deepEqual(projection.activeSpatialFocus?.ref, {
    kind: "measurement-relationship",
    id: relationship.id,
  });
  assert.ok(projection.activeSpatialFocus.region);
  assert.deepEqual(
    projection.activeSpatialFocus.relatedMeasurementIds,
    relationship.eventIds.filter((eventId) => {
      const linked = session.events.find((event) => event.id === eventId);
      return linked?.kind === "measurement";
    })
  );

  assert.equal(runtime.handleCommand(REPAIR_UI_COMMANDS.focusLiveEdge).success, true);
  state = runtime.getStateSnapshot().state;
  session = state.sessions[state.activeSessionId ?? ""];
  assert.ok(session);
  projection = createRepairReplayProjection(state, session);
  assert.equal(state.workbench.timeline.replayMode, "live");
  assert.equal(state.workbench.timeline.autoFollowLive, true);
  assert.equal(state.workbench.selection.inspectorEntityRef, null);
  assert.equal(projection.activeSpatialFocus, null);
  assert.equal(projection.guidance.focusCorridor.active, false);
});

test("repair-room Phase 2.8 separates temporary knowledge focus from promoted regions", () => {
  const runtime = createRepairRoomHostRuntime().activate({
    log: () => {},
    notifyRoom: () => {},
  });

  assert.equal(
    runtime.handleCommand(REPAIR_UI_COMMANDS.focusKnowledgeSpatialRef, {
      spatialRefId: "startup-resistor-open",
    }).success,
    true
  );
  let state = runtime.getStateSnapshot().state;
  let session = state.sessions[state.activeSessionId ?? ""];
  assert.ok(session);
  let projection = createRepairReplayProjection(state, session);
  assert.equal(
    session.events.some((event) => event.kind === "investigation-region-created"),
    false
  );
  assert.equal(
    projection.temporarySpatialRegions[0]?.knowledgeSpatialRefId,
    "startup-resistor-open"
  );

  assert.equal(
    runtime.handleCommand(REPAIR_UI_COMMANDS.promoteKnowledgeRegion, {
      spatialRefId: "startup-resistor-open",
    }).success,
    true
  );
  state = runtime.getStateSnapshot().state;
  session = state.sessions[state.activeSessionId ?? ""];
  assert.ok(session);
  projection = createRepairReplayProjection(state, session);
  assert.equal(
    session.events.some(
      (event) =>
        event.kind === "investigation-region-created" &&
        event.knowledgeSpatialRefId === "startup-resistor-open"
    ),
    true
  );
  const promotedRegionEvent = session.events.find(
    (event) =>
      event.kind === "investigation-region-created" &&
      event.knowledgeSpatialRefId === "startup-resistor-open"
  );
  assert.equal(promotedRegionEvent?.kind, "investigation-region-created");
  if (promotedRegionEvent?.kind === "investigation-region-created") {
    assert.deepEqual(promotedRegionEvent.measurementEventIds, ["evt-psu-meas-2"]);
    assert.deepEqual(promotedRegionEvent.annotationEventIds, ["evt-psu-anno-2"]);
    assert.deepEqual(promotedRegionEvent.aiMarkEventIds, ["evt-psu-ai-1"]);
    assert.equal(promotedRegionEvent.linkedEventIds.includes("evt-psu-anno-2"), true);
  }
  assert.equal(projection.investigationRegions[0]?.knowledgeSpatialRefId, "startup-resistor-open");
});

test("repair-room Phase 2.8 keyboard nudging moves event-backed and canonical region refs", () => {
  const runtime = createRepairRoomHostRuntime().activate({
    log: () => {},
    notifyRoom: () => {},
  });
  let state = runtime.getStateSnapshot().state;
  let session = state.sessions["psu-2025-0510"];
  assert.ok(session);
  const measurement = session.events.find((event) => event.kind === "measurement");
  assert.ok(measurement);
  assert.ok(measurement.pinAt);

  assert.equal(
    runtime.handleCommand(REPAIR_UI_COMMANDS.selectOverlayEntities, {
      refs: [{ kind: "event", id: measurement.id }],
      mode: "replace",
    }).success,
    true
  );
  assert.equal(
    runtime.handleCommand(REPAIR_UI_COMMANDS.updateFocus, {
      nudgeDelta: { xPx: 6, yPx: -3 },
    }).success,
    true
  );
  session = runtime.getStateSnapshot().state.sessions["psu-2025-0510"];
  const nudgedMeasurement = session?.events.find((event) => event.id === measurement.id);
  assert.equal(nudgedMeasurement?.kind, "measurement");
  if (nudgedMeasurement?.kind === "measurement") {
    assert.deepEqual(nudgedMeasurement.pinAt, {
      xPx: measurement.pinAt.xPx + 6,
      yPx: measurement.pinAt.yPx - 3,
    });
  }

  assert.equal(
    runtime.handleCommand(REPAIR_UI_COMMANDS.promoteKnowledgeRegion, {
      spatialRefId: "startup-resistor-open",
    }).success,
    true
  );
  state = runtime.getStateSnapshot().state;
  session = state.sessions[state.activeSessionId ?? ""];
  assert.ok(session);
  let projection = createRepairReplayProjection(state, session);
  const region = projection.investigationRegions[0];
  assert.ok(region);
  const beforeRegion = region.region;

  assert.equal(
    runtime.handleCommand(REPAIR_UI_COMMANDS.selectOverlayEntities, {
      refs: [{ kind: "investigation-region", id: region.regionId }],
      mode: "replace",
    }).success,
    true
  );
  assert.equal(
    runtime.handleCommand(REPAIR_UI_COMMANDS.updateFocus, {
      nudgeDelta: { xPx: 10, yPx: 5 },
    }).success,
    true
  );
  state = runtime.getStateSnapshot().state;
  session = state.sessions[state.activeSessionId ?? ""];
  assert.ok(session);
  const updateEvent = session.events.at(-1);
  assert.equal(updateEvent?.kind, "investigation-region-updated");
  if (updateEvent?.kind === "investigation-region-updated") {
    assert.equal(updateEvent.regionId, region.regionId);
    assert.deepEqual(updateEvent.region, {
      ...beforeRegion,
      xPx: beforeRegion.xPx + 10,
      yPx: beforeRegion.yPx + 5,
    });
  }
  projection = createRepairReplayProjection(state, session);
  assert.deepEqual(projection.investigationRegions[0]?.region, {
    ...beforeRegion,
    xPx: beforeRegion.xPx + 10,
    yPx: beforeRegion.yPx + 5,
  });
});

test("repair-room overlay selection supports hover, multi-select, deselect, and focus jump", () => {
  const runtime = createRepairRoomHostRuntime().activate({
    log: () => {},
    notifyRoom: () => {},
  });
  const session = runtime.getStateSnapshot().state.sessions["psu-2025-0510"];
  assert.ok(session);
  const first = session.events.find((event) => event.kind === "annotation");
  const second = session.events.find((event) => event.kind === "measurement");
  assert.ok(first);
  assert.ok(second);

  assert.equal(
    runtime.handleCommand(REPAIR_UI_COMMANDS.updateFocus, { hoveredEventId: first.id }).success,
    true
  );
  assert.equal(runtime.getStateSnapshot().state.workbench.selection.hoveredEventId, first.id);

  assert.equal(
    runtime.handleCommand(REPAIR_UI_COMMANDS.updateFocus, {
      eventId: first.id,
      selectionMode: "replace",
      focusJump: true,
      jumpToEvent: true,
    }).success,
    true
  );
  assert.deepEqual(runtime.getStateSnapshot().state.workbench.selection.selectedEventIds, [
    first.id,
  ]);
  assert.equal(runtime.getStateSnapshot().state.workbench.focusedEventId, first.id);

  assert.equal(
    runtime.handleCommand(REPAIR_UI_COMMANDS.updateFocus, {
      eventId: second.id,
      selectionMode: "toggle",
      focusJump: false,
    }).success,
    true
  );
  assert.deepEqual(runtime.getStateSnapshot().state.workbench.selection.selectedEventIds, [
    first.id,
    second.id,
  ]);
  assert.equal(runtime.getStateSnapshot().state.workbench.selection.inspectorEventId, second.id);

  assert.equal(
    runtime.handleCommand(REPAIR_UI_COMMANDS.updateFocus, { clearSelection: true }).success,
    true
  );
  assert.deepEqual(runtime.getStateSnapshot().state.workbench.selection.selectedEventIds, []);
  assert.equal(runtime.getStateSnapshot().state.workbench.focusedEventId, null);
  assert.equal(runtime.getStateSnapshot().state.workbench.selection.hoveredEventId, null);
});

test("repair-room AI mark lifecycle changes append canonical replay events", () => {
  const runtime = createRepairRoomHostRuntime().activate({
    log: () => {},
    notifyRoom: () => {},
  });
  const session = runtime.getStateSnapshot().state.sessions["psu-2025-0510"];
  assert.ok(session);
  const target = session.events.find((event) => event.id === "evt-psu-ai-2");
  assert.ok(target);
  assert.equal(target.kind, "ai-mark");

  assert.equal(
    runtime.handleCommand(REPAIR_UI_COMMANDS.dismissAiMark, {
      eventId: target.id,
      state: "dismissed",
      reason: "Operator dismissed duplicate observation.",
    }).success,
    true
  );

  const nextSession = runtime.getStateSnapshot().state.sessions["psu-2025-0510"];
  const lifecycle = nextSession?.events.at(-1);
  assert.equal(lifecycle?.kind, "ai-mark-lifecycle");
  if (lifecycle?.kind === "ai-mark-lifecycle") {
    assert.equal(lifecycle.targetEventId, target.id);
    assert.equal(lifecycle.state, "dismissed");
    assert.equal(lifecycle.linkedEventIds.includes(target.id), true);
  }
  const baseTarget = nextSession?.events.find((event) => event.id === target.id);
  assert.equal(baseTarget?.kind, "ai-mark");
  if (baseTarget?.kind === "ai-mark") {
    assert.equal(baseTarget.dismissed, false);
  }

  const liveProjection = createRepairReplayProjection(
    runtime.getStateSnapshot().state,
    nextSession ?? null
  );
  assert.equal(liveProjection.aiMarkEventIds.includes(target.id), false);
  assert.equal(
    liveProjection.overlayEvents.some((event) => event.id === target.id),
    false
  );

  const targetOffset = Date.parse(target.occurredAt) - Date.parse(session.startedAt);
  assert.equal(
    runtime.handleCommand(REPAIR_UI_COMMANDS.scrubTimeline, { positionMs: targetOffset }).success,
    true
  );
  const restoredProjection = createRepairReplayProjection(
    runtime.getStateSnapshot().state,
    runtime.getStateSnapshot().state.sessions["psu-2025-0510"] ?? null
  );
  assert.equal(restoredProjection.aiMarkEventIds.includes(target.id), true);
});

test("repair-room opens the existing active session without replaying research setup", (t) => {
  t.mock.timers.enable({
    apis: ["Date", "setInterval", "setTimeout"],
    now: new Date("2026-05-11T09:00:00.000Z"),
  });
  const runtime = createRepairRoomHostRuntime().activate({
    log: () => {},
    notifyRoom: () => {},
  });

  assert.equal(runtime.getStateSnapshot().state.wizard.currentStep, "ready");
  assert.equal(runtime.getStateSnapshot().state.wizard.generatedKnowledgePackId, "bn44-00932a");
  assert.ok(
    runtime.getStateSnapshot().state.wizard.researchProgress.every((item) => item.completed)
  );

  assert.equal(runtime.handleCommand(REPAIR_UI_COMMANDS.uiReady).success, true);
  t.mock.timers.tick(4000);

  const wizard = runtime.getStateSnapshot().state.wizard;
  assert.equal(wizard.currentStep, "ready");
  assert.equal(wizard.foundResources.length, 4);
  assert.ok(wizard.researchProgress.every((item) => item.completed));

  runtime.dispose();
  t.mock.timers.reset();
});

test("repair-room live playhead advances from room activation instead of mock wall-clock age", (t) => {
  t.mock.timers.enable({
    apis: ["Date", "setInterval", "setTimeout"],
    now: new Date("2026-05-11T09:00:00.000Z"),
  });
  const runtime = createRepairRoomHostRuntime().activate({
    log: () => {},
    notifyRoom: () => {},
  });
  const before = runtime.getStateSnapshot().state.workbench.timeline.playheadMs;

  assert.equal(runtime.handleCommand(REPAIR_UI_COMMANDS.uiReady).success, true);
  t.mock.timers.tick(1100);

  const after = runtime.getStateSnapshot().state.workbench.timeline.playheadMs;
  assert.ok(after >= before);
  assert.ok(after - before <= 1200, `playhead drifted too far: ${after - before}ms`);
  assert.ok(after < 2_000_000, `playhead should stay near mock session edge, got ${after}ms`);

  runtime.dispose();
  t.mock.timers.reset();
});

test("repair-room runtime drifts live readings into recent instrument history", (t) => {
  t.mock.timers.enable({
    apis: ["Date", "setInterval", "setTimeout"],
    now: new Date("2026-05-11T09:00:00.000Z"),
  });
  const runtime = createRepairRoomHostRuntime().activate({
    log: () => {},
    notifyRoom: () => {},
  });
  const before = runtime.getStateSnapshot().state.measurement.recent.length;

  assert.equal(runtime.handleCommand(REPAIR_UI_COMMANDS.uiReady).success, true);
  t.mock.timers.tick(1100);

  const measurement = runtime.getStateSnapshot().state.measurement;
  assert.equal(measurement.recent.length, before + 1);
  assert.equal(measurement.recent[0]?.reference, "Live drift sample");
  assert.equal(measurement.current.display, "0.000");
  t.mock.timers.reset();
});
