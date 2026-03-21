import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

function createRoomHostRuntime() {
  const source = readFileSync("rooms/game-room/host/index.js", "utf8");
  const module = { exports: {} };
  const evaluator = new Function("module", "exports", source);
  evaluator(module, module.exports);

  const state = new Map();
  const protocolCalls: Array<Record<string, unknown>> = [];
  const messageCalls: Array<Record<string, unknown>> = [];
  const notifications: Array<{ type: string; payload: Record<string, unknown> }> = [];
  const api = {
    notifyRoom(type: string, payload: Record<string, unknown> = {}) {
      notifications.push({ type, payload });
    },
    sendProtocol: async (payload: Record<string, unknown>) => {
      protocolCalls.push(payload);
      return { success: true };
    },
    sendMessage: async (payload: Record<string, unknown>) => {
      messageCalls.push(payload);
      return { success: true };
    },
    sendToTargets: async () => ({ success: true }),
    getLocale: () => "en",
    getState: (key: string) => state.get(key),
    setState: (key: string, value: unknown) => {
      state.set(key, value);
      return value;
    },
    deleteState: (key: string) => state.delete(key),
    log: () => undefined,
  };

  const exported =
    typeof module.exports === "function"
      ? module.exports(api)
      : module.exports.activate(api);

  return {
    api,
    state,
    protocolCalls,
    messageCalls,
    notifications,
    exported,
    latestGameState() {
      const latest = notifications
        .filter((entry) => entry.type === "xox-state")
        .at(-1)?.payload?.state as Record<string, unknown> | undefined;
      return latest ?? null;
    },
  };
}

function buildReadyHostContext(target = "ai1") {
  return {
    type: "host-context",
    locale: "en",
    user: {
      nickname: "Raistlin",
    },
    slots: {
      ai1: {
        slotId: "ai1",
        nickname: target === "ai1" ? "Alpha" : "Beta",
        assigned: true,
        connected: true,
        ready: true,
        state: "connected",
      },
      ai2: {
        slotId: "ai2",
        nickname: target === "ai2" ? "Beta" : "Alpha",
        assigned: true,
        connected: true,
        ready: true,
        state: "connected",
      },
    },
  };
}

async function startMatch(
  runtime: ReturnType<typeof createRoomHostRuntime>,
  options: { target?: "ai1" | "ai2"; starter?: "user" | "ai" } = {}
) {
  const target = options.target ?? "ai1";
  const starter = options.starter ?? "user";
  runtime.exported.onRoomEvent(buildReadyHostContext(target));
  runtime.exported.onRoomReady();
  return await runtime.exported.commands.GameRoomXoxStart({
    roomArgs: { target, starter },
  });
}

async function applyUserMove(runtime: ReturnType<typeof createRoomHostRuntime>, cell: number) {
  return await runtime.exported.commands.GameRoomXoxUserMove({
    roomArgs: { cell },
  });
}

async function applyAiMove(
  runtime: ReturnType<typeof createRoomHostRuntime>,
  cell: number,
  provider: "ai1" | "ai2" = "ai1"
) {
  return await runtime.exported.commands.GameRoomXoxAiMove({
    provider,
    roomArgs: { cell },
  });
}

test("game-room host delays protocol until the first AI turn when the user starts", async () => {
  const runtime = createRoomHostRuntime();
  const startResult = await startMatch(runtime, { target: "ai1", starter: "user" });
  const userMoveResult = await applyUserMove(runtime, 0);

  assert.equal(startResult.success, true);
  assert.equal(userMoveResult.success, true);
  assert.equal(runtime.protocolCalls.length, 1);
  assert.equal(runtime.messageCalls.length, 1);
  assert.equal(runtime.protocolCalls[0]?.scenario, "xox-user-start");
  assert.match(String(runtime.messageCalls[0]?.text ?? ""), /\+\+cmd:GameRoomXoxAiMove/);
  assert.match(String(runtime.messageCalls[0]?.text ?? ""), /X \| 1 \| 2/);
  assert.equal(runtime.latestGameState()?.selectedTarget, "ai1");
  assert.equal(runtime.latestGameState()?.awaitingMoveFrom, "ai");
  assert.equal(runtime.latestGameState()?.protocolDelivered, true);
});

test("game-room host sends protocol immediately when the AI starts", async () => {
  const runtime = createRoomHostRuntime();
  const startResult = await startMatch(runtime, { target: "ai2", starter: "ai" });
  const aiMoveResult = await applyAiMove(runtime, 4, "ai2");

  assert.equal(startResult.success, true);
  assert.equal(aiMoveResult.success, true);
  assert.equal(runtime.protocolCalls.length, 1);
  assert.equal(runtime.messageCalls.length, 1);
  assert.equal(runtime.protocolCalls[0]?.scenario, "xox-ai-start");
  assert.equal(runtime.latestGameState()?.selectedTarget, "ai2");
  assert.equal(runtime.latestGameState()?.userSymbol, "O");
  assert.equal(runtime.latestGameState()?.aiSymbol, "X");
  assert.equal(Array.isArray(runtime.latestGameState()?.board), true);
  assert.equal((runtime.latestGameState()?.board as string[])[4], "X");
  assert.equal(runtime.latestGameState()?.awaitingMoveFrom, "user");
});

