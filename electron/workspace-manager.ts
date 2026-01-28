/**
 * Workspace Manager
 *
 * Her proje için ayrı OpenCode instance'ı yönetimi
 * - Dinamik port allocation (port:0 ile OS'tan boş port al)
 * - Instance lifecycle (starting→ready→stopped→error)
 * - Auth header yönetimi (Basic auth)
 * - Process spawn ve monitoring
 * - Multi-instance desteği
 *
 * CodeNomad'ın WorkspaceManager'ından esinlenilmiştir.
 */

import { spawn, type ChildProcess } from "child_process";
import path from "path";
import crypto from "crypto";
import { OPENCODE_DEFAULTS } from "./opencode-config.ts";

// ===========================================================================
// Types
// ===========================================================================

export type WorkspaceStatus = "starting" | "ready" | "stopped" | "error";

export interface WorkspaceDescriptor {
  id: string;
  name: string;
  path: string;
  status: WorkspaceStatus;
  port?: number;
  pid?: number;
  proxyPath: string;
  error?: string;
  createdAt: string;
  updatedAt: string;
  authorization?: string; // Auth header for API requests
}

export interface WorkspaceAuth {
  username: string;
  password: string;
  authorization: string;
}

interface ManagedProcess {
  child: ChildProcess;
  requestedStop: boolean;
}

// @ts-expect-error - Reserved for future use
interface _ProcessExitInfo {
  workspaceId: string;
  code: number | null;
  signal: NodeJS.Signals | null;
  requested: boolean;
}

// ===========================================================================
// Constants
// ===========================================================================

const DEFAULT_USERNAME = "hayaletev";
const STARTUP_TIMEOUT_MS = 30000;

// Environment variables for OpenCode auth
const OPENCODE_SERVER_USERNAME_ENV = "OPENCODE_SERVER_USERNAME";
const OPENCODE_SERVER_PASSWORD_ENV = "OPENCODE_SERVER_PASSWORD";

// ===========================================================================
// Auth Utilities
// ===========================================================================

function generatePassword(): string {
  return crypto.randomBytes(32).toString("base64url");
}

function buildBasicAuthHeader(username: string, password: string): string {
  const token = Buffer.from(`${username}:${password}`, "utf8").toString("base64");
  return `Basic ${token}`;
}

// ===========================================================================
// Workspace Manager
// ===========================================================================

class WorkspaceManagerClass {
  private workspaces = new Map<string, WorkspaceDescriptor>();
  private processes = new Map<string, ManagedProcess>();
  private authData = new Map<string, WorkspaceAuth>();
  private statusListeners: Array<(workspaces: WorkspaceDescriptor[]) => void> = [];
  private eventListeners: Array<(event: WorkspaceEvent) => void> = [];

  // =========================================================================
  // Public API - CRUD
  // =========================================================================

  /**
   * Tüm workspace'leri listele
   */
  list(): WorkspaceDescriptor[] {
    return Array.from(this.workspaces.values());
  }

  /**
   * Belirli bir workspace'i getir
   */
  get(id: string): WorkspaceDescriptor | undefined {
    return this.workspaces.get(id);
  }

  /**
   * Workspace'in port'unu getir
   */
  getPort(id: string): number | undefined {
    return this.workspaces.get(id)?.port;
  }

  /**
   * Workspace'in auth header'ını getir
   */
  getAuthorizationHeader(id: string): string | undefined {
    return this.authData.get(id)?.authorization;
  }

