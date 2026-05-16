import { createHash, randomUUID } from "crypto";
import { spawn } from "child_process";
import { createServer, type IncomingMessage, type Server, type ServerResponse } from "http";
import { constants as fsConstants, createReadStream } from "fs";
import { access, mkdir, readdir, readFile, rename, rm, stat, writeFile } from "fs/promises";
import { basename, extname, join } from "path";
import { BrowserWindow } from "electron";
import { Paths } from "./paths.ts";
import { loadSettings } from "./settings-manager.ts";
import { transcriptService } from "./transcript-service.ts";
import { normalizeAppLanguage } from "../shared/i18n/locale.js";
import {
  DEFAULT_AMBIENT_ACTIVE_WINDOW_MS,
  DEFAULT_AMBIENT_SILENCE_TIMEOUT_MS,
  DEFAULT_AMBIENT_WAKE_PHRASES,
  normalizeAmbientDurationMs,
  normalizeAmbientWakePhrases,
} from "../shared/capture/ambient-defaults.js";
import {
  getTranscriptModelDescriptor,
  normalizeTranscriptModelVariant,
  resolveTranscriptModelId,
  resolveTranscriptSupportedLanguage,
} from "../shared/transcript/model-catalog.js";
import { inspectCompanionArtifactCache } from "../scripts/lib/android-companion-artifact.mjs";
import type {
  CaptureActionOutcome,
  CaptureAmbientListenerOptions,
  CaptureAmbientStatusPayload,
  CaptureAndroidArtifactStatus,
  CaptureAndroidCompanionState,
  CaptureAndroidDeviceConnectionState,
  CaptureAndroidDeviceStatus,
  CaptureAndroidHostState,
  CaptureAndroidPermissionState,
  CaptureAndroidPermissionStatus,
  CaptureAndroidStatus,
  CaptureAnalyzePreviewVideoStatus,
  CaptureAnalyzeSessionState,
  CaptureCompanionCommandEnvelope,
  CaptureCompanionCommandKind,
  CaptureCompanionAmbientProfile,
  CaptureCompanionCommandProfile,
  CaptureCompanionTranscriptModelProfile,
  CaptureDictationStatusPayload,
  CaptureImportedAsset,
  CaptureMediaIngressPayload,
  CaptureServiceStatus,
} from "../src/types/capture.ts";
import type {
  TranscriptManagedModelId,
  TranscriptSupportedLanguage,
  TranscriptTargetId,
} from "../src/types/transcript.ts";

const CAPTURE_ADB_TIMEOUT_MS = 12_000;
const CAPTURE_ANDROID_COMPANION_PACKAGE = "com.hayaletev.androidcompanion";
const CAPTURE_ANDROID_MAIN_ACTIVITY = "com.hayaletev.androidcompanion/.MainActivity";
const CAPTURE_BRIDGE_PORT = 48_561;
const CAPTURE_ANALYZE_TARGET = "analyze-compose" satisfies TranscriptTargetId;
const CAPTURE_MEDIA_INGRESS_CHANNEL = "capture:media-ingress";
const CAPTURE_DICTATION_STATUS_CHANNEL = "capture:dictation-status";
const CAPTURE_AMBIENT_STATUS_CHANNEL = "capture:ambient-status";
const CAPTURE_SESSION_STALE_MS = 20_000;
const CAPTURE_COMPANION_DIAGNOSTICS_MAX_LOG_ENTRIES = 400;
const CAPTURE_COMPANION_DIAGNOSTICS_MAX_TEXT_CHARS = 220_000;
const CAPTURE_ADB_SHUTDOWN_TIMEOUT_MS = 5_000;
const CAPTURE_SCRCPY_CAMERA_SIZE = "640x480";
const CAPTURE_SCRCPY_CAMERA_FPS = 30;
const CAPTURE_SCRCPY_STARTUP_GRACE_MS = 1_200;
const CAPTURE_SCRCPY_STOP_TIMEOUT_MS = 2_500;
const CAPTURE_SCRCPY_LOG_LIMIT = 24;
const CAPTURE_SCRCPY_V4L2_DEFAULT_DEVICE = "/dev/video42";
const CAPTURE_SCRCPY_V4L2_LABEL = "Hayalet Ev Camera Feed";
const CAPTURE_SCRCPY_V4L2_BUFFER_MS = 0;
const CAPTURE_SCRCPY_V4L2_ENV_DEVICE = "HAYALET_SCRCPY_V4L2_DEVICE";

const CAPTURE_VOSK_MODEL_DESCRIPTORS: Record<
  TranscriptSupportedLanguage,
  DirectCompanionModelDescriptor
> = {
  tr: {
    backend: "vosk",
    modelId: "vosk-model-small-tr-0.3",
    fileName: "vosk-model-small-tr-0.3.zip",
    downloadUrl: "https://alphacephei.com/vosk/models/vosk-model-small-tr-0.3.zip",
    expectedSha1: "1bc2391ea03d6091c39c4ff42b627c811501d41f",
    expectedBytes: 36_855_784,
    language: "tr",
    variant: "light",
    archiveFormat: "zip-directory",
    installSource: "direct-download",
  },
  en: {
    backend: "vosk",
    modelId: "vosk-model-small-en-us-0.15",
    fileName: "vosk-model-small-en-us-0.15.zip",
    downloadUrl: "https://alphacephei.com/vosk/models/vosk-model-small-en-us-0.15.zip",
    expectedSha1: "4b5523d1db7688e31e44608cf96cdad92e4603e7",
    expectedBytes: 41_205_931,
    language: "en",
    variant: "light",
    archiveFormat: "zip-directory",
    installSource: "direct-download",
  },
};

interface CommandResult {
  exitCode: number;
  stdout: string;
  stderr: string;
  timedOut: boolean;
}

interface CompanionBuildScriptEvent {
  type: "progress" | "plan" | "result" | "error";
  ok?: boolean;
  needsConfirmation?: boolean;
  message?: string;
  progress?: number;
  details?: string[];
}

interface CompanionManifestRecord {
  applicationId?: unknown;
  mainActivity?: unknown;
  foregroundService?: unknown;
  versionName?: unknown;
  versionCode?: unknown;
  bridgePort?: unknown;
  commandPollIntervalMs?: unknown;
  previewMode?: unknown;
}

interface CompanionBridgeSessionRecord {
  deviceId: string;
  appVersion: string | null;
  permissions: CaptureAndroidPermissionStatus;
  previewActive: boolean;
  target: string | null;
  transport: string | null;
  lastSeenAt: number;
}

type PendingBridgeCommand = CaptureCompanionCommandEnvelope;
let adbServerTouchedByCaptureService = false;

interface ScrcpyCameraFeedSession {
  process: ReturnType<typeof spawn>;
  deviceId: string;
  requestId: string;
  previewVideo: CaptureAnalyzePreviewVideoStatus;
  startedAt: number;
  stopping: boolean;
  logs: string[];
}

interface CaptureIngressPaths {
  rootDir: string;
  analyzeInboxDir: string;
  analyzeStagedDir: string;
}

interface AnalyzeIngressSnapshot {
  pendingInboxCount: number;
  latestStagedAsset: CaptureImportedAsset | null;
}

interface CompanionDiagnosticsStateEntry {
  key: string;
  value: string;
}

interface CompanionDiagnosticsLogEntry {
  timestampMs: number | null;
  level: string;
  category: string;
  message: string;
  details: string | null;
}

interface CompanionDiagnosticsShadowSnapshot {
  deviceId: string;
  generatedAtMs: number | null;
  receivedAtMs: number;
  stateEntries: CompanionDiagnosticsStateEntry[];
  logEntries: CompanionDiagnosticsLogEntry[];
  text: string;
}

interface ResolvedCaptureSettings {
  preferredDeviceId: string | null;
  defaultLens: "back" | "front";
  photoQuality: "high" | "balanced";
  attachMode: "manual-sync" | "auto-stage";
  commandConfirmation: "toast" | "none";
  androidDictationBackend: CaptureCompanionTranscriptModelProfile["backend"];
  androidCompanionEnabled: boolean;
  ambientWakePhrases: string[];
  ambientActiveWindowMs: number;
  ambientSilenceTimeoutMs: number;
}

type WhisperCompanionModelDescriptor = CaptureCompanionTranscriptModelProfile & {
  downloadUrl: string;
  installSource: "transcript-service";
  modelId: TranscriptManagedModelId;
};

type DirectCompanionModelDescriptor = CaptureCompanionTranscriptModelProfile & {
  downloadUrl: string;
  installSource: "direct-download";
};

type CompanionTranscriptModelDownloadDescriptor =
  | WhisperCompanionModelDescriptor
  | DirectCompanionModelDescriptor;

function normalizeCommandChunk(chunk: Buffer | string): string {
  return typeof chunk === "string" ? chunk : chunk.toString("utf8");
}

function normalizeAndroidDictationBackend(
  value: unknown
): CaptureCompanionTranscriptModelProfile["backend"] {
  void value;
  return "vosk";
}

function getCaptureProjectRoot(): string {
  return Paths.getProjectRoot();
}

function resolveCompanionTranscriptModelPaths(): { modelDir: string; tempDir: string } {
  const rootDir = join(Paths.getDataDir(), "transcript", "android-models");
  return {
    modelDir: rootDir,
    tempDir: join(rootDir, "tmp"),
  };
}

function getCompanionManifestPath(): string {
  return join(
    getCaptureProjectRoot(),
    "android-companion",
    "app",
    "src",
    "main",
    "assets",
    "companion-manifest.json"
  );
}

function getCompanionArtifactDir(): string {
  return join(getCaptureProjectRoot(), "dist", "android-companion");
}

function getCompanionSourceRoot(): string {
  return join(getCaptureProjectRoot(), "android-companion");
}

function getCompanionArtifactManifestPath(): string {
  return join(getCompanionArtifactDir(), "manifest.json");
}

function getCompanionWrapperPath(): string {
  return process.platform === "win32"
    ? join(getCaptureProjectRoot(), "android-companion", "gradlew.bat")
    : join(getCaptureProjectRoot(), "android-companion", "gradlew");
}

function getCompanionApkPath(): string {
  return join(
    getCaptureProjectRoot(),
    "android-companion",
    "app",
    "build",
    "outputs",
    "apk",
    "debug",
    "app-debug.apk"
  );
}

function getCompanionBuildScriptPath(): string {
  return join(getCaptureProjectRoot(), "scripts", "build-android-companion.mjs");
}

function normalizeText(value: unknown): string | null {
  if (typeof value !== "string") {
    return null;
  }

  const normalized = value.trim();
  return normalized === "" ? null : normalized;
}

