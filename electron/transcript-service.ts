import { BrowserWindow } from "electron";
import { access, mkdir, readFile, rename, rm, stat, writeFile } from "fs/promises";
import { constants as fsConstants } from "fs";
import { spawn } from "child_process";
import { createHash, randomUUID } from "crypto";
import { join, delimiter, relative, resolve } from "path";
import { Paths } from "./paths.ts";
import { resolveConfigDir } from "./path-roots.ts";
import { normalizeAppLanguage } from "../shared/i18n/locale.js";
import {
  getTranscriptModelDescriptor,
  listTranscriptModelCatalog,
  normalizeTranscriptManagedModelId,
  normalizeTranscriptModelVariant,
  resolveTranscriptModelId,
  resolveTranscriptSupportedLanguage,
} from "../shared/transcript/model-catalog.js";
import type {
  TranscriptFileTranscriptionRequest,
  TranscriptFileTranscriptionResult,
  TranscriptIngressPayload,
  TranscriptManagedModelDescriptor,
  TranscriptManagedModelId,
  TranscriptManagedModelStatus,
  TranscriptModelVariant,
  TranscriptRuntimeStatus,
  TranscriptSubmitIngressRequest,
  TranscriptSubmitIngressResult,
  TranscriptSupportedLanguage,
  TranscriptTargetId,
  TranscriptTranscriptionRequest,
  TranscriptTranscriptionResult,
} from "../src/types/transcript.ts";

const TRANSCRIPT_INGRESS_CHANNEL = "transcript:ingress";
const TRANSCRIPT_WHISPER_REPO_URL = "https://github.com/ggml-org/whisper.cpp.git";
const TRANSCRIPT_WHISPER_TAG = "v1.8.4";
const TRANSCRIPT_WHISPER_BIN_ENV = "HAYALET_EV_TRANSCRIPT_WHISPER_BIN";
const TRANSCRIPT_WHISPER_MODEL_ENV = "HAYALET_EV_TRANSCRIPT_WHISPER_MODEL";
const TRANSCRIPT_SETTINGS_PATH = join(resolveConfigDir(), "settings.json");

interface TranscriptRuntimePaths {
  rootDir: string;
  sourceDir: string;
  buildDir: string;
  modelDir: string;
  tempDir: string;
}

interface CommandRunResult {
  exitCode: number;
  stdout: string;
  stderr: string;
  timedOut: boolean;
}

interface TranscriptSettingsSnapshot {
  general?: {
    language?: unknown;
    transcriptModelVariant?: unknown;
  };
}

interface ResolvedTranscriptSelection {
  appLanguage: string;
  descriptor: TranscriptManagedModelDescriptor;
  language: TranscriptSupportedLanguage;
  variant: TranscriptModelVariant;
}

interface TranscriptModelInspection {
  checksumValid: boolean;
  envOverride: boolean;
  installed: boolean;
  lastError: string | null;
  path: string | null;
  ready: boolean;
  sizeBytes: number | null;
}

function normalizeCommandChunk(chunk: Buffer | string): string {
  return typeof chunk === "string" ? chunk : chunk.toString("utf8");
}

function normalizeText(value: unknown): string | null {
  if (typeof value !== "string") {
    return null;
  }

  const normalized = value.trim();
  return normalized === "" ? null : normalized;
}

function normalizeTarget(value: unknown): TranscriptTargetId | null {
  const normalized = normalizeText(value);
  if (normalized === null) {
    return null;
  }

  if (normalized === "analyze-compose" || normalized === "assistant-opencode-native") {
    return normalized;
  }

  if (normalized.startsWith("room:")) {
    const roomId = normalizeText(normalized.slice("room:".length));
    return roomId === null ? null : `room:${roomId}`;
  }

  return null;
}

function normalizeTranscriptLanguage(value: unknown): TranscriptSupportedLanguage | null {
  const normalized = normalizeText(value);
  if (normalized === null || normalized === "auto") {
    return null;
  }

  return resolveTranscriptSupportedLanguage(normalized);
}

