import type {
  PatternSource,
  PatternLongTextSourceImportInput,
  PatternLongTextSourceImportStatus,
  PatternPanelActions,
  PatternRoomMockData,
  PatternSampleSourceImportStatus,
  PatternSourceSegment,
  PatternUserTextSourceImportStatus,
} from "../../shared/types/pattern-room.js";
import { createActionButton, createElement, createPanelShell } from "./pattern-panel-utils.js";

const REMOVE_LOCAL_SOURCE_CONFIRMATION = "Bu yerel kaynak odadan kaldırılacak. Devam edilsin mi?";
const RESET_LOCAL_SESSION_CONFIRMATION =
  "Tüm yerel kaynaklar, notlar ve geçici tartışma izleri temizlenecek. Hazır konu verileri korunur. Devam edilsin mi?";
const SOURCE_SEGMENT_PREVIEW_LENGTH = 120;

type PatternArchivePanelSelection = {
  selectedSourceId: string | null;
  onSelectSource: (sourceId: string | null) => void;
  evidenceCaptureStatus: string | null;
  onEvidenceCaptureStatusChange: (message: string | null) => void;
};

type SourceEvidenceCaptureForm = {
  element: HTMLElement;
  prepareFromSegment: (segment: PatternSourceSegment) => void;
};

const DEFAULT_ARCHIVE_PANEL_SELECTION: PatternArchivePanelSelection = {
  selectedSourceId: null,
  onSelectSource: () => {},
  evidenceCaptureStatus: null,
  onEvidenceCaptureStatusChange: () => {},
};

const LONG_TEXT_SOURCE_KIND_OPTIONS = [
  { label: "Kitap", value: "book" },
  { label: "Makale", value: "article" },
  { label: "Gazete", value: "newspaper" },
  { label: "Dini metin", value: "religious_text" },
  { label: "Arşiv metni", value: "archive_text" },
  { label: "Kişisel uzun not", value: "personal_note" },
] as const satisfies ReadonlyArray<{
  label: string;
  value: PatternLongTextSourceImportInput["sourceKind"];
}>;

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

