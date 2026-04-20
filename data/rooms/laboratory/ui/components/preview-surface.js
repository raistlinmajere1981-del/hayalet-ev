import { escapeHtml } from "../../models/lab-types.js";
function readPreviewUrl(artifact) {
  if (!artifact) {
    return null;
  }
  return artifact.previewUrl || artifact.path || null;
}
function getPreviewKind(artifact) {
  const source = (readPreviewUrl(artifact) || artifact?.fileName || artifact?.kind || "").toLowerCase();
  if (source.endsWith(".wav") || source.endsWith(".mp3") || source.endsWith(".flac")) {
    return "audio";
  }
  if (source.endsWith(".mp4") || source.endsWith(".webm") || source.endsWith(".mov")) {
    return "video";
  }
  if (source.endsWith(".png") || source.endsWith(".jpg") || source.endsWith(".jpeg") || source.endsWith(".webp")) {
    return "image";
  }
  return "text";
}
function renderActivePreview(artifact) {
  if (!artifact) {
    return `
      <div class="labx-empty-state">
        <strong class="labx-empty-state__title">Aktif preview yok</strong>
        <p class="labx-empty-state__description">Preview artifact uretildiginde tek aktif surface burada görünür.</p>
      </div>
    `;
  }
  const previewUrl = readPreviewUrl(artifact);
  const previewKind = getPreviewKind(artifact);
  if (previewUrl && previewKind === "image") {
    return `<img class="labx-preview-media labx-preview-media--image" src="${escapeHtml(previewUrl)}" alt="${escapeHtml(artifact.label || artifact.fileName || artifact.id)}" />`;
  }
  if (previewUrl && previewKind === "audio") {
    return `<audio class="labx-preview-media labx-preview-media--audio" src="${escapeHtml(previewUrl)}" controls preload="metadata"></audio>`;
  }
  if (previewUrl && previewKind === "video") {
    return `<video class="labx-preview-media labx-preview-media--video" src="${escapeHtml(previewUrl)}" controls preload="metadata" playsinline></video>`;
  }
  return `
    <div class="labx-preview-surface__placeholder">
      <strong>${escapeHtml(artifact.label || artifact.fileName || artifact.kind || artifact.id)}</strong>
      <p class="labx-panel-hint">${escapeHtml(previewUrl || "Preview surface has no direct media URL.")}</p>
    </div>
  `;
}
function getVariantArtifactId(variant, previewArtifacts) {
  return variant.artifactId || variant.artifactIds[0] || previewArtifacts.find(function(artifact) {
    return artifact.variantId === variant.id;
  })?.id || null;
}
export function renderPreviewSurface(options) {
  const variantList = options.comparisonVariants.length > 0 ? options.comparisonVariants : options.previewArtifacts.map(function(artifact) {
    return {
      id: artifact.variantId || artifact.id,
      label: artifact.label || artifact.fileName || artifact.kind || artifact.id,
      status: artifact.status,
      artifactIds: [artifact.id],
      active: artifact.active
    };
  });
  return `
    <div class="labx-preview-card labx-preview-card--process">
      <div class="labx-preview-frame labx-preview-frame--process">
        ${renderActivePreview(options.activeArtifact)}
      </div>
      ${options.activeArtifact ? `
            <div class="labx-preview-meta">
              <div class="labx-preview-row">
                <span>Active surface</span>
                <strong>${escapeHtml(
    options.activeArtifact.label || options.activeArtifact.fileName || options.activeArtifact.kind || options.activeArtifact.id
  )}</strong>
              </div>
              <div class="labx-preview-row">
                <span>Status</span>
                <strong>${escapeHtml(options.activeArtifact.status || "ready")}</strong>
              </div>
            </div>
          ` : ""}
      ${variantList.length > 1 ? `
            <div class="labx-list-stack">
              ${variantList.map(function(variant) {
    const artifactId = getVariantArtifactId(variant, options.previewArtifacts);
    const active = artifactId !== null && options.activeArtifact ? options.activeArtifact.id === artifactId : variant.active === true;
    return `
                    <article class="labx-choice-row">
                      <div>
                        <strong>${escapeHtml(variant.label)}</strong>
                        <p class="labx-panel-hint">${escapeHtml(variant.summary || variant.status)}</p>
                      </div>
                      <button
                        class="labx-inline-action"
                        type="button"
                        data-lab-action="preview-artifact"
                        data-lab-value="${escapeHtml(artifactId || "")}"
                        ${artifactId === null ? "disabled" : ""}
                      >
                        ${active ? "Aktif" : "Ac"}
                      </button>
                    </article>
                  `;
  }).join("")}
            </div>
          ` : ""}
    </div>
  `;
}
