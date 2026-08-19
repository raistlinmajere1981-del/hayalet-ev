import test from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync, statSync } from "node:fs";

import { createRoomInstalledCopy } from "./helpers/room-installed-copy.ts";

void test("game-room installed UI contains the Yahtzee feature and localized assets", async () => {
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
    assert.equal(manifest.version, "2.7.0");
    assert.deepEqual(
      manifest.features?.map((feature) => feature.id),
      ["backgammon", "team-tetris", "yahtzee"]
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
    assert.deepEqual(
      yahtzeeFeature?.protocolSpecs?.map((entry) => entry.path),
      [
        "main-functions/yahtzee/protocols/game-room-yahtzee-ai-turn.md",
        "main-functions/yahtzee/protocols/game-room-yahtzee-us1-transport.md",
      ]
    );

    const indexHtml = readFileSync(`${installedCopy.rootDir}/ui/index.html`, "utf8");
    assert.match(indexHtml, /main-functions\/yahtzee\/styles\.css/);
    assert.match(indexHtml, /main-functions\/yahtzee\/multiplayer\.css/);
    assert.match(indexHtml, /main-functions\/yahtzee\/vendor\/babylon\.min\.js/);
    assert.match(indexHtml, /main-functions\/yahtzee\/ui\/babylon-scene\.js/);
    assert.match(indexHtml, /main-functions\/yahtzee\/ui\/runtime\.js/);
    assert.match(indexHtml, /main-functions\/yahtzee\/ui\/bridge\.js/);
    const babylonRuntimeIndex = indexHtml.indexOf(
      "../main-functions/yahtzee/vendor/babylon.min.js"
    );
    const babylonSceneIndex = indexHtml.indexOf("../main-functions/yahtzee/ui/babylon-scene.js");
    const yahtzeeRuntimeIndex = indexHtml.indexOf("../main-functions/yahtzee/ui/runtime.js");
    assert.ok(babylonRuntimeIndex >= 0 && babylonRuntimeIndex < babylonSceneIndex);
    assert.ok(babylonSceneIndex < yahtzeeRuntimeIndex);

    [
      `${installedCopy.rootDir}/main-functions/yahtzee/styles.css`,
      `${installedCopy.rootDir}/main-functions/yahtzee/multiplayer.css`,
      `${installedCopy.rootDir}/main-functions/yahtzee/vendor/babylon.min.js`,
      `${installedCopy.rootDir}/main-functions/yahtzee/vendor/LICENSE.babylonjs.md`,
      `${installedCopy.rootDir}/main-functions/yahtzee/vendor/NOTICE.babylonjs.md`,
      `${installedCopy.rootDir}/main-functions/yahtzee/ui/babylon-scene.js`,
      `${installedCopy.rootDir}/main-functions/yahtzee/ui/runtime.js`,
      `${installedCopy.rootDir}/main-functions/yahtzee/ui/bridge.js`,
      `${installedCopy.rootDir}/main-functions/yahtzee/protocols/game-room-yahtzee-ai-turn.md`,
      `${installedCopy.rootDir}/main-functions/yahtzee/protocols/game-room-yahtzee-us1-transport.md`,
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
    assert.match(runtimeSource, /yahtzee-score-stack/);
    assert.match(runtimeSource, /GameRoomYahtzeeBabylonScene/);
    assert.match(runtimeSource, /babylonHandle\.beginRoll\(\)/);
    assert.match(runtimeSource, /babylonHandle\.update\(turnVisualState\(\)/);
    assert.match(runtimeSource, /sendCommand\(name, roomArgs \|\| \{\}\)/);
    assert.doesNotMatch(runtimeSource, /sendCommand\(name, \{ roomArgs:/);
    assert.doesNotMatch(runtimeSource, /new B\.Engine/);

    const sceneSource = readFileSync(
      `${installedCopy.rootDir}/main-functions/yahtzee/ui/babylon-scene.js`,
      "utf8"
    );
    assert.match(sceneSource, /GameRoomYahtzeeBabylonScene/);
    assert.match(sceneSource, /yahtzee-dark-ocean/);
    assert.match(sceneSource, /yahtzee-main-mast/);
    assert.match(sceneSource, /yahtzee-game-table-top/);
    assert.match(sceneSource, /const pirateOptions = \[/);
    assert.match(sceneSource, /DEFAULT_DICE\.map/);
    assert.match(sceneSource, /applyDieValue\(model, values\[index\]\)/);
    assert.match(sceneSource, /applyHeldState\(model, held\[index\], materials\)/);
    assert.match(sceneSource, /shipRoot\.rotation\.z/);
    assert.match(sceneSource, /lantern\.light\.intensity/);
    assert.doesNotMatch(sceneSource, /Math\.random/);

    const stylesSource = readFileSync(
      `${installedCopy.rootDir}/main-functions/yahtzee/styles.css`,
      "utf8"
    );
    assert.match(stylesSource, /\.yahtzee-fallback-art/);
    assert.match(stylesSource, /\.yahtzee-shell\.is-babylon-active \.yahtzee-runtime-note/);

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
  } finally {
    await installedCopy.cleanup();
  }
});
