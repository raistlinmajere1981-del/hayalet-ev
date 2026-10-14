import { createHash } from "node:crypto";
import { lstat, mkdir, mkdtemp, writeFile } from "node:fs/promises";
import { join } from "node:path";
import type { AgentProfileResolution } from "../shared/agent-profiles.js";

// Runtime workspaces start empty; project policy and .rovo are never copied in.
export async function createAgentProfileWorkspace(
  workspaceRoot: string,
  resolution: AgentProfileResolution
): Promise<{ workspacePath: string; agentsPath: string; hash: string }> {
  await mkdir(workspaceRoot, { recursive: true, mode: 0o700 });
  const root = await lstat(workspaceRoot);
  if (!root.isDirectory() || root.isSymbolicLink())
    throw new Error("Unsafe profile workspace root");
  const scopeHash = createHash("sha256")
    .update(JSON.stringify(resolution.scope))
    .digest("hex")
    .slice(0, 16);
  const workspacePath = await mkdtemp(join(workspaceRoot, `${scopeHash}-`));
  const agentsPath = join(workspacePath, "AGENTS.md");
  await writeFile(
    agentsPath,
    `<!-- Agent Profile Registry v${resolution.resolverVersion}; sha256=${resolution.hash} -->\n${resolution.system}\n`,
    { encoding: "utf8", mode: 0o600, flag: "wx" }
  );
  return { workspacePath, agentsPath, hash: resolution.hash };
}
