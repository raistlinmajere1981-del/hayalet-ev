# Plan: Scene Debug Unified Scene System

**Generated**: 2026-03-19
**Estimated Complexity**: High

## Overview

Bu refactor, mevcut scene/debug altyapisini kirici bir gecisle tek bir canonical sisteme indirecek.
Hedef model yalnizca 3 editlenebilir node tipi kullanacak:

1. `interactive`
2. `back`
3. `character`

Bugunku durum:

- `src/js/scene/schema.ts` hala `object`, `door`, `label`, `character` ayirimi tasiyor.
- `src/js/pages/entrance/scene/scene-map.ts` hem veri kaynagi hem debug draft formati hem de legacy normalizer katmani gibi davraniyor.
- `src/js/pages/entrance/scene/scene-controller.ts`, `src/js/pages/analyze.ts`, `src/js/pages/assistant/assistant.ts`, `src/js/pages/server.ts`, `src/js/pages/rooms.ts`, `src/js/app/topbar-settings-overlay.ts` hotspot ve character render mantigini kopyaliyor.
- `src/js/scene/back-zone.ts` ve `src/pages/*.html` icindeki sol/sag hover alanlari object-view geri donusunu ayri bir sistem olarak tutuyor.
- Debug editor, label'i ayri node gibi ele aliyor; bu da tek obje tipi hedefine aykiri.
- `src/js/scene/debug-store.ts` oda bazli normalizer ve draft anahtarlari ile legacy uyumluluk yuku tasiyor.

Yaklasim:

- Tum oda, obje ve karakter kayitlarini tek bir shared layout registry'ye tasimak.
- Tum tiklanabilir alanlari tek `interactive` node tipine dusurmek.
- Tum object-view -> room-view geri donuslerini tek `back` node tipi ile yonetmek.
- Karakter yerlestirmeyi tek `character` node tipi ile standartlastirmak.
- Per-page kopya renderer'lari kaldirip ortak runtime/render/editor katmani kurmak.
- Migration yazmamak; eski draft'lari ve eski schema kalintilarini agresif sekilde silmek.

## Assumptions

- "3 cesit obje" ifadesi pratikte 3 scene node tipine karsilik geliyor: `interactive`, `back`, `character`.
- `door`, `object`, `labeled door`, `panel hotspot`, `screen hotspot`, `whisper hotspot` artik farkli tipler olmayacak; bunlar yalnizca `interactive.action` ve gorunum ayarlari ile ayrisacak.
- `label` artik ayri node olmayacak; `interactive` ve `back` icine gomulu bir config olacak.
- Sol/sag iki ayri geri hover alani kaldirilacak; her object-view tek bir geri alani kullanacak.
- Eski local draft JSON'lari korunmayacak. Gerekirse storage key versiyonu degisecek veya store tamamen sifirlanacak.

## Prerequisites

- Scene refactor kapsamindaki ana dosyalar:
  - `src/js/scene/schema.ts`
  - `src/js/scene/debug-store.ts`
  - `src/js/scene/back-zone.ts`
  - `src/js/scene/runtime.ts`
  - `src/js/scene/theme-pack.ts`
  - `src/assets/themes/castle/scene/manifest.ts`
  - `src/js/pages/entrance/scene/scene-map.ts`
  - `src/js/pages/entrance/scene/scene-editor.ts`
  - `src/js/pages/entrance/scene/scene-controller.ts`
  - `src/js/pages/analyze.ts`
  - `src/js/pages/assistant/assistant.ts`
  - `src/js/pages/server.ts`
  - `src/js/pages/rooms.ts`
  - `src/js/app/topbar-settings-overlay.ts`
  - `src/pages/entrance.html`
  - `src/pages/analyze.html`
  - `src/pages/assistant.html`
  - `src/pages/server.html`
