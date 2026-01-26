/**
 * OpenCode UI - Global Type Declarations
 */

// =============================================================================
// Common Types
// =============================================================================

interface Instance {
  id: string;
  folder: string;
  name: string;
  url?: string;
  status: 'connecting' | 'connected' | 'disconnected' | 'error';
  sessionId?: string | null;
  createdAt?: number;
  updatedAt?: number;
  [key: string]: unknown;
}

interface Session {
  id: string;
  title?: string;
  status?: string;
  createdAt?: number;
  updatedAt?: number;
  [key: string]: unknown;
}

interface Message {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content?: string;
  parts?: unknown[];
  timestamp?: number;
  [key: string]: unknown;
}

// =============================================================================
// Electron API
// =============================================================================

interface ElectronAPI {
  windowMinimize(): void;
  windowMaximize(): void;
  windowClose(): void;
  opencodeStart(workspacePath: string): Promise<{ success: boolean; port?: number; error?: string }>;
  opencodeStop(workspacePath: string): Promise<{ success: boolean; error?: string }>;
  opencodeGetStatus(): Promise<{ running: boolean; instances: Array<{ path: string; port: number }> }>;
  selectDirectory(): Promise<string | null>;
  selectFile(options?: { filters?: Array<{ name: string; extensions: string[] }> }): Promise<string | null>;
  readFile(path: string): Promise<string>;
  writeFile(path: string, content: string): Promise<void>;
  loadSettings(): Promise<Record<string, unknown>>;
  saveSettings(settings: Record<string, unknown>): Promise<void>;
  getAppPath(): Promise<string>;
  getPlatform(): string;
  openExternal(url: string): void;
  
  // OpenCode specific methods
  opcGetActiveProjects(): Promise<Array<{ folder: string; name?: string }>>;
  opcAddActiveProject(folderPath: string): Promise<void>;
  opcRemoveActiveProject(folderPath: string): Promise<void>;
  opcGetAgentModelPreference(folderPath: string): Promise<{ agent?: string; providerId?: string; modelId?: string } | null>;
  opcSaveAgentModelPreference(preference: { agent?: string; providerId?: string; modelId?: string }, folderPath: string): Promise<void>;
  opcListAgents(): Promise<Array<{ id: string; name: string; [key: string]: unknown }>>;
  opcListModels(): Promise<Array<{ id: string; name: string; models: Array<{ id: string; name: string; providerId: string; [key: string]: unknown }> }>>;
  opcGetHomePath(): Promise<string>;
  opcListFilesystem(path: string, options?: { includeFiles?: boolean }): Promise<Array<{ name: string; path: string; isDirectory: boolean }>>;
  showOpenDialog(options: { properties?: string[]; title?: string; buttonLabel?: string; filters?: Array<{ name: string; extensions: string[] }> }): Promise<{ canceled: boolean; filePaths: string[] }>;
  
  [key: string]: unknown;
}

// =============================================================================
// Store Types (simplified for global access)
// =============================================================================

interface GlobalInstanceStore {
  getInstances(): Map<string, Instance>;
  getInstancesArray(): Instance[];
  getInstance(instanceId: string): Instance | null;
  getActiveInstanceId(): string | null;
  getActiveInstance(): Instance | null;
  getActiveInstancePath(): string | null;
  getActiveInstanceSessionId(): string | null;
  getActiveInstanceUrl(): string | null;
  setActiveInstance(instanceId: string | null, options?: { silent?: boolean }): void;
  setInstanceStatus(instanceId: string, status: string, reason?: string): void;
  setInstanceSession(instanceId: string, sessionId: string | null): void;
  createInstance(options: { folder: string; name?: string; url?: string }): Instance;
  addInstance(instance: Instance): void;
  updateInstance(instanceId: string, updates: Partial<Instance>): void;
  removeInstance(instanceId: string): void;
  findByFolder(folderPath: string): Instance | null;
  subscribe(listener: (event: unknown) => void): () => void;
  clear(): void;
  getStats(): unknown;
  [key: string]: unknown;
}

