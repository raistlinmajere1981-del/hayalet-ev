export function openLabAssetContextMenu(event: Event) {
  const target = event.target instanceof Element ? event.target : null;
  if (!target) {
    return;
  }
  const assetRow = target.closest<HTMLElement>("[data-lab-asset-id]");
  if (!assetRow) {
    return;
  }
  const menu = assetRow.querySelector<HTMLDetailsElement>(".labx-project-assets__menu");
  if (!menu) {
    return;
  }
  event.preventDefault();
  menu.open = true;
  const summary = menu.querySelector<HTMLElement>("summary");
  summary?.focus();
}