function normalizeTranscriptTarget(value: unknown): TranscriptTargetId | null {
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

function normalizeAmbientStatusState(value: unknown): CaptureAmbientStatusPayload["status"] | null {
  const normalized = normalizeText(value);
  if (normalized === null) {
    return null;
  }

  switch (normalized) {
    case "started":
    case "wake-detected":
    case "capturing":
    case "transcribing":
    case "done":
    case "stopped":
    case "failed":
      return normalized;
    default:
      return null;
  }
}

function normalizeModelLabel(value: string | null): string | null {
  if (value === null) {
    return null;
  }

  return value.replaceAll("_", " ");
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && Array.isArray(value) === false;
}

function normalizeFiniteNumber(value: unknown): number | null {
  if (typeof value !== "number" || Number.isFinite(value) === false) {
    return null;
  }

  return value;
}

function normalizeFreeformText(value: unknown, maxChars: number): string | null {
  if (typeof value !== "string") {
    return null;
  }

  const truncated = value.slice(0, maxChars).trimEnd();
  return truncated.trim() === "" ? null : truncated;
}

function sanitizeCompanionDiagnosticsPathSegment(value: string): string {
  const normalized = value.replace(/[^a-zA-Z0-9._-]+/g, "_").slice(0, 96);
  return normalized === "" ? "android-companion" : normalized;
}

function normalizeCompanionDiagnosticsStateEntries(
  value: unknown
): CompanionDiagnosticsStateEntry[] {
  if (Array.isArray(value) === false) {
    return [];
  }

  return value.flatMap((item): CompanionDiagnosticsStateEntry[] => {
    if (isRecord(item) === false) {
      return [];
    }

    const key = normalizeText(item["key"]);
    const entryValue = normalizeFreeformText(item["value"], 8_000);
    return key === null || entryValue === null ? [] : [{ key, value: entryValue }];
  });
}

function normalizeCompanionDiagnosticsLogEntries(value: unknown): CompanionDiagnosticsLogEntry[] {
  if (Array.isArray(value) === false) {
    return [];
  }

  return value
    .slice(-CAPTURE_COMPANION_DIAGNOSTICS_MAX_LOG_ENTRIES)
    .flatMap((item): CompanionDiagnosticsLogEntry[] => {
      if (isRecord(item) === false) {
        return [];
      }

      const message = normalizeFreeformText(item["message"], 16_000);
      if (message === null) {
        return [];
      }

      return [
        {
          timestampMs: normalizeFiniteNumber(item["timestampMs"]),
          level: normalizeText(item["level"]) ?? "INFO",
          category: normalizeText(item["category"]) ?? "general",
          message,
          details: normalizeFreeformText(item["details"], 32_000),
        },
      ];
    });
}

function resolveCaptureSettings(settings: unknown): ResolvedCaptureSettings {
  const capture = isRecord(settings) && isRecord(settings["capture"]) ? settings["capture"] : null;
  const defaults = capture && isRecord(capture["defaults"]) ? capture["defaults"] : null;
  const providers = capture && isRecord(capture["providers"]) ? capture["providers"] : null;
  const voiceCommands =
    isRecord(settings) && isRecord(settings["voiceCommands"]) ? settings["voiceCommands"] : null;
  const ambient =
    voiceCommands && isRecord(voiceCommands["ambient"]) ? voiceCommands["ambient"] : null;

  return {
    preferredDeviceId: normalizeText(defaults?.["preferredDeviceId"]),
    defaultLens: defaults?.["defaultLens"] === "front" ? "front" : "back",
    photoQuality: defaults?.["photoQuality"] === "balanced" ? "balanced" : "high",
    attachMode: defaults?.["attachMode"] === "auto-stage" ? "auto-stage" : "manual-sync",
    commandConfirmation: defaults?.["commandConfirmation"] === "none" ? "none" : "toast",
    androidDictationBackend: normalizeAndroidDictationBackend(
      defaults?.["androidDictationBackend"]
    ),
    androidCompanionEnabled: providers?.["androidCompanionEnabled"] !== false,
    ambientWakePhrases: normalizeAmbientWakePhrases(
      ambient?.["wakePhrases"],
      DEFAULT_AMBIENT_WAKE_PHRASES
    ),
    ambientActiveWindowMs: normalizeAmbientDurationMs(
      ambient?.["activeWindowMs"],
      DEFAULT_AMBIENT_ACTIVE_WINDOW_MS,
      { min: 1_000, max: 30_000 }
    ),
    ambientSilenceTimeoutMs: normalizeAmbientDurationMs(
      ambient?.["silenceTimeoutMs"],
      DEFAULT_AMBIENT_SILENCE_TIMEOUT_MS,
      { min: 300, max: 10_000 }
    ),
  };
}

function resolveAmbientCommandProfile(
  settings: ResolvedCaptureSettings,
  options: CaptureAmbientListenerOptions | undefined
): CaptureCompanionAmbientProfile {
  return {
    wakePhrases: normalizeAmbientWakePhrases(options?.wakePhrases, settings.ambientWakePhrases),
    activeWindowMs: normalizeAmbientDurationMs(
      options?.activeWindowMs,
      settings.ambientActiveWindowMs,
      { min: 1_000, max: 30_000 }
    ),
    silenceTimeoutMs: normalizeAmbientDurationMs(
      options?.silenceTimeoutMs,
      settings.ambientSilenceTimeoutMs,
      { min: 300, max: 10_000 }
    ),
  };
}

function buildCompanionCommandProfile(
  settings: ResolvedCaptureSettings,
  transcriptModel: CaptureCompanionTranscriptModelProfile | null
): CaptureCompanionCommandProfile {
  return {
    defaultLens: settings.defaultLens,
    photoQuality: settings.photoQuality,
    attachMode: settings.attachMode,
    commandConfirmation: settings.commandConfirmation,
    androidDictationBackend: settings.androidDictationBackend,
    transcriptModel,
  };
}

function resolveCompanionTranscriptModelProfile(
  settings: unknown,
  captureSettings: ResolvedCaptureSettings
): CaptureCompanionTranscriptModelProfile {
  const appSettings = isRecord(settings) ? settings : {};
  const general = isRecord(appSettings["general"]) ? appSettings["general"] : {};
  const capture = isRecord(appSettings["capture"]) ? appSettings["capture"] : {};
  const defaults = isRecord(capture["defaults"]) ? capture["defaults"] : {};
  const appLanguage = normalizeAppLanguage(general["language"]);
  const language = resolveTranscriptSupportedLanguage(appLanguage);
  if (captureSettings.androidDictationBackend === "vosk") {
    const descriptor = CAPTURE_VOSK_MODEL_DESCRIPTORS[language];
    return {
      backend: descriptor.backend,
      modelId: descriptor.modelId,
      fileName: descriptor.fileName,
      expectedSha1: descriptor.expectedSha1,
      expectedBytes: descriptor.expectedBytes,
      language: descriptor.language,
      variant: descriptor.variant,
      archiveFormat: descriptor.archiveFormat,
    };
  }

  const variant = normalizeTranscriptModelVariant(
    defaults["androidTranscriptModelVariant"],
    "light"
  );
  const descriptor = getTranscriptModelDescriptor(resolveTranscriptModelId(language, variant));
  if (descriptor === null) {
    throw new Error("Android transcript model descriptor could not be resolved.");
  }

  return {
    backend: "whisper.cpp",
    modelId: descriptor.modelId,
    fileName: descriptor.fileName,
    expectedSha1: descriptor.expectedSha1,
    expectedBytes: descriptor.expectedBytes,
    language: descriptor.englishOnly === true ? "en" : language,
    variant: descriptor.variant,
    archiveFormat: "file",
  };
}

function findTranscriptDescriptorByFileName(
  fileName: string
): CompanionTranscriptModelDownloadDescriptor | null {
  const voskDescriptor =
    Object.values(CAPTURE_VOSK_MODEL_DESCRIPTORS).find(
      (descriptor) => descriptor.fileName === fileName
    ) ?? null;
  if (voskDescriptor !== null) {
    return voskDescriptor;
  }

  const candidates = ["tiny", "base", "tiny.en", "base.en"] as const;
  const descriptor =
    candidates
      .map((modelId) => getTranscriptModelDescriptor(modelId))
      .find((candidate) => candidate?.fileName === fileName) ?? null;
  if (descriptor === null) {
    return null;
  }

  return {
    backend: "whisper.cpp",
    modelId: descriptor.modelId,
    fileName: descriptor.fileName,
    expectedSha1: descriptor.expectedSha1,
    expectedBytes: descriptor.expectedBytes,
    language: descriptor.englishOnly === true ? "en" : descriptor.locale,
    variant: descriptor.variant,
    archiveFormat: "file",
    downloadUrl: descriptor.downloadUrl,
    installSource: "transcript-service",
  };
}

function resolveCaptureActionFromCommand(
  kind: CaptureCompanionCommandKind
): CaptureActionOutcome["action"] {
  switch (kind) {
    case "open-camera":
      return "start-analyze-session";
    case "close-camera":
      return "stop-analyze-session";
    case "capture-photo":
      return "capture-analyze-photo";
    case "retake-photo":
      return "retake-analyze-photo";
    case "start-dictation":
      return "start-analyze-dictation";
    case "stop-dictation":
      return "stop-analyze-dictation";
    case "start-ambient-listener":
      return "start-ambient-listener";
    case "stop-ambient-listener":
      return "stop-ambient-listener";
    default:
      throw new Error(`Unsupported capture companion command: ${String(kind)}`);
  }
}

function isMediaCaptureCommand(kind: CaptureCompanionCommandKind): boolean {
  return kind === "capture-photo" || kind === "retake-photo";
}

function getCommandRequestId(command: PendingBridgeCommand): string {
  return command.requestId ?? command.id;
}

async function isExecutable(filePath: string | null): Promise<boolean> {
  if (filePath === null) {
    return false;
  }

  try {
    await access(filePath, fsConstants.X_OK);
    return true;
  } catch {
    return false;
  }
}

async function fileExists(filePath: string): Promise<boolean> {
  try {
    await access(filePath);
    return true;
  } catch {
    return false;
  }
}

async function hasReadWriteAccess(filePath: string): Promise<boolean> {
  try {
    await access(filePath, fsConstants.R_OK | fsConstants.W_OK);
    return true;
  } catch {
    return false;
  }
}

function parseV4l2DeviceForLabel(output: string, label: string): string | null {
  const lines = output.split(/\r?\n/);
  const normalizedLabel = label.toLowerCase();
  for (let index = 0; index < lines.length; index += 1) {
    if (lines[index]?.toLowerCase().includes(normalizedLabel) !== true) {
      continue;
    }

    for (let deviceIndex = index + 1; deviceIndex < lines.length; deviceIndex += 1) {
      const line = lines[deviceIndex] ?? "";
      if (line.trim() === "") {
        break;
      }

      const match = line.match(/\/dev\/video\d+/);
      if (match !== null) {
        return match[0];
      }
    }
  }

  return null;
}

function buildScrcpyV4l2SetupHint(): string {
  return `sudo modprobe v4l2loopback video_nr=42 card_label="${CAPTURE_SCRCPY_V4L2_LABEL}" exclusive_caps=1`;
}

async function resolveScrcpyV4l2Sink(): Promise<
  { ok: true; previewVideo: CaptureAnalyzePreviewVideoStatus } | { ok: false; message: string }
> {
  if (process.platform !== "linux") {
    return {
      ok: false,
      message: "Embedded Scrcpy camera feed requires Linux v4l2loopback.",
    };
  }

  const configuredDevice = normalizeText(process.env[CAPTURE_SCRCPY_V4L2_ENV_DEVICE]);
  const candidates: string[] = [];
  if (configuredDevice !== null) {
    candidates.push(configuredDevice);
  }

  const v4l2CtlPath = await resolveExecutableOnPath("v4l2-ctl");
  if (v4l2CtlPath !== null) {
    const result = await runCommand(v4l2CtlPath, ["--list-devices"], 5_000).catch(() => null);
    const listedDevice =
      result !== null && result.exitCode === 0
        ? parseV4l2DeviceForLabel(result.stdout, CAPTURE_SCRCPY_V4L2_LABEL)
        : null;
    if (listedDevice !== null) {
      candidates.push(listedDevice);
    }
  }
  candidates.push(CAPTURE_SCRCPY_V4L2_DEFAULT_DEVICE);

  const accessibleCandidates = await Promise.all(
    [...new Set(candidates)].map(async (candidate) => ({
      candidate,
      accessible: await hasReadWriteAccess(candidate),
    }))
  );
  const selectedCandidate =
    accessibleCandidates.find((candidate) => candidate.accessible === true)?.candidate ?? null;
  if (selectedCandidate !== null) {
    return {
      ok: true,
      previewVideo: {
        source: "v4l2",
        devicePath: selectedCandidate,
        label: CAPTURE_SCRCPY_V4L2_LABEL,
        width: 640,
        height: 480,
        fps: CAPTURE_SCRCPY_CAMERA_FPS,
      },
    };
  }

  const expectedDevice = configuredDevice ?? CAPTURE_SCRCPY_V4L2_DEFAULT_DEVICE;
  return {
    ok: false,
    message: `Scrcpy v4l2 camera device is not ready at ${expectedDevice}. Run: ${buildScrcpyV4l2SetupHint()}`,
  };
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

function assertCompanionModelBuffer(
  descriptor: CompanionTranscriptModelDownloadDescriptor,
  modelBuffer: Buffer
): void {
  const actualSha1 = sha1Hex(modelBuffer);
  if (actualSha1 !== descriptor.expectedSha1) {
    throw new Error(
      `Android transcript model checksum mismatch. Expected ${descriptor.expectedSha1}, got ${actualSha1}.`
    );
  }

  if (descriptor.expectedBytes !== null && modelBuffer.byteLength !== descriptor.expectedBytes) {
    throw new Error(
      `Android transcript model size mismatch. Expected ${descriptor.expectedBytes}, got ${modelBuffer.byteLength}.`
    );
  }
}

async function ensureDirectCompanionModelArchive(
  descriptor: DirectCompanionModelDescriptor
): Promise<string> {
  const paths = resolveCompanionTranscriptModelPaths();
  await Promise.all([
    mkdir(paths.modelDir, { recursive: true }),
    mkdir(paths.tempDir, { recursive: true }),
  ]);

  const modelPath = join(paths.modelDir, descriptor.fileName);
  if (await fileExists(modelPath)) {
    const existingBuffer = await readFile(modelPath);
    try {
      assertCompanionModelBuffer(descriptor, existingBuffer);
      return modelPath;
    } catch {
      await rm(modelPath, { force: true });
    }
  }

  const tempPath = join(paths.tempDir, `${descriptor.fileName}.download`);
  await rm(tempPath, { force: true });
  await downloadFile(descriptor.downloadUrl, tempPath);

  try {
    const downloadedBuffer = await readFile(tempPath);
    assertCompanionModelBuffer(descriptor, downloadedBuffer);
    await rename(tempPath, modelPath);
    return modelPath;
  } catch (error) {
    await rm(tempPath, { force: true });
    throw error;
  }
}

async function readDirectoryNameSet(directoryPath: string): Promise<Set<string>> {
  return new Set(await readdir(directoryPath));
}

function resolveAvailableFileName(existingNames: Set<string>, preferredName: string): string {
  const extension = extname(preferredName);
  const baseName = extension === "" ? preferredName : preferredName.slice(0, -extension.length);

  let nextName = preferredName;
  let counter = 1;
  while (existingNames.has(nextName)) {
    nextName = `${baseName}-${String(counter)}${extension}`;
    counter += 1;
  }

  return nextName;
}

async function resolveExecutableOnPath(executableName: string): Promise<string | null> {
  const direct = normalizeText(executableName);
  if (direct === null) {
    return null;
  }

  if (direct.includes("/") || direct.includes("\\")) {
    return (await isExecutable(direct)) ? direct : null;
  }

  const pathEntries = (process.env["PATH"] ?? "")
    .split(process.platform === "win32" ? ";" : ":")
    .map((entry) => entry.trim())
    .filter((entry) => entry !== "");

  const extensions = process.platform === "win32" ? ["", ".exe", ".cmd", ".bat"] : [""];
  const candidates = pathEntries.flatMap((entry) =>
    extensions.map((extension) => join(entry, `${direct}${extension}`))
  );
  const executableChecks = await Promise.all(
    candidates.map(async (candidate) => ({
      candidate,
      executable: await isExecutable(candidate),
    }))
  );

  return executableChecks.find((result) => result.executable)?.candidate ?? null;
}

function isAdbExecutablePath(command: string): boolean {
  const executableName = basename(command).toLowerCase();
  return executableName === "adb" || executableName === "adb.exe";
}

async function runCommand(
  command: string,
  args: string[],
  timeoutMs = CAPTURE_ADB_TIMEOUT_MS,
  options?: { cwd?: string; stdio?: "pipe" | "inherit" }
): Promise<CommandResult> {
  if (isAdbExecutablePath(command)) {
    adbServerTouchedByCaptureService = true;
  }

  return await new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      stdio: options?.stdio === "inherit" ? "inherit" : ["ignore", "pipe", "pipe"],
      env: process.env,
      cwd: options?.cwd,
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

    if (child.stdout) {
      child.stdout.on("data", (chunk: Buffer | string) => {
        stdout += normalizeCommandChunk(chunk);
      });
    }

    if (child.stderr) {
      child.stderr.on("data", (chunk: Buffer | string) => {
        stderr += normalizeCommandChunk(chunk);
      });
    }

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

async function shutdownAdbServerIfTouched(): Promise<void> {
  if (adbServerTouchedByCaptureService !== true) {
    return;
  }

  const adbPath = await resolveExecutableOnPath("adb");
  if (adbPath === null) {
    adbServerTouchedByCaptureService = false;
    return;
  }

  const result = await runCommand(adbPath, ["kill-server"], CAPTURE_ADB_SHUTDOWN_TIMEOUT_MS);
  adbServerTouchedByCaptureService = false;
  if (result.exitCode !== 0) {
    throw new Error(
      normalizeText(result.stderr) ?? normalizeText(result.stdout) ?? "ADB server cleanup failed."
    );
  }
}

async function runStreamingCommand(
  command: string,
  args: string[],
  options?: {
    cwd?: string;
    timeoutMs?: number;
    onStdoutLine?: (line: string) => void;
    onStderrLine?: (line: string) => void;
  }
): Promise<CommandResult> {
  return await new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      stdio: ["ignore", "pipe", "pipe"],
      env: process.env,
      cwd: options?.cwd,
    });
    const stdoutStream = child.stdout;
    const stderrStream = child.stderr;

    let stdout = "";
    let stderr = "";
    let settled = false;
    let timedOut = false;
    let stdoutBuffer = "";
    let stderrBuffer = "";

    const flushLines = (
      buffer: string,
      callback?: (line: string) => void
    ): { nextBuffer: string; emitted: string[] } => {
      const parts = buffer.split(/\r?\n/);
      const nextBuffer = parts.pop() ?? "";
      const emitted = parts.map((line) => line.trim()).filter((line) => line !== "");
      emitted.forEach((line) => callback?.(line));
      return { nextBuffer, emitted };
    };

    const timeoutMs = options?.timeoutMs ?? CAPTURE_ADB_TIMEOUT_MS;
    const timeoutId =
      timeoutMs > 0
        ? globalThis.setTimeout(() => {
            timedOut = true;
            child.kill("SIGTERM");
          }, timeoutMs)
        : null;

    stdoutStream.on("data", (chunk: Buffer | string) => {
      const text = normalizeCommandChunk(chunk);
      stdout += text;
      stdoutBuffer += text;
      const flushed = flushLines(stdoutBuffer, options?.onStdoutLine);
      stdoutBuffer = flushed.nextBuffer;
    });

    stderrStream.on("data", (chunk: Buffer | string) => {
      const text = normalizeCommandChunk(chunk);
      stderr += text;
      stderrBuffer += text;
      const flushed = flushLines(stderrBuffer, options?.onStderrLine);
      stderrBuffer = flushed.nextBuffer;
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
      const trailingStdout = stdoutBuffer.trim();
      const trailingStderr = stderrBuffer.trim();
      if (trailingStdout !== "") {
        options?.onStdoutLine?.(trailingStdout);
      }
      if (trailingStderr !== "") {
        options?.onStderrLine?.(trailingStderr);
      }
      resolve({
        exitCode: typeof exitCode === "number" ? exitCode : -1,
        stdout,
        stderr,
        timedOut,
      });
    });
  });
}

