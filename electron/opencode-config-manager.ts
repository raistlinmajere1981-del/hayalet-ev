/**
 * OpenCode Config Manager (Electron Main Process)
 *
 * OpenCode Native UI için ayrı config dosyası yönetimi.
 * Dosya: config/opencode.json
 *
 * CodeNomad preferences.tsx pattern'inden esinlenilmiştir.
 */

import { join } from "path";
import { homedir } from "os";
import { readFile, writeFile, mkdir } from "fs/promises";
import { existsSync } from "fs";

// Types
export interface RecentFolder {
  path: string;
  name: string;
  lastAccessed: number;
}

export interface OpenCodeBinary {
  path: string;
  version?: string;
  lastUsed: number;
}

export interface OpenCodePreferences {
  defaultPort: number;
  autoConnect: boolean;
  showThinkingBlocks: boolean;
  diffViewMode: "split" | "unified";
  toolOutputExpansion: "expanded" | "collapsed";
}

export interface OpenCodeConfig {
  recentFolders: RecentFolder[];
  opencodeBinaries: OpenCodeBinary[];
  preferences: OpenCodePreferences;
  lastUsedBinary?: string;
  lastWorkspace?: string;
}

// Constants
const MAX_RECENT_FOLDERS = 20;
const MAX_BINARIES = 10;

function getConfigDir(): string {
  return join(process.cwd(), "config");
}

const configDir = getConfigDir();
const configPath = join(configDir, "opencode.json");

/**
 * Default config objesi
 */
function getDefaultConfig(): OpenCodeConfig {
  return {
    recentFolders: [],
    opencodeBinaries: [],
    preferences: {
      defaultPort: 4096,
      autoConnect: true,
      showThinkingBlocks: false,
      diffViewMode: "split",
      toolOutputExpansion: "expanded",
    },
  };
}

/**
 * Config dosyasını yükle
 */
export async function loadOpencodeConfig(): Promise<OpenCodeConfig> {
  try {
    await mkdir(configDir, { recursive: true });

    if (existsSync(configPath)) {
      const data = await readFile(configPath, "utf-8");
      const parsed = JSON.parse(data) as Partial<OpenCodeConfig>;
      // Merge with defaults for missing fields
      return {
        ...getDefaultConfig(),
        ...parsed,
        preferences: {
          ...getDefaultConfig().preferences,
          ...parsed.preferences,
        },
      };
    }

    // Dosya yoksa default config ile oluştur
    const defaults = getDefaultConfig();
    await saveOpencodeConfig(defaults);
    console.log("[Main:OpencodeConfig] Created default opencode.json");

    return defaults;
  } catch (error) {
    console.error("[Main:OpencodeConfig] Error loading config:", error);
    return getDefaultConfig();
  }
}

/**
 * Config dosyasını kaydet
 */
export async function saveOpencodeConfig(config: OpenCodeConfig): Promise<boolean> {
  try {
    await mkdir(configDir, { recursive: true });
    const jsonString = JSON.stringify(config, null, 2);
    await writeFile(configPath, jsonString, { encoding: "utf-8", mode: 0o644 });
    return true;
  } catch (error) {
    console.error("[Main:OpencodeConfig] Error saving config:", error);
    return false;
  }
}

/**
 * Recent folder ekle
 */
export async function addRecentFolder(path: string, name?: string): Promise<OpenCodeConfig> {
  const config = await loadOpencodeConfig();
  
  // Mevcut olanı kaldır (varsa)
  config.recentFolders = config.recentFolders.filter((f) => f.path !== path);
  
  // Başa ekle
  config.recentFolders.unshift({
    path,
    name: name || path.split("/").pop() || path.split("\\").pop() || "Workspace",
    lastAccessed: Date.now(),
  });
  
  // Limit uygula
  config.recentFolders = config.recentFolders.slice(0, MAX_RECENT_FOLDERS);
  
  // Son workspace olarak kaydet
  config.lastWorkspace = path;
  
  await saveOpencodeConfig(config);
  return config;
}

/**
 * Recent folder kaldır
 */
export async function removeRecentFolder(path: string): Promise<OpenCodeConfig> {
  const config = await loadOpencodeConfig();
  config.recentFolders = config.recentFolders.filter((f) => f.path !== path);
  await saveOpencodeConfig(config);
  return config;
}

/**
 * OpenCode binary ekle
 */
