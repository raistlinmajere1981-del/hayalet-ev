import type { ForgeUiState } from "../../shared/ui/state.js";
import { createForgePanel } from "./panel-shell.js";

function createOption(
  documentRef: Document,
  value: string,
  label: string,
  selectedValue: string | null
): HTMLOptionElement {
  const option = documentRef.createElement("option");
  option.value = value;
  option.textContent = label;
  option.selected = selectedValue === value;
  return option;
}

function safeTaskKey(taskId: string): string {
  return taskId.replace(/[^a-z0-9_-]/gi, "-");
}

function createLabeledField(
  documentRef: Document,
  labelText: string,
  control: HTMLElement
): HTMLElement {
  const wrapper = documentRef.createElement("label");
  wrapper.className = "forge-field";
  const label = documentRef.createElement("span");
  label.className = "forge-field__label";
  label.textContent = labelText;
  wrapper.append(label, control);
  return wrapper;
}

export function renderDraftBreakdownPanel(
  documentRef: Document,
  state: ForgeUiState,
  text: (path: string[], fallback: string) => string
): HTMLElement {
  const body = documentRef.createElement("div");
  body.className = "forge-panel__body";
  const topLevelTasks = state.snapshot.draftTasks.filter((task) => task.level === 1);
  const flowLane = documentRef.createElement("div");
  flowLane.className = "forge-flow-lane";
  const checklistByParentId = new Map(
    topLevelTasks.map((task) => [
      task.id,
      state.snapshot.draftTasks
        .filter((candidate) => candidate.parentTaskId === task.id && candidate.level === 2)
        .map((candidate) => candidate.title),
    ])
  );

  if (topLevelTasks.length === 0) {
    const empty = documentRef.createElement("p");
    empty.className = "forge-panel__hint";
    empty.textContent = text(
      ["workbench", "states", "emptyDraft"],
      "Draft tasks will appear here."
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

      const seat = documentRef.createElement("span");
      seat.className = "forge-chip";
      seat.textContent = task.seatId ?? "ai1";

      const mode = documentRef.createElement("span");
      mode.className = "forge-chip forge-chip--soft";
      mode.textContent = task.dispatchMode;

      meta.append(seat, mode);
      content.append(title, summary, meta);
      item.append(content);
      flowLane.append(item);
    });
    body.append(flowLane);

    const cards = documentRef.createElement("div");
    cards.className = "forge-card-list";
    topLevelTasks.forEach((task) => {
      const card = documentRef.createElement("article");
      card.className = "forge-card forge-card--form";
      const taskKey = safeTaskKey(task.id);

      const titleInput = documentRef.createElement("input");
      titleInput.id = `forge-draft-title-${taskKey}`;
      titleInput.className = "forge-input";
      titleInput.value = task.title;

      const summaryInput = documentRef.createElement("textarea");
      summaryInput.id = `forge-draft-summary-${taskKey}`;
      summaryInput.className = "forge-textarea forge-textarea--compact";
      summaryInput.value = task.summary;

      const seatSelect = documentRef.createElement("select");
      seatSelect.id = `forge-draft-seat-${taskKey}`;
      seatSelect.className = "forge-input";
      (
        [
          ["ai1", "ai1"],
          ["ai2", "ai2"],
          ["us1", "us1"],
        ] as const
      ).forEach(([value, label]) => {
        seatSelect.append(createOption(documentRef, value, label, task.seatId));
      });

      const roleSelect = documentRef.createElement("select");
      roleSelect.id = `forge-draft-role-${taskKey}`;
      roleSelect.className = "forge-input";
      Object.values(state.meta.roleCatalog).forEach((entry) => {
        const record = entry as { id?: string; label?: string; localActor?: boolean };
        if (record.localActor === true || !record.id) {
          return;
        }
        roleSelect.append(
          createOption(documentRef, record.id, record.label ?? record.id, task.roleId)
        );
      });

      const modeSelect = documentRef.createElement("select");
      modeSelect.id = `forge-draft-mode-${taskKey}`;
      modeSelect.className = "forge-input";
      modeSelect.append(
        createOption(documentRef, "single-owner", "single-owner", task.dispatchMode),
        createOption(documentRef, "compare", "compare", task.dispatchMode)
      );

      const compareSeatSelect = documentRef.createElement("select");
      compareSeatSelect.id = `forge-draft-compare-seat-${taskKey}`;
      compareSeatSelect.className = "forge-input";
      compareSeatSelect.append(createOption(documentRef, "", "none", null));
      ["ai1", "ai2", "us1"].forEach((seatId) => {
        compareSeatSelect.append(
          createOption(documentRef, seatId, seatId, task.compareSeatIds[0] ?? null)
        );
      });

      const personaSelect = documentRef.createElement("select");
      personaSelect.id = `forge-draft-persona-${taskKey}`;
      personaSelect.className = "forge-input";
      personaSelect.append(createOption(documentRef, "", "none", task.personaPresetId));
      Object.values(state.meta.personaPresets).forEach((entry) => {
        const record = entry as { id?: string; label?: string };
        if (!record.id) {
          return;
        }
        personaSelect.append(
          createOption(documentRef, record.id, record.label ?? record.id, task.personaPresetId)
        );
      });

      const checklistInput = documentRef.createElement("textarea");
      checklistInput.id = `forge-draft-checklist-${taskKey}`;
      checklistInput.className = "forge-textarea forge-textarea--compact";
      checklistInput.value = (checklistByParentId.get(task.id) ?? []).join("\n");

      const controls = documentRef.createElement("div");
      controls.className = "forge-form-grid";
      controls.append(
        createLabeledField(documentRef, "Title", titleInput),
        createLabeledField(documentRef, "Seat", seatSelect),
        createLabeledField(documentRef, "Role", roleSelect),
        createLabeledField(documentRef, "Mode", modeSelect),
        createLabeledField(documentRef, "Compare seat", compareSeatSelect),
        createLabeledField(documentRef, "Persona", personaSelect),
        createLabeledField(documentRef, "Summary", summaryInput),
        createLabeledField(documentRef, "Checklist", checklistInput)
      );

      const actions = documentRef.createElement("div");
      actions.className = "forge-actions";
      const saveButton = documentRef.createElement("button");
      saveButton.type = "button";
      saveButton.className = "forge-button";
      saveButton.dataset["forgeSaveDraftTask"] = task.id;
      saveButton.textContent = "Save task";
      const removeButton = documentRef.createElement("button");
      removeButton.type = "button";
      removeButton.className = "forge-button";
      removeButton.dataset["forgeRemoveDraftTask"] = task.id;
      removeButton.textContent = "Remove task";
      actions.append(saveButton, removeButton);

      card.append(controls, actions);
      cards.append(card);
    });
    body.append(cards);
  }

  if (state.snapshot.validationMessages.length > 0) {
    const errors = documentRef.createElement("ul");
    errors.className = "forge-list forge-list--errors";
    state.snapshot.validationMessages.forEach((message) => {
      const item = documentRef.createElement("li");
      item.className = "forge-list__item";
      item.textContent = message;
      errors.append(item);
    });
    body.append(errors);
  }

  const addTaskButton = documentRef.createElement("button");
  addTaskButton.type = "button";
  addTaskButton.className = "forge-button";
  addTaskButton.dataset["forgeAction"] = "add-draft-task";
  addTaskButton.textContent = "Add top-level task";
  body.append(addTaskButton);

  const editor = documentRef.createElement("textarea");
  editor.id = "forge-draft-source";
  editor.className = "forge-textarea forge-textarea--draft";
  editor.placeholder = '{"tasks":[{"title":"Task title"}]}';
  editor.value = state.snapshot.draftSourceText ?? "";
  body.append(editor);

  const apply = documentRef.createElement("button");
  apply.type = "button";
  apply.className = "forge-button";
  apply.dataset["forgeAction"] = "apply-draft-text";
  apply.textContent = "Apply edited draft";
  body.append(apply);

  const approve = documentRef.createElement("button");
  approve.type = "button";
  approve.className = "forge-button";
  approve.dataset["forgeAction"] = "approve-draft";
  approve.disabled =
    state.snapshot.draftTasks.length === 0 || state.snapshot.validationMessages.length > 0;
  approve.textContent = text(["workbench", "actions", "approveDraft"], "Approve draft");
  body.append(approve);

  return createForgePanel(documentRef, {
    panelId: "draft",
    title: text(["workbench", "panels", "draft"], "Draft Breakdown"),
    body,
  });
}
