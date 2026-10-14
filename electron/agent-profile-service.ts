import { mkdirSync } from "node:fs";
import { join } from "node:path";
import Database from "./native/better-sqlite3.js";
import type { BetterSqlite3Database } from "./native/better-sqlite3.js";
import { Paths } from "./paths.ts";
import { AgentProfileRegistry, validateProfileScope } from "./database/agent-profile-registry.js";
import { createAgentProfileWorkspace } from "./agent-profile-workspace.js";
import { ASSISTANT_PROFILE_SCOPE } from "../shared/agent-profiles.js";
import type {
  AgentCapabilitySnapshot,
  AgentProfileRequest,
  AgentProfileScope,
  AgentProfileResolution,
} from "../shared/agent-profiles.js";

let db: BetterSqlite3Database | null = null;
let registry: AgentProfileRegistry | null = null;
const capabilities = new Map<string, AgentCapabilitySnapshot>();

export function getAgentProfileRegistry(): AgentProfileRegistry {
  if (registry) return registry;
  const directory = join(Paths.getDataDir(), "shared");
  mkdirSync(directory, { recursive: true });
  db = new Database(join(directory, "app.db"));
  db.exec("PRAGMA journal_mode = WAL");
  registry = new AgentProfileRegistry(db);
  return registry;
}

export function closeAgentProfileRegistry(): void {
  db?.close();
  db = null;
  registry = null;
  capabilities.clear();
}

// Called by host adapters after probing a concrete session/model, never by renderer payloads.
export function attestAgentCapabilities(
  scope: AgentProfileScope,
  snapshot: AgentCapabilitySnapshot
): void {
  validateProfileScope(scope);
  capabilities.set(JSON.stringify([scope.purpose, scope.agentId, scope.roomId, scope.roleId]), {
    source: snapshot.source,
    modelId: snapshot.modelId,
    systemInstructions: snapshot.systemInstructions,
    tools: [...snapshot.tools],
  });
}

export function getAgentCapabilities(scope: AgentProfileScope): AgentCapabilitySnapshot {
  validateProfileScope(scope);
  const snapshot = capabilities.get(
    JSON.stringify([scope.purpose, scope.agentId, scope.roomId, scope.roleId])
  ) ?? {
    source: "Host inventory not verified",
    modelId: null,
    systemInstructions: false,
    tools: [],
  };
  return { ...snapshot, tools: [...snapshot.tools] };
}

export function resolveAgentProfile(scope: AgentProfileScope): AgentProfileResolution {
  return getAgentProfileRegistry().resolve(scope, getAgentCapabilities(scope));
}

export async function prepareAgentProfileWorkspace(
  scope: AgentProfileScope
): Promise<{ workspacePath: string; agentsPath: string; hash: string }> {
  return await createAgentProfileWorkspace(Paths.getAi0RuntimeRoot(), resolveAgentProfile(scope));
}

export function handleAgentProfileRequest(request: AgentProfileRequest): unknown {
  const store = getAgentProfileRegistry();
  switch (request.action) {
    case "instruction-list":
      return store.listInstructions(request.purpose);
    case "profile-save":
      return store.saveProfile(request.profile, request.expectedVersion);
    case "profile-delete":
      store.deleteProfile(request.id, request.expectedVersion);
      return { revision: store.revision };
    case "list":
      return store.list();
    case "editor-read":
      return store.editorRead(request.scope ?? ASSISTANT_PROFILE_SCOPE);
    case "editor-save":
      return store.saveEditor(request.scope ?? ASSISTANT_PROFILE_SCOPE, request.state);
    case "select":
      store.select(request.scope, request.profileId);
      return store.editorRead(request.scope);
    case "inspect":
      return resolveAgentProfile(request.scope);
    case "capabilities": {
      const actual = getAgentCapabilities(request.scope);
      const selection = store.editorRead(request.scope);
      const profile = selection.profiles.find((item) => item.id === selection.activeProfileId);
      return {
        scope: request.scope,
        profileId: profile?.id ?? null,
        capabilities: actual,
        unavailableCapabilities: (profile?.requestedCapabilities ?? []).filter(
          (id) => !actual.tools.includes(id)
        ),
        delivery: actual.systemInstructions ? "system" : "workspace",
      };
    }
    case "resolve":
      return resolveAgentProfile(request.scope);
    case "instruction-save":
      store.saveInstruction(request.instruction, request.expectedVersion);
      return { revision: store.revision };
    case "instruction-delete":
      store.deleteInstruction(request.id, request.expectedVersion);
      return { revision: store.revision };
    default:
      throw new Error("Unknown registry action");
  }
}

export function invalidateAgentCapabilities(scope: AgentProfileScope): void {
  validateProfileScope(scope);
  capabilities.delete(JSON.stringify([scope.purpose, scope.agentId, scope.roomId, scope.roleId]));
}
