# Laboratory Analiz & Rapor UX İyileştirmesi

Mevcut süreç panelini sabit boyutlu, bölümlere ayrılabilir hale getirme; analiz tamamlanınca rapor butonu ekleme; kullanıcı ve teknik raporları ayrı overlay ekranında gösterme.

---

## Mevcut Durum Sorunları

- **Süreç paneli dinamik boyutlu**: `workspace-process-panel.ts` — analiz sırasında pipeline/activity/findings/artifacts bölümleri üst üste stackleniyor, içerik değiştikçe panel boyutu değişiyor, bazen kayboluyor
- **Rapor UI yok**: `LabUserReport`, `LabAiReport`, `LabReportSet` type'ları mevcut ama bunları render eden UI bileşeni yok — `report-builder.ts` sadece data üretiyor
- **Rapor butonu yok**: Analiz tamamlandığında sağ panelde sadece process paneli kalıyor, rapor açmak için bir tetikleyici yok
- **Overlay pattern mevcut**: `tool-management-overlay.ts` referans alınabilir — `labx-overlay-root` + backdrop + dialog yapısı hazır

---

## Faz 1 — Sabit Boyutlu Süreç Paneli

**Hedef**: Sağ panel süreci her durumda aynı boyutta gösterir, bölümler collapsible.

### Değişiklikler

