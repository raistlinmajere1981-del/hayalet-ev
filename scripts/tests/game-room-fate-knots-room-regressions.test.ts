import test from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";

import { validateRoomManifest } from "../../src/types/rooms.ts";
import { loadWorkspaceScriptForVm } from "./helpers/room-workspace-script.ts";

const requiredFiles = [
  "rooms/game-room/host/runtime.ts",
  "rooms/game-room/shared/host/activation.ts",
  "rooms/game-room/shared/host/command-registry.ts",
  "rooms/game-room/shared/ui/feature-contract.ts",
  "rooms/game-room/shared/ui/scroll-runtime.ts",
  "rooms/game-room/shared/types/room-shell-contracts.ts",
  "rooms/game-room/ui/game-room-ui-bootstrap.ts",
  "rooms/game-room/ui/game-room-ui-state-message-runtime.ts",
  "rooms/game-room/ui/game-room-ui-runtime.ts",
  "rooms/game-room/main-functions/fate-knots/assets/fate-knots-view.webp",
  "rooms/game-room/main-functions/fate-knots/data/asset-import.manifest.json",
  "rooms/game-room/main-functions/fate-knots/data/runtime-assets.manifest.json",
  "rooms/game-room/main-functions/fate-knots/data/runtime-assets-world.module.ts",
  "rooms/game-room/main-functions/fate-knots/data/runtime-assets-ui.module.ts",
  "rooms/game-room/main-functions/fate-knots/data/runtime-assets.module.ts",
  "rooms/game-room/main-functions/fate-knots/data/runtime-content.module.ts",
  "rooms/game-room/main-functions/fate-knots/data/selections.module.ts",
  "rooms/game-room/main-functions/fate-knots/data/map.module.ts",
  "rooms/game-room/main-functions/fate-knots/data/selections.manifest.json",
  "rooms/game-room/main-functions/fate-knots/data/map.manifest.json",
  "rooms/game-room/main-functions/fate-knots/data/scenarios/intro.module.ts",
  "rooms/game-room/main-functions/fate-knots/data/scenarios/intro.manifest.json",
  "rooms/game-room/main-functions/fate-knots/data/combat/cards.module.ts",
  "rooms/game-room/main-functions/fate-knots/data/combat/cards.manifest.json",
  "rooms/game-room/main-functions/fate-knots/data/combat/config.module.ts",
  "rooms/game-room/main-functions/fate-knots/data/combat/config.manifest.json",
  "rooms/game-room/main-functions/fate-knots/host/runtime.ts",
  "rooms/game-room/main-functions/fate-knots/host/command-runtime.ts",
  "rooms/game-room/main-functions/fate-knots/host/context-runtime.ts",
  "rooms/game-room/main-functions/fate-knots/host/combat-engine.ts",
  "rooms/game-room/main-functions/fate-knots/host/combat-state.ts",
  "rooms/game-room/main-functions/fate-knots/host/combat-turns.ts",
  "rooms/game-room/main-functions/fate-knots/host/phase-runtime.ts",
  "rooms/game-room/main-functions/fate-knots/host/prompt-runtime.ts",
  "rooms/game-room/main-functions/fate-knots/host/session-support.ts",
  "rooms/game-room/main-functions/fate-knots/host/session-participants.ts",
  "rooms/game-room/main-functions/fate-knots/host/session-runtime.ts",
  "rooms/game-room/main-functions/fate-knots/host/models.ts",
  "rooms/game-room/main-functions/fate-knots/host/models-roster.ts",
  "rooms/game-room/main-functions/fate-knots/host/models-memory.ts",
  "rooms/game-room/main-functions/fate-knots/host/models-state.ts",
  "rooms/game-room/main-functions/fate-knots/host/state.ts",
  "rooms/game-room/main-functions/fate-knots/host/content-loader-shared.ts",
  "rooms/game-room/main-functions/fate-knots/host/content-loader-selections.ts",
  "rooms/game-room/main-functions/fate-knots/host/content-loader-world.ts",
  "rooms/game-room/main-functions/fate-knots/host/content-loader-combat.ts",
  "rooms/game-room/main-functions/fate-knots/ui/state-defaults-runtime.ts",
  "rooms/game-room/main-functions/fate-knots/ui/state-sanitize-runtime.ts",
  "rooms/game-room/main-functions/fate-knots/ui/state-support-runtime.ts",
  "rooms/game-room/main-functions/fate-knots/ui/state-runtime.ts",
  "rooms/game-room/main-functions/fate-knots/ui/surface-assets-runtime.ts",
  "rooms/game-room/main-functions/fate-knots/ui/surface-primitives-runtime.ts",
  "rooms/game-room/main-functions/fate-knots/ui/surface-map-runtime.ts",
  "rooms/game-room/main-functions/fate-knots/ui/surface-runtime.ts",
  "rooms/game-room/main-functions/fate-knots/ui/chrome-runtime.ts",
  "rooms/game-room/main-functions/fate-knots/ui/journey-overview-runtime.ts",
  "rooms/game-room/main-functions/fate-knots/ui/journey-creation-runtime.ts",
  "rooms/game-room/main-functions/fate-knots/ui/journey-stage-runtime.ts",
  "rooms/game-room/main-functions/fate-knots/ui/stage-support-runtime.ts",
  "rooms/game-room/main-functions/fate-knots/ui/stage-narrative-runtime.ts",
  "rooms/game-room/main-functions/fate-knots/ui/stage-combat-runtime.ts",
  "rooms/game-room/main-functions/fate-knots/ui/stage-runtime.ts",
  "rooms/game-room/main-functions/fate-knots/ui/module.ts",
  "rooms/game-room/main-functions/fate-knots/styles.css",
  "rooms/game-room/main-functions/fate-knots/styles/shell.css",
  "rooms/game-room/main-functions/fate-knots/styles/layout.css",
  "rooms/game-room/main-functions/fate-knots/styles/components.css",
  "rooms/game-room/main-functions/fate-knots/styles/presentation.css",
  "rooms/game-room/main-functions/fate-knots/protocols/game-room-fate-knots-ai-decision.md",
  "rooms/game-room/main-functions/fate-knots/protocols/game-room-fate-knots-ai-combat.md",
  "rooms/game-room/main-functions/fate-knots/protocols/game-room-fate-knots-ai-dm.md",
  "rooms/game-room/main-functions/fate-knots/protocols/game-room-fate-knots-ai-npc.md",
  "rooms/game-room/main-functions/fate-knots/protocols/game-room-fate-knots-us1-transport.md",
  "rooms/game-room/main-functions/fate-knots/scripts/sync-assets.mjs",
];

