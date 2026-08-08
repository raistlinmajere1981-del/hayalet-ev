import { createElement } from "./panels/pattern-panel-utils.js";

function createArchiveIntakeDesk(panel: HTMLElement): void {
  if (panel.dataset["patternArchiveV5Enhanced"] === "true") {
    return;
  }

  const browser = panel.querySelector<HTMLElement>(".pattern-room-archive-browser");
  const list = panel.querySelector<HTMLElement>(".pattern-room-archive-list");
  const tools = panel.querySelector<HTMLDetailsElement>("[data-pattern-archive-tools='true']");
  if (browser === null || list === null || tools === null) {
    return;
  }

  const sourceCount = list.querySelectorAll("[data-pattern-archive-source]").length;
  const intake = createElement("section", "pattern-room-archive-intake-desk");
  intake.dataset["patternArchiveIntakeDesk"] = "true";

  const header = createElement("header", "pattern-room-archive-intake-header");
  const copy = createElement("div", "pattern-room-archive-intake-copy");
  copy.append(
    createElement("span", "pattern-room-kicker", "Dosya kabul masası"),
    createElement("strong", undefined, sourceCount === 0 ? "İlk kaynağı içeri al" : "Yeni kaynak ekle"),
    createElement(
      "small",
      undefined,
      "Metin, uzun belge veya elle tanımlanan bir kaynağı bu vaka arşivine kabul et."
    )
  );
  const stamp = createElement(
    "span",
    "pattern-room-archive-intake-stamp",
    sourceCount === 0 ? "ARŞİV BOŞ" : `${String(sourceCount)} DOSYA`
  );
  header.append(copy, stamp);

  const summary = tools.querySelector<HTMLElement>("summary");
  if (summary !== null) {
    summary.textContent = sourceCount === 0 ? "Yeni dosya aç" : "Kaynak alım araçlarını aç";
  }
  tools.open = sourceCount === 0;
  tools.classList.add("pattern-room-archive-intake-tools");

  intake.append(header, tools);
  browser.insertBefore(intake, list);

  const empty = browser.querySelector<HTMLElement>("[data-pattern-archive-empty='true']");
  if (empty !== null && sourceCount === 0) {
    empty.textContent = "Henüz dosya yok. Kabul masasından ilk kaynağı ekleyebilirsin.";
  }

  panel.dataset["patternArchiveV5Enhanced"] = "true";
}

function createArchiveCabinetPlaceholder(): HTMLElement {
  const cabinet = createElement("div", "pattern-room-archive-vault-empty-cabinet");
  cabinet.ariaHidden = "true";
  const plate = createElement("span", "pattern-room-archive-vault-plate", "VAKA ARŞİVİ");
  const drawers = createElement("div", "pattern-room-archive-vault-drawers");
  for (let index = 0; index < 4; index += 1) {
    const drawer = createElement("span", "pattern-room-archive-vault-drawer");
    drawer.append(
      createElement("i", "pattern-room-archive-vault-handle"),
      createElement("small", undefined, `0${String(index + 1)}`)
    );
    drawers.append(drawer);
  }
  cabinet.append(plate, drawers);
  return cabinet;
}

