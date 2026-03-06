export type HttpMethod = "GET" | "POST" | "PUT" | "PATCH" | "DELETE";

export interface ApiProxyResult {
  success: boolean;
  data?: unknown;
  error?: string;
  status?: number;
}

export interface FetchOptions {
  method: string;
  headers?: Record<string, string>;
  body?: string;
}

export interface CustomSelectItem {
  value: string;
  label: string;
  subtitle?: string;
  badge?: string;
  badgeClass?: string;
}

export interface CustomSelectAPI {
  setItems: (items: CustomSelectItem[], activeValue?: string) => void;
  setError: (msg?: string) => void;
}

export type CustomSelectCallback = (value: string, text: string) => void | Promise<void>;

export type SessionTab = "active" | "archived";

export interface OpencodeUiSessionSummary {
  id: string;
  title: string;
  workspace_path: string;
  updated_at: number;
  created_at: number;
  archived_at: number | null;
}

export interface OpencodeUiToolCall {
  name: string;
  args?: string;
  result?: string;
}

export interface OpencodeUiSessionMessage {
  role: "user" | "assistant";
  text: string;
  files?: Array<{ name?: string; media_type?: string }>;
  toolCalls?: OpencodeUiToolCall[];
}

export interface OpencodeUiTodoItem {
  content: string;
  status: string;
  priority: string;
}

export interface OpencodeUiSessionDetail {
  id: string;
  title: string;
  workspace_path: string;
  usage: Record<string, unknown>;
  messages: OpencodeUiSessionMessage[];
  todos?: OpencodeUiTodoItem[];
  changed_files?: string[];
}

export interface OpencodeUiFsListResult {
  success: boolean;
  sessions?: OpencodeUiSessionSummary[];
  error?: string;
}

export interface OpencodeUiFsReadResult {
  success: boolean;
  session?: OpencodeUiSessionDetail;
  error?: string;
}

export interface OpencodeUiFsEnsureResult {
  success: boolean;
  created?: boolean;
  error?: string;
}

export interface OpencodeUiFsArchiveResult {
  success: boolean;
  archived?: boolean;
  error?: string;
}

export interface SelectItem {
  value: string;
  label: string;
  subtitle?: string;
  providerId?: string;
  reasoningEfforts?: string[];
}

export interface ModelMeta {
  providerId: string;
  reasoningEfforts: string[];
}

export interface ComposerAttachment {
  id: string;
  name: string;
  mimeType: string;
  base64: string;
  size: number;
  source: "file-picker" | "clipboard";
}

export interface ProviderItem {
  id: string;
  name: string;
  badge: string;
}

export interface RuntimeState {
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
