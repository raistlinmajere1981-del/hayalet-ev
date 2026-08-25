import { existsSync } from "fs";
import { copyFile, mkdir, readFile, rename, rm, stat, writeFile } from "fs/promises";
import { basename, extname, isAbsolute, join, relative, resolve, sep } from "path";
import { randomUUID } from "crypto";
import { shell } from "electron";
import { Paths } from "./paths.ts";

export type PatternRoomArchiveFileKind =
  "document" | "image" | "video" | "audio" | "data" | "archive" | "other";

export type PatternRoomArchivedFile = {
  id: string;
  caseLabel: string;
  sourceId: string;
  label: string;
  origin: string;
  note: string;
  originalFileName: string;
  storedFileName: string;
  relativePath: string;
  extension: string;
  kind: PatternRoomArchiveFileKind;
  sizeBytes: number;
  addedAt: string;
};

export type PatternRoomArchiveFileInput = {
  sourcePath?: unknown;
  caseLabel?: unknown;
  sourceId?: unknown;
  label?: unknown;
  origin?: unknown;
  note?: unknown;
};

export type PatternRoomArchiveResult = {
  success: boolean;
  message?: string;
  file?: PatternRoomArchivedFile;
  files?: PatternRoomArchivedFile[];
};

type PatternRoomArchiveIndex = {
  version: 1;
  files: PatternRoomArchivedFile[];
};

const ARCHIVE_INDEX_VERSION = 1 as const;
const ROOM_ID = "pattern-room";
const ARCHIVE_DIR_NAME = "archive";
const ARCHIVE_FILES_DIR_NAME = "files";
const ARCHIVE_INDEX_FILE_NAME = "index.json";

const DOCUMENT_EXTENSIONS = new Set([
  ".pdf",
  ".doc",
  ".docx",
  ".odt",
  ".rtf",
  ".txt",
  ".md",
  ".markdown",
  ".html",
  ".htm",
  ".epub",
]);
const IMAGE_EXTENSIONS = new Set([
  ".jpg",
  ".jpeg",
  ".png",
  ".webp",
  ".gif",
  ".bmp",
  ".tif",
  ".tiff",
  ".svg",
  ".heic",
]);
const VIDEO_EXTENSIONS = new Set([
  ".mp4",
  ".mkv",
  ".webm",
  ".mov",
  ".avi",
  ".m4v",
  ".mpeg",
  ".mpg",
]);
const AUDIO_EXTENSIONS = new Set([".mp3", ".wav", ".flac", ".ogg", ".m4a", ".aac", ".opus"]);
const DATA_EXTENSIONS = new Set([
  ".json",
  ".jsonl",
  ".csv",
  ".tsv",
  ".xml",
  ".yaml",
  ".yml",
  ".sql",
  ".log",
]);
const ARCHIVE_EXTENSIONS = new Set([".zip", ".7z", ".rar", ".tar", ".gz", ".bz2", ".xz"]);

function getArchiveRoot(): string {
  return join(Paths.getRoomStorageDir(ROOM_ID), ARCHIVE_DIR_NAME);
}

function getArchiveFilesRoot(): string {
  return join(getArchiveRoot(), ARCHIVE_FILES_DIR_NAME);
}

function getArchiveIndexPath(): string {
  return join(getArchiveRoot(), ARCHIVE_INDEX_FILE_NAME);
}

function readRequiredString(value: unknown, fieldName: string): string {
  if (typeof value !== "string" || value.trim() === "") {
    throw new Error(`${fieldName} boş olamaz.`);
  }
  return value.trim();
}

function readOptionalString(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function sanitizeDirectoryName(value: string): string {
  const normalized = value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/ı/g, "i")
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return normalized === "" ? "case" : normalized.slice(0, 80);
}

function classifyFile(extension: string): PatternRoomArchiveFileKind {
  if (DOCUMENT_EXTENSIONS.has(extension)) return "document";
  if (IMAGE_EXTENSIONS.has(extension)) return "image";
  if (VIDEO_EXTENSIONS.has(extension)) return "video";
  if (AUDIO_EXTENSIONS.has(extension)) return "audio";
  if (DATA_EXTENSIONS.has(extension)) return "data";
  if (ARCHIVE_EXTENSIONS.has(extension)) return "archive";
  return "other";
}

function isArchivedFile(value: unknown): value is PatternRoomArchivedFile {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return false;
  }
  const record = value as Record<string, unknown>;
  return (
    typeof record["id"] === "string" &&
    typeof record["caseLabel"] === "string" &&
    typeof record["sourceId"] === "string" &&
    typeof record["label"] === "string" &&
    typeof record["origin"] === "string" &&
    typeof record["note"] === "string" &&
    typeof record["originalFileName"] === "string" &&
    typeof record["storedFileName"] === "string" &&
    typeof record["relativePath"] === "string" &&
    typeof record["extension"] === "string" &&
    (record["kind"] === "document" ||
      record["kind"] === "image" ||
      record["kind"] === "video" ||
      record["kind"] === "audio" ||
      record["kind"] === "data" ||
      record["kind"] === "archive" ||
      record["kind"] === "other") &&
    typeof record["sizeBytes"] === "number" &&
    Number.isFinite(record["sizeBytes"]) &&
    typeof record["addedAt"] === "string"
  );
}

async function readArchiveIndex(): Promise<PatternRoomArchiveIndex> {
  const indexPath = getArchiveIndexPath();
  if (!existsSync(indexPath)) {
    return { version: ARCHIVE_INDEX_VERSION, files: [] };
  }

  try {
    const parsed = JSON.parse(await readFile(indexPath, "utf8")) as unknown;
    if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
      return { version: ARCHIVE_INDEX_VERSION, files: [] };
    }
    const record = parsed as Record<string, unknown>;
    const files = Array.isArray(record["files"])
      ? record["files"].filter(isArchivedFile).map((file) => ({ ...file }))
      : [];
    return { version: ARCHIVE_INDEX_VERSION, files };
  } catch {
    return { version: ARCHIVE_INDEX_VERSION, files: [] };
  }
}

