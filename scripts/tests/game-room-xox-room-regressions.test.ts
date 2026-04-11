import test from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import vm from "node:vm";

import { validateRoomManifest } from "../../src/types/rooms.ts";
import { loadWorkspaceScriptForVm } from "./helpers/room-workspace-script.ts";

const requiredFiles = [
  "rooms/game-room/manifest.json",
  "rooms/game-room/host/index.ts",
  "rooms/game-room/host/runtime.ts",
  "rooms/game-room/ui/index.html",
  "rooms/game-room/ui/context-runtime.ts",
  "rooms/game-room/ui/index.ts",
  "rooms/game-room/ui/game-room-ui-bootstrap.ts",
  "rooms/game-room/ui/game-room-ui-state-message-runtime.ts",
  "rooms/game-room/ui/game-room-ui-runtime.ts",
  "rooms/game-room/ui/style.css",
  "rooms/game-room/shared/host/feature-meta.ts",
  "rooms/game-room/shared/host/text.ts",
  "rooms/game-room/shared/host/context-state.ts",
  "rooms/game-room/shared/host/activation.ts",
  "rooms/game-room/shared/host/command-registry.ts",
  "rooms/game-room/shared/host/command-args.ts",
  "rooms/game-room/shared/ui/feature-contract.ts",
  "rooms/game-room/shared/ui/scroll-runtime.ts",
  "rooms/game-room/shared/types/room-shell-contracts.ts",
  "rooms/game-room/main-functions/xox/host/runtime.ts",
  "rooms/game-room/shared/styles/base.css",
  "rooms/game-room/i18n/en.json",
  "rooms/game-room/i18n/tr.json",
  "rooms/game-room/main-functions/xox/protocols/game-room-xox-user-start.md",
  "rooms/game-room/main-functions/xox/protocols/game-room-xox-ai-start.md",
  "rooms/game-room/main-functions/xox/host/copy.ts",
  "rooms/game-room/main-functions/xox/host/runtime-match.ts",
  "rooms/game-room/main-functions/xox/host/runtime-sync.ts",
  "rooms/game-room/main-functions/xox/host/state-core.ts",
  "rooms/game-room/main-functions/xox/host/state-invites.ts",
  "rooms/game-room/main-functions/xox/host/state-room-runtime.ts",
  "rooms/game-room/main-functions/xox/host/state.ts",
  "rooms/game-room/main-functions/xox/host/us1-invite-runtime.ts",
  "rooms/game-room/main-functions/xox/host/us1-sync-runtime.ts",
  "rooms/game-room/main-functions/xox/host/us1-runtime.ts",
  "rooms/game-room/main-functions/xox/ui/state-runtime.ts",
  "rooms/game-room/main-functions/xox/ui/render-runtime.ts",
  "rooms/game-room/main-functions/xox/ui/module.ts",
  "rooms/game-room/main-functions/xox/styles.css",
  "rooms/game-room/main-functions/xox/styles/layout.css",
  "rooms/game-room/main-functions/xox/styles/presentation.css",
  "rooms/game-room/main-functions/xox/styles/board.css",
  "rooms/game-room/main-functions/xox/styles/scene-view.css",
  "rooms/game-room/shared/assets/room-background.webp",
  "rooms/game-room/main-functions/xox/assets/xox-view.webp",
];

type XoxUiStateHarness = {
  state: {
    game: Record<string, unknown>;
    context: {
      slots: Record<string, Record<string, unknown>>;
      user: {
        nickname: string;
      };
    };
    preferences: {
      target: string;
      starter: string;
      inviteMessage: string;
    };
    lastCommandMessage: string;
    locale: string;
  };
  runtime: {
    createGameState: () => Record<string, unknown>;
    getCurrentStatus: () => string;
    syncPreferencesFromGame: () => void;
  };
};

