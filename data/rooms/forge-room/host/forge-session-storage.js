import { FORGE_ROOM_ID } from "../shared/forge-constants.js";
import { createForgeStoragePaths, readForgeRoomStorageDir } from "../shared/host/forge-paths.js";
import { createEmptyForgeSession } from "./state/forge-runtime-state.js";
function createId(prefix) {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return `${prefix}-${crypto.randomUUID()}`;
  }
  return `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2, 10)}`;
}
function asSession(value) {
  return value !== null && typeof value === "object" && Array.isArray(value) === false && typeof value.id === "string" ? value : null;
}
export function createForgeSessionStorage(deps) {
  const {
    ensureRuntimeDirectory,
    listDirectory,
    readJsonFile,
    readTextFile,
    writeJsonFile,
    writeTextFile
  } = deps;
  async function ensureSessionRoot(runtimePaths) {
    const roomStorageDir = readForgeRoomStorageDir(runtimePaths);
    if (roomStorageDir === null) {
      throw new Error("Forge room storage is unavailable.");
    }
    const sessionsDir = `${roomStorageDir}/sessions`;
    await ensureRuntimeDirectory(sessionsDir);
    return sessionsDir;
  }
  async function createSession(runtimePaths) {
    const sessionId = createId("forge-session");
    const session = createEmptyForgeSession(sessionId);
    await saveSession(runtimePaths, session);
    return session;
  }
  async function saveSession(runtimePaths, session) {
    const paths = createForgeStoragePaths(runtimePaths, session.id);
    await ensureRuntimeDirectory(paths.sessionsDir);
    await ensureRuntimeDirectory(paths.sessionDir);
    await ensureRuntimeDirectory(paths.exportsDir);
    await ensureRuntimeDirectory(paths.artifactsDir);
    await writeJsonFile(paths.sessionFilePath, session);
    return session;
  }
  async function loadSession(runtimePaths, sessionId) {
    const session = asSession(
      await readJsonFile(createForgeStoragePaths(runtimePaths, sessionId).sessionFilePath)
    );
    if (session === null || session.roomId !== FORGE_ROOM_ID) {
      return null;
    }
    return session;
  }
  async function listSessions(runtimePaths) {
    const sessionsDir = await ensureSessionRoot(runtimePaths);
    const entries = await listDirectory(sessionsDir);
    const items = (await Promise.all(
      entries.filter((entry) => entry.isDirectory === true).map(async (entry) => {
        const loaded = asSession(await readJsonFile(`${entry.path}/session.json`));
        if (loaded === null || loaded.roomId !== FORGE_ROOM_ID) {
          return null;
        }
        return {
          id: loaded.id,
          updatedAt: loaded.updatedAt,
          title: loaded.goal?.summary || loaded.id
        };
      })
    )).filter((entry) => entry !== null);
    return items.sort((left, right) => right.updatedAt.localeCompare(left.updatedAt));
  }
  async function loadLatestSession(runtimePaths) {
    const sessions = await listSessions(runtimePaths);
    const latest = sessions[0];
    return latest ? await loadSession(runtimePaths, latest.id) : null;
  }
  async function appendEvent(runtimePaths, sessionId, eventLog) {
    const paths = createForgeStoragePaths(runtimePaths, sessionId);
    await ensureRuntimeDirectory(paths.sessionDir);
    const current = await readTextFile(paths.eventsPath) ?? "";
    const nextLine = `${JSON.stringify(eventLog)}
`;
    await writeTextFile(paths.eventsPath, `${current}${nextLine}`);
  }
  return {
    appendEvent,
    createSession,
    ensureSessionRoot,
    listSessions,
    loadLatestSession,
    loadSession,
    saveSession
  };
}
