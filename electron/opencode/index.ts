/**
 * OpenCode Manager - Barrel Export
 */

export { OpenCodeManager } from './manager.ts';

// Type exports
export type {
  OpenCodeOptions,
  OpenCodeState,
  OpenCodeSession,
  ApiResponse,
  ProviderConfig,
  ProvidersResponse,
  AgentInfo,
  MCPServerInfo,
  BackgroundShell,
  PluginInfo,
} from './types.ts';

// Function exports for advanced usage
export { createId, randomBase62 } from './id-generator.ts';
export {
  spawnServer,
  waitForServer,
  isPortInUse,
  killProcess,
  killByPort,
  sleep,
} from './process-control.ts';
export { startSSEReader } from './sse-events.ts';
export {
  getApiUrl,
  getHeaders,
  getSSEHeaders,
  getProviders,
  getAgents,
  setAgent,
  setModel,
  getMCPServers,
  getPlugins,
} from './api-client.ts';
export {
  getSessions,
  getSessionById,
  getSessionMessages,
  createOrGetSession,
  sendMessage,
  respondToPermission,
  cancelSession,
  compactSession,
  deleteSession,
  updateSession,
} from './session-api.ts';
export { getBackgroundShells } from './shell-api.ts';
