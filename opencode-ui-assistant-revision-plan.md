# Plan: Assistant OpenCode UI Revision

**Generated**: 2026-04-19
**Estimated Complexity**: High

## Overview
Refresh the Assistant page's `opencode-ui` surface so it feels functionally closer to the OpenCode web UI while staying inside Hayalet Ev's design system. The implementation should improve message rendering, surface limit/retry/error states inside the chat timeline, replace attachment chips with visual previews, complete i18n coverage, and leave the page with stronger regression coverage.

## Assumptions
- Scope is limited to the Assistant page's OpenCode UI surface, not the full assistant scene shell.
- The goal is functional parity and clearer hierarchy, not a pixel-perfect clone of the web product.
- Limit and retry feedback should be visible both for API/request failures and for structured session events when that data exists in session storage.
- Image previews must land at minimum for staged composer attachments; persisted history thumbnails are in scope only if session data retains reusable image payloads or URLs.

## Prerequisites
- Use the existing OpenCode UI page scaffold and design-system tokens as the source of truth.
- Reuse current regressions under `scripts/tests/opencode-ui-*.test.ts` before introducing new suites.
- Validate against both locales in `shared/languages/tr/index.json` and `shared/languages/en/index.json`.
- Keep Rovo interaction cards, tool-call rendering, and current assistant session sync behavior working throughout the refactor.
- Capture at least one representative API/request failure sample and one persisted session fixture before finalizing notice-state UI work.

## Sprint 1: Message Contract And Render Architecture
**Goal**: Normalize the data model, capture real payload examples, and lock rendering invariants before visual redesign so later UI work does not depend on ad-hoc parsing.
**Demo/Validation**:
- A single sample session can distinguish plain text, structured assistant parts, tool calls, files, and status/error notices.
- Existing session-store/history regressions still pass after the type and parser changes.

### Task 1.1: Capture Payload Fixtures And Failure Sources
- **Location**: `src/js/pages/opencode-ui/api.ts`, `src/js/pages/opencode-ui/composer-actions.ts`, `src/js/pages/opencode-ui/app-bootstrap.ts`, `electron/opencode-ui-session/parser.ts`, `scripts/tests/opencode-ui-session-store-regressions.test.ts`
- **Description**: Capture and classify the failure sources this page actually sees today, separating persisted session events from local ephemeral failures such as request/bootstrap errors. Preserve representative fixtures so notice-state work is grounded in real payloads.
- **Complexity**: 6/10
- **Dependencies**: None
- **Acceptance Criteria**:
  - The plan distinguishes persisted session notices from locally generated failure banners.
  - At least one representative fixture exists for notice-oriented parser/render tests.
  - Speculative states are called out explicitly instead of being treated as guaranteed payloads.
- **Validation**:
  - Extend `scripts/tests/opencode-ui-session-store-regressions.test.ts`.
  - Re-run targeted OpenCode UI parser/message request regressions with the repo's `node --import tsx --test` flow.

### Task 1.2: Audit Part Variants And Preserve Interaction Card Invariants
- **Location**: `electron/opencode-ui-session/parser.ts`, `electron/opencode-ui-session/types.ts`, `src/js/pages/opencode-ui/types.ts`, `src/js/pages/opencode-ui/message-content.ts`, `src/js/pages/opencode-ui/chat-utils.ts`
- **Description**: Inventory which part variants are already handled (`text`, `reasoning`, `step-start`, `step-finish`, `patch`, `tool`, `file`) and explicitly preserve the `rovo-ui` interaction-card path for both persisted history and live send fallback.
- **Complexity**: 7/10
- **Dependencies**: Task 1.1
- **Acceptance Criteria**:
  - The interaction-card token path is treated as a first-class invariant, not an informal side effect.
  - Backward compatibility is preserved for sessions that only contain today's shape.
  - Parser changes do not break interactive cards in either history rendering or optimistic/live fallback.
