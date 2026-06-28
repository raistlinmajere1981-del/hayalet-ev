import type { RepairEvent } from "../../shared/types/index.js";
import type { RepairUiSnapshotMeta, RepairUiState } from "../../shared/ui/state.js";
import { resolveRepairAssetUrl } from "../repair-asset-url.js";
import { formatOffset, getEventKindLabel, getEventLabel } from "../runtime/timeline-helpers.js";
import { createRepairPanel } from "./panel-shell.js";

type TextFn = (path: string[], fallback: string) => string;

function getEventThumbnailSrc(event: RepairEvent, state: RepairUiState): string | null {
  if (event.kind === "snapshot" && event.thumbnailSrc !== null) {
    return event.thumbnailSrc;
  }
  return state.sessions.detail?.pcbImage?.src ?? null;
}

export function renderVisualTimelinePanel(
  documentRef: Document,
  state: RepairUiState,
  meta: RepairUiSnapshotMeta,
  text: TextFn
): HTMLElement {
  const body = documentRef.createElement("div");
  body.className = "repair-panel__body";
  body.style.padding = "0";

  const session = state.sessions.detail;
  const sessionStartMs = session === null ? 0 : Date.parse(session.startedAt);
  const eventDeltas = meta.events.map((event) =>
    Math.max(0, Date.parse(event.occurredAt) - sessionStartMs)
  );
  const latestEventMs = eventDeltas.length === 0 ? 0 : Math.max(...eventDeltas);
  const totalMs = Math.max(
    60000,
    latestEventMs + 10000,
    state.workbench.timeline.playheadMs + 10000
  );
  const zoom = state.workbench.timeline.zoom;
  const contentWidthPx = Math.max(860, Math.round((totalMs / 1000) * 12 * zoom));

  const timeline = documentRef.createElement("div");
  timeline.className = "repair-timeline";
  timeline.dataset["totalMs"] = String(totalMs);

  const controls = documentRef.createElement("div");
  controls.className = "repair-timeline__controls";

  const playheadLabel = documentRef.createElement("span");
  playheadLabel.className = "repair-timeline__readout";
  playheadLabel.textContent = `${formatOffset(state.workbench.timeline.playheadMs)} / ${formatOffset(totalMs)}`;
  controls.append(playheadLabel);

  const play = documentRef.createElement("button");
  play.className = "repair-timeline__control-btn";
  play.type = "button";
  play.textContent = state.workbench.timeline.isPlaying
    ? text(["timeline", "pause"], "Duraklat")
    : text(["timeline", "play"], "Oynat");
  play.dataset["repairAction"] = state.workbench.timeline.isPlaying
    ? "timeline-pause"
    : "timeline-play";
  controls.append(play);

  const live = documentRef.createElement("button");
  live.className = `repair-timeline__control-btn${
    state.workbench.timeline.autoFollowLive ? " repair-timeline__control-btn--active" : ""
  }`;
  live.type = "button";
  live.textContent = text(["timeline", "followLive"], "Canlı takip");
  live.dataset["repairAction"] = "timeline-live";
  controls.append(live);

  const speed = documentRef.createElement("button");
  speed.className = "repair-timeline__control-btn";
  speed.type = "button";
  speed.textContent = `${state.workbench.timeline.replaySpeed.toFixed(1)}x`;
  speed.dataset["repairAction"] = "timeline-speed";
  controls.append(speed);

  const zoomOut = documentRef.createElement("button");
  zoomOut.className = "repair-timeline__control-btn";
  zoomOut.type = "button";
  zoomOut.textContent = text(["timeline", "zoomOut"], "Uzaklaş");
  zoomOut.dataset["repairAction"] = "timeline-zoom";
  zoomOut.dataset["direction"] = "out";
  controls.append(zoomOut);

  const zoomIn = documentRef.createElement("button");
  zoomIn.className = "repair-timeline__control-btn";
  zoomIn.type = "button";
  zoomIn.textContent = text(["timeline", "zoomIn"], "Yakınlaş");
  zoomIn.dataset["repairAction"] = "timeline-zoom";
  zoomIn.dataset["direction"] = "in";
  controls.append(zoomIn);

  const rangeButton = documentRef.createElement("button");
  rangeButton.className = "repair-timeline__control-btn";
  rangeButton.type = "button";
  rangeButton.textContent = text(["timeline", "markRange"], "Aralık işaretle");
  rangeButton.dataset["repairAction"] = "timeline-range";
  controls.append(rangeButton);
  timeline.append(controls);

  const scrub = documentRef.createElement("input");
  scrub.className = "repair-timeline__scrub";
  scrub.type = "range";
  scrub.min = "0";
  scrub.max = String(totalMs);
  scrub.step = "1000";
  scrub.value = String(Math.min(totalMs, Math.max(0, state.workbench.timeline.playheadMs)));
  scrub.dataset["repairAction"] = "timeline-scrub";
  timeline.append(scrub);

  const scroller = documentRef.createElement("div");
  scroller.className = "repair-timeline__scroller";

  const track = documentRef.createElement("div");
  track.className = "repair-timeline__track";
  track.style.width = `${contentWidthPx}px`;

  const tickCount = Math.max(6, Math.ceil(totalMs / 10000));
  for (let i = 0; i <= tickCount; i++) {
    const tickMs = Math.min(totalMs, i * 10000);
    const tick = documentRef.createElement("div");
    tick.className = "repair-timeline__tick";
    tick.style.left = `${(tickMs / totalMs) * 100}%`;
    const label = documentRef.createElement("span");
    label.textContent = formatOffset(tickMs);
    tick.append(label);
    track.append(tick);
  }

  const rangeStart = state.workbench.timeline.rangeStartMs;
  const rangeEnd = state.workbench.timeline.rangeEndMs;
  if (rangeStart !== null && rangeEnd !== null) {
    const range = documentRef.createElement("div");
    range.className = "repair-timeline__range";
    range.style.left = `${(Math.min(rangeStart, rangeEnd) / totalMs) * 100}%`;
    range.style.width = `${(Math.abs(rangeEnd - rangeStart) / totalMs) * 100}%`;
    track.append(range);
  }

  meta.events.forEach((event, index) => {
    const delta = eventDeltas[index] ?? 0;
    const chip = documentRef.createElement("button");
    chip.className = `repair-timeline__chip repair-timeline__chip--${event.kind}${state.workbench.focusedEventId === event.id ? " repair-timeline__chip--active" : ""}`;
    chip.type = "button";
    chip.title = `${getEventKindLabel(event, text)} — ${event.occurredAt}`;
    chip.style.left = `${(delta / totalMs) * 100}%`;
    const density =
      meta.replay.timelineDensity.find(
        (bucket) => delta >= bucket.bucketStartMs && delta < bucket.bucketEndMs
      )?.density ?? 0;
    chip.style.setProperty("--repair-chip-density", density.toFixed(2));
    chip.dataset["spatialDensity"] = density.toFixed(2);
    chip.dataset["repairAction"] = "jump-to-event";
    chip.dataset["eventId"] = event.id;

    if (zoom >= 0.6) {
      const thumb = documentRef.createElement("span");
      thumb.className = "repair-timeline__thumb";
      const thumbnailSrc = getEventThumbnailSrc(event, state);
      if (thumbnailSrc !== null) {
        const resolvedSrc = resolveRepairAssetUrl(thumbnailSrc) ?? thumbnailSrc;
        thumb.style.backgroundImage = `linear-gradient(180deg, rgba(5, 8, 12, 0.06), rgba(5, 8, 12, 0.72)), url("${resolvedSrc.replace(/"/g, '\\"')}")`;
      }
      const thumbLabel = documentRef.createElement("span");
      thumbLabel.className = "repair-timeline__thumb-label";
      thumbLabel.textContent = getEventLabel(event, text);
      thumb.append(thumbLabel);
      chip.append(thumb);
    }
    track.append(chip);
  });

  const playhead = documentRef.createElement("div");
  playhead.className = "repair-timeline__playhead";
  playhead.style.left = `${(Math.min(totalMs, state.workbench.timeline.playheadMs) / totalMs) * 100}%`;
  track.append(playhead);

  if (state.phase === "session-active") {
    const liveEdge = documentRef.createElement("div");
    liveEdge.className = "repair-timeline__live-edge";
    liveEdge.style.left = `${(latestEventMs / totalMs) * 100}%`;
    track.append(liveEdge);
  }

  scroller.append(track);
  timeline.append(scroller);
  body.append(timeline);

  return createRepairPanel(documentRef, {
    panelId: "visual-timeline",
    title: text(["timeline", "title"], "Görsel Zaman Tüneli"),
    statusDot: state.phase === "session-active" ? "live" : "idle",
    collapsed: state.layout.collapsedPanels["visual-timeline"],
    noPanelControls: true,
    body,
  });
}
