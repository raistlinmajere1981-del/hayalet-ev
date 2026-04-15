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

export function renderGoalInputPanel(
  documentRef: Document,
  state: ForgeUiState,
  text: (path: string[], fallback: string, params?: Record<string, number | string>) => string,
  options: {
    draftBlockedReason: string | null;
    flowLabel: string;
    flowState: ForgeWorkbenchUiFlowState;
  }
): HTMLElement {
  const body = documentRef.createElement("div");
  body.className = "forge-panel__body forge-goal-panel";
  const currentGoal = state.snapshot.currentGoal;
  const activeSessionId = state.snapshot.activeSessionId;
  const goalState = (() => {
    switch (options.flowState) {
      case "IDLE":
        return {
          title: text(["workbench", "goalPanel", "guide", "idle", "title"], "PLAN OPEN"),
          summary: text(["workbench", "goalPanel", "guide", "idle", "summary"], "NEXT ACTION: SAVE GOAL"),
        };
      case "SESSION_CREATED":
        return {
          title: text(
            ["workbench", "goalPanel", "guide", "sessionCreated", "title"],
            "PLAN OPEN"
          ),
          summary: text(
            ["workbench", "goalPanel", "guide", "sessionCreated", "summary"],
            "NEXT ACTION: SAVE GOAL"
          ),
        };
      case "GOAL_DEFINED":
        return {
          title: text(["workbench", "goalPanel", "guide", "goalDefined", "title"], "PLAN READY"),
          summary: text(
            ["workbench", "goalPanel", "guide", "goalDefined", "summary"],
            "NEXT ACTION: GENERATE DRAFT"
          ),
        };
      case "DRAFT_READY":
        return {
          title: text(["workbench", "goalPanel", "guide", "draftReady", "title"], "PLAN ACTIVE"),
          summary: text(
            ["workbench", "goalPanel", "guide", "draftReady", "summary"],
            "NEXT ACTION: APPROVE DRAFT"
          ),
        };
      default:
        return {
          title: text(["workbench", "goalPanel", "guide", "locked", "title"], "PLAN LOCKED"),
          summary: text(
            ["workbench", "goalPanel", "guide", "locked", "summary"],
            "UPSTREAM EDITS DISABLED"
          ),
        };
    }
  })();
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
  summaryInput.placeholder = text(["workbench", "goalPanel", "placeholders", "goal"], "Goal");
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
  briefInput.placeholder = text(["workbench", "goalPanel", "placeholders", "brief"], "Brief");
  briefInput.value = currentGoal?.brief ?? "";
  briefInput.disabled = goalLocked;

  const constraintsInput = documentRef.createElement("textarea");
  constraintsInput.id = "forge-goal-constraints";
  constraintsInput.className = "forge-textarea forge-textarea--compact";
  constraintsInput.placeholder = text(
    ["workbench", "goalPanel", "placeholders", "constraints"],
    "One constraint per line"
  );
  constraintsInput.value = (currentGoal?.constraints ?? []).join("\n");
  constraintsInput.disabled = goalLocked;

  const summaryGrid = documentRef.createElement("div");
  summaryGrid.className = "forge-summary-strip";
  [
    {
      label: text(["workbench", "goalPanel", "summary", "targetLabel"], "Target"),
      value: currentGoal?.targetRoomId ?? "repair-room",
    },
    {
      label: text(["workbench", "goalPanel", "summary", "stateLabel"], "State"),
      value: options.flowLabel,
    },
    {
      label: text(["workbench", "goalPanel", "summary", "sessionLabel"], "Session"),
      value: activeSessionId
        ? activeSessionId.slice(0, 18)
        : text(["workbench", "goalPanel", "summary", "notStarted"], "not started"),
    },
    {
      label: text(["workbench", "goalPanel", "summary", "draftLabel"], "Draft"),
      value:
        topLevelDraftCount > 0
          ? topLevelDraftCount === 1
            ? text(
                ["workbench", "goalPanel", "summary", "draftCountOne"],
                "{count} task",
                { count: topLevelDraftCount }
              )
            : text(
                ["workbench", "goalPanel", "summary", "draftCountOther"],
                "{count} tasks",
                { count: topLevelDraftCount }
              )
          : text(["workbench", "goalPanel", "summary", "waiting"], "waiting"),
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
    createField(documentRef, text(["workbench", "goalPanel", "fields", "goal"], "Goal"), summaryInput),
    createField(
      documentRef,
      text(["workbench", "goalPanel", "fields", "targetRoom"], "Target room"),
      targetRoomInput
    ),
    createField(
      documentRef,
      text(["workbench", "goalPanel", "fields", "brief"], "Brief"),
      briefInput
    ),
    createField(
      documentRef,
      text(["workbench", "goalPanel", "fields", "constraints"], "Constraints"),
      constraintsInput,
      {
        hint: text(
          ["workbench", "goalPanel", "fields", "constraintsHint"],
          "One per line."
        ),
      }
    )
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
    const rail = documentRef.createElement("div");
    rail.className = "forge-session-rail";
    state.snapshot.sessionList.slice(0, 3).forEach((session) => {
      const item = documentRef.createElement("div");
      item.className = "forge-session-rail__item";
      const title = documentRef.createElement("strong");
      title.textContent = session.title;
      const meta = documentRef.createElement("span");
      meta.className = "forge-field__hint";
      meta.textContent = session.updatedAt;
      item.append(title, meta);
      rail.append(item);
    });
    sessionRail = rail;
  }

  body.append(createGuideCard(documentRef, goalState.title, goalState.summary));
  body.append(summaryGrid, fieldGrid, commandRail);
  if (sessionRail) {
    body.append(sessionRail);
  }

  return createForgePanel(documentRef, {
    panelId: "goal",
    eyebrow: text(["title"], state.context.roomName),
    title: text(["workbench", "panels", "goal"], "Goal"),
    body,
  });
}
