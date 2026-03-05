import { apiCall } from "./api.js";

export type McpStatusMap = Record<string, unknown>;

interface GlobalHealthResponse {
  healthy?: boolean;
  version?: string;
}

interface PathResponse {
  path?: string;
}

const TRANSITIONAL_MCP_STATUSES = new Set([
  "",
  "starting",
  "initializing",
  "restarting",
  "connecting",
  "pending",
]);

function extractMcpStatus(raw: unknown): string {
  if (typeof raw === "string") {
    return raw.trim().toLowerCase();
  }

  if (raw !== null && raw !== undefined && typeof raw === "object") {
    const directStatus = (raw as { status?: unknown }).status;
    if (typeof directStatus === "string") {
      return directStatus.trim().toLowerCase();
    }
  }

  return "";
}

export function getUnresolvedMcpServers(mcpServers: McpStatusMap | undefined): string[] {
  if (!mcpServers || typeof mcpServers !== "object") {
    return [];
  }

  const entries = Object.entries(mcpServers);
  if (entries.length === 0) {
    return [];
  }

  const unresolved: string[] = [];
  for (const [serverName, raw] of entries) {
    const status = extractMcpStatus(raw);
    if (TRANSITIONAL_MCP_STATUSES.has(status)) {
      unresolved.push(serverName);
    }
  }

  return unresolved;
}

export function areAllMcpServersSettled(mcpServers: McpStatusMap | undefined): boolean {
  if (!mcpServers || typeof mcpServers !== "object") {
    return true;
  }

  const entries = Object.entries(mcpServers);
  if (entries.length === 0) {
    return true;
  }

  return getUnresolvedMcpServers(mcpServers).length === 0;
}

export interface McpSettledResult {
  ready: boolean;
  checks: number;
  unresolvedServers: string[];
}

export async function checkHealth(): Promise<{ mcpServers: McpStatusMap }> {
  const [globalHealth, mcpServers] = await Promise.all([
    apiCall<GlobalHealthResponse>("GET", "/global/health"),
    apiCall<McpStatusMap>("GET", "/mcp"),
  ]);

  const versionEl = document.getElementById("version");
  if (versionEl != null) {
    versionEl.textContent = globalHealth.version ?? "-";
  }

  const healthBadgeEl = document.getElementById("health-badge");
  if (healthBadgeEl != null) {
    const healthy = globalHealth.healthy === true;
    healthBadgeEl.textContent = healthy ? "Saglikli" : "Sorunlu";
  }

  return { mcpServers };
}

export async function loadStatusContext(): Promise<void> {
  const pathResult = await apiCall<PathResponse>("GET", "/path");

  const path = typeof pathResult.path === "string" ? pathResult.path : "";
  if (path !== "") {
    const workingDirEl = document.getElementById("working-dir");
    if (workingDirEl != null) {
      workingDirEl.textContent = path;
      workingDirEl.setAttribute("title", path);
    }

    const workspaceLabelEl = document.getElementById("workspace-active");
    if (workspaceLabelEl != null) {
      const parts = path.split("/").filter((part) => part !== "");
      const folderName = parts.length > 0 ? (parts[parts.length - 1] ?? "Main") : "Main";
      workspaceLabelEl.textContent = folderName;
    }
  }
}

async function wait(delayMs: number): Promise<void> {
  await new Promise<void>((resolve) => {
    setTimeout(resolve, delayMs);
  });
}

export async function waitForMcpServersSettled(
  options: {
    timeoutMs?: number;
    intervalMs?: number;
    checkHealthFn?: () => Promise<{ mcpServers: McpStatusMap }>;
    waitFn?: (delayMs: number) => Promise<void>;
  } = {}
): Promise<McpSettledResult> {
  const timeoutMs = options.timeoutMs ?? 20000;
  const intervalMs = options.intervalMs ?? 1000;
  const checkHealthFn = options.checkHealthFn ?? checkHealth;
  const waitFn = options.waitFn ?? wait;
  const startedAt = Date.now();

  const poll = async (checks: number): Promise<McpSettledResult> => {
    const snapshot = await checkHealthFn();
    const nextChecks = checks + 1;
    const unresolved = getUnresolvedMcpServers(snapshot.mcpServers);

    if (unresolved.length === 0 && areAllMcpServersSettled(snapshot.mcpServers)) {
      return { ready: true, checks: nextChecks, unresolvedServers: [] };
    }

    if (Date.now() - startedAt >= timeoutMs) {
      return { ready: false, checks: nextChecks, unresolvedServers: unresolved };
    }

    await waitFn(intervalMs);
    return await poll(nextChecks);
  };

  return await poll(0);
}
