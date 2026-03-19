import { toggleSpecialPage } from "./navigation.js";

function bindTopbarToolButton(buttonId: string, pageName: string): void {
  const button = document.getElementById(buttonId);
  if (!(button instanceof HTMLButtonElement)) {
    return;
  }

  button.addEventListener("click", () => {
    toggleSpecialPage(pageName);
  });
}

export function setupTopbarToolOverlays(): void {
  bindTopbarToolButton("topbar-whisper-open", "whisper");
  bindTopbarToolButton("analyze-archive-open-btn", "archives");
  bindTopbarToolButton("topbar-settings-open", "settings");
}
