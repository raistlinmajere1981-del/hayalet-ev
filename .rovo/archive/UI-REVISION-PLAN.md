# Laboratory UI — Kapsam Kontrollu Revizyon Plani

> Referans: Kullanicinin gonderdigi 3 panelli mockup (Arac Yonetimi / Ana Ekran / Proje Yonetimi)
> Tarih: 2026-05-03
> Durum: **UYGULANDI + AUDIT DUZELTMESI SURUYOR** — Wave 0–7 kodu uygulanmis gorunuyor; 2026-05-03 audit'inde typecheck, hedefli Laboratory testleri ve `rooms:build` yesil. Screenshot smoke ve tum repo testleri ayrica dogrulanmadikca "not verified" sayilir.

---

## Revizyon Amaci

Laboratory UI daha kompakt, daha okunur ve mockup referansina yakin bir operator tezgahi hissi vermeli. Bu planin ana hedefi gorsel dili sertlestirmek ve mevcut akislari bozmayacak sekilde top bar, rail, workspace, drawer, inspector, process strip ve overlay yuzeylerini yeniden hizalamaktir.

Kritik ayrim:

- **Oda**: Laboratory room shell, runtime host, i18n, install/build ve scene entry yuzeyidir.
- **Ana fonksiyon**: Mevcut medya/ses analizi deneyiminin UI state, action, tool, project ve report akislari icidir.
- Bu revizyon yeni bir oda veya yeni ana fonksiyon eklemez; mevcut Laboratory UI yuzeyini yeniler.

---

## Kapsam Kurallari

1. **Stil-only degisiklikler once gelir.** Token, radius, renk, spacing, grid, hover, focus ve responsive ayarlari mevcut markup/action kontratlarini bozmadan yapilir.
2. **Davranis ekleyen her madde ayri kontrat ister.** Yeni buton, tab, metrik veya filtre gorunecekse once state -> renderer -> controller action -> host/snapshot destegi -> test zinciri netlestirilir.
3. **Sahte veri yok.** GPU/RAM, versiyon, aktif proje statusu, arama kategorisi veya proje boyutu gibi alanlar mevcut snapshot/store tarafinda yoksa ilk turda gizlenir, disabled gosterilir veya "future" olarak ayrilir.
4. **Generated runtime elle degismez.** Source of truth `rooms/laboratory` altidir; `rooms/.build/laboratory/runtime` build/install/startup sync ile uretilen runtime kopyasidir.
5. **i18n zorunlu.** Gorunen yeni metinler `rooms/laboratory/i18n/en.json` ve `rooms/laboratory/i18n/tr.json` icine girer; UI icinde yalniz minimal bootstrap fallback kalabilir.
6. **Regresyonlar planin parcasi sayilir.** Her faz en az ilgili renderer/store testi ve `npm run rooms:typecheck` ile kapanir.

---

## Referans Tasarim Ozeti

- Koyu ama net: arka plan `#07111c` - `#0d1926`, daha belirgin border ve dusuk glow.
- Kompakt kartlar: kart radius `8-10px`, buton radius `6px`, ince ama okunur border.
- Sol rail: 52px sabit rail icin ikon-oncelikli navigasyon; label gorunecekse rail genisligi tekrar karar ister.
- Top bar: solda oda/marka, ortada mevcut source metadata, sagda yalniz mevcut action zincirine baglanabilen kontroller.
- Alt strip: kompakt durum satiri; pipeline detaylari expanded modda kalir.
- Sag paneller: mevcut inspector/drawer state korunarak bolumler daha net kartlara ayrilir.
- Proje ve arac overlayleri: daha buyuk thumbnail/kart dili, fakat mevcut project/tool data modelinin otesine gecilmez.

---

## Faz 0 — Hazirlik ve Baseline

**Dosyalar:** `rooms/laboratory/README.md`, mevcut UI/test dosyalari

- Mevcut ownership ve validation shortlist okunur.
- Baseline olarak asagidaki komutlar hedeflenir:
  - `npm run rooms:typecheck`
  - `npm run rooms:test:file -- scripts/tests/laboratory-host-import-smoke-regressions.test.ts scripts/tests/laboratory-ui-evaluation-regressions.test.ts`
  - `npm run rooms:test:file -- scripts/tests/laboratory-source-ui-regressions.test.ts scripts/tests/laboratory-workspace-runtime-regressions.test.ts`
