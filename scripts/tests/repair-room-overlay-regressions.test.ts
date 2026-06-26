import test from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { REPAIR_UI_COMMANDS } from "../../rooms/repair-room/shared/repair-constants.ts";
import { createInitialRepairRuntimeState } from "../../rooms/repair-room/host/state/repair-runtime-state.ts";
import { createRepairUiSnapshot } from "../../rooms/repair-room/host/state/repair-selectors.ts";
import { resolveRepairAssetUrl } from "../../rooms/repair-room/ui/repair-asset-url.ts";
import {
  REPAIR_DOCK_PANEL_IDS,
  getRepairDockLayoutProjection,
} from "../../rooms/repair-room/ui/repair-room-ui-runtime.ts";
import { renderRepairSettingsPanel } from "../../rooms/repair-room/ui/panels/repair-settings-panel.ts";
import { renderChatPanel } from "../../rooms/repair-room/ui/panels/chat-panel.ts";
import { renderWorkbenchStagePanel } from "../../rooms/repair-room/ui/panels/workbench-stage-panel.ts";
import { renderOperatorProfilePanel } from "../../rooms/repair-room/ui/panels/operator-profile-panel.ts";
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

function readRepairUiStyleText(): string {
  const uiRoot = join(process.cwd(), "rooms/repair-room/ui");
  const entry = readFileSync(join(uiRoot, "style.css"), "utf8");
  const imported = [...entry.matchAll(/@import "\.\/styles\/([^"]+)";/g)]
    .map((match) => readFileSync(join(uiRoot, "styles", match[1] ?? ""), "utf8"))
    .join("\n");
  return `${entry}\n${imported}`;
}

function readRepairUiRuntimeText(): string {
  const uiRoot = join(process.cwd(), "rooms/repair-room/ui");
  return [
    "repair-room-ui-runtime.ts",
    "runtime/capture-status-handlers.ts",
    "runtime/dictation-composer.ts",
    "runtime/measurement-dom.ts",
    "runtime/overlay-runtime.ts",
    "runtime/panel-signatures.ts",
    "runtime/sync-inspector-dom.ts",
    "runtime/tactical-feed-dom.ts",
    "runtime/visual-timeline-dom.ts",
  ]
    .map((relativePath) => readFileSync(join(uiRoot, relativePath), "utf8"))
    .join("\n");
}

class RepairFakeElement {
  children: RepairFakeElement[] = [];
  parentElement: RepairFakeElement | null = null;
  dataset: Record<string, string> = {};
  className = "";
  textContent = "";
  innerHTML = "";
  type = "";
  title = "";
  value = "";
  draggable = true;
  style: Record<string, string> = {};

  constructor(readonly tagName: string) {}

  append(...children: RepairFakeElement[]): void {
    children.forEach((child) => {
      child.parentElement = this;
      this.children.push(child);
    });
  }
}

class RepairFakeDocument {
  createElement(tagName: string): RepairFakeElement {
    return new RepairFakeElement(tagName.toLowerCase());
  }
}

function findRepairFakeElements(
  root: RepairFakeElement,
  predicate: (element: RepairFakeElement) => boolean
): RepairFakeElement[] {
  const matches: RepairFakeElement[] = [];
  if (predicate(root)) matches.push(root);
  root.children.forEach((child) => {
    matches.push(...findRepairFakeElements(child, predicate));
  });
  return matches;
}