function createXoxUiStateHarness(): XoxUiStateHarness {
  const windowObject: {
    GameRoomUiFactories?: {
      createXoxUiStateRuntime?: (deps: Record<string, unknown>) => XoxUiStateHarness["runtime"];
    };
  } = {};
  const context = {
    window: windowObject,
    globalThis: windowObject,
  };
  vm.createContext(context);
  vm.runInNewContext(
    loadWorkspaceScriptForVm("rooms/game-room/main-functions/xox/ui/state-runtime.ts"),
    context
  );

  const createSlot = (slotId: string) => ({
    slotId,
    nickname: slotId.toUpperCase(),
    assigned: true,
    connected: slotId !== "us1",
    ready: true,
  });
  const state = {
    game: {} as Record<string, unknown>,
    context: {
      slots: {
        ai1: createSlot("ai1"),
        ai2: createSlot("ai2"),
        us1: {
          ...createSlot("us1"),
          connected: false,
        },
      },
      user: {
        nickname: "User",
      },
    },
    preferences: {
      target: "ai1",
      starter: "user",
      inviteMessage: "",
    },
    lastCommandMessage: "",
    locale: "tr",
  };

  const runtimeFactory = windowObject.GameRoomUiFactories?.createXoxUiStateRuntime;
  assert.equal(typeof runtimeFactory, "function");
  const runtime = runtimeFactory({
    getState: () => state,
    roomId: "game-room",
    featureId: "xox",
    createSlot,
    createInviteEntry: () => ({
      roomId: "game-room",
      featureId: "xox",
      inviteId: "",
      remoteUserId: "",
      nickname: "US1",
      senderEmail: "",
      note: "",
      starter: "user",
      localSessionId: "",
      conversationId: "",
      sentAt: null,
    }),
    normalizeSlot: (_candidate: unknown, slotId: string) => createSlot(slotId),
    text: () => "",
    sendRoomCommand: () => undefined,
  });

  state.game = runtime.createGameState();
  return { state, runtime };
}

test("game-room workspace keeps the required XOX package files", () => {
  requiredFiles.forEach((filePath) => {
    assert.equal(existsSync(filePath), true, filePath);
  });
});

test("game-room manifest validates with the XOX-first room contract", () => {
  const manifest = JSON.parse(readFileSync("rooms/game-room/manifest.json", "utf8"));
  const validation = validateRoomManifest(manifest);

  assert.equal(validation.valid, true);
  assert.equal(validation.manifest?.id, "game-room");
  assert.equal(validation.manifest?.defaultFeatureId, "xox");
  assert.deepEqual(
    validation.manifest?.features.map((feature) => feature.id),
    ["xox", "team-tetris", "fate-knots"]
  );
  assert.equal(validation.manifest?.runtime.uiEntry, "ui/index.html");
  assert.equal(validation.manifest?.runtime.hostEntry, "host/index.js");
  assert.equal(validation.manifest?.scene?.characterRosterPreset, "connected-plus-user");
  assert.equal(validation.manifest?.scene?.characters?.length, 3);
  assert.equal(validation.manifest?.scene?.chrome?.pageShellVariant, "immersive-stage");
});