function resolveTranscriptRuntimePaths(): TranscriptRuntimePaths {
  const rootDir = join(Paths.getDataDir(), "transcript");
  return {
    rootDir,
    sourceDir: join(rootDir, "whisper.cpp-src"),
    buildDir: join(rootDir, "whisper.cpp-build"),
    modelDir: join(rootDir, "models"),
    tempDir: join(rootDir, "tmp"),
  };
}

function isInsideDirectory(rootPath: string, candidatePath: string): boolean {
  const resolvedRoot = resolve(rootPath);
  const resolvedCandidate = resolve(candidatePath);
  const relativePath = relative(resolvedRoot, resolvedCandidate);
  return relativePath === "" || (!relativePath.startsWith("..") && !relativePath.startsWith("../"));
}

async function fileExists(filePath: string | null | undefined): Promise<boolean> {
  if (typeof filePath !== "string" || filePath.trim() === "") {
    return false;
  }

  try {
    await access(filePath);
    return true;
  } catch {
    return false;
  }
}

async function isExecutable(filePath: string | null | undefined): Promise<boolean> {
  if (typeof filePath !== "string" || filePath.trim() === "") {
    return false;
  }

  try {
    await access(filePath, fsConstants.X_OK);
    return true;
  } catch {
    return false;
  }
}

async function ensureRuntimeDirectories(paths: TranscriptRuntimePaths): Promise<void> {
  await Promise.all(
    [paths.rootDir, paths.modelDir, paths.tempDir].map(async (target) => {
      await mkdir(target, { recursive: true });
    })
  );
}

async function resolveExecutableOnPath(executableName: string): Promise<string | null> {
  const normalized = normalizeText(executableName);
  if (normalized === null) {
    return null;
  }

  if (normalized.includes("/") || normalized.includes("\\")) {
    return (await isExecutable(normalized)) ? normalized : null;
  }

  const pathValue = process.env["PATH"] ?? "";
  const entries = pathValue
    .split(delimiter)
    .map((entry) => entry.trim())
    .filter((entry) => entry !== "");

  const candidates = entries.map((entry) => join(entry, normalized));
  const checks = await Promise.all(
    candidates.map(async (candidate) => ({
      candidate,
      executable: await isExecutable(candidate),
    }))
  );
  const match = checks.find((entry) => entry.executable === true);
  if (match !== undefined) {
    return match.candidate;
  }

  return null;
}

async function runCommand(
  command: string,
  args: string[],
  cwd: string,
  timeoutMs: number
): Promise<CommandRunResult> {
  return await new Promise((resolvePromise, rejectPromise) => {
    const child = spawn(command, args, {
      cwd,
      stdio: ["ignore", "pipe", "pipe"],
      env: process.env,
    });

    let stdout = "";
    let stderr = "";
    let settled = false;
    let timedOut = false;

    const timeoutId =
      timeoutMs > 0
        ? globalThis.setTimeout(() => {
            timedOut = true;
            child.kill("SIGTERM");
          }, timeoutMs)
        : null;

    child.stdout.on("data", (chunk: Buffer | string) => {
      stdout += normalizeCommandChunk(chunk);
    });
    child.stderr.on("data", (chunk: Buffer | string) => {
      stderr += normalizeCommandChunk(chunk);
    });

    child.on("error", (error) => {
      if (timeoutId !== null) {
        globalThis.clearTimeout(timeoutId);
      }
      if (settled) {
        return;
      }
      settled = true;
      rejectPromise(error);
    });

    child.on("close", (exitCode) => {
      if (timeoutId !== null) {
        globalThis.clearTimeout(timeoutId);
      }
      if (settled) {
        return;
      }
      settled = true;
      resolvePromise({
        exitCode: typeof exitCode === "number" ? exitCode : -1,
        stdout,
        stderr,
        timedOut,
      });
    });
  });
}

