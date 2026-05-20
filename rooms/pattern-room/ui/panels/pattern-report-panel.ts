import type { PatternPanelActions, PatternRoomMockData } from "../../shared/types/pattern-room.js";
import { createActionButton, createElement, createPanelShell } from "./pattern-panel-utils.js";

export function createReportPanel(
  data: PatternRoomMockData,
  actions: PatternPanelActions,
  onBack: () => void
): HTMLElement {
  const shell = createPanelShell("report", "Rapor", onBack);
  const report = createElement("article", "pattern-room-report");
  report.append(
    createElement("span", "pattern-room-kicker", "Rapor / İz Kaydı"),
    createElement("h2", undefined, data.reportSummary.label),
    createElement(
      "p",
      undefined,
      `${data.reportSummary.status} rapor; yalnızca yerel izleri özetler.`
    )
  );

  const noteForm = createElement("form", "pattern-room-local-note-form");
  noteForm.dataset["patternLocalNoteForm"] = "true";
  const noteInput = createElement("textarea", "pattern-room-local-note-input");
  noteInput.dataset["patternLocalNoteInput"] = "true";
  noteInput.placeholder = "Yerel not";
  const submitNote = (): void => {
    actions.addLocalNote(noteInput.value);
    noteInput.value = "";
  };
  noteForm.addEventListener("submit", (event) => {
    if (typeof event.preventDefault === "function") {
      event.preventDefault();
    }
    submitNote();
  });
  const noteButton = createActionButton("Yerel Not Bırak", submitNote);
  noteButton.dataset["patternAddLocalNote"] = "true";
  noteForm.append(createElement("span", "pattern-room-kicker", "Yerel not"), noteInput, noteButton);

  const list = createElement("div", "pattern-room-report-list");
  data.reportSummary.sections.forEach((section) => {
    const item = createElement("section", `pattern-room-report-card ${section.tone}`);
    const bullets = createElement("ul", "pattern-room-report-bullets");
    section.bullets.forEach((bullet) => {
      bullets.append(createElement("li", undefined, bullet));
    });
    item.append(
      createElement("span", "pattern-room-list-eyebrow", "Rapor bölümü"),
      createElement("h3", undefined, section.label),
      createElement("p", undefined, section.note),
      bullets
    );
    list.append(item);
  });
  report.append(noteForm, list);
  shell.append(report);
  return shell;
}
