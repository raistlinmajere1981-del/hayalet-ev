/**
 * Development Tools - Project Analyzer
 *
 * Project statistics, dependency, and git state analysis
 */

import { readFileSync } from "fs";
import { join } from "path";
import { execSync } from "child_process";
import { DEV_CONFIG } from "./shared/config.js";
import { getAllFiles, countLines } from "./shared/utils.js";
import { createMcpTranslatorSync } from "../../utils/i18n/index.js";
import { createProgress } from "../../utils/progress.js";

interface AnalyzeResult {
  summary: {
    totalFiles: number;
    totalLines: number;
    byDirectory: Record<string, { files: number; lines: number }>;
  };
  dependencies?: {
    production: string[];
    development: string[];
  };
  modules?: Array<{ file: string; imports: string[]; exports: string[] }>;
  git?: {
    branch: string;
    lastCommits: string[];
    hasChanges: boolean;
  };
}

function getObjectKeys(value: unknown): string[] {
  if (value === null || typeof value !== "object") return [];
  return Object.keys(value as Record<string, unknown>);
}

function projectAnalyzerT(key: string, params?: Record<string, string | number | boolean>): string {
  return createMcpTranslatorSync()(`mcpServer.devTools.projectAnalyzer.${key}`, params);
}

function projectAnalyzerDefT(
  key: string,
  params?: Record<string, string | number | boolean>
): string {
  return createMcpTranslatorSync()(`mcpServer.devTools.projectAnalyzer.definition.${key}`, params);
}

export async function analyzeProject(
  projectRoot: string,
  options: { mode?: "summary" | "deps" | "modules" | "full" } = {}
): Promise<AnalyzeResult> {
  const mode = options.mode ?? "summary";
  const progress = createProgress({
    operation: projectAnalyzerT("progress.operation"),
    total: DEV_CONFIG.srcDirs.length + 3,
  });

  const result: AnalyzeResult = {
    summary: { totalFiles: 0, totalLines: 0, byDirectory: {} },
  };

  // Dosya istatistikleri
  let step = 0;
  for (const srcDir of DEV_CONFIG.srcDirs) {
    progress.update(++step, projectAnalyzerT("progress.scanningDir", { srcDir }));
    // eslint-disable-next-line no-await-in-loop
    const files = await getAllFiles(srcDir, projectRoot);
    let dirLines = 0;

    for (const file of files) {
      const lines = countLines(join(projectRoot, file));
      dirLines += lines;
    }

    result.summary.byDirectory[srcDir] = { files: files.length, lines: dirLines };
    result.summary.totalFiles += files.length;
    result.summary.totalLines += dirLines;
  }

  // Dependencies
  if (mode === "deps" || mode === "full") {
    try {
      const pkgRaw: unknown = JSON.parse(readFileSync(join(projectRoot, "package.json"), "utf-8"));
      const pkg = (pkgRaw !== null && typeof pkgRaw === "object" ? pkgRaw : {}) as {
        dependencies?: unknown;
        devDependencies?: unknown;
      };
      result.dependencies = {
        production: getObjectKeys(pkg.dependencies),
        development: getObjectKeys(pkg.devDependencies),
      };
    } catch {
      /* ignore */
    }
  }

  // Git info
  if (mode === "summary" || mode === "full") {
    try {
      const branch = execSync("git branch --show-current", {
        cwd: projectRoot,
        encoding: "utf-8",
      }).trim();
      const commits = execSync("git log --oneline -5", { cwd: projectRoot, encoding: "utf-8" })
        .trim()
        .split("\n");
      const status = execSync("git status --short", { cwd: projectRoot, encoding: "utf-8" }).trim();
      result.git = { branch, lastCommits: commits, hasChanges: status.length > 0 };
    } catch {
      /* ignore */
    }
  }

  // Module analysis
  if (mode === "modules" || mode === "full") {
    step += 1;
    progress.update(step, projectAnalyzerT("progress.analyzingModules"));
    result.modules = [];
    const allFiles: string[] = [];
    for (const srcDir of DEV_CONFIG.srcDirs) {
      // eslint-disable-next-line no-await-in-loop
      const files = await getAllFiles(srcDir, projectRoot);
      allFiles.push(...files);
    }

    for (const file of allFiles.slice(0, 50)) {
      // Limit for performance
      try {
        const content = readFileSync(join(projectRoot, file), "utf-8");
        const imports = [...content.matchAll(/import\s+.*?\s+from\s+['"]([^'"]+)['"]/g)].map(
          (m) => m[1] ?? ""
        );
        const exports = [
          ...content.matchAll(
            /export\s+(?:async\s+)?(?:function|const|class|interface|type)\s+(\w+)/g
          ),
        ].map((m) => m[1] ?? "");
        if (imports.length > 0 || exports.length > 0) {
          result.modules.push({ file, imports, exports });
        }
      } catch {
        /* ignore */
      }
    }
  }

  progress.done(projectAnalyzerT("progress.completed", { totalFiles: result.summary.totalFiles }));
  return result;
}

export const PROJECT_ANALYZER_TOOL = {
  name: "hev_dev_analyze_project",
  description: projectAnalyzerDefT("description"),
  inputSchema: {
    type: "object" as const,
    properties: {
      mode: {
        type: "string" as const,
        enum: ["summary", "deps", "modules", "full"],
        description: projectAnalyzerDefT("mode"),
        default: "summary",
      },
    },
  },
  metadata: {
    category: "development",
    subcategory: "analysis",
    priority: "medium",
    complexity: "medium",
    useCases: [
      projectAnalyzerDefT("useCases.summary"),
      projectAnalyzerDefT("useCases.dependencies"),
      projectAnalyzerDefT("useCases.modules"),
      projectAnalyzerDefT("useCases.full"),
    ],
    relatedTools: ["hev_dev_generate_diagram", "hev_dev_update_cache", "hev_git_pr_status"],
    agentGuidance: projectAnalyzerDefT("agentGuidance"),
    requiresConfirmation: false,
    riskLevel: "low",
    tags: ["analysis", "statistics", "overview", "dependencies", "git", "enum-validation"],
  },
};
