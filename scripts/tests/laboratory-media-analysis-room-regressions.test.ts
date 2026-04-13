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

function typedDepsSignature(name: string): RegExp {
  return new RegExp(`export function ${name}\\(\\s*deps(?::[\\s\\S]+?)?\\s*\\)`);
}

function typedParamSignature(name: string, paramName: string): RegExp {
  return new RegExp(`function ${name}\\(\\s*${paramName}(?::[\\s\\S]+?)?(?:,|\\))`);
}

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
  assert.match(
    actionRouterActionsSource,
    /export function createLaboratoryUiActionHandlers\(\s*deps(?::[\s\S]+?)?\s*\)/
  );
  assert.match(
    actionRouterActionsSource,
    /function handleAction\(action(?::[\s\S]+?)?, value(?::[\s\S]+?)?\)/
  );
  assert.match(
    actionRouterEventsSource,
    /export function createLaboratoryUiActionEventRuntime\(\s*deps(?::[\s\S]+?)?\s*\)/
  );
  assert.match(
    actionRouterEventsSource,
    /function handleClick\(event(?::[\s\S]+?)?\)/
  );
  assert.match(
    actionRouterEventsSource,
    /function handleChange\(event(?::[\s\S]+?)?\)/
  );
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
    /export function createLaboratoryFeatureStageBundlesRuntime\(\s*deps(?::[\s\S]+?)?\s*\)/
  );
  assert.match(
    featureStagePanelsSource,
    /export function createLaboratoryFeatureStagePanelsRuntime\(\s*deps(?::[\s\S]+?)?\s*\)/
  );
  assert.match(uiSource, /\.\/source-stage-composition\.js/);
  assert.match(shellFrameSource, /data-action="open-settings"/);
  assert.match(sourceStageSource, /\.\/source-stage-intake\.js/);
  assert.match(sourceStageSource, /\.\/source-stage-project\.js/);
  assert.match(
    sourceStageIntakeSource,
    /export function createLaboratorySourceStageIntakeRuntime\(\s*deps(?::[\s\S]+?)?\s*\)/
  );
  assert.match(
    sourceStageProjectSource,
    /export function createLaboratorySourceStageProjectRuntime\(\s*deps(?::[\s\S]+?)?\s*\)/
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
  assert.match(
    sourceStageCompositionSource,
    typedDepsSignature("createLaboratorySourceStageComposition")
  );
  assert.match(sourceStageCompositionSource, /return createLaboratorySourceStageUi\(/);
  assert.match(uiSource, /shared\/ui\/host-messages\.js/);
  assert.match(uiSource, /shared\/ui\/settings-overlay\.js/);
  assert.match(uiSource, /shared\/ui\/report-stage\.js/);
  assert.match(reportStageSource, /\.\/report-stage-support\.js/);
  assert.match(reportStageSource, /\.\/report-stage-subtitle\.js/);
  assert.match(
    reportStageSupportSource,
    typedDepsSignature("createLaboratoryReportStageSupportRuntime")
  );
  assert.match(
    reportStageSubtitleSource,
    typedDepsSignature("createLaboratorySubtitleReportStageRuntime")
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
    typedDepsSignature("createLaboratorySettingsProfileModelRuntime")
  );
  assert.match(
    settingsToolCardSource,
    typedDepsSignature("createLaboratorySettingsToolCardRuntime")
  );
  assert.match(settingsToolCardSource, /data-action="tool-install"/);
  assert.match(settingsToolCardSource, /data-action="tool-update"/);
  assert.match(requestRuntimeSource, /roomApi\.sendEvent\("media-action"/);
  assert.match(hostMessageSource, /messageType === "media-state" \|\| messageType === "source-state"/);
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
  assert.match(editRuntimeSource, typedParamSignature("commitEditPatch", "patch"));
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
    typedDepsSignature("createLaboratoryProfileProcessReportAccessorsRuntime")
  );
  assert.match(
    profileProcessReportCompositionSource,
    /export \{ createLaboratoryProfileProcessReportComposition \} from "\.\.\/shared\/ui\/profile-process-report-composition\.js";/
  );
  assert.match(
    profileProcessReportCompositionSharedSource,
    typedDepsSignature("createLaboratoryProfileProcessReportComposition")
  );
  assert.match(uiSource, /\.\/runtime-composition\.js/);
  assert.match(
    uiRuntimeCompositionSource,
    typedDepsSignature("createLaboratoryUiRuntimeComposition")
  );
  assert.match(uiRuntimeCompositionSource, /\.\/view-runtime\.js/);
  assert.match(uiRuntimeCompositionSource, /shared\/ui\/feature-runtime\.js/);
  assert.match(uiRuntimeCompositionSource, /\.\/stage-accessors-runtime\.js/);
  assert.match(subtitleAnalysisUiRuntimeSource, typedDepsSignature("createSubtitleAnalysisUiRuntime"));
  assert.match(subtitleAnalysisUiRuntimeSource, /function renderSubtitleEditStage\(\)/);
  assert.match(subtitleAnalysisUiRuntimeSource, /function renderSubtitlePreviewBody\(/);
  assert.match(subtitleModuleSource, /from "\.\/source-panels\.js"/);
  assert.match(subtitleModuleSource, /from "\.\/edit-panels\.js"/);
  assert.match(subtitleSourcePanelsSource, /from "\.\/source-panel-primitives\.js"/);
  assert.match(subtitleSourcePanelsSource, /from "\.\/source-panel-intake\.js"/);
  assert.match(subtitleSourcePanelsSource, /from "\.\/source-panel-workspace\.js"/);
  assert.match(
    subtitleSourcePrimitivesSource,
    typedDepsSignature("createSubtitleAnalysisSourcePanelPrimitives")
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
    typedDepsSignature("createLaboratorySnapshotProjectSelectors")
  );
  assert.match(sourceSnapshotProjectSelectorsSource, /function getActiveProject\(\)/);
  assert.match(sourceSnapshotProjectSelectorsSource, /function getCurrentFeatureProcessRecord\(\)/);
  assert.match(sourceSnapshotProjectSelectorsSource, /function getActiveEditOutput\(\)/);
  assert.match(
    sourceSnapshotSubtitleSelectorsSource,
    typedDepsSignature("createLaboratorySnapshotSubtitleSelectors")
  );
  assert.match(
    sourceSnapshotSubtitleSelectorsSource,
    typedParamSignature("getSubtitleProcessModuleLabel", "entry")
  );
  assert.match(
    sourceSnapshotSubtitleSelectorsSource,
    typedParamSignature("getSubtitleProviderModuleLabels", "entry")
  );
  assert.match(sourceSnapshotSubtitleSelectorsSource, /function getSubtitleActiveEntry\(\)|function getActiveSubtitleEntry\(\)/);
  assert.match(
    sourceSnapshotAudioSelectorsSource,
    typedDepsSignature("createLaboratorySnapshotAudioSelectors")
  );
  assert.match(sourceSnapshotAudioSelectorsSource, /function getAudioAnalysisModules\(\)/);
  assert.match(sourceSnapshotAudioSelectorsSource, /function getAudioAnalysisOrderedResultEntries\(\)/);
  assert.match(
    sourceSnapshotToolSelectorsSource,
    /export function createLaboratorySnapshotToolSelectors\(\s*deps(?::[\s\S]+?)?\s*\)/
  );
  assert.match(
    sourceSnapshotToolSelectorsSource,
    typedParamSignature("getToolEntry", "toolId")
  );
  assert.match(
    sourceSnapshotToolSelectorsSource,
    typedParamSignature("getStageToolIds", "stageId")
  );
  assert.match(
    sourceSnapshotToolSelectorsSource,
    typedParamSignature("getWorkspaceCapabilities", "kind")
  );
  assert.match(uiSource, /\.\/view-bindings-runtime\.js/);
  assert.match(
    viewAccessorsRuntimeSource,
    typedDepsSignature("createLaboratoryViewAccessorsRuntime")
  );
  assert.match(viewAccessorsRuntimeSource, /function getCurrentFeatureProcessRecord\(\)/);
  assert.match(viewAccessorsRuntimeSource, /function getCurrentFeatureReportRecord\(\)/);
  assert.match(viewAccessorsRuntimeSource, /function getProjectAudioAnalysis\(\)/);
  assert.match(viewAccessorsRuntimeSource, /function getSubtitleEntries\(\)/);
  assert.match(
    viewAccessorsRuntimeSource,
    typedParamSignature("getSubtitleProcessModuleLabel", "entry")
  );
  assert.match(
    viewAccessorsRuntimeSource,
    typedParamSignature("getSubtitleProviderLabel", "entry")
  );
  assert.match(viewAccessorsRuntimeSource, /function getAudioAnalysisCapabilities\(\)/);
  assert.match(viewAccessorsRuntimeSource, /function getAudioAnalysisPresets\(\)/);
  assert.match(viewAccessorsRuntimeSource, /function getAudioAnalysisProviders\(\)/);
  assert.match(viewAccessorsRuntimeSource, /function getAudioAnalysisProviderEntries\(\)/);
  assert.match(viewAccessorsRuntimeSource, /function getAudioAnalysisOrderedResultEntries\(\)/);
  assert.match(
    viewAccessorsRuntimeSource,
    /function renderToolCard\(\s*toolId(?::[\s\S]+?)?,\s*stageId(?::[\s\S]+?)?\)/
  );
  assert.match(
    viewAccessorsRuntimeSource,
    typedParamSignature("renderProfileModelCard", "entry")
  );
  assert.match(viewAccessorsRuntimeSource, /function renderSettingsOverlay\(\)/);
  assert.match(viewAccessorsRuntimeSource, /function getProfileTargetAsset\(\)/);
  assert.match(uiSource, /main-functions\/media-analysis\/ui\/profile-stage\.js/);
  assert.match(uiSource, /main-functions\/media-analysis\/ui\/profile-target\.js/);
  assert.match(featureRuntimeSource, typedDepsSignature("createLaboratoryUiFeatureRuntime"));
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
  assert.match(subtitleAnalysisUiRuntimeSource, typedDepsSignature("createSubtitleAnalysisUiRuntime"));
  assert.match(subtitleAnalysisUiRuntimeSource, /function renderSubtitleEditStage\(\)/);
  assert.match(subtitleAnalysisUiRuntimeSource, /function renderSubtitlePreviewBody\(/);
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
  assert.match(
    mediaProfileHelperSource,
    /export function getTopProfileSignals\(\s*signals(?::[\s\S]+?)?(?:,|\))/
  );
  assert.match(
    mediaProfileHelperSource,
    /export function getPreferredSourceCodec\(\s*sourceMetadata(?::[\s\S]+?)?\s*\)/
  );
  assert.match(
    mediaProfileHelperSource,
    /export function formatBitRate\(\s*bitsPerSecond(?::[\s\S]+?)?\s*\)/
  );
  assert.match(
    mediaProfileRuntimeHelperSource,
    typedDepsSignature("createMediaAnalysisUiRuntimeHelpers")
  );
  assert.match(
    mediaSourceEditRuntimeSource,
    typedDepsSignature("createMediaAnalysisSourceEditUiRuntime")
  );
  assert.match(mediaProfileTargetSource, /target\.mode === "derived"/);
  assert.match(uiSource, /renderReportFinding/);
  assert.doesNotMatch(uiSource, /76 \/ 100/);
  assert.match(mediaProfileStageSource, /data-action="profile-run"/);
  assert.match(mediaProfileStageSource, /data-action="profile-cancel"/);
  assert.match(
    viewAccessorsRuntimeSource,
    typedParamSignature("renderProfileModelCard", "entry")
  );
  assert.match(settingsOverlaySource, /createLaboratorySettingsUi/);
  assert.match(settingsOverlaySource, /lab-overlay--center/);
  assert.match(settingsOverlaySource, /aria-modal="true"/);
  assert.match(settingsOverlaySource, /lab-overlay__scrim/);
  assert.match(settingsProfileModelSource, /data-action="profile-model-install"/);
  assert.match(settingsProfileModelSource, /data-action="profile-model-remove"/);
  assert.match(settingsProfileModelSource, /getToolRegistry/);
  assert.match(settingsProfileModelSource, /modelVerificationHint/);
  assert.match(uiSource, /collectProfileStageJobs/);
  assert.match(markupSource, typedParamSignature("renderSummaryRows", "rows"));
  assert.match(
    markupSource,
    /function renderTextField\(\s*fieldId(?::[\s\S]+?)?,\s*value(?::[\s\S]+?)?,\s*label(?::[\s\S]+?)?,\s*placeholder(?::[\s\S]+?)?,\s*extra(?::[\s\S]+?)?\)/
  );
  assert.match(navigationRuntimeSource, typedParamSignature("normalizeContext", "message"));
  assert.match(navigationRuntimeSource, typedParamSignature("captureScrollState", "root"));
  assert.match(navigationRuntimeSource, typedParamSignature("restoreScrollState", "root"));
  assert.match(sourceStageSource, /function renderSourceStage\(\)/);
  assert.match(sourceStageSource, /function renderSourceIntakePanel\(\)/);
  assert.match(sourceStageSource, /data-action="workbench-toggle-module"/);
  assert.match(draftRuntimeSource, typedParamSignature("collectEditStageJobs", "projectJobs"));
  assert.match(
    draftRuntimeSource,
    typedParamSignature("collectProfileStageJobs", "projectJobs")
  );
  assert.match(draftAccessRuntimeSource, /createLaboratoryUiDraftAccessRuntime/);
  assert.match(draftAccessRuntimeSource, /function getCurrentDrafts\(\)/);
  assert.match(draftAccessRuntimeSource, /function buildCurrentDraftPayload\(\)/);
  assert.match(
    draftAccessRuntimeSource,
    /function syncLocalEditField\(path(?:: [^,)]+)?, value(?:: [^)]+)?\)/
  );
  assert.match(
    snapshotAccessRuntimeSource,
    typedDepsSignature("createLaboratorySnapshotAccessRuntime")
  );
  assert.match(snapshotAccessRuntimeSource, /function getProjectSource\(\)/);
  assert.match(snapshotAccessRuntimeSource, /function getProjectAudioAnalysis\(\)/);
  assert.match(snapshotAccessRuntimeSource, /function getJobs\(\)/);
  assert.match(
    viewBindingsRuntimeSource,
    typedDepsSignature("createLaboratoryViewBindingsRuntime")
  );
  assert.match(viewBindingsRuntimeSource, /function renderSettingsOverlay\(\)/);
  assert.match(
    profileAccessorsRuntimeSource,
    /export \{ createLaboratoryProfileProcessReportAccessorsRuntime \} from "\.\.\/shared\/ui\/profile-process-report-accessors\.js";/
  );
  assert.match(profileAccessorsSharedRuntimeSource, /function getProfileLabel\(\)/);
  assert.match(profileAccessorsSharedRuntimeSource, /function getReportExports\(\)/);
  assert.match(shellFrameSource, /function renderBootstrap\(\)/);
  assert.match(shellFrameSource, /function renderStageRail\(\)/);
  assert.match(shellFrameSource, typedParamSignature("renderStageIntro", "stageId"));
  assert.match(
    shellRenderSource,
    /export function renderLaboratoryStageContent\(\s*activeStage(?::[\s\S]+?)?,\s*renderers(?::[\s\S]+?)?\s*\)/
  );
  assert.match(
    shellRenderSource,
    /export function renderLaboratoryShell\(\s*deps(?::[\s\S]+?)?\s*\)/
  );
  assert.match(shellRenderSource, /lab-shell__overlay/);
  assert.match(shellRuntimeSource, typedDepsSignature("createLaboratoryUiShellRuntime"));
  assert.match(shellRuntimeSource, /captureScrollState\(root\);/);
  assert.match(shellRuntimeSource, /restoreScrollState\(root\);/);
  assert.match(
    bootstrapRuntimeSource,
    typedDepsSignature("createLaboratoryUiBootstrapRuntime")
  );
  assert.match(bootstrapRuntimeSource, /function attach\(\)/);
  assert.match(bootstrapRuntimeSource, /let attached = false;/);
  assert.match(bootstrapRuntimeSource, /if \(attached\) \{\s*return;\s*\}/);
  assert.match(copyRuntimeSource, typedDepsSignature("createLaboratoryCopyRuntime"));
  assert.match(copyRuntimeSource, /function getFeaturePreviewImage\(\)/);
  assert.match(copyRuntimeSource, typedParamSignature("subtitleTemplate", "path"));
  assert.match(uiSource, /getEffectiveMediaAsset/);
  assert.match(
    requestRuntimeSource,
    /function shouldIgnoreCorrelatedPayload\(\s*requestId(?::[\s\S]+?)?,\s*action(?::[\s\S]+?)?\)/
  );
  assert.match(
    requestRuntimeSource,
    typedParamSignature("toggleWorkbenchModuleSelection", "featureId")
  );
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
  assert.match(bootstrapStateSource, /settingsAnimateIn: false,/);
  assert.match(
    navigationRuntimeSource,
    /surface\.scrollTop = state\.ui\.surfaceScrollResetPending \? 0 : state\.ui\.scrollPositions\.surface;/
  );
  assert.match(
    navigationRuntimeSource,
    /overlayPanel\.scrollTop = state\.ui\.overlayScrollResetPending\s*\?\s*0\s*:\s*state\.ui\.scrollPositions\.overlay;/
  );
  assert.match(navigationRuntimeSource, /requestSurfaceScrollReset\(\);/);
  assert.match(requestRuntimeSource, /requestOverlayScrollReset\(\);/);
  assert.match(requestRuntimeSource, /state\.ui\.settingsAnimateIn = true;/);
  assert.match(requestRuntimeSource, /state\.ui\.settingsAnimateIn = false;/);
  assert.match(requestRuntimeSource, /sendSourceAction\("tools-refresh", \{\}\);/);
  assert.match(settingsOverlaySource, /data-animate="\$\{state\.ui\.settingsAnimateIn === true \? "enter" : "idle"\}"/);
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
    /export function createLaboratorySnapshotCompositionRuntime\(\s*deps(?::[\s\S]+?)?\s*\)/
  );
  assert.match(hostCompositionSource, /from "\.\.\/main-functions\/media-analysis\/host\/runtime\.js"/);
  assert.match(processCompositionSource, /from "\.\.\/\.\.\/main-functions\/audio-analysis\/host\/runtime\.js"/);
  assert.match(processCompositionSource, /from "\.\/process-orchestration\.js"/);
  assert.match(sourceCompositionSource, /from "\.\/source-delegates\.js"/);
  assert.match(hostProjectSource, /getDefaultYoutubePreset: preset\.getDefaultYoutubePreset,/);
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
    /export function createSubtitleStateDefaultsRuntime\(\s*deps(?::[\s\S]+?)?\s*\)/
  );
  assert.match(
    subtitleStateNormalizationSource,
    /export function createSubtitleStateNormalizationRuntime\(\s*deps(?::[\s\S]+?)?\s*\)/
  );
  assert.match(
    subtitleStateProjectsSource,
    /export function createSubtitleStateProjectRuntime\(\s*deps(?::[\s\S]+?)?\s*\)/
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
    /export function createLaboratoryHostStateCompositionRuntime\(\s*deps(?::[\s\S]+?)?\s*\)/
  );
  assert.match(bridgeSource, /electronApi\.roomToolsCall/);
  assert.match(runtimeBootstrapSource, /function createRuntimeState\(\)/);
  assert.match(runtimeBootstrapSource, typedParamSignature("sanitizeContext", "payload"));
  assert.match(processTargetingSource, typedParamSignature("resolveProcessTarget", "project"));
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
  assert.match(hostUtilsSource, typedParamSignature("getPreferredFeatureSourceKind", "featureId"));
  assert.match(audioProcessDelegatesSource, /export function createLaboratoryAudioProcessDelegatesRuntime/);
  assert.match(
    audioProcessDelegatesSource,
    /getAudioAnalysisModuleProcessDir:\s*audioAnalysisProcessRuntime\.getModuleProcessDir/
  );
  assert.match(
    processOrchestrationSource,
    typedDepsSignature("createLaboratoryProcessOrchestrationRuntime")
  );
  assert.match(processOrchestrationSource, typedParamSignature("buildMediaProcessModules", "runtime"));
  assert.match(
    processOrchestrationSource,
    typedParamSignature("buildProcessSpeechAvailability", "runtime")
  );
  assert.match(processOrchestrationSource, typedParamSignature("createEmptyProcessRun", "featureId"));
  assert.match(processOrchestrationSource, typedParamSignature("updateProcessModule", "record"));
  assert.match(
    actionCompositionSource,
    typedDepsSignature("createLaboratoryActionCompositionRuntime")
  );
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
  assert.match(mediaActionHandlersSource, typedDepsSignature("createMediaActionRuntime"));
  assert.match(mediaActionHandlersSource, /\.\.\.mediaSourceActionRuntime,/);
  assert.match(mediaActionHandlersSource, /\.\.\.mediaEditActionRuntime,/);
  assert.match(mediaActionHandlersSource, /\.\.\.mediaProfileActionRuntime,/);
  assert.match(mediaActionHandlersSource, /\.\.\.mediaProjectActionRuntime,/);
  assert.match(
    mediaSourceActionHandlersSource,
    typedDepsSignature("createMediaSourceActionRuntime")
  );
  assert.match(mediaSourceActionHandlersSource, typedParamSignature("setSourceKind", "runtime"));
  assert.match(mediaSourceActionHandlersSource, typedParamSignature("downloadYoutube", "api"));
  assert.match(
    mediaEditActionHandlersSource,
    typedDepsSignature("createMediaEditActionRuntime")
  );
  assert.match(mediaEditActionHandlersSource, typedParamSignature("applyEditPreset", "runtime"));
  assert.match(mediaEditActionHandlersSource, typedParamSignature("previewEdit", "api"));
  assert.match(mediaEditActionHandlersSource, typedParamSignature("cancelApply", "api"));
  assert.match(
    mediaProfileActionHandlersSource,
    typedDepsSignature("createMediaProfileActionRuntime")
  );
  assert.match(mediaProfileActionHandlersSource, typedParamSignature("applyProfilePreset", "runtime"));
  assert.match(mediaProfileActionHandlersSource, typedParamSignature("runProfile", "api"));
  assert.match(mediaProfileActionHandlersSource, typedParamSignature("removeProfile", "runtime"));
  assert.match(
    mediaProjectActionHandlersSource,
    typedDepsSignature("createMediaProjectActionRuntime")
  );
  assert.match(mediaProjectActionHandlersSource, typedParamSignature("refresh", "runtime"));
  assert.match(mediaProjectActionHandlersSource, typedParamSignature("mutateTool", "api"));
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
  assert.match(actionRouterSource, typedDepsSignature("createLaboratoryActionRouter"));
  assert.match(audioRuntimeSource, typedDepsSignature("createLaboratoryAudioAnalysisHostRuntime"));
  assert.match(audioRuntimeSource, /createAudioAnalysisStateRuntime\(/);
  assert.match(audioRuntimeSource, /createAudioAnalysisProjectionRuntime\(/);
  assert.match(audioRuntimeSource, /createAudioAnalysisProcessRuntime\(/);
  assert.match(audioRuntimeSource, /createLaboratoryAudioProcessDelegatesRuntime\(/);
  assert.match(
    sourceDelegatesSource,
    /export function createLaboratorySourceDelegatesRuntime\(\s*deps(?::[\s\S]+?)?\s*\)/
  );
  assert.match(sourceDelegatesSource, /handleLocalPick:\s*mediaSourceIntakeRuntime\.handleLocalPick/);
  assert.match(
    sourceDelegatesSource,
    /getResolvedYoutubeSettings:\s*mediaSourceIntakeRuntime\.getResolvedYoutubeSettings/
  );
  assert.match(
    sourceDelegatesSource,
    /handleYoutubeDownload:\s*mediaSourceIntakeRuntime\.handleYoutubeDownload/
  );
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
  assert.match(sourceIntakeSource, typedDepsSignature("createMediaSourceIntakeRuntime"));
  assert.match(sourceIntakeSource, /\.\.\.mediaLocalSourceIntakeRuntime,/);
  assert.match(sourceIntakeSource, /\.\.\.mediaUrlSourceIntakeRuntime,/);
  assert.match(sourceIntakeSource, /\.\.\.mediaYoutubeSourceIntakeRuntime,/);
  assert.match(
    sourceIntakeLocalSource,
    typedDepsSignature("createMediaLocalSourceIntakeRuntime")
  );
  assert.match(sourceIntakeLocalSource, typedParamSignature("handleLocalPick", "_api"));
  assert.match(
    sourceIntakeUrlSource,
    typedDepsSignature("createMediaUrlSourceIntakeRuntime")
  );
  assert.match(sourceIntakeUrlSource, typedParamSignature("handleUrlDownload", "api"));
  assert.match(
    sourceIntakeYoutubeSource,
    typedDepsSignature("createMediaYoutubeSourceIntakeRuntime")
  );
  assert.match(sourceIntakeYoutubeSource, typedParamSignature("getResolvedYoutubeSettings", "project"));
  assert.match(sourceIntakeYoutubeSource, typedParamSignature("buildYtDlpArgs", "project"));
  assert.match(sourceIntakeYoutubeSource, typedParamSignature("handleYoutubeDownload", "api"));
  assert.match(processReportStateSource, typedParamSignature("normalizeProcessState", "rawValue"));
  assert.match(processReportStateSource, typedParamSignature("normalizeReportState", "rawValue"));
  assert.match(projectManifestSource, typedDepsSignature("createLaboratoryProjectManifestRuntime"));
  assert.match(projectManifestSource, typedParamSignature("buildEditManifest", "project"));
  assert.match(projectManifestSource, typedParamSignature("buildProfileManifest", "project"));
  assert.match(projectManifestSource, typedParamSignature("buildSourceTargetSignature", "project"));
  assert.match(projectManifestSource, typedParamSignature("buildDerivedTargetSignature", "output"));
  assert.match(
    mediaAnalysisRuntimeSource,
    typedDepsSignature("createLaboratoryMediaAnalysisHostRuntime")
  );
  assert.match(mediaAnalysisRuntimeSource, /createMediaEditSupportRuntime\(/);
  assert.match(mediaAnalysisRuntimeSource, /createMediaEditArtifactRuntime\(/);
  assert.match(mediaAnalysisRuntimeSource, /createMediaEditPipelineRuntime\(/);
  assert.match(mediaAnalysisRuntimeSource, /createMediaProfilePreflightRuntime\(/);
  assert.match(mediaProfileStateSource, typedDepsSignature("createMediaProfileStateRuntime"));
  assert.match(
    mediaProfileStateSource,
    /function resetProfileForCurrentSource\(\s*runtime(?::[\s\S]+?)?,\s*nextProject(?::[\s\S]+?)?,\s*reason(?::[\s\S]+?)?\)/
  );
  assert.match(
    mediaProfileStateSource,
    /function markProfileAsStale\(\s*nextProject(?::[\s\S]+?)?,\s*reason(?::[\s\S]+?)?,\s*options(?::[\s\S]+?)?\)/
  );
  assert.match(
    readFileSync("rooms/laboratory/shared/host/process-coordination.ts", "utf8"),
    typedDepsSignature("createLaboratoryProcessCoordinationRuntime")
  );
  assert.match(
    readFileSync("rooms/laboratory/shared/host/project-state.ts", "utf8"),
    /export function createLaboratoryProjectStateRuntime\(\s*deps(?::[\s\S]+?)?\s*\)/
  );
  assert.match(
    projectStateDelegatesSource,
    /export function createLaboratoryProjectStateDelegatesRuntime\(\s*deps(?::[\s\S]+?)?\s*\)/
  );
  assert.match(processReportStateSource, typedParamSignature("setFeatureProcessRecord", "project"));
  assert.match(processReportStateSource, typedParamSignature("setFeatureReportRecord", "project"));
  assert.match(runtimeEventsSource, typedParamSignature("pushMediaState", "api"));
  assert.match(runtimeEventsSource, typedParamSignature("pushJobState", "api"));
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
  assert.match(
    projectRecordsSource,
    /export function createLaboratoryProjectRecordsRuntime\(\s*deps(?::[\s\S]+?)?\s*\)/
  );
  assert.match(projectRecordsSource, /function createProjectRecord\(/);
  assert.match(
    subtitleProjectionSource,
    /export function createLaboratorySubtitleProjectionRuntime\(\s*deps(?::[\s\S]+?)?\s*\)/
  );
  assert.match(
    subtitleProjectionSource,
    /function syncProjectSubtitleAnalysisProjection\(\s*runtime\??(?::[\s\S]+?)?,\s*project\??(?::[\s\S]+?)?\s*\)(?::[\s\S]+?)?/
  );
  assert.match(
    activationSource,
    /export function createLaboratoryHostActivation\(\s*deps(?::[\s\S]+?)?\s*\)/
  );
  assert.match(activationSource, /onRoomReady\(\s*payload(?::[\s\S]+?)?\s*\)\s*\{/);
  assert.match(activationSource, /onRoomEvent\(\s*payload(?::[\s\S]+?)?\s*\)\s*\{/);
  assert.match(
    processTargetingSource,
    /function buildMediaProcessModules\(\s*_?runtime(?::[\s\S]+?)?,\s*project(?::[\s\S]+?)?,\s*target(?::[\s\S]+?)?\)/
  );
  assert.match(
    roomToolsProgressSource,
    /function ensureRoomToolsSubscription\(\s*api\??(?::[\s\S]+?)?,\s*runtime\??(?::[\s\S]+?)?\s*\)(?::[\s\S]+?)?/
  );
  assert.match(
    activationSource,
    /if \(eventPayload\.type === "source-action" \|\| eventPayload\.type === "media-action"\)/
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
    /export function createLaboratoryProjectStorageRuntime\(\s*deps(?::[\s\S]+?)?\s*\)/
  );
  assert.match(
    projectToolStatusSource,
    /export function createLaboratoryProjectToolStatusRuntime\(\s*deps(?::[\s\S]+?)?\s*\)/
  );
  assert.match(
    projectStorageSource,
    /async function loadProjects\(\s*runtime(?::[\s\S]+?)?\s*\)/
  );
  assert.match(
    projectStorageSource,
    /async function saveProject\(\s*runtime(?::[\s\S]+?)?,\s*project(?::[\s\S]+?)?\s*\)/
  );
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
  assert.match(
    reportingAudioSource,
    /export function createLaboratoryAudioReportRuntime\(\s*deps(?::[\s\S]+?)?\s*\)/
  );
  assert.match(
    reportingSubtitleSource,
    /export function createLaboratorySubtitleReportRuntime\(\s*deps(?::[\s\S]+?)?\s*\)/
  );
  assert.match(
    reportingMarkdownSource,
    /export function createLaboratoryReportMarkdownRuntime\(\s*deps(?::[\s\S]+?)?\s*\)/
  );
  assert.match(
    reportingMarkdownSource,
    /function buildReportMarkdown\(\s*runtime(?::[\s\S]+?)?,\s*project(?::[\s\S]+?)?,\s*featureId(?::[\s\S]+?)?,\s*reportRecord(?::[\s\S]+?)?\)(?::[\s\S]+?)?/
  );
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
  assert.match(
    sourceMetadataSource,
    /function parseFfprobeMetadata\(\s*stdout(?::[\s\S]+?)?,\s*kind(?::[\s\S]+?)?,\s*mimeType(?::[\s\S]+?)?\)/
  );
  assert.match(
    sourceMetadataSource,
    /async function collectDerivedOutputMetadata\(\s*runtime(?::[\s\S]+?)?,\s*project(?::[\s\S]+?)?,\s*options(?::[\s\S]+?)?\)(?::[\s\S]+?)?/
  );
  assert.match(hostCompositionSource, /buildEditManifest/);
  assert.match(featureAdaptersSource, /shared\/host\/action-composition\.js/);
  assert.doesNotMatch(hostCompositionSource, /const laboratoryActionRouter = createLaboratoryActionRouter\(/);
  assert.match(
    editSupportSource,
    /function buildEditCommand\(\s*runtime(?::[\s\S]+?)?,\s*project(?::[\s\S]+?)?,\s*outputPath(?::[\s\S]+?)?,\s*mode(?::[\s\S]+?)?\)/
  );
  assert.match(
    editSupportSource,
    /function findEditPreset\(\s*runtime(?::[\s\S]+?)?,\s*project(?::[\s\S]+?)?,\s*presetId(?::[\s\S]+?)?\)/
  );
  assert.match(hostCompositionSource, /runEditPipeline/);
  assert.match(hostCompositionSource, /buildProfileManifest/);
  assert.match(hostCompositionSource, /runProfilePreflight/);
  assert.match(hostCompositionSource, /normalizeProfileArtifactPreferences/);
  assert.match(
    profileModelSource,
    /function evaluateProfileModelCompatibility\(\s*runtime(?::[\s\S]+?)?,\s*descriptor(?::[\s\S]+?)?,\s*whisperSummary(?::[\s\S]+?)?\)/
  );
  assert.match(hostCompositionSource, /generateProfileFrameStrip/);
  assert.match(hostCompositionSource, /generateProfileSpectrogram/);
  assert.match(hostCompositionSource, /maybeRunWhisperProfileSample/);
  assert.match(hostCompositionSource, /syncProjectProfileProjection/);
  assert.match(roomSnapshotSource, typedParamSignature("buildProjectedProjects", "runtime"));
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

test("laboratory profile runtime keeps clamp wiring and preset fallback guards intact", () => {
  const featureRuntimesSource = readFileSync("rooms/laboratory/host/feature-runtimes.ts", "utf8");
  const profileStateSource = readFileSync(
    "rooms/laboratory/main-functions/media-analysis/host/profile-state.ts",
    "utf8"
  );
  const actionRouterActionsSource = readFileSync(
    "rooms/laboratory/shared/ui/action-router-actions.ts",
    "utf8"
  );

  assert.match(
    featureRuntimesSource,
    /clampProfileTranscriptSampleSeconds:\s*projectRuntimes\.mediaProfileState\.clampProfileTranscriptSampleSeconds,/
  );
  assert.match(
    profileStateSource,
    /function markProfileAsStale\(\s*nextProject:\s*MediaProfileProjectRecord,\s*reason:\s*string,\s*options:\s*MediaProfileRecord = \{\}\s*\)/
  );
  assert.match(profileStateSource, /const staleOptions = toRecord\(options\);/);
  assert.match(
    actionRouterActionsSource,
    /case "profile-preset":[\s\S]*sendMediaAction\("profile-apply-preset", \{[\s\S]*outputId:\s*getDerivedProfileOutputId\(\),/
  );
});

test("laboratory source signatures ignore project timestamp churn and preflight footer stays quiet", () => {
  const projectManifestSource = readFileSync(
    "rooms/laboratory/shared/host/project-manifests.ts",
    "utf8"
  );
  const hostMessagesSource = readFileSync("rooms/laboratory/shared/ui/host-messages.ts", "utf8");

  assert.doesNotMatch(
    projectManifestSource,
    /function buildSourceTargetSignature\([\s\S]*updatedAt:\s*asNonEmptyString\(projectRecord\.updatedAt\),/
  );
  assert.match(hostMessagesSource, /function shouldHideInlineActionResult/);
  assert.match(
    hostMessagesSource,
    /return actionId === "profile-run-preflight" \|\| actionId === "profile-cancel-preflight";/
  );
  assert.match(hostMessagesSource, /function shouldHideInlineJobProgress/);
});
