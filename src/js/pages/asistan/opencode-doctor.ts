import { LogCategory } from "@shared/logging-core";
import type { AppSettings } from "@shared/settings.js";

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
    label: string;
    title: string;
    disabled?: boolean;
    busy?: boolean;
  }
): void {
  if (button == null) return;
  button.textContent = options.label;
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

  const titleLines = [`Varsayılan port: ${String(defaultPort)}`];
  if (binaryPath !== null) {
    titleLines.push(`Path: ${binaryPath}`);
  }

  if (version !== null) {
    setOpencodeIndicatorState(elements, "ready", `OpenCode v${version}`, titleLines.join("\n"));
    setOpencodeActionButtonState(elements.actionButton, {
      label: "Update kontrol",
      title: `OpenCode v${version} için yeni sürüm kontrolü yap`,
    });
    return;
  }

  setOpencodeIndicatorState(elements, "missing", "OpenCode bulunamadı", titleLines.join("\n"));
  setOpencodeActionButtonState(elements.actionButton, {
    label: "OpenCode kur",
    title: "OpenCode kurulum terminalini aç",
  });
}

async function launchOpencodeInstallFlow(): Promise<void> {
  const electronApi = window.electronAPI;
  if (electronApi === undefined || typeof electronApi.opencodeLaunchInstall !== "function") {
    throw new Error("OpenCode install IPC bulunamadı.");
  }

  const result = (await electronApi.opencodeLaunchInstall()) as OpencodeInstallLaunchResult;
  if (result.success !== true) {
    throw new Error(result.error ?? "OpenCode kurulum akışı başlatılamadı.");
  }

  if (result.fallbackToBrowser === true) {
    Toast.success(
      "OpenCode install sayfası açıldı",
      "Terminal açılamadı, resmi kurulum sayfası açıldı."
    );
    return;
  }

  Toast.success(
    "OpenCode kurulum terminali açıldı",
    "Kurulum bitince aynı butonla tekrar kontrol edebilirsin."
  );
}

