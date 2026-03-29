# Plan: AI Slot Delivery and Outbound Hub Centralization

**Generated**: 2026-03-28
**Estimated Complexity**: High

## Overview

Promote the app's existing slot-send pipeline into the one canonical outbound message hub for all slot-bound traffic, then attach new "Asistana ilet" style UI actions to that same hub.

After the follow-up research, the recommended direction is stronger than the first draft:

- yes, user messages, relay sends, protocols, and new delivery buttons should converge on one center
- no, relay and protocol orchestration should not be flattened into one giant `send(text)` API
- the canonical center should be the existing `CoreEngine -> send-actions -> CommandManager -> CommandExecutor -> WebviewManager.send` pipeline, expanded into a clearer outbound hub contract

That means the implementation should avoid inventing a second transport stack beside `CoreEngine.sendBatch/sendMessage/sendProtocol`. Instead, we should make that path the single slot outbound gateway and migrate the remaining bypasses onto it.

## Current Findings

- `src/js/modules/assistant-delivery.ts` is already a shared-looking seam, but it is actually `ai0`-only, message-only, and currently used only by the entrance `webview-test` overlay.
- `src/js/pages/assistant/assistant.ts` owns the real `ai0` delivery readiness logic. It waits for account binding, connection, DOM readiness, tool readiness, and a non-busy traffic state before sending.
- The current central send helpers do not all share the same delivery semantics:
  - `sendBatchWithContext(...)` enqueues and returns success after queue admission
  - AI0 delivery waits for preflight and returns the real `WebviewManager.send(...)` result
  This difference means the future hub needs an explicit `dispatchMode` or equivalent ack policy.
- Normal user message flow is already close to the desired architecture:
  - `src/js/pages/analyze.ts` sends user-authored slot messages through `CoreEngine.sendBatch(...)`
  - `src/js/pages/server.ts` also uses `CoreEngine.sendBatch(...)`
- Relay and protocol traffic are also already partially centralized:
  - `src/js/modules/relay/ai-ai-relay.ts` forwards through `coreEngine.sendToTargets(...)` and `coreEngine.sendMessage(...)`
  - `src/js/modules/relay/ai-assistant-relay.ts` forwards through `coreEngine.sendMessage(...)`
  - `src/js/modules/core/send-actions.ts` already owns protocol composition plus batch enqueueing
- `src/js/modules/commands/ai-chat-commands.ts` already exposes two routing commands:
  - `AIAssistantSend` for `ai1/ai2 -> ai0`
  - `AssistantAISend` for `ai0 -> ai1/ai2`
    Both commands are message-only today and append the `hev-sender` tag manually.
- `src/js/modules/core/send-actions.ts` already supports attachment-aware batch sending through staged command files, so a new delivery system should reuse this instead of bypassing it.
- Attachment support is not end-to-end in the current helper stack:
  - `sendBatchWithContext(...)` supports attachments
  - `sendMessageWithContext(...)` and `sendToTargetsWithContext(...)` currently do not expose them
  - `ai-ai-relay.ts` already tries to pass attachments through `sendToTargets(...)`
- The true fragmentation is in the bypasses, not in the main pipeline:
  - `src/js/pages/assistant/assistant.ts` delivery handler calls `WebviewManager.send(...)` directly
  - `src/js/modules/commands/file-commands.ts` and `src/js/modules/commands/screenshot-commands.ts` also send directly
  - `src/js/modules/assistant-delivery.ts` sits beside the real send center instead of on top of it
- `src/js/pages/entrance/webview-panel.ts` already offers a "deliver to assistant" action, but only for completed `webview-test` runs. `webview-sync` is intentionally excluded today.
- `src/js/pages/assistant/assistant.ts` has an AI0 scenario panel with copy support but no delivery action.
- `src/js/pages/settings/live-log/overlay.ts` exposes enough selected-entry and filtered-log state to support a delivery action, but no send seam exists yet.
- `src/js/pages/settings/panels/languages.ts` creates new locale files and blank catalogs, but there is no "send this locale to assistant for translation" action.
- The lower transport stack already has one physical send endpoint:
  - `src/js/modules/command-executor.ts` is the queued executor
  - `src/js/modules/webview-manager.ts` and `src/js/modules/webview/message-sender.ts` own the final provider/webview dispatch
- Some adjacent message systems should stay outside the first consolidation pass unless explicitly expanded later:
  - `src/js/modules/core/whisper-actions.ts`
  - `electron/us1-conversation-service.ts`