- **Validation**:
  - Add or extend fixtures that cover `rovo-ui` token preservation.
  - Update `scripts/tests/opencode-ui-history-render-regressions.test.ts`.
  - Add a focused regression for persisted-history and live-fallback interaction-card handling.

### Task 1.3: Introduce Semantic Message And Attachment View Models
- **Location**: `src/js/pages/opencode-ui/types.ts`, `src/js/pages/opencode-ui/history-actions.ts`, `src/js/pages/opencode-ui/chat-utils.ts`, `src/js/pages/opencode-ui/attachments.ts`
- **Description**: Define renderer contracts that separate message author, content blocks, normalized attachments, tool groups, and notice states so UI composition becomes predictable across composer, optimistic render, and history render.
- **Complexity**: 6/10
- **Dependencies**: Task 1.2
- **Acceptance Criteria**:
  - History rendering can build UI from structured blocks instead of inferring layout directly from raw strings.
  - Attachment rendering stops depending on unrelated raw shapes such as `ComposerAttachment` or `{ name, media_type }` alone.
  - Future message blocks can be added without expanding `addMessage` into another multi-purpose function.
- **Validation**:
  - Add a focused regression for the new view-model mapping if the contract becomes its own helper.
  - Review DOM output manually in the Assistant page with a mixed-content session.

### Task 1.4: Carve Out Renderer Helpers And Refresh Snapshot Invalidation
- **Location**: `src/js/pages/opencode-ui/chat-utils.ts`, `src/js/pages/opencode-ui/render-actions.ts`, `src/js/pages/opencode-ui/message-content.ts`, optional new helper file under `src/js/pages/opencode-ui/`
- **Description**: Split message rendering into reusable sections such as header/meta, markdown body, notice banner, attachment rail, and tool/result stack, and update the live snapshot key so richer notices and attachments trigger rerenders.
- **Complexity**: 6/10
- **Dependencies**: Task 1.3
- **Acceptance Criteria**:
  - The main `addMessage` path becomes orchestration instead of one large DOM builder.
  - Historic render and optimistic render can share section builders where possible.
  - New notice blocks or richer attachment metadata are reflected in snapshot invalidation logic.
- **Validation**:
  - Run `scripts/tests/opencode-ui-history-render-regressions.test.ts`.
  - Add regression coverage for snapshot-key changes beyond text tail, tool names, and file count.

## Sprint 2: OpenCode-Like Timeline And Error/Limit Surfaces
**Goal**: Ship the core visual redesign for chat messages and make error conditions visible inside the conversation flow.
**Demo/Validation**:
- A mixed conversation visually resembles the OpenCode web UI hierarchy from the supplied references.
- Limit, retry, interrupted, and generic error states are visible without relying on console logs.

### Task 2.1: Render Structured Assistant Blocks More Faithfully
- **Location**: `src/js/pages/opencode-ui/chat-utils.ts`, `src/js/pages/opencode-ui/message-content.ts`, `src/js/pages/opencode-ui/history-actions.ts`
- **Description**: Render reasoning/step/patch/tool content as separate sections or grouped cards instead of flattening them into a single text blob wherever the data model allows it.
- **Complexity**: 8/10
- **Dependencies**: Sprint 1 complete
- **Acceptance Criteria**:
  - Assistant replies can mix markdown text, structured progress, and tool output without losing readability.
  - Historic tool-call host behavior still works when assistant text is empty.
  - Copy-to-clipboard output excludes decorative chrome and keeps the meaningful message text.
- **Validation**:
  - Update `scripts/tests/opencode-ui-history-render-regressions.test.ts`.
  - Add at least one regression covering mixed assistant text + tool output.

