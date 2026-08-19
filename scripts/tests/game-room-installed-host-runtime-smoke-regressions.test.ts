import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { join, resolve } from "node:path";

import {
  buildYahtzeeLegalActionIds,
  rollYahtzeeDice,
  scoreYahtzeeCategory,
  type YahtzeeTurn,
} from "../../rooms/game-room/main-functions/yahtzee/host/engine.ts";
import { buildRoomHostModuleDataUrl } from "../../src/js/modules/rooms/room-host-source.ts";
import { createRoomInstalledCopy } from "./helpers/room-installed-copy.ts";

type InstalledGameRoomHostModule = {
  default: {
    activate: (api: Record<string, unknown>) => {
      commands: Record<string, (payload?: unknown) => unknown>;
      onRoomEvent: (payload: unknown) => void;
      dispose?: () => void;
    };
  };
};

type ReadySeatId = "ai1" | "ai2" | "us1";

async function importRoomHostModule(targetPath: string): Promise<InstalledGameRoomHostModule> {
  const absolutePath = resolve(targetPath);
  const moduleUrl = await buildRoomHostModuleDataUrl(absolutePath, async (filePath) => {
    return await readFile(filePath, "utf8");
  });
  return await import(
    `${moduleUrl}#installed-yahtzee-${Date.now()}-${Math.random().toString(16).slice(2)}`
  ) as InstalledGameRoomHostModule;
}

