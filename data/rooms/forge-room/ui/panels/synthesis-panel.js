import { createForgePanel } from "./panel-shell.js";
export function renderSynthesisPanel(documentRef, state, text) {
  const body = documentRef.createElement("div");
  body.className = "forge-panel__body";
  const actionRail = documentRef.createElement("div");
  actionRail.className = "forge-actions forge-actions--stacked";
  const generateButton = documentRef.createElement("button");
  generateButton.type = "button";
  generateButton.className = "forge-button";
  generateButton.dataset["forgeAction"] = "generate-synthesis";
  generateButton.disabled = state.snapshot.responses.length === 0;
  generateButton.textContent = "Generate synthesis";
  actionRail.append(generateButton);
  const action = documentRef.createElement("button");
  action.type = "button";
  action.className = "forge-button";
  action.dataset["forgeAction"] = "handoff-check";
  action.textContent = text(["workbench", "actions", "checkHandoff"], "Check handoff");
  actionRail.append(action);
  const exportButton = documentRef.createElement("button");
  exportButton.type = "button";
  exportButton.className = "forge-button forge-button--primary";
  exportButton.dataset["forgeAction"] = "export-handoff";
  exportButton.disabled = state.snapshot.selectedSynthesisId === null;
  exportButton.textContent = "Export handoff";
  actionRail.append(exportButton);
  body.append(actionRail);
  if (state.snapshot.syntheses.length === 0) {
    const empty = documentRef.createElement("p");
    empty.className = "forge-panel__hint";
    empty.textContent = text(
      ["workbench", "states", "emptySynthesis"],
      "Synthesis outputs will appear here."
    );
    body.append(empty);
  } else {
    const list = documentRef.createElement("div");
    list.className = "forge-card-list";
    state.snapshot.syntheses.forEach((synthesis) => {
      const card = documentRef.createElement("article");
      card.className = "forge-card";
      card.dataset["selected"] = synthesis.id === state.snapshot.selectedSynthesisId ? "true" : "false";
      card.innerHTML = `
        <strong>${synthesis.summary}</strong>
        <p>${synthesis.body}</p>
        <p>Criteria: ${synthesis.acceptanceCriteria.join(" | ") || "none yet"}</p>
      `;
      const selectButton = documentRef.createElement("button");
      selectButton.type = "button";
      selectButton.className = "forge-button";
      selectButton.dataset["forgeSelectSynthesis"] = synthesis.id;
      selectButton.disabled = synthesis.id === state.snapshot.selectedSynthesisId;
      selectButton.textContent = synthesis.id === state.snapshot.selectedSynthesisId ? "Selected" : "Select synthesis";
      card.append(selectButton);
      list.append(card);
    });
    body.append(list);
  }
  if (state.snapshot.exports.length > 0) {
    const exportsList = documentRef.createElement("ol");
    exportsList.className = "forge-list";
    state.snapshot.exports.forEach((entry) => {
      const item = documentRef.createElement("li");
      item.className = "forge-list__item";
      item.innerHTML = `<strong>${entry.targetRoomId}</strong><span>${entry.filePath}</span>`;
      exportsList.append(item);
    });
    body.append(exportsList);
  }
  return createForgePanel(documentRef, {
    panelId: "synthesis",
    title: text(["workbench", "panels", "synthesis"], "Synthesis"),
    body
  });
}