function parsePermissionState(rawValue: string | null): CaptureAndroidPermissionState {
  if (rawValue === "true") {
    return "granted";
  }
  if (rawValue === "false") {
    return "denied";
  }
  return "unknown";
}

function createUnknownPermissions(): CaptureAndroidPermissionStatus {
  return {
    camera: "unknown",
    microphone: "unknown",
  };
}

function createDefaultAnalyzeState(): CaptureServiceStatus["analyze"] {
  return {
    state: "idle",
    target: CAPTURE_ANALYZE_TARGET,
    deviceId: null,
    previewMode: "scrcpy-camera",
    previewVideo: null,
    pendingCommand: null,
    pendingInboxCount: 0,
    lastCaptureAt: null,
    latestAsset: null,
    message: "Analyze phone capture session is idle.",
  };
}

function createDefaultOperationState(): CaptureServiceStatus["operation"] {
  return {
    state: "idle",
    action: null,
    message: null,
    progress: null,
    details: [],
    updatedAt: null,
  };
}

function parseAdbDeviceList(output: string): CaptureAndroidDeviceStatus[] {
  return output
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line !== "" && line !== "List of devices attached")
    .map((line): CaptureAndroidDeviceStatus | null => {
      const [deviceIdRaw, connectionStateRaw, ...details] = line.split(/\s+/);
      const deviceId = normalizeText(deviceIdRaw);
      if (deviceId === null) {
        return null;
      }

      const modelToken = details.find((token) => token.startsWith("model:")) ?? null;
      const model = normalizeModelLabel(modelToken?.slice("model:".length) ?? null);
      const connectionStateToken = connectionStateRaw ?? "";
      const connectionState = ((): CaptureAndroidDeviceConnectionState => {
        switch (connectionStateToken) {
          case "device":
            return "device";
          case "unauthorized":
            return "unauthorized";
          case "offline":
            return "offline";
          default:
            return "unknown";
        }
      })();

      return {
        deviceId,
        label: model ?? deviceId,
        model,
        transport: deviceId.includes(":")
          ? "wireless"
          : details.some((token) => token.startsWith("usb:"))
            ? "usb"
            : "unknown",
        connectionState,
        selected: false,
        companionState: "unknown",
        companionVersion: null,
        bridgeState: "waiting",
        permissions: createUnknownPermissions(),
      };
    })
    .filter((entry): entry is CaptureAndroidDeviceStatus => entry !== null);
}

function determineHostState(devices: CaptureAndroidDeviceStatus[]): CaptureAndroidHostState {
  if (devices.length === 0) {
    return "no-devices";
  }

  const readyDevices = devices.filter((device) => device.connectionState === "device");
  if (readyDevices.length > 1) {
    return "multiple-devices";
  }
  if (readyDevices.length === 1) {
    return "ready";
  }
  if (devices.some((device) => device.connectionState === "unauthorized")) {
    return "unauthorized";
  }
  if (devices.some((device) => device.connectionState === "offline")) {
    return "offline";
  }
  return "error";
}

function selectReadyDevice(
  devices: CaptureAndroidDeviceStatus[],
  preferredDeviceId: string | null
): CaptureAndroidDeviceStatus | null {
  const readyDevices = devices.filter((device) => device.connectionState === "device");
  if (readyDevices.length === 0) {
    return null;
  }

  if (preferredDeviceId !== null) {
    const preferredDevice =
      readyDevices.find((device) => device.deviceId === preferredDeviceId) ?? null;
    if (preferredDevice !== null) {
      return preferredDevice;
    }
  }

  return readyDevices.length === 1 ? (readyDevices[0] ?? null) : null;
}

function buildHostMessage(hostState: CaptureAndroidHostState): string | null {
  switch (hostState) {
    case "checking":
      return "Inspecting the Android capture bridge.";
    case "missing-adb":
      return "ADB is not available on PATH yet.";
    case "no-devices":
      return "No Android devices are connected through USB or wireless ADB.";
    case "ready":
      return "Android bridge is ready for one device.";
    case "multiple-devices":
      return "More than one ready Android device is connected. Choose the active phone in Settings > Capture.";
    case "unauthorized":
      return "At least one Android device is waiting for ADB authorization.";
    case "offline":
      return "A previously connected Android device is currently offline.";
    case "reverse-conflict":
      return "ADB reverse is not aligned with the desktop bridge port.";
    case "package-query-failed":
      return "The Android companion package could not be inspected on the selected device.";
    case "error":
      return "Android device inspection failed.";
    default:
      return null;
  }
}

function parseJavaMajorVersion(output: string | null): number | null {
  const normalized = normalizeText(output);
  if (normalized === null) {
    return null;
  }

  const versionToken =
    normalized.match(/version "([^"]+)"/)?.[1] ??
    normalized.match(/openjdk (\d+(?:\.\d+){0,2})/)?.[1] ??
    null;
  if (versionToken === null) {
    return null;
  }

  const majorToken = versionToken.split(".")[0]?.trim() ?? "";
  const major = Number.parseInt(majorToken, 10);
  return Number.isFinite(major) ? major : null;
}

function summarizeCompanionBuildFailure(output: string | null): string {
  const normalized = normalizeText(output);
  if (normalized === null) {
    return "Android companion build failed.";
  }

  const javaMajor = parseJavaMajorVersion(normalized);
  if (javaMajor !== null && javaMajor > 21) {
    return `Android companion build is blocked: Java ${String(javaMajor)} desteklenmiyor. JDK 17 veya 21 kullan.`;
  }

  if (
    normalized.includes("JAVA_HOME is not set") ||
    normalized.includes("no 'java' command could be found")
  ) {
    return "Android companion build is blocked: Java bulunamadi. JAVA_HOME ayarla veya Java kur.";
  }

  if (
    normalized.includes("ANDROID_HOME") ||
    normalized.includes("ANDROID_SDK_ROOT") ||
    normalized.includes("sdk.dir")
  ) {
    return "Android companion build is blocked: Android SDK yolu bulunamadi. ANDROID_SDK_ROOT veya local.properties ayarla.";
  }

  const firstLine =
    normalized
      .split(/\r?\n/)
      .map((line) => line.trim())
      .find((line) => line !== "") ?? null;

  return firstLine !== null
    ? `Android companion build failed: ${firstLine}`
    : "Android companion build failed.";
}

async function readCompanionManifest(): Promise<CaptureAndroidArtifactStatus> {
  const companionManifestPath = getCompanionManifestPath();
  const companionArtifactManifestPath = getCompanionArtifactManifestPath();
  const companionWrapperPath = getCompanionWrapperPath();
  const fallback: CaptureAndroidArtifactStatus = {
    buildState: "missing",
    applicationId: CAPTURE_ANDROID_COMPANION_PACKAGE,
    mainActivity: CAPTURE_ANDROID_MAIN_ACTIVITY,
    versionName: null,
    versionCode: null,
    apkPath: null,
    builtAt: null,
    sourceManifestPath: companionManifestPath,
    bridgePort: CAPTURE_BRIDGE_PORT,
  };

  if ((await fileExists(companionManifestPath)) !== true) {
    return fallback;
  }

  try {
    const parsed = JSON.parse(
      await readFile(companionManifestPath, "utf8")
    ) as CompanionManifestRecord;
    const artifactState = await inspectCompanionArtifactCache({
      companionRoot: getCompanionSourceRoot(),
      artifactManifestPath: companionArtifactManifestPath,
      extraInputRoots: [join(getCaptureProjectRoot(), "data", "transcript", "whisper.cpp-src")],
    });
    const artifactReady =
      artifactState.artifactReady === true && artifactState.artifactFresh === true;
    const wrapperReady = await fileExists(companionWrapperPath);

    return {
      buildState: artifactReady
        ? "artifact-ready"
        : wrapperReady
          ? "source-ready"
          : "build-blocked",
      applicationId: normalizeText(parsed.applicationId) ?? CAPTURE_ANDROID_COMPANION_PACKAGE,
      mainActivity: normalizeText(parsed.mainActivity) ?? CAPTURE_ANDROID_MAIN_ACTIVITY,
      versionName: normalizeText(parsed.versionName),
      versionCode:
        typeof parsed.versionCode === "number" && Number.isFinite(parsed.versionCode)
          ? parsed.versionCode
          : typeof parsed.versionCode === "string" && parsed.versionCode.trim() !== ""
            ? Number(parsed.versionCode)
            : null,
      apkPath: artifactReady ? artifactState.apkPath : null,
      builtAt: artifactState.builtAt,
      sourceManifestPath: companionManifestPath,
      bridgePort:
        typeof parsed.bridgePort === "number" && Number.isFinite(parsed.bridgePort)
          ? parsed.bridgePort
          : CAPTURE_BRIDGE_PORT,
    };
  } catch {
    return fallback;
  }
}

async function ensureCaptureIngressPaths(): Promise<CaptureIngressPaths> {
  const rootDir = join(Paths.getDataDir(), "capture-runtime");
  const analyzeInboxDir = join(rootDir, "inbox", "analyze");
  const analyzeStagedDir = join(rootDir, "staged", "analyze");

  await Promise.all([
    mkdir(rootDir, { recursive: true }),
    mkdir(analyzeInboxDir, { recursive: true }),
    mkdir(analyzeStagedDir, { recursive: true }),
  ]);

  return { rootDir, analyzeInboxDir, analyzeStagedDir };
}

async function moveAnalyzeAssetToStaging(
  sourcePath: string,
  stagedDir: string
): Promise<CaptureImportedAsset> {
  const originalName = basename(sourcePath);
  const stagedNames = await readDirectoryNameSet(stagedDir);
  const nextName = resolveAvailableFileName(stagedNames, originalName);

  const targetPath = join(stagedDir, nextName);
  await rename(sourcePath, targetPath);

  return {
    name: nextName,
    originalName,
    path: targetPath,
    importedAt: Date.now(),
  };
}

async function readAnalyzeIngressSnapshot(): Promise<AnalyzeIngressSnapshot> {
  const { analyzeInboxDir, analyzeStagedDir } = await ensureCaptureIngressPaths();
  const [inboxEntries, stagedEntries] = await Promise.all([
    readdir(analyzeInboxDir, { withFileTypes: true }),
    readdir(analyzeStagedDir, { withFileTypes: true }),
  ]);

  const stagedFiles = await Promise.all(
    stagedEntries
      .filter((entry) => entry.isFile())
      .map(async (entry) => {
        const filePath = join(analyzeStagedDir, entry.name);
        const fileStat = await stat(filePath).catch(() => null);
        return {
          name: entry.name,
          path: filePath,
          importedAt: fileStat?.mtimeMs ?? 0,
        };
      })
  );
  const latestStagedAsset =
    stagedFiles.sort((left, right) => right.importedAt - left.importedAt)[0] ?? null;

  return {
    pendingInboxCount: inboxEntries.filter((entry) => entry.isFile()).length,
    latestStagedAsset:
      latestStagedAsset === null
        ? null
        : {
            name: latestStagedAsset.name,
            originalName: latestStagedAsset.name,
            path: latestStagedAsset.path,
            importedAt: latestStagedAsset.importedAt,
          },
  };
}

async function writeAnalyzeAsset(
  fileName: string,
  contentBase64: string,
  destination: "inbox" | "staged"
): Promise<CaptureImportedAsset> {
  const { analyzeInboxDir, analyzeStagedDir } = await ensureCaptureIngressPaths();
  const targetDir = destination === "staged" ? analyzeStagedDir : analyzeInboxDir;
  const normalizedName = normalizeText(fileName) ?? `capture-${Date.now()}.jpg`;
  const existingNames = await readDirectoryNameSet(targetDir);
  const nextName = resolveAvailableFileName(existingNames, normalizedName);

  const targetPath = join(targetDir, nextName);
  await writeFile(targetPath, Buffer.from(contentBase64, "base64"));
  const fileStat = await stat(targetPath).catch(() => null);

  return {
    name: nextName,
    originalName: normalizedName,
    path: targetPath,
    importedAt: fileStat?.mtimeMs ?? Date.now(),
  };
}

function sanitizeCaptureTargetPathSegment(target: TranscriptTargetId): string {
  const normalized = target.replace(/[^a-zA-Z0-9._-]+/g, "_").slice(0, 96);
  return normalized === "" ? "target" : normalized;
}

async function writeTargetCaptureAsset(
  target: TranscriptTargetId,
  fileName: string,
  contentBase64: string
): Promise<CaptureImportedAsset> {
  if (target === CAPTURE_ANALYZE_TARGET) {
    return await writeAnalyzeAsset(fileName, contentBase64, "staged");
  }

  const { rootDir } = await ensureCaptureIngressPaths();
  const targetDir = join(rootDir, "staged", sanitizeCaptureTargetPathSegment(target));
  await mkdir(targetDir, { recursive: true });
  const normalizedName = normalizeText(fileName) ?? `capture-${Date.now()}.jpg`;
  const existingNames = await readDirectoryNameSet(targetDir);
  const nextName = resolveAvailableFileName(existingNames, normalizedName);
  const targetPath = join(targetDir, nextName);
  await writeFile(targetPath, Buffer.from(contentBase64, "base64"));
  const fileStat = await stat(targetPath).catch(() => null);

  return {
    name: nextName,
    originalName: normalizedName,
    path: targetPath,
    importedAt: fileStat?.mtimeMs ?? Date.now(),
  };
}

