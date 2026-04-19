# Plan: Rovo Interaction Layer V1

**Generated**: 2026-04-18
**Estimated Complexity**: High

## Overview

Create a Hayalet Ev-local interaction layer that can switch between plain text and special UI rendering without depending on `.codex`, external skill discovery, or new MCP tooling for its first release.

The system should:

- activate only when Hayalet Ev is effectively running with OpenCode serve and the `opencode-ui` assistant account
- stay fully inactive while the current workflow is `codex cli`, `other-provider-cli`, `terminal`, `ghost-agent`, `transitioning`, or `conflict`
- preserve the current `evet`-based code-change approval flow as the canonical answer for change approval
- add a local `plan-harder` intake flow that can ask structured planning questions inside the OpenCode UI instead of relying on external skill-only behavior
- remain provider-neutral at the protocol level even though `opencode-ui` is the first UI adapter

The first release should be treated as a repo-owned product surface, not as a Codex skill system.

## Goals

- Replace ad hoc prompt-only interaction patterns with a deterministic local interaction contract
- Keep the `change-approval` flow simple and strict
- Introduce a `plan-harder-local` interaction that can collect planning details through the UI
- Keep the first transport and renderer seam simple enough to iterate quickly
- Preserve a plain text fallback so the system can fail soft instead of blocking work

## Non-Goals For V1

- No MCP dependency for activation or orchestration
- No `.codex` integration, sync, or skill export path
- No migration of `hayalet-ev-ui`
- No image preview approval or image edit workflow in `v1`
- No provider plugin or OpenCode-side skill installation that requires user setup
- No DB schema change unless a later implementation task proves it is required
- No dedicated persistence schema; drafts can only use the existing memory DB as an optional best-effort layer

## Research Notes

- `scripts/whereami.mjs` already combines runtime control, process probes, CLI-owner detection, and assistant slot settings.
- `scripts/lib/whereami-runtime.mjs` already distinguishes `terminal`, `app`, `ghost-agent`, `transitioning`, and `conflict`.
- `scripts/lib/whereami-provider-context.mjs` already distinguishes `opencode-terminal-mode`, `other-provider-cli`, and active OpenCode serve cases.
- `scripts/lib/settings-status.mjs` already exposes the assistant slot `accountId` and command capture status.
- `src/js/pages/opencode-ui/history-actions.ts` currently renders chat history from parsed session data.
- `src/js/pages/opencode-ui/chat-utils.ts` currently renders assistant bubbles as safe text and supports a custom render function seam.
- `electron/opencode-ui-session-store.ts` and `electron/opencode-ui-session/parser.ts` already provide a clean session-to-UI parse boundary.
- `src/js/pages/opencode-ui/tools-prompts.ts` already shows a local pattern for applying structured UI actions back into the compose area.

## Product Direction

The new system should be framed as:

- `Rovo Interaction Layer` for the runtime feature
- `interaction packs` for repo-local, machine-readable prompt and question bundles

Avoid the word `skill` in the implementation surface so the feature stays Hayalet Ev-owned and does not imply `.codex` behavior.

## Scope Lock

### In Scope

- Activation rules based on the current `whereami`-style runtime signals
- A local interaction contract that supports special rendering plus plain text fallback
- A `change-approval` card with canonical answer `evet`
- A `plan-harder-local` card that collects planning details inside OpenCode UI
- A repo-local folder convention under `.rovo/interactions/`
- A short validation and smoke checklist for the first rollout

### Out Of Scope

- No hard requirement for persisted drafts; best-effort draft restore via the existing memory DB is acceptable
- Multi-provider adapters outside `opencode-ui`
- Image review, preview approval, or artifact comparison flows
- New MCP tools
- Any requirement that the user install or enable additional provider-side capabilities

## Proposed Architecture

### 1. Activation Gate

Introduce one local activation resolver that mirrors the current `whereami` rules instead of scattering checks across UI code.

The interaction layer is active only when all of these are true:

- effective app mode is compatible with `app`
- OpenCode serve is active
- assistant slot account id is `opencode_ui_opencode_at_opencode_com`
- active assistant provider is `opencode-ui`

The interaction layer must be forced inactive when:

- `effectiveMode` is `other-provider-cli`
- `effectiveMode` is `opencode-terminal-mode`
- app mode resolves to `terminal`
- mode resolves to `ghost-agent`, `transitioning`, or `conflict`

### 2. Interaction Contract

Define a small repo-owned protocol for special interaction cards.

V1 card types:

- `change-approval`
- `plan-harder-local`

Each interaction payload must carry:

