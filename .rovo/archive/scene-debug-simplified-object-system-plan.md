# Plan: Scene Debug Simplified Object System

**Generated**: 2026-03-20
**Estimated Complexity**: High
**Scope**: Scene runtime + scene:debug editor + theme maps + page integrations

## Overview

Bu istek icin en dogru yon, sahne sistemini sifirdan baska bir sey haline getirmek degil, zaten mevcutta bulunan ortak scene altyapisini temizleyip tek gecerli kontrata indirmektir.

Bugunku kod tabaninda temel veri modeli aslinda hedefe yakin:

- `src/js/scene/schema.ts` zaten 3 node family tanimliyor: `interactive`, `back`, `character`
- Theme source `shared/themes/castle/maps/*.scene.json` altinda
- Ortak render katmanlari `src/js/scene/renderers/*` altinda
- Debug editor `src/js/scene-editor/*` altinda

Ama sistem halen tek altyapi gibi davranmiyor:

- `interactive` ve `back` iki farkli clickable renderer olarak calisiyor
- `entrance`, `assistant`, `analyze`, `server`, `settings` hotspot gorunumlerini farkli CSS sozlesmeleriyle ciziyor
- Etiket tiklanabilirligi yalnizca entrance tarafinda acik
- `scene-character-roster.ts` hala `DEFAULT_ENTRANCE_SCENE_LAYOUT` fallback'i kullaniyor
- `scene/layout/*` ile `scene-system/*` ayni theme map verisine iki farkli giris noktasi aciyor
- Editor ortak olsa da halen "tek scene object standardi" hissi vermiyor

Bu planin hedefi:

1. Scene sisteminde yalnizca 3 canonical kayit tipi kalmasi
2. Tum ileri/kapali/panel/door/object/door-label tiklama alanlarinin tek object kontratiyla yonetilmesi
3. Object-view -> room-view donusunun tek back hover alaniyla yonetilmesi
4. Karakter anchor/placement sisteminin tek pipeline ile calismasi
5. Theme genelinde tek varsayilan clickable alan standardinin kullanilmasi
6. Eski map/draft/compat katmanlarinin migrate yazmadan silinmesi

## Current Findings

### 1. Veri modeli yarim sade ama isim ve ownership karisik

- `src/js/scene/schema.ts` sadece 3 kind tasiyor, bu iyi.
- Fakat runtime dili hala product diline tam uymuyor:
  - Kullanici talebi "obje / geri / karakter"
  - Kod dili "interactive / back / character"
- `src/js/scene/layout/scene-layout-state.ts` theme JSON dosyalarini dogrudan import ediyor.
- `src/js/scene-system/scene-theme-registry.ts` ayni map'leri manifest uzerinden tekrar expose ediyor.
- Sonuc: ayni source-of-truth var ama iki ayri okuma yolu var.

### 2. Clickable alanlar tek veri tipinde ama tek render standardinda degil

- `src/js/scene/renderers/interactive-layer.ts` normal object/door/panel alanlarini ciziyor.
- `src/js/scene/renderers/back-layer.ts` geri donus alanini ayri DOM ve ayri CSS ile ciziyor.
- `src/styles/entrance/scene.css`, `src/styles/assistant.css`, `src/styles/analyze.css`, `src/styles/server.css`, `src/styles/main.css` kendi hotspot/frame gorunumlerini ayri ayri tanimliyor.
- Sonuc:
  - bazi sayfalarda cerceve hep gorunur
  - bazilarinda sadece hover'da belirginlesir
  - label arka planlari sayfaya gore degisir
  - glow davranisi sayfaya gore degisir

### 3. Etiket davranisi tum sayfalarda ortak degil

- `interactiveLabels: true` yalnizca `src/js/pages/entrance/scene/scene-controller.ts` icinde aktif.
- Diger sahnelerde etiket ayni node'nun parcasi olsa da tiklanabilir davranis ortak degil.
- Kullanici talebindeki "kapi, obje, kapi etiketi ayni obje tipini kullansin" hedefi bugun tam saglanmiyor.

