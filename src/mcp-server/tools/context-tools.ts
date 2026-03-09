/**
 * Context Generation Tools for MCP Server
 *
 * Multi-level project context generation with Repomix integration:
 * - hev_context_generate: generate context for a selected level
 * - hev_context_module: generate focused context for a specific module
 * - hev_context_status: inspect current context cache status
 * - hev_context_diff: inspect files affected by recent changes
 */

import { execSync, spawn } from "child_process";
import { existsSync, readFileSync, statSync, writeFileSync } from "fs";
import { join } from "path";
import type { TranslationParams } from "../../types/i18n.js";
import { createProgress } from "../utils/progress.js";
import { createMcpTranslator, createMcpTranslatorSync } from "../utils/i18n/index.js";

type ContextLevel = "L1" | "L2" | "L3" | "L4";
type McpTranslator = (key: string, params?: TranslationParams) => string;

interface ContextResult {
  success: boolean;
  level: ContextLevel | "custom";
  outputPath: string;
  stats: {
    files: number;
    tokens: number;
    chars: number;
    sizeKB: number;
  };
  cached: boolean;
  message: string;
}

interface ContextStatus {
  available: ContextLevel[];
  current: Record<
    ContextLevel,
    { exists: boolean; sizeKB: number; age: string; tokens: number } | null
  >;
  repomixVersion: string;
  lastGenerated?: string;
}

const LEVEL_INFO: Record<ContextLevel, { name: string; description: string; files: string }> = {
  L1: { name: "Quick", description: "AGENTS.md + package.json", files: "~2" },
  L2: { name: "Standard", description: "orchestrators + types", files: "~17" },
  L3: { name: "Deep", description: "full src/js + electron", files: "~150" },
  L4: { name: "Full", description: "full project including MCP server", files: "~190" },
};

import { PROJECT_ROOT } from "../utils/project-root.js";

const CONFIG_DIR = join(PROJECT_ROOT, ".rovo/context-configs");
const OUTPUT_DIR = join(PROJECT_ROOT, ".rovo/context");
const contextDefinitionTranslator = createMcpTranslatorSync();

function contextDefT(key: string, params?: TranslationParams): string {
  return contextDefinitionTranslator(`mcpServer.contextTools.definition.${key}`, params);
}

function contextT(t: McpTranslator, key: string, params?: TranslationParams): string {
  return t(`mcpServer.contextTools.${key}`, params);
}

function getLevelLabel(t: McpTranslator, level: ContextLevel): string {
  return contextT(t, `levels.${level}`);
}

async function runRepomix(
  configPath: string,
  projectRoot: string,
  timeoutMessage: string
): Promise<{
  success: boolean;
  output: string;
  stats?: { files: number; tokens: number; chars: number };
}> {
  return await new Promise((resolve) => {
    const child = spawn("repomix", ["--config", configPath], { cwd: projectRoot });
    let stdout = "";
    let stderr = "";

    child.stdout.on("data", (data: Buffer | string) => {
      stdout += typeof data === "string" ? data : data.toString("utf-8");
    });
    child.stderr.on("data", (data: Buffer | string) => {
      stderr += typeof data === "string" ? data : data.toString("utf-8");
    });

    child.on("close", (code) => {
      const output = stdout + stderr;

      // Parse stats from output
      const filesMatch = output.match(/Total Files:\s*(\d+)/);
      const tokensMatch = output.match(/Total Tokens:\s*([\d,]+)/);
      const charsMatch = output.match(/Total Chars:\s*([\d,]+)/);

      resolve({
        success: code === 0,
        output,
        ...(filesMatch
          ? {
              stats: {
                files: parseInt(filesMatch[1] ?? "0"),
                tokens: parseInt((tokensMatch?.[1] ?? "0").replace(/,/g, "")),
                chars: parseInt((charsMatch?.[1] ?? "0").replace(/,/g, "")),
              },
            }
          : {}),
      });
    });

    setTimeout(() => {
      child.kill("SIGTERM");
      resolve({ success: false, output: timeoutMessage });
    }, 180000);
  });
}

