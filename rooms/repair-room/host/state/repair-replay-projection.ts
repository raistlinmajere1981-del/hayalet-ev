import { repairEventToTacticalFeedItem } from "../../shared/data/index.js";
import type {
  RepairAiMarkEvent,
  RepairAiMarkLifecycleState,
  RepairEvent,
  RepairImageRect,
  RepairInvestigationRegion,
  RepairInvestigationRegionCreatedEvent,
  RepairInvestigationRegionLinkage,
  RepairInvestigationRegionUpdatedEvent,
  RepairKnowledgeSpatialRef,
  RepairMeasurementEvidenceState,
  RepairMeasurementEvent,
  RepairMeasurementGroup,
  RepairMeasurementState,
  RepairMultimeterReading,
  RepairOperationalMode,
  RepairOverlayEntityRef,
  RepairSession,
} from "../../shared/types/index.js";
import type {
  RepairKnowledgeRegionProjection,
  RepairMeasurementRelationship,
  RepairReplayProjection,
  RepairSpatialFocusState,
  RepairTacticalFeedItem,
  RepairTemporarySpatialRegion,
  RepairTimelineDensityBucket,
} from "../../shared/ui/state.js";
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

function eventEntityRef(eventId: string): RepairOverlayEntityRef {
  return { kind: "event", id: eventId };
}

function regionEntityRef(regionId: string): RepairOverlayEntityRef {
  return { kind: "investigation-region", id: regionId };
}

function getPointRegion(
  point: { xPx: number; yPx: number },
  widthPx = 48,
  heightPx = widthPx
): RepairImageRect {
  return {
    xPx: Math.max(0, point.xPx - widthPx / 2),
    yPx: Math.max(0, point.yPx - heightPx / 2),
    widthPx,
    heightPx,
  };
}

function getSpatialRefRegion(spatialRef: RepairKnowledgeSpatialRef): RepairImageRect | null {
  if (spatialRef.region !== null && spatialRef.region !== undefined) return spatialRef.region;
  if (spatialRef.point !== null && spatialRef.point !== undefined) {
    return getPointRegion(spatialRef.point);
  }
  return null;
}

function getEventSpatialRect(event: RepairEvent): RepairImageRect | null {
  if ((event.kind === "ai-mark" || event.kind === "risk-flag") && event.region !== null) {
    return event.region;
  }
  if (event.kind === "annotation") {
    if (event.region !== null) return event.region;
    if (event.point !== null) return getPointRegion(event.point, 42);
  }
  if (event.kind === "measurement" && event.pinAt !== null) return getPointRegion(event.pinAt, 36);
  if (
    event.kind === "investigation-region-created" ||
    event.kind === "investigation-region-updated"
  ) {
    return event.region ?? null;
  }
  return null;
}

function getRectCenter(rect: RepairImageRect): { xPx: number; yPx: number } {
  return {
    xPx: rect.xPx + rect.widthPx / 2,
    yPx: rect.yPx + rect.heightPx / 2,
  };
}

function getPointBounds(
  points: Array<{ xPx: number; yPx: number }>,
  paddingPx: number
): RepairImageRect {
  const left = Math.min(...points.map((point) => point.xPx));
  const top = Math.min(...points.map((point) => point.yPx));
  const right = Math.max(...points.map((point) => point.xPx));
  const bottom = Math.max(...points.map((point) => point.yPx));
  return {
    xPx: Math.max(0, left - paddingPx),
    yPx: Math.max(0, top - paddingPx),
    widthPx: Math.max(1, right - left + paddingPx * 2),
    heightPx: Math.max(1, bottom - top + paddingPx * 2),
  };
}

function rectsIntersect(left: RepairImageRect, right: RepairImageRect): boolean {
  return (
    right.xPx <= left.xPx + left.widthPx &&
    right.xPx + right.widthPx >= left.xPx &&
    right.yPx <= left.yPx + left.heightPx &&
    right.yPx + right.heightPx >= left.yPx
  );
}

