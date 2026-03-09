/**
 * Assistant page types
 *
 * Shared type definitions and interfaces for the Assistant controller
 * and provider adapters.
 *
 * @module src/types/assistant
 */

// ============================================
// Enums
// ============================================

export enum ConnectButtonState {
  IDLE = "idle", // Start
  STARTING = "starting", // Starting...
  CANCEL_CONNECTING = "cancel_connecting", // Cancel Connection
  CONNECTED = "connected", // Disconnect
  STOPPING = "stopping", // Disconnecting...
  ERROR = "error", // Error!
  SUCCESS_START = "success_start", // Connected!
  SUCCESS_STOP = "success_stop", // Disconnected!
}

// ============================================
// UI Interfaces
// ============================================

export interface ButtonStateConfig {
  text: string;
  classes: string[];
  disabled: boolean;
}

export interface WebviewElement extends HTMLElement {
  src?: string;
  getWebContentsId?: () => number;
  getURL?: () => string;
  openDevTools?: () => void;
  executeJavaScript?: (script: string) => Promise<unknown>;
}

// ============================================
// State Interfaces
// ============================================

export interface SlotStateInfo {
  state?: string;
  accountId?: string | null;
  currentUrl?: string;
  error?: string;
}

export interface ServerResult {
  success: boolean;
  url?: string;
  error?: string;
  alreadyRunning?: boolean;
  existingServer?: boolean;
  workspaceId?: string;
}

export interface AssistantTrafficState {
  state?: {
    status?: {
      loading?: string;
      thinking?: string;
      send?: string;
    };
  };
}

export interface ServerStatus {
  running: boolean;
  port?: number;
}

// ============================================
// Provider Adapter Interface
// ============================================

/**
 * Assistant provider adapter interface.
 *
 * Implement this interface to add a new assistant provider:
 * 1. Create `src/js/pages/assistant/my-provider-adapter.ts`
 * 2. Implement the `AssistantProviderAdapter` interface
 * 3. Register the adapter in `provider-registry.ts`
 */
export interface AssistantProviderAdapter {
  /** Provider identifier (for example: "opencode", "opencode-ui") */
  readonly id: string;

  /** Provider display name */
  readonly name: string;

  /**
   * Starts the server.
   * @param portSelection - Selected port ("auto" or a numeric string)
   * @returns Server start result
   */
  startServer(portSelection?: string): Promise<ServerResult>;

  /**
   * Stops the server.
   * @returns Stop result
   */
  stopServer(): Promise<ServerResult>;

  /**
   * Checks whether the server is ready.
   * @param url - URL to probe
   * @param timeoutMs - Timeout in milliseconds
   * @returns Whether the server is ready
   */
  waitForReady(url: string, timeoutMs?: number, signal?: AbortSignal): Promise<boolean>;

  /**
   * Returns the server status for the UI.
   */
  getServerStatus(): ServerStatus;

  /**
   * Updates the running state from an external controller (used during page restore).
   */
  setRunning(value: boolean): void;
}
