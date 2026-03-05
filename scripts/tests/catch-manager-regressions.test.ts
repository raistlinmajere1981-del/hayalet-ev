import assert from "node:assert/strict";
import test from "node:test";

import { CatchManager } from "../../src/js/modules/catch-manager.ts";

test("catch manager scans only latest assistant message", () => {
  const commands = CatchManager.catchCommands({
    provider: "ai2",
    webUrl: "https://grok.com/c/abc",
    messages: [
      { index: 0, role: "assistant", text: "++cmd:first()" },
      { index: 1, role: "user", text: "ok" },
      { index: 2, role: "assistant", text: "++cmd:last(42)" },
    ],
    hasExisting: false,
    prevCount: 0,
  });

  assert.equal(commands.length, 1);
  assert.equal(commands[0]?.command, "last");
  assert.equal(commands[0]?.args, "42");
});

test("catch manager respects prevCount window before latest assistant selection", () => {
  const commands = CatchManager.catchCommands({
    provider: "ai1",
    webUrl: "https://chatgpt.com/c/xyz",
    messages: [
      { index: 0, role: "assistant", text: "++cmd:old()" },
      { index: 1, role: "user", text: "u1" },
      { index: 2, role: "assistant", text: "++cmd:older()" },
      { index: 3, role: "user", text: "u2" },
      { index: 4, role: "assistant", text: "++cmd:new(run)" },
    ],
    hasExisting: true,
    prevCount: 3,
  });

  assert.equal(commands.length, 1);
  assert.equal(commands[0]?.command, "new");
  assert.equal(commands[0]?.args, "run");
});
