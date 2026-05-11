# Repair Room — Phase 1 (UI Exploration + Interactive Prototype)

Build a new `rooms/repair-room/` module that follows the existing Hayalet Ev room architecture (manifest + host + ui + main-functions, vanilla TS + CSS custom properties), introduces Konva only for the central workbench overlay, and ships a fully interactive prototype driven by mock state shaped to mirror future AİÖ contracts.

---

## 0. Governing Directive — Perceived Realism > Implementation Completeness

This is the **only tie-breaker** in Phase 1. Whenever a trade-off appears between covering one more feature vs. making the existing surface feel more operational, **realism wins**.

Operational rules derived from this directive:

- **Atmosphere first, edges later.** It is acceptable to ship a panel with fewer modes if those modes feel real (correct timestamps, plausible mock streams, tactile microinteractions). It is *not* acceptable to ship every panel as a hollow shell.
- **No "Coming soon" labels.** Anything visible must behave plausibly under casual probing. Hide controls that have no behavior yet rather than show them disabled or stubbed with toast warnings.
- **Mock data must be diegetic.** No `lorem ipsum`, no `"Sample Event 1"`. Every label, code, value, timestamp, and waveform reads like a real session log (board codes, S/N, rail names, MOSFET designators, plausible voltages).
- **Time feels real.** Timestamps tick. The LIVE chip pulses. Tactical feed events arrive on a staggered schedule, not all at once. Freeze frame timestamps freeze. Recent readings drift slightly.
- **Sound is silent — but motion is alive.** No audio in Phase 1. Compensate with restrained ambient motion (breath, drift, blink) so the room never looks paused.
- **Cut features, never depth.** When time is tight, drop a whole panel from Phase 1 before shipping a shallow version of every panel. The prioritization table in §15a defines the order.
- **Density is the feature.** Dense, calibrated information layout is itself the realism mechanism. Resist temptation to over-white-space for "cleanliness".
- **Failure modes feel real too.** A disconnected instrument shows a `— —` reading, not `null`. A missing schematic shows a typed placeholder card with a plausible "fetch failed at 14:02:11" line, not an empty div.

## 1. Anchors and Decisions (resolved with user)

- **Stack**: vanilla TS + CSS variables + light GSAP, **Konva only for the central workbench overlay**. No React/Tailwind/Framer Motion.
- **Architecture**: mirror `rooms/forge-room/` shape exactly (manifest.json + host/state pattern + ui/panels/ + main-functions/).
- **Phase 1 output**: plan + **interactive prototype** with mock state — must already feel operational, no real backend/camera/AI/persistence.
- **Governing priority**: perceived operational realism > implementation completeness (see §0).
- **Visual fidelity**: reference screenshot as design DNA, not pixel-perfect blueprint; preserve 4 systems + dark graphite + muted cyan/amber palette + forensic atmosphere.
- **AI integration**: AİÖ-shaped contracts — mock data, but event/command shapes mirror Forge Room's `commandSpecs` + `protocolSpecs` pattern so later phases can swap mocks without UI rework.
- **New dependency**: `konva` (not currently in `package.json`). Pinned, dynamic-imported only inside the workbench overlay engine — never reaches other rooms or the shell.

---

## 2. Repository Integration

### Folder skeleton
```
rooms/repair-room/
├── manifest.json
├── i18n/
├── shared/
│   ├── assets/                    (nav-icon.svg, room-background.svg, mock pcb images)
│   ├── data/                      (mock sessions, mock knowledge packs, mock measurements)
│   ├── types/                     (RepairSession, RepairEvent, OperatorProfile, …)
│   ├── ui/state.ts                (UI state shape — analogue of ForgeUiState)
│   └── repair-constants.ts        (room id, feature id, command names, protocol keys)
├── host/
│   ├── runtime.ts                 (room runtime entry; mock dispatcher in Phase 1)
│   ├── repair-room-commands.ts
│   └── state/                     (actions / reducer / state / store / selectors)
├── main-functions/
│   └── repair-workbench/
│       ├── protocols/             (placeholder .md scenario protocols for AİÖ)
│       └── assets/                (workbench-view.svg)
└── ui/
    ├── index.html
    ├── bootstrap.ts
    ├── index.ts                   (createRepairRoomUiRuntime().start())
    ├── repair-room-ui-runtime.ts  (renderer + state subscription, mirrors forge runtime)
    ├── style.css                  (design tokens — see §7)
    ├── overlay/                   (Konva engine — isolated module)
    │   ├── overlay-stage.ts       (Konva.Stage + layers)
    │   ├── overlay-tools.ts       (annotation, AI mark, measurement pin, ruler)
    │   └── overlay-coords.ts      (image-space ↔ stage-space mapping, 10mm grid)
    └── panels/
        ├── panel-shell.ts
        ├── session-rail-panel.ts
        ├── workbench-stage-panel.ts
        ├── tactical-feed-panel.ts
        ├── session-wizard-panel.ts
        ├── knowledge-pack-panel.ts
        ├── visual-timeline-panel.ts
        ├── operator-profile-panel.ts
        ├── chat-panel.ts
        └── measurement-panel.ts
```

