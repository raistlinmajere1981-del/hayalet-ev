import { existsSync } from "node:fs";
import { copyFile, cp, mkdir, readdir, stat } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";

const PACKAGED_WORKSPACE_SEED_PATHS = [
  ".dependency-cruiser.cjs",
  ".gitignore",
  ".nvmrc",
  ".prettierignore",
  ".prettierrc",
  ".rovo",
  "AGENTS.md",
  "PACKAGING.md",
  "README.md",
  "config/backup-scopes.json",
  "data/protocols.json",
  "dist",
  "electron",
  "electron-builder.yml",
  "eslint.config.cjs",
  "ghost-agent",
  "knip.config.ts",
  "metadata.json",
  "package.json",
  "rooms",
  "scripts",
  "shared",
  "src",
  "tsconfig.electron.json",
  "tsconfig.json",
  "tsconfig.mcp.json",
  "tsconfig.rooms.json",
  "vite.config.js",
] as const;

const PACKAGED_RUNTIME_ROOT_DIRS = ["commands", "config", "data", "logs", "rooms"] as const;

function resolvePackagedMirrorRoot(): string | null {
  const resourcesPath =
    typeof process.resourcesPath === "string" ? process.resourcesPath.trim() : "";
  if (resourcesPath === "") {
    return null;
  }

  return dirname(resourcesPath);
}

async function copyMissingEntry(sourcePath: string, targetPath: string): Promise<number> {
  if (existsSync(sourcePath) !== true) {
    return 0;
  }

  const sourceStat = await stat(sourcePath);
  const targetStat = await stat(targetPath).catch(() => null);
  if (targetStat === null) {
    await mkdir(dirname(targetPath), { recursive: true });
    if (sourceStat.isDirectory()) {
      await cp(sourcePath, targetPath, {
        force: false,
        recursive: true,
      });
    } else {
      await copyFile(sourcePath, targetPath);
    }

    return 1;
  }

  if (!sourceStat.isDirectory() || !targetStat.isDirectory()) {
    return 0;
  }

  const entries = await readdir(sourcePath);
  let copiedEntries = 0;
  for (const entry of entries) {
    copiedEntries += await copyMissingEntry(join(sourcePath, entry), join(targetPath, entry));
  }

  return copiedEntries;
}

export async function seedPackagedProjectRoot(targetRoot: string): Promise<{
  copiedEntries: number;
  seeded: boolean;
  skipped: boolean;
}> {
  const mirrorRoot = resolvePackagedMirrorRoot();
  await Promise.all(
    PACKAGED_RUNTIME_ROOT_DIRS.map(async (relativePath) => {
      await mkdir(join(targetRoot, relativePath), { recursive: true });
    })
  );

  if (mirrorRoot === null || resolve(mirrorRoot) === resolve(targetRoot)) {
    return {
      copiedEntries: 0,
      seeded: false,
      skipped: true,
    };
  }

  let copiedEntries = 0;
  for (const relativePath of PACKAGED_WORKSPACE_SEED_PATHS) {
    copiedEntries += await copyMissingEntry(
      join(mirrorRoot, relativePath),
      join(targetRoot, relativePath)
    );
  }

  return {
    copiedEntries,
    seeded: copiedEntries > 0,
    skipped: false,
  };
}
