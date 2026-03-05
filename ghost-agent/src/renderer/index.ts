import { GHOST_TIMEOUTS } from "@timeouts";
import { buildGhostProviderFramePlan } from "./ghost-frame.js";
import { evaluateGhostLoadingReadiness } from "./loading-readiness.js";
import {
  formatProviderMeta,
  normalizeGhostProvider,
  type GhostProvider,
  type GhostProviderServerState,
} from "./provider-state.js";

type LaunchTarget = {
  provider: GhostProvider;
  targetUrl: string;
  details: string;
};

type BootstrapResponse = {
  success: boolean;
  target?: LaunchTarget;
  error?: string;
};

type ProviderDetectResponse = {
  success: boolean;
  provider?: GhostProvider;
  server?: GhostProviderServerState;
  error?: string;
};

type ProviderConnectResponse = {
  success: boolean;
  target?: LaunchTarget;
  server?: GhostProviderServerState;
  error?: string;
};

type ProviderStopResponse = {
  success: boolean;
  provider?: GhostProvider;
  server?: GhostProviderServerState;
  error?: string;
};

type OverlayState = "connecting" | "error" | "hidden";

type ProviderReadyResult = {
  success: boolean;
  error?: string;
};

interface GhostDidFailLoadEvent extends Event {
  errorCode?: number;
  errorDescription?: string;
}

interface GhostWebviewElement extends HTMLElement {
  isLoading?: () => boolean;
  getURL?: () => string;
}

const PROVIDER_READY_TIMEOUT_MS = GHOST_TIMEOUTS.PROVIDER_READY;
const PROVIDER_READY_POLL_INTERVAL_MS = GHOST_TIMEOUTS.PROVIDER_READY_POLL;
const PROVIDER_READY_STABLE_URL_MS = GHOST_TIMEOUTS.PROVIDER_READY_STABLE_URL;
const DID_FAIL_LOAD_ABORTED = -3;

const providerMeta = document.getElementById("provider-meta");
const providerSelect = document.getElementById("ghost-provider-select") as HTMLSelectElement | null;
const providerConnectBtn = document.getElementById(
  "ghost-provider-connect-btn"
) as HTMLButtonElement | null;
const providerStopBtn = document.getElementById(
  "ghost-provider-stop-btn"
) as HTMLButtonElement | null;
const statusText = document.getElementById("status-text");
const statusHint = document.getElementById("status-hint");
const loadingOverlay = document.getElementById("ghost-loading-overlay");
const ghostCloseBtn = document.getElementById("ghost-close-btn") as HTMLButtonElement | null;
const ghostReturnBtn = document.getElementById("ghost-return-btn") as HTMLButtonElement | null;
const providerFrame = document.getElementById("provider-frame");
const providerView = document.getElementById("ghost-provider-view") as GhostWebviewElement | null;

let exitActionInFlight = false;
let providerOperationInFlight = false;
let activeProvider: GhostProvider | null = null;

function setOverlayState(state: OverlayState): void {
  if (!(loadingOverlay instanceof HTMLElement)) return;

  if (state === "hidden") {
    loadingOverlay.className = "webview-overlay hidden";
    return;
  }

  loadingOverlay.className = `webview-overlay ${state}`;
}

function setStatus(title: string, hint: string, state: OverlayState = "connecting"): void {
  if (statusText) statusText.textContent = title;
  if (statusHint) statusHint.textContent = hint;
  setOverlayState(state);
}

function setProviderMetaText(text: string): void {
  if (providerMeta) {
    providerMeta.textContent = text;
  }
}

function setGhostActionButtonsDisabled(disabled: boolean): void {
  if (ghostCloseBtn) ghostCloseBtn.disabled = disabled;
  if (ghostReturnBtn) ghostReturnBtn.disabled = disabled;
}

function setProviderControlsDisabled(disabled: boolean): void {
  if (providerSelect) providerSelect.disabled = disabled;
  if (providerConnectBtn) providerConnectBtn.disabled = disabled;
  if (providerStopBtn) providerStopBtn.disabled = disabled;
}

