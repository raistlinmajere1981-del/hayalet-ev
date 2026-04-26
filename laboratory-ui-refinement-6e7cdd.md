# Laboratory UI Refinement & Experience Design

Refine the Laboratory's existing 3-column layout into a calmer, clearer decision-making cockpit — within the current TS template-literal + CSS paradigm — by implementing a shell-over-boot loading transition, strengthening the topbar as the single process heartbeat, transforming the right panel into a decision surface, and reducing visual noise across all panels.

---

## 1. Shell-Over-Boot Loading Transition

**Files:** `lab-root.ts`, `lab-layout.ts`, `lab-theme.css`

**Current:** `createBootSurface()` renders a separate card layout when `hasCanonicalState` is false. The 3-column shell doesn't appear until data arrives.

**Change:**
- Remove the `createBootSurface` code path; always render the full shell
- When `bootReady === false`, the shell gets `data-ready="false"` (already set)
- Add CSS rules on `.labx-shell[data-ready="false"]`:
  - Dim the center and right panels (`opacity: 0.35`, `pointer-events: none`)
  - Left rail stays slightly visible (`opacity: 0.5`)
  - Add a soft overlay pseudo-element (`.labx-shell[data-ready="false"]::after`) — semi-transparent backdrop with subtle gradient, centered message
- The `renderGlobalProcessSummary` should render an "Initializing Laboratory…" state when `bootReady === false` — the topbar process layer stays **active** during boot
- Add a gentle `@keyframes labx-boot-breathe` animation (opacity oscillation) to the boot overlay text so the UI feels alive
- Once `bootReady` flips to `true`, `data-ready="true"` drops the overlay, panels become interactive — a CSS transition (`opacity 0.4s ease`) makes it smooth

**Boot messaging — progressive, timer-driven:**
- Messages cycle every ~2.5s via a JS interval in `lab-root.ts` that updates a `data-boot-message` attribute on the overlay element
- Sequence: `"Preparing Laboratory environment…"` → `"Loading analysis context…"` → `"Initializing modules…"` → loops
- Text swaps use a CSS `transition: opacity 0.3s` for soft fading (JS toggles a `data-boot-fade` attribute)
- The interval is cleared when `bootReady` becomes `true`

---

## 2. Global Process Layer (Topbar) — Heartbeat Refinement

**Files:** `workspace-surface.ts` (`renderGlobalProcessSummary`), `lab-theme.css`

**Current:** The global process bar has 3 columns (state dot + label, active task, progress) but visually blends with surrounding content.

**Change:**
- **Visual weight increase:** Give `.labx-global-process` a slightly stronger border (`rgba(72,214,222,0.32)`), increase the dot size to `0.65rem`, and add `position: sticky; top: 0; z-index: 10` so it pins at the top of the center scroll area
- **State dot tones:** Add `data-tone` driven colors — idle=dim, processing=accent-pulse, analyzing=accent-glow, staging=success, error=error
- **Consolidate signals:** Add a `data-boot-phase` attribute when `bootReady === false` to show "Initializing…" instead of "No active task"
- **Progress enrichment:** When a run is active, show mini progress text (e.g. "3/10 modules") directly in the progress slot
- **Microcopy refinements:**
  - idle: `"Idle — ready for input"`
  - processing: `"Processing…"`  
  - analyzing: `"Running {activeModule}"`
  - staging: `"Staged — review before commit"`

### 2a. Execution Journey Hint

**Files:** `workspace-surface.ts` (`renderGlobalProcessSummary`), `lab-selectors.ts` (new selector), `lab-theme.css`

Add a subtle secondary line below the main process bar showing the simplified 5-step journey.

**Conceptual model (fixed):**
```
Select → Plan → Evaluate → Decide → Stage
```

**Mapping from internal state:**
- **Select** = active when `getActiveSelection` exists and `getActiveExecutionIntent` is null
- **Plan** = active when `getActiveExecutionPlan` exists but no simulation/readiness yet
- **Evaluate** = active when simulation/readiness/reflection/alternatives exist
- **Decide** = active when candidate or commitment exists
- **Stage** = active when staging exists

**New selector:** `getExecutionJourneyStep(state): number` (0–4, or -1 for none) — returns index of the furthest reached step. Added to `lab-selectors.ts`.

**Render:** Below `.labx-global-process`, add `.labx-journey-hint`:
```html
<div class="labx-journey-hint">
  <span data-step="0" data-active="false" data-reached="true">Select</span>
  <span class="labx-journey-hint__arrow">→</span>
  <span data-step="1" data-active="true" data-reached="true">Plan</span>
  ...
</div>
```

**CSS:**
- `.labx-journey-hint` — `font-size: 0.65rem`, `color: var(--labx-text-dim)`, `letter-spacing: 0.06em`, `opacity: 0.6`
- `[data-active="true"]` — `color: var(--labx-accent)`, `opacity: 1` (softly, not bold)
- `[data-reached="true"]` — `opacity: 0.8`
- `[data-reached="false"]` — `opacity: 0.4`
- Hidden when journey step is -1 (no selection/intent active)

