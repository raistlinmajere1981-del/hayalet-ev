import type { FateKnotsAi0MaterializedWorkspace } from "./ai0-workspace.js";
import {
  FATE_KNOTS_AI0_RUNTIME_PROFILE,
  gateFateKnotsAi0ProviderResponse,
  type FateKnotsAi0ProviderResponseGateResult,
  type FateKnotsAi0RuntimeRequest,
  type FateKnotsAi0RuntimeResponse,
} from "../shared/ai0-runtime.js";

export interface FateKnotsAi0ProviderInvocation {
  workspaceDir: string;
  runtimeProfile: typeof FATE_KNOTS_AI0_RUNTIME_PROFILE;
  request: FateKnotsAi0RuntimeRequest;
}

export interface FateKnotsAi0ProviderAdapter {
  invoke(invocation: FateKnotsAi0ProviderInvocation): Promise<unknown>;
}

export type FateKnotsAi0WorkspacePrepareResult =
  | { ok: true; workspace: FateKnotsAi0MaterializedWorkspace }
  | { ok: false; error: string; workspace: null };

export interface FateKnotsAi0TransportDependencies {
  prepareWorkspace(universeId: string): Promise<FateKnotsAi0WorkspacePrepareResult>;
  provider: FateKnotsAi0ProviderAdapter;
}

export interface FateKnotsAi0TransportInvocation {
  universeId: string;
  request: FateKnotsAi0RuntimeRequest;
}

export type FateKnotsAi0TransportError =
  | "invalid-runtime-context"
  | "workspace-unavailable"
  | "provider-failed"
  | "provider-response-rejected";

export interface FateKnotsAi0TransportIssue {
  code: string;
  value?: string;
  path?: string;
}

export type FateKnotsAi0TransportResult =
  | {
      ok: true;
      response: FateKnotsAi0RuntimeResponse;
      issues: [];
    }
  | {
      ok: false;
      error: FateKnotsAi0TransportError;
      response: null;
      issues: FateKnotsAi0TransportIssue[];
    };

function cloneJson<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function normalizeUniverseId(value: string): string | null {
  if (typeof value !== "string") return null;
  const normalized = value.trim();
  return normalized.length > 0 ? normalized : null;
}

function normalizeGateIssues(
  result: Extract<FateKnotsAi0ProviderResponseGateResult, { ok: false }>
): FateKnotsAi0TransportIssue[] {
  return result.issues.map((issue) => ({
    code: issue.code,
    ...(typeof (issue as { value?: unknown }).value === "string"
      ? { value: (issue as { value: string }).value }
      : {}),
    ...(typeof (issue as { path?: unknown }).path === "string"
      ? { path: (issue as { path: string }).path }
      : {}),
  }));
}

/**
 * Provider-neutral AI0 transport authority.
 *
 * The universe id is explicit transport context rather than part of the combat-
 * visible AI0 packet. This keeps workspace routing out of NPC tactical knowledge.
 *
 * A real provider adapter is deliberately injected. The transport fixes the
 * safety/order contract: prepare isolated workspace -> invoke provider with the
 * bounded runtime profile/request -> parse unknown response -> validate request
 * and engine legality -> return only the accepted bounded response.
 */
export async function invokeFateKnotsAi0Runtime(
  deps: FateKnotsAi0TransportDependencies,
  invocation: FateKnotsAi0TransportInvocation
): Promise<FateKnotsAi0TransportResult> {
  const universeId = normalizeUniverseId(invocation.universeId);
  if (universeId === null) {
    return {
      ok: false,
      error: "invalid-runtime-context",
      response: null,
      issues: [],
    };
  }

  if (
    invocation.request.kind === "npc-dialogue" &&
    invocation.request.rolePacket.universeId !== universeId
  ) {
    return {
      ok: false,
      error: "invalid-runtime-context",
      response: null,
      issues: [],
    };
  }

  const prepared = await deps.prepareWorkspace(universeId);
  if (!prepared.ok) {
    return {
      ok: false,
      error: "workspace-unavailable",
      response: null,
      issues: [],
    };
  }

  if (String(prepared.workspace.runtimeProfileId) !== FATE_KNOTS_AI0_RUNTIME_PROFILE.id) {
    return {
      ok: false,
      error: "workspace-unavailable",
      response: null,
      issues: [],
    };
  }

  let candidate: unknown;
  try {
    candidate = await deps.provider.invoke({
      workspaceDir: prepared.workspace.workspaceDir,
      runtimeProfile: FATE_KNOTS_AI0_RUNTIME_PROFILE,
      request: cloneJson(invocation.request),
    });
  } catch {
    return {
      ok: false,
      error: "provider-failed",
      response: null,
      issues: [],
    };
  }

  const gated = gateFateKnotsAi0ProviderResponse(invocation.request, candidate);
  if (!gated.ok) {
    return {
      ok: false,
      error: "provider-response-rejected",
      response: null,
      issues: normalizeGateIssues(gated),
    };
  }

  return {
    ok: true,
    response: gated.response,
    issues: [],
  };
}
