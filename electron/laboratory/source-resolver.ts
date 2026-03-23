import { spawn } from "child_process";
import { createWriteStream, constants as fsConstants } from "fs";
import { access, copyFile, readdir, stat } from "fs/promises";
import { randomUUID } from "crypto";
import { homedir } from "os";
import { basename, extname, isAbsolute, join } from "path";
import { Readable } from "stream";
import { pipeline } from "stream/promises";
import type { ReadableStream as NodeReadableStream } from "node:stream/web";
import type {
  LaboratoryProgressEvent,
  LaboratorySourceDescriptor,
  LaboratorySourceResolveInput,
  LaboratoryWorkflowSettings,
} from "@shared/index.js";
import {
  discardLaboratoryWorkspace,
  ensureLaboratoryWorkspaceDirs,
  getLaboratoryWorkspaceDir,
  persistLaboratoryResolvedSource,
} from "./history-store.ts";
import { ensureLaboratoryPreview, probeLaboratoryMedia } from "./media-preview.ts";

const BLOCKED_HOSTS = ["localhost", "127.0.0.1", "0.0.0.0", "[::1]"];
const YOUTUBE_HOSTS = [
  "youtube.com",
  "www.youtube.com",
  "m.youtube.com",
  "music.youtube.com",
  "youtu.be",
  "www.youtu.be",
  "youtube-nocookie.com",
  "www.youtube-nocookie.com",
];
const SOURCE_PREPARATION_CANCELLED = "LABORATORY_SOURCE_PREPARATION_CANCELLED";
const MIN_YT_DLP_VERSION = 20251112;
const MIN_YT_DLP_VERSION_LABEL = "2025.11.12";
const MIN_NODE_RUNTIME_MAJOR = 20;

interface ResolveProgressUpdate {
  phase: LaboratoryProgressEvent["phase"];
  percent: number;
  summary: string;
  detail: string;
}

interface ResolveSourceOptions {
  workspaceId?: string;
  signal?: AbortSignal;
  onProgress?: (update: ResolveProgressUpdate) => void;
}

interface ResolvedSourceFile {
  workingPath: string;
  label: string;
  sizeBytes: number;
  originalInput: string;
}

interface YtDlpMetadata {
  title?: string;
  webpage_url?: string;
  entries?: unknown[];
}

interface YtDlpBinary {
  command: string;
  version: string;
  versionNumber: number;
}

interface YtDlpEnvironment {
  command: string;
  version: string;
  baseArgs: string[];
}

function createSourcePreparationCancelledError(): Error {
  return new Error(SOURCE_PREPARATION_CANCELLED);
}

function isSourcePreparationCancelled(error: unknown): boolean {
  return error instanceof Error && error.message === SOURCE_PREPARATION_CANCELLED;
}

function ensureNotAborted(signal?: AbortSignal): void {
  if (signal?.aborted === true) {
    throw createSourcePreparationCancelledError();
  }
}

function reportProgress(options: ResolveSourceOptions, update: ResolveProgressUpdate): void {
  options.onProgress?.(update);
}

function normalizeWorkflowSettings(
  value: LaboratorySourceResolveInput["workflowSettings"]
): LaboratoryWorkflowSettings {
  const focus = value?.focus;

  return {
    downloadPreset:
      value?.downloadPreset === "best" || value?.downloadPreset === "fast"
        ? value.downloadPreset
        : "balanced",
    previewPolicy: value?.previewPolicy === "dense" ? "dense" : "smart",
    focus: {
      visual: typeof focus?.visual === "boolean" ? focus.visual : true,
      audio: typeof focus?.audio === "boolean" ? focus.audio : true,
      image: typeof focus?.image === "boolean" ? focus.image : true,
      motion: typeof focus?.motion === "boolean" ? focus.motion : true,
    },
  };
}

function buildYtDlpFormatArgs(workflowSettings: LaboratoryWorkflowSettings): string[] {
  if (workflowSettings.downloadPreset === "best") {
    return ["--format", "bestvideo*+bestaudio/best"];
  }
  if (workflowSettings.downloadPreset === "fast") {
    return ["--format", "best[height<=720][fps<=30]/best[height<=720]/best"];
  }
  return ["--format", "bestvideo*[height<=1080]+bestaudio/best[height<=1080]/best"];
}

