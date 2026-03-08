import test from "node:test";
import assert from "node:assert/strict";
import {
  ROOM_SCHEMA_VERSION,
  isValidRoomCommandName,
  isValidRoomId,
  normalizeRoomRelativePath,
  validateRoomManifest,
} from "../../src/types/rooms.ts";

test("validateRoomManifest accepts a minimal valid room manifest", () => {
  const result = validateRoomManifest({
    schemaVersion: ROOM_SCHEMA_VERSION,
    id: "xox-room",
    name: "XOX Room",
    version: "1.0.0",
    menu: {
      label: "XOX",
      icon: "XO",
    },
    uiEntry: "ui/index.html",
    hostEntry: "host/index.js",
    commandSpecs: [{ name: "XOXStartGame", scope: "ai-slots" }],
    protocolSpecs: [
      {
        key: "xox-start",
        room: "xox",
        scenario: "start",
        title: "Start XOX",
        editable: true,
      },
    ],
  });

  assert.equal(result.valid, true);
  assert.deepEqual(result.errors, []);
  assert.equal(result.manifest?.id, "xox-room");
  assert.equal(result.manifest?.uiEntry, "ui/index.html");
  assert.equal(result.manifest?.hostEntry, "host/index.js");
});

test("validateRoomManifest rejects invalid ids, commands, and unsafe paths", () => {
  const result = validateRoomManifest({
    schemaVersion: ROOM_SCHEMA_VERSION,
    id: "XOX Room",
    name: "Bad Room",
    version: "1.0",
    menu: {
      label: "Bad",
    },
    uiEntry: "../ui/index.html",
    hostEntry: "/host/index.js",
    commandSpecs: [{ name: "XOX.Start" }],
  });

  assert.equal(result.valid, false);
  assert.match(result.errors.join("\n"), /id must match/);
  assert.match(result.errors.join("\n"), /version must look like semver/);
  assert.match(result.errors.join("\n"), /uiEntry must be a safe relative path/);
  assert.match(result.errors.join("\n"), /hostEntry must be a safe relative path/);
  assert.match(result.errors.join("\n"), /commandSpecs\[0\]\.name must match/);
});

test("normalizeRoomRelativePath blocks traversal and preserves safe paths", () => {
  assert.equal(normalizeRoomRelativePath("ui/index.html"), "ui/index.html");
  assert.equal(normalizeRoomRelativePath("ui\\index.html"), "ui/index.html");
  assert.equal(normalizeRoomRelativePath("../escape.js"), null);
  assert.equal(normalizeRoomRelativePath("/absolute/file.js"), null);
});

test("room id and command validators match project rules", () => {
  assert.equal(isValidRoomId("xox-room"), true);
  assert.equal(isValidRoomId("xox_room"), false);
  assert.equal(isValidRoomCommandName("XOXStartGame"), true);
  assert.equal(isValidRoomCommandName("XOX.Start"), false);
});