function createSourceKindSelect(): HTMLSelectElement {
  const select = createElement("select", "pattern-room-inline-input");
  select.name = "sourceKind";
  LONG_TEXT_SOURCE_KIND_OPTIONS.forEach((sourceKind) => {
    const option = createElement("option", undefined, sourceKind.label);
    option.value = sourceKind.value;
    select.append(option);
  });
  select.value = "book";
  return select;
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
  userTextStatus: PatternUserTextSourceImportStatus | null,
  longTextStatus: PatternLongTextSourceImportStatus | null,
  status: PatternSampleSourceImportStatus | null
): HTMLElement {
  const demo = createElement("section", "pattern-room-source-workbench-demo");
  demo.dataset["patternSourceWorkbenchDemo"] = "true";
  const title = createTextInput("title", "Başlık");
  title.dataset["patternUserTextSourceTitle"] = "true";
  const text = createTextArea("text", "Metni buraya yapıştır");
  text.dataset["patternUserTextSourceText"] = "true";
  const form = createElement("form", "pattern-room-inline-form pattern-room-source-workbench-form");
  form.dataset["patternUserTextSourceForm"] = "true";
  const userTextStatusLine = createElement(
    "p",
    "pattern-room-source-workbench-status",
    userTextStatus?.message ?? "Henüz kullanıcı metni kaynak olarak eklenmedi."
  );
  userTextStatusLine.dataset["patternUserTextSourceStatus"] = "true";

  form.addEventListener("submit", (event) => {
    event.preventDefault();
    if (text.value.trim() === "") {
      userTextStatusLine.textContent = "Metin boş olamaz.";
      return;
    }

    const result = actions.importUserTextSource({
      title: title.value,
      text: text.value,
      language: "tr",
    });
    userTextStatusLine.textContent = result.message;
    if (result.success && !result.duplicate && typeof form.reset === "function") {
      form.reset();
    }
  });

  const submitButton = createSubmitButton("Metni Odaya Aktar");
  submitButton.dataset["patternImportUserTextSource"] = "true";
  form.append(title, text, submitButton);

  const longTextForm = createElement(
    "form",
    "pattern-room-inline-form pattern-room-source-workbench-form"
  );
  longTextForm.dataset["patternLongTextSourceForm"] = "true";
  const longTextTitle = createTextInput("title", "Başlık");
  longTextTitle.dataset["patternLongTextSourceTitle"] = "true";
  const longTextOrigin = createTextInput("origin", "Kaynak / Köken");
  longTextOrigin.dataset["patternLongTextSourceOrigin"] = "true";
  const longTextKind = createSourceKindSelect();
  longTextKind.dataset["patternLongTextSourceKind"] = "true";
  const longTextChapter = createTextInput("chapter", "Bölüm / başlık notu (opsiyonel)");
  longTextChapter.dataset["patternLongTextSourceChapter"] = "true";
  const longTextPage = createTextInput("page", "Sayfa / referans (opsiyonel)");
  longTextPage.dataset["patternLongTextSourcePage"] = "true";
  const longText = createTextArea("text", "Metin");
  longText.dataset["patternLongTextSourceText"] = "true";
  const longTextStatusLine = createElement(
    "p",
    "pattern-room-source-workbench-status",
    longTextStatus?.message ?? "Henüz uzun metin kaynak olarak eklenmedi."
  );
  longTextStatusLine.dataset["patternLongTextSourceStatus"] = "true";
  const longTextSubmitButton = createSubmitButton("Uzun Metni Odaya Aktar");
  longTextSubmitButton.dataset["patternImportLongTextSource"] = "true";

  longTextForm.addEventListener("submit", (event) => {
    event.preventDefault();
    if (longTextTitle.value.trim() === "") {
      longTextStatusLine.textContent = "Başlık boş olamaz.";
      return;
    }
    if (longTextOrigin.value.trim() === "") {
      longTextStatusLine.textContent = "Kaynak bilgisi boş olamaz.";
      return;
    }
    if (longText.value.trim() === "") {
      longTextStatusLine.textContent = "Metin boş olamaz.";
      return;
    }

    const result = actions.importLongTextSource({
      title: longTextTitle.value,
      origin: longTextOrigin.value,
      sourceKind: longTextKind.value as PatternLongTextSourceImportInput["sourceKind"],
      chapter: longTextChapter.value,
      page: longTextPage.value,
      text: longText.value,
      language: "tr",
    });
    longTextStatusLine.textContent = result.message;
    if (result.success && !result.duplicate && typeof longTextForm.reset === "function") {
      longTextForm.reset();
    }
  });

  longTextForm.append(
    createElement(
      "p",
      "pattern-room-inline-note",
      "Bu aşamada metin yalnızca kaynak olarak eklenir; alıntı ve örüntü çıkarımı daha sonra yapılır."
    ),
    longTextTitle,
    longTextOrigin,
    longTextKind,
    longTextChapter,
    longTextPage,
    longText,
    longTextSubmitButton,
    longTextStatusLine
  );
  const longTextDisclosure = createAuthoringDisclosure(
    "Uzun Metin / Kitap / Arşiv Ekle",
    longTextForm
  );
  longTextDisclosure.dataset["patternLongTextSourceDisclosure"] = "true";

  const sampleWrap = createElement("div", "pattern-room-source-workbench-example");
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
  sampleWrap.append(importButton, statusLine);

  demo.append(
    createElement("h3", undefined, "Kaynak Atölyesi"),
    createElement(
      "p",
      "pattern-room-inline-note",
      "Bu ilk sürüm metni kaynak olarak ekler; alıntı ve örüntü çıkarımı daha sonra eklenecek."
    ),
    form,
    userTextStatusLine,
    longTextDisclosure,
    sampleWrap
  );
  return demo;
}

