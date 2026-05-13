import test from "node:test";
import assert from "node:assert/strict";
import createRepairRoomHostRuntime from "../../rooms/repair-room/host/runtime.ts";
import { REPAIR_UI_COMMANDS } from "../../rooms/repair-room/shared/repair-constants.ts";
import { normalizeRepairHostMessage } from "../../rooms/repair-room/shared/ui/host-messages.ts";

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
  assert.equal(normalized.snapshot.tacticalFeed.length, 3);
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
