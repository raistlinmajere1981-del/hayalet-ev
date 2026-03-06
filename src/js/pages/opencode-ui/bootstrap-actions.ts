import type { OpencodeUiSessionSummary, RuntimeState } from "./types.js";

type ByIdFn = <T extends HTMLElement>(
  id: string,
  guard?: (element: T) => boolean
) => T | null;

export interface OpencodeUiToolsReadyPayload {
  ready: boolean;
  unresolvedServers: string[];
  mcpChecks: number;
  toolCount: number;
}

export interface OpencodeUiBootstrapDeps {
  checkHealth: () => Promise<{ mcpServers: Record<string, unknown> }>;
  loadStatusContext: () => Promise<void>;
  waitForMcpServersSettled: () => Promise<{
    ready: boolean;
    checks: number;
    unresolvedServers: string[];
  }>;
  loadToolsFinalSnapshot: () => Promise<{
    status: "loaded" | "empty" | "error";
    toolIds: string[];
  }>;
}

export interface BootstrapContext {
  runtime: RuntimeState;
  byId: ByIdFn;
  getSessionsForTab: (
    sessions: OpencodeUiSessionSummary[],
    tab?: "active" | "archived"
  ) => OpencodeUiSessionSummary[];
  listSessionsFromDisk: () => Promise<OpencodeUiSessionSummary[]>;
  createServerSession: (title?: string) => Promise<string>;
  setActiveSession: (sessionId: string | null) => void;
  loadSessionListAndRender: (options?: {
    preserveActive?: boolean;
    syncSelectionToTab?: boolean;
  }) => Promise<void>;
  loadActiveSessionHistory: () => Promise<void>;
  checkHealth: () => Promise<{ mcpServers: Record<string, unknown> }>;
  loadStatusContext: () => Promise<void>;
  loadToolsFinalSnapshot: () => Promise<{ status: "loaded" | "empty" | "error"; toolIds: string[] }>;
  syncActiveSessionHistoryIfUpdated: () => Promise<void>;
}

export async function initializeSessionSelection(
  context: BootstrapContext,
  resumeSessionId: string
): Promise<void> {
  context.runtime.sessionTab = "active";
  const sessions = await context.listSessionsFromDisk();
  const visibleSessions = context.getSessionsForTab(sessions, "active");

  if (visibleSessions.length === 0) {
    const createdId = await context.createServerSession("Yeni Sohbet");
    context.setActiveSession(createdId);
    await context.loadSessionListAndRender({ preserveActive: true });
    await context.loadActiveSessionHistory();
    return;
  }

  const resumeId = resumeSessionId.trim();
  const hasResume =
    resumeId !== "" && visibleSessions.some((session) => session.id === resumeId);

  if (hasResume) {
    context.setActiveSession(resumeId);
  } else {
    context.setActiveSession(visibleSessions[0]?.id ?? null);
  }

  await context.loadSessionListAndRender({ preserveActive: true });
  await context.loadActiveSessionHistory();
}

export function startPeriodicRefresh(context: BootstrapContext): void {
  const lastCheckEl = context.byId<HTMLElement>("last-check");
  if (lastCheckEl != null) {
    lastCheckEl.textContent = `Son kontrol: ${new Date().toLocaleTimeString("tr-TR")}`;
  }

  setInterval(() => {
    void (async (): Promise<void> => {
      try {
        await context.checkHealth();
      } catch (_error) {}

      if (lastCheckEl != null) {
        lastCheckEl.textContent = `Son kontrol: ${new Date().toLocaleTimeString("tr-TR")}`;
      }
    })();
  }, 120000);
}

let sessionUpdatedListenerBound = false;

export function startLiveMessageRefresh(context: BootstrapContext): void {
  const api = window.electronAPI as
    | undefined
    | {
        opencodeUiOnSessionUpdated?: (callback: (payload: { sessionId: string }) => void) => void;
      };

  if (sessionUpdatedListenerBound) {
    return;
  }

  if (!api?.opencodeUiOnSessionUpdated) {
    setInterval(() => {
      void context.syncActiveSessionHistoryIfUpdated();
    }, 1200);
    return;
  }

  sessionUpdatedListenerBound = true;
  api.opencodeUiOnSessionUpdated((payload) => {
    if (payload?.sessionId !== context.runtime.activeSessionId) {
      return;
    }
    void context.syncActiveSessionHistoryIfUpdated();
  });
}

export async function runOpencodeUiBootstrapPipeline(options: {
  deps: OpencodeUiBootstrapDeps;
  emitStage: (title: string, subtitle: string) => void;
  emitToolsReady: (payload: OpencodeUiToolsReadyPayload) => void;
}): Promise<void> {
  const { deps, emitStage, emitToolsReady } = options;

  emitStage("Sunucu saglik kontrolu", "OpenCode server health endpoint kontrol ediliyor");
  await deps.checkHealth();

  emitStage("Durum ve baglam okunuyor", "Calisma dizini bilgisi yukleniyor");
  await deps.loadStatusContext();

  emitStage("MCP durumu bekleniyor", "MCP sunuculari terminal duruma gelene kadar izleniyor");
  const mcpResult = await deps.waitForMcpServersSettled();

  emitStage("Tool snapshot aliniyor", "Final tool listesi endpointlerden okunuyor");
  const toolsResult = await deps.loadToolsFinalSnapshot();

  emitToolsReady({
    ready: true,
    unresolvedServers: mcpResult.ready ? [] : mcpResult.unresolvedServers,
    mcpChecks: mcpResult.checks,
    toolCount: toolsResult.toolIds.length,
  });

  if (mcpResult.ready) {
    emitStage("Baglanti tamamlandi", "OpenCode UI kullanima hazir");
  } else {
    emitStage("Baglanti kismi", "MCP tamamen hazir degil, UI acildi");
  }
}
