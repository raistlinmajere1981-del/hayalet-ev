import {
  ANALYZE_ARCHIVE_CLOSE_EVENT,
  ANALYZE_ARCHIVE_STATE_EVENT,
} from "../pages/analyze/archive-overlay-controller.js";

import { syncOverlayScrollLock } from "./overlay-scroll-lock.js";

function moveArchiveOverlayToGlobalLayer(): void {
  const archiveOverlay = document.getElementById("analyze-archive-overlay");
  const settingsOverlay = document.getElementById("settings-hub-overlay");

  if (
    !(archiveOverlay instanceof HTMLElement) ||
    !(settingsOverlay instanceof HTMLElement) ||
    archiveOverlay.parentElement === settingsOverlay.parentElement
  ) {
    return;
  }

  settingsOverlay.before(archiveOverlay);
}

function mountWhisperDockIntoOverlay(): void {
  const overlayHost = document.getElementById("whisper-management-host");
  const whisperDock = document.getElementById("whisper-dock");

  if (!(overlayHost instanceof HTMLElement) || !(whisperDock instanceof HTMLElement)) {
    return;
  }

  if (whisperDock.parentElement !== overlayHost) {
    overlayHost.appendChild(whisperDock);
  }

  const legacyHost = document.getElementById("entrance-classic-whisper-dock-host");
  if (legacyHost instanceof HTMLElement && legacyHost.childElementCount === 0) {
    legacyHost.remove();
  }
}

export function setupTopbarToolOverlays(): void {
  moveArchiveOverlayToGlobalLayer();
  mountWhisperDockIntoOverlay();

  const overlay = document.getElementById("whisper-management-overlay");
  const backdrop = document.getElementById("whisper-management-backdrop");
  const openButton = document.getElementById("topbar-whisper-open");
  const closeButton = document.getElementById("whisper-management-close");

  if (
    !(overlay instanceof HTMLElement) ||
    !(backdrop instanceof HTMLElement) ||
    !(openButton instanceof HTMLButtonElement) ||
    !(closeButton instanceof HTMLButtonElement)
  ) {
    return;
  }

  let isOpen = false;

  const open = (): void => {
    document.dispatchEvent(new CustomEvent("settings-hub:close"));
    document.dispatchEvent(new CustomEvent(ANALYZE_ARCHIVE_CLOSE_EVENT));
    overlay.classList.remove("is-hidden");
    overlay.setAttribute("aria-hidden", "false");
    isOpen = true;
    syncOverlayScrollLock();
    document.dispatchEvent(new CustomEvent("entrance-whisper:open"));
    window.requestAnimationFrame(() => {
      const addTextInput = document.getElementById("whisper-add-text");
      if (addTextInput instanceof HTMLTextAreaElement) {
        addTextInput.focus();
      }
    });
  };

  const close = (): void => {
    if (!isOpen) {
      return;
    }

    overlay.classList.add("is-hidden");
    overlay.setAttribute("aria-hidden", "true");
    isOpen = false;
    syncOverlayScrollLock();
  };

  openButton.addEventListener("click", () => {
    if (isOpen) {
      close();
      return;
    }

    open();
  });

  closeButton.addEventListener("click", close);
  backdrop.addEventListener("click", close);

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && isOpen) {
      close();
    }
  });

  document.addEventListener("navigate-page", () => {
    close();
    document.dispatchEvent(new CustomEvent(ANALYZE_ARCHIVE_CLOSE_EVENT));
  });

  document.addEventListener("settings-hub:state-change", ((event: CustomEvent<{ open?: boolean }>) => {
    if (event.detail.open === true) {
      close();
    }
  }) as EventListener);

  document.addEventListener(
    ANALYZE_ARCHIVE_STATE_EVENT,
    ((event: CustomEvent<{ open?: boolean }>) => {
      if (event.detail.open === true) {
        close();
      }
    }) as EventListener
  );
}
