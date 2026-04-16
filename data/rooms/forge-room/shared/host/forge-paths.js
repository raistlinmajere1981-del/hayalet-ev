function asNonEmptyString(value) {
  return typeof value === "string" && value.trim() !== "" ? value.trim() : null;
}
export function readForgeRoomStorageDir(runtimePaths) {
  return asNonEmptyString(runtimePaths?.storageDir);
}
export function createForgeRoomPaths(runtimePaths) {
  const roomStorageDir = readForgeRoomStorageDir(runtimePaths);
  if (roomStorageDir === null) {
    throw new Error("Forge room storage path is unavailable.");
  }
  return {
    roomStorageDir,
    sessionsDir: `${roomStorageDir}/sessions`,
    operatorProfilePath: `${roomStorageDir}/operator-profile.json`
  };
}
export function createForgeStoragePaths(runtimePaths, sessionId) {
  const { operatorProfilePath, roomStorageDir, sessionsDir } = createForgeRoomPaths(runtimePaths);
  const sessionDir = `${sessionsDir}/${sessionId}`;
  return {
    operatorProfilePath,
    roomStorageDir,
    sessionsDir,
    sessionDir,
    sessionFilePath: `${sessionDir}/session.json`,
    eventsPath: `${sessionDir}/events.jsonl`,
    exportsDir: `${sessionDir}/exports`,
    artifactsDir: `${sessionDir}/artifacts`
  };
}
