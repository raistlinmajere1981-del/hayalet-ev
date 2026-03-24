import assert from "node:assert/strict";
import test from "node:test";

import { isWineRuntime } from "../../electron/runtime-environment.ts";

test("isWineRuntime returns false outside win32", () => {
  assert.equal(
    isWineRuntime({
      platform: "linux",
      regQuery: () => true,
    }),
    false
  );
});

test("isWineRuntime honors explicit Wine environment markers", () => {
  assert.equal(
    isWineRuntime({
      platform: "win32",
      env: {
        WINEPREFIX: "/tmp/wine-prefix",
      },
    }),
    true
  );
});

test("isWineRuntime falls back to registry probing on win32", () => {
  assert.equal(
    isWineRuntime({
      platform: "win32",
      env: {},
      regQuery: () => true,
    }),
    true
  );

  assert.equal(
    isWineRuntime({
      platform: "win32",
      env: {},
      regQuery: () => false,
    }),
    false
  );
});
