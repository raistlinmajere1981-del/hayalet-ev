import { escapeHtml } from "../domain/lab-types.js";
import type { LabStoreState } from "../domain/lab-types.js";
import {
  formatLabYoutubeRangeClock,
  getLabYoutubeRangeValidationCode,
  getLabYoutubeRequestedDurationSeconds,
} from "../shared/youtube-download-range.js";
import type { LabYoutubeDownloadRange } from "../shared/youtube-download-range.js";
import type { LabI18n } from "./lab-i18n.js";

function finiteSeconds(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) && value >= 0 ? value : null;
}

function getRangeValidationMessage(
  state: LabStoreState,
  copy: LabI18n
): { code: string | null; message: string | null; range: LabYoutubeDownloadRange | null } {
  const selection = state.ui.youtubeImport.rangeSelection;
  const duration = state.ui.youtubeImport.preview?.duration;
  const range = {
    startSeconds: selection.startSeconds,
    endSeconds: selection.endSeconds,
  };
  const code = getLabYoutubeRangeValidationCode(range, duration);
  if (code === null) {
    return {
      code,
      message: null,
      range: range as LabYoutubeDownloadRange,
    };
  }
  const messages = {
    "missing-boundary": copy.t(
      "mediaAnalysis.projectImport.youtubeRange.validation.missingBoundary",
      "Başlangıç ve bitiş noktalarını seçin."
    ),
    "non-finite-boundary": copy.t(
      "mediaAnalysis.projectImport.youtubeRange.validation.invalidBoundary",
      "Seçilen zaman noktaları geçerli değil."
    ),
    "negative-start": copy.t(
      "mediaAnalysis.projectImport.youtubeRange.validation.negativeStart",
      "Başlangıç zamanı sıfırdan küçük olamaz."
    ),
    "end-not-after-start": copy.t(
      "mediaAnalysis.projectImport.youtubeRange.validation.endAfterStart",
      "Bitiş zamanı başlangıçtan sonra olmalı."
    ),
    "range-too-short": copy.t(
      "mediaAnalysis.projectImport.youtubeRange.validation.tooShort",
      "En az 0.2 saniyelik bir aralık seçin."
    ),
    "end-after-duration": copy.t(
      "mediaAnalysis.projectImport.youtubeRange.validation.afterDuration",
      "Bitiş zamanı video süresini aşamaz."
    ),
  };
  return { code, message: messages[code], range: null };
}

function renderSelectedRange(
  range: LabYoutubeDownloadRange | null,
  durationSeconds: number | null
): string {
  if (range === null || durationSeconds === null || durationSeconds <= 0) {
    return "";
  }
  const left = Math.max(0, Math.min(100, (range.startSeconds / durationSeconds) * 100));
  const right = Math.max(0, Math.min(100, (range.endSeconds / durationSeconds) * 100));
  const width = Math.max(0, right - left);
  return `<span class="labx-youtube-range__selection" style="left:${String(left)}%;width:${String(width)}%"></span>`;
}

