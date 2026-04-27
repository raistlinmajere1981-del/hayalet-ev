# Laboratory Counterfactual Outcome Projection Report

## Objective
This phase introduced deterministic counterfactual outcome projection for guided alternatives in Laboratory.

The goal was to let the system estimate how the currently preferred alternative is expected to affect:
- coverage
- alignment
- stability

The implementation had to remain:
- selector-driven
- completed-result gated
- deterministic
- additive
- free of store, event, persistence, and execution-flow changes

## Implemented Scope

### 1. Pure projection helper
File:
- `rooms/laboratory/runtime/lab-adaptive-decision.ts`

Added:
- `LabCounterfactualProjection`
- `buildCounterfactualProjection(alternative, context)`

The helper derives:
- `expectedCoverage: "increase" | "decrease" | "stable"`
- `expectedAlignment: "better" | "worse" | "similar"`
- `expectedStability: "higher" | "lower" | "similar"`
- `summary: string`

Inputs remain local and deterministic:
- active execution result
- goal evaluation
- pattern strength
- interpretation
- optional decision pressure

No selector imports were added to the helper, so the existing runtime layering stayed intact.

### 2. Completed-only selector threading
Files:
- `rooms/laboratory/runtime/lab-selectors.ts`
- `rooms/laboratory/runtime/lab-execution-alternatives.ts`
- `rooms/laboratory/runtime/lab-execution-candidate.ts`

`executionResult` is now threaded only through:
- `getActiveExecutionAlternatives(state)`
- `getActiveExecutionCandidate(state)`

It is not threaded through:
- `getBaseActiveExecutionAlternatives`
- `getBaseActiveExecutionCandidate`

This preserves the existing pre-execution surfaces and ensures projection stays disabled unless a completed execution result is actively valid.

### 3. Alternatives integration
File:
- `rooms/laboratory/runtime/lab-execution-alternatives.ts`

Behavior:
- resolve the preferred alternative by `preferredAlternativeIndex`
- build a counterfactual projection only when:
  - a preferred alternative exists
  - a completed execution result exists
- append the projection summary to the alternatives summary

Non-goals preserved:
- alternatives array order unchanged
- alternatives item content unchanged
- comparison note structure unchanged
- no auto-selection behavior added

### 4. Candidate integration
File:
- `rooms/laboratory/runtime/lab-execution-candidate.ts`

Behavior:
- resolve the preferred alternative by `preferredAlternativeIndex`
- build the same projection helper output
- append projection summary only under `decisionPressure === "high"`

Unchanged:
- candidate status rules
- structural integrity
- confidence algorithm shape
- execution flow
- commitment behavior

## Deterministic Logic Summary

### Coverage projection
Coverage projection uses the current result coverage plus the alternative advantage:
- `higher-coverage` tends toward `increase`
- `higher-precision` can yield `decrease`
- `more-stable` and `lower-risk` stay conservative and can stabilize weak low-coverage outcomes

### Alignment projection
Alignment projection is biased by interpretation:
- `deviates` pushes projection toward `better`
- `partial` improves safer routes and can penalize fragile ones
- stable matched outcomes remain mostly `similar`

### Stability projection
Stability projection is biased by alternative type:
- `more-stable` and `lower-risk` favor `higher`
- `higher-precision` may reduce stability under fragile contexts
- `higher-coverage` can improve stability under high-pressure or failed outcomes

### Pressure and pattern influence
Additional deterministic bias is applied when:
- decision pressure is high
- goal outcome is failed
- pattern strength is weak
- alignment deviates

This keeps projection consistent with the existing adaptive and guided-alternative layers.

## Guardrail Compliance

Confirmed preserved:
- no new store fields
- no reducer changes
- no new dispatch events
- no async additions
- no execution dispatcher changes
- no `lab-run-controller.ts` changes
- no persistence or hydrate drift
- no UI redesign
- no automatic commitment, switching, or execution

## Test Coverage Added
Files:
- `scripts/tests/laboratory-runtime-truth.helpers.ts`
- `scripts/tests/laboratory-execution-runtime-regressions.test.ts`
- `scripts/tests/laboratory-suggestion-runtime-regressions.test.ts`

Added coverage for:
- pure projection determinism
- missing-result neutral projection behavior
- high-pressure failed-goal projection behavior
- neutral completed-result projection behavior
- completed-only projection gating
- running-state leakage prevention
- pre-execution avoid-copy guard
- candidate high-pressure echo behavior
- alternatives summary projection append
- persistence negative assertions for:
  - `counterfactualProjection`
  - `expectedCoverage`
  - `expectedAlignment`
  - `expectedStability`

## Verification Run

Passed:
- `npm run rooms:test:file -- scripts/tests/laboratory-execution-runtime-regressions.test.ts scripts/tests/laboratory-suggestion-runtime-regressions.test.ts`
- `npm run rooms:test:file -- scripts/tests/laboratory-source-ui-regressions.test.ts scripts/tests/laboratory-ui-evaluation-regressions.test.ts`
- `npm run typecheck`
- `npm run lint`
- `git diff --check`

Syntax checks passed for all modified runtime and test files.

## Review Closure

Sub-agent review was rerun until the implementation and regression suite matched the plan.

Closed findings:
- `buildCounterfactualProjection` now returns a neutral empty projection when no completed execution result exists or when the context is too low-signal.
- pre-execution `avoid` alternatives no longer use explicit `counterfactual` wording in their base summary.
- persistence regressions now explicitly assert that `counterfactualProjection` itself does not leak, in addition to the tuple fields.

Final sub-agent review reported no remaining actionable findings in the scoped runtime and test files.

## Files Changed
- `rooms/laboratory/runtime/lab-adaptive-decision.ts`
- `rooms/laboratory/runtime/lab-execution-alternatives.ts`
- `rooms/laboratory/runtime/lab-execution-candidate.ts`
- `rooms/laboratory/runtime/lab-selectors.ts`
- `scripts/tests/laboratory-runtime-truth.helpers.ts`
- `scripts/tests/laboratory-execution-runtime-regressions.test.ts`
- `scripts/tests/laboratory-suggestion-runtime-regressions.test.ts`

Planning artifact:
- `laboratory-counterfactual-outcome-projection-plan.md`

Closure report:
- `laboratory-counterfactual-outcome-projection-report.md`

## Final Notes
- The implementation stayed within the intended Laboratory runtime/test surface.
- Projection is intentionally advisory text only.
- Final sub-agent review completed successfully after the follow-up fixes and found no remaining actionable issues.
- Unrelated dirty files remained outside this phase:
  - `AGENTS.md`
  - `config/rooms.json`
