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
  "ui/lab-root.js",
  "ui/lab-layout.js",
  "ui/lab-left-rail.js",
  "ui/lab-center-panel.js",
  "ui/lab-right-panel.js",
  "ui/lab-theme.css",
  "ui/components/artifact-item.js",
  "ui/components/compact-card.js",
  "ui/components/empty-state.js",
  "ui/components/event-feed.js",
  "ui/components/finding-card.js",
  "ui/components/module-row.js",
  "ui/components/primary-cta.js",
  "ui/components/stage-header.js",
  "ui/components/status-chip.js",
  "ui/stages/edit-stage.js",
  "ui/stages/process-stage.js",
  "ui/stages/profile-stage.js",
  "ui/stages/report-stage.js",
  "ui/stages/source-stage.js",
  "models/lab-report-types.js",
  "models/lab-types.js",
  "runtime/lab-event-bus.js",
  "runtime/lab-host-bridge.js",
  "runtime/lab-persistence.js",
  "runtime/lab-run-controller.js",
  "runtime/lab-selectors.js",
  "runtime/lab-store.js",
  "services/pipeline-runner.js",
  "services/preflight-service.js",
  "services/report-builder.js",
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

function assertTextParity(leftRoot: string, rightRoot: string, relativePath: string) {
  const leftPath = `${leftRoot}/${relativePath}`;
  const rightPath = `${rightRoot}/${relativePath}`;

  assert.equal(existsSync(leftPath), true, leftPath);
  assert.equal(existsSync(rightPath), true, rightPath);
  assert.equal(readFileSync(rightPath, "utf8"), readFileSync(leftPath, "utf8"), relativePath);
}

test("laboratory installed room mirrors the workspace package for live runtime files", async () => {
  const buildArtifact = await createRoomBuiltArtifact("laboratory");
  const installedCopy = await createRoomInstalledCopy("laboratory");

  try {
    textParityFiles.forEach((relativePath) => {
      assertTextParity(buildArtifact.rootDir, installedCopy.rootDir, relativePath);
    });
  } finally {
    await buildArtifact.cleanup();
    await installedCopy.cleanup();
  }
});

test("laboratory shipped room keeps shell chrome parity with the current workspace build", async () => {
  const buildArtifact = await createRoomBuiltArtifact("laboratory");

  try {
    [
      "shared/ui/request-runtime.js",
      "shared/ui/shell-frame.js",
      "shared/ui/shell-render.js",
      "shared/ui/shell-runtime.js",
    ].forEach((relativePath) => {
      assertTextParity(buildArtifact.rootDir, "data/rooms/laboratory", relativePath);
    });
  } finally {
    await buildArtifact.cleanup();
  }
});
