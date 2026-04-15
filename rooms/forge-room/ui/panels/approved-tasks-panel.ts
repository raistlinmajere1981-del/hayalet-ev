import type { ForgeUiState, ForgeWorkbenchUiFlowState } from "../../shared/ui/state.js";
import { createForgePanel } from "./panel-shell.js";

function safeTaskKey(taskId: string): string {
  return taskId.replace(/[^a-z0-9_-]/gi, "-");
}

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
  options: {
    action?: string;
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
  if (options.action) {
    button.dataset["forgeAction"] = options.action;
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

function describeApprovedState(flowState: ForgeWorkbenchUiFlowState): {
  summary: string;
  title: string;
} {
  switch (flowState) {
    case "APPROVED":
      return {
        title: "DISPATCH READY",
        summary: "NEXT ACTION: DISPATCH ASSIGNMENTS",
      };
    case "DISPATCHED":
      return {
        title: "DISPATCH LOCKED",
        summary: "STATE: WORK IN FLIGHT",
      };
    case "RESPONSES_READY":
    case "CONFLICT":
    case "SYNTHESIS_READY":
    case "EXPORTED":
      return {
        title: "DISPATCH LOCKED",
        summary: "STATE: REFERENCE ONLY",
      };
    case "IDLE":
    case "SESSION_CREATED":
    case "GOAL_DEFINED":
    case "DRAFT_READY":
      return {
        title: "DISPATCH LOCKED",
        summary: "REQUIRES: APPROVED DRAFT",
      };
  }
}

export function renderApprovedTasksPanel(
  documentRef: Document,
  state: ForgeUiState,
  text: (path: string[], fallback: string) => string,
  options: {
    dispatchBlockedReason: string | null;
    flowState: ForgeWorkbenchUiFlowState;
  }
): HTMLElement {
  const body = documentRef.createElement("div");
  body.className = "forge-panel__body";
  const topLevelTasks = state.snapshot.approvedTasks.filter((task) => task.level === 1);
  const approvedState = describeApprovedState(options.flowState);
  const settingsLocked = options.flowState !== "APPROVED";

  const toolbar = documentRef.createElement("div");
  toolbar.className = "forge-toolbar";
  const title = documentRef.createElement("p");
  title.className = "forge-toolbar__title";
  title.textContent =
    topLevelTasks.length > 0
      ? `${String(topLevelTasks.length)} approved task${topLevelTasks.length === 1 ? "" : "s"}`
      : "No approved tasks";
  toolbar.append(title);
  body.append(toolbar);
  body.append(createGuideCard(documentRef, approvedState.title, approvedState.summary));

  if (options.flowState === "APPROVED" && options.dispatchBlockedReason) {
    const blocked = documentRef.createElement("p");
    blocked.className = "forge-inline-status forge-inline-status--warning";
    blocked.textContent = options.dispatchBlockedReason;
    body.append(blocked);
  }

  if (topLevelTasks.length === 0) {
    const empty = documentRef.createElement("p");
    empty.className = "forge-panel__hint";
    empty.textContent = text(
      ["workbench", "states", "emptyApproved"],
      "Approve the draft to arm dispatch-ready task lanes here."
    );
    body.append(empty);
  } else {
    const cards = documentRef.createElement("div");
    cards.className = "forge-card-list";
    topLevelTasks.forEach((task) => {
      const taskKey = safeTaskKey(task.id);
      const taskAssignments = state.snapshot.assignments.filter(
        (entry) => entry.taskId === task.id
      );
      const queuedCount = taskAssignments.filter((entry) => entry.status === "queued").length;
      const completedCount = taskAssignments.filter((entry) => entry.status === "completed").length;

      const card = documentRef.createElement("article");
      card.className = "forge-card forge-card--task-editor forge-card--approved";

      const header = documentRef.createElement("div");
      header.className = "forge-task-card__header";
      const titleBlock = documentRef.createElement("div");
      titleBlock.className = "forge-task-card__title";
      const titleText = documentRef.createElement("strong");
      titleText.textContent = task.title;
      const summary = documentRef.createElement("p");
      summary.className = "forge-flow-item__summary";
      summary.textContent = task.summary;
      titleBlock.append(titleText, summary);
      const meta = documentRef.createElement("div");
      meta.className = "forge-flow-item__meta";
      [
        `${String(queuedCount)} queued`,
        `${String(completedCount)} done`,
        task.dispatchMode,
        task.roleId ?? "role",
      ].forEach((value, index) => {
        const chip = documentRef.createElement("span");
        chip.className = index < 2 ? "forge-chip forge-chip--soft" : "forge-chip";
        chip.textContent = value;
        meta.append(chip);
      });
      header.append(titleBlock, meta);

      const modeSelect = documentRef.createElement("select");
      modeSelect.id = `forge-approved-mode-${taskKey}`;
      modeSelect.className = "forge-input";
      modeSelect.disabled = settingsLocked;
      modeSelect.append(
        createOption(documentRef, "single-owner", "single-owner", task.dispatchMode),
        createOption(documentRef, "compare", "compare", task.dispatchMode)
      );

      const seatSelect = documentRef.createElement("select");
      seatSelect.id = `forge-approved-seat-${taskKey}`;
      seatSelect.className = "forge-input";
      seatSelect.disabled = settingsLocked;
      (["ai1", "ai2", "us1"] as const).forEach((seatId) => {
        seatSelect.append(createOption(documentRef, seatId, seatId, task.seatId));
      });

      const roleSelect = documentRef.createElement("select");
      roleSelect.id = `forge-approved-role-${taskKey}`;
      roleSelect.className = "forge-input";
      roleSelect.disabled = settingsLocked;
      Object.values(state.meta.roleCatalog).forEach((entry) => {
        const record = entry as { id?: string; label?: string; localActor?: boolean };
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
      compareSeatSelect.disabled = settingsLocked;
      compareSeatSelect.append(createOption(documentRef, "", "none", null));
      (["ai1", "ai2", "us1"] as const).forEach((seatId) => {
        compareSeatSelect.append(
          createOption(documentRef, seatId, seatId, task.compareSeatIds[0] ?? null)
        );
      });

      const personaSelect = documentRef.createElement("select");
      personaSelect.id = `forge-approved-persona-${taskKey}`;
      personaSelect.className = "forge-input";
      personaSelect.disabled = settingsLocked;
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

      const controls = documentRef.createElement("div");
      controls.className = "forge-form-grid forge-form-grid--approved";
      controls.append(
        createField(documentRef, "Mode", modeSelect),
        createField(documentRef, "Seat", seatSelect),
        createField(documentRef, "Role", roleSelect),
        createField(documentRef, "Compare seat", compareSeatSelect),
        createField(documentRef, "Persona", personaSelect)
      );

      card.append(header, controls);
      if (options.flowState === "APPROVED") {
        const saveButton = createButton(documentRef, "Save dispatch settings", {
          datasetKey: "forgeSaveApprovedTask",
          datasetValue: task.id,
          disabled: taskAssignments.some((assignment) => assignment.status !== "queued"),
        });
        card.append(saveButton);
      }
      cards.append(card);
    });
    body.append(cards);
  }

  return createForgePanel(documentRef, {
    panelId: "approved",
    title: text(["workbench", "panels", "approved"], "Dispatch Plan"),
    body,
  });
}
