import {
  LAB_ANALYSIS_MODULE_SETTINGS_DEFAULTS,
  LAB_ANALYSIS_MODULE_SETTINGS_FIELDS,
} from "./lab-capabilities.js";
import type { LabSettingsFieldMeta, LabSettingsRecord } from "./lab-capability-definitions.js";

const ADVANCED_AUDIO_DEFAULTS: Record<string, LabSettingsRecord> = {
  "spectral-artifacts": {
    subsonicMap: true,
    inverseSpectrumMap: true,
  },
  "spectrogram-guided-recovery": {
    slowPlaybackMode: "all",
  },
  "frequency-shift-reversal": {
    pitchShiftMode: "ladder",
    pitchSemitones: 6,
  },
};

const ADVANCED_AUDIO_FIELDS: Record<string, LabSettingsFieldMeta[]> = {
  "spectral-artifacts": [
    { id: "subsonicMap", label: "Subsonic 0-20 Hz", kind: "toggle" },
    { id: "inverseSpectrumMap", label: "Inverse spectrum", kind: "toggle" },
  ],
  "spectrogram-guided-recovery": [
    {
      id: "slowPlaybackMode",
      label: "Slow playback",
      kind: "select",
      options: [
        { label: "0.1x + 0.25x + 0.5x", value: "all" },
        { label: "0.1x", value: "slow-0-1" },
        { label: "0.25x", value: "slow-0-25" },
        { label: "0.5x", value: "slow-0-5" },
        { label: "Off", value: "off" },
      ],
    },
  ],
  "frequency-shift-reversal": [
    {
      id: "pitchShiftMode",
      label: "Pitch mode",
      kind: "select",
      options: [
        { label: "Ladder (-12 / -6 / +6 / +12)", value: "ladder" },
        { label: "Single", value: "single" },
        { label: "Off", value: "off" },
      ],
    },
    {
      id: "pitchSemitones",
      label: "Pitch",
      kind: "number",
      min: -24,
      max: 24,
      step: 1,
      unit: "st",
    },
  ],
};

let registered = false;

function appendUniqueFields(moduleId: string, fields: LabSettingsFieldMeta[]) {
  const currentFields = LAB_ANALYSIS_MODULE_SETTINGS_FIELDS[moduleId] || [];
  const existingIds = new Set(currentFields.map((field) => field.id));
  LAB_ANALYSIS_MODULE_SETTINGS_FIELDS[moduleId] = currentFields.concat(
    fields.filter((field) => !existingIds.has(field.id))
  );
}

/**
 * Adds advanced audio-forensics settings to the shared Laboratory settings maps.
 * Kept as an idempotent registration step so the renderer and host process can
 * opt into the extension without duplicating the core capability definitions.
 */
export function ensureAdvancedAudioAnalysisSettingsRegistered() {
  if (registered) {
    return;
  }
  registered = true;

  Object.entries(ADVANCED_AUDIO_DEFAULTS).forEach(function ([moduleId, defaults]) {
    LAB_ANALYSIS_MODULE_SETTINGS_DEFAULTS[moduleId] = {
      ...(LAB_ANALYSIS_MODULE_SETTINGS_DEFAULTS[moduleId] || {}),
      ...defaults,
    };
  });

  Object.entries(ADVANCED_AUDIO_FIELDS).forEach(function ([moduleId, fields]) {
    appendUniqueFields(moduleId, fields);
  });
}
