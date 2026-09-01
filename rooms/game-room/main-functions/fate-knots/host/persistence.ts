import {
  FATE_KNOTS_PHASES,
  FATE_KNOTS_SCHEMA_VERSION,
  type FateKnotsRunState,
  type FateKnotsUniversePackage,
} from "../shared/contracts.js";
import { normalizeFateKnotsUniversePackage } from "../forge/universe-validation.js";

export const FATE_KNOTS_PERSISTENCE_VERSION = 1;
export const FATE_KNOTS_UNIVERSE_LIBRARY_STATE_KEY = "fate-knots-universes-v1";
export const FATE_KNOTS_RUN_LIBRARY_STATE_KEY = "fate-knots-runs-v1";
export const FATE_KNOTS_SESSION_STATE_KEY = "fate-knots-session-v1";

export interface FateKnotsPersistenceApi {
  getState(key: string): unknown;
  setState(key: string, value: unknown): unknown;
}

export type FateKnotsPersistenceIssueCode =
  | "invalid-library"
  | "unsupported-storage-version"
  | "invalid-universe"
  | "duplicate-universe-id"
  | "invalid-run"
  | "duplicate-run-id"
  | "missing-universe"
  | "run-universe-mismatch"
  | "universe-has-runs"
  | "invalid-session-selection";

export interface FateKnotsPersistenceIssue {
  code: FateKnotsPersistenceIssueCode;
  stateKey: string;
  entryId?: string;
  detail?: string;
}

export interface FateKnotsUniverseLibraryState {
  storageVersion: number;
  universes: FateKnotsUniversePackage[];
}

export interface FateKnotsRunLibraryState {
  storageVersion: number;
  runs: FateKnotsRunState[];
}

export interface FateKnotsSessionState {
  storageVersion: number;
  activeUniverseId: string | null;
  activeRunId: string | null;
}

export interface FateKnotsPersistenceRead<T> {
  value: T;
  issues: FateKnotsPersistenceIssue[];
}

export type FateKnotsPersistenceWrite<T> =
  | { ok: true; value: T; issues: [] }
  | { ok: false; value: null; issues: FateKnotsPersistenceIssue[] };

type GenericRecord = Record<string, unknown>;