function createLocalSessionResetSection(actions: PatternPanelActions): HTMLElement {
  const section = createElement("section", "pattern-room-local-session-reset");
  section.dataset["patternLocalSessionReset"] = "true";
  const resetButton = createActionButton("Yerel Oturumu Sıfırla", () => {
    if (!window.confirm(RESET_LOCAL_SESSION_CONFIRMATION)) {
      return;
    }
    actions.resetLocalSession();
  });
  resetButton.dataset["patternResetLocalSession"] = "true";

  section.append(
    createElement("span", "pattern-room-kicker", "Oda Temizliği"),
    createElement("h3", undefined, "Yerel Oturum"),
    createElement(
      "p",
      "pattern-room-inline-note",
      "Bu işlem yalnızca bu odada eklenen yerel kaynakları, notları, bağlantıları ve 10. Adam oturum izlerini temizler. Hazır konu verileri korunur."
    ),
    resetButton
  );
  return section;
}

function createSourceDetailMeta(label: string, value: string): HTMLElement {
  const item = createElement("span", "pattern-room-source-detail-meta-item", `${label}: ${value}`);
  return item;
}

function createSourceSegmentPreview(text: string): string {
  const normalizedText = text.replace(/\s+/g, " ").trim();
  if (normalizedText.length <= SOURCE_SEGMENT_PREVIEW_LENGTH) {
    return normalizedText;
  }
  return `${normalizedText.slice(0, SOURCE_SEGMENT_PREVIEW_LENGTH).trimEnd()}…`;
}

function createSourceSegmentButton(
  segment: PatternSourceSegment,
  segmentNumber: number,
  onSelect: (segment: PatternSourceSegment) => void
): HTMLButtonElement {
  const button = createElement("button", "pattern-room-source-segment-button");
  button.type = "button";
  button.dataset["patternArchiveSourceSegment"] = segment.id;
  button.dataset["patternArchiveSourceSegmentSelected"] = "false";
  button.append(
    createElement("span", "pattern-room-source-segment-number", String(segmentNumber)),
    createElement("strong", undefined, segment.label),
    createElement("p", undefined, createSourceSegmentPreview(segment.text))
  );
  button.addEventListener("click", () => {
    onSelect(segment);
  });
  return button;
}

function createSourceSegmentsNavigator(
  source: PatternSource,
  onPrepareEvidence: (segment: PatternSourceSegment) => void
): HTMLElement | null {
  const orderedSegments = [...(source.segments ?? [])].sort((left, right) => {
    return left.order - right.order;
  });
  if (orderedSegments.length === 0) {
    return null;
  }

  const section = createElement("section", "pattern-room-source-segments");
  section.dataset["patternArchiveSourceSegments"] = source.id;
  const list = createElement("div", "pattern-room-source-segment-list");
  const selectedSegmentText = createElement(
    "pre",
    "pattern-room-source-segment-text",
    "Bir segment seç."
  );
  selectedSegmentText.dataset["patternArchiveSourceSegmentText"] = source.id;
  const selectedSegmentDetail = createElement("div", "pattern-room-source-segment-detail");
  selectedSegmentDetail.dataset["patternArchiveSourceSegmentDetail"] = source.id;
  let selectedSegment: PatternSourceSegment | null = null;
  const selectedSegmentHint = createElement(
    "p",
    "pattern-room-inline-note",
    "Seçili segmenti kanıt formuna aktarır; otomatik analiz yapmaz."
  );
  const prepareEvidenceButton = createActionButton("Bu Segmentten Kanıt Hazırla", () => {
    if (selectedSegment === null) {
      return;
    }

    onPrepareEvidence(selectedSegment);
  });
  prepareEvidenceButton.disabled = true;
  prepareEvidenceButton.dataset["patternArchivePrepareSegmentEvidence"] = source.id;
  selectedSegmentDetail.append(
    createElement("h4", undefined, "Seçili segment"),
    selectedSegmentText,
    selectedSegmentHint,
    prepareEvidenceButton
  );

  const buttons: HTMLButtonElement[] = [];
  const selectSegment = (nextSegment: PatternSourceSegment): void => {
    selectedSegment = nextSegment;
    buttons.forEach((button) => {
      const isSelected = button.dataset["patternArchiveSourceSegment"] === nextSegment.id;
      button.dataset["patternArchiveSourceSegmentSelected"] = isSelected ? "true" : "false";
      if (isSelected) {
        button.classList.add("selected-segment");
        return;
      }
      button.classList.remove("selected-segment");
    });
    selectedSegmentDetail.dataset["patternArchiveSelectedSegment"] = nextSegment.id;
    selectedSegmentText.textContent = nextSegment.text;
    prepareEvidenceButton.disabled = false;
  };

  orderedSegments.forEach((segment, index) => {
    const button = createSourceSegmentButton(segment, index + 1, selectSegment);
    buttons.push(button);
    list.append(button);
  });

  section.append(createElement("h3", undefined, "Segmentler"), list, selectedSegmentDetail);
  return section;
}

