# Preview Brief: Forge Room Aggressive UI Revision

**Generated**: 2026-04-17

## Brief

- `room`: `forge-room`
- `feature`: `forge-workbench`
- `archetype`: `orchestration-workbench`
- `modifier`: guided left-side stage tower
- `active_stage`: pre-draft setup through draft entry
- `primary_action`: move the run from session setup to draft with
  explicit stage gating
- `preview_count`: 3

## Why 3 Previews

Forge Room normally allows a single base workbench preview, but this
revision changes hierarchy and stage behavior enough to justify 3
structural checks:

1. base setup shell
2. preflight-ready progression
3. draft-entry transition

These are materially different attention states. Extra style variants
are not needed yet.

## Direction Summary

- The left side becomes a viewport-height stage tower.
- Only one stage body is open at a time.
- Closed stages remain visible as accordion headers with status.
- `Previous` / `Next` live inside the active stage footer.
- `Operator Profile` stays top-bar only.
- `BASLANGIC HATTI` is removed entirely.
- Center and right lanes remain live support surfaces, but they are
  visually secondary to the left staged workflow.

## Preview Plan

### Preview 01: `setup-shell`

- `state_covered`: first entry, session stage active, no preflight yet
- `purpose`: validate the new shell relationship
- `must_show`:
  - full-height left stage tower
  - session management as stage 1
  - closed goal/operator/preflight/draft headers underneath
  - top-bar `Operator Profile` action
  - center/right lanes still alive but demoted
- `question_answered`: does the room read as a guided forge surface
  instead of a dashboard or tall stacked form?

### Preview 02: `preflight-ready`

- `state_covered`: session, goal, and operator stages completed;
  preflight stage active and ready to advance
- `purpose`: validate progress visibility and gating clarity
- `must_show`:
  - completed accordion headers above the active stage
  - enabled `Next` button
  - stale/warning/ready state affordance around preflight
  - no duplicate helper narration
- `question_answered`: can the user understand why progression is
  unlocked without scanning the whole screen?

### Preview 03: `draft-entry`

- `state_covered`: setup is complete, process tracking has handed off to
  draft, draft stage is active
- `purpose`: validate the transition from setup flow into real draft work
- `must_show`:
  - draft stage open in the left tower
  - completed setup stages collapsed above
  - center response lane and right synthesis/export lane still visible
    as support surfaces
  - draft body using internal scroll instead of page-height growth
- `question_answered`: does draft feel like a natural continuation of
  the staged setup flow?

## States Intentionally Not Previewed

- `response-ready`
- `synthesis-ready`
- `export-ready`

These are important runtime states, but they do not change the shell
structure enough to deserve separate preview coverage in this revision
pass.

## Validation Pass

- Primary action is obvious in every preview.
- Left stage tower is the dominant surface.
- Center/right lanes stay justified by live state.
- The result must not resemble a generic admin dashboard.
- Locked, ready, active, and completed states must be legible without
  relying on helper text alone.

## Approval Gate

If this preview direction is accepted, the next step is:

1. explicit UI approval
2. project-standard code-change approval block
3. implementation
