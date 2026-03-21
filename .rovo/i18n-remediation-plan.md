# Plan: Rovo i18n Remediation

**Generated**: 2026-03-21
**Estimated Complexity**: High

## Overview
This plan addresses all previously identified i18n issues outside `ghost-agent`: broken key resolution, hardcoded user-facing strings, standalone room strings, stale or unused catalog entries, and noisy or outdated regression tests.

The implementation should prioritize user-visible runtime correctness first, then catalog hygiene, then test repair. The safest default is to prefer targeted key fixes over broad resolver behavior changes unless a repeated pattern proves a shared abstraction is justified.

## Assumptions
- Scope excludes every file under `ghost-agent/`.
- The existing built-in locale contract in `shared/languages/{tr,en}/index.json` remains the source of truth.
- Renderer shell pages may use `data-shell-i18n-*`, but fixes should avoid widening `shell` namespace behavior unless the same problem appears in multiple pages.
- Standalone room UIs may use a lightweight local i18n helper instead of full `AppI18n` integration if that keeps the room bundle simpler.

## Prerequisites
- Confirm the final fix scope is limited to `src/`, `electron/`, `shared/`, `rooms/`, and `scripts/tests/`.
- Keep a before/after diff of both language catalogs to avoid accidental bulk churn.
- Use targeted test runs rather than broad project test sweeps while the suite contains known stale expectations.
- Prefer parser-based or DOM-aware test logic over regex-only HTML inspection where attribute names overlap with translation data attributes.

## Sprint 1: Runtime-Critical Fixes
**Goal**: Remove user-visible missing-key and hardcoded-string issues from active UI surfaces.
**Demo/Validation**:
- Whisper trigger button and Whisper page title render correctly in both `tr` and `en`.
- Scene containers expose localized `aria-label` values instead of hardcoded English.
- The legacy sample room renders without hardcoded Turkish-only strings.

### Task 1.1: Fix Whisper panel key resolution
- **Location**: `src/index.html`, `src/pages/whisper.html`, optionally `src/js/app/shell-i18n.ts`
- **Description**: Replace relative `panels.whisper` shell keys with an explicitly valid namespace path such as `entrance.panels.whisper`, or only if repeated evidence warrants it, adjust shell key resolution rules in a backward-safe way.
- **Complexity**: 3
- **Dependencies**: None
- **Acceptance Criteria**:
  - Whisper topbar button title/aria-label resolves without falling back to `app.common.translationMissing`.
  - Whisper page heading resolves through an existing catalog key in both locales.
  - No unrelated `data-shell-i18n-*` behavior changes.
- **Validation**:
  - Grep for remaining `data-shell-i18n-*="panels.whisper"` occurrences.
  - Run targeted i18n regression tests for shell pages.

### Task 1.2: Localize scene container accessibility labels
- **Location**: `src/pages/entrance.html`, `src/pages/analyze.html`, `src/pages/assistant.html`, `src/pages/server.html`, `src/pages/rooms.html`, `shared/languages/tr/index.json`, `shared/languages/en/index.json`
- **Description**: Add explicit translation keys for scene `aria-label` values and replace hardcoded `"Entrance scene"`, `"Analyze scene"`, `"Assistant scene"`, `"Server scene"`, and `"Rooms scene"` literals with i18n-backed attributes.
- **Complexity**: 4
- **Dependencies**: None
- **Acceptance Criteria**:
  - No active page template ships hardcoded scene `aria-label` text.
  - New keys are present in both built-in catalogs with natural wording in each locale.
  - The chosen namespace matches page ownership and does not duplicate near-identical keys unnecessarily.
- **Validation**:
  - HTML-level grep shows no literal `aria-label="... scene"` values in the affected pages.
  - A regression test asserts the new keys exist and the templates reference them.

### Task 1.3: Add a minimal i18n layer for the legacy sample room
- **Location**: room runtime UI/host files for the sample room surface
- **Description**: First define the room locale source of truth, preferring the app-selected language if the room host/runtime can already pass it through. Then replace hardcoded room title, hero copy, board labels, note text, and control labels with a small room-local translation helper keyed by `tr`/`en`. Fall back to a documented browser-locale strategy only if room/runtime locale sync does not exist and is intentionally out of scope.
- **Complexity**: 6
- **Dependencies**: None
- **Acceptance Criteria**:
- The sample room no longer hardcodes visible Turkish-only content.
  - The room title and main UI labels switch based on an explicit, documented locale source.
  - The chosen locale source does not silently diverge from app language without that limitation being documented.
  - Room runtime behavior is unchanged aside from displayed text.
