import test from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";

import { validateRoomManifest } from "../../src/types/rooms.ts";

const requiredFiles = [
  "rooms/laboratory/manifest.json",
  "rooms/laboratory/host/index.js",
  "rooms/laboratory/shared/host/project-lifecycle.js",
  "rooms/laboratory/shared/host/project-paths.js",
  "rooms/laboratory/shared/host/process-runtime.js",
  "rooms/laboratory/shared/host/process-targeting.js",
  "rooms/laboratory/shared/host/process-report-state.js",
  "rooms/laboratory/shared/host/runtime-bootstrap.js",
  "rooms/laboratory/shared/host/room-snapshot.js",
  "rooms/laboratory/shared/host/room-tools-progress.js",
  "rooms/laboratory/shared/host/reporting.js",
  "rooms/laboratory/shared/host/tool-mutations.js",
  "rooms/laboratory/shared/ui/action-router.js",
  "rooms/laboratory/shared/ui/markup.js",
  "rooms/laboratory/shared/ui/draft-runtime.js",
  "rooms/laboratory/shared/ui/host-messages.js",
  "rooms/laboratory/shared/ui/process-stage.js",
  "rooms/laboratory/shared/ui/report-stage.js",
  "rooms/laboratory/shared/ui/settings-overlay.js",
  "rooms/laboratory/shared/ui/source-stage.js",
  "rooms/laboratory/shared/ui/source-snapshot-selectors.js",
  "rooms/laboratory/ui/index.html",
  "rooms/laboratory/ui/index.js",
  "rooms/laboratory/ui/style.css",
  "rooms/laboratory/shared/styles/shell.css",
  "rooms/laboratory/main-functions/media-analysis/host/action-handlers.js",
  "rooms/laboratory/main-functions/media-analysis/host/edit-pipeline.js",
  "rooms/laboratory/main-functions/media-analysis/host/profile-models.js",
  "rooms/laboratory/main-functions/media-analysis/host/profile-projection.js",
  "rooms/laboratory/main-functions/media-analysis/host/profile-preflight.js",
  "rooms/laboratory/main-functions/media-analysis/host/profile-state.js",
  "rooms/laboratory/main-functions/media-analysis/host/source-metadata.js",
  "rooms/laboratory/main-functions/media-analysis/host/source-intake.js",
  "rooms/laboratory/main-functions/media-analysis/styles.css",
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
  "rooms/laboratory/main-functions/subtitle-analysis/host/state.js",
  "rooms/laboratory/main-functions/subtitle-analysis/ui/module.js",
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
  const uiSource = readFileSync("rooms/laboratory/ui/index.js", "utf8");
  const mediaProfileUiSource = readFileSync(
    "rooms/laboratory/main-functions/media-analysis/ui/profile-panels.js",
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
  const hostMessageSource = readFileSync("rooms/laboratory/shared/ui/host-messages.js", "utf8");
  const markupSource = readFileSync("rooms/laboratory/shared/ui/markup.js", "utf8");
  const draftRuntimeSource = readFileSync("rooms/laboratory/shared/ui/draft-runtime.js", "utf8");
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
  assert.match(uiSource, /shared\/ui\/markup\.js/);
  assert.match(uiSource, /shared\/ui\/draft-runtime\.js/);
  assert.match(uiSource, /shared\/ui\/source-stage\.js/);
  assert.match(uiSource, /data-action="open-settings"/);
  assert.match(sourceStageSource, /data-action="project-create"/);
  assert.match(sourceStageSource, /data-select="project"/);
  assert.match(sourceStageSource, /data-action="source-kind"/);
  assert.match(sourceStageSource, /data-action="source-mode"/);
  assert.match(sourceStageSource, /data-action="source-pick-local"/);
  assert.match(sourceStageSource, /data-action="source-download-url"/);
  assert.match(sourceStageSource, /data-action="source-download-youtube"/);
  assert.match(uiSource, /shared\/ui\/host-messages\.js/);
  assert.match(uiSource, /shared\/ui\/settings-overlay\.js/);
  assert.match(uiSource, /shared\/ui\/report-stage\.js/);
  assert.match(settingsOverlaySource, /data-action="tool-install"/);
  assert.match(settingsOverlaySource, /data-action="tool-update"/);
  assert.match(uiSource, /window\.roomAPI\.sendEvent\("media-action"/);
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
  assert.match(uiSource, /main-functions\/media-analysis\/ui\/profile-panels\.js/);
  assert.match(uiSource, /main-functions\/media-analysis\/ui\/profile-stage\.js/);
  assert.match(mediaProfileStageSource, /data-action="profile-mode"/);
  assert.match(mediaProfileUiSource, /data-action="profile-preset"/);
  assert.match(mediaProfileStageSource, /data-action="profile-target-mode"/);
  assert.match(mediaProfileUiSource, /data-profile-field="/);
  assert.match(mediaProfileUiSource, /data-profile-toggle="/);
  assert.match(mediaProfileUiSource, /data-profile-artifact-toggle=/);
  assert.match(mediaProfileUiSource, /data-profile-field="frameSampleDensity"/);
  assert.match(mediaProfileUiSource, /data-profile-field="transcriptSampleSeconds"/);
  assert.match(uiSource, /renderReportFinding/);
  assert.match(uiSource, /getTopProfileSignals/);
  assert.doesNotMatch(uiSource, /76 \/ 100/);
  assert.match(mediaProfileStageSource, /data-action="profile-run"/);
  assert.match(mediaProfileStageSource, /data-action="profile-cancel"/);
  assert.match(uiSource, /renderProfileModelCard/);
  assert.match(settingsOverlaySource, /createLaboratorySettingsUi/);
  assert.match(settingsOverlaySource, /data-action="profile-model-install"/);
  assert.match(settingsOverlaySource, /data-action="profile-model-remove"/);
  assert.match(uiSource, /collectProfileStageJobs/);
  assert.match(markupSource, /function renderSummaryRows\(rows\)/);
  assert.match(markupSource, /function renderTextField\(fieldId, value, label, placeholder, extra\)/);
  assert.match(sourceStageSource, /function renderSourceStage\(\)/);
  assert.match(sourceStageSource, /function renderSourceIntakePanel\(\)/);
  assert.match(draftRuntimeSource, /function collectEditStageJobs\(projectJobs\)/);
  assert.match(draftRuntimeSource, /function collectProfileStageJobs\(projectJobs\)/);
  assert.match(draftRuntimeSource, /function buildCurrentDraftPayload\(\)/);
  assert.match(draftRuntimeSource, /function syncLocalEditField\(path, value\)/);
  assert.match(uiSource, /getEffectiveMediaAsset/);
  assert.match(uiSource, /shouldIgnoreCorrelatedPayload/);
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
  assert.match(uiSource, /main-functions\/audio-analysis\/ui\/module\.js/);
  assert.match(uiSource, /main-functions\/subtitle-analysis\/ui\/module\.js/);
  assert.match(uiSource, /function getFeaturePreviewImage\(\)/);
  assert.match(uiSource, /scrollPositions:\s*\{\s*surface: 0,\s*overlay: 0,\s*\}/);
  assert.match(uiSource, /function captureScrollState\(root\)/);
  assert.match(uiSource, /function restoreScrollState\(root\)/);
  assert.match(uiSource, /captureScrollState\(root\);/);
  assert.match(uiSource, /restoreScrollState\(root\);/);
  assert.match(uiSource, /surface\.scrollTop = state\.ui\.surfaceScrollResetPending \? 0 : state\.ui\.scrollPositions\.surface;/);
  assert.match(uiSource, /overlayPanel\.scrollTop = state\.ui\.overlayScrollResetPending \? 0 : state\.ui\.scrollPositions\.overlay;/);
  assert.match(uiSource, /requestSurfaceScrollReset\(\);/);
  assert.match(uiSource, /requestOverlayScrollReset\(\);/);
});

test("laboratory host orchestrates projects, source intake, edit rendering, and profile preflight through room tools", () => {
  const hostSource = readFileSync("rooms/laboratory/host/index.js", "utf8");
  const bridgeSource = readFileSync("rooms/laboratory/shared/host/electron-bridge.js", "utf8");
  const actionRouterSource = readFileSync("rooms/laboratory/shared/host/action-router.js", "utf8");
  const runtimeBootstrapSource = readFileSync(
    "rooms/laboratory/shared/host/runtime-bootstrap.js",
    "utf8"
  );
  const roomSnapshotSource = readFileSync("rooms/laboratory/shared/host/room-snapshot.js", "utf8");
  const processTargetingSource = readFileSync("rooms/laboratory/shared/host/process-targeting.js", "utf8");
  const processReportStateSource = readFileSync(
    "rooms/laboratory/shared/host/process-report-state.js",
    "utf8"
  );
  const roomToolsProgressSource = readFileSync("rooms/laboratory/shared/host/room-tools-progress.js", "utf8");
  const profileModelSource = readFileSync(
    "rooms/laboratory/main-functions/media-analysis/host/profile-models.js",
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

  assert.match(hostSource, /from "\.\.\/shared\/host\/electron-bridge\.js"/);
  assert.match(hostSource, /from "\.\.\/shared\/host\/process-targeting\.js"/);
  assert.match(hostSource, /from "\.\.\/shared\/host\/process-report-state\.js"/);
  assert.match(hostSource, /from "\.\.\/shared\/host\/runtime-bootstrap\.js"/);
  assert.match(hostSource, /from "\.\.\/shared\/host\/room-tools-progress\.js"/);
  assert.match(bridgeSource, /electronApi\.roomToolsCall/);
  assert.match(runtimeBootstrapSource, /function createRuntimeState\(\)/);
  assert.match(runtimeBootstrapSource, /function sanitizeContext\(payload, api\)/);
  assert.match(processTargetingSource, /function resolveProcessTarget\(project, featureId\)/);
  assert.match(processReportStateSource, /function normalizeProcessState\(rawValue\)/);
  assert.match(processReportStateSource, /function normalizeReportState\(rawValue\)/);
  assert.match(processReportStateSource, /function setFeatureProcessRecord\(project, featureId, record\)/);
  assert.match(processReportStateSource, /function setFeatureReportRecord\(project, featureId, record\)/);
  assert.match(processTargetingSource, /function buildMediaProcessModules\(runtime, project, target\)/);
  assert.match(roomToolsProgressSource, /function ensureRoomToolsSubscription\(api, runtime\)/);
  assert.match(hostSource, /notifyRoom\(api, "media-state"/);
  assert.match(hostSource, /notifyRoom\(api, "media-action-result"/);
  assert.match(hostSource, /notifyRoom\(api, "media-job"/);
  assert.match(hostSource, /notifyRoom\(api, "source-state"/);
  assert.match(hostSource, /notifyRoom\(api, "source-action-result"/);
  assert.match(hostSource, /notifyRoom\(api, "source-job"/);
  assert.match(hostSource, /if \(payload\.type === "source-action" \|\| payload\.type === "media-action"\)/);
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
  assert.match(hostSource, /validateSourceCandidate/);
  assert.match(hostSource, /collectStoredSourceMetadata/);
  assert.match(hostSource, /collectDerivedOutputMetadata/);
  assert.match(hostSource, /shared\/host\/project-lifecycle\.js/);
  assert.match(hostSource, /shared\/host\/project-paths\.js/);
  assert.match(hostSource, /shared\/host\/action-router\.js/);
  assert.match(hostSource, /shared\/host\/room-snapshot\.js/);
  assert.match(hostSource, /shared\/host\/tool-mutations\.js/);
  assert.match(hostSource, /main-functions\/media-analysis\/host\/action-handlers\.js/);
  assert.match(hostSource, /main-functions\/media-analysis\/host\/edit-support\.js/);
  assert.match(hostSource, /main-functions\/media-analysis\/host\/edit-pipeline\.js/);
  assert.match(hostSource, /main-functions\/media-analysis\/host\/profile-models\.js/);
  assert.match(hostSource, /main-functions\/media-analysis\/host\/profile-projection\.js/);
  assert.match(hostSource, /main-functions\/media-analysis\/host\/profile-preflight\.js/);
  assert.match(hostSource, /main-functions\/media-analysis\/host\/profile-state\.js/);
  assert.match(hostSource, /main-functions\/media-analysis\/host\/source-metadata\.js/);
  assert.match(hostSource, /main-functions\/media-analysis\/host\/source-intake\.js/);
  assert.match(sourceMetadataSource, /function parseFfprobeMetadata\(stdout, kind, mimeType\)/);
  assert.match(sourceMetadataSource, /async function collectDerivedOutputMetadata\(runtime, project, options\)/);
  assert.match(hostSource, /buildEditManifest/);
  assert.match(hostSource, /const mediaEditSupportRuntime = createMediaEditSupportRuntime\(/);
  assert.match(hostSource, /const laboratoryActionRouter = createLaboratoryActionRouter\(/);
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
  assert.match(hostSource, /async function ensureProjectDirectories\(runtime, project, requestId\)/);
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
