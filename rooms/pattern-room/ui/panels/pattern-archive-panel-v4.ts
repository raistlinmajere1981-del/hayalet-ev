import { createArchivePanel as createLegacyArchivePanel } from "./pattern-archive-panel.js";
import { createElement } from "./pattern-panel-utils.js";

type LegacyArchiveArgs = Parameters<typeof createLegacyArchivePanel>;

export function createArchivePanel(...args: LegacyArchiveArgs): HTMLElement {
  const [data] = args;
  const shell = createLegacyArchivePanel(...args);
  shell.classList.add("pattern-room-archive-panel-v4");
  shell.dataset["patternArchiveLayout"] = "intake-desk";

  const browser = shell.querySelector<HTMLElement>(".pattern-room-archive-browser");
  const tools = shell.querySelector<HTMLDetailsElement>("[data-pattern-archive-tools='true']");
  const list = shell.querySelector<HTMLElement>(".pattern-room-archive-list");

  if (browser === null || tools === null || list === null) {
    return shell;
  }

  const intake = createElement("section", "pattern-room-archive-intake-desk");
  intake.dataset["patternArchiveIntakeDesk"] = "true";

  const intakeHeader = createElement("header", "pattern-room-archive-intake-header");
  const copy = createElement("div", "pattern-room-archive-intake-copy");
  copy.append(
    createElement("span", "pattern-room-kicker", "Dosya kabul masası"),
    createElement("strong", undefined, data.sources.length === 0 ? "İlk kaynağı içeri al" : "Yeni kaynak ekle"),
    createElement(
      "small",
      undefined,
      "Metin, uzun belge veya elle tanımlanan bir kaynağı doğrudan bu vaka arşivine ekle."
    )
  );
  const intakeStamp = createElement(
    "span",
    "pattern-room-archive-intake-stamp",
    data.sources.length === 0 ? "ARŞİV BOŞ" : `${String(data.sources.length)} DOSYA`
  );
  intakeHeader.append(copy, intakeStamp);

  const summary = tools.querySelector<HTMLElement>("summary");
  if (summary !== null) {
    summary.textContent = data.sources.length === 0 ? "Yeni dosya aç" : "Kaynak alım araçlarını aç";
  }
  tools.open = data.sources.length === 0;
  tools.classList.add("pattern-room-archive-intake-tools");

  intake.append(intakeHeader, tools);
  browser.insertBefore(intake, list);

  const empty = browser.querySelector<HTMLElement>("[data-pattern-archive-empty='true']");
  if (empty !== null && data.sources.length === 0) {
    empty.textContent = "Henüz dosya yok. Yukarıdaki kabul masasından ilk kaynağı ekleyebilirsin.";
  }

  return shell;
}
