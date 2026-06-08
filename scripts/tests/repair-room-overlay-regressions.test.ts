import test from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { REPAIR_UI_COMMANDS } from "../../rooms/repair-room/shared/repair-constants.ts";
import { createRepairDefaultGuidanceProjection } from "../../rooms/repair-room/shared/ui/state.ts";
import { resolveRepairAssetUrl } from "../../rooms/repair-room/ui/repair-asset-url.ts";
import {
  REPAIR_DOCK_PANEL_IDS,
  getRepairDockLayoutProjection,
} from "../../rooms/repair-room/ui/repair-room-ui-runtime.ts";
import {
  getContainedImageFrame,
  imagePointToStagePoint,
  imageRectToStageRect,
  stagePointToImagePoint,
} from "../../rooms/repair-room/ui/overlay/overlay-coords.ts";
import {
  applyRepairOverlaySelectionMode,
  getRepairFocusFrame,
  getRepairMarqueeSelection,
  getRepairSnapAssist,
  repairImageRectsIntersect,
} from "../../rooms/repair-room/ui/overlay/overlay-geometry.ts";

function countGridTemplateTracks(template: string): number {
  if (template === "none") return 0;
  return template.trim().split(/\s+/).filter(Boolean).length;
}

test("repair-room overlay coordinate mapping round-trips image and stage space", () => {
  const frame = getContainedImageFrame(1000, 600, 1600, 900);
  assert.equal(frame.widthPx, 1000);
  assert.equal(frame.heightPx, 562.5);
  assert.equal(frame.leftPx, 0);
  assert.equal(frame.topPx, 18.75);

  const viewport = { zoom: 1.5, panXPx: 24, panYPx: -12 };
  const stagePoint = imagePointToStagePoint({ xPx: 400, yPx: 180 }, frame, viewport);
  const imagePoint = stagePointToImagePoint(stagePoint, frame, viewport);
  assert.equal(Math.round(imagePoint.xPx), 400);
  assert.equal(Math.round(imagePoint.yPx), 180);

  const stageRect = imageRectToStageRect(
    { xPx: 100, yPx: 80, widthPx: 240, heightPx: 120 },
    frame,
    viewport
  );
  assert.equal(stageRect.widthPx, 225);
  assert.equal(stageRect.heightPx, 112.5);
});

test("repair-room Phase 2.8 geometry helpers cover marquee, refs, snap, and focus framing", () => {
  assert.equal(
    repairImageRectsIntersect(
      { xPx: 10, yPx: 10, widthPx: 20, heightPx: 20 },
      { xPx: 25, yPx: 25, widthPx: 10, heightPx: 10 }
    ),
    true
  );

  const selected = getRepairMarqueeSelection({ xPx: 0, yPx: 0, widthPx: 80, heightPx: 80 }, [
    { ref: { kind: "event", id: "evt-a" }, rect: { xPx: 20, yPx: 20, widthPx: 20, heightPx: 20 } },
    {
      ref: { kind: "investigation-region", id: "region-b" },
      rect: { xPx: 120, yPx: 120, widthPx: 20, heightPx: 20 },
    },
  ]);
  assert.deepEqual(selected, [{ kind: "event", id: "evt-a" }]);

  assert.deepEqual(
    applyRepairOverlaySelectionMode(
      [{ kind: "event", id: "evt-a" }],
      [
        { kind: "event", id: "evt-a" },
        { kind: "knowledge-region", id: "k1" },
      ],
      "toggle"
    ),
    [{ kind: "knowledge-region", id: "k1" }]
  );

  const softSnap = getRepairSnapAssist({ xPx: 48, yPx: 50 }, [{ xPx: 52, yPx: 50 }], 8, 2, false);
  assert.equal(softSnap?.softGuide, true);
  assert.equal(softSnap?.hardSnap, false);
  const hardSnap = getRepairSnapAssist({ xPx: 51, yPx: 50 }, [{ xPx: 52, yPx: 50 }], 8, 2, true);
  assert.equal(hardSnap?.hardSnap, true);

  assert.deepEqual(
    getRepairFocusFrame({ xPx: 4, yPx: 4, widthPx: 20, heightPx: 20 }, 100, 80, 12),
    { xPx: 0, yPx: 0, widthPx: 36, heightPx: 36 }
  );
});