function sanitizeFileName(fileName: string): string {
  const trimmed = fileName.trim();
  if (trimmed === "") {
    return "source.bin";
  }
  return trimmed.replace(/[^a-zA-Z0-9._-]+/g, "-");
}

function looksPrivateIpv4(hostname: string): boolean {
  const parts = hostname.split(".");
  if (parts.length !== 4) {
    return false;
  }

  const numbers = parts.map((part) => Number(part));
  if (numbers.some((value) => Number.isInteger(value) === false || value < 0 || value > 255)) {
    return false;
  }
  const first = numbers[0] ?? -1;
  const second = numbers[1] ?? -1;

  if (first === 10 || first === 127) {
    return true;
  }
  if (first === 192 && second === 168) {
    return true;
  }
  return first === 172 && second >= 16 && second <= 31;
}

function validateRemoteUrl(value: string): URL {
  let parsed: URL;
  try {
    parsed = new URL(value);
  } catch {
    throw new Error("Invalid source URL.");
  }

  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    throw new Error(`Unsupported source protocol: ${parsed.protocol}`);
  }

  const hostname = parsed.hostname.toLowerCase();
  if (
    BLOCKED_HOSTS.some((blocked) => hostname === blocked || hostname.endsWith(`.${blocked}`)) ||
    hostname.endsWith(".local") ||
    looksPrivateIpv4(hostname)
  ) {
    throw new Error("Local or private network addresses are blocked for direct URL analysis.");
  }

  return parsed;
}

function validateYouTubeUrl(value: string): URL {
  const parsed = validateRemoteUrl(value);
  const hostname = parsed.hostname.toLowerCase();
  if (YOUTUBE_HOSTS.includes(hostname) === false) {
    throw new Error("Only YouTube video URLs are supported for this source type.");
  }

  if (parsed.searchParams.has("list")) {
    throw new Error("Playlist URLs are not supported yet.");
  }

  if (hostname.endsWith("youtu.be")) {
    const videoId = parsed.pathname.replace(/^\/+/, "").trim();
    if (videoId === "") {
      throw new Error("A YouTube short link must include a video id.");
    }
    return parsed;
  }

  const pathName = parsed.pathname;
  const watchVideoId = parsed.searchParams.get("v")?.trim() ?? "";
  if (pathName === "/watch" && watchVideoId !== "") {
    return parsed;
  }
  if (
    pathName.startsWith("/shorts/") ||
    pathName.startsWith("/live/") ||
    pathName.startsWith("/embed/")
  ) {
    return parsed;
  }

  throw new Error("Unsupported YouTube URL format.");
}

function normalizeOptionalCommand(value: string | undefined): string | null {
  const trimmed = value?.trim() ?? "";
  return trimmed !== "" ? trimmed : null;
}

function isExplicitCommandPath(command: string): boolean {
  return command.includes("/") || command.includes("\\");
}

function parseDatedVersionNumber(value: string): number | null {
  const match = /^(\d{4})\.(\d{2})\.(\d{2})/.exec(value.trim());
  if (!match) {
    return null;
  }
  const [, yearRaw, monthRaw, dayRaw] = match;
  const year = Number(yearRaw);
  const month = Number(monthRaw);
  const day = Number(dayRaw);
  if (
    Number.isFinite(year) === false ||
    Number.isFinite(month) === false ||
    Number.isFinite(day) === false
  ) {
    return null;
  }
  return year * 10000 + month * 100 + day;
}

function parseNodeMajorVersion(value: string): number | null {
  const match = /^v?(\d+)/.exec(value.trim());
  if (!match) {
    return null;
  }
  const major = Number(match[1]);
  return Number.isFinite(major) ? major : null;
}

async function ensureCommandPathIsExecutable(command: string): Promise<boolean> {
  if (isExplicitCommandPath(command) === false) {
    return true;
  }
  try {
    await access(command, fsConstants.X_OK);
    return true;
  } catch {
    return false;
  }
}

