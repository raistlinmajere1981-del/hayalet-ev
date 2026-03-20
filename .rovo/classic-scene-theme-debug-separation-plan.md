# Plan: Separate Classic Theme, Scene Theme, and Scene Debug Systems

**Generated**: 2026-03-20
**Estimated Complexity**: High

## Overview

Bu refactorun hedefi, bugun birbirine karismis olan 3 sistemi ayri ve merkezi domain'lere ayirmaktir:

1. `classic theme` sistemi
2. `scene theme` sistemi
3. `scene:debug` sistemi

`ghost-agent` kapsam disidir. Refactor app/electron renderer yuzeyinde kalacak ve mevcut davranis korunarak ilerleyecektir.

Bugunku gozlemler:

- `src/js/ui/theme-manager.ts` klasik appearance state, DOM attribute uygulama, settings sync, localStorage, BroadcastChannel, dropdown/panel UI ve bazi host propagation sorumluluklarini tek yerde topluyor.
- Ayni appearance normalize mantigi `src/js/ui/theme-manager.ts` ve `src/js/modules/settings/settings-schema.ts` icinde tekrar ediyor.
- `src/js/scene/theme-pack.ts` scene asset/theme giris noktasi gibi davransa da `debug` varsayimlari da theme pack icinde tasiniyor.
- `src/js/scene/debug-store.ts` scene debug draft persistence isini yapiyor ama veri kontratini `src/js/pages/entrance/scene/scene-map.ts` altindan aliyor; bu da debug sistemini entrance-page dosya yapisina bagimli hale getiriyor.
- `src/js/pages/entrance/scene/scene-debug.ts`, `src/js/scene/scene-debug-rooms.ts`, `src/js/scene/debug-store.ts` ve `src/js/pages/entrance/scene/scene-editor.ts` debug sisteminin farkli parcalarini ayri yerlerde tutuyor.
- `src/js/app/navigation.ts` ile `src/js/scene/window-controls.ts` ayni `classic / scene / scene-debug` secim modelini markup ve davranis olarak tekrar ediyor.
- `scene` cekirdek importlari `app/pages` tarafinda en az 8 modula yayilmis durumda, `scene debug` flag kullanimlari 7 modulde, `ThemeManager` kullanimlari 6 modulde goruluyor.

Refactor yaklasimi:

- Mevcut moduler yapi korunacak ama net alt-domain klasorleri eklenecek.
- Ortak kod `shared core` noktalara alinacak; sistem-ozel kod kendi sistemi altina tasinacak.
- Mevcut public entry dosyalari ilk etapta facade olarak korunacak; importlar kademeli tasinacak.
- `classic / scene / scene-debug` secimi dogrudan herhangi bir domain'in icinde degil, ince bir orchestration katmaninda tutulacak.

Hedef moduler son durum:

- `src/js/ui/theme/*` → classic theme sistemi
- `src/js/scene/theme/*` → scene theme sistemi
- `src/js/scene/debug/*` → scene debug sistemi
- `src/js/app/ui-mode/*` → bu 3 sistem arasindaki secim ve restart orchestration noktasi
- `src/js/scene/*` → scene runtime/shared core

## Assumptions

- `scene:debug`, `scene theme` icin alt-mod degil; ayri bir debug domain olarak ele alinacak.
- `scene debug draft` formatinin birebir backward compatibility'si zorunlu degil; gerekirse version bump veya reset kabul edilebilir.
- `classic theme` tarafinda kullanici appearance ayarlari korunacak.
- `ghost-agent` kapsam disi oldugu icin `scripts/ghost-agent-wrapper.mjs` ve ghost wrapper runtime akislari degistirilmeyecek; gerekiyorsa facade/compatibility korunacak.

## Prerequisites

