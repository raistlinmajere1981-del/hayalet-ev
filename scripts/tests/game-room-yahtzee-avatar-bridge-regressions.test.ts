import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { runInNewContext } from "node:vm";

type PlayerState = {
  seatId: string;
  label: string;
  avatarSrc?: string | null;
};

type YahtzeeState = {
  players: PlayerState[];
};

type YahtzeeMessage = {
  type: string;
  payload: {
    state: YahtzeeState;
  };
};

type GameRoomContext = {
  activeFeature: { id: string };
  user: { avatar: string | null };
  slots: Record<string, { avatar: string | null }>;
};

void test("Yahtzee bridge projects live Game Room avatars by seat without mutating host state", () => {
  const bridgeSource = readFileSync("rooms/game-room/main-functions/yahtzee/ui/bridge.js", "utf8");
  const handledYahtzeeMessages: YahtzeeMessage[] = [];
  const forwardedBaseMessages: unknown[] = [];
  let currentYahtzeeState: YahtzeeState | null = null;
  let context: GameRoomContext = {
    activeFeature: { id: "yahtzee" },
    user: { avatar: "avatar://user-v1" },
    slots: {
      ai1: { avatar: "avatar://ai1-v1" },
      ai2: { avatar: "avatar://ai2-v1" },
      us1: { avatar: "avatar://us1-v1" },
    },
  };

  const baseRuntime = {
    getState: () => ({ context, translations: null }),
    render: () => undefined,
    handleHostMessage: (message: unknown) => {
      forwardedBaseMessages.push(message);
      const hostContext = message as Partial<GameRoomContext> & { type?: string };
      if (
        hostContext.type === "host-context" &&
        hostContext.activeFeature &&
        hostContext.user &&
        hostContext.slots
      ) {
        context = {
          activeFeature: hostContext.activeFeature,
          user: hostContext.user,
          slots: hostContext.slots,
        };
      }
    },
    start: () => undefined,
  };
  const runtimeRegistry = {
    createGameRoomUiRuntime: () => baseRuntime,
  };
  const windowStub = {
    GameRoomUiRuntime: runtimeRegistry,
    GameRoomYahtzeeUi: {
      handleState: (message: YahtzeeMessage) => {
        handledYahtzeeMessages.push(message);
        currentYahtzeeState = message.payload.state;
      },
      getState: () => currentYahtzeeState,
      render: () => undefined,
      setTranslations: () => undefined,
      dispose: () => undefined,
    },
  };
  const documentStub = {
    getElementById: () => ({ classList: { remove: () => undefined } }),
  };

  runInNewContext(bridgeSource, { window: windowStub, document: documentStub });
  const runtime = runtimeRegistry.createGameRoomUiRuntime();
  const hostState: YahtzeeState = {
    players: [
      { seatId: "user", label: "User" },
      { seatId: "ai1", label: "AI One" },
      { seatId: "ai2", label: "AI Two" },
      { seatId: "us1", label: "Remote" },
      { seatId: "local2", label: "Player Two" },
    ],
  };

  runtime.handleHostMessage({ type: "yahtzee-state", payload: { state: hostState } });

  assert.equal(handledYahtzeeMessages.length, 1);
  const initialPlayers = Object.fromEntries(
    handledYahtzeeMessages[0]!.payload.state.players.map((player) => [player.seatId, player])
  );
  assert.equal(initialPlayers["user"]?.avatarSrc, "avatar://user-v1");
  assert.equal(initialPlayers["ai1"]?.avatarSrc, "avatar://ai1-v1");
  assert.equal(initialPlayers["ai2"]?.avatarSrc, "avatar://ai2-v1");
  assert.equal(initialPlayers["us1"]?.avatarSrc, "avatar://us1-v1");
  assert.equal(Object.hasOwn(initialPlayers["local2"]!, "avatarSrc"), false);
  assert.equal(
    hostState.players.every((player) => Object.hasOwn(player, "avatarSrc") === false),
    true
  );

  runtime.handleHostMessage({
    type: "host-context",
    activeFeature: { id: "yahtzee" },
    user: { avatar: "avatar://user-v2" },
    slots: {
      ai1: { avatar: "avatar://ai1-v2" },
      ai2: { avatar: "avatar://ai2-v2" },
      us1: { avatar: "avatar://us1-v2" },
    },
  });

  assert.equal(forwardedBaseMessages.length, 1);
  assert.equal(handledYahtzeeMessages.length, 2);
  const refreshedPlayers = Object.fromEntries(
    handledYahtzeeMessages[1]!.payload.state.players.map((player) => [player.seatId, player])
  );
  assert.equal(refreshedPlayers["user"]?.avatarSrc, "avatar://user-v2");
  assert.equal(refreshedPlayers["ai1"]?.avatarSrc, "avatar://ai1-v2");
  assert.equal(refreshedPlayers["ai2"]?.avatarSrc, "avatar://ai2-v2");
  assert.equal(refreshedPlayers["us1"]?.avatarSrc, "avatar://us1-v2");
  assert.equal(Object.hasOwn(refreshedPlayers["local2"]!, "avatarSrc"), false);
});
