const OVERLAY_IDS = [
  "settings-hub-overlay",
  "whisper-management-overlay",
  "analyze-archive-overlay",
] as const;

export function syncOverlayScrollLock(): void {
  const shouldLock = OVERLAY_IDS.some((id) => {
    const overlay = document.getElementById(id);
    return (
      overlay instanceof HTMLElement &&
      overlay.classList.contains("is-hidden") === false &&
      overlay.getAttribute("aria-hidden") !== "true"
    );
  });

  document.body.classList.toggle("is-scroll-locked", shouldLock);
}