function enhanceArchiveVault(panel: HTMLElement): void {
  if (panel.dataset["patternArchiveV7Enhanced"] === "true") {
    return;
  }

  const browser = panel.querySelector<HTMLElement>(".pattern-room-archive-browser");
  const browserHeader = browser?.querySelector<HTMLElement>(
    ":scope > .pattern-room-workspace-section-header"
  );
  const toolbar = browser?.querySelector<HTMLElement>(":scope > .pattern-room-archive-toolbar");
  const count = browser?.querySelector<HTMLElement>(":scope > .pattern-room-archive-result-count");
  const intake = browser?.querySelector<HTMLElement>(":scope > [data-pattern-archive-intake-desk='true']");
  const list = browser?.querySelector<HTMLElement>(":scope > .pattern-room-archive-list");
  const empty = browser?.querySelector<HTMLElement>(":scope > [data-pattern-archive-empty='true']");
  const typeFilter = toolbar?.querySelector<HTMLSelectElement>("[data-pattern-archive-type-filter='true']");
  const search = toolbar?.querySelector<HTMLInputElement>("[data-pattern-archive-search='true']");
  if (
    browser === null ||
    browserHeader === null ||
    toolbar === null ||
    count === null ||
    intake === null ||
    list === null ||
    empty === null ||
    typeFilter === null ||
    search === null
  ) {
    return;
  }

  const sourceCards = Array.from(
    list.querySelectorAll<HTMLElement>("[data-pattern-archive-source]")
  );
  const sourceTypes = Array.from(
    new Set(
      sourceCards.map((card) => {
        return card.dataset["patternArchiveSourceType"] ?? "Diğer";
      })
    )
  );
  const localCount = sourceCards.filter((card) => card.classList.contains("local-source")).length;

  browser.classList.add("pattern-room-archive-vault-browser");
  browserHeader.classList.add("pattern-room-archive-vault-header");
  toolbar.classList.add("pattern-room-archive-index-search");
  intake.classList.add("pattern-room-archive-vault-intake");

  const indexDesk = createElement("section", "pattern-room-archive-index-desk");
  const indexHeader = createElement("header", "pattern-room-archive-index-header");
  const indexCopy = createElement("div", "pattern-room-archive-index-copy");
  indexCopy.append(
    createElement("span", "pattern-room-kicker", "Dosya fihristi"),
    createElement("strong", undefined, "Kaynak kasası"),
    createElement("small", undefined, "Dosya türüne göre rafı daralt veya arşivin tamamında ara.")
  );
  const indexMetrics = createElement("div", "pattern-room-archive-index-metrics");
  const metricValues: ReadonlyArray<readonly [string, number]> = [
    ["Dosya", sourceCards.length],
    ["Raf", sourceTypes.length],
    ["Yerel", localCount],
  ];
  metricValues.forEach(([label, value]) => {
    const metric = createElement("span", "pattern-room-archive-index-metric");
    metric.append(createElement("small", undefined, label), createElement("strong", undefined, String(value)));
    indexMetrics.append(metric);
  });
  indexHeader.append(indexCopy, indexMetrics);

  const filterChips = createElement("div", "pattern-room-archive-filter-chips");
  filterChips.ariaLabel = "Arşiv rafları";
  const chipButtons = new Map<string, HTMLButtonElement>();
  const createFilterChip = (value: string, label: string): HTMLButtonElement => {
    const button = createElement("button", "pattern-room-archive-filter-chip", label);
    button.type = "button";
    button.dataset["patternArchiveFilterChip"] = value;
    button.ariaPressed = "false";
    button.addEventListener("click", () => {
      typeFilter.value = value;
      typeFilter.dispatchEvent(new Event("change", { bubbles: true }));
    });
    chipButtons.set(value, button);
    return button;
  };
  filterChips.append(createFilterChip("all", "Tüm dosyalar"));
  sourceTypes.forEach((sourceType) => {
    filterChips.append(createFilterChip(sourceType, sourceType));
  });

  const folderGroups = new Map<
    string,
    { readonly group: HTMLElement; readonly cards: readonly HTMLElement[] }
  >();

  if (sourceCards.length === 0) {
    empty.classList.add("pattern-room-archive-vault-empty-copy");
    const emptyStage = createElement("section", "pattern-room-archive-vault-empty-stage");
    emptyStage.append(createArchiveCabinetPlaceholder(), empty);
    list.replaceChildren(emptyStage);
  } else {
    list.replaceChildren();
    sourceTypes.forEach((sourceType, index) => {
      const cards = sourceCards.filter((card) => {
        return card.dataset["patternArchiveSourceType"] === sourceType;
      });
      const group = createElement("section", "pattern-room-archive-folder-group");
      group.dataset["patternArchiveFolderGroup"] = sourceType;
      const groupHeader = createElement("header", "pattern-room-archive-folder-group-header");
      groupHeader.append(
        createElement("span", "pattern-room-archive-folder-index", String(index + 1).padStart(2, "0")),
        createElement("strong", undefined, sourceType),
        createElement("small", undefined, `${String(cards.length)} dosya`)
      );
      const body = createElement("div", "pattern-room-archive-folder-group-body");
      cards.forEach((card) => {
        card.classList.add("pattern-room-archive-file-folder");
        const inspectButton = card.querySelector<HTMLButtonElement>("[data-pattern-inspect-source]");
        card.addEventListener("click", (event) => {
          const target = event.target as HTMLElement | null;
          if (target?.closest("button, input, select, textarea, a") !== null) {
            return;
          }
          inspectButton?.click();
        });
        body.append(card);
      });
      group.append(groupHeader, body);
      folderGroups.set(sourceType, { group, cards });
      list.append(group);
    });
    list.append(empty);
  }

  const syncArchiveChrome = (): void => {
    chipButtons.forEach((button, value) => {
      const active = typeFilter.value === value;
      button.dataset["patternArchiveFilterChipActive"] = active ? "true" : "false";
      button.ariaPressed = active ? "true" : "false";
      button.classList.toggle("active", active);
    });
    folderGroups.forEach(({ group, cards }) => {
      group.hidden = !cards.some((card) => !card.hidden);
    });
  };
  typeFilter.addEventListener("change", syncArchiveChrome);
  search.addEventListener("input", syncArchiveChrome);
  syncArchiveChrome();

  indexDesk.append(indexHeader, toolbar, filterChips, count);
  const vault = createElement("section", "pattern-room-archive-vault");
  const vaultLabel = createElement("header", "pattern-room-archive-vault-label");
  vaultLabel.append(
    createElement("span", "pattern-room-kicker", "Dosya rafları"),
    createElement("strong", undefined, sourceCards.length === 0 ? "Kasa boş" : "Açık arşiv")
  );
  vault.append(vaultLabel, list);

  browser.replaceChildren(browserHeader, indexDesk, intake, vault);
  panel.dataset["patternArchiveV7Enhanced"] = "true";
}

