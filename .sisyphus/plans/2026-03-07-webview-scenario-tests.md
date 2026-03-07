# Webview Scenario Tests Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Replace the current selector-centric provider test flow with a shared scenario runner that executes visible, step-based webview tests for `ai0`, `ai1`, and `ai2`.

**Architecture:** Keep a shared Electron-side scenario engine under `electron/provider-tester/` and split responsibilities into shell/UI checks versus provider-config actions. Renderer pages host the visible progress surfaces: opposite-slot overlay for Entrance (`ai1`/`ai2`) and a side panel for Asistan (`ai0`).

**Tech Stack:** Electron IPC, TypeScript, existing provider config registry, renderer page controllers, existing regression tests under `scripts/tests/`.

---

### Task 1: Add failing tests for the new scenario result contract

**Files:**

- Test: `scripts/tests/` regression tests for provider tester / entrance / asistan flows
- Modify: `src/types/provider.ts`
- Modify: `src/types/ipc-channels.ts`

**Step 1: Write failing tests**

- Add tests for a scenario-oriented result shape with ordered steps, live status, and slot-aware surface metadata.
- Add tests that assert `test-provider` supports scenario progress metadata for `ai0`, `ai1`, and `ai2`.

**Step 2: Run targeted tests to verify failure**

- Run the minimal regression test commands for the new expectations.

**Step 3: Add minimal type changes**

- Extend provider test types with scenario step metadata and optional progress presentation fields.

**Step 4: Re-run targeted tests**

- Confirm the new type/contract tests pass or move to the next failing behavior.

### Task 2: Add failing tests for the Electron scenario engine flow

**Files:**

- Test: provider tester regression test file(s) under `scripts/tests/`
- Modify: `electron/provider-tester/index.ts`
- Modify: `electron/provider-tester/types.ts`
- Modify: `electron/provider-tester/utils.ts`

**Step 1: Write failing tests**

- Assert ordered steps: reset/default page, loading start/end, disabled send, message inject, enabled send, send/stop/thinking, final bubbles, scroll behavior.
- Assert optional capabilities become `skip`/`warning` instead of failing the whole run.

**Step 2: Run targeted tests to verify failure**

- Run only the new provider tester regression coverage.

**Step 3: Implement minimal scenario engine**

- Replace the current category runner with a step runner that emits deterministic step results and respects fail-fast core steps.

**Step 4: Re-run targeted tests**

- Confirm the scenario ordering and severity behavior passes.

### Task 3: Add failing tests for IPC integration and transient reset behavior

**Files:**

- Test: IPC/provider handler regression coverage under `scripts/tests/`
- Modify: `electron/handlers/ipc-provider.ts`

**Step 1: Write failing tests**

- Assert `test-provider` resolves slot webviews, injects the right provider config, and passes transient run options without mutating persisted resume-session settings.

**Step 2: Run targeted tests to verify failure**

- Run only the IPC/provider regression tests.

**Step 3: Implement minimal IPC changes**

- Wire slot-specific scenario options and any progress callback plumbing needed by the renderer.

**Step 4: Re-run targeted tests**

- Confirm the IPC flow passes.

### Task 4: Add failing tests for Entrance live progress UI

**Files:**

- Test: Entrance/webview-panel regression tests under `scripts/tests/`
- Modify: `src/js/pages/entrance/webview-panel.ts`

**Step 1: Write failing tests**

- Assert test launch moves from the tiny slot button to the overlay action.
- Assert progress for `ai1` renders on `ai2` overlay and vice versa.
- Assert the tested slot stays visible while the opposite overlay shows step progress.

**Step 2: Run targeted tests to verify failure**

- Run the relevant Entrance regression suite.

**Step 3: Implement minimal UI changes**

- Add overlay launcher/progress rendering helpers and wire them to the scenario events.

**Step 4: Re-run targeted tests**

- Confirm the Entrance presenter behavior passes.

### Task 5: Add failing tests for Asistan side-panel progress UI

**Files:**

- Test: Asistan regression tests under `scripts/tests/`
- Modify: `src/js/pages/asistan/index.ts`
- Modify: `src/js/pages/asistan/test-results-modal.ts`

**Step 1: Write failing tests**

- Assert `ai0` uses a visible side panel instead of a hidden/kickoff-only button flow.
- Assert step progress is visible while the `ai0` webview remains usable/visible.

**Step 2: Run targeted tests to verify failure**

- Run the relevant Asistan regression tests.

**Step 3: Implement minimal side-panel presenter**

- Add side-panel launcher/progress rendering and keep the existing final result modal as the post-run detail view.

**Step 4: Re-run targeted tests**

- Confirm the Asistan presenter behavior passes.

### Task 6: Add scroll-shrinking and deterministic prompt behavior

**Files:**

- Modify: `electron/provider-tester/interactive-tests.ts`
- Modify: `electron/provider-tester/scraping-tests.ts`
- Modify: `electron/provider-tester/types.ts`

**Step 1: Write failing tests**

- Assert the deterministic prompt requests line-by-line `1..20` with no extra text.
- Assert the scenario can temporarily reduce viewport height by forcing the Entrance settings panel visible, then restore prior state.

**Step 2: Run targeted tests to verify failure**

- Run the relevant provider tester/UI tests.

**Step 3: Implement minimal scenario helpers**

- Add deterministic prompt text, scroll validation, and temporary viewport/setting-state manipulation with cleanup.

**Step 4: Re-run targeted tests**

- Confirm scroll behavior and cleanup pass.

### Task 7: Final verification

**Files:**

- Verify all changed files with diagnostics and targeted test runs

**Step 1: Run diagnostics**

- Check changed TypeScript files for errors.

**Step 2: Run targeted regression suites**

- Run all new/updated test files.

**Step 3: Run broader verification if needed**

- Run the nearest higher-level regression suites if targeted tests reveal integration gaps.

**Step 4: Summarize outcome**

- Report changed files, passing verification, and any remaining pre-existing issues.
