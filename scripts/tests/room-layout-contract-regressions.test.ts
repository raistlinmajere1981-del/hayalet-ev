import test from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";

test("rooms expose the shared shell seams expected by the normalized layout contract", () => {
  [
    "rooms/game-room/shared/host/activation.ts",
    "rooms/game-room/shared/host/command-registry.ts",
    "rooms/game-room/shared/ui/feature-contract.js",
    "rooms/game-room/shared/ui/scroll-runtime.js",
    "rooms/game-room/shared/types/room-shell-contracts.ts",
    "rooms/game-room/ui/game-room-ui-runtime.js",
    "rooms/game-room/host/runtime.js",
    "rooms/laboratory/shared/ui/shell-runtime.ts",
    "rooms/laboratory/shared/types/room-shell-contracts.ts",
  ].forEach((filePath) => {
    assert.equal(existsSync(filePath), true, filePath);
  });
});

test("room root entrypoints stay orchestration-only after layout normalization", () => {
  const gameRoomHostIndexSource = readFileSync("rooms/game-room/host/index.ts", "utf8");
  const gameRoomHostRuntimeSource = readFileSync("rooms/game-room/host/runtime.js", "utf8");
  const gameRoomHostActivationSource = readFileSync(
    "rooms/game-room/shared/host/activation.ts",
    "utf8"
  );
  const gameRoomUiIndexSource = readFileSync("rooms/game-room/ui/index.ts", "utf8");
  const gameRoomUiRuntimeSource = readFileSync(
    "rooms/game-room/ui/game-room-ui-runtime.js",
    "utf8"
  );
  const gameRoomIndexHtmlSource = readFileSync("rooms/game-room/ui/index.html", "utf8");
  const laboratoryHostIndexSource = readFileSync("rooms/laboratory/host/index.ts", "utf8");
  const laboratoryUiIndexSource = readFileSync("rooms/laboratory/ui/index.ts", "utf8");
  const laboratoryUiStyleSource = readFileSync("rooms/laboratory/ui/style.css", "utf8");
  const laboratorySharedLayoutStyleSource = readFileSync(
    "rooms/laboratory/shared/styles/layout.css",
    "utf8"
  );
  const laboratorySharedComponentsStyleSource = readFileSync(
    "rooms/laboratory/shared/styles/components.css",
    "utf8"
  );
  const laboratorySharedNavigationStyleSource = readFileSync(
    "rooms/laboratory/shared/styles/components/navigation.css",
    "utf8"
  );
  const laboratorySharedPanelsStyleSource = readFileSync(
    "rooms/laboratory/shared/styles/components/panels.css",
    "utf8"
  );
  const laboratorySharedControlsStyleSource = readFileSync(
    "rooms/laboratory/shared/styles/components/controls.css",
    "utf8"
  );
  const laboratorySharedFeedbackStyleSource = readFileSync(
    "rooms/laboratory/shared/styles/components/feedback.css",
    "utf8"
  );
  const laboratorySharedOverlayStyleSource = readFileSync(
    "rooms/laboratory/shared/styles/components/overlay.css",
    "utf8"
  );
  const laboratorySharedAudioSignalStyleSource = readFileSync(
    "rooms/laboratory/shared/styles/audio-signal.css",
    "utf8"
  );
  const laboratorySharedResponsiveStyleSource = readFileSync(
    "rooms/laboratory/shared/styles/responsive.css",
    "utf8"
  );
  const laboratoryMediaAnalysisStyleSource = readFileSync(
    "rooms/laboratory/main-functions/media-analysis/styles.css",
    "utf8"
  );
  const laboratorySubtitleAnalysisStyleSource = readFileSync(
    "rooms/laboratory/main-functions/subtitle-analysis/styles.css",
    "utf8"
  );

  assert.match(gameRoomHostIndexSource, /from "\.\/runtime\.js"/);
  assert.match(gameRoomHostIndexSource, /export default createGameRoomHostRuntime\(\);/);
  assert.doesNotMatch(gameRoomHostIndexSource, /GameRoomTeamTetrisStart/);
  assert.match(gameRoomHostRuntimeSource, /createGameRoomCommandRegistry/);
  assert.match(gameRoomHostRuntimeSource, /createGameRoomHostLifecycle/);
  assert.match(gameRoomHostActivationSource, /pushActiveFeatureState\(api\)/);
  assert.match(gameRoomUiIndexSource, /createGameRoomUiRuntime\(\)\.start\(\);/);
  assert.doesNotMatch(gameRoomUiIndexSource, /message\.type === "team-tetris-state"/);
  assert.match(gameRoomUiRuntimeSource, /message\.type === "team-tetris-state"/);
  assert.match(gameRoomUiRuntimeSource, /message\.type === "fate-knots-state"/);
  assert.match(gameRoomIndexHtmlSource, /shared\/ui\/feature-contract\.js/);
  assert.match(gameRoomIndexHtmlSource, /shared\/ui\/scroll-runtime\.js/);
  assert.match(gameRoomIndexHtmlSource, /game-room-ui-runtime\.js/);
  assert.match(
    laboratoryHostIndexSource,
    /import createLaboratoryHostRuntime from "\.\/runtime\.js";/
  );
  assert.match(laboratoryUiIndexSource, /import "\.\/laboratory-ui-runtime\.js";/);
  assert.match(laboratoryUiStyleSource, /shared\/styles\/layout\.css/);
  assert.match(laboratoryUiStyleSource, /shared\/styles\/components\.css/);
  assert.match(laboratoryUiStyleSource, /shared\/styles\/audio-signal\.css/);
  assert.match(laboratoryUiStyleSource, /shared\/styles\/responsive\.css/);
  assert.match(laboratoryMediaAnalysisStyleSource, /@import "\.\/styles\/edit\.css";/);
  assert.match(laboratoryMediaAnalysisStyleSource, /@import "\.\/styles\/profile\.css";/);
  assert.match(laboratorySubtitleAnalysisStyleSource, /lab-discovery-table/);
  assert.match(laboratorySharedLayoutStyleSource, /lab-layout/);
  assert.match(laboratorySharedComponentsStyleSource, /\.\/components\/navigation\.css/);
  assert.match(laboratorySharedComponentsStyleSource, /\.\/components\/panels\.css/);
  assert.match(laboratorySharedComponentsStyleSource, /\.\/components\/controls\.css/);
  assert.match(laboratorySharedComponentsStyleSource, /\.\/components\/feedback\.css/);
  assert.match(laboratorySharedComponentsStyleSource, /\.\/components\/overlay\.css/);
  assert.match(laboratorySharedNavigationStyleSource, /lab-stage-pill/);
  assert.match(laboratorySharedPanelsStyleSource, /lab-preview-card/);
  assert.match(laboratorySharedControlsStyleSource, /lab-toggle/);
  assert.match(laboratorySharedFeedbackStyleSource, /lab-process-row/);
  assert.match(laboratorySharedOverlayStyleSource, /lab-overlay/);
  assert.match(laboratorySharedAudioSignalStyleSource, /lab-audio-workbench/);
  assert.match(laboratorySharedResponsiveStyleSource, /@media \(max-width: 760px\)/);
  assert.doesNotMatch(laboratoryUiStyleSource, /audio-analysis\/styles\.css/);
});
