/**
 * Development Tools - Context Generator
 *
 * Session context document generation (.rovo/context.md)
 */

import { readFileSync, writeFileSync } from "fs";
import { join } from "path";
import { execSync } from "child_process";
import { createMcpTranslatorSync } from "../../utils/i18n/index.js";
import { DEV_CONFIG } from "./shared/config.js";
import { getAllFiles, countLines } from "./shared/utils.js";
import { PROJECT_ROOT } from "../../utils/project-root.js";

interface BootstrapResult {
  content: string;
  outputPath?: string;
  stats: { sections: number; lines: number };
}

interface PackageJsonLike {
  name?: string;
  version?: string;
}

function contextGeneratorT(
  key: string,
  params?: Record<string, string | number | boolean>
): string {
  return createMcpTranslatorSync()(`mcpServer.devTools.contextGenerator.${key}`, params);
}

function contextGeneratorDefT(
  key: string,
  params?: Record<string, string | number | boolean>
): string {
  return createMcpTranslatorSync()(`mcpServer.devTools.contextGenerator.definition.${key}`, params);
}

export async function bootstrapContext(
  projectRoot: string,
  options: { print?: boolean; full?: boolean } = {}
): Promise<BootstrapResult> {
  const t = contextGeneratorT;
  const lines: string[] = [];
  const now = new Date().toISOString().split("T")[0] ?? "unknown-date";

  // Header
  lines.push(t("document.title"));
  lines.push(t("document.generatedAt", { date: now }));
  lines.push("");

  // Package info
  try {
    const pkgRaw: unknown = JSON.parse(readFileSync(join(projectRoot, "package.json"), "utf-8"));
    const pkg: PackageJsonLike =
      typeof pkgRaw === "object" && pkgRaw !== null ? (pkgRaw as PackageJsonLike) : {};
    lines.push(t("document.projectInfoTitle"));
    lines.push(t("document.projectName", { name: pkg.name ?? "unknown", version: pkg.version ?? "0.0.0" }));

    // Git info
    try {
      const branch = execSync("git branch --show-current", {
        cwd: projectRoot,
        encoding: "utf-8",
      }).trim();
      const status = execSync("git status --short", { cwd: projectRoot, encoding: "utf-8" }).trim();
      lines.push(t("document.branch", { branch: branch !== "" ? branch : t("common.unknown") }));
      lines.push(
        t("document.uncommitted", {
          value:
            status !== ""
              ? t("document.uncommittedFiles", { count: status.split("\n").length })
              : t("document.none"),
        })
      );
    } catch {
      /* ignore */
    }
    lines.push("");
  } catch {
    /* ignore */
  }

  // Directory stats
  lines.push(t("document.structureTitle"));
  for (const srcDir of DEV_CONFIG.srcDirs) {
    // eslint-disable-next-line no-await-in-loop
    const files = await getAllFiles(srcDir, projectRoot);
    let totalLines = 0;
    for (const file of files) {
      totalLines += countLines(join(projectRoot, file));
    }
    lines.push(t("document.structureLine", { srcDir, fileCount: files.length, lineCount: totalLines }));
  }
  lines.push("");

  // Module map
  lines.push(t("document.moduleMapTitle"));
  lines.push("");
  lines.push(t("document.orchestratorsTitle"));
  lines.push(t("document.orchestrators.coreEngine"));
  lines.push(t("document.orchestrators.webviewManager"));
  lines.push(t("document.orchestrators.trafficManager"));
  lines.push(t("document.orchestrators.slotController"));
  lines.push("");

  // Critical rules
  lines.push(t("document.rulesTitle"));
  lines.push(t("document.rules.noConsoleLog"));
  lines.push(t("document.rules.addContext"));
  lines.push(t("document.rules.checkLogs"));
  lines.push("");

  // Commands
  lines.push(t("document.commandsTitle"));
  lines.push(t("document.commands.start"));
  lines.push(t("document.commands.lint"));
  lines.push(t("document.commands.preCommit"));
  lines.push("");

  // Recent commits
  try {
    const commits = execSync("git log --oneline -5", { cwd: projectRoot, encoding: "utf-8" })
      .trim()
      .split("\n");
    lines.push(t("document.recentCommitsTitle"));
    for (const commit of commits) {
      lines.push(`- ${commit}`);
    }
    lines.push("");
  } catch {
    /* ignore */
  }

  lines.push("---");
  lines.push(t("document.footer"));

  const content = lines.join("\n");

  // Write to file if not print mode
  let outputPath: string | undefined;
  if (options.print !== true) {
    outputPath = join(PROJECT_ROOT, ".rovo/context.md");
    writeFileSync(outputPath, content, "utf-8");
  }

  return {
    content:
      options.print === true
        ? content
        : t("output.created", { outputPath: outputPath ?? t("common.unknown") }),
    ...(outputPath !== undefined ? { outputPath } : {}),
    stats: { sections: 6, lines: lines.length },
  };
}

export const CONTEXT_GENERATOR_TOOL = {
  name: "hev_dev_bootstrap_context",
  description: contextGeneratorDefT("description"),
  inputSchema: {
    type: "object" as const,
    properties: {
      print: {
        type: "boolean" as const,
        description: contextGeneratorDefT("print"),
        default: false,
      },
      full: {
        type: "boolean" as const,
        description: contextGeneratorDefT("full"),
        default: false,
      },
    },
  },
  metadata: {
    category: "development",
    subcategory: "documentation",
    priority: "low",
    complexity: "simple",
    useCases: [
      contextGeneratorDefT("useCases.sessionContext"),
      contextGeneratorDefT("useCases.projectSummary"),
      contextGeneratorDefT("useCases.bootstrapDocumentation"),
    ],
    relatedTools: ["hev_dev_analyze_project", "hev_context_generate"],
    agentGuidance: contextGeneratorDefT("agentGuidance"),
    requiresConfirmation: false,
    riskLevel: "low",
    tags: ["context", "documentation", "bootstrap", "session"],
  },
};
