import { createReadStream, createWriteStream } from "node:fs";
import { mkdir, mkdtemp, readdir } from "node:fs/promises";
import { tmpdir } from "node:os";
import { basename, dirname, join, resolve, sep } from "node:path";
import { pipeline } from "node:stream/promises";
import { Readable } from "node:stream";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const tar = require("tar");
const unbzip2Stream = require("unbzip2-stream");
const yauzl = require("yauzl");

import { fileExists } from "./android-companion-platform-utils.mjs";
import { USER_AGENT } from "./android-companion-command-runner.mjs";

function escapeZipPatternToken(token) {
  return token.replace(/[|\\{}()[\]^$+?.]/g, "\\$&");
}

function normalizeZipPath(value) {
  return String(value).replace(/\\/g, "/");
}

function createZipPatternMatcher(patterns) {
  if (!Array.isArray(patterns) || patterns.length === 0) {
    return () => true;
  }

  const expressions = patterns.map((pattern) => {
    const normalized = normalizeZipPath(pattern);
    const source = normalized
      .split("*")
      .map((token) => escapeZipPatternToken(token))
      .join("[^/]*");
    return new RegExp(`^${source}$`);
  });

  return (entryName) => expressions.some((expression) => expression.test(entryName));
}

function resolveZipEntryDestination(destinationRoot, entryName, options = {}) {
  const normalizedName = normalizeZipPath(entryName);
  const relativeName = options.junkPaths === true ? basename(normalizedName) : normalizedName;
  if (relativeName === "" || relativeName.includes("\0")) {
    return null;
  }

  const resolvedRoot = resolve(destinationRoot);
  const resolvedPath = resolve(resolvedRoot, relativeName);
  const rootPrefix = resolvedRoot.endsWith(sep) ? resolvedRoot : `${resolvedRoot}${sep}`;
  if (resolvedPath !== resolvedRoot && !resolvedPath.startsWith(rootPrefix)) {
    throw new Error(`Zip entry escapes destination: ${entryName}`);
  }

  return resolvedPath;
}

export async function extractZipArchive(archivePath, destinationRoot, options = {}) {
  const shouldExtract = createZipPatternMatcher(options.entries);
  await mkdir(destinationRoot, { recursive: true });

  let extractedCount = 0;
  await new Promise((resolvePromise, rejectPromise) => {
    yauzl.open(archivePath, { lazyEntries: true, autoClose: true }, (openError, zipFile) => {
      if (openError || !zipFile) {
        rejectPromise(openError ?? new Error("Zip archive could not be opened."));
        return;
      }

      let settled = false;
      const rejectOnce = (error) => {
        if (settled) {
          return;
        }
        settled = true;
        zipFile.close();
        rejectPromise(error);
      };

      zipFile.on("error", rejectOnce);
      zipFile.on("end", () => {
        if (settled) {
          return;
        }
        settled = true;
        if (Array.isArray(options.entries) && options.entries.length > 0 && extractedCount === 0) {
          rejectPromise(new Error(`No matching zip entries found in ${archivePath}.`));
          return;
        }
        resolvePromise();
      });

      zipFile.on("entry", (entry) => {
        void (async () => {
          const entryName = normalizeZipPath(entry.fileName);
          const isDirectory = entryName.endsWith("/");
          if (!shouldExtract(entryName)) {
            zipFile.readEntry();
            return;
          }

          const destinationPath = resolveZipEntryDestination(destinationRoot, entryName, options);
          if (destinationPath === null) {
            zipFile.readEntry();
            return;
          }

          if (isDirectory) {
            if (options.junkPaths !== true) {
              await mkdir(destinationPath, { recursive: true });
            }
            zipFile.readEntry();
            return;
          }

          await mkdir(dirname(destinationPath), { recursive: true });
          const readStream = await new Promise((resolveStream, rejectStream) => {
            zipFile.openReadStream(entry, (streamError, stream) => {
              if (streamError || !stream) {
                rejectStream(streamError ?? new Error(`Zip entry could not be read: ${entryName}`));
                return;
              }
              resolveStream(stream);
            });
          });
          await pipeline(readStream, createWriteStream(destinationPath));
          extractedCount += 1;
          zipFile.readEntry();
        })().catch(rejectOnce);
      });

      zipFile.readEntry();
    });
  });

  return extractedCount;
}

export async function extractTarBzipArchive(archivePath, destinationRoot) {
  await mkdir(destinationRoot, { recursive: true });
  await pipeline(createReadStream(archivePath), unbzip2Stream(), tar.x({ cwd: destinationRoot }));
}

export async function downloadFile(url, destinationPath) {
  const response = await fetch(url, {
    headers: {
      "user-agent": USER_AGENT,
    },
    redirect: "follow",
  });
  if (!response.ok || response.body == null) {
    throw new Error(`Download failed: ${response.status} ${response.statusText}`);
  }

  await mkdir(dirname(destinationPath), { recursive: true });
  const bodyStream = Readable.fromWeb(response.body);
  await pipeline(bodyStream, createWriteStream(destinationPath));
  return destinationPath;
}

export async function findDirectoryContaining(rootPath, relativeSegments, maxDepth = 4) {
  const queue = [{ dir: rootPath, depth: 0 }];

  while (queue.length > 0) {
    const entry = queue.shift();
    if (!entry) {
      continue;
    }

    const candidate = join(entry.dir, ...relativeSegments);
    if (await fileExists(candidate)) {
      return entry.dir;
    }

    if (entry.depth >= maxDepth) {
      continue;
    }

    const children = await readdir(entry.dir, { withFileTypes: true }).catch(() => []);
    for (const child of children) {
      if (child.isDirectory()) {
        queue.push({ dir: join(entry.dir, child.name), depth: entry.depth + 1 });
      }
    }
  }

  return null;
}

export function normalizeProgressEmitter(emitProgress) {
  return typeof emitProgress === "function" ? emitProgress : () => {};
}
