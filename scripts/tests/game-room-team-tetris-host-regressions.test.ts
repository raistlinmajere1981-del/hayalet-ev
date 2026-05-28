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

function loadTeamTetrisEngine() {
  return gameRoomHostModule.teamTetrisEngine as {
    createMatch: (options: Record<string, unknown>) => Record<string, unknown>;
    validateMove: (
      match: Record<string, unknown>,
      move: Record<string, unknown>
    ) => Record<string, unknown>;
    buildTurnToken: (
      matchId: string,
      turnIndex: number,
      seatId: string,
      teamId: string,
      pieceId: string,
      board: string[][]
    ) => string;
  };
}

function findSeedForSeat(
  targetSeatId: "ai1" | "ai2" | "user" | "us1",
  options: {
    hiddenPairs?: boolean;
    selectedPartnerSeatId?: "ai1" | "ai2" | "us1";
  } = {}
): string {
  const engine = loadTeamTetrisEngine();
  for (let index = 0; index < 200; index += 1) {
    const seed = `seed-${targetSeatId}-${index}`;
    const match = engine.createMatch({
      seed,
      hiddenPairs: options.hiddenPairs ?? true,
      ...(options.selectedPartnerSeatId
        ? { selectedPartnerSeatId: options.selectedPartnerSeatId }
        : {}),
    });
    if ((match.currentTurn as Record<string, unknown>).seatId === targetSeatId) {
      return seed;
    }
  }
  throw new Error(`No seed found for ${targetSeatId}`);
}

function findSeedForTurnSequence(sequence: string[]): string {
  const engine = loadTeamTetrisEngine();
  for (let index = 0; index < 400; index += 1) {
    const seed = `sequence-${index}`;
    const match = engine.createMatch({ seed, hiddenPairs: true });
    if (JSON.stringify(match.turnLoop) === JSON.stringify(sequence)) {
      return seed;
    }
  }
  throw new Error(`No seed found for sequence ${sequence.join(",")}`);
}

function buildValidMoveForCurrentTurn(match: Record<string, unknown>) {
  const engine = loadTeamTetrisEngine();
  const currentTurn = match.currentTurn as Record<string, unknown>;
  const legalRotations = Array.isArray(currentTurn.legalRotations)
    ? (currentTurn.legalRotations as number[])
    : [0];

  for (const rotation of legalRotations) {
    for (let steps = 0; steps <= 19; steps += 1) {
      const move = {
        schemaVersion: 1,
        matchId: match.matchId,
        turnIndex: currentTurn.turnIndex,
        turnToken: currentTurn.turnToken,
        pieceId: currentTurn.pieceId,
        rotation,
        rowShifts: Array.from({ length: steps }, () => 0),
      };
      if (engine.validateMove(match, move).success === true) {
        return move;
      }
    }
  }

  throw new Error("No valid move found for current Team Tetris turn");
}

function primeRuntimeMatchWithPiece(
  runtime: HostRuntime,
  pieceId: string,
  configure?: (match: Record<string, unknown>) => void
) {
  const engine = loadTeamTetrisEngine();
  const match = runtime.state.get("team-tetris-game")?.match as Record<string, unknown>;
  const currentTurn = match.currentTurn as Record<string, unknown>;
  const teamId = String(currentTurn.teamId);
  const team = match.teams[teamId] as Record<string, unknown>;

  currentTurn.pieceId = pieceId;
  currentTurn.legalRotations = [0];
  team.nextPieceId = pieceId;
  if (typeof configure === "function") {
    configure(match);
  }
  currentTurn.turnToken = engine.buildTurnToken(
    String(match.matchId),
    Number(currentTurn.turnIndex),
    String(currentTurn.seatId),
    teamId,
    pieceId,
    team.board as string[][]
  );

  return match;
}

