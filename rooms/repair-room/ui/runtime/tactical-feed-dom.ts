import type { RepairPanelId } from "../../shared/types/index.js";
import type { RepairUiState } from "../../shared/ui/state.js";
import { formatRepairTacticalFeedStatusLine } from "../panels/tactical-feed-panel.js";
import { setClassNameIfChanged, setDatasetIfChanged, setTextIfChanged } from "./dom-utils.js";

type TextFn = (
  path: string[],
  fallback: string,
  params?: Record<string, string | number>
) => string;

export function createRepairTacticalFeedDomRuntime(params: {
  documentRef: Document;
  state: RepairUiState;
  text: TextFn;
  updatePanelChrome: (panel: HTMLElement, panelId: RepairPanelId) => void;
}) {
  const { documentRef, state, text, updatePanelChrome } = params;

  function createTacticalFeedEntry(): HTMLElement {
    const entry = documentRef.createElement("div");
    entry.dataset["repairAction"] = "jump-to-event";

    const header = documentRef.createElement("div");
    header.className = "repair-feed-entry__header";

    const badge = documentRef.createElement("span");
    badge.className = "repair-feed-entry__badge";
    header.append(badge);

    const time = documentRef.createElement("span");
    time.className = "repair-feed-entry__time";
    header.append(time);

    const bodyText = documentRef.createElement("div");
    bodyText.className = "repair-feed-entry__body";

    entry.append(header, bodyText);
    return entry;
  }

  function syncTacticalFeedEntry(
    entry: HTMLElement,
    item: RepairUiState["tacticalFeed"][number]
  ): void {
    setClassNameIfChanged(
      entry,
      `repair-feed-entry repair-feed-entry--${item.severity}${
        state.workbench.focusedEventId === item.eventId ? " repair-feed-entry--active" : ""
      }`
    );
    setDatasetIfChanged(entry, "repairAction", "jump-to-event");
    setDatasetIfChanged(entry, "eventId", item.eventId);

    let header = entry.querySelector<HTMLElement>(".repair-feed-entry__header");
    if (header === null) {
      header = documentRef.createElement("div");
      header.className = "repair-feed-entry__header";
      entry.prepend(header);
    }

    let badge = header.querySelector<HTMLElement>(".repair-feed-entry__badge");
    if (badge === null) {
      badge = documentRef.createElement("span");
      header.prepend(badge);
    }
    setClassNameIfChanged(
      badge,
      `repair-feed-entry__badge repair-feed-entry__badge--${item.severity}`
    );
    setTextIfChanged(badge, item.badge);

    let time = header.querySelector<HTMLElement>(".repair-feed-entry__time");
    if (time === null) {
      time = documentRef.createElement("span");
      time.className = "repair-feed-entry__time";
      header.append(time);
    }
    setTextIfChanged(time, item.relativeLabel);

    let bodyText = entry.querySelector<HTMLElement>(".repair-feed-entry__body");
    if (bodyText === null) {
      bodyText = documentRef.createElement("div");
      bodyText.className = "repair-feed-entry__body";
      entry.append(bodyText);
    }
    setTextIfChanged(bodyText, item.body);
  }

  function updateTacticalFeedPanelDom(panel: HTMLElement): void {
    updatePanelChrome(panel, "tactical-feed");

    const hasRisk = state.tacticalFeed.some((item) => item.severity === "risk");
    const dot = panel.querySelector<HTMLElement>(".repair-panel__status-dot");
    if (dot !== null) {
      setClassNameIfChanged(
        dot,
        `repair-panel__status-dot repair-panel__status-dot--${hasRisk ? "risk" : "live"}`
      );
    }

    const calmLine = panel.querySelector<HTMLElement>(".repair-feed-calmline");
    if (calmLine !== null) {
      setTextIfChanged(calmLine, formatRepairTacticalFeedStatusLine(state, text));
    }

    const list = panel.querySelector<HTMLElement>(".repair-feed-list");
    if (list === null) return;

    const previousScrollTop = list.scrollTop;
    const activeEventIds = new Set(state.tacticalFeed.map((item) => item.eventId));
    for (const item of state.tacticalFeed) {
      const existing =
        Array.from(list.querySelectorAll<HTMLElement>(".repair-feed-entry")).find(
          (candidate) => candidate.dataset["eventId"] === item.eventId
        ) ?? null;
      const entry = existing ?? createTacticalFeedEntry();
      syncTacticalFeedEntry(entry, item);
      list.append(entry);
    }

    list.querySelectorAll<HTMLElement>(".repair-feed-entry").forEach((entry) => {
      const eventId = entry.dataset["eventId"];
      if (eventId === undefined || !activeEventIds.has(eventId)) {
        entry.remove();
      }
    });
    list.scrollTop = previousScrollTop;
  }

  return { updateTacticalFeedPanelDom };
}
