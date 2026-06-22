import test from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { renderLabWaveformTimeline } from "../../rooms/laboratory/ui/lab-waveform-timeline.ts";
import { getLabLayoutKind, renderLabLayout } from "../../rooms/laboratory/ui/lab-layout.ts";
import { createLabI18n } from "../../rooms/laboratory/ui/lab-i18n.ts";
import { renderLabSourcePanel } from "../../rooms/laboratory/ui/lab-source-panel.ts";
import {
  buildLabDecisionSnapshot,
  deriveLabDecisionSignals,
  deriveLabDecisionSignalsFromState,
  readLabDecisionActiveBlocks,
  resolveLabDecisionIntent,
  resolveLabDecisionState,
} from "../../rooms/laboratory/ui/lab-decision-layer.ts";
import { createLabStore } from "../../rooms/laboratory/runtime/lab-store.ts";
import {
  formatLabUserActionDisplayText,
  translateLabRuntimeText,
} from "../../rooms/laboratory/ui/lab-runtime-i18n.ts";
import { createRoomBuiltArtifact } from "./helpers/room-installed-copy.ts";
import { readCssWithImports } from "./helpers/css-imports.ts";
import { importLabRootModuleWithDomStub } from "./laboratory-runtime-truth.helpers.ts";
import type { LabDecisionSnapshot, LabRun } from "../../rooms/laboratory/domain/lab-types.ts";
import type { LabWaveformTimelineModel } from "../../rooms/laboratory/ui/lab-waveform-timeline-types.ts";

