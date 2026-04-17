import type {
  ForgeOperatorEquipmentRecord,
  ForgeOperatorProfile,
  ForgeOperatorSkillRecord,
  ForgeSessionContextSelection,
} from "../../shared/types/index.js";
import type { ForgeUiState, ForgeWorkbenchUiFlowState } from "../../shared/ui/state.js";
import { createForgePanel } from "./panel-shell.js";

type ForgeTextFn = (
  path: string[],
  fallback: string,
  params?: Record<string, number | string>
) => string;

type ForgeGoalDraftView = {
  brief: string;
  constraints: string[];
  summary: string;
  targetRoomId: string;
};

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
    actionValue?: string;
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
  if (options.actionValue) {
    button.dataset["forgeActionValue"] = options.actionValue;
  }
  button.disabled = options.disabled === true;
  button.textContent = label;
  return button;
}

function createOption(
  documentRef: Document,
  value: string,
  label: string,
  selectedValue: string
): HTMLOptionElement {
  const option = documentRef.createElement("option");
  option.value = value;
  option.textContent = label;
  option.selected = selectedValue === value;
  return option;
}

function createSectionHeading(
  documentRef: Document,
  eyebrowText: string,
  titleText: string,
  options: {
    actions?: HTMLElement[];
    meta?: string | null;
  } = {}
): HTMLElement {
  const header = documentRef.createElement("div");
  header.className = "forge-section-heading";

  const copy = documentRef.createElement("div");
  copy.className = "forge-section-heading__copy";
  if (eyebrowText.trim() !== "") {
    const eyebrow = documentRef.createElement("p");
    eyebrow.className = "forge-panel__eyebrow";
    eyebrow.textContent = eyebrowText;
    copy.append(eyebrow);
  }
  const title = documentRef.createElement("h3");
  title.className = "forge-section-heading__title";
  title.textContent = titleText;
  copy.append(title);
  header.append(copy);

  if (options.meta || (options.actions?.length ?? 0) > 0) {
    const aside = documentRef.createElement("div");
    aside.className = "forge-section-heading__aside";
    if (options.meta) {
      const meta = documentRef.createElement("span");
      meta.className = "forge-chip forge-chip--soft";
      meta.textContent = options.meta;
      aside.append(meta);
    }
    if (options.actions && options.actions.length > 0) {
      const rail = documentRef.createElement("div");
      rail.className = "forge-actions";
      rail.append(...options.actions);
      aside.append(rail);
    }
    header.append(aside);
  }

  return header;
}

function createMetaPill(documentRef: Document, label: string, value: string): HTMLElement {
  const pill = documentRef.createElement("div");
  pill.className = "forge-meta-pill";
  const copy = documentRef.createElement("span");
  copy.className = "forge-meta-pill__label";
  copy.textContent = label;
  const strong = documentRef.createElement("strong");
  strong.className = "forge-meta-pill__value";
  strong.textContent = value;
  pill.append(copy, strong);
  return pill;
}

function createPreparationStep(
  documentRef: Document,
  params: {
    detail: string;
    index: string;
    status: "active" | "idle" | "ready" | "warning";
    statusLabel: string;
    title: string;
  }
): HTMLElement {
  const step = documentRef.createElement("article");
  step.className = "forge-prep-step";
  step.dataset["status"] = params.status;

  const index = documentRef.createElement("span");
  index.className = "forge-prep-step__index";
  index.textContent = params.index;

  const copy = documentRef.createElement("div");
  copy.className = "forge-prep-step__copy";
  const title = documentRef.createElement("strong");
  title.className = "forge-prep-step__title";
  title.textContent = params.title;
  const detail = documentRef.createElement("p");
  detail.className = "forge-prep-step__detail";
  detail.textContent = params.detail;
  copy.append(title, detail);

  const status = documentRef.createElement("span");
  status.className = "forge-prep-step__status";
  status.textContent = params.statusLabel;

  step.append(index, copy, status);
  return step;
}

function countSelectedSessionContext(selection: ForgeSessionContextSelection): number {
  return selection.skillKeys.length + selection.equipmentKeys.length;
}

function countOperatorRecords(profile: ForgeOperatorProfile): number {
  return profile.skills.length + profile.equipment.length;
}

function toPreflightStatusLabel(
  status: ForgeUiState["snapshot"]["preflight"]["status"],
  text: ForgeTextFn
): string {
  if (status === "fresh") {
    return text(["workbench", "goalPanel", "preflight", "ready"], "ready");
  }
  if (status === "warning") {
    return text(["workbench", "goalPanel", "preflight", "warning"], "needs review");
  }
  if (status === "stale") {
    return text(["workbench", "goalPanel", "preflight", "stale"], "stale");
  }
  return text(["workbench", "goalPanel", "preflight", "idle"], "idle");
}

function renderSkillValue(text: ForgeTextFn, value: ForgeOperatorSkillRecord["level"]): string {
  return text(
    ["workbench", "goalPanel", "operatorProfile", "skillLevels", value],
    value.replace(/_/g, " ")
  );
}

function renderEquipmentValue(
  text: ForgeTextFn,
  value: ForgeOperatorEquipmentRecord["status"]
): string {
  return text(
    ["workbench", "goalPanel", "operatorProfile", "equipmentStatus", value],
    value.replace(/_/g, " ")
  );
}

function renderModeValue(text: ForgeTextFn, value: string): string {
  return text(
    ["workbench", "goalPanel", "operatorProfile", "modeValues", value],
    value.replace(/_/g, " ")
  );
}