export async function addOpencodeBinary(path: string, version?: string): Promise<OpenCodeConfig> {
  const config = await loadOpencodeConfig();
  
  // Mevcut olanı kaldır (varsa)
  config.opencodeBinaries = config.opencodeBinaries.filter((b) => b.path !== path);
  
  // Başa ekle
  config.opencodeBinaries.unshift({
    path,
    version,
    lastUsed: Date.now(),
  });
  
  // Limit uygula
  config.opencodeBinaries = config.opencodeBinaries.slice(0, MAX_BINARIES);
  
  // Son kullanılan olarak kaydet
  config.lastUsedBinary = path;
  
  await saveOpencodeConfig(config);
  return config;
}

/**
 * OpenCode binary kaldır
 */
export async function removeOpencodeBinary(path: string): Promise<OpenCodeConfig> {
  const config = await loadOpencodeConfig();
  config.opencodeBinaries = config.opencodeBinaries.filter((b) => b.path !== path);
  await saveOpencodeConfig(config);
  return config;
}

/**
 * Preferences güncelle
 */
export async function updateOpencodePreferences(
  updates: Partial<OpenCodePreferences>
): Promise<OpenCodeConfig> {
  const config = await loadOpencodeConfig();
  config.preferences = {
    ...config.preferences,
    ...updates,
  };
  await saveOpencodeConfig(config);
  return config;
}

/**
 * Workspace launch kaydı (folder + binary)
 */
export async function recordWorkspaceLaunch(
  folderPath: string,
  binaryPath?: string
): Promise<OpenCodeConfig> {
  let config = await addRecentFolder(folderPath);
  
  if (binaryPath) {
    config = await addOpencodeBinary(binaryPath);
  }
  
  return config;
}

// =============================================================================
// OpenCode System Config (Model/Provider bilgileri)
// =============================================================================

/**
 * OpenCode system config dosya yolu
 * ~/.config/opencode/opencode.json
 */
function getOpenCodeSystemConfigPath(): string {
  return join(homedir(), ".config", "opencode", "opencode.json");
}

/**
 * Model bilgisi interface
 */
export interface OpenCodeModelInfo {
  id: string;
  name: string;
  providerId: string;
  context?: number;
  output?: number;
  variants?: string[];
}

/**
 * Provider bilgisi interface
 */
export interface OpenCodeProviderInfo {
  id: string;
  name: string;
  models: OpenCodeModelInfo[];
}

/**
 * OpenCode system config'ten model listesini oku
 * ~/.config/opencode/opencode.json dosyasından provider ve model bilgilerini parse eder
 */
export async function loadOpenCodeModels(): Promise<OpenCodeProviderInfo[]> {
  const configPath = getOpenCodeSystemConfigPath();
  
  try {
    if (!existsSync(configPath)) {
      console.log("[OpenCodeConfig] System config not found:", configPath);
      return [];
    }

    const content = await readFile(configPath, "utf-8");
    const config = JSON.parse(content);
    
    const providers: OpenCodeProviderInfo[] = [];
    
    // Parse provider section
    if (config.provider && typeof config.provider === "object") {
      for (const [providerId, providerData] of Object.entries(config.provider)) {
        const providerInfo: OpenCodeProviderInfo = {
          id: providerId,
          name: formatProviderName(providerId),
          models: [],
        };
        
        // Parse models for this provider
        const pData = providerData as { models?: Record<string, unknown> };
        if (pData.models && typeof pData.models === "object") {
          for (const [modelId, modelData] of Object.entries(pData.models)) {
            const mData = modelData as {
              name?: string;
              limit?: { context?: number; output?: number };
              variants?: Record<string, unknown>;
            };
            
            const modelInfo: OpenCodeModelInfo = {
              id: modelId,
              name: mData.name || modelId,
              providerId,
              context: mData.limit?.context,
              output: mData.limit?.output,
              variants: mData.variants ? Object.keys(mData.variants) : undefined,
            };
            
            providerInfo.models.push(modelInfo);
          }
        }
        
        if (providerInfo.models.length > 0) {
          providers.push(providerInfo);
        }
      }
    }
    
    console.log(`[OpenCodeConfig] Loaded ${providers.length} providers with models`);
    return providers;
    
  } catch (err) {
    console.error("[OpenCodeConfig] Failed to load models:", err);
    return [];
  }
}

/**
 * Provider ID'yi okunabilir isme çevir
 */
function formatProviderName(providerId: string): string {
  const nameMap: Record<string, string> = {
    google: "Google",
    anthropic: "Anthropic",
    openai: "OpenAI",
    azure: "Azure",
    bedrock: "AWS Bedrock",
    vertex: "Google Vertex",
    ollama: "Ollama",
    groq: "Groq",
  };
  return nameMap[providerId.toLowerCase()] || providerId;
}

// =============================================================================
// Agent/Model Preference Persistence
// =============================================================================

/**
 * Agent/Model tercih bilgisi interface
 */
