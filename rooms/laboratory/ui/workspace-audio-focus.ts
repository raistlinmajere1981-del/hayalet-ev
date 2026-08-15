import { escapeHtml } from "../domain/lab-types.js";
import type { LabAudioFocusSettings } from "../domain/lab-types.js";
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

function formatPlaybackRate(value: number) {
  return `${String(Number(value.toFixed(2)))}x`;
}

function formatTapePitchSemitones(playbackRate: number) {
  if (!Number.isFinite(playbackRate) || playbackRate <= 0) {
    return "0";
  }
  const semitones = 12 * Math.log2(playbackRate);
  const rounded = Math.abs(semitones) < 0.05 ? 0 : Number(semitones.toFixed(1));
  return `${rounded > 0 ? "+" : ""}${String(rounded)}`;
}

function renderPlaybackPresetButton(label: string, rate: number, currentRate: number) {
  const active = Math.abs(currentRate - rate) < 0.0005;
  return `<button
    class="labx-inline-action"
    type="button"
    data-lab-action="workspace-setting-adjust"
    data-lab-field="workspace.audioFocus.playbackRate"
    data-lab-reset="true"
    data-lab-reset-value="${String(rate)}"
    aria-pressed="${active ? "true" : "false"}"
    data-active="${active ? "true" : "false"}"
  >${escapeHtml(label)}</button>`;
}

function renderTemporalAudition(
  temporalAudioFocus: LabAudioFocusSettings,
  copy: LabI18n
) {
  const playbackRate = temporalAudioFocus.playbackRate;
  const preservePitch = temporalAudioFocus.preservePitch;
  const speedLabel = copy.t("mediaAnalysis.timeline.playbackSpeed", "Hız");
  const pitchStatus = preservePitch
    ? copy.t(
        "mediaAnalysis.audioFocus.pitchPreservedStatus",
        "Pitch korunuyor · hız değişse de ses perdesi sabit tutulur."
      )
    : copy.t(
        "mediaAnalysis.audioFocus.tapePitchStatus",
        `Tape pitch aktif · yaklaşık ${formatTapePitchSemitones(playbackRate)} st`
      );
  const speedPresets = [0.25, 0.5, 0.75, 1, 1.5, 2];
  const tapePitchPresets = [
    { label: "-12 st", rate: 0.5 },
    { label: "-6 st", rate: 0.707107 },
    { label: "0 st", rate: 1 },
    { label: "+6 st", rate: 1.414214 },
    { label: "+12 st", rate: 2 },
  ];

  return `
    <div class="labx-audio-focus__eq" data-lab-live-audio-audition="true">
      <p class="labx-card__eyebrow">${escapeHtml(copy.t("mediaAnalysis.audioFocus.liveAuditionTitle", "CANLI DİNLEME"))}</p>
      ${renderAudioSlider(speedLabel, "playbackRate", playbackRate, 0.25, 2, 0.05, "x", 1)}
      <div class="labx-controls-actions" aria-label="${escapeHtml(copy.t("mediaAnalysis.audioFocus.speedPresets", "Hız presetleri"))}">
        ${speedPresets
          .map(function (rate) {
            return renderPlaybackPresetButton(formatPlaybackRate(rate), rate, playbackRate);
          })
          .join("")}
      </div>
      <label class="labx-control-toggle">
        <input
          type="checkbox"
          ${preservePitch ? "checked" : ""}
          data-lab-field="workspace.audioFocus.preservePitch"
        />
        <span>${escapeHtml(copy.t("mediaAnalysis.audioFocus.preservePitch", "Pitch'i koru"))}</span>
      </label>
      <p class="labx-operation-card__reason">${escapeHtml(pitchStatus)}</p>
      ${
        preservePitch
          ? ""
          : `
            <div class="labx-controls-actions" aria-label="${escapeHtml(copy.t("mediaAnalysis.audioFocus.tapePitchPresets", "Tape pitch presetleri"))}">
              ${tapePitchPresets
                .map(function (preset) {
                  return renderPlaybackPresetButton(preset.label, preset.rate, playbackRate);
                })
                .join("")}
            </div>
          `
      }
    </div>
  `;
}

type WorkspaceAudioFocusRenderOptions = {
  previewTarget?: "audio" | "video";
  temporalAudioFocus?: Pick<LabAudioFocusSettings, "playbackRate" | "preservePitch">;
};

export function renderWorkspaceAudioFocus(
  audioFocus: LabAudioFocusSettings,
  options: WorkspaceAudioFocusRenderOptions = {},
  copy: LabI18n = LAB_FALLBACK_I18N
) {
  const showFilterControls = audioFocus.filterType !== "none";
  const temporalAudioFocus: LabAudioFocusSettings | null =
    options.temporalAudioFocus === undefined
      ? null
      : {
          ...audioFocus,
          ...options.temporalAudioFocus,
        };
  return `
    <section class="labx-audio-focus labx-workspace-focus-row__panel" id="lab-audio-focus">
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
      ${temporalAudioFocus === null ? "" : renderTemporalAudition(temporalAudioFocus, copy)}
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
