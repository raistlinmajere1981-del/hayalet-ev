# Provider Selector Promotion Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add language-aware primary selector promotion so successful provider webview tests can update provider config source files and the app will try `main` selectors before fallbacks.

**Architecture:** Keep runtime DOM consumers flat by introducing a shared selector resolver that reads locale-aware metadata from provider configs and produces ordered candidate selectors. Provider tests capture which candidate actually matched, and after a fully successful run the Electron test flow promotes that selector into the relevant provider `config.ts` language bucket and refreshes in-memory config for the current session.

**Tech Stack:** TypeScript, Electron IPC, provider config modules, renderer ProviderRegistry, provider tester regressions under `scripts/tests/`.

---

### Task 1: Add failing tests for selector schema and resolver ordering

**Files:**

- Create: `scripts/tests/provider-selector-resolution-regressions.test.ts`
- Modify: `src/types/provider.ts`
- Create: `shared/provider-selector-resolution.ts`

**Step 1: Write the failing test**

- Assert a locale-aware selector entry resolves in strict order: `tr main -> en main -> fallbacks` for Turkish and `en main -> tr main -> fallbacks` for English.
- Assert legacy flat string selectors still resolve correctly during migration.

**Step 2: Run test to verify it fails**

- Run: `node --test scripts/tests/provider-selector-resolution-regressions.test.ts`
- Expected: FAIL because the resolver/types do not exist yet.

**Step 3: Write minimal implementation**

- Add selector entry types to `src/types/provider.ts`.
- Add a shared resolver helper in `shared/provider-selector-resolution.ts` that returns ordered selector candidates and legacy compatibility helpers.

**Step 4: Run test to verify it passes**

- Run: `node --test scripts/tests/provider-selector-resolution-regressions.test.ts`
- Expected: PASS.

### Task 2: Add failing tests for config promotion persistence

**Files:**

- Create: `scripts/tests/provider-selector-promotion-regressions.test.ts`
- Create: `electron/provider-tester/selector-promotion.ts`
- Modify: `src/js/modules/webview/providers/chatgpt/config.ts`
- Modify: `src/js/modules/webview/providers/gemini/config.ts`
- Modify: `src/js/modules/webview/providers/grok/config.ts`
- Modify: `src/js/modules/webview/providers/opencode/config.ts`
- Modify: `src/js/modules/webview/providers/opencode-ui/config.ts`

**Step 1: Write the failing test**

- Assert a fully successful selector evidence payload promotes the winning selector into the correct locale main slot and keeps remaining candidates as fallbacks.
- Assert source rewriting updates only the targeted selector entry and refuses packaged/read-only paths.

**Step 2: Run test to verify it fails**

- Run: `node --test scripts/tests/provider-selector-promotion-regressions.test.ts`
- Expected: FAIL because promotion persistence does not exist yet.

**Step 3: Write minimal implementation**

- Add a dedicated promotion helper under `electron/provider-tester/selector-promotion.ts`.
- Update provider configs to carry locale-aware selector metadata without breaking existing flat runtime fields.

**Step 4: Run test to verify it passes**

- Run: `node --test scripts/tests/provider-selector-promotion-regressions.test.ts`
- Expected: PASS.

### Task 3: Add failing tests for provider test selector evidence capture

**Files:**

- Modify: `scripts/tests/provider-test-scenario-runner-regressions.test.ts`
- Modify: `electron/provider-tester/types.ts`
- Modify: `electron/provider-tester/utils.ts`
- Modify: `electron/provider-tester/dom-tests.ts`
- Modify: `electron/provider-tester/interactive-tests.ts`
- Modify: `electron/provider-tester/scraping-tests.ts`
- Modify: `electron/provider-tester/index.ts`

**Step 1: Write the failing test**

- Assert passing selector-backed checks record selector evidence with key, locale, candidate used, and promotion eligibility.
- Assert full clean scenario completion returns promotion-ready evidence, while warnings/failures prevent promotion.

**Step 2: Run test to verify it fails**

- Run: `node --test scripts/tests/provider-test-scenario-runner-regressions.test.ts`
- Expected: FAIL because selector evidence/promotion gating is missing.

**Step 3: Write minimal implementation**

- Extend provider test result details/types for selector evidence.
- Capture matched selector data inside test utilities and scenario steps.
- Trigger promotion only after a full successful run.

**Step 4: Run test to verify it passes**

- Run: `node --test scripts/tests/provider-test-scenario-runner-regressions.test.ts`
- Expected: PASS.

### Task 4: Add failing tests for renderer/main runtime refresh after promotion

**Files:**

- Create: `scripts/tests/provider-registry-selector-refresh-regressions.test.ts`
- Modify: `src/js/modules/webview/provider-registry.ts`
- Modify: `electron/handlers/ipc-provider.ts`
- Modify: `electron/preload.cjs`
- Modify: `src/js/global.d.ts`

**Step 1: Write the failing test**

- Assert the renderer registry can accept updated provider config data after promotion.
- Assert the provider test IPC result can include refreshed config payload or enough promotion data for renderer refresh.

**Step 2: Run test to verify it fails**

- Run: `node --test scripts/tests/provider-registry-selector-refresh-regressions.test.ts`
- Expected: FAIL because no refresh path exists.

**Step 3: Write minimal implementation**

- Add a small ProviderRegistry update method.
- Return promotion metadata from `test-provider` and update current-session config in renderer.

**Step 4: Run test to verify it passes**

- Run: `node --test scripts/tests/provider-registry-selector-refresh-regressions.test.ts`
- Expected: PASS.

### Task 5: Add failing tests for DOM consumers using the resolver

**Files:**

- Modify: `scripts/tests/grok-config-regressions.test.ts`
- Modify: `src/js/modules/webview/message-sender.ts`
- Modify: `src/js/modules/webview/methods/message/injection.ts`
- Modify: `src/js/modules/webview/methods/message/xdotools.ts`
- Modify: `src/js/modules/webview/methods/file/injection.ts`
- Modify: `src/js/modules/webview/methods/file/dragdrop.ts`
- Modify: `src/js/modules/traffic/probe-script-builder.ts`
- Modify: `src/js/modules/traffic/loading-tracker.ts`
- Modify: `src/mcp-server/utils/provider-config.ts`

**Step 1: Write the failing test**

- Assert consumers request ordered selectors from the shared resolver instead of reading raw flat selectors directly where priority matters.
- Assert config parsing/flattening remains compatible with the new schema.

**Step 2: Run test to verify it fails**

- Run: `node --test scripts/tests/grok-config-regressions.test.ts`
- Run: `node --test scripts/tests/provider-selector-resolution-regressions.test.ts`
- Expected: FAIL because consumers still use raw selector strings.

**Step 3: Write minimal implementation**

- Route priority-sensitive DOM access through the shared resolver.
- Keep array-style categories flat unless a consumer needs ordered locale-aware resolution.
- Update the MCP provider config parser to surface the new schema without breaking existing output.

**Step 4: Run test to verify it passes**

- Run the same targeted tests.
- Expected: PASS.

### Task 6: Final verification

**Files:**

- Verify all changed files and updated regression suites

**Step 1: Run targeted regression tests**

- Run the new selector resolution/promotion tests and the updated provider tester regressions.

**Step 2: Run diagnostics**

- Check changed TypeScript files for diagnostics.

**Step 3: Run project verification**

- Run: `npm run check-types`
- Run: `npm run build`

**Step 4: Summarize outcome**

- Report changed files, promotion behavior, verification results, and any remaining limitations.
