# Plan: Scene Debug Remaining Seams Cleanup

**Generated**: 2026-03-20
**Estimated Complexity**: Medium-High

## Overview

Ana `object/back/character` refactor'i, layout registry tekillestirmesi ve shared clickable standardi tamamlandi. Bu follow-up planin amaci, artik davranisi bozmayip sade sistem hedefine tam uymayan son seam'leri kapatmaktir.

Bu plan su 4 kalan alan uzerine odaklanir:

1. Theme-wide clickable defaults'in sadece CSS degil, editor ve source-of-truth seviyesinde canonical hale gelmesi
2. `back` alaninin ortak clickable sistemine tam gecip `scene-back-zone*` legacy contract'ini tasimamasI
3. Eski "map" isimlendirme ve ownership seam'lerinin temizlenmesi
4. Scene debug override katmaninin page-specific selector'lerden generic selector'lere cekilmesi

Bu isler ana refactor'i geri acmaz. Yaklasim, mevcut green test state'i koruyup her sprintte kucuk ama demoable bir cleanup dilimi teslim etmektir.

## Confirmed Decisions

- Theme-wide clickable defaults, room map JSON icine dagitilmayacak; ayri bir theme-level source dosyasi olacak.
- `back` legacy contract cleanup'i compatibility katmani olmadan tamamlanacak.
- `scene-map-editor` naming'i compatibility alias birakmadan canonical yeni isme tasinacak.

## Assumptions

- `shared/themes/castle/maps/*.scene.json` room-local object/back/character source olarak kalmaya devam eder.
- Theme-wide defaults, room map JSON icine dagitilmak yerine theme-level bir source'ta tutulur.
- `scene:debug` icindeki detayli object/back ayarlari korunur; bu plan bunlara ek olarak theme default editor yuzeyi getirir.
- Back behavior degismez: her view icin tek geri hover alani modeli kalir.
- Kirici cleanup kabul edilebilir; migrate veya compatibility katmani eklenmez.

## Prerequisites

- Mevcut green baseline:
  - `npm run typecheck`
  - `npx tsx --test scripts/tests/scene-schema-regressions.test.ts scripts/tests/scene-debug-room-regressions.test.ts scripts/tests/scene-debug-store-regressions.test.ts scripts/tests/scene-theme-pack-regressions.test.ts scripts/tests/scene-shell-contract-regressions.test.ts`
- Ana dokunulacak alanlar:
  - `src/styles/scene-system/clickable.css`
  - `src/styles/scene-system/shell.css`
  - `src/styles/scene-editor/debug-overrides.css`
  - `src/js/scene/renderers/back-layer.ts`
  - `src/js/scene-editor/scene-map-editor.ts`
  - `src/js/scene/layout/scene-layout-state.ts`
  - `src/js/scene/schema.ts`
  - `src/js/scene-system/theme-source-contract.ts`
  - `src/js/scene-system/index.ts`
  - `shared/themes/castle/manifest.ts`

## Sprint 1: Theme Defaults As Source Of Truth
**Goal**: Theme-wide clickable defaults'i shared CSS fallback olmaktan cikarip canonical theme config + editor yuzeyi haline getirmek.
**Demo/Validation**:
- Scene debug icinde "Theme Defaults" veya esdeger bir panel acilir.
- Object/back default glow, label visible, font, text size, tracking, label background ve benzeri ayarlar editor'den okunur.
- Bir default degistiginde object/back preview tum sahnelerde tutarli gorunur.

### Task 1.1: Define theme-level scene clickable defaults contract
- **Location**: `src/js/scene/schema.ts`, `src/js/scene-system/theme-source-contract.ts`, yeni `shared/themes/castle/scene-clickable-defaults.ts`
- **Description**: Object ve back icin theme-wide default tokens'i tanimlayan yeni bir contract ekle. Node-level alanlar override, theme-level alanlar fallback mantigi ile calissin.
- **Dependencies**: None
- **Acceptance Criteria**:
  - Theme source object/back defaultlarini tipli sekilde expose eder.
  - `clickable.css` icindeki hardcoded defaultlar contract-backed fallback haline gelir.