function createRoomHostRuntime() {
  const state = new Map();
  const notifications: Array<{ type: string; payload: Record<string, unknown> }> = [];
  const protocolCalls: Array<Record<string, unknown>> = [];
  const messageCalls: Array<Record<string, unknown>> = [];
  const us1MessageCalls: Array<Record<string, unknown>> = [];
  const dispatchCalls: Array<Record<string, unknown>> = [];
  let exported: Record<string, unknown>;

  const api = {
    notifyRoom(type: string, payload: Record<string, unknown> = {}) {
      notifications.push({ type, payload });
    },
    dispatchBridge: async (payload: Record<string, unknown>) => {
      dispatchCalls.push(payload);
      const target =
        typeof payload.toSlot === "string"
          ? payload.toSlot
          : Array.isArray(payload.toSlots) && typeof payload.toSlots[0] === "string"
            ? payload.toSlots[0]
            : null;
      const bridgePayload =
        payload.payload !== null && typeof payload.payload === "object"
          ? (payload.payload as Record<string, unknown>)
          : {};
      const protocol =
        bridgePayload.protocol !== null && typeof bridgePayload.protocol === "object"
          ? (bridgePayload.protocol as Record<string, unknown>)
          : null;

      if (protocol !== null) {
        protocolCalls.push(protocol);
      }

      if (
        target !== "us1" &&
        ((typeof bridgePayload.text === "string" && bridgePayload.text.trim() !== "") ||
          typeof bridgePayload.page === "string")
      ) {
        messageCalls.push({
          provider: target,
          text: bridgePayload.text,
          page: bridgePayload.page,
        });
      }

      if (payload.action === "message.send" && target === "us1") {
        us1MessageCalls.push({
          localSessionId:
            payload.sessionRef !== null &&
            typeof payload.sessionRef === "object" &&
            typeof (payload.sessionRef as Record<string, unknown>).id === "string"
              ? (payload.sessionRef as Record<string, unknown>).id
              : null,
          text: bridgePayload.text,
          roomEvent: bridgePayload.roomEvent,
          roomCommand: bridgePayload.roomCommand,
          remoteUserId: bridgePayload.remoteUserId,
        });
        return {
          success: true,
          session: {
            id: "tt-session-1",
          },
          data: {
            remoteUserId:
              typeof bridgePayload.remoteUserId === "string"
                ? bridgePayload.remoteUserId
                : "remote@example.com",
          },
        };
      }

      return { success: true };
    },
    dispatchRoomCommand: async () => ({ success: false }),
    getUs1Identity: () => ({
      remoteUserId: "remote@example.com",
      nickname: "Remote Ghost",
      email: "remote@example.com",
    }),
    isUs1Connected: () => true,
    showToast: () => undefined,
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
    state,
    notifications,
    protocolCalls,
    messageCalls,
    us1MessageCalls,
    dispatchCalls,
    exported,
    async emitHostContext(context: Record<string, unknown>) {
      runtime.exported.onRoomEvent(context);
      await flushHostTasks();
    },
    latestTeamTetrisState() {
      const latest = notifications.filter((entry) => entry.type === "team-tetris-state").at(-1)
        ?.payload?.state as Record<string, unknown> | undefined;
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

function buildHostContext(
  options: {
    activeFeatureId?: "backgammon" | "team-tetris";
    us1Ready?: boolean;
  } = {}
) {
  const user = {
    nickname: "Raistlin",
  };
  const slots = {
    ai1: {
      slotId: "ai1",
      nickname: "Atlas",
      assigned: true,
      connected: true,
      ready: true,
      state: "connected",
    },
    ai2: {
      slotId: "ai2",
      nickname: "Nova",
      assigned: true,
      connected: true,
      ready: true,
      state: "connected",
    },
    us1: {
      slotId: "us1",
      nickname: "Remote Ghost",
      assigned: true,
      connected: options.us1Ready !== false,
      ready: options.us1Ready !== false,
      state: options.us1Ready === false ? "assigned" : "connected",
      remoteUserId: "remote@example.com",
    },
  };
  return {
    type: "host-context",
    locale: "en",
    room: {
      id: "game-room",
      defaultFeatureId: "backgammon",
    },
    features: [
      {
        id: "backgammon",
        name: "Tavla",
      },
      {
        id: "team-tetris",
        name: "Team Tetris",
      },
    ],
    activeFeature: {
      id: options.activeFeatureId ?? "team-tetris",
      name: options.activeFeatureId === "backgammon" ? "Tavla" : "Team Tetris",
    },
    user,
    slots,
    presence: {
      user: { ...user },
      slots: {
        ai1: { ...slots.ai1 },
        ai2: { ...slots.ai2 },
        us1: { ...slots.us1 },
      },
    },
  };
}

test("game-room host emits Team Tetris bootstrap state from active feature context", async () => {
  const runtime = createRoomHostRuntime();

  await runtime.emitHostContext(buildHostContext({ us1Ready: false }));

  assert.deepEqual(runtime.latestTeamTetrisState()?.["requiredSlots"], {
    ai1: true,
    ai2: true,
    us1: false,
  });
  assert.equal(runtime.latestTeamTetrisState()?.["featureId"], "team-tetris");
  assert.equal(runtime.latestTeamTetrisState()?.["canStart"], false);
});

test("game-room host serializes Team Tetris ids without visible board or seat labels", async () => {
  const runtime = createRoomHostRuntime();

  await runtime.emitHostContext(buildHostContext({ us1Ready: true }));
  const startResult = await runtime.exported.commands.GameRoomTeamTetrisStart({
    provider: "room-ui",
    roomArgs: {
      hiddenPairs: false,
      selectedPartnerSeatId: "ai1",
      seed: findSeedForSeat("user"),
    },
  });

  assert.equal(startResult?.success, true);
  const state = runtime.latestTeamTetrisState() as Record<string, unknown>;
  const boards = state.boards as Array<Record<string, unknown>>;
  const userView = state.userView as Record<string, unknown>;
  const userViewSeat = userView.seat as Record<string, unknown>;
  const revealedTeams = state.teams as Array<Record<string, unknown>>;

  assert.equal("label" in boards[0], false);
  assert.equal("label" in boards[1], false);
  assert.equal("label" in userViewSeat, false);
  assert.equal("label" in revealedTeams[0], false);
  assert.equal("seatLabels" in revealedTeams[0], false);
});

test("game-room host resets Team Tetris state when the active feature switches away", async () => {
  const runtime = createRoomHostRuntime();

  await runtime.emitHostContext(buildHostContext({ us1Ready: true }));
  const startResult = await runtime.exported.commands.GameRoomTeamTetrisStart({
    provider: "room-ui",
    roomArgs: {
      hiddenPairs: false,
      selectedPartnerSeatId: "ai1",
    },
  });

  assert.equal(startResult?.success, true);
  assert.equal(runtime.state.get("team-tetris-game")?.hiddenPairs, false);
  assert.equal(runtime.state.get("team-tetris-game")?.statusKey, "ready");
  assert.ok(runtime.state.get("team-tetris-game")?.match);

  await runtime.emitHostContext(
    buildHostContext({ activeFeatureId: "backgammon", us1Ready: true })
  );

  assert.equal(runtime.state.get("team-tetris-game")?.hiddenPairs, true);
  assert.equal(runtime.state.get("team-tetris-game")?.statusKey, "activeFeatureReset");
});

test("game-room host blocks Team Tetris start until ai1, ai2, and us1 are ready", async () => {
  const runtime = createRoomHostRuntime();

  await runtime.emitHostContext(buildHostContext({ us1Ready: false }));
  const result = await runtime.exported.commands.GameRoomTeamTetrisStart({
    provider: "room-ui",
    roomArgs: {
      hiddenPairs: true,
    },
  });

  assert.equal(result?.success, false);
  assert.match(String(result?.message ?? ""), /AI1, AI2, and US1/);
});

test("game-room host blocks visible Team Tetris setup until a local partner is selected", async () => {
  const runtime = createRoomHostRuntime();

  await runtime.emitHostContext(buildHostContext({ us1Ready: true }));
  const result = await runtime.exported.commands.GameRoomTeamTetrisStart({
    provider: "room-ui",
    roomArgs: {
      hiddenPairs: false,
    },
  });

  assert.equal(result?.success, false);
  assert.match(String(result?.message ?? ""), /partner/i);
});

test("game-room host dispatches Team Tetris AI protocol and turn packet for AI opening seats", async () => {
  const runtime = createRoomHostRuntime();
  const seed = findSeedForSeat("ai1");

  await runtime.emitHostContext(buildHostContext({ us1Ready: true }));
  const startResult = await runtime.exported.commands.GameRoomTeamTetrisStart({
    provider: "room-ui",
    roomArgs: {
      hiddenPairs: true,
      seed,
    },
  });

  assert.equal(startResult?.success, true);
  assert.equal(runtime.protocolCalls.length > 0, true);
  assert.equal(runtime.messageCalls.length > 0, true);
  assert.equal(runtime.protocolCalls[0]?.scenario, "team-tetris-ai-opening");
  const aiOpeningMessage = String(
    runtime.messageCalls.find((entry) => entry.provider === "ai1")?.text ?? ""
  );
  assert.equal(
    runtime.messageCalls.some(
      (entry) =>
        entry.provider === "ai1" && /GameRoomTeamTetrisAiMove/.test(String(entry.text ?? ""))
    ),
    true
  );
  assert.match(aiOpeningMessage, /keeps dropping the piece straight down/i);
  assert.match(aiOpeningMessage, /locks at the last reached step/i);
  assert.match(aiOpeningMessage, /pieceGeometryCatalog/i);
  assert.equal(/"rowShifts":\[0\]\}\}\)/.test(aiOpeningMessage), false);
  assert.equal(
    runtime.messageCalls.some(
      (entry) => entry.provider === "ai2" && /No reply is needed yet/.test(String(entry.text ?? ""))
    ),
    true
  );
});

