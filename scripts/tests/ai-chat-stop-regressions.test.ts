import assert from "node:assert/strict";
import test from "node:test";

import { CoreEngine } from "../../src/js/modules/core-engine.js";
import { RelayManager } from "../../src/js/modules/relay-manager.js";
import {
  aiaiChatStopHandler,
  aiAsistanChatStopHandler,
} from "../../src/js/modules/commands/ai-chat-commands.js";

test("AI-AI stop command does not send stop protocol when relay inactive", async () => {
  const originalIsAIAIActive = RelayManager.isAIAIActive;
  const originalSendProtocol = CoreEngine.sendProtocol;
  let sendProtocolCalled = false;

  try {
    RelayManager.isAIAIActive = () => false;
    CoreEngine.sendProtocol = async () => {
      sendProtocolCalled = true;
      return { success: true };
    };

    const result = await aiaiChatStopHandler({ provider: "ai1" });

    assert.equal(result.success, false);
    assert.equal(sendProtocolCalled, false);
  } finally {
    RelayManager.isAIAIActive = originalIsAIAIActive;
    CoreEngine.sendProtocol = originalSendProtocol;
  }
});

test("AI-Asistan stop command does not stop when relay inactive", async () => {
  const originalIsAIAsistanActive = RelayManager.isAIAsistanActive;
  const originalStopAIAsistanSession = RelayManager.stopAIAsistanSession;
  let stopCalled = false;

  try {
    RelayManager.isAIAsistanActive = () => false;
    RelayManager.stopAIAsistanSession = async () => {
      stopCalled = true;
    };

    const result = await aiAsistanChatStopHandler({ provider: "ai1" });

    assert.equal(result.success, false);
    assert.equal(stopCalled, false);
  } finally {
    RelayManager.isAIAsistanActive = originalIsAIAsistanActive;
    RelayManager.stopAIAsistanSession = originalStopAIAsistanSession;
  }
});

test("AI-Asistan stop command sends standardized stop protocol to active source AI", async () => {
  const originalIsAIAsistanActive = RelayManager.isAIAsistanActive;
  const originalGetAIAsistanSourceSlot = RelayManager.getAIAsistanSourceSlot;
  const originalStopAIAsistanSession = RelayManager.stopAIAsistanSession;
  const originalSendProtocol = CoreEngine.sendProtocol;

  let stopCalled = false;
  let sendArgs: Record<string, unknown> | null = null;

  try {
    RelayManager.isAIAsistanActive = () => true;
    RelayManager.getAIAsistanSourceSlot = () => "ai2";
    RelayManager.stopAIAsistanSession = async () => {
      stopCalled = true;
    };
    CoreEngine.sendProtocol = async (args: Record<string, unknown>) => {
      sendArgs = args;
      return { success: true };
    };

    const result = await aiAsistanChatStopHandler({ provider: "ai1" });

    assert.equal(result.success, true);
    assert.deepEqual(sendArgs, {
      room: "analyze",
      scenario: "ai-asistan-stop",
      targets: ["ai2"],
    });
    assert.equal(stopCalled, false);
  } finally {
    RelayManager.isAIAsistanActive = originalIsAIAsistanActive;
    RelayManager.getAIAsistanSourceSlot = originalGetAIAsistanSourceSlot;
    RelayManager.stopAIAsistanSession = originalStopAIAsistanSession;
    CoreEngine.sendProtocol = originalSendProtocol;
  }
});
