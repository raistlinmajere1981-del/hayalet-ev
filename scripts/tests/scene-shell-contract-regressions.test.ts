import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const REPO_ROOT = path.resolve(import.meta.dirname, "../..");

function read(relativePath: string): string {
  return fs.readFileSync(path.join(REPO_ROOT, relativePath), "utf8");
}

test("scene shell css is wired into the design system", () => {
  const designSystemIndex = read("src/styles/design-system/index.css");
  const sceneShellCss = read("src/styles/design-system/components/scene-shell.css");

  assert.match(designSystemIndex, /@import "\.\/components\/scene-shell\.css";/);
  assert.match(sceneShellCss, /\.scene-back-zone/);
  assert.match(sceneShellCss, /\.scene-back-zone--single/);
  assert.match(sceneShellCss, /\.scene-shell__view/);
  assert.doesNotMatch(sceneShellCss, /\[data-scene-back-zone="left"\]/);
  assert.doesNotMatch(sceneShellCss, /\[data-scene-back-zone="right"\]/);
});

test("scene pages no longer ship static back-zone markup", () => {
  const targets = [
    "src/pages/assistant.html",
    "src/pages/server.html",
    "src/pages/analyze.html",
    "src/index.html",
    "src/pages/entrance.html",
  ];

  targets.forEach((target) => {
    const source = read(target);
    assert.doesNotMatch(source, /data-scene-back-zone=/);
    assert.doesNotMatch(source, /scene-back-zone__copy/);
  });
});

test("scene controllers render the shared generated back layer", () => {
  const targets = [
    "src/js/pages/assistant/assistant.ts",
    "src/js/pages/server.ts",
    "src/js/pages/analyze.ts",
    "src/js/pages/settings/controller.ts",
    "src/js/pages/entrance/scene/scene-controller.ts",
  ];

  targets.forEach((target) => {
    const source = read(target);
    assert.match(source, /renderSceneBackLayer/);
    assert.match(source, /getSceneBackNodeForView|syncSceneViewRuntime|scene-shell__view/);
    assert.doesNotMatch(source, /bindSceneBackZones/);
  });
});