function formatAge(mtime: Date, t: McpTranslator): string {
  const diffMs = Date.now() - mtime.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffDays > 0) return contextT(t, "age.daysAgo", { count: diffDays });
  if (diffHours > 0) return contextT(t, "age.hoursAgo", { count: diffHours });
  if (diffMins > 0) return contextT(t, "age.minutesAgo", { count: diffMins });
  return contextT(t, "age.justNow");
}

// ============================================
// Tool 1: Generate Context
// ============================================

export async function generateContext(
  projectRoot: string,
  options: { level?: ContextLevel; force?: boolean; includeContent?: boolean } = {}
): Promise<ContextResult> {
  const level = options.level ?? "L2";
  const t = await createMcpTranslator();
  const progress = createProgress({
    operation: contextT(t, "generate.operation", { level }),
    total: 100,
  });

  const configPath = join(
    projectRoot,
    CONFIG_DIR,
    `level-${level.toLowerCase().replace("l", "")}-${getLevelName(level)}.json`
  );
  const outputPath = join(projectRoot, OUTPUT_DIR, `${level}-${getLevelName(level)}.txt`);

  if (!existsSync(configPath)) {
    return {
      success: false,
      level,
      outputPath,
      cached: false,
      stats: { files: 0, tokens: 0, chars: 0, sizeKB: 0 },
      message: contextT(t, "generate.configMissing", { configPath }),
    };
  }

  if (options.force !== true && existsSync(outputPath)) {
    const stat = statSync(outputPath);
    const ageMs = Date.now() - stat.mtime.getTime();

    if (ageMs < 3600000) {
      const content = readFileSync(outputPath, "utf-8");
      const tokenEstimate = Math.round(content.length / 4);
      const age = formatAge(stat.mtime, t);
      const sizeKB = Math.round(stat.size / 1024);

      progress.done(contextT(t, "generate.cacheUsedProgress", { age }));

      return {
        success: true,
        level,
        outputPath,
        cached: true,
        stats: {
          files: 0,
          tokens: tokenEstimate,
          chars: content.length,
          sizeKB,
        },
        message:
          options.includeContent === true
            ? content
            : contextT(t, "generate.cacheUsedMessage", {
                outputPath,
                age,
                sizeKB,
              }),
      };
    }
  }

  progress.update(30, contextT(t, "generate.runningRepomix"));
  const result = await runRepomix(
    configPath,
    projectRoot,
    contextT(t, "common.timeout", { seconds: 180 })
  );

  if (!result.success) {
    progress.fail(contextT(t, "generate.repomixFailedProgress"));
    return {
      success: false,
      level,
      outputPath,
      cached: false,
      stats: { files: 0, tokens: 0, chars: 0, sizeKB: 0 },
      message: contextT(t, "generate.repomixFailedMessage", { output: result.output }),
    };
  }

  const stat = statSync(outputPath);
  const sizeKB = Math.round(stat.size / 1024);
  const fileCount = result.stats?.files ?? 0;
  const tokenCount = result.stats?.tokens ?? 0;

  progress.done(contextT(t, "generate.successProgress", { fileCount, sizeKB }));

  let message = contextT(t, "generate.successMessage", {
    level,
    levelLabel: getLevelLabel(t, level),
    fileCount,
    tokenCount,
    sizeKB,
    outputPath,
  });

  if (options.includeContent === true) {
    message = readFileSync(outputPath, "utf-8");
  }

  return {
    success: true,
    level,
    outputPath,
    cached: false,
    stats: {
      files: result.stats?.files ?? 0,
      tokens: result.stats?.tokens ?? 0,
      chars: result.stats?.chars ?? 0,
      sizeKB,
    },
    message,
  };
}

function getLevelName(level: ContextLevel): string {
  return LEVEL_INFO[level].name.toLowerCase();
}

// ============================================
// Tool 2: Context Status
// ============================================

