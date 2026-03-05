export type GhostProvider = "opencode";

export type GhostProviderServerState = {
  provider: GhostProvider;
  running: boolean;
  port?: number;
  url?: string;
  alreadyRunning?: boolean;
  source?: "existing" | "started";
};

export function normalizeGhostProvider(
  _value: unknown,
  fallback: GhostProvider = "opencode"
): GhostProvider {
  return fallback;
}

export function formatProviderMeta(
  provider: GhostProvider,
  server?: GhostProviderServerState
): string {
  if (server?.running !== true) {
    return `${provider} | server:idle`;
  }

  const port = typeof server.port === "number" ? `:${String(server.port)}` : "";
  const source = server.source ?? "existing";
  return `${provider} | server:running${port} source:${source}`;
}