### Task 2.2: Redesign Message Bubble Layout
- **Location**: `src/styles/design-system/components/chat.css`, `src/styles/design-system/components/markdown.css`, `src/pages/opencode-ui.html`
- **Description**: Upgrade the bubble system with clearer grouping, richer spacing, role/meta hierarchy, better assistant/system contrast, and room for inline status callouts after the block structure is stabilized.
- **Complexity**: 7/10
- **Dependencies**: Task 2.1
- **Acceptance Criteria**:
  - User, assistant, tool, and notice content each have distinct but coherent visual treatment.
  - The design holds on desktop and mobile widths without clipping action buttons or metadata.
  - Existing design tokens remain the primary styling mechanism.
- **Validation**:
  - Manual smoke check in `npm run electron:dev:assistant`.
  - Visual compare against Image #1 on both wide and narrow layouts.

### Task 2.3: Surface Persisted Notices And Local Error States In-Chat
- **Location**: `electron/opencode-ui-session/parser.ts`, `electron/opencode-ui-session/types.ts`, `src/js/pages/opencode-ui/chat-utils.ts`, `src/js/pages/opencode-ui/app-bootstrap.ts`, `src/js/pages/opencode-ui/api.ts`
- **Description**: Parse structured failure or retry signals where available and map request-time/bootstrap failures into the same visual notice language so the UI shows "usage limit", "retrying", "interrupted", and "request failed" states like Image #2 without assuming all of those states come from persisted session data.
- **Complexity**: 8/10
- **Dependencies**: Tasks 1.1, 1.3, 2.2
- **Acceptance Criteria**:
  - API/network failures no longer appear only as generic assistant text strings.
  - Structured retry/attempt metadata, if present in session data, renders as a notice block with consistent severity styling.
  - Bootstrap/session-load errors use the same vocabulary and do not drift from timeline notices.
- **Validation**:
  - Add parser regressions for notice extraction.
  - Add UI regressions or string-match tests for the new notice render path.

## Sprint 3: Attachment Preview And Media UX
**Goal**: Replace chip-only attachment treatment with visual previews that make image-heavy workflows usable.
**Demo/Validation**:
- Composer attachments show thumbnail previews for images and better cards for non-image files.
- The send flow, remove flow, duplicate detection, and optimistic render all still work.

### Task 3.1: Upgrade Composer Attachment Tray From Chips To Preview Cards
- **Location**: `src/js/pages/opencode-ui/attachments.ts`, `src/js/pages/opencode-ui/composer-actions.ts`, `src/styles/design-system/components/chat.css`
- **Description**: Replace `renderAttachmentTrayHtml()` chip markup with attachment cards built on the normalized attachment view model, showing image thumbnails, file kind, size, source badge, and remove affordance.
- **Complexity**: 6/10
- **Dependencies**: Task 1.3
- **Acceptance Criteria**:
  - Image attachments display an actual preview instead of `IMG filename`.
  - Non-image files keep a compact but richer card layout.
  - Keyboard and screen-reader affordances still expose remove actions correctly.
- **Validation**:
  - Extend `scripts/tests/opencode-ui-message-request-regressions.test.ts` if payload assumptions change.
  - Manual paste/file-picker smoke test using Image #3 as the target behavior.

### Task 3.2: Preserve Preview Information Through Optimistic User Rendering
- **Location**: `src/js/pages/opencode-ui/composer-actions.ts`, `src/js/pages/opencode-ui/chat-utils.ts`, `src/js/pages/opencode-ui/types.ts`
- **Description**: Ensure the immediate user bubble shown after send can reuse preview metadata through the shared attachment render shape so attachments do not collapse back to generic chips during optimistic render.
- **Complexity**: 5/10
- **Dependencies**: Tasks 1.3, 3.1
- **Acceptance Criteria**:
  - A just-sent image still appears as a preview in the user message block before history sync catches up.
  - The optimistic path uses the same normalized attachment renderer as the composer tray where possible.
  - Copy-to-clipboard skips binary preview chrome and keeps only meaningful text/file labels.
