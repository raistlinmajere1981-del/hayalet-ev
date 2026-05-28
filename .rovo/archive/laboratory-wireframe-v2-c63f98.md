# Laboratory Analysis Room — Wireframe v2 (Deterministic Spec)

Implementation-ready wireframe specification. Every behavior is boolean-gated, every mapping is tabled, every edge case is defined.

---

## 1. Final Layout

```
┌───────────────────────────────────────────────────────────────────────────┐
│ TOP BAR  (48px, sticky top, full width)                                   │
├───────────────────────────────────────────────┬───────────────────────────┤
│                                               │                           │
│  CENTER STAGE  (fluid, min 60vw)              │  RIGHT DRAWER (22rem)     │
│                                               │                           │
│  ┌───────────────────────────────────┐        │  Mode: Setup | Running |  │
│  │ SOURCE BAR (compact summary)     │        │        Result | Explore   │
│  ├───────────────────────────────────┤        │                           │
│  │                                   │        │  (content per §4)         │
│  │       MEDIA VIEWPORT              │        │                           │
│  │                                   │        │                           │
│  ├───────────────────────────────────┤        │                           │
│  │ TIMELINE (waveform + selection)   │        │                           │
│  ├───────────────────────────────────┤        │                           │
│  │ FOCUS CONTROLS (collapsed default)│        │                           │
│  └───────────────────────────────────┘        │                           │
│                                               │                           │
├───────────────────────────────────────────────┴───────────────────────────┤
│ PROCESS STRIP  (56px, sticky bottom, full width)                          │
└───────────────────────────────────────────────────────────────────────────┘
```

**Grid:** `grid-template-columns: minmax(0, 1fr) 22rem`
**Rows:** `grid-template-rows: 48px minmax(0, 1fr) 56px`

---

## 2. Mode System (Deterministic)

Drawer mode is derived — never user-toggled directly.

### MODE: Setup

```
ENTER:
  isRunActive(state) === false

EXIT:
  isRunActive(state) === true

ON ENTER:
  - source intake section: expanded if getSourceReady(state) === false, collapsed if true
  - intents section: visible only when getSourceReady(state) === true
  - preflight section: visible only when getSelectedIntents(state).length > 0
  - hero CTA: "Analizi Başlat" (disabled when getAnalysisActionBlockReason(state) !== null)

ON EXIT:
  - source intake collapse state preserved
  - selected intents preserved
  - transition to Running mode

GUARD:
  - if source changes during Setup (sourceProbeStatus transitions), re-render source intake
  - if all intents deselected, hide preflight and disable CTA
```

### MODE: Running

```
ENTER:
  isRunActive(state) === true

EXIT:
  isRunActive(state) === false

ON ENTER:
  - pipeline section renders from getCurrentRun(state).moduleOrder
  - early signals section renders from getCurrentRun(state).liveFindings
  - run snapshot freezes: getWorkspaceAnalysisInput(state) at entry (display only)

ON EXIT:
  - pipeline state preserved in last render (no clear)
  - early signals cached (remain visible until next mode enter)
  - transition to:
    hasReportPayload(state) === true → Result
    hasReportPayload(state) === false → Setup

GUARD:
  - source change NOT possible during Running (existing source-lock behavior)
  - drawer does NOT switch to Setup if user clicks configure — blocked during run
```

### MODE: Result

```
ENTER:
  isRunActive(state) === false
  AND hasReportPayload(state) === true
  AND getReportFreshness(state).state === "current"

EXIT:
  isRunActive(state) === true → Running
  OR user triggers Explore toggle → Explore

ON ENTER:
  - Decision Surface renders from getLaboratoryRightPanelContext(state)
  - Coherence/Readiness/Bridge sections: collapsed by default
  - Report CTA: enabled
  - Freshness badge: renders getReportFreshness(state)

ON EXIT to Running:
  - result display cleared on next Running enter
ON EXIT to Explore:
  - result display preserved, Explore sections appended below

GUARD:
  - if workspace becomes dirty (isWorkspaceDirty === true), show "Workspace farklı" badge
```

### MODE: Explore

