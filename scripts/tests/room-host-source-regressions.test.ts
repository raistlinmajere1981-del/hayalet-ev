import test from "node:test";
import assert from "node:assert/strict";
import { decodeRoomHostSource } from "../../src/js/modules/rooms/room-host-source.ts";

test("decodeRoomHostSource decodes base64 room host source", () => {
  const rawSource = 'module.exports = function () { return { dispose() {} }; };';
  const encoded = Buffer.from(rawSource, "utf8").toString("base64");

  assert.equal(decodeRoomHostSource(encoded), rawSource);
});

test("decodeRoomHostSource keeps plain javascript source unchanged", () => {
  const rawSource = 'module.exports = function () { return { dispose() {} }; };';

  assert.equal(decodeRoomHostSource(rawSource), rawSource);
});
