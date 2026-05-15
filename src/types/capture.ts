import type {
  TranscriptManagedModelId,
  TranscriptModelVariant,
  TranscriptRuntimeStatus,
  TranscriptSupportedLanguage,
  TranscriptTargetId,
} from "./transcript.js";

export type CaptureAndroidHostState =
  | "checking"
  | "missing-adb"
  | "no-devices"
  | "ready"
  | "multiple-devices"
  | "unauthorized"
  | "offline"
  | "reverse-conflict"
  | "package-query-failed"
  | "error";

export type CaptureAndroidDeviceConnectionState = "device" | "unauthorized" | "offline" | "unknown";

export type CaptureAndroidTransportKind = "usb" | "wireless" | "unknown";

export type CaptureAndroidCompanionState = "unknown" | "not-installed" | "installed" | "outdated";

export type CaptureAndroidPermissionState = "granted" | "denied" | "unknown";

export interface CaptureAndroidPermissionStatus {
  camera: CaptureAndroidPermissionState;
  microphone: CaptureAndroidPermissionState;
}

export type CaptureAndroidBridgeDeviceState = "waiting" | "connected";

export interface CaptureAndroidDeviceStatus {
  deviceId: string;
  label: string;
  model: string | null;
  transport: CaptureAndroidTransportKind;
  connectionState: CaptureAndroidDeviceConnectionState;
  selected: boolean;
  companionState: CaptureAndroidCompanionState;
  companionVersion: string | null;
  bridgeState: CaptureAndroidBridgeDeviceState;
  permissions: CaptureAndroidPermissionStatus;
}

export type CaptureAndroidArtifactBuildState =
  | "missing"
  | "build-blocked"
  | "source-ready"
  | "artifact-ready";

export interface CaptureAndroidArtifactStatus {
  buildState: CaptureAndroidArtifactBuildState;
  applicationId: string;
  mainActivity: string;
  versionName: string | null;
  versionCode: number | null;
  apkPath: string | null;
  builtAt: string | null;
  sourceManifestPath: string;
  bridgePort: number;
}

export interface CaptureAndroidStatus {
  hostState: CaptureAndroidHostState;
  adbPath: string | null;
  selectedDeviceId: string | null;
  companionPackage: string;
  previewMode: "phone-screen";
  reverseState: "not-configured" | "ready" | "conflict" | "error";
  pairingHint: string | null;
  message: string | null;
  devices: CaptureAndroidDeviceStatus[];
  artifact: CaptureAndroidArtifactStatus;
}

export interface CaptureTranscriptStatusSnapshot {
  appLanguage: string;
  variant: TranscriptModelVariant;
  runtime: TranscriptRuntimeStatus | null;
}

export interface CaptureImportedAsset {
  name: string;
  originalName: string;
  path: string;
  importedAt: number;
}

export interface CaptureMediaIngressPayload {
  requestId: string;
  createdAt: string;
  source: "android-bridge";
  target: TranscriptTargetId;
  asset: CaptureImportedAsset;
  metadata: Record<string, unknown> | null;
}

interface CapturePreviewPayloadBase {
  requestId: string;
  createdAt: string;
  source: "android-bridge";
  target: TranscriptTargetId;
  deviceId: string | null;
  width: number | null;
  height: number | null;
  timestampMs: number | null;
}

export interface CapturePreviewJpegFramePayload extends CapturePreviewPayloadBase {
  mimeType: "image/jpeg";
  contentBase64: string;
}

export interface CapturePreviewH264ChunkPayload extends CapturePreviewPayloadBase {
  mimeType: "video/avc";
  codec: string;
  chunk: Uint8Array | ArrayBuffer | number[];
  isKeyFrame: boolean;
  isConfig: boolean;
  sequenceNumber: number | null;
}

export type CapturePreviewFramePayload =
  | CapturePreviewJpegFramePayload
  | CapturePreviewH264ChunkPayload;

export interface CaptureDictationStatusPayload {
  requestId: string;
  createdAt: string;
  source: "android-bridge";
  target: TranscriptTargetId;
  deviceId: string | null;
  status: "started" | "transcribing" | "done" | "failed";
  message: string;
}

export type CaptureAmbientStatusState =
  | "started"
  | "wake-detected"
  | "capturing"
  | "transcribing"
  | "done"
  | "stopped"
  | "failed";

