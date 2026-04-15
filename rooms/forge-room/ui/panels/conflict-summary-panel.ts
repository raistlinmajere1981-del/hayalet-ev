import type { ForgeUiState } from "../../shared/ui/state.js";
import { createForgePanel } from "./panel-shell.js";

export function renderConflictSummaryPanel(
  documentRef: Document,
  state: ForgeUiState,
  text: (path: string[], fallback: string) => string
): HTMLElement {
  const body = documentRef.createElement("div");
  body.className = "forge-panel__body";

  if (state.snapshot.conflicts.length === 0) {
    const empty = documentRef.createElement("p");
    empty.className = "forge-panel__hint";
    empty.textContent = text(
      ["workbench", "states", "emptyConflicts"],
      "Conflict groups will appear here."
    );
    body.append(empty);
  } else {
    const list = documentRef.createElement("ol");
    list.className = "forge-list";
    state.snapshot.conflicts.forEach((conflict) => {
      const item = documentRef.createElement("li");
      item.className = "forge-list__item";
      item.innerHTML = `<strong>${conflict.kind}</strong><span>${conflict.summary}</span><span>${conflict.responseIds.length} response(s)</span>`;
      list.append(item);
    });
    body.append(list);
  }

  return createForgePanel(documentRef, {
    panelId: "conflicts",
    title: text(["workbench", "panels", "conflicts"], "Conflict Summary"),
    body,
  });
}