function renderRiskValue(text: ForgeTextFn, value: string): string {
  return text(
    ["workbench", "goalPanel", "operatorProfile", "riskValues", value],
    value.replace(/_/g, " ")
  );
}

function createContextChip(
  documentRef: Document,
  params: {
    detail: string;
    disabled?: boolean;
    key: string;
    label: string;
    section: "equipment" | "skill";
    selected: boolean;
  }
): HTMLElement {
  const button = documentRef.createElement("button");
  button.type = "button";
  button.className = "forge-context-chip";
  button.dataset["forgeContextChip"] = "true";
  button.dataset["forgeContextKey"] = params.key;
  button.dataset["forgeContextSection"] = params.section;
  button.dataset["selected"] = params.selected ? "true" : "false";
  button.disabled = params.disabled === true;

  const label = documentRef.createElement("span");
  label.className = "forge-context-chip__label";
  label.textContent = params.label;
  const detail = documentRef.createElement("span");
  detail.className = "forge-context-chip__detail";
  detail.textContent = params.detail;
  button.append(label, detail);
  return button;
}

function createContextGroup(
  documentRef: Document,
  title: string,
  chips: HTMLElement[],
  emptyText: string
): HTMLElement {
  const group = documentRef.createElement("section");
  group.className = "forge-context-group";
  const heading = documentRef.createElement("h4");
  heading.className = "forge-context-group__title";
  heading.textContent = title;
  const list = documentRef.createElement("div");
  list.className = "forge-context-group__list forge-context-group__list--chips";
  if (chips.length > 0) {
    list.append(...chips);
  } else {
    const emptyWrap = documentRef.createElement("div");
    emptyWrap.className = "forge-context-group__empty";
    const empty = documentRef.createElement("p");
    empty.className = "forge-field__hint";
    empty.textContent = emptyText;
    emptyWrap.append(empty);
    list.append(emptyWrap);
  }
  group.append(heading, list);
  return group;
}

function renderNotesBlock(
  documentRef: Document,
  text: ForgeTextFn,
  notes: string,
  options: {
    disabled?: boolean;
  } = {}
): HTMLElement {
  const notesInput = documentRef.createElement("textarea");
  notesInput.id = "forge-run-override-notes";
  notesInput.className = "forge-textarea forge-textarea--compact";
  notesInput.value = notes;
  notesInput.dataset["forgeRunOverrideField"] = "notes";
  notesInput.disabled = options.disabled === true;
  notesInput.placeholder = text(
    ["workbench", "goalPanel", "runOverrides", "notesPlaceholderLong"],
    "Optional run note for this session"
  );
  return createField(
    documentRef,
    text(["workbench", "goalPanel", "runOverrides", "notes"], "Run notes"),
    notesInput
  );
}

