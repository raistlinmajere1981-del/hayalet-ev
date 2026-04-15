type ForgeRuntimePathsRecord = Record<string, unknown> & {
  storageDir?: unknown;
};

export interface ForgeStoragePaths {
  artifactsDir: string;
  eventsPath: string;
  exportsDir: string;
  roomStorageDir: string;
  sessionDir: string;
  sessionFilePath: string;
  sessionsDir: string;
}

function asNonEmptyString(value: unknown): string | null {
  return typeof value === "string" && value.trim() !== "" ? value.trim() : null;
}

export function readForgeRoomStorageDir(runtimePaths: unknown): string | null {
  return asNonEmptyString((runtimePaths as ForgeRuntimePathsRecord | null)?.storageDir);
}

export function createForgeStoragePaths(
  runtimePaths: unknown,
  sessionId: string
): ForgeStoragePaths {
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
    artifactsDir: `${sessionDir}/artifacts`,
  };
}
