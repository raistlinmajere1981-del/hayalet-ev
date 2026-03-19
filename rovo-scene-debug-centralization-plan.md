# Plan: Rovo Scene Debug Centralization

**Generated**: March 19, 2026
**Estimated Complexity**: High

## Overview

Bu plan, mevcut `scene:debug` yapisini sayfa bazli daginik bir edit/render setinden cikarip merkezi bir `scene runtime` ve `theme-pack` yapisina tasir. Hedef mimari su ilkelere dayanir:

- Tum scene tanimlari tek bir merkezi schema ile temsil edilir.
- Scene node turleri first-class olur: `object`, `door`, `label`, `character`.
- Oda gorunumu disindaki tum object/view ekranlarindan geri donus, ortak sol/sag `back zone` overlay'i ile yonetilir.
- Scene asset ve layout ayarlari `theme folder` icindeki tek bir manifestten okunur.
- Debug editor tum odalarda ayni node modelini kullanir.

Bu plan implementasyon degil, asamali migration planidir. Ama her sprint sonunda calisan, demo edilebilir ve test edilebilir bir artim hedeflenir.

## Assumptions

- `ThemeManager` altindaki uygulama temi (`obsidian`, `ivory-lab`, `ember-console`) ile scene art/theme pack kavramlari ayni sey degildir; bu refactor bunlari birlestirmez.
- Theme klasorune yazim, source-controlled authoring akisi olarak ele alinacaktir. Packaged Electron build icinde repo altindaki source dosyalarina runtime yazim hedeflenmez.
- `scene:debug` gelistirme/yazarak duzenleme modu olarak kalir; son kullaniciya acik bir production editor'e donusturulmez.
- Mevcut room/page yapisi korunur: `entrance`, `analyze`, `assistant`, `server`, `settings`.

## Current-State Findings

- `sceneDebug` startup flag olarak merkezi parse ediliyor, fakat renderer tarafinda yorumlanmasi sayfa bazli daginik.
- Ortak veri modeli yalnizca `hotspot` ve `characterAnchor` uzerinden gidiyor; `object`, `door`, `label` ayrimi yok.
- `assistant`, `server`, `settings`, `analyze` scene ekranlari farkli render stratejileri kullaniyor:
  - bazilari sabit HTML hotspot ID'lerine bagli,
  - bazilari hotspot'lari dinamik uretiyor,
  - geri alanlari her sayfada ayri markup/CSS/JS ile tanimliyor.
- Scene asset okuma noktasi tam merkezi degil:
  - `src/js/scene/scene-config.ts` bir kismi tasiyor,
  - `src/js/pages/assistant/assistant.ts` hala scene assetlerini dogrudan import ediyor.
- Regresyon testi tabani da guncel runtime ile uyumsuz; mevcut `scene-debug-room-regressions` testi 3 room beklerken runtime 5 room tasiyor.

## Prerequisites

- `scene manifest` icin source-of-truth konumu sabitlenmeli.
  - Onerilen: `src/assets/themes/castle/scene/manifest.ts`
- Ortak scene runtime dosya sinirlari netlestirilmeli.
  - Onerilen cekirdek: `src/js/scene/`
- Migration boyunca legacy render path'leri gecici sure birlikte calisabilir.
- Baseline test senaryolari guncellenmeden buyuk refactor'a girilmemeli.

## Target Architecture

Hedef yapi asagidaki ana parcalardan olusur:

- `SceneThemePack`
  - Bir theme klasoru altindaki tum oda, view, node, asset ve debug varsayimlarini tasir.
- `SceneRoomDefinition`
  - Bir odanin default room view'ini, object view'lerini, node listelerini ve arka planini tanimlar.
- `SceneNodeDefinition`
  - `kind: "object" | "door" | "label" | "character"`
  - Ortak geometry, state ve action sozlesmesini tasir.
- `SceneRuntime`
  - Aktif oda, aktif view, projection, navigation ve action dispatch islerini merkezi yonetir.
- `SceneBackZoneController`
  - Sol/sag geri overlay'ini tek tip uretir ve hover/focus davranisini standartlastirir.
- `SceneDebugStore`
  - Draft yukleme/kaydetme/sifirlama ve export mantigini room bagimsiz hale getirir.
