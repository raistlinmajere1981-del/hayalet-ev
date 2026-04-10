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
  return `
    <main class="lab-shell" data-stage="${activeStage}">
      <div class="lab-shell__grain"></div>
      <div class="lab-shell__aura"></div>
      ${renderStageRail()}
      <section class="lab-surface">
        ${renderStageContent()}
      </section>
      <footer class="lab-footer">
        <p class="lab-footer__note">${escapeHtml(lastActionMessage || featureText(["shared", "dummyHint"]))}</p>
      </footer>
      ${renderSettingsOverlay()}
    </main>
  `;
}
