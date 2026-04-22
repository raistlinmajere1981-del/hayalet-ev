import type {
  CaptureActionOutcome,
  CaptureAndroidDeviceStatus,
  CaptureAndroidStatus,
  CaptureHostAction,
  CaptureImportedAsset,
  CaptureServiceStatus,
  CaptureTranscriptStatusSnapshot,
} from "../../../types/capture.js";

const FALLBACK_CAPTURE_STATUS: CaptureServiceStatus = {
  checkedAt: 0,
  transcript: {
    appLanguage: "tr",
    variant: "full",
    runtime: null,
  },
  android: {
    hostState: "missing-adb",
    adbPath: null,
    selectedDeviceId: null,
    companionPackage: "com.hayaletev.androidcompanion",
    previewMode: "phone-screen",
    reverseState: "not-configured",
    pairingHint: "Electron capture bridge is unavailable.",
    message: "Electron capture bridge is unavailable.",
    devices: [],
    artifact: {
      buildState: "missing",
      applicationId: "com.hayaletev.androidcompanion",
      mainActivity: "com.hayaletev.androidcompanion/.MainActivity",
      versionName: null,
      versionCode: null,
      apkPath: null,
      builtAt: null,
      sourceManifestPath: "",
      bridgePort: 48561,
    },
  },
  bridge: {
    state: "error",
    port: 48561,
    registeredDeviceId: null,
    lastSeenAt: null,
    lastError: "Electron capture bridge is unavailable.",
  },
  analyze: {
    state: "idle",
    target: "analyze-compose",
    deviceId: null,
    previewMode: "phone-screen",
    pendingCommand: null,
    pendingInboxCount: 0,
    lastCaptureAt: null,
    latestAsset: null,
    message: "Analyze phone capture session is unavailable.",
  },
  operation: {
    state: "idle",
    action: null,
    message: null,
    progress: null,
    details: [],
    updatedAt: null,
  },
};

function getElectronApi(): typeof window.electronAPI | undefined {
  return window.electronAPI;
}

function normalizeTranscriptSnapshot(value: unknown): CaptureTranscriptStatusSnapshot {
  if (
    typeof value === "object" &&
    value !== null &&
    "appLanguage" in value &&
    "variant" in value &&
    "runtime" in value
  ) {
    return value as CaptureTranscriptStatusSnapshot;
  }

  return FALLBACK_CAPTURE_STATUS.transcript;
}

function normalizeAndroidDevice(value: unknown): CaptureAndroidDeviceStatus | null {
  if (
    typeof value === "object" &&
    value !== null &&
    "deviceId" in value &&
    "label" in value &&
    "connectionState" in value
  ) {
    return value as CaptureAndroidDeviceStatus;
  }

  return null;
}

function normalizeAndroidStatus(value: unknown): CaptureAndroidStatus {
  if (
    typeof value === "object" &&
    value !== null &&
    "hostState" in value &&
    "devices" in value &&
    Array.isArray((value as CaptureAndroidStatus).devices)
  ) {
    return {
      ...(value as CaptureAndroidStatus),
      devices: (value as CaptureAndroidStatus).devices
        .map((entry) => normalizeAndroidDevice(entry))
        .filter((entry): entry is CaptureAndroidDeviceStatus => entry !== null),
    };
  }

  return FALLBACK_CAPTURE_STATUS.android;
}

function normalizeCaptureStatus(value: unknown): CaptureServiceStatus {
  if (
    typeof value === "object" &&
    value !== null &&
    "checkedAt" in value &&
    "transcript" in value &&
    "android" in value
  ) {
    const checkedAt = Number((value as CaptureServiceStatus).checkedAt);
    const rawOperation =
      typeof (value as CaptureServiceStatus).operation === "object"
        ? (value as CaptureServiceStatus).operation
        : null;
    return {
      ...FALLBACK_CAPTURE_STATUS,
      ...(value as CaptureServiceStatus),
      checkedAt: Number.isFinite(checkedAt) ? checkedAt : 0,
      transcript: normalizeTranscriptSnapshot((value as CaptureServiceStatus).transcript),
      android: normalizeAndroidStatus((value as CaptureServiceStatus).android),
      operation:
        rawOperation !== null
          ? {
              ...FALLBACK_CAPTURE_STATUS.operation,
              ...rawOperation,
              details: Array.isArray(rawOperation.details)
                ? rawOperation.details.filter(
                    (entry): entry is string => typeof entry === "string" && entry.trim() !== ""
                  )
                : FALLBACK_CAPTURE_STATUS.operation.details,
            }
          : FALLBACK_CAPTURE_STATUS.operation,
    };
  }

  return FALLBACK_CAPTURE_STATUS;
}

function normalizeImportedAsset(value: unknown): CaptureImportedAsset | null {
  if (
    typeof value === "object" &&
    value !== null &&
    "name" in value &&
    "originalName" in value &&
    "path" in value
  ) {
    return value as CaptureImportedAsset;
  }

  return null;
}

