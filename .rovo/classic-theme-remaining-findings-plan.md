# Plan: Classic Theme Remaining Findings Remediation

**Generated**: 2026-03-21
**Estimated Complexity**: High

## Overview
This plan covers the remaining findings after the original classic theme design-system remediation work.

The large structural and code-side remediation work is now complete:
- lazy stylesheet loading is retry-safe,
- ownership contracts and documentation model lazy delivery explicitly,
- page-local hardcoded theme drift has been moved behind centralized classic aliases,
- the audit baseline is reduced to `0`.

The remaining gap is closure evidence rather than implementation debt:
- final visual/manual verification is still not captured as repo-visible checklist and sweep artifacts.

This follow-up plan keeps scope focused on classic renderer theming and validation closure.

## Status Update

Status as of 2026-03-21:
- Sprint 1 is implemented and validated.
- Sprint 2 is implemented and validated.
- Sprint 3 is implemented and validated, and the design-system audit baseline is now `0`.
- Sprint 4 is closed with scoped manual verification evidence recorded in `.rovo/classic-theme-manual-verification.md`.
- Closure is based on a user-approved Archives page screenshot spot-check rather than the broader Electron/manual sweep originally planned.

In scope:
- `src/styles/**` classic renderer styles
- renderer page controllers and runtime style loading
- CSS ownership contracts and related regression coverage
- visual verification evidence for classic themes and pages

Out of scope:
- `ghost-agent/**`
- scene art packages and content under `shared/themes/**`
- broad UI redesign unrelated to the remaining findings
- non-theme product behavior changes

## Prerequisites
- Preserve the public classic theme IDs and user-visible meaning of `obsidian`, `ivory-lab`, and `ember-console`.
- Treat the current worktree as dirty; plan execution must avoid reverting unrelated user changes.
- Keep standalone `archives.html` and `whisper.html` working while hardening shell-side lazy delivery.
- Prefer semantic theme aliases and page-scoped semantic tokens over page-local raw RGB/HSL literals.
- Any task that changes CSS delivery must continue to pass entrypoint, selector-contract, modularization, audit, build, and dist graph validation.

## Sprint 1: Alignment, Retry Safety, and Contract Repair
**Goal**: Close the plan-to-code mismatches before touching more visuals.
**Demo/Validation**:
- Lazy page styles recover cleanly after a failed dynamic import.
- Ownership docs and contract helpers describe lazy stylesheet delivery consistently.
- Regression tests fail if retry behavior or delivery contracts regress.

### Task 1.1: Add Retry-Safe Runtime Page Style Loading
- **Location**: `/home/raistlin/hayalet-ev/src/js/app/runtime-page-styles.ts`, `/home/raistlin/hayalet-ev/src/js/pages/archives/controller.ts`, `/home/raistlin/hayalet-ev/src/js/pages/whisper/page-controller.ts`
- **Description**: Refactor the lazy CSS loader so a failed `archives.css` or `whisper.css` import does not poison the cache forever. Rejected requests should clear or replace the cached promise, and hosted page controllers should decide how to surface failure safely. Extract a mockable loader registry or test-only injection seam so retry behavior can be verified without relying on brittle bundler failures.
- **Complexity**: 5
- **Dependencies**: None
- **Acceptance Criteria**:
  - A failed lazy CSS request does not permanently block future open attempts.
  - Archives and whisper overlays can retry style loading without a full page reload.
  - Failure behavior is explicit and testable rather than implicit promise reuse.
  - The loader implementation exposes a controlled seam for simulating one failed import and a later successful retry.
- **Validation**:
  - Add regression coverage for loader retry behavior using the extracted seam or injected loader.
  - Verify shell-hosted archives and whisper still open after a simulated first-failure / second-success path.

### Task 1.2: Replace Ambiguous `shellStylesheet` Contract Language with Delivery Semantics
- **Location**: `/home/raistlin/hayalet-ev/scripts/lib/classic-css-contract.mjs`, `/home/raistlin/hayalet-ev/.rovo/classic-css-ownership-matrix.md`, `/home/raistlin/hayalet-ev/scripts/tests/classic-css-entrypoint-regressions.test.ts`
- **Description**: Rename or remodel the contract fields that still imply direct shell linking for `archives` and `whisper`. The source-of-truth should distinguish between linked CSS, runtime lazy CSS, standalone delivery, and embedded fragment ownership.
- **Complexity**: 4
- **Dependencies**: Task 1.1
- **Acceptance Criteria**:
  - Ownership helpers and docs use the same delivery language for linked versus lazy-loaded CSS.
  - `archives` and `whisper` no longer look like directly linked shell styles in contract metadata.
  - Tests cover the renamed delivery model.