- **Validation**:
  - Typecheck
  - Yeni regression: theme default contract shape

### Task 1.2: Add runtime resolvers for default clickable settings
- **Location**: `src/js/scene-system/index.ts`, yeni resolver dosyasi `src/js/scene-system/scene-clickable-theme.ts`, `src/js/scene/renderers/object-layer.ts`, `src/js/scene/renderers/back-layer.ts`
- **Description**: Theme defaultlarini render katmanlarina tasiyan resolver ekle. Object/back renderers node alanini, sonra theme defaultu, sonra CSS fallback'i okusun.
- **Dependencies**: Task 1.1
- **Acceptance Criteria**:
  - Render katmanlari theme-backed defaults ile calisir.
  - Shared clickable CSS only-last-resort fallback olur.
- **Validation**:
  - `scripts/tests/scene-theme-pack-regressions.test.ts`
  - `scripts/tests/scene-debug-room-regressions.test.ts`

### Task 1.3: Expose theme defaults in scene:debug editor
- **Location**: `src/js/scene-editor/scene-map-editor.ts`, `src/js/scene-editor/scene-editor-store.ts`, ilgili room controllers
- **Description**: Mevcut node editor'e ek olarak theme default paneli ekle. Object ve back defaultlari icin label visibility, custom label policy, glow, text ve frame davranisi ayarlanabilsin.
- **Dependencies**: Task 1.2
- **Acceptance Criteria**:
  - Editor object/back node duzeyini ve theme default duzeyini ayri gosterir.
  - Theme default degisiklikleri preview'e yansir.
  - Save flow netlesir: room layout save ile theme default save birbirine karismaz.
- **Validation**:
  - Scene debug smoke
  - UI regression assertions

## Sprint 2: Back Contract Full Simplification
**Goal**: `back` katmanini yapisal olarak da ortak clickable sistemine alip `scene-back-zone*` legacy contract'ini kaldirmak.
**Demo/Validation**:
- Back layer yalnizca ortak clickable DOM/class sozlesmesini kullanir.
- `shell.css` icinde back icin legacy selector ailesi kalmaz.
- Entrance/analyze/assistant/server/settings geri davranisi ayni kalir.

### Task 2.1: Remove legacy back DOM/class contract
- **Location**: `src/js/scene/renderers/back-layer.ts`
- **Description**: `scene-back-zone`, `scene-back-zone__arrow`, `scene-back-zone__copy` isimlerini ortak clickable isimlerine cek. Back renderer sadece `scene-clickable__*` contract'i uretsin.
- **Dependencies**: Sprint 1
- **Acceptance Criteria**:
  - Back renderer legacy class uretmez.
  - `data-scene-generated-back` disinda back'e ozgu DOM contract minimuma iner.
- **Validation**:
  - `rg -n "scene-back-zone" src/js/scene/renderers src/styles`

### Task 2.2: Move back visual tokens into shared clickable system
- **Location**: `src/styles/scene-system/clickable.css`, `src/styles/scene-system/shell.css`
- **Description**: Back arrow/copy/hover/focus styling'ini ortak clickable katmanina tasi. `shell.css` sadece scene shell layout ve generic container sorumlulugu tasisin.
- **Dependencies**: Task 2.1
- **Acceptance Criteria**:
  - Back visual state shared clickable tokenlari ile tanimlanir.
  - `shell.css` legacy back styling source-of-truth olmaktan cikar.
- **Validation**:
  - `scripts/tests/scene-shell-contract-regressions.test.ts`
  - Visual smoke in scene mode

### Task 2.3: Lock back behavior with regression coverage
- **Location**: `scripts/tests/scene-shell-contract-regressions.test.ts`, `scripts/tests/scene-debug-room-regressions.test.ts`
- **Description**: Testleri legacy back contract'in yoklugunu ve shared clickable back contract'ini assert edecek sekilde guncelle.
- **Dependencies**: Task 2.2
- **Acceptance Criteria**:
  - Testlerde `scene-back-zone*` yoklugu assert edilir.
  - Shared back contract icin positive assertions eklenir.
