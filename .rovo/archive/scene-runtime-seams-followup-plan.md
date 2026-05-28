# Plan: Scene Runtime Seams Follow-up

**Generated**: 2026-03-20
**Estimated Complexity**: Medium

## Overview

Ana `object/back/character` sadelestirmesi ve clickable theme source-of-truth refactor'i tamamlandi. Kalan hedef, sistemin artik davranissal olarak da tek bir ortak runtime diliyle calismasi ve bu durumun testlerle kilitlenmesidir.

Bu follow-up plan su 3 kalan alani birlikte kapatir:

1. Sayfa controller'larindaki tekrar eden scene debug store/theme store/editor wiring'ini ortak bir runtime/session abstraction'a cekmek
2. `scene-layout-state` helper katmanindaki eski naming seam'lerini temizleyip mevcut ownership modelini daha net anlatmak
3. Theme default precedence ve save/load round-trip davranisini behavior-level regression testleriyle kilitlemek

Yaklasim, kirici ama kontrollu bir cleanup yapmaktir: mevcut green state korunur, page-specific davranislar ortak helper'a zorla tasinmaz, sadece gercekten tekrar eden lifecycle ve persistence akisi merkezilestirilir.

## Confirmed Scope

- Bu plan yeni migration katmani eklemez.
- Runtime abstraction, page-specific navigation ve domain davranisini degil, scene debug/session wiring'ini ortaklastirir.
- Naming cleanup compatibility alias birakmadan yapilir.
- Testler regex seviyesinden cikarak precedence ve round-trip davranislarini daha dogrudan assert edecek sekilde guclendirilir.

## Prerequisites

- Mevcut baseline:
  - `npm run typecheck`
  - `npx tsx --test scripts/tests/scene-debug-room-regressions.test.ts scripts/tests/scene-debug-store-regressions.test.ts scripts/tests/scene-theme-pack-regressions.test.ts scripts/tests/scene-shell-contract-regressions.test.ts`
- Incelenecek tekrarli controller yuzeyleri:
  - `src/js/pages/entrance/scene/scene-controller.ts`
  - `src/js/pages/analyze.ts`
  - `src/js/pages/assistant/assistant.ts`
  - `src/js/pages/server.ts`
  - `src/js/pages/settings/controller.ts`
  - `src/js/pages/rooms.ts`
- Naming cleanup etkisi olacak helper/test alanlari:
  - `src/js/scene/layout/scene-layout-state.ts`
  - `src/js/scene/layout/index.ts`
  - `src/js/scene/layout/scene-layout-serialization.ts`
  - `scripts/tests/scene-debug-store-regressions.test.ts`
  - `scripts/tests/scene-theme-pack-regressions.test.ts`

## Sprint 1: Shared Scene Runtime Session
**Goal**: Tekrar eden debug store, clickable theme store ve editor callback wiring'ini ortak bir runtime/session factory'sine cekmek.
**Demo/Validation**:
- En az iki farkli page controller ortak runtime helper uzerinden calisir.
- Layout draft, theme draft, reset, save ve copy davranisi degismez.
- `scene:debug` acikken editor davranisi mevcut UX'i korur.

### Task 1.1: Inventory the repeated scene debug/session contract
- **Location**: `src/js/pages/entrance/scene/scene-controller.ts`, `src/js/pages/analyze.ts`, `src/js/pages/assistant/assistant.ts`, `src/js/pages/server.ts`, `src/js/pages/settings/controller.ts`, `src/js/pages/rooms.ts`
- **Description**: Tekrar eden ortak alanlari netlestir. Ozellikle store initialization, theme initialization, draft persistence, editor callback'leri ve rerender trigger sirasini ortak contract olarak cikar.
- **Dependencies**: None
- **Acceptance Criteria**:
  - Page'ler arasinda ortaklastirilacak callback ve state yuzeyi dokumante edilir.
  - Page-specific kalan davranislar acikca ayrilir.
- **Validation**:
  - Controller diff incelemesi
  - Ortak contract checklist'i

### Task 1.2: Introduce a shared scene runtime/session factory
- **Location**: yeni `src/js/scene-system/scene-runtime-session.ts` veya esdeger ortak helper, `src/js/scene-editor/scene-editor-store.ts`, `src/js/scene-editor/scene-layout-editor.ts`
- **Description**: Debug acilisinda layout ve clickable theme source'larini yukleyen, draft persistence yuzeyini expose eden ve editor callback'lerine temel state erisimi saglayan ortak factory ekle.
- **Dependencies**: Task 1.1
- **Acceptance Criteria**:
  - Runtime helper layout/theme clone, loadDraft, saveDraft, clearDraft ve saveSource akislarini tek yerde toplar.
  - Editor callback contract'i page controller'larin tekrar eden boilerplate'ini azaltir.
  - Page-specific render ve navigation callback'leri hala controller'da kalir.