## Assumptions

- Initial user-facing targets are `ai0` and `ai1`. The internal API should stay extensible to `ai2`, but first-pass UI work does not need a new `ai2` button family.
- The unification target is the slot outbound transport layer, not the higher-level business logic. Relay state machines, protocol builders, and whisper scheduling should keep their own orchestration code and call the shared hub.
- `assistant-delivery.ts` should survive as the AI0-specific activation and preflight adapter on top of the hub. It should not be flattened into a blind generic sender because `showPage("assistant")` and AI0 readiness checks are product behavior, not transport noise.
- Translation handoff should be non-destructive in v1: the app sends prompt plus files to the assistant, but does not auto-apply the returned translation.
- File delivery should use the existing staged attachment path instead of adding a second filesystem upload mechanism.
- The final shape should likely expose one internal outbound API with message kinds or policies such as `user`, `relay`, `protocol`, and `delivery`. `whisper` is explicitly out of v1 unless pulled in later as a dedicated follow-up.

## Prerequisites

- Existing command-regression coverage should remain green before and after the refactor.
- The target implementation should keep compatibility with:
  - `scripts/tests/assistant-delivery-regressions.test.ts`
  - `scripts/tests/assistant-ai-command-regressions.test.ts`
  - `scripts/tests/provider-test-overlay-flow-regressions.test.ts`
  - `scripts/tests/server-command-panel-regressions.test.ts`
- The refactor should preserve current user-send behavior in:
  - `src/js/pages/analyze.ts`
  - `src/js/pages/server.ts`
- The refactor should preserve current relay/protocol behavior in:
  - `src/js/modules/relay/ai-ai-relay.ts`
  - `src/js/modules/relay/ai-assistant-relay.ts`
  - `src/js/modules/core/send-actions.ts`
- Standard closure for the final implementation pass should include:
  - `npm run typecheck`
  - targeted `node --import tsx --test ...` suites for delivery, command, provider-test, and settings regressions
- Current source-shape tests that lock in direct `WebviewManager.send(...)` usage should be converted to behavior/contract assertions before the direct-send bypasses are removed.

## Sprint 1: Freeze the Contract

**Goal**: Capture the current outbound behavior and define the canonical hub boundary before moving callers.
**Demo/Validation**:

- Existing delivery and command tests still pass with no behavior change.
- A short audit doc or test matrix makes the current user, relay, protocol, and delivery paths explicit.

### Task 1.1: Lock the existing AI0 delivery seam in regression tests

- **Location**: `scripts/tests/assistant-delivery-regressions.test.ts`, `scripts/tests/assistant-ai-command-regressions.test.ts`
- **Description**: Expand the existing regression coverage so it explicitly guards the current AI0 readiness flow, sender-tag behavior, and failure messages before centralization starts. Convert implementation-coupled source assertions into behavior and contract assertions where necessary so the later transport refactor can proceed safely.
- **Complexity**: 4
- **Dependencies**: None
- **Acceptance Criteria**:
  - Existing AI0 handler registration remains covered.
  - Existing `AIAssistantSend` and `AssistantAISend` behavior is pinned down well enough to refactor safely.
  - Tests no longer fail merely because a direct `WebviewManager.send(...)` call moved behind the hub.
  - Any future API rename or flow change would force an intentional test update.
- **Validation**:
  - `node --import tsx --test scripts/tests/assistant-delivery-regressions.test.ts scripts/tests/assistant-ai-command-regressions.test.ts`

### Task 1.2: Add a dedicated outbound-hub contract test surface

- **Location**: new `scripts/tests/slot-delivery-contract-regressions.test.ts`
- **Description**: Add source-level or module-level tests that describe the new target request shape: target slot, message kind, text payload, optional attachments, page/source metadata, sender-tag policy, and transport policy.
- **Complexity**: 5
- **Dependencies**: Task 1.1
- **Acceptance Criteria**:
  - The contract clearly distinguishes public command wrappers and relay/protocol orchestrators from the internal reusable outbound API.
  - Attachments are part of the contract from day one.
  - Target selection is explicit rather than hidden behind relay labels.
  - Message kind or delivery policy is explicit enough that relay and protocol paths do not lose their current semantics.
- **Validation**:
  - `node --import tsx --test scripts/tests/slot-delivery-contract-regressions.test.ts`

### Task 1.3: Document the full outbound matrix and migration boundary

