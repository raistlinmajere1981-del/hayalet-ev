import test from "node:test";
import assert from "node:assert/strict";
import { loadGameRoomHostModule } from "./helpers/game-room-host-module.ts";

const gameRoomHostModule = await loadGameRoomHostModule();

type HostRuntime = ReturnType<typeof createRoomHostRuntime>;

const activeRuntimes: HostRuntime[] = [];

async function flushHostTasks(): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, 0));
  await new Promise((resolve) => setTimeout(resolve, 0));
}

function buildBoardHash(board: string[]): string {
  return board.map((value) => (value === "" ? "." : value)).join("");
}

function createRoomHostRuntime() {
  const state = new Map();
  const protocolCalls: Array<Record<string, unknown>> = [];
  const messageCalls: Array<Record<string, unknown>> = [];
  const us1MessageCalls: Array<Record<string, unknown>> = [];
  const us1SyncCalls: Array<Record<string, unknown>> = [];
  const dispatchCalls: Array<Record<string, unknown>> = [];
  const notifications: Array<{ type: string; payload: Record<string, unknown> }> = [];
  const toastCalls: Array<{ type?: string; message?: string }> = [];
  const selectedRemoteUsers: Array<string | null> = [];
  const us1SyncQueue: Array<Record<string, unknown>> = [];
  let exported: Record<string, unknown>;

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
    sendUs1Message: async (payload: Record<string, unknown>) => {
      us1MessageCalls.push(payload);
      const localSessionId =
        typeof payload.localSessionId === "string" && payload.localSessionId.trim() !== ""
          ? payload.localSessionId
          : `us1-session-${us1MessageCalls.length}`;
      return {
        success: true,
        remoteUserId: selectedRemoteUsers.at(-1) ?? "remote@example.com",
        localSessionId,
        conversationId: `us1-conversation-${us1MessageCalls.length}`,
        transportMessageId: `<us1-${us1MessageCalls.length}@example.test>`,
      };
    },
    syncUs1Messages: async (payload: Record<string, unknown> = {}) => {
      us1SyncCalls.push(payload);
      return {
        success: true,
        fetchedCount: 0,
        processedCount: 0,
        duplicateCount: 0,
        projectedCount: 0,
        skippedCount: 0,
        unresolvedSessionCount: 0,
        roomPackages: [],
        roomEvents: [],
        roomCommands: [],
        roomInviteInbox: [],
        ...(us1SyncQueue.shift() ?? {}),
      };
    },
    dispatchRoomCommand: async (commandName: string, payload: Record<string, unknown> = {}) => {
      dispatchCalls.push({ commandName, ...payload });
      const handler = exported?.commands?.[commandName];
      if (typeof handler === "function") {
        return await handler({
          provider: "us1",
          roomArgs: payload.roomPayload,
          args: payload.args,
          transportMessageId: payload.transportMessageId,
          localSessionId: payload.localSessionId,
          remoteUserId: payload.remoteUserId,
        });
      }
      return { success: false, message: `Unknown command: ${commandName}` };
    },
    getUs1Identity: () => ({
      remoteUserId: selectedRemoteUsers.at(-1) ?? "remote@example.com",
      nickname: "Remote Ghost",
      email: "remote@example.com",
    }),
    isUs1Connected: () => true,
    selectUs1RemoteUser: async (remoteUserId: string | null) => {
      selectedRemoteUsers.push(remoteUserId);
      return true;
    },
    showToast: (payload: { type?: string; message?: string }) => {
      toastCalls.push(payload);
    },
    getLocale: () => "en",
    getState: (key: string) => state.get(key),
    setState: (key: string, value: unknown) => {
      state.set(key, value);
      return value;
    },
    deleteState: (key: string) => state.delete(key),
    log: () => undefined,
  };

  exported = gameRoomHostModule.default.activate(api);

  const runtime = {
    api,
    state,
    protocolCalls,
    messageCalls,
    us1MessageCalls,
    us1SyncCalls,
    dispatchCalls,
    notifications,
    toastCalls,
    selectedRemoteUsers,
    exported,
    enqueueUs1SyncResult(result: Record<string, unknown>) {
      us1SyncQueue.push(result);
    },
    async emitHostContext(context: Record<string, unknown>) {
      runtime.exported.onRoomEvent(context);
      await flushHostTasks();
    },
    async markReady() {
      runtime.exported.onRoomReady();
      await flushHostTasks();
    },
    latestGameState() {
      const latest = notifications
        .filter((entry) => entry.type === "xox-state")
        .at(-1)?.payload?.state as Record<string, unknown> | undefined;
      return latest ?? null;
    },
  };

  activeRuntimes.push(runtime);
  return runtime;
}

