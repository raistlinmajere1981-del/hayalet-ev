const EDGE_LABELS: Readonly<Record<string, string>> = {
  supports: "destekliyor",
  contradicts: "çelişiyor",
  references: "referans",
  derived_from: "türetildi",
  inspired_by: "ilham aldı",
  questions: "sorguluyor",
  needs_review: "incele",
};

function isTypingTarget(target: EventTarget | null): boolean {
  return (
    target instanceof HTMLInputElement ||
    target instanceof HTMLTextAreaElement ||
    target instanceof HTMLSelectElement ||
    (target instanceof HTMLElement && target.isContentEditable)
  );
}

function setDraftGeometry(
  draft: HTMLElement,
  sourceX: number,
  sourceY: number,
  targetX: number,
  targetY: number
): void {
  const deltaX = targetX - sourceX;
  const deltaY = targetY - sourceY;
  const length = Math.max(Math.hypot(deltaX, deltaY), 18);
  const angle = (Math.atan2(deltaY, deltaX) * 180) / Math.PI;
  draft.setAttribute(
    "style",
    `left:${String(sourceX)}px;top:${String(sourceY)}px;width:${String(length)}px;transform:rotate(${String(
      angle
    )}deg);`
  );
}

function enhanceBoard(board: HTMLElement): void {
  if (board.dataset["patternBoardV10Enhanced"] === "true") {
    return;
  }

  const scene = board.querySelector<HTMLElement>(".pattern-room-detective-board-scene");
  const stringLayer = board.querySelector<HTMLElement>(".pattern-room-board-string-layer");
  const viewport = board.querySelector<HTMLElement>(".pattern-room-detective-board-viewport");
  const connectButton = board.querySelector<HTMLButtonElement>("[data-pattern-board-connect-mode]");
  if (scene === null || stringLayer === null || viewport === null || connectButton === null) {
    return;
  }

  board.dataset["patternBoardV10Enhanced"] = "true";

  const cards = (): HTMLButtonElement[] => [
    ...board.querySelectorAll<HTMLButtonElement>("[data-pattern-board-pin]"),
  ];

  const strings = (): HTMLButtonElement[] => [
    ...board.querySelectorAll<HTMLButtonElement>("[data-pattern-board-connection]"),
  ];

  strings().forEach((string) => {
    if (string.querySelector(".pattern-room-board-string-label") !== null) {
      return;
    }
    const type = string.dataset["patternBoardConnectionType"] ?? "";
    const label = document.createElement("span");
    label.className = "pattern-room-board-string-label";
    label.textContent = EDGE_LABELS[type] ?? type;
    string.append(label);
  });

  cards().forEach((card) => {
    if (card.querySelector(".pattern-room-detective-note-eyelet") === null) {
      const eyelet = document.createElement("span");
      eyelet.className = "pattern-room-detective-note-eyelet";
      eyelet.ariaHidden = "true";
      card.append(eyelet);
    }

    card.addEventListener("pointerdown", () => {
      cards().forEach((candidate) => {
        candidate.dataset["patternBoardFront"] = candidate === card ? "true" : "false";
      });
    });
  });

  const draft = document.createElement("span");
  draft.className = "pattern-room-board-string-draft";
  draft.hidden = true;
  draft.append(document.createElement("i"));
  stringLayer.append(draft);

  const modeBadge = document.createElement("div");
  modeBadge.className = "pattern-room-board-mode-badge";
  modeBadge.hidden = true;
  modeBadge.append(document.createElement("i"), document.createElement("span"));
  scene.append(modeBadge);

  const syncMode = (): void => {
    const connectionMode = connectButton.dataset["patternBoardConnectMode"] === "true";
    const source = board.querySelector<HTMLButtonElement>(
      "[data-pattern-board-connection-source='true']"
    );
    const badgeCopy = modeBadge.querySelector<HTMLElement>("span");

    board.dataset["patternBoardThreadMode"] = connectionMode ? "true" : "false";
    modeBadge.hidden = !connectionMode;
    if (badgeCopy !== null) {
      badgeCopy.textContent = source === null ? "İp modu · başlangıç kartını seç" : "İp modu · hedef kartı seç";
    }

    cards().forEach((card) => {
      card.dataset["patternBoardTargetCandidate"] =
        connectionMode && source !== null && card !== source ? "true" : "false";
    });

    if (!connectionMode || source === null) {
      draft.hidden = true;
    }
  };

  const observer = new MutationObserver(syncMode);
  observer.observe(board, {
    subtree: true,
    attributes: true,
    attributeFilter: [
      "data-pattern-board-connect-mode",
      "data-pattern-board-connection-source",
    ],
  });

  scene.addEventListener("pointermove", (event) => {
    if (connectButton.dataset["patternBoardConnectMode"] !== "true") {
      draft.hidden = true;
      return;
    }
    const source = board.querySelector<HTMLButtonElement>(
      "[data-pattern-board-connection-source='true']"
    );
    if (source === null) {
      draft.hidden = true;
      return;
    }

    const sceneRect = scene.getBoundingClientRect();
    const sourceX = source.offsetLeft + source.offsetWidth / 2;
    const sourceY = source.offsetTop + source.offsetHeight / 2;
    const targetX = Math.min(Math.max(0, event.clientX - sceneRect.left), scene.offsetWidth);
    const targetY = Math.min(Math.max(0, event.clientY - sceneRect.top), scene.offsetHeight);
    setDraftGeometry(draft, sourceX, sourceY, targetX, targetY);
    draft.hidden = false;
  });

  scene.addEventListener("pointerleave", () => {
    draft.hidden = true;
  });

  viewport.addEventListener("keydown", (event) => {
    if (isTypingTarget(event.target)) {
      return;
    }
    if (event.key.toLocaleLowerCase("tr") === "c") {
      event.preventDefault();
      connectButton.click();
    }
  });

  syncMode();
}

function enhanceBoards(root: ParentNode): void {
  root.querySelectorAll<HTMLElement>(".pattern-room-detective-board").forEach(enhanceBoard);
}

function installBoardEnhancements(): void {
  const app = document.getElementById("app");
  if (app === null) {
    window.setTimeout(installBoardEnhancements, 0);
    return;
  }

  let scheduled = false;
  const run = (): void => {
    scheduled = false;
    enhanceBoards(app);
  };
  const schedule = (): void => {
    if (scheduled) {
      return;
    }
    scheduled = true;
    queueMicrotask(run);
  };

  const observer = new MutationObserver(schedule);
  observer.observe(app, { childList: true, subtree: true });
  schedule();
}

installBoardEnhancements();
