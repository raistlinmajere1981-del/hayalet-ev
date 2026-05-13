import { repairEventToTacticalFeedItem } from "../../shared/data/index.js";
import type {
  RepairAiMarkEvent,
  RepairAiMarkLifecycleState,
  RepairEvent,
  RepairImageRect,
  RepairMeasurementEvidenceState,
  RepairMeasurementEvent,
  RepairMeasurementGroup,
  RepairMeasurementState,
  RepairMultimeterReading,
  RepairOperationalMode,
  RepairSession,
} from "../../shared/types/index.js";
import type { RepairReplayProjection, RepairTacticalFeedItem } from "../../shared/ui/state.js";
import type { RepairRuntimeState } from "./repair-runtime-state.js";

function getEventOffsetMs(session: RepairSession, event: RepairEvent): number {
  return Math.max(0, Date.parse(event.occurredAt) - Date.parse(session.startedAt));
}

function getEventOrder(events: RepairEvent[], eventId: string): number {
  const index = events.findIndex((event) => event.id === eventId);
  return index < 0 ? Number.MAX_SAFE_INTEGER : index;
}

export function sortRepairEventsForReplay(events: RepairEvent[]): RepairEvent[] {
  return events
    .map((event, index) => ({ event, index }))
    .sort((left, right) => {
      const timeDelta = Date.parse(left.event.occurredAt) - Date.parse(right.event.occurredAt);
      return timeDelta === 0 ? left.index - right.index : timeDelta;
    })
    .map((entry) => entry.event);
}

function getLiveEdgeMs(session: RepairSession | null): number {
  if (session === null || session.events.length === 0) return 0;
  return Math.max(...session.events.map((event) => getEventOffsetMs(session, event)));
}

function getProjectionPlayheadMs(state: RepairRuntimeState, session: RepairSession | null): number {
  if (session === null) return 0;
  if (state.workbench.timeline.autoFollowLive) {
    return Math.max(state.workbench.timeline.playheadMs, getLiveEdgeMs(session));
  }
  return Math.max(0, state.workbench.timeline.playheadMs);
}

function isVisibleAtPlayhead(
  session: RepairSession,
  playheadMs: number,
  event: RepairEvent
): boolean {
  return getEventOffsetMs(session, event) <= playheadMs;
}

function buildTacticalFeed(
  session: RepairSession,
  visibleEvents: RepairEvent[]
): RepairTacticalFeedItem[] {
  return visibleEvents
    .map((event) => repairEventToTacticalFeedItem(event, session.startedAt))
    .filter((item): item is RepairTacticalFeedItem => item !== null);
}

function measurementEventToReading(event: RepairMeasurementEvent): RepairMultimeterReading {
  return {
    id: event.id,
    occurredAt: event.occurredAt,
    mode: event.mode.toLowerCase().includes("ohm") ? "resistance" : "dc-voltage",
    range: event.range,
    channel: event.channel,
    rawDisplay: event.rawDisplay,
    value: event.value,
    unit: event.unit,
    reference: event.reference,
  };
}

function normalizeMeasurementGroup(event: RepairMeasurementEvent): RepairMeasurementGroup {
  return {
    rail: event.group?.rail ?? null,
    component: event.group?.component ?? event.reference ?? null,
    powerDomain: event.group?.powerDomain ?? null,
    investigationGroup: event.group?.investigationGroup ?? null,
  };
}

function measurementGroupLabel(
  group: RepairMeasurementGroup,
  event: RepairMeasurementEvent
): string {
  return (
    group.investigationGroup ??
    group.powerDomain ??
    group.rail ??
    group.component ??
    event.reference ??
    event.channel
  );
}

