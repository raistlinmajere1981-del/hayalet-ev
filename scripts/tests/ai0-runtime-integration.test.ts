import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";
import { ServerCommands } from "../../src/js/modules/server-commands.ts";
import { SettingsManager } from "../../src/js/modules/settings-manager.ts";
import type { Ai0RuntimeRequest } from "../../shared/ai0-runtime.ts";

void test("common image commands use the shared host IPC, preserve access controls and propagate unavailable generation", async () => {
  const previousWindow = globalThis.window;
  const previousSettings = SettingsManager.getSnapshot;
  const calls: Ai0RuntimeRequest[] = [];
  globalThis.window = {
    electronAPI: {
      ai0RuntimeRequest: async (request: Ai0RuntimeRequest) => {
        calls.push(request);
        return request.action === "image-status"
          ? { success: true, data: { available: false, reason: "image_generate is unavailable" } }
          : { success: false, error: "image_generate is unavailable" };
      },
    },
  } as unknown as Window & typeof globalThis;
  try {
    assert.ok(ServerCommands.listByCategory("ai0").includes("AI0ImageGenerate"));
    const status = (await ServerCommands.run("AI0ImageStatus", { provider: "ai0" })) as {
      success: boolean;
      data: { available: boolean };
    };
    assert.equal(status.success, true);
    assert.equal(status.data.available, false);
    const result = (await ServerCommands.run("AI0ImageGenerate", {
      provider: "ai0",
      args: '"a blue ghost", "3:2"',
    })) as { success: boolean; message: string };
    assert.equal(result.success, false);
    assert.match(result.message, /unavailable/);
    assert.deepEqual(calls[1], {
      action: "image-generate",
      prompt: "a blue ghost",
      aspectRatio: "3:2",
    });
    SettingsManager.getSnapshot = () =>
      ({ assistantSlot: { disabledCommands: ["AI0ImageGenerate"] } }) as ReturnType<
        typeof previousSettings
      >;
    const disabled = (await ServerCommands.run("AI0ImageGenerate", {
      provider: "ai0",
      args: '"draw"',
    })) as { success: boolean };
    assert.equal(disabled.success, false);
    assert.equal(calls.length, 2);
  } finally {
    globalThis.window = previousWindow;
    SettingsManager.getSnapshot = previousSettings;
  }
});

void test("Fate Knots and the assistant route through the common owner without invoking special workers or falling back to them", async () => {
  const [ipc, adapter, main, overlay] = await Promise.all([
    readFile(new URL("../../electron/handlers/ipc-room-tools.ts", import.meta.url), "utf8"),
    readFile(new URL("../../electron/ai0/fate-knots-adapter.ts", import.meta.url), "utf8"),
    readFile(new URL("../../electron/main.ts", import.meta.url), "utf8"),
    readFile(
      new URL("../../src/js/pages/assistant/ai0-runtime-overlay.ts", import.meta.url),
      "utf8"
    ),
  ]);
  assert.match(ipc, /callFateKnotsSharedAi0\(request\)/);
  assert.match(ipc, /generateFateKnotsSharedImage\(request\)/);
  assert.match(adapter, /ai0RuntimeHost\.generateImage/);
  assert.doesNotMatch(ipc, /fate-knots-ai0-image-worker-service|fate-knots-ai0-runtime-service/);
  assert.match(main, /ai0RuntimeHost\.startDevelopmentAssistant/);
  assert.match(main, /ai0RuntimeHost\.shutdown/);
  assert.match(overlay, /action: "image-generate"/);
  assert.match(overlay, /action: "image-open"/);
});
