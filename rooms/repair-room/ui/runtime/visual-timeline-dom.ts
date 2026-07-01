import type { RepairEvent, RepairPanelId } from "../../shared/types/index.js";
import type { RepairUiSnapshotMeta, RepairUiState } from "../../shared/ui/state.js";
import { resolveRepairAssetUrl } from "../repair-asset-url.js";
import {
  setClassNameIfChanged,
  setDatasetIfChanged,
  setStyleIfChanged,
  setTextIfChanged,
} from "./dom-utils.js";
import {
  formatOffset,
  getEventKindLabel,
  getEventLabel,
  type RepairTimelineTextFn,
} from "./timeline-helpers.js";

export function createRepairVisualTimelineDomRuntime(params: {
  applyLiveSnapshotUpdates: () => void;
  documentRef: Document;
  meta: RepairUiSnapshotMeta;
  state: RepairUiState;
  text: RepairTimelineTextFn;
  updatePanelChrome: (panel: HTMLElement, panelId: RepairPanelId) => void;
}) {
  const { applyLiveSnapshotUpdates, documentRef, meta, state, text, updatePanelChrome } = params;

  function getTimelineModel(): {
    contentWidthPx: number;
    eventDeltas: number[];
    latestEventMs: number;
    totalMs: number;
    zoom: number;
  } {
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
    return {
      contentWidthPx: Math.max(860, Math.round((totalMs / 1000) * 12 * zoom)),
      eventDeltas,
      latestEventMs,
      totalMs,
      zoom,
    };
  }

  function getEventThumbnailSrc(event: RepairEvent): string | null {
    if (event.kind === "snapshot" && event.thumbnailSrc !== null) {
      return event.thumbnailSrc;
    }
    return state.sessions.detail?.pcbImage?.src ?? null;
  }

  function updateTimelineLiveDom(): void {
    const timeline = documentRef.querySelector<HTMLElement>(".repair-timeline");
    if (timeline === null) return;
    const totalMs = Math.max(1000, Number(timeline.dataset["totalMs"] ?? "60000") || 60000);
    const playheadMs = Math.max(0, state.workbench.timeline.playheadMs);
    const clampedPlayheadMs = Math.min(totalMs, playheadMs);
    const readout = timeline.querySelector<HTMLElement>(".repair-timeline__readout");
    if (readout !== null) {
      setTextIfChanged(readout, `${formatOffset(playheadMs)} / ${formatOffset(totalMs)}`);
    }
    const scrub = timeline.querySelector<HTMLInputElement>(".repair-timeline__scrub");
    if (scrub !== null && documentRef.activeElement !== scrub) {
      const nextValue = String(clampedPlayheadMs);
      if (scrub.value !== nextValue) scrub.value = nextValue;
    }
    const playhead = timeline.querySelector<HTMLElement>(".repair-timeline__playhead");
    if (playhead !== null) {
      setStyleIfChanged(playhead, "left", `${(clampedPlayheadMs / totalMs) * 100}%`);
    }
  }

  function syncTimelineTicks(track: HTMLElement, totalMs: number): void {
    const tickCount = Math.max(6, Math.ceil(totalMs / 10000));
    const activeTickKeys = new Set<string>();
    for (let i = 0; i <= tickCount; i += 1) {
      const tickMs = Math.min(totalMs, i * 10000);
      const key = String(tickMs);
      activeTickKeys.add(key);
      let tick = track.querySelector<HTMLElement>(`.repair-timeline__tick[data-tick-ms="${key}"]`);
      if (tick === null) {
        tick = documentRef.createElement("div");
        tick.className = "repair-timeline__tick";
        tick.dataset["tickMs"] = key;
        const label = documentRef.createElement("span");
        tick.append(label);
      }
      tick.style.left = `${(tickMs / totalMs) * 100}%`;
      const label = tick.querySelector<HTMLElement>("span");
      if (label !== null) {
        label.textContent = formatOffset(tickMs);
      }
      track.append(tick);
    }

    track.querySelectorAll<HTMLElement>(".repair-timeline__tick").forEach((tick) => {
      const key = tick.dataset["tickMs"];
      if (key === undefined || !activeTickKeys.has(key)) {
        tick.remove();
      }
    });
  }

  function syncTimelineRange(track: HTMLElement, totalMs: number): void {
    const rangeStart = state.workbench.timeline.rangeStartMs;
    const rangeEnd = state.workbench.timeline.rangeEndMs;
    let range = track.querySelector<HTMLElement>(".repair-timeline__range");
    if (rangeStart === null || rangeEnd === null) {
      range?.remove();
      return;
    }
    if (range === null) {
      range = documentRef.createElement("div");
      range.className = "repair-timeline__range";
    }
    range.style.left = `${(Math.min(rangeStart, rangeEnd) / totalMs) * 100}%`;
    range.style.width = `${(Math.abs(rangeEnd - rangeStart) / totalMs) * 100}%`;
    track.append(range);
  }

  function syncTimelineChip(
    track: HTMLElement,
    event: RepairEvent,
    deltaMs: number,
    totalMs: number,
    zoom: number
  ): HTMLElement {
    let chip =
      Array.from(track.querySelectorAll<HTMLElement>(".repair-timeline__chip")).find(
        (candidate) => candidate.dataset["eventId"] === event.id
      ) ?? null;
    if (chip === null) {
      chip = documentRef.createElement("button");
      chip.dataset["repairAction"] = "jump-to-event";
      chip.dataset["eventId"] = event.id;
    }
    chip.className = `repair-timeline__chip repair-timeline__chip--${event.kind}${
      state.workbench.focusedEventId === event.id ? " repair-timeline__chip--active" : ""
    }`;
    chip.setAttribute("type", "button");
    chip.title = `${getEventKindLabel(event, text)} — ${event.occurredAt}`;
    chip.style.left = `${(deltaMs / totalMs) * 100}%`;
    const density =
      meta.replay.timelineDensity.find(
        (bucket) => deltaMs >= bucket.bucketStartMs && deltaMs < bucket.bucketEndMs
      )?.density ?? 0;
    chip.style.setProperty("--repair-chip-density", density.toFixed(2));
    chip.dataset["spatialDensity"] = density.toFixed(2);

    if (zoom < 0.6) {
      chip.replaceChildren();
      return chip;
    }

    let thumb = chip.querySelector<HTMLElement>(".repair-timeline__thumb");
    if (thumb === null) {
      thumb = documentRef.createElement("span");
      thumb.className = "repair-timeline__thumb";
      chip.replaceChildren(thumb);
    }

    const thumbnailSrc = getEventThumbnailSrc(event);
    if (thumbnailSrc !== null) {
      const resolvedSrc = resolveRepairAssetUrl(thumbnailSrc) ?? thumbnailSrc;
      thumb.style.backgroundImage = `linear-gradient(180deg, rgba(5, 8, 12, 0.06), rgba(5, 8, 12, 0.72)), url("${resolvedSrc.replace(/"/g, '\\"')}")`;
    } else {
      thumb.style.removeProperty("background-image");
    }

    let thumbLabel = thumb.querySelector<HTMLElement>(".repair-timeline__thumb-label");
    if (thumbLabel === null) {
      thumbLabel = documentRef.createElement("span");
      thumbLabel.className = "repair-timeline__thumb-label";
      thumb.append(thumbLabel);
    }
    thumbLabel.textContent = getEventLabel(event, text);
    return chip;
  }

  function syncTimelineChips(
    track: HTMLElement,
    eventDeltas: number[],
    totalMs: number,
    zoom: number
  ): void {
    const activeEventIds = new Set(meta.events.map((event) => event.id));
    meta.events.forEach((event, index) => {
      track.append(syncTimelineChip(track, event, eventDeltas[index] ?? 0, totalMs, zoom));
    });

    track.querySelectorAll<HTMLElement>(".repair-timeline__chip").forEach((chip) => {
      const eventId = chip.dataset["eventId"];
      if (eventId === undefined || !activeEventIds.has(eventId)) {
        chip.remove();
      }
    });
  }

  function syncTimelinePlayhead(track: HTMLElement, totalMs: number): void {
    let playhead = track.querySelector<HTMLElement>(".repair-timeline__playhead");
    if (playhead === null) {
      playhead = documentRef.createElement("div");
      playhead.className = "repair-timeline__playhead";
    }
    playhead.style.left = `${
      (Math.min(totalMs, state.workbench.timeline.playheadMs) / totalMs) * 100
    }%`;
    track.append(playhead);
  }

  function syncTimelineLiveEdge(track: HTMLElement, totalMs: number, latestEventMs: number): void {
    let liveEdge = track.querySelector<HTMLElement>(".repair-timeline__live-edge");
    if (state.phase !== "session-active") {
      liveEdge?.remove();
      return;
    }
    if (liveEdge === null) {
      liveEdge = documentRef.createElement("div");
      liveEdge.className = "repair-timeline__live-edge";
    }
    liveEdge.style.left = `${(latestEventMs / totalMs) * 100}%`;
    track.append(liveEdge);
  }

  function updateVisualTimelinePanelDom(panel: HTMLElement): void {
    updatePanelChrome(panel, "visual-timeline");
    const dot = panel.querySelector<HTMLElement>(".repair-panel__status-dot");
    if (dot !== null) {
      setClassNameIfChanged(
        dot,
        `repair-panel__status-dot repair-panel__status-dot--${
          state.phase === "session-active" ? "live" : "idle"
        }`
      );
    }

    const timeline = panel.querySelector<HTMLElement>(".repair-timeline");
    const track = panel.querySelector<HTMLElement>(".repair-timeline__track");
    const scrub = panel.querySelector<HTMLInputElement>(".repair-timeline__scrub");
    if (timeline === null || track === null || scrub === null) return;
    const previousScrollLeft =
      panel.querySelector<HTMLElement>(".repair-timeline__scroller")?.scrollLeft ?? 0;
    const model = getTimelineModel();
    setDatasetIfChanged(timeline, "totalMs", String(model.totalMs));
    setStyleIfChanged(track, "width", `${model.contentWidthPx}px`);
    const scrubMax = String(model.totalMs);
    if (scrub.max !== scrubMax) scrub.max = scrubMax;
    const scrubValue = String(
      Math.min(model.totalMs, Math.max(0, state.workbench.timeline.playheadMs))
    );
    if (scrub.value !== scrubValue) scrub.value = scrubValue;

    syncTimelineTicks(track, model.totalMs);
    syncTimelineRange(track, model.totalMs);
    syncTimelineChips(track, model.eventDeltas, model.totalMs, model.zoom);
    syncTimelinePlayhead(track, model.totalMs);
    syncTimelineLiveEdge(track, model.totalMs, model.latestEventMs);
    applyLiveSnapshotUpdates();

    const playButton = panel.querySelector<HTMLElement>(
      "[data-repair-action='timeline-play'], [data-repair-action='timeline-pause']"
    );
    if (playButton !== null) {
      const nextAction = state.workbench.timeline.isPlaying ? "timeline-pause" : "timeline-play";
      setDatasetIfChanged(playButton, "repairAction", nextAction);
      setTextIfChanged(
        playButton,
        state.workbench.timeline.isPlaying
          ? text(["timeline", "pause"], "Duraklat")
          : text(["timeline", "play"], "Oynat")
      );
    }
    const liveButton = panel.querySelector<HTMLElement>("[data-repair-action='timeline-live']");
    liveButton?.classList.toggle(
      "repair-timeline__control-btn--active",
      state.workbench.timeline.autoFollowLive
    );
    const speedButton = panel.querySelector<HTMLElement>("[data-repair-action='timeline-speed']");
    if (speedButton !== null) {
      setTextIfChanged(speedButton, `${state.workbench.timeline.replaySpeed.toFixed(1)}x`);
    }

    const scroller = panel.querySelector<HTMLElement>(".repair-timeline__scroller");
    if (scroller !== null) {
      scroller.scrollLeft = previousScrollLeft;
    }
  }

  return {
    updateTimelineLiveDom,
    updateVisualTimelinePanelDom,
  };
}
