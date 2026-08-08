const MAX_LOCAL_TEXT_FILE_BYTES = 8 * 1024 * 1024;
const SUPPORTED_LOCAL_TEXT_EXTENSIONS = new Set([
  ".txt",
  ".md",
  ".markdown",
  ".csv",
  ".json",
  ".log",
]);

function fileExtension(fileName: string): string {
  const dotIndex = fileName.lastIndexOf(".");
  return dotIndex < 0 ? "" : fileName.slice(dotIndex).toLocaleLowerCase("tr");
}

function fileTitle(fileName: string): string {
  const dotIndex = fileName.lastIndexOf(".");
  const title = (dotIndex <= 0 ? fileName : fileName.slice(0, dotIndex)).trim();
  return title === "" ? "Yerel dosya" : title;
}

function isSupportedTextFile(file: File): boolean {
  if (SUPPORTED_LOCAL_TEXT_EXTENSIONS.has(fileExtension(file.name))) {
    return true;
  }
  return file.type.startsWith("text/") || file.type === "application/json";
}

function hasDraggedFiles(event: DragEvent): boolean {
  return event.dataTransfer?.types.includes("Files") === true;
}

function createFileInput(): HTMLInputElement {
  const input = document.createElement("input");
  input.type = "file";
  input.accept = ".txt,.md,.markdown,.csv,.json,.log,text/plain,text/markdown,text/csv,application/json";
  input.hidden = true;
  input.dataset["patternArchiveFileInput"] = "true";
  return input;
}

function createFileButton(): HTMLButtonElement {
  const button = document.createElement("button");
  button.type = "button";
  button.className = "pattern-room-action-button";
  button.textContent = "Dosyadan al";
  button.dataset["patternArchiveFilePick"] = "true";
  button.title = "TXT, Markdown, CSV, JSON veya LOG dosyasını yerel kaynak olarak ekle";
  return button;
}

export function enhanceArchiveFileIntake(panel: HTMLElement): void {
  if (panel.dataset["patternArchiveFileIntakeEnhanced"] === "true") {
    return;
  }

  const workbench = panel.querySelector<HTMLElement>("[data-pattern-source-workbench-demo='true']");
  const longTextForm = panel.querySelector<HTMLFormElement>("[data-pattern-long-text-source-form='true']");
  const title = longTextForm?.querySelector<HTMLInputElement>(
    "[data-pattern-long-text-source-title='true']"
  );
  const origin = longTextForm?.querySelector<HTMLInputElement>(
    "[data-pattern-long-text-source-origin='true']"
  );
  const kind = longTextForm?.querySelector<HTMLSelectElement>(
    "[data-pattern-long-text-source-kind='true']"
  );
  const text = longTextForm?.querySelector<HTMLTextAreaElement>(
    "[data-pattern-long-text-source-text='true']"
  );
  if (
    workbench === null ||
    longTextForm === null ||
    title === null ||
    origin === null ||
    kind === null ||
    text === null
  ) {
    return;
  }

  const intake = document.createElement("div");
  intake.className = "pattern-room-source-workbench-example";
  intake.dataset["patternArchiveFileIntake"] = "true";
  intake.dataset["patternArchiveFileDropActive"] = "false";
  intake.ariaLabel = "Yerel metin dosyası kabul alanı";

  const button = createFileButton();
  const input = createFileInput();
  const status = document.createElement("p");
  status.className = "pattern-room-source-workbench-status";
  status.dataset["patternArchiveFileStatus"] = "true";
  status.ariaLive = "polite";
  status.textContent = "Dosya seç veya TXT, Markdown, CSV, JSON ya da LOG dosyasını buraya bırak.";

  const ingestFile = async (file: File): Promise<void> => {
    if (!isSupportedTextFile(file)) {
      status.textContent = "Bu dosya türü desteklenmiyor. TXT, Markdown, CSV, JSON veya LOG kullan.";
      return;
    }
    if (file.size > MAX_LOCAL_TEXT_FILE_BYTES) {
      status.textContent = "Dosya 8 MB sınırını aşıyor. Büyük belgeleri bölümleyerek ekle.";
      return;
    }

    status.textContent = `${file.name} okunuyor…`;
    try {
      const fileText = await file.text();
      if (fileText.trim() === "") {
        status.textContent = "Dosya boş; arşive eklenmedi.";
        return;
      }

      title.value = fileTitle(file.name);
      origin.value = `Yerel dosya · ${file.name}`;
      kind.value = "archive_text";
      text.value = fileText;

      const disclosure = longTextForm.closest<HTMLDetailsElement>("details");
      if (disclosure !== null) {
        disclosure.open = true;
      }

      status.textContent = `${file.name} kaynak akışına aktarılıyor…`;
      longTextForm.requestSubmit();
    } catch (error) {
      console.warn("Pattern Room local file intake failed.", error);
      status.textContent = "Dosya okunamadı. Dosyanın yerel metin biçiminde olduğunu kontrol et.";
    }
  };

  button.addEventListener("click", () => {
    input.click();
  });

  input.addEventListener("change", () => {
    const file = input.files?.item(0) ?? null;
    input.value = "";
    if (file !== null) {
      void ingestFile(file);
    }
  });

  intake.addEventListener("dragenter", (event) => {
    if (!hasDraggedFiles(event)) {
      return;
    }
    event.preventDefault();
    intake.dataset["patternArchiveFileDropActive"] = "true";
    status.textContent = "Dosyayı bırak; içerik yalnızca bu cihazda okunacak.";
  });

  intake.addEventListener("dragover", (event) => {
    if (!hasDraggedFiles(event)) {
      return;
    }
    event.preventDefault();
    if (event.dataTransfer !== null) {
      event.dataTransfer.dropEffect = "copy";
    }
    intake.dataset["patternArchiveFileDropActive"] = "true";
  });

  intake.addEventListener("dragleave", (event) => {
    const nextTarget = event.relatedTarget;
    if (nextTarget instanceof Node && intake.contains(nextTarget)) {
      return;
    }
    intake.dataset["patternArchiveFileDropActive"] = "false";
  });

  intake.addEventListener("drop", (event) => {
    if (!hasDraggedFiles(event)) {
      return;
    }
    event.preventDefault();
    intake.dataset["patternArchiveFileDropActive"] = "false";
    const file = event.dataTransfer?.files.item(0) ?? null;
    if (file !== null) {
      void ingestFile(file);
    }
  });

  intake.append(button, status, input);
  const longTextDisclosure = workbench.querySelector<HTMLElement>(
    "[data-pattern-long-text-source-disclosure='true']"
  );
  if (longTextDisclosure === null) {
    workbench.append(intake);
  } else {
    workbench.insertBefore(intake, longTextDisclosure);
  }
  panel.dataset["patternArchiveFileIntakeEnhanced"] = "true";
}