- `type`
- `version`
- `title`
- `body`
- `actions`
- `fallbackText`
- card-specific data

Each interaction must also define:

- when it is renderable as a special card
- what the canonical user response shape is
- what plain text fallback should be shown if rendering is unavailable

### 3. Renderer Registry

Add a narrow renderer seam in OpenCode UI message rendering:

- parse a special Rovo interaction block from assistant text
- if activation gate is off, render plain text only
- if activation gate is on and the payload is valid, render the matching card
- if parsing fails, fall back to plain text

This keeps the first release low-risk while preserving current behavior.

### 4. Reply Canonicalization

V1 must distinguish between approval and planning flows.

Rules:

- `change-approval` accepts only `evet` as the canonical approval answer
- `plan-harder-local` submits a generated plain text planning reply, not `evet`
- the renderer must not let a planning submit accidentally satisfy a code-change approval gate

### 5. Interaction Packs

Add a local repo-owned content area:

- `.rovo/interactions/change-approval/`
- `.rovo/interactions/plan-harder-local/`

Planned pack contents:

- `manifest.json`
- `prompt.md`
- optional `questions.json`
- optional `rules.json`

The first implementation can start with only the files needed to prove the flow.

### 6. Optional Draft Persistence

`plan-harder-local` can use the existing memory DB to keep draft answers without adding a new schema.

Rules:

- activation must not depend on memory availability
- draft persistence is optional and best-effort
- submit and clear flows must continue even if memory read/write fails
- the namespace should stay interaction-local so future cards can evolve independently

## Suggested Directory Direction

### Runtime Code

- `src/js/modules/rovo-interactions/activation.ts`
- `src/js/modules/rovo-interactions/types.ts`
- `src/js/modules/rovo-interactions/parser.ts`
- `src/js/pages/opencode-ui/interaction-renderer.ts`

### Planned Repo Content

- `.rovo/interactions/change-approval/manifest.json`
- `.rovo/interactions/change-approval/prompt.md`
- `.rovo/interactions/plan-harder-local/manifest.json`
- `.rovo/interactions/plan-harder-local/prompt.md`
- `.rovo/interactions/plan-harder-local/questions.json`

### Touched UI Integration Files

- `src/js/pages/opencode-ui/history-actions.ts`
- `src/js/pages/opencode-ui/chat-utils.ts`
- `src/js/pages/opencode-ui/types.ts`
- `src/styles/design-system/components/chat.css`

## Assumptions

- Plain text remains the source-compatible fallback for all interaction cards.
- The first release can encode the interaction payload inside assistant message text instead of requiring a DB schema change.
- OpenCode UI is the only first-party renderer in `v1`, but the contract should not hardcode `opencode-ui` semantics into the payload shape itself.
- The interaction layer may start with synchronous UI actions that place text into the compose area rather than sending automatically when that keeps risk lower.

## Sprint 1: Lock V1 Contract And Boundaries

**Goal**: Freeze the rules that decide when the interaction layer is active and what V1 is allowed to do.
**Demo/Validation**:

- A written contract exists for activation, card types, and reply rules
- The plan clearly separates approval from planning flows

### Task 1.1: Define the activation contract from current runtime signals

- **Location**: `scripts/whereami.mjs`, `scripts/lib/whereami-runtime.mjs`, `scripts/lib/whereami-provider-context.mjs`, planned `src/js/modules/rovo-interactions/activation.ts`
- **Description**: Document and codify the exact conditions under which the interaction layer becomes active, using the same semantics as current `whereami` logic.
- **Complexity**: 4
- **Dependencies**: None
- **Acceptance Criteria**:
  - One explicit activation table exists
  - `other-provider-cli` is explicitly excluded
  - `opencode serve active + opencode-ui account` is explicitly required
- **Validation**:
  - Compare proposed rules against current `whereami` outputs for terminal, app, and CLI-owned cases

### Task 1.2: Define the V1 interaction payload and fallback rules

- **Location**: planned `src/js/modules/rovo-interactions/types.ts`, planned `src/js/modules/rovo-interactions/parser.ts`, `.rovo/interactions/*`
- **Description**: Create a compact interaction payload shape that supports both special rendering and a text fallback without depending on MCP or external skill discovery.
- **Complexity**: 5
- **Dependencies**: Task 1.1
- **Acceptance Criteria**:
  - `change-approval` and `plan-harder-local` are both covered
  - Fallback text is mandatory
  - Reply canonicalization rules are explicit
- **Validation**:
  - One example payload per V1 card type can be represented without ambiguity

