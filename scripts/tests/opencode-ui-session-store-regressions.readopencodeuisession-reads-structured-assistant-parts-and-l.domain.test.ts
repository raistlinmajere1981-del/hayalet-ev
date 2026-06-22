import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

import Database, { type BetterSqlite3Database } from "../../electron/native/better-sqlite3.ts";
import {
  ensureOpencodeUiSession,
  listOpencodeUiSessions,
  readOpencodeUiSession,
} from "../../electron/opencode-ui-session-store.ts";
import { t } from "../../src/js/pages/opencode-ui/i18n.ts";

interface DbFixture {
  db: BetterSqlite3Database;
  dbPath: string;
  cleanup: () => void;
}

function setupFixture(): DbFixture {
  const dir = mkdtempSync(join(tmpdir(), "opencode-ui-session-store-"));
  const dbPath = join(dir, "opencode.db");
  const db = new Database(dbPath);

  db.exec(`
    CREATE TABLE project (
      id TEXT PRIMARY KEY,
      worktree TEXT NOT NULL,
      vcs TEXT,
      name TEXT,
      icon_url TEXT,
      icon_color TEXT,
      time_created INTEGER NOT NULL,
      time_updated INTEGER NOT NULL,
      time_initialized INTEGER,
      sandboxes TEXT NOT NULL,
      commands TEXT
    );

    CREATE TABLE session (
      id TEXT PRIMARY KEY,
      project_id TEXT NOT NULL,
      parent_id TEXT,
      slug TEXT NOT NULL,
      directory TEXT NOT NULL,
      title TEXT NOT NULL,
      version TEXT NOT NULL,
      share_url TEXT,
      summary_additions INTEGER,
      summary_deletions INTEGER,
      summary_files INTEGER,
      summary_diffs TEXT,
      revert TEXT,
      permission TEXT,
      time_created INTEGER NOT NULL,
      time_updated INTEGER NOT NULL,
      time_compacting INTEGER,
      time_archived INTEGER,
      workspace_id TEXT
    );

    CREATE TABLE message (
      id TEXT PRIMARY KEY,
      session_id TEXT NOT NULL,
      time_created INTEGER NOT NULL,
      time_updated INTEGER NOT NULL,
      data TEXT NOT NULL
    );

    CREATE TABLE part (
      id TEXT PRIMARY KEY,
      message_id TEXT NOT NULL,
      session_id TEXT NOT NULL,
      time_created INTEGER NOT NULL,
      time_updated INTEGER NOT NULL,
      data TEXT NOT NULL
    );
  `);

  db.prepare(
    `INSERT INTO project (id, worktree, vcs, name, icon_url, icon_color, time_created, time_updated, sandboxes, commands)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(
    "proj_main",
    "/workspace/project",
    "git",
    "Project",
    null,
    null,
    1700000000000,
    1700000000000,
    "[]",
    null
  );

  const cleanup = () => {
    db.close();
    rmSync(dir, { recursive: true, force: true });
  };

  return { db, dbPath, cleanup };
}


describe("readOpencodeUiSession reads structured assistant parts and latest todos", () => {
void test("readOpencodeUiSession reads structured assistant parts and latest todos", () => {
  const fixture = setupFixture();
  const { db, dbPath } = fixture;

  db.prepare(
    `INSERT INTO session (id, project_id, slug, directory, title, version, time_created, time_updated)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(
    "ses_text_variants",
    "proj_main",
    "text-variants",
    "/workspace/project",
    "Text Variants",
    "1.2.17",
    1700000000000,
    1700000003000
  );

  db.prepare(
    `INSERT INTO message (id, session_id, time_created, time_updated, data)
     VALUES (?, ?, ?, ?, ?)`
  ).run(
    "msg_assistant_content",
    "ses_text_variants",
    1700000000100,
    1700000000100,
    JSON.stringify({ role: "assistant" })
  );

  db.prepare(
    `INSERT INTO message (id, session_id, time_created, time_updated, data)
     VALUES (?, ?, ?, ?, ?)`
  ).run(
    "msg_assistant_delta",
    "ses_text_variants",
    1700000000200,
    1700000000200,
    JSON.stringify({ role: "assistant" })
  );

  db.prepare(
    `INSERT INTO message (id, session_id, time_created, time_updated, data)
     VALUES (?, ?, ?, ?, ?)`
  ).run(
    "msg_assistant_tool_only",
    "ses_text_variants",
    1700000000300,
    1700000000300,
    JSON.stringify({ role: "assistant" })
  );

  db.prepare(
    `INSERT INTO message (id, session_id, time_created, time_updated, data)
     VALUES (?, ?, ?, ?, ?)`
  ).run(
    "msg_assistant_structured",
    "ses_text_variants",
    1700000000400,
    1700000000400,
    JSON.stringify({ role: "assistant" })
  );

  db.prepare(
    `INSERT INTO message (id, session_id, time_created, time_updated, data)
     VALUES (?, ?, ?, ?, ?)`
  ).run(
    "msg_assistant_todo",
    "ses_text_variants",
    1700000000500,
    1700000000500,
    JSON.stringify({ role: "assistant" })
  );

  db.prepare(
    `INSERT INTO part (id, message_id, session_id, time_created, time_updated, data)
     VALUES (?, ?, ?, ?, ?, ?)`
  ).run(
    "part_assistant_content",
    "msg_assistant_content",
    "ses_text_variants",
    1700000000110,
    1700000000110,
    JSON.stringify({ type: "text", content: "assistant content text" })
  );

  db.prepare(
    `INSERT INTO part (id, message_id, session_id, time_created, time_updated, data)
     VALUES (?, ?, ?, ?, ?, ?)`
  ).run(
    "part_assistant_delta",
    "msg_assistant_delta",
    "ses_text_variants",
    1700000000210,
    1700000000210,
    JSON.stringify({ type: "text", content_delta: "assistant delta text" })
  );

  db.prepare(
    `INSERT INTO part (id, message_id, session_id, time_created, time_updated, data)
     VALUES (?, ?, ?, ?, ?, ?)`
  ).run(
    "part_assistant_tool_only",
    "msg_assistant_tool_only",
    "ses_text_variants",
    1700000000310,
    1700000000310,
    JSON.stringify({
      type: "tool",
      tool: "bash",
      state: {
        input: { command: "pwd" },
        output: "/workspace/project\n",
      },
    })
  );

  db.prepare(
    `INSERT INTO part (id, message_id, session_id, time_created, time_updated, data)
     VALUES (?, ?, ?, ?, ?, ?)`
  ).run(
    "part_assistant_step_start",
    "msg_assistant_structured",
    "ses_text_variants",
    1700000000410,
    1700000000410,
    JSON.stringify({ type: "step-start", snapshot: "abc123def4567890" })
  );

  db.prepare(
    `INSERT INTO part (id, message_id, session_id, time_created, time_updated, data)
     VALUES (?, ?, ?, ?, ?, ?)`
  ).run(
    "part_assistant_reasoning",
    "msg_assistant_structured",
    "ses_text_variants",
    1700000000420,
    1700000000420,
    JSON.stringify({ type: "reasoning", text: "Plan next debugging step" })
  );

  db.prepare(
    `INSERT INTO part (id, message_id, session_id, time_created, time_updated, data)
     VALUES (?, ?, ?, ?, ?, ?)`
  ).run(
    "part_assistant_patch",
    "msg_assistant_structured",
    "ses_text_variants",
    1700000000430,
    1700000000430,
    JSON.stringify({
      type: "patch",
      files: ["/workspace/project/src/js/pages/opencode-ui/app.ts", "/workspace/project/README.md"],
    })
  );

  db.prepare(
    `INSERT INTO part (id, message_id, session_id, time_created, time_updated, data)
     VALUES (?, ?, ?, ?, ?, ?)`
  ).run(
    "part_assistant_step_finish",
    "msg_assistant_structured",
    "ses_text_variants",
    1700000000440,
    1700000000440,
    JSON.stringify({
      type: "step-finish",
      reason: "tool-calls",
      tokens: { total: 321 },
    })
  );

  db.prepare(
    `INSERT INTO part (id, message_id, session_id, time_created, time_updated, data)
     VALUES (?, ?, ?, ?, ?, ?)`
  ).run(
    "part_assistant_todo",
    "msg_assistant_todo",
    "ses_text_variants",
    1700000000510,
    1700000000510,
    JSON.stringify({
      type: "tool",
      tool: "todowrite",
      state: {
        status: "completed",
        input: {
          todos: [
            { content: "Investigate bug", status: "completed", priority: "high" },
            { content: "Ship fix", status: "pending", priority: "medium" },
          ],
        },
      },
    })
  );

  try {
    const result = readOpencodeUiSession("ses_text_variants", { dbPath });

    assert.equal(result.success, true);
    assert.equal(result.session!.messages.length, 5);
    assert.equal(result.session!.messages[0]!.text, "assistant content text");
    assert.equal(result.session!.messages[1]!.text, "assistant delta text");
    assert.equal(result.session!.messages[2]!.text, "");
    assert.equal(result.session!.messages[2]!.toolCalls[0]!.name, "bash");
    assert.equal(result.session!.messages[3]!.blocks[0]!.kind, "step");
    assert.equal(result.session!.messages[3]!.blocks[1]!.kind, "reasoning");
    assert.equal(result.session!.messages[3]!.blocks[2]!.kind, "patch");
    assert.equal(result.session!.messages[3]!.blocks[2]!.items![0]!, "app.ts");
    assert.match(result.session!.messages[3]!.text, new RegExp(t("message.stepStartTitle")));
    assert.match(result.session!.messages[3]!.text, new RegExp(t("message.reasoningTitle")));
    assert.match(result.session!.messages[3]!.text, new RegExp(t("message.patchTitle")));
    assert.match(result.session!.messages[3]!.text, /app\.ts/);
    assert.match(result.session!.messages[3]!.text, new RegExp(t("message.stepFinishTitle")));
    assert.equal(result.session!.messages[4]!.toolCalls[0]!.name, "todowrite");
    assert.equal(result.session!.todos.length, 2);
    assert.equal(result.session!.todos[0]!.content, "Investigate bug");
    assert.equal(result.session!.todos[1]!.status, "pending");
    assert.equal(result.session!.changed_files.length, 2);
    assert.equal(
      result.session!.changed_files[0]!,
      "/workspace/project/src/js/pages/opencode-ui/app.ts"
    );
    assert.equal(result.session!.changed_files[1]!, "/workspace/project/README.md");
  } finally {
    fixture.cleanup();
  }
});
void test("readOpencodeUiSession preserves historic image urls for preview-capable attachments", () => {
  const fixture = setupFixture();
  const { db, dbPath } = fixture;

  db.prepare(
    `INSERT INTO session (id, project_id, slug, directory, title, version, time_created, time_updated)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(
    "ses_history_image",
    "proj_main",
    "history-image-session",
    "/workspace/project",
    "History Image Session",
    "1.2.17",
    1700000000000,
    1700000003200
  );

  db.prepare(
    `INSERT INTO message (id, session_id, time_created, time_updated, data)
     VALUES (?, ?, ?, ?, ?)`
  ).run(
    "msg_history_image_user",
    "ses_history_image",
    1700000000210,
    1700000000210,
    JSON.stringify({ role: "user" })
  );

  db.prepare(
    `INSERT INTO part (id, message_id, session_id, time_created, time_updated, data)
     VALUES (?, ?, ?, ?, ?, ?)`
  ).run(
    "part_history_image_file",
    "msg_history_image_user",
    "ses_history_image",
    1700000000220,
    1700000000220,
    JSON.stringify({
      type: "file",
      filename: "screen.png",
      mime: "image/png",
      url: "https://example.test/assets/screen.png",
    })
  );

  try {
    const result = readOpencodeUiSession("ses_history_image", { dbPath });
    const file = result.session!.messages[0]!.files[0]!;

    assert.equal(result.success, true);
    assert.equal(file.fileName, "screen.png");
    assert.equal(file.media_type, "image/png");
    assert.equal(file.url, "https://example.test/assets/screen.png");
  } finally {
    fixture.cleanup();
  }
});
void test("readOpencodeUiSession surfaces retrying tool state as a warning notice", () => {
  const fixture = setupFixture();
  const { db, dbPath } = fixture;

  db.prepare(
    `INSERT INTO session (id, project_id, slug, directory, title, version, time_created, time_updated)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(
    "ses_notice",
    "proj_main",
    "notice-session",
    "/workspace/project",
    "Notice Session",
    "1.2.17",
    1700000000000,
    1700000003000
  );

  db.prepare(
    `INSERT INTO message (id, session_id, time_created, time_updated, data)
     VALUES (?, ?, ?, ?, ?)`
  ).run(
    "msg_notice_assistant",
    "ses_notice",
    1700000000200,
    1700000000200,
    JSON.stringify({ role: "assistant" })
  );

  db.prepare(
    `INSERT INTO part (id, message_id, session_id, time_created, time_updated, data)
     VALUES (?, ?, ?, ?, ?, ?)`
  ).run(
    "part_notice_tool",
    "msg_notice_assistant",
    "ses_notice",
    1700000000220,
    1700000000220,
    JSON.stringify({
      type: "tool",
      tool: "bash",
      state: {
        status: "retrying",
        message: "The usage limit has been reached",
        input: { command: "pwd" },
      },
    })
  );

  try {
    const result = readOpencodeUiSession("ses_notice", { dbPath });
    const assistant = result.session!.messages[0]!;

    assert.equal(result.success, true);
    assert.equal(assistant.role, "assistant");
    assert.equal(assistant.toolCalls[0]!.name, "bash");
    assert.equal(assistant.notices[0]!.tone, "warning");
    assert.equal(assistant.notices[0]!.title, "The usage limit has been reached");
    assert.equal(assistant.notices[0]!.meta, t("message.toolStateRetryMeta"));
  } finally {
    fixture.cleanup();
  }
});
void test("readOpencodeUiSession prefers tokenized interaction text over merged reasoning fallback", () => {
  const fixture = setupFixture();
  const { db, dbPath } = fixture;

  db.prepare(
    `INSERT INTO session (id, project_id, slug, directory, title, version, time_created, time_updated)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(
    "ses_interaction",
    "proj_main",
    "interaction-session",
    "/workspace/project",
    "Interaction Session",
    "1.2.17",
    1700000000000,
    1700000003000
  );

  db.prepare(
    `INSERT INTO message (id, session_id, time_created, time_updated, data)
     VALUES (?, ?, ?, ?, ?)`
  ).run(
    "msg_interaction",
    "ses_interaction",
    1700000000400,
    1700000000400,
    JSON.stringify({ role: "assistant" })
  );

  db.prepare(
    `INSERT INTO part (id, message_id, session_id, time_created, time_updated, data)
     VALUES (?, ?, ?, ?, ?, ?)`
  ).run(
    "part_interaction_reasoning",
    "msg_interaction",
    "ses_interaction",
    1700000000410,
    1700000000410,
    JSON.stringify({ type: "reasoning", text: "Need three clarifications" })
  );

  db.prepare(
    `INSERT INTO part (id, message_id, session_id, time_created, time_updated, data)
     VALUES (?, ?, ?, ?, ?, ?)`
  ).run(
    "part_interaction_text",
    "msg_interaction",
    "ses_interaction",
    1700000000420,
    1700000000420,
    JSON.stringify({
      type: "text",
      text: "Visible fallback\n[rovo-ui:v1:abc123]",
    })
  );

  try {
    const result = readOpencodeUiSession("ses_interaction", { dbPath });
    const assistant = result.session!.messages[0]!;

    assert.equal(result.success, true);
    assert.equal(assistant.role, "assistant");
    assert.equal(assistant.text, "Visible fallback\n[rovo-ui:v1:abc123]");
    assert.doesNotMatch(assistant.text, /Need three clarifications/u);
  } finally {
    fixture.cleanup();
  }
});
});