### 4. Karakter placement veri modeli ortak ama runtime fallback'i legacy

- Tema map'lerde karakter placement'lari ortak `characters[]` listesiyle tutuluyor.
- `buildSceneCharacterRoster()` yine de entrance fallback'iyle calisabiliyor.
- Bu, karakter sistemini "gercekten room-agnostic" olmaktan cikariyor.

### 5. Scene:debug editor su an ihtiyacin bir kismini kapsiyor ama tek object sistemi gibi davranmiyor

- Editor su alanlari kismen destekliyor:
  - object/back placement
  - custom label
  - label visible
  - font preset
  - glow hue/alpha
- Ama su eksikler var:
  - theme-wide default object appearance paneli yok
  - back alanlari object ailesinin bir uzantisi gibi degil, ayri hissettiriyor
  - "obje" dili yerine teknik "interactive" dili baskin
  - tum sayfalarda ayni render standardini garanti eden tek preview yok

### 6. Eski map sisteminden kalan asil kalintilar dosya/file ownership seviyesinde

- `src/js/scene/layout/scene-layout-state.ts`
- `src/js/scene/layout/scene-layout-serialization.ts`
- `src/js/scene-editor/scene-map-editor.ts`
- `DEFAULT_*_SCENE_LAYOUT` sabitleri
- `scene-character-roster.ts` icindeki entrance fallback'i
- Farkli sayfalara dagilmis hotspot CSS bloklari

Bunlar aktif olarak calisiyor ama sade sistem hedefi icin gereksiz daginiklik uretiyor.

## Recommended Canonical Model

Bu refactor icin tavsiye edilen canonical model su:

### Node families

1. `object`
2. `back`
3. `character`

### Davranis kurallari

- `object`:
  - tum kapilar
  - tum paneller
  - tum "open screen" alanlari
  - tum object label hit area'lari
  - tum door label hit area'lari
- `back`:
  - yalnizca object-view -> room-view geri donus hover alani
  - her view icin tek adet
- `character`:
  - yalnizca placement/anchor kaydi

### Naming decision

Kod tabaninda temiz bir gecis icin `interactive` -> `object` rename'i tavsiye ediyorum.

Gerekce:

- Kullanici dili ile birebir uyumlu
- Editor UX'i sade olur
- "tek object tipi" karari testlerde ve JSON source'ta net gorunur
- Migration kodu yazmadan kirici ama temiz gecis yapilabilir

### Decision gate

Bu planin onerilen yolu tam rename'dir. Ancak implementation sirasinda churn beklenenden yuksek cikarsa ikinci tercih su olabilir:

- source JSON + editor UI + test dili `object` olur
- ic helper seviyesinde `interactive` isimleri gecici olarak korunur
- cleanup Sprint 5'te tamamlanir

Bu fallback sadece teslim riskini azaltmak icindir; uzun vadeli hedef yine tam rename olmalidir.

## Assumptions

- Eski local draft'lar korunmayacak.
- `shared/themes/castle/maps/*.scene.json` canonical theme map source olmaya devam edecek.
- Bu is renderer/app refactor'udur; Electron process veya DB tarafina tasinmaz.
- `rooms` sayfasi da ayni object/back/character kontratina dahil olacak; back node'a ihtiyac yoksa bos kalabilir.
- Her view icin tek `back` alani olacak; sol/sag duplicate geri alanlari olmayacak.
- Theme genelinde tek default object style policy olacak; node bazli override sadece gerekli alanlarla sinirli kalacak.

## Prerequisites

