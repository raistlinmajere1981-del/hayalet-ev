# Laboratory Decision Coherence Plan

Add a pure advisory-only coherence helper that deterministically compresses decision posture, readiness, and projection signals into one summary sentence appended to candidate and alternatives summaries.

## Scope

- **New helper**: `rooms/laboratory/runtime/lab-decision-coherence.ts`
- **Runtime integration**:
  - `rooms/laboratory/runtime/lab-execution-candidate.ts`
  - `rooms/laboratory/runtime/lab-execution-alternatives.ts`
- **Regression coverage**: `scripts/tests/laboratory-execution-runtime-regressions.test.ts`
- **Helper test exports**: `scripts/tests/laboratory-runtime-truth.helpers.ts`

## Helper Design

- **Types**: export `LabDecisionCoherence` exactly as requested.
- **Input**: optional `posture`, `readiness`, and `projection` fields.
- **Missing signals**: treat missing signals as neutral polarity (`0`).
- **State rules**:
  - `totalScore >= 2` -> `aligned`
  - `-1 <= totalScore <= 1` -> `mixed`
  - `totalScore <= -2` -> `conflicted`
- **Dominant axis**:
  - coverage increase -> `exploration`
  - otherwise strained readiness -> `safety`
  - otherwise `neutral`
- **Confidence**: `Math.min(1, Math.abs(totalScore) / 3)`.
- **Summary**: `coherence.summary` will mirror `formatDecisionCoherenceAdvisory(coherence)`.
- **Formatter construction**: compute state/axis/confidence first, format a temporary coherence object, then return the final object with `summary` set to that advisory.

## Integration Approach

- **Candidate**: build coherence after existing `decisionPosture`, local readiness signal object, and optional counterfactual projection are available; append exactly one `Coherence view:` advisory after descriptor/readiness/bridge advisories.
- **Alternatives**: reuse the same existing posture/readiness/projection signals used for summaries; keep the local readiness signal object available for both readiness advisory formatting and coherence input; include coherence at the end of the suffix list as an append-only advisory.
- **Ordering**: preserve existing advisory order and append coherence last before any outer posture prefix.
- **No model/store changes**: do not add `coherence`, `dominantAxis`, `state`, or related fields to candidate/alternatives objects.
- **No selector imports**: helper remains pure and runtime-selector-free.

## Test Plan

- **Pure helper tests**:
  - deterministic same input -> same output
  - aligned, mixed, conflicted scenarios
  - confidence calculation correctness
  - neutral behavior for missing optional signals
  - formatter output and `summary` equality
  - advisory text avoids forbidden execution wording
- **Integration tests**:
  - candidate and alternatives summaries contain exactly one `Coherence view:` sentence
  - summary append-only ordering preserves existing text
  - no new coherence fields such as `coherence`, `dominantAxis`, `coherenceState`, or `coherenceConfidence` leak into candidate/alternatives objects
  - no forbidden execution wording in extracted coherence advisory only

## Validation

- Run targeted regression test:
  - `npm run rooms:test:file -- scripts/tests/laboratory-execution-runtime-regressions.test.ts`
- Run typecheck:
  - `npm run typecheck`
