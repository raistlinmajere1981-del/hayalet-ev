# Plan: Scene Runtime Final Gaps

**Generated**: 2026-03-20
**Estimated Complexity**: Low-Medium

## Overview

`scene runtime` follow-up sonrasinda iki kalan seam var:

1. `SceneDebugThemeStore` ve `SceneDebugRuntimeSession` icin gercek behavior-level theme save/load round-trip coverage'i hala tam kapanmadi
2. `SceneLayoutEditor` callback bloklarinda kalan controller-bazli boilerplate davranis sorunu yaratmiyor ama tekrar ve drift riski birakiyor

Bu planin ana amaci once test zincirini tamamen kilitlemek, sonra da sadece guvenli oldugu kadar callback boilerplate'i azaltmaktir. Birinci madde zorunlu kapanis isidir. Ikinci madde, davranis bozmadan sadelesiyorsa uygulanacak dusuk riskli cleanup sprintidir.

## Confirmed Scope

- Yeni migration veya schema degisikligi yok.
- Runtime davranisi degistirilmeyecek; ana odak test harness ve mevcut persistence zincirini gercek davranisla dogrulamak.
- Callback cleanup, tam bir yeni abstraction katmani degil; sadece tekrar eden editor persistence/reset/copy/save akisini azaltan kucuk helper seviyesinde kalacak.
- Cleanup sprinti icin decision gate var: churn yukselirse yalnizca test closure ile bitirilecek.

## Prerequisites

- Mevcut green baseline:
  - `npm run typecheck`
  - `npx tsx --test scripts/tests/scene-debug-room-regressions.test.ts scripts/tests/scene-debug-store-regressions.test.ts scripts/tests/scene-theme-pack-regressions.test.ts scripts/tests/scene-shell-contract-regressions.test.ts scripts/tests/rooms-scene-page-regressions.test.ts`
- Ana alanlar:
  - `src/js/scene-editor/scene-editor-store.ts`
  - `src/js/scene-editor/scene-debug-runtime-session.ts`
  - `scripts/tests/scene-debug-store-regressions.test.ts`
  - `src/js/pages/entrance/scene/scene-controller.ts`
  - `src/js/pages/rooms.ts`
  - `src/js/pages/analyze.ts`
  - `src/js/pages/assistant/assistant.ts`
  - `src/js/pages/server.ts`
  - `src/js/pages/settings/controller.ts`

## Sprint 1: Close Store/Session Behavior Tests
**Goal**: Theme save/load zincirini regex inspection yerine gercek runtime davranis testleriyle kapatmak.
**Demo/Validation**:
- Theme draft save/load/reset davranisi testte gercek objelerle dogrulanir.
- Runtime session uzerinden yapilan theme degisikligi yeni session acilisinda draft olarak geri okunur.
- Theme source save zinciri `FileManager.writeFileAtomic` seviyesine kadar test edilir.

### Task 1.1: Add a reusable test harness for scene debug persistence
- **Location**: `scripts/tests/scene-debug-store-regressions.test.ts`, gerekirse yeni test helper dosyasi
- **Description**: `window.localStorage`, `navigator.clipboard` ve `FileManager.writeFileAtomic` icin izole bir test harness kur. Her test sonunda globals geri yuklensin.
- **Dependencies**: None
- **Acceptance Criteria**:
  - Testler birbirinin global state'ini kirletmez.
  - Harness hem theme store hem runtime session testlerinde tekrar kullanilir.
- **Validation**:
  - Hedefli test kosusu

### Task 1.2: Add behavior-level tests for SceneDebugThemeStore draft round-trip
- **Location**: `scripts/tests/scene-debug-store-regressions.test.ts`, `src/js/scene-editor/scene-editor-store.ts`
- **Description**: `createSceneDebugThemeStore()` uzerinden `cloneDefault -> saveDraft -> loadDraft -> clearDraft` zincirini test et. Assert'ler gercek `SceneClickableThemeDefinition` esitligi uzerinden yapilsin.
- **Dependencies**: Task 1.1
- **Acceptance Criteria**:
  - Theme draft objesi save sonrasi kayipsiz geri okunur.
  - `clearDraft()` sonrasi `loadDraft()` bos doner.
  - Sadece source string inspection'a dayanmayan test bulunur.
- **Validation**:
  - `scripts/tests/scene-debug-store-regressions.test.ts`

### Task 1.3: Add behavior-level tests for SceneDebugRuntimeSession theme lifecycle
- **Location**: `scripts/tests/scene-debug-store-regressions.test.ts`, `src/js/scene-editor/scene-debug-runtime-session.ts`
- **Description**: `createSceneDebugRuntimeSession(roomId)` icin `load(false)`, `updateSceneClickableTheme`, `saveSceneClickableThemeDraft`, yeni session ile `load(true)`, `resetSceneClickableThemeDraft` zincirini test et.
- **Dependencies**: Task 1.2
- **Acceptance Criteria**:
  - Draft state yeni session instance'inda geri yuklenir.
  - Reset sonrasi session yeniden default theme'e doner.
  - Runtime session testleri store API wrapper'i olmaktan otesine gecip gercek behavior dogrular.
- **Validation**:
  - Hedefli test kosusu

### Task 1.4: Add source-save behavior tests for theme persistence
- **Location**: `scripts/tests/scene-debug-store-regressions.test.ts`, `src/js/scene-editor/scene-editor-store.ts`
- **Description**: `saveSource()` icin `FileManager.writeFileAtomic` cagrisi stub'lanir. Yazilan payload'in dogru path, format ve veriyle uretildigi dogrulanir; gerekirse temp file import ile source round-trip tamamlanir.
- **Dependencies**: Task 1.3
- **Acceptance Criteria**:
  - Theme source save zinciri davranis seviyesiyle test edilir.
  - `saveSource()` success/failure contract'i testte acik olur.
