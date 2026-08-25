# Laboratory Transform Stress Test

This note defines the reproducible visual/audio transform stress-test workflow without changing the immutable source media.

Laboratory is not a paranormal detector and not an automatic fake detector. The stress-test layer asks a narrower question:

> Which measured structures survive, weaken, emerge or disappear under controlled transforms, and is that behavior shared by the surrounding scene or localized to the target?

Detailed differential-response behavior is documented in [`VISUAL-RESPONSE-STRESS-PROBES.md`](./VISUAL-RESPONSE-STRESS-PROBES.md). Photometric dark-recovery behavior remains documented in [`PHOTOMETRIC-ATTENUATION.md`](./PHOTOMETRIC-ATTENUATION.md).

## Core model

A stress-test session is attached to a prepared source, a real timeline interval and an optional ROI.

The immutable source is never replaced. Preview, baseline, difference, control and analysis outputs are derived artifacts.

The ordered transform recipe remains part of provenance:

```ts
export type LaboratoryTransformStage = {
  id: string;
  kind: string;
  enabled: boolean;
  params: Record<string, unknown>;
};
```

Order matters. `denoise -> sharpen` is not equivalent to `sharpen -> denoise`.

## Ordered transform stack

Implemented visual operations include:

- brightness
- contrast
- gamma
- saturation
- blur
- sharpen
- grayscale
- RGB channel isolation
- denoise

Implemented audio operations include:

- high-pass
- low-pass
- band-pass
- gain

Live workspace controls are audition surfaces. The ordered Transform Stack is the reproducible experiment recipe.

## Source / Transform / Difference

The visual workbench provides:

1. Source baseline
2. Transform
3. Difference

The Source baseline is generated through the same base trim/crop/resize recipe without stress-transform stages. Difference is computed between aligned outputs; raw source geometry is not compared directly against a resized/cropped transform.

A stale preview is not treated as current evidence.

## Temporal Scan

Temporal testing uses the prepared original video source.

A real timeline selection is required. The range is capped at six seconds and defaults to 5 fps, bounded to 1–10 fps. When an ROI exists, the measurement is ROI-scoped; otherwise it is full-frame.

Current FFmpeg-first measurements include:

- luma trajectory
- chroma U/V trajectory
- frame-difference energy
- edge energy
- legacy edge-presence persistence
- spatial adjacent-frame edge persistence

### Spatial edge persistence

Adjacent edge maps are compared using a weighted overlap equivalent derived from previous/current edge energy and absolute edge-map difference:

```text
intersection = (previous + current - difference) / 2
union        = (previous + current + difference) / 2
IoU          = intersection / union
```

Empty-edge pairs are excluded instead of being called perfectly persistent.

Optical flow remains a separate question; spatial edge persistence does not claim tracked object identity.

## Photometric Attenuation Probe

The dedicated photometric probe measures near-black structure and repeats the measurement after a zero-preserving 8x luma lift.

It separates:

- source near-black fraction
- persistent near-black floor after lift
- recovered dark fraction
- luma structure

This is a measurement of recoverability, not proof of an absorption mechanism.

## Reference / Background ROI

The existing Motion Reference lock now has a second role.

A locked Reference ROI can be reused as the **Background ROI** for differential visual probes.

Recommended workflow:

1. select timeline interval,
2. select stable nearby background,
3. lock Reference / Background ROI,
4. select Target ROI,
5. run Motion, Visibility Response, Transition or codec differential tests.

The lock remains source-scoped so a stale reference from another source does not silently become the active background.

## Sensor / Codec destruction controls

Paired controls retain the same selected interval and ROI while changing one intended degradation family.

Current direct controls:

- Noise
- Blur
- Sharpen
- Denoise
- Gamma stress
- Black crush
- Highlight clipping
- Chroma suppression
- Low-light
- Recompression

Filter controls use matched H.264/libx264 encode settings on baseline/injected outputs; only the injected side receives the selected visual degradation.

Recompression uses the same codec family/preset/pixel format and changes encode quality. The normal paired preset remains CRF 18 baseline versus CRF 36 injected.

Unlike the original first slice, runtime parameter normalization now preserves valid supplied numeric overrides on top of definition defaults. This is required by the deterministic recompression ladder while ordinary UI presets still use their declared defaults.

## Recompression ladder

The composite codec stress test runs:

```text
CRF 18 → 24 → 30 → 36 → 42
```

