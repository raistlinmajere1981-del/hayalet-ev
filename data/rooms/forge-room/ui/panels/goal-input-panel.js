import { createForgePanel } from "./panel-shell.js";
function createField(documentRef, labelText, control, options) {
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
function createButton(documentRef, label, action, options = {}) {
  const button = documentRef.createElement("button");
  button.type = "button";
  button.className = options.primary ? "forge-button forge-button--primary" : "forge-button forge-button--secondary";
  if (action) {
    button.dataset["forgeAction"] = action;
  }
  if (options.actionValue) {
    button.dataset["forgeActionValue"] = options.actionValue;
  }
  if (options.datasetKey && options.datasetValue) {
    button.dataset[options.datasetKey] = options.datasetValue;
  }
  button.disabled = options.disabled === true;
  button.textContent = label;
  return button;
}
function createOption(documentRef, value, label, selectedValue) {
  const option = documentRef.createElement("option");
  option.value = value;
  option.textContent = label;
  option.selected = selectedValue === value;
  return option;
}
function toNullableSelectValue(value) {
  return value ?? "";
}
function createAvailabilitySelect(documentRef, inputId, selectedValue, text) {
  const select = documentRef.createElement("select");
  select.id = inputId;
  select.className = "forge-input";
  const normalizedValue = selectedValue === null ? "" : selectedValue === true ? "true" : "false";
  select.append(
    createOption(
      documentRef,
      "",
      text(["workbench", "goalPanel", "operatorProfile", "values", "notSet"], "unset"),
      normalizedValue
    ),
    createOption(
      documentRef,
      "true",
      text(["workbench", "goalPanel", "operatorProfile", "values", "available"], "available"),
      normalizedValue
    ),
    createOption(
      documentRef,
      "false",
      text(["workbench", "goalPanel", "operatorProfile", "values", "unavailable"], "unavailable"),
      normalizedValue
    )
  );
  return select;
}
function createSectionHeading(documentRef, eyebrowText, titleText, options = {}) {
  const header = documentRef.createElement("div");
  header.className = "forge-section-heading";
  const copy = documentRef.createElement("div");
  copy.className = "forge-section-heading__copy";
  const eyebrow = documentRef.createElement("p");
  eyebrow.className = "forge-panel__eyebrow";
  eyebrow.textContent = eyebrowText;
  const title = documentRef.createElement("h3");
  title.className = "forge-section-heading__title";
  title.textContent = titleText;
  copy.append(eyebrow, title);
  header.append(copy);
  if (options.meta) {
    const meta = documentRef.createElement("span");
    meta.className = "forge-chip forge-chip--soft";
    meta.textContent = options.meta;
    header.append(meta);
  }
  return header;
}
function createMetaPill(documentRef, label, value) {
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
function isOperatorProfileEmpty(profile) {
  return [
    profile.skill.level,
    profile.skill.soldering,
    profile.skill.measurement,
    profile.skill.mechanical,
    profile.tools.multimeter,
    profile.tools.solderingIron,
    profile.tools.hotAir,
    profile.tools.benchPowerSupply,
    profile.tools.magnification,
    profile.preferences.mode,
    profile.preferences.riskTolerance
  ].every((value) => value === null);
}
function countSelectedSessionContext(selection) {
  return [
    selection.skill.level,
    selection.skill.soldering,
    selection.skill.measurement,
    selection.skill.mechanical,
    selection.tools.multimeter,
    selection.tools.solderingIron,
    selection.tools.hotAir,
    selection.tools.benchPowerSupply,
    selection.tools.magnification,
    selection.preferences.mode,
    selection.preferences.riskTolerance
  ].filter((value) => value === true).length;
}
function toPreflightStatusLabel(status, text) {
  const alias = status === "fresh" || status === "warning" ? "ready" : status;
  if (alias === "ready") {
    return text(["workbench", "goalPanel", "preflight", "ready"], "ready");
  }
  if (alias === "stale") {
    return text(["workbench", "goalPanel", "preflight", "stale"], "stale");
  }
  return text(["workbench", "goalPanel", "preflight", "idle"], "idle");
}
function toProfileValueLabel(value, text) {
  return value ?? text(["workbench", "goalPanel", "operatorProfile", "values", "notSet"], "unset");
}
function toToolValueLabel(value, text) {
  if (value === true) {
    return text(["workbench", "goalPanel", "operatorProfile", "values", "available"], "available");
  }
  if (value === false) {
    return text(
      ["workbench", "goalPanel", "operatorProfile", "values", "unavailable"],
      "unavailable"
    );
  }
  return text(["workbench", "goalPanel", "operatorProfile", "values", "notSet"], "unset");
}
function notesToConditions(notes) {
  return notes.split(/\r?\n/).map((entry) => entry.trim()).filter((entry) => entry !== "");
}
function createContextChip(documentRef, params) {
  const button = documentRef.createElement("button");
  button.type = "button";
  button.id = params.id;
  button.className = "forge-context-chip";
  button.dataset["forgeContextChip"] = "true";
  button.dataset["forgeContextKey"] = params.key;
  button.dataset["forgeContextSection"] = params.section;
  button.dataset["forgeContextUnset"] = params.unset ? "true" : "false";
  button.dataset["forgeProfileEntry"] = params.entryId;
  button.dataset["selected"] = params.selected && !params.unset ? "true" : "false";
  button.dataset["unset"] = params.unset ? "true" : "false";
  const label = documentRef.createElement("span");
  label.className = "forge-context-chip__label";
  label.textContent = params.label;
  const detail = documentRef.createElement("span");
  detail.className = "forge-context-chip__detail";
  detail.textContent = params.detail;
  button.append(label, detail);
  return button;
}
function createContextGroup(documentRef, title, chips) {
  const group = documentRef.createElement("section");
  group.className = "forge-context-group";
  const heading = documentRef.createElement("h4");
  heading.className = "forge-context-group__title";
  heading.textContent = title;
  const list = documentRef.createElement("div");
  list.className = "forge-context-group__list forge-context-group__list--chips";
  list.append(...chips);
  group.append(heading, list);
  return group;
}
function createProfileEditorItem(documentRef, params) {
  const item = documentRef.createElement("article");
  item.className = "forge-profile-item";
  item.dataset["active"] = params.active ? "true" : "false";
  params.control.dataset["forgeProfileField"] = params.entryId;
  const button = documentRef.createElement("button");
  button.type = "button";
  button.className = "forge-profile-item__toggle";
  button.dataset["forgeProfileEntry"] = params.entryId;
  const label = documentRef.createElement("span");
  label.className = "forge-profile-item__label";
  label.textContent = params.label;
  const value = documentRef.createElement("span");
  value.className = "forge-profile-item__value";
  value.textContent = params.valueLabel;
  button.append(label, value);
  item.append(button);
  if (params.active) {
    const editor = documentRef.createElement("div");
    editor.className = "forge-profile-item__editor";
    const field = createField(documentRef, params.label, params.control);
    field.dataset["forgeProfileInput"] = params.inputId;
    editor.append(field);
    item.append(editor);
  }
  return item;
}
function createProfileEditorSection(documentRef, title, items) {
  const section = documentRef.createElement("section");
  section.className = "forge-profile-section";
  const heading = documentRef.createElement("h4");
  heading.className = "forge-context-group__title";
  heading.textContent = title;
  const list = documentRef.createElement("div");
  list.className = "forge-profile-list";
  list.append(...items);
  section.append(heading, list);
  return section;
}
export function renderGoalInputPanel(documentRef, state, text, options) {
  const body = documentRef.createElement("div");
  body.className = "forge-panel__body forge-goal-panel";
  const currentGoal = state.snapshot.currentGoal;
  const operatorProfile = state.snapshot.operatorProfile;
  const operatorProfileDraft = options.operatorProfileDraft;
  const sessionContextSelection = options.sessionContextSelection;
  const selectedContextCount = countSelectedSessionContext(sessionContextSelection);
  const savedGoalExists = Boolean(currentGoal?.summary.trim());
  const profileEmpty = isOperatorProfileEmpty(operatorProfile);
  const conditions = notesToConditions(options.runOverrideDraft.notes);
  const goalLocked = options.flowState === "APPROVED" || options.flowState === "DISPATCHED" || options.flowState === "RESPONSES_READY" || options.flowState === "CONFLICT" || options.flowState === "SYNTHESIS_READY" || options.flowState === "EXPORTED";
  const preflightStatusLabel = options.sessionContextDirty && currentGoal !== null ? text(["workbench", "goalPanel", "preflight", "stale"], "stale") : toPreflightStatusLabel(state.snapshot.preflight.status, text);
  const catalog = {
    equipmentGroup: text(["workbench", "goalPanel", "catalog", "groups", "equipment"], "Equipment"),
    generalGroup: text(["workbench", "goalPanel", "catalog", "groups", "general"], "General"),
    skillsGroup: text(["workbench", "goalPanel", "catalog", "groups", "skills"], "Skills"),
    labels: {
      benchSupply: text(
        ["workbench", "goalPanel", "catalog", "items", "benchSupply"],
        "Bench supply"
      ),
      hotAir: text(["workbench", "goalPanel", "catalog", "items", "hotAir"], "Hot air"),
      magnification: text(
        ["workbench", "goalPanel", "catalog", "items", "magnification"],
        "Magnification"
      ),
      measurement: text(
        ["workbench", "goalPanel", "catalog", "items", "measurement"],
        "Measurement"
      ),
      mechanical: text(["workbench", "goalPanel", "catalog", "items", "mechanical"], "Mechanical"),
      mode: text(["workbench", "goalPanel", "catalog", "items", "mode"], "Mode"),
      multimeter: text(["workbench", "goalPanel", "catalog", "items", "multimeter"], "Multimeter"),
      risk: text(["workbench", "goalPanel", "catalog", "items", "risk"], "Risk"),
      skillLevel: text(["workbench", "goalPanel", "catalog", "items", "skillLevel"], "Skill level"),
      soldering: text(["workbench", "goalPanel", "catalog", "items", "soldering"], "Soldering"),
      solderingIron: text(
        ["workbench", "goalPanel", "catalog", "items", "solderingIron"],
        "Soldering iron"
      )
    }
  };
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
  const skillLevelSelect = documentRef.createElement("select");
  skillLevelSelect.id = "forge-profile-skill-level";
  skillLevelSelect.className = "forge-input";
  skillLevelSelect.append(
    createOption(
      documentRef,
      "",
      text(["workbench", "goalPanel", "operatorProfile", "values", "notSet"], "unset"),
      toNullableSelectValue(operatorProfileDraft.skill.level)
    )
  );
  ["beginner", "intermediate", "advanced"].forEach((value) => {
    skillLevelSelect.append(
      createOption(
        documentRef,
        value,
        value,
        toNullableSelectValue(operatorProfileDraft.skill.level)
      )
    );
  });
  const solderingSelect = documentRef.createElement("select");
  solderingSelect.id = "forge-profile-soldering";
  solderingSelect.className = "forge-input";
  solderingSelect.append(
    createOption(
      documentRef,
      "",
      text(["workbench", "goalPanel", "operatorProfile", "values", "notSet"], "unset"),
      toNullableSelectValue(operatorProfileDraft.skill.soldering)
    )
  );
  ["none", "basic", "good"].forEach((value) => {
    solderingSelect.append(
      createOption(
        documentRef,
        value,
        value,
        toNullableSelectValue(operatorProfileDraft.skill.soldering)
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
      text(["workbench", "goalPanel", "operatorProfile", "values", "notSet"], "unset"),
      toNullableSelectValue(operatorProfileDraft.skill.measurement)
    )
  );
  ["none", "basic", "good"].forEach((value) => {
    measurementSelect.append(
      createOption(
        documentRef,
        value,
        value,
        toNullableSelectValue(operatorProfileDraft.skill.measurement)
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
      text(["workbench", "goalPanel", "operatorProfile", "values", "notSet"], "unset"),
      toNullableSelectValue(operatorProfileDraft.skill.mechanical)
    )
  );
  ["none", "basic", "good"].forEach((value) => {
    mechanicalSelect.append(
      createOption(
        documentRef,
        value,
        value,
        toNullableSelectValue(operatorProfileDraft.skill.mechanical)
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
      text(["workbench", "goalPanel", "operatorProfile", "values", "notSet"], "unset"),
      toNullableSelectValue(operatorProfileDraft.preferences.mode)
    )
  );
  ["learn-first", "result-first"].forEach((value) => {
    modeSelect.append(
      createOption(
        documentRef,
        value,
        value,
        toNullableSelectValue(operatorProfileDraft.preferences.mode)
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
      text(["workbench", "goalPanel", "operatorProfile", "values", "notSet"], "unset"),
      toNullableSelectValue(operatorProfileDraft.preferences.riskTolerance)
    )
  );
  ["low", "medium", "high"].forEach((value) => {
    riskSelect.append(
      createOption(
        documentRef,
        value,
        value,
        toNullableSelectValue(operatorProfileDraft.preferences.riskTolerance)
      )
    );
  });
  const multimeterSelect = createAvailabilitySelect(
    documentRef,
    "forge-profile-tool-multimeter",
    operatorProfileDraft.tools.multimeter,
    text
  );
  const solderingIronSelect = createAvailabilitySelect(
    documentRef,
    "forge-profile-tool-soldering-iron",
    operatorProfileDraft.tools.solderingIron,
    text
  );
  const hotAirSelect = createAvailabilitySelect(
    documentRef,
    "forge-profile-tool-hot-air",
    operatorProfileDraft.tools.hotAir,
    text
  );
  const benchSupplySelect = createAvailabilitySelect(
    documentRef,
    "forge-profile-tool-bench-supply",
    operatorProfileDraft.tools.benchPowerSupply,
    text
  );
  const magnificationSelect = createAvailabilitySelect(
    documentRef,
    "forge-profile-tool-magnification",
    operatorProfileDraft.tools.magnification,
    text
  );
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
      options.goalDetailsOpen ? text(["workbench", "goalPanel", "actions", "hideDetails"], "Hide details") : text(["workbench", "goalPanel", "actions", "showDetails"], "Goal details"),
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
      options.goalDraft.targetRoomId || "repair-room"
    )
  );
  if (options.flowState === "IDLE" && state.snapshot.sessionList.length > 0) {
    goalMeta.append(
      createButton(
        documentRef,
        text(["workbench", "actions", "loadLatestSession"], "Resume latest run"),
        "load-latest"
      )
    );
  }
  goalBlock.append(goalMeta);
  if (options.draftBlockedReason) {
    const blocked = documentRef.createElement("p");
    blocked.className = "forge-inline-status";
    blocked.textContent = options.draftBlockedReason;
    goalBlock.append(blocked);
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
  const sessionContextBlock = documentRef.createElement("section");
  sessionContextBlock.className = "forge-goal-block forge-goal-block--context";
  sessionContextBlock.dataset["forgeZone"] = "context";
  sessionContextBlock.append(
    createSectionHeading(
      documentRef,
      text(["workbench", "goalPanel", "sessionContext", "eyebrow"], "Context for this run"),
      text(["workbench", "goalPanel", "sessionContext", "title"], "Activate context"),
      {
        meta: selectedContextCount > 0 ? text(
          ["workbench", "goalPanel", "sessionContext", "selectedCount"],
          "{count} active",
          { count: selectedContextCount }
        ) : text(["workbench", "goalPanel", "sessionContext", "noneSelected"], "0 active")
      }
    )
  );
  const operatorRow = documentRef.createElement("div");
  operatorRow.className = "forge-operator-inline";
  const operatorCopy = documentRef.createElement("div");
  operatorCopy.className = "forge-operator-inline__copy";
  const operatorLabel = documentRef.createElement("strong");
  operatorLabel.className = "forge-operator-inline__title";
  operatorLabel.textContent = `${text(
    ["workbench", "goalPanel", "operatorProfile", "label"],
    "Operator"
  )}: ${state.context.userNickname}`;
  operatorCopy.append(operatorLabel);
  if (profileEmpty) {
    const operatorHint = documentRef.createElement("span");
    operatorHint.className = "forge-field__hint";
    operatorHint.textContent = text(
      ["workbench", "goalPanel", "operatorProfile", "emptyShort"],
      "Profile blank"
    );
    operatorCopy.append(operatorHint);
  }
  operatorRow.append(
    operatorCopy,
    createButton(
      documentRef,
      text(["workbench", "goalPanel", "operatorProfile", "manage"], "Edit"),
      "toggle-profile-editor"
    )
  );
  sessionContextBlock.append(operatorRow);
  const contextGroups = documentRef.createElement("div");
  contextGroups.className = "forge-context-groups";
  contextGroups.append(
    createContextGroup(documentRef, catalog.skillsGroup, [
      createContextChip(documentRef, {
        detail: toProfileValueLabel(operatorProfile.skill.level, text),
        entryId: "skill-level",
        id: "forge-session-context-skill-level",
        key: "level",
        label: catalog.labels.skillLevel,
        section: "skill",
        selected: sessionContextSelection.skill.level === true && operatorProfile.skill.level !== null,
        unset: operatorProfile.skill.level === null
      }),
      createContextChip(documentRef, {
        detail: toProfileValueLabel(operatorProfile.skill.soldering, text),
        entryId: "skill-soldering",
        id: "forge-session-context-skill-soldering",
        key: "soldering",
        label: catalog.labels.soldering,
        section: "skill",
        selected: sessionContextSelection.skill.soldering === true && operatorProfile.skill.soldering !== null,
        unset: operatorProfile.skill.soldering === null
      }),
      createContextChip(documentRef, {
        detail: toProfileValueLabel(operatorProfile.skill.measurement, text),
        entryId: "skill-measurement",
        id: "forge-session-context-skill-measurement",
        key: "measurement",
        label: catalog.labels.measurement,
        section: "skill",
        selected: sessionContextSelection.skill.measurement === true && operatorProfile.skill.measurement !== null,
        unset: operatorProfile.skill.measurement === null
      }),
      createContextChip(documentRef, {
        detail: toProfileValueLabel(operatorProfile.skill.mechanical, text),
        entryId: "skill-mechanical",
        id: "forge-session-context-skill-mechanical",
        key: "mechanical",
        label: catalog.labels.mechanical,
        section: "skill",
        selected: sessionContextSelection.skill.mechanical === true && operatorProfile.skill.mechanical !== null,
        unset: operatorProfile.skill.mechanical === null
      })
    ]),
    createContextGroup(documentRef, catalog.equipmentGroup, [
      createContextChip(documentRef, {
        detail: toToolValueLabel(operatorProfile.tools.multimeter, text),
        entryId: "tool-multimeter",
        id: "forge-session-context-tool-multimeter",
        key: "multimeter",
        label: catalog.labels.multimeter,
        section: "tools",
        selected: sessionContextSelection.tools.multimeter === true && operatorProfile.tools.multimeter !== null,
        unset: operatorProfile.tools.multimeter === null
      }),
      createContextChip(documentRef, {
        detail: toToolValueLabel(operatorProfile.tools.solderingIron, text),
        entryId: "tool-soldering-iron",
        id: "forge-session-context-tool-soldering-iron",
        key: "solderingIron",
        label: catalog.labels.solderingIron,
        section: "tools",
        selected: sessionContextSelection.tools.solderingIron === true && operatorProfile.tools.solderingIron !== null,
        unset: operatorProfile.tools.solderingIron === null
      }),
      createContextChip(documentRef, {
        detail: toToolValueLabel(operatorProfile.tools.hotAir, text),
        entryId: "tool-hot-air",
        id: "forge-session-context-tool-hot-air",
        key: "hotAir",
        label: catalog.labels.hotAir,
        section: "tools",
        selected: sessionContextSelection.tools.hotAir === true && operatorProfile.tools.hotAir !== null,
        unset: operatorProfile.tools.hotAir === null
      }),
      createContextChip(documentRef, {
        detail: toToolValueLabel(operatorProfile.tools.benchPowerSupply, text),
        entryId: "tool-bench-supply",
        id: "forge-session-context-tool-bench-supply",
        key: "benchPowerSupply",
        label: catalog.labels.benchSupply,
        section: "tools",
        selected: sessionContextSelection.tools.benchPowerSupply === true && operatorProfile.tools.benchPowerSupply !== null,
        unset: operatorProfile.tools.benchPowerSupply === null
      }),
      createContextChip(documentRef, {
        detail: toToolValueLabel(operatorProfile.tools.magnification, text),
        entryId: "tool-magnification",
        id: "forge-session-context-tool-magnification",
        key: "magnification",
        label: catalog.labels.magnification,
        section: "tools",
        selected: sessionContextSelection.tools.magnification === true && operatorProfile.tools.magnification !== null,
        unset: operatorProfile.tools.magnification === null
      })
    ]),
    createContextGroup(documentRef, catalog.generalGroup, [
      createContextChip(documentRef, {
        detail: toProfileValueLabel(operatorProfile.preferences.mode, text),
        entryId: "preference-mode",
        id: "forge-session-context-preference-mode",
        key: "mode",
        label: catalog.labels.mode,
        section: "preferences",
        selected: sessionContextSelection.preferences.mode === true && operatorProfile.preferences.mode !== null,
        unset: operatorProfile.preferences.mode === null
      }),
      createContextChip(documentRef, {
        detail: toProfileValueLabel(operatorProfile.preferences.riskTolerance, text),
        entryId: "preference-risk",
        id: "forge-session-context-preference-risk",
        key: "riskTolerance",
        label: catalog.labels.risk,
        section: "preferences",
        selected: sessionContextSelection.preferences.riskTolerance === true && operatorProfile.preferences.riskTolerance !== null,
        unset: operatorProfile.preferences.riskTolerance === null
      })
    ])
  );
  sessionContextBlock.append(contextGroups);
  const preflightBlock = documentRef.createElement("article");
  preflightBlock.className = "forge-preflight-step";
  preflightBlock.dataset["forgeZone"] = "preflight";
  preflightBlock.dataset["status"] = preflightStatusLabel;
  const preflightCopy = documentRef.createElement("div");
  preflightCopy.className = "forge-preflight-step__copy";
  const preflightTitle = documentRef.createElement("strong");
  preflightTitle.className = "forge-preflight-step__title";
  preflightTitle.textContent = !savedGoalExists ? text(["workbench", "guards", "requiresSavedGoal"], "REQUIRES: GOAL") : preflightStatusLabel === text(["workbench", "goalPanel", "preflight", "ready"], "ready") ? text(["workbench", "goalPanel", "preflight", "stepComplete"], "Preflight complete") : text(["workbench", "goalPanel", "preflight", "stepReady"], "Context ready");
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
        disabled: !savedGoalExists
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
  sessionContextBlock.append(preflightBlock);
  const runOverridesBlock = documentRef.createElement("section");
  runOverridesBlock.className = "forge-goal-block forge-goal-block--muted";
  runOverridesBlock.dataset["forgeZone"] = "overrides";
  runOverridesBlock.append(
    createSectionHeading(
      documentRef,
      text(["workbench", "goalPanel", "runOverrides", "eyebrow"], "Temporary conditions"),
      text(["workbench", "goalPanel", "runOverrides", "title"], "Temporary conditions")
    )
  );
  const overrideToggles = documentRef.createElement("div");
  overrideToggles.className = "forge-chip-row";
  const hotAirToggle = documentRef.createElement("button");
  hotAirToggle.type = "button";
  hotAirToggle.className = "forge-context-chip forge-context-chip--small";
  hotAirToggle.dataset["forgeRunOverrideToggle"] = "hotAir";
  hotAirToggle.dataset["selected"] = options.runOverrideDraft.tools.hotAir === true ? "true" : "false";
  hotAirToggle.append(
    Object.assign(documentRef.createElement("span"), {
      className: "forge-context-chip__label",
      textContent: text(["workbench", "goalPanel", "runOverrides", "tempHotAir"], "Hot air")
    }),
    Object.assign(documentRef.createElement("span"), {
      className: "forge-context-chip__detail",
      textContent: options.runOverrideDraft.tools.hotAir === true ? text(["workbench", "goalPanel", "runOverrides", "active"], "active") : text(["workbench", "goalPanel", "runOverrides", "inactive"], "inactive")
    })
  );
  const preAnalysisToggle = documentRef.createElement("button");
  preAnalysisToggle.type = "button";
  preAnalysisToggle.className = "forge-context-chip forge-context-chip--small";
  preAnalysisToggle.dataset["forgeRunOverrideToggle"] = "preAnalysis";
  preAnalysisToggle.dataset["selected"] = options.runOverrideDraft.enableRovoPreAnalysis === true ? "true" : "false";
  preAnalysisToggle.append(
    Object.assign(documentRef.createElement("span"), {
      className: "forge-context-chip__label",
      textContent: text(["workbench", "goalPanel", "runOverrides", "preAnalysis"], "Pre-analysis")
    }),
    Object.assign(documentRef.createElement("span"), {
      className: "forge-context-chip__detail",
      textContent: options.runOverrideDraft.enableRovoPreAnalysis === true ? text(["workbench", "goalPanel", "runOverrides", "active"], "active") : text(["workbench", "goalPanel", "runOverrides", "inactive"], "inactive")
    })
  );
  overrideToggles.append(hotAirToggle, preAnalysisToggle);
  runOverridesBlock.append(overrideToggles);
  const conditionsRail = documentRef.createElement("div");
  conditionsRail.className = "forge-chip-row";
  conditions.forEach((condition) => {
    const chip = documentRef.createElement("button");
    chip.type = "button";
    chip.className = "forge-condition-chip";
    chip.dataset["forgeRemoveRunCondition"] = condition;
    const label = documentRef.createElement("span");
    label.textContent = condition;
    const remove = documentRef.createElement("span");
    remove.className = "forge-condition-chip__remove";
    remove.textContent = "x";
    chip.append(label, remove);
    conditionsRail.append(chip);
  });
  runOverridesBlock.append(conditionsRail);
  const conditionActions = documentRef.createElement("div");
  conditionActions.className = "forge-actions";
  conditionActions.append(
    createButton(
      documentRef,
      text(["workbench", "goalPanel", "runOverrides", "addCondition"], "+ Add condition"),
      "toggle-run-condition-composer"
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
    input.placeholder = text(
      ["workbench", "goalPanel", "runOverrides", "notesPlaceholder"],
      "Temporary condition for this run"
    );
    composer.append(
      input,
      createButton(
        documentRef,
        text(["workbench", "goalPanel", "runOverrides", "commitCondition"], "Add"),
        "commit-run-condition"
      ),
      createButton(
        documentRef,
        text(["workbench", "goalPanel", "runOverrides", "cancelCondition"], "Cancel"),
        "cancel-run-condition"
      )
    );
    runOverridesBlock.append(composer);
  }
  const mainStack = documentRef.createElement("div");
  mainStack.className = "forge-goal-stack";
  mainStack.append(goalBlock, sessionContextBlock, runOverridesBlock);
  const layout = documentRef.createElement("div");
  layout.className = "forge-goal-layout";
  layout.append(mainStack);
  if (options.profileEditorOpen) {
    const drawer = documentRef.createElement("aside");
    drawer.className = "forge-profile-drawer";
    drawer.append(
      createSectionHeading(
        documentRef,
        text(["workbench", "goalPanel", "operatorProfile", "drawerEyebrow"], "PROFILE"),
        text(
          ["workbench", "goalPanel", "operatorProfile", "drawerTitle"],
          "Manage operator profile"
        )
      )
    );
    drawer.append(
      createProfileEditorSection(documentRef, catalog.skillsGroup, [
        createProfileEditorItem(documentRef, {
          active: options.activeProfileEntryId === "skill-level",
          control: skillLevelSelect,
          entryId: "skill-level",
          inputId: "forge-profile-skill-level",
          label: catalog.labels.skillLevel,
          valueLabel: toProfileValueLabel(operatorProfileDraft.skill.level, text)
        }),
        createProfileEditorItem(documentRef, {
          active: options.activeProfileEntryId === "skill-soldering",
          control: solderingSelect,
          entryId: "skill-soldering",
          inputId: "forge-profile-soldering",
          label: catalog.labels.soldering,
          valueLabel: toProfileValueLabel(operatorProfileDraft.skill.soldering, text)
        }),
        createProfileEditorItem(documentRef, {
          active: options.activeProfileEntryId === "skill-measurement",
          control: measurementSelect,
          entryId: "skill-measurement",
          inputId: "forge-profile-measurement",
          label: catalog.labels.measurement,
          valueLabel: toProfileValueLabel(operatorProfileDraft.skill.measurement, text)
        }),
        createProfileEditorItem(documentRef, {
          active: options.activeProfileEntryId === "skill-mechanical",
          control: mechanicalSelect,
          entryId: "skill-mechanical",
          inputId: "forge-profile-mechanical",
          label: catalog.labels.mechanical,
          valueLabel: toProfileValueLabel(operatorProfileDraft.skill.mechanical, text)
        })
      ]),
      createProfileEditorSection(documentRef, catalog.equipmentGroup, [
        createProfileEditorItem(documentRef, {
          active: options.activeProfileEntryId === "tool-multimeter",
          control: multimeterSelect,
          entryId: "tool-multimeter",
          inputId: "forge-profile-tool-multimeter",
          label: catalog.labels.multimeter,
          valueLabel: toToolValueLabel(operatorProfileDraft.tools.multimeter, text)
        }),
        createProfileEditorItem(documentRef, {
          active: options.activeProfileEntryId === "tool-soldering-iron",
          control: solderingIronSelect,
          entryId: "tool-soldering-iron",
          inputId: "forge-profile-tool-soldering-iron",
          label: catalog.labels.solderingIron,
          valueLabel: toToolValueLabel(operatorProfileDraft.tools.solderingIron, text)
        }),
        createProfileEditorItem(documentRef, {
          active: options.activeProfileEntryId === "tool-hot-air",
          control: hotAirSelect,
          entryId: "tool-hot-air",
          inputId: "forge-profile-tool-hot-air",
          label: catalog.labels.hotAir,
          valueLabel: toToolValueLabel(operatorProfileDraft.tools.hotAir, text)
        }),
        createProfileEditorItem(documentRef, {
          active: options.activeProfileEntryId === "tool-bench-supply",
          control: benchSupplySelect,
          entryId: "tool-bench-supply",
          inputId: "forge-profile-tool-bench-supply",
          label: catalog.labels.benchSupply,
          valueLabel: toToolValueLabel(operatorProfileDraft.tools.benchPowerSupply, text)
        }),
        createProfileEditorItem(documentRef, {
          active: options.activeProfileEntryId === "tool-magnification",
          control: magnificationSelect,
          entryId: "tool-magnification",
          inputId: "forge-profile-tool-magnification",
          label: catalog.labels.magnification,
          valueLabel: toToolValueLabel(operatorProfileDraft.tools.magnification, text)
        })
      ]),
      createProfileEditorSection(documentRef, catalog.generalGroup, [
        createProfileEditorItem(documentRef, {
          active: options.activeProfileEntryId === "preference-mode",
          control: modeSelect,
          entryId: "preference-mode",
          inputId: "forge-profile-mode",
          label: catalog.labels.mode,
          valueLabel: toProfileValueLabel(operatorProfileDraft.preferences.mode, text)
        }),
        createProfileEditorItem(documentRef, {
          active: options.activeProfileEntryId === "preference-risk",
          control: riskSelect,
          entryId: "preference-risk",
          inputId: "forge-profile-risk",
          label: catalog.labels.risk,
          valueLabel: toProfileValueLabel(operatorProfileDraft.preferences.riskTolerance, text)
        })
      ])
    );
    const drawerActions = documentRef.createElement("div");
    drawerActions.className = "forge-actions";
    drawerActions.append(
      createButton(
        documentRef,
        text(["workbench", "goalPanel", "operatorProfile", "save"], "Save profile"),
        "save-operator-profile"
      ),
      createButton(
        documentRef,
        text(["workbench", "goalPanel", "operatorProfile", "close"], "Close"),
        "toggle-profile-editor"
      )
    );
    drawer.append(drawerActions);
    layout.append(drawer);
  }
  body.append(layout);
  const panel = createForgePanel(documentRef, {
    panelId: "goal",
    eyebrow: text(["title"], state.context.roomName),
    title: text(["workbench", "panels", "goal"], "Control Surface"),
    body
  });
  panel.dataset["forgeGoalEditable"] = "true";
  return panel;
}
