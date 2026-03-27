import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

import { buildRoomHostModuleDataUrl } from "../../src/js/modules/rooms/room-host-source.ts";

async function importRoomHostModule(targetPath: string) {
  const absolutePath = resolve(targetPath);
  const moduleUrl = await buildRoomHostModuleDataUrl(absolutePath, async (filePath) => {
    return await readFile(filePath, "utf8");
  });
  return await import(`${moduleUrl}#installed-runtime-${Date.now()}-${Math.random().toString(16).slice(2)}`);
}

type InstalledHostRuntime = ReturnType<typeof createInstalledHostRuntime>;

const activeRuntimes: InstalledHostRuntime[] = [];
const installedGameRoomHostModule = await importRoomHostModule("data/rooms/game-room/host/index.js");

async function flushHostTasks(): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, 0));
  await new Promise((resolve) => setTimeout(resolve, 0));
}

function createInstalledHostRuntime() {
  const state = new Map();
  const notifications: Array<{ type: string; payload: Record<string, unknown> }> = [];
  const protocolCalls: Array<Record<string, unknown>> = [];
  const messageCalls: Array<Record<string, unknown>> = [];
  let exported: Record<string, unknown>;

  const api = {
    notifyRoom(type: string, payload: Record<string, unknown> = {}) {
      notifications.push({ type, payload });
    },
    sendProtocol: async (payload: Record<string, unknown>) => {
      protocolCalls.push(payload);
      return { success: true };
    },
    sendMessage: async (payload: Record<string, unknown>) => {
      messageCalls.push(payload);
      return { success: true };
    },
    sendToTargets: async () => ({ success: true }),
    sendUs1Message: async () => ({
      success: true,
      remoteUserId: "remote@example.com",
      localSessionId: "fk-installed-session-1",
    }),
    syncUs1Messages: async () => ({
      success: true,
      fetchedCount: 0,
      processedCount: 0,
      duplicateCount: 0,
      projectedCount: 0,
      skippedCount: 0,
      unresolvedSessionCount: 0,
      roomPackages: [],
      roomEvents: [],
      roomCommands: [],
      roomInviteInbox: [],
    }),
    dispatchRoomCommand: async () => ({ success: false }),
    getUs1Identity: () => ({
      remoteUserId: "remote@example.com",
      nickname: "Remote Ghost",
      email: "remote@example.com",
    }),
    isUs1Connected: () => true,
    selectUs1RemoteUser: async () => true,
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

  exported = installedGameRoomHostModule.default.activate(api);

  const runtime = {
    state,
    notifications,
    protocolCalls,
    messageCalls,
    exported,
    async emitHostContext(context: Record<string, unknown>) {
      runtime.exported.onRoomEvent(context);
      await flushHostTasks();
    },
    latestFateKnotsState() {
      const latest = notifications.filter((entry) => entry.type === "fate-knots-state").at(-1)
        ?.payload?.state as Record<string, unknown> | undefined;
      return latest ?? null;
    },
  };

  activeRuntimes.push(runtime);
  return runtime;
}

function buildHostContext() {
  return {
    type: "host-context",
    locale: "en",
    room: {
      id: "game-room",
      defaultFeatureId: "xox",
    },
    features: [
      { id: "xox", name: "XOX" },
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
        connected: false,
        ready: false,
        state: "assigned",
      },
      us1: {
        slotId: "us1",
        nickname: "Remote Ghost",
        assigned: true,
        connected: false,
        ready: false,
        state: "assigned",
        remoteUserId: "remote@example.com",
      },
    },
  };
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

test("game-room installed host can start Fate Knots and reach the first scenario prompt", async () => {
  const runtime = createInstalledHostRuntime();

  await runtime.emitHostContext(buildHostContext());

  const startResult = await runtime.exported.commands.GameRoomFateKnotsStart({
    provider: "room-ui",
    roomArgs: {},
  });
  assert.equal(startResult?.success, true);

  await runtime.exported.commands.GameRoomFateKnotsCharacterSelect({
    provider: "room-ui",
    roomArgs: { avatarId: "warrior_avatar" },
  });
  await runtime.exported.commands.GameRoomFateKnotsCharacterSelect({
    provider: "room-ui",
    roomArgs: { classId: "warrior" },
  });
  await runtime.exported.commands.GameRoomFateKnotsCharacterSelect({
    provider: "room-ui",
    roomArgs: { backgroundId: "former_soldier" },
  });

  const readyResult = await runtime.exported.commands.GameRoomFateKnotsReady({
    provider: "room-ui",
    roomArgs: {},
  });

  assert.equal(readyResult?.success, true);
  const state = runtime.latestFateKnotsState();
  assert.equal(state?.phase, "scenario");
  assert.equal(state?.active, true);
  assert.equal(runtime.protocolCalls[0]?.scenario, "fate-knots-ai-decision");
  assert.equal(runtime.messageCalls[0]?.provider, "ai1");
});
