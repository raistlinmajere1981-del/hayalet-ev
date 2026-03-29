import test from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";

import { validateRoomManifest } from "../../src/types/rooms.ts";

const requiredFiles = [
  "rooms/laboratory/manifest.json",
  "rooms/laboratory/host/index.ts",
  "rooms/laboratory/host/runtime.ts",
  "rooms/laboratory/host/foundation-runtimes.ts",
  "rooms/laboratory/host/project-runtimes.ts",
  "rooms/laboratory/host/feature-runtimes.ts",
  "rooms/laboratory/shared/host/project-lifecycle.ts",
  "rooms/laboratory/shared/host/project-config-loader.ts",
  "rooms/laboratory/shared/host/project-paths.ts",
  "rooms/laboratory/shared/host/project-storage.ts",
  "rooms/laboratory/shared/host/project-tool-status.ts",
  "rooms/laboratory/shared/host/process-managed-audio-runner.ts",
  "rooms/laboratory/shared/host/process-managed-media-runner.ts",
  "rooms/laboratory/shared/host/process-managed-runners.ts",
  "rooms/laboratory/shared/host/process-managed-subtitle-runner.ts",
  "rooms/laboratory/shared/host/process-runtime.ts",
  "rooms/laboratory/shared/host/process-targeting.ts",
  "rooms/laboratory/shared/host/process-report-state.ts",
  "rooms/laboratory/shared/host/process-coordination.ts",
  "rooms/laboratory/shared/host/closeout-staleness.ts",
  "rooms/laboratory/shared/host/host-utils.ts",
  "rooms/laboratory/shared/host/runtime-primitives.ts",
  "rooms/laboratory/shared/host/io-runtime.ts",
  "rooms/laboratory/shared/host/preset-runtime.ts",
  "rooms/laboratory/shared/host/preset-source-runtime.ts",
  "rooms/laboratory/shared/host/preset-edit-runtime.ts",
  "rooms/laboratory/shared/host/preset-profile-runtime.ts",
  "rooms/laboratory/shared/host/project-manifests.ts",
  "rooms/laboratory/shared/host/project-state.ts",
  "rooms/laboratory/shared/host/project-state-delegates.ts",
  "rooms/laboratory/shared/host/profile-model-state.ts",
  "rooms/laboratory/shared/host/activation.ts",
  "rooms/laboratory/shared/host/audio-process-delegates.ts",
  "rooms/laboratory/shared/host/process-orchestration.ts",
  "rooms/laboratory/shared/host/action-composition.ts",
  "rooms/laboratory/shared/host/action-runtime.ts",
  "rooms/laboratory/shared/host/runtime-bootstrap.ts",
  "rooms/laboratory/shared/host/runtime-events.ts",
  "rooms/laboratory/shared/host/runtime-storage.ts",
  "rooms/laboratory/shared/host/room-snapshot.ts",
  "rooms/laboratory/shared/host/project-records.ts",
  "rooms/laboratory/shared/host/room-tools-progress.ts",
  "rooms/laboratory/shared/host/source-composition.ts",
  "rooms/laboratory/shared/host/snapshot-composition.ts",
  "rooms/laboratory/shared/host/state-composition.ts",
  "rooms/laboratory/shared/host/reporting.ts",
  "rooms/laboratory/shared/host/reporting-feature-report.ts",
  "rooms/laboratory/shared/host/reporting-export.ts",
  "rooms/laboratory/shared/host/reporting-audio.ts",
  "rooms/laboratory/shared/host/reporting-subtitle.ts",
  "rooms/laboratory/shared/host/reporting-markdown.ts",
  "rooms/laboratory/shared/host/source-delegates.ts",
  "rooms/laboratory/shared/host/subtitle-projection.ts",
  "rooms/laboratory/shared/host/tool-mutations.ts",
  "rooms/laboratory/shared/ui/action-router.ts",
  "rooms/laboratory/shared/ui/action-router-actions.ts",
  "rooms/laboratory/shared/ui/action-router-events.ts",
  "rooms/laboratory/shared/ui/copy-runtime.ts",
  "rooms/laboratory/shared/ui/markup.ts",
  "rooms/laboratory/shared/ui/draft-runtime.ts",
  "rooms/laboratory/shared/ui/host-messages.ts",
  "rooms/laboratory/shared/ui/navigation-runtime.ts",
  "rooms/laboratory/shared/ui/process-stage.ts",
  "rooms/laboratory/shared/ui/request-runtime.ts",
  "rooms/laboratory/shared/ui/report-stage.ts",
  "rooms/laboratory/shared/ui/report-stage-support.ts",
  "rooms/laboratory/shared/ui/report-stage-subtitle.ts",
  "rooms/laboratory/shared/ui/shell-frame.ts",
  "rooms/laboratory/shared/ui/settings-profile-model.ts",
  "rooms/laboratory/shared/ui/settings-tool-card.ts",
  "rooms/laboratory/shared/ui/stage-shell-delegates.ts",
  "rooms/laboratory/shared/ui/shell-render.ts",
  "rooms/laboratory/shared/ui/settings-overlay.ts",
  "rooms/laboratory/shared/ui/source-stage.ts",
  "rooms/laboratory/shared/ui/source-stage-intake.ts",
  "rooms/laboratory/shared/ui/source-stage-project.ts",
  "rooms/laboratory/shared/ui/source-snapshot-selectors.ts",
  "rooms/laboratory/shared/ui/source-snapshot-project-selectors.ts",
  "rooms/laboratory/shared/ui/source-snapshot-subtitle-selectors.ts",
  "rooms/laboratory/shared/ui/source-snapshot-audio-selectors.ts",
  "rooms/laboratory/shared/ui/source-snapshot-tool-selectors.ts",
  "rooms/laboratory/shared/ui/shell-runtime.ts",
  "rooms/laboratory/shared/ui/feature-runtime.ts",
  "rooms/laboratory/shared/ui/profile-process-report-accessors.ts",
  "rooms/laboratory/shared/ui/profile-process-report-composition.ts",
  "rooms/laboratory/ui/draft-access-runtime.ts",
  "rooms/laboratory/ui/profile-process-report-accessors.ts",
  "rooms/laboratory/ui/profile-process-report-composition.ts",
  "rooms/laboratory/ui/profile-process-report-runtime.ts",
  "rooms/laboratory/ui/core-bootstrap.ts",
  "rooms/laboratory/ui/core-public-api.ts",
  "rooms/laboratory/ui/core-runtime.ts",
  "rooms/laboratory/ui/feature-stage-bundles.ts",
  "rooms/laboratory/ui/feature-stage-panels.ts",
  "rooms/laboratory/ui/feature-stage-runtime.ts",
  "rooms/laboratory/ui/runtime-composition.ts",
  "rooms/laboratory/ui/source-stage-composition.ts",
  "rooms/laboratory/ui/snapshot-access-runtime.ts",
  "rooms/laboratory/ui/view-bindings-runtime.ts",
  "rooms/laboratory/ui/subtitle-panel-runtime.ts",
  "rooms/laboratory/ui/view-accessors-runtime.ts",
  "rooms/laboratory/ui/index.html",
  "rooms/laboratory/ui/index.ts",
  "rooms/laboratory/ui/laboratory-ui-runtime.ts",
  "rooms/laboratory/ui/bootstrap-runtime.ts",
  "rooms/laboratory/ui/style.css",
  "rooms/laboratory/shared/styles/shell.css",
  "rooms/laboratory/shared/styles/components/navigation.css",
  "rooms/laboratory/shared/styles/components/panels.css",
  "rooms/laboratory/shared/styles/components/controls.css",
  "rooms/laboratory/shared/styles/components/feedback.css",
  "rooms/laboratory/shared/styles/components/overlay.css",
  "rooms/laboratory/main-functions/media-analysis/host/action-handlers.ts",
  "rooms/laboratory/main-functions/media-analysis/host/action-handlers-source.ts",
  "rooms/laboratory/main-functions/media-analysis/host/action-handlers-edit.ts",
  "rooms/laboratory/main-functions/media-analysis/host/action-handlers-profile.ts",
  "rooms/laboratory/main-functions/media-analysis/host/action-handlers-project.ts",
  "rooms/laboratory/main-functions/media-analysis/host/edit-pipeline.ts",
  "rooms/laboratory/main-functions/media-analysis/host/profile-models.ts",
  "rooms/laboratory/main-functions/media-analysis/host/profile-projection.ts",
  "rooms/laboratory/main-functions/media-analysis/host/profile-preflight.ts",
  "rooms/laboratory/main-functions/media-analysis/host/profile-state.ts",
  "rooms/laboratory/main-functions/media-analysis/host/runtime.ts",
  "rooms/laboratory/main-functions/media-analysis/host/source-metadata.ts",
  "rooms/laboratory/main-functions/media-analysis/host/source-intake.ts",
  "rooms/laboratory/main-functions/media-analysis/host/source-intake-local.ts",
  "rooms/laboratory/main-functions/media-analysis/host/source-intake-url.ts",
  "rooms/laboratory/main-functions/media-analysis/host/source-intake-youtube.ts",
  "rooms/laboratory/main-functions/media-analysis/styles.css",
  "rooms/laboratory/main-functions/audio-analysis/host/runtime.ts",
  "rooms/laboratory/main-functions/media-analysis/ui/edit-stage.ts",
  "rooms/laboratory/main-functions/media-analysis/ui/edit-field-controls.ts",
  "rooms/laboratory/main-functions/media-analysis/ui/edit-mode-panels.ts",
  "rooms/laboratory/main-functions/media-analysis/ui/edit-output-panels.ts",
  "rooms/laboratory/main-functions/media-analysis/ui/edit-workspace-panels.ts",
  "rooms/laboratory/main-functions/media-analysis/ui/profile-helpers.ts",
  "rooms/laboratory/main-functions/media-analysis/ui/runtime.ts",
  "rooms/laboratory/main-functions/media-analysis/ui/runtime-helpers.ts",
  "rooms/laboratory/main-functions/media-analysis/ui/source-edit-runtime.ts",
  "rooms/laboratory/main-functions/media-analysis/ui/profile-target.ts",
  "rooms/laboratory/main-functions/media-analysis/ui/profile-panels.ts",
  "rooms/laboratory/main-functions/media-analysis/ui/profile-stage.ts",
  "rooms/laboratory/main-functions/audio-analysis/host/module-projection.ts",
  "rooms/laboratory/main-functions/audio-analysis/host/projection-catalog.ts",
  "rooms/laboratory/main-functions/audio-analysis/host/projection-results.ts",
  "rooms/laboratory/main-functions/audio-analysis/host/state.ts",
  "rooms/laboratory/shared/styles/audio-signal.css",
  "rooms/laboratory/main-functions/audio-analysis/ui/module.ts",
  "rooms/laboratory/main-functions/audio-analysis/ui/catalog-runtime.ts",
  "rooms/laboratory/main-functions/audio-analysis/ui/provider-runtime.ts",
  "rooms/laboratory/main-functions/audio-analysis/ui/result-runtime.ts",
  "rooms/laboratory/main-functions/subtitle-analysis/styles.css",
  "rooms/laboratory/main-functions/subtitle-analysis/host/action-handlers.ts",
  "rooms/laboratory/main-functions/subtitle-analysis/host/edit-workspace.ts",
  "rooms/laboratory/main-functions/subtitle-analysis/host/process-analysis.ts",
  "rooms/laboratory/main-functions/subtitle-analysis/host/runtime.ts",
  "rooms/laboratory/main-functions/subtitle-analysis/host/state-defaults.ts",
  "rooms/laboratory/main-functions/subtitle-analysis/host/state-normalization.ts",
  "rooms/laboratory/main-functions/subtitle-analysis/host/state-projects.ts",
  "rooms/laboratory/main-functions/subtitle-analysis/host/state.ts",
  "rooms/laboratory/main-functions/subtitle-analysis/ui/module.ts",
  "rooms/laboratory/main-functions/subtitle-analysis/ui/source-panels.ts",
  "rooms/laboratory/main-functions/subtitle-analysis/ui/source-panel-primitives.ts",
  "rooms/laboratory/main-functions/subtitle-analysis/ui/source-panel-process.ts",
  "rooms/laboratory/main-functions/subtitle-analysis/ui/source-panel-intake.ts",
  "rooms/laboratory/main-functions/subtitle-analysis/ui/source-panel-workspace.ts",
  "rooms/laboratory/main-functions/subtitle-analysis/ui/edit-panels.ts",
  "rooms/laboratory/main-functions/subtitle-analysis/ui/runtime.ts",
  "rooms/laboratory/i18n/en.json",
  "rooms/laboratory/i18n/tr.json",
  "rooms/laboratory/shared/data/tools/project-schema.json",
  "rooms/laboratory/shared/data/tools/source-presets.json",
  "rooms/laboratory/shared/data/tools/yt-dlp.form.json",
  "rooms/laboratory/shared/data/tools/toolchain.manifest.json",
  "rooms/laboratory/shared/data/tools/edit-presets.json",
  "rooms/laboratory/shared/data/tools/edit-capabilities.json",
  "rooms/laboratory/shared/data/tools/profile-presets.json",
  "rooms/laboratory/shared/data/tools/profile-capabilities.json",
  "rooms/laboratory/shared/data/tools/profile-models.json",
  "rooms/laboratory/shared/data/tools/audio-analysis-catalog.json",
  "rooms/laboratory/shared/data/tools/audio-analysis-capabilities.json",
  "rooms/laboratory/shared/data/tools/audio-analysis-presets.json",
  "rooms/laboratory/shared/data/tools/audio-analysis-providers.json",
  "rooms/laboratory/shared/data/tools/subtitle-source-presets.json",
  "rooms/laboratory/shared/data/tools/subtitle-youtube.form.json",
  "rooms/laboratory/shared/data/tools/subtitle-edit-presets.json",
  "rooms/laboratory/shared/data/tools/subtitle-analysis-catalog.json",
  "rooms/laboratory/shared/data/tools/subtitle-analysis-capabilities.json",
  "rooms/laboratory/shared/data/tools/subtitle-analysis-providers.json",
  "rooms/laboratory/shared/assets/room-background.webp",
  "rooms/laboratory/main-functions/media-analysis/assets/media-analysis-view.webp",
  "rooms/laboratory/main-functions/audio-analysis/assets/sound-analysis.webp",
  "rooms/laboratory/main-functions/subtitle-analysis/assets/subtitle-analysis.webp",
];

