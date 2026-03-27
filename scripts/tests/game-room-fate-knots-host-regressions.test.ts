import test from "node:test";
import assert from "node:assert/strict";

import { loadGameRoomHostModule } from "./helpers/game-room-host-module.ts";

const gameRoomHostModule = await loadGameRoomHostModule();

type HostRuntime = ReturnType<typeof createRoomHostRuntime>;

const activeRuntimes: HostRuntime[] = [];

async function flushHostTasks(): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, 0));
  await new Promise((resolve) => setTimeout(resolve, 0));
}

function createRoomHostRuntime() {
  const state = new Map();
  const notifications: Array<{ type: string; payload: Record<string, unknown> }> = [];
  const protocolCalls: Array<Record<string, unknown>> = [];
  const messageCalls: Array<Record<string, unknown>> = [];
  const us1MessageCalls: Array<Record<string, unknown>> = [];
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
    sendUs1Message: async (payload: Record<string, unknown>) => {
      us1MessageCalls.push(payload);
      return {
        success: true,
        remoteUserId: "remote@example.com",
        localSessionId: "fk-session-1",
      };
    },
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

  exported = gameRoomHostModule.default.activate(api);

  const runtime = {
    state,
    notifications,
    protocolCalls,
    messageCalls,
    us1MessageCalls,
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

test.afterEach(async () => {
  while (activeRuntimes.length > 0) {
    const runtime = activeRuntimes.pop();
    const dispose = runtime?.exported?.dispose;
    if (typeof dispose === "function") {
      await dispose();
    }
  }
});

function buildHostContext(
  options: {
    activeFeatureId?: "xox" | "team-tetris" | "fate-knots";
    ai1Ready?: boolean;
    ai2Ready?: boolean;
    us1Ready?: boolean;
  } = {}
) {
  const activeFeatureId = options.activeFeatureId ?? "fate-knots";
  const featureNames = {
    xox: "XOX",
    "team-tetris": "Team Tetris",
    "fate-knots": "Fate Knots",
  } as const;

  return {
    type: "host-context",
    locale: "en",
    room: {
      id: "game-room",
      defaultFeatureId: "xox",
    },
    features: [
      {
        id: "xox",
        name: "XOX",
      },
      {
        id: "team-tetris",
        name: "Team Tetris",
      },
      {
        id: "fate-knots",
        name: "Fate Knots",
      },
    ],
    activeFeature: {
      id: activeFeatureId,
      name: featureNames[activeFeatureId],
    },
    user: {
      nickname: "Raistlin",
    },
    slots: {
      ai1: {
        slotId: "ai1",
        nickname: "Atlas",
        assigned: true,
        connected: options.ai1Ready !== false,
        ready: options.ai1Ready !== false,
        state: options.ai1Ready === false ? "assigned" : "connected",
      },
      ai2: {
        slotId: "ai2",
        nickname: "Nova",
        assigned: true,
        connected: options.ai2Ready === true,
        ready: options.ai2Ready === true,
        state: options.ai2Ready === true ? "connected" : "assigned",
      },
      us1: {
        slotId: "us1",
        nickname: "Remote Ghost",
        assigned: true,
        connected: options.us1Ready === true,
        ready: options.us1Ready === true,
        state: options.us1Ready === true ? "connected" : "assigned",
        remoteUserId: "remote@example.com",
      },
    },
  };
}

async function startRunIntoScenario(runtime: HostRuntime) {
  await runtime.emitHostContext(buildHostContext({ ai1Ready: true, ai2Ready: false, us1Ready: false }));
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
  return state;
}

async function advanceRunToCombat(runtime: HostRuntime) {
  let state = await startRunIntoScenario(runtime);
  const sessionId = String(state?.sessionId ?? "");
  const firstStepId = String(state?.currentStep?.id ?? "");
  const firstChoiceId = String(state?.currentStep?.choices?.[0]?.id ?? "");

  await runtime.exported.commands.GameRoomFateKnotsChoice({
    provider: "room-ui",
    roomArgs: { sessionId, stepId: firstStepId, choiceId: firstChoiceId },
  });
  await runtime.exported.commands.GameRoomFateKnotsChoice({
    provider: "ai1",
    roomArgs: { sessionId, stepId: firstStepId, choiceId: firstChoiceId },
  });

  state = runtime.latestFateKnotsState();
  assert.equal(state?.phase, "scenario");
  const encounterChoice =
    (state?.currentStep?.choices as Array<Record<string, unknown>> | undefined)?.find(function (choice) {
      return typeof choice?.encounterId === "string" && choice.encounterId !== "";
    }) || (state?.currentStep?.choices?.[0] as Record<string, unknown> | undefined);
  const secondStepId = String(state?.currentStep?.id ?? "");
  const secondChoiceId = String(encounterChoice?.id ?? "");

  await runtime.exported.commands.GameRoomFateKnotsChoice({
    provider: "room-ui",
    roomArgs: { sessionId, stepId: secondStepId, choiceId: secondChoiceId },
  });
  await runtime.exported.commands.GameRoomFateKnotsChoice({
    provider: "ai1",
    roomArgs: { sessionId, stepId: secondStepId, choiceId: secondChoiceId },
  });

  state = runtime.latestFateKnotsState();
  assert.equal(state?.phase, "combat");
  return state;
}

test("game-room host emits Fate Knots bootstrap state from active feature context", async () => {
  const runtime = createRoomHostRuntime();

  await runtime.emitHostContext(buildHostContext({ ai1Ready: true, ai2Ready: false, us1Ready: false }));

  const state = runtime.latestFateKnotsState();
  assert.ok(state);
  assert.equal(state?.featureId, "fate-knots");
  assert.equal(state?.phase, "idle");
  assert.equal(state?.active, false);
  assert.equal(Array.isArray(state?.catalogs?.avatars), true);
});

test("game-room host blocks Fate Knots start until at least one AI companion is ready", async () => {
  const runtime = createRoomHostRuntime();

  await runtime.emitHostContext(buildHostContext({ ai1Ready: false, ai2Ready: false, us1Ready: false }));
  const result = await runtime.exported.commands.GameRoomFateKnotsStart({
    provider: "room-ui",
    roomArgs: {},
  });

  assert.equal(result?.success, false);
  assert.match(String(result?.message ?? ""), /ready|companion/i);
});

test("game-room host starts Fate Knots with the V2 roster and dispatches the first AI and US1 decision prompts", async () => {
  const runtime = createRoomHostRuntime();

  await runtime.emitHostContext(buildHostContext({ ai1Ready: true, ai2Ready: false, us1Ready: true }));
  const startResult = await runtime.exported.commands.GameRoomFateKnotsStart({
    provider: "room-ui",
    roomArgs: {},
  });

  assert.equal(startResult?.success, true);
  let state = runtime.latestFateKnotsState();
  assert.equal(state?.phase, "character-creation");
  assert.equal(state?.active, true);
  assert.equal((state?.participants as Array<Record<string, unknown>>).length, 3);
  assert.equal((state?.participants as Array<Record<string, unknown>>)[1]?.seatId, "ai1");
  assert.equal((state?.participants as Array<Record<string, unknown>>)[2]?.seatId, "us1");
  assert.deepEqual(state?.excludedSeats, []);

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
  state = runtime.latestFateKnotsState();
  assert.equal(state?.phase, "scenario");
  assert.equal(runtime.protocolCalls[0]?.scenario, "fate-knots-ai-decision");
  assert.equal(runtime.messageCalls[0]?.provider, "ai1");
  assert.match(String(runtime.messageCalls[0]?.text ?? ""), /GameRoomFateKnotsAiChoice/);
  assert.equal(runtime.us1MessageCalls.length > 0, true);
  assert.match(String(runtime.us1MessageCalls[0]?.text ?? ""), /GameRoomFateKnotsRemoteChoice/);
});

test("game-room host resets Fate Knots state when the active feature switches away", async () => {
  const runtime = createRoomHostRuntime();

  await runtime.emitHostContext(buildHostContext({ ai1Ready: true, ai2Ready: false, us1Ready: false }));
  const startResult = await runtime.exported.commands.GameRoomFateKnotsStart({
    provider: "room-ui",
    roomArgs: {},
  });

  assert.equal(startResult?.success, true);
  assert.equal(runtime.state.get("fate-knots-game")?.active, true);

  await runtime.emitHostContext(buildHostContext({ activeFeatureId: "xox", ai1Ready: true }));

  assert.equal(runtime.state.get("fate-knots-game")?.active, false);
  assert.equal(runtime.state.get("fate-knots-game")?.statusKey, "activeFeatureReset");
});

test("game-room host rejects stale Fate Knots choice payloads without mutating decision votes", async () => {
  const runtime = createRoomHostRuntime();
  const state = await startRunIntoScenario(runtime);

  const result = await runtime.exported.commands.GameRoomFateKnotsChoice({
    provider: "room-ui",
    roomArgs: {
      sessionId: "stale-session",
      stepId: state?.currentStep?.id,
      choiceId: state?.currentStep?.choices?.[0]?.id,
    },
  });

  assert.equal(result?.success, false);
  assert.match(String(result?.message ?? ""), /stale/i);
  assert.deepEqual(runtime.latestFateKnotsState()?.decision?.votes ?? {}, {});
});

test("game-room host tolerates duplicate AI votes without corrupting pending scenario state", async () => {
  const runtime = createRoomHostRuntime();
  const state = await startRunIntoScenario(runtime);
  const sessionId = String(state?.sessionId ?? "");
  const stepId = String(state?.currentStep?.id ?? "");
  const choiceId = String(state?.currentStep?.choices?.[0]?.id ?? "");

  const first = await runtime.exported.commands.GameRoomFateKnotsChoice({
    provider: "ai1",
    roomArgs: { sessionId, stepId, choiceId },
  });
  const duplicate = await runtime.exported.commands.GameRoomFateKnotsChoice({
    provider: "ai1",
    roomArgs: { sessionId, stepId, choiceId },
  });

  assert.equal(first?.success, true);
  assert.equal(duplicate?.success, true);
  const nextState = runtime.latestFateKnotsState();
  assert.equal(nextState?.decision?.votes?.ai1, choiceId);
  assert.deepEqual(nextState?.decision?.pendingSeatIds ?? [], ["user"]);
  assert.equal(nextState?.phase, "scenario");
});

test("game-room host enters decision-timeout desync and sync re-dispatches the pending AI prompt", async () => {
  const runtime = createRoomHostRuntime();
  const state = await startRunIntoScenario(runtime);
  const storedState = runtime.state.get("fate-knots-game");

  storedState.waiting.deadlineAt = Date.now() - 1000;
  storedState.waiting.pendingSeatIds = ["ai1"];
  runtime.state.set("fate-knots-game", storedState);

  await runtime.emitHostContext(buildHostContext({ ai1Ready: true, ai2Ready: false, us1Ready: false }));

  let nextState = runtime.latestFateKnotsState();
  assert.equal(nextState?.waiting?.mode, "desync");
  assert.equal(nextState?.statusKey, "decisionTimeout");

  const protocolCountBefore = runtime.protocolCalls.length;
  const messageCountBefore = runtime.messageCalls.length;
  const syncResult = await runtime.exported.commands.GameRoomFateKnotsSync({
    provider: "room-ui",
    roomArgs: { sessionId: state?.sessionId },
  });

  assert.equal(syncResult?.success, true);
  nextState = runtime.latestFateKnotsState();
  assert.equal(nextState?.waiting?.mode, "decision");
  assert.equal(nextState?.statusKey, "waitingDecision");
  assert.equal(runtime.protocolCalls.length > protocolCountBefore, true);
  assert.equal(runtime.messageCalls.length > messageCountBefore, true);
  assert.equal(runtime.messageCalls.at(-1)?.provider, "ai1");
});

test("game-room host rejects stale Fate Knots combat turn payloads without advancing combat", async () => {
  const runtime = createRoomHostRuntime();
  const state = await advanceRunToCombat(runtime);
  const turn = state?.combat?.turn as Record<string, unknown> | undefined;
  const provider = turn?.seatId === "user" ? "room-ui" : String(turn?.seatId ?? "");
  const actionId = String(state?.combat?.availableActions?.[0]?.id ?? "");
  const turnId = String(state?.combat?.turnId ?? "");

  const result = await runtime.exported.commands.GameRoomFateKnotsCombatAction({
    provider,
    roomArgs: {
      sessionId: state?.sessionId,
      encounterId: state?.combat?.encounterId,
      turnId: `${turnId}:stale`,
      actionId,
    },
  });

  assert.equal(result?.success, false);
  assert.match(String(result?.message ?? ""), /stale/i);
  assert.equal(runtime.latestFateKnotsState()?.combat?.turnId, turnId);
});

test("game-room host persists the local build profile and stores additive DM/NPC packets", async () => {
  const runtime = createRoomHostRuntime();
  const state = await startRunIntoScenario(runtime);

  const profile = runtime.state.get("fate-knots-profile") as Record<string, unknown> | undefined;
  assert.equal(profile?.avatarId, "warrior_avatar");
  assert.equal(profile?.classId, "warrior");
  assert.equal(profile?.backgroundId, "former_soldier");

  const dmResult = await runtime.exported.commands.GameRoomFateKnotsDmPacket({
    provider: "ai1",
    roomArgs: {
      sessionId: state?.sessionId,
      phase: "scenario",
      stepId: state?.currentStep?.id,
      text: "The square holds its breath as the knot tightens.",
    },
  });
  const npcResult = await runtime.exported.commands.GameRoomFateKnotsNpcBanter({
    provider: "ai2",
    roomArgs: {
      sessionId: state?.sessionId,
      phase: "scenario",
      seatId: "ai1",
      stepId: state?.currentStep?.id,
      text: "We still have the light. Keep moving.",
    },
  });

  assert.equal(dmResult?.success, true);
  assert.equal(npcResult?.success, true);
  const nextState = runtime.latestFateKnotsState();
  assert.equal(nextState?.dmNarration?.text, "The square holds its breath as the knot tightens.");
  assert.equal(nextState?.npcBanter?.seatId, "ai1");
  assert.equal(nextState?.npcBanter?.text, "We still have the light. Keep moving.");
});

test("game-room host stores run history after a combat victory finalizes the slice", async () => {
  const runtime = createRoomHostRuntime();
  let currentState = await advanceRunToCombat(runtime);
  let iterations = 0;

  while (currentState?.phase === "combat" && iterations < 12) {
    const provider =
      currentState?.combat?.turn?.seatId === "user"
        ? "room-ui"
        : String(currentState?.combat?.turn?.seatId ?? "");
    const actionId = String(currentState?.combat?.availableActions?.[0]?.id ?? "");

    const result = await runtime.exported.commands.GameRoomFateKnotsCombatAction({
      provider,
      roomArgs: {
        sessionId: currentState?.sessionId,
        encounterId: currentState?.combat?.encounterId,
        turnId: currentState?.combat?.turnId,
        actionId,
      },
    });

    assert.equal(result?.success, true);
    currentState = runtime.latestFateKnotsState();
    iterations += 1;
  }

  assert.equal(currentState?.phase, "result");
  const history = runtime.state.get("fate-knots-history") as Array<Record<string, unknown>> | undefined;
  assert.equal(Array.isArray(history), true);
  assert.equal(history?.[0]?.sessionId, currentState?.sessionId);
});