### Registration
- New entry in `config/rooms.json` after build via the standard `npm run rooms:build` pipeline — no manual change.
- Side-nav icon auto-hydrated by `RoomRegistry` + `syncInstalledRoomChrome` (see `@/home/raistlin/hayalet-ev/src/js/app/room-ui.ts:11-71`).
- Scene hotspot defined in `manifest.json` `scene.roomsHotspot` so the immersive corridor view can route to Repair Room.

### Manifest highlights (Phase 1)
- `id: "repair-room"`, `defaultFeatureId: "repair-workbench"`.
- Single feature `repair-workbench` with **mock-stub** `commandSpecs` (one entry per UI command in §6) and **placeholder** `protocolSpecs` (file paths exist but content is TODO). This wires the contract surface without forcing AI plumbing.
- `menu.label: "Repair Room"`, `menu.icon: "RR"`, `menu.order: 90` (above Forge `95`).

---

## 3. Component Hierarchy

```
RepairRoomShell
├── RepairStatusBar                ("Repair Room v1.0.0 • All systems operational")
├── RepairWorkspaceGrid            (CSS grid — see §4)
│   ├── SessionRailPanel           (left column, full height)
│   │   ├── SessionListGroup
│   │   ├── ArchiveAccessor
│   │   └── ActiveSessionCard       (device, board code, S/N, risk level, status)
│   │
│   ├── WorkbenchStagePanel        (center, dominant)
│   │   ├── LiveStreamHeader        (LIVE chip, fps, zoom, focus, grid toggle, snapshot, record)
│   │   ├── ViewportShell
│   │   │   ├── PCBImageLayer       (mock png/svg of board)
│   │   │   ├── OverlayKonvaStage   (Konva.Stage — see §8)
│   │   │   │   ├── GridLayer       (10mm reference)
│   │   │   │   ├── AIHighlightsLayer
│   │   │   │   ├── AnnotationLayer
│   │   │   │   ├── MeasurementPinsLayer
│   │   │   │   └── FocusOverlayLayer ("AI SUGGESTION" callouts)
│   │   │   └── CoordinateHUD       (X / Y / W / H / GRID readout, bottom-left)
│   │   └── WorkbenchToolbar        (annotation tools, undo, redo, layer, freeze)
│   │
│   ├── TacticalFeedPanel          (right-center column)
│   │   ├── FeedEventList           (RISK / SUGGESTION / ACTION / INFO entries — no chat bubbles)
│   │   └── FeedComposer            (read-only "Ask AİÖ…" — Phase 1: routes to ChatPanel)
│   │
│   ├── SessionWizardPanel         (right column, top)
│   │   ├── WizardStepper           (Device Info → Symptoms → AI Research → Ready)
│   │   ├── ResearchProgressList    (mock streaming bullets)
│   │   └── ResourcePreviewGrid     (Schematic.pdf, Board.jpg, Common Failures)
│   │
│   ├── KnowledgePackPanel         (right column, bottom)
│   │   ├── PackHeader              (model number + ATX Power Supply)
│   │   ├── PackStatsList           (Schematics 3, Board Images 8, Common Failures 7, …)
│   │   ├── PackPreviewTabs         (Schematic Preview / Board View / Notes)
│   │   └── AddToSessionCTA
│   │
│   └── BottomDock                  (4-column grid, sticky)
│       ├── OperatorProfilePanel    (tabs: Profile Overview / Tools & Equipment / Skills / Preferences)
│       ├── ChatPanel               (AİÖ Chat — Session Özeli; structured turns, not bubbles)
│       ├── MeasurementPanel        (tabs: Multimeter / Power Supply / Signal Gen + recent readings)
│       └── VisualTimelinePanel     (full-width band above bottom dock — see §9)
└── RepairLegendBar                 (Snapshot / AI Mark / Measurement / Note / Risk legend + storage + Room Sync)
```