- Ana etkili dosyalar:
  - `src/js/ui/theme-manager.ts`
  - `src/js/modules/settings/settings-schema.ts`
  - `src/js/ui/ui-mode.ts`
  - `src/js/app/navigation.ts`
  - `src/js/scene/window-controls.ts`
  - `electron/startup-flags.ts`
  - `src/js/scene/theme-pack.ts`
  - `src/assets/themes/castle/scene/manifest.ts`
  - `src/js/scene/debug-store.ts`
  - `src/js/scene/scene-debug-rooms.ts`
  - `src/js/pages/entrance/scene/scene-debug.ts`
  - `src/js/pages/entrance/scene/scene-map.ts`
  - `src/js/pages/entrance/scene/scene-editor.ts`
  - `src/js/pages/entrance/scene/scene-controller.ts`
  - `src/js/pages/assistant/assistant.ts`
  - `src/js/pages/analyze.ts`
  - `src/js/pages/server.ts`
  - `src/js/pages/rooms.ts`
  - `src/js/pages/settings/controller.ts`
  - `src/js/ui/splash-screen.ts`
  - `src/js/pages/shared/bootstrap-external-tool-page.ts`
  - `src/js/pages/opencode-ui/app.ts`
- Guncellenecek test yuzeyi:
  - `scripts/tests/startup-flags-regressions.test.ts`
  - `scripts/tests/scene-theme-pack-regressions.test.ts`
  - `scripts/tests/scene-debug-store-regressions.test.ts`
  - `scripts/tests/scene-debug-room-regressions.test.ts`
  - Gerekirse yeni `theme` ve `ui-mode` regression testleri

## Sprint 1: Boundary and Orchestration
**Goal**: Uc sistemi ayirmak icin klasor, facade ve orchestration sinirlarini netlestirmek.
**Demo/Validation**:
- Kod tabaninda classic theme, scene theme ve scene debug icin ayri module roots mevcut olur.
- `classic / scene / scene-debug` mapping'i tek yerden okunur.
- Eski entry dosyalari calismaya devam eder ama yeni domain modullerine delegasyon yapar.

### Task 1.1: Uc sistem icin domain module roots olustur
- **Location**: yeni `src/js/ui/theme/index.ts`, yeni `src/js/scene/theme/index.ts`, yeni `src/js/scene/debug/index.ts`, mevcut facade dosyalari
- **Description**: Klasik tema, scene tema ve scene debug icin canonical entry modullerini olustur. Ilk adimda `src/js/ui/theme-manager.ts`, `src/js/scene/theme-pack.ts`, `src/js/scene/debug-store.ts`, `src/js/scene/scene-debug-rooms.ts`, `src/js/pages/entrance/scene/scene-debug.ts` dosyalari facade veya re-export katmanina indir.
- **Complexity**: 5
- **Dependencies**: None
- **Acceptance Criteria**:
  - Yeni domain roots vardir.
  - Import tasima icin compatibility korunur.
  - Hangi dosyanin hangi domain'e ait oldugu netlesir.
- **Validation**:
  - `rg` ile yeni import hedefleri dogrulanir.
  - Uygulama build veya TS syntax kontrolunde import resolution bozulmaz.

### Task 1.2: UI mode orchestration katmanini ayir
- **Location**: yeni `src/js/app/ui-mode/*`, `src/js/app/navigation.ts`, `src/js/scene/window-controls.ts`, `src/js/ui/ui-mode.ts`, `electron/startup-flags.ts`
- **Description**: `classic`, `scene`, `scene-debug` option listesi, restart option mapping'i, active state okuma ve dropdown davranisini tek orchestration katmanina cek. `navigation.ts` ve `scene/window-controls.ts` sadece UI binder olarak kalsin.
- **Complexity**: 7
- **Dependencies**: Task 1.1
- **Acceptance Criteria**:
  - Option tanimlari ve restart mapping'i tek yerde bulunur.
  - `scene-debug` secimi hicbir domain module'unun ic mantigina dagilmaz.
  - `scene/window-controls.ts` ve shell topbar ayni source'u kullanir.
- **Validation**:
  - `startup-flags-regressions` guncellenir veya genisletilir.
  - UI mode dropdown smoke checklist ile test edilir.

