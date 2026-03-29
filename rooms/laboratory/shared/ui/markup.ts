// @ts-nocheck
export function createLaboratoryMarkupHelpers(deps) {
  const escapeHtml = deps.escapeHtml;

  function renderSummaryRows(rows) {
    return `
      <ul class="lab-summary-list">
        ${rows
          .map(function (row) {
            return `
              <li>
                <span>${escapeHtml(row[0])}</span>
                <strong>${escapeHtml(row[1])}</strong>
              </li>
            `;
          })
          .join("")}
      </ul>
    `;
  }

  function renderTextField(fieldId, value, label, placeholder, extra) {
    return `
      <label class="lab-field">
        <span class="lab-field__label">${escapeHtml(label)}</span>
        <input
          class="lab-input"
          type="${escapeHtml(extra && extra.type ? extra.type : "text")}"
          value="${escapeHtml(value || "")}"
          data-draft-field="${escapeHtml(fieldId)}"
          placeholder="${escapeHtml(placeholder || "")}"
        />
      </label>
    `;
  }

  return {
    renderSummaryRows: renderSummaryRows,
    renderTextField: renderTextField,
  };
}
