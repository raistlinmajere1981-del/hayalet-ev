export function createRepairPanel(
  documentRef: Document,
  options: {
    body: HTMLElement;
    collapsed?: boolean;
    eyebrow?: string;
    /** When true, the collapse (Hide/Show) button is omitted. */
    noPanelControls?: boolean;
    panelId: string;
    statusDot?: "live" | "risk" | "amber" | "idle";
    title: string;
  }
): HTMLElement {
  const panelClasses = options.panelId
    .split(/\s+/)
    .filter((item) => item.trim() !== "")
    .map((item) => (item.startsWith("repair-panel--") ? item : `repair-panel--${item}`));
  const section = documentRef.createElement("section");
  section.className = `repair-panel ${panelClasses.join(" ")}${options.collapsed === true ? " repair-panel--collapsed" : ""}`;
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

  if (options.noPanelControls !== true) {
    const collapse = documentRef.createElement("button");
    collapse.className = "repair-panel__icon-btn";
    collapse.type = "button";
    collapse.title = options.collapsed === true ? "Expand panel" : "Collapse panel";
    collapse.textContent = options.collapsed === true ? "Show" : "Hide";
    collapse.dataset["repairAction"] = "toggle-panel-collapse";
    collapse.dataset["panelId"] = options.panelId;
    collapse.dataset["collapsed"] = String(options.collapsed !== true);
    header.append(collapse);
  }

  section.append(header, options.body);
  return section;
}