function normalizeCompanionDiagnosticsShadowSnapshot(
  body: Record<string, unknown>
): CompanionDiagnosticsShadowSnapshot | null {
  const deviceId = normalizeText(body["deviceId"]);
  if (deviceId === null) {
    return null;
  }

  const stateEntries = normalizeCompanionDiagnosticsStateEntries(body["stateEntries"]);
  const logEntries = normalizeCompanionDiagnosticsLogEntries(body["logEntries"]);
  const fallbackText = [
    "Hayalet Ev Companion Diagnostics",
    "",
    "State",
    stateEntries.length === 0
      ? "No state entries yet."
      : stateEntries.map((entry) => `${entry.key}: ${entry.value}`).join("\n"),
    "",
    "Logs",
    logEntries.length === 0
      ? "No diagnostic log entries yet."
      : logEntries
          .slice()
          .reverse()
          .map((entry) => {
            const prefix = `[${entry.timestampMs ?? "unknown"}] ${entry.level.padEnd(5, " ")} ${entry.category.toUpperCase()} ${entry.message}`;
            return entry.details === null ? prefix : `${prefix}\n${entry.details}`;
          })
          .join("\n\n"),
  ].join("\n");

  return {
    deviceId,
    generatedAtMs: normalizeFiniteNumber(body["generatedAtMs"]),
    receivedAtMs: Date.now(),
    stateEntries,
    logEntries,
    text:
      normalizeFreeformText(body["text"], CAPTURE_COMPANION_DIAGNOSTICS_MAX_TEXT_CHARS) ??
      fallbackText,
  };
}

async function writeCompanionDiagnosticsShadowSnapshot(
  snapshot: CompanionDiagnosticsShadowSnapshot
): Promise<{ dir: string; textPath: string; jsonPath: string }> {
  const deviceDir = join(
    Paths.getLogsDir(),
    "android-companion",
    sanitizeCompanionDiagnosticsPathSegment(snapshot.deviceId)
  );
  const textPath = join(deviceDir, "latest.txt");
  const jsonPath = join(deviceDir, "latest.json");

  await mkdir(deviceDir, { recursive: true });
  await Promise.all([
    writeFile(
      textPath,
      snapshot.text.endsWith("\n") ? snapshot.text : `${snapshot.text}\n`,
      "utf8"
    ),
    writeFile(jsonPath, `${JSON.stringify(snapshot, null, 2)}\n`, "utf8"),
  ]);

  return { dir: deviceDir, textPath, jsonPath };
}

async function inspectCompanionState(
  adbPath: string,
  deviceId: string,
  expectedVersion: string | null,
  companionPackage: string
): Promise<{
  state: CaptureAndroidCompanionState;
  version: string | null;
  packageQueryFailed: boolean;
}> {
  const installCheck = await runCommand(adbPath, [
    "-s",
    deviceId,
    "shell",
    "pm",
    "path",
    companionPackage,
  ]);

  if (installCheck.exitCode !== 0) {
    return { state: "unknown", version: null, packageQueryFailed: true };
  }

  if (installCheck.stdout.includes("package:") === false) {
    return { state: "not-installed", version: null, packageQueryFailed: false };
  }

  const versionCheck = await runCommand(adbPath, [
    "-s",
    deviceId,
    "shell",
    "dumpsys",
    "package",
    companionPackage,
  ]);

  if (versionCheck.exitCode !== 0) {
    return { state: "installed", version: null, packageQueryFailed: true };
  }

  const versionMatch = versionCheck.stdout.match(/versionName=([^\s]+)/);
  const version = versionMatch?.[1] ?? null;
  const state =
    expectedVersion !== null && version !== null && version !== expectedVersion
      ? "outdated"
      : "installed";

  return {
    state,
    version,
    packageQueryFailed: false,
  };
}

async function inspectCompanionPermissions(
  adbPath: string,
  deviceId: string,
  companionPackage: string
): Promise<CaptureAndroidPermissionStatus> {
  const packageDump = await runCommand(adbPath, [
    "-s",
    deviceId,
    "shell",
    "dumpsys",
    "package",
    companionPackage,
  ]).catch(() => null);
  if (packageDump?.exitCode !== 0) {
    return createUnknownPermissions();
  }

  const cameraMatch = packageDump.stdout.match(
    /android\.permission\.CAMERA:[\s\S]*?granted=(true|false)/
  );
  const micMatch = packageDump.stdout.match(
    /android\.permission\.RECORD_AUDIO:[\s\S]*?granted=(true|false)/
  );
  return {
    camera: parsePermissionState(cameraMatch?.[1] ?? null),
    microphone: parsePermissionState(micMatch?.[1] ?? null),
  };
}

async function inspectReverseState(
  adbPath: string,
  deviceId: string,
  bridgePort: number
): Promise<CaptureAndroidStatus["reverseState"]> {
  const reverseResult = await runCommand(adbPath, ["-s", deviceId, "reverse", "--list"]).catch(
    () => null
  );
  if (reverseResult?.exitCode !== 0) {
    return "error";
  }

  const target = `tcp:${String(bridgePort)}`;
  const lines = reverseResult.stdout
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line !== "");
  const relevantLine = lines.find((line) => line.includes(target)) ?? null;
  if (relevantLine === null) {
    return "not-configured";
  }

  if (relevantLine.endsWith(`${target} ${target}`)) {
    return "ready";
  }

  return "conflict";
}

async function inspectReadyDeviceDetails(
  adbPath: string,
  device: CaptureAndroidDeviceStatus,
  expectedVersion: string | null,
  companionPackage: string,
  activeBridgeSession: CompanionBridgeSessionRecord | null
): Promise<{
  device: CaptureAndroidDeviceStatus;
  packageQueryFailed: boolean;
}> {
  const companion = await inspectCompanionState(
    adbPath,
    device.deviceId,
    expectedVersion,
    companionPackage
  ).catch(() => ({
    state: "unknown" as CaptureAndroidCompanionState,
    version: null,
    packageQueryFailed: true,
  }));

  const permissions =
    companion.state === "not-installed"
      ? createUnknownPermissions()
      : await inspectCompanionPermissions(adbPath, device.deviceId, companionPackage);

  return {
    device: {
      ...device,
      companionState: companion.state,
      companionVersion: companion.version,
      bridgeState: activeBridgeSession !== null ? "connected" : "waiting",
      permissions,
    },
    packageQueryFailed: companion.packageQueryFailed,
  };
}

class CaptureService {
  private lastStatus: CaptureServiceStatus | null = null;
  private bridgeServer: Server | null = null;
  private bridgeState: CaptureServiceStatus["bridge"] = {
    state: "starting",
    port: CAPTURE_BRIDGE_PORT,
    registeredDeviceId: null,
    lastSeenAt: null,
    lastError: null,
  };
  private readonly bridgeSessions = new Map<string, CompanionBridgeSessionRecord>();
  private readonly pendingCommands = new Map<string, PendingBridgeCommand[]>();
  private readonly activeAnalyzeMediaRequestIds = new Set<string>();
  private scrcpyCameraFeed: ScrcpyCameraFeedSession | null = null;
  private analyzeState = createDefaultAnalyzeState();
  private operationState = createDefaultOperationState();

  async getStatus(): Promise<CaptureServiceStatus> {
    return this.lastStatus ?? (await this.refreshStatus());
  }

  async shutdown(): Promise<void> {
    await this.stopScrcpyCameraFeed();
    await this.closeBridgeServer();
    this.bridgeSessions.clear();
    this.pendingCommands.clear();
    this.activeAnalyzeMediaRequestIds.clear();
    this.lastStatus = null;
    await shutdownAdbServerIfTouched();
  }

  private async closeBridgeServer(): Promise<void> {
    const server = this.bridgeServer;
    if (server === null) {
      return;
    }

    this.bridgeServer = null;
    await new Promise<void>((resolvePromise, rejectPromise) => {
      server.close((error?: Error) => {
        const closeError = error as NodeJS.ErrnoException | undefined;
        if (closeError !== undefined && closeError.code !== "ERR_SERVER_NOT_RUNNING") {
          rejectPromise(closeError);
          return;
        }
        resolvePromise();
      });
    });
    this.bridgeState = {
      ...this.bridgeState,
      state: "starting",
      registeredDeviceId: null,
      lastSeenAt: null,
      lastError: null,
    };
  }

  async refreshStatus(): Promise<CaptureServiceStatus> {
    const settings = await loadSettings();
    const captureSettings = resolveCaptureSettings(settings);
    const appLanguage = normalizeAppLanguage(settings?.general?.language);
    const variant = normalizeTranscriptModelVariant(
      settings?.general?.transcriptModelVariant,
      "full"
    );
    const transcriptRuntime = await transcriptService.getStatus().catch(() => null);
    await this.ensureBridgeServer();
    this.cleanupStaleBridgeSessions();
    const android = await this.inspectAndroid(captureSettings.preferredDeviceId);
    const ingress = await readAnalyzeIngressSnapshot();
    const activeSession =
      android.selectedDeviceId !== null
        ? (this.bridgeSessions.get(android.selectedDeviceId) ?? null)
        : null;

    this.analyzeState = {
      ...this.analyzeState,
      deviceId: android.selectedDeviceId,
      previewVideo: this.scrcpyCameraFeed?.previewVideo ?? null,
      pendingInboxCount: ingress.pendingInboxCount,
      latestAsset: ingress.latestStagedAsset ?? this.analyzeState.latestAsset,
      message: this.resolveAnalyzeMessage(activeSession, ingress.pendingInboxCount),
      state: this.resolveAnalyzeState(activeSession, ingress.pendingInboxCount),
    };

    const status: CaptureServiceStatus = {
      checkedAt: Date.now(),
      transcript: {
        appLanguage,
        variant,
        runtime: transcriptRuntime,
      },
      android,
      bridge: {
        ...this.bridgeState,
      },
      analyze: {
        ...this.analyzeState,
      },
      operation: {
        ...this.operationState,
      },
    };
    this.lastStatus = status;
    return status;
  }

  private setOperationState(
    nextState: Partial<CaptureServiceStatus["operation"]> &
      Pick<CaptureServiceStatus["operation"], "state">
  ): void {
    const details = Array.isArray(nextState.details)
      ? nextState.details
          .map((entry) => normalizeText(entry))
          .filter((entry): entry is string => entry !== null)
          .slice(-18)
      : this.operationState.details;
    this.operationState = {
      ...this.operationState,
      ...nextState,
      details,
      updatedAt: Date.now(),
    };
    this.lastStatus = null;
  }

  async dismissOperation(): Promise<CaptureServiceStatus> {
    this.setOperationState(createDefaultOperationState());
    return await this.refreshStatus();
  }

  async installCompanion(options?: { allowBootstrap?: boolean }): Promise<CaptureActionOutcome> {
    const status = await this.refreshStatus();
    const adbPath = status.android.adbPath;
    const deviceId = status.android.selectedDeviceId;
    if (adbPath === null || deviceId === null) {
      return await this.buildActionOutcome(
        "install-companion",
        false,
        status.android.message ?? "No ready Android device is available."
      );
    }

    this.setOperationState({
      state: "running",
      action: "install-companion",
      message: `Preparing the Android companion for ${deviceId}.`,
      progress: 0.08,
      details: [`Selected device: ${deviceId}`],
    });
    const artifact = await this.ensureCompanionArtifact({
      allowBootstrap: options?.allowBootstrap === true,
    }).catch(async (error: unknown) => {
      const message = error instanceof Error ? error.message : String(error);
      return await this.buildActionOutcome("install-companion", false, message);
    });
    if ("ok" in artifact) {
      return artifact;
    }

    this.setOperationState({
      state: "running",
      action: "install-companion",
      message: `Installing the Android companion on ${deviceId}.`,
      progress: 0.82,
      details: [...this.operationState.details, `Installing the APK on ${deviceId} through ADB.`],
    });
    const installResult = await runCommand(adbPath, [
      "-s",
      deviceId,
      "install",
      "-r",
      artifact.apkPath ?? getCompanionApkPath(),
    ]).catch((error) => {
      throw new Error(error instanceof Error ? error.message : String(error));
    });
    if (installResult.exitCode !== 0) {
      return await this.buildActionOutcome(
        "install-companion",
        false,
        normalizeText(installResult.stderr) ??
          normalizeText(installResult.stdout) ??
          "ADB install failed."
      );
    }

    return await this.buildActionOutcome(
      "install-companion",
      true,
      `Android companion ${artifact.versionName ?? ""} is installed on ${deviceId}.`.trim()
    );
  }

  async connectDevice(address: string): Promise<CaptureActionOutcome> {
    const normalizedAddress = normalizeText(address);
    const status = await this.refreshStatus();
    const adbPath = status.android.adbPath;
    if (adbPath === null) {
      return await this.buildActionOutcome(
        "connect-device",
        false,
        status.android.message ?? "ADB is not available yet."
      );
    }
    if (normalizedAddress === null) {
      return await this.buildActionOutcome(
        "connect-device",
        false,
        "Provide a host:port address for wireless ADB."
      );
    }

    const connectResult = await runCommand(adbPath, ["connect", normalizedAddress]).catch(
      (error) => {
        throw new Error(error instanceof Error ? error.message : String(error));
      }
    );
    if (connectResult.exitCode !== 0) {
      return await this.buildActionOutcome(
        "connect-device",
        false,
        normalizeText(connectResult.stderr) ??
          normalizeText(connectResult.stdout) ??
          "ADB connect failed."
      );
    }

    return await this.buildActionOutcome(
      "connect-device",
      true,
      normalizeText(connectResult.stdout) ?? `Connected to ${normalizedAddress}.`
    );
  }

  async disconnectDevice(deviceId: string): Promise<CaptureActionOutcome> {
    const normalizedDeviceId = normalizeText(deviceId);
    const status = await this.refreshStatus();
    const adbPath = status.android.adbPath;
    if (adbPath === null) {
      return await this.buildActionOutcome(
        "disconnect-device",
        false,
        status.android.message ?? "ADB is not available yet."
      );
    }
    if (normalizedDeviceId === null) {
      return await this.buildActionOutcome(
        "disconnect-device",
        false,
        "A device id is required before disconnecting."
      );
    }

    const disconnectResult = await runCommand(adbPath, ["disconnect", normalizedDeviceId]).catch(
      (error) => {
        throw new Error(error instanceof Error ? error.message : String(error));
      }
    );
    if (disconnectResult.exitCode !== 0) {
      return await this.buildActionOutcome(
        "disconnect-device",
        false,
        normalizeText(disconnectResult.stderr) ??
          normalizeText(disconnectResult.stdout) ??
          "ADB disconnect failed."
      );
    }

    this.bridgeSessions.delete(normalizedDeviceId);
    this.clearPendingAnalyzeCommands(normalizedDeviceId);
    if (this.analyzeState.deviceId === normalizedDeviceId) {
      this.resetAnalyzeSessionState("Analyze capture session was disconnected.");
    }

    return await this.buildActionOutcome(
      "disconnect-device",
      true,
      normalizeText(disconnectResult.stdout) ?? `Disconnected ${normalizedDeviceId}.`
    );
  }

