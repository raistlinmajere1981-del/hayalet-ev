import { apiCall, setApiBaseUrl } from "./api.js";
import { checkHealth, loadStatusContext, waitForMcpServersSettled } from "./health.js";
import { loadToolsFinalSnapshot } from "./tools-prompts.js";
import { addMessage, escapeHtml } from "./chat-utils.js";
import { initUIHelpers, setupCustomSelect } from "./ui-helpers.js";
import type { CustomSelectAPI } from "./types.js";
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

interface OpencodeUiSessionSummary {
  id: string;
  title: string;
  workspace_path: string;
  updated_at: number;
  created_at: number;
}

interface OpencodeUiToolCall {
  name: string;
  args?: string;
  result?: string;
}

interface OpencodeUiSessionMessage {
  role: "user" | "assistant";
  text: string;
  files?: Array<{ name?: string; media_type?: string }>;
  toolCalls?: OpencodeUiToolCall[];
}

interface OpencodeUiSessionDetail {
  id: string;
  title: string;
  workspace_path: string;
  usage: Record<string, unknown>;
  messages: OpencodeUiSessionMessage[];
}

interface OpencodeUiFsListResult {
  success: boolean;
  sessions?: OpencodeUiSessionSummary[];
  error?: string;
}

interface OpencodeUiFsReadResult {
  success: boolean;
  session?: OpencodeUiSessionDetail;
  error?: string;
}

interface OpencodeUiFsEnsureResult {
  success: boolean;
  created?: boolean;
  error?: string;
}

interface SelectItem {
  value: string;
  label: string;
  subtitle?: string;
  providerId?: string;
  reasoningEfforts?: string[];
}

interface ModelMeta {
  providerId: string;
  reasoningEfforts: string[];
}

interface RuntimeState {
  baseUrl: string;
  dbPath: string;
  activeSessionId: string | null;
  activeModelId: string | null;
  activeReasoningEffort: string | null;
  activeAgentId: string | null;
  modelMetaById: Record<string, ModelMeta>;
  isSubmitting: boolean;
  lastRenderedMessageCount: number;
}

const runtime: RuntimeState = {
  baseUrl: "http://127.0.0.1:4096",
  dbPath: "",
  activeSessionId: null,
  activeModelId: null,
  activeReasoningEffort: null,
  activeAgentId: null,
  modelMetaById: {},
  isSubmitting: false,
  lastRenderedMessageCount: 0,
};

const REASONING_EFFORT_ORDER = ["low", "medium", "high", "xhigh"];

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
}

function normalizeString(value: unknown): string {
  return typeof value === "string" ? value : "";
}

function normalizeReasoningEfforts(raw: unknown): string[] {
  if (raw == null || typeof raw !== "object" || Array.isArray(raw)) {
    return [];
  }

  const values = Object.keys(raw)
    .map((item) => item.trim().toLowerCase())
    .filter((item) => REASONING_EFFORT_ORDER.includes(item));

  if (values.length === 0) {
    return [];
  }

  const unique = Array.from(new Set(values));
  return REASONING_EFFORT_ORDER.filter((item) => unique.includes(item));
}

function extractModelMeta(modelRecord: Record<string, unknown>, providerId: string): ModelMeta {
  const variants = modelRecord["variants"];
  const reasoningEfforts = normalizeReasoningEfforts(variants);
  return {
    providerId,
    reasoningEfforts,
  };
}

function toReasoningEffortItems(modelId: string | null): SelectItem[] {
  if (modelId == null || modelId === "") {
    return [];
  }

  const meta = runtime.modelMetaById[modelId];
  if (meta == null) {
    return [];
  }

  return meta.reasoningEfforts.map((effort) => ({
    value: effort,
    label: `effort:${effort}`,
    subtitle: modelId,
  }));
}

interface BuildMessageRequestInput {
  text: string;
  modelId: string | null;
  providerId: string | null;
  agentId?: string | null;
  reasoningEffort?: string | null;
}

