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

function toNullableSelectValue(value: string | null): string | null {
  return value ?? "";
}

function createAvailabilitySelect(
  documentRef: Document,
  inputId: string,
  selectedValue: boolean | null
): HTMLSelectElement {
  const select = documentRef.createElement("select");
  select.id = inputId;
  select.className = "forge-input";
  const normalizedValue =
    selectedValue === null ? "" : selectedValue === true ? "true" : "false";
  select.append(
    createOption(documentRef, "", "not set", normalizedValue),
    createOption(documentRef, "true", "available", normalizedValue),
    createOption(documentRef, "false", "unavailable", normalizedValue)
  );
  return select;
}

function createCheckboxField(
  documentRef: Document,
  labelText: string,
  inputId: string,
  checked: boolean
): HTMLElement {
  const wrapper = documentRef.createElement("label");
  wrapper.className = "forge-field";

  const row = documentRef.createElement("span");
  row.className = "forge-flow-item__meta";
  const checkbox = documentRef.createElement("input");
  checkbox.id = inputId;
  checkbox.type = "checkbox";
  checkbox.checked = checked;
  const label = documentRef.createElement("span");
  label.className = "forge-field__label";
  label.textContent = labelText;
  row.append(checkbox, label);
  wrapper.append(row);
  return wrapper;
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
          summary: text(
            ["workbench", "goalPanel", "guide", "idle", "summary"],
            "NEXT ACTION: SAVE GOAL"
          ),
        };
      case "SESSION_CREATED":
        return {
          title: text(["workbench", "goalPanel", "guide", "sessionCreated", "title"], "PLAN OPEN"),
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
      case "APPROVED":
      case "DISPATCHED":
      case "RESPONSES_READY":
      case "CONFLICT":
      case "SYNTHESIS_READY":
      case "EXPORTED":
        return {
          title: text(["workbench", "goalPanel", "guide", "locked", "title"], "PLAN LOCKED"),
          summary: text(
            ["workbench", "goalPanel", "guide", "locked", "summary"],
            "UPSTREAM EDITS DISABLED"
          ),
        };
      default: {
        const _exhaustive: never = options.flowState;
        return _exhaustive;
      }
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
            ? text(["workbench", "goalPanel", "summary", "draftCountOne"], "{count} task", {
                count: topLevelDraftCount,
              })
            : text(["workbench", "goalPanel", "summary", "draftCountOther"], "{count} tasks", {
                count: topLevelDraftCount,
              })
          : text(["workbench", "goalPanel", "summary", "waiting"], "waiting"),
    },
    {
      label: text(["workbench", "goalPanel", "summary", "preflightLabel"], "Preflight"),
      value: state.snapshot.preflight.status,
    },
    {
      label: text(["workbench", "goalPanel", "summary", "signatureLabel"], "Signature"),
      value: state.snapshot.runSignature?.value ?? "pending",
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
    createField(
      documentRef,
      text(["workbench", "goalPanel", "fields", "goal"], "Goal"),
      summaryInput
    ),
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
        hint: text(["workbench", "goalPanel", "fields", "constraintsHint"], "One per line."),
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

  const operatorProfile = state.snapshot.operatorProfile;
  const runOverride = state.snapshot.runOverride ?? {
    enableRovoPreAnalysis: false,
    notes: "",
    tools: {},
  };

  const skillLevelSelect = documentRef.createElement("select");
  skillLevelSelect.id = "forge-profile-skill-level";
  skillLevelSelect.className = "forge-input";
  skillLevelSelect.append(
    createOption(
      documentRef,
      "",
      text(["workbench", "common", "none"], "not set"),
      toNullableSelectValue(operatorProfile.skill.level)
    )
  );
  (["beginner", "intermediate", "advanced"] as const).forEach((value) => {
    skillLevelSelect.append(
      createOption(documentRef, value, value, toNullableSelectValue(operatorProfile.skill.level))
    );
  });

  const solderingSelect = documentRef.createElement("select");
  solderingSelect.id = "forge-profile-soldering";
  solderingSelect.className = "forge-input";
  solderingSelect.append(
    createOption(
      documentRef,
      "",
      text(["workbench", "common", "none"], "not set"),
      toNullableSelectValue(operatorProfile.skill.soldering)
    )
  );
  (["none", "basic", "good"] as const).forEach((value) => {
    solderingSelect.append(
      createOption(
        documentRef,
        value,
        value,
        toNullableSelectValue(operatorProfile.skill.soldering)
      )
    );
  });

  const measurementSelect = documentRef.createElement("select");
  measurementSelect.id = "forge-profile-measurement";
  measurementSelect.className = "forge-input";
  measurementSelect.append(
    createOption(
      documentRef,
      "",
      text(["workbench", "common", "none"], "not set"),
      toNullableSelectValue(operatorProfile.skill.measurement)
    )
  );
  (["none", "basic", "good"] as const).forEach((value) => {
    measurementSelect.append(
      createOption(
        documentRef,
        value,
        value,
        toNullableSelectValue(operatorProfile.skill.measurement)
      )
    );
  });

  const mechanicalSelect = documentRef.createElement("select");
  mechanicalSelect.id = "forge-profile-mechanical";
  mechanicalSelect.className = "forge-input";
  mechanicalSelect.append(
    createOption(
      documentRef,
      "",
      text(["workbench", "common", "none"], "not set"),
      toNullableSelectValue(operatorProfile.skill.mechanical)
    )
  );
  (["none", "basic", "good"] as const).forEach((value) => {
    mechanicalSelect.append(
      createOption(
        documentRef,
        value,
        value,
        toNullableSelectValue(operatorProfile.skill.mechanical)
      )
    );
  });

  const modeSelect = documentRef.createElement("select");
  modeSelect.id = "forge-profile-mode";
  modeSelect.className = "forge-input";
  modeSelect.append(
    createOption(
      documentRef,
      "",
      text(["workbench", "common", "none"], "not set"),
      toNullableSelectValue(operatorProfile.preferences.mode)
    )
  );
  (["learn-first", "result-first"] as const).forEach((value) => {
    modeSelect.append(
      createOption(
        documentRef,
        value,
        value,
        toNullableSelectValue(operatorProfile.preferences.mode)
      )
    );
  });

  const riskSelect = documentRef.createElement("select");
  riskSelect.id = "forge-profile-risk";
  riskSelect.className = "forge-input";
  riskSelect.append(
    createOption(
      documentRef,
      "",
      text(["workbench", "common", "none"], "not set"),
      toNullableSelectValue(operatorProfile.preferences.riskTolerance)
    )
  );
  (["low", "medium", "high"] as const).forEach((value) => {
    riskSelect.append(
      createOption(
        documentRef,
        value,
        value,
        toNullableSelectValue(operatorProfile.preferences.riskTolerance)
      )
    );
  });

  const multimeterSelect = createAvailabilitySelect(
    documentRef,
    "forge-profile-tool-multimeter",
    operatorProfile.tools.multimeter
  );
  const solderingIronSelect = createAvailabilitySelect(
    documentRef,
    "forge-profile-tool-soldering-iron",
    operatorProfile.tools.solderingIron
  );
  const hotAirSelect = createAvailabilitySelect(
    documentRef,
    "forge-profile-tool-hot-air",
    operatorProfile.tools.hotAir
  );
  const benchSupplySelect = createAvailabilitySelect(
    documentRef,
    "forge-profile-tool-bench-supply",
    operatorProfile.tools.benchPowerSupply
  );
  const magnificationSelect = createAvailabilitySelect(
    documentRef,
    "forge-profile-tool-magnification",
    operatorProfile.tools.magnification
  );

  const profileFields = documentRef.createElement("div");
  profileFields.className = "forge-form-grid forge-form-grid--goal";
  profileFields.append(
    createField(documentRef, "Skill level", skillLevelSelect),
    createField(documentRef, "Soldering", solderingSelect),
    createField(documentRef, "Measurement", measurementSelect),
    createField(documentRef, "Mechanical", mechanicalSelect),
    createField(documentRef, "Mode", modeSelect),
    createField(documentRef, "Risk", riskSelect),
    createField(documentRef, "Multimeter", multimeterSelect),
    createField(documentRef, "Soldering iron", solderingIronSelect),
    createField(documentRef, "Hot air", hotAirSelect),
    createField(documentRef, "Bench supply", benchSupplySelect),
    createField(documentRef, "Magnification", magnificationSelect)
  );

  const overrideNotes = documentRef.createElement("textarea");
  overrideNotes.id = "forge-run-override-notes";
  overrideNotes.className = "forge-textarea forge-textarea--compact";
  overrideNotes.placeholder = text(
    ["workbench", "goalPanel", "placeholders", "overrideNotes"],
    "Temporary condition for this run"
  );
  overrideNotes.value = runOverride.notes ?? "";

  const preflightWarnings = documentRef.createElement("div");
  preflightWarnings.className = "forge-flow-item__meta";
  state.snapshot.preflight.warnings.slice(0, 3).forEach((warning) => {
    const chip = documentRef.createElement("span");
    chip.className = "forge-chip forge-chip--warning";
    chip.textContent = warning;
    preflightWarnings.append(chip);
  });

  const runContextFields = documentRef.createElement("div");
  runContextFields.className = "forge-form-grid forge-form-grid--goal";
  runContextFields.append(
    createCheckboxField(
      documentRef,
      "Temporary hot air",
      "forge-run-override-hot-air",
      runOverride.tools.hotAir === true
    ),
    createCheckboxField(
      documentRef,
      "Enable pre-analysis",
      "forge-run-override-pre-analysis",
      runOverride.enableRovoPreAnalysis === true
    ),
    createField(documentRef, "Run notes", overrideNotes)
  );

  const profileRail = documentRef.createElement("div");
  profileRail.className = "forge-actions";
  profileRail.append(
    createButton(documentRef, "Save profile", "save-operator-profile"),
    createButton(documentRef, "Save run context", "save-run-override"),
    createButton(
      documentRef,
      "Run preflight",
      "run-preflight",
      {
        disabled: !currentGoal?.summary.trim(),
      }
    )
  );

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
  body.append(
    createGuideCard(
      documentRef,
      "Operator profile",
      "Persistent operator capacity for future Forge runs. Leave fields as not set until you want them to shape preflight."
    )
  );
  body.append(profileFields);
  body.append(createGuideCard(documentRef, "Run context", "Session-local overrides and preflight refresh."));
  body.append(runContextFields, profileRail);
  if (state.snapshot.preflight.warnings.length > 0) {
    body.append(preflightWarnings);
  }
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
