import { getErrorMessage } from "@shared/index.js";
import { AppI18n } from "../../../modules/i18n/index.js";
import {
  confirmCaptureBootstrapInstall,
  connectCaptureDevice,
  dismissCaptureOperation,
  disconnectCaptureDevice,
  getCaptureStatus,
  refreshCaptureStatus,
  runCaptureAction,
} from "../../../modules/capture/electron-client.js";
import { SettingsManager } from "../../../modules/settings-manager.js";
import { notifyUser } from "../../../ui/user-notification.js";
import { CaptureTranscriptRuntimePanel } from "../capture/transcript-runtime-panel.js";
import { registerSettingsPanelLifecycle } from "../controller.js";
import { applySettingsPanelStaticTranslations } from "../panel-i18n.js";
import {
  DEFAULT_CAPTURE_COMMAND_PHRASES,
  normalizeCapturePhraseList,
} from "../../../../../shared/capture/command-catalog.js";
import {
  DEFAULT_AMBIENT_ACTIVE_WINDOW_MS,
  DEFAULT_AMBIENT_SILENCE_TIMEOUT_MS,
  DEFAULT_AMBIENT_WAKE_PHRASES,
  normalizeAmbientDurationMs,
  normalizeAmbientWakePhrases,
} from "../../../../../shared/capture/ambient-defaults.js";
import type {
  CaptureActionOutcome,
  CaptureAndroidBuildDependencyStatus,
  CaptureAndroidDeviceStatus,
  CaptureHostDependencyState,
  CaptureHostAction,
  CaptureHostToolDependencyStatus,
  CaptureServiceStatus,
} from "../../../../types/capture.js";
import type { CaptureCommandPhraseSettings } from "../../../../types/settings.js";

let initialized = false;

function captureT(key: string): string {
  return AppI18n.t(`entrance.capture.${key}`);
}

const CAPTURE_VOICE_COMMAND_FIELDS = [
  { key: "openCamera", inputId: "capture-voice-command-open-camera-input" },
  { key: "capture", inputId: "capture-voice-command-capture-input" },
  { key: "stop", inputId: "capture-voice-command-stop-input" },
] as const;

type CaptureVoiceCommandKey = (typeof CAPTURE_VOICE_COMMAND_FIELDS)[number]["key"];

type CapturePanelState = {
  loading: boolean;
  actionLoading: boolean;
  error: string | null;
  status: CaptureServiceStatus | null;
  actionProgressTimer: number | null;
};

function createDefaultState(): CapturePanelState {
  return {
    loading: false,
    actionLoading: false,
    error: null,
    status: null,
    actionProgressTimer: null,
  };
}

function stopActionProgressPolling(state: CapturePanelState): void {
  if (state.actionProgressTimer !== null) {
    window.clearInterval(state.actionProgressTimer);
    state.actionProgressTimer = null;
  }
}

function startActionProgressPolling(root: HTMLElement, state: CapturePanelState): void {
  stopActionProgressPolling(state);
  state.actionProgressTimer = window.setInterval(() => {
    void refreshCaptureStatus()
      .then((status) => {
        state.status = status;
        renderAndroidManagementState(root, state);
        renderHostDependencies(root, state);
        syncActionButtons(root, state);
      })
      .catch(() => {});
  }, 700);
}

function primeActionProgress(
  state: CapturePanelState,
  root: HTMLElement,
  action: CaptureHostAction,
  message = captureT("android.progress.starting")
): void {
  if (state.status === null) {
    return;
  }

  state.status = {
    ...state.status,
    operation: {
      state: "running",
      action,
      message,
      progress: 0.02,
      details: state.status.operation.details,
      updatedAt: Date.now(),
    },
  };
  renderAndroidManagementState(root, state);
  renderHostDependencies(root, state);
}

function describeOperationAction(action: CaptureHostAction | null): string {
  switch (action) {
    case null:
      return "Android companion";
    case "prepare-host-dependencies":
      return captureT("dependencies.actions.prepare");
    case "install-companion":
      return captureT("android.actions.install");
    case "launch-companion":
      return captureT("android.actions.open");
    case "connect-device":
      return captureT("android.actions.connect");
    case "disconnect-device":
      return captureT("android.actions.disconnect");
    case "start-analyze-session":
      return "Analyze capture";
    case "stop-analyze-session":
      return "Capture stop";
    case "start-analyze-preview":
      return "Analyze preview";
    case "stop-analyze-preview":
      return "Analyze preview stop";
    case "start-camera-feed":
      return "Camera feed";
    case "stop-camera-feed":
      return "Camera feed stop";
    case "start-interactive-mirror":
      return "Interactive mirror";
    case "stop-interactive-mirror":
      return "Interactive mirror stop";
    case "capture-analyze-photo":
      return "Phone capture";
    case "retake-analyze-photo":
      return "Phone retake";
    case "start-analyze-dictation":
      return "Android dictation";
    case "stop-analyze-dictation":
      return "Android dictation stop";
    case "cancel-analyze-dictation":
      return "Android dictation cancel";
    case "start-ambient-listener":
      return "Ambient listener";
    case "stop-ambient-listener":
      return "Ambient listener stop";
    case "start-tts":
      return "Android TTS";
    case "stop-tts":
      return "Android TTS stop";
    default:
      return "Android companion";
  }
}

function renderAndroidOperationState(root: HTMLElement, state: CapturePanelState): void {
  const shell = root.querySelector<HTMLElement>("#capture-android-progress-shell");
  const title = root.querySelector<HTMLElement>("#capture-android-progress-title");
  const percent = root.querySelector<HTMLElement>("#capture-android-progress-percent");
  const bar = root.querySelector<HTMLElement>("#capture-android-progress-bar");
  const message = root.querySelector<HTMLElement>("#capture-android-progress-message");
  const details = root.querySelector<HTMLElement>("#capture-android-progress-details");
  const actions = root.querySelector<HTMLElement>("#capture-android-progress-actions");
  const operation = state.status?.operation ?? null;

  if (
    !(shell instanceof HTMLElement) ||
    !(title instanceof HTMLElement) ||
    !(percent instanceof HTMLElement) ||
    !(bar instanceof HTMLElement) ||
    !(message instanceof HTMLElement) ||
    !(details instanceof HTMLElement) ||
    !(actions instanceof HTMLElement)
  ) {
    return;
  }

  const activeOperation = operation !== null && operation.state !== "idle";
  shell.classList.toggle("is-hidden", activeOperation !== true);

  if (activeOperation !== true) {
    title.textContent = "";
    percent.textContent = "";
    message.textContent = "";
    details.innerHTML = "";
    actions.classList.add("is-hidden");
    bar.style.width = "0%";
    shell.setAttribute("aria-valuenow", "0");
    return;
  }

  const progressValue = Math.max(0, Math.min(100, Math.round((operation.progress ?? 0) * 100)));
  title.textContent = describeOperationAction(operation.action);
  percent.textContent =
    operation.state === "running"
      ? `${String(progressValue)}%`
      : operation.state === "needs-confirmation"
        ? captureT("android.progress.states.confirmation")
        : operation.state === "success"
          ? captureT("android.progress.states.success")
          : captureT("android.progress.states.error");
  message.textContent = operation.message ?? "";
  details.innerHTML = "";
  operation.details.forEach((entry) => {
    const item = document.createElement("li");
    item.textContent = entry;
    details.appendChild(item);
  });
  actions.classList.toggle(
    "is-hidden",
    !(operation.state === "needs-confirmation" && operation.action === "install-companion")
  );
  bar.style.width = `${String(progressValue)}%`;
  shell.setAttribute("aria-valuenow", String(progressValue));
}