- Guncellenecek test yuzeyi:
  - `scripts/tests/scene-schema-regressions.test.ts`
  - `scripts/tests/scene-debug-room-regressions.test.ts`
  - `scripts/tests/scene-debug-store-regressions.test.ts`
  - `scripts/tests/scene-theme-pack-regressions.test.ts`
- Bu plan kirici gecis varsayar; implementation baslamadan once kullanicidan degisiklik onayi alinmali.

## Sprint 1: Canonical Layout Schema
**Goal**: Legacy node turlerini kaldirip tum sayfalarin kullanacagi tek layout sozlesmesini kurmak.
**Demo/Validation**:
- Tek bir merkezi schema dosyasinda yalnizca 3 node tipi gorunmeli.
- Bir room layout tanimi icindeki tum clickable alanlar `interactive` olarak temsil edilmeli.
- Ayrica ayri `label` veya `door` tipi kalmamali.

### Task 1.1: Yeni scene node schema'sini tanimla
- **Location**: `src/js/scene/schema.ts`
- **Description**: `object`, `door`, `label`, `character` modelini kaldir; yerine `interactive`, `back`, `character` tabanli tipleri tanimla. Label, glow ve text ayarlarini `interactive` ve `back` icine tasinir nested config olarak modelle.
- **Complexity**: 8
- **Dependencies**: None
- **Acceptance Criteria**:
  - `SCENE_NODE_KINDS` yalnizca 3 tip dondurur.
  - `interactive` node, detayli yerlesim, custom label, label yerlesimi, text ayarlari, visible flag ve glow ayarlarini kapsar.
  - `back` node, room-view geri donus davranisi icin yeterli metadata tasir.
- **Validation**:
  - `scene-schema-regressions` yeniden yazilir.
  - Tip bagimliliklari compile eder.

### Task 1.2: Room/view/layout kayit modelini ayir
- **Location**: `src/js/scene/schema.ts`, yeni `src/js/scene/layout-registry.ts`
- **Description**: Oda kaydi, oda icindeki room-layer objeleri, view-layer objeleri ve character placements icin tek registry yapisi kur. Room ve object-view yapisi data-first hale gelsin.
- **Complexity**: 7
- **Dependencies**: Task 1.1
- **Acceptance Criteria**:
  - Her oda icin tek registry entry vardir.
  - Object-view tanimlari registry icinden okunur.
  - Page controller sabitleri artik canonical kaynak olmaz.
- **Validation**:
  - Registry helper unit testleri eklenir veya mevcut regression testleri guncellenir.

### Task 1.3: Theme pack ile layout registry sinirini netlestir
- **Location**: `src/assets/themes/castle/scene/manifest.ts`, `src/js/scene/theme-pack.ts`
- **Description**: Theme pack'i sadece art/background/panel asset kaynagi olarak birak; scene back-zone policy gibi legacy UI policy alanlarini kaldir veya yeni `back` node sistemine indir.
- **Complexity**: 6
- **Dependencies**: Task 1.2
- **Acceptance Criteria**:
  - Layout geometrisi theme pack'te degil canonical layout registry'de kalir.
  - Legacy `backZones` policy veya esdegeri yeni modelle uyumlu hale gelir.
- **Validation**:
  - `scene-theme-pack-regressions` yeni mimariye gore guncellenir.

## Sprint 2: Data Migration Without Migration Layer
**Goal**: Mevcut tum oda, obje ve karakter kayitlarini yeni modele tek seferde tasimak.
**Demo/Validation**:
- Entrance, analyze, assistant, server, rooms, settings kayitlari tek registry'den okunur.
- `door/object/label` ayrimi source code'da kalmaz.
- Legacy normalizer yamalari silinir.