- **Location**: `.rovo/ai-slot-delivery-centralization-plan.md` or a small companion note under `.rovo/`
- **Description**: Preserve the audit matrix of current outbound paths so the later implementation can deliberately move user send, relay send, protocol send, delivery send, and direct bypass sends into the hub without swallowing unrelated business logic into the wrong abstraction.
- **Complexity**: 2
- **Dependencies**: Task 1.1
- **Acceptance Criteria**:
  - The team can answer which paths are in-scope now and which remain separate.
  - The implementation boundary calls out what moves into the transport hub versus what stays in higher-level orchestration.
- **Validation**:
  - Manual review against the current findings list in this plan

## Sprint 2: Promote the Canonical Outbound Hub

**Goal**: Promote the existing `CoreEngine` send pipeline into the one canonical outbound hub for all slot-bound messages.
**Demo/Validation**:

- The app can perform user, relay, protocol, and delivery sends through one internal outbound contract.
- Existing command names still work and now delegate through the shared hub.

### Task 2.1: Introduce a canonical outbound-hub contract on top of the existing send pipeline

- **Location**: `src/js/modules/core-engine.ts`, `src/js/modules/core/send-actions.ts`, optional new `src/js/modules/outbound-hub.ts`
- **Description**: Define one internal outbound request contract that sits on top of the current `CoreEngine/send-actions` pipeline. The contract should include target slot(s), message kind, text, attachments, page, metadata, sender-tag policy, and an explicit dispatch policy such as `queue` or `await-result`.
- **Complexity**: 7
- **Dependencies**: Sprint 1
- **Acceptance Criteria**:
  - The app has one clearly named internal outbound transport API.
  - Attachments are first-class inputs.
  - The API is built by extending the current send pipeline rather than replacing it with a second transport path.
  - Queue admission and real-send acknowledgement are modeled explicitly rather than implied.
- **Validation**:
  - `node --import tsx --test scripts/tests/slot-delivery-contract-regressions.test.ts scripts/tests/assistant-delivery-regressions.test.ts`

### Task 2.2: Add explicit outbound message kinds or policies

- **Location**: `src/js/modules/core/send-actions.ts`, optional new shared outbound types
- **Description**: Model the semantic differences that matter for delivery: `user`, `relay`, `protocol`, and `delivery`, plus a dispatch mode such as `queue` or `await-result`. These policies should influence sender tagging, logging, archive behavior, and ack semantics without splitting the transport implementation again.
- **Complexity**: 8
- **Dependencies**: Task 2.1
- **Acceptance Criteria**:
  - Relay and protocol paths can use the shared hub without losing their current order and state semantics.
  - User and delivery paths can carry attachments without special one-off code.
  - The hub policy surface is small enough to stay maintainable.
  - `whisper` is either explicitly excluded from v1 policy types or broken out into a clearly separate later phase.
- **Validation**:
  - `npm run typecheck`
  - targeted hub and command regression tests

### Task 2.3: Lift attachment support through `sendMessage` and `sendToTargets`

- **Location**: `src/js/modules/core/send-actions.ts`, `src/js/modules/core-engine.ts`, `src/js/modules/relay/ai-ai-relay.ts`
- **Description**: Extend the current convenience helpers so attachments can flow end-to-end through `CoreEngine.sendMessage(...)` and `CoreEngine.sendToTargets(...)`. Preserve the already-existing AI-AI relay attachment path instead of silently dropping attachments.
- **Complexity**: 7
- **Dependencies**: Tasks 2.1-2.2
- **Acceptance Criteria**:
  - `sendMessage` can carry attachments.
  - `sendToTargets` can carry attachments.
  - Existing relay attachment calls no longer depend on a capability gap.
  - Attachment staging and cleanup still reuse the current batch pipeline.
- **Validation**:
  - targeted attachment regression coverage
  - `npm run typecheck`

### Task 2.4: Reframe `assistant-delivery.ts` as an AI0 preflight adapter on top of the hub

- **Location**: `src/js/modules/assistant-delivery.ts`, `src/js/pages/assistant/assistant.ts`, `src/js/modules/commands/file-commands.ts`, `src/js/modules/commands/screenshot-commands.ts`
- **Description**: Keep `assistant-delivery.ts` as the AI0-specific activation and preflight adapter that calls the canonical hub after `showPage("assistant")` and readiness checks. Do not erase AI0 preflight behavior while centralizing transport.
- **Complexity**: 6
- **Dependencies**: Tasks 2.1-2.3
- **Acceptance Criteria**:
  - `assistant-delivery.ts` becomes a caller of the canonical hub, not a sibling transport path.
  - `showPage("assistant")` and AI0 readiness semantics remain intact.
  - The AI0 path can request `await-result` style dispatch instead of queue-only semantics where needed.