---

## 4. Layout Structure

Single CSS grid, dense, no empty dashboard feel.

```
┌─ status bar ──────────────────────────────────────────────────────────────┐
├─ session rail │ workbench stage    │ tactical feed │ wizard / pack stack ─┤
│  220px        │ 1fr (dominant)     │ 320px         │ 360px                │
│               │                    │               │                      │
│               │                    │               │                      │
├───────────────┴────────────────────┴───────────────┴──────────────────────┤
│ visual timeline (full-width strip)                                         │
├───────────────┬────────────────────┬───────────────┬──────────────────────┤
│ operator      │ chat (AİÖ)         │ measurement   │ (knowledge pack tail)│
│ profile       │                    │ panel         │  or empty if pack    │
│               │                    │               │  is collapsed up top │
└───────────────┴────────────────────┴───────────────┴──────────────────────┘
└─ legend / storage / room sync bar ───────────────────────────────────────┘
```

- Reference width target: `1600px` (matches `manifest.scene.referenceSize`).
- Bottom dock uses `grid-template-columns: 1.1fr 1.4fr 1.1fr 1.3fr` and is **dockable**: each panel can collapse to a 32px stub row (see §5).
- Workbench is **never** smaller than `min(60vw, 880px)`. Resize logic gives the workbench priority and shrinks side columns first.
- Sticky elements: status bar (top), legend bar (bottom), visual timeline (above bottom dock).

---

## 5. Panel Interaction Ideas

Panels are **modular dock cards**, not free-floating windows. Phase 1 keeps a fixed grid but each panel supports:

- **Collapse / Expand**: header double-click or chevron — collapses to a 32px stub row exposing only eyebrow + title + status dot. Preserves grid stability.
- **Pin / Unpin**: pinned panels resist auto-hide when entering Focus Mode.
- **Focus Mode** (workbench-only): keyboard `F` or focus icon — dims all non-workbench panels to 38% opacity, fades feed/timeline to ambient, deepens workbench border glow. Press `Esc` to exit.
- **Drag-to-resize gutters**: only between (session-rail ↔ workbench) and (workbench ↔ right column). Bottom dock columns share an equal-flex resizer.
- **State persistence**: panel collapse state + Focus Mode lives in `RepairUiState.layout` and is selector-driven, but **not** serialized to disk in Phase 1 (in-memory mock only).
- **Status dots**: every panel header has a tiny indicator — `idle` (graphite), `live` (cyan), `risk` (amber), `error` (soft red). Driven from selectors, never per-component state.
- **Keyboard shortcuts**: `1..9` focuses a panel; `F` focus mode; `Space` freeze-frame; `Z`/`X` zoom; `[` `]` timeline scrub; `R` snapshot; `M` measurement add; `A` annotation tool; `Esc` cancels current tool.

---

## 6. Session Workflow

A repair is a **session**. Phase 1 ships 4 mock sessions matching the screenshot (PSU-2025-0510 ATX Power Supply active; LG-OLED-MAIN, XBOX-SERIES-X, LENOVO-NOTE archived).

### Session lifecycle states (mock state machine)
1. `draft` — created from Session Wizard, no symptoms yet.
2. `research` — AI Research step running (mock progress events stream into feed and wizard).
3. `ready` — knowledge pack attached, workbench unlocked.
4. `in-progress` — active live workbench (only state where stage is non-modal).
5. `paused` — workbench frozen, timeline preserved.
6. `archived` — read-only; session rail shows archive group.

### Session creation flow (Session Wizard)
- **Step 1 Device Info**: model, board code, S/N, intake notes.
- **Step 2 Symptoms**: chip selector (No Power / Boot Loop / HDMI Dead / …) + free-text.
- **Step 3 AI Research**: streams 5 mock progress lines + 12 found resources (schematics, board images, repair threads, voltage rail notes).
- **Step 4 Ready**: composes Knowledge Pack, "Add to Session" CTA promotes the session to `in-progress`.