function createSourceEvidenceCaptureForm(
  source: PatternSource,
  actions: PatternPanelActions,
  selection: PatternArchivePanelSelection
): SourceEvidenceCaptureForm {
  const section = createElement("section", "pattern-room-source-evidence-capture");
  section.dataset["patternArchiveEvidenceCapture"] = source.id;
  const form = createElement("form", "pattern-room-inline-form");
  form.dataset["patternArchiveEvidenceForm"] = source.id;
  const label = createTextInput("label", "Kanıt başlığı");
  label.dataset["patternArchiveEvidenceLabel"] = source.id;
  const excerpt = createTextArea("excerpt", "Alıntı / pasaj");
  excerpt.dataset["patternArchiveEvidenceExcerpt"] = source.id;
  const interpretation = createTextArea("interpretation", "Yorum / bağlam (opsiyonel)");
  interpretation.dataset["patternArchiveEvidenceInterpretation"] = source.id;
  const submit = createSubmitButton("Kanıt Notu Oluştur");
  submit.dataset["patternCreateSourceEvidence"] = source.id;
  const status = createElement(
    "p",
    "pattern-room-source-evidence-status",
    selection.evidenceCaptureStatus ?? ""
  );
  status.dataset["patternArchiveEvidenceStatus"] = source.id;

  form.addEventListener("submit", (event) => {
    event.preventDefault();
    if (label.value.trim() === "") {
      status.textContent = "Kanıt başlığı boş olamaz.";
      selection.onEvidenceCaptureStatusChange(status.textContent);
      return;
    }
    if (excerpt.value.trim() === "") {
      status.textContent = "Alıntı boş olamaz.";
      selection.onEvidenceCaptureStatusChange(status.textContent);
      return;
    }

    selection.onEvidenceCaptureStatusChange("Kanıt notu panoya eklendi.");
    actions.addAuthoredEvidence(label.value, excerpt.value, interpretation.value, "evidence", {
      sourceId: source.id,
      sourceLabel: source.label,
    });
    if (typeof form.reset === "function") {
      form.reset();
    }
  });

  form.append(label, excerpt, interpretation, submit, status);
  section.append(
    createElement("h3", undefined, "Bu kaynaktan kanıt notu oluştur"),
    createElement(
      "p",
      "pattern-room-inline-note",
      "Bu işlem otomatik analiz yapmaz; seçtiğin pasajı yerel kanıt notu olarak panoya ekler."
    ),
    form
  );
  return {
    element: section,
    prepareFromSegment(segment: PatternSourceSegment): void {
      label.value = segment.label;
      excerpt.value = segment.text;
      interpretation.value = "";
    },
  };
}

function createArchiveSourceDetail(
  source: PatternSource | undefined,
  selectedSourceId: string | null,
  actions: PatternPanelActions,
  selection: PatternArchivePanelSelection
): HTMLElement {
  const detail = createElement("section", "pattern-room-source-detail");
  detail.dataset["patternArchiveSourceDetail"] = "true";
  detail.append(createElement("h2", undefined, "Kaynak Detayı"));

  if (source === undefined) {
    const placeholder = createElement(
      "p",
      "pattern-room-source-detail-placeholder",
      selectedSourceId === null ? "Bir kaynak seç" : "Seçili kaynak artık arşivde değil."
    );
    placeholder.dataset["patternArchiveSourceDetailPlaceholder"] = "true";
    detail.append(placeholder);
    return detail;
  }

  detail.dataset["patternArchiveSourceDetailId"] = source.id;
  const meta = createElement("div", "pattern-room-source-detail-meta");
  meta.append(
    createSourceDetailMeta("Tür", source.sourceTypeLabel),
    createSourceDetailMeta("Köken", source.origin),
    createSourceDetailMeta("Durum", source.status)
  );
  const fullText = createElement("pre", "pattern-room-source-detail-text", source.note);
  fullText.dataset["patternArchiveSourceFullText"] = source.id;
  const evidenceCaptureForm = createSourceEvidenceCaptureForm(source, actions, selection);
  const segmentsNavigator = createSourceSegmentsNavigator(
    source,
    evidenceCaptureForm.prepareFromSegment
  );

  detail.append(
    createElement("h3", undefined, source.label),
    meta,
    fullText,
    ...(segmentsNavigator === null ? [] : [segmentsNavigator]),
    evidenceCaptureForm.element
  );
  return detail;
}

