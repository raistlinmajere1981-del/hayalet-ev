# Laboratory Architecture Reset

This document is the implementation target for the current Laboratory maintenance pass.

The room is still in a pre-stable development phase. Existing persisted Laboratory projects are test data and may be deleted. The reset therefore does **not** preserve old Laboratory project schemas, compatibility wrappers, or migration readers solely for backward compatibility.

This does **not** remove scientific or operational fallbacks. Confidence gates, fixed-ROI fallback when tracking is unreliable, non-destructive source handling, provenance, and conservative interpretation language remain part of the current measurement contract.

## Goals

1. One canonical implementation per analysis capability.
2. One canonical state owner for ROI/tracking UI state.
3. Typed analysis/result contracts instead of repeated `Record<string, unknown>` parsing across host and UI.
4. One report model per analysis result, reused by UI summary and Markdown export.
5. No obsolete or transition-only modules kept just to preserve old Laboratory data.
6. Keep measurement behavior stable while removing duplicate orchestration.

## Non-goals for this pass

Do not combine maintenance with new analysis features.

In particular, do not add homography/perspective tracking, new stress probes, new photometric metrics, new audio capabilities, or new mechanism/verdict language during this reset.

Dynamic stabilized photometric sampling may be implemented later as a separate feature after the canonical tracking/structural pipeline is stable.

## Canonical architecture

The media-analysis host has one orchestration path and one implementation module for each capability:

- `host/action-handlers.ts`
- `host/structural-transition.ts`
- `host/background-reference-convergence.ts`
- `host/camera-tracking.ts`

The UI likewise owns one structural summary/report formatter and one visual-response summary/report formatter. Canonical formatters build current report sections directly instead of patching previously formatted Markdown.

## Canonical host target

Use one media action runtime. `shared/host/action-composition.ts` must import the canonical `features/media-analysis/host/action-handlers.js` only.

`action-handlers.ts` should directly orchestrate the current behavior:

- response probes,
- appearance/disappearance transition,
- camera tracking,
- stabilized Structural Transition,
- optional Background Reference convergence,
- control photometry,
- recompression ladder,
- existing source/edit/export/profile/project action runtimes.

Do not run an older transition first and then replace it with a newer transition result.

### Canonical module names

After the reset, prefer:

- `camera-tracking.ts`
- `structural-transition.ts`
- `background-reference-convergence.ts`
- `action-handlers.ts`

Version information belongs in persisted provenance, not in module filenames or exported function names.

The tracking provenance may keep an explicit numeric algorithm version. Prefer an algorithm identifier such as `feature-similarity-ransac` with a separate `version` field instead of encoding the version twice in names.

## Canonical result contract

Old persisted Laboratory result formats do not need readers.

Create typed result/provenance contracts for at least:

- camera tracking cache and transform points,
- tracking provenance,
- Structural Transition result,
- Background Reference convergence result,
- Visibility/Response result,
- Appearance/Disappearance result,
- report descriptor/model.

The single canonical result field is `tracking`.

Prefer canonical coordinate-mode values such as:

- `fixed-roi`
- `camera-similarity`
- `fixed-roi-fallback`

Coordinate modes describe current measurement behavior and do not encode implementation history.

A schema version may remain useful for diagnostics/export, but only the current schema needs to be read. Do not add migrations for deleted test projects.

## Camera tracking contract to preserve

The current tracking algorithm is a feature-consensus similarity model and must retain the following behavior during refactor:

- estimates `dx`, `dy`, rotation, and scale,
- excludes Target from camera-feature estimation,
- excludes Control when supplied,
- can prefer Background/Reference as a fallback feature region,
- uses multiple features and outlier rejection,
- reports feature count, inlier ratio, residual/error, and forward/backward consistency,
- exposes high/medium/low/unreliable quality,
- does not apply an unreliable transform as if it were valid,
- caches transforms for sequential probes,
- keeps source media immutable,
- uses fixed-ROI fallback as a measurement-safety mechanism when tracking is unusable.

Do not remove the fallback simply because old project compatibility is being removed.

## Structural / convergence contract to preserve

Structural Transition must continue to sample Target, Control, and Background using camera-aligned measurement coordinates when the tracking quality gate passes.

Background Reference convergence must continue to align the event Target location to the user-selected reference time through the same camera transform. If reference alignment is unreliable, the result must remain explicitly limited rather than silently overstated.

Existing structural metrics remain in scope:

- SSIM-like similarity,
- pixel correlation,
- normalized absolute difference,
- edge similarity,
- structural persistence,
- Target-Control and Target-Background differential interpretation.

Do not change metric thresholds during the architecture reset unless a failing regression proves the old threshold is unreachable or internally inconsistent.

## Photometric / Visibility contract

