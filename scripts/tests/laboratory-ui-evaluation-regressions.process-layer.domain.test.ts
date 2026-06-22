import test from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";

describe("process layer", () => {
  void test("laboratory process layer is single-source and old right panel is retired", () => {
    const surfaceSource = readFileSync("rooms/laboratory/ui/workspace-surface.ts", "utf8");
    const drawerSource = readFileSync("rooms/laboratory/ui/lab-drawer.ts", "utf8");
    const drawerResultExploreSource = readFileSync(
      "rooms/laboratory/ui/lab-drawer-result-explore.ts",
      "utf8"
    );
    const processStripSource = readFileSync("rooms/laboratory/ui/lab-process-strip.ts", "utf8");
    const themeSource = readLabThemeSource();

    assert.doesNotMatch(surfaceSource, /data-lab-global-process="true"/);
    assert.doesNotMatch(surfaceSource, /renderWorkspaceProcessPanel/);
    assert.equal(existsSync("rooms/laboratory/ui/workspace-process-panel.ts"), false);
    assert.match(drawerResultExploreSource, /getLaboratoryRightPanelContext/);
    assert.match(processStripSource, /getLaboratoryProcessSummary/);
    assert.doesNotMatch(drawerSource, /labx-process-panel/);
    assert.doesNotMatch(themeSource, /labx-process-panel|labx-intent-map|labx-output-trace/);
  });
});
