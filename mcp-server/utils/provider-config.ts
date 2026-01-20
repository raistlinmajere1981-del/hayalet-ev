/**
 * Provider Config Parser
 * 
 * Provider config dosyalarını okur ve selector'ları parse eder.
 */

import { readFileSync, existsSync } from "fs";
import { join } from "path";

// ============================================
// Types
// ============================================

export interface ProviderSelectors {
  sendButton?: string;
  stopButton?: string;
  voiceButton?: string;
  inputField?: string;
  messageContainer?: string;
  attachButton?: string;
  filePreview?: string[];
}

export interface ScrapeSelectors {
  preferred?: string;
  fallback?: string;
  messageWrapper?: string;
  userWrapper?: string;
  assistantWrapper?: string;
  messageId?: string;
}

export interface ProviderConfig {
  id: string;
  name: string;
  baseUrl: string;
  loginUrl?: string;
  lastVerified?: string;
  selectors: ProviderSelectors;
  scrapeSelectors?: ScrapeSelectors;
  criticalSelectors?: string[];
  fileInputSelectors?: string[];
  uploadTargetSelectors?: string[];
  scrollerSelectors?: string[];
  inputType?: string;
  messageIdStrategy?: string;
  excludedUrls?: string[];
}

export interface FlatSelector {
  category: string;
  key: string;
  selector: string;
  isArray?: boolean;
  arrayIndex?: number;
}

export interface ProviderInfo {
  id: string;
  name: string;
  configPath: string;
  exists: boolean;
}

// ============================================
// Constants
// ============================================

const PROVIDERS = ["chatgpt", "gemini", "grok", "opencode"] as const;
export type ProviderId = typeof PROVIDERS[number];

// ============================================
// Config Parser
// ============================================

/**
 * Provider config dosya yolunu al
 */
export function getConfigPath(projectRoot: string, provider: string): string {
  return join(projectRoot, "src/js/modules/webview/providers", provider, "config.ts");
}

/**
 * Mevcut provider'ları listele
 */
export function listProviders(projectRoot: string): ProviderInfo[] {
  return PROVIDERS.map(id => {
    const configPath = getConfigPath(projectRoot, id);
    return {
      id,
      name: id.charAt(0).toUpperCase() + id.slice(1),
      configPath,
      exists: existsSync(configPath),
    };
  }).filter(p => p.exists);
}

/**
 * Config dosyasından config objesini parse et
 * TypeScript dosyasını regex ile parse eder (runtime eval olmadan)
 */
export function parseProviderConfig(projectRoot: string, provider: string): ProviderConfig | null {
  const configPath = getConfigPath(projectRoot, provider);
  
  if (!existsSync(configPath)) {
    return null;
  }
  
  try {
    const content = readFileSync(configPath, "utf-8");
    return extractConfigFromSource(content, provider);
  } catch (error) {
    console.error(`Config parse hatası (${provider}):`, error);
    return null;
  }
}

/**
 * TypeScript source'dan config objesini çıkar
 */
function extractConfigFromSource(source: string, providerId: string): ProviderConfig {
  const config: ProviderConfig = {
    id: providerId,
    name: providerId.charAt(0).toUpperCase() + providerId.slice(1),
    baseUrl: "",
    selectors: {},
  };
  
  // baseUrl
  const baseUrlMatch = source.match(/baseUrl:\s*["']([^"']+)["']/);
  if (baseUrlMatch) config.baseUrl = baseUrlMatch[1];
  
  // loginUrl
  const loginUrlMatch = source.match(/loginUrl:\s*["']([^"']+)["']/);
  if (loginUrlMatch) config.loginUrl = loginUrlMatch[1];
  
  // lastVerified
  const lastVerifiedMatch = source.match(/lastVerified:\s*["']([^"']+)["']/);
  if (lastVerifiedMatch) config.lastVerified = lastVerifiedMatch[1];
  
  // inputType
  const inputTypeMatch = source.match(/inputType:\s*["']([^"']+)["']/);
  if (inputTypeMatch) config.inputType = inputTypeMatch[1];
  
  // messageIdStrategy
  const strategyMatch = source.match(/messageIdStrategy:\s*["']([^"']+)["']/);
  if (strategyMatch) config.messageIdStrategy = strategyMatch[1];
  
  // selectors object
  config.selectors = extractSelectorsObject(source, "selectors:");
  
  // scrapeSelectors object
  const scrapeSelectors = extractSelectorsObject(source, "scrapeSelectors:");
  if (Object.keys(scrapeSelectors).length > 0) {
    config.scrapeSelectors = scrapeSelectors as ScrapeSelectors;
  }
  
  // Array selectors
  config.criticalSelectors = extractStringArray(source, "criticalSelectors:");
  config.fileInputSelectors = extractStringArray(source, "fileInputSelectors:");
  config.uploadTargetSelectors = extractStringArray(source, "uploadTargetSelectors:");
  config.scrollerSelectors = extractStringArray(source, "scrollerSelectors:");
  config.excludedUrls = extractStringArray(source, "excludedUrls:");
  
  return config;
}

/**
 * Nested object içindeki string değerleri çıkar
 */
