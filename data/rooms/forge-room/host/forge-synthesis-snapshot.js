import {
  createForgeId,
  createImmutableSnapshot,
  hashStableValue,
  nowIso
} from "./forge-runtime-support.js";
export function computeSnapshotHash(value) {
  return hashStableValue(value);
}
export function createSynthesisSnapshot(params) {
  const baseSnapshot = {
    approvedTasks: params.approvedTasks,
    assignments: params.assignments,
    conflicts: params.conflicts,
    createdAt: nowIso(),
    contextDigest: params.contextDigest,
    decisionTrace: params.decisionTrace,
    goal: params.goal,
    ownerScopeId: params.ownerScopeId,
    preflightId: params.preflightId,
    runId: params.runId,
    sessionRevision: params.sessionRevision,
    snapshotId: createForgeId("forge-snapshot"),
    synthesis: params.synthesis,
    synthesisId: params.synthesis.id
  };
  return createImmutableSnapshot({
    ...baseSnapshot,
    snapshotHash: computeSnapshotHash(baseSnapshot)
  });
}
export function exportFromSynthesisSnapshot(params) {
  return createImmutableSnapshot(params.buildPackage(params.snapshot));
}