### Mock event seeding
- On `in-progress` transition, the runtime emits a deterministic 8–10 event seed into the tactical feed at 1.2s–3.0s intervals (risk → suggestion → action → info → snapshot → suggestion → measurement → info). All events are **structured records** matching §10 contracts, not raw strings.

---

## 7. Theme & Token System

Defined as CSS custom properties in `rooms/repair-room/ui/style.css` (mirrors `forge-room/ui/style.css`). No Tailwind. Tokens prefixed `--repair-*` to never collide with Forge tokens.

### Surface palette (dark graphite)
- `--repair-bg`: `#0a0d12`
- `--repair-bg-strong`: `#05080c`
- `--repair-panel`: `linear-gradient(180deg, rgba(15,19,26,0.97), rgba(9,12,17,0.97))`
- `--repair-panel-alt`: `linear-gradient(180deg, rgba(17,22,29,0.97), rgba(10,13,19,0.97))`
- `--repair-stage`: `#000408` (workbench viewport — true black-leaning)

### Line / border / text
- `--repair-border`: `rgba(170,196,214,0.10)` — thin, precise hairlines
- `--repair-border-strong`: `rgba(86,200,222,0.30)` — muted cyan, used only on active panel headers
- `--repair-text`: `#e2e8f0`
- `--repair-text-muted`: `#7d8b9d`
- `--repair-text-dim`: `#4f5a6a`

### Operational accents (restrained — never neon)
- `--repair-cyan`: `#56c8de` (LIVE, active session, measurements)
- `--repair-cyan-soft`: `rgba(86,200,222,0.18)`
- `--repair-amber`: `#e8a857` (suggestions, AI focus)
- `--repair-amber-soft`: `rgba(232,168,87,0.16)`
- `--repair-risk`: `#d97a7a` (risk events — soft red, never saturated)
- `--repair-success`: `#6fbf9a` (resolved, archived ok)
- `--repair-info`: `#8aa0bd` (info events)

### Typography
- `--repair-display`: `"Inter", "Segoe UI Variable Text", sans-serif` — panel titles
- `--repair-body`: same as display
- `--repair-mono`: `"IBM Plex Mono", "JetBrains Mono", monospace` — measurements, coordinates, S/N

### Spacing / radius / motion
- Grid spacing scale: `4 / 8 / 12 / 16 / 20 / 28` px.
- Panel radius: `14px` outer, `8px` inner cards.
- Glow rule: only headers + LIVE chip get `box-shadow: 0 0 0 1px var(--repair-border-strong), 0 8px 32px rgba(86,200,222,0.06)`. No diffuse neon glows anywhere else.
- Motion durations: `120ms` hover / `200ms` panel transitions / `420ms` Focus Mode / `680ms` first-mount cascade.
- Easing: `cubic-bezier(0.2, 0.8, 0.2, 1)` (same as Forge).

---

## 8. Overlay Interaction Concepts (Konva)

Konva is encapsulated inside `ui/overlay/` and is **the only place** Konva is imported. The rest of the UI sees an `OverlayController` interface so the renderer can be swapped later.

### Layer stack (bottom → top)
1. **PCB image layer** — HTMLImageElement painted into a `Konva.Image`. Source is a mock PNG/SVG per session.
2. **Grid layer** — 10mm reference grid (`Konva.Group` of `Konva.Line`). Toggle from toolbar.
3. **AI highlights layer** — semi-transparent bounded regions, dashed cyan outline + amber label chip. Hover reveals tooltip with risk/suggestion text. Click pins the event in the tactical feed.
4. **Annotation layer** — user-drawn shapes (rect, circle, freehand, arrow, text). Each annotation = persisted event in §10 schema.
5. **Measurement pins layer** — pin marker + value chip (e.g., `C101 — 0.000 V`). Pin is draggable; value comes from Measurement Panel.
6. **Focus overlay layer** — modal callouts ("AI SUGGESTION: High probability area. Check components in this zone." with "Focus Here" button) anchored to PCB coordinates.

