# Webview Scenario Engine Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Refactor the current provider test flow into a generic webview scenario engine, keep `webview-test` as the first scenario, and prepare the app for a future config-driven `webview-sync` scenario.

**Architecture:** Extract the current provider-test runner into a generic Electron scenario engine plus shared renderer presentation helpers. Keep the current AI1/AI2 opposite-slot overlay and AI0 side panel UX, but route them through scenario-oriented types and IPC so `webview-test` becomes a scenario definition instead of hard-wired product logic.

**Tech Stack:** TypeScript, Electron IPC, renderer webview panels, provider config modules, Node regression tests under `scripts/tests/`.

---

### Task 1: Add failing tests for generic scenario engine types and progress events

**Files:**

- Modify: `scripts/tests/provider-test-scenario-runner-regressions.test.ts`
- Modify: `src/types/provider.ts`
- Modify: `electron/provider-tester/scenario-runner.ts`

**Step 1: Write the failing test**

- Assert the runner can emit generic scenario progress metadata instead of provider-test-only step events.
- Assert scenario identity is present in progress payloads so future scenarios like `webview-sync` can share the same runner.

**Step 2: Run test to verify it fails**

- Run: `node --test scripts/tests/provider-test-scenario-runner-regressions.test.ts`
- Expected: FAIL because the current runner only models provider-test-specific progress.

**Step 3: Write minimal implementation**

- Introduce generic scenario event and report types in `src/types/provider.ts`.
- Generalize `electron/provider-tester/scenario-runner.ts` so it runs named scenarios and still preserves current provider-test behavior.

**Step 4: Run test to verify it passes**

- Run: `node --test scripts/tests/provider-test-scenario-runner-regressions.test.ts`
- Expected: PASS.

### Task 2: Add failing tests for shared scenario presentation helpers

**Files:**

- Modify: `scripts/tests/provider-test-presentation-regressions.test.ts`
- Modify: `src/js/pages/shared/provider-test-presentation.ts`

**Step 1: Write the failing test**

- Assert the shared presentation helpers can describe generic webview scenario overlays, not only provider-test wording.
- Assert opposite-slot overlay hosting still resolves correctly for `ai1` and `ai2`.

**Step 2: Run test to verify it fails**

- Run: `node --test scripts/tests/provider-test-presentation-regressions.test.ts`
- Expected: FAIL because the helper naming and summary copy are provider-test specific.

**Step 3: Write minimal implementation**

- Generalize the presentation helper exports and wording so multiple webview scenarios can reuse them.
- Keep backwards-compatible behavior for the current `webview-test` launcher.

**Step 4: Run test to verify it passes**

- Run: `node --test scripts/tests/provider-test-presentation-regressions.test.ts`
- Expected: PASS.

### Task 3: Add failing tests for renderer scenario overlay flow

**Files:**

- Modify: `scripts/tests/provider-test-overlay-flow-regressions.test.ts`
- Modify: `src/js/pages/entrance/webview-panel.ts`
- Modify: `src/js/pages/asistan/index.ts`
- Modify: `src/styles/entrance/test.css`
- Modify: `src/styles/asistan.css`

**Step 1: Write the failing test**

- Assert the opposite-slot overlay remains the host for entrance scenarios.
- Assert the overlay covers the full opposite slot panel instead of only a smaller centered surface.
- Assert the renderer still keeps results in the overlay/panel after completion.

**Step 2: Run test to verify it fails**

- Run: `node --test scripts/tests/provider-test-overlay-flow-regressions.test.ts`
- Expected: FAIL because the current overlay sizing and copy are still test-specific.

**Step 3: Write minimal implementation**

- Refactor entrance/asistan renderer state to model generic scenario panels/overlays.
- Update styles so the opposite-slot overlay fills the whole target slot panel while preserving scrollable result lists.

**Step 4: Run test to verify it passes**

- Run: `node --test scripts/tests/provider-test-overlay-flow-regressions.test.ts`
- Expected: PASS.

### Task 4: Add failing tests for Electron IPC and `webview-test` scenario bootstrapping

