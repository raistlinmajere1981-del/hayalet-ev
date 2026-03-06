import assert from "node:assert/strict";
import test from "node:test";

import { CoreEngine } from "../../src/js/modules/core-engine.ts";
import { RelayManager } from "../../src/js/modules/relay-manager.ts";
import { SettingsManager } from "../../src/js/modules/settings-manager.ts";
import { serverCommands } from "../../src/js/modules/server-commands.ts";
import { SlotController } from "../../src/js/modules/slot-controller.ts";
import { RelayManager } from "../../src/js/modules/relay-manager.ts";
import {
  asistanAISendHandler,
  aiAsistanSendHandler,
} from "../../src/js/modules/commands/ai-chat-commands.ts";

test("AsistanAISend sends cleaned text to explicit target and stops relay", async () => {
  const originalSendMessage = CoreEngine.sendMessage;
  const originalIsAIAsistanActive = RelayManager.isAIAsistanActive;
  const originalStopAIAsistanSession = RelayManager.stopAIAsistanSession;
  const originalIsConnected = SlotController.isConnected;

  let sentProvider = "";
  let sentText = "";
  let stopped = false;

  try {
    CoreEngine.sendMessage = async ({ provider, text }: { provider: string; text: string }) => {
      sentProvider = provider;
      sentText = text;
      return { success: true };
    };
    RelayManager.isAIAsistanActive = () => true;
    RelayManager.stopAIAsistanSession = async () => {
      stopped = true;
    };
    SlotController.isConnected = () => true;

    const result = await asistanAISendHandler({
      provider: "ai0",
      args: "ai2",
      text: "++cmd:AsistanAISend(ai2) Merhaba AI2",
      source: "ai0",
    });

    assert.equal(result.success, true);
    assert.equal(sentProvider, "ai2");
    assert.equal(sentText, "Merhaba AI2\n<!-- hev-sender:Asistan -->");
    assert.equal(stopped, true);
  } finally {
    CoreEngine.sendMessage = originalSendMessage;
    RelayManager.isAIAsistanActive = originalIsAIAsistanActive;
    RelayManager.stopAIAsistanSession = originalStopAIAsistanSession;
    SlotController.isConnected = originalIsConnected;
  }
});

test("AsistanAISend fails when target cannot be resolved", async () => {
  const originalGetSnapshot = SettingsManager.getSnapshot;
  const originalSendMessage = CoreEngine.sendMessage;
  let sendCalled = false;

  try {
    SettingsManager.getSnapshot = () => ({
      assistants: { lastActiveRelay: null },
    }) as never;

    CoreEngine.sendMessage = async () => {
      sendCalled = true;
      return { success: true };
    };

    const result = await asistanAISendHandler({
      provider: "ai0",
      args: "",
      text: "++cmd:AsistanAISend() Merhaba",
      source: "ai0",
    });

    assert.equal(result.success, false);
    assert.match(String(result.message), /Hedef secilemedi/i);
    assert.equal(sendCalled, false);
  } finally {
    SettingsManager.getSnapshot = originalGetSnapshot;
    CoreEngine.sendMessage = originalSendMessage;
  }
});

test("AIAsistanSend connects ai0 if needed and forwards cleaned message", async () => {
  const originalSendMessage = CoreEngine.sendMessage;
  const originalIsConnected = SlotController.isConnected;
  const originalConnect = SlotController.connect;

  let sentProvider = "";
  let sentText = "";
  let connectCalled = false;

  try {
    SlotController.isConnected = (slot: string) => (slot === "ai0" ? false : true);
    SlotController.connect = async (slot: "ai0" | "ai1" | "ai2") => {
      if (slot === "ai0") {
        connectCalled = true;
      }
      return { success: true, message: "connected" };
    };

    CoreEngine.sendMessage = async ({ provider, text }: { provider: string; text: string }) => {
      sentProvider = provider;
      sentText = text;
      return { success: true };
    };

    const result = await aiAsistanSendHandler({
      provider: "ai1",
      args: "ai1",
      text: "++cmd:AIAsistanSend(ai1) Asistana iletilecek mesaj",
      source: "ai1",
    });

    assert.equal(result.success, true);
    assert.equal(connectCalled, true);
    assert.equal(sentProvider, "ai0");
    assert.equal(sentText, "Asistana iletilecek mesaj\n<!-- hev-sender:ai1 -->");
  } finally {
    CoreEngine.sendMessage = originalSendMessage;
    SlotController.isConnected = originalIsConnected;
    SlotController.connect = originalConnect;
  }
});