- `SceneDebugEditor`
  - Hotspot/character yerine node-type aware editor olur.

## Sprint 1: Stabilize The Contract

**Goal**: Mevcut daginik state'i belgeleyip merkezi schema ve baseline testlerini hazirlamak.
**Demo/Validation**:

- Yeni scene schema type'lari compile olur.
- Guncel room registry ve mevcut scene tanimlari testlerle dogrulanir.
- Theme pack manifesti tek noktadan import edilebilir hale gelir.

### Task 1.1: Create A Shared Scene Schema

- **Location**: `src/js/scene/schema.ts`, `src/js/scene/scene-debug-rooms.ts`, `src/js/pages/entrance/scene/scene-map.ts`
- **Description**: `hotspot` merkezli API'yi asamali olarak `SceneNodeDefinition` tabanli schema'ya cevir. `door`, `object`, `label`, `character` turlerini acik type union olarak tanimla. `room/view/node/action` iliskisini type seviyesinde sabitle.
- **Complexity**: 7
- **Dependencies**: None
- **Acceptance Criteria**:
  - Tum mevcut odalar yeni schema ile ifade edilebilir.
  - `screen`, `settings panel`, `whisper`, `room navigation`, `close` davranislari schema icinde temsil edilir.
  - `label` tipi, tiklanabilir veya dekoratif metin overlay'i olarak ayri tanimlanabilir.
- **Validation**:
  - `npm run typecheck`
  - Yeni unit/regression testleri

### Task 1.2: Normalize The Room Registry

- **Location**: `src/js/scene/scene-debug-rooms.ts`, `src/js/app/navigation.ts`, `scripts/tests/scene-debug-room-regressions.test.ts`
- **Description**: Room registry'nin tek dogru kaynagini belirle. Testleri runtime'daki 5 room yapisina hizala ve registry/active-room mantigini yeni scene schema ile uyumlu hale getir.
- **Complexity**: 4
- **Dependencies**: Task 1.1
- **Acceptance Criteria**:
  - `entrance`, `analyze`, `assistant`, `server`, `settings` ayni registry uzerinden okunur.
  - Debug room secimi navigation ile ayni sozlesmeyi kullanir.
  - Eski ve yeni room listeleri arasindaki drift testle yakalanir.
- **Validation**:
  - `npx tsx --test scripts/tests/scene-debug-room-regressions.test.ts`

### Task 1.3: Move Scene Assets Into A Theme-Pack Manifest

- **Location**: `src/assets/themes/castle/scene/manifest.ts`, `src/js/scene/scene-config.ts`, `src/js/pages/assistant/assistant.ts`
- **Description**: Scene art import'larini theme klasoru altindaki tek manifestte topla. `scene-config.ts` ya ince bir adapter olarak kalsin ya da yeni manifest loader'a delegasyon yapsin. `assistant.ts` icindeki dogrudan scene asset import'larini kaldir.
- **Complexity**: 6
- **Dependencies**: Task 1.1
- **Acceptance Criteria**:
  - `entrance`, `analyze`, `assistant`, `server`, `settings`, `loading`, `characters` assetleri tek manifestten okunur.
  - Scene tarafinda `assets/themes/castle` disindan dogrudan scene asset import'i kalmaz.
  - Theme pack kimligi acik sekilde tasinir.
- **Validation**:
  - `npm run typecheck`
  - Manifest regression testleri

### Task 1.4: Define Migration Guard Tests

- **Location**: `scripts/tests/scene-debug-room-regressions.test.ts`, yeni `scripts/tests/scene-theme-pack-regressions.test.ts`, yeni `scripts/tests/scene-schema-regressions.test.ts`
- **Description**: Refactor sirasinda parity bozulmalarini erken yakalamak icin baslangic koruma testlerini ekle.
- **Complexity**: 5
- **Dependencies**: Task 1.2, Task 1.3
- **Acceptance Criteria**:
  - Room listesi, node turleri ve temel action tipleri testle sabitlenir.
  - Theme manifest icindeki zorunlu asset alanlari test edilir.
- **Validation**:
  - `npx tsx --test scripts/tests/scene-debug-room-regressions.test.ts scripts/tests/scene-theme-pack-regressions.test.ts scripts/tests/scene-schema-regressions.test.ts`

