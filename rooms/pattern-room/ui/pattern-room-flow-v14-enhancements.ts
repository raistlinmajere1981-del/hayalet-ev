const APP_SELECTOR = "#app";
const SHELL_SELECTOR = "[data-pattern-workspace-shell='true']";
const PANEL_SELECTOR = ".pattern-room-panel[data-pattern-view]";
const HEADER_SELECTOR = ".pattern-room-panel-header";
const TOOLBAR_MARKER = "patternFlowTools";

let lastActiveNavigationId: string | null = null;

function isTypingTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) {
    return false;
  }
  return (
    target.matches("input, textarea, select, [contenteditable='true']") ||
    target.closest("input, textarea, select, [contenteditable='true']") !== null
  );
}

function getShell(): HTMLElement | null {
  return document.querySelector<HTMLElement>(SHELL_SELECTOR);
}

function getActiveNavigationId(): string | null {
  return (
    document.querySelector<HTMLElement>(
      ".pattern-room-workspace-nav-button[data-pattern-workspace-nav-active='true']"
    )?.dataset["patternWorkspaceNav"] ?? null
  );
}

function getInspectorHandle(): HTMLButtonElement | null {
  return document.querySelector<HTMLButtonElement>("[data-pattern-workspace-inspector-toggle='true']");
}

function isInspectorOpen(): boolean {
  return getShell()?.dataset["patternInspectorOpen"] === "true";
}

function setInspectorOpen(open: boolean): void {
  const handle = getInspectorHandle();
  if (handle === null || handle.disabled || isInspectorOpen() === open) {
    return;
  }
  handle.click();
}

function isFocusMode(): boolean {
  return getShell()?.dataset["patternFocusMode"] === "true";
}

function setFocusMode(active: boolean): void {
  const shell = getShell();
  if (shell === null) {
    return;
  }
  shell.dataset["patternFocusMode"] = active ? "true" : "false";
  syncFlowTools();
}

function toggleFocusMode(): void {
  setFocusMode(!isFocusMode());
}

function findSelectedReviewAction(): HTMLButtonElement | null {
  const activeNavigationId = getActiveNavigationId();
  if (activeNavigationId === "archive") {
    return document.querySelector<HTMLButtonElement>(
      ".pattern-room-archive-card[data-pattern-archive-source-selected='true'] [data-pattern-add-source-debate]"
    );
  }

  if (activeNavigationId === "board") {
    return document.querySelector<HTMLButtonElement>(
      ".pattern-room-workspace-inspector-content [data-pattern-add-node-debate], .pattern-room-workspace-inspector-content [data-pattern-add-evidence-debate], .pattern-room-workspace-inspector-content [data-pattern-add-source-debate]"
    );
  }

  return null;
}

function sendSelectedToReview(): void {
  const action = findSelectedReviewAction();
  if (action === null || action.disabled) {
    return;
  }
  action.click();
}

function focusArchiveEvidenceCapture(): void {
  const selectedCard = document.querySelector<HTMLElement>(
    ".pattern-room-archive-card[data-pattern-archive-source-selected='true']"
  );
  const sourceId = selectedCard?.dataset["patternArchiveSource"];
  if (sourceId === undefined) {
    return;
  }

  setInspectorOpen(true);
  window.setTimeout(() => {
    const label = document.querySelector<HTMLInputElement>(
      `[data-pattern-archive-evidence-label='${CSS.escape(sourceId)}']`
    );
    const excerpt = document.querySelector<HTMLTextAreaElement>(
      `[data-pattern-archive-evidence-excerpt='${CSS.escape(sourceId)}']`
    );
    (label ?? excerpt)?.focus();
  }, 0);
}

function createToolButton(label: string, shortcut: string): HTMLButtonElement {
  const button = document.createElement("button");
  button.type = "button";
  button.className = "pattern-room-flow-tool";
  button.append(document.createTextNode(label));
  const key = document.createElement("kbd");
  key.textContent = shortcut;
  button.append(key);
  return button;
}

function ensureFlowTools(): void {
  const panel = document.querySelector<HTMLElement>(PANEL_SELECTOR);
  const header = panel?.querySelector<HTMLElement>(HEADER_SELECTOR);
  if (panel === null || panel === undefined || header === null || header === undefined) {
    return;
  }
  if (header.querySelector(`[data-${TOOLBAR_MARKER.replace(/[A-Z]/g, (letter) => `-${letter.toLowerCase()}`)}]`) !== null) {
    return;
  }

  const tools = document.createElement("div");
  tools.className = "pattern-room-flow-tools";
  tools.dataset[TOOLBAR_MARKER] = "true";

  const focusButton = createToolButton("Odak", "F");
  focusButton.dataset["patternFlowFocus"] = "true";
  focusButton.addEventListener("click", toggleFocusMode);
  tools.append(focusButton);

  const detailButton = createToolButton("Detay", "D");
  detailButton.dataset["patternFlowDetail"] = "true";
  detailButton.addEventListener("click", () => {
    setInspectorOpen(!isInspectorOpen());
  });
  tools.append(detailButton);

  const reviewButton = createToolButton("10. Adam", "T");
  reviewButton.dataset["patternFlowReview"] = "true";
  reviewButton.addEventListener("click", sendSelectedToReview);
  tools.append(reviewButton);

  const evidenceButton = createToolButton("Kanıt", "E");
  evidenceButton.dataset["patternFlowEvidence"] = "true";
  evidenceButton.addEventListener("click", focusArchiveEvidenceCapture);
  tools.append(evidenceButton);

  const backButton = header.querySelector<HTMLElement>("[data-pattern-back='true']");
  if (backButton === null) {
    header.append(tools);
  } else {
    header.insertBefore(tools, backButton);
  }
}

