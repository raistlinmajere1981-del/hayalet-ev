import type {
  PatternBoardPin,
  PatternRoomWorkspaceModel,
  PatternViewId,
} from "../../shared/types/pattern-room.js";
import {
  createPatternWorkspaceTranslator,
  type PatternWorkspaceTranslator,
} from "../pattern-room-workspace-i18n.js";
import { createElement } from "./pattern-panel-utils.js";

type RoomObjectViewId = Exclude<PatternViewId, "overview">;
type CaseActionTone = "green" | "amber" | "cyan" | "red";

type CaseAction = {
  readonly viewId: RoomObjectViewId;
  readonly eyebrow: string;
  readonly label: string;
  readonly detail: string;
  readonly tone: CaseActionTone;
};

function getAllPins(data: PatternRoomWorkspaceModel): PatternBoardPin[] {
  return data.boardCategories.flatMap((category) => category.pins);
}

function createCounter(label: string, value: number): HTMLElement {
  const counter = createElement("span", "pattern-room-command-counter");
  counter.append(
    createElement("small", undefined, label),
    createElement("strong", undefined, String(value))
  );
  return counter;
}

function createSignal(
  label: string,
  value: string,
  detail: string,
  tone: CaseActionTone
): HTMLElement {
  const signal = createElement("article", `pattern-room-command-signal ${tone}`);
  signal.append(
    createElement("span", "pattern-room-command-signal-label", label),
    createElement("strong", undefined, value),
    createElement("small", undefined, detail)
  );
  return signal;
}

function createActionButton(
  action: CaseAction,
  index: number,
  onOpenView: (viewId: RoomObjectViewId) => void
): HTMLButtonElement {
  const button = createElement("button", `pattern-room-command-action ${action.tone}`);
  button.type = "button";
  button.dataset["patternCommandAction"] = action.viewId;
  button.addEventListener("click", () => {
    onOpenView(action.viewId);
  });
  button.append(
    createElement("span", "pattern-room-command-action-index", String(index + 1).padStart(2, "0")),
    createElement("small", "pattern-room-command-action-eyebrow", action.eyebrow),
    createElement("strong", undefined, action.label),
    createElement("span", "pattern-room-command-action-detail", action.detail),
    createElement("i", "pattern-room-command-action-arrow", "→")
  );
  return button;
}

function buildNextActions(data: PatternRoomWorkspaceModel): CaseAction[] {
  const allPins = getAllPins(data);
  const evidencePins = allPins.filter((pin) => pin.kind === "evidence" || pin.layer === "evidence");
  const uncertaintyPins = allPins.filter(
    (pin) => pin.layer === "uncertainty" || pin.tone === "uncertainty"
  );
  const connectedRoles = data.tenthManSession.roles.filter((role) => role.connected === true).length;
  const reportEntries = data.reportSummary.sections.reduce((total, section) => {
    return total + section.items.length + section.bullets.length;
  }, 0);

  const actions: CaseAction[] = [];
  if (data.sources.length === 0) {
    actions.push({
      viewId: "archive",
      eyebrow: "İlk hareket",
      label: "Kaynak dosyası aç",
      detail: "Vakanın dayanaklarını arşive al; pano ve inceleme akışı buradan beslenir.",
      tone: "green",
    });
  }
  if (data.sources.length > 0 && evidencePins.length === 0) {
    actions.push({
      viewId: "archive",
      eyebrow: "Kanıt boşluğu",
      label: "Kaynaklardan kanıt çıkar",
      detail: `${String(data.sources.length)} kaynak var fakat panoda henüz kanıt fişi yok.`,
      tone: "green",
    });
  }
  if (uncertaintyPins.length > 0) {
    actions.push({
      viewId: "board",
      eyebrow: "Açık soru",
      label: "Belirsizlikleri daralt",
      detail: `${String(uncertaintyPins.length)} açık soru panoda cevap veya bağlantı bekliyor.`,
      tone: "red",
    });
  }
  if (allPins.length >= 2 && data.connections.length < Math.max(2, Math.floor(allPins.length / 2))) {
    actions.push({
      viewId: "desk",
      eyebrow: "Bağlantı açığı",
      label: "İz haritasını ör",
      detail: `${String(allPins.length)} pano izi için yalnız ${String(data.connections.length)} ilişki kayıtlı.`,
      tone: "cyan",
    });
  }
  if (data.tenthManSession.references.length === 0 && (evidencePins.length > 0 || data.sources.length > 0)) {
    actions.push({
      viewId: "tenth-man",
      eyebrow: "Karşıt inceleme",
      label: "10. Adam'a referans gönder",
      detail: "Kaynak veya kanıtları karşıt görüş masasına taşı ve itiraz hattını başlat.",
      tone: "red",
    });
  } else if (connectedRoles < data.tenthManSession.roles.length) {
    actions.push({
      viewId: "tenth-man",
      eyebrow: "Oturum hazırlığı",
      label: "İnceleme masasını tamamla",
      detail: `${String(connectedRoles)} / ${String(data.tenthManSession.roles.length)} rol bağlı.`,
      tone: "red",
    });
  }
  if (reportEntries > 0) {
    actions.push({
      viewId: "report",
      eyebrow: "Dosya kontrolü",
      label: "Vaka dosyasını gözden geçir",
      detail: `${String(reportEntries)} kayıt rapor folio'larına yansımış durumda.`,
      tone: "amber",
    });
  }

  if (actions.length === 0) {
    actions.push({
      viewId: "board",
      eyebrow: "Serbest çalışma",
      label: "Soruşturma tuvalini aç",
      detail: "Vaka yüzeyleri hazır. Yeni bir iz ekleyebilir veya mevcut ilişkileri yeniden düzenleyebilirsin.",
      tone: "amber",
    });
  }

  const seen = new Set<RoomObjectViewId>();
  return actions
    .filter((action) => {
      if (seen.has(action.viewId)) {
        return false;
      }
      seen.add(action.viewId);
      return true;
    })
    .slice(0, 3);
}