function isRecord(value: unknown): value is GenericRecord {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function isNullableString(value: unknown): value is string | null {
  return value === null || isNonEmptyString(value);
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((entry) => typeof entry === "string");
}

function cloneJson<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function issue(
  code: FateKnotsPersistenceIssueCode,
  stateKey: string,
  entryId?: string,
  detail?: string
): FateKnotsPersistenceIssue {
  return {
    code,
    stateKey,
    ...(entryId ? { entryId } : {}),
    ...(detail ? { detail } : {}),
  };
}

function emptyUniverseLibrary(): FateKnotsUniverseLibraryState {
  return { storageVersion: FATE_KNOTS_PERSISTENCE_VERSION, universes: [] };
}

function emptyRunLibrary(): FateKnotsRunLibraryState {
  return { storageVersion: FATE_KNOTS_PERSISTENCE_VERSION, runs: [] };
}

export function createEmptyFateKnotsSessionState(): FateKnotsSessionState {
  return {
    storageVersion: FATE_KNOTS_PERSISTENCE_VERSION,
    activeUniverseId: null,
    activeRunId: null,
  };
}

function validateEnvelope(
  candidate: unknown,
  stateKey: string,
  collectionKey: "universes" | "runs"
): { source: GenericRecord | null; issues: FateKnotsPersistenceIssue[] } {
  if (candidate === undefined || candidate === null) return { source: null, issues: [] };
  if (!isRecord(candidate)) {
    return { source: null, issues: [issue("invalid-library", stateKey)] };
  }
  if (candidate["storageVersion"] !== FATE_KNOTS_PERSISTENCE_VERSION) {
    return {
      source: null,
      issues: [
        issue(
          "unsupported-storage-version",
          stateKey,
          undefined,
          String(candidate["storageVersion"])
        ),
      ],
    };
  }
  if (!Array.isArray(candidate[collectionKey])) {
    return {
      source: null,
      issues: [issue("invalid-library", stateKey, undefined, collectionKey)],
    };
  }
  return { source: candidate, issues: [] };
}

export function readFateKnotsUniverseLibrary(
  api: FateKnotsPersistenceApi
): FateKnotsPersistenceRead<FateKnotsUniverseLibraryState> {
  const raw = api.getState(FATE_KNOTS_UNIVERSE_LIBRARY_STATE_KEY);
  const envelope = validateEnvelope(raw, FATE_KNOTS_UNIVERSE_LIBRARY_STATE_KEY, "universes");
  if (!envelope.source) return { value: emptyUniverseLibrary(), issues: envelope.issues };

  const universes: FateKnotsUniversePackage[] = [];
  const issues = envelope.issues.slice();
  const seen = new Set<string>();
  const entries = envelope.source["universes"] as unknown[];

  entries.forEach((entry, index) => {
    const normalized = normalizeFateKnotsUniversePackage(entry);
    if (!normalized.valid || !normalized.package) {
      const detail = normalized.issues
        .slice(0, 5)
        .map((validationIssue) => `${validationIssue.code}:${validationIssue.path}`)
        .join(",");
      issues.push(
        issue(
          "invalid-universe",
          FATE_KNOTS_UNIVERSE_LIBRARY_STATE_KEY,
          isRecord(entry) && isNonEmptyString(entry["universeId"])
            ? entry["universeId"]
            : `index:${index}`,
          detail
        )
      );
      return;
    }

    if (seen.has(normalized.package.universeId)) {
      issues.push(
        issue(
          "duplicate-universe-id",
          FATE_KNOTS_UNIVERSE_LIBRARY_STATE_KEY,
          normalized.package.universeId
        )
      );
      return;
    }
    seen.add(normalized.package.universeId);
    universes.push(normalized.package);
  });

  return {
    value: { storageVersion: FATE_KNOTS_PERSISTENCE_VERSION, universes },
    issues,
  };
}

function isPersistableRunState(candidate: unknown): candidate is FateKnotsRunState {
  if (!isRecord(candidate)) return false;
  if (candidate["schemaVersion"] !== FATE_KNOTS_SCHEMA_VERSION) return false;
  if (!isNonEmptyString(candidate["runId"]) || !isNonEmptyString(candidate["universeId"])) {
    return false;
  }
  if (
    typeof candidate["phase"] !== "string" ||
    !FATE_KNOTS_PHASES.includes(candidate["phase"] as (typeof FATE_KNOTS_PHASES)[number])
  ) {
    return false;
  }
  if (
    typeof candidate["revision"] !== "number" ||
    !Number.isInteger(candidate["revision"]) ||
    candidate["revision"] < 0
  ) {
    return false;
  }
  if (!isNullableString(candidate["activeLocationId"])) return false;
  if (!isStringArray(candidate["revealedLocationIds"])) return false;
  if (!isStringArray(candidate["revealedKnotIds"])) return false;
  if (!isStringArray(candidate["completedKnotIds"])) return false;
  if (!isStringArray(candidate["partyActorIds"])) return false;
  if (!Array.isArray(candidate["actors"])) return false;
  if (!isStringArray(candidate["teamPoolItemIds"])) return false;
  if (candidate["activeCombat"] !== null && !isRecord(candidate["activeCombat"])) return false;
  if (typeof candidate["finaleUnlocked"] !== "boolean") return false;
  return (
    candidate["result"] === "active" ||
    candidate["result"] === "completed" ||
    candidate["result"] === "failed"
  );
}

export function readFateKnotsRunLibrary(
  api: FateKnotsPersistenceApi
): FateKnotsPersistenceRead<FateKnotsRunLibraryState> {
  const raw = api.getState(FATE_KNOTS_RUN_LIBRARY_STATE_KEY);
  const envelope = validateEnvelope(raw, FATE_KNOTS_RUN_LIBRARY_STATE_KEY, "runs");
  if (!envelope.source) return { value: emptyRunLibrary(), issues: envelope.issues };

  const runs: FateKnotsRunState[] = [];
  const issues = envelope.issues.slice();
  const seen = new Set<string>();
  const entries = envelope.source["runs"] as unknown[];

  entries.forEach((entry, index) => {
    if (!isPersistableRunState(entry)) {
      issues.push(
        issue(
          "invalid-run",
          FATE_KNOTS_RUN_LIBRARY_STATE_KEY,
          isRecord(entry) && isNonEmptyString(entry["runId"])
            ? entry["runId"]
            : `index:${index}`
        )
      );
      return;
    }
    const runId = entry.runId.trim();
    if (seen.has(runId)) {
      issues.push(issue("duplicate-run-id", FATE_KNOTS_RUN_LIBRARY_STATE_KEY, runId));
      return;
    }
    seen.add(runId);
    runs.push(cloneJson({ ...entry, runId, universeId: entry.universeId.trim() }));
  });

  return {
    value: { storageVersion: FATE_KNOTS_PERSISTENCE_VERSION, runs },
    issues,
  };
}

export function readFateKnotsSessionState(
  api: FateKnotsPersistenceApi
): FateKnotsPersistenceRead<FateKnotsSessionState> {
  const raw = api.getState(FATE_KNOTS_SESSION_STATE_KEY);
  if (raw === undefined || raw === null) {
    return { value: createEmptyFateKnotsSessionState(), issues: [] };
  }
  if (
    !isRecord(raw) ||
    raw["storageVersion"] !== FATE_KNOTS_PERSISTENCE_VERSION ||
    !isNullableString(raw["activeUniverseId"]) ||
    !isNullableString(raw["activeRunId"])
  ) {
    return {
      value: createEmptyFateKnotsSessionState(),
      issues: [issue("invalid-session-selection", FATE_KNOTS_SESSION_STATE_KEY)],
    };
  }
  return {
    value: {
      storageVersion: FATE_KNOTS_PERSISTENCE_VERSION,
      activeUniverseId:
        typeof raw["activeUniverseId"] === "string" ? raw["activeUniverseId"].trim() : null,
      activeRunId: typeof raw["activeRunId"] === "string" ? raw["activeRunId"].trim() : null,
    },
    issues: [],
  };
}

function refuseOnReadIssues<T>(
  read: FateKnotsPersistenceRead<T>
): FateKnotsPersistenceWrite<T> | null {
  return read.issues.length > 0 ? { ok: false, value: null, issues: read.issues } : null;
}

export function saveFateKnotsUniverse(
  api: FateKnotsPersistenceApi,
  candidate: unknown
): FateKnotsPersistenceWrite<FateKnotsUniversePackage> {
  const libraryRead = readFateKnotsUniverseLibrary(api);
  const refused = refuseOnReadIssues(libraryRead);
  if (refused) return { ok: false, value: null, issues: refused.issues };

  const normalized = normalizeFateKnotsUniversePackage(candidate);
  if (!normalized.valid || !normalized.package) {
    return {
      ok: false,
      value: null,
      issues: normalized.issues.map((validationIssue) =>
        issue(
          "invalid-universe",
          FATE_KNOTS_UNIVERSE_LIBRARY_STATE_KEY,
          undefined,
          `${validationIssue.code}:${validationIssue.path}`
        )
      ),
    };
  }

  const nextUniverses = libraryRead.value.universes.filter(
    (universe) => universe.universeId !== normalized.package?.universeId
  );
  nextUniverses.push(normalized.package);
  api.setState(FATE_KNOTS_UNIVERSE_LIBRARY_STATE_KEY, {
    storageVersion: FATE_KNOTS_PERSISTENCE_VERSION,
    universes: nextUniverses,
  } satisfies FateKnotsUniverseLibraryState);
  return { ok: true, value: normalized.package, issues: [] };
}

export function saveFateKnotsRun(
  api: FateKnotsPersistenceApi,
  candidate: unknown
): FateKnotsPersistenceWrite<FateKnotsRunState> {
  if (!isPersistableRunState(candidate)) {
    return {
      ok: false,
      value: null,
      issues: [issue("invalid-run", FATE_KNOTS_RUN_LIBRARY_STATE_KEY)],
    };
  }

  const universeRead = readFateKnotsUniverseLibrary(api);
  const universeRefused = refuseOnReadIssues(universeRead);
  if (universeRefused) return { ok: false, value: null, issues: universeRefused.issues };
  const universeId = candidate.universeId.trim();
  if (!universeRead.value.universes.some((universe) => universe.universeId === universeId)) {
    return {
      ok: false,
      value: null,
      issues: [issue("missing-universe", FATE_KNOTS_RUN_LIBRARY_STATE_KEY, universeId)],
    };
  }

  const runRead = readFateKnotsRunLibrary(api);
  const runRefused = refuseOnReadIssues(runRead);
  if (runRefused) return { ok: false, value: null, issues: runRefused.issues };
  const runId = candidate.runId.trim();
  const previous = runRead.value.runs.find((run) => run.runId === runId);
  if (previous && previous.universeId !== universeId) {
    return {
      ok: false,
      value: null,
      issues: [issue("run-universe-mismatch", FATE_KNOTS_RUN_LIBRARY_STATE_KEY, runId)],
    };
  }

  const stored = cloneJson({ ...candidate, runId, universeId });
  const nextRuns = runRead.value.runs.filter((run) => run.runId !== runId);
  nextRuns.push(stored);
  api.setState(FATE_KNOTS_RUN_LIBRARY_STATE_KEY, {
    storageVersion: FATE_KNOTS_PERSISTENCE_VERSION,
    runs: nextRuns,
  } satisfies FateKnotsRunLibraryState);
  return { ok: true, value: stored, issues: [] };
}

export function deleteFateKnotsRun(
  api: FateKnotsPersistenceApi,
  runId: string
): FateKnotsPersistenceWrite<FateKnotsRunLibraryState> {
  const runRead = readFateKnotsRunLibrary(api);
  const refused = refuseOnReadIssues(runRead);
  if (refused) return { ok: false, value: null, issues: refused.issues };
  const normalizedRunId = runId.trim();
  const next = {
    storageVersion: FATE_KNOTS_PERSISTENCE_VERSION,
    runs: runRead.value.runs.filter((run) => run.runId !== normalizedRunId),
  } satisfies FateKnotsRunLibraryState;
  api.setState(FATE_KNOTS_RUN_LIBRARY_STATE_KEY, next);
  return { ok: true, value: next, issues: [] };
}

export function deleteFateKnotsUniverse(
  api: FateKnotsPersistenceApi,
  universeId: string
): FateKnotsPersistenceWrite<FateKnotsUniverseLibraryState> {
  const universeRead = readFateKnotsUniverseLibrary(api);
  const universeRefused = refuseOnReadIssues(universeRead);
  if (universeRefused) return { ok: false, value: null, issues: universeRefused.issues };
  const runRead = readFateKnotsRunLibrary(api);
  const runRefused = refuseOnReadIssues(runRead);
  if (runRefused) return { ok: false, value: null, issues: runRefused.issues };

  const normalizedUniverseId = universeId.trim();
  if (runRead.value.runs.some((run) => run.universeId === normalizedUniverseId)) {
    return {
      ok: false,
      value: null,
      issues: [
        issue(
          "universe-has-runs",
          FATE_KNOTS_UNIVERSE_LIBRARY_STATE_KEY,
          normalizedUniverseId
        ),
      ],
    };
  }

  const next = {
    storageVersion: FATE_KNOTS_PERSISTENCE_VERSION,
    universes: universeRead.value.universes.filter(
      (universe) => universe.universeId !== normalizedUniverseId
    ),
  } satisfies FateKnotsUniverseLibraryState;
  api.setState(FATE_KNOTS_UNIVERSE_LIBRARY_STATE_KEY, next);
  return { ok: true, value: next, issues: [] };
}

export function saveFateKnotsSessionSelection(
  api: FateKnotsPersistenceApi,
  selection: { activeUniverseId: string | null; activeRunId: string | null }
): FateKnotsPersistenceWrite<FateKnotsSessionState> {
  const universeRead = readFateKnotsUniverseLibrary(api);
  const universeRefused = refuseOnReadIssues(universeRead);
  if (universeRefused) return { ok: false, value: null, issues: universeRefused.issues };
  const runRead = readFateKnotsRunLibrary(api);
  const runRefused = refuseOnReadIssues(runRead);
  if (runRefused) return { ok: false, value: null, issues: runRefused.issues };

  const activeUniverseId = selection.activeUniverseId?.trim() || null;
  const activeRunId = selection.activeRunId?.trim() || null;
  if (
    activeUniverseId !== null &&
    !universeRead.value.universes.some((universe) => universe.universeId === activeUniverseId)
  ) {
    return {
      ok: false,
      value: null,
      issues: [
        issue("invalid-session-selection", FATE_KNOTS_SESSION_STATE_KEY, activeUniverseId),
      ],
    };
  }

  const activeRun =
    activeRunId === null ? null : runRead.value.runs.find((run) => run.runId === activeRunId) ?? null;
  if (activeRunId !== null && activeRun === null) {
    return {
      ok: false,
      value: null,
      issues: [issue("invalid-session-selection", FATE_KNOTS_SESSION_STATE_KEY, activeRunId)],
    };
  }
  if (
    activeRun !== null &&
    activeUniverseId !== null &&
    activeRun.universeId !== activeUniverseId
  ) {
    return {
      ok: false,
      value: null,
      issues: [issue("run-universe-mismatch", FATE_KNOTS_SESSION_STATE_KEY, activeRun.runId)],
    };
  }

  const state: FateKnotsSessionState = {
    storageVersion: FATE_KNOTS_PERSISTENCE_VERSION,
    activeUniverseId: activeUniverseId ?? activeRun?.universeId ?? null,
    activeRunId,
  };
  api.setState(FATE_KNOTS_SESSION_STATE_KEY, state);
  return { ok: true, value: state, issues: [] };
}