**Files:**

- Create: `scripts/tests/provider-scenario-ipc-regressions.test.ts`
- Modify: `electron/handlers/ipc-provider.ts`
- Modify: `electron/preload.cjs`
- Modify: `src/js/global.d.ts`
- Modify: `src/types/ipc-channels.ts`
- Modify: `electron/provider-tester/index.ts`
- Modify: `electron/provider-tester/types.ts`

**Step 1: Write the failing test**

- Assert the IPC layer exposes a generic scenario entry point and progress channel payload shape.
- Assert `webview-test` remains wired as the first supported scenario without breaking current renderer callers.

**Step 2: Run test to verify it fails**

- Run: `node --test scripts/tests/provider-scenario-ipc-regressions.test.ts`
- Expected: FAIL because only `test-provider` exists today.

**Step 3: Write minimal implementation**

- Introduce a generic scenario invocation path in preload/global typings and IPC.
- Keep `test-provider` as a compatibility wrapper if needed, but route it through the generic scenario path.
- Rename or reshape Electron-side runner types so `webview-test` is a scenario definition instead of a hardcoded suite.

**Step 4: Run test to verify it passes**

- Run: `node --test scripts/tests/provider-scenario-ipc-regressions.test.ts`
- Expected: PASS.

### Task 5: Add failing tests for provider-config scenario support

**Files:**

- Create: `scripts/tests/provider-config-scenario-regressions.test.ts`
- Modify: `src/types/provider.ts`
- Modify: `src/js/modules/webview/providers/chatgpt/config.ts`
- Modify: `src/js/modules/webview/providers/grok/config.ts`
- Modify: `src/js/modules/webview/providers/gemini/config.ts`
- Modify: `src/js/modules/webview/providers/opencode/config.ts`
- Modify: `src/js/modules/webview/providers/opencode-ui/config.ts`

**Step 1: Write the failing test**

- Assert provider configs can declare scenario metadata for `webview-test` in a stable schema.
- Assert providers without custom scenario overrides still keep current runtime fields intact.

**Step 2: Run test to verify it fails**

- Run: `node --test scripts/tests/provider-config-scenario-regressions.test.ts`
- Expected: FAIL because provider configs do not expose scenario definitions yet.

**Step 3: Write minimal implementation**

- Add scenario definition types to provider config types.
- Seed provider configs with `webviewTest` scenario metadata and preset-action step definitions that match the current provider test flow.

**Step 4: Run test to verify it passes**

- Run: `node --test scripts/tests/provider-config-scenario-regressions.test.ts`
- Expected: PASS.

### Task 6: Final verification

**Files:**

- Verify all changed TypeScript files and regression suites

**Step 1: Run targeted regression tests**

- Run the updated scenario runner, presentation, overlay flow, IPC, and provider-config regression tests.

**Step 2: Run diagnostics**

- Check changed TypeScript files for diagnostics.

**Step 3: Run project verification**

- Run: `npm run check-types`
- Run: `npm run build`

**Step 4: Summarize outcome**

- Report changed files, scenario engine behavior, compatibility notes, and any remaining follow-up for `webview-sync`.

### Task 7: Add failing tests for `webview-sync` mode selection and runtime branching

**Files:**

- Modify: `scripts/tests/provider-scenario-ipc-regressions.test.ts`
- Modify: `scripts/tests/provider-test-overlay-flow-regressions.test.ts`
- Modify: `src/js/pages/entrance/webview-panel.ts`
- Modify: `electron/handlers/ipc-provider.ts`
- Modify: `src/js/global.d.ts`

**Step 1: Write the failing test**

- Assert the entrance overlay exposes `soft`, `full`, and `clean` mode choices for `webview-sync`.
- Assert the selected mode is passed through `runProviderScenario(...)` into `ProviderTester` creation.
- Assert `ProviderTester` branches to the correct sync routine after each URL reaches loading idle.

**Step 2: Run test to verify it fails**