### Task 2.1: `scene-map.ts` icerigini yeni registry'ye tasima
- **Location**: `src/js/pages/entrance/scene/scene-map.ts`, yeni `src/js/scene/layout-registry.ts`
- **Description**: `DEFAULT_*_SCENE_MAP` sabitlerini, room bazli canonical registry'ye tasiyip `scene-map.ts`yi ya sil ya da cok ince bir compatibility-free facade'a indir. `nodeKind`, `showLabel`, `label*` ve frame alanlarini yeni nested model altina topla.
- **Complexity**: 9
- **Dependencies**: Sprint 1
- **Acceptance Criteria**:
  - Entrance/analyze/assistant/server/rooms/settings kayitlari tek registry'de durur.
  - `nodeKind: "door"` gibi alanlar tamamen kalkar.
  - Ayrik `label` node ureten mapper'lar kaldirilir.
- **Validation**:
  - `scene-debug-room-regressions` yeni registry uzerinden dogrulanir.

### Task 2.2: View geri alanlarini data modeline tasima
- **Location**: `src/js/scene/layout-registry.ts`, `src/pages/entrance.html`, `src/pages/analyze.html`, `src/pages/assistant.html`, `src/pages/server.html`, `src/index.html`
- **Description**: Assistant/server/analyze/settings/analyze-archive ve entrance whisper icin tek tip `back` kayitlari olustur. Sol/sag duplicate butonlari silip tek hover alanini render edilen data ile uret.
- **Complexity**: 8
- **Dependencies**: Task 2.1
- **Acceptance Criteria**:
  - Her object-view yalnizca bir adet `back` node tanimlar.
  - `data-scene-back-zone="left|right"` kalintilari HTML'den kalkar.
  - Entrance whisper da ayni geri modeli ile calisir.
- **Validation**:
  - Markup snapshot/regression testleri guncellenir.

### Task 2.3: Karakter kayitlarini tek placement modeline cevir
- **Location**: `src/js/pages/entrance/scene/scene-character-roster.ts`, `src/js/pages/entrance/scene/scene-character-role.ts`, `src/js/scene/layout-registry.ts`
- **Description**: `EntranceSceneCharacterAnchorConfig` bagimini kaldir; tek `SceneCharacterPlacementNode` modeline gec. Roster builder'i entrance-ozel defaults yerine canonical placement listesi ile calistir.
- **Complexity**: 8
- **Dependencies**: Task 2.1
- **Acceptance Criteria**:
  - Character placement tipi room'dan bagimsiz ve generic olur.
  - `DEFAULT_ENTRANCE_SCENE_MAP.characterAnchors` gibi implicit fallback'lar kalkar.
  - Tum room'lar ayni placement pipeline'ini kullanir.
- **Validation**:
  - Character roster testleri veya scene regression testleri guncellenir.

### Task 2.4: Legacy debug store ve normalizer katmanini agresif temizle
- **Location**: `src/js/scene/debug-store.ts`, `src/js/pages/entrance/scene/scene-map.ts`
- **Description**: Room bazli normalizer istisnalarini sil. Draft store'u yeni layout registry formatina gore generic hale getir veya yeni `scene-layout-debug-store.ts` kur. Eski draft verilerini yok say.
- **Complexity**: 7
- **Dependencies**: Task 2.1, Task 2.3
- **Acceptance Criteria**:
  - `normalizeAnalyzeSceneMap`, `normalizeAssistantSceneMap` benzeri legacy yamalar kalkar.
  - Draft format yalnizca yeni canonical layout seklini serialize eder.
  - Eski draft uyumlulugu icin kod kalmaz.
- **Validation**:
  - `scene-debug-store-regressions` yeniden yazilir.

## Sprint 3: Shared Runtime and Renderer
**Goal**: Per-page kopya render kodlarini kaldirip tek bir render/runtime katmani kurmak.
**Demo/Validation**:
- En az iki sayfa ayni render helper'ini kullanarak hotspot/back/character cizer.
- Kopya render loop'lar buyuk oranda silinmis olur.
- View ac/kapa akisi tek runtime API ile yonetilir.

