# Plan: Webview Generated Image Sync

**Generated**: 2026-03-31
**Estimated Complexity**: High

## Overview
Add generated-image archiving to the existing webview sync pipeline so provider-produced images are saved to disk the same way outbound attachments are archived today, then surface those saved images in the Analyze page as medium thumbnails that open with the operating system default app on click.

The safest path is to reuse the current attachment storage model instead of inventing a second media store:
- Keep saving files under the existing per-account/per-conversation/per-message attachment path.
- Treat generated images as assistant-side attachments linked to the assistant message that owns them.
- Extend the scraper/sync contract so image candidates travel with the scraped assistant message metadata.
- Persist image bytes through a new IPC bridge that exposes the already-existing `saveAttachmentContent(...)` archive capability.

## Audit Update
**Reviewed**: 2026-03-31
**Current Status**: Implemented with follow-up hardening in progress

### Completed
- `generatedImages` is now part of the scraped assistant-message contract.
- Binary attachment persistence is exposed through `dbSaveAttachmentContent`.
- Analyze normalizes attachment DTOs and renders `image/*` attachments as clickable thumbnails.
- Base regression coverage exists for sync persistence, Analyze rerender rules, and provider-tester full-sync persistence.

### Added From Audit
- Add a stable generated-image key that does not depend on preview/final `src` swaps.
- Make attachment persistence replace/update the existing generated-image record when the same assistant message/image slot is re-synced with new bytes.
- Add a real webview-targeted screenshot seam instead of relying only on app-window crop fallback.
- Add a dedicated post-thinking generated-image probe window so sync can wait briefly for delayed image materialization.
- Add a scenario-level archive assertion for generated-image runs in provider tester.
- Expand regressions for failure isolation, preview->final replacement, and fallback capture routing.

### Still Manual
- Manual smoke remains required for at least one real provider run:
  - generate an image
  - observe stop button -> normal button transition
  - verify saved file path on disk
  - verify Analyze thumbnail render and OS open behavior

## Assumptions
- In scope providers are the sync-enabled providers that already expose a `generatedImage` selector: ChatGPT, Gemini, and Grok.
- OpenCode and OpenCode UI stay out of scope unless they gain generated-image DOM support later.
- Analyze should keep the current attachment button behavior for non-image files.
- Image thumbnails should be medium-sized, clickable, and backed by the saved local file, not the remote provider URL.
- If the original image bytes cannot be fetched reliably from the page DOM, the fallback path can archive a cropped screenshot of the rendered image element rather than losing the asset entirely.

## Prerequisites
- Existing attachment archive flow remains the source of truth:
  - `src/js/modules/webview/pending-archive-handler.ts`
  - `electron/database/sqlite-archive.ts`
  - `electron/database/index.ts`
  - `electron/handlers/ipc-database.ts`
  - `electron/preload.cjs`
  - `electron/types/index.ts`
  - `src/types/ipc-channels.ts`
- Existing Analyze attachment rendering remains the presentation base:
  - `src/js/pages/analyze/message-renderer.ts`
  - `src/js/pages/analyze/message-renderer-bubble.ts`
  - `src/js/pages/analyze/message-renderer-types.ts`
  - `src/styles/analyze.css`
- Existing provider test image checks remain the validation entry point:
  - `electron/provider-tester/scraping-tests.ts`
  - `electron/provider-tester/index.ts`
  - `src/js/modules/webview/providers/*/config.ts`

## Sprint 1: Define the Sync and Archive Contract
**Goal**: Make generated images first-class sync artifacts without changing the existing archive storage model.
**Demo/Validation**:
- A mocked sync payload can describe assistant-side generated images per message.
- The archive layer can accept image bytes without requiring a source file path.

### Task 1.1: Extend the scraped message contract for generated assets
- **Location**:
  - `src/types/provider.ts`
  - `src/js/modules/webview/conversation-syncer.ts`
  - `src/js/modules/webview/providers/chatgpt/scraper.ts`
  - `src/js/modules/webview/providers/gemini/scraper.ts`
  - `src/js/modules/webview/providers/grok/scraper.ts`
- **Description**: Add a provider-neutral generated-image payload shape to scraped assistant messages. The payload should carry enough data to match the asset back to the saved DB message and to persist the image later.
- **Complexity**: 6/10
- **Dependencies**: None
- **Acceptance Criteria**:
  - Scraped assistant messages can include `generatedImages`.
  - Each generated image record includes stable matching context such as `domId` or `domIndex + contentHash`.
  - Each generated image record includes the best available extraction source, such as `src`, `alt`, `mimeType`, and provider-local filename hint.