function buildMeasurementEvidence(events: RepairEvent[]): {
  evidence: RepairMeasurementEvidenceState[];
  measurementStateEvidence: RepairMeasurementState["evidence"];
  recent: RepairMultimeterReading[];
} {
  const measurements = events.filter(
    (event): event is RepairMeasurementEvent => event.kind === "measurement"
  );
  const grouped = new Map<string, RepairMeasurementEvent[]>();

  measurements.forEach((event) => {
    const group = normalizeMeasurementGroup(event);
    const key = measurementGroupLabel(group, event);
    grouped.set(key, [...(grouped.get(key) ?? []), event]);
  });

  const evidence: RepairMeasurementEvidenceState[] = [];
  const measurementStateEvidence: RepairMeasurementState["evidence"] = [];
  const recent = measurements.map(measurementEventToReading).reverse();

  grouped.forEach((groupEvents) => {
    const ordered = sortRepairEventsForReplay(groupEvents) as RepairMeasurementEvent[];
    const current = ordered.at(-1);
    if (current === undefined) return;
    const previous = ordered.at(-2) ?? null;
    const group = normalizeMeasurementGroup(current);
    const reference = current.reference ?? current.channel;
    const history = ordered.map((event) => `${event.rawDisplay}${event.unit}`);
    evidence.push({
      eventId: current.id,
      reference,
      groupLabel: measurementGroupLabel(group, current),
      history,
      previousDisplay: previous === null ? null : `${previous.rawDisplay}${previous.unit}`,
      currentDisplay: `${current.rawDisplay}${current.unit}`,
      pinAt: current.pinAt,
    });
    measurementStateEvidence.push({
      eventId: current.id,
      reference,
      pinAt: current.pinAt,
      group,
      history: ordered.map(measurementEventToReading),
      previousReadingId: previous?.id ?? null,
      linkedAnnotationIds: current.linkedAnnotationIds ?? [],
      linkedAiMarkIds: current.linkedAiMarkIds ?? [],
    });
  });

  return { evidence, measurementStateEvidence, recent };
}

function buildAiLifecycleMap(events: RepairEvent[]): Map<string, RepairAiMarkLifecycleState> {
  const states = new Map<string, RepairAiMarkLifecycleState>();
  events.forEach((event) => {
    if (event.kind === "ai-mark") {
      states.set(event.id, event.lifecycleState ?? (event.dismissed ? "dismissed" : "detected"));
    }
    if (event.kind === "ai-mark-lifecycle") {
      states.set(event.targetEventId, event.state);
    }
  });
  return states;
}

function isAiMarkVisible(
  session: RepairSession,
  playheadMs: number,
  event: RepairAiMarkEvent,
  lifecycle: RepairAiMarkLifecycleState
): boolean {
  if (event.dismissed || lifecycle === "dismissed" || lifecycle === "expired") return false;
  if (event.expiresAt !== null && event.expiresAt !== undefined) {
    return Date.parse(event.expiresAt) >= Date.parse(session.startedAt) + playheadMs;
  }
  return true;
}

function getAiPriority(event: RepairAiMarkEvent, events: RepairEvent[]): number {
  const severityWeight =
    event.severity === "risk"
      ? 4
      : event.severity === "action"
        ? 3
        : event.severity === "suggestion"
          ? 2
          : 1;
  return severityWeight * 1000 - getEventOrder(events, event.id);
}

function buildKnowledgeRegions(
  session: RepairSession | null
): RepairReplayProjection["knowledgeRegions"] {
  const pack = session?.knowledgePack ?? null;
  if (pack === null) return [];
  const regions: Array<{ id: string; label: string; region: RepairImageRect }> = [];

  pack.commonFailures.forEach((failure) => {
    const region = failure.spatialRef?.region ?? null;
    if (region !== null) {
      regions.push({ id: failure.id, label: failure.label, region });
    }
  });

  pack.testPoints.forEach((point) => {
    if (point.pinAt === null) return;
    regions.push({
      id: point.id,
      label: point.label,
      region: {
        xPx: Math.max(0, point.pinAt.xPx - 24),
        yPx: Math.max(0, point.pinAt.yPx - 24),
        widthPx: 48,
        heightPx: 48,
      },
    });
  });

  return regions;
}

function getOperationalMode(
  state: RepairRuntimeState,
  activeFreezeFrameEventId: string | null
): RepairOperationalMode {
  if (activeFreezeFrameEventId !== null || state.workbench.isFrozen) return "freeze";
  if (state.layout.focusMode || state.workbench.selection.selectedEventIds.length > 0) {
    return "investigation";
  }
  return state.workbench.timeline.autoFollowLive ? "live" : "replay";
}