test("repair-room keeps Konva pinned and isolated to the overlay module", () => {
  const packageJson = JSON.parse(readFileSync(join(process.cwd(), "package.json"), "utf8")) as {
    dependencies?: Record<string, string>;
  };
  assert.equal(packageJson.dependencies?.["konva"], "10.3.0");

  const overlayStagePath = join(process.cwd(), "rooms/repair-room/ui/overlay/overlay-stage.ts");
  const workbenchPanelPath = join(
    process.cwd(),
    "rooms/repair-room/ui/panels/workbench-stage-panel.ts"
  );
  const vendorPath = join(process.cwd(), "rooms/repair-room/shared/vendor/konva.min.js");
  assert.equal(existsSync(overlayStagePath), true);
  assert.equal(existsSync(vendorPath), true);
  const overlayStage = readFileSync(overlayStagePath, "utf8");
  assert.match(overlayStage, /shared\/vendor\/konva\.min\.js/);
  assert.match(overlayStage, /loadKonvaNamespace/);
  assert.doesNotMatch(overlayStage, /import\("konva"\)/);
  assert.doesNotMatch(readFileSync(workbenchPanelPath, "utf8"), /from "konva"|import\("konva"\)/);
});

test("repair-room resolves runtime assets from the UI entry directory", () => {
  const baseHref =
    "file:///home/raistlin/hayalet-ev/rooms/.build/repair-room/runtime/ui/index.html";

  assert.equal(
    resolveRepairAssetUrl("shared/assets/mock-pcb/atx-psu-top.svg", baseHref),
    "file:///home/raistlin/hayalet-ev/rooms/.build/repair-room/runtime/shared/assets/mock-pcb/atx-psu-top.svg"
  );
  assert.equal(
    resolveRepairAssetUrl(
      "main-functions/repair-workbench/assets/repair-workbench-view.svg",
      baseHref
    ),
    "file:///home/raistlin/hayalet-ev/rooms/.build/repair-room/runtime/main-functions/repair-workbench/assets/repair-workbench-view.svg"
  );
  assert.equal(
    resolveRepairAssetUrl("https://example.test/pcb.svg", baseHref),
    "https://example.test/pcb.svg"
  );
});

test("repair-room dock grid tracks match visible Phase 3 dock panels", () => {
  const cases = [
    ["operator-profile", "measurement"],
    ["operator-profile", "chat", "measurement"],
    ["operator-profile", "chat", "measurement", "room-sync"],
  ] as const;

  for (const visibleDockPanelIds of cases) {
    const panels = { ...createRepairDefaultGuidanceProjection("advanced").panelVisibility.panels };
    for (const panelId of REPAIR_DOCK_PANEL_IDS) {
      panels[panelId] = visibleDockPanelIds.includes(panelId) ? "compact" : "hidden";
    }

    const dockLayout = getRepairDockLayoutProjection(panels);
    assert.deepEqual(dockLayout.visiblePanelIds, [...visibleDockPanelIds]);
    assert.equal(
      countGridTemplateTracks(dockLayout.gridTemplateColumns),
      visibleDockPanelIds.length
    );
    assert.equal(dockLayout.gridTemplateColumns, visibleDockPanelIds.map(() => "1fr").join(" "));
  }
});