function rectContainsPoint(rect: RepairImageRect, point: { xPx: number; yPx: number }): boolean {
  return (
    point.xPx >= rect.xPx &&
    point.xPx <= rect.xPx + rect.widthPx &&
    point.yPx >= rect.yPx &&
    point.yPx <= rect.yPx + rect.heightPx
  );
}

function inflateRect(rect: RepairImageRect, paddingPx: number): RepairImageRect {
  return {
    xPx: Math.max(0, rect.xPx - paddingPx),
    yPx: Math.max(0, rect.yPx - paddingPx),
    widthPx: rect.widthPx + paddingPx * 2,
    heightPx: rect.heightPx + paddingPx * 2,
  };
}

function uniqueStrings(values: string[]): string[] {
  return Array.from(new Set(values));
}

function getKnowledgeRegionRelatedEvents(
  region: RepairImageRect,
  spatialRef: RepairKnowledgeSpatialRef,
  events: RepairEvent[]
): {
  linkedEventIds: string[];
  relatedMeasurementIds: string[];
  relatedAiMarkIds: string[];
} {
  const paddedRegion = inflateRect(region, 36);
  const linkedEventIds =
    spatialRef.linkedSnapshotId === undefined || spatialRef.linkedSnapshotId === null
      ? []
      : [spatialRef.linkedSnapshotId];
  const relatedMeasurementIds: string[] = [];
  const relatedAiMarkIds: string[] = [];

  events.forEach((event) => {
    if (event.kind === "measurement") {
      const railMatches =
        spatialRef.rail !== null && spatialRef.rail !== undefined
          ? event.group?.rail === spatialRef.rail
          : false;
      const componentMatches =
        spatialRef.componentId !== null &&
        spatialRef.componentId !== undefined &&
        (event.group?.component === spatialRef.componentId ||
          event.reference?.includes(spatialRef.componentId) === true);
      const pointMatches = event.pinAt !== null && rectContainsPoint(paddedRegion, event.pinAt);
      if (railMatches || componentMatches || pointMatches) {
        relatedMeasurementIds.push(event.id);
      }
    }
    if (event.kind === "ai-mark" || event.kind === "risk-flag") {
      const eventRegion = getEventSpatialRect(event);
      const regionMatches = eventRegion !== null && rectsIntersect(paddedRegion, eventRegion);
      const linkMatches =
        event.linkedEventIds.includes(spatialRef.linkedSnapshotId ?? "") ||
        (event.kind === "ai-mark" &&
          event.linkedReplayEventIds?.includes(spatialRef.linkedSnapshotId ?? "") === true);
      if (regionMatches || linkMatches) {
        relatedAiMarkIds.push(event.id);
      }
    }
  });

  return {
    linkedEventIds: uniqueStrings([
      ...linkedEventIds,
      ...relatedMeasurementIds,
      ...relatedAiMarkIds,
    ]),
    relatedMeasurementIds: uniqueStrings(relatedMeasurementIds),
    relatedAiMarkIds: uniqueStrings(relatedAiMarkIds),
  };
}

function buildKnowledgeRegions(
  session: RepairSession | null,
  events: RepairEvent[]
): RepairReplayProjection["knowledgeRegions"] {
  const pack = session?.knowledgePack ?? null;
  if (pack === null) return [];
  const regions: RepairKnowledgeRegionProjection[] = [];

  pack.commonFailures.forEach((failure) => {
    const spatialRef = failure.spatialRef ?? null;
    const region = spatialRef === null ? null : getSpatialRefRegion(spatialRef);
    if (region !== null && spatialRef !== null) {
      const related = getKnowledgeRegionRelatedEvents(region, spatialRef, events);
      regions.push({
        id: failure.id,
        label: failure.label,
        region,
        source: "common-failure",
        ...related,
      });
    }
  });

  pack.testPoints.forEach((point) => {
    const spatialRef = point.spatialRef ?? null;
    const region =
      spatialRef === null
        ? point.pinAt === null
          ? null
          : getPointRegion(point.pinAt)
        : getSpatialRefRegion(spatialRef);
    if (region === null) return;
    const related =
      spatialRef === null
        ? {
            linkedEventIds: [],
            relatedMeasurementIds: [],
            relatedAiMarkIds: [],
          }
        : getKnowledgeRegionRelatedEvents(region, spatialRef, events);
    regions.push({
      id: point.id,
      label: point.label,
      region,
      source: "test-point",
      ...related,
    });
  });

  pack.resources.forEach((resource) => {
    resource.spatialRefs?.forEach((spatialRef, index) => {
      const region = getSpatialRefRegion(spatialRef);
      if (region === null) return;
      const related = getKnowledgeRegionRelatedEvents(region, spatialRef, events);
      regions.push({
        id: `${resource.id}:spatial-${index}`,
        label: spatialRef.label,
        region,
        source: "resource",
        ...related,
      });
    });
  });

  return regions;
}

