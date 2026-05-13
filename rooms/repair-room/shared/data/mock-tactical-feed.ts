import type {
  RepairAiMarkLifecycleEvent,
  RepairAiMarkEvent,
  RepairEvent,
  RepairNoteEvent,
  RepairRiskFlagEvent,
  RepairSnapshotEvent,
} from "../types/index.js";
import type { RepairTacticalFeedItem } from "../ui/state.js";

function formatRelative(originIso: string, occurredIso: string): string {
  const origin = Date.parse(originIso);
  const occurred = Date.parse(occurredIso);
  if (Number.isNaN(origin) || Number.isNaN(occurred)) {
    return "+00:00";
  }
  const deltaSeconds = Math.max(0, Math.floor((occurred - origin) / 1000));
  const minutes = Math.floor(deltaSeconds / 60)
    .toString()
    .padStart(2, "0");
  const seconds = (deltaSeconds % 60).toString().padStart(2, "0");
  return `+${minutes}:${seconds}`;
}

export function repairEventToTacticalFeedItem(
  event: RepairEvent,
  sessionStartIso: string
): RepairTacticalFeedItem | null {
  const relative = formatRelative(sessionStartIso, event.occurredAt);
  switch (event.kind) {
    case "ai-mark": {
      const mark = event as RepairAiMarkEvent;
      const severity = mark.severity;
      const badge =
        severity === "risk"
          ? "RISK"
          : severity === "action"
            ? "ACTION"
            : severity === "suggestion"
              ? "SUGGESTION"
              : "INFO";
      return {
        eventId: mark.id,
        occurredAt: mark.occurredAt,
        relativeLabel: relative,
        severity,
        badge,
        body: mark.rationale,
      };
    }
    case "risk-flag": {
      const risk = event as RepairRiskFlagEvent;
      return {
        eventId: risk.id,
        occurredAt: risk.occurredAt,
        relativeLabel: relative,
        severity: "risk",
        badge: "RISK",
        body: risk.message,
      };
    }
    case "snapshot": {
      const snap = event as RepairSnapshotEvent;
      return {
        eventId: snap.id,
        occurredAt: snap.occurredAt,
        relativeLabel: relative,
        severity: "info",
        badge: "INFO",
        body: snap.caption,
      };
    }
    case "note": {
      const note = event as RepairNoteEvent;
      return {
        eventId: note.id,
        occurredAt: note.occurredAt,
        relativeLabel: relative,
        severity: "info",
        badge: "INFO",
        body: note.text,
      };
    }
    case "ai-mark-lifecycle": {
      const lifecycle = event as RepairAiMarkLifecycleEvent;
      return {
        eventId: lifecycle.id,
        occurredAt: lifecycle.occurredAt,
        relativeLabel: relative,
        severity: "info",
        badge: "AI STATE",
        body: lifecycle.reason,
      };
    }
    default:
      return null;
  }
}

export function buildMockTacticalFeed(
  events: RepairEvent[],
  sessionStartIso: string
): RepairTacticalFeedItem[] {
  return events
    .map((event) => repairEventToTacticalFeedItem(event, sessionStartIso))
    .filter((item): item is RepairTacticalFeedItem => item !== null);
}