- **Validation**:
  - Hedefli tsx test kosusu

## Sprint 3: Naming And Ownership Cleanup
**Goal**: Eski "map" seam'lerini ve confusing editor naming'lerini temizlemek.
**Demo/Validation**:
- Scene editor dosya/surface isimleri yeni canonical dili yansitir.
- Kullaniciya gosterilen "Save Map" gibi yuzeyler yeni ownership modelini dogru anlatir.

### Task 3.1: Rename editor surface from map-centric naming
- **Location**: `src/js/scene-editor/scene-map-editor.ts`, `src/js/scene-editor/index.ts`, import eden controller'lar, testler
- **Description**: `scene-map-editor` dosyasini ve ilgili type/interface isimlerini `scene-layout-editor` canonical ismine cek.
- **Dependencies**: Sprint 2
- **Acceptance Criteria**:
  - Editor dosya ve export isimleri eski map modelini cagristirmaz.
  - Testler yeni isimlendirmeyi kullanir.
- **Validation**:
  - Typecheck
  - `rg -n "scene-map-editor|Scene Map|Save Map" src/js scripts/tests`

### Task 3.2: Align scene layout helper naming with current ownership
- **Location**: `src/js/scene/layout/scene-layout-state.ts`, ilgili testler
- **Description**: `getSceneLayoutForRoom()` ve benzeri helper surface'lerde gerekirse naming sadelemesi yap. Bu dosya artik pure layout helper katmani ise, isimlendirme de bunu yansitsin.
- **Dependencies**: Task 3.1
- **Acceptance Criteria**:
  - Layout helper adlari source ownership ile celismez.
  - "default" veya "map" gibi eski source-of-truth imasi yapan seam kalmaz.
- **Validation**:
  - `scripts/tests/scene-debug-store-regressions.test.ts`

### Task 3.3: Update UX copy around room layout persistence
- **Location**: `src/js/scene-editor/scene-map-editor.ts`, varsa i18n/text surface'leri
- **Description**: "Save Map", "theme map" ve benzeri copy'leri yeni ownership modeline gore duzelt. Toolbar copy'si `Save Layout` ve theme defaults icin ayri eylem/copy dili ile netlestirilsin.
- **Dependencies**: Task 3.1
- **Acceptance Criteria**:
  - Editor toolbar ve subtitle copy'si yeni sistemi dogru anlatir.
  - Kullanici icin room layout save ve theme defaults save birbirinden ayridir.
- **Validation**:
  - UI smoke
  - Text regression asserts

## Sprint 4: Debug Overrides Genericization
**Goal**: Scene debug override katmanini page-specific hotspot selector'lerden kurtarip generic clickable/debug selector ailesine cekmek.
**Demo/Validation**:
- Debug mode'da label editability ve selected states ayni kalir.
- `debug-overrides.css` generic selector tabanli olur.

### Task 4.1: Replace page-specific hotspot debug selectors with generic clickable selectors
- **Location**: `src/styles/scene-editor/debug-overrides.css`
- **Description**: `entrance/analyze/assistant/server/settings` hotspot label selector'lerini `scene-clickable__*` tabanli generic selector'lere indir. Sadece karakter pointer override'lari page-specific kalabilir.
- **Dependencies**: Sprint 3
- **Acceptance Criteria**:
  - Hotspot debug override katmaninda page-specific selector tekrari minimuma iner.
  - Object/back label editability ortak selector ailesiyle calisir.
- **Validation**:
  - `rg -n "entrance-scene__hotspot|analyze-scene__hotspot|assistant-scene__hotspot|server-scene__hotspot|settings-scene__hotspot" src/styles/scene-editor/debug-overrides.css`