```
ENTER:
  isRunActive(state) === false
  AND hasReportPayload(state) === true
  AND (
    getReportFreshness(state).state === "previous-run"
    OR getReportFreshness(state).state === "stale"
    OR user explicitly toggled from Result
  )

EXIT:
  isRunActive(state) === true → Running
  OR user toggles back to Result → Result

ON ENTER:
  - Alternatives section: renders from getActiveExecutionAlternatives(state)
  - Comparison: renders from getWorkspaceDiff(state)
  - Tweak controls: selectedIntents, timelineSelection, hypothesis editable
  - Hero CTA: "Tekrar Analiz Et"

ON EXIT:
  - edits to intents/timeline/hypothesis persisted to store (normal field behavior)

GUARD:
  - if source removed, force → Setup
```

### Mode Resolution Function (pseudo-code)

```typescript
function resolveDrawerMode(state: LabStoreState): "setup" | "running" | "result" | "explore" {
  if (isRunActive(state)) return "running";
  if (!hasReportPayload(state)) return "setup";
  const freshness = getReportFreshness(state);
  if (freshness?.state === "current" && !userExploreToggle) return "result";
  return "explore";
}
```

`userExploreToggle` is a UI-only boolean in `LabWorkspaceUiState`, default `false`, reset to `false` on every run start.

---

## 3. Component State Machines

### 3.1 Media Viewport

| State | Condition | Visual |
|-------|-----------|--------|
| `empty` | `getSourceReady(state) === false && sourceProbeStatus === "idle"` | Empty placeholder: "Kaynak seçin" |
| `loading` | `sourceProbeStatus === "running"` | Skeleton shimmer over viewport area |
| `active` | `getSourceReady(state) === true` | Media element (video/audio/image) with overlays |
| `error` | `sourceProbeStatus === "failed"` | Error card: probe failure message |

**Sync rules:**
- Viewport re-renders on `sourceProbeStatus` change
- ROI overlays render only in `active` state
- Interactive filters (brightness etc.) apply only in `active` state
- During `isRunActive(state) === true`: viewport is read-only (no new ROI creation), existing overlays remain

### 3.2 Timeline

| State | Condition | Visual |
|-------|-----------|--------|
| `hidden` | `durationMs === 0` | Not rendered |
| `idle` | `durationMs > 0 && isRunActive(state) === false` | Waveform + draggable selection handles |
| `locked` | `durationMs > 0 && isRunActive(state) === true` | Waveform visible, selection handles disabled, run markers overlay |
| `error` | Waveform data failed to load | Fallback bar with time labels only |

**Sync rules:**
- Timeline selection writes to `state.ui.workspace.timelineStartMs / timelineEndMs`
- When `activeSelection !== null`, timeline highlights that range
- Bookmark markers always visible in `idle` and `locked` states

### 3.3 Right Drawer

| State | Condition | Visual |
|-------|-----------|--------|
| `setup` | See §2 MODE: Setup | Source intake + intents + preflight + CTA |
| `running` | See §2 MODE: Running | Pipeline + early signals + snapshot + Cancel |
| `result` | See §2 MODE: Result | Decision Surface + advisories + Report CTA |
| `explore` | See §2 MODE: Explore | Alternatives + comparison + tweak + Re-analyze |
| `collapsed` | User clicked drawer collapse toggle | 0-width, edge icon to re-open |

**Sync rules:**
- Drawer mode derived from `resolveDrawerMode(state)` — never stale
- Collapse is independent of mode (collapsed drawer still tracks mode internally)
- On un-collapse, renders current mode content immediately

### 3.4 Process Strip

| State | Condition | Visual |
|-------|-----------|--------|
| `idle` | `getLaboratoryProcessSummary(state).state === "idle"` | All dots hollow, label: "Hazır" |
| `processing` | `summary.state === "processing"` | First dot pulsing, task label, no percentage |
| `analyzing` | `summary.state === "analyzing"` | Dots fill per module progress, percentage bar, elapsed timer |
| `staging` | `summary.state === "staging"` | All analysis dots filled, staging dot pulsing |
| `complete` | `isRunComplete(state) === true && !isRunActive(state)` | All dots filled green, "Tamamlandı" + elapsed |
| `error` | `getCurrentRun(state)?.state === "failed"` | Failed dot red, error message, "Tekrar Dene" link |

