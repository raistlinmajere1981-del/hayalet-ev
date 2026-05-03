import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";

test("linux launch path restores windowed bounds via maximize instead of raw workArea bounds", () => {
  const source = readFileSync("electron/window-manager.ts", "utf8");

  assert.match(
    source,
    /const SHOULD_USE_LINUX_WINDOW_MANAGER_MAXIMIZE = process\.platform === "linux";/
  );
  assert.match(source, /function restoreWindowedBounds\(win: BrowserWindow\): void \{/);
  assert.match(
    source,
    /if \(SHOULD_USE_LINUX_WINDOW_MANAGER_MAXIMIZE\) \{\s*win\.setResizable\(true\);\s*win\.maximize\(\);/s
  );
  assert.match(source, /resizable: SHOULD_USE_LINUX_WINDOW_MANAGER_MAXIMIZE,/);
  assert.match(source, /maximizable: SHOULD_USE_LINUX_WINDOW_MANAGER_MAXIMIZE,/);
  assert.match(source, /win\.on\("maximize", \(\) => \{\s*win\.setResizable\(false\);/s);
  assert.match(
    source,
    /win\.once\("ready-to-show", \(\) => \{\s*if \(SHOULD_USE_LINUX_WINDOW_MANAGER_MAXIMIZE\) \{\s*restoreWindowedBounds\(win\);/s
  );
  assert.match(
    source,
    /if \(isFull\) \{\s*_mainWindow\.setFullScreen\(false\);\s*restoreWindowedBounds\(_mainWindow\);/s
  );
  assert.doesNotMatch(source, /primeLinuxLaunchGeometry/);
  assert.doesNotMatch(source, /SHOULD_PRIME_LINUX_LAUNCH_GEOMETRY/);
});