export function buildMessageRequestBody(input: BuildMessageRequestInput): Record<string, unknown> {
  const body: Record<string, unknown> = {
    parts: [{ type: "text", text: input.text }],
  };

  if (
    input.modelId != null &&
    input.modelId !== "" &&
    input.providerId != null &&
    input.providerId !== ""
  ) {
    const modelPayload: Record<string, unknown> = {
      providerID: input.providerId,
      modelID: input.modelId,
    };

    if (input.reasoningEffort != null && input.reasoningEffort !== "") {
      modelPayload["options"] = {
        reasoningEffort: input.reasoningEffort,
      };
    }

    body["model"] = modelPayload;
  }

  if (input.agentId != null && input.agentId !== "") {
    body["agent"] = input.agentId;
  }

  return body;
}

function normalizeSessionId(payload: unknown): string {
  if (typeof payload === "string") {
    return payload;
  }

  if (payload == null || typeof payload !== "object" || Array.isArray(payload)) {
    return "";
  }

  const record = payload as Record<string, unknown>;
  const directId =
    record["id"] ?? record["sessionID"] ?? record["sessionId"] ?? record["session_id"];
  if (typeof directId === "string" && directId !== "") {
    return directId;
  }

  const nestedSession = record["session"];
  if (nestedSession != null && typeof nestedSession === "object" && !Array.isArray(nestedSession)) {
    const nestedId = (nestedSession as Record<string, unknown>)["id"];
    if (typeof nestedId === "string" && nestedId !== "") {
      return nestedId;
    }
  }

  return "";
}

function extractTextFromPart(part: unknown): string {
  if (part == null || typeof part !== "object" || Array.isArray(part)) {
    return "";
  }

  const record = part as Record<string, unknown>;
  const type = normalizeString(record["type"]);
  const partKind = normalizeString(record["part_kind"]);

  if (type === "text" || partKind === "text") {
    const text = normalizeString(record["text"]);
    if (text !== "") {
      return text;
    }

    const content = normalizeString(record["content"]);
    if (content !== "") {
      return content;
    }

    return normalizeString(record["content_delta"]);
  }

  return "";
}

function extractAssistantText(payload: unknown): string {
  if (payload == null) {
    return "";
  }

  if (Array.isArray(payload)) {
    const text = payload.map((item) => extractAssistantText(item)).filter((item) => item !== "");
    return text.join("\n").trim();
  }

  if (typeof payload === "object") {
    const record = payload as Record<string, unknown>;

    const directParts = record["parts"];
    if (Array.isArray(directParts)) {
      const text = directParts
        .map((part) => extractTextFromPart(part))
        .filter((partText) => partText !== "");
      if (text.length > 0) {
        return text.join("\n").trim();
      }
    }

    const nestedInfo = record["info"];
    if (nestedInfo != null && typeof nestedInfo === "object" && !Array.isArray(nestedInfo)) {
      const nestedContent = (nestedInfo as Record<string, unknown>)["content"];
      if (typeof nestedContent === "string" && nestedContent.trim() !== "") {
        return nestedContent.trim();
      }
    }
  }

  return "";
}

async function wait(delayMs: number): Promise<void> {
  await new Promise<void>((resolve) => {
    setTimeout(resolve, delayMs);
  });
}

function updateUsagePlaceholders(text: string): void {
  const usageValueEl = byId<HTMLElement>("usage-value");
  if (usageValueEl != null) {
    usageValueEl.textContent = "--";
  }

  const usageFillEl = byId<HTMLElement>("usage-fill");
  if (usageFillEl != null) {
    usageFillEl.style.width = "0%";
  }

  const usageStatsEl = byId<HTMLElement>("usage-stats");
  if (usageStatsEl != null) {
    usageStatsEl.innerHTML = `<span class="ds-progress__stat">${escapeHtml(text)}</span>`;
  }
}