function emptyRegionLinkage(): RepairInvestigationRegionLinkage {
  return {
    eventIds: [],
    measurementEventIds: [],
    annotationEventIds: [],
    aiMarkEventIds: [],
  };
}

function normalizeRegionLinkage(
  event: RepairInvestigationRegionCreatedEvent | RepairInvestigationRegionUpdatedEvent,
  previous: RepairInvestigationRegionLinkage | null
): RepairInvestigationRegionLinkage {
  return {
    eventIds: uniqueStrings([...(previous?.eventIds ?? []), ...event.linkedEventIds]),
    measurementEventIds:
      event.measurementEventIds === undefined
        ? (previous?.measurementEventIds ?? [])
        : uniqueStrings(event.measurementEventIds),
    annotationEventIds:
      event.annotationEventIds === undefined
        ? (previous?.annotationEventIds ?? [])
        : uniqueStrings(event.annotationEventIds),
    aiMarkEventIds:
      event.aiMarkEventIds === undefined
        ? (previous?.aiMarkEventIds ?? [])
        : uniqueStrings(event.aiMarkEventIds),
  };
}

function buildInvestigationRegions(events: RepairEvent[]): RepairInvestigationRegion[] {
  const regions = new Map<string, RepairInvestigationRegion>();

  events.forEach((event) => {
    if (event.kind === "investigation-region-created") {
      regions.set(event.regionId, {
        regionId: event.regionId,
        label: event.label,
        region: event.region,
        status: event.status,
        color: event.color,
        createdAt: event.occurredAt,
        updatedAt: event.occurredAt,
        createdEventId: event.id,
        updatedEventId: null,
        source: event.source,
        sourceRef: event.sourceRef,
        knowledgeSpatialRefId: event.knowledgeSpatialRefId ?? null,
        promotedFromTemporaryRegionId: event.promotedFromTemporaryRegionId ?? null,
        linkage: normalizeRegionLinkage(event, emptyRegionLinkage()),
      });
      return;
    }

    if (event.kind !== "investigation-region-updated") return;
    const previous = regions.get(event.regionId);
    if (previous === undefined) return;
    regions.set(event.regionId, {
      ...previous,
      label: event.label ?? previous.label,
      region: event.region ?? previous.region,
      status: event.status ?? previous.status,
      color: event.color ?? previous.color,
      updatedAt: event.occurredAt,
      updatedEventId: event.id,
      sourceRef: "sourceRef" in event ? (event.sourceRef ?? null) : previous.sourceRef,
      knowledgeSpatialRefId:
        "knowledgeSpatialRefId" in event
          ? (event.knowledgeSpatialRefId ?? null)
          : previous.knowledgeSpatialRefId,
      promotedFromTemporaryRegionId:
        "promotedFromTemporaryRegionId" in event
          ? (event.promotedFromTemporaryRegionId ?? null)
          : previous.promotedFromTemporaryRegionId,
      linkage: normalizeRegionLinkage(event, previous.linkage),
    });
  });

  return [...regions.values()].filter((region) => region.status !== "dismissed");
}