### Task 1.3: Define the local interaction pack convention under `.rovo`

- **Location**: `.rovo/interactions/`
- **Description**: Replace the old skill framing with a repo-local pack convention so prompts and question bundles live inside the project.
- **Complexity**: 3
- **Dependencies**: Task 1.2
- **Acceptance Criteria**:
  - Naming avoids `skill`
  - The initial folder structure is documented
  - `plan-harder-local` is the first planning pack
- **Validation**:
  - The plan references one consistent folder structure only

## Sprint 2: Add The OpenCode UI Rendering Seam

**Goal**: Make OpenCode UI able to interpret a Rovo interaction block when the activation gate is on.
**Demo/Validation**:

- An assistant message containing a valid interaction block renders as a card
- The same message falls back to plain text when the gate is off

### Task 2.1: Add a parser and renderer entry point for interaction blocks

- **Location**: planned `src/js/modules/rovo-interactions/parser.ts`, planned `src/js/pages/opencode-ui/interaction-renderer.ts`, `src/js/pages/opencode-ui/chat-utils.ts`
- **Description**: Add the smallest safe parser and custom render seam needed to detect and render a V1 interaction card from assistant text.
- **Complexity**: 6
- **Dependencies**: Sprint 1 complete
- **Acceptance Criteria**:
  - Invalid payloads do not break message rendering
  - Plain text still renders when the payload is missing or malformed
  - Rendering is gated by activation state
- **Validation**:
  - Focused UI smoke with valid payload, invalid payload, and inactive gate

### Task 2.2: Thread interaction rendering through history replay

- **Location**: `src/js/pages/opencode-ui/history-actions.ts`, `src/js/pages/opencode-ui/types.ts`, `electron/opencode-ui-session/parser.ts` if needed
- **Description**: Ensure that a saved assistant message can replay as a special interaction card after reload, without needing a new transport layer in `v1`.
- **Complexity**: 5
- **Dependencies**: Task 2.1
- **Acceptance Criteria**:
  - History replay uses the same rendering logic as live assistant output
  - No separate replay-only renderer exists
  - The flow still works from raw session text
- **Validation**:
  - Reload a session and confirm the card still appears

### Task 2.3: Add minimal card styling that preserves current chat hierarchy

- **Location**: `src/styles/design-system/components/chat.css`
- **Description**: Add only the styling needed for the first interaction cards while keeping one dominant interaction surface and avoiding dashboard-like layouts.
- **Complexity**: 4
- **Dependencies**: Task 2.1
- **Acceptance Criteria**:
  - `change-approval` is visually strict and simple
  - `plan-harder-local` supports compact structured inputs
  - The card still reads clearly as part of the chat timeline
- **Validation**:
  - Manual UI inspection on desktop width and narrower layouts

## Sprint 3: Implement `change-approval`

**Goal**: Move the existing approval block into the first structured interaction card without weakening the `evet` rule.
**Demo/Validation**:

- The user sees a structured approval card
- Only `evet` satisfies the approval action

### Task 3.1: Convert the project-standard approval block into a V1 card

- **Location**: planned `.rovo/interactions/change-approval/*`, approval message generation points, OpenCode UI interaction renderer
- **Description**: Define the first structured card for code-change approval while keeping the visible protocol and the canonical response unchanged.
- **Complexity**: 5
- **Dependencies**: Sprint 2 complete
- **Acceptance Criteria**:
  - Card copy still communicates mode, counterparty, issue, solution, and affected files
  - The allowed approval answer remains `evet`
  - The fallback text remains understandable without special rendering
- **Validation**:
  - Manual approval smoke with exact `evet`
  - Negative smoke with non-canonical planning reply text

### Task 3.2: Prevent approval confusion with other interaction replies

- **Location**: planned reply canonicalization seam, approval handling logic
- **Description**: Make sure replies generated for planning cannot be interpreted as code-change approval.
- **Complexity**: 5
- **Dependencies**: Task 3.1
- **Acceptance Criteria**:
  - Planning submit text does not pass the approval gate
  - Approval matching remains narrow and explicit
- **Validation**:
  - Focused smoke using approval and planning cards back to back

## Sprint 4: Implement `plan-harder-local`

**Goal**: Add a local planning intake card that can collect planning constraints inside the UI.
**Demo/Validation**:

- The user can answer planning questions inside the card
- The card produces a deterministic planning reply payload or compose draft

### Task 4.1: Create the first local planning pack