test("laboratory workspace keeps the required laboratory package files", () => {
  requiredFiles.forEach((filePath) => {
    assert.equal(existsSync(filePath), true, filePath);
  });
});

test("laboratory manifest validates with the media-analysis room contract", () => {
  const manifest = JSON.parse(readFileSync("rooms/laboratory/manifest.json", "utf8"));
  const validation = validateRoomManifest(manifest);

  assert.equal(validation.valid, true);
  assert.equal(validation.manifest?.id, "laboratory");
  assert.equal(validation.manifest?.defaultFeatureId, "media-analysis");
  assert.equal(validation.manifest?.features[0]?.id, "media-analysis");
  assert.equal(validation.manifest?.runtime.uiEntry, "ui/index.html");
  assert.equal(validation.manifest?.runtime.hostEntry, "host/index.js");
  assert.equal(validation.manifest?.scene?.chrome?.pageShellVariant, "immersive-stage");
  assert.equal(
    validation.manifest?.features[0]?.scene?.view.backgroundSrc,
    "main-functions/media-analysis/assets/media-analysis-view.webp"
  );
});

test("laboratory UI ships source, edit, and profile controls through the shared media envelope", () => {
  const uiSource = readFileSync("rooms/laboratory/ui/laboratory-ui-runtime.ts", "utf8");
  const mediaProfileUiSource = readFileSync(
    "rooms/laboratory/main-functions/media-analysis/ui/profile-panels.ts",
    "utf8"
  );
  const mediaProfileHelperSource = readFileSync(
    "rooms/laboratory/main-functions/media-analysis/ui/profile-helpers.ts",
    "utf8"
  );
  const mediaProfileRuntimeHelperSource = readFileSync(
    "rooms/laboratory/main-functions/media-analysis/ui/runtime-helpers.ts",
    "utf8"
  );
  const viewAccessorsRuntimeSource = readFileSync(
    "rooms/laboratory/ui/view-accessors-runtime.ts",
    "utf8"
  );
  const mediaRuntimeSource = readFileSync(
    "rooms/laboratory/main-functions/media-analysis/ui/runtime.ts",
    "utf8"
  );
  const mediaSourceEditRuntimeSource = readFileSync(
    "rooms/laboratory/main-functions/media-analysis/ui/source-edit-runtime.ts",
    "utf8"
  );
  const mediaProfileStageSource = readFileSync(
    "rooms/laboratory/main-functions/media-analysis/ui/profile-stage.ts",
    "utf8"
  );
  const mediaEditUiSource = readFileSync(
    "rooms/laboratory/main-functions/media-analysis/ui/edit-panels.ts",
    "utf8"
  );
  const mediaEditFieldControlsSource = readFileSync(
    "rooms/laboratory/main-functions/media-analysis/ui/edit-field-controls.ts",
    "utf8"
  );
  const mediaEditModePanelsSource = readFileSync(
    "rooms/laboratory/main-functions/media-analysis/ui/edit-mode-panels.ts",
    "utf8"
  );
  const mediaEditOutputPanelsSource = readFileSync(
    "rooms/laboratory/main-functions/media-analysis/ui/edit-output-panels.ts",
    "utf8"
  );
  const mediaEditWorkspacePanelsSource = readFileSync(
    "rooms/laboratory/main-functions/media-analysis/ui/edit-workspace-panels.ts",
    "utf8"
  );
  const mediaEditStageSource = readFileSync(
    "rooms/laboratory/main-functions/media-analysis/ui/edit-stage.ts",
    "utf8"
  );
  const mediaProfileTargetSource = readFileSync(
    "rooms/laboratory/main-functions/media-analysis/ui/profile-target.ts",
    "utf8"
  );
  const hostMessageSource = readFileSync("rooms/laboratory/shared/ui/host-messages.ts", "utf8");
  const actionRouterSource = readFileSync("rooms/laboratory/shared/ui/action-router.ts", "utf8");
  const actionRouterActionsSource = readFileSync(
    "rooms/laboratory/shared/ui/action-router-actions.ts",
    "utf8"
  );
  const actionRouterEventsSource = readFileSync(
    "rooms/laboratory/shared/ui/action-router-events.ts",
    "utf8"
  );
  const copyRuntimeSource = readFileSync("rooms/laboratory/shared/ui/copy-runtime.ts", "utf8");
  const markupSource = readFileSync("rooms/laboratory/shared/ui/markup.ts", "utf8");
  const draftRuntimeSource = readFileSync("rooms/laboratory/shared/ui/draft-runtime.ts", "utf8");
  const draftAccessRuntimeSource = readFileSync("rooms/laboratory/ui/draft-access-runtime.ts", "utf8");
  const snapshotAccessRuntimeSource = readFileSync(
    "rooms/laboratory/ui/snapshot-access-runtime.ts",
    "utf8"
  );
  const viewBindingsRuntimeSource = readFileSync(
    "rooms/laboratory/ui/view-bindings-runtime.ts",
    "utf8"
  );
  const profileAccessorsRuntimeSource = readFileSync(
    "rooms/laboratory/ui/profile-process-report-accessors.ts",
    "utf8"
  );
  const profileAccessorsSharedRuntimeSource = readFileSync(
    "rooms/laboratory/shared/ui/profile-process-report-accessors.ts",
    "utf8"
  );
  const navigationRuntimeSource = readFileSync(
    "rooms/laboratory/shared/ui/navigation-runtime.ts",
    "utf8"
  );
  const requestRuntimeSource = readFileSync(
    "rooms/laboratory/shared/ui/request-runtime.ts",
    "utf8"
  );
  const stageShellDelegatesSource = readFileSync(
    "rooms/laboratory/shared/ui/stage-shell-delegates.ts",
    "utf8"
  );
  const shellRenderSource = readFileSync("rooms/laboratory/shared/ui/shell-render.ts", "utf8");
  const shellRuntimeSource = readFileSync("rooms/laboratory/shared/ui/shell-runtime.ts", "utf8");
  const shellFrameSource = readFileSync("rooms/laboratory/shared/ui/shell-frame.ts", "utf8");
  const featureRuntimeSource = readFileSync("rooms/laboratory/shared/ui/feature-runtime.ts", "utf8");
  const profileProcessReportRuntimeSource = readFileSync(
    "rooms/laboratory/ui/profile-process-report-runtime.ts",
    "utf8"
  );
  const profileProcessReportCompositionSource = readFileSync(
    "rooms/laboratory/ui/profile-process-report-composition.ts",
    "utf8"
  );
  const profileProcessReportCompositionSharedSource = readFileSync(
    "rooms/laboratory/shared/ui/profile-process-report-composition.ts",
    "utf8"
  );
  const uiRuntimeCompositionSource = readFileSync(
    "rooms/laboratory/ui/runtime-composition.ts",
    "utf8"
  );
  const sourceStageCompositionSource = readFileSync(
    "rooms/laboratory/ui/source-stage-composition.ts",
    "utf8"
  );
  const editRuntimeSource = readFileSync("rooms/laboratory/ui/edit-runtime.ts", "utf8");
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
  const bootstrapRuntimeSource = readFileSync("rooms/laboratory/ui/bootstrap-runtime.ts", "utf8");
  const bootstrapStateSource = readFileSync(
    "rooms/laboratory/ui/bootstrap-state-runtime.ts",
    "utf8"
  );
  const featureStageRuntimeSource = readFileSync(
    "rooms/laboratory/ui/feature-stage-runtime.ts",
    "utf8"
  );
  const featureStageBundlesSource = readFileSync(
    "rooms/laboratory/ui/feature-stage-bundles.ts",
    "utf8"
  );
  const featureStagePanelsSource = readFileSync(
    "rooms/laboratory/ui/feature-stage-panels.ts",
    "utf8"
  );
  const sourceStageSource = readFileSync("rooms/laboratory/shared/ui/source-stage.ts", "utf8");
  const sourceStageIntakeSource = readFileSync(
    "rooms/laboratory/shared/ui/source-stage-intake.ts",
    "utf8"
  );
  const sourceStageProjectSource = readFileSync(
    "rooms/laboratory/shared/ui/source-stage-project.ts",
    "utf8"
  );
  const sourceSnapshotSelectorsSource = readFileSync(
    "rooms/laboratory/shared/ui/source-snapshot-selectors.ts",
    "utf8"
  );
  const sourceSnapshotProjectSelectorsSource = readFileSync(
    "rooms/laboratory/shared/ui/source-snapshot-project-selectors.ts",
    "utf8"
  );
  const sourceSnapshotSubtitleSelectorsSource = readFileSync(
    "rooms/laboratory/shared/ui/source-snapshot-subtitle-selectors.ts",
    "utf8"
  );
  const sourceSnapshotAudioSelectorsSource = readFileSync(
    "rooms/laboratory/shared/ui/source-snapshot-audio-selectors.ts",
    "utf8"
  );
  const sourceSnapshotToolSelectorsSource = readFileSync(
    "rooms/laboratory/shared/ui/source-snapshot-tool-selectors.ts",
    "utf8"
  );
  const settingsOverlaySource = readFileSync(
    "rooms/laboratory/shared/ui/settings-overlay.ts",
    "utf8"
  );
  const settingsProfileModelSource = readFileSync(
    "rooms/laboratory/shared/ui/settings-profile-model.ts",
    "utf8"
  );
  const settingsToolCardSource = readFileSync(
    "rooms/laboratory/shared/ui/settings-tool-card.ts",
    "utf8"
  );
  const reportStageSource = readFileSync("rooms/laboratory/shared/ui/report-stage.ts", "utf8");
  const reportStageSupportSource = readFileSync(
    "rooms/laboratory/shared/ui/report-stage-support.ts",
    "utf8"
  );
  const reportStageSubtitleSource = readFileSync(
    "rooms/laboratory/shared/ui/report-stage-subtitle.ts",
    "utf8"
  );

  assert.match(
    uiSource,
    /const STAGE_ORDER = \["source", "edit", "profile", "process", "report"\];/
  );
  assert.match(uiSource, /shared\/ui\/action-router\.js/);
  assert.match(actionRouterSource, /\.\/action-router-actions\.js/);
  assert.match(actionRouterSource, /\.\/action-router-events\.js/);
  assert.match(actionRouterActionsSource, /export function createLaboratoryUiActionHandlers\(deps\)/);
  assert.match(actionRouterActionsSource, /function handleAction\(action, value\)/);
  assert.match(actionRouterEventsSource, /export function createLaboratoryUiActionEventRuntime\(deps\)/);
  assert.match(actionRouterEventsSource, /function handleClick\(event\)/);
  assert.match(actionRouterEventsSource, /function handleChange\(event\)/);
  assert.match(uiSource, /shared\/ui\/copy-runtime\.js/);
  assert.match(uiSource, /shared\/ui\/markup\.js/);
  assert.match(uiSource, /shared\/ui\/draft-runtime\.js/);
  assert.match(uiSource, /shared\/ui\/navigation-runtime\.js/);
  assert.match(uiSource, /shared\/ui\/request-runtime\.js/);
  assert.match(uiSource, /shared\/ui\/stage-shell-delegates\.js/);
  assert.match(uiSource, /shared\/ui\/shell-runtime\.js/);
  assert.match(uiSource, /shared\/ui\/shell-frame\.js/);
  assert.match(uiSource, /\.\/core-runtime\.js/);
  assert.match(featureStageRuntimeSource, /\.\/feature-stage-bundles\.js/);
  assert.match(featureStageRuntimeSource, /\.\/feature-stage-panels\.js/);
  assert.match(
    featureStageBundlesSource,
    /export function createLaboratoryFeatureStageBundlesRuntime\(deps\)/
  );
  assert.match(
    featureStagePanelsSource,
    /export function createLaboratoryFeatureStagePanelsRuntime\(deps\)/
  );
  assert.match(uiSource, /\.\/source-stage-composition\.js/);
  assert.match(shellFrameSource, /data-action="open-settings"/);
  assert.match(sourceStageSource, /\.\/source-stage-intake\.js/);
  assert.match(sourceStageSource, /\.\/source-stage-project\.js/);
  assert.match(
    sourceStageIntakeSource,
    /export function createLaboratorySourceStageIntakeRuntime\(deps\)/
  );
  assert.match(
    sourceStageProjectSource,
    /export function createLaboratorySourceStageProjectRuntime\(deps\)/
  );
  assert.match(sourceStageProjectSource, /data-action="project-create"/);
  assert.match(sourceStageProjectSource, /data-select="project"/);
  assert.match(sourceStageProjectSource, /data-action="source-kind"/);
  assert.match(sourceStageIntakeSource, /data-action="source-mode"/);
  assert.match(sourceStageIntakeSource, /data-action="source-pick-local"/);
  assert.match(sourceStageIntakeSource, /data-action="source-download-url"/);
  assert.match(sourceStageIntakeSource, /data-action="source-download-youtube"/);
  assert.match(
    stageShellDelegatesSource,
    /export function createLaboratoryStageShellDelegates(?:<[\s\S]+?>)?\s*\(/
  );
  assert.match(stageShellDelegatesSource, /function renderEditStage\(\)/);
  assert.match(stageShellDelegatesSource, /renderMediaAnalysisEditStage\(mediaAnalysisEditStageDeps\)/);
  assert.match(sourceStageCompositionSource, /export function createLaboratorySourceStageComposition\(deps\)/);
  assert.match(sourceStageCompositionSource, /return createLaboratorySourceStageUi\(/);
  assert.match(uiSource, /shared\/ui\/host-messages\.js/);
  assert.match(uiSource, /shared\/ui\/settings-overlay\.js/);
  assert.match(uiSource, /shared\/ui\/report-stage\.js/);
  assert.match(reportStageSource, /\.\/report-stage-support\.js/);
  assert.match(reportStageSource, /\.\/report-stage-subtitle\.js/);
  assert.match(
    reportStageSupportSource,
    /export function createLaboratoryReportStageSupportRuntime\(deps\)/
  );
  assert.match(
    reportStageSubtitleSource,
    /export function createLaboratorySubtitleReportStageRuntime\(deps\)/
  );
  assert.match(uiSource, /\.\/draft-access-runtime\.js/);
  assert.match(uiSource, /shared\/ui\/profile-process-report-accessors\.js/);
  assert.match(uiSource, /shared\/ui\/profile-process-report-composition\.js/);
  assert.match(uiSource, /\.\/profile-process-report-runtime\.js/);
  assert.match(uiSource, /\.\/feature-stage-runtime\.js/);
  assert.match(uiSource, /\.\/snapshot-access-runtime\.js/);
  assert.match(uiSource, /\.\/edit-runtime\.js/);
  assert.match(uiSource, /main-functions\/subtitle-analysis\/ui\/runtime\.js/);
  assert.match(settingsOverlaySource, /\.\/settings-profile-model\.js/);
  assert.match(settingsOverlaySource, /\.\/settings-tool-card\.js/);
  assert.match(
    settingsProfileModelSource,
    /export function createLaboratorySettingsProfileModelRuntime\(deps\)/
  );
  assert.match(
    settingsToolCardSource,
    /export function createLaboratorySettingsToolCardRuntime\(deps\)/
  );
  assert.match(settingsToolCardSource, /data-action="tool-install"/);
  assert.match(settingsToolCardSource, /data-action="tool-update"/);
  assert.match(requestRuntimeSource, /roomApi\.sendEvent\("media-action"/);
  assert.match(hostMessageSource, /message\.type === "media-state" \|\| message\.type === "source-state"/);
  assert.match(uiSource, /main-functions\/media-analysis\/ui\/edit-panels\.js/);
  assert.match(mediaEditUiSource, /from "\.\/edit-field-controls\.js"/);
  assert.match(mediaEditUiSource, /from "\.\/edit-mode-panels\.js"/);
  assert.match(mediaEditUiSource, /from "\.\/edit-output-panels\.js"/);
  assert.match(mediaEditUiSource, /from "\.\/edit-workspace-panels\.js"/);
  assert.match(mediaEditFieldControlsSource, /data-edit-field="/);
  assert.match(mediaEditFieldControlsSource, /data-edit-toggle="/);
  assert.match(mediaEditModePanelsSource, /data-action="edit-mode"/);
  assert.match(mediaEditOutputPanelsSource, /data-action="edit-preview"/);
  assert.match(mediaEditOutputPanelsSource, /data-action="edit-apply"/);
  assert.match(mediaEditOutputPanelsSource, /data-action="edit-cancel-preview"/);
  assert.match(mediaEditOutputPanelsSource, /data-action="edit-cancel-apply"/);
  assert.match(mediaEditOutputPanelsSource, /data-action="edit-select-output"/);
  assert.match(mediaEditOutputPanelsSource, /data-action="edit-handoff"/);
  assert.match(mediaEditWorkspacePanelsSource, /lab-preview-card/);
  assert.match(editRuntimeSource, /createLaboratoryUiEditRuntime/);
  assert.match(editRuntimeSource, /function buildCurrentEditRecipePatch\(\)/);
  assert.match(editRuntimeSource, /function commitEditPatch\(patch, action\)/);
  assert.match(editRuntimeSource, /function restartProcess\(\)/);
  assert.match(uiSource, /main-functions\/media-analysis\/ui\/edit-stage\.js/);
  assert.match(
    mediaEditStageSource,
    /export function renderMediaAnalysisEditStage\(\s*deps(?::[\s\S]+?)?\s*\)/
  );
  assert.match(mediaEditStageSource, /text\(\["mediaAnalysis", "edit", "sourceRequired"\]\)/);
  assert.match(uiSource, /main-functions\/media-analysis\/ui\/profile-panels\.js/);
  assert.match(uiSource, /main-functions\/media-analysis\/ui\/runtime\.js/);
  assert.match(
    profileAccessorsRuntimeSource,
    /export \{ createLaboratoryProfileProcessReportAccessorsRuntime \} from "\.\.\/shared\/ui\/profile-process-report-accessors\.js";/
  );
  assert.match(
    profileAccessorsSharedRuntimeSource,
    /export function createLaboratoryProfileProcessReportAccessorsRuntime\(deps\)/
  );
  assert.match(
    profileProcessReportCompositionSource,
    /export \{ createLaboratoryProfileProcessReportComposition \} from "\.\.\/shared\/ui\/profile-process-report-composition\.js";/
  );
  assert.match(
    profileProcessReportCompositionSharedSource,
    /export function createLaboratoryProfileProcessReportComposition\(deps\)/
  );
  assert.match(uiSource, /\.\/runtime-composition\.js/);
  assert.match(uiRuntimeCompositionSource, /export function createLaboratoryUiRuntimeComposition\(deps\)/);
  assert.match(uiRuntimeCompositionSource, /\.\/view-runtime\.js/);
  assert.match(uiRuntimeCompositionSource, /shared\/ui\/feature-runtime\.js/);
  assert.match(uiRuntimeCompositionSource, /\.\/stage-accessors-runtime\.js/);
  assert.match(subtitleAnalysisUiRuntimeSource, /export function createSubtitleAnalysisUiRuntime\(deps\)/);
  assert.match(subtitleAnalysisUiRuntimeSource, /function renderSubtitleEditStage\(\)/);
  assert.match(subtitleAnalysisUiRuntimeSource, /function renderSubtitlePreviewBody\(/);
  assert.match(subtitleModuleSource, /from "\.\/source-panels\.js"/);
  assert.match(subtitleModuleSource, /from "\.\/edit-panels\.js"/);
  assert.match(subtitleSourcePanelsSource, /from "\.\/source-panel-primitives\.js"/);
  assert.match(subtitleSourcePanelsSource, /from "\.\/source-panel-intake\.js"/);
  assert.match(subtitleSourcePanelsSource, /from "\.\/source-panel-workspace\.js"/);
  assert.match(
    subtitleSourcePrimitivesSource,
    /export function createSubtitleAnalysisSourcePanelPrimitives\(deps\)/
  );
  assert.match(subtitleSourceIntakeSource, /data-action="subtitle-source-discover-youtube"/);
  assert.match(subtitleSourceIntakeSource, /data-action="subtitle-source-download-youtube"/);
  assert.match(subtitleSourceWorkspaceSource, /data-action="subtitle-source-select-entry"/);
  assert.match(subtitleEditPanelsSource, /data-action="subtitle-edit-apply"/);
  assert.match(mediaRuntimeSource, /createMediaAnalysisUiRuntimeHelpers/);
  assert.match(mediaRuntimeSource, /createMediaAnalysisSourceEditUiRuntime/);
  assert.match(
    sourceSnapshotSelectorsSource,
    /import \{ createLaboratorySnapshotProjectSelectors \} from "\.\/source-snapshot-project-selectors\.js";/
  );
  assert.match(
    sourceSnapshotSelectorsSource,
    /import \{ createLaboratorySnapshotSubtitleSelectors \} from "\.\/source-snapshot-subtitle-selectors\.js";/
  );
  assert.match(
    sourceSnapshotSelectorsSource,
    /import \{ createLaboratorySnapshotAudioSelectors \} from "\.\/source-snapshot-audio-selectors\.js";/
  );
  assert.match(
    sourceSnapshotSelectorsSource,
    /import \{ createLaboratorySnapshotToolSelectors \} from "\.\/source-snapshot-tool-selectors\.js";/
  );
  assert.match(
    sourceSnapshotSelectorsSource,
    /export function createSourceSnapshotSelectors\(\s*deps(?::[\s\S]+?)?\s*\)/
  );
  assert.match(sourceSnapshotSelectorsSource, /\.\.\.projectSelectors,/);
  assert.match(sourceSnapshotSelectorsSource, /\.\.\.subtitleSelectors,/);
  assert.match(sourceSnapshotSelectorsSource, /\.\.\.audioSelectors,/);
  assert.match(sourceSnapshotSelectorsSource, /\.\.\.toolSelectors,/);
  assert.match(
    sourceSnapshotProjectSelectorsSource,
    /export function createLaboratorySnapshotProjectSelectors\(deps\)/
  );
  assert.match(sourceSnapshotProjectSelectorsSource, /function getActiveProject\(\)/);
  assert.match(sourceSnapshotProjectSelectorsSource, /function getCurrentFeatureProcessRecord\(\)/);
  assert.match(sourceSnapshotProjectSelectorsSource, /function getActiveEditOutput\(\)/);
  assert.match(
    sourceSnapshotSubtitleSelectorsSource,
    /export function createLaboratorySnapshotSubtitleSelectors\(deps\)/
  );
  assert.match(sourceSnapshotSubtitleSelectorsSource, /function getSubtitleProcessModuleLabel\(entry\)/);
  assert.match(sourceSnapshotSubtitleSelectorsSource, /function getSubtitleProviderModuleLabels\(entry\)/);
  assert.match(sourceSnapshotSubtitleSelectorsSource, /function getSubtitleActiveEntry\(\)|function getActiveSubtitleEntry\(\)/);
  assert.match(
    sourceSnapshotAudioSelectorsSource,
    /export function createLaboratorySnapshotAudioSelectors\(deps\)/
  );
  assert.match(sourceSnapshotAudioSelectorsSource, /function getAudioAnalysisModules\(\)/);
  assert.match(sourceSnapshotAudioSelectorsSource, /function getAudioAnalysisOrderedResultEntries\(\)/);
  assert.match(
    sourceSnapshotToolSelectorsSource,
    /export function createLaboratorySnapshotToolSelectors\(\s*deps(?::[\s\S]+?)?\s*\)/
  );
  assert.match(
    sourceSnapshotToolSelectorsSource,
    /function getToolEntry\(\s*toolId,?\s*\)/
  );
  assert.match(
    sourceSnapshotToolSelectorsSource,
    /function getStageToolIds\(\s*stageId,?\s*\)/
  );
  assert.match(
    sourceSnapshotToolSelectorsSource,
    /function getWorkspaceCapabilities\(\s*kind,?\s*\)/
  );
  assert.match(uiSource, /\.\/view-bindings-runtime\.js/);
  assert.match(viewAccessorsRuntimeSource, /export function createLaboratoryViewAccessorsRuntime\(deps\)/);
  assert.match(viewAccessorsRuntimeSource, /function getCurrentFeatureProcessRecord\(\)/);
  assert.match(viewAccessorsRuntimeSource, /function getCurrentFeatureReportRecord\(\)/);
  assert.match(viewAccessorsRuntimeSource, /function getProjectAudioAnalysis\(\)/);
  assert.match(viewAccessorsRuntimeSource, /function getSubtitleEntries\(\)/);
  assert.match(viewAccessorsRuntimeSource, /function getSubtitleProcessModuleLabel\(entry\)/);
  assert.match(viewAccessorsRuntimeSource, /function getSubtitleProviderLabel\(entry\)/);
  assert.match(viewAccessorsRuntimeSource, /function getAudioAnalysisCapabilities\(\)/);
  assert.match(viewAccessorsRuntimeSource, /function getAudioAnalysisPresets\(\)/);
  assert.match(viewAccessorsRuntimeSource, /function getAudioAnalysisProviders\(\)/);
  assert.match(viewAccessorsRuntimeSource, /function getAudioAnalysisProviderEntries\(\)/);
  assert.match(viewAccessorsRuntimeSource, /function getAudioAnalysisOrderedResultEntries\(\)/);
  assert.match(viewAccessorsRuntimeSource, /function renderToolCard\(toolId, stageId\)/);
  assert.match(viewAccessorsRuntimeSource, /function renderProfileModelCard\(entry\)/);
  assert.match(viewAccessorsRuntimeSource, /function renderSettingsOverlay\(\)/);
  assert.match(viewAccessorsRuntimeSource, /function getProfileTargetAsset\(\)/);
  assert.match(uiSource, /main-functions\/media-analysis\/ui\/profile-stage\.js/);
  assert.match(uiSource, /main-functions\/media-analysis\/ui\/profile-target\.js/);
  assert.match(featureRuntimeSource, /export function createLaboratoryUiFeatureRuntime\(deps\)/);
  assert.match(featureRuntimeSource, /function getRelevantJobs\(\)/);
  assert.match(featureRuntimeSource, /function getCurrentFeatureTargetLabel\(\)/);
  assert.match(
    profileProcessReportRuntimeSource,
    /export function createLaboratoryProfileProcessReportRuntime(?:<[\s\S]+?>)?\s*\(/
  );
  assert.match(
    profileProcessReportCompositionSource,
    /export \{ createLaboratoryProfileProcessReportComposition \} from "\.\.\/shared\/ui\/profile-process-report-composition\.js";/
  );
  assert.match(profileProcessReportRuntimeSource, /function renderProfileSummaryPanel\(\)/);
  assert.match(
    profileProcessReportRuntimeSource,
    /function renderReportFinding\(signal(?:: [^)]+)?\)/
  );
  assert.match(subtitleAnalysisUiRuntimeSource, /export function createSubtitleAnalysisUiRuntime\(deps\)/);
  assert.match(subtitleAnalysisUiRuntimeSource, /function renderSubtitleEditStage\(\)/);
  assert.match(subtitleAnalysisUiRuntimeSource, /function renderSubtitlePreviewBody\(\)/);
  assert.match(mediaProfileStageSource, /data-action="profile-mode"/);
  assert.match(mediaProfileUiSource, /data-action="profile-preset"/);
  assert.match(mediaProfileStageSource, /data-action="profile-target-mode"/);
  assert.match(mediaProfileUiSource, /data-profile-field="/);
  assert.match(mediaProfileUiSource, /data-profile-toggle="/);
  assert.match(mediaProfileUiSource, /data-profile-artifact-toggle=/);
  assert.match(mediaProfileUiSource, /data-profile-field="frameSampleDensity"/);
  assert.match(mediaProfileUiSource, /data-profile-field="transcriptSampleSeconds"/);
  assert.match(
    mediaProfileTargetSource,
    /export function getMediaAnalysisProfileTargetAsset\(\s*deps(?::[\s\S]+?)?\s*\)/
  );
  assert.match(mediaProfileHelperSource, /export function getTopProfileSignals\(signals, limit, toRecord\)/);
  assert.match(mediaProfileHelperSource, /export function getPreferredSourceCodec\(sourceMetadata\)/);
  assert.match(mediaProfileHelperSource, /export function formatBitRate\(bitsPerSecond\)/);
  assert.match(mediaProfileRuntimeHelperSource, /export function createMediaAnalysisUiRuntimeHelpers\(deps\)/);
  assert.match(mediaSourceEditRuntimeSource, /export function createMediaAnalysisSourceEditUiRuntime\(deps\)/);
  assert.match(mediaProfileTargetSource, /target\.mode === "derived"/);
  assert.match(uiSource, /renderReportFinding/);
  assert.doesNotMatch(uiSource, /76 \/ 100/);
  assert.match(mediaProfileStageSource, /data-action="profile-run"/);
  assert.match(mediaProfileStageSource, /data-action="profile-cancel"/);
  assert.match(viewAccessorsRuntimeSource, /function renderProfileModelCard\(entry\)/);
  assert.match(settingsOverlaySource, /createLaboratorySettingsUi/);
  assert.match(settingsProfileModelSource, /data-action="profile-model-install"/);
  assert.match(settingsProfileModelSource, /data-action="profile-model-remove"/);
  assert.match(uiSource, /collectProfileStageJobs/);
  assert.match(markupSource, /function renderSummaryRows\(rows\)/);
  assert.match(markupSource, /function renderTextField\(fieldId, value, label, placeholder, extra\)/);
  assert.match(navigationRuntimeSource, /function normalizeContext\(message\)/);
  assert.match(navigationRuntimeSource, /function captureScrollState\(root\)/);
  assert.match(navigationRuntimeSource, /function restoreScrollState\(root\)/);
  assert.match(sourceStageSource, /function renderSourceStage\(\)/);
  assert.match(sourceStageSource, /function renderSourceIntakePanel\(\)/);
  assert.match(draftRuntimeSource, /function collectEditStageJobs\(projectJobs\)/);
  assert.match(draftRuntimeSource, /function collectProfileStageJobs\(projectJobs\)/);
  assert.match(draftAccessRuntimeSource, /createLaboratoryUiDraftAccessRuntime/);
  assert.match(draftAccessRuntimeSource, /function getCurrentDrafts\(\)/);
  assert.match(draftAccessRuntimeSource, /function buildCurrentDraftPayload\(\)/);
  assert.match(
    draftAccessRuntimeSource,
    /function syncLocalEditField\(path(?:: [^,)]+)?, value(?:: [^)]+)?\)/
  );
  assert.match(snapshotAccessRuntimeSource, /export function createLaboratorySnapshotAccessRuntime\(deps\)/);
  assert.match(snapshotAccessRuntimeSource, /function getProjectSource\(\)/);
  assert.match(snapshotAccessRuntimeSource, /function getProjectAudioAnalysis\(\)/);
  assert.match(snapshotAccessRuntimeSource, /function getJobs\(\)/);
  assert.match(viewBindingsRuntimeSource, /export function createLaboratoryViewBindingsRuntime\(deps\)/);
  assert.match(viewBindingsRuntimeSource, /function renderSettingsOverlay\(\)/);
  assert.match(
    profileAccessorsRuntimeSource,
    /export \{ createLaboratoryProfileProcessReportAccessorsRuntime \} from "\.\.\/shared\/ui\/profile-process-report-accessors\.js";/
  );
  assert.match(profileAccessorsSharedRuntimeSource, /function getProfileLabel\(\)/);
  assert.match(profileAccessorsSharedRuntimeSource, /function getReportExports\(\)/);
  assert.match(shellFrameSource, /function renderBootstrap\(\)/);
  assert.match(shellFrameSource, /function renderStageRail\(\)/);
  assert.match(shellFrameSource, /function renderStageIntro\(stageId\)/);
  assert.match(
    shellRenderSource,
    /export function renderLaboratoryStageContent\(\s*activeStage(?::[\s\S]+?)?,\s*renderers(?::[\s\S]+?)?\s*\)/
  );
  assert.match(
    shellRenderSource,
    /export function renderLaboratoryShell\(\s*deps(?::[\s\S]+?)?\s*\)/
  );
  assert.match(shellRuntimeSource, /export function createLaboratoryUiShellRuntime\(deps\)/);
  assert.match(shellRuntimeSource, /deps\.captureScrollState\(root\);/);
  assert.match(shellRuntimeSource, /deps\.restoreScrollState\(root\);/);
  assert.match(bootstrapRuntimeSource, /export function createLaboratoryUiBootstrapRuntime\(deps\)/);
  assert.match(bootstrapRuntimeSource, /function attach\(\)/);
  assert.match(copyRuntimeSource, /export function createLaboratoryCopyRuntime\(deps\)/);
  assert.match(copyRuntimeSource, /function getFeaturePreviewImage\(\)/);
  assert.match(copyRuntimeSource, /function subtitleTemplate\(path, replacements, trFallback, enFallback\)/);
  assert.match(uiSource, /getEffectiveMediaAsset/);
  assert.match(requestRuntimeSource, /function shouldIgnoreCorrelatedPayload\(requestId, action\)/);
  assert.match(requestRuntimeSource, /featureId: getActiveFeatureId\(\),/);
  assert.match(uiSource, /getPreferredSourceCodec/);
  assert.match(uiSource, /formatBitRate/);
  assert.match(uiSource, /const FEATURE_PREVIEW_IMAGES = \{/);
  assert.match(
    uiSource,
    /\[FEATURE_ID\]: "\.\.\/main-functions\/media-analysis\/assets\/media-analysis-view\.webp"/
  );
  assert.match(
    uiSource,
    /\[AUDIO_FEATURE_ID\]: "\.\.\/main-functions\/audio-analysis\/assets\/sound-analysis\.webp"/
  );
  assert.match(
    uiSource,
    /\[SUBTITLE_FEATURE_ID\]: "\.\.\/main-functions\/subtitle-analysis\/assets\/subtitle-analysis\.webp"/
  );
  assert.match(uiSource, /shared\/ui\/source-snapshot-selectors\.js/);
  assert.match(uiSource, /shared\/ui\/shell-runtime\.js/);
  assert.match(uiSource, /\.\/bootstrap-runtime\.js/);
  assert.match(uiSource, /\.\/bootstrap-state-runtime\.js/);
  assert.match(uiSource, /main-functions\/audio-analysis\/ui\/module\.js/);
  assert.match(uiSource, /main-functions\/subtitle-analysis\/ui\/runtime\.js/);
  assert.match(bootstrapStateSource, /scrollPositions:\s*\{\s*surface: 0,\s*overlay: 0,\s*\}/);
  assert.match(
    navigationRuntimeSource,
    /surface\.scrollTop = state\.ui\.surfaceScrollResetPending \? 0 : state\.ui\.scrollPositions\.surface;/
  );
  assert.match(
    navigationRuntimeSource,
    /overlayPanel\.scrollTop = state\.ui\.overlayScrollResetPending \? 0 : state\.ui\.scrollPositions\.overlay;/
  );
  assert.match(navigationRuntimeSource, /requestSurfaceScrollReset\(\);/);
  assert.match(requestRuntimeSource, /requestOverlayScrollReset\(\);/);
});

test("laboratory host orchestrates projects, source intake, edit rendering, and profile preflight through room tools", () => {
  const hostSource = readFileSync("rooms/laboratory/host/runtime.ts", "utf8");
  const hostFoundationSource = readFileSync("rooms/laboratory/host/foundation-runtimes.ts", "utf8");
  const hostProjectSource = readFileSync("rooms/laboratory/host/project-runtimes.ts", "utf8");
  const hostFeatureSource = readFileSync("rooms/laboratory/host/feature-runtimes.ts", "utf8");
  const activationSource = readFileSync("rooms/laboratory/shared/host/activation.ts", "utf8");
  const bridgeSource = readFileSync("rooms/laboratory/shared/host/electron-bridge.ts", "utf8");
  const ioRuntimeSource = readFileSync("rooms/laboratory/shared/host/io-runtime.ts", "utf8");
  const actionRouterSource = readFileSync("rooms/laboratory/shared/host/action-router.ts", "utf8");
  const runtimeBootstrapSource = readFileSync(
    "rooms/laboratory/shared/host/runtime-bootstrap.ts",
    "utf8"
  );
  const roomSnapshotSource = readFileSync("rooms/laboratory/shared/host/room-snapshot.ts", "utf8");
  const snapshotCompositionSource = readFileSync(
    "rooms/laboratory/shared/host/snapshot-composition.ts",
    "utf8"
  );
  const processTargetingSource = readFileSync("rooms/laboratory/shared/host/process-targeting.ts", "utf8");
  const processCompositionSource = readFileSync(
    "rooms/laboratory/shared/host/process-composition.ts",
    "utf8"
  );
  const stateCompositionSource = readFileSync(
    "rooms/laboratory/shared/host/state-composition.ts",
    "utf8"
  );
  const processReportStateSource = readFileSync(
    "rooms/laboratory/shared/host/process-report-state.ts",
    "utf8"
  );
  const closeoutStalenessSource = readFileSync(
    "rooms/laboratory/shared/host/closeout-staleness.ts",
    "utf8"
  );
  const hostUtilsSource = readFileSync("rooms/laboratory/shared/host/host-utils.ts", "utf8");
  const projectStateDelegatesSource = readFileSync(
    "rooms/laboratory/shared/host/project-state-delegates.ts",
    "utf8"
  );
  const projectManifestSource = readFileSync(
    "rooms/laboratory/shared/host/project-manifests.ts",
    "utf8"
  );
  const runtimeEventsSource = readFileSync("rooms/laboratory/shared/host/runtime-events.ts", "utf8");
  const runtimeStorageSource = readFileSync("rooms/laboratory/shared/host/runtime-storage.ts", "utf8");
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
  const roomToolsProgressSource = readFileSync("rooms/laboratory/shared/host/room-tools-progress.ts", "utf8");
  const sourceCompositionSource = readFileSync(
    "rooms/laboratory/shared/host/source-composition.ts",
    "utf8"
  );
  const audioProcessDelegatesSource = readFileSync(
    "rooms/laboratory/shared/host/audio-process-delegates.ts",
    "utf8"
  );
  const processOrchestrationSource = readFileSync(
    "rooms/laboratory/shared/host/process-orchestration.ts",
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
  const actionCompositionSource = readFileSync(
    "rooms/laboratory/shared/host/action-composition.ts",
    "utf8"
  );
  const actionRuntimeSource = readFileSync("rooms/laboratory/shared/host/action-runtime.ts", "utf8");
  const audioRuntimeSource = readFileSync(
    "rooms/laboratory/main-functions/audio-analysis/host/runtime.ts",
    "utf8"
  );
  const sourceDelegatesSource = readFileSync("rooms/laboratory/shared/host/source-delegates.ts", "utf8");
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
  const mediaActionHandlersSource = readFileSync(
    "rooms/laboratory/main-functions/media-analysis/host/action-handlers.ts",
    "utf8"
  );
  const mediaSourceActionHandlersSource = readFileSync(
    "rooms/laboratory/main-functions/media-analysis/host/action-handlers-source.ts",
    "utf8"
  );
  const mediaEditActionHandlersSource = readFileSync(
    "rooms/laboratory/main-functions/media-analysis/host/action-handlers-edit.ts",
    "utf8"
  );
  const mediaProfileActionHandlersSource = readFileSync(
    "rooms/laboratory/main-functions/media-analysis/host/action-handlers-profile.ts",
    "utf8"
  );
  const mediaProjectActionHandlersSource = readFileSync(
    "rooms/laboratory/main-functions/media-analysis/host/action-handlers-project.ts",
    "utf8"
  );
  const profileModelSource = readFileSync(
    "rooms/laboratory/main-functions/media-analysis/host/profile-models.ts",
    "utf8"
  );
  const mediaAnalysisRuntimeSource = readFileSync(
    "rooms/laboratory/main-functions/media-analysis/host/runtime.ts",
    "utf8"
  );
  const mediaProfileStateSource = readFileSync(
    "rooms/laboratory/main-functions/media-analysis/host/profile-state.ts",
    "utf8"
  );
  const editSupportSource = readFileSync(
    "rooms/laboratory/main-functions/media-analysis/host/edit-support.ts",
    "utf8"
  );
  const sourceMetadataSource = readFileSync(
    "rooms/laboratory/main-functions/media-analysis/host/source-metadata.ts",
    "utf8"
  );
  const sourceIntakeSource = readFileSync(
    "rooms/laboratory/main-functions/media-analysis/host/source-intake.ts",
    "utf8"
  );
  const sourceIntakeLocalSource = readFileSync(
    "rooms/laboratory/main-functions/media-analysis/host/source-intake-local.ts",
    "utf8"
  );
  const sourceIntakeUrlSource = readFileSync(
    "rooms/laboratory/main-functions/media-analysis/host/source-intake-url.ts",
    "utf8"
  );
  const sourceIntakeYoutubeSource = readFileSync(
    "rooms/laboratory/main-functions/media-analysis/host/source-intake-youtube.ts",
    "utf8"
  );
  const featureAdaptersSource = readFileSync("rooms/laboratory/host/feature-adapters.ts", "utf8");
  const hostCompositionSource = [
    hostSource,
    hostFoundationSource,
    hostProjectSource,
    hostFeatureSource,
    featureAdaptersSource,
  ].join("\n");

  assert.match(hostCompositionSource, /from "\.\.\/shared\/host\/io-runtime\.js"/);
  assert.match(hostCompositionSource, /from "\.\.\/shared\/host\/snapshot-composition\.js"/);
  assert.match(hostCompositionSource, /from "\.\.\/shared\/host\/state-composition\.js"/);
  assert.match(hostCompositionSource, /from "\.\.\/shared\/host\/host-utils\.js"/);
  assert.match(hostCompositionSource, /from "\.\.\/shared\/host\/runtime-primitives\.js"/);
  assert.match(hostCompositionSource, /from "\.\.\/shared\/host\/process-composition\.js"/);
  assert.match(processCompositionSource, /from "\.\/process-targeting\.js"/);
  assert.match(processCompositionSource, /from "\.\/process-coordination\.js"/);
  assert.match(hostCompositionSource, /from "\.\.\/shared\/host\/activation\.js"/);
  assert.match(hostCompositionSource, /from "\.\.\/shared\/host\/runtime-storage\.js"/);
  assert.match(hostCompositionSource, /from "\.\.\/shared\/host\/project-state\.js"/);
  assert.match(hostCompositionSource, /from "\.\.\/shared\/host\/profile-model-state\.js"/);
  assert.match(hostCompositionSource, /from "\.\.\/shared\/host\/runtime-bootstrap\.js"/);
  assert.match(hostCompositionSource, /from "\.\.\/shared\/host\/room-tools-progress\.js"/);
  assert.match(hostCompositionSource, /from "\.\/feature-adapters\.js"/);
  assert.match(featureAdaptersSource, /from "\.\.\/shared\/host\/action-composition\.js"/);
  assert.match(hostCompositionSource, /from "\.\.\/shared\/host\/source-composition\.js"/);
  assert.match(snapshotCompositionSource, /from "\.\/project-manifests\.js"/);
  assert.match(snapshotCompositionSource, /from "\.\/room-snapshot\.js"/);
  assert.match(snapshotCompositionSource, /from "\.\/runtime-events\.js"/);
  assert.match(
    snapshotCompositionSource,
    /export function createLaboratorySnapshotCompositionRuntime\(deps\)/
  );
  assert.match(hostCompositionSource, /from "\.\.\/main-functions\/media-analysis\/host\/runtime\.js"/);
  assert.match(processCompositionSource, /from "\.\.\/\.\.\/main-functions\/audio-analysis\/host\/runtime\.js"/);
  assert.match(processCompositionSource, /from "\.\/process-orchestration\.js"/);
  assert.match(sourceCompositionSource, /from "\.\/source-delegates\.js"/);
  assert.match(
    sourceCompositionSource,
    /from "\.\.\/\.\.\/main-functions\/media-analysis\/host\/source-file-utils\.js"/
  );
  assert.match(
    sourceCompositionSource,
    /from "\.\.\/\.\.\/main-functions\/media-analysis\/host\/source-metadata\.js"/
  );
  assert.match(
    sourceCompositionSource,
    /from "\.\.\/\.\.\/main-functions\/media-analysis\/host\/source-intake\.js"/
  );
  assert.match(stateCompositionSource, /from "\.\/closeout-staleness\.js"/);
  assert.match(stateCompositionSource, /from "\.\/process-report-state\.js"/);
  assert.match(stateCompositionSource, /from "\.\/project-records\.js"/);
  assert.match(stateCompositionSource, /from "\.\/project-state-delegates\.js"/);
  assert.match(stateCompositionSource, /from "\.\/subtitle-projection\.js"/);
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
    /from "\.\.\/\.\.\/main-functions\/subtitle-analysis\/host\/state-delegates\.js"/
  );
  assert.match(
    stateCompositionSource,
    /from "\.\.\/\.\.\/main-functions\/subtitle-analysis\/host\/state\.js"/
  );
  assert.match(
    stateCompositionSource,
    /export function createLaboratoryHostStateCompositionRuntime\(deps\)/
  );
  assert.match(bridgeSource, /electronApi\.roomToolsCall/);
  assert.match(runtimeBootstrapSource, /function createRuntimeState\(\)/);
  assert.match(runtimeBootstrapSource, /function sanitizeContext\(payload, api\)/);
  assert.match(processTargetingSource, /function resolveProcessTarget\(project, featureId\)/);
  assert.match(
    closeoutStalenessSource,
    /export function createLaboratoryCloseoutStalenessRuntime\(\s*deps(?::[\s\S]+?)?\s*\)/
  );
  assert.match(
    closeoutStalenessSource,
    /function markCloseoutAsStale\(\s*project\??(?::[\s\S]+?)?,\s*reason\??(?::[\s\S]+?)?,\s*targetFeatureIds\??(?::[\s\S]+?)?\s*\)(?::[\s\S]+?)?/
  );
  assert.match(
    hostUtilsSource,
    /export function createLaboratoryHostUtils\(\s*deps(?::[\s\S]+?)?\s*\)/
  );
  assert.match(hostUtilsSource, /function getPreferredFeatureSourceKind\(featureId, sourcePresets\)/);
  assert.match(audioProcessDelegatesSource, /export function createLaboratoryAudioProcessDelegatesRuntime/);
  assert.match(
    audioProcessDelegatesSource,
    /function getAudioAnalysisModuleProcessDir\(\s*runtime,\s*project,\s*moduleId,?\s*\)/
  );
  assert.match(processOrchestrationSource, /export function createLaboratoryProcessOrchestrationRuntime\(deps\)/);
  assert.match(processOrchestrationSource, /function buildMediaProcessModules\(runtime, project, target\)/);
  assert.match(processOrchestrationSource, /function buildProcessSpeechAvailability\(runtime, project\)/);
  assert.match(processOrchestrationSource, /function createEmptyProcessRun\(featureId\)/);
  assert.match(processOrchestrationSource, /function updateProcessModule\(record, moduleId, patch\)/);
  assert.match(actionCompositionSource, /export function createLaboratoryActionCompositionRuntime\(deps\)/);
  assert.match(actionCompositionSource, /from "\.\/action-runtime\.js"/);
  assert.match(actionCompositionSource, /from "\.\/tool-mutations\.js"/);
  assert.match(
    actionCompositionSource,
    /from "\.\.\/\.\.\/main-functions\/media-analysis\/host\/action-handlers\.js"/
  );
  assert.match(
    mediaActionHandlersSource,
    /import \{ createMediaSourceActionRuntime \} from "\.\/action-handlers-source\.js";/
  );
  assert.match(
    mediaActionHandlersSource,
    /import \{ createMediaEditActionRuntime \} from "\.\/action-handlers-edit\.js";/
  );
  assert.match(
    mediaActionHandlersSource,
    /import \{ createMediaProfileActionRuntime \} from "\.\/action-handlers-profile\.js";/
  );
  assert.match(
    mediaActionHandlersSource,
    /import \{ createMediaProjectActionRuntime \} from "\.\/action-handlers-project\.js";/
  );
  assert.match(mediaActionHandlersSource, /export function createMediaActionRuntime\(deps\)/);
  assert.match(mediaActionHandlersSource, /\.\.\.mediaSourceActionRuntime,/);
  assert.match(mediaActionHandlersSource, /\.\.\.mediaEditActionRuntime,/);
  assert.match(mediaActionHandlersSource, /\.\.\.mediaProfileActionRuntime,/);
  assert.match(mediaActionHandlersSource, /\.\.\.mediaProjectActionRuntime,/);
  assert.match(
    mediaSourceActionHandlersSource,
    /export function createMediaSourceActionRuntime\(deps\)/
  );
  assert.match(mediaSourceActionHandlersSource, /async function setSourceKind\(runtime, actionPayload\)/);
  assert.match(mediaSourceActionHandlersSource, /async function downloadYoutube\(api, runtime, requestId, actionPayload\)/);
  assert.match(
    mediaEditActionHandlersSource,
    /export function createMediaEditActionRuntime\(deps\)/
  );
  assert.match(mediaEditActionHandlersSource, /async function applyEditPreset\(runtime, actionPayload\)/);
  assert.match(mediaEditActionHandlersSource, /async function previewEdit\(api, runtime, requestId, actionPayload\)/);
  assert.match(mediaEditActionHandlersSource, /async function cancelApply\(api, runtime, requestId\)/);
  assert.match(
    mediaProfileActionHandlersSource,
    /export function createMediaProfileActionRuntime\(deps\)/
  );
  assert.match(mediaProfileActionHandlersSource, /async function applyProfilePreset\(runtime, actionPayload\)/);
  assert.match(mediaProfileActionHandlersSource, /async function runProfile\(api, runtime, requestId\)/);
  assert.match(mediaProfileActionHandlersSource, /async function removeProfile\(runtime, requestId, actionPayload\)/);
  assert.match(
    mediaProjectActionHandlersSource,
    /export function createMediaProjectActionRuntime\(deps\)/
  );
  assert.match(mediaProjectActionHandlersSource, /async function refresh\(runtime, requestId, checkUpdates\)/);
  assert.match(mediaProjectActionHandlersSource, /async function mutateTool\(api, runtime, requestId, action, actionPayload, featureStage\)/);
  assert.match(
    actionRuntimeSource,
    /export function createLaboratoryHostActionRuntime\(\s*deps(?::[\s\S]+?)?\s*\)/
  );
  assert.match(actionRuntimeSource, /function getActionRouter\(\)/);
  assert.match(
    actionRuntimeSource,
    /function handleToolMutation\(\s*api\??(?::[\s\S]+?)?,\s*runtime\??(?::[\s\S]+?)?,\s*requestId\??(?::[\s\S]+?)?,\s*action\??(?::[\s\S]+?)?,\s*toolId\??(?::[\s\S]+?)?,\s*featureStage\??(?::[\s\S]+?)?\s*\)(?::[\s\S]+?)?/
  );
  assert.match(
    actionRuntimeSource,
    /function handleMediaAction\(\s*api\??(?::[\s\S]+?)?,\s*runtime\??(?::[\s\S]+?)?,\s*payload\??(?::[\s\S]+?)?\s*\)(?::[\s\S]+?)?/
  );
  assert.match(actionRuntimeSource, /from "\.\/action-router\.js"/);
  assert.match(actionRouterSource, /export function createLaboratoryActionRouter\(deps\)/);
  assert.match(audioRuntimeSource, /export function createLaboratoryAudioAnalysisHostRuntime\(deps\)/);
  assert.match(audioRuntimeSource, /createAudioAnalysisStateRuntime\(/);
  assert.match(audioRuntimeSource, /createAudioAnalysisProjectionRuntime\(/);
  assert.match(audioRuntimeSource, /createAudioAnalysisProcessRuntime\(/);
  assert.match(audioRuntimeSource, /createLaboratoryAudioProcessDelegatesRuntime\(/);
  assert.match(
    sourceDelegatesSource,
    /export function createLaboratorySourceDelegatesRuntime\(\s*deps(?::[\s\S]+?)?\s*\)/
  );
  assert.match(sourceDelegatesSource, /function handleLocalPick\(api, runtime, requestId\)/);
  assert.match(
    sourceDelegatesSource,
    /function getResolvedYoutubeSettings\(\s*project,\s*sourcePresets,?\s*\)/
  );
  assert.match(sourceDelegatesSource, /async function handleYoutubeDownload\(api, runtime, requestId\)/);
  assert.match(
    sourceIntakeSource,
    /import \{ createMediaLocalSourceIntakeRuntime \} from "\.\/source-intake-local\.js";/
  );
  assert.match(
    sourceIntakeSource,
    /import \{ createMediaUrlSourceIntakeRuntime \} from "\.\/source-intake-url\.js";/
  );
  assert.match(
    sourceIntakeSource,
    /import \{ createMediaYoutubeSourceIntakeRuntime \} from "\.\/source-intake-youtube\.js";/
  );
  assert.match(sourceIntakeSource, /export function createMediaSourceIntakeRuntime\(deps\)/);
  assert.match(sourceIntakeSource, /\.\.\.mediaLocalSourceIntakeRuntime,/);
  assert.match(sourceIntakeSource, /\.\.\.mediaUrlSourceIntakeRuntime,/);
  assert.match(sourceIntakeSource, /\.\.\.mediaYoutubeSourceIntakeRuntime,/);
  assert.match(
    sourceIntakeLocalSource,
    /export function createMediaLocalSourceIntakeRuntime\(deps\)/
  );
  assert.match(sourceIntakeLocalSource, /async function handleLocalPick\(api, runtime, requestId\)/);
  assert.match(
    sourceIntakeUrlSource,
    /export function createMediaUrlSourceIntakeRuntime\(deps\)/
  );
  assert.match(sourceIntakeUrlSource, /async function handleUrlDownload\(api, runtime, requestId\)/);
  assert.match(
    sourceIntakeYoutubeSource,
    /export function createMediaYoutubeSourceIntakeRuntime\(deps\)/
  );
  assert.match(
    sourceIntakeYoutubeSource,
    /function getResolvedYoutubeSettings\(project, sourcePresets\)/
  );
  assert.match(sourceIntakeYoutubeSource, /function buildYtDlpArgs\(project, toolState, sourceDir\)/);
  assert.match(sourceIntakeYoutubeSource, /async function handleYoutubeDownload\(api, runtime, requestId\)/);
  assert.match(processReportStateSource, /function normalizeProcessState\(rawValue\)/);
  assert.match(processReportStateSource, /function normalizeReportState\(rawValue\)/);
  assert.match(projectManifestSource, /export function createLaboratoryProjectManifestRuntime\(deps\)/);
  assert.match(projectManifestSource, /function buildEditManifest\(project\)/);
  assert.match(projectManifestSource, /function buildProfileManifest\(project\)/);
  assert.match(projectManifestSource, /function buildSourceTargetSignature\(project\)/);
  assert.match(projectManifestSource, /function buildDerivedTargetSignature\(output\)/);
  assert.match(mediaAnalysisRuntimeSource, /export function createLaboratoryMediaAnalysisHostRuntime\(deps\)/);
  assert.match(mediaAnalysisRuntimeSource, /createMediaEditSupportRuntime\(/);
  assert.match(mediaAnalysisRuntimeSource, /createMediaEditArtifactRuntime\(/);
  assert.match(mediaAnalysisRuntimeSource, /createMediaEditPipelineRuntime\(/);
  assert.match(mediaAnalysisRuntimeSource, /createMediaProfilePreflightRuntime\(/);
  assert.match(mediaProfileStateSource, /export function createMediaProfileStateRuntime\(deps\)/);
  assert.match(mediaProfileStateSource, /function resetProfileForCurrentSource\(runtime, nextProject, reason\)/);
  assert.match(mediaProfileStateSource, /function markProfileAsStale\(nextProject, reason, options\)/);
  assert.match(
    readFileSync("rooms/laboratory/shared/host/process-coordination.ts", "utf8"),
    /export function createLaboratoryProcessCoordinationRuntime\(deps\)/
  );
  assert.match(
    readFileSync("rooms/laboratory/shared/host/project-state.ts", "utf8"),
    /export function createLaboratoryProjectStateRuntime\(\s*deps(?::[\s\S]+?)?\s*\)/
  );
  assert.match(
    projectStateDelegatesSource,
    /export function createLaboratoryProjectStateDelegatesRuntime\(\s*deps(?::[\s\S]+?)?\s*\)/
  );
  assert.match(processReportStateSource, /function setFeatureProcessRecord\(project, featureId, record\)/);
  assert.match(processReportStateSource, /function setFeatureReportRecord\(project, featureId, record\)/);
  assert.match(runtimeEventsSource, /function pushMediaState\(api, runtime, requestId, action\)/);
  assert.match(runtimeEventsSource, /function pushJobState\(api, payload\)/);
  assert.match(runtimeEventsSource, /notifyRoom\(api, "media-state"/);
  assert.match(runtimeEventsSource, /notifyRoom\(api, "media-action-result"/);
  assert.match(runtimeEventsSource, /notifyRoom\(api, "media-job"/);
  assert.match(runtimeEventsSource, /notifyRoom\(api, "source-state"/);
  assert.match(runtimeEventsSource, /notifyRoom\(api, "source-action-result"/);
  assert.match(runtimeEventsSource, /notifyRoom\(api, "source-job"/);
  assert.match(
    runtimeStorageSource,
    /function getProfileModelDescriptorMap\(\s*runtime\??(?::[\s\S]+?)?\s*\)(?::[\s\S]+?)?/
  );
  assert.match(
    runtimeStorageSource,
    /async function refreshProfileModelState\(\s*runtime\??(?::[\s\S]+?)?\s*\)(?::[\s\S]+?)?/
  );
  assert.match(projectRecordsSource, /export function createLaboratoryProjectRecordsRuntime\(deps\)/);
  assert.match(projectRecordsSource, /function createProjectRecord\(/);
  assert.match(
    subtitleProjectionSource,
    /export function createLaboratorySubtitleProjectionRuntime\(\s*deps(?::[\s\S]+?)?\s*\)/
  );
  assert.match(
    subtitleProjectionSource,
    /function syncProjectSubtitleAnalysisProjection\(\s*runtime\??(?::[\s\S]+?)?,\s*project\??(?::[\s\S]+?)?\s*\)(?::[\s\S]+?)?/
  );
  assert.match(activationSource, /export function createLaboratoryHostActivation\(deps\)/);
  assert.match(activationSource, /onRoomReady: function onRoomReady\(payload\)/);
  assert.match(activationSource, /onRoomEvent: function onRoomEvent\(payload\)/);
  assert.match(processTargetingSource, /function buildMediaProcessModules\(runtime, project, target\)/);
  assert.match(
    roomToolsProgressSource,
    /function ensureRoomToolsSubscription\(\s*api\??(?::[\s\S]+?)?,\s*runtime\??(?::[\s\S]+?)?\s*\)(?::[\s\S]+?)?/
  );
  assert.match(
    activationSource,
    /if \(payload\.type === "source-action" \|\| payload\.type === "media-action"\)/
  );
  assert.match(actionRouterSource, /case "project-create":/);
  assert.match(actionRouterSource, /case "edit-set-mode":/);
  assert.match(actionRouterSource, /case "edit-apply-preset":/);
  assert.match(actionRouterSource, /case "edit-update-recipe":/);
  assert.match(actionRouterSource, /case "edit-preview":/);
  assert.match(actionRouterSource, /case "edit-apply":/);
  assert.match(actionRouterSource, /case "edit-cancel-preview":/);
  assert.match(actionRouterSource, /case "edit-cancel-apply":/);
  assert.match(actionRouterSource, /case "profile-set-mode":/);
  assert.match(actionRouterSource, /case "profile-apply-preset":/);
  assert.match(actionRouterSource, /case "profile-update":/);
  assert.match(actionRouterSource, /case "profile-set-target":/);
  assert.match(actionRouterSource, /case "profile-set-model":/);
  assert.match(actionRouterSource, /case "profile-run-preflight":/);
  assert.match(actionRouterSource, /case "profile-cancel-preflight":/);
  assert.match(actionRouterSource, /case "profile-model-install":/);
  assert.match(actionRouterSource, /case "profile-model-remove":/);
  assert.match(actionRouterSource, /case "tool-install":/);
  assert.match(actionRouterSource, /case "tool-update":/);
  assert.match(sourceCompositionSource, /validateSourceCandidate/);
  assert.match(hostCompositionSource, /collectDerivedOutputMetadata/);
  assert.match(hostCompositionSource, /shared\/host\/project-lifecycle\.js/);
  assert.match(lifecycleSource, /from "\.\/project-config-loader\.js"/);
  assert.match(lifecycleSource, /from "\.\/project-storage\.js"/);
  assert.match(lifecycleSource, /from "\.\/project-tool-status\.js"/);
  assert.match(
    projectConfigLoaderSource,
    /export function createLaboratoryProjectConfigLoader\(\s*deps(?::[\s\S]+?)?\s*\)/
  );
  assert.match(
    projectStorageSource,
    /export function createLaboratoryProjectStorageRuntime\(deps\)/
  );
  assert.match(
    projectToolStatusSource,
    /export function createLaboratoryProjectToolStatusRuntime\(\s*deps(?::[\s\S]+?)?\s*\)/
  );
  assert.match(projectStorageSource, /async function loadProjects\(runtime\)/);
  assert.match(projectStorageSource, /async function saveProject\(runtime, project\)/);
  assert.match(projectToolStatusSource, /operation: "tool-probe"/);
  assert.match(projectToolStatusSource, /operation: "tool-check-for-updates"/);
  assert.match(hostCompositionSource, /shared\/host\/project-paths\.js/);
  assert.match(featureAdaptersSource, /shared\/host\/action-composition\.js/);
  assert.match(hostCompositionSource, /shared\/host\/snapshot-composition\.js/);
  assert.match(reportingSource, /from "\.\/reporting-feature-report\.js"/);
  assert.match(reportingSource, /from "\.\/reporting-export\.js"/);
  assert.match(reportingFeatureSource, /from "\.\/reporting-audio\.js"/);
  assert.match(reportingFeatureSource, /from "\.\/reporting-subtitle\.js"/);
  assert.match(reportingFeatureSource, /from "\.\/reporting-markdown\.js"/);
  assert.match(
    reportingFeatureSource,
    /export function createLaboratoryFeatureReportRuntime\(\s*deps(?::[\s\S]+?)?\s*\)/
  );
  assert.match(
    reportingExportSource,
    /export function createLaboratoryReportExportRuntime\(\s*deps(?::[\s\S]+?)?\s*\)/
  );
  assert.match(reportingAudioSource, /export function createLaboratoryAudioReportRuntime\(deps\)/);
  assert.match(reportingSubtitleSource, /export function createLaboratorySubtitleReportRuntime\(deps\)/);
  assert.match(reportingMarkdownSource, /export function createLaboratoryReportMarkdownRuntime\(deps\)/);
  assert.match(reportingMarkdownSource, /function buildReportMarkdown\(runtime, project, featureId, reportRecord\)/);
  assert.doesNotMatch(hostCompositionSource, /main-functions\/media-analysis\/host\/edit-support\.js/);
  assert.doesNotMatch(hostCompositionSource, /main-functions\/media-analysis\/host\/edit-pipeline\.js/);
  assert.match(hostCompositionSource, /main-functions\/media-analysis\/host\/profile-models\.js/);
  assert.match(hostCompositionSource, /main-functions\/media-analysis\/host\/profile-projection\.js/);
  assert.doesNotMatch(hostCompositionSource, /main-functions\/media-analysis\/host\/profile-preflight\.js/);
  assert.match(hostCompositionSource, /main-functions\/media-analysis\/host\/profile-state\.js/);
  assert.doesNotMatch(hostCompositionSource, /function resetProfileForCurrentSource\(runtime, nextProject, reason\)/);
  assert.doesNotMatch(hostCompositionSource, /function markProfileAsStale\(nextProject, reason, options\)/);
  assert.match(sourceCompositionSource, /main-functions\/media-analysis\/host\/source-metadata\.js/);
  assert.match(sourceCompositionSource, /main-functions\/media-analysis\/host\/source-intake\.js/);
  assert.match(sourceCompositionSource, /\.\/source-delegates\.js/);
  assert.match(
    sourceCompositionSource,
    /const laboratorySourceDelegatesRuntime = createLaboratorySourceDelegatesRuntime\(/
  );
  assert.match(sourceMetadataSource, /function parseFfprobeMetadata\(stdout, kind, mimeType\)/);
  assert.match(sourceMetadataSource, /async function collectDerivedOutputMetadata\(runtime, project, options\)/);
  assert.match(hostCompositionSource, /buildEditManifest/);
  assert.match(featureAdaptersSource, /shared\/host\/action-composition\.js/);
  assert.doesNotMatch(hostCompositionSource, /const laboratoryActionRouter = createLaboratoryActionRouter\(/);
  assert.match(editSupportSource, /function buildEditCommand\(runtime, project, outputPath, mode\)/);
  assert.match(editSupportSource, /function findEditPreset\(runtime, project, presetId\)/);
  assert.match(hostCompositionSource, /runEditPipeline/);
  assert.match(hostCompositionSource, /buildProfileManifest/);
  assert.match(hostCompositionSource, /runProfilePreflight/);
  assert.match(hostCompositionSource, /normalizeProfileArtifactPreferences/);
  assert.match(profileModelSource, /function evaluateProfileModelCompatibility\(runtime, descriptor, whisperSummary\)/);
  assert.match(hostCompositionSource, /generateProfileFrameStrip/);
  assert.match(hostCompositionSource, /generateProfileSpectrogram/);
  assert.match(hostCompositionSource, /maybeRunWhisperProfileSample/);
  assert.match(hostCompositionSource, /syncProjectProfileProjection/);
  assert.match(roomSnapshotSource, /function buildProjectedProjects\(runtime\)/);
  assert.match(hostCompositionSource, /shared\/host\/io-runtime\.js/);
  assert.match(
    ioRuntimeSource,
    /async function ensureProjectDirectories\(\s*runtime\??(?::[\s\S]+?)?,\s*project\??(?::[\s\S]+?)?,\s*requestId\??(?::[\s\S]+?)?\s*\)(?::[\s\S]+?)?/
  );
  assert.match(bridgeSource, /operation: "ensure-dir"/);
  assert.match(bridgeSource, /Unsupported room-tools operation: ensure-dir/);
  assert.match(sourceMetadataSource, /executableName: executableName/);
  assert.doesNotMatch(hostCompositionSource, /api\.notifyRoom\("host-context", loadContext\(api\)\)/);
});

test("laboratory source stage wires the generic room-tools ipc seam", () => {
  const preloadSource = readFileSync("electron/preload.cjs", "utf8");
  const handlerSource = readFileSync("electron/handlers/ipc-room-tools.ts", "utf8");
  const mainSource = readFileSync("electron/main.ts", "utf8");
  const globalTypes = readFileSync("src/js/global.d.ts", "utf8");

  assert.match(preloadSource, /const ROOM_TOOLS_PROGRESS_CHANNEL = "room-tools:progress";/);
  assert.match(preloadSource, /roomToolsCall: \(request\) => ipcRenderer\.invoke\("room-tools-call", request\)/);
  assert.match(preloadSource, /roomToolsCancel: \(request\) => ipcRenderer\.invoke\("room-tools-cancel", request\)/);
  assert.match(preloadSource, /onRoomToolsProgress: \(callback\)/);
  assert.match(handlerSource, /export function setupRoomToolHandlers\(\): void/);
  assert.match(handlerSource, /registerHandler\("room-tools-call"/);
  assert.match(handlerSource, /registerHandler\("room-tools-cancel"/);
  assert.match(mainSource, /setupRoomToolHandlers\(\);/);
  assert.match(globalTypes, /roomToolsCall: \(request: RoomToolCallRequest\) => Promise<RoomToolCallResult>;/);
  assert.match(globalTypes, /onRoomToolsProgress: \(callback: \(event: RoomToolProgressEvent\) => void\) => void;/);
});