function buildTemporarySpatialRegions(
  state: RepairRuntimeState,
  knowledgeRegions: RepairKnowledgeRegionProjection[]
): RepairTemporarySpatialRegion[] {
  const spatialRefId = state.knowledgePack.focusedSpatialRefId;
  if (spatialRefId === null) return [];
  const knowledge = knowledgeRegions.find((entry) => entry.id === spatialRefId);
  if (knowledge === undefined) return [];
  return [
    {
      id: `tmp-knowledge-${knowledge.id}`,
      label: knowledge.label,
      region: knowledge.region,
      source: "knowledge-spatial-ref",
      sourceRef: { kind: "knowledge-region", id: knowledge.id },
      knowledgeSpatialRefId: knowledge.id,
      linkedEventIds: knowledge.linkedEventIds,
      relatedMeasurementIds: knowledge.relatedMeasurementIds,
      relatedAiMarkIds: knowledge.relatedAiMarkIds,
    },
  ];
}

function getRelationshipKey(kind: string, fromId: string, toId: string): string {
  return `${kind}:${fromId}->${toId}`;
}

function addRelationship(
  relationships: Map<string, RepairMeasurementRelationship>,
  relationship: RepairMeasurementRelationship
): void {
  if (
    relationship.from.kind === relationship.to.kind &&
    relationship.from.id === relationship.to.id
  ) {
    return;
  }
  relationships.set(relationship.id, relationship);
}

function buildMeasurementRelationships(
  events: RepairEvent[],
  investigationRegions: RepairInvestigationRegion[]
): RepairMeasurementRelationship[] {
  const relationships = new Map<string, RepairMeasurementRelationship>();
  const measurements = events.filter(
    (event): event is RepairMeasurementEvent => event.kind === "measurement"
  );
  const eventIds = new Set(events.map((event) => event.id));
  const measurementsById = new Map(measurements.map((event) => [event.id, event]));
  const previousByRail = new Map<string, RepairMeasurementEvent>();
  const previousByGroup = new Map<string, RepairMeasurementEvent>();

  measurements.forEach((measurement) => {
    if (measurement.previousEventId !== null && measurement.previousEventId !== undefined) {
      const previous = measurementsById.get(measurement.previousEventId);
      if (previous !== undefined) {
        addRelationship(relationships, {
          id: getRelationshipKey("previous-event", previous.id, measurement.id),
          kind: "previous-event",
          from: eventEntityRef(previous.id),
          to: eventEntityRef(measurement.id),
          label: "previous reading",
          strength: 0.92,
          eventIds: [previous.id, measurement.id],
        });
      }
    }

    const rail = measurement.group?.rail ?? null;
    if (rail !== null) {
      const previous = previousByRail.get(rail);
      if (previous !== undefined) {
        addRelationship(relationships, {
          id: getRelationshipKey("rail", previous.id, measurement.id),
          kind: "rail",
          from: eventEntityRef(previous.id),
          to: eventEntityRef(measurement.id),
          label: rail,
          strength: 0.68,
          eventIds: [previous.id, measurement.id],
        });
      }
      previousByRail.set(rail, measurement);
    }

    const investigationGroup = measurement.group?.investigationGroup ?? null;
    if (investigationGroup !== null) {
      const previous = previousByGroup.get(investigationGroup);
      if (previous !== undefined) {
        addRelationship(relationships, {
          id: getRelationshipKey("investigation-group", previous.id, measurement.id),
          kind: "investigation-group",
          from: eventEntityRef(previous.id),
          to: eventEntityRef(measurement.id),
          label: investigationGroup,
          strength: 0.78,
          eventIds: [previous.id, measurement.id],
        });
      }
      previousByGroup.set(investigationGroup, measurement);
    }

    (measurement.linkedAnnotationIds ?? []).forEach((annotationId) => {
      if (!eventIds.has(annotationId)) return;
      addRelationship(relationships, {
        id: getRelationshipKey("linked-annotation", measurement.id, annotationId),
        kind: "linked-annotation",
        from: eventEntityRef(measurement.id),
        to: eventEntityRef(annotationId),
        label: "annotation",
        strength: 0.72,
        eventIds: [measurement.id, annotationId],
      });
    });

    (measurement.linkedAiMarkIds ?? []).forEach((aiMarkId) => {
      if (!eventIds.has(aiMarkId)) return;
      addRelationship(relationships, {
        id: getRelationshipKey("linked-ai-mark", measurement.id, aiMarkId),
        kind: "linked-ai-mark",
        from: eventEntityRef(measurement.id),
        to: eventEntityRef(aiMarkId),
        label: "AI mark",
        strength: 0.82,
        eventIds: [measurement.id, aiMarkId],
      });
    });
  });

  investigationRegions.forEach((region) => {
    region.linkage.measurementEventIds.forEach((measurementId) => {
      if (!eventIds.has(measurementId)) return;
      addRelationship(relationships, {
        id: getRelationshipKey("investigation-group", measurementId, region.regionId),
        kind: "investigation-group",
        from: eventEntityRef(measurementId),
        to: regionEntityRef(region.regionId),
        label: region.label,
        strength: 0.88,
        eventIds: [measurementId, ...region.linkage.eventIds],
      });
    });
  });

  return [...relationships.values()];
}

