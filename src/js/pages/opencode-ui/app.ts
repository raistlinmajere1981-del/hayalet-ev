import { apiCall, setApiBaseUrl } from "./api.js";
import {
  initializeSessionSelection as initializeSessionSelectionFromModule,
  runOpencodeUiBootstrapPipeline as runOpencodeUiBootstrapPipelineFromModule,
  startLiveMessageRefresh as startLiveMessageRefreshFromModule,
  startPeriodicRefresh as startPeriodicRefreshFromModule,
} from "./bootstrap-actions.js";
import { checkHealth, loadStatusContext, waitForMcpServersSettled } from "./health.js";
import {
  loadActiveSessionHistory as loadActiveSessionHistoryFromModule,
  syncActiveSessionHistoryIfUpdated as syncActiveSessionHistoryIfUpdatedFromModule,
  withHistorySyncFallback as withHistorySyncFallbackFromModule,
} from "./history-actions.js";
import {
  loadProviderContextAndModels as loadProviderContextAndModelsFromModule,
  refreshReasoningEffortDropdown as refreshReasoningEffortDropdownFromModule,
} from "./provider-actions.js";
import type { ProviderContext } from "./provider-actions.js";
import {
  createHistoricAssistantToolHost as createHistoricAssistantToolHostFromModule,
  renderFilesPanel as renderFilesPanelFromModule,
  renderHistoricToolCall as renderHistoricToolCallFromModule,
  renderTodoPanel as renderTodoPanelFromModule,
  updateUsageFromSession as updateUsageFromSessionFromModule,
  updateUsagePlaceholders as updateUsagePlaceholdersFromModule,
} from "./render-actions.js";
import type { RenderContext } from "./render-actions.js";
import { loadToolsFinalSnapshot } from "./tools-prompts.js";
import { addMessage } from "./chat-utils.js";
import {
  buildMessageRequestBody,
  readClipboardAttachmentsFromEvent as readComposerClipboardAttachmentsFromEvent,
  readClipboardAttachmentsFromSystem as readComposerClipboardAttachmentsFromSystem,
  removeComposerAttachmentById,
  renderComposerAttachmentTray,
  sendComposerMessage,
  setComposerSendButtonState,
  stageComposerAttachments as stageComposerAttachmentsFromModule,
  stageComposerFileList as stageComposerFileListFromModule,
} from "./composer-actions.js";
import {
  getSessionsForTab as getSessionsForTabFromModule,
  initSessionEvents as initSessionEventsFromModule,
  loadSessionListAndRender as loadSessionListAndRenderFromModule,
} from "./session-actions.js";
import { initUIHelpers, setupCustomSelect } from "./ui-helpers.js";
import {
} from "./attachments.js";
import {
  buildSessionSnapshotKey,
  extractAssistantText,
  normalizeSessionId,
} from "./message-content.js";
import {
  normalizeAgentItems,
} from "./provider-catalog.js";
import type {
  ComposerAttachment,
  CustomSelectAPI,
  OpencodeUiFsArchiveResult,
  OpencodeUiFsEnsureResult,
  OpencodeUiFsListResult,
  OpencodeUiFsReadResult,
  OpencodeUiSessionDetail,
  OpencodeUiSessionSummary,
  OpencodeUiTodoItem,
  OpencodeUiToolCall,
  RuntimeState,
} from "./types.js";
import { config as opencodeUiConfig } from "../../modules/webview/providers/opencode-ui/config.js";
import type { ProviderConfig } from "@shared/provider.js";

export interface OpencodeUiToolsReadyPayload {
  ready: boolean;
  unresolvedServers: string[];
  mcpChecks: number;
  toolCount: number;
}

export interface OpencodeUiBootstrapDeps {
  checkHealth: () => Promise<{ mcpServers: Record<string, unknown> }>;
  loadStatusContext: () => Promise<void>;
  waitForMcpServersSettled: () => Promise<{
    ready: boolean;
    checks: number;
    unresolvedServers: string[];
  }>;
  loadToolsFinalSnapshot: () => Promise<{
    status: "loaded" | "empty" | "error";
    toolIds: string[];
  }>;
}

