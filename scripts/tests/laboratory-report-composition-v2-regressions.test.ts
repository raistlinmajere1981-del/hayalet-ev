import test from "node:test";
import assert from "node:assert/strict";

import { createLaboratoryReportExportRuntime } from "../../rooms/laboratory/shared/host/reporting-export.ts";

test("laboratory subtitle report export carries AI payload and channel batch artifacts into exports", async () => {
  const writes: Array<{ path: string; value: string }> = [];
  let persistedExports: Array<Record<string, unknown>> = [];
  const project = {
    id: "project-1",
    slug: "lab-project",
    report: {
      records: {
        "subtitle-analysis": {
          exports: [],
        },
      },
    },
  };
  const runtime = createLaboratoryReportExportRuntime({
    buildReportMarkdown() {
      return "# Laboratory Report";
    },
    clearJob() {},
    composeFeatureReport() {
      return {
        status: "ready",
        aiReport: { version: 2 },
        artifacts: [
          {
            kind: "subtitle-ai-payload",
            path: "/tmp/subtitle-ai-payload.json",
            fileName: "subtitle-ai-payload.json",
          },
          {
            kind: "subtitle-channel-batch",
            path: "/tmp/subtitle-channel-batch.json",
            fileName: "subtitle-channel-batch.json",
          },
        ],
        exports: [],
      };
    },
    ensureProjectDirectories() {
      return Promise.resolve();
    },
    ensureReportJobSlotAvailable() {},
    getActiveProject() {
      return project as unknown as { id: string; slug: string };
    },
    getFeatureReportDir() {
      return "/tmp/reports";
    },
    getFeatureReportExportAction() {
      return "report-export";
    },
    getFeatureReportRecord(nextProject: Record<string, unknown>, featureId: string) {
      return (
        (((nextProject["report"] as Record<string, unknown>)["records"] as Record<string, unknown>)[
          featureId
        ] as Record<string, unknown>) || {}
      );
    },
    normalizeReportExport(value: unknown) {
      const source = value as Record<string, unknown>;
      return {
        id: String(source["fileName"] || source["path"] || "export"),
        format: String(source["format"] || "md"),
        path: source["path"] || null,
        fileName: source["fileName"] || null,
        createdAt: "2026-04-20T10:00:00.000Z",
        status: String(source["status"] || "ready"),
      };
    },
    patchActiveProject(_runtime, patcher) {
      patcher(project as unknown as { id: string; slug: string });
      return Promise.resolve();
    },
    pushJobState() {},
    registerJob() {
      return {};
    },
    sanitizeFileSegment(value: unknown, fallback: string) {
      return typeof value === "string" && value.trim() !== "" ? value : fallback;
    },
    setFeatureReportRecord(nextProject: Record<string, unknown>, featureId: string, record) {
      ((nextProject["report"] as Record<string, unknown>)["records"] as Record<string, unknown>)[
        featureId
      ] = record;
      persistedExports = Array.isArray((record as Record<string, unknown>)["exports"])
        ? ((record as Record<string, unknown>)["exports"] as Array<Record<string, unknown>>)
        : [];
    },
    writeTextFile(path: string, value: string) {
      writes.push({ path, value });
      return Promise.resolve();
    },
  });

  await runtime.exportFeatureReport({}, {}, "req-1", "subtitle-analysis");

  assert.equal(writes.length, 2);
  assert.ok(persistedExports.some((entry) => entry["fileName"] === "subtitle-ai-payload.json"));
  assert.ok(persistedExports.some((entry) => entry["fileName"] === "subtitle-channel-batch.json"));
});
