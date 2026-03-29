// @ts-nocheck
import { createLaboratoryReportExportRuntime } from "./reporting-export.js";
import { createLaboratoryFeatureReportRuntime } from "./reporting-feature-report.js";

export function createLaboratoryReportingRuntime(deps) {
  const laboratoryFeatureReportRuntime = createLaboratoryFeatureReportRuntime(deps);
  const laboratoryReportExportRuntime = createLaboratoryReportExportRuntime({
    ...deps,
    buildReportMarkdown: laboratoryFeatureReportRuntime.buildReportMarkdown,
    composeFeatureReport: laboratoryFeatureReportRuntime.composeFeatureReport,
  });

  return {
    ...laboratoryFeatureReportRuntime,
    ...laboratoryReportExportRuntime,
  };
}
