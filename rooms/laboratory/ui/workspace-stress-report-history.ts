import { asLabRecord, asNonEmptyString, escapeHtml } from "../domain/lab-types.js";
import type {
  AnalysisReportDescriptor,
  AnalysisReportModel,
  LaboratoryHistoryEntry,
} from "../domain/lab-analysis-results.js";
import type { LabEditConfig } from "../domain/lab-types.js";
import type { LabI18n } from "./lab-i18n.js";
import { formatLaboratoryAnalysisReportSummary } from "./workspace-analysis-report-status.js";
import { buildLaboratoryStructuralTransitionReportModel } from "./workspace-structural-transition-summary.js";
import {
  buildLaboratoryVisualReportModel,
  formatLaboratoryVisualReportMarkdown,
} from "./workspace-visual-response-summary.js";

type Entry = Record<string, unknown>;

function history(editConfig: LabEditConfig | null): LaboratoryHistoryEntry[] {
  return editConfig?.temporalStressTests ?? [];
}

function formatCreatedTime(value: string | null) {
  if (value === null) return "—";
  const isoTime = value.match(/T(\d{2}:\d{2}:\d{2})/);
  return isoTime?.[1] ?? value;
}

function safeSlug(value: string) {
  const slug = value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48);
  return slug === "" ? "report" : slug;
}

function genericTitle(entry: Entry, copy: LabI18n) {
  const kind = asNonEmptyString(entry["kind"]) || "measurement";
  const request = asLabRecord(entry["request"]);
  if (kind === "motion-vector-probe") return "Motion Vector Probe";
  if (kind === "motion-reference-lock") return "Motion Reference Lock";
  if (kind === "impact-window-compare") return "Impact Window Compare";
  if (kind === "control-injection") {
    const controlKind = asNonEmptyString(request["kind"]) || "control";
    return `Control · ${controlKind.replaceAll("-", " ")}`;
  }
  if (kind === "temporal-stress-test") return "Temporal Stress Test";
  return copy.locale === "tr"
    ? `Ölçüm · ${kind.replaceAll("-", " ")}`
    : `Measurement · ${kind.replaceAll("-", " ")}`;
}

function genericStatus(entry: Entry, copy: LabI18n) {
  const interpretation = asLabRecord(entry["interpretation"]);
  return formatLaboratoryAnalysisReportSummary(
    interpretation["classification"] ??
      interpretation["overallImpact"] ??
      interpretation["dataQuality"] ??
      entry["status"],
    copy
  );
}

function genericMarkdown(entry: Entry, title: string) {
  const lines = [`# Hayalet Ev Laboratory — ${title}`];
  const createdAt = asNonEmptyString(entry["createdAt"]);
  const sourcePath = asNonEmptyString(entry["sourcePath"]);
  if (createdAt !== null) lines.push(`- Created: ${createdAt}`);
  if (sourcePath !== null) lines.push(`- Source: ${sourcePath}`);
  lines.push(
    "- Interpretation policy: measurement record; no real/fake or mechanism verdict.",
    "",
    "## Record",
    "```json",
    JSON.stringify(entry, null, 2),
    "```"
  );
  return lines.join("\n");
}

type DescriptorInput = {
  markdown: string;
  rank: number;
  status: string;
  title: string;
};

function createCanonicalDescriptor(
  model: AnalysisReportModel,
  input: DescriptorInput
): AnalysisReportDescriptor & { filename: string; rank: number } {
  const descriptor: AnalysisReportDescriptor = {
    classification: model.classification,
    createdAt: model.createdAt,
    id: model.id,
    kind: model.kind,
    markdown: input.markdown,
    status: input.status,
    title: input.title,
  };
  return {
    ...descriptor,
    filename: `laboratory-${safeSlug(input.title)}-${safeSlug(model.id)}`,
    rank: input.rank,
  };
}

function createGenericDescriptor(entry: Entry, input: DescriptorInput) {
  const createdAt = asNonEmptyString(entry["createdAt"]);
  const id = asNonEmptyString(entry["id"]);
  const identity = id ?? createdAt ?? `rank-${String(input.rank)}`;
  return {
    createdAt,
    filename: `laboratory-${safeSlug(input.title)}-${safeSlug(identity)}`,
    markdown: input.markdown,
    rank: input.rank,
    status: input.status,
    title: input.title,
  };
}

type HistoryReportDescriptor =
  ReturnType<typeof createCanonicalDescriptor> | ReturnType<typeof createGenericDescriptor>;

function createDescriptor(
  entry: Entry,
  input: DescriptorInput,
  model: AnalysisReportModel | null
): HistoryReportDescriptor {
  if (model !== null && model.createdAt !== "" && model.id !== "") {
    return createCanonicalDescriptor(model, input);
  }
  return createGenericDescriptor(entry, input);
}

function formatReportModel(model: AnalysisReportModel) {
  return model.sections.map((section) => section.lines.join("\n")).join("\n");
}