- **Validation**:
  - Grep for previous hardcoded XOX literals returns zero matches.
  - Open the room bundle or room host path and verify visible text renders in the expected language source.
  - If room locale is host-driven, verify at least one app-language change or fresh load path propagates correctly.

### Task 1.4: Add runtime regressions for the fixed surfaces
- **Location**: `scripts/tests/i18n-ui-regressions.test.ts`, optionally a new room-specific test under `scripts/tests/`
- **Description**: Add explicit coverage for Whisper key resolution, scene `aria-label` localization, and sample-room text ownership so the same issues cannot silently regress.
- **Complexity**: 4
- **Dependencies**: Tasks 1.1-1.3
- **Acceptance Criteria**:
  - The new tests fail on the pre-fix state and pass after implementation.
  - Assertions distinguish real hardcoded strings from icon-only or symbolic content.
- **Validation**:
  - Run only the updated i18n-related tests and confirm they pass without allowlist hacks.

## Sprint 2: Catalog Hygiene And Translation Quality
**Goal**: Clean up incorrect, stale, or untranslated catalog values without breaking external language pack compatibility.
**Demo/Validation**:
- Genuine Turkish untranslated strings are fixed.
- Known stale keys are either removed safely or reattached to real usage.
- Catalog diffs are intentional and easy to review.

### Task 2.1: Curate the EN/TR identical-value audit list
- **Location**: `shared/languages/tr/index.json`, `shared/languages/en/index.json`, optional helper script under `scripts/`
- **Description**: Build a reviewed shortlist of identical EN/TR values and classify each as one of: acceptable technical token, brand/proper noun, command syntax, or genuine translation miss.
- **Complexity**: 4
- **Dependencies**: None
- **Acceptance Criteria**:
  - The shortlist excludes legitimate shared values such as brand names, protocol tokens, and literal commands.
  - Each remaining entry has a clear decision: translate, keep, or move to allowlist documentation.
- **Validation**:
  - Produce a deterministic shortlist from the catalogs and spot-check representative entries.

### Task 2.2: Translate genuine Turkish misses
- **Location**: `shared/languages/tr/index.json`
- **Description**: Replace clearly user-facing English leftovers such as `Memory Viewer`, `Auth code`, `Remote user handshake`, `Clear`, and `OpenCode Serve` only where they are intended for Turkish UI, while preserving deliberate technical tokens.
- **Complexity**: 5
- **Dependencies**: Task 2.1
- **Acceptance Criteria**:
  - All approved Turkish misses are translated naturally and consistently.
  - No brand, command, or technical token is mistranslated.
  - EN catalog remains unchanged unless a wording correction is separately justified.
- **Validation**:
  - Review a focused TR catalog diff.
  - Manually inspect the affected screens in Turkish.

### Task 2.3: Resolve stale or unused keys
- **Location**: `shared/languages/tr/index.json`, `shared/languages/en/index.json`, `src/js/app/index.ts`, `src/pages/settings.html`, `src/js/pages/settings/accounts/user-panel.ts`, affected tests
- **Description**: Confirm whether keys such as `app.startup.loadingSettings` and `entrance.user.language.restartHint` are intentionally dormant, should be restored to UI, or should be removed from the built-in catalogs and tests.
- **Complexity**: 3
- **Dependencies**: Task 2.1
- **Acceptance Criteria**:
  - Each targeted stale key has a documented decision.
  - If removed, no code or test still references it.
  - If restored, the UI placement is explicit and validated.
- **Validation**:
  - Grep for every candidate key before and after the change.
  - Run the tests that referenced the stale keys.

### Task 2.4: Add a translation-quality guardrail
- **Location**: `scripts/tests/i18n-ui-regressions.test.ts` or a new dedicated audit test/script, plus a small reviewed allowlist artifact such as `scripts/tests/fixtures/i18n-identical-allowlist.json`
- **Description**: Add a curated regression that flags suspicious identical EN/TR user-facing values while allowing a reviewed allowlist of accepted technical terms, brand names, and command literals. Seed the allowlist from the classified shortlist produced in Task 2.1 so the test and the audit source stay aligned.
- **Complexity**: 6
- **Dependencies**: Tasks 2.1-2.3
- **Acceptance Criteria**:
  - The guardrail catches obvious untranslated Turkish UI strings.
  - The allowlist has a single reviewable source and every entry has a brief rationale.
  - The test output is actionable rather than noisy.