### Task 1.3: Domain import kurallarini belirle
- **Location**: `src/js/ui/theme-manager.ts`, `src/js/scene/theme-pack.ts`, `src/js/scene/debug-store.ts`, ilgili page controller dosyalari
- **Description**: Ortak/core kod ile domain-specific kod arasinda import yonunu standartlastir. Ozellikle `pages/entrance/scene/*` altindaki generic kodlarin domain veya core'a tasinacagi listeyi netlestir.
- **Complexity**: 4
- **Dependencies**: Task 1.1
- **Acceptance Criteria**:
  - `scene debug` domain'i `pages/entrance/scene/*` altina fiziksel olarak bagimli kalmaz.
  - `scene theme` domain'i debug config tasimaz.
  - `classic theme` domain'i assistant/webview gibi host-specific detaylari dogrudan bilmez.
- **Validation**:
  - Refactor checklist veya import matrix dokumani ile kontrol edilir.

## Sprint 2: Classic Theme System Extraction
**Goal**: Classic theme sistemini tek bir appearance domain'i haline getirmek.
**Demo/Validation**:
- Klasik theme normalize/persist/sync sorumluluklari ayri modullere dagilmis olur.
- `ThemeManager` ince facade haline gelir.
- Ayarlar, dropdown ve dis host theme propagation davranisi korunur.

### Task 2.1: Appearance contract ve normalizer'i merkezilestir
- **Location**: yeni `src/js/ui/theme/appearance-normalizer.ts`, `src/js/modules/settings/settings-schema.ts`, `src/types/settings.ts`, `src/js/ui/theme-manager.ts`
- **Description**: `normalizeAppearance` ve `normalizeThemeAppearanceSettings` tekrarini kaldir. Tek bir canonical normalizer ve validation helper olustur; settings schema ve theme runtime ayni mantigi kullansin.
- **Complexity**: 7
- **Dependencies**: Sprint 1
- **Acceptance Criteria**:
  - Theme appearance normalization tek kaynaktan gelir.
  - `general.appearance` patch/read davranisi degismez.
  - Legacy theme fallback davranisi korunur.
- **Validation**:
  - Yeni appearance unit/regression testleri eklenir.
  - Mevcut theme ayarlari ile startup davranisi manuel kontrol edilir.

### Task 2.2: ThemeManager sorumluluklarini parcala
- **Location**: yeni `src/js/ui/theme/theme-state.ts`, yeni `src/js/ui/theme/theme-dom.ts`, yeni `src/js/ui/theme/theme-sync.ts`, yeni `src/js/ui/theme/theme-settings-ui.ts`, `src/js/ui/theme-manager.ts`
- **Description**: State/current theme hesaplama, DOM attribute yazimi, BroadcastChannel/localStorage sync'i ve settings panel/dropdown UI kurulumunu ayri modullere tasir. `ThemeManager` sadece public facade olur.
- **Complexity**: 8
- **Dependencies**: Task 2.1
- **Acceptance Criteria**:
  - `ThemeManager` public API bozulmadan calisir.
  - DOM side effects ile persistence logic ayni dosyada toplanmaz.
  - Theme panel ve dropdown davranisi ayni kalir.
- **Validation**:
  - Theme degisimi, scheduled/system/manual modlari manuel smoke testten gecer.
  - Syntax ve ilgili regression testleri calisir.

### Task 2.3: Host-specific theme propagation adaptorlerini ayir
- **Location**: yeni `src/js/ui/theme/host-sync.ts`, `src/js/pages/shared/bootstrap-external-tool-page.ts`, `src/js/pages/opencode-ui/app.ts`, `src/js/pages/assistant/assistant.ts`
- **Description**: External tool page query param sync'i, assistant icindeki opencode-ui theme gecisi ve webview `executeJavaScript` temasi gibi host-specific davranislari ayri adaptor modullere tasi.
- **Complexity**: 7
- **Dependencies**: Task 2.2
- **Acceptance Criteria**:
  - Theme core modulu assistant/opencode-ui detaylarina bagimli olmaz.
  - External page bootstrap hala aktif theme ile acilir.
  - Assistant icindeki opencode-ui theme sync davranisi korunur.
