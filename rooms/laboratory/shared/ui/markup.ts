type LaboratorySummaryRow = readonly [string, string];

type LaboratoryTextFieldExtra =
  | {
      type?: string | null;
    }
  | null
  | undefined;

type LaboratoryMarkupHelpersDeps = {
  escapeHtml: (value: string) => string;
};

export function createLaboratoryMarkupHelpers(deps: LaboratoryMarkupHelpersDeps) {
  const escapeHtml = deps.escapeHtml;

  const renderSummaryRows: (rows: readonly LaboratorySummaryRow[]) => string =
    function renderSummaryRows(rows: any) {
      return `
      <ul class="lab-summary-list">
        ${rows
          .map(function (row: any) {
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
    };

  const renderTextField: (
    fieldId: string,
    value: string | null | undefined,
    label: string,
    placeholder: string | null | undefined,
    extra: LaboratoryTextFieldExtra
  ) => string = function renderTextField(fieldId: any, value: any, label: any, placeholder: any, extra: any) {
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
  };

  return {
    renderSummaryRows: renderSummaryRows,
    renderTextField: renderTextField,
  };
}
