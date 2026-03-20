# Plan: Centralize Classic Theme, Scene System, and Scene Editor

**Generated**: 2026-03-20
**Estimated Complexity**: High
**Scope**: Renderer/app only, `ghost-agent` excluded

## Overview

Bu calismanin hedefi, su anda kismen ic ice gecmis 3 yapinin net sekilde ayrilmasidir:

1. `classic theme` + `design system`
2. `scene theme` + `scene player`
3. `scene:debug` + `scene editor`

Istenen son model:

- `design system` sadece classic theme yapisini icerir.
- `scene system` Hayalet-ev tarafinda bir player/runtime gibi davranir.
- `scene:debug` yalnizca theme map kayitlarini duzenleyen UI editor olur.
- Tum room map, back zone, character anchor ve scene asset kayitlari theme klasorunde tek kaynak olarak tutulur.
- `scene system` ve `scene editor` ayni theme kaynagindan okur.
- `scene editor` draft veya source write-back davranisini ayni canonical kontrat uzerinden yonetir.

## Current Findings

Mevcut kod tabaninda ayrim kismen baslamis, ama source-of-truth ve CSS ownership halen karisik:

- Classic theme runtime zaten buyuk oranda `src/js/ui/theme/*` altinda:
  - `src/js/ui/theme/classic-theme-manager.ts`
  - `src/js/ui/theme/theme-host-sync.ts`
  - `src/js/ui/theme/theme-settings-ui.ts`
- Scene visual asset tarafi `src/js/scene/theme/*` altinda:
  - `src/js/scene/theme/castle-scene-theme-pack.ts`
  - `src/js/scene/theme/scene-theme-assets.ts`
  - `src/js/scene/theme/scene-character-theme.ts`
- Ama gerçek scene map kaynagi halen theme sisteminde degil:
  - `src/js/scene/layout/scene-layout-state.ts`
  - `DEFAULT_ENTRANCE_SCENE_LAYOUT`
  - `DEFAULT_ANALYZE_SCENE_LAYOUT`
  - `DEFAULT_ASSISTANT_SCENE_LAYOUT`
  - `DEFAULT_SERVER_SCENE_LAYOUT`
  - `DEFAULT_ROOMS_SCENE_LAYOUT`
  - `DEFAULT_SETTINGS_SCENE_LAYOUT`
- Debug edit islemleri `src/js/scene/debug/*` altinda olsa da her page controller kendi store/editor kurulumunu tekrar ediyor:
  - `src/js/pages/entrance/scene/scene-controller.ts`
  - `src/js/pages/analyze.ts`
  - `src/js/pages/assistant/assistant.ts`
  - `src/js/pages/server.ts`
  - `src/js/pages/rooms.ts`
  - `src/js/pages/settings/controller.ts`
- `scene-shell.css` halen `src/styles/design-system/index.css` icinde import ediliyor. Bu, "design system classic-only" hedefi ile celisiyor.
- `scene editor` CSS'i halen `src/styles/entrance/scene.css` icine gomulu. Bu da editor sistemini entrance sayfasina bagli gibi gosteriyor.
- `scene-character-roster.ts` fallback olarak `DEFAULT_ENTRANCE_SCENE_LAYOUT` kullaniyor. Bu, runtime core'u belirli bir room default'una bagliyor.
- `.rovo/03-ARCHITECTURE.md` ve bazi regression testleri eski dosya yollarini veya artik var olmayan manifest modelini referansliyor.

## Recommended Decisions Before Implementation

Uygulamaya gecmeden once su kararlar alinmali ve plana bunlar baz alinmalidir:

1. **Theme map source-of-truth JSON olmali.**
   - Editor tarafinin ayni dosyayi okuyup guncelleyebilmesi icin map kayitlarini `json` veya benzeri saf veri dosyalarinda tutmak daha dogru olur.
   - Runtime tarafi typed loader/adapter uzerinden bu veriyi tuketir.
   - Editor'ün dogrudan `ts` kaynak dosya yeniden yazmasi gereksiz risk yaratir.

