import { acceptFateKnotsForgeCandidate, type FateKnotsForgeAcceptanceResult } from "./forge-acceptance.js";
import type { FateKnotsPersistenceApi } from "./persistence.js";

export const FATE_KNOTS_FORGE_STAGES = [
  "idle",
  "generating",
  "validating",
  "accepted",
  "failed",
] as const;

export type FateKnotsForgeStage = (typeof FATE_KNOTS_FORGE_STAGES)[number];

export interface FateKnotsForgeHubSnapshot {
  available: boolean;
  stage: FateKnotsForgeStage;
  revision: number;
  acceptedUniverseId: string | null;
  failureCode: string | null;
}

interface FateKnotsForgeInternalState extends FateKnotsForgeHubSnapshot {
  requestId: string | null;
}

export type FateKnotsForgeTransitionResult =
  | { ok: true; state: FateKnotsForgeHubSnapshot }
  | {
      ok: false;
      error:
        | "forge-unavailable"
        | "invalid-request-id"
        | "forge-busy"
        | "request-mismatch"
        | "invalid-stage";
      state: FateKnotsForgeHubSnapshot;
    };

export type FateKnotsForgeCompletionResult =
  | {
      ok: true;
      state: FateKnotsForgeHubSnapshot;
      acceptance: Extract<FateKnotsForgeAcceptanceResult, { ok: true }>;
    }
  | {
      ok: false;
      error:
        | "request-mismatch"
        | "invalid-stage"
        | "candidate-rejected"
        | "persistence-rejected";
      state: FateKnotsForgeHubSnapshot;
      acceptance: FateKnotsForgeAcceptanceResult | null;
    };

export interface FateKnotsForgeOrchestrator {
  getHubSnapshot(): FateKnotsForgeHubSnapshot;
  setAvailable(available: boolean): FateKnotsForgeHubSnapshot;
  begin(requestId: string): FateKnotsForgeTransitionResult;
  markValidating(requestId: string): FateKnotsForgeTransitionResult;
  complete(requestId: string, candidate: unknown): FateKnotsForgeCompletionResult;
  fail(requestId: string, code?: string): FateKnotsForgeTransitionResult;
  reset(): FateKnotsForgeHubSnapshot;
}

function cloneHubSnapshot(state: FateKnotsForgeInternalState): FateKnotsForgeHubSnapshot {
  return {
    available: state.available,
    stage: state.stage,
    revision: state.revision,
    acceptedUniverseId: state.acceptedUniverseId,
    failureCode: state.failureCode,
  };
}

function normalizeRequestId(requestId: string): string | null {
  if (typeof requestId !== "string") return null;
  const normalized = requestId.trim();
  return normalized.length > 0 ? normalized : null;
}

function normalizeFailureCode(code: string | undefined): string {
  if (typeof code !== "string") return "provider-failed";
  const normalized = code.trim().toLowerCase();
  return /^[a-z0-9][a-z0-9-]{0,63}$/.test(normalized) ? normalized : "provider-failed";
}

function transition(
  state: FateKnotsForgeInternalState,
  patch: Partial<FateKnotsForgeInternalState>
): void {
  Object.assign(state, patch, { revision: state.revision + 1 });
}

function rejectedTransition(
  state: FateKnotsForgeInternalState,
  error: Extract<FateKnotsForgeTransitionResult, { ok: false }>["error"]
): FateKnotsForgeTransitionResult {
  return { ok: false, error, state: cloneHubSnapshot(state) };
}

/**
 * Provider-neutral World Forge lifecycle.
 *
 * The orchestrator never stores the candidate Universe Package. Provider output
 * is passed directly into the host-only acceptance gate after the lifecycle has
 * entered `validating`, then discarded. The Hub projection intentionally exposes
 * only lifecycle metadata; prompts, candidate canon and validation details stay
 * host-side.
 */
export function createFateKnotsForgeOrchestrator(
  api: FateKnotsPersistenceApi
): FateKnotsForgeOrchestrator {
  const state: FateKnotsForgeInternalState = {
    available: false,
    stage: "idle",
    revision: 0,
    requestId: null,
    acceptedUniverseId: null,
    failureCode: null,
  };

  return {
    getHubSnapshot() {
      return cloneHubSnapshot(state);
    },

    setAvailable(available: boolean) {
      if (state.available !== available) transition(state, { available });
      return cloneHubSnapshot(state);
    },

    begin(requestId: string) {
      const normalizedRequestId = normalizeRequestId(requestId);
      if (!normalizedRequestId) return rejectedTransition(state, "invalid-request-id");
      if (!state.available) return rejectedTransition(state, "forge-unavailable");
      if (state.stage === "generating" || state.stage === "validating") {
        return rejectedTransition(state, "forge-busy");
      }

      transition(state, {
        stage: "generating",
        requestId: normalizedRequestId,
        acceptedUniverseId: null,
        failureCode: null,
      });
      return { ok: true, state: cloneHubSnapshot(state) };
    },

    markValidating(requestId: string) {
      const normalizedRequestId = normalizeRequestId(requestId);
      if (!normalizedRequestId || normalizedRequestId !== state.requestId) {
        return rejectedTransition(state, "request-mismatch");
      }
      if (state.stage !== "generating") return rejectedTransition(state, "invalid-stage");

      transition(state, { stage: "validating", failureCode: null });
      return { ok: true, state: cloneHubSnapshot(state) };
    },

    complete(requestId: string, candidate: unknown) {
      const normalizedRequestId = normalizeRequestId(requestId);
      if (!normalizedRequestId || normalizedRequestId !== state.requestId) {
        return {
          ok: false,
          error: "request-mismatch",
          state: cloneHubSnapshot(state),
          acceptance: null,
        };
      }
      if (state.stage !== "validating") {
        return {
          ok: false,
          error: "invalid-stage",
          state: cloneHubSnapshot(state),
          acceptance: null,
        };
      }

      const acceptance = acceptFateKnotsForgeCandidate(api, candidate);
      if (!acceptance.ok) {
        transition(state, {
          stage: "failed",
          requestId: null,
          acceptedUniverseId: null,
          failureCode: acceptance.error,
        });
        return {
          ok: false,
          error: acceptance.error,
          state: cloneHubSnapshot(state),
          acceptance,
        };
      }

      transition(state, {
        stage: "accepted",
        requestId: null,
        acceptedUniverseId: acceptance.universeId,
        failureCode: null,
      });
      return { ok: true, state: cloneHubSnapshot(state), acceptance };
    },

    fail(requestId: string, code?: string) {
      const normalizedRequestId = normalizeRequestId(requestId);
      if (!normalizedRequestId || normalizedRequestId !== state.requestId) {
        return rejectedTransition(state, "request-mismatch");
      }
      if (state.stage !== "generating" && state.stage !== "validating") {
        return rejectedTransition(state, "invalid-stage");
      }

      transition(state, {
        stage: "failed",
        requestId: null,
        acceptedUniverseId: null,
        failureCode: normalizeFailureCode(code),
      });
      return { ok: true, state: cloneHubSnapshot(state) };
    },

    reset() {
      transition(state, {
        stage: "idle",
        requestId: null,
        acceptedUniverseId: null,
        failureCode: null,
      });
      return cloneHubSnapshot(state);
    },
  };
}