- **Validation**:
  - Targeted unit coverage for scraper return shape.
  - Regression update in `scripts/tests/provider-config-scenario-regressions.test.ts` if shared scenario assumptions change.

### Task 1.2: Expose binary attachment save through IPC
- **Location**:
  - `electron/database/index.ts`
  - `electron/handlers/ipc-database.ts`
  - `electron/preload.cjs`
  - `electron/types/index.ts`
  - `src/types/ipc-channels.ts`
  - `src/js/global.d.ts`
- **Description**: Add a renderer-safe IPC bridge for `saveAttachmentContent(...)` so sync can persist generated image bytes directly without writing an intermediate source file first.
- **Complexity**: 4/10
- **Dependencies**: Task 1.1
- **Acceptance Criteria**:
  - Renderer code can call a new `dbSaveAttachmentContent`-style bridge.
  - The bridge accepts `accountId`, `conversationId`, `messageId`, `originalName`, `mimeType`, and encoded image bytes.
  - The bridge returns the same attachment identity data shape as `dbSaveAttachment`.
- **Validation**:
  - Handler smoke test or focused database regression.
  - Syntax/typecheck across preload and renderer declarations.

### Task 1.3: Document the matching strategy between scraped messages and stored DB messages
- **Location**:
  - `src/js/modules/webview/conversation-syncer.ts`
  - `electron/database/sqlite-archive.ts`
- **Description**: Lock down how generated images will be attached to the correct assistant message after `dbSyncMessages`. Prefer `domId` when present, then fall back to `domIndex + contentHash`.
- **Complexity**: 5/10
- **Dependencies**: Task 1.1
- **Acceptance Criteria**:
  - The plan for matching is encoded in code comments or helper naming, not left implicit.
  - Message matching works for both `content-hash` and `dom-id` providers.
  - The sync path can distinguish user attachments from assistant-generated images.
- **Validation**:
  - Add or update `scripts/tests/conversation-syncer-regressions.test.ts`.

## Sprint 2: Capture and Persist Generated Images During Sync
**Goal**: Save provider-generated images to disk as soon as the assistant response is stable enough to sync.
**Demo/Validation**:
- Running sync after an image generation response stores at least one image attachment in the archive.
- Re-running sync does not duplicate the same saved image for the same assistant message.

### Task 2.1: Build a generated-image extraction helper
- **Location**:
  - New helper near `src/js/modules/webview/providers/shared/`
  - Provider scrapers under `src/js/modules/webview/providers/*/scraper.ts`
  - If screenshot fallback is retained, add the capture seam near `electron/handlers/ipc-provider.ts` or another webview-specific Electron bridge
- **Description**: Normalize provider DOM extraction into a shared helper that can collect image metadata and bytes from data URLs, blob URLs, or authenticated remote URLs. Include a defined fallback path for screenshot-based capture when byte extraction fails.
- **Complexity**: 8/10
- **Dependencies**: Sprint 1 complete
- **Acceptance Criteria**:
  - Extraction strategy order is explicit: direct data URL, page-context fetch/blob read, screenshot fallback.
  - The helper returns a consistent payload for ChatGPT, Gemini, and Grok.
  - Screenshot fallback is backed by a real webview-targeted capture seam, not only the current app-window `capturePage` helper.
  - Failures are isolated per image and logged without aborting the whole sync.
- **Validation**:
  - Unit-level coverage for extractor normalization helpers.
  - Manual provider smoke for at least one real generated image.

### Task 2.2: Persist generated images after message sync
- **Location**:
  - `src/js/modules/webview/conversation-syncer.ts`
  - `src/js/modules/webview/pending-archive-handler.ts` or a new adjacent helper dedicated to post-sync generated media
- **Description**: After `dbSyncMessages` returns and DB messages are reloaded, resolve the target assistant message IDs and save generated images through the new content-save bridge.
- **Complexity**: 8/10
- **Dependencies**: Task 2.1
- **Acceptance Criteria**:
  - Generated images are saved under the existing attachment directory structure.
  - Saves are linked to the owning assistant message ID.
  - Duplicate sync runs do not keep inserting the same generated image rows.
  - Providers that swap a temporary preview for the final image do not leave multiple stale copies unless the final asset is genuinely different.
  - Dedupe is enforced before save because the current attachment IDs are timestamp-based and the attachments table does not prevent duplicate rows by itself.
  - Failures to save one image do not block message sync completion.