function updateUsageFromSession(usage: Record<string, unknown> | undefined): void {
  if (usage == null || typeof usage !== "object") {
    updateUsagePlaceholders(INITIAL_USAGE_TEXT);
    return;
  }

  const usageRecord = usage;
  const promptTokens = Number(usageRecord["prompt_tokens"] ?? 0);
  const completionTokens = Number(usageRecord["completion_tokens"] ?? 0);
  const totalTokens = Number(usageRecord["total_tokens"] ?? promptTokens + completionTokens);

  if (!Number.isFinite(totalTokens) || totalTokens <= 0) {
    updateUsagePlaceholders(INITIAL_USAGE_TEXT);
    return;
  }

  const usageValueEl = byId<HTMLElement>("usage-value");
  if (usageValueEl != null) {
    usageValueEl.textContent = String(totalTokens);
  }

  const usageFillEl = byId<HTMLElement>("usage-fill");
  if (usageFillEl != null) {
    usageFillEl.style.width = "100%";
  }

  const usageStatsEl = byId<HTMLElement>("usage-stats");
  if (usageStatsEl != null) {
    usageStatsEl.innerHTML =
      '<span class="ds-progress__stat">Prompt: <span class="ds-progress__stat-value">' +
      String(promptTokens) +
      '</span></span><span class="ds-progress__stat">Completion: <span class="ds-progress__stat-value">' +
      String(completionTokens) +
      "</span></span>";
  }
}