2. **Theme klasoru tek paket olmali: asset + map + metadata.**
   - Ayrik `scene layout state`, ayrik `debug theme`, ayrik `theme pack` yerine tek bir theme source paketi olmalidir.

3. **Scene runtime theme-agnostic olmali.**
   - Runtime `castle` bilmemeli.
   - Sadece aktif theme id ve typed source contract bilmelidir.

4. **Scene editor auto-save ile source yazmamali.**
   - Editor once memory/local draft uzerinde calismali.
   - `Apply to theme source` veya `Save map` gibi acik bir aksiyon source write-back yapmali.
   - Bu, yanlis drag hareketlerinin dogrudan canonical source'u bozmasini engeller.

5. **`ui-mode` 3 sistemden biri olmamali; ince bir orchestration katmani olmali.**
   - `classic`, `scene`, `scene-debug` secimi hicbir domain'e ait olmamali.
   - `src/js/app/ui-mode/*` veya benzeri ince bir orchestration noktasi olarak kalmali.

6. **CSS de JS ile ayni sinirlarda bolunmeli.**
   - `src/styles/design-system/*` -> classic only
   - `src/styles/scene-system/*` -> runtime/player
   - `src/styles/scene-editor/*` -> debug/editor

7. **Shared root icin alias ve TS include guncellemesi zorunlu.**
   - `vite.config.js` ve `tsconfig*.json` su an `shared/themes/**/*` gibi yeni dosyalari kapsamayacak.
   - Bu build/plumbing isi ilk sprintte cozulmeli.

## Target Architecture

Onerilen hedef klasor yapisi:

```text
shared/
  themes/
    schema/
      scene-theme-schema.ts
      scene-map-schema.ts
    castle/
      manifest.ts
      assets/
        entrance/
        analyze/
        assistant/
        server/
        rooms/
        settings/
        loading/
        characters/
      maps/
        entrance.scene.json
        analyze.scene.json
        assistant.scene.json
        server.scene.json
        rooms.scene.json
        settings.scene.json

src/js/
  ui/
    theme/                      # classic theme only
  scene/
    core/                       # schema, projection, renderers, navigation, runtime helpers
  scene-system/
    player/
    registry/
    adapters/
  scene-editor/
    session/
    store/
    io/
    ui/

src/styles/
  design-system/               # classic only
  scene-system/
    index.css
    tokens.css
    shell.css
    layers.css
    pages/
  scene-editor/
    index.css
    panel.css
    debug-overlays.css
```

### Ownership Rules

- `shared/themes/*`:
  - source-of-truth data
  - room maps
  - character anchor data
  - back button maps
  - loading frame definitions
  - theme-local assets
- `src/js/ui/theme/*`:
  - classic theme state
  - appearance settings
  - classic design-system theme application
  - host sync adapters
- `src/js/scene/core/*`:
  - generic runtime helpers
  - renderers
  - projection
  - schema parsing/validation
  - no castle imports
  - no editor imports
- `src/js/scene-system/*`:
  - active theme loading
  - map resolution
  - scene room/view asset lookup
  - player/session orchestration
- `src/js/scene-editor/*`:
  - selection state
  - room switch
  - draft state
  - save/export/apply
  - source write-back adapter

## Proposed Data Contract

Theme source contract su 4 katmandan olusmali:

1. `manifest.ts`
   - theme id
   - asset references
   - loading config
   - character role visuals
   - room-level asset references
2. `maps/*.scene.json`
   - interactive nodes
   - back nodes
   - character anchors
   - view-specific mappings
3. shared schema/validator
   - runtime validation
   - editor validation
4. scene player adapter
   - manifest + map dosyalarini runtime dostu tek API'ye donusturur

Bu modelde mevcut `SceneThemePack` ve `SceneLayoutConfig` sorumluluklari net ayrilir:

- `SceneThemePack` benzeri yapi -> asset/visual + room bindings
- `SceneLayoutConfig` benzeri yapi -> map data
- runtime player -> bu ikisini birlestiren tek tuketim API'si

## Prerequisites

- Key implementation files:
  - `vite.config.js`
  - `tsconfig.json`
  - `tsconfig.electron.json`
  - `tsconfig.mcp.json`
  - `src/styles/design-system/index.css`
  - `src/styles/entrance.css`
  - `src/styles/entrance/scene.css`
  - `src/styles/assistant.css`
  - `src/styles/analyze.css`
  - `src/styles/server.css`
  - `src/styles/main.css`
  - `src/js/ui/theme/*`
  - `src/js/scene/theme/*`
  - `src/js/scene/layout/*`
  - `src/js/scene/debug/*`
  - `src/js/scene/characters/scene-character-roster.ts`
  - `src/js/scene/window-controls.ts`
  - `src/js/app/ui-mode/*`
  - `src/js/app/navigation.ts`
  - all scene-enabled page controllers
- Tests likely affected:
  - `scripts/tests/theme-classic-modularization-regressions.test.ts`
  - `scripts/tests/scene-theme-pack-regressions.test.ts`
  - `scripts/tests/scene-debug-store-regressions.test.ts`
  - `scripts/tests/scene-debug-room-regressions.test.ts`
  - `scripts/tests/scene-shell-contract-regressions.test.ts`
  - `scripts/tests/ui-mode-orchestration-regressions.test.ts`
  - `scripts/tests/rooms-scene-page-regressions.test.ts`
- Documentation likely affected:
  - `.rovo/03-ARCHITECTURE.md`
  - older `.rovo/*scene*plan.md` drafts if they are kept as references

## Sprint 1: Shared Theme Source and Build Plumbing
**Goal**: Theme source-of-truth'i `shared/themes` altina tasimak icin teknik zemini hazirlamak.
**Demo/Validation**:
- Renderer code `shared/themes/*` altindan typed data import edebilir.
- Theme assets ve map dosyalari tek root altinda durur.
- Eski `castle-scene-theme-pack` ve `scene-layout-state` henuz facade olarak calisabilir.

### Task 1.1: Shared theme alias ve include ayarlarini ekle
- **Location**: `vite.config.js`, `tsconfig.json`, `tsconfig.electron.json`, `tsconfig.mcp.json`
- **Description**: `shared/themes/**/*` importlari icin alias ve include destegi ekle. Oneri: `@theme-source/*`.
- **Complexity**: 4
- **Dependencies**: None
- **Acceptance Criteria**:
  - Renderer, script ve test katmani yeni root'u cozer.
  - Vite asset serving outside `src` kirilmaz.
- **Validation**:
  - `npm run typecheck`
  - `npm run build`

### Task 1.2: Theme source schema kontratini tanimla
- **Location**: yeni `shared/themes/schema/*`
- **Description**: Manifest ve scene map icin canonical schema tanimla. Runtime ve editor ayni schema'yi kullansin.
- **Complexity**: 6
- **Dependencies**: Task 1.1
- **Acceptance Criteria**:
  - Asset metadata ve map data ayridir.
  - Room map formatinda `interactive`, `back`, `character` tipleri net tanimlidir.
- **Validation**:
  - Type-level usage smoke
  - Gerekirse hedefli regression test

### Task 1.3: `castle` temasini shared root'e tasima
- **Location**: yeni `shared/themes/castle/*`, mevcut `src/assets/themes/castle/*`, `src/js/scene/theme/castle-scene-theme-pack.ts`
- **Description**: Castle assetlerini ve map kayitlarini yeni root'e tasi. Ilk etapta eski path'leri facade veya compatibility export ile koru.
- **Complexity**: 8
- **Dependencies**: Task 1.2
- **Acceptance Criteria**:
  - `castle` theme asset + map + metadata tek root'tadir.
  - Mevcut runtime davranisi bozulmadan yeni source kullanilabilir.
