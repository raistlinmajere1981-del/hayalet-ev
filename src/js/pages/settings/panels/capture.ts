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
import type {
  CaptureActionOutcome,
  CaptureAndroidDeviceStatus,
  CaptureHostAction,
  CaptureServiceStatus,
} from "../../../../types/capture.js";

let initialized = false;

function captureT(key: string): string {
  return AppI18n.t(`entrance.capture.${key}`);
}

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
}

function describeOperationAction(action: CaptureHostAction | null): string {
  switch (action) {
    case null:
      return "Android companion";
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
    case "capture-analyze-photo":
      return "Phone capture";
    case "retake-analyze-photo":
      return "Phone retake";
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

function parsePhraseInput(value: string): string[] {
  return value
    .split(",")
    .map((entry) => entry.trim())
    .filter((entry, index, list) => entry !== "" && list.indexOf(entry) === index);
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
  const phrases = settings.commandPhrases;
  const localWhisperInput = root.querySelector<HTMLInputElement>("#capture-provider-local-whisper");
  const androidCompanionInput = root.querySelector<HTMLInputElement>(
    "#capture-provider-android-companion"
  );
  const enabledInput = root.querySelector<HTMLInputElement>("#capture-provider-android-speech");
  const fallbackSelect = root.querySelector<HTMLSelectElement>("#capture-provider-fallback-select");
  const openInput = root.querySelector<HTMLInputElement>("#capture-command-open-input");
  const captureInput = root.querySelector<HTMLInputElement>("#capture-command-capture-input");
  const retakeInput = root.querySelector<HTMLInputElement>("#capture-command-retake-input");
  const attachInput = root.querySelector<HTMLInputElement>("#capture-command-attach-input");
  const stopInput = root.querySelector<HTMLInputElement>("#capture-command-stop-input");
  const feedbackEl = root.querySelector<HTMLElement>("#capture-policy-feedback");

  if (localWhisperInput) {
    localWhisperInput.checked = providers?.localWhisperEnabled !== false;
  }
  if (androidCompanionInput) {
    androidCompanionInput.checked = providers?.androidCompanionEnabled !== false;
  }
  if (enabledInput) {
    enabledInput.checked = providers?.androidSpeechEnabled !== false;
  }
  if (fallbackSelect) {
    fallbackSelect.value = providers?.speechFallbackMode ?? "system";
  }
  if (openInput) {
    openInput.value = (phrases?.openCamera ?? []).join(", ");
  }
  if (captureInput) {
    captureInput.value = (phrases?.capture ?? []).join(", ");
  }
  if (retakeInput) {
    retakeInput.value = (phrases?.retake ?? []).join(", ");
  }
  if (attachInput) {
    attachInput.value = (phrases?.attach ?? []).join(", ");
  }
  if (stopInput) {
    stopInput.value = (phrases?.stop ?? []).join(", ");
  }
  if (feedbackEl) {
    feedbackEl.textContent = captureT("policy.hint");
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
    captureT(`android.states.preview.${androidStatus?.previewMode ?? "phone-screen"}`)
  );
  setText(root, "#capture-android-preview-note", captureT("android.previewHint"));
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

  if (scanButton) {
    scanButton.disabled = busy;
  }
  if (refreshButton) {
    refreshButton.disabled = busy;
  }
  if (connectInput) {
    connectInput.disabled = busy || androidStatus?.adbPath === null || androidCompanionEnabled !== true;
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
      (selectedDevice.companionState !== "installed" && selectedDevice.companionState !== "outdated");
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
        busy ||
        device === null ||
        device.selected ||
        device.connectionState !== "device";
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
      typeof options?.execute === "function" ? await options.execute() : await runCaptureAction(action);
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
  const localWhisperEnabled = root.querySelector<HTMLInputElement>("#capture-provider-local-whisper");
  const androidCompanionEnabled = root.querySelector<HTMLInputElement>(
    "#capture-provider-android-companion"
  );
  const speechEnabled = root.querySelector<HTMLInputElement>("#capture-provider-android-speech");
  const fallbackSelect = root.querySelector<HTMLSelectElement>("#capture-provider-fallback-select");
  const openInput = root.querySelector<HTMLInputElement>("#capture-command-open-input");
  const captureInput = root.querySelector<HTMLInputElement>("#capture-command-capture-input");
  const retakeInput = root.querySelector<HTMLInputElement>("#capture-command-retake-input");
  const attachInput = root.querySelector<HTMLInputElement>("#capture-command-attach-input");
  const stopInput = root.querySelector<HTMLInputElement>("#capture-command-stop-input");

  await SettingsManager.patch((settings) => {
    const nextCapture = (settings["capture"] ?? {}) as Record<string, unknown>;
    const nextDefaults = (nextCapture["defaults"] ?? {}) as Record<string, unknown>;
    const nextProviders = (nextCapture["providers"] ?? {}) as Record<string, unknown>;
    const nextPhrases = (nextCapture["commandPhrases"] ?? {}) as Record<string, unknown>;

    nextDefaults["preferredDeviceId"] =
      deviceSelect && deviceSelect.value.trim() !== "" ? deviceSelect.value.trim() : null;
    nextDefaults["defaultLens"] = lensSelect?.value === "front" ? "front" : "back";
    nextDefaults["photoQuality"] = qualitySelect?.value === "balanced" ? "balanced" : "high";
    nextDefaults["attachMode"] =
      attachSelect?.value === "auto-stage" ? "auto-stage" : "manual-sync";
    nextDefaults["commandConfirmation"] =
      confirmationSelect?.value === "none" ? "none" : "toast";

    nextProviders["localWhisperEnabled"] = localWhisperEnabled?.checked !== false;
    nextProviders["androidCompanionEnabled"] = androidCompanionEnabled?.checked !== false;
    nextProviders["androidSpeechEnabled"] = speechEnabled?.checked !== false;
    nextProviders["speechFallbackMode"] =
      fallbackSelect?.value === "vosk-seam" ? "vosk-seam" : "system";

    nextPhrases["openCamera"] = parsePhraseInput(openInput?.value ?? "");
    nextPhrases["capture"] = parsePhraseInput(captureInput?.value ?? "");
    nextPhrases["retake"] = parsePhraseInput(retakeInput?.value ?? "");
    nextPhrases["attach"] = parsePhraseInput(attachInput?.value ?? "");
    nextPhrases["stop"] = parsePhraseInput(stopInput?.value ?? "");

    nextCapture["defaults"] = nextDefaults;
    nextCapture["providers"] = nextProviders;
    nextCapture["commandPhrases"] = nextPhrases;
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
  const installButton = root.querySelector<HTMLButtonElement>("#capture-android-install-btn");
  const openButton = root.querySelector<HTMLButtonElement>("#capture-android-open-btn");
  const connectButton = root.querySelector<HTMLButtonElement>("#capture-android-connect-btn");
  const connectInput = root.querySelector<HTMLInputElement>("#capture-android-connect-address");
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
    root.querySelector<HTMLInputElement>("#capture-provider-local-whisper"),
    root.querySelector<HTMLInputElement>("#capture-provider-android-companion"),
    root.querySelector<HTMLInputElement>("#capture-provider-android-speech"),
    root.querySelector<HTMLSelectElement>("#capture-provider-fallback-select"),
    root.querySelector<HTMLInputElement>("#capture-command-open-input"),
    root.querySelector<HTMLInputElement>("#capture-command-capture-input"),
    root.querySelector<HTMLInputElement>("#capture-command-retake-input"),
    root.querySelector<HTMLInputElement>("#capture-command-attach-input"),
    root.querySelector<HTMLInputElement>("#capture-command-stop-input"),
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

  policyInputs.forEach((element) => {
    if (
      !(element instanceof HTMLSelectElement) &&
      !(element instanceof HTMLInputElement)
    ) {
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
    renderCaptureDefaults(root, state);
    renderCaptureSpeechPolicy(root);
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
