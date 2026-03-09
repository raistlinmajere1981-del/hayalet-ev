/**
 * Development Tools - Git Tools
 *
 * Git diff and stat output.
 */

import { execSync } from "child_process";
import { createMcpTranslatorSync } from "../../utils/i18n/index.js";
import { logToolError } from "../../utils/mcp-logger.js";

function gitDiffT(key: string, params?: Record<string, string | number | boolean>): string {
  return createMcpTranslatorSync()(`mcpServer.devTools.gitDiff.${key}`, params);
}

function gitDiffDefT(key: string, params?: Record<string, string | number | boolean>): string {
  return createMcpTranslatorSync()(`mcpServer.devTools.gitDiff.definition.${key}`, params);
}

export function gitDiff(
  projectRoot: string,
  options: { staged?: boolean; file?: string } = {}
): { success: boolean; diff: string; stats?: { additions: number; deletions: number } } {
  try {
    let cmd = "git diff";
    if (options.staged === true) cmd += " --staged";
    if (options.file !== undefined && options.file.length > 0) cmd += ` -- "${options.file}"`;

    const diff = execSync(cmd, {
      cwd: projectRoot,
      encoding: "utf-8",
      maxBuffer: 10 * 1024 * 1024,
    });

    // Stats
    let statsCmd = "git diff --stat";
    if (options.staged === true) statsCmd += " --staged";
    if (options.file !== undefined && options.file.length > 0) statsCmd += ` -- "${options.file}"`;

    const statOutput = execSync(statsCmd, { cwd: projectRoot, encoding: "utf-8" });
    const statMatch = statOutput.match(/(\d+) insertions?\(\+\).*?(\d+) deletions?\(-\)/);

    return {
      success: true,
      diff: diff.length > 0 ? diff : gitDiffT("runtime.noChanges"),
      ...(statMatch
        ? {
            stats: {
              additions: parseInt(statMatch[1] ?? "0"),
              deletions: parseInt(statMatch[2] ?? "0"),
            },
          }
        : {}),
    };
  } catch (error) {
    logToolError("hev_dev_git_diff", error as Error, {
      staged: options.staged,
      file: options.file,
    });
    return { success: false, diff: (error as Error).message };
  }
}

export const GIT_DIFF_TOOL = {
  name: "hev_dev_git_diff",
  description: gitDiffDefT("description"),
  inputSchema: {
    type: "object" as const,
    properties: {
      staged: {
        type: "boolean" as const,
        description: gitDiffDefT("staged"),
        default: false,
      },
      file: {
        type: "string" as const,
        description: gitDiffDefT("file"),
      },
    },
  },
  metadata: {
    category: "development",
    subcategory: "git",
    priority: "medium",
    complexity: "simple",
    useCases: [
      gitDiffDefT("useCases.beforeCommit"),
      gitDiffDefT("useCases.stagedVsUnstaged"),
      gitDiffDefT("useCases.specificFile"),
    ],
    relatedTools: ["hev_git_pr_status", "hev_git_create_pr", "hev_fs_diff"],
    agentGuidance: gitDiffDefT("agentGuidance"),
    requiresConfirmation: false,
    riskLevel: "low",
    tags: ["git", "diff", "changes", "version-control"],
  },
};