function createInstalledHostRuntime(options: { readySeats?: ReadySeatId[] } = {}) {
  const state = new Map<string, unknown>();
  const notifications: Array<{ type: string; payload: Record<string, unknown> }> = [];
  const dispatchCalls: Array<Record<string, unknown>> = [];
  const readySeats = new Set(options.readySeats ?? []);

  const api = {
    notifyRoom(type: string, payload: Record<string, unknown> = {}) {
      notifications.push({ type, payload });
    },
    dispatchBridge: (payload: Record<string, unknown>) => {
      dispatchCalls.push(payload);
      const target = typeof payload["toSlot"] === "string" ? payload["toSlot"] : "";
      if (target === "us1") {
        return {
          success: true,
          session: { id: "us1-session" },
          data: { remoteUserId: "remote-us1" },
        };
      }
      return { success: true };
    },
    dispatchRoomCommand: () => ({ success: false }),
    getUs1Identity: () =>
      readySeats.has("us1")
        ? { remoteUserId: "remote-us1", nickname: "Remote Player", email: "remote@example.com" }
        : null,
    isUs1Connected: () => readySeats.has("us1"),
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

  const exported = installedModule.default.activate(api);

  return {
    exported,
    state,
    dispatchCalls,
    emitHostContext() {
      function slotState(slotId: ReadySeatId) {
        const ready = readySeats.has(slotId);
        return {
          slotId,
          nickname:
            slotId === "ai1" ? "Nexa" : slotId === "ai2" ? "Gök" : "Remote Player",
          assigned: ready,
          connected: ready,
          ready,
          dispatchable: ready,
          ...(slotId === "us1" && ready ? { remoteUserId: "remote-us1" } : {}),
        };
      }

      exported.onRoomEvent({
        type: "host-context",
        locale: "en",
        room: { id: "game-room", defaultFeatureId: "backgammon" },
        features: [
          { id: "backgammon", name: "Tavla" },
          { id: "team-tetris", name: "Team Tetris" },
          { id: "yahtzee", name: "Yahtzee" },
        ],
        activeFeature: { id: "yahtzee", name: "Yahtzee" },
        user: { nickname: "Raistlin" },
        slots: {
          ai1: slotState("ai1"),
          ai2: slotState("ai2"),
          us1: slotState("us1"),
        },
      });
    },
    latestYahtzeeState() {
      return notifications
        .filter((entry) => entry.type === "yahtzee-state")
        .at(-1)?.payload["state"] as Record<string, unknown> | undefined;
    },
  };
}

let installedModule: InstalledGameRoomHostModule;

void test("Yahtzee scoring covers core combinations", () => {
  assert.equal(scoreYahtzeeCategory("full-house", [2, 2, 3, 3, 3]), 25);
  assert.equal(scoreYahtzeeCategory("small-straight", [1, 2, 3, 4, 6]), 30);
  assert.equal(scoreYahtzeeCategory("large-straight", [2, 3, 4, 5, 6]), 40);
  assert.equal(scoreYahtzeeCategory("yahtzee", [5, 5, 5, 5, 5]), 50);
  assert.equal(scoreYahtzeeCategory("chance", [1, 2, 3, 4, 6]), 16);
});

void test("Yahtzee rerolls preserve held dice", () => {
  const turn: YahtzeeTurn = {
    dice: [1, 2, 3, 4, 5],
    held: [true, false, true, false, false],
    rollCount: 1,
  };
  const rerolled = rollYahtzeeDice(turn, () => 0.99);

  assert.deepEqual(rerolled.dice, [1, 6, 3, 6, 6]);
  assert.equal(rerolled.rollCount, 2);
});

void test("Yahtzee legal action ids cover host-owned rerolls and unused scores", () => {
  const firstRoll: YahtzeeTurn = {
    dice: [1, 2, 3, 4, 5],
    held: [false, false, false, false, false],
    rollCount: 1,
  };
  const actions = buildYahtzeeLegalActionIds(firstRoll, { scores: {} });
  assert.equal(actions.filter((action) => action.startsWith("reroll:")).length, 32);
  assert.equal(actions.filter((action) => action.startsWith("score:")).length, 13);
  assert.ok(actions.includes("reroll:10101"));
  assert.ok(actions.includes("score:yahtzee"));

  const finalRoll = { ...firstRoll, rollCount: 3 };
  const finalActions = buildYahtzeeLegalActionIds(finalRoll, { scores: { chance: 16 } });
  assert.equal(finalActions.some((action) => action.startsWith("reroll:")), false);
  assert.equal(finalActions.includes("score:chance"), false);
  assert.equal(finalActions.filter((action) => action.startsWith("score:")).length, 12);
});

void test("game-room installed host exposes the solo Yahtzee flow", async () => {
  const installedCopy = await createRoomInstalledCopy("game-room");

  try {
    installedModule = await importRoomHostModule(join(installedCopy.rootDir, "host/index.js"));
    const runtime = createInstalledHostRuntime();

    runtime.emitHostContext();

    const startResult = await runtime.exported.commands["GameRoomYahtzeeStart"]?.();
    assert.equal((startResult as { success?: unknown } | undefined)?.success, true);
    assert.equal(runtime.latestYahtzeeState()?.["active"], true);
    assert.equal(runtime.latestYahtzeeState()?.["mode"], "solo");
    assert.equal(
      (runtime.latestYahtzeeState()?.["turn"] as Record<string, unknown> | undefined)?.[
        "rollCount"
      ],
      1
    );

    const holdResult = await runtime.exported.commands["GameRoomYahtzeeToggleHold"]?.({
      roomArgs: { index: 0 },
    });
    assert.equal((holdResult as { success?: unknown } | undefined)?.success, true);
    assert.equal(
      ((runtime.latestYahtzeeState()?.["turn"] as Record<string, unknown>)["held"] as boolean[])[0],
      true
    );

    const scoreResult = await runtime.exported.commands["GameRoomYahtzeeScore"]?.({
      roomArgs: { category: "chance" },
    });
    assert.equal((scoreResult as { success?: unknown } | undefined)?.success, true);
    assert.equal(runtime.latestYahtzeeState()?.["turnIndex"], 1);

    const resetResult = await runtime.exported.commands["GameRoomYahtzeeReset"]?.();
    assert.equal((resetResult as { success?: unknown } | undefined)?.success, true);
    assert.equal(runtime.latestYahtzeeState()?.["active"], false);

    runtime.exported.dispose?.();
  } finally {
    await installedCopy.cleanup();
  }
});

void test("Yahtzee local two-player mode alternates two score cards on one host", async () => {
  const installedCopy = await createRoomInstalledCopy("game-room");

  try {
    installedModule = await importRoomHostModule(join(installedCopy.rootDir, "host/index.js"));
    const runtime = createInstalledHostRuntime();
    runtime.emitHostContext();

    const startResult = await runtime.exported.commands["GameRoomYahtzeeStart"]?.({
      roomArgs: { mode: "local2" },
    });
    assert.equal((startResult as { success?: unknown } | undefined)?.success, true);
    assert.equal(runtime.latestYahtzeeState()?.["mode"], "local2");
    assert.deepEqual(
      (runtime.latestYahtzeeState()?.["players"] as Array<Record<string, unknown>>).map(
        (player) => player["seatId"]
      ),
      ["user", "local2"]
    );
    assert.equal(runtime.latestYahtzeeState()?.["activeSeatId"], "user");

    await runtime.exported.commands["GameRoomYahtzeeScore"]?.({
      roomArgs: { category: "chance" },
    });
    assert.equal(runtime.latestYahtzeeState()?.["activeSeatId"], "local2");
    assert.equal(
      (runtime.latestYahtzeeState()?.["turn"] as Record<string, unknown>)["rollCount"],
      1
    );

    const secondScore = await runtime.exported.commands["GameRoomYahtzeeScore"]?.({
      roomArgs: { category: "chance" },
    });
    assert.equal((secondScore as { success?: unknown } | undefined)?.success, true);
    assert.equal(runtime.latestYahtzeeState()?.["activeSeatId"], "user");

    runtime.exported.dispose?.();
  } finally {
    await installedCopy.cleanup();
  }
});

void test("Yahtzee AI mode dispatches legal action ids and accepts only current AI turn", async () => {
  const installedCopy = await createRoomInstalledCopy("game-room");

  try {
    installedModule = await importRoomHostModule(join(installedCopy.rootDir, "host/index.js"));
    const runtime = createInstalledHostRuntime({ readySeats: ["ai1"] });
    runtime.emitHostContext();

    const startResult = await runtime.exported.commands["GameRoomYahtzeeStart"]?.({
      roomArgs: { mode: "ai1" },
    });
    assert.equal((startResult as { success?: unknown } | undefined)?.success, true);

    const scoreResult = await runtime.exported.commands["GameRoomYahtzeeScore"]?.({
      roomArgs: { category: "chance" },
    });
    assert.equal((scoreResult as { success?: unknown } | undefined)?.success, true);
    const aiState = runtime.latestYahtzeeState();
    assert.equal(aiState?.["activeSeatId"], "ai1");
    assert.equal(
      (runtime.state.get("room.expectedCommandCapture") as Record<string, unknown> | undefined)?.[
        "commandName"
      ],
      "GameRoomYahtzeeAiAction"
    );

    const aiDispatch = runtime.dispatchCalls.find((call) => call["toSlot"] === "ai1");
    const aiPayload = aiDispatch?.["payload"] as Record<string, unknown> | undefined;
    assert.match(String(aiPayload?.["text"] ?? ""), /GameRoomYahtzeeAiAction/);
    assert.match(String(aiPayload?.["text"] ?? ""), /score:chance/);

    const aiActionResult = await runtime.exported.commands["GameRoomYahtzeeAiAction"]?.({
      provider: "ai1",
      roomArgs: {
        legalActionId: "score:chance",
        turnToken: aiState?.["turnToken"],
        turnIndex: aiState?.["turnIndex"],
      },
    });
    assert.equal((aiActionResult as { success?: unknown } | undefined)?.success, true);
    assert.equal(runtime.latestYahtzeeState()?.["activeSeatId"], "user");

    runtime.exported.dispose?.();
  } finally {
    await installedCopy.cleanup();
  }
});

void test("Yahtzee US1 mode sends remote start and synchronized turn snapshots", async () => {
  const installedCopy = await createRoomInstalledCopy("game-room");

  try {
    installedModule = await importRoomHostModule(join(installedCopy.rootDir, "host/index.js"));
    const runtime = createInstalledHostRuntime({ readySeats: ["us1"] });
    runtime.emitHostContext();

    const startResult = await runtime.exported.commands["GameRoomYahtzeeStart"]?.({
      roomArgs: { mode: "us1" },
    });
    assert.equal((startResult as { success?: unknown } | undefined)?.success, true);
    assert.equal(runtime.latestYahtzeeState()?.["mode"], "us1");
    assert.equal(runtime.latestYahtzeeState()?.["remoteUserId"], "remote-us1");

    const startCall = runtime.dispatchCalls.find((call) => {
      const payload = call["payload"] as Record<string, unknown> | undefined;
      const roomCommand = payload?.["roomCommand"] as Record<string, unknown> | undefined;
      return roomCommand?.["commandName"] === "GameRoomYahtzeeRemoteStart";
    });
    assert.ok(startCall);

    await runtime.exported.commands["GameRoomYahtzeeScore"]?.({
      roomArgs: { category: "chance" },
    });
    assert.equal(runtime.latestYahtzeeState()?.["activeSeatId"], "us1");

    const syncCall = runtime.dispatchCalls.find((call) => {
      const payload = call["payload"] as Record<string, unknown> | undefined;
      const roomCommand = payload?.["roomCommand"] as Record<string, unknown> | undefined;
      return roomCommand?.["commandName"] === "GameRoomYahtzeeRemoteSync";
    });
    assert.ok(syncCall);

    runtime.exported.dispose?.();
  } finally {
    await installedCopy.cleanup();
  }
});