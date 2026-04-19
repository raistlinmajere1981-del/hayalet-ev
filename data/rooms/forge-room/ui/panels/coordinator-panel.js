function readSeatActorLabel(state, seatId) {
  if (seatId === "ai0") {
    return state.context.assistantNickname;
  }
  if (seatId === "ai1" || seatId === "ai2") {
    return state.context.draftArchitectSeats[seatId].nickname;
  }
  return seatId.toUpperCase();
}
function buildCoordinatorActivity(state, text) {
  const taskIndex = new Map(
    [...state.snapshot.draftTasks, ...state.snapshot.approvedTasks].map((task) => [task.id, task])
  );
  const items = [];
  const assistantOfflineMessage = text(
    ["workbench", "goalPanel", "preflight", "aiOffline"],
    "AI0 is offline"
  );
  const assistantReconnectMessage = text(
    ["workbench", "goalPanel", "preflight", "aiReconnect"],
    "AI0 will reconnect during preflight."
  );
  const normalizeAssistantStatus = (value) => {
    const trimmed = value?.trim() ?? "";
    if (trimmed === "" || trimmed.toLowerCase().includes("ai0") !== true) {
      return trimmed === "" ? null : trimmed;
    }
    if (state.context.assistantAssigned !== true) {
      return assistantOfflineMessage;
    }
    if (state.context.assistantConnected !== true) {
      return assistantReconnectMessage;
    }
    return trimmed;
  };
  if (state.pendingCommand !== null) {
    items.push({
      actor: "System",
      meta: state.pendingCommand,
      tone: "accent",
      summary: "Forge is finishing the current step."
    });
  }
  const preflight = state.snapshot.preflight;
  const preflightSummary = preflight.status === "running" ? "Preflight is preparing a compatibility read." : normalizeAssistantStatus(preflight.bundle?.rovoPreAnalysis?.summary ?? null) || normalizeAssistantStatus(preflight.errorMessage ?? null) || normalizeAssistantStatus(preflight.warnings[0] ?? null) || preflight.staleReason?.trim() || null;
  if (preflightSummary !== null && preflightSummary !== "" && preflightSummary !== assistantOfflineMessage && preflightSummary !== assistantReconnectMessage) {
    items.push({
      actor: state.context.assistantNickname,
      meta: preflight.status,
      tone: preflight.status === "warning" || preflight.status === "stale" ? "warning" : "soft",
      summary: preflightSummary
    });
  }
  state.snapshot.responses.slice(-3).reverse().forEach((response) => {
    const task = taskIndex.get(response.taskId) ?? null;
    items.push({
      actor: readSeatActorLabel(state, response.seatId),
      meta: task?.title ?? null,
      tone: response.status === "selected" ? "accent" : "soft",
      summary: response.summary.trim() || "Shared a new response."
    });
  });
  const selectedSynthesis = state.snapshot.syntheses.find((entry) => entry.id === state.snapshot.selectedSynthesisId) ?? null;
  if (selectedSynthesis !== null) {
    items.push({
      actor: "Coordinator",
      meta: "selected synthesis",
      tone: "accent",
      summary: selectedSynthesis.summary.trim() || "A synthesis is ready for export."
    });
  } else if (state.snapshot.exportSummary.exportReady) {
    items.push({
      actor: "Coordinator",
      meta: "handoff",
      tone: "accent",
      summary: "The handoff package is ready to export."
    });
  }
  return items.slice(0, 4);
}
export function renderCoordinatorPanel(documentRef, state, text, options) {
  const strip = documentRef.createElement("section");
  strip.className = "forge-coordinator-strip";
  strip.dataset["forgePanel"] = "coordinator";
  strip.dataset["forgeUiState"] = options.flowState;
  const overview = documentRef.createElement("div");
  overview.className = "forge-coordinator-strip__overview";
  const note = documentRef.createElement("p");
  note.className = "forge-coordinator-strip__note";
  note.textContent = state.pendingCommand !== null ? text(["workbench", "coordinator", "pending"], "Forge is finishing the current step.") : options.note;
  overview.append(note);
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
  overview.append(stats);
  const activityWrap = documentRef.createElement("section");
  activityWrap.className = "forge-activity-feed";
  const activityTitle = documentRef.createElement("strong");
  activityTitle.className = "forge-activity-feed__title";
  activityTitle.textContent = text(["workbench", "coordinator", "activityTitle"], "Activity");
  activityWrap.append(activityTitle);
  const activityItems = buildCoordinatorActivity(state, text);
  const activityList = documentRef.createElement("div");
  activityList.className = "forge-activity-feed__list";
  activityItems.forEach((item) => {
    const activity = documentRef.createElement("article");
    activity.className = "forge-activity-item";
    activity.dataset["tone"] = item.tone;
    const head = documentRef.createElement("div");
    head.className = "forge-activity-item__head";
    const actor = documentRef.createElement("strong");
    actor.className = "forge-activity-item__actor";
    actor.textContent = item.actor;
    head.append(actor);
    if (item.meta !== null) {
      const meta = documentRef.createElement("span");
      meta.className = "forge-activity-item__meta";
      meta.textContent = item.meta;
      head.append(meta);
    }
    const summary = documentRef.createElement("p");
    summary.className = "forge-activity-item__summary";
    summary.textContent = item.summary;
    activity.append(head, summary);
    activityList.append(activity);
  });
  activityWrap.append(activityList);
  if (state.snapshot.exportSummary.exportReady && state.snapshot.exports[0]?.filePath) {
    const exportHint = documentRef.createElement("span");
    exportHint.className = "forge-field__hint";
    exportHint.textContent = text(
      ["workbench", "coordinator", "latestPackage"],
      "Latest package: {path}",
      { path: state.snapshot.exports[0].filePath }
    );
    overview.append(exportHint);
  }
  strip.append(overview, activityWrap);
  return strip;
}
