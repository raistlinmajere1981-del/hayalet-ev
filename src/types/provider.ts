/**
 * Provider Types - AI provider configurations
 *
 * @module src/js/types/provider
 */

import type { AllProviderId } from "./common.js";

// Selector Types

/** Base selectors */
export interface BaseSelectors {
  sendButton: string;
  sendButtonDisabled?: string;
  stopButton: string;
  inputField: string;
  messageContainer: string;
  voiceButton?: string;
  filePreview?: string | string[];
  attachButton?: string;
}

/** Scrape selectors */
export interface ScrapeSelectors {
  preferred: string;
  fallback: string;
  messageWrapper?: string;
  userWrapper?: string;
  assistantWrapper?: string;
  messageId?: string;
  userMessage?: string;
  assistantMessage?: string;
}

/** Role selectors (for Gemini) */
export interface RoleSelectors {
  user: string;
  assistant: string;
  text?: string;
}

/** Filter settings */
export interface FilterConfig {
  selectors: string[];
  hosts: string[];
  blockResourceTypes: string[];
  dragOverlaySelectors?: string[];
  dragTextMatchers?: string[];
}

/** Telemetry settings */
export interface TelemetryConfig {
  endpoints: string[];
  tokenPaths: string[];
}

export interface LocalizedSelectorEntry {
  tr?: string;
  en?: string;
  fallbacks?: string[];
  [locale: string]: string | string[] | undefined;
}

export interface ProviderSelectorMatrix {
  selectors?: Record<string, LocalizedSelectorEntry>;
}

export type ProviderScenarioFailureMode = "abort" | "continue" | "warn";

export type ProviderScenarioCommandActionId =
  | "navigate-default"
  | "assert-disabled-send"
  | "assert-drag-drop-surface"
  | "inject-prompt"
  | "assert-enabled-send"
  | "assert-attach-flow"
  | "send-and-wait-thinking"
  | "assert-final-bubbles"
  | "assert-scroll-behavior"
  | "assert-provider-capabilities"
  | "click"
  | "wait"
  | "check"
  | "navigate"
  | "collect-session-urls"
  | "sync-session"
  | "refresh-conversation-list"
  | (string & {});

export interface ProviderScenarioCommandDefinition {
  id: string;
  label: string;
  action: ProviderScenarioCommandActionId;
  target?: string;
  params?: Record<string, unknown>;
  saveAs?: string;
  forEach?: string;
  loading?: boolean;
  onFail?: ProviderScenarioFailureMode;
  whenSyncModes?: ProviderWebviewSyncMode[];
}

export interface ProviderScenarioDefinition {
  id: ProviderScenarioId;
  title: string;
  description?: string;
  commands: ProviderScenarioCommandDefinition[];
}

export type ProviderWebviewSyncReadiness = "verified" | "estimated";

export type ProviderWebviewSyncMode = "soft" | "full" | "clean";

export interface ProviderWebviewSyncSidebarSelectors {
  openButtonSelectors: string[];
  closeButtonSelectors: string[];
}

export interface ProviderWebviewSyncHistorySelectors {
  containerSelectors: string[];
  itemSelectors: string[];
  titleSelectors: string[];
}

export interface ProviderWebviewSyncConfig {
  readiness: ProviderWebviewSyncReadiness;
  sidebar: ProviderWebviewSyncSidebarSelectors;
  history: ProviderWebviewSyncHistorySelectors;
}

// Provider Config Types

/** Message ID strategy */
export type MessageIdStrategy = "content-hash" | "dom-id";

/** Input type */
export type InputType = "direct" | "character-by-character" | "contenteditable";

/** Base provider configuration */
export interface BaseProviderConfig {
  id: AllProviderId;
  name: string;
  baseUrl: string;
  loginUrl: string | null;
  lastVerified: string;

  selectors: BaseSelectors;
  selectorMatrix?: ProviderSelectorMatrix;
  inputType: InputType;
  scrollerSelectors: string[];
  scrapeSelectors: ScrapeSelectors;
  fileInputSelectors: string[];
  uploadTargetSelectors: string[];
  criticalSelectors: string[];
  contentContainers: string[];
  excludedUrls: string[];

  filters: FilterConfig;
  telemetry: TelemetryConfig;

  messageIdStrategy?: MessageIdStrategy;
  roleSelectors?: RoleSelectors;
  defaultPaths?: string[];
  scenarios?: Record<string, ProviderScenarioDefinition>;
  webviewSync?: ProviderWebviewSyncConfig;
}

/** ChatGPT configuration */
export interface ChatGPTConfig extends BaseProviderConfig {
  id: "chatgpt";
}

/** Gemini configuration */
export interface GeminiConfig extends BaseProviderConfig {
  id: "gemini";
  defaultPaths: string[];
  roleSelectors: RoleSelectors;
}

/** Grok configuration */
export interface GrokConfig extends BaseProviderConfig {
  id: "grok";
}

