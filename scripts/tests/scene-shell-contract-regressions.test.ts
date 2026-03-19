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
  assert.match(sceneShellCss, /\.scene-shell__view/);
});

test("scene pages expose standardized back zones", () => {
  const targets = [
    "src/pages/assistant.html",
    "src/pages/server.html",
    "src/pages/analyze.html",
    "src/index.html",
  ];

  targets.forEach((target) => {
    const source = read(target);
    assert.match(source, /data-scene-back-zone="left"/);
    assert.match(source, /data-scene-back-zone="right"/);
    assert.match(source, /scene-back-zone__copy/);
  });
});

test("scene controllers bind the shared back-zone helper", () => {
  const targets = [
    "src/js/pages/assistant/assistant.ts",
    "src/js/pages/server.ts",
    "src/js/pages/analyze.ts",
    "src/js/app/topbar-settings-overlay.ts",
  ];

  targets.forEach((target) => {
    const source = read(target);
    assert.match(source, /bindSceneBackZones/);
    assert.match(source, /syncSceneViewRuntime|scene-shell__view/);
  });
});
