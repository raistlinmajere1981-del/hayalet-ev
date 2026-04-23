import { escapeHtml } from "../models/lab-types.js";
import type { LabBookmark } from "../models/lab-types.js";

export function renderWorkspaceTimeline(deps: {
  durationMs: number;
  startMs: number | null;
  endMs: number | null;
  bookmarks: LabBookmark[];
}) {
  const durationMs = Math.max(1, deps.durationMs);
  const startMs = deps.startMs ?? 0;
  const endMs = deps.endMs ?? durationMs;
  const startPct =
    deps.startMs !== null ? Math.max(0, Math.min(100, (deps.startMs / durationMs) * 100)) : 0;
  const endPct =
    deps.endMs !== null ? Math.max(0, Math.min(100, (deps.endMs / durationMs) * 100)) : 100;
  const hasSelection = deps.startMs !== null && deps.endMs !== null;
  const selectionDurationMs = hasSelection ? Math.max(0, endMs - startMs) : 0;

  function formatTimePrecise(ms: number) {
    const totalMs = Math.round(ms);
    const minutes = Math.floor(totalMs / 60000);
    const seconds = Math.floor((totalMs % 60000) / 1000);
    const millis = totalMs % 1000;
    return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}.${String(millis).padStart(3, "0")}`;
  }

  function formatTimeShort(ms: number) {
    const totalSeconds = Math.round(ms / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
  }

  function formatDuration(ms: number) {
    if (ms < 1000) return `${ms}ms`;
    const totalSeconds = ms / 1000;
    if (totalSeconds < 60) return `${totalSeconds.toFixed(1)}s`;
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = (totalSeconds % 60).toFixed(1);
    return `${minutes}m ${seconds}s`;
  }

  const bookmarkPins = deps.bookmarks
    .map(function (bookmark) {
      const pct = Math.max(0, Math.min(100, (bookmark.timeMs / durationMs) * 100));
      return `
      <div
        class="labx-timeline__pin"
        style="left: ${String(pct)}%"
        title="${escapeHtml(bookmark.note || formatTimePrecise(bookmark.timeMs))}"
        data-lab-action="timeline-seek"
        data-lab-value="${String(bookmark.timeMs)}"
      ></div>
    `;
    })
    .join("");

  function renderFineTuneButtons(prefix: string, msValue: number) {
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

  return `
    <div class="labx-timeline" id="lab-timeline" data-duration="${String(durationMs)}">
      <div class="labx-timeline__track">
        <div class="labx-timeline__rail" data-lab-action="timeline-interact"></div>
        ${
          hasSelection
            ? `
          <div
            class="labx-timeline__selection"
            style="left: ${String(startPct)}%; width: ${String(endPct - startPct)}%"
          >
            <div class="labx-timeline__handle labx-timeline__handle--start" data-lab-action="timeline-drag-start"></div>
            <div class="labx-timeline__handle labx-timeline__handle--end" data-lab-action="timeline-drag-end"></div>
            <div class="labx-timeline__selection-body" data-lab-action="timeline-drag-body"></div>
            <div class="labx-timeline__selection-duration">${formatDuration(selectionDurationMs)}</div>
          </div>
        `
            : `
          <div class="labx-timeline__hint">Click and drag on the timeline to select a time range</div>
        `
        }
        ${bookmarkPins}
      </div>
      <div class="labx-timeline__controls">
        <div class="labx-timeline__range-info">
          <span class="labx-timeline__duration">${formatTimeShort(durationMs)}</span>
          ${
            hasSelection
              ? `
            <span class="labx-timeline__range-label">
              ${formatTimePrecise(startMs)} — ${formatTimePrecise(endMs)}
            </span>
            <span class="labx-timeline__range-duration">(${formatDuration(selectionDurationMs)})</span>
          `
              : ""
          }
        </div>
        <div class="labx-timeline__actions">
          ${
            hasSelection
              ? `<button class="labx-timeline__clear-btn" type="button" data-lab-action="timeline-clear">Clear</button>
                 <button class="labx-timeline__export-btn" type="button" data-lab-action="timeline-export-clip" title="Export selected range as video clip">Export Clip</button>`
              : ""
          }
          <button class="labx-timeline__export-btn" type="button" data-lab-action="timeline-grab-frame" title="Capture current frame as image">Grab Frame</button>
          <button class="labx-timeline__export-btn" type="button" data-lab-action="timeline-extract-audio" title="Extract source audio">Extract Audio</button>
        </div>
      </div>
      ${
        hasSelection
          ? `
        <div class="labx-timeline__finetune-row">
          <label class="labx-timeline__finetune-label">Start</label>
          ${renderFineTuneButtons("start", startMs)}
        </div>
        <div class="labx-timeline__finetune-row">
          <label class="labx-timeline__finetune-label">End</label>
          ${renderFineTuneButtons("end", endMs)}
        </div>
      `
          : ""
      }
      <div class="labx-timeline__numeric">
        <label class="labx-field labx-field--compact">
          <span>Start (ms)</span>
          <input class="labx-input labx-input--compact" type="number" min="0" max="${String(durationMs)}" data-lab-field="workspace.timelineStartMs" value="${deps.startMs !== null ? String(deps.startMs) : ""}" placeholder="ms" />
        </label>
        <label class="labx-field labx-field--compact">
          <span>End (ms)</span>
          <input class="labx-input labx-input--compact" type="number" min="0" max="${String(durationMs)}" data-lab-field="workspace.timelineEndMs" value="${deps.endMs !== null ? String(deps.endMs) : ""}" placeholder="ms" />
        </label>
      </div>
    </div>
  `;
}
