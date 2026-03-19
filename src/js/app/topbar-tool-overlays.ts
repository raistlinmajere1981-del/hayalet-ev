import { getCurrentPage, getLastPrimaryPage } from "./navigation.js";
import { openExternalToolPage, type ExternalToolPageName } from "../pages/shared/external-page.js";

function bindTopbarToolButton(buttonId: string, pageName: ExternalToolPageName): void {
  const button = document.getElementById(buttonId);
  if (!(button instanceof HTMLButtonElement)) {
    return;
  }

  button.addEventListener("click", () => {
    openExternalToolPage(pageName, {
      returnPage: getCurrentPage() ?? getLastPrimaryPage(),
    });
  });
}

export function setupTopbarToolOverlays(): void {
  bindTopbarToolButton("topbar-whisper-open", "whisper");
  bindTopbarToolButton("archives-page-open-btn", "archives");
  bindTopbarToolButton("topbar-settings-open", "settings");
}
