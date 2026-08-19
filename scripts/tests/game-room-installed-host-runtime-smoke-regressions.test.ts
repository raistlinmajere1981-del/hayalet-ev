import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { join, resolve } from "node:path";

import {
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

async function importRoomHostModule(targetPath: string): Promise<InstalledGameRoomHostModule> {
  const absolutePath = resolve(targetPath);
  const moduleUrl = await buildRoomHostModuleDataUrl(absolutePath, async (filePath) => {
    return await readFile(filePath, "utf8");
  });
  return await import(
    `${moduleUrl}#installed-yahtzee-${Date.now()}-${Math.random().toString(16).slice(2)}`
  ) as InstalledGameRoomHostModule;
}

function createInstalledHostRuntime(installedModule: InstalledGameRoomHostModule) {
  const state = new Map<string, unknown>();
  const notifications: Array<{ type: string; payload: Record<string, unknown> }> = [];

  const api = {
    notifyRoom(type: string, payload: Record<string, unknown> = {}) {
      notifications.push({ type, payload });
    },
    dispatchBridge: () => ({ success: true }),
    dispatchRoomCommand: () => ({ success: false }),
    getUs1Identity: () => null,
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

  const exported = installedModule.default.activate(api);

  return {
    exported,
    emitHostContext() {
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
          ai1: { slotId: "ai1", assigned: false, connected: false, ready: false },
          ai2: { slotId: "ai2", assigned: false, connected: false, ready: false },
          us1: { slotId: "us1", assigned: false, connected: false, ready: false },
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

void test("game-room installed host exposes a playable Yahtzee flow", async () => {
  const installedCopy = await createRoomInstalledCopy("game-room");

  try {
    const installedModule = await importRoomHostModule(join(installedCopy.rootDir, "host/index.js"));
    const runtime = createInstalledHostRuntime(installedModule);

    runtime.emitHostContext();

    const startResult = await runtime.exported.commands["GameRoomYahtzeeStart"]?.();
    assert.equal((startResult as { success?: unknown } | undefined)?.success, true);
    assert.equal(runtime.latestYahtzeeState()?.["active"], true);
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
