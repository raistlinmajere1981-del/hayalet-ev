import { createForgePanel } from "./panel-shell.js";
function safeTaskKey(taskId) {
  return taskId.replace(/[^a-z0-9_-]/gi, "-");
}
function createOption(documentRef, value, label, selectedValue) {
  const option = documentRef.createElement("option");
  option.value = value;
  option.textContent = label;
  option.selected = selectedValue === value;
  return option;
}
function createLabeledField(documentRef, labelText, control) {
  const wrapper = documentRef.createElement("label");
  wrapper.className = "forge-field";
  const label = documentRef.createElement("span");
  label.className = "forge-field__label";
  label.textContent = labelText;
  wrapper.append(label, control);
  return wrapper;
}
export function renderApprovedTasksPanel(documentRef, state, text) {
  const body = documentRef.createElement("div");
  body.className = "forge-panel__body";
  const topLevelTasks = state.snapshot.approvedTasks.filter((task) => task.level === 1);
  const lane = documentRef.createElement("div");
  lane.className = "forge-flow-lane";
  if (topLevelTasks.length === 0) {
    const empty = documentRef.createElement("p");
    empty.className = "forge-panel__hint";
    empty.textContent = text(
      ["workbench", "states", "emptyApproved"],
      "Approved tasks will appear here."
    );
    body.append(empty);
  } else {
    topLevelTasks.forEach((task) => {
      const item = documentRef.createElement("article");
      item.className = "forge-flow-item";
      const content = documentRef.createElement("div");
      content.className = "forge-flow-item__content";
      const title = documentRef.createElement("strong");
      title.textContent = task.title;
      const summary = documentRef.createElement("p");
      summary.className = "forge-flow-item__summary";
      summary.textContent = task.summary;
      const meta = documentRef.createElement("div");
      meta.className = "forge-flow-item__meta";
      const mode = documentRef.createElement("span");
      mode.className = "forge-chip";
      mode.textContent = task.dispatchMode === "compare" ? "compare" : task.seatId ?? "unassigned";
      const role = documentRef.createElement("span");
      role.className = "forge-chip forge-chip--soft";
      role.textContent = task.roleId ?? "no role";
      meta.append(mode, role);
      content.append(title, summary, meta);
      item.append(content);
      lane.append(item);
    });
    body.append(lane);
    const cards = documentRef.createElement("div");
    cards.className = "forge-card-list";
    topLevelTasks.forEach((task) => {
      const taskKey = safeTaskKey(task.id);
      const taskAssignments = state.snapshot.assignments.filter(
        (entry) => entry.taskId === task.id
      );
      const card = documentRef.createElement("article");
      card.className = "forge-card forge-card--form";
      const header = documentRef.createElement("div");
      header.className = "forge-card__header";
      header.innerHTML = `<strong>${task.title}</strong><span>${task.summary}</span>`;
      const modeSelect = documentRef.createElement("select");
      modeSelect.id = `forge-approved-mode-${taskKey}`;
      modeSelect.className = "forge-input";
      modeSelect.append(
        createOption(documentRef, "single-owner", "single-owner", task.dispatchMode),
        createOption(documentRef, "compare", "compare", task.dispatchMode)
      );
      const seatSelect = documentRef.createElement("select");
      seatSelect.id = `forge-approved-seat-${taskKey}`;
      seatSelect.className = "forge-input";
      ["ai1", "ai2", "us1"].forEach((seatId) => {
        seatSelect.append(createOption(documentRef, seatId, seatId, task.seatId));
      });
      const roleSelect = documentRef.createElement("select");
      roleSelect.id = `forge-approved-role-${taskKey}`;
      roleSelect.className = "forge-input";
      Object.values(state.meta.roleCatalog).forEach((entry) => {
        const record = entry;
        if (record.localActor === true || !record.id) {
          return;
        }
        roleSelect.append(
          createOption(documentRef, record.id, record.label ?? record.id, task.roleId)
        );
      });
      const compareSeatSelect = documentRef.createElement("select");
      compareSeatSelect.id = `forge-approved-compare-seat-${taskKey}`;
      compareSeatSelect.className = "forge-input";
      compareSeatSelect.append(createOption(documentRef, "", "none", null));
      ["ai1", "ai2", "us1"].forEach((seatId) => {
        compareSeatSelect.append(
          createOption(documentRef, seatId, seatId, task.compareSeatIds[0] ?? null)
        );
      });
      const personaSelect = documentRef.createElement("select");
      personaSelect.id = `forge-approved-persona-${taskKey}`;
      personaSelect.className = "forge-input";
      personaSelect.append(createOption(documentRef, "", "none", task.personaPresetId));
      Object.values(state.meta.personaPresets).forEach((entry) => {
        const record = entry;
        if (!record.id) {
          return;
        }
        personaSelect.append(
          createOption(documentRef, record.id, record.label ?? record.id, task.personaPresetId)
        );
      });
      const controls = documentRef.createElement("div");
      controls.className = "forge-form-grid";
      controls.append(
        createLabeledField(documentRef, "Mode", modeSelect),
        createLabeledField(documentRef, "Seat", seatSelect),
        createLabeledField(documentRef, "Role", roleSelect),
        createLabeledField(documentRef, "Compare seat", compareSeatSelect),
        createLabeledField(documentRef, "Persona", personaSelect)
      );
      const assignmentState = documentRef.createElement("p");
      assignmentState.className = "forge-panel__hint";
      assignmentState.textContent = taskAssignments.length > 0 ? taskAssignments.map((assignment) => `${assignment.seatId}:${assignment.status}`).join(" | ") : "No queued assignments yet.";
      const saveButton = documentRef.createElement("button");
      saveButton.type = "button";
      saveButton.className = "forge-button";
      saveButton.dataset["forgeSaveApprovedTask"] = task.id;
      saveButton.disabled = taskAssignments.some((assignment) => assignment.status !== "queued");
      saveButton.textContent = "Save dispatch settings";
      card.append(header, controls, assignmentState, saveButton);
      cards.append(card);
    });
    body.append(cards);
  }
  const dispatchButton = documentRef.createElement("button");
  dispatchButton.type = "button";
  dispatchButton.className = "forge-button";
  dispatchButton.dataset["forgeAction"] = "dispatch-assignments";
  dispatchButton.disabled = state.snapshot.assignments.filter((assignment) => assignment.status === "queued").length === 0;
  dispatchButton.textContent = "Dispatch queued assignments";
  body.append(dispatchButton);
  return createForgePanel(documentRef, {
    panelId: "approved",
    title: text(["workbench", "panels", "approved"], "Approved Tasks"),
    body
  });
}
