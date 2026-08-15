type LabImageComparisonToolbarTool = "move" | "resize" | "zoom";

type ToolConfig = {
  id: LabImageComparisonToolbarTool;
  label: string;
  svg: string;
};

const TOOL_CONFIGS: readonly ToolConfig[] = [
  {
    id: "move",
    label: "Taşı",
    svg: `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 2v20"/><path d="M2 12h20"/><path d="m12 2-3 3"/><path d="m12 2 3 3"/><path d="m12 22-3-3"/><path d="m12 22 3-3"/><path d="m2 12 3-3"/><path d="m2 12 3 3"/><path d="m22 12-3-3"/><path d="m22 12-3 3"/></svg>`,
  },
  {
    id: "resize",
    label: "Boyutlandır",
    svg: `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M8 3H3v5"/><path d="M16 21h5v-5"/><path d="M3 8l6-6"/><path d="m21 16-6 6"/><path d="M14 3h7v7"/><path d="M10 21H3v-7"/></svg>`,
  },
  {
    id: "zoom",
    label: "Yakınlaştır",
    svg: `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="11" cy="11" r="7"/><path d="m20 20-4-4"/><path d="M11 8v6"/><path d="M8 11h6"/></svg>`,
  },
];

let activeTool: LabImageComparisonToolbarTool | null = null;
let bound = false;
let forwardingBaseSlotClick = false;
let syncQueued = false;

function getToolConfig(tool: LabImageComparisonToolbarTool) {
  return TOOL_CONFIGS.find(function (config) {
    return config.id === tool;
  })!;
}

function getBaseComparisonButton() {
  return document.querySelector<HTMLButtonElement>(
    '.labx-icon-rail__btn[data-lab-value="image-comparison"]'
  );
}

function getComparisonPopover() {
  return document.querySelector<HTMLElement>(
    '.labx-icon-rail-popover[data-slot="image-comparison"]'
  );
}

function createToolButton(config: ToolConfig) {
  const button = document.createElement("button");
  button.className = "labx-icon-rail__btn labx-image-comparison-toolbar__btn";
  button.type = "button";
  button.dataset["labComparisonToolbarTool"] = config.id;
  button.dataset["active"] = "false";
  button.setAttribute("aria-label", config.label);
  button.title = config.label;
  button.innerHTML = config.svg;
  return button;
}

function removeToolButtons() {
  document
    .querySelectorAll<HTMLElement>("[data-lab-comparison-toolbar-tool]")
    .forEach(function (button) {
      button.remove();
    });
}

function ensureToolButtons(baseButton: HTMLButtonElement) {
  const group = baseButton.parentElement;
  if (group === null) {
    return;
  }
  let anchor: Element = baseButton;
  TOOL_CONFIGS.forEach(function (config) {
    let button = group.querySelector<HTMLButtonElement>(
      `[data-lab-comparison-toolbar-tool="${config.id}"]`
    );
    if (button === null) {
      button = createToolButton(config);
      anchor.insertAdjacentElement("afterend", button);
    } else if (button.previousElementSibling !== anchor) {
      anchor.insertAdjacentElement("afterend", button);
    }
    button.dataset["active"] = activeTool === config.id ? "true" : "false";
    anchor = button;
  });
}

function syncPopoverPresentation(baseButton: HTMLButtonElement) {
  const popover = getComparisonPopover();
  if (activeTool === null) {
    baseButton.dataset["active"] = popover === null ? baseButton.dataset["active"] || "false" : "true";
    popover?.removeAttribute("data-comparison-tool");
    return;
  }
  baseButton.dataset["active"] = "false";
  if (popover === null) {
    return;
  }
  popover.dataset["comparisonTool"] = activeTool;
  const title = popover.querySelector<HTMLElement>(".labx-icon-rail-popover__title");
  const nextTitle = getToolConfig(activeTool).label;
  if (title !== null && title.textContent !== nextTitle) {
    title.textContent = nextTitle;
  }
}

function syncToolbar() {
  syncQueued = false;
  const baseButton = getBaseComparisonButton();
  if (baseButton === null || baseButton.disabled || baseButton.dataset["disabled"] === "true") {
    removeToolButtons();
    activeTool = null;
    return;
  }
  ensureToolButtons(baseButton);
  syncPopoverPresentation(baseButton);
}

function queueSync() {
  if (syncQueued || typeof queueMicrotask !== "function") {
    if (!syncQueued) {
      syncToolbar();
    }
    return;
  }
  syncQueued = true;
  queueMicrotask(syncToolbar);
}

function openTool(tool: LabImageComparisonToolbarTool, event: Event) {
  event.preventDefault();
  event.stopImmediatePropagation();
  activeTool = tool;
  const baseButton = getBaseComparisonButton();
  if (baseButton !== null && baseButton.dataset["active"] !== "true") {
    forwardingBaseSlotClick = true;
    baseButton.click();
    forwardingBaseSlotClick = false;
    activeTool = tool;
  }
  queueSync();
}

function handleClick(event: Event) {
  const target = event.target;
  if (!(target instanceof Element)) {
    return;
  }
  const toolButton = target.closest<HTMLElement>("[data-lab-comparison-toolbar-tool]");
  if (toolButton !== null) {
    const tool = toolButton.dataset["labComparisonToolbarTool"];
    if (tool === "move" || tool === "resize" || tool === "zoom") {
      openTool(tool, event);
    }
    return;
  }
  if (forwardingBaseSlotClick) {
    return;
  }
  const railButton = target.closest<HTMLElement>(".labx-icon-rail__btn");
  const closeButton = target.closest<HTMLElement>(".labx-icon-rail-popover__close");
  if (railButton !== null || closeButton !== null) {
    activeTool = null;
    queueSync();
  }
}

export function getActiveLabImageComparisonToolbarTool(): LabImageComparisonToolbarTool | null {
  return activeTool;
}

export function ensureLabImageComparisonToolbarBound() {
  if (bound || typeof document === "undefined" || typeof MutationObserver === "undefined") {
    return;
  }
  bound = true;
  document.addEventListener("click", handleClick, true);
  new MutationObserver(queueSync).observe(document.documentElement, {
    childList: true,
    subtree: true,
  });
  queueSync();
}
