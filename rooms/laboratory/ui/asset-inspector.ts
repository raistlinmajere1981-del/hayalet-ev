import { asLabRecord, asNonEmptyString, escapeHtml, formatBytes } from "../models/lab-types.js";
import type { LabAsset, LabStoreState } from "../models/lab-types.js";
import { getLabAssetPreviewKind, getLabAssetPreviewUrl } from "./lab-asset-display.js";
import { LAB_FALLBACK_I18N } from "./lab-i18n.js";
import type { LabI18n } from "./lab-i18n.js";

function getSelectedEntity(state: LabStoreState): LabAsset | null {
  const ids = state.ui.projectWorkspaceSelectedEntityIds;
  if (ids.length === 0) {
    return null;
  }
  const targetId = ids[0];
  if (targetId === undefined) {
    return null;
  }
  return (
    state.assets.find(function (asset) {
      return asset.id === targetId;
    }) || null
  );
}

function formatEntityTime(value: number): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "\u2014";
  }
  return date.toLocaleString("tr-TR", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatAssetTypeLabel(asset: LabAsset, copy: LabI18n): string {
  switch (asset.type) {
    case "source":
      return copy.t("mediaAnalysis.projectWorkspace.assetTypeSource", "Source");
    case "clip":
      return copy.t("mediaAnalysis.projectWorkspace.assetTypeClip", "Clip");
    case "frame":
      return copy.t("mediaAnalysis.projectWorkspace.assetTypeFrame", "Frame");
    case "audio":
      return copy.t("mediaAnalysis.projectWorkspace.assetTypeAudio", "Audio");
    case "image":
      return copy.t("mediaAnalysis.projectWorkspace.assetTypeImage", "Image");
    case "report":
      return copy.t("mediaAnalysis.projectWorkspace.assetTypeReport", "Report");
    case "artifact":
      return copy.t("mediaAnalysis.projectWorkspace.assetTypeArtifact", "Artifact");
    default:
      return String((asset as { type: string }).type);
  }
}

function formatIntentLabel(intentId: string, copy: LabI18n): string {
  switch (intentId) {
    case "visual-inspection":
      return copy.t("mediaAnalysis.projectWorkspace.intentVisualInspection", "Visual Inspection");
    case "audio-investigation":
      return copy.t(
        "mediaAnalysis.projectWorkspace.intentAudioInvestigation",
        "Audio Investigation"
      );
    case "detail-enhancement":
      return copy.t("mediaAnalysis.projectWorkspace.intentDetailEnhancement", "Detail Enhancement");
    case "anomaly-detection":
      return copy.t("mediaAnalysis.projectWorkspace.intentAnomalyDetection", "Anomaly Detection");
    default:
      return copy.t("mediaAnalysis.projectWorkspace.intentGeneral", "General");
  }
}

function buildRunContext(asset: LabAsset, state: LabStoreState, copy: LabI18n): string {
  const runId = asNonEmptyString(asset.runId);
  if (runId === null) {
    return copy.t("mediaAnalysis.projectWorkspace.runManual", "Manually added");
  }

  const intentIds = asset.intentIds;
  const intentLabel =
    Array.isArray(intentIds) && intentIds.length > 0
      ? intentIds
          .map(function (intentId) {
            return formatIntentLabel(intentId, copy);
          })
          .join(" + ")
      : null;

  const metadata = asLabRecord(asset.metadata);
  const selectionStart = Number(metadata["selectionStartMs"]);
  const selectionEnd = Number(metadata["selectionEndMs"]);
  let rangeLabel = "";
  if (
    Number.isFinite(selectionStart) &&
    Number.isFinite(selectionEnd) &&
    selectionEnd > selectionStart
  ) {
    const fmt = function (ms: number) {
      const totalSec = Math.round(ms / 1000);
      const m = Math.floor(totalSec / 60);
      const s = totalSec % 60;
      return `${String(m)}:${String(s).padStart(2, "0")}`;
    };
    rangeLabel = ` (${fmt(selectionStart)}\u2013${fmt(selectionEnd)})`;
  }

  const parts: string[] = [];
  if (intentLabel !== null) {
    parts.push(intentLabel + rangeLabel);
  }

  if (state.run && state.run.id === runId) {
    const elapsed = Date.now() - (state.run.startedAt || Date.now());
    const minutes = Math.round(elapsed / 60000);
    if (minutes < 1) {
      parts.push(
        copy.t("mediaAnalysis.projectWorkspace.runCurrentJustNow", "Current run - just now")
      );
    } else {
      parts.push(
        copy.t(
          "mediaAnalysis.projectWorkspace.runCurrentMinutesAgo",
          "Current run - {minutes} min ago",
          {
            minutes,
          }
        )
      );
    }
  } else {
    parts.push(copy.t("mediaAnalysis.projectWorkspace.runPrevious", "Previous run"));
  }

  return parts.join("\n");
}

function buildMeaningPlaceholder(asset: LabAsset, copy: LabI18n): string {
  switch (asset.type) {
    case "report":
      return copy.t(
        "mediaAnalysis.projectWorkspace.meaningReport",
        "This report summarizes findings from the analysis pipeline."
      );
    case "clip":
      return copy.t(
        "mediaAnalysis.projectWorkspace.meaningClip",
        "This segment was extracted for closer examination."
      );
    case "frame":
      return copy.t(
        "mediaAnalysis.projectWorkspace.meaningFrame",
        "This frame was captured at a point of interest."
      );
    case "audio":
      return copy.t(
        "mediaAnalysis.projectWorkspace.meaningAudio",
        "This audio track was isolated for signal analysis."
      );
    case "image":
      return copy.t(
        "mediaAnalysis.projectWorkspace.meaningImage",
        "This image was added for visual reference."
      );
    case "source":
      return copy.t(
        "mediaAnalysis.projectWorkspace.meaningSource",
        "This is the primary source material for analysis."
      );
    case "artifact":
      return copy.t(
        "mediaAnalysis.projectWorkspace.meaningArtifact",
        "This artifact was generated during the analysis process."
      );
    default:
      return copy.t(
        "mediaAnalysis.projectWorkspace.meaningDefault",
        "Entity context will be enriched as analysis progresses."
      );
  }
}

function renderPreview(asset: LabAsset): string {
  const previewUrl = getLabAssetPreviewUrl(asset);
  const previewKind =
    previewUrl === null
      ? "unsupported"
      : getLabAssetPreviewKind(asset, previewUrl, { usesThumbnail: true });

  if (previewUrl !== null && previewKind === "image") {
    return `<div class="labx-pw-inspector__preview"><img class="labx-pw-inspector__preview-media" src="${escapeHtml(previewUrl)}" alt="${escapeHtml(asset.name)}" /></div>`;
  }

  if (previewUrl !== null && previewKind === "video") {
    return `<div class="labx-pw-inspector__preview"><video class="labx-pw-inspector__preview-media labx-pw-inspector__preview-media--video" src="${escapeHtml(previewUrl)}" controls preload="metadata" playsinline></video></div>`;
  }

  if (previewUrl !== null && previewKind === "audio") {
    return `<div class="labx-pw-inspector__preview"><audio controls preload="metadata" style="width:100%"><source src="${escapeHtml(previewUrl)}" /></audio></div>`;
  }

  if (previewUrl !== null && previewKind === "document") {
    return `<div class="labx-pw-inspector__preview"><iframe class="labx-pw-inspector__preview-document" src="${escapeHtml(previewUrl)}" title="${escapeHtml(asset.name)}"></iframe></div>`;
  }

  const labels: Record<string, string> = {
    source: "SRC",
    clip: "CLP",
    frame: "FRM",
    audio: "AUD",
    image: "IMG",
    report: "RPT",
    artifact: "AST",
  };
  return `<div class="labx-pw-inspector__preview"><span class="labx-pw-inspector__preview-monogram">${escapeHtml(labels[asset.type] || "ENT")}</span></div>`;
}

function renderMetadata(asset: LabAsset, copy: LabI18n): string {
  const metadata = asLabRecord(asset.metadata);
  const rows: Array<{ label: string; value: string }> = [
    { label: copy.t("mediaAnalysis.projectWorkspace.metadataName", "Name"), value: asset.name },
    {
      label: copy.t("mediaAnalysis.projectWorkspace.metadataType", "Type"),
      value: formatAssetTypeLabel(asset, copy),
    },
    {
      label: copy.t("mediaAnalysis.projectWorkspace.metadataCreated", "Created"),
      value: formatEntityTime(asset.createdAt),
    },
  ];

  const duration = Number(metadata["duration"]);
  if (Number.isFinite(duration) && duration > 0) {
    const totalSec = Math.round(duration);
    const m = Math.floor(totalSec / 60);
    const s = totalSec % 60;
    rows.push({
      label: copy.t("mediaAnalysis.projectWorkspace.metadataDuration", "Duration"),
      value: `${String(m)}:${String(s).padStart(2, "0")}`,
    });
  }

  const width = Number(metadata["width"]);
  const height = Number(metadata["height"]);
  if (Number.isFinite(width) && Number.isFinite(height) && width > 0 && height > 0) {
    rows.push({
      label: copy.t("mediaAnalysis.projectWorkspace.metadataResolution", "Resolution"),
      value: `${Math.round(width)}\u00D7${Math.round(height)}`,
    });
  }

  const size = Number(metadata["size"]);
  if (Number.isFinite(size) && size > 0) {
    rows.push({
      label: copy.t("mediaAnalysis.projectWorkspace.metadataSize", "Size"),
      value: formatBytes(size),
    });
  }

  return rows
    .map(function (row) {
      return `<div class="labx-pw-inspector__meta-row"><span class="labx-pw-inspector__meta-label">${escapeHtml(row.label)}</span><span>${escapeHtml(row.value)}</span></div>`;
    })
    .join("");
}

function canUseAsSource(asset: LabAsset): boolean {
  return (
    asNonEmptyString(asset.localPath) !== null &&
    (asset.type === "source" ||
      asset.type === "clip" ||
      asset.type === "frame" ||
      asset.type === "audio" ||
      asset.type === "image")
  );
}

function canDownloadAsset(asset: LabAsset): boolean {
  return asNonEmptyString(asset.url) !== null || asNonEmptyString(asset.localPath) !== null;
}

function renderActions(asset: LabAsset, state: LabStoreState, copy: LabI18n): string {
  const escapedId = escapeHtml(asset.id);
  const confirmReplace = state.ui.projectWorkspaceConfirmReplace === asset.id;
  const actions: string[] = [];

  if (canUseAsSource(asset)) {
    if (confirmReplace) {
      actions.push(`
        <div class="labx-pw-inspector__confirm">
          <span>${escapeHtml(copy.t("mediaAnalysis.projectWorkspace.replaceWarning", "This will replace current source"))}</span>
          <div class="labx-pw-inspector__confirm-actions">
            <button class="labx-pw-inspector__confirm-btn labx-pw-inspector__confirm-btn--replace" type="button" data-lab-action="project-workspace-confirm-use-source" data-lab-value="${escapedId}">${escapeHtml(copy.t("mediaAnalysis.projectWorkspace.replace", "Replace"))}</button>
            <button class="labx-pw-inspector__confirm-btn" type="button" data-lab-action="project-workspace-cancel-replace">${escapeHtml(copy.t("mediaAnalysis.projectWorkspace.cancel", "Cancel"))}</button>
          </div>
        </div>
      `);
    } else {
      actions.push(
        `<button class="labx-pw-inspector__action-btn labx-pw-inspector__action-btn--accent" type="button" data-lab-action="project-workspace-use-source" data-lab-value="${escapedId}">${escapeHtml(copy.t("mediaAnalysis.projectWorkspace.useAsAnalyzeSource", "Use as Analyze Source"))}</button>`
      );
    }
  }

  if (asset.type === "report") {
    actions.push(
      `<button class="labx-pw-inspector__action-btn" type="button" data-lab-action="project-workspace-open-report" data-lab-value="${escapedId}">${escapeHtml(copy.t("mediaAnalysis.projectWorkspace.openReport", "Open Report"))}</button>`
    );
  }

  const metadata = asLabRecord(asset.metadata);
  const selectionStartMs = Number(metadata["selectionStartMs"]);
  if (Number.isFinite(selectionStartMs) && selectionStartMs >= 0) {
    actions.push(
      `<button class="labx-pw-inspector__action-btn" type="button" data-lab-action="project-workspace-jump-timeline" data-lab-value="${String(selectionStartMs)}">${escapeHtml(copy.t("mediaAnalysis.projectWorkspace.jumpTimeline", "Jump to Timeline"))}</button>`
    );
  }

  if (canDownloadAsset(asset)) {
    actions.push(
      `<button class="labx-pw-inspector__action-btn" type="button" data-lab-action="asset-download" data-lab-value="${escapedId}">${escapeHtml(copy.t("mediaAnalysis.projectWorkspace.download", "Download"))}</button>`
    );
  }

  actions.push(
    `<button class="labx-pw-inspector__action-btn labx-pw-inspector__action-btn--danger" type="button" data-lab-action="project-workspace-delete" data-lab-value="${escapedId}">${escapeHtml(copy.t("mediaAnalysis.projectWorkspace.delete", "Delete"))}</button>`
  );

  actions.push(
    `<button class="labx-pw-inspector__action-btn" type="button" data-lab-action="project-workspace-send-to-ai" data-lab-value="${escapedId}" disabled>${escapeHtml(copy.t("mediaAnalysis.projectWorkspace.sendToAi", "Send to AI"))}</button>`
  );

  return actions.join("");
}

export function renderAssetInspector(
  state: LabStoreState,
  copy: LabI18n = LAB_FALLBACK_I18N
): string {
  const entity = getSelectedEntity(state);

  if (entity === null) {
    return `
      <aside class="labx-pw-inspector labx-pw-inspector--empty" aria-label="${escapeHtml(copy.t("mediaAnalysis.projectWorkspace.inspector", "Inspector"))}">
        <span>${escapeHtml(copy.t("mediaAnalysis.projectWorkspace.selectEntity", "Select an entity to inspect"))}</span>
      </aside>
    `;
  }

  const runContext = buildRunContext(entity, state, copy);
  const meaning = buildMeaningPlaceholder(entity, copy);

  return `
    <aside class="labx-pw-inspector" aria-label="${escapeHtml(copy.t("mediaAnalysis.projectWorkspace.inspector", "Inspector"))}">
      ${renderPreview(entity)}

      <div class="labx-pw-inspector__section">
        <div class="labx-pw-inspector__section-title">${escapeHtml(copy.t("mediaAnalysis.projectWorkspace.sectionMetadata", "Metadata"))}</div>
        ${renderMetadata(entity, copy)}
      </div>

      <div class="labx-pw-inspector__section">
        <div class="labx-pw-inspector__section-title">${escapeHtml(copy.t("mediaAnalysis.projectWorkspace.sectionRunContext", "Run Context"))}</div>
        <div class="labx-pw-inspector__meta-row" style="flex-direction:column;gap:0.15rem">
          ${runContext
            .split("\n")
            .map(function (line) {
              return `<span style="font-size:0.78rem;color:var(--labx-text-soft)">${escapeHtml(line)}</span>`;
            })
            .join("")}
        </div>
      </div>

      <div class="labx-pw-inspector__section">
        <div class="labx-pw-inspector__section-title">${escapeHtml(copy.t("mediaAnalysis.projectWorkspace.sectionMeaning", "Why this matters"))}</div>
        <div class="labx-pw-inspector__meaning">${escapeHtml(meaning)}</div>
      </div>

      <div class="labx-pw-inspector__actions">
        ${renderActions(entity, state, copy)}
      </div>
    </aside>
  `;
}
