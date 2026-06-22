import test from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { renderLabWaveformTimeline } from "../../rooms/laboratory/ui/lab-waveform-timeline.ts";
import { getLabLayoutKind, renderLabLayout } from "../../rooms/laboratory/ui/lab-layout.ts";
import { createLabI18n } from "../../rooms/laboratory/ui/lab-i18n.ts";
import { renderLabSourcePanel } from "../../rooms/laboratory/ui/lab-source-panel.ts";
import {
  buildLabDecisionSnapshot,
  deriveLabDecisionSignals,
  deriveLabDecisionSignalsFromState,
  readLabDecisionActiveBlocks,
  resolveLabDecisionIntent,
  resolveLabDecisionState,
} from "../../rooms/laboratory/ui/lab-decision-layer.ts";
import { createLabStore } from "../../rooms/laboratory/runtime/lab-store.ts";
import {
  formatLabUserActionDisplayText,
  translateLabRuntimeText,
} from "../../rooms/laboratory/ui/lab-runtime-i18n.ts";
import { createRoomBuiltArtifact } from "./helpers/room-installed-copy.ts";
import { readCssWithImports } from "./helpers/css-imports.ts";
import { importLabRootModuleWithDomStub } from "./laboratory-runtime-truth.helpers.ts";
import type { LabDecisionSnapshot, LabRun } from "../../rooms/laboratory/domain/lab-types.ts";
import type { LabWaveformTimelineModel } from "../../rooms/laboratory/ui/lab-waveform-timeline-types.ts";

describe("phase 4.95 i18n", () => {
  void test("laboratory phase 4.95 renders room-local selection labels without execution detail copy", () => {
    const enTranslations = JSON.parse(
      readFileSync("rooms/laboratory/i18n/en.json", "utf8")
    ) as Record<string, unknown>;
    const trTranslations = JSON.parse(
      readFileSync("rooms/laboratory/i18n/tr.json", "utf8")
    ) as Record<string, unknown>;
    const enCopy = createLabI18n({ locale: "en", translations: enTranslations });
    const trCopy = createLabI18n({ locale: "tr", translations: trTranslations });

    const enMarkup = renderLabWaveformTimeline(
      createExecutionReadinessTimelineModel({
        activeExecutionIntent: {
          id: "audio-inspect",
          label: "Inspect audio",
          actionType: "inspect-audio",
          confidence: 0.82,
        },
        copy: enCopy,
      })
    );
    const trMarkup = renderLabWaveformTimeline(
      createExecutionReadinessTimelineModel({
        activeExecutionIntent: {
          id: "audio-inspect",
          label: "Ses incele",
          actionType: "inspect-audio",
          confidence: 0.82,
        },
        copy: trCopy,
      })
    );

    assert.match(enMarkup, /Selection/);
    assert.match(enMarkup, /Type/);
    assert.match(enMarkup, /Selected action/);
    assert.match(enMarkup, /Inspect audio/);
    assert.match(trMarkup, /Secim/);
    assert.match(trMarkup, /Tip/);
    assert.match(trMarkup, /Secili aksiyon/);
    assert.match(trMarkup, /Ses incele/);
    assert.doesNotMatch(
      enMarkup,
      /View details|Execution details|Simulation preview|Execution candidate/
    );
    assert.doesNotMatch(
      trMarkup,
      /Detaylari gor|Calistirma detaylari|Simulasyon onizlemesi|Calistirma adayi/
    );
  });
  void test("laboratory runtime status copy resolves through room-local i18n catalogs", () => {
    const enTranslations = JSON.parse(
      readFileSync("rooms/laboratory/i18n/en.json", "utf8")
    ) as Record<string, unknown>;
    const trTranslations = JSON.parse(
      readFileSync("rooms/laboratory/i18n/tr.json", "utf8")
    ) as Record<string, unknown>;
    const enCopy = createLabI18n({ locale: "en", translations: enTranslations });
    const trCopy = createLabI18n({ locale: "tr", translations: trTranslations });

    assert.equal(
      translateLabRuntimeText("Kaynak henüz hazır değil.", enCopy),
      "Source is not ready yet."
    );
    assert.equal(translateLabRuntimeText("Eksik araç: ffmpeg", enCopy), "Missing tool: ffmpeg");
    assert.equal(translateLabRuntimeText("Eksik araç: ffmpeg", trCopy), "Eksik araç: ffmpeg");
    assert.equal(
      formatLabUserActionDisplayText(
        {
          id: "action-1",
          type: "extract-audio",
          label: "Ses çıkarılıyor",
          status: "success",
          startedAt: 1,
          message: "Ses çıkarıldı",
          sourceAction: "export-audio-track",
        },
        enCopy
      ),
      "Audio extracted"
    );
  });
  void test("laboratory phase 4.95 i18n keys keep English and Turkish catalog parity", () => {
    const enTranslations = JSON.parse(
      readFileSync("rooms/laboratory/i18n/en.json", "utf8")
    ) as Record<string, unknown>;
    const trTranslations = JSON.parse(
      readFileSync("rooms/laboratory/i18n/tr.json", "utf8")
    ) as Record<string, unknown>;
    const phaseKeys = [
      "mediaAnalysis.processSummary",
      "mediaAnalysis.rightContext",
      "mediaAnalysis.timeline",
      "mediaAnalysis.topBar",
      "mediaAnalysis.sourcePanel",
      "mediaAnalysis.projectImport",
    ];

    function readPath(record: Record<string, unknown>, key: string): unknown {
      return key.split(".").reduce<unknown>(function (current, part) {
        return current != null && typeof current === "object"
          ? (current as Record<string, unknown>)[part]
          : undefined;
      }, record);
    }

    function collectKeys(value: unknown, prefix = ""): string[] {
      if (value == null || typeof value !== "object" || Array.isArray(value)) {
        return [prefix];
      }
      return Object.keys(value as Record<string, unknown>)
        .sort()
        .flatMap(function (key) {
          const nextPrefix = prefix === "" ? key : `${prefix}.${key}`;
          return collectKeys((value as Record<string, unknown>)[key], nextPrefix);
        });
    }

    phaseKeys.forEach(function (key) {
      assert.deepEqual(
        collectKeys(readPath(enTranslations, key)),
        collectKeys(readPath(trTranslations, key))
      );
    });
  });
});