export function createEmptyRepairReplayProjection(): RepairReplayProjection {
  return {
    playheadMs: 0,
    replayMode: "live",
    visibleEvents: [],
    overlayEvents: [],
    tacticalFeed: [],
    measurementEvidence: [],
    aiMarkEventIds: [],
    activeSnapshotEventId: null,
    activeFreezeFrameEventId: null,
    focusSuggestionEventId: null,
    knowledgeRegions: [],
    operationalMode: "live",
  };
}

export function createRepairReplayProjection(
  state: RepairRuntimeState,
  session: RepairSession | null
): RepairReplayProjection {
  if (session === null) return createEmptyRepairReplayProjection();

  const orderedEvents = sortRepairEventsForReplay(session.events);
  const playheadMs = getProjectionPlayheadMs(state, session);
  const visibleEvents = orderedEvents.filter((event) =>
    isVisibleAtPlayhead(session, playheadMs, event)
  );
  const activeFreeze = visibleEvents.find((event) => {
    if (event.kind !== "freeze-frame") return false;
    const startMs = getEventOffsetMs(session, event);
    return playheadMs >= startMs && playheadMs <= startMs + event.durationMs;
  });
  const forensicPlayheadMs =
    activeFreeze === undefined ? playheadMs : getEventOffsetMs(session, activeFreeze);
  const forensicEvents = orderedEvents.filter((event) =>
    isVisibleAtPlayhead(session, forensicPlayheadMs, event)
  );
  const lifecycleMap = buildAiLifecycleMap(forensicEvents);
  const measurementEvidence = buildMeasurementEvidence(forensicEvents).evidence;
  const activeSnapshot = forensicEvents.filter((event) => event.kind === "snapshot").at(-1);
  const visibleAiMarks = forensicEvents.filter((event): event is RepairAiMarkEvent => {
    if (event.kind !== "ai-mark") return false;
    return isAiMarkVisible(
      session,
      forensicPlayheadMs,
      event,
      lifecycleMap.get(event.id) ?? "detected"
    );
  });
  const focusSuggestion = [...visibleAiMarks].sort(
    (left, right) => getAiPriority(right, orderedEvents) - getAiPriority(left, orderedEvents)
  )[0];
  const visibleAiMarkIds = new Set(visibleAiMarks.map((event) => event.id));

  return {
    playheadMs,
    replayMode: state.workbench.timeline.replayMode,
    visibleEvents,
    overlayEvents: forensicEvents.filter((event) => {
      if (event.kind === "ai-mark") return visibleAiMarkIds.has(event.id);
      return (
        event.kind === "risk-flag" ||
        event.kind === "annotation" ||
        event.kind === "measurement"
      );
    }),
    tacticalFeed: buildTacticalFeed(session, visibleEvents),
    measurementEvidence,
    aiMarkEventIds: visibleAiMarks.map((event) => event.id),
    activeSnapshotEventId: activeSnapshot?.id ?? null,
    activeFreezeFrameEventId: activeFreeze?.id ?? null,
    focusSuggestionEventId: focusSuggestion?.id ?? null,
    knowledgeRegions: buildKnowledgeRegions(session),
    operationalMode: getOperationalMode(state, activeFreeze?.id ?? null),
  };
}

export function projectRepairMeasurementState(
  measurement: RepairMeasurementState,
  visibleEvents: RepairEvent[]
): RepairMeasurementState {
  const projected = buildMeasurementEvidence(visibleEvents);
  const currentReading = projected.recent[0] ?? null;
  return {
    ...measurement,
    current:
      currentReading === null
        ? measurement.current
        : {
            ...measurement.current,
            display: currentReading.rawDisplay,
            value: currentReading.value,
            unit: currentReading.unit,
            range: currentReading.range,
            mode: currentReading.mode,
            hold: false,
          },
    recent: projected.recent.length === 0 ? measurement.recent : projected.recent,
    evidence: projected.measurementStateEvidence,
  };
}
