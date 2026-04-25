import { escapeHtml } from "../models/lab-types.js";
import type { LabInteractiveSettings } from "../models/lab-types.js";
import { LAB_FALLBACK_I18N } from "./lab-i18n.js";
import type { LabI18n } from "./lab-i18n.js";

function renderSlider(
  label: string,
  field: string,
  value: number,
  min: number,
  max: number,
  step: number,
  unit: string
) {
  return `
    <label class="labx-control-row">
      <span class="labx-control-row__label">${escapeHtml(label)}</span>
      <input
        class="labx-range"
        type="range"
        min="${String(min)}"
        max="${String(max)}"
        step="${String(step)}"
        value="${String(value)}"
        data-lab-field="workspace.interactive.${field}"
      />
      <span class="labx-control-row__value">${String(value)}${unit}</span>
    </label>
  `;
}

function renderToggle(label: string, field: string, active: boolean) {
  return `
    <label class="labx-control-toggle">
      <input
        type="checkbox"
        ${active ? "checked" : ""}
        data-lab-field="workspace.interactive.${field}"
      />
      <span>${escapeHtml(label)}</span>
    </label>
  `;
}

export function renderWorkspaceInteractiveControls(
  settings: LabInteractiveSettings,
  copy: LabI18n = LAB_FALLBACK_I18N
) {
  return `
    <section class="labx-card labx-controls-card labx-workspace-focus-row__panel" data-tone="accent">
      <div class="labx-card__header">
        <div>
          <h2 class="labx-card__title">${escapeHtml(copy.t("mediaAnalysis.interactiveControls.title", "Visual Adjustments"))}</h2>
        </div>
      </div>
      <div class="labx-card__body">
        <div class="labx-controls-stack">
          ${renderSlider(copy.t("mediaAnalysis.interactiveControls.fields.brightness", "Brightness"), "brightness", settings.brightness, 0, 200, 1, "%")}
          ${renderSlider(copy.t("mediaAnalysis.interactiveControls.fields.contrast", "Contrast"), "contrast", settings.contrast, 0, 200, 1, "%")}
          ${renderSlider(copy.t("mediaAnalysis.interactiveControls.fields.gamma", "Gamma"), "gamma", settings.gamma, 0.1, 5.0, 0.1, "")}
          ${renderSlider(copy.t("mediaAnalysis.interactiveControls.fields.saturation", "Saturation"), "saturation", settings.saturation, 0, 200, 1, "%")}
          ${renderSlider(copy.t("mediaAnalysis.interactiveControls.fields.hueRotate", "Hue Rotate"), "hueRotate", settings.hueRotate, 0, 360, 1, "°")}
          ${renderSlider(copy.t("mediaAnalysis.interactiveControls.fields.sharpness", "Sharpness"), "sharpness", settings.sharpness, 0, 200, 1, "%")}
        </div>
        <div class="labx-controls-toggles">
          <p class="labx-card__eyebrow">${escapeHtml(copy.t("mediaAnalysis.interactiveControls.channelTitle", "CHANNEL ISOLATE"))}</p>
          <div class="labx-toggle-row">
            ${renderToggle("R", "channelR", settings.channelR)}
            ${renderToggle("G", "channelG", settings.channelG)}
            ${renderToggle("B", "channelB", settings.channelB)}
          </div>
          ${renderToggle(copy.t("mediaAnalysis.interactiveControls.fields.edgeHighlight", "Edge Highlight"), "edgeHighlight", settings.edgeHighlight)}
          ${renderToggle(copy.t("mediaAnalysis.interactiveControls.fields.invert", "Invert"), "invert", settings.invert)}
        </div>
        <div class="labx-controls-actions">
          <button class="labx-inline-action" type="button" data-lab-action="workspace-reset-controls">${escapeHtml(copy.t("mediaAnalysis.interactiveControls.resetAction", "Reset All"))}</button>
        </div>
      </div>
    </section>
  `;
}