export function renderYoutubeRangeOverlay(state: LabStoreState, copy: LabI18n): string {
  const selection = state.ui.youtubeImport.rangeSelection;
  if (selection.open !== true) {
    return "";
  }
  const preview = state.ui.youtubeImport.preview;
  const streamUrl = preview?.streamUrl || null;
  const durationSeconds = finiteSeconds(preview?.duration);
  const validation = getRangeValidationMessage(state, copy);
  const requestedDuration =
    validation.range === null ? null : getLabYoutubeRequestedDurationSeconds(validation.range);
  const title =
    preview?.title ||
    copy.t("mediaAnalysis.source.youtubeImport.previewFallbackTitle", "YouTube video");
  const player =
    streamUrl === null
      ? `<div class="labx-youtube-range__preview-unavailable" role="alert">
          <strong>${escapeHtml(copy.t("mediaAnalysis.projectImport.youtubeRange.previewUnavailableTitle", "Önizleme açılamıyor"))}</strong>
          <span>${escapeHtml(copy.t("mediaAnalysis.projectImport.youtubeRange.previewUnavailableBody", "Bu video için geçici oynatılabilir stream bulunamadı."))}</span>
        </div>`
      : `<video
          class="labx-youtube-range__video"
          data-lab-preserve-media="youtube-range-preview"
          data-lab-youtube-range-player="true"
          src="${escapeHtml(streamUrl)}"
          controls
          preload="metadata"
          playsinline
        ></video>`;
  const confirmDisabled = validation.range === null || streamUrl === null;

  return `
    <div class="labx-youtube-range-overlay" id="lab-youtube-range-overlay-root" data-open="true">
      <button class="labx-youtube-range-overlay__backdrop" type="button" data-lab-action="youtube-range-cancel" aria-label="${escapeHtml(copy.t("mediaAnalysis.projectImport.youtubeRange.actions.cancel", "İptal"))}"></button>
      <section class="labx-youtube-range" role="dialog" aria-modal="true" aria-labelledby="lab-youtube-range-title">
        <header class="labx-youtube-range__header">
          <div>
            <p>${escapeHtml(copy.t("mediaAnalysis.projectImport.youtubeRange.eyebrow", "YouTube zaman aralığı"))}</p>
            <h2 id="lab-youtube-range-title">${escapeHtml(title)}</h2>
          </div>
          <button class="labx-youtube-range__close" type="button" data-lab-action="youtube-range-cancel" aria-label="${escapeHtml(copy.t("mediaAnalysis.projectImport.youtubeRange.actions.cancel", "İptal"))}">×</button>
        </header>
        <div class="labx-youtube-range__player-wrap">
          ${player}
          <p class="labx-youtube-range__playback-error" data-lab-youtube-range-playback-error="true" role="alert" hidden>${escapeHtml(copy.t("mediaAnalysis.projectImport.youtubeRange.playbackError", "Geçici YouTube önizlemesi oynatılamadı. URL'yi yeniden kontrol edin."))}</p>
        </div>
        <div class="labx-youtube-range__transport-readout" aria-live="off">
          <span data-lab-youtube-range-current="true">${formatLabYoutubeRangeClock(0)}</span>
          <span>/</span>
          <span data-lab-youtube-range-duration="true">${formatLabYoutubeRangeClock(durationSeconds)}</span>
        </div>
        <div class="labx-youtube-range__timeline" aria-hidden="true">
          <div class="labx-youtube-range__timeline-labels">
            <span>${formatLabYoutubeRangeClock(0)}</span>
            <span>${formatLabYoutubeRangeClock(durationSeconds)}</span>
          </div>
          <div class="labx-youtube-range__track">
            ${renderSelectedRange(validation.range, durationSeconds)}
            <span class="labx-youtube-range__playhead" data-lab-youtube-range-playhead="true"></span>
          </div>
        </div>
        <dl class="labx-youtube-range__values">
          <div><dt>${escapeHtml(copy.t("mediaAnalysis.projectImport.youtubeRange.start", "Başlangıç"))}</dt><dd>${formatLabYoutubeRangeClock(selection.startSeconds)}</dd></div>
          <div><dt>${escapeHtml(copy.t("mediaAnalysis.projectImport.youtubeRange.end", "Bitiş"))}</dt><dd>${formatLabYoutubeRangeClock(selection.endSeconds)}</dd></div>
          <div><dt>${escapeHtml(copy.t("mediaAnalysis.projectImport.youtubeRange.duration", "Süre"))}</dt><dd>${requestedDuration === null ? "—" : `${requestedDuration.toFixed(3)} s`}</dd></div>
        </dl>
        <div class="labx-youtube-range__setters">
          <button type="button" data-lab-action="youtube-range-set-start"${streamUrl === null ? " disabled" : ""}>${escapeHtml(copy.t("mediaAnalysis.projectImport.youtubeRange.actions.setStart", "Başlangıcı Buraya Koy"))}</button>
          <button type="button" data-lab-action="youtube-range-set-end"${streamUrl === null ? " disabled" : ""}>${escapeHtml(copy.t("mediaAnalysis.projectImport.youtubeRange.actions.setEnd", "Bitişi Buraya Koy"))}</button>
        </div>
        <p class="labx-youtube-range__validation" data-code="${escapeHtml(validation.code || "ready")}" role="status">${escapeHtml(validation.message || copy.t("mediaAnalysis.projectImport.youtubeRange.validation.ready", "Bu aralık kullanılabilir."))}</p>
        <footer class="labx-youtube-range__actions">
          <button type="button" data-lab-action="youtube-range-cancel">${escapeHtml(copy.t("mediaAnalysis.projectImport.youtubeRange.actions.cancel", "İptal"))}</button>
          <button class="labx-youtube-range__confirm" type="button" data-lab-action="youtube-range-confirm"${confirmDisabled ? " disabled" : ""}>${escapeHtml(copy.t("mediaAnalysis.projectImport.youtubeRange.actions.confirm", "Bu Aralığı Kullan"))}</button>
        </footer>
      </section>
    </div>
  `;
}
