import assert from "node:assert/strict";
import test from "node:test";
import {
  authorFateKnotsWorldForgeDraft,
  validateAuthoredFateKnotsDraft,
} from "../../rooms/game-room/main-functions/fate-knots/host/world-forge-authoring.ts";
import { buildFateKnotsWorldForgeRequest } from "../../rooms/game-room/main-functions/fate-knots/forge/world-forge.ts";
import { buildFateKnotsWorldForgeAuthoringPrompt } from "../../rooms/game-room/main-functions/fate-knots/forge/authoring-prompt.ts";

const request = buildFateKnotsWorldForgeRequest(
  "request-1",
  "world-1",
  "2026-11-24T00:00:00Z",
  "test"
);
function mock(ref: Record<string, string>, repairOk = true) {
  const state = new Map<string, unknown>();
  const calls: Record<string, unknown>[] = [];
  let messages = 0;
  const api = {
    log() {},
    getState: (key: string) => state.get(key),
    setState: (key: string, value: unknown) => state.set(key, value),
    async dispatchBridge(options: Record<string, unknown>) {
      calls.push(options);
      if (options["action"] === "session.open")
        return { success: true, session: { openHint: "chatgpt-new" } };
      messages++;
      if (messages === 2 && !repairOk) return { success: false, message: "quota" };
      return { success: true, session: ref, reply: { text: "{}" } };
    },
  };
  return { api, calls, state };
}
void test("authoring grammar explicitly distinguishes cue maps and arrays", () => {
  const prompt = buildFateKnotsWorldForgeAuthoringPrompt(request);
  assert.match(prompt, /music\.stateCueIds MUST be a JSON object/);
  assert.match(prompt, /"stateCueIds":\{\}/);
  assert.match(prompt, /card\.presentation MUST be a JSON array/);
});
void test("invalid draft receives only one repair turn in the same confirmed conversation", async () => {
  const f = mock({ conversationId: "session-1", openHint: "chatgpt-new" });
  let repairs = 0;
  const result = await authorFateKnotsWorldForgeDraft(f.api, request, {
    onRepair: () => repairs++,
  });
  assert.equal(result.ok, false);
  assert.equal(repairs, 1);
  assert.equal(f.calls.length, 3);
  assert.equal(f.calls[2]?.["toSlot"], "ai1");
  assert.deepEqual(f.calls[2]?.["sessionRef"], { conversationId: "session-1" });
  assert.match(String((f.calls[2]?.["payload"] as { text: string }).text), /validation errors/);
  assert.match(JSON.stringify(f.calls[2]?.["payload"]), /request-id-mismatch/);
});
void test("no repair is sent without a durable conversation reference", async () => {
  const f = mock({ openHint: "chatgpt-new" });
  assert.equal((await authorFateKnotsWorldForgeDraft(f.api, request)).ok, false);
  assert.equal(f.calls.length, 2);
});
void test("repair provider failure preserves validation diagnostics", async () => {
  const f = mock({ conversationId: "session-1" }, false);
  const result = await authorFateKnotsWorldForgeDraft(f.api, request);
  assert.equal(result.ok, false);
  if (!result.ok) {
    assert.match(result.message, /quota/);
    assert.deepEqual(
      result.issues,
      (validateAuthoredFateKnotsDraft(request, {}) as { issues: unknown }).issues
    );
  }
  assert.equal(f.calls.length, 3);
});
