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
  assert.equal(
    feature.commandSpecs?.some(
      (entry) =>
        entry.name === "GameRoomFateKnotsSaveUniverse" || entry.name === "GameRoomFateKnotsSaveRun"
    ),
    false
  );
});

void test("Fate Knots neutral Hub loads after the Yahtzee wrapper and before UI bootstrap", () => {
  const html = readFileSync("rooms/game-room/ui/index.html", "utf8");
  const yahtzeeBridgeIndex = html.indexOf("../main-functions/yahtzee/ui/bridge.js");
  const hubIndex = html.indexOf("../main-functions/fate-knots/ui/hub.js");
  const fateBridgeIndex = html.indexOf("../main-functions/fate-knots/ui/bridge.js");
  const bootstrapIndex = html.indexOf("./bootstrap.js");

  assert.match(html, /main-functions\/fate-knots\/ui\/hub\.css/);
  assert.ok(yahtzeeBridgeIndex >= 0);
  assert.ok(hubIndex > yahtzeeBridgeIndex);
  assert.ok(fateBridgeIndex > hubIndex);
  assert.ok(bootstrapIndex > fateBridgeIndex);

  [
    "rooms/game-room/main-functions/fate-knots/ui/hub.css",
    "rooms/game-room/main-functions/fate-knots/ui/hub.js",
    "rooms/game-room/main-functions/fate-knots/ui/bridge.js",
  ].forEach((filePath) => assert.equal(existsSync(filePath), true, filePath));
});

void test("Fate Knots host owns management, setup, run persistence and active-feature projection", () => {
  const hostRuntime = readFileSync("rooms/game-room/host/runtime.ts", "utf8");

  assert.match(hostRuntime, /FATE_KNOTS_FEATURE_ID/);
  assert.match(hostRuntime, /createFateKnotsManagementCommands/);
  assert.match(hostRuntime, /createFateKnotsRunSetupCommands/);
  assert.match(hostRuntime, /createFateKnotsRunCommands/);
  assert.match(hostRuntime, /pushFateKnotsHubState/);
  assert.match(hostRuntime, /isFateKnotsPlayerSeatAvailable/);
  assert.match(hostRuntime, /context\.slots\.ai2\.dispatchable === true/);
  assert.match(hostRuntime, /context\.slots\.us1\.dispatchable === true/);
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

  assert.match(setupState, /character\.playerSelectable === true/);
  assert.match(setupState, /startingPosition: \{ \.\.\.character\.startingPosition \}/);
  assert.doesNotMatch(setupState, /hiddenKnotIds/);
  assert.doesNotMatch(setupState, /finale:/);
  assert.doesNotMatch(setupState, /npcRoles:/);

  assert.match(runSetup, /character\.playerSelectable !== true/);
  assert.match(runSetup, /position: \{ \.\.\.character\.startingPosition \}/);
  assert.match(runSetup, /universe\.map\.startNodeId/);
  assert.match(runSetup, /run\.phase !== "run-setup"/);
});

void test("Fate Knots browser bridge receives Hub projection rather than raw persistence authority", () => {
  const bridge = readFileSync(
    "rooms/game-room/main-functions/fate-knots/ui/bridge.js",
    "utf8"
  );

  assert.match(bridge, /fate-knots-hub-state/);
  assert.match(bridge, /GameRoomFateKnotsGetHubState/);
  assert.match(bridge, /GameRoomFateKnotsUi/);
  assert.doesNotMatch(bridge, /GameRoomFateKnotsSaveUniverse/);
  assert.doesNotMatch(bridge, /GameRoomFateKnotsSaveRun/);
});
