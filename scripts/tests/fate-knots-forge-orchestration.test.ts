import test from "node:test";
import assert from "node:assert/strict";

import { createFateKnotsForgeOrchestrator } from "../../rooms/game-room/main-functions/fate-knots/host/forge-orchestration.ts";
import { FATE_KNOTS_UNIVERSE_LIBRARY_STATE_KEY } from "../../rooms/game-room/main-functions/fate-knots/host/persistence.ts";

function createMemoryApi() {
  const values = new Map<string, unknown>();
  return {
    values,
    api: {
      getState(key: string) {
        return values.get(key);
      },
      setState(key: string, value: unknown) {
        values.set(key, value);
        return value;
      },
    },
  };
}

void test("World Forge lifecycle stays inert until a provider is explicitly available", () => {
  const memory = createMemoryApi();
  const forge = createFateKnotsForgeOrchestrator(memory.api);

  assert.deepEqual(forge.getHubSnapshot(), {
    available: false,
    stage: "idle",
    revision: 0,
    acceptedUniverseId: null,
    failureCode: null,
  });

  const rejected = forge.begin("forge-1");
  assert.equal(rejected.ok, false);
  if (!rejected.ok) assert.equal(rejected.error, "forge-unavailable");
  assert.equal(forge.getHubSnapshot().stage, "idle");

  const available = forge.setAvailable(true);
  assert.equal(available.available, true);
  assert.equal(available.revision, 1);
});

void test("World Forge requires generating then validating before candidate acceptance", () => {
  const memory = createMemoryApi();
  const forge = createFateKnotsForgeOrchestrator(memory.api);
  forge.setAvailable(true);

  const begun = forge.begin("forge-2");
  assert.equal(begun.ok, true);
  assert.equal(forge.getHubSnapshot().stage, "generating");

  const busy = forge.begin("forge-3");
  assert.equal(busy.ok, false);
  if (!busy.ok) assert.equal(busy.error, "forge-busy");

  const premature = forge.complete("forge-2", {});
  assert.equal(premature.ok, false);
  if (!premature.ok) assert.equal(premature.error, "invalid-stage");
  assert.equal(memory.values.has(FATE_KNOTS_UNIVERSE_LIBRARY_STATE_KEY), false);

  const wrongRequest = forge.markValidating("other-request");
  assert.equal(wrongRequest.ok, false);
  if (!wrongRequest.ok) assert.equal(wrongRequest.error, "request-mismatch");

  const validating = forge.markValidating("forge-2");
  assert.equal(validating.ok, true);
  assert.equal(forge.getHubSnapshot().stage, "validating");

  const completed = forge.complete("forge-2", {});
  assert.equal(completed.ok, false);
  if (!completed.ok) {
    assert.equal(completed.error, "candidate-rejected");
    assert.equal(completed.acceptance?.ok, false);
  }
  assert.deepEqual(forge.getHubSnapshot(), {
    available: true,
    stage: "failed",
    revision: 4,
    acceptedUniverseId: null,
    failureCode: "candidate-rejected",
  });
  assert.equal(memory.values.has(FATE_KNOTS_UNIVERSE_LIBRARY_STATE_KEY), false);
});

void test("World Forge provider failures expose only a normalized failure code", () => {
  const memory = createMemoryApi();
  const forge = createFateKnotsForgeOrchestrator(memory.api);
  forge.setAvailable(true);
  forge.begin("forge-4");

  const failed = forge.fail("forge-4", "Provider returned private prompt text: nope");
  assert.equal(failed.ok, true);
  assert.equal(forge.getHubSnapshot().stage, "failed");
  assert.equal(forge.getHubSnapshot().failureCode, "provider-failed");

  const reset = forge.reset();
  assert.equal(reset.stage, "idle");
  assert.equal(reset.failureCode, null);
  assert.equal(reset.acceptedUniverseId, null);
});