- Uygulama baslamadan once mevcut topbar, rail, project overlay, tool overlay ve process strip test beklentileri not edilir.
- Bu faz kod degistirmez; uygulama icin emniyet cizgisini belirler.

**Cikis kriteri:** Baseline test durumu biliniyor; mevcut kiriklik varsa revizyonla karistirilmadan kaydediliyor.

---

## Faz 1 — Design Token ve Base Stil

**Dosyalar:** `styles/base.css`, `lab-theme.css`

**Stil-only hedefler:**

- `--labx-radius: 18px` -> `12px`
- `--labx-radius-tight: 12px` -> `8px`
- Yeni tokenlar:
  - `--labx-radius-card: 10px`
  - `--labx-radius-button: 6px`
  - `--labx-radius-pill: 999px`
  - `--labx-font-body: 0.84rem`
  - `--labx-font-label: 0.74rem`
  - `--labx-font-meta: 0.68rem`
  - `--labx-font-heading: 1.05rem`
  - `--labx-topbar-height: 48px`
  - `--labx-rail-width: 52px`
  - `--labx-strip-height: 36px`
- Border opacity standardi `0.16` civarina cekilir.
- Body gradient glow azaltilir; dekoratif orb/bokeh eklenmez.
- Font boyutu viewport ile scale edilmez; letter-spacing negatif olmaz.

**Risk notu:** `lab-theme.css` buyuk ve daginik bir dosya oldugu icin token degisimleri kademeli uygulanir; global replace sonrasi responsive ve nested card gorunumu kontrol edilir.

**Dogrulama:** `rooms:typecheck`, ilgili CSS snapshot/assert testleri; desktop/mobile screenshot smoke kosulmadikca audit notunda "not verified" kalir.

---

## Faz 2 — Top Bar ve Left Rail Kontrati

**Dosyalar:** `lab-top-bar.ts`, `laboratory-layout.ts`, `lab-theme.css`, i18n kataloglari, ilgili tests

### 2A — Stil ve mevcut action uyarlamasi

- Top bar height `48px` token uzerinden korunur.
- Sol kisim oda markasi + Laboratory label olarak guncellenir; aktif proje/source bilgisi orta metadata strip'e tasinir.
- Mevcut `project-workspace-open`, `toggle-tool-manager`, `drawer-collapsed-toggled`, `topbar-pill-*` actionlari korunur.
- Emoji/karakter ikonlari inline SVG veya CSS ikonlarla degistirilir; aria-label/title korunur.
- Metadata strip mevcut source metadata alanlarindan beslenir: dosya adi, cozum, sure. FPS yalniz guvenilir metadata varsa gosterilir.

### 2B — Davranis kapisi

- "Yeni Proje" top bar'a alinacaksa mevcut `project-create` action zinciriyle baglanir ve controller testi eklenir.
- "Ac" mevcut project workspace overlay acma davranisina map edilir.
- "Kaydet" icin mevcut guvenilir action/host destegi dogrulanmadan buton eklenmez.
- "Analiz Modu" yeni bir state anlamina geliyorsa bu fazda eklenmez; mevcut drawer mode pill'leri top bar segment kontrolu olarak yeniden stillenir.

### Left rail karari

- Rail `52px` kalacaksa label gorunmez; ikon-only + tooltip/aria-label uygulanir.
- Ikon + gorunen label istenirse rail genisligi yeni tokenla genisletilir ve responsive grid tekrar tasarlanir.
- Ilk uygulama tercihi: `52px` ikon-only, aktif item icin `3px` accent bar.

**Dogrulama:** `laboratory-source-ui-regressions.test.ts` topbar/rail beklentileri guncellenir; klavye/focus ve aria kontrolleri eklenir.

---

## Faz 3 — Center Panel ve Workspace Kontrolleri

**Dosyalar:** `workspace-surface.ts`, timeline dosyalari, `lab-theme.css`, i18n kataloglari

