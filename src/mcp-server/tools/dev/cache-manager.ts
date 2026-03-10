import { readFileSync, writeFileSync, existsSync } from "fs";
import { join } from "path";
import { createHash } from "crypto";
import { createMcpTranslatorSync } from "../../utils/i18n/index.js";
import { DEV_CONFIG } from "./shared/config.js";
import { getAllFiles } from "./shared/utils.js";
import { PROJECT_ROOT } from "../../utils/project-root.js";

interface CacheData {
  version: string;
  timestamp: string;
  files: Record<string, { hash: string; lines: number; exports: string[] }>;
  stats: { totalFiles: number; totalLines: number; totalExports: number };
}

interface CacheResult {
  updated: boolean;
  path: string;
  stats: { totalFiles: number; totalLines: number; totalExports: number };
  changedFiles: string[];
}

function cacheManagerDefT(key: string, params?: Record<string, string | number | boolean>): string {
  return createMcpTranslatorSync()(`mcpServer.devTools.cacheManager.definition.${key}`, params);
}

function parseCacheData(value: unknown): CacheData | null {
  if (value === null || typeof value !== "object") return null;
  const data = value as {
    version?: unknown;
    timestamp?: unknown;
    files?: unknown;
    stats?: unknown;
  };
  if (typeof data.version !== "string") return null;
  if (typeof data.timestamp !== "string") return null;
  if (data.files === undefined || data.files === null || typeof data.files !== "object")
    return null;
  if (data.stats === undefined || data.stats === null || typeof data.stats !== "object")
    return null;
  const stats = data.stats as {
    totalFiles?: unknown;
    totalLines?: unknown;
    totalExports?: unknown;
  };
  if (typeof stats.totalFiles !== "number") return null;
  if (typeof stats.totalLines !== "number") return null;
  if (typeof stats.totalExports !== "number") return null;
  return value as CacheData;
}

export async function updateCache(
  projectRoot: string,
  options: { force?: boolean; show?: boolean } = {}
): Promise<CacheResult> {
  const cachePath = join(PROJECT_ROOT, ".rovo/cache.json");

  let existingCache: CacheData | null = null;
  if (existsSync(cachePath) && options.force !== true) {
    try {
      const parsed: unknown = JSON.parse(readFileSync(cachePath, "utf-8"));
      existingCache = parseCacheData(parsed);
    } catch {
      // NOTE: Intentionally ignored.
    }
  }

  if (options.show === true && existingCache !== null) {
    return {
      updated: false,
      path: cachePath,
      stats: existingCache.stats,
      changedFiles: [],
    };
  }

  const newCache: CacheData = {
    version: "1.0.0",
    timestamp: new Date().toISOString(),
    files: {},
    stats: { totalFiles: 0, totalLines: 0, totalExports: 0 },
  };

  const changedFiles: string[] = [];
  const allFiles: string[] = [];

  for (const srcDir of DEV_CONFIG.srcDirs) {
    // eslint-disable-next-line no-await-in-loop
    const files = await getAllFiles(srcDir, projectRoot);
    allFiles.push(...files);
  }

  for (const file of allFiles) {
    try {
      const content = readFileSync(join(projectRoot, file), "utf-8");
      const hash = createHash("md5").update(content).digest("hex").slice(0, 8);
      const lines = content.split("\n").length;
      const exports = [
        ...content.matchAll(
          /export\s+(?:async\s+)?(?:function|const|class|interface|type)\s+(\w+)/g
        ),
      ].map((m) => m[1] ?? "");

      if (existingCache?.files[file]?.hash !== hash) {
        changedFiles.push(file);
      }

      newCache.stats.totalFiles++;
      newCache.stats.totalLines += lines;
      newCache.stats.totalExports += exports.length;
    } catch {
      // NOTE: Intentionally ignored.
    }
  }

  writeFileSync(cachePath, JSON.stringify(newCache, null, 2), "utf-8");

  return {
    updated: true,
    path: cachePath,
    stats: newCache.stats,
    changedFiles,
  };
}

export const CACHE_MANAGER_TOOL = {
  name: "hev_dev_update_cache",
  description: cacheManagerDefT("description"),
  inputSchema: {
    type: "object" as const,
    properties: {
      force: {
        type: "boolean" as const,
        description: cacheManagerDefT("force"),
        default: false,
      },
      show: {
        type: "boolean" as const,
        description: cacheManagerDefT("show"),
        default: false,
      },
    },
  },
  metadata: {
    category: "development",
    subcategory: "optimization",
    priority: "low",
    complexity: "medium",
    useCases: [
      cacheManagerDefT("useCases.trackChanges"),
      cacheManagerDefT("useCases.buildMap"),
      cacheManagerDefT("useCases.optimize"),
    ],
    relatedTools: ["hev_dev_analyze_project"],
    agentGuidance: cacheManagerDefT("agentGuidance"),
    requiresConfirmation: false,
    riskLevel: "low",
    tags: ["cache", "optimization", "tracking", "exports"],
  },
};