- **Validation**:
  - Diff docs and contract helpers together.
  - Re-run entrypoint regression tests to confirm the new terminology still maps to real ownership.

### Task 1.3: Add a Remaining-Findings Closure Ledger
- **Location**: `/home/raistlin/hayalet-ev/.rovo/`, `/home/raistlin/hayalet-ev/scripts/tests/`
- **Description**: Create a small checklist or ledger that maps each remaining finding to its code, test, and validation evidence. This becomes the closure artifact for the follow-up plan instead of relying on narrative memory.
- **Complexity**: 3
- **Dependencies**: Task 1.2
- **Acceptance Criteria**:
  - Every remaining finding has a tracked owner, target files, and verification step.
  - The ledger differentiates `fixed`, `partially mitigated`, and `manual verification required`.
- **Validation**:
  - Review the ledger against the sub-agent findings and current regression suite.

## Sprint 2: Archives Theme Reconciliation and Visual Debt Extraction
**Goal**: Remove the most obvious theme-breaking hardcoded styling, starting with the Archives UI shown in the screenshot.
**Demo/Validation**:
- Archives surface, field, tab, and chip styling reads from centralized classic theme aliases instead of raw warm palette literals.
- The page remains visually distinct where intended, but no longer looks hardcoded or detached from the active theme.
- Theme switching changes the Archives page coherently across all classic themes.

### Task 2.1: Inventory Archives-Specific Hardcoded Visual Overrides
- **Location**: `/home/raistlin/hayalet-ev/src/styles/archives.css`, `/home/raistlin/hayalet-ev/src/styles/design-system/themes/theme-classic-aliases.css`
- **Description**: Split the current Archives overrides into three buckets: `should use shared alias`, `needs page semantic alias`, and `intentional one-off geometry`. Use the screenshot and audit output to identify the visually dominant offenders first.
- **Complexity**: 4
- **Dependencies**: Sprint 1
- **Acceptance Criteria**:
  - All `--surface-card-*`, `--field-*`, `--ds-choice-*`, and `--archives-*` overrides are categorized.
  - The plan identifies which raw values are causing the screenshot mismatch.
- **Validation**:
  - Produce a before/after mapping from hardcoded variables to semantic owners.

### Task 2.2: Move Shared Archives Surface Overrides into Theme Aliases
- **Location**: `/home/raistlin/hayalet-ev/src/styles/design-system/themes/theme-classic-aliases.css`, `/home/raistlin/hayalet-ev/src/styles/design-system/themes/theme-obsidian.css`, `/home/raistlin/hayalet-ev/src/styles/design-system/themes/theme-ivory-lab.css`, `/home/raistlin/hayalet-ev/src/styles/design-system/themes/theme-ember-console.css`, `/home/raistlin/hayalet-ev/src/styles/archives.css`
- **Description**: Promote Archives surface, field, chip, and tab values that represent reusable theme semantics into the classic alias layer. Leave `archives.css` with semantic references instead of raw palette declarations wherever possible.
- **Complexity**: 7
- **Dependencies**: Task 2.1
- **Acceptance Criteria**:
  - `archives.css` no longer overrides centralized surface-card primitives with raw RGB gradients unless a documented exception remains.
  - Archives field and choice states consume semantic aliases rather than redefining raw colors locally.
  - The page keeps its functional hierarchy without locking itself to one warm palette.
- **Validation**:
  - Audit the file before and after; raw color count in `archives.css` drops materially.
  - Compare theme behavior under `obsidian`, `ivory-lab`, and `ember-console`.

### Task 2.3: Introduce Page Semantic Tokens for Intentional Archives Personality
- **Location**: `/home/raistlin/hayalet-ev/src/styles/design-system/themes/theme-classic-aliases.css`, `/home/raistlin/hayalet-ev/src/styles/design-system/themes/theme-obsidian.css`, `/home/raistlin/hayalet-ev/src/styles/design-system/themes/theme-ivory-lab.css`, `/home/raistlin/hayalet-ev/src/styles/design-system/themes/theme-ember-console.css`, `/home/raistlin/hayalet-ev/src/styles/archives.css`
- **Description**: Where Archives genuinely needs page-specific mood, encode that through semantic page tokens such as `--archives-accent-*`, `--archives-item-*`, or similar theme-resolved aliases rather than raw inline palette values.
- **Complexity**: 6
- **Dependencies**: Task 2.2
- **Acceptance Criteria**:
  - Remaining Archives-specific visuals are represented as semantic aliases, not raw page literals.
  - The same semantic names resolve differently under each classic theme.
- **Validation**:
  - Theme diff review confirms the page changes with the active theme instead of staying amber/brown.

