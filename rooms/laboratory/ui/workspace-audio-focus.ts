import { escapeHtml } from "../models/lab-types.js";
import type { LabAudioFocusSettings } from "../models/lab-types.js";
import { LAB_FALLBACK_I18N } from "./lab-i18n.js";
import type { LabI18n } from "./lab-i18n.js";

function renderSettingStepper(
  label: string,
  fullField: string,
  min: number,
  max: number,
  step: number,
  resetValue: number,
  disabled = false
) {
  const escapedField = escapeHtml(fullField);
  const escapedLabel = escapeHtml(label);
  const disabledAttr = disabled ? " disabled" : "";
  return `
    <div class="labx-control-stepper" aria-label="${escapedLabel}">
      <button class="labx-control-stepper__btn" type="button" data-lab-action="workspace-setting-adjust" data-lab-field="${escapedField}" data-lab-delta="-${String(step)}" data-lab-min="${String(min)}" data-lab-max="${String(max)}" data-lab-step="${String(step)}" data-lab-reset-value="${String(resetValue)}" title="Decrease ${escapedLabel}"${disabledAttr}>-</button>
      <button class="labx-control-stepper__btn" type="button" data-lab-action="workspace-setting-adjust" data-lab-field="${escapedField}" data-lab-reset="true" data-lab-min="${String(min)}" data-lab-max="${String(max)}" data-lab-step="${String(step)}" data-lab-reset-value="${String(resetValue)}" title="Reset ${escapedLabel}"${disabledAttr}>R</button>
      <button class="labx-control-stepper__btn" type="button" data-lab-action="workspace-setting-adjust" data-lab-field="${escapedField}" data-lab-delta="${String(step)}" data-lab-min="${String(min)}" data-lab-max="${String(max)}" data-lab-step="${String(step)}" data-lab-reset-value="${String(resetValue)}" title="Increase ${escapedLabel}"${disabledAttr}>+</button>
    </div>
  `;
}

function renderOptionStepper(
  label: string,
  fullField: string,
  options: readonly string[],
  resetValue: string
) {
  const escapedField = escapeHtml(fullField);
  const escapedLabel = escapeHtml(label);
  const escapedOptions = escapeHtml(options.join("|"));
  return `
    <div class="labx-control-stepper" aria-label="${escapedLabel}">
      <button class="labx-control-stepper__btn" type="button" data-lab-action="workspace-setting-adjust" data-lab-field="${escapedField}" data-lab-delta="-1" data-lab-options="${escapedOptions}" data-lab-reset-value="${escapeHtml(resetValue)}" title="Previous ${escapedLabel}">-</button>
      <button class="labx-control-stepper__btn" type="button" data-lab-action="workspace-setting-adjust" data-lab-field="${escapedField}" data-lab-reset="true" data-lab-options="${escapedOptions}" data-lab-reset-value="${escapeHtml(resetValue)}" title="Reset ${escapedLabel}">R</button>
      <button class="labx-control-stepper__btn" type="button" data-lab-action="workspace-setting-adjust" data-lab-field="${escapedField}" data-lab-delta="1" data-lab-options="${escapedOptions}" data-lab-reset-value="${escapeHtml(resetValue)}" title="Next ${escapedLabel}">+</button>
    </div>
  `;
}

function renderAudioSlider(
  label: string,
  field: string,
  value: number,
  min: number,
  max: number,
  step: number,
  unit: string,
  resetValue: number,
  disabled = false
) {
  const fullField = `workspace.audioFocus.${field}`;
  const escapedLabel = escapeHtml(label);
  const disabledAttr = disabled ? " disabled" : "";
  return `
    <div class="labx-control-row${disabled ? " is-disabled" : ""}">
      <span class="labx-control-row__label">${escapedLabel}</span>
      <input
        class="labx-range"
        type="range"
        min="${String(min)}"
        max="${String(max)}"
        step="${String(step)}"
        value="${String(value)}"
        data-lab-field="${escapeHtml(fullField)}"${disabledAttr}
      />
      <span class="labx-control-row__value">${String(value)}${unit}</span>
      ${renderSettingStepper(label, fullField, min, max, step, resetValue, disabled)}
    </div>
  `;
}

function renderEQBand(band: LabAudioFocusSettings["eqBands"][0], index: number) {
  const field = `workspace.audioFocus.eqBands.${String(index)}.gain`;
  const label = `${String(band.frequency)} Hz`;
  return `
    <div class="labx-eq-band">
      <span class="labx-eq-band__freq">${String(band.frequency)} Hz</span>
      <input
        class="labx-range labx-range--eq"
        type="range"
        min="-12"
        max="12"
        step="0.5"
        value="${String(band.gain)}"
        data-lab-field="${escapeHtml(field)}"
      />
      <span class="labx-eq-band__gain">${band.gain > 0 ? "+" : ""}${String(band.gain)} dB</span>
      ${renderSettingStepper(label, field, -12, 12, 0.5, 0)}
    </div>
  `;
}

type WorkspaceAudioFocusRenderOptions = {
  previewTarget?: "audio" | "video";
  temporalAudioFocus?: Pick<LabAudioFocusSettings, "playbackRate" | "preservePitch">;
  temporalControlsEnabled?: boolean;
};