  async launchCompanion(
    options: { target?: TranscriptTargetId | null } = {}
  ): Promise<CaptureActionOutcome> {
    const status = await this.refreshStatus();
    const settings = await loadSettings();
    const captureSettings = resolveCaptureSettings(settings);
    const target = options.target ?? CAPTURE_ANALYZE_TARGET;
    const adbPath = status.android.adbPath;
    const deviceId = status.android.selectedDeviceId;
    if (captureSettings.androidCompanionEnabled !== true) {
      return await this.buildActionOutcome(
        "launch-companion",
        false,
        "Android companion is disabled in Settings > Capture."
      );
    }
    if (adbPath === null || deviceId === null) {
      return await this.buildActionOutcome(
        "launch-companion",
        false,
        status.android.message ?? "No ready Android device is available."
      );
    }

    const reverseState = await this.ensureReverseTunnel(
      adbPath,
      deviceId,
      status.android.artifact.bridgePort
    );
    if (reverseState.ok !== true) {
      return await this.buildActionOutcome("launch-companion", false, reverseState.message);
    }

    const launchResult = await runCommand(adbPath, [
      "-s",
      deviceId,
      "shell",
      "am",
      "start",
      "-n",
      status.android.artifact.mainActivity,
      "--es",
      "deviceId",
      deviceId,
      "--es",
      "target",
      target,
      "--es",
      "defaultLens",
      captureSettings.defaultLens,
      "--es",
      "photoQuality",
      captureSettings.photoQuality,
    ]).catch((error) => {
      throw new Error(error instanceof Error ? error.message : String(error));
    });
    if (launchResult.exitCode !== 0) {
      return await this.buildActionOutcome(
        "launch-companion",
        false,
        normalizeText(launchResult.stderr) ??
          normalizeText(launchResult.stdout) ??
          "Companion app could not be launched."
      );
    }

    if (target === CAPTURE_ANALYZE_TARGET) {
      this.analyzeState = {
        ...this.analyzeState,
        deviceId,
        state: "pending-launch",
        message: "Companion launch requested. Use the phone to capture and add images to Analyze.",
      };
    }
    return await this.buildActionOutcome(
      "launch-companion",
      true,
      "Companion app launch was requested on the phone."
    );
  }

  async requestAnalyzeSession(
    options: { target?: TranscriptTargetId | null; requestId?: string | null } = {}
  ): Promise<CaptureActionOutcome> {
    const target = options.target ?? CAPTURE_ANALYZE_TARGET;
    const requestId = normalizeText(options.requestId);
    const launchOutcome = await this.launchCompanion({ target });
    if (launchOutcome.ok !== true) {
      return launchOutcome;
    }

    return await this.enqueueAnalyzeCommand("open-camera", "Analyze capture session requested.", {
      target,
      requestId,
      replaceExisting: true,
    });
  }

  async startAnalyzePreviewStream(
    options: {
      target?: TranscriptTargetId | null;
      requestId?: string | null;
      deviceId?: string | null;
    } = {}
  ): Promise<CaptureActionOutcome> {
    const target = options.target ?? CAPTURE_ANALYZE_TARGET;
    if (target !== CAPTURE_ANALYZE_TARGET) {
      return await this.buildActionOutcome(
        "start-analyze-preview",
        false,
        "Scrcpy camera feed is only available for Analyze."
      );
    }

    const requestId = normalizeText(options.requestId) ?? randomUUID();
    const settings = await loadSettings();
    const captureSettings = resolveCaptureSettings(settings);
    if (captureSettings.androidCompanionEnabled !== true) {
      return await this.buildActionOutcome(
        "start-analyze-preview",
        false,
        "Android capture is disabled in Settings > Capture."
      );
    }

    const status = await this.refreshStatus();
    const deviceId = options.deviceId ?? status.android.selectedDeviceId;
    if (deviceId === null) {
      return await this.buildActionOutcome(
        "start-analyze-preview",
        false,
        status.android.message ?? "No ready Android device is available."
      );
    }

    const scrcpyPath = await resolveExecutableOnPath("scrcpy");
    if (scrcpyPath === null) {
      return await this.buildActionOutcome(
        "start-analyze-preview",
        false,
        "scrcpy is not available on PATH."
      );
    }

    const activeFeed = this.scrcpyCameraFeed;
    if (activeFeed !== null && activeFeed.deviceId === deviceId) {
      this.analyzeState = {
        ...this.analyzeState,
        state: "ready",
        deviceId,
        previewVideo: activeFeed.previewVideo,
        pendingCommand: null,
        message: "Scrcpy camera feed is already active.",
      };
      return await this.buildActionOutcome(
        "start-analyze-preview",
        true,
        "Scrcpy camera feed is already active."
      );
    }

    const launchOutcome = await this.launchCompanion({ target });
    if (launchOutcome.ok !== true) {
      return await this.buildActionOutcome("start-analyze-preview", false, launchOutcome.message);
    }

    const started = await this.startScrcpyCameraFeed({
      scrcpyPath,
      deviceId,
      requestId,
      cameraFacing: captureSettings.defaultLens,
    });
    if (started.ok !== true) {
      return await this.buildActionOutcome("start-analyze-preview", false, started.message);
    }

    this.analyzeState = {
      ...this.analyzeState,
      state: "ready",
      target,
      deviceId,
      previewVideo: started.previewVideo,
      pendingCommand: null,
      message: started.message,
    };
    this.lastStatus = null;
    return await this.buildActionOutcome("start-analyze-preview", true, started.message);
  }

  async stopAnalyzePreviewStream(
    options: { target?: TranscriptTargetId | null; requestId?: string | null } = {}
  ): Promise<CaptureActionOutcome> {
    void options;
    const stopped = await this.stopScrcpyCameraFeed();
    this.analyzeState = {
      ...this.analyzeState,
      state: "idle",
      previewVideo: null,
      pendingCommand: null,
      message: stopped
        ? "Scrcpy camera feed was stopped."
        : "Scrcpy camera feed is already stopped.",
    };
    this.lastStatus = null;
    if (stopped !== true) {
      return await this.buildPassiveActionOutcome(
        "stop-analyze-preview",
        true,
        "Scrcpy camera feed is already stopped."
      );
    }

    return await this.buildActionOutcome(
      "stop-analyze-preview",
      true,
      "Scrcpy camera feed was stopped."
    );
  }

  private async startScrcpyCameraFeed(options: {
    scrcpyPath: string;
    deviceId: string;
    requestId: string;
    cameraFacing: "back" | "front";
  }): Promise<
    | { ok: true; message: string; previewVideo: CaptureAnalyzePreviewVideoStatus }
    | { ok: false; message: string }
  > {
    await this.stopScrcpyCameraFeed();
    const sink = await resolveScrcpyV4l2Sink();
    if (sink.ok !== true) {
      return sink;
    }

    const args = [
      "--serial",
      options.deviceId,
      "--video-source=camera",
      `--camera-facing=${options.cameraFacing}`,
      `--camera-size=${CAPTURE_SCRCPY_CAMERA_SIZE}`,
      `--camera-fps=${String(CAPTURE_SCRCPY_CAMERA_FPS)}`,
      "--no-audio",
      "--no-window",
      `--v4l2-sink=${sink.previewVideo.devicePath}`,
      `--v4l2-buffer=${String(CAPTURE_SCRCPY_V4L2_BUFFER_MS)}`,
    ];
    const child = spawn(options.scrcpyPath, args, {
      stdio: ["ignore", "pipe", "pipe"],
      env: process.env,
      cwd: getCaptureProjectRoot(),
    });
    const session: ScrcpyCameraFeedSession = {
      process: child,
      deviceId: options.deviceId,
      requestId: options.requestId,
      previewVideo: sink.previewVideo,
      startedAt: Date.now(),
      stopping: false,
      logs: [],
    };
    this.scrcpyCameraFeed = session;
    const appendOutput = (chunk: Buffer | string): void => {
      const lines = normalizeCommandChunk(chunk)
        .split(/\r?\n/)
        .map((line) => line.trim())
        .filter((line) => line !== "");
      session.logs.push(...lines);
      if (session.logs.length > CAPTURE_SCRCPY_LOG_LIMIT) {
        session.logs.splice(0, session.logs.length - CAPTURE_SCRCPY_LOG_LIMIT);
      }
    };
    child.stdout.on("data", appendOutput);
    child.stderr.on("data", appendOutput);
    child.once("close", (exitCode, signal) => {
      if (this.scrcpyCameraFeed !== session) {
        return;
      }

      this.scrcpyCameraFeed = null;
      this.analyzeState = {
        ...this.analyzeState,
        state: "idle",
        previewVideo: null,
        pendingCommand: null,
        message:
          session.stopping === true
            ? "Scrcpy camera feed was stopped."
            : `Scrcpy camera feed exited (${exitCode ?? signal ?? "unknown"}).`,
      };
      this.lastStatus = null;
      if (session.stopping !== true) {
        this.setOperationState({
          state: "error",
          action: "start-analyze-preview",
          message: this.summarizeScrcpyCameraFailure(session),
          progress: null,
          details: session.logs,
        });
      }
    });

    return await new Promise((resolve) => {
      let settled = false;
      const settle = (
        result:
          | { ok: true; message: string; previewVideo: CaptureAnalyzePreviewVideoStatus }
          | { ok: false; message: string }
      ): void => {
        if (settled) {
          return;
        }

        settled = true;
        resolve(result);
      };
      const startupTimer = globalThis.setTimeout(() => {
        settle({
          ok: true,
          message: "Scrcpy camera feed was started in the Analyze panel.",
          previewVideo: sink.previewVideo,
        });
      }, CAPTURE_SCRCPY_STARTUP_GRACE_MS);
      child.once("error", (error) => {
        globalThis.clearTimeout(startupTimer);
        if (this.scrcpyCameraFeed === session) {
          this.scrcpyCameraFeed = null;
        }
        settle({
          ok: false,
          message: error.message,
        });
      });
      child.once("close", () => {
        globalThis.clearTimeout(startupTimer);
        if (settled) {
          return;
        }

        if (this.scrcpyCameraFeed === session) {
          this.scrcpyCameraFeed = null;
        }
        settle({
          ok: false,
          message: this.summarizeScrcpyCameraFailure(session),
        });
      });
    });
  }

  private async stopScrcpyCameraFeed(): Promise<boolean> {
    const session = this.scrcpyCameraFeed;
    if (session === null) {
      return false;
    }

    session.stopping = true;
    const child = session.process;
    if (child.exitCode !== null || child.signalCode !== null) {
      this.scrcpyCameraFeed = null;
      return true;
    }

    await new Promise<void>((resolve) => {
      const timeoutId = globalThis.setTimeout(() => {
        child.kill("SIGKILL");
        resolve();
      }, CAPTURE_SCRCPY_STOP_TIMEOUT_MS);
      child.once("close", () => {
        globalThis.clearTimeout(timeoutId);
        resolve();
      });
      child.kill("SIGTERM");
    });
    if (this.scrcpyCameraFeed === session) {
      this.scrcpyCameraFeed = null;
    }
    return true;
  }

  private summarizeScrcpyCameraFailure(session: ScrcpyCameraFeedSession): string {
    const latestErrorLog =
      [...session.logs]
        .reverse()
        .find((entry) => /\b(error|cannot|failed|denied|busy)\b/i.test(entry)) ?? null;
    const latestLog =
      latestErrorLog ?? [...session.logs].reverse().find((entry) => normalizeText(entry) !== null);
    return latestLog ?? "scrcpy camera feed failed.";
  }

  async requestAnalyzeDictation(
    action: "start" | "stop",
    options: { requestId?: string | null; target?: TranscriptTargetId | null } = {}
  ): Promise<CaptureActionOutcome> {
    const target = options.target ?? CAPTURE_ANALYZE_TARGET;
    const requestId = normalizeText(options.requestId);
    if (action === "start") {
      if (requestId === null) {
        return await this.buildActionOutcome(
          "start-analyze-dictation",
          false,
          "Android dictation requestId is required."
        );
      }

      const launchOutcome = await this.launchCompanion({ target });
      if (launchOutcome.ok !== true) {
        return launchOutcome;
      }

      return await this.enqueueAnalyzeCommand(
        "start-dictation",
        "Android dictation recording was requested.",
        {
          target,
          requestId,
          replaceExistingKinds: ["start-dictation", "stop-dictation"],
        }
      );
    }

    if (requestId === null) {
      return await this.buildActionOutcome(
        "stop-analyze-dictation",
        false,
        "Android dictation requestId is required."
      );
    }

    const status = await this.refreshStatus();
    const deviceId = this.resolveAnalyzeCommandDeviceId(status, false);
    if (deviceId === null) {
      return await this.buildActionOutcome(
        "stop-analyze-dictation",
        false,
        status.android.message ?? "No ready Android device is available."
      );
    }

    return await this.enqueueAnalyzeCommand(
      "stop-dictation",
      "Android dictation recording was stopped.",
      {
        target,
        requestId,
        deviceId,
        replaceExistingKinds: ["stop-dictation"],
      }
    );
  }

  async cancelAnalyzeDictation(
    options: { requestId?: string | null; target?: TranscriptTargetId | null } = {}
  ): Promise<CaptureActionOutcome> {
    const target = options.target ?? CAPTURE_ANALYZE_TARGET;
    const requestId = normalizeText(options.requestId);
    const status = await this.refreshStatus();
    const adbPath = status.android.adbPath;
    const deviceId = this.resolveAnalyzeCommandDeviceId(status, false);
    if (adbPath === null || deviceId === null) {
      return await this.buildActionOutcome(
        "cancel-analyze-dictation",
        false,
        status.android.message ?? "No ready Android device is available."
      );
    }

    this.clearPendingTargetCommands(deviceId, target);
    const forceStopResult = await runCommand(
      adbPath,
      ["-s", deviceId, "shell", "am", "force-stop", CAPTURE_ANDROID_COMPANION_PACKAGE],
      CAPTURE_ADB_TIMEOUT_MS
    ).catch((error) => ({
      exitCode: 1,
      stdout: "",
      stderr: error instanceof Error ? error.message : String(error),
      timedOut: false,
    }));
    await runCommand(
      adbPath,
      ["-s", deviceId, "reverse", "--remove", `tcp:${status.android.artifact.bridgePort}`],
      CAPTURE_ADB_TIMEOUT_MS
    ).catch(() => null);

    this.bridgeSessions.delete(deviceId);
    this.bridgeState = {
      ...this.bridgeState,
      registeredDeviceId: null,
      lastSeenAt: null,
      lastError: null,
    };
    if (target === CAPTURE_ANALYZE_TARGET) {
      this.resetAnalyzeSessionState("Android dictation was cancelled.");
    }
    if (requestId !== null) {
      this.emitCaptureDictationStatus({
        requestId,
        createdAt: new Date().toISOString(),
        source: "android-bridge",
        target,
        deviceId,
        status: "failed",
        message: "Android dictation was cancelled.",
      });
    }

    if (forceStopResult.exitCode !== 0) {
      return await this.buildActionOutcome(
        "cancel-analyze-dictation",
        false,
        normalizeText(forceStopResult.stderr) ??
          normalizeText(forceStopResult.stdout) ??
          "Android dictation could not be cancelled."
      );
    }

    return await this.buildActionOutcome(
      "cancel-analyze-dictation",
      true,
      "Android dictation was cancelled."
    );
  }