test("game-room host mirrors Team Tetris starts and local moves over US1 room transport", async () => {
  const runtime = createRoomHostRuntime();
  const seed = findSeedForSeat("user", {
    hiddenPairs: false,
    selectedPartnerSeatId: "us1",
  });

  await runtime.emitHostContext(buildHostContext({ us1Ready: true }));
  const startResult = await runtime.exported.commands.GameRoomTeamTetrisStart({
    provider: "room-ui",
    roomArgs: {
      hiddenPairs: false,
      selectedPartnerSeatId: "us1",
      seed,
    },
  });

  assert.equal(startResult?.success, true);
  assert.equal(runtime.us1MessageCalls[0]?.roomEvent?.eventType, "start");
  assert.match(String(runtime.us1MessageCalls[0]?.text ?? ""), /Creator pair: USER \+ US1\./);
  assert.equal(
    JSON.parse(String(runtime.us1MessageCalls[0]?.roomEvent?.note ?? "{}")).selectedPartnerSeatId,
    "us1"
  );

  const currentMatch = runtime.state.get("team-tetris-game")?.match as Record<string, unknown>;
  const move = buildValidMoveForCurrentTurn(currentMatch);
  const moveResult = await runtime.exported.commands.GameRoomTeamTetrisUserMove({
    provider: "room-ui",
    roomArgs: move,
  });

  assert.equal(moveResult?.success, true);
  assert.equal(runtime.us1MessageCalls[1]?.roomCommand?.action, "room.command");
  assert.equal(
    runtime.us1MessageCalls[1]?.roomCommand?.commandName,
    "GameRoomTeamTetrisRemoteMove"
  );
  assert.deepEqual(runtime.us1MessageCalls[1]?.roomCommand?.roomPayload, move);
  assert.equal(runtime.state.get("team-tetris-game")?.match?.turnIndex, 1);
});