Current photometric PRE/EVENT/POST and Visibility Response measurement sweeps still use fixed ROI coordinates. Tracking provenance/quality can gate interpretation, but these measurements must not be described as dynamically stabilized until that sampling path is actually implemented.

Remove historical wording such as `legacy fixed ROI`; simply describe the current coordinate mode accurately as `fixed ROI`.

## ROI and UI state ownership

The long-term target is a one-way flow:

```text
runtime/project state
      ↓
renderer
      ↓
interaction controller
      ↓
state mutation
```

Target, Control, and Background geometry must have one state source of truth. Avoid deriving durable ROI state from DOM geometry after render.

MutationObservers and DOM injection may remain only where they are genuinely needed for media-element lifecycle integration; they should not be the primary state synchronization mechanism.

Tracking Preview must read the canonical tracking cache/state. Report history must not be a second hidden source of truth once the canonical cache propagation is fixed.

The preview is diagnostic: raw ROI and stabilized ROI must remain visually distinguishable, and unreliable tracking must be labelled rather than silently corrected.

## Report architecture

Replace the current "format old Markdown, then patch text" pattern with:

```text
analysis result
      ↓
report model / sections
      ↓
+ UI compact summary
+ Markdown export
+ history descriptor
```

Structural and visual-response report code should consume typed result fields and shared tracking-report helpers.

The report must continue to state:

- source and selection context,
- measurement-only interpretation policy,
- tracking quality/provenance,
- raw camera drift,
- residual/error diagnostics,
- fallback/quality gate,
- coordinate mode,
- source immutability,
- perspective/homography limitation where relevant.

## Cleanup policy

Because old Laboratory test projects may be deleted:

- remove migration code whose only purpose is old Laboratory persisted data,
- remove compatibility wrapper exports after imports are moved,
- remove duplicate old/new result readers,
- remove history fallbacks that exist only to read superseded result shapes,
- update fixtures/regressions to the canonical shape rather than preserving obsolete fixtures.

Do **not** delete a file merely because static search does not find an import if it is path-loaded at runtime. Keep the existing cleanup keep-list for manifests, assets, tools, i18n, HTML/CSS entry points, and other dynamic resources.

## Suggested execution order

### Phase 1 — host canonicalization

1. Move the current camera tracker to the canonical module/name.
2. Merge Structural Transition metric helpers and stabilized runtime into one canonical module.
3. Merge Background Reference convergence into one canonical aligned implementation.
4. Fold the current tracking integration directly into `action-handlers.ts`.
5. Point `shared/host/action-composition.ts` to canonical `action-handlers.js`.
6. Delete superseded duplicate host modules.

### Phase 2 — result contracts

1. Add typed tracking and analysis result contracts in a focused domain module rather than expanding the existing general-purpose `lab-types.ts` indefinitely.
2. Persist tracking provenance in the canonical `tracking` field.
3. Normalize coordinate-mode and provenance names.
4. Remove old-result readers and compatibility branches.

### Phase 3 — reports

1. Replace the structural report wrapper/string replacements with one canonical structural report formatter/model.
2. Replace the visual-response wrapper with one canonical formatter/model.
3. Update report history to consume the canonical result/report model.
4. Keep Copy / Export Markdown behavior and newest-first history behavior.

### Phase 4 — ROI / preview state

1. Make Target/Control/Background state ownership explicit.
2. Remove DOM-derived duplicate state where safe.
3. Make Tracking Preview consume the canonical cache/state directly.
4. Keep object-fit-aware ROI geometry and non-destructive overlays.

### Phase 5 — delete / rename / docs

1. Remove remaining obsolete, compatibility-only, and transition-only modules/names.
2. Rename the tracking methodology document to a canonical non-versioned name.
3. Update `README.md`, root `LABORATORY.md`, tests and comments to describe only the current architecture.
4. Run cleanup inventory after the rename/deletion pass.

## Required validation

At minimum run locally after each structural phase:

```bash
npm run rooms:typecheck
npm run rooms:lint:strict
npm run laboratory:cleanup:inventory
npm run deps:check
```

Then run the focused Laboratory regressions affected by the phase. Before considering the reset complete run:

```bash
node rooms/laboratory/scripts/laboratory-check.mjs
```

Do not use GitHub Actions as the primary validation loop for this maintenance pass.

## Completion criteria

The reset is complete when:

- the media-analysis host has one analysis orchestration path,
- no old result is generated only to be replaced by a second implementation,
- Structural/Convergence use the canonical camera tracker directly,
- report code no longer patches old Markdown strings,
- only canonical source and result names remain; numeric versions appear only in provenance where diagnostically useful,
- ROI/tracking UI has one authoritative state path,
- old Laboratory test projects can be deleted without any migration step,
- Laboratory local gate passes,
- the existing live smoke test still produces a tracking cache, quality diagnostics, stabilized Structural result, and usable Tracking Preview.
