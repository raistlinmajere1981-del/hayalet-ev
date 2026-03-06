import { apiCall } from "./api.js";

export type ToolSnapshotStatus = "loaded" | "empty" | "error";

export interface ToolSnapshotResult {
  status: ToolSnapshotStatus;
  toolIds: string[];
}

interface OpenCodeToolResult {
  status: ToolSnapshotStatus;
  toolIds: string[];
}

interface HevToolsResponse {
  success?: boolean;
  toolNames?: string[];
}

type ToolFetcher = (path: string) => Promise<unknown>;

function normalizeToolIds(data: unknown): string[] {
  if (Array.isArray(data)) {
    return data.filter((item): item is string => typeof item === "string" && item !== "");
  }

  if (data === null || data === undefined || typeof data !== "object") {
    return [];
  }

  const record = data as Record<string, unknown>;

  if (record["error"] !== undefined || record["errors"] !== undefined) {
    return [];
  }

  const directIds = record["ids"];
  if (Array.isArray(directIds)) {
    return directIds.filter((item): item is string => typeof item === "string" && item !== "");
  }

  const nestedToolIds = record["toolIds"];
  if (Array.isArray(nestedToolIds)) {
    return nestedToolIds.filter((item): item is string => typeof item === "string" && item !== "");
  }

  const tools = record["tools"];
  if (Array.isArray(tools)) {
    return tools
      .map((item) => {
        if (item !== null && item !== undefined && typeof item === "object") {
          const id = (item as { id?: unknown; name?: unknown }).id;
          if (typeof id === "string" && id !== "") {
            return id;
          }

          const name = (item as { id?: unknown; name?: unknown }).name;
          if (typeof name === "string" && name !== "") {
            return name;
          }
        }

        return "";
      })
      .filter((item) => item !== "");
  }

  return [];
}

function renderToolSnapshot(opencodeToolIds: string[], hevToolIds: string[]): void {
  if (typeof document === "undefined") {
    return;
  }

  const allToolIds = [...opencodeToolIds, ...hevToolIds];

  const toolCountEl = document.getElementById("tool-count");
  if (toolCountEl != null) {
    toolCountEl.textContent = String(allToolIds.length);
  }

  const toolsListEl = document.getElementById("tools-list");
  if (toolsListEl == null) {
    return;
  }

  if (allToolIds.length === 0) {
    toolsListEl.innerHTML = '<div class="empty-state">Tool bulunamadi</div>';
    return;
  }

  const sections: string[] = [];

  if (opencodeToolIds.length > 0) {
    sections.push(
      '<div class="ds-tools-group__header">OpenCode Built-in (' +
        String(opencodeToolIds.length) +
        ")</div>" +
        opencodeToolIds
          .map((toolId) => `<div class="ds-panel__item"><strong>${toolId}</strong></div>`)
          .join("")
    );
  }

  if (hevToolIds.length > 0) {
    sections.push(
      '<div class="ds-tools-group__header">Hayalet-ev MCP (' +
        String(hevToolIds.length) +
        ")</div>" +
        hevToolIds
          .map((toolId) => `<div class="ds-panel__item"><strong>${toolId}</strong></div>`)
          .join("")
    );
  }

  toolsListEl.innerHTML = sections.join("");
}

async function loadOpenCodeToolIds(get: ToolFetcher): Promise<OpenCodeToolResult> {
  try {
    const idsResponse = await get("/experimental/tool/ids");
    const toolIds = normalizeToolIds(idsResponse);
    return {
      status: toolIds.length > 0 ? "loaded" : "empty",
      toolIds,
    };
  } catch (_error) {
    try {
      const toolsResponse = await get("/experimental/tool");
      const toolIds = normalizeToolIds(toolsResponse);
      return {
        status: toolIds.length > 0 ? "loaded" : "empty",
        toolIds,
      };
    } catch (_nestedError) {
      return {
        status: "error",
        toolIds: [],
      };
    }
  }
}

async function loadHevToolIds(): Promise<string[]> {
  if (
    window.electronAPI == null ||
    typeof window.electronAPI["opencodeUiHevTools"] !== "function"
  ) {
    return [];
  }

  try {
    const result = (await window.electronAPI["opencodeUiHevTools"]()) as HevToolsResponse;
    if (result.success !== true || !Array.isArray(result.toolNames)) {
      return [];
    }

    return result.toolNames.filter(
      (toolName): toolName is string => typeof toolName === "string" && toolName !== ""
    );
  } catch (_error) {
    return [];
  }
}

export async function loadToolsFinalSnapshot(fetcher?: ToolFetcher): Promise<ToolSnapshotResult> {
  const get: ToolFetcher =
    fetcher ??
    (async (path: string): Promise<unknown> => {
      return await apiCall<unknown>("GET", path);
    });

  const [openCodeResult, hevToolIds] = await Promise.all([
    loadOpenCodeToolIds(get),
    loadHevToolIds(),
  ]);
  const combinedToolIds = [...openCodeResult.toolIds, ...hevToolIds];

  renderToolSnapshot(openCodeResult.toolIds, hevToolIds);

  if (combinedToolIds.length > 0) {
    return {
      status: "loaded",
      toolIds: combinedToolIds,
    };
  }

  if (openCodeResult.status === "error") {
    return {
      status: "error",
      toolIds: [],
    };
  }

  return {
    status: "empty",
    toolIds: [],
  };
}