- **Validation**:
  - Extend `scripts/tests/conversation-syncer-regressions.test.ts` with generated-image persistence cases.
  - Add targeted DB verification around `dbGetAttachments`.

### Task 2.3: Handle the “stop thinking -> normal send button” transition safely
- **Location**:
  - `src/js/modules/webview/conversation-syncer.ts`
  - `electron/provider-tester/interactive-tests.ts`
  - `electron/provider-tester/scraping-tests.ts`
- **Description**: Refine readiness so sync does not miss the image when the provider leaves the thinking state before the generated image node becomes queryable. This may require a short post-thinking image probe window when a generated-image selector exists.
- **Complexity**: 7/10
- **Dependencies**: Task 2.2
- **Acceptance Criteria**:
  - Sync still retries when assistant text is not yet readable.
  - Providers with generated-image selectors can wait a bounded extra window for image materialization after stop-button disappearance.
  - Fast text-only responses do not get slower without reason.
- **Validation**:
  - Provider tester warning/pass behavior updated for image generation.
  - Regression coverage for retry scheduling logic.

## Sprint 3: Render Saved Images in Analyze
**Goal**: Show archived generated images inline in Analyze as clickable medium thumbnails while preserving existing attachment behavior.
**Demo/Validation**:
- Analyze shows image thumbnails under the assistant message that generated them.
- Clicking a thumbnail opens the saved local file with the system default application.

### Task 3.1: Enrich Analyze attachment model with image metadata
- **Location**:
  - `src/js/pages/analyze/message-renderer-types.ts`
  - `src/js/pages/analyze/render-cache.ts`
  - `src/js/pages/analyze/message-renderer.ts`
  - Reuse or mirror mapping logic from `src/js/pages/archives/ipc-mappers.ts` if practical
- **Description**: Extend the Analyze attachment model to carry `mimeType` and any other minimal fields required to distinguish image attachments from regular files.
- **Complexity**: 3/10
- **Dependencies**: Sprint 2 complete
- **Acceptance Criteria**:
  - Analyze can identify `image/*` attachments without guessing from filename.
  - Raw IPC attachment rows are normalized consistently if the database layer returns snake_case fields such as `message_id` and `mime_type`.
  - Render cache invalidation includes any new fields that affect thumbnail rendering.
- **Validation**:
  - Targeted render-cache regression if hash inputs change.
  - Syntax/typecheck.

### Task 3.2: Render medium thumbnails for image attachments
- **Location**:
  - `src/js/pages/analyze/message-renderer-bubble.ts`
  - `src/styles/analyze.css`
- **Description**: Replace image attachments’ plain button-only presentation with a thumbnail card that still behaves like a file opener. Non-image attachments remain text buttons.
- **Complexity**: 5/10
- **Dependencies**: Task 3.1
- **Acceptance Criteria**:
  - Image attachments render as medium thumbnails inside the message bubble.
  - Thumbnail click opens `storedPath` via `openPath`, same as double-click/open behavior.
  - Broken or missing image files degrade to the existing attachment button style.
  - The layout remains readable for multiple images in one assistant message.
- **Validation**:
  - Manual Analyze page smoke with 1 image, multiple images, and non-image attachments.
  - Visual sanity check for long conversations and narrow widths.

### Task 3.3: Keep virtualization and incremental append stable
- **Location**:
  - `src/js/pages/analyze/message-renderer.ts`
  - `src/js/pages/analyze/render-cache.ts`
- **Description**: Confirm the thumbnail UI does not break virtual scrolling, append optimization, or rerender skip heuristics.
- **Complexity**: 4/10
- **Dependencies**: Task 3.2
- **Acceptance Criteria**:
  - Incremental append still works when a newly appended assistant message includes image attachments.
  - Existing bubbles are rerendered when attachment state changes from zero to one or more images.
  - Auto-scroll behavior remains predictable.
- **Validation**:
  - Targeted Analyze render regression.
  - Manual smoke in a conversation larger than `VISIBLE_MESSAGE_COUNT`.

## Sprint 4: Regression Coverage and Operational Validation
**Goal**: Prove the new flow works in both mocked and real provider paths.
**Demo/Validation**:
- Automated tests cover message matching, attachment persistence, and UI render branching.
- Provider test workflow can detect generated images and confirm sync archived them.