  /**
   * Yeni workspace oluştur ve OpenCode instance'ı başlat
   */
  async create(folder: string, name?: string): Promise<WorkspaceDescriptor> {
    const id = this.generateId();
    const workspacePath = path.isAbsolute(folder) ? folder : path.resolve(process.cwd(), folder);
    const workspaceName = name || path.basename(workspacePath);
    const proxyPath = `/workspaces/${id}/instance`;

    console.log(`[WorkspaceManager] Creating workspace: ${id}, path: ${workspacePath}`);

    const descriptor: WorkspaceDescriptor = {
      id,
      name: workspaceName,
      path: workspacePath,
      status: "starting",
      proxyPath,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    this.workspaces.set(id, descriptor);
    this.emitEvent({ type: "workspace.created", workspace: descriptor });
    this.notifyListeners();

    // Auth credentials oluştur
    const username = DEFAULT_USERNAME;
    const password = generatePassword();
    const authorization = buildBasicAuthHeader(username, password);
    this.authData.set(id, { username, password, authorization });

    try {
      // OpenCode process'i başlat
      const { pid, port } = await this.launchProcess({
        workspaceId: id,
        folder: workspacePath,
        username,
        password,
      });

      descriptor.pid = pid;
      descriptor.port = port;
      descriptor.status = "ready";
      descriptor.updatedAt = new Date().toISOString();

      console.log(`[WorkspaceManager] Workspace ready: ${id}, port: ${port}, pid: ${pid}`);
      this.emitEvent({ type: "workspace.started", workspace: descriptor });
      this.notifyListeners();

      // Include authorization in response for frontend caching
      return { ...descriptor, authorization };
    } catch (error) {
      descriptor.status = "error";
      descriptor.error = error instanceof Error ? error.message : String(error);
      descriptor.updatedAt = new Date().toISOString();

      console.error(`[WorkspaceManager] Workspace failed: ${id}`, error);
      this.emitEvent({ type: "workspace.error", workspace: descriptor });
      this.notifyListeners();

      throw error;
    }
  }

  /**
   * Workspace'i sil ve process'i durdur
   */
  async delete(id: string): Promise<WorkspaceDescriptor | undefined> {
    const workspace = this.workspaces.get(id);
    if (!workspace) return undefined;

    console.log(`[WorkspaceManager] Deleting workspace: ${id}`);

    const wasRunning = Boolean(workspace.pid);
    if (wasRunning) {
      await this.stopProcess(id);
    }

    this.workspaces.delete(id);
    this.authData.delete(id);

    this.emitEvent({ type: "workspace.stopped", workspaceId: id });
    this.notifyListeners();

    return workspace;
  }

  /**
   * Tüm workspace'leri kapat (uygulama kapatılırken)
   */
  async shutdown(): Promise<void> {
    console.log("[WorkspaceManager] Shutting down all workspaces");

    for (const [id, workspace] of this.workspaces) {
      if (workspace.pid) {
        console.log(`[WorkspaceManager] Stopping workspace: ${id}`);
        await this.stopProcess(id).catch((error) => {
          console.error(`[WorkspaceManager] Failed to stop workspace ${id}:`, error);
        });
      }
    }

    this.workspaces.clear();
    this.authData.clear();
    this.processes.clear();

    console.log("[WorkspaceManager] All workspaces cleared");
  }

  // =========================================================================
  // Event Listeners
  // =========================================================================

  onStatusChange(callback: (workspaces: WorkspaceDescriptor[]) => void): () => void {
    this.statusListeners.push(callback);
    return () => {
      const index = this.statusListeners.indexOf(callback);
      if (index > -1) this.statusListeners.splice(index, 1);
    };
  }

  onEvent(callback: (event: WorkspaceEvent) => void): () => void {
    this.eventListeners.push(callback);
    return () => {
      const index = this.eventListeners.indexOf(callback);
      if (index > -1) this.eventListeners.splice(index, 1);
    };
  }

  // =========================================================================
  // Private - Process Management
  // =========================================================================

  private async launchProcess(options: {
    workspaceId: string;
    folder: string;
    username: string;
    password: string;
  }): Promise<{ pid: number; port: number }> {
    const { workspaceId, folder, username, password } = options;

    // OpenCode binary path (use 'command' from config or fallback to 'opencode')
    const binaryPath = OPENCODE_DEFAULTS.command || "opencode";

    // Args: port 0 = OS'tan dinamik port al
    const args = ["serve", "--port", "0", "--print-logs", "--log-level", "DEBUG"];

    // Environment
    const env = {
      ...process.env,
      [OPENCODE_SERVER_USERNAME_ENV]: username,
      [OPENCODE_SERVER_PASSWORD_ENV]: password,
    };

    return new Promise((resolve, reject) => {
      console.log(`[WorkspaceManager] Launching: ${binaryPath} ${args.join(" ")}`);
      console.log(`[WorkspaceManager] CWD: ${folder}`);

      const child = spawn(binaryPath, args, {
        cwd: folder,
        env,
        stdio: ["ignore", "pipe", "pipe"],
        detached: process.platform !== "win32",
      });

      const managed: ManagedProcess = { child, requestedStop: false };
      this.processes.set(workspaceId, managed);

      let stdoutBuffer = "";
      let stderrBuffer = "";
      let portFound = false;
      let startupTimer: NodeJS.Timeout | null = null;

      // Startup timeout
      startupTimer = setTimeout(() => {
        if (!portFound) {
          const error = new Error(`Workspace startup timeout (${STARTUP_TIMEOUT_MS}ms)`);
          cleanup();
          reject(error);
        }
      }, STARTUP_TIMEOUT_MS);

      const cleanup = () => {
        if (startupTimer) {
          clearTimeout(startupTimer);
          startupTimer = null;
        }
        child.stdout?.removeAllListeners();
        child.stderr?.removeAllListeners();
      };

      // Process exit handler
      const handleExit = (code: number | null, signal: NodeJS.Signals | null) => {
        console.log(`[WorkspaceManager] Process exited: ${workspaceId}, code: ${code}, signal: ${signal}`);
        this.processes.delete(workspaceId);
        cleanup();

        if (!portFound) {
          const reason = stderrBuffer || `Process exited with code ${code}`;
          reject(new Error(reason));
        } else {
          // Process sonradan kapandı - workspace'i güncelle
          const workspace = this.workspaces.get(workspaceId);
          if (workspace && !managed.requestedStop) {
            workspace.status = "error";
            workspace.error = `Process unexpectedly exited (code: ${code})`;
            workspace.updatedAt = new Date().toISOString();
            this.emitEvent({ type: "workspace.error", workspace });
            this.notifyListeners();
          }
        }
      };

      const handleError = (error: Error) => {
        console.error(`[WorkspaceManager] Process error: ${workspaceId}`, error);
        cleanup();
        this.processes.delete(workspaceId);
        reject(error);
      };

      child.on("error", handleError);
      child.on("exit", handleExit);

      // Stdout - port bilgisini yakala
      child.stdout?.on("data", (data: Buffer) => {
        const text = data.toString();
        stdoutBuffer += text;
        const lines = stdoutBuffer.split("\n");
        stdoutBuffer = lines.pop() ?? "";

        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed) continue;

          // Port pattern: "opencode server listening on http://...:PORT"
          if (!portFound) {
            const portMatch = line.match(/opencode server listening on http:\/\/.+:(\d+)/i);
            if (portMatch) {
              portFound = true;
              if (startupTimer) {
                clearTimeout(startupTimer);
                startupTimer = null;
              }
              child.removeListener("error", handleError);

              const port = parseInt(portMatch[1], 10);
              console.log(`[WorkspaceManager] Port allocated: ${port} for workspace ${workspaceId}`);
              resolve({ pid: child.pid!, port });
            }
          }
        }
      });

      // Stderr - hata logları
      child.stderr?.on("data", (data: Buffer) => {
        const text = data.toString();
        stderrBuffer += text;
        // Son 1000 karakteri tut
        if (stderrBuffer.length > 1000) {
          stderrBuffer = stderrBuffer.slice(-1000);
        }
      });
    });
  }

  private async stopProcess(workspaceId: string): Promise<void> {
    const managed = this.processes.get(workspaceId);
    if (!managed) return;

    managed.requestedStop = true;

    return new Promise((resolve) => {
      const { child } = managed;
      const timeout = 10000;

      const timer = setTimeout(() => {
        console.log(`[WorkspaceManager] Force killing process: ${workspaceId}`);
        child.kill("SIGKILL");
        resolve();
      }, timeout);

      child.once("exit", () => {
        clearTimeout(timer);
        this.processes.delete(workspaceId);
        resolve();
      });

      // Graceful shutdown
      if (process.platform === "win32") {
        child.kill();
      } else {
        child.kill("SIGTERM");
      }
    });
  }

  // =========================================================================
  // Private - Utilities
  // =========================================================================

  private generateId(): string {
    return Date.now().toString(36) + Math.random().toString(36).substring(2, 8);
  }

  private notifyListeners(): void {
    const workspaces = this.list();
    for (const listener of this.statusListeners) {
      try {
        listener(workspaces);
      } catch (error) {
        console.error("[WorkspaceManager] Status listener error:", error);
      }
    }
  }

  private emitEvent(event: WorkspaceEvent): void {
    for (const listener of this.eventListeners) {
      try {
        listener(event);
      } catch (error) {
        console.error("[WorkspaceManager] Event listener error:", error);
      }
    }
  }
}

// ===========================================================================
// Event Types
// ===========================================================================

export type WorkspaceEvent =
  | { type: "workspace.created"; workspace: WorkspaceDescriptor }
  | { type: "workspace.started"; workspace: WorkspaceDescriptor }
  | { type: "workspace.stopped"; workspaceId: string }
  | { type: "workspace.error"; workspace: WorkspaceDescriptor };

// ===========================================================================
// Singleton Export
// ===========================================================================

export const WorkspaceManager = new WorkspaceManagerClass();
