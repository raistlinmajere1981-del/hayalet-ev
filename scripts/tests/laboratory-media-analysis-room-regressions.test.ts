import test from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";

import { validateRoomManifest } from "../../src/types/rooms.ts";

const requiredFiles = [
  "rooms/laboratory/manifest.json",
  "rooms/laboratory/host/index.js",
  "rooms/laboratory/host/runtime.js",
  "rooms/laboratory/shared/host/project-lifecycle.js",
  "rooms/laboratory/shared/host/project-paths.js",
  "rooms/laboratory/shared/host/process-runtime.js",
  "rooms/laboratory/shared/host/process-targeting.js",
  "rooms/laboratory/shared/host/process-report-state.js",
  "rooms/laboratory/shared/host/process-coordination.js",
  "rooms/laboratory/shared/host/closeout-staleness.js",
  "rooms/laboratory/shared/host/host-utils.js",
  "rooms/laboratory/shared/host/runtime-primitives.js",
  "rooms/laboratory/shared/host/io-runtime.js",
  "rooms/laboratory/shared/host/project-manifests.js",
  "rooms/laboratory/shared/host/project-state.js",
  "rooms/laboratory/shared/host/project-state-delegates.js",
  "rooms/laboratory/shared/host/profile-model-state.js",
  "rooms/laboratory/shared/host/activation.js",
  "rooms/laboratory/shared/host/audio-process-delegates.js",
  "rooms/laboratory/shared/host/process-orchestration.js",
  "rooms/laboratory/shared/host/action-composition.js",
  "rooms/laboratory/shared/host/action-runtime.js",
  "rooms/laboratory/shared/host/runtime-bootstrap.js",
  "rooms/laboratory/shared/host/runtime-events.js",
  "rooms/laboratory/shared/host/runtime-storage.js",
  "rooms/laboratory/shared/host/room-snapshot.js",
  "rooms/laboratory/shared/host/project-records.js",
  "rooms/laboratory/shared/host/room-tools-progress.js",
  "rooms/laboratory/shared/host/source-composition.js",
  "rooms/laboratory/shared/host/snapshot-composition.js",
  "rooms/laboratory/shared/host/state-composition.js",
  "rooms/laboratory/shared/host/reporting.js",
  "rooms/laboratory/shared/host/source-delegates.js",
  "rooms/laboratory/shared/host/subtitle-projection.js",
  "rooms/laboratory/shared/host/tool-mutations.js",
  "rooms/laboratory/shared/ui/action-router.js",
  "rooms/laboratory/shared/ui/copy-runtime.js",
  "rooms/laboratory/shared/ui/markup.js",
  "rooms/laboratory/shared/ui/draft-runtime.js",
  "rooms/laboratory/shared/ui/host-messages.js",
  "rooms/laboratory/shared/ui/navigation-runtime.js",
  "rooms/laboratory/shared/ui/process-stage.js",
  "rooms/laboratory/shared/ui/request-runtime.js",
  "rooms/laboratory/shared/ui/report-stage.js",
  "rooms/laboratory/shared/ui/shell-frame.js",
  "rooms/laboratory/shared/ui/stage-shell-delegates.js",
  "rooms/laboratory/shared/ui/shell-render.js",
  "rooms/laboratory/shared/ui/settings-overlay.js",
  "rooms/laboratory/shared/ui/source-stage.js",
  "rooms/laboratory/shared/ui/source-snapshot-selectors.js",
  "rooms/laboratory/shared/ui/shell-runtime.js",
  "rooms/laboratory/shared/ui/feature-runtime.js",
  "rooms/laboratory/shared/ui/profile-process-report-accessors.js",
  "rooms/laboratory/shared/ui/profile-process-report-composition.js",
  "rooms/laboratory/ui/draft-access-runtime.js",
  "rooms/laboratory/ui/profile-process-report-accessors.js",
  "rooms/laboratory/ui/profile-process-report-composition.js",
  "rooms/laboratory/ui/profile-process-report-runtime.js",
  "rooms/laboratory/ui/runtime-composition.js",
  "rooms/laboratory/ui/source-stage-composition.js",
  "rooms/laboratory/ui/snapshot-access-runtime.js",
  "rooms/laboratory/ui/view-bindings-runtime.js",
  "rooms/laboratory/ui/subtitle-panel-runtime.js",
  "rooms/laboratory/ui/view-accessors-runtime.js",
  "rooms/laboratory/ui/index.html",
  "rooms/laboratory/ui/index.js",
  "rooms/laboratory/ui/laboratory-ui-runtime.js",
  "rooms/laboratory/ui/bootstrap-runtime.js",
  "rooms/laboratory/ui/style.css",
  "rooms/laboratory/shared/styles/shell.css",
  "rooms/laboratory/main-functions/media-analysis/host/action-handlers.js",
  "rooms/laboratory/main-functions/media-analysis/host/edit-pipeline.js",
  "rooms/laboratory/main-functions/media-analysis/host/profile-models.js",
  "rooms/laboratory/main-functions/media-analysis/host/profile-projection.js",
  "rooms/laboratory/main-functions/media-analysis/host/profile-preflight.js",
  "rooms/laboratory/main-functions/media-analysis/host/profile-state.js",
  "rooms/laboratory/main-functions/media-analysis/host/runtime.js",
  "rooms/laboratory/main-functions/media-analysis/host/source-metadata.js",
  "rooms/laboratory/main-functions/media-analysis/host/source-intake.js",
  "rooms/laboratory/main-functions/media-analysis/styles.css",
  "rooms/laboratory/main-functions/audio-analysis/host/runtime.js",
  "rooms/laboratory/main-functions/media-analysis/ui/edit-stage.js",
  "rooms/laboratory/main-functions/media-analysis/ui/profile-helpers.js",
  "rooms/laboratory/main-functions/media-analysis/ui/runtime.js",
  "rooms/laboratory/main-functions/media-analysis/ui/runtime-helpers.js",
  "rooms/laboratory/main-functions/media-analysis/ui/source-edit-runtime.js",
  "rooms/laboratory/main-functions/media-analysis/ui/profile-target.js",
  "rooms/laboratory/main-functions/media-analysis/ui/profile-panels.js",
  "rooms/laboratory/main-functions/media-analysis/ui/profile-stage.js",
  "rooms/laboratory/main-functions/audio-analysis/host/module-projection.js",
  "rooms/laboratory/main-functions/audio-analysis/host/state.js",
  "rooms/laboratory/main-functions/audio-analysis/styles.css",
  "rooms/laboratory/main-functions/audio-analysis/ui/module.js",
  "rooms/laboratory/main-functions/subtitle-analysis/styles.css",
  "rooms/laboratory/main-functions/subtitle-analysis/host/action-handlers.js",
  "rooms/laboratory/main-functions/subtitle-analysis/host/edit-workspace.js",
  "rooms/laboratory/main-functions/subtitle-analysis/host/process-analysis.js",
  "rooms/laboratory/main-functions/subtitle-analysis/host/runtime.js",
  "rooms/laboratory/main-functions/subtitle-analysis/host/state.js",
  "rooms/laboratory/main-functions/subtitle-analysis/ui/module.js",
  "rooms/laboratory/main-functions/subtitle-analysis/ui/runtime.js",
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
  const uiSource = readFileSync("rooms/laboratory/ui/laboratory-ui-runtime.js", "utf8");
  const mediaProfileUiSource = readFileSync(
    "rooms/laboratory/main-functions/media-analysis/ui/profile-panels.js",
    "utf8"
  );
  const mediaProfileHelperSource = readFileSync(
    "rooms/laboratory/main-functions/media-analysis/ui/profile-helpers.js",
    "utf8"
  );
  const mediaProfileRuntimeHelperSource = readFileSync(
    "rooms/laboratory/main-functions/media-analysis/ui/runtime-helpers.js",
    "utf8"
  );
  const viewAccessorsRuntimeSource = readFileSync(
    "rooms/laboratory/ui/view-accessors-runtime.js",
    "utf8"
  );
  const mediaRuntimeSource = readFileSync(
    "rooms/laboratory/main-functions/media-analysis/ui/runtime.js",
    "utf8"
  );
  const mediaSourceEditRuntimeSource = readFileSync(
    "rooms/laboratory/main-functions/media-analysis/ui/source-edit-runtime.js",
    "utf8"
  );
  const mediaProfileStageSource = readFileSync(
    "rooms/laboratory/main-functions/media-analysis/ui/profile-stage.js",
    "utf8"
  );
  const mediaEditUiSource = readFileSync(
    "rooms/laboratory/main-functions/media-analysis/ui/edit-panels.js",
    "utf8"
  );
  const mediaEditStageSource = readFileSync(
    "rooms/laboratory/main-functions/media-analysis/ui/edit-stage.js",
    "utf8"
  );
  const mediaProfileTargetSource = readFileSync(
    "rooms/laboratory/main-functions/media-analysis/ui/profile-target.js",
    "utf8"
  );
  const hostMessageSource = readFileSync("rooms/laboratory/shared/ui/host-messages.js", "utf8");
  const copyRuntimeSource = readFileSync("rooms/laboratory/shared/ui/copy-runtime.js", "utf8");
  const markupSource = readFileSync("rooms/laboratory/shared/ui/markup.js", "utf8");
  const draftRuntimeSource = readFileSync("rooms/laboratory/shared/ui/draft-runtime.js", "utf8");
  const draftAccessRuntimeSource = readFileSync("rooms/laboratory/ui/draft-access-runtime.js", "utf8");
  const snapshotAccessRuntimeSource = readFileSync(
    "rooms/laboratory/ui/snapshot-access-runtime.js",
    "utf8"
  );
  const viewBindingsRuntimeSource = readFileSync(
    "rooms/laboratory/ui/view-bindings-runtime.js",
    "utf8"
  );
  const profileAccessorsRuntimeSource = readFileSync(
    "rooms/laboratory/ui/profile-process-report-accessors.js",
    "utf8"
  );
  const profileAccessorsSharedRuntimeSource = readFileSync(
    "rooms/laboratory/shared/ui/profile-process-report-accessors.js",
    "utf8"
  );
  const navigationRuntimeSource = readFileSync(
    "rooms/laboratory/shared/ui/navigation-runtime.js",
    "utf8"
  );
  const requestRuntimeSource = readFileSync(
    "rooms/laboratory/shared/ui/request-runtime.js",
    "utf8"
  );
  const stageShellDelegatesSource = readFileSync(
    "rooms/laboratory/shared/ui/stage-shell-delegates.js",
    "utf8"
  );
  const shellRenderSource = readFileSync("rooms/laboratory/shared/ui/shell-render.js", "utf8");
  const shellRuntimeSource = readFileSync("rooms/laboratory/shared/ui/shell-runtime.js", "utf8");
  const shellFrameSource = readFileSync("rooms/laboratory/shared/ui/shell-frame.js", "utf8");
  const featureRuntimeSource = readFileSync("rooms/laboratory/shared/ui/feature-runtime.js", "utf8");
  const profileProcessReportRuntimeSource = readFileSync(
    "rooms/laboratory/ui/profile-process-report-runtime.js",
    "utf8"
  );
  const profileProcessReportCompositionSource = readFileSync(
    "rooms/laboratory/ui/profile-process-report-composition.js",
    "utf8"
  );
  const profileProcessReportCompositionSharedSource = readFileSync(
    "rooms/laboratory/shared/ui/profile-process-report-composition.js",
    "utf8"
  );
  const uiRuntimeCompositionSource = readFileSync(
    "rooms/laboratory/ui/runtime-composition.js",
    "utf8"
  );
  const sourceStageCompositionSource = readFileSync(
    "rooms/laboratory/ui/source-stage-composition.js",
    "utf8"
  );
  const editRuntimeSource = readFileSync("rooms/laboratory/ui/edit-runtime.js", "utf8");
  const subtitleAnalysisUiRuntimeSource = readFileSync(
    "rooms/laboratory/main-functions/subtitle-analysis/ui/runtime.js",
    "utf8"
  );
  const bootstrapRuntimeSource = readFileSync("rooms/laboratory/ui/bootstrap-runtime.js", "utf8");
  const bootstrapStateSource = readFileSync(
    "rooms/laboratory/ui/bootstrap-state-runtime.js",
    "utf8"
  );
  const sourceStageSource = readFileSync("rooms/laboratory/shared/ui/source-stage.js", "utf8");
  const settingsOverlaySource = readFileSync(
    "rooms/laboratory/shared/ui/settings-overlay.js",
    "utf8"
  );

  assert.match(
    uiSource,
    /const STAGE_ORDER = \["source", "edit", "profile", "process", "report"\];/
  );
  assert.match(uiSource, /shared\/ui\/action-router\.js/);
  assert.match(uiSource, /shared\/ui\/copy-runtime\.js/);
  assert.match(uiSource, /shared\/ui\/markup\.js/);
  assert.match(uiSource, /shared\/ui\/draft-runtime\.js/);
  assert.match(uiSource, /shared\/ui\/navigation-runtime\.js/);
  assert.match(uiSource, /shared\/ui\/request-runtime\.js/);
  assert.match(uiSource, /shared\/ui\/stage-shell-delegates\.js/);
  assert.match(uiSource, /shared\/ui\/shell-runtime\.js/);
  assert.match(uiSource, /shared\/ui\/shell-frame\.js/);
  assert.match(uiSource, /\.\/source-stage-composition\.js/);
  assert.match(shellFrameSource, /data-action="open-settings"/);
  assert.match(sourceStageSource, /data-action="project-create"/);
  assert.match(sourceStageSource, /data-select="project"/);
  assert.match(sourceStageSource, /data-action="source-kind"/);
  assert.match(sourceStageSource, /data-action="source-mode"/);
  assert.match(sourceStageSource, /data-action="source-pick-local"/);
  assert.match(sourceStageSource, /data-action="source-download-url"/);
  assert.match(sourceStageSource, /data-action="source-download-youtube"/);
  assert.match(stageShellDelegatesSource, /export function createLaboratoryStageShellDelegates\(deps\)/);
  assert.match(stageShellDelegatesSource, /function renderEditStage\(\)/);
  assert.match(stageShellDelegatesSource, /renderMediaAnalysisEditStage\(mediaAnalysisEditStageDeps\)/);
  assert.match(sourceStageCompositionSource, /export function createLaboratorySourceStageComposition\(deps\)/);
  assert.match(sourceStageCompositionSource, /return createLaboratorySourceStageUi\(/);
  assert.match(uiSource, /shared\/ui\/host-messages\.js/);
  assert.match(uiSource, /shared\/ui\/settings-overlay\.js/);
  assert.match(uiSource, /shared\/ui\/report-stage\.js/);
  assert.match(uiSource, /\.\/draft-access-runtime\.js/);
  assert.match(uiSource, /shared\/ui\/profile-process-report-accessors\.js/);
  assert.match(uiSource, /shared\/ui\/profile-process-report-composition\.js/);
  assert.match(uiSource, /\.\/profile-process-report-runtime\.js/);
  assert.match(uiSource, /\.\/snapshot-access-runtime\.js/);
  assert.match(uiSource, /\.\/edit-runtime\.js/);
  assert.match(uiSource, /main-functions\/subtitle-analysis\/ui\/runtime\.js/);
  assert.match(settingsOverlaySource, /data-action="tool-install"/);
  assert.match(settingsOverlaySource, /data-action="tool-update"/);
  assert.match(requestRuntimeSource, /roomApi\.sendEvent\("media-action"/);
  assert.match(hostMessageSource, /message\.type === "media-state" \|\| message\.type === "source-state"/);
  assert.match(uiSource, /main-functions\/media-analysis\/ui\/edit-panels\.js/);
  assert.match(mediaEditUiSource, /data-action="edit-mode"/);
  assert.match(mediaEditUiSource, /data-action="edit-preview"/);
  assert.match(mediaEditUiSource, /data-action="edit-apply"/);
  assert.match(mediaEditUiSource, /data-action="edit-cancel-preview"/);
  assert.match(mediaEditUiSource, /data-action="edit-cancel-apply"/);
  assert.match(mediaEditUiSource, /data-action="edit-select-output"/);
  assert.match(mediaEditUiSource, /data-action="edit-handoff"/);
  assert.match(mediaEditUiSource, /data-edit-field="/);
  assert.match(mediaEditUiSource, /data-edit-toggle="/);
  assert.match(editRuntimeSource, /createLaboratoryUiEditRuntime/);
  assert.match(editRuntimeSource, /function buildCurrentEditRecipePatch\(\)/);
  assert.match(editRuntimeSource, /function commitEditPatch\(patch, action\)/);
  assert.match(editRuntimeSource, /function restartProcess\(\)/);
  assert.match(uiSource, /main-functions\/media-analysis\/ui\/edit-stage\.js/);
  assert.match(mediaEditStageSource, /export function renderMediaAnalysisEditStage\(deps\)/);
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
  assert.match(mediaRuntimeSource, /createMediaAnalysisUiRuntimeHelpers/);
  assert.match(mediaRuntimeSource, /createMediaAnalysisSourceEditUiRuntime/);
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
    /export function createLaboratoryProfileProcessReportRuntime\(deps\)/
  );
  assert.match(
    profileProcessReportCompositionSource,
    /export \{ createLaboratoryProfileProcessReportComposition \} from "\.\.\/shared\/ui\/profile-process-report-composition\.js";/
  );
  assert.match(profileProcessReportRuntimeSource, /function renderProfileSummaryPanel\(\)/);
  assert.match(profileProcessReportRuntimeSource, /function renderReportFinding\(signal\)/);
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
  assert.match(mediaProfileTargetSource, /export function getMediaAnalysisProfileTargetAsset\(deps\)/);
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
  assert.match(settingsOverlaySource, /data-action="profile-model-install"/);
  assert.match(settingsOverlaySource, /data-action="profile-model-remove"/);
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
  assert.match(draftAccessRuntimeSource, /function syncLocalEditField\(path, value\)/);
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
  assert.match(shellRenderSource, /export function renderLaboratoryStageContent\(activeStage, renderers\)/);
  assert.match(shellRenderSource, /export function renderLaboratoryShell\(deps\)/);
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
  const hostSource = readFileSync("rooms/laboratory/host/runtime.js", "utf8");
  const activationSource = readFileSync("rooms/laboratory/shared/host/activation.js", "utf8");
  const bridgeSource = readFileSync("rooms/laboratory/shared/host/electron-bridge.js", "utf8");
  const ioRuntimeSource = readFileSync("rooms/laboratory/shared/host/io-runtime.js", "utf8");
  const actionRouterSource = readFileSync("rooms/laboratory/shared/host/action-router.js", "utf8");
  const runtimeBootstrapSource = readFileSync(
    "rooms/laboratory/shared/host/runtime-bootstrap.js",
    "utf8"
  );
  const roomSnapshotSource = readFileSync("rooms/laboratory/shared/host/room-snapshot.js", "utf8");
  const snapshotCompositionSource = readFileSync(
    "rooms/laboratory/shared/host/snapshot-composition.js",
    "utf8"
  );
  const processTargetingSource = readFileSync("rooms/laboratory/shared/host/process-targeting.js", "utf8");
  const processCompositionSource = readFileSync(
    "rooms/laboratory/shared/host/process-composition.js",
    "utf8"
  );
  const stateCompositionSource = readFileSync(
    "rooms/laboratory/shared/host/state-composition.js",
    "utf8"
  );
  const processReportStateSource = readFileSync(
    "rooms/laboratory/shared/host/process-report-state.js",
    "utf8"
  );
  const closeoutStalenessSource = readFileSync(
    "rooms/laboratory/shared/host/closeout-staleness.js",
    "utf8"
  );
  const hostUtilsSource = readFileSync("rooms/laboratory/shared/host/host-utils.js", "utf8");
  const projectStateDelegatesSource = readFileSync(
    "rooms/laboratory/shared/host/project-state-delegates.js",
    "utf8"
  );
  const projectManifestSource = readFileSync(
    "rooms/laboratory/shared/host/project-manifests.js",
    "utf8"
  );
  const runtimeEventsSource = readFileSync("rooms/laboratory/shared/host/runtime-events.js", "utf8");
  const runtimeStorageSource = readFileSync("rooms/laboratory/shared/host/runtime-storage.js", "utf8");
  const roomToolsProgressSource = readFileSync("rooms/laboratory/shared/host/room-tools-progress.js", "utf8");
  const sourceCompositionSource = readFileSync(
    "rooms/laboratory/shared/host/source-composition.js",
    "utf8"
  );
  const audioProcessDelegatesSource = readFileSync(
    "rooms/laboratory/shared/host/audio-process-delegates.js",
    "utf8"
  );
  const processOrchestrationSource = readFileSync(
    "rooms/laboratory/shared/host/process-orchestration.js",
    "utf8"
  );
  const actionCompositionSource = readFileSync(
    "rooms/laboratory/shared/host/action-composition.js",
    "utf8"
  );
  const actionRuntimeSource = readFileSync("rooms/laboratory/shared/host/action-runtime.js", "utf8");
  const audioRuntimeSource = readFileSync(
    "rooms/laboratory/main-functions/audio-analysis/host/runtime.js",
    "utf8"
  );
  const sourceDelegatesSource = readFileSync("rooms/laboratory/shared/host/source-delegates.js", "utf8");
  const projectRecordsSource = readFileSync("rooms/laboratory/shared/host/project-records.js", "utf8");
  const subtitleProjectionSource = readFileSync("rooms/laboratory/shared/host/subtitle-projection.js", "utf8");
  const profileModelSource = readFileSync(
    "rooms/laboratory/main-functions/media-analysis/host/profile-models.js",
    "utf8"
  );
  const mediaAnalysisRuntimeSource = readFileSync(
    "rooms/laboratory/main-functions/media-analysis/host/runtime.js",
    "utf8"
  );
  const mediaProfileStateSource = readFileSync(
    "rooms/laboratory/main-functions/media-analysis/host/profile-state.js",
    "utf8"
  );
  const editSupportSource = readFileSync(
    "rooms/laboratory/main-functions/media-analysis/host/edit-support.js",
    "utf8"
  );
  const sourceMetadataSource = readFileSync(
    "rooms/laboratory/main-functions/media-analysis/host/source-metadata.js",
    "utf8"
  );

  assert.match(hostSource, /from "\.\.\/shared\/host\/io-runtime\.js"/);
  assert.match(hostSource, /from "\.\.\/shared\/host\/snapshot-composition\.js"/);
  assert.match(hostSource, /from "\.\.\/shared\/host\/state-composition\.js"/);
  assert.match(hostSource, /from "\.\.\/shared\/host\/host-utils\.js"/);
  assert.match(hostSource, /from "\.\.\/shared\/host\/runtime-primitives\.js"/);
  assert.match(hostSource, /from "\.\.\/shared\/host\/process-composition\.js"/);
  assert.match(processCompositionSource, /from "\.\/process-targeting\.js"/);
  assert.match(processCompositionSource, /from "\.\/process-coordination\.js"/);
  assert.match(hostSource, /from "\.\.\/shared\/host\/activation\.js"/);
  assert.match(hostSource, /from "\.\.\/shared\/host\/runtime-storage\.js"/);
  assert.match(hostSource, /from "\.\.\/shared\/host\/project-state\.js"/);
  assert.match(hostSource, /from "\.\.\/shared\/host\/profile-model-state\.js"/);
  assert.match(hostSource, /from "\.\.\/shared\/host\/runtime-bootstrap\.js"/);
  assert.match(hostSource, /from "\.\.\/shared\/host\/room-tools-progress\.js"/);
  assert.match(hostSource, /from "\.\.\/shared\/host\/action-composition\.js"/);
  assert.match(hostSource, /from "\.\.\/shared\/host\/source-composition\.js"/);
  assert.match(snapshotCompositionSource, /from "\.\/project-manifests\.js"/);
  assert.match(snapshotCompositionSource, /from "\.\/room-snapshot\.js"/);
  assert.match(snapshotCompositionSource, /from "\.\/runtime-events\.js"/);
  assert.match(
    snapshotCompositionSource,
    /export function createLaboratorySnapshotCompositionRuntime\(deps\)/
  );
  assert.match(hostSource, /from "\.\.\/main-functions\/media-analysis\/host\/runtime\.js"/);
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
  assert.match(closeoutStalenessSource, /export function createLaboratoryCloseoutStalenessRuntime\(deps\)/);
  assert.match(closeoutStalenessSource, /function markCloseoutAsStale\(project, reason, targetFeatureIds\)/);
  assert.match(hostUtilsSource, /export function createLaboratoryHostUtils\(deps\)/);
  assert.match(hostUtilsSource, /function getPreferredFeatureSourceKind\(featureId, sourcePresets\)/);
  assert.match(audioProcessDelegatesSource, /export function createLaboratoryAudioProcessDelegatesRuntime/);
  assert.match(audioProcessDelegatesSource, /function getAudioAnalysisModuleProcessDir\(runtime, project, moduleId\)/);
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
  assert.match(actionRuntimeSource, /export function createLaboratoryHostActionRuntime\(deps\)/);
  assert.match(actionRuntimeSource, /function getActionRouter\(\)/);
  assert.match(actionRuntimeSource, /function handleToolMutation\(api, runtime, requestId, action, toolId, featureStage\)/);
  assert.match(actionRuntimeSource, /function handleMediaAction\(api, runtime, payload\)/);
  assert.match(actionRuntimeSource, /from "\.\/action-router\.js"/);
  assert.match(actionRouterSource, /export function createLaboratoryActionRouter\(deps\)/);
  assert.match(audioRuntimeSource, /export function createLaboratoryAudioAnalysisHostRuntime\(deps\)/);
  assert.match(audioRuntimeSource, /createAudioAnalysisStateRuntime\(/);
  assert.match(audioRuntimeSource, /createAudioAnalysisProjectionRuntime\(/);
  assert.match(audioRuntimeSource, /createAudioAnalysisProcessRuntime\(/);
  assert.match(audioRuntimeSource, /createLaboratoryAudioProcessDelegatesRuntime\(/);
  assert.match(sourceDelegatesSource, /export function createLaboratorySourceDelegatesRuntime\(deps\)/);
  assert.match(sourceDelegatesSource, /function handleLocalPick\(api, runtime, requestId\)/);
  assert.match(sourceDelegatesSource, /function getResolvedYoutubeSettings\(project, sourcePresets\)/);
  assert.match(sourceDelegatesSource, /async function handleYoutubeDownload\(api, runtime, requestId\)/);
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
    readFileSync("rooms/laboratory/shared/host/process-coordination.js", "utf8"),
    /export function createLaboratoryProcessCoordinationRuntime\(deps\)/
  );
  assert.match(
    readFileSync("rooms/laboratory/shared/host/project-state.js", "utf8"),
    /export function createLaboratoryProjectStateRuntime\(deps\)/
  );
  assert.match(
    projectStateDelegatesSource,
    /export function createLaboratoryProjectStateDelegatesRuntime\(deps\)/
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
  assert.match(runtimeStorageSource, /function getProfileModelDescriptorMap\(runtime\)/);
  assert.match(runtimeStorageSource, /async function refreshProfileModelState\(runtime\)/);
  assert.match(projectRecordsSource, /export function createLaboratoryProjectRecordsRuntime\(deps\)/);
  assert.match(projectRecordsSource, /function createProjectRecord\(/);
  assert.match(subtitleProjectionSource, /export function createLaboratorySubtitleProjectionRuntime\(deps\)/);
  assert.match(subtitleProjectionSource, /function syncProjectSubtitleAnalysisProjection\(runtime, project\)/);
  assert.match(activationSource, /export function createLaboratoryHostActivation\(deps\)/);
  assert.match(activationSource, /onRoomReady: function onRoomReady\(payload\)/);
  assert.match(activationSource, /onRoomEvent: function onRoomEvent\(payload\)/);
  assert.match(processTargetingSource, /function buildMediaProcessModules\(runtime, project, target\)/);
  assert.match(roomToolsProgressSource, /function ensureRoomToolsSubscription\(api, runtime\)/);
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
  assert.match(hostSource, /collectStoredSourceMetadata/);
  assert.match(hostSource, /collectDerivedOutputMetadata/);
  assert.match(hostSource, /shared\/host\/project-lifecycle\.js/);
  assert.match(hostSource, /shared\/host\/project-paths\.js/);
  assert.match(hostSource, /shared\/host\/action-composition\.js/);
  assert.match(hostSource, /shared\/host\/snapshot-composition\.js/);
  assert.doesNotMatch(hostSource, /main-functions\/media-analysis\/host\/edit-support\.js/);
  assert.doesNotMatch(hostSource, /main-functions\/media-analysis\/host\/edit-pipeline\.js/);
  assert.match(hostSource, /main-functions\/media-analysis\/host\/profile-models\.js/);
  assert.match(hostSource, /main-functions\/media-analysis\/host\/profile-projection\.js/);
  assert.doesNotMatch(hostSource, /main-functions\/media-analysis\/host\/profile-preflight\.js/);
  assert.match(hostSource, /main-functions\/media-analysis\/host\/profile-state\.js/);
  assert.doesNotMatch(hostSource, /function resetProfileForCurrentSource\(runtime, nextProject, reason\)/);
  assert.doesNotMatch(hostSource, /function markProfileAsStale\(nextProject, reason, options\)/);
  assert.match(sourceCompositionSource, /main-functions\/media-analysis\/host\/source-metadata\.js/);
  assert.match(sourceCompositionSource, /main-functions\/media-analysis\/host\/source-intake\.js/);
  assert.match(sourceCompositionSource, /\.\/source-delegates\.js/);
  assert.match(
    sourceCompositionSource,
    /const laboratorySourceDelegatesRuntime = createLaboratorySourceDelegatesRuntime\(/
  );
  assert.match(sourceMetadataSource, /function parseFfprobeMetadata\(stdout, kind, mimeType\)/);
  assert.match(sourceMetadataSource, /async function collectDerivedOutputMetadata\(runtime, project, options\)/);
  assert.match(hostSource, /buildEditManifest/);
  assert.match(hostSource, /shared\/host\/action-composition\.js/);
  assert.doesNotMatch(hostSource, /const laboratoryActionRouter = createLaboratoryActionRouter\(/);
  assert.match(editSupportSource, /function buildEditCommand\(runtime, project, outputPath, mode\)/);
  assert.match(editSupportSource, /function findEditPreset\(runtime, project, presetId\)/);
  assert.match(hostSource, /runEditPipeline/);
  assert.match(hostSource, /buildProfileManifest/);
  assert.match(hostSource, /runProfilePreflight/);
  assert.match(hostSource, /normalizeProfileArtifactPreferences/);
  assert.match(profileModelSource, /function evaluateProfileModelCompatibility\(runtime, descriptor, whisperSummary\)/);
  assert.match(hostSource, /generateProfileFrameStrip/);
  assert.match(hostSource, /generateProfileSpectrogram/);
  assert.match(hostSource, /maybeRunWhisperProfileSample/);
  assert.match(hostSource, /syncProjectProfileProjection/);
  assert.match(roomSnapshotSource, /function buildProjectedProjects\(runtime\)/);
  assert.match(hostSource, /shared\/host\/io-runtime\.js/);
  assert.match(ioRuntimeSource, /async function ensureProjectDirectories\(runtime, project, requestId\)/);
  assert.match(bridgeSource, /operation: "ensure-dir"/);
  assert.match(bridgeSource, /Unsupported room-tools operation: ensure-dir/);
  assert.match(sourceMetadataSource, /executableName: executableName/);
  assert.doesNotMatch(hostSource, /api\.notifyRoom\("host-context", loadContext\(api\)\)/);
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