### Task 2.4: Recheck Other High-Risk Classic Pages for Similar Drift
- **Location**: `/home/raistlin/hayalet-ev/src/styles/analyze.css`, `/home/raistlin/hayalet-ev/src/styles/assistant.css`, `/home/raistlin/hayalet-ev/src/styles/server.css`, `/home/raistlin/hayalet-ev/src/styles/whisper.css`
- **Description**: Use the same inventory method on other classic pages that still dominate the audit with raw colors. Prioritize files where current visuals are likely to remain locked to one palette despite theme switching.
- **Complexity**: 6
- **Dependencies**: Task 2.2
- **Acceptance Criteria**:
  - A prioritized shortlist exists for the next visual debt slice after Archives.
  - At least the worst remaining cross-theme drift points are identified, even if not all are fixed in the same sprint.
- **Validation**:
  - Capture audit deltas by file and a small visual mismatch log for each page.

## Sprint 3: Audit Reduction and Duplicate Token Debt Paydown
**Goal**: Turn the remaining audit debt into an explicit burn-down instead of a frozen baseline.
**Demo/Validation**:
- The audit baseline decreases instead of staying flat, with a recorded before/after delta table by rule and by touched file.
- `duplicate-css-var-definition` drops below the current `78` issue baseline for the sprint close.
- `hardcoded-color` drops below the current `184` issue baseline for the sprint close, or any untouched carry-over is explicitly listed as deferred debt.
- Remaining issues are concentrated in deliberate exceptions rather than accidental spillover.

### Task 3.1: Burn Down Duplicate Variable Definitions in Shared and Page Layers
- **Location**: `/home/raistlin/hayalet-ev/src/styles/main.css`, `/home/raistlin/hayalet-ev/src/styles/archives.css`, `/home/raistlin/hayalet-ev/src/styles/design-system/themes/theme-classic-aliases.css`, `/home/raistlin/hayalet-ev/src/styles/assistant.css`, `/home/raistlin/hayalet-ev/src/styles/entrance/slot.css`
- **Description**: Resolve duplicate definitions where page files or shared files still redefine tokens already owned by the theme or design-system layers. Focus on `surface-card`, `app-shell`, and `ds-choice` families first.
- **Complexity**: 7
- **Dependencies**: Sprint 2
- **Acceptance Criteria**:
  - Duplicate definitions are either removed or documented as intentional override points.
  - Audit counts for `duplicate-css-var-definition` decrease from the current `78` baseline.
  - The sprint artifact includes a per-file delta table for every file touched by this task.
- **Validation**:
  - Compare audit output before and after the slice.
  - Re-run modularization and selector-contract regressions.

### Task 3.2: Burn Down Raw Color Hotspots by Ownership Bucket
- **Location**: `/home/raistlin/hayalet-ev/src/styles/archives.css`, `/home/raistlin/hayalet-ev/src/styles/analyze.css`, `/home/raistlin/hayalet-ev/src/styles/assistant.css`, `/home/raistlin/hayalet-ev/src/styles/server.css`, `/home/raistlin/hayalet-ev/src/styles/entrance/scene.css`
- **Description**: Address raw color debt in descending value order: first theme-breaking page overrides, then shared scene surfaces, then documented page-specific exceptions. Avoid a blanket cleanup that erases intended page identity.
- **Complexity**: 8
- **Dependencies**: Tasks 2.2, 3.1
- **Acceptance Criteria**:
  - The audit count for `hardcoded-color` drops from the current `184` baseline.
  - Hotspots that remain are traceable to intentional exceptions or unresolved later slices.
  - The sprint artifact includes a per-file delta table for every touched hotspot file.
- **Validation**:
  - Track per-file audit deltas.
  - Compare screenshots or visual sweeps for pages touched in the slice.

### Task 3.3: Tighten Audit Reporting Around Intentional Exceptions
- **Location**: `/home/raistlin/hayalet-ev/scripts/design-system-audit.mjs`, `/home/raistlin/hayalet-ev/scripts/baselines/design-system-audit-baseline.json`
- **Description**: Make the audit output distinguish between unowned violations and documented temporary exceptions so the baseline reflects meaningful debt rather than a flat noise floor.
- **Complexity**: 5
- **Dependencies**: Tasks 3.1, 3.2
- **Acceptance Criteria**:
  - The audit can explain which remaining issues are tolerated temporarily.
  - The baseline becomes a real burn-down metric rather than a snapshot of everything still noisy.
- **Validation**:
  - Run the audit with and without exception metadata and compare readability.

## Sprint 4: Manual Theme Sweep Evidence and Plan Closure
**Goal**: Convert the remaining visual/manual validation gap into repeatable evidence.
**Demo/Validation**:
- Theme and viewport sweeps produce recorded evidence rather than only narrative claims.
- The remaining-findings ledger can be marked complete with links to validation artifacts.
- Plan completion can be stated without overclaiming.