function createBoardStation(
  data: PatternRoomWorkspaceModel,
  onOpenView: (viewId: RoomObjectViewId) => void,
  text: PatternWorkspaceTranslator
): HTMLButtonElement {
  const allPins = getAllPins(data);
  const button = createElement("button", "pattern-room-command-station board");
  button.type = "button";
  button.dataset["patternHotspot"] = "board";
  button.addEventListener("click", () => onOpenView("board"));

  const header = createElement("span", "pattern-room-command-station-head");
  header.append(
    createElement("span", "pattern-room-command-station-index", "01"),
    createElement("span", "pattern-room-object-label", text("nav.board.label")),
    createElement("small", undefined, `${String(allPins.length)} iz`)
  );
  const surface = createElement("span", "pattern-room-command-board-preview");
  data.boardCategories.slice(0, 4).forEach((category) => {
    const item = createElement("i", `pattern-room-command-board-item ${category.tone}`);
    item.append(
      createElement("b", undefined, category.label),
      createElement("small", undefined, String(category.pins.length))
    );
    surface.append(item);
  });
  button.append(header, surface, createElement("span", "pattern-room-command-station-cta", "Panoyu aç →"));
  return button;
}

function createConnectionStation(
  data: PatternRoomWorkspaceModel,
  onOpenView: (viewId: RoomObjectViewId) => void,
  text: PatternWorkspaceTranslator
): HTMLButtonElement {
  const button = createElement("button", "pattern-room-command-station desk");
  button.type = "button";
  button.dataset["patternHotspot"] = "desk";
  button.addEventListener("click", () => onOpenView("desk"));
  const header = createElement("span", "pattern-room-command-station-head");
  header.append(
    createElement("span", "pattern-room-command-station-index", "02"),
    createElement("span", "pattern-room-object-label", text("nav.connections.label")),
    createElement("small", undefined, `${String(data.connections.length)} ilişki`)
  );

  const surface = createElement("span", "pattern-room-command-link-preview");
  if (data.connections.length === 0) {
    surface.append(createElement("em", undefined, "Henüz bağlantı kurulmadı"));
  } else {
    data.connections.slice(-3).forEach((connection) => {
      const row = createElement("i", `pattern-room-command-link-row ${connection.edgeType}`);
      row.append(
        createElement("b", undefined, connection.sourceLabel),
        createElement("small", undefined, connection.edgeTypeLabel),
        createElement("b", undefined, connection.targetLabel)
      );
      surface.append(row);
    });
  }
  button.append(header, surface, createElement("span", "pattern-room-command-station-cta", "Haritayı aç →"));
  return button;
}