- Ana kod alanlari:
  - `src/js/scene/schema.ts`
  - `src/js/scene/layout/index.ts`
  - `src/js/scene/layout/scene-layout-state.ts`
  - `src/js/scene/layout/scene-layout-serialization.ts`
  - `src/js/scene/renderers/interactive-layer.ts`
  - `src/js/scene/renderers/back-layer.ts`
  - `src/js/scene/renderers/character-layer.ts`
  - `src/js/scene/characters/scene-character-roster.ts`
  - `src/js/modules/file-manager.ts`
  - `src/js/scene-editor/scene-editor-store.ts`
  - `src/js/scene-editor/scene-debug-room-registry.ts`
  - `src/js/scene-editor/scene-map-editor.ts`
  - `src/js/app/navigation.ts`
  - `src/js/pages/entrance/scene/scene-controller.ts`
  - `src/js/pages/analyze.ts`
  - `src/js/pages/assistant/assistant.ts`
  - `src/js/pages/server.ts`
  - `src/js/pages/rooms.ts`
  - `src/js/pages/settings/controller.ts`
  - `src/js/pages/shared/external-page.ts`
  - `src/js/ui/workspace-tool-overlay.ts`
  - `shared/themes/castle/manifest.ts`
  - `shared/themes/castle/maps/*.scene.json`
  - `src/styles/scene-system/shell.css`
  - `src/styles/scene-editor/*`
  - `src/styles/entrance/scene.css`
  - `src/styles/analyze.css`
  - `src/styles/assistant.css`
  - `src/styles/server.css`
  - `src/styles/main.css`

- Guncellenecek test seti:
  - `scripts/tests/scene-schema-regressions.test.ts`
  - `scripts/tests/scene-debug-room-regressions.test.ts`
  - `scripts/tests/scene-debug-store-regressions.test.ts`
  - `scripts/tests/scene-shell-contract-regressions.test.ts`
  - `scripts/tests/scene-theme-pack-regressions.test.ts`

## Sprint 1: Freeze The Canonical Contract
**Goal**: Eski dil ve dağınık ownership'i temizleyip tek canonical scene source kontratini netlestirmek.
**Demo/Validation**:
- Theme maps ve schema sadece `object/back/character` dili kullanir.
- Layout/source okuma yolu teke iner.
- Entrance fallback'i kalkar.

### Task 1.1: `interactive` -> `object` canonical rename
- **Location**: `src/js/scene/schema.ts`, `src/js/scene/layout/*`, `shared/themes/castle/maps/*.scene.json`
- **Description**: `SceneInteractive*` tiplerini `SceneObject*` olarak yeniden adlandir. JSON source, TS type, helper ve testlerde ayni dili kullan.
- **Complexity**: 8
- **Dependencies**: None
- **Acceptance Criteria**:
  - Schema ve map JSON artik `object`, `back`, `character` kullanir.
  - `interactive` kelimesi sadece gecis notu olmayan yerlerde kalkmis olur.
- **Validation**:
  - `rg -n "interactive" src/js/scene src/js/scene-editor shared/themes/castle scripts/tests`

### Task 1.2: Layout source access'i tek registry'ye indir
- **Location**: `src/js/scene/layout/scene-layout-state.ts`, `src/js/scene-system/scene-theme-registry.ts`, `src/js/scene/layout/index.ts`
- **Description**: Theme map okuma sorumlulugunu tek katmanda topla. `scene/layout/*` ya registry facade olur ya da tamamen `scene-system` uzerinden okur.
- **Complexity**: 7
- **Dependencies**: Task 1.1
- **Acceptance Criteria**:
  - JSON map import zinciri tek yerde kalir.
  - `DEFAULT_*_SCENE_LAYOUT` gibi room bazli sabitler source-of-truth gibi davranmaz.
- **Validation**:
  - `scripts/tests/scene-debug-store-regressions.test.ts`

