import type { PatternRoomWorkspaceModel, PatternViewId } from "../../shared/types/pattern-room.js";
import {
  createPatternWorkspaceTranslator,
  type PatternWorkspaceTranslator,
} from "../pattern-room-workspace-i18n.js";
import { createElement } from "./pattern-panel-utils.js";

type RoomObjectViewId = Exclude<PatternViewId, "overview">;

function createObjectButton(
  viewId: RoomObjectViewId,
  label: string,
  description: string,
  onOpenView: (viewId: RoomObjectViewId) => void
): HTMLButtonElement {
  const button = createElement("button", `pattern-room-case-object ${viewId}`);
  button.type = "button";
  button.dataset["patternHotspot"] = viewId;
  button.dataset["patternCaseObject"] = viewId;
  button.ariaLabel = label;
  button.title = description;
  button.addEventListener("click", () => {
    onOpenView(viewId);
  });
  return button;
}

function createCounter(label: string, value: number): HTMLElement {
  const counter = createElement("span", "pattern-room-case-counter");
  counter.append(
    createElement("small", undefined, label),
    createElement("strong", undefined, String(value))
  );
  return counter;
}

function createBoardObject(
  data: PatternRoomWorkspaceModel,
  onOpenView: (viewId: RoomObjectViewId) => void,
  text: PatternWorkspaceTranslator
): HTMLButtonElement {
  const button = createObjectButton(
    "board",
    text("nav.board.label"),
    text("nav.board.description"),
    onOpenView
  );
  const header = createElement("span", "pattern-room-case-object-header");
  header.append(
    createElement("span", "pattern-room-case-object-index", "01"),
    createElement("span", "pattern-room-object-label", text("nav.board.label"))
  );

  const cork = createElement("span", "pattern-room-case-board-surface");
  data.boardCategories.forEach((category, index) => {
    const note = createElement("span", `pattern-room-case-board-note ${category.tone}`);
    note.style.setProperty("--pattern-overview-note-index", String(index));
    note.append(
      createElement("i", "pattern-room-case-board-pin"),
      createElement("strong", undefined, category.label),
      createElement("small", undefined, `${String(category.pins.length)} iz`)
    );
    cork.append(note);
  });

  const footer = createElement("span", "pattern-room-case-object-footer");
  footer.append(
    createElement("strong", undefined, "Duvar panosu"),
    createElement("small", undefined, `${String(data.boardCategories.length)} katman`)
  );
  button.append(header, cork, footer);
  return button;
}

function createDeskObject(
  data: PatternRoomWorkspaceModel,
  onOpenView: (viewId: RoomObjectViewId) => void,
  text: PatternWorkspaceTranslator
): HTMLButtonElement {
  const button = createObjectButton(
    "desk",
    text("nav.connections.label"),
    text("nav.connections.description"),
    onOpenView
  );
  const header = createElement("span", "pattern-room-case-object-header");
  header.append(
    createElement("span", "pattern-room-case-object-index", "02"),
    createElement("span", "pattern-room-object-label", text("nav.connections.label"))
  );
  const map = createElement("span", "pattern-room-case-map-preview");
  map.append(
    createElement("i", "pattern-room-case-map-node one"),
    createElement("i", "pattern-room-case-map-node two"),
    createElement("i", "pattern-room-case-map-node three"),
    createElement("i", "pattern-room-case-map-line one"),
    createElement("i", "pattern-room-case-map-line two")
  );
  const footer = createElement("span", "pattern-room-case-object-footer");
  footer.append(
    createElement("strong", undefined, data.subject),
    createElement("small", undefined, `${String(data.connections.length)} bağlantı`)
  );
  button.append(header, map, footer);
  return button;
}

function createArchiveObject(
  data: PatternRoomWorkspaceModel,
  onOpenView: (viewId: RoomObjectViewId) => void,
  text: PatternWorkspaceTranslator
): HTMLButtonElement {
  const button = createObjectButton(
    "archive",
    text("nav.archive.label"),
    text("nav.archive.description"),
    onOpenView
  );
  const header = createElement("span", "pattern-room-case-object-header");
  header.append(
    createElement("span", "pattern-room-case-object-index", "03"),
    createElement("span", "pattern-room-object-label", text("nav.archive.label"))
  );
  const cabinet = createElement("span", "pattern-room-case-cabinet-preview");
  for (let index = 0; index < 4; index += 1) {
    const drawer = createElement("i", "pattern-room-case-cabinet-drawer");
    drawer.append(createElement("b"));
    cabinet.append(drawer);
  }
  const footer = createElement("span", "pattern-room-case-object-footer");
  footer.append(
    createElement("strong", undefined, "Kaynak dolabı"),
    createElement("small", undefined, `${String(data.sources.length)} dosya`)
  );
  button.append(header, cabinet, footer);
  return button;
}

