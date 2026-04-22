import { nowIso } from "./forge-runtime-support.js";
export function createEmptyForgeRunArtifactStore() {
  return {
    activeRunId: null,
    entries: []
  };
}
export function createForgeRunArtifacts(params) {
  const timestamp = nowIso();
  return {
    ai0PreAnalysis: null,
    contextDigest: params.contextDigest,
    createdAt: timestamp,
    decisionTrace: [],
    draftArtifacts: null,
    exportSnapshots: [],
    ownerScopeId: params.ownerScopeId,
    preflight: null,
    preflightId: null,
    reviewArtifacts: null,
    runId: params.runId,
    runSignature: params.runSignature,
    selectedContextCapsules: {},
    sessionRevision: params.sessionRevision,
    synthesisId: null,
    synthesisSnapshots: [],
    updatedAt: timestamp
  };
}
export function readForgeRunArtifacts(store, runId, ownerScopeId = null) {
  if (runId === null) {
    return null;
  }
  return store.entries.find(
    (entry) => entry.runId === runId && (ownerScopeId === null || entry.ownerScopeId === ownerScopeId)
  ) ?? null;
}
export function readForgeSynthesisSnapshot(store, synthesisId, ownerScopeId = null) {
  if (synthesisId === null) {
    return null;
  }
  for (const entry of store.entries) {
    if (ownerScopeId !== null && entry.ownerScopeId !== ownerScopeId) {
      continue;
    }
    const snapshot = entry.synthesisSnapshots.find((candidate) => candidate.synthesisId === synthesisId) ?? null;
    if (snapshot !== null) {
      return snapshot;
    }
  }
  return null;
}
export function upsertForgeRunArtifacts(store, nextEntry) {
  const existingIndex = store.entries.findIndex(
    (entry) => entry.runId === nextEntry.runId && entry.ownerScopeId === nextEntry.ownerScopeId
  );
  const entries = [...store.entries];
  if (existingIndex >= 0) {
    entries[existingIndex] = {
      ...nextEntry,
      updatedAt: nowIso()
    };
  } else {
    entries.push(nextEntry);
  }
  return {
    activeRunId: nextEntry.runId,
    entries
  };
}
export function withForgeRunPreflight(entry, preflight) {
  return {
    ...entry,
    ai0PreAnalysis: preflight.bundle?.rovoPreAnalysis ?? entry.ai0PreAnalysis,
    preflight,
    preflightId: preflight.preflightId ?? entry.preflightId,
    updatedAt: nowIso()
  };
}
export function withForgeRunDraftArtifacts(entry, payload) {
  return {
    ...entry,
    draftArtifacts: payload,
    updatedAt: nowIso()
  };
}
export function withForgeRunReviewArtifacts(entry, payload) {
  return {
    ...entry,
    reviewArtifacts: payload,
    updatedAt: nowIso()
  };
}
export function withForgeRunDecisionTrace(entry, decisionTrace) {
  return {
    ...entry,
    decisionTrace,
    updatedAt: nowIso()
  };
}
export function withForgeRunSelectedContextCapsule(entry, taskId, capsule) {
  return {
    ...entry,
    selectedContextCapsules: {
      ...entry.selectedContextCapsules,
      [taskId]: capsule
    },
    updatedAt: nowIso()
  };
}
export function withForgeSynthesisSnapshot(entry, snapshot) {
  return {
    ...entry,
    decisionTrace: snapshot.decisionTrace,
    synthesisId: snapshot.synthesisId,
    synthesisSnapshots: [...entry.synthesisSnapshots, snapshot],
    updatedAt: nowIso()
  };
}
export function withForgeExportSnapshot(entry, snapshot) {
  return {
    ...entry,
    exportSnapshots: [...entry.exportSnapshots, snapshot],
    updatedAt: nowIso()
  };
}
