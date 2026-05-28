# Laboratory Analysis Room — Full Wireframe Redesign

Complete UX wireframe for the Laboratory room, replacing the current 3-column grid with a center-stage + contextual-drawer architecture.

---

## 1. Design Philosophy

**Core question the UI must always answer:**
1. *What is happening right now?* → Bottom Process Strip + Top Bar mode indicator
2. *What can I do next?* → Right Context Drawer (mode-aware)
3. *What will my action cause?* → Implication lines, preflight banners, intent previews

**Anti-patterns we're eliminating:**
- Left rail as a permanent intent list nobody reads at a glance
- 3-column competing for attention equally
- Report hidden behind an overlay
- Timeline detached from the media viewport
- Process tracking buried inside a scrollable panel

---

## 2. Layout Grid — ASCII Wireframe

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│ TOP BAR (48px, sticky)                                                          │
│ [🎬 Project ▾]  [Source: video.mp4 ✓]  [Analyze ●]  [Results ◐]    [⚙ Tools]  │
├─────────────────────────────────────────────────────┬───────────────────────────┤
│                                                     │                           │
│                                                     │  RIGHT CONTEXT DRAWER     │
│                  CENTER STAGE                        │  (22rem, collapsible)     │
│                  (fluid, 60-70%)                     │                           │
│                                                     │  ┌─────────────────────┐  │
│  ┌─────────────────────────────────────────────┐    │  │ MODE-AWARE CONTENT  │  │
│  │                                             │    │  │                     │  │
│  │          MEDIA VIEWPORT                     │    │  │ Setup / Running /   │  │
│  │          (video / audio / image)            │    │  │ Result / Explore    │  │
│  │                                             │    │  │                     │  │
│  │     [ROI overlays]  [Selection highlight]   │    │  │ (see §5 below)      │  │
│  │     [Anomaly markers]                       │    │  │                     │  │
│  │                                             │    │  └─────────────────────┘  │
│  └─────────────────────────────────────────────┘    │                           │
│                                                     │                           │
│  ┌─────────────────────────────────────────────┐    │                           │
│  │ INTEGRATED TIMELINE (waveform + segments)   │    │                           │
│  │ |▓▓▓▓▓░░░░░░░░░░░░░░░░░░░░░░░░░▓▓▓▓░░░░|  │    │                           │
│  │ 00:00        selection        01:24  02:48  │    │                           │
│  │ [bookmarks ▼] [ROI focus] [export clip]     │    │                           │
│  └─────────────────────────────────────────────┘    │                           │
│                                                     │                           │
│  ┌─────────────────────────────────────────────┐    │                           │
│  │ FOCUS CONTROLS (collapsible)                │    │                           │
│  │ [Interactive: B/C/γ] [Audio EQ] [Hypothesis]│    │                           │
│  └─────────────────────────────────────────────┘    │                           │
│                                                     │                           │
├─────────────────────────────────────────────────────┴───────────────────────────┤
│ BOTTOM PROCESS STRIP (56px, sticky)                                             │
│ INGEST ──●── ANALYZE ──○── MODEL ──○── EVALUATE ──○── DECIDE      [▸ 34% 2:18] │
│ "Extracting audio features…"                              [Log ▾] [Cancel]      │
└─────────────────────────────────────────────────────────────────────────────────┘
```

---

## 3. Region Specifications

### 3.1 TOP BAR — Command & Orientation Strip

**Height:** 48px, sticky top.
**Grid:** `max-content | 1fr | max-content`

| Segment | Content | Behavior |
|---------|---------|----------|
| **Left** | Project selector dropdown (active project name + switch) | Always visible |
| **Center** | Mode pills: `Source` · `Analyze` · `Results` | Not navigation tabs — they are **state indicators** with accent dot showing the current active phase. Clicking a pill scrolls/focuses the relevant drawer mode. |
| **Right** | Tool Management button (icon), Settings gear | Minimal — no feature density here |

**Why here:** The top bar answers "where am I in the workflow" at a glance without consuming vertical space. Mode pills are not tabs — they don't hide content. They indicate system state and allow quick re-focus.

**Visual:** Thin, transparent-ish bg with subtle bottom border. Pills use the existing `--labx-accent` dot for active, `--labx-text-dim` for others.

### 3.2 CENTER STAGE — Primary Workspace

**Width:** Fluid (fills remaining space after drawer).
**Sections (vertical stack, scrollable):**

#### A. Source Bar (compact, always visible when source loaded)
- File name, kind chip, resolution, duration, size — single horizontal row
- Import progress bar (tone-colored) when ingesting
- **Collapsed by default** once source is ready — just a summary line

#### B. Media Viewport
- **Takes ~50-60% of center stage vertical space**
- Video/audio/image preview with existing interactive filter pipeline
- ROI overlays render directly on the media
- Selection highlight synced with timeline (visual bracket on video frame)
- Inspection viewport with zoom/pan preserved
- Dual-preview (video+audio pane) when linked audio exists

#### C. Integrated Timeline
- **Directly below media, no gap** — feels like one unit
- Waveform visualization with segment markers
- Selection range (drag handles) visually connected to media viewport
- Bookmark markers on the timeline
- Quick actions row: `Export Clip` · `Grab Frame` · `ROI Focus toggle`
- Collapsible detail panels (simulation, reflection, alternatives, payload) remain as `<details>` below timeline

#### D. Focus Controls (collapsible strip)
- Audio Focus (EQ, frequency, visualization mode)
- Interactive Controls (brightness, contrast, gamma, saturation, etc.)
- Hypothesis input
- These use progressive disclosure: collapsed to a single "Focus Controls" bar when not actively needed
- **Only visible when source is ready**

**Why this structure:** Media + Timeline as a single visual unit solves the sync problem. The user sees the media, sees the timeline below it, and selection in both are visually connected. Focus controls are advanced tools — they default collapsed but are one click away.

### 3.3 BOTTOM PROCESS STRIP — System State

**Height:** 56px default, expandable to ~200px for log view.
**Position:** Sticky bottom, full width.

```
┌─────────────────────────────────────────────────────────────────────┐
│ ● INGEST ─── ◉ ANALYZE ─── ○ MODEL ─── ○ EVALUATE ─── ○ DECIDE   │
│   "Extracting audio features…"       ▓▓▓▓▓▓▓▓░░░░  34%    [2:18] │
│                                                     [Log ▾] [Stop] │
└─────────────────────────────────────────────────────────────────────┘
```

**Content:**
- **Journey steps** as a horizontal pipeline: `INGEST → ANALYZE → MODEL → EVALUATE → DECIDE`
  - Each step: filled dot (done), pulsing dot (active), hollow dot (pending)
  - Maps to `getExecutionJourneyStep()` (already exists, returns 0-4)
- **Active task label** — one line describing what the system is doing
- **Progress bar** + percentage + elapsed time
- **Expand button** → reveals recent actions log (last 5) and raw log toggle
- **Cancel/Stop** button when run is active

**Why here:** Process state is always visible without scrolling. The user never loses awareness of "what is happening." The pipeline visualization directly addresses the "no clear process flow" problem.

**Expand behavior:**
- Click `Log ▾` → strip grows to show:
  - Recent actions (3 items, "show all" for more)
  - Live findings (collapsible)
  - Raw log (collapsible, monospace)
- Click `Log ▴` → collapses back to 56px

### 3.4 RIGHT CONTEXT DRAWER — Adaptive Intelligence Panel

**Width:** 22rem default, collapsible to 0 (icon toggle on edge).
**Position:** Right side, full height between top bar and process strip.
**Scroll:** Independent scroll.

**This is the key innovation.** The drawer doesn't show all information at once. It morphs based on the current journey phase.

---

## 4. Right Drawer — Mode Definitions

### MODE 1: Setup (no active run, source may or may not be loaded)

```
┌─────────────────────┐
│ SETUP               │
│                     │
│ ▸ Source Intake      │
│   [Kind ▾] [Mode ▾] │
│   [URL / YT / Local] │
│   [Load Source →]    │
│                     │
│ ▸ Analysis Intents   │
│   ☑ Motion analysis  │
│   ☐ Audio forensics  │
│   ☑ Anomaly detect   │
│   (effect previews)  │
│                     │
│ ▸ Hypothesis         │
│   [text input]       │
│                     │
│ ▸ Preflight Check    │
│   ✓ Source ready     │
│   ✓ ffmpeg installed │
│   △ Large file warn  │
│                     │
│ ╔═══════════════════╗│
│ ║ ▶ Start Analysis  ║│
│ ╚═══════════════════╝│
│                     │
│ Intent Preview:      │
│ "This will analyze   │
│  motion + anomaly…"  │
└─────────────────────┘
```

**Key decisions:**
- **Source intake moves here** from center panel. The center stage is for viewing, not configuration.
- **Intents** shown with human-readable effect labels, not technical IDs. Each intent shows what it *does*, not what module it runs.
- **Preflight** is a checklist — green checks, yellow warnings, red blocks. Non-blocking warnings are visible but don't prevent start.
- **Start Analysis** is the hero CTA — large, prominent, at the bottom of the setup mode. It shows a preview of what will happen ("This analysis will detect motion patterns and audio anomalies across the selected 0:12–1:45 range").
- **Impact preview** under the CTA tells the user exactly what the analysis will do before they commit.

### MODE 2: Running (active analysis in progress)

```
┌─────────────────────┐
│ RUNNING ● 34%       │
│                     │
│ ▸ Active Module      │
│   audio-extraction   │
│   "Processing ch.2"  │
│   ████████░░  78%    │
│                     │
│ ▸ Pipeline Progress  │
│   ✓ source-probe     │
│   ✓ frame-extract    │
│   ▸ audio-extraction │
│   ○ motion-analysis  │
│   ○ anomaly-detect   │
│   ○ report-gen       │
│                     │
│ ▸ Early Signals      │
│   ⚡ 3 anomalies      │
│   detected so far    │
│   [Preview →]        │
│                     │
│ ▸ Run Snapshot       │
│   Focus: full source │
│   Timeline: 0:12-1:45│
│   Intents: motion,   │
│   anomaly            │
│                     │
│ ╔═══════════════════╗│
│ ║ ■ Cancel Analysis ║│
│ ╚═══════════════════╝│
└─────────────────────┘
```

**Key decisions:**
- **Active module** with its own micro-progress bar — user sees exactly which step is running.
- **Pipeline** as a vertical checklist — completed, active, pending states with icons.
- **Early signals** — live findings that emerge during analysis shown immediately. This directly solves "weak user guidance during analysis."
- **Run snapshot** — frozen context of what this run is analyzing (addresses the stale/dirty workspace concern).
- **Cancel** replaces Start as the hero CTA.

### MODE 3: Result (analysis complete, report available)

```
┌─────────────────────┐
│ RESULTS ✓           │
│                     │
│ ▸ Decision Surface   │
│   ┌────────────────┐│
│   │ Selection      ││
│   │ 0:12 – 1:45   ││
│   │ "Defines scope"││
│   ├────────────────┤│
│   │ Intent: Motion ││
│   │ "Analyzing for ││
│   │  motion + audio││
│   │  in this range"││
│   └────────────────┘│
│                     │
│   Candidate: Viable │
│   ●━━━━━━━━━━━━━━━━ │
│   "Structurally OK"  │
│                     │
│   Commitment: ✓     │
│   Staging: Ready    │
│                     │
│ ▸ Coherence View     │
│   Polarity: +0.72   │
│   "Signals aligned"  │
│                     │
│ ▸ Readiness Signal   │
│   Level: High       │
│   "All deps met"     │
│                     │
│ ▸ Execution Bridge   │
│   (collapsed)        │
│                     │
│ ╔═══════════════════╗│
│ ║ 📄 View Report    ║│
│ ╚═══════════════════╝│
│ Freshness: ✓ Current │
│                     │
│ ▸ Output Trace       │
│   Expected vs Actual │
│   ✔ Object detection │
│   ✔ Anomaly report   │
│   ✖ Recommendations  │
└─────────────────────┘
```

**Key decisions:**
- **Decision Surface** is the hero — Selection, Intent, Candidate, Commitment, Staging are the tier-1/tier-2 cards from current `lab-right-panel.ts`, but now they have more room and better hierarchy.
- **Coherence/Readiness/Bridge** advisories are collapsible `<details>` — experts can dive deep, non-experts see the summary.
- **View Report** is the hero CTA — opens the report overlay (or inline if space allows).
- **Report freshness badge** is visible right under the CTA.
- **Output trace** shows expected vs actual outputs per intent — "did we get what we asked for?"
- Non-expert-friendly: each card has an **implication line** in plain language.

### MODE 4: Exploration (post-result, user wants to iterate)

```
┌─────────────────────┐
│ EXPLORE             │
│                     │
│ ▸ Alternatives       │
│   Path A: ★★★☆      │
│   "Switch to audio-  │
│    first pipeline"   │
│   [Apply →]          │
│                     │
│   Path B: ★★☆☆      │
│   "Reduce scope to   │
│    0:30–1:00 range"  │
│   [Apply →]          │
│                     │
│ ▸ Comparison          │
│   [vs Previous Run ▾]│
│   timeline drift: 3s │
│   new findings: +2   │
│   lost findings: -1  │
│                     │
│ ▸ Tweak & Rerun      │
│   [Adjust intents]   │
│   [Adjust timeline]  │
│   [Change hypothesis] │
│                     │
│ ╔═══════════════════╗│
│ ║ ▶ Re-analyze      ║│
│ ╚═══════════════════╝│
│                     │
│ ▸ Export              │
│   [Export Report PDF] │
│   [Export Artifacts]  │
│   [Save Snapshot]     │
└─────────────────────┘
```

**Key decisions:**
- **Alternatives** from the execution layer — shown with human-readable summaries and star ratings.
- **Comparison** against previous runs — the workspace diff system already exists.
- **Tweak & Rerun** — quick access to change parameters without going back to full Setup mode.
- **Re-analyze** CTA — starts a new analysis with tweaked parameters.
- **Export** at the bottom — report PDF, artifacts, project snapshot.

---

## 5. Mode Transition Logic

The drawer mode is **not manually switched** by the user. It's derived from system state:

| Condition | Drawer Mode |
|-----------|-------------|
| `!sourceReady && !runActive && !hasReport` | **Setup** |
| `sourceReady && !runActive && !hasReport` | **Setup** (with preflight visible) |
| `runActive` | **Running** |
| `!runActive && hasReport && freshness.state === "current"` | **Result** |
| `!runActive && hasReport && freshness.state !== "current"` | **Exploration** |

**Override:** User can manually switch between Result ↔ Exploration via a toggle when both are available. Setup is always accessible via a "Configure" link in any mode.

**Top bar pills** reflect the current mode:
- `Source` pill: accent when in Setup mode and source section is active
- `Analyze` pill: pulsing when in Running mode
- `Results` pill: accent when in Result/Exploration mode

---

## 6. Interaction Flow — Step-by-Step User Journey

### Step 1: Open Laboratory
- **Top bar:** Project selector shows active project (or "New Project")
- **Center stage:** Empty state — "Select a source to begin"
- **Right drawer:** Setup mode — Source Intake section open
- **Process strip:** Idle — all dots hollow

### Step 2: Load Source
- User picks source type and import method in the drawer
- Progress appears in Source Bar (center) and Process Strip (bottom, INGEST step activates)
- Media viewport populates once probe completes
- Timeline renders with waveform
- **Right drawer:** Intents section auto-expands once source is ready

### Step 3: Configure Analysis
- User selects intents — each shows effect description ("Will detect motion patterns")
- Hypothesis input (optional)
- Preflight checklist auto-populates
- **Intent Preview** below CTA updates in real-time: "This analysis will…"
- **Start Analysis** CTA turns prominent

### Step 4: Run Analysis
- **Drawer transitions** to Running mode automatically
- **Process strip:** Pipeline steps fill left-to-right
- **Drawer:** Active module progress, pipeline checklist, early signals
- **Center stage:** Timeline may show live markers as findings emerge
- **Top bar:** Analyze pill pulses

### Step 5: View Results
- **Drawer transitions** to Result mode
- **Decision Surface** shows Candidate → Commitment → Staging flow
- **View Report** CTA is prominent
- **Process strip:** All dots filled, shows "Completed" + elapsed time
- Report overlay opens on CTA click

### Step 6: Explore & Iterate
- User clicks "Explore Alternatives" or freshness degrades
- **Drawer transitions** to Exploration mode
- Alternatives, comparison, tweak options available
- **Re-analyze** CTA available for quick iteration

---

## 7. Responsive Behavior

| Breakpoint | Behavior |
|------------|----------|
| **> 1400px** | Full layout: center stage + 22rem drawer + process strip |
| **1180–1400px** | Drawer shrinks to 18rem, some labels truncate |
| **860–1180px** | Drawer collapses to icon-rail (3rem), click to expand as overlay |
| **< 860px** | Drawer moves to bottom sheet, process strip becomes a single-line ticker |

---

## 8. Why Each Section Is Placed This Way

| Region | Placement Rationale |
|--------|-------------------|
| **Top Bar** | Persistent orientation without consuming vertical space. Mode awareness at a glance. Project context always visible. |
| **Center Stage** | Media is the primary artifact the user works with. It gets the most space. Timeline integrated directly below media eliminates the sync gap. |
| **Process Strip** | Anchored to bottom like a status bar — always visible regardless of scroll position. Pipeline visualization gives process awareness without competing with content. |
| **Right Drawer** | Configuration and results are contextual — they change based on what the user needs *now*. A morphing drawer prevents information overload by only showing relevant controls for the current phase. It's on the right because Western reading flow goes left→right: content first, then actions. |

---

## 9. Component Migration Map

| Current Component | New Location |
|-------------------|-------------|
| `lab-left-rail.ts` (intents, brand, tool mgmt) | **Eliminated.** Intents → Right Drawer (Setup mode). Tool mgmt → Top bar icon. Brand → Top bar. |
| `lab-center-panel.ts` | **Center Stage** — becomes the full workspace |
| `lab-right-panel.ts` (Decision Surface) | **Right Drawer** (Result mode) |
| `workspace-surface.ts` (source bar, preview, intake, global process) | **Split:** Source bar → Center Stage top. Source intake → Right Drawer (Setup). Global process → Bottom Process Strip. Preview → Center Stage media viewport. |
| `workspace-process-panel.ts` (pipeline, findings, artifacts, recent actions) | **Split:** Pipeline → Right Drawer (Running mode) + Bottom Process Strip. Findings → Right Drawer (Running: early signals). Artifacts → Right Drawer (Exploration: export). Recent actions → Bottom Process Strip (expandable). |
| `report-overlay.ts` | **Preserved** but triggered from Right Drawer (Result mode) |
| `lab-waveform-timeline-render.ts` | **Center Stage** — integrated timeline zone |

---

## 10. Key Design Tokens (dark theme preserved)

No change to existing `base.css` color tokens. New additions needed:

- `--labx-strip-bg`: Bottom process strip background (slightly elevated)
- `--labx-drawer-bg`: Right drawer background (matches `--labx-surface-strong`)
- `--labx-topbar-bg`: Top bar background (transparent with backdrop-filter blur)
- `--labx-pipeline-done`: Filled pipeline dot color (`--labx-success`)
- `--labx-pipeline-active`: Pulsing pipeline dot color (`--labx-accent`)
- `--labx-pipeline-pending`: Hollow pipeline dot color (`--labx-text-dim`)

---

## 11. Summary of UX Problems Solved

| Problem | Solution |
|---------|----------|
| Important data hidden or too small | Decision Surface gets full drawer width in Result mode. Process strip always visible. |
| No clear process flow | Bottom strip with 5-step pipeline + journey hints in drawer |
| Weak user guidance during analysis | Running mode shows early signals, active module detail, run snapshot |
| No proper progress tracking | Bottom strip: percentage + elapsed + pipeline visualization. Drawer: per-module progress. |
| Timeline not synced visually | Timeline is physically below media viewport — one visual unit |
| Report not understandable for non-experts | Result mode shows plain-language implication lines. Coherence/readiness as summaries, not raw data. Output trace: expected vs actual checklist. |
| Cluttered, feature-first | Progressive disclosure: drawer shows only what's relevant per phase. Focus controls collapsed by default. Advanced details behind `<details>`. |