type SessionTab = "active" | "archived";
type SessionListContext = Parameters<typeof loadSessionListAndRenderFromModule>[0];
type HistoryContext = Parameters<typeof loadActiveSessionHistoryFromModule>[0];
type BootstrapContext = Parameters<typeof initializeSessionSelectionFromModule>[0];

const runtime: RuntimeState = {
  baseUrl: "http://127.0.0.1:4096",
  dbPath: "",
  activeSessionId: null,
  sessionTab: "active",
  submittingSessionId: null,
  activeModelId: null,
  activeReasoningEffort: null,
  activeAgentId: null,
  modelMetaById: {},
  isSubmitting: false,
  lastRenderedMessageCount: 0,
  lastRenderedSnapshotKey: "",
  stagedAttachments: [],
};

const INITIAL_USAGE_TEXT = "Disk DB";
let modeDropdown: CustomSelectAPI | null = null;
let modelDropdown: CustomSelectAPI | null = null;
let effortDropdown: CustomSelectAPI | null = null;

function byId<T extends HTMLElement>(id: string, guard?: (element: T) => boolean): T | null {
  const element = document.getElementById(id) as T | null;
  if (element == null) {
    return null;
  }

  if (guard != null && !guard(element)) {
    return null;
  }

  return element;
}

function dbPathArg(): string | undefined {
  const path = runtime.dbPath.trim();
  return path !== "" ? path : undefined;
}

function sendStageToHost(title: string, subtitle: string): void {
  try {
    window.electronAPI?.sendToHost?.("opencode-ui-connect-stage", { title, subtitle });
  } catch (_error) {}
}

function sendToolsReadyToHost(payload: OpencodeUiToolsReadyPayload): void {
  try {
    window.electronAPI?.sendToHost?.("opencode-ui-tools-ready", payload);
  } catch (_error) {}
}

function sendSessionChangedToHost(sessionId: string | null): void {
  try {
    window.electronAPI?.sendToHost?.("opencode-ui-session-changed", { sessionId });
  } catch (_error) {}
}

function setWorkspaceUrlLabel(url: string): void {
  const workspaceUrlEl = byId<HTMLElement>("workspace-url-display");
  if (workspaceUrlEl != null) {
    workspaceUrlEl.textContent = url;
    workspaceUrlEl.setAttribute("title", url);
  }
}

