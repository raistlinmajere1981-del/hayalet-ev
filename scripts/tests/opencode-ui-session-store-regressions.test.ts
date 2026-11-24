import assert from "node:assert/strict";
import test from "node:test";
import {
  listApiSessions,
  readApiSession,
  archiveApiSession,
  type SessionApi,
} from "../../electron/opencode-ui-session-api.ts";
import { readFileSync, existsSync } from "node:fs";

const session = {
  id: "ses_example",
  title: "Test",
  location: { directory: "/work" },
  time: { created: 1, updated: 2 },
  tokens: { input: 3, output: 4, reasoning: 1 },
};
void test("OpenCode V2 sessions use cursor pagination, never SQLite", async () => {
  const paths: string[] = [];
  const api: SessionApi = async (method, path) => {
    assert.equal(method, "GET");
    paths.push(path);
    if (!path.includes("cursor=")) return { data: [session], cursor: { next: "second" } };
    return {
      data: [{ ...session, id: "ses_older", time: { created: 0, updated: 1, archived: 8 } }],
      cursor: { next: null },
    };
  };
  const result = await listApiSessions(api);
  assert.equal(result.length, 2);
  assert.equal(result[0]?.workspace_path, "/work");
  assert.equal(result[1]?.archived_at, 8);
  assert.match(paths[1] ?? "", /cursor=second/);
});
void test("history reads user and assistant messages, reasoning, tool output and usage from v2 server", async () => {
  const api: SessionApi = async (_method, path) =>
    path.includes("/message")
      ? {
          data: [
            {
              type: "assistant",
              time: { created: 3 },
              content: [
                { type: "reasoning", text: "thinking" },
                { type: "text", text: "answer" },
                {
                  type: "tool",
                  name: "read",
                  state: {
                    status: "completed",
                    input: { file: "a" },
                    content: [{ type: "text", text: "ok" }],
                  },
                },
              ],
              snapshot: { files: ["a"] },
            },
            {
              type: "user",
              text: "question",
              time: { created: 2 },
              files: [{ name: "a.png", mime: "image/png", data: "YWJj", source: { type: "file" } }],
            },
            { type: "model-switched", time: { created: 1 } },
          ],
          cursor: { next: null },
        }
      : { data: session };
  const result = await readApiSession(api, "ses_example");
  assert.deepEqual(
    result.messages.map((m) => m.role),
    ["user", "assistant"]
  );
  assert.equal(result.messages[0]?.files[0]?.base64, "YWJj");
  assert.equal(result.messages[1]?.text, "answer");
  assert.equal(result.messages[1]?.blocks[0]?.kind, "reasoning");
  assert.equal(result.messages[1]?.toolCalls[0]?.status, "done");
  assert.equal(result.messages[1]?.toolCalls[0]?.result, "ok");
  assert.equal(result.usage["prompt_tokens"], 3);
  assert.deepEqual(result.changed_files, ["a"]);
});
void test("archiving and restoring delegate exclusively to server", async () => {
  const calls: unknown[] = [];
  const api: SessionApi = async (...args) => {
    calls.push(args);
    return { data: session };
  };
  await archiveApiSession(api, "ses_example", true);
  await archiveApiSession(api, "ses_example", false);
  assert.deepEqual(calls, [
    ["PATCH", "/api/session/ses_example", { archived: true }],
    ["PATCH", "/api/session/ses_example", { archived: false }],
  ]);
});
void test("direct SQLite session store and file watcher are removed from host and preload", () => {
  assert.equal(existsSync("electron/opencode-ui-session-store.ts"), false);
  assert.equal(existsSync("electron/opencode-ui-session-watcher.ts"), false);
  for (const path of [
    "electron/main.ts",
    "electron/preload.cjs",
    "electron/webview-preload.cjs",
    "src/js/pages/opencode-ui/session-storage.ts",
  ]) {
    const content = readFileSync(path, "utf8");
    assert.doesNotMatch(content, /opencode-ui-fs-|opencodeUiFs|opencodeUiSessionWatch/);
  }
});
