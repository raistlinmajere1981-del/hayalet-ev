import type { ForgeUiState } from "../../shared/ui/state.js";
import { createForgePanel } from "./panel-shell.js";

export function renderResponsesPanel(
  documentRef: Document,
  state: ForgeUiState,
  text: (path: string[], fallback: string) => string
): HTMLElement {
  const body = documentRef.createElement("div");
  body.className = "forge-panel__body";
  const taskCatalog = new Map(
    [...state.snapshot.approvedTasks, ...state.snapshot.draftTasks]
      .filter((task) => task.level === 1)
      .map((task) => [task.id, task])
  );

  if (state.snapshot.responses.length === 0) {
    const empty = documentRef.createElement("p");
    empty.className = "forge-panel__hint";
    empty.textContent = text(
      ["workbench", "states", "emptyResponses"],
      "Responses will appear here."
    );
    body.append(empty);
  } else {
    const list = documentRef.createElement("div");
    list.className = "forge-card-list";
    const groupedResponses = new Map<string, typeof state.snapshot.responses>();
    state.snapshot.responses.forEach((response) => {
      const existing = groupedResponses.get(response.taskId) ?? [];
      existing.push(response);
      groupedResponses.set(response.taskId, existing);
    });

    groupedResponses.forEach((responses, taskId) => {
      const task = taskCatalog.get(taskId);
      const card = documentRef.createElement("article");
      card.className = "forge-card forge-card--response-group";

      const header = documentRef.createElement("div");
      header.className = "forge-card__header";

      const title = documentRef.createElement("strong");
      title.textContent = task?.title ?? "Response";

      const summary = documentRef.createElement("span");
      summary.textContent = task?.summary ?? `${String(responses.length)} response item(s)`;

      header.append(title, summary);
      card.append(header);

      const options = documentRef.createElement("div");
      options.className = "forge-response-options";

      responses.forEach((response) => {
        const option = documentRef.createElement("article");
        option.className = "forge-response-option";

        const optionHead = documentRef.createElement("div");
        optionHead.className = "forge-response-option__head";

        const seat = documentRef.createElement("span");
        seat.className = "forge-chip";
        seat.textContent = response.seatId;

        const role = documentRef.createElement("span");
        role.className = "forge-chip forge-chip--soft";
        role.textContent = response.roleId;

        optionHead.append(seat, role);

        const responseSummary = documentRef.createElement("strong");
        responseSummary.textContent = response.summary;

        const responseBody = documentRef.createElement("p");
        responseBody.className = "forge-response-option__body";
        responseBody.textContent = response.body;

        option.append(optionHead, responseSummary, responseBody);
        options.append(option);
      });

      card.append(options);
      list.append(card);
    });
    body.append(list);
  }

  return createForgePanel(documentRef, {
    panelId: "responses",
    title: text(["workbench", "panels", "responses"], "Responses"),
    body,
  });
}
