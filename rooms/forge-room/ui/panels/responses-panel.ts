import type { ForgeUiState } from "../../shared/ui/state.js";
import { createForgePanel } from "./panel-shell.js";

export function renderResponsesPanel(
  documentRef: Document,
  state: ForgeUiState,
  text: (path: string[], fallback: string) => string
): HTMLElement {
  const body = documentRef.createElement("div");
  body.className = "forge-panel__body";

  if (state.snapshot.responses.length === 0) {
    const empty = documentRef.createElement("p");
    empty.className = "forge-panel__hint";
    empty.textContent = text(["workbench", "states", "emptyResponses"], "Responses will appear here.");
    body.append(empty);
  } else {
    const list = documentRef.createElement("div");
    list.className = "forge-card-list";
    state.snapshot.responses.forEach((response) => {
      const card = documentRef.createElement("article");
      card.className = "forge-card";
      card.innerHTML = `
        <strong>${response.roleId} / ${response.seatId}</strong>
        <p>${response.summary}</p>
        <p>${response.body}</p>
      `;
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
