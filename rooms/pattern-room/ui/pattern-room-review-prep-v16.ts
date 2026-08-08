type ReviewPrepViewId = "board" | "archive";

type WorkspaceCounts = {
  readonly source: number;
  readonly evidence: number;
  readonly board: number;
  readonly connection: number;
};

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

function openView(viewId: ReviewPrepViewId): void {
  document
    .querySelector<HTMLButtonElement>(`[data-pattern-workspace-nav="${viewId}"]`)
    ?.click();
}

function triggerPreview(): void {
  document
    .querySelector<HTMLButtonElement>("[data-pattern-case-review-preview-prepare='true']")
    ?.click();
}

function createMetric(label: string, value: number, ready: boolean): HTMLElement {
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

function createStep(
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

function createAction(label: string, primary: boolean, onClick: () => void): HTMLButtonElement {
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
    createMetric("Kaynak", counts.source, hasSources),
    createMetric("Kanıt", counts.evidence, hasEvidence),
    createMetric("Pano izi", counts.board, hasBoard),
    createMetric("Bağlantı", counts.connection, hasConnections)
  );

  const steps = document.createElement("div");
  steps.className = "pattern-room-review-prep-steps";
  steps.append(
    createStep(
      "01",
      "Vaka zemini",
      hasSources ? `${String(counts.source)} kaynak dosyada.` : "Arşive en az bir kaynak ekle.",
      hasSources
    ),
    createStep(
      "02",
      "Kanıt ve izler",
      hasEvidence
        ? `${String(counts.evidence)} kanıt ile ${String(counts.board)} pano izi hazır.`
        : hasBoard
          ? `${String(counts.board)} pano izi var; kaynaklardan kanıt çıkarmak incelemeyi güçlendirir.`
          : "Panoya iddia, gözlem veya soru ekle.",
      hasBoard
    ),
    createStep(
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
      createAction(hasSources ? "Arşivden kanıt çıkar" : "Arşive kaynak ekle", false, () => {
        openView("archive");
      })
    );
  }
  if (!hasBoard) {
    actions.append(
      createAction("Panoda iz oluştur", false, () => {
        openView("board");
      })
    );
  }
  actions.append(
    createAction("Önizlemeyi hazırla", readyEnough, () => {
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
  if (reviewSurface === null) {
    return;
  }
  if (reviewSurface.querySelector("[data-pattern-case-review-result='true']") !== null) {
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

const appRoot = document.querySelector("#app");
if (appRoot !== null) {
  const observer = new MutationObserver(() => {
    enhanceReviewPreparation();
  });
  observer.observe(appRoot, { childList: true, subtree: true });
}

enhanceReviewPreparation();