- **Validation**:
  - Scene background ve panel art smoke check
  - Castle loading frames smoke check

### Task 1.4: Scene map write-back stratejisini netlestir
- **Location**: yeni `src/js/scene-editor/io/*`, `electron` IPC bridge gerekiyorsa ilgili handler'lar
- **Description**: Editor'un source yazma davranisi icin teknik karar uygula: dev-only write, export-only, veya explicit save action.
- **Complexity**: 6
- **Dependencies**: Task 1.2
- **Acceptance Criteria**:
  - Canonical source yazimi kontrollu sekilde yapilir.
  - Packaged app ile dev workspace davranisi karistirilmaz.
- **Validation**:
  - Save/export happy-path smoke
  - Write failure fallback smoke

## Sprint 2: Classic Theme and Design System Cleanup
**Goal**: Design system'i classic-only hale getirmek ve classic theme runtime'ini scene kodundan tamamen ayirmak.
**Demo/Validation**:
- `src/styles/design-system/*` icinde scene shell/editor CSS kalmaz.
- `ThemeManager` classic theme state ve host sync ile sinirli kalir.
- Scene mode classic design-system'den yalnizca genel token'lari tuketir.

### Task 2.1: Scene shell CSS'i design-system'den cikar
- **Location**: `src/styles/design-system/index.css`, yeni `src/styles/scene-system/index.css`, yeni `src/styles/scene-system/shell.css`
- **Description**: `scene-shell.css` importunu design system'den cikar ve yeni `scene-system` root'una tasi.
- **Complexity**: 5
- **Dependencies**: Sprint 1
- **Acceptance Criteria**:
  - Design system classic-only olur.
  - Scene pages yeni CSS root'tan ayni shell davranisini alir.
- **Validation**:
  - `scripts/tests/scene-shell-contract-regressions.test.ts` guncellenir
  - Visual smoke in scene mode

### Task 2.2: Editor CSS'ini entrance scene CSS'inden ayir
- **Location**: `src/styles/entrance/scene.css`, yeni `src/styles/scene-editor/*`
- **Description**: `entrance-scene__editor-*` bloklarini editor root'una tasi. Gerekirse class adlari `scene-editor__*` olarak normalize edilir.
- **Complexity**: 7
- **Dependencies**: Task 2.1
- **Acceptance Criteria**:
  - Scene editor stili entrance sayfasina fiziksel olarak bagli kalmaz.
  - Tumu `src/styles/scene-editor/*` altinda toplanir.
- **Validation**:
  - Editor panel smoke in at least two pages

### Task 2.3: Classic theme runtime facade'ini incelt
- **Location**: `src/js/ui/theme/classic-theme-manager.ts`, `src/js/ui/theme/theme-host-sync.ts`, `src/js/ui/theme/*`
- **Description**: Classic theme runtime sadece appearance state, DOM apply, persistence ve host sync ile sinirli kalsin. Scene-specific UI mode veya scene runtime baglari eklenmesin.
- **Complexity**: 6
- **Dependencies**: Sprint 1
- **Acceptance Criteria**:
  - Classic theme system scene imports yapmaz.
  - Design-system theme secimi korunur.
- **Validation**:
  - `scripts/tests/theme-classic-modularization-regressions.test.ts`

## Sprint 3: Scene System as Theme Player
**Goal**: Scene sistemini theme source'unu oynatan bir runtime/player haline getirmek.
**Demo/Validation**:
- Scene runtime artik `castle` veya default layout sabitlerine dogrudan bagli degildir.
- Tum room background, panel, back ve character anchor kayitlari theme source'tan gelir.
- Page controller'lar asset/map dosyasi degil, scene player API'si tuketir.

