import type {
  PatternPanelActions,
  PatternRoomWorkspaceModel,
  PatternSource,
} from "../shared/types/pattern-room.js";

type PatternRoomArchiveFileKind =
  "document" | "image" | "video" | "audio" | "data" | "archive" | "other";

type PatternRoomArchivedFile = {
  id: string;
  caseLabel: string;
  sourceId: string;
  label: string;
  origin: string;
  note: string;
  originalFileName: string;
  storedFileName: string;
  relativePath: string;
  extension: string;
  kind: PatternRoomArchiveFileKind;
  sizeBytes: number;
  addedAt: string;
};

type PatternRoomArchiveFilePayload = {
  caseLabel: string;
  sourceId: string;
  label: string;
  origin: string;
  note: string;
};

type PatternRoomArchiveResult = {
  success: boolean;
  message?: string;
  file?: PatternRoomArchivedFile;
  files?: PatternRoomArchivedFile[];
};

type PatternRoomArchiveElectronApi = {
  patternRoomArchiveFile?: (file: File, payload: PatternRoomArchiveFilePayload) => Promise<unknown>;
  patternRoomListArchiveFiles?: () => Promise<unknown>;
  patternRoomOpenArchiveFile?: (fileId: string) => Promise<unknown>;
  patternRoomRevealArchiveFile?: (fileId: string) => Promise<unknown>;
};

const FILE_KIND_LABELS: Readonly<Record<PatternRoomArchiveFileKind, string>> = {
  document: "Belge",
  image: "Görsel",
  video: "Video",
  audio: "Ses",
  data: "Veri",
  archive: "Arşiv",
  other: "Dosya",
};

