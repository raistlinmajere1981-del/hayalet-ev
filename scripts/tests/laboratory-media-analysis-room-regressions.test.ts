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
  "rooms/laboratory/assets/room-background.webp",
  "rooms/laboratory/assets/media-analysis-view.webp",
];

test("laboratory workspace keeps the required media-analysis package files", () => {
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

test("laboratory UI ships source-stage controls for settings, projects, and real intake modes", () => {
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
  assert.match(uiSource, /shouldIgnoreCorrelatedPayload/);
  assert.match(uiSource, /getPreferredSourceCodec/);
  assert.match(uiSource, /formatBitRate/);
});

test("laboratory host orchestrates projects, source validation, and metadata extraction through room tools", () => {
  const hostSource = readFileSync("rooms/laboratory/host/index.js", "utf8");

  assert.match(hostSource, /electronApi\.roomToolsCall/);
  assert.match(hostSource, /notifyRoom\(api, "source-state"/);
  assert.match(hostSource, /notifyRoom\(api, "source-action-result"/);
  assert.match(hostSource, /notifyRoom\(api, "source-job"/);
  assert.match(hostSource, /if \(payload\.type === "source-action"\)/);
  assert.match(hostSource, /case "project-create":/);
  assert.match(hostSource, /case "tool-install":/);
  assert.match(hostSource, /case "tool-update":/);
  assert.match(hostSource, /validateSourceCandidate/);
  assert.match(hostSource, /collectStoredSourceMetadata/);
  assert.match(hostSource, /parseFfprobeMetadata/);
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