### Task 4.1: Add a Manual Verification Checklist for Classic Themes and Pages
- **Location**: `/home/raistlin/hayalet-ev/.rovo/`, `/home/raistlin/hayalet-ev/src/pages/`
- **Description**: Create a checklist covering `entrance`, `assistant`, `analyze`, `archives`, `whisper`, `server`, `rooms`, `settings`, and `opencode-ui` across `obsidian`, `ivory-lab`, and `ember-console`, plus key breakpoints and embedded/lazy-loaded pages.
- **Complexity**: 3
- **Dependencies**: Sprint 3
- **Acceptance Criteria**:
  - The verification checklist is explicit about pages, themes, breakpoints, and failure examples to watch for.
  - Archives and whisper lazy-loaded shell states are included as separate checklist rows from their standalone pages.
  - Shell-hosted and standalone verification are both required for `archives` and `whisper`.
- **Validation**:
  - Review the checklist against the known remaining findings and screenshot evidence.

### Task 4.2: Capture Theme Sweep Evidence
- **Location**: `/home/raistlin/hayalet-ev/logs/`, `/home/raistlin/hayalet-ev/.rovo/`, optional screenshot artifact directory under the repo
- **Description**: Run the manual theme/page sweep and save concise evidence: screenshots, notes, or a signed-off result table showing what passed and what still needs work.
- **Complexity**: 4
- **Dependencies**: Task 4.1
- **Acceptance Criteria**:
  - There is repo-visible evidence for the final theme/page verification.
  - Failures discovered during the sweep loop back into the ledger rather than staying implicit.
- **Validation**:
  - Confirm every classic page/theme combination has a recorded result.

### Task 4.3: Close the Remaining-Findings Ledger and Refresh the Follow-Up Plan Status
- **Location**: `/home/raistlin/hayalet-ev/.rovo/classic-theme-remaining-findings-plan.md`, `/home/raistlin/hayalet-ev/.rovo/`
- **Description**: Update the ledger and plan status so each finding is explicitly closed, deferred, or left open with reason. This prevents “done” claims from drifting ahead of evidence.
- **Complexity**: 2
- **Dependencies**: Task 4.2
- **Acceptance Criteria**:
  - The repo clearly shows which follow-up findings were fixed and how they were verified.
  - Any deferred work is listed as a new backlog item instead of silently disappearing.
- **Validation**:
  - Cross-check the final ledger against the latest audit, tests, build, and visual evidence.

## Testing Strategy
- Keep `scripts/tests/classic-css-entrypoint-regressions.test.ts` green for every CSS delivery change.
- Keep `scripts/tests/classic-css-selector-contract-regressions.test.ts` green before any selector cleanup.
- Keep `scripts/tests/theme-classic-modularization-regressions.test.ts` green for all token, primitive, and duplicate-surface changes.
- Run `npm run design:audit` before and after each sprint and compare counts by rule and by file.
- Re-run `npm run build` and `CHECK_DIST_RENDERER_CSS_GRAPH=1 npx tsx --test scripts/tests/classic-css-entrypoint-regressions.test.ts` whenever CSS entrypoints or lazy-delivery behavior changes.
- Run manual theme sweeps for `obsidian`, `ivory-lab`, and `ember-console`.
- Run manual viewport sweeps at least for `1440`, `1024`, `768`, `640`, and `480`.
- Specifically verify shell-hosted `archives` and `whisper` overlays after lazy CSS changes, including first open, close/reopen, and simulated failure retry behavior.

## Potential Risks & Gotchas
- Archives may still need some page-specific warmth; over-correcting it into fully generic surfaces could erase intentional hierarchy.
- Lazy stylesheet retry logic must not introduce duplicate imports or flicker on normal success paths.
- Contract renames can break tests and docs if helper field names change without coordinated updates.
- Audit burn-down can stall if exception handling is added without strict ownership rules; avoid turning the audit into a quiet allow-list.
- Manual theme sweep evidence is easy to under-specify; if screenshots or result tables are inconsistent, closure claims will remain weak.
- The repo already has unrelated worktree changes; execution of this plan must isolate classic-theme follow-up edits carefully.

## Rollback Plan
- Land retry-safety changes separately from Archives visual token refactors.
- Keep contract terminology and docs updates in a separate commit from behavior changes so ownership regressions are easy to undo.
- If Archives visual cleanup causes a design regression, restore page-local aliases first, then retry centralization with narrower semantic tokens.
- If audit tightening makes the baseline too noisy or too permissive, revert only the reporting-layer change and preserve the functional CSS cleanup.
- Preserve the remaining-findings ledger even if an implementation slice is rolled back; it remains the closure source of truth.