function getArchiveElectronApi(): PatternRoomArchiveElectronApi | null {
  if (typeof window === "undefined") {
    return null;
  }
  const api = window.electronAPI;
  if (api === undefined || typeof api !== "object") {
    return null;
  }
  return api;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isArchiveFileKind(value: unknown): value is PatternRoomArchiveFileKind {
  return (
    value === "document" ||
    value === "image" ||
    value === "video" ||
    value === "audio" ||
    value === "data" ||
    value === "archive" ||
    value === "other"
  );
}

function parseArchivedFile(value: unknown): PatternRoomArchivedFile | null {
  if (!isRecord(value) || !isArchiveFileKind(value["kind"])) {
    return null;
  }
  const stringKeys = [
    "id",
    "caseLabel",
    "sourceId",
    "label",
    "origin",
    "note",
    "originalFileName",
    "storedFileName",
    "relativePath",
    "extension",
    "addedAt",
  ] as const;
  if (stringKeys.some((key) => typeof value[key] !== "string")) {
    return null;
  }
  if (typeof value["sizeBytes"] !== "number" || !Number.isFinite(value["sizeBytes"])) {
    return null;
  }
  return {
    id: value["id"] as string,
    caseLabel: value["caseLabel"] as string,
    sourceId: value["sourceId"] as string,
    label: value["label"] as string,
    origin: value["origin"] as string,
    note: value["note"] as string,
    originalFileName: value["originalFileName"] as string,
    storedFileName: value["storedFileName"] as string,
    relativePath: value["relativePath"] as string,
    extension: value["extension"] as string,
    kind: value["kind"],
    sizeBytes: value["sizeBytes"],
    addedAt: value["addedAt"] as string,
  };
}

function parseArchiveResult(value: unknown): PatternRoomArchiveResult {
  if (!isRecord(value)) {
    return { success: false, message: "Dosya arşivi geçersiz bir yanıt döndürdü." };
  }
  const file = parseArchivedFile(value["file"]);
  const files = Array.isArray(value["files"])
    ? value["files"].flatMap((entry) => {
        const parsed = parseArchivedFile(entry);
        return parsed === null ? [] : [parsed];
      })
    : undefined;
  return {
    success: value["success"] === true,
    ...(typeof value["message"] === "string" ? { message: value["message"] } : {}),
    ...(file === null ? {} : { file }),
    ...(files === undefined ? {} : { files }),
  };
}

function fileTitle(fileName: string): string {
  const dotIndex = fileName.lastIndexOf(".");
  const title = (dotIndex <= 0 ? fileName : fileName.slice(0, dotIndex)).trim();
  return title === "" ? "Yerel dosya" : title;
}

function getLocalSourceIndex(sourceId: string): number {
  const match = /^local-source-(\d+)$/.exec(sourceId);
  return match === null ? 0 : Number.parseInt(match[1] ?? "0", 10);
}

function createNextLocalSourceId(
  sources: readonly PatternSource[],
  archivedFiles: readonly PatternRoomArchivedFile[]
): string {
  const maxIndex = [
    ...sources.map((source) => source.id),
    ...archivedFiles.map((file) => file.sourceId),
  ]
    .map(getLocalSourceIndex)
    .reduce((max, index) => Math.max(max, index), 0);
  return `local-source-${String(maxIndex + 1).padStart(3, "0")}`;
}

function formatFileSize(sizeBytes: number): string {
  if (sizeBytes < 1024) return `${String(sizeBytes)} B`;
  const units = ["KB", "MB", "GB", "TB"];
  let value = sizeBytes / 1024;
  let unitIndex = 0;
  while (value >= 1024 && unitIndex < units.length - 1) {
    value /= 1024;
    unitIndex += 1;
  }
  const fractionDigits = value >= 100 ? 0 : value >= 10 ? 1 : 2;
  return `${value.toFixed(fractionDigits)} ${units[unitIndex] ?? "KB"}`;
}

function formatAddedAt(value: string): string {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString("tr-TR");
}

function createActionButton(label: string, onClick: () => void): HTMLButtonElement {
  const button = document.createElement("button");
  button.type = "button";
  button.className = "pattern-room-action-button";
  button.textContent = label;
  button.addEventListener("click", onClick);
  return button;
}

function createFileInput(): HTMLInputElement {
  const input = document.createElement("input");
  input.type = "file";
  input.hidden = true;
  input.dataset["patternArchiveFileInput"] = "true";
  return input;
}

function createSourceNote(file: PatternRoomArchivedFile): string {
  return [
    `Dosya arşivi: ${file.originalFileName}`,
    `${FILE_KIND_LABELS[file.kind]} · ${formatFileSize(file.sizeBytes)}`,
    "İçerik Pattern Room tarafından işlenmez; dosya uygulama arşivinde tutulur.",
  ].join("\n");
}

function setStatus(status: HTMLElement, message: string, tone = "neutral"): void {
  status.textContent = message;
  status.dataset["patternArchiveFileStatusTone"] = tone;
}

async function listArchivedFiles(
  api: PatternRoomArchiveElectronApi
): Promise<PatternRoomArchivedFile[]> {
  if (typeof api.patternRoomListArchiveFiles !== "function") {
    return [];
  }
  const result = parseArchiveResult(await api.patternRoomListArchiveFiles());
  return result.success ? (result.files ?? []) : [];
}

function findSourceForFile(
  sources: readonly PatternSource[],
  file: PatternRoomArchivedFile
): PatternSource | null {
  return sources.find((source) => source.id === file.sourceId) ?? null;
}

async function runFileAction(
  action: ((fileId: string) => Promise<unknown>) | undefined,
  fileId: string,
  status: HTMLElement,
  pendingMessage: string
): Promise<void> {
  if (typeof action !== "function") {
    setStatus(status, "Dosya işlemi Electron köprüsünde kullanılamıyor.", "error");
    return;
  }
  setStatus(status, pendingMessage, "pending");
  try {
    const result = parseArchiveResult(await action(fileId));
    if (!result.success) {
      setStatus(status, result.message ?? "Dosya işlemi tamamlanamadı.", "error");
      return;
    }
    setStatus(status, "Dosya işlemi tamamlandı.", "success");
  } catch (error) {
    setStatus(
      status,
      error instanceof Error ? error.message : "Dosya işlemi tamamlanamadı.",
      "error"
    );
  }
}

function createArchiveFileRow(
  file: PatternRoomArchivedFile,
  source: PatternSource | null,
  api: PatternRoomArchiveElectronApi,
  status: HTMLElement
): HTMLElement {
  const row = document.createElement("article");
  row.className = "pattern-room-file-archive-row";
  row.dataset["patternArchiveFile"] = file.id;
  row.dataset["patternArchiveFileLinked"] = source === null ? "false" : "true";

  const kind = document.createElement("span");
  kind.className = "pattern-room-file-kind";
  kind.textContent = FILE_KIND_LABELS[file.kind];

  const body = document.createElement("div");
  body.className = "pattern-room-file-body";
  const title = document.createElement("strong");
  title.className = "pattern-room-file-name";
  title.textContent = file.originalFileName;
  const meta = document.createElement("small");
  meta.className = "pattern-room-file-meta";
  meta.textContent = [
    formatFileSize(file.sizeBytes),
    file.caseLabel,
    formatAddedAt(file.addedAt),
    source === null ? "Kaynak kaydı yok · dosya korunuyor" : `Kaynak: ${source.label}`,
  ].join(" · ");
  body.append(title, meta);

  const actions = document.createElement("div");
  actions.className = "pattern-room-file-actions";
  actions.append(
    createActionButton("Aç", () => {
      void runFileAction(
        api.patternRoomOpenArchiveFile,
        file.id,
        status,
        `${file.originalFileName} açılıyor…`
      );
    }),
    createActionButton("Klasörde Göster", () => {
      void runFileAction(
        api.patternRoomRevealArchiveFile,
        file.id,
        status,
        `${file.originalFileName} dosya yöneticisinde gösteriliyor…`
      );
    })
  );

  row.append(kind, body, actions);
  return row;
}

function decorateSourceAttachments(
  panel: HTMLElement,
  data: PatternRoomWorkspaceModel,
  files: readonly PatternRoomArchivedFile[],
  api: PatternRoomArchiveElectronApi,
  status: HTMLElement
): void {
  const filesBySourceId = new Map<string, PatternRoomArchivedFile[]>();
  files.forEach((file) => {
    if (!data.sources.some((source) => source.id === file.sourceId)) {
      return;
    }
    const current = filesBySourceId.get(file.sourceId) ?? [];
    current.push(file);
    filesBySourceId.set(file.sourceId, current);
  });

  panel.querySelectorAll<HTMLElement>("[data-pattern-archive-source]").forEach((card) => {
    const sourceId = card.dataset["patternArchiveSource"] ?? "";
    const sourceFiles = filesBySourceId.get(sourceId) ?? [];
    if (
      sourceFiles.length === 0 ||
      card.querySelector("[data-pattern-file-attachment-badge]") !== null
    ) {
      return;
    }
    const badge = document.createElement("span");
    badge.className = "pattern-room-file-attachment-badge";
    badge.dataset["patternFileAttachmentBadge"] = "true";
    badge.textContent =
      sourceFiles.length === 1
        ? `${FILE_KIND_LABELS[sourceFiles[0]?.kind ?? "other"]} eki`
        : `${String(sourceFiles.length)} dosya eki`;
    const actionRow = card.querySelector<HTMLElement>(".pattern-room-action-row");
    (actionRow ?? card).append(badge);
  });

  const detail = panel.querySelector<HTMLElement>("[data-pattern-archive-source-detail-id]");
  const detailSourceId = detail?.dataset["patternArchiveSourceDetailId"] ?? "";
  const detailFiles = filesBySourceId.get(detailSourceId) ?? [];
  if (
    detail === null ||
    detailFiles.length === 0 ||
    detail.querySelector("[data-pattern-file-attachment-detail]") !== null
  ) {
    return;
  }

  const attachmentSection = document.createElement("section");
  attachmentSection.className = "pattern-room-file-attachment-detail";
  attachmentSection.dataset["patternFileAttachmentDetail"] = "true";
  const heading = document.createElement("h3");
  heading.textContent = detailFiles.length === 1 ? "Dosya Eki" : "Dosya Ekleri";
  attachmentSection.append(heading);
  detailFiles.forEach((file) => {
    const row = document.createElement("div");
    row.className = "pattern-room-file-attachment-item";
    const info = document.createElement("div");
    const name = document.createElement("strong");
    name.textContent = file.originalFileName;
    const meta = document.createElement("small");
    meta.textContent = `${FILE_KIND_LABELS[file.kind]} · ${formatFileSize(file.sizeBytes)}`;
    info.append(name, meta);
    const actions = document.createElement("div");
    actions.className = "pattern-room-file-actions";
    actions.append(
      createActionButton("Aç", () => {
        void runFileAction(
          api.patternRoomOpenArchiveFile,
          file.id,
          status,
          `${file.originalFileName} açılıyor…`
        );
      }),
      createActionButton("Klasörde Göster", () => {
        void runFileAction(
          api.patternRoomRevealArchiveFile,
          file.id,
          status,
          `${file.originalFileName} dosya yöneticisinde gösteriliyor…`
        );
      })
    );
    row.append(info, actions);
    attachmentSection.append(row);
  });
  detail.append(attachmentSection);
}

async function refreshArchiveFiles(
  panel: HTMLElement,
  data: PatternRoomWorkspaceModel,
  api: PatternRoomArchiveElectronApi,
  list: HTMLElement,
  status: HTMLElement
): Promise<PatternRoomArchivedFile[]> {
  try {
    const files = await listArchivedFiles(api);
    list.replaceChildren();
    if (files.length === 0) {
      const empty = document.createElement("p");
      empty.className = "pattern-room-inline-note";
      empty.textContent = "Henüz fiziksel dosya arşivlenmedi.";
      list.append(empty);
      return [];
    }
    files.forEach((file) => {
      list.append(createArchiveFileRow(file, findSourceForFile(data.sources, file), api, status));
    });
    decorateSourceAttachments(panel, data, files, api, status);
    return files;
  } catch (error) {
    setStatus(status, error instanceof Error ? error.message : "Dosya arşivi okunamadı.", "error");
    return [];
  }
}

export function enhanceArchiveFileIntake(
  panel: HTMLElement,
  data: PatternRoomWorkspaceModel,
  actions: PatternPanelActions
): void {
  if (panel.dataset["patternArchiveFileIntakeEnhanced"] === "true") {
    return;
  }

  const workbench = panel.querySelector<HTMLElement>("[data-pattern-source-workbench-demo='true']");
  if (workbench === null) {
    return;
  }

  const api = getArchiveElectronApi();
  const intake = document.createElement("section");
  intake.className = "pattern-room-source-workbench-example";
  intake.dataset["patternArchiveFileIntake"] = "true";
  intake.dataset["patternArchiveFileDropActive"] = "false";
  intake.ariaLabel = "Pattern Room fiziksel dosya arşivi";

  const heading = document.createElement("div");
  heading.className = "pattern-room-file-intake-heading";
  const title = document.createElement("h3");
  title.textContent = "Dosya Arşivi";
  const description = document.createElement("p");
  description.className = "pattern-room-inline-note";
  description.textContent =
    "PDF, belge, görsel, ses, video, veri veya başka bir dosyayı arşivle. Pattern Room içeriği dönüştürmez; dosyayı uygulamanın veri alanında saklar.";
  heading.append(title, description);

  const pickButton = createActionButton("Dosya Ekle", () => {
    input.click();
  });
  pickButton.dataset["patternArchiveFilePick"] = "true";
  const input = createFileInput();
  const status = document.createElement("p");
  status.className = "pattern-room-source-workbench-status pattern-room-file-intake-status";
  status.dataset["patternArchiveFileStatus"] = "true";
  status.ariaLive = "polite";
  const list = document.createElement("div");
  list.className = "pattern-room-file-archive-list";
  list.dataset["patternArchiveFileList"] = "true";

  if (api === null || typeof api.patternRoomArchiveFile !== "function") {
    pickButton.disabled = true;
    setStatus(
      status,
      "Fiziksel dosya arşivi yalnız masaüstü Electron uygulamasında kullanılabilir."
    );
  } else {
    setStatus(
      status,
      "Dosya seç veya tek bir dosyayı bu alana bırak. Orijinal dosyaya dokunulmaz."
    );
  }

  const ingestFile = async (file: File): Promise<void> => {
    if (api === null || typeof api.patternRoomArchiveFile !== "function") {
      setStatus(status, "Fiziksel dosya arşivi bu çalışma ortamında kullanılamıyor.", "error");
      return;
    }

    setStatus(status, `${file.name} arşivleniyor…`, "pending");
    try {
      const knownFiles = await listArchivedFiles(api);
      const sourceId = createNextLocalSourceId(data.sources, knownFiles);
      const label = fileTitle(file.name);
      const origin = `Dosya · ${file.name}`;
      const baseNote = "Fiziksel dosya eki. İçerik Pattern Room tarafından işlenmez.";
      const result = parseArchiveResult(
        await api.patternRoomArchiveFile(file, {
          caseLabel: data.subject,
          sourceId,
          label,
          origin,
          note: baseNote,
        })
      );
      if (!result.success || result.file === undefined) {
        setStatus(status, result.message ?? "Dosya arşivlenemedi.", "error");
        return;
      }

      actions.addAuthoredSource(label, origin, createSourceNote(result.file));
      setStatus(
        status,
        `${result.file.originalFileName} arşivlendi ve kaynak kaydı oluşturuldu.`,
        "success"
      );
    } catch (error) {
      setStatus(status, error instanceof Error ? error.message : "Dosya arşivlenemedi.", "error");
    }
  };

  input.addEventListener("change", () => {
    const file = input.files?.item(0) ?? null;
    input.value = "";
    if (file !== null) {
      void ingestFile(file);
    }
  });

  intake.addEventListener("dragenter", (event) => {
    if (event.dataTransfer?.types.includes("Files") !== true) {
      return;
    }
    event.preventDefault();
    intake.dataset["patternArchiveFileDropActive"] = "true";
    setStatus(status, "Dosyayı bırak; uygulama arşivine kopyalanacak.", "pending");
  });

  intake.addEventListener("dragover", (event) => {
    if (event.dataTransfer?.types.includes("Files") !== true) {
      return;
    }
    event.preventDefault();
    event.dataTransfer.dropEffect = "copy";
    intake.dataset["patternArchiveFileDropActive"] = "true";
  });

  intake.addEventListener("dragleave", () => {
    intake.dataset["patternArchiveFileDropActive"] = "false";
  });

  intake.addEventListener("drop", (event) => {
    if (event.dataTransfer?.types.includes("Files") !== true) {
      return;
    }
    event.preventDefault();
    intake.dataset["patternArchiveFileDropActive"] = "false";
    const file = event.dataTransfer.files.item(0);
    if (file !== null) {
      void ingestFile(file);
    }
  });

  intake.append(heading, pickButton, status, input, list);
  const longTextDisclosure = workbench.querySelector<HTMLElement>(
    "[data-pattern-long-text-source-disclosure='true']"
  );
  if (longTextDisclosure === null) {
    workbench.append(intake);
  } else {
    workbench.insertBefore(intake, longTextDisclosure);
  }
  panel.dataset["patternArchiveFileIntakeEnhanced"] = "true";

  if (api !== null) {
    void refreshArchiveFiles(panel, data, api, list, status);
  }
}
