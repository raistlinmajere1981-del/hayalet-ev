# Passive Execution Bridge Plan

Implement a passive, deterministic execution descriptor layer that enriches candidate and alternatives summaries without changing store models, dispatch flow, persistence, or run-controller behavior.

## Scope

- **New helper:** Add `rooms/laboratory/runtime/lab-execution-descriptor.ts`.
- **Runtime integration:** Update only summary-building logic in `lab-execution-candidate.ts` and `lab-execution-alternatives.ts`.
- **Tests:** Extend `scripts/tests/laboratory-execution-runtime-regressions.test.ts` and helper exports as needed.

## Descriptor design

- **Shape:** Descriptor contains `tool`, `intent`, and `paramShape` only.
- **Tool mapping:** Use deterministic conceptual process classes derived from action mapping, not real tools (`audio-analysis`, `media-segmentation`, `signal-inspection`, etc.).
- **Intent mapping:** Keep `intent` behavior-oriented and distinct from `tool`, describing what the descriptor explains.
- **Param shape:** Helper returns a lightweight object with a bucket `type` and passive field names; summaries render only the bucket label.
- **Payload role:** Use `executionPayloadPreview` only to choose/confirm a passive bucket.
- **Plan role:** Use `executionPlan` only for optional sanity checks, never as an execution source.
- **No side effects:** No store updates, no dispatch, no async/tool calls, no persistence/schema changes.

## Integration approach

- **Candidate summary:** Append one advisory-only passive descriptor sentence to the existing candidate summary pipeline.
- **Alternatives summary:** Append advisory-only passive descriptor text for the guided preferred alternative; if no guided alternative exists, use the first alternative only.
- **No model fields:** Do not add `descriptor`, `tool`, `paramShape`, or related fields to `LabExecutionCandidate`, `LabExecutionAlternatives`, or persisted state models.
- **Immutability:** Build new strings and descriptor objects from inputs without mutating plans, payload previews, candidates, alternatives, or arrays.

## Advisory wording guardrails

- **Allowed tone:** Use comparison/descriptor language such as “Descriptor view”, “aligns with”, “describes”, and “passive shape”.
- **Avoid execution verbs:** Keep new advisory text free of verbs such as `execute`, `run`, `dispatch`, `commit`, `apply`, `activate`, `choose`, `select`, and similar action-trigger wording.
- **Deterministic variation:** Use fixed phrasing variants by action type, not random wording.
- **Existing text:** Preserve current behavior except where tests are updated for the additive advisory sentence.

## Test plan

- **Deterministic mapping:** Assert repeated descriptor generation returns the same `tool`, `intent`, and object `paramShape` for representative actions.
- **Semantic equivalence:** Assert semantically different feedback contexts with the same action mapping still produce the same descriptor.
- **No persistence leakage:** Assert built candidate/alternatives objects and serialized persisted state do not gain descriptor fields.
- **No execution verbs:** Assert the new advisory text in candidate and alternatives summaries excludes execution/action-trigger verbs.
- **Regression coverage:** Reuse existing execution chain helpers and immutability checks where possible.

## Validation

- **Targeted tests:** `npm run rooms:test:file -- scripts/tests/laboratory-execution-runtime-regressions.test.ts`
- **Type safety:** `npm run typecheck`