- **Location**: planned `.rovo/interactions/plan-harder-local/manifest.json`, `.rovo/interactions/plan-harder-local/prompt.md`, `.rovo/interactions/plan-harder-local/questions.json`
- **Description**: Move the first planning-specific interaction content into `.rovo` as a local pack rather than an external skill dependency.
- **Complexity**: 4
- **Dependencies**: Sprint 1 complete
- **Acceptance Criteria**:
  - Questions are focused on planning needs, not implementation approval
  - The pack is clearly local to the repo
  - No `.codex` dependency remains in the V1 flow
- **Validation**:
  - Review the pack against the V1 scope lock

### Task 4.2: Render and submit the `plan-harder-local` card

- **Location**: planned `src/js/pages/opencode-ui/interaction-renderer.ts`, `src/js/pages/opencode-ui/chat-utils.ts`, possible helper near `src/js/pages/opencode-ui/tools-prompts.ts`
- **Description**: Render a structured planning intake card that can collect user choices and free text, then place the generated response into the compose flow or submit path.
- **Complexity**: 7
- **Dependencies**: Task 4.1, Sprint 2 complete
- **Acceptance Criteria**:
  - Required questions are clearly represented
  - The card can generate a deterministic planning reply
  - The reply path does not collide with `change-approval`
- **Validation**:
  - Manual smoke covering full submit, partial fill, and cancel/close behavior

### Task 4.3: Keep the first interaction set intentionally small

- **Location**: renderer and pack definitions
- **Description**: Refuse extra card types in `v1` so the architecture stays easy to reason about and test.
- **Complexity**: 2
- **Dependencies**: Task 4.2
- **Acceptance Criteria**:
  - Only two V1 card types are active
  - Future types are documented as extensions, not partially implemented
- **Validation**:
  - Final V1 checklist confirms no stray third card type entered scope

## Sprint 5: Validation And Rollout Notes

**Goal**: Leave a usable, extensible first plan and a safe path to rollout.
**Demo/Validation**:

- The project has a clear implementation order and a small smoke matrix

### Task 5.1: Add a focused smoke checklist for activation and card behavior

- **Location**: this plan or a later dedicated checklist file under `.rovo/`
- **Description**: Define a short smoke matrix for activation state, approval behavior, and local planning behavior.
- **Complexity**: 3
- **Dependencies**: Sprint 4 complete
- **Acceptance Criteria**:
  - Includes gate-on and gate-off coverage
  - Includes approval and planning reply separation
  - Includes session reload coverage
- **Validation**:
  - Checklist can be followed manually without extra tooling

### Task 5.2: Document V2 extension hooks without implementing them

- **Location**: this plan, later architecture notes if needed
- **Description**: Record the immediate next expansions so V1 does not paint the system into a corner.
- **Complexity**: 2
- **Dependencies**: Task 5.1
- **Acceptance Criteria**:
  - Preview approval and image review are mentioned only as future hooks
  - MCP is mentioned only as an optional future helper for persistence/artifacts
- **Validation**:
  - Scope lock remains unchanged after documenting V2 hooks

## Testing Strategy

- Validate activation using real `whereami` scenarios:
  - OpenCode serve off
  - app open but CLI-owned by another provider
  - OpenCode serve on with `opencode-ui` assistant account
- Validate plain text fallback with gate off
- Validate special rendering with gate on
- Validate `change-approval` exact-match approval behavior with `evet`
- Validate that planning submissions never satisfy approval rules
- Validate session replay so saved messages still render correctly after reload

## Potential Risks And Gotchas

- If activation logic drifts from `whereami`, the UI may turn on in the wrong context.
- If the payload format is too clever, plain text fallback will become fragile.
- If approval and planning replies share too much text shape, false approvals become possible.
- If V1 tries to solve persistence, previews, and image review at once, the interaction layer will become hard to stabilize.
- If the renderer lives only in one path and history replay uses another, cards will behave inconsistently after reload.

## Mitigations

- Reuse current runtime semantics instead of inventing a second activation truth source.
- Keep payload parsing narrow and versioned.
- Keep `change-approval` and `plan-harder-local` canonical replies intentionally different.
- Freeze V1 scope to two card types only.
- Use one renderer seam for both live and replayed messages.

## Rollback Plan

- Disable the activation gate and fall back to plain text only
- Leave interaction payloads readable as text if special rendering is removed
- Remove V1 card rendering without changing the existing approval wording
- Defer local planning intake back to plain text questions if the structured card is not stable enough

## Next-Step Recommendation

Start with Sprint 1 and Sprint 2 only, then review the payload shape before implementing either card. The quality of the activation gate and the renderer seam will determine whether the rest of the system stays easy to extend.