test("game-room host lets a mirrored US1 room-ui turn submit through room transport", async () => {
  const runtime = createRoomHostRuntime();
  const seed = findSeedForSeat("us1");

  await runtime.emitHostContext(buildHostContext({ us1Ready: true }));
  await runtime.exported.commands.GameRoomTeamTetrisStart({
    provider: "room-ui",
    roomArgs: {
      hiddenPairs: true,
      seed,
    },
  });

  const state = runtime.state.get("team-tetris-game") as Record<string, unknown>;
  state.localSeatId = "us1";
  runtime.state.set("team-tetris-game", state);

  const currentMatch = runtime.state.get("team-tetris-game")?.match as Record<string, unknown>;
  const move = buildValidMoveForCurrentTurn(currentMatch);
  const result = await runtime.exported.commands.GameRoomTeamTetrisUserMove({
    provider: "room-ui",
    roomArgs: move,
  });

  assert.equal(result?.success, true);
  assert.equal(
    runtime.us1MessageCalls.at(-1)?.roomCommand?.commandName,
    "GameRoomTeamTetrisRemoteMove"
  );
  assert.equal(runtime.state.get("team-tetris-game")?.match?.turnIndex, 1);
});

test("game-room host lets a mirrored US1 copy apply relayed Team Tetris remote moves for non-US1 turns", async () => {
  const runtime = createRoomHostRuntime();
  const seed = findSeedForSeat("ai1");

  await runtime.emitHostContext(buildHostContext({ us1Ready: true }));
  await runtime.exported.commands.GameRoomTeamTetrisStart({
    provider: "room-ui",
    roomArgs: {
      hiddenPairs: true,
      seed,
    },
  });

  const state = runtime.state.get("team-tetris-game") as Record<string, unknown>;
  state.localSeatId = "us1";
  runtime.state.set("team-tetris-game", state);

  const currentMatch = runtime.state.get("team-tetris-game")?.match as Record<string, unknown>;
  const move = buildValidMoveForCurrentTurn(currentMatch);
  const result = await runtime.exported.commands.GameRoomTeamTetrisRemoteMove({
    provider: "us1",
    roomCommand: "GameRoomTeamTetrisRemoteMove",
    transportMessageId: "mirrored-relay-1",
    roomArgs: move,
  });

  assert.equal(result?.success, true);
  assert.equal(runtime.state.get("team-tetris-game")?.match?.turnIndex, 1);
  assert.equal(
    runtime.state.get("team-tetris-game")?.lastRemoteTransportMessageId,
    "mirrored-relay-1"
  );
});

