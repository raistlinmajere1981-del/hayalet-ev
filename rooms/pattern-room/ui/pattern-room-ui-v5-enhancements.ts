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