export function createArchivePanel(
  data: PatternRoomMockData,
  actions: PatternPanelActions,
  onBack: () => void,
  userTextSourceImportStatus: PatternUserTextSourceImportStatus | null = null,
  longTextSourceImportStatus: PatternLongTextSourceImportStatus | null = null,
  sourceImportStatus: PatternSampleSourceImportStatus | null = null,
  selection: PatternArchivePanelSelection = DEFAULT_ARCHIVE_PANEL_SELECTION
): HTMLElement {
  const shell = createPanelShell("archive", "Arşiv", onBack);
  const list = createElement("div", "pattern-room-archive-list");
  const selectedSource = data.sources.find((source) => {
    return source.id === selection.selectedSourceId;
  });

  data.sources.forEach((source) => {
    const toneClass =
      source.isLocal === true ? "local-source" : sourceTypeClass(source.sourceTypeLabel);
    const isSelected = source.id === selection.selectedSourceId;
    const card = createElement(
      "article",
      `pattern-room-archive-card ${toneClass}${isSelected ? " selected-source" : ""}`
    );
    card.dataset["patternArchiveSource"] = source.id;
    card.dataset["patternArchiveSourceSelected"] = isSelected ? "true" : "false";
    const drawer = createElement("span", "pattern-room-archive-drawer", source.origin);
    const tag = createElement(
      "span",
      `pattern-room-source-tag ${toneClass}`,
      source.sourceTypeLabel
    );
    const preview = createElement(
      "p",
      "pattern-room-archive-preview",
      source.notePreview ?? source.note
    );
    preview.dataset["patternArchiveSourcePreview"] = source.id;
    const actionsRow = createElement("div", "pattern-room-action-row");
    const sourceStatus = createElement("small", undefined, source.status);
    const metadata =
      source.metadataLine === undefined || source.metadataLine.trim() === ""
        ? null
        : createElement("span", "pattern-room-archive-meta", source.metadataLine);

    if (metadata !== null) {
      metadata.dataset["patternArchiveSourceMeta"] = source.id;
    }

    const inspectButton = createActionButton("İncele", () => {
      selection.onSelectSource(source.id);
    });
    inspectButton.dataset["patternInspectSource"] = source.id;
    actionsRow.append(inspectButton);

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
    if (source.isLocal === true) {
      const removeButton = createActionButton("Kaynağı kaldır", () => {
        if (!window.confirm(REMOVE_LOCAL_SOURCE_CONFIRMATION)) {
          return;
        }
        if (selection.selectedSourceId === source.id) {
          selection.onSelectSource(null);
        }
        actions.removeLocalSource(source.id);
      });
      removeButton.dataset["patternRemoveLocalSource"] = source.id;
      actionsRow.append(removeButton);
    }

    card.append(
      drawer,
      tag,
      createElement("h3", undefined, source.label),
      preview,
      ...(metadata === null ? [] : [metadata]),
      sourceStatus,
      actionsRow
    );
    list.append(card);
  });

  shell.append(
    createSourceWorkbenchDemo(
      actions,
      userTextSourceImportStatus,
      longTextSourceImportStatus,
      sourceImportStatus
    ),
    createSourceAuthoringForm(actions),
    createLocalSessionResetSection(actions),
    createArchiveSourceDetail(selectedSource, selection.selectedSourceId, actions, selection),
    list
  );
  return shell;
}
