import { getErrorMessage } from "@shared/index.js";
import { Logger, LogCategory, LogVisibility } from "../modules/logger/index.js";
import { WindowManager } from "../modules/window-manager.js";
import { ThemeManager } from "../ui/theme-manager.js";
import { Modal } from "../ui/modal-manager.js";

import type { PageController } from "./types.js";
import { shellT } from "./shell-i18n.js";

const SPECIAL_PAGES = ["settings", "archives", "webview"];

type UiModeToggleState = "classic" | "scene" | "scene-debug";

const UI_MODE_DROPDOWN_SELECTOR = "[data-ui-mode-dropdown]";
const UI_MODE_TRIGGER_SELECTOR = "[data-ui-mode-trigger]";
const UI_MODE_OPTION_SELECTOR = "[data-ui-mode-option]";
const UI_MODE_OPTIONS: UiModeToggleState[] = ["classic", "scene", "scene-debug"];

function isUiModeToggleState(value: string): value is UiModeToggleState {
  return UI_MODE_OPTIONS.includes(value as UiModeToggleState);
}

function getUiModeToggleState(): UiModeToggleState {
  const uiMode = document.documentElement.getAttribute("data-ui-mode");
  if (uiMode !== "scene") {
    return "classic";
  }

  const sceneDebug = document.documentElement.getAttribute("data-scene-debug");
  return sceneDebug === "true" ? "scene-debug" : "scene";
}

function getUiModeLabel(state: UiModeToggleState): string {
  if (state === "scene-debug") {
    return shellT("uiMode.options.sceneDebug");
  }
  if (state === "scene") {
    return shellT("uiMode.options.scene");
  }
  return shellT("uiMode.options.classic");
}

function getUiModeRestartOptions(state: UiModeToggleState): {
  uiMode: "classic" | "scene";
  sceneDebug: boolean;
} {
  if (state === "scene-debug") {
    return { uiMode: "scene", sceneDebug: true };
  }
  if (state === "scene") {
    return { uiMode: "scene", sceneDebug: false };
  }
  return { uiMode: "classic", sceneDebug: false };
}

function syncUiModeDropdownOptions(dropdown: HTMLElement): void {
  const state = getUiModeToggleState();
  dropdown.dataset["uiModeState"] = state;

  const options = Array.from(dropdown.querySelectorAll<HTMLButtonElement>(UI_MODE_OPTION_SELECTOR));
  options.forEach((option) => {
    const optionState = option.dataset["uiModeOption"] ?? "";
    const isActive = optionState === state;
    option.hidden = isActive;
    option.setAttribute("aria-hidden", String(isActive));
  });
}

function setUiModeDropdownExpanded(dropdown: HTMLElement, expanded: boolean): void {
  dropdown.classList.toggle("is-expanded", expanded);
  const trigger = dropdown.querySelector<HTMLButtonElement>(UI_MODE_TRIGGER_SELECTOR);
  if (trigger !== null) {
    trigger.setAttribute("aria-expanded", String(expanded));
  }
}

let currentPage: string | null = null;
let controllers: Record<string, PageController> = {};

function normalizePageName(pageName: string): string {
  return pageName;
}

function resolvePageDomNames(pageName: string): string[] {
  return [pageName];
}

function findPageElement(pageName: string): HTMLElement | null {
  for (const domPageName of resolvePageDomNames(pageName)) {
    const element = document.getElementById(`page-${domPageName}`);
    if (element instanceof HTMLElement) {
      return element;
    }
  }
  return null;
}

function matchesPageDataset(candidate: string | undefined, pageName: string): boolean {
  if (candidate === undefined || candidate === "") {
    return false;
  }
  return normalizePageName(candidate) === pageName;
}

function syncShellLayoutState(pageName: string): void {
  document.documentElement.setAttribute("data-active-page", pageName);
}

export function setControllers(c: Record<string, PageController>): void {
  controllers = c;
}

export function getCurrentPage(): string | null {
  return currentPage;
}

export function setupNavigation(): void {
  try {
    document.addEventListener("navigate-page", ((e: CustomEvent<{ page: string }>) => {
      const page = e.detail.page;
      if (page !== "") {
        showPage(page);
      }
    }) as EventListener);
  } catch (error) {
    Logger.debug(
      LogCategory.SYSTEM,
      shellT("logs.navigationSetupError", { message: getErrorMessage(error) }),
      {
        error: error instanceof Error ? error : new Error(String(error)),
      }
    );
  }
}

export function showPage(pageName: string): void {
  const normalizedPageName = normalizePageName(pageName);
  const previousPage = currentPage;
  if (
    previousPage !== null &&
    previousPage !== normalizedPageName &&
    controllers[previousPage] !== undefined
  ) {
    const controller = controllers[previousPage];
    if (controller.onHide !== undefined) {
      controller.onHide();
    }
  }
  document.querySelectorAll(".page").forEach((page) => {
    page.classList.add("is-hidden");
  });

  const pageElement = findPageElement(normalizedPageName);
  if (pageElement !== null) {
    pageElement.classList.remove("is-hidden");
    currentPage = normalizedPageName;
    syncShellLayoutState(normalizedPageName);

    const controller = controllers[normalizedPageName];
    if (controller?.onShow !== undefined) {
      controller.onShow();
    }

    setActiveNavigation(normalizedPageName);
  }
}

export function setupWindowControls(): void {
  document.querySelectorAll<HTMLElement>("[data-window-action]").forEach((button) => {
    const action = button.dataset["windowAction"];
    if (action === undefined || action === "") {
      return;
    }

    button.addEventListener("click", () => {
      if (action === "minimize-to-tray") {
        WindowManager.minimizeToTray();
        return;
      }

      if (action === "close") {
        WindowManager.closeApp();
        return;
      }

      WindowManager.apply(action);
    });
  });
}

