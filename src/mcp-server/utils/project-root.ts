/**
 * Project Root Resolver
 *
 * Circular dependency sorunlarını önlemek için PROJECT_ROOT'u
 * ayrı bir dosyada tanımlıyoruz.
 *
 * Kaynak ve build klasör yapıları farklı olduğu için sabit klasör derinliğine
 * güvenmek kırılgan. Bunun yerine dosya konumundan yukarı yürüyüp repo
 * işaretçilerini buluyoruz.
 */

import { existsSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

function isProjectRoot(candidateDir: string): boolean {
  return (
    existsSync(join(candidateDir, "package.json")) && existsSync(join(candidateDir, "AGENTS.md"))
  );
}

export function resolveProjectRootFromFile(moduleFileName: string): string {
  let currentDir = dirname(moduleFileName);

  for (;;) {
    if (isProjectRoot(currentDir)) return currentDir;

    const parentDir = dirname(currentDir);
    if (parentDir === currentDir) break;
    currentDir = parentDir;
  }

  return resolve(dirname(moduleFileName), "..", "..", "..");
}

export const PROJECT_ROOT = resolveProjectRootFromFile(fileURLToPath(import.meta.url));