function sha1Hex(buffer: Buffer): string {
  return createHash("sha1").update(buffer).digest("hex");
}

async function downloadFile(url: string, destinationPath: string): Promise<void> {
  const response = await fetch(url);
  if (!response.ok || response.body == null) {
    throw new Error(`Download failed with status ${response.status} for ${url}`);
  }

  const buffer = Buffer.from(await response.arrayBuffer());
  await writeFile(destinationPath, buffer);
}

async function readTranscriptSettingsSnapshot(): Promise<TranscriptSettingsSnapshot> {
  try {
    const raw = await readFile(TRANSCRIPT_SETTINGS_PATH, "utf8");
    return JSON.parse(raw) as TranscriptSettingsSnapshot;
  } catch {
    return {};
  }
}

function toRuntimeStatus(
  selection: ResolvedTranscriptSelection,
  state: TranscriptRuntimeStatus["state"],
  overrides: Partial<TranscriptRuntimeStatus> = {}
): TranscriptRuntimeStatus {
  return {
    state,
    ready: state === "ready",
    binaryPath: overrides.binaryPath ?? null,
    modelPath: overrides.modelPath ?? null,
    modelId: overrides.modelId ?? selection.descriptor.modelId,
    modelLanguage: overrides.modelLanguage ?? selection.language,
    appLanguage: overrides.appLanguage ?? selection.appLanguage,
    activeLanguage: overrides.activeLanguage ?? selection.language,
    activeVariant: overrides.activeVariant ?? selection.variant,
    message: overrides.message ?? null,
  };
}

export class TranscriptService {
  private activeEnsurePromises = new Map<
    TranscriptManagedModelId,
    Promise<TranscriptRuntimeStatus>
  >();
  private activeBinaryEnsurePromise: Promise<string> | null = null;
  private activeModelInstallPromises = new Map<
    TranscriptManagedModelId,
    Promise<TranscriptManagedModelStatus>
  >();
  private pathsCache: TranscriptRuntimePaths | null = null;

  private getPaths(): TranscriptRuntimePaths {
    this.pathsCache ??= resolveTranscriptRuntimePaths();
    return this.pathsCache;
  }

  private async resolveSelection(
    request:
      | Pick<TranscriptTranscriptionRequest, "language" | "modelId" | "variant">
      | Pick<TranscriptFileTranscriptionRequest, "language" | "modelId" | "variant">
      | null
      | undefined
  ): Promise<ResolvedTranscriptSelection> {
    const settings = await readTranscriptSettingsSnapshot();
    const appLanguage = normalizeAppLanguage(settings.general?.language);
    const requestedLanguage = normalizeTranscriptLanguage(request?.language);
    const requestedModelId = normalizeTranscriptManagedModelId(request?.modelId);
    const configuredVariant = normalizeTranscriptModelVariant(
      settings.general?.transcriptModelVariant,
      "full"
    );
    const requestedVariant = normalizeTranscriptModelVariant(request?.variant, configuredVariant);
    const initialLanguage = requestedLanguage ?? resolveTranscriptSupportedLanguage(appLanguage);
    const descriptor =
      (requestedModelId !== null ? getTranscriptModelDescriptor(requestedModelId) : null) ??
      getTranscriptModelDescriptor(resolveTranscriptModelId(initialLanguage, requestedVariant));

    if (descriptor === null) {
      throw new Error("Transcript model descriptor could not be resolved.");
    }

    return {
      appLanguage,
      descriptor,
      language: descriptor.englishOnly === true ? "en" : initialLanguage,
      variant: descriptor.variant,
    };
  }

  private async getModelStatus(
    descriptor: TranscriptManagedModelDescriptor
  ): Promise<TranscriptManagedModelStatus> {
    const inspection = await this.inspectModel(descriptor);

    return {
      ...descriptor,
      installed: inspection.installed,
      ready: inspection.ready,
      path: inspection.path,
      sizeBytes: inspection.sizeBytes,
      checksumValid: inspection.checksumValid,
      lastError: inspection.lastError,
    };
  }