export function renderWorkspaceAudioFocus(
  audioFocus: LabAudioFocusSettings,
  options: WorkspaceAudioFocusRenderOptions = {},
  copy: LabI18n = LAB_FALLBACK_I18N
) {
  const showFilterControls = audioFocus.filterType !== "none";
  const temporalControlsEnabled = options.temporalControlsEnabled !== false;
  const temporalAudioFocus = options.temporalAudioFocus || audioFocus;
  const disabledAttr = temporalControlsEnabled ? "" : " disabled";
  const previewTargetHint =
    options.previewTarget === "video"
      ? copy.t(
          "mediaAnalysis.audioFocus.previewTarget.video",
          "Playback rate affects the bound preview media transport."
        )
      : copy.t(
          "mediaAnalysis.audioFocus.previewTarget.audio",
          "Playback rate affects the current preview audio."
        );
  return `
    <section class="labx-audio-focus labx-workspace-focus-row__panel" id="lab-audio-focus">
      <div class="labx-audio-focus__header">
        <p class="labx-card__eyebrow">${escapeHtml(copy.t("mediaAnalysis.audioFocus.eyebrow", "AUDIO FOCUS"))}</p>
      </div>
      <div class="labx-audio-focus__controls">
        ${renderAudioSlider(copy.t("mediaAnalysis.audioFocus.fields.gain", "Gain"), "gain", audioFocus.gain, 0, 3, 0.1, "x", 1)}
        <div class="labx-control-row labx-control-row--select">
          <span class="labx-control-row__label">${escapeHtml(copy.t("mediaAnalysis.audioFocus.fields.filter", "Filter"))}</span>
          <select class="labx-select labx-select--compact" data-lab-field="workspace.audioFocus.filterType">
            ${(["none", "lowpass", "highpass", "bandpass"] as const)
              .map(function (entry) {
                const fallback =
                  entry === "none" ? "None" : entry.charAt(0).toUpperCase() + entry.slice(1);
                return `<option value="${entry}" ${audioFocus.filterType === entry ? "selected" : ""}>${escapeHtml(copy.t(`mediaAnalysis.audioFocus.filters.${entry}`, fallback))}</option>`;
              })
              .join("")}
          </select>
          <span class="labx-control-row__value"></span>
          ${renderOptionStepper(copy.t("mediaAnalysis.audioFocus.fields.filter", "Filter"), "workspace.audioFocus.filterType", ["none", "lowpass", "highpass", "bandpass"], "none")}
        </div>
        ${
          showFilterControls
            ? `
        ${renderAudioSlider(copy.t("mediaAnalysis.audioFocus.fields.cutoff", "Cutoff Freq"), "filterFrequency", audioFocus.filterFrequency, 20, 20000, 10, " Hz", 1000)}
        ${renderAudioSlider(copy.t("mediaAnalysis.audioFocus.fields.resonance", "Resonance (Q)"), "filterQ", audioFocus.filterQ, 0.1, 20, 0.1, "", 1)}
        `
            : ""
        }
      </div>
      <div class="labx-audio-focus__transport">
        <p class="labx-card__eyebrow">${escapeHtml(copy.t("mediaAnalysis.audioFocus.analysisAid", "ANALYSIS AID"))}</p>
        ${renderAudioSlider(copy.t("mediaAnalysis.audioFocus.fields.playbackSpeed", "Playback Speed"), "playbackRate", temporalAudioFocus.playbackRate, 0.25, 2, 0.05, "x", 1, !temporalControlsEnabled)}
        <label class="labx-control-toggle${temporalControlsEnabled ? "" : " is-disabled"}">
          <input
            type="checkbox"
            data-lab-field="workspace.audioFocus.preservePitch"
            ${temporalAudioFocus.preservePitch ? "checked" : ""}${disabledAttr}
          />
          <span>${escapeHtml(copy.t("mediaAnalysis.audioFocus.preservePitch", "Preserve pitch while changing speed"))}</span>
        </label>
        <p class="labx-audio-focus__transport-note">${escapeHtml(copy.t("mediaAnalysis.audioFocus.transportNote", "Slow down to inspect. Speed up to detect patterns."))}</p>
        <p class="labx-audio-focus__transport-note">${escapeHtml(previewTargetHint)}</p>
        ${
          temporalControlsEnabled
            ? ""
            : `<p class="labx-audio-focus__transport-note labx-audio-focus__transport-note--muted">${escapeHtml(copy.t("mediaAnalysis.audioFocus.dualPreviewLocked", "Dual preview keeps temporal playback fixed at 1x with preserved pitch."))}</p>`
        }
      </div>
      <p class="labx-panel-hint">
        ${escapeHtml(copy.t("mediaAnalysis.audioFocus.visualizerHint", "Timeline preview altinda tek realtime waveform katmani kullanilir. Spectrum modu ayni canvas uzerinde canli frekans gorunumu cizer."))}
      </p>
      <div class="labx-audio-focus__eq">
        <p class="labx-card__eyebrow">${escapeHtml(copy.t("mediaAnalysis.audioFocus.eqTitle", "PARAMETRIC EQ"))}</p>
        ${audioFocus.eqBands
          .map(function (band, i) {
            return renderEQBand(band, i);
          })
          .join("")}
      </div>
      <div class="labx-controls-actions">
        <button class="labx-inline-action" type="button" data-lab-action="workspace-reset-audio-focus">${escapeHtml(copy.t("mediaAnalysis.audioFocus.resetAction", "Reset All"))}</button>
      </div>
    </section>
  `;
}
