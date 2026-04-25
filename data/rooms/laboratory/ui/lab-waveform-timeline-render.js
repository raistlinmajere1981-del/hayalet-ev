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
function supportsInspectionMode(mode, sourceKind) {
  switch (mode) {
    case "none":
      return true;
    case "audio":
      return sourceKind === "audio" || sourceKind === "video";
    case "motion":
      return sourceKind === "video";
    case "visual":
      return sourceKind === "image" || sourceKind === "video";
    default:
      return false;
  }
}
const INSPECTION_MODE_OPTIONS = [
  "none",
  "visual",
  "audio",
  "motion"
];
function formatInspectionMode(mode) {
  return {
    none: "None",
    visual: "Visual",
    audio: "Audio",
    motion: "Motion"
  }[mode];
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
function getToolHintGlyph(suggestion) {
  switch (suggestion.actionType) {
    case "analyze-segment":
    case "extract-clip":
    case "focus-region":
    case "inspect-audio":
      return "+";
    case "inspect-motion":
      return ">";
    case "enhance-visual":
      return "*";
    case "stabilize-segment":
      return "=";
    default:
      return "·";
  }
}
function renderInspectionToolHints(suggestions) {
  const toolHintSuggestions = suggestions.filter(function(suggestion) {
    return typeof suggestion.toolHint === "string" && suggestion.toolHint.trim() !== "";
  });
  if (toolHintSuggestions.length === 0) {
    return "";
  }
  return `
    <div class="lab-selection-panel__tools">
      <div class="lab-selection-panel__tools-title">Inspection tools</div>
      <div class="lab-selection-panel__tools-list">
        ${toolHintSuggestions.map(function(suggestion) {
    return `<button
              class="lab-selection-panel__tool-hint"
              type="button"
              data-lab-selection-suggestion="${escapeHtml(suggestion.id)}"
            >
              <span class="lab-selection-panel__tool-hint-icon" aria-hidden="true">${escapeHtml(getToolHintGlyph(suggestion))}</span>
              <span class="lab-selection-panel__tool-hint-label">${escapeHtml(suggestion.toolHint || suggestion.label)}</span>
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
function renderExecutionIntentStrip(activeExecutionIntent) {
  if (activeExecutionIntent === null) {
    return "";
  }
  return `
    <div class="lab-selection-panel__execution-intent">
      <div class="lab-selection-panel__execution-intent-copy">
        <span class="lab-selection-panel__execution-intent-eyebrow">Selected action</span>
        <strong class="lab-selection-panel__execution-intent-label">${escapeHtml(activeExecutionIntent.label)}</strong>
      </div>
      <button
        class="lab-selection-panel__execution-intent-clear"
        type="button"
        data-lab-execution-intent-clear="true"
      >Clear</button>
    </div>
  `;
}
function renderSuggestionPreview(preview, activeExecutionIntent) {
  if (preview === null) {
    return "";
  }
  const executionIntentSelected = activeExecutionIntent?.id === preview.suggestionId;
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
      <div class="lab-selection-preview__actions">
        <button
          class="lab-selection-preview__action lab-selection-preview__action--primary${executionIntentSelected ? " is-active" : ""}"
          type="button"
          data-lab-execution-intent-accept="${escapeHtml(preview.suggestionId)}"
          aria-pressed="${String(executionIntentSelected)}"
        >${executionIntentSelected ? "Intent selected" : "I want this"}</button>
        <button
          class="lab-selection-preview__action"
          type="button"
          data-lab-execution-intent-dismiss="${escapeHtml(preview.suggestionId)}"
        >Not now</button>
        <button
          class="lab-selection-preview__action lab-selection-preview__action--subtle"
          type="button"
          data-lab-execution-intent-queue="${escapeHtml(preview.suggestionId)}"
        >Queue for later</button>
      </div>
    </div>
  `;
}
function formatInterpretationType(type) {
  return {
    info: "Info",
    warning: "Warning",
    hint: "Hint"
  }[type];
}
function formatInterpretationSeverity(severity) {
  if (severity === void 0) {
    return "";
  }
  return {
    low: "Low",
    medium: "Medium",
    high: "High"
  }[severity];
}
function getInterpretationIcon(type) {
  return {
    info: "i",
    warning: "!",
    hint: "~"
  }[type];
}
function renderInterpretationPanel(items, variant) {
  if (items.length === 0) {
    return "";
  }
  return `
    <details class="lab-interpretation-panel lab-interpretation-panel--${variant}" data-lab-interpretation-panel="true" open>
      <summary class="lab-interpretation-panel__summary">
        <span class="lab-interpretation-panel__eyebrow">Interpretation</span>
        <span class="lab-interpretation-panel__count">${String(items.length)}</span>
      </summary>
      <div class="lab-interpretation-panel__list">
        ${items.map(function(item) {
    const severityLabel = formatInterpretationSeverity(item.severity);
    return `<div class="lab-interpretation-panel__item" data-tone="${escapeHtml(item.type)}"${item.severity ? ` data-severity="${escapeHtml(item.severity)}"` : ""}>
              <span class="lab-interpretation-panel__icon" aria-hidden="true">${escapeHtml(getInterpretationIcon(item.type))}</span>
              <div class="lab-interpretation-panel__copy">
                <div class="lab-interpretation-panel__meta">${escapeHtml(formatInterpretationType(item.type))}${severityLabel ? `<span class="lab-interpretation-panel__severity">${escapeHtml(severityLabel)}</span>` : ""}</div>
                <div class="lab-interpretation-panel__message">${escapeHtml(item.message)}</div>
                ${item.recommendation ? `<div class="lab-interpretation-panel__recommendation">&#8594; ${escapeHtml(item.recommendation)}</div>` : ""}
              </div>
            </div>`;
  }).join("")}
      </div>
    </details>
  `;
}
function renderSelectionRegionTools(options) {
  if (options.selectionRoi === void 0 && options.snapshot === null) {
    return "";
  }
  return `
    <div class="lab-selection-panel__region-tools">
      ${options.selectionRoi ? `
            <button
              class="lab-selection-panel__region-tool"
              type="button"
              ${options.roiFocusActive ? `data-lab-selection-roi-focus-reset="true"` : `data-lab-selection-roi-focus-toggle="true"`}
            >${options.roiFocusActive ? "Reset focus" : "Focus region"}</button>
            <button
              class="lab-selection-panel__region-tool"
              type="button"
              data-lab-selection-roi-capture="true"
            >Capture region</button>
            ${options.sourceKind === "video" ? `
                  <button class="lab-selection-panel__region-tool" type="button" data-lab-selection-roi-frame-step="-1">Frame -1</button>
                  <button class="lab-selection-panel__region-tool" type="button" data-lab-selection-roi-frame-step="1">Frame +1</button>
                ` : ""}
          ` : ""}
      ${options.snapshot !== null ? `<button class="lab-selection-panel__region-tool is-secondary" type="button" data-lab-selection-roi-snapshot-clear="true">Dismiss snapshot</button>` : ""}
    </div>
  `;
}
function renderInspectionSnapshot(snapshot) {
  if (snapshot === null) {
    return "";
  }
  const timeLabel = snapshot.timeMs !== null ? formatTimePrecise(snapshot.timeMs) : "Static frame";
  return `
    <div class="lab-selection-snapshot" data-lab-selection-snapshot="true">
      <div class="lab-selection-snapshot__head">
        <div class="lab-selection-snapshot__eyebrow">Region snapshot</div>
        <div class="lab-selection-snapshot__meta">${escapeHtml(timeLabel)} · ${escapeHtml(String(snapshot.width))}×${escapeHtml(String(snapshot.height))}</div>
      </div>
      <div class="lab-selection-snapshot__image-wrap">
        <img class="lab-selection-snapshot__image" src="${escapeHtml(snapshot.objectUrl)}" alt="Temporary inspection snapshot" />
      </div>
    </div>
  `;
}
function renderWaveformInspectionLens(model) {
  const lens = model.waveformInspectionLens;
  if (!lens || lens.enabled !== true) {
    return "";
  }
  return `
    <div class="labx-timeline__inspection-lens" data-lab-timeline-inspection-lens="true">
      <div class="labx-timeline__inspection-lens-head">
        <div class="labx-timeline__inspection-lens-title">Selection micro zoom</div>
        <div class="labx-timeline__inspection-lens-meta">${escapeHtml(lens.sourceLabel)}</div>
      </div>
      <div class="labx-timeline__inspection-lens-window">
        <canvas
          id="lab-audio-viz-inspection"
          class="labx-audio-viz labx-audio-viz--inspection lab-audio-viz-canvas"
          width="960"
          height="92"
          data-lab-viz="audio-waveform-inspection"
          data-lab-viz-mode="waveform"
          data-waveform-inspection-crop-start="${String(lens.cropStartRatio)}"
          data-waveform-inspection-crop-end="${String(lens.cropEndRatio)}"
        ></canvas>
      </div>
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
  const activeExecutionIntent = hasSemanticSelection ? model.activeExecutionIntent ?? null : null;
  const actionSuggestions = selectionSuggestions.filter(function(suggestion) {
    return typeof suggestion.toolHint !== "string" || suggestion.toolHint.trim() === "";
  });
  const suggestionPreview = hasSemanticSelection ? model.activeSuggestionPreview ?? null : null;
  const activeInspectionSnapshot = model.activeInspectionSnapshot ?? null;
  const interpretationItems = model.interpretationItems ?? [];
  const inspectionMode = model.inspectionMode ?? "none";
  const roiFocusActive = model.roiFocusActive === true;
  const selectionIntent = activeSelection?.intent ?? "general";
  const startMs = hasSelection ? rawStartMs : 0;
  const endMs = hasSelection ? rawEndMs : durationMs;
  const startPct = hasSelection ? Math.max(0, Math.min(100, startMs / durationMs * 100)) : 0;
  const endPct = hasSelection ? Math.max(0, Math.min(100, endMs / durationMs * 100)) : 100;
  const selectionCenterPct = hasSelection ? startPct + (endPct - startPct) / 2 : 0;
  const selectionDurationMs = hasSelection ? Math.max(0, endMs - startMs) : 0;
  const selectionRoi = activeSelection?.roi;
  const selectionRoiLabel = selectionRoi ? `Region active${roiFocusActive ? " · Focused" : ""} · ${Math.round(selectionRoi.width * 100)}% × ${Math.round(selectionRoi.height * 100)}%` : "Region inactive";
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
            <div class="lab-selection-panel__region-row">
              <span class="lab-selection-panel__region-state${selectionRoi ? " is-active" : ""}">${escapeHtml(selectionRoiLabel)}</span>
              ${selectionRoi ? `<button class="lab-selection-panel__region-clear" type="button" data-lab-selection-roi-clear="true">Clear region</button>` : ""}
            </div>
            ${renderSelectionRegionTools({
    roiFocusActive,
    selectionRoi,
    snapshot: activeInspectionSnapshot,
    sourceKind: model.sourceKind
  })}
            <div class="lab-selection-panel__inspection">
              <div class="lab-selection-panel__inspection-title">Inspection mode</div>
              <div class="lab-selection-panel__inspection-modes">
                ${INSPECTION_MODE_OPTIONS.map(function(mode) {
    const isActive = inspectionMode === mode;
    const isSupported = supportsInspectionMode(mode, model.sourceKind);
    return `<button
                    class="lab-selection-panel__inspection-pill${isActive ? " is-active" : ""}"
                    type="button"
                    aria-pressed="${String(isActive)}"
                    ${isSupported ? `data-lab-selection-inspection-mode="${mode}"` : "disabled"}
                  >${escapeHtml(formatInspectionMode(mode))}</button>`;
  }).join("")}
              </div>
            </div>
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
            ${renderExecutionIntentStrip(activeExecutionIntent)}
            ${renderInspectionToolHints(selectionSuggestions)}
            ${renderInspectionSnapshot(activeInspectionSnapshot)}
            ${renderSelectionSuggestions(actionSuggestions)}
            ${renderSuggestionPreview(suggestionPreview, activeExecutionIntent)}
            ${renderInterpretationPanel(interpretationItems, "embedded")}
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
      ${renderWaveformInspectionLens(model)}
      ${hasSelection ? "" : renderInterpretationPanel(interpretationItems, "standalone")}
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
