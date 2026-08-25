import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

void test("Laboratory controller sends destruction controls through the existing media-action protocol", async () => {
  const source = await readFile(
    "rooms/laboratory/runtime/controller/lab-transform-stack-live-controller.ts",
    "utf8"
  );
  assert.match(source, /workspace-control-injection-run/);
  assert.match(source, /edit-control-injection/);
  assert.match(source, /temporalRequest: state\.temporalRequest/);
  assert.match(source, /isLaboratoryControlInjectionKind/);
});

void test("Laboratory host router dispatches destruction controls to the edit action runtime", async () => {
  const router = await readFile("rooms/laboratory/shared/host/action-router.ts", "utf8");
  const editActions = await readFile(
    "rooms/laboratory/features/media-analysis/host/action-handlers-edit.ts",
    "utf8"
  );
  assert.match(router, /case "edit-control-injection"/);
  assert.match(router, /runControlInjection\(runtime, requestId, actionPayload\)/);
  assert.match(editActions, /createLaboratoryControlInjectionRuntime/);
  assert.match(editActions, /runControlInjection/);
});