test("game-room workspace keeps the required Fate Knots package files", () => {
  requiredFiles.forEach((filePath) => {
    assert.equal(existsSync(filePath), true, filePath);
  });
});

test("game-room manifest exposes Fate Knots as a scene-ready third feature", () => {
  const manifest = JSON.parse(readFileSync("rooms/game-room/manifest.json", "utf8"));
  const validation = validateRoomManifest(manifest);

  assert.equal(validation.valid, true);
  const feature = validation.manifest?.features.find((entry) => entry.id === "fate-knots");

  assert.ok(feature);
  assert.equal(feature?.scene?.hotspot.id, "game-room-fate-knots");
  assert.equal(feature?.scene?.view.id, "fate-knots-closeup");
  assert.equal(
    feature?.scene?.view.backgroundSrc,
    "main-functions/fate-knots/assets/fate-knots-view.webp"
  );
  assert.deepEqual(
    feature?.protocolSpecs?.map((entry) => entry.key),
    [
      "game-room-fate-knots-ai-decision",
      "game-room-fate-knots-ai-combat",
      "game-room-fate-knots-ai-dm",
      "game-room-fate-knots-ai-npc",
      "game-room-fate-knots-us1-transport",
    ]
  );
  assert.deepEqual(
    feature?.commandSpecs?.map((entry) => entry.name),
    [
      "GameRoomFateKnotsStart",
      "GameRoomFateKnotsReset",
      "GameRoomFateKnotsReady",
      "GameRoomFateKnotsCharacterSelect",
      "GameRoomFateKnotsChoice",
      "GameRoomFateKnotsCombatAction",
      "GameRoomFateKnotsSync",
      "GameRoomFateKnotsEnd",
      "GameRoomFateKnotsAiChoice",
      "GameRoomFateKnotsAiCombatAction",
      "GameRoomFateKnotsRemoteChoice",
      "GameRoomFateKnotsRemoteCombatAction",
      "GameRoomFateKnotsDmPacket",
      "GameRoomFateKnotsNpcBanter",
    ]
  );
});

