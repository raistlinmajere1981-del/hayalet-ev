import assert from "node:assert/strict";
import test from "node:test";
import { loadGameRoomHostModule } from "./helpers/game-room-host-module.ts";

const gameRoomHostModule = await loadGameRoomHostModule();

interface TeamTetrisEngine {
  createMatch(options: Record<string, unknown>): Record<string, unknown>;
  validateMove(
    match: Record<string, unknown>,
    move: Record<string, unknown>
  ): Record<string, unknown>;
}

function getEngine(): TeamTetrisEngine {
  return gameRoomHostModule.teamTetrisEngine as unknown as TeamTetrisEngine;
}

function findSeedForFirstSeat(targetSeatId: string): string {
  const engine = getEngine();
  for (let index = 0; index < 500; index += 1) {
    const seed = `ai0-first-seat-${index}`;
    const match = engine.createMatch({ seed, hiddenPairs: true });
    const currentTurn = match["currentTurn"] as Record<string, unknown> | null;
    if (currentTurn?.["seatId"] === targetSeatId) {
      return seed;
    }
  }
  throw new Error(`No Team Tetris seed found for first seat ${targetSeatId}`);
}

function buildValidMove(match: Record<string, unknown>): Record<string, unknown> {
  const engine = getEngine();
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

  throw new Error("No valid move found for AI0 Team Tetris turn");
}

function buildHostContext(options: { ai0Ready: boolean; us1Ready: boolean }) {
  const user = { nickname: "Local User", avatar: null };
  const assistant = {
    participantId: "ai0",
    slotId: "ai0",
    label: "AI0",
    nickname: "Rovo",
    avatar: null,
    assigned: true,
    connected: options.ai0Ready,
    ready: options.ai0Ready,
    state: options.ai0Ready ? "connected" : "assigned",
    urlExcluded: false,
    providerId: "opencode-ui",
    accountId: "assistant-test",
    remoteUserId: null,
  };
  const slots = {
    ai1: {
      slotId: "ai1",
      nickname: "Nexa",
      assigned: true,
      connected: true,
      ready: true,
      state: "connected",
      urlExcluded: false,
    },
    ai2: {
      slotId: "ai2",
      nickname: "Gok",
      assigned: true,
      connected: true,
      ready: true,
      state: "connected",
      urlExcluded: false,
    },
    us1: {
      slotId: "us1",
      nickname: "Remote User",
      assigned: true,
      connected: options.us1Ready,
      ready: options.us1Ready,
      state: options.us1Ready ? "connected" : "assigned",
      urlExcluded: false,
      remoteUserId: "remote@example.test",
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
      { id: "backgammon", name: "Tavla" },
      { id: "team-tetris", name: "Team Tetris" },
    ],
    activeFeature: {
      id: "team-tetris",
      name: "Team Tetris",
    },
    user,
    assistant,
    slots,
    presence: {
      user: { ...user },
      assistant: { ...assistant },
      slots: {
        ai1: { ...slots.ai1 },
        ai2: { ...slots.ai2 },
        us1: { ...slots.us1 },
      },
    },
  };
}

void test("Team Tetris uses AI0 when US1 is unavailable and keeps that source locked", async () => {
  const state = new Map<string, unknown>();
  const notifications: Array<{ type: string; payload: Record<string, unknown> }> = [];
  const dispatchCalls: Array<Record<string, unknown>> = [];

  const api = {
    notifyRoom(type: string, payload: Record<string, unknown> = {}) {
      notifications.push({ type, payload });
    },
    async dispatchBridge(payload: Record<string, unknown>) {
      dispatchCalls.push(payload);
      const action = typeof payload["action"] === "string" ? payload["action"] : "";
      const target = typeof payload["toSlot"] === "string" ? payload["toSlot"] : "";

      if (action === "message.sendWait" && target === "ai0") {
        const gameState = state.get("team-tetris-game") as Record<string, unknown>;
        const match = gameState["match"] as Record<string, unknown>;
        return {
          success: true,
          reply: {
            text: JSON.stringify(buildValidMove(match)),
          },
        };
      }

      if (action === "message.send" && target === "us1") {
        return {
          success: true,
          session: { id: "remote-team-tetris-session" },
          data: { remoteUserId: "remote@example.test" },
        };
      }

      return { success: true };
    },
    dispatchRoomCommand: () => ({ success: false }),
    getUs1Identity: () => ({
      remoteUserId: "remote@example.test",
      nickname: "Remote User",
      email: "remote@example.test",
    }),
    isUs1Connected: () => false,
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

  const exported = gameRoomHostModule.default.activate(api) as Record<string, unknown>;
  const onRoomEvent = exported["onRoomEvent"] as (payload: unknown) => void;
  const commands = exported["commands"] as Record<
    string,
    (payload: Record<string, unknown>) => Promise<Record<string, unknown>>
  >;

  try {
    onRoomEvent(buildHostContext({ ai0Ready: true, us1Ready: false }));

    const bootstrapState = notifications
      .filter((entry) => entry.type === "team-tetris-state")
      .at(-1)?.payload["state"] as Record<string, unknown>;
    assert.equal(bootstrapState["canStart"], true);
    assert.equal(bootstrapState["fourthSeatSource"], "ai0");
    assert.deepEqual(bootstrapState["requiredSlots"], {
      ai1: true,
      ai2: true,
      us1: true,
    });

    const start = commands["GameRoomTeamTetrisStart"];
    assert.equal(typeof start, "function");
    const result = await start!({
      provider: "room-ui",
      roomArgs: {
        hiddenPairs: true,
        seed: findSeedForFirstSeat("us1"),
      },
    });

    assert.equal(result["success"], true);
    assert.equal(
      dispatchCalls.some(
        (call) => call["action"] === "message.sendWait" && call["toSlot"] === "ai0"
      ),
      true
    );
    assert.equal(
      dispatchCalls.some(
        (call) => call["action"] === "message.send" && call["toSlot"] === "us1"
      ),
      false
    );

    const activeState = state.get("team-tetris-game") as Record<string, unknown>;
    assert.equal(activeState["fourthSeatSource"], "ai0");
    assert.equal(activeState["remoteUserId"], null);
    const activeMatch = activeState["match"] as Record<string, unknown>;
    assert.equal(Number(activeMatch["turnIndex"]) >= 1, true);

    onRoomEvent(buildHostContext({ ai0Ready: false, us1Ready: true }));

    const blockedState = state.get("team-tetris-game") as Record<string, unknown>;
    assert.equal(blockedState["fourthSeatSource"], "ai0");
    assert.equal(blockedState["result"], "blocked");
    assert.equal(blockedState["blockedReason"], "required-seat-unavailable");
  } finally {
    const dispose = exported["dispose"];
    if (typeof dispose === "function") {
      await Promise.resolve((dispose as () => unknown)());
    }
  }
});
