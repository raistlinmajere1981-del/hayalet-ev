import test from "node:test";
import assert from "node:assert/strict";
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { createRoomBuiltArtifact, createRoomInstalledCopy } from "./helpers/room-installed-copy.ts";

const IGNORED_PATHS = new Set([".room-install-files.json", "package.json"]);

const activeShellFiles = [
  "host/index.js",
  "runtime/lab-store.js",
  "ui/bootstrap.js",
  "ui/index.html",
  "ui/index.js",
  "ui/lab-root.js",
  "ui/lab-theme.css",
  "ui/lab-waveform-timeline.js",
  "ui/style.css",
  "ui/tool-management-overlay.js",
  "ui/workspace-process-panel.js",
  "ui/workspace-surface.js",
  "ui/components/artifact-item.js",
  "ui/components/status-chip.js",
];

const removedLegacyFiles = [
  "shared/styles/shell.css",
  "shared/ui/shell-runtime.js",
  "shared/ui/request-runtime.js",
  "ui/laboratory-ui-runtime.js",
  "ui/core-runtime.js",
  "ui/bootstrap-runtime.js",
  "ui/stages/source-stage.js",
  "main-functions/media-analysis/ui/runtime.js",
  "main-functions/audio-analysis/ui/module.js",
  "main-functions/subtitle-analysis/ui/runtime.js",
  "services/pipeline-runner.js",
  "models/lab-report-types.js",
];

function collectRelativeFiles(rootDir: string, currentDir: string = rootDir): string[] {
  return readdirSync(currentDir, { withFileTypes: true })
    .flatMap((entry) => {
      const absolutePath = join(currentDir, entry.name);
      if (entry.isDirectory()) {
        return collectRelativeFiles(rootDir, absolutePath);
      }
      return [relative(rootDir, absolutePath).replace(/\\/g, "/")];
    })
    .filter((filePath) => IGNORED_PATHS.has(filePath) === false)
    .sort((left, right) => left.localeCompare(right));
}

function assertRoomParity(leftRoot: string, rightRoot: string) {
  const leftFiles = collectRelativeFiles(leftRoot);
  const rightFiles = collectRelativeFiles(rightRoot);

  assert.deepEqual(rightFiles, leftFiles);

  leftFiles.forEach((relativePath) => {
    assert.deepEqual(
      readFileSync(join(rightRoot, relativePath)),
      readFileSync(join(leftRoot, relativePath)),
      relativePath
    );
  });
}

test("laboratory installed room mirrors the workspace package for the active lab-root shell", async () => {
  const buildArtifact = await createRoomBuiltArtifact("laboratory");
  const installedCopy = await createRoomInstalledCopy("laboratory");

  try {
    activeShellFiles.forEach((relativePath) => {
      assert.equal(existsSync(join(buildArtifact.rootDir, relativePath)), true, relativePath);
      assert.equal(existsSync(join(installedCopy.rootDir, relativePath)), true, relativePath);
    });

    removedLegacyFiles.forEach((relativePath) => {
      assert.equal(existsSync(join(buildArtifact.rootDir, relativePath)), false, relativePath);
      assert.equal(existsSync(join(installedCopy.rootDir, relativePath)), false, relativePath);
    });

    const workspaceSurfaceSource = readFileSync(join(buildArtifact.rootDir, "ui/workspace-surface.js"), "utf8");
    const installedWorkspaceSurfaceSource = readFileSync(
      join(installedCopy.rootDir, "ui/workspace-surface.js"),
      "utf8"
    );
    const runtimeControllerSource = readFileSync(
      join(buildArtifact.rootDir, "runtime/lab-run-controller.js"),
      "utf8"
    );
    const installedRuntimeControllerSource = readFileSync(
      join(installedCopy.rootDir, "runtime/lab-run-controller.js"),
      "utf8"
    );

    assert.match(workspaceSurfaceSource, /workspace-open-dual-preview/);
    assert.match(workspaceSurfaceSource, /dual-preview-master/);
    assert.match(runtimeControllerSource, /workspace-dual-preview-toggled/);
    assert.match(installedWorkspaceSurfaceSource, /workspace-open-dual-preview/);
    assert.match(installedRuntimeControllerSource, /workspace-dual-preview-toggled/);

    assertRoomParity(buildArtifact.rootDir, installedCopy.rootDir);
  } finally {
    await buildArtifact.cleanup();
    await installedCopy.cleanup();
  }
});