void test("repair-room overlay coordinate mapping round-trips image and stage space", () => {
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

void test("repair-room Phase 2.8 geometry helpers cover marquee, refs, snap, and focus framing", () => {
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
  assert.equal(softSnap.hardSnap, false);
  const hardSnap = getRepairSnapAssist({ xPx: 51, yPx: 50 }, [{ xPx: 52, yPx: 50 }], 8, 2, true);
  assert.equal(hardSnap?.hardSnap, true);

  assert.deepEqual(
    getRepairFocusFrame({ xPx: 4, yPx: 4, widthPx: 20, heightPx: 20 }, 100, 80, 12),
    { xPx: 0, yPx: 0, widthPx: 36, heightPx: 36 }
  );
});

void test("repair-room keeps Konva pinned and isolated to the overlay module", () => {
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
  const konvaLoader = readFileSync(
    join(process.cwd(), "rooms/repair-room/ui/overlay/konva-loader.ts"),
    "utf8"
  );
  assert.match(konvaLoader, /shared\/vendor\/konva\.min\.js/);
  assert.match(overlayStage, /loadKonvaNamespace/);
  assert.doesNotMatch(overlayStage, /import\("konva"\)/);
  assert.doesNotMatch(readFileSync(workbenchPanelPath, "utf8"), /from "konva"|import\("konva"\)/);
});

void test("repair-room resolves runtime assets from the UI entry directory", () => {
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

void test("repair-room dock always shows all panels", () => {
  const dockLayout = getRepairDockLayoutProjection();
  assert.deepEqual(dockLayout.visiblePanelIds, [...REPAIR_DOCK_PANEL_IDS]);
  assert.equal(dockLayout.gridTemplateColumns, "1fr 1fr 1fr");

  assert.deepEqual([...REPAIR_DOCK_PANEL_IDS], ["measurement", "chat", "room-sync"]);
});

void test("repair-room P1 UI exposes concrete wizard, feed, timeline, and sync controls", () => {
  const uiRoot = join(process.cwd(), "rooms/repair-room/ui");
  const runtime = readRepairUiRuntimeText();
  const timelinePanel = readFileSync(join(uiRoot, "panels/visual-timeline-panel.ts"), "utf8");
  const knowledgePanel = readFileSync(join(uiRoot, "panels/knowledge-pack-panel.ts"), "utf8");
  const operatorPanel = readFileSync(join(uiRoot, "panels/operator-profile-panel.ts"), "utf8");
  const settingsPanel = readFileSync(join(uiRoot, "panels/repair-settings-panel.ts"), "utf8");
  const workbenchPanel = readFileSync(join(uiRoot, "panels/workbench-stage-panel.ts"), "utf8");
  const chatPanel = readFileSync(join(uiRoot, "panels/chat-panel.ts"), "utf8");
  const wizardPanel = readFileSync(join(uiRoot, "panels/session-wizard-panel.ts"), "utf8");
  const symptomCatalog = readFileSync(
    join(process.cwd(), "rooms/repair-room/shared/data/repair-symptom-catalog.ts"),
    "utf8"
  );
  const sessionRailPanel = readFileSync(join(uiRoot, "panels/session-rail-panel.ts"), "utf8");
  const feedPanel = readFileSync(join(uiRoot, "panels/tactical-feed-panel.ts"), "utf8");
  const roomSyncPanel = readFileSync(join(uiRoot, "panels/room-sync-panel.ts"), "utf8");
  const overlayStage = readFileSync(join(uiRoot, "overlay/overlay-stage.ts"), "utf8");
  const style = readRepairUiStyleText();
  const hostMessages = readFileSync(
    join(process.cwd(), "rooms/repair-room/shared/ui/host-messages.ts"),
    "utf8"
  );
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

  assert.match(hostMessages, /RepairHostContextMessage/);
  assert.match(hostMessages, /type: "host-context"/);
  assert.match(hostMessages, /capture-dictation-status/);
  assert.match(hostMessages, /capture-ambient-status/);
  assert.match(hostMessages, /capture-media-ingress/);
  assert.match(hostMessages, /tts-status/);
  assert.match(hostMessages, /command-result/);
  assert.match(runtime, /case "host-context"/);
  assert.match(runtime, /handleCaptureDictationStatus/);
  assert.match(runtime, /handleCaptureAmbientStatus/);
  assert.match(runtime, /handleCaptureMediaIngress/);
  assert.match(runtime, /requestRuntime\.addTimelineEvent\(\{\s*kind: "snapshot"/);
  assert.match(runtime, /thumbnailSrc: msg\.asset\.path/);
  assert.match(runtime, /handleTtsStatus/);
  assert.match(runtime, /context\.translations = msg\.translations/);
  assert.match(runtime, /documentRef\.documentElement\.lang = context\.locale/);
  assert.match(runtime, /flushWizardFields/);
  assert.match(runtime, /data-repair-action='wizard-field'/);
  assert.match(runtime, /renderRoomSyncPanel/);
  assert.match(runtime, /renderOperatorProfilePanel/);
  assert.doesNotMatch(runtime, /renderRepairSettingsPanel\(/);
  assert.match(runtime, /repair-settings-overlay/);
  assert.match(runtime, /setSettingsOverlay/);
  assert.match(runtime, /set-settings-overlay/);
  assert.doesNotMatch(runtime, /repair-settings-overlay__tabs/);
  assert.match(operatorPanel, /\["operator", "tabs", "controls"\]/);
  assert.match(operatorPanel, /renderRepairSettingsPanelBody/);
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
  assert.match(runtime, /wizard-suggestion/);
  assert.match(runtime, /case "wizard-symptom"/);
  assert.match(runtime, /customSymptoms: Array\.from\(customSymptoms\)/);
  assert.match(runtime, /createWizardDeviceCascadePatch/);
  assert.match(runtime, /syncWizardDeviceCascadeDom/);
  assert.match(runtime, /syncSessionWizardStepperDom/);
  assert.match(runtime, /wizardDraft: patch/);
  assert.match(runtime, /el instanceof HTMLSelectElement/);
  assert.match(runtime, /armSessionRailDraftEchoGuard/);
  assert.match(runtime, /consumeSessionRailDraftEchoGuard/);
  assert.match(timelinePanel, /repair-timeline__playhead/);
  assert.match(timelinePanel, /repair-timeline__tick/);
  assert.match(timelinePanel, /repair-timeline__thumb/);
  assert.match(timelinePanel, /backgroundImage/);
  assert.match(timelinePanel, /resolveRepairAssetUrl/);
  assert.match(knowledgePanel, /repair-pack-preview__image/);
  assert.match(knowledgePanel, /resolveRepairAssetUrl/);
  assert.match(operatorPanel, /repair-profile-manager/);
  assert.match(operatorPanel, /operator-profile-update/);
  assert.match(operatorPanel, /profileKind/);
  assert.match(operatorPanel, /preferenceKey/);
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
  assert.match(runtime, /operator-profile-update/);
  assert.match(runtime, /updateOperatorProfile/);
  assert.match(runtime, /selectionMode/);
  assert.match(runtime, /ai-mark-state/);
  assert.match(runtime, /repair-annotation-inspector__links/);
  assert.match(roomSyncPanel, /repair-sync-focus__actions/);
  assert.match(roomSyncPanel, /ai-mark-state/);
  assert.match(replayProjection, /visibleAiMarkIds/);
  assert.doesNotMatch(
    overlayStage,
    /config\.onEntityClick\(\{ kind: "event", id: event\.id \}, interaction\);\s*config\.onEventClick\(event\.id, interaction\);/
  );
  assert.doesNotMatch(
    overlayStage,
    /config\.onEntityHover\(\{ kind: "event", id: event\.id \}\);\s*config\.onEventHover\(event\.id\);/
  );
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
  assert.match(wizardPanel, /repair-wizard-suggestions/);
  assert.match(wizardPanel, /wizard-suggestion/);
  assert.match(wizardPanel, /wizard-symptom/);
  assert.match(wizardPanel, /REPAIR_SYMPTOM_OPTIONS/);
  assert.match(wizardPanel, /REPAIR_SYMPTOM_CATALOG/);
  assert.match(wizardPanel, /getSymptomOptionsForWizardDraft/);
  assert.match(wizardPanel, /repair-wizard-symptom-group--available/);
  assert.match(wizardPanel, /repair-wizard-symptom-group--selected/);
  assert.doesNotMatch(wizardPanel, /const SYMPTOM_OPTIONS/);
  assert.match(symptomCatalog, /REPAIR_SYMPTOM_CATALOG/);
  assert.match(symptomCatalog, /deviceType: "Laptop anakart"/);
  assert.match(symptomCatalog, /deviceType: "TV guc karti \/ PSU"/);
  assert.match(symptomCatalog, /MacBook Air/);
  assert.match(symptomCatalog, /HDMI Retimer Fault/);
  assert.match(symptomCatalog, /No Power/);
  assert.match(symptomCatalog, /BIOS \/ EC Corruption/);
  assert.match(wizardPanel, /DEVICE_TYPE_OPTIONS/);
  assert.match(wizardPanel, /add-custom-symptom/);
  assert.match(wizardPanel, /remove-wizard-symptom/);
  assert.match(wizardPanel, /skip-wizard-research/);
  assert.match(wizardPanel, /evidence-selection/);
  assert.match(wizardPanel, /add-manual-knowledge-resource/);
  assert.match(wizardPanel, /add-manual-knowledge-failure/);
  assert.match(wizardPanel, /add-manual-knowledge-test-point/);
  assert.match(wizardPanel, /add-manual-knowledge-note/);
  assert.match(wizardPanel, /remove-knowledge-evidence/);
  assert.match(wizardPanel, /open-evidence-source/);
  assert.match(wizardPanel, /pick-manual-resource-file/);
  assert.match(wizardPanel, /Tamiri başlat/);
  assert.match(wizardPanel, /"Cihaz"/);
  assert.match(wizardPanel, /"Semptom"/);
  assert.match(wizardPanel, /"Araştırma"/);
  assert.match(wizardPanel, /"İnceleme"/);
  assert.match(wizardPanel, /"Hazır"/);
  assert.doesNotMatch(wizardPanel, /repair-panel-actions/);
  assert.doesNotMatch(wizardPanel, /createElement\("datalist"\)/);
  assert.doesNotMatch(wizardPanel, /Yeni Oturum|New Session/);
  assert.doesNotMatch(sessionRailPanel, /Session Rail/);
  assert.match(sessionRailPanel, /noPanelHeader: true/);
  assert.match(chatPanel, /composerDraft/);
  assert.match(workbenchPanel, /set-hands-free-mode/);
  assert.match(workbenchPanel, /toggle-ambient-listener/);
  assert.match(workbenchPanel, /toggle-dictation/);
  assert.match(workbenchPanel, /toggle-camera-feed/);
  assert.match(workbenchPanel, /toggle-tts/);
  assert.match(workbenchPanel, /set-attention-budget/);
  assert.match(runtime, /setVoiceGuidance/);
  assert.match(runtime, /setInteractionSettings/);
  assert.match(runtime, /setChatComposer/);
  assert.match(runtime, /handleTranscriptIngress/);
  assert.match(runtime, /setSettingsOverlay/);
  assert.match(runtime, /setAttentionBudget/);
  assert.match(hostMessages, /transcript-ingress/);
  assert.match(settingsPanel, /repair-settings-panel/);
  assert.match(settingsPanel, /set-interaction-settings/);
  assert.doesNotMatch(settingsPanel, /androidCompanionEnabled/);
  assert.doesNotMatch(settingsPanel, /dictationRoute/);
  assert.doesNotMatch(settingsPanel, /ttsRoute/);
  assert.doesNotMatch(settingsPanel, /cameraFeedPreference/);
  assert.doesNotMatch(settingsPanel, /set-attention-budget/);
  assert.match(feedPanel, /repair-feed-composer__input/);
  assert.match(style, /\.repair-sync-panel/);
  assert.match(style, /\.repair-settings-panel/);
  assert.match(style, /\.repair-settings-overlay/);
  assert.match(style, /\.repair-settings-overlay__content > \.repair-panel/);
  assert.match(style, /\.repair-pack-preview/);
  assert.match(style, /\.repair-wizard-symptom-group--available/);
  assert.match(style, /\.repair-wizard-symptom-group--selected/);
  assert.match(style, /\.repair-skill-chip/);
  assert.match(style, /\.repair-wizard-step--done \.repair-wizard-step__dot/);
  assert.match(style, /\.repair-wizard-step--incomplete \.repair-wizard-step__dot/);
  assert.match(style, /\.repair-wizard-step--disabled[\s\S]*color: var\(--repair-text-dim\)/);
  assert.doesNotMatch(style, /\.repair-wizard-step--done \{\s*color: var\(--repair-success\)/);
});

void test("repair-room manifest command specs stay aligned with UI constants", () => {
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

void test("repair-room hands-free controls stay action-oriented without duplicating topbar status", () => {
  const workbenchPanel = readFileSync(
    join(process.cwd(), "rooms/repair-room/ui/panels/workbench-stage-panel.ts"),
    "utf8"
  );
  const settingsPanel = readFileSync(
    join(process.cwd(), "rooms/repair-room/ui/panels/repair-settings-panel.ts"),
    "utf8"
  );
  const style = readRepairUiStyleText();
  const renderText = (_path: string[], fallback: string): string => fallback;
  const documentRef = new RepairFakeDocument() as unknown as Document;
  const offlineState = createRepairUiSnapshot(
    createInitialRepairRuntimeState("2026-06-12T09:00:00.000Z")
  );
  const offlinePanel = renderWorkbenchStagePanel(
    documentRef,
    offlineState,
    renderText
  ) as unknown as RepairFakeElement;
  assert.equal(
    findRepairFakeElements(
      offlinePanel,
      (element) => element.dataset["repairOperationStatus"] === "active"
    ).length,
    0
  );

  const activeState = createRepairUiSnapshot({
    ...createInitialRepairRuntimeState("2026-06-12T09:00:00.000Z"),
    operationsStatus: {
      updatedAt: 2,
      records: [
        {
          capability: "local-microphone",
          owner: { id: "repair-room", label: "Repair Room" },
          startedAt: 1,
        },
        {
          capability: "android-camera",
          owner: { id: "repair-room", label: "Repair Room" },
          startedAt: 2,
        },
        {
          capability: "live-feed",
          owner: { id: "repair-room", label: "Repair Room" },
          startedAt: 3,
        },
        {
          capability: "ambient-listening",
          owner: { id: "repair-room", label: "Repair Room" },
          startedAt: 4,
        },
      ],
    },
  });
  const activePanel = renderWorkbenchStagePanel(
    documentRef,
    activeState,
    renderText
  ) as unknown as RepairFakeElement;
  assert.equal(
    findRepairFakeElements(
      activePanel,
      (element) => element.dataset["repairOperationStatus"] === "active"
    ).length,
    0
  );
  assert.deepEqual(
    findRepairFakeElements(
      activePanel,
      (element) => typeof element.dataset["repairControl"] === "string"
    ).map((element) => element.dataset["repairControl"]),
    ["hands-free", "ambient", "dictation-route", "camera-feed", "tts-route"]
  );

  const settingsSurface = renderRepairSettingsPanel(
    documentRef,
    activeState,
    renderText
  ) as unknown as RepairFakeElement;
  const settingsActions = findRepairFakeElements(
    settingsSurface,
    (element) => element.dataset["repairAction"] === "set-interaction-settings"
  );
  assert.ok(settingsActions.length >= 3);
  assert.equal(
    findRepairFakeElements(
      settingsSurface,
      (element) => element.dataset["androidCompanionEnabled"] !== undefined
    ).length,
    0
  );
  assert.equal(
    findRepairFakeElements(
      settingsSurface,
      (element) => element.dataset["repairAction"] === "set-attention-budget"
    ).length,
    0
  );
  const setupControlsSurface = renderOperatorProfilePanel(
    documentRef,
    {
      ...activeState,
      layout: { ...activeState.layout, operatorProfileTabId: "controls" },
    },
    renderText
  ) as unknown as RepairFakeElement;
  const setupTabs = findRepairFakeElements(
    setupControlsSurface,
    (element) => element.dataset["repairAction"] === "operator-profile-tab"
  );
  assert.equal(
    setupTabs.some((element) => element.dataset["tabId"] === "controls"),
    true
  );
  assert.ok(
    findRepairFakeElements(
      setupControlsSurface,
      (element) => element.dataset["repairAction"] === "set-interaction-settings"
    ).length >= 3
  );
  assert.equal(
    findRepairFakeElements(
      setupControlsSurface,
      (element) => element.dataset["androidCompanionEnabled"] !== undefined
    ).length,
    0
  );
  assert.equal(
    findRepairFakeElements(
      setupControlsSurface,
      (element) => element.dataset["repairAction"] === "set-attention-budget"
    ).length,
    0
  );
  const chatSurface = renderChatPanel(
    documentRef,
    createRepairUiSnapshot({
      ...createInitialRepairRuntimeState("2026-06-12T09:00:00.000Z"),
      chat: {
        ...createInitialRepairRuntimeState("2026-06-12T09:00:00.000Z").chat,
        composerDraft: "Measure U14 VCC",
      },
    }),
    renderText
  ) as unknown as RepairFakeElement;
  const chatInputs = findRepairFakeElements(
    chatSurface,
    (element) => element.dataset["repairInput"] === "chat-composer"
  );
  assert.equal(chatInputs[0]?.value, "Measure U14 VCC");

  assert.match(workbenchPanel, /repairControl/);
  assert.match(workbenchPanel, /set-hands-free-mode/);
  assert.match(workbenchPanel, /toggle-ambient-listener/);
  assert.match(workbenchPanel, /toggle-dictation/);
  assert.match(workbenchPanel, /toggle-camera-feed/);
  assert.match(workbenchPanel, /toggle-tts/);
  assert.doesNotMatch(workbenchPanel, /set-settings-overlay/);
  assert.doesNotMatch(workbenchPanel, /bench-operator/);
  assert.doesNotMatch(workbenchPanel, /repair-controls/);
  assert.doesNotMatch(workbenchPanel, /getOperationalStatusChips/);
  assert.doesNotMatch(workbenchPanel, /repairOperationStatus/);
  assert.match(settingsPanel, /autoReadAiReplies/);
  assert.match(settingsPanel, /dictationSubmitMode/);
  assert.doesNotMatch(style, /\.repair-operation-status/);
  assert.match(style, /\.repair-settings-button/);
});
