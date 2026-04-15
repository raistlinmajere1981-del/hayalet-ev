import test from "node:test";
import assert from "node:assert/strict";
import {
  access,
  mkdtemp,
  mkdir,
  readFile,
  readdir,
  rm,
  writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";

import { createForgeSessionStorage } from "../../rooms/forge-room/host/forge-session-storage.ts";

function createStorageDeps() {
  return {
    ensureRuntimeDirectory: async (dirPath: string) => {
      await mkdir(dirPath, { recursive: true });
    },
    listDirectory: async (dirPath: string) => {
      try {
        const entries = await readdir(dirPath, { withFileTypes: true });
        return entries.map((entry) => ({
          isDirectory: entry.isDirectory(),
          name: entry.name,
          path: join(dirPath, entry.name),
        }));
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code === "ENOENT") {
          return [];
        }
        throw error;
      }
    },
    readJsonFile: async (filePath: string) => {
      try {
        return JSON.parse(await readFile(filePath, "utf8")) as unknown;
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code === "ENOENT") {
          return null;
        }
        throw error;
      }
    },
    readTextFile: async (filePath: string) => {
      try {
        return await readFile(filePath, "utf8");
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code === "ENOENT") {
          return null;
        }
        throw error;
      }
    },
    writeJsonFile: async (filePath: string, value: unknown) => {
      await mkdir(dirname(filePath), { recursive: true });
      await writeFile(filePath, JSON.stringify(value, null, 2), "utf8");
    },
    writeTextFile: async (filePath: string, value: string) => {
      await mkdir(dirname(filePath), { recursive: true });
      await writeFile(filePath, value, "utf8");
    },
  };
}

test("forge-room session storage keeps sessions under the reserved room-local sessions root", async () => {
  const rootDir = await mkdtemp(join(tmpdir(), "forge-room-storage-"));
  const runtimePaths = {
    storageDir: rootDir,
  };
  const storage = createForgeSessionStorage(createStorageDeps());

  try {
    const session = await storage.createSession(runtimePaths);
    session.goal = {
      id: "forge-goal-1",
      summary: "Repair Room integration",
      brief: "Phase 1 persistence smoke",
      constraints: ["Keep storage local."],
      acceptanceCriteria: ["Keep the session reopen-safe."],
      status: "draft-ready",
      targetRoomId: "repair-room",
      createdAt: "2026-04-15T00:00:00.000Z",
      updatedAt: "2026-04-15T00:00:00.000Z",
    };
    await storage.saveSession(runtimePaths, session);
    await storage.appendEvent(runtimePaths, session.id, {
      id: "forge-event-1",
      sessionId: session.id,
      type: "session.saved",
      actorId: "coordinator",
      detail: { reason: "smoke" },
      createdAt: "2026-04-15T00:00:00.000Z",
    });

    const loaded = await storage.loadSession(runtimePaths, session.id);
    const latest = await storage.loadLatestSession(runtimePaths);
    const listed = await storage.listSessions(runtimePaths);
    const eventsPath = join(rootDir, "sessions", session.id, "events.jsonl");
    const sessionPath = join(rootDir, "sessions", session.id, "session.json");

    assert.equal(loaded?.goal?.summary, "Repair Room integration");
    assert.equal(latest?.id, session.id);
    assert.equal(listed.length, 1);
    await access(sessionPath);
    await access(eventsPath);
    const eventLog = await readFile(eventsPath, "utf8");
    assert.match(eventLog, /session\.saved/);
  } finally {
    await rm(rootDir, { recursive: true, force: true });
  }
});

test("forge-room session storage ignores non-session residue outside the reserved session root", async () => {
  const rootDir = await mkdtemp(join(tmpdir(), "forge-room-storage-residue-"));
  const runtimePaths = {
    storageDir: rootDir,
  };
  const storage = createForgeSessionStorage(createStorageDeps());

  try {
    await mkdir(join(rootDir, "build", "workspace"), { recursive: true });
    await writeFile(join(rootDir, "build", "workspace", "orphan.json"), "{}", "utf8");

    const listed = await storage.listSessions(runtimePaths);
    assert.deepEqual(listed, []);
    await assert.rejects(access(join(rootDir, "sessions", "build", "session.json")));
  } finally {
    await rm(rootDir, { recursive: true, force: true });
  }
});