export function setupTopBarButtons(): void {
  try {
    const themeToggle = document.getElementById("theme-toggle");

    if (themeToggle !== null) {
      themeToggle.textContent = ThemeManager.getIcon();

      themeToggle.addEventListener("click", () => {
        ThemeManager.next();
        themeToggle.textContent = ThemeManager.getIcon();

        Logger.debug(
          LogCategory.UI_THEME,
          shellT("logs.themeChanged", { theme: ThemeManager.current }),
          {
            visibility: LogVisibility.VERBOSE,
          }
        );
      });

      ThemeManager.onChange(() => {
        themeToggle.textContent = ThemeManager.getIcon();
      });
    }

    const uiModeDropdowns = Array.from(
      document.querySelectorAll<HTMLElement>(UI_MODE_DROPDOWN_SELECTOR)
    );

    if (uiModeDropdowns.length > 0) {
      const closeAll = (): void => {
        uiModeDropdowns.forEach((dropdown) => {
          setUiModeDropdownExpanded(dropdown, false);
        });
      };

      uiModeDropdowns.forEach((dropdown) => {
        syncUiModeDropdownOptions(dropdown);

        const trigger = dropdown.querySelector<HTMLButtonElement>(UI_MODE_TRIGGER_SELECTOR);
        if (trigger !== null) {
          trigger.addEventListener("click", (event) => {
            event.stopPropagation();
            const isExpanded = dropdown.classList.contains("is-expanded");
            closeAll();
            setUiModeDropdownExpanded(dropdown, !isExpanded);
          });
        }

        dropdown.addEventListener("click", async (event) => {
          const target = event.target as HTMLElement;
          const option = target.closest<HTMLButtonElement>(UI_MODE_OPTION_SELECTOR);
          if (option == null) {
            return;
          }

          event.stopPropagation();
          closeAll();

          const optionState = option.dataset["uiModeOption"] ?? "";
          if (!isUiModeToggleState(optionState)) {
            return;
          }

          if (optionState === getUiModeToggleState()) {
            return;
          }

          const confirmed = await Modal.confirm({
            title: shellT("uiMode.confirmTitle"),
            message: shellT("uiMode.confirmMessage", { mode: getUiModeLabel(optionState) }),
          });

          if (!confirmed) {
            return;
          }

          const electronApi = window.electronAPI;
          if (!electronApi?.appRestart) {
            return;
          }

          const restartOptions = getUiModeRestartOptions(optionState);

          try {
            await electronApi.appRestart({
              forceFullRestart: true,
              uiMode: restartOptions.uiMode,
              sceneDebug: restartOptions.sceneDebug,
            });
          } catch {
            void 0;
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

    const sideNavOverlay = document.getElementById("side-nav-overlay");
    const sideNavTrigger = document.querySelector(".side-nav-trigger");
    const sideNavMenu = document.querySelector(".side-nav-menu");

    if (sideNavOverlay !== null && sideNavTrigger !== null && sideNavMenu !== null) {
      sideNavTrigger.addEventListener("mouseenter", () => {
        sideNavOverlay.classList.add("is-expanded");
      });

      sideNavMenu.addEventListener("mouseleave", () => {
        sideNavOverlay.classList.remove("is-expanded");
      });

      sideNavTrigger.addEventListener("mouseleave", (e) => {
        const relatedTarget = (e as MouseEvent).relatedTarget as Element | null;
        if (relatedTarget === null || sideNavMenu.contains(relatedTarget) === false) {
          setTimeout(() => {
            if (sideNavOverlay.matches(":hover") === false) {
              sideNavOverlay.classList.remove("is-expanded");
            }
          }, 100);
        }
      });
    }

    if (sideNavMenu !== null) {
      sideNavMenu.addEventListener("click", (event) => {
        const button = (event.target as Element | null)?.closest(".side-nav-btn");
        if (!(button instanceof HTMLElement)) {
          return;
        }
        const page = button.dataset["page"];
        if (page !== undefined && page !== "") {
          showPage(page);
        }
      });
    }
  } catch (error) {
    Logger.debug(
      LogCategory.SYSTEM,
      shellT("logs.topBarSetupError", { message: getErrorMessage(error) }),
      {
        error: error instanceof Error ? error : new Error(String(error)),
      }
    );
  }
}

export function setActiveNavigation(pageName: string): void {
  const normalizedPageName = normalizePageName(pageName);
  const menuItems = document.querySelectorAll(".menu-item");
  menuItems.forEach((mi) => {
    mi.classList.remove("is-active");
  });
  if (SPECIAL_PAGES.includes(normalizedPageName) === false) {
    menuItems.forEach((mi) => {
      if (matchesPageDataset((mi as HTMLElement).dataset["page"], normalizedPageName)) {
        mi.classList.add("is-active");
      }
    });
  }

  const sideNavBtns = document.querySelectorAll(".side-nav-btn");
  sideNavBtns.forEach((btn) => {
    btn.classList.remove("is-active");
  });
  if (SPECIAL_PAGES.includes(normalizedPageName) === false) {
    sideNavBtns.forEach((btn) => {
      if (matchesPageDataset((btn as HTMLElement).dataset["page"], normalizedPageName)) {
        btn.classList.add("is-active");
      }
    });
  }
}

export function setupReportPanel(): void {
  // NOTE: Kept for backward compatibility.
}