function extractSelectorsObject(source: string, objectKey: string): Record<string, string> {
  const result: Record<string, string> = {};
  
  // Object başlangıcını bul
  const objectStart = source.indexOf(objectKey);
  if (objectStart === -1) return result;
  
  // İlk { karakterini bul
  const braceStart = source.indexOf("{", objectStart);
  if (braceStart === -1) return result;
  
  // Eşleşen } karakterini bul
  let braceCount = 1;
  let braceEnd = braceStart + 1;
  while (braceCount > 0 && braceEnd < source.length) {
    if (source[braceEnd] === "{") braceCount++;
    if (source[braceEnd] === "}") braceCount--;
    braceEnd++;
  }
  
  const objectContent = source.slice(braceStart + 1, braceEnd - 1);
  
  // Key-value çiftlerini parse et - backtick template literal'ları destekle
  // Pattern: key: `value` (içinde " ve ' olabilir)
  const backtickPattern = /(\w+):\s*`([^`]*)`/g;
  let match;
  
  while ((match = backtickPattern.exec(objectContent)) !== null) {
    const key = match[1];
    const value = match[2];
    if (value && !value.includes("${")) {
      result[key] = value.replace(/\s+/g, " ").trim();
    }
  }
  
  // Pattern: key: "value" (içinde ' olabilir)
  const doubleQuotePattern = /(\w+):\s*"([^"]*)"/g;
  while ((match = doubleQuotePattern.exec(objectContent)) !== null) {
    const key = match[1];
    const value = match[2];
    if (value && !result[key]) {
      result[key] = value.replace(/\s+/g, " ").trim();
    }
  }
  
  // Pattern: key: 'value' (içinde " olabilir)
  const singleQuotePattern = /(\w+):\s*'([^']*)'/g;
  while ((match = singleQuotePattern.exec(objectContent)) !== null) {
    const key = match[1];
    const value = match[2];
    if (value && !result[key]) {
      result[key] = value.replace(/\s+/g, " ").trim();
    }
  }
  
  return result;
}

/**
 * String array'i çıkar
 */
function extractStringArray(source: string, arrayKey: string): string[] {
  const result: string[] = [];
  
  const arrayStart = source.indexOf(arrayKey);
  if (arrayStart === -1) return result;
  
  const bracketStart = source.indexOf("[", arrayStart);
  if (bracketStart === -1) return result;
  
  // Eşleşen ] karakterini bul
  let bracketCount = 1;
  let bracketEnd = bracketStart + 1;
  while (bracketCount > 0 && bracketEnd < source.length) {
    if (source[bracketEnd] === "[") bracketCount++;
    if (source[bracketEnd] === "]") bracketCount--;
    bracketEnd++;
  }
  
  const arrayContent = source.slice(bracketStart + 1, bracketEnd - 1);
  
  // String değerleri çıkar
  const stringPattern = /["'`]([^"'`]+)["'`]/g;
  let match;
  
  while ((match = stringPattern.exec(arrayContent)) !== null) {
    const value = match[1].replace(/\s+/g, " ").trim();
    if (value && !value.startsWith("//")) {
      result.push(value);
    }
  }
  
  return result;
}

/**
 * Config'deki tüm selector'ları düz listeye çevir
 */
export function flattenSelectors(config: ProviderConfig): FlatSelector[] {
  const result: FlatSelector[] = [];
  
  // selectors object
  if (config.selectors) {
    for (const [key, value] of Object.entries(config.selectors)) {
      if (typeof value === "string" && value.trim()) {
        result.push({ category: "selectors", key, selector: value });
      } else if (Array.isArray(value)) {
        value.forEach((sel, i) => {
          if (typeof sel === "string" && sel.trim()) {
            result.push({ category: "selectors", key, selector: sel, isArray: true, arrayIndex: i });
          }
        });
      }
    }
  }
  
  // scrapeSelectors object
  if (config.scrapeSelectors) {
    for (const [key, value] of Object.entries(config.scrapeSelectors)) {
      if (typeof value === "string" && value.trim()) {
        result.push({ category: "scrapeSelectors", key, selector: value });
      }
    }
  }
  
  // Array selector'lar
  const arrayCategories = [
    "criticalSelectors",
    "fileInputSelectors", 
    "uploadTargetSelectors",
    "scrollerSelectors",
  ] as const;
  
  for (const category of arrayCategories) {
    const arr = config[category];
    if (Array.isArray(arr)) {
      arr.forEach((selector, index) => {
        if (typeof selector === "string" && selector.trim()) {
          result.push({ 
            category, 
            key: `[${index}]`, 
            selector,
            isArray: true,
            arrayIndex: index,
          });
        }
      });
    }
  }
  
  return result;
}

/**
 * Selector'ı kategoriye göre grupla
 */
export function groupSelectorsByCategory(selectors: FlatSelector[]): Record<string, FlatSelector[]> {
  const grouped: Record<string, FlatSelector[]> = {};
  
  for (const sel of selectors) {
    if (!grouped[sel.category]) {
      grouped[sel.category] = [];
    }
    grouped[sel.category].push(sel);
  }
  
  return grouped;
}
