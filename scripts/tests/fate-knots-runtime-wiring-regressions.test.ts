import test from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";

import { createRoomInstalledCopy } from "./helpers/room-installed-copy.ts";

void test("installed Fate Knots wires exploration, camp, and bounded NPC surfaces", async () => {
  const installedCopy = await createRoomInstalledCopy("game-room");

  try {
    const indexHtml = readFileSync(`${installedCopy.rootDir}/ui/index.html`, "utf8");
    const gameplayIndex = indexHtml.indexOf("../main-functions/fate-knots/ui/gameplay.js");
    const explorationIndex = indexHtml.indexOf("../main-functions/fate-knots/ui/exploration.js");
    const campSocialIndex = indexHtml.indexOf("../main-functions/fate-knots/ui/camp-social.js");
    const bridgeIndex = indexHtml.indexOf("../main-functions/fate-knots/ui/bridge.js");

    assert.ok(gameplayIndex >= 0);
    assert.ok(gameplayIndex < explorationIndex);
    assert.ok(explorationIndex < campSocialIndex);
    assert.ok(campSocialIndex < bridgeIndex);

    const files = [
      `${installedCopy.rootDir}/main-functions/fate-knots/ui/exploration.js`,
      `${installedCopy.rootDir}/main-functions/fate-knots/ui/camp-social.js`,
      `${installedCopy.rootDir}/host/fate-knots-exploration-extension.js`,
      `${installedCopy.rootDir}/host/fate-knots-camp-social-extension.js`,
    ];
    files.forEach((filePath) => assert.equal(existsSync(filePath), true, filePath));

    const hostIndex = readFileSync(`${installedCopy.rootDir}/host/index.js`, "utf8");
    assert.match(hostIndex, /extendGameRoomHostRuntimeWithFateKnotsExploration/);
    assert.match(hostIndex, /extendGameRoomHostRuntimeWithFateKnotsCampSocial/);

    const explorationExtension = readFileSync(
      `${installedCopy.rootDir}/host/fate-knots-exploration-extension.js`,
      "utf8"
    );
    assert.match(explorationExtension, /GameRoomFateKnotsGetExplorationConsensus/);
    assert.match(explorationExtension, /GameRoomFateKnotsChooseExploration/);
    assert.match(explorationExtension, /GameRoomFateKnotsAi2ChooseExploration/);
    assert.match(explorationExtension, /GameRoomFateKnotsRemoteChooseExploration/);
    assert.match(explorationExtension, /persistFateKnotsCommandMutation/);

    const campExtension = readFileSync(
      `${installedCopy.rootDir}/host/fate-knots-camp-social-extension.js`,
      "utf8"
    );
    assert.match(campExtension, /GameRoomFateKnotsOpenCamp/);
    assert.match(campExtension, /GameRoomFateKnotsSetCampEquipment/);
    assert.match(campExtension, /GameRoomFateKnotsReadyCamp/);
    assert.match(campExtension, /GameRoomFateKnotsSpeakNpc/);

    const bridgeSource = readFileSync(
      `${installedCopy.rootDir}/main-functions/fate-knots/ui/bridge.js`,
      "utf8"
    );
    assert.match(bridgeSource, /fate-knots-exploration-consensus-state/);
    assert.match(bridgeSource, /fate-knots-camp-state/);
    assert.match(bridgeSource, /fate-knots-npc-dialogue-state/);
    assert.match(bridgeSource, /handleCampState/);
    assert.match(bridgeSource, /handleNpcDialogueState/);

    const campSocialSource = readFileSync(
      `${installedCopy.rootDir}/main-functions/fate-knots/ui/camp-social.js`,
      "utf8"
    );
    assert.match(campSocialSource, /GameRoomFateKnotsOpenCamp/);
    assert.match(campSocialSource, /GameRoomFateKnotsSetCampEquipment/);
    assert.match(campSocialSource, /GameRoomFateKnotsReadyCamp/);
    assert.match(campSocialSource, /GameRoomFateKnotsSpeakNpc/);
    assert.match(campSocialSource, /suggestedTransitionId/);
    assert.doesNotMatch(campSocialSource, /selectedInteractionId/);
  } finally {
    await installedCopy.cleanup();
  }
});
