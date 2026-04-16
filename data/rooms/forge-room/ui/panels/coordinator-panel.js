export function renderCoordinatorPanel(documentRef, state, text, options) {
  const strip = documentRef.createElement("section");
  strip.className = "forge-coordinator-strip";
  strip.dataset["forgePanel"] = "coordinator";
  strip.dataset["forgeUiState"] = options.flowState;
  const note = documentRef.createElement("p");
  note.className = "forge-coordinator-strip__note";
  note.textContent = state.pendingCommand !== null ? text(["workbench", "coordinator", "pending"], "Forge is finishing the current step.") : options.note;
  const stats = documentRef.createElement("div");
  stats.className = "forge-coordinator-strip__stats";
  [
    text(["workbench", "coordinator", "stats", "state"], "state {label}", {
      label: options.flowLabel
    }),
    text(["workbench", "coordinator", "stats", "waiting"], "waiting {count}", {
      count: state.snapshot.coordinatorState.assignmentQueueTotal
    }),
    text(["workbench", "coordinator", "stats", "answers"], "answers {count}", {
      count: state.snapshot.coordinatorState.completedResponseCount
    }),
    text(["workbench", "coordinator", "stats", "decisions"], "decisions {count}", {
      count: state.snapshot.coordinatorState.pendingConflictCount
    }),
    text(["workbench", "coordinator", "stats", "handoff"], "handoff {label}", {
      label: options.handoffLabel
    })
  ].forEach((value) => {
    const chip = documentRef.createElement("span");
    chip.className = "forge-chip forge-chip--soft";
    chip.textContent = value;
    stats.append(chip);
  });
  if (state.snapshot.exportSummary.exportReady && state.snapshot.exports[0]?.filePath) {
    const exportHint = documentRef.createElement("span");
    exportHint.className = "forge-field__hint";
    exportHint.textContent = text(
      ["workbench", "coordinator", "latestPackage"],
      "Latest package: {path}",
      { path: state.snapshot.exports[0].filePath }
    );
    strip.append(exportHint);
  }
  strip.append(note, stats);
  return strip;
}