- **`workspace-process-panel.ts`** — Yeni yapı:
  - Header: Status chip + Run ID + elapsed time + confidence gauge (tamamlandıysa)
  - 3 collapsible section: **Pipeline** | **Findings** | **Artifacts**
  - Her section başlığına tıklayınca açılır/kapanır, `data-collapsed` attribute ile toggle
  - Activity feed kaldırılır (gereksiz hareketlilik kaynağı — bulgular zaten findings'te)
  - Panel `min-height: 320px; max-height: 420px; overflow-y: auto` ile sabit boyutlu

- **`lab-types.ts`** — `LabWorkspaceUiState` ekleme:
  - `processPanelCollapsedSections: string[]` — hangi bölümler kapalı ("pipeline" | "findings" | "artifacts")

- **`lab-store.ts`** — Yeni event:
  - `workspace-process-section-toggled { sectionId: string }` — collapsible toggle handler

- **`lab-run-controller.ts`** — Yeni action:
  - `workspace-process-section-toggle` → dispatch event

- **`lab-theme.css`** — Süreç paneli CSS güncellemesi:
  - `.labx-process-panel` sabit boyut, `overflow-y: auto`
  - `.labx-process-section` collapsible header + body yapısı
  - `.labx-process-section[data-collapsed="true"] .labx-process-section__body { display: none }`
  - Elapsed time ve confidence gauge stilleri

### Collapsible Section Yapısı

```
[▼ Pipeline]          ← tıklanınca açılır/kapanır
  progress bar
  step list (max 5 visible)
[▼ Findings (3)]      ← badge ile sayı göster
  finding cards
[▼ Artifacts (7)]     ← badge ile sayı göster
  artifact items
```

---

## Faz 2 — Analiz Tamamlama & Rapor Butonu

**Hedef**: Analiz tamamlandığında süreç paneli sadeleşir, sadece rapor butonu görünür.

### Değişiklikler

- **`workspace-surface.ts`** — `side` bölümü güncellemesi:
  - `workspaceMode === "complete"` iken:
    - Süreç paneli: Sadece header (status: Complete) + collapsed özet (toplam bulgu/artefakt sayısı)
    - **"Raporu Görüntüle"** butonu (primary CTA) — `data-lab-action="open-report-overlay"`
  - `workspaceMode === "analyzing"` iken: Tam süreç paneli (Faz 1 yapısı)

- **`lab-run-controller.ts`** — Yeni action:
  - `open-report-overlay` → dispatch `report-overlay-toggled { open: true }`

- **`lab-types.ts`** — `LabStoreUiState` ekleme:
  - `reportOverlayOpen: boolean`

- **`lab-store.ts`** — Yeni event:
  - `report-overlay-toggled { open: boolean }`

---

## Faz 3 — Rapor Overlay

**Hedef**: Rapor ayrı bir tam ekran overlay'de görüntülenir, kullanıcı/teknik sekme geçişli.

### Değişiklikler

- **Yeni dosya: `ui/report-overlay.ts`** — `renderReportOverlay(state)` fonksiyonu:
  - `labx-overlay-root[data-open]` pattern (tool-management-overlay referansı)
  - Backdrop + dialog
  - Header: "Analiz Raporu" başlığı + Kullanıcı/Teknik sekme butonları + Kapat butonu
  - **Kullanıcı Raporu sekmesi**:
    - Özet kartı (summary + confidence gauge)
    - Bulgular listesi — her bulgu: başlık, detay, confidence badge, kanıt etiketleri
    - Şüpheli kareler / önemli bulgular — previewUrl varsa thumbnail ile
    - Hipotez sonucu (varsa)
  - **Teknik Rapor sekmesi**:
    - Manifest bloğu (featureId, runId, moduleCount, artifactCount, generatedAt)
    - Modül yürütme zaman çizelgesi (moduleTrace entries)
    - Tam bulgu listesi (LabFindingProjection — code, kind, severity dahil)
    - Artefakt listesi (path, kind, metadata)
    - Uyarılar ve hatalar
    - Degraded conditions
  - Footer: **JSON Export** butonu + **PDF Export** butonu (placeholder — host'a delegate)

- **`lab-layout.ts`** — Overlay render ekleme:
  - `renderReportOverlay(state)` çağrısı ekle (mevcut `renderToolManagementOverlay` yanına)

- **`lab-root.ts`** — Render döngüsüne report overlay ekleme:
  - `overlayRoot` update'e report overlay dahil

- **`lab-run-controller.ts`** — Action handler:
  - `close-report-overlay` → dispatch `report-overlay-toggled { open: false }`
  - `report-tab-switch` → dispatch `report-view-changed { view: "user" | "ai" }`
  - `report-export-json` → `sendMediaAction("export-report-json")`
  - `report-export-pdf` → `sendMediaAction("export-report-pdf")`

- **`lab-theme.css`** — Report overlay stilleri:
  - `.labx-report-overlay` — dialog container
  - `.labx-report-tabs` — sekme butonları
  - `.labx-report-section` — rapor bölüm kartı
  - `.labx-report-finding` — bulgu kartı (confidence badge dahil)
  - `.labx-report-suspicious-frame` — şüpheli kare thumbnail
  - `.labx-report-manifest` — teknik manifest blok
  - `.labx-report-timeline-entry` — modül zaman çizelgesi satırı

---

## Faz 4 — Rapor İçeriği Zenginleştirme

**Hedef**: Mevcut `report-builder.ts` çıktısını zenginleştir, kullanıcı raporunu anlamlı kılmak için ek veriler ekle.

### Değişiklikler

- **`report-builder.ts`** — `buildUserReport` genişletme:
  - `suspiciousFrames: { artifactId: string; previewUrl: string; label: string }[]` — previewUrl olan artefaktlardan şüpheli kare listesi
  - `hypothesisResult: string | null` — run.hypothesisSummary
  - `elapsedSeconds: number` — run.startedAt ve run.endedAt farkı
  - `moduleSummary: { id: string; title: string; status: string }[]` — modül özet

- **`lab-types.ts`** — `LabUserReport` genişletme:
  - `suspiciousFrames` alanı ekle
  - `hypothesisResult` alanı ekle
  - `elapsedSeconds` alanı ekle
  - `moduleSummary` alanı ekle

- **`report-builder.ts`** — `buildAiReport` genişletme:
  - `moduleTrace: LabModuleTraceEntry[]` — run.moduleTrace
  - `analysisScope: AnalysisScope | null` — run.analysisScope
  - `comparisonVariants: LabComparisonVariant[]` — run.comparisonVariants

- **`lab-types.ts`** — `LabAiReport` genişletme:
  - `moduleTrace` alanı ekle
  - `analysisScope` alanı ekle
  - `comparisonVariants` alanı ekle

---

## Dosya Değişiklik Özeti

| Dosya | Değişiklik |
|---|---|
| `models/lab-types.ts` | `LabWorkspaceUiState` + `processPanelCollapsedSections`, `reportOverlayOpen`, `LabUserReport` ve `LabAiReport` genişletme, yeni event tipleri |
| `runtime/lab-store.ts` | Yeni event handler'lar (section toggle, report overlay toggle) |
| `runtime/lab-run-controller.ts` | Yeni action handler'lar |
| `runtime/lab-selectors.ts` | `getReportOverlayOpen`, `getProcessCollapsedSections` selector'leri |
| `ui/workspace-process-panel.ts` | Collapsible section yapısı, elapsed time, confidence gauge |
| `ui/workspace-surface.ts` | Complete modda rapor butonu, analyzing modda sabit panel |
| `ui/report-overlay.ts` | **YENİ** — Rapor overlay render |
| `ui/lab-layout.ts` | Report overlay render ekleme |
| `ui/lab-root.ts` | Report overlay update ekleme |
| `ui/lab-theme.css` | Süreç paneli sabit boyut, collapsible, report overlay stilleri |
| `services/report-builder.ts` | User/AI report zenginleştirme |

---

## Önerilen Ek İyileştirmeler

- **Confidence Gauge**: Tamamlanan analizde görsel bir confidence göstergesi (düşük/orta/yüksek renk kodlu)
- **Elapsed Time**: Analiz süresi gösterimi (dk:sn formatında)
- **Şüpheli Kareler**: Kullanıcı raporunda previewUrl olan artefaktlardan otomatik "şüpheli kare" bölümü
- **Modül Zaman Çizelgesi**: Teknik raporda modüllerin başlangıç/bitiş zamanları
- **Export Placeholder**: PDF/JSON export butonları host'a delegate edilir, UI tarafında buton ve action hazır
