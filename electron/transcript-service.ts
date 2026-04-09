import { BrowserWindow } from "electron";
import { access, mkdir, readFile, rename, rm, writeFile } from "fs/promises";
import { constants as fsConstants } from "fs";
import { spawn } from "child_process";
import { createHash, randomUUID } from "crypto";
import { join, delimiter } from "path";
import { Paths } from "./paths.ts";
import type {
  TranscriptIngressPayload,
  TranscriptRuntimeStatus,
  TranscriptSubmitIngressRequest,
  TranscriptSubmitIngressResult,
  TranscriptTargetId,
  TranscriptTranscriptionRequest,
  TranscriptTranscriptionResult,
} from "../src/types/transcript.ts";

const TRANSCRIPT_INGRESS_CHANNEL = "transcript:ingress";
const TRANSCRIPT_DEFAULT_MODEL_ID = "base";
const TRANSCRIPT_DEFAULT_MODEL_LANGUAGE = "auto";
const TRANSCRIPT_DEFAULT_MODEL_FILE = "ggml-base.bin";
const TRANSCRIPT_DEFAULT_MODEL_URL =
  "https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-base.bin";
const TRANSCRIPT_DEFAULT_MODEL_SHA1 = "465707469ff3a37a2b9b8d8f89f2f99de7299dac";
const TRANSCRIPT_WHISPER_REPO_URL = "https://github.com/ggml-org/whisper.cpp.git";
const TRANSCRIPT_WHISPER_TAG = "v1.8.4";
const TRANSCRIPT_WHISPER_BIN_ENV = "HAYALET_EV_TRANSCRIPT_WHISPER_BIN";
const TRANSCRIPT_WHISPER_MODEL_ENV = "HAYALET_EV_TRANSCRIPT_WHISPER_MODEL";

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
  return value === "analyze-compose" || value === "assistant-opencode-native" ? value : null;
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
  return await new Promise((resolve, reject) => {
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
      reject(error);
    });

    child.on("close", (exitCode) => {
      if (timeoutId !== null) {
        globalThis.clearTimeout(timeoutId);
      }
      if (settled) {
        return;
      }
      settled = true;
      resolve({
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

function toRuntimeStatus(
  state: TranscriptRuntimeStatus["state"],
  overrides: Partial<TranscriptRuntimeStatus> = {}
): TranscriptRuntimeStatus {
  return {
    state,
    ready: state === "ready",
    binaryPath: overrides.binaryPath ?? null,
    modelPath: overrides.modelPath ?? null,
    modelId: overrides.modelId ?? TRANSCRIPT_DEFAULT_MODEL_ID,
    modelLanguage: overrides.modelLanguage ?? TRANSCRIPT_DEFAULT_MODEL_LANGUAGE,
    message: overrides.message ?? null,
  };
}

export class TranscriptService {
  private activeEnsurePromise: Promise<TranscriptRuntimeStatus> | null = null;
  private pathsCache: TranscriptRuntimePaths | null = null;

  private getPaths(): TranscriptRuntimePaths {
    this.pathsCache ??= resolveTranscriptRuntimePaths();
    return this.pathsCache;
  }

  async getStatus(): Promise<TranscriptRuntimeStatus> {
    const binaryPath = await this.resolveBinaryPath();
    const modelPath = await this.resolveModelPath();

    if (binaryPath !== null && modelPath !== null) {
      return toRuntimeStatus("ready", {
        ready: true,
        binaryPath,
        modelPath,
        message: null,
      });
    }

    if (this.activeEnsurePromise !== null) {
      return toRuntimeStatus("preparing", {
        binaryPath,
        modelPath,
        message: "Preparing the local dictation runtime.",
      });
    }

    return toRuntimeStatus("missing-runtime", {
      binaryPath,
      modelPath,
      message:
        "Local dictation needs whisper.cpp and the multilingual base model before transcription can run.",
    });
  }

  async ensureRuntime(): Promise<TranscriptRuntimeStatus> {
    const readyStatus = await this.getStatus();
    if (readyStatus.ready === true) {
      return readyStatus;
    }

    if (this.activeEnsurePromise !== null) {
      return await this.activeEnsurePromise;
    }

    this.activeEnsurePromise = (async (): Promise<TranscriptRuntimeStatus> => {
      const paths = this.getPaths();

      try {
        await ensureRuntimeDirectories(paths);
        const binaryPath = await this.ensureBinary();
        const modelPath = await this.ensureModel();
        return toRuntimeStatus("ready", {
          ready: true,
          binaryPath,
          modelPath,
          message: null,
        });
      } catch (error) {
        return toRuntimeStatus("error", {
          binaryPath: await this.resolveBinaryPath(),
          modelPath: await this.resolveModelPath(),
          message: error instanceof Error ? error.message : String(error),
        });
      } finally {
        this.activeEnsurePromise = null;
      }
    })();

    return await this.activeEnsurePromise;
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

    const status = await this.ensureRuntime();
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
    const language = normalizeText(request.language) ?? TRANSCRIPT_DEFAULT_MODEL_LANGUAGE;

    try {
      await writeFile(wavPath, Buffer.from(audioBase64, "base64"));

      const runResult = await runCommand(
        status.binaryPath,
        ["-m", status.modelPath, "-f", wavPath, "-l", language, "-otxt", "-of", outputBase],
        paths.tempDir,
        25 * 60 * 1000
      );

      if (runResult.exitCode !== 0) {
        throw new Error(
          normalizeText(runResult.stderr) ??
            normalizeText(runResult.stdout) ??
            "whisper.cpp transcription failed."
        );
      }

      const transcript = normalizeText(await readFile(transcriptPath, "utf8"));
      if (transcript === null) {
        throw new Error("whisper.cpp returned an empty transcript.");
      }

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

  private async resolveModelPath(): Promise<string | null> {
    const paths = this.getPaths();
    const envModelPath = normalizeText(process.env[TRANSCRIPT_WHISPER_MODEL_ENV]);
    if (envModelPath !== null && (await fileExists(envModelPath))) {
      return envModelPath;
    }

    const defaultModelPath = join(paths.modelDir, TRANSCRIPT_DEFAULT_MODEL_FILE);
    return (await fileExists(defaultModelPath)) ? defaultModelPath : null;
  }

  private async ensureBinary(): Promise<string> {
    const paths = this.getPaths();
    const existingBinary = await this.resolveBinaryPath();
    if (existingBinary !== null) {
      return existingBinary;
    }

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
  }

  private async ensureModel(): Promise<string> {
    const paths = this.getPaths();
    const existingModelPath = await this.resolveModelPath();
    if (existingModelPath !== null) {
      return existingModelPath;
    }

    await ensureRuntimeDirectories(paths);
    const destinationPath = join(paths.modelDir, TRANSCRIPT_DEFAULT_MODEL_FILE);
    const tempPath = join(paths.tempDir, `${TRANSCRIPT_DEFAULT_MODEL_FILE}.download`);

    await rm(tempPath, { force: true });
    await downloadFile(TRANSCRIPT_DEFAULT_MODEL_URL, tempPath);

    const modelBuffer = await readFile(tempPath);
    const actualSha1 = sha1Hex(modelBuffer);
    if (actualSha1 !== TRANSCRIPT_DEFAULT_MODEL_SHA1) {
      await rm(tempPath, { force: true });
      throw new Error(
        `Downloaded whisper model checksum mismatch. Expected ${TRANSCRIPT_DEFAULT_MODEL_SHA1}, got ${actualSha1}.`
      );
    }

    await rename(tempPath, destinationPath);
    return destinationPath;
  }
}

export const transcriptService = new TranscriptService();
export { TRANSCRIPT_INGRESS_CHANNEL };