**Sync rules:**
- Strip updates on every store change that affects `getLaboratoryProcessSummary(state)`
- Elapsed timer: `getRunElapsedSeconds(state)` — updates every second during `analyzing`
- Expand toggle reveals recent actions (`getUserActions(state).slice(0, 5)`) and raw log

### Cross-Component Sync Matrix

| Event | Media Viewport | Timeline | Right Drawer | Process Strip |
|-------|---------------|----------|--------------|---------------|
| Source loaded | → `active` | → `idle` | stays `setup` | stays `idle` |
| Analysis started | read-only | → `locked` | → `running` | → `analyzing` |
| Analysis completed | read-only off | → `idle` | → `result` | → `complete` |
| Analysis failed | read-only off | → `idle` | → `setup` or `explore` | → `error` |
| Source changed | re-renders | re-renders | → `setup` | → `idle` |

---

## 4. Interaction Rules

### 4.1 Timeline ↔ Viewport Sync

| Action | Behavior |
|--------|----------|
| **Selection start (mousedown on timeline)** | Video seeks to selection start position. `YES`. |
| **Selection drag (mousemove)** | Video does NOT seek in realtime. Selection range updates visually on timeline only. `NO realtime preview`. |
| **Selection end (mouseup)** | Video seeks to selection start position (final). `YES — seek to start, not end`. |
| **Hover over timeline** | No preview. `NO hover preview`. |
| **Bookmark click** | Video seeks to bookmark `timeMs`. Timeline scrolls to center that position. `YES`. |
| **ROI focus toggle** | Timeline zooms to active selection range. Video seeks to selection start. |
| **Playback position update** | Timeline playhead marker follows video `currentTime`. |

### 4.2 Analysis Lock Rules

During `isRunActive(state) === true`:
- Source intake: disabled (existing source-lock)
- Timeline selection handles: disabled
- ROI creation: disabled
- Existing ROIs: visible but not editable
- Intent selection: disabled
- Hypothesis input: disabled
- Focus controls (B/C/γ/EQ): remain interactive (viewing tools, not analysis params)

### 4.3 Drawer Collapse

- **Toggle button:** persistent on the right edge of center stage, vertical `«` / `»` icon
- **Collapsed state:** drawer width → 0, center stage takes full width
- **Keyboard shortcut:** `Ctrl+B` (toggle)
- **On collapse:** no content destruction — mode tracking continues
- **On expand:** instant render of current mode content

---

## 5. Intent Preview System

### Input

```typescript
type IntentPreviewInput = {
  selectedIntents: LabIntentId[];         // from getSelectedIntents(state)
  timelineSelection: { startMs: number; endMs: number };  // from getTimelineSelection(state)
  hypothesis: string;                     // from getHypothesis(state)
};
```

### Output Format (deterministic template)

```
"Bu analiz [SCOPE] üzerinde [ACTION] gerçekleştirerek [EXPECTED_OUTPUT] tespit edecek."
```

Where:
- `[SCOPE]` = timeline range formatted as `MM:SS – MM:SS`, or `tüm kaynak` if full range
- `[ACTION]` = joined intent action phrases (comma-separated)
- `[EXPECTED_OUTPUT]` = joined intent expected outputs

### Action Phrase Map (per intent)

| Intent ID | Action Phrase | Expected Output Phrase |
|-----------|--------------|----------------------|
| `visual-inspection` | `görsel yapıyı ve forensic işaretleri inceleyerek` | `yapısal anomaliler ve forensic kanıtlar` |
| `audio-investigation` | `ses sinyallerini analiz ederek` | `ses anomalileri ve sinyal detayları` |
| `detail-enhancement` | `transkript ve kaynak ayrıştırma yaparak` | `konuşma dökümleri ve ayrıştırılmış ses kaynakları` |
| `anomaly-detection` | `görsel ve işitsel anomali taraması yaparak` | `olası anormallikler ve sınıflandırılmış ses olayları` |

### 3 Concrete Examples

