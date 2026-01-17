/**
 * Provider Types - AI provider konfigürasyonları
 * 
 * @module src/js/types/provider
 */

import type { ProviderId, AsistanProviderId, AllProviderId } from "./common.js";

// ============================================================================
// Selector Types
// ============================================================================

/** Temel selector'lar */
export interface BaseSelectors {
  sendButton: string;
  stopButton: string;
  inputField: string;
  messageContainer: string;
  voiceButton?: string;
  filePreview?: string | string[];
  attachButton?: string;
}

/** Scrape selector'ları */
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

/** Rol selector'ları (Gemini için) */
export interface RoleSelectors {
  user: string;
  assistant: string;
  text?: string;
}

/** Filter ayarları */
export interface FilterConfig {
  selectors: string[];
  hosts: string[];
  blockResourceTypes: string[];
  dragOverlaySelectors?: string[];
  dragTextMatchers?: string[];
}

/** Telemetry ayarları */
export interface TelemetryConfig {
  endpoints: string[];
  tokenPaths: string[];
}

// ============================================================================
// Provider Config Types
// ============================================================================

/** Mesaj ID stratejisi */
export type MessageIdStrategy = "content-hash" | "dom-id";

/** Input tipi */
export type InputType = "direct" | "character-by-character" | "contenteditable";

/** Temel provider konfigürasyonu */
export interface BaseProviderConfig {
  id: AllProviderId;
  name: string;
  baseUrl: string;
  loginUrl: string | null;
  lastVerified: string;
  
  selectors: BaseSelectors;
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
}

/** ChatGPT config */
export interface ChatGPTConfig extends BaseProviderConfig {
  id: "chatgpt";
}

/** Gemini config */
export interface GeminiConfig extends BaseProviderConfig {
  id: "gemini";
  defaultPaths: string[];
  roleSelectors: RoleSelectors;
}

/** Grok config */
export interface GrokConfig extends BaseProviderConfig {
  id: "grok";
}

/** OpenCode config (Asistan) */
export interface OpenCodeConfig extends BaseProviderConfig {
  id: "opencode";
  port: number;
  cors: string;
  command: string;
  isAsistan: true;
  loginUrl: null;
  getProjectUrl: (projectPath?: string | null, port?: number) => string;
  getServerCommand: (port?: number, cors?: string) => { command: string; args: string[] };
}

/** Tüm provider config'leri */
export type ProviderConfig = ChatGPTConfig | GeminiConfig | GrokConfig | OpenCodeConfig;

// ============================================================================
// Provider Instance Types
// ============================================================================

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

// ============================================================================
// Provider Registry Types
// ============================================================================

/** Registry'deki provider bilgisi */
export interface RegisteredProvider {
  id: AllProviderId;
  config: ProviderConfig;
  scraper?: ProviderScraper;
}

/** Provider registry map */
export type ProviderRegistryMap = Map<AllProviderId, RegisteredProvider>;
