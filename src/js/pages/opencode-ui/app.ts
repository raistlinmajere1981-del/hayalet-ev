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

type SessionTab = "active" | "archived";

interface OpencodeUiSessionSummary {
  id: string;
  title: string;
  workspace_path: string;
  updated_at: number;
  created_at: number;
  archived_at: number | null;
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

interface OpencodeUiTodoItem {
  content: string;
  status: string;
  priority: string;
}

interface OpencodeUiSessionDetail {
  id: string;
  title: string;
  workspace_path: string;
  usage: Record<string, unknown>;
  messages: OpencodeUiSessionMessage[];
  todos?: OpencodeUiTodoItem[];
  changed_files?: string[];
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

interface OpencodeUiFsArchiveResult {
  success: boolean;
  archived?: boolean;
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

interface ComposerAttachment {
  id: string;
  name: string;
  mimeType: string;
  base64: string;
  size: number;
  source: "file-picker" | "clipboard";
}

interface ProviderItem {
  id: string;
  name: string;
  badge: string;
}

interface RuntimeState {
  baseUrl: string;
  dbPath: string;
  activeSessionId: string | null;
  sessionTab: SessionTab;
  submittingSessionId: string | null;
  activeModelId: string | null;
  activeReasoningEffort: string | null;
  activeAgentId: string | null;
  modelMetaById: Record<string, ModelMeta>;
  isSubmitting: boolean;
  lastRenderedMessageCount: number;
  lastRenderedSnapshotKey: string;
  stagedAttachments: ComposerAttachment[];
}

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

function normalizeString(value: unknown): string {
  return typeof value === "string" ? value : "";
}

function toCompactLabel(value: unknown): string {
  const raw = normalizeString(value).trim();
  if (raw === "") {
    return "";
  }

  const slashParts = raw.split("/");
  const lastSlash = slashParts[slashParts.length - 1] ?? raw;
  const backslashParts = lastSlash.split("\\");
  return (backslashParts[backslashParts.length - 1] ?? lastSlash).trim();
}

function toWorkspaceRelativePath(filePath: unknown, workspacePath: string): string {
  const raw = normalizeString(filePath).trim();
  if (raw === "") {
    return "";
  }

  const workspace = normalizeString(workspacePath)
    .trim()
    .replace(/[\\/]+$/, "");
  if (workspace === "") {
    return raw;
  }

  if (raw === workspace) {
    return ".";
  }

  if (raw.startsWith(`${workspace}/`)) {
    return raw.slice(workspace.length + 1);
  }

  if (raw.startsWith(`${workspace}\\`)) {
    return raw.slice(workspace.length + 1);
  }

  return raw;
}

function buildMessageSnapshotToken(message: OpencodeUiSessionMessage | undefined): string {
  if (message == null) {
    return "";
  }

  const text = normalizeString(message.text);
  const tail = text.slice(-160);
  const toolCalls = Array.isArray(message.toolCalls) ? message.toolCalls : [];
  const files = Array.isArray(message.files) ? message.files : [];
  const toolTail = toolCalls
    .slice(-2)
    .map((item) => normalizeString(item.name))
    .join(",");
  return `${message.role}:${String(text.length)}:${tail}:${String(toolCalls.length)}:${toolTail}:${String(files.length)}`;
}

function buildSessionSnapshotKey(messages: OpencodeUiSessionMessage[]): string {
  if (!Array.isArray(messages) || messages.length === 0) {
    return "0";
  }

  const last = messages[messages.length - 1];
  const prev = messages.length > 1 ? messages[messages.length - 2] : undefined;
  return `${String(messages.length)}|${buildMessageSnapshotToken(prev)}|${buildMessageSnapshotToken(last)}`;
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
  attachments?: ComposerAttachment[];
}

export function buildMessageRequestBody(input: BuildMessageRequestInput): Record<string, unknown> {
  const parts: Array<Record<string, unknown>> = [];
  const text = input.text.trim();
  if (text !== "") {
    parts.push({ type: "text", text });
  }

  const attachments = Array.isArray(input.attachments) ? input.attachments : [];
  for (const attachment of attachments) {
    if (attachment.base64 === "" || attachment.name === "") {
      continue;
    }

    parts.push({
      type: "file",
      filename: attachment.name,
      name: attachment.name,
      mime: attachment.mimeType,
      media_type: attachment.mimeType,
      url: buildDataUrl(attachment.mimeType, attachment.base64),
      data: attachment.base64,
      base64: attachment.base64,
    });
  }

  const body: Record<string, unknown> = { parts };

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

  if (type === "reasoning") {
    const text = normalizeString(record["text"]).trim();
    if (text !== "") {
      return `Reasoning\n${text}`;
    }

    const metadata =
      record["metadata"] != null &&
      typeof record["metadata"] === "object" &&
      !Array.isArray(record["metadata"])
        ? (record["metadata"] as Record<string, unknown>)
        : null;
    const openai =
      metadata?.["openai"] != null &&
      typeof metadata["openai"] === "object" &&
      !Array.isArray(metadata["openai"])
        ? (metadata["openai"] as Record<string, unknown>)
        : null;
    if (normalizeString(openai?.["reasoningEncryptedContent"]).trim() !== "") {
      return "Reasoning\nIcerik sifreli veya ozet bos.";
    }

    return "Reasoning";
  }

  if (type === "step-start") {
    const snapshot = normalizeString(record["snapshot"]).trim();
    return snapshot !== "" ? `Step start\nSnapshot: ${snapshot.slice(0, 12)}` : "Step start";
  }

  if (type === "step-finish") {
    const lines = ["Step finish"];
    const reason = normalizeString(record["reason"]).trim();
    if (reason !== "") {
      lines.push(`Reason: ${reason}`);
    }

    const tokens =
      record["tokens"] != null &&
      typeof record["tokens"] === "object" &&
      !Array.isArray(record["tokens"])
        ? (record["tokens"] as Record<string, unknown>)
        : null;
    const total = Number(tokens?.["total"] ?? 0);
    if (Number.isFinite(total) && total > 0) {
      lines.push(`Tokens: ${String(total)}`);
    }

    return lines.join("\n");
  }

  if (type === "patch") {
    const filesRaw = record["files"];
    if (!Array.isArray(filesRaw) || filesRaw.length === 0) {
      return "Patch";
    }

    const files = filesRaw.map((item) => toCompactLabel(item)).filter((item) => item !== "");
    return files.length > 0 ? `Patch\nFiles:\n- ${files.join("\n- ")}` : "Patch";
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
  const reasoningTokens = Number(usageRecord["reasoning_tokens"] ?? 0);
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
    let statsHtml =
      '<span class="ds-progress__stat">Prompt: <span class="ds-progress__stat-value">' +
      String(promptTokens) +
      '</span></span><span class="ds-progress__stat">Completion: <span class="ds-progress__stat-value">' +
      String(completionTokens) +
      "</span></span>";
    if (Number.isFinite(reasoningTokens) && reasoningTokens > 0) {
      statsHtml +=
        '<span class="ds-progress__stat">Reasoning: <span class="ds-progress__stat-value">' +
        String(reasoningTokens) +
        "</span></span>";
    }
    usageStatsEl.innerHTML = statsHtml;
  }
}

function renderTodoPanel(todos: OpencodeUiTodoItem[]): void {
  const panel = byId<HTMLElement>("rtab-todo");
  if (panel == null) {
    return;
  }

  if (!Array.isArray(todos) || todos.length === 0) {
    panel.innerHTML = buildRightTabPanelCard(
      "Todo",
      "Session Ozeti",
      '<div class="empty-state">Henuz todo yok</div>',
      "0"
    );
    return;
  }

  const items = todos
    .map((todo) => {
      const content = normalizeString(todo.content).trim();
      if (content === "") {
        return "";
      }

      const statusRaw = normalizeString(todo.status).trim().toLowerCase();
      const priorityRaw = normalizeString(todo.priority).trim().toLowerCase();
      const status = statusRaw !== "" ? statusRaw : "pending";
      const priority = priorityRaw !== "" ? priorityRaw : "medium";
      return (
        '<div class="ds-todo-item ds-todo-item--' +
        escapeHtml(status) +
        '">' +
        '<div class="ds-todo-item__badges">' +
        '<span class="ds-todo-item__badge ds-todo-item__badge--status">' +
        escapeHtml(status) +
        "</span>" +
        '<span class="ds-todo-item__badge ds-todo-item__badge--priority">' +
        escapeHtml(priority) +
        "</span>" +
        "</div>" +
        '<div class="ds-todo-item__content">' +
        escapeHtml(content) +
        "</div>" +
        "</div>"
      );
    })
    .filter((item) => item !== "");

  panel.innerHTML = buildRightTabPanelCard(
    "Todo",
    "Session Ozeti",
    '<div class="ds-todo-list">' + items.join("") + "</div>",
    String(items.length)
  );
}

function renderFilesPanel(files: string[], workspacePath: string): void {
  const panel = byId<HTMLElement>("rtab-files");
  if (panel == null) {
    return;
  }

  if (!Array.isArray(files) || files.length === 0) {
    panel.innerHTML = buildRightTabPanelCard(
      "Files",
      "Workspace",
      '<div class="empty-state">Degisen dosya yok</div>',
      "0"
    );
    return;
  }

  const items = files
    .map((filePath) => {
      const fullPath = normalizeString(filePath).trim();
      if (fullPath === "") {
        return "";
      }

      const compactLabel = toCompactLabel(fullPath);
      const label = compactLabel !== "" ? compactLabel : fullPath;
      const relativePath = toWorkspaceRelativePath(fullPath, workspacePath);
      return (
        '<div class="ds-file-item" title="' +
        escapeHtml(fullPath) +
        '">' +
        '<div class="ds-file-item__name">' +
        escapeHtml(label) +
        "</div>" +
        '<div class="ds-file-item__path">' +
        escapeHtml(relativePath) +
        "</div>" +
        "</div>"
      );
    })
    .filter((item) => item !== "");

  if (items.length === 0) {
    panel.innerHTML = buildRightTabPanelCard(
      "Files",
      "Workspace",
      '<div class="empty-state">Degisen dosya yok</div>',
      "0"
    );
    return;
  }

  panel.innerHTML = buildRightTabPanelCard(
    "Files",
    "Workspace",
    '<div class="ds-file-list">' + items.join("") + "</div>",
    String(items.length)
  );
}

function buildRightTabPanelCard(
  title: string,
  eyebrow: string,
  bodyMarkup: string,
  countLabel?: string
): string {
  const countMarkup =
    countLabel != null && countLabel !== ""
      ? '<span class="ds-panel__count">' + escapeHtml(countLabel) + "</span>"
      : "";

  return (
    '<div class="ds-right-panel-card">' +
    '<div class="ds-right-panel-card__meta">' +
    "<div>" +
    '<div class="ds-right-panel-card__eyebrow">' +
    escapeHtml(eyebrow) +
    "</div>" +
    '<div class="ds-right-panel-card__title">' +
    escapeHtml(title) +
    "</div>" +
    "</div>" +
    countMarkup +
    "</div>" +
    bodyMarkup +
    "</div>"
  );
}

function createHistoricAssistantToolHost(): HTMLElement | null {
  const chatMessages = byId<HTMLElement>("chat-messages");
  if (chatMessages == null) {
    return null;
  }

  const chatEmpty = byId<HTMLElement>("chat-empty");
  if (chatEmpty != null) {
    chatEmpty.style.display = "none";
  }

  const host = document.createElement("div");
  host.className = "ds-message ds-message--assistant";
  chatMessages.appendChild(host);
  return host;
}

function renderHistoricToolCall(targetContainer: HTMLElement, toolCall: OpencodeUiToolCall): void {
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

  targetContainer.appendChild(card);
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

function isSessionArchived(session: OpencodeUiSessionSummary): boolean {
  return Number.isFinite(session.archived_at) && Number(session.archived_at) > 0;
}

function getSessionsForTab(
  sessions: OpencodeUiSessionSummary[],
  tab: SessionTab = runtime.sessionTab
): OpencodeUiSessionSummary[] {
  return sessions.filter((session) =>
    tab === "archived" ? isSessionArchived(session) : !isSessionArchived(session)
  );
}

function renderSessionTabs(sessions: OpencodeUiSessionSummary[]): void {
  const activeBtn = byId<HTMLButtonElement>("session-tab-active");
  const archivedBtn = byId<HTMLButtonElement>("session-tab-archived");
  const activeCount = getSessionsForTab(sessions, "active").length;
  const archivedCount = getSessionsForTab(sessions, "archived").length;

  if (activeBtn != null) {
    activeBtn.textContent = `Aktif (${String(activeCount)})`;
    activeBtn.classList.toggle("is-active", runtime.sessionTab === "active");
  }

  if (archivedBtn != null) {
    archivedBtn.textContent = `Arsiv (${String(archivedCount)})`;
    archivedBtn.classList.toggle("is-active", runtime.sessionTab === "archived");
  }
}

function getSessionVisualState(
  session: OpencodeUiSessionSummary
): "idle" | "active" | "working" | "archived" {
  if (runtime.isSubmitting && session.id === runtime.submittingSessionId) {
    return "working";
  }

  if (session.id === runtime.activeSessionId) {
    return "active";
  }

  return isSessionArchived(session) ? "archived" : "idle";
}

function renderSessionList(sessions: OpencodeUiSessionSummary[]): void {
  const listEl = byId<HTMLElement>("session-list");
  const countEl = byId<HTMLElement>("session-count-label");
  const visibleSessions = getSessionsForTab(sessions);

  renderSessionTabs(sessions);

  if (countEl != null) {
    countEl.textContent =
      runtime.sessionTab === "archived"
        ? `${String(visibleSessions.length)} arsiv`
        : `${String(visibleSessions.length)} oturum`;
  }

  if (listEl == null) {
    return;
  }

  if (visibleSessions.length === 0) {
    listEl.innerHTML =
      runtime.sessionTab === "archived"
        ? '<div class="empty-state">Arsivlenmis oturum yok</div>'
        : '<div class="empty-state">Oturum bulunamadi</div>';
    return;
  }

  listEl.innerHTML = visibleSessions
    .map((session) => {
      const isActive = session.id === runtime.activeSessionId;
      const archived = isSessionArchived(session);
      const visualState = getSessionVisualState(session);
      const title = session.title !== "" ? session.title : "Untitled";
      const shortId = session.id.slice(0, 8);
      const updatedAt = formatTimestamp(Number(session.updated_at));
      const archiveAction = archived
        ? ""
        : '<button class="ds-session__action ds-session__action--archive" data-action="archive" title="Arsivle">Arc</button>';
      const forkAction = archived
        ? ""
        : '<button class="ds-session__action" data-action="fork" title="Fork">Fork</button>';
      const renameAction = archived
        ? ""
        : '<button class="ds-session__action" data-action="rename" title="Duzenle">Edit</button>';

      return (
        '<div class="ds-session' +
        (isActive ? " ds-session--active" : "") +
        (visualState === "working" ? " ds-session--working" : "") +
        '" data-session-id="' +
        escapeHtml(session.id) +
        '">' +
        '<div class="ds-session__header">' +
        '<span class="ds-session__indicator ds-session__indicator--' +
        visualState +
        '"></span>' +
        '<span class="ds-session__title" title="' +
        escapeHtml(title) +
        '">' +
        escapeHtml(title) +
        "</span>" +
        '<span class="ds-session__badge ds-session__badge--' +
        visualState +
        '">* ' +
        visualState +
        "</span>" +
        "</div>" +
        '<span class="ds-session__meta">' +
        escapeHtml(shortId) +
        "... * " +
        escapeHtml(updatedAt) +
        "</span>" +
        '<div class="ds-session__actions">' +
        forkAction +
        renameAction +
        archiveAction +
        '<button class="ds-session__action ds-session__action--delete" data-action="delete" title="Sil">Del</button>' +
        "</div>" +
        "</div>"
      );
    })
    .join("");
}

async function syncActiveSessionToCurrentTab(sessions: OpencodeUiSessionSummary[]): Promise<void> {
  const visibleSessions = getSessionsForTab(sessions);
  const activeSessionVisible =
    runtime.activeSessionId != null &&
    visibleSessions.some((session) => session.id === runtime.activeSessionId);

  if (activeSessionVisible) {
    return;
  }

  setActiveSession(visibleSessions[0]?.id ?? null);
  await loadActiveSessionHistory();
}

async function loadSessionListAndRender(
  options: {
    preserveActive?: boolean;
    syncSelectionToTab?: boolean;
  } = {}
): Promise<void> {
  try {
    const sessions = await listSessionsFromDisk();
    const visibleSessions = getSessionsForTab(sessions);

    if (options.syncSelectionToTab === true) {
      await syncActiveSessionToCurrentTab(sessions);
    }

    if (
      options.preserveActive !== true &&
      (runtime.activeSessionId == null || runtime.activeSessionId === "") &&
      visibleSessions.length > 0
    ) {
      setActiveSession(visibleSessions[0]?.id ?? null);
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
    renderTodoPanel([]);
    renderFilesPanel([], "");
    updateUsagePlaceholders(INITIAL_USAGE_TEXT);
    return;
  }

  const detail = await readSessionFromDisk(sessionId);
  if (detail == null) {
    clearChatArea();
    renderTodoPanel([]);
    renderFilesPanel([], "");
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
  renderTodoPanel(Array.isArray(detail.todos) ? detail.todos : []);
  renderFilesPanel(
    Array.isArray(detail.changed_files) ? detail.changed_files : [],
    detail.workspace_path
  );
  for (const message of messages) {
    if (message.role === "user") {
      addMessage("user", message.text, undefined, message.files);
      continue;
    }

    const toolCalls = Array.isArray(message.toolCalls) ? message.toolCalls : [];
    const bubble = addMessage("assistant", message.text);
    const toolTarget =
      bubble?.parentElement ?? (toolCalls.length > 0 ? createHistoricAssistantToolHost() : null);
    if (toolTarget != null && toolCalls.length > 0) {
      for (const toolCall of toolCalls) {
        renderHistoricToolCall(toolTarget, toolCall);
      }
    }
  }

  runtime.lastRenderedMessageCount = messages.length;
  runtime.lastRenderedSnapshotKey = buildSessionSnapshotKey(messages);
  updateUsageFromSession(detail.usage);
  scrollChatToBottom(true);
}

let liveSyncInFlight = false;

async function syncActiveSessionHistoryIfUpdated(): Promise<void> {
  const sessionId = runtime.activeSessionId;
  if (sessionId == null || sessionId === "") {
    return;
  }

  if (liveSyncInFlight) {
    return;
  }

  liveSyncInFlight = true;

  try {
    const detail = await readSessionFromDisk(sessionId);
    if (detail == null) {
      return;
    }

    if (runtime.activeSessionId !== sessionId) {
      return;
    }

    const messages = Array.isArray(detail.messages) ? detail.messages : [];
    const nextCount = messages.length;
    const nextSnapshot = buildSessionSnapshotKey(messages);

    if (
      nextCount !== runtime.lastRenderedMessageCount ||
      nextSnapshot !== runtime.lastRenderedSnapshotKey
    ) {
      await loadActiveSessionHistory();
    }
  } catch (_error) {
  } finally {
    liveSyncInFlight = false;
  }
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
  sendBtn.disabled = chatInput.value.trim() === "" && runtime.stagedAttachments.length === 0;
}

function sanitizeAttachmentName(name: string, fallback: string): string {
  const withoutReservedChars = name.trim().replace(/[<>:"/\\|?*]+/g, "_");
  const cleaned = Array.from(withoutReservedChars, (char) => {
    return char.charCodeAt(0) <= 0x1f ? "_" : char;
  }).join("");
  return cleaned !== "" ? cleaned : fallback;
}

function extensionFromMime(mimeType: string): string {
  switch (mimeType) {
    case "image/png":
      return "png";
    case "image/jpeg":
      return "jpg";
    case "image/webp":
      return "webp";
    case "image/gif":
      return "gif";
    case "text/plain":
      return "txt";
    case "application/pdf":
      return "pdf";
    default:
      return "bin";
  }
}

function bytesToBase64(bytes: Uint8Array): string {
  let binary = "";
  const chunkSize = 0x8000;
  for (let index = 0; index < bytes.length; index += chunkSize) {
    const chunk = bytes.subarray(index, index + chunkSize);
    binary += String.fromCharCode(...chunk);
  }
  return btoa(binary);
}

function textToBase64(text: string): string {
  return bytesToBase64(new TextEncoder().encode(text));
}

function buildDataUrl(mimeType: string, base64: string): string {
  const safeMimeType = mimeType.trim() !== "" ? mimeType : "application/octet-stream";
  return `data:${safeMimeType};base64,${base64}`;
}

function formatAttachmentSize(size: number): string {
  if (!Number.isFinite(size) || size <= 0) {
    return "";
  }
  if (size < 1024) {
    return `${String(size)} B`;
  }
  if (size < 1024 * 1024) {
    return `${String(Math.max(1, Math.round(size / 1024)))} KB`;
  }
  return `${(size / (1024 * 1024)).toFixed(1)} MB`;
}

function attachmentKindLabel(attachment: ComposerAttachment): string {
  if (attachment.mimeType.startsWith("image/")) {
    return "IMG";
  }
  if (attachment.mimeType.startsWith("text/")) {
    return "TXT";
  }
  if (attachment.mimeType === "application/pdf") {
    return "PDF";
  }
  return "FILE";
}

function createAttachmentId(): string {
  return `att_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

async function fileToComposerAttachment(
  file: File,
  source: ComposerAttachment["source"]
): Promise<ComposerAttachment> {
  const arrayBuffer = await file.arrayBuffer();
  const bytes = new Uint8Array(arrayBuffer);
  const hasMimeType = file.type.trim() !== "";
  const mimeType = hasMimeType ? file.type : "application/octet-stream";
  const inferredExtension = hasMimeType ? extensionFromMime(file.type) : "bin";
  return {
    id: createAttachmentId(),
    name: sanitizeAttachmentName(file.name, `attachment.${inferredExtension}`),
    mimeType,
    base64: bytesToBase64(bytes),
    size: file.size,
    source,
  };
}

function createClipboardTextAttachment(text: string): ComposerAttachment | null {
  const normalized = text.trim();
  if (normalized === "") {
    return null;
  }

  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  return {
    id: createAttachmentId(),
    name: `clipboard-${timestamp}.txt`,
    mimeType: "text/plain",
    base64: textToBase64(normalized),
    size: new TextEncoder().encode(normalized).length,
    source: "clipboard",
  };
}

function dedupeComposerAttachments(
  current: ComposerAttachment[],
  incoming: ComposerAttachment[]
): ComposerAttachment[] {
  const seen = new Set(
    current.map(
      (attachment) => `${attachment.name}:${attachment.size}:${attachment.base64.slice(0, 32)}`
    )
  );
  const next = [...current];
  for (const attachment of incoming) {
    const key = `${attachment.name}:${attachment.size}:${attachment.base64.slice(0, 32)}`;
    if (seen.has(key)) {
      continue;
    }
    seen.add(key);
    next.push(attachment);
  }
  return next;
}

function setComposerAttachments(attachments: ComposerAttachment[]): void {
  runtime.stagedAttachments = attachments;
  renderAttachmentTray();
  setSendButtonState();
}

function removeComposerAttachment(attachmentId: string): void {
  setComposerAttachments(
    runtime.stagedAttachments.filter((attachment) => attachment.id !== attachmentId)
  );
}

function buildOutgoingAttachmentPreview(
  attachments: ComposerAttachment[]
): Array<{ name: string; fileName: string }> {
  return attachments.map((attachment) => ({
    name: attachment.name,
    fileName: attachment.name,
  }));
}

function renderAttachmentTray(): void {
  const tray = byId<HTMLElement>("clipboard-preview-area");
  if (tray == null) {
    return;
  }

  if (runtime.stagedAttachments.length === 0) {
    tray.classList.add("is-hidden");
    tray.innerHTML = "";
    return;
  }

  tray.classList.remove("is-hidden");
  tray.innerHTML = runtime.stagedAttachments
    .map((attachment) => {
      const sizeText = formatAttachmentSize(attachment.size);
      const detail = [attachmentKindLabel(attachment), sizeText]
        .filter((item) => item !== "")
        .join(" • ");
      const sourceLabel =
        attachment.source === "clipboard" ? "Panodan eklendi" : "Dosyadan eklendi";
      return (
        '<div class="ds-attachment-chip" title="' +
        escapeHtml(`${attachment.name}\n${sourceLabel}`) +
        '">' +
        '<span class="ds-attachment-chip__meta">' +
        escapeHtml(detail) +
        "</span>" +
        '<span class="ds-attachment-chip__name">' +
        escapeHtml(attachment.name) +
        "</span>" +
        '<button type="button" class="ds-attachment-chip__remove" data-attachment-remove="' +
        escapeHtml(attachment.id) +
        '" aria-label="' +
        escapeHtml(`${attachment.name} kaldir`) +
        '">×</button>' +
        "</div>"
      );
    })
    .join("");
}

function stageComposerAttachments(attachments: ComposerAttachment[]): void {
  if (attachments.length === 0) {
    return;
  }

  const next = dedupeComposerAttachments(runtime.stagedAttachments, attachments);
  const addedCount = next.length - runtime.stagedAttachments.length;
  setComposerAttachments(next);

  if (addedCount > 0) {
    showToast(`${String(addedCount)} ek hazir`);
  } else {
    showToast("Ayni ek zaten hazir");
  }
}

async function stageFileList(
  files: FileList | File[],
  source: ComposerAttachment["source"]
): Promise<void> {
  const entries = Array.from(files);
  if (entries.length === 0) {
    return;
  }

  const attachments = await Promise.all(
    entries.map(async (file) => await fileToComposerAttachment(file, source))
  );
  stageComposerAttachments(attachments);
}

async function readClipboardAttachmentsFromEvent(event: ClipboardEvent): Promise<boolean> {
  const clipboardData = event.clipboardData;
  if (clipboardData == null) {
    return false;
  }

  const directFiles = Array.from(clipboardData.files);
  const itemFiles = Array.from(clipboardData.items)
    .filter((item) => item.kind === "file")
    .map((item) => item.getAsFile())
    .filter((file): file is File => file != null);
  const files = [...directFiles, ...itemFiles];
  if (files.length > 0) {
    event.preventDefault();
    await stageFileList(files, "clipboard");
    return true;
  }

  return false;
}

async function readClipboardAttachmentsFromSystem(): Promise<ComposerAttachment[]> {
  const clipboardApi = navigator.clipboard as Clipboard & {
    read?: () => Promise<ClipboardItem[]>;
  };

  if (typeof clipboardApi.read === "function") {
    const items = await clipboardApi.read();
    const attachmentGroups = await Promise.all(
      items.map(async (item) => {
        const imageTypes = item.types.filter((type) => type.startsWith("image/"));
        return await Promise.all(
          imageTypes.map(async (type) => {
            const blob = await item.getType(type);
            const extension = extensionFromMime(type);
            const file = new File([blob], `clipboard-${Date.now()}.${extension}`, { type });
            return await fileToComposerAttachment(file, "clipboard");
          })
        );
      })
    );
    const attachments = attachmentGroups.flat();

    if (attachments.length > 0) {
      return attachments;
    }
  }

  if (typeof navigator.clipboard.readText === "function") {
    const text = await navigator.clipboard.readText();
    const textAttachment = createClipboardTextAttachment(text);
    if (textAttachment != null) {
      return [textAttachment];
    }
  }

  return [];
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
  const chatInput = byId<HTMLTextAreaElement>("chat-input");
  if (chatInput == null) return;

  if (runtime.isSubmitting) {
    return;
  }

  const text = chatInput.value.trim();
  const stagedAttachments = [...runtime.stagedAttachments];
  if (text === "" && stagedAttachments.length === 0) {
    setSendButtonState();
    return;
  }

  runtime.isSubmitting = true;
  setSendButtonState();

  const sessionId = await ensureActiveSession();
  runtime.submittingSessionId = sessionId;
  await loadSessionListAndRender({ preserveActive: true });

  const previousText = chatInput.value;
  chatInput.value = "";
  chatInput.style.height = "";
  addMessage("user", text, undefined, buildOutgoingAttachmentPreview(stagedAttachments));
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
      attachments: stagedAttachments,
    });

    const response = await apiCall<unknown>(
      "POST",
      `/session/${encodeURIComponent(sessionId)}/message`,
      body
    );
    const fallbackText = extractAssistantText(response);

    await withHistorySyncFallback(fallbackText);
    await loadSessionListAndRender({ preserveActive: true });
    setComposerAttachments([]);
  } catch (error) {
    chatInput.value = previousText;
    setComposerAttachments(stagedAttachments);
    addMessage(
      "assistant",
      "Mesaj gonderilemedi: " +
        (error instanceof Error && error.message !== "" ? error.message : String(error))
    );
    scrollChatToBottom(true);
  } finally {
    runtime.isSubmitting = false;
    runtime.submittingSessionId = null;
    setSendButtonState();
    await loadSessionListAndRender({ preserveActive: true });
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
  if (action === "archive") {
    const confirmed = window.confirm("Bu session arsivlensin mi?");
    if (!confirmed) return;

    await archiveSessionInDisk(sessionId, true);
    const sessions = await listSessionsFromDisk();
    await syncActiveSessionToCurrentTab(sessions);
    renderSessionList(sessions);
    return;
  }

  if (action === "delete") {
    const confirmed = window.confirm("Bu session silinsin mi?");
    if (!confirmed) return;

    await apiCall("DELETE", `/session/${encodeURIComponent(sessionId)}`);
    const sessions = await listSessionsFromDisk();
    await syncActiveSessionToCurrentTab(sessions);
    renderSessionList(sessions);

    return;
  }

  if (action === "rename") {
    const row = document.querySelector<HTMLElement>(
      `.ds-session[data-session-id="${CSS.escape(sessionId)}"]`
    );
    const titleSpan = row?.querySelector<HTMLElement>(".ds-session__title");
    if (titleSpan == null) return;

    const current = titleSpan.textContent;
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

async function switchSessionTab(tab: SessionTab): Promise<void> {
  if (runtime.sessionTab === tab) {
    return;
  }

  runtime.sessionTab = tab;
  await loadSessionListAndRender({ preserveActive: true, syncSelectionToTab: true });
}

function initSessionEvents(): void {
  const newSessionBtn = byId<HTMLButtonElement>("new-session-btn");
  if (newSessionBtn != null) {
    newSessionBtn.addEventListener("click", () => {
      void (async (): Promise<void> => {
        try {
          runtime.sessionTab = "active";
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

  const activeTabBtn = byId<HTMLButtonElement>("session-tab-active");
  activeTabBtn?.addEventListener("click", () => {
    void switchSessionTab("active");
  });

  const archivedTabBtn = byId<HTMLButtonElement>("session-tab-archived");
  archivedTabBtn?.addEventListener("click", () => {
    void switchSessionTab("archived");
  });

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

async function loadModels(payloadOverride?: unknown): Promise<void> {
  if (modelDropdown == null) {
    return;
  }

  try {
    const payload = payloadOverride ?? (await apiCall<unknown>("GET", "/config/providers"));
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

function normalizeProviderItemsFromConfig(payload: unknown): ProviderItem[] {
  if (payload == null || typeof payload !== "object" || Array.isArray(payload)) {
    return [];
  }

  const providersRaw = (payload as Record<string, unknown>)["providers"];
  if (!Array.isArray(providersRaw)) {
    return [];
  }

  const deduped = new Map<string, ProviderItem>();

  providersRaw.forEach((provider) => {
    if (provider == null || typeof provider !== "object" || Array.isArray(provider)) {
      return;
    }

    const record = provider as Record<string, unknown>;
    const id = normalizeString(record["id"]);
    if (id === "") {
      return;
    }

    const name = normalizeString(record["name"]);
    const type = normalizeString(record["type"]);
    const badge = type !== "" ? type : "Config";

    deduped.set(id, {
      id,
      name: name !== "" ? name : id,
      badge,
    });
  });

  return Array.from(deduped.values());
}

function normalizeConnectedProviderIds(payload: unknown): string[] {
  const collectStringArray = (value: unknown): string[] =>
    Array.isArray(value)
      ? value
          .map((item) => {
            if (typeof item === "string") {
              return item.trim();
            }

            if (item != null && typeof item === "object" && !Array.isArray(item)) {
              const record = item as Record<string, unknown>;
              const id = normalizeString(record["id"]);
              const name = normalizeString(record["name"]);
              return id !== "" ? id : name;
            }

            return "";
          })
          .filter((item) => item !== "")
      : [];

  if (Array.isArray(payload)) {
    return Array.from(new Set(collectStringArray(payload)));
  }

  if (payload == null || typeof payload !== "object") {
    return [];
  }

  const record = payload as Record<string, unknown>;
  const connected = collectStringArray(record["connected"]);
  if (connected.length > 0) {
    return Array.from(new Set(connected));
  }

  const providers = record["providers"];
  if (Array.isArray(providers)) {
    const activeIds = providers
      .map((item) => {
        if (item == null || typeof item !== "object" || Array.isArray(item)) {
          return "";
        }

        const providerRecord = item as Record<string, unknown>;
        const connectedValue = providerRecord["connected"];
        const activeValue = providerRecord["active"];
        if (connectedValue === true || activeValue === true) {
          const id = normalizeString(providerRecord["id"]);
          const name = normalizeString(providerRecord["name"]);
          return id !== "" ? id : name;
        }

        return "";
      })
      .filter((item) => item !== "");

    if (activeIds.length > 0) {
      return Array.from(new Set(activeIds));
    }
  }

  return [];
}

function renderProviderRows(items: ProviderItem[]): string {
  if (items.length === 0) {
    return `<div class="empty-state">Provider bulunamadi</div>`;
  }

  return items
    .map((item) => {
      const safeName = escapeHtml(item.name);
      const safeBadge = escapeHtml(item.badge);

      return (
        `<div class="ds-provider-row">` +
        `<span class="ds-provider-name">${safeName}</span>` +
        (safeBadge !== "" ? `<span class="ds-provider-badge">${safeBadge}</span>` : "") +
        `</div>`
      );
    })
    .join("");
}

function renderProvidersPanel(items: ProviderItem[]): void {
  const listEl = byId<HTMLElement>("providers-list");
  if (listEl == null) {
    return;
  }

  listEl.innerHTML = renderProviderRows(items);
}

async function loadProviderContextAndModels(
  providerPayloadOverride?: unknown,
  configPayloadOverride?: unknown
): Promise<void> {
  try {
    const providerPayload =
      providerPayloadOverride ?? (await apiCall<Record<string, unknown>>("GET", "/provider"));
    const configPayload =
      configPayloadOverride ?? (await apiCall<Record<string, unknown>>("GET", "/config/providers"));

    const connectedIds = normalizeConnectedProviderIds(providerPayload);
    const catalog = normalizeProviderItemsFromConfig(configPayload);
    const connectedSet = new Set(connectedIds);
    const items = catalog
      .map((item) => ({
        ...item,
        badge: connectedSet.has(item.id) ? "Connected" : "Available",
      }))
      .sort((left, right) => {
        if (left.badge !== right.badge) {
          return left.badge === "Connected" ? -1 : 1;
        }
        return left.name.localeCompare(right.name, "tr");
      });

    renderProvidersPanel(items);
    await loadModels(configPayload);
  } catch {
    renderProvidersPanel([]);
    await loadModels(configPayloadOverride);
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

function initUtilityActions(): void {
  const copyUrlBtn = byId<HTMLButtonElement>("btn-copy-url");
  copyUrlBtn?.addEventListener("click", () => {
    void copyWorkspaceUrl();
  });
}

async function initializeSessionSelection(resumeSessionId: string): Promise<void> {
  runtime.sessionTab = "active";
  const sessions = await listSessionsFromDisk();
  const visibleSessions = getSessionsForTab(sessions, "active");

  if (visibleSessions.length === 0) {
    const createdId = await createServerSession("Yeni Sohbet");
    setActiveSession(createdId);
    await loadSessionListAndRender({ preserveActive: true });
    await loadActiveSessionHistory();
    return;
  }

  const resumeId = resumeSessionId.trim();
  const hasResume = resumeId !== "" && visibleSessions.some((session) => session.id === resumeId);

  if (hasResume) {
    setActiveSession(resumeId);
  } else {
    setActiveSession(visibleSessions[0]?.id ?? null);
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

function startLiveMessageRefresh(): void {
  setInterval(() => {
    void syncActiveSessionHistoryIfUpdated();
  }, 1200);
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
