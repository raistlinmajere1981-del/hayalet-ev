import { escapeHtml } from "../domain/lab-types.js";
import type { LabSettingsFieldMeta, LabSettingsRecord } from "../domain/lab-types.js";
import { ensureAdvancedAudioAnalysisSettingsRegistered } from "../domain/lab-advanced-audio-settings.js";
import { ensureLabImageComparisonMouseToolsBound } from "./lab-image-comparison-mouse-tools.js";

ensureAdvancedAudioAnalysisSettingsRegistered();

type LabSettingsTranslate = (
  key: string,
  fallback: string,
  params?: Record<string, string | number>
) => string;

type RenderLabSettingsFieldsParams = {
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
};

const IMAGE_COMPARISON_MOVE_FIELD_IDS = new Set([
  "primaryOffsetX",
  "primaryOffsetY",
  "referenceOffsetX",
  "referenceOffsetY",
]);

const IMAGE_COMPARISON_RESIZE_FIELD_IDS = new Set([
  "primaryZoom",
  "primaryAspectLock",
  "primaryScaleX",
  "primaryScaleY",
  "primaryRotation",
  "referenceZoom",
  "referenceAspectLock",
  "referenceScaleX",
  "referenceScaleY",
  "referenceRotation",
]);

const IMAGE_COMPARISON_MARKER_FIELD_IDS = new Set([
  "marker1Enabled",
  "marker1Side",
  "marker1X",
  "marker1Y",
  "marker2Enabled",
  "marker2Side",
  "marker2X",
  "marker2Y",
  "marker3Enabled",
  "marker3Side",
  "marker3X",
  "marker3Y",
]);

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

function renderFieldsGrid(
  fields: LabSettingsFieldMeta[],
  params: RenderLabSettingsFieldsParams,
  className = ""
) {
  if (fields.length === 0) {
    return "";
  }
  return `<div class="labx-settings-grid${className ? ` ${className}` : ""}">${fields
    .map(function (field) {
      return renderField(field, params.settings, params.prefix, params.translate);
    })
    .join("")}</div>`;
}

function renderImageComparisonToolButton(
  mode: "move" | "resize",
  activeMode: "move" | "resize",
  params: RenderLabSettingsFieldsParams
) {
  const active = mode === activeMode;
  const label = mode === "move" ? "Taşı" : "Boyutlandır";
  const icon =
    mode === "move"
      ? `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2v20M2 12h20M12 2l-3 3M12 2l3 3M12 22l-3-3M12 22l3-3M2 12l3-3M2 12l3 3M22 12l-3-3M22 12l-3 3"/></svg>`
      : `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 3H3v5M16 21h5v-5M3 8l6-6M21 16l-6 6M14 3h7v7M10 21H3v-7"/></svg>`;
  return `
    <label class="labx-comparison-tool-switch__item" data-active="${active ? "true" : "false"}" title="${escapeHtml(label)}">
      <input
        type="radio"
        value="${mode}"
        data-lab-comparison-tool-mode="true"
        data-lab-field="${escapeHtml(`${params.prefix}.manipulationMode`)}"
        ${active ? "checked" : ""}
      />
      <span class="labx-comparison-tool-switch__icon">${icon}</span>
      <span>${escapeHtml(label)}</span>
    </label>
  `;
}

function renderImageComparisonSettings(params: RenderLabSettingsFieldsParams) {
  ensureLabImageComparisonMouseToolsBound();
  const activeMode = params.settings["manipulationMode"] === "resize" ? "resize" : "move";
  const showImageFrames = params.settings["showImageFrames"] !== false;
  const moveFields = params.fields.filter(function (field) {
    return IMAGE_COMPARISON_MOVE_FIELD_IDS.has(field.id);
  });
  const resizeFields = params.fields.filter(function (field) {
    return IMAGE_COMPARISON_RESIZE_FIELD_IDS.has(field.id);
  });
  const markerFields = params.fields.filter(function (field) {
    return IMAGE_COMPARISON_MARKER_FIELD_IDS.has(field.id);
  });
  const baseFields = params.fields.filter(function (field) {
    return (
      !IMAGE_COMPARISON_MOVE_FIELD_IDS.has(field.id) &&
      !IMAGE_COMPARISON_RESIZE_FIELD_IDS.has(field.id) &&
      !IMAGE_COMPARISON_MARKER_FIELD_IDS.has(field.id)
    );
  });
  const activeFields = activeMode === "move" ? moveFields : resizeFields;
  const helpText =
    activeMode === "move"
      ? "Resmin üzerinde sürükleyerek A veya B görüntüsünü taşıyın. X/Y alanları hassas konum ayarı içindir."
      : "Resmin üzerinde sürükleyin. Oran kilitliyse ortak yakınlaştırma, kilit açıksa X/Y ölçekleri değişir.";
  const resetLabel = params.resetLabel || "Reset";

  return `
    <div
      class="labx-settings-block labx-settings-block--inline labx-image-comparison-settings"
      data-panel-id="${escapeHtml(params.prefix)}"
      data-lab-image-comparison-toolbox="true"
    >
      <div class="labx-settings-block__toolbar">
        <button
          class="labx-settings-block__reset"
          type="button"
          data-lab-action="${escapeHtml(params.resetAction)}"
          data-lab-value="${escapeHtml(params.resetValue)}"
        >${escapeHtml(resetLabel)}</button>
      </div>
      ${renderFieldsGrid(baseFields, params, "labx-settings-grid--comparison-base")}
      <label class="labx-settings-field labx-image-comparison-settings__frame-toggle" data-setting-kind="toggle">
        <span class="labx-settings-field__label">Resim çerçevelerini göster</span>
        <span class="labx-settings-field__input">
          <input
            class="labx-settings-field__control"
            type="checkbox"
            data-lab-field="${escapeHtml(`${params.prefix}.showImageFrames`)}"
            ${showImageFrames ? "checked" : ""}
          />
        </span>
      </label>
      <section class="labx-comparison-toolbox">
        <div class="labx-comparison-tool-switch" role="group" aria-label="Karşılaştırma mouse aracı">
          ${renderImageComparisonToolButton("move", activeMode, params)}
          ${renderImageComparisonToolButton("resize", activeMode, params)}
        </div>
        <p class="labx-comparison-toolbox__hint">${escapeHtml(helpText)}</p>
        ${renderFieldsGrid(activeFields, params, "labx-settings-grid--comparison-precision")}
      </section>
      ${
        markerFields.length > 0
          ? `<details class="labx-image-comparison-settings__markers"><summary>İşaretler</summary>${renderFieldsGrid(markerFields, params, "labx-settings-grid--comparison-markers")}</details>`
          : ""
      }
    </div>
  `;
}

export function renderLabSettingsFields(params: RenderLabSettingsFieldsParams) {
  if (params.fields.length === 0) {
    return "";
  }
  if (params.prefix === "operationSettings.image-comparison") {
    return renderImageComparisonSettings(params);
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