### Coordinate system
- All annotations / pins / highlights stored in **image space** (board-relative px).
- `overlay-coords.ts` maps image space ↔ stage space, accounting for zoom/pan.
- Grid is always rendered in image space; physical scale label `10mm` derives from a session-level `pixelsPerMm` field (mock = 8).

### Tools (toolbar order matches reference)
- Select / pan / zoom-in / zoom-out / annotation-rect / annotation-freehand / annotation-text / measurement-pin / arrow / undo / redo / layer-visibility / freeze-frame.
- Active tool stored in `RepairUiState.workbench.activeTool` (typed union). Toolbar buttons are pure selectors.

### Freeze frame
- `Space` toggles `RepairUiState.workbench.isFrozen`.
- When frozen: LIVE chip switches to "FROZEN — 12:34:56" (timestamp), image layer stops updating (in Phase 1 it never updates anyway since input is static), AI highlights pause appearing, and a thin amber border traces the viewport.

### Zoom / pan
- Scroll-wheel + drag on viewport. Zoom range `0.5×–4×`. Pan clamps to image bounds.
- Coordinate HUD shows live `X / Y / W / H / GRID 16×16` readout (mock values).

---

## 9. Timeline Interaction Behavior

The **Visual Timeline** is the forensic evidence strip. Looks like DaVinci Resolve mixed with a frame-by-frame inspector.

### Track structure (Phase 1: single track row, layered chips)
- Time axis (top): minor ticks per second, major every 10s, labels every minute.
- Event chips render at their `occurredAt` time, color-coded:
  - cyan = Snapshot
  - amber = AI Mark
  - white-dot = Measurement
  - blue = Note
  - red = Risk Flag
  - graphite = Freeze Frame (long bar instead of chip)
- Each chip shows a 64×40 thumbnail (mock screenshot of the PCB at that moment) when zoom level ≥ 0.6.
- Currently inspected event has an inset glow + tick mark + crosshair drop-line into the chip.

### Interactions
- **Click chip** → inspector loads that event in the workbench (image swap if it has a thumbnail; tactical feed scrolls to event; measurement panel restores the reading).
- **Scrub bar** with playhead — drag scrubs through the session in chronological order, replaying mock events as a fast-forwarded ghost reel in the feed.
- **Zoom timeline**: pinch / scroll on the timeline only (separate from workbench zoom). Range `0.25×–4×`.
- **Range select** (`Shift+drag`): selects a band; legend bar shows "3 events selected"; future export hook is a no-op TODO chip.
- **Keyboard**: `[` previous event, `]` next event, `Home` go to session start, `End` go to live edge, `,` `.` nudge playhead 1s.

### Live edge behavior
- A pulsing cyan vertical line marks "now". When the session is `in-progress`, new mock events stream in at the live edge and the timeline auto-scrolls only if the playhead is already at live edge (otherwise stays put — same UX as Discord/Slack live tail).

---

## 10. Operator Profile Structure

Lives in `rooms/repair-room/shared/types/operator-profile.ts` and is exposed through `OperatorProfilePanel`. Drives AI guidance adaptation (mocked in Phase 1).

### Schema (typed, AİÖ-shaped)
```ts
type RepairOperatorProfile = {
  schemaVersion: 1;
  profileId: string;
  displayName: string;
  bench: {
    tools: RepairTool[];
    consumables: RepairConsumable[];
    safety: RepairSafetyItem[];
  };
  skills: RepairSkillRecord[];        // soldering, smd, bga, smps, microscope work, …
  preferences: {
    measurementSystem: "metric" | "imperial";
    annotationDefaults: { color: string; strokeWidth: number };
    riskTolerance: "low" | "medium" | "high";
    aiVerbosity: "terse" | "standard" | "detailed";
  };
  updatedAt: string;
};

type RepairTool = {
  id: string;
  category: "soldering" | "measurement" | "vision" | "power" | "other";
  label: string;                       // "FNIRSI DMT-99 Digital Multimeter"
  capabilities: string[];              // ["DC Voltage", "AC Voltage", "Resistance", …]
  available: boolean;
  model?: string;
  notes?: string;
};
```