- **Validation**:
  - `assistant` icinden opencode-ui acilarak theme aktarimi manuel dogrulanir.
  - Query-based theme sync icin basit regression testi eklenir.

## Sprint 3: Scene Theme System Extraction
**Goal**: Scene'in gorsel tema ve asset tarafini ayri, sade bir merkezi sistem haline getirmek.
**Demo/Validation**:
- Room background, panel art, loading frames ve character visual config tek bir scene theme domain'inden okunur.
- Scene theme sistemi debug ayari veya draft metadata tasimaz.
- Scene consumers yeni domain API'si ile calisir.

### Task 3.1: Scene theme module yapisini cikart
- **Location**: yeni `src/js/scene/theme/scene-theme-registry.ts`, yeni `src/js/scene/theme/scene-theme-assets.ts`, yeni `src/js/scene/theme/scene-loading-theme.ts`, `src/js/scene/theme-pack.ts`
- **Description**: `theme-pack.ts` icindeki getter'lari sahne tema domain'ine tasir. `theme-pack.ts` gerekiyorsa temporary facade olarak kalsin.
- **Complexity**: 6
- **Dependencies**: Sprint 1
- **Acceptance Criteria**:
  - Background/panel/loading/character role getter'lari scene theme domain altindadir.
  - Page controller'lar ve splash screen yeni API'yi kullanir veya facade uzerinden ona ulasir.
- **Validation**:
  - `scene-theme-pack-regressions` yeni dosya yapisina gore guncellenir.
  - Splash ve en az iki room page smoke testten gecer.

### Task 3.2: Theme manifest'i yalnizca gorsel data kaynagi yap
- **Location**: `src/assets/themes/castle/scene/manifest.ts`, `src/js/scene/theme/*`
- **Description**: Scene manifest icindeki debug metadata'yi ayiklamaya hazir hale getir. Theme pack sadece art/loading/role/room view asset tanimlarini tasiyacak sekilde sadeleştirilir.
- **Complexity**: 5
- **Dependencies**: Task 3.1
- **Acceptance Criteria**:
  - Manifest gorsel data source olarak kalir.
  - Debug editable rooms ve draft storage key gibi veriler theme domain'den cikmaya hazirdir.
  - Scene theme domain ile scene debug domain siniri dokumante edilir.
- **Validation**:
  - Manifest contract regression testleri guncellenir.

### Task 3.3: Scene character visual config'i runtime core'dan ayir
- **Location**: `src/js/scene/theme/*`, `src/js/pages/entrance/scene/scene-character-roster.ts`, `src/js/scene/renderers/character-layer.ts`
- **Description**: Character body art, scale ve avatar placement config'ini scene theme domain'ine net sekilde bagla. Character rendering core'u theme'den yalnizca typed visual config alsin.
- **Complexity**: 6
- **Dependencies**: Task 3.1
- **Acceptance Criteria**:
  - Character renderer sadece typed visual config tuketir.
  - Page controller veya roster builder asset path bilmez.
- **Validation**:
  - Character render smoke checklist ile assistant ve entrance odalari kontrol edilir.

## Sprint 4: Scene Debug System Extraction
**Goal**: Scene debug sistemini tek bir domain altinda toplamak ve entrance-page bagimliligini kirarak merkezi hale getirmek.
**Demo/Validation**:
- Debug flag, active room registry, draft store ve editor session ayni domain altinda bulunur.
- `scene debug` sistemi `scene theme` sisteminden ayridir.
- `scene debug` sistemi `pages/entrance/scene/*` path bagimliligindan kurtulur.

### Task 4.1: Debug flag ve room registry'yi ayni domain altina tasi
- **Location**: yeni `src/js/scene/debug/scene-debug-flag.ts`, yeni `src/js/scene/debug/scene-debug-room-registry.ts`, `src/js/pages/entrance/scene/scene-debug.ts`, `src/js/scene/scene-debug-rooms.ts`, `src/js/app/navigation.ts`
- **Description**: `data-scene-debug` attribute, startup flag okuma, active debug room state ve room tanimlarini scene debug domain altina tasi. Eski dosyalar facade olur veya silinir.
- **Complexity**: 6
- **Dependencies**: Sprint 1
- **Acceptance Criteria**:
  - Debug flag okuma ve room registry ayni domain icindedir.
  - Page-level dosyalar global debug state kaynagi olmaz.
  - Navigation active room sync yeni domain API'si ile calisir.
