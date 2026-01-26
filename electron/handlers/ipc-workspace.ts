/**
 * IPC Handlers - Workspace API
 *
 * Workspace yönetimi için IPC endpoints
 * - workspace:list - Tüm workspace'leri listele
 * - workspace:create - Yeni workspace oluştur
 * - workspace:delete - Workspace sil
 * - workspace:get - Belirli workspace'i getir
 * - workspace:getAuth - Workspace auth header'ını getir
 */

import { ipcMain, type IpcMainInvokeEvent } from "electron";
import { WorkspaceManager, type WorkspaceDescriptor } from "../workspace-manager.ts";
import { OpenCodeManager } from "../opencode-manager.ts";

// ===========================================================================
// Response Types
// ===========================================================================

interface WorkspaceResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
}

// ===========================================================================
// Handlers
// ===========================================================================

/**
 * Tüm workspace'leri listele
 */
async function handleWorkspaceList(): Promise<WorkspaceResponse<WorkspaceDescriptor[]>> {
  try {
    const workspaces = WorkspaceManager.list();
    return { success: true, data: workspaces };
  } catch (error) {
    console.error("[IPC:workspace:list] Error:", error);
    return { success: false, error: (error as Error).message };
  }
}

/**
 * Yeni workspace oluştur
 */
async function handleWorkspaceCreate(
  _event: IpcMainInvokeEvent,
  options: { path: string; name?: string }
): Promise<WorkspaceResponse<WorkspaceDescriptor>> {
  try {
    if (!options?.path) {
      return { success: false, error: "Path is required" };
    }

    const workspace = await WorkspaceManager.create(options.path, options.name);
    
    // Workspace oluşturulduğunda OpenCodeManager'ı yapılandır
    // Bu sayede SSE Server auth header'ı kullanabilir
    if (workspace.status === "ready" && workspace.port) {
      const authHeader = WorkspaceManager.getAuthorizationHeader(workspace.id);
      if (authHeader) {
        OpenCodeManager.configureFromWorkspace({
          port: workspace.port,
          authHeader: authHeader,
          projectPath: workspace.path,
        });
        console.log("[IPC:workspace:create] OpenCodeManager configured", {
          port: workspace.port,
          hasAuth: true,
        });
      }
    }
    
    return { success: true, data: workspace };
  } catch (error) {
    console.error("[IPC:workspace:create] Error:", error);
    return { success: false, error: (error as Error).message };
  }
}

/**
 * Workspace sil
 */
async function handleWorkspaceDelete(
  _event: IpcMainInvokeEvent,
  id: string
): Promise<WorkspaceResponse<WorkspaceDescriptor | undefined>> {
  try {
    if (!id) {
      return { success: false, error: "Workspace ID is required" };
    }

    const workspace = await WorkspaceManager.delete(id);
    return { success: true, data: workspace };
  } catch (error) {
    console.error("[IPC:workspace:delete] Error:", error);
    return { success: false, error: (error as Error).message };
  }
}

/**
 * Belirli workspace'i getir
 */
async function handleWorkspaceGet(
  _event: IpcMainInvokeEvent,
  id: string
): Promise<WorkspaceResponse<WorkspaceDescriptor | undefined>> {
  try {
    if (!id) {
      return { success: false, error: "Workspace ID is required" };
    }

    const workspace = WorkspaceManager.get(id);
    return { success: true, data: workspace };
  } catch (error) {
    console.error("[IPC:workspace:get] Error:", error);
    return { success: false, error: (error as Error).message };
  }
}

/**
 * Workspace auth header'ını getir
 */
async function handleWorkspaceGetAuth(
  _event: IpcMainInvokeEvent,
  id: string
): Promise<WorkspaceResponse<{ authorization: string } | undefined>> {
  try {
    if (!id) {
      return { success: false, error: "Workspace ID is required" };
    }

    const authorization = WorkspaceManager.getAuthorizationHeader(id);
    if (!authorization) {
      return { success: false, error: "Workspace not found or no auth available" };
    }

    return { success: true, data: { authorization } };
  } catch (error) {
    console.error("[IPC:workspace:getAuth] Error:", error);
    return { success: false, error: (error as Error).message };
  }
}

// ===========================================================================
// Registration
// ===========================================================================

export function registerWorkspaceHandlers(): void {
  console.log("[IPC] Registering workspace handlers");

  ipcMain.handle("workspace:list", handleWorkspaceList);
  ipcMain.handle("workspace:create", handleWorkspaceCreate);
  ipcMain.handle("workspace:delete", handleWorkspaceDelete);
  ipcMain.handle("workspace:get", handleWorkspaceGet);
  ipcMain.handle("workspace:getAuth", handleWorkspaceGetAuth);
}

/**
 * Cleanup - uygulama kapatılırken çağrılır
 */
export async function shutdownWorkspaces(): Promise<void> {
  await WorkspaceManager.shutdown();
}
