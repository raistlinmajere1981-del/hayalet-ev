import test from "node:test";
import assert from "node:assert/strict";
import vm from "node:vm";

import { loadWorkspaceScriptForVm } from "./helpers/room-workspace-script.ts";

describe("Tavla Konva stage rendering", () => {
  void test("game-room Tavla Konva stage reuses layers for selection-only redraws", () => {
    resetFakeKonva();
    const windowObject: Record<string, unknown> = {
      GameRoomUiFactories: {},
      Konva: {
        Stage: FakeKonvaStage,
        Layer: FakeKonvaLayer,
        Group: FakeKonvaGroup,
        Rect: FakeKonvaNode,
        Line: FakeKonvaNode,
        Circle: FakeKonvaNode,
        Text: FakeKonvaNode,
      },
    };
    const context = {
      document: { documentElement: {} },
      getComputedStyle: () => ({
        getPropertyValue: () => "",
      }),
      globalThis: windowObject,
      window: windowObject,
    };
    vm.createContext(context);
    vm.runInNewContext(
      loadWorkspaceScriptForVm(
        "rooms/game-room/main-functions/backgammon/ui/backgammon-stage-runtime.ts"
      ),
      context
    );

    const registry = windowObject["GameRoomUiFactories"] as Record<string, unknown>;
    const createStageRuntime = registry["createBackgammonStageRuntime"];
    assert.equal(typeof createStageRuntime, "function");
    const legalMoves = [
      {
        id: "move-1",
        label: "1-2-3",
        diceUsed: [1, 1],
        moves: [
          {
            from: { type: "point", point: 1 },
            to: { type: "point", point: 2 },
            die: 1,
            hit: false,
          },
          {
            from: { type: "point", point: 2 },
            to: { type: "point", point: 3 },
            die: 1,
            hit: false,
          },
        ],
      },
    ];
    const board = Array.from({ length: 24 }, (_value, index) => ({
      point: index + 1,
      owner: index === 0 ? "user" : "",
      count: index === 0 ? 1 : 0,
    }));
    const game = {
      active: true,
      awaitingMoveFrom: "user",
      blockedReason: "",
      board,
      bar: { user: 0, ai: 0 },
      off: { user: 0, ai: 0 },
      dice: [1, 1],
      legalMoves,
      turnIndex: 1,
      turnToken: "turn-1",
      boardHash: "board-1",
    };
    const selectedMoveIds: string[] = [];
    const stageRuntime = (
      createStageRuntime as (deps: Record<string, unknown>) => {
        renderBackgammonStage(host: FakeStageHost, options: Record<string, unknown>): void;
      }
    )({
      createElement: (tagName: string, className = "", textContent = "") =>
        new MinimalFakeElement(tagName, className, textContent),
      getState: () => ({ game }),
      stateRuntime: {
        onLegalMove: (moveId: string) => {
          selectedMoveIds.push(moveId);
        },
      },
      text: (path: string[]) => path.at(-1) ?? "",
    });
    const host = new FakeStageHost();

    stageRuntime.renderBackgammonStage(host, {
      canUserMove: true,
      game,
      players: {
        user: { name: "User", avatar: null, active: true },
        opponent: { name: "AI", avatar: null, active: false },
      },
    });

    assert.equal(FakeKonvaLayer.instances.length, 4);
    const [boardLayer, highlightLayer, checkerLayer, uiLayer] = FakeKonvaLayer.instances;
    assert.ok(boardLayer);
    assert.ok(highlightLayer);
    assert.ok(checkerLayer);
    assert.ok(uiLayer);
    const checkerClearsAfterInitialRender = checkerLayer.destroyChildrenCount;
    const highlightClearsAfterInitialRender = highlightLayer.destroyChildrenCount;
    const uiClearsAfterInitialRender = uiLayer.destroyChildrenCount;
    const sourceChecker = findClickableKonvaNodes(checkerLayer)[0];
    assert.ok(sourceChecker);
    assert.equal(sourceChecker.handlers["mouseover"], undefined);
    assert.equal(sourceChecker.handlers["mouseout"], undefined);

    sourceChecker.trigger("click tap");

    assert.equal(FakeKonvaLayer.instances.length, 4);
    assert.equal(FakeKonvaLayer.instances[0], boardLayer);
    assert.equal(FakeKonvaLayer.instances[1], highlightLayer);
    assert.equal(FakeKonvaLayer.instances[2], checkerLayer);
    assert.equal(FakeKonvaLayer.instances[3], uiLayer);
    assert.equal(boardLayer.destroyed, false);
    assert.equal(highlightLayer.destroyed, false);
    assert.equal(checkerLayer.destroyed, false);
    assert.equal(uiLayer.destroyed, false);
    assert.equal(checkerLayer.destroyChildrenCount, checkerClearsAfterInitialRender);
    assert.ok(highlightLayer.destroyChildrenCount > highlightClearsAfterInitialRender);
    assert.ok(uiLayer.destroyChildrenCount > uiClearsAfterInitialRender);

    const targetArea = findClickableKonvaNodes(uiLayer)[0];
    assert.ok(targetArea);
    targetArea.trigger("click tap");

    assert.equal(selectedMoveIds.length, 0);
    assert.ok(checkerLayer.destroyChildrenCount > checkerClearsAfterInitialRender);
    assert.equal(FakeKonvaLayer.instances.length, 4);
  });
  void test("game-room Tavla Konva stage coalesces resize redraws and skips unchanged sizes", () => {
    resetFakeKonva();
    const frames: Array<() => void> = [];
    const windowObject: Record<string, unknown> = {
      GameRoomUiFactories: {},
      Konva: {
        Stage: FakeKonvaStage,
        Layer: FakeKonvaLayer,
        Group: FakeKonvaGroup,
        Rect: FakeKonvaNode,
        Line: FakeKonvaNode,
        Circle: FakeKonvaNode,
        Text: FakeKonvaNode,
      },
    };
    const context = {
      ResizeObserver: FakeResizeObserver,
      document: { documentElement: {} },
      getComputedStyle: () => ({
        getPropertyValue: () => "",
      }),
      requestAnimationFrame: (callback: ScheduledFrameCallback) => {
        frames.push(() => {
          callback(16);
        });
        return frames.length;
      },
      globalThis: {
        requestAnimationFrame: (callback: ScheduledFrameCallback) => {
          frames.push(() => {
            callback(16);
          });
          return frames.length;
        },
      },
      window: windowObject,
    };
    vm.createContext(context);
    vm.runInNewContext(
      loadWorkspaceScriptForVm(
        "rooms/game-room/main-functions/backgammon/ui/backgammon-stage-runtime.ts"
      ),
      context
    );

    const registry = windowObject["GameRoomUiFactories"] as Record<string, unknown>;
    const createStageRuntime = registry["createBackgammonStageRuntime"];
    assert.equal(typeof createStageRuntime, "function");
    const game = {
      active: true,
      awaitingMoveFrom: "user",
      blockedReason: "",
      board: Array.from({ length: 24 }, (_value, index) => ({
        point: index + 1,
        owner: index === 0 ? "user" : "",
        count: index === 0 ? 1 : 0,
      })),
      bar: { user: 0, ai: 0 },
      off: { user: 0, ai: 0 },
      dice: [1, 1],
      legalMoves: [],
      turnIndex: 1,
      turnToken: "turn-1",
      boardHash: "board-1",
    };
    const stageRuntime = (
      createStageRuntime as (deps: Record<string, unknown>) => {
        renderBackgammonStage(host: FakeStageHost, options: Record<string, unknown>): void;
      }
    )({
      createElement: (tagName: string, className = "", textContent = "") =>
        new MinimalFakeElement(tagName, className, textContent),
      getState: () => ({ game }),
      stateRuntime: {
        onLegalMove: () => undefined,
      },
      text: (path: string[]) => path.at(-1) ?? "",
    });
    const host = new FakeStageHost();

    stageRuntime.renderBackgammonStage(host, {
      canUserMove: true,
      game,
      players: {
        user: { name: "User", avatar: null, active: true },
        opponent: { name: "AI", avatar: null, active: false },
      },
    });

    const observer = FakeResizeObserver.instances[0];
    const stage = FakeKonvaStage.instances[0];
    const boardLayer = FakeKonvaLayer.instances[0];
    assert.ok(observer);
    assert.ok(stage);
    assert.ok(boardLayer);
    const drawCountAfterInitialRender = stage.drawCount;
    const boardClearsAfterInitialRender = boardLayer.destroyChildrenCount;

    observer.trigger();
    observer.trigger();
    assert.equal(frames.length, 1);
    frames.shift()?.();

    assert.equal(stage.drawCount, drawCountAfterInitialRender);
    assert.equal(boardLayer.destroyChildrenCount, boardClearsAfterInitialRender);

    host.clientWidth = 900;
    observer.trigger();
    observer.trigger();
    assert.equal(frames.length, 1);
    frames.shift()?.();

    assert.equal(stage.drawCount, drawCountAfterInitialRender + 1);
    assert.equal(boardLayer.destroyChildrenCount, boardClearsAfterInitialRender);
    assert.equal(FakeKonvaLayer.instances.length, 4);
  });
});