function buildTimelineDensity(
  session: RepairSession,
  events: RepairEvent[],
  investigationRegions: RepairInvestigationRegion[]
): RepairTimelineDensityBucket[] {
  const liveEdgeMs = getLiveEdgeMs(session);
  const bucketSizeMs = 30000;
  const bucketCount = Math.max(1, Math.ceil(Math.max(bucketSizeMs, liveEdgeMs + 1) / bucketSizeMs));
  const buckets: RepairTimelineDensityBucket[] = Array.from({ length: bucketCount }, (_, index) => {
    const bucketStartMs = index * bucketSizeMs;
    return {
      bucketStartMs,
      bucketEndMs: bucketStartMs + bucketSizeMs,
      eventCount: 0,
      spatialEventCount: 0,
      measurementCount: 0,
      aiMarkCount: 0,
      regionCount: 0,
      density: 0,
    };
  });

  events.forEach((event) => {
    const offsetMs = getEventOffsetMs(session, event);
    const index = Math.min(buckets.length - 1, Math.floor(offsetMs / bucketSizeMs));
    const bucket = buckets[index];
    if (bucket === undefined) return;
    bucket.eventCount += 1;
    if (getEventSpatialRect(event) !== null) bucket.spatialEventCount += 1;
    if (event.kind === "measurement") bucket.measurementCount += 1;
    if (event.kind === "ai-mark" || event.kind === "risk-flag") bucket.aiMarkCount += 1;
  });

  investigationRegions.forEach((region) => {
    const offsetMs = Math.max(0, Date.parse(region.updatedAt) - Date.parse(session.startedAt));
    const index = Math.min(buckets.length - 1, Math.floor(offsetMs / bucketSizeMs));
    const bucket = buckets[index];
    if (bucket !== undefined) bucket.regionCount += 1;
  });

  const maxSignal = Math.max(
    1,
    ...buckets.map(
      (bucket) =>
        bucket.eventCount +
        bucket.spatialEventCount +
        bucket.measurementCount +
        bucket.aiMarkCount +
        bucket.regionCount
    )
  );

  return buckets.map((bucket) => ({
    ...bucket,
    density:
      (bucket.eventCount +
        bucket.spatialEventCount +
        bucket.measurementCount +
        bucket.aiMarkCount +
        bucket.regionCount) /
      maxSignal,
  }));
}

function getEventFocusLabel(event: RepairEvent): string {
  if (event.kind === "measurement") return event.reference ?? event.channel;
  if (event.kind === "annotation") return event.label;
  if (event.kind === "ai-mark") return event.rationale;
  if (event.kind === "risk-flag") return event.message;
  if (event.kind === "snapshot") return event.caption;
  if (event.kind === "freeze-frame") return event.reason;
  if (event.kind === "note") return event.text;
  if (event.kind === "ai-mark-lifecycle") return event.reason;
  if (event.kind === "investigation-region-created") return event.label;
  if (event.kind === "investigation-region-updated") return event.label ?? event.regionId;
  return event.title;
}