### Task 3.1: Ortak interactive renderer cikart
- **Location**: yeni `src/js/scene/renderers/interactive-layer.ts`, mevcut page controller dosyalari
- **Description**: `renderHotspots()` mantigini ortak modula tasi. Label, glow, geometry, aria ve debug selection davranisini tek yerden yonet.
- **Complexity**: 9
- **Dependencies**: Sprint 2
- **Acceptance Criteria**:
  - Entrance/analyze/assistant/server/rooms/settings ayni interactive renderer'i kullanir.
  - Debug secim mantigi ayrik `door/object` kontrolu yapmaz.
- **Validation**:
  - Smoke-level UI regression checklist hazirlanir.

### Task 3.2: Ortak character renderer cikart
- **Location**: yeni `src/js/scene/renderers/character-layer.ts`, mevcut page controller dosyalari
- **Description**: `renderCharacters()` mantigini ortak modula tasi. Projection, depth, avatar resolve, selected state ve menu anchor davranisini standardize et.
- **Complexity**: 8
- **Dependencies**: Task 2.3
- **Acceptance Criteria**:
  - Character render kodu page controller'larda tekrar etmez.
  - Tum sahneler ayni placement ve projection kurallarini kullanir.
- **Validation**:
  - Manual debug checklist ile karakter pozisyon ve state dogrulanir.

### Task 3.3: Ortak view runtime ve back davranisi kur
- **Location**: `src/js/scene/runtime.ts`, yeni `src/js/scene/renderers/back-layer.ts`, `src/js/scene/back-zone.ts`
- **Description**: `syncSceneViewRuntime()` ve `back-zone.ts` etrafindaki davranisi yeni `back` node modeliyle birlestir. Ayrik sol/sag binder yerine tek back action binder kullan.
- **Complexity**: 8
- **Dependencies**: Task 2.2
- **Acceptance Criteria**:
  - `bindSceneBackZones` ya silinir ya da tek-back wrapper'a iner.
  - View geri donusleri room/view runtime ile tutarli sekilde calisir.
  - HTML icindeki hardcoded geri butonlari kalmaz veya minimal host slot'a iner.
- **Validation**:
  - Assistant/server/analyze/settings/analyze-archive/entrance whisper icin geri donus akisi kontrol edilir.

### Task 3.4: Ortak scene action dispatcher kur
- **Location**: yeni `src/js/scene/action-dispatcher.ts`, mevcut page controller dosyalari
- **Description**: `navigate`, `settings`, `screen`, `whisper`, `back` gibi action tiplerinin page bazli daginik handler'larini tek dispatcher modeline cek. Page controller'lar yalnizca host-specific hook saglasin.
- **Complexity**: 8
- **Dependencies**: Task 3.1, Task 3.3
- **Acceptance Criteria**:
  - `handleHotspotAction`, `_handleAnalyzeSceneHotspotAction`, `handleServerSceneHotspotAction` benzeri kopya dispatcher'lar minimuma iner.
  - `interactive.action` semantigi runtime genelinde tek yerde tanimlanir.
- **Validation**:
  - Action matrix dokumani veya testleri ile her action tipinin beklenen state gecisi dogrulanir.

## Sprint 4: Debug Editor Rewrite
**Goal**: Debug modunu yeni 3 tipli sistem uzerinden calisan tek editor haline getirmek.
**Demo/Validation**:
- Editor listesinde yalnizca `interactive`, `back`, `character` gorunur.
- `interactive` secildiginde label, text, glow ve placement ayarlari ayni panelden duzenlenir.
- `back` secildiginde geri alaninin yerlesimi ve label ayarlari duzenlenir.

### Task 4.1: Editor veri modelini yeni node tiplerine cevir
- **Location**: `src/js/pages/entrance/scene/scene-editor.ts`
- **Description**: `door/object/label/character` secim modelini `interactive/back/character` modeline cevir. Ayri label secimini kaldir, label alanlarini secili node'nun altina tasi.
- **Complexity**: 9
- **Dependencies**: Sprint 3
- **Acceptance Criteria**:
  - Node section'lari yeni 3 tipe gore render edilir.
  - Ayri label node listesi yoktur.
  - Selections ve keyboard shortcuts yeni modele gore calisir.
