import { existsSync } from "fs";
import { readFile, writeFile } from "fs/promises";
import { dirname, extname, join } from "path";
import { transform, type Format, type Loader } from "esbuild";
import { collectFilesRecursive, copyDirectoryContents, ensureDir } from "./room-install-files.ts";

const ROOM_TYPESCRIPT_SOURCE_EXTENSIONS = new Set([".ts", ".tsx", ".mts", ".cts"]);

function isTypeDeclarationPath(relativePath: string): boolean {
  return (
    relativePath.endsWith(".d.ts") ||
    relativePath.endsWith(".d.mts") ||
    relativePath.endsWith(".d.cts")
  );
}

export function isWorkspaceTypeScriptSourcePath(relativePath: string): boolean {
  return (
    isTypeDeclarationPath(relativePath) === false &&
    ROOM_TYPESCRIPT_SOURCE_EXTENSIONS.has(extname(relativePath))
  );
}

function resolveRuntimeSourceCandidatePaths(relativePath: string): string[] {
  if (relativePath.endsWith(".js")) {
    const stem = relativePath.slice(0, -".js".length);
    return [`${stem}.ts`, `${stem}.tsx`];
  }

  if (relativePath.endsWith(".mjs")) {
    const stem = relativePath.slice(0, -".mjs".length);
    return [`${stem}.mts`];
  }

  if (relativePath.endsWith(".cjs")) {
    const stem = relativePath.slice(0, -".cjs".length);
    return [`${stem}.cts`];
  }

  return [];
}

export function roomSourceSatisfiesRuntimePath(roomDir: string, relativePath: string): boolean {
  if (existsSync(join(roomDir, relativePath))) {
    return true;
  }

  return resolveRuntimeSourceCandidatePaths(relativePath).some((candidatePath) =>
    existsSync(join(roomDir, candidatePath))
  );
}

function resolveCompiledOutputRelativePath(relativePath: string): string {
  if (relativePath.endsWith(".tsx")) {
    return `${relativePath.slice(0, -".tsx".length)}.js`;
  }

  if (relativePath.endsWith(".ts")) {
    return `${relativePath.slice(0, -".ts".length)}.js`;
  }

  if (relativePath.endsWith(".mts")) {
    return `${relativePath.slice(0, -".mts".length)}.mjs`;
  }

  if (relativePath.endsWith(".cts")) {
    return `${relativePath.slice(0, -".cts".length)}.cjs`;
  }

  return relativePath;
}

function resolveEsbuildLoader(relativePath: string): Loader {
  if (relativePath.endsWith(".tsx")) {
    return "tsx";
  }

  if (relativePath.endsWith(".mts")) {
    return "ts";
  }

  if (relativePath.endsWith(".cts")) {
    return "ts";
  }

  return "ts";
}

function resolveEsbuildFormat(relativePath: string): Format | undefined {
  if (relativePath.endsWith(".cts")) {
    return "cjs";
  }

  if (relativePath.endsWith(".mts")) {
    return "esm";
  }

  return undefined;
}

export async function buildWorkspaceRoomOutput(sourceDir: string, buildDir: string): Promise<void> {
  await copyDirectoryContents(sourceDir, buildDir, {
    includeRelativePath: (relativePath) =>
      isWorkspaceTypeScriptSourcePath(relativePath) === false &&
      isTypeDeclarationPath(relativePath) === false,
  });

  const sourceFiles = (await collectFilesRecursive(sourceDir)).filter((file) =>
    isWorkspaceTypeScriptSourcePath(file.relativePath)
  );

  await Promise.all(
    sourceFiles.map(async (file): Promise<void> => {
      const sourceCode = await readFile(file.absolutePath, "utf8");
      const format = resolveEsbuildFormat(file.relativePath);
      const transformed = await transform(sourceCode, {
        charset: "utf8",
        loader: resolveEsbuildLoader(file.relativePath),
        sourcefile: file.relativePath,
        target: "es2022",
        ...(format !== undefined ? { format } : {}),
      });

      const outputPath = join(buildDir, resolveCompiledOutputRelativePath(file.relativePath));
      await ensureDir(dirname(outputPath));
      await writeFile(outputPath, transformed.code, "utf8");
    })
  );
}
