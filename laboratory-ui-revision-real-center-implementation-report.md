# Laboratory UI Revision - Real Center Implementation Report

Generated: 2026-04-29

## Scope

Phase 1 focused on a single product feeling: media and timeline should read as one editing object. The intended user perception was:

> "I am working on this video."

The implementation intentionally stayed inside the first phase:

- enlarge the media viewport so it dominates the center workbench;
- remove the separate-card feeling between media, transport, and timeline;
- attach the timeline directly under the video/media surface;
- add first-version finalized selection start/end to video seek sync;
- leave realtime drag preview out of scope.

## Workflow Notes

- Initial implementation workflow was terminal/plain text: `mode:status=terminal`, `whereami.effectiveMode=other-provider-cli`.
- The user explicitly approved implementation and asked not to pause between successful sprints.
- Later, the app was open on the Laboratory page. Reconnection succeeded through CDP port `9222`.
- The active CDP webview target was `Laboratory Workspace` at `rooms/.build/laboratory/runtime/ui/index.html`.
- No ghost-agent transition was required for this terminal/provider workflow.
- The worktree already contained unrelated Laboratory changes before this phase. This report covers only the files touched for the Real Center phase.

## Sprint 1 - Unified Media Workbench

Status: Complete

Implemented in:

- `rooms/laboratory/ui/workspace-surface.ts`

Result:

- Added a single `.labx-media-workbench` wrapper around:
  - `.labx-workspace-preview`;
  - optional `.labx-dual-preview-transport`;
  - `renderLabWaveformTimeline(...)`.
- Kept the source bar and linked audio bar outside the workbench.
- Preserved the existing timeline visibility rule: timeline renders only when `durationMs > 0`.
- Preserved the existing media preservation markers inside the preview media node.

Plan alignment:

- Media + Timeline now share one semantic container.
- In single preview mode, timeline follows media directly.
- In dual preview mode, transport stays between preview and timeline as an inline workbench control, not as a separate card.

## Sprint 2 - Viewport Authority and Attached Timeline

Status: Complete

Implemented in:

- `rooms/laboratory/ui/lab-theme.css`

Result:

- Added `.labx-media-workbench` as the single outer surface.
- Set the workbench layout to column flow with `gap: 0`.
- Reduced preview framing:
  - no preview border;
  - no preview radius;
  - no preview shadow.
- Reduced timeline framing inside the workbench:
  - top separator only;
  - no standalone radius;
  - no standalone shadow.
- Converted dual preview transport to inline toolbar behavior inside the workbench.
- Increased media preview vertical authority with responsive height rules.
- Ensured workspace video/image media fill the preview surface while keeping `object-fit: contain`.

Desktop CDP smoke:

- Target: `Laboratory Workspace` webview on CDP port `9222`.
- Viewport: `1918 x 938`.
- Workbench rect: `1551 x 1144.421875`.
- Preview rect: `1549 x 871.3125`.
- Timeline rect started exactly at preview bottom.
- `previewRect.height / workbenchRect.height = 0.7613560340237292`.
- `previewTouchesTimeline = 0`.
- Workbench computed `gap = 0px`.
- Preview computed border widths were `0px`.
- Preview computed radius was `0px`.
- Preview computed shadow was `none`.
- Timeline computed top border was `1px`; other timeline borders were `0px`.
- Timeline computed radius was `0px`.
- Timeline computed shadow was `none`.

Plan alignment:

- The desktop measured ratio is above the required `0.6`.
- Timeline is directly attached to the preview with zero measured gap.
- The separate card feeling is removed from preview, transport, and timeline.

## Sprint 3 - Selection to Video Seek Sync

Status: Complete

Implemented in:

- `rooms/laboratory/runtime/lab-run-controller.ts`

Result:

- Added deterministic seek behavior for finalized timeline selection edits.
- Drag selection start now seeks to the selection anchor once drag selection begins.
- Drag selection end now seeks to the final accepted edge on mouseup.
- Start handle release seeks to the accepted start.
- End handle release seeks to the accepted end.
- Body drag release seeks to the accepted shifted selection start.
- Numeric start input seeks only when the requested finite value is accepted.
- Numeric end input seeks only when the requested finite value is accepted.
- Invalid or clearing edits do not seek.