Target is measured at every step. If a Background ROI is locked, the same ladder is repeated for Background and the target-minus-background degradation curve is retained.

The ladder is intentionally sequential rather than launching all FFmpeg jobs at once.

## Visibility / Contrast Response Probe

A response run sweeps exactly one transform axis at a time:

- exposure
- gamma
- brightness
- black level
- contrast
- local contrast
- blur
- denoise
- sharpen

The transform is applied consistently before ROI measurement. Target and Background then receive the same measurement stack.

Each sweep step records normalized metrics including:

- mean/temporal-median luma
- luma low/high/min/max spread
- chroma distance
- near-black
- persistent near-black
- recovered dark
- edge energy
- edge persistence
- frame-difference energy
- temporal persistence
- signal/noise-like ratio
- visibility score

For each numeric metric the record also stores:

```text
Target - Background
```

The point is not “filter on/off” but the shape of the response curve.

## Appearance / Disappearance Transition Probe

The midpoint of the selected timeline interval is treated as the approximate event time.

Default windows:

```text
PRE   event -1.0 s → event -0.2 s
EVENT event -0.2 s → event +0.2 s
POST  event +0.2 s → event +1.0 s
```

Windows are clamped at source boundaries.

Target and Background are measured in parallel for each phase. The result can therefore distinguish a broad illumination/camera change from a change that is more localized to the target ROI.

## Readable interpretation layer

Raw metrics remain primary evidence. Human-readable interpretation is deliberately restrained.

Allowed result language includes:

- target and background change together
- response resembles surrounding physical structures
- target response differs
- change appears localized toward target
- behavior is compatible with low-light / sensor response
- global sensor response alone does not explain the measured divergence
- codec degradation affects target faster / similarly
- sample insufficient
- result uncertain

These labels are not mechanism verdicts.

In particular:

```text
different response != paranormal
```

and the UI must not convert a metric class into a real/fake conclusion.

## Live result surface

Manual stress testing reuses the lower live-result area whenever a full analysis run is not active.

The workspace exposes:

- Source / Transform / Difference preview
- Temporal Scan
- Photometric Probe
- Motion / Impact
- Reference / Background ROI lock
- Sensor / Codec stress controls
- Response Curves
- Appearance / Disappearance Transition
- codec ladder

Live Results can show:

- Target curve
- Background curve
- differential curve
- Target / Background ROI coordinates
- response metric table
- PRE / EVENT / POST transition table
- codec degradation table
- human-readable classification

The newest response records remain project-local history entries. This slice does not introduce a separate heavy statistics database.

## Response comparison

Multiple Visibility Response records are retained and the latest runs are visible together. This supports comparisons such as target vs human vs tree/rock vs dark background, provided the operator keeps the sweep axis and experimental geometry comparable.

A cross-project statistical aggregation layer is intentionally not part of this implementation.

## Performance

The differential response probe is heavier than a preview filter.

For every sweep value and every ROI it runs three measurement passes:

1. source signal/luma/chroma/near-black
2. edge pass
3. lifted-dark pass

Sweeps are therefore deliberately short and sequential.

The recompression ladder is also sequential to avoid turning one experiment into a burst of concurrent FFmpeg jobs.

## Persistence and provenance

Completed runs retain the relevant:

- source path / project relation
- source timestamp interval
- Target ROI
- Background ROI when used
- ordered stages or sweep axis
- transform/control values
- generated paired paths where applicable
- raw metrics
- target-minus-background deltas
- interpretation class
- run timestamp

The immutable source is never replaced.

## Validation

Focused regression:

```bash
npm run rooms:test:file -- scripts/tests/laboratory-visual-response-regressions.test.ts
```

Full Laboratory gate:

```bash
node rooms/laboratory/scripts/laboratory-check.mjs
```

## Current sequencing

Implemented foundation now includes:

1. ordered visual/audio transform recipe
2. stable recipe signatures and provenance
3. Source / Transform / Difference
4. temporal luma/chroma + frame-difference + edge metrics
5. spatial adjacent-edge-map persistence
6. Photometric Attenuation Probe
7. Motion / Impact Probe
8. expanded Sensor / Codec controls
9. Target / Background differential measurement
10. Visibility / Contrast response curves
11. Appearance / Disappearance transition windows
12. CRF 18 → 42 codec ladder
13. human-readable non-verdict summaries
14. shared live-result surface

Audio reconstruction remains a later stage. Optical flow should still be added only if the current motion/spatial measurements leave a concrete unanswered question.