async function runCommandForOutput(
  command: string,
  args: string[],
  signal?: AbortSignal
): Promise<{ code: number | null; stdout: string; stderr: string } | null> {
  ensureNotAborted(signal);
  if ((await ensureCommandPathIsExecutable(command)) === false) {
    return null;
  }

  return await new Promise((resolve) => {
    const child = spawn(command, args, {
      stdio: ["ignore", "pipe", "pipe"],
    });
    let stdout = "";
    let stderr = "";
    let settled = false;

    const finalize = (
      value: { code: number | null; stdout: string; stderr: string } | null
    ): void => {
      if (settled) {
        return;
      }
      settled = true;
      signal?.removeEventListener("abort", abort);
      resolve(value);
    };

    const abort = (): void => {
      try {
        child.kill("SIGKILL");
      } catch {
        // Ignore teardown failures during cancellation.
      }
    };

    signal?.addEventListener("abort", abort, { once: true });
    child.stdout.on("data", (chunk) => {
      stdout += String(chunk);
    });
    child.stderr.on("data", (chunk) => {
      stderr += String(chunk);
    });
    child.on("error", () => {
      finalize(null);
    });
    child.on("close", (code) => {
      if (signal?.aborted === true) {
        finalize(null);
        return;
      }
      finalize({ code, stdout, stderr });
    });
  });
}

function collectYtDlpCandidates(): string[] {
  const homeDir = homedir();
  const pipxBinDir = normalizeOptionalCommand(process.env["PIPX_BIN_DIR"]);
  const candidates = [
    normalizeOptionalCommand(process.env["LABORATORY_YT_DLP_BIN"]),
    normalizeOptionalCommand(process.env["YT_DLP_BIN"]),
    join(homeDir, ".local", "bin", "yt-dlp"),
    join(homeDir, ".local", "pipx", "venvs", "yt-dlp", "bin", "yt-dlp"),
    join(homeDir, ".local", "share", "pipx", "venvs", "yt-dlp", "bin", "yt-dlp"),
    pipxBinDir !== null ? join(pipxBinDir, "yt-dlp") : null,
    "yt-dlp",
  ].filter((value): value is string => typeof value === "string" && value.trim() !== "");

  return Array.from(new Set(candidates));
}

async function resolveYtDlpBinary(signal?: AbortSignal): Promise<YtDlpBinary> {
  const matches = (
    await Promise.all(
      collectYtDlpCandidates().map(async (command): Promise<YtDlpBinary | null> => {
        const result = await runCommandForOutput(command, ["--version"], signal);
        if (result?.code !== 0) {
          return null;
        }

        const version = result.stdout.trim();
        const versionNumber = parseDatedVersionNumber(version);
        if (version === "" || versionNumber === null) {
          return null;
        }

        return {
          command,
          version,
          versionNumber,
        };
      })
    )
  ).filter((match): match is YtDlpBinary => match !== null);

  matches.sort((left, right) => {
    if (right.versionNumber !== left.versionNumber) {
      return right.versionNumber - left.versionNumber;
    }
    return (
      Number(isExplicitCommandPath(right.command)) - Number(isExplicitCommandPath(left.command))
    );
  });

  const selected = matches[0];
  if (!selected) {
    throw new Error(
      "Laboratory could not find yt-dlp. Install yt-dlp[default] 2025.11.12+ or place a current binary on PATH."
    );
  }

  if (selected.versionNumber < MIN_YT_DLP_VERSION) {
    throw new Error(
      `Laboratory requires yt-dlp ${MIN_YT_DLP_VERSION_LABEL}+ for YouTube downloads. Found ${selected.version} at ${selected.command}. Install a newer yt-dlp[default] build and retry.`
    );
  }

  return selected;
}

function collectNodeRuntimeCandidates(): string[] {
  const homeDir = homedir();
  const candidates = [
    normalizeOptionalCommand(process.env["LABORATORY_YT_DLP_NODE_BIN"]),
    normalizeOptionalCommand(process.env["NODE_BINARY"]),
    normalizeOptionalCommand(process.env["npm_node_execpath"]),
    join(homeDir, ".local", "bin", "node"),
    "node",
  ].filter((value): value is string => typeof value === "string" && value.trim() !== "");

  return Array.from(new Set(candidates));
}

