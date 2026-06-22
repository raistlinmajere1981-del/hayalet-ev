import test from "node:test";
import assert from "node:assert/strict";
import { loadGameRoomHostModule } from "./helpers/game-room-host-module.ts";

const gameRoomHostModule = await loadGameRoomHostModule();

interface TetrisHostRuntime {
  state: Map<string, unknown>;
  notifications: Array<{ type: string; payload: Record<string, unknown> }>;
  protocolCalls: Array<Record<string, unknown>>;
  messageCalls: Array<Record<string, unknown>>;
  us1MessageCalls: Array<Record<string, unknown>>;
  dispatchCalls: Array<Record<string, unknown>>;
  exported: Record<string, unknown>;
  emitHostContext: (context: Record<string, unknown>) => Promise<void>;
  latestTeamTetrisState: () => Record<string, unknown> | null;
}

type HostRuntime = TetrisHostRuntime;

const activeRuntimes: TetrisHostRuntime[] = [];

async function flushHostTasks(): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, 0));
  await new Promise((resolve) => setTimeout(resolve, 0));
}

function str(v: unknown): string {
  return typeof v === "string" ? v : String(v);
}

function getGameState(
  runtime: TetrisHostRuntime
): Record<string, unknown> | undefined {
  return runtime.state.get("team-tetris-game") as Record<string, unknown> | undefined;
}

function hostCommands(
  runtime: TetrisHostRuntime
): Record<string, (args: Record<string, unknown>) => Record<string, unknown> | Promise<Record<string, unknown>>> {
  return runtime.exported["commands"] as Record<
    string,
    (args: Record<string, unknown>) => Record<string, unknown> | Promise<Record<string, unknown>>
  >;
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
      ...(options.selectedPartnerSeatId != null
        ? { selectedPartnerSeatId: options.selectedPartnerSeatId }
        : {}),
    });
    if ((match["currentTurn"] as Record<string, unknown>)["seatId"] === targetSeatId) {
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
    if (JSON.stringify(match["turnLoop"]) === JSON.stringify(sequence)) {
      return seed;
    }
  }
  throw new Error(`No seed found for sequence ${sequence.join(",")}`);
}