function getSelectedProvider(): GhostProvider {
  if (providerSelect instanceof HTMLSelectElement) {
    return normalizeGhostProvider(providerSelect.value, activeProvider ?? "opencode");
  }
  return activeProvider ?? "opencode";
}

async function waitForProviderReady(
  timeoutMs = PROVIDER_READY_TIMEOUT_MS
): Promise<ProviderReadyResult> {
  if (!(providerView instanceof HTMLElement)) {
    return { success: false, error: "Provider webview elementi bulunamadi." };
  }

  return await new Promise((resolve) => {
    let settled = false;
    let firstNavigatedAtMs: number | null = null;
    const startedAtMs = Date.now();

    let pollTimerId: number | null = null;

    const readUrl = (): string => {
      try {
        if (typeof providerView.getURL === "function") {
          return providerView.getURL();
        }
      } catch {
        // best-effort fallback below
      }
      return "";
    };

    const readIsLoading = (): boolean => {
      try {
        if (typeof providerView.isLoading === "function") {
          return providerView.isLoading() === true;
        }
      } catch {
        // best-effort fallback below
      }
      return true;
    };

    const finish = (result: ProviderReadyResult): void => {
      if (settled) return;
      settled = true;

      if (pollTimerId !== null) {
        window.clearInterval(pollTimerId);
      }

      providerView.removeEventListener("dom-ready", onReady);
      providerView.removeEventListener("did-stop-loading", onReady);
      providerView.removeEventListener("did-fail-load", onFail as EventListener);
      resolve(result);
    };

    const runProbe = (): void => {
      const probe = evaluateGhostLoadingReadiness({
        nowMs: Date.now(),
        startedAtMs,
        firstNavigatedAtMs,
        url: readUrl(),
        isLoading: readIsLoading(),
        timeoutMs,
        stableUrlMs: PROVIDER_READY_STABLE_URL_MS,
      });

      firstNavigatedAtMs = probe.firstNavigatedAtMs;

      if (probe.settle === "success") {
        finish({ success: true });
        return;
      }

      if (probe.settle === "timeout") {
        finish({ success: false, error: "Provider baglantisi zaman asimina ugradi." });
      }
    };

    const onReady = (): void => {
      runProbe();
      if (settled !== true) {
        finish({ success: true });
      }
    };

    const onFail = (event: Event): void => {
      const loadEvent = event as GhostDidFailLoadEvent;
      if (loadEvent.errorCode === DID_FAIL_LOAD_ABORTED) return;

      const description =
        typeof loadEvent.errorDescription === "string" && loadEvent.errorDescription.trim() !== ""
          ? loadEvent.errorDescription
          : "Provider sayfasi yuklenemedi.";

      finish({ success: false, error: description });
    };

    providerView.addEventListener("dom-ready", onReady);
    providerView.addEventListener("did-stop-loading", onReady);
    providerView.addEventListener("did-fail-load", onFail as EventListener);

    pollTimerId = window.setInterval(runProbe, PROVIDER_READY_POLL_INTERVAL_MS);
    runProbe();
  });
}

async function requestGhostExit(action: "close" | "return-main"): Promise<void> {
  if (exitActionInFlight) return;
  const api = window.electronAPI;
  if (api === undefined || typeof api.ghostExitAction !== "function") {
    setStatus("Ghost cikis koprusu yok", "electronAPI.ghostExitAction tanimli degil.", "error");
    return;
  }

  exitActionInFlight = true;
  setGhostActionButtonsDisabled(true);
  setProviderControlsDisabled(true);

  const statusMessage =
    action === "close"
      ? {
          title: "Ghost modu kapatiliyor",
          hint: "Wrapper ana uygulamayi yeniden acmayacak.",
        }
      : {
          title: "Hayalet Ev'e donuluyor",
          hint: "Ghost-agent kapaniyor, wrapper ana uygulamayi baslatacak.",
        };

  setStatus(statusMessage.title, statusMessage.hint);

  try {
    const result = await api.ghostExitAction(action);
    if (result.success !== true) {
      setStatus("Ghost cikis islemi basarisiz", result.error ?? "Bilinmeyen hata", "error");
      exitActionInFlight = false;
      setGhostActionButtonsDisabled(false);
      setProviderControlsDisabled(false);
    }
  } catch (error) {
    setStatus("Ghost cikis islemi basarisiz", (error as Error).message, "error");
    exitActionInFlight = false;
    setGhostActionButtonsDisabled(false);
    setProviderControlsDisabled(false);
  }
}