**Stil-only hedefler:**

- Video/audio preview container radius `10px` olur.
- Timeline waveform yapisi korunur; yalniz mevcut duration/selection bilgisinden uretilen timestamp gostergeleri eklenir.
- Playback control bar daha kompakt hale gelir; mevcut play/seek/step/volume actionlari disina cikilmaz.
- Preview focus transitionlari korunur; ROI ve audio visualizer katmanlari yeniden konumlandirilirken canvas/media alanlari bos kalmayacak sekilde test edilir.

**Davranis kapisi:** Yeni kontrol eklenirse once `lab-run-controller.ts` icinde action mapping ve store etkisi yazilir, sonra UI render edilir.

**Dogrulama:** `laboratory-source-ui-regressions.test.ts`, `laboratory-waveform-runtime-regressions.test.ts`, hedefli workspace runtime testleri.

---

## Faz 4 — Drawer ve Inspector Sadelestirme

**Dosyalar:** `lab-drawer.ts`, `workspace-surface.ts`, `asset-inspector.ts`, `lab-theme.css`, i18n kataloglari

### Drawer

- Mevcut `drawerMode` ve `renderPipeline` kontrati korunur.
- Header compact hale gelir: eyebrow, title, status badge.
- Pipeline block ve modul kart radius/padding tokenlara cekilir.
- "Son Islem" gibi ozetler yalniz mevcut `userActions` / `activityFeed` verisinden uretilir.
- Ana CTA mevcut `primary-action` / analiz aksiyonlari uzerinden calisir; yeni action adi uretilmez.

### Inspector

- Bolge secimi, analiz sonuclari ve hizli islemler mevcut workspace/selection/report/action state'lerine baglanir.
- "Ekran Goruntusu", "Bolgeyi Kaydet", "Rapor Olustur" gibi butonlar mevcut action zinciri dogrulanmadan aktif gosterilmez.
- Tab davranisi korunur; sadece gorsel hiyerarsi ve kart netligi artirilir.

**Dogrulama:** drawer render testleri, workspace inspector testleri, action disabled/locked state testleri.

---

## Faz 5 — Process Strip Revizyonu

**Dosyalar:** `lab-process-strip.ts`, `lab-theme.css`, i18n kataloglari

**Stil-only hedefler:**

- Kompakt mod yuksekligi `36px` olur.
- Kompakt modda durum text, progress ve elapsed alanlari korunur.
- Pipeline dot'lar compact modda gizlenebilir; expanded modda mevcut 5 adim semantigi korunur.
- Expanded yukseklik `200px` hedeflenir; raw log ve son islem listesi scroll guvenligiyle kalir.

**Veri kapisi:** GPU, RAM, uygulama versiyonu veya sistem metrikleri mevcut Laboratory snapshot/store tarafindan gelmiyorsa ilk turda eklenmez. Bu metrikler istenecekse ayri host/snapshot kontrati acilir.

**Dogrulama:** `laboratory-source-ui-regressions.test.ts` process strip testleri, expanded/compact state testleri; mobile overflow screenshot smoke kosulmadikca "not verified" kalir.

---

## Faz 6 — Proje Yonetimi Overlay

**Dosyalar:** `project-workspace-overlay.ts`, `project-navigation.ts`, `asset-grid.ts`, `asset-card.ts`, `asset-inspector.ts`, `styles/project-workspace.css`, i18n kataloglari

### Ilk tur: Mevcut modelle gorsel revizyon

- Header daha net hale gelir; mevcut `project-create`, `project-delete`, `project-workspace-switch`, `project-workspace-close` actionlari korunur.
- Grid kart min genisligi `minmax(220px, 1fr)` hedeflenir, fakat 760px altinda tek kolon guvenligi korunur.
- Thumbnail `aspect-ratio: 16 / 9`; image/video preview varsa kullanilir, yoksa ikon/monogram fallback kalir.
- Kart overlay meta mevcut asset metadata alanlariyla sinirli kalir: ad, tip, sure/cozum/boyut, run/intent bilgisi.
- Inspector gorsel olarak yenilenir; source/report/download/jump actions mevcut controller zincirinden calisir.

