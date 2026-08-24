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

The runtime prints only the required metadata keys, merges repeated metadata blocks by frame timestamp, normalizes 8-bit signal metrics to 0–1, and stores the newest twenty temporal experiment records under `edit.temporalStressTests`. These records remain inside the normalized project state across reload/restart; a separate exported artifact file is intentionally deferred to the later report/export layer. The visual inspector shows the latest numeric summary rather than introducing a heavy chart/statistics subsystem in this first slice.

Optical flow is intentionally deferred until these simpler measurements are validated against real clips.

## Control injection / destruction controls

The first destruction-control slice is video-only and requires the same real timeline selection used by Temporal Scan. The selected interval is still capped at six seconds and the selected normalized ROI is used when present.

The initial controls are fixed canonical presets rather than free-form sliders:

- `noise`: strength `12`, deterministic seed `4242`
- `blur`: radius `2`
- `sharpen`: unsharp amount `1.25`
- `low-light`: brightness `-0.25`, contrast `1.05`, saturation `0.9`, noise strength `8`, deterministic noise seed `4242`

Payload-supplied parameter overrides are deliberately ignored in this first slice. The canonical parameters are copied into each stored request, so an experiment remains interpretable if preset defaults change later.

A control run does **not** compare an injected re-encoded clip directly with the original temporal measurement. That would mix the requested control effect with codec/re-encode effects. Instead every run produces a paired set:

1. `control baseline`: selected trim/ROI, no control filter
2. `injected`: the same selected trim/ROI plus exactly one canonical control filter

Both sides use the same encode profile:

- H.264 / `libx264`
- `veryfast` preset
- CRF `18`
- `yuv420p`
- no audio

The injected side is the only side that receives the control filter. Noise-based controls use fixed seeds so repeated runs do not silently change their synthetic noise realization.

After generation, the existing Temporal Scan metric stack measures both paired clips independently. The stored result contains:

- control kind and exact canonical params
- original time range and ROI
- exact FFmpeg control-filter string
- paired encode profile
- baseline and injected clip paths
- complete baseline and injected temporal metrics
- injected-minus-baseline deltas for frame-difference, edge, persistence, luma, and chroma summaries
- `comparisonMethod: "paired-reencode-baseline"`

Control results are written into the same persistent `edit.temporalStressTests` experiment history with `kind: "control-injection"`. This avoids a second history/state source; the UI filters the shared history into the latest raw Temporal Scan and latest Destruction Control summaries. The twenty-record cap currently applies to the combined temporal experiment history.

The present question is therefore narrower than "does this look similar?":

> When a known ordinary degradation is introduced while codec/trim/ROI are held constant against a paired control, how do the temporal and structural measurements change?

Reduced-bitrate/recompression and chromatic-aberration controls remain later additions because they need their own carefully matched control semantics rather than being folded into these first four filters.

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
4. Add the first temporal baseline metrics: luma/chroma trajectory, frame-difference energy, and edge persistence.
5. Add paired destruction-control presets with matched re-encode baselines.
6. Add audio loop + subtitle target interval.
7. Add recompression/chromatic-aberration controls and heavier persistence metrics such as optical flow only if the simpler baseline proves useful.
8. Add the restrained result categories above.

The first four steps have passed local Laboratory validation. Step 5 is implemented on the current branch and requires its targeted local regression/typecheck pass before it is treated as a clean checkpoint.

This sequencing deliberately reuses the existing FFmpeg preview/apply pipeline before adding heavier temporal tracking or OpenCV dependencies.