### Task 3.1: Scene player registry kur
- **Location**: yeni `src/js/scene-system/registry/*`, mevcut `src/js/scene/theme/*`
- **Description**: Aktif theme source'u yukleyen ve room/view/map lookup yapan typed registry kur.
- **Complexity**: 7
- **Dependencies**: Sprint 1
- **Acceptance Criteria**:
  - `getActiveSceneTheme`, `getSceneRoomAssets`, `getSceneRoomMap` benzeri tek API vardir.
  - Runtime `castle` import etmez.
- **Validation**:
  - Room asset lookup smoke
  - Typecheck

### Task 3.2: Layout defaults'i theme source'a tasi
- **Location**: `src/js/scene/layout/scene-layout-state.ts`, yeni `shared/themes/castle/maps/*`
- **Description**: `DEFAULT_*_SCENE_LAYOUT` kayitlarini theme map source'una tasi. `scene-layout-state.ts` helper/schema katmanina iner veya facade olur.
- **Complexity**: 9
- **Dependencies**: Task 3.1
- **Acceptance Criteria**:
  - Room defaults artik theme klasorunde tutulur.
  - `scene debug` ve `scene system` ayni room map kaynagini okur.
- **Validation**:
  - `scripts/tests/scene-debug-room-regressions.test.ts`
  - Runtime smoke for entrance/analyze/assistant

### Task 3.3: Character roster fallback'i room-default bagimliligindan kurtar
- **Location**: `src/js/scene/characters/scene-character-roster.ts`
- **Description**: `DEFAULT_ENTRANCE_SCENE_LAYOUT` fallback'ini kaldir. Roster builder gerekli anchor ve preset'i scene player/source'tan alsin.
- **Complexity**: 6
- **Dependencies**: Task 3.2
- **Acceptance Criteria**:
  - Core roster builder belirli bir room default'una bagli degildir.
  - Character visuals theme manifest'ten, anchors room map'ten gelir.
- **Validation**:
  - Character render smoke in entrance + assistant

### Task 3.4: Page controller tekrarlarini scene session katmanina cek
- **Location**: yeni `src/js/scene-system/player/*`, mevcut page controllers
- **Description**: Background sync, map load, room option list, selection state hook-up ve editor-host wiring tekrarlarini ortak scene session/controller katmanina cek.
- **Complexity**: 8
- **Dependencies**: Task 3.2
- **Acceptance Criteria**:
  - Alti ayri controller icindeki editor/store boilerplate buyuk oranda azalir.
  - Page controller'lar host lifecycle ve room-specific action handler rolune iner.
- **Validation**:
  - Diff-based code duplication check
  - Scene mode smoke per page

## Sprint 4: Scene Editor as Map UI Editor
**Goal**: `scene:debug` sistemini tam anlamiyla theme map editoru haline getirmek.
**Demo/Validation**:
- Editor kendi domain'inde yasar.
- Map source ve draft source ayni kontrat uzerinden yonetilir.
- Editor tek bir room map kaynagini okur, degistirir, uygular veya kaydeder.

### Task 4.1: Scene editor state/store katmanini ayir
- **Location**: yeni `src/js/scene-editor/store/*`, mevcut `src/js/scene/debug/scene-debug-store.ts`
- **Description**: Draft persistence, current room selection, current node selection ve serialize/apply davranisini editor domain'ine tasi.
- **Complexity**: 7
- **Dependencies**: Sprint 3
- **Acceptance Criteria**:
  - `scene-debug-store` veya yeni store canonical map formatini kullanir.
  - Draft ile source write-back ayridir.
- **Validation**:
  - `scripts/tests/scene-debug-store-regressions.test.ts`