/** OpenCode configuration (Assistant) */
export interface OpenCodeConfig extends BaseProviderConfig {
  id: "opencode";
  port: number;
  cors: string;
  command: string;
  isAssistant: true;
  loginUrl: null;
  getProjectUrl: (projectPath?: string | null, port?: number) => string;
  getServerCommand: (port?: number, cors?: string) => { command: string; args: string[] };
}

/** OpenCode UI configuration (Assistant) */
export interface OpenCodeUiConfig extends BaseProviderConfig {
  id: "opencode-ui";
  port: number;
  cors: string;
  command: string;
  isAssistant: true;
  loginUrl: null;
  getProjectUrl: (projectPath?: string | null, port?: number) => string;
  getServerCommand: (port?: number, cors?: string) => { command: string; args: string[] };
}

/** Assistant provider configs. */
export type AssistantProviderConfig = OpenCodeConfig | OpenCodeUiConfig;

/** All provider configs. */
export type ProviderConfig = ChatGPTConfig | GeminiConfig | GrokConfig | AssistantProviderConfig;

// Provider Instance Types

/** Provider scraper interface */
export interface ProviderScraper {
  scrapeMessages: (doc: Document) => ScrapedMessage[];
  getMessageRole: (el: Element) => "user" | "assistant" | null;
  getMessageText: (el: Element) => string;
}

/** Scraped message */
export interface ScrapedMessage {
  role: "user" | "assistant";
  text: string;
  index: number;
  contentHash?: string;
  domId?: string;
}

/** Provider instance (config + scraper) */
export interface ProviderInstance {
  config: ProviderConfig;
  scraper: ProviderScraper;
}

// Provider Registry Types

/** Registry'deki provider bilgisi */
export interface RegisteredProvider {
  id: AllProviderId;
  config: ProviderConfig;
  scraper?: ProviderScraper;
}

/** Provider registry map */
export type ProviderRegistryMap = Map<AllProviderId, RegisteredProvider>;

// ============================================
// Provider Test Types
// ============================================

/** Test result status */
export type TestStatus = "pass" | "fail" | "skip" | "warning";

export type ProviderScenarioId = "webview-test" | "webview-sync" | (string & {});

export type ProviderTestSlot = "ai0" | "ai1" | "ai2";

export type ProviderScenarioProgressEventType =
  | "started"
  | "command-start"
  | "command-complete"
  | "completed";

export type ProviderTestProgressEventType = ProviderScenarioProgressEventType;
export type ProviderScenarioCommandStatus = TestStatus | "running";

/** Test category */
export type TestCategory = "preflight" | "dom" | "interactive" | "scraping" | "advanced";

export interface ProviderTestSelectorEvidence {
  group: string;
  key: string;
  selector: string;
  promotable: boolean;
}

export interface ProviderSessionPreviewItem {
  title: string;
  url: string;
}

export interface ProviderSessionPreview {
  total: number;
  sessions: ProviderSessionPreviewItem[];
}

export interface ProviderTestResultDetails {
  selector?: string;
  element?: {
    tagName: string;
    visible: boolean;
    enabled: boolean;
    textContent?: string;
  };
  selectorEvidence?: ProviderTestSelectorEvidence;
  sessionPreview?: ProviderSessionPreview;
  error?: string;
}

/** Single test result */
export interface ProviderTestResult {
  id: string; // "input-field-test"
  name: string; // "Input Field Accessibility"
  category: TestCategory;
  status: TestStatus;
  message: string; // User-facing message
  details?: ProviderTestResultDetails;
  duration: number; // ms
  timestamp: number;
}

export interface ProviderScenarioCommandReport {
  id: string;
  name: string;
  action: ProviderScenarioCommandActionId | (string & {});
  status: ProviderScenarioCommandStatus;
  message: string;
  duration: number;
  timestamp: number;
  startedAt?: number;
  completedAt?: number;
  input?: Record<string, unknown>;
  output?: unknown;
  details?: ProviderTestResultDetails;
}

export interface ProviderScenarioProgressEvent {
  runId: string;
  scenarioId: ProviderScenarioId;
  slot: ProviderTestSlot;
  providerId: string;
  type: ProviderScenarioProgressEventType;
  commandId?: string;
  commandName?: string;
  status?: ProviderScenarioCommandStatus;
  message?: string;
  commandReport?: ProviderScenarioCommandReport;
  timestamp: number;
}

export type ProviderTestProgressEvent = ProviderScenarioProgressEvent;

export interface ProviderScenarioResult {
  runId?: string;
  scenarioId: ProviderScenarioId;
  providerId: string;
  providerName: string;
  slot: ProviderTestSlot;
  url: string;
  timestamp: number;
  passed: number;
  failed: number;
  skipped: number;
  warnings: number;
  totalDuration: number;
  results: ProviderTestResult[];
  commands: ProviderScenarioCommandReport[];
  refreshedConfig?: ProviderConfig;
  aborted?: boolean;
  abortReason?: string;
}

/** Complete test suite results */
export interface ProviderTestSuite extends ProviderScenarioResult {
  totalTests: number;
}