  private async resolveBinaryPath(): Promise<string | null> {
    const paths = this.getPaths();
    const envBinaryPath = normalizeText(process.env[TRANSCRIPT_WHISPER_BIN_ENV]);
    if (envBinaryPath !== null && (await isExecutable(envBinaryPath))) {
      return envBinaryPath;
    }

    const bundledCandidates = [
      join(paths.buildDir, "bin", "whisper-cli"),
      join(paths.buildDir, "bin", "main"),
      join(paths.sourceDir, "build", "bin", "whisper-cli"),
      join(paths.sourceDir, "build", "bin", "main"),
    ];

    const checks = await Promise.all(
      bundledCandidates.map(async (candidate) => ({
        candidate,
        executable: await isExecutable(candidate),
      }))
    );
    const match = checks.find((entry) => entry.executable === true);
    if (match !== undefined) {
      return match.candidate;
    }

    return await resolveExecutableOnPath("whisper-cli");
  }

  private async resolveModelPath(modelId: TranscriptManagedModelId): Promise<string | null> {
    const descriptor = getTranscriptModelDescriptor(modelId);
    if (descriptor === null) {
      return null;
    }

    const inspection = await this.inspectModel(descriptor);
    return inspection.ready === true ? inspection.path : null;
  }

  async getStatus(): Promise<TranscriptRuntimeStatus> {
    const selection = await this.resolveSelection(undefined);
    const binaryPath = await this.resolveBinaryPath();
    const modelStatus = await this.getModelStatus(selection.descriptor);
    const modelPath = modelStatus.ready === true ? modelStatus.path : null;

    if (binaryPath !== null && modelPath !== null && modelStatus.ready === true) {
      return toRuntimeStatus(selection, "ready", {
        binaryPath,
        modelPath,
        message: null,
      });
    }

    if (this.activeEnsurePromises.has(selection.descriptor.modelId)) {
      return toRuntimeStatus(selection, "preparing", {
        binaryPath,
        modelPath,
        message: "Preparing the local transcript runtime.",
      });
    }

    return toRuntimeStatus(selection, "missing-runtime", {
      binaryPath,
      modelPath,
      message:
        modelStatus.lastError ??
        `Local transcription needs whisper.cpp and the ${selection.descriptor.label} model before it can run.`,
    });
  }

  async ensureRuntime(
    request:
      | Pick<TranscriptTranscriptionRequest, "language" | "modelId" | "variant">
      | null
      | undefined = undefined
  ): Promise<TranscriptRuntimeStatus> {
    const selection = await this.resolveSelection(request);
    const readyStatus = await this.getStatusForSelection(selection);
    if (readyStatus.ready === true) {
      return readyStatus;
    }

    const activePromise = this.activeEnsurePromises.get(selection.descriptor.modelId);
    if (activePromise !== undefined) {
      return await activePromise;
    }

    const ensurePromise = (async (): Promise<TranscriptRuntimeStatus> => {
      const paths = this.getPaths();

      try {
        await ensureRuntimeDirectories(paths);
        const binaryPath = await this.ensureBinary();
        const modelPath = await this.ensureModel(selection.descriptor.modelId);
        return toRuntimeStatus(selection, "ready", {
          binaryPath,
          modelPath,
          message: null,
        });
      } catch (error) {
        return toRuntimeStatus(selection, "error", {
          binaryPath: await this.resolveBinaryPath(),
          modelPath: await this.resolveModelPath(selection.descriptor.modelId),
          message: error instanceof Error ? error.message : String(error),
        });
      } finally {
        this.activeEnsurePromises.delete(selection.descriptor.modelId);
      }
    })();

    this.activeEnsurePromises.set(selection.descriptor.modelId, ensurePromise);
    return await ensurePromise;
  }

  async listModels(): Promise<TranscriptManagedModelStatus[]> {
    const descriptors = listTranscriptModelCatalog();
    return await Promise.all(
      descriptors.map(async (descriptor) => {
        return await this.getModelStatus(descriptor);
      })
    );
  }

