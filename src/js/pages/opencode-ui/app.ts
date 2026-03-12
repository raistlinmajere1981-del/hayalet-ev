import { apiCall, setApiBaseUrl } from "./api.js";
import {
  initializeSessionSelection as initializeSessionSelectionFromModule,
  type OpencodeUiBootstrapDeps,
  type OpencodeUiToolsReadyPayload,
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
  selectActiveModelKey as selectActiveModelKeyFromModule,
  updateModelPreferences as updateModelPreferencesFromModule,
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
import {
  initQuickPromptPanel,
  loadToolsFinalSnapshot,
  refreshQuickPromptPanel,
} from "./tools-prompts.js";
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
import { setupCustomSelect } from "./ui-helpers.js";
import { buildSessionSnapshotKey, normalizeSessionId } from "./message-content.js";
import { normalizeAgentItems } from "./provider-catalog.js";
import { DEFAULT_OPENCODE_UI_MODEL_PREFERENCES } from "./model-preferences.js";
import { createModelSettingsOverlayController } from "./model-settings-overlay.js";
import {
  applyAssistantIdentityToChatEmpty,
  byId,
  clearChatArea,
  copyWorkspaceUrl,
  formatTimestamp,
  getLogoFallback,
  sendSessionChangedToHost,
  sendStageToHost,
  sendToolsReadyToHost,
  setWorkspaceUrlLabel,
  showToast,
  wait,
} from "./host-helpers.js";
import { createSessionStorage } from "./session-storage.js";
import { initOpencodeUiChatEvents } from "./chat-events.js";
import { bootstrapOpencodeUiApp as bootstrapOpencodeUiAppFromModule } from "./app-bootstrap.js";
import type {
  ComposerAttachment,
  CustomSelectAPI,
  OpencodeUiSessionDetail,
  OpencodeUiSessionSummary,
  OpencodeUiTodoItem,
  OpencodeUiToolCall,
  RuntimeState,
  SessionTab,
} from "./types.js";
import { config as opencodeUiConfig } from "../../modules/webview/providers/opencode-ui/config.js";
import { bootstrapOpencodeUiI18n, t } from "./i18n.js";
import { ThemeManager } from "../../ui/theme-manager.js";
import { AppI18n } from "../../modules/i18n/index.js";
type SessionListContext = Parameters<typeof loadSessionListAndRenderFromModule>[0];
type HistoryContext = Parameters<typeof loadActiveSessionHistoryFromModule>[0];
type BootstrapContext = Parameters<typeof initializeSessionSelectionFromModule>[0];

const runtime: RuntimeState = {
  baseUrl: "http://127.0.0.1:4096",
  dbPath: "",
  activeSessionId: null,
  sessionTab: "active",
  submittingSessionId: null,
  activeModelKey: null,
  activeReasoningEffort: null,
  activeAgentId: null,
  modelMetaByKey: {},
  modelItems: [],
  providerItems: [],
  modelPreferences: { ...DEFAULT_OPENCODE_UI_MODEL_PREFERENCES },
  endpointDefaultModelKeys: [],
  isSubmitting: false,
  lastRenderedMessageCount: 0,
  lastRenderedSnapshotKey: "",
  stagedAttachments: [],
};

const sessionStorage = createSessionStorage(runtime);
let modeDropdown: CustomSelectAPI | null = null;
let modelDropdown: CustomSelectAPI | null = null;
let effortDropdown: CustomSelectAPI | null = null;
let modelSettingsOverlayController: ReturnType<typeof createModelSettingsOverlayController> | null =
  null;
let localeRefreshBound = false;
let localeRefreshInFlight: Promise<void> | null = null;

function getInitialUsageText(): string {
  return t("usage.diskDb");
}

function setActiveSession(sessionId: string | null): void {
  runtime.activeSessionId = sessionId;
  sendSessionChangedToHost(sessionId);
  const api = window.electronAPI as
    | undefined
    | {
        opencodeUiSessionWatchStart?: (sessionId: string, dbPath?: string) => Promise<unknown>;
        opencodeUiSessionWatchStop?: () => Promise<unknown>;
      };
  if (!api) {
    return;
  }

  const normalized = typeof sessionId === "string" ? sessionId.trim() : "";
  const dbPath = runtime.dbPath.trim() !== "" ? runtime.dbPath.trim() : undefined;
  if (normalized !== "") {
    void api.opencodeUiSessionWatchStart?.(normalized, dbPath);
  } else {
    void api.opencodeUiSessionWatchStop?.();
  }
}
export { buildMessageRequestBody };

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
  return await sessionStorage.listSessionsFromDisk();
}

async function ensureSessionInDisk(sessionId: string, title?: string): Promise<void> {
  await sessionStorage.ensureSessionInDisk(sessionId, title);
}

async function readSessionFromDisk(sessionId: string): Promise<OpencodeUiSessionDetail | null> {
  return await sessionStorage.readSessionFromDisk(sessionId);
}

