import test from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";

import { createRoomInstalledCopy } from "./helpers/room-installed-copy.ts";

void test("game-room installed UI contains the Yahtzee feature and localized assets", async () => {
  const installedCopy = await createRoomInstalledCopy("game-room");

  try {
    const manifest = JSON.parse(
      readFileSync(`${installedCopy.rootDir}/manifest.json`, "utf8")
    ) as {
      version?: string;
      features?: Array<{
        id?: string;
        scene?: unknown;
        commandSpecs?: Array<{ name?: string; scope?: string }>;
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

    const indexHtml = readFileSync(`${installedCopy.rootDir}/ui/index.html`, "utf8");
    assert.match(indexHtml, /main-functions\/yahtzee\/styles\.css/);
    assert.match(indexHtml, /main-functions\/yahtzee\/multiplayer\.css/);
    assert.match(indexHtml, /main-functions\/yahtzee\/ui\/runtime\.js/);
    assert.match(indexHtml, /main-functions\/yahtzee\/ui\/bridge\.js/);

    [
      `${installedCopy.rootDir}/main-functions/yahtzee/styles.css`,
      `${installedCopy.rootDir}/main-functions/yahtzee/multiplayer.css`,
      `${installedCopy.rootDir}/main-functions/yahtzee/ui/runtime.js`,
      `${installedCopy.rootDir}/main-functions/yahtzee/ui/bridge.js`,
    ].forEach((filePath) => {
      assert.equal(existsSync(filePath), true, filePath);
    });

    const english = JSON.parse(
      readFileSync(`${installedCopy.rootDir}/i18n/en.json`, "utf8")
    ) as { yahtzee?: { title?: string } };
    const turkish = JSON.parse(
      readFileSync(`${installedCopy.rootDir}/i18n/tr.json`, "utf8")
    ) as { yahtzee?: { title?: string } };
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