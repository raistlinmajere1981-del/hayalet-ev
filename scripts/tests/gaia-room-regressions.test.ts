import assert from "node:assert/strict";
import test from "node:test";
import { roomStorageCaller } from "../../electron/rooms/storage-caller.ts";
import "../../rooms/gaia-room/scripts/tests/round-trip.test.ts";
import "../../rooms/gaia-room/scripts/tests/site.test.ts";
import "../../rooms/gaia-room/scripts/tests/storage.test.ts";
import "../../rooms/gaia-room/scripts/tests/references.test.ts";
import "../../rooms/gaia-room/scripts/tests/devices.test.ts";
import "../../rooms/gaia-room/scripts/tests/workspace.test.ts";
import "../../rooms/gaia-room/scripts/tests/physical.test.ts";
import "../../rooms/gaia-room/scripts/tests/enrollment.test.ts";
import "../../rooms/gaia-room/scripts/tests/certificates.test.ts";
import "../../rooms/gaia-room/scripts/tests/restore.test.ts";
import "../../rooms/gaia-room/scripts/tests/session.test.ts";
import "../../rooms/gaia-room/scripts/tests/receiver.test.ts";
import "../../rooms/gaia-room/scripts/tests/field-management.test.ts";

test("B8 document guard rejects another webview partition, child frame, closed guest and same-URL reload", () => {
  type Args = Parameters<typeof roomStorageCaller>;
  const frame = { url: "file:///test/room/index.html", detached: false };
  const host = { isDestroyed: () => false, webContents: {} };
  const partition = {};
  let closed = false;
  let navigation: ((e: { isMainFrame: boolean; isSameDocument: boolean }) => void) | undefined;
  const guest = {
    isDestroyed: () => closed,
    getType: () => "webview",
    session: partition,
    hostWebContents: host.webContents,
    mainFrame: frame,
    on: (_: string, fn: typeof navigation) => {
      navigation = fn;
    },
  };
  const invoke = (senderFrame: object, expected: object) =>
    roomStorageCaller(
      { sender: guest, senderFrame } as unknown as Args[0],
      () => host as unknown as ReturnType<Args[1]>,
      expected as Args[2]
    );
  assert.throws(() => invoke(frame, {}), /Unauthorized/);
  assert.throws(() => invoke({ ...frame }, partition), /Unauthorized/);
  const old = invoke(frame, partition);
  navigation!({ isMainFrame: true, isSameDocument: false });
  assert.throws(old.assertCurrent, /Unauthorized/);
  const current = invoke(frame, partition);
  assert.notEqual(old.owner, current.owner);
  closed = true;
  assert.throws(current.assertCurrent, /Unauthorized/);
});
