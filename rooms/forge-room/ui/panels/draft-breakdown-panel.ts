import type { ForgeUiState, ForgeWorkbenchUiFlowState } from "../../shared/ui/state.js";
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

function createField(documentRef: Document, labelText: string, control: HTMLElement): HTMLElement {
  const wrapper = documentRef.createElement("label");
  wrapper.className = "forge-field";
  const label = documentRef.createElement("span");
  label.className = "forge-field__label";
  label.textContent = labelText;
  wrapper.append(label, control);
  return wrapper;
}

function createButton(
  documentRef: Document,
  label: string,
  action?: string,
  options: {
    datasetKey?: string;
    datasetValue?: string;
    disabled?: boolean;
    primary?: boolean;
  } = {}
): HTMLButtonElement {
  const button = documentRef.createElement("button");
  button.type = "button";
  button.className = options.primary
    ? "forge-button forge-button--primary"
    : "forge-button forge-button--secondary";
  if (action) {
    button.dataset["forgeAction"] = action;
  }
  if (options.datasetKey && options.datasetValue) {
    button.dataset[options.datasetKey] = options.datasetValue;
  }
  button.disabled = options.disabled === true;
  button.textContent = label;
  return button;
}

function createGuideCard(
  documentRef: Document,
  titleText: string,
  summaryText: string
): HTMLElement {
  const card = documentRef.createElement("article");
  card.className = "forge-state-guide";
  const title = documentRef.createElement("strong");
  title.textContent = titleText;
  const summary = documentRef.createElement("p");
  summary.className = "forge-panel__hint";
  summary.textContent = summaryText;
  card.append(title, summary);
  return card;
}

function describeDraftState(
  flowState: ForgeWorkbenchUiFlowState,
  hasValidationIssues: boolean
): { summary: string; title: string } {
  switch (flowState) {
    case "IDLE":
      return {
        title: "Save the goal to unlock the draft",
        summary: "This lane stays locked until the goal above is saved.",
      };
    case "SESSION_CREATED":
      return {
        title: "Save the goal to open this lane",
        summary: "The draft stays closed until the goal above becomes real.",
      };
    case "GOAL_DEFINED":
      return {
        title: "Use Next Step to unlock draft editing",
        summary: "Generate the first draft from the top bar, then this lane will open for edits.",
      };
    case "DRAFT_READY":
      return hasValidationIssues
        ? {
            title: "Fix the draft to unlock approval",
            summary: "Tighten the task details below until the plan is ready to approve.",
          }
        : {
            title: "Finish edits to unlock approval",
            summary: "Refine the task lanes below, then use Next Step to approve the draft.",
          };
    case "APPROVED":
    case "DISPATCHED":
    case "RESPONSES_READY":
    case "CONFLICT":
    case "SYNTHESIS_READY":
    case "EXPORTED":
      return {
        title: "This lane is locked after approval",
        summary: "Restart the plan only if you intend to reopen earlier steps.",
      };
  }
}