### Task 4.2: Editor UI component'ini domain-root altina tasi
- **Location**: yeni `src/js/scene-editor/ui/*`, mevcut `src/js/scene/debug/scene-debug-editor.ts`
- **Description**: Editor component'i `scene-editor` root'una tasi. UI class adlari ve i18n metinleri bu domain'de toplanir.
- **Complexity**: 6
- **Dependencies**: Task 4.1
- **Acceptance Criteria**:
  - Editor domain'i `scene/debug` veya `pages/entrance` isimleri ile sinirli kalmaz.
  - Room listesi, node selection ve panel actions editor domain icindedir.
- **Validation**:
  - Editor smoke in entrance + settings

### Task 4.3: Source apply/save/export akisini kur
- **Location**: yeni `src/js/scene-editor/io/*`, gerekirse `electron` IPC handler'lari
- **Description**: Copy JSON, reset, apply draft, save to theme source ve export davranislarini editor domain'ine tasi.
- **Complexity**: 8
- **Dependencies**: Task 4.1
- **Acceptance Criteria**:
  - Editor local draft ile source save'i karistirmaz.
  - Hata durumunda canonical source korunur.
- **Validation**:
  - Save/export error-path smoke
  - Explicit write action smoke

### Task 4.4: `scene-debug` mode'u yalnizca editor modu olarak sadeleştir
- **Location**: `src/js/app/ui-mode/*`, `src/js/app/navigation.ts`, `src/js/scene/window-controls.ts`
- **Description**: `scene-debug` secimi artik "scene + debug extras" degil, "scene editor mode" olarak netlestirilsin. Mode tarafinda editor visibility ve room focus tek yerden yonetilsin.
- **Complexity**: 6
- **Dependencies**: Task 4.2
- **Acceptance Criteria**:
  - `scene-debug` ic mantigi runtime'a dagilmaz.
  - Debug room aktifligi ve editor aktivasyonu tek orchestration API uzerinden okunur.
- **Validation**:
  - `scripts/tests/ui-mode-orchestration-regressions.test.ts`

## Sprint 5: Migration, Tests, and Documentation
**Goal**: Yeni sistemi regression guvenligi ile tamamlamak.
**Demo/Validation**:
- Eski path/assertion bagimliliklari temizlenir.
- Dokumantasyon yeni source-of-truth'u anlatir.
- Build, test ve smoke akisleri calisir.

### Task 5.1: Regression testleri yeni path ve source modeline guncelle
- **Location**: `scripts/tests/*scene*`, `scripts/tests/theme-classic-modularization-regressions.test.ts`
- **Description**: Eski `scene-shell.css` design-system importu, eski `castle-scene-theme-pack`, eski debug store beklentileri ve eski manifest yoklugu assertion'larini yeni yapıya uyumlu hale getir.
- **Complexity**: 7
- **Dependencies**: Sprint 4
- **Acceptance Criteria**:
  - Testler eski non-existence varsayimlarina degil yeni canonical source'a bakar.
  - Classic / scene system / scene editor ayrimi testlerde gorunur.
- **Validation**:
  - Hedefli test run

### Task 5.2: Docs ve architecture notlarini guncelle
- **Location**: `.rovo/03-ARCHITECTURE.md`, gerekirse `.rovo/_metadata/*` uretim kaynaklari
- **Description**: Stale mimari notlarini yeni kaynak yapisina gore yenile. Theme source, scene player ve scene editor rollerini net anlat.
- **Complexity**: 4
- **Dependencies**: Task 5.1
- **Acceptance Criteria**:
  - Dokuman artik var olmayan manifest/path anlatmaz.
  - 3 sistem ve ince ui-mode orchestration net tarif edilir.
- **Validation**:
  - Manual doc review

### Task 5.3: Final smoke ve rollback proseduru
- **Location**: repo scripts + manual checklist
- **Description**: Classic mode, scene mode ve scene:debug icin smoke checklist hazirla. Rollback icin source path ve alias degisikliklerini geri alma sirasi belirle.
- **Complexity**: 5
- **Dependencies**: Task 5.2
- **Acceptance Criteria**:
  - Uc mod icin min smoke checklist vardir.
  - Rollback adimlari aciktir.
