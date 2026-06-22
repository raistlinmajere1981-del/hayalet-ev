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


describe("readOpencodeUiSession aggregates usage from assistant message tokens", () => {
void test("readOpencodeUiSession aggregates usage from assistant message tokens", () => {
  const fixture = setupFixture();
  const { db, dbPath } = fixture;

  db.prepare(
    `INSERT INTO session (id, project_id, slug, directory, title, version, time_created, time_updated)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(
    "ses_usage",
    "proj_main",
    "usage-session",
    "/workspace/project",
    "Usage Session",
    "1.2.18",
    1700000000000,
    1700000005000
  );

  db.prepare(
    `INSERT INTO message (id, session_id, time_created, time_updated, data)
     VALUES (?, ?, ?, ?, ?)`
  ).run(
    "msg_usage_assistant",
    "ses_usage",
    1700000005100,
    1700000005100,
    JSON.stringify({
      role: "assistant",
      providerID: "openai",
      modelID: "gpt-5.3-codex",
      tokens: {
        input: 120,
        output: 80,
        reasoning: 20,
      },
    })
  );

  db.prepare(
    `INSERT INTO part (id, message_id, session_id, time_created, time_updated, data)
     VALUES (?, ?, ?, ?, ?, ?)`
  ).run(
    "part_usage_assistant_text",
    "msg_usage_assistant",
    "ses_usage",
    1700000005110,
    1700000005110,
    JSON.stringify({ type: "text", text: "usage test" })
  );

  try {
    const result = readOpencodeUiSession("ses_usage", { dbPath });

    assert.equal(result.success, true);
    assert.equal(result.session!.usage["prompt_tokens"], 120);
    assert.equal(result.session!.usage["completion_tokens"], 80);
    assert.equal(result.session!.usage["reasoning_tokens"], 20);
    assert.equal(result.session!.usage["total_tokens"], 200);
  } finally {
    fixture.cleanup();
  }
});
});