function createReviewObject(
  data: PatternRoomWorkspaceModel,
  onOpenView: (viewId: RoomObjectViewId) => void,
  text: PatternWorkspaceTranslator
): HTMLButtonElement {
  const button = createObjectButton(
    "tenth-man",
    text("nav.review.label"),
    text("nav.review.description"),
    onOpenView
  );
  const header = createElement("span", "pattern-room-case-object-header");
  header.append(
    createElement("span", "pattern-room-case-object-index", "04"),
    createElement("span", "pattern-room-object-label", text("nav.review.label"))
  );
  const device = createElement("span", "pattern-room-case-review-device-preview");
  data.tenthManSession.roles.slice(0, 4).forEach((role) => {
    const slot = createElement(
      "i",
      role.connected === true
        ? "pattern-room-case-review-slot connected"
        : "pattern-room-case-review-slot"
    );
    slot.title = role.label;
    device.append(slot);
  });
  const footer = createElement("span", "pattern-room-case-object-footer");
  footer.append(
    createElement("strong", undefined, "İnceleme masası"),
    createElement("small", undefined, data.tenthManSession.status)
  );
  button.append(header, device, footer);
  return button;
}

function createReportObject(
  data: PatternRoomWorkspaceModel,
  onOpenView: (viewId: RoomObjectViewId) => void,
  text: PatternWorkspaceTranslator
): HTMLButtonElement {
  const button = createObjectButton(
    "report",
    text("nav.report.label"),
    text("nav.report.description"),
    onOpenView
  );
  const header = createElement("span", "pattern-room-case-object-header");
  header.append(
    createElement("span", "pattern-room-case-object-index", "05"),
    createElement("span", "pattern-room-object-label", text("nav.report.label"))
  );
  const folder = createElement("span", "pattern-room-case-report-preview");
  folder.append(
    createElement("i", "pattern-room-case-report-tab"),
    createElement("i", "pattern-room-case-report-line"),
    createElement("i", "pattern-room-case-report-line"),
    createElement("i", "pattern-room-case-report-line short")
  );
  const footer = createElement("span", "pattern-room-case-object-footer");
  footer.append(
    createElement("strong", undefined, "Vaka dosyası"),
    createElement("small", undefined, `${String(data.reportSummary.sections.length)} bölüm`)
  );
  button.append(header, folder, footer);
  return button;
}

export function createOverviewPanel(
  data: PatternRoomWorkspaceModel,
  onOpenView: (viewId: Exclude<PatternViewId, "overview">) => void,
  text: PatternWorkspaceTranslator = createPatternWorkspaceTranslator("tr", null)
): HTMLElement {
  const shell = createElement("section", "pattern-room-overview pattern-room-case-room");
  shell.dataset["patternView"] = "overview";

  const header = createElement("header", "pattern-room-overview-header pattern-room-case-masthead");
  const titleWrap = createElement("div", "pattern-room-title-block");
  titleWrap.append(
    createElement("span", "pattern-room-kicker", data.roomLabel),
    createElement("h1", undefined, data.roomTitle),
    createElement("p", undefined, data.roomSummary)
  );
  const counters = createElement("div", "pattern-room-case-counters");
  counters.append(
    createCounter("Pano", data.boardCategories.length),
    createCounter("Kaynak", data.sources.length),
    createCounter("Bağ", data.connections.length),
    createCounter("Rol", data.tenthManSession.roles.length)
  );
  header.append(titleWrap, counters);

  const status = createElement("section", "pattern-room-case-status-strip");
  status.append(
    createElement("span", "pattern-room-case-status-light"),
    createElement("span", "pattern-room-kicker", "Aktif vaka"),
    createElement("strong", undefined, data.subject),
    createElement("small", undefined, "Çalışma yüzeyleri hazır")
  );

  const room = createElement("section", "pattern-room-case-room-grid");
  room.ariaLabel = "Soruşturma çalışma alanları";
  room.append(
    createBoardObject(data, onOpenView, text),
    createDeskObject(data, onOpenView, text),
    createArchiveObject(data, onOpenView, text),
    createReviewObject(data, onOpenView, text),
    createReportObject(data, onOpenView, text)
  );

  shell.append(header, status, room);
  return shell;
}
