# Laboratory UI — Kapsam Kontrollu Revizyon Plani

> Referans: Kullanicinin gonderdigi 3 panelli mockup (Arac Yonetimi / Ana Ekran / Proje Yonetimi)
> Tarih: 2026-05-03
> Durum: Review sonrasi revize edildi. Kayitli veri temizligi ve migration beklenmez; davranis ekleyen maddeler ayrica kontratlandirilmadan uygulanmaz.

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
4. **Installed copy elle degismez.** Source of truth `rooms/laboratory` altidir; `data/rooms/laboratory` startup/install/build sync ile yenilenir.
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

**Dogrulama:** `rooms:typecheck`, ilgili CSS snapshot/assert testleri, desktop/mobile screenshot smoke.

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

**Dogrulama:** `laboratory-source-ui-regressions.test.ts` process strip testleri, expanded/compact state testleri, mobile overflow kontrolu.

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

**Dogrulama:** `laboratory-project-workspace-regressions.test.ts`, source intake/project switching testleri, mobile grid screenshot smoke.

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
- Metin taşması, button label overflow ve toolbar sıkışması için desktop/mobile screenshot smoke yapılır.

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

1. Left rail kesin olarak `52px` ikon-only mi kalacak, yoksa label gorunurlugu icin genisletilecek mi?
2. Top bar "Kaydet" butonu ilk surumde gizlensin mi, yoksa mevcut bir save action dogrulanip baglansin mi?
3. Sistem metrikleri Laboratory snapshot kontratina alinacak mi, yoksa alt strip yalniz process status olarak mi kalacak?
4. Project status tablari icin project record tarafinda status/archive alani eklenecek mi?
5. Tool overlay arama/kategori state'i ilk surum kapsaminda mi, yoksa gorsel revizyon sonrasi ikinci turda mi?