function setText(root: HTMLElement, selector: string, value: string): void {
  const element = root.querySelector<HTMLElement>(selector);
  if (element) {
    element.textContent = value;
  }
}

function getSelectedDevice(state: CapturePanelState): CaptureAndroidDeviceStatus | null {
  const androidStatus = state.status?.android ?? null;
  return (
    androidStatus?.devices.find((device) => device.selected) ??
    androidStatus?.devices.find((device) => device.connectionState === "device") ??
    null
  );
}

function getCaptureSettingsSnapshot(): NonNullable<
  ReturnType<typeof SettingsManager.getSnapshot>["capture"]
> {
  return SettingsManager.getSnapshot().capture ?? {};
}

function formatPermissionPair(
  camera: CaptureAndroidDeviceStatus["permissions"]["camera"],
  microphone: CaptureAndroidDeviceStatus["permissions"]["microphone"],
  root: HTMLElement
): string {
  const joiner = root.getAttribute("data-capture-permission-joiner") ?? " / ";
  return [
    captureT(`android.states.permission.${camera}`),
    captureT(`android.states.permission.${microphone}`),
  ].join(joiner);
}

function formatSelectedPermissions(state: CapturePanelState, root: HTMLElement): string {
  const selectedDevice = getSelectedDevice(state);
  if (selectedDevice === null) {
    return captureT("android.states.permissions.none");
  }

  return formatPermissionPair(
    selectedDevice.permissions.camera,
    selectedDevice.permissions.microphone,
    root
  );
}

function renderScrcpyLogList(root: HTMLElement, logs: string[]): void {
  const list = root.querySelector<HTMLElement>("#capture-scrcpy-log-list");
  if (!(list instanceof HTMLElement)) {
    return;
  }

  list.innerHTML = "";
  const visibleLogs = logs.length > 0 ? logs : [captureT("android.scrcpy.logsEmpty")];
  visibleLogs.forEach((logLine) => {
    const item = document.createElement("li");
    item.textContent = logLine;
    list.appendChild(item);
  });
}

function renderScrcpyManagementState(root: HTMLElement, state: CapturePanelState): void {
  const scrcpyStatus = state.status?.scrcpy ?? null;
  const activeMode = scrcpyStatus?.mode ?? "idle";
  const activeDevice = scrcpyStatus?.deviceId ?? captureT("android.scrcpy.none");
  const lastLogs = scrcpyStatus?.lastLogs ?? [];
  const latestLog = lastLogs[lastLogs.length - 1] ?? null;
  const feedback =
    scrcpyStatus?.lastError ??
    latestLog ??
    scrcpyStatus?.setupHint ??
    captureT("android.scrcpy.feedbackReady");

  setText(
    root,
    "#capture-scrcpy-available",
    scrcpyStatus?.available === true
      ? captureT("android.scrcpy.availableYes")
      : captureT("android.scrcpy.availableNo")
  );
  setText(
    root,
    "#capture-scrcpy-version",
    scrcpyStatus?.version ?? captureT("android.scrcpy.none")
  );
  setText(root, "#capture-scrcpy-mode", captureT(`android.scrcpy.modes.${activeMode}`));
  setText(root, "#capture-scrcpy-device", activeDevice);
  setText(root, "#capture-scrcpy-feedback", feedback);
  renderScrcpyLogList(root, lastLogs);
}

function formatHostDependencyState(value: CaptureHostDependencyState): string {
  return captureT(`dependencies.states.${value}`);
}

function appendDependencyMeta(container: HTMLElement, label: string, value: string | null): void {
  if (value === null || value.trim() === "") {
    return;
  }

  const item = document.createElement("div");
  item.className = "settings-capture-device-stat";

  const labelEl = document.createElement("span");
  labelEl.className = "settings-capture-stat-label";
  labelEl.textContent = label;

  const valueEl = document.createElement("strong");
  valueEl.textContent = value;

  item.append(labelEl, valueEl);
  container.appendChild(item);
}

function appendDependencyDetails(container: HTMLElement, details: string[]): void {
  const visibleDetails = details.filter((entry) => entry.trim() !== "").slice(0, 4);
  if (visibleDetails.length === 0) {
    return;
  }

  const list = document.createElement("ul");
  list.className = "settings-capture-progress-details";
  visibleDetails.forEach((entry) => {
    const item = document.createElement("li");
    item.textContent = entry;
    list.appendChild(item);
  });
  container.appendChild(list);
}

function renderToolDependencyCard(
  list: HTMLElement,
  title: string,
  dependency: CaptureHostToolDependencyStatus,
  metadata: Array<[string, string | null]>
): void {
  const article = document.createElement("article");
  article.className = "settings-capture-device-card";

  const header = document.createElement("div");
  header.className = "settings-capture-device-header";

  const titleWrap = document.createElement("div");
  titleWrap.className = "settings-capture-device-title";

  const titleEl = document.createElement("strong");
  titleEl.textContent = title;
  titleWrap.appendChild(titleEl);

  const stateEl = document.createElement("span");
  stateEl.className = "settings-capture-note";
  stateEl.textContent = formatHostDependencyState(dependency.state);
  titleWrap.appendChild(stateEl);
  header.appendChild(titleWrap);

  const stats = document.createElement("div");
  stats.className = "settings-capture-device-stats";
  metadata.forEach(([label, value]) => {
    appendDependencyMeta(stats, label, value);
  });

  const message = document.createElement("p");
  message.className = "settings-capture-note";
  message.textContent = dependency.message ?? formatHostDependencyState(dependency.state);

  article.append(header, stats, message);
  list.appendChild(article);
}