### Panel tabs (mirror screenshot)
1. **Profile Overview** — name, primary specialty, tool count, recent sessions.
2. **Tools & Equipment** — grouped checklists (Soldering / Measurement / Other) + capability card on the right for the selected tool (the screenshot's "FNIRSI DMT-99" detail card is the template). Edit Profile CTA.
3. **Skills** — chip cloud with proficiency dots (1–5).
4. **Preferences** — small form.

### AI adaptation mock
- A selector `selectAiAdaptation(profile, session)` returns hints like `{ skipOscilloscopeSuggestions: true, suggestThermalCameraAlternatives: false }`. The tactical feed mock generator consumes these hints, so e.g. if `bench.tools` lacks an oscilloscope, the seeded events propose multimeter-only fallbacks. Demonstrates the contract without wiring real AI.

---

## 11. Motion Language

Calm, dense, never showy. Three layers of motion:

- **Ambient breath**: LIVE chip pulses cyan at 1.6Hz amplitude `0.85→1.0` opacity. Active session card has a soft 4s inhale/exhale on its left rail. Risk indicators slow-blink at 0.6Hz.
- **Operational transitions**: panels mount with a staggered 60ms cascade `translateY(8px) opacity 0 → 0`, duration `420ms`. Tab swaps cross-fade `160ms`. Tool selection has an instant `border-color` snap (no easing — feels mechanical).
- **Forensic emphasis**: when a tactical feed event arrives, the event card flashes its accent color for `200ms` then settles; the timeline chip pops in with a `scale(0.92→1)` + `opacity 0→1` `220ms` cubic. Selecting an event causes the workbench overlay to perform a `380ms` zoom-pan toward the region with a thin guide-line trace (Konva tween).

GSAP is used **only** for: (a) panel mount cascade, (b) workbench zoom-pan toward selected events, (c) Focus Mode dim/restore. All other motion is CSS transitions/keyframes. No spring physics, no parallax, no bloom.

---

## 12. AİÖ-Shaped Contracts (mock, contract-stable)

All mock events flow through typed contracts so a future phase can replace the mock dispatcher without UI changes.

### UI command surface (mirrors Forge's `FORGE_UI_COMMANDS`)
Defined in `shared/repair-constants.ts`:

```
REPAIR_UI_COMMANDS = {
  uiReady, createSession, updateSession, archiveSession,
  startResearch, completeResearch, attachKnowledgePack,
  setActiveTool, toggleFreezeFrame, addAnnotation, removeAnnotation,
  addMeasurement, addAiMark, dismissAiMark,
  addTimelineNote, jumpToEvent, scrubTimeline,
  updateOperatorProfile, setLayoutState, openPanel, collapsePanel,
}
```

Each maps 1:1 to a `commandSpec` entry in `manifest.json` so the surface is discoverable at runtime.

### Event record shape (single discriminated union)
```ts
type RepairEvent =
  | { kind: "snapshot"; … }
  | { kind: "ai-mark"; severity: "info" | "suggestion" | "risk"; region: ImageRect; rationale: string; … }
  | { kind: "measurement"; instrumentId: string; channel: string; value: number; unit: string; … }
  | { kind: "annotation"; tool: AnnotationTool; geometry: …; }
  | { kind: "note"; author: "operator" | "ai"; text: string; … }
  | { kind: "freeze-frame"; durationMs: number; … }
  | { kind: "risk-flag"; severity: "low" | "medium" | "high"; … };
```

Each event has `id`, `sessionId`, `occurredAt`, `source: "operator" | "ai" | "instrument"`, optional `linkedEventIds`. This is the timeline + feed + workbench overlay's **single source of truth**.

### Protocol scenarios (placeholders)
- `repair-room-knowledge-research` (knowledge pack generator)
- `repair-room-tactical-observer` (live tactical feed events)
- `repair-room-measurement-coach` (measurement panel suggestions)
- `repair-room-risk-detector`

Files exist as TODO markdown under `main-functions/repair-workbench/protocols/` so the manifest validates; bodies are written in a later phase.

### Mock dispatcher (Phase 1)
- `host/runtime.ts` exposes `dispatchRepairCommand(command, payload)` returning a typed Promise.
- For Phase 1, every command resolves against a deterministic mock generator in `shared/data/mock-events.ts`. Random seed is session-id so reloads are reproducible.

---

## 13. State Architecture (vanilla, Zustand-shaped)

Mirrors `rooms/forge-room/host/state/`:

- `repair-runtime-state.ts` — full state shape (`RepairRuntimeState`).
- `repair-runtime-actions.ts` — discriminated action union.
- `repair-runtime-reducer.ts` — pure reducer.
- `repair-runtime-store.ts` — tiny subscribe/getState/dispatch store (no library).
- `repair-selectors.ts` — memoized selectors consumed by every panel.

The UI runtime in `ui/repair-room-ui-runtime.ts` subscribes once, diffs selector outputs, and calls each panel's `update(state)` method. Each panel exposes `mount()`, `update(state)`, `unmount()` — same shape as Forge panels.

State slices:
- `sessions` — list, activeId, archive.
- `activeSession` — derived: `RepairSessionDetail` with timeline events.
- `workbench` — activeTool, isFrozen, zoom, pan, visibleLayers, hoveredEventId, focusMode.
- `tacticalFeed` — derived from active session events filtered to feed-eligible kinds.
- `wizard` — step, draftDeviceInfo, draftSymptoms, researchProgress, foundResources.
- `knowledgePack` — current pack, attached flag, preview tab.
- `operatorProfile` — full profile + dirty flag.
- `measurement` — instrumentTabs, currentReading, recentReadings.
- `chat` — turns[] (structured, not bubbles), composerDraft.
- `layout` — panel collapse map, dock sizes, focusMode.

---

## 14. Mock Data Inventory (`shared/data/`)

All files are pure data exports — no logic.

- `mock-sessions.ts` — 4 sessions matching the screenshot (PSU active + 3 archived).
- `mock-knowledge-packs.ts` — BN44-00932A pack (ATX Power Supply): 3 schematics, 8 board images, 7 common failures, 12 repair notes, 18 test points.
- `mock-pcb-images.ts` — references to mock PCB images shipped under `shared/assets/mock-pcb/`.
- `mock-events.ts` — deterministic seed of ~28 events per session for timeline replay.
- `mock-operator-profile.ts` — operator with FNIRSI DMT-99, TS101 iron, 0.6mm solder, flux, microscope, ESD mat. No oscilloscope (drives adaptation demo).
- `mock-tactical-feed.ts` — generator that maps event stream → feed entries with relative timestamps.
- `mock-chat-turns.ts` — 4-turn structured exchange mirroring the screenshot.

---

## 15. Implementation Phases (after plan approval)

Each phase ends green: typecheck + `rooms:test:core` + visual verification via existing room runner.

1. **P1.0 — Scaffold (read-only, no UI)**: create folder skeleton, manifest, constants, types, mock data, room registers and shows empty page. Add `konva` to `dependencies`. Update `rooms:test:core` glob to pick up new room manifest regression test.
2. **P1.1 — Shell + tokens + ambient layer**: status bar with ticking clock, grid layout, legend bar, design tokens applied, panels mount as cards with realistic headers (eyebrow + title + live status dot already wired). LIVE chip pulses from day one.
3. **P1.2 — Session rail + wizard**: session list works, active session selection drives state, wizard 4-step flow with **staggered** mock progress (not instant), realistic device codes / board codes / S/N values.
4. **P1.3 — Workbench (no overlay yet)**: PCB image swap on session change, toolbar buttons toggle state, freeze-frame border with frozen timestamp string, coordinate HUD with mock numbers that update on simulated cursor.
5. **P1.4 — Konva overlay engine**: layers wired, grid render, click-to-add annotation, measurement pin add from Measurement Panel, AI highlights stream in from mock events with delay (not all at once), focus callout for the active suggestion.
6. **P1.5 — Tactical feed + chat**: structured event entries with relative timestamps (`+00:14`, `+02:31`), severity styling, click → jump to event; chat panel as structured turns with a draft composer that *accepts input* and queues a deterministic mock AİÖ reply after 800–1400ms so it never feels dead.
7. **P1.6 — Visual timeline**: chips, thumbnails, scrub, keyboard nav, live edge pulse, drifting playhead while session is `in-progress`.
8. **P1.7 — Knowledge pack + operator profile + measurement panel**: tabs, mock data binding, edit profile flow (in-memory), measurement panel "Recent Readings" list with realistic drift (`0.000 V` → `0.002 V` → `OL`) on a slow interval.
9. **P1.8 — Motion + focus mode + keyboard**: GSAP cascade, focus mode dim, full shortcut map. Realism polish pass: ambient timestamps, status dots, micro-jitter on idle indicators, panel mount cascade.
10. **P1.9 — Regression tests**: at minimum — manifest regression, ui-smoke regression, state reducer unit tests, overlay coord mapping tests, mock event determinism test, ambient-tick clock test (clock advances by 1s per second under fake timers).

Phase 1 ends here. Real camera / real AİÖ / persistence / handoff are out of scope.

## 15a. Realism Prioritization Table

When time is tight, descend this table. Cut entire rows before degrading rows above them.

| Tier | Surface | Realism is preserved by | Acceptable to cut in Phase 1 |
| --- | --- | --- | --- |
| **R1 — non-negotiable** | Workbench stage + PCB image + freeze frame + LIVE chip | Pulsing LIVE, ticking timestamp, coordinate HUD that responds to cursor, freeze stamp string, dense toolbar | nothing in this tier |
| **R1** | Active session card + session rail | Active session always present on load (no empty state), risk badge, board code + S/N visible, archive list populated | new-session creation can be a no-op if needed |
| **R1** | Tactical feed | Staggered mock event stream, severity coloring, relative timestamps, click→jump | composer wiring (read-only OK) |
| **R1** | Visual timeline | Event chips with thumbnails, live edge pulse, click→jump, playhead drift while in-progress | range select, export hooks, timeline-only zoom |
| **R2 — high value** | Konva overlay (AI highlights + measurement pins + annotation pass-through) | Highlights appear with timing, focus callout anchored to a region, pins draggable, single annotation tool functional | second/third annotation tool, undo/redo, layer toggles |
| **R2** | Operator profile (Tools & Equipment tab) | Realistic FNIRSI DMT-99 detail card, populated tool checklist, ESD/microscope items | Skills & Preferences tabs can be visual-only |
| **R2** | Measurement panel | Multimeter tab with live-drift "DC Voltage" readout + recent readings list with drift | Power Supply / Signal Gen tabs can be visual-only |
| **R2** | Knowledge Pack viewer | BN44-00932A header, populated stats list, schematic preview image, "Add to Session" CTA fires a real state action | Board View / Notes tabs can be visual-only |
| **R3 — atmospheric** | Session Wizard | 4-step shell with staggered mock research stream | Step 1/2 forms can accept input without validation |
| **R3** | Chat panel | Structured turns visible, composer accepts input, deterministic mock reply | conversation history persistence |
| **R3** | Focus mode + full keyboard map | `F` / `Esc` / `Space` / `[` / `]` / `R` / `M` / `A` minimum | remaining shortcuts |
| **R4 — defer freely** | Panel docking, drag-to-resize gutters, range select on timeline, undo/redo, edit-profile persistence beyond memory | — | entire tier can be deferred to Phase 2 without harming realism |

**Cutting rule**: if a tier-R4 surface must be skipped, hide it cleanly (no disabled buttons, no greyed-out tooltips). The room must look complete at every cut point.

---

## 16. Open Questions for Next Phases (not blocking Phase 1)

- Real camera ingest path — Electron `desktopCapturer` vs USB UVC capture? Defer.
- Knowledge Pack source — does AİÖ run a Forge-style protocol, or a dedicated research room? Defer.
- Measurement hardware bridge — USB/serial vs operator manual entry? Defer.
- Persistence layer — file-based (forge-style `*-session-storage.ts`) vs libsql? Defer; Phase 1 is in-memory only.
- Handoff to / from Forge Room — do completed repairs become Forge handoff packages? Defer.

---

## 17. Risk Notes

- **Konva bundle size**: ~140KB gzipped. Dynamic-import inside the overlay module so it does not load when the room is not active.
- **Visual density vs readability**: dense grids can become unreadable below 1366×768. Define a soft min-resolution guard banner if viewport < 1280×800; do not redesign for tablet in Phase 1.
- **Mock determinism**: seeded by `sessionId` so dev runs are reproducible. Avoid `Math.random()` in mock generators.
- **Token namespace collisions**: all CSS vars prefixed `--repair-*`. Audit step in P1.1.
- **Manifest schema drift**: validate against `tsconfig.rooms.json` regression tests early in P1.0.