test("game-room XOX UI keeps the local idle target selection during snapshot sync", () => {
  const { state, runtime } = createXoxUiStateHarness();
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

test("game-room XOX UI syncs the host target once the match state becomes authoritative", () => {
  const { state, runtime } = createXoxUiStateHarness();
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

test("game-room XOX UI prioritizes command-result messages over stale game status text", () => {
  const { state, runtime } = createXoxUiStateHarness();
  Object.assign(state.game, {
    active: true,
    result: "pending",
    status: "Waiting for the remote move.",
  });
  state.lastCommandMessage = "A duplicate remote move was ignored.";

  assert.equal(runtime.getCurrentStatus(), "A duplicate remote move was ignored.");
});

test("game-room XOX UI forwards remote identity with invite actions", () => {
  const uiModuleSource = loadWorkspaceScriptForVm(
    "rooms/game-room/main-functions/xox/ui/module.ts"
  );
  const uiStateRuntimeSource = loadWorkspaceScriptForVm(
    "rooms/game-room/main-functions/xox/ui/state-runtime.ts"
  );
  const uiRenderRuntimeSource = loadWorkspaceScriptForVm(
    "rooms/game-room/main-functions/xox/ui/render-runtime.ts"
  );
  const indexHtmlSource = readFileSync("rooms/game-room/ui/index.html", "utf8");
  const runtimeSource = loadWorkspaceScriptForVm(
    "rooms/game-room/main-functions/xox/host/runtime.ts"
  );
  const stylesSource = readFileSync("rooms/game-room/main-functions/xox/styles.css", "utf8");
  const stateSource = loadWorkspaceScriptForVm("rooms/game-room/main-functions/xox/host/state.ts");
  const stateCoreSource = loadWorkspaceScriptForVm(
    "rooms/game-room/main-functions/xox/host/state-core.ts"
  );
  const stateInvitesSource = loadWorkspaceScriptForVm(
    "rooms/game-room/main-functions/xox/host/state-invites.ts"
  );
  const stateRoomRuntimeSource = loadWorkspaceScriptForVm(
    "rooms/game-room/main-functions/xox/host/state-room-runtime.ts"
  );
  const runtimeMatchSource = loadWorkspaceScriptForVm(
    "rooms/game-room/main-functions/xox/host/runtime-match.ts"
  );
  const runtimeSyncSource = loadWorkspaceScriptForVm(
    "rooms/game-room/main-functions/xox/host/runtime-sync.ts"
  );
  const us1RuntimeSource = loadWorkspaceScriptForVm(
    "rooms/game-room/main-functions/xox/host/us1-runtime.ts"
  );
  const us1InviteRuntimeSource = loadWorkspaceScriptForVm(
    "rooms/game-room/main-functions/xox/host/us1-invite-runtime.ts"
  );
  const us1SyncRuntimeSource = loadWorkspaceScriptForVm(
    "rooms/game-room/main-functions/xox/host/us1-sync-runtime.ts"
  );

  assert.match(indexHtmlSource, /<script src="\.\/context-runtime\.js"><\/script>/);
  assert.match(indexHtmlSource, /<script src="\.\/game-room-ui-bootstrap\.js"><\/script>/);
  assert.match(
    indexHtmlSource,
    /<script src="\.\/game-room-ui-state-message-runtime\.js"><\/script>/
  );
  assert.match(indexHtmlSource, /main-functions\/xox\/ui\/state-runtime\.js/);
  assert.match(indexHtmlSource, /main-functions\/xox\/ui\/render-runtime\.js/);
  assert.match(stylesSource, /@import "\.\/styles\/layout\.css"/);
  assert.match(stylesSource, /@import "\.\/styles\/presentation\.css"/);
  assert.match(stylesSource, /@import "\.\/styles\/board\.css"/);
  assert.match(stylesSource, /@import "\.\/styles\/scene-view\.css"/);
  assert.match(uiModuleSource, /createXoxUiStateRuntime/);
  assert.match(uiModuleSource, /createXoxUiRenderRuntime/);
  assert.match(runtimeSource, /from "\.\/runtime-match\.js"/);
  assert.match(runtimeSource, /from "\.\/runtime-sync\.js"/);
  assert.match(stateSource, /from "\.\/state-core\.js"/);
  assert.match(stateSource, /from "\.\/state-invites\.js"/);
  assert.match(stateSource, /from "\.\/state-room-runtime\.js"/);
  assert.match(us1RuntimeSource, /from "\.\/us1-invite-runtime\.js"/);
  assert.match(us1RuntimeSource, /from "\.\/us1-sync-runtime\.js"/);
  assert.match(runtimeMatchSource, /export async function sendAiTurnUpdate/);
  assert.match(runtimeSyncSource, /export function syncFromContext/);
  assert.match(stateCoreSource, /export function createInitialState/);
  assert.match(stateInvitesSource, /export function normalizeInviteEntry/);
  assert.match(stateRoomRuntimeSource, /export function pushRoomState/);
  assert.match(us1InviteRuntimeSource, /export function createGameRoomXoxUs1InviteRuntime/);
  assert.match(us1SyncRuntimeSource, /export function createGameRoomXoxUs1SyncRuntime/);
  assert.match(
    uiStateRuntimeSource,
    /sendRoomCommand\("GameRoomXoxAcceptInvite",\s*\{\s*(inviteId:\s*inviteId|inviteId),\s*(remoteUserId:\s*remoteUserId|remoteUserId)\s*,?\s*\}\s*\)/
  );
  assert.match(
    uiStateRuntimeSource,
    /sendRoomCommand\("GameRoomXoxRejectInvite",\s*\{\s*(inviteId:\s*inviteId|inviteId),\s*(remoteUserId:\s*remoteUserId|remoteUserId)\s*,?\s*\}\s*\)/
  );
  assert.match(uiRenderRuntimeSource, /function renderBootstrap\(root\)/);
  assert.match(runtimeSource, /GameRoomXoxStart/);
});
