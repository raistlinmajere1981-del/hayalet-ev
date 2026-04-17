import type {
  ForgeOperatorEquipmentStatus,
  ForgeOperatorProfile,
  ForgeOperatorSkillLevel,
} from "../../shared/types/index.js";

type ForgeTextFn = (
  path: string[],
  fallback: string,
  params?: Record<string, number | string>
) => string;

export type ForgeProfileEditorDraftView =
  | {
      kind: "skill";
      label: string;
      level: ForgeOperatorSkillLevel;
      mode: "create" | "edit";
      notes: string;
      sourceKey: string | null;
    }
  | {
      brandModel: string;
      kind: "equipment";
      label: string;
      mode: "create" | "edit";
      notes: string;
      sourceKey: string | null;
      status: ForgeOperatorEquipmentStatus;
    }
  | null;

function createButton(
  documentRef: Document,
  label: string,
  action: string,
  dataset: Record<string, string> = {},
  primary = false
): HTMLButtonElement {
  const button = documentRef.createElement("button");
  button.type = "button";
  button.className = primary
    ? "forge-button forge-button--primary"
    : "forge-button forge-button--secondary";
  button.dataset["forgeAction"] = action;
  Object.entries(dataset).forEach(([key, value]) => {
    button.dataset[key] = value;
  });
  button.textContent = label;
  return button;
}

