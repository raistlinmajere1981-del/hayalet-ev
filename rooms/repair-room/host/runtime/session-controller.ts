import { repairEventToTacticalFeedItem } from "../../shared/data/index.js";
import type { RepairEvent, RepairSession } from "../../shared/types/index.js";
import type { RepairRuntimeStore } from "../state/repair-runtime-store.js";
import type { RepairLiveController } from "./live-controller.js";
import { buildSessionList, getActiveSession, getSessionTimelineMs } from "./session-helpers.js";
import type { RepairStorageController } from "./storage-controller.js";

export interface RepairSessionController {
  appendEventToActiveSession: (event: RepairEvent) => boolean;
  appendEventsToSession: (sessionId: string, events: RepairEvent[]) => boolean;
  deleteSessionAndList: (sessionId: string) => void;
  setSessionAndList: (session: RepairSession, options?: { persist?: boolean }) => void;
}

export function createRepairSessionController(params: {
  liveController: RepairLiveController;
  storageController: RepairStorageController;
  store: RepairRuntimeStore;
}): RepairSessionController {
  const { liveController, storageController, store } = params;

  function setSessionAndList(
    session: RepairSession,
    options: { persist?: boolean } = {}
  ): void {
    const nextSessions = {
      ...store.getState().sessions,
      [session.id]: session,
    };
    store.dispatchMany([
      { type: "session/upsert", session },
      { type: "session-list/set", list: buildSessionList(nextSessions) },
    ]);
    if (options.persist !== false) {
      storageController.queuePersistSession(session);
    }
  }

  function deleteSessionAndList(sessionId: string): void {
    const { [sessionId]: _deleted, ...nextSessions } = store.getState().sessions;
    store.dispatchMany([
      { type: "session/delete", sessionId },
      { type: "session-list/set", list: buildSessionList(nextSessions) },
    ]);
  }

  function appendEventToActiveSession(event: RepairEvent): boolean {
    const state = store.getState();
    const session = getActiveSession(state);
    if (session === null) return false;

    const nextSession = {
      ...session,
      events: [...session.events, event],
      updatedAt: event.occurredAt,
    };
    const feedItem = repairEventToTacticalFeedItem(event, session.startedAt);
    const timeline = store.getState().workbench.timeline;
    store.batch(() => {
      setSessionAndList(nextSession);
      if (feedItem !== null) {
        store.dispatch({ type: "tactical-feed/append", item: feedItem });
      }
      if (timeline.autoFollowLive) {
        store.dispatch({
          type: "workbench/set-timeline",
          playheadMs: getSessionTimelineMs(nextSession),
          zoom: timeline.zoom,
          rangeStartMs: timeline.rangeStartMs,
          rangeEndMs: timeline.rangeEndMs,
          autoFollowLive: true,
          replayMode: "live",
          isPlaying: true,
          liveEdgeMs: getSessionTimelineMs(nextSession),
        });
      }
    });
    liveController.resetTimelineAnchor(nextSession);
    return true;
  }

  function appendEventsToSession(sessionId: string, events: RepairEvent[]): boolean {
    if (events.length === 0) return true;
    const state = store.getState();
    const session = state.sessions[sessionId];
    if (session === undefined) return false;

    const nextSession: RepairSession = {
      ...session,
      events: [...session.events, ...events],
      updatedAt: events.at(-1)?.occurredAt ?? session.updatedAt,
    };
    const active = state.activeSessionId === sessionId;
    const feedItems = active
      ? events.flatMap((event) => {
          const item = repairEventToTacticalFeedItem(event, session.startedAt);
          return item === null ? [] : [item];
        })
      : [];
    const timeline = state.workbench.timeline;

    store.batch(() => {
      setSessionAndList(nextSession);
      feedItems.forEach((item) => {
        store.dispatch({ type: "tactical-feed/append", item });
      });
      if (active && timeline.autoFollowLive) {
        const liveEdgeMs = getSessionTimelineMs(nextSession);
        store.dispatch({
          type: "workbench/set-timeline",
          playheadMs: liveEdgeMs,
          zoom: timeline.zoom,
          rangeStartMs: timeline.rangeStartMs,
          rangeEndMs: timeline.rangeEndMs,
          autoFollowLive: true,
          replayMode: "live",
          isPlaying: true,
          liveEdgeMs,
        });
      }
    });
    if (active) {
      liveController.resetTimelineAnchor(nextSession);
    }
    return true;
  }

  return {
    appendEventToActiveSession,
    appendEventsToSession,
    deleteSessionAndList,
    setSessionAndList,
  };
}
