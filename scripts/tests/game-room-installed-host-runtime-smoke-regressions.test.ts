import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { join, resolve } from "node:path";

import { buildRoomHostModuleDataUrl } from "../../src/js/modules/rooms/room-host-source.ts";
import { createRoomInstalledCopy } from "./helpers/room-installed-copy.ts";

async function importRoomHostModule(targetPath: string): Promise<InstalledGameRoomHostModule> {
  const absolutePath = resolve(targetPath);
  const moduleUrl = await buildRoomHostModuleDataUrl(absolutePath, async (filePath) => {
    return await readFile(filePath, "utf8");
  });
  return await import(
    `${moduleUrl}#installed-runtime-${Date.now()}-${Math.random().toString(16).slice(2)}`
  ) as InstalledGameRoomHostModule;
}

type InstalledGameRoomHostModule = {
  default: {
    activate: (api: Record<string, unknown>) => {
      commands: Record<string, (payload?: unknown) => unknown>;
      onRoomEvent: (payload: unknown) => void;
      dispose?: () => void;
    };
  };
};

function createInstalledHostRuntime(installedGameRoomHostModule: InstalledGameRoomHostModule) {
  const state = new Map<string, unknown>();
  const notifications: Array<{ type: string; payload: Record<string, unknown> }> = [];

  const api = {
    notifyRoom(type: string, payload: Record<string, unknown> = {}) {
      notifications.push({ type, payload });
    },
    dispatchBridge: () => ({ success: true }),
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

  const exported = installedGameRoomHostModule.default.activate(api);

  return {
    notifications,
    exported,
    emitHostContext(context: Record<string, unknown>) {
      exported.onRoomEvent(context);
    },
    latestFateKnotsState() {
      return notifications.filter((entry) => entry.type === "fate-knots-state").at(-1)?.payload["state"] as Record<string, unknown> | undefined;
    },
  };
}

function buildHostContext() {
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
      { id: "fate-knots", name: "Fate Knots" },
    ],
    activeFeature: {
      id: "fate-knots",
      name: "Fate Knots",
    },
    user: {
      nickname: "Raistlin",
    },
    slots: {
      ai1: { slotId: "ai1", nickname: "Atlas", assigned: true, connected: true, ready: true },
      ai2: { slotId: "ai2", nickname: "Nova", assigned: true, connected: false, ready: false },
      us1: {
        slotId: "us1",
        nickname: "Remote Ghost",
        assigned: true,
        connected: false,
        ready: false,
        remoteUserId: "remote@example.com",
      },
    },
  };
}

void test("game-room installed host exposes Fate Knots as a blank placeholder", async () => {
  const installedCopy = await createRoomInstalledCopy("game-room");

  try {
    const installedGameRoomHostModule = await importRoomHostModule(
      join(installedCopy.rootDir, "host/index.js")
    );
    const runtime = createInstalledHostRuntime(installedGameRoomHostModule);

    runtime.emitHostContext(buildHostContext());
    assert.equal(runtime.latestFateKnotsState()?.["phase"], "blank-slate");

    const startResult = await runtime.exported.commands["GameRoomFateKnotsStart"]?.({});
    assert.equal((startResult as { success?: unknown } | undefined)?.success, true);
    assert.equal(runtime.latestFateKnotsState()?.["active"], true);
    assert.equal(runtime.latestFateKnotsState()?.["phase"], "ready");

    const resetResult = await runtime.exported.commands["GameRoomFateKnotsReset"]?.();
    assert.equal((resetResult as { success?: unknown } | undefined)?.success, true);
    assert.equal(runtime.latestFateKnotsState()?.["active"], false);
    assert.equal(runtime.latestFateKnotsState()?.["phase"], "blank-slate");

    runtime.exported.dispose?.();
  } finally {
    await installedCopy.cleanup();
  }
});
