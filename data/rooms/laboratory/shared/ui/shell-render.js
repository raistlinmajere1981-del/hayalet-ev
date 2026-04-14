export function renderLaboratoryStageContent(activeStage, renderers) {
  switch (activeStage) {
    case "edit":
      return renderers.renderEditStage();
    case "profile":
      return renderers.renderProfileStage();
    case "process":
      return renderers.renderProcessStage();
    case "report":
      return renderers.renderReportStage();
    case "source":
    default:
      return renderers.renderSourceStage();
  }
}
export function renderLaboratoryShell(deps) {
  const activeStage = deps.activeStage;
  const escapeHtml = deps.escapeHtml;
  const featureText = deps.featureText;
  const lastActionMessage = deps.lastActionMessage;
  const renderSettingsOverlay = deps.renderSettingsOverlay;
  const renderStageContent = deps.renderStageContent;
  const renderStageRail = deps.renderStageRail;
  const dependencyCenterMarkup = renderSettingsOverlay();
  const dependencyCenterOpen = dependencyCenterMarkup.trim() !== "";
  return `
    <main
      class="lab-shell"
      data-stage="${activeStage}"
      data-center-open="${dependencyCenterOpen ? "true" : "false"}"
    >
      <div class="lab-shell__grain"></div>
      <div class="lab-shell__aura"></div>
      <aside class="lab-shell__rail">${renderStageRail()}</aside>
      <section class="lab-shell__workspace">
        <section class="lab-surface">
          ${renderStageContent()}
        </section>
        <footer class="lab-footer">
          <p class="lab-footer__note">${escapeHtml(
    lastActionMessage || featureText(["shared", "dummyHint"])
  )}</p>
        </footer>
      </section>
      ${dependencyCenterOpen ? `<div class="lab-shell__overlay">${dependencyCenterMarkup}</div>` : ""}
    </main>
  `;
}
