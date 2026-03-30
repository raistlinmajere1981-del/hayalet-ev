export function createMediaAnalysisEditFieldControls(deps: any) {
  const toRecord = deps.toRecord;
  const escapeHtml = deps.escapeHtml;

  function renderEditToggle(fieldId: any, label: any, active: any) {
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

  function renderEditTextField(fieldId: any, value: any, label: any, extra: any) {
    const options = toRecord(extra);
    return `
      <label class="lab-field">
        <span class="lab-field__label">${escapeHtml(label)}</span>
        <input
          class="lab-input"
          type="${escapeHtml(options.type || "text")}"
          value="${escapeHtml(value == null ? "" : value)}"
          placeholder="${escapeHtml(options.placeholder || "")}"
          data-edit-field="${escapeHtml(fieldId)}"
          data-edit-commit="${escapeHtml(options.commit || "change")}"
        />
      </label>
    `;
  }

  function renderEditSelectField(fieldId: any, value: any, label: any, optionEntries: any) {
    return `
      <label class="lab-field">
        <span class="lab-field__label">${escapeHtml(label)}</span>
        <select class="lab-select" data-edit-field="${escapeHtml(fieldId)}">
          ${optionEntries
            .map(function (entry: any) {
              return `
                <option value="${escapeHtml(entry.value)}" ${
                  String(entry.value) === String(value) ? "selected" : ""
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

  function renderEditRangeField(fieldId: any, value: any, label: any, options: any) {
    const config = toRecord(options);
    return `
      <label class="lab-range-group">
        <span>${escapeHtml(label)} <strong>${escapeHtml(String(config.displayValue || value || 0))}</strong></span>
        <input
          type="range"
          min="${escapeHtml(String(config.min ?? 0))}"
          max="${escapeHtml(String(config.max ?? 100))}"
          step="${escapeHtml(String(config.step ?? 1))}"
          value="${escapeHtml(String(value ?? config.min ?? 0))}"
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