function createSeatPreview(roleSlot: HTMLElement, index: number): HTMLElement {
  const seat = createElement("span", "pattern-room-interrogation-seat");
  seat.dataset["patternInterrogationSeat"] = String(index + 1);
  const connected = roleSlot.dataset["patternRoleConnected"] === "true";
  seat.dataset["patternInterrogationSeatConnected"] = connected ? "true" : "false";

  const id = roleSlot.querySelector<HTMLElement>(".pattern-room-role-id")?.textContent?.trim();
  const label = roleSlot.querySelector<HTMLElement>("strong")?.textContent?.trim();
  seat.append(
    createElement("i", "pattern-room-interrogation-seat-light"),
    createElement("strong", undefined, id === undefined || id === "" ? `R${String(index + 1)}` : id),
    createElement("small", undefined, label === undefined || label === "" ? "Rol" : label)
  );
  return seat;
}

function enhanceTenthManDevice(panel: HTMLElement): void {
  const device = panel.querySelector<HTMLElement>("[data-pattern-review-task-surface='tenth-man']");
  if (device === null || device.dataset["patternTenthManV5Enhanced"] === "true") {
    return;
  }

  const status = device.querySelector<HTMLElement>(":scope > .pattern-room-device-status-row");
  const title = device.querySelector<HTMLElement>(":scope > h2");
  const prompt = device.querySelector<HTMLElement>(":scope > p");
  const actions = device.querySelector<HTMLElement>(":scope > .pattern-room-debate-actions");
  const roles = device.querySelector<HTMLDetailsElement>(
    ":scope > [data-pattern-review-disclosure='local-roles']"
  );
  const references = device.querySelector<HTMLDetailsElement>(
    ":scope > [data-pattern-review-disclosure='local-references']"
  );
  const flow = device.querySelector<HTMLDetailsElement>(
    ":scope > [data-pattern-review-disclosure='local-flow']"
  );
  const contextLabel = device.querySelector<HTMLElement>(
    ":scope > .pattern-room-context-inspector-label"
  );

  if (title === null || prompt === null || roles === null || references === null) {
    return;
  }

  const workstation = createElement("section", "pattern-room-interrogation-workstation");
  const chamber = createElement("div", "pattern-room-interrogation-chamber");
  chamber.append(
    createElement("span", "pattern-room-kicker", "Sorgu masası"),
    createElement("strong", undefined, "Karşıt görüş oturumu")
  );

  const table = createElement("div", "pattern-room-interrogation-table");
  const roleSlots = roles.querySelectorAll<HTMLElement>(".pattern-room-role-slot");
  [...roleSlots].slice(0, 4).forEach((roleSlot, index) => {
    table.append(createSeatPreview(roleSlot, index));
  });
  if (roleSlots.length === 0) {
    for (let index = 0; index < 4; index += 1) {
      const emptySeat = createElement("span", "pattern-room-interrogation-seat");
      emptySeat.dataset["patternInterrogationSeatConnected"] = "false";
      emptySeat.append(
        createElement("i", "pattern-room-interrogation-seat-light"),
        createElement("strong", undefined, `R${String(index + 1)}`),
        createElement("small", undefined, "Bekliyor")
      );
      table.append(emptySeat);
    }
  }
  chamber.append(table);

  const briefing = createElement("div", "pattern-room-interrogation-briefing");
  briefing.append(
    createElement("span", "pattern-room-kicker", "Oturum brifingi"),
    title,
    prompt
  );
  if (actions !== null) {
    briefing.append(actions);
  }
  workstation.append(chamber, briefing);

  const dossier = createElement("section", "pattern-room-interrogation-dossier");
  dossier.append(roles, references);

  const replacement: HTMLElement[] = [];
  if (contextLabel !== null) {
    replacement.push(contextLabel);
  }
  if (status !== null) {
    replacement.push(status);
  }
  replacement.push(workstation, dossier);
  if (flow !== null) {
    replacement.push(flow);
  }

  device.replaceChildren(...replacement);
  device.dataset["patternTenthManV5Enhanced"] = "true";
}