### Task 1.3: Character roster fallback'ini kaldir
- **Location**: `src/js/scene/characters/scene-character-roster.ts`
- **Description**: `DEFAULT_ENTRANCE_SCENE_LAYOUT` fallback'ini sil. Roster builder sadece cagiran room'un karakter kayitlari ile calissin.
- **Complexity**: 5
- **Dependencies**: Task 1.2
- **Acceptance Criteria**:
  - Roster core belirli bir room'a bagli fallback kullanmaz.
  - Bos character listesi olan room'lar temiz sekilde desteklenir.
- **Validation**:
  - Character smoke + ilgili regression testleri

## Sprint 2: Single Clickable Area Standard
**Goal**: Tum sayfalarda kapi, obje, etiket ve hover davranisini tek object standardina cekmek.
**Demo/Validation**:
- Tum sayfalarda object frame dili ayni gorunur.
- Label hit area davranisi tum sahnelerde ayni olur.
- Back zone ayri ama ayni tasarim sisteminden beslenir.

### Task 2.1: Object ve back renderer sozlesmesini ortaklasir
- **Location**: `src/js/scene/renderers/interactive-layer.ts`, `src/js/scene/renderers/back-layer.ts`
- **Description**: Object ve back render katmanlarini ayni design-token modeline bagla. Gerekirse ortak `scene-clickable-style.ts` veya tek `scene-clickable-layer.ts` yardimci katmani ekle.
- **Complexity**: 8
- **Dependencies**: Sprint 1
- **Acceptance Criteria**:
  - Object ve back ayni token mantigi ile stil alir.
  - DOM/class sozlesmeleri tek clickable standardina baglanir.
- **Validation**:
  - Visual smoke in entrance/analyze/assistant/server/settings

### Task 2.2: Theme-wide default clickable policy tanimla
- **Location**: `src/styles/scene-system/shell.css`, yeni `src/styles/scene-system/clickable.css` veya benzeri
- **Description**: Border, glow, opacity, hover, focus, label background, label visibility ve selected state icin ortak default object/back token'larini tanimla.
- **Complexity**: 8
- **Dependencies**: Task 2.1
- **Acceptance Criteria**:
  - Page bazli hotspot stil farklari minimuma iner.
  - Varsayilan cerceve gorunurlugu tum sayfalarda tutarli olur.
- **Validation**:
  - `scripts/tests/scene-shell-contract-regressions.test.ts`

### Task 2.3: Page-specific hotspot CSS'leri sadeleştir
- **Location**: `src/styles/entrance/scene.css`, `src/styles/analyze.css`, `src/styles/assistant.css`, `src/styles/server.css`, `src/styles/main.css`
- **Description**: Her sayfadaki ozel hotspot frame/label CSS bloklarini theme token override seviyesine indir. Tam render kurali artik page CSS'te degil scene-system'de yasasin.
- **Complexity**: 9
- **Dependencies**: Task 2.2
- **Acceptance Criteria**:
  - Page CSS sadece konum/atmosfer/panel farki tasir.
  - Object frame cizimi merkezi stil sisteminden gelir.
- **Validation**:
  - `rg -n "__hotspot::before|__hotspot::after|__hotspot-label" src/styles`

### Task 2.4: Label tiklanabilirligini tum sahnelere esit uygula
- **Location**: `src/js/scene/renderers/interactive-layer.ts`, tum page controller dosyalari
- **Description**: Door label ve object label hit area davranisini her sahnede ortaklastir. Entrance'a ozel `interactiveLabels: true` ayrimini kaldir ve merkezi policy yap.
- **Complexity**: 6
- **Dependencies**: Task 2.1
- **Acceptance Criteria**:
  - Label click davranisi entrance/analyze/assistant/server/settings/rooms icin ayni olur.
  - "Kapi etiketi de ayni object tipi" davranisi gercekten saglanir.
- **Validation**:
  - Klavye ve mouse ile label activation smoke

## Sprint 3: Scene:Debug Editor Rewrite Around The Simplified Model
**Goal**: Debug editoru tek object/back/character sistemi etrafinda yeniden netlestirmek.
**Demo/Validation**:
- Editor panelleri product diline uyar.
- Object/back/character ayarlari tam olarak duzenlenebilir.
- Theme-wide default ve node override ayrimi netlesir.