function renderAndroidBuildDependencyCard(
  list: HTMLElement,
  dependency: CaptureAndroidBuildDependencyStatus
): void {
  const article = document.createElement("article");
  article.className = "settings-capture-device-card";

  const header = document.createElement("div");
  header.className = "settings-capture-device-header";

  const titleWrap = document.createElement("div");
  titleWrap.className = "settings-capture-device-title";

  const titleEl = document.createElement("strong");
  titleEl.textContent = captureT("dependencies.items.androidBuild");
  titleWrap.appendChild(titleEl);

  const stateEl = document.createElement("span");
  stateEl.className = "settings-capture-note";
  stateEl.textContent = formatHostDependencyState(dependency.state);
  titleWrap.appendChild(stateEl);
  header.appendChild(titleWrap);

  const stats = document.createElement("div");
  stats.className = "settings-capture-device-stats";
  appendDependencyMeta(stats, captureT("dependencies.meta.javaHome"), dependency.javaHome);
  appendDependencyMeta(
    stats,
    captureT("dependencies.meta.androidSdkRoot"),
    dependency.androidSdkRoot
  );
  appendDependencyMeta(
    stats,
    captureT("dependencies.meta.needsConfirmation"),
    dependency.needsConfirmation
      ? captureT("dependencies.meta.yes")
      : captureT("dependencies.meta.no")
  );

  const message = document.createElement("p");
  message.className = "settings-capture-note";
  message.textContent = dependency.message ?? formatHostDependencyState(dependency.state);

  article.append(header, stats, message);
  appendDependencyDetails(article, dependency.details);
  list.appendChild(article);
}

function renderHostDependencies(root: HTMLElement, state: CapturePanelState): void {
  const summary = root.querySelector<HTMLElement>("#capture-host-dependencies-summary");
  const list = root.querySelector<HTMLElement>("#capture-host-dependencies-list");
  const dependencies = state.status?.hostDependencies ?? null;
  if (!(summary instanceof HTMLElement) || !(list instanceof HTMLElement)) {
    return;
  }

  list.innerHTML = "";
  if (dependencies === null) {
    summary.textContent = captureT("dependencies.loading");
    return;
  }

  const entries = [
    dependencies.adb.state,
    dependencies.scrcpy.state,
    dependencies.ffmpeg.state,
    dependencies.androidBuild.state,
  ];
  const readyCount = entries.filter((entry) => entry === "ready").length;
  summary.textContent = captureT("dependencies.summary")
    .replace("{ready}", String(readyCount))
    .replace("{total}", String(entries.length));

  renderToolDependencyCard(list, captureT("dependencies.items.adb"), dependencies.adb, [
    [captureT("dependencies.meta.path"), dependencies.adb.path],
    [captureT("dependencies.meta.version"), dependencies.adb.version],
  ]);
  renderToolDependencyCard(list, captureT("dependencies.items.scrcpy"), dependencies.scrcpy, [
    [captureT("dependencies.meta.path"), dependencies.scrcpy.path],
    [captureT("dependencies.meta.version"), dependencies.scrcpy.version],
  ]);
  renderToolDependencyCard(list, captureT("dependencies.items.ffmpeg"), dependencies.ffmpeg, [
    [captureT("dependencies.meta.path"), dependencies.ffmpeg.path],
    [captureT("dependencies.meta.version"), dependencies.ffmpeg.version],
    [captureT("dependencies.meta.ffprobe"), dependencies.ffmpeg.ffprobePath],
    [captureT("dependencies.meta.managedPath"), dependencies.ffmpeg.managedPath],
  ]);
  renderAndroidBuildDependencyCard(list, dependencies.androidBuild);
}

function formatDeviceConnection(device: CaptureAndroidDeviceStatus): string {
  return captureT(`android.states.connection.${device.connectionState}`);
}

function formatDeviceTransport(device: CaptureAndroidDeviceStatus): string {
  return captureT(`android.states.transport.${device.transport}`);
}

function formatDeviceCompanion(device: CaptureAndroidDeviceStatus): string {
  return captureT(`android.states.companion.${device.companionState}`);
}

function formatDeviceBridge(device: CaptureAndroidDeviceStatus): string {
  return captureT(`android.states.bridge.${device.bridgeState}`);
}

function formatDeviceHint(device: CaptureAndroidDeviceStatus): string {
  switch (device.connectionState) {
    case "unauthorized":
      return captureT("android.deviceHints.unauthorized");
    case "offline":
      return captureT("android.deviceHints.offline");
    case "device":
      return device.selected
        ? captureT("android.deviceHints.active")
        : captureT("android.deviceHints.ready");
    case "unknown":
      return captureT("android.deviceHints.unknown");
    default:
      return captureT("android.deviceHints.unknown");
  }
}

function shouldShowCaptureConfirmation(): boolean {
  return getCaptureSettingsSnapshot().defaults?.commandConfirmation !== "none";
}

function renderCaptureDefaults(root: HTMLElement, state: CapturePanelState): void {
  const settings = getCaptureSettingsSnapshot();
  const defaults = settings.defaults;
  const deviceSelect = root.querySelector<HTMLSelectElement>("#capture-default-device-select");
  const lensSelect = root.querySelector<HTMLSelectElement>("#capture-default-lens-select");
  const qualitySelect = root.querySelector<HTMLSelectElement>("#capture-default-quality-select");
  const attachSelect = root.querySelector<HTMLSelectElement>("#capture-default-attach-mode-select");
  const confirmationSelect = root.querySelector<HTMLSelectElement>(
    "#capture-default-confirmation-select"
  );
  const feedbackEl = root.querySelector<HTMLElement>("#capture-defaults-feedback");
  const devices = state.status?.android.devices ?? [];

  if (deviceSelect) {
    const previousValue = deviceSelect.value;
    deviceSelect.innerHTML = "";

    const noneOption = document.createElement("option");
    noneOption.value = "";
    noneOption.textContent = captureT("defaults.deviceOptions.auto");
    deviceSelect.appendChild(noneOption);

    devices
      .filter((device) => device.connectionState === "device")
      .forEach((device) => {
        const option = document.createElement("option");
        option.value = device.deviceId;
        option.textContent = `${device.label} (${formatDeviceTransport(device)})`;
        deviceSelect.appendChild(option);
      });

    deviceSelect.value = defaults?.preferredDeviceId ?? "";
    if (deviceSelect.value === "" && previousValue !== "") {
      deviceSelect.value = previousValue;
    }
  }

  if (lensSelect) {
    lensSelect.value = defaults?.defaultLens ?? "back";
  }
  if (qualitySelect) {
    qualitySelect.value = defaults?.photoQuality ?? "high";
  }
  if (attachSelect) {
    attachSelect.value = defaults?.attachMode ?? "manual-sync";
  }
  if (confirmationSelect) {
    confirmationSelect.value = defaults?.commandConfirmation ?? "toast";
  }
  if (feedbackEl) {
    feedbackEl.textContent = captureT("defaults.hint");
  }
}

