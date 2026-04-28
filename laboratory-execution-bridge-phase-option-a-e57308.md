# Laboratory Execution Bridge Phase — Option A

Introduce a passive deterministic execution-description bridge by separating the existing payload-preview bridge from the new adapter/operation contract layer.

## Context

- `rooms/laboratory/runtime/lab-execution-bridge.ts` already contains the payload-preview builder.
- The selected direction is to move that existing payload-preview code into a dedicated file, then reserve `lab-execution-bridge.ts` for the new passive execution bridge contract.
- Existing passive layers already append descriptor/readiness advisory text to candidate and alternatives summaries without adding model fields.
- Sub-agent review confirmed this phase must stay distinct from the earlier F1 mock-dispatch/runtime bridge: it describes contracts only and must not touch dispatcher, store runtime, reducers, UI, or persistence.

## Implementation Plan

1. **Split payload-preview bridge**
   - Create `rooms/laboratory/runtime/lab-execution-payload-preview.ts` from the current payload-preview implementation.
   - Update current call sites/imports to use the new payload-preview module, especially `lab-selectors.ts` and `laboratory-runtime-truth.helpers.ts`.
   - Preserve existing payload-preview behavior and exports.

2. **Create passive execution bridge contract**
   - Rework `rooms/laboratory/runtime/lab-execution-bridge.ts` to export `LabExecutionBridge`, `buildExecutionBridge`, and `formatExecutionBridgeAdvisory`.
   - Import only the descriptor type from `lab-execution-descriptor.ts`.
   - Keep it pure: no async, no selectors, no runtime/tool/environment access.

3. **Apply deterministic mappings**
   - Map descriptor tool to a single adapter using Option A mappings.
   - Map known intents to a single abstract operation.
   - Derive `inputContract` only from `descriptor.paramShape.fields` and `descriptor.paramShape.type`.
   - Map `outputContract` from tool/intent with deterministic generic handling for descriptor values outside the explicit Option A list, including current `visual-analysis`, `motion-analysis`, and non-listed intent values.

4. **Append advisory summaries**
   - Candidate: build descriptor, build bridge, append one `Execution bridge:` advisory after existing descriptor/readiness advisory flow.
   - Alternatives: use guided preferred alternative when present, otherwise the selected fallback alternative already used for descriptor advisory; append only one bridge advisory.
   - Do not add bridge fields to store, models, persistence, reducers, UI, or runtime execution.

5. **Extend regression coverage**
   - Add exports to `scripts/tests/laboratory-runtime-truth.helpers.ts` for the new bridge helpers.
   - Extend `scripts/tests/laboratory-execution-runtime-regressions.test.ts` for determinism, adapter/operation mapping, param-shape isolation, no persistence/model leakage, no forbidden execution wording scoped to `Execution bridge:` advisory text, and append-only summary behavior.

## Review Findings Applied

- The forbidden-word regex must target bridge advisory text only, because existing base summaries already include the word `execution`.
- The alternatives bridge advisory should use the same single alternative selected for descriptor advisory: guided preferred alternative when present, otherwise the first fallback alternative.
- The new bridge helper may have deterministic generic fallbacks, but must not introduce fallback adapter lists or dynamic selection.
- Existing payload-preview tests should keep passing after the import split.

## Validation

- Run the focused Laboratory regression test file.
- Run TypeScript typecheck.

## Expected Code Files

- `rooms/laboratory/runtime/lab-execution-bridge.ts`
- `rooms/laboratory/runtime/lab-execution-payload-preview.ts`
- `rooms/laboratory/runtime/lab-selectors.ts`
- `rooms/laboratory/runtime/lab-execution-candidate.ts`
- `rooms/laboratory/runtime/lab-execution-alternatives.ts`
- `scripts/tests/laboratory-runtime-truth.helpers.ts`
- `scripts/tests/laboratory-execution-runtime-regressions.test.ts`