function createArchiveStation(
  data: PatternRoomWorkspaceModel,
  onOpenView: (viewId: RoomObjectViewId) => void,
  text: PatternWorkspaceTranslator
): HTMLButtonElement {
  const button = createElement("button", "pattern-room-command-station archive");
  button.type = "button";
  button.dataset["patternHotspot"] = "archive";
  button.addEventListener("click", () => onOpenView("archive"));
  const header = createElement("span", "pattern-room-command-station-head");
  header.append(
    createElement("span", "pattern-room-command-station-index", "03"),
    createElement("span", "pattern-room-object-label", text("nav.archive.label")),
    createElement("small", undefined, `${String(data.sources.length)} dosya`)
  );
  const surface = createElement("span", "pattern-room-command-file-stack");
  if (data.sources.length === 0) {
    surface.append(createElement("em", undefined, "Dolap boş"));
  } else {
    data.sources.slice(-4).forEach((source, index) => {
      const file = createElement("i", "pattern-room-command-file");
      file.style.setProperty("--pattern-command-file-index", String(index));
      file.append(
        createElement("small", undefined, source.sourceTypeLabel),
        createElement("b", undefined, source.label)
      );
      surface.append(file);
    });
  }
  button.append(header, surface, createElement("span", "pattern-room-command-station-cta", "Arşivi aç →"));
  return button;
}

function createReviewStation(
  data: PatternRoomWorkspaceModel,
  onOpenView: (viewId: RoomObjectViewId) => void,
  text: PatternWorkspaceTranslator
): HTMLButtonElement {
  const connectedRoles = data.tenthManSession.roles.filter((role) => role.connected === true).length;
  const button = createElement("button", "pattern-room-command-station review");
  button.type = "button";
  button.dataset["patternHotspot"] = "tenth-man";
  button.addEventListener("click", () => onOpenView("tenth-man"));
  const header = createElement("span", "pattern-room-command-station-head");
  header.append(
    createElement("span", "pattern-room-command-station-index", "04"),
    createElement("span", "pattern-room-object-label", text("nav.review.label")),
    createElement("small", undefined, `${String(data.tenthManSession.references.length)} referans`)
  );
  const surface = createElement("span", "pattern-room-command-review-table");
  data.tenthManSession.roles.slice(0, 4).forEach((role) => {
    const seat = createElement("i", role.connected === true ? "connected" : "");
    seat.title = role.label;
    seat.append(createElement("b", undefined, role.id.toUpperCase()));
    surface.append(seat);
  });
  const center = createElement("span", "pattern-room-command-review-center");
  center.append(
    createElement("strong", undefined, `${String(connectedRoles)}/${String(data.tenthManSession.roles.length)}`),
    createElement("small", undefined, "rol bağlı")
  );
  surface.append(center);
  button.append(header, surface, createElement("span", "pattern-room-command-station-cta", "İncelemeyi aç →"));
  return button;
}

function createReportStation(
  data: PatternRoomWorkspaceModel,
  onOpenView: (viewId: RoomObjectViewId) => void,
  text: PatternWorkspaceTranslator
): HTMLButtonElement {
  const filledSections = data.reportSummary.sections.filter(
    (section) => section.items.length > 0 || section.bullets.length > 0
  ).length;
  const button = createElement("button", "pattern-room-command-station report");
  button.type = "button";
  button.dataset["patternHotspot"] = "report";
  button.addEventListener("click", () => onOpenView("report"));
  const header = createElement("span", "pattern-room-command-station-head");
  header.append(
    createElement("span", "pattern-room-command-station-index", "05"),
    createElement("span", "pattern-room-object-label", text("nav.report.label")),
    createElement("small", undefined, `${String(filledSections)}/${String(data.reportSummary.sections.length)} dolu`)
  );
  const surface = createElement("span", "pattern-room-command-report-folios");
  data.reportSummary.sections.slice(0, 6).forEach((section, index) => {
    const folio = createElement("i", section.items.length > 0 || section.bullets.length > 0 ? "filled" : "");
    folio.style.setProperty("--pattern-command-folio-index", String(index));
    folio.append(createElement("small", undefined, String(index + 1).padStart(2, "0")));
    surface.append(folio);
  });
  button.append(header, surface, createElement("span", "pattern-room-command-station-cta", "Dosyayı aç →"));
  return button;
}

