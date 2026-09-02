import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";

void test("Fate Knots run setup keeps optional character ownership seat-bound", () => {
  const runtime = readFileSync(
    "rooms/game-room/main-functions/fate-knots/host/run-runtime.ts",
    "utf8"
  );
  const seatRuntime = readFileSync(
    "rooms/game-room/main-functions/fate-knots/host/run-setup-seat-runtime.ts",
    "utf8"
  );
  const extension = readFileSync(
    "rooms/game-room/host/fate-knots-run-setup-extension.ts",
    "utf8"
  );
  const hub = readFileSync("rooms/game-room/main-functions/fate-knots/ui/hub.js", "utf8");
  const bridge = readFileSync("rooms/game-room/main-functions/fate-knots/ui/bridge.js", "utf8");

  assert.match(runtime, /getFateKnotsRunSetupSeatSelection/);
  assert.match(runtime, /seat-selection-required/);
  assert.match(runtime, /assignment\.seatId === "user"/);
  assert.match(runtime, /selectedCharacterId !== assignment\.characterId/);

  assert.match(seatRuntime, /GameRoomFateKnotsGetRunSetupSeats/);
  assert.match(seatRuntime, /GameRoomFateKnotsAi2GetRunSetup/);
  assert.match(seatRuntime, /GameRoomFateKnotsRemoteGetRunSetup/);
  assert.match(seatRuntime, /GameRoomFateKnotsSelectRunCharacter/);
  assert.match(seatRuntime, /GameRoomFateKnotsAi2SelectRunCharacter/);
  assert.match(seatRuntime, /GameRoomFateKnotsRemoteSelectRunCharacter/);

  assert.match(extension, /"ai-slots"/);
  assert.match(extension, /"us1"/);
  assert.match(extension, /"room-ui"/);
  assert.match(extension, /fate-knots-run-setup-seat-state/);

  assert.match(hub, /GameRoomFateKnotsGetRunSetupSeats/);
  assert.match(hub, /GameRoomFateKnotsSelectRunCharacter/);
  assert.match(hub, /AI2 ve US1 karakterlerini kendi bağlantılarından seçer/);
  assert.doesNotMatch(hub, /state\.assignments\[seatId\]/);
  assert.match(bridge, /fate-knots-run-setup-seat-state/);
  assert.match(bridge, /handleRunSetupSeatState/);
});
