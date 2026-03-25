import test from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";

const textParityFiles = [
  "manifest.json",
  "host/index.js",
  "ui/index.html",
  "ui/index.js",
  "ui/style.css",
  "i18n/en.json",
  "i18n/tr.json",
  "tools/project-schema.json",
  "tools/source-presets.json",
  "tools/toolchain.manifest.json",
  "tools/edit-presets.json",
  "tools/edit-capabilities.json",
  "tools/audio-analysis-catalog.json",
  "tools/audio-analysis-capabilities.json",
  "tools/audio-analysis-presets.json",
  "tools/audio-analysis-providers.json",
  "tools/subtitle-source-presets.json",
  "tools/subtitle-youtube.form.json",
  "tools/subtitle-edit-presets.json",
  "tools/subtitle-analysis-catalog.json",
  "tools/subtitle-analysis-capabilities.json",
  "tools/subtitle-analysis-providers.json",
  "tools/yt-dlp.form.json",
];

test("laboratory installed room mirrors the workspace package for live runtime files", () => {
  textParityFiles.forEach((relativePath) => {
    const workspacePath = `rooms/laboratory/${relativePath}`;
    const installedPath = `data/rooms/laboratory/${relativePath}`;

    assert.equal(existsSync(workspacePath), true, workspacePath);
    assert.equal(existsSync(installedPath), true, installedPath);
    assert.equal(readFileSync(installedPath, "utf8"), readFileSync(workspacePath, "utf8"), relativePath);
  });
});
