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
