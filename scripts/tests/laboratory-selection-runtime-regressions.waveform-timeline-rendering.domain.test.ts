import { assert, renderLabWaveformTimeline, test } from "./laboratory-runtime-truth.helpers.ts";

import type { LabSelection } from "./laboratory-runtime-truth.helpers.ts";

describe("waveform timeline rendering", () => {
  void test("waveform timeline hides selection affordances for invalid numeric ranges", () => {
    const baseModel = {
      bookmarks: [],
      dualPreviewActive: false,
      durationMs: 6000,
      waveformSourceLabel: "Source audio",
      waveformSyncLabel: "Preview and waveform share the same master axis.",
      waveformWindowDurationMs: 6000,
      waveformWindowStartMs: 0,
    };

    const zeroWidthMarkup = renderLabWaveformTimeline({
      ...baseModel,
      endMs: 2400,
      startMs: 2400,
    });
    const invertedMarkup = renderLabWaveformTimeline({
      ...baseModel,
      endMs: 1800,
      startMs: 2400,
    });

    assert.match(zeroWidthMarkup, /data-lab-action="timeline-set-selection-boundary"/);
    assert.match(zeroWidthMarkup, /data-lab-action="timeline-clear"[^>]*disabled/);
    assert.doesNotMatch(zeroWidthMarkup, /labx-timeline__selection lab-selection-overlay/);
    assert.match(zeroWidthMarkup, /End must be greater than start/);
    assert.match(invertedMarkup, /data-lab-action="timeline-set-selection-boundary"/);
    assert.match(invertedMarkup, /data-lab-action="timeline-clear"[^>]*disabled/);
    assert.doesNotMatch(invertedMarkup, /labx-timeline__selection lab-selection-overlay/);
  });
  void test("waveform timeline renders selector-driven suggested actions alongside live actions", () => {
    const selection: LabSelection = {
      id: "selection-clip",
      startMs: 12300,
      endMs: 18900,
      type: "clip",
      createdAt: 1700000000000,
    };
    const markup = renderLabWaveformTimeline({
      activeSelection: selection,
      bookmarks: [],
      dualPreviewActive: false,
      durationMs: 60000,
      endMs: selection.endMs,
      ...({} as any),
      activeSuggestionPreview: {
        suggestionId: "audio-inspect",
        title: "Ses analizi yapilacak",
        steps: [
          "6.6s secim hazirlanacak",
          "Ses track izole edilecek",
          "Frekans ve yogunluk taramasi hazirlanacak",
        ],
        expectedOutputs: ["Ses analizi raporu", "Olasi anomali noktalari"],
        estimatedCost: "low",
      },
      selectionSuggestions: [
        {
          id: "audio-inspect",
          label: "Ses detaylarini incele",
          actionType: "inspect-audio",
          confidence: 0.9,
        },
        {
          id: "extract-clip",
          label: "Bu bolumu kes",
          actionType: "extract-clip",
          confidence: 0.6,
        },
      ],
      startMs: selection.startMs,
      waveformSourceLabel: "Source audio",
      waveformSyncLabel: "Preview and waveform share the same master axis.",
      waveformWindowDurationMs: 60000,
      waveformWindowStartMs: 0,
    });

    assert.match(markup, /class="lab-selection-panel"/);
    assert.match(markup, /Selection/);
    assert.match(markup, /00:12\.300/);
    assert.match(markup, /00:18\.900/);
    assert.match(markup, /Type: Clip/);
    assert.match(markup, /Region inactive/);
    assert.match(markup, /Inspection mode/);
    assert.match(markup, /data-lab-selection-inspection-mode="none"/);
    assert.match(markup, /This selection will guide future analysis/);
    assert.match(markup, /aria-pressed="true"/);
    assert.match(markup, /Suggested actions/);
    assert.match(markup, /Ses detaylarini incele/);
    assert.match(markup, /data-lab-selection-suggestion="audio-inspect"/);
    assert.doesNotMatch(markup, /Bu bolumu kes/);
    assert.doesNotMatch(markup, /data-lab-selection-suggestion="extract-clip"/);
    assert.match(markup, /data-suggestion-priority="primary"/);
    assert.match(markup, /Preview/);
    assert.match(markup, /Ses analizi yapilacak/);
    assert.match(markup, /Steps/);
    assert.match(markup, /Outputs/);
    assert.match(markup, /Estimated cost: Low/);
    assert.match(markup, /data-lab-selection-preview="true"/);
    assert.doesNotMatch(markup, /Analyze this/);
    assert.doesNotMatch(markup, /Focus region/);
    assert.doesNotMatch(markup, /data-lab-action="[^"]*">Ses detaylarini incele/);
    assert.doesNotMatch(markup, /data-lab-action="[^"]*">Bu bolumu kes/);
    assert.doesNotMatch(markup, /timeline-export-clip/);
    assert.doesNotMatch(markup, /timeline-grab-frame/);
  });
  void test("waveform timeline does not render suggested actions from fallback-only selection markup", () => {
    const markup = renderLabWaveformTimeline({
      bookmarks: [],
      dualPreviewActive: false,
      durationMs: 60000,
      endMs: 18900,
      ...({} as any),
      activeSuggestionPreview: {
        suggestionId: "audio-inspect",
        title: "Ses analizi yapilacak",
        steps: ["Secilen zaman araligi hazirlanacak"],
        expectedOutputs: ["Ses analizi raporu"],
        estimatedCost: "low",
      },
      selectionSuggestions: [
        {
          id: "audio-inspect",
          label: "Ses detaylarini incele",
          actionType: "inspect-audio",
          confidence: 0.9,
        },
      ],
      startMs: 12300,
      waveformSourceLabel: "Source audio",
      waveformSyncLabel: "Preview and waveform share the same master axis.",
      waveformWindowDurationMs: 60000,
      waveformWindowStartMs: 0,
    });

    assert.match(markup, /class="lab-selection-panel"/);
    assert.doesNotMatch(markup, /Suggested actions/);
    assert.doesNotMatch(markup, /data-lab-selection-suggestion=/);
    assert.doesNotMatch(markup, /data-lab-selection-preview=/);
    assert.doesNotMatch(markup, /Ses analizi yapilacak/);
  });
});
