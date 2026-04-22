import { once } from "events";
import { spawn } from "child_process";
import { createWriteStream, existsSync } from "fs";
import { chmod, mkdir, mkdtemp, readdir, readFile, rename, rm, writeFile } from "fs/promises";
import { dirname, join, relative, resolve } from "path";
import { tmpdir } from "os";
import type { IpcMainInvokeEvent } from "electron";
import { getLoggerCore } from "./logger/index.js";
import { Paths } from "./paths.ts";
import type {
  RoomFileDownloadResult,
  RoomToolCallRequest,
  RoomToolCallResult,
  RoomToolCancelRequest,
  RoomToolCancelResult,
  RoomToolProgressEvent,
  RoomToolRuntimePaths,
  RoomToolStatus,
  RoomToolUpdateCheck,
} from "../src/types/room-tools.ts";
import { LogCategory, LogLevel } from "@shared/index.js";
import { transcriptService } from "./transcript-service.ts";

const ROOM_TOOLS_PROGRESS_CHANNEL = "room-tools:progress";
const PYTHON_GET_PIP_URL = "https://bootstrap.pypa.io/get-pip.py";
const logger = getLoggerCore();

type PlatformKey =
  | "linux-x64"
  | "linux-arm64"
  | "linux-musl-x64"
  | "linux-musl-arm64"
  | "darwin-x64"
  | "darwin-arm64"
  | "win32-x64"
  | "win32-arm64";

type ToolchainManifest = {
  version: number;
  roomId: string;
  tools: Record<string, ToolManifest>;
};

type ToolAvailability = "installable" | "system-command" | "planned";

type SystemCommandSpec = {
  executableName: string;
  companionExecutables?: string[];
  envVarNames?: string[];
  candidatePaths?: string[];
  setupHint?: string;
};

type PythonVenvPipInstallerSpec = {
  type: "python-venv-pip";
  bootstrapExecutableNames?: string[];
  packages: string[];
  venvDir: string;
};

type ToolInstallerSpec = PythonVenvPipInstallerSpec;

type ToolManifest = {
  displayName: string;
  installDirName?: string;
  availability?: ToolAvailability;
  installer?: ToolInstallerSpec;
  plannedReason?: string;
  releaseProvider?: GitHubReleaseProvider;
  assets?: Partial<Record<PlatformKey, ToolAssetSpec>>;
  probe?: {
    args: string[];
    versionRegex: string;
  };
  systemCommand?: SystemCommandSpec;
};

type InstallableToolManifest = ToolManifest & {
  releaseProvider: GitHubReleaseProvider;
  assets: Partial<Record<PlatformKey, ToolAssetSpec>>;
  probe: {
    args: string[];
    versionRegex: string;
  };
};

type SystemCommandToolManifest = ToolManifest & {
  availability: "system-command";
  systemCommand: SystemCommandSpec;
  probe: {
    args: string[];
    versionRegex: string;
  };
};

type ResolvedPythonVenvPipInstaller = {
  manifest: ToolManifest;
  probe: NonNullable<ToolManifest["probe"]>;
  systemCommand: SystemCommandSpec;
  installer: {
    type: "python-venv-pip";
    bootstrapExecutableNames: string[];
    packages: string[];
    venvDir: string;
  };
};

type GitHubReleaseProvider = {
  type: "github-release";
  owner: string;
  repo: string;
  releaseUrl: string;
};

type ToolAssetSpec = {
  assetMatch: string;
  archive: "none" | "tar.xz" | "zip";
  executableName: string;
  companionExecutables?: string[];
};

type GitHubReleaseAsset = {
  name: string;
  browser_download_url: string;
};

type GitHubReleasePayload = {
  tag_name?: string;
  name?: string;
  html_url?: string;
  assets?: GitHubReleaseAsset[];
};

type ToolReleaseInfo = {
  tag: string | null;
  name: string | null;
  releaseUrl: string | null;
  asset: GitHubReleaseAsset;
};

type ActiveJob =
  | {
      roomId: string;
      jobId: string;
      cancel: () => void;
    }
  | undefined;

type SpawnedProcess = ReturnType<typeof spawn>;

function asNonEmptyString(value: unknown): string | null {
  return typeof value === "string" && value.trim() !== "" ? value.trim() : null;
}

function normalizeStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }
  return value
    .map(function (entry) {
      return asNonEmptyString(entry);
    })
    .filter((entry): entry is string => entry !== null);
}

function ensureAbsolutePath(filePath: string): string {
  return resolve(filePath);
}

function normalizeRequestId(value: unknown): string | null {
  return asNonEmptyString(value);
}

function normalizeRoomId(value: unknown): string {
  return asNonEmptyString(value) ?? "";
}

