function renderSlider(label, field, value, min, max, step, unit) {
  return `
    <label class="labx-control-row">
      <span class="labx-control-row__label">${label}</span>
      <input
        class="labx-range"
        type="range"
        min="${String(min)}"
        max="${String(max)}"
        step="${String(step)}"
        value="${String(value)}"
        data-lab-field="workspace.interactive.${field}"
      />
      <span class="labx-control-row__value">${String(value)}${unit}</span>
    </label>
  `;
}
function renderToggle(label, field, active) {
  return `
    <label class="labx-control-toggle">
      <input
        type="checkbox"
        ${active ? "checked" : ""}
        data-lab-field="workspace.interactive.${field}"
      />
      <span>${label}</span>
    </label>
  `;
}
export function renderWorkspaceInteractiveControls(settings, collapsed) {
  if (collapsed) {
    return `
      <section class="labx-card labx-controls-card" data-tone="accent">
        <div class="labx-card__header">
          <div>
            <p class="labx-card__eyebrow">INTERACTIVE CONTROLS</p>
            <h2 class="labx-card__title">Visual Adjustments</h2>
          </div>
          <button class="labx-inline-action" type="button" data-lab-action="workspace-toggle-right-panel">Expand</button>
        </div>
      </section>
    `;
  }
  return `
    <section class="labx-card labx-controls-card" data-tone="accent">
      <div class="labx-card__header">
        <div>
          <p class="labx-card__eyebrow">INTERACTIVE CONTROLS</p>
          <h2 class="labx-card__title">Visual Adjustments</h2>
        </div>
        <button class="labx-inline-action" type="button" data-lab-action="workspace-toggle-right-panel">Collapse</button>
      </div>
      <div class="labx-card__body">
        <div class="labx-controls-stack">
          ${renderSlider("Brightness", "brightness", settings.brightness, 0, 200, 1, "%")}
          ${renderSlider("Contrast", "contrast", settings.contrast, 0, 200, 1, "%")}
          ${renderSlider("Gamma", "gamma", settings.gamma, 0.1, 5, 0.1, "")}
          ${renderSlider("Saturation", "saturation", settings.saturation, 0, 200, 1, "%")}
          ${renderSlider("Hue Rotate", "hueRotate", settings.hueRotate, 0, 360, 1, "°")}
          ${renderSlider("Sharpness", "sharpness", settings.sharpness, 0, 200, 1, "%")}
        </div>
        <div class="labx-controls-toggles">
          <p class="labx-card__eyebrow">CHANNEL ISOLATE</p>
          <div class="labx-toggle-row">
            ${renderToggle("R", "channelR", settings.channelR)}
            ${renderToggle("G", "channelG", settings.channelG)}
            ${renderToggle("B", "channelB", settings.channelB)}
          </div>
          ${renderToggle("Edge Highlight", "edgeHighlight", settings.edgeHighlight)}
          ${renderToggle("Invert", "invert", settings.invert)}
        </div>
        <div class="labx-controls-actions">
          <button class="labx-inline-action" type="button" data-lab-action="workspace-reset-controls">Reset All</button>
        </div>
      </div>
    </section>
  `;
}
