# Laboratory Motion / Impact Probe

This note defines the first camera-compensated motion and impact workflow for Laboratory video inspection.

The goal is deliberately narrow: quantify translational image motion inside a target ROI, estimate shared camera motion from a locked reference ROI, and compare motion immediately before and after an operator-selected impact moment.

The workflow does not infer physical causality by itself.

## Operator flow

1. Select a short timeline interval.
2. Select a stable wall, door, tree, shelf or similar region and choose `Lock Reference ROI`.
3. Move the active ROI to the target and run `Motion Probe`.
4. For an impact/contact event, place the intended contact moment near the midpoint of the selected timeline interval and run `Impact ±500 ms`.

The latest reference lock for the same prepared source is reused until another reference ROI is locked.

## Motion extraction

Laboratory uses the existing FFmpeg runtime to extract deterministic grayscale frames:

- 10 fps
- maximum probe dimension 96 px
- optional normalized ROI crop
- bilinear scale
- raw 8-bit grayscale frames

No OpenCV or external motion-analysis dependency is required.

The host then performs a small translational block-matching search between adjacent frames:

- horizontal search: ±6 probe pixels
- vertical search: ±6 probe pixels
- matching metric: mean absolute grayscale error
- sampling step: 2 pixels

A confidence value combines:

- improvement over the zero-shift match
- separation between the best and second-best shift
- local texture energy

Low-texture or nearly uniform dark regions therefore receive lower confidence instead of producing an artificially strong direction claim.

## Source-pixel calibration

Target and reference ROIs may have different sizes. A one-pixel shift in a small 96-pixel probe is not necessarily the same physical image displacement as one pixel in another scaled ROI.

For that reason, every matched `dx` and `dy` is converted back to source-video pixels per frame before summaries are produced.

Stored vector fields use:

`vectorSpace: source-pixels-per-frame`

Reference subtraction is performed only after this calibration.

## Motion Vector Probe

The result stores:

- target `dx`, `dy`, magnitude and direction
- target confidence
- target frame-difference mean/peak
- optional reference `dx`, `dy`, magnitude and direction
- optional camera-compensated relative vector

Relative motion is:

`target vector - reference vector`

This is a first-order camera compensation model. It assumes that the dominant shared motion can be approximated as image-plane translation.

## Reference Region Lock

A reference lock is stored in the existing `edit.temporalStressTests` experiment history as:

`kind: motion-reference-lock`

No separate project-history system is introduced.

The locked record contains the source path and normalized ROI. Motion and impact probes use the newest lock that belongs to the same prepared source.

## Impact Window Compare

The midpoint of the selected timeline interval is treated as the impact/contact marker.

Laboratory automatically measures:

- before window: midpoint −500 ms to midpoint
- after window: midpoint to midpoint +500 ms

Target and, when available, reference motion are measured independently in both windows.

The result includes:

- target magnitude before/after
- reference magnitude before/after
- camera-compensated relative magnitude before/after
- relative magnitude delta
- relative direction delta
- target frame-difference delta
- reference frame-difference delta
- target motion-peak timestamp
- reference motion-peak timestamp
- `referenceLagMs`

`referenceLagMs = reference peak time - target peak time`

A positive lag means the strongest reference/camera motion was measured after the strongest target motion. A negative lag means it was measured earlier.

This is a temporal association only. It is not proof that target motion caused camera motion or vice versa.

## Limits of the first version

The current probe models translation only.

It does not yet estimate:

- rotation
- zoom
- perspective/homography changes
- deformation
- dense optical flow
- object identity or physical trajectory

Reference subtraction can therefore become unreliable during strong camera rotation, rapid zoom, rolling-shutter distortion or large perspective changes.

Those models should be added only if real Laboratory cases show a concrete failure that the translational probe cannot answer.

## Relationship to other Laboratory probes

Motion / Impact complements rather than replaces:

- Temporal Scan for frame activity, luma/chroma and edge persistence
- Photometric Attenuation Probe for darkness/recoverability
- Destruction Controls for transform and codec resistance

The combined workflow allows a later analysis session to ask separate questions about structure, photometry, motion and camera response without treating any single metric as a verdict about the target's origin or reality.