- **Validation**:
  - `scene-debug-room-regressions` guncellenir.
  - `scene-debug` acik/kapali durumunda active room attribute smoke testi yapilir.

### Task 4.2: Scene layout kontratini entrance sayfasindan ayir
- **Location**: yeni `src/js/scene/layout/scene-layout-state.ts`, yeni `src/js/scene/layout/scene-layout-serialization.ts`, `src/js/pages/entrance/scene/scene-map.ts`, `src/js/scene/debug-store.ts`
- **Description**: `EntranceSceneMap`, clone/serialize helpers, default room maps ve normalizer'lari `pages/entrance/scene/scene-map.ts` altindan cikar. Bunlari scene core/layout domain'ine tasi; debug store artik entrance path'ine bagli olmasin.
- **Complexity**: 9
- **Dependencies**: Task 4.1
- **Acceptance Criteria**:
  - `debug-store.ts` artik `pages/entrance/scene/scene-map.ts` import etmez.
  - Room default layouts shared layout domain'indedir.
  - Entrance page altindaki dosya sadece entrance-specific helper ise kalir; generic veri kontrati kalmaz.
- **Validation**:
  - `scene-debug-store-regressions` yeniden yazilir.
  - TS import graph ile domain bagimliliklari kontrol edilir.

### Task 4.3: Draft persistence ve debug config'i merkezilestir
- **Location**: yeni `src/js/scene/debug/scene-debug-store.ts`, yeni `src/js/scene/debug/scene-debug-config.ts`, `src/assets/themes/castle/scene/manifest.ts`
- **Description**: `editableRoomIds`, `defaultRoomId`, `draftStorageKeys` gibi debug config verilerini scene theme manifest'inden ayir ve scene debug domain'ine tasi. Draft store bu config'i theme pack yerine debug config'ten okusun.
- **Complexity**: 8
- **Dependencies**: Task 4.2, Sprint 3
- **Acceptance Criteria**:
  - Theme manifest debug metadata tasimaz.
  - Draft storage key ve editable room listesi debug domain altinda canonical olur.
  - Scene debug systemi theme pack'ten bagimsiz calisir.
- **Validation**:
  - `scene-theme-pack-regressions` ve `scene-debug-store-regressions` birlikte guncellenir.

### Task 4.4: Editor session ve debug tooling'i page host'lardan ayir
- **Location**: yeni `src/js/scene/debug/scene-debug-editor-session.ts`, `src/js/pages/entrance/scene/scene-editor.ts`, `src/js/pages/entrance/scene/scene-controller.ts`, `src/js/pages/assistant/assistant.ts`, `src/js/pages/analyze.ts`, `src/js/pages/server.ts`, `src/js/pages/rooms.ts`, `src/js/pages/settings/controller.ts`
- **Description**: Secim, reset, copy/export, room switch, draft apply/save gibi editor davranislarini scene debug domain'ine tasi. Page controller'lar yalnizca host lifecycle ve page-specific action handler olarak kalsin.
- **Complexity**: 9
- **Dependencies**: Task 4.2, Task 4.3
- **Acceptance Criteria**:
  - Debug editor session mantigi tek yerde olur.
  - Page controller'larda debug editor setup tekrar etmez.
  - En az iki farkli page ayni debug session API'sini kullanir.
- **Validation**:
  - `scene:debug` modunda entrance ve assistant veya settings icin draft kaydet/yukle smoke testi uygulanir.

## Sprint 5: Consumer Migration and Cleanup
**Goal**: Tum consumer'lari yeni domain'lere gecirip eski karisik importlari temizlemek.
**Demo/Validation**:
- Page controller importlari sistematik olarak yeni module roots'a bakar.
- Eski facade dosyalar minimal hale iner veya silinir.
- Davranis classic, scene ve scene:debug modlarinda korunur.

