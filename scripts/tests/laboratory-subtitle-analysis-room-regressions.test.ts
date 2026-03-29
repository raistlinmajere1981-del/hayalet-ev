import test from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";

import { validateRoomManifest } from "../../src/types/rooms.ts";

const requiredSubtitleFiles = [
  "rooms/laboratory/host/runtime.ts",
  "rooms/laboratory/host/foundation-runtimes.ts",
  "rooms/laboratory/host/project-runtimes.ts",
  "rooms/laboratory/host/feature-runtimes.ts",
  "rooms/laboratory/main-functions/subtitle-analysis/host/action-handlers.ts",
  "rooms/laboratory/main-functions/subtitle-analysis/host/edit-workspace.ts",
  "rooms/laboratory/main-functions/subtitle-analysis/host/process-analysis.ts",
  "rooms/laboratory/main-functions/subtitle-analysis/host/runtime.ts",
  "rooms/laboratory/main-functions/subtitle-analysis/host/state-defaults.ts",
  "rooms/laboratory/main-functions/subtitle-analysis/host/state-normalization.ts",
  "rooms/laboratory/main-functions/subtitle-analysis/host/state-projects.ts",
  "rooms/laboratory/main-functions/subtitle-analysis/host/state.ts",
  "rooms/laboratory/main-functions/subtitle-analysis/host/source-intake.ts",
  "rooms/laboratory/main-functions/subtitle-analysis/host/youtube-discovery.ts",
  "rooms/laboratory/main-functions/subtitle-analysis/host/youtube-filters.ts",
  "rooms/laboratory/main-functions/subtitle-analysis/host/youtube-source.ts",
  "rooms/laboratory/shared/host/io-runtime.ts",
  "rooms/laboratory/shared/host/project-lifecycle.ts",
  "rooms/laboratory/shared/host/project-config-loader.ts",
  "rooms/laboratory/shared/host/project-records.ts",
  "rooms/laboratory/shared/host/project-storage.ts",
  "rooms/laboratory/shared/host/project-tool-status.ts",
  "rooms/laboratory/shared/host/process-managed-audio-runner.ts",
  "rooms/laboratory/shared/host/process-managed-media-runner.ts",
  "rooms/laboratory/shared/host/process-managed-runners.ts",
  "rooms/laboratory/shared/host/process-managed-subtitle-runner.ts",
  "rooms/laboratory/shared/host/process-report-state.ts",
  "rooms/laboratory/shared/host/runtime-primitives.ts",
  "rooms/laboratory/shared/host/runtime-bootstrap.ts",
  "rooms/laboratory/shared/host/process-runtime.ts",
  "rooms/laboratory/shared/host/preset-runtime.ts",
  "rooms/laboratory/shared/host/preset-source-runtime.ts",
  "rooms/laboratory/shared/host/preset-edit-runtime.ts",
  "rooms/laboratory/shared/host/preset-profile-runtime.ts",
  "rooms/laboratory/shared/host/room-snapshot.ts",
  "rooms/laboratory/shared/host/snapshot-composition.ts",
  "rooms/laboratory/shared/host/state-composition.ts",
  "rooms/laboratory/shared/host/subtitle-projection.ts",
  "rooms/laboratory/shared/host/reporting.ts",
  "rooms/laboratory/shared/host/reporting-feature-report.ts",
  "rooms/laboratory/shared/host/reporting-export.ts",
  "rooms/laboratory/shared/host/reporting-audio.ts",
  "rooms/laboratory/shared/host/reporting-subtitle.ts",
  "rooms/laboratory/shared/host/reporting-markdown.ts",
  "rooms/laboratory/main-functions/subtitle-analysis/ui/module.ts",
  "rooms/laboratory/main-functions/subtitle-analysis/ui/source-panels.ts",
  "rooms/laboratory/main-functions/subtitle-analysis/ui/source-panel-primitives.ts",
  "rooms/laboratory/main-functions/subtitle-analysis/ui/source-panel-process.ts",
  "rooms/laboratory/main-functions/subtitle-analysis/ui/source-panel-intake.ts",
  "rooms/laboratory/main-functions/subtitle-analysis/ui/source-panel-workspace.ts",
  "rooms/laboratory/main-functions/subtitle-analysis/ui/edit-panels.ts",
  "rooms/laboratory/main-functions/subtitle-analysis/ui/runtime.ts",
  "rooms/laboratory/shared/data/tools/subtitle-source-presets.json",
  "rooms/laboratory/shared/data/tools/subtitle-youtube.form.json",
  "rooms/laboratory/shared/data/tools/subtitle-edit-presets.json",
  "rooms/laboratory/shared/data/tools/subtitle-analysis-catalog.json",
  "rooms/laboratory/shared/data/tools/subtitle-analysis-capabilities.json",
  "rooms/laboratory/shared/data/tools/subtitle-analysis-providers.json",
];

