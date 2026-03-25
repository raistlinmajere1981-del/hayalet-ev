import test from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";

import { validateRoomManifest } from "../../src/types/rooms.ts";

const requiredFiles = [
  "rooms/laboratory/manifest.json",
  "rooms/laboratory/host/index.js",
  "rooms/laboratory/ui/index.html",
  "rooms/laboratory/ui/index.js",
  "rooms/laboratory/ui/style.css",
  "rooms/laboratory/i18n/en.json",
  "rooms/laboratory/i18n/tr.json",
  "rooms/laboratory/tools/project-schema.json",
  "rooms/laboratory/tools/source-presets.json",
  "rooms/laboratory/tools/yt-dlp.form.json",
  "rooms/laboratory/tools/toolchain.manifest.json",
  "rooms/laboratory/tools/edit-presets.json",
  "rooms/laboratory/tools/edit-capabilities.json",
  "rooms/laboratory/tools/profile-presets.json",
  "rooms/laboratory/tools/profile-capabilities.json",
  "rooms/laboratory/tools/profile-models.json",
  "rooms/laboratory/tools/audio-analysis-catalog.json",
  "rooms/laboratory/tools/audio-analysis-capabilities.json",
  "rooms/laboratory/tools/audio-analysis-presets.json",
  "rooms/laboratory/tools/audio-analysis-providers.json",
  "rooms/laboratory/tools/subtitle-source-presets.json",
  "rooms/laboratory/tools/subtitle-youtube.form.json",
  "rooms/laboratory/tools/subtitle-edit-presets.json",
  "rooms/laboratory/tools/subtitle-analysis-catalog.json",
  "rooms/laboratory/tools/subtitle-analysis-capabilities.json",
  "rooms/laboratory/tools/subtitle-analysis-providers.json",
  "rooms/laboratory/assets/room-background.webp",
  "rooms/laboratory/assets/media-analysis-view.webp",
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
    "assets/media-analysis-view.webp"
  );
});

