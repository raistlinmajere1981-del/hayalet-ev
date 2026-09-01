import {
  FATE_KNOTS_AI0_RUNTIME_PROFILE,
  buildFateKnotsAi0WorkspaceSpec,
} from "../shared/ai0-runtime.js";

export interface FateKnotsAi0WorkspaceIo {
  resolveRoomStorageDir(): Promise<string>;
  deleteDirectory(path: string): Promise<void>;
  ensureDirectory(path: string): Promise<void>;
  writeTextFile(path: string, content: string): Promise<void>;
}

export interface FateKnotsAi0MaterializedWorkspace {
  workspaceDir: string;
  policyPath: string;
  runtimeProfileId: typeof FATE_KNOTS_AI0_RUNTIME_PROFILE.id;
}

function requireStorageDir(value: string): string {
  const normalized = typeof value === "string" ? value.trim().replace(/[\\/]+$/g, "") : "";
  if (normalized === "") {
    throw new Error("Fate Knots AI0 room storage path is unavailable.");
  }
  return normalized;
}

function joinRuntimePath(root: string, segments: readonly string[]): string {
  return [root, ...segments.map((segment) => segment.replace(/^[\\/]+|[\\/]+$/g, ""))].join("/");
}

/**
 * Materializes the minimal AI0 runtime workspace under the Game Room managed
 * app-data storage root.
 *
 * The universe workspace is deleted before recreation so stale files from an
 * earlier runtime cannot silently extend AI0 context. Only files declared by
 * buildFateKnotsAi0WorkspaceSpec() are written back.
 */
export async function materializeFateKnotsAi0Workspace(
  io: FateKnotsAi0WorkspaceIo,
  universeId: string
): Promise<FateKnotsAi0MaterializedWorkspace> {
  const spec = buildFateKnotsAi0WorkspaceSpec(universeId);
  const storageDir = requireStorageDir(await io.resolveRoomStorageDir());
  const workspaceDir = joinRuntimePath(storageDir, spec.relativeSegments);

  await io.deleteDirectory(workspaceDir);
  await io.ensureDirectory(workspaceDir);

  let policyPath = "";
  for (const file of spec.files) {
    const filePath = joinRuntimePath(workspaceDir, [file.relativePath]);
    await io.writeTextFile(filePath, file.content);
    if (file.relativePath === "AGENTS.md") policyPath = filePath;
  }

  if (policyPath === "") {
    throw new Error("Fate Knots AI0 minimal policy was not materialized.");
  }

  return {
    workspaceDir,
    policyPath,
    runtimeProfileId: FATE_KNOTS_AI0_RUNTIME_PROFILE.id,
  };
}
