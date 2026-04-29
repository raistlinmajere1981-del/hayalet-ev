import test from "node:test";
import assert from "node:assert/strict";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join, relative } from "node:path";
import { createRoomBuiltArtifact } from "./helpers/room-installed-copy.ts";

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
  "ui/workspace-surface.js",
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
  "services/pipeline-runner.js",
  "models/lab-report-types.js",
  "ui/workspace-process-panel.js",
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

function resolveLaboratoryShippedParityRoot() {
  const generatedRuntimeRoot = "rooms/.build/laboratory/runtime";
  const workspaceSourceRoot = "rooms/laboratory";

  if (existsSync(join(generatedRuntimeRoot, "manifest.json"))) {
    return generatedRuntimeRoot;
  }

  return workspaceSourceRoot;
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

test("laboratory shipped room keeps parity with the active lab-root shell build output", async () => {
  const buildArtifact = await createRoomBuiltArtifact("laboratory");
  const shippedParityRoot = resolveLaboratoryShippedParityRoot();

  try {
    activeShellFiles.forEach((relativePath) => {
      assert.equal(existsSync(join(buildArtifact.rootDir, relativePath)), true, relativePath);
      assert.equal(existsSync(join(shippedParityRoot, relativePath)), true, relativePath);
    });

    removedLegacyFiles.forEach((relativePath) => {
      assert.equal(existsSync(join(buildArtifact.rootDir, relativePath)), false, relativePath);
      assert.equal(existsSync(join(shippedParityRoot, relativePath)), false, relativePath);
    });

    const workspaceSurfaceSource = readFileSync(
      join(buildArtifact.rootDir, "ui/workspace-surface.js"),
      "utf8"
    );
    const shippedWorkspaceSurfaceSource = readFileSync(
      join(shippedParityRoot, "ui/workspace-surface.js"),
      "utf8"
    );
    const runtimeControllerSource = readFileSync(
      join(buildArtifact.rootDir, "runtime/lab-run-controller.js"),
      "utf8"
    );
    const shippedRuntimeControllerSource = readFileSync(
      join(shippedParityRoot, "runtime/lab-run-controller.js"),
      "utf8"
    );

    assert.match(workspaceSurfaceSource, /workspace-open-dual-preview/);
    assert.match(workspaceSurfaceSource, /dual-preview-master/);
    assert.match(runtimeControllerSource, /workspace-dual-preview-toggled/);
    assert.match(
      runtimeControllerSource,
      /Dual preview seek is unavailable until media is ready\./
    );
    assert.match(shippedWorkspaceSurfaceSource, /workspace-open-dual-preview/);
    assert.match(shippedRuntimeControllerSource, /workspace-dual-preview-toggled/);

    assertRoomParity(buildArtifact.rootDir, shippedParityRoot);
  } finally {
    await buildArtifact.cleanup();
  }
});