test("repair-room P1 UI exposes concrete wizard, feed, timeline, and sync controls", () => {
  const uiRoot = join(process.cwd(), "rooms/repair-room/ui");
  const runtime = readFileSync(join(uiRoot, "repair-room-ui-runtime.ts"), "utf8");
  const timelinePanel = readFileSync(join(uiRoot, "panels/visual-timeline-panel.ts"), "utf8");
  const knowledgePanel = readFileSync(join(uiRoot, "panels/knowledge-pack-panel.ts"), "utf8");
  const operatorPanel = readFileSync(join(uiRoot, "panels/operator-profile-panel.ts"), "utf8");
  const workbenchPanel = readFileSync(join(uiRoot, "panels/workbench-stage-panel.ts"), "utf8");
  const wizardPanel = readFileSync(join(uiRoot, "panels/session-wizard-panel.ts"), "utf8");
  const feedPanel = readFileSync(join(uiRoot, "panels/tactical-feed-panel.ts"), "utf8");
  const roomSyncPanel = readFileSync(join(uiRoot, "panels/room-sync-panel.ts"), "utf8");
  const overlayStage = readFileSync(join(uiRoot, "overlay/overlay-stage.ts"), "utf8");
  const style = readFileSync(join(uiRoot, "style.css"), "utf8");
  const replayProjection = readFileSync(
    join(process.cwd(), "rooms/repair-room/host/state/repair-replay-projection.ts"),
    "utf8"
  );
  const mockEvents = readFileSync(
    join(process.cwd(), "rooms/repair-room/shared/data/mock-events.ts"),
    "utf8"
  );
  const mockKnowledge = readFileSync(
    join(process.cwd(), "rooms/repair-room/shared/data/mock-knowledge-packs.ts"),
    "utf8"
  );

  assert.match(runtime, /renderRoomSyncPanel/);
  assert.match(runtime, /timeline-scrub/);
  assert.match(runtime, /applyLiveSnapshotUpdates/);
  assert.match(runtime, /timelineShape/);
  assert.match(runtime, /ensurePersistentShell/);
  assert.match(runtime, /createPanelLifecycle/);
  assert.match(runtime, /updateWorkbenchPanelDom/);
  assert.match(runtime, /updateTacticalFeedPanelDom/);
  assert.match(runtime, /updateVisualTimelinePanelDom/);
  assert.match(runtime, /updateMeasurementPanelDom/);
  assert.match(runtime, /updateRoomSyncPanelDom/);
  assert.match(runtime, /syncTimelineChips/);
  assert.match(runtime, /syncTacticalFeedEntry/);
  assert.match(runtime, /panelId === "visual-timeline"/);
  assert.match(runtime, /panelId === "tactical-feed"/);
  assert.match(runtime, /panelId === "measurement"/);
  assert.match(runtime, /panelId === "room-sync"/);
  assert.match(runtime, /setClassNameIfChanged/);
  assert.match(runtime, /overlayMountVersion/);
  assert.match(runtime, /currentConfig === null/);
  assert.match(runtime, /currentConfig\.container !== overlayConfig\.container/);
  assert.match(runtime, /requestRuntime\.updateViewport/);
  assert.doesNotMatch(runtime, /from "gsap"/);
  assert.match(runtime, /createSpatialFocusTween/);
  assert.match(runtime, /requestAnimationFrame/);
  assert.match(runtime, /cancelAnimationFrame/);
  assert.match(runtime, /syncSpatialFocusTween/);
  assert.match(runtime, /cancelSpatialFocusTween/);
  assert.match(runtime, /onComplete/);
  assert.match(runtime, /requestRuntime\.focusLiveEdge/);
  assert.match(runtime, /requestRuntime\.updateTimeline/);
  assert.match(runtime, /requestRuntime\.updatePanelLayout/);
  assert.match(runtime, /requestRuntime\.updatePanelTab/);
  assert.match(runtime, /requestRuntime\.updateFocus/);
  assert.match(runtime, /meta\.replay\.overlayEvents/);
  assert.match(runtime, /timeline-play/);
  assert.match(runtime, /knowledge-spatial-focus/);
  assert.doesNotMatch(runtime, /requestRuntime\.updateLayout/);
  assert.doesNotMatch(runtime, /destroyOverlays/);
  assert.doesNotMatch(runtime, /timeline: state\\.workbench\\.timeline/);
  assert.doesNotMatch(runtime, /measurement: state\\.measurement,/);
  assert.doesNotMatch(runtime, /playheadMs: state\\.workbench\\.timeline\\.playheadMs/);
  assert.doesNotMatch(runtime, /measurement: state\\.measurement\\.current\\.display/);
  assert.match(runtime, /case "Home"/);
  assert.match(runtime, /case "End"/);
  assert.match(runtime, /operator-profile-tab/);
  assert.match(runtime, /wizard-field/);
  assert.match(timelinePanel, /repair-timeline__playhead/);
  assert.match(timelinePanel, /repair-timeline__tick/);
  assert.match(timelinePanel, /repair-timeline__thumb/);
  assert.match(timelinePanel, /backgroundImage/);
  assert.match(timelinePanel, /resolveRepairAssetUrl/);
  assert.match(knowledgePanel, /repair-pack-preview__image/);
  assert.match(knowledgePanel, /resolveRepairAssetUrl/);
  assert.match(operatorPanel, /repair-tool-detail/);
  assert.match(overlayStage, /Ruler 10\.0 mm/);
  assert.match(overlayStage, /knowledgeRegions/);
  assert.match(overlayStage, /contextualCursor/);
  assert.match(overlayStage, /entityGroups/);
  assert.match(overlayStage, /investigationRegionGroups/);
  assert.match(overlayStage, /relationshipGroups/);
  assert.match(overlayStage, /knowledgeRegionGroups/);
  assert.match(overlayStage, /helperGroups/);
  assert.match(overlayStage, /syncMarqueeHelper/);
  assert.match(overlayStage, /syncSnapGuideHelper/);
  assert.match(overlayStage, /syncFocusEffectHelper/);
  assert.match(overlayStage, /syncFocusCalloutHelper/);
  assert.match(overlayStage, /getRepairMarqueeSelection/);
  assert.match(overlayStage, /getMeasurementRelationshipInteractionState/);
  assert.match(overlayStage, /hitStrokeWidth/);
  assert.match(overlayStage, /event\.stopPropagation\(\)/);
  assert.match(overlayStage, /syncEventEntity/);
  assert.match(overlayStage, /syncEntityLayerTransforms/);
  assert.match(overlayStage, /isReplayInteractionLocked/);
  assert.match(overlayStage, /RepairOverlayEventInteraction/);
  assert.match(overlayStage, /getInteractionFromKonvaEvent/);
  assert.match(overlayStage, /onSelectionClear/);
  assert.match(overlayStage, /addRectSelectionAssist/);
  assert.match(runtime, /clearSelection/);
  assert.match(runtime, /selectionMode/);
  assert.match(runtime, /ai-mark-state/);
  assert.match(runtime, /repair-annotation-inspector__links/);
  assert.match(roomSyncPanel, /repair-sync-focus__actions/);
  assert.match(roomSyncPanel, /ai-mark-state/);
  assert.match(replayProjection, /visibleAiMarkIds/);
  assert.doesNotMatch(overlayStage, /config\.onEntityClick\(\{ kind: "event", id: event\.id \}, interaction\);\s*config\.onEventClick\(event\.id, interaction\);/);
  assert.doesNotMatch(overlayStage, /config\.onEntityHover\(\{ kind: "event", id: event\.id \}\);\s*config\.onEventHover\(event\.id\);/);
  assert.doesNotMatch(overlayStage, /layers\.relationship\.listening\(false\)/);
  assert.doesNotMatch(overlayStage, /selection: currentConfig\.workbench\.selection/);
  assert.doesNotMatch(overlayStage, /viewport: currentConfig\.workbench\.viewport/);
  assert.doesNotMatch(overlayStage, /clearContainer\(activeLayers\.focus\)/);
  assert.doesNotMatch(overlayStage, /destroyChildren/);
  assert.match(overlayStage, /update: \(config: RepairOverlayStageConfig\) => void/);
  assert.match(overlayStage, /resize: \(\) => void/);
  assert.match(overlayStage, /ResizeObserver/);
  assert.match(overlayStage, /listening\(false\)/);
  assert.match(mockEvents, /thumbnailSrc: "shared\/assets\/mock-pcb\/atx-psu-top\.svg"/);
  assert.match(mockKnowledge, /bn44-00932a-schematic-preview\.svg/);
  assert.match(mockKnowledge, /spatialRef/);
  assert.match(mockEvents, /lifecycleState/);
  assert.match(wizardPanel, /repair-wizard-field__input/);
  assert.match(wizardPanel, /wizard-symptom/);
  assert.match(workbenchPanel, /set-voice-guidance/);
  assert.match(workbenchPanel, /set-attention-budget/);
  assert.match(runtime, /setVoiceGuidance/);
  assert.match(runtime, /setAttentionBudget/);
  assert.match(feedPanel, /repair-feed-composer__input/);
  assert.match(style, /\.repair-sync-panel/);
  assert.match(style, /\.repair-pack-preview/);
});

test("repair-room manifest command specs stay aligned with UI constants", () => {
  const manifest = JSON.parse(
    readFileSync(join(process.cwd(), "rooms/repair-room/manifest.json"), "utf8")
  ) as {
    features?: Array<{ commandSpecs?: Array<{ name?: string }> }>;
  };
  const commandNames = new Set(
    manifest.features?.flatMap(
      (feature) => feature.commandSpecs?.map((spec) => spec.name ?? "") ?? []
    ) ?? []
  );

  Object.values(REPAIR_UI_COMMANDS).forEach((commandName) => {
    assert.equal(commandNames.has(commandName), true, commandName);
  });
});