## Sprint 2: Build The Central Scene Runtime

**Goal**: Tek bir runtime ile oda, view, node, navigation ve geri davranisini yonetmek.
**Demo/Validation**:

- En az bir oda ortak runtime ile render edilir.
- `object view -> room view` geri donusu sol/sag back zone ile calisir.
- Per-page exit button kodu yeni ortak katmana baglanir.

### Task 2.1: Create Scene Runtime Core

- **Location**: `src/js/scene/runtime.ts`, `src/js/scene/navigation.ts`, `src/js/scene/projection.ts`
- **Description**: Aktif room/view state'ini, projection hesaplamasini, node action dispatch'ini ve page integration API'sini merkezi hale getir.
- **Complexity**: 8
- **Dependencies**: Sprint 1
- **Acceptance Criteria**:
  - Runtime bir room manifestini alip render-state uretebilir.
  - `navigate`, `open-view`, `close-view`, `settings-panel`, `close-scene` gibi action tipleri tek dispatch yolundan gecer.
  - `analyze archive` gibi nested/sibling object view'ler desteklenir.
- **Validation**:
  - `npm run typecheck`
  - Runtime unit testleri

### Task 2.2: Build Shared Back-Zone Overlay

- **Location**: `src/js/scene/back-zone.ts`, `src/pages/assistant.html`, `src/pages/server.html`, `src/pages/analyze.html`, `src/index.html`, `src/styles/design-system/components/scene-shell.css`
- **Description**: Butun object ekranlarinda ayni davranisi veren ortak sol/sag `back zone` overlay'i olustur. Hover/focus ile gorunen, click ile room view'e donen standart bir UI katmani kur.
- **Complexity**: 7
- **Dependencies**: Task 2.1
- **Acceptance Criteria**:
  - `assistant screen`, `server terminal view`, `analyze table`, `analyze archive`, `settings panel view` ayni geri kontrol mantigini kullanir.
  - Sayfa bazli `exit-left / exit-right` event binding kopyalari kaldirilir veya ortak controller'a delege edilir.
  - Keyboard focus ile de geri donus saglanir.
- **Validation**:
  - Manual smoke run in scene mode
  - DOM/state regression tests

### Task 2.3: Standardize Scene Rendering Primitives

- **Location**: `src/js/scene/renderer.ts`, `src/js/scene/node-renderers.ts`, `src/styles/design-system/components/scene-shell.css`
- **Description**: `door`, `object`, `label`, `character` icin ortak render primitive'leri olustur. Frame, hover glow, label layout, depth scaling ve aria davranisini standardize et.
- **Complexity**: 8
- **Dependencies**: Task 2.1
- **Acceptance Criteria**:
  - Ortak CSS variable ve renderer API'si tanimlanir.
  - Sayfalar minimum adapter bilgisi vererek node render ettirebilir.
  - `label` artik `door/object` uzerine gomulu zorunlu bir alan degil, bagimsiz node olarak da calisabilir.
- **Validation**:
  - `npm run typecheck`
  - Visual smoke verification in scene debug

## Sprint 3: Migrate Pages And The Debug Editor

**Goal**: Tum odalari ortak runtime'a gecirmek ve debug editor'u yeni 4 tur modeliyle hizalamak.
**Demo/Validation**:

- `entrance`, `assistant`, `analyze`, `server`, `settings` ayni runtime kontratini kullanir.
- Debug editor tum node turlerini listeleyip duzenleyebilir.
- Local draft persistence room-agnostic calisir.

### Task 3.1: Migrate Entrance Scene To Runtime Adapters

- **Location**: `src/js/pages/entrance/scene/scene-controller.ts`, `src/js/pages/entrance/scene/scene-character-roster.ts`
- **Description**: Entrance odasini yeni runtime'a gecir. `whisper`, `door navigation` ve `character menu` davranislarini scene action modeline bagla.
- **Complexity**: 7
- **Dependencies**: Sprint 2
- **Acceptance Criteria**:
  - Entrance artik legacy `hotspot` odakli akisa bagimli kalmaz.
  - `whisper` object olarak temsil edilir.
  - Character anchor/state hesaplari ortak runtime ile uyumlu olur.
