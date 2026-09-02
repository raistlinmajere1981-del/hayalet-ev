import test from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";

import { validateRoomManifest } from "../../src/types/rooms.ts";

const FATE_KNOTS_COMMANDS = [
  "GameRoomFateKnotsGetHubState",
  "GameRoomFateKnotsActivateUniverse",
  "GameRoomFateKnotsGetRunSetup",
  "GameRoomFateKnotsCreateRun",
  "GameRoomFateKnotsStartRun",
  "GameRoomFateKnotsGetGameplayState",
  "GameRoomFateKnotsGetCombatOptions",
  "GameRoomFateKnotsGetCombatDiscussion",
  "GameRoomFateKnotsSendCombatMessage",
  "GameRoomFateKnotsAi2CombatMessage",
  "GameRoomFateKnotsRemoteCombatMessage",
  "GameRoomFateKnotsCompleteCombatMove",
  "GameRoomFateKnotsAi2CompleteCombatMove",
  "GameRoomFateKnotsRemoteCompleteCombatMove",
  "GameRoomFateKnotsResolveCombatTurn",
  "GameRoomFateKnotsActivateRun",
  "GameRoomFateKnotsDeleteRun",
  "GameRoomFateKnotsDeleteUniverse",
] as const;

void test("Game Room registers Fate Knots without inventing a scene layout", () => {
  const manifest = JSON.parse(readFileSync("rooms/game-room/manifest.json", "utf8")) as Record<
    string,
    unknown
  >;
  const validation = validateRoomManifest(manifest);

  assert.equal(validation.valid, true, validation.errors.join("\n"));
  assert.equal(validation.manifest?.version, "2.8.0");

  const feature = validation.manifest?.features.find((entry) => entry.id === "fate-knots");
  assert.ok(feature);
  assert.equal(feature.scene, undefined);
  assert.deepEqual(
    feature.commandSpecs?.map((entry) => entry.name),
    FATE_KNOTS_COMMANDS
  );
  const findSpec = (name: string) => feature.commandSpecs?.find((entry) => entry.name === name);
  assert.equal(findSpec("GameRoomFateKnotsGetGameplayState")?.scope, "room-ui");
  assert.equal(findSpec("GameRoomFateKnotsGetGameplayState")?.exposure, "internal");
  assert.equal(findSpec("GameRoomFateKnotsGetCombatDiscussion")?.scope, "room-ui");
  assert.equal(findSpec("GameRoomFateKnotsSendCombatMessage")?.scope, "room-ui");
  assert.equal(findSpec("GameRoomFateKnotsCompleteCombatMove")?.scope, "room-ui");
  assert.equal(findSpec("GameRoomFateKnotsResolveCombatTurn")?.scope, "room-ui");
  assert.equal(findSpec("GameRoomFateKnotsAi2CombatMessage")?.scope, "ai-slots");
  assert.equal(findSpec("GameRoomFateKnotsAi2CompleteCombatMove")?.scope, "ai-slots");
  assert.equal(findSpec("GameRoomFateKnotsRemoteCombatMessage")?.scope, "us1");
  assert.equal(findSpec("GameRoomFateKnotsRemoteCompleteCombatMove")?.scope, "us1");
  for (const name of FATE_KNOTS_COMMANDS) {
    assert.equal(findSpec(name)?.exposure, "internal", name);
  }
  assert.equal(
    feature.commandSpecs?.some(
      (entry) =>
        entry.name === "GameRoomFateKnotsSaveUniverse" || entry.name === "GameRoomFateKnotsSaveRun"
    ),
    false
  );
});