function renderCaptureSpeechPolicy(root: HTMLElement): void {
  const settings = getCaptureSettingsSnapshot();
  const providers = settings.providers;
  const androidCompanionInput = root.querySelector<HTMLInputElement>(
    "#capture-provider-android-companion"
  );
  const androidDictationBackendSelect = root.querySelector<HTMLSelectElement>(
    "#capture-android-dictation-backend-select"
  );
  const feedbackEl = root.querySelector<HTMLElement>("#capture-policy-feedback");

  if (androidCompanionInput) {
    androidCompanionInput.checked = providers?.androidCompanionEnabled !== false;
  }
  if (androidDictationBackendSelect) {
    androidDictationBackendSelect.value = "vosk";
  }
  if (feedbackEl) {
    feedbackEl.textContent = captureT("policy.hint");
  }
}

function createDefaultCaptureVoiceCommandPhrases(): Required<CaptureCommandPhraseSettings> {
  return {
    openCamera: [...DEFAULT_CAPTURE_COMMAND_PHRASES.openCamera],
    capture: [...DEFAULT_CAPTURE_COMMAND_PHRASES.capture],
    stop: [...DEFAULT_CAPTURE_COMMAND_PHRASES.stop],
  };
}

function getCaptureVoiceCommandPhrases(): Required<CaptureCommandPhraseSettings> {
  const phrases = SettingsManager.getSnapshot().voiceCommands?.analyzePhrases;
  return {
    openCamera: normalizeCapturePhraseList(
      phrases?.openCamera,
      DEFAULT_CAPTURE_COMMAND_PHRASES.openCamera
    ),
    capture: normalizeCapturePhraseList(phrases?.capture, DEFAULT_CAPTURE_COMMAND_PHRASES.capture),
    stop: normalizeCapturePhraseList(phrases?.stop, DEFAULT_CAPTURE_COMMAND_PHRASES.stop),
  };
}

function parseCaptureVoiceCommandInput(
  root: HTMLElement,
  inputId: string,
  key: CaptureVoiceCommandKey
): string[] {
  const textarea = root.querySelector<HTMLTextAreaElement>(`#${inputId}`);
  const source = textarea?.value.split(/[\n,]/) ?? [];
  return normalizeCapturePhraseList(source, DEFAULT_CAPTURE_COMMAND_PHRASES[key]);
}

function readCaptureVoiceCommandPhrases(root: HTMLElement): Required<CaptureCommandPhraseSettings> {
  return {
    openCamera: parseCaptureVoiceCommandInput(
      root,
      "capture-voice-command-open-camera-input",
      "openCamera"
    ),
    capture: parseCaptureVoiceCommandInput(root, "capture-voice-command-capture-input", "capture"),
    stop: parseCaptureVoiceCommandInput(root, "capture-voice-command-stop-input", "stop"),
  };
}

function getAmbientVoiceCommandSettings(): {
  wakePhrases: string[];
  activeWindowMs: number;
  silenceTimeoutMs: number;
} {
  const ambient = SettingsManager.getSnapshot().voiceCommands?.ambient;
  return {
    wakePhrases: normalizeAmbientWakePhrases(ambient?.wakePhrases, DEFAULT_AMBIENT_WAKE_PHRASES),
    activeWindowMs: normalizeAmbientDurationMs(
      ambient?.activeWindowMs,
      DEFAULT_AMBIENT_ACTIVE_WINDOW_MS,
      { min: 1_000, max: 30_000 }
    ),
    silenceTimeoutMs: normalizeAmbientDurationMs(
      ambient?.silenceTimeoutMs,
      DEFAULT_AMBIENT_SILENCE_TIMEOUT_MS,
      { min: 300, max: 10_000 }
    ),
  };
}

function readAmbientVoiceCommandSettings(root: HTMLElement): {
  wakePhrases: string[];
  activeWindowMs: number;
  silenceTimeoutMs: number;
} {
  const wakeInput = root.querySelector<HTMLTextAreaElement>("#capture-ambient-wake-input");
  const activeWindowInput = root.querySelector<HTMLInputElement>(
    "#capture-ambient-active-window-input"
  );
  const silenceInput = root.querySelector<HTMLInputElement>("#capture-ambient-silence-input");
  return {
    wakePhrases: normalizeAmbientWakePhrases(
      wakeInput?.value.split(/[\n,]/),
      DEFAULT_AMBIENT_WAKE_PHRASES
    ),
    activeWindowMs: normalizeAmbientDurationMs(
      activeWindowInput?.value,
      DEFAULT_AMBIENT_ACTIVE_WINDOW_MS,
      { min: 1_000, max: 30_000 }
    ),
    silenceTimeoutMs: normalizeAmbientDurationMs(
      silenceInput?.value,
      DEFAULT_AMBIENT_SILENCE_TIMEOUT_MS,
      { min: 300, max: 10_000 }
    ),
  };
}

function renderCaptureVoiceCommands(root: HTMLElement): void {
  const voiceCommands = SettingsManager.getSnapshot().voiceCommands;
  const enabledInput = root.querySelector<HTMLInputElement>("#capture-voice-command-enabled");
  const feedbackEl = root.querySelector<HTMLElement>("#capture-voice-command-feedback");
  const phrases = getCaptureVoiceCommandPhrases();
  const ambient = getAmbientVoiceCommandSettings();

  if (enabledInput) {
    enabledInput.checked = voiceCommands?.analyzeEnabled === true;
  }

  CAPTURE_VOICE_COMMAND_FIELDS.forEach((field) => {
    const textarea = root.querySelector<HTMLTextAreaElement>(`#${field.inputId}`);
    if (textarea === null || document.activeElement === textarea) {
      return;
    }

    textarea.value = phrases[field.key].join("\n");
    textarea.placeholder = DEFAULT_CAPTURE_COMMAND_PHRASES[field.key].join(", ");
  });

  const ambientWakeInput = root.querySelector<HTMLTextAreaElement>("#capture-ambient-wake-input");
  const activeWindowInput = root.querySelector<HTMLInputElement>(
    "#capture-ambient-active-window-input"
  );
  const silenceInput = root.querySelector<HTMLInputElement>("#capture-ambient-silence-input");
  if (ambientWakeInput && document.activeElement !== ambientWakeInput) {
    ambientWakeInput.value = ambient.wakePhrases.join("\n");
    ambientWakeInput.placeholder = DEFAULT_AMBIENT_WAKE_PHRASES.join(", ");
  }
  if (activeWindowInput && document.activeElement !== activeWindowInput) {
    activeWindowInput.value = String(ambient.activeWindowMs);
  }
  if (silenceInput && document.activeElement !== silenceInput) {
    silenceInput.value = String(ambient.silenceTimeoutMs);
  }

  if (feedbackEl) {
    feedbackEl.textContent = captureT("voiceCommands.hint");
  }
}