- **Validation**:
  - Editor regression testleri guncellenir.

### Task 4.2: Kullanicinin istedigi debug ayarlarini ekle
- **Location**: `src/js/pages/entrance/scene/scene-editor.ts`, ortak schema dosyalari
- **Description**: `interactive` icin su alanlari panelde expose et: detayli yerlesim, custom etiket, etiket yerlesimi, text ayarlari, etiket visible/hidden, glow ayarlari. `back` icin ayni etiket ve yerlesim mantigini sagla. `character` icin tek tip yerlesim alanlarini koru.
- **Complexity**: 8
- **Dependencies**: Task 4.1
- **Acceptance Criteria**:
  - Editor UI tum istenen alanlari duzenleyebilir.
  - Label visibility flag'i debug moddan toggle edilir.
  - Glow ayarlari numeric kontrollere baglanir.
- **Validation**:
  - Manual editor smoke testi: sec, kaydir, label gizle/goster, glow degistir, JSON copy.

### Task 4.3: Debug store ve editor kopyalama formatini yenile
- **Location**: `src/js/scene/debug-store.ts`, `src/js/pages/entrance/scene/scene-editor.ts`
- **Description**: Copy JSON ve local draft kayitlarini yeni layout formatina cevir. Eski export formati tamamen kaldir.
- **Complexity**: 6
- **Dependencies**: Task 4.2
- **Acceptance Criteria**:
  - Copy JSON yalnizca yeni registry formatini verir.
  - Draft save/load editor ile birebir uyumludur.
- **Validation**:
  - Manual roundtrip: edit -> save -> refresh -> load -> copy.

## Sprint 5: Page Integration and Legacy Cleanup
**Goal**: Tum sayfalari yeni sistemi tek gecerli altyapi olarak kullanir hale getirmek ve eski kalintilari silmek.
**Demo/Validation**:
- Tum scene sayfalari ve object-view akislari ortak registry + renderer + editor zincirinden calisir.
- Legacy schema/back-zone/normalizer kodu repo'dan temizlenir.
- Testler yeni modeli dogrular.

### Task 5.1: Entrance, analyze, assistant, server, rooms ve settings entegrasyonu
- **Location**: `src/js/pages/entrance/scene/scene-controller.ts`, `src/js/pages/analyze.ts`, `src/js/pages/assistant/assistant.ts`, `src/js/pages/server.ts`, `src/js/pages/rooms.ts`, `src/js/app/topbar-settings-overlay.ts`
- **Description**: Her controller'i canonical registry, ortak renderer helper'lari ve ortak action dispatcher ile calisacak sekilde yeniden bagla. Sayfa bazli scene map state'lerini sadeleştir.
- **Complexity**: 9
- **Dependencies**: Sprint 4
- **Acceptance Criteria**:
  - Tum sahneler yeni veri modelini kullanir.
  - Page bazli duplicate render ve selection kodu minimuma iner.
  - Settings scene de ayni sistemle calisir.
- **Validation**:
  - Scene page smoke checklist uygulanir.

### Task 5.2: Legacy dosya ve API kalintilarini sil
- **Location**: `src/js/scene/back-zone.ts`, `src/js/pages/entrance/scene/scene-hotspots.ts`, `src/js/pages/entrance/scene/scene-map.ts`, ilgili HTML/CSS bloklari
- **Description**: Kullanilmayan legacy adapter/facade ve markup kalintilarini sil. `door`, `label`, `back-zone left/right` ve room-ozel map kalintilarini repo'dan temizle.
- **Complexity**: 7
- **Dependencies**: Task 5.1
- **Acceptance Criteria**:
  - `rg` ile `kind === "door"`, `kind === "label"`, `data-scene-back-zone`, `SceneDoorNodeDefinition`, `SceneLabelNodeDefinition` gibi kalintilar ya tamamen kalkmis ya da sadece migration-not yoksa yok olmus olur.
  - `scene-hotspots.ts` gibi anlamsiz re-export katmanlari temizlenir.