- **Validation**:
  - Manual walkthrough

## Testing Strategy

- Structural validation:
  - `npm run typecheck`
  - `npm run build`
- Focused regressions:
  - `scripts/tests/theme-classic-modularization-regressions.test.ts`
  - `scripts/tests/scene-theme-pack-regressions.test.ts`
  - `scripts/tests/scene-debug-store-regressions.test.ts`
  - `scripts/tests/scene-debug-room-regressions.test.ts`
  - `scripts/tests/scene-shell-contract-regressions.test.ts`
  - `scripts/tests/ui-mode-orchestration-regressions.test.ts`
- Smoke checklist:
  - Classic mode opens and design-system themes still apply
  - Scene mode loads castle assets from `shared/themes`
  - Scene mode room navigation still works
  - Scene mode back areas still work
  - Scene editor opens only in `scene-debug`
  - Editor can switch rooms
  - Editor can reset/copy/export
  - Editor can apply or save source without corrupting map files

## Potential Risks and Gotchas

- **Important**: `shared/themes/**/*` tasininca mevcut `tsconfig` include kaliplari yetersiz kalacak.
- **Important**: Vite root `src` oldugu icin `shared` asset importlari alias veya relative import disiplini gerektirir.
- **Important**: Editor'un canonical source'a yazmasi packaged build icinde dogrudan mumkun olmayabilir. Dev-only write path veya export flow zorunlu olabilir.
- `scene-layout-state.ts` -> theme map migration sirasinda mevcut regression testleri toplu sekilde kirilacak.
- `scene-shell.css` design-system'den cikinca `rooms` ve `settings` gibi sayfalarda beklenmedik layout regression olabilir.
- `scene:debug` yazim modelinde localStorage draft anahtarlari degisebilir; eski draftlar gecersiz hale gelebilir.
- `.rovo/03-ARCHITECTURE.md` ve eski plan dosyalari stale oldugu icin uygulama sirasinda source-of-truth olarak kullanilmamali; once guncellenmelidir.
- `scripts/design-system-audit.mjs` classic-only boundary degisince yeni CSS root'lari tarayacak ama scene CSS'teki raw token kullanimi audit etkisi dogurabilir; audit beklentileri gozden gecirilmeli.

## Rollback Plan

1. `shared/themes` migration facade katmani ile yapilacaksa ilk rollback noktasi facade'lari geri aktif etmektir.
2. CSS split problemi cikarsa `scene-system/index.css` ve `scene-editor/index.css` import zinciri geri alinip scene shell/editor CSS gecici olarak eski path'lere baglanir.
3. Editor write-back sorunu cikarsa source save kapatilip `copy/export only` fallback'ine donulur.
4. Theme source migration sorun cikarsa `castle` icin eski `src/js/scene/theme/castle-scene-theme-pack.ts` facade gecici ana kaynak olarak geri aktif edilir.
5. Docs/testler mimari migration tamamlanmadan source-of-truth kabul edilmez; rollbackte once runtime sonra test/doc katmani geri alinmalidir.

## Suggested Implementation Order

En dusuk riskli siralama:

1. Build plumbing + alias
2. Shared theme source contract
3. Castle theme migration
4. CSS split
5. Scene player API
6. Layout/default migration
7. Editor domain extraction
8. Source write-back flow
9. Tests
10. Docs

## Summary

Bu is yalnizca klasor tasima isi degil. Asil refactor ekseni sudur:

- theme verisini tek yerde toplamak
- runtime'i yalnizca player haline indirmek
- editor'u runtime'tan ayri bir map authoring sistemi yapmak
- classic design-system'i scene kodundan temizlemek

Eger bu 4 eksen birlikte korunursa is sade, okunabilir ve uzun omurlu hale gelir. En kritik teknik karar ise map source-of-truth formatidir; editor write-back beklentisi nedeniyle bunun veri-dostu bir formatta cozulmesi gerekir.