test("laboratory workspace keeps the required subtitle-analysis package files", () => {
  requiredSubtitleFiles.forEach((filePath) => {
    assert.equal(existsSync(filePath), true, filePath);
  });
});

test("laboratory manifest exposes the subtitle-analysis feature beside media and audio", () => {
  const manifest = JSON.parse(readFileSync("rooms/laboratory/manifest.json", "utf8"));
  const validation = validateRoomManifest(manifest);
  const subtitleFeature = validation.manifest?.features.find((feature) => feature.id === "subtitle-analysis");

  assert.equal(validation.valid, true);
  assert.equal(validation.manifest?.features.length, 3);
  assert.equal(subtitleFeature?.name, "Subtitle Analysis");
  assert.equal(subtitleFeature?.scene?.hotspot.id, "laboratory-subtitle-analysis");
  assert.equal(subtitleFeature?.scene?.view.id, "subtitle-analysis-console");
  assert.equal(
    subtitleFeature?.scene?.view.backgroundSrc,
    "main-functions/subtitle-analysis/assets/subtitle-analysis.webp"
  );
});

test("laboratory host wires subtitle source, edit, and process actions into the shared room contract", () => {
  const hostSource = readFileSync("rooms/laboratory/host/index.ts", "utf8");
  const hostRuntimeSource = readFileSync("rooms/laboratory/host/runtime.ts", "utf8");
  const hostFoundationSource = readFileSync("rooms/laboratory/host/foundation-runtimes.ts", "utf8");
  const hostProjectSource = readFileSync("rooms/laboratory/host/project-runtimes.ts", "utf8");
  const hostFeatureSource = readFileSync("rooms/laboratory/host/feature-runtimes.ts", "utf8");
  const actionRouterSource = readFileSync("rooms/laboratory/shared/host/action-router.ts", "utf8");
  const subtitleActionSource = readFileSync(
    "rooms/laboratory/main-functions/subtitle-analysis/host/action-handlers.ts",
    "utf8"
  );
  const actionCompositionSource = readFileSync("rooms/laboratory/shared/host/action-composition.ts", "utf8");
  const actionRuntimeSource = readFileSync("rooms/laboratory/shared/host/action-runtime.ts", "utf8");
  const subtitleProcessSource = readFileSync(
    "rooms/laboratory/main-functions/subtitle-analysis/host/process-analysis.ts",
    "utf8"
  );
  const subtitleRuntimeSource = readFileSync(
    "rooms/laboratory/main-functions/subtitle-analysis/host/runtime.ts",
    "utf8"
  );
  const subtitleYoutubeSource = readFileSync(
    "rooms/laboratory/main-functions/subtitle-analysis/host/youtube-source.ts",
    "utf8"
  );
  const subtitleYoutubeDiscoverySource = readFileSync(
    "rooms/laboratory/main-functions/subtitle-analysis/host/youtube-discovery.ts",
    "utf8"
  );
  const subtitleYoutubeFiltersSource = readFileSync(
    "rooms/laboratory/main-functions/subtitle-analysis/host/youtube-filters.ts",
    "utf8"
  );
  const lifecycleSource = readFileSync("rooms/laboratory/shared/host/project-lifecycle.ts", "utf8");
  const projectConfigLoaderSource = readFileSync(
    "rooms/laboratory/shared/host/project-config-loader.ts",
    "utf8"
  );
  const projectStorageSource = readFileSync(
    "rooms/laboratory/shared/host/project-storage.ts",
    "utf8"
  );
  const projectToolStatusSource = readFileSync(
    "rooms/laboratory/shared/host/project-tool-status.ts",
    "utf8"
  );
  const reportingSource = readFileSync("rooms/laboratory/shared/host/reporting.ts", "utf8");
  const reportingFeatureSource = readFileSync(
    "rooms/laboratory/shared/host/reporting-feature-report.ts",
    "utf8"
  );
  const reportingExportSource = readFileSync(
    "rooms/laboratory/shared/host/reporting-export.ts",
    "utf8"
  );
  const reportingAudioSource = readFileSync(
    "rooms/laboratory/shared/host/reporting-audio.ts",
    "utf8"
  );
  const reportingSubtitleSource = readFileSync(
    "rooms/laboratory/shared/host/reporting-subtitle.ts",
    "utf8"
  );
  const reportingMarkdownSource = readFileSync(
    "rooms/laboratory/shared/host/reporting-markdown.ts",
    "utf8"
  );
  const projectRecordsSource = readFileSync("rooms/laboratory/shared/host/project-records.ts", "utf8");
  const subtitleProjectionSource = readFileSync("rooms/laboratory/shared/host/subtitle-projection.ts", "utf8");
  const subtitleStateSource = readFileSync(
    "rooms/laboratory/main-functions/subtitle-analysis/host/state.ts",
    "utf8"
  );
  const subtitleStateDefaultsSource = readFileSync(
    "rooms/laboratory/main-functions/subtitle-analysis/host/state-defaults.ts",
    "utf8"
  );
  const subtitleStateNormalizationSource = readFileSync(
    "rooms/laboratory/main-functions/subtitle-analysis/host/state-normalization.ts",
    "utf8"
  );
  const subtitleStateProjectsSource = readFileSync(
    "rooms/laboratory/main-functions/subtitle-analysis/host/state-projects.ts",
    "utf8"
  );
  const stateCompositionSource = readFileSync(
    "rooms/laboratory/shared/host/state-composition.ts",
    "utf8"
  );
  const processDelegatesSource = readFileSync("rooms/laboratory/shared/host/process-delegates.ts", "utf8");
  const processCompositionSource = readFileSync(
    "rooms/laboratory/shared/host/process-composition.ts",
    "utf8"
  );
  const featureAdaptersSource = readFileSync("rooms/laboratory/host/feature-adapters.ts", "utf8");
  const runtimePrimitivesSource = readFileSync(
    "rooms/laboratory/shared/host/runtime-primitives.ts",
    "utf8"
  );
  const hostCompositionSource = [
    hostRuntimeSource,
    hostFoundationSource,
    hostProjectSource,
    hostFeatureSource,
    featureAdaptersSource,
  ].join("\n");

  assert.match(hostSource, /\.\/runtime\.js/);
  assert.match(hostRuntimeSource, /shared\/host\/runtime-primitives\.js/);
  assert.match(hostRuntimeSource, /from "\.\/foundation-runtimes\.js"/);
  assert.match(hostRuntimeSource, /from "\.\/project-runtimes\.js"/);
  assert.match(hostRuntimeSource, /from "\.\/feature-runtimes\.js"/);
  assert.match(runtimePrimitivesSource, /export const LABORATORY_SUBTITLE_FEATURE_ID = "subtitle-analysis";/);
  assert.match(hostCompositionSource, /main-functions\/subtitle-analysis\/host\/runtime\.js/);
  assert.match(hostCompositionSource, /shared\/host\/state-composition\.js/);
  assert.match(hostCompositionSource, /shared\/host\/project-lifecycle\.js/);
  assert.match(hostCompositionSource, /shared\/host\/process-composition\.js/);
  assert.match(processCompositionSource, /from "\.\/process-delegates\.js"/);
  assert.match(hostCompositionSource, /shared\/host\/runtime-bootstrap\.js/);
  assert.match(hostCompositionSource, /from "\.\/feature-adapters\.js"/);
  assert.match(lifecycleSource, /from "\.\/project-config-loader\.js"/);
  assert.match(lifecycleSource, /from "\.\/project-storage\.js"/);
  assert.match(lifecycleSource, /from "\.\/project-tool-status\.js"/);
  assert.match(
    projectConfigLoaderSource,
    /export function createLaboratoryProjectConfigLoader\(deps\)/
  );
  assert.match(
    projectStorageSource,
    /export function createLaboratoryProjectStorageRuntime\(deps\)/
  );
  assert.match(
    projectToolStatusSource,
    /export function createLaboratoryProjectToolStatusRuntime\(deps\)/
  );
  assert.match(featureAdaptersSource, /shared\/host\/action-composition\.js/);
  assert.match(stateCompositionSource, /from "\.\/project-records\.js"/);
  assert.match(stateCompositionSource, /from "\.\/subtitle-projection\.js"/);
  assert.match(stateCompositionSource, /from "\.\/process-report-state\.js"/);
  assert.match(subtitleStateSource, /from "\.\/state-defaults\.js"/);
  assert.match(subtitleStateSource, /from "\.\/state-normalization\.js"/);
  assert.match(subtitleStateSource, /from "\.\/state-projects\.js"/);
  assert.match(
    subtitleStateDefaultsSource,
    /export function createSubtitleStateDefaultsRuntime\(deps\)/
  );
  assert.match(
    subtitleStateNormalizationSource,
    /export function createSubtitleStateNormalizationRuntime\(deps\)/
  );
  assert.match(
    subtitleStateProjectsSource,
    /export function createSubtitleStateProjectRuntime\(deps\)/
  );
  assert.match(
    stateCompositionSource,
    /from "\.\.\/\.\.\/main-functions\/subtitle-analysis\/host\/state\.js"/
  );
  assert.match(stateCompositionSource, /readFeatureProcessRecord\(\.\.\.args\) \{/);
  assert.match(stateCompositionSource, /readFeatureReportRecord\(\.\.\.args\) \{/);
  assert.match(
    stateCompositionSource,
    /export function createLaboratoryHostStateCompositionRuntime\(deps\)/
  );
  assert.match(projectConfigLoaderSource, /subtitle-source-presets\.json/);
  assert.match(projectConfigLoaderSource, /subtitle-youtube\.form\.json/);
  assert.match(projectConfigLoaderSource, /subtitle-edit-presets\.json/);
  assert.match(projectConfigLoaderSource, /subtitle-analysis-catalog\.json/);
  assert.match(projectConfigLoaderSource, /subtitle-analysis-capabilities\.json/);
  assert.match(projectConfigLoaderSource, /subtitle-analysis-providers\.json/);
  assert.match(projectStorageSource, /async function loadProjects\(runtime\)/);
  assert.match(projectToolStatusSource, /operation: "tool-probe"/);
  assert.match(reportingSource, /from "\.\/reporting-feature-report\.js"/);
  assert.match(reportingSource, /from "\.\/reporting-export\.js"/);
  assert.match(reportingFeatureSource, /from "\.\/reporting-subtitle\.js"/);
  assert.match(reportingFeatureSource, /from "\.\/reporting-markdown\.js"/);
  assert.match(
    reportingFeatureSource,
    /export function createLaboratoryFeatureReportRuntime\(deps\)/
  );
  assert.match(
    reportingExportSource,
    /export function createLaboratoryReportExportRuntime\(deps\)/
  );
  assert.match(reportingAudioSource, /export function createLaboratoryAudioReportRuntime\(deps\)/);
  assert.match(reportingSubtitleSource, /function composeSubtitleAnalysisReport\(runtime, project\)/);
  assert.match(reportingSubtitleSource, /subtitleAnalysis\.report\.summaryCards\.target/);
  assert.match(reportingMarkdownSource, /## Warnings/);
  assert.match(projectRecordsSource, /export function createLaboratoryProjectRecordsRuntime\(deps\)/);
  assert.match(subtitleProjectionSource, /export function createLaboratorySubtitleProjectionRuntime\(deps\)/);
  assert.match(actionCompositionSource, /export function createLaboratoryActionCompositionRuntime\(deps\)/);
  assert.match(actionRouterSource, /case "subtitle-source-set-mode":/);
  assert.match(actionRouterSource, /case "subtitle-source-pick-local":/);
  assert.match(actionRouterSource, /case "subtitle-source-pick-folder":/);
  assert.match(actionRouterSource, /case "subtitle-source-download-url":/);
  assert.match(actionRouterSource, /case "subtitle-source-discover-youtube":/);
  assert.match(actionRouterSource, /case "subtitle-source-download-youtube":/);
  assert.match(actionRouterSource, /case "subtitle-source-toggle-discovery":/);
  assert.match(actionRouterSource, /case "subtitle-edit-apply-preset":/);
  assert.match(actionRouterSource, /case "subtitle-edit-update-recipe":/);
  assert.match(actionRouterSource, /case "subtitle-edit-preview":/);
  assert.match(actionRouterSource, /case "subtitle-edit-apply":/);
  assert.match(
    hostCompositionSource,
    /laboratorySubtitleAnalysisHostRuntime = createLaboratorySubtitleAnalysisHostRuntime\(/
  );
  assert.doesNotMatch(hostCompositionSource, /const laboratoryActionRouter = createLaboratoryActionRouter\(/);
  assert.match(
    subtitleRuntimeSource,
    /export function createLaboratorySubtitleAnalysisHostRuntime\(deps\)/
  );
  assert.match(subtitleActionSource, /async function setSourceMode\(runtime, actionPayload\)/);
  assert.match(subtitleActionSource, /async function toggleSelection\(runtime, actionPayload\)/);
  assert.match(subtitleActionSource, /async function previewEdit\(runtime, requestId, actionPayload\)/);
  assert.match(
    subtitleRuntimeSource,
    /handleSubtitleYoutubeDiscovery: subtitleYoutubeSourceRuntime\.handleYoutubeDiscovery/
  );
  assert.match(subtitleYoutubeSource, /from "\.\/youtube-discovery\.js"/);
  assert.match(subtitleYoutubeSource, /from "\.\/youtube-filters\.js"/);
  assert.match(subtitleYoutubeSource, /const subtitleYoutubeFilterRuntime = createSubtitleYoutubeFilterRuntime\(/);
  assert.match(
    subtitleYoutubeSource,
    /const subtitleYoutubeDiscoveryRuntime = createSubtitleYoutubeDiscoveryRuntime\(/
  );
  assert.match(subtitleYoutubeDiscoverySource, /export function createSubtitleYoutubeDiscoveryRuntime\(deps\)/);
  assert.match(subtitleYoutubeDiscoverySource, /async function collectSubtitleYoutubeDiscovery\(/);
  assert.match(subtitleYoutubeFiltersSource, /export function createSubtitleYoutubeFilterRuntime\(deps\)/);
  assert.match(subtitleYoutubeFiltersSource, /function needsSubtitleYoutubeMetadataFiltering\(drafts\)/);
  assert.match(subtitleRuntimeSource, /buildSubtitleProcessModules\(runtime, target\)/);
  assert.match(subtitleRuntimeSource, /buildSubtitleAnalysisStats\(runtime, project, target\)/);
  assert.match(actionRuntimeSource, /export function createLaboratoryHostActionRuntime\(deps\)/);
  assert.match(actionRuntimeSource, /function handleMediaAction\(api, runtime, payload\)/);
  assert.match(actionRuntimeSource, /function handleToolMutation\(api, runtime, requestId, action, toolId, featureStage\)/);
  assert.match(subtitleProcessSource, /function buildSubtitleProcessModules\(runtime, target\)/);
  assert.match(subtitleProcessSource, /async function buildSubtitleAnalysisStats\(runtime, project, target\)/);
  assert.doesNotMatch(hostCompositionSource, /const laboratoryActionRouter = createLaboratoryActionRouter\(/);
  assert.match(processDelegatesSource, /function composeSubtitleAnalysisReport\(runtime, project\)/);
});

test("laboratory UI renders subtitle source and edit workspaces on the shared shell", () => {
  const uiSource = readFileSync("rooms/laboratory/ui/laboratory-ui-runtime.ts", "utf8");
  const bootstrapStateSource = readFileSync(
    "rooms/laboratory/ui/bootstrap-state-runtime.ts",
    "utf8"
  );
  const viewAccessorsRuntimeSource = readFileSync(
    "rooms/laboratory/ui/view-accessors-runtime.ts",
    "utf8"
  );
  const stageShellDelegatesSource = readFileSync(
    "rooms/laboratory/shared/ui/stage-shell-delegates.ts",
    "utf8"
  );
  const sourceStageCompositionSource = readFileSync(
    "rooms/laboratory/ui/source-stage-composition.ts",
    "utf8"
  );
  const subtitleAnalysisUiRuntimeSource = readFileSync(
    "rooms/laboratory/main-functions/subtitle-analysis/ui/runtime.ts",
    "utf8"
  );
  const subtitleModuleSource = readFileSync(
    "rooms/laboratory/main-functions/subtitle-analysis/ui/module.ts",
    "utf8"
  );
  const subtitleSourcePanelsSource = readFileSync(
    "rooms/laboratory/main-functions/subtitle-analysis/ui/source-panels.ts",
    "utf8"
  );
  const subtitleSourcePrimitivesSource = readFileSync(
    "rooms/laboratory/main-functions/subtitle-analysis/ui/source-panel-primitives.ts",
    "utf8"
  );
  const subtitleSourceProcessSource = readFileSync(
    "rooms/laboratory/main-functions/subtitle-analysis/ui/source-panel-process.ts",
    "utf8"
  );
  const subtitleSourceIntakeSource = readFileSync(
    "rooms/laboratory/main-functions/subtitle-analysis/ui/source-panel-intake.ts",
    "utf8"
  );
  const subtitleSourceWorkspaceSource = readFileSync(
    "rooms/laboratory/main-functions/subtitle-analysis/ui/source-panel-workspace.ts",
    "utf8"
  );
  const subtitleEditPanelsSource = readFileSync(
    "rooms/laboratory/main-functions/subtitle-analysis/ui/edit-panels.ts",
    "utf8"
  );

  assert.match(uiSource, /const SUBTITLE_FEATURE_ID = "subtitle-analysis";/);
  assert.match(uiSource, /\.\/bootstrap-state-runtime\.js/);
  assert.match(uiSource, /\.\/view-bindings-runtime\.js/);
  assert.match(uiSource, /shared\/ui\/stage-shell-delegates\.js/);
  assert.match(uiSource, /\.\/source-stage-composition\.js/);
  assert.match(bootstrapStateSource, /function createSubtitleLocalDrafts\(\)/);
  assert.match(uiSource, /main-functions\/subtitle-analysis\/ui\/runtime\.js/);
  assert.match(stageShellDelegatesSource, /function renderSourceStage\(\)/);
  assert.match(sourceStageCompositionSource, /createLaboratorySourceStageUi\(/);
  assert.match(viewAccessorsRuntimeSource, /function getSubtitleEntries\(\)/);
  assert.match(subtitleAnalysisUiRuntimeSource, /export function createSubtitleAnalysisUiRuntime\(deps\)/);
  assert.match(subtitleAnalysisUiRuntimeSource, /\.\.\/\.\.\/\.\.\/ui\/subtitle-panel-runtime\.js/);
  assert.match(subtitleAnalysisUiRuntimeSource, /function renderSubtitleSourceIntakePanel\(\)/);
  assert.match(subtitleAnalysisUiRuntimeSource, /function renderSubtitleEntryPanel\(\)/);
  assert.match(subtitleAnalysisUiRuntimeSource, /function renderSubtitleDiscoveryPanel\(\)/);
  assert.match(subtitleAnalysisUiRuntimeSource, /function renderSubtitleEditStage\(\)/);
  assert.match(subtitleAnalysisUiRuntimeSource, /function renderSubtitlePreviewBody\(/);
  assert.match(subtitleModuleSource, /from "\.\/source-panels\.js"/);
  assert.match(subtitleModuleSource, /from "\.\/edit-panels\.js"/);
  assert.match(subtitleSourcePanelsSource, /from "\.\/source-panel-primitives\.js"/);
  assert.match(subtitleSourcePanelsSource, /from "\.\/source-panel-process\.js"/);
  assert.match(subtitleSourcePanelsSource, /from "\.\/source-panel-intake\.js"/);
  assert.match(subtitleSourcePanelsSource, /from "\.\/source-panel-workspace\.js"/);
  assert.match(
    subtitleSourcePrimitivesSource,
    /export function createSubtitleAnalysisSourcePanelPrimitives\(deps\)/
  );
  assert.match(
    subtitleSourceProcessSource,
    /export function createSubtitleAnalysisSourceProcessPanels\(deps\)/
  );
  assert.match(subtitleSourceIntakeSource, /data-action="subtitle-source-discover-youtube"/);
  assert.match(subtitleSourceIntakeSource, /data-action="subtitle-source-download-youtube"/);
  assert.match(subtitleSourceWorkspaceSource, /function renderSubtitleDiscoveryPanel\(\)/);
  assert.match(subtitleEditPanelsSource, /data-action="subtitle-edit-preview"/);
  assert.match(subtitleEditPanelsSource, /data-action="subtitle-edit-apply"/);
  assert.match(
    uiSource,
    /\[SUBTITLE_FEATURE_ID\]: "\.\.\/main-functions\/subtitle-analysis\/assets\/subtitle-analysis\.webp"/
  );
});

test("laboratory subtitle-analysis extends the project schema with subtitle workspace state", () => {
  const schema = JSON.parse(readFileSync("rooms/laboratory/shared/data/tools/project-schema.json", "utf8"));
  const form = JSON.parse(readFileSync("rooms/laboratory/shared/data/tools/subtitle-youtube.form.json", "utf8"));
  const catalog = JSON.parse(readFileSync("rooms/laboratory/shared/data/tools/subtitle-analysis-catalog.json", "utf8"));
  const capabilities = JSON.parse(readFileSync("rooms/laboratory/shared/data/tools/subtitle-analysis-capabilities.json", "utf8"));

  assert.equal(schema.project.required.includes("subtitleAnalysis"), true);
  assert.equal(Array.isArray(schema.project.subtitleAnalysis.required), true);
  assert.equal(schema.project.subtitleAnalysis.required.includes("workspace"), true);
  assert.equal(schema.project.subtitleAnalysis.required.includes("discovery"), true);
  assert.equal(schema.project.subtitleAnalysis.required.includes("entries"), true);
  assert.equal(schema.project.subtitleAnalysis.required.includes("edit"), true);
  assert.equal(schema.project.subtitleAnalysis.required.includes("analysis"), true);
  assert.equal(schema.project.subtitleAnalysis.required.includes("export"), true);
  assert.equal(Array.isArray(form.fields), true);
  assert.equal(form.fields.some((field) => field.id === "liveMode"), true);
  assert.equal(form.fields.some((field) => field.id === "titleInclude"), true);
  assert.equal(form.fields.some((field) => field.id === "titleExclude"), true);
  assert.equal(Array.isArray(catalog.modules), true);
  assert.equal(capabilities.modules["format-qc"]?.status, "ready");
  assert.equal(capabilities.modules["semantic-search"]?.status, "planned");
});
