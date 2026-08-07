type QuickCaptureMode = "note" | "question" | "evidence" | "source";

type QuickCapturePayload = {
  readonly mode: QuickCaptureMode;
  readonly title: string;
  readonly body: string;
  readonly origin: string;
};

type QuickCaptureOption = {
  readonly id: QuickCaptureMode;
  readonly label: string;
  readonly titlePlaceholder: string;
  readonly bodyPlaceholder: string;
  readonly submitLabel: string;
};

const CAPTURE_EVENT_NAME = "pattern-room:quick-capture";
const QUICK_CAPTURE_OPTIONS: readonly QuickCaptureOption[] = [
  {
    id: "note",
    label: "Saha notu",
    titlePlaceholder: "Not başlığı",
    bodyPlaceholder: "Gözlem, yorum veya yeni bir iz yaz…",
    submitLabel: "Panoya iliştir",
  },
  {
    id: "question",
    label: "Açık soru",
    titlePlaceholder: "Sorunun kısa başlığı",
    bodyPlaceholder: "Doğrulanması veya cevaplanması gereken noktayı yaz…",
    submitLabel: "Soru olarak iliştir",
  },
  {
    id: "evidence",
    label: "Kanıt fişi",
    titlePlaceholder: "Kanıt başlığı",
    bodyPlaceholder: "Alıntı, gözlem veya kanıt niteliğindeki pasajı yaz…",
    submitLabel: "Kanıt fişi oluştur",
  },
  {
    id: "source",
    label: "Kaynak",
    titlePlaceholder: "Kaynak / dosya adı",
    bodyPlaceholder: "Kaynağın kısa özeti veya içerik notunu yaz…",
    submitLabel: "Arşive kaldır",
  },
];

let pendingCapture: QuickCapturePayload | null = null;

function createElement<K extends keyof HTMLElementTagNameMap>(
  tagName: K,
  className?: string,
  text?: string
): HTMLElementTagNameMap[K] {
  const element = document.createElement(tagName);
  if (className !== undefined) {
    element.className = className;
  }
  if (text !== undefined) {
    element.textContent = text;
  }
  return element;
}

function getFallbackTitle(mode: QuickCaptureMode): string {
  switch (mode) {
    case "question":
      return "Yeni açık soru";
    case "evidence":
      return "Yeni kanıt";
    case "source":
      return "Yeni kaynak";
    case "note":
      return "Yeni saha notu";
  }
}

function navigateForCapture(mode: QuickCaptureMode): void {
  const navId = mode === "source" ? "archive" : "board";
  const navigation = document.querySelector<HTMLButtonElement>(
    `[data-pattern-workspace-nav="${navId}"]`
  );
  navigation?.click();
}

function submitBoardCapture(capture: QuickCapturePayload): boolean {
  if (capture.mode === "evidence") {
    const form = document.querySelector<HTMLFormElement>(
      '[data-pattern-author-evidence-form="true"]'
    );
    const label = document.querySelector<HTMLInputElement>(
      '[data-pattern-author-evidence-label="true"]'
    );
    const excerpt = document.querySelector<HTMLTextAreaElement>(
      '[data-pattern-author-evidence-excerpt="true"]'
    );
    const interpretation = document.querySelector<HTMLTextAreaElement>(
      '[data-pattern-author-evidence-interpretation="true"]'
    );
    if (form === null || label === null || excerpt === null) {
      return false;
    }
    label.value = capture.title;
    excerpt.value = capture.body;
    if (interpretation !== null) {
      interpretation.value = "Vaka Merkezi hızlı kayıt";
    }
    form.requestSubmit();
    return true;
  }

  const form = document.querySelector<HTMLFormElement>('[data-pattern-author-node-form="true"]');
  const nodeType = document.querySelector<HTMLSelectElement>(
    '[data-pattern-author-node-type="true"]'
  );
  const label = document.querySelector<HTMLInputElement>('[data-pattern-author-node-label="true"]');
  const content = document.querySelector<HTMLTextAreaElement>(
    '[data-pattern-author-node-content="true"]'
  );
  if (form === null || nodeType === null || label === null || content === null) {
    return false;
  }

  nodeType.value = capture.mode === "question" ? "uncertainty" : "inspiration";
  label.value = capture.title;
  content.value = capture.body;
  form.requestSubmit();
  return true;
}

function submitSourceCapture(capture: QuickCapturePayload): boolean {
  const form = document.querySelector<HTMLFormElement>('[data-pattern-author-source-form="true"]');
  const label = document.querySelector<HTMLInputElement>(
    '[data-pattern-author-source-label="true"]'
  );
  const origin = document.querySelector<HTMLInputElement>(
    '[data-pattern-author-source-origin="true"]'
  );
  const note = document.querySelector<HTMLTextAreaElement>('[data-pattern-author-source-note="true"]');
  if (form === null || label === null || origin === null || note === null) {
    return false;
  }

  label.value = capture.title;
  origin.value = capture.origin === "" ? "Vaka Merkezi hızlı kayıt" : capture.origin;
  note.value = capture.body;
  form.requestSubmit();
  return true;
}