### Task 4.2: Normalize debug-only visual tokens
- **Location**: `src/styles/scene-editor/debug-overrides.css`, gerekirse `src/styles/scene-system/clickable.css`
- **Description**: Debug label ring/shadow/background ayrimlarini ortak tokenlar uzerine kur. Analyze-specific shadow gibi kalan tekil degerler gerekliyse debug token olarak merkezi yere tasinsin.
- **Dependencies**: Task 4.1
- **Acceptance Criteria**:
  - Debug visuals theme-wide tek mantikla calisir.
  - Page bazli exception varsa sebebi acik ve sinirli olur.
- **Validation**:
  - Scene debug visual smoke

## Sprint 5: Final Verification And Cleanup Lock
**Goal**: Kalan seam'lerin kapandigini test ve smoke ile kilitlemek.
**Demo/Validation**:
- Scene ve scene:debug modunda manual smoke tamamlanir.
- Legacy seam aramalari temiz doner.
- Mevcut green baseline korunur.

### Task 5.1: Expand regression coverage for defaults and cleanup seams
- **Location**: `scripts/tests/scene-debug-room-regressions.test.ts`, `scripts/tests/scene-shell-contract-regressions.test.ts`, `scripts/tests/scene-debug-store-regressions.test.ts`
- **Description**: Theme defaults source, back contract cleanup, editor naming cleanup ve generic debug overrides icin explicit regression ekle.
- **Dependencies**: Sprint 4
- **Acceptance Criteria**:
  - Hedeflenen seam'ler testlerle kilitlenir.
- **Validation**:
  - Full targeted tsx regression set

### Task 5.2: Run manual scene smoke checklist
- **Location**: Scene mode runtime
- **Description**: Entrance, analyze, assistant, server, settings, rooms icin room view, object view, back hover, label click, scene debug selection ve save akisini elle kontrol et.
- **Dependencies**: Task 5.1
- **Acceptance Criteria**:
  - Her sayfada frame gorunurlugu, hover, label hit area ve back davranisi tutarlidir.
  - Scene debug'ta object/back/character secimi bozulmaz.
- **Validation**:
  - Manual smoke notes
  - Gerekirse Electron screenshot

## Testing Strategy

- Her sprint sonunda:
  - `npm run typecheck`
  - Hedefli `tsx` regression kosusu
- Contract cleanup sonrasinda:
  - `rg` seam aramalari
  - Scene mode ve scene:debug mode visual smoke
- Editor/save degisikliklerinde:
  - Draft load/reset/save source davranisi
  - Theme defaults save ile room layout save ayrimi

## Potential Risks & Gotchas

- Theme defaults'in ayri theme-level source dosyasinda tutulmasi kararlastirildi; bu karar save/load zincirine ikinci persistence yolu ekleyecegi icin editor UX'i ve testleri birlikte guncellenmeli.
- Theme defaults editor'u eklenirken mevcut `Save Map` akisi yeterli olmayabilir; ayrik save butonu veya ayrik persistence katmani gerekebilir.
- `back` contract'i bir seferde kirici temizlenirse testler disinda runtime class bagimliliklari cikabilir; scene shell CSS ve debug CSS birlikte temizlenmeli.
- `debug-overrides.css` generic hale getirilirken karakter pointer behavior'i yanlislikla kaybolabilir; hotspot ve character selector'leri ayri ele alinmali.
- Naming cleanup test snapshot/regex expectation'larini genis etkiler; sprint sonunda toplu rg dogrulamasi gerekir.

## Rollback Plan

- Sprint bazli rollback uygula; her sprint ayri commit olacak sekilde ilerle.
- Theme defaults source tanimi sorun cikarirsa, resolver katmani geri alinir ama mevcut `clickable.css` fallback'leri korunur.
- Back contract cleanup sorun cikarirsa, `back-layer.ts` ve `shell.css` icin onceki class contract'ina donulebilir.
- Naming cleanup sorun cikarirsa, compatibility alias eklemek yerine ilgili sprint tamamen geri alinur.