- Run: `node --test scripts/tests/provider-scenario-ipc-regressions.test.ts scripts/tests/provider-test-overlay-flow-regressions.test.ts`
- Expected: FAIL because sync mode selection and branching do not exist yet.

**Step 3: Write minimal implementation**

- Add a sync-mode state field to the entrance overlay for `webview-sync`.
- Propagate the selected mode through preload/global types and IPC request handling.
- Teach `ProviderTester` to execute `soft`, `full`, or `clean` post-load behavior.

**Step 4: Run test to verify it passes**

- Run: `node --test scripts/tests/provider-scenario-ipc-regressions.test.ts scripts/tests/provider-test-overlay-flow-regressions.test.ts`
- Expected: PASS.

### Task 8: Add failing tests for conversation metadata upsert and title ownership

**Files:**

- Create: `scripts/tests/provider-sync-db-regressions.test.ts`
- Modify: `electron/database/sqlite-manager.ts`
- Modify: `electron/database/sqlite-archive.ts`
- Modify: `electron/database/index.ts`

**Step 1: Write the failing test**

- Assert sync metadata upsert creates conversation rows for `soft` mode without message history.
- Assert synced titles can update non-user-owned rows, but user-renamed titles stay unchanged.
- Assert `clean` resets message rows while preserving the conversation row and protected title metadata.

**Step 2: Run test to verify it fails**

- Run: `node --test scripts/tests/provider-sync-db-regressions.test.ts`
- Expected: FAIL because the DB helpers and title ownership fields do not exist yet.

**Step 3: Write minimal implementation**

- Add schema support for tracking title ownership.
- Add DB helpers for conversation metadata upsert and clean message reset.
- Keep existing archive/message sync behavior compatible for old callers.

**Step 4: Run test to verify it passes**

- Run: `node --test scripts/tests/provider-sync-db-regressions.test.ts`
- Expected: PASS.

### Task 9: Add failing tests for actual post-load sync execution

**Files:**

- Modify: `scripts/tests/provider-scenario-ipc-regressions.test.ts`
- Modify: `electron/provider-tester/index.ts`
- Modify: `src/js/app/index.ts`
- Modify: `src/js/global.d.ts`

**Step 1: Write the failing test**

- Assert `soft` refreshes the conversation list after metadata upsert.
- Assert `full` scrapes messages, syncs DB content, and refreshes the list.
- Assert `clean` resets stored messages before running the same full sync path.

**Step 2: Run test to verify it fails**

- Run: `node --test scripts/tests/provider-scenario-ipc-regressions.test.ts`
- Expected: FAIL because post-load sync hooks do not run yet.

**Step 3: Write minimal implementation**

- Reuse the provider scraper in `ProviderTester` to sync message history for `full`/`clean`.
- Refresh the renderer conversation list after sync via a safe shell bridge.
- Keep progress reporting and partial-failure handling aligned with the current scenario engine.

**Step 4: Run test to verify it passes**

- Run: `node --test scripts/tests/provider-scenario-ipc-regressions.test.ts`
- Expected: PASS.

### Task 10: Final verification for sync modes

**Files:**

- Verify all changed TypeScript files and regression suites

**Step 1: Run targeted regression tests**

- Run: `node --test scripts/tests/provider-scenario-ipc-regressions.test.ts scripts/tests/provider-test-overlay-flow-regressions.test.ts scripts/tests/provider-sync-db-regressions.test.ts`

**Step 2: Run diagnostics**

- Check changed TypeScript files for diagnostics.

**Step 3: Run project verification**

- Run: `node --test scripts/tests/provider-test-scenario-runner-regressions.test.ts scripts/tests/provider-test-presentation-regressions.test.ts scripts/tests/provider-test-overlay-flow-regressions.test.ts scripts/tests/provider-scenario-ipc-regressions.test.ts scripts/tests/provider-config-scenario-regressions.test.ts scripts/tests/provider-sync-db-regressions.test.ts`
- Run: `npm run check-types`
- Run: `npm run build`

**Step 4: Summarize outcome**

- Report sync mode UX, persistence behavior, title protection behavior, and any remaining follow-up.