### Ikinci tur: Yeni proje filtreleri icin kontrat

- "Tumu / Aktif / Tamamlanan / Arsivlenen" tablari icin once project record icinde status/archive bilgisi dogrulanir.
- Status yoksa bu tablar ilk turda eklenmez; mevcut type/sort/group/search toolbar korunur veya sadece stillenir.
- "Toplam Proje / Toplam Boyut / Aktif Islemler" istatistikleri mevcut veriden turetilebiliyorsa eklenir; aksi halde future kontrat olarak kalir.

**Dogrulama:** `laboratory-project-workspace-regressions.test.ts`, source intake/project switching testleri; mobile grid screenshot smoke kosulmadikca "not verified" kalir.

---

## Faz 7 — Tool Management Overlay

**Dosyalar:** `tool-management-overlay.ts`, `lab-theme.css`, i18n kataloglari

### Ilk tur: Mevcut tool registry ile gorsel revizyon

- Mevcut relevance grouping korunur: ilgili araclar ve diger araclar.
- Kartlar ikon/monogram, ad, ozet, stage support, version/status ve mevcut install/update/check actions ile yenilenir.
- Progress rail kompaktlastirilir ama busy/queued/running/completed semantigi korunur.
- Header aksiyonlari mevcut `tool-update-all`, `tools-refresh`, `close-tool-manager` uzerinden kalir.

### Davranis kapisi

- Arama ve kategori tablari istenirse `LabStoreUiState` icine tool search/category state eklenir; controller change/click mapping ve tests yazilir.
- "Yeni Arac" butonu ilk turda eklenmez; tool install manifest/runtime destegi olmadan aktif aksiyon sayilmaz.
- "Kullanilan Alan" metriği mevcut tool state tarafindan gelmiyorsa gosterilmez.

**Dogrulama:** tool overlay render testleri, lifecycle action tests, i18n key coverage.

---

## Faz 8 — Genel Stil Harmonizasyonu

**Dosyalar:** `lab-theme.css`, `styles/project-workspace.css`, ortak UI renderer dosyalari

- Tüm eski radius kullanımları token referanslarına çekilir.
- Emoji ikonlar ve text-only sembol butonlar tanimli ikon/aria yapisina alinir.
- `box-shadow` en fazla iki layer standardına indirilir.
- Transition standardi `120ms ease-out` olur; reduced-motion kuralı korunur.
- Button/chip/card stilleri ic ice card hissi vermeyecek sekilde sadeleştirilir.
- Responsive breakpointler `860px`, `960px`, `1180px` ve project overlay `760px/1120px` tarafinda tekrar kontrol edilir.
- Metin taşması, button label overflow ve toolbar sıkışması için desktop/mobile screenshot smoke hedeflenir; kosulmadiysa kapanis raporunda acik dogrulama olarak yazilir.

**Dogrulama:** Tum hedefli Laboratory UI testleri + `npm run rooms:typecheck` + gerekiyorsa `npm run rooms:build`.

---

## Uygulama Sirasi

```text
Faz 0  Baseline ve mevcut kontrat haritasi
  -> Faz 1  Token/base stil
  -> Faz 2  Top bar + left rail
  -> Faz 3  Center workspace
  -> Faz 4  Drawer + inspector
  -> Faz 5  Process strip
  -> Faz 6  Project overlay
  -> Faz 7  Tool overlay
  -> Faz 8  Final harmonizasyon
```

Paralel yapilabilecek isler:

- Faz 6 ve Faz 7, Faz 1 tokenlari tamamlandiktan sonra birbirinden bagimsiz ilerleyebilir.
- Faz 3 ve Faz 4 ayni anda yapilmaz; ikisi workspace selection/action semantigine dokunabilir.
- Faz 8 en sona kalir; onceki fazlarda testler yesile donmeden global harmonizasyon yapilmaz.

---

## Test ve Dogrulama Matrisi

