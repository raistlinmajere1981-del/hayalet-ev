import assert from "node:assert/strict";
import test from "node:test";

import {
  buildLaboratoryStressReportHistory,
  renderLaboratoryStressReportHistory,
} from "../../rooms/laboratory/ui/workspace-stress-report-history.ts";

const copy = {
  locale: "tr",
  t(_key: string, fallback = "") {
    return fallback;
  },
} as never;

function visibility(createdAt: string, axis: string) {
  return {
    kind: "visibility-response",
    id: `response-${axis}-${createdAt}`,
    createdAt,
    request: {
      axis,
      temporalRequest: {
        startSeconds: 1,
        endSeconds: 2,
        roi: { x: 0.1, y: 0.1, width: 0.2, height: 0.2 },
      },
      backgroundRoi: { x: 0.4, y: 0.1, width: 0.2, height: 0.2 },
    },
    points: [],
  };
}

void test("stress report history sorts createdAt descending instead of trusting storage order", () => {
  const editConfig = {
    temporalStressTests: [
      visibility("2026-08-26T12:00:00.000Z", "contrast"),
      visibility("2026-08-26T12:05:00.000Z", "gamma"),
      visibility("2026-08-26T12:03:00.000Z", "brightness"),
    ],
  } as never;

  const reports = buildLaboratoryStressReportHistory(editConfig, copy);
  assert.deepEqual(
    reports.map((report) => report.createdAt),
    [
      "2026-08-26T12:05:00.000Z",
      "2026-08-26T12:03:00.000Z",
      "2026-08-26T12:00:00.000Z",
    ]
  );
});

void test("appearance run exposes structural and photometric reports as separate history rows", () => {
  const editConfig = {
    temporalStressTests: [
      {
        kind: "appearance-transition",
        id: "transition-1",
        createdAt: "2026-08-26T12:05:00.000Z",
        request: {
          eventSeconds: 10,
          temporalRequest: { roi: { x: 0.1, y: 0.1, width: 0.2, height: 0.2 } },
          controlRoi: { x: 0.4, y: 0.1, width: 0.2, height: 0.2 },
          backgroundRoi: { x: 0.7, y: 0.1, width: 0.2, height: 0.2 },
        },
        phases: [],
        interpretation: { classification: "result-uncertain" },
        structural: {
          assessment: { classification: "structural-result-uncertain" },
          phaseSummary: {},
          timeline: [],
          roiStability: { mode: "off" },
        },
      },
    ],
  } as never;

  const reports = buildLaboratoryStressReportHistory(editConfig, copy);
  assert.deepEqual(
    reports.map((report) => report.title),
    ["Structural Transition", "Appearance / Disappearance Transition"]
  );
});

void test("report history keeps full markdown attached to the clicked row contract", () => {
  const editConfig = {
    temporalStressTests: [
      visibility("2026-08-26T12:05:00.000Z", "gamma"),
      visibility("2026-08-26T12:03:00.000Z", "contrast"),
    ],
  } as never;

  const markup = renderLaboratoryStressReportHistory(editConfig, copy);
  assert.match(markup, /data-lab-stress-report-history="true"/);
  assert.match(markup, /data-lab-report-latest="true"/);
  assert.equal((markup.match(/data-lab-exportable-report="true"/g) || []).length, 2);
  assert.equal((markup.match(/data-lab-report-copy="true"/g) || []).length, 2);
  assert.equal((markup.match(/data-lab-report-export="true"/g) || []).length, 2);
  assert.equal((markup.match(/data-lab-report-markdown="true"/g) || []).length, 2);
  assert.ok(markup.indexOf("Visibility Response · gamma") < markup.indexOf("Visibility Response · contrast"));
  assert.match(markup, /# Hayalet Ev Laboratory — Visibility Response · gamma/);
  assert.match(markup, /# Hayalet Ev Laboratory — Visibility Response · contrast/);
});