  async installModel(modelId: TranscriptManagedModelId): Promise<TranscriptManagedModelStatus> {
    const descriptor = getTranscriptModelDescriptor(modelId);
    if (descriptor === null) {
      throw new Error(`Unknown transcript model: ${String(modelId)}`);
    }

    const currentStatus = await this.getModelStatus(descriptor);
    if (
      currentStatus.ready === true ||
      currentStatus.path === normalizeText(process.env[TRANSCRIPT_WHISPER_MODEL_ENV])
    ) {
      return currentStatus;
    }

    const activeInstallPromise = this.activeModelInstallPromises.get(modelId);
    if (activeInstallPromise !== undefined) {
      return await activeInstallPromise;
    }

    const installPromise = (async (): Promise<TranscriptManagedModelStatus> => {
      const paths = this.getPaths();
      await ensureRuntimeDirectories(paths);
      await this.ensureBinary();

      if (
        currentStatus.installed === true &&
        currentStatus.ready !== true &&
        currentStatus.path !== null
      ) {
        await this.quarantineManagedModel(descriptor.fileName, currentStatus.path);
      }

      const destinationPath = join(paths.modelDir, descriptor.fileName);
      const tempPath = join(paths.tempDir, `${descriptor.fileName}.download`);

      await rm(tempPath, { force: true });
      await downloadFile(descriptor.downloadUrl, tempPath);

      try {
        const modelBuffer = await readFile(tempPath);
        this.assertModelBuffer(descriptor, modelBuffer, "Downloaded whisper model");
        await rename(tempPath, destinationPath);
      } catch (error) {
        await rm(tempPath, { force: true });
        throw error;
      }

      return await this.getModelStatus(descriptor);
    })();

    this.activeModelInstallPromises.set(modelId, installPromise);
    try {
      return await installPromise;
    } finally {
      this.activeModelInstallPromises.delete(modelId);
    }
  }

  async removeModel(modelId: TranscriptManagedModelId): Promise<TranscriptManagedModelStatus> {
    const descriptor = getTranscriptModelDescriptor(modelId);
    if (descriptor === null) {
      throw new Error(`Unknown transcript model: ${String(modelId)}`);
    }

    await rm(join(this.getPaths().modelDir, descriptor.fileName), { force: true });
    return await this.getModelStatus(descriptor);
  }

  async transcribeLocal(
    request: TranscriptTranscriptionRequest
  ): Promise<TranscriptTranscriptionResult> {
    const audioBase64 = normalizeText(request.audioBase64);
    if (audioBase64 === null) {
      const status = await this.getStatus();
      return {
        success: false,
        status,
        error: "Audio payload is empty.",
      };
    }

    const status = await this.ensureRuntime(request);
    if (status.ready !== true || status.binaryPath === null || status.modelPath === null) {
      return {
        success: false,
        status,
        error: status.message ?? "Local dictation runtime is not ready.",
      };
    }

    const paths = this.getPaths();
    await ensureRuntimeDirectories(paths);

    const requestId = randomUUID();
    const wavPath = join(paths.tempDir, `${requestId}.wav`);
    const outputBase = join(paths.tempDir, `${requestId}-transcript`);
    const transcriptPath = `${outputBase}.txt`;

    try {
      await writeFile(wavPath, Buffer.from(audioBase64, "base64"));
      const transcript = await this.runTranscription({
        binaryPath: status.binaryPath,
        modelPath: status.modelPath,
        audioPath: wavPath,
        outputBase,
        language: status.activeLanguage,
        cwd: paths.tempDir,
      });

      return {
        success: true,
        text: transcript,
        status,
      };
    } catch (error) {
      return {
        success: false,
        status,
        error: error instanceof Error ? error.message : String(error),
      };
    } finally {
      await Promise.all(
        [wavPath, transcriptPath].map(async (target) => {
          await rm(target, { force: true });
        })
      );
    }
  }