| Kapsam | Minimum dogrulama |
|---|---|
| Type safety | `npm run rooms:typecheck` |
| UI render smoke | `npm run rooms:test:file -- scripts/tests/laboratory-ui-evaluation-regressions.test.ts scripts/tests/laboratory-source-ui-regressions.test.ts` |
| Workspace/runtime | `npm run rooms:test:file -- scripts/tests/laboratory-workspace-runtime-regressions.test.ts scripts/tests/laboratory-runtime-truth-regressions.test.ts` |
| Project overlay | `npm run rooms:test:file -- scripts/tests/laboratory-project-workspace-regressions.test.ts scripts/tests/laboratory-source-intake-regressions.test.ts` |
| Tool overlay | Tool lifecycle/render beklentileri iceren mevcut Laboratory source UI testleri veya yeni hedefli test |
| i18n | `npm run rooms:test:file -- scripts/tests/laboratory-i18n-regressions.test.ts` |
| Build/package | `npm run rooms:build` |

Screenshot smoke hedefleri:

- Desktop: 1440x900, drawer acik/kapali, process compact/expanded.
- Mobile/tablet: 390x844 veya 768x1024, project overlay ve tool overlay overflow kontrolu.
- Kaynak yok, kaynak hazir, analiz calisiyor, analiz tamamlandi state'leri.

Audit notu: 2026-05-03 itibariyla screenshot smoke matrisi repo testleriyle birebir kanitlanmiyor; bu hedef manuel/Playwright smoke kosulana kadar "not verified" kabul edilir.

---

## Tahmini Etki

| Dosya | Etki tipi | Not |
|---|---|---|
| `styles/base.css` | Dusuk/orta | Token ve global temel stil |
| `lab-theme.css` | Yuksek | Dosya buyuk; kademeli ve testli ilerlemeli |
| `styles/project-workspace.css` | Orta/yuksek | Grid, card, overlay responsive |
| `lab-top-bar.ts` | Orta | Yeni markup, mevcut action korunumu |
| `laboratory-layout.ts` | Dusuk/orta | Rail/layout atributlari |
| `workspace-surface.ts` | Orta/yuksek | Preview, inspector, controls markup |
| `lab-drawer.ts` | Orta | Pipeline kontrati korunarak sadeleştirme |
| `lab-process-strip.ts` | Orta | Compact/expanded semantik korunumu |
| `project-workspace-overlay.ts` | Orta | Header ve overlay shell |
| `project-navigation.ts` | Orta | Mevcut project actions korunur |
| `asset-grid.ts` | Orta/yuksek | Toolbar, grid, grouping, empty state |
| `asset-card.ts` | Orta | Thumbnail/meta overlay |
| `asset-inspector.ts` | Orta | Action state ve detay kartlari |
| `tool-management-overlay.ts` | Orta/yuksek | Tool registry render ve lifecycle actions |
| `rooms/laboratory/i18n/en.json` | Orta | Yeni UI copy |
| `rooms/laboratory/i18n/tr.json` | Orta | Yeni UI copy |
| `scripts/tests/*laboratory*` | Orta/yuksek | Fazlara gore beklenti guncelleme |

---

## Acik Kararlar

Orijinal 5 karar ve ikon rail + overlay fazlarindan gelen 7 ek karar asagida kapandi.

### Kapali Kararlar

| # | Konu | Karar |
|---|---|---|
| 1 | Left rail genisligi | `52px` ikon-only; active item `3px` accent bar. |
| 2 | Top bar "Kaydet" | Ilk surumde gizli; guvenilir save action dogrulanmadan eklenmez. |
| 3 | Sistem metrikleri | Alt strip yalniz process status; GPU/RAM/versiyon future kontrat. |
| 4 | Project status tablari | status/archive alani yok; tablar ilk turde eklenmez. |
| 5 | Tool arama/kategori state | Gorsel revizyon sonrasi ikinci turda. |
| 6 | Sag rail ikon sayisi | Flat 6 ikon; gruplama yok, ince separator ile realtime/post-process ayirimi. |
| 7 | Panel acilis modu | Hybrid: varsayilan popover (preview ustunde); pin ile push moda gecis (preview kuculur). |
| 8 | Taslak/planlanan islemler | Dimmed + ikon uzerinde "Taslak/Draft" rozeti; tiklama engellenmez ama slot draft gorunur. |
| 9 | Ikon rendering | Custom inline SVG; harici bagimlilik yok. |
| 10 | Iptal modu | Direkt iptal, onay dialog yok; analiz run icin `cancel-analysis`, operation icin `operation-cancel` kullanilir. |
| 11 | Durdurma gostergesi | Processing overlay mevcut is label/progress/elapsed bilgisini gosterir; cancel pending state mevcut drawer/run kontratindan izlenir. |
| 12 | Kilit kapsami | Post-process operasyonlar + analiz run birlestirilerek `isAnyHeavyWorkActive` selectoru. |