async function copyWorkspaceUrl(): Promise<void> {
  const workspaceUrlEl = byId<HTMLElement>("workspace-url-display");
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

function getLogoFallback(): void {
  const logoEl = byId<HTMLImageElement>("logo");
  if (logoEl == null) return;
  logoEl.onerror = function (): void {
    logoEl.style.background = "var(--accent-gradient)";
    logoEl.style.display = "block";
    logoEl.removeAttribute("src");
  };
}

function showToast(message: string): void {
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

function formatTimestamp(value: number): string {
  if (!Number.isFinite(value) || value <= 0) return "--";
  return new Date(value).toLocaleString("tr-TR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function setActiveSession(sessionId: string | null): void {
  runtime.activeSessionId = sessionId;
  sendSessionChangedToHost(sessionId);
}

function clearChatArea(): void {
  const chatMessages = byId<HTMLElement>("chat-messages");
  const chatEmpty = byId<HTMLElement>("chat-empty");
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
export { buildMessageRequestBody };

async function wait(delayMs: number): Promise<void> {
  await new Promise<void>((resolve) => {
    setTimeout(resolve, delayMs);
  });
}

function updateUsagePlaceholders(text: string): void {
  updateUsagePlaceholdersFromModule(renderContext(), text);
}

function updateUsageFromSession(usage: Record<string, unknown> | undefined): void {
  updateUsageFromSessionFromModule(renderContext(), usage);
}

function renderTodoPanel(todos: OpencodeUiTodoItem[]): void {
  renderTodoPanelFromModule(renderContext(), todos);
}

function renderFilesPanel(files: string[], workspacePath: string): void {
  renderFilesPanelFromModule(renderContext(), files, workspacePath);
}

function createHistoricAssistantToolHost(): HTMLElement | null {
  return createHistoricAssistantToolHostFromModule(renderContext());
}

function renderHistoricToolCall(targetContainer: HTMLElement, toolCall: OpencodeUiToolCall): void {
  renderHistoricToolCallFromModule(targetContainer, toolCall);
}

async function listSessionsFromDisk(): Promise<OpencodeUiSessionSummary[]> {
  const electronApi = window.electronAPI;
  if (electronApi === undefined) {
    throw new Error("electronAPI mevcut degil");
  }

  const result = (await electronApi.opencodeUiFsListSessions(
    dbPathArg()
  )) as OpencodeUiFsListResult;
  if (result.success !== true) {
    throw new Error(result.error ?? "Session listesi alinamadi");
  }

  const sessions = Array.isArray(result.sessions) ? result.sessions : [];
  return sessions.slice().sort((a, b) => {
    const bUpdated = Number(b.updated_at);
    const aUpdated = Number(a.updated_at);
    const safeBUpdated = Number.isFinite(bUpdated) ? bUpdated : 0;
    const safeAUpdated = Number.isFinite(aUpdated) ? aUpdated : 0;
    return safeBUpdated - safeAUpdated;
  });
}

async function ensureSessionInDisk(sessionId: string, title?: string): Promise<void> {
  const electronApi = window.electronAPI;
  if (electronApi === undefined) {
    throw new Error("electronAPI mevcut degil");
  }

  const result = (await electronApi.opencodeUiFsEnsureSession(
    sessionId,
    title,
    dbPathArg()
  )) as OpencodeUiFsEnsureResult;

  if (result.success !== true) {
    throw new Error(result.error ?? "Session disk kaydi olusturulamadi");
  }
}

async function readSessionFromDisk(sessionId: string): Promise<OpencodeUiSessionDetail | null> {
  const electronApi = window.electronAPI;
  if (electronApi === undefined) {
    throw new Error("electronAPI mevcut degil");
  }

  const result = (await electronApi.opencodeUiFsReadSession(
    sessionId,
    dbPathArg()
  )) as OpencodeUiFsReadResult;
  if (result.success !== true) {
    return null;
  }

  return result.session ?? null;
}

async function archiveSessionInDisk(sessionId: string, archived = true): Promise<void> {
  const electronApi = window.electronAPI;
  if (electronApi === undefined) {
    throw new Error("electronAPI mevcut degil");
  }

  const result = (await electronApi.opencodeUiFsArchiveSession(
    sessionId,
    archived,
    dbPathArg()
  )) as OpencodeUiFsArchiveResult;

  if (result.success !== true) {
    throw new Error(result.error ?? "Session arsivlenemedi");
  }
}

function getSessionsForTab(
  sessions: OpencodeUiSessionSummary[],
  tab: SessionTab = runtime.sessionTab
): OpencodeUiSessionSummary[] {
  return getSessionsForTabFromModule(sessions, tab);
}

function sessionListContext(): SessionListContext {
  return {
    runtime,
    byId,
    formatTimestamp,
    listSessionsFromDisk,
    archiveSessionInDisk,
    loadActiveSessionHistory,
    loadSessionListAndRender,
    setActiveSession,
    createServerSession,
    ensureSessionInDisk,
    reportError: (message: string): void => {
      addMessage("assistant", message);
    },
  };
}

function historyContext(): HistoryContext {
  return {
    runtime,
    byId,
    initialUsageText: INITIAL_USAGE_TEXT,
    clearChatArea,
    renderTodoPanel,
    renderFilesPanel,
    updateUsagePlaceholders,
    updateUsageFromSession,
    addMessage,
    createHistoricAssistantToolHost,
    renderHistoricToolCall,
    readSessionFromDisk,
    scrollChatToBottom,
    buildSessionSnapshotKey,
    wait,
  };
}

function providerContext(): ProviderContext {
  return {
    runtime,
    byId,
    modelDropdown,
    effortDropdown,
  };
}

function bootstrapContext(): BootstrapContext {
  return {
    runtime,
    byId,
    getSessionsForTab,
    listSessionsFromDisk,
    createServerSession,
    setActiveSession,
    loadSessionListAndRender,
    loadActiveSessionHistory,
    checkHealth,
    loadStatusContext,
    loadToolsFinalSnapshot,
    syncActiveSessionHistoryIfUpdated,
  };
}

function renderContext(): RenderContext {
  return {
    byId,
    initialUsageText: INITIAL_USAGE_TEXT,
  };
}

async function loadSessionListAndRender(
  options: {
    preserveActive?: boolean;
    syncSelectionToTab?: boolean;
  } = {}
): Promise<void> {
  await loadSessionListAndRenderFromModule(sessionListContext(), options);
}

function scrollChatToBottom(force = false): void {
  const chatMessages = byId<HTMLElement>("chat-messages");
  if (chatMessages == null) return;

  if (force) {
    chatMessages.scrollTop = chatMessages.scrollHeight;
    return;
  }

  requestAnimationFrame(() => {
    chatMessages.scrollTop = chatMessages.scrollHeight;
  });
}

function composerContext(): Parameters<typeof sendComposerMessage>[0] {
  return {
    runtime,
    byId,
    showToast,
    ensureActiveSession,
    loadSessionListAndRender,
    withHistorySyncFallback,
    scrollChatToBottom,
  };
}

async function loadActiveSessionHistory(): Promise<void> {
  await loadActiveSessionHistoryFromModule(historyContext());
}

async function syncActiveSessionHistoryIfUpdated(): Promise<void> {
  await syncActiveSessionHistoryIfUpdatedFromModule(historyContext());
}

function setSendButtonState(): void {
  setComposerSendButtonState(runtime, byId);
}

function removeComposerAttachment(attachmentId: string): void {
  removeComposerAttachmentById(runtime, attachmentId, byId);
}

function renderAttachmentTray(): void {
  renderComposerAttachmentTray(runtime, byId);
}

function stageComposerAttachments(attachments: ComposerAttachment[]): void {
  stageComposerAttachmentsFromModule(runtime, attachments, composerContext());
}

async function stageFileList(
  files: FileList | File[],
  source: ComposerAttachment["source"]
): Promise<void> {
  await stageComposerFileListFromModule(runtime, files, source, composerContext());
}

async function readClipboardAttachmentsFromEvent(event: ClipboardEvent): Promise<boolean> {
  return await readComposerClipboardAttachmentsFromEvent(event, runtime, composerContext());
}

async function readClipboardAttachmentsFromSystem(): Promise<ComposerAttachment[]> {
  return await readComposerClipboardAttachmentsFromSystem();
}

async function withHistorySyncFallback(fallbackText: string): Promise<void> {
  await withHistorySyncFallbackFromModule(historyContext(), fallbackText);
}

async function createServerSession(title = "Yeni Sohbet"): Promise<string> {
  const response = await apiCall<unknown>("POST", "/session", { title });
  const sessionId = normalizeSessionId(response);

  if (sessionId === "") {
    throw new Error("Session ID alinamadi");
  }

  await ensureSessionInDisk(sessionId, title);
  return sessionId;
}

async function ensureActiveSession(): Promise<string> {
  if (runtime.activeSessionId != null && runtime.activeSessionId !== "") {
    return runtime.activeSessionId;
  }

  const sessions = await listSessionsFromDisk();
  const visibleSessions = getSessionsForTab(sessions, "active");
  if (visibleSessions.length > 0) {
    const firstId = visibleSessions[0]?.id;
    if (typeof firstId === "string" && firstId !== "") {
      runtime.sessionTab = "active";
      setActiveSession(firstId);
      return firstId;
    }
  }

  const createdId = await createServerSession();
  setActiveSession(createdId);
  await loadSessionListAndRender({ preserveActive: true });
  return createdId;
}

async function sendMessage(): Promise<void> {
  await sendComposerMessage(composerContext());
}

function pruneLastMessages(): void {
  const chatMessages = byId<HTMLElement>("chat-messages");
  if (chatMessages == null) return;

  const all = chatMessages.querySelectorAll<HTMLElement>(".ds-message, .ds-tool-call");
  if (all.length === 0) return;

  let removed = 0;
  for (let i = all.length - 1; i >= 0 && removed < 2; i -= 1) {
    const el = all[i];
    if (el == null) continue;
    if (el.classList.contains("ds-tool-call")) {
      el.remove();
      continue;
    }
    el.remove();
    removed += 1;
  }

  const remaining = chatMessages.querySelectorAll(".ds-message");
  const chatEmpty = byId<HTMLElement>("chat-empty");
  if (remaining.length === 0 && chatEmpty != null) {
    if (!chatMessages.contains(chatEmpty)) {
      chatMessages.appendChild(chatEmpty);
    }
    chatEmpty.style.display = "";
  }
}

async function clearChat(): Promise<void> {
  const confirmed = window.confirm("Tum sohbet temizlenecek ve yeni session acilacak. Devam?");
  if (!confirmed) return;

  try {
    const sessionId = await createServerSession("Yeni Sohbet");
    setActiveSession(sessionId);
    await loadSessionListAndRender({ preserveActive: true });
    await loadActiveSessionHistory();
  } catch (error) {
    addMessage(
      "assistant",
      "Yeni session olusturulamadi: " +
        (error instanceof Error && error.message !== "" ? error.message : String(error))
    );
  }
}

function initSessionEvents(): void {
  initSessionEventsFromModule(sessionListContext());
}

function initChatEvents(): void {
  const chatInput = byId<HTMLTextAreaElement>("chat-input");
  const sendBtn = byId<HTMLButtonElement>("send-btn");
  const pruneBtn = byId<HTMLButtonElement>("prune-btn");
  const clearBtn = byId<HTMLButtonElement>("clear-btn");
  const attachInput = byId<HTMLInputElement>("attach-file-input");
  const attachmentTray = byId<HTMLElement>("clipboard-preview-area");

  if (chatInput == null || sendBtn == null) {
    return;
  }

  const updateInputState = (): void => {
    chatInput.style.height = "";
    chatInput.style.height = `${String(Math.min(chatInput.scrollHeight, 200))}px`;
    setSendButtonState();
  };

  sendBtn.addEventListener("click", () => {
    void sendMessage();
  });

  chatInput.addEventListener("input", updateInputState);
  chatInput.addEventListener("keydown", (event) => {
    if (event.key === "Enter" && event.ctrlKey) {
      event.preventDefault();
      void sendMessage();
    }
  });
  chatInput.addEventListener("paste", (event) => {
    void readClipboardAttachmentsFromEvent(event);
  });

  pruneBtn?.addEventListener("click", () => {
    pruneLastMessages();
  });

  clearBtn?.addEventListener("click", () => {
    void clearChat();
  });

  const attachFileBtn = byId<HTMLButtonElement>("attach-file-btn");
  attachFileBtn?.addEventListener("click", () => {
    attachInput?.click();
  });
  attachInput?.addEventListener("change", () => {
    const files = attachInput.files;
    if (files == null || files.length === 0) {
      return;
    }
    void stageFileList(files, "file-picker");
    attachInput.value = "";
  });

  const attachImageBtn = byId<HTMLButtonElement>("attach-image-btn");
  attachImageBtn?.addEventListener("click", () => {
    void (async (): Promise<void> => {
      try {
        const attachments = await readClipboardAttachmentsFromSystem();
        if (attachments.length === 0) {
          showToast("Clipboard'da eklenebilir icerik bulunamadi.");
          return;
        }
        stageComposerAttachments(attachments);
      } catch (error) {
        showToast(
          "Clipboard okunamadi: " +
            (error instanceof Error && error.message !== "" ? error.message : String(error))
        );
      }
    })();
  });
  attachmentTray?.addEventListener("click", (event) => {
    const target = event.target;
    if (!(target instanceof HTMLElement)) {
      return;
    }

    const attachmentId = target.getAttribute("data-attachment-remove");
    if (attachmentId == null || attachmentId === "") {
      return;
    }

    removeComposerAttachment(attachmentId);
  });

  renderAttachmentTray();
  updateInputState();
}

async function loadAgents(): Promise<void> {
  if (modeDropdown == null) {
    return;
  }

  try {
    const payload = await apiCall<unknown>("GET", "/agent");
    const items = normalizeAgentItems(payload);
    if (items.length === 0) {
      modeDropdown.setError("Yok");
      runtime.activeAgentId = null;
      return;
    }

    const initial = runtime.activeAgentId ?? items[0]?.value ?? "";
    runtime.activeAgentId = initial !== "" ? initial : null;
    modeDropdown.setItems(items, runtime.activeAgentId ?? undefined);
  } catch {
    modeDropdown.setError("Hata");
  }
}

function refreshReasoningEffortDropdown(): void {
  refreshReasoningEffortDropdownFromModule(providerContext());
}

async function loadProviderContextAndModels(
  providerPayloadOverride?: unknown,
  configPayloadOverride?: unknown
): Promise<void> {
  await loadProviderContextAndModelsFromModule(
    providerContext(),
    providerPayloadOverride,
    configPayloadOverride
  );
}

function initSelects(): void {
  modeDropdown = setupCustomSelect("mode-dropdown", (value: string) => {
    runtime.activeAgentId = value !== "" ? value : null;
  });

  modelDropdown = setupCustomSelect("model-dropdown", (value: string) => {
    runtime.activeModelId = value !== "" ? value : null;
    refreshReasoningEffortDropdown();

    const modelEl = byId<HTMLElement>("model");
    if (modelEl != null) {
      modelEl.textContent = value !== "" ? value : "-";
    }
  });

  effortDropdown = setupCustomSelect("effort-dropdown", (value: string) => {
    runtime.activeReasoningEffort = value !== "" ? value : null;
  });
}

function initUtilityActions(): void {
  const copyUrlBtn = byId<HTMLButtonElement>("btn-copy-url");
  copyUrlBtn?.addEventListener("click", () => {
    void copyWorkspaceUrl();
  });
}

async function initializeSessionSelection(resumeSessionId: string): Promise<void> {
  await initializeSessionSelectionFromModule(bootstrapContext(), resumeSessionId);
}

function startPeriodicRefresh(): void {
  startPeriodicRefreshFromModule(bootstrapContext());
}

function startLiveMessageRefresh(): void {
  startLiveMessageRefreshFromModule(bootstrapContext());
}

export async function runOpencodeUiBootstrapPipeline(options: {
  deps: OpencodeUiBootstrapDeps;
  emitStage: (title: string, subtitle: string) => void;
  emitToolsReady: (payload: OpencodeUiToolsReadyPayload) => void;
}): Promise<void> {
  await runOpencodeUiBootstrapPipelineFromModule(options);
}

async function bootstrapOpencodeUiApp(): Promise<void> {
  const params = new URLSearchParams(window.location.search);
  const port = params.get("port") ?? "4096";
  const resumeSessionId = params.get("resumeSessionId") ?? "";
  const dbPath = params.get("dbPath") ?? "";
  const baseUrl = `http://127.0.0.1:${port}`;

  runtime.baseUrl = baseUrl;
  runtime.dbPath = dbPath;

  setApiBaseUrl(baseUrl);
  setWorkspaceUrlLabel(window.location.href);
  getLogoFallback();
  updateUsagePlaceholders(INITIAL_USAGE_TEXT);

  window.__hayalet_provider_config = opencodeUiConfig as unknown as ProviderConfig;

  initUIHelpers();
  initSelects();
  initUtilityActions();
  initSessionEvents();
  initChatEvents();

  sendStageToHost("OpenCode UI basladi", "Sayfa modulleri hazirlaniyor");

  try {
    await runOpencodeUiBootstrapPipeline({
      deps: {
        checkHealth,
        loadStatusContext,
        waitForMcpServersSettled: async () => {
          return await waitForMcpServersSettled({ timeoutMs: 20000, intervalMs: 1000 });
        },
        loadToolsFinalSnapshot,
      },
      emitStage: sendStageToHost,
      emitToolsReady: sendToolsReadyToHost,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    sendStageToHost("Baglanti kismi", `Bootstrap hatasi: ${message}`);
    sendToolsReadyToHost({
      ready: true,
      unresolvedServers: [],
      mcpChecks: 0,
      toolCount: 0,
    });
  }

  try {
    await Promise.all([loadAgents(), loadProviderContextAndModels()]);
    await initializeSessionSelection(resumeSessionId);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    const errorArea = byId<HTMLElement>("error-area");
    if (errorArea != null) {
      errorArea.textContent = `Hata: ${message}`;
    }
    sendStageToHost("Baglanti kismi", `Session yukleme hatasi: ${message}`);
  }

  startPeriodicRefresh();
  startLiveMessageRefresh();
}

if (typeof window !== "undefined" && typeof document !== "undefined") {
  void bootstrapOpencodeUiApp();
}
