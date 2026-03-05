import assert from "node:assert/strict";
import test from "node:test";

import { CoreEngine } from "../../src/js/modules/core-engine.js";
import { SlotController } from "../../src/js/modules/slot-controller.js";

type CoreEnginePatch = {
  relay: unknown;
  sendProtocol: (payload: Record<string, unknown>) => Promise<{ success: boolean }>;
  _handleRelayDisconnectAutoStop?: (slot: string) => Promise<void>;
};

test("AI-AI relay auto-stop sends stop protocol to remaining connected AI", async () => {
  const coreEngineApi = CoreEngine as unknown as CoreEnginePatch;
  const originalRelay = coreEngineApi.relay;
  const originalSendProtocol = coreEngineApi.sendProtocol;
  const originalIsConnected = SlotController.isConnected;

  let sentPayload: Record<string, unknown> | null = null;
  let stopProtocolCalled = false;
  let stopSessionCalled = false;

  try {
    coreEngineApi.relay = {
      isAIAIActive: () => true,
      isAIAsistanActive: () => false,
      stopProtocolSession: async () => {
        stopProtocolCalled = true;
      },
      stopSession: async () => {
        stopSessionCalled = true;
      },
      stopAIAsistanSession: async () => {},
      getAIAsistanSourceSlot: () => null,
    };

    SlotController.isConnected = (slot: string) => slot === "ai2";

    coreEngineApi.sendProtocol = async (payload: Record<string, unknown>) => {
      sentPayload = payload;
      return { success: true };
    };

    assert.equal(typeof coreEngineApi._handleRelayDisconnectAutoStop, "function");
    await coreEngineApi._handleRelayDisconnectAutoStop?.("ai1");

    assert.deepEqual(sentPayload, {
      room: "analyze",
      scenario: "ai-ai-stop",
      targets: ["ai2"],
    });
    assert.equal(stopProtocolCalled, false);
    assert.equal(stopSessionCalled, false);
  } finally {
    coreEngineApi.relay = originalRelay;
    coreEngineApi.sendProtocol = originalSendProtocol;
    SlotController.isConnected = originalIsConnected;
  }
});

test("AI-AI relay auto-stop hard-stops when no connected target remains", async () => {
  const coreEngineApi = CoreEngine as unknown as CoreEnginePatch;
  const originalRelay = coreEngineApi.relay;
  const originalSendProtocol = coreEngineApi.sendProtocol;
  const originalIsConnected = SlotController.isConnected;

  let sendCalled = false;
  let stopProtocolCalled = false;
  let stopSessionCalled = false;

  try {
    coreEngineApi.relay = {
      isAIAIActive: () => true,
      isAIAsistanActive: () => false,
      stopProtocolSession: async () => {
        stopProtocolCalled = true;
      },
      stopSession: async () => {
        stopSessionCalled = true;
      },
      stopAIAsistanSession: async () => {},
      getAIAsistanSourceSlot: () => null,
    };

    SlotController.isConnected = () => false;

    coreEngineApi.sendProtocol = async () => {
      sendCalled = true;
      return { success: true };
    };

    assert.equal(typeof coreEngineApi._handleRelayDisconnectAutoStop, "function");
    await coreEngineApi._handleRelayDisconnectAutoStop?.("ai1");

    assert.equal(sendCalled, false);
    assert.equal(stopProtocolCalled, true);
    assert.equal(stopSessionCalled, true);
  } finally {
    coreEngineApi.relay = originalRelay;
    coreEngineApi.sendProtocol = originalSendProtocol;
    SlotController.isConnected = originalIsConnected;
  }
});

test("AI-Asistan relay auto-stop sends standardized stop protocol when ai0 disconnects", async () => {
  const coreEngineApi = CoreEngine as unknown as CoreEnginePatch;
  const originalRelay = coreEngineApi.relay;
  const originalSendProtocol = coreEngineApi.sendProtocol;
  const originalIsConnected = SlotController.isConnected;

  let sentPayload: Record<string, unknown> | null = null;
  let stopAsistanCalled = false;

  try {
    coreEngineApi.relay = {
      isAIAIActive: () => false,
      isAIAsistanActive: () => true,
      stopProtocolSession: async () => {},
      stopSession: async () => {},
      stopAIAsistanSession: async () => {
        stopAsistanCalled = true;
      },
      getAIAsistanSourceSlot: () => "ai2",
    };

    SlotController.isConnected = (slot: string) => slot === "ai2";

    coreEngineApi.sendProtocol = async (payload: Record<string, unknown>) => {
      sentPayload = payload;
      return { success: true };
    };

    assert.equal(typeof coreEngineApi._handleRelayDisconnectAutoStop, "function");
    await coreEngineApi._handleRelayDisconnectAutoStop?.("ai0");

    assert.deepEqual(sentPayload, {
      room: "analyze",
      scenario: "ai-asistan-stop",
      targets: ["ai2"],
    });
    assert.equal(stopAsistanCalled, false);
  } finally {
    coreEngineApi.relay = originalRelay;
    coreEngineApi.sendProtocol = originalSendProtocol;
    SlotController.isConnected = originalIsConnected;
  }
});

test("AI-Asistan relay auto-stop hard-stops when source AI disconnects", async () => {
  const coreEngineApi = CoreEngine as unknown as CoreEnginePatch;
  const originalRelay = coreEngineApi.relay;
  const originalSendProtocol = coreEngineApi.sendProtocol;
  const originalIsConnected = SlotController.isConnected;

  let sendCalled = false;
  let stopAsistanCalled = false;

  try {
    coreEngineApi.relay = {
      isAIAIActive: () => false,
      isAIAsistanActive: () => true,
      stopProtocolSession: async () => {},
      stopSession: async () => {},
      stopAIAsistanSession: async () => {
        stopAsistanCalled = true;
      },
      getAIAsistanSourceSlot: () => "ai1",
    };

    SlotController.isConnected = () => false;

    coreEngineApi.sendProtocol = async () => {
      sendCalled = true;
      return { success: true };
    };

    assert.equal(typeof coreEngineApi._handleRelayDisconnectAutoStop, "function");
    await coreEngineApi._handleRelayDisconnectAutoStop?.("ai1");

    assert.equal(sendCalled, false);
    assert.equal(stopAsistanCalled, true);
  } finally {
    coreEngineApi.relay = originalRelay;
    coreEngineApi.sendProtocol = originalSendProtocol;
    SlotController.isConnected = originalIsConnected;
  }
});
