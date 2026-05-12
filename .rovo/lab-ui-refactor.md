# Laboratory UI Refactor

This is the canonical continuity note for the Laboratory UI refactor.

## Direction

Laboratory keeps the dark cyan lab identity and adds a denser DAW-like control language: tabular numbers, monospace metadata, tighter control rows, a consistent type scale, and a shared button/card/pill/input primitive layer.

## Current State

- Phase 0 introduced `rooms/laboratory/ui/styles/lab-tokens.css` and `rooms/laboratory/ui/styles/lab-primitives.css`.
- `rooms/laboratory/ui/styles/base.css` imports the token and primitive layers before the existing theme files.
- The refactor changed the Laboratory CSS layer and kept runtime state, event dispatch, store selectors, i18n keys, and public `data-lab-*` selectors stable.
- Selection and ROI controls live in the drawer-side selection panel. The preview overlay only renders the ROI mask, resize handles, legacy ROI regions, and clear affordance.
- `--labx-*` token aliases remain as a compatibility layer while older style rules are migrated to semantic `--lab-*` tokens.

## Completed Work

| Phase   | Area                                         | Status |
| ------- | -------------------------------------------- | ------ |
| 0       | Tokens and primitives                        | Done   |
| 1       | Top bar, source panel, URL import            | Done   |
| 2       | Workspace, timeline, ROI overlay             | Done   |
| 3       | Drawer, inspector, right rail                | Done   |
| 4       | Boot, processing, report, empty/error states | Done   |
| Cleanup | Docs, unreachable ROI toolbar, formatting    | Done   |

## Important Decisions

- Keep `.labx-*` class names and `data-lab-*` attributes stable; these are part of the room UI contract.
- Prefer new `--lab-*` semantic tokens for new or touched CSS.
- Keep `--labx-*` aliases in `lab-tokens.css` until a separate compatibility-removal pass can update all remaining selectors and tests.
- Do not reintroduce the inline ROI toolbar inside the preview stage; the drawer-side selection panel owns focus, capture, inspection mode, and intent controls.

## Validation Checklist

- `npm run rooms:typecheck`
- `npm run rooms:lint`
- `npx prettier --check "rooms/laboratory/ui/styles/*.css" "docs/lab-ui-refactor.md"`
- `git diff --check`
- `npm run rooms:test:file -- scripts/tests/laboratory-selection-runtime-regressions.test.ts`
- `npm run rooms:test:file -- scripts/tests/laboratory-source-ui-regressions.test.ts`
- `npm run rooms:test:file -- scripts/tests/laboratory-ui-evaluation-regressions.test.ts`
- `npm run rooms:test:file -- scripts/tests/laboratory-waveform-runtime-regressions.test.ts`
