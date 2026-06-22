import test from "node:test";
import assert from "node:assert/strict";
import {
  canUseDirectFileUrls,
  toRoomRuntimeFileUrl,
} from "../../src/js/modules/rooms/room-runtime-url.ts";

type LaboratoryManifestFeature = {
  id?: string;
  name?: string;
  scene?: {
    hotspot?: { id?: string };
    view?: {
      id?: string;
      backgroundSrc?: string;
    };
  };
};


describe("toRoomRuntimeFileUrl normalizes linux paths", () => {
void test("toRoomRuntimeFileUrl normalizes linux paths", () => {
  assert.equal(
    toRoomRuntimeFileUrl("/workspace/rooms/.build/game-room/runtime/ui/index.html"),
    "file:///workspace/rooms/.build/game-room/runtime/ui/index.html"
  );
});
void test("toRoomRuntimeFileUrl normalizes windows-style paths", () => {
  assert.equal(
    toRoomRuntimeFileUrl("C:\\rooms\\game-room\\ui\\index.html"),
    "file:///C:/rooms/game-room/ui/index.html"
  );
});
void test("toRoomRuntimeFileUrl encodes reserved url characters", () => {
  assert.equal(toRoomRuntimeFileUrl("/tmp/a b#c/index.html"), "file:///tmp/a%20b%23c/index.html");
});
void test("canUseDirectFileUrls rejects http-backed renderer protocols", () => {
  const originalWindow = Object.getOwnPropertyDescriptor(globalThis, "window");

  try {
    Object.defineProperty(globalThis, "window", {
      configurable: true,
      value: { location: { protocol: "http:" } },
    });
    assert.equal(canUseDirectFileUrls(), false);

    Object.defineProperty(globalThis, "window", {
      configurable: true,
      value: { location: { protocol: "https:" } },
    });
    assert.equal(canUseDirectFileUrls(), false);

    Object.defineProperty(globalThis, "window", {
      configurable: true,
      value: { location: { protocol: "file:" } },
    });
    assert.equal(canUseDirectFileUrls(), true);
  } finally {
    if (originalWindow) {
      Object.defineProperty(globalThis, "window", originalWindow);
    } else {
      delete (globalThis as typeof globalThis & { window?: unknown }).window;
    }
  }
});
});
