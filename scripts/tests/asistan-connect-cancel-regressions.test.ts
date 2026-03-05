import assert from "node:assert/strict";
import test from "node:test";

import { ConnectButtonState } from "../../src/types/asistan.ts";
import { resolveAsistanConnectButtonState } from "../../src/js/pages/asistan/connect-flow.ts";

test("returns cancel state while slot is connecting", () => {
  const state = resolveAsistanConnectButtonState({
    slotState: "connecting",
    isServerRunning: false,
    connectFlowActive: false,
  });

  assert.equal(state, ConnectButtonState.CANCEL_CONNECTING);
});

test("returns cancel state while custom connect flow is active", () => {
  const state = resolveAsistanConnectButtonState({
    slotState: "assigned",
    isServerRunning: false,
    connectFlowActive: true,
  });

  assert.equal(state, ConnectButtonState.CANCEL_CONNECTING);
});

test("returns connected state when server is running", () => {
  const state = resolveAsistanConnectButtonState({
    slotState: "assigned",
    isServerRunning: true,
    connectFlowActive: false,
  });

  assert.equal(state, ConnectButtonState.CONNECTED);
});

test("keeps cancel state while connect flow is active even if server is running", () => {
  const state = resolveAsistanConnectButtonState({
    slotState: "connected",
    isServerRunning: true,
    connectFlowActive: true,
  });

  assert.equal(state, ConnectButtonState.CANCEL_CONNECTING);
});

test("returns idle when not connecting and server is passive", () => {
  const state = resolveAsistanConnectButtonState({
    slotState: "assigned",
    isServerRunning: false,
    connectFlowActive: false,
  });

  assert.equal(state, ConnectButtonState.IDLE);
});