interface GlobalMessageStore {
  getMessage(messageId: string): unknown;
  getSessionMessages(sessionId: string): unknown[];
  getMessageParts(messageId: string): unknown[];
  getPart(partId: string): unknown;
  upsertMessage(input: unknown): unknown;
  addOrUpdatePart(input: unknown): unknown;
  updateTextPart(messageId: string, text: string, append?: boolean): void;
  replaceMessageId(options: { oldId: string; newId: string }): void;
  removeMessage(messageId: string): void;
  upsertPermission(entry: unknown): void;
  removePermission(permissionId: string): void;
  getActivePermission(): unknown | null;
  getPermissionQueue(): unknown[];
  upsertQuestion(entry: unknown): void;
  removeQuestion(questionId: string): void;
  getActiveQuestion(): unknown | null;
  getQuestionQueue(): unknown[];
  clearSession(sessionId: string): void;
  clear(): void;
  clearOldCache?(maxAge?: number): void;
  subscribe(listener: (event: unknown) => void): () => void;
  getStats(): unknown;
  createId?(length?: number): string;
  [key: string]: unknown;
}

interface GlobalSessionStore {
  getCurrentSessionId(): string | null;
  getCurrentSession(): Session | null;
  getSession(sessionId: string): Session | null;
  getAllSessions(): Session[];
  setCurrentSession(sessionId: string | null): void;
  upsertSession(sessionId: string, data: Partial<Session>): void;
  deleteSession(sessionId: string): void;
  renameSession(sessionId: string, title: string): Promise<boolean>;
  clear(): void;
  subscribe(listener: (event: unknown) => void): () => void;
  getStats(): unknown;
  [key: string]: unknown;
}

interface GlobalAttachmentStore {
  getAttachments(sessionId: string, instanceId?: string): unknown[];
  addAttachment(sessionId: string, input: unknown, instanceId?: string): unknown;
  removeAttachment(sessionId: string, attachmentId: string, instanceId?: string): void;
  clearAttachments(sessionId: string, instanceId?: string): void;
  subscribe(listener: (event: unknown) => void): () => void;
  [key: string]: unknown;
}

interface GlobalStoreBridge {
  handleEvent(eventType: string, data: unknown, instanceId?: string): void;
  setLastUserMessage(message: string, instanceId?: string): void;
  getCurrentMessageId(): string | null;
  clear(): void;
  setDebug(enabled: boolean): void;
  [key: string]: unknown;
}

interface GlobalPartNormalizer {
  normalize(part: unknown): unknown;
  normalizeAll(parts: unknown[]): unknown[];
  needsNormalization(part: unknown): boolean;
  decodeHtml(text: string): string;
  [key: string]: unknown;
}

// =============================================================================
// API & SSE Client
// =============================================================================

interface GlobalAPIClient {
  setServerUrl(url: string): void;
  getServerUrl(): string;
  health(): Promise<unknown>;
  status(): Promise<unknown>;
  getSession(): Promise<unknown>;
  getSessions(): Promise<unknown>;
  getSessionMessages(sessionId: string): Promise<unknown>;
  createSession(options?: unknown): Promise<unknown>;
  deleteSession(sessionId: string): Promise<void>;
  renameSession(sessionId: string, title: string): Promise<unknown>;
  sendMessage(message: string, messageId?: string): Promise<unknown>;
  cancel(): Promise<void>;
  cancelAllRequests(): Promise<void>;
  retry(messageId?: string | null): Promise<unknown>;
  listFileSystem(path: string, options?: unknown): Promise<unknown[]>;
  searchFiles(query: string, limit?: number): Promise<unknown>;
  listAgents(): Promise<unknown>;
  listProviders(): Promise<unknown>;
  respondToPermission(permissionId: string, approved: boolean): Promise<unknown>;
  respondToQuestion(questionId: string, answer: string): Promise<unknown>;
  forkConversation(messageId: string): Promise<unknown>;
  revertConversation(messageId: string): Promise<unknown>;
  compact(): Promise<unknown>;
  getMCPServers(): Promise<unknown>;
  getPlugins(): Promise<unknown>;
  getBackgroundShells(): Promise<unknown>;
  updateSessionAgent(sessionId: string, agentName: string): Promise<unknown>;
  updateSessionModel(sessionId: string, providerId: string, modelId: string): Promise<unknown>;
  [key: string]: unknown;
}