function getSpatialFocusPoint(params: {
  ref: RepairOverlayEntityRef;
  events: RepairEvent[];
  knowledgeRegions: RepairKnowledgeRegionProjection[];
  investigationRegions: RepairInvestigationRegion[];
  temporarySpatialRegions: RepairTemporarySpatialRegion[];
}): { xPx: number; yPx: number } | null {
  const { ref, events, knowledgeRegions, investigationRegions, temporarySpatialRegions } = params;
  if (ref.kind === "event") {
    const event = events.find((candidate) => candidate.id === ref.id);
    const rect = event === undefined ? null : getEventSpatialRect(event);
    return rect === null ? null : getRectCenter(rect);
  }
  if (ref.kind === "investigation-region") {
    const region = investigationRegions.find((candidate) => candidate.regionId === ref.id);
    return region === undefined ? null : getRectCenter(region.region);
  }
  if (ref.kind === "knowledge-region") {
    const region = knowledgeRegions.find((candidate) => candidate.id === ref.id);
    return region === undefined ? null : getRectCenter(region.region);
  }
  if (ref.kind === "temporary-spatial-region") {
    const region = temporarySpatialRegions.find((candidate) => candidate.id === ref.id);
    return region === undefined ? null : getRectCenter(region.region);
  }
  return null;
}

function buildActiveSpatialFocus(params: {
  state: RepairRuntimeState;
  events: RepairEvent[];
  knowledgeRegions: RepairKnowledgeRegionProjection[];
  investigationRegions: RepairInvestigationRegion[];
  temporarySpatialRegions: RepairTemporarySpatialRegion[];
  measurementRelationships: RepairMeasurementRelationship[];
}): RepairSpatialFocusState | null {
  const {
    state,
    events,
    knowledgeRegions,
    investigationRegions,
    temporarySpatialRegions,
    measurementRelationships,
  } = params;
  const ref =
    state.workbench.selection.inspectorEntityRef ??
    (state.workbench.focusedEventId === null
      ? null
      : eventEntityRef(state.workbench.focusedEventId)) ??
    (state.knowledgePack.focusedSpatialRefId === null
      ? null
      : { kind: "knowledge-region" as const, id: state.knowledgePack.focusedSpatialRefId });
  if (ref === null) return null;

  if (ref.kind === "event") {
    const event = events.find((candidate) => candidate.id === ref.id);
    if (event === undefined) return null;
    const eventRegion = getEventSpatialRect(event);
    const measurementIds =
      event.kind === "measurement"
        ? [event.id]
        : event.kind === "ai-mark" || event.kind === "risk-flag"
          ? (event.linkedMeasurementIds ?? [])
          : event.kind === "annotation"
            ? (event.meta?.linkedMeasurementIds ?? [])
            : [];
    const aiMarkIds =
      event.kind === "ai-mark" || event.kind === "risk-flag"
        ? [event.id]
        : event.kind === "measurement"
          ? (event.linkedAiMarkIds ?? [])
          : event.linkedEventIds.filter((eventId) => {
              const linked = events.find((candidate) => candidate.id === eventId);
              return linked?.kind === "ai-mark" || linked?.kind === "risk-flag";
            });
    return {
      ref,
      label: getEventFocusLabel(event),
      region: eventRegion,
      linkedEventIds: uniqueStrings([event.id, ...event.linkedEventIds]),
      relatedMeasurementIds: uniqueStrings(measurementIds),
      relatedAiMarkIds: uniqueStrings(aiMarkIds),
    };
  }

  if (ref.kind === "investigation-region") {
    const region = investigationRegions.find((candidate) => candidate.regionId === ref.id);
    if (region === undefined) return null;
    return {
      ref,
      label: region.label,
      region: region.region,
      linkedEventIds: region.linkage.eventIds,
      relatedMeasurementIds: region.linkage.measurementEventIds,
      relatedAiMarkIds: region.linkage.aiMarkEventIds,
    };
  }

  if (ref.kind === "knowledge-region") {
    const region = knowledgeRegions.find((candidate) => candidate.id === ref.id);
    if (region === undefined) return null;
    return {
      ref,
      label: region.label,
      region: region.region,
      linkedEventIds: region.linkedEventIds,
      relatedMeasurementIds: region.relatedMeasurementIds,
      relatedAiMarkIds: region.relatedAiMarkIds,
    };
  }

  if (ref.kind === "temporary-spatial-region") {
    const region = temporarySpatialRegions.find((candidate) => candidate.id === ref.id);
    if (region === undefined) return null;
    return {
      ref,
      label: region.label,
      region: region.region,
      linkedEventIds: region.linkedEventIds,
      relatedMeasurementIds: region.relatedMeasurementIds,
      relatedAiMarkIds: region.relatedAiMarkIds,
    };
  }

  if (ref.kind === "measurement-relationship") {
    const relationship = measurementRelationships.find((candidate) => candidate.id === ref.id);
    if (relationship === undefined) return null;
    const points = [relationship.from, relationship.to]
      .map((candidate) =>
        getSpatialFocusPoint({
          ref: candidate,
          events,
          knowledgeRegions,
          investigationRegions,
          temporarySpatialRegions,
        })
      )
      .filter((point): point is { xPx: number; yPx: number } => point !== null);
    const relationshipEvents = relationship.eventIds
      .map((eventId) => events.find((event) => event.id === eventId))
      .filter((event): event is RepairEvent => event !== undefined);
    return {
      ref,
      label: relationship.label,
      region: points.length === 0 ? null : getPointBounds(points, 32),
      linkedEventIds: uniqueStrings(relationship.eventIds),
      relatedMeasurementIds: uniqueStrings(
        relationshipEvents
          .filter((event): event is RepairMeasurementEvent => event.kind === "measurement")
          .map((event) => event.id)
      ),
      relatedAiMarkIds: uniqueStrings(
        relationshipEvents
          .filter((event) => event.kind === "ai-mark" || event.kind === "risk-flag")
          .map((event) => event.id)
      ),
    };
  }

  return {
    ref,
    label: "Live edge",
    region: null,
    linkedEventIds: [],
    relatedMeasurementIds: [],
    relatedAiMarkIds: [],
  };
}

