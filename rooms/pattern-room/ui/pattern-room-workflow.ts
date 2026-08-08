type WorkflowViewId = "board" | "archive" | "report";

type WorkspaceCounts = {
  readonly source: number;
  readonly evidence: number;
  readonly board: number;
  readonly connection: number;
};

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
  return document.querySelector<HTMLButtonElement>(
    "[data-pattern-workspace-inspector-toggle='true']"
  );
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

function openWorkspaceView(viewId: WorkflowViewId): void {
  document
    .querySelector<HTMLButtonElement>(`[data-pattern-workspace-nav="${viewId}"]`)
    ?.click();
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

  const toolbarSelector = `[data-${TOOLBAR_MARKER.replace(
    /[A-Z]/g,
    (letter) => `-${letter.toLowerCase()}`
  )}]`;
  if (header.querySelector(toolbarSelector) !== null) {
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
  const focusButton = document.querySelector<HTMLButtonElement>(
    "[data-pattern-flow-focus='true']"
  );
  const detailButton = document.querySelector<HTMLButtonElement>(
    "[data-pattern-flow-detail='true']"
  );
  const reviewButton = document.querySelector<HTMLButtonElement>(
    "[data-pattern-flow-review='true']"
  );
  const evidenceButton = document.querySelector<HTMLButtonElement>(
    "[data-pattern-flow-evidence='true']"
  );

  if (focusButton !== null) {
    const focused = isFocusMode();
    focusButton.dataset["patternFlowActive"] = focused ? "true" : "false";
    const label = focusButton.firstChild;
    if (label !== null) {
      label.textContent = focused ? "Odaktan çık" : "Odak";
    }
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
  if (isFocusMode() || getActiveNavigationId() !== "board") {
    return;
  }

  const hasSelection =
    document.querySelector("[data-pattern-board-pin-selected='true']") !== null ||
    document.querySelector("[data-pattern-board-connection-selected='true']") !== null;
  if (hasSelection) {
    setInspectorOpen(true);
  }
}

function activateApplyTray(root: HTMLElement): void {
  const applyTab = root.querySelector<HTMLButtonElement>(
    '[data-pattern-analysis-workbench-tab="apply"]'
  );
  applyTab?.click();
  applyTab?.focus();
}

function resolveReviewState(root: HTMLElement): string {
  return (
    root.querySelector<HTMLElement>("[data-pattern-case-review-state]")?.dataset[
      "patternCaseReviewState"
    ] ?? "idle"
  );
}

function hasAppliedReview(root: HTMLElement): boolean {
  return (
    resolveReviewState(root) === "applied" ||
    root.querySelector<HTMLElement>('[data-pattern-case-review-apply-feedback="success"]') !== null
  );
}

function createReviewHandoffButton(
  label: string,
  tone: "primary" | "quiet" = "quiet"
): HTMLButtonElement {
  const button = document.createElement("button");
  button.type = "button";
  button.className = `pattern-room-review-handoff-action ${tone}`;
  button.textContent = label;
  return button;
}

function createReviewHandoffShell(
  eyebrow: string,
  title: string,
  detail: string
): { readonly shell: HTMLElement; readonly actions: HTMLElement } {
  const shell = document.createElement("section");
  shell.className = "pattern-room-review-handoff";
  shell.dataset["patternReviewHandoff"] = "true";

  const copy = document.createElement("div");
  copy.className = "pattern-room-review-handoff-copy";
  const kicker = document.createElement("span");
  kicker.className = "pattern-room-kicker";
  kicker.textContent = eyebrow;
  const heading = document.createElement("strong");
  heading.textContent = title;
  const text = document.createElement("small");
  text.textContent = detail;
  copy.append(kicker, heading, text);

  const actions = document.createElement("div");
  actions.className = "pattern-room-review-handoff-actions";
  shell.append(copy, actions);
  return { shell, actions };
}

function createAiHandoff(reviewSurface: HTMLElement): HTMLElement {
  const state = resolveReviewState(reviewSurface);
  const applied = hasAppliedReview(reviewSurface);
  const ready = state === "ready";
  const handoff = createReviewHandoffShell(
    "Devam hattı",
    applied ? "İnceleme vakaya işlendi" : ready ? "Sonuç hazır, karar sende" : "Bulgular masada",
    applied
      ? "Yeni notları panoda doğrula veya vaka dosyasına geç."
      : ready
        ? "Uygulanacak bölümü seç; hiçbir bulgu onaysız vakaya eklenmez."
        : "AI çıktısını panoda, arşivde veya vaka dosyasında takip edebilirsin."
  );
  handoff.shell.dataset["patternReviewHandoffKind"] = "ai";
  handoff.shell.dataset["patternReviewHandoffState"] = applied ? "applied" : state;
  handoff.shell.dataset["patternReviewHandoffSignature"] = applied ? "applied" : state;

  if (ready && !applied) {
    const apply = createReviewHandoffButton("Uygulama tepsisini aç", "primary");
    apply.addEventListener("click", () => activateApplyTray(reviewSurface));
    handoff.actions.append(apply);
  }

  const board = createReviewHandoffButton(
    applied ? "Panoda sonucu kontrol et" : "Panoyu aç",
    applied ? "primary" : "quiet"
  );
  board.addEventListener("click", () => openWorkspaceView("board"));
  const archive = createReviewHandoffButton("Arşive dön");
  archive.addEventListener("click", () => openWorkspaceView("archive"));
  const report = createReviewHandoffButton("Vaka dosyasını aç");
  report.addEventListener("click", () => openWorkspaceView("report"));
  handoff.actions.append(board, archive, report);
  return handoff.shell;
}

function createLocalHandoff(device: HTMLElement): HTMLElement {
  const reflect = device.querySelector<HTMLButtonElement>("[data-pattern-reflect-debate='true']");
  const phaseCompleted = reflect !== null;
  const referenceCount = device.querySelectorAll("[data-pattern-debate-reference]").length;
  const handoff = createReviewHandoffShell(
    "Devam hattı",
    phaseCompleted ? "Karşıt oturum tamamlandı" : "Karşıt inceleme masası",
    phaseCompleted
      ? "Oturum özetini dosyaya yansıt veya panoda karşılaştırmaya devam et."
      : referenceCount > 0
        ? `${String(referenceCount)} referans masada; gerekirse pano veya arşive dön.`
        : "Referansları pano ve arşivden topla; oturum hazır olduğunda burada devam et."
  );
  handoff.shell.dataset["patternReviewHandoffKind"] = "local";
  handoff.shell.dataset["patternReviewHandoffState"] = phaseCompleted ? "completed" : "working";
  handoff.shell.dataset["patternReviewHandoffSignature"] = `${
    phaseCompleted ? "completed" : "working"
  }:${String(referenceCount)}`;

  if (reflect !== null) {
    const reflectAndOpen = createReviewHandoffButton("Rapora yansıt ve aç", "primary");
    reflectAndOpen.addEventListener("click", () => {
      reflect.click();
      window.setTimeout(() => openWorkspaceView("report"), 0);
    });
    handoff.actions.append(reflectAndOpen);
  }

  const board = createReviewHandoffButton("Panoya dön", phaseCompleted ? "quiet" : "primary");
  board.addEventListener("click", () => openWorkspaceView("board"));
  const archive = createReviewHandoffButton("Arşivi aç");
  archive.addEventListener("click", () => openWorkspaceView("archive"));
  const report = createReviewHandoffButton("Raporu aç");
  report.addEventListener("click", () => openWorkspaceView("report"));
  handoff.actions.append(board, archive, report);
  return handoff.shell;
}

function enhanceReviewHandoffs(): void {
  const panel = document.querySelector<HTMLElement>(".pattern-room-review-panel");
  if (panel === null) {
    return;
  }

  const reviewSurface = panel.querySelector<HTMLElement>(
    '[data-pattern-review-task-surface="ai-review"]'
  );
  if (reviewSurface !== null) {
    const resultExists =
      reviewSurface.querySelector("[data-pattern-case-review-result='true']") !== null;
    const current = reviewSurface.querySelector<HTMLElement>(
      '[data-pattern-review-handoff-kind="ai"]'
    );
    if (!resultExists) {
      current?.remove();
    } else {
      const expectedSignature = hasAppliedReview(reviewSurface)
        ? "applied"
        : resolveReviewState(reviewSurface);
      if (current?.dataset["patternReviewHandoffSignature"] !== expectedSignature) {
        current?.remove();
        reviewSurface.append(createAiHandoff(reviewSurface));
      }
    }
  }

  const localSurface = panel.querySelector<HTMLElement>(
    '.pattern-room-device[data-pattern-review-task-surface="tenth-man"]'
  );
  if (localSurface !== null) {
    const phaseCompleted =
      localSurface.querySelector<HTMLButtonElement>("[data-pattern-reflect-debate='true']") !== null;
    const referenceCount = localSurface.querySelectorAll("[data-pattern-debate-reference]").length;
    const expectedSignature = `${phaseCompleted ? "completed" : "working"}:${String(
      referenceCount
    )}`;
    const current = localSurface.querySelector<HTMLElement>(
      '[data-pattern-review-handoff-kind="local"]'
    );
    if (current?.dataset["patternReviewHandoffSignature"] !== expectedSignature) {
      current?.remove();
      localSurface.append(createLocalHandoff(localSurface));
    }
  }
}

function readCount(text: string | null | undefined): number {
  const match = text?.match(/\d+/);
  return match === null || match === undefined ? 0 : Number(match[0]);
}

function readWorkspaceCounts(): WorkspaceCounts {
  const metrics = Array.from(
    document.querySelectorAll<HTMLElement>(".pattern-room-workspace-case-metrics > span")
  );
  return {
    source: readCount(metrics[0]?.textContent),
    evidence: readCount(metrics[1]?.textContent),
    board: readCount(metrics[2]?.textContent),
    connection: readCount(metrics[3]?.textContent),
  };
}

function triggerPreview(): void {
  document
    .querySelector<HTMLButtonElement>("[data-pattern-case-review-preview-prepare='true']")
    ?.click();
}

function createPrepMetric(label: string, value: number, ready: boolean): HTMLElement {
  const metric = document.createElement("article");
  metric.className = "pattern-room-review-prep-metric";
  metric.dataset["patternReviewPrepReady"] = ready ? "true" : "false";

  const valueElement = document.createElement("strong");
  valueElement.textContent = String(value);
  const labelElement = document.createElement("span");
  labelElement.textContent = label;
  metric.append(valueElement, labelElement);
  return metric;
}

function createPrepStep(
  index: string,
  label: string,
  detail: string,
  ready: boolean
): HTMLElement {
  const step = document.createElement("article");
  step.className = "pattern-room-review-prep-step";
  step.dataset["patternReviewPrepReady"] = ready ? "true" : "false";

  const number = document.createElement("span");
  number.className = "pattern-room-review-prep-step-index";
  number.textContent = index;
  const copy = document.createElement("div");
  const title = document.createElement("strong");
  title.textContent = label;
  const text = document.createElement("small");
  text.textContent = detail;
  copy.append(title, text);
  const state = document.createElement("span");
  state.className = "pattern-room-review-prep-step-state";
  state.textContent = ready ? "HAZIR" : "EKSİK";
  step.append(number, copy, state);
  return step;
}

function createPrepAction(
  label: string,
  primary: boolean,
  onClick: () => void
): HTMLButtonElement {
  const button = document.createElement("button");
  button.type = "button";
  button.className = `pattern-room-review-prep-action${primary ? " primary" : ""}`;
  button.textContent = label;
  button.addEventListener("click", onClick);
  return button;
}

function createPreparationDesk(counts: WorkspaceCounts): HTMLElement {
  const hasSources = counts.source > 0;
  const hasEvidence = counts.evidence > 0;
  const hasBoard = counts.board > 0;
  const hasConnections = counts.connection > 0;
  const readyEnough = hasSources && hasBoard;

  const desk = document.createElement("section");
  desk.className = "pattern-room-review-prep-desk";
  desk.dataset["patternReviewPrepDesk"] = "true";

  const heading = document.createElement("div");
  heading.className = "pattern-room-review-prep-heading";
  const kicker = document.createElement("span");
  kicker.className = "pattern-room-kicker";
  kicker.textContent = "CASE PACKET HAZIRLIĞI";
  const title = document.createElement("strong");
  title.textContent = readyEnough ? "Vaka zemini hazır" : "İnceleme öncesi zemini tamamla";
  const intro = document.createElement("p");
  intro.textContent = readyEnough
    ? "Kaynak ve pano izleri mevcut. Önizlemeyi üretip AI'ya gidecek paketi son kez kontrol edebilirsin."
    : "AI'ya boş bir dosya göndermek yerine önce kaynak, pano izi ve mümkünse kanıt zemini oluştur.";
  heading.append(kicker, title, intro);

  const metrics = document.createElement("div");
  metrics.className = "pattern-room-review-prep-metrics";
  metrics.append(
    createPrepMetric("Kaynak", counts.source, hasSources),
    createPrepMetric("Kanıt", counts.evidence, hasEvidence),
    createPrepMetric("Pano izi", counts.board, hasBoard),
    createPrepMetric("Bağlantı", counts.connection, hasConnections)
  );

  const steps = document.createElement("div");
  steps.className = "pattern-room-review-prep-steps";
  steps.append(
    createPrepStep(
      "01",
      "Vaka zemini",
      hasSources ? `${String(counts.source)} kaynak dosyada.` : "Arşive en az bir kaynak ekle.",
      hasSources
    ),
    createPrepStep(
      "02",
      "Kanıt ve izler",
      hasEvidence
        ? `${String(counts.evidence)} kanıt ile ${String(counts.board)} pano izi hazır.`
        : hasBoard
          ? `${String(counts.board)} pano izi var; kaynaklardan kanıt çıkarmak incelemeyi güçlendirir.`
          : "Panoya iddia, gözlem veya soru ekle.",
      hasBoard
    ),
    createPrepStep(
      "03",
      "İlişki ağı",
      hasConnections
        ? `${String(counts.connection)} ilişki Case Packet bağlamına eşlik ediyor.`
        : "Zorunlu değil; fakat ilişkiler AI'nın karşılaştırma bağlamını güçlendirir.",
      hasConnections
    )
  );

  const actions = document.createElement("div");
  actions.className = "pattern-room-review-prep-actions";
  if (!hasSources || !hasEvidence) {
    actions.append(
      createPrepAction(hasSources ? "Arşivden kanıt çıkar" : "Arşive kaynak ekle", false, () => {
        openWorkspaceView("archive");
      })
    );
  }
  if (!hasBoard) {
    actions.append(
      createPrepAction("Panoda iz oluştur", false, () => {
        openWorkspaceView("board");
      })
    );
  }
  actions.append(
    createPrepAction("Önizlemeyi hazırla", readyEnough, () => {
      triggerPreview();
    })
  );

  desk.append(heading, metrics, steps, actions);
  return desk;
}

function enhanceReviewPreparation(): void {
  const reviewSurface = document.querySelector<HTMLElement>(
    '[data-pattern-review-task-surface="ai-review"]'
  );
  if (
    reviewSurface === null ||
    reviewSurface.querySelector("[data-pattern-case-review-result='true']") !== null
  ) {
    return;
  }

  const parsed = reviewSurface.querySelector<HTMLElement>(
    ".pattern-room-analysis-findings > .pattern-room-case-review-parsed"
  );
  if (parsed === null || parsed.querySelector("[data-pattern-review-prep-desk='true']") !== null) {
    return;
  }

  const findingsHeader = reviewSurface.querySelector<HTMLElement>(
    ".pattern-room-analysis-findings-header"
  );
  const headerTitle = findingsHeader?.querySelector<HTMLElement>("strong");
  const headerDetail = findingsHeader?.querySelector<HTMLElement>("small");
  if (headerTitle !== null && headerTitle !== undefined) {
    headerTitle.textContent = "İnceleme hazırlığı";
  }
  if (headerDetail !== null && headerDetail !== undefined) {
    headerDetail.textContent = "Sonuç gelmeden önce Case Packet zeminini burada kontrol et.";
  }

  parsed.replaceChildren(createPreparationDesk(readWorkspaceCounts()));
}

function enhanceWorkspace(): void {
  syncViewEntry();
  ensureFlowTools();
  syncSelectionDrivenInspector();
  syncFlowTools();
  enhanceReviewPreparation();
  enhanceReviewHandoffs();
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
    enhanceWorkspace();
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
      "data-pattern-case-review-state",
      "data-pattern-case-review-apply-feedback",
    ],
  });
}

enhanceWorkspace();
