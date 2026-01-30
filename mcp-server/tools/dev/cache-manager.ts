/**
 * Development Tools - Cache Manager
 * 
 * Proje cache yönetimi (export/import haritası, dosya hash'leri)
 */

import { readFileSync, writeFileSync, existsSync } from "fs";
import { join } from "path";
import { createHash } from "crypto";
import { DEV_CONFIG } from "./shared/config.js";
import { getAllFiles } from "./shared/utils.js";

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

export async function updateCache(
  projectRoot: string,
  options: { force?: boolean; show?: boolean } = {}
): Promise<CacheResult> {
  const cachePath = join(projectRoot, ".rovo/cache.json");
  
  // Load existing cache
  let existingCache: CacheData | null = null;
  if (existsSync(cachePath) && !options.force) {
    try {
      existingCache = JSON.parse(readFileSync(cachePath, "utf-8"));
    } catch { /* ignore */ }
  }

  // Show mode
  if (options.show && existingCache) {
    return {
      updated: false,
      path: cachePath,
      stats: existingCache.stats,
      changedFiles: [],
    };
  }

  // Build new cache
  const newCache: CacheData = {
    version: "1.0.0",
    timestamp: new Date().toISOString(),
    files: {},
    stats: { totalFiles: 0, totalLines: 0, totalExports: 0 },
  };

  const changedFiles: string[] = [];
  const allFiles: string[] = [];
  
  for (const srcDir of DEV_CONFIG.srcDirs) {
    const files = await getAllFiles(srcDir, projectRoot);
    allFiles.push(...files);
  }

  for (const file of allFiles) {
    try {
      const content = readFileSync(join(projectRoot, file), "utf-8");
      const hash = createHash("md5").update(content).digest("hex").slice(0, 8);
      const lines = content.split("\n").length;
      const exports = [...content.matchAll(/export\s+(?:async\s+)?(?:function|const|class|interface|type)\s+(\w+)/g)]
        .map(m => m[1] || '');

      // Check if changed
      if (existingCache?.files[file]?.hash !== hash) {
        changedFiles.push(file);
      }

      newCache.stats.totalFiles++;
      newCache.stats.totalLines += lines;
      newCache.stats.totalExports += exports.length;
    } catch { /* ignore */ }
  }

  // Write cache
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
  description: "Proje cache'ini güncelle (export/import haritası, dosya hash'leri)",
  inputSchema: {
    type: "object" as const,
    properties: {
      force: {
        type: "boolean" as const,
        description: "Mevcut cache'i yoksay ve yeniden oluştur",
        default: false,
      },
      show: {
        type: "boolean" as const,
        description: "Mevcut cache'i göster (güncelleme yapma)",
        default: false,
      },
    },
  },
};