async function archiveSessionInDisk(sessionId: string, archived = true): Promise<void> {
  await sessionStorage.archiveSessionInDisk(sessionId, archived);
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
    initialUsageText: getInitialUsageText(),
    clearChatArea: (): void => {
      clearChatArea(runtime, byId);
    },
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
    onModelStateUpdated: (): void => {
      refreshModelSettingsOverlay();
    },
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
    initialUsageText: getInitialUsageText(),
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

async function createServerSession(title = t("session.createDefaultTitle")): Promise<string> {
  const response = await apiCall<unknown>("POST", "/session", { title });
  const sessionId = normalizeSessionId(response);

  if (sessionId === "") {
    throw new Error(t("session.sessionIdUnavailable"));
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
  const confirmed = window.confirm(t("session.clearConfirm"));
  if (!confirmed) return;

  try {
    const sessionId = await createServerSession();
    setActiveSession(sessionId);
    await loadSessionListAndRender({ preserveActive: true });
    await loadActiveSessionHistory();
  } catch (error) {
    addMessage(
      "assistant",
      t("session.createFailed", {
        message: error instanceof Error && error.message !== "" ? error.message : String(error),
      })
    );
  }
}

function initSessionEvents(): void {
  initSessionEventsFromModule(sessionListContext());
}

function initChatEvents(): void {
  initOpencodeUiChatEvents({
    byId,
    showToast,
    sendMessage,
    setSendButtonState,
    pruneLastMessages,
    clearChat,
    stageFileList,
    readClipboardAttachmentsFromEvent,
    readClipboardAttachmentsFromSystem,
    stageComposerAttachments,
    removeComposerAttachment,
    renderAttachmentTray,
  });
}

async function loadAgents(): Promise<void> {
  if (modeDropdown == null) {
    return;
  }

  try {
    const payload = await apiCall<unknown>("GET", "/agent");
    const items = normalizeAgentItems(payload);
    if (items.length === 0) {
      modeDropdown.setError(t("provider.none"));
      runtime.activeAgentId = null;
      return;
    }

    const initial = runtime.activeAgentId ?? items[0]?.value ?? "";
    runtime.activeAgentId = initial !== "" ? initial : null;
    modeDropdown.setItems(items, runtime.activeAgentId ?? undefined);
  } catch {
    modeDropdown.setError(t("provider.error"));
  }
}

async function selectActiveModelKey(
  modelKey: string | null,
  options: { persistSelection?: boolean } = {}
): Promise<void> {
  await selectActiveModelKeyFromModule(providerContext(), modelKey, options);
}

async function updateModelPreferences(
  updater: Parameters<typeof updateModelPreferencesFromModule>[1]
): Promise<void> {
  await updateModelPreferencesFromModule(providerContext(), updater);
}

function refreshModelSettingsOverlay(): void {
  modelSettingsOverlayController?.refresh();
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

  modelDropdown = setupCustomSelect("model-dropdown", (value: string): void => {
    void selectActiveModelKey(value !== "" ? value : null, { persistSelection: true });
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

  modelSettingsOverlayController = createModelSettingsOverlayController({
    runtime,
    byId,
    showToast,
    updateModelPreferences,
  });
  modelSettingsOverlayController.init();
  initQuickPromptPanel({ showToast });
}

async function refreshLocalizedDynamicPanels(): Promise<void> {
  if (localeRefreshInFlight != null) {
    await localeRefreshInFlight;
    return;
  }

  localeRefreshInFlight = (async (): Promise<void> => {
    const refreshJobs = [
      loadSessionListAndRender({ preserveActive: true }),
      loadActiveSessionHistory(),
      loadStatusContext(),
      loadToolsFinalSnapshot(),
      loadAgents(),
      loadProviderContextAndModels(),
      refreshQuickPromptPanel(),
    ];

    await Promise.allSettled(refreshJobs);
    await applyAssistantIdentityToChatEmpty(byId);
    modelSettingsOverlayController?.refresh();
  })().finally(() => {
    localeRefreshInFlight = null;
  });

  await localeRefreshInFlight;
}

function bindLocaleRefresh(): void {
  if (localeRefreshBound) {
    return;
  }

  localeRefreshBound = true;
  AppI18n.subscribe(() => {
    void refreshLocalizedDynamicPanels();
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
  await bootstrapOpencodeUiAppFromModule({
    runtime,
    initialUsageText: getInitialUsageText(),
    providerConfig: opencodeUiConfig,
    byId,
    setApiBaseUrl,
    setWorkspaceUrlLabel: (url: string) => {
      setWorkspaceUrlLabel(url, byId);
    },
    getLogoFallback: () => {
      getLogoFallback(byId);
    },
    updateUsagePlaceholders,
    initSelects,
    initUtilityActions,
    initSessionEvents,
    initChatEvents,
    sendStageToHost,
    sendToolsReadyToHost,
    runOpencodeUiBootstrapPipeline,
    deps: {
      checkHealth,
      loadStatusContext,
      waitForMcpServersSettled: async () => {
        return await waitForMcpServersSettled({ timeoutMs: 20000, intervalMs: 1000 });
      },
      loadToolsFinalSnapshot,
    },
    loadAgents,
    loadProviderContextAndModels,
    initializeSessionSelection,
    startPeriodicRefresh,
    startLiveMessageRefresh,
  });
}

function syncThemeFromQuery(): void {
  const themeParam = new URLSearchParams(window.location.search).get("theme");
  if (themeParam == null || themeParam === "") {
    return;
  }

  const theme = ThemeManager.getAvailableThemes().find((item) => item.id === themeParam);
  if (theme == null) {
    return;
  }

  ThemeManager.set(theme.id, false);
}

if (typeof window !== "undefined" && typeof document !== "undefined") {
  window.addEventListener("opencode-ui:mcp-changed", () => {
    void (async (): Promise<void> => {
      try {
        await waitForMcpServersSettled({ timeoutMs: 20000, intervalMs: 1000 });
        await loadToolsFinalSnapshot();
      } catch (_error) {}
    })();
  });

  void (async (): Promise<void> => {
    ThemeManager.init();
    syncThemeFromQuery();
    await bootstrapOpencodeUiI18n();
    await applyAssistantIdentityToChatEmpty(byId);
    await bootstrapOpencodeUiApp();
    bindLocaleRefresh();
  })();
}
