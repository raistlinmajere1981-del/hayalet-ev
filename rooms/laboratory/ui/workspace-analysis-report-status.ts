import { asNonEmptyString } from "../domain/lab-types.js";
import type { LabI18n } from "./lab-i18n.js";

export function formatLaboratoryAnalysisReportSummary(value: unknown, copy: LabI18n) {
  const status = asNonEmptyString(value);
  if (status === null) return copy.locale === "tr" ? "ölçüm kaydı" : "measurement record";
  const tr: Record<string, string> = {
    "background-not-comparable": "background karşılaştırılabilir değil",
    "change-localized-to-target": "target-localized değişim",
    "physical-environment-like-response": "çevre ile benzer response",
    "reference-alignment-tracking-unreliable": "background reference hizalama güvenilmez",
    "reference-convergence-uncertain": "background convergence belirsiz",
    "reference-convergence-without-strong-target-loss":
      "background convergence · target kaybı zayıf",
    "result-uncertain": "sonuç belirsiz",
    "roi-drift-may-affect-result": "ROI drift yüksek",
    "roi-tracking-quality-limits-response-result": "tracking kalitesi response sonucunu sınırlıyor",
    "roi-tracking-quality-limits-structural-result":
      "tracking kalitesi structural sonucu sınırlıyor",
    "sample-insufficient": "örnek yetersiz",
    "structural-change-scene-wide": "scene-wide structural değişim",
    "structural-change-scene-wide-with-target-excess": "scene-wide + target ek fark",
    "structural-change-target-localized": "target-localized structural değişim",
    "structural-measurement-unavailable": "structural ölçüm kullanılamadı",
    "structural-result-uncertain": "structural sonuç belirsiz",
    "target-and-background-change-together": "target/background birlikte değişiyor",
    "target-and-control-structurally-similar": "target/control benzer structural değişim",
    "target-loss-with-reference-convergence": "target kaybı + background convergence",
    "target-loss-without-reference-convergence": "target kaybı · convergence zayıf",
    "target-response-differs": "çoklu-metrik response ayrışması",
    "visibility-only-separation": "yalnız visibility ayrışması",
  };
  if (copy.locale === "tr" && tr[status] !== undefined) return tr[status];
  return status.replaceAll("-", " ");
}