export function contextStatus(projectRoot: string): ContextStatus {
  const t = createMcpTranslatorSync();
  const status: ContextStatus = {
    available: [],
    current: { L1: null, L2: null, L3: null, L4: null },
    repomixVersion: contextT(t, "common.unknown"),
  };

  try {
    status.repomixVersion = execSync("repomix --version", { encoding: "utf-8" }).trim();
  } catch {
    /* ignore */
  }

  for (const level of ["L1", "L2", "L3", "L4"] as ContextLevel[]) {
    const configPath = join(
      projectRoot,
      CONFIG_DIR,
      `level-${level.toLowerCase().replace("l", "")}-${getLevelName(level)}.json`
    );
    const outputPath = join(projectRoot, OUTPUT_DIR, `${level}-${getLevelName(level)}.txt`);

    if (existsSync(configPath)) {
      status.available.push(level);
    }

    if (existsSync(outputPath)) {
      const stat = statSync(outputPath);
      const content = readFileSync(outputPath, "utf-8");
      const tokenEstimate = Math.round(content.length / 4);

      status.current[level] = {
        exists: true,
        sizeKB: Math.round(stat.size / 1024),
        age: formatAge(stat.mtime, t),
        tokens: tokenEstimate,
      };

      if (status.lastGenerated === undefined || stat.mtime > new Date(status.lastGenerated)) {
        status.lastGenerated = stat.mtime.toISOString();
      }
    }
  }

  return status;
}

// ============================================
// Tool 3: Module Context (Custom)
// ============================================

export async function moduleContext(
  projectRoot: string,
  options: { module: string; includeTests?: boolean }
): Promise<ContextResult> {
  const moduleName = options.module;
  const t = await createMcpTranslator();
  const progress = createProgress({
    operation: contextT(t, "module.operation", { moduleName }),
    total: 100,
  });

  const patterns: string[] = [];

  if (moduleName.includes("/")) {
    patterns.push(moduleName);
  } else {
    patterns.push(
      `src/js/modules/${moduleName}/**/*.ts`,
      `src/js/modules/${moduleName}.ts`,
      `src/js/modules/**/${moduleName}*.ts`,
      `electron/${moduleName}*.ts`,
      `electron/**/${moduleName}*.ts`,
      `mcp-server/**/${moduleName}*.ts`
    );
  }

  if (options.includeTests === true) {
    patterns.push(`**/${moduleName}*.test.ts`, `**/${moduleName}*.spec.ts`);
  }

  const tempConfig = {
    output: {
      style: "plain",
      filePath: join(PROJECT_ROOT, `.rovo/context/module-${moduleName.replace(/\//g, "-")}.txt`),
      headerText: contextT(t, "module.headerText", { moduleName }),
      showLineNumbers: true,
    },
    include: ["AGENTS.md", ...patterns],
    ignore: { useDefaultPatterns: true },
  };

  const tempConfigPath = join(PROJECT_ROOT, ".rovo/context-configs/temp-module.json");
  writeFileSync(tempConfigPath, JSON.stringify(tempConfig, null, 2));

  progress.update(30, contextT(t, "module.runningRepomix"));
  const result = await runRepomix(
    tempConfigPath,
    projectRoot,
    contextT(t, "common.timeout", { seconds: 180 })
  );

  const outputPath = join(projectRoot, tempConfig.output.filePath);

  if (!result.success || !existsSync(outputPath)) {
    progress.fail(contextT(t, "module.failedProgress"));
    return {
      success: false,
      level: "custom",
      outputPath,
      cached: false,
      stats: { files: 0, tokens: 0, chars: 0, sizeKB: 0 },
      message: contextT(t, "module.failedMessage", { output: result.output }),
    };
  }

  const stat = statSync(outputPath);
  const sizeKB = Math.round(stat.size / 1024);
  const fileCount = result.stats?.files ?? 0;

  progress.done(contextT(t, "module.successProgress", { fileCount, sizeKB }));

  return {
    success: true,
    level: "custom",
    outputPath,
    cached: false,
    stats: {
      files: result.stats?.files ?? 0,
      tokens: result.stats?.tokens ?? 0,
      chars: result.stats?.chars ?? 0,
      sizeKB,
    },
    message: contextT(t, "module.successMessage", {
      moduleName,
      fileCount,
      sizeKB,
      outputPath,
    }),
  };
}

// ============================================
// Tool 4: Read Context
// ============================================

