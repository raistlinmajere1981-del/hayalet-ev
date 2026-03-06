import type { OpencodeUiToolsReadyPayload } from "./bootstrap-actions.js";
import type { RuntimeState } from "./types.js";

export type ByIdFn = <T extends HTMLElement>(
  id: string,
  guard?: (element: T) => boolean
) => T | null;

export function byId<T extends HTMLElement>(
  id: string,
  guard?: (element: T) => boolean
): T | null {
  const element = document.getElementById(id) as T | null;
  if (element == null) {
    return null;
  }

  if (guard != null && !guard(element)) {
    return null;
  }

  return element;
}

export function sendStageToHost(title: string, subtitle: string): void {
  try {
    window.electronAPI?.sendToHost?.("opencode-ui-connect-stage", { title, subtitle });
  } catch (_error) {}
}

export function sendToolsReadyToHost(payload: OpencodeUiToolsReadyPayload): void {
  try {
    window.electronAPI?.sendToHost?.("opencode-ui-tools-ready", payload);
  } catch (_error) {}
}

export function sendSessionChangedToHost(sessionId: string | null): void {
  try {
    window.electronAPI?.sendToHost?.("opencode-ui-session-changed", { sessionId });
  } catch (_error) {}
}

export function setWorkspaceUrlLabel(url: string, getById: ByIdFn = byId): void {
  const workspaceUrlEl = getById<HTMLElement>("workspace-url-display");
  if (workspaceUrlEl != null) {
    workspaceUrlEl.textContent = url;
    workspaceUrlEl.setAttribute("title", url);
  }
}

export function showToast(message: string): void {
  const existing = document.querySelector(".ds-toast");
  if (existing != null) {
    existing.remove();
  }

  const toast = document.createElement("div");
  toast.className = "ds-toast";
  toast.textContent = message;
  document.body.appendChild(toast);

  setTimeout(() => {
    toast.classList.add("ds-toast--fade");
    setTimeout(() => {
      toast.remove();
    }, 300);
  }, 2500);
}

export async function copyWorkspaceUrl(getById: ByIdFn = byId): Promise<void> {
  const workspaceUrlEl = getById<HTMLElement>("workspace-url-display");
  const url = workspaceUrlEl?.textContent.trim() ?? "";
  if (url === "" || url === "-") {
    showToast("Kopyalanacak URL yok");
    return;
  }

  try {
    await navigator.clipboard.writeText(url);
    showToast("URL kopyalandi");
  } catch {
    showToast("URL kopyalanamadi");
  }
}

export function getLogoFallback(getById: ByIdFn = byId): void {
  const logoEl = getById<HTMLImageElement>("logo");
  if (logoEl == null) return;

  logoEl.onerror = function (): void {
    logoEl.style.background = "var(--accent-gradient)";
    logoEl.style.display = "block";
    logoEl.removeAttribute("src");
  };
}

export function formatTimestamp(value: number): string {
  if (!Number.isFinite(value) || value <= 0) return "--";

  return new Date(value).toLocaleString("tr-TR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function clearChatArea(runtime: RuntimeState, getById: ByIdFn = byId): void {
  const chatMessages = getById<HTMLElement>("chat-messages");
  const chatEmpty = getById<HTMLElement>("chat-empty");
  if (chatMessages == null) {
    return;
  }

  chatMessages.innerHTML = "";
  if (chatEmpty != null) {
    chatMessages.appendChild(chatEmpty);
    chatEmpty.style.display = "";
  }

  runtime.lastRenderedMessageCount = 0;
  runtime.lastRenderedSnapshotKey = "";
}

export async function wait(delayMs: number): Promise<void> {
  await new Promise<void>((resolve) => {
    setTimeout(resolve, delayMs);
  });
}
