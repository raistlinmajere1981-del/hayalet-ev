import type { ForgeUiState } from "../../shared/ui/state.js";
import { createForgePanel } from "./panel-shell.js";

export function renderCoordinatorPanel(
  documentRef: Document,
  state: ForgeUiState,
  text: (path: string[], fallback: string) => string
): HTMLElement {
  const body = documentRef.createElement("div");
  body.className = "forge-panel__body forge-coordinator-panel";

  const statusList = documentRef.createElement("dl");
  statusList.className = "forge-stats";
  statusList.innerHTML = `
    <div><dt>Plan</dt><dd>${state.snapshot.coordinatorState.planStatus}</dd></div>
    <div><dt>Queued</dt><dd>${String(state.snapshot.coordinatorState.assignmentQueueTotal)}</dd></div>
    <div><dt>Pending</dt><dd>${String(state.snapshot.coordinatorState.pendingAssignmentCount)}</dd></div>
    <div><dt>Responses</dt><dd>${String(state.snapshot.coordinatorState.completedResponseCount)}</dd></div>
    <div><dt>Conflicts</dt><dd>${String(state.snapshot.coordinatorState.pendingConflictCount)}</dd></div>
    <div><dt>Synthesis</dt><dd>${state.snapshot.coordinatorState.synthesisStatus}</dd></div>
    <div><dt>Export</dt><dd>${state.snapshot.coordinatorState.exportReady ? "ready" : "blocked"}</dd></div>
  `;

  const note = documentRef.createElement("p");
  note.className = "forge-panel__hint";
  note.textContent = state.snapshot.coordinatorState.note || "Coordinator is monitoring the room-local orchestration state.";

  const lastCommand = documentRef.createElement("p");
  lastCommand.className = "forge-panel__hint";
  lastCommand.textContent = state.pendingCommand
    ? `Pending: ${state.pendingCommand}`
    : state.lastCommandResult
    ? `${state.lastCommandResult.command}: ${state.lastCommandResult.success ? "ok" : state.lastCommandResult.message || "failed"}`
    : "No room command has been issued yet.";

  const lastExport = documentRef.createElement("p");
  lastExport.className = "forge-panel__hint";
  lastExport.textContent = state.snapshot.coordinatorState.lastExportPath
    ? `Last export: ${state.snapshot.coordinatorState.lastExportPath}`
    : "No handoff export has been produced yet.";

  const sessionList = documentRef.createElement("div");
  sessionList.className = "forge-session-list";
  if (state.snapshot.sessionList.length === 0) {
    const empty = documentRef.createElement("p");
    empty.className = "forge-panel__hint";
    empty.textContent = text(["workbench", "states", "emptySessions"], "No saved sessions yet.");
    sessionList.append(empty);
  } else {
    const list = documentRef.createElement("ol");
    list.className = "forge-list";
    state.snapshot.sessionList.forEach((session) => {
      const item = documentRef.createElement("li");
      item.className = "forge-list__item";
      item.innerHTML = `<strong>${session.title}</strong><span>${session.updatedAt}</span>`;
      list.append(item);
    });
    sessionList.append(list);
  }

  body.append(statusList, note, lastCommand, lastExport, sessionList);
  return createForgePanel(documentRef, {
    panelId: "coordinator",
    eyebrow: "Local actor",
    title: text(["workbench", "panels", "coordinator"], "Coordinator"),
    body,
  });
}
