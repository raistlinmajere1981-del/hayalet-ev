import test from "node:test";
import assert from "node:assert/strict";
import vm from "node:vm";


describe("Tavla render scheduler", () => {
  void test("game-room Tavla UI coalesces Tavla state and command-result renders per frame", () => {
    const harness = createGameRoomUiCoalescingHarness("raf");

    harness.runtime.handleHostMessage({
      type: "backgammon-state",
      payload: {
        state: {
          active: true,
        },
      },
    });
    harness.runtime.handleHostMessage({
      type: "command-result",
      command: "GameRoomBackgammonStart",
      result: {
        success: true,
        message: "Match started.",
      },
    });

    assert.equal(harness.getFrameCount(), 1);
    assert.equal(harness.getRenderAttempts(), 0);
    assert.equal(harness.state.lastCommandMessage, "Match started.");

    harness.flushFrame();

    assert.equal(harness.getFrameCount(), 0);
    assert.equal(harness.getRenderAttempts(), 1);
    assert.equal(harness.state.lastCommandMessage, "Match started.");

    harness.runtime.handleHostMessage({
      type: "backgammon-state",
      payload: {
        state: {
          active: false,
        },
      },
    });
    assert.equal(harness.getFrameCount(), 1);
    harness.flushFrame();
    assert.equal(harness.getRenderAttempts(), 2);
    assert.equal(harness.state.lastCommandMessage, "");
  });
  void test("game-room Tavla UI keeps current final-state semantics when Tavla command-result is stale", () => {
    const harness = createGameRoomUiCoalescingHarness("raf");

    harness.runtime.handleHostMessage({
      type: "command-result",
      command: "GameRoomBackgammonUserMove",
      result: {
        success: false,
        message: "Stale move.",
      },
    });
    harness.runtime.handleHostMessage({
      type: "backgammon-state",
      payload: {
        state: {
          active: true,
        },
      },
    });

    assert.equal(harness.getFrameCount(), 1);
    harness.flushFrame();
    assert.equal(harness.getRenderAttempts(), 1);
    assert.equal(harness.state.lastCommandMessage, "");
  });
  void test("game-room Tavla UI schedules a follow-up frame for state received during render", () => {
    const harness = createGameRoomUiCoalescingHarness("raf");
    let injectedStateDuringRender = false;

    harness.setRenderHook(() => {
      if (injectedStateDuringRender) {
        return;
      }
      injectedStateDuringRender = true;
      harness.runtime.handleHostMessage({
        type: "backgammon-state",
        payload: {
          state: {
            active: true,
            dice: [4, 4, 4, 4],
          },
        },
      });
    });

    harness.runtime.handleHostMessage({
      type: "command-result",
      command: "GameRoomBackgammonStart",
      result: {
        success: true,
        message: "Match started.",
      },
    });

    assert.equal(harness.getFrameCount(), 1);
    harness.flushFrame();

    assert.equal(harness.getRenderAttempts(), 1);
    assert.equal(harness.getFrameCount(), 1);
    assert.deepEqual(harness.state.game["dice"], [4, 4, 4, 4]);
    assert.equal(harness.state.lastCommandMessage, "");

    harness.setRenderHook(null);
    harness.flushFrame();
    assert.equal(harness.getRenderAttempts(), 2);
    assert.equal(harness.getFrameCount(), 0);
  });
  void test("game-room Tavla render scheduler falls back when requestAnimationFrame stalls", () => {
    const harness = createGameRoomUiCoalescingHarness("raf-timeout");

    harness.runtime.handleHostMessage({
      type: "backgammon-state",
      payload: {
        state: {
          active: true,
          dice: [6, 4],
        },
      },
    });

    assert.equal(harness.getFrameCount(), 1);
    assert.equal(harness.getTimerCount(), 1);
    assert.equal(harness.getRenderAttempts(), 0);

    harness.flushTimer();

    assert.equal(harness.getRenderAttempts(), 1);
    assert.equal(harness.getTimerCount(), 0);
    assert.equal(harness.getFrameCount(), 1);

    harness.flushFrame();

    assert.equal(harness.getRenderAttempts(), 1);
    assert.equal(harness.getFrameCount(), 0);
  });
  void test("game-room command-result render scheduling stays scoped to Tavla commands", () => {
    const harness = createGameRoomUiCoalescingHarness("raf");

    harness.runtime.handleHostMessage({
      type: "command-result",
      command: "GameRoomTeamTetrisStart",
      result: {
        success: false,
        message: "Team Tetris setup is incomplete.",
      },
    });

    assert.equal(harness.getFrameCount(), 0);
    assert.equal(harness.getRenderAttempts(), 1);
    assert.equal(harness.state.lastCommandMessage, "Team Tetris setup is incomplete.");
  });
});
