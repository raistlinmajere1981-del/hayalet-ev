import { asLabRecord, escapeHtml } from "../domain/lab-types.js";
import type { LabStoreState } from "../domain/lab-types.js";
import { resolveLaboratoryTrackingPreviewCache } from "../shared/tracking-preview-model.js";
import type { LabI18n } from "./lab-i18n.js";

function finite(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function renderTrackingPreviewSurface(
  state: LabStoreState,
  sourceUrl: string | null,
  copy: LabI18n
) {
  const source = asLabRecord(state.source);
  const metadata = asLabRecord(source["metadata"]);
  const cache = resolveLaboratoryTrackingPreviewCache(state.editConfig, {
    sourceHeight: finite(metadata["height"]),
    sourceWidth: finite(metadata["width"]),
  });
  const rois = {
    target: state.ui.workspace.activeSelection?.roi ?? null,
    control: state.ui.workspace.comparisonRois.primary,
    background: state.ui.workspace.comparisonRois.reference,
  };
  const unavailable = copy.t(
    "mediaAnalysis.timeline.trackingPreviewSourceUnavailable",
    "Tracking Preview source video is unavailable."
  );

  return `
    <section
      class="labx-tracking-preview-surface"
      data-lab-tracking-preview-surface="true"
      data-lab-tracking-preview-cache-json="${escapeHtml(JSON.stringify(cache))}"
      data-lab-tracking-preview-rois-json="${escapeHtml(JSON.stringify(rois))}"
      data-lab-tracking-preview-active="true"
      aria-label="${escapeHtml(copy.t("mediaAnalysis.timeline.trackingPreviewPaneLabel", "Tracking Preview"))}"
    >
      ${
        sourceUrl === null
          ? `<div class="labx-tracking-preview-empty">${escapeHtml(unavailable)}</div>`
          : `<div class="labx-tracking-preview-media-shell" data-lab-tracking-preview-media-shell="true">
              <video
                class="labx-preview-media labx-tracking-preview-media"
                muted
                preload="metadata"
                src="${escapeHtml(sourceUrl)}"
                playsinline
                data-lab-preserve-media="tracking-preview"
                data-lab-tracking-preview-video="true"
                aria-label="${escapeHtml(copy.t("mediaAnalysis.timeline.trackingPreviewVideoLabel", "Camera Tracking v2 preview"))}"
              ></video>
              <div class="labx-tracking-preview-frame" data-lab-tracking-preview-frame="true" aria-hidden="true"></div>
            </div>`
      }
      <p class="labx-tracking-preview-detail" data-lab-tracking-preview-detail="true"></p>
    </section>
  `;
}

export function renderWorkspaceTrackingComparison(input: {
  copy: LabI18n;
  rawPlayerMarkup: string;
  sourceUrl: string | null;
  state: LabStoreState;
}) {
  const rawLabel = input.copy.t("mediaAnalysis.timeline.trackingPreviewRawPaneLabel", "Raw Player");
  const trackingLabel = input.copy.t(
    "mediaAnalysis.timeline.trackingPreviewPaneLabel",
    "Tracking Preview"
  );

  return `
    <div
      class="labx-workspace-comparison labx-workspace-tracking-comparison"
      data-mode="paired"
      data-lab-workspace-tracking-comparison="true"
    >
      <figure class="labx-workspace-comparison__pane" data-active="false" data-side="raw">
        <div class="labx-workspace-comparison__media-stage" data-lab-tracking-preview-pane="raw">
          ${input.rawPlayerMarkup}
        </div>
        <figcaption>A ${escapeHtml(rawLabel)}</figcaption>
      </figure>
      <figure class="labx-workspace-comparison__pane" data-active="true" data-side="tracking">
        <div class="labx-workspace-comparison__media-stage" data-lab-tracking-preview-pane="tracking">
          ${renderTrackingPreviewSurface(input.state, input.sourceUrl, input.copy)}
        </div>
        <figcaption>B ${escapeHtml(trackingLabel)}</figcaption>
      </figure>
    </div>
  `;
}
