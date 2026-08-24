# Laboratory Transform Stress Test

This note defines the channel-specific forensic stress-test workflow without changing the original source media.

## Purpose

Laboratory uses prepared-source handling, ROI/crop inspection, non-destructive edit preview/apply, FFmpeg-backed derived artifacts, audio forensic runners, comparison/export, and project persistence to answer a stricter question than "can I make the anomaly clearer?":

> Which transformations preserve the target feature, which transformations weaken it, and can a known camera/codec/signal-processing mechanism produce comparable measured behavior?

This workflow is not a paranormal detector and not an automatic fake detector. It is a reproducible stress-test layer that raises or lowers the cost of ordinary explanations.

A separate [`PHOTOMETRIC-ATTENUATION.md`](./PHOTOMETRIC-ATTENUATION.md) probe operationalizes the channel claim that some target figures appear to absorb or strongly attenuate light. That claim is treated as a test hypothesis rather than as a fact.

## Core model

A stress-test session is an ordered, reproducible transform stack attached to a source interval and optional ROI.

```ts
export type LaboratoryTransformStage = {
  id: string;
  kind: string;
  enabled: boolean;
  params: Record<string, unknown>;
};
```

Order is evidence. `denoise -> sharpen` is not equivalent to `sharpen -> denoise`, so stage ordering is persisted in the recipe signature and provenance snapshot.

The original source is immutable. Preview, baseline, difference, control and analysis outputs are derived artifacts.

## Ordered transform stack

The implemented first-stage visual operations include:

- brightness
- contrast
- gamma
- saturation
- blur
- sharpen
- grayscale
- RGB channel isolation
- denoise

The implemented first-stage audio operations include:

- high-pass
- low-pass
- band-pass
- gain

Live workspace controls remain audition-only. The ordered Transform Stack is the reproducible experiment recipe.

## Source / Transform / Difference

The workbench provides three aligned views for the same edit recipe:

1. Source baseline
2. Transform
3. Difference

The Source baseline is a derived comparison control generated through the same base trim/crop/resize recipe but without stress-transform stages. Difference is computed between that aligned baseline and the transformed preview with FFmpeg `blend=all_mode=difference`.

Using the raw immutable source directly against a cropped/resized transformed preview would create false difference energy from geometry alone, so the aligned baseline is deliberate.

A stale preview is not trusted. Disabled-only visual stacks do not generate a misleading Difference artifact.

## Temporal ROI test

Temporal stress testing operates on the prepared original video source so later transform/control runs can be compared against a common baseline.

A real timeline selection is required. The synthetic full-source workspace selection is rejected. The selected range is capped at six seconds and centered when a longer range is supplied. Sampling defaults to 5 fps and is bounded to 1–10 fps. When the selection contains an ROI, only that normalized ROI is measured; otherwise the full frame is measured.

The current FFmpeg-only measurements are:

- luma trajectory (`signalstats.YAVG`)
- chroma U/V trajectory (`signalstats.UAVG` / `VAVG`)
- inter-frame difference energy (`tblend=all_mode=difference` + `signalstats`)
- edge energy (`edgedetect` + `signalstats`)
- legacy edge-presence persistence derived from the edge-energy series
- spatial adjacent-frame edge persistence

### Spatial edge persistence

Real-video testing showed that average edge energy is too coarse: a large visible silhouette inside a broad ROI can coexist with a weak or zero legacy persistence score.

The refined metric therefore compares adjacent edge maps rather than asking only whether average edge energy stays above a threshold.

For each sampled pair the runtime produces:

- edge-map energy for the previous frame
- edge-map energy for the current frame
- absolute edge-map difference via `tblend=all_mode=difference`

From those normalized energies it derives a fuzzy/weighted intersection and union equivalent:

```text
intersection = (previous + current - difference) / 2
union        = (previous + current + difference) / 2
IoU          = intersection / union
```

This is equivalent to a min/max weighted IoU when the difference pass represents absolute edge-map difference. Empty-edge pairs are excluded instead of being called 100% persistent.

New summaries therefore store:

- `edgeDifference`
- `edgeOverlap`
- `edgePersistenceSampleCount`
- `spatialEdgePersistenceRatio`
- `edgePersistenceMethod: "adjacent-edge-map-iou"`

The old `edgePersistenceRatio` remains in stored records as a legacy edge-presence proxy. Interpretation prefers `spatialEdgePersistenceRatio` when present and falls back to the legacy field for older records.

A temporal scan now uses four FFmpeg measurement passes: signal, frame difference, edge map, and edge-map difference.

Optical flow is intentionally deferred. Spatial edge persistence measures overlap of edge structure across adjacent frames; it does not claim object identity, motion vectors or tracked morphology.

The newest twenty temporal measurements persist under `edit.temporalStressTests`. A separate heavy statistics/history subsystem is intentionally not part of this slice.

## Destruction controls

The canonical controls are fixed and reproducible:

- Noise: strength 12, seed 4242
- Blur: radius 2
- Sharpen: amount 1.25
- Low-light: brightness -0.25, contrast 1.05, saturation 0.9, noise strength 8, seed 4242
- Recompression: CRF 18 baseline versus CRF 36 injected with the same codec/preset/pixel format

Payload parameter overrides are ignored for these canonical presets.

Filter controls create paired outputs from the same selected interval and ROI using the same H.264/libx264, veryfast, CRF 18, yuv420p, no-audio encode profile. Only the injected side receives the requested visual filter.

Recompression is encode-only. Baseline and injected outputs share source, trim, ROI, codec family, preset, pixel format and added codec-generation count. The controlled difference is second-stage encode quality: CRF 18 baseline versus CRF 36 recompression.

Both paired outputs are measured independently with the same four-pass temporal metric stack. A complete control run therefore consists of two encode passes plus four baseline metric passes plus four injected metric passes: ten FFmpeg passes total.

The record stores:

- exact control filter when applicable
- canonical parameters
- baseline/injected encode profiles
- paired paths
- complete baseline/injected metrics
- injected-minus-baseline deltas, including spatial edge persistence
- versioned interpretation

Control results share `edit.temporalStressTests` with `kind: "control-injection"` so baseline and control runs remain one experiment family.

Chromatic-aberration control remains optional and should only be added if real experiments create a concrete need for it.

## Readable interpretation layer

Raw frame-difference, edge, luma and chroma values remain the primary evidence. The UI also provides a versioned human-readable interpretation so the operator does not need to decode normalized values during an experiment.

New temporal and control records persist `interpretation.schemaVersion: 1`.

Interpretation is deliberately restrained. It may describe:

- frame activity
- edge persistence
- luminance/chroma variation
- negligible/small/moderate/strong control impact

It may not claim that a target was destroyed, reproduced, explained, real, fake or paranormal.

Sample-quality guards prevent empty measurements from being interpreted as perfectly stable zero-valued evidence. New spatial records also require at least one usable edge-overlap pair before edge-persistence interpretation is considered sufficient.

Existing records without a persisted interpretation are interpreted from their stored raw metrics. Spatial persistence is preferred when available; legacy edge persistence remains a backward-compatible fallback.

## Live result surface

Manual stress-test work reuses the expandable lower process-strip area whenever a full analysis run is not active.

The right inspector remains action-focused:

- live visual controls
- ordered Transform Stack
- Temporal Scan
- Photometric Probe
- Destruction Control

The lower surface contains:

- Source / Transform / Difference preview
- latest Temporal Scan interpretation and technical values
- latest Photometric Attenuation interpretation and technical values
- latest Destruction Control interpretation and technical values
- same-selection comparison of Noise, Blur, Sharpen, Low-light and Recompression

When a full analysis run is active, the same lower area switches back to Analysis Summary + Raw Log.

UI layout/polish is intentionally secondary to metric correctness in this branch.

## Audio reconstruction workbench

The later audio path should support a small loop aligned to a subtitle target interval with operations such as:

- high/low/band-pass
- EQ
- gain/compression
- noise reduction/gate
- time stretch without pitch change
- pitch shift
- mono / left / right
- L-R difference
- mid/side extraction
- phase inversion where meaningful

The subtitle is a target hypothesis, never transcription ground truth.

The useful question is whether speech-like structure survives independent processing paths or appears only after a narrow tuned transformation.

## Classification language

Later reports should use restrained result classes:

- `reproducible-artifact` — a known processing/control path can reproduce a close analogue
- `processing-dependent` — the feature is present but recognizable only under a narrow transform family
- `transform-resistant` — meaningful structure persists across several independent transformations
- `inconclusive` — insufficient or conflicting evidence

`transform-resistant` is not paranormal confirmation. It only means the tested ordinary artifact explanations did not cheaply remove or reproduce the feature.

## Persistence and provenance

Every completed run should retain enough information to reproduce it:

- source project/output id
- source timestamp interval
- ROI
- ordered stage list and parameters
- generated artifact ids/paths
- exact control/filter settings where relevant
- optional subtitle target interval/text
- operator notes where relevant
- run timestamp

The immutable source is never replaced.

## Current sequencing

Completed foundation:

1. ordered visual/audio transform recipe
2. stable recipe signatures and provenance
3. Source / Transform / Difference
4. temporal luma/chroma + frame-difference + edge metrics
5. canonical Noise / Blur / Sharpen / Low-light destruction controls
6. readable interpretation layer
7. shared lower live-result surface
8. spatial adjacent-edge-map persistence
9. matched recompression control

Current experimental slice:

1. photometric attenuation probe for near-black / recoverable-dark behavior

Next useful steps:

1. validate the photometric probe on the target ROI and an ordinary dark reference ROI
2. automate target/reference photometric comparison only if the manual comparison separates consistently
3. add chromatic-aberration control if still useful
4. add subtitle-aligned audio reconstruction
5. add restrained automatic report/classification only after enough real experiments exist
6. consider optical flow only if spatial overlap leaves a concrete unanswered question

This sequencing deliberately keeps the system FFmpeg-first and simple before introducing heavier motion-analysis dependencies.
