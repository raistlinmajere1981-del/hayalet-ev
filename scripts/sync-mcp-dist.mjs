#!/usr/bin/env node

import { cpSync, existsSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const scriptDir = dirname(fileURLToPath(import.meta.url));
const projectRoot = join(scriptDir, "..");
const distRoot = join(projectRoot, "dist", "mcp-server");

function syncDirectory(sourceDir, destinationDir) {
  if (!existsSync(sourceDir)) {
    throw new Error(`MCP build source not found: ${sourceDir}`);
  }

  mkdirSync(dirname(destinationDir), { recursive: true });
  cpSync(sourceDir, destinationDir, {
    force: true,
    recursive: true,
  });
}

const syncTargets = [
  {
    source: join(distRoot, "src", "mcp-server"),
    destination: join(distRoot, "mcp-server"),
  },
  {
    source: join(distRoot, "src", "types"),
    destination: join(distRoot, "types"),
  },
];

for (const target of syncTargets) {
  syncDirectory(target.source, target.destination);
  console.log(`✅ Synced ${target.source} -> ${target.destination}`);
}
