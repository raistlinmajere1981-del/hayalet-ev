function toFlowLabel(flowState) {
  return flowState.replaceAll("_", " ").toLowerCase();
}
export function renderCoordinatorPanel(documentRef, state, options) {
  const strip = documentRef.createElement("section");
  strip.className = "forge-coordinator-strip";
  strip.dataset["forgePanel"] = "coordinator";
  strip.dataset["forgeUiState"] = options.flowState;
  const note = documentRef.createElement("p");
  note.className = "forge-coordinator-strip__note";
  note.textContent = state.pendingCommand !== null ? "Forge is finishing the current step." : options.note;
  const stats = documentRef.createElement("div");
  stats.className = "forge-coordinator-strip__stats";
  [
    `state ${toFlowLabel(options.flowState)}`,
    `waiting ${String(state.snapshot.coordinatorState.assignmentQueueTotal)}`,
    `answers ${String(state.snapshot.coordinatorState.completedResponseCount)}`,
    `decisions ${String(state.snapshot.coordinatorState.pendingConflictCount)}`,
    `handoff ${options.handoffLabel}`
  ].forEach((value) => {
    const chip = documentRef.createElement("span");
    chip.className = "forge-chip forge-chip--soft";
    chip.textContent = value;
    stats.append(chip);
  });
  if (state.snapshot.exportSummary.exportReady && state.snapshot.exports[0]?.filePath) {
    const exportHint = documentRef.createElement("span");
    exportHint.className = "forge-field__hint";
    exportHint.textContent = `Latest package: ${state.snapshot.exports[0].filePath}`;
    strip.append(exportHint);
  }
  strip.append(note, stats);
  return strip;
}