### Acik Kalan Kararlar

Simdilik acik karar yok.

---

## Faz 4B — Icon Rail Inspector

**Dosyalar:** `workspace-surface.ts`, `workspace-operation-controls.ts`, `lab-theme.css`, `lab-types.ts`, `lab-selectors.ts`, i18n kataloglari

### Tasarim

- Sagda sabit `52px` dikey ikon rayi; `workspace-surface.ts` icerisinde inspector drawer ile butunlesik render edilir.
- Rail ust kisim **realtime** (aninda geri bildirim), alt kisim **post-process** (arka plan islemi) grubunu temsil eder; gruplar ince bir `hr` veya CSS separator ile ayrilir.
- Her ikon icin `title` + `aria-label` zorunludur; aktif ikon `--labx-accent` ile vurgulanir.
- Rail genisligi `--labx-rail-width: 52px` tokenini kullanir; workspace grid bu degere gore hesaplanir.

### 6 Ikon Listesi

| Slot | Grup | Kimlik | Aciklama |
|---|---|---|---|
| 1 | Realtime | roi-select | Bolge / ROI secimi |
| 2 | Realtime | waveform-region | Dalga formu bolge secimi |
| 3 | Realtime | frame-export | Frame / screenshot cikti |
| 4 | Post-process | denoise | Gurultu azaltma |
| 5 | Post-process | stabilize | Goruntu stabilizasyon |
| 6 | Post-process | color-grade | Renk duzeltme |

> Not: Yukaridaki kimlikler `LabOperationCapabilityId` degerlerine eslenmeden once `lab-types.ts` tarafindan dogrulanacak; eksik capability varsa o slot Taslak modda baslayacak.

### Ikon Durumu

- **Aktif:** Tiklandi, panel acik — `--labx-accent` arkaplan, `3px` sol border.
- **Disabled:** `isAnyHeavyWorkActive === true` → tum rail ikonlari `disabled` + `pointer-events: none; opacity: 0.38`.
- **Taslak:** Capability henuz implement edilmedi → `opacity: 0.45` + sag ust kosede kucuk "Taslak" rozeti.

### Panel Acilis Modu — Hybrid

- **Varsayilan — Popover:** Panel preview alaninin ustune gelir; layout kaymaz. `z-index: var(--labx-z-popover)`.
- **Pinlenmis — Push:** Kucuk pin ikonu (panel header saginda) tiklaninca preview alani daralir, panel sag tarafa yerlesir; `--labx-inspector-width` tokenindan beslenir.
- Pin durumu `LabStoreUiState` icinde `inspectorPinned: boolean` alani ile saklanir; controller action: `inspector-pin-toggle`.

### Custom Inline SVG

- Her ikon 24x24 viewBox, 1.5px stroke, round linecap/linejoin.
- SVG literalleri `workspace-surface.ts` icerisinde template string olarak render edilir; harici ikon kutuphanesi kullanilmaz.

**Cikis kriteri:** 6 ikon gorunur, hybrid popover/push calisiyor, Taslak ikonlar dimmed, `isAnyHeavyWorkActive` aktifken rail locked, typecheck yesil.

---

## Faz 4C — Processing Overlay & Lock Expansion

**Dosyalar:** `lab-selectors.ts`, `workspace-surface.ts`, `lab-run-controller.ts`, `lab-theme.css`, i18n kataloglari

### Selector Degisikligi

`lab-selectors.ts` icine tek kaynakli heavy-work ve overlay view-model selectorlari eklenir:

```ts
export function isAnyHeavyWorkActive(state) {
  return isRunActive(state) || getActiveOperationCount(state) > 0;
}

export function getProcessingOverlayState(state) {
  // active, label, progress, elapsedSeconds, cancelAction/cancelValue
}
```

### Kilit Durumu

`isAnyHeavyWorkActive === true` iken asagidakiler disabled/locked:

- Sag rail ikonlari (Faz 4B)
- Playback / media kontrolleri (play, seek, step)
- Source intake aksiyon butonlari
- Top bar "Yeni Proje", "Ac" gibi navigasyon tetikleyicileri

### Overlay Tasarimi

- `position: fixed; inset: 0; z-index: var(--labx-z-overlay)` — tam ekran kaplama.
- Arkaplan: `rgba(7, 17, 28, 0.82)` + `backdrop-filter: blur(8px)`.
- Merkez kart `--labx-radius-card` ile yuvarlatilir; icerik:
  - Buyuk spinner animasyonu (CSS `@keyframes` rotasyon).
  - Islem adi (run target veya running operation label; fallback i18n key).
  - Progress bar (biliniyorsa yuzde, degilse indeterminate animasyon).
  - Gecen sure (`elapsed`).
  - **"Iptal"** butonu — run icin `cancel-analysis`, operation icin `operation-cancel` dispatch eder; onay dialog yok.
- Overlay render `workspace-surface.ts` icinde `isAnyHeavyWorkActive` kontrolune baglidir.

### Preview Duraklatma

- Overlay actiktan sonra controller lifecycle hook'u aktif media element uzerinde `media.pause()` cagirir; overlay kapaninca otomatik resume yoktur.

### i18n Anahtarlari (yeni)

| Anahtar | Turkce | Ingilizce |
|---|---|---|
| `mediaAnalysis.overlay.processing` | "Isleniyor..." | "Processing..." |
| `mediaAnalysis.overlay.cancel` | "Iptal" | "Cancel" |
| `mediaAnalysis.overlay.elapsed` | "Gecen sure" | "Elapsed" |
| `mediaAnalysis.iconRail.roi-select` | "Bolge Sec" | "Select Region" |
| `mediaAnalysis.iconRail.waveform-region` | "Dalga Formu Bolgesi" | "Waveform Region" |
| `mediaAnalysis.iconRail.frame-export` | "Frame Cikti" | "Export Frame" |
| `mediaAnalysis.iconRail.denoise` | "Gurultu Azalt" | "Denoise" |
| `mediaAnalysis.iconRail.stabilize` | "Stabilize Et" | "Stabilize" |
| `mediaAnalysis.iconRail.color-grade` | "Renk Duzelt" | "Color Grade" |

**Cikis kriteri:** Overlay `isAnyHeavyWorkActive` ile tetikleniyor; label/progress/elapsed aktif isten geliyor; iptal calisiyor; media/source kontrolleri locked; typecheck yesil.

---

## Wave Haritasi

| Wave | Kapsam | Fazlar | Model Onerisi | Giris Kosulu | Cikis Kriteri |
|---|---|---|---|---|---|
| 0 | Dokuman ve planlama | — | — | — | `UI-REVISION-PLAN.md` guncellendi, tum kararlar kapandi |
| 1 | Baseline + token altyapisi | Faz 0 + Faz 1 | Claude Sonnet | Wave 0 tamam | typecheck yesil, yeni tokenlar `lab-theme.css` icinde mevcut |
| 2 | Top bar + left rail | Faz 2 | Claude Sonnet | Wave 1 tamam | topbar/rail testleri yesil |
| 3 | Center workspace | Faz 3 | Claude Sonnet | Wave 2 tamam | workspace/waveform testleri yesil |
| 4 | Drawer + inspector + icon rail | Faz 4 + Faz 4B | Claude Opus (thinking) | Wave 3 tamam | inspector/rail testleri yesil, hybrid panel calisiyor |
| 5 | Processing overlay + lock genisleme | Faz 4C | Claude Opus (thinking) | Wave 4 tamam | overlay locked state dogrulandi, typecheck yesil |
| 6 | Process strip + proje overlay + tool overlay | Faz 5 + Faz 6 + Faz 7 | Claude Sonnet | Wave 5 tamam | ilgili overlay testleri yesil |
| 7 | Final harmonizasyon + build | Faz 8 | Claude Sonnet | Wave 6 tamam | hedefli testler yesil, `npm run rooms:build` basarili, screenshot smoke durumu raporlandi |