function renderAndroidDeviceList(root: HTMLElement, state: CapturePanelState): void {
  const container = root.querySelector<HTMLElement>("#capture-android-device-list");
  if (!(container instanceof HTMLElement)) {
    return;
  }

  const devices = state.status?.android.devices ?? [];
  container.innerHTML = "";

  if (devices.length === 0) {
    const empty = document.createElement("p");
    empty.className = "settings-capture-note";
    empty.textContent = captureT("android.deviceList.empty");
    container.appendChild(empty);
    return;
  }

  devices.forEach((device) => {
    const article = document.createElement("article");
    article.className = "settings-capture-device-card";
    if (device.selected) {
      article.classList.add("is-selected");
    }

    const header = document.createElement("div");
    header.className = "settings-capture-device-header";

    const titleWrap = document.createElement("div");
    titleWrap.className = "settings-capture-device-title";

    const title = document.createElement("strong");
    title.textContent = device.label;
    titleWrap.appendChild(title);

    const meta = document.createElement("span");
    meta.className = "settings-capture-note";
    meta.textContent = `${device.deviceId} · ${formatDeviceTransport(device)}`;
    titleWrap.appendChild(meta);

    header.appendChild(titleWrap);

    const actions = document.createElement("div");
    actions.className = "settings-capture-actions";

    const selectButton = document.createElement("button");
    selectButton.type = "button";
    selectButton.className = "btn btn-secondary btn-sm";
    selectButton.dataset["deviceId"] = device.deviceId;
    selectButton.dataset["deviceAction"] = "select";
    if (device.connectionState === "device") {
      selectButton.textContent = device.selected
        ? captureT("android.actions.activeDevice")
        : captureT("android.actions.useDevice");
      selectButton.disabled = state.loading || state.actionLoading || device.selected;
    } else {
      selectButton.textContent = captureT("android.actions.inspectOnly");
      selectButton.disabled = true;
    }
    actions.appendChild(selectButton);

    if (device.transport === "wireless") {
      const disconnectButton = document.createElement("button");
      disconnectButton.type = "button";
      disconnectButton.className = "btn btn-secondary btn-sm";
      disconnectButton.dataset["deviceId"] = device.deviceId;
      disconnectButton.dataset["deviceAction"] = "disconnect";
      disconnectButton.textContent = captureT("android.actions.disconnect");
      disconnectButton.disabled = state.loading || state.actionLoading;
      actions.appendChild(disconnectButton);
    }
    header.appendChild(actions);

    const stats = document.createElement("div");
    stats.className = "settings-capture-device-stats";
    const fields: Array<[string, string]> = [
      [captureT("android.deviceList.connection"), formatDeviceConnection(device)],
      [captureT("android.deviceList.companion"), formatDeviceCompanion(device)],
      [captureT("android.deviceList.bridge"), formatDeviceBridge(device)],
      [
        captureT("android.deviceList.permissions"),
        formatPermissionPair(device.permissions.camera, device.permissions.microphone, root),
      ],
    ];

    fields.forEach(([label, value]) => {
      const stat = document.createElement("div");
      stat.className = "settings-capture-device-stat";

      const labelEl = document.createElement("span");
      labelEl.className = "settings-capture-stat-label";
      labelEl.textContent = label;

      const valueEl = document.createElement("strong");
      valueEl.textContent = value;

      stat.append(labelEl, valueEl);
      stats.appendChild(stat);
    });

    const hint = document.createElement("p");
    hint.className = "settings-capture-note";
    hint.textContent = formatDeviceHint(device);

    article.append(header, stats, hint);
    container.appendChild(article);
  });
}

function renderAndroidManagementState(root: HTMLElement, state: CapturePanelState): void {
  const androidStatus = state.status?.android ?? null;
  const bridgeStatus = state.status?.bridge ?? null;
  const selectedDevice = getSelectedDevice(state);
  const hostStatus = state.loading ? "checking" : (androidStatus?.hostState ?? "checking");
  const companionState = selectedDevice?.companionState ?? "unknown";
  const actionLabelKey =
    companionState === "outdated"
      ? "android.actions.update"
      : companionState === "installed"
        ? "android.actions.reinstall"
        : "android.actions.install";

  setText(root, "#capture-android-host-status", captureT(`android.states.host.${hostStatus}`));
  setText(root, "#capture-android-device-count", String(androidStatus?.devices.length ?? 0));
  setText(
    root,
    "#capture-android-active-device",
    selectedDevice?.label ?? captureT("android.states.activeDevice.none")
  );
  setText(
    root,
    "#capture-android-companion-status",
    captureT(`android.states.companion.${companionState}`)
  );
  setText(
    root,
    "#capture-android-preview-status",
    captureT(`android.states.preview.${androidStatus?.previewMode ?? "scrcpy-camera"}`)
  );
  setText(root, "#capture-android-preview-note", captureT("android.previewHint"));
  renderScrcpyManagementState(root, state);
  setText(
    root,
    "#capture-android-bridge-status",
    captureT(`android.states.bridge.${selectedDevice?.bridgeState ?? "waiting"}`)
  );
  setText(root, "#capture-android-permissions", formatSelectedPermissions(state, root));
  setText(
    root,
    "#capture-android-reverse-status",
    captureT(`android.states.reverse.${androidStatus?.reverseState ?? "not-configured"}`)
  );
  setText(
    root,
    "#capture-android-expected-version",
    androidStatus?.artifact.versionName ?? captureT("android.states.expectedVersion.none")
  );
  setText(
    root,
    "#capture-android-pairing-hint",
    androidStatus?.pairingHint ?? captureT("android.feedback.ready")
  );
  setText(
    root,
    "#capture-android-feedback",
    state.error ??
      androidStatus?.message ??
      bridgeStatus?.lastError ??
      captureT(`android.feedback.${hostStatus}`)
  );

  const installButton = root.querySelector<HTMLButtonElement>("#capture-android-install-btn");
  if (installButton) {
    installButton.textContent = captureT(actionLabelKey);
  }

  renderAndroidDeviceList(root, state);
  renderAndroidOperationState(root, state);
}

