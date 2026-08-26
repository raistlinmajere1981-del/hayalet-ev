import { asLabRecord, asNonEmptyString, escapeHtml } from "../domain/lab-types.js";
import type { LabEditConfig } from "../domain/lab-types.js";
import { buildLaboratoryVisualResponseReportAssessment } from "../shared/visual-response-report-assessment.js";
import type { LabI18n } from "./lab-i18n.js";
import { formatLaboratoryStructuralTransitionMarkdown } from "./workspace-structural-transition-summary.js";
import { formatLaboratoryVisualReportMarkdown } from "./workspace-visual-response-summary.js";

type Entry = Record<string, unknown>;

type ReportDescriptor = {
  createdAt: string | null;
  filename: string;
  markdown: string;
  rank: number;
  status: string;
  title: string;
};

function history(editConfig: LabEditConfig | null) {
  const value = asLabRecord(editConfig)["temporalStressTests"];
  return Array.isArray(value) ? value.map((entry) => asLabRecord(entry)) : [];
}

function axisLabel(value: unknown) {
  return (asNonEmptyString(value) || "response").replaceAll("-", " ");
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

function compactStatus(value: unknown, copy: LabI18n) {
  const status = asNonEmptyString(value);
  if (status === null) return copy.locale === "tr" ? "ölçüm kaydı" : "measurement record";
  const tr: Record<string, string> = {
    "roi-drift-may-affect-result": "ROI drift yüksek",
    "structural-result-uncertain": "structural sonuç belirsiz",
    "target-and-control-structurally-similar": "target/control benzer structural değişim",
    "structural-change-target-localized": "target-localized structural değişim",
    "structural-change-scene-wide-with-target-excess": "scene-wide + target ek fark",
    "structural-change-scene-wide": "scene-wide structural değişim",
    "result-uncertain": "sonuç belirsiz",
    "sample-insufficient": "örnek yetersiz",
    "background-not-comparable": "background karşılaştırılabilir değil",
    "visibility-only-separation": "yalnız visibility ayrışması",
    "target-response-differs": "çoklu-metrik response ayrışması",
    "target-and-background-change-together": "target/background birlikte değişiyor",
    "physical-environment-like-response": "çevre ile benzer response",
    "change-localized-to-target": "target-localized değişim",
  };
  if (copy.locale === "tr" && tr[status] !== undefined) return tr[status];
  return status.replaceAll("-", " ");
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
  return compactStatus(
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

function createDescriptor(
  entry: Entry,
  input: {
    markdown: string;
    rank: number;
    status: string;
    title: string;
  }
): ReportDescriptor {
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

function describeEntry(entry: Entry, copy: LabI18n): ReportDescriptor[] {
  const kind = asNonEmptyString(entry["kind"]);
  if (kind === "visibility-response") {
    const request = asLabRecord(entry["request"]);
    const assessment = asLabRecord(buildLaboratoryVisualResponseReportAssessment(entry));
    const title = `Visibility Response · ${axisLabel(request["axis"])}`;
    return [
      createDescriptor(entry, {
        markdown: formatLaboratoryVisualReportMarkdown(entry, copy),
        rank: 20,
        status: compactStatus(assessment["classification"], copy),
        title,
      }),
    ];
  }

  if (kind === "appearance-transition") {
    const interpretation = asLabRecord(entry["interpretation"]);
    const structural = asLabRecord(entry["structural"]);
    const descriptors: ReportDescriptor[] = [];
    if (Object.keys(structural).length > 0) {
      const assessment = asLabRecord(structural["assessment"]);
      const structuralStatus =
        structural["status"] === "unavailable"
          ? copy.locale === "tr"
            ? "structural ölçüm kullanılamadı"
            : "structural measurement unavailable"
          : compactStatus(assessment["classification"], copy);
      const title = "Structural Transition";
      descriptors.push(
        createDescriptor(entry, {
          markdown:
            structural["status"] === "unavailable"
              ? genericMarkdown(entry, title)
              : formatLaboratoryStructuralTransitionMarkdown(entry, copy),
          rank: 0,
          status: structuralStatus,
          title,
        })
      );
    }
    const title = "Appearance / Disappearance Transition";
    descriptors.push(
      createDescriptor(entry, {
        markdown: formatLaboratoryVisualReportMarkdown(entry, copy),
        rank: 10,
        status: compactStatus(
          interpretation["photometricClassification"] ?? interpretation["classification"],
          copy
        ),
        title,
      })
    );
    return descriptors;
  }

  if (kind === "recompression-ladder") {
    const title = "Codec Degradation · CRF ladder";
    return [
      createDescriptor(entry, {
        markdown: formatLaboratoryVisualReportMarkdown(entry, copy),
        rank: 30,
        status: genericStatus(entry, copy),
        title,
      }),
    ];
  }

  const title = genericTitle(entry, copy);
  return [
    createDescriptor(entry, {
      markdown: genericMarkdown(entry, title),
      rank: 100,
      status: genericStatus(entry, copy),
      title,
    }),
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
      const leftTime = left.createdAt === null ? Number.NEGATIVE_INFINITY : Date.parse(left.createdAt);
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