  async transcribeFile(
    request: TranscriptFileTranscriptionRequest
  ): Promise<TranscriptFileTranscriptionResult> {
    const audioPath = normalizeText(request.audioPath);
    if (audioPath === null) {
      const status = await this.getStatus();
      return {
        success: false,
        status,
        error: "Audio file path is empty.",
      };
    }

    const roomId = normalizeText(request.roomId);
    if (roomId === null) {
      const status = await this.getStatus();
      return {
        success: false,
        status,
        error: "Managed file transcription requires a roomId.",
      };
    }

    let managedAudioPath: string;
    let outputBasePath: string;

    try {
      managedAudioPath = this.ensureManagedRoomPath(roomId, audioPath);
      outputBasePath = this.ensureManagedRoomPath(
        roomId,
        normalizeText(request.outputBasePath) ??
          `${managedAudioPath.replace(/\.[^.]+$/, "")}-transcript`
      );
    } catch (error) {
      const status = await this.getStatus();
      return {
        success: false,
        status,
        error: error instanceof Error ? error.message : String(error),
      };
    }

    const status = await this.ensureRuntime(request);
    if (status.ready !== true || status.binaryPath === null || status.modelPath === null) {
      return {
        success: false,
        status,
        error: status.message ?? "Transcript runtime is not ready.",
      };
    }

    try {
      const transcript = await this.runTranscription({
        binaryPath: status.binaryPath,
        modelPath: status.modelPath,
        audioPath: managedAudioPath,
        outputBase: outputBasePath,
        language: status.activeLanguage,
        cwd: this.getPaths().tempDir,
      });

      return {
        success: true,
        text: transcript,
        transcriptPath: `${outputBasePath}.txt`,
        status,
      };
    } catch (error) {
      return {
        success: false,
        status,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  submitIngress(request: TranscriptSubmitIngressRequest): TranscriptSubmitIngressResult {
    const text = normalizeText(request.text);
    if (text === null) {
      return {
        success: false,
        error: "Transcript text is empty.",
      };
    }

    const payload: TranscriptIngressPayload = {
      requestId: randomUUID(),
      createdAt: new Date().toISOString(),
      text,
      source: request.source === "android-bridge" ? "android-bridge" : "synthetic-test",
      target: normalizeTarget(request.target),
      isFinal: request.isFinal !== false,
      metadata: request.metadata ?? null,
    };

    for (const window of BrowserWindow.getAllWindows()) {
      try {
        window.webContents.send(TRANSCRIPT_INGRESS_CHANNEL, payload);
      } catch {
        // NOTE: Transcript fan-out is best-effort so one detached window cannot abort the ingress.
      }
    }

    return {
      success: true,
      payload,
    };
  }

  private async getStatusForSelection(
    selection: ResolvedTranscriptSelection
  ): Promise<TranscriptRuntimeStatus> {
    const binaryPath = await this.resolveBinaryPath();
    const modelStatus = await this.getModelStatus(selection.descriptor);
    const modelPath = modelStatus.ready === true ? modelStatus.path : null;

    if (binaryPath !== null && modelPath !== null && modelStatus.ready === true) {
      return toRuntimeStatus(selection, "ready", {
        binaryPath,
        modelPath,
        message: null,
      });
    }

    if (this.activeEnsurePromises.has(selection.descriptor.modelId)) {
      return toRuntimeStatus(selection, "preparing", {
        binaryPath,
        modelPath,
        message: "Preparing the local transcript runtime.",
      });
    }

    return toRuntimeStatus(selection, "missing-runtime", {
      binaryPath,
      modelPath,
      message:
        modelStatus.lastError ??
        `Local transcription needs whisper.cpp and the ${selection.descriptor.label} model before it can run.`,
    });
  }

  private async ensureBinary(): Promise<string> {
    const existingBinary = await this.resolveBinaryPath();
    if (existingBinary !== null) {
      return existingBinary;
    }

    if (this.activeBinaryEnsurePromise !== null) {
      return await this.activeBinaryEnsurePromise;
    }

    const ensurePromise = (async (): Promise<string> => {
      const paths = this.getPaths();
      const buildTools = await Promise.all(
        ["git", "cmake", "make", "g++"].map(async (toolName) => ({
          toolName,
          path: await resolveExecutableOnPath(toolName),
        }))
      );
      const missingTools = buildTools
        .filter((entry) => entry.path === null)
        .map((entry) => entry.toolName);

      if (missingTools.length > 0) {
        throw new Error(
          `whisper.cpp build prerequisites are missing: ${missingTools.join(", ")}. Install them or set ${TRANSCRIPT_WHISPER_BIN_ENV}.`
        );
      }

      if ((await fileExists(paths.sourceDir)) !== true) {
        const cloneResult = await runCommand(
          "git",
          [
            "clone",
            "--depth",
            "1",
            "--branch",
            TRANSCRIPT_WHISPER_TAG,
            TRANSCRIPT_WHISPER_REPO_URL,
            paths.sourceDir,
          ],
          Paths.getDataDir(),
          15 * 60 * 1000
        );
        if (cloneResult.exitCode !== 0) {
          throw new Error(
            normalizeText(cloneResult.stderr) ??
              normalizeText(cloneResult.stdout) ??
              "whisper.cpp clone failed."
          );
        }
      }

      const configureResult = await runCommand(
        "cmake",
        [
          "-S",
          paths.sourceDir,
          "-B",
          paths.buildDir,
          "-DCMAKE_BUILD_TYPE=Release",
          "-DWHISPER_BUILD_TESTS=OFF",
          "-DWHISPER_BUILD_SERVER=OFF",
        ],
        paths.rootDir,
        20 * 60 * 1000
      );
      if (configureResult.exitCode !== 0) {
        throw new Error(
          normalizeText(configureResult.stderr) ??
            normalizeText(configureResult.stdout) ??
            "whisper.cpp configure step failed."
        );
      }

      const buildResult = await runCommand(
        "cmake",
        ["--build", paths.buildDir, "--config", "Release", "-j2", "--target", "whisper-cli"],
        paths.rootDir,
        60 * 60 * 1000
      );
      if (buildResult.exitCode !== 0) {
        throw new Error(
          normalizeText(buildResult.stderr) ??
            normalizeText(buildResult.stdout) ??
            "whisper.cpp build failed."
        );
      }

      const binaryPath = await this.resolveBinaryPath();
      if (binaryPath === null) {
        throw new Error("whisper.cpp build finished but whisper-cli could not be resolved.");
      }

      return binaryPath;
    })();

    this.activeBinaryEnsurePromise = ensurePromise;
    try {
      return await ensurePromise;
    } finally {
      this.activeBinaryEnsurePromise = null;
    }
  }

  private async ensureModel(modelId: TranscriptManagedModelId): Promise<string> {
    const descriptor = getTranscriptModelDescriptor(modelId);
    if (descriptor === null) {
      throw new Error(`Unknown transcript model: ${String(modelId)}`);
    }

    const currentStatus = await this.getModelStatus(descriptor);
    if (currentStatus.path !== null && currentStatus.ready === true) {
      return currentStatus.path;
    }
    if (
      currentStatus.installed === true &&
      currentStatus.ready !== true &&
      currentStatus.path !== null
    ) {
      await this.quarantineManagedModel(descriptor.fileName, currentStatus.path);
    }

    const installedModel = await this.installModel(modelId);
    if (installedModel.path === null || installedModel.ready !== true) {
      throw new Error(`Transcript model ${modelId} is not ready after installation.`);
    }
    return installedModel.path;
  }

  private assertModelBuffer(
    descriptor: TranscriptManagedModelDescriptor,
    modelBuffer: Buffer,
    contextLabel: string
  ): void {
    const actualSha1 = sha1Hex(modelBuffer);
    if (actualSha1 !== descriptor.expectedSha1) {
      throw new Error(
        `${contextLabel} checksum mismatch. Expected ${descriptor.expectedSha1}, got ${actualSha1}.`
      );
    }

    if (descriptor.expectedBytes !== null && modelBuffer.byteLength !== descriptor.expectedBytes) {
      throw new Error(
        `${contextLabel} size mismatch. Expected ${descriptor.expectedBytes}, got ${modelBuffer.byteLength}.`
      );
    }
  }

  private async inspectModel(
    descriptor: TranscriptManagedModelDescriptor
  ): Promise<TranscriptModelInspection> {
    const envModelPath = normalizeText(process.env[TRANSCRIPT_WHISPER_MODEL_ENV]);
    if (envModelPath !== null && (await fileExists(envModelPath))) {
      const envStats = await stat(envModelPath);
      return {
        checksumValid: true,
        envOverride: true,
        installed: true,
        lastError: null,
        path: envModelPath,
        ready: true,
        sizeBytes: envStats.size,
      };
    }

    const modelPath = join(this.getPaths().modelDir, descriptor.fileName);
    if ((await fileExists(modelPath)) !== true) {
      return {
        checksumValid: false,
        envOverride: false,
        installed: false,
        lastError: null,
        path: modelPath,
        ready: false,
        sizeBytes: null,
      };
    }

    const modelBuffer = await readFile(modelPath);

    try {
      this.assertModelBuffer(descriptor, modelBuffer, "Stored whisper model");
      return {
        checksumValid: true,
        envOverride: false,
        installed: true,
        lastError: null,
        path: modelPath,
        ready: true,
        sizeBytes: modelBuffer.byteLength,
      };
    } catch (error) {
      return {
        checksumValid: false,
        envOverride: false,
        installed: true,
        lastError: error instanceof Error ? error.message : String(error),
        path: modelPath,
        ready: false,
        sizeBytes: modelBuffer.byteLength,
      };
    }
  }

  private async quarantineManagedModel(fileName: string, modelPath: string): Promise<void> {
    const paths = this.getPaths();
    if (isInsideDirectory(paths.modelDir, modelPath) !== true) {
      return;
    }

    await ensureRuntimeDirectories(paths);
    const quarantinePath = join(paths.tempDir, `${randomUUID()}-${fileName}.corrupt`);

    try {
      await rename(modelPath, quarantinePath);
    } catch {
      await rm(modelPath, { force: true });
    }
  }

  private async runTranscription(options: {
    binaryPath: string;
    modelPath: string;
    audioPath: string;
    outputBase: string;
    language: TranscriptSupportedLanguage;
    cwd: string;
  }): Promise<string> {
    const runResult = await runCommand(
      options.binaryPath,
      [
        "-m",
        options.modelPath,
        "-f",
        options.audioPath,
        "-l",
        options.language,
        "-otxt",
        "-of",
        options.outputBase,
      ],
      options.cwd,
      25 * 60 * 1000
    );

    if (runResult.exitCode !== 0) {
      throw new Error(
        normalizeText(runResult.stderr) ??
          normalizeText(runResult.stdout) ??
          "whisper.cpp transcription failed."
      );
    }

    const transcript = normalizeText(await readFile(`${options.outputBase}.txt`, "utf8"));
    if (transcript === null) {
      throw new Error("whisper.cpp returned an empty transcript.");
    }

    return transcript;
  }

  private ensureManagedRoomPath(roomId: string, candidatePath: string): string {
    const managedRoot = Paths.getRoomStorageDir(roomId);
    const resolvedPath = resolve(candidatePath);
    if (isInsideDirectory(managedRoot, resolvedPath) !== true) {
      throw new Error(
        `Transcript file access is limited to managed room paths under ${managedRoot}.`
      );
    }
    return resolvedPath;
  }
}

export const transcriptService = new TranscriptService();
export { TRANSCRIPT_INGRESS_CHANNEL };