### Task 3.1: Editor naming ve node list semantics'ini sadeleştir
- **Location**: `src/js/scene-editor/scene-map-editor.ts`
- **Description**: Teknik `interactive` dili yerine `object` dili kullan. Panel section basliklari, secim metinleri ve yardim kopyalarini sade sisteme gore guncelle.
- **Complexity**: 5
- **Dependencies**: Sprint 1
- **Acceptance Criteria**:
  - Editor artik `Objects / Back / Characters` diliyle calisir.
  - Product ve code dili uyumlu olur.
- **Validation**:
  - `scripts/tests/scene-debug-room-regressions.test.ts`

### Task 3.2: Kullanici istedigi detayli object ayarlarini expose et
- **Location**: `src/js/scene-editor/scene-map-editor.ts`, `src/js/scene/schema.ts`
- **Description**: Object secildiginde su alanlarin tamami editor panelinden duzenlenebilsin:
  - detayli clickable placement
  - custom label
  - detayli label placement
  - text size / tracking / font
  - visible / hidden
  - glow hue / alpha
  - gerekiyorsa frame variant ve perspective
- **Complexity**: 8
- **Dependencies**: Task 3.1
- **Acceptance Criteria**:
  - Kullanici istegindeki object debug kontrolleri eksiksiz panelde vardir.
  - JSON source ile editor alanlari birebir eslenir.
- **Validation**:
  - Editor smoke: select, move, relabel, hide/show, glow change, save

### Task 3.3: Back hover alani editorunu object ile ayni kaliteye cek
- **Location**: `src/js/scene-editor/scene-map-editor.ts`, `src/js/scene/renderers/back-layer.ts`
- **Description**: Back node icin de ayni seviye placement, label placement, text ve glow duzenleme kontrolleri ver.
- **Complexity**: 6
- **Dependencies**: Task 3.2
- **Acceptance Criteria**:
  - Her view'in tek geri alani editor icinde rahatca duzenlenir.
  - Back node object sisteminden farkli hissettirmez.
- **Validation**:
  - Analyze/assistant/server/settings back node smoke

### Task 3.4: Theme default vs node override editor modelini ekle
- **Location**: `src/js/scene-editor/scene-map-editor.ts`, `shared/themes/castle/manifest.ts` veya yeni theme defaults source
- **Description**: Tum clickable alanlari tema genelinde tek standarda cekebilmek icin object/back default appearance degerlerini editor veya source contract uzerinden yonetilebilir hale getir.
- **Complexity**: 8
- **Dependencies**: Task 3.2, Task 3.3
- **Acceptance Criteria**:
  - Bir tema default'u ile butun clickable alanlar ortak gorunur.
  - Sadece gerekli node'larda lokal override kullanilir.
- **Validation**:
  - Bir default degisikligi tum sahnelerde etkisini gosterir.

## Sprint 4: Shared Page Runtime Integration
**Goal**: Tum sahnelerin tek gecerli altyapiya baglanmasi ve sayfa tekrarlarinin azaltilmasi.
**Demo/Validation**:
- Tum scene sayfalari ayni session/controller yardimcilariyla calisir.
- Tek bir object standardi tum sayfalarda gorulur.
- Her view icin tek back alani dogru calisir.

### Task 4.1: Page controller tekrarlarini scene session katmanina topla
- **Location**: yeni `src/js/scene-system/player/*` veya `src/js/scene/session/*`, mevcut page controllers
- **Description**: Her controller icindeki tekrar eden draft load, selection, renderHotspots, renderBack, renderCharacters, resize sync ve scene-debug wiring kodlarini ortaklastir.
- **Complexity**: 9
- **Dependencies**: Sprint 2, Sprint 3
- **Acceptance Criteria**:
  - Entrance/analyze/assistant/server/rooms/settings page controller'lari daha ince hale gelir.
  - Scene runtime kararlari tek katmanda toplanir.
