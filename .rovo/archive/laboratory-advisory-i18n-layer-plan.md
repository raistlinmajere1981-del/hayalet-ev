# Plan: Laboratory Advisory i18n Layer

**Generated**: 2026-04-28  
**Estimated Complexity**: Medium

## Overview

Introduce a deterministic, selector-safe i18n layer for Laboratory advisory output by keeping meaning in the existing helper logic and applying language only inside formatter boundaries. The implementation will add key-based dictionaries for English and Turkish, a pure resolver with English fallback, and optional `locale?: "en" | "tr"` arguments only where advisory text is formatted.

The core rule is that priority, readiness, descriptor, bridge, coherence, posture, projection, and selector behavior stay language-independent. The new layer renders the same semantic advisory parts in different languages without storing locale in state, changing selector signatures, changing models, or altering execution flow.

## Scope Boundary

- In scope: the requested advisory formatter outputs for posture, descriptor, readiness, bridge, and coherence, plus candidate and alternatives wiring that passes locale into those formatter calls.
- Out of scope: existing non-advisory summary scaffolding such as candidate base summaries, comparison notes, adaptive decision hints, guided alternative hints, and stored counterfactual projection summaries. Those helpers currently produce English strings and should not be refactored unless the key inventory and task scope are expanded.
- Dynamic enum and id tokens such as `steady`, `low`, `strong`, `audio-analysis`, and `spectral-window` remain deterministic semantic tokens in this pass. They are not translated unless a future key set explicitly covers them.
- English default output should remain byte-for-byte unchanged for existing callers unless an exact-string assertion must change to route through a new formatter and that change is explicitly justified in the implementation notes.
- Add one implementation key beyond the initial list, `coherence.view`, so the coherence advisory header is resolved through the same key-based layer as descriptor, readiness, and bridge headers.

## Research Notes

- Advisory formatting is currently concentrated in:
  - `rooms/laboratory/runtime/lab-adaptive-decision.ts`
  - `rooms/laboratory/runtime/lab-execution-descriptor.ts`
  - `rooms/laboratory/runtime/lab-execution-readiness-signal.ts`
  - `rooms/laboratory/runtime/lab-execution-bridge.ts`
  - `rooms/laboratory/runtime/lab-decision-coherence.ts`
- Candidate and alternatives summaries compose advisory parts in:
  - `rooms/laboratory/runtime/lab-execution-candidate.ts`
  - `rooms/laboratory/runtime/lab-execution-alternatives.ts`
- Selector entry points currently call candidate and alternatives builders from `rooms/laboratory/runtime/lab-selectors.ts`; those calls must continue to work without a locale argument.
- The requested `formatDecisionPostureLabel` does not exist yet; the current internal equivalent is `getDecisionPostureLabel`, and posture prefixing happens through `prependDecisionPostureLabel`.
- Regression coverage lives in `scripts/tests/laboratory-execution-runtime-regressions.test.ts`, with re-exports in `scripts/tests/laboratory-runtime-truth.helpers.ts`.

## Prerequisites

- Keep this as a room source change under `rooms/laboratory`; do not manually edit installed copies under `data/rooms`.
- Use `LabI18nKey` and `LabI18nLocale` as runtime-local types, not model or persistence types.
- Run targeted tests with `npm run rooms:test:file -- scripts/tests/laboratory-execution-runtime-regressions.test.ts`.
- Run `npm run typecheck` after the implementation because formatter signatures and test helper exports will change.

## Sprint 1: Keyed Runtime i18n Foundation

**Goal**: Add a small, deterministic i18n module for Laboratory advisory phrases without touching advisory logic.

**Demo/Validation**:

- Import the resolver from a test or REPL and confirm known English and Turkish keys return distinct phrases.
- Confirm a missing Turkish dictionary entry falls back to the English value for the same key.

### Task 1.1: Add shared i18n types and resolver