Plan alignment:

- First-version selection start/end to video sync is implemented.
- Realtime seek while dragging remains intentionally out of scope.
- The behavior is deterministic and covered by targeted runtime tests.

## Tests Updated

Updated targeted tests:

- `scripts/tests/laboratory-controller-runtime-regressions.test.ts`
- `scripts/tests/laboratory-workspace-runtime-regressions.test.ts`
- `scripts/tests/laboratory-ui-evaluation-regressions.test.ts`

Coverage added or adjusted:

- Workbench markup assertions.
- CSS source assertions for unified surface, zero gap, reduced preview/timeline framing, inline transport, and media sizing.
- Timeline drag seek expectations:
  - anchor/start seek when selection drag begins;
  - final edge seek on mouseup.
- Start handle, end handle, and body drag seek expectations.
- Numeric start/end input seek expectations.
- Invalid numeric end edit and empty end edit no-seek expectations.

## Validation

Syntax checks:

- `rooms/laboratory/ui/workspace-surface.ts`: passed.
- `rooms/laboratory/ui/lab-theme.css`: passed.
- `rooms/laboratory/runtime/lab-run-controller.ts`: passed.
- `scripts/tests/laboratory-controller-runtime-regressions.test.ts`: passed.
- `scripts/tests/laboratory-workspace-runtime-regressions.test.ts`: passed.
- `scripts/tests/laboratory-ui-evaluation-regressions.test.ts`: passed.

Targeted regression suite:

```bash
npm run rooms:test:file -- scripts/tests/laboratory-ui-evaluation-regressions.test.ts scripts/tests/laboratory-controller-runtime-regressions.test.ts scripts/tests/laboratory-workspace-runtime-regressions.test.ts scripts/tests/laboratory-wireframe-v2-contract-regressions.test.ts
```

Result:

- `75` tests passed.
- `0` tests failed.

Typecheck:

```bash
npm run rooms:typecheck
```

Result:

- Passed.

Room lint:

```bash
npm run rooms:lint
```

Result:

- Passed with exit code `0`.
- `0` errors.
- `3` warnings in `rooms/laboratory/ui/lab-root.ts`.
- Those warnings are outside this phase's touched files and were left unchanged.

CDP smoke:

- Reconnected to the already-open app.
- Found `1` CDP instance on port `9222`.
- Found `2` targets:
  - main page: `Hayalet Ev`;
  - webview: `Laboratory Workspace`.
- Confirmed workbench, preview, media, and timeline exist in live DOM.
- Confirmed desktop preview ratio and zero-gap attach values listed above.

## Final Sub-Agent Review

Reviewer: sub-agent `Bacon`

Result: no findings.

Review confirmed:

- Media, preview transport, and timeline are inside `.labx-media-workbench`.
- Source bar and linked audio remain outside the workbench.
- Preview height and desktop ratio target are preserved.
- Preview, timeline, and transport card feeling is reduced.
- Timeline is attached with top-border-only styling.
- Selection start/end seek behavior is deterministically split.
- Numeric start/end seek behavior is tested.
- UI source assertions protect the workbench, zero-gap intent, reduced framing, inline transport, and media sizing intent.

No additional fixes were required after review.

## Residual Risk

- Narrow/mobile live CDP emulation did not apply reliably to the Electron webview, so a real narrow viewport DOM measurement is still a test gap.
- Narrow behavior is protected by static CSS assertions, but overlap/scroll ergonomics should be verified later with a reliable Electron resize path or real narrow device/window.
- Some UI tests are source/CSS assertion based. The desktop CDP smoke reduces the risk for the primary phase goal, but future visual regressions would benefit from a stable screenshot or DOM measurement harness.

## Closeout

The Real Center phase is implemented and validated for the primary desktop workflow. The core product contract is now in place: the media viewport and timeline behave as one center workbench, and finalized selection edits seek the video to the selected edge.