function syncActionButtons(root: HTMLElement, state: CapturePanelState): void {
  const androidStatus = state.status?.android ?? null;
  const operationState = state.status?.operation ?? null;
  const selectedDevice = getSelectedDevice(state);
  const providerSettings = getCaptureSettingsSnapshot().providers;
  const androidCompanionEnabled = providerSettings?.androidCompanionEnabled !== false;
  const busy =
    state.loading || state.actionLoading || operationState?.state === "needs-confirmation";
  const installButton = root.querySelector<HTMLButtonElement>("#capture-android-install-btn");
  const openButton = root.querySelector<HTMLButtonElement>("#capture-android-open-btn");
  const refreshButton = root.querySelector<HTMLButtonElement>("#capture-android-refresh-btn");
  const scanButton = root.querySelector<HTMLButtonElement>("#capture-android-scan-btn");
  const connectButton = root.querySelector<HTMLButtonElement>("#capture-android-connect-btn");
  const connectInput = root.querySelector<HTMLInputElement>("#capture-android-connect-address");
  const confirmInstallButton = root.querySelector<HTMLButtonElement>(
    "#capture-android-progress-confirm-btn"
  );
  const cancelInstallButton = root.querySelector<HTMLButtonElement>(
    "#capture-android-progress-cancel-btn"
  );
  const prepareDependenciesButton = root.querySelector<HTMLButtonElement>(
    "#capture-host-dependencies-prepare-btn"
  );
  const refreshDependenciesButton = root.querySelector<HTMLButtonElement>(
    "#capture-host-dependencies-refresh-btn"
  );

  if (prepareDependenciesButton) {
    prepareDependenciesButton.disabled = busy;
  }
  if (refreshDependenciesButton) {
    refreshDependenciesButton.disabled = busy;
  }
  if (scanButton) {
    scanButton.disabled = busy;
  }
  if (refreshButton) {
    refreshButton.disabled = busy;
  }
  if (connectInput) {
    connectInput.disabled =
      busy || androidStatus?.adbPath === null || androidCompanionEnabled !== true;
  }
  if (connectButton) {
    connectButton.disabled =
      busy ||
      androidStatus?.adbPath === null ||
      androidCompanionEnabled !== true ||
      (connectInput?.value.trim() ?? "") === "";
  }
  if (installButton) {
    installButton.disabled =
      busy ||
      selectedDevice === null ||
      androidStatus?.adbPath === null ||
      androidCompanionEnabled !== true;
  }
  if (openButton) {
    openButton.disabled =
      busy ||
      selectedDevice === null ||
      androidStatus?.adbPath === null ||
      androidCompanionEnabled !== true ||
      (selectedDevice.companionState !== "installed" &&
        selectedDevice.companionState !== "outdated");
  }
  if (confirmInstallButton) {
    confirmInstallButton.disabled = state.actionLoading;
  }
  if (cancelInstallButton) {
    cancelInstallButton.disabled = state.actionLoading;
  }

  root
    .querySelectorAll<HTMLButtonElement>("#capture-android-device-list [data-device-id]")
    .forEach((button) => {
      const device =
        androidStatus?.devices.find((entry) => entry.deviceId === button.dataset["deviceId"]) ??
        null;
      if (button.dataset["deviceAction"] === "disconnect") {
        button.disabled = busy || device?.transport !== "wireless";
        return;
      }

      button.disabled =
        busy || device === null || device.selected || device.connectionState !== "device";
    });
}

async function loadAndroidState(
  state: CapturePanelState,
  root: HTMLElement,
  forceRefresh = false
): Promise<void> {
  state.loading = true;
  state.error = null;
  renderAndroidManagementState(root, state);
  renderHostDependencies(root, state);
  renderCaptureDefaults(root, state);
  renderCaptureSpeechPolicy(root);
  syncActionButtons(root, state);

  try {
    state.status = forceRefresh ? await refreshCaptureStatus() : await getCaptureStatus();
  } catch (error) {
    state.error = getErrorMessage(error);
  } finally {
    state.loading = false;
    renderAndroidManagementState(root, state);
    renderHostDependencies(root, state);
    renderCaptureDefaults(root, state);
    renderCaptureSpeechPolicy(root);
    syncActionButtons(root, state);
  }
}

async function runAndSyncCaptureAction(
  state: CapturePanelState,
  root: HTMLElement,
  action: CaptureActionOutcome["action"],
  options?: {
    execute?: () => Promise<CaptureActionOutcome>;
    progressMessage?: string;
  }
): Promise<void> {
  state.actionLoading = true;
  state.error = null;
  primeActionProgress(state, root, action, options?.progressMessage);
  syncActionButtons(root, state);
  startActionProgressPolling(root, state);

  try {
    const outcome =
      typeof options?.execute === "function"
        ? await options.execute()
        : await runCaptureAction(action);
    state.status = outcome.status;
    const waitingConfirmation = outcome.status.operation.state === "needs-confirmation";
    if (waitingConfirmation !== true && (outcome.ok !== true || shouldShowCaptureConfirmation())) {
      notifyUser({
        kind: outcome.ok ? "success" : "error",
        title: outcome.message,
        dedupeKey: `settings-capture-${action}`,
      });
    }
  } catch (error) {
    state.error = getErrorMessage(error);
    notifyUser({
      kind: "error",
      title: state.error,
      dedupeKey: `settings-capture-${action}-error`,
    });
  } finally {
    state.actionLoading = false;
    stopActionProgressPolling(state);
    renderAndroidManagementState(root, state);
    renderHostDependencies(root, state);
    renderCaptureDefaults(root, state);
    renderCaptureSpeechPolicy(root);
    syncActionButtons(root, state);
  }
}

async function saveCapturePolicy(root: HTMLElement, state: CapturePanelState): Promise<void> {
  const deviceSelect = root.querySelector<HTMLSelectElement>("#capture-default-device-select");
  const lensSelect = root.querySelector<HTMLSelectElement>("#capture-default-lens-select");
  const qualitySelect = root.querySelector<HTMLSelectElement>("#capture-default-quality-select");
  const attachSelect = root.querySelector<HTMLSelectElement>("#capture-default-attach-mode-select");
  const confirmationSelect = root.querySelector<HTMLSelectElement>(
    "#capture-default-confirmation-select"
  );
  const androidCompanionEnabled = root.querySelector<HTMLInputElement>(
    "#capture-provider-android-companion"
  );
  const androidDictationBackendSelect = root.querySelector<HTMLSelectElement>(
    "#capture-android-dictation-backend-select"
  );

  await SettingsManager.patch((settings) => {
    const nextCapture = (settings["capture"] ?? {}) as Record<string, unknown>;
    const nextDefaults = (nextCapture["defaults"] ?? {}) as Record<string, unknown>;
    const nextProviders = (nextCapture["providers"] ?? {}) as Record<string, unknown>;

    nextDefaults["preferredDeviceId"] =
      deviceSelect && deviceSelect.value.trim() !== "" ? deviceSelect.value.trim() : null;
    nextDefaults["defaultLens"] = lensSelect?.value === "front" ? "front" : "back";
    nextDefaults["photoQuality"] = qualitySelect?.value === "balanced" ? "balanced" : "high";
    nextDefaults["attachMode"] =
      attachSelect?.value === "auto-stage" ? "auto-stage" : "manual-sync";
    nextDefaults["commandConfirmation"] = confirmationSelect?.value === "none" ? "none" : "toast";
    void androidDictationBackendSelect;
    nextDefaults["androidDictationBackend"] = "vosk";

    nextProviders["androidCompanionEnabled"] = androidCompanionEnabled?.checked !== false;

    nextCapture["defaults"] = nextDefaults;
    nextCapture["providers"] = nextProviders;
    delete nextCapture["commandPhrases"];
    settings["capture"] = nextCapture;
  });

  renderCaptureDefaults(root, state);
  renderCaptureSpeechPolicy(root);
  if (shouldShowCaptureConfirmation()) {
    notifyUser({
      kind: "success",
      title: captureT("defaults.saved"),
      dedupeKey: "settings-capture-defaults-saved",
    });
  }
}