- **Location**: `rooms/laboratory/runtime/lab-i18n.ts`
- **Description**: Define `LabI18nKey`, `LabI18nLocale`, and `resolveLabI18n(key, locale)`. Import language dictionaries, resolve from the requested locale first, and fall back to English if the locale dictionary lacks the key.
- **Complexity**: 3
- **Dependencies**: None
- **Acceptance Criteria**:
  - `LabI18nKey` contains the requested semantic keys plus `coherence.view` for the advisory header.
  - `resolveLabI18n` is pure, synchronous, deterministic, and has no global mutation.
  - Invalid or missing dictionary values never leak keys into output; English fallback is returned instead.
  - Fallback testing is supported through a pure resolver seam with partial test dictionaries, not by mutating exported production dictionaries.
- **Validation**:
  - Add direct resolver assertions in the regression test.
  - Run TypeScript diagnostics for the new file.

### Task 1.2: Add English dictionary

- **Location**: `rooms/laboratory/runtime/lab-i18n-en.ts`
- **Description**: Export `labI18nEn: Record<LabI18nKey, string>` with short, atomic English phrases for posture labels, advisory view labels, coherence phrases, and projection phrases.
- **Complexity**: 2
- **Dependencies**: Task 1.1
- **Acceptance Criteria**:
  - Dictionary has no full advisory sentences.
  - Dictionary contains no branching or business logic.
  - Existing English advisory meaning remains equivalent after formatter refactor.
- **Validation**:
  - Typecheck enforces full key coverage.

### Task 1.3: Add Turkish dictionary

- **Location**: `rooms/laboratory/runtime/lab-i18n-tr.ts`
- **Description**: Export `labI18nTr: Record<LabI18nKey, string>` with short, atomic Turkish phrases matching the same semantic keys.
- **Complexity**: 2
- **Dependencies**: Task 1.1
- **Acceptance Criteria**:
  - Turkish entries are concise semantic phrases, not duplicated English sentence structures.
  - Dictionary does not contain execution logic or conditions.
- **Validation**:
  - Typecheck enforces full key coverage.
  - Regression test confirms at least one advisory renders differently in Turkish.

## Sprint 2: Formatter Boundary Refactor

**Goal**: Move language rendering into formatter functions while preserving helper decisions and output structure.

**Demo/Validation**:

- Direct formatter calls with the same semantic input return English by default and Turkish when `locale: "tr"` is passed.
- Direct formatter calls with no locale still match the current English snapshots except where tests are intentionally updated around renamed formatter helpers.

### Task 2.1: Add posture label formatter

- **Location**: `rooms/laboratory/runtime/lab-adaptive-decision.ts`
- **Description**: Introduce exported `formatDecisionPostureLabel(posture, locale = "en")` using `resolveLabI18n`. Keep `buildDecisionPosture` behavior unchanged for existing default English output, and route posture prefix rendering through the formatter.
- **Complexity**: 4
- **Dependencies**: Sprint 1
- **Acceptance Criteria**:
  - `buildDecisionPosture` still returns the same default `posture` and English `shortLabel`.
  - `prependDecisionPostureLabel(summary, posture, locale = "en")` can render the prefix in English or Turkish.
  - Existing idempotency stripping handles default English prefixes and the localized prefix used for the current call.
- **Validation**:
  - Existing posture tests remain green.
  - Add locale assertions for posture prefix rendering.

### Task 2.2: Refactor descriptor advisory formatter

- **Location**: `rooms/laboratory/runtime/lab-execution-descriptor.ts`
- **Description**: Add `locale = "en"` to `formatExecutionDescriptorAdvisory` and resolve `descriptor.view` through `resolveLabI18n`. Keep descriptor style selection, tool, intent, and param shape logic unchanged.
- **Complexity**: 4
- **Dependencies**: Sprint 1
- **Acceptance Criteria**:
  - No descriptor mapping, action mapping, or param shape selection changes.
  - English default output keeps the same advisory meaning and single-sentence structure.
  - Turkish output is built by the formatter, not by moving logic into the dictionary.
