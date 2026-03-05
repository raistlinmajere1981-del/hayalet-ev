import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

async function readRepoFile(path: string): Promise<string> {
  return await readFile(path, "utf-8");
}

test("ghost electron provider ready timeout matches asistan timeout (90000ms)", async () => {
  const content = await readRepoFile("ghost-agent/electron/main.ts");
  assert.match(content, /timeoutMs\s*=\s*90000/);
});

test("ghost renderer provider ready timeout matches asistan timeout (90000ms)", async () => {
  const content = await readRepoFile("ghost-agent/src/renderer/index.ts");
  assert.match(content, /PROVIDER_READY_TIMEOUT_MS\s*=\s*90000/);
});