- **Validation**:
  - Add a renderer regression for user messages with attachments.
  - Manual smoke test with mixed image + text submission.

### Task 3.3: Decide Historic Attachment Preview Strategy
- **Location**: `electron/opencode-ui-session/parser.ts`, `electron/opencode-ui-session/types.ts`, `src/js/pages/opencode-ui/history-actions.ts`, `scripts/tests/opencode-ui-session-store-regressions.test.ts`
- **Description**: Verify whether persisted session parts retain reusable image data (`url`, `data`, or `base64`). If yes, extend parser/types and reuse thumbnails in history; if not, keep history on enriched file cards and document the gap as a follow-up.
- **Complexity**: 7/10
- **Dependencies**: Task 1.1, Task 3.1
- **Acceptance Criteria**:
  - The implementation explicitly chooses between real history thumbnails and a safe fallback.
  - No hidden dependency on volatile clipboard data remains.
  - The chosen behavior is covered by a regression fixture.
- **Validation**:
  - Update `scripts/tests/opencode-ui-session-store-regressions.test.ts`.
  - Manual reload test after sending an image attachment.

## Sprint 4: I18n Completion, Polish, And Regression Coverage
**Goal**: Close localization gaps, harden the refactor with regressions, and leave the page ready for iteration without UI drift.
**Demo/Validation**:
- The page remains fully usable in both Turkish and English.
- The revised chat flow passes targeted regressions and manual smoke checks.

### Task 4.1: Complete OpenCode UI Translation Coverage
- **Location**: `shared/languages/tr/index.json`, `shared/languages/en/index.json`, `src/js/pages/opencode-ui/i18n.ts`
- **Description**: Add all new keys for notice states, attachment preview labels, empty/error/fallback copy, and eliminate remaining visible hard-coded strings already on screen such as attachment kind labels and tool-call chrome.
- **Complexity**: 5/10
- **Dependencies**: Sprints 2 and 3
- **Acceptance Criteria**:
  - No new user-visible string in the OpenCode UI is hard-coded outside the allowed fallback cases.
  - Both locale packs remain key-compatible.
  - Copy used in status notices and attachment UI stays concise and parallel between locales.
- **Validation**:
  - Run `scripts/tests/opencode-ui-language-sync-regressions.test.ts`.
  - Manual locale toggle smoke test.

### Task 4.2: Refresh Existing Regressions And Add Focused Coverage
- **Location**: `scripts/tests/opencode-ui-history-render-regressions.test.ts`, `scripts/tests/opencode-ui-session-store-regressions.test.ts`, `scripts/tests/opencode-ui-message-request-regressions.test.ts`, optional new `scripts/tests/opencode-ui-chat-render-regressions.test.ts`
- **Description**: Replace or supplement brittle string-match regressions that reflect old helper boundaries with behavior-level assertions for notice rendering, attachment previews, interaction-card preservation, and copy sanitization.
- **Complexity**: 6/10
- **Dependencies**: Tasks 2.2, 2.3, 3.1, 3.2
- **Acceptance Criteria**:
  - Regressions cover parser output, message rendering seams, and i18n key sync.
  - At least one test protects against attachment previews silently regressing back to chips.
  - Tests fail meaningfully if message notice extraction disappears.
  - Critical render coverage no longer depends only on source-regex matches that can go stale while behavior stays correct.
- **Validation**:
  - Run the updated targeted test files directly with `TSX_TSCONFIG_PATH=src/tsconfig.json node --import tsx --test ...`.

### Task 4.3: Final UX Polish And Smoke Checklist
- **Location**: `src/styles/design-system/components/chat.css`, `src/pages/opencode-ui.html`, `src/js/pages/opencode-ui/app.ts`
- **Description**: Fix any remaining spacing, overflow, focus, copy-button, and empty-state issues revealed by the redesign and document a short smoke checklist for future changes.
- **Complexity**: 4/10
- **Dependencies**: Tasks 4.1 and 4.2
- **Acceptance Criteria**:
  - No clipping or overlap remains in the toolbar, composer, or message list at common breakpoints.
  - Empty, loading, active, and failure states all feel intentionally designed.
  - The final smoke checklist covers send, error, retry, attachment preview, locale switch, and session reload.
