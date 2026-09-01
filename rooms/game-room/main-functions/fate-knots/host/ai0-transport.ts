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

export type FateKnotsAi0TransportError =
  | "workspace-unavailable"
  | "provider-failed"
  | "provider-response-rejected";

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
      issues: FateKnotsAi0ProviderResponseGateResult extends infer _T
        ? Array<{ code: string; value?: string; path?: string }>
        : never;
    };

function cloneJson<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function normalizeGateIssues(
  result: Extract<FateKnotsAi0ProviderResponseGateResult, { ok: false }>
): Array<{ code: string; value?: string; path?: string }> {
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
 * A real provider adapter is deliberately injected. The transport itself fixes
 * the safety/order contract: prepare isolated workspace -> invoke provider with
 * no development capabilities -> parse unknown response -> validate request and
 * engine legality -> return only the bounded accepted response.
 */
export async function invokeFateKnotsAi0Runtime(
  deps: FateKnotsAi0TransportDependencies,
  request: FateKnotsAi0RuntimeRequest
): Promise<FateKnotsAi0TransportResult> {
  const prepared = await deps.prepareWorkspace(
    request.kind === "npc-dialogue" ? request.rolePacket.universeId : request.combatPacket.universeId
  );
  if (!prepared.ok) {
    return {
      ok: false,
      error: "workspace-unavailable",
      response: null,
      issues: [],
    };
  }

  if (prepared.workspace.runtimeProfileId !== FATE_KNOTS_AI0_RUNTIME_PROFILE.id) {
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
      request: cloneJson(request),
    });
  } catch {
    return {
      ok: false,
      error: "provider-failed",
      response: null,
      issues: [],
    };
  }

  const gated = gateFateKnotsAi0ProviderResponse(request, candidate);
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
