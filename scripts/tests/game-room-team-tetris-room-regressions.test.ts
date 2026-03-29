import test from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";

import { validateRoomManifest } from "../../src/types/rooms.ts";

const requiredFiles = [
  "rooms/game-room/host/runtime.js",
  "rooms/game-room/shared/host/activation.ts",
  "rooms/game-room/shared/host/command-registry.ts",
  "rooms/game-room/shared/ui/feature-contract.js",
  "rooms/game-room/shared/ui/scroll-runtime.js",
  "rooms/game-room/shared/types/room-shell-contracts.ts",
  "rooms/game-room/ui/game-room-ui-bootstrap.js",
  "rooms/game-room/ui/game-room-ui-state-message-runtime.js",
  "rooms/game-room/ui/game-room-ui-runtime.js",
  "rooms/game-room/main-functions/team-tetris/protocols/game-room-team-tetris-ai-opening.md",
  "rooms/game-room/main-functions/team-tetris/protocols/game-room-team-tetris-ai-followup.md",
  "rooms/game-room/main-functions/team-tetris/protocols/game-room-team-tetris-us1-transport.md",
  "rooms/game-room/shared/host/command-args.ts",
  "rooms/game-room/main-functions/team-tetris/host/engine-schema.js",
  "rooms/game-room/main-functions/team-tetris/host/engine-board.js",
  "rooms/game-room/main-functions/team-tetris/host/engine-match.js",
  "rooms/game-room/main-functions/team-tetris/host/engine-helpers.js",
  "rooms/game-room/main-functions/team-tetris/host/runtime-protocol.js",
  "rooms/game-room/main-functions/team-tetris/host/runtime-transport.js",
  "rooms/game-room/main-functions/team-tetris/host/runtime-sync.js",
  "rooms/game-room/main-functions/team-tetris/host/state.js",
  "rooms/game-room/main-functions/team-tetris/host/runtime.js",
  "rooms/game-room/main-functions/team-tetris/ui/draft-runtime.js",
  "rooms/game-room/main-functions/team-tetris/ui/state-shape-runtime.js",
  "rooms/game-room/main-functions/team-tetris/ui/state-view-runtime.js",
  "rooms/game-room/main-functions/team-tetris/ui/state-runtime.js",
  "rooms/game-room/main-functions/team-tetris/ui/module-card-runtime.js",
  "rooms/game-room/main-functions/team-tetris/ui/module-shell-runtime.js",
  "rooms/game-room/main-functions/team-tetris/ui/module.js",
  "rooms/game-room/main-functions/team-tetris/styles.css",
  "rooms/game-room/main-functions/team-tetris/styles/layout.css",
  "rooms/game-room/main-functions/team-tetris/styles/board.css",
  "rooms/game-room/main-functions/team-tetris/styles/presentation.css",
  "rooms/game-room/ui/context-runtime.js",
  "rooms/game-room/main-functions/xox/host/runtime.js",
  "rooms/game-room/main-functions/team-tetris/assets/team-tetris-view.webp",
];

test("game-room workspace keeps the required Team Tetris package files", () => {
  requiredFiles.forEach((filePath) => {
    assert.equal(existsSync(filePath), true, filePath);
  });
});

test("game-room manifest exposes Team Tetris as a second feature with scene metadata", () => {
  const manifest = JSON.parse(readFileSync("rooms/game-room/manifest.json", "utf8"));
  const validation = validateRoomManifest(manifest);

  assert.equal(validation.valid, true);
  const feature = validation.manifest?.features.find((entry) => entry.id === "team-tetris");

  assert.ok(feature);
  assert.equal(feature?.scene?.hotspot.id, "game-room-team-tetris");
  assert.equal(feature?.scene?.view.id, "team-tetris-closeup");
  assert.equal(
    feature?.scene?.view.backgroundSrc,
    "main-functions/team-tetris/assets/team-tetris-view.webp"
  );
  assert.deepEqual(
    feature?.commandSpecs?.map((entry) => entry.name),
    [
      "GameRoomTeamTetrisStart",
      "GameRoomTeamTetrisReset",
      "GameRoomTeamTetrisUserMove",
      "GameRoomTeamTetrisAiMove",
      "GameRoomTeamTetrisRemoteMove",
    ]
  );
  assert.deepEqual(
    feature?.protocolSpecs?.map((entry) => entry.key),
    [
      "game-room-team-tetris-ai-opening",
      "game-room-team-tetris-ai-followup",
      "game-room-team-tetris-us1-transport",
    ]
  );
});

