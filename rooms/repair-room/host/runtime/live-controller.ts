import {
  REPAIR_AMBIENT_CLOCK_INTERVAL_MS,
  REPAIR_FEED_EVENT_MAX_DELAY_MS,
  REPAIR_FEED_EVENT_MIN_DELAY_MS,
} from "../../shared/repair-constants.js";
import { buildTacticalFeedItems } from "../../shared/data/index.js";
import type { RepairSession } from "../../shared/types/index.js";
import type { RepairRuntimeStore } from "../state/repair-runtime-store.js";
import { getActiveSession, getSessionTimelineMs } from "./session-helpers.js";

function unrefTimer(timer: ReturnType<typeof setInterval> | ReturnType<typeof setTimeout>): void {
  if (typeof timer === "object" && typeof timer.unref === "function") {
    timer.unref();
  }
}

export interface RepairLiveController {
  clearFeedStream: () => void;
  createLiveSessionIso: (session: RepairSession) => string;
  dispose: () => void;
  getLiveTimelinePlayheadMs: (session: RepairSession, nowMs?: number) => number;
  resetTimelineAnchor: (session: RepairSession | null) => void;
  scheduleFeedStream: () => void;
  startLiveLoops: () => void;
}

export function createRepairLiveController(params: {
  store: RepairRuntimeStore;
}): RepairLiveController {
  const { store } = params;
  const feedTimeouts = new Set<ReturnType<typeof setTimeout>>();
  let clockInterval: ReturnType<typeof setInterval> | null = null;
  let liveTimelineSessionId = store.getState().activeSessionId;
  let liveTimelineAnchorAtMs = Date.now();
  let liveTimelineBaseMs = getSessionTimelineMs(getActiveSession(store.getState()));

  function resetTimelineAnchor(session: RepairSession | null): void {
    liveTimelineSessionId = session?.id ?? null;
    liveTimelineAnchorAtMs = Date.now();
    liveTimelineBaseMs = getSessionTimelineMs(session);
  }

  function getLiveTimelinePlayheadMs(session: RepairSession, nowMs = Date.now()): number {
    if (liveTimelineSessionId !== session.id) {
      resetTimelineAnchor(session);
    }
    return Math.max(
      getSessionTimelineMs(session),
      liveTimelineBaseMs + Math.max(0, nowMs - liveTimelineAnchorAtMs)
    );
  }

  function createLiveSessionIso(session: RepairSession): string {
    const playheadMs = Math.max(
      getSessionTimelineMs(session) + 1000,
      getLiveTimelinePlayheadMs(session)
    );
    return new Date(Date.parse(session.startedAt) + playheadMs).toISOString();
  }

  function clearFeedStream(): void {
    feedTimeouts.forEach((timeoutId) => {
      clearTimeout(timeoutId);
    });
    feedTimeouts.clear();
  }

  function scheduleFeedStream(): void {
    clearFeedStream();
    const state = store.getState();
    const session = getActiveSession(state);
    if (session === null || session.status !== "in-progress") return;

    const visibleIds = new Set(state.tacticalFeed.map((item) => item.eventId));
    const pending = buildTacticalFeedItems(session.events, session.startedAt).filter(
      (item) => !visibleIds.has(item.eventId)
    );

    let elapsedMs = 0;
    pending.forEach((item, index) => {
      const delay =
        index % 2 === 0 ? REPAIR_FEED_EVENT_MIN_DELAY_MS : REPAIR_FEED_EVENT_MAX_DELAY_MS;
      elapsedMs += delay;
      const timeoutId = setTimeout(() => {
        const current = store.getState();
        const currentSession = getActiveSession(current);
        const alreadyVisible = current.tacticalFeed.some(
          (feedItem) => feedItem.eventId === item.eventId
        );
        if (currentSession?.id === session.id && alreadyVisible === false) {
          store.dispatch({ type: "tactical-feed/append", item });
        }
        feedTimeouts.delete(timeoutId);
      }, elapsedMs);
      unrefTimer(timeoutId);
      feedTimeouts.add(timeoutId);
    });
  }

  function startLiveLoops(): void {
    if (clockInterval === null) {
      clockInterval = setInterval(() => {
        const nowMs = Date.now();
        const iso = new Date(nowMs).toISOString();
        store.batch(() => {
          store.dispatch({ type: "ambient/tick", nowIso: iso });
          const state = store.getState();
          const session = getActiveSession(state);
          const timeline = state.workbench.timeline;
          if (session?.status === "in-progress" && timeline.autoFollowLive) {
            store.dispatch({
              type: "workbench/set-timeline",
              playheadMs: getLiveTimelinePlayheadMs(session, nowMs),
              zoom: timeline.zoom,
              rangeStartMs: timeline.rangeStartMs,
              rangeEndMs: timeline.rangeEndMs,
              autoFollowLive: true,
              replayMode: "live",
              isPlaying: true,
              liveEdgeMs: getSessionTimelineMs(session),
            });
          }
        });
      }, REPAIR_AMBIENT_CLOCK_INTERVAL_MS);
      unrefTimer(clockInterval);
    }

    scheduleFeedStream();
  }

  function dispose(): void {
    clearFeedStream();
    if (clockInterval !== null) {
      clearInterval(clockInterval);
      clockInterval = null;
    }
  }

  return {
    clearFeedStream,
    createLiveSessionIso,
    dispose,
    getLiveTimelinePlayheadMs,
    resetTimelineAnchor,
    scheduleFeedStream,
    startLiveLoops,
  };
}