void test("Fate Knots neutral Hub loads before shared feature bootstrap", () => {
  const html = readFileSync("rooms/game-room/ui/index.html", "utf8");
  const gameRoomRuntime = readFileSync("rooms/game-room/ui/game-room-ui-runtime.ts", "utf8");
  const featureContractIndex = html.indexOf("../shared/ui/feature-contract.js");
  const yahtzeeBridgeIndex = html.indexOf("../main-functions/yahtzee/ui/bridge.js");
  const hubIndex = html.indexOf("../main-functions/fate-knots/ui/hub.js");
  const fateBridgeIndex = html.indexOf("../main-functions/fate-knots/ui/bridge.js");
  const bootstrapIndex = html.indexOf("./bootstrap.js");

  assert.match(html, /main-functions\/fate-knots\/ui\/hub\.css/);
  assert.ok(hubIndex >= 0);
  assert.ok(featureContractIndex > hubIndex);
  assert.ok(yahtzeeBridgeIndex >= 0);
  assert.ok(fateBridgeIndex > yahtzeeBridgeIndex);
  assert.ok(bootstrapIndex > fateBridgeIndex);
  assert.doesNotMatch(gameRoomRuntime, /GameRoomFateKnotsRefresh/);
  assert.doesNotMatch(gameRoomRuntime, /GameRoomFateKnotsHub/);

  [
    "rooms/game-room/main-functions/fate-knots/ui/hub.css",
    "rooms/game-room/main-functions/fate-knots/ui/hub.js",
    "rooms/game-room/main-functions/fate-knots/ui/bridge.js",
    "rooms/game-room/main-functions/fate-knots/ui/gameplay.css",
    "rooms/game-room/main-functions/fate-knots/ui/gameplay.js",
  ].forEach((filePath) => assert.equal(existsSync(filePath), true, filePath));
});