---

## 3. Right Panel → Decision Surface

**Files:** `lab-right-panel.ts`, `lab-theme.css`

**Current:** `renderLiveContext` shows a flat grid of 6 items (Selection, Intent, Candidate, Commitment, Staging, Process) with identical styling.

**Change:**
- **Group into two tiers:**
  - **Tier 1 — Decision state** (Selection, Intent) — compact, at top, smaller font, informational
  - **Tier 2 — Decision progress** (Candidate, Commitment, Staging) — larger cards with subtle accent borders, visually dominant
  - Process summary stays at bottom as a compact status line (not a full card)
- **Add visual hierarchy:**
  - Candidate/Commitment/Staging items get a left accent border (2px) whose color reflects their status (`none`=dim, `pending`=neutral, `ready`=success, `rejected`=error)
  - The "Live context" title becomes a smaller eyebrow; the section header changes to `"Decision Surface"`
- **Conditional emphasis:** When staging status is "ready", the staging card gets a subtle highlight background to draw the eye
- **Action buttons** (analysis, report) stay below the decision surface, separated by a thin divider
- **Empty state:** When no source is loaded, show a calm placeholder: `"Load a source to begin decision flow"`

### 3a. Implication Lines

For Candidate, Commitment, and Staging cards, add a secondary `<small>` line below the status value that explains what the current state *means* for the user. Driven by status value:

**Candidate implication map:**
- `viable` → `"Structurally viable for execution"`
- `unstable` → `"Structure incomplete — needs further evaluation"`
- `not-viable` → `"Not viable — path requires revision"`
- `null/none` → `"Awaiting evaluation"`

**Commitment implication map:**
- `committed` → `"Path selected for further evaluation"`
- `revoked` → `"Commitment withdrawn — return to decision"`
- `inactive/none` → `"No path committed yet"`

**Staging implication map:**
- `staged` → `"Prepared for execution staging"`
- `not-staged` → `"Not yet staged — review prerequisites"`
- `none` → `"Awaiting staging readiness"`

**CSS:** `.labx-right-context__implication` — `font-size: 0.66rem`, `color: var(--labx-text-dim)`, `font-style: italic`, `margin-top: 0.12rem`

All implication text goes through the i18n system with fallback strings.

---

## 4. Center Area — Process Panel Lightening

**Files:** `workspace-process-panel.ts`, `lab-theme.css`

**Current:** The process panel is a heavy bordered box with multiple nested sections (pipeline, findings, artifacts, recent actions, intent execution map, output trace).

**Change:**
- **Reduce visual weight:** Remove the heavy border/background from `.labx-process-panel`; use a subtle top border only (`border-top: 1px solid var(--labx-border)`) to separate it from the preview area above
- **Collapse-first:** Pipeline, findings, artifacts sections already collapse — make them **collapsed by default** also when idle (currently only some are). Intent execution map starts collapsed when no run is active
- **Compact header:** Reduce the process header vertical spacing; merge status chip + title into a single line
- **Recent actions:** Cap visible count to 3 (currently 6) and add "Show all" toggle
- **Idle state:** When idle and source is ready, reduce to a single-line summary: status chip + intent count + "Ready" — don't render the full execution map unless a run exists or has existed

### 4a. Preserve Idle Presence

The lightening must not make the process panel disappear. When idle:
- Keep `min-height: 64px` on `.labx-process-panel`
- Show a faint "sleeping" skeleton: the header (status chip + title) always renders, even when all sub-sections are hidden
- Add a subtle placeholder line below the header: `"Process activity will appear here"` in `var(--labx-text-dim)`, `font-size: 0.72rem`
- The panel should feel like a defined area waiting to be populated, not empty space

---

## 5. Source Intake — Collapse-First

**Files:** `workspace-surface.ts` (already has collapse mechanism)

**Current:** Source intake has a collapse toggle but may start expanded.

**Change:**
- When `sourceReadyForMode === true`, force `collapsed = true` by default — the user already has a source, they don't need the intake form open
- When collapsed, show a one-liner summary: source name + kind chip + status chip
- This is already partially implemented; enforce it as default behavior

---

## 6. Execution Panels (Simulation, Reflection, Alternatives, Payload)

**Files:** `lab-waveform-timeline-render.ts`, `lab-theme.css`

**Current:** `DEFAULT_COLLAPSED_PANELS` already collapses simulation, reflection, alternatives, payload.

**Change:**
- Add a subtle "secondary" visual treatment: `.lab-execution-collapsible` gets reduced opacity (`0.85`) when collapsed, with a smaller summary font
- When expanded, add a light top-fade to visually separate from primary content
- Add CSS class `.lab-execution-collapsible--secondary` for these four panels to differentiate from primary panels (plan, readiness, candidate)

---

## 7. Execution Details Overlay Refinement

**Files:** `lab-waveform-timeline-render.ts`, `lab-theme.css`

**Current:** The overlay uses `backdrop-filter: blur(6px)` and fills the screen.