describe("shell persistence and workbench", () => {
  void test("laboratory shell persists workspace-facing state and exposes tool lifecycle controls", () => {
    const labRootSource = readFileSync("rooms/laboratory/ui/lab-root.ts", "utf8");
    const toolOverlaySource = readFileSync(
      "rooms/laboratory/ui/tool-management-overlay.ts",
      "utf8"
    );
    const workspaceSurfaceSource = readFileSync("rooms/laboratory/ui/workspace-surface.ts", "utf8");
    const workspaceSourceIntakeSource = readFileSync(
      "rooms/laboratory/ui/workspace-source-intake.ts",
      "utf8"
    );
    const drawerSource = readFileSync("rooms/laboratory/ui/lab-drawer.ts", "utf8");
    const drawerResultExploreSource = readFileSync(
      "rooms/laboratory/ui/lab-drawer-result-explore.ts",
      "utf8"
    );
    const sourcePanelSource = readFileSync("rooms/laboratory/ui/lab-source-panel.ts", "utf8");
    const topBarSource = readFileSync("rooms/laboratory/ui/lab-top-bar.ts", "utf8");

    assert.match(labRootSource, /schemaVersion:\s*4,/);
    assert.match(
      labRootSource,
      /analysisPrepExpandedCapabilityIds:\s*_analysisPrepExpandedCapabilityIds,\s*\.\.\.workspace/
    );
    assert.match(labRootSource, /workspace,/);
    assert.match(
      labRootSource,
      /state\.run\.state === "running" \|\| state\.run\.state === "queued"/
    );
    assert.match(toolOverlaySource, /mediaAnalysis\.toolManager\.ariaLabel/);
    assert.match(toolOverlaySource, /data-lab-action="tool-check-all-updates"/);
    assert.match(toolOverlaySource, /data-lab-action="tool-update-selected"/);
    assert.match(toolOverlaySource, /data-lab-action="tool-install-review"/);
    assert.match(toolOverlaySource, /data-lab-action="tool-install-confirm"/);
    assert.match(toolOverlaySource, /data-lab-action="tool-job-cancel"/);
    assert.doesNotMatch(drawerSource, /renderSourceIntake\(state, copy\)/);
    assert.doesNotMatch(drawerSource, /renderLabProjectAssetsPanel/);
    assert.equal(existsSync("rooms/laboratory/ui/lab-project-assets-panel.ts"), false);
    assert.equal(existsSync("rooms/laboratory/ui/project-navigation.ts"), false);
    assert.equal(existsSync("rooms/laboratory/ui/asset-grid.ts"), false);
    assert.equal(existsSync("rooms/laboratory/ui/project-workspace-overlay.ts"), false);
    assert.match(sourcePanelSource, /renderProjectImportProgress\(state, copy\)/);
    assert.match(sourcePanelSource, /data-lab-field="project\.id"/);
    assert.doesNotMatch(labRootSource, /projectWorkspace|renderProjectWorkspaceOverlay/);
    assert.match(topBarSource, /data-lab-field="workspace\.hypothesis"/);
    assert.match(drawerResultExploreSource, /data-lab-action="run-deep-analysis"/);
    assert.match(drawerSource, /buildAnalysisPreviewSentence\(state\)/);
    assert.match(drawerResultExploreSource, /getLaboratoryRightPanelContext/);
    assert.doesNotMatch(
      drawerResultExploreSource,
      /buildExecutionBridge|formatDecisionCoherenceAdvisory|formatExecutionReadinessSignalAdvisory|getActiveExecutionAlternatives|data-lab-drawer-alternatives/
    );
    assert.match(workspaceSourceIntakeSource, /Source setup controls/);
    assert.doesNotMatch(workspaceSurfaceSource, /renderLabTopbarActions\(state, copy\)/);
    assert.doesNotMatch(workspaceSurfaceSource, /renderGlobalProcessSummary\(state, copy\)/);
  });
  void test("laboratory center workbench attaches media viewport and timeline as one surface", () => {
    const labTypesSource = readFileSync("rooms/laboratory/domain/lab-types.ts", "utf8");
    const workspaceSurfaceSource = readFileSync("rooms/laboratory/ui/workspace-surface.ts", "utf8");
    const workspaceSourceIntakeSource = readFileSync(
      "rooms/laboratory/ui/workspace-source-intake.ts",
      "utf8"
    );
    const laboratoryLayoutSource = readFileSync("rooms/laboratory/ui/laboratory-layout.ts", "utf8");
    const centerPanelSource = readFileSync("rooms/laboratory/ui/lab-center-panel.ts", "utf8");
    const topBarSource = readFileSync("rooms/laboratory/ui/lab-top-bar.ts", "utf8");
    const drawerSource = readFileSync("rooms/laboratory/ui/lab-drawer.ts", "utf8");
    const processStripSource = readFileSync("rooms/laboratory/ui/lab-process-strip.ts", "utf8");
    const timelineSource = readLabWaveformTimelineSource();
    const themeSource = readLabThemeSource();

    assert.match(labTypesSource, /export type LabPipelineBlock = \{/);
    assert.match(labTypesSource, /type: "section" \| "action" \| "status" \| "output";/);
    assert.match(laboratoryLayoutSource, /export function renderLaboratoryLayout/);
    assert.match(laboratoryLayoutSource, /export function renderMainStage/);
    assert.doesNotMatch(laboratoryLayoutSource, /export function renderLeftRail/);
    assert.match(laboratoryLayoutSource, /export function renderPreviewArea/);
    assert.match(laboratoryLayoutSource, /export function renderTimelineArea/);
    assert.match(laboratoryLayoutSource, /export function renderPipeline/);
    assert.match(laboratoryLayoutSource, /function getPipelineDebugShell\(/);
    assert.match(laboratoryLayoutSource, /\[lab\]\[pipeline\]/);
    assert.match(laboratoryLayoutSource, /data-block-id="\$\{escapeHtml\(block\.id\)\}"/);
    assert.match(laboratoryLayoutSource, /data-block-type="\$\{escapeHtml\(block\.type\)\}"/);
    assert.match(laboratoryLayoutSource, /data-block-mode="\$\{escapeHtml\(mode\)\}"/);
    assert.match(laboratoryLayoutSource, /export function renderContextPanel/);
    assert.match(laboratoryLayoutSource, /export function renderInspectorPanel/);
    assert.match(centerPanelSource, /renderMainStage\(surface\.main\)/);
    assert.match(
      laboratoryLayoutSource,
      /class="labx-center-panel labx-main-stage" data-lab-region="main-stage"/
    );
    assert.match(topBarSource, /class="labx-top-bar" data-lab-region="topbar"/);
    assert.match(topBarSource, /export function renderLabLeftRail/);
    assert.match(topBarSource, /class="labx-top-bar__center labx-top-bar__center--empty"/);
    assert.doesNotMatch(
      topBarSource,
      /class="labx-top-bar__center" data-lab-region="left-rail-source"/
    );
    assert.doesNotMatch(laboratoryLayoutSource, /data-lab-region="left-rail-source"/);
    assert.match(drawerSource, /renderContextPanel/);
    assert.match(
      drawerSource,
      /if \(collapsed\) \{[\s\S]*renderContextPanel\(\{[\s\S]*hidden: true/
    );
    assert.match(
      laboratoryLayoutSource,
      /class="labx-drawer labx-context-panel" data-lab-region="context-panel"/
    );
    assert.match(laboratoryLayoutSource, /data-empty="\$\{empty\}"/);
    assert.match(processStripSource, /data-lab-region="process-strip"/);
    assert.match(workspaceSurfaceSource, /class="labx-media-workbench"/);
    assert.match(workspaceSurfaceSource, /data-lab-region="main-stage-inner"/);
    assert.match(workspaceSurfaceSource, /renderPreviewArea\(/);
    assert.match(
      workspaceSurfaceSource,
      /renderTimelineArea\(durationMs > 0 && !comparisonPreviewActive \? renderLabWaveformTimeline\(timelineModel\) : ""\)/
    );
    assert.match(workspaceSurfaceSource, /renderInspectorPanel\(/);
    assert.match(
      workspaceSurfaceSource,
      /panels\.length === 0[\s\S]*renderInspectorPanel\(\{[\s\S]*empty: true,[\s\S]*hidden: true/
    );
    assert.match(laboratoryLayoutSource, /data-lab-region="preview-area"/);
    assert.match(laboratoryLayoutSource, /data-lab-region="inspector-panel"/);
    assert.match(laboratoryLayoutSource, /data-timeline-empty="true"/);
    assert.match(laboratoryLayoutSource, /hidden aria-hidden="true"/);
    assert.match(workspaceSurfaceSource, /class="labx-workspace-stage"/);
    assert.match(workspaceSurfaceSource, /renderWorkspaceInspectorDrawer/);
    assert.match(laboratoryLayoutSource, /data-lab-workspace-inspector="true"/);
    assert.match(workspaceSurfaceSource, /data-lab-action="workspace-controls-drawer-toggle"/);
    assert.match(workspaceSurfaceSource, /data-lab-action="workspace-controls-tab-select"/);
    assert.doesNotMatch(drawerSource, /renderDrawerWorkspaceControls/);
    assert.doesNotMatch(drawerSource, /data-lab-drawer-workspace-controls="true"/);
    assert.match(workspaceSurfaceSource, /data-lab-media-workbench="true"/);
    assert.doesNotMatch(laboratoryLayoutSource, /data-preview-mode/);
    assert.doesNotMatch(workspaceSurfaceSource, /data-preview-mode/);
    assert.match(workspaceSurfaceSource, /data-lab-workspace-comparison-stage="true"/);
    assert.match(
      workspaceSurfaceSource,
      /data-lab-workspace-comparison-stage="true"[\s\S]*data-lab-selection-roi-stage="true"/
    );
    assert.match(workspaceSurfaceSource, /renderMediaStage\("primary"/);
    assert.match(workspaceSurfaceSource, /renderMediaStage\("reference"/);
    assert.match(workspaceSurfaceSource, /renderComparisonOverlay\(side\)/);
    assert.match(workspaceSurfaceSource, /buildPreviewFilterState\(input\.settings\.primary/);
    assert.match(workspaceSurfaceSource, /buildPreviewFilterState\(input\.settings\.reference/);
    assert.match(workspaceSurfaceSource, /data-lab-comparison-roi-side="\$\{side\}"/);
    assert.match(workspaceSurfaceSource, /data-active="\$\{getActiveFlag\(side\)\}"/);
    assert.match(workspaceSurfaceSource, /data-active-side="\$\{input\.activeSide\}"/);
    assert.match(workspaceSurfaceSource, /data-lab-preserve-media="workspace-comparison-primary"/);
    assert.match(
      workspaceSurfaceSource,
      /data-lab-preserve-media="workspace-comparison-reference"/
    );
    assert.match(
      workspaceSourceIntakeSource,
      /const controls = options\.controls === true \? "controls" : "";/
    );
    assert.match(workspaceSurfaceSource, /data-lab-selection-roi-controls-reserve="0"/);
    assert.match(timelineSource, /data-lab-action="timeline-toggle-playback"/);
    assert.match(
      timelineSource,
      /class="labx-timeline labx-timeline-area\$\{focusClassName\}" id="lab-timeline" data-lab-region="timeline-area"/
    );
    assert.match(timelineSource, /data-lab-role="timeline-volume"/);
    assert.match(timelineSource, /data-lab-role="timeline-bookmark-note"/);
    assert.match(timelineSource, /data-lab-action="timeline-add-bookmark"/);
    assert.match(timelineSource, /data-lab-action="timeline-remove-bookmark"/);
    assert.match(timelineSource, /labx-timeline__pin-popover/);
    assert.match(timelineSource, /transportVolume/);
    assert.doesNotMatch(timelineSource, /labx-timeline__range-info/);
    assert.doesNotMatch(timelineSource, /labx-timeline__numeric/);
    assert.doesNotMatch(timelineSource, /Start \(ms\)|End \(ms\)/);
    assert.doesNotMatch(themeSource, /\.labx-timeline__numeric/);
    assert.match(
      themeSource,
      /\.labx-shell\[data-lab-debug-regions="true"\] \[data-lab-region\]\s*\{/
    );
    assert.match(themeSource, /\.labx-pipeline-block\s*\{\s*display:\s*block;/);
    assert.match(
      themeSource,
      /\.labx-shell\[data-lab-debug-regions="true"\] \.labx-pipeline-block\s*\{[\s\S]*outline:\s*var\(--lab-shell-px-1\) dashed var\(--lab-shell-color-11\);/
    );
    const debugPanelRule =
      themeSource.match(
        /\.labx-shell\[data-lab-debug-regions="true"\] \.labx-debug-panel\s*\{([\s\S]*?)\}/
      )?.[1] ?? "";
    assert.match(debugPanelRule, /position:\s*(absolute|fixed);/);
    assert.match(debugPanelRule, /pointer-events:\s*none;/);
    assert.doesNotMatch(debugPanelRule, /grid-area:/);
    assert.doesNotMatch(debugPanelRule, /margin:/);
    assert.doesNotMatch(themeSource, /^\.labx-pipeline-block\s*\{[^}]*outline:/m);
    assert.match(
      themeSource,
      /\.labx-drawer\[hidden\],[\s\S]*\.labx-workspace-inspector\[hidden\]\s*\{[\s\S]*display:\s*none;/
    );
    assert.match(themeSource, /\[data-lab-region="topbar"\]/);
    assert.match(themeSource, /\[data-lab-region="main-stage-inner"\]/);
    assert.match(themeSource, /\[data-lab-region="process-strip"\]/);
    assert.doesNotMatch(themeSource, /^\[data-lab-region\]\s*\{/m);
    assert.doesNotMatch(workspaceSurfaceSource, /renderWorkspaceBookmarks|workspace-bookmarks/);
    assert.match(
      workspaceSurfaceSource,
      /class="labx-workspace-stage"[\s\S]*class="labx-media-workbench"[\s\S]*renderPreviewArea\(\{ content: previewMarkup, focusClassName: previewFocusClassName \}\)[\s\S]*renderTimelineArea\(durationMs > 0 && !comparisonPreviewActive \? renderLabWaveformTimeline\(timelineModel\) : ""\)/
    );
    assert.match(workspaceSurfaceSource, /renderCapabilityCard\([\s\S]*\{ hideTitle: true \}/);
    assert.doesNotMatch(
      workspaceSurfaceSource,
      /class="labx-workspace-stage"[\s\S]*\$\{inspectorMarkup\}/
    );
    assert.match(
      workspaceSurfaceSource,
      /return \{ inspector: inspectorMarkup, main, side: selectionPanelMarkup \};/
    );
    assert.doesNotMatch(workspaceSurfaceSource, /renderWorkspaceHypothesis/);
    assert.match(
      themeSource,
      /\.labx-media-workbench\s*\{[\s\S]*gap:\s*0;[\s\S]*min-height:\s*0;[\s\S]*border:\s*var\(--lab-workspace-px-1\) solid var\(--lab-border-default\);[\s\S]*border-radius:\s*var\(--lab-radius-lg\);/
    );
    assert.match(
      themeSource,
      /\.labx-workspace-preview\s*\{[\s\S]*min-height:\s*0;[\s\S]*height:\s*100%;[\s\S]*border:\s*var\(--lab-workspace-px-1\) solid transparent;[\s\S]*border-radius:\s*0;[\s\S]*box-shadow:\s*none;/
    );
    assert.match(
      themeSource,
      /\.labx-focus-primary,[\s\S]*\.labx-focus-secondary,[\s\S]*\.labx-focus-passive\s*\{[\s\S]*opacity var\(--lab-duration-base\) var\(--lab-ease-out\),[\s\S]*filter var\(--lab-duration-base\) var\(--lab-ease-out\),[\s\S]*box-shadow var\(--lab-duration-base\) var\(--lab-ease-out\);/
    );
    assert.match(
      themeSource,
      /\.labx-workspace-preview\.labx-focus-primary\s*\{[\s\S]*border:\s*var\(--lab-workspace-px-1\) solid var\(--lab-accent\);[\s\S]*box-shadow:[\s\S]*0 0 0 var\(--lab-workspace-px-1\) var\(--lab-accent-soft\),[\s\S]*var\(--lab-glow-accent\);/
    );
    assert.match(
      themeSource,
      /\.labx-workspace-preview\.labx-focus-passive\s*\{[\s\S]*opacity:\s*0\.85;[\s\S]*filter:\s*brightness\(0\.85\);/
    );
    assert.match(themeSource, /\.labx-timeline\.labx-focus-secondary\s*\{[\s\S]*opacity:\s*1;/);
    assert.match(themeSource, /\.labx-timeline\.labx-focus-passive\s*\{[\s\S]*opacity:\s*0\.7;/);
    assert.match(
      themeSource,
      /\.labx-timeline\[hidden\],[\s\S]*\.labx-timeline-area--empty\s*\{[\s\S]*display:\s*none;/
    );
    assert.match(
      themeSource,
      /\.labx-timeline\[data-timeline-locked="true"\]\.labx-focus-secondary\s*\{[\s\S]*opacity:\s*1;/
    );
    assert.match(
      themeSource,
      /\.labx-timeline\[data-timeline-locked="true"\]\.labx-focus-passive\s*\{[\s\S]*opacity:\s*0\.7;/
    );
    assert.match(
      themeSource,
      /\.labx-workspace-inspector\.labx-focus-secondary\s*\{[\s\S]*opacity:\s*1;/
    );
    assert.match(
      themeSource,
      /\.labx-workspace-inspector\.labx-focus-passive\s*\{[\s\S]*opacity:\s*0\.5;/
    );
    assert.match(
      themeSource,
      /@media \(prefers-reduced-motion:\s*reduce\)\s*\{[\s\S]*transition:\s*none;/
    );
    assert.match(
      themeSource,
      /\.labx-workspace-stage\s*\{[\s\S]*position:\s*relative;[\s\S]*flex:\s*1 1 auto;[\s\S]*min-height:\s*0;/
    );
    assert.match(
      themeSource,
      /\.labx-workspace-inspector\s*\{[\s\S]*position:\s*relative;[\s\S]*z-index:\s*1;[\s\S]*width:\s*100%;[\s\S]*height:\s*100%;/
    );
    assert.match(
      themeSource,
      /\.labx-workspace-inspector\[data-open="false"\]\s*\.labx-workspace-inspector__body\s*\{[\s\S]*display:\s*none;/
    );
    assert.doesNotMatch(themeSource, /\.labx-audio-focus__header\s*\{/);
    assert.match(
      themeSource,
      /\.labx-media-workbench\s*>\s*\.labx-timeline\s*\{[\s\S]*padding:\s*0 0 var\(--lab-workspace-rem-0-45\);[\s\S]*border-width:\s*0;[\s\S]*border-radius:\s*0;[\s\S]*box-shadow:\s*none;/
    );
    assert.match(
      themeSource,
      /\.labx-timeline__track\s*\{[\s\S]*height:\s*var\(--lab-workspace-rem-3-5\);/
    );
    assert.match(themeSource, /\.labx-timeline__controls\s*\{[\s\S]*display:\s*grid;/);
    assert.match(themeSource, /\.labx-timeline__controls-row\s*\{[\s\S]*flex-wrap:\s*nowrap;/);
    assert.match(themeSource, /\.labx-timeline__transport\s*\{/);
    assert.match(themeSource, /\.labx-timeline__volume\s*\{/);
    assert.match(themeSource, /\.labx-timeline__speed\s*\{/);
    assert.match(themeSource, /\.labx-timeline__bookmark\s*\{/);
    assert.match(themeSource, /\.labx-timeline__selection-group\s*\{/);
    assert.match(
      themeSource,
      /\.labx-timeline__pin-popover\s*\{[\s\S]*bottom:\s*calc\(100% \+ var\(--lab-timeline-roi-rem-0-35\)\);/
    );
    assert.match(themeSource, /\.labx-timeline__pin-remove\s*\{/);
    assert.doesNotMatch(themeSource, /\.labx-timeline__range-info\s*\{/);
    assert.doesNotMatch(themeSource, /\.labx-bookmarks\s*\{/);
    assert.doesNotMatch(themeSource, /\.labx-timeline__header\s*\{/);
    assert.doesNotMatch(themeSource, /\.labx-timeline__sync\s*\{/);
    assert.doesNotMatch(themeSource, /\.labx-dual-preview-transport\s*\{/);
    assert.match(
      themeSource,
      /\.labx-media-workbench \.labx-preview-media--workspace-video,[\s\S]*\.labx-media-workbench \.labx-preview-media--workspace-image\s*\{[\s\S]*height:\s*100%;[\s\S]*max-height:\s*100%;/
    );
    assert.match(
      themeSource,
      /\.labx-preview-filter-wrap\s*\{[\s\S]*position:\s*relative;[\s\S]*width:\s*100%;[\s\S]*height:\s*100%;[\s\S]*max-height:\s*100%;[\s\S]*overflow:\s*hidden;/
    );
    assert.match(
      themeSource,
      /\.labx-channel-filter\s*\{[\s\S]*position:\s*absolute;[\s\S]*width:\s*0;[\s\S]*height:\s*0;[\s\S]*overflow:\s*hidden;[\s\S]*pointer-events:\s*none;/
    );
    assert.match(
      themeSource,
      /\.labx-preview-filter-wrap\s*>\s*\.labx-preview-media--workspace-video\s*\{[\s\S]*position:\s*absolute;[\s\S]*inset:\s*0;[\s\S]*height:\s*100%;[\s\S]*object-fit:\s*contain;/
    );
  });
});