test("laboratory UI ships source, edit, and profile controls through the shared media envelope", () => {
  const uiSource = readFileSync("rooms/laboratory/ui/index.js", "utf8");

  assert.match(
    uiSource,
    /const STAGE_ORDER = \["source", "edit", "profile", "process", "report"\];/
  );
  assert.match(uiSource, /data-action="open-settings"/);
  assert.match(uiSource, /data-action="project-create"/);
  assert.match(uiSource, /data-select="project"/);
  assert.match(uiSource, /data-action="source-kind"/);
  assert.match(uiSource, /data-action="source-mode"/);
  assert.match(uiSource, /data-action="source-pick-local"/);
  assert.match(uiSource, /data-action="source-download-url"/);
  assert.match(uiSource, /data-action="source-download-youtube"/);
  assert.match(uiSource, /data-action="tool-install"/);
  assert.match(uiSource, /data-action="tool-update"/);
  assert.match(uiSource, /window\.roomAPI\.sendEvent\("media-action"/);
  assert.match(uiSource, /message\.type === "media-state" \|\| message\.type === "source-state"/);
  assert.match(uiSource, /data-action="edit-mode"/);
  assert.match(uiSource, /data-action="edit-preview"/);
  assert.match(uiSource, /data-action="edit-apply"/);
  assert.match(uiSource, /data-action="edit-cancel-preview"/);
  assert.match(uiSource, /data-action="edit-cancel-apply"/);
  assert.match(uiSource, /data-action="edit-select-output"/);
  assert.match(uiSource, /data-action="edit-handoff"/);
  assert.match(uiSource, /data-edit-field="/);
  assert.match(uiSource, /data-edit-toggle="/);
  assert.match(uiSource, /data-action="profile-mode"/);
  assert.match(uiSource, /data-action="profile-preset"/);
  assert.match(uiSource, /data-action="profile-target-mode"/);
  assert.match(uiSource, /data-profile-field="/);
  assert.match(uiSource, /data-profile-toggle="/);
  assert.match(uiSource, /data-profile-artifact-toggle=/);
  assert.match(uiSource, /data-profile-field="frameSampleDensity"/);
  assert.match(uiSource, /data-profile-field="transcriptSampleSeconds"/);
  assert.match(uiSource, /renderReportFinding/);
  assert.match(uiSource, /getTopProfileSignals/);
  assert.doesNotMatch(uiSource, /76 \/ 100/);
  assert.match(uiSource, /data-action="profile-run"/);
  assert.match(uiSource, /data-action="profile-cancel"/);
  assert.match(uiSource, /renderProfileModelCard/);
  assert.match(uiSource, /collectProfileStageJobs/);
  assert.match(uiSource, /getEffectiveMediaAsset/);
  assert.match(uiSource, /shouldIgnoreCorrelatedPayload/);
  assert.match(uiSource, /getPreferredSourceCodec/);
  assert.match(uiSource, /formatBitRate/);
});

test("laboratory host orchestrates projects, source intake, edit rendering, and profile preflight through room tools", () => {
  const hostSource = readFileSync("rooms/laboratory/host/index.js", "utf8");

  assert.match(hostSource, /electronApi\.roomToolsCall/);
  assert.match(hostSource, /notifyRoom\(api, "media-state"/);
  assert.match(hostSource, /notifyRoom\(api, "media-action-result"/);
  assert.match(hostSource, /notifyRoom\(api, "media-job"/);
  assert.match(hostSource, /notifyRoom\(api, "source-state"/);
  assert.match(hostSource, /notifyRoom\(api, "source-action-result"/);
  assert.match(hostSource, /notifyRoom\(api, "source-job"/);
  assert.match(hostSource, /if \(payload\.type === "source-action" \|\| payload\.type === "media-action"\)/);
  assert.match(hostSource, /case "project-create":/);
  assert.match(hostSource, /case "edit-set-mode":/);
  assert.match(hostSource, /case "edit-apply-preset":/);
  assert.match(hostSource, /case "edit-update-recipe":/);
  assert.match(hostSource, /case "edit-preview":/);
  assert.match(hostSource, /case "edit-apply":/);
  assert.match(hostSource, /case "edit-cancel-preview":/);
  assert.match(hostSource, /case "edit-cancel-apply":/);
  assert.match(hostSource, /case "profile-set-mode":/);
  assert.match(hostSource, /case "profile-apply-preset":/);
  assert.match(hostSource, /case "profile-update":/);
  assert.match(hostSource, /case "profile-set-target":/);
  assert.match(hostSource, /case "profile-set-model":/);
  assert.match(hostSource, /case "profile-run-preflight":/);
  assert.match(hostSource, /case "profile-cancel-preflight":/);
  assert.match(hostSource, /case "profile-model-install":/);
  assert.match(hostSource, /case "profile-model-remove":/);
  assert.match(hostSource, /case "tool-install":/);
  assert.match(hostSource, /case "tool-update":/);
  assert.match(hostSource, /validateSourceCandidate/);
  assert.match(hostSource, /collectStoredSourceMetadata/);
  assert.match(hostSource, /collectDerivedOutputMetadata/);
  assert.match(hostSource, /parseFfprobeMetadata/);
  assert.match(hostSource, /buildEditManifest/);
  assert.match(hostSource, /buildEditCommand/);
  assert.match(hostSource, /findEditPreset/);
  assert.match(hostSource, /runEditPipeline/);
  assert.match(hostSource, /buildProfileManifest/);
  assert.match(hostSource, /runProfilePreflight/);
  assert.match(hostSource, /normalizeProfileArtifactPreferences/);
  assert.match(hostSource, /evaluateProfileModelCompatibility/);
  assert.match(hostSource, /generateProfileFrameStrip/);
  assert.match(hostSource, /generateProfileSpectrogram/);
  assert.match(hostSource, /maybeRunWhisperProfileSample/);
  assert.match(hostSource, /syncProjectProfileProjection/);
  assert.match(hostSource, /buildProjectedProjects/);
  assert.match(hostSource, /async function ensureProjectDirectories\(runtime, project, requestId\)/);
  assert.match(hostSource, /operation: "ensure-dir"/);
  assert.match(hostSource, /Unsupported room-tools operation: ensure-dir/);
  assert.match(hostSource, /executableName: executableName/);
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
