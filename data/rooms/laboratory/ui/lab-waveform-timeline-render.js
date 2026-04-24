import { escapeHtml } from "../models/lab-types.js";
function formatTimePrecise(ms) {
  const totalMs = Math.round(ms);
  const minutes = Math.floor(totalMs / 6e4);
  const seconds = Math.floor(totalMs % 6e4 / 1e3);
  const millis = totalMs % 1e3;
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}.${String(millis).padStart(3, "0")}`;
}
function formatTimeShort(ms) {
  const totalSeconds = Math.round(ms / 1e3);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}
function formatDuration(ms) {
  if (ms < 1e3) {
    return `${ms}ms`;
  }
  const totalSeconds = ms / 1e3;
  if (totalSeconds < 60) {
    return `${totalSeconds.toFixed(1)}s`;
  }
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = (totalSeconds % 60).toFixed(1);
  return `${minutes}m ${seconds}s`;
}
function formatSelectionType(type) {
  return {
    clip: "Clip",
    focus: "Focus",
    inspect: "Inspect",
    unknown: "Unknown"
  }[type ?? "unknown"];
}
const SELECTION_INTENT_OPTIONS = [
  "anomaly",
  "motion",
  "audio",
  "visual",
  "general"
];
function formatSelectionIntent(intent) {
  return {
    anomaly: "Anomaly",
    motion: "Motion",
    audio: "Audio",
    visual: "Visual",
    general: "General",
    unknown: "Unknown"
  }[intent ?? "unknown"];
}
function getSuggestionPriorityClass(suggestion) {
  return suggestion.confidence >= 0.8 ? "is-primary" : "is-secondary";
}
function renderSelectionSuggestions(suggestions) {
  if (suggestions.length === 0) {
    return "";
  }
  return `
    <div class="lab-selection-panel__suggestions">
      <div class="lab-selection-panel__suggestions-title">Suggested actions</div>
      <div class="lab-selection-panel__suggestions-list">
        ${suggestions.map(function(suggestion) {
    return `<button
              class="lab-selection-panel__suggestion ${getSuggestionPriorityClass(suggestion)}"
              type="button"
              data-lab-selection-suggestion="${escapeHtml(suggestion.id)}"
              data-suggestion-priority="${suggestion.confidence >= 0.8 ? "primary" : "secondary"}"
            >
              <span class="lab-selection-panel__suggestion-label">${escapeHtml(suggestion.label)}</span>
              ${typeof suggestion.description === "string" && suggestion.description.trim() !== "" ? `<span class="lab-selection-panel__suggestion-description">${escapeHtml(suggestion.description)}</span>` : ""}
            </button>`;
  }).join("")}
      </div>
    </div>
  `;
}
function formatEstimatedCost(cost) {
  return {
    low: "Low",
    medium: "Medium",
    high: "High"
  }[cost ?? "low"];
}
function renderSuggestionPreview(preview) {
  if (preview === null) {
    return "";
  }
  return `
    <div class="lab-selection-preview" data-lab-selection-preview="true">
      <div class="lab-selection-preview__eyebrow">Preview</div>
      <div class="lab-selection-preview__title">${escapeHtml(preview.title)}</div>
      <div class="lab-selection-preview__section">
        <div class="lab-selection-preview__section-title">Steps</div>
        <ul class="lab-selection-preview__list lab-selection-preview__list--steps">
          ${preview.steps.map(function(step) {
    return `<li>${escapeHtml(step)}</li>`;
  }).join("")}
        </ul>
      </div>
      ${preview.expectedOutputs.length > 0 ? `
        <div class="lab-selection-preview__section">
          <div class="lab-selection-preview__section-title">Outputs</div>
          <ul class="lab-selection-preview__list lab-selection-preview__list--outputs">
            ${preview.expectedOutputs.map(function(output) {
    return `<li>${escapeHtml(output)}</li>`;
  }).join("")}
          </ul>
        </div>
      ` : ""}
      ${preview.estimatedCost ? `<div class="lab-selection-preview__cost">Estimated cost: ${escapeHtml(formatEstimatedCost(preview.estimatedCost))}</div>` : ""}
    </div>
  `;
}
function renderFineTuneButtons(prefix, msValue) {
  return `
    <div class="labx-timeline__finetune">
      <button class="labx-timeline__finetune-btn" type="button" data-lab-action="timeline-finetune" data-lab-value="${prefix}:-1000" title="-1s">&#9664;&#9664;</button>
      <button class="labx-timeline__finetune-btn" type="button" data-lab-action="timeline-finetune" data-lab-value="${prefix}:-100" title="-100ms">&#9664;</button>
      <button class="labx-timeline__finetune-btn" type="button" data-lab-action="timeline-finetune" data-lab-value="${prefix}:-10" title="-10ms">&#8249;</button>
      <span class="labx-timeline__finetune-value">${formatTimePrecise(msValue)}</span>
      <button class="labx-timeline__finetune-btn" type="button" data-lab-action="timeline-finetune" data-lab-value="${prefix}:+10" title="+10ms">&#8250;</button>
      <button class="labx-timeline__finetune-btn" type="button" data-lab-action="timeline-finetune" data-lab-value="${prefix}:+100" title="+100ms">&#9654;</button>
      <button class="labx-timeline__finetune-btn" type="button" data-lab-action="timeline-finetune" data-lab-value="${prefix}:+1000" title="+1s">&#9654;&#9654;</button>
    </div>
  `;
}
export function renderLabWaveformTimeline(model) {
  const durationMs = Math.max(1, model.durationMs);
  const rawStartMs = model.startMs ?? 0;
  const rawEndMs = model.endMs ?? durationMs;
  const hasSelection = model.startMs !== null && model.endMs !== null && model.endMs > model.startMs;
  const activeSelection = hasSelection === true ? model.activeSelection ?? {
    id: "selection-preview",
    startMs: rawStartMs,
    endMs: rawEndMs,
    type: "clip",
    intent: "general",
    createdAt: 0
  } : null;
  const hasSemanticSelection = model.activeSelection !== null && model.activeSelection !== void 0 && model.activeSelection.endMs > model.activeSelection.startMs;
  const selectionSuggestions = hasSemanticSelection ? model.selectionSuggestions ?? [] : [];
  const suggestionPreview = hasSemanticSelection ? model.activeSuggestionPreview ?? null : null;
  const selectionIntent = activeSelection?.intent ?? "general";
  const startMs = hasSelection ? rawStartMs : 0;
  const endMs = hasSelection ? rawEndMs : durationMs;
  const startPct = hasSelection ? Math.max(0, Math.min(100, startMs / durationMs * 100)) : 0;
  const endPct = hasSelection ? Math.max(0, Math.min(100, endMs / durationMs * 100)) : 100;
  const selectionCenterPct = hasSelection ? startPct + (endPct - startPct) / 2 : 0;
  const selectionDurationMs = hasSelection ? Math.max(0, endMs - startMs) : 0;
  const waveformWindowStartPct = Math.max(
    0,
    Math.min(100, model.waveformWindowStartMs / durationMs * 100)
  );
  const waveformWindowWidthPct = Math.max(
    0,
    Math.min(100 - waveformWindowStartPct, model.waveformWindowDurationMs / durationMs * 100)
  );
  const hasVisibleWaveform = waveformWindowWidthPct > 0;
  const bookmarkPins = model.bookmarks.map(function(bookmark) {
    const pct = Math.max(0, Math.min(100, bookmark.timeMs / durationMs * 100));
    return `
        <div
          class="labx-timeline__pin"
          style="left: ${String(pct)}%"
          title="${escapeHtml(bookmark.note || formatTimePrecise(bookmark.timeMs))}"
          data-lab-action="timeline-seek"
          data-lab-value="${String(bookmark.timeMs)}"
        ></div>
      `;
  }).join("");
  const hintLabel = hasVisibleWaveform === true ? model.startMs !== null && model.endMs !== null && hasSelection !== true ? "End must be greater than start to create a valid selection." : "Click to seek, drag to create a selection." : "Waveform falls outside the visible master range.";
  return `
    <div class="labx-timeline" id="lab-timeline" data-duration="${String(durationMs)}" data-waveform-mode="${model.dualPreviewActive ? "linked-audio" : "source-audio"}">
      <div class="labx-timeline__header">
        <div class="labx-timeline__header-copy">
          <p class="labx-card__eyebrow">TIMELINE</p>
          <strong>${escapeHtml(model.waveformSourceLabel)}</strong>
        </div>
        <span class="labx-timeline__sync">${escapeHtml(model.waveformSyncLabel)}</span>
      </div>
      <div class="labx-timeline__track">
        <div class="labx-timeline__waveform-bed"></div>
        ${hasVisibleWaveform ? `
          <div
            class="labx-timeline__waveform-window"
            style="left: ${String(waveformWindowStartPct)}%; width: ${String(waveformWindowWidthPct)}%"
          >
            <canvas
              id="lab-audio-viz"
              class="labx-audio-viz labx-audio-viz--timeline lab-audio-viz-canvas"
              width="960"
              height="112"
              data-lab-viz="audio-waveform-timeline"
              data-lab-viz-mode="${escapeHtml(model.visualizationMode ?? "waveform")}"
              data-waveform-crop-start="${String(model.waveformCropStartRatio ?? 0)}"
              data-waveform-crop-end="${String(model.waveformCropEndRatio ?? 1)}"
            ></canvas>
          </div>
        ` : ""}
        <div class="labx-timeline__playhead" data-lab-role="timeline-playhead" style="left: 0%">
          <span class="labx-timeline__playhead-label" data-lab-role="timeline-playhead-label">00:00.000</span>
        </div>
        <div class="labx-timeline__rail" data-lab-action="timeline-interact"></div>
        ${hasSelection ? `
          <div
            class="lab-selection-panel"
            style="left: ${String(selectionCenterPct)}%"
            data-selection-intent="${escapeHtml(selectionIntent)}"
            data-lab-selection-panel="true"
          >
            <div class="lab-selection-panel__eyebrow">Selection</div>
            <div class="lab-selection-panel__range">
              ${formatTimePrecise(startMs)} &#8594; ${formatTimePrecise(endMs)}
              <span class="lab-selection-panel__duration">(${formatDuration(selectionDurationMs)})</span>
            </div>
            <div class="lab-selection-panel__meta">Type: ${escapeHtml(formatSelectionType(activeSelection?.type))}</div>
            <div class="lab-selection-panel__intent-summary">Intent: ${escapeHtml(formatSelectionIntent(selectionIntent))}</div>
            ${typeof activeSelection?.label === "string" && activeSelection.label.trim() !== "" ? `<div class="lab-selection-panel__label">${escapeHtml(activeSelection.label)}</div>` : ""}
            <div class="lab-selection-panel__intent-picker" data-lab-role="selection-intent-picker">
              ${SELECTION_INTENT_OPTIONS.map(function(intent) {
    const isActive = selectionIntent === intent;
    return `<button
                  class="lab-selection-panel__intent-pill${isActive ? " is-active" : ""}"
                  type="button"
                  aria-pressed="${String(isActive)}"
                  data-lab-selection-intent="${intent}"
                >${escapeHtml(formatSelectionIntent(intent))}</button>`;
  }).join("")}
            </div>
            <div class="lab-selection-panel__hint">This selection will guide future analysis</div>
            ${renderSelectionSuggestions(selectionSuggestions)}
            ${renderSuggestionPreview(suggestionPreview)}
          </div>
          <div
            class="labx-timeline__selection lab-selection-overlay"
            style="left: ${String(startPct)}%; width: ${String(endPct - startPct)}%"
            data-selection-intent="${escapeHtml(selectionIntent)}"
          >
            <div class="labx-timeline__handle labx-timeline__handle--start" data-lab-action="timeline-drag-start"></div>
            <div class="labx-timeline__handle labx-timeline__handle--end" data-lab-action="timeline-drag-end"></div>
            <div class="labx-timeline__selection-body" data-lab-action="timeline-drag-body"></div>
            <div class="labx-timeline__selection-duration">${formatDuration(selectionDurationMs)}</div>
          </div>
        ` : `<div class="labx-timeline__hint">${escapeHtml(hintLabel)}</div>`}
        ${bookmarkPins}
      </div>
      <div class="labx-timeline__controls">
        <div class="labx-timeline__range-info">
          <span class="labx-timeline__duration">${formatTimeShort(durationMs)}</span>
          ${hasSelection ? `
            <span class="labx-timeline__range-label">
              ${formatTimePrecise(startMs)} — ${formatTimePrecise(endMs)}
            </span>
            <span class="labx-timeline__range-duration">(${formatDuration(selectionDurationMs)})</span>
          ` : ""}
        </div>
        <div class="labx-timeline__actions">
          ${hasSelection ? `<button class="labx-timeline__clear-btn" type="button" data-lab-action="timeline-clear">Clear</button>
                 <button class="labx-timeline__export-btn" type="button" data-lab-action="timeline-export-clip" title="Export selected range as video clip">Export Clip</button>` : ""}
          <button class="labx-timeline__export-btn" type="button" data-lab-action="timeline-grab-frame" title="Capture current frame as image">Grab Frame</button>
          <button class="labx-timeline__export-btn" type="button" data-lab-action="timeline-extract-audio" title="Extract source audio">Extract Audio</button>
        </div>
      </div>
      ${hasSelection ? `
        <div class="labx-timeline__finetune-row">
          <label class="labx-timeline__finetune-label">Start</label>
          ${renderFineTuneButtons("start", startMs)}
        </div>
        <div class="labx-timeline__finetune-row">
          <label class="labx-timeline__finetune-label">End</label>
          ${renderFineTuneButtons("end", endMs)}
        </div>
      ` : ""}
      <div class="labx-timeline__numeric">
        <label class="labx-field labx-field--compact">
          <span>Start (ms)</span>
          <input class="labx-input labx-input--compact" type="number" min="0" max="${String(durationMs)}" data-lab-field="workspace.timelineStartMs" value="${model.startMs !== null ? String(model.startMs) : ""}" placeholder="ms" />
        </label>
        <label class="labx-field labx-field--compact">
          <span>End (ms)</span>
          <input class="labx-input labx-input--compact" type="number" min="0" max="${String(durationMs)}" data-lab-field="workspace.timelineEndMs" value="${model.endMs !== null ? String(model.endMs) : ""}" placeholder="ms" />
        </label>
      </div>
    </div>
  `;
}