test.afterEach(async () => {
  while (activeRuntimes.length > 0) {
    const runtime = activeRuntimes.pop();
    const dispose = runtime?.exported?.dispose;
    if (typeof dispose === "function") {
      await dispose();
    }
  }
});

function buildReadyHostContext(
  target: "ai1" | "ai2" | "us1" = "ai1",
  options: {
    us1RemoteUserId?: string;
    us1Nickname?: string;
    us1Ready?: boolean;
  } = {}
) {
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
      us1: {
        slotId: "us1",
        nickname: options.us1Nickname ?? "Remote Ghost",
        assigned: true,
        connected: options.us1Ready !== false,
        ready: options.us1Ready !== false,
        state: options.us1Ready === false ? "assigned" : "connected",
        remoteUserId: options.us1RemoteUserId ?? "remote@example.com",
      },
    },
  };
}

async function startMatch(
  runtime: HostRuntime,
  options: {
    target?: "ai1" | "ai2" | "us1";
    starter?: "user" | "ai";
    inviteMessage?: string;
  } = {}
) {
  const target = options.target ?? "ai1";
  const starter = options.starter ?? "user";
  await runtime.emitHostContext(buildReadyHostContext(target));
  await runtime.markReady();
  return await runtime.exported.commands.GameRoomXoxStart({
    roomArgs: {
      target,
      starter,
      ...(options.inviteMessage !== undefined
        ? { inviteMessage: options.inviteMessage }
        : {}),
    },
  });
}

async function applyUserMove(runtime: HostRuntime, cell: number) {
  return await runtime.exported.commands.GameRoomXoxUserMove({
    roomArgs: { cell },
  });
}

async function applyAiMove(runtime: HostRuntime, cell: number, provider: "ai1" | "ai2" = "ai1") {
  return await runtime.exported.commands.GameRoomXoxAiMove({
    provider,
    roomArgs: { cell },
  });
}

