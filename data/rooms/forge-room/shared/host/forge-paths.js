function asNonEmptyString(value) {
  return typeof value === "string" && value.trim() !== "" ? value.trim() : null;
}
export function readForgeRoomStorageDir(runtimePaths) {
  return asNonEmptyString(runtimePaths?.storageDir);
}
export function createForgeStoragePaths(runtimePaths, sessionId) {
  const roomStorageDir = readForgeRoomStorageDir(runtimePaths);
  if (roomStorageDir === null) {
    throw new Error("Forge room storage path is unavailable.");
  }
  const sessionsDir = `${roomStorageDir}/sessions`;
  const sessionDir = `${sessionsDir}/${sessionId}`;
  return {
    roomStorageDir,
    sessionsDir,
    sessionDir,
    sessionFilePath: `${sessionDir}/session.json`,
    eventsPath: `${sessionDir}/events.jsonl`,
    exportsDir: `${sessionDir}/exports`,
    artifactsDir: `${sessionDir}/artifacts`
  };
}