- **Validation**:
  - Controller smoke: navigate, open view, back, debug selection

### Task 4.2: Tek back zone policy'sini tum object-view'lara uygula
- **Location**: `shared/themes/castle/maps/*.scene.json`, tum ilgili page controller'lar
- **Description**: Assistant primary, server primary, analyze table, analyze archive, entrance whisper, settings panel view icin yalnizca birer `back` kaydi oldugunu garanti et. Rooms'ta gerekiyorsa bos birak.
- **Complexity**: 5
- **Dependencies**: Task 4.1
- **Acceptance Criteria**:
  - View basi birden fazla geri alani kalmaz.
  - View kapama davranisi sadece bu kayitla ilerler.
- **Validation**:
  - Theme map review + UI smoke

### Task 4.3: Settings ve rooms dahil tum sayfalari ayni object altyapisina bagla
- **Location**: `src/js/pages/settings/controller.ts`, `src/js/pages/rooms.ts`, diger page controller'lar
- **Description**: Su an daha ozel davranan settings ve rooms akisini da ortak scene object/back/character session akisina tam bagla.
- **Complexity**: 7
- **Dependencies**: Task 4.1
- **Acceptance Criteria**:
  - Settings hotspot/label/render davranisi diger sayfalardan kopuk kalmaz.
  - Rooms sayfasi da ayni editor/session yapisini kullanir.
- **Validation**:
  - `scripts/tests/scene-debug-room-regressions.test.ts`

### Task 4.4: Scene:debug room routing ve workspace tool entegrasyonunu sabitle
- **Location**: `src/js/scene-editor/scene-debug-room-registry.ts`, `src/js/app/navigation.ts`, `src/js/pages/shared/external-page.ts`, `src/js/ui/workspace-tool-overlay.ts`
- **Description**: Debug room secimi, host shell navigation, external page donusu ve workspace tool open/close akisini yeni object/back session mimarisiyle uyumlu hale getir.
- **Complexity**: 7
- **Dependencies**: Task 4.1, Task 4.3
- **Acceptance Criteria**:
  - Scene:debug oda gecisi settings/external page senaryolarinda bozulmaz.
  - `data-scene-debug-room` ve `data-active-page` semantigi yeni session akisi ile tutarli kalir.
- **Validation**:
  - Manual room-switch smoke in scene:debug

## Sprint 5: Remove Old Map System Remnants
**Goal**: Migration yazmadan eski map/draft/compat kalintilarini tamamen temizlemek.
**Demo/Validation**:
- Eski isimler ve kalintilar kod tabanindan kalkar.
- Yalnizca yeni source/renderer/editor altyapisi kalir.
- Testler yeni dili ve dosya ownership'ini korur.

### Task 5.1: Legacy dosya ve isim kalintilarini temizle
- **Location**: `src/js/scene/layout/*`, `src/js/scene-editor/scene-map-editor.ts`, ilgili testler
- **Description**: `scene-map`, `layout-state`, `interactive`, `DEFAULT_*_SCENE_LAYOUT` gibi eski sistem izlerini yeni ownership'e gore yeniden adlandir veya kaldir.
- **Complexity**: 7
- **Dependencies**: Sprint 4
- **Acceptance Criteria**:
  - Kod tabaninda eski isimler sadece gerekiyorsa gecis notu veya test fixture disinda kalmaz.
- **Validation**:
  - `rg -n "scene-map|layout-state|DEFAULT_.*SCENE_LAYOUT|interactive" src scripts/tests`

