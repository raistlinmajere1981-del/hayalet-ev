/**
 * Project Root Resolver
 *
 * PROJECT_ROOT lives in a dedicated file to avoid circular dependencies.
 *
 * Source and build directory layouts differ, so relying on a fixed folder
 * depth is brittle. Instead, walk upward from the current file and find
 * repository markers.
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