export interface CaptureAmbientStatusPayload {
  requestId: string;
  createdAt: string;
  source: "android-bridge";
  target: TranscriptTargetId;
  deviceId: string | null;
  status: CaptureAmbientStatusState;
  message: string;
  transcript?: string | null;
  metadata?: Record<string, unknown> | null;
}

export type CaptureCompanionCommandKind =
  | "open-camera"
  | "capture-photo"
  | "retake-photo"
  | "close-camera"
  | "start-dictation"
  | "stop-dictation"
  | "start-preview-stream"
  | "stop-preview-stream"
  | "start-ambient-listener"
  | "stop-ambient-listener";

export interface CaptureCompanionAmbientProfile {
  wakePhrases: string[];
  activeWindowMs: number;
  silenceTimeoutMs: number;
}

export interface CaptureCompanionTranscriptModelProfile {
  backend: "whisper.cpp" | "vosk";
  modelId: TranscriptManagedModelId | "vosk-model-small-tr-0.3" | "vosk-model-small-en-us-0.15";
  fileName: string;
  expectedSha1: string;
  expectedBytes: number | null;
  language: TranscriptSupportedLanguage;
  variant: TranscriptModelVariant;
  archiveFormat: "file" | "zip-directory";
}

export interface CaptureCompanionCommandProfile {
  defaultLens: "back" | "front";
  photoQuality: "balanced" | "high";
  attachMode: "manual-sync" | "auto-stage";
  commandConfirmation: "none" | "toast";
  androidDictationBackend: "whisper.cpp" | "vosk";
  transcriptModel: CaptureCompanionTranscriptModelProfile | null;
}

export interface CaptureCompanionCommandEnvelope {
  id: string;
  kind: CaptureCompanionCommandKind;
  target: TranscriptTargetId;
  requestId?: string | null;
  createdAt: number;
  profile: CaptureCompanionCommandProfile | null;
  ambient?: CaptureCompanionAmbientProfile | null;
}

export interface CaptureTargetActionOptions {
  target?: TranscriptTargetId | null;
  requestId?: string | null;
  deviceId?: string | null;
}

export interface CaptureAmbientListenerOptions extends CaptureTargetActionOptions {
  wakePhrases?: string[] | null;
  activeWindowMs?: number | null;
  silenceTimeoutMs?: number | null;
}

export type CaptureAnalyzeSessionState =
  | "idle"
  | "pending-launch"
  | "ready"
  | "capture-requested"
  | "result-ready"
  | "error";

export interface CaptureAnalyzeSessionStatus {
  state: CaptureAnalyzeSessionState;
  target: "analyze-compose";
  deviceId: string | null;
  previewMode: "phone-screen";
  pendingCommand: CaptureCompanionCommandKind | null;
  pendingInboxCount: number;
  lastCaptureAt: number | null;
  latestAsset: CaptureImportedAsset | null;
  message: string | null;
}

export interface CaptureBridgeStatus {
  state: "starting" | "ready" | "error";
  port: number;
  registeredDeviceId: string | null;
  lastSeenAt: number | null;
  lastError: string | null;
}

export interface CaptureOperationStatus {
  state: "idle" | "running" | "success" | "error" | "needs-confirmation";
  action: CaptureHostAction | null;
  message: string | null;
  progress: number | null;
  details: string[];
  updatedAt: number | null;
}

export interface CaptureServiceStatus {
  checkedAt: number;
  transcript: CaptureTranscriptStatusSnapshot;
  android: CaptureAndroidStatus;
  bridge: CaptureBridgeStatus;
  analyze: CaptureAnalyzeSessionStatus;
  operation: CaptureOperationStatus;
}

export type CaptureHostAction =
  | "install-companion"
  | "connect-device"
  | "disconnect-device"
  | "launch-companion"
  | "start-analyze-session"
  | "stop-analyze-session"
  | "capture-analyze-photo"
  | "retake-analyze-photo"
  | "start-analyze-dictation"
  | "stop-analyze-dictation"
  | "cancel-analyze-dictation"
  | "start-analyze-preview"
  | "stop-analyze-preview"
  | "start-ambient-listener"
  | "stop-ambient-listener";

export interface CaptureActionOutcome {
  action: CaptureHostAction;
  ok: boolean;
  message: string;
  status: CaptureServiceStatus;
}