function enhanceAiReviewDesk(panel: HTMLElement): void {
  const surface = panel.querySelector<HTMLElement>("[data-pattern-review-task-surface='ai-review']");
  if (surface === null || surface.dataset["patternAiReviewV6Enhanced"] === "true") {
    return;
  }

  const preview = surface.querySelector<HTMLElement>("[data-pattern-case-review-preview='true']");
  if (preview === null) {
    return;
  }

  const kicker = preview.querySelector<HTMLElement>(":scope > .pattern-room-kicker");
  const title = preview.querySelector<HTMLElement>(":scope > h2");
  const intro = preview.querySelector<HTMLElement>(":scope > p");
  const controls = preview.querySelector<HTMLElement>(":scope > .pattern-room-case-review-controls");
  const workspace = preview.querySelector<HTMLElement>(":scope > .pattern-room-case-review-workspace");
  if (title === null || controls === null || workspace === null) {
    return;
  }

  const launchpad = createElement("section", "pattern-room-analysis-launchpad");
  const launchCopy = createElement("div", "pattern-room-analysis-launch-copy");
  if (kicker !== null) {
    launchCopy.append(kicker);
  }
  launchCopy.append(title);
  if (intro !== null) {
    launchCopy.append(intro);
  }
  launchpad.append(launchCopy, controls);

  const request = workspace.querySelector<HTMLDetailsElement>(
    ":scope > [data-pattern-review-disclosure='case-request']"
  );
  if (request !== null) {
    request.classList.add("pattern-room-case-packet-drawer");
    request.open = false;
    const summary = request.querySelector<HTMLElement>("summary");
    if (summary !== null) {
      const secondary = summary.querySelector<HTMLElement>("span");
      if (secondary !== null) {
        secondary.textContent = "Paket";
      }
    }
  }

  workspace.classList.add("pattern-room-analysis-workspace-v6");
  preview.replaceChildren(launchpad, workspace);
  surface.dataset["patternReviewDesk"] = "case-analysis";
  surface.dataset["patternAiReviewV6Enhanced"] = "true";
}

function enhanceReviewSurface(panel: HTMLElement): void {
  enhanceAiReviewDesk(panel);
  enhanceTenthManDevice(panel);
}

function enhancePatternRoom(root: ParentNode): void {
  root.querySelectorAll<HTMLElement>("[data-pattern-view='archive']").forEach((panel) => {
    createArchiveIntakeDesk(panel);
    enhanceArchiveVault(panel);
  });
  root.querySelectorAll<HTMLElement>("[data-pattern-view='tenth-man']").forEach((panel) => {
    enhanceReviewSurface(panel);
  });
}

function installEnhancements(): void {
  const app = document.getElementById("app");
  if (app === null) {
    window.setTimeout(installEnhancements, 0);
    return;
  }

  let scheduled = false;
  const run = (): void => {
    scheduled = false;
    enhancePatternRoom(app);
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

installEnhancements();