function setupGhostActionButtons(): void {
  ghostCloseBtn?.addEventListener("click", () => {
    void requestGhostExit("close");
  });

  ghostReturnBtn?.addEventListener("click", () => {
    void requestGhostExit("return-main");
  });
}

function applyProviderFramePlan(plan: ReturnType<typeof buildGhostProviderFramePlan>): void {
  if (providerView === null) {
    throw new Error("Ghost provider view element bulunamadi");
  }

  const managedAttributes = [
    "src",
    "partition",
    "allowpopups",
    "spellcheck",
    "webpreferences",
    "preload",
  ];
  managedAttributes.forEach((name) => {
    if (Object.prototype.hasOwnProperty.call(plan.attributes, name) !== true) {
      providerView.removeAttribute(name);
    }
  });

  Object.entries(plan.attributes).forEach(([key, value]) => {
    providerView.setAttribute(key, value);
  });
}

function clearProviderFrame(): void {
  if (providerView !== null) {
    providerView.setAttribute("src", "about:blank");
    providerView.removeAttribute("preload");
  }
  if (providerFrame !== null) {
    delete providerFrame.dataset["provider"];
  }
}

function loadProviderInFrame(target: LaunchTarget): { success: boolean; error?: string } {
  try {
    const plan = buildGhostProviderFramePlan({
      provider: target.provider,
      targetUrl: target.targetUrl,
    });

    applyProviderFramePlan(plan);

    const src = plan.attributes["src"];
    if (src === undefined || src === "") {
      return { success: false, error: "Provider hedef URL bos" };
    }

    return { success: true };
  } catch (error) {
    return { success: false, error: (error as Error).message };
  }
}

async function persistPreferredProvider(provider: GhostProvider): Promise<void> {
  const api = window.electronAPI;
  if (api === undefined || typeof api.ghostProviderSetPreferred !== "function") {
    return;
  }

  try {
    await api.ghostProviderSetPreferred(provider);
  } catch {
    // non-blocking best effort
  }
}

async function refreshProviderStatus(provider: GhostProvider): Promise<void> {
  const api = window.electronAPI;
  if (api === undefined || typeof api.ghostProviderDetect !== "function") {
    setProviderMetaText(`${provider} | provider API unavailable`);
    return;
  }

  try {
    const response = (await api.ghostProviderDetect(provider)) as ProviderDetectResponse;
    if (response.success !== true) {
      setProviderMetaText(`${provider} | detect failed: ${response.error ?? "unknown"}`);
      return;
    }

    setProviderMetaText(formatProviderMeta(provider, response.server));
  } catch (error) {
    setProviderMetaText(`${provider} | detect error: ${(error as Error).message}`);
  }
}