  async startAmbientListener(
    options: CaptureAmbientListenerOptions = {}
  ): Promise<CaptureActionOutcome> {
    const target = options.target ?? CAPTURE_ANALYZE_TARGET;
    const requestId = normalizeText(options.requestId);
    if (requestId === null) {
      return await this.buildActionOutcome(
        "start-ambient-listener",
        false,
        "Ambient listener requestId is required."
      );
    }

    const launchOutcome = await this.launchCompanion({ target });
    if (launchOutcome.ok !== true) {
      return launchOutcome;
    }

    return await this.enqueueAnalyzeCommand(
      "start-ambient-listener",
      "Android ambient listener was started.",
      {
        target,
        requestId,
        replaceExistingKinds: ["start-ambient-listener", "stop-ambient-listener"],
        ambient: options,
      }
    );
  }

  async stopAmbientListener(
    options: Pick<CaptureAmbientListenerOptions, "requestId" | "target"> = {}
  ): Promise<CaptureActionOutcome> {
    const target = options.target ?? CAPTURE_ANALYZE_TARGET;
    const requestId = normalizeText(options.requestId);
    if (requestId === null) {
      return await this.buildActionOutcome(
        "stop-ambient-listener",
        false,
        "Ambient listener requestId is required."
      );
    }

    const status = await this.refreshStatus();
    const deviceId = this.resolveAnalyzeCommandDeviceId(status, false);
    if (deviceId === null) {
      return await this.buildActionOutcome(
        "stop-ambient-listener",
        false,
        status.android.message ?? "No ready Android device is available."
      );
    }

    return await this.enqueueAnalyzeCommand(
      "stop-ambient-listener",
      "Android ambient listener was stopped.",
      {
        target,
        requestId,
        deviceId,
        replaceExistingKinds: ["stop-ambient-listener"],
      }
    );
  }

  async stopAnalyzeSession(
    options: { target?: TranscriptTargetId | null; requestId?: string | null } = {}
  ): Promise<CaptureActionOutcome> {
    const target = options.target ?? CAPTURE_ANALYZE_TARGET;
    const requestId = normalizeText(options.requestId);
    if (target === CAPTURE_ANALYZE_TARGET) {
      await this.stopScrcpyCameraFeed();
    }
    const status = await this.refreshStatus();
    const deviceId = this.resolveAnalyzeCommandDeviceId(status, false);
    if (deviceId === null) {
      if (target === CAPTURE_ANALYZE_TARGET) {
        this.resetAnalyzeSessionState("Analyze capture session is already idle.");
      }
      return await this.buildActionOutcome(
        "stop-analyze-session",
        true,
        "Analyze capture session is already idle."
      );
    }

    this.clearPendingTargetCommands(deviceId, target);
    const bridgeSession = this.getBridgeSessionForTarget(deviceId, target, {
      requirePreviewActive: false,
    });
    if (bridgeSession === null) {
      if (target === CAPTURE_ANALYZE_TARGET) {
        this.resetAnalyzeSessionState("Analyze capture session is idle.");
      }
      return await this.buildActionOutcome(
        "stop-analyze-session",
        true,
        "Analyze capture session was closed."
      );
    }

    return await this.enqueueAnalyzeCommand("close-camera", "Analyze capture session was closed.", {
      deviceId,
      target,
      requestId,
      replaceExisting: true,
      requireSession: false,
    });
  }

  async requestAnalyzeCapture(
    kind: "capture-photo" | "retake-photo",
    options: { target?: TranscriptTargetId | null; requestId?: string | null } = {}
  ): Promise<CaptureActionOutcome> {
    const target = options.target ?? CAPTURE_ANALYZE_TARGET;
    const requestId = normalizeText(options.requestId);
    const status = await this.refreshStatus();
    const commandDeviceId = this.resolveAnalyzeCommandDeviceId(status, false);
    const hasAnalyzeCaptureSession =
      target !== CAPTURE_ANALYZE_TARGET || this.getAnalyzeBridgeSession(commandDeviceId) !== null;
    const readyState =
      target !== CAPTURE_ANALYZE_TARGET ||
      (hasAnalyzeCaptureSession === true &&
        (this.analyzeState.state === "ready" || this.analyzeState.state === "result-ready"));
    if (readyState !== true) {
      return await this.buildActionOutcome(
        kind === "capture-photo" ? "capture-analyze-photo" : "retake-analyze-photo",
        false,
        "Open the Android companion capture session before taking a still photo."
      );
    }

    return await this.enqueueAnalyzeCommand(
      kind,
      kind === "capture-photo" ? "Phone photo capture requested." : "Phone retake requested.",
      {
        target,
        requestId,
        deviceId:
          target === CAPTURE_ANALYZE_TARGET
            ? commandDeviceId
            : this.resolveAnalyzeCommandDeviceId(status, false),
        requireSession: target === CAPTURE_ANALYZE_TARGET,
      }
    );
  }

  async consumeAnalyzeInboxAssets(): Promise<CaptureImportedAsset[]> {
    const { analyzeInboxDir, analyzeStagedDir } = await ensureCaptureIngressPaths();
    const entries = await readdir(analyzeInboxDir, { withFileTypes: true });
    const fileEntries = entries.filter((entry) => entry.isFile());
    const imported = await fileEntries.reduce<Promise<CaptureImportedAsset[]>>(
      async (pendingImported, entry) => {
        const accumulated = await pendingImported;
        accumulated.push(
          await moveAnalyzeAssetToStaging(join(analyzeInboxDir, entry.name), analyzeStagedDir)
        );
        return accumulated;
      },
      Promise.resolve([])
    );

    if (imported.length > 0) {
      const latestAsset = imported[imported.length - 1] ?? null;
      this.analyzeState = {
        ...this.analyzeState,
        latestAsset,
        pendingInboxCount: 0,
        pendingCommand: null,
        state: "result-ready",
        lastCaptureAt: latestAsset?.importedAt ?? Date.now(),
        message: "The latest phone capture was added to Analyze staged attachments.",
      };
      this.lastStatus = null;
    }

    return imported;
  }

  private resolveAnalyzeCommandDeviceId(
    status: CaptureServiceStatus,
    requireSession: boolean
  ): string | null {
    const preferredCandidates = [
      this.analyzeState.deviceId,
      status.android.selectedDeviceId,
      this.bridgeState.registeredDeviceId,
    ].filter(
      (value, index, list): value is string => value !== null && list.indexOf(value) === index
    );

    if (requireSession !== true) {
      return preferredCandidates[0] ?? null;
    }

    return (
      preferredCandidates.find((deviceId) => this.getAnalyzeBridgeSession(deviceId) !== null) ??
      null
    );
  }

  private getAnalyzeBridgeSession(deviceId: string | null): CompanionBridgeSessionRecord | null {
    return this.getBridgeSessionForTarget(deviceId, CAPTURE_ANALYZE_TARGET);
  }

  private getBridgeSessionForTarget(
    deviceId: string | null,
    target: TranscriptTargetId,
    options: { requirePreviewActive?: boolean } = {}
  ): CompanionBridgeSessionRecord | null {
    if (deviceId === null) {
      return null;
    }

    const session = this.bridgeSessions.get(deviceId) ?? null;
    if (session?.target !== target) {
      return null;
    }

    return options.requirePreviewActive === false || session.previewActive === true
      ? session
      : null;
  }

  private clearPendingAnalyzeCommands(deviceId: string): void {
    this.clearPendingTargetCommands(deviceId, CAPTURE_ANALYZE_TARGET);
  }

  private clearPendingTargetCommands(deviceId: string, target: TranscriptTargetId): void {
    const queue = this.pendingCommands.get(deviceId) ?? [];
    queue
      .filter((command) => command.target === target)
      .forEach((command) => {
        if (target === CAPTURE_ANALYZE_TARGET && isMediaCaptureCommand(command.kind)) {
          this.activeAnalyzeMediaRequestIds.delete(getCommandRequestId(command));
        }
      });
    const filtered = queue.filter((command) => command.target !== target);
    if (filtered.length === 0) {
      this.pendingCommands.delete(deviceId);
      return;
    }

    this.pendingCommands.set(deviceId, filtered);
  }

  private resetAnalyzeSessionState(message: string): void {
    this.activeAnalyzeMediaRequestIds.clear();
    const nextState = createDefaultAnalyzeState();
    this.analyzeState = {
      ...nextState,
      latestAsset: this.analyzeState.latestAsset,
      lastCaptureAt: this.analyzeState.lastCaptureAt,
      message,
    };
  }

  private resolveAnalyzeMessage(
    activeSession: CompanionBridgeSessionRecord | null,
    pendingInboxCount: number
  ): string {
    if (this.scrcpyCameraFeed !== null) {
      return "Scrcpy camera feed is active in the Analyze panel.";
    }
    if (pendingInboxCount > 0) {
      return `${String(pendingInboxCount)} phone capture(s) are waiting in the Analyze inbox.`;
    }
    if (this.analyzeState.state === "capture-requested") {
      return "A capture command was sent to the phone. Use the companion to add the image to Analyze.";
    }
    if (this.analyzeState.state === "idle") {
      return this.analyzeState.message ?? "Analyze phone capture session is idle.";
    }
    if (
      activeSession !== null &&
      activeSession.target === CAPTURE_ANALYZE_TARGET &&
      activeSession.previewActive === true
    ) {
      return "Phone preview is active for Analyze. Capture commands will run on the phone.";
    }
    return this.analyzeState.message ?? "Analyze phone capture session is idle.";
  }

  private resolveAnalyzeState(
    activeSession: CompanionBridgeSessionRecord | null,
    pendingInboxCount: number
  ): CaptureAnalyzeSessionState {
    if (this.scrcpyCameraFeed !== null) {
      return "ready";
    }
    if (pendingInboxCount > 0) {
      return "result-ready";
    }
    if (this.analyzeState.state === "result-ready" && this.analyzeState.latestAsset !== null) {
      return "result-ready";
    }
    if (this.analyzeState.state === "capture-requested") {
      return "capture-requested";
    }
    if (this.analyzeState.state === "idle") {
      return "idle";
    }
    if (
      activeSession !== null &&
      activeSession.target === CAPTURE_ANALYZE_TARGET &&
      activeSession.previewActive === true
    ) {
      return "ready";
    }
    return this.analyzeState.state === "pending-launch" ? "pending-launch" : "idle";
  }

  private cleanupStaleBridgeSessions(): void {
    const now = Date.now();
    for (const [deviceId, session] of this.bridgeSessions.entries()) {
      if (now - session.lastSeenAt > CAPTURE_SESSION_STALE_MS) {
        this.bridgeSessions.delete(deviceId);
      }
    }

    const activeSession =
      [...this.bridgeSessions.values()].sort(
        (left, right) => right.lastSeenAt - left.lastSeenAt
      )[0] ?? null;
    this.bridgeState = {
      ...this.bridgeState,
      registeredDeviceId: activeSession?.deviceId ?? null,
      lastSeenAt: activeSession?.lastSeenAt ?? null,
    };
  }

  private async ensureBridgeServer(): Promise<void> {
    if (this.bridgeServer !== null) {
      return;
    }

    const artifact = await readCompanionManifest();
    this.bridgeState = {
      ...this.bridgeState,
      state: "starting",
      port: artifact.bridgePort,
      lastError: null,
    };

    this.bridgeServer = createServer((request, response) => {
      void this.handleBridgeRequest(request, response);
    });

    await new Promise<void>((resolvePromise) => {
      this.bridgeServer?.once("error", (error: NodeJS.ErrnoException) => {
        this.bridgeState = {
          ...this.bridgeState,
          state: "error",
          lastError: error.message,
        };
        resolvePromise();
      });

      this.bridgeServer?.listen(artifact.bridgePort, "127.0.0.1", () => {
        this.bridgeState = {
          ...this.bridgeState,
          state: "ready",
          port: artifact.bridgePort,
          lastError: null,
        };
        resolvePromise();
      });
    });
  }

