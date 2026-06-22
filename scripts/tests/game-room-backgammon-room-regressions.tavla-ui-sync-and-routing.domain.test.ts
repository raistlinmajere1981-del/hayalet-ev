import test from "node:test";
import assert from "node:assert/strict";
import vm from "node:vm";

import { loadWorkspaceScriptForVm } from "./helpers/room-workspace-script.ts";

describe("Tavla UI sync and routing", () => {
  void test("game-room Tavla UI keeps the local idle target selection during snapshot sync", () => {
    const { state, runtime } = createBackgammonUiStateHarness();
    state.preferences.target = "us1";
    state.preferences.starter = "ai";
    Object.assign(state.game, {
      active: false,
      result: "idle",
      pendingInvite: null,
      inviteId: null,
      remoteUserId: null,
      selectedTarget: "ai1",
      starter: "user",
    });

    runtime.syncPreferencesFromGame();

    assert.equal(state.preferences.target, "us1");
    assert.equal(state.preferences.starter, "ai");
  });
  void test("game-room Tavla UI syncs the host target once the match state becomes authoritative", () => {
    const { state, runtime } = createBackgammonUiStateHarness();
    state.preferences.target = "ai1";
    state.preferences.starter = "user";
    Object.assign(state.game, {
      active: true,
      result: "pending",
      pendingInvite: null,
      inviteId: "invite-1",
      remoteUserId: "remote-user-1",
      selectedTarget: "us1",
      starter: "ai",
    });

    runtime.syncPreferencesFromGame();

    assert.equal(state.preferences.target, "us1");
    assert.equal(state.preferences.starter, "ai");
  });
  void test("game-room Tavla UI prioritizes command-result messages over stale game status text", () => {
    const { state, runtime } = createBackgammonUiStateHarness();
    Object.assign(state.game, {
      active: true,
      result: "pending",
      status: "Waiting for the remote move.",
    });
    state.lastCommandMessage = "A duplicate remote move was ignored.";

    assert.equal(runtime.getCurrentStatus(), "A duplicate remote move was ignored.");
  });
  void test("game-room Tavla render keeps the board stage host stable across rail rerenders", () => {
    const document = new MinimalFakeDocument();
    const stageHosts: unknown[] = [];
    const createSlot = (slotId: string) => ({
      slotId,
      nickname: slotId.toUpperCase(),
      assigned: true,
      connected: true,
      ready: true,
      dispatchable: true,
    });
    const state = {
      presentation: {
        mode: "classic",
      },
      lastCommandMessage: "",
      preferences: {
        target: "ai2",
        starter: "user",
        inviteMessage: "",
        invitesTab: "incoming",
      },
      context: {
        room: {
          name: "Game Room",
        },
        user: {
          nickname: "User",
          avatar: null,
        },
        slots: {
          ai1: {
            ...createSlot("ai1"),
            connected: false,
            ready: false,
            dispatchable: false,
          },
          ai2: createSlot("ai2"),
          us1: {
            ...createSlot("us1"),
            connected: false,
            dispatchable: false,
          },
        },
      },
      game: {
        pendingInvite: null,
        inviteInbox: [],
        matchHistory: [],
        active: false,
        blockedReason: "",
        awaitingMoveFrom: null,
        user: {
          nickname: "User",
        },
        board: Array.from({ length: 24 }, (_value, index) => ({
          point: index + 1,
          owner: "",
          count: 0,
        })),
        bar: {
          user: 0,
          ai: 0,
        },
        off: {
          user: 0,
          ai: 0,
        },
        dice: [],
        legalMoves: [],
        result: "idle",
        scorePoints: 1,
      },
    };
    const windowObject: Record<string, unknown> = {
      GameRoomUiFactories: {
        createBackgammonStageRuntime: () => ({
          destroy: () => undefined,
          renderBackgammonStage: (host: unknown) => {
            stageHosts.push(host);
          },
        }),
      },
    };
    const context = {
      document,
      window: windowObject,
      globalThis: windowObject,
    };
    vm.createContext(context);
    vm.runInNewContext(
      loadWorkspaceScriptForVm("rooms/game-room/main-functions/backgammon/ui/render-runtime.ts"),
      context
    );

    const registry = windowObject["GameRoomUiFactories"] as Record<string, unknown>;
    const createRenderRuntime = registry["createBackgammonUiRenderRuntime"] as
      | ((deps: Record<string, unknown>) => { renderBackgammon(root: MinimalFakeElement): void })
      | undefined;
    assert.equal(typeof createRenderRuntime, "function");
    const renderRuntime = (
      createRenderRuntime as (deps: Record<string, unknown>) => {
        renderBackgammon(root: MinimalFakeElement): void;
      }
    )({
      getState: () => state,
      featureId: "backgammon",
      bootstrapText: (key: string) => key,
      text: (path: string[]) => path.at(-1) ?? "",
      createElement: (tagName: string, className = "", textContent = "") =>
        new MinimalFakeElement(tagName, className, textContent),
      render: () => undefined,
      isRoomApiAvailable: () => true,
      getFeatureLabel: () => "Tavla",
      stateRuntime: {
        onAcceptInvite: () => undefined,
        onRejectInvite: () => undefined,
        formatInviteMeta: () => "",
        getSelectedTarget: () => state.preferences.target,
        getDisplayOpponent: () => state.context.slots.ai2,
        getSlotOrder: () => [
          state.context.slots.ai1,
          state.context.slots.ai2,
          state.context.slots.us1,
        ],
        getSlotStatusLabel: () => "Ready",
        getStarterLabelForCurrentTarget: (starter: string) => starter,
        onStart: () => undefined,
        onReset: () => undefined,
        getCurrentStatus: () => "",
        getTurnLabel: () => "",
        getResultLabel: () => "",
        getDiceLabel: () => "",
        getBearOffLabel: () => "",
        getBarLabel: () => "",
        onLegalMove: () => undefined,
        onCancelOutgoingInvite: () => undefined,
        getMatchHistory: () => [],
        getMatchHistoryResultLabel: () => "",
        getMatchHistoryResultTone: () => "neutral",
        formatMatchHistoryDate: () => "",
      },
    });

    renderRuntime.renderBackgammon(document.app);
    const rootReplaceCountAfterInitialRender = document.app.replaceChildrenCount;
    const initialSlotCards = document.app.querySelectorAll(".backgammon-slot-card");
    assert.equal(initialSlotCards[0]?.dataset["selected"], "false");
    assert.equal(initialSlotCards[1]?.dataset["selected"], "true");

    initialSlotCards[0].click();

    assert.equal(state.preferences.target, "ai1");
    assert.equal(document.app.querySelector(".backgammon-button--primary")?.disabled, false);
    assert.equal(stageHosts.length, 1);
    assert.equal(document.app.replaceChildrenCount, rootReplaceCountAfterInitialRender);

    const updatedSlotCards = document.app.querySelectorAll(".backgammon-slot-card");
    assert.equal(updatedSlotCards[0]?.dataset["selected"], "true");
    assert.equal(updatedSlotCards[1]?.dataset["selected"], "false");

    const starterButtons = document.app.querySelectorAll(".backgammon-choice-button");
    starterButtons[1]?.click();
    assert.equal(state.preferences.starter, "ai");
    assert.equal(stageHosts.length, 1);
    assert.equal(document.app.replaceChildrenCount, rootReplaceCountAfterInitialRender);

    const inviteTabs = document.app.querySelectorAll(".backgammon-tab");
    inviteTabs[1]?.click();
    assert.equal(state.preferences.invitesTab, "outgoing");
    assert.equal(stageHosts.length, 1);
    assert.equal(document.app.replaceChildrenCount, rootReplaceCountAfterInitialRender);

    renderRuntime.renderBackgammon(document.app);

    assert.equal(stageHosts.length, 2);
    assert.equal(stageHosts[0], stageHosts[1]);
    assert.equal(document.app.replaceChildrenCount, rootReplaceCountAfterInitialRender);

    Object.assign(state.game, {
      active: true,
      awaitingMoveFrom: "user",
    });
    renderRuntime.renderBackgammon(document.app);

    assert.equal(document.app.replaceChildrenCount, rootReplaceCountAfterInitialRender);
    assert.equal(document.app.querySelector(".backgammon-stage")?.dataset["awaiting"], "user");
  });
});