test("game-room host blocks the match when the selected opponent disappears mid-game", async () => {
  const runtime = createRoomHostRuntime();
  await startMatch(runtime, { target: "ai1", starter: "user" });
  await applyUserMove(runtime, 0);

  runtime.exported.onRoomEvent({
    type: "host-context",
    locale: "en",
    user: {
      nickname: "Raistlin",
    },
    slots: {
      ai1: {
        slotId: "ai1",
        nickname: "Alpha",
        assigned: true,
        connected: false,
        ready: false,
        state: "assigned",
      },
      ai2: {
        slotId: "ai2",
        nickname: "Beta",
        assigned: true,
        connected: true,
        ready: true,
        state: "connected",
      },
    },
  });

  assert.equal(runtime.latestGameState()?.result, "blocked");
  assert.equal(runtime.latestGameState()?.blockedReason, "opponent-unavailable");
  assert.match(String(runtime.latestGameState()?.status ?? ""), /Reset to begin again/);
});

test("game-room host rejects user moves outside the legal turn and cell contract", async () => {
  const runtime = createRoomHostRuntime();
  await startMatch(runtime, { target: "ai2", starter: "ai" });
  await applyAiMove(runtime, 4, "ai2");

  const invalidCellResult = await applyUserMove(runtime, 12);
  const filledCellResult = await applyUserMove(runtime, 4);
  const validMoveResult = await applyUserMove(runtime, 0);
  const wrongTurnResult = await applyUserMove(runtime, 1);

  assert.equal(invalidCellResult.success, false);
  assert.equal(filledCellResult.success, false);
  assert.equal(validMoveResult.success, true);
  assert.equal(wrongTurnResult.success, false);
  assert.equal((runtime.latestGameState()?.board as string[])[0], "O");
  assert.equal((runtime.latestGameState()?.board as string[])[4], "X");
  assert.equal(runtime.latestGameState()?.awaitingMoveFrom, "ai");
});

test("game-room host rejects non-selected AI providers without mutating the board", async () => {
  const runtime = createRoomHostRuntime();
  await startMatch(runtime, { target: "ai1", starter: "user" });
  await applyUserMove(runtime, 0);

  const wrongProviderResult = await applyAiMove(runtime, 4, "ai2");

  assert.equal(wrongProviderResult.success, false);
  assert.equal((runtime.latestGameState()?.board as string[])[4], "");
  assert.equal(runtime.latestGameState()?.awaitingMoveFrom, "ai");
  assert.equal(runtime.latestGameState()?.result, "pending");
});

test("game-room host blocks invalid AI moves that break the turn contract", async () => {
  const invalidCellRuntime = createRoomHostRuntime();
  await startMatch(invalidCellRuntime, { target: "ai1", starter: "user" });
  await applyUserMove(invalidCellRuntime, 0);

  const invalidCellResult = await applyAiMove(invalidCellRuntime, 12, "ai1");

  assert.equal(invalidCellResult.success, false);
  assert.equal(invalidCellRuntime.latestGameState()?.result, "blocked");
  assert.equal(invalidCellRuntime.latestGameState()?.blockedReason, "ai-invalid-cell");

  const filledCellRuntime = createRoomHostRuntime();
  await startMatch(filledCellRuntime, { target: "ai1", starter: "user" });
  await applyUserMove(filledCellRuntime, 0);

  const filledCellResult = await applyAiMove(filledCellRuntime, 0, "ai1");

  assert.equal(filledCellResult.success, false);
  assert.equal(filledCellRuntime.latestGameState()?.result, "blocked");
  assert.equal(filledCellRuntime.latestGameState()?.blockedReason, "ai-filled-cell");
});

test("game-room host detects a user win and locks the board after completion", async () => {
  const runtime = createRoomHostRuntime();
  await startMatch(runtime, { target: "ai1", starter: "user" });
  await applyUserMove(runtime, 0);
  await applyAiMove(runtime, 3, "ai1");
  await applyUserMove(runtime, 1);
  await applyAiMove(runtime, 4, "ai1");

  const winningMoveResult = await applyUserMove(runtime, 2);
  const postGameUserMoveResult = await applyUserMove(runtime, 8);
  const postGameAiMoveResult = await applyAiMove(runtime, 8, "ai1");

  assert.equal(winningMoveResult.success, true);
  assert.equal(runtime.latestGameState()?.result, "user-win");
  assert.equal(runtime.latestGameState()?.winner, "user");
  assert.equal(runtime.latestGameState()?.active, false);
  assert.equal(runtime.latestGameState()?.awaitingMoveFrom, null);
  assert.equal(postGameUserMoveResult.success, false);
  assert.equal(postGameAiMoveResult.success, false);
});

test("game-room host detects draw states without leaving extra turns pending", async () => {
  const runtime = createRoomHostRuntime();
  await startMatch(runtime, { target: "ai1", starter: "user" });
  await applyUserMove(runtime, 0);
  await applyAiMove(runtime, 1, "ai1");
  await applyUserMove(runtime, 2);
  await applyAiMove(runtime, 4, "ai1");
  await applyUserMove(runtime, 3);
  await applyAiMove(runtime, 5, "ai1");
  await applyUserMove(runtime, 7);
  await applyAiMove(runtime, 6, "ai1");

  const drawMoveResult = await applyUserMove(runtime, 8);

  assert.equal(drawMoveResult.success, true);
  assert.equal(runtime.latestGameState()?.result, "draw");
  assert.equal(runtime.latestGameState()?.winner, "");
  assert.equal(runtime.latestGameState()?.active, false);
  assert.equal(runtime.latestGameState()?.awaitingMoveFrom, null);
});
