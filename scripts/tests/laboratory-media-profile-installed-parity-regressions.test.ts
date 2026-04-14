import test from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { createRoomBuiltArtifact, createRoomInstalledCopy } from "./helpers/room-installed-copy.ts";

const textParityFiles = [
  "shared/ui/action-router.js",
  "shared/ui/action-router-actions.js",
  "shared/ui/action-router-events.js",
  "shared/ui/base-utils.js",
  "shared/ui/draft-runtime.js",
  "shared/ui/host-messages.js",
  "shared/ui/markup.js",
  "shared/ui/media-preview.js",
  "shared/ui/process-stage.js",
  "shared/ui/report-stage.js",
  "shared/ui/report-stage-support.js",
  "shared/ui/report-stage-subtitle.js",
  "shared/ui/feature-runtime.js",
  "shared/ui/request-runtime.js",
  "shared/ui/settings-profile-model.js",
  "shared/ui/settings-tool-card.js",
  "shared/ui/settings-overlay.js",
  "shared/ui/shell-frame.js",
  "shared/ui/shell-render.js",
  "shared/ui/stage-shell-delegates.js",
  "shared/ui/source-stage.js",
  "shared/ui/source-stage-intake.js",
  "shared/ui/source-stage-project.js",
  "shared/ui/source-snapshot-selectors.js",
  "shared/ui/source-snapshot-project-selectors.js",
  "shared/ui/source-snapshot-subtitle-selectors.js",
  "shared/ui/source-snapshot-audio-selectors.js",
  "shared/ui/source-snapshot-tool-selectors.js",
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
  "ui/core-bootstrap.js",
  "ui/core-public-api.js",
  "ui/core-runtime.js",
  "ui/feature-stage-bundles.js",
  "ui/feature-stage-panels.js",
  "ui/feature-stage-runtime.js",
  "ui/source-stage-composition.js",
  "ui/snapshot-access-runtime.js",
  "ui/view-bindings-runtime.js",
  "ui/subtitle-panel-runtime.js",
  "ui/view-accessors-runtime.js",
  "ui/index.js",
  "ui/laboratory-ui-runtime.js",
  "main-functions/media-analysis/ui/edit-panels.js",
  "main-functions/media-analysis/ui/edit-field-controls.js",
  "main-functions/media-analysis/ui/edit-stage.js",
  "main-functions/media-analysis/ui/edit-mode-panels.js",
  "main-functions/media-analysis/ui/edit-output-panels.js",
  "main-functions/media-analysis/ui/profile-panels.js",
  "main-functions/media-analysis/ui/profile-stage.js",
  "main-functions/media-analysis/ui/profile-target.js",
  "main-functions/media-analysis/ui/runtime.js",
  "main-functions/media-analysis/ui/runtime-helpers.js",
  "main-functions/media-analysis/ui/edit-workspace-panels.js",
  "main-functions/media-analysis/ui/source-edit-runtime.js",
  "main-functions/audio-analysis/ui/module.js",
  "main-functions/audio-analysis/ui/catalog-runtime.js",
  "main-functions/audio-analysis/ui/provider-runtime.js",
  "main-functions/audio-analysis/ui/result-runtime.js",
  "main-functions/subtitle-analysis/ui/module.js",
  "main-functions/subtitle-analysis/ui/source-panels.js",
  "main-functions/subtitle-analysis/ui/source-panel-primitives.js",
  "main-functions/subtitle-analysis/ui/source-panel-process.js",
  "main-functions/subtitle-analysis/ui/source-panel-intake.js",
  "main-functions/subtitle-analysis/ui/source-panel-workspace.js",
  "main-functions/subtitle-analysis/ui/edit-panels.js",
  "main-functions/subtitle-analysis/ui/runtime.js",
];

test("laboratory installed room mirrors the workspace package for profile-stage runtime files", async () => {
  const buildArtifact = await createRoomBuiltArtifact("laboratory");
  const installedCopy = await createRoomInstalledCopy("laboratory");

  try {
    textParityFiles.forEach((relativePath) => {
      const buildPath = `${buildArtifact.rootDir}/${relativePath}`;
      const installedPath = `${installedCopy.rootDir}/${relativePath}`;

      assert.equal(existsSync(buildPath), true, buildPath);
      assert.equal(existsSync(installedPath), true, installedPath);
      assert.equal(readFileSync(installedPath, "utf8"), readFileSync(buildPath, "utf8"), relativePath);
    });
  } finally {
    await buildArtifact.cleanup();
    await installedCopy.cleanup();
  }
});
