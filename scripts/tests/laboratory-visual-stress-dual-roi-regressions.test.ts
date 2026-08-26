import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import { normalizeLaboratoryResponseBackgroundRoi } from "../../rooms/laboratory/shared/visual-response-probe-model.ts";

void test("visual stress ROI normalization accepts explicit comparison geometry", () => {
  assert.deepEqual(
    normalizeLaboratoryResponseBackgroundRoi({ x: 0.42, y: 0.18, width: 0.2, height: 0.3 }),
    { x: 0.42, y: 0.18, width: 0.2, height: 0.3 }
  );
  assert.equal(
    normalizeLaboratoryResponseBackgroundRoi({ x: 0.9, y: 0.2, width: 0.2, height: 0.3 }),
    null
  );
});

void test("selection binder exposes independent target/control/background roles without replacing target ROI", async () => {
  const binder = await readFile("rooms/laboratory/ui/lab-selection-roi-binder.ts", "utf8");
  assert.match(binder, /type VisualStressRoiRole = "target" \| "control" \| "background"/);
  assert.match(binder, /data-lab-visual-stress-roi-role-control/);
  assert.match(binder, /Control ROI/);
  assert.match(binder, /data-lab-visual-stress-control-overlay/);
  assert.match(binder, /data-lab-visual-stress-background-overlay/);
  assert.match(binder, /getComparisonRoi\?\.\("primary"\)/);
  assert.match(binder, /getComparisonRoi\?\.\("reference"\)/);
  assert.match(binder, /role === "control".*"primary"/s);
  assert.match(binder, /role === "background".*"reference"/s);
  assert.match(binder, /role: VisualStressRoiRole \| null/);
  assert.match(binder, /emitVisualStressComparisonRoi/);
  assert.match(binder, /workspace-comparison-updated/);
  assert.match(binder, /emitRoiUpdate\(dragState\.role, dragState\.comparisonSide/);
});

void test("control and background ROI are carried explicitly from UI controller to host runtime", async () => {
  const controller = await readFile(
    "rooms/laboratory/runtime/controller/lab-transform-stack-live-controller.ts",
    "utf8"
  );
  const handlers = await readFile(
    "rooms/laboratory/features/media-analysis/host/action-handlers.ts",
    "utf8"
  );
  assert.match(controller, /data-lab-visual-stress-control-roi-json/);
  assert.match(controller, /data-lab-visual-stress-background-roi-json/);
  assert.match(controller, /controlRoi: state\.controlRoi/);
  assert.match(controller, /backgroundRoi: state\.backgroundRoi/);
  assert.match(handlers, /normalizeLaboratoryResponseBackgroundRoi\(request\["controlRoi"\]\)/);
  assert.match(handlers, /normalizeLaboratoryResponseBackgroundRoi\(request\["backgroundRoi"\]\)/);
  assert.match(handlers, /resolveLatestResponseBackgroundRoi\(deps, runtime\)/);
  assert.match(handlers, /resolveResponseBackgroundRoi\(deps, runtime, request\)/);
});

void test("visual stress styles distinguish target control and background and are loaded by Laboratory theme", async () => {
  const styles = await readFile(
    "rooms/laboratory/ui/styles/lab-visual-stress-dual-roi.css",
    "utf8"
  );
  const theme = await readFile("rooms/laboratory/ui/lab-theme.css", "utf8");
  assert.match(styles, /labx-selection-roi--visual-target/);
  assert.match(styles, /labx-selection-roi--visual-control/);
  assert.match(styles, /labx-selection-roi--visual-background/);
  assert.match(styles, /border-style: dotted/);
  assert.match(styles, /border-style: dashed/);
  assert.match(theme, /lab-visual-stress-dual-roi\.css/);
});
