import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

test("rooms scene page registers nav, template, controller, and scene background wiring", () => {
  const appShellSource = readFileSync("src/index.html", "utf8");
  const pageInitSource = readFileSync("src/js/app/page-init.ts", "utf8");
  const pageSource = readFileSync("src/pages/rooms.html", "utf8");
  const controllerSource = readFileSync("src/js/pages/rooms.ts", "utf8");
  const sceneShellSource = readFileSync(
    "src/styles/design-system/components/scene-shell.css",
    "utf8"
  );

  assert.match(appShellSource, /data-page="rooms"/);
  assert.match(appShellSource, /data-shell-i18n-text="sideNav\.roomsLabel"/);
  assert.match(appShellSource, /href="\/styles\/rooms\.css"/);
  assert.match(pageInitSource, /RoomsController/);
  assert.match(pageInitSource, /roomsTemplate/);
  assert.match(pageInitSource, /controllers\["rooms"\]\s*=\s*new RoomsController\(\)/);
  assert.match(pageSource, /id="page-rooms"/);
  assert.match(pageSource, /id="rooms-scene-root"/);
  assert.match(pageSource, /id="rooms-classic-shell"/);
  assert.match(controllerSource, /createSceneDebugStore\("rooms"\)/);
  assert.match(controllerSource, /getSceneRoomBackgroundSrc\("rooms"\)/);
  assert.match(controllerSource, /getActiveSceneDebugRoomId\(\).*\=\=\=\s*"rooms"/s);
  assert.match(sceneShellSource, /\[data-ui-mode="scene"\] \.top-bar/);
  assert.match(sceneShellSource, /\[data-ui-mode="scene"\] \.main-content/);
});
