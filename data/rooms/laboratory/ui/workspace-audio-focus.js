function renderEQBand(band, index) {
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
        data-lab-field="workspace.audioFocus.eqBands.${String(index)}.gain"
      />
      <span class="labx-eq-band__gain">${band.gain > 0 ? "+" : ""}${String(band.gain)} dB</span>
    </div>
  `;
}
export function renderWorkspaceAudioFocus(audioFocus, options = {}) {
  const showFilterControls = audioFocus.filterType !== "none";
  const temporalControlsEnabled = options.temporalControlsEnabled !== false;
  const temporalAudioFocus = options.temporalAudioFocus || audioFocus;
  const disabledAttr = temporalControlsEnabled ? "" : " disabled";
  const previewTargetHint = options.previewTarget === "video" ? "Playback rate affects the bound preview media transport." : "Playback rate affects the current preview audio.";
  return `
    <section class="labx-audio-focus labx-workspace-focus-row__panel" id="lab-audio-focus">
      <div class="labx-audio-focus__header">
        <p class="labx-card__eyebrow">AUDIO FOCUS</p>
      </div>
      <div class="labx-audio-focus__controls">
        <label class="labx-control-row">
          <span class="labx-control-row__label">Gain</span>
          <input
            class="labx-range"
            type="range"
            min="0"
            max="3"
            step="0.1"
            value="${String(audioFocus.gain)}"
            data-lab-field="workspace.audioFocus.gain"
          />
          <span class="labx-control-row__value">${String(audioFocus.gain)}x</span>
        </label>
        <label class="labx-control-row">
          <span class="labx-control-row__label">Filter</span>
          <select class="labx-select labx-select--compact" data-lab-field="workspace.audioFocus.filterType">
            ${["none", "lowpass", "highpass", "bandpass"].map(function(entry) {
    return `<option value="${entry}" ${audioFocus.filterType === entry ? "selected" : ""}>${entry === "none" ? "None" : entry.charAt(0).toUpperCase() + entry.slice(1)}</option>`;
  }).join("")}
          </select>
        </label>
        ${showFilterControls ? `
        <label class="labx-control-row">
          <span class="labx-control-row__label">Cutoff Freq</span>
          <input
            class="labx-range"
            type="range"
            min="20"
            max="20000"
            step="10"
            value="${String(audioFocus.filterFrequency)}"
            data-lab-field="workspace.audioFocus.filterFrequency"
          />
          <span class="labx-control-row__value">${String(audioFocus.filterFrequency)} Hz</span>
        </label>
        <label class="labx-control-row">
          <span class="labx-control-row__label">Resonance (Q)</span>
          <input
            class="labx-range"
            type="range"
            min="0.1"
            max="20"
            step="0.1"
            value="${String(audioFocus.filterQ)}"
            data-lab-field="workspace.audioFocus.filterQ"
          />
          <span class="labx-control-row__value">${String(audioFocus.filterQ)}</span>
        </label>
        ` : ""}
      </div>
      <div class="labx-audio-focus__transport">
        <p class="labx-card__eyebrow">ANALYSIS AID</p>
        <label class="labx-control-row${temporalControlsEnabled ? "" : " is-disabled"}">
          <span class="labx-control-row__label">Playback Speed</span>
          <input
            class="labx-range"
            type="range"
            min="0.25"
            max="2"
            step="0.05"
            value="${String(temporalAudioFocus.playbackRate)}"
            data-lab-field="workspace.audioFocus.playbackRate"${disabledAttr}
          />
          <span class="labx-control-row__value">${String(temporalAudioFocus.playbackRate)}x</span>
        </label>
        <label class="labx-control-toggle${temporalControlsEnabled ? "" : " is-disabled"}">
          <input
            type="checkbox"
            data-lab-field="workspace.audioFocus.preservePitch"
            ${temporalAudioFocus.preservePitch ? "checked" : ""}${disabledAttr}
          />
          <span>Preserve pitch while changing speed</span>
        </label>
        <p class="labx-audio-focus__transport-note">Slow down to inspect. Speed up to detect patterns.</p>
        <p class="labx-audio-focus__transport-note">${previewTargetHint}</p>
        ${temporalControlsEnabled ? "" : `<p class="labx-audio-focus__transport-note labx-audio-focus__transport-note--muted">Dual preview keeps temporal playback fixed at 1x with preserved pitch.</p>`}
      </div>
      <p class="labx-panel-hint">
        Timeline preview altinda tek realtime waveform katmani kullanilir. Spectrum modu ayni canvas uzerinde canli frekans gorunumu cizer.
      </p>
      <div class="labx-audio-focus__eq">
        <p class="labx-card__eyebrow">PARAMETRIC EQ</p>
        ${audioFocus.eqBands.map(function(band, i) {
    return renderEQBand(band, i);
  }).join("")}
      </div>
    </section>
  `;
}