### Task 5.1: Shell ve low-risk consumer migration
- **Location**: `src/js/app/index.ts`, `src/js/app/navigation.ts`, `src/js/ui/splash-screen.ts`, `src/js/pages/shared/bootstrap-external-tool-page.ts`, `src/js/pages/opencode-ui/app.ts`
- **Description**: Shell-level consumers'i yeni `ui/theme`, `scene/theme`, `scene/debug`, `app/ui-mode` modullerine gecir.
- **Complexity**: 6
- **Dependencies**: Sprint 2, Sprint 3, Sprint 4
- **Acceptance Criteria**:
  - Shell-level startup ve external page bootstrapi yeni boundaries ile calisir.
  - Scene splash/loading ve classic theme bootstrapi bozulmaz.
- **Validation**:
  - Startup smoke testi uygulanir.

### Task 5.2: Scene page consumer migration
- **Location**: `src/js/pages/entrance/scene/scene-controller.ts`, `src/js/pages/assistant/assistant.ts`, `src/js/pages/analyze.ts`, `src/js/pages/server.ts`, `src/js/pages/rooms.ts`, `src/js/pages/settings/controller.ts`
- **Description**: Page controller importlarini yeni domain API'lerine tasi. Ortak helper'lari scene core'da, system-specific helper'lari kendi domain'lerinde kullanacak sekilde temizle.
- **Complexity**: 9
- **Dependencies**: Sprint 2, Sprint 3, Sprint 4
- **Acceptance Criteria**:
  - Page dosyalari `pages/entrance/scene/*` altindaki generic utility'lere dogrudan bagimli kalmaz.
  - Scene theme ve scene debug kullanimlari ayrik import yollarina sahip olur.
  - Page controller'larin responsibility set'i daralir.
- **Validation**:
  - Her page icin scene mode smoke checklist uygulanir.

### Task 5.3: Entrance klasoru altindaki ortak helper'lari merkezi yere tasi
- **Location**: `src/js/pages/entrance/scene/scene-avatar.ts`, `src/js/pages/entrance/scene/scene-character-roster.ts`, `src/js/pages/entrance/scene/scene-character-role.ts`, yeni `src/js/scene/characters/*`, ilgili page controller dosyalari
- **Description**: Entrance altinda duran ama assistant/analyze/server/rooms/settings tarafinda da kullanilan ortak helper'lari scene core veya uygun subdomain altina tasi. Entrance klasoru sadece entrance-specific orchestration icersin.
- **Complexity**: 8
- **Dependencies**: Sprint 3, Sprint 4, Task 5.2
- **Acceptance Criteria**:
  - `scene-avatar`, `scene-character-roster`, `scene-character-role` gibi ortak yardimcilar canonical scene path altindadir.
  - Page controller'lar entrance-specific klasoru ortak utility kaynagi olarak kullanmaz.
  - Ortak ve sistem-ozel helper ayrimi dosya yapisinda gorunur hale gelir.
- **Validation**:
  - `rg` ile cross-page entrance importlari taranir ve kritik ortak importlar temizlenir.

### Task 5.4: Facade ve duplicate markup temizligi
- **Location**: `src/js/ui/theme-manager.ts`, `src/js/scene/theme-pack.ts`, `src/js/scene/debug-store.ts`, `src/js/scene/scene-debug-rooms.ts`, `src/js/pages/entrance/scene/scene-debug.ts`, `src/js/scene/window-controls.ts`, `src/index.html`
- **Description**: Gecis tamamlandiginda facade dosyalarini minimal re-export seviyesine indir veya sil. UI mode dropdown markup tekrarlarini shared builder veya shared template'e cek.
- **Complexity**: 7
- **Dependencies**: Task 5.1, Task 5.2, Task 5.3
- **Acceptance Criteria**:
  - Duplicate ui-mode option markup tek kaynaktan uretilir.
  - Eski karisik facade/import yollarinin buyuk bolumu kalkar.
  - Sistem ayrimi kod yapisinda okunur hale gelir.
