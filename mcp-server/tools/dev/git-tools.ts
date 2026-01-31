/**
 * Development Tools - Git Tools
 * 
 * Git diff ve stat çıktıları
 */

import { execSync } from "child_process";
import { logToolError } from "../../utils/mcp-logger.js";

export function gitDiff(projectRoot: string, options: { staged?: boolean; file?: string } = {}): { success: boolean; diff: string; stats?: { additions: number; deletions: number } } {
  try {
    let cmd = "git diff";
    if (options.staged) cmd += " --staged";
    if (options.file) cmd += ` -- "${options.file}"`;
    
    const diff = execSync(cmd, { cwd: projectRoot, encoding: "utf-8", maxBuffer: 10 * 1024 * 1024 });
    
    // Stats
    let statsCmd = "git diff --stat";
    if (options.staged) statsCmd += " --staged";
    if (options.file) statsCmd += ` -- "${options.file}"`;
    
    const statOutput = execSync(statsCmd, { cwd: projectRoot, encoding: "utf-8" });
    const statMatch = statOutput.match(/(\d+) insertions?\(\+\).*?(\d+) deletions?\(-\)/);
    
    return {
      success: true,
      diff: diff || "Değişiklik yok",
      stats: statMatch ? { additions: parseInt(statMatch[1] || '0'), deletions: parseInt(statMatch[2] || '0') } : undefined,
    };
  } catch (error) {
    logToolError("hev_dev_git_diff", error as Error, { staged: options.staged, file: options.file });
    return { success: false, diff: (error as Error).message };
  }
}

export const GIT_DIFF_TOOL = {
  name: "hev_dev_git_diff",
  description: "Git değişikliklerini göster (staged veya unstaged)",
  inputSchema: {
    type: "object" as const,
    properties: {
      staged: {
        type: "boolean" as const,
        description: "Staged değişiklikler (git add sonrası)",
        default: false,
      },
      file: {
        type: "string" as const,
        description: "Sadece belirli dosya",
            },
    },
  },
  metadata: {
    category: 'development',
    subcategory: 'git',
    priority: 'medium',
    complexity: 'simple',
    useCases: [
      'View git changes before commit',
      'Check staged vs unstaged differences',
      'Inspect specific file changes'
    ],
    relatedTools: ['hev_git_pr_status', 'hev_git_create_pr', 'hev_fs_diff'],
    agentGuidance: 'Use to inspect code changes. Shows diff with stats (additions/deletions). Use staged=true for pre-commit review.',
    requiresConfirmation: false,
    riskLevel: 'low',
    tags: ['git', 'diff', 'changes', 'version-control']
  }
};