async function saveCaptureVoiceCommands(root: HTMLElement): Promise<void> {
  const enabledInput = root.querySelector<HTMLInputElement>("#capture-voice-command-enabled");
  const analyzeEnabled = enabledInput?.checked === true;
  const analyzePhrases = readCaptureVoiceCommandPhrases(root);
  const ambient = readAmbientVoiceCommandSettings(root);

  await SettingsManager.patch((settings) => {
    const nextVoiceCommands = (settings["voiceCommands"] ?? {}) as Record<string, unknown>;
    nextVoiceCommands["analyzeEnabled"] = analyzeEnabled;
    nextVoiceCommands["analyzePhrases"] = analyzePhrases;
    nextVoiceCommands["ambient"] = ambient;
    delete nextVoiceCommands["commandPhrases"];
    settings["voiceCommands"] = nextVoiceCommands;
  });

  renderCaptureVoiceCommands(root);
  notifyUser({
    kind: "success",
    title: captureT("voiceCommands.saved"),
    dedupeKey: "settings-capture-voice-commands-saved",
  });
}

async function resetCaptureVoiceCommandDefaults(root: HTMLElement): Promise<void> {
  const enabledInput = root.querySelector<HTMLInputElement>("#capture-voice-command-enabled");
  const analyzeEnabled =
    enabledInput instanceof HTMLInputElement
      ? enabledInput.checked
      : SettingsManager.getSnapshot().voiceCommands?.analyzeEnabled === true;
  const analyzePhrases = createDefaultCaptureVoiceCommandPhrases();
  const ambient = {
    wakePhrases: [...DEFAULT_AMBIENT_WAKE_PHRASES],
    activeWindowMs: DEFAULT_AMBIENT_ACTIVE_WINDOW_MS,
    silenceTimeoutMs: DEFAULT_AMBIENT_SILENCE_TIMEOUT_MS,
  };

  await SettingsManager.patch((settings) => {
    const nextVoiceCommands = (settings["voiceCommands"] ?? {}) as Record<string, unknown>;
    nextVoiceCommands["analyzeEnabled"] = analyzeEnabled;
    nextVoiceCommands["analyzePhrases"] = analyzePhrases;
    nextVoiceCommands["ambient"] = ambient;
    delete nextVoiceCommands["commandPhrases"];
    settings["voiceCommands"] = nextVoiceCommands;
  });

  renderCaptureVoiceCommands(root);
  notifyUser({
    kind: "success",
    title: captureT("voiceCommands.resetSaved"),
    dedupeKey: "settings-capture-voice-commands-reset",
  });
}

async function setPreferredDevice(
  root: HTMLElement,
  state: CapturePanelState,
  deviceId: string
): Promise<void> {
  const device = state.status?.android.devices.find((entry) => entry.deviceId === deviceId) ?? null;
  if (device?.connectionState !== "device") {
    return;
  }

  await SettingsManager.patch((settings) => {
    const nextCapture = (settings["capture"] ?? {}) as Record<string, unknown>;
    const nextDefaults = (nextCapture["defaults"] ?? {}) as Record<string, unknown>;
    nextDefaults["preferredDeviceId"] = deviceId;
    nextCapture["defaults"] = nextDefaults;
    settings["capture"] = nextCapture;
  });

  await loadAndroidState(state, root, true);
  if (shouldShowCaptureConfirmation()) {
    notifyUser({
      kind: "success",
      title: captureT("android.deviceList.preferredSaved"),
      dedupeKey: `settings-capture-device-${deviceId}`,
    });
  }
}