test("RelayManager catches ai0 last-message commands only when asistan checkbox enabled", async () => {
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
      asistanSlot: { catchCommands: false },
    }) as never;

    const disabledResult = await RelayManager.processAsistanCommandCatch({
      messages: [{ role: "assistant", text: "++cmd:AsistanAISend(ai1) Merhaba" }],
    });

    assert.equal(disabledResult, false);
    assert.equal(caught.length, 0);

    SettingsManager.getSnapshot = () => ({
      asistanSlot: { catchCommands: true },
    }) as never;

    const enabledResult = await RelayManager.processAsistanCommandCatch({
      messages: [{ role: "assistant", text: "++cmd:AsistanAISend(ai1) Merhaba" }],
    });

    assert.equal(enabledResult, true);
    assert.equal(caught.length, 1);
    assert.equal(caught[0]?.command, "AsistanAISend");
    assert.equal(caught[0]?.args, "ai1");
    assert.equal(caught[0]?.provider, "ai0");
  } finally {
    SettingsManager.getSnapshot = originalGetSnapshot;
    RelayManager.coreEngine = originalCoreEngine;
  }
});

test("server commands block assistant-only command on ai1 and general command on ai0", async () => {
  const assistantOnlyFromAi1 = (await serverCommands.run("AsistanAISend", {
    provider: "ai1",
    args: "ai2",
    text: "test",
  })) as { success?: boolean; message?: string };

  assert.equal(assistantOnlyFromAi1.success, false);
  assert.match(String(assistantOnlyFromAi1.message), /yetki|izin|allowed|kullanamaz|kullanilabilir/i);

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
  };

  assert.equal(typeof categoryApi.listByCategory, "function");

  const aiCategory = categoryApi.listByCategory?.("ai1-ai2") ?? [];
  const asistanCategory = categoryApi.listByCategory?.("ai0") ?? [];

  assert.equal(aiCategory.includes("AIAIChatStart"), true);
  assert.equal(asistanCategory.includes("AsistanAISend"), true);
  assert.equal(asistanCategory.includes("AIAIChatStart"), false);
});

test("server commands block disabled commands per slot", async () => {
  const originalGetSnapshot = SettingsManager.getSnapshot;

  try {
    SettingsManager.getSnapshot = () => ({
      slots: {
        ai1: { disabledCommands: ["PlayMusic"] },
        ai2: { disabledCommands: [] },
      },
      asistanSlot: { disabledCommands: [] },
    }) as never;

    const disabled = (await serverCommands.run("PlayMusic", {
      provider: "ai1",
      args: "",
    })) as { success?: boolean; message?: string };

    assert.equal(disabled.success, false);
    assert.match(String(disabled.message), /pasif|disabled|devre dışı/i);
  } finally {
    SettingsManager.getSnapshot = originalGetSnapshot;
  }
});

test("AIAsistanSend test mode does not connect or send to ai0", async () => {
  const originalSendMessage = CoreEngine.sendMessage;
  const originalConnect = SlotController.connect;
  const originalIsConnected = SlotController.isConnected;

  let sendCalled = false;
  let connectCalled = false;

  try {
    SlotController.isConnected = () => false;
    SlotController.connect = async () => {
      connectCalled = true;
      return { success: true, message: "connected" };
    };
    CoreEngine.sendMessage = async () => {
      sendCalled = true;
      return { success: true };
    };

    const result = await aiAsistanSendHandler({
      provider: "ai1",
      args: "ai1",
      text: "++cmd:AIAsistanSend(ai1) test mesajı",
      testMode: true,
      source: "manual",
    });

    assert.equal(result.success, true);
    assert.equal(connectCalled, false);
    assert.equal(sendCalled, false);
  } finally {
    CoreEngine.sendMessage = originalSendMessage;
    SlotController.connect = originalConnect;
    SlotController.isConnected = originalIsConnected;
  }
});

test("AsistanAISend test mode does not send to target slot", async () => {
  const originalGetSnapshot = SettingsManager.getSnapshot;
  const originalSendMessage = CoreEngine.sendMessage;
  const originalIsConnected = SlotController.isConnected;

  let sendCalled = false;

  try {
    SettingsManager.getSnapshot = () => ({
      assistants: { lastActiveRelay: "ai1 - asistan" },
    }) as never;
    SlotController.isConnected = () => true;
    CoreEngine.sendMessage = async () => {
      sendCalled = true;
      return { success: true };
    };

    const result = await asistanAISendHandler({
      provider: "ai0",
      args: "ai1",
      text: "++cmd:AsistanAISend(ai1) test mesajı",
      testMode: true,
      source: "manual",
    });

    assert.equal(result.success, true);
    assert.equal(sendCalled, false);
  } finally {
    SettingsManager.getSnapshot = originalGetSnapshot;
    CoreEngine.sendMessage = originalSendMessage;
    SlotController.isConnected = originalIsConnected;
  }
});