- **Validation**:
  - Manual smoke pass in `npm run electron:dev:assistant`.
  - Optional screenshot capture for before/after comparison.

## Testing Strategy
- Reuse and extend current targeted regressions, but move critical render coverage toward behavior-level tests instead of source-regex checks alone.
- Use the repo's actual command shape for targeted suites: `TSX_TSCONFIG_PATH=src/tsconfig.json node --import tsx --test <files...>`.
- Treat the current `scripts/tests/opencode-ui-history-render-regressions.test.ts` suite as partially stale; refresh it early instead of assuming it is a stable guardrail today.
- Minimum automated pass after the implementation:
  - `scripts/tests/opencode-ui-session-store-regressions.test.ts`
  - `scripts/tests/opencode-ui-history-render-regressions.test.ts`
  - `scripts/tests/opencode-ui-message-request-regressions.test.ts`
  - `scripts/tests/opencode-ui-language-sync-regressions.test.ts`
  - `scripts/tests/opencode-ui-loading-readiness-regressions.test.ts`
  - `scripts/tests/assistant-opencode-ui-session-resume-regressions.test.ts`
  - `scripts/tests/assistant-opencode-ui-adapter-regressions.test.ts` if embed behavior, query params, or host handshake change
- Minimum manual pass after each sprint:
  - Open Assistant page and verify the OpenCode UI loads without layout collapse.
  - Send plain text, mixed text + attachment, and failure-path requests.
  - Validate both Turkish and English copy.
  - Reload the session and confirm history still renders coherently.

## Potential Risks & Gotchas
- Persisted OpenCode session rows may not retain enough image payload data for true history thumbnails; if so, composer previews can ship first while history stays on enriched file cards.
- Limit/retry states may be emitted through API errors, message rows, or part metadata depending on provider behavior; the normalization layer must avoid assuming one source.
- The `rovo-ui` token path is an integration boundary, not just another assistant text variant; parser/render refactors can silently break interaction cards if that invariant is not tested explicitly.
- Existing regex-heavy regressions are brittle and may need to be rewritten around new helper names rather than patched line-by-line.
- Copy-to-clipboard behavior can accidentally include tool-call chrome, notice labels, or attachment metadata unless explicitly filtered.
- The current `addMessage()` optimistic path is tightly coupled to plain strings; if refactored too late, it can become the main blocker for the visual work.
- Larger preview cards can change the embedded Assistant page's scroll/height behavior; if the host shell assumes current message density, adapter-side regressions may appear even without API changes.

## Additional Recommendations
- Add a compact session activity rail that surfaces message count, last error, and pending retry state in the left sidebar.
- Add collapsible sections for verbose reasoning or large tool output so the timeline stays scannable on long sessions.
- Add image lightbox behavior for attachment previews if history thumbnails become available.
- Add a "copy as plain text" and "copy with tool transcript" split for assistant messages so power users can choose the export depth.
- Consider introducing a fixture-driven DOM regression snapshot for the OpenCode UI page once the new renderer settles; the current string-match tests will likely become too fragile.

## Rollback Plan
- Keep the current parser and renderer seams isolated behind incremental commits so data-shape changes can be reverted without discarding the CSS work.
- If the new renderer destabilizes history sync, temporarily keep the old history path while shipping the composer attachment preview first.
- If true history thumbnails require unavailable session payload data, roll back to rich file cards and keep thumbnail support limited to staged/optimistic attachments.
- If the redesign causes layout regressions in Assistant page embed mode, revert `chat.css` and `chat-utils.ts` together as a pair rather than partially.