test("game-room Team Tetris UI and host sources expose the new feature shell", () => {
  const uiEntrySource = readFileSync("rooms/game-room/ui/index.ts", "utf8");
  const uiRuntimeSource = readFileSync("rooms/game-room/ui/game-room-ui-runtime.js", "utf8");
  const indexHtmlSource = readFileSync("rooms/game-room/ui/index.html", "utf8");
  const teamTetrisStylesSource = readFileSync(
    "rooms/game-room/main-functions/team-tetris/styles.css",
    "utf8"
  );
  const teamTetrisUiStateRuntimeSource = readFileSync(
    "rooms/game-room/main-functions/team-tetris/ui/state-runtime.js",
    "utf8"
  );
  const teamTetrisUiStateShapeRuntimeSource = readFileSync(
    "rooms/game-room/main-functions/team-tetris/ui/state-shape-runtime.js",
    "utf8"
  );
  const teamTetrisUiStateViewRuntimeSource = readFileSync(
    "rooms/game-room/main-functions/team-tetris/ui/state-view-runtime.js",
    "utf8"
  );
  const teamTetrisUiSource = readFileSync(
    "rooms/game-room/main-functions/team-tetris/ui/module.js",
    "utf8"
  );
  const teamTetrisUiModuleCardRuntimeSource = readFileSync(
    "rooms/game-room/main-functions/team-tetris/ui/module-card-runtime.js",
    "utf8"
  );
  const teamTetrisUiModuleShellRuntimeSource = readFileSync(
    "rooms/game-room/main-functions/team-tetris/ui/module-shell-runtime.js",
    "utf8"
  );
  const teamTetrisEngineSource = readFileSync(
    "rooms/game-room/main-functions/team-tetris/host/engine.js",
    "utf8"
  );
  const teamTetrisEngineSchemaSource = readFileSync(
    "rooms/game-room/main-functions/team-tetris/host/engine-schema.js",
    "utf8"
  );
  const teamTetrisEngineBoardSource = readFileSync(
    "rooms/game-room/main-functions/team-tetris/host/engine-board.js",
    "utf8"
  );
  const teamTetrisEngineMatchSource = readFileSync(
    "rooms/game-room/main-functions/team-tetris/host/engine-match.js",
    "utf8"
  );
  const teamTetrisEngineHelpersSource = readFileSync(
    "rooms/game-room/main-functions/team-tetris/host/engine-helpers.js",
    "utf8"
  );
  const teamTetrisHostRuntimeSource = readFileSync(
    "rooms/game-room/main-functions/team-tetris/host/runtime.js",
    "utf8"
  );
  const teamTetrisHostProtocolSource = readFileSync(
    "rooms/game-room/main-functions/team-tetris/host/runtime-protocol.js",
    "utf8"
  );
  const teamTetrisHostTransportSource = readFileSync(
    "rooms/game-room/main-functions/team-tetris/host/runtime-transport.js",
    "utf8"
  );
  const teamTetrisHostSyncSource = readFileSync(
    "rooms/game-room/main-functions/team-tetris/host/runtime-sync.js",
    "utf8"
  );
  const hostEntrySource = readFileSync("rooms/game-room/host/index.ts", "utf8");
  const hostActivationSource = readFileSync("rooms/game-room/shared/host/activation.ts", "utf8");
  const xoxRuntimeSource = readFileSync(
    "rooms/game-room/main-functions/xox/host/runtime.js",
    "utf8"
  );
  const xoxRuntimeSyncSource = readFileSync(
    "rooms/game-room/main-functions/xox/host/runtime-sync.js",
    "utf8"
  );

  assert.match(indexHtmlSource, /<script src="\.\/context-runtime\.js"><\/script>/);
  assert.match(indexHtmlSource, /game-room-ui-bootstrap\.js/);
  assert.match(indexHtmlSource, /game-room-ui-state-message-runtime\.js/);
  assert.match(indexHtmlSource, /team-tetris\/ui\/draft-runtime\.js/);
  assert.match(indexHtmlSource, /team-tetris\/ui\/state-shape-runtime\.js/);
  assert.match(indexHtmlSource, /team-tetris\/ui\/state-view-runtime\.js/);
  assert.match(indexHtmlSource, /team-tetris\/ui\/state-runtime\.js/);
  assert.match(indexHtmlSource, /team-tetris\/ui\/module-card-runtime\.js/);
  assert.match(indexHtmlSource, /team-tetris\/ui\/module-shell-runtime\.js/);
  assert.match(indexHtmlSource, /shared\/ui\/feature-contract\.js/);
  assert.match(teamTetrisStylesSource, /@import "\.\/styles\/layout\.css"/);
  assert.match(teamTetrisStylesSource, /@import "\.\/styles\/board\.css"/);
  assert.match(teamTetrisStylesSource, /@import "\.\/styles\/presentation\.css"/);
  assert.match(indexHtmlSource, /game-room-ui-runtime\.js/);
  assert.match(uiEntrySource, /createGameRoomUiRuntime\(\)\.start\(\)/);
  assert.match(uiRuntimeSource, /message\.type === "team-tetris-state"/);
  assert.match(uiRuntimeSource, /getActiveFeatureId\(\) === teamTetrisFeatureId/);
  assert.match(teamTetrisUiStateRuntimeSource, /GameRoomTeamTetrisStart/);
  assert.match(teamTetrisUiStateRuntimeSource, /createTeamTetrisUiStateShapeRuntime/);
  assert.match(teamTetrisUiStateRuntimeSource, /createTeamTetrisUiStateViewRuntime/);
  assert.match(teamTetrisUiStateShapeRuntimeSource, /function sanitizeTeamTetrisState\(candidate\)/);
  assert.match(teamTetrisUiStateViewRuntimeSource, /function getTeamTetrisStatusText\(\)/);
  assert.match(teamTetrisUiSource, /createTeamTetrisUiStateRuntime/);
  assert.match(teamTetrisUiSource, /createTeamTetrisUiModuleCardRuntime/);
  assert.match(teamTetrisUiSource, /createTeamTetrisUiModuleShellRuntime/);
  assert.match(
    teamTetrisUiModuleCardRuntimeSource,
    /createTeamTetrisUiModuleCardRuntime/
  );
  assert.match(
    teamTetrisUiModuleShellRuntimeSource,
    /createTeamTetrisUiModuleShellRuntime/
  );
  assert.match(teamTetrisEngineSource, /from "\.\/engine-helpers\.js"/);
  assert.match(teamTetrisEngineHelpersSource, /from "\.\/engine-schema\.js"/);
  assert.match(teamTetrisEngineHelpersSource, /from "\.\/engine-board\.js"/);
  assert.match(teamTetrisEngineHelpersSource, /from "\.\/engine-match\.js"/);
  assert.match(teamTetrisEngineSchemaSource, /const TEAM_TETRIS_MOVE_SCHEMA = \{/);
  assert.match(
    teamTetrisEngineBoardSource,
    /function replayTeamTetrisPath\(board, pieceId, rotation, rowShifts\)/
  );
  assert.match(teamTetrisEngineBoardSource, /function clearTeamTetrisLines\(board\)/);
  assert.match(teamTetrisEngineMatchSource, /function createTeamTetrisMatch\(options\)/);
  assert.match(teamTetrisEngineMatchSource, /function buildTeamTetrisTurn\(match, turnIndex\)/);
  assert.match(teamTetrisHostRuntimeSource, /from "\.\/runtime-protocol\.js"/);
  assert.match(teamTetrisHostRuntimeSource, /from "\.\/runtime-transport\.js"/);
  assert.match(teamTetrisHostRuntimeSource, /from "\.\/runtime-sync\.js"/);
  assert.match(teamTetrisHostProtocolSource, /function buildTeamTetrisAiTurnMessage\(match, seatId\)/);
  assert.match(teamTetrisHostTransportSource, /async function sendTeamTetrisRemoteMove/);
  assert.match(teamTetrisHostSyncSource, /function serializeTeamTetrisState\(api, state, context\)/);
  assert.match(hostEntrySource, /createGameRoomHostRuntime\(\)/);
  assert.match(hostActivationSource, /pushActiveFeatureState\(api\)/);
  assert.match(xoxRuntimeSource, /from "\.\/runtime-sync\.js"/);
  assert.match(xoxRuntimeSyncSource, /resetTeamTetrisState\(api, "activeFeatureReset"\)/);
});
