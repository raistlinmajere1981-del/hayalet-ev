import type {
  PatternPanelActions,
  PatternRoomMockData,
  PatternSampleSourceImportStatus,
} from "../../shared/types/pattern-room.js";
import { createActionButton, createElement, createPanelShell } from "./pattern-panel-utils.js";

function createTextInput(name: string, placeholder: string): HTMLInputElement {
  const input = createElement("input", "pattern-room-inline-input");
  input.name = name;
  input.placeholder = placeholder;
  return input;
}

function createTextArea(name: string, placeholder: string): HTMLTextAreaElement {
  const textarea = createElement("textarea", "pattern-room-inline-input");
  textarea.name = name;
  textarea.placeholder = placeholder;
  return textarea;
}

function createSubmitButton(label: string): HTMLButtonElement {
  const button = createElement("button", "pattern-room-action-button", label);
  button.type = "submit";
  return button;
}

function createAuthoringDisclosure(label: string, form: HTMLFormElement): HTMLElement {
  const disclosure = createElement("details", "pattern-room-inline-disclosure");
  disclosure.dataset["patternAuthoringDisclosure"] = label;
  disclosure.append(createElement("summary", "pattern-room-inline-summary", label), form);
  return disclosure;
}

function createSourceAuthoringForm(actions: PatternPanelActions): HTMLElement {
  const form = createElement("form", "pattern-room-inline-form");
  form.dataset["patternAuthorSourceForm"] = "true";

  const label = createTextInput("label", "Başlık");
  label.dataset["patternAuthorSourceLabel"] = "true";
  const origin = createTextInput("origin", "Köken");
  origin.dataset["patternAuthorSourceOrigin"] = "true";
  const note = createTextArea("note", "Not");
  note.dataset["patternAuthorSourceNote"] = "true";

  form.addEventListener("submit", (event) => {
    event.preventDefault();
    if (label.value.trim() === "" || origin.value.trim() === "") {
      return;
    }

    actions.addAuthoredSource(label.value, origin.value, note.value);
    form.reset();
  });

  form.append(label, origin, note, createSubmitButton("Ekle"));
  return createAuthoringDisclosure("Kaynak Ekle", form);
}

function sourceTypeClass(sourceTypeLabel: string): string {
  if (sourceTypeLabel === "Kitap / Metin") {
    return "text-source";
  }
  if (sourceTypeLabel === "Görsel kaynak") {
    return "visual-source";
  }
  if (sourceTypeLabel === "Masa çıktısı") {
    return "table-output";
  }
  return "uncertain-source";
}

function createSourceWorkbenchDemo(
  actions: PatternPanelActions,
  status: PatternSampleSourceImportStatus | null
): HTMLElement {
  const demo = createElement("section", "pattern-room-source-workbench-demo");
  demo.dataset["patternSourceWorkbenchDemo"] = "true";
  const importButton = createActionButton("Örnek Kaynak Paketini İçe Aktar", () => {
    actions.importSampleSourcePackage();
  });
  importButton.dataset["patternImportSampleSourcePackage"] = "true";
  const statusLine = createElement(
    "p",
    "pattern-room-source-workbench-status",
    status?.message ?? "Henüz örnek kaynak paketi içe aktarılmadı."
  );
  statusLine.dataset["patternSourceImportStatus"] = "true";

  demo.append(
    createElement("h3", undefined, "Kaynak Atölyesi Demo"),
    createElement(
      "p",
      "pattern-room-inline-note",
      "Bu örnek, ileride eklenecek kaynak hazırlama akışının yerel bir denemesidir. Dış dosya veya internet bağlantısı kullanmaz."
    ),
    importButton,
    statusLine
  );
  return demo;
}

export function createArchivePanel(
  data: PatternRoomMockData,
  actions: PatternPanelActions,
  onBack: () => void,
  sourceImportStatus: PatternSampleSourceImportStatus | null = null
): HTMLElement {
  const shell = createPanelShell("archive", "Arşiv", onBack);
  const list = createElement("div", "pattern-room-archive-list");

  data.sources.forEach((source) => {
    const toneClass =
      source.isLocal === true ? "local-source" : sourceTypeClass(source.sourceTypeLabel);
    const card = createElement("article", `pattern-room-archive-card ${toneClass}`);
    card.dataset["patternArchiveSource"] = source.id;
    const drawer = createElement("span", "pattern-room-archive-drawer", source.origin);
    const tag = createElement(
      "span",
      `pattern-room-source-tag ${toneClass}`,
      source.sourceTypeLabel
    );
    const actionsRow = createElement("div", "pattern-room-action-row");
    if (source.isLocal !== true) {
      const pinButton = createActionButton("Panoya İliştir", () => {
        actions.pinSourceToBoard(source.id, "evidence");
      });
      pinButton.dataset["patternPinSource"] = source.id;
      actionsRow.append(pinButton);
    }

    const debateButton = createActionButton("10. Adam’a Ekle", () => {
      actions.addSourceToDebate(source.id);
    });
    debateButton.dataset["patternAddSourceDebate"] = source.id;
    actionsRow.append(debateButton);

    card.append(
      drawer,
      tag,
      createElement("h3", undefined, source.label),
      createElement("p", undefined, source.note),
      createElement("small", undefined, source.status),
      actionsRow
    );
    list.append(card);
  });

  shell.append(
    createSourceWorkbenchDemo(actions, sourceImportStatus),
    createSourceAuthoringForm(actions),
    list
  );
  return shell;
}
