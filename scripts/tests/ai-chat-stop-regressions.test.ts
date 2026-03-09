import assert from "node:assert/strict";
import test from "node:test";

import { CoreEngine } from "../../src/js/modules/core-engine.js";
import { RelayManager } from "../../src/js/modules/relay-manager.js";
import {
  aiaiChatStopHandler,
  aiAssistantChatStopHandler,
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

test("AI-Assistant stop command does not stop when relay inactive", async () => {
  const originalIsAIAssistantActive = RelayManager.isAIAssistantActive;
  const originalStopAIAssistantSession = RelayManager.stopAIAssistantSession;
  let stopCalled = false;

  try {
    RelayManager.isAIAssistantActive = () => false;
    RelayManager.stopAIAssistantSession = async () => {
      stopCalled = true;
    };

    const result = await aiAssistantChatStopHandler({ provider: "ai1" });

    assert.equal(result.success, false);
    assert.equal(stopCalled, false);
  } finally {
    RelayManager.isAIAssistantActive = originalIsAIAssistantActive;
    RelayManager.stopAIAssistantSession = originalStopAIAssistantSession;
  }
});

test("AI-Assistant stop command sends the standardized stop protocol to the active source AI", async () => {
  const originalIsAIAssistantActive = RelayManager.isAIAssistantActive;
  const originalGetAIAssistantSourceSlot = RelayManager.getAIAssistantSourceSlot;
  const originalStopAIAssistantSession = RelayManager.stopAIAssistantSession;
  const originalSendProtocol = CoreEngine.sendProtocol;

  let stopCalled = false;
  let sendArgs: Record<string, unknown> | null = null;

  try {
    RelayManager.isAIAssistantActive = () => true;
    RelayManager.getAIAssistantSourceSlot = () => "ai2";
    RelayManager.stopAIAssistantSession = async () => {
      stopCalled = true;
    };
    CoreEngine.sendProtocol = async (args: Record<string, unknown>) => {
      sendArgs = args;
      return { success: true };
    };

    const result = await aiAssistantChatStopHandler({ provider: "ai1" });

    assert.equal(result.success, true);
    assert.deepEqual(sendArgs, {
      room: "analyze",
      scenario: "ai-assistant-stop",
      targets: ["ai2"],
    });
    assert.equal(stopCalled, false);
  } finally {
    RelayManager.isAIAssistantActive = originalIsAIAssistantActive;
    RelayManager.getAIAssistantSourceSlot = originalGetAIAssistantSourceSlot;
    RelayManager.stopAIAssistantSession = originalStopAIAssistantSession;
    CoreEngine.sendProtocol = originalSendProtocol;
  }
});
