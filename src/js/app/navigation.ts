/**
 * Navigation & Window Controls
 *
 * Sayfa geçişleri, pencere kontrolleri, üst bar butonları
 * ve side navigation yönetimi.
 */

import { getErrorMessage } from "@shared/index.js";
import { Logger, LogCategory, LogVisibility } from "../modules/logger/index.js";
import { WindowManager } from "../modules/window-manager.js";
import { ThemeManager } from "../ui/theme-manager.js";

import type { PageController } from "./types.js";

const SPECIAL_PAGES = ["settings", "archives", "webview"];

let currentPage: string | null = null;
let controllers: Record<string, PageController> = {};

/**
 * Controller referanslarını set et (index.ts'den çağrılır)
 */
export function setControllers(c: Record<string, PageController>): void {
  controllers = c;
}

/**
 * Aktif sayfa adını döndür
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
    Logger.debug(LogCategory.SYSTEM, `Navigation setup error: ${getErrorMessage(error)}`, {
      error: error instanceof Error ? error : new Error(String(error)),
    });
  }
}

/**
 * @param {string} pageName
 */
export function showPage(pageName: string): void {
  const previousPage = currentPage;
  if (
    previousPage !== null &&
    previousPage !== pageName &&
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

  const pageElement = document.getElementById(`page-${pageName}`);
  if (pageElement !== null) {
    pageElement.classList.remove("hidden");
    currentPage = pageName;

    const controller = controllers[pageName];
    if (controller?.onShow !== undefined) {
      controller.onShow();
    }

    setActiveNavigation(pageName);
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
    const asistanBtn = document.getElementById("asistan-btn");
    const themeToggle = document.getElementById("theme-toggle");

    if (asistanBtn !== null) {
      asistanBtn.addEventListener("click", () => {
        showPage("asistan");
      });
    }

    if (themeToggle !== null) {
      themeToggle.textContent = ThemeManager.getIcon();

      themeToggle.addEventListener("click", () => {
        ThemeManager.next();
        themeToggle.textContent = ThemeManager.getIcon();

        Logger.debug(LogCategory.UI_THEME, `Tema değiştirildi: ${ThemeManager.current}`, {
          visibility: LogVisibility.VERBOSE,
        });
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
    Logger.debug(LogCategory.SYSTEM, `Top bar setup error: ${getErrorMessage(error)}`, {
      error: error instanceof Error ? error : new Error(String(error)),
    });
  }
}

/**
 * @param {string} pageName
 */
export function setActiveNavigation(pageName: string): void {
  const menuItems = document.querySelectorAll(".menu-item");
  menuItems.forEach((mi) => {
    mi.classList.remove("active");
  });
  if (SPECIAL_PAGES.includes(pageName) === false) {
    menuItems.forEach((mi) => {
      if ((mi as HTMLElement).dataset["page"] === pageName) {
        mi.classList.add("active");
      }
    });
  }

  const sideNavBtns = document.querySelectorAll(".side-nav-btn");
  sideNavBtns.forEach((btn) => {
    btn.classList.remove("active");
  });
  if (SPECIAL_PAGES.includes(pageName) === false) {
    sideNavBtns.forEach((btn) => {
      if ((btn as HTMLElement).dataset["page"] === pageName) {
        btn.classList.add("active");
      }
    });
  }

  /** @type {Record<string, HTMLElement | null>} */
  const iconMap: Record<string, HTMLElement | null> = {
    asistan: document.getElementById("asistan-btn"),
  };
  Object.values(iconMap).forEach((btn) => {
    if (btn !== null) btn.classList.remove("active");
  });
  const activeIcon = iconMap[pageName];
  if (activeIcon !== undefined && activeIcon !== null) {
    activeIcon.classList.add("active");
  }
}

export function setupReportPanel(): void {
  // Bu fonksiyon geriye dönük uyumluluk için boş bırakıldı
}
