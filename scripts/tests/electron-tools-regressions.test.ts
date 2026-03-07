import assert from "node:assert/strict";
import test from "node:test";

import { testElectron } from "../../src/mcp-server/tools/electron-tools.ts";

test("testElectron should not start wrapper when runtime mode is already hayalet-ev", async () => {
  const calls: string[] = [];

  const runner = async (
    command: string,
    _options: { cwd: string; timeout: number }
  ): Promise<{ stdout: string; stderr: string }> => {
    calls.push(command);

    if (command === "npm run whereami:mode") {
      return { stdout: "hayalet-ev\n", stderr: "" };
    }

    if (command === "npm run start") {
      throw new Error("start should not be invoked when app is already active");
    }

    return { stdout: "", stderr: "" };
  };

  const result = await testElectron("/tmp", {
    timeout: 5,
    _runCommand: runner,
  });

  const text = String(result.content[0]?.text ?? "");
  assert.equal(result.isError, undefined);
  assert.match(text, /zaten aktif/i);
  assert.deepEqual(calls, ["npm run whereami:mode"]);
});
