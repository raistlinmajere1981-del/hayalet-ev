import { apiCall } from "./api.js";

export type ToolSnapshotStatus = "loaded" | "empty" | "error";

export interface ToolSnapshotResult {
  status: ToolSnapshotStatus;
  toolIds: string[];
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

function renderToolSnapshot(toolIds: string[]): void {
  if (typeof document === "undefined") {
    return;
  }

  const toolCountEl = document.getElementById("tool-count");
  if (toolCountEl != null) {
    toolCountEl.textContent = String(toolIds.length);
  }

  const toolsListEl = document.getElementById("tools-list");
  if (toolsListEl == null) {
    return;
  }

  if (toolIds.length === 0) {
    toolsListEl.innerHTML = '<div class="empty-state">Tool bulunamadi</div>';
    return;
  }

  toolsListEl.innerHTML = toolIds
    .map((toolId) => `<div class="ds-panel__item"><strong>${toolId}</strong></div>`)
    .join("");
}

export async function loadToolsFinalSnapshot(fetcher?: ToolFetcher): Promise<ToolSnapshotResult> {
  const get: ToolFetcher =
    fetcher ??
    (async (path: string): Promise<unknown> => {
      return await apiCall<unknown>("GET", path);
    });

  try {
    const idsResponse = await get("/experimental/tool/ids");
    const toolIds = normalizeToolIds(idsResponse);
    renderToolSnapshot(toolIds);
    return {
      status: toolIds.length > 0 ? "loaded" : "empty",
      toolIds,
    };
  } catch (_error) {
    try {
      const toolsResponse = await get("/experimental/tool");
      const toolIds = normalizeToolIds(toolsResponse);
      renderToolSnapshot(toolIds);
      return {
        status: toolIds.length > 0 ? "loaded" : "empty",
        toolIds,
      };
    } catch (_nestedError) {
      renderToolSnapshot([]);
      return {
        status: "error",
        toolIds: [],
      };
    }
  }
}