function normalizeActionOutcome(value: unknown, action: CaptureHostAction): CaptureActionOutcome {
  if (
    typeof value === "object" &&
    value !== null &&
    "ok" in value &&
    "message" in value &&
    "status" in value
  ) {
    const outcome = value as CaptureActionOutcome;
    return {
      action: outcome.action,
      ok: outcome.ok,
      message: outcome.message,
      status: normalizeCaptureStatus(outcome.status),
    };
  }

  if (typeof value === "object" && value !== null && "error" in value) {
    const rawError = (value as { error?: unknown }).error;
    const errorMessage =
      typeof rawError === "string" && rawError.trim() !== ""
        ? rawError.trim()
        : "Capture action is unavailable.";
    return {
      action,
      ok: false,
      message: errorMessage,
      status: FALLBACK_CAPTURE_STATUS,
    };
  }

  return {
    action,
    ok: false,
    message: "Capture action is unavailable.",
    status: FALLBACK_CAPTURE_STATUS,
  };
}

export async function getCaptureStatus(): Promise<CaptureServiceStatus> {
  const api = getElectronApi();
  if (typeof api?.captureStatus !== "function") {
    return FALLBACK_CAPTURE_STATUS;
  }

  return normalizeCaptureStatus(await api.captureStatus());
}

export async function refreshCaptureStatus(): Promise<CaptureServiceStatus> {
  const api = getElectronApi();
  if (typeof api?.captureRefreshStatus !== "function") {
    return FALLBACK_CAPTURE_STATUS;
  }

  return normalizeCaptureStatus(await api.captureRefreshStatus());
}

export async function consumeAnalyzeCaptureAssets(): Promise<CaptureImportedAsset[]> {
  const api = getElectronApi();
  if (typeof api?.captureConsumeAnalyzeAssets !== "function") {
    return [];
  }

  const value = await api.captureConsumeAnalyzeAssets();
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((entry) => normalizeImportedAsset(entry))
    .filter((entry): entry is CaptureImportedAsset => entry !== null);
}

export async function runCaptureAction(action: CaptureHostAction): Promise<CaptureActionOutcome> {
  const api = getElectronApi();
  switch (action) {
    case "install-companion":
      return normalizeActionOutcome(
        typeof api?.captureInstallCompanion === "function"
          ? await api.captureInstallCompanion()
          : null,
        action
      );
    case "launch-companion":
      return normalizeActionOutcome(
        typeof api?.captureLaunchCompanion === "function"
          ? await api.captureLaunchCompanion()
          : null,
        action
      );
    case "start-analyze-session":
      return normalizeActionOutcome(
        typeof api?.captureStartAnalyzeSession === "function"
          ? await api.captureStartAnalyzeSession()
          : null,
        action
      );
    case "stop-analyze-session":
      return normalizeActionOutcome(
        typeof api?.captureStopAnalyzeSession === "function"
          ? await api.captureStopAnalyzeSession()
          : null,
        action
      );
    case "capture-analyze-photo":
      return normalizeActionOutcome(
        typeof api?.captureRequestAnalyzePhoto === "function"
          ? await api.captureRequestAnalyzePhoto()
          : null,
        action
      );
    case "retake-analyze-photo":
      return normalizeActionOutcome(
        typeof api?.captureRetakeAnalyzePhoto === "function"
          ? await api.captureRetakeAnalyzePhoto()
          : null,
        action
      );
    case "connect-device":
      return normalizeActionOutcome(null, action);
    case "disconnect-device":
      return normalizeActionOutcome(null, action);
    default:
      return normalizeActionOutcome(null, action);
  }
}

export async function connectCaptureDevice(address: string): Promise<CaptureActionOutcome> {
  const api = getElectronApi();
  return normalizeActionOutcome(
    typeof api?.captureConnectDevice === "function" ? await api.captureConnectDevice(address) : null,
    "connect-device"
  );
}

export async function disconnectCaptureDevice(deviceId: string): Promise<CaptureActionOutcome> {
  const api = getElectronApi();
  return normalizeActionOutcome(
    typeof api?.captureDisconnectDevice === "function"
      ? await api.captureDisconnectDevice(deviceId)
      : null,
    "disconnect-device"
  );
}

export async function confirmCaptureBootstrapInstall(): Promise<CaptureActionOutcome> {
  const api = getElectronApi();
  return normalizeActionOutcome(
    typeof api?.captureInstallCompanion === "function"
      ? await api.captureInstallCompanion({ allowBootstrap: true })
      : null,
    "install-companion"
  );
}

export async function dismissCaptureOperation(): Promise<CaptureServiceStatus> {
  const api = getElectronApi();
  if (typeof api?.captureDismissOperation !== "function") {
    return FALLBACK_CAPTURE_STATUS;
  }

  return normalizeCaptureStatus(await api.captureDismissOperation());
}
