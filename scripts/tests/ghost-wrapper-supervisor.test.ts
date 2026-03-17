import assert from "node:assert/strict";
import test from "node:test";

import { splitLines } from "../lib/wrapper-supervisor.mjs";
import { createUserMessage, formatCommand, isNoiseLogLine } from "../lib/wrapper-events.mjs";

test("wrapper event helpers keep user lane terse", () => {
  assert.equal(createUserMessage("vite.reset"), "Vite yeniden baslatiliyor.");
  assert.equal(createUserMessage("cycle.to-ghost"), "Gecis ghost moda yonlendirildi.");
  assert.equal(formatCommand("npm", ["run", "electron:build"]), "npm run electron:build");
});

test("wrapper event helpers filter known noisy log lines", () => {
  assert.equal(isNoiseLogLine("xapp-gtk3-module warning"), true);
  assert.equal(isNoiseLogLine("Cannot start http server for devtools"), true);
  assert.equal(isNoiseLogLine("vite ready in 250 ms"), false);
});

test("splitLines keeps trailing partial data in remainder", () => {
  const first = splitLines(Buffer.from("line-1\npart"), "");
  assert.deepEqual(first.lines, ["line-1"]);
  assert.equal(first.remainder, "part");

  const second = splitLines(Buffer.from("ial\nline-2\n"), first.remainder);
  assert.deepEqual(second.lines, ["partial", "line-2"]);
  assert.equal(second.remainder, "");
});
