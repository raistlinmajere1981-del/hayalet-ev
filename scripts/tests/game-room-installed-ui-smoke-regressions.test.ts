import test from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync, statSync } from "node:fs";

import { createRoomInstalledCopy } from "./helpers/room-installed-copy.ts";

void test("game-room installed UI contains the Yahtzee presentation v2 and Fate Knots hub runtimes", async () => {
  const installedCopy = await createRoomInstalledCopy("game-room");

  try {
    const manifest = JSON.parse(readFileSync(`${installedCopy.rootDir}/manifest.json`, "utf8")) as {
      version?: string;
      features?: Array<{
        id?: string;
        scene?: unknown;
        commandSpecs?: Array<{ name?: string; scope?: string }>;
        protocolSpecs?: Array<{ key?: string; path?: string }>;
      }>;
    };
    assert.equal(manifest.version, "2.8.0");
    assert.deepEqual(
      manifest.features?.map((feature) => feature.id),
      ["backgammon", "team-tetris", "yahtzee", "fate-knots"]
    );

    const yahtzeeFeature = manifest.features?.find((feature) => feature.id === "yahtzee");
    assert.ok(yahtzeeFeature?.scene);
    assert.deepEqual(
      yahtzeeFeature?.commandSpecs?.map((entry) => entry.name),
      [
        "GameRoomYahtzeeStart",
        "GameRoomYahtzeeReset",
        "GameRoomYahtzeeRoll",
        "GameRoomYahtzeeToggleHold",
        "GameRoomYahtzeeScore",
        "GameRoomYahtzeeAiAction",
        "GameRoomYahtzeeRemoteStart",
        "GameRoomYahtzeeRemoteSync",
        "GameRoomYahtzeeRemoteReset",
      ]
    );
    assert.deepEqual(
      yahtzeeFeature?.protocolSpecs?.map((entry) => entry.key),
      ["game-room-yahtzee-ai-turn", "game-room-yahtzee-us1-transport"]
    );

    const fateKnotsFeature = manifest.features?.find((feature) => feature.id === "fate-knots");
    assert.ok(fateKnotsFeature);
    assert.equal(fateKnotsFeature.scene, undefined);
    assert.deepEqual(
      fateKnotsFeature.commandSpecs?.map((entry) => entry.name),
      [
        "GameRoomFateKnotsGetHubState",
        "GameRoomFateKnotsActivateUniverse",
        "GameRoomFateKnotsGetRunSetup",
        "GameRoomFateKnotsCreateRun",
        "GameRoomFateKnotsStartRun",
        "GameRoomFateKnotsActivateRun",
        "GameRoomFateKnotsDeleteRun",
        "GameRoomFateKnotsDeleteUniverse",
        "GameRoomFateKnotsGetGameplayState",
      ]
    );

    const gameplayStateCommand = fateKnotsFeature.commandSpecs?.find(
      (entry) => entry.name === "GameRoomFateKnotsGetGameplayState"
    );
    assert.equal(gameplayStateCommand?.scope, "room-ui");

    const indexHtml = readFileSync(`${installedCopy.rootDir}/ui/index.html`, "utf8");
    assert.match(indexHtml, /main-functions\/yahtzee\/styles\.css/);
    assert.match(indexHtml, /main-functions\/yahtzee\/vendor\/babylon\.min\.js/);
    assert.match(indexHtml, /main-functions\/yahtzee\/ui\/theme-pirate-deck\.js/);
    assert.match(indexHtml, /main-functions\/yahtzee\/ui\/camera-director\.js/);
    assert.match(indexHtml, /main-functions\/yahtzee\/ui\/babylon-scene\.js/);
    assert.match(indexHtml, /main-functions\/yahtzee\/ui\/audio-runtime\.js/);
    assert.match(indexHtml, /main-functions\/yahtzee\/ui\/runtime\.js/);
    assert.match(indexHtml, /main-functions\/yahtzee\/ui\/bridge\.js/);
    assert.match(indexHtml, /main-functions\/fate-knots\/ui\/hub\.css/);
    assert.match(indexHtml, /main-functions\/fate-knots\/ui\/hub\.js/);
    assert.match(indexHtml, /main-functions\/fate-knots\/ui\/bridge\.js/);
    assert.doesNotMatch(indexHtml, /main-functions\/yahtzee\/multiplayer\.css/);
    assert.doesNotMatch(indexHtml, /main-functions\/yahtzee\/hybrid-stage\.css/);
    assert.doesNotMatch(indexHtml, /main-functions\/yahtzee\/diegetic-stage\.css/);
    assert.doesNotMatch(indexHtml, /main-functions\/yahtzee\/ui\/hybrid-stage\.js/);
    assert.doesNotMatch(indexHtml, /main-functions\/yahtzee\/ui\/stage-template-bridge\.js/);

    const babylonRuntimeIndex = indexHtml.indexOf(
      "../main-functions/yahtzee/vendor/babylon.min.js"
    );
    const themeIndex = indexHtml.indexOf("../main-functions/yahtzee/ui/theme-pirate-deck.js");
    const cameraDirectorIndex = indexHtml.indexOf(
      "../main-functions/yahtzee/ui/camera-director.js"
    );
    const babylonSceneIndex = indexHtml.indexOf("../main-functions/yahtzee/ui/babylon-scene.js");
    const audioRuntimeIndex = indexHtml.indexOf("../main-functions/yahtzee/ui/audio-runtime.js");
    const yahtzeeRuntimeIndex = indexHtml.indexOf("../main-functions/yahtzee/ui/runtime.js");
    const yahtzeeBridgeIndex = indexHtml.indexOf("../main-functions/yahtzee/ui/bridge.js");
    const fateKnotsHubIndex = indexHtml.indexOf("../main-functions/fate-knots/ui/hub.js");
    const fateKnotsBridgeIndex = indexHtml.indexOf("../main-functions/fate-knots/ui/bridge.js");
    const bootstrapIndex = indexHtml.indexOf("./bootstrap.js");
    assert.ok(babylonRuntimeIndex >= 0 && babylonRuntimeIndex < themeIndex);
    assert.ok(themeIndex < cameraDirectorIndex);
    assert.ok(cameraDirectorIndex < babylonSceneIndex);
    assert.ok(babylonSceneIndex < audioRuntimeIndex);
    assert.ok(audioRuntimeIndex < yahtzeeRuntimeIndex);
    assert.ok(yahtzeeBridgeIndex >= 0 && yahtzeeBridgeIndex < fateKnotsHubIndex);
    assert.ok(fateKnotsHubIndex < fateKnotsBridgeIndex);
    assert.ok(fateKnotsBridgeIndex < bootstrapIndex);

    [
      `${installedCopy.rootDir}/main-functions/yahtzee/styles.css`,
      `${installedCopy.rootDir}/main-functions/yahtzee/vendor/babylon.min.js`,
      `${installedCopy.rootDir}/main-functions/yahtzee/vendor/LICENSE.babylonjs.md`,
      `${installedCopy.rootDir}/main-functions/yahtzee/vendor/NOTICE.babylonjs.md`,
      `${installedCopy.rootDir}/main-functions/yahtzee/ui/theme-pirate-deck.js`,
      `${installedCopy.rootDir}/main-functions/yahtzee/ui/camera-director.js`,
      `${installedCopy.rootDir}/main-functions/yahtzee/ui/babylon-scene.js`,
      `${installedCopy.rootDir}/main-functions/yahtzee/ui/audio-runtime.js`,
      `${installedCopy.rootDir}/main-functions/yahtzee/ui/runtime.js`,
      `${installedCopy.rootDir}/main-functions/yahtzee/ui/bridge.js`,
      `${installedCopy.rootDir}/main-functions/yahtzee/assets/hybrid/deck-stage-v3.webp`,
      `${installedCopy.rootDir}/main-functions/yahtzee/assets/hybrid/table-mahogany-v2.webp`,
      `${installedCopy.rootDir}/main-functions/yahtzee/assets/hybrid/table-felt-burgundy-v2.webp`,
      `${installedCopy.rootDir}/main-functions/yahtzee/protocols/game-room-yahtzee-ai-turn.md`,
      `${installedCopy.rootDir}/main-functions/yahtzee/protocols/game-room-yahtzee-us1-transport.md`,
      `${installedCopy.rootDir}/main-functions/fate-knots/ui/hub.css`,
      `${installedCopy.rootDir}/main-functions/fate-knots/ui/hub.js`,
      `${installedCopy.rootDir}/main-functions/fate-knots/ui/bridge.js`,
    ].forEach((filePath) => {
      assert.equal(existsSync(filePath), true, filePath);
    });

    const english = JSON.parse(readFileSync(`${installedCopy.rootDir}/i18n/en.json`, "utf8")) as {
      yahtzee?: { title?: string };
    };
    const turkish = JSON.parse(readFileSync(`${installedCopy.rootDir}/i18n/tr.json`, "utf8")) as {
      yahtzee?: { title?: string };
    };
    assert.equal(english.yahtzee?.title, "Pirate Deck Yahtzee");
    assert.equal(turkish.yahtzee?.title, "Korsan Güvertesi Yahtzee");

    const runtimeSource = readFileSync(
      `${installedCopy.rootDir}/main-functions/yahtzee/ui/runtime.js`,
      "utf8"
    );
    assert.match(runtimeSource, /translations && translations\.yahtzee/);
    assert.match(runtimeSource, /const MODES = \["solo", "local2", "ai1", "ai2", "us1"\]/);
    assert.match(runtimeSource, /GameRoomYahtzeeStart/);
    assert.match(runtimeSource, /mode: selectedMode/);
    assert.match(runtimeSource, /GameRoomYahtzeeStageActions/);
    assert.match(runtimeSource, /previewScore/);
    assert.match(runtimeSource, /yahtzee-player-portrait/);
    assert.match(runtimeSource, /GameRoomYahtzeeBabylonScene/);
    assert.match(runtimeSource, /GameRoomYahtzeeAudioRuntime/);
    assert.match(runtimeSource, /babylonHandle\.beginRoll\(\)/);
    assert.match(runtimeSource, /localRollAnimationStartedAt/);
    assert.match(runtimeSource, /nextTurnIndex !== previousTurnIndex/);
    assert.match(runtimeSource, /babylonHandle\.update\(state/);
    assert.match(runtimeSource, /sendCommand\(name, roomArgs \|\| \{\}\)/);
    assert.doesNotMatch(runtimeSource, /overlay\.innerHTML/);
    assert.doesNotMatch(runtimeSource, /new B\.Engine/);

    const themeSource = readFileSync(
      `${installedCopy.rootDir}/main-functions/yahtzee/ui/theme-pirate-deck.js`,
      "utf8"
    );
    assert.match(themeSource, /pirate-deck-v3/);
    assert.match(themeSource, /deck-stage-v3\.webp/);
    assert.match(themeSource, /table-mahogany-v2\.webp/);
    assert.match(themeSource, /table-felt-burgundy-v2\.webp/);
    assert.match(themeSource, /heldDiceRack: true/);

    const audioSource = readFileSync(
      `${installedCopy.rootDir}/main-functions/yahtzee/ui/audio-runtime.js`,
      "utf8"
    );
    assert.match(audioSource, /GameRoomYahtzeeAudioRuntime/);
    assert.match(audioSource, /createNoiseLayer/);
    assert.match(audioSource, /visibilitychange/);
    assert.match(audioSource, /playDice/);

    const sceneSource = readFileSync(
      `${installedCopy.rootDir}/main-functions/yahtzee/ui/babylon-scene.js`,
      "utf8"
    );
    assert.match(sceneSource, /GameRoomYahtzeeBabylonScene/);
    assert.match(sceneSource, /resolveStageConfig/);
    assert.match(sceneSource, /yahtzee-game-table-hold-well/);
    assert.match(sceneSource, /targetPosition/);
    assert.match(sceneSource, /CreatePolyhedron/);
    assert.match(sceneSource, /targetScale/);
    assert.match(sceneSource, /scene\.constantlyUpdateMeshUnderPointer = false/);
    assert.match(sceneSource, /performanceConfig\.rollingFps/);
    assert.match(sceneSource, /camera\.inputs\.clear\(\)/);
    assert.match(sceneSource, /new B\.Color4\(0, 0, 0, 0\)/);
    assert.doesNotMatch(sceneSource, /camera\.attachControl/);

    const stylesSource = readFileSync(
      `${installedCopy.rootDir}/main-functions/yahtzee/styles.css`,
      "utf8"
    );
    assert.match(stylesSource, /\.yahtzee-stage-art/);
    assert.match(stylesSource, /\.yahtzee-player-portrait/);
    assert.match(stylesSource, /\.yahtzee-score-row\.is-preview/);
    assert.doesNotMatch(stylesSource, /backdrop-filter/);

    const babylonBundleSize = statSync(
      `${installedCopy.rootDir}/main-functions/yahtzee/vendor/babylon.min.js`
    ).size;
    assert.ok(babylonBundleSize > 100_000);
    assert.ok(babylonBundleSize < 2_000_000);

    const bridgeSource = readFileSync(
      `${installedCopy.rootDir}/main-functions/yahtzee/ui/bridge.js`,
      "utf8"
    );
    assert.match(bridgeSource, /roomApi\.offHostMessage\(base\.handleHostMessage\)/);
    assert.match(bridgeSource, /roomApi\.onHostMessage\(handleHostMessage\)/);
    assert.doesNotMatch(bridgeSource, /roomApi\.onHostMessage\s*=(?!=)/);

    const fateKnotsBridgeSource = readFileSync(
      `${installedCopy.rootDir}/main-functions/fate-knots/ui/bridge.js`,
      "utf8"
    );
    assert.match(fateKnotsBridgeSource, /fate-knots-hub-state/);
    assert.match(fateKnotsBridgeSource, /GameRoomFateKnotsGetHubState/);
    assert.match(fateKnotsBridgeSource, /GameRoomFateKnotsUi/);
  } finally {
    await installedCopy.cleanup();
  }
});