function tryApplyPendingCapture(): void {
  if (pendingCapture === null) {
    return;
  }
  const capture = pendingCapture;
  const applied =
    capture.mode === "source" ? submitSourceCapture(capture) : submitBoardCapture(capture);
  if (applied) {
    pendingCapture = null;
  }
}

function routeCapture(capture: QuickCapturePayload): void {
  pendingCapture = capture;
  navigateForCapture(capture.mode);
  window.setTimeout(tryApplyPendingCapture, 0);
}

function createQuickCaptureTray(): HTMLElement {
  const desk = createElement("section", "pattern-room-command-capture");
  desk.dataset["patternCommandCapture"] = "true";

  const heading = createElement("div", "pattern-room-command-capture-heading");
  const kicker = createElement("span", "pattern-room-kicker", "Hızlı kayıt");
  const title = createElement("strong", undefined, "Aklındaki izi odadan çıkmadan yakala");
  const description = createElement(
    "small",
    undefined,
    "Kayıt ilgili çalışma yüzeyine taşınır ve normal vaka akışıyla kaydedilir."
  );
  heading.append(kicker, title, description);

  const modes = createElement("div", "pattern-room-command-capture-modes");
  const form = createElement("form", "pattern-room-command-capture-form");
  const titleInput = createElement("input", "pattern-room-inline-input");
  titleInput.type = "text";
  titleInput.autocomplete = "off";
  titleInput.maxLength = 120;

  const bodyInput = createElement("textarea", "pattern-room-inline-input");
  bodyInput.rows = 2;
  bodyInput.maxLength = 1400;

  const originInput = createElement("input", "pattern-room-inline-input");
  originInput.type = "text";
  originInput.autocomplete = "off";
  originInput.placeholder = "Kaynak kökeni / adres / dosya bilgisi (opsiyonel)";
  originInput.dataset["patternCommandCaptureOrigin"] = "true";

  const submit = createElement("button", "pattern-room-command-capture-submit");
  submit.type = "submit";
  const status = createElement("span", "pattern-room-command-capture-status");
  status.ariaLive = "polite";

  let activeMode: QuickCaptureMode = "note";
  const modeButtons = new Map<QuickCaptureMode, HTMLButtonElement>();

  const updateMode = (mode: QuickCaptureMode): void => {
    activeMode = mode;
    const option = QUICK_CAPTURE_OPTIONS.find((candidate) => candidate.id === mode);
    if (option === undefined) {
      return;
    }
    modeButtons.forEach((button, id) => {
      const active = id === mode;
      button.dataset["patternCommandCaptureActive"] = active ? "true" : "false";
      button.ariaPressed = active ? "true" : "false";
    });
    titleInput.placeholder = option.titlePlaceholder;
    bodyInput.placeholder = option.bodyPlaceholder;
    submit.textContent = option.submitLabel;
    originInput.hidden = mode !== "source";
    status.textContent = "";
  };

  QUICK_CAPTURE_OPTIONS.forEach((option) => {
    const button = createElement("button", "pattern-room-command-capture-mode", option.label);
    button.type = "button";
    button.dataset["patternCommandCaptureMode"] = option.id;
    button.addEventListener("click", () => {
      updateMode(option.id);
      titleInput.focus();
    });
    modeButtons.set(option.id, button);
    modes.append(button);
  });

  form.addEventListener("submit", (event) => {
    event.preventDefault();
    const body = bodyInput.value.trim();
    if (body === "") {
      status.textContent = "Önce kısa bir içerik yaz.";
      bodyInput.focus();
      return;
    }

    const capture: QuickCapturePayload = {
      mode: activeMode,
      title: titleInput.value.trim() || getFallbackTitle(activeMode),
      body,
      origin: originInput.value.trim(),
    };
    window.dispatchEvent(new CustomEvent<QuickCapturePayload>(CAPTURE_EVENT_NAME, { detail: capture }));
  });

  form.append(titleInput, bodyInput, originInput, submit, status);
  desk.append(heading, modes, form);
  updateMode(activeMode);
  return desk;
}

function enhanceCommandRoom(): void {
  const commandRoom = document.querySelector<HTMLElement>(".pattern-room-command-room");
  if (commandRoom === null || commandRoom.querySelector("[data-pattern-command-capture]") !== null) {
    return;
  }
  const commandDesk = commandRoom.querySelector<HTMLElement>(".pattern-room-command-desk");
  const tray = createQuickCaptureTray();
  if (commandDesk === null) {
    commandRoom.prepend(tray);
    return;
  }
  commandDesk.insertAdjacentElement("afterend", tray);
}

window.addEventListener(CAPTURE_EVENT_NAME, (event) => {
  const customEvent = event as CustomEvent<QuickCapturePayload>;
  routeCapture(customEvent.detail);
});

const observer = new MutationObserver(() => {
  enhanceCommandRoom();
  tryApplyPendingCapture();
});

const appRoot = document.querySelector("#app");
if (appRoot !== null) {
  observer.observe(appRoot, { childList: true, subtree: true });
}

enhanceCommandRoom();