- **Validation**:
  - Scene smoke test
  - Existing entrance scene tests

### Task 3.2: Migrate Assistant, Analyze, Server, Settings

- **Location**: `src/js/pages/assistant/assistant.ts`, `src/js/pages/analyze.ts`, `src/js/pages/server.ts`, `src/js/app/topbar-settings-overlay.ts`
- **Description**: Tum sayfalari ortak scene adapter modeline gecir. Sabit HTML hotspot baglarini ve page-specific exit controller'lari azalt.
- **Complexity**: 9
- **Dependencies**: Task 3.1
- **Acceptance Criteria**:
  - Tum room'lar ayni node/action/back-zone runtime'ini kullanir.
  - `settings` overlay, scene room + object view mantigina uyumlu calisir.
  - `analyze archive` ve `assistant/server screen` gorunumleri object view olarak tanimlanir.
- **Validation**:
  - `npm run typecheck`
  - Room-level smoke scenarios

### Task 3.3: Refactor The Debug Editor To Be Node-Type Aware

- **Location**: `src/js/pages/entrance/scene/scene-editor.ts`, yeni `src/js/scene/debug-store.ts`, `src/js/pages/entrance/scene/scene-debug.ts`
- **Description**: Editor selection modelini `hotspot|character` ikilisinden cikarip `nodeType + nodeId` tabanina gecir. `object`, `door`, `label`, `character` icin uygun kontrol panellerini ekle.
- **Complexity**: 8
- **Dependencies**: Task 3.1, Task 3.2
- **Acceptance Criteria**:
  - Editor room switcher ayni kalir ama tum node turlerini ayri section'larda listeler.
  - `label` node'lari konum, yazi, font preset ve bagli action state ile duzenlenebilir.
  - `object` ve `door` ayrimi editor icinde gorunur olur.
- **Validation**:
  - `npx tsx --test` based editor regression tests
  - Manual verify in `scene:debug`

### Task 3.4: Unify Draft Persistence And Export Flow

- **Location**: `src/js/scene/debug-store.ts`, `src/js/pages/entrance/scene/scene-map.ts`, yeni `scripts/scene/export-theme-pack.mjs`
- **Description**: Draft save/load/clear mantigini room generic hale getir. Source-of-truth theme pack'e donus icin dev-only export akisi tasarla.
- **Complexity**: 7
- **Dependencies**: Task 3.3
- **Acceptance Criteria**:
  - Room bazli farkli `load/save/clear` fonksiyonlari ortak API uzerinden calisir.
  - Debug draft ile source manifest birbirine karismaz.
  - Developer gerekirse draft'i theme manifest formatinda export edebilir.
- **Validation**:
  - Persistence unit tests
  - Manual export/import dry-run

## Sprint 4: Consolidate Theme-Pack Authoring And Cleanup Legacy Paths

**Goal**: Theme folder kaynakli tek noktali scene yapisini kalici hale getirmek ve legacy parcalari temizlemek.
**Demo/Validation**:

- Scene asset/layout/source-of-truth tek manifestten gelir.
- Legacy page-specific exit and direct scene asset imports temizlenir.
- Test ve docs refactor'u kapsar.

### Task 4.1: Finalize Theme-Pack Manifest Shape

- **Location**: `src/assets/themes/castle/scene/manifest.ts`, `src/js/scene/theme-pack.ts`
- **Description**: Theme pack manifesti icin final API'yi kilitle. Room artlari, object view artlari, character base artlari, debug defaults ve back-zone policy ayni yerde dursun.
- **Complexity**: 6
- **Dependencies**: Sprint 3
- **Acceptance Criteria**:
  - Scene tarafinda kullanilan layout ve art ayarlari tek manifestte izlenebilir.
  - Manifesti okuyarak bir room'un tum scene davranisi anlasilabilir.
  - Yeni theme pack eklemek icin page controller degisimi gerekmeyen bir yapi olusur.
- **Validation**:
  - Theme-pack regression tests
  - Manual manifest inspection

### Task 4.2: Remove Legacy Scene Paths

