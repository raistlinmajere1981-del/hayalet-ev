import assert from "node:assert/strict";
import test from "node:test";

import { RelayManager } from "../../src/js/modules/relay-manager.ts";
import { SettingsManager } from "../../src/js/modules/settings-manager.ts";
type SlotBridgePayload = Record<string, unknown>;
const slotBridgeCalls: SlotBridgePayload[] = [];
let slotBridgeImpl = async (_payload: SlotBridgePayload) => ({ success: true });

const { serverCommands } = await import("../../src/js/modules/server-commands.ts");
const { aiChatRuntime, assistantAISendHandler, aiAssistantSendHandler } = await import(
  "../../src/js/modules/commands/ai-chat-commands.ts"
);

function resetSlotBridgeMock(): void {
  slotBridgeCalls.length = 0;
  slotBridgeImpl = async () => ({ success: true });
}

test.beforeEach(() => {
  resetSlotBridgeMock();
  aiChatRuntime.slotBridge = async (payload: SlotBridgePayload = {}) => {
    slotBridgeCalls.push(payload);
    return await slotBridgeImpl(payload);
  };
});

test("AssistantAISend sends cleaned text to explicit target and stops relay", async () => {
  const originalIsAIAssistantActive = RelayManager.isAIAssistantActive;
  const originalStopAIAssistantSession = RelayManager.stopAIAssistantSession;

  let stopped = false;

  try {
    RelayManager.isAIAssistantActive = () => true;
    RelayManager.stopAIAssistantSession = async () => {
      stopped = true;
    };

    const result = await assistantAISendHandler({
      provider: "ai0",
      args: "ai2",
      text: "++cmd:AssistantAISend(ai2) Merhaba AI2",
      source: "ai0",
    });

    const bridgeCall = slotBridgeCalls[0] ?? {};
    assert.equal(result.success, true);
    assert.equal(bridgeCall["toSlot"], "ai2");
    assert.equal(bridgeCall["fromSlot"], "ai0");
    assert.equal(bridgeCall["force"], false);
    assert.equal(
      (bridgeCall["payload"] as { text?: string } | undefined)?.text,
      "Merhaba AI2\n<!-- hev-sender:Asistan -->"
    );
    assert.equal(stopped, true);
  } finally {
    RelayManager.isAIAssistantActive = originalIsAIAssistantActive;
    RelayManager.stopAIAssistantSession = originalStopAIAssistantSession;
  }
});

test("AssistantAISend fails when target cannot be resolved", async () => {
  const originalGetSnapshot = SettingsManager.getSnapshot;

  try {
    SettingsManager.getSnapshot = () => ({
      assistants: { lastActiveRelay: null },
    }) as never;

    const result = await assistantAISendHandler({
      provider: "ai0",
      args: "",
      text: "++cmd:AssistantAISend() Merhaba",
      source: "ai0",
    });

    assert.equal(result.success, false);
    assert.match(String(result.message), /Hedef secilemedi/i);
    assert.equal(slotBridgeCalls.length, 0);
  } finally {
    SettingsManager.getSnapshot = originalGetSnapshot;
  }
});

test("AIAssistantSend routes to ai0 with generic force policy instead of direct connect logic", async () => {
  const result = await aiAssistantSendHandler({
    provider: "ai1",
    args: "ai1",
    text: "++cmd:AIAssistantSend(ai1) Asistana iletilecek mesaj",
    source: "ai1",
  });

  const bridgeCall = slotBridgeCalls[0] ?? {};
  assert.equal(result.success, true);
  assert.equal(bridgeCall["toSlot"], "ai0");
  assert.equal(bridgeCall["fromSlot"], "ai1");
  assert.equal(bridgeCall["force"], true);
  assert.equal(
    (bridgeCall["payload"] as { text?: string } | undefined)?.text,
    "Asistana iletilecek mesaj\n<!-- hev-sender:ai1 -->"
  );
});

test("RelayManager catches ai0 last-message commands only when assistant checkbox is enabled", async () => {
  const originalGetSnapshot = SettingsManager.getSnapshot;
  const originalCoreEngine = RelayManager.coreEngine;

  const caught: Array<{ command: string; args: string; provider: string }> = [];

  try {
    RelayManager.coreEngine = {
      handleCaughtCommand: async (command: string, payload: { args?: string; provider?: string }) => {
        caught.push({
          command,
          args: payload.args ?? "",
          provider: payload.provider ?? "",
        });
        return { success: true };
      },
    } as never;

    SettingsManager.getSnapshot = () => ({
      assistantSlot: { catchCommands: false },
    }) as never;

    const disabledResult = await RelayManager.processAssistantCommandCatch({
      messages: [{ role: "assistant", text: "++cmd:AssistantAISend(ai1) Merhaba" }],
    });

    assert.equal(disabledResult, false);
    assert.equal(caught.length, 0);

    SettingsManager.getSnapshot = () => ({
      assistantSlot: { catchCommands: true },
    }) as never;

    const enabledResult = await RelayManager.processAssistantCommandCatch({
      messages: [{ role: "assistant", text: "++cmd:AssistantAISend(ai1) Merhaba" }],
    });

    assert.equal(enabledResult, true);
    assert.equal(caught.length, 1);
    assert.equal(caught[0]?.command, "AssistantAISend");
    assert.equal(caught[0]?.args, "ai1");
    assert.equal(caught[0]?.provider, "ai0");
  } finally {
    SettingsManager.getSnapshot = originalGetSnapshot;
    RelayManager.coreEngine = originalCoreEngine;
  }
});