async function writeArchiveIndex(index: PatternRoomArchiveIndex): Promise<void> {
  const archiveRoot = getArchiveRoot();
  await mkdir(archiveRoot, { recursive: true });
  const indexPath = getArchiveIndexPath();
  const tempPath = `${indexPath}.${Date.now()}.tmp`;
  await writeFile(tempPath, `${JSON.stringify(index, null, 2)}\n`, "utf8");
  await rename(tempPath, indexPath);
}

function toArchiveRelativePath(fullPath: string): string {
  return relative(getArchiveRoot(), fullPath).split(sep).join("/");
}

function resolveArchivedFilePath(file: PatternRoomArchivedFile): string {
  const archiveRoot = resolve(getArchiveRoot());
  const fullPath = resolve(archiveRoot, file.relativePath);
  const relativePath = relative(archiveRoot, fullPath);
  if (relativePath.startsWith("..") || isAbsolute(relativePath)) {
    throw new Error("Arşiv dosya yolu geçersiz.");
  }
  return fullPath;
}

function uniqueTargetPath(directory: string, originalFileName: string): string {
  const baseName = basename(originalFileName);
  const safeName = baseName === "" ? "file" : baseName;
  const extension = extname(safeName);
  const stemCandidate = safeName.slice(0, safeName.length - extension.length);
  const stem = stemCandidate === "" ? "file" : stemCandidate;
  let candidate = safeName;
  let counter = 1;

  while (existsSync(join(directory, candidate))) {
    candidate = `${stem} (${String(counter)})${extension}`;
    counter += 1;
  }
  return join(directory, candidate);
}

async function findArchivedFile(fileId: string): Promise<PatternRoomArchivedFile | null> {
  const normalizedId = fileId.trim();
  if (normalizedId === "") {
    return null;
  }
  const index = await readArchiveIndex();
  return index.files.find((file) => file.id === normalizedId) ?? null;
}

export async function archivePatternRoomFile(
  input: PatternRoomArchiveFileInput
): Promise<PatternRoomArchiveResult> {
  const sourcePath = readRequiredString(input.sourcePath, "Dosya yolu");
  const caseLabel = readRequiredString(input.caseLabel, "Vaka adı");
  const sourceId = readRequiredString(input.sourceId, "Kaynak kimliği");
  const label = readRequiredString(input.label, "Kaynak başlığı");
  const origin = readRequiredString(input.origin, "Kaynak kökeni");
  const note = readOptionalString(input.note);

  if (!existsSync(sourcePath)) {
    throw new Error("Seçilen dosya artık mevcut değil.");
  }
  const sourceStats = await stat(sourcePath);
  if (!sourceStats.isFile()) {
    throw new Error("Yalnızca dosyalar arşivlenebilir.");
  }

  const caseDirectory = join(getArchiveFilesRoot(), sanitizeDirectoryName(caseLabel));
  await mkdir(caseDirectory, { recursive: true });
  const originalFileName = basename(sourcePath);
  const targetPath = uniqueTargetPath(caseDirectory, originalFileName);

  await copyFile(sourcePath, targetPath);
  try {
    const targetStats = await stat(targetPath);
    const storedFileName = basename(targetPath);
    const extension = extname(storedFileName).toLowerCase();
    const file: PatternRoomArchivedFile = {
      id: `pattern-file-${randomUUID()}`,
      caseLabel,
      sourceId,
      label,
      origin,
      note,
      originalFileName,
      storedFileName,
      relativePath: toArchiveRelativePath(targetPath),
      extension,
      kind: classifyFile(extension),
      sizeBytes: targetStats.size,
      addedAt: new Date().toISOString(),
    };
    const index = await readArchiveIndex();
    index.files.push(file);
    await writeArchiveIndex(index);
    return { success: true, file };
  } catch (error) {
    await rm(targetPath, { force: true }).catch(() => undefined);
    throw error;
  }
}

export async function listPatternRoomArchiveFiles(): Promise<PatternRoomArchiveResult> {
  const index = await readArchiveIndex();
  return {
    success: true,
    files: index.files
      .map((file) => ({ ...file }))
      .sort((left, right) => right.addedAt.localeCompare(left.addedAt)),
  };
}

export async function openPatternRoomArchiveFile(
  fileId: string
): Promise<PatternRoomArchiveResult> {
  const file = await findArchivedFile(fileId);
  if (file === null) {
    return { success: false, message: "Arşiv kaydı bulunamadı." };
  }
  const fullPath = resolveArchivedFilePath(file);
  if (!existsSync(fullPath)) {
    return { success: false, message: "Arşiv dosyası diskte bulunamadı." };
  }
  const errorMessage = await shell.openPath(fullPath);
  return errorMessage === ""
    ? { success: true, file }
    : { success: false, message: errorMessage, file };
}

export async function revealPatternRoomArchiveFile(
  fileId: string
): Promise<PatternRoomArchiveResult> {
  const file = await findArchivedFile(fileId);
  if (file === null) {
    return { success: false, message: "Arşiv kaydı bulunamadı." };
  }
  const fullPath = resolveArchivedFilePath(file);
  if (!existsSync(fullPath)) {
    return { success: false, message: "Arşiv dosyası diskte bulunamadı." };
  }
  shell.showItemInFolder(fullPath);
  return { success: true, file };
}
