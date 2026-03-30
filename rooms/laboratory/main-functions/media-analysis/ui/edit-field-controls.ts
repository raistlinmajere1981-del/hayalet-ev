type LaboratoryRecord = Record<string, unknown>;

type LaboratoryEditTextFieldOptions = LaboratoryRecord & {
  commit?: unknown;
  placeholder?: unknown;
  type?: unknown;
};

type LaboratoryEditOptionEntry = {
  label: string;
  value: string | number;
};

type LaboratoryEditRangeOptions = LaboratoryRecord & {
  displayValue?: unknown;
  max?: unknown;
  min?: unknown;
  step?: unknown;
};

type MediaAnalysisEditFieldControlsDeps = {
  escapeHtml: (value: string) => string;
  toRecord: (value: unknown) => LaboratoryRecord;
};

export function createMediaAnalysisEditFieldControls(deps: MediaAnalysisEditFieldControlsDeps) {
  const toRecord = deps.toRecord;
  const escapeHtml = deps.escapeHtml;

  function renderEditToggle(fieldId: string, label: string, active: boolean) {
    return `
      <button
        class="lab-toggle"
        type="button"
        data-edit-toggle="${escapeHtml(fieldId)}"
        data-active="${active ? "true" : "false"}"
      >
        <span class="lab-toggle__track"><span class="lab-toggle__thumb"></span></span>
        <span class="lab-toggle__label">${escapeHtml(label)}</span>
      </button>
    `;
  }

  function renderEditTextField(
    fieldId: string,
    value: unknown,
    label: string,
    extra: unknown
  ) {
    const options = toRecord(extra) as LaboratoryEditTextFieldOptions;
    const inputType = typeof options.type === "string" ? options.type : "text";
    const placeholder = typeof options.placeholder === "string" ? options.placeholder : "";
    const commitMode = typeof options.commit === "string" ? options.commit : "change";
    return `
      <label class="lab-field">
        <span class="lab-field__label">${escapeHtml(label)}</span>
        <input
          class="lab-input"
          type="${escapeHtml(inputType)}"
          value="${escapeHtml(value == null ? "" : String(value))}"
          placeholder="${escapeHtml(placeholder)}"
          data-edit-field="${escapeHtml(fieldId)}"
          data-edit-commit="${escapeHtml(commitMode)}"
        />
      </label>
    `;
  }

  function renderEditSelectField(
    fieldId: string,
    value: unknown,
    label: string,
    optionEntries: readonly LaboratoryEditOptionEntry[]
  ) {
    return `
      <label class="lab-field">
        <span class="lab-field__label">${escapeHtml(label)}</span>
        <select class="lab-select" data-edit-field="${escapeHtml(fieldId)}">
          ${optionEntries
            .map(function (entry) {
              const optionValue = String(entry.value);
              return `
                <option value="${escapeHtml(optionValue)}" ${
                  optionValue === String(value ?? "") ? "selected" : ""
                }>
                  ${escapeHtml(entry.label)}
                </option>
              `;
            })
            .join("")}
        </select>
      </label>
    `;
  }

  function renderEditRangeField(fieldId: string, value: unknown, label: string, options: unknown) {
    const config = toRecord(options) as LaboratoryEditRangeOptions;
    const displayValue = config.displayValue ?? value ?? 0;
    const minValue = config.min ?? 0;
    const maxValue = config.max ?? 100;
    const stepValue = config.step ?? 1;
    const fieldValue = value ?? minValue;
    return `
      <label class="lab-range-group">
        <span>${escapeHtml(label)} <strong>${escapeHtml(String(displayValue))}</strong></span>
        <input
          type="range"
          min="${escapeHtml(String(minValue))}"
          max="${escapeHtml(String(maxValue))}"
          step="${escapeHtml(String(stepValue))}"
          value="${escapeHtml(String(fieldValue))}"
          data-edit-field="${escapeHtml(fieldId)}"
          data-edit-commit="change"
        />
      </label>
    `;
  }

  return {
    renderEditRangeField,
    renderEditSelectField,
    renderEditTextField,
    renderEditToggle,
  };
}