function syncFlowTools(): void {
  const activeNavigationId = getActiveNavigationId();
  const focusButton = document.querySelector<HTMLButtonElement>("[data-pattern-flow-focus='true']");
  const detailButton = document.querySelector<HTMLButtonElement>("[data-pattern-flow-detail='true']");
  const reviewButton = document.querySelector<HTMLButtonElement>("[data-pattern-flow-review='true']");
  const evidenceButton = document.querySelector<HTMLButtonElement>("[data-pattern-flow-evidence='true']");

  if (focusButton !== null) {
    const focused = isFocusMode();
    focusButton.dataset["patternFlowActive"] = focused ? "true" : "false";
    focusButton.firstChild!.textContent = focused ? "Odaktan çık" : "Odak";
    focusButton.title = "Çalışma yüzeyini tam genişlikte aç (F)";
  }

  if (detailButton !== null) {
    const handle = getInspectorHandle();
    detailButton.hidden = handle === null || handle.disabled;
    detailButton.dataset["patternFlowActive"] = isInspectorOpen() ? "true" : "false";
    detailButton.title = "Bağlam çekmecesini aç/kapat (D)";
  }

  if (reviewButton !== null) {
    const reviewAction = findSelectedReviewAction();
    reviewButton.hidden = activeNavigationId !== "board" && activeNavigationId !== "archive";
    reviewButton.disabled = reviewAction === null || reviewAction.disabled;
    reviewButton.title = "Seçili izi 10. Adam incelemesine aktar (T)";
  }

  if (evidenceButton !== null) {
    const hasSelectedSource =
      document.querySelector(
        ".pattern-room-archive-card[data-pattern-archive-source-selected='true']"
      ) !== null;
    evidenceButton.hidden = activeNavigationId !== "archive";
    evidenceButton.disabled = !hasSelectedSource;
    evidenceButton.title = "Seçili kaynaktan kanıt fişi hazırla (E)";
  }
}

function syncViewEntry(): void {
  const nextNavigationId = getActiveNavigationId();
  if (nextNavigationId === null || nextNavigationId === lastActiveNavigationId) {
    return;
  }

  lastActiveNavigationId = nextNavigationId;
  if (nextNavigationId === "overview") {
    setFocusMode(false);
    setInspectorOpen(false);
  } else if (nextNavigationId === "report") {
    setInspectorOpen(false);
  }
}

function syncSelectionDrivenInspector(): void {
  if (isFocusMode()) {
    return;
  }
  const activeNavigationId = getActiveNavigationId();
  if (activeNavigationId !== "board") {
    return;
  }
  const hasSelection =
    document.querySelector("[data-pattern-board-pin-selected='true']") !== null ||
    document.querySelector("[data-pattern-board-connection-selected='true']") !== null;
  if (hasSelection) {
    setInspectorOpen(true);
  }
}

function enhance(): void {
  syncViewEntry();
  ensureFlowTools();
  syncSelectionDrivenInspector();
  syncFlowTools();
}

window.addEventListener(
  "keydown",
  (event) => {
    if (event.defaultPrevented || isTypingTarget(event.target)) {
      return;
    }

    const key = event.key.toLocaleLowerCase("tr");
    if (key === "f" && getActiveNavigationId() !== "overview") {
      event.preventDefault();
      toggleFocusMode();
      return;
    }
    if (key === "d") {
      const handle = getInspectorHandle();
      if (handle !== null && !handle.disabled) {
        event.preventDefault();
        setInspectorOpen(!isInspectorOpen());
      }
      return;
    }
    if (key === "t" && findSelectedReviewAction() !== null) {
      event.preventDefault();
      sendSelectedToReview();
      return;
    }
    if (key === "e" && getActiveNavigationId() === "archive") {
      const selectedSource = document.querySelector(
        ".pattern-room-archive-card[data-pattern-archive-source-selected='true']"
      );
      if (selectedSource !== null) {
        event.preventDefault();
        focusArchiveEvidenceCapture();
      }
      return;
    }
    if (event.key === "Escape" && isFocusMode()) {
      event.preventDefault();
      event.stopImmediatePropagation();
      setFocusMode(false);
    }
  },
  true
);

const appRoot = document.querySelector(APP_SELECTOR);
if (appRoot !== null) {
  const observer = new MutationObserver(() => {
    enhance();
  });
  observer.observe(appRoot, {
    attributes: true,
    childList: true,
    subtree: true,
    attributeFilter: [
      "class",
      "data-pattern-workspace-nav-active",
      "data-pattern-board-pin-selected",
      "data-pattern-board-connection-selected",
      "data-pattern-archive-source-selected",
      "data-pattern-inspector-open",
    ],
  });
}

enhance();