**Example 1: motion + anomaly, full source (02:48)**
```
"Bu analiz tüm kaynak (02:48) üzerinde görsel yapıyı ve forensic işaretleri inceleyerek,
görsel ve işitsel anomali taraması yaparak yapısal anomaliler, forensic kanıtlar,
olası anormallikler ve sınıflandırılmış ses olayları tespit edecek."
```

**Example 2: audio only, full source**
```
"Bu analiz tüm kaynak (01:24) üzerinde ses sinyallerini analiz ederek
ses anomalileri ve sinyal detayları tespit edecek."
```

**Example 3: anomaly detection, narrow selection 0:30–1:00**
```
"Bu analiz 00:30 – 01:00 aralığında görsel ve işitsel anomali taraması yaparak
olası anormallikler ve sınıflandırılmış ses olayları tespit edecek."
```

**Hypothesis append rule:** If `hypothesis.trim().length > 0`, append:
`" Hipotez: "{hypothesis}""` to the end.

---

## 6. Decision Surface → UI Mapping

### Candidate

| `candidate.status` | UI Label | Accent Color | Implication Text |
|---------------------|----------|--------------|------------------|
| `"viable"` | `"Geçerli"` | `--labx-success` | `"Yapısal olarak çalıştırılabilir"` |
| `"unstable"` | `"Dengesiz"` | `--labx-warning` | `"Yapı eksik — değerlendirme gerekli"` |
| `"not-viable"` | `"Geçersiz"` | `--labx-error` | `"Geçersiz — yol revizyonu gerekli"` |
| `null` | `"—"` | none | `"Değerlendirme bekleniyor"` |

### Commitment

| `commitment.status` | UI Label | Accent | Implication |
|---------------------|----------|--------|-------------|
| `"committed"` | `"Onaylandı"` | `--labx-success` | `"Yol staging için seçildi"` |
| `"revoked"` | `"İptal Edildi"` | `--labx-error` | `"Onay geri çekildi"` |
| `"inactive"` / `null` | `"—"` | none | `"Henüz onaylanmış yol yok"` |

### Staging

| `staging.status` | UI Badge | Accent | Implication |
|------------------|----------|--------|-------------|
| `"staged"` | `"Hazır"` | `--labx-accent` | `"Çalıştırma için hazırlandı"` |
| `"not-staged"` | `"Beklemede"` | none | `"Henüz hazırlanmadı"` |
| `null` | `"—"` | none | `"Staging hazırlığı bekleniyor"` |

### Coherence → Polarity Bar

| `coherence.state` | Bar Fill % | Color | Label |
|--------------------|-----------|-------|-------|
| `"aligned"` | `confidence * 100` | `--labx-success` | `"Uyumlu"` |
| `"mixed"` | `confidence * 100` | `--labx-warning` | `"Karışık"` |
| `"conflicted"` | `confidence * 100` | `--labx-error` | `"Çelişkili"` |

Bar is a horizontal segment: colored fill from left, `confidence` determines fill width (0–1 → 0%–100%).

---

## 7. Coherence / Readiness / Bridge Display Rules

### Default State

All three sections render as `<details>` elements. Default: **collapsed**.

### Auto-Expand Conditions

| Section | Auto-Expand When |
|---------|-----------------|
| **Coherence** | `coherence.state === "conflicted"` |
| **Readiness** | `readinessSignal.level === "strained"` |
| **Bridge** | Never auto-expands |

### Non-Expert Summary (always visible as `<summary>`)

| Section | Summary Text Source |
|---------|-------------------|
| **Coherence** | `formatDecisionCoherenceAdvisory(coherence)` — single sentence |
| **Readiness** | `formatExecutionReadinessSignalAdvisory(signal)` — single sentence |
| **Bridge** | `formatExecutionBridgeAdvisory(bridge)` — single sentence |

### Expanded Detail Content

| Section | Detail Content |
|---------|---------------|
| **Coherence** | `state`, `dominantAxis`, `confidence` as labeled fields |
| **Readiness** | `level`, `decisionPressure`, `reasons[]` as list |
| **Bridge** | `adapter`, `operation`, `inputContract.required[]`, `outputContract.type` as labeled fields |

### Visibility Guard

All three sections render ONLY when their source data is non-null:
- Coherence: `getActiveExecutionCandidate(state) !== null` (coherence is derived during candidate build)
- Readiness: `getActiveExecutionReadiness(state) !== null`
- Bridge: `getActiveExecutionPlan(state) !== null`

---

## 8. Process Strip → Data Mapping

### Pipeline Dots

| `getExecutionJourneyStep(state)` | Dot 0 (Select) | Dot 1 (Plan) | Dot 2 (Evaluate) | Dot 3 (Decide) | Dot 4 (Stage) |
|-----------------------------------|------|------|----------|--------|-------|
| `-1` | `○` hollow | `○` | `○` | `○` | `○` |
| `0` | `◉` active | `○` | `○` | `○` | `○` |
| `1` | `●` done | `◉` | `○` | `○` | `○` |
| `2` | `●` | `●` | `◉` | `○` | `○` |
| `3` | `●` | `●` | `●` | `◉` | `○` |
| `4` | `●` | `●` | `●` | `●` | `◉` |

Dot styles:
- `○` hollow: `border: 2px solid var(--labx-text-dim)`, no fill
- `●` done: `background: var(--labx-success)`, no border
- `◉` active: `background: var(--labx-accent)`, `animation: labx-pulse 1.5s infinite`

### Progress Bar

| Source | Rendering |
|--------|-----------|
| `summary.totalCount > 0` | `width: (completedCount / totalCount * 100)%` |
| `summary.totalCount === 0` | Indeterminate bar (CSS animation, no percentage) |

### Elapsed Timer

| Source | Rendering |
|--------|-----------|
| `getRunElapsedSeconds(state)` | Format: `MM:SS` (e.g., `02:18`) |
| `isRunActive === false` | Timer stops, shows final value |

### Task Label

| `summary.state` | Label |
|-----------------|-------|
| `"idle"` | `"Hazır"` |
| `"processing"` | `summary.activeTaskLabel ?? "Kaynak hazırlanıyor…"` |
| `"analyzing"` | `summary.activeTaskLabel ?? "Analiz devam ediyor…"` |
| `"staging"` | `summary.activeTaskLabel ?? "Staging hazırlanıyor…"` |

### Not Running State

When `isRunActive(state) === false && !isRunComplete(state)`:
- All dots: `○` hollow
- Task label: `"Hazır"`
- Progress bar: hidden
- Timer: hidden
- Expand toggle: hidden

When `isRunComplete(state) === true && !isRunActive(state)`:
- All dots: `●` done (green)
- Task label: `"Tamamlandı"`
- Progress bar: 100% filled
- Timer: final elapsed value
- Expand toggle: visible (shows completed run log)

### Error State

When `getCurrentRun(state)?.state === "failed"`:
- Active dot at failure point: red (`--labx-error`)
- Remaining dots: `○` hollow
- Task label: `getCurrentRun(state).error ?? "Analiz başarısız"`
- Progress bar: red fill at failure percentage
- Retry link: visible, triggers `run-deep-analysis` action

---

## 9. Error & Edge Cases

### 9.1 Source Load Failed

```
Condition: sourceProbeStatus === "failed"

Media Viewport: error state — card with message:
  "Kaynak yüklenemedi. Lütfen dosyayı kontrol edin veya farklı bir kaynak deneyin."
  [Tekrar Dene] button → triggers source-probe action

Timeline: hidden (durationMs === 0)

Right Drawer: stays in Setup mode
  - Source intake expanded
  - Intents section hidden (sourceReady === false)
  - CTA disabled

Process Strip: idle state
```

### 9.2 Analysis Interrupted (cancelled)

```
Condition: getCurrentRun(state)?.state === "cancelled"

Media Viewport: returns to active (read-only lifted)

Timeline: returns to idle (selection re-enabled)

Right Drawer:
  hasReportPayload(state) === true → Explore mode (freshness === "stale")
  hasReportPayload(state) === false → Setup mode

Process Strip:
  - Dots: filled up to last completed module, remaining hollow
  - Task label: "Analiz iptal edildi"
  - No retry link (user chose to cancel)
```

### 9.3 Partial Result

```
Condition: getCurrentRun(state)?.state === "completed"
  AND getCurrentRun(state).findings.length > 0
  AND getCurrentRun(state).warnings.length > 0

Right Drawer: Result mode
  - Decision Surface renders normally
  - Additional warning banner at top of Result mode:
    "Analiz tamamlandı ancak bazı modüller uyarı verdi."
    Warnings listed below banner from run.warnings[]
  - Report CTA: enabled (report exists even if partial)

Process Strip:
  - Warning dots: modules with warnings get orange dot instead of green
  - Task label: "Tamamlandı (uyarılarla)"
```

### 9.4 Missing Tool (e.g., ffmpeg not installed)

```
Condition: getPreflightSeverity(state) === "will-fail"

Right Drawer (Setup mode):
  - Preflight section auto-expanded
  - Missing deps listed: getCurrentPreflight(state).missingDependencies[]
  - Each dep: red ✕ icon + dep name + "[Tool Manager'dan kur]" link
  - CTA: disabled
  - CTA tooltip: getAnalysisActionBlockReason(state) text

If severity === "warning" (non-blocking):
  - Preflight shows yellow △ warnings
  - CTA: enabled
  - Below CTA: "Bazı araçlar eksik — kısmi sonuç olabilir."
```

### 9.5 Empty Report

```
Condition: hasReportPayload(state) === false
  AND isRunComplete(state) === true
  AND getCurrentRun(state)?.emptyReason !== null

Right Drawer: Explore mode (no report to show)
  - Banner: getCurrentRun(state).emptyReason
  - CTA: "Tekrar Analiz Et"
  - Alternatives section: shows if available

Process Strip: complete state, task label includes emptyReason
```

### 9.6 No Source Selected (initial state)

```
Media Viewport: empty state — "Kaynak seçin" placeholder
Timeline: hidden
Right Drawer: Setup mode — source intake expanded, rest hidden
Process Strip: idle — "Hazır"
Top Bar: Source pill neutral, others dim
```

---

## 10. Loading Experience

### Boot Sequence (Laboratory açılış)

| Order | Region | Behavior | Timing |
|-------|--------|----------|--------|
| 1 | **Top Bar** | Renders instantly with project name + pill labels | 0ms |
| 2 | **Process Strip** | Renders instantly in idle state | 0ms |
| 3 | **Right Drawer** | Skeleton shimmer (3 rectangular blocks) | 0–bootReady |
| 4 | **Center Stage** | Skeleton shimmer for viewport area + "Ortam hazırlanıyor…" label | 0–bootReady |
| 5 | **All panels** | Full render when `state.bootReady === true` | bootReady event |

### Skeleton Layout Definition

**Drawer skeleton:**
```html
<div class="labx-drawer-skeleton">
  <div class="labx-skeleton-block" style="height: 2.5rem"></div>  <!-- title -->
  <div class="labx-skeleton-block" style="height: 8rem"></div>    <!-- main section -->
  <div class="labx-skeleton-block" style="height: 3rem"></div>    <!-- CTA -->
</div>
```

**Center skeleton:**
```html
<div class="labx-center-skeleton">
  <div class="labx-skeleton-block" style="height: 2rem"></div>    <!-- source bar -->
  <div class="labx-skeleton-block" style="height: 60vh"></div>    <!-- viewport -->
</div>
```

Skeleton animation: `background: linear-gradient(90deg, var(--labx-surface) 25%, var(--labx-surface-highlight) 50%, var(--labx-surface) 75%)` with `animation: labx-shimmer 1.5s infinite`.

### Pre-bootReady State

- `data-ready="false"` on `.labx-shell`: existing opacity dim + pointer-events:none behavior preserved
- Boot message cycling: existing `BOOT_MESSAGES[]` with fade-in/out preserved
- Top bar and process strip render immediately (no dim) — they don't depend on bootReady

---

## 11. Microcopy

### Hero CTAs

| Action | Button Label | Sub-description (below button, 1 line) |
|--------|-------------|----------------------------------------|
| **Start Analysis** | `"Analizi Başlat"` | Intent preview sentence (§5 format) |
| **Cancel Analysis** | `"Analizi İptal Et"` | `"Çalışan analiz durdurulacak"` |
| **View Report** | `"Raporu Görüntüle"` | Freshness badge text |
| **Re-analyze** | `"Tekrar Analiz Et"` | `"Güncel parametrelerle yeni analiz başlat"` |

### Drawer Mode Headers

| Mode | Eyebrow | Title |
|------|---------|-------|
| Setup | `"Yapılandırma"` | `"Analiz Hazırlığı"` |
| Running | `"Çalışıyor"` | `"Analiz İlerlemesi"` |
| Result | `"Sonuç"` | `"Karar Yüzeyi"` |
| Explore | `"Keşif"` | `"Alternatifler ve Karşılaştırma"` |

### Process Strip Labels

| State | Label |
|-------|-------|
| Idle (no source) | `"Hazır — kaynak bekleniyor"` |
| Idle (source ready) | `"Hazır"` |
| Processing | `"İşleniyor…"` |
| Analyzing | `"Analiz ediliyor… {completedCount}/{totalCount}"` |
| Staging | `"Staging hazırlanıyor…"` |
| Complete | `"Tamamlandı · {elapsed}"` |
| Error | `"Başarısız — {error message}"` |
| Cancelled | `"İptal edildi"` |

### Source Bar Labels

| State | Label |
|-------|-------|
| No source | `"Kaynak seçilmedi"` |
| Probing | `"Kaynak analiz ediliyor…"` |
| Ready | `"{fileName} · {sourceKind} · {resolution} · {duration} · {size}"` |
| Failed | `"Kaynak yüklenemedi"` |

### Pipeline Step Labels (Process Strip)

| Step Index | Label |
|------------|-------|
| 0 | `"Seçim"` |
| 1 | `"Plan"` |
| 2 | `"Değerlendirme"` |
| 3 | `"Karar"` |
| 4 | `"Staging"` |

---

## 12. Top Bar Specification

### Layout

`grid-template-columns: max-content 1fr max-content`

### Left Segment

**Project selector:**
- Label: active project name from `state.projectIndex.activeProjectId`
- Dropdown: lists all projects, allows switch
- If no project: `"Yeni Proje"`

### Center Segment — Mode Pills

| Pill | Active Condition | Accent Style |
|------|-----------------|--------------|
| `"Kaynak"` | Drawer mode === `setup` | `--labx-accent` dot |
| `"Analiz"` | Drawer mode === `running` | `--labx-accent` pulsing dot |
| `"Sonuçlar"` | Drawer mode === `result` OR `explore` | `--labx-success` dot |

Pill click behavior:
- `"Kaynak"` → If not running, force drawer to Setup mode. If running, no-op.
- `"Analiz"` → No-op (cannot force running state).
- `"Sonuçlar"` → If report exists, force drawer to Result mode. If not, no-op.

Inactive pills: `color: var(--labx-text-dim)`, no dot.

### Right Segment

- **Tool Management** button: icon (⚙), opens tool manager overlay
- No other controls

---

## 13. Component Migration Map (from v1 plan, unchanged)

| Current File | New Location |
|-------------|-------------|
| `lab-left-rail.ts` | **Eliminated.** Intents → Drawer Setup. Tool mgmt → Top bar. Brand → Top bar. Assets → Drawer Setup / Explore. |
| `lab-center-panel.ts` | **Center Stage** wrapper |
| `lab-right-panel.ts` | **Drawer** (Result mode — Decision Surface) |
| `workspace-surface.ts` source bar | **Center Stage** top |
| `workspace-surface.ts` source intake | **Drawer** Setup mode |
| `workspace-surface.ts` global process | **Process Strip** |
| `workspace-surface.ts` media preview | **Center Stage** viewport |
| `workspace-process-panel.ts` pipeline | **Drawer** Running mode + Strip |
| `workspace-process-panel.ts` findings | **Drawer** Running mode (early signals) |
| `workspace-process-panel.ts` artifacts | **Drawer** Explore mode (export) |
| `report-overlay.ts` | **Preserved** — triggered from Drawer Result mode |
| `lab-waveform-timeline-render.ts` | **Center Stage** timeline zone |
