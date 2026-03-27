import test from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";

const textParityFiles = [
  "shared/ui/action-router.js",
  "shared/ui/base-utils.js",
  "shared/ui/draft-runtime.js",
  "shared/ui/host-messages.js",
  "shared/ui/markup.js",
  "shared/ui/media-preview.js",
  "shared/ui/process-stage.js",
  "shared/ui/report-stage.js",
  "shared/ui/feature-runtime.js",
  "shared/ui/settings-overlay.js",
  "shared/ui/stage-shell-delegates.js",
  "shared/ui/source-stage.js",
  "shared/ui/source-snapshot-selectors.js",
  "shared/ui/shell-runtime.js",
  "shared/ui/profile-process-report-accessors.js",
  "shared/ui/profile-process-report-composition.js",
  "shared/host/action-composition.js",
  "shared/host/action-runtime.js",
  "shared/host/closeout-staleness.js",
  "shared/host/host-utils.js",
  "shared/host/runtime-primitives.js",
  "ui/bootstrap-runtime.js",
  "ui/draft-access-runtime.js",
  "ui/profile-process-report-accessors.js",
  "ui/profile-process-report-composition.js",
  "ui/edit-runtime.js",
  "ui/profile-process-report-runtime.js",
  "ui/source-stage-composition.js",
  "ui/snapshot-access-runtime.js",
  "ui/view-bindings-runtime.js",
  "ui/subtitle-panel-runtime.js",
  "ui/view-accessors-runtime.js",
  "ui/index.js",
  "ui/laboratory-ui-runtime.js",
  "main-functions/media-analysis/ui/edit-panels.js",
  "main-functions/media-analysis/ui/edit-stage.js",
  "main-functions/media-analysis/ui/profile-panels.js",
  "main-functions/media-analysis/ui/profile-stage.js",
  "main-functions/media-analysis/ui/profile-target.js",
  "main-functions/media-analysis/ui/runtime.js",
  "main-functions/media-analysis/ui/runtime-helpers.js",
  "main-functions/media-analysis/ui/source-edit-runtime.js",
  "main-functions/audio-analysis/ui/module.js",
  "main-functions/subtitle-analysis/ui/module.js",
  "main-functions/subtitle-analysis/ui/runtime.js",
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