export function readContext(
  projectRoot: string,
  level: ContextLevel
): { success: boolean; content: string; stats?: { sizeKB: number; tokens: number } } {
  const t = createMcpTranslatorSync();
  const outputPath = join(projectRoot, OUTPUT_DIR, `${level}-${getLevelName(level)}.txt`);

  if (!existsSync(outputPath)) {
    return {
      success: false,
      content: contextT(t, "read.missing", { outputPath, level }),
    };
  }

  const content = readFileSync(outputPath, "utf-8");
  const stat = statSync(outputPath);

  return {
    success: true,
    content,
    stats: {
      sizeKB: Math.round(stat.size / 1024),
      tokens: Math.round(content.length / 4),
    },
  };
}

// ============================================
// Tool Definitions
// ============================================

export const CONTEXT_TOOL_DEFINITIONS = [
  {
    name: "hev_context_generate",
    description: contextDefT("generate.description"),
    inputSchema: {
      type: "object" as const,
      properties: {
        level: {
          type: "string",
          enum: ["L1", "L2", "L3", "L4"],
          description: contextDefT("generate.level"),
          default: "L2",
        },
        force: {
          type: "boolean",
          description: contextDefT("generate.force"),
          default: false,
        },
        include_content: {
          type: "boolean",
          description: contextDefT("generate.includeContent"),
          default: false,
        },
      },
    },
    metadata: {
      category: "context",
      subcategory: "generation",
      priority: "high",
      complexity: "medium",
      useCases: [
        contextDefT("generate.useCases.projectContext"),
        contextDefT("generate.useCases.codebaseSummary"),
        contextDefT("generate.useCases.codeAnalysis"),
      ],
      relatedTools: ["hev_context_status", "hev_context_read"],
      agentGuidance: contextDefT("generate.agentGuidance"),
      requiresConfirmation: false,
      riskLevel: "low",
      tags: ["context", "repomix", "codebase", "generation"],
    },
  },
  {
    name: "hev_context_status",
    description: contextDefT("status.description"),
    inputSchema: {
      type: "object" as const,
      properties: {},
    },
    metadata: {
      category: "context",
      subcategory: "status",
      priority: "medium",
      complexity: "simple",
      useCases: [
        contextDefT("status.useCases.checkFiles"),
        contextDefT("status.useCases.cacheState"),
        contextDefT("status.useCases.tokenCount"),
      ],
      relatedTools: ["hev_context_generate"],
      agentGuidance: contextDefT("status.agentGuidance"),
      requiresConfirmation: false,
      riskLevel: "low",
      tags: ["context", "status", "cache"],
    },
  },
  {
    name: "hev_context_module",
    description: contextDefT("module.description"),
    inputSchema: {
      type: "object" as const,
      properties: {
        module: {
          type: "string",
          description: contextDefT("module.module"),
        },
        include_tests: {
          type: "boolean",
          description: contextDefT("module.includeTests"),
          default: false,
        },
      },
      required: ["module"],
    },
    metadata: {
      category: "context",
      subcategory: "module",
      priority: "medium",
      complexity: "simple",
      useCases: [
        contextDefT("module.useCases.moduleSpecific"),
        contextDefT("module.useCases.focusedAnalysis"),
        contextDefT("module.useCases.smallScope"),
      ],
      relatedTools: ["hev_context_generate"],
      agentGuidance: contextDefT("module.agentGuidance"),
      requiresConfirmation: false,
      riskLevel: "low",
      tags: ["context", "module", "focused"],
    },
  },
  {
    name: "hev_context_read",
    description: contextDefT("read.description"),
    inputSchema: {
      type: "object" as const,
      properties: {
        level: {
          type: "string",
          enum: ["L1", "L2", "L3", "L4"],
          description: contextDefT("read.level"),
          default: "L2",
        },
      },
    },
    metadata: {
      category: "context",
      subcategory: "read",
      priority: "low",
      complexity: "simple",
      useCases: [
        contextDefT("read.useCases.readGenerated"),
        contextDefT("read.useCases.loadFromCache"),
      ],
      relatedTools: ["hev_context_generate", "hev_context_status"],
      agentGuidance: contextDefT("read.agentGuidance"),
      requiresConfirmation: false,
      riskLevel: "low",
      tags: ["context", "read", "cache"],
    },
  },
];

// Auto-generated metadata for listTools()
export const CONTEXT_TOOL_METADATA = {
  category: "Context Generation",
  emoji: "📊",
  tools: CONTEXT_TOOL_DEFINITIONS.map((t) => t.name),
};