- **Validation**:
  - `node --import tsx --test scripts/tests/assistant-delivery-regressions.test.ts scripts/tests/assistant-ai-command-regressions.test.ts`

### Task 2.5: Move the remaining direct bypass senders onto the shared hub

- **Location**: `src/js/modules/commands/file-commands.ts`, `src/js/modules/commands/screenshot-commands.ts`, any remaining slot-bound direct `WebviewManager.send(...)` callers
- **Description**: Replace direct slot-bound `WebviewManager.send(...)` usage with the shared hub wherever the send does not require page-owned preflight behavior like AI0 delivery.
- **Complexity**: 6
- **Dependencies**: Tasks 2.1-2.4
- **Acceptance Criteria**:
  - File-return delivery and screenshot-return delivery reuse the same transport seam.
  - The low-level direct send surface becomes much smaller and easier to audit.
  - Any remaining direct sender is either migrated or explicitly documented as exempt.
- **Validation**:
  - targeted regression coverage

### Task 2.6: Move `AIAssistantSend` and `AssistantAISend` onto the shared hub

- **Location**: `src/js/modules/commands/ai-chat-commands.ts`, `src/js/modules/server-commands.ts`, `src/js/modules/commands/command-descriptions.ts`
- **Description**: Refactor the two existing commands so they become thin wrappers around the canonical outbound hub. Keep current names, aliases, and access checks to avoid UX churn.
- **Complexity**: 7
- **Dependencies**: Tasks 2.1-2.5
- **Acceptance Criteria**:
  - Public command names stay stable.
  - Sender-tag behavior is preserved in one place instead of duplicated by command.
  - The command layer resolves target and source, then delegates to the canonical hub.
- **Validation**:
  - `node --import tsx --test scripts/tests/assistant-ai-command-regressions.test.ts scripts/tests/server-command-panel-regressions.test.ts`

## Sprint 3: Adopt the Core in Test and Log UI

**Goal**: Replace special-case UI delivery code with reusable outbound-hub actions in the requested overlays.
**Demo/Validation**:

- Completed temp-artifact generation for non-file payloads
- Completed AI1/AI2 `webview-test`
- Completed AI1/AI2 `webview-sync`
- Completed AI0 `webview-test`
- Settings live log error/warning selection
  all expose working delivery actions without duplicating send logic.

### Task 3.1: Add a temp-artifact helper for in-memory delivery payloads

- **Location**: shared helper near `src/js/modules/file-manager.ts` or a new delivery helper module
- **Description**: Add a helper that can serialize in-memory JSON or text payloads such as `webview-sync` results, filtered live-log slices, and language handoff artifacts into temp files so the hub can send them through the existing staging path.
- **Complexity**: 6
- **Dependencies**: Sprint 2
- **Acceptance Criteria**:
  - Delivery callers can hand the hub a generated artifact and receive a stable temp file path.
  - Temp artifact cleanup rules are compatible with the current command staging flow.
  - Oversized JSON payloads no longer need to be pasted inline to reach attachment delivery.
- **Validation**:
  - targeted helper regression test
  - manual smoke with one generated JSON attachment

### Task 3.2: Upgrade entrance scenario overlay delivery from `webview-test`-only to reusable delivery

- **Location**: `src/js/pages/entrance/webview-panel.ts`, `scripts/tests/provider-test-overlay-flow-regressions.test.ts`
- **Description**: Replace the current AI0-only helper usage with the shared delivery service and extend the action to support both `webview-test` and `webview-sync`. Use temp artifacts for raw suite attachments where the payload is generated in memory.
- **Complexity**: 6
- **Dependencies**: Sprint 2
- **Acceptance Criteria**:
  - The overlay action is available for completed `webview-test` and completed `webview-sync`.
  - The message builder remains concise and highlights failures/warnings first.
  - The raw suite can be attached as JSON instead of bloating the chat body.
- **Validation**:
  - `node --import tsx --test scripts/tests/provider-test-overlay-flow-regressions.test.ts`

### Task 3.3: Add an AI0 scenario-panel delivery action

