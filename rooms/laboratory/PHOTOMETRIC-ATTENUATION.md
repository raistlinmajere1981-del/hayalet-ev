# Laboratory Photometric Attenuation Probe

This note defines the first image-level test for the channel claim that some target figures appear to absorb or strongly attenuate light.

The claim is treated as a hypothesis, not as a fact and not as a paranormal conclusion.

## Operational question

The first probe does not ask whether an entity literally absorbs light. It asks narrower questions that the recorded video can support:

- how much luminance the selected ROI carries
- how much of the ROI is near the digital black floor
- how much near-black content becomes visible after a zero-preserving multiplicative luma lift
- how much remains near-black after that lift
- whether the ROI still contains measurable internal luma structure

These measurements can make severe attenuation or clipping more or less plausible at image level, but they cannot distinguish active light absorption from ordinary causes by themselves.

## Current method

The probe reuses the current real timeline selection and optional ROI. The same six-second maximum and sampling rate rules as Temporal Scan apply.

Two FFmpeg passes are used.

### Pass 1 — source photometry

The original prepared video is measured without a brightness offset.

The pass records:

- `YMIN`
- `YLOW`
- `YAVG`
- `YHIGH`
- `YMAX`
- average U/V chroma
- `blackframe.pblack`

Pixels below 32/255 luma are treated as near-black for this first probe.

### Pass 2 — zero-preserving recovery

Only luma is multiplied by 8 with `lutyuv=y=val*8` before the same near-black measurement.

A multiplicative lift is deliberate. A positive brightness offset would turn digital zero into a positive value and would therefore make clipping/floor analysis meaningless. Multiplication leaves zero at zero while amplifying low non-zero signal.

## Stored summary

The probe stores a `kind: "photometric-attenuation"` record in the existing `edit.temporalStressTests` history.

Important summary fields are:

- `meanLuma`
- `meanNearBlackFraction`
- `recoveredDarkFraction`
- `persistentNearBlackFraction`
- `nearBlackRetentionRatio`
- `lumaLowHighSpread`
- `chromaNeutralDistance`

The human-readable interpretation describes only measured darkness, recoverability and persistent near-black behavior.

## Interpretation limits

A high persistent near-black fraction after the 8x lift is compatible with severe attenuation or an imaging-chain floor/clipping condition. It is not unique to active light absorption.

Ordinary mechanisms that can produce similar recorded behavior include:

- very low reflectance / dark material
- shadow or occlusion
- underexposure
- sensor black floor or limited dynamic range
- tone mapping / local exposure behavior
- codec quantization and compression loss

Likewise, a highly recoverable dark region means low-level signal exists in the recording; it does not identify the physical source of that darkness.

## Relationship to edge persistence

Spatial edge persistence measures overlap of detected edge structure across adjacent frames.

If two adjacent edge maps are both empty, their union is zero and IoU is undefined. Those pairs are excluded instead of being assigned artificial 100% persistence.

This exclusion makes no claim about why the edge maps are empty. Severe photometric attenuation, low contrast, blur, underexposure or threshold choice can all reduce detected edges.

Therefore edge absence is not discarded as evidence; it is simply not converted into a false persistence score. Photometric attenuation probing is the complementary measurement for cases where the target may carry too little luminance structure for edge metrics to be informative.

## Comparison discipline

The probe describes only the selected ROI. A strong result should not be interpreted in isolation.

The next empirical step is to run the same probe on a nearby ordinary dark/reference region from the same scene and time window. If the target and reference behave similarly, the result supports an ordinary imaging explanation. If they separate consistently across multiple clips, that separation becomes a reason to refine the target/reference model.

The current implementation does not automate that reference comparison yet.

The previously validated CRF 18 → CRF 36 recompression control produced no clear measured change in its tested paired interval. That result does not answer the light-attenuation hypothesis because it tested codec robustness rather than the target's near-black signal structure.

## Validation status

The host/runtime/UI slice is implemented but should be considered validation-pending until the local regression/typecheck/Laboratory gate and one real FFmpeg smoke run complete.

## Next refinement

The current probe is ROI-internal. It can determine how dark and recoverable the selected region is, but it does not yet measure attenuation relative to a matched local reference region.

If real tests show useful separation, the next photometric refinement should compare a tight target ROI against a nearby reference/background ROI from the same frames. That target/reference design is more valuable than adding heavier motion tracking prematurely.
