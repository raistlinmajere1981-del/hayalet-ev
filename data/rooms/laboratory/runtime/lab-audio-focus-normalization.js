export const DEFAULT_AUDIO_FOCUS_EQ_BANDS = [
  { frequency: 60, gain: 0, Q: 1, type: "lowshelf" },
  { frequency: 250, gain: 0, Q: 1, type: "peaking" },
  { frequency: 1e3, gain: 0, Q: 1, type: "peaking" },
  { frequency: 4e3, gain: 0, Q: 1, type: "peaking" },
  { frequency: 12e3, gain: 0, Q: 1, type: "highshelf" }
];
export const DEFAULT_AUDIO_FOCUS_SETTINGS = {
  gain: 1,
  filterType: "none",
  filterFrequency: 1e3,
  filterQ: 1,
  playbackRate: 1,
  preservePitch: true,
  visualizationMode: "waveform",
  eqBands: DEFAULT_AUDIO_FOCUS_EQ_BANDS
};
function clampNumber(value, min, max, fallback) {
  if (!Number.isFinite(value)) {
    return fallback;
  }
  return Math.max(min, Math.min(max, value));
}
function normalizeEqBand(band, fallbackBand) {
  return {
    frequency: clampNumber(
      typeof band?.frequency === "number" ? band.frequency : fallbackBand.frequency,
      20,
      2e4,
      fallbackBand.frequency
    ),
    gain: clampNumber(
      typeof band?.gain === "number" ? band.gain : fallbackBand.gain,
      -12,
      12,
      fallbackBand.gain
    ),
    Q: clampNumber(typeof band?.Q === "number" ? band.Q : fallbackBand.Q, 0.1, 20, fallbackBand.Q),
    type: band?.type === "lowshelf" || band?.type === "highshelf" || band?.type === "peaking" ? band.type : fallbackBand.type
  };
}
export function normalizeAudioFocusSettings(audioFocus, fallback = DEFAULT_AUDIO_FOCUS_SETTINGS) {
  const source = { ...fallback, ...audioFocus || {} };
  return {
    gain: clampNumber(source.gain, 0, 3, fallback.gain),
    filterType: source.filterType === "lowpass" || source.filterType === "highpass" || source.filterType === "bandpass" ? source.filterType : "none",
    filterFrequency: clampNumber(source.filterFrequency, 20, 2e4, fallback.filterFrequency),
    filterQ: clampNumber(source.filterQ, 0.1, 20, fallback.filterQ),
    playbackRate: clampNumber(source.playbackRate, 0.25, 2, fallback.playbackRate),
    preservePitch: source.preservePitch !== false,
    visualizationMode: source.visualizationMode === "spectrum" ? "spectrum" : "waveform",
    eqBands: DEFAULT_AUDIO_FOCUS_EQ_BANDS.map(function(fallbackBand, index) {
      const candidateBand = Array.isArray(audioFocus?.eqBands) ? audioFocus.eqBands[index] : source.eqBands[index];
      return normalizeEqBand(candidateBand, fallbackBand);
    })
  };
}
export function normalizeAudioFocusPatch(currentSettings, patch) {
  if (!patch) {
    return normalizeAudioFocusSettings(currentSettings, DEFAULT_AUDIO_FOCUS_SETTINGS);
  }
  return normalizeAudioFocusSettings(
    {
      ...currentSettings,
      ...patch,
      eqBands: patch.eqBands ?? currentSettings.eqBands
    },
    DEFAULT_AUDIO_FOCUS_SETTINGS
  );
}
export function createAudioFocusSignature(audioFocus) {
  return JSON.stringify({
    gain: Number(audioFocus.gain.toFixed(4)),
    filterFrequency: Number(audioFocus.filterFrequency.toFixed(2)),
    filterQ: Number(audioFocus.filterQ.toFixed(4)),
    filterType: audioFocus.filterType,
    eqBands: audioFocus.eqBands.map(function(band) {
      return {
        frequency: Number(band.frequency.toFixed(2)),
        gain: Number(band.gain.toFixed(4)),
        Q: Number(band.Q.toFixed(4)),
        type: band.type
      };
    })
  });
}
export function getDefaultAudioFocusEqBand(index) {
  const fallbackIndex = Math.max(0, Math.min(DEFAULT_AUDIO_FOCUS_EQ_BANDS.length - 1, index));
  return DEFAULT_AUDIO_FOCUS_EQ_BANDS[fallbackIndex];
}