function describeEntry(
  historyEntry: LaboratoryHistoryEntry,
  copy: LabI18n
): HistoryReportDescriptor[] {
  const entry = asLabRecord(historyEntry);
  const kind = asNonEmptyString(entry["kind"]);
  if (kind === "visibility-response") {
    const model = buildLaboratoryVisualReportModel(entry, copy);
    if (model === null) return [];
    return [
      createDescriptor(
        entry,
        {
          markdown: formatReportModel(model),
          rank: 20,
          status: model.summary,
          title: model.title,
        },
        model
      ),
    ];
  }

  if (kind === "appearance-transition") {
    const structuralModel = buildLaboratoryStructuralTransitionReportModel(entry, copy);
    const visualModel = buildLaboratoryVisualReportModel(entry, copy);
    const descriptors: HistoryReportDescriptor[] = [
      createDescriptor(
        entry,
        {
          markdown:
            structuralModel.status === "unavailable"
              ? genericMarkdown(entry, structuralModel.title)
              : formatReportModel(structuralModel),
          rank: 0,
          status: structuralModel.summary,
          title: structuralModel.title,
        },
        structuralModel
      ),
    ];
    if (visualModel !== null) {
      descriptors.push(
        createDescriptor(
          entry,
          {
            markdown: formatReportModel(visualModel),
            rank: 10,
            status: visualModel.summary,
            title: visualModel.title,
          },
          visualModel
        )
      );
    }
    return descriptors;
  }

  if (kind === "recompression-ladder") {
    const title = "Codec Degradation · CRF ladder";
    return [
      createDescriptor(
        entry,
        {
          markdown: formatLaboratoryVisualReportMarkdown(entry, copy),
          rank: 30,
          status: genericStatus(entry, copy),
          title,
        },
        null
      ),
    ];
  }

  const title = genericTitle(entry, copy);
  return [
    createDescriptor(
      entry,
      {
        markdown: genericMarkdown(entry, title),
        rank: 100,
        status: genericStatus(entry, copy),
        title,
      },
      null
    ),
  ];
}

export function buildLaboratoryStressReportHistory(
  editConfig: LabEditConfig | null,
  copy: LabI18n
) {
  return history(editConfig)
    .flatMap(function (entry) {
      return describeEntry(entry, copy);
    })
    .sort(function (left, right) {
      const leftTime =
        left.createdAt === null ? Number.NEGATIVE_INFINITY : Date.parse(left.createdAt);
      const rightTime =
        right.createdAt === null ? Number.NEGATIVE_INFINITY : Date.parse(right.createdAt);
      const safeLeft = Number.isFinite(leftTime) ? leftTime : Number.NEGATIVE_INFINITY;
      const safeRight = Number.isFinite(rightTime) ? rightTime : Number.NEGATIVE_INFINITY;
      if (safeLeft !== safeRight) return safeRight - safeLeft;
      return left.rank - right.rank;
    });
}

function reportActions(markdown: string, copy: LabI18n) {
  const copyLabel = copy.locale === "tr" ? "Kopyala" : "Copy";
  const copiedLabel = copy.locale === "tr" ? "Kopyalandı" : "Copied";
  const exportLabel = copy.locale === "tr" ? "MD Dışa Aktar" : "Export MD";
  const exportedLabel = copy.locale === "tr" ? "Dışa aktarıldı" : "Exported";
  const failedLabel = copy.locale === "tr" ? "Başarısız" : "Failed";
  return `
    <div class="labx-controls-actions labx-visual-report-actions labx-report-history__actions">
      <button class="labx-inline-action" type="button" data-lab-report-copy="true" data-lab-report-idle-label="${escapeHtml(copyLabel)}" data-lab-report-success-label="${escapeHtml(copiedLabel)}" data-lab-report-error-label="${escapeHtml(failedLabel)}">${escapeHtml(copyLabel)}</button>
      <button class="labx-inline-action" type="button" data-lab-report-export="true" data-lab-report-idle-label="${escapeHtml(exportLabel)}" data-lab-report-success-label="${escapeHtml(exportedLabel)}" data-lab-report-error-label="${escapeHtml(failedLabel)}">${escapeHtml(exportLabel)}</button>
    </div>
    <textarea hidden data-lab-report-markdown="true">${escapeHtml(markdown)}</textarea>`;
}

export function renderLaboratoryStressReportHistory(
  editConfig: LabEditConfig | null,
  copy: LabI18n
) {
  const reports = buildLaboratoryStressReportHistory(editConfig, copy);
  if (reports.length === 0) return "";
  const latestLabel = copy.locale === "tr" ? "Son" : "Latest";
  return `
    <section class="labx-report-history" data-lab-stress-report-history="true">
      ${reports
        .map(function (report, index) {
          return `
            <article class="labx-report-history__item" data-lab-exportable-report="true" data-lab-report-filename="${escapeHtml(report.filename)}" data-lab-report-latest="${index === 0 ? "true" : "false"}">
              <div class="labx-report-history__identity">
                <div class="labx-report-history__title-row">
                  <strong>${escapeHtml(report.title)}</strong>
                  ${index === 0 ? `<span class="labx-report-history__latest">${escapeHtml(latestLabel)}</span>` : ""}
                </div>
                <span class="labx-report-history__meta">${escapeHtml(`${formatCreatedTime(report.createdAt)} · ${report.status}`)}</span>
              </div>
              ${reportActions(report.markdown, copy)}
            </article>`;
        })
        .join("")}
    </section>`;
}
