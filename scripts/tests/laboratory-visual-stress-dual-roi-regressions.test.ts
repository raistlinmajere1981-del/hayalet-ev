import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import { normalizeLaboratoryResponseBackgroundRoi } from "../../rooms/laboratory/shared/visual-response-probe-model.ts";

void test("visual stress dual ROI keeps explicit background geometry normalized", () => {
  assert.deepEqual(
    normalizeLaboratoryResponseBackgroundRoi({ x: 0.42, y: 0.18, width: 0.2, height: 0.3 }),
    { x: 0.42, y: 0.18, width: 0.2, height: 0.3 }
  );
  assert.equal(
    normalizeLaboratoryResponseBackgroundRoi({ x: 0.9, y: 0.2, width: 0.2, height: 0.3 }),
    null
  );
});

void test("selection binder exposes independent target/background roles without replacing target ROI", async () => {
  const binder = await readFile("rooms/laboratory/ui/lab-selection-roi-binder.ts", "utf8");
  assert.match(binder, /type VisualStressRoiRole = "target" \| "background"/);
  assert.match(binder, /data-lab-visual-stress-roi-role-control/);
  assert.match(binder, /data-lab-visual-stress-background-overlay/);
  assert.match(binder, /getComparisonRoi\?\.\("reference"\)/);
  assert.match(binder, /activeVisualStressRole.*"background" \? "reference" : null/s);
  assert.match(binder, /comparisonSide: resolveInteractionComparisonSide/);
});

void test("dual ROI background is carried explicitly from UI controller to host runtime", async () => {
  const controller = await readFile(
    "rooms/laboratory/runtime/controller/lab-transform-stack-live-controller.ts",
    "utf8"
  );
  const handlers = await readFile(
    "rooms/laboratory/features/media-analysis/host/action-handlers.ts",
    "utf8"
  );
  assert.match(controller, /data-lab-visual-stress-background-roi-json/);
  assert.match(controller, /normalizeLaboratoryResponseBackgroundRoi/);
  assert.match(controller, /backgroundRoi: state\.backgroundRoi/);
  assert.match(handlers, /normalizeLaboratoryResponseBackgroundRoi\(request\["backgroundRoi"\]\)/);
  assert.match(handlers, /resolveLatestResponseBackgroundRoi\(deps, runtime\)/);
  assert.match(handlers, /resolveResponseBackgroundRoi\(deps, runtime, request\)/);
});

void test("dual ROI styles distinguish target and background and are loaded by Laboratory theme", async () => {
  const styles = await readFile(
    "rooms/laboratory/ui/styles/lab-visual-stress-dual-roi.css",
    "utf8"
  );
  const theme = await readFile("rooms/laboratory/ui/lab-theme.css", "utf8");
  assert.match(styles, /labx-selection-roi--visual-target/);
  assert.match(styles, /labx-selection-roi--visual-background/);
  assert.match(styles, /border-style: dashed/);
  assert.match(theme, /lab-visual-stress-dual-roi\.css/);
});