export function createOverviewPanel(
  data: PatternRoomWorkspaceModel,
  onOpenView: (viewId: Exclude<PatternViewId, "overview">) => void,
  text: PatternWorkspaceTranslator = createPatternWorkspaceTranslator("tr", null)
): HTMLElement {
  const allPins = getAllPins(data);
  const evidencePins = allPins.filter((pin) => pin.kind === "evidence" || pin.layer === "evidence");
  const uncertaintyPins = allPins.filter(
    (pin) => pin.layer === "uncertainty" || pin.tone === "uncertainty"
  );
  const linkedIds = new Set(
    data.connections.flatMap((connection) => [connection.sourceId, connection.targetId])
  );
  const coverage =
    data.connectionOptions.length === 0
      ? 0
      : Math.round((linkedIds.size / data.connectionOptions.length) * 100);
  const nextActions = buildNextActions(data);

  const shell = createElement("section", "pattern-room-overview pattern-room-command-room");
  shell.dataset["patternView"] = "overview";

  const header = createElement("header", "pattern-room-overview-header pattern-room-command-masthead");
  const titleWrap = createElement("div", "pattern-room-title-block");
  titleWrap.append(
    createElement("span", "pattern-room-kicker", data.roomLabel),
    createElement("h1", undefined, data.roomTitle),
    createElement("p", undefined, data.researchQuestion)
  );
  const counters = createElement("div", "pattern-room-command-counters");
  counters.append(
    createCounter("İz", allPins.length),
    createCounter("Kaynak", data.sources.length),
    createCounter("Bağ", data.connections.length),
    createCounter("Açık", uncertaintyPins.length)
  );
  header.append(titleWrap, counters);

  const commandDesk = createElement("section", "pattern-room-command-desk");
  const caseFocus = createElement("article", "pattern-room-command-focus-card");
  caseFocus.append(
    createElement("span", "pattern-room-kicker", "Aktif vaka"),
    createElement("strong", undefined, data.subject),
    createElement("p", undefined, data.researchQuestion)
  );
  const signals = createElement("div", "pattern-room-command-signals");
  signals.append(
    createSignal("Kanıt", String(evidencePins.length), "pano fişi", "green"),
    createSignal("Açık soru", String(uncertaintyPins.length), "belirsizlik", "red"),
    createSignal("Bağlı ağ", `%${String(coverage)}`, "bağlanabilir iz", "cyan")
  );
  caseFocus.append(signals);

  const actionDesk = createElement("div", "pattern-room-command-next");
  const actionHeader = createElement("div", "pattern-room-command-next-head");
  actionHeader.append(
    createElement("span", "pattern-room-kicker", "Sıradaki hareket"),
    createElement("small", undefined, "Vakadaki mevcut boşluklara göre")
  );
  actionDesk.append(actionHeader, ...nextActions.map((action, index) => createActionButton(action, index, onOpenView)));
  commandDesk.append(caseFocus, actionDesk);

  const stationsHeader = createElement("header", "pattern-room-command-stations-head");
  stationsHeader.append(
    createElement("span", "pattern-room-kicker", "Çalışma yüzeyleri"),
    createElement("strong", undefined, "Soruşturma masası"),
    createElement("small", undefined, "Bir yüzeye gir; veri ve durum burada canlı özetlenir.")
  );

  const stations = createElement("section", "pattern-room-command-stations");
  stations.ariaLabel = "Soruşturma çalışma alanları";
  stations.append(
    createBoardStation(data, onOpenView, text),
    createConnectionStation(data, onOpenView, text),
    createArchiveStation(data, onOpenView, text),
    createReviewStation(data, onOpenView, text),
    createReportStation(data, onOpenView, text)
  );

  shell.append(header, commandDesk, stationsHeader, stations);
  return shell;
}