- **Validation**:
  - Diff the generated shortlist against the committed allowlist and confirm every surviving identical-value entry is intentionally classified.
  - Seed the test with at least one deliberately bad identical value and confirm it fails.

## Sprint 3: Repair And Harden The Regression Suite
**Goal**: Make the existing i18n regressions trustworthy by removing false positives and updating stale assumptions.
**Demo/Validation**:
- Targeted i18n regression suites fail only on real issues.
- Settings-language and bootstrap tests reflect the current app structure.

### Task 3.1: Replace regex-only HTML fallback detection
- **Location**: `scripts/tests/i18n-ui-regressions.test.ts`
- **Description**: Rework `findHtmlAttributeFallbacks` so it parses target attributes precisely and does not mistake `data-i18n-placeholder`, `data-i18n-title`, or similar attribute names for actual fallback `placeholder`/`title` values.
- **Complexity**: 5
- **Dependencies**: None
- **Acceptance Criteria**:
  - `settings.html` no longer produces false positives just because a translation data attribute contains the target attribute name.
  - The test still catches real fallback literals when they are present.
- **Validation**:
  - Add fixture-like assertions or a focused unit-style case within the test file.
  - Re-run the hardcoded-string regression test alone.

### Task 3.2: Update stale settings-language path and markup expectations
- **Location**: `scripts/tests/provider-test-settings-language-regressions.test.ts`, `src/pages/settings.html`, `src/js/pages/settings/accounts/user-panel.ts`
- **Description**: Point the test at the current settings page and current user-panel implementation instead of the old entrance page structure. Decide whether the removed `app-language-restart-hint` should be restored or the expectation should be retired.
- **Complexity**: 4
- **Dependencies**: Task 2.3
- **Acceptance Criteria**:
  - The test references the actual file that owns the language selector.
  - Assertions match the current DOM and persistence path for `general.language`.
  - No stale reference remains to `src/js/pages/entrance/user-panel.ts`.
- **Validation**:
  - Run the provider settings regression file after updating it.

### Task 3.3: Update startup-language bootstrap expectations
- **Location**: `scripts/tests/provider-ui-language-strategy-regressions.test.ts`, `src/js/app/index.ts`
- **Description**: Replace the obsolete assertion for `AppI18n.t("app.startup.loadingSettings")` with a check that matches the current startup contract, such as `SettingsManager.load()` preceding `AppI18n.bootstrap(SettingsManager)`, or restore a translated startup status only if product behavior requires it.
- **Complexity**: 3
- **Dependencies**: Task 2.3
- **Acceptance Criteria**:
  - The test reflects current startup behavior rather than removed copy.
  - The chosen assertion protects a meaningful i18n bootstrap guarantee.
- **Validation**:
  - Run the provider language strategy regression file after the change.

### Task 3.4: Add a key-resolution regression for shell-relative namespaces
- **Location**: `scripts/tests/i18n-ui-regressions.test.ts`, optionally `src/js/app/shell-i18n.ts`
- **Description**: Encode the rule that `data-shell-i18n-*` relative keys must either resolve under `shell.*` or be fully qualified. This prevents another `panels.whisper` mismatch from slipping in.
- **Complexity**: 4
- **Dependencies**: Task 1.1
- **Acceptance Criteria**:
  - The test fails if a shell-relative key resolves to a missing namespace while an obvious fully qualified key exists elsewhere.
  - The message points directly to the template and missing resolved key.
- **Validation**:
  - Add a narrow failing case first, then confirm it passes after the fix.

## Sprint 4: Final Verification And Cleanup
**Goal**: Verify the end-to-end result and keep the change set easy to review and rollback.
**Demo/Validation**:
- All targeted i18n fixes are covered by code search, tests, and manual smoke checks.
- The final diff is categorized by runtime fix, catalog fix, and test fix.

