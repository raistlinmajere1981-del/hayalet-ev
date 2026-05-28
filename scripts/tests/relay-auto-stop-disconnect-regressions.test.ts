import assert from "node:assert/strict";
import test from "node:test";

import "./helpers/register-static-asset-hooks.ts";

const { handleRelayDisconnectAutoStop } = await import(
  "../../src/js/modules/core/runtime-actions.js"
);
const { AppState } = await import("../../src/js/modules/app-state.ts");

test("AI-AI relay auto-stop sends stop protocol to remaining connected AI", async () => {
  const originalIsConnected = AppState.isConnected;

  let sentPayload: Record<string, unknown> | null = null;
  let stopProtocolCalled = false;
  let stopSessionCalled = false;

  try {
    const relay = {
      isAIAIActive: () => true,
      isAIAssistantActive: () => false,
      stopProtocolSession: async () => {
        stopProtocolCalled = true;
      },
      stopSession: async () => {
        stopSessionCalled = true;
      },
      stopAIAssistantSession: async () => {},
      getAIAssistantSourceSlot: () => null,
    };

    AppState.isConnected = (slot: string) => slot === "ai2";

    const dispatchProtocol = async (payload: Record<string, unknown>) => {
      sentPayload = payload;
      return { success: true };
    };

    await handleRelayDisconnectAutoStop("ai1", { relay, dispatchProtocol });

    assert.deepEqual(sentPayload, {
      room: "analyze",
      scenario: "ai-ai-stop",
      targets: ["ai2"],
    });
    assert.equal(stopProtocolCalled, false);
    assert.equal(stopSessionCalled, false);
  } finally {
    AppState.isConnected = originalIsConnected;
  }
});

test("AI-AI relay auto-stop hard-stops when no connected target remains", async () => {
  const originalIsConnected = AppState.isConnected;

  let sendCalled = false;
  let stopProtocolCalled = false;
  let stopSessionCalled = false;

  try {
    const relay = {
      isAIAIActive: () => true,
      isAIAssistantActive: () => false,
      stopProtocolSession: async () => {
        stopProtocolCalled = true;
      },
      stopSession: async () => {
        stopSessionCalled = true;
      },
      stopAIAssistantSession: async () => {},
      getAIAssistantSourceSlot: () => null,
    };

    AppState.isConnected = () => false;

    const dispatchProtocol = async () => {
      sendCalled = true;
      return { success: true };
    };

    await handleRelayDisconnectAutoStop("ai1", { relay, dispatchProtocol });

    assert.equal(sendCalled, false);
    assert.equal(stopProtocolCalled, true);
    assert.equal(stopSessionCalled, true);
  } finally {
    AppState.isConnected = originalIsConnected;
  }
});

test("AI-Assistant relay auto-stop sends the standardized stop protocol when ai0 disconnects", async () => {
  const originalIsConnected = AppState.isConnected;

  let sentPayload: Record<string, unknown> | null = null;
  let stopAssistantCalled = false;

  try {
    const relay = {
      isAIAIActive: () => false,
      isAIAssistantActive: () => true,
      stopProtocolSession: async () => {},
      stopSession: async () => {},
      stopAIAssistantSession: async () => {
        stopAssistantCalled = true;
      },
      getAIAssistantSourceSlot: () => "ai2",
    };

    AppState.isConnected = (slot: string) => slot === "ai2";

    const dispatchProtocol = async (payload: Record<string, unknown>) => {
      sentPayload = payload;
      return { success: true };
    };

    await handleRelayDisconnectAutoStop("ai0", { relay, dispatchProtocol });

    assert.deepEqual(sentPayload, {
      room: "analyze",
      scenario: "ai-assistant-stop",
      targets: ["ai2"],
    });
    assert.equal(stopAssistantCalled, false);
  } finally {
    AppState.isConnected = originalIsConnected;
  }
});

test("AI-Assistant relay auto-stop hard-stops when the source AI disconnects", async () => {
  const originalIsConnected = AppState.isConnected;

  let sendCalled = false;
  let stopAssistantCalled = false;

  try {
    const relay = {
      isAIAIActive: () => false,
      isAIAssistantActive: () => true,
      stopProtocolSession: async () => {},
      stopSession: async () => {},
      stopAIAssistantSession: async () => {
        stopAssistantCalled = true;
      },
      getAIAssistantSourceSlot: () => "ai1",
    };

    AppState.isConnected = () => false;

    const dispatchProtocol = async () => {
      sendCalled = true;
      return { success: true };
    };

    await handleRelayDisconnectAutoStop("ai1", { relay, dispatchProtocol });

    assert.equal(sendCalled, false);
    assert.equal(stopAssistantCalled, true);
  } finally {
    AppState.isConnected = originalIsConnected;
  }
});
