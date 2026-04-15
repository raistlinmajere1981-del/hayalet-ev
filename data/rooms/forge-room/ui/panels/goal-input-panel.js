import { createForgePanel } from "./panel-shell.js";
export function renderGoalInputPanel(documentRef, state, text) {
  const body = documentRef.createElement("div");
  body.className = "forge-panel__body forge-goal-panel";
  const summaryInput = documentRef.createElement("input");
  summaryInput.id = "forge-goal-summary";
  summaryInput.className = "forge-input";
  summaryInput.placeholder = "Repair Room entegrasyonunu uret";
  summaryInput.value = state.snapshot.currentGoal?.summary ?? "";
  const briefInput = documentRef.createElement("textarea");
  briefInput.id = "forge-goal-brief";
  briefInput.className = "forge-textarea";
  briefInput.placeholder = "Goal brief";
  briefInput.value = state.snapshot.currentGoal?.brief ?? "";
  const constraintsInput = documentRef.createElement("textarea");
  constraintsInput.id = "forge-goal-constraints";
  constraintsInput.className = "forge-textarea forge-textarea--compact";
  constraintsInput.placeholder = "One constraint per line";
  constraintsInput.value = (state.snapshot.currentGoal?.constraints ?? []).join("\n");
  const targetRoomInput = documentRef.createElement("input");
  targetRoomInput.id = "forge-goal-target-room";
  targetRoomInput.className = "forge-input";
  targetRoomInput.placeholder = "repair-room";
  targetRoomInput.value = state.snapshot.currentGoal?.targetRoomId ?? "repair-room";
  const actions = documentRef.createElement("div");
  actions.className = "forge-actions";
  actions.innerHTML = `
    <button type="button" class="forge-button forge-button--primary" data-forge-action="create-session">${text(["workbench", "actions", "createSession"], "Create session")}</button>
    <button type="button" class="forge-button" data-forge-action="save-session">${text(["workbench", "actions", "saveSession"], "Save session")}</button>
    <button type="button" class="forge-button" data-forge-action="load-latest">${text(["workbench", "actions", "loadLatestSession"], "Load latest")}</button>
    <button type="button" class="forge-button" data-forge-action="save-goal">Save goal</button>
    <button type="button" class="forge-button forge-button--primary" data-forge-action="generate-draft">Generate draft</button>
  `;
  const activeSession = documentRef.createElement("p");
  activeSession.className = "forge-panel__hint";
  activeSession.textContent = state.snapshot.activeSessionId ? `Active session: ${state.snapshot.activeSessionId}` : text(["workbench", "states", "emptySessions"], "No saved sessions yet.");
  body.append(summaryInput, briefInput, constraintsInput, targetRoomInput, actions, activeSession);
  return createForgePanel(documentRef, {
    panelId: "goal",
    eyebrow: state.context.roomName,
    title: text(["workbench", "panels", "goal"], "Goal Input"),
    body
  });
}
