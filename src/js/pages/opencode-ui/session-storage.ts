import type { OpencodeUiSessionDetail, OpencodeUiSessionSummary, RuntimeState } from "./types.js";

export interface OpencodeUiSessionStorage {
  listServerSessions(): Promise<OpencodeUiSessionSummary[]>;
  readServerSession(sessionId: string): Promise<OpencodeUiSessionDetail | null>;
  archiveServerSession(sessionId: string, archived?: boolean): Promise<void>;
}

export function createSessionStorage(runtime: RuntimeState): OpencodeUiSessionStorage {
  const electron = (): NonNullable<Window["electronAPI"]> => {
    if (!window.electronAPI) throw new Error("Electron API unavailable");
    return window.electronAPI;
  };
  const port = (): number => Number(new URL(runtime.baseUrl).port);
  return {
    async listServerSessions(): Promise<OpencodeUiSessionSummary[]> {
      const result = await electron().opencodeUiListSessions(port());
      if (!result.success) throw new Error(result.error ?? "OpenCode session list unavailable");
      return result.sessions ?? [];
    },
    async readServerSession(sessionId: string): Promise<OpencodeUiSessionDetail | null> {
      const result = await electron().opencodeUiReadSession(sessionId, port());
      return result.success ? (result.session ?? null) : null;
    },
    async archiveServerSession(sessionId: string, archived = true): Promise<void> {
      const result = await electron().opencodeUiArchiveSession(sessionId, archived, port());
      if (!result.success) throw new Error(result.error ?? "OpenCode archive failed");
    },
  };
}