- **Location**: `src/js/pages/assistant/assistant.ts`, optional shared provider-test delivery helper under `src/js/pages/shared/`
- **Description**: Add the same "Asistana ilet" outcome to the AI0-side scenario panel so assistant-side `webview-test` results can be pushed into the active assistant conversation without manual copy-paste.
- **Complexity**: 5
- **Dependencies**: Sprint 2
- **Acceptance Criteria**:
  - AI0 scenario panel shows a delivery button when a run is completed.
  - The send path uses the same shared delivery service as entrance overlays.
  - The implementation does not duplicate the AI1/AI2 delivery formatter more than necessary.
- **Validation**:
  - `npm run typecheck`
  - new targeted regression for assistant scenario-panel delivery presence

### Task 3.4: Add log-view delivery with filtered error/warning summaries

- **Location**: `src/pages/settings.html`, `src/js/pages/settings/live-log/overlay.ts`, `src/js/pages/settings/live-log/overlay-render.ts`, new tests under `scripts/tests/`
- **Description**: Add one delivery action to the live-log overlay that packages the current filtered error/warning slice into a concise summary plus an optional machine-readable attachment. Use the temp-artifact helper for the raw log bundle.
- **Complexity**: 7
- **Dependencies**: Sprint 2
- **Acceptance Criteria**:
  - The live-log UI offers an "Asistana ilet" action.
  - The summary prefers the selected entry when one is open, otherwise sends the current filtered error/warning slice with sensible limits.
  - Oversized log bodies are clipped in message text and preserved in the attachment instead.
- **Validation**:
  - new live-log delivery regression test
  - manual smoke with `error` and `warning` filters

## Sprint 4: Add Language-Translation Handoff

**Goal**: Let the settings language editor send a newly created locale to the assistant as a translation task with the right files and prompt context.
**Demo/Validation**:

- A newly created app locale can be handed to `ai0` from the language editor.
- The delivery includes enough context for the assistant to translate without manually hunting files.

### Task 4.1: Add a translation handoff action to the language editor

- **Location**: `src/js/pages/settings/panels/languages.ts`, `src/pages/settings.html`, related i18n text resources if needed
- **Description**: Add a CTA such as "Asistana tercüme ettir" near the active locale or newly created locale controls, wired to the shared delivery service.
- **Complexity**: 6
- **Dependencies**: Sprint 2
- **Acceptance Criteria**:
  - The action is visible only when a meaningful locale selection exists.
  - The action is disabled while the panel is loading or saving.
  - The delivery path does not mutate locale files automatically.
- **Validation**:
  - `npm run typecheck`
  - new language-panel delivery regression test

### Task 4.2: Build a translation prompt plus attachment bundle for new locales

- **Location**: `src/js/pages/settings/panels/languages.ts`, optional new helper under `src/js/pages/settings/panels/`
- **Description**: Generate a compact assistant prompt that explains the locale, source language, selector language, and non-destructive expectations. Attach the source Turkish catalog, target blank catalog, and manifest when available.
- **Complexity**: 7
- **Dependencies**: Task 4.1
- **Acceptance Criteria**:
  - The prompt is short enough for chat usability.
  - The heavy translation content lives in attachments rather than only inlined text.
  - Placeholder and newline preservation expectations are explicit in the prompt.
- **Validation**:
  - targeted regression on prompt-builder output
  - manual smoke with one newly created locale

### Task 4.3: Decide and document the v1 return path for translated output

- **Location**: `.rovo/ai-slot-delivery-centralization-plan.md`, optional follow-up task doc
- **Description**: Explicitly document that v1 stops at delivery-to-assistant. Importing the assistant's translated output back into locale files is a separate follow-up unless intentionally pulled into scope.
- **Complexity**: 2
- **Dependencies**: Task 4.2
- **Acceptance Criteria**:
  - The team does not accidentally promise round-trip auto-apply in the first implementation.
  - Manual review remains the default safety boundary.
- **Validation**:
  - Manual review

## Sprint 5: Regression Closure and Rollout

**Goal**: Land the centralized delivery system with enough test coverage and UI smoke checks that future delivery additions stay cheap.
**Demo/Validation**:

- All requested UI surfaces use one shared outbound hub.
- Existing user, relay, protocol, and command behavior remains intact.

### Task 5.1: Add or update targeted regression suites