async function connectProvider(provider: GhostProvider, autoStart = true): Promise<void> {
  if (providerOperationInFlight || exitActionInFlight) return;

  const api = window.electronAPI;
  if (api === undefined || typeof api.ghostProviderConnect !== "function") {
    setStatus(
      "Provider bridge unavailable",
      "electronAPI.ghostProviderConnect is missing.",
      "error"
    );
    return;
  }

  providerOperationInFlight = true;
  setProviderControlsDisabled(true);
  setStatus(
    `${provider} baglaniyor`,
    autoStart ? "Sunucu kontrol ediliyor, gerekirse baslatiliyor." : "Calisan sunucu araniyor."
  );

  try {
    const response = (await api.ghostProviderConnect({
      provider,
      autoStart,
    })) as ProviderConnectResponse;
    if (response.success !== true || response.target === undefined) {
      setStatus("Provider baglantisi basarisiz", response.error ?? "Bilinmeyen hata", "error");
      await refreshProviderStatus(provider);
      return;
    }

    activeProvider = provider;
    setProviderMetaText(`${provider} | ${response.target.details}`);
    await persistPreferredProvider(provider);

    const openResult = loadProviderInFrame(response.target);
    if (openResult.success !== true) {
      setStatus("Provider sayfasi acilamadi", openResult.error ?? "Yukleme basarisiz.", "error");
      return;
    }

    if (providerFrame !== null) {
      providerFrame.dataset["provider"] = provider;
    }

    const readyResult = await waitForProviderReady();
    if (readyResult.success !== true) {
      setStatus(
        "Provider baglantisi tamamlanamadi",
        readyResult.error ?? "Yukleme beklenen surede tamamlanmadi.",
        "error"
      );
      return;
    }

    setStatus("Baglanti tamamlandi", "Provider oturumu hazir.", "hidden");
  } catch (error) {
    setStatus("Provider baglantisi basarisiz", (error as Error).message, "error");
  } finally {
    providerOperationInFlight = false;
    setProviderControlsDisabled(exitActionInFlight);
  }
}

async function stopProvider(provider: GhostProvider): Promise<void> {
  if (providerOperationInFlight || exitActionInFlight) return;

  const api = window.electronAPI;
  if (api === undefined || typeof api.ghostProviderStop !== "function") {
    setStatus("Provider bridge unavailable", "electronAPI.ghostProviderStop is missing.", "error");
    return;
  }

  providerOperationInFlight = true;
  setProviderControlsDisabled(true);
  setStatus(`${provider} baglantisi kesiliyor`, "Sunucu durdurma istegi gonderiliyor.");

  try {
    const response = (await api.ghostProviderStop(provider)) as ProviderStopResponse;
    if (response.success !== true) {
      setStatus("Provider durdurma basarisiz", response.error ?? "Bilinmeyen hata", "error");
      return;
    }

    activeProvider = null;
    clearProviderFrame();

    if (response.server?.running === true) {
      setStatus(
        `${provider} baglantisi kapatildi`,
        "Harici sunucu calismaya devam ediyor. Yeniden baglanabilirsiniz.",
        "connecting"
      );
    } else {
      setStatus(
        `${provider} durduruldu`,
        "Yeniden baslatmak icin Baslat / Baglan butonunu kullanin.",
        "connecting"
      );
    }

    setProviderMetaText(formatProviderMeta(provider, response.server));
  } catch (error) {
    setStatus("Provider durdurma basarisiz", (error as Error).message, "error");
  } finally {
    providerOperationInFlight = false;
    setProviderControlsDisabled(exitActionInFlight);
  }
}

function setupProviderControls(initialProvider: GhostProvider): void {
  if (providerSelect instanceof HTMLSelectElement) {
    providerSelect.value = initialProvider;
    providerSelect.addEventListener("change", () => {
      const provider = getSelectedProvider();
      void persistPreferredProvider(provider);
      void refreshProviderStatus(provider);
    });
  }

  providerConnectBtn?.addEventListener("click", () => {
    void connectProvider(getSelectedProvider(), true);
  });

  providerStopBtn?.addEventListener("click", () => {
    void stopProvider(getSelectedProvider());
  });
}

async function bootstrap(): Promise<void> {
  const api = window.electronAPI;
  if (api === undefined || typeof api.ghostBootstrap !== "function") {
    setStatus("Ghost bridge unavailable", "electronAPI.ghostBootstrap is missing.", "error");
    return;
  }

  setStatus("Baslatiliyor...", "Provider secimi ve sunucu durumu okunuyor.");

  const response = (await api.ghostBootstrap()) as BootstrapResponse;
  if (!response.success) {
    setStatus("Ghost bootstrap basarisiz", response.error ?? "Hedef bilgi hazirlanamadi.", "error");
    return;
  }

  const preferredProvider = normalizeGhostProvider(response.target?.provider, "opencode");
  setupProviderControls(preferredProvider);
  await refreshProviderStatus(preferredProvider);
  await connectProvider(preferredProvider, true);
}

setupGhostActionButtons();
void bootstrap();
