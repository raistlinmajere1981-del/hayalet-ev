import type { RepairUiState } from "../../shared/ui/state.js";
import { createRepairPanel } from "./panel-shell.js";
import { renderRepairSettingsPanelBody } from "./repair-settings-panel.js";

type TextFn = (path: string[], fallback: string) => string;

export function renderOperatorProfilePanel(
  documentRef: Document,
  state: RepairUiState,
  text: TextFn
): HTMLElement {
  const body = documentRef.createElement("div");
  body.className = "repair-panel__body";

  const profile = state.operatorProfile.profile;
  const activeTab = state.layout.operatorProfileTabId;

  // -- Tabs
  const tabs = documentRef.createElement("div");
  tabs.className = "repair-tabs";

  const tabItems = [
    { id: "overview", label: text(["operatorProfile", "tabOverview"], "Profile Overview") },
    { id: "tools", label: text(["operatorProfile", "tabTools"], "Tools & Equipment") },
    { id: "skills", label: text(["operatorProfile", "tabSkills"], "Skills") },
    { id: "preferences", label: text(["operatorProfile", "tabPrefs"], "Preferences") },
    { id: "controls", label: text(["operatorProfile", "tabControls"], "Repair Controls") },
  ];

  for (const tab of tabItems) {
    const tabEl = documentRef.createElement("div");
    tabEl.className = `repair-tab${tab.id === activeTab ? " repair-tab--active" : ""}`;
    tabEl.textContent = tab.label;
    tabEl.dataset["repairAction"] = "operator-profile-tab";
    tabEl.dataset["tabId"] = tab.id;
    tabs.append(tabEl);
  }

  body.append(tabs);

  if (activeTab === "overview") {
    const overview = documentRef.createElement("div");
    overview.className = "repair-profile-overview";

    const name = documentRef.createElement("div");
    name.className = "repair-profile-name";
    name.textContent = profile.displayName;
    overview.append(name);

    const meta = documentRef.createElement("div");
    meta.className = "repair-profile-meta";
    meta.textContent = `${profile.bench.tools.filter((tool) => tool.available).length} tools ready / ${profile.bench.safety.filter((item) => item.available).length} safety checks active`;
    overview.append(meta);

    const preference = documentRef.createElement("div");
    preference.className = "repair-profile-meta";
    preference.textContent = `AI verbosity: ${profile.preferences.aiVerbosity} / risk tolerance: ${profile.preferences.riskTolerance}`;
    overview.append(preference);

    body.append(overview);
  }

  if (activeTab === "tools") {
    const toolsGrid = documentRef.createElement("div");
    toolsGrid.className = "repair-tool-grid";

    const toolList = documentRef.createElement("div");
    toolList.className = "repair-tool-list";

    for (const tool of profile.bench.tools) {
      const item = documentRef.createElement("div");
      item.className = `repair-tool-item${tool.available ? " repair-tool-item--available" : ""}`;

      const check = documentRef.createElement("span");
      check.className = "repair-tool-item__check";
      check.textContent = tool.available ? "[ok]" : "[--]";
      item.append(check);

      const label = documentRef.createElement("span");
      label.textContent = tool.label;
      item.append(label);

      if (tool.model !== null) {
        const model = documentRef.createElement("span");
        model.className = "repair-muted";
        model.style.fontSize = "10px";
        model.style.marginLeft = "auto";
        model.textContent = tool.model;
        item.append(model);
      }

      const toggle = documentRef.createElement("button");
      toggle.type = "button";
      toggle.className = "repair-sync-focus__action";
      toggle.textContent = tool.available ? "Disable" : "Enable";
      toggle.dataset["repairAction"] = "operator-profile-update";
      toggle.dataset["profileKind"] = "tool";
      toggle.dataset["toolId"] = tool.id;
      toggle.dataset["available"] = String(!tool.available);
      item.append(toggle);

      toolList.append(item);
    }

    toolsGrid.append(toolList);

    const detailTool =
      profile.bench.tools.find((tool) => tool.id === "multimeter-fnirsi-dmt99") ??
      profile.bench.tools.find((tool) => tool.category === "measurement") ??
      profile.bench.tools[0] ??
      null;
    const detail = documentRef.createElement("div");
    detail.className = "repair-tool-detail";
    if (detailTool !== null) {
      const title = documentRef.createElement("div");
      title.className = "repair-tool-detail__title";
      title.textContent = detailTool.label;
      detail.append(title);

      const model = documentRef.createElement("div");
      model.className = "repair-tool-detail__meta";
      model.textContent = detailTool.model ?? "Model not specified";
      detail.append(model);

      const capabilities = documentRef.createElement("div");
      capabilities.className = "repair-tool-detail__chips";
      detailTool.capabilities.slice(0, 6).forEach((capability) => {
        const chip = documentRef.createElement("span");
        chip.className = "repair-skill-chip";
        chip.textContent = capability;
        capabilities.append(chip);
      });
      detail.append(capabilities);

      const notes = documentRef.createElement("div");
      notes.className = "repair-tool-detail__notes";
      notes.textContent = detailTool.notes ?? "No bench note recorded.";
      detail.append(notes);
    }
    toolsGrid.append(detail);
    body.append(toolsGrid);
  }

  if (activeTab === "skills") {
    body.append(renderSkillCloud(documentRef, profile.skills));
  }

  if (activeTab === "preferences") {
    const prefs = documentRef.createElement("div");
    prefs.className = "repair-profile-preferences";
    const rows: Array<[string, string]> = [
      ["Measurement", profile.preferences.measurementSystem],
      [
        "Annotation",
        `${profile.preferences.annotationDefaultColor} / ${profile.preferences.annotationDefaultStrokeWidth}px`,
      ],
      ["Risk", profile.preferences.riskTolerance],
      ["AI", profile.preferences.aiVerbosity],
    ];
    rows.forEach(([label, value]) => {
      const row = documentRef.createElement("div");
      row.className = "repair-sync-row";
      const labelEl = documentRef.createElement("span");
      labelEl.className = "repair-sync-row__label";
      labelEl.textContent = label;
      row.append(labelEl);
      const valueEl = documentRef.createElement("span");
      valueEl.className = "repair-sync-row__value";
      valueEl.textContent = value;
      row.append(valueEl);
      const action = documentRef.createElement("button");
      action.type = "button";
      action.className = "repair-sync-focus__action";
      action.dataset["repairAction"] = "operator-profile-update";
      action.dataset["profileKind"] = "preference";
      if (label === "Risk") {
        action.textContent = "Cycle";
        action.dataset["preferenceKey"] = "riskTolerance";
        action.dataset["preferenceValue"] =
          profile.preferences.riskTolerance === "low"
            ? "medium"
            : profile.preferences.riskTolerance === "medium"
              ? "high"
              : "low";
        row.append(action);
      } else if (label === "AI") {
        action.textContent = "Cycle";
        action.dataset["preferenceKey"] = "aiVerbosity";
        action.dataset["preferenceValue"] =
          profile.preferences.aiVerbosity === "terse"
            ? "standard"
            : profile.preferences.aiVerbosity === "standard"
              ? "detailed"
              : "terse";
        row.append(action);
      } else if (label === "Annotation") {
        action.textContent = "+ Stroke";
        action.dataset["preferenceKey"] = "annotationDefaultStrokeWidth";
        action.dataset["preferenceValue"] = String(
          profile.preferences.annotationDefaultStrokeWidth >= 8
            ? 1
            : profile.preferences.annotationDefaultStrokeWidth + 1
        );
        row.append(action);
      }
      prefs.append(row);
    });
    body.append(prefs);
  }

  if (activeTab === "controls") {
    const controls = renderRepairSettingsPanelBody(documentRef, state, text);
    controls.className = `${controls.className} repair-settings-panel--embedded`;
    body.append(controls);
  }

  return createRepairPanel(documentRef, {
    panelId: "operator-profile",
    eyebrow: text(["operatorProfile", "eyebrow"], "OPERATOR"),
    title: profile.displayName,
    statusDot: "idle",
    collapsed: state.layout.collapsedPanels["operator-profile"],
    body,
  });
}

function renderSkillCloud(
  documentRef: Document,
  skills: RepairUiState["operatorProfile"]["profile"]["skills"]
): HTMLElement {
  const cloud = documentRef.createElement("div");
  cloud.className = "repair-skill-cloud";

  for (const skill of skills) {
    const chip = documentRef.createElement("span");
    chip.className = "repair-skill-chip";

    const labelSpan = documentRef.createElement("span");
    labelSpan.textContent = skill.label;
    chip.append(labelSpan);

    const dots = documentRef.createElement("span");
    dots.className = "repair-skill-chip__dots";
    for (let i = 1; i <= 5; i++) {
      const dot = documentRef.createElement("span");
      dot.className = `repair-skill-chip__dot${i <= skill.proficiency ? " repair-skill-chip__dot--filled" : ""}`;
      dots.append(dot);
    }
    chip.append(dots);

    cloud.append(chip);
  }

  return cloud;
}