function normalizeJobId(value: unknown, fallbackPrefix: string): string {
  return (
    asNonEmptyString(value) ??
    `${fallbackPrefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
  );
}

function detectPlatformKey(): PlatformKey | null {
  const report = process.report.getReport() as
    | {
        header?: {
          glibcVersionRuntime?: string;
        };
      }
    | undefined;
  const glibcVersionRuntime = report?.header?.glibcVersionRuntime;
  const isMusl =
    process.platform === "linux" &&
    (glibcVersionRuntime === undefined || glibcVersionRuntime === "");

  if (process.platform === "linux" && process.arch === "x64") {
    return isMusl ? "linux-musl-x64" : "linux-x64";
  }
  if (process.platform === "linux" && process.arch === "arm64") {
    return isMusl ? "linux-musl-arm64" : "linux-arm64";
  }
  if (process.platform === "darwin" && process.arch === "x64") {
    return "darwin-x64";
  }
  if (process.platform === "darwin" && process.arch === "arm64") {
    return "darwin-arm64";
  }
  if (process.platform === "win32" && process.arch === "x64") {
    return "win32-x64";
  }
  if (process.platform === "win32" && process.arch === "arm64") {
    return "win32-arm64";
  }
  return null;
}

function resolveRuntimePaths(roomId: string): RoomToolRuntimePaths {
  const installedDir = Paths.getInstalledRoomDir(roomId);
  const storageDir = Paths.getRoomStorageDir(roomId);
  const platformKey = detectPlatformKey() ?? `${process.platform}-${process.arch}`;
  return {
    roomId,
    installedDir,
    storageDir,
    projectsDir: join(storageDir, "projects"),
    packageToolsDir: join(installedDir, "tools"),
    packageToolRuntimeDir: join(installedDir, "tools", "runtime", platformKey),
    toolRuntimeDir: join(storageDir, "tools", "runtime", platformKey),
    toolStatePath: join(storageDir, "tool-state.json"),
  };
}

function getInstalledSharedToolsDir(paths: RoomToolRuntimePaths): string {
  return join(paths.installedDir, "shared", "data", "tools");
}

function getToolchainManifestCandidates(paths: RoomToolRuntimePaths): string[] {
  return Array.from(
    new Set([
      join(paths.packageToolsDir, "toolchain.manifest.json"),
      join(getInstalledSharedToolsDir(paths), "toolchain.manifest.json"),
      join(
        paths.storageDir,
        "build",
        "workspace",
        "shared",
        "data",
        "tools",
        "toolchain.manifest.json"
      ),
      join(
        Paths.getRoomsWorkspaceDir(),
        paths.roomId,
        "shared",
        "data",
        "tools",
        "toolchain.manifest.json"
      ),
    ])
  );
}

function expandRuntimePathTemplate(
  template: string,
  runtimePaths: RoomToolRuntimePaths | null = null
): string {
  return template
    .replaceAll("${dataDir}", Paths.getDataDir())
    .replaceAll("${projectRoot}", Paths.getProjectRoot())
    .replaceAll("${installedDir}", runtimePaths?.installedDir ?? "")
    .replaceAll("${roomStorageDir}", runtimePaths?.storageDir ?? "")
    .replaceAll("${toolRuntimeDir}", runtimePaths?.toolRuntimeDir ?? "")
    .replaceAll("${packageToolsDir}", runtimePaths?.packageToolsDir ?? "");
}

function isPathInside(parentPath: string, childPath: string): boolean {
  const relativePath = relative(ensureAbsolutePath(parentPath), ensureAbsolutePath(childPath));
  return (
    relativePath === "" ||
    (!relativePath.startsWith("..") &&
      !relativePath.includes(`..${process.platform === "win32" ? "\\" : "/"}`))
  );
}

function ensureRoomManagedPath(roomId: string, targetPath: string): void {
  const paths = resolveRuntimePaths(roomId);
  const absolutePath = ensureAbsolutePath(targetPath);
  const allowedRoots = [
    paths.storageDir,
    paths.toolRuntimeDir,
    paths.packageToolsDir,
    getInstalledSharedToolsDir(paths),
  ];
  if (allowedRoots.some((root) => isPathInside(root, absolutePath))) {
    return;
  }
  throw new Error(`Path is outside the managed room roots: ${absolutePath}`);
}

function findVersion(output: string, pattern: string): string | null {
  const regex = new RegExp(pattern);
  const match = output.trim().match(regex);
  if (!match) {
    return null;
  }
  if (match[1] !== undefined) {
    return match[1];
  }
  return match[0];
}

function compareLooseVersion(left: string, right: string): number {
  const tokenize = (value: string): Array<string | number> =>
    value
      .split(/[^0-9A-Za-z]+/)
      .filter((part) => part !== "")
      .map((part) => (/^\d+$/.test(part) ? Number(part) : part));

  const leftParts = tokenize(left);
  const rightParts = tokenize(right);
  const maxLength = Math.max(leftParts.length, rightParts.length);

  for (let index = 0; index < maxLength; index += 1) {
    const leftPart = leftParts[index];
    const rightPart = rightParts[index];
    if (leftPart === undefined && rightPart === undefined) {
      return 0;
    }
    if (leftPart === undefined) {
      return -1;
    }
    if (rightPart === undefined) {
      return 1;
    }
    if (typeof leftPart === "number" && typeof rightPart === "number") {
      if (leftPart !== rightPart) {
        return leftPart > rightPart ? 1 : -1;
      }
      continue;
    }
    const next = String(leftPart).localeCompare(String(rightPart), undefined, {
      numeric: true,
      sensitivity: "base",
    });
    if (next !== 0) {
      return next;
    }
  }

  return 0;
}

async function resolveSystemCommandBinaryPath(
  executableName: string,
  options?: {
    candidatePaths?: string[] | undefined;
    envVarNames?: string[] | undefined;
    runtimePaths?: RoomToolRuntimePaths | null | undefined;
  }
): Promise<string | null> {
  const normalizedName = asNonEmptyString(executableName);
  if (normalizedName === null) {
    return null;
  }

  const envVarNames = Array.isArray(options?.envVarNames) ? options.envVarNames : [];
  for (const envVarName of envVarNames) {
    const envBinaryPath = asNonEmptyString(process.env[envVarName]);
    if (envBinaryPath !== null && existsSync(envBinaryPath)) {
      return envBinaryPath;
    }
  }

  const candidatePaths = Array.isArray(options?.candidatePaths) ? options.candidatePaths : [];
  for (const candidateTemplate of candidatePaths) {
    const expandedPath = expandRuntimePathTemplate(
      candidateTemplate,
      options?.runtimePaths ?? null
    );
    if (expandedPath !== "" && existsSync(expandedPath)) {
      return expandedPath;
    }
  }

  if (normalizedName.includes("/") || normalizedName.includes("\\")) {
    return existsSync(normalizedName) ? normalizedName : null;
  }

  const lookupCommand = process.platform === "win32" ? "where.exe" : "which";

  try {
    const result = await runCommand(lookupCommand, [normalizedName], undefined, undefined, 8_000);
    if (result.exitCode !== 0) {
      return null;
    }

    return (
      result.stdout
        .split(/\r?\n/u)
        .map((line) => line.trim())
        .find((line) => line !== "") ?? null
    );
  } catch {
    return null;
  }
}

async function readJsonFile<T>(filePath: string): Promise<T> {
  return JSON.parse(await readFile(filePath, "utf8")) as T;
}

async function ensureDir(dirPath: string): Promise<void> {
  await mkdir(dirPath, { recursive: true });
}

function getPythonVenvExecutableCandidates(venvDir: string): string[] {
  if (process.platform === "win32") {
    return [join(venvDir, "Scripts", "python.exe")];
  }

  return [join(venvDir, "bin", "python3"), join(venvDir, "bin", "python")];
}

function resolveExistingPythonVenvExecutable(venvDir: string): string | null {
  return (
    getPythonVenvExecutableCandidates(venvDir).find((candidate) => existsSync(candidate)) ?? null
  );
}

async function fetchJson(url: string): Promise<unknown> {
  const response = await fetch(url, {
    headers: {
      "User-Agent": "hayalet-ev-room-tools",
      Accept: "application/vnd.github+json, application/json",
    },
  });
  if (!response.ok) {
    throw new Error(`Request failed (${response.status}) for ${url}`);
  }
  return await response.json();
}

async function fetchText(url: string): Promise<string> {
  const response = await fetch(url, {
    headers: {
      "User-Agent": "hayalet-ev-room-tools",
      Accept: "text/plain, application/octet-stream;q=0.9, */*;q=0.1",
    },
  });
  if (!response.ok) {
    throw new Error(`Request failed (${response.status}) for ${url}`);
  }
  return await response.text();
}

async function fetchGitHubRelease(provider: GitHubReleaseProvider): Promise<GitHubReleasePayload> {
  const url = `https://api.github.com/repos/${provider.owner}/${provider.repo}/releases/latest`;
  return (await fetchJson(url)) as GitHubReleasePayload;
}

async function collectFilesRecursive(baseDir: string): Promise<string[]> {
  const entries = await readdir(baseDir, { withFileTypes: true });
  const results = await Promise.all(
    entries.map(async (entry): Promise<string[]> => {
      const absolutePath = join(baseDir, entry.name);
      if (entry.isDirectory()) {
        return await collectFilesRecursive(absolutePath);
      }
      return [absolutePath];
    })
  );
  return results.flat();
}

function resolveUniquePath(targetPath: string): string {
  if (!existsSync(targetPath)) {
    return targetPath;
  }

  const extIndex = targetPath.lastIndexOf(".");
  const hasExtension = extIndex > dirname(targetPath).length;
  const stem = hasExtension ? targetPath.slice(0, extIndex) : targetPath;
  const ext = hasExtension ? targetPath.slice(extIndex) : "";
  let counter = 1;
  while (existsSync(`${stem} (${counter})${ext}`)) {
    counter += 1;
  }
  return `${stem} (${counter})${ext}`;
}

async function markExecutable(filePath: string): Promise<void> {
  if (process.platform === "win32") {
    return;
  }
  await chmod(filePath, 0o755);
}

async function extractArchive(
  archivePath: string,
  targetDir: string,
  archiveType: "tar.xz" | "zip"
): Promise<void> {
  await ensureDir(targetDir);

  if (archiveType === "tar.xz") {
    await runCommand("tar", ["-xf", archivePath, "-C", targetDir], targetDir, undefined, 60_000);
    return;
  }

  if (process.platform === "win32") {
    await runCommand(
      "powershell.exe",
      [
        "-NoProfile",
        "-ExecutionPolicy",
        "Bypass",
        "-Command",
        `Expand-Archive -LiteralPath '${archivePath.replace(/'/g, "''")}' -DestinationPath '${targetDir.replace(/'/g, "''")}' -Force`,
      ],
      targetDir,
      undefined,
      60_000
    );
    return;
  }

  if (process.platform === "darwin") {
    await runCommand("ditto", ["-x", "-k", archivePath, targetDir], targetDir, undefined, 60_000);
    return;
  }

  await runCommand(
    "python3",
    ["-m", "zipfile", "-e", archivePath, targetDir],
    targetDir,
    undefined,
    60_000
  );
}

async function runCommand(
  command: string,
  args: string[],
  cwd?: string,
  env?: Record<string, string | undefined>,
  timeoutMs = 15_000
): Promise<{ exitCode: number | null; stdout: string; stderr: string; cancelled: boolean }> {
  return await new Promise((resolvePromise, rejectPromise) => {
    let stdout = "";
    let stderr = "";
    let settled = false;
    let timedOut = false;

    const child = spawn(command, args, {
      cwd,
      env: {
        ...process.env,
        ...Object.fromEntries(
          Object.entries(env ?? {}).filter(
            (entry): entry is [string, string] => typeof entry[1] === "string"
          )
        ),
      },
      stdio: ["ignore", "pipe", "pipe"],
      windowsHide: true,
    });

    const finish = (payload: {
      exitCode: number | null;
      stdout: string;
      stderr: string;
      cancelled: boolean;
    }): void => {
      if (settled) {
        return;
      }
      settled = true;
      clearTimeout(timer);
      resolvePromise(payload);
    };

    child.stdout.on("data", (chunk: Buffer) => {
      stdout += chunk.toString("utf8");
    });
    child.stderr.on("data", (chunk: Buffer) => {
      stderr += chunk.toString("utf8");
    });
    child.once("error", rejectPromise);
    child.once("close", (code) => {
      finish({ exitCode: code, stdout, stderr, cancelled: timedOut });
    });

    const timer = setTimeout(() => {
      timedOut = true;
      child.kill("SIGKILL");
    }, timeoutMs);
  });
}

function normalizeToolStatus(toolId: string, data: Partial<RoomToolStatus>): RoomToolStatus {
  return {
    toolId,
    installed: data.installed === true,
    version: data.version ?? null,
    binaryPath: data.binaryPath ?? null,
    lastError: data.lastError ?? null,
    releaseTag: data.releaseTag ?? null,
    releaseName: data.releaseName ?? null,
    installDir: data.installDir ?? null,
    companionPaths: data.companionPaths ?? {},
    details: data.details ?? {},
  };
}

function summarizeCommandFailure(result: { stderr: string; stdout: string }): string | null {
  const prioritizedOutputs = [result.stderr, result.stdout];
  for (let index = 0; index < prioritizedOutputs.length; index += 1) {
    const output = prioritizedOutputs[index];
    if (typeof output !== "string" || output.trim() === "") {
      continue;
    }
    const lines = output
      .split(/\r?\n/u)
      .map((line) => line.trim())
      .filter((line) => line !== "");
    if (lines.length === 0) {
      continue;
    }
    return lines[lines.length - 1] ?? null;
  }
  return null;
}

async function resolveInstallableToolInstallDir(
  paths: RoomToolRuntimePaths,
  installDirName: string
): Promise<string> {
  const preferredInstallDir = join(paths.toolRuntimeDir, installDirName);
  const legacyInstallDir = join(paths.packageToolRuntimeDir, installDirName);

  if (existsSync(preferredInstallDir) || !existsSync(legacyInstallDir)) {
    return preferredInstallDir;
  }

  await ensureDir(dirname(preferredInstallDir));
  try {
    await rename(legacyInstallDir, preferredInstallDir);
    return preferredInstallDir;
  } catch {
    return legacyInstallDir;
  }
}

class RoomToolService {
  private activeJobs = new Map<string, ActiveJob>();

  async handleCall(
    event: IpcMainInvokeEvent,
    request: RoomToolCallRequest
  ): Promise<RoomToolCallResult> {
    const roomId = normalizeRoomId(request.roomId);
    if (roomId === "") {
      throw new Error("roomId is required for room-tools-call");
    }

    switch (request.operation) {
      case "resolve-paths":
        return await this.resolvePaths(request);
      case "ensure-dir":
        return await this.ensureDirPath(request);
      case "delete-path":
        return await this.deletePath(request);
      case "download-file":
        return await this.downloadFile(event, request);
      case "transcript-status":
        return await this.readTranscriptStatus(request);
      case "transcript-list-models":
        return await this.listTranscriptModels(request);
      case "transcript-transcribe-file":
        return await this.transcribeManagedFile(request);
      case "tool-probe":
        return await this.probeTool(request);
      case "tool-check-for-updates":
        return await this.checkForUpdates(request);
      case "tool-install":
        return await this.installTool(event, request, false);
      case "tool-update":
        return await this.installTool(event, request, true);
      case "tool-run":
        return await this.runTool(event, request);
      default:
        throw new Error(
          `Unsupported room-tools operation: ${String((request as { operation?: unknown }).operation)}`
        );
    }
  }

  cancel(request: RoomToolCancelRequest): RoomToolCancelResult {
    const roomId = normalizeRoomId(request.roomId);
    const jobId = asNonEmptyString(request.jobId);
    if (roomId === "" || jobId === null) {
      throw new Error("roomId and jobId are required for room-tools-cancel");
    }

    const active = this.activeJobs.get(jobId);
    if (active?.roomId !== roomId) {
      return {
        success: true,
        roomId,
        jobId,
        cancelled: false,
        requestId: normalizeRequestId(request.requestId),
      };
    }

    active.cancel();
    this.activeJobs.delete(jobId);
    return {
      success: true,
      roomId,
      jobId,
      cancelled: true,
      requestId: normalizeRequestId(request.requestId),
    };
  }

  private emitProgress(
    event: IpcMainInvokeEvent,
    payload: Omit<RoomToolProgressEvent, "timestamp">
  ): void {
    const nextPayload: RoomToolProgressEvent = {
      ...payload,
      timestamp: Date.now(),
    };
    event.sender.send(ROOM_TOOLS_PROGRESS_CHANNEL, nextPayload);
  }

  private async resolvePaths(
    request: Extract<RoomToolCallRequest, { operation: "resolve-paths" }>
  ): Promise<RoomToolCallResult> {
    const paths = resolveRuntimePaths(request.roomId);
    await Promise.all([
      ensureDir(paths.storageDir),
      ensureDir(paths.projectsDir),
      ensureDir(paths.packageToolsDir),
      ensureDir(paths.toolRuntimeDir),
    ]);
    return {
      success: true,
      operation: request.operation,
      requestId: normalizeRequestId(request.requestId),
      paths,
    };
  }

  private async ensureDirPath(
    request: Extract<RoomToolCallRequest, { operation: "ensure-dir" }>
  ): Promise<RoomToolCallResult> {
    const targetPath = ensureAbsolutePath(request.targetPath);
    ensureRoomManagedPath(request.roomId, targetPath);
    await ensureDir(targetPath);
    return {
      success: true,
      operation: request.operation,
      requestId: normalizeRequestId(request.requestId),
      ensuredPath: targetPath,
    };
  }

  private async deletePath(
    request: Extract<RoomToolCallRequest, { operation: "delete-path" }>
  ): Promise<RoomToolCallResult> {
    const targetPath = ensureAbsolutePath(request.targetPath);
    ensureRoomManagedPath(request.roomId, targetPath);
    await rm(targetPath, { recursive: request.recursive === true, force: true });
    return {
      success: true,
      operation: request.operation,
      requestId: normalizeRequestId(request.requestId),
      deletedPath: targetPath,
    };
  }

  private async downloadFile(
    event: IpcMainInvokeEvent,
    request: {
      operation: RoomToolCallRequest["operation"];
      roomId: string;
      requestId?: string | null;
      jobId?: string | null;
      url: string;
      destinationPath: string;
      overwrite?: boolean;
      headers?: Record<string, string>;
    }
  ): Promise<RoomToolCallResult> {
    return await this.downloadToPath(event, request, { enforceRoomManagedPath: true });
  }

  private async readTranscriptStatus(
    request: Extract<RoomToolCallRequest, { operation: "transcript-status" }>
  ): Promise<RoomToolCallResult> {
    return {
      success: true,
      operation: request.operation,
      requestId: normalizeRequestId(request.requestId),
      transcriptStatus: await transcriptService.getStatus(),
    };
  }

  private async listTranscriptModels(
    request: Extract<RoomToolCallRequest, { operation: "transcript-list-models" }>
  ): Promise<RoomToolCallResult> {
    return {
      success: true,
      operation: request.operation,
      requestId: normalizeRequestId(request.requestId),
      transcriptModels: await transcriptService.listModels(),
    };
  }

  private async transcribeManagedFile(
    request: Extract<RoomToolCallRequest, { operation: "transcript-transcribe-file" }>
  ): Promise<RoomToolCallResult> {
    const result = await transcriptService.transcribeFile({
      ...request,
      roomId: request.roomId,
    });

    return {
      success: result.success === true,
      operation: request.operation,
      requestId: normalizeRequestId(request.requestId),
      ...(typeof request.jobId === "string" && request.jobId.trim() !== ""
        ? { jobId: request.jobId }
        : {}),
      ...(typeof result.error === "string" && result.error.trim() !== ""
        ? { error: result.error }
        : {}),
      transcription: result,
    };
  }

  private async downloadToPath(
    event: IpcMainInvokeEvent,
    request: {
      operation: RoomToolCallRequest["operation"];
      roomId: string;
      requestId?: string | null;
      jobId?: string | null;
      url: string;
      destinationPath: string;
      overwrite?: boolean;
      headers?: Record<string, string>;
    },
    options: {
      enforceRoomManagedPath: boolean;
    }
  ): Promise<RoomToolCallResult> {
    const roomId = request.roomId;
    const jobId = normalizeJobId(request.jobId, "room-download");
    const requestId = normalizeRequestId(request.requestId);
    const destinationPath = ensureAbsolutePath(request.destinationPath);
    if (options.enforceRoomManagedPath === true) {
      ensureRoomManagedPath(roomId, destinationPath);
    }

    const controller = new AbortController();
    this.activeJobs.set(jobId, {
      roomId,
      jobId,
      cancel: (): void => {
        controller.abort();
      },
    });

    this.emitProgress(event, {
      roomId,
      operation: request.operation,
      requestId,
      jobId,
      stage: "queued",
      message: request.url,
    });

    try {
      const response = await fetch(request.url, {
        signal: controller.signal,
        ...(request.headers !== undefined ? { headers: request.headers } : {}),
      });
      if (!response.ok || response.body === null) {
        throw new Error(`Download failed (${response.status}) for ${request.url}`);
      }

      const targetPath =
        request.overwrite === true ? destinationPath : resolveUniquePath(destinationPath);
      await ensureDir(dirname(targetPath));
      const tempPath = `${targetPath}.part-${Date.now()}`;
      const fileStream = createWriteStream(tempPath);
      const totalBytesHeader = Number(response.headers.get("content-length") ?? "0");
      const totalBytes =
        Number.isFinite(totalBytesHeader) && totalBytesHeader > 0 ? totalBytesHeader : 0;
      let writtenBytes = 0;
      const reader = response.body.getReader();

      this.emitProgress(event, {
        roomId,
        operation: request.operation,
        requestId,
        jobId,
        stage: "running",
        bytesReceived: 0,
        ...(totalBytes > 0 ? { bytesTotal: totalBytes } : {}),
        message: targetPath,
      });

      const pumpDownload = async (): Promise<void> => {
        const { done, value } = await reader.read();
        if (done) {
          return;
        }
        writtenBytes += value.byteLength;
        if (!fileStream.write(Buffer.from(value))) {
          await once(fileStream, "drain");
        }
        this.emitProgress(event, {
          roomId,
          operation: request.operation,
          requestId,
          jobId,
          stage: "downloading",
          bytesReceived: writtenBytes,
          ...(totalBytes > 0 ? { bytesTotal: totalBytes } : {}),
          ...(totalBytes > 0
            ? { percent: Math.min(100, Math.round((writtenBytes / totalBytes) * 100)) }
            : {}),
        });
        await pumpDownload();
      };

      await pumpDownload();

      await new Promise<void>((resolvePromise, rejectPromise) => {
        fileStream.end(() => {
          resolvePromise();
        });
        fileStream.once("error", rejectPromise);
      });

      await rename(tempPath, targetPath);
      this.emitProgress(event, {
        roomId,
        operation: request.operation,
        requestId,
        jobId,
        stage: "completed",
        bytesReceived: writtenBytes,
        ...(totalBytes > 0 ? { bytesTotal: totalBytes } : {}),
        percent: 100,
        message: targetPath,
      });

      return {
        success: true,
        operation: request.operation,
        requestId,
        jobId,
        download: {
          url: request.url,
          path: targetPath,
          fileName: targetPath.split(/[\\/]/).pop() ?? "download",
          bytesWritten: writtenBytes,
          contentType: response.headers.get("content-type"),
        },
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.emitProgress(event, {
        roomId,
        operation: request.operation,
        requestId,
        jobId,
        stage: controller.signal.aborted ? "cancelled" : "failed",
        message,
      });
      throw error;
    } finally {
      this.activeJobs.delete(jobId);
    }
  }

  private async probeTool(
    request: Extract<RoomToolCallRequest, { operation: "tool-probe" }>
  ): Promise<RoomToolCallResult> {
    const manifest = await this.loadToolchainManifest(request.roomId);
    const toolManifest = this.getToolManifest(manifest, request.toolId);
    const paths = resolveRuntimePaths(request.roomId);
    const installDir = await resolveInstallableToolInstallDir(
      paths,
      toolManifest.installDirName ?? request.toolId
    );
    const detectedPlatformKey = detectPlatformKey();
    const platformKey = detectedPlatformKey ?? `${process.platform}-${process.arch}`;

    if (this.getToolAvailability(toolManifest) === "planned") {
      return {
        success: true,
        operation: request.operation,
        requestId: normalizeRequestId(request.requestId),
        tool: normalizeToolStatus(request.toolId, {
          installed: false,
          installDir,
          details: {
            platformKey,
            availability: "planned",
            installable: false,
            plannedReason: asNonEmptyString(toolManifest.plannedReason),
          },
        }),
      };
    }

    if (
      this.isSystemCommandTool(toolManifest) === true ||
      this.shouldUseSystemCommandFallback(toolManifest, detectedPlatformKey) === true
    ) {
      return await this.probeSystemCommandToolStatus(
        request.toolId,
        toolManifest,
        paths,
        platformKey,
        normalizeRequestId(request.requestId),
        request.operation
      );
    }

    const resolved = this.resolveTool(manifest, request.toolId);
    const binaryPath = join(installDir, resolved.asset.executableName);

    if (!existsSync(binaryPath)) {
      return {
        success: true,
        operation: request.operation,
        requestId: normalizeRequestId(request.requestId),
        tool: normalizeToolStatus(request.toolId, {
          installed: false,
          installDir,
          details: {
            platformKey,
            availability: "installable",
            installable: true,
          },
        }),
      };
    }

    const probe = await runCommand(
      binaryPath,
      resolved.manifest.probe.args,
      installDir,
      undefined,
      12_000
    );
    const combinedOutput = `${probe.stdout}\n${probe.stderr}`;
    const version =
      probe.exitCode === 0
        ? findVersion(combinedOutput, resolved.manifest.probe.versionRegex)
        : null;

    return {
      success: true,
      operation: request.operation,
      requestId: normalizeRequestId(request.requestId),
      tool: normalizeToolStatus(request.toolId, {
        installed: probe.exitCode === 0,
        version,
        binaryPath,
        installDir,
        companionPaths: Object.fromEntries(
          (resolved.asset.companionExecutables ?? [])
            .map((name) => [name, join(installDir, name)] as const)
            .filter((entry) => existsSync(entry[1]))
        ),
        details: {
          platformKey,
          availability: "installable",
          installable: true,
        },
      }),
    };
  }

  private async checkForUpdates(
    request: Extract<RoomToolCallRequest, { operation: "tool-check-for-updates" }>
  ): Promise<RoomToolCallResult> {
    const manifest = await this.loadToolchainManifest(request.roomId);
    const toolManifest = this.getToolManifest(manifest, request.toolId);
    const platformKey = detectPlatformKey();
    if (this.isToolInstallable(toolManifest) !== true) {
      const update: RoomToolUpdateCheck = {
        toolId: request.toolId,
        installedVersion: asNonEmptyString(request.installedVersion),
        latestVersion: null,
        latestReleaseTag: null,
        latestReleaseName: null,
        updateAvailable: false,
        releaseUrl:
          this.isSystemCommandTool(toolManifest) === true
            ? null
            : asNonEmptyString(toolManifest.releaseProvider?.releaseUrl),
      };

      return {
        success: true,
        operation: request.operation,
        requestId: normalizeRequestId(request.requestId),
        update,
      };
    }

    if (this.shouldUseSystemCommandFallback(toolManifest, platformKey) === true) {
      const update: RoomToolUpdateCheck = {
        toolId: request.toolId,
        installedVersion: asNonEmptyString(request.installedVersion),
        latestVersion: null,
        latestReleaseTag: null,
        latestReleaseName: null,
        updateAvailable: false,
        releaseUrl: asNonEmptyString(toolManifest.releaseProvider?.releaseUrl),
      };

      return {
        success: true,
        operation: request.operation,
        requestId: normalizeRequestId(request.requestId),
        update,
      };
    }

    const resolved = this.resolveTool(manifest, request.toolId);
    const release = await this.resolveLatestToolRelease(resolved.manifest, resolved.asset);
    const latestVersion = release.tag ?? release.name;
    const installedReleaseTag = asNonEmptyString(request.installedReleaseTag);
    const installedReleaseName = asNonEmptyString(request.installedReleaseName);
    const installedVersion = asNonEmptyString(request.installedVersion);

    let updateAvailable = true;
    if (installedReleaseTag !== null && release.tag !== null) {
      updateAvailable = installedReleaseTag !== release.tag;
    } else if (installedReleaseName !== null && release.name !== null) {
      updateAvailable = installedReleaseName !== release.name;
    } else if (installedVersion !== null && latestVersion !== null) {
      updateAvailable = compareLooseVersion(latestVersion, installedVersion) > 0;
    }

    const update: RoomToolUpdateCheck = {
      toolId: request.toolId,
      installedVersion,
      latestVersion,
      latestReleaseTag: release.tag,
      latestReleaseName: release.name,
      updateAvailable,
      releaseUrl: release.releaseUrl,
    };

    return {
      success: true,
      operation: request.operation,
      requestId: normalizeRequestId(request.requestId),
      update,
    };
  }

  private async installTool(
    event: IpcMainInvokeEvent,
    request: Extract<RoomToolCallRequest, { operation: "tool-install" | "tool-update" }>,
    isUpdate: boolean
  ): Promise<RoomToolCallResult> {
    const requestId = normalizeRequestId(request.requestId);
    const jobId = normalizeJobId(
      request.jobId,
      isUpdate ? "room-tool-update" : "room-tool-install"
    );
    const manifest = await this.loadToolchainManifest(request.roomId);
    const toolManifest = this.getToolManifest(manifest, request.toolId);
    if (this.isSystemCommandTool(toolManifest) === true) {
      if (this.getInstallerType(toolManifest) === "python-venv-pip") {
        return await this.installPythonVenvPipTool(event, request, toolManifest, jobId);
      }
      return await this.recheckSystemCommandTool(request);
    }
    if (this.shouldUseSystemCommandFallback(toolManifest, detectPlatformKey()) === true) {
      return await this.recheckSystemCommandTool(request);
    }
    if (this.isToolInstallable(toolManifest) !== true) {
      throw new Error(this.getPlannedToolMessage(request.toolId, toolManifest));
    }
    const resolved = this.resolveTool(manifest, request.toolId);
    const paths = resolveRuntimePaths(request.roomId);
    const installDir = join(paths.toolRuntimeDir, resolved.installDirName);
    await resolveInstallableToolInstallDir(paths, resolved.installDirName);
    const tempRoot = await mkdtemp(join(tmpdir(), `hayalet-room-tool-${request.toolId}-`));
    const downloadPath = join(tempRoot, resolved.releaseAssetNameHint);

    this.activeJobs.set(jobId, {
      roomId: request.roomId,
      jobId,
      cancel: () => {},
    });

    try {
      const release = await this.resolveLatestToolRelease(resolved.manifest, resolved.asset);
      this.emitProgress(event, {
        roomId: request.roomId,
        operation: request.operation,
        requestId,
        jobId,
        toolId: request.toolId,
        stage: "queued",
        message: release.asset.name,
      });

      const downloadResult = await this.downloadReleaseAsset(
        event,
        request.roomId,
        request.operation,
        requestId,
        jobId,
        release.asset.browser_download_url,
        downloadPath
      );

      await rm(installDir, { recursive: true, force: true });
      await ensureDir(installDir);

      if (resolved.asset.archive === "none") {
        const binaryPath = join(installDir, resolved.asset.executableName);
        await rename(downloadResult.path, binaryPath);
        await markExecutable(binaryPath);
      } else {
        const extractDir = join(tempRoot, "extract");
        this.emitProgress(event, {
          roomId: request.roomId,
          operation: request.operation,
          requestId,
          jobId,
          toolId: request.toolId,
          stage: "extracting",
          message: resolved.asset.archive,
        });
        await extractArchive(downloadResult.path, extractDir, resolved.asset.archive);
        const files = await collectFilesRecursive(extractDir);
        const executables = [
          resolved.asset.executableName,
          ...(resolved.asset.companionExecutables ?? []),
        ];

        await Promise.all(
          executables.map(async (executableName): Promise<void> => {
            const sourcePath =
              files.find((filePath) => filePath.split(/[\\/]/).pop() === executableName) ?? null;
            if (sourcePath === null) {
              throw new Error(`Could not find ${executableName} inside ${release.asset.name}`);
            }
            const targetPath = join(installDir, executableName);
            const sourceBuffer = await readFile(sourcePath);
            await writeFile(targetPath, sourceBuffer);
            await markExecutable(targetPath);
          })
        );
      }

      const probed = await this.probeTool({
        operation: "tool-probe",
        roomId: request.roomId,
        requestId,
        toolId: request.toolId,
      });
      const nextTool = normalizeToolStatus(request.toolId, {
        ...(probed.tool ?? {}),
        releaseTag: release.tag,
        releaseName: release.name,
        installDir,
      });

      this.emitProgress(event, {
        roomId: request.roomId,
        operation: request.operation,
        requestId,
        jobId,
        toolId: request.toolId,
        stage: "completed",
        percent: 100,
        message: nextTool.binaryPath ?? installDir,
      });

      return {
        success: true,
        operation: request.operation,
        requestId,
        jobId,
        tool: nextTool,
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.emitProgress(event, {
        roomId: request.roomId,
        operation: request.operation,
        requestId,
        jobId,
        toolId: request.toolId,
        stage: "failed",
        message,
      });
      throw error;
    } finally {
      this.activeJobs.delete(jobId);
      await rm(tempRoot, { recursive: true, force: true });
    }
  }

  private async runTool(
    event: IpcMainInvokeEvent,
    request: Extract<RoomToolCallRequest, { operation: "tool-run" }>
  ): Promise<RoomToolCallResult> {
    const requestId = normalizeRequestId(request.requestId);
    const jobId = normalizeJobId(request.jobId, "room-tool-run");
    const manifest = await this.loadToolchainManifest(request.roomId);
    const toolManifest = this.getToolManifest(manifest, request.toolId);
    if (this.isToolRunnable(toolManifest) !== true) {
      throw new Error(this.getPlannedToolMessage(request.toolId, toolManifest));
    }
    const paths = resolveRuntimePaths(request.roomId);
    const requestedExecutableName = asNonEmptyString(request.executableName);
    let binaryPath = "";
    let defaultCwd = paths.storageDir;
    let allowedExecutableNames: string[] = [];
    let defaultExecutableName = "";
    const detectedPlatformKey = detectPlatformKey();
    const useSystemCommandFallback =
      this.isSystemCommandTool(toolManifest) === true ||
      this.shouldUseSystemCommandFallback(toolManifest, detectedPlatformKey) === true;

    if (this.isToolInstallable(toolManifest) === true && useSystemCommandFallback !== true) {
      const resolved = this.resolveTool(manifest, request.toolId);
      const installDir = await resolveInstallableToolInstallDir(paths, resolved.installDirName);
      defaultCwd = installDir;
      allowedExecutableNames = [
        resolved.asset.executableName,
        ...(resolved.asset.companionExecutables ?? []),
      ];
      defaultExecutableName = resolved.asset.executableName;
    } else if (useSystemCommandFallback === true) {
      const resolved =
        this.isSystemCommandTool(toolManifest) === true
          ? this.resolveSystemCommandTool(manifest, request.toolId)
          : this.resolveToolSystemCommandSpec(toolManifest, request.toolId);
      allowedExecutableNames = [
        resolved.systemCommand.executableName,
        ...(resolved.systemCommand.companionExecutables ?? []),
      ];
      defaultExecutableName = resolved.systemCommand.executableName;
    }

    const selectedExecutableName =
      requestedExecutableName !== null && allowedExecutableNames.includes(requestedExecutableName)
        ? requestedExecutableName
        : requestedExecutableName === null
          ? defaultExecutableName
          : null;

    if (selectedExecutableName === null) {
      throw new Error(
        `${request.toolId} does not expose companion executable ${String(request.executableName)}`
      );
    }

    if (this.isToolInstallable(toolManifest) === true && useSystemCommandFallback !== true) {
      binaryPath = join(defaultCwd, selectedExecutableName);
      if (!existsSync(binaryPath)) {
        throw new Error(
          `${request.toolId}:${selectedExecutableName} is not installed for room ${request.roomId}`
        );
      }
    } else {
      const resolvedSystemCommand =
        this.isSystemCommandTool(toolManifest) === true
          ? this.resolveSystemCommandTool(manifest, request.toolId)
          : this.resolveToolSystemCommandSpec(toolManifest, request.toolId);
      const resolvedBinaryPath = await resolveSystemCommandBinaryPath(selectedExecutableName, {
        envVarNames:
          selectedExecutableName === resolvedSystemCommand.systemCommand.executableName
            ? resolvedSystemCommand.systemCommand.envVarNames
            : undefined,
        candidatePaths:
          selectedExecutableName === resolvedSystemCommand.systemCommand.executableName
            ? resolvedSystemCommand.systemCommand.candidatePaths
            : undefined,
        runtimePaths: paths,
      });
      if (resolvedBinaryPath === null) {
        throw new Error(
          `${request.toolId}:${selectedExecutableName} is not available on the shared transcript runtime or PATH for room ${request.roomId}`
        );
      }
      binaryPath = resolvedBinaryPath;
    }

    const cwd = asNonEmptyString(request.cwd) ?? defaultCwd;
    ensureRoomManagedPath(request.roomId, cwd);

    this.emitProgress(event, {
      roomId: request.roomId,
      operation: request.operation,
      requestId,
      jobId,
      toolId: request.toolId,
      stage: "queued",
      message: binaryPath,
    });

    return await new Promise<RoomToolCallResult>((resolvePromise, rejectPromise) => {
      let stdout = "";
      let stderr = "";
      let settled = false;
      let cancelled = false;

      const child = spawn(binaryPath, request.args ?? [], {
        cwd,
        env: {
          ...process.env,
          ...Object.fromEntries(
            Object.entries(request.env ?? {}).filter(
              (entry): entry is [string, string] => typeof entry[1] === "string"
            )
          ),
        },
        stdio: ["ignore", "pipe", "pipe"],
        windowsHide: true,
      });

      const finish = (error?: Error, exitCode?: number | null): void => {
        if (settled) {
          return;
        }
        settled = true;
        clearTimeout(timer);
        this.activeJobs.delete(jobId);

        if (error) {
          this.emitProgress(event, {
            roomId: request.roomId,
            operation: request.operation,
            requestId,
            jobId,
            toolId: request.toolId,
            stage: cancelled ? "cancelled" : "failed",
            message: error.message,
          });
          rejectPromise(error);
          return;
        }

        this.emitProgress(event, {
          roomId: request.roomId,
          operation: request.operation,
          requestId,
          jobId,
          toolId: request.toolId,
          stage: cancelled ? "cancelled" : "completed",
          message: binaryPath,
          exitCode: exitCode ?? null,
        });

        resolvePromise({
          success: true,
          operation: request.operation,
          requestId,
          jobId,
          run: {
            toolId: request.toolId,
            binaryPath,
            exitCode: exitCode ?? null,
            cancelled,
            stdout,
            stderr,
          },
        });
      };

      this.activeJobs.set(jobId, {
        roomId: request.roomId,
        jobId,
        cancel: () => {
          cancelled = true;
          child.kill("SIGKILL");
        },
      });

      this.emitProgress(event, {
        roomId: request.roomId,
        operation: request.operation,
        requestId,
        jobId,
        toolId: request.toolId,
        stage: "running",
        message: (request.args ?? []).join(" "),
      });

      child.stdout.on("data", (chunk: Buffer) => {
        const text = chunk.toString("utf8");
        stdout += text;
        this.emitProgress(event, {
          roomId: request.roomId,
          operation: request.operation,
          requestId,
          jobId,
          toolId: request.toolId,
          stage: "stdout",
          chunk: text,
        });
      });

      child.stderr.on("data", (chunk: Buffer) => {
        const text = chunk.toString("utf8");
        stderr += text;
        this.emitProgress(event, {
          roomId: request.roomId,
          operation: request.operation,
          requestId,
          jobId,
          toolId: request.toolId,
          stage: "stderr",
          chunk: text,
        });
      });

      child.once("error", (error) => {
        finish(error);
      });
      child.once("close", (code) => {
        finish(undefined, code);
      });

      const timer = setTimeout(
        () => {
          cancelled = true;
          child.kill("SIGKILL");
        },
        Math.max(1_000, Number(request.timeoutMs) > 0 ? Number(request.timeoutMs) : 30 * 60_000)
      );
    });
  }

  private async loadToolchainManifest(roomId: string): Promise<ToolchainManifest> {
    const paths = resolveRuntimePaths(roomId);
    const candidatePaths = getToolchainManifestCandidates(paths);
    const manifestPath = candidatePaths.find((candidate) => existsSync(candidate));
    if (manifestPath === undefined) {
      throw new Error(`Room toolchain manifest missing: ${candidatePaths.join(" | ")}`);
    }
    return await readJsonFile<ToolchainManifest>(manifestPath);
  }

  private getToolManifest(manifest: ToolchainManifest, toolId: string): ToolManifest {
    const toolManifest = manifest.tools[toolId];
    if (!toolManifest) {
      throw new Error(`Tool ${toolId} is not declared in the room manifest`);
    }
    return toolManifest;
  }

  private getToolAvailability(toolManifest: ToolManifest): ToolAvailability {
    return toolManifest.availability ?? "installable";
  }

  private isToolInstallable(toolManifest: ToolManifest): boolean {
    return this.getToolAvailability(toolManifest) === "installable";
  }

  private isSystemCommandTool(toolManifest: ToolManifest): boolean {
    return this.getToolAvailability(toolManifest) === "system-command";
  }

  private isToolRunnable(toolManifest: ToolManifest): boolean {
    return (
      this.isToolInstallable(toolManifest) === true ||
      this.isSystemCommandTool(toolManifest) === true
    );
  }

  private getPlannedToolMessage(toolId: string, toolManifest: ToolManifest): string {
    return (
      asNonEmptyString(toolManifest.plannedReason) ??
      `${toolId} is planned and does not expose an install path yet.`
    );
  }

  private getSystemCommandSetupHint(toolId: string, toolManifest: ToolManifest): string {
    return (
      asNonEmptyString(toolManifest.systemCommand?.setupHint) ??
      `Install ${toolId} on the host system, make the binary available on PATH, and refresh the probe.`
    );
  }

  private getInstallerType(toolManifest: ToolManifest): ToolInstallerSpec["type"] | null {
    return toolManifest.installer?.type ?? null;
  }

  private resolvePythonVenvPipInstaller(
    toolManifest: ToolManifest,
    toolId: string
  ): ResolvedPythonVenvPipInstaller {
    const resolved = this.resolveToolSystemCommandSpec(toolManifest, toolId);
    const installer = toolManifest.installer;
    if (installer?.type !== "python-venv-pip") {
      throw new Error(`${toolId} does not expose a python-venv installer`);
    }

    const venvDir = asNonEmptyString(installer.venvDir);
    const packages = normalizeStringArray(installer.packages);
    if (venvDir === null || packages.length === 0) {
      throw new Error(`${toolId} installer is missing a venvDir or package list`);
    }

    return {
      manifest: resolved.manifest,
      probe: resolved.probe,
      systemCommand: resolved.systemCommand,
      installer: {
        type: "python-venv-pip",
        venvDir,
        packages,
        bootstrapExecutableNames: normalizeStringArray(installer.bootstrapExecutableNames),
      },
    };
  }

  private async resolvePythonBootstrapInvocation(
    resolvedInstaller: ResolvedPythonVenvPipInstaller
  ): Promise<{ command: string; argsPrefix: string[] }> {
    const candidateNames = Array.from(
      new Set(
        [
          resolvedInstaller.systemCommand.executableName,
          ...resolvedInstaller.installer.bootstrapExecutableNames,
          "python3",
          "python",
          "py",
        ].filter((entry) => typeof entry === "string" && entry.trim() !== "")
      )
    );

    const resolveCandidate = async (
      index: number
    ): Promise<{ command: string; argsPrefix: string[] } | null> => {
      const candidateName = candidateNames[index];
      if (candidateName === undefined) {
        return null;
      }

      const resolvedBinaryPath = await resolveSystemCommandBinaryPath(candidateName);
      if (resolvedBinaryPath === null) {
        return await resolveCandidate(index + 1);
      }

      if (
        process.platform === "win32" &&
        (candidateName === "py" || /(?:^|[\\/])py(?:\.exe)?$/i.test(resolvedBinaryPath))
      ) {
        return {
          command: resolvedBinaryPath,
          argsPrefix: ["-3"],
        };
      }

      return {
        command: resolvedBinaryPath,
        argsPrefix: [],
      };
    };

    const resolvedCandidate = await resolveCandidate(0);
    if (resolvedCandidate !== null) {
      return resolvedCandidate;
    }

    throw new Error(
      `Python build prerequisites are missing for ${resolvedInstaller.manifest.displayName}. Install python3 or python, then retry.`
    );
  }

  private async runProgressCommand(
    event: IpcMainInvokeEvent,
    options: {
      args: string[];
      command: string;
      cwd: string;
      env?: Record<string, string | undefined>;
      getCancelled: () => boolean;
      jobId: string;
      message: string;
      operation: "tool-install" | "tool-update";
      requestId: string | null;
      roomId: string;
      setActiveChild: (child: SpawnedProcess | null) => void;
      timeoutMs: number;
      toolId: string;
    }
  ): Promise<{ cancelled: boolean; exitCode: number | null; stderr: string; stdout: string }> {
    return await new Promise((resolvePromise, rejectPromise) => {
      let stdout = "";
      let stderr = "";
      let settled = false;
      let timedOut = false;

      const child = spawn(options.command, options.args, {
        cwd: options.cwd,
        env: {
          ...process.env,
          ...Object.fromEntries(
            Object.entries(options.env ?? {}).filter(
              (entry): entry is [string, string] => typeof entry[1] === "string"
            )
          ),
        },
        stdio: ["ignore", "pipe", "pipe"],
        windowsHide: true,
      });
      options.setActiveChild(child);

      this.emitProgress(event, {
        roomId: options.roomId,
        operation: options.operation,
        requestId: options.requestId,
        jobId: options.jobId,
        toolId: options.toolId,
        stage: "running",
        message: options.message,
      });

      const finish = (payload: {
        cancelled: boolean;
        exitCode: number | null;
        stderr: string;
        stdout: string;
      }): void => {
        if (settled) {
          return;
        }
        settled = true;
        clearTimeout(timer);
        options.setActiveChild(null);
        resolvePromise(payload);
      };

      child.stdout.on("data", (chunk: Buffer) => {
        const text = chunk.toString("utf8");
        stdout += text;
        this.emitProgress(event, {
          roomId: options.roomId,
          operation: options.operation,
          requestId: options.requestId,
          jobId: options.jobId,
          toolId: options.toolId,
          stage: "stdout",
          chunk: text,
          message: options.message,
        });
      });

      child.stderr.on("data", (chunk: Buffer) => {
        const text = chunk.toString("utf8");
        stderr += text;
        this.emitProgress(event, {
          roomId: options.roomId,
          operation: options.operation,
          requestId: options.requestId,
          jobId: options.jobId,
          toolId: options.toolId,
          stage: "stderr",
          chunk: text,
          message: options.message,
        });
      });

      child.once("error", (error) => {
        if (settled) {
          return;
        }
        settled = true;
        clearTimeout(timer);
        options.setActiveChild(null);
        rejectPromise(error);
      });
      child.once("close", (code) => {
        finish({
          exitCode: code,
          stdout,
          stderr,
          cancelled: timedOut || options.getCancelled() === true,
        });
      });

      const timer = setTimeout(() => {
        timedOut = true;
        child.kill("SIGKILL");
      }, options.timeoutMs);
    });
  }

  private shouldUsePythonWithoutPipFallback(result: { stderr: string; stdout: string }): boolean {
    const combinedOutput = `${result.stderr}\n${result.stdout}`;
    return /ensurepip is not\s+available/i.test(combinedOutput);
  }

  private isMissingPythonPip(result: { stderr: string; stdout: string }): boolean {
    const combinedOutput = `${result.stderr}\n${result.stdout}`;
    return /No module named pip/i.test(combinedOutput);
  }

  private async bootstrapPythonVenvPip(
    event: IpcMainInvokeEvent,
    options: {
      getCancelled: () => boolean;
      jobId: string;
      operation: "tool-install" | "tool-update";
      requestId: string | null;
      roomId: string;
      setActiveChild: (child: SpawnedProcess | null) => void;
      toolId: string;
      venvPythonPath: string;
    }
  ): Promise<void> {
    const bootstrapDir = await mkdtemp(join(tmpdir(), "hayalet-ev-get-pip-"));
    const scriptPath = join(bootstrapDir, "get-pip.py");

    try {
      this.emitProgress(event, {
        roomId: options.roomId,
        operation: options.operation,
        requestId: options.requestId,
        jobId: options.jobId,
        toolId: options.toolId,
        stage: "running",
        message: `Download pip bootstrap: ${PYTHON_GET_PIP_URL}`,
      });

      const scriptSource = await fetchText(PYTHON_GET_PIP_URL);
      await writeFile(scriptPath, scriptSource, "utf8");

      const bootstrapResult = await this.runProgressCommand(event, {
        command: options.venvPythonPath,
        args: [scriptPath],
        cwd: dirname(options.venvPythonPath),
        getCancelled: options.getCancelled,
        jobId: options.jobId,
        message: `Bootstrap pip for ${options.toolId}`,
        operation: options.operation,
        requestId: options.requestId,
        roomId: options.roomId,
        setActiveChild: options.setActiveChild,
        timeoutMs: 12 * 60_000,
        toolId: options.toolId,
      });

      if (bootstrapResult.cancelled === true) {
        throw new Error("Python package bootstrap cancelled.");
      }
      if (bootstrapResult.exitCode !== 0) {
        throw new Error(
          asNonEmptyString(bootstrapResult.stderr) ??
            asNonEmptyString(bootstrapResult.stdout) ??
            "Python package bootstrap failed."
        );
      }
    } finally {
      await rm(bootstrapDir, { recursive: true, force: true });
    }
  }

  private async installPythonVenvPipTool(
    event: IpcMainInvokeEvent,
    request: Extract<RoomToolCallRequest, { operation: "tool-install" | "tool-update" }>,
    toolManifest: ToolManifest,
    jobId: string
  ): Promise<RoomToolCallResult> {
    const requestId = normalizeRequestId(request.requestId);
    const paths = resolveRuntimePaths(request.roomId);
    const resolvedInstaller = this.resolvePythonVenvPipInstaller(toolManifest, request.toolId);
    const venvDir = expandRuntimePathTemplate(resolvedInstaller.installer.venvDir, paths);
    const packageListLabel = resolvedInstaller.installer.packages.join(", ");
    let activeChild: SpawnedProcess | null = null;
    const installState = {
      cancelled: false,
    };

    this.activeJobs.set(jobId, {
      roomId: request.roomId,
      jobId,
      cancel: () => {
        installState.cancelled = true;
        activeChild?.kill("SIGKILL");
      },
    });

    this.emitProgress(event, {
      roomId: request.roomId,
      operation: request.operation,
      requestId,
      jobId,
      toolId: request.toolId,
      stage: "queued",
      message: packageListLabel,
    });

    try {
      await ensureDir(dirname(venvDir));
      let venvPythonPath = resolveExistingPythonVenvExecutable(venvDir);
      let pipBootstrapped = false;

      if (venvPythonPath === null) {
        const bootstrap = await this.resolvePythonBootstrapInvocation(resolvedInstaller);
        const createVenvResult = await this.runProgressCommand(event, {
          command: bootstrap.command,
          args: [...bootstrap.argsPrefix, "-m", "venv", venvDir],
          cwd: paths.storageDir,
          getCancelled: () => installState.cancelled,
          jobId,
          message: `Create room-local python runtime: ${venvDir}`,
          operation: request.operation,
          requestId,
          roomId: request.roomId,
          setActiveChild(child) {
            activeChild = child;
          },
          timeoutMs: 10 * 60_000,
          toolId: request.toolId,
        });
        if (createVenvResult.cancelled === true) {
          throw new Error("Python runtime creation cancelled.");
        }
        if (createVenvResult.exitCode !== 0) {
          if (this.shouldUsePythonWithoutPipFallback(createVenvResult) !== true) {
            throw new Error(
              asNonEmptyString(createVenvResult.stderr) ??
                asNonEmptyString(createVenvResult.stdout) ??
                "Python runtime creation failed."
            );
          }

          await rm(venvDir, { recursive: true, force: true });

          const createWithoutPipResult = await this.runProgressCommand(event, {
            command: bootstrap.command,
            args: [...bootstrap.argsPrefix, "-m", "venv", "--without-pip", venvDir],
            cwd: paths.storageDir,
            getCancelled: () => installState.cancelled,
            jobId,
            message: `Create room-local python runtime without pip: ${venvDir}`,
            operation: request.operation,
            requestId,
            roomId: request.roomId,
            setActiveChild(child) {
              activeChild = child;
            },
            timeoutMs: 10 * 60_000,
            toolId: request.toolId,
          });
          if (createWithoutPipResult.cancelled === true) {
            throw new Error("Python runtime creation cancelled.");
          }
          if (createWithoutPipResult.exitCode !== 0) {
            throw new Error(
              asNonEmptyString(createWithoutPipResult.stderr) ??
                asNonEmptyString(createWithoutPipResult.stdout) ??
                "Python runtime creation failed."
            );
          }
          pipBootstrapped = true;
        }
        venvPythonPath = resolveExistingPythonVenvExecutable(venvDir);
      }

      if (venvPythonPath === null) {
        throw new Error(
          "Python runtime was created, but the venv executable could not be resolved."
        );
      }

      if (pipBootstrapped === true) {
        await this.bootstrapPythonVenvPip(event, {
          getCancelled: () => installState.cancelled,
          jobId,
          operation: request.operation,
          requestId,
          roomId: request.roomId,
          setActiveChild(child) {
            activeChild = child;
          },
          toolId: request.toolId,
          venvPythonPath,
        });
      }

      let bootstrapPipResult = await this.runProgressCommand(event, {
        command: venvPythonPath,
        args: ["-m", "pip", "install", "--upgrade", "pip", "setuptools", "wheel"],
        cwd: paths.storageDir,
        getCancelled: () => installState.cancelled,
        jobId,
        message: `Bootstrap python tooling for ${request.toolId}`,
        operation: request.operation,
        requestId,
        roomId: request.roomId,
        setActiveChild(child) {
          activeChild = child;
        },
        timeoutMs: 12 * 60_000,
        toolId: request.toolId,
      });
      if (bootstrapPipResult.cancelled === true) {
        throw new Error("Python package bootstrap cancelled.");
      }
      if (
        bootstrapPipResult.exitCode !== 0 &&
        this.isMissingPythonPip(bootstrapPipResult) === true
      ) {
        await this.bootstrapPythonVenvPip(event, {
          getCancelled: () => installState.cancelled,
          jobId,
          operation: request.operation,
          requestId,
          roomId: request.roomId,
          setActiveChild(child) {
            activeChild = child;
          },
          toolId: request.toolId,
          venvPythonPath,
        });
        bootstrapPipResult = await this.runProgressCommand(event, {
          command: venvPythonPath,
          args: ["-m", "pip", "install", "--upgrade", "pip", "setuptools", "wheel"],
          cwd: paths.storageDir,
          getCancelled: () => installState.cancelled,
          jobId,
          message: `Bootstrap python tooling for ${request.toolId}`,
          operation: request.operation,
          requestId,
          roomId: request.roomId,
          setActiveChild(child) {
            activeChild = child;
          },
          timeoutMs: 12 * 60_000,
          toolId: request.toolId,
        });
      }
      if (bootstrapPipResult.exitCode !== 0) {
        throw new Error(
          asNonEmptyString(bootstrapPipResult.stderr) ??
            asNonEmptyString(bootstrapPipResult.stdout) ??
            "Python package bootstrap failed."
        );
      }

      const installArgs = [
        "-m",
        "pip",
        "install",
        "--disable-pip-version-check",
        "--prefer-binary",
        ...(request.operation === "tool-update" ? ["--upgrade"] : []),
        ...resolvedInstaller.installer.packages,
      ];
      const installPackagesResult = await this.runProgressCommand(event, {
        command: venvPythonPath,
        args: installArgs,
        cwd: paths.storageDir,
        getCancelled: () => installState.cancelled,
        jobId,
        message: `Install python packages for ${request.toolId}: ${packageListLabel}`,
        operation: request.operation,
        requestId,
        roomId: request.roomId,
        setActiveChild(child) {
          activeChild = child;
        },
        timeoutMs: 45 * 60_000,
        toolId: request.toolId,
      });
      if (installPackagesResult.cancelled === true) {
        throw new Error("Python package installation cancelled.");
      }
      if (installPackagesResult.exitCode !== 0) {
        throw new Error(
          asNonEmptyString(installPackagesResult.stderr) ??
            asNonEmptyString(installPackagesResult.stdout) ??
            "Python package installation failed."
        );
      }

      const probeResult = await this.probeTool({
        operation: "tool-probe",
        roomId: request.roomId,
        requestId,
        toolId: request.toolId,
      });
      const probeTool = probeResult.tool;
      if (probeTool?.installed !== true) {
        throw new Error(
          asNonEmptyString(probeTool?.lastError) ??
            `${resolvedInstaller.manifest.displayName} probe failed after package installation.`
        );
      }

      this.emitProgress(event, {
        roomId: request.roomId,
        operation: request.operation,
        requestId,
        jobId,
        toolId: request.toolId,
        stage: "completed",
        percent: 100,
        message: venvPythonPath,
      });

      return {
        ...probeResult,
        operation: request.operation,
        requestId,
        jobId,
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.emitProgress(event, {
        roomId: request.roomId,
        operation: request.operation,
        requestId,
        jobId,
        toolId: request.toolId,
        stage: installState.cancelled === true ? "cancelled" : "failed",
        message,
      });
      throw error;
    } finally {
      this.activeJobs.delete(jobId);
    }
  }

  private hasPlatformAsset(toolManifest: ToolManifest, platformKey: PlatformKey | null): boolean {
    if (platformKey === null) {
      return false;
    }
    return toolManifest.assets?.[platformKey] !== undefined;
  }

  private shouldUseSystemCommandFallback(
    toolManifest: ToolManifest,
    platformKey: PlatformKey | null
  ): boolean {
    return (
      this.isToolInstallable(toolManifest) === true &&
      toolManifest.systemCommand !== undefined &&
      this.hasPlatformAsset(toolManifest, platformKey) !== true
    );
  }

  private resolveToolSystemCommandSpec(
    toolManifest: ToolManifest,
    toolId: string
  ): {
    manifest: ToolManifest;
    probe: NonNullable<ToolManifest["probe"]>;
    systemCommand: SystemCommandSpec;
  } {
    const probe = toolManifest.probe;
    if (probe === undefined) {
      throw new Error(`Tool ${toolId} is missing a probe declaration`);
    }
    const systemCommand = toolManifest.systemCommand;
    if (systemCommand === undefined) {
      throw new Error(`Tool ${toolId} is missing a system-command declaration`);
    }

    return {
      manifest: toolManifest,
      probe,
      systemCommand,
    };
  }

  private async probeSystemCommandToolStatus(
    toolId: string,
    toolManifest: ToolManifest,
    paths: RoomToolRuntimePaths,
    platformKey: string,
    requestId: string | null,
    operation: "tool-probe" | "tool-install" | "tool-update"
  ): Promise<RoomToolCallResult> {
    const resolved = this.resolveToolSystemCommandSpec(toolManifest, toolId);
    const binaryPath = await resolveSystemCommandBinaryPath(resolved.systemCommand.executableName, {
      envVarNames: resolved.systemCommand.envVarNames,
      candidatePaths: resolved.systemCommand.candidatePaths,
      runtimePaths: paths,
    });
    const setupHint = this.getSystemCommandSetupHint(toolId, resolved.manifest);
    const installerType = this.getInstallerType(resolved.manifest);

    if (binaryPath === null) {
      return {
        success: true,
        operation,
        requestId,
        tool: normalizeToolStatus(toolId, {
          installed: false,
          details: {
            platformKey,
            availability: "system-command",
            installable: false,
            manualSetup: true,
            executableName: resolved.systemCommand.executableName,
            companionExecutables: resolved.systemCommand.companionExecutables ?? [],
            installerType,
            setupHint,
          },
        }),
      };
    }

    const probe = await runCommand(
      binaryPath,
      resolved.probe.args,
      dirname(binaryPath),
      undefined,
      12_000
    );
    const combinedOutput = `${probe.stdout}\n${probe.stderr}`;
    const version =
      probe.exitCode === 0 ? findVersion(combinedOutput, resolved.probe.versionRegex) : null;
    const companionPaths: Record<string, string> = {};

    await Promise.all(
      (resolved.systemCommand.companionExecutables ?? []).map(
        async (companionName): Promise<void> => {
          const companionPath = await resolveSystemCommandBinaryPath(companionName);
          if (companionPath !== null) {
            companionPaths[companionName] = companionPath;
          }
        }
      )
    );

    return {
      success: true,
      operation,
      requestId,
      tool: normalizeToolStatus(toolId, {
        installed: probe.exitCode === 0,
        version,
        binaryPath,
        lastError: probe.exitCode === 0 ? null : summarizeCommandFailure(probe),
        installDir: dirname(binaryPath),
        companionPaths,
        details: {
          platformKey,
          availability: "system-command",
          installable: false,
          manualSetup: true,
          executableName: resolved.systemCommand.executableName,
          companionExecutables: resolved.systemCommand.companionExecutables ?? [],
          installerType,
          setupHint,
        },
      }),
    };
  }

  private async recheckSystemCommandTool(
    request: Extract<RoomToolCallRequest, { operation: "tool-install" | "tool-update" }>
  ): Promise<RoomToolCallResult> {
    const requestId = normalizeRequestId(request.requestId);
    const probeResult = await this.probeTool({
      operation: "tool-probe",
      roomId: request.roomId,
      requestId,
      toolId: request.toolId,
    });

    return {
      ...probeResult,
      operation: request.operation,
      requestId,
      jobId: normalizeJobId(
        request.jobId,
        request.operation === "tool-update" ? "room-tool-update" : "room-tool-install"
      ),
    };
  }

  private resolveTool(
    manifest: ToolchainManifest,
    toolId: string
  ): {
    manifest: InstallableToolManifest;
    asset: ToolAssetSpec;
    installDirName: string;
    releaseAssetNameHint: string;
  } {
    const toolManifest = this.getToolManifest(manifest, toolId);
    if (this.isToolInstallable(toolManifest) !== true) {
      throw new Error(this.getPlannedToolMessage(toolId, toolManifest));
    }

    const platformKey = detectPlatformKey();
    if (platformKey === null) {
      throw new Error(`Unsupported platform ${process.platform}/${process.arch}`);
    }

    const assets = toolManifest.assets ?? {};
    const asset = assets[platformKey];
    if (!asset) {
      throw new Error(`Tool ${toolId} does not support ${platformKey}`);
    }
    if (!toolManifest.probe) {
      throw new Error(`Tool ${toolId} is missing a probe declaration`);
    }
    if (!toolManifest.releaseProvider) {
      throw new Error(`Tool ${toolId} is missing a release provider declaration`);
    }

    return {
      manifest: toolManifest as InstallableToolManifest,
      asset,
      installDirName: toolManifest.installDirName ?? toolId,
      releaseAssetNameHint:
        asset.archive === "none"
          ? asset.executableName
          : `${toolId}.${asset.archive === "tar.xz" ? "tar.xz" : "zip"}`,
    };
  }

  private resolveSystemCommandTool(
    manifest: ToolchainManifest,
    toolId: string
  ): {
    manifest: SystemCommandToolManifest;
    systemCommand: SystemCommandSpec;
  } {
    const toolManifest = this.getToolManifest(manifest, toolId);
    if (this.isSystemCommandTool(toolManifest) !== true) {
      throw new Error(`${toolId} does not use the system-command tool runtime`);
    }
    const resolved = this.resolveToolSystemCommandSpec(toolManifest, toolId);

    return {
      manifest: resolved.manifest as SystemCommandToolManifest,
      systemCommand: resolved.systemCommand,
    };
  }

  private async resolveLatestToolRelease(
    manifest: ToolManifest,
    asset: ToolAssetSpec
  ): Promise<ToolReleaseInfo> {
    if (!manifest.releaseProvider) {
      throw new Error(`Tool ${manifest.displayName} is missing a release provider declaration`);
    }

    const payload = await fetchGitHubRelease(manifest.releaseProvider);
    const matcher = new RegExp(asset.assetMatch);
    const releaseAsset = (payload.assets ?? []).find((candidate) => matcher.test(candidate.name));

    if (!releaseAsset) {
      throw new Error(
        `No matching release asset found for ${manifest.displayName} (${asset.assetMatch})`
      );
    }

    return {
      tag: asNonEmptyString(payload.tag_name),
      name: asNonEmptyString(payload.name),
      releaseUrl: asNonEmptyString(payload.html_url) ?? manifest.releaseProvider.releaseUrl,
      asset: releaseAsset,
    };
  }

  private async downloadReleaseAsset(
    event: IpcMainInvokeEvent,
    roomId: string,
    operation: Extract<
      RoomToolCallRequest,
      { operation: "tool-install" | "tool-update" }
    >["operation"],
    requestId: string | null,
    jobId: string,
    url: string,
    destinationPath: string
  ): Promise<RoomFileDownloadResult> {
    const result = await this.downloadToPath(
      event,
      {
        operation,
        roomId,
        requestId,
        jobId,
        url,
        destinationPath,
        overwrite: true,
      },
      { enforceRoomManagedPath: false }
    );
    if (!result.download) {
      throw new Error(`Room tool asset download failed for ${url}`);
    }
    return result.download;
  }
}

export const roomToolService = new RoomToolService();

void logger.logInternal(LogCategory.SYSTEM, LogLevel.DEBUG, "roomToolService initialized");
