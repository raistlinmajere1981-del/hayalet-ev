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

The workbench provides three aligned views for the same edit recipe:

1. source baseline
2. transformed
3. true pixel difference

The source baseline is a derived comparison control generated through the same base trim/crop/resize recipe but without stress-transform stages. Difference is computed from this aligned baseline and the transformed preview with FFmpeg `blend=all_mode=difference`. The immutable original source is never replaced.

The useful output is not "looks real". It is a persistence record describing which independent transformations preserve recognizable geometry and temporal continuity.

## Temporal ROI test

The first temporal slice operates on the prepared original video source so that later transformed/control-injection runs can be compared against an unmodified temporal baseline.

A real timeline selection is required. The synthetic full-source workspace selection is deliberately rejected so the room never chooses an arbitrary six-second center window without the operator selecting one. The selected range is capped at six seconds, centered when a longer range is supplied. Sampling defaults to 5 fps and is bounded to 1–10 fps. If the selection carries an ROI, only that normalized ROI is measured; otherwise the full frame is used.

The current FFmpeg-only measurements are:

- luma trajectory (`signalstats.YAVG`)
- chroma U/V trajectory (`signalstats.UAVG` / `VAVG`)
- inter-frame difference energy (`tblend=all_mode=difference` + `signalstats`)
- edge energy (`edgedetect` + `signalstats`)
- an initial edge-persistence ratio derived from the edge-energy series

The runtime prints only the required metadata keys, merges repeated metadata blocks by frame timestamp, normalizes 8-bit signal metrics to 0–1, and stores the newest twenty temporal measurements under `edit.temporalStressTests`. These records remain inside the normalized project state across reload/restart; a separate exported artifact file is intentionally deferred to the later report/export layer. The lower live-result surface shows the latest numeric summary rather than introducing a heavy chart/statistics subsystem in this first slice.

Real-video testing showed that the current mean-edge persistence proxy can report zero even when a large silhouette is visually obvious inside a broad ROI. That metric therefore remains provisional. The next persistence refinement should measure spatial edge overlap across frames rather than only average edge energy.

Optical flow is intentionally deferred until these simpler measurements are validated against real clips.

## Control injection

Known artifact families should be injectable into a clean/control segment using the same pipeline. The first implemented controls are fixed canonical presets:

- Noise: strength 12 with deterministic seed 4242
- Blur: radius 2
- Sharpen: amount 1.25
- Low-light: brightness -0.25, contrast 1.05, saturation 0.9, noise strength 8 with deterministic seed 4242

Each control run produces two derived clips from the same selected interval and ROI: a paired re-encoded baseline and an injected clip. Both use the same H.264/libx264, veryfast, CRF 18, yuv420p, no-audio encode profile. Only the injected side receives the requested control filter. The same temporal metrics are then measured independently on both clips and stored together with injected-minus-baseline deltas, the exact filter string, encode profile, canonical parameters, and paired paths.

Control results share `edit.temporalStressTests` with `kind: "control-injection"` so temporal baseline and destruction-control runs remain one short-time experiment family instead of creating a second history/state source.

The question is whether a known transform family can measurably alter or reproduce morphology comparable to the observed target under similar scene conditions. Recompression and chromatic-aberration controls remain pending because they need their own matched-control semantics.

## Readable interpretation layer

Raw frame-difference, edge, luma, and chroma values remain the primary evidence. The UI also provides a versioned human-readable interpretation so an operator does not need to decode normalized metrics during an experiment.

New temporal and control records persist `interpretation.schemaVersion: 1`. The interpretation converts only measured behavior into restrained language such as low/high frame activity, weak/persistent edge structure, stable/variable light-color distribution, or negligible/small/moderate/strong control impact. Existing records without an interpretation snapshot are interpreted from their stored raw metrics when rendered.

The interpretation layer has explicit sample-quality guards. A run with no usable frame, frame-difference, or edge samples is reported as insufficient rather than being mistaken for a perfectly stable zero-valued result.

No interpretation is allowed to claim that a target anomaly was destroyed, reproduced, explained, real, fake, or paranormal. The current metrics do not establish those propositions. Technical values stay visible below the readable summary so later analysis can audit the wording against the underlying measurements.

## Live result surface

Manual stress-test work reuses the expandable process-strip area as a live result surface whenever a full analysis run is not active.

The workspace inspector stays action-focused: live visual controls, ordered Transform Stack stages, Temporal Scan, and Destruction Control triggers remain on the right. Source / Transform / Difference preview and result summaries move to the wider lower surface.

The lower live surface contains:

- Source / Transform / Difference preview
- latest Temporal Scan interpretation and technical values
- latest Destruction Control interpretation and technical values
- a same-selection comparison table for Noise, Blur, Sharpen, and Low-light

The comparison table only groups control runs that share the same normalized timeline interval and ROI. Missing controls remain explicitly empty rather than being inferred.

When a full analysis run is active, the same process-strip expansion switches back to the existing Analysis Summary + Raw Log panels. This keeps manual real-time experiments and full analysis reporting on one shared workspace region without adding another persistent panel.

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

The UI should allow a small interval to loop while parameters change. The subtitle remains visible as a _target hypothesis_, not as a transcription truth.

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
4. Add the first temporal baseline metrics: luma/chroma trajectory, frame-difference energy, and edge persistence.
5. Add audio loop + subtitle target interval.
6. Add control-injection presets.
7. Add a readable, versioned interpretation layer above the technical metrics.
8. Move manual preview/results into the shared lower live-result surface and compare same-selection controls there.
9. Replace/refine mean-edge persistence with a spatial overlap metric before adding heavier motion tracking.
10. Add heavier persistence metrics such as optical flow only if the simpler baseline proves useful.
11. Add the restrained result categories above.

This sequencing deliberately reuses the existing FFmpeg preview/apply pipeline before adding heavier temporal tracking or OpenCV dependencies.