export async function handleOpencodeActionButtonClick(
  elements: OpencodeIndicatorElements
): Promise<void> {
  const electronApi = window.electronAPI;
  const actionButton = elements.actionButton ?? null;
  const loadingMessage =
    getDetectedOpencodeVersion() !== null
      ? "Update kontrol ediliyor..."
      : "Kurulum hazırlanıyor...";
  const loadingToastId = Toast.loading("OpenCode", loadingMessage);

  setOpencodeActionButtonState(actionButton, {
    label: "Çalışıyor...",
    title: "OpenCode işlemi devam ediyor",
    disabled: true,
    busy: true,
  });

  try {
    if (electronApi === undefined || typeof electronApi.opencodeServeDoctor !== "function") {
      throw new Error("OpenCode doctor IPC bulunamadı.");
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
        title: "OpenCode kurulum akışı başlatılıyor",
        message: "Yüklü sürüm tespit edilemedi.",
        closable: true,
      });
      await launchOpencodeInstallFlow();
      return;
    }

    if (typeof electronApi.opencodeCheckUpdates !== "function") {
      throw new Error("OpenCode update IPC bulunamadı.");
    }

    const result = (await electronApi.opencodeCheckUpdates(
      detectedVersion
    )) as OpencodeUpdateCheckResult;
    if (result.success !== true) {
      throw new Error(result.error ?? "OpenCode update kontrolü başarısız oldu.");
    }

    const latestVersion =
      typeof result.latestVersion === "string" && result.latestVersion.trim() !== ""
        ? result.latestVersion.trim()
        : null;

    if (result.updateAvailable === true && latestVersion !== null) {
      Toast.update(loadingToastId, {
        type: "warning",
        title: `OpenCode v${latestVersion} mevcut`,
        message: `Kurulu sürüm: v${result.installedVersion}`,
        closable: true,
        action: {
          label: "Güncelle",
          onClick: () => {
            void launchOpencodeInstallFlow();
          },
        },
      });
      return;
    }

    Toast.update(loadingToastId, {
      type: "success",
      title: "OpenCode güncel",
      message:
        latestVersion !== null
          ? `Kurulu sürüm v${result.installedVersion}, latest v${latestVersion}.`
          : `Kurulu sürüm v${result.installedVersion}.`,
      closable: true,
    });
  } catch (error) {
    Toast.update(loadingToastId, {
      type: "error",
      title: "OpenCode işlemi başarısız",
      message: (error as Error).message,
      closable: true,
    });
    Logger.warn(LogCategory.ASISTAN_CORE, "OpenCode action button failure", {
      error: (error as Error).message,
    });
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
      <label>Binary Path</label>
      <input
        class="input opencode-settings-input"
        type="text"
        placeholder="PATH'teki opencode için boş bırakın"
        data-role="binary-path"
      />
      <p class="opencode-settings-help">
        Boş bırakırsan sistem PATH içindeki <code>opencode</code> komutu kullanılır.
      </p>
    </div>
    <div class="opencode-settings-actions">
      <button class="btn btn-secondary btn-sm" data-action="browse" type="button">Dosya Seç</button>
      <button class="btn btn-ghost btn-sm" data-action="reset" type="button">PATH Kullan</button>
      <button class="btn btn-ghost btn-sm" data-action="check" type="button">Kontrol Et</button>
    </div>
    <div class="opencode-settings-row">
      <label>Default Port</label>
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
      setCheckResult("OpenCode doctor IPC bulunamadı.", "error");
      return;
    }

    const value = binaryInput?.value.trim() ?? "";
    setCheckResult("Kontrol ediliyor...");

    try {
      const result = await electronApi.opencodeServeDoctor(
        value !== "" ? { binaryPath: value } : undefined
      );
      if (result.success !== true || result.available !== true) {
        lastValidation = null;
        setCheckResult(`Kontrol başarısız: ${result.error ?? "Bilinmeyen hata"}`, "error");
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
        `Kurulu: ${detectedVersion !== null ? `v${detectedVersion}` : "sürüm bilinmiyor"}`,
        "success"
      );
    } catch (error) {
      lastValidation = null;
      setCheckResult(`Kontrol hatası: ${(error as Error).message}`, "error");
    }
  };

  browseBtn?.addEventListener("click", () => {
    void (async (): Promise<void> => {
      if (electronApi === undefined || typeof electronApi.showOpenDialog !== "function") {
        setCheckResult("Dosya seçici API bulunamadı.", "error");
        return;
      }

      const selected = await electronApi.showOpenDialog({
        title: "OpenCode Binary Seç",
        properties: ["openFile"],
      });
      const pickedPath = selected.filePaths[0];
      if (selected.canceled || pickedPath === undefined) return;

      if (binaryInput != null) binaryInput.value = pickedPath;
      setCheckResult("Binary path seçildi.");
    })();
  });

  resetBtn?.addEventListener("click", () => {
    if (binaryInput != null) binaryInput.value = "";
    setCheckResult("PATH içindeki opencode kullanılacak.");
  });

  checkBtn?.addEventListener("click", () => {
    void runDoctorCheck();
  });

  modalModule.ModalManager.open({
    title: "OpenCode Ayarları",
    content,
    size: "medium",
    buttons: [
      { label: "Vazgeç", variant: "secondary" },
      {
        label: "Kaydet",
        variant: "primary",
        closeOnClick: false,
        onClick: (): void => {
          void (async (): Promise<void> => {
            const normalizedPath = binaryInput?.value.trim() ?? "";
            const normalizedPortText = portInput?.value.trim() ?? "";
            const parsedPort = Number.parseInt(normalizedPortText, 10);
            if (Number.isInteger(parsedPort) !== true || parsedPort < 1024 || parsedPort > 65535) {
              setCheckResult("Default port 1024-65535 aralığında olmalı.", "error");
              return;
            }

            await runDoctorCheck();
            if (lastValidation === null) {
              setCheckResult(
                "Kaydetmeden önce geçerli bir OpenCode binary doğrulaması gerekli.",
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

            setCheckResult("Ayarlar kaydedildi.", "success");
            Logger.info(LogCategory.ASISTAN_CORE, "OpenCode ayarları güncellendi", {
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