### Task 4.1: Run the targeted i18n validation suite
- **Location**: `scripts/tests/i18n-ui-regressions.test.ts`, `scripts/tests/i18n-language-loader-regressions.test.ts`, `scripts/tests/opencode-ui-language-sync-regressions.test.ts`, `scripts/tests/provider-ui-language-strategy-regressions.test.ts`, `scripts/tests/provider-test-settings-language-regressions.test.ts`
- **Description**: Run the focused regression set after the fixes land. If the environment still blocks the preferred runner, record the exact limitation and validate with the nearest equivalent project command.
- **Complexity**: 2
- **Dependencies**: Sprints 1-3
- **Acceptance Criteria**:
  - Targeted tests pass or any environment limitation is explicitly documented.
  - Remaining failures, if any, map to known out-of-scope issues rather than this remediation.
- **Validation**:
  - Execute the focused test set and capture pass/fail summary.

### Task 4.2: Perform manual locale smoke checks
- **Location**: Renderer pages and room surfaces touched by the fix
- **Description**: Manually verify the affected pages in both Turkish and English: Whisper button/title, settings language selector area, scene containers, and the sample room surface.
- **Complexity**: 3
- **Dependencies**: Sprints 1-3
- **Acceptance Criteria**:
  - No visible `Translation unavailable` fallback appears in the touched surfaces.
  - Turkish UI no longer shows the approved-miss English strings.
  - Accessibility labels reflect the selected locale where expected.
- **Validation**:
  - Flip language between `tr` and `en` and verify the touched UI.

### Task 4.3: Review catalog and test diff for maintainability
- **Location**: `shared/languages/`, `scripts/tests/`, touched UI files
- **Description**: Do a final review to ensure the patch did not introduce bulk copy churn, duplicate keys, or test logic that is too brittle.
- **Complexity**: 2
- **Dependencies**: Tasks 4.1-4.2
- **Acceptance Criteria**:
  - Catalog diff stays focused on intended keys.
  - Test changes improve signal quality rather than only muting failures.
  - No new duplicate translation keys are introduced.
- **Validation**:
  - Inspect the final git diff grouped by file area.

## Testing Strategy
- Start with narrow regression tests closest to each fix instead of rerunning the entire project suite after every change.
- Prefer deterministic checks:
  - exact key existence checks in both catalogs
  - HTML/template key reference checks
  - grep-based confirmation for removed hardcoded strings
  - parser-based attribute fallback detection
- After catalog edits, compare EN/TR diffs side by side to catch accidental formatting or unrelated key churn.
- Keep one manual smoke pass in both `tr` and `en` before closing the work.

## Potential Risks & Gotchas
- Changing `resolveShellKey` globally could break existing shell-relative keys that currently depend on `shell.*` defaulting. Favor explicit template fixes unless repeated evidence justifies a shared resolver change.
- Many identical EN/TR values are legitimate technical terms, brand names, command syntax, or placeholders. Do not bulk-translate by script without a reviewed allowlist.
- Restoring `restartHint` or `loadingSettings` just to satisfy stale tests would reintroduce dead UI copy. Update product behavior only if the UX still needs those messages.
- The sample room may not share the main renderer i18n bootstrap. Pulling in `AppI18n` could create unnecessary coupling or bundle complexity.
- If the sample room cannot receive app language from its host/runtime, a browser-locale fallback may hide a real cross-surface inconsistency. Decide that tradeoff explicitly before implementation starts.
- The current sandbox previously showed `tsx` IPC/pipe permission issues in some invocation styles. Validation commands may need to avoid redirected output or use an alternate runner path.
- Test hardening should not overfit the current markup structure. Prefer assertions about translation ownership and resolved keys rather than fragile exact HTML ordering.
- The identical-value guardrail will become noise unless its allowlist is versioned, reviewed, and updated from the same shortlist process used in catalog cleanup.

## Rollback Plan
- Revert by sprint if needed:
  - Sprint 1 rollback: restore previous template attributes and room copy.
  - Sprint 2 rollback: revert only catalog changes, keeping runtime fixes intact if they already rely on the new keys.
  - Sprint 3 rollback: restore prior test files only if the new regressions prove too strict.
- If a catalog cleanup breaks runtime unexpectedly, restore the removed keys first, then re-audit references before attempting deletion again.
- Keep runtime fixes and test fixes in separate commits where possible so catalog or test churn can be reverted independently.