- **Location**: `scripts/tests/assistant-delivery-regressions.test.ts`, `scripts/tests/assistant-ai-command-regressions.test.ts`, `scripts/tests/provider-test-overlay-flow-regressions.test.ts`, new live-log and languages delivery tests
- **Description**: Expand the regression net so the new shared delivery seam, overlay actions, and language handoff remain guarded.
- **Complexity**: 6
- **Dependencies**: Sprints 2-4
- **Acceptance Criteria**:
  - New delivery behaviors are covered without deleting existing guarantees.
  - Tests explicitly guard `webview-sync` delivery availability and AI0 panel delivery presence.
  - Command regressions keep the old command names stable.
  - At least one regression source test guards that user send and protocol send still route through the canonical hub surface.
- **Validation**:
  - targeted `node --import tsx --test ...` batch

### Task 5.2: Run full type and targeted smoke closure

- **Location**: repository root commands plus affected files
- **Description**: Run standard type validation and perform a small manual smoke matrix covering AI0, AI1, overlays, and language delivery.
- **Complexity**: 4
- **Dependencies**: Task 5.1
- **Acceptance Criteria**:
  - `npm run typecheck` passes.
  - Manual smoke confirms:
    - analyze user send -> ai1/ai2 still works
    - entrance `webview-test -> ai0`
    - entrance `webview-sync -> ai0`
    - assistant `webview-test -> ai0`
    - settings live log -> ai0
    - settings new locale -> ai0
- **Validation**:
  - `npm run typecheck`
  - targeted smoke checklist in PR or task notes

### Task 5.3: Clean up copy, labels, and command descriptions

- **Location**: affected UI files plus i18n resources and `src/js/modules/commands/command-descriptions.ts`
- **Description**: Align the button copy, busy states, and command help text with the centralized delivery vocabulary so the product no longer feels like four separate features.
- **Complexity**: 3
- **Dependencies**: Task 5.1
- **Acceptance Criteria**:
  - Button labels are consistent across overlays and settings panels.
  - Delivery success and failure messages name the correct target.
  - Command help text still matches the kept public command names.
- **Validation**:
  - manual UI review
  - targeted regression snapshot/source tests if added

## Testing Strategy

- Start with source-level regression tests so the shared delivery seam can be refactored safely.
- Keep `CoreEngine.sendBatch/sendMessage/sendProtocol` behavior under explicit regression because they are now the intended canonical hub surface.
- Keep command and overlay tests targeted rather than jumping straight to a full app smoke run after every step.
- Use attachment-aware manual smoke only after the shared delivery core is wired, because that is where temp-file cleanup risk appears.
- Final implementation closure should include:
  - `npm run typecheck`
  - `node --import tsx --test scripts/tests/assistant-delivery-regressions.test.ts scripts/tests/assistant-ai-command-regressions.test.ts scripts/tests/provider-test-overlay-flow-regressions.test.ts`
  - any new delivery-focused test files added for live log and language editor

## Potential Risks & Gotchas

- The current AI0 delivery path waits for DOM and tool readiness. A generic refactor can easily weaken that behavior if it over-normalizes all targets.
- The current system already mixes queued sends and direct sends. Pulling everything behind one hub needs explicit policy handling so relay/protocol latency or sequencing does not regress.
- Relay and protocol systems are not just messages; they are orchestration plus transport. Moving them into the hub at the wrong layer would create a giant unmaintainable abstraction.
- `webview-sync` results can be much larger than `webview-test`. The delivery action should summarize inline and attach the raw suite rather than pasting everything into chat.
- AI0 self-delivery from the assistant scenario panel risks noisy loops or command-catch confusion if sender tagging is inconsistent.
- Live log payloads can become huge. The action needs selection limits, clipping rules, and attachment fallback.
- Language catalogs can contain placeholder and newline constraints that must be preserved in the assistant prompt, otherwise translation quality will regress even if the UI flow works.
- Existing tests and docs already encode the current command names. Renaming the public `++cmd` surface would create avoidable churn.
- If the entrance page owns the AI1 target handler, delivery should fail cleanly when that page is unavailable rather than silently dropping requests.
- Direct `WebviewManager.send(...)` bypasses hidden elsewhere in the codebase can undermine the new "single center" claim unless they are explicitly inventoried and either migrated or exempted.

## Rollback Plan

- Keep the old command names as thin wrappers so rollback can swap the implementation behind them without breaking external behavior.
- If the shared delivery core causes instability, revert in this order:
  1. hide new UI delivery buttons
  2. restore the old `assistant-delivery.ts` AI0-only flow
  3. restore direct command-specific send behavior in `ai-chat-commands.ts`
  4. temporarily allow the known direct bypass senders again while preserving the old core pipeline for user sends
- Do not roll relay, protocol, or whisper behavior into the same rollback unless the regression actually touches those systems.
