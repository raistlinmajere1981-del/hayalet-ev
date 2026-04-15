import type { ForgeUiState, ForgeWorkbenchUiFlowState } from "../../shared/ui/state.js";
import { createForgePanel } from "./panel-shell.js";

function createField(
  documentRef: Document,
  labelText: string,
  control: HTMLElement,
  options?: {
    hint?: string | null;
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

function createButton(
  documentRef: Document,
  label: string,
  action: string,
  options: {
    disabled?: boolean;
    primary?: boolean;
  } = {}
): HTMLButtonElement {
  const button = documentRef.createElement("button");
  button.type = "button";
  button.className = options.primary
    ? "forge-button forge-button--primary"
    : "forge-button forge-button--secondary";
  button.dataset["forgeAction"] = action;
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

function describeGoalState(flowState: ForgeWorkbenchUiFlowState): {
  summary: string;
  title: string;
} {
  switch (flowState) {
    case "IDLE":
      return {
        title: "PLAN OPEN",
        summary: "NEXT ACTION: SAVE GOAL",
      };
    case "SESSION_CREATED":
      return {
        title: "PLAN OPEN",
        summary: "NEXT ACTION: SAVE GOAL",
      };
    case "GOAL_DEFINED":
      return {
        title: "PLAN READY",
        summary: "NEXT ACTION: GENERATE DRAFT",
      };
    case "DRAFT_READY":
      return {
        title: "PLAN ACTIVE",
        summary: "NEXT ACTION: APPROVE DRAFT",
      };
    case "APPROVED":
    case "DISPATCHED":
    case "RESPONSES_READY":
    case "CONFLICT":
    case "SYNTHESIS_READY":
    case "EXPORTED":
      return {
        title: "PLAN LOCKED",
        summary: "UPSTREAM EDITS DISABLED",
      };
  }
}

export function renderGoalInputPanel(
  documentRef: Document,
  state: ForgeUiState,
  text: (path: string[], fallback: string) => string,
  options: {
    draftBlockedReason: string | null;
    flowState: ForgeWorkbenchUiFlowState;
  }
): HTMLElement {
  const body = documentRef.createElement("div");
  body.className = "forge-panel__body forge-goal-panel";
  const currentGoal = state.snapshot.currentGoal;
  const activeSessionId = state.snapshot.activeSessionId;
  const goalState = describeGoalState(options.flowState);
  const topLevelDraftCount = state.snapshot.draftTasks.filter((task) => task.level === 1).length;
  const goalLocked =
    options.flowState === "APPROVED" ||
    options.flowState === "DISPATCHED" ||
    options.flowState === "RESPONSES_READY" ||
    options.flowState === "CONFLICT" ||
    options.flowState === "SYNTHESIS_READY" ||
    options.flowState === "EXPORTED";

  const summaryInput = documentRef.createElement("input");
  summaryInput.id = "forge-goal-summary";
  summaryInput.className = "forge-input";
  summaryInput.placeholder = "Goal";
  summaryInput.value = currentGoal?.summary ?? "";
  summaryInput.disabled = goalLocked;

  const targetRoomInput = documentRef.createElement("input");
  targetRoomInput.id = "forge-goal-target-room";
  targetRoomInput.className = "forge-input";
  targetRoomInput.placeholder = "repair-room";
  targetRoomInput.value = currentGoal?.targetRoomId ?? "repair-room";
  targetRoomInput.disabled = goalLocked;

  const briefInput = documentRef.createElement("textarea");
  briefInput.id = "forge-goal-brief";
  briefInput.className = "forge-textarea forge-textarea--compact";
  briefInput.placeholder = "Brief";
  briefInput.value = currentGoal?.brief ?? "";
  briefInput.disabled = goalLocked;

  const constraintsInput = documentRef.createElement("textarea");
  constraintsInput.id = "forge-goal-constraints";
  constraintsInput.className = "forge-textarea forge-textarea--compact";
  constraintsInput.placeholder = "One constraint per line";
  constraintsInput.value = (currentGoal?.constraints ?? []).join("\n");
  constraintsInput.disabled = goalLocked;

  const summaryGrid = documentRef.createElement("div");
  summaryGrid.className = "forge-summary-strip";
  [
    { label: "Target", value: currentGoal?.targetRoomId ?? "repair-room" },
    { label: "State", value: options.flowState.replaceAll("_", " ").toLowerCase() },
    {
      label: "Session",
      value: activeSessionId ? activeSessionId.slice(0, 18) : "not started",
    },
    {
      label: "Draft",
      value: topLevelDraftCount > 0 ? `${String(topLevelDraftCount)} tasks` : "waiting",
    },
  ].forEach((entry) => {
    const card = documentRef.createElement("div");
    card.className = "forge-summary-strip__item";
    const label = documentRef.createElement("span");
    label.className = "forge-summary-strip__label";
    label.textContent = entry.label;
    const value = documentRef.createElement("strong");
    value.className = "forge-summary-strip__value";
    value.textContent = entry.value;
    card.append(label, value);
    summaryGrid.append(card);
  });

  const fieldGrid = documentRef.createElement("div");
  fieldGrid.className = "forge-form-grid forge-form-grid--goal";
  fieldGrid.append(
    createField(documentRef, "Goal", summaryInput),
    createField(documentRef, "Target room", targetRoomInput),
    createField(documentRef, "Brief", briefInput),
    createField(documentRef, "Constraints", constraintsInput, {
      hint: "One per line.",
    })
  );

  const commandRail = documentRef.createElement("div");
  commandRail.className = "forge-action-cluster forge-action-cluster--goal";
  if (options.flowState === "IDLE" && state.snapshot.sessionList.length > 0) {
    commandRail.append(
      createButton(
        documentRef,
        text(["workbench", "actions", "loadLatestSession"], "Resume latest run"),
        "load-latest"
      )
    );
  }

  if (options.flowState === "GOAL_DEFINED" && options.draftBlockedReason) {
    const blocked = documentRef.createElement("p");
    blocked.className = "forge-inline-status forge-inline-status--warning";
    blocked.textContent = options.draftBlockedReason;
    commandRail.append(blocked);
  }

  let sessionRail: HTMLElement | null = null;
  if (
    state.snapshot.sessionList.length > 0 &&
    (options.flowState === "IDLE" || options.flowState === "SESSION_CREATED")
  ) {
    sessionRail = documentRef.createElement("div");
    sessionRail.className = "forge-session-rail";
    state.snapshot.sessionList.slice(0, 3).forEach((session) => {
      const item = documentRef.createElement("div");
      item.className = "forge-session-rail__item";
      const title = documentRef.createElement("strong");
      title.textContent = session.title;
      const meta = documentRef.createElement("span");
      meta.className = "forge-field__hint";
      meta.textContent = session.updatedAt;
      item.append(title, meta);
      sessionRail.append(item);
    });
  }

  body.append(createGuideCard(documentRef, goalState.title, goalState.summary));
  body.append(summaryGrid, fieldGrid, commandRail);
  if (sessionRail) {
    body.append(sessionRail);
  }

  return createForgePanel(documentRef, {
    panelId: "goal",
    eyebrow: state.context.roomName,
    title: text(["workbench", "panels", "goal"], "Goal"),
    body,
  });
}