---

## Uygulama Gunlugu

| Tarih | Wave | Ozet |
|---|---|---|
| 2026-05-03 | Wave 0 | `UI-REVISION-PLAN.md` guncellendi: Faz 4B (Icon Rail), Faz 4C (Processing Overlay), Wave Haritasi ve Uygulama Gunlugu eklendi; 12 acik karar kapandi. |
| 2026-05-03 | Wave 1 | Faz 0: baseline 92 test, 0 kirik. Faz 1: token blogu onceki commit'te mevcut; `lab-theme.css` letter-spacing duzeltildi, `base.css` gradient glow azaltildi. typecheck yesil, 78 UI testi gecti. Not: `--labx-border-strong` kasitli yuksek birakildi; inline opacity'ler Wave 2+ kapsami. |
| 2026-05-03 | Wave 2 | Faz 2A/2B: top bar sol kisma New Project butonu + `project-create` action baglantisi eklendi; rail pillerine SVG ikonlari eklendi; focus-visible outline standardi uygulanmadi. typecheck yesil, 78 test gecti. Not: drawerMode pill segment stili yapilmadi — Wave 3'e tasindi. |
| 2026-05-03 | Wave 3 | Wave 2 kalan: pill segment stili tamamlandi (`.labx-rail-segment` wrapper). Faz 3: preview container radius karta cekili, timeline border opacity standardi, playback control bar yuksekligi token hizasina alinaldi. typecheck yesil, 57 test gecti (source-ui + workspace-runtime + waveform-runtime). Acik nokta yok. |
| 2026-05-03 | Wave 4 | Faz 4 + Faz 4B tamamlandi. `lab-types.ts`: `inspectorPinned`/`activeIconRailSlot` state, `LabIconRailSlot` tipleri, 2 yeni event. `lab-store.ts` + `lab-run-controller.ts`: reducer + handler'lar. `workspace-surface.ts`: `renderIconRail()` + `renderIconRailPopover()`, 6 SVG ikon, hybrid popover/push. `lab-theme.css`: rail + popover stiller. i18n: `mediaAnalysis.iconRail.*`. Draft slotlar: waveform-region, color-grade. typecheck yesil. |
| 2026-05-03 | Wave 5 | Faz 4C tamamlandi. `lab-selectors.ts`: `getActiveOperationCount` + `isAnyHeavyWorkActive`; `getWorkspaceLockState` guncellendi. `workspace-surface.ts`: `renderProcessingOverlay()`, icon rail lock. `lab-top-bar.ts`: nav butonlari locked. `lab-run-controller.ts`: heavy work basinca `media.pause()`. `base.css`: z-index tokenlari. `lab-theme.css`: overlay CSS + keyframes. i18n: `overlay.*`. typecheck yesil. Acik: `laboratory-ui-evaluation-regressions` 1 test kirik (Wave 3 `.labx-media-workbench` degisikliginden — test guncellenmeli). |
| 2026-05-03 | Wave 6 | Kirik test duzeltildi (`.labx-media-workbench` regex). Faz 5: process strip compact'ta pipeline gizlendi, expanded scroll guvenligi. Faz 6: proje overlay 760px tek kolon breakpoint. Faz 7: tool card monogram span + stil, tool progress-card padding kompaktlastirildi. typecheck ve hedefli testler yesil. Screenshot smoke henuz not verified. |
| 2026-05-03 | Wave 7 | Faz 8 uygulandi. Radius/token, emoji fallback, box-shadow ve transition standardi audit edildi; kalan drift icin 2026-05-03 audit sprinti acildi. `rooms:build` basarili (forge-room, game-room, laboratory). |
| 2026-05-03 | Audit | Subagent + local audit bulgulari plana islendi: processing overlay view-model, operation-only heavy lock, stale i18n namespace, generated runtime copy metni, screenshot/build/test kanit kapsam ayrimi. |