### Task 4.1: Add sync regressions for generated-image archiving
- **Location**:
  - `scripts/tests/conversation-syncer-regressions.test.ts`
  - Any new focused regression file if needed
- **Description**: Add tests for assistant-generated image extraction, assistant message matching, dedupe, and save ordering.
- **Complexity**: 6/10
- **Dependencies**: Sprints 1-3 complete
- **Acceptance Criteria**:
  - Tests cover `domId` providers and `contentHash` providers.
  - Tests cover no-image, one-image, and duplicate-sync cases.
  - Tests cover failure isolation when one image save fails.
- **Validation**:
  - Run targeted Node regression suite.

### Task 4.2: Extend provider tester assertions for sync-backed image capture
- **Location**:
  - `electron/provider-tester/index.ts`
  - `electron/provider-tester/scraping-tests.ts`
  - `scripts/tests/provider-scenario-ipc-regressions.test.ts`
  - `scripts/tests/provider-config-scenario-regressions.test.ts`
- **Description**: Add a scenario-level check that a generated image was not only visible in the DOM but also made it into the archived conversation attachments after sync.
- **Complexity**: 7/10
- **Dependencies**: Task 4.1
- **Acceptance Criteria**:
  - Existing `assert-generated-image` behavior remains intact.
  - A follow-up sync assertion can verify attachment persistence for image-generation runs.
  - Sync mode differences (`soft`, `full`, `clean`) remain compatible.
- **Validation**:
  - Update scenario IPC/config regressions.
  - Run the provider scenario flow for at least one supported provider manually.

### Task 4.3: Manual smoke checklist
- **Location**: N/A
- **Description**: Execute a short manual verification pass to cover real provider DOM behavior and Analyze UX.
- **Complexity**: 2/10
- **Dependencies**: All implementation tasks complete
- **Acceptance Criteria**:
  - Generate an image in at least one supported provider.
  - Observe stop button -> normal button transition without losing the image in sync.
  - Confirm saved file exists on disk under the expected attachment path.
  - Confirm Analyze renders the thumbnail and OS open works.
- **Validation**:
  - Short smoke log in PR description or task notes.

## Testing Strategy
- Unit/regression test the sync contract before touching UI polish.
- Keep message matching tests provider-agnostic by covering both `domId` and `contentHash` flows.
- Add at least one regression around duplicate sync so archived images do not multiply.
- Add at least one regression around attachment DTO normalization so Analyze does not silently drop valid rows from `dbGetAttachments`.
- Run targeted tests for:
  - `scripts/tests/conversation-syncer-regressions.test.ts`
  - `scripts/tests/analyze-render-cache-regressions.test.ts`
  - `scripts/tests/provider-config-scenario-regressions.test.ts`
  - `scripts/tests/provider-scenario-ipc-regressions.test.ts`
  - Any Analyze render regression affected by attachment hashing or bubble rendering
- Run `npm run typecheck` after the full change set.

## Potential Risks & Gotchas
- Remote image URLs may be short-lived or require page cookies, so direct fetch may fail after the DOM settles.
- Canvas extraction can fail on cross-origin images, so screenshot fallback must be planned rather than improvised.
- Message matching can drift if a provider mutates text after the image appears; using only content hash would be fragile.
- Some providers may first render a low-resolution preview and later swap `src`, so dedupe cannot rely only on message ID.
- Gemini is marked `webviewSync.readiness = estimated`, so selector stability is lower than ChatGPT/Grok.
- Analyze virtualization can miss rerenders if new thumbnail-relevant fields are not included in attachment hashing.
- Large image sets can bloat the archive quickly; saving originals is correct, but future quota/cleanup policy may be needed.

## Rollback Plan
- Revert the new generated-image extraction and persistence seam while leaving existing outbound attachment archiving untouched.
- Keep the new IPC content-save bridge isolated so it can be disabled without affecting `dbSaveAttachment`.
- If Analyze thumbnails cause regressions, fall back to the current attachment-button rendering while preserving archived image files in the database.

## Suggested Delivery Order
1. Ship the content-save IPC bridge and generated-image message contract.
2. Implement post-sync image persistence with dedupe and fallback extraction.
3. Add Analyze thumbnail rendering on top of archived image attachments.
4. Finish with provider tester and regression updates.
