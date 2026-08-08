type ReviewViewId = "board" | "archive" | "report";

function createButton(label: string, tone: "primary" | "quiet" = "quiet"): HTMLButtonElement {
  const button = document.createElement("button");
  button.type = "button";
  button.className = `pattern-room-review-handoff-action ${tone}`;
  button.textContent = label;
  return button;
}

function openView(viewId: ReviewViewId): void {
  const nav = document.querySelector<HTMLButtonElement>(
    `[data-pattern-workspace-nav="${viewId}"]`
  );
  nav?.click();
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
  if (resolveReviewState(root) === "applied") {
    return true;
  }
  return (
    root.querySelector<HTMLElement>(
      '[data-pattern-case-review-apply-feedback="success"]'
    ) !== null
  );
}

function createHandoffShell(
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
  const resultExists =
    reviewSurface.querySelector("[data-pattern-case-review-result='true']") !== null;

  const title = applied
    ? "İnceleme vakaya işlendi"
    : ready
      ? "Sonuç hazır, karar sende"
      : resultExists
        ? "Bulgular masada"
        : "İnceleme hattı açık";
  const detail = applied
    ? "Yeni notları panoda doğrula veya vaka dosyasına geç."
    : ready
      ? "Uygulanacak bölümü seç; hiçbir bulgu onaysız vakaya eklenmez."
      : "AI çıktısından sonra pano, arşiv ve rapor arasında tek adımda devam et.";
  const handoff = createHandoffShell("Devam hattı", title, detail);
  handoff.shell.dataset["patternReviewHandoffKind"] = "ai";
  handoff.shell.dataset["patternReviewHandoffState"] = applied ? "applied" : state;

  if (ready && !applied) {
    const apply = createButton("Uygulama tepsisini aç", "primary");
    apply.addEventListener("click", () => activateApplyTray(reviewSurface));
    handoff.actions.append(apply);
  }

  const board = createButton(applied ? "Panoda sonucu kontrol et" : "Panoyu aç", applied ? "primary" : "quiet");
  board.addEventListener("click", () => openView("board"));
  const archive = createButton("Arşive dön");
  archive.addEventListener("click", () => openView("archive"));
  const report = createButton("Vaka dosyasını aç");
  report.addEventListener("click", () => openView("report"));
  handoff.actions.append(board, archive, report);
  return handoff.shell;
}

function createLocalHandoff(device: HTMLElement): HTMLElement {
  const reflect = device.querySelector<HTMLButtonElement>("[data-pattern-reflect-debate='true']");
  const phaseCompleted = reflect !== null;
  const referenceCount = device.querySelectorAll("[data-pattern-debate-reference]").length;
  const handoff = createHandoffShell(
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

  if (reflect !== null) {
    const reflectAndOpen = createButton("Rapora yansıt ve aç", "primary");
    reflectAndOpen.addEventListener("click", () => {
      reflect.click();
      window.setTimeout(() => openView("report"), 0);
    });
    handoff.actions.append(reflectAndOpen);
  }

  const board = createButton("Panoya dön", phaseCompleted ? "quiet" : "primary");
  board.addEventListener("click", () => openView("board"));
  const archive = createButton("Arşivi aç");
  archive.addEventListener("click", () => openView("archive"));
  const report = createButton("Raporu aç");
  report.addEventListener("click", () => openView("report"));
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
  if (
    reviewSurface !== null &&
    reviewSurface.querySelector('[data-pattern-review-handoff-kind="ai"]') === null
  ) {
    reviewSurface.append(createAiHandoff(reviewSurface));
  }

  const localSurface = panel.querySelector<HTMLElement>(
    '.pattern-room-device[data-pattern-review-task-surface="tenth-man"]'
  );
  if (
    localSurface !== null &&
    localSurface.querySelector('[data-pattern-review-handoff-kind="local"]') === null
  ) {
    localSurface.append(createLocalHandoff(localSurface));
  }
}

const observer = new MutationObserver(() => {
  enhanceReviewHandoffs();
});

const appRoot = document.querySelector("#app");
if (appRoot !== null) {
  observer.observe(appRoot, { childList: true, subtree: true });
}

enhanceReviewHandoffs();