function createSectionHeading(
  documentRef: Document,
  title: string,
  actions: HTMLElement[] = []
): HTMLElement {
  const header = documentRef.createElement("div");
  header.className = "forge-section-heading";
  const copy = documentRef.createElement("div");
  copy.className = "forge-section-heading__copy";
  const heading = documentRef.createElement("h4");
  heading.className = "forge-context-group__title";
  heading.textContent = title;
  copy.append(heading);
  header.append(copy);
  if (actions.length > 0) {
    const rail = documentRef.createElement("div");
    rail.className = "forge-actions";
    rail.append(...actions);
    header.append(rail);
  }
  return header;
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

function renderValueLabel(
  text: ForgeTextFn,
  value: string,
  type: "equipment" | "skill"
): string {
  const key =
    type === "equipment"
      ? ["workbench", "goalPanel", "operatorProfile", "equipmentStatus", value]
      : ["workbench", "goalPanel", "operatorProfile", "skillLevels", value];
  return text(key, value.replace(/_/g, " "));
}

function createProfileRecordRow(
  documentRef: Document,
  options: {
    actions: HTMLElement[];
    detail: string;
    notes?: string;
    title: string;
  }
): HTMLElement {
  const row = documentRef.createElement("article");
  row.className = "forge-profile-record";
  const header = documentRef.createElement("div");
  header.className = "forge-profile-record__head";
  const title = documentRef.createElement("strong");
  title.className = "forge-profile-record__title";
  title.textContent = options.title;
  const detail = documentRef.createElement("span");
  detail.className = "forge-profile-record__value";
  detail.textContent = options.detail;
  header.append(title, detail);

  const footer = documentRef.createElement("div");
  footer.className = "forge-profile-record__foot";
  if (options.notes && options.notes.trim() !== "") {
    const notes = documentRef.createElement("span");
    notes.className = "forge-profile-record__notes";
    notes.textContent = options.notes.trim();
    footer.append(notes);
  }
  const actions = documentRef.createElement("div");
  actions.className = "forge-actions";
  actions.append(...options.actions);
  footer.append(actions);
  row.append(header, footer);
  return row;
}

function renderAvatar(documentRef: Document, nickname: string, avatar: string | null): HTMLElement {
  if (avatar && avatar.trim() !== "") {
    const image = documentRef.createElement("img");
    image.className = "forge-profile-identity__avatar";
    image.alt = nickname;
    image.src = avatar;
    return image;
  }
  const fallback = documentRef.createElement("div");
  fallback.className = "forge-profile-identity__avatar forge-profile-identity__avatar--fallback";
  fallback.textContent = nickname.trim().slice(0, 1).toUpperCase() || "O";
  return fallback;
}

function renderSkillEditor(
  documentRef: Document,
  text: ForgeTextFn,
  draft: Extract<ForgeProfileEditorDraftView, { kind: "skill" }>
): HTMLElement {
  const editor = documentRef.createElement("div");
  editor.className = "forge-inline-editor";

  const labelInput = documentRef.createElement("input");
  labelInput.id = "forge-profile-editor-skill-label";
  labelInput.className = "forge-input";
  labelInput.value = draft.label;
  labelInput.placeholder = text(
    ["workbench", "goalPanel", "operatorProfile", "skillLabelPlaceholder"],
    "Skill label"
  );

  const levelSelect = documentRef.createElement("select");
  levelSelect.id = "forge-profile-editor-skill-level";
  levelSelect.className = "forge-input";
  (["none", "basic", "intermediate", "advanced"] as const).forEach((value) => {
    levelSelect.append(
      createOption(documentRef, value, renderValueLabel(text, value, "skill"), draft.level)
    );
  });

  const notesInput = documentRef.createElement("input");
  notesInput.id = "forge-profile-editor-skill-notes";
  notesInput.className = "forge-input";
  notesInput.value = draft.notes;
  notesInput.placeholder = text(
    ["workbench", "goalPanel", "operatorProfile", "notesPlaceholder"],
    "Optional notes"
  );

  editor.append(
    labelInput,
    levelSelect,
    notesInput,
    createSectionHeading(documentRef, "", [
      createButton(
        documentRef,
        text(["workbench", "goalPanel", "operatorProfile", "commit"], "Apply"),
        "commit-profile-entry",
        {},
        true
      ),
      createButton(
        documentRef,
        text(["workbench", "goalPanel", "operatorProfile", "cancel"], "Cancel"),
        "cancel-profile-entry"
      ),
    ])
  );
  return editor;
}

function renderEquipmentEditor(
  documentRef: Document,
  text: ForgeTextFn,
  draft: Extract<ForgeProfileEditorDraftView, { kind: "equipment" }>
): HTMLElement {
  const editor = documentRef.createElement("div");
  editor.className = "forge-inline-editor";

  const labelInput = documentRef.createElement("input");
  labelInput.id = "forge-profile-editor-equipment-label";
  labelInput.className = "forge-input";
  labelInput.value = draft.label;
  labelInput.placeholder = text(
    ["workbench", "goalPanel", "operatorProfile", "equipmentLabelPlaceholder"],
    "Equipment label"
  );

  const statusSelect = documentRef.createElement("select");
  statusSelect.id = "forge-profile-editor-equipment-status";
  statusSelect.className = "forge-input";
  (["unavailable", "available", "planned"] as const).forEach((value) => {
    statusSelect.append(
      createOption(
        documentRef,
        value,
        renderValueLabel(text, value, "equipment"),
        draft.status
      )
    );
  });

  const brandModelInput = documentRef.createElement("input");
  brandModelInput.id = "forge-profile-editor-equipment-brand-model";
  brandModelInput.className = "forge-input";
  brandModelInput.value = draft.brandModel;
  brandModelInput.placeholder = text(
    ["workbench", "goalPanel", "operatorProfile", "brandModelPlaceholder"],
    "Brand / model"
  );

  const notesInput = documentRef.createElement("input");
  notesInput.id = "forge-profile-editor-equipment-notes";
  notesInput.className = "forge-input";
  notesInput.value = draft.notes;
  notesInput.placeholder = text(
    ["workbench", "goalPanel", "operatorProfile", "notesPlaceholder"],
    "Optional notes"
  );

  editor.append(
    labelInput,
    statusSelect,
    brandModelInput,
    notesInput,
    createSectionHeading(documentRef, "", [
      createButton(
        documentRef,
        text(["workbench", "goalPanel", "operatorProfile", "commit"], "Apply"),
        "commit-profile-entry",
        {},
        true
      ),
      createButton(
        documentRef,
        text(["workbench", "goalPanel", "operatorProfile", "cancel"], "Cancel"),
        "cancel-profile-entry"
      ),
    ])
  );
  return editor;
}

export function renderOperatorProfileManager(
  documentRef: Document,
  text: ForgeTextFn,
  options: {
    dirty: boolean;
    draft: ForgeOperatorProfile;
    editorDraft: ForgeProfileEditorDraftView;
    userAvatar: string | null;
    userNickname: string;
  }
): HTMLElement {
  const overlay = documentRef.createElement("div");
  overlay.className = "forge-profile-overlay";

  const backdrop = documentRef.createElement("div");
  backdrop.className = "forge-profile-overlay__backdrop";
  backdrop.dataset["forgeAction"] = "toggle-profile-editor";

  const panel = documentRef.createElement("aside");
  panel.className = "forge-profile-modal";
  panel.append(
    createSectionHeading(
      documentRef,
      text(
        ["workbench", "goalPanel", "operatorProfile", "drawerTitle"],
        "Manage operator profile"
      ),
      [
        createButton(
          documentRef,
          text(["workbench", "goalPanel", "operatorProfile", "close"], "Close"),
          "toggle-profile-editor"
        ),
      ]
    )
  );

  const identity = documentRef.createElement("div");
  identity.className = "forge-profile-identity";
  const copy = documentRef.createElement("div");
  copy.className = "forge-profile-identity__copy";
  identity.append(renderAvatar(documentRef, options.userNickname, options.userAvatar), copy);
  copy.append(
    Object.assign(documentRef.createElement("strong"), {
      className: "forge-profile-identity__name",
      textContent: options.userNickname,
    }),
    Object.assign(documentRef.createElement("span"), {
      className: "forge-field__hint",
      textContent: text(
        ["workbench", "goalPanel", "operatorProfile", "managerHint"],
        "Persistent operator records live here. Session selection stays on the main run screen."
      ),
    })
  );
  panel.append(identity);

  const dirtyChip = documentRef.createElement("span");
  dirtyChip.className = "forge-chip forge-chip--accent";
  dirtyChip.textContent = options.dirty
    ? text(
        ["workbench", "goalPanel", "operatorProfile", "autosavePending"],
        "Autosave on close"
      )
    : text(["workbench", "goalPanel", "operatorProfile", "saved"], "Saved");
  panel.append(dirtyChip);

  const skillsSection = documentRef.createElement("section");
  skillsSection.className = "forge-profile-section";
  skillsSection.append(
    createSectionHeading(documentRef, text(["workbench", "goalPanel", "catalog", "groups", "skills"], "Skills"), [
      createButton(
        documentRef,
        text(["workbench", "goalPanel", "operatorProfile", "addSkill"], "Add skill"),
        "start-profile-create",
        { forgeProfileKind: "skill" }
      ),
    ])
  );
  if (options.draft.skills.length === 0) {
    skillsSection.append(
      Object.assign(documentRef.createElement("p"), {
        className: "forge-field__hint",
        textContent: text(
          ["workbench", "goalPanel", "operatorProfile", "emptySkills"],
          "No saved skill records yet."
        ),
      })
    );
  } else {
    options.draft.skills.forEach((record) => {
      skillsSection.append(
        createProfileRecordRow(documentRef, {
          title: record.label,
          detail: renderValueLabel(text, record.level, "skill"),
          ...(record.notes ? { notes: record.notes } : {}),
          actions: [
            createButton(
              documentRef,
              text(["workbench", "goalPanel", "operatorProfile", "editInline"], "Edit"),
              "start-profile-edit",
              { forgeProfileKind: "skill", forgeProfileKey: record.skillKey }
            ),
            createButton(
              documentRef,
              text(["workbench", "goalPanel", "operatorProfile", "remove"], "Remove"),
              "remove-profile-entry",
              { forgeProfileKind: "skill", forgeProfileKey: record.skillKey }
            ),
          ],
        })
      );
    });
  }
  if (options.editorDraft?.kind === "skill") {
    skillsSection.append(renderSkillEditor(documentRef, text, options.editorDraft));
  }
  panel.append(skillsSection);

  const equipmentSection = documentRef.createElement("section");
  equipmentSection.className = "forge-profile-section";
  equipmentSection.append(
    createSectionHeading(
      documentRef,
      text(["workbench", "goalPanel", "catalog", "groups", "equipment"], "Equipment"),
      [
        createButton(
          documentRef,
          text(
            ["workbench", "goalPanel", "operatorProfile", "addEquipment"],
            "Add equipment"
          ),
          "start-profile-create",
          { forgeProfileKind: "equipment" }
        ),
      ]
    )
  );
  if (options.draft.equipment.length === 0) {
    equipmentSection.append(
      Object.assign(documentRef.createElement("p"), {
        className: "forge-field__hint",
        textContent: text(
          ["workbench", "goalPanel", "operatorProfile", "emptyEquipment"],
          "No saved equipment records yet."
        ),
      })
    );
  } else {
    options.draft.equipment.forEach((record) => {
      const notes = [record.brandModel, record.notes].filter(
        (entry): entry is string => typeof entry === "string" && entry.trim() !== ""
      );
      equipmentSection.append(
        createProfileRecordRow(documentRef, {
          title: record.label,
          detail: renderValueLabel(text, record.status, "equipment"),
          ...(notes.length > 0 ? { notes: notes.join(" • ") } : {}),
          actions: [
            createButton(
              documentRef,
              text(["workbench", "goalPanel", "operatorProfile", "editInline"], "Edit"),
              "start-profile-edit",
              { forgeProfileKind: "equipment", forgeProfileKey: record.equipmentKey }
            ),
            createButton(
              documentRef,
              text(["workbench", "goalPanel", "operatorProfile", "remove"], "Remove"),
              "remove-profile-entry",
              { forgeProfileKind: "equipment", forgeProfileKey: record.equipmentKey }
            ),
          ],
        })
      );
    });
  }
  if (options.editorDraft?.kind === "equipment") {
    equipmentSection.append(renderEquipmentEditor(documentRef, text, options.editorDraft));
  }
  panel.append(equipmentSection);

  const footer = documentRef.createElement("div");
  footer.className = "forge-actions";
  footer.append(
    createButton(
      documentRef,
      text(["workbench", "goalPanel", "operatorProfile", "close"], "Close"),
      "toggle-profile-editor"
    )
  );
  panel.append(footer);

  overlay.append(backdrop, panel);
  return overlay;
}