export interface AgentModelPreference {
  agent?: string;
  providerId?: string;
  modelId?: string;
  lastUpdated: number;
}

/**
 * Folder bazlı agent/model tercihleri
 * Key: folder path (normalized)
 */
export interface FolderPreferences {
  [folderPath: string]: AgentModelPreference;
}

/**
 * Extended OpenCodeConfig with agent/model preferences
 */
export interface OpenCodeConfigExtended extends OpenCodeConfig {
  agentModelPreferences?: FolderPreferences;
  defaultAgentModel?: AgentModelPreference;
}

/**
 * Normalize folder path for consistent key
 */
function normalizeFolderPath(folderPath: string): string {
  return folderPath.replace(/\\/g, '/').replace(/\/$/, '');
}

/**
 * Get agent/model preference for a folder
 * Falls back to default if folder-specific preference doesn't exist
 */
export async function getAgentModelPreference(folderPath?: string): Promise<AgentModelPreference | null> {
  try {
    const config = await loadOpencodeConfig() as OpenCodeConfigExtended;
    
    if (folderPath) {
      const normalizedPath = normalizeFolderPath(folderPath);
      const folderPref = config.agentModelPreferences?.[normalizedPath];
      if (folderPref) {
        console.log(`[OpenCodeConfig] Loaded preference for ${normalizedPath}:`, folderPref);
        return folderPref;
      }
    }
    
    // Fall back to default
    if (config.defaultAgentModel) {
      console.log('[OpenCodeConfig] Using default preference:', config.defaultAgentModel);
      return config.defaultAgentModel;
    }
    
    return null;
  } catch (error) {
    console.error('[OpenCodeConfig] Error getting agent/model preference:', error);
    return null;
  }
}

/**
 * Save agent/model preference for a folder
 * Also updates the default if no folder specified
 * Merges with existing preference - only updates defined (non-null/undefined) values
 */
export async function saveAgentModelPreference(
  preference: Omit<AgentModelPreference, 'lastUpdated'>,
  folderPath?: string
): Promise<boolean> {
  try {
    const config = await loadOpencodeConfig() as OpenCodeConfigExtended;
    
    // Get existing preference to merge with
    const existingPref = folderPath 
      ? config.agentModelPreferences?.[normalizeFolderPath(folderPath)]
      : config.defaultAgentModel;
    
    // Merge: only override if new value is defined (not null/undefined)
    const mergedPref: AgentModelPreference = {
      agent: preference.agent ?? existingPref?.agent,
      providerId: preference.providerId ?? existingPref?.providerId,
      modelId: preference.modelId ?? existingPref?.modelId,
      lastUpdated: Date.now(),
    };
    
    console.log('[OpenCodeConfig] Merging preference:', { incoming: preference, existing: existingPref, merged: mergedPref });
    
    if (folderPath) {
      const normalizedPath = normalizeFolderPath(folderPath);
      
      // Initialize preferences object if not exists
      if (!config.agentModelPreferences) {
        config.agentModelPreferences = {};
      }
      
      config.agentModelPreferences[normalizedPath] = mergedPref;
      console.log(`[OpenCodeConfig] Saved preference for ${normalizedPath}:`, mergedPref);
    }
    
    // Always update default as well (last used becomes default)
    config.defaultAgentModel = mergedPref;
    
    await saveOpencodeConfig(config);
    return true;
  } catch (error) {
    console.error('[OpenCodeConfig] Error saving agent/model preference:', error);
    return false;
  }
}

/**
 * Update only agent preference
 */
export async function saveAgentPreference(agent: string, folderPath?: string): Promise<boolean> {
  const current = await getAgentModelPreference(folderPath);
  return saveAgentModelPreference({
    ...current,
    agent,
  }, folderPath);
}

/**
 * Update only model preference
 */
export async function saveModelPreference(
  providerId: string, 
  modelId: string, 
  folderPath?: string
): Promise<boolean> {
  const current = await getAgentModelPreference(folderPath);
  return saveAgentModelPreference({
    ...current,
    providerId,
    modelId,
  }, folderPath);
}

/**
 * Clear preferences for a folder
 */
export async function clearFolderPreference(folderPath: string): Promise<boolean> {
  try {
    const config = await loadOpencodeConfig() as OpenCodeConfigExtended;
    const normalizedPath = normalizeFolderPath(folderPath);
    
    if (config.agentModelPreferences?.[normalizedPath]) {
      delete config.agentModelPreferences[normalizedPath];
      await saveOpencodeConfig(config);
      console.log(`[OpenCodeConfig] Cleared preference for ${normalizedPath}`);
    }
    
    return true;
  } catch (error) {
    console.error('[OpenCodeConfig] Error clearing folder preference:', error);
    return false;
  }
}