- **Validation**:
  - Existing descriptor tests remain semantically equivalent.
  - Locale test verifies no `descriptor.view` key text leaks into rendered output.

### Task 2.3: Refactor readiness advisory formatter

- **Location**: `rooms/laboratory/runtime/lab-execution-readiness-signal.ts`
- **Description**: Add `locale = "en"` to `formatExecutionReadinessSignalAdvisory`, resolve `readiness.view` and projection phrase keys via `resolveLabI18n`, and keep readiness scoring and reason generation untouched.
- **Complexity**: 5
- **Dependencies**: Sprint 1
- **Acceptance Criteria**:
  - `buildExecutionReadinessSignal` stays language-independent.
  - Readiness projection alignment maps to the requested keys only at render time: improving to `projection.increase`, degrading to `projection.decrease`, and similar or none to `projection.stable`.
  - Existing English helper phrases such as alignment wording are handled at formatter level so Turkish output does not accidentally embed English prose.
  - Dynamic signal fields remain deterministic and keep the advisory single-sentence.
- **Validation**:
  - Existing readiness-level tests remain green.
  - Add deterministic same-locale output assertion.

### Task 2.4: Refactor bridge advisory formatter

- **Location**: `rooms/laboratory/runtime/lab-execution-bridge.ts`
- **Description**: Add `locale = "en"` to `formatExecutionBridgeAdvisory` and resolve `bridge.view` through `resolveLabI18n`. Keep bridge construction and summary derivation unchanged.
- **Complexity**: 3
- **Dependencies**: Sprint 1
- **Acceptance Criteria**:
  - `buildExecutionBridge` and `buildBridgeSummary` keep current structural behavior.
  - Formatter output remains one sentence.
  - Turkish formatter output does not reuse `bridge.summary`, because that field is an English structural summary; instead, the formatter renders from `adapter`, `operation`, `inputContract`, `outputContract`, and shape semantics.
  - No adapter, operation, input contract, or output contract logic changes.
- **Validation**:
  - Existing bridge tests remain green.
  - Locale test confirms bridge advisory differs by locale without changing bridge object fields.

### Task 2.5: Refactor coherence advisory formatter

- **Location**: `rooms/laboratory/runtime/lab-decision-coherence.ts`
- **Description**: Add `locale = "en"` to `formatDecisionCoherenceAdvisory`, resolve `coherence.*` semantic phrase keys through `resolveLabI18n`, and keep scoring, dominant axis, confidence, and state resolution unchanged.
- **Complexity**: 5
- **Dependencies**: Sprint 1
- **Acceptance Criteria**:
  - `buildDecisionCoherence` default summary remains English and semantically equivalent.
  - Direct formatter calls can render Turkish from the same `LabDecisionCoherence` object.
  - Axis hints remain formatter-level grammar, not dictionary logic.
- **Validation**:
  - Existing coherence snapshot expectations update only for intentional formatter wording if needed.
  - Add same-input different-locale and same-locale deterministic assertions.

## Sprint 3: Candidate and Alternatives Locale Wiring

**Goal**: Pass locale only at the summary formatting boundary for candidate and alternatives builders, while preserving selector signatures and runtime defaults.

**Demo/Validation**:

- Calling builder functions without locale returns existing English behavior.
- Calling builder functions with `locale: "tr"` changes rendered advisory text but not advisory count, ordering, status, confidence, alternatives, or structural fields.

### Task 3.1: Wire locale through execution candidate formatting

- **Location**: `rooms/laboratory/runtime/lab-execution-candidate.ts`
- **Description**: Add optional `locale?: "en" | "tr"` to candidate builder input types only where needed, default it to English, and pass it into descriptor, readiness, bridge, coherence, and posture formatter calls.
- **Complexity**: 5
- **Dependencies**: Sprint 2
- **Acceptance Criteria**:
  - No selector signature changes in `lab-selectors.ts`.
  - No locale field is added to persisted state, models, or output objects.
  - Candidate logic, status, confidence, notes, uncertainty, and ordering are unchanged.