export function renderDraftBreakdownPanel(
  documentRef: Document,
  state: ForgeUiState,
  text: (path: string[], fallback: string) => string,
  options: {
    approvalBlockedReason: string | null;
    flowState: ForgeWorkbenchUiFlowState;
    rawEditorOpen: boolean;
  }
): HTMLElement {
  const body = documentRef.createElement("div");
  body.className = "forge-panel__body";
  const topLevelTasks = state.snapshot.draftTasks.filter((task) => task.level === 1);
  const draftState = describeDraftState(
    options.flowState,
    state.snapshot.validationMessages.length > 0
  );
  const checklistByParentId = new Map(
    topLevelTasks.map((task) => [
      task.id,
      state.snapshot.draftTasks
        .filter((candidate) => candidate.parentTaskId === task.id && candidate.level === 2)
        .map((candidate) => candidate.title),
    ])
  );

  const toolbar = documentRef.createElement("div");
  toolbar.className = "forge-toolbar";
  const title = documentRef.createElement("p");
  title.className = "forge-toolbar__title";
  title.textContent =
    topLevelTasks.length > 0
      ? `${String(topLevelTasks.length)} task${topLevelTasks.length === 1 ? "" : "s"} in draft`
      : "Draft is empty";
  const actions = documentRef.createElement("div");
  actions.className = "forge-actions";
  if (options.flowState === "DRAFT_READY") {
    actions.append(
      createButton(documentRef, "Add task", "add-draft-task"),
      createButton(documentRef, "Advanced / raw", undefined, {
        datasetKey: "forgeToggleAdvancedDraft",
        datasetValue: "true",
      })
    );
  }
  toolbar.append(title, actions);
  body.append(toolbar);
  body.append(createGuideCard(documentRef, draftState.title, draftState.summary));

  if (options.flowState === "DRAFT_READY" && options.approvalBlockedReason !== null) {
    const blocked = documentRef.createElement("p");
    blocked.className = "forge-inline-status forge-inline-status--warning";
    blocked.textContent = options.approvalBlockedReason;
    body.append(blocked);
  }

  if (topLevelTasks.length === 0 || options.flowState !== "DRAFT_READY") {
    const empty = documentRef.createElement("p");
    empty.className = "forge-panel__hint";
    empty.textContent = text(
      ["workbench", "states", "emptyDraft"],
      options.flowState === "GOAL_DEFINED"
        ? "Use Next Step to create the first task lanes here."
        : "This lane will unlock when the flow reaches draft editing."
    );
    body.append(empty);
  } else {
    const cards = documentRef.createElement("div");
    cards.className = "forge-card-list";
    topLevelTasks.forEach((task) => {
      const taskKey = safeTaskKey(task.id);
      const card = documentRef.createElement("article");
      card.className = "forge-card forge-card--task-editor";

      const header = documentRef.createElement("div");
      header.className = "forge-task-card__header";
      const titleInput = documentRef.createElement("input");
      titleInput.id = `forge-draft-title-${taskKey}`;
      titleInput.className = "forge-input";
      titleInput.value = task.title;
      titleInput.placeholder = "Task title";
      const meta = documentRef.createElement("div");
      meta.className = "forge-flow-item__meta";
      [task.dispatchMode, task.seatId ?? "ai1", task.roleId ?? "role"].forEach((value, index) => {
        const chip = documentRef.createElement("span");
        chip.className = index === 0 ? "forge-chip forge-chip--soft" : "forge-chip";
        chip.textContent = value;
        meta.append(chip);
      });
      header.append(titleInput, meta);

      const summaryInput = documentRef.createElement("textarea");
      summaryInput.id = `forge-draft-summary-${taskKey}`;
      summaryInput.className = "forge-textarea forge-textarea--compact";
      summaryInput.value = task.summary;
      summaryInput.placeholder = "Task summary";

      const seatSelect = documentRef.createElement("select");
      seatSelect.id = `forge-draft-seat-${taskKey}`;
      seatSelect.className = "forge-input";
      (["ai1", "ai2", "us1"] as const).forEach((seatId) => {
        seatSelect.append(createOption(documentRef, seatId, seatId, task.seatId));
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
      checklistInput.placeholder = "Checklist";

      const fieldGrid = documentRef.createElement("div");
      fieldGrid.className = "forge-form-grid forge-form-grid--task";
      fieldGrid.append(
        createField(documentRef, "Summary", summaryInput),
        createField(documentRef, "Seat", seatSelect),
        createField(documentRef, "Role", roleSelect),
        createField(documentRef, "Mode", modeSelect),
        createField(documentRef, "Compare seat", compareSeatSelect),
        createField(documentRef, "Persona", personaSelect),
        createField(documentRef, "Checklist", checklistInput)
      );

      const taskActions = documentRef.createElement("div");
      taskActions.className = "forge-actions";
      taskActions.append(
        createButton(documentRef, "Save task", undefined, {
          datasetKey: "forgeSaveDraftTask",
          datasetValue: task.id,
        }),
        createButton(documentRef, "Remove", undefined, {
          datasetKey: "forgeRemoveDraftTask",
          datasetValue: task.id,
        })
      );

      card.append(header, fieldGrid, taskActions);
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

  if (options.flowState === "DRAFT_READY" && options.rawEditorOpen) {
    const rawCard = documentRef.createElement("div");
    rawCard.className = "forge-advanced-raw";
    const rawTitle = documentRef.createElement("p");
    rawTitle.className = "forge-advanced-raw__title";
    rawTitle.textContent = "Advanced / raw draft edit";
    const editor = documentRef.createElement("textarea");
    editor.id = "forge-draft-source";
    editor.className = "forge-textarea forge-textarea--draft";
    editor.placeholder = '{"tasks":[{"title":"Task title"}]}';
    editor.value = state.snapshot.draftSourceText ?? "";
    rawCard.append(rawTitle, editor);
    rawCard.append(createButton(documentRef, "Apply raw draft", "apply-draft-text"));
    body.append(rawCard);
  }

  return createForgePanel(documentRef, {
    panelId: "draft",
    title: text(["workbench", "panels", "draft"], "Draft"),
    body,
  });
}
