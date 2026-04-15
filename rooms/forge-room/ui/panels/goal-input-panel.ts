import type { ForgeUiState } from "../../shared/ui/state.js";
import { createForgePanel } from "./panel-shell.js";

function createField(
  documentRef: Document,
  labelText: string,
  control: HTMLElement,
  options?: {
    hint?: string;
  }
): HTMLElement {
  const wrapper = documentRef.createElement("label");
  wrapper.className = "forge-field";

  const label = documentRef.createElement("span");
  label.className = "forge-field__label";
  label.textContent = labelText;
  wrapper.append(label, control);

  if (options?.hint) {
    const hint = documentRef.createElement("span");
    hint.className = "forge-field__hint";
    hint.textContent = options.hint;
    wrapper.append(hint);
  }

  return wrapper;
}

export function renderGoalInputPanel(
  documentRef: Document,
  state: ForgeUiState,
  text: (path: string[], fallback: string) => string
): HTMLElement {
  const body = documentRef.createElement("div");
  body.className = "forge-panel__body forge-goal-panel";
  const currentGoal = state.snapshot.currentGoal;

  const summaryInput = documentRef.createElement("input");
  summaryInput.id = "forge-goal-summary";
  summaryInput.className = "forge-input";
  summaryInput.placeholder = "Repair Room entegrasyonunu uret";
  summaryInput.value = currentGoal?.summary ?? "";

  const briefInput = documentRef.createElement("textarea");
  briefInput.id = "forge-goal-brief";
  briefInput.className = "forge-textarea";
  briefInput.placeholder = "Goal brief";
  briefInput.value = currentGoal?.brief ?? "";

  const constraintsInput = documentRef.createElement("textarea");
  constraintsInput.id = "forge-goal-constraints";
  constraintsInput.className = "forge-textarea forge-textarea--compact";
  constraintsInput.placeholder = "One constraint per line";
  constraintsInput.value = (currentGoal?.constraints ?? []).join("\n");

  const targetRoomInput = documentRef.createElement("input");
  targetRoomInput.id = "forge-goal-target-room";
  targetRoomInput.className = "forge-input";
  targetRoomInput.placeholder = "repair-room";
  targetRoomInput.value = currentGoal?.targetRoomId ?? "repair-room";

  const signal = documentRef.createElement("div");
  signal.className = "forge-goal-signal";

  const targetChip = documentRef.createElement("span");
  targetChip.className = "forge-chip forge-chip--accent";
  targetChip.textContent = `Target ${currentGoal?.targetRoomId ?? "repair-room"}`;

  const sessionChip = documentRef.createElement("span");
  sessionChip.className = "forge-chip";
  sessionChip.textContent = state.snapshot.activeSessionId ? "Session ready" : "Session needed";

  const draftChip = documentRef.createElement("span");
  draftChip.className = "forge-chip";
  draftChip.textContent =
    state.snapshot.draftTasks.length > 0
      ? `${String(state.snapshot.draftTasks.filter((task) => task.level === 1).length)} draft task`
      : "No draft yet";

  signal.append(targetChip, sessionChip, draftChip);

  const overview = documentRef.createElement("div");
  overview.className = "forge-goal-overview";

  const overviewTitle = documentRef.createElement("p");
  overviewTitle.className = "forge-goal-overview__title";
  overviewTitle.textContent = currentGoal?.summary || "Forge a room handoff";

  const overviewBrief = documentRef.createElement("p");
  overviewBrief.className = "forge-goal-overview__brief";
  overviewBrief.textContent =
    currentGoal?.brief ||
    "Capture the target room, write the brief, and keep the brief compact enough for a fast planning pass.";

  overview.append(overviewTitle, overviewBrief);

  const fieldGrid = documentRef.createElement("div");
  fieldGrid.className = "forge-goal-grid";
  fieldGrid.append(
    createField(documentRef, "Goal", summaryInput, {
      hint: "Short project headline for the workbench and export package.",
    }),
    createField(documentRef, "Brief", briefInput, {
      hint: "Keep the desired implementation flow practical and direct.",
    }),
    createField(documentRef, "Constraints", constraintsInput, {
      hint: "One line per rule or guardrail.",
    }),
    createField(documentRef, "Target room", targetRoomInput, {
      hint: "Used by downstream synthesis and handoff export.",
    })
  );

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
  activeSession.textContent = state.snapshot.activeSessionId
    ? `Active session: ${state.snapshot.activeSessionId}`
    : text(["workbench", "states", "emptySessions"], "No saved sessions yet.");

  body.append(signal, overview, fieldGrid, actions, activeSession);
  return createForgePanel(documentRef, {
    panelId: "goal",
    eyebrow: state.context.roomName,
    title: text(["workbench", "panels", "goal"], "Goal Input"),
    body,
  });
}