export function renderGoalInputPanel(
  documentRef: Document,
  state: ForgeUiState,
  text: ForgeTextFn,
  options: {
    draftBlockedReason: string | null;
    flowLabel: string;
    flowState: ForgeWorkbenchUiFlowState;
    goalDetailsOpen: boolean;
    goalDraft: ForgeGoalDraftView;
    runConditionComposerOpen: boolean;
    runConditionComposerValue: string;
    runOverrideDraft: {
      enableRovoPreAnalysis: boolean;
      mode?: string;
      notes: string;
      riskTolerance?: string;
      temporaryConditions: string[];
    };
    sessionContextDirty: boolean;
    sessionContextSelection: ForgeSessionContextSelection;
  }
): HTMLElement {
  const body = documentRef.createElement("div");
  body.className = "forge-panel__body forge-goal-panel";

  const currentGoal = state.snapshot.currentGoal;
  const operatorProfile: ForgeOperatorProfile = state.snapshot.operatorProfile;
  const sessionContextSelection = options.sessionContextSelection;
  const selectedContextCount = countSelectedSessionContext(sessionContextSelection);
  const operatorRecordCount = countOperatorRecords(operatorProfile);
  const savedGoalExists = Boolean(currentGoal?.summary.trim());
  const goalHasDraftInput =
    options.goalDraft.summary.trim() !== "" ||
    options.goalDraft.brief.trim() !== "" ||
    options.goalDraft.targetRoomId.trim() !== "" ||
    options.goalDraft.constraints.some((constraint) => constraint.trim() !== "");
  const goalConstraintCount = options.goalDraft.constraints.filter(
    (constraint) => constraint.trim() !== ""
  ).length;
  const goalTargetValue = options.goalDraft.targetRoomId.trim();
  const goalBriefValue = options.goalDraft.brief.trim();
  const sessionActive = state.snapshot.activeSessionId !== null;
  const goalLocked =
    options.flowState === "APPROVED" ||
    options.flowState === "DISPATCHED" ||
    options.flowState === "RESPONSES_READY" ||
    options.flowState === "CONFLICT" ||
    options.flowState === "SYNTHESIS_READY" ||
    options.flowState === "EXPORTED";
  const preflightStatusLabel =
    options.sessionContextDirty && currentGoal !== null
      ? text(["workbench", "goalPanel", "preflight", "stale"], "stale")
      : toPreflightStatusLabel(state.snapshot.preflight.status, text);
  const preflightWarningCount = state.snapshot.preflight.warnings.length;
  const goalStepStatus: "active" | "idle" | "ready" | "warning" = savedGoalExists
    ? "ready"
    : goalHasDraftInput
      ? "active"
      : "idle";
  const sessionStepStatus: "active" | "idle" | "ready" | "warning" = sessionActive
    ? "ready"
    : state.snapshot.sessionList.length > 0
      ? "active"
      : "idle";
  const operatorStepStatus: "active" | "idle" | "ready" | "warning" =
    operatorRecordCount === 0
      ? "warning"
      : sessionActive && selectedContextCount > 0
        ? "ready"
        : "active";
  const preflightStepStatus: "active" | "idle" | "ready" | "warning" = !sessionActive ||
    !savedGoalExists
    ? "idle"
    : preflightWarningCount > 0 || state.snapshot.preflight.status === "warning"
      ? "warning"
      : options.sessionContextDirty || state.snapshot.preflight.status === "stale"
        ? "active"
        : state.snapshot.preflight.status === "fresh"
          ? "ready"
          : "active";
  const goalStepDetail = savedGoalExists
    ? text(
        ["workbench", "goalPanel", "launchChecklist", "goalReady"],
        "Saved target is ready for draft generation."
      )
    : goalHasDraftInput
      ? text(
          ["workbench", "goalPanel", "launchChecklist", "goalActive"],
          "Draft is in progress. Save the target before preflight."
        )
      : text(
          ["workbench", "goalPanel", "launchChecklist", "goalIdle"],
          "Define the target room, brief, and constraints for this run."
        );
  const sessionStepDetail = sessionActive
    ? text(
        ["workbench", "goalPanel", "launchChecklist", "sessionReady"],
        "Active session is attached to this run."
      )
    : state.snapshot.sessionList.length > 0
      ? text(
          ["workbench", "goalPanel", "launchChecklist", "sessionActive"],
          "Saved sessions are available. Open one or create a new run shell."
        )
      : text(
          ["workbench", "goalPanel", "launchChecklist", "sessionIdle"],
          "Create a session to keep run-local decisions together."
        );
  const operatorStepDetail =
    operatorRecordCount === 0
      ? text(
          ["workbench", "goalPanel", "launchChecklist", "operatorIdle"],
          "Operator profile is blank. AI will assume no saved tools or skills."
        )
      : sessionActive && selectedContextCount > 0
        ? text(
            ["workbench", "goalPanel", "launchChecklist", "operatorReady"],
            "{selected} run truths selected from {total} saved records.",
            {
              selected: selectedContextCount,
              total: operatorRecordCount,
            }
          )
        : text(
            ["workbench", "goalPanel", "launchChecklist", "operatorActive"],
            "{total} saved records are available. Pick the truths that should affect this run.",
            {
              total: operatorRecordCount,
            }
          );
  const preflightStepDetail = !sessionActive || !savedGoalExists
    ? text(
        ["workbench", "goalPanel", "launchChecklist", "preflightIdle"],
        "Preflight unlocks after an active session and a saved goal exist."
      )
    : preflightWarningCount > 0 || state.snapshot.preflight.status === "warning"
      ? text(
          ["workbench", "goalPanel", "launchChecklist", "preflightWarning"],
          "Preflight found warnings. Review them before you continue."
        )
      : options.sessionContextDirty || state.snapshot.preflight.status === "stale"
        ? text(
            ["workbench", "goalPanel", "launchChecklist", "preflightStale"],
            "Goal, context, or run settings changed. Refresh preflight before launch."
          )
        : text(
            ["workbench", "goalPanel", "launchChecklist", "preflightReady"],
            "Run context is validated and ready for draft generation."
          );
  const goalStatusLabel = text(
    ["workbench", "goalPanel", "launchChecklist", "statuses", goalStepStatus],
    goalStepStatus
  );
  const sessionStatusLabel = text(
    ["workbench", "goalPanel", "launchChecklist", "statuses", sessionStepStatus],
    sessionStepStatus
  );
  const operatorStatusLabel = text(
    ["workbench", "goalPanel", "launchChecklist", "statuses", operatorStepStatus],
    operatorStepStatus
  );
  const preflightStatusStepLabel = text(
    ["workbench", "goalPanel", "launchChecklist", "statuses", preflightStepStatus],
    preflightStepStatus
  );

  const goalInput = documentRef.createElement("input");
  goalInput.id = "forge-goal-summary";
  goalInput.className = "forge-input forge-input--goal";
  goalInput.value = options.goalDraft.summary;
  goalInput.placeholder = text(["workbench", "goalPanel", "placeholders", "goal"], "Goal");
  goalInput.disabled = goalLocked;
  goalInput.dataset["forgeGoalField"] = "summary";

  const briefInput = documentRef.createElement("textarea");
  briefInput.id = "forge-goal-brief";
  briefInput.className = "forge-textarea forge-textarea--compact";
  briefInput.value = options.goalDraft.brief;
  briefInput.placeholder = text(["workbench", "goalPanel", "placeholders", "brief"], "Brief");
  briefInput.dataset["forgeGoalField"] = "brief";
  briefInput.disabled = goalLocked;

  const constraintsInput = documentRef.createElement("textarea");
  constraintsInput.id = "forge-goal-constraints";
  constraintsInput.className = "forge-textarea forge-textarea--compact";
  constraintsInput.value = options.goalDraft.constraints.join("\n");
  constraintsInput.placeholder = text(
    ["workbench", "goalPanel", "placeholders", "constraints"],
    "One constraint per line"
  );
  constraintsInput.dataset["forgeGoalField"] = "constraints";
  constraintsInput.disabled = goalLocked;

  const targetRoomInput = documentRef.createElement("input");
  targetRoomInput.id = "forge-goal-target-room";
  targetRoomInput.className = "forge-input";
  targetRoomInput.value = options.goalDraft.targetRoomId;
  targetRoomInput.placeholder = "repair-room";
  targetRoomInput.dataset["forgeGoalField"] = "targetRoomId";
  targetRoomInput.disabled = goalLocked;

  const preparationBlock = documentRef.createElement("section");
  preparationBlock.className = "forge-goal-block forge-goal-block--prep";
  preparationBlock.dataset["forgeZone"] = "launch-checklist";
  preparationBlock.append(
    createSectionHeading(
      documentRef,
      text(["workbench", "goalPanel", "launchChecklist", "eyebrow"], "START LANE"),
      text(["workbench", "goalPanel", "launchChecklist", "title"], "Prepare this Forge run")
    )
  );

  const preparationIntro = documentRef.createElement("p");
  preparationIntro.className = "forge-block-note";
  preparationIntro.textContent = text(
    ["workbench", "goalPanel", "launchChecklist", "summary"],
    "Before the first draft, lock the target, choose a session, reconcile operator truths, and run preflight."
  );
  preparationBlock.append(preparationIntro);

  const preparationList = documentRef.createElement("div");
  preparationList.className = "forge-prep-list";
  preparationList.append(
    createPreparationStep(documentRef, {
      index: "01",
      status: goalStepStatus,
      statusLabel: goalStatusLabel,
      title: text(["workbench", "goalPanel", "launchChecklist", "goalTitle"], "Goal details"),
      detail: goalStepDetail,
    }),
    createPreparationStep(documentRef, {
      index: "02",
      status: sessionStepStatus,
      statusLabel: sessionStatusLabel,
      title: text(
        ["workbench", "goalPanel", "launchChecklist", "sessionTitle"],
        "Session selection"
      ),
      detail: sessionStepDetail,
    }),
    createPreparationStep(documentRef, {
      index: "03",
      status: operatorStepStatus,
      statusLabel: operatorStatusLabel,
      title: text(
        ["workbench", "goalPanel", "launchChecklist", "operatorTitle"],
        "Operator details"
      ),
      detail: operatorStepDetail,
    }),
    createPreparationStep(documentRef, {
      index: "04",
      status: preflightStepStatus,
      statusLabel: preflightStatusStepLabel,
      title: text(
        ["workbench", "goalPanel", "launchChecklist", "preflightTitle"],
        "Preflight gate"
      ),
      detail: preflightStepDetail,
    })
  );
  preparationBlock.append(preparationList);

  const goalBlock = documentRef.createElement("section");
  goalBlock.className = "forge-goal-block forge-goal-block--compact";
  goalBlock.dataset["forgeZone"] = "goal";
  goalBlock.append(
    createSectionHeading(
      documentRef,
      text(["workbench", "goalPanel", "goalBlock", "eyebrow"], "Goal"),
      text(["workbench", "goalPanel", "goalBlock", "title"], "Set the run target")
    )
  );

  const goalTopline = documentRef.createElement("div");
  goalTopline.className = "forge-goal-topline";
  goalTopline.append(
    goalInput,
    createButton(
      documentRef,
      options.goalDetailsOpen
        ? text(["workbench", "goalPanel", "actions", "hideDetails"], "Hide details")
        : text(["workbench", "goalPanel", "actions", "showDetails"], "Goal details"),
      "toggle-goal-details"
    )
  );
  goalBlock.append(goalTopline);

  const goalMeta = documentRef.createElement("div");
  goalMeta.className = "forge-goal-meta";
  goalMeta.append(
    createMetaPill(
      documentRef,
      text(["workbench", "goalPanel", "summary", "targetLabel"], "Target"),
      goalTargetValue !== ""
        ? goalTargetValue
        : text(["workbench", "goalPanel", "summary", "waiting"], "waiting")
    ),
    createMetaPill(
      documentRef,
      text(["workbench", "goalPanel", "summary", "briefLabel"], "Brief"),
      goalBriefValue !== ""
        ? text(["workbench", "goalPanel", "summary", "filled"], "filled")
        : text(["workbench", "goalPanel", "summary", "waiting"], "waiting")
    ),
    createMetaPill(
      documentRef,
      text(["workbench", "goalPanel", "summary", "constraintsLabel"], "Constraints"),
      goalConstraintCount === 1
        ? text(
            ["workbench", "goalPanel", "summary", "constraintCountOne"],
            "{count} item",
            { count: goalConstraintCount }
          )
        : text(
            ["workbench", "goalPanel", "summary", "constraintCountOther"],
            "{count} items",
            { count: goalConstraintCount }
          )
    )
  );
  goalBlock.append(goalMeta);

  const goalLead = documentRef.createElement("p");
  goalLead.className = "forge-block-note";
  goalLead.textContent = savedGoalExists
    ? text(
        ["workbench", "goalPanel", "goalBlock", "savedHint"],
        "Saved target will drive the first draft generation and downstream handoff."
      )
    : goalHasDraftInput
      ? text(
          ["workbench", "goalPanel", "goalBlock", "draftHint"],
          "This target is still local. Save it before preflight or draft generation."
        )
      : text(
          ["workbench", "goalPanel", "goalBlock", "emptyHint"],
          "Set the problem, target room, and constraints before the room starts producing work."
        );
  goalBlock.append(goalLead);

  if (goalBriefValue !== "") {
    const goalPreview = documentRef.createElement("p");
    goalPreview.className = "forge-goal-preview";
    goalPreview.textContent = goalBriefValue;
    goalBlock.append(goalPreview);
  }

  if (options.goalDetailsOpen) {
    const goalDetails = documentRef.createElement("div");
    goalDetails.className = "forge-inline-editor";
    goalDetails.append(
      createField(
        documentRef,
        text(["workbench", "goalPanel", "fields", "brief"], "Brief"),
        briefInput
      ),
      createField(
        documentRef,
        text(["workbench", "goalPanel", "fields", "constraints"], "Constraints"),
        constraintsInput
      ),
      createField(
        documentRef,
        text(["workbench", "goalPanel", "fields", "targetRoom"], "Target room"),
        targetRoomInput
      )
    );
    goalBlock.append(goalDetails);
  }

  const sessionBlock = documentRef.createElement("section");
  sessionBlock.className = "forge-goal-block forge-goal-block--session";
  sessionBlock.dataset["forgeZone"] = "session-management";
  sessionBlock.append(
    createSectionHeading(
      documentRef,
      text(["workbench", "goalPanel", "sessionManager", "eyebrow"], "SESSION MANAGEMENT"),
      text(["workbench", "goalPanel", "sessionManager", "title"], "Manage session"),
      {
        meta:
          state.snapshot.activeSessionId !== null
            ? text(["workbench", "goalPanel", "sessionManager", "active"], "active")
            : text(["workbench", "goalPanel", "sessionManager", "inactive"], "not open"),
      }
    )
  );

  const sessionLead = documentRef.createElement("p");
  sessionLead.className = "forge-block-note";
  sessionLead.textContent = sessionActive
    ? text(
        ["workbench", "goalPanel", "sessionManager", "activeHint"],
        "This active session stores the goal, run context, and preflight output for the current pass."
      )
    : state.snapshot.sessionList.length > 0
      ? text(
          ["workbench", "goalPanel", "sessionManager", "savedHint"],
          "Open a saved session or start a fresh shell before selecting run-local context."
        )
      : text(
          ["workbench", "goalPanel", "sessionManager", "emptyHint"],
          "Create the first session so Forge can persist your preparation state."
        );
  sessionBlock.append(sessionLead);

  const activeSessionSummary = documentRef.createElement("div");
  activeSessionSummary.className = "forge-session-summary";
  activeSessionSummary.append(
    createMetaPill(
      documentRef,
      text(["workbench", "goalPanel", "summary", "sessionLabel"], "Session"),
      state.snapshot.activeSessionId ??
        text(["workbench", "goalPanel", "summary", "notStarted"], "not started")
    ),
    createMetaPill(
      documentRef,
      text(["workbench", "goalPanel", "sessionManager", "savedCount"], "Saved"),
      String(state.snapshot.sessionList.length)
    )
  );
  sessionBlock.append(activeSessionSummary);

  const sessionActions = documentRef.createElement("div");
  sessionActions.className = "forge-actions";
  sessionActions.append(
    createButton(
      documentRef,
      text(["workbench", "goalPanel", "sessionManager", "newSession"], "New session"),
      "create-session"
    ),
    createButton(
      documentRef,
      text(["workbench", "goalPanel", "sessionManager", "saveSession"], "Save session"),
      "save-session",
      { disabled: state.snapshot.activeSessionId === null }
    ),
    createButton(
      documentRef,
      text(["workbench", "goalPanel", "sessionManager", "loadLatest"], "Load latest"),
      "load-latest"
    ),
    createButton(
      documentRef,
      text(["workbench", "goalPanel", "sessionManager", "deleteSession"], "Delete session"),
      "delete-session",
      { disabled: state.snapshot.activeSessionId === null }
    )
  );
  const deleteButton = sessionActions.querySelector<HTMLElement>(
    "[data-forge-action='delete-session']"
  );
  if (deleteButton && state.snapshot.activeSessionId) {
    deleteButton.dataset["forgeSessionId"] = state.snapshot.activeSessionId;
  }
  sessionBlock.append(sessionActions);

  const sessionList = documentRef.createElement("div");
  sessionList.className = "forge-session-list";
  if (state.snapshot.sessionList.length === 0) {
    sessionList.append(
      Object.assign(documentRef.createElement("p"), {
        className: "forge-field__hint",
        textContent: text(["workbench", "states", "emptySessions"], "No saved sessions yet."),
      })
    );
  } else {
    state.snapshot.sessionList.slice(0, 5).forEach((session) => {
      const item = documentRef.createElement("article");
      item.className = "forge-session-list__item";
      item.dataset["active"] = session.id === state.snapshot.activeSessionId ? "true" : "false";
      const copy = documentRef.createElement("div");
      copy.className = "forge-session-list__copy";
      copy.append(
        Object.assign(documentRef.createElement("strong"), {
          textContent: session.title,
        }),
        Object.assign(documentRef.createElement("span"), {
          className: "forge-field__hint",
          textContent: session.updatedAt,
        })
      );
      const actions = documentRef.createElement("div");
      actions.className = "forge-actions";
      const openButton = createButton(
        documentRef,
        text(["workbench", "goalPanel", "sessionManager", "openSavedSession"], "Open"),
        "load-session"
      );
      openButton.dataset["forgeSessionId"] = session.id;
      actions.append(openButton);
      item.append(copy, actions);
      sessionList.append(item);
    });
  }
  sessionBlock.append(sessionList);

  const sessionContextBlock = documentRef.createElement("section");
  sessionContextBlock.className = "forge-goal-block forge-goal-block--context";
  sessionContextBlock.dataset["forgeZone"] = "context";
  sessionContextBlock.append(
    createSectionHeading(
      documentRef,
      text(["workbench", "goalPanel", "operatorProfile", "eyebrow"], "Operator profile"),
      text(["workbench", "goalPanel", "operatorProfile", "prepTitle"], "Operator details"),
      {
        meta:
          selectedContextCount > 0
            ? text(
                ["workbench", "goalPanel", "sessionContext", "selectedCount"],
                "{count} active",
                { count: selectedContextCount }
              )
            : text(["workbench", "goalPanel", "sessionContext", "noneSelected"], "0 active"),
        actions: [
          createButton(
            documentRef,
            text(["workbench", "goalPanel", "operatorProfile", "manage"], "Manage"),
            "toggle-profile-editor"
          ),
        ],
      }
    )
  );

  const operatorLead = documentRef.createElement("p");
  operatorLead.className = "forge-block-note";
  operatorLead.textContent =
    operatorRecordCount === 0
      ? text(
          ["workbench", "goalPanel", "operatorProfile", "empty"],
          "No operator profile defined. AI will assume no prior capability."
        )
      : !sessionActive
        ? text(
            ["workbench", "goalPanel", "operatorProfile", "noSessionHint"],
            "Saved operator records are ready. Open a session to choose which truths affect this run."
          )
        : selectedContextCount > 0
          ? text(
              ["workbench", "goalPanel", "operatorProfile", "readyHint"],
              "{count} selected truths will shape this run.",
              { count: selectedContextCount }
            )
          : text(
              ["workbench", "goalPanel", "operatorProfile", "selectHint"],
              "Saved records exist, but this run still uses zero assumptions until you select context."
            );
  sessionContextBlock.append(operatorLead);

  const operatorSummary = documentRef.createElement("div");
  operatorSummary.className = "forge-goal-meta";
  operatorSummary.append(
    createMetaPill(
      documentRef,
      text(["workbench", "goalPanel", "catalog", "groups", "skills"], "Skills"),
      String(operatorProfile.skills.length)
    ),
    createMetaPill(
      documentRef,
      text(["workbench", "goalPanel", "catalog", "groups", "equipment"], "Equipment"),
      String(operatorProfile.equipment.length)
    ),
    createMetaPill(
      documentRef,
      text(["workbench", "goalPanel", "operatorProfile", "selectedLabel"], "Selected"),
      String(selectedContextCount)
    )
  );
  sessionContextBlock.append(operatorSummary);

  if (sessionActive) {
    const operatorHint = documentRef.createElement("p");
    operatorHint.className = "forge-field__hint";
    operatorHint.textContent = text(
      ["workbench", "goalPanel", "operatorProfile", "selectedTruthHint"],
      "Only selected items can influence this run."
    );
    sessionContextBlock.append(operatorHint);
  } else {
    const requiresSession = documentRef.createElement("p");
    requiresSession.className = "forge-field__hint";
    requiresSession.textContent = text(
      ["workbench", "goalPanel", "sessionContext", "requiresSession"],
      "Create or open a session to edit this run context."
    );
    sessionContextBlock.append(requiresSession);
  }

  const contextGroups = documentRef.createElement("div");
  contextGroups.className = "forge-context-groups forge-context-groups--scroll";
  contextGroups.append(
    createContextGroup(
      documentRef,
      text(["workbench", "goalPanel", "catalog", "groups", "skills"], "Skills"),
      operatorProfile.skills.map((record) =>
        createContextChip(documentRef, {
          disabled: !sessionActive,
          section: "skill",
          key: record.skillKey,
          label: record.label,
          detail: renderSkillValue(text, record.level),
          selected: sessionContextSelection.skillKeys.includes(record.skillKey),
        })
      ),
      text(
        ["workbench", "goalPanel", "sessionContext", "emptySkills"],
        "No saved skills yet. Use Operator Profile from the top bar."
      )
    ),
    createContextGroup(
      documentRef,
      text(["workbench", "goalPanel", "catalog", "groups", "equipment"], "Equipment"),
      operatorProfile.equipment.map((record) =>
        createContextChip(documentRef, {
          disabled: !sessionActive,
          section: "equipment",
          key: record.equipmentKey,
          label: record.label,
          detail: record.brandModel
            ? `${renderEquipmentValue(text, record.status)} • ${record.brandModel}`
            : renderEquipmentValue(text, record.status),
          selected: sessionContextSelection.equipmentKeys.includes(record.equipmentKey),
        })
      ),
      text(
        ["workbench", "goalPanel", "sessionContext", "emptyEquipment"],
        "No saved equipment yet. Use Operator Profile from the top bar."
      )
    )
  );
  sessionContextBlock.append(contextGroups);

  const launchBlock = documentRef.createElement("section");
  launchBlock.className = "forge-goal-block forge-goal-block--launch";
  launchBlock.dataset["forgeZone"] = "preflight";
  launchBlock.append(
    createSectionHeading(
      documentRef,
      text(["workbench", "goalPanel", "preflight", "eyebrow"], "PRE-FLIGHT"),
      text(["workbench", "goalPanel", "preflight", "title"], "Validate run context"),
      {
        meta: preflightStatusLabel,
      }
    )
  );

  const launchLead = documentRef.createElement("p");
  launchLead.className = "forge-block-note";
  launchLead.textContent = !sessionActive
    ? text(
        ["workbench", "goalPanel", "preflight", "requiresSessionHint"],
        "Create or open a session before running preflight."
      )
    : !savedGoalExists
      ? text(
          ["workbench", "goalPanel", "preflight", "requiresGoalHint"],
          "Save the target before preflight can validate this run."
        )
      : state.snapshot.preflight.status === "warning" || preflightWarningCount > 0
        ? text(
            ["workbench", "goalPanel", "preflight", "warningHint"],
            "Preflight completed with warnings. Review the notes before you move forward."
          )
        : options.sessionContextDirty || state.snapshot.preflight.status === "stale"
          ? state.snapshot.preflight.staleReason?.trim() ||
            text(
              ["workbench", "goalPanel", "preflight", "staleHint"],
              "Context changed after the last preflight run. Refresh before launch."
            )
          : text(
              ["workbench", "goalPanel", "preflight", "readyHint"],
              "Run-local settings are aligned. Use preflight as the last gate before draft generation."
            );
  launchBlock.append(launchLead);

  const launchSummary = documentRef.createElement("div");
  launchSummary.className = "forge-goal-meta";
  launchSummary.append(
    createMetaPill(
      documentRef,
      text(["workbench", "goalPanel", "summary", "sessionLabel"], "Session"),
      sessionActive
        ? text(["workbench", "goalPanel", "sessionManager", "active"], "active")
        : text(["workbench", "goalPanel", "summary", "notStarted"], "not started")
    ),
    createMetaPill(
      documentRef,
      text(["workbench", "goalPanel", "summary", "targetLabel"], "Target"),
      goalTargetValue !== ""
        ? goalTargetValue
        : text(["workbench", "goalPanel", "summary", "waiting"], "waiting")
    ),
    createMetaPill(
      documentRef,
      text(["workbench", "goalPanel", "summary", "preflightLabel"], "PRE-FLIGHT"),
      preflightStatusLabel
    )
  );
  launchBlock.append(launchSummary);

  const preflightBlock = documentRef.createElement("article");
  preflightBlock.className = "forge-preflight-step forge-goal-subsection forge-goal-subsection--accent";
  preflightBlock.dataset["forgeZone"] = "preflight-step";
  preflightBlock.dataset["status"] = preflightStatusLabel;
  const preflightCopy = documentRef.createElement("div");
  preflightCopy.className = "forge-preflight-step__copy";
  const preflightTitle = documentRef.createElement("strong");
  preflightTitle.className = "forge-preflight-step__title";
  preflightTitle.textContent = !sessionActive
    ? text(["workbench", "goalPanel", "preflight", "requiresSession"], "REQUIRES: ACTIVE SESSION")
    : !savedGoalExists
      ? text(["workbench", "guards", "requiresSavedGoal"], "REQUIRES: GOAL")
      : state.snapshot.preflight.status === "warning" || preflightWarningCount > 0
        ? text(
            ["workbench", "goalPanel", "preflight", "stepWarning"],
            "Preflight flagged warnings"
          )
        : state.snapshot.preflight.status === "fresh"
        ? text(["workbench", "goalPanel", "preflight", "stepComplete"], "Preflight complete")
        : text(["workbench", "goalPanel", "preflight", "stepReady"], "Context ready");
  const preflightMeta = documentRef.createElement("span");
  preflightMeta.className = "forge-preflight-step__meta";
  preflightMeta.textContent = `${text(
    ["workbench", "goalPanel", "preflight", "label"],
    "Preflight"
  )}: ${preflightStatusLabel}`;
  preflightCopy.append(preflightTitle, preflightMeta);
  preflightBlock.append(
    preflightCopy,
    createButton(
      documentRef,
      text(["workbench", "goalPanel", "preflight", "action"], "Run Preflight"),
      "run-preflight",
      {
        disabled: !savedGoalExists || !sessionActive,
      }
    )
  );
  if (state.snapshot.preflight.warnings.length > 0) {
    const warningRail = documentRef.createElement("div");
    warningRail.className = "forge-flow-item__meta";
    state.snapshot.preflight.warnings.slice(0, 3).forEach((warning) => {
      const chip = documentRef.createElement("span");
      chip.className = "forge-chip forge-chip--warning";
      chip.textContent = warning;
      warningRail.append(chip);
    });
    preflightBlock.append(warningRail);
  }

  const runOverridesBlock = documentRef.createElement("section");
  runOverridesBlock.className = "forge-goal-subsection forge-goal-subsection--muted";
  runOverridesBlock.dataset["forgeZone"] = "overrides";
  runOverridesBlock.append(
    createSectionHeading(
      documentRef,
      text(["workbench", "goalPanel", "runOverrides", "eyebrow"], "SESSION-SPECIFIC"),
      text(["workbench", "goalPanel", "runOverrides", "title"], "Run settings"),
      {
        meta: text(["workbench", "goalPanel", "runOverrides", "meta"], "Run-local only"),
      }
    )
  );

  const sessionSpecificGrid = documentRef.createElement("div");
  sessionSpecificGrid.className = "forge-form-grid forge-form-grid--compact";

  const modeSelect = documentRef.createElement("select");
  modeSelect.id = "forge-run-override-mode";
  modeSelect.className = "forge-input";
  modeSelect.disabled = !sessionActive;
  modeSelect.append(
    createOption(
      documentRef,
      "",
      text(["workbench", "common", "none"], "none"),
      options.runOverrideDraft.mode || ""
    ),
    createOption(
      documentRef,
      "learn_first",
      renderModeValue(text, "learn_first"),
      options.runOverrideDraft.mode || ""
    ),
    createOption(
      documentRef,
      "result_first",
      renderModeValue(text, "result_first"),
      options.runOverrideDraft.mode || ""
    )
  );

  const riskSelect = documentRef.createElement("select");
  riskSelect.id = "forge-run-override-risk";
  riskSelect.className = "forge-input";
  riskSelect.disabled = !sessionActive;
  riskSelect.append(
    createOption(
      documentRef,
      "",
      text(["workbench", "common", "none"], "none"),
      options.runOverrideDraft.riskTolerance || ""
    ),
    createOption(
      documentRef,
      "low",
      renderRiskValue(text, "low"),
      options.runOverrideDraft.riskTolerance || ""
    ),
    createOption(
      documentRef,
      "medium",
      renderRiskValue(text, "medium"),
      options.runOverrideDraft.riskTolerance || ""
    ),
    createOption(
      documentRef,
      "high",
      renderRiskValue(text, "high"),
      options.runOverrideDraft.riskTolerance || ""
    )
  );

  sessionSpecificGrid.append(
    createField(
      documentRef,
      text(["workbench", "goalPanel", "runOverrides", "mode"], "Mode"),
      modeSelect
    ),
    createField(
      documentRef,
      text(["workbench", "goalPanel", "runOverrides", "risk"], "Risk tolerance"),
      riskSelect
    )
  );
  runOverridesBlock.append(sessionSpecificGrid);

  const overrideToggles = documentRef.createElement("div");
  overrideToggles.className = "forge-chip-row";
  const preAnalysisToggle = documentRef.createElement("button");
  preAnalysisToggle.type = "button";
  preAnalysisToggle.className = "forge-context-chip forge-context-chip--small";
  preAnalysisToggle.dataset["forgeRunOverrideToggle"] = "preAnalysis";
  preAnalysisToggle.dataset["selected"] =
    options.runOverrideDraft.enableRovoPreAnalysis === true ? "true" : "false";
  preAnalysisToggle.disabled = !sessionActive;
  preAnalysisToggle.append(
    Object.assign(documentRef.createElement("span"), {
      className: "forge-context-chip__label",
      textContent: text(["workbench", "goalPanel", "runOverrides", "preAnalysis"], "Pre-analysis"),
    }),
    Object.assign(documentRef.createElement("span"), {
      className: "forge-context-chip__detail",
      textContent:
        options.runOverrideDraft.enableRovoPreAnalysis === true
          ? text(["workbench", "goalPanel", "runOverrides", "active"], "active")
          : text(["workbench", "goalPanel", "runOverrides", "inactive"], "inactive"),
    })
  );
  overrideToggles.append(preAnalysisToggle);
  runOverridesBlock.append(overrideToggles);

  const conditionsRail = documentRef.createElement("div");
  conditionsRail.className = "forge-chip-row";
  options.runOverrideDraft.temporaryConditions.forEach((condition) => {
    const chip = documentRef.createElement("button");
    chip.type = "button";
    chip.className = "forge-condition-chip";
    chip.dataset["forgeRemoveRunCondition"] = condition;
    chip.disabled = !sessionActive;
    chip.append(
      Object.assign(documentRef.createElement("span"), {
        textContent: condition,
      }),
      Object.assign(documentRef.createElement("span"), {
        className: "forge-condition-chip__remove",
        textContent: "x",
      })
    );
    conditionsRail.append(chip);
  });
  runOverridesBlock.append(conditionsRail);

  runOverridesBlock.append(
    renderNotesBlock(documentRef, text, options.runOverrideDraft.notes, {
      disabled: !sessionActive,
    })
  );

  const conditionActions = documentRef.createElement("div");
  conditionActions.className = "forge-actions";
  conditionActions.append(
    createButton(
      documentRef,
      text(["workbench", "goalPanel", "runOverrides", "addCondition"], "+ Add condition"),
      "toggle-run-condition-composer",
      {
        disabled: !sessionActive,
      }
    )
  );
  runOverridesBlock.append(conditionActions);

  if (options.runConditionComposerOpen) {
    const composer = documentRef.createElement("div");
    composer.className = "forge-inline-editor forge-inline-editor--row";
    const input = documentRef.createElement("input");
    input.id = "forge-run-override-condition-input";
    input.className = "forge-input";
    input.value = options.runConditionComposerValue;
    input.disabled = !sessionActive;
    input.placeholder = text(
      ["workbench", "goalPanel", "runOverrides", "notesPlaceholder"],
      "Temporary condition for this run"
    );
    composer.append(
      input,
      createButton(
        documentRef,
        text(["workbench", "goalPanel", "runOverrides", "commitCondition"], "Add"),
        "commit-run-condition",
        {
          disabled: !sessionActive,
        }
      ),
      createButton(
        documentRef,
        text(["workbench", "goalPanel", "runOverrides", "cancelCondition"], "Cancel"),
        "cancel-run-condition",
        {
          disabled: !sessionActive,
        }
      )
    );
    runOverridesBlock.append(composer);
  }

  const launchStack = documentRef.createElement("div");
  launchStack.className = "forge-goal-substack";
  launchStack.append(runOverridesBlock, preflightBlock);
  launchBlock.append(launchStack);

  const mainStack = documentRef.createElement("div");
  mainStack.className = "forge-goal-stack";
  mainStack.append(
    preparationBlock,
    goalBlock,
    sessionBlock,
    sessionContextBlock,
    launchBlock
  );

  const layout = documentRef.createElement("div");
  layout.className = "forge-goal-layout forge-goal-layout--single";
  layout.append(mainStack);
  body.append(layout);

  const panel = createForgePanel(documentRef, {
    panelId: "goal",
    title: text(["workbench", "panels", "goal"], "Control Surface"),
    body,
  });
  panel.dataset["forgeGoalEditable"] = "true";
  return panel;
}
