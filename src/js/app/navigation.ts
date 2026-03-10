/**
 * Navigation & Window Controls
 *
 * Handles page transitions, window controls, top bar buttons,
 * and side navigation state.
 */

import { getErrorMessage } from "@shared/index.js";
import { Logger, LogCategory, LogVisibility } from "../modules/logger/index.js";
import { WindowManager } from "../modules/window-manager.js";
import { ThemeManager } from "../ui/theme-manager.js";

import type { PageController } from "./types.js";
import { shellT } from "./shell-i18n.js";

const SPECIAL_PAGES = ["settings", "archives", "webview"];
const ASSISTANT_PAGE = "assistant";
const LEGACY_ASSISTANT_PAGE = "asistan";

let currentPage: string | null = null;
let controllers: Record<string, PageController> = {};

function normalizePageName(pageName: string): string {
  return pageName === LEGACY_ASSISTANT_PAGE ? ASSISTANT_PAGE : pageName;
}

function resolvePageDomNames(pageName: string): string[] {
  return pageName === ASSISTANT_PAGE ? [ASSISTANT_PAGE, LEGACY_ASSISTANT_PAGE] : [pageName];
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

/**
 * Sets the shared controller references.
 */
export function setControllers(c: Record<string, PageController>): void {
  controllers = c;
}

/**
 * Returns the active page name.
 */
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

/**
 * @param {string} pageName
 */
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
    page.classList.add("hidden");
  });

  const pageElement = findPageElement(normalizedPageName);
  if (pageElement !== null) {
    pageElement.classList.remove("hidden");
    currentPage = normalizedPageName;

    const controller = controllers[normalizedPageName];
    if (controller?.onShow !== undefined) {
      controller.onShow();
    }

    setActiveNavigation(normalizedPageName);
  }
}

export function setupWindowControls(): void {
  const minimizeToTrayBtn = document.getElementById("window-minimize-to-tray");
  const minimizeBtn = document.getElementById("window-minimize");
  const fullscreenBtn = document.getElementById("window-fullscreen");
  const closeBtn = document.getElementById("window-close");
  if (minimizeToTrayBtn !== null)
    minimizeToTrayBtn.addEventListener("click", () => {
      WindowManager.minimizeToTray();
    });
  if (minimizeBtn !== null)
    minimizeBtn.addEventListener("click", () => WindowManager.apply("minimize"));
  if (fullscreenBtn !== null)
    fullscreenBtn.addEventListener("click", () => WindowManager.apply("fullscreen"));
  if (closeBtn !== null)
    closeBtn.addEventListener("click", () => {
      WindowManager.closeApp();
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

    const sideNavOverlay = document.getElementById("side-nav-overlay");
    const sideNavTrigger = document.querySelector(".side-nav-trigger");
    const sideNavMenu = document.querySelector(".side-nav-menu");

    if (sideNavOverlay !== null && sideNavTrigger !== null && sideNavMenu !== null) {
      sideNavTrigger.addEventListener("mouseenter", () => {
        sideNavOverlay.classList.add("is-open");
      });

      sideNavMenu.addEventListener("mouseleave", () => {
        sideNavOverlay.classList.remove("is-open");
      });

      sideNavTrigger.addEventListener("mouseleave", (e) => {
        const relatedTarget = (e as MouseEvent).relatedTarget as Element | null;
        if (relatedTarget === null || sideNavMenu.contains(relatedTarget) === false) {
          setTimeout(() => {
            if (sideNavOverlay.matches(":hover") === false) {
              sideNavOverlay.classList.remove("is-open");
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

/**
 * @param {string} pageName
 */
export function setActiveNavigation(pageName: string): void {
  const normalizedPageName = normalizePageName(pageName);
  const menuItems = document.querySelectorAll(".menu-item");
  menuItems.forEach((mi) => {
    mi.classList.remove("active");
  });
  if (SPECIAL_PAGES.includes(normalizedPageName) === false) {
    menuItems.forEach((mi) => {
      if (matchesPageDataset((mi as HTMLElement).dataset["page"], normalizedPageName)) {
        mi.classList.add("active");
      }
    });
  }

  const sideNavBtns = document.querySelectorAll(".side-nav-btn");
  sideNavBtns.forEach((btn) => {
    btn.classList.remove("active");
  });
  if (SPECIAL_PAGES.includes(normalizedPageName) === false) {
    sideNavBtns.forEach((btn) => {
      if (matchesPageDataset((btn as HTMLElement).dataset["page"], normalizedPageName)) {
        btn.classList.add("active");
      }
    });
  }
}

export function setupReportPanel(): void {
  // Kept for backward compatibility.
}