  private async handleBridgeRequest(
    request: IncomingMessage,
    response: ServerResponse
  ): Promise<void> {
    const requestUrl = new URL(request.url ?? "/", "http://127.0.0.1");
    const method = request.method ?? "GET";

    try {
      if (method === "GET" && requestUrl.pathname === "/health") {
        this.sendJson(response, 200, {
          ok: true,
          bridge: this.bridgeState,
        });
        return;
      }

      if (method === "POST" && requestUrl.pathname === "/api/v1/session/register") {
        const body = await this.readJsonBody(request);
        const deviceId = normalizeText(body["deviceId"]);
        if (deviceId === null) {
          this.sendJson(response, 400, { ok: false, error: "deviceId is required." });
          return;
        }

        const permissions = this.normalizePermissions(body["permissions"]);
        const session: CompanionBridgeSessionRecord = {
          deviceId,
          appVersion: normalizeText(body["appVersion"]),
          permissions,
          previewActive: body["previewActive"] === true,
          target: normalizeText(body["target"]),
          transport: normalizeText(body["transport"]),
          lastSeenAt: Date.now(),
        };
        this.bridgeSessions.set(deviceId, session);
        this.bridgeState = {
          ...this.bridgeState,
          state: "ready",
          registeredDeviceId: deviceId,
          lastSeenAt: session.lastSeenAt,
          lastError: null,
        };
        if (
          this.analyzeState.deviceId === deviceId &&
          session.target === CAPTURE_ANALYZE_TARGET &&
          session.previewActive === true
        ) {
          this.analyzeState = {
            ...this.analyzeState,
            state: "ready",
            message: "Analyze phone preview is active on the Android companion.",
          };
        }

        this.sendJson(response, 200, {
          ok: true,
          commandPollAfterMs: 1500,
          pendingCommands: this.pendingCommands.get(deviceId) ?? [],
        });
        return;
      }

      if (method === "GET" && requestUrl.pathname === "/api/v1/session/commands") {
        const deviceId = normalizeText(requestUrl.searchParams.get("deviceId"));
        if (deviceId === null) {
          this.sendJson(response, 400, { ok: false, error: "deviceId is required." });
          return;
        }

        const session = this.bridgeSessions.get(deviceId);
        if (session !== undefined) {
          session.lastSeenAt = Date.now();
          this.bridgeSessions.set(deviceId, session);
          this.bridgeState = {
            ...this.bridgeState,
            registeredDeviceId: deviceId,
            lastSeenAt: session.lastSeenAt,
            lastError: null,
          };
        }

        this.sendJson(response, 200, {
          ok: true,
          commands: this.pendingCommands.get(deviceId) ?? [],
        });
        return;
      }

      if (method === "POST" && requestUrl.pathname === "/api/v1/session/ack") {
        const body = await this.readJsonBody(request);
        const deviceId = normalizeText(body["deviceId"]);
        const commandId = normalizeText(body["commandId"]);
        if (deviceId === null || commandId === null) {
          this.sendJson(response, 400, {
            ok: false,
            error: "deviceId and commandId are required.",
          });
          return;
        }

        const commands = this.pendingCommands.get(deviceId) ?? [];
        const acknowledgedCommand = commands.find((command) => command.id === commandId) ?? null;
        this.pendingCommands.set(
          deviceId,
          commands.filter((command) => command.id !== commandId)
        );
        const commandKind = normalizeText(body["kind"]) ?? acknowledgedCommand?.kind ?? null;
        const requestId =
          normalizeText(body["requestId"]) ?? acknowledgedCommand?.requestId ?? null;
        const target =
          normalizeTranscriptTarget(body["target"]) ?? acknowledgedCommand?.target ?? null;
        const statusText = normalizeText(body["status"]);
        const fallbackMessage =
          commandKind === "capture-photo"
            ? "The phone is capturing a photo."
            : commandKind === "close-camera"
              ? "The phone capture session is idle."
              : commandKind === "start-dictation"
                ? "Android dictation is recording on the phone."
                : commandKind === "stop-dictation"
                  ? "Android dictation is transcribing on the phone."
                  : "The phone acknowledged the latest command.";
        const message = normalizeText(body["message"]) ?? fallbackMessage;
        if (
          requestId !== null &&
          target !== null &&
          (commandKind === "start-dictation" || commandKind === "stop-dictation")
        ) {
          this.emitCaptureDictationStatus({
            requestId,
            createdAt: new Date().toISOString(),
            source: "android-bridge",
            target,
            deviceId,
            status:
              statusText === "failed"
                ? "failed"
                : statusText === "done"
                  ? "done"
                  : commandKind === "start-dictation"
                    ? "started"
                    : "transcribing",
            message,
          });
        }
        if (
          requestId !== null &&
          target !== null &&
          (commandKind === "start-ambient-listener" || commandKind === "stop-ambient-listener")
        ) {
          this.emitCaptureAmbientStatus({
            requestId,
            createdAt: new Date().toISOString(),
            source: "android-bridge",
            target,
            deviceId,
            status:
              statusText === "failed"
                ? "failed"
                : commandKind === "stop-ambient-listener" || statusText === "done"
                  ? "stopped"
                  : "started",
            message,
            metadata: {
              acknowledgedCommandId: commandId,
              commandKind,
            },
          });
        }
        if (
          requestId !== null &&
          target === CAPTURE_ANALYZE_TARGET &&
          (commandKind === "capture-photo" || commandKind === "retake-photo") &&
          (statusText === "done" || statusText === "failed")
        ) {
          this.activeAnalyzeMediaRequestIds.delete(requestId);
        }
        if (
          this.analyzeState.deviceId === deviceId &&
          (body["status"] === "accepted" ||
            body["status"] === "done" ||
            body["status"] === "failed")
        ) {
          const session = this.bridgeSessions.get(deviceId) ?? null;
          const previewActive =
            typeof body["previewActive"] === "boolean"
              ? body["previewActive"] === true
              : session?.previewActive === true;
          if (session !== null && typeof body["previewActive"] === "boolean") {
            session.previewActive = previewActive;
            session.lastSeenAt = Date.now();
            this.bridgeSessions.set(deviceId, session);
          }
          this.analyzeState = {
            ...this.analyzeState,
            state:
              statusText === "failed"
                ? "ready"
                : commandKind === "capture-photo"
                  ? this.analyzeState.state === "result-ready"
                    ? "result-ready"
                    : "capture-requested"
                  : commandKind === "close-camera"
                    ? "idle"
                    : commandKind === "start-dictation" || commandKind === "stop-dictation"
                      ? this.analyzeState.state === "idle"
                        ? "pending-launch"
                        : this.analyzeState.state
                      : previewActive === true
                        ? "ready"
                        : "pending-launch",
            pendingCommand:
              statusText === "failed" || statusText === "done"
                ? null
                : commandKind === "capture-photo"
                  ? "capture-photo"
                  : commandKind === "start-dictation"
                    ? "start-dictation"
                    : null,
            message,
          };
        }

        this.sendJson(response, 200, { ok: true });
        return;
      }

      if (method === "POST" && requestUrl.pathname === "/api/v1/diagnostics/snapshot") {
        const body = await this.readJsonBody(request);
        const snapshot = normalizeCompanionDiagnosticsShadowSnapshot(body);
        if (snapshot === null) {
          this.sendJson(response, 400, { ok: false, error: "deviceId is required." });
          return;
        }

        const written = await writeCompanionDiagnosticsShadowSnapshot(snapshot);
        this.sendJson(response, 200, {
          ok: true,
          shadowPath: written.textPath,
          shadowJsonPath: written.jsonPath,
        });
        return;
      }

      if (method === "GET" && requestUrl.pathname === "/api/v1/transcript/model") {
        await this.handleTranscriptModelDownload(requestUrl, response);
        return;
      }

      if (method === "POST" && requestUrl.pathname === "/api/v1/transcript/ingress") {
        const body = await this.readJsonBody(request);
        const text = normalizeText(body["text"]);
        if (text === null) {
          this.sendJson(response, 400, { ok: false, error: "text is required." });
          return;
        }

        const requestId = normalizeText(body["requestId"]);
        const target = normalizeTranscriptTarget(body["target"]);
        if (requestId === null || target === null) {
          this.sendJson(response, 400, {
            ok: false,
            error: "requestId and target are required.",
          });
          return;
        }

        const requestMetadata = this.normalizeMetadata(body["metadata"]) ?? {};
        const ingress = transcriptService.submitIngress({
          requestId,
          text,
          source: "android-bridge",
          target,
          isFinal: body["isFinal"] !== false,
          metadata: {
            ...requestMetadata,
            deviceId: normalizeText(body["deviceId"]),
            transport: "adb-reverse",
          },
        });
        this.sendJson(response, ingress.success === true ? 200 : 400, ingress);
        return;
      }

      if (method === "POST" && requestUrl.pathname === "/api/v1/ambient/status") {
        const body = await this.readJsonBody(request);
        const requestId = normalizeText(body["requestId"]);
        const target = normalizeTranscriptTarget(body["target"]);
        const status = normalizeAmbientStatusState(body["status"]);
        if (requestId === null || target === null || status === null) {
          this.sendJson(response, 400, {
            ok: false,
            error: "requestId, target, and status are required.",
          });
          return;
        }

        this.emitCaptureAmbientStatus({
          requestId,
          createdAt: new Date().toISOString(),
          source: "android-bridge",
          target,
          deviceId: normalizeText(body["deviceId"]),
          status,
          message: normalizeText(body["message"]) ?? `Ambient listener status: ${status}`,
          transcript: normalizeText(body["transcript"]),
          metadata: this.normalizeMetadata(body["metadata"]),
        });
        this.sendJson(response, 200, { ok: true });
        return;
      }

      if (method === "POST" && requestUrl.pathname === "/api/v1/media/analyze") {
        const body = await this.readJsonBody(request);
        const contentBase64 = normalizeText(body["contentBase64"]);
        if (contentBase64 === null) {
          this.sendJson(response, 400, { ok: false, error: "contentBase64 is required." });
          return;
        }

        const requestId = normalizeText(body["requestId"]);
        const target = normalizeTranscriptTarget(body["target"]);
        if (requestId === null || target === null) {
          this.sendJson(response, 400, {
            ok: false,
            error: "requestId and target are required.",
          });
          return;
        }

        const fileName = normalizeText(body["fileName"]) ?? `capture-${Date.now()}.jpg`;
        const deviceId = normalizeText(body["deviceId"]);
        if (target !== CAPTURE_ANALYZE_TARGET) {
          const storedAsset = await writeTargetCaptureAsset(target, fileName, contentBase64);
          this.emitCaptureMediaIngress({
            requestId,
            createdAt: new Date().toISOString(),
            source: "android-bridge",
            target,
            asset: storedAsset,
            metadata: {
              deviceId,
              transport: "adb-reverse",
            },
          });
          this.sendJson(response, 200, {
            ok: true,
            storedPath: storedAsset.path,
          });
          return;
        }

        const stageForAnalyze = body["stageForAnalyze"] === true;
        const hasActiveRequest = this.activeAnalyzeMediaRequestIds.has(requestId);
        const activeSession =
          deviceId !== null
            ? this.getBridgeSessionForTarget(deviceId, target, { requirePreviewActive: false })
            : null;
        if (hasActiveRequest !== true && (stageForAnalyze !== true || activeSession === null)) {
          this.sendJson(response, 409, {
            ok: false,
            error: "Analyze capture request is not active.",
          });
          return;
        }

        const captureSettings = resolveCaptureSettings(await loadSettings());
        const shouldStageForAnalyze =
          stageForAnalyze === true || captureSettings.attachMode === "auto-stage";
        const storedAsset = await writeAnalyzeAsset(
          fileName,
          contentBase64,
          shouldStageForAnalyze ? "staged" : "inbox"
        );
        if (hasActiveRequest === true) {
          this.activeAnalyzeMediaRequestIds.delete(requestId);
        }
        this.analyzeState = {
          ...this.analyzeState,
          state: "result-ready",
          pendingCommand: null,
          lastCaptureAt: Date.now(),
          latestAsset: shouldStageForAnalyze ? storedAsset : this.analyzeState.latestAsset,
          pendingInboxCount: shouldStageForAnalyze
            ? this.analyzeState.pendingInboxCount
            : this.analyzeState.pendingInboxCount + 1,
          message: shouldStageForAnalyze
            ? "A new phone capture was staged for Analyze."
            : "A new phone capture is waiting in the Analyze inbox.",
        };
        this.lastStatus = null;
        if (shouldStageForAnalyze) {
          this.emitCaptureMediaIngress({
            requestId,
            createdAt: new Date().toISOString(),
            source: "android-bridge",
            target,
            asset: storedAsset,
            metadata: {
              deviceId,
              transport: "adb-reverse",
              stageForAnalyze,
            },
          });
        }
        this.sendJson(response, 200, {
          ok: true,
          storedPath: storedAsset.path,
        });
        return;
      }

      this.sendJson(response, 404, { ok: false, error: "Not found." });
    } catch (error) {
      this.sendJson(response, 500, {
        ok: false,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  private async handleTranscriptModelDownload(
    requestUrl: URL,
    response: ServerResponse
  ): Promise<void> {
    const fileName = normalizeText(requestUrl.searchParams.get("fileName"));
    if (fileName === null) {
      this.sendJson(response, 400, { ok: false, error: "fileName is required." });
      return;
    }

    const descriptor = findTranscriptDescriptorByFileName(fileName);
    if (descriptor === null) {
      this.sendJson(response, 404, { ok: false, error: "Transcript model is unknown." });
      return;
    }

    let modelPath: string;
    if (descriptor.installSource === "transcript-service") {
      const model = await transcriptService.installModel(descriptor.modelId);
      if (model.ready !== true || model.path === null) {
        this.sendJson(response, 500, {
          ok: false,
          error: model.lastError ?? "Transcript model could not be prepared.",
        });
        return;
      }
      modelPath = model.path;
    } else {
      modelPath = await ensureDirectCompanionModelArchive(descriptor);
    }

    const fileStat = await stat(modelPath);
    response.statusCode = 200;
    response.setHeader("content-type", "application/octet-stream");
    response.setHeader("content-length", String(fileStat.size));
    response.setHeader("x-transcript-model-id", descriptor.modelId);
    response.setHeader("x-transcript-model-sha1", descriptor.expectedSha1);
    response.setHeader("x-transcript-model-file", descriptor.fileName);
    await new Promise<void>((resolvePromise, rejectPromise) => {
      const stream = createReadStream(modelPath);
      stream.once("error", rejectPromise);
      response.once("error", rejectPromise);
      response.once("finish", resolvePromise);
      stream.pipe(response);
    });
  }

  private sendJson(response: ServerResponse, statusCode: number, payload: unknown): void {
    response.statusCode = statusCode;
    response.setHeader("content-type", "application/json; charset=utf-8");
    response.end(`${JSON.stringify(payload)}\n`);
  }

  private emitCaptureMediaIngress(payload: CaptureMediaIngressPayload): void {
    for (const window of BrowserWindow.getAllWindows()) {
      try {
        window.webContents.send(CAPTURE_MEDIA_INGRESS_CHANNEL, payload);
      } catch {
        // NOTE: Capture fan-out is best-effort so one detached window cannot abort the bridge upload.
      }
    }
  }

  private emitCaptureDictationStatus(payload: CaptureDictationStatusPayload): void {
    for (const window of BrowserWindow.getAllWindows()) {
      try {
        window.webContents.send(CAPTURE_DICTATION_STATUS_CHANNEL, payload);
      } catch {
        // NOTE: Dictation status fan-out is best-effort for detached renderer windows.
      }
    }
  }

  private emitCaptureAmbientStatus(payload: CaptureAmbientStatusPayload): void {
    for (const window of BrowserWindow.getAllWindows()) {
      try {
        window.webContents.send(CAPTURE_AMBIENT_STATUS_CHANNEL, payload);
      } catch {
        // NOTE: Ambient status fan-out is best-effort for detached renderer windows.
      }
    }
  }

  private async readJsonBody(request: IncomingMessage): Promise<Record<string, unknown>> {
    const chunks: Buffer[] = [];
    for await (const chunk of request as AsyncIterable<Buffer | string>) {
      const normalizedChunk = typeof chunk === "string" ? Buffer.from(chunk) : chunk;
      chunks.push(normalizedChunk);
    }

    if (chunks.length === 0) {
      return {};
    }

    return JSON.parse(Buffer.concat(chunks).toString("utf8")) as Record<string, unknown>;
  }

  private normalizePermissions(value: unknown): CaptureAndroidPermissionStatus {
    if (typeof value !== "object" || value === null) {
      return createUnknownPermissions();
    }

    const record = value as Record<string, unknown>;
    return {
      camera:
        record["camera"] === "granted"
          ? "granted"
          : record["camera"] === "denied"
            ? "denied"
            : "unknown",
      microphone:
        record["microphone"] === "granted"
          ? "granted"
          : record["microphone"] === "denied"
            ? "denied"
            : "unknown",
    };
  }

  private normalizeMetadata(value: unknown): Record<string, unknown> | null {
    return isRecord(value) ? { ...value } : null;
  }

  private async inspectAndroid(preferredDeviceId: string | null): Promise<CaptureAndroidStatus> {
    const artifact = await readCompanionManifest();
    const adbPath = await resolveExecutableOnPath("adb");
    if (adbPath === null) {
      return {
        hostState: "missing-adb",
        adbPath: null,
        selectedDeviceId: null,
        companionPackage: artifact.applicationId,
        previewMode: "scrcpy-camera",
        reverseState: "not-configured",
        pairingHint: "Install Android platform-tools so Hayalet Ev can manage the companion app.",
        message: buildHostMessage("missing-adb"),
        devices: [],
        artifact,
      };
    }

    const deviceListResult = await runCommand(adbPath, ["devices", "-l"]).catch(() => null);
    if (
      deviceListResult === null ||
      deviceListResult.timedOut === true ||
      deviceListResult.exitCode !== 0
    ) {
      return {
        hostState: "error",
        adbPath,
        selectedDeviceId: null,
        companionPackage: artifact.applicationId,
        previewMode: "scrcpy-camera",
        reverseState: "error",
        pairingHint: null,
        message:
          normalizeText(deviceListResult?.stderr) ??
          normalizeText(deviceListResult?.stdout) ??
          buildHostMessage("error"),
        devices: [],
        artifact,
      };
    }

    const devices = parseAdbDeviceList(deviceListResult.stdout);
    let hostState = determineHostState(devices);
    const selectedReadyDevice = selectReadyDevice(devices, preferredDeviceId);
    let reverseState: CaptureAndroidStatus["reverseState"] =
      selectedReadyDevice === null ? "not-configured" : "error";

    const detailedDevices = await Promise.all(
      devices.map(async (device) => {
        if (device.connectionState !== "device") {
          return { device, packageQueryFailed: false };
        }

        return await inspectReadyDeviceDetails(
          adbPath,
          device,
          artifact.versionName,
          artifact.applicationId,
          this.bridgeSessions.get(device.deviceId) ?? null
        );
      })
    );
    const nextDevices = detailedDevices.map((entry) => entry.device);
    const selectedDevice =
      nextDevices.find((device) => device.deviceId === selectedReadyDevice?.deviceId) ?? null;

    if (selectedDevice !== null) {
      selectedDevice.selected = true;
      reverseState = await inspectReverseState(
        adbPath,
        selectedDevice.deviceId,
        artifact.bridgePort
      );
      if (
        detailedDevices.find((entry) => entry.device.deviceId === selectedDevice.deviceId)
          ?.packageQueryFailed === true
      ) {
        hostState = "package-query-failed";
      } else if (reverseState === "conflict") {
        hostState = "reverse-conflict";
      }
    }

    return {
      hostState,
      adbPath,
      selectedDeviceId: selectedDevice?.deviceId ?? null,
      companionPackage: artifact.applicationId,
      previewMode: "scrcpy-camera",
      reverseState,
      pairingHint: this.buildPairingHint(hostState, artifact.bridgePort),
      message: buildHostMessage(hostState),
      devices: nextDevices,
      artifact,
    };
  }

  private buildPairingHint(hostState: CaptureAndroidHostState, bridgePort: number): string | null {
    switch (hostState) {
      case "checking":
        return "Hayalet Ev is verifying the host bridge and Android device state.";
      case "missing-adb":
        return "Install Android platform-tools so Settings can manage USB and wireless debug devices.";
      case "no-devices":
        return "Connect a phone with USB debugging or attach it with `adb connect <host>:<port>`.";
      case "ready":
        return "Use Scrcpy Camera for live feed, or the phone companion for still captures.";
      case "multiple-devices":
        return "Pick the active phone in Settings > Capture. Extra phones stay visible for diagnostics.";
      case "unauthorized":
        return "Approve the USB debugging dialog on the phone, then refresh Settings > Capture.";
      case "offline":
        return "Reconnect the device or re-establish wireless debugging before relaunching the companion app.";
      case "reverse-conflict":
        return `Reconnect ADB reverse for tcp:${String(bridgePort)} before launching the companion app again.`;
      case "package-query-failed":
        return "Reinstall or reopen the companion app so package inspection and permissions can refresh.";
      case "error":
        return "Use Scrcpy Camera for live feed, or the phone companion for still captures.";
      default:
        return null;
    }
  }

  private parseBuildScriptEvent(line: string): CompanionBuildScriptEvent | null {
    const normalized = normalizeText(line);
    if (normalized?.startsWith("{") !== true) {
      return null;
    }

    try {
      const parsed = JSON.parse(normalized) as CompanionBuildScriptEvent;
      return typeof parsed.type === "string" ? parsed : null;
    } catch {
      return null;
    }
  }

  private async readCompanionBootstrapPlan(): Promise<CompanionBuildScriptEvent | null> {
    const result = await runCommand(
      process.execPath,
      [getCompanionBuildScriptPath(), "--plan-only", "--json-progress"],
      0,
      {
        cwd: getCaptureProjectRoot(),
        stdio: "pipe",
      }
    ).catch((error) => {
      throw new Error(error instanceof Error ? error.message : String(error));
    });
    const candidateLines = `${result.stdout}\n${result.stderr}`
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter((line) => line !== "");
    const planEvent =
      candidateLines
        .map((line) => this.parseBuildScriptEvent(line))
        .find((event) => event?.type === "plan") ?? null;
    if (result.exitCode !== 0) {
      throw new Error(
        summarizeCompanionBuildFailure(
          `${result.stderr}\n${result.stdout}\nexitCode=${String(result.exitCode)}`
        )
      );
    }
    return planEvent;
  }

  private async buildCompanionArtifactWithBootstrap(): Promise<CaptureAndroidArtifactStatus> {
    let latestErrorMessage: string | null = null;
    const buildResult = await runStreamingCommand(
      process.execPath,
      [getCompanionBuildScriptPath(), "--bootstrap", "--json-progress"],
      {
        cwd: getCaptureProjectRoot(),
        timeoutMs: 0,
        onStdoutLine: (line) => {
          const event = this.parseBuildScriptEvent(line);
          if (event === null) {
            return;
          }
          if (event.type === "error") {
            latestErrorMessage = normalizeText(event.message) ?? latestErrorMessage;
            return;
          }
          if (event.type === "progress" || event.type === "result") {
            this.setOperationState({
              state: "running",
              action: "install-companion",
              message: normalizeText(event.message) ?? this.operationState.message,
              progress:
                typeof event.progress === "number" && Number.isFinite(event.progress)
                  ? event.progress
                  : this.operationState.progress,
              details: Array.isArray(event.details) ? event.details : this.operationState.details,
            });
          }
        },
        onStderrLine: (line) => {
          const event = this.parseBuildScriptEvent(line);
          if (event?.type === "error") {
            latestErrorMessage = normalizeText(event.message) ?? latestErrorMessage;
            if (Array.isArray(event.details)) {
              this.setOperationState({
                state: "running",
                action: "install-companion",
                message: latestErrorMessage,
                progress: this.operationState.progress,
                details: event.details,
              });
            }
            return;
          }
          const normalized = normalizeText(line);
          if (normalized === null) {
            return;
          }
          latestErrorMessage = normalized;
        },
      }
    ).catch((error) => {
      throw new Error(error instanceof Error ? error.message : String(error));
    });

    if (buildResult.exitCode !== 0) {
      const buildFailureMessage =
        normalizeText(latestErrorMessage) ??
        summarizeCompanionBuildFailure(
          `${buildResult.stderr}\n${buildResult.stdout}\nexitCode=${String(buildResult.exitCode)}`
        );
      throw new Error(buildFailureMessage);
    }

    const artifact = await readCompanionManifest();
    if (artifact.apkPath === null || (await fileExists(artifact.apkPath)) !== true) {
      throw new Error("The debug APK was not produced by the Android build.");
    }
    return artifact;
  }

  private async ensureCompanionArtifact(options?: {
    allowBootstrap?: boolean;
  }): Promise<CaptureAndroidArtifactStatus | CaptureActionOutcome> {
    const artifact = await readCompanionManifest();
    if (artifact.apkPath !== null && (await fileExists(artifact.apkPath)) === true) {
      this.setOperationState({
        state: "running",
        action: "install-companion",
        message: "Using the existing companion APK artifact.",
        progress: 0.22,
        details: ["The cached APK artifact is already ready and will be reused."],
      });
      return artifact;
    }

    const buildScriptPath = getCompanionBuildScriptPath();
    if ((await fileExists(buildScriptPath)) !== true) {
      throw new Error("Android companion build script is missing in the repo.");
    }

    const plan = await this.readCompanionBootstrapPlan();
    if (plan?.needsConfirmation === true && options?.allowBootstrap !== true) {
      this.setOperationState({
        state: "needs-confirmation",
        action: "install-companion",
        message:
          normalizeText(plan.message) ??
          "Android companion setup requires a local toolchain bootstrap.",
        progress: 0,
        details:
          Array.isArray(plan.details) && plan.details.length > 0
            ? plan.details
            : ["A repo-local JDK 21 and Android SDK will be prepared before the APK build starts."],
      });
      return await this.buildPassiveActionOutcome(
        "install-companion",
        false,
        normalizeText(plan.message) ??
          "Android companion setup requires confirmation before the bootstrap starts."
      );
    }

    return await this.buildCompanionArtifactWithBootstrap();
  }

  private async ensureReverseTunnel(
    adbPath: string,
    deviceId: string,
    bridgePort: number
  ): Promise<{ ok: boolean; message: string }> {
    const reverseResult = await runCommand(adbPath, [
      "-s",
      deviceId,
      "reverse",
      `tcp:${String(bridgePort)}`,
      `tcp:${String(bridgePort)}`,
    ]).catch((error) => {
      throw new Error(error instanceof Error ? error.message : String(error));
    });
    if (reverseResult.exitCode !== 0) {
      return {
        ok: false,
        message:
          normalizeText(reverseResult.stderr) ??
          normalizeText(reverseResult.stdout) ??
          "ADB reverse could not be configured.",
      };
    }

    return {
      ok: true,
      message: "ADB reverse is ready.",
    };
  }

  private async enqueueAnalyzeCommand(
    kind: CaptureCompanionCommandKind,
    successMessage: string,
    options?: {
      deviceId?: string | null;
      target?: TranscriptTargetId | null;
      requestId?: string | null;
      replaceExisting?: boolean;
      replaceExistingKinds?: CaptureCompanionCommandKind[];
      requireSession?: boolean;
      ambient?: CaptureAmbientListenerOptions;
    }
  ): Promise<CaptureActionOutcome> {
    const status = await this.refreshStatus();
    const settings = await loadSettings();
    const captureSettings = resolveCaptureSettings(settings);
    if (captureSettings.androidCompanionEnabled !== true) {
      return await this.buildActionOutcome(
        resolveCaptureActionFromCommand(kind),
        false,
        "Android companion is disabled in Settings > Capture."
      );
    }
    const deviceId =
      options?.deviceId ??
      this.resolveAnalyzeCommandDeviceId(status, options?.requireSession === true);
    if (deviceId === null) {
      return await this.buildActionOutcome(
        resolveCaptureActionFromCommand(kind),
        false,
        status.android.message ?? "No ready Android device is available."
      );
    }

    const target = options?.target ?? CAPTURE_ANALYZE_TARGET;
    if (
      options?.requireSession === true &&
      this.getBridgeSessionForTarget(deviceId, target) === null
    ) {
      return await this.buildActionOutcome(
        resolveCaptureActionFromCommand(kind),
        false,
        "Wait for the phone preview to become ready before sending capture commands."
      );
    }

    const transcriptModel = resolveCompanionTranscriptModelProfile(settings, captureSettings);
    const command: PendingBridgeCommand = {
      id: randomUUID(),
      kind,
      target,
      requestId: normalizeText(options?.requestId),
      createdAt: Date.now(),
      profile: buildCompanionCommandProfile(captureSettings, transcriptModel),
      ambient:
        kind === "start-ambient-listener"
          ? resolveAmbientCommandProfile(captureSettings, options?.ambient)
          : null,
    };
    if (target === CAPTURE_ANALYZE_TARGET && isMediaCaptureCommand(kind)) {
      this.activeAnalyzeMediaRequestIds.add(getCommandRequestId(command));
    }
    const replaceExistingKinds = options?.replaceExistingKinds ?? [];
    const currentQueue = this.pendingCommands.get(deviceId) ?? [];
    const queue =
      options?.replaceExisting === true
        ? currentQueue.filter((entry) => entry.target !== target)
        : replaceExistingKinds.length > 0
          ? currentQueue.filter(
              (entry) =>
                entry.target !== target || replaceExistingKinds.includes(entry.kind) !== true
            )
          : currentQueue;
    currentQueue
      .filter((entry) => queue.includes(entry) !== true)
      .forEach((entry) => {
        if (entry.target === CAPTURE_ANALYZE_TARGET && isMediaCaptureCommand(entry.kind)) {
          this.activeAnalyzeMediaRequestIds.delete(getCommandRequestId(entry));
        }
      });
    queue.push(command);
    this.pendingCommands.set(deviceId, queue);
    if (target === CAPTURE_ANALYZE_TARGET) {
      this.analyzeState = {
        ...this.analyzeState,
        state:
          kind === "open-camera"
            ? "pending-launch"
            : kind === "close-camera"
              ? "idle"
              : kind === "start-dictation" ||
                  kind === "stop-dictation" ||
                  kind === "start-ambient-listener" ||
                  kind === "stop-ambient-listener"
                ? this.analyzeState.state
                : "capture-requested",
        deviceId,
        pendingCommand:
          kind === "close-camera" || kind === "stop-dictation" || kind === "stop-ambient-listener"
            ? null
            : kind,
        message: successMessage,
      };
    }

    return await this.buildActionOutcome(
      resolveCaptureActionFromCommand(kind),
      true,
      successMessage
    );
  }

  private async buildActionOutcome(
    action: CaptureActionOutcome["action"],
    ok: boolean,
    message: string
  ): Promise<CaptureActionOutcome> {
    this.setOperationState({
      state: ok ? "success" : "error",
      action,
      message,
      progress: ok ? 1 : null,
    });
    return {
      action,
      ok,
      message,
      status: await this.refreshStatus(),
    };
  }

  private async buildPassiveActionOutcome(
    action: CaptureActionOutcome["action"],
    ok: boolean,
    message: string
  ): Promise<CaptureActionOutcome> {
    return {
      action,
      ok,
      message,
      status: await this.refreshStatus(),
    };
  }
}

export const captureService = new CaptureService();