async function applyRemoteMove(
  runtime: HostRuntime,
  matchId: string,
  cell: number,
  options: {
    remoteUserId?: string;
    turnIndex?: number;
    boardHashBeforeMove?: string;
    transportMessageId?: string;
  } = {}
) {
  return await runtime.exported.commands.GameRoomXoxRemoteMove({
    provider: "us1",
    remoteUserId: options.remoteUserId ?? String(runtime.latestGameState()?.remoteUserId ?? "challenger@example.com"),
    ...(options.transportMessageId !== undefined
      ? { transportMessageId: options.transportMessageId }
      : {}),
    roomArgs: {
      matchId,
      inviteId: matchId,
      cell,
      ...(options.turnIndex !== undefined ? { turnIndex: options.turnIndex } : {}),
      ...(options.boardHashBeforeMove !== undefined
        ? { boardHashBeforeMove: options.boardHashBeforeMove }
        : {}),
    },
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
  assert.match(
    String(runtime.messageCalls[0]?.text ?? ""),
    /\+\+cmd:SlotBridge\(\{"action":"room\.command","payload":\{"commandName":"GameRoomXoxAiMove"/
  );
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

test("game-room host prepends the note only to the first AI protocol dispatch", async () => {
  const runtime = createRoomHostRuntime();
  const startResult = await startMatch(runtime, {
    target: "ai1",
    starter: "user",
    inviteMessage: "Only reply with one command line.",
  });
  const firstUserMoveResult = await applyUserMove(runtime, 0);

  assert.equal(startResult.success, true);
  assert.equal(firstUserMoveResult.success, true);
  assert.equal(runtime.protocolCalls.length, 1);
  assert.equal(runtime.protocolCalls[0]?.preface, "Only reply with one command line.");

  await applyAiMove(runtime, 4, "ai1");
  await applyUserMove(runtime, 1);

  assert.equal(runtime.protocolCalls.length, 1);
});

test("game-room host sends US1 invites with note metadata", async () => {
  const runtime = createRoomHostRuntime();
  const startResult = await startMatch(runtime, {
    target: "us1",
    starter: "user",
    inviteMessage: "Ready for a rematch?",
  });

  assert.equal(startResult.success, true);
  assert.equal(runtime.protocolCalls.length, 0);
  assert.equal(runtime.us1MessageCalls.length, 1);
  assert.equal(runtime.us1MessageCalls[0]?.roomEvent?.eventType, "invite");
  assert.equal(runtime.us1MessageCalls[0]?.roomEvent?.note, "Ready for a rematch?");
  assert.equal(runtime.us1MessageCalls[0]?.roomEvent?.starter, "user");
  assert.match(String(runtime.us1MessageCalls[0]?.text ?? ""), /^Ready for a rematch\?\n\nXOX invite/);
  assert.equal(runtime.latestGameState()?.selectedTarget, "us1");
  assert.equal(runtime.latestGameState()?.pendingInvite?.direction, "outgoing");
  assert.equal(runtime.latestGameState()?.pendingInvite?.note, "Ready for a rematch?");
  assert.equal(runtime.latestGameState()?.matchId, runtime.latestGameState()?.pendingInvite?.matchId);
  assert.equal(runtime.us1MessageCalls[0]?.roomEvent?.matchId, runtime.latestGameState()?.matchId);
});

test("game-room host surfaces synced US1 invites and shows a toast", async () => {
  const runtime = createRoomHostRuntime();
  const inviteEvent = {
    roomId: "game-room",
    featureId: "xox",
    inviteId: "invite-1",
    matchId: "invite-1",
    eventType: "invite",
    starter: "user",
    note: "Your move?",
    remoteUserId: "challenger@example.com",
    localSessionId: "us1-session-remote",
    conversationId: "us1-conversation-remote",
    transportMessageId: "<invite-1@example.test>",
    sentAt: 1700000001000,
    senderNickname: "Challenger",
    senderEmail: "challenger@example.com",
  };

  runtime.enqueueUs1SyncResult({
    roomEvents: [inviteEvent],
    roomInviteInbox: [inviteEvent],
  });
  await runtime.markReady();

  assert.equal(runtime.toastCalls.length, 1);
  assert.match(String(runtime.toastCalls[0]?.message ?? ""), /Challenger/);
  assert.equal((runtime.latestGameState()?.inviteInbox as unknown[]).length, 1);
  assert.equal((runtime.latestGameState()?.inviteInbox as Array<Record<string, unknown>>)[0]?.inviteId, "invite-1");
});

test("game-room host accepts incoming US1 invites and applies synced remote moves", async () => {
  const runtime = createRoomHostRuntime();
  const inviteEntry = {
    roomId: "game-room",
    featureId: "xox",
    inviteId: "invite-accept",
    matchId: "invite-accept",
    remoteUserId: "challenger@example.com",
    nickname: "Challenger",
    senderEmail: "challenger@example.com",
    note: "I will start.",
    starter: "user",
    localSessionId: "challenger-session-1",
    conversationId: "challenger-conversation-1",
    transportMessageId: "<invite-accept@example.test>",
    sentAt: 1700000002000,
  };

  runtime.api.setState("xox-invite-inbox", [inviteEntry]);
  runtime.api.setState(
    "xox-context",
    buildReadyHostContext("us1", {
      us1RemoteUserId: inviteEntry.remoteUserId,
      us1Nickname: inviteEntry.nickname,
    })
  );

  const acceptResult = await runtime.exported.commands.GameRoomXoxAcceptInvite({
    roomArgs: { inviteId: inviteEntry.inviteId },
  });

  assert.equal(acceptResult.success, true);
  assert.deepEqual(runtime.selectedRemoteUsers, ["challenger@example.com"]);
  assert.equal(runtime.us1MessageCalls.length, 1);
  assert.equal(runtime.us1MessageCalls[0]?.roomEvent?.eventType, "accept");
  assert.equal(runtime.us1MessageCalls[0]?.roomEvent?.matchId, "invite-accept");
  assert.equal(runtime.latestGameState()?.selectedTarget, "us1");
  assert.equal(runtime.latestGameState()?.awaitingMoveFrom, "ai");
  assert.equal(runtime.latestGameState()?.matchId, "invite-accept");
  assert.equal(runtime.latestGameState()?.turnIndex, 0);

  runtime.enqueueUs1SyncResult({
    roomCommands: [
      {
        roomId: "game-room",
        featureId: "xox",
        commandName: "GameRoomXoxRemoteMove",
        matchId: "invite-accept",
        turnIndex: 0,
        boardHashBeforeMove: ".........",
        rawArgs:
          '{"matchId":"invite-accept","inviteId":"invite-accept","turnIndex":0,"boardHashBeforeMove":".........","cell":4}',
        commandArgs: {
          matchId: "invite-accept",
          inviteId: "invite-accept",
          turnIndex: 0,
          boardHashBeforeMove: ".........",
          cell: 4,
        },
        remoteUserId: inviteEntry.remoteUserId,
        localSessionId: runtime.latestGameState()?.localSessionId,
        conversationId: "challenger-conversation-1",
        transportMessageId: "<move-accept@example.test>",
        sentAt: 1700000003000,
      },
    ],
  });
  await runtime.emitHostContext(
    buildReadyHostContext("us1", {
      us1RemoteUserId: inviteEntry.remoteUserId,
      us1Nickname: inviteEntry.nickname,
    })
  );

  assert.equal(runtime.dispatchCalls.length, 1);
  assert.equal((runtime.latestGameState()?.board as string[])[4], "X");
  assert.equal(runtime.latestGameState()?.awaitingMoveFrom, "user");
  assert.equal(runtime.latestGameState()?.turnIndex, 1);
  assert.equal(runtime.latestGameState()?.lastRemoteTransportMessageId, "<move-accept@example.test>");
});

test("game-room host sends US1 move metadata with match id, turn index, and board hash", async () => {
  const runtime = createRoomHostRuntime();
  const startResult = await startMatch(runtime, {
    target: "us1",
    starter: "user",
    inviteMessage: "Ready?",
  });

  assert.equal(startResult.success, true);
  const pendingInvite = runtime.latestGameState()?.pendingInvite as Record<string, unknown>;
  runtime.enqueueUs1SyncResult({
    roomEvents: [
      {
        roomId: "game-room",
        featureId: "xox",
        inviteId: pendingInvite.inviteId,
        matchId: pendingInvite.matchId,
        eventType: "accept",
        starter: "user",
        remoteUserId: pendingInvite.remoteUserId,
        localSessionId: runtime.latestGameState()?.localSessionId,
        conversationId: "us1-conversation-1",
        transportMessageId: "<accept-move-meta@example.test>",
        sentAt: 1700000004500,
        senderNickname: pendingInvite.nickname,
        senderEmail: `${pendingInvite.remoteUserId}`,
      },
    ],
  });
  await runtime.emitHostContext(
    buildReadyHostContext("us1", {
      us1RemoteUserId: String(pendingInvite.remoteUserId),
      us1Nickname: String(pendingInvite.nickname),
    })
  );

  const userMoveResult = await applyUserMove(runtime, 0);

  assert.equal(userMoveResult.success, true);
  assert.equal(runtime.us1MessageCalls.length, 2);
  assert.equal(runtime.us1MessageCalls[1]?.roomCommand?.action, "room.command");
  assert.equal(runtime.us1MessageCalls[1]?.roomCommand?.matchId, pendingInvite.matchId);
  assert.equal(runtime.us1MessageCalls[1]?.roomCommand?.turnIndex, 0);
  assert.equal(runtime.us1MessageCalls[1]?.roomCommand?.boardHashBeforeMove, ".........");
  assert.deepEqual(runtime.us1MessageCalls[1]?.roomCommand?.roomPayload, {
    matchId: pendingInvite.matchId,
    inviteId: pendingInvite.matchId,
    turnIndex: 0,
    boardHashBeforeMove: ".........",
    cell: 0,
  });
  assert.match(
    String(runtime.us1MessageCalls[1]?.text ?? ""),
    /\+\+cmd:SlotBridge\(\{"action":"room\.command","payload":\{"commandName":"GameRoomXoxRemoteMove"/
  );
  assert.equal(runtime.latestGameState()?.turnIndex, 1);
});

test("game-room host clears outgoing US1 invites when the remote side rejects them", async () => {
  const runtime = createRoomHostRuntime();
  const startResult = await startMatch(runtime, {
    target: "us1",
    starter: "user",
    inviteMessage: "Ping",
  });

  assert.equal(startResult.success, true);
  const pendingInvite = runtime.latestGameState()?.pendingInvite as Record<string, unknown>;
  runtime.enqueueUs1SyncResult({
    roomEvents: [
      {
        roomId: "game-room",
        featureId: "xox",
        inviteId: pendingInvite.inviteId,
        matchId: pendingInvite.matchId,
        eventType: "reject",
        starter: "user",
        note: "Ping",
        remoteUserId: pendingInvite.remoteUserId,
        localSessionId: runtime.latestGameState()?.localSessionId,
        conversationId: "us1-conversation-1",
        transportMessageId: "<reject@example.test>",
        sentAt: 1700000004000,
        senderNickname: pendingInvite.nickname,
        senderEmail: `${pendingInvite.remoteUserId}`,
      },
    ],
  });
  await runtime.emitHostContext(
    buildReadyHostContext("us1", {
      us1RemoteUserId: String(pendingInvite.remoteUserId),
      us1Nickname: String(pendingInvite.nickname),
    })
  );

  assert.equal(runtime.latestGameState()?.pendingInvite, null);
  assert.equal(runtime.latestGameState()?.inviteId, null);
  assert.equal(runtime.latestGameState()?.result, "idle");
  assert.match(String(runtime.latestGameState()?.status ?? ""), /rejected/);
});

test("game-room host ignores duplicate and stale US1 moves without mutating the board", async () => {
  const runtime = createRoomHostRuntime();
  runtime.api.setState("xox-invite-inbox", [
    {
      roomId: "game-room",
      featureId: "xox",
      inviteId: "invite-replay",
      matchId: "invite-replay",
      remoteUserId: "challenger@example.com",
      nickname: "Challenger",
      starter: "user",
      localSessionId: "challenger-session-replay",
      conversationId: "challenger-conversation-replay",
    },
  ]);
  runtime.api.setState(
    "xox-context",
    buildReadyHostContext("us1", {
      us1RemoteUserId: "challenger@example.com",
      us1Nickname: "Challenger",
    })
  );
  await runtime.exported.commands.GameRoomXoxAcceptInvite({
    roomArgs: { inviteId: "invite-replay" },
  });

  const firstMoveResult = await applyRemoteMove(runtime, "invite-replay", 4, {
    turnIndex: 0,
    boardHashBeforeMove: ".........",
    transportMessageId: "<remote-replay-1@example.test>",
  });
  const duplicateMoveResult = await applyRemoteMove(runtime, "invite-replay", 4, {
    turnIndex: 0,
    boardHashBeforeMove: ".........",
    transportMessageId: "<remote-replay-1@example.test>",
  });
  const staleMoveResult = await applyRemoteMove(runtime, "invite-replay", 8, {
    turnIndex: 0,
    boardHashBeforeMove: ".........",
    transportMessageId: "<remote-replay-2@example.test>",
  });

  assert.equal(firstMoveResult.success, true);
  assert.equal(duplicateMoveResult.success, false);
  assert.match(String(duplicateMoveResult.message ?? ""), /duplicate/i);
  assert.equal(staleMoveResult.success, false);
  assert.match(String(staleMoveResult.message ?? ""), /stale/i);
  assert.equal((runtime.latestGameState()?.board as string[])[4], "X");
  assert.equal((runtime.latestGameState()?.board as string[])[8], "");
  assert.equal(runtime.latestGameState()?.turnIndex, 1);
});

test("game-room host rejects US1 moves from a different remote identity without mutating the board", async () => {
  const runtime = createRoomHostRuntime();
  runtime.api.setState("xox-invite-inbox", [
    {
      roomId: "game-room",
      featureId: "xox",
      inviteId: "invite-identity",
      matchId: "invite-identity",
      remoteUserId: "challenger@example.com",
      nickname: "Challenger",
      starter: "user",
      localSessionId: "challenger-session-identity",
      conversationId: "challenger-conversation-identity",
    },
  ]);
  runtime.api.setState(
    "xox-context",
    buildReadyHostContext("us1", {
      us1RemoteUserId: "challenger@example.com",
      us1Nickname: "Challenger",
    })
  );
  await runtime.exported.commands.GameRoomXoxAcceptInvite({
    roomArgs: {
      inviteId: "invite-identity",
      remoteUserId: "challenger@example.com",
    },
  });

  const wrongIdentityMoveResult = await applyRemoteMove(runtime, "invite-identity", 4, {
    remoteUserId: "intruder@example.com",
    turnIndex: 0,
    boardHashBeforeMove: ".........",
    transportMessageId: "<remote-identity@example.test>",
  });

  assert.equal(wrongIdentityMoveResult.success, false);
  assert.match(String(wrongIdentityMoveResult.message ?? ""), /different opponent/i);
  assert.equal((runtime.latestGameState()?.board as string[])[4], "");
  assert.equal(runtime.latestGameState()?.turnIndex, 0);
  assert.equal(runtime.latestGameState()?.lastRemoteTransportMessageId, null);
});

test("game-room host targets invite rows by remote identity when invite ids collide", async () => {
  const runtime = createRoomHostRuntime();
  const alphaInvite = {
    roomId: "game-room",
    featureId: "xox",
    inviteId: "invite-collision",
    matchId: "invite-collision",
    remoteUserId: "alpha@example.com",
    nickname: "Alpha",
    starter: "user",
    localSessionId: "alpha-session",
    conversationId: "alpha-conversation",
  };
  const betaInvite = {
    roomId: "game-room",
    featureId: "xox",
    inviteId: "invite-collision",
    matchId: "invite-collision",
    remoteUserId: "beta@example.com",
    nickname: "Beta",
    starter: "user",
    localSessionId: "beta-session",
    conversationId: "beta-conversation",
  };
  runtime.api.setState("xox-invite-inbox", [
    alphaInvite,
    betaInvite,
  ]);
  runtime.enqueueUs1SyncResult({
    roomInviteInbox: [alphaInvite],
  });

  const rejectResult = await runtime.exported.commands.GameRoomXoxRejectInvite({
    roomArgs: {
      inviteId: "invite-collision",
      remoteUserId: "beta@example.com",
    },
  });

  assert.equal(rejectResult.success, true);
  assert.equal(runtime.selectedRemoteUsers.at(-1), "beta@example.com");
  assert.equal(runtime.us1MessageCalls.at(-1)?.roomEvent?.eventType, "reject");
  assert.equal(runtime.us1MessageCalls.at(-1)?.roomEvent?.matchId, "invite-collision");
  assert.deepEqual(
    (runtime.api.getState("xox-invite-inbox") as Array<Record<string, unknown>>).map((entry) => entry.remoteUserId),
    ["alpha@example.com"]
  );
});

test("game-room host sends remote reset for active US1 matches and applies inbound remote reset", async () => {
  const runtime = createRoomHostRuntime();
  runtime.api.setState("xox-invite-inbox", [
    {
      roomId: "game-room",
      featureId: "xox",
      inviteId: "invite-reset",
      matchId: "invite-reset",
      remoteUserId: "challenger@example.com",
      nickname: "Challenger",
      starter: "user",
      localSessionId: "challenger-session-reset",
      conversationId: "challenger-conversation-reset",
    },
  ]);
  runtime.api.setState(
    "xox-context",
    buildReadyHostContext("us1", {
      us1RemoteUserId: "challenger@example.com",
      us1Nickname: "Challenger",
    })
  );
  await runtime.exported.commands.GameRoomXoxAcceptInvite({
    roomArgs: {
      inviteId: "invite-reset",
      remoteUserId: "challenger@example.com",
    },
  });

  const resetResult = await runtime.exported.commands.GameRoomXoxReset({});

  assert.equal(resetResult.success, true);
  assert.equal(runtime.us1MessageCalls.at(-1)?.roomEvent?.eventType, "reset");
  assert.equal(runtime.us1MessageCalls.at(-1)?.roomEvent?.matchId, "invite-reset");
  assert.equal(runtime.latestGameState()?.matchId, null);
  assert.equal(runtime.latestGameState()?.active, false);

  runtime.api.setState("xox-invite-inbox", [
    {
      roomId: "game-room",
      featureId: "xox",
      inviteId: "invite-remote-reset",
      matchId: "invite-remote-reset",
      remoteUserId: "challenger@example.com",
      nickname: "Challenger",
      starter: "user",
      localSessionId: "challenger-session-remote-reset",
      conversationId: "challenger-conversation-remote-reset",
    },
  ]);
  await runtime.exported.commands.GameRoomXoxAcceptInvite({
    roomArgs: {
      inviteId: "invite-remote-reset",
      remoteUserId: "challenger@example.com",
    },
  });
  runtime.enqueueUs1SyncResult({
    roomEvents: [
      {
        roomId: "game-room",
        featureId: "xox",
        inviteId: "invite-remote-reset",
        matchId: "invite-remote-reset",
        eventType: "reset",
        remoteUserId: "challenger@example.com",
        localSessionId: runtime.latestGameState()?.localSessionId,
        conversationId: "challenger-conversation-remote-reset",
        transportMessageId: "<remote-reset@example.test>",
        sentAt: 1700000004700,
        senderNickname: "Challenger",
        senderEmail: "challenger@example.com",
      },
    ],
  });
  await runtime.emitHostContext(
    buildReadyHostContext("us1", {
      us1RemoteUserId: "challenger@example.com",
      us1Nickname: "Challenger",
    })
  );

  assert.equal(runtime.latestGameState()?.matchId, null);
  assert.equal(runtime.latestGameState()?.active, false);
  assert.match(String(runtime.latestGameState()?.status ?? ""), /ended/i);
});

test("game-room host blocks the match when the selected opponent disappears mid-game", async () => {
  const runtime = createRoomHostRuntime();
  await startMatch(runtime, { target: "ai1", starter: "user" });
  await applyUserMove(runtime, 0);

  await runtime.emitHostContext({
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
      us1: {
        slotId: "us1",
        nickname: "Remote Ghost",
        assigned: true,
        connected: true,
        ready: true,
        state: "connected",
        remoteUserId: "remote@example.com",
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

test("game-room host rejects mismatched US1 invite ids without mutating the board", async () => {
  const runtime = createRoomHostRuntime();
  runtime.api.setState("xox-invite-inbox", [
    {
      roomId: "game-room",
      featureId: "xox",
      inviteId: "invite-mismatch",
      matchId: "invite-mismatch",
      remoteUserId: "challenger@example.com",
      nickname: "Challenger",
      starter: "user",
      localSessionId: "challenger-session-2",
      conversationId: "challenger-conversation-2",
    },
  ]);
  runtime.api.setState(
    "xox-context",
    buildReadyHostContext("us1", {
      us1RemoteUserId: "challenger@example.com",
      us1Nickname: "Challenger",
    })
  );
  await runtime.exported.commands.GameRoomXoxAcceptInvite({
    roomArgs: {
      inviteId: "invite-mismatch",
      remoteUserId: "challenger@example.com",
    },
  });

  const wrongInviteResult = await applyRemoteMove(runtime, "different-invite", 4);

  assert.equal(wrongInviteResult.success, false);
  assert.equal((runtime.latestGameState()?.board as string[])[4], "");
  assert.equal(runtime.latestGameState()?.awaitingMoveFrom, "ai");
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
