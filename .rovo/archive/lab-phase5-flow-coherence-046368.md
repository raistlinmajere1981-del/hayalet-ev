# Laboratory Phase 5 — Flow Coherence & Cognitive Feedback Layer

Transform the existing Laboratory UI into a perceptually coherent decision system by layering meaning onto what already exists — no new panels, no new data sources, ~170 lines across 4 files.

---

## Files & Scope

### 1. `lab-right-panel.ts` — Selection echo + Intent interpretation (~15 lines)

**Tier-1 Selection block:** Add a causal anchor line when `selectionRangeLabel` exists:
- `"This selection defines the analysis scope"` — class `labx-right-context__causal-line`
- Fades in via CSS animation (0 → 1 opacity, 180ms)
- Not rendered when selection is null/invalid

**Tier-1 Intent block:** Add interpretation line when `activeIntentLabel` is set:
- `"System will analyze this region for {intentLabel}"` — class `labx-right-context__causal-line labx-right-context__causal-line--intent`
- Same fade-in rule

**Tier-2 Decision cards:** Add `data-decision-card="candidate|commitment|staging"` attributes for DOM patch targeting.

---

### 2. `lab-root.ts` — Minimal DOM patch for transitional text (~60 lines)

Detects **first genuine appearance** of candidate/commitment/staging states. Wires into the existing render loop as a post-render side-effect — no new shared state.

**① Identity-based trigger (not status-based):**
- `seenDecisionIdentities`: local `Set<string>` — tracks composite identity keys, not raw status strings
- Identity key format: `"card:{planId}:{status}"` (e.g. `"candidate:plan-abc123:viable"`)
- planId sourced from `getActiveExecutionCandidate(state).planId` etc.
- Same identity = no retrigger (survives re-renders)
- New planId with same status = retrigger (genuinely new context)
- Fallback when planId unavailable: `"card:{selectionId}:{status}"`

**② Timeout guard token:**
- `pendingRestoreTimers: Record<string, ReturnType<typeof setTimeout>>` — keyed by card name
- Before setting a new timer: cancel any pending timer for that card
- On timer fire: delete key from map, restore text, clear opacity
- Prevents stale restoration if state flips again within 280ms window

**Patch flow per card:**
1. Compute identity key → check `seenDecisionIdentities`
2. If unseen: add to set, find `[data-decision-card="X"] strong` in DOM
3. Cancel any pending restore timer for this card
4. Set strong `opacity: 0.4`, replace `textContent` with transitional phrase:
   - Candidate: `"Evaluating structural viability…"`
   - Commitment: `"Path selected"`
   - Staging: `"Prepared for execution staging"`
5. `setTimeout(280ms)` → restore original `textContent` + `opacity: ""` → delete timer key

**③ Contextual label conflict protection (in `workspace-surface.ts`):**
- Contextual phrase is shown only when ALL of:
  - `summary.state === "idle"`
  - `summary.activeTaskLabel === null`
  - `summary.activeTaskKey === null`
  - `summary.progressLabel === null`
- If any real label exists (even during idle), it wins — contextual phrase is suppressed

---

### 3. `workspace-surface.ts` — Contextual process phrases (~25 lines)

Add `getContextualTaskLabel(journeyStep, summary, copy)` helper:

| Journey step | Contextual phrase |
|---|---|
| 1 (Plan) | "Preparing analysis context…" |
| 2 (Evaluate) | "Comparing alternative paths…" |
| 3 (Decide) | "Evaluating candidate structure…" |
| 4 (Stage) | "Assessing readiness…" |
| 0 (Select) / -1 | "Ready for input" |

Used only when `summary.state === "idle"` — never overrides real running task labels.

Also: add `data-journey-step="${step}"` attribute to `<section class="labx-global-process">` for CSS targeting.

---

### 4. `lab-theme.css` — CSS perception layer (~80 lines)

**Journey hint (§2a improvement):**
- Active step: `color: var(--labx-accent)` + `border-bottom: 1px solid rgba(92,215,223,0.4)` + slightly higher `font-weight`
- Previous steps (reached, not active): `opacity: 0.55` (currently all reached steps look the same as active)
- Future steps: `opacity: 0.28` (currently `0.35`)

**Causal/interpretation lines:**
```css
@keyframes labx-fade-in { from { opacity: 0 } to { opacity: 1 } }
.labx-right-context__causal-line {
  animation: labx-fade-in 0.18s ease forwards;
  font-size: 0.64rem; color: var(--labx-text-dim); font-style: italic; margin: 0.15rem 0 0;
}
.labx-right-context__causal-line--intent { color: rgba(92,215,223,0.6); }
```

**Decision card state-entry animation:**
- `[data-decision-card] strong`: `transition: opacity 0.15s` (DOM patch briefly sets opacity dim → restore)
- Staging card active highlight: when `data-accent="staging"`, subtle background pulse via CSS `@keyframes labx-staging-arrive` (once, 400ms)

**Global process task label:** Add `transition: opacity 0.2s` to `.labx-global-process__task strong`

**Global process journey step contextual styling:**
- `[data-journey-step="2"] .labx-global-process__dot` — slightly warmer pulse (already handled by `data-tone`)

---

## Constraints respected

- `lab-run-controller.ts`: untouched
- `lab-types.ts`: untouched
- No new store shape, no new dispatch, no new async beyond 1× 280ms `setTimeout` per state appearance
- No buttons, interactions, or execution triggers added
- All microcopy: calm, observational, system-describing

---

## Estimated line count

| File | Lines |
|---|---|
| `lab-right-panel.ts` | +15 |
| `lab-root.ts` | +60 |
| `workspace-surface.ts` | +25 |
| `lab-theme.css` | +80 |
| **Total** | **~180** |
