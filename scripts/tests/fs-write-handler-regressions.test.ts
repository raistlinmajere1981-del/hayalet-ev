import assert from "node:assert/strict";
import test from "node:test";

import { createFilesystemBasicTools } from "../../src/mcp-server/core/handlers/filesystem/basic-tools.ts";

function getWriteHandler(): (args: unknown) => Promise<unknown> {
  const tool = createFilesystemBasicTools().find(
    (entry) => entry.definition.name === "hev_fs_write"
  );
  assert.ok(tool, "hev_fs_write tool not found");
  return tool.handler;
}

test("hev_fs_write returns deterministic error when content is missing", async () => {
  const handler = getWriteHandler();

  const result = (await handler({ file_path: "/tmp/hev-missing-content.txt" })) as {
    isError?: boolean;
    content?: Array<{ type?: string; text?: string }>;
  };

  assert.equal(result.isError, true);
  assert.match(String(result.content?.[0]?.text ?? ""), /content.*string/i);
});

test("hev_fs_write returns deterministic error when content is non-string", async () => {
  const handler = getWriteHandler();

  const result = (await handler({
    file_path: "/tmp/hev-non-string-content.txt",
    content: 42,
  })) as {
    isError?: boolean;
    content?: Array<{ type?: string; text?: string }>;
  };

  assert.equal(result.isError, true);
  assert.match(String(result.content?.[0]?.text ?? ""), /content.*string/i);
});