- **Validation**:
  - Typecheck
  - Unit/regression for runtime helper API shape

### Task 1.3: Migrate page controllers to shared runtime helper
- **Location**: `src/js/pages/entrance/scene/scene-controller.ts`, `src/js/pages/analyze.ts`, `src/js/pages/assistant/assistant.ts`, `src/js/pages/server.ts`, `src/js/pages/settings/controller.ts`, `src/js/pages/rooms.ts`
- **Description**: Controller'lari yeni helper'a gecir. Ortak session/runtime state'i factory'den gelsin; controller sadece render, menu, navigation ve page-specific side effect'leri yonetsin.
- **Dependencies**: Task 1.2
- **Acceptance Criteria**:
  - `createSceneDebugStore` / `createSceneDebugThemeStore` / local theme wiring tekrari controller'larda minimuma iner.
  - Draft reset/save/copy davranisi butun sayfalarda ayni contract ile calisir.
  - Rooms ve settings gibi daha farkli sayfalarda davranis regress etmez.
- **Validation**:
  - `scripts/tests/scene-debug-room-regressions.test.ts`
  - `scripts/tests/rooms-scene-page-regressions.test.ts`
  - Manual `scene:debug` smoke

## Sprint 2: Layout Helper Naming Cleanup
**Goal**: Layout helper katmanindaki eski state/debug odakli isimleri mevcut ownership modeline uygun hale getirmek.
**Demo/Validation**:
- Helper file ve export isimleri artik "state" veya eski seam dili yerine layout query/model sorumlulugunu anlatir.
- Import zinciri temiz ve dogrudur.

### Task 2.1: Rename scene layout helper surface to match current responsibility
- **Location**: `src/js/scene/layout/scene-layout-state.ts`, `src/js/scene/layout/index.ts`, `src/js/scene/layout/scene-layout-serialization.ts`
- **Description**: `scene-layout-state` dosya ve export naming'ini daha dogru bir isim altina tasimayi planla ve uygula. Hedef, dosyanin artik registry-backed layout query/helpers oldugunu anlatmasidir.
- **Dependencies**: Sprint 1
- **Acceptance Criteria**:
  - Dosya/export isimleri `state` kalintisini tasimaz.
  - `getSceneRoomLayoutConfig`, selection helpers ve node listing API'leri yeni naming altinda daha okunur olur.
- **Validation**:
  - Typecheck
  - `rg -n "scene-layout-state" src/js scripts/tests`

### Task 2.2: Align type and helper names with canonical layout language
- **Location**: ayni helper dosyasi ve onu import eden editor/runtime/test yuzeyleri
- **Description**: `SceneObjectConfig`, `SceneBackConfig`, `SceneCharacterPlacementConfig` gibi tiplerin naming'ini gerekirse canonical layout diliyle hizala. "config" kelimesi artik source ownership'i karistiriyorsa daha net adlara cek.
- **Dependencies**: Task 2.1
- **Acceptance Criteria**:
  - Tip isimleri editor state mi, layout node mu oldugunu net anlatir.
  - Naming sade ama kapsamli olur; gereksiz rename churn uretilmez.
- **Validation**:
  - Import/export cleanup
  - Typecheck

### Task 2.3: Refresh regression expectations for new helper naming
- **Location**: `scripts/tests/scene-debug-store-regressions.test.ts`, `scripts/tests/scene-theme-pack-regressions.test.ts`
- **Description**: Mevcut file-presence ve import-string assertion'larini yeni canonical naming'e gore guncelle.
- **Dependencies**: Task 2.2
- **Acceptance Criteria**:
  - Testler eski seam ismine degil yeni helper ownership'ine bakar.
  - Rename sonrasi sahte-negative ureten regex expectation kalmaz.
- **Validation**:
  - Hedefli test kosusu

## Sprint 3: Behavior-Level Regression Lock
**Goal**: Theme defaults precedence ve theme save/load round-trip davranisini regex seviyesinin otesinde test etmek.
**Demo/Validation**:
- Node override vs theme default precedence davranisi testte acikca assert edilir.
- Theme draft/save/load round-trip ayni shape ve degerlerle geri doner.

### Task 3.1: Add precedence regressions for object and back clickable defaults
- **Location**: `scripts/tests/scene-theme-pack-regressions.test.ts`, gerekirse yeni focused helper test dosyasi
- **Description**: Object/back icin node-level override, theme-level fallback ve final resolver davranisini behavior-level assert eden testler ekle.
- **Dependencies**: Sprint 2
- **Acceptance Criteria**:
  - Object ve back icin en az birer precedence senaryosu bulunur.
  - Testler sadece string aramak yerine resolver output'unu dogrular.
