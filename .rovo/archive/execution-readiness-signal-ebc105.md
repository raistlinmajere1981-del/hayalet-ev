# Execution Readiness Signal Plan

Add a passive, deterministic readiness signal helper that enriches candidate and alternatives summaries without changing models, selectors, store, dispatch, or persistence.

## Placement

- **New file:** `rooms/laboratory/runtime/lab-execution-readiness-signal.ts`
- **Reason:** `lab-execution-readiness.ts` already owns the concrete `LabExecutionReadiness` builder; the new helper is advisory and should stay separate.
- **Exports:** `buildExecutionReadinessSignal`, `formatExecutionReadinessSignalAdvisory`, and local/exported signal types.

## Signal design

- **Inputs:** `decisionPressure`, optional goal evaluation, optional result interpretation alignment, optional `alternativesConfidence`, optional counterfactual projection.
- **Derived factors:** outcome, pattern strength, alignment, confidence band, projection alignment/stability/coverage.
- **Output:** A lightweight `LabExecutionReadinessSignal` object kept out of store models, likely containing a stable level/category plus reason tokens for testing.
- **Determinism:** Use fixed thresholds and ordered branch rules only; no random wording and no time/state access.

## Summary integration

- **Candidate:** Build the signal after adaptive decision/guided alternative/projection logic, then append one readiness-signal advisory sentence into the existing summary chain.
- **Alternatives:** Build the same style of signal from alternatives context and append one advisory sentence alongside existing guidance/projection/descriptor suffixes.
- **Append-only:** Preserve existing summary text and only add the new advisory once, using idempotent append logic.
- **Wording:** Avoid execution verbs such as `execute`, `run`, `dispatch`, `commit`, `apply`, `activate`, `choose`, and `select` in the new advisory sentence.

## Constraints

- **No store changes**
- **No model fields**
- **No dispatch**
- **No persistence changes**
- **No selector imports**
- **No run-controller changes**

## Tests

- **Determinism:** Same input returns deep-equal signal and advisory.
- **Pressure mapping:** Low/medium/high pressure maps to stable readiness categories.
- **Projection alignment:** Projection fields influence signal deterministically without becoming action logic.
- **No leakage:** Candidate/alternatives outputs do not gain readiness-signal fields; persisted model interfaces remain untouched.
- **No execution wording:** New advisory fragments exclude execution/action-trigger verbs.
- **Integration:** Candidate and alternatives summaries receive exactly one appended advisory sentence.

## Validation

- `npm run rooms:test:file -- scripts/tests/laboratory-execution-runtime-regressions.test.ts`
- `npm run typecheck`