**Change:**
- Reduce backdrop opacity slightly (`rgba(1,7,13,0.58)` → more transparent)
- Add a max-width constraint on the panel (`max-width: 56rem`) and center it
- Add a subtle entry animation (`opacity 0 → 1` over 200ms)
- The overlay should feel like a focused deep-dive, not a separate app

### 7a. Overlay Context Anchoring

When the execution details overlay opens, maintain spatial awareness:
- The overlay trigger button (`.lab-execution-details-trigger`) gets a `data-overlay-source="true"` attribute while the overlay is open
- CSS: `.lab-execution-details-trigger[data-overlay-source="true"]` gets a subtle accent glow (`box-shadow: 0 0 12px rgba(92,215,223,0.2)`) visible through the dimmed backdrop
- The backdrop dims everything *except* the origin trigger area slightly less (`filter` or layering approach)
- Implementation: In `lab-root.ts`, when `activeOverlay === "execution-details"`, set the attribute on the trigger element; clear it on close

---

## 8. Microcopy & Tone Unification

**Files:** Various render functions, `lab-i18n.ts` fallbacks

- Audit all user-facing strings for consistent tone: calm, technical, no hype
- Key replacements:
  - `"Derin Analiz Başlat"` → `"Analizi Başlat"` (simpler)
  - `"Control + context"` → `"Decision Surface"`
  - `"Live context"` → `"Active State"`
  - `"Action progress hub"` → `"Process Activity"`
  - Empty states should use guiding language: `"Select intents to define analysis scope"` instead of `"No active selection"`

### 8a. "Thinking System" Language

Add light thinking-oriented microcopy in process-related areas only. These appear as the `activeTaskLabel` or module messages during analysis.

**New microcopy (used sparingly in `getLaboratoryProcessSummary` and `getModuleStatusLabel`):**
- When analyzing with multiple intents: `"Evaluating {count} analysis paths…"`
- When simulation is running: `"Comparing structural alternatives…"`
- When readiness is computing: `"Assessing execution readiness…"`
- When candidate is being built: `"Evaluating candidate viability…"`

**Implementation:** Add a `getThinkingLabel(state)` helper in `workspace-surface.ts` that returns a thinking-oriented string based on active module type. Used as an *override* for `activeTaskLabel` in `renderGlobalProcessSummary` only when the module type matches known thinking-eligible stages. Falls back to existing label if no match.

**Constraints:** Never used in idle state, right panel, or static labels. Only in active process messaging.

---

## 9. CSS Calm-Down Pass

**Files:** `lab-theme.css`

- Reduce `box-shadow` intensity across cards (currently `0 18px 48px rgba(0,0,0,0.28)` — reduce to `0 12px 32px rgba(0,0,0,0.18)`)
- Standardize border-radius usage (currently mix of `1.4rem`, `1.25rem`, `1rem`, `0.9rem`, `0.8rem`, `0.55rem` — consolidate to 3 tiers: `var(--labx-radius)` 18px for panels, `var(--labx-radius-tight)` 12px for cards, `0.55rem` for buttons/chips)
- Reduce accent glow intensity on `.labx-global-process__dot` shadow
- Add a subtle transition to all interactive elements: `transition: border-color 0.15s, background 0.15s`

### 9a. Depth Hierarchy Preservation

Don't flatten everything when calming down shadows. Maintain two tiers:

**Primary panels** (center interaction area, decision surface, process panel):
- Shadow: `0 12px 32px rgba(0,0,0,0.18)` — reduced but present
- Border: standard `var(--labx-border)`

**Secondary panels** (collapsed execution panels, metadata, boot overlay):
- Shadow: `0 6px 16px rgba(0,0,0,0.1)` — minimal
- Border: `rgba(255,255,255,0.06)` — fainter

**CSS variables:**
```css
--labx-shadow-primary: 0 12px 32px rgba(0,0,0,0.18);
--labx-shadow-secondary: 0 6px 16px rgba(0,0,0,0.1);
```
Replace the single `--labx-shadow` with these two tiers throughout.

---

## Implementation Order

1. **Boot transition + progressive messaging** (§1) — `lab-root.ts`, `lab-layout.ts`, `lab-theme.css`
2. **Topbar heartbeat + journey hint** (§2, §2a) — `workspace-surface.ts`, `lab-selectors.ts`, `lab-theme.css`
3. **Right panel decision surface + implication lines** (§3, §3a) — `lab-right-panel.ts`, `lab-theme.css`
4. **Process panel lightening + idle presence** (§4, §4a) — `workspace-process-panel.ts`, `lab-theme.css`
5. **Source intake collapse-first** (§5) — `workspace-surface.ts`
6. **Execution panels secondary treatment** (§6) — `lab-waveform-timeline-render.ts`, `lab-theme.css`
7. **Overlay refinement + context anchoring** (§7, §7a) — `lab-root.ts`, `lab-theme.css`
8. **Microcopy + thinking language** (§8, §8a) — multiple files
9. **CSS calm-down + depth hierarchy** (§9, §9a) — `lab-theme.css`

Each step produces a buildable state. New selector `getExecutionJourneyStep` added in step 2. Boot message interval added in step 1. No backend changes or new store event types needed.