test("game-room host ignores mirrored US1-caught Team Tetris AI commands without mutating the match", async () => {
  const runtime = createRoomHostRuntime();
  const seed = findSeedForSeat("ai1");

  await runtime.emitHostContext(buildHostContext({ us1Ready: true }));
  await runtime.exported.commands.GameRoomTeamTetrisStart({
    provider: "room-ui",
    roomArgs: {
      hiddenPairs: true,
      seed,
    },
  });

  const state = runtime.state.get("team-tetris-game") as Record<string, unknown>;
  state.localSeatId = "us1";
  runtime.state.set("team-tetris-game", state);

  const beforeTurnIndex = runtime.state.get("team-tetris-game")?.match?.turnIndex;
  const currentMatch = runtime.state.get("team-tetris-game")?.match as Record<string, unknown>;
  const move = buildValidMoveForCurrentTurn(currentMatch);
  const result = await runtime.exported.commands.GameRoomTeamTetrisAiMove({
    provider: "us1",
    roomCommand: "GameRoomTeamTetrisAiMove",
    transportMessageId: "mirrored-catch-1",
    roomArgs: move,
  });

  assert.equal(result?.success, true);
  assert.equal(runtime.state.get("team-tetris-game")?.match?.turnIndex, beforeTurnIndex);
});

