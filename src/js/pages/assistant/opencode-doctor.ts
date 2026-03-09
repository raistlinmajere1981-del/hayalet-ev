import { LogCategory } from "@shared/logging-core";
import type { TranslationParams } from "@shared/i18n.js";
import type { AppSettings } from "@shared/settings.js";

import { AppI18n } from "../../modules/i18n/index.js";
import { Logger } from "../../modules/logger/index.js";
import { SettingsManager } from "../../modules/settings-manager.js";
import { Toast } from "../../ui/toast-manager.js";
import { getOpencodePreferences, normalizeOpencodePort } from "./opencode-preferences.js";

interface OpencodeIndicatorElements {
  indicator: HTMLElement | null;
  indicatorDot: HTMLElement | null;
  indicatorText: HTMLElement | null;
  actionButton?: HTMLButtonElement | null;
}

interface OpencodeUpdateCheckResult {
  success: boolean;
  installedVersion: string;
  latestVersion?: string;
  updateAvailable?: boolean;
  releaseUrl?: string;
  error?: string;
}

interface OpencodeInstallLaunchResult {
  success: boolean;
  command: string;
  installUrl: string;
  fallbackToBrowser?: boolean;
  error?: string;
}

function assistantT(key: string, params?: TranslationParams): string {
  return AppI18n.t(`shell.assistant.${key}`, params);
}

function setOpencodeIndicatorState(
  elements: OpencodeIndicatorElements,
  state: "checking" | "ready" | "missing" | "error",
  text: string,
  title = ""
): void {
  if (elements.indicatorText != null) {
    elements.indicatorText.textContent = text;
  }
  if (elements.indicator != null) {
    elements.indicator.title = title;
  }

  const indicator = elements.indicator;
  const dot = elements.indicatorDot;
  if (indicator == null || dot == null) return;

  indicator.classList.remove("is-ready", "is-missing", "is-error");
  dot.classList.remove("status-ready", "status-missing", "status-error", "status-checking");

  if (state === "ready") {
    indicator.classList.add("is-ready");
    dot.classList.add("status-ready");
    return;
  }

  if (state === "missing") {
    indicator.classList.add("is-missing");
    dot.classList.add("status-missing");
    return;
  }

  if (state === "error") {
    indicator.classList.add("is-error");
    dot.classList.add("status-error");
    return;
  }

  dot.classList.add("status-checking");
}

function setOpencodeActionButtonState(
  button: HTMLButtonElement | null | undefined,
  options: {
    icon: string;
    ariaLabel: string;
    title: string;
    disabled?: boolean;
    busy?: boolean;
  }
): void {
  if (button == null) return;
  button.textContent = options.icon;
  button.setAttribute("aria-label", options.ariaLabel);
  button.title = options.title;
  button.disabled = options.disabled === true;
  button.classList.toggle("is-busy", options.busy === true);
}

function getDetectedOpencodeVersion(): string | null {
  const settings = SettingsManager.getSnapshot() as AppSettings | null;
  const version = settings?.assistants?.opencode?.version;
  if (typeof version !== "string" || version.trim() === "") {
    return null;
  }
  return version.trim();
}

export function refreshOpencodeDoctorStatus(elements: OpencodeIndicatorElements): void {
  const settings = SettingsManager.getSnapshot() as AppSettings | null;
  const opencode = settings?.assistants?.opencode;
  const defaultPort = normalizeOpencodePort(opencode?.defaultPort);
  const binaryPath =
    typeof opencode?.binaryPath === "string" && opencode.binaryPath.trim() !== ""
      ? opencode.binaryPath.trim()
      : null;
  const version =
    typeof opencode?.version === "string" && opencode.version.trim() !== ""
      ? opencode.version.trim()
      : null;

  const titleLines = [assistantT("opencodeDoctor.defaultPortTitle", { port: defaultPort })];
  if (binaryPath !== null) {
    titleLines.push(assistantT("opencodeDoctor.binaryPathTitle", { path: binaryPath }));
  }

  if (version !== null) {
    setOpencodeIndicatorState(
      elements,
      "ready",
      assistantT("opencodeDoctor.indicatorReady", { version }),
      titleLines.join("\n")
    );
    setOpencodeActionButtonState(elements.actionButton, {
      icon: "↻",
      ariaLabel: assistantT("opencodeDoctor.checkUpdatesAriaLabel"),
      title: assistantT("opencodeDoctor.checkUpdatesTitle", { version }),
    });
    return;
  }

  setOpencodeIndicatorState(
    elements,
    "missing",
    assistantT("opencodeDoctor.indicatorMissing"),
    titleLines.join("\n")
  );
  setOpencodeActionButtonState(elements.actionButton, {
    icon: "⬇",
    ariaLabel: assistantT("opencodeDoctor.installAriaLabel"),
    title: assistantT("opencodeDoctor.installTitle"),
  });
}

