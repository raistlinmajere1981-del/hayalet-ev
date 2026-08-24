# Laboratory Transform Stress Test

This note defines the first implementation slice for channel-specific forensic stress testing without changing the original source media.

## Purpose

The workbench already has the right foundations: prepared-source handling, ROI/crop inspection, non-destructive edit preview/apply, FFmpeg-backed derived artifacts, audio forensic runners, comparison/export, and project persistence.

The next slice should use those primitives to answer a stricter question than "can I make the anomaly clearer?":

> Which transformations preserve the anomaly, which transformations destroy it, and can a known camera/codec/signal-processing mechanism reproduce something morphologically similar?

The result must never be interpreted as a paranormal detector or an automatic fake detector. It is a reproducible stress-test layer that raises or lowers the cost of ordinary explanations.

## Core model

A stress-test session is an ordered, reproducible transform stack attached to a source interval and optional ROI.

```ts
export type LaboratoryTransformStage = {
  id: string;
  kind: string;
  enabled: boolean;
  params: Record<string, unknown>;
};

export type LaboratoryStressTestRecipe = {
  sourceStartSeconds: number;
  sourceEndSeconds: number;
  roiNormalized: { x: number; y: number; width: number; height: number } | null;
  transformStages: LaboratoryTransformStage[];
  controlInjectionStages: LaboratoryTransformStage[];
  subtitleTarget?: {
    text: string;
    startSeconds: number;
    endSeconds: number;
  } | null;
};
```

Order matters. `denoise -> sharpen` is not equivalent to `sharpen -> denoise`, so stage ordering must be persisted in the recipe signature.

## Visual stress-test stages

The first useful set can be implemented with FFmpeg/OpenCV-compatible operations already natural to the room architecture:

- exposure/brightness
- contrast
- gamma
- saturation / grayscale
- RGB channel isolate
- luminance-only / chroma suppression
- blur
- sharpen / unsharp
- temporal denoise
- spatial denoise
- debanding/deblocking where available
- frame difference
- temporal median/reference-frame comparison
- crop/ROI and scale

The workbench should provide three views for the same timestamp/ROI:

1. source
2. transformed
3. absolute/source difference

The current Phase 1 implementation makes the comparison geometry explicit. When a visual Transform Stack preview is generated, Laboratory first renders a `transform-source-baseline` artifact through the same base edit recipe (trim/crop/resize and other pre-existing edit steps) but without the stress-transform stages. The normal preview is the transformed artifact. A `transform-difference` artifact is then generated with FFmpeg `blend=all_mode=difference` from those two aligned outputs.

This matters because comparing the immutable raw source directly with a cropped, resized, or trimmed transformed preview would create large differences that come from geometry/timing rather than from the tested transform stages. The immutable original still remains the project source; the baseline is only a derived comparison control.

If there is no enabled visual stress-transform stage, Laboratory does not generate a Difference artifact. A stale preview is also not treated as a current Transform/Difference result.

The useful output is not "looks real". It is a persistence record describing which independent transformations preserve recognizable geometry and temporal continuity.

## Temporal ROI test

A selected ROI should be traceable over a short interval, initially ±3 seconds around the marked event.

Useful measurements:

- edge persistence
- local luminance trajectory
- local chroma trajectory
- inter-frame difference energy
- optical-flow consistency when available
- appearance/disappearance timestamps

This distinguishes a single-frame impression from a feature that behaves consistently through time.

## Control injection

Known artifact families should be injectable into a clean/control segment using the same pipeline:

- Gaussian/noise injection
- low-light amplification
- blur
- sharpening halos
- chromatic aberration approximation
- reduced bitrate / recompression
- block/noise stress

The question is whether a known transform family can produce a morphology comparable to the observed target under similar scene conditions.

## Audio reconstruction workbench

The audio path should support an ordered live/preview transform stack aligned to a subtitle target interval.

First-stage operations:

- high-pass
- low-pass
- band-pass
- EQ bands
- gain / dynamic-range compression
- noise reduction
- noise gate
- time stretch without pitch change
- pitch shift
- mono
- left-only / right-only
- L-R difference
- mid / side extraction
- phase inversion where meaningful

The UI should allow a small interval to loop while parameters change. The subtitle remains visible as a *target hypothesis*, not as a transcription truth.

The important question is whether speech-like structure survives multiple independent processing paths, or appears only after a narrow, highly tuned transformation.

## Classification language

Reports should use restrained categories:

- `reproducible-artifact` — a known processing/control-injection path can reproduce a close analogue
- `processing-dependent` — the feature is present in the recording but becomes recognizable only under a narrow transform family
- `transform-resistant` — the feature preserves meaningful geometry/temporal or phonetic structure across several independent transformations
- `inconclusive` — insufficient information or conflicting results

`transform-resistant` must not be presented as evidence of a paranormal source. It only means the tested ordinary artifact explanations did not cheaply remove/reproduce the feature.

## Persistence and provenance

Every run should persist:

- source project/output id
- source timestamp interval
- ROI
- ordered stage list and parameters
- FFmpeg/tool versions when available
- generated artifact ids/paths
- optional subtitle target text + interval
- operator notes
- run timestamp

The original source must remain immutable. Stress-test outputs are derived artifacts and should use the existing Laboratory edit/output ownership rules.

## Suggested implementation order

1. Extend the existing media edit recipe with video photometric controls (brightness/contrast/gamma/saturation, blur/sharpen) and audio band-pass/gain controls.
2. Add ordered transform-stage persistence and stable recipe signatures.
3. Add Source / Transform / Difference preview mode for a selected ROI and short interval.
4. Add audio loop + subtitle target interval.
5. Add control-injection presets.
6. Add persistence metrics and the restrained result categories above.

This sequencing deliberately reuses the existing FFmpeg preview/apply pipeline before adding heavier temporal tracking or OpenCV dependencies.