void test("Fate Knots host owns management, setup, run persistence and active-feature projection", () => {
  const hostRuntime = readFileSync("rooms/game-room/host/runtime.ts", "utf8");
  const durablePersistence = readFileSync(
    "rooms/game-room/main-functions/fate-knots/host/durable-persistence.ts",
    "utf8"
  );

  assert.match(hostRuntime, /FATE_KNOTS_FEATURE_ID/);
  assert.match(hostRuntime, /createFateKnotsForgeOrchestrator/);
  assert.match(hostRuntime, /createFateKnotsManagementCommands/);
  assert.match(hostRuntime, /createFateKnotsRunSetupCommands/);
  assert.match(hostRuntime, /createFateKnotsRunCommands/);
  assert.match(hostRuntime, /createFateKnotsGameplayCommands/);
  assert.match(hostRuntime, /createFateKnotsCombatResolutionCommands/);
  assert.match(hostRuntime, /pushFateKnotsHubState/);
  assert.match(hostRuntime, /fateKnotsForge\.getHubSnapshot\(\)/);
  assert.match(hostRuntime, /isFateKnotsPlayerSeatAvailable/);
  assert.match(hostRuntime, /context\.slots\.ai2\.dispatchable === true/);
  assert.match(hostRuntime, /context\.slots\.us1\.dispatchable === true/);
  assert.match(hostRuntime, /hydrateFateKnotsDurablePersistence\(api\)/);
  assert.match(hostRuntime, /withFateKnotsReady/);
  assert.match(hostRuntime, /FATE_KNOTS_MUTATION_COMMANDS\.has\(commandName\)/);
  assert.match(hostRuntime, /persistFateKnotsCommandMutation\(api,/);
  assert.match(hostRuntime, /pushFateKnotsHubStateWhenReady/);

  assert.match(durablePersistence, /interface FateKnotsDurableEnvelope/);
  assert.match(durablePersistence, /await writeStateEnvelope\(api\);/);
  assert.match(
    durablePersistence,
    /restoreCacheValue\(api, FATE_KNOTS_UNIVERSE_STORE_KEY, previousUniverse\)/
  );
  assert.match(
    durablePersistence,
    /restoreCacheValue\(api, FATE_KNOTS_RUN_STORE_KEY, previousRun\)/
  );
});

void test("player-safe gameplay projection is an explicit room-ui internal command", () => {
  const hostRuntime = readFileSync("rooms/game-room/host/runtime.ts", "utf8");
  const gameplayRuntime = readFileSync(
    "rooms/game-room/main-functions/fate-knots/host/gameplay-runtime.ts",
    "utf8"
  );
  const gameplayState = readFileSync(
    "rooms/game-room/main-functions/fate-knots/host/gameplay-state.ts",
    "utf8"
  );

  assert.match(hostRuntime, /api\.registerCommand\?\.\(/);
  assert.match(hostRuntime, /FATE_KNOTS_GAMEPLAY_COMMAND_NAMES\.getGameplayState/);
  assert.match(hostRuntime, /scope: "room-ui"/);
  assert.match(hostRuntime, /exposure: "internal"/);
  assert.doesNotMatch(hostRuntime, /\.\.\.fateKnotsGameplayCommands[\s\S]*const fateKnotsCommands/);

  assert.match(gameplayRuntime, /buildFateKnotsGameplayState\(canonical\.package, run\)/);
  assert.match(gameplayRuntime, /never returns raw canonical Universe\/Run objects/);
  assert.match(gameplayState, /combatActorById/);
  assert.match(gameplayState, /combat: summarizeCombat\(run\.activeCombat\)/);
  assert.match(gameplayState, /edge\.initiallyRevealed/);
  assert.doesNotMatch(gameplayState, /commits:/);
  assert.doesNotMatch(gameplayState, /hiddenKnotIds:/);
  assert.doesNotMatch(gameplayState, /finale:/);
  assert.doesNotMatch(gameplayState, /npcRoles:/);
});

void test("Fate Knots run setup exposes only explicit player-selectable start data", () => {
  const contracts = readFileSync(
    "rooms/game-room/main-functions/fate-knots/shared/contracts.ts",
    "utf8"
  );
  const setupState = readFileSync(
    "rooms/game-room/main-functions/fate-knots/host/run-setup-state.ts",
    "utf8"
  );
  const runSetup = readFileSync(
    "rooms/game-room/main-functions/fate-knots/host/run-setup.ts",
    "utf8"
  );

  assert.match(contracts, /playerSelectable: boolean/);
  assert.match(contracts, /startingPosition: FateKnotsPosition/);
  assert.match(contracts, /startNodeId: string/);

  assert.match(setupState, /character\.playerSelectable/);
  assert.match(setupState, /startingPosition: \{ \.\.\.character\.startingPosition \}/);
  assert.doesNotMatch(setupState, /hiddenKnotIds/);
  assert.doesNotMatch(setupState, /finale:/);
  assert.doesNotMatch(setupState, /npcRoles:/);

  assert.match(runSetup, /character\.playerSelectable !== true/);
  assert.match(runSetup, /position: \{ \.\.\.character\.startingPosition \}/);
  assert.match(runSetup, /universe\.map\.startNodeId/);
  assert.match(runSetup, /runInput\.phase !== "run-setup"/);
});

void test("Fate Knots neutral Hub prepares players only from the safe setup projection", () => {
  const hub = readFileSync("rooms/game-room/main-functions/fate-knots/ui/hub.js", "utf8");
  const bridge = readFileSync("rooms/game-room/main-functions/fate-knots/ui/bridge.js", "utf8");

  assert.match(hub, /GameRoomFateKnotsGetRunSetup/);
  assert.match(hub, /GameRoomFateKnotsCreateRun/);
  assert.match(hub, /GameRoomFateKnotsStartRun/);
  assert.match(hub, /PLAYER_SEAT_IDS = \["user", "ai2", "us1"\]/);
  assert.match(hub, /slot\.dispatchable === true/);
  assert.match(hub, /isCharacterAssignedElsewhere/);
  assert.match(hub, /Koşuyu hazırla/);
  assert.match(hub, /run\.phase === "run-setup"/);
  assert.doesNotMatch(hub, /hiddenKnotIds/);
  assert.doesNotMatch(hub, /npcRoles/);
  assert.doesNotMatch(hub, /finale/);

  assert.match(bridge, /handleCommandResult/);
  assert.match(bridge, /startsWith\("GameRoomFateKnots"\)/);
  assert.match(bridge, /setContext/);
  assert.match(bridge, /fate-knots-hub-state/);
});

void test("World Forge candidates pass a host-only canonical acceptance gate", () => {
  const acceptance = readFileSync(
    "rooms/game-room/main-functions/fate-knots/host/forge-acceptance.ts",
    "utf8"
  );
  const manifest = readFileSync("rooms/game-room/manifest.json", "utf8");
  const hub = readFileSync("rooms/game-room/main-functions/fate-knots/ui/hub.js", "utf8");

  assert.match(acceptance, /normalizeFateKnotsCanonicalUniversePackage\(candidate\)/);
  assert.match(acceptance, /saveFateKnotsUniverse\(api, canonical\.package\)/);
  assert.match(acceptance, /intentionally not a room-ui command/);
  assert.doesNotMatch(manifest, /GameRoomFateKnotsAcceptForgeCandidate/);
  assert.doesNotMatch(hub, /AcceptForgeCandidate/);
});

void test("World Forge lifecycle exposes progress without leaking request or candidate canon", () => {
  const orchestration = readFileSync(
    "rooms/game-room/main-functions/fate-knots/host/forge-orchestration.ts",
    "utf8"
  );
  const hubState = readFileSync(
    "rooms/game-room/main-functions/fate-knots/host/hub-state.ts",
    "utf8"
  );

  assert.match(orchestration, /"idle"/);
  assert.match(orchestration, /"generating"/);
  assert.match(orchestration, /"validating"/);
  assert.match(orchestration, /"accepted"/);
  assert.match(orchestration, /"failed"/);
  assert.match(orchestration, /available: boolean/);
  assert.match(orchestration, /acceptFateKnotsForgeCandidate\(api, candidate\)/);
  assert.match(orchestration, /state\.stage !== "validating"/);
  assert.match(orchestration, /normalizeFailureCode/);

  assert.match(hubState, /forge: FateKnotsForgeHubSnapshot/);
  assert.match(hubState, /forge: cloneForgeSnapshot\(forgeSnapshot\)/);
  assert.doesNotMatch(hubState, /requestId:/);
  assert.doesNotMatch(hubState, /candidate:/);
  assert.doesNotMatch(hubState, /prompt:/);
});

void test("AI0 runtime workspace uses managed Game Room storage instead of repository bootstrap", () => {
  const materializer = readFileSync(
    "rooms/game-room/main-functions/fate-knots/host/ai0-workspace.ts",
    "utf8"
  );
  const electronBridge = readFileSync(
    "rooms/game-room/main-functions/fate-knots/host/ai0-workspace-electron.ts",
    "utf8"
  );

  assert.match(materializer, /buildFateKnotsAi0WorkspaceSpec\(universeId\)/);
  assert.match(materializer, /await io\.deleteDirectory\(workspaceDir\)/);
  assert.match(materializer, /await io\.ensureDirectory\(workspaceDir\)/);
  assert.match(materializer, /const policyFile = spec\.files\[0\];/);
  assert.match(materializer, /\[policyFile\.relativePath\]/);
  assert.doesNotMatch(materializer, /\.rovo/);
  assert.doesNotMatch(materializer, /projectRoot/);

  assert.match(electronBridge, /operation: "resolve-paths"/);
  assert.match(electronBridge, /operation: "delete-path"/);
  assert.match(electronBridge, /operation: "ensure-dir"/);
  assert.match(electronBridge, /roomId: GAME_ROOM_ID/);
  assert.match(electronBridge, /fmWriteFileAtomic/);
  assert.match(electronBridge, /prepareFateKnotsAi0RuntimeWorkspace/);
  assert.doesNotMatch(electronBridge, /AGENTS\.md/);
  assert.doesNotMatch(electronBridge, /\.rovo/);
  assert.doesNotMatch(electronBridge, /projectRoot/);
});

void test("active Fate Knots sync emits Hub plus bounded gameplay state after run setup", () => {
  const runtimeSync = readFileSync(
    "rooms/game-room/main-functions/fate-knots/host/runtime-sync.ts",
    "utf8"
  );

  assert.match(runtimeSync, /readFateKnotsSessionState\(api\)/);
  assert.match(runtimeSync, /sessionRead\.value\.activeRunId/);
  assert.match(runtimeSync, /run\.phase === "run-setup"/);
  assert.match(runtimeSync, /normalizeFateKnotsCanonicalUniversePackage\(storedUniverse\)/);
  assert.match(runtimeSync, /buildFateKnotsGameplayState\(canonical\.package, run\)/);
  assert.match(runtimeSync, /"fate-knots-hub-state"/);
  assert.match(runtimeSync, /"fate-knots-gameplay-state"/);
  assert.match(runtimeSync, /state: gameplayState/);
  assert.doesNotMatch(runtimeSync, /activeCombat\.commits/);
  assert.doesNotMatch(runtimeSync, /hiddenKnotIds/);
  assert.doesNotMatch(runtimeSync, /finale/);
  assert.doesNotMatch(runtimeSync, /npcRoles/);
});

void test("Fate Knots browser bridge receives Hub projection rather than raw persistence authority", () => {
  const bridge = readFileSync("rooms/game-room/main-functions/fate-knots/ui/bridge.js", "utf8");

  assert.match(bridge, /fate-knots-hub-state/);
  assert.match(bridge, /GameRoomFateKnotsUi/);
  assert.doesNotMatch(bridge, /GameRoomFateKnotsSaveUniverse/);
  assert.doesNotMatch(bridge, /GameRoomFateKnotsSaveRun/);
});