- **Validation**:
  - Regression test compares English and Turkish candidate summaries from the same resolved input.
  - Assert advisory part ordering remains stable across locales.

### Task 3.2: Wire locale through execution alternatives formatting

- **Location**: `rooms/laboratory/runtime/lab-execution-alternatives.ts`
- **Description**: Add optional `locale?: "en" | "tr"` to alternatives builder input types only where needed, default it to English, and pass it into descriptor, readiness, bridge, coherence, and posture formatter calls.
- **Complexity**: 5
- **Dependencies**: Sprint 2
- **Acceptance Criteria**:
  - No selector signature changes in `lab-selectors.ts`.
  - No locale field is stored in alternatives output or shared models.
  - Alternative generation, preferred alternative selection, confidence, and comparison note logic are unchanged.
- **Validation**:
  - Regression test compares English and Turkish alternatives summaries from the same input.
  - Assert advisory count remains stable across locales.

### Task 3.3: Update test helper exports

- **Location**: `scripts/tests/laboratory-runtime-truth.helpers.ts`
- **Description**: Re-export the new i18n resolver, dictionaries if needed for fallback tests, and `formatDecisionPostureLabel`.
- **Complexity**: 2
- **Dependencies**: Sprint 1 and Sprint 2
- **Acceptance Criteria**:
  - Test helper remains the single import surface for the regression test.
  - No production code imports from test helpers.
- **Validation**:
  - The regression test compiles under `node --import tsx --test`.

## Sprint 4: Regression Coverage and Verification

**Goal**: Prove that language changes only rendered advisory text and does not affect ordering, counts, or logic.

**Demo/Validation**:

- Run the targeted Laboratory execution regression file.
- Run typecheck after targeted tests pass.

### Task 4.1: Add direct resolver and formatter tests

- **Location**: `scripts/tests/laboratory-execution-runtime-regressions.test.ts`
- **Description**: Add tests for direct resolver behavior, direct formatter localization, deterministic same-locale output, English fallback when a dictionary key is unavailable, and no key leakage.
- **Complexity**: 5
- **Dependencies**: Sprint 2 and Task 3.3
- **Acceptance Criteria**:
  - Same semantic input with `en` and `tr` yields different rendered strings.
  - Same semantic input with the same locale yields identical rendered strings across repeated calls.
  - Simulated missing key falls back to English through a pure partial-dictionary test seam.
  - Rendered output does not contain raw key strings such as `coherence.aligned`.
  - Existing English formatter outputs stay byte-for-byte unchanged for default calls.
- **Validation**:
  - `npm run rooms:test:file -- scripts/tests/laboratory-execution-runtime-regressions.test.ts`

### Task 4.2: Add candidate and alternatives ordering tests

- **Location**: `scripts/tests/laboratory-execution-runtime-regressions.test.ts`
- **Description**: Add tests that build candidate and alternatives summaries in English and Turkish from identical inputs, then compare advisory ordering and advisory count using locale-neutral markers or formatter-level part extraction.
- **Complexity**: 6
- **Dependencies**: Sprint 3
- **Acceptance Criteria**:
  - Candidate advisory count is unchanged across locales.
  - Alternatives advisory count is unchanged across locales.
  - Priority ordering remains unchanged for aligned, mixed, and conflicted coherence states.
  - The test does not depend on translated text to infer meaning.
  - Extraction helpers avoid English-only markers such as `Descriptor view:`.
- **Validation**:
  - Targeted regression test passes.

### Task 4.3: Update existing English snapshots carefully