- **Validation**:
  - Hedefli test kosusu

## Sprint 2: Guarded Callback Boilerplate Cleanup
**Goal**: Controller'lardaki tekrar eden `SceneLayoutEditor` callback bloklarini, davranis bozmadan sadece persistence/selection katmaninda azaltmak.
**Demo/Validation**:
- En az iki controller daha kucuk editor callback bloklariyla calisir.
- Render order ve page-specific navigation davranisi ayni kalir.
- Cleanup fayda getirmiyorsa sprint decision gate ile durdurulabilir.

### Task 2.1: Inventory repeated editor callback slices
- **Location**: `src/js/pages/entrance/scene/scene-controller.ts`, `src/js/pages/rooms.ts`, `src/js/pages/analyze.ts`, `src/js/pages/assistant/assistant.ts`, `src/js/pages/server.ts`, `src/js/pages/settings/controller.ts`
- **Description**: Ortak callback parcaciklarini ayristir: selection refresh, copy/save/reset actions, theme persistence actions, object/back/character update sonra cagrilan ortak refresh zinciri.
- **Dependencies**: Sprint 1
- **Acceptance Criteria**:
  - Ortaklastirilabilir parcaciklar net liste halinde cikar.
  - Page-specific kalan callback'ler ayri tutulur.
- **Validation**:
  - Controller diff analizi

### Task 2.2: Extract a minimal editor callback helper
- **Location**: yeni `src/js/scene-editor/scene-layout-editor-callbacks.ts` veya esdeger helper
- **Description**: Sadece generic persistence/reset/copy/save ve selection boilerplate'ini toplayan kucuk bir helper ekle. Render/sync side-effect'leri callback olarak disaridan alinmaya devam etsin.
- **Dependencies**: Task 2.1
- **Acceptance Criteria**:
  - Helper yeni bir generic framework'e donusmez.
  - Controller'lardaki tekrar eden blok anlamli bicimde azalir.
  - Page-specific davranislar helper icine gomulmez.
- **Validation**:
  - Typecheck
  - Iki controller uzerinde migration smoke

### Task 2.3: Decision gate after first two controller migrations
- **Location**: `src/js/pages/rooms.ts`, `src/js/pages/entrance/scene/scene-controller.ts`, gerekirse diger controller'lar
- **Description**: En dusuk riskli iki controller'a helper'i uygula. Eger helper imzasi gereksiz karmasiklasiyorsa sprint burada durur; degilse diger controller'lara yayilir.
- **Dependencies**: Task 2.2
- **Acceptance Criteria**:
  - `rooms` ve `entrance` uzerinde net kod azalimi gorulur.
  - Helper zorlamali hissediyorsa kalan controller'lar oldugu gibi birakilir.
- **Validation**:
  - `scripts/tests/rooms-scene-page-regressions.test.ts`
  - `scripts/tests/scene-debug-room-regressions.test.ts`

## Sprint 3: Final Verification
**Goal**: Behavior-level test closure ve opsiyonel cleanup'in birlikte stabil oldugunu dogrulamak.
**Demo/Validation**:
- Typecheck temizdir.
- Scene-focused regression set tam yesildir.
- Eger Sprint 2 uygulandiysa en az bir kucuk manual `scene:debug` smoke notu alinir.

### Task 3.1: Run validation set
- **Location**: repo root
- **Description**: Typecheck ve scene regression setini tekrar kos.
- **Dependencies**: Sprint 2
- **Acceptance Criteria**:
  - `npm run typecheck` gecer.
  - Hedefli scene test seti gecer.
- **Validation**:
  - CLI output

### Task 3.2: Optional manual smoke for callback cleanup
- **Location**: `scene` / `scene:debug`
- **Description**: Sadece callback cleanup uygulandiysa `selection`, `reset`, `save layout`, `save theme` akislarini elle kontrol et.
- **Dependencies**: Task 3.1
- **Acceptance Criteria**:
  - Editor callback cleanup UI davranisini bozmaz.
- **Validation**:
  - Manual smoke notes

## Testing Strategy

- Sprint 1 zorunlu coverage:
  - Theme draft round-trip
  - Runtime session reload/reset behavior
  - Theme source save call contract
- Sprint 2 uygulanirsa:
  - Controller regression testleri
  - En az `rooms` ve `entrance` icin manual smoke
- Final:
  - `npm run typecheck`
  - Scene-focused targeted suite

## Potential Risks & Gotchas

- `window`, `navigator` ve `FileManager` mock'lari dogru restore edilmezse testler kirilgan veya order-dependent hale gelebilir.
- `FileManager.writeFileAtomic` stubbing, ESM import semantigi nedeniyle dikkatli ele alinmali; spy noktasi stable olmali.
- Callback cleanup kolayca fazla soyutlamaya kayabilir; decision gate bu yuzden zorunlu.
- `rooms` basit, `settings` ve `assistant` daha karmasik; cleanup sirasi risk bazli ilerlemeli.

## Rollback Plan

- Behavior-level test harness kirilgan cikarsa regex coverage'i silmeden once testleri izole helper'a geri cek.
- Callback helper fayda saglamazsa Sprint 2'yi iptal et; sadece Sprint 1 test kapanisi ile plani tamamla.
- Her cleanup adimi tek commit/sprint mantiginda tutulursa geri alma lokal kalir.