- **Validation**:
  - Hedefli test kosusu

### Task 3.2: Add draft and source round-trip regressions for clickable theme persistence
- **Location**: `scripts/tests/scene-debug-store-regressions.test.ts`, `src/js/scene-system/scene-clickable-theme.ts`, `src/js/scene-editor/scene-editor-store.ts`
- **Description**: Draft serialize/parse ve source serialize/save akislarini round-trip olarak test et. Theme defaults uzerinde yapilan degisikliklerin kayipsiz okunup yazildigini dogrula.
- **Dependencies**: Task 3.1
- **Acceptance Criteria**:
  - Draft round-trip testi var.
  - Source serialization round-trip testi var.
  - Theme save/load behavior'i file string regex'ine degil davranisa dayali assert edilir.
- **Validation**:
  - Hedefli test kosusu

### Task 3.3: Add page integration regressions for shared runtime wiring
- **Location**: `scripts/tests/scene-debug-room-regressions.test.ts`, `scripts/tests/rooms-scene-page-regressions.test.ts`
- **Description**: Page controller'larin yeni ortak runtime helper'i kullandigini ve eski duplicate wiring'e geri donulmedigini assert eden regression'lar ekle.
- **Dependencies**: Task 3.2
- **Acceptance Criteria**:
  - En az entrance ve rooms icin ortak runtime helper kullanimi test edilir.
  - Kalan controller'lar icin de import/usage expectation'lari eklenir.
- **Validation**:
  - Hedefli test kosusu

## Sprint 4: Final Verification
**Goal**: Ortak runtime, naming cleanup ve davranis testlerinin birlikte stabil oldugunu dogrulamak.
**Demo/Validation**:
- Typecheck temizdir.
- Hedefli regression seti yesildir.
- `scene` ve `scene:debug` temel smoke checklist'i tamamlanir.

### Task 4.1: Run final targeted validation set
- **Location**: repo root
- **Description**: Typecheck ve scene odakli regression setini birlikte kos.
- **Dependencies**: Sprint 3
- **Acceptance Criteria**:
  - `npm run typecheck` gecer.
  - Scene-focused test set tam gecer.
- **Validation**:
  - CLI output

### Task 4.2: Manual smoke on scene and scene:debug
- **Location**: Entrance, analyze, assistant, server, settings, rooms
- **Description**: Ortak runtime helper sonrasi editor secim, draft reset, theme reset, layout save, theme save ve back/object/character render davranisini elle kontrol et.
- **Dependencies**: Task 4.1
- **Acceptance Criteria**:
  - UI davranisi bozulmaz.
  - Ortak abstraction sayfa ozel akislarini ezmez.
- **Validation**:
  - Manual smoke notes
  - Gerekirse Electron screenshot

## Testing Strategy

- Her sprint sonunda:
  - `npm run typecheck`
  - Scene-focused regression set
- Naming cleanup sonrasinda:
  - `rg` ile eski seam adlari aranir
- Runtime abstraction sonrasinda:
  - Entrance + Rooms uzerinden smoke yapilir
- Persistence degisikliklerinde:
  - Draft round-trip
  - Source serialization round-trip
  - Theme fallback precedence

## Potential Risks & Gotchas

- Controller'lar benzer gorunse de render order ve side effect zinciri birebir ayni degil; ortak helper sadece store/session wiring'i sahiplenmeli.
- `rooms.ts` ve `settings/controller.ts` daha ozel akislar tasiyor; runtime abstraction burada cok agresif olursa davranis regress edebilir.
- Naming cleanup test snapshot'larini ve import assertions'larini etkiler; rename ile test update ayni sprintte bitirilmeli.
- Behavior-level testlere gecis, saf string assertion'lardan daha degerli ama daha fazla fixture/harness ihtiyaci dogurabilir.
- Theme round-trip testlerinde source serialization format'i korunmazsa gereksiz diff churn olusabilir; mevcut formatter davranisi korunmali.

## Rollback Plan

- Runtime abstraction regress ederse ilgili controller'i tek tek eski local wiring'e geri alacak sekilde commit bazli rollback yap.
- Naming cleanup regress ederse yeni helper ismini geri cekmek yerine import/export uyumsuzluklarini once lokalize et; toplu rename'i tek committe tut.
- Behavior-level testler fazla kirilgan hale gelirse string-assert coverage'i tamamen silmeden once hibrit bir coverage katmani ile dengele.
