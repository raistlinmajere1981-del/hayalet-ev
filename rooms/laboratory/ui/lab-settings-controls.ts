import { escapeHtml } from "../domain/lab-types.js";
import type { LabSettingsFieldMeta, LabSettingsRecord } from "../domain/lab-types.js";
import { ensureAdvancedAudioAnalysisSettingsRegistered } from "../domain/lab-advanced-audio-settings.js";

ensureAdvancedAudioAnalysisSettingsRegistered();

type LabSettingsTranslate = (
  key: string,
  fallback: string,
  params?: Record<string, string | number>
) => string;

function getFieldValue(settings: LabSettingsRecord, field: LabSettingsFieldMeta) {
  const value = settings[field.id];
  return value === undefined || value === null ? "" : String(value);
}

function translateSettingField(
  translate: LabSettingsTranslate | undefined,
  field: LabSettingsFieldMeta
) {
  return translate
    ? translate(`mediaAnalysis.settings.fields.${field.id}`, field.label)
    : field.label;
}

function translateSettingOption(
  translate: LabSettingsTranslate | undefined,
  value: string,
  fallback: string
) {
  return translate ? translate(`mediaAnalysis.settings.options.${value}`, fallback) : fallback;
}

function renderSelect(
  field: LabSettingsFieldMeta,
  value: string,
  fieldPath: string,
  translate: LabSettingsTranslate | undefined
) {
  const options = field.options || [];
  return `
    <select class="labx-settings-field__control" data-lab-field="${escapeHtml(fieldPath)}">
      ${options
        .map(function (option) {
          return `<option value="${escapeHtml(option.value)}" ${
            value === option.value ? "selected" : ""
          }>${escapeHtml(translateSettingOption(translate, option.value, option.label))}</option>`;
        })
        .join("")}
    </select>
  `;
}

function renderToggle(value: string, fieldPath: string) {
  return `
    <input
      class="labx-settings-field__control"
      type="checkbox"
      data-lab-field="${escapeHtml(fieldPath)}"
      ${value === "true" ? "checked" : ""}
    />
  `;
}

function renderNumber(field: LabSettingsFieldMeta, value: string, fieldPath: string) {
  return `
    <input
      class="labx-settings-field__control"
      type="number"
      data-lab-field="${escapeHtml(fieldPath)}"
      value="${escapeHtml(value)}"
      ${typeof field.min === "number" ? `min="${String(field.min)}"` : ""}
      ${typeof field.max === "number" ? `max="${String(field.max)}"` : ""}
      ${typeof field.step === "number" ? `step="${String(field.step)}"` : ""}
    />
    ${field.unit ? `<span class="labx-settings-field__unit">${escapeHtml(field.unit)}</span>` : ""}
  `;
}

function renderField(
  field: LabSettingsFieldMeta,
  settings: LabSettingsRecord,
  prefix: string,
  translate: LabSettingsTranslate | undefined
) {
  const fieldPath = `${prefix}.${field.id}`;
  const value = getFieldValue(settings, field);
  const control =
    field.kind === "select"
      ? renderSelect(field, value, fieldPath, translate)
      : field.kind === "toggle"
        ? renderToggle(value, fieldPath)
        : renderNumber(field, value, fieldPath);
  return `
    <label class="labx-settings-field" data-setting-kind="${escapeHtml(field.kind)}">
      <span class="labx-settings-field__label">${escapeHtml(translateSettingField(translate, field))}</span>
      <span class="labx-settings-field__input">${control}</span>
    </label>
  `;
}

function formatSettingValue(
  field: LabSettingsFieldMeta,
  value: string,
  translate: LabSettingsTranslate | undefined
) {
  if (field.kind === "toggle") {
    return value === "true"
      ? translateSettingOption(translate, "enabled", "On")
      : translateSettingOption(translate, "disabled", "Off");
  }
  if (field.kind === "select") {
    const option = (field.options || []).find(function (entry) {
      return entry.value === value;
    });
    return translateSettingOption(translate, value, option?.label || value);
  }
  return `${value}${field.unit ? ` ${field.unit}` : ""}`.trim();
}

function renderSettingsSummary(
  fields: LabSettingsFieldMeta[],
  settings: LabSettingsRecord,
  translate: LabSettingsTranslate | undefined
) {
  const summary = fields
    .slice(0, 3)
    .map(function (field) {
      const value = getFieldValue(settings, field);
      if (value === "") {
        return null;
      }
      return `${translateSettingField(translate, field)}: ${formatSettingValue(field, value, translate)}`;
    })
    .filter((entry): entry is string => entry !== null)
    .join(" · ");
  return summary === ""
    ? ""
    : `<span class="labx-settings-block__state">${escapeHtml(summary)}</span>`;
}

export function renderLabSettingsFields(params: {
  fields: LabSettingsFieldMeta[];
  prefix: string;
  resetAction: string;
  resetLabel?: string;
  resetValue: string;
  settings: LabSettingsRecord;
  title: string;
  toggleLabel?: string;
  translate?: LabSettingsTranslate;
  variant?: "collapsible" | "inline";
}) {
  if (params.fields.length === 0) {
    return "";
  }
  const resetLabel = params.resetLabel || "Reset";
  const fieldsMarkup = params.fields
    .map(function (field) {
      return renderField(field, params.settings, params.prefix, params.translate);
    })
    .join("");
  const toolbarMarkup = `
    <div class="labx-settings-block__toolbar">
      <button
        class="labx-settings-block__reset"
        type="button"
        data-lab-action="${escapeHtml(params.resetAction)}"
        data-lab-value="${escapeHtml(params.resetValue)}"
      >${escapeHtml(resetLabel)}</button>
    </div>
  `;

  if (params.variant === "inline") {
    return `
      <div
        class="labx-settings-block labx-settings-block--inline"
        data-panel-id="${escapeHtml(params.prefix)}"
      >
        ${toolbarMarkup}
        <div class="labx-settings-grid">
          ${fieldsMarkup}
        </div>
      </div>
    `;
  }

  return `
    <details
      class="labx-settings-block"
      data-lab-collapsible-panel="true"
      data-panel-id="${escapeHtml(params.prefix)}"
    >
      <summary class="labx-settings-block__summary">
        <span class="labx-settings-block__summary-main">
          <span class="labx-settings-block__title">${escapeHtml(params.title)}</span>
          ${renderSettingsSummary(params.fields, params.settings, params.translate)}
        </span>
        <span class="labx-settings-block__action">${escapeHtml(params.toggleLabel || "Edit")}</span>
      </summary>
      ${toolbarMarkup}
      <div class="labx-settings-grid">
        ${fieldsMarkup}
      </div>
    </details>
  `;
}
