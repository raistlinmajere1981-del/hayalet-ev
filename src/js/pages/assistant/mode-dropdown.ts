import type { AssistantRuntimeMode } from "./assistant-runtime.js";

const MODE_TRIGGER_SELECTOR = "[data-assistant-mode-trigger]";
const MODE_OPTION_SELECTOR = "[data-assistant-mode-option]";

function isModeOption(value: string): value is "ghost-agent" {
  return value === "ghost-agent";
}

export function syncAssistantModeDropdownOptions(
  dropdown: HTMLElement,
  currentMode: AssistantRuntimeMode
): void {
  dropdown.dataset["assistantModeState"] = currentMode;

  const options = Array.from(dropdown.querySelectorAll<HTMLButtonElement>(MODE_OPTION_SELECTOR));
  let hasVisibleOption = false;

  options.forEach((option) => {
    const optionMode = option.dataset["assistantModeOption"] ?? "";
    const isActive = optionMode === currentMode;
    option.hidden = isActive;
    option.setAttribute("aria-hidden", String(isActive));
    if (isActive === false) {
      hasVisibleOption = true;
    }
  });

  dropdown.hidden = hasVisibleOption === false;
  if (dropdown.hidden) {
    setAssistantModeDropdownExpanded(dropdown, false);
  }
}

export function setAssistantModeDropdownExpanded(
  dropdown: HTMLElement,
  expanded: boolean
): void {
  dropdown.classList.toggle("is-expanded", expanded);
  const trigger = dropdown.querySelector<HTMLButtonElement>(MODE_TRIGGER_SELECTOR);
  if (trigger !== null) {
    trigger.setAttribute("aria-expanded", String(expanded));
  }
}

export function setupAssistantModeDropdown(options: {
  dropdowns: HTMLElement[];
  currentMode: AssistantRuntimeMode;
  onGhostAgentClick: () => void;
}): void {
  if (options.dropdowns.length === 0) {
    return;
  }

  const closeAll = (): void => {
    options.dropdowns.forEach((dropdown) => {
      setAssistantModeDropdownExpanded(dropdown, false);
    });
  };

  options.dropdowns.forEach((dropdown) => {
    syncAssistantModeDropdownOptions(dropdown, options.currentMode);

    const trigger = dropdown.querySelector<HTMLButtonElement>(MODE_TRIGGER_SELECTOR);
    if (trigger !== null) {
      trigger.addEventListener("click", (event) => {
        event.stopPropagation();
        const isExpanded = dropdown.classList.contains("is-expanded");
        closeAll();
        setAssistantModeDropdownExpanded(dropdown, !isExpanded);
      });
    }

    dropdown.addEventListener("click", (event) => {
      const target = event.target as HTMLElement;
      const option = target.closest<HTMLButtonElement>(MODE_OPTION_SELECTOR);
      if (option === null) {
        return;
      }

      event.stopPropagation();
      closeAll();

      const optionMode = option.dataset["assistantModeOption"] ?? "";
      if (!isModeOption(optionMode)) {
        return;
      }

      if (option.hidden) {
        return;
      }

      if (optionMode === "ghost-agent") {
        options.onGhostAgentClick();
      }
    });
  });

  document.addEventListener("click", closeAll);
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
      closeAll();
    }
  });
}
