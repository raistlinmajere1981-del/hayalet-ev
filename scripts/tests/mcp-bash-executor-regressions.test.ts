import assert from "node:assert/strict";
import test from "node:test";

import { executeBash } from "../../mcp-server/tools/fs/bash-executor.ts";
import { createFilesystemMiscTools } from "../../mcp-server/core/handlers/filesystem/misc-tools.ts";

function getToolText(response: unknown): string {
  const maybeContent = (response as { content?: unknown }).content;
  if (!Array.isArray(maybeContent)) return "";

  return maybeContent
    .map((item) => (typeof (item as { text?: unknown }).text === "string" ? (item as { text: string }).text : ""))
    .join("\n");
}

void test("executeBash keeps explicit-timeout commands in foreground", async () => {
  const result = await executeBash(
    `${process.execPath} -e "setTimeout(() => console.log('done'), 40)"`,
    process.cwd(),
    1_000,
    { detachLongRunning: false, foregroundWaitMs: 1 }
  );

  assert.equal(result.exitCode, 0);
  assert.equal(result.stdout.trim(), "done");
  assert.doesNotMatch(result.stdout, /Background process|arka plana|baslatildi/i);
});

void test("filesystem bash handler keeps explicit-timeout commands in foreground", async () => {
  const bashTool = createFilesystemMiscTools(process.cwd()).find(
    (entry) => (entry.definition as { name?: unknown }).name === "hev_fs_bash"
  );

  assert.ok(bashTool);

  const response = await bashTool.handler({
    command: `${process.execPath} -e "setTimeout(() => console.log('handler-done'), 40)"`,
    timeout: 1_000,
  });
  const text = getToolText(response);

  assert.match(text, /handler-done/);
  assert.doesNotMatch(text, /Command is still running/);
});

void test("executeBash can still detach long-running default-style commands", async () => {
  const result = await executeBash(
    `${process.execPath} -e "setTimeout(() => console.log('late'), 40)"`,
    process.cwd(),
    1_000,
    { detachLongRunning: true, foregroundWaitMs: 1 }
  );

  assert.equal(result.exitCode, 0);
  assert.match(result.stdout, /PID:/);
  assert.match(result.stdout, /Command is still running/);
});
