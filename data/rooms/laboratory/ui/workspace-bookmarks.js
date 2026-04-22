import { escapeHtml } from "../models/lab-types.js";
function formatTime(ms) {
  const totalSeconds = Math.round(ms / 1e3);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}
export function renderWorkspaceBookmarks(bookmarks) {
  return `
    <div class="labx-bookmarks" id="lab-bookmarks">
      <div class="labx-bookmarks__header">
        <span class="labx-bookmarks__label">Bookmarks</span>
        <button class="labx-inline-action labx-inline-action--small" type="button" data-lab-action="workspace-add-bookmark">
          + Mark Current
        </button>
      </div>
      ${bookmarks.length > 0 ? `
        <div class="labx-bookmarks__list">
          ${bookmarks.map(function(bookmark) {
    return `
              <div class="labx-bookmark-item">
                <span class="labx-bookmark-item__time">${escapeHtml(formatTime(bookmark.timeMs))}</span>
                <span class="labx-bookmark-item__note">${escapeHtml(bookmark.note || "—")}</span>
                <button
                  class="labx-roi-btn"
                  type="button"
                  data-lab-action="workspace-remove-bookmark"
                  data-lab-value="${escapeHtml(bookmark.id)}"
                  title="Remove"
                >✕</button>
              </div>
            `;
  }).join("")}
        </div>
      ` : `
        <p class="labx-panel-hint">No bookmarks yet. Mark interesting moments for the report.</p>
      `}
    </div>
  `;
}
