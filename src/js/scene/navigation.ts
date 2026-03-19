import { getCurrentPage, getLastPrimaryPage } from "../app/navigation.js";
import { closeExternalPage, openExternalToolPage } from "../pages/shared/external-page.js";

export function navigateToScenePage(page: string): void {
  document.dispatchEvent(
    new CustomEvent<{ page: string }>("navigate-page", {
      detail: { page },
    })
  );
}

export function openSceneSettingsPanel(panel: string | null): void {
  openExternalToolPage("settings", {
    panel,
    returnPage: getCurrentPage() ?? getLastPrimaryPage(),
  });
}

export function closeSceneSettingsPanel(): void {
  closeExternalPage();
}