interface GlobalSSEClient {
  disconnect(): void;
  isConnected(): boolean;
  disconnectInstance(instanceId: string): void;
  isInstanceConnected(instanceId: string): boolean;
  disconnectAll(): void;
  on(eventType: string, callback: (data: unknown) => void): void;
  onAny(callback: (data: unknown) => void): void;
  off(eventType: string, callback: (data: unknown) => void): void;
  [key: string]: unknown;
}

// =============================================================================
// UI Components
// =============================================================================

interface GlobalMessageRenderer {
  init(container: HTMLElement, options?: unknown): void;
  destroy(): void;
  addMessage(message: unknown): void;
  clear(): void;
  [key: string]: unknown;
}

interface GlobalPromptHandler {
  init(options: unknown): void;
  getValue(): string;
  setValue(value: string): void;
  clear(): void;
  focus(): void;
  setProcessing(isProcessing: boolean): void;
  [key: string]: unknown;
}

interface GlobalToolRenderer {
  createToolCard(toolCall: unknown): HTMLElement;
  updateToolCard(toolId: string, update: unknown): void;
  clear(): void;
  setDebug(enabled: boolean): void;
  [key: string]: unknown;
}

interface GlobalInstanceTabs {
  init(container: HTMLElement, callbacks?: unknown): void;
  destroy(): void;
  render(): void;
  [key: string]: unknown;
}

interface GlobalDirectoryBrowser {
  open(options?: unknown): Promise<string | null>;
  close(): void;
  [key: string]: unknown;
}

interface GlobalPermissionModal {
  init(): void;
  destroy(): void;
  isVisible(): boolean;
  [key: string]: unknown;
}

interface GlobalQuestionModal {
  init(): void;
  destroy(): void;
  isVisible(): boolean;
  [key: string]: unknown;
}

interface GlobalAgentModelSelector {
  setFolderPath(folderPath: string): void;
  setFromSession(sessionData: unknown): void;
  getCurrentAgent(): string | null;
  getCurrentModel(): string | null;
  render(container: HTMLElement): void;
  subscribe(listener: (event: unknown) => void): () => void;
  [key: string]: unknown;
}

interface GlobalOpenCodeConfig {
  getServerUrl(): string;
  setServerUrl(url: string): void;
  get(key: string, defaultValue?: unknown): unknown;
  isEnabled(feature: string): boolean;
  [key: string]: unknown;
}

interface GlobalToolRendererRegistry {
  register(name: string, renderer: unknown): void;
  get(name: string): unknown;
  has(name: string): boolean;
  [key: string]: unknown;
}

// =============================================================================
// Window Extensions
// =============================================================================

declare global {
  interface Window {
    // Electron
    electronAPI?: ElectronAPI;
    
    // Stores
    InstanceStore: GlobalInstanceStore;
    MessageStore: GlobalMessageStore;
    SessionStore: GlobalSessionStore;
    AttachmentStore: GlobalAttachmentStore;
    StoreBridge: GlobalStoreBridge;
    PartNormalizer: GlobalPartNormalizer;
    
    // API
    APIClient: GlobalAPIClient;
    SSEClient: GlobalSSEClient;
    
    // UI Components
    MessageRenderer: GlobalMessageRenderer;
    PromptHandler: GlobalPromptHandler;
    ToolRenderer: GlobalToolRenderer;
    InstanceTabs: GlobalInstanceTabs;
    DirectoryBrowser: GlobalDirectoryBrowser;
    PermissionModal: GlobalPermissionModal;
    QuestionModal: GlobalQuestionModal;
    AgentModelSelector: GlobalAgentModelSelector;
    OpenCodeConfig: GlobalOpenCodeConfig;
    ToolRendererRegistry: GlobalToolRendererRegistry;
    
    // Initialization
    initStores?: () => void;
    verifyStores?: () => boolean;

    // Tool Renderers
    BashRenderer?: unknown;
    ReadRenderer?: unknown;
    WriteRenderer?: unknown;
    
    // External Libraries
    DOMPurify?: {
      sanitize(html: string, config?: unknown): string;
      [key: string]: unknown;
    };
    
    // App
    OpenCodeApp?: {
      init(): Promise<void>;
      _showToast(message: string, type?: 'success' | 'error' | 'info'): void;
      _retryMessage?(messageId: string, content: string): void;
      [key: string]: unknown;
    };
  }
}

export {};
