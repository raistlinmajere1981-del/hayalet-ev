import { formatLabYoutubeRangeClock } from "../../shared/youtube-download-range.js";

type YoutubeRangeMediaTarget = EventTarget & {
  currentTime?: number;
  duration?: number;
  getAttribute?: (name: string) => string | null;
};

function isYoutubeRangePlayer(target: EventTarget | null): target is YoutubeRangeMediaTarget {
  const candidate = target as YoutubeRangeMediaTarget | null;
  return (
    candidate !== null &&
    typeof candidate.getAttribute === "function" &&
    candidate.getAttribute("data-lab-youtube-range-player") === "true"
  );
}

function setText(documentRef: Document, selector: string, value: string) {
  const element = documentRef.querySelector(selector);
  if (element !== null && element.textContent !== value) {
    element.textContent = value;
  }
}

export function syncLabYoutubeRangePlayerUi(event: Event, documentRef: Document) {
  if (isYoutubeRangePlayer(event.target) !== true) {
    return;
  }
  const player = event.target;
  if (event.type === "error") {
    const error = documentRef.querySelector<HTMLElement>(
      "[data-lab-youtube-range-playback-error='true']"
    );
    if (error !== null) {
      error.hidden = false;
    }
    return;
  }
  const currentTime =
    typeof player.currentTime === "number" && Number.isFinite(player.currentTime)
      ? Math.max(0, player.currentTime)
      : 0;
  const duration =
    typeof player.duration === "number" && Number.isFinite(player.duration) && player.duration > 0
      ? player.duration
      : null;
  setText(
    documentRef,
    "[data-lab-youtube-range-current='true']",
    formatLabYoutubeRangeClock(currentTime)
  );
  if (duration !== null) {
    setText(
      documentRef,
      "[data-lab-youtube-range-duration='true']",
      formatLabYoutubeRangeClock(duration)
    );
  }
  const playhead = documentRef.querySelector<HTMLElement>(
    "[data-lab-youtube-range-playhead='true']"
  );
  if (playhead !== null && duration !== null) {
    const percent = Math.max(0, Math.min(100, (currentTime / duration) * 100));
    playhead.style.left = `${String(percent)}%`;
  }
}