function bindActions(root: HTMLElement, state: CapturePanelState): void {
  const scanButton = root.querySelector<HTMLButtonElement>("#capture-android-scan-btn");
  const refreshButton = root.querySelector<HTMLButtonElement>("#capture-android-refresh-btn");
  const prepareDependenciesButton = root.querySelector<HTMLButtonElement>(
    "#capture-host-dependencies-prepare-btn"
  );
  const refreshDependenciesButton = root.querySelector<HTMLButtonElement>(
    "#capture-host-dependencies-refresh-btn"
  );
  const installButton = root.querySelector<HTMLButtonElement>("#capture-android-install-btn");
  const openButton = root.querySelector<HTMLButtonElement>("#capture-android-open-btn");
  const connectButton = root.querySelector<HTMLButtonElement>("#capture-android-connect-btn");
  const connectInput = root.querySelector<HTMLInputElement>("#capture-android-connect-address");
  const voiceCommandSaveButton = root.querySelector<HTMLButtonElement>(
    "#capture-voice-command-save-btn"
  );
  const voiceCommandResetButton = root.querySelector<HTMLButtonElement>(
    "#capture-voice-command-reset-btn"
  );
  const confirmInstallButton = root.querySelector<HTMLButtonElement>(
    "#capture-android-progress-confirm-btn"
  );
  const cancelInstallButton = root.querySelector<HTMLButtonElement>(
    "#capture-android-progress-cancel-btn"
  );
  const policyInputs = [
    root.querySelector<HTMLSelectElement>("#capture-default-device-select"),
    root.querySelector<HTMLSelectElement>("#capture-default-lens-select"),
    root.querySelector<HTMLSelectElement>("#capture-default-quality-select"),
    root.querySelector<HTMLSelectElement>("#capture-default-attach-mode-select"),
    root.querySelector<HTMLSelectElement>("#capture-default-confirmation-select"),
    root.querySelector<HTMLInputElement>("#capture-provider-android-companion"),
    root.querySelector<HTMLSelectElement>("#capture-android-dictation-backend-select"),
  ];
  const deviceList = root.querySelector<HTMLElement>("#capture-android-device-list");

  if (scanButton) {
    scanButton.onclick = (): void => {
      void loadAndroidState(state, root, true);
    };
  }
  if (refreshButton) {
    refreshButton.onclick = (): void => {
      void loadAndroidState(state, root, true);
    };
  }
  if (prepareDependenciesButton) {
    prepareDependenciesButton.onclick = (): void => {
      void runAndSyncCaptureAction(state, root, "prepare-host-dependencies", {
        progressMessage: captureT("dependencies.progress.starting"),
      });
    };
  }
  if (refreshDependenciesButton) {
    refreshDependenciesButton.onclick = (): void => {
      void loadAndroidState(state, root, true);
    };
  }
  if (installButton) {
    installButton.onclick = (): void => {
      void runAndSyncCaptureAction(state, root, "install-companion");
    };
  }
  if (confirmInstallButton) {
    confirmInstallButton.onclick = (): void => {
      void runAndSyncCaptureAction(state, root, "install-companion", {
        execute: confirmCaptureBootstrapInstall,
        progressMessage: captureT("android.progress.bootstrapStarting"),
      });
    };
  }
  if (cancelInstallButton) {
    cancelInstallButton.onclick = (): void => {
      state.actionLoading = true;
      syncActionButtons(root, state);
      void dismissCaptureOperation()
        .then((status) => {
          state.status = status;
        })
        .catch((error) => {
          state.error = getErrorMessage(error);
          notifyUser({
            kind: "error",
            title: state.error,
            dedupeKey: "settings-capture-dismiss-error",
          });
        })
        .finally(() => {
          state.actionLoading = false;
          renderAndroidManagementState(root, state);
          renderHostDependencies(root, state);
          renderCaptureDefaults(root, state);
          renderCaptureSpeechPolicy(root);
          syncActionButtons(root, state);
        });
    };
  }
  if (openButton) {
    openButton.onclick = (): void => {
      void runAndSyncCaptureAction(state, root, "launch-companion");
    };
  }
  if (connectButton && connectInput) {
    const runConnect = (): void => {
      const address = connectInput.value.trim();
      if (address === "") {
        return;
      }

      state.actionLoading = true;
      primeActionProgress(state, root, "connect-device");
      syncActionButtons(root, state);
      startActionProgressPolling(root, state);
      void connectCaptureDevice(address)
        .then((outcome) => {
          state.status = outcome.status;
          if (outcome.ok !== true || shouldShowCaptureConfirmation()) {
            notifyUser({
              kind: outcome.ok ? "success" : "error",
              title: outcome.message,
              dedupeKey: `settings-capture-connect-${address}`,
            });
          }
        })
        .catch((error) => {
          state.error = getErrorMessage(error);
          notifyUser({
            kind: "error",
            title: state.error,
            dedupeKey: `settings-capture-connect-${address}-error`,
          });
        })
        .finally(() => {
          state.actionLoading = false;
          stopActionProgressPolling(state);
          renderAndroidManagementState(root, state);
          renderHostDependencies(root, state);
          renderCaptureDefaults(root, state);
          renderCaptureSpeechPolicy(root);
          syncActionButtons(root, state);
        });
    };

    connectButton.onclick = runConnect;
    connectInput.oninput = (): void => {
      syncActionButtons(root, state);
    };
  }

  if (voiceCommandSaveButton) {
    voiceCommandSaveButton.onclick = (): void => {
      void saveCaptureVoiceCommands(root);
    };
  }
  if (voiceCommandResetButton) {
    voiceCommandResetButton.onclick = (): void => {
      void resetCaptureVoiceCommandDefaults(root);
    };
  }

  policyInputs.forEach((element) => {
    if (!(element instanceof HTMLSelectElement) && !(element instanceof HTMLInputElement)) {
      return;
    }

    const handler = (): void => {
      void saveCapturePolicy(root, state);
    };

    if (element instanceof HTMLInputElement && element.type === "text") {
      element.onblur = handler;
      return;
    }

    element.onchange = handler;
  });

  if (deviceList) {
    deviceList.onclick = (event: MouseEvent): void => {
      const target = event.target;
      if (!(target instanceof HTMLElement)) {
        return;
      }

      const button = target.closest<HTMLButtonElement>("[data-device-id]");
      const deviceId = button?.dataset["deviceId"]?.trim() ?? "";
      if (deviceId === "") {
        return;
      }

      if (button?.dataset["deviceAction"] === "disconnect") {
        state.actionLoading = true;
        primeActionProgress(state, root, "disconnect-device");
        syncActionButtons(root, state);
        startActionProgressPolling(root, state);
        void disconnectCaptureDevice(deviceId)
          .then((outcome) => {
            state.status = outcome.status;
            if (outcome.ok !== true || shouldShowCaptureConfirmation()) {
              notifyUser({
                kind: outcome.ok ? "success" : "error",
                title: outcome.message,
                dedupeKey: `settings-capture-disconnect-${deviceId}`,
              });
            }
          })
          .catch((error) => {
            state.error = getErrorMessage(error);
            notifyUser({
              kind: "error",
              title: state.error,
              dedupeKey: `settings-capture-disconnect-${deviceId}-error`,
            });
          })
          .finally(() => {
            state.actionLoading = false;
            stopActionProgressPolling(state);
            renderAndroidManagementState(root, state);
            renderHostDependencies(root, state);
            renderCaptureDefaults(root, state);
            renderCaptureSpeechPolicy(root);
            syncActionButtons(root, state);
          });
        return;
      }

      void setPreferredDevice(root, state, deviceId);
    };
  }
}

export function setupSettingsCapturePanel(): void {
  if (initialized) {
    return;
  }

  const root = document.getElementById("settings-panel-capture");
  if (!(root instanceof HTMLElement)) {
    return;
  }

  root.setAttribute("data-capture-permission-joiner", " / ");

  const transcriptPanel = new CaptureTranscriptRuntimePanel(SettingsManager, root);
  const state = createDefaultState();

  const renderAll = (): void => {
    applySettingsPanelStaticTranslations(root);
    transcriptPanel.render();
    renderAndroidManagementState(root, state);
    renderHostDependencies(root, state);
    renderCaptureDefaults(root, state);
    renderCaptureSpeechPolicy(root);
    renderCaptureVoiceCommands(root);
    syncActionButtons(root, state);
  };

  bindActions(root, state);

  registerSettingsPanelLifecycle("capture", {
    onEnter: () => {
      stopActionProgressPolling(state);
      renderAll();
      void loadAndroidState(state, root);
    },
    onActivate: () => {
      stopActionProgressPolling(state);
      renderAll();
      void transcriptPanel.syncWithSettings({ forceRefresh: true });
      void loadAndroidState(state, root, true);
    },
  });

  transcriptPanel.init();

  SettingsManager.subscribe(() => {
    renderAll();
    void transcriptPanel.syncWithSettings();
  });

  AppI18n.subscribe(() => {
    renderAll();
  });

  renderAll();
  void loadAndroidState(state, root);
  initialized = true;
}
