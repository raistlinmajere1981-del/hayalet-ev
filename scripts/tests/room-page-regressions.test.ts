import test from "node:test";
import assert from "node:assert/strict";
import { toRoomRuntimeFileUrl } from "../../src/js/modules/rooms/room-runtime-url.ts";

test("toRoomRuntimeFileUrl normalizes linux paths", () => {
  assert.equal(
    toRoomRuntimeFileUrl("/workspace/data/rooms/xox-room/ui/index.html"),
    "file:///workspace/data/rooms/xox-room/ui/index.html"
  );
});

test("toRoomRuntimeFileUrl normalizes windows-style paths", () => {
  assert.equal(
    toRoomRuntimeFileUrl("C:\\rooms\\xox-room\\ui\\index.html"),
    "file:///C:/rooms/xox-room/ui/index.html"
  );
});

test("toRoomRuntimeFileUrl encodes reserved url characters", () => {
  assert.equal(
    toRoomRuntimeFileUrl("/tmp/a b#c/index.html"),
    "file:///tmp/a%20b%23c/index.html"
  );
});
