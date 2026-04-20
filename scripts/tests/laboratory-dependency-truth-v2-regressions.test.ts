import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

test("laboratory subtitle and workbench readiness keeps dual readiness truth visible", () => {
  const subtitleProcessSource = readFileSync(
    "rooms/laboratory/main-functions/subtitle-analysis/host/process-analysis.ts",
    "utf8"
  );
  const processStageSource = readFileSync("rooms/laboratory/ui/stages/process-stage.ts", "utf8");
  const runtimePrimitivesSource = readFileSync(
    "rooms/laboratory/shared/host/runtime-primitives.ts",
    "utf8"
  );

  assert.match(subtitleProcessSource, /buildSubtitleProviderState/);
  assert.match(subtitleProcessSource, /toolReady/);
  assert.match(subtitleProcessSource, /capabilityReady/);
  assert.match(processStageSource, /state\.featureId !== "media-analysis" && state\.featureId !== "subtitle-analysis"/);
  assert.match(runtimePrimitivesSource, /controlsCollapsed: source\["controlsCollapsed"\] !== false/);
});