async function resolveNodeRuntimeArgument(signal?: AbortSignal): Promise<string | null> {
  const matches = (
    await Promise.all(
      collectNodeRuntimeCandidates().map(async (command) => {
        const result = await runCommandForOutput(command, ["--version"], signal);
        if (result?.code !== 0) {
          return null;
        }

        const major = parseNodeMajorVersion(result.stdout);
        if (major === null || major < MIN_NODE_RUNTIME_MAJOR) {
          return null;
        }

        return isExplicitCommandPath(command) ? `node:${command}` : "node";
      })
    )
  ).filter((match): match is string => match !== null);

  return matches[0] ?? null;
}

async function resolveYtDlpEnvironment(signal?: AbortSignal): Promise<YtDlpEnvironment> {
  const binary = await resolveYtDlpBinary(signal);
  const baseArgs = ["--ignore-config", "--remote-components", "ejs:github"];
  const nodeRuntime = await resolveNodeRuntimeArgument(signal);
  if (nodeRuntime !== null) {
    baseArgs.push("--js-runtimes", nodeRuntime);
  }

  return {
    command: binary.command,
    version: binary.version,
    baseArgs,
  };
}

function normalizeYtDlpErrorMessage(message: string, environment: YtDlpEnvironment): string {
  const trimmed = message.trim();
  if (
    trimmed.includes("unable to download video data: HTTP Error 403") ||
    trimmed.includes("Precondition check failed")
  ) {
    return `yt-dlp ${environment.version} could not retrieve this YouTube stream. Install or expose a current yt-dlp[default] build with JS runtime support, then retry. Raw error: ${trimmed}`;
  }
  return trimmed;
}

function guessFileNameFromContentType(contentType: string | null): string {
  const normalized = (contentType ?? "").toLowerCase();
  if (normalized.includes("mp4")) {
    return "remote-video.mp4";
  }
  if (normalized.includes("webm")) {
    return "remote-video.webm";
  }
  if (normalized.includes("quicktime")) {
    return "remote-video.mov";
  }
  if (normalized.includes("mpeg")) {
    return "remote-video.mpeg";
  }
  return "remote-video.bin";
}