async function launchOpencodeInstallFlow(): Promise<void> {
  const electronApi = window.electronAPI;
  if (electronApi === undefined || typeof electronApi.opencodeLaunchInstall !== "function") {
    throw new Error(assistantT("opencodeDoctor.errors.installIpcMissing"));
  }

  const result = (await electronApi.opencodeLaunchInstall()) as OpencodeInstallLaunchResult;
  if (result.success !== true) {
    throw new Error(result.error ?? assistantT("opencodeDoctor.errors.installFlowFailed"));
  }

  if (result.fallbackToBrowser === true) {
    Toast.success(
      assistantT("opencodeDoctor.toasts.installPageOpenedTitle"),
      assistantT("opencodeDoctor.toasts.installPageOpenedMessage")
    );
    return;
  }

  Toast.success(
    assistantT("opencodeDoctor.toasts.installTerminalOpenedTitle"),
    assistantT("opencodeDoctor.toasts.installTerminalOpenedMessage")
  );
}

export async function handleOpencodeActionButtonClick(
  elements: OpencodeIndicatorElements
): Promise<void> {
  const electronApi = window.electronAPI;
  const actionButton = elements.actionButton ?? null;
  const loadingMessage =
    getDetectedOpencodeVersion() !== null
      ? assistantT("opencodeDoctor.loading.checkingUpdates")
      : assistantT("opencodeDoctor.loading.preparingInstall");
  const loadingToastId = Toast.loading("OpenCode", loadingMessage);

  setOpencodeActionButtonState(actionButton, {
    icon: "…",
    ariaLabel: assistantT("opencodeDoctor.actionInProgress"),
    title: assistantT("opencodeDoctor.actionInProgress"),
    disabled: true,
    busy: true,
  });

  try {
    if (electronApi === undefined || typeof electronApi.opencodeServeDoctor !== "function") {
      throw new Error(assistantT("opencodeDoctor.errors.doctorIpcMissing"));
    }

    const doctorResult = await electronApi.opencodeServeDoctor();
    const detectedVersion =
      doctorResult.success === true &&
      doctorResult.available === true &&
      typeof doctorResult.version === "string" &&
      doctorResult.version.trim() !== ""
        ? doctorResult.version.trim()
        : null;

    if (detectedVersion === null) {
      Toast.update(loadingToastId, {
        type: "info",
        title: assistantT("opencodeDoctor.toasts.installFlowStartingTitle"),
        message: assistantT("opencodeDoctor.toasts.installFlowStartingMessage"),
        closable: true,
      });
      await launchOpencodeInstallFlow();
      return;
    }

    if (typeof electronApi.opencodeCheckUpdates !== "function") {
      throw new Error(assistantT("opencodeDoctor.errors.updateIpcMissing"));
    }

    const result = (await electronApi.opencodeCheckUpdates(
      detectedVersion
    )) as OpencodeUpdateCheckResult;
    if (result.success !== true) {
      throw new Error(result.error ?? assistantT("opencodeDoctor.errors.updateCheckFailed"));
    }

    const latestVersion =
      typeof result.latestVersion === "string" && result.latestVersion.trim() !== ""
        ? result.latestVersion.trim()
        : null;

    if (result.updateAvailable === true && latestVersion !== null) {
      Toast.update(loadingToastId, {
        type: "warning",
        title: assistantT("opencodeDoctor.toasts.updateAvailableTitle", {
          version: latestVersion,
        }),
        message: assistantT("opencodeDoctor.toasts.installedVersionMessage", {
          version: result.installedVersion,
        }),
        closable: true,
        action: {
          label: assistantT("opencodeDoctor.toasts.updateActionLabel"),
          onClick: () => {
            void launchOpencodeInstallFlow();
          },
        },
      });
      return;
    }

    Toast.update(loadingToastId, {
      type: "success",
      title: assistantT("opencodeDoctor.toasts.upToDateTitle"),
      message:
        latestVersion !== null
          ? assistantT("opencodeDoctor.toasts.upToDateWithLatestMessage", {
              installedVersion: result.installedVersion,
              latestVersion,
            })
          : assistantT("opencodeDoctor.toasts.upToDateMessage", {
              installedVersion: result.installedVersion,
            }),
      closable: true,
    });
  } catch (error) {
    Toast.update(loadingToastId, {
      type: "error",
      title: assistantT("opencodeDoctor.toasts.actionFailedTitle"),
      message: (error as Error).message,
      closable: true,
    });
    Logger.warnT(
      LogCategory.ASSISTANT_CORE,
      "shell.assistant.logs.opencodeActionButtonFailure",
      { message: (error as Error).message },
      {
        error: (error as Error).message,
      }
    );
  } finally {
    refreshOpencodeDoctorStatus(elements);
  }
}

