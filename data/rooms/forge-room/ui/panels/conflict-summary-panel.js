import { createForgePanel } from "./panel-shell.js";
export function renderConflictSummaryPanel(documentRef, state, text) {
  const body = documentRef.createElement("div");
  body.className = "forge-panel__body";
  const responseIndex = new Map(
    state.snapshot.responses.map((response) => [response.id, response])
  );
  const taskCatalog = new Map(
    [...state.snapshot.approvedTasks, ...state.snapshot.draftTasks].filter((task) => task.level === 1).map((task) => [task.id, task])
  );
  if (state.snapshot.conflicts.length === 0) {
    const empty = documentRef.createElement("p");
    empty.className = "forge-panel__hint";
    empty.textContent = text(
      ["workbench", "states", "emptyConflicts"],
      "Conflict groups will appear here."
    );
    body.append(empty);
  } else {
    const list = documentRef.createElement("div");
    list.className = "forge-card-list";
    state.snapshot.conflicts.forEach((conflict) => {
      const task = taskCatalog.get(conflict.taskId);
      const item = documentRef.createElement("article");
      item.className = "forge-card forge-card--conflict";
      const header = documentRef.createElement("div");
      header.className = "forge-card__header";
      const title = documentRef.createElement("strong");
      title.textContent = task?.title ?? conflict.kind;
      const meta = documentRef.createElement("div");
      meta.className = "forge-flow-item__meta";
      const kind = documentRef.createElement("span");
      kind.className = "forge-chip forge-chip--warning";
      kind.textContent = conflict.kind;
      const status = documentRef.createElement("span");
      status.className = "forge-chip forge-chip--soft";
      status.textContent = conflict.status;
      meta.append(kind, status);
      header.append(title, meta);
      const summary = documentRef.createElement("p");
      summary.className = "forge-panel__hint";
      summary.textContent = conflict.summary;
      const options = documentRef.createElement("div");
      options.className = "forge-response-options";
      conflict.responseIds.forEach((responseId) => {
        const response = responseIndex.get(responseId);
        if (!response) {
          return;
        }
        const option = documentRef.createElement("article");
        option.className = "forge-response-option forge-response-option--conflict";
        const optionHead = documentRef.createElement("div");
        optionHead.className = "forge-response-option__head";
        const seat = documentRef.createElement("span");
        seat.className = "forge-chip";
        seat.textContent = response.seatId;
        const selectHint = documentRef.createElement("span");
        selectHint.className = "forge-chip forge-chip--soft";
        selectHint.textContent = `${response.roleId} option`;
        optionHead.append(seat, selectHint);
        const responseSummary = documentRef.createElement("strong");
        responseSummary.textContent = response.summary;
        const responseBody = documentRef.createElement("p");
        responseBody.className = "forge-response-option__body";
        responseBody.textContent = response.body;
        option.append(optionHead, responseSummary, responseBody);
        options.append(option);
      });
      item.append(header, summary, options);
      if (conflict.resolutionNote) {
        const note = documentRef.createElement("p");
        note.className = "forge-field__hint";
        note.textContent = conflict.resolutionNote;
        item.append(note);
      }
      list.append(item);
    });
    body.append(list);
  }
  return createForgePanel(documentRef, {
    panelId: "conflicts",
    title: text(["workbench", "panels", "conflicts"], "Conflict Summary"),
    body
  });
}
