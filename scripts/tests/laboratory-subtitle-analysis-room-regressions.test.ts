import test from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";

import { validateRoomManifest } from "../../src/types/rooms.ts";

const requiredSubtitleFiles = [
  "rooms/laboratory/host/runtime.js",
  "rooms/laboratory/main-functions/subtitle-analysis/host/action-handlers.js",
  "rooms/laboratory/main-functions/subtitle-analysis/host/edit-workspace.js",
  "rooms/laboratory/main-functions/subtitle-analysis/host/process-analysis.js",
  "rooms/laboratory/main-functions/subtitle-analysis/host/runtime.js",
  "rooms/laboratory/main-functions/subtitle-analysis/host/state.js",
  "rooms/laboratory/main-functions/subtitle-analysis/host/source-intake.js",
  "rooms/laboratory/main-functions/subtitle-analysis/host/youtube-source.js",
  "rooms/laboratory/shared/host/io-runtime.js",
  "rooms/laboratory/shared/host/project-lifecycle.js",
  "rooms/laboratory/shared/host/project-records.js",
  "rooms/laboratory/shared/host/process-report-state.js",
  "rooms/laboratory/shared/host/runtime-primitives.js",
  "rooms/laboratory/shared/host/runtime-bootstrap.js",
  "rooms/laboratory/shared/host/process-runtime.js",
  "rooms/laboratory/shared/host/room-snapshot.js",
  "rooms/laboratory/shared/host/snapshot-composition.js",
  "rooms/laboratory/shared/host/state-composition.js",
  "rooms/laboratory/shared/host/subtitle-projection.js",
  "rooms/laboratory/shared/host/reporting.js",
  "rooms/laboratory/main-functions/subtitle-analysis/ui/module.js",
  "rooms/laboratory/main-functions/subtitle-analysis/ui/runtime.js",
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
  const hostSource = readFileSync("rooms/laboratory/host/index.js", "utf8");
  const hostRuntimeSource = readFileSync("rooms/laboratory/host/runtime.js", "utf8");
  const actionRouterSource = readFileSync("rooms/laboratory/shared/host/action-router.js", "utf8");
  const subtitleActionSource = readFileSync(
    "rooms/laboratory/main-functions/subtitle-analysis/host/action-handlers.js",
    "utf8"
  );
  const actionCompositionSource = readFileSync("rooms/laboratory/shared/host/action-composition.js", "utf8");
  const actionRuntimeSource = readFileSync("rooms/laboratory/shared/host/action-runtime.js", "utf8");
  const subtitleProcessSource = readFileSync(
    "rooms/laboratory/main-functions/subtitle-analysis/host/process-analysis.js",
    "utf8"
  );
  const subtitleRuntimeSource = readFileSync(
    "rooms/laboratory/main-functions/subtitle-analysis/host/runtime.js",
    "utf8"
  );
  const lifecycleSource = readFileSync("rooms/laboratory/shared/host/project-lifecycle.js", "utf8");
  const projectRecordsSource = readFileSync("rooms/laboratory/shared/host/project-records.js", "utf8");
  const subtitleProjectionSource = readFileSync("rooms/laboratory/shared/host/subtitle-projection.js", "utf8");
  const stateCompositionSource = readFileSync(
    "rooms/laboratory/shared/host/state-composition.js",
    "utf8"
  );
  const processDelegatesSource = readFileSync("rooms/laboratory/shared/host/process-delegates.js", "utf8");
  const processCompositionSource = readFileSync(
    "rooms/laboratory/shared/host/process-composition.js",
    "utf8"
  );
  const runtimePrimitivesSource = readFileSync(
    "rooms/laboratory/shared/host/runtime-primitives.js",
    "utf8"
  );

  assert.match(hostSource, /\.\/runtime\.js/);
  assert.match(hostRuntimeSource, /shared\/host\/runtime-primitives\.js/);
  assert.match(runtimePrimitivesSource, /export const LABORATORY_SUBTITLE_FEATURE_ID = "subtitle-analysis";/);
  assert.match(hostRuntimeSource, /main-functions\/subtitle-analysis\/host\/runtime\.js/);
  assert.match(hostRuntimeSource, /shared\/host\/state-composition\.js/);
  assert.match(hostRuntimeSource, /shared\/host\/project-lifecycle\.js/);
  assert.match(hostRuntimeSource, /shared\/host\/process-composition\.js/);
  assert.match(processCompositionSource, /from "\.\/process-delegates\.js"/);
  assert.match(hostRuntimeSource, /shared\/host\/runtime-bootstrap\.js/);
  assert.match(hostRuntimeSource, /shared\/host\/action-composition\.js/);
  assert.match(stateCompositionSource, /from "\.\/project-records\.js"/);
  assert.match(stateCompositionSource, /from "\.\/subtitle-projection\.js"/);
  assert.match(stateCompositionSource, /from "\.\/process-report-state\.js"/);
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
  assert.match(lifecycleSource, /subtitle-source-presets\.json/);
  assert.match(lifecycleSource, /subtitle-youtube\.form\.json/);
  assert.match(lifecycleSource, /subtitle-edit-presets\.json/);
  assert.match(lifecycleSource, /subtitle-analysis-catalog\.json/);
  assert.match(lifecycleSource, /subtitle-analysis-capabilities\.json/);
  assert.match(lifecycleSource, /subtitle-analysis-providers\.json/);
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
  assert.match(hostRuntimeSource, /laboratorySubtitleAnalysisHostRuntime = createLaboratorySubtitleAnalysisHostRuntime\(/);
  assert.doesNotMatch(hostRuntimeSource, /const laboratoryActionRouter = createLaboratoryActionRouter\(/);
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
  assert.match(subtitleRuntimeSource, /buildSubtitleProcessModules\(runtime, target\)/);
  assert.match(subtitleRuntimeSource, /buildSubtitleAnalysisStats\(runtime, project, target\)/);
  assert.match(actionRuntimeSource, /export function createLaboratoryHostActionRuntime\(deps\)/);
  assert.match(actionRuntimeSource, /function handleMediaAction\(api, runtime, payload\)/);
  assert.match(actionRuntimeSource, /function handleToolMutation\(api, runtime, requestId, action, toolId, featureStage\)/);
  assert.match(subtitleProcessSource, /function buildSubtitleProcessModules\(runtime, target\)/);
  assert.match(subtitleProcessSource, /async function buildSubtitleAnalysisStats\(runtime, project, target\)/);
  assert.doesNotMatch(hostRuntimeSource, /const laboratoryActionRouter = createLaboratoryActionRouter\(/);
  assert.match(processDelegatesSource, /function composeSubtitleAnalysisReport\(runtime, project\)/);
});

test("laboratory UI renders subtitle source and edit workspaces on the shared shell", () => {
  const uiSource = readFileSync("rooms/laboratory/ui/laboratory-ui-runtime.js", "utf8");
  const bootstrapStateSource = readFileSync(
    "rooms/laboratory/ui/bootstrap-state-runtime.js",
    "utf8"
  );
  const viewAccessorsRuntimeSource = readFileSync(
    "rooms/laboratory/ui/view-accessors-runtime.js",
    "utf8"
  );
  const stageShellDelegatesSource = readFileSync(
    "rooms/laboratory/shared/ui/stage-shell-delegates.js",
    "utf8"
  );
  const sourceStageCompositionSource = readFileSync(
    "rooms/laboratory/ui/source-stage-composition.js",
    "utf8"
  );
  const subtitleAnalysisUiRuntimeSource = readFileSync(
    "rooms/laboratory/main-functions/subtitle-analysis/ui/runtime.js",
    "utf8"
  );
  const subtitleModuleSource = readFileSync(
    "rooms/laboratory/main-functions/subtitle-analysis/ui/module.js",
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
  assert.match(subtitleModuleSource, /data-action="subtitle-source-discover-youtube"/);
  assert.match(subtitleModuleSource, /data-action="subtitle-source-download-youtube"/);
  assert.match(subtitleModuleSource, /data-action="subtitle-edit-preview"/);
  assert.match(subtitleModuleSource, /data-action="subtitle-edit-apply"/);
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
