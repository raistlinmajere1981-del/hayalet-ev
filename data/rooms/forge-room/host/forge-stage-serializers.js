function includeText(value) {
  const trimmed = typeof value === "string" ? value.trim() : "";
  return trimmed === "" ? void 0 : trimmed;
}
function includeArray(values) {
  if (Array.isArray(values) !== true) {
    return void 0;
  }
  const next = values.map((entry) => entry.trim()).filter((entry) => entry !== "");
  return next.length > 0 ? next : void 0;
}
function serializeGoal(goal) {
  return {
    id: goal.id,
    summary: goal.summary.trim(),
    ...includeText(goal.brief) ? { brief: goal.brief.trim() } : {},
    ...includeArray(goal.constraints) ? { constraints: includeArray(goal.constraints) } : {},
    ...includeArray(goal.acceptanceCriteria) ? { acceptanceCriteria: includeArray(goal.acceptanceCriteria) } : {},
    ...includeText(goal.targetRoomId) ? { targetRoomId: goal.targetRoomId.trim() } : {}
  };
}
function serializeSelectedOperatorProfile(profile, options = {}) {
  const skills = profile.skills.map((entry) => ({
    skillKey: entry.skillKey,
    label: entry.label,
    level: entry.level,
    ...options.includeNotes === true && includeText(entry.notes) ? { notes: entry.notes?.trim() } : {}
  }));
  const equipment = profile.equipment.map((entry) => ({
    equipmentKey: entry.equipmentKey,
    label: entry.label,
    status: entry.status,
    ...options.includeEquipmentBrandModel === true && includeText(entry.brandModel) ? { brandModel: entry.brandModel?.trim() } : {},
    ...options.includeNotes === true && includeText(entry.notes) ? { notes: entry.notes?.trim() } : {}
  }));
  const preferences = {
    ...includeText(profile.preferences.mode) ? { mode: profile.preferences.mode } : {},
    ...includeText(profile.preferences.riskTolerance) ? { riskTolerance: profile.preferences.riskTolerance } : {}
  };
  return {
    ...skills.length > 0 ? { skills } : {},
    ...equipment.length > 0 ? { equipment } : {},
    ...Object.keys(preferences).length > 0 ? { preferences } : {}
  };
}
function serializeRunOverride(runOverride, options = {}) {
  if (runOverride === null) {
    return void 0;
  }
  const serialized = {
    ...runOverride.architectSeatId ? { architectSeatId: runOverride.architectSeatId } : {},
    ...runOverride.enableRovoPreAnalysis === true ? { enableRovoPreAnalysis: true } : {},
    ...runOverride.mode ? { mode: runOverride.mode } : {},
    ...runOverride.riskTolerance ? { riskTolerance: runOverride.riskTolerance } : {},
    ...includeArray(runOverride.temporaryConditions) ? { temporaryConditions: includeArray(runOverride.temporaryConditions) } : {},
    ...options.includeNotes === true && includeText(runOverride.notes) ? { notes: runOverride.notes.trim() } : {}
  };
  return Object.keys(serialized).length > 0 ? serialized : void 0;
}
function serializeArchitectureSummary(summary) {
  if (summary === null) {
    return void 0;
  }
  return {
    summary: summary.summary,
    exportBoundary: summary.exportBoundary,
    storageBoundary: summary.storageBoundary,
    ...summary.relevantModules.length > 0 ? { relevantModules: summary.relevantModules } : {}
  };
}
function serializeCapabilityContext(capabilityContext) {
  if (capabilityContext === null) {
    return void 0;
  }
  return {
    summary: capabilityContext.summary,
    ...capabilityContext.selectedTags.length > 0 ? { selectedTags: capabilityContext.selectedTags } : {},
    ...capabilityContext.items.length > 0 ? {
      items: capabilityContext.items.map((entry) => ({
        id: entry.id,
        title: entry.title,
        summary: entry.summary
      }))
    } : {}
  };
}
function serializeTargetRoomContext(targetRoomContext) {
  if (targetRoomContext === null) {
    return void 0;
  }
  return {
    targetRoomId: targetRoomContext.targetRoomId,
    summary: targetRoomContext.summary,
    ...targetRoomContext.constraints.length > 0 ? { constraints: targetRoomContext.constraints } : {}
  };
}
function serializeContextCapsule(capsule) {
  if (capsule === null) {
    return void 0;
  }
  return includeText(capsule.summary) ? { summary: capsule.summary.trim() } : void 0;
}
function serializeTask(task) {
  return {
    id: task.id,
    title: task.title,
    summary: task.summary,
    dispatchMode: task.dispatchMode,
    ...task.executionKind !== "task" ? { executionKind: task.executionKind } : {},
    ...task.dependsOnTaskIds.length > 0 ? { dependsOnTaskIds: task.dependsOnTaskIds } : {},
    ...task.seatId ? { seatId: task.seatId } : {},
    ...task.roleId ? { roleId: task.roleId } : {},
    ...task.compareSeatIds.length > 0 ? { compareSeatIds: task.compareSeatIds } : {},
    ...task.personaPresetId ? { personaPresetId: task.personaPresetId } : {}
  };
}
function serializePreflightBundle(bundle) {
  if (bundle === null) {
    return void 0;
  }
  return {
    runId: bundle.runId,
    contextDigest: bundle.contextDigest,
    sessionRevision: bundle.sessionRevision,
    preflightId: bundle.preflightId,
    ...bundle.constraints.length > 0 ? { constraints: bundle.constraints } : {},
    ...serializeTargetRoomContext(bundle.targetRoomContext) ? { targetRoomContext: serializeTargetRoomContext(bundle.targetRoomContext) } : {},
    ...bundle.rovoPreAnalysis?.summary ? { ai0Summary: bundle.rovoPreAnalysis.summary } : {}
  };
}
export function serializeForAI0(params) {
  return {
    runId: params.runId,
    contextDigest: params.contextDigest,
    sessionRevision: params.sessionRevision,
    goal: serializeGoal(params.goal),
    ...serializeTargetRoomContext(params.targetRoomContext) ? { targetRoomContext: serializeTargetRoomContext(params.targetRoomContext) } : {},
    ...serializeArchitectureSummary(params.appArchitectureSummary) ? { appArchitecture: serializeArchitectureSummary(params.appArchitectureSummary) } : {},
    ...serializeCapabilityContext(params.capabilityContext) ? { capabilityContext: serializeCapabilityContext(params.capabilityContext) } : {},
    ...Object.keys(serializeSelectedOperatorProfile(params.selectedOperatorProfile)).length > 0 ? {
      selectedOperatorProfile: serializeSelectedOperatorProfile(params.selectedOperatorProfile)
    } : {},
    ...serializeRunOverride(params.runOverride) ? { runOverride: serializeRunOverride(params.runOverride) } : {},
    ...params.constraints.length > 0 ? { constraints: params.constraints } : {}
  };
}
export function serializeForAI1(params) {
  return {
    ...params.goal ? { goal: serializeGoal(params.goal) } : {},
    ...serializePreflightBundle(params.bundle) ? { preflight: serializePreflightBundle(params.bundle) } : {},
    ...params.task ? { task: serializeTask(params.task) } : {},
    ...serializeContextCapsule(params.taskContextCapsule ?? null) ? { taskContext: serializeContextCapsule(params.taskContextCapsule ?? null) } : {},
    ...params.decisionTrace.length > 0 ? { decisionTrace: params.decisionTrace } : {}
  };
}
export function serializeForAI2(params) {
  return serializeForAI1(params);
}
export function serializeForExport(params) {
  return {
    goal: serializeGoal(params.goal),
    approvedTasks: params.approvedTasks.map((task) => serializeTask(task)),
    assignments: params.assignments.map((assignment) => ({
      taskId: assignment.taskId,
      seatId: assignment.seatId,
      roleId: assignment.roleId,
      ...assignment.personaPresetId ? { personaPresetId: assignment.personaPresetId } : {}
    })),
    conflicts: params.conflicts.map((conflict) => ({
      id: conflict.id,
      taskId: conflict.taskId,
      kind: conflict.kind,
      status: conflict.status,
      summary: conflict.summary,
      responseIds: conflict.responseIds,
      ...includeText(conflict.preferredResponseId) ? { preferredResponseId: conflict.preferredResponseId } : {},
      ...includeText(conflict.resolutionNote) ? { resolutionNote: conflict.resolutionNote } : {}
    })),
    synthesis: {
      id: params.synthesis.id,
      summary: params.synthesis.summary,
      body: params.synthesis.body,
      sourceTaskIds: params.synthesis.sourceTaskIds,
      selectedResponseIds: params.synthesis.selectedResponseIds,
      unresolvedConflictIds: params.synthesis.unresolvedConflictIds,
      decisionTrace: params.synthesis.decisionTrace,
      acceptanceCriteria: params.synthesis.acceptanceCriteria,
      openQuestions: params.synthesis.openQuestions,
      ...params.synthesis.provenance ? { provenance: params.synthesis.provenance } : {}
    }
  };
}