### Task 5.2: Eski draft key'lerini kirici sekilde sifirla
- **Location**: `src/js/scene-editor/scene-editor-store.ts`
- **Description**: Draft key versiyonunu veya draft namespace'ini degistir. Eski draft formatlariyla uyumluluk kodu ekleme.
- **Complexity**: 4
- **Dependencies**: Sprint 3
- **Acceptance Criteria**:
  - Eski scene debug draft'lari yok sayilir.
  - Yeni editor yalnizca yeni canonical source'u serialize eder.
- **Validation**:
  - `scripts/tests/scene-debug-store-regressions.test.ts`

### Task 5.3: Regression test paketini yeni yapinin koruyucusu yap
- **Location**: `scripts/tests/scene-*.test.ts`
- **Description**: Testleri yeni canonical dile ve ownership'e gore guncelle. Eski interactive/back-zone/layout-state beklentileri yerine yeni object/back/character source, tek style policy ve tek back area davranisini dogrula.
- **Complexity**: 8
- **Dependencies**: Sprint 5.1, Task 5.2
- **Acceptance Criteria**:
  - Test paketi yeni mimariyi korur.
  - Stale eski dosya/dil beklentileri temizlenir.
- **Validation**:
  - hedefli `node --test scripts/tests/scene-*.test.ts` veya repo icindeki esdeger test akisi

## Testing Strategy

- Static contract tests:
  - schema kind listesi
  - theme map source path ownership
  - editor section labels
  - old naming kalintilarinin kalkmasi
- Runtime smoke:
  - entrance -> whisper -> geri
  - analyze -> table -> geri
  - analyze -> archive -> geri
  - assistant -> primary -> geri
  - server -> primary -> geri
  - settings -> panel -> geri
- Visual smoke:
  - tum sayfalarda frame gorunurlugu
  - hover/focus/selected davranislari
  - label click davranisi
  - debug secim highlight'i
- Editor smoke:
  - object sec
  - placement degistir
  - label gizle/goster
  - custom label ver
  - glow ayarla
  - kaydet

## Potential Risks And Gotchas

- En buyuk teknik risk, bu isin yalnizca schema degisikligi gibi gorunup aslinda CSS ownership refactor'u olmasi.
- `interactive` -> `object` rename'i genis capli oldugu icin test ve JSON degisikligi birlikte ilerlemeli.
- Eger rename churn'u teslimi tehdit ederse, once editor/source dilini `object` yapip helper temizligini Sprint 5'e itmek gerekir.
- Settings hotspot stilleri `src/styles/main.css` icinde; bu sayfa digerlerinden daha kolay kacabilir.
- `renderSceneBackLayer()` ve object render stilini ayni standarda cekerken "geri alani"nin fazla agresif veya fazla gorunmez olmasi UX bozabilir.
- Draft reset kirici oldugu icin bu karar implementation basinda acikca sabitlenmeli.
- Character roster fallback'i kaldirilinca bazi room'larda bos state ile ilgili gizli varsayimlar ortaya cikabilir.
- `Save Map` akisi `scene-editor-store.ts` -> `FileManager.writeFileAtomic()` -> Electron bridge zincirine bagli; source-save UX'i refactor sirasinda koparsa editor var gorunup kaydetmeyen bir moda dusebilir.

## Rollback Plan

1. Canonical rename sorun cikarirsa `interactive` adina gecici donus yapilabilir ama source ownership temizligi korunur.
2. Central clickable CSS visual regression uretirse page-level hotspot CSS bloklari gecici olarak geri baglanir.
3. Editor rewrite sorun cikarirsa sadece source save kapatilip debug read-only moda alinabilir.
4. Session abstraction sorun cikarirsa controller entegrasyonlari tek tek geri alinabilir; theme map source ve test temizligi yine korunabilir.

## Recommended Implementation Order

1. Sprint 1
2. Sprint 2
3. Sprint 3
4. Sprint 4
5. Sprint 5

Bu siralama degismemeli; cunku asil bug kaynagi once canonical ownership ve tek style policy kurulmadan editor veya page controller refactor'una girilirse ayni daginiklik yeni adlarla geri uretilir.