function getOperationalMode(
  state: RepairRuntimeState,
  activeFreezeFrameEventId: string | null
): RepairOperationalMode {
  if (activeFreezeFrameEventId !== null || state.workbench.isFrozen) return "freeze";
  if (
    state.workbench.investigationModeEnabled ||
    state.layout.focusMode ||
    state.workbench.selection.selectedEntityRefs.length > 0 ||
    state.workbench.selection.selectedEventIds.length > 0
  ) {
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
    investigationRegions: [],
    temporarySpatialRegions: [],
    measurementRelationships: [],
    timelineDensity: [],
    activeSpatialFocus: null,
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
  const investigationRegions = buildInvestigationRegions(forensicEvents);
  const knowledgeRegions = buildKnowledgeRegions(session, forensicEvents);
  const temporarySpatialRegions = buildTemporarySpatialRegions(state, knowledgeRegions);
  const measurementRelationships = buildMeasurementRelationships(
    forensicEvents,
    investigationRegions
  );
  const activeSpatialFocus = buildActiveSpatialFocus({
    state,
    events: forensicEvents,
    knowledgeRegions,
    investigationRegions,
    temporarySpatialRegions,
    measurementRelationships,
  });

  return {
    playheadMs,
    replayMode: state.workbench.timeline.replayMode,
    visibleEvents,
    overlayEvents: forensicEvents.filter((event) => {
      if (event.kind === "ai-mark") return visibleAiMarkIds.has(event.id);
      return (
        event.kind === "risk-flag" || event.kind === "annotation" || event.kind === "measurement"
      );
    }),
    tacticalFeed: buildTacticalFeed(session, visibleEvents),
    measurementEvidence,
    aiMarkEventIds: visibleAiMarks.map((event) => event.id),
    activeSnapshotEventId: activeSnapshot?.id ?? null,
    activeFreezeFrameEventId: activeFreeze?.id ?? null,
    focusSuggestionEventId: focusSuggestion?.id ?? null,
    knowledgeRegions,
    investigationRegions,
    temporarySpatialRegions,
    measurementRelationships,
    timelineDensity: buildTimelineDensity(session, forensicEvents, investigationRegions),
    activeSpatialFocus,
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