- **Location**: `scripts/tests/laboratory-execution-runtime-regressions.test.ts`
- **Description**: Adjust existing exact-string expectations only where the formatter refactor intentionally changes route or wording. Prefer keeping English defaults byte-for-byte identical where practical.
- **Complexity**: 4
- **Dependencies**: Sprint 2
- **Acceptance Criteria**:
  - Existing English behavior remains the default.
  - Any exact-string update is traceable to formatter-only rendering.
  - No assertions are weakened around decision state, confidence, ordering, or selector behavior.
- **Validation**:
  - Targeted regression test passes.

### Task 4.4: Add selector default-stability assertions

- **Location**: `scripts/tests/laboratory-execution-runtime-regressions.test.ts`
- **Description**: Add or preserve assertions proving selectors still call candidate and alternatives builders without locale and return unchanged English summaries.
- **Complexity**: 4
- **Dependencies**: Sprint 3
- **Acceptance Criteria**:
  - `getActiveExecutionCandidate` and `getActiveExecutionAlternatives` require no locale argument.
  - Selector-derived default English summaries remain byte-for-byte stable for representative scenarios.
  - No locale value is introduced into store state or selector parameters.
- **Validation**:
  - Targeted regression test passes.

### Task 4.5: Run final checks

- **Location**: repository root
- **Description**: Run syntax/type/test checks after implementation.
- **Complexity**: 3
- **Dependencies**: All implementation tasks
- **Acceptance Criteria**:
  - `npm run rooms:test:file -- scripts/tests/laboratory-execution-runtime-regressions.test.ts` passes.
  - `npm run typecheck` passes.
  - No unexpected generated or installed-room files are modified.
- **Validation**:
  - Inspect `git diff --stat` and `git diff -- rooms/laboratory scripts/tests`.

## Testing Strategy

- Start with direct unit-style assertions for `resolveLabI18n` and each formatter because these are the intended boundaries.
- Add integration assertions through candidate and alternatives builders to ensure locale changes rendered advisory text only.
- Keep selector tests default-English only unless a selector already accepts an explicit formatting option; selectors must not learn about locale in this change.
- Use locale-neutral comparisons for ordering and count, such as known advisory part sequence before rendering or controlled summary parts passed through `reorderDecisionSummary`.
- Preserve exact English default snapshots to prove no behavior changed for current callers.

## Potential Risks & Gotchas

- `formatDecisionPostureLabel` is absent today. The implementation should add it as a formatter while keeping `buildDecisionPosture` default output compatible.
- `prependDecisionPostureLabel` strips existing English prefixes today. Localized idempotency needs care so rerenders do not accumulate Turkish or English prefixes.
- The requested key set is intentionally small. Do not expand dictionaries into full sentence templates just to make Turkish smoother; keep grammar in formatters and semantic atoms in dictionaries.
- Readiness and descriptor advisories include dynamic tokens such as `steady`, `guarded`, tool ids, intent ids, and shape ids. Treat those as deterministic semantic tokens unless the request is expanded later.
- `bridge.summary` and some readiness phrase helpers are currently English prose. Locale-aware formatter output should render from semantic fields or formatter-local grammar, not by reusing those English fragments in Turkish.
- Candidate and alternatives summaries also include non-advisory English fragments from existing helper outputs. Do not treat this pass as full summary localization unless those helpers are explicitly brought into scope.
- Fallback testing is awkward with `Record<LabI18nKey, string>` because TypeScript enforces complete dictionaries. Prefer a pure partial-dictionary resolver seam over mutating exported dictionaries during tests.
- Candidate and alternatives builder inputs can accept optional locale for testability, but selectors should continue to call them without locale. This keeps locale at the formatting boundary and avoids store propagation.
- Existing exact English snapshots may become brittle if sentence templates are rewritten too aggressively. Prefer minimal English changes.

## Rollback Plan

- Revert the three new i18n files.
- Revert formatter imports, optional locale parameters, and candidate/alternatives locale wiring.
- Revert regression-test additions and any exact-string expectation updates.
- Re-run the targeted Laboratory execution regression test to confirm the previous English-only advisory behavior is restored.
