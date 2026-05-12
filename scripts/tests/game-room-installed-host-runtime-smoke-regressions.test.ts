import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { join, resolve } from "node:path";

import { buildRoomHostModuleDataUrl } from "../../src/js/modules/rooms/room-host-source.ts";
import { createRoomInstalledCopy } from "./helpers/room-installed-copy.ts";

async function importRoomHostModule(targetPath: string) {
  const absolutePath = resolve(targetPath);
  const moduleUrl = await buildRoomHostModuleDataUrl(absolutePath, async (filePath) => {
    return await readFile(filePath, "utf8");
  });
  return await import(
    `${moduleUrl}#installed-runtime-${Date.now()}-${Math.random().toString(16).slice(2)}`
  );
}

type InstalledHostRuntime = ReturnType<typeof createInstalledHostRuntime>;
type InstalledGameRoomHostModule = {
  default: {
    activate: (api: Record<string, unknown>) => Record<string, unknown>;
  };
};

const activeRuntimes: InstalledHostRuntime[] = [];
let installedGameRoomHostModulePromise: Promise<Record<string, unknown>> | null = null;
let installedGameRoomCopyCleanup: (() => Promise<void>) | null = null;

async function flushHostTasks(): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, 0));
  await new Promise((resolve) => setTimeout(resolve, 0));
}

function createInstalledHostRuntime(installedGameRoomHostModule: InstalledGameRoomHostModule) {
  const state = new Map();
  const notifications: Array<{ type: string; payload: Record<string, unknown> }> = [];
  const protocolCalls: Array<Record<string, unknown>> = [];
  const messageCalls: Array<Record<string, unknown>> = [];
  const dispatchCalls: Array<Record<string, unknown>> = [];
  let exported: Record<string, unknown>;

  const api = {
    notifyRoom(type: string, payload: Record<string, unknown> = {}) {
      notifications.push({ type, payload });
    },
    dispatchBridge: async (payload: Record<string, unknown>) => {
      dispatchCalls.push(payload);
      const target =
        typeof payload.toSlot === "string"
          ? payload.toSlot
          : Array.isArray(payload.toSlots) && typeof payload.toSlots[0] === "string"
            ? payload.toSlots[0]
            : null;
      const bridgePayload =
        payload.payload !== null && typeof payload.payload === "object"
          ? (payload.payload as Record<string, unknown>)
          : {};
      const protocol =
        bridgePayload.protocol !== null && typeof bridgePayload.protocol === "object"
          ? (bridgePayload.protocol as Record<string, unknown>)
          : null;

      if (protocol !== null) {
        protocolCalls.push(protocol);
      }

      if (
        target !== "us1" &&
        ((typeof bridgePayload.text === "string" && bridgePayload.text.trim() !== "") ||
          typeof bridgePayload.page === "string")
      ) {
        messageCalls.push({
          provider: target,
          text: bridgePayload.text,
          page: bridgePayload.page,
        });
      }

      if (payload.action === "message.send" && target === "us1") {
        return {
          success: true,
          session: {
            id: "fk-installed-session-1",
          },
          data: {
            remoteUserId:
              typeof bridgePayload.remoteUserId === "string"
                ? bridgePayload.remoteUserId
                : "remote@example.com",
          },
        };
      }

      return { success: true };
    },
    dispatchRoomCommand: async () => ({ success: false }),
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

  exported = installedGameRoomHostModule.default.activate(api);

  const runtime = {
    state,
    notifications,
    protocolCalls,
    messageCalls,
    dispatchCalls,
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

async function loadInstalledGameRoomHostModule() {
  if (installedGameRoomHostModulePromise !== null) {
    return await installedGameRoomHostModulePromise;
  }

  installedGameRoomHostModulePromise = (async function () {
    const installedCopy = await createRoomInstalledCopy("game-room");
    installedGameRoomCopyCleanup = installedCopy.cleanup;
    return await importRoomHostModule(join(installedCopy.rootDir, "host/index.js"));
  })();

  return await installedGameRoomHostModulePromise;
}

function buildHostContext() {
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
      { id: "fate-knots", name: "Fate Knots" },
    ],
    activeFeature: {
      id: "fate-knots",
      name: "Fate Knots",
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

test.afterEach(async () => {
  while (activeRuntimes.length > 0) {
    const runtime = activeRuntimes.pop();
    const dispose = runtime?.exported?.dispose;
    if (typeof dispose === "function") {
      await dispose();
    }
  }
  if (installedGameRoomCopyCleanup) {
    await installedGameRoomCopyCleanup();
    installedGameRoomCopyCleanup = null;
  }
  installedGameRoomHostModulePromise = null;
});

test("game-room installed host can start Fate Knots and reach the first scenario prompt", async () => {
  const installedGameRoomHostModule =
    (await loadInstalledGameRoomHostModule()) as InstalledGameRoomHostModule;
  const runtime = createInstalledHostRuntime(installedGameRoomHostModule);

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
