import assert from "node:assert/strict";
import test from "node:test";

import {
  buildPreloadAdditionalArguments,
  parseStartupFlagsFromArgv,
} from "../../electron/startup-flags.ts";

test("reads startup flags from legacy CLI arguments", () => {
  const flags = parseStartupFlagsFromArgv([
    "electron",
    "./dist/electron/main.js",
    "--start-page=asistan",
    "--auto-connect",
  ]);

  assert.equal(flags.startPage, "assistant");
  assert.equal(flags.autoConnect, true);
});

test("reads startup flags from hayalet-prefixed preload arguments", () => {
  const flags = parseStartupFlagsFromArgv([
    "electron",
    "./dist/electron/main.js",
    "--hayalet-start-page=asistan",
    "--hayalet-auto-connect=1",
  ]);

  assert.equal(flags.startPage, "assistant");
  assert.equal(flags.autoConnect, true);
});

test("serializes startup flags into preload additional arguments", () => {
  const args = buildPreloadAdditionalArguments({
    startPage: "assistant",
    autoConnect: true,
  });

  assert.deepEqual(args, ["--hayalet-start-page=assistant", "--hayalet-auto-connect=1"]);
});

test("omits empty startup flags while serializing preload arguments", () => {
  const args = buildPreloadAdditionalArguments({
    startPage: null,
    autoConnect: false,
  });

  assert.deepEqual(args, []);
});