- **Validation**:
  - `rg` ile duplicate option markup ve legacy importlar taranir.

### Task 5.5: Regression test ve syntax sonlandirma
- **Location**: ilgili test dosyalari ve degisen kaynak dosyalar
- **Description**: Yeni moduler yapinin regression yuzeyini guncelle. Theme, scene theme, scene debug ve ui-mode orchestration icin hedefli testler ekle veya var olanlari guncelle.
- **Complexity**: 7
- **Dependencies**: Task 5.1, Task 5.2, Task 5.3, Task 5.4
- **Acceptance Criteria**:
  - Ana regression dosyalari yeni module yapisini yansitir.
  - Yeni merkezi domain'lerin varligi testlerle korunur.
  - Syntax/build seviyesi temizdir.
- **Validation**:
  - Hedefli test komutlari ve syntax kontrolleri calistirilir.

## Testing Strategy

- Hedefli syntax/TS kontrolu:
  - Degisen her dosya icin syntax kontrolu
  - Gerekirse ilgili TS diagnostics
- Regression test seti:
  - `scripts/tests/startup-flags-regressions.test.ts`
  - `scripts/tests/scene-theme-pack-regressions.test.ts`
  - `scripts/tests/scene-debug-store-regressions.test.ts`
  - `scripts/tests/scene-debug-room-regressions.test.ts`
  - Theme normalize ve host propagation icin yeni regression testleri
- Manual smoke checklist:
  - App classic mode ile acilir, kayitli theme uygulanir
  - App scene mode ile acilir, splash/loading ve scene assetleri dogru gelir
  - `scene:debug` modunda active room secimi, draft load/save/reset ve editor secimi calisir
  - Assistant icindeki opencode-ui theme propagation korunur
  - Settings scene panel, assistant screen, server screen ve analyze view gecisleri bozulmaz

## Potential Risks & Gotchas

- `scene debug` config theme manifest'ten ayrilirken mevcut draft storage key davranisi kirilabilir.
  - Mitigation: versioned key veya controlled reset karari Sprint 1'de netlestirilmeli.
- `ThemeManager` icindeki normalize ve sync mantigi tasinirken startup sirasinda race condition olusabilir.
  - Mitigation: facade once korunmali, state ownership tek module gecince consumer migration yapilmali.
- `scene-map.ts` bugun entrance klasoru altinda ama birden cok sayfanin ortak veri kontratini tasiyor.
  - Mitigation: once layout contract'i shared core'a tasinmali, sonra consumers migrate edilmeli.
- `ghost-agent` kapsam disi oldugu icin script/wrapper tarafinda mevcut `scene` ve `scene:debug` naming korunmali.
  - Mitigation: CLI flag ve startup contract isimleri degistirilmemeli.
- `src/js/app/navigation.ts` ve `src/js/scene/window-controls.ts` tekrar eden mode dropdown davranisi farkli buglara yol acabilir.
  - Mitigation: orchestration katmani olmadan domain extraction'a baslanmamali.
- Assistant icindeki webview theme sync JS injection ile yapiliyor.
  - Mitigation: host propagation adaptoru ayri test edilmeli ve theme core'dan ayrilmali.

## Rollback Plan

- Refactor sprint-bazli, kucuk commit'lerle ilerletilir; her sprint sonunda calisan facade yapisi korunur.
- Ilk asamada facade dosyalari silinmez; rollback gerekirse consumer importlari eski facade'lara dondurulebilir.
- `scene debug` storage formatinda degisiklik olacaksa key version bump kullanilir; bu sayede eski draftlar rollback halinde etkilenmez.
- UI mode orchestration degisiklikleri ayri commit olarak tutulur; restart davranisinda sorun cikarsa bu commit tek basina geri alinabilir.
- Theme core extraction ile host propagation extraction ayri commitlenir; opencode-ui veya external page theme sync bozulursa yalnizca adaptor katmani geri alinabilir.