- **Location**: `src/js/scene/scene-config.ts`, `src/js/pages/assistant/assistant.ts`, `src/js/pages/analyze.ts`, `src/js/pages/server.ts`, `src/js/app/topbar-settings-overlay.ts`
- **Description**: Gecis boyunca tutulan adapter/compat katmanlarini temizle. Direkt asset import'lari, duplicate exit logic'leri ve room-specific draft helper'lari kaldir.
- **Complexity**: 7
- **Dependencies**: Task 4.1
- **Acceptance Criteria**:
  - Scene asset/source okumasi tek yoldan yapilir.
  - Per-page duplicated exit event ve selector mapping kodu minimuma iner.
  - Deprecated helper'lar kaldirilir veya acik shim olarak isaretlenir.
- **Validation**:
  - `npm run typecheck`
  - `npm run lint`

### Task 4.3: Update Documentation And Regression Coverage

- **Location**: `.rovo/03-ARCHITECTURE.md`, `scripts/tests/*scene*`, gerekirse `.rovo/_metadata/COMMENT-INDEX.md`
- **Description**: Yeni scene mimarisini ve debug authoring akisini belgeleyip test kapsamini tamamla.
- **Complexity**: 5
- **Dependencies**: Task 4.2
- **Acceptance Criteria**:
  - Scene runtime, back-zone policy ve theme-pack authoring akisi belgelenir.
  - Refactor sonrasi kritik akislari kapsayan test listesi tamamlanir.
- **Validation**:
  - Docs sanity review
  - Full targeted test run

## Testing Strategy

- Baseline once:
  - `npx tsx --test scripts/tests/scene-debug-room-regressions.test.ts`
- Her sprintte:
  - `npm run typecheck`
  - Scene-specific targeted regression tests
- Migration parity icin:
  - Room registry tests
  - Theme-pack manifest tests
  - Back-zone behavior tests
  - Debug editor node selection tests
- Final verification:
  - `entrance -> assistant object view -> back`
  - `entrance -> analyze table -> back`
  - `analyze archive -> back`
  - `entrance -> settings panel -> back`
  - `entrance -> server object view -> back`
  - `scene-debug` room switch + draft save/load

## Potential Risks & Gotchas

- `Theme` kavrami iki farkli alanda kullaniliyor:
  - design-system application theme
  - scene art/theme pack
  - Bunlar ayni isimle ama farkli sorumlulukla yasiyor; refactor bunu acik ayirmali.
- Theme folder'a runtime yazim packaged app'te guvenli degil.
  - Mitigation: source manifest + local draft + explicit dev export modeli kullan.
- `Analyze archive` ve `settings panel` akislari basit boolean screen-open mantigindan daha karmasik.
  - Mitigation: `activeViewId` veya `view stack` modeli tanimla.
- `Settings` room normal page degil, overlay/controller mantigi tasiyor.
  - Mitigation: scene runtime icin page adapter sozlesmesi tanimla, page tipi ozel case olarak degil adapter olarak cozulmeli.
- Per-page CSS farkliliklari ortak renderer'a gecerken gorunumsal regressions yaratabilir.
  - Mitigation: ortak primitive + page-specific skin ayrimi uygula.
- Mevcut testler guncel davranisi tam temsil etmiyor.
  - Mitigation: once baseline testlerini duzelt, sonra refactor'a gir.

## Rollback Plan

- Migration boyunca legacy scene path'lerini sprint sonlarina kadar hemen silme.
- Her sprintte yeni runtime sadece hedef room'larda aktiflestirilsin; diger room'lar legacy path'te kalabilsin.
- Theme-pack manifest gecisi tamamlanana kadar `scene-config.ts` ince adapter olarak tutulabilir.
- Regression ciktiginda:
  - room migration commit'i geri alinabilir,
  - theme-pack manifest adapter'i eski kaynaga gecici donus yapabilir,
  - shared back-zone overlay room bazli feature flag ile kapatilabilir.

## Success Criteria

- Tum scene room'lari ayni scene runtime kontratini kullanir.
- Tum object ekranlarindan oda gorunumune donus ayni sol/sag back zone ile yapilir.
- Debug editor `object`, `door`, `label`, `character` turlerini ayri ve merkezi olarak yonetir.
- Scene asset/layout/source-of-truth tek theme-pack manifestte toplanir.
- Legacy duplicated exit logic ve dogrudan scene asset import'lari temizlenir.