test("server commands block assistant-only command on ai1 and general command on ai0", async () => {
  const assistantOnlyFromAi1 = (await serverCommands.run("AssistantAISend", {
    provider: "ai1",
    args: "ai2",
    text: "test",
  })) as { success?: boolean; message?: string };

  assert.equal(assistantOnlyFromAi1.success, false);
  assert.match(
    String(assistantOnlyFromAi1.message),
    /yetki|izin|allowed|kullanamaz|kullan[ıi]labilir/i
  );

  const nonAssistantFromAi0 = (await serverCommands.run("AIAIChatStart", {
    provider: "ai0",
    args: "ai1",
  })) as { success?: boolean; message?: string };

  assert.equal(nonAssistantFromAi0.success, false);
  assert.match(String(nonAssistantFromAi0.message), /yetki|izin|allowed|kullanamaz/i);
});

test("server commands expose AI1-AI2 and AI0 categories", () => {
  const categoryApi = serverCommands as unknown as {
    listByCategory?: (category: string) => string[];
    has?: (commandName: string) => boolean;
  };

  assert.equal(typeof categoryApi.listByCategory, "function");
  assert.equal(typeof categoryApi.has, "function");

  const aiCategory = categoryApi.listByCategory?.("ai1-ai2") ?? [];
  const assistantCategory = categoryApi.listByCategory?.("ai0") ?? [];

  assert.equal(aiCategory.includes("AIAIChatStart"), true);
  assert.equal(assistantCategory.includes("AssistantAISend"), true);
  assert.equal(aiCategory.includes("SlotBridge"), true);
  assert.equal(assistantCategory.includes("SlotBridge"), true);
  assert.equal(assistantCategory.includes("AIAIChatStart"), false);
  assert.equal(categoryApi.has?.("AssistantAISend"), true);
});

test("server commands block disabled commands per slot", async () => {
  const originalGetSnapshot = SettingsManager.getSnapshot;

  try {
    SettingsManager.getSnapshot = () => ({
      slots: {
        ai1: { disabledCommands: ["WhisperManager"] },
        ai2: { disabledCommands: [] },
      },
      assistantSlot: { disabledCommands: [] },
    }) as never;

    const disabled = (await serverCommands.run("WhisperManager", {
      provider: "ai1",
      args: "",
    })) as { success?: boolean; message?: string };

    assert.equal(disabled.success, false);
    assert.match(String(disabled.message), /pasif|disabled|devre dışı/i);
  } finally {
    SettingsManager.getSnapshot = originalGetSnapshot;
  }
});

test("server commands can disable SlotBridge actions per slot", async () => {
  const originalGetSnapshot = SettingsManager.getSnapshot;

  try {
    SettingsManager.getSnapshot = () => ({
      slots: {
        ai1: { disabledCommands: ["SlotBridge:message.send"] },
        ai2: { disabledCommands: [] },
      },
      assistantSlot: { disabledCommands: [] },
    }) as never;

    const disabled = (await serverCommands.run("SlotBridge", {
      provider: "ai1",
      action: "message.send",
      toSlot: "ai2",
      payload: { text: "hello" },
    })) as { success?: boolean; message?: string };

    assert.equal(disabled.success, false);
    assert.match(String(disabled.message), /pasif|disabled|devre dışı/i);
  } finally {
    SettingsManager.getSnapshot = originalGetSnapshot;
  }
});

test("AIAssistantSend test mode does not route through SlotBridge", async () => {
  const result = await aiAssistantSendHandler({
    provider: "ai1",
    args: "ai1",
    text: "++cmd:AIAssistantSend(ai1) test mesajı",
    testMode: true,
    source: "manual",
  });

  assert.equal(result.success, true);
  assert.equal(slotBridgeCalls.length, 0);
});

test("AssistantAISend test mode does not route through SlotBridge", async () => {
  const originalGetSnapshot = SettingsManager.getSnapshot;

  try {
    SettingsManager.getSnapshot = () => ({
      assistants: { lastActiveRelay: "ai1 - assistant" },
    }) as never;

    const result = await assistantAISendHandler({
      provider: "ai0",
      args: "ai1",
      text: "++cmd:AssistantAISend(ai1) test mesajı",
      testMode: true,
      source: "manual",
    });

    assert.equal(result.success, true);
    assert.equal(slotBridgeCalls.length, 0);
  } finally {
    SettingsManager.getSnapshot = originalGetSnapshot;
  }
});
