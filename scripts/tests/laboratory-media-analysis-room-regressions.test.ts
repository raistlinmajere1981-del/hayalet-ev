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

test("laboratory UI ships stage rail controls and the dummy download panel", () => {
  const uiSource = readFileSync("rooms/laboratory/ui/index.js", "utf8");

  assert.match(
    uiSource,
    /const STAGE_ORDER = \["source", "edit", "profile", "process", "report"\];/
  );
  assert.match(uiSource, /data-stage-nav="previous"/);
  assert.match(uiSource, /data-stage-nav="next"/);
  assert.match(uiSource, /data-action="start-download"/);
  assert.match(uiSource, /data-download-preset=/);
});

test("laboratory host echoes generic room context without room-specific core hooks", () => {
  const hostSource = readFileSync("rooms/laboratory/host/index.js", "utf8");

  assert.match(hostSource, /api\.notifyRoom\("host-context", loadContext\(api\)\)/);
  assert.match(hostSource, /if \(payload\.type === "host-context"\)/);
  assert.doesNotMatch(hostSource, /ipc/i);
});