export async function openOpencodeSettingsModal(
  options: { onSaved?: () => void } = {}
): Promise<void> {
  const prefs = getOpencodePreferences(SettingsManager.getSnapshot() as AppSettings | null);
  const modalModule = await import("../../ui/modal-manager.js");
  const electronApi = window.electronAPI;

  const content = document.createElement("div");
  content.className = "opencode-settings-modal";
  content.innerHTML = `
    <div class="opencode-settings-row">
      <label>${assistantT("opencodeDoctor.settingsModal.binaryPathLabel")}</label>
      <input
        class="input opencode-settings-input"
        type="text"
        placeholder="${assistantT("opencodeDoctor.settingsModal.binaryPathPlaceholder")}"
        data-role="binary-path"
      />
      <p class="opencode-settings-help">
        ${assistantT("opencodeDoctor.settingsModal.binaryPathHelp")}
      </p>
    </div>
    <div class="opencode-settings-actions">
      <button class="btn btn-secondary btn-sm" data-action="browse" type="button">${assistantT("opencodeDoctor.settingsModal.browseButton")}</button>
      <button class="btn btn-ghost btn-sm" data-action="reset" type="button">${assistantT("opencodeDoctor.settingsModal.usePathButton")}</button>
      <button class="btn btn-ghost btn-sm" data-action="check" type="button">${assistantT("opencodeDoctor.settingsModal.checkButton")}</button>
    </div>
    <div class="opencode-settings-row">
      <label>${assistantT("opencodeDoctor.settingsModal.defaultPortLabel")}</label>
      <input
        class="input opencode-settings-input"
        type="number"
        min="1024"
        max="65535"
        step="1"
        data-role="default-port"
      />
    </div>
    <div class="opencode-settings-check" data-role="check-result"></div>
  `;

  const binaryInput = content.querySelector<HTMLInputElement>('[data-role="binary-path"]');
  const portInput = content.querySelector<HTMLInputElement>('[data-role="default-port"]');
  const checkResult = content.querySelector<HTMLElement>('[data-role="check-result"]');
  const browseBtn = content.querySelector<HTMLButtonElement>('[data-action="browse"]');
  const resetBtn = content.querySelector<HTMLButtonElement>('[data-action="reset"]');
  const checkBtn = content.querySelector<HTMLButtonElement>('[data-action="check"]');

  if (binaryInput != null) binaryInput.value = prefs.binaryPath ?? "";
  if (portInput != null) portInput.value = String(prefs.defaultPort);

  const setCheckResult = (
    message: string,
    tone: "normal" | "success" | "error" = "normal"
  ): void => {
    if (checkResult == null) return;

    checkResult.textContent = message;
    if (tone === "success") {
      checkResult.style.color = "var(--color-success)";
    } else if (tone === "error") {
      checkResult.style.color = "var(--color-error)";
    } else {
      checkResult.style.color = "var(--text-secondary)";
    }
  };

  let lastValidation: { binaryPath: string | null; version: string | null } | null = null;

  const runDoctorCheck = async (): Promise<void> => {
    if (electronApi === undefined || typeof electronApi.opencodeServeDoctor !== "function") {
      setCheckResult(assistantT("opencodeDoctor.errors.doctorIpcMissing"), "error");
      return;
    }

    const value = binaryInput?.value.trim() ?? "";
    setCheckResult(assistantT("opencodeDoctor.settingsModal.checking"));

    try {
      const result = await electronApi.opencodeServeDoctor(
        value !== "" ? { binaryPath: value } : undefined
      );
      if (result.success !== true || result.available !== true) {
        lastValidation = null;
        setCheckResult(
          assistantT("opencodeDoctor.settingsModal.checkFailed", {
            message: result.error ?? assistantT("opencodeDoctor.settingsModal.unknownError"),
          }),
          "error"
        );
        return;
      }

      const detectedPath =
        typeof result.resolvedPath === "string" && result.resolvedPath.trim() !== ""
          ? result.resolvedPath.trim()
          : value !== ""
            ? value
            : null;
      const detectedVersion =
        typeof result.version === "string" && result.version.trim() !== ""
          ? result.version.trim()
          : null;

      if (binaryInput != null && detectedPath !== null) {
        binaryInput.value = detectedPath;
      }

      lastValidation = {
        binaryPath: detectedPath,
        version: detectedVersion,
      };

      setCheckResult(
        assistantT("opencodeDoctor.settingsModal.detectedVersion", {
          version:
            detectedVersion !== null
              ? `v${detectedVersion}`
              : assistantT("opencodeDoctor.settingsModal.versionUnknown"),
        }),
        "success"
      );
    } catch (error) {
      lastValidation = null;
      setCheckResult(
        assistantT("opencodeDoctor.settingsModal.checkError", {
          message: (error as Error).message,
        }),
        "error"
      );
    }
  };

  browseBtn?.addEventListener("click", () => {
    void (async (): Promise<void> => {
      if (electronApi === undefined || typeof electronApi.showOpenDialog !== "function") {
        setCheckResult(assistantT("opencodeDoctor.settingsModal.filePickerUnavailable"), "error");
        return;
      }

      const selected = await electronApi.showOpenDialog({
        title: assistantT("opencodeDoctor.settingsModal.selectBinaryDialogTitle"),
        properties: ["openFile"],
      });
      const pickedPath = selected.filePaths[0];
      if (selected.canceled || pickedPath === undefined) return;

      if (binaryInput != null) binaryInput.value = pickedPath;
      setCheckResult(assistantT("opencodeDoctor.settingsModal.binaryPathSelected"));
    })();
  });

  resetBtn?.addEventListener("click", () => {
    if (binaryInput != null) binaryInput.value = "";
    setCheckResult(assistantT("opencodeDoctor.settingsModal.pathWillBeUsed"));
  });

  checkBtn?.addEventListener("click", () => {
    void runDoctorCheck();
  });

  modalModule.ModalManager.open({
    title: assistantT("opencodeDoctor.settingsModal.title"),
    content,
    size: "medium",
    buttons: [
      { label: AppI18n.t("shell.common.cancel"), variant: "secondary" },
      {
        label: AppI18n.t("shell.common.save"),
        variant: "primary",
        closeOnClick: false,
        onClick: (): void => {
          void (async (): Promise<void> => {
            const normalizedPath = binaryInput?.value.trim() ?? "";
            const normalizedPortText = portInput?.value.trim() ?? "";
            const parsedPort = Number.parseInt(normalizedPortText, 10);
            if (Number.isInteger(parsedPort) !== true || parsedPort < 1024 || parsedPort > 65535) {
              setCheckResult(assistantT("opencodeDoctor.settingsModal.defaultPortInvalid"), "error");
              return;
            }

            await runDoctorCheck();
            if (lastValidation === null) {
              setCheckResult(
                assistantT("opencodeDoctor.settingsModal.validationRequired"),
                "error"
              );
              return;
            }

            await SettingsManager.set("assistants.opencode", {
              binaryPath:
                lastValidation.binaryPath ?? (normalizedPath !== "" ? normalizedPath : null),
              defaultPort: parsedPort,
              version: lastValidation.version,
            });

            setCheckResult(assistantT("opencodeDoctor.settingsModal.saved"), "success");
            Logger.info(LogCategory.ASSISTANT_CORE, assistantT("logs.opencodeSettingsUpdated"), {
              binaryPath:
                lastValidation.binaryPath ?? (normalizedPath !== "" ? normalizedPath : null),
              defaultPort: parsedPort,
              version: lastValidation.version,
            });

            options.onSaved?.();
            modalModule.ModalManager.close();
          })();
        },
      },
    ],
  });
}
