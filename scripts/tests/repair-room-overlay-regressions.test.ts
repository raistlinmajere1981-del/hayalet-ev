import test from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { REPAIR_UI_COMMANDS } from "../../rooms/repair-room/shared/repair-constants.ts";
import { resolveRepairAssetUrl } from "../../rooms/repair-room/ui/repair-asset-url.ts";
import {
  getContainedImageFrame,
  imagePointToStagePoint,
  imageRectToStageRect,
  stagePointToImagePoint,
} from "../../rooms/repair-room/ui/overlay/overlay-coords.ts";

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

test("repair-room P1 UI exposes concrete wizard, feed, timeline, and sync controls", () => {
  const uiRoot = join(process.cwd(), "rooms/repair-room/ui");
  const runtime = readFileSync(join(uiRoot, "repair-room-ui-runtime.ts"), "utf8");
  const timelinePanel = readFileSync(join(uiRoot, "panels/visual-timeline-panel.ts"), "utf8");
  const knowledgePanel = readFileSync(join(uiRoot, "panels/knowledge-pack-panel.ts"), "utf8");
  const operatorPanel = readFileSync(join(uiRoot, "panels/operator-profile-panel.ts"), "utf8");
  const wizardPanel = readFileSync(join(uiRoot, "panels/session-wizard-panel.ts"), "utf8");
  const feedPanel = readFileSync(join(uiRoot, "panels/tactical-feed-panel.ts"), "utf8");
  const overlayStage = readFileSync(join(uiRoot, "overlay/overlay-stage.ts"), "utf8");
  const style = readFileSync(join(uiRoot, "style.css"), "utf8");
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
  assert.match(runtime, /requestRuntime\.updateTimeline/);
  assert.match(runtime, /requestRuntime\.updatePanelLayout/);
  assert.match(runtime, /requestRuntime\.updatePanelTab/);
  assert.match(runtime, /requestRuntime\.updateFocus/);
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
  assert.match(overlayStage, /update: \(config: RepairOverlayStageConfig\) => void/);
  assert.match(overlayStage, /resize: \(\) => void/);
  assert.match(overlayStage, /ResizeObserver/);
  assert.match(overlayStage, /listening\(false\)/);
  assert.match(mockEvents, /thumbnailSrc: "shared\/assets\/mock-pcb\/atx-psu-top\.svg"/);
  assert.match(mockKnowledge, /bn44-00932a-schematic-preview\.svg/);
  assert.match(wizardPanel, /repair-wizard-field__input/);
  assert.match(wizardPanel, /wizard-symptom/);
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