test("game-room Fate Knots shell wiring is present in UI and host entrypoints", () => {
  const uiEntrySource = loadWorkspaceScriptForVm("rooms/game-room/ui/index.ts");
  const uiRuntimeSource = loadWorkspaceScriptForVm("rooms/game-room/ui/game-room-ui-runtime.ts");
  const indexHtmlSource = readFileSync("rooms/game-room/ui/index.html", "utf8");
  const fateKnotsStylesSource = readFileSync(
    "rooms/game-room/main-functions/fate-knots/styles.css",
    "utf8"
  );
  const hostRuntimeSource = loadWorkspaceScriptForVm("rooms/game-room/host/runtime.ts");
  const fateKnotsHostRuntimeSource = loadWorkspaceScriptForVm(
    "rooms/game-room/main-functions/fate-knots/host/runtime.ts"
  );
  const fateKnotsCommandRuntimeSource = loadWorkspaceScriptForVm(
    "rooms/game-room/main-functions/fate-knots/host/command-runtime.ts"
  );
  const fateKnotsContextRuntimeSource = loadWorkspaceScriptForVm(
    "rooms/game-room/main-functions/fate-knots/host/context-runtime.ts"
  );
  const fateKnotsCombatEngineSource = loadWorkspaceScriptForVm(
    "rooms/game-room/main-functions/fate-knots/host/combat-engine.ts"
  );
  const fateKnotsCombatStateSource = loadWorkspaceScriptForVm(
    "rooms/game-room/main-functions/fate-knots/host/combat-state.ts"
  );
  const fateKnotsCombatTurnsSource = loadWorkspaceScriptForVm(
    "rooms/game-room/main-functions/fate-knots/host/combat-turns.ts"
  );
  const fateKnotsModelsSource = loadWorkspaceScriptForVm(
    "rooms/game-room/main-functions/fate-knots/host/models.ts"
  );
  const fateKnotsModelsRosterSource = loadWorkspaceScriptForVm(
    "rooms/game-room/main-functions/fate-knots/host/models-roster.ts"
  );
  const fateKnotsModelsMemorySource = loadWorkspaceScriptForVm(
    "rooms/game-room/main-functions/fate-knots/host/models-memory.ts"
  );
  const fateKnotsModelsStateSource = loadWorkspaceScriptForVm(
    "rooms/game-room/main-functions/fate-knots/host/models-state.ts"
  );
  const fateKnotsSessionSupportSource = loadWorkspaceScriptForVm(
    "rooms/game-room/main-functions/fate-knots/host/session-support.ts"
  );
  const fateKnotsSessionParticipantsSource = loadWorkspaceScriptForVm(
    "rooms/game-room/main-functions/fate-knots/host/session-participants.ts"
  );
  const fateKnotsSessionRuntimeSource = loadWorkspaceScriptForVm(
    "rooms/game-room/main-functions/fate-knots/host/session-runtime.ts"
  );
  const teamTetrisRuntimeSyncSource = loadWorkspaceScriptForVm(
    "rooms/game-room/main-functions/team-tetris/host/runtime-sync.ts"
  );
  const xoxRuntimeSource = loadWorkspaceScriptForVm(
    "rooms/game-room/main-functions/xox/host/runtime.ts"
  );
  const xoxRuntimeSyncSource = loadWorkspaceScriptForVm(
    "rooms/game-room/main-functions/xox/host/runtime-sync.ts"
  );
  const fateKnotsUiModuleSource = loadWorkspaceScriptForVm(
    "rooms/game-room/main-functions/fate-knots/ui/module.ts"
  );
  const fateKnotsUiStateDefaultsRuntimeSource = loadWorkspaceScriptForVm(
    "rooms/game-room/main-functions/fate-knots/ui/state-defaults-runtime.ts"
  );
  const fateKnotsUiStateSanitizeRuntimeSource = loadWorkspaceScriptForVm(
    "rooms/game-room/main-functions/fate-knots/ui/state-sanitize-runtime.ts"
  );
  const fateKnotsUiStateSupportRuntimeSource = loadWorkspaceScriptForVm(
    "rooms/game-room/main-functions/fate-knots/ui/state-support-runtime.ts"
  );
  const fateKnotsUiStateRuntimeSource = loadWorkspaceScriptForVm(
    "rooms/game-room/main-functions/fate-knots/ui/state-runtime.ts"
  );
  const fateKnotsUiSurfaceAssetsRuntimeSource = loadWorkspaceScriptForVm(
    "rooms/game-room/main-functions/fate-knots/ui/surface-assets-runtime.ts"
  );
  const fateKnotsUiSurfacePrimitivesRuntimeSource = loadWorkspaceScriptForVm(
    "rooms/game-room/main-functions/fate-knots/ui/surface-primitives-runtime.ts"
  );
  const fateKnotsUiSurfaceMapRuntimeSource = loadWorkspaceScriptForVm(
    "rooms/game-room/main-functions/fate-knots/ui/surface-map-runtime.ts"
  );
  const fateKnotsUiSurfaceRuntimeSource = loadWorkspaceScriptForVm(
    "rooms/game-room/main-functions/fate-knots/ui/surface-runtime.ts"
  );
  const fateKnotsUiChromeRuntimeSource = loadWorkspaceScriptForVm(
    "rooms/game-room/main-functions/fate-knots/ui/chrome-runtime.ts"
  );
  const fateKnotsUiJourneyOverviewRuntimeSource = loadWorkspaceScriptForVm(
    "rooms/game-room/main-functions/fate-knots/ui/journey-overview-runtime.ts"
  );
  const fateKnotsUiJourneyCreationRuntimeSource = loadWorkspaceScriptForVm(
    "rooms/game-room/main-functions/fate-knots/ui/journey-creation-runtime.ts"
  );
  const fateKnotsUiJourneyStageRuntimeSource = loadWorkspaceScriptForVm(
    "rooms/game-room/main-functions/fate-knots/ui/journey-stage-runtime.ts"
  );
  const fateKnotsRuntimeAssetsWorldModuleSource = loadWorkspaceScriptForVm(
    "rooms/game-room/main-functions/fate-knots/data/runtime-assets-world.module.ts"
  );
  const fateKnotsRuntimeAssetsUiModuleSource = loadWorkspaceScriptForVm(
    "rooms/game-room/main-functions/fate-knots/data/runtime-assets-ui.module.ts"
  );
  const fateKnotsRuntimeAssetsModuleSource = loadWorkspaceScriptForVm(
    "rooms/game-room/main-functions/fate-knots/data/runtime-assets.module.ts"
  );
  const fateKnotsUiStageSupportRuntimeSource = loadWorkspaceScriptForVm(
    "rooms/game-room/main-functions/fate-knots/ui/stage-support-runtime.ts"
  );
  const fateKnotsUiStageNarrativeRuntimeSource = loadWorkspaceScriptForVm(
    "rooms/game-room/main-functions/fate-knots/ui/stage-narrative-runtime.ts"
  );
  const fateKnotsUiStageCombatRuntimeSource = loadWorkspaceScriptForVm(
    "rooms/game-room/main-functions/fate-knots/ui/stage-combat-runtime.ts"
  );
  const fateKnotsUiStageRuntimeSource = loadWorkspaceScriptForVm(
    "rooms/game-room/main-functions/fate-knots/ui/stage-runtime.ts"
  );
  const fateKnotsAssetRegistrySource = loadWorkspaceScriptForVm(
    "rooms/game-room/main-functions/fate-knots/host/asset-registry.ts"
  );
  const fateKnotsContentLoaderSource = loadWorkspaceScriptForVm(
    "rooms/game-room/main-functions/fate-knots/host/content-loader.ts"
  );
  const fateKnotsContentLoaderSharedSource = loadWorkspaceScriptForVm(
    "rooms/game-room/main-functions/fate-knots/host/content-loader-shared.ts"
  );
  const fateKnotsContentLoaderSelectionsSource = loadWorkspaceScriptForVm(
    "rooms/game-room/main-functions/fate-knots/host/content-loader-selections.ts"
  );
  const fateKnotsContentLoaderWorldSource = loadWorkspaceScriptForVm(
    "rooms/game-room/main-functions/fate-knots/host/content-loader-world.ts"
  );
  const fateKnotsContentLoaderCombatSource = loadWorkspaceScriptForVm(
    "rooms/game-room/main-functions/fate-knots/host/content-loader-combat.ts"
  );

  assert.match(indexHtmlSource, /main-functions\/fate-knots\/ui\/module\.js/);
  assert.match(indexHtmlSource, /game-room-ui-bootstrap\.js/);
  assert.match(indexHtmlSource, /game-room-ui-state-message-runtime\.js/);
  assert.match(indexHtmlSource, /main-functions\/fate-knots\/ui\/state-defaults-runtime\.js/);
  assert.match(indexHtmlSource, /main-functions\/fate-knots\/ui\/state-sanitize-runtime\.js/);
  assert.match(indexHtmlSource, /main-functions\/fate-knots\/ui\/state-support-runtime\.js/);
  assert.match(indexHtmlSource, /main-functions\/fate-knots\/ui\/state-runtime\.js/);
  assert.match(indexHtmlSource, /main-functions\/fate-knots\/ui\/surface-assets-runtime\.js/);
  assert.match(indexHtmlSource, /main-functions\/fate-knots\/ui\/surface-primitives-runtime\.js/);
  assert.match(indexHtmlSource, /main-functions\/fate-knots\/ui\/surface-map-runtime\.js/);
  assert.match(indexHtmlSource, /main-functions\/fate-knots\/ui\/surface-runtime\.js/);
  assert.match(indexHtmlSource, /main-functions\/fate-knots\/ui\/chrome-runtime\.js/);
  assert.match(indexHtmlSource, /main-functions\/fate-knots\/ui\/journey-overview-runtime\.js/);
  assert.match(indexHtmlSource, /main-functions\/fate-knots\/ui\/journey-creation-runtime\.js/);
  assert.match(indexHtmlSource, /main-functions\/fate-knots\/ui\/journey-stage-runtime\.js/);
  assert.match(indexHtmlSource, /main-functions\/fate-knots\/ui\/stage-support-runtime\.js/);
  assert.match(indexHtmlSource, /main-functions\/fate-knots\/ui\/stage-narrative-runtime\.js/);
  assert.match(indexHtmlSource, /main-functions\/fate-knots\/ui\/stage-combat-runtime\.js/);
  assert.match(fateKnotsStylesSource, /@import "\.\/styles\/shell\.css"/);
  assert.match(fateKnotsStylesSource, /@import "\.\/styles\/layout\.css"/);
  assert.match(fateKnotsStylesSource, /@import "\.\/styles\/components\.css"/);
  assert.match(fateKnotsStylesSource, /@import "\.\/styles\/presentation\.css"/);
  assert.match(indexHtmlSource, /shared\/ui\/scroll-runtime\.js/);
  assert.match(uiEntrySource, /createGameRoomUiRuntime\(\)\.start\(\)/);
  assert.match(uiRuntimeSource, /(messageType|message\.type) === "fate-knots-state"/);
  assert.match(uiRuntimeSource, /getActiveFeatureId\(\) === fateKnotsFeatureId/);
  assert.match(hostRuntimeSource, /FATE_KNOTS_COMMAND_NAMES/);
  assert.match(fateKnotsHostRuntimeSource, /\.\/command-runtime\.js/);
  assert.match(fateKnotsHostRuntimeSource, /\.\/context-runtime\.js/);
  assert.match(fateKnotsCommandRuntimeSource, /\.\/combat-engine\.js/);
  assert.match(fateKnotsCommandRuntimeSource, /\.\/phase-runtime\.js/);
  assert.match(fateKnotsCommandRuntimeSource, /\.\/prompt-runtime\.js/);
  assert.match(fateKnotsCommandRuntimeSource, /\.\/session-support\.js/);
  assert.match(fateKnotsCommandRuntimeSource, /export async function dispatchPendingWork/);
  assert.match(fateKnotsContextRuntimeSource, /\.\/session-support\.js/);
  assert.match(fateKnotsContextRuntimeSource, /export function syncFromContext/);
  assert.match(fateKnotsCombatEngineSource, /\.\/combat-state\.js/);
  assert.match(fateKnotsCombatEngineSource, /\.\/combat-turns\.js/);
  assert.match(fateKnotsCombatStateSource, /export function createFateKnotsCombatState\(options\)/);
  assert.match(
    fateKnotsCombatStateSource,
    /export function cloneFateKnotsCombatState\(candidate\)/
  );
  assert.match(
    fateKnotsCombatTurnsSource,
    /export function applyFateKnotsCombatAction\(combat, seatId, actionId, cardsById\)/
  );
  assert.match(
    fateKnotsCombatTurnsSource,
    /export function settleAutomaticFateKnotsCombatTurns\(combat, enemyActionsById\)/
  );
  assert.match(fateKnotsModelsSource, /\.\/models-roster\.js/);
  assert.match(fateKnotsModelsSource, /\.\/models-memory\.js/);
  assert.match(fateKnotsModelsSource, /\.\/models-state\.js/);
  assert.match(fateKnotsModelsRosterSource, /export function createParticipant\(options = \{\}\)/);
  assert.match(fateKnotsModelsRosterSource, /export function normalizeDecisionState\(candidate\)/);
  assert.match(fateKnotsModelsMemorySource, /export function createPromptDispatchState\(\)/);
  assert.match(fateKnotsModelsMemorySource, /export function normalizeHistoryState\(candidate\)/);
  assert.match(fateKnotsModelsStateSource, /export function createInitialFateKnotsState\(locale\)/);
  assert.match(
    fateKnotsModelsStateSource,
    /export function normalizeFateKnotsState\(candidate, localeFallback\)/
  );
  assert.match(fateKnotsUiStateDefaultsRuntimeSource, /createFateKnotsUiStateDefaultsRuntime/);
  assert.match(fateKnotsUiStateSanitizeRuntimeSource, /createFateKnotsUiStateSanitizeRuntime/);
  assert.match(fateKnotsUiStateSupportRuntimeSource, /createFateKnotsUiStateSupportRuntime/);
  assert.match(fateKnotsUiStateRuntimeSource, /createFateKnotsUiStateDefaultsRuntime/);
  assert.match(fateKnotsUiStateRuntimeSource, /createFateKnotsUiStateSanitizeRuntime/);
  assert.match(fateKnotsUiStateRuntimeSource, /createFateKnotsUiStateSupportRuntime/);
  assert.match(fateKnotsUiModuleSource, /createFateKnotsUiSurfaceRuntime/);
  assert.match(fateKnotsUiModuleSource, /createFateKnotsUiChromeRuntime/);
  assert.match(
    fateKnotsUiSurfaceRuntimeSource,
    /createFateKnotsUiSurfaceAssetsRuntime is unavailable/
  );
  assert.match(
    fateKnotsUiSurfaceRuntimeSource,
    /createFateKnotsUiSurfacePrimitivesRuntime is unavailable/
  );
  assert.match(
    fateKnotsUiSurfaceRuntimeSource,
    /createFateKnotsUiSurfaceMapRuntime is unavailable/
  );
  assert.match(fateKnotsUiSurfaceRuntimeSource, /\.\.\.fateKnotsUiSurfaceAssetsRuntime,/);
  assert.match(fateKnotsUiSurfaceRuntimeSource, /\.\.\.fateKnotsUiSurfacePrimitivesRuntime,/);
  assert.match(fateKnotsUiSurfaceRuntimeSource, /\.\.\.fateKnotsUiSurfaceMapRuntime,?/);
  assert.match(fateKnotsUiSurfaceAssetsRuntimeSource, /createFateKnotsUiSurfaceAssetsRuntime/);
  assert.match(fateKnotsUiSurfaceAssetsRuntimeSource, /function ensureUiAssetsPreloaded\(\)/);
  assert.match(
    fateKnotsUiSurfacePrimitivesRuntimeSource,
    /createFateKnotsUiSurfacePrimitivesRuntime/
  );
  assert.match(
    fateKnotsUiSurfacePrimitivesRuntimeSource,
    /function createActionButton\(label, variant, disabled, onClick\)/
  );
  assert.match(
    fateKnotsUiSurfacePrimitivesRuntimeSource,
    /function createCatalogCard\(entry, options\)/
  );
  assert.match(fateKnotsUiSurfaceMapRuntimeSource, /createFateKnotsUiSurfaceMapRuntime/);
  assert.match(
    fateKnotsUiSurfaceMapRuntimeSource,
    /function createSigil\(className, texture, overlay\)/
  );
  assert.match(
    fateKnotsUiSurfaceMapRuntimeSource,
    /function createMapPathLayer\(nodes, currentLocationId\)/
  );
  assert.match(fateKnotsUiChromeRuntimeSource, /function createTopbar\(state, phaseId\)/);
  assert.match(fateKnotsUiJourneyOverviewRuntimeSource, /createFateKnotsUiJourneyOverviewRuntime/);
  assert.match(
    fateKnotsUiJourneyOverviewRuntimeSource,
    /function renderOverviewStage\(parent, state\)/
  );
  assert.match(fateKnotsUiJourneyCreationRuntimeSource, /createFateKnotsUiJourneyCreationRuntime/);
  assert.match(
    fateKnotsUiJourneyCreationRuntimeSource,
    /function renderCreationStage\(parent, state\)/
  );
  assert.match(fateKnotsUiJourneyStageRuntimeSource, /createFateKnotsUiJourneyOverviewRuntime/);
  assert.match(fateKnotsUiJourneyStageRuntimeSource, /createFateKnotsUiJourneyCreationRuntime/);
  assert.match(
    fateKnotsRuntimeAssetsModuleSource,
    /import \{ fateKnotsRuntimeWorldAssetsManifest \} from "\.\/runtime-assets-world\.module\.js";/
  );
  assert.match(
    fateKnotsRuntimeAssetsModuleSource,
    /import \{ fateKnotsRuntimeUiAssetsManifest \} from "\.\/runtime-assets-ui\.module\.js";/
  );
  assert.match(
    fateKnotsRuntimeAssetsModuleSource,
    /export const fateKnotsRuntimeAssetsManifest = \{/
  );
  assert.match(
    fateKnotsRuntimeAssetsModuleSource,
    /\.\.\.fateKnotsRuntimeWorldAssetsManifest\.assets,/
  );
  assert.match(
    fateKnotsRuntimeAssetsModuleSource,
    /\.\.\.fateKnotsRuntimeUiAssetsManifest\.assets,?/
  );
  assert.match(
    fateKnotsRuntimeAssetsWorldModuleSource,
    /export const fateKnotsRuntimeWorldAssetsManifest = \{/
  );
  assert.match(
    fateKnotsRuntimeAssetsUiModuleSource,
    /export const fateKnotsRuntimeUiAssetsManifest = \{/
  );
  assert.match(fateKnotsUiStageSupportRuntimeSource, /createFateKnotsUiStageSupportRuntime/);
  assert.match(
    fateKnotsUiStageSupportRuntimeSource,
    /function createNarrationPanel\(state, role\)/
  );
  assert.match(fateKnotsUiStageNarrativeRuntimeSource, /createFateKnotsUiNarrativeStageRuntime/);
  assert.match(
    fateKnotsUiStageNarrativeRuntimeSource,
    /function renderNarrativeStage\(parent, state\)/
  );
  assert.match(fateKnotsUiStageCombatRuntimeSource, /createFateKnotsUiCombatStageRuntime/);
  assert.match(fateKnotsUiStageCombatRuntimeSource, /function renderCombatStage\(parent, state\)/);
  assert.match(fateKnotsUiStageRuntimeSource, /createFateKnotsUiStageSupportRuntime/);
  assert.match(fateKnotsUiStageRuntimeSource, /createFateKnotsUiNarrativeStageRuntime/);
  assert.match(fateKnotsUiStageRuntimeSource, /createFateKnotsUiCombatStageRuntime/);
  assert.match(fateKnotsSessionSupportSource, /\.\/session-participants\.js/);
  assert.match(fateKnotsSessionSupportSource, /\.\/session-runtime\.js/);
  assert.match(fateKnotsSessionParticipantsSource, /export function buildRunParticipants/);
  assert.match(fateKnotsSessionParticipantsSource, /export function persistProfileFromUser/);
  assert.match(fateKnotsSessionRuntimeSource, /export function setCombatWaiting/);
  assert.match(fateKnotsSessionRuntimeSource, /export function maybeMarkSeatLossOrTimeout/);
  assert.match(hostRuntimeSource, /handleFateKnotsDmPacket/);
  assert.match(teamTetrisRuntimeSyncSource, /FATE_KNOTS_FEATURE_ID/);
  assert.match(teamTetrisRuntimeSyncSource, /pushFateKnotsState/);
  assert.match(xoxRuntimeSource, /\.\/runtime-sync\.js/);
  assert.match(xoxRuntimeSyncSource, /fateKnotsSyncFromContext/);
  assert.match(fateKnotsContentLoaderSource, /\.\/content-loader-shared\.js/);
  assert.match(fateKnotsContentLoaderSource, /\.\/content-loader-selections\.js/);
  assert.match(fateKnotsContentLoaderSource, /\.\/content-loader-world\.js/);
  assert.match(fateKnotsContentLoaderSource, /\.\/content-loader-combat\.js/);
  assert.match(
    fateKnotsContentLoaderSharedSource,
    /export function readGeneratedManifest\(relativePath, value, fallback\)/
  );
  assert.match(
    fateKnotsContentLoaderSharedSource,
    /export function attachAsset\(assetRegistry, assetId, expectedKind\)/
  );
  assert.match(
    fateKnotsContentLoaderSelectionsSource,
    /export function normalizeSelectionsManifest\(assetRegistry, raw\)/
  );
  assert.match(
    fateKnotsContentLoaderWorldSource,
    /export function normalizeMapManifest\(assetRegistry, raw\)/
  );
  assert.match(
    fateKnotsContentLoaderWorldSource,
    /export function normalizeScenarioManifest\(assetRegistry, raw\)/
  );
  assert.match(
    fateKnotsContentLoaderCombatSource,
    /export function normalizeCombatCardsManifest\(assetRegistry, raw\)/
  );
  assert.match(
    fateKnotsContentLoaderCombatSource,
    /export function normalizeCombatConfigManifest\(assetRegistry, raw\)/
  );
  assert.doesNotMatch(fateKnotsAssetRegistrySource, /from "node:/);
  assert.doesNotMatch(fateKnotsAssetRegistrySource, /import\.meta\.url/);
  assert.doesNotMatch(fateKnotsContentLoaderSource, /from "node:/);
  assert.doesNotMatch(fateKnotsContentLoaderSource, /import\.meta\.url/);
});
