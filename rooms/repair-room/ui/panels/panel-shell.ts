export function createRepairPanel(
  documentRef: Document,
  options: {
    body: HTMLElement;
    collapsed?: boolean;
    eyebrow?: string;
    panelId: string;
    pinned?: boolean;
    statusDot?: "live" | "risk" | "amber" | "idle";
    title: string;
  }
): HTMLElement {
  const section = documentRef.createElement("section");
  section.className = `repair-panel repair-panel--${options.panelId}${options.collapsed === true ? " repair-panel--collapsed" : ""}${options.pinned === true ? " repair-panel--pinned" : ""}`;
  section.dataset["repairPanel"] = options.panelId;

  const header = documentRef.createElement("header");
  header.className = "repair-panel__header";

  const dot = documentRef.createElement("span");
  dot.className = `repair-panel__status-dot repair-panel__status-dot--${options.statusDot ?? "idle"}`;
  header.append(dot);

  if (typeof options.eyebrow === "string" && options.eyebrow.trim() !== "") {
    const eyebrow = documentRef.createElement("p");
    eyebrow.className = "repair-panel__eyebrow";
    eyebrow.textContent = options.eyebrow;
    header.append(eyebrow);
  }

  const title = documentRef.createElement("h2");
  title.className = "repair-panel__title";
  title.textContent = options.title;
  header.append(title);

  const spacer = documentRef.createElement("span");
  spacer.className = "repair-panel__header-spacer";
  header.append(spacer);

  const pin = documentRef.createElement("button");
  pin.className = `repair-panel__icon-btn${options.pinned === true ? " repair-panel__icon-btn--active" : ""}`;
  pin.type = "button";
  pin.title = options.pinned === true ? "Unpin panel" : "Pin panel";
  pin.textContent = options.pinned === true ? "Pinned" : "Keep";
  pin.dataset["repairAction"] = "toggle-panel-pin";
  pin.dataset["panelId"] = options.panelId;
  pin.dataset["pinned"] = String(options.pinned !== true);
  header.append(pin);

  const collapse = documentRef.createElement("button");
  collapse.className = "repair-panel__icon-btn";
  collapse.type = "button";
  collapse.title = options.collapsed === true ? "Expand panel" : "Collapse panel";
  collapse.textContent = options.collapsed === true ? "Show" : "Hide";
  collapse.dataset["repairAction"] = "toggle-panel-collapse";
  collapse.dataset["panelId"] = options.panelId;
  collapse.dataset["collapsed"] = String(options.collapsed !== true);
  header.append(collapse);

  section.append(header, options.body);
  return section;
}