- **Validation**:
  - Search-based cleanup checklist.

### Task 5.3: Test paketini yeni canonical sisteme gore guncelle
- **Location**: `scripts/tests/scene-*.test.ts`
- **Description**: Eski turleri savunan testleri kaldir; yeni 3 tipli modeli, tek back alani ve ortak registry sozlesmesini dogrulayan testlere cevir.
- **Complexity**: 7
- **Dependencies**: Task 5.2
- **Acceptance Criteria**:
  - Scene regression testleri yeni schema'yi bekler.
  - Legacy `door/label/back-zone sides` kontratlarini savunan assertion'lar silinir.
- **Validation**:
  - `scripts/tests/scene-schema-regressions.test.ts`
  - `scripts/tests/scene-debug-room-regressions.test.ts`
  - `scripts/tests/scene-debug-store-regressions.test.ts`
  - `scripts/tests/scene-theme-pack-regressions.test.ts`

## Testing Strategy

- Static validation:
  - TypeScript typecheck
  - Legacy string/identifier search cleanup
- Regression validation:
  - Scene schema tests
  - Scene debug room/store/theme pack tests
- UI validation:
  - `scene:debug` modunda her oda icin interactive node secimi
  - Assistant/server/analyze/settings object-view ac/kapa
  - Analyze archive overlay geri donusu
  - Entrance whisper ac/kapa ve geri donusu
  - Character placement, scale, depth ve avatar durumlari
- Draft validation:
  - Debug edit -> save -> refresh -> reload -> copy JSON roundtrip

## Potential Risks & Gotchas

- En buyuk risk, render/refactor ile page controller davranislarinin kopmasi.
  - Mitigation: Ortak renderer cikarmadan once action matrix net cikarilmali.
- Entrance whisper, analyze archive, settings panel ve assistant/server screen acilimlari ayni degil.
  - Mitigation: Room-view vs object-view state matrix dokumante edilmeli; `back` node yalnizca UI tipi degil state transition tanimi da tasimali.
- Character roster builder bugunku giris verisini `EntranceSceneMap` uzerinden varsayiyor.
  - Mitigation: Character placement tipi ayrilmadan renderer birlestirilmemeli.
- Debug editor'de label'i ayri node olmaktan cikarmak selection mantigini kirabilir.
  - Mitigation: Editor rewrite tek sprint olarak ele alinmali; parcali yama yapilmamali.
- Eski draft JSON'lari invalid olacagi icin debug kullanicisi kayip yasayacak.
  - Mitigation: Bu bilincli kirici degisiklik olarak kabul edilmeli; gereksiz compatibility kodu eklenmemeli.
- CSS tarafinda sol/sag geri alani varsayan layout kurallari kalabilir.
  - Mitigation: `scene-back-zone` selector'leri ve page-ozel exit class'lari temizlenmeli.

## Rollback Plan

- Bu gecis migration'siz ve agresif oldugu icin rollback yalnizca git seviyesinde yapilmali.
- Refactor tek dev commit'e sikistirilmamali; sprint veya alt-sprint commit'leri ile ilerlenmeli.
- Her sprint sonunda calisan bir intermediate state korunmali.
- Eger ortak renderer entegrasyonu sirasinda kritik UI kirilmasi olursa:
  - Son stabil sprint commit'ine geri don
  - Problemli page integration dalini ayri commit serisinde tekrar uygula

## Recommended Execution Order

1. Schema ve registry
2. Tum room/view verisini yeni modele tasima
3. Shared renderer/runtime
4. Debug editor rewrite
5. Page integration
6. Legacy cleanup
7. Test rewrite ve final verification