function renderHistoricToolCall(targetBubble: HTMLElement, toolCall: OpencodeUiToolCall): void {
  const card = document.createElement("div");
  card.className = "ds-tool-call ds-tool-call--open";

  const args = normalizeString(toolCall.args);
  const result = normalizeString(toolCall.result);

  card.innerHTML =
    '<div class="ds-tool-call__header">' +
    '<span class="ds-tool-call__icon">🔧</span>' +
    '<span class="ds-tool-call__name">' +
    escapeHtml(toolCall.name) +
    "</span>" +
    '<span class="ds-tool-call__status ds-tool-call__status--done">done</span>' +
    "</div>" +
    '<div class="ds-tool-call__body">' +
    (args !== ""
      ? '<div class="ds-tool-call__result"><strong>args</strong><br>' + escapeHtml(args) + "</div>"
      : "") +
    (result !== ""
      ? '<div class="ds-tool-call__result"><strong>result</strong><br>' +
        escapeHtml(result) +
        "</div>"
      : "") +
    "</div>";

  targetBubble.parentElement?.appendChild(card);
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

function renderSessionList(sessions: OpencodeUiSessionSummary[]): void {
  const listEl = byId<HTMLElement>("session-list");
  const countEl = byId<HTMLElement>("session-count-label");

  if (countEl != null) {
    countEl.textContent = `${String(sessions.length)} oturum`;
  }

  if (listEl == null) {
    return;
  }

  if (sessions.length === 0) {
    listEl.innerHTML = '<div class="empty-state">Oturum bulunamadi</div>';
    return;
  }

  listEl.innerHTML = sessions
    .map((session) => {
      const isActive = session.id === runtime.activeSessionId;
      const title = session.title !== "" ? session.title : "Untitled";
      const shortId = session.id.slice(0, 8);
      const updatedAt = formatTimestamp(Number(session.updated_at));

      return (
        '<div class="ds-session' +
        (isActive ? " ds-session--active" : "") +
        '" data-session-id="' +
        escapeHtml(session.id) +
        '">' +
        '<div class="ds-session__header">' +
        '<span class="ds-session__indicator ds-session__indicator--' +
        (isActive ? "active" : "idle") +
        '"></span>' +
        '<span class="ds-session__title" title="' +
        escapeHtml(title) +
        '">' +
        escapeHtml(title) +
        "</span>" +
        '<span class="ds-session__badge ds-session__badge--' +
        (isActive ? "active" : "idle") +
        '">* ' +
        (isActive ? "active" : "idle") +
        "</span>" +
        "</div>" +
        '<span class="ds-session__meta">' +
        escapeHtml(shortId) +
        "... * " +
        escapeHtml(updatedAt) +
        "</span>" +
        '<div class="ds-session__actions">' +
        '<button class="ds-session__action" data-action="fork" title="Fork">Fork</button>' +
        '<button class="ds-session__action" data-action="rename" title="Duzenle">Edit</button>' +
        '<button class="ds-session__action ds-session__action--delete" data-action="delete" title="Sil">Del</button>' +
        "</div>" +
        "</div>"
      );
    })
    .join("");
}

async function loadSessionListAndRender(options: { preserveActive?: boolean } = {}): Promise<void> {
  try {
    const sessions = await listSessionsFromDisk();

    if (
      options.preserveActive !== true &&
      (runtime.activeSessionId == null || runtime.activeSessionId === "") &&
      sessions.length > 0
    ) {
      setActiveSession(sessions[0]?.id ?? null);
    }

    renderSessionList(sessions);
  } catch (error) {
    const listEl = byId<HTMLElement>("session-list");
    if (listEl != null) {
      listEl.innerHTML =
        '<div class="empty-state">Session listesi okunamadi: ' +
        escapeHtml(error instanceof Error ? error.message : String(error)) +
        "</div>";
    }
  }
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

async function loadActiveSessionHistory(): Promise<void> {
  const sessionId = runtime.activeSessionId;
  if (sessionId == null || sessionId === "") {
    clearChatArea();
    updateUsagePlaceholders(INITIAL_USAGE_TEXT);
    return;
  }

  const detail = await readSessionFromDisk(sessionId);
  if (detail == null) {
    clearChatArea();
    updateUsagePlaceholders(INITIAL_USAGE_TEXT);
    return;
  }

  clearChatArea();

  const workingDirEl = byId<HTMLElement>("working-dir");
  if (workingDirEl != null && detail.workspace_path !== "") {
    workingDirEl.textContent = detail.workspace_path;
    workingDirEl.setAttribute("title", detail.workspace_path);
  }

  const messages = Array.isArray(detail.messages) ? detail.messages : [];
  for (const message of messages) {
    if (message.role === "user") {
      addMessage("user", message.text, undefined, message.files);
      continue;
    }

    const bubble = addMessage("assistant", message.text);
    const toolCalls = Array.isArray(message.toolCalls) ? message.toolCalls : [];
    if (bubble != null && toolCalls.length > 0) {
      for (const toolCall of toolCalls) {
        renderHistoricToolCall(bubble, toolCall);
      }
    }
  }

  runtime.lastRenderedMessageCount = messages.length;
  updateUsageFromSession(detail.usage);
  scrollChatToBottom(true);
}

function setSendButtonState(): void {
  const sendBtn = byId<HTMLButtonElement>("send-btn");
  const chatInput = byId<HTMLTextAreaElement>("chat-input");
  if (sendBtn == null || chatInput == null) {
    return;
  }

  if (runtime.isSubmitting) {
    sendBtn.disabled = false;
    sendBtn.textContent = "...";
    sendBtn.setAttribute("data-mode", "stop");
    return;
  }

  sendBtn.textContent = "↑";
  sendBtn.removeAttribute("data-mode");
  sendBtn.disabled = chatInput.value.trim() === "";
}

async function withHistorySyncFallback(fallbackText: string): Promise<void> {
  const sessionId = runtime.activeSessionId;
  if (sessionId == null || sessionId === "") {
    if (fallbackText !== "") {
      addMessage("assistant", fallbackText);
      scrollChatToBottom(true);
    }
    return;
  }

  const minExpectedCount = runtime.lastRenderedMessageCount + 1;

  const trySync = async (attempt: number): Promise<boolean> => {
    const detail = await readSessionFromDisk(sessionId);
    const messageCount = detail?.messages.length ?? 0;

    if (detail != null && messageCount >= minExpectedCount) {
      await loadActiveSessionHistory();
      return true;
    }

    if (attempt >= 9) {
      return false;
    }

    await wait(250);
    return await trySync(attempt + 1);
  };

  const synced = await trySync(0);
  if (!synced && fallbackText !== "") {
    addMessage("assistant", fallbackText);
    scrollChatToBottom(true);
  }
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
  if (sessions.length > 0) {
    const firstId = sessions[0]?.id;
    if (typeof firstId === "string" && firstId !== "") {
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
  const chatInput = byId<HTMLTextAreaElement>("chat-input");
  if (chatInput == null) return;

  if (runtime.isSubmitting) {
    return;
  }

  const text = chatInput.value.trim();
  if (text === "") {
    setSendButtonState();
    return;
  }

  runtime.isSubmitting = true;
  setSendButtonState();

  const sessionId = await ensureActiveSession();

  chatInput.value = "";
  chatInput.style.height = "";
  addMessage("user", text);
  scrollChatToBottom(true);

  try {
    const modelMeta =
      runtime.activeModelId != null ? runtime.modelMetaById[runtime.activeModelId] : undefined;
    const body = buildMessageRequestBody({
      text,
      modelId: runtime.activeModelId,
      providerId: modelMeta?.providerId ?? null,
      agentId: runtime.activeAgentId,
      reasoningEffort: runtime.activeReasoningEffort,
    });

    const response = await apiCall<unknown>(
      "POST",
      `/session/${encodeURIComponent(sessionId)}/message`,
      body
    );
    const fallbackText = extractAssistantText(response);

    await withHistorySyncFallback(fallbackText);
    await loadSessionListAndRender({ preserveActive: true });
  } catch (error) {
    addMessage(
      "assistant",
      "Mesaj gonderilemedi: " +
        (error instanceof Error && error.message !== "" ? error.message : String(error))
    );
    scrollChatToBottom(true);
  } finally {
    runtime.isSubmitting = false;
    setSendButtonState();
  }
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

async function activateSession(sessionId: string): Promise<void> {
  if (sessionId === "") return;
  if (runtime.activeSessionId === sessionId) return;

  setActiveSession(sessionId);
  await loadSessionListAndRender({ preserveActive: true });
  await loadActiveSessionHistory();
}

async function handleSessionAction(sessionId: string, action: string): Promise<void> {
  if (action === "delete") {
    const confirmed = window.confirm("Bu session silinsin mi?");
    if (!confirmed) return;

    await apiCall("DELETE", `/session/${encodeURIComponent(sessionId)}`);
    if (runtime.activeSessionId === sessionId) {
      setActiveSession(null);
    }
    await loadSessionListAndRender();

    if (runtime.activeSessionId == null) {
      const sessions = await listSessionsFromDisk();
      const firstId = sessions[0]?.id ?? "";
      if (firstId !== "") {
        setActiveSession(firstId);
        await loadActiveSessionHistory();
      } else {
        clearChatArea();
      }
    }

    return;
  }

  if (action === "rename") {
    const row = document.querySelector<HTMLElement>(
      `.ds-session[data-session-id="${CSS.escape(sessionId)}"]`
    );
    const titleSpan = row?.querySelector<HTMLElement>(".ds-session__title");
    if (titleSpan == null) return;

    const current = titleSpan.textContent ?? "";
    const input = document.createElement("input");
    input.type = "text";
    input.className = "ds-session__title-input";
    input.value = current;

    const commitRename = async (): Promise<void> => {
      const title = input.value.trim();
      if (title !== "" && title !== current) {
        try {
          await apiCall("PATCH", `/session/${encodeURIComponent(sessionId)}`, { title });
        } catch (_error) {}
      }
      await loadSessionListAndRender({ preserveActive: true });
    };

    let committed = false;
    input.addEventListener("keydown", (event) => {
      if (event.key === "Enter") {
        event.preventDefault();
        committed = true;
        void commitRename();
      }
      if (event.key === "Escape") {
        event.preventDefault();
        committed = true;
        void loadSessionListAndRender({ preserveActive: true });
      }
    });

    input.addEventListener("blur", () => {
      if (!committed) {
        committed = true;
        void commitRename();
      }
    });

    titleSpan.textContent = "";
    titleSpan.appendChild(input);
    input.focus();
    input.select();
    return;
  }

  if (action === "fork") {
    const response = await apiCall<unknown>(
      "POST",
      `/session/${encodeURIComponent(sessionId)}/fork`,
      {}
    );
    const forkId = normalizeSessionId(response);
    if (forkId !== "") {
      await ensureSessionInDisk(forkId, "Fork");
      await activateSession(forkId);
    } else {
      await loadSessionListAndRender({ preserveActive: true });
    }
  }
}

function initSessionEvents(): void {
  const newSessionBtn = byId<HTMLButtonElement>("new-session-btn");
  if (newSessionBtn != null) {
    newSessionBtn.addEventListener("click", () => {
      void (async (): Promise<void> => {
        try {
          const sessionId = await createServerSession("Yeni Sohbet");
          setActiveSession(sessionId);
          await loadSessionListAndRender({ preserveActive: true });
          await loadActiveSessionHistory();
        } catch (error) {
          addMessage(
            "assistant",
            "Session acilamadi: " +
              (error instanceof Error && error.message !== "" ? error.message : String(error))
          );
        }
      })();
    });
  }

  const refreshBtn = byId<HTMLButtonElement>("session-refresh-btn");
  if (refreshBtn != null) {
    refreshBtn.addEventListener("click", () => {
      refreshBtn.classList.add("is-spinning");
      refreshBtn.addEventListener(
        "animationend",
        () => {
          refreshBtn.classList.remove("is-spinning");
        },
        { once: true }
      );
      void loadSessionListAndRender({ preserveActive: true });
    });
  }

  const listEl = byId<HTMLElement>("session-list");
  if (listEl != null) {
    listEl.addEventListener("click", (event) => {
      void (async (): Promise<void> => {
        const target = event.target as HTMLElement;
        const row = target.closest<HTMLElement>(".ds-session");
        if (row == null) return;

        const sessionId = row.dataset["sessionId"] ?? "";
        if (sessionId === "") return;

        const actionButton = target.closest<HTMLElement>(".ds-session__action");
        const action = actionButton?.dataset["action"];
        if (action != null && action !== "") {
          try {
            await handleSessionAction(sessionId, action);
          } catch (error) {
            addMessage(
              "assistant",
              "Session islemi basarisiz: " +
                (error instanceof Error && error.message !== "" ? error.message : String(error))
            );
          }
          return;
        }

        await activateSession(sessionId);
      })();
    });
  }
}

function initChatEvents(): void {
  const chatInput = byId<HTMLTextAreaElement>("chat-input");
  const sendBtn = byId<HTMLButtonElement>("send-btn");
  const pruneBtn = byId<HTMLButtonElement>("prune-btn");
  const clearBtn = byId<HTMLButtonElement>("clear-btn");

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

  pruneBtn?.addEventListener("click", () => {
    pruneLastMessages();
  });

  clearBtn?.addEventListener("click", () => {
    void clearChat();
  });

  const attachFileBtn = byId<HTMLButtonElement>("attach-file-btn");
  attachFileBtn?.addEventListener("click", () => {
    showToast("Dosya ekleme bu iterasyonda aktif degil.");
  });

  const attachImageBtn = byId<HTMLButtonElement>("attach-image-btn");
  attachImageBtn?.addEventListener("click", () => {
    showToast("Clipboard yapistirma bu iterasyonda aktif degil.");
  });

  updateInputState();
}

function normalizeAgentItems(data: unknown): SelectItem[] {
  if (!Array.isArray(data)) {
    return [];
  }

  return data
    .map((item) => {
      if (typeof item === "string") {
        return { value: item, label: item };
      }

      if (item != null && typeof item === "object" && !Array.isArray(item)) {
        const record = item as Record<string, unknown>;
        const idValue = normalizeString(record["id"]);
        const nameValue = normalizeString(record["name"]);
        const value = idValue !== "" ? idValue : nameValue;
        if (value === "") return null;
        return {
          value,
          label: nameValue !== "" ? nameValue : value,
          subtitle: normalizeString(record["description"]),
        };
      }

      return null;
    })
    .filter((item): item is SelectItem => item != null && item.value !== "");
}

export function normalizeModelItems(payload: unknown): SelectItem[] {
  if (payload == null || typeof payload !== "object" || Array.isArray(payload)) {
    return [];
  }

  const record = payload as Record<string, unknown>;
  const providers = Array.isArray(record["providers"]) ? record["providers"] : [];
  const items: SelectItem[] = [];

  providers.forEach((provider) => {
    if (provider == null || typeof provider !== "object" || Array.isArray(provider)) {
      return;
    }

    const providerRecord = provider as Record<string, unknown>;
    const providerId = normalizeString(providerRecord["id"]);
    const modelsRaw = providerRecord["models"];
    const models = Array.isArray(modelsRaw)
      ? modelsRaw
      : modelsRaw != null && typeof modelsRaw === "object"
        ? Object.values(modelsRaw as Record<string, unknown>)
        : [];

    models.forEach((model) => {
      if (typeof model === "string") {
        const label = providerId !== "" ? `${providerId}:${model}` : model;
        items.push({ value: model, label, providerId, reasoningEfforts: [] });
        return;
      }

      if (model != null && typeof model === "object" && !Array.isArray(model)) {
        const modelRecord = model as Record<string, unknown>;
        const directModelId = normalizeString(modelRecord["id"]);
        const legacyModelId = normalizeString(modelRecord["model"]);
        const altModelId = normalizeString(modelRecord["modelID"]);
        const modelId =
          directModelId !== "" ? directModelId : legacyModelId !== "" ? legacyModelId : altModelId;
        if (modelId === "") {
          return;
        }

        const rawModelName = normalizeString(modelRecord["name"]);
        const modelName = rawModelName !== "" ? rawModelName : modelId;
        const label = providerId !== "" ? `${providerId}:${modelName}` : modelName;
        const modelMeta = extractModelMeta(modelRecord, providerId);
        items.push({
          value: modelId,
          label,
          subtitle: modelId,
          providerId: modelMeta.providerId,
          reasoningEfforts: modelMeta.reasoningEfforts,
        });
      }
    });
  });

  const deduped = new Map<string, SelectItem>();
  items.forEach((item) => {
    if (!deduped.has(item.value)) {
      deduped.set(item.value, item);
    }
  });

  return Array.from(deduped.values());
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
  if (effortDropdown == null) {
    return;
  }

  const items = toReasoningEffortItems(runtime.activeModelId);
  if (items.length === 0) {
    runtime.activeReasoningEffort = null;
    effortDropdown.setError("Yok");
    return;
  }

  const selected =
    runtime.activeReasoningEffort != null &&
    items.some((item) => item.value === runtime.activeReasoningEffort)
      ? runtime.activeReasoningEffort
      : (items[1]?.value ?? items[0]?.value ?? null);

  runtime.activeReasoningEffort = selected;
  effortDropdown.setItems(items, selected ?? undefined);
}

async function loadModels(): Promise<void> {
  if (modelDropdown == null) {
    return;
  }

  try {
    const payload = await apiCall<unknown>("GET", "/config/providers");
    const items = normalizeModelItems(payload);
    runtime.modelMetaById = {};
    items.forEach((item) => {
      runtime.modelMetaById[item.value] = {
        providerId: item.providerId ?? "",
        reasoningEfforts: item.reasoningEfforts ?? [],
      };
    });

    if (items.length === 0) {
      modelDropdown.setError("Yok");
      runtime.activeModelId = null;
      runtime.activeReasoningEffort = null;
      refreshReasoningEffortDropdown();

      const modelEl = byId<HTMLElement>("model");
      if (modelEl != null) {
        modelEl.textContent = "-";
      }
      return;
    }

    const defaultMap =
      payload != null && typeof payload === "object" && !Array.isArray(payload)
        ? ((payload as Record<string, unknown>)["default"] as Record<string, unknown> | undefined)
        : undefined;

    const defaults = defaultMap != null ? Object.values(defaultMap) : [];
    const defaultModelId = defaults.find((item): item is string => typeof item === "string") ?? "";

    const selected =
      runtime.activeModelId ??
      (defaultModelId !== "" ? defaultModelId : null) ??
      items[0]?.value ??
      null;

    runtime.activeModelId = selected;
    modelDropdown.setItems(items, selected ?? undefined);
    refreshReasoningEffortDropdown();

    const modelEl = byId<HTMLElement>("model");
    if (modelEl != null) {
      const selectedLabel = items.find((item) => item.value === selected)?.label ?? selected ?? "-";
      modelEl.textContent = selectedLabel;
    }
  } catch {
    modelDropdown.setError("Hata");
    runtime.activeModelId = null;
    runtime.activeReasoningEffort = null;
    runtime.modelMetaById = {};
    refreshReasoningEffortDropdown();
  }
}

async function loadProviderContext(): Promise<void> {
  try {
    const payload = await apiCall<Record<string, unknown>>("GET", "/provider");
    const accountEl = byId<HTMLElement>("account");
    if (accountEl == null) return;

    const connectedRaw = payload["connected"];
    const connected = Array.isArray(connectedRaw)
      ? connectedRaw.filter((item): item is string => typeof item === "string")
      : [];

    accountEl.textContent = connected.length > 0 ? connected.join(", ") : "-";
  } catch {
    const accountEl = byId<HTMLElement>("account");
    if (accountEl != null) {
      accountEl.textContent = "-";
    }
  }
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

async function initializeSessionSelection(resumeSessionId: string): Promise<void> {
  const sessions = await listSessionsFromDisk();

  if (sessions.length === 0) {
    const createdId = await createServerSession("Yeni Sohbet");
    setActiveSession(createdId);
    await loadSessionListAndRender({ preserveActive: true });
    await loadActiveSessionHistory();
    return;
  }

  const resumeId = resumeSessionId.trim();
  const hasResume = resumeId !== "" && sessions.some((session) => session.id === resumeId);

  if (hasResume) {
    setActiveSession(resumeId);
  } else {
    setActiveSession(sessions[0]?.id ?? null);
  }

  await loadSessionListAndRender({ preserveActive: true });
  await loadActiveSessionHistory();
}

function startPeriodicRefresh(): void {
  setInterval(() => {
    void (async (): Promise<void> => {
      try {
        await checkHealth();
        await loadStatusContext();
        await loadProviderContext();
        await loadToolsFinalSnapshot();
      } catch (_error) {}

      if (!runtime.isSubmitting) {
        await loadSessionListAndRender({ preserveActive: true });
      }

      const lastCheckEl = byId<HTMLElement>("last-check");
      if (lastCheckEl != null) {
        lastCheckEl.textContent = `Son kontrol: ${new Date().toLocaleTimeString("tr-TR")}`;
      }
    })();
  }, 15000);
}

export async function runOpencodeUiBootstrapPipeline(options: {
  deps: OpencodeUiBootstrapDeps;
  emitStage: (title: string, subtitle: string) => void;
  emitToolsReady: (payload: OpencodeUiToolsReadyPayload) => void;
}): Promise<void> {
  const { deps, emitStage, emitToolsReady } = options;

  emitStage("Sunucu saglik kontrolu", "OpenCode server health endpoint kontrol ediliyor");
  await deps.checkHealth();

  emitStage("Durum ve baglam okunuyor", "Calisma dizini bilgisi yukleniyor");
  await deps.loadStatusContext();

  emitStage("MCP durumu bekleniyor", "MCP sunuculari terminal duruma gelene kadar izleniyor");
  const mcpResult = await deps.waitForMcpServersSettled();

  emitStage("Tool snapshot aliniyor", "Final tool listesi endpointlerden okunuyor");
  const toolsResult = await deps.loadToolsFinalSnapshot();

  emitToolsReady({
    ready: true,
    unresolvedServers: mcpResult.ready ? [] : mcpResult.unresolvedServers,
    mcpChecks: mcpResult.checks,
    toolCount: toolsResult.toolIds.length,
  });

  if (mcpResult.ready) {
    emitStage("Baglanti tamamlandi", "OpenCode UI kullanima hazir");
  } else {
    emitStage("Baglanti kismi", "MCP tamamen hazir degil, UI acildi");
  }
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
    await Promise.all([loadAgents(), loadModels(), loadProviderContext()]);
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
}

if (typeof window !== "undefined" && typeof document !== "undefined") {
  void bootstrapOpencodeUiApp();
}