function normalizePositiveNumber(value: string | undefined): number | null {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

function formatBytes(bytes: number | null): string {
  if (bytes === null || Number.isFinite(bytes) === false || bytes <= 0) {
    return "unknown size";
  }

  const units = ["B", "KB", "MB", "GB", "TB"];
  let value = bytes;
  let unitIndex = 0;
  while (value >= 1024 && unitIndex < units.length - 1) {
    value /= 1024;
    unitIndex += 1;
  }
  const unit = units[unitIndex] ?? "B";
  return `${value >= 10 || unitIndex === 0 ? value.toFixed(0) : value.toFixed(1)} ${unit}`;
}

function createWorkspaceId(): string {
  return `lab-${Date.now()}-${randomUUID().slice(0, 8)}`;
}

async function resolveLocalFileSource(
  filePath: string,
  sourceDir: string,
  options: ResolveSourceOptions
): Promise<ResolvedSourceFile> {
  ensureNotAborted(options.signal);
  reportProgress(options, {
    phase: "source-copy",
    percent: 24,
    summary: "Copying local file.",
    detail: "The selected media is being copied into the Laboratory workspace.",
  });
  const fileStats = await stat(filePath);
  const fileName = sanitizeFileName(basename(filePath));
  const workingPath = join(sourceDir, fileName);
  await copyFile(filePath, workingPath);
  ensureNotAborted(options.signal);
  return {
    workingPath,
    label: fileName,
    sizeBytes: fileStats.size,
    originalInput: filePath,
  };
}

async function resolveDirectUrlSource(
  rawUrl: string,
  sourceDir: string,
  options: ResolveSourceOptions
): Promise<ResolvedSourceFile> {
  reportProgress(options, {
    phase: "source-resolve",
    percent: 10,
    summary: "Validating direct media URL.",
    detail: "Checking protocol and network safety constraints before downloading the media.",
  });
  const parsedUrl = validateRemoteUrl(rawUrl);
  ensureNotAborted(options.signal);
  const response = await fetch(parsedUrl, {
    redirect: "follow",
    headers: {
      Accept: "video/*,*/*;q=0.8",
    },
    ...(options.signal ? { signal: options.signal } : {}),
  });

  if (response.ok !== true || response.body === null) {
    throw new Error(`Failed to download source URL (${String(response.status)}).`);
  }

  const candidateName = basename(parsedUrl.pathname);
  const fileName = sanitizeFileName(
    candidateName !== "" && extname(candidateName) !== ""
      ? candidateName
      : guessFileNameFromContentType(response.headers.get("content-type"))
  );
  const workingPath = join(sourceDir, fileName);
  reportProgress(options, {
    phase: "source-copy",
    percent: 30,
    summary: "Downloading direct media URL.",
    detail: "Streaming the remote media into the Laboratory workspace.",
  });
  const bodyStream = Readable.fromWeb(response.body as unknown as NodeReadableStream<Uint8Array>);
  if (options.signal) {
    await pipeline(bodyStream, createWriteStream(workingPath), {
      signal: options.signal,
    });
  } else {
    await pipeline(bodyStream, createWriteStream(workingPath));
  }
  ensureNotAborted(options.signal);
  const fileStats = await stat(workingPath);
  return {
    workingPath,
    label: fileName,
    sizeBytes: fileStats.size,
    originalInput: rawUrl,
  };
}

async function runYtDlpMetadata(
  url: string,
  environment: YtDlpEnvironment,
  signal?: AbortSignal
): Promise<YtDlpMetadata> {
  ensureNotAborted(signal);
  return await new Promise((resolve, reject) => {
    const child = spawn(
      environment.command,
      [...environment.baseArgs, "--no-playlist", "--dump-single-json", url],
      {
        stdio: ["ignore", "pipe", "pipe"],
      }
    );
    let stdout = "";
    let stderr = "";

    const abort = (): void => {
      try {
        child.kill("SIGKILL");
      } catch {
        // Ignore teardown failures during cancellation.
      }
    };

    signal?.addEventListener("abort", abort, { once: true });
    child.stdout.on("data", (chunk) => {
      stdout += String(chunk);
    });
    child.stderr.on("data", (chunk) => {
      stderr += String(chunk);
    });
    child.on("error", (error) => {
      signal?.removeEventListener("abort", abort);
      reject(error);
    });
    child.on("close", (code) => {
      signal?.removeEventListener("abort", abort);
      if (signal?.aborted === true) {
        reject(createSourcePreparationCancelledError());
        return;
      }
      if (code !== 0) {
        const trimmedStderr = stderr.trim();
        reject(
          new Error(
            trimmedStderr !== ""
              ? normalizeYtDlpErrorMessage(trimmedStderr, environment)
              : `yt-dlp metadata probe exited with code ${String(code)}.`
          )
        );
        return;
      }
      try {
        resolve(JSON.parse(stdout) as YtDlpMetadata);
      } catch {
        reject(new Error("yt-dlp returned invalid metadata for this YouTube URL."));
      }
    });
  });
}

async function resolveDownloadedFilePath(
  sourceDir: string,
  hintedPath: string | null
): Promise<string> {
  if (typeof hintedPath === "string" && hintedPath.trim() !== "") {
    const candidatePath = isAbsolute(hintedPath) ? hintedPath : join(sourceDir, hintedPath);
    await stat(candidatePath);
    return candidatePath;
  }

  const entries = await readdir(sourceDir, { withFileTypes: true });
  const fileEntry = entries.find((entry) => entry.isFile());
  if (!fileEntry) {
    throw new Error("yt-dlp completed without producing a downloadable media file.");
  }

  return join(sourceDir, fileEntry.name);
}

async function resolveYouTubeSource(
  rawUrl: string,
  sourceDir: string,
  options: ResolveSourceOptions,
  workflowSettings: LaboratoryWorkflowSettings
): Promise<ResolvedSourceFile> {
  reportProgress(options, {
    phase: "source-resolve",
    percent: 8,
    summary: "Validating YouTube URL.",
    detail: "Checking that the URL points to a single supported YouTube video.",
  });
  const parsedUrl = validateYouTubeUrl(rawUrl);
  const ytDlp = await resolveYtDlpEnvironment(options.signal);
  const metadata = await runYtDlpMetadata(parsedUrl.toString(), ytDlp, options.signal);
  if (Array.isArray(metadata.entries) && metadata.entries.length > 0) {
    throw new Error("Playlist URLs are not supported yet.");
  }

  ensureNotAborted(options.signal);
  reportProgress(options, {
    phase: "source-copy",
    percent: 18,
    summary: "Downloading YouTube source.",
    detail: "yt-dlp is downloading the selected video into the Laboratory workspace.",
  });

  const outputTemplate = "%(id)s.%(ext)s";
  const progressPrefix = "__LAB_DL__";
  const finalPathPrefix = "filepath:";
  const title =
    typeof metadata.title === "string" && metadata.title.trim() !== ""
      ? metadata.title.trim()
      : null;
  const canonicalUrl =
    typeof metadata.webpage_url === "string" && metadata.webpage_url.trim() !== ""
      ? metadata.webpage_url.trim()
      : parsedUrl.toString();

  return await new Promise((resolve, reject) => {
    const child = spawn(
      ytDlp.command,
      [
        ...ytDlp.baseArgs,
        "--no-playlist",
        "--no-simulate",
        "--no-part",
        "--newline",
        "--progress",
        "--restrict-filenames",
        "-P",
        sourceDir,
        "-o",
        outputTemplate,
        ...buildYtDlpFormatArgs(workflowSettings),
        "--print",
        `after_move:${finalPathPrefix}%(filepath)s`,
        "--progress-template",
        `download:${progressPrefix}%(progress.downloaded_bytes)s|%(progress.total_bytes)s|%(progress.total_bytes_estimate)s|%(progress.eta)s|%(progress.speed)s`,
        canonicalUrl,
      ],
      { stdio: ["ignore", "pipe", "pipe"] }
    );
    let stdoutBuffer = "";
    let stderrBuffer = "";
    let finalPath: string | null = null;
    let lastErrorLine = "";

    const abort = (): void => {
      try {
        child.kill("SIGKILL");
      } catch {
        // Ignore teardown failures during cancellation.
      }
    };

    const flushStdoutLines = (): void => {
      const lines = stdoutBuffer.split(/\r?\n/);
      stdoutBuffer = lines.pop() ?? "";
      for (const line of lines) {
        const trimmed = line.trim();
        if (trimmed.startsWith(finalPathPrefix)) {
          finalPath = trimmed.slice(finalPathPrefix.length).trim();
        }
      }
    };

    const flushStderrLines = (): void => {
      const lines = stderrBuffer.split(/\r?\n/);
      stderrBuffer = lines.pop() ?? "";
      for (const line of lines) {
        const trimmed = line.trim();
        if (trimmed === "") {
          continue;
        }
        if (trimmed.startsWith(progressPrefix)) {
          const [downloadedRaw, totalRaw, estimateRaw, etaRaw] = trimmed
            .slice(progressPrefix.length)
            .split("|");
          const downloadedBytes = normalizePositiveNumber(downloadedRaw);
          const totalBytes =
            normalizePositiveNumber(totalRaw) ?? normalizePositiveNumber(estimateRaw);
          const ratio =
            downloadedBytes !== null && totalBytes !== null
              ? Math.max(0, Math.min(1, downloadedBytes / totalBytes))
              : null;
          const eta = typeof etaRaw === "string" && etaRaw.trim() !== "" ? etaRaw.trim() : null;
          const detailParts = [
            downloadedBytes !== null ? formatBytes(downloadedBytes) : "download started",
            totalBytes !== null ? `of ${formatBytes(totalBytes)}` : null,
            eta !== null ? `ETA ${eta}s` : null,
          ].filter(Boolean);
          reportProgress(options, {
            phase: "source-copy",
            percent: ratio === null ? 24 : Math.round(18 + ratio * 64),
            summary: "Downloading YouTube source.",
            detail: detailParts.join(" · "),
          });
          continue;
        }
        lastErrorLine = trimmed;
      }
    };

    options.signal?.addEventListener("abort", abort, { once: true });
    child.stdout.on("data", (chunk) => {
      stdoutBuffer += String(chunk);
      flushStdoutLines();
    });
    child.stderr.on("data", (chunk) => {
      stderrBuffer += String(chunk);
      flushStderrLines();
    });
    child.on("error", (error) => {
      options.signal?.removeEventListener("abort", abort);
      reject(error);
    });
    child.on("close", (code) => {
      options.signal?.removeEventListener("abort", abort);
      flushStdoutLines();
      flushStderrLines();

      if (options.signal?.aborted === true) {
        reject(createSourcePreparationCancelledError());
        return;
      }

      if (code !== 0) {
        reject(
          new Error(
            lastErrorLine !== ""
              ? normalizeYtDlpErrorMessage(lastErrorLine, ytDlp)
              : `yt-dlp download exited with code ${String(code)}.`
          )
        );
        return;
      }

      void (async (): Promise<void> => {
        try {
          const workingPath = await resolveDownloadedFilePath(sourceDir, finalPath);
          const fileStats = await stat(workingPath);
          resolve({
            workingPath,
            label: title ?? basename(workingPath),
            sizeBytes: fileStats.size,
            originalInput: canonicalUrl,
          });
        } catch (error) {
          reject(error instanceof Error ? error : new Error(String(error)));
        }
      })();
    });
  });
}

export async function resolveLaboratorySource(
  input: LaboratorySourceResolveInput,
  options: ResolveSourceOptions = {}
): Promise<LaboratorySourceDescriptor> {
  const workspaceId = options.workspaceId ?? createWorkspaceId();
  const trimmedProjectId = input.projectId?.trim();
  const projectId =
    trimmedProjectId !== undefined && trimmedProjectId !== "" ? trimmedProjectId : workspaceId;
  const workflowSettings = normalizeWorkflowSettings(input.workflowSettings);
  const workspaceDir = getLaboratoryWorkspaceDir(workspaceId);
  const sourceDir = join(workspaceDir, "source");

  try {
    ensureNotAborted(options.signal);
    await ensureLaboratoryWorkspaceDirs(workspaceId);

    const source =
      input.kind === "local-file"
        ? await resolveLocalFileSource(input.filePath ?? "", sourceDir, options)
        : input.kind === "direct-url"
          ? await resolveDirectUrlSource(input.url ?? "", sourceDir, options)
          : await resolveYouTubeSource(input.url ?? "", sourceDir, options, workflowSettings);

    ensureNotAborted(options.signal);
    reportProgress(options, {
      phase: "probe",
      percent: 86,
      summary: "Probing media.",
      detail: "Inspecting codecs, timing, and frame dimensions before preview generation.",
    });
    const probe = await probeLaboratoryMedia(source.workingPath);
    ensureNotAborted(options.signal);
    reportProgress(options, {
      phase: "preview-prep",
      percent: 94,
      summary: "Preparing preview media.",
      detail: "Building a browser-friendly preview when the downloaded media needs conversion.",
    });
    const previewPath = await ensureLaboratoryPreview(source.workingPath, workspaceDir, probe);
    const trimmedLabel = input.label?.trim();
    const descriptor: LaboratorySourceDescriptor = {
      projectId,
      workspaceId,
      workspaceDir,
      kind: input.kind,
      label: trimmedLabel !== undefined && trimmedLabel !== "" ? trimmedLabel : source.label,
      originalInput: source.originalInput,
      originalFileName: basename(source.workingPath),
      workingSourcePath: source.workingPath,
      previewPath,
      createdAt: new Date().toISOString(),
      sizeBytes: source.sizeBytes,
      probe,
      workflowSettings,
      cacheState: {
        sourcePresent: true,
        previewPresent: true,
        derivedMediaPresent: previewPath !== source.workingPath,
        cleanedAt: null,
      },
    };

    ensureNotAborted(options.signal);
    await persistLaboratoryResolvedSource(
      descriptor,
      input.reportLocale !== undefined
        ? {
            reportLocale: input.reportLocale,
          }
        : {}
    );
    return descriptor;
  } catch (error) {
    await discardLaboratoryWorkspace(workspaceId);
    if (isSourcePreparationCancelled(error)) {
      throw error;
    }
    throw error;
  }
}