function buildValidMoveForCurrentTurn(match: Record<string, unknown>) {
  const engine = loadTeamTetrisEngine();
  const currentTurn = match["currentTurn"] as Record<string, unknown>;
  const legalRotations = Array.isArray(currentTurn["legalRotations"])
    ? (currentTurn["legalRotations"] as number[])
    : [0];

  for (const rotation of legalRotations) {
    for (let steps = 0; steps <= 19; steps += 1) {
      const move = {
        schemaVersion: 1,
        matchId: match["matchId"],
        turnIndex: currentTurn["turnIndex"],
        turnToken: currentTurn["turnToken"],
        pieceId: currentTurn["pieceId"],
        rotation,
        rowShifts: Array.from({ length: steps }, () => 0),
      };
      if (engine.validateMove(match, move)["success"] === true) {
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
  const match = getGameState(runtime)?.["match"] as Record<string, unknown>;
  const currentTurn = match["currentTurn"] as Record<string, unknown>;
  const teamId = String((currentTurn as Record<string, string>)["teamId"]);
  const team = (match["teams"] as Record<string, unknown>)[teamId] as Record<string, unknown>;

  currentTurn["pieceId"] = pieceId;
  currentTurn["legalRotations"] = [0];
  team["nextPieceId"] = pieceId;
  if (typeof configure === "function") {
    configure(match);
  }
  currentTurn["turnToken"] = engine.buildTurnToken(
    String(match["matchId"]),
    Number(currentTurn["turnIndex"]),
    String(currentTurn["seatId"]),
    teamId,
    pieceId,
    team["board"] as string[][]
  );

  return match;
}

function createRoomHostRuntime(): TetrisHostRuntime {
  const state = new Map<string, unknown>();
  const notifications: Array<{ type: string; payload: Record<string, unknown> }> = [];
  const protocolCalls: Array<Record<string, unknown>> = [];
  const messageCalls: Array<Record<string, unknown>> = [];
  const us1MessageCalls: Array<Record<string, unknown>> = [];
  const dispatchCalls: Array<Record<string, unknown>> = [];
  const api = {
    notifyRoom(type: string, payload: Record<string, unknown> = {}) {
      notifications.push({ type, payload });
    },
    dispatchBridge: (payload: Record<string, unknown>) => {
      dispatchCalls.push(payload);
      const target =
        typeof payload["toSlot"] === "string"
          ? payload["toSlot"]
          : Array.isArray(payload["toSlots"]) && typeof payload["toSlots"][0] === "string"
            ? payload["toSlots"][0]
            : null;
      const bridgePayload =
        payload["payload"] !== null && typeof payload["payload"] === "object"
          ? (payload["payload"] as Record<string, unknown>)
          : {};
      const protocol =
        bridgePayload["protocol"] !== null && typeof bridgePayload["protocol"] === "object"
          ? (bridgePayload["protocol"] as Record<string, unknown>)
          : null;

      if (protocol !== null) {
        protocolCalls.push(protocol);
      }

      if (
        target !== "us1" &&
        ((typeof bridgePayload["text"] === "string" && bridgePayload["text"].trim() !== "") ||
          typeof bridgePayload["page"] === "string")
      ) {
        messageCalls.push({
          provider: target,
          text: bridgePayload["text"],
          page: bridgePayload["page"],
        });
      }

      if (payload["action"] === "message.send" && target === "us1") {
        us1MessageCalls.push({
          localSessionId:
            payload["sessionRef"] !== null &&
            typeof payload["sessionRef"] === "object" &&
            typeof (payload["sessionRef"] as Record<string, unknown>)["id"] === "string"
              ? (payload["sessionRef"] as Record<string, unknown>)["id"]
              : null,
          text: bridgePayload["text"],
          roomEvent: bridgePayload["roomEvent"],
          roomCommand: bridgePayload["roomCommand"],
          remoteUserId: bridgePayload["remoteUserId"],
        });
        return {
          success: true,
          session: {
            id: "tt-session-1",
          },
          data: {
            remoteUserId:
              typeof bridgePayload["remoteUserId"] === "string"
                ? bridgePayload["remoteUserId"]
                : "remote@example.com",
          },
        };
      }

      return { success: true };
    },
    dispatchRoomCommand: () => ({ success: false }),
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

  const exported: Record<string, unknown> = gameRoomHostModule.default.activate(api);

  const runtime = {
    state,
    notifications,
    protocolCalls,
    messageCalls,
    us1MessageCalls,
    dispatchCalls,
    exported,
    async emitHostContext(context: Record<string, unknown>) {
      (runtime.exported["onRoomEvent"] as (ctx: Record<string, unknown>) => void)(context);
      await flushHostTasks();
    },
    latestTeamTetrisState() {
      const tail: Record<string, unknown> | undefined = notifications.filter((entry) => entry.type === "team-tetris-state").at(-1);
      const latest = (tail?.["payload"] as Record<string, unknown> | undefined)?.["state"] as Record<string, unknown> | undefined;
      return latest ?? null;
    },
  };

  activeRuntimes.push(runtime);
  return runtime;
}

test.afterEach(async () => {
  const results: Array<Promise<void>> = [];
  for (const runtime of activeRuntimes.splice(0)) {
    const dispose = runtime.exported["dispose"];
    if (typeof dispose === "function") {
      results.push(Promise.resolve((dispose as () => unknown)()) as Promise<void>);
    }
  }
  await Promise.all(results);
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


describe("game-room host lets a mirrored US1 copy apply relayed Team Tetris remote moves f", () => {
void test("game-room host lets a mirrored US1 copy apply relayed Team Tetris remote moves for non-US1 turns", async () => {
  const runtime = createRoomHostRuntime();
  const seed = findSeedForSeat("ai1");

  await runtime.emitHostContext(buildHostContext({ us1Ready: true }));
  await (hostCommands(runtime)['GameRoomTeamTetrisStart'] as (...args: unknown[]) => Record<string, unknown>)({
    provider: "room-ui",
    roomArgs: {
      hiddenPairs: true,
      seed,
    },
  });

  const state = getGameState(runtime) as Record<string, unknown>;
  state["localSeatId"] = "us1";
  runtime.state.set("team-tetris-game", state);

  const currentMatch = getGameState(runtime)?.["match"] as Record<string, unknown>;
  const move = buildValidMoveForCurrentTurn(currentMatch);
  const result = await (hostCommands(runtime)['GameRoomTeamTetrisRemoteMove'] as (...args: unknown[]) => Record<string, unknown>)({
    provider: "us1",
    roomCommand: "GameRoomTeamTetrisRemoteMove",
    transportMessageId: "mirrored-relay-1",
    roomArgs: move,
  });

  assert.equal(result['success'], true);
  assert.equal((getGameState(runtime)?.["match"] as Record<string, unknown> | undefined)?.["turnIndex"], 1);
  assert.equal(
    getGameState(runtime)?.["lastRemoteTransportMessageId"],
    "mirrored-relay-1"
  );
});
void test("game-room host ignores mirrored US1-caught Team Tetris AI commands without mutating the match", async () => {
  const runtime = createRoomHostRuntime();
  const seed = findSeedForSeat("ai1");

  await runtime.emitHostContext(buildHostContext({ us1Ready: true }));
  await (hostCommands(runtime)['GameRoomTeamTetrisStart'] as (...args: unknown[]) => Record<string, unknown>)({
    provider: "room-ui",
    roomArgs: {
      hiddenPairs: true,
      seed,
    },
  });

  const state = getGameState(runtime) as Record<string, unknown>;
  state["localSeatId"] = "us1";
  runtime.state.set("team-tetris-game", state);

  const beforeTurnIndex: unknown = (getGameState(runtime)?.["match"] as Record<string, unknown> | undefined)?.["turnIndex"];
  const currentMatch = getGameState(runtime)?.["match"] as Record<string, unknown>;
  const move = buildValidMoveForCurrentTurn(currentMatch);
  const result = await (hostCommands(runtime)['GameRoomTeamTetrisAiMove'] as (...args: unknown[]) => Record<string, unknown>)({
    provider: "us1",
    roomCommand: "GameRoomTeamTetrisAiMove",
    transportMessageId: "mirrored-catch-1",
    roomArgs: move,
  });

  assert.equal(result['success'], true);
  assert.equal((getGameState(runtime)?.["match"] as Record<string, unknown> | undefined)?.["turnIndex"], beforeTurnIndex);
});
void test("game-room host selects the followup Team Tetris protocol scenario when a followup AI seat becomes active", async () => {
  const runtime = createRoomHostRuntime();
  const seed = findSeedForTurnSequence(["user", "ai2", "ai1", "us1"]);

  await runtime.emitHostContext(buildHostContext({ us1Ready: true }));
  await (hostCommands(runtime)['GameRoomTeamTetrisStart'] as (...args: unknown[]) => Record<string, unknown>)({
    provider: "room-ui",
    roomArgs: {
      hiddenPairs: true,
      seed,
    },
  });

  const firstMatch = getGameState(runtime)?.["match"] as Record<string, unknown>;
  const firstMove = buildValidMoveForCurrentTurn(firstMatch);
  await (hostCommands(runtime)['GameRoomTeamTetrisUserMove'] as (...args: unknown[]) => Record<string, unknown>)({
    provider: "room-ui",
    roomArgs: firstMove,
  });

  runtime.protocolCalls.length = 0;
  runtime.messageCalls.length = 0;

  const secondMatch = getGameState(runtime)?.["match"] as Record<string, unknown>;
  const secondMove = buildValidMoveForCurrentTurn(secondMatch);
  await (hostCommands(runtime)['GameRoomTeamTetrisAiMove'] as (...args: unknown[]) => Record<string, unknown>)({
    provider: "ai2",
    roomArgs: secondMove,
  });

  assert.equal((runtime.protocolCalls[0] as Record<string, unknown>)["scenario"], "team-tetris-ai-followup");
  assert.equal((runtime.messageCalls[0] as Record<string, unknown>)["provider"], "ai1");
  assert.match(
    str((runtime.messageCalls[0] as Record<string, unknown>)["text"] ?? ""),
    /visible board intentionally omits your partner's most recent lock/i
  );
  assert.match(str((runtime.messageCalls[0] as Record<string, unknown>)["text"] ?? ""), /"pieceGeometryCatalog"/i);
  assert.match(
    str((runtime.messageCalls[0] as Record<string, unknown>)["text"] ?? ""),
    /"partnerLastPiece"\s*:\s*\{[\s\S]*"cells"\s*:\s*\[\]/i
  );
  assert.doesNotMatch(
    str((runtime.messageCalls[0] as Record<string, unknown>)["text"] ?? ""),
    /A legal reference command for this exact board is:/i
  );
});
void test("game-room host blocks Team Tetris when a required seat disconnects mid-match", async () => {
  const runtime = createRoomHostRuntime();
  const seed = findSeedForSeat("user");

  await runtime.emitHostContext(buildHostContext({ us1Ready: true }));
  await (hostCommands(runtime)['GameRoomTeamTetrisStart'] as (...args: unknown[]) => Record<string, unknown>)({
    provider: "room-ui",
    roomArgs: {
      hiddenPairs: true,
      seed,
    },
  });

  await runtime.emitHostContext(
    buildHostContext({ activeFeatureId: "team-tetris", us1Ready: false })
  );

  assert.equal(getGameState(runtime)?.["result"], "blocked");
  assert.equal(getGameState(runtime)?.["statusKey"], "blockedOpponent");
});
});
