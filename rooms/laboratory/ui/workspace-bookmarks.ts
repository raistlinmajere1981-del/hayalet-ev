import { escapeHtml } from "../models/lab-types.js";
import type { LabBookmark } from "../models/lab-types.js";
import { LAB_FALLBACK_I18N } from "./lab-i18n.js";
import type { LabI18n } from "./lab-i18n.js";

function formatTime(ms: number) {
  const totalSeconds = Math.round(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

export function renderWorkspaceBookmarks(
  bookmarks: LabBookmark[],
  copy: LabI18n = LAB_FALLBACK_I18N
) {
  return `
    <div class="labx-bookmarks" id="lab-bookmarks">
      <div class="labx-bookmarks__header">
        <span class="labx-bookmarks__label">${escapeHtml(copy.t("mediaAnalysis.bookmarks.title", "Bookmarks"))}</span>
        <button class="labx-inline-action labx-inline-action--small" type="button" data-lab-action="workspace-add-bookmark">
          ${escapeHtml(copy.t("mediaAnalysis.bookmarks.addAction", "+ Mark Current"))}
        </button>
      </div>
      ${
        bookmarks.length > 0
          ? `
        <div class="labx-bookmarks__list">
          ${bookmarks
            .map(function (bookmark) {
              return `
              <div class="labx-bookmark-item">
                <span class="labx-bookmark-item__time">${escapeHtml(formatTime(bookmark.timeMs))}</span>
                <span class="labx-bookmark-item__note">${escapeHtml(bookmark.note || "—")}</span>
                <button
                  class="labx-roi-btn"
                  type="button"
                  data-lab-action="workspace-remove-bookmark"
                  data-lab-value="${escapeHtml(bookmark.id)}"
                  title="${escapeHtml(copy.t("mediaAnalysis.bookmarks.removeAction", "Remove"))}"
                >✕</button>
              </div>
            `;
            })
            .join("")}
        </div>
      `
          : ""
      }
    </div>
  `;
}