test("game-room host selects the followup Team Tetris protocol scenario when a followup AI seat becomes active", async () => {
  const runtime = createRoomHostRuntime();
  const seed = findSeedForTurnSequence(["user", "ai2", "ai1", "us1"]);

  await runtime.emitHostContext(buildHostContext({ us1Ready: true }));
  await runtime.exported.commands.GameRoomTeamTetrisStart({
    provider: "room-ui",
    roomArgs: {
      hiddenPairs: true,
      seed,
    },
  });

  const firstMatch = runtime.state.get("team-tetris-game")?.match as Record<string, unknown>;
  const firstMove = buildValidMoveForCurrentTurn(firstMatch);
  await runtime.exported.commands.GameRoomTeamTetrisUserMove({
    provider: "room-ui",
    roomArgs: firstMove,
  });

  runtime.protocolCalls.length = 0;
  runtime.messageCalls.length = 0;

  const secondMatch = runtime.state.get("team-tetris-game")?.match as Record<string, unknown>;
  const secondMove = buildValidMoveForCurrentTurn(secondMatch);
  await runtime.exported.commands.GameRoomTeamTetrisAiMove({
    provider: "ai2",
    roomArgs: secondMove,
  });

  assert.equal(runtime.protocolCalls[0]?.scenario, "team-tetris-ai-followup");
  assert.equal(runtime.messageCalls[0]?.provider, "ai1");
  assert.match(
    String(runtime.messageCalls[0]?.text ?? ""),
    /visible board intentionally omits your partner's most recent lock/i
  );
  assert.match(String(runtime.messageCalls[0]?.text ?? ""), /"pieceGeometryCatalog"/i);
  assert.match(
    String(runtime.messageCalls[0]?.text ?? ""),
    /"partnerLastPiece"\s*:\s*\{[\s\S]*"cells"\s*:\s*\[\]/i
  );
  assert.doesNotMatch(
    String(runtime.messageCalls[0]?.text ?? ""),
    /A legal reference command for this exact board is:/i
  );
});

test("game-room host blocks Team Tetris when a required seat disconnects mid-match", async () => {
  const runtime = createRoomHostRuntime();
  const seed = findSeedForSeat("user");

  await runtime.emitHostContext(buildHostContext({ us1Ready: true }));
  await runtime.exported.commands.GameRoomTeamTetrisStart({
    provider: "room-ui",
    roomArgs: {
      hiddenPairs: true,
      seed,
    },
  });

  await runtime.emitHostContext(
    buildHostContext({ activeFeatureId: "team-tetris", us1Ready: false })
  );

  assert.equal(runtime.state.get("team-tetris-game")?.result, "blocked");
  assert.equal(runtime.state.get("team-tetris-game")?.statusKey, "blockedOpponent");
});

test("game-room host ignores stale Team Tetris remote moves without mutating the match", async () => {
  const runtime = createRoomHostRuntime();
  const seed = findSeedForSeat("us1");

  await runtime.emitHostContext(buildHostContext({ us1Ready: true }));
  await runtime.exported.commands.GameRoomTeamTetrisStart({
    provider: "room-ui",
    roomArgs: {
      hiddenPairs: true,
      seed,
    },
  });

  const beforeMatch = runtime.state.get("team-tetris-game")?.match as Record<string, unknown>;
  const beforeTurnToken = String((beforeMatch.currentTurn as Record<string, unknown>).turnToken);
  const result = await runtime.exported.commands.GameRoomTeamTetrisRemoteMove({
    provider: "us1",
    transportMessageId: "stale-remote-1",
    roomArgs: {
      schemaVersion: 1,
      matchId: beforeMatch.matchId,
      turnIndex: (beforeMatch.currentTurn as Record<string, unknown>).turnIndex,
      turnToken: `${beforeTurnToken}-stale`,
      pieceId: (beforeMatch.currentTurn as Record<string, unknown>).pieceId,
      rotation: 0,
      rowShifts: [],
    },
  });

  assert.equal(result?.success, false);
  assert.match(String(result?.message ?? ""), /stale/i);
  assert.equal(runtime.state.get("team-tetris-game")?.result, "pending");
  assert.equal(runtime.state.get("team-tetris-game")?.match?.turnIndex, beforeMatch.turnIndex);
});

test("game-room host ignores duplicate Team Tetris remote moves after the turn has advanced", async () => {
  const runtime = createRoomHostRuntime();
  const seed = findSeedForSeat("us1");

  await runtime.emitHostContext(buildHostContext({ us1Ready: true }));
  await runtime.exported.commands.GameRoomTeamTetrisStart({
    provider: "room-ui",
    roomArgs: {
      hiddenPairs: true,
      seed,
    },
  });

  const firstMatch = runtime.state.get("team-tetris-game")?.match as Record<string, unknown>;
  const firstMove = buildValidMoveForCurrentTurn(firstMatch);
  const applied = await runtime.exported.commands.GameRoomTeamTetrisRemoteMove({
    provider: "us1",
    transportMessageId: "duplicate-remote-1",
    roomArgs: firstMove,
  });
  const turnIndexAfterMove = runtime.state.get("team-tetris-game")?.match?.turnIndex;

  const duplicate = await runtime.exported.commands.GameRoomTeamTetrisRemoteMove({
    provider: "us1",
    transportMessageId: "duplicate-remote-1",
    roomArgs: firstMove,
  });

  assert.equal(applied?.success, true);
  assert.equal(duplicate?.success, false);
  assert.match(String(duplicate?.message ?? ""), /duplicate/i);
  assert.equal(runtime.state.get("team-tetris-game")?.match?.turnIndex, turnIndexAfterMove);
});

test("game-room host blocks invalid Team Tetris AI payloads and preserves the blocked result", async () => {
  const runtime = createRoomHostRuntime();
  const seed = findSeedForSeat("ai1");

  await runtime.emitHostContext(buildHostContext({ us1Ready: true }));
  await runtime.exported.commands.GameRoomTeamTetrisStart({
    provider: "room-ui",
    roomArgs: {
      hiddenPairs: true,
      seed,
    },
  });

  const match = primeRuntimeMatchWithPiece(runtime, "O");
  const currentTurn = match.currentTurn as Record<string, unknown>;
  const result = await runtime.exported.commands.GameRoomTeamTetrisAiMove({
    provider: "ai1",
    roomArgs: {
      schemaVersion: 1,
      matchId: match.matchId,
      turnIndex: currentTurn.turnIndex,
      turnToken: currentTurn.turnToken,
      pieceId: "O",
      rotation: 1,
      rowShifts: [],
    },
  });

  assert.equal(result?.success, false);
  assert.match(String(result?.message ?? ""), /invalid/i);
  assert.equal(runtime.state.get("team-tetris-game")?.result, "blocked");
  assert.equal(runtime.state.get("team-tetris-game")?.statusKey, "blockedInvalidMove");
});

test("game-room host returns Team Tetris move resolution details in test mode", async () => {
  const runtime = createRoomHostRuntime();
  const seed = findSeedForSeat("user");

  await runtime.emitHostContext(buildHostContext({ us1Ready: true }));
  await runtime.exported.commands.GameRoomTeamTetrisStart({
    provider: "room-ui",
    roomArgs: {
      hiddenPairs: true,
      seed,
    },
  });

  const currentMatch = runtime.state.get("team-tetris-game")?.match as Record<string, unknown>;
  const successMove = buildValidMoveForCurrentTurn(currentMatch);
  const successResult = await runtime.exported.commands.GameRoomTeamTetrisUserMove({
    provider: "room-ui",
    testMode: true,
    roomArgs: successMove,
  });

  assert.equal(successResult?.success, true);
  assert.deepEqual(Array.isArray(successResult?.debug?.resolvedPath), true);
  assert.deepEqual(Array.isArray(successResult?.debug?.finalLockCells), true);
  assert.equal(typeof successResult?.debug?.finalRotation, "number");
  assert.equal(successResult?.debug?.rejectReason, null);

  const blockedRuntime = createRoomHostRuntime();
  const blockedSeed = findSeedForSeat("ai1");

  await blockedRuntime.emitHostContext(buildHostContext({ us1Ready: true }));
  await blockedRuntime.exported.commands.GameRoomTeamTetrisStart({
    provider: "room-ui",
    roomArgs: {
      hiddenPairs: true,
      seed: blockedSeed,
    },
  });

  const blockedMatch = primeRuntimeMatchWithPiece(blockedRuntime, "O");
  const blockedTurn = blockedMatch.currentTurn as Record<string, unknown>;
  const failureResult = await blockedRuntime.exported.commands.GameRoomTeamTetrisAiMove({
    provider: "ai1",
    testMode: true,
    roomArgs: {
      schemaVersion: 1,
      matchId: blockedMatch.matchId,
      turnIndex: blockedTurn.turnIndex,
      turnToken: blockedTurn.turnToken,
      pieceId: "O",
      rotation: 1,
      rowShifts: [],
    },
  });

  assert.equal(failureResult?.success, false);
  assert.equal(failureResult?.debug?.rejectReason, "invalid-rotation");
  assert.equal(failureResult?.debug?.collisionStep, null);
});

test("game-room host reveals hidden Team Tetris pairs once a hidden-pair match ends", async () => {
  const runtime = createRoomHostRuntime();
  const seed = findSeedForSeat("user");

  await runtime.emitHostContext(buildHostContext({ us1Ready: true }));
  await runtime.exported.commands.GameRoomTeamTetrisStart({
    provider: "room-ui",
    roomArgs: {
      hiddenPairs: true,
      seed,
    },
  });

  const match = primeRuntimeMatchWithPiece(runtime, "O", (currentMatch) => {
    const currentTurn = currentMatch.currentTurn as Record<string, unknown>;
    const team = currentMatch.teams[String(currentTurn.teamId)] as Record<string, unknown>;
    const board = team.board as string[][];
    board[2][4] = "J";
    board[2][5] = "J";
    (team.bagState as Record<string, unknown>).bag = ["I"];
    (team.bagState as Record<string, unknown>).index = 0;
  });

  const currentTurn = match.currentTurn as Record<string, unknown>;
  const result = await runtime.exported.commands.GameRoomTeamTetrisUserMove({
    provider: "room-ui",
    roomArgs: {
      schemaVersion: 1,
      matchId: match.matchId,
      turnIndex: currentTurn.turnIndex,
      turnToken: currentTurn.turnToken,
      pieceId: "O",
      rotation: 0,
      rowShifts: [],
    },
  });

  assert.equal(result?.success, true);
  assert.equal(runtime.state.get("team-tetris-game")?.match?.revealedPairs, true);
  assert.ok(Array.isArray(runtime.latestTeamTetrisState()?.["teams"]));
});
