export function navigateToScenePage(page: string): void {
  document.dispatchEvent(
    new CustomEvent<{ page: string }>("navigate-page", {
      detail: { page },
    })
  );
}

export function openSceneSettingsPanel(panel: string | null): void {
  document.dispatchEvent(
    new CustomEvent("settings-hub:open", {
      detail: { panel },
    })
  );
}

export function closeSceneSettingsPanel(): void {
  document.dispatchEvent(new CustomEvent("settings-hub:close"));
}
