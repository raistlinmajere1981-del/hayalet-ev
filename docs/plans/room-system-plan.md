# Plan: Hayalet Ev Room System

**Generated**: 2026-03-08
**Estimated Complexity**: High

## Overview
Hayalet Ev'e eklenecek odalar için hedef, host uygulamadan görsel ve kod olarak ayrışan; canlı olarak içe aktarılabilen; tek dosya olarak dışa aktarılabilen; menüye otomatik bağlanan; Hayalet Ev ile sadece `++cmd` üzerinden konuşan bir oda altyapısı kurmaktır.

Bu plan, mevcut mimaride zaten var olan üç hattı genelleştirir:
- sayfa gösterimi: `showPage(pageName)` ve `page-${name}` düzeni
- protokol gönderimi: `room + scenario + targets` ekseni
- komut yakalama: `CatchManager` -> `handleCaughtCommandWithContext()` -> `ServerCommands`

Önerilen v1 yönü:
- source of truth: proje kökünde `rooms/` klasörü
- her oda için bağımsız klasör: `rooms/<roomId>/`
- oda paketi formatı: tek dosya `.hevroom.json`
- paketleme akışı: `rooms/<roomId>/` -> bundle
- import/export akışı: klasör merkezli, bundle türetilmiş çıktı/girdi
- UI izolasyonu: room-dedicated `webview` host
- host entegrasyonu: manifest + host adapter + protocol/command registration
- iletişim sınırı: room UI <-> Hayalet Ev host sadece `++cmd` metinleri
- güven modeli: v1 için trusted local package, imza doğrulama sonraki faz

## Assumptions
- İlk sürümde odalar mevcut bağlı slotları (`ai1` / `ai2`) kullanır; yeni provider oturumu açmaz.
- “Gerçek zamanlı import” hedefi, uygulamayı yeniden başlatmadan install/register edebilmek demektir.
- Room geliştirme ve yerel yönetim için canonical kaynak proje kökündeki `rooms/<roomId>/` klasörüdür.
- Tek dosya bundle export zip yerine JSON bundle olarak kalır; ancak bu dosya klasör tabanlı oda kaynağından türetilir.
- Import/export işlemleri öncelikle room klasörü üzerinden çalışır; tek dosya bundle dağıtım/taşıma formatıdır.
- Oda host ile doğrudan JS import bağı kurmaz; host tarafına yalnızca manifest ve room package içindeki host adapter üzerinden bağlanır.
- Room UI v1’de ana renderer DOM’una doğrudan gömülmez; mevcut runtime-friendly yol olan bağımsız `webview` host üzerinden çalıştırılır.
- Oda bazlı `++cmd` isimleri mevcut regex kısıtı nedeniyle yalnızca `[A-Za-z0-9_]` kullanır.
- Room command payload’ları mevcut parser sınırları nedeniyle erken aşamada tek-string wire format ile standardize edilir.

## Prerequisites
- Mevcut navigation, protocol ve command zincirinin korunması
- Yeni geliştirme/workspace alanı: `rooms/`
- Yeni runtime dosya alanları: `data/rooms/`, `config/rooms.json`
- Yeni typings ve registry katmanları
- Room bundle doğrulama kuralları
- Test fixture room paketi

## Sprint 1: Room Package Contract
**Goal**: Oda sistemi için kalıcı sözleşmeyi ve install/persist katmanını oluşturmak.
**Demo/Validation**:
- `rooms/<roomId>/` klasörü parse edilir.
- Manifest doğrulanır.
- Room klasöründen bundle üretilir.
- Paket `data/rooms/<roomId>/` altına persist edilir.
- Uygulama restart olmadan installed rooms listesi alınabilir.

### Task 1.1: Define Room Bundle Schema
- **Location**: `shared/rooms.ts`, `src/types/rooms.ts`, `docs/room-package-schema.md`, `docs/room-folder-layout.md`
- **Description**: Hem room klasör yapısını hem de bundle şemasını tanımla. Folder layout içinde en az `manifest.json`, `ui/`, `host/`, `protocols/`, `assets/` alanlarını tarif et. Bundle için `schemaVersion`, `manifest`, `files`, `protocols`, `commands`, `permissions`, `integrity` alanlarını tanımla. Manifest içinde `id`, `version`, `menu`, `uiEntry`, `hostEntry`, `protocolSpecs`, `commandSpecs`, `storageNamespace` ve `engineRange` alanlarını zorunlu kıl.
- **Complexity**: 6
- **Dependencies**: None
- **Acceptance Criteria**:
  - `rooms/<roomId>/` klasör yapısı canonical kaynak olarak tiplenmiş olur.
  - Room paket formatı tek bir source of truth ile tiplenmiş olur.
  - `commandSpecs` ve `protocolSpecs` host tarafında kaydedilebilir hale gelir.
  - XOX gibi oda örnekleri aynı şemayla üretilebilir.
- **Validation**:
  - Geçerli/geçersiz room klasör yapısı fixture testleri
  - Şema fixture dosyaları ile parse testi
  - Geçersiz command name ve duplicate protocol key testleri

### Task 1.2: Add Main-Process Room Package Manager
- **Location**: `electron/room-package-manager.ts`, `electron/main.ts`, `electron/preload.cjs`, `src/js/global.d.ts`
- **Description**: Room install/list/remove/export işlerini main process tarafında yöneten bir manager ekle. Ana akış klasör tabanlı olmalı: `rooms/<roomId>/` kaynağını doğrula, runtime için `data/rooms/<roomId>/` altına persist et, gerektiğinde klasörden tek dosya bundle üret. İsteğe bağlı olarak bundle import desteği bu manager içinde klasöre açılarak aynı akışa sokulmalı.
- **Complexity**: 7
- **Dependencies**: Task 1.1
- **Acceptance Criteria**:
  - Room manager proje kökündeki `rooms/` klasörünü tarayabilir.
  - Install işlemi doğrudan `rooms/<roomId>/` klasöründen yapılabilir.
  - Install sonrası paket dosyaları `data/rooms/<roomId>/` altında tutulur.
  - Room UI için `webview` tarafından yüklenebilir bir runtime entry (`data/rooms/<roomId>/runtime/index.html` veya eşdeğer) üretilir.
  - Installed registry `config/rooms.json` veya eşdeğer ayrı bir kayıt dosyasında tutulur.
  - Renderer tarafı `window.electronAPI.rooms.*` benzeri IPC ile bunlara erişebilir.
- **Validation**:
  - Folder install/list/remove/export regresyon testleri
  - Install/list/remove/export regresyon testleri
  - Aynı `roomId` ve sürüm çakışmalarında beklenen hata dönüşleri

### Task 1.3: Bootstrap Room Registry in Renderer
- **Location**: `src/js/modules/rooms/room-registry.ts`, `src/js/app/index.ts`
- **Description**: Uygulama açılışında installed room manifestlerini yükleyen ve renderer seviyesinde erişilebilir hale getiren `RoomRegistry` ekle. Bu registry page injection, menu render ve command/protocol registration için tek giriş noktası olsun.
- **Complexity**: 6
- **Dependencies**: Task 1.2
- **Acceptance Criteria**:
  - `CoreEngine.init()` sonrasında installed room listesi renderer'da hazır olur.
  - Registry hot install sonrası kendini yenileyebilir.
  - Startup sırası bozulmadan kullanılabilir.
- **Validation**:
  - Boot sırası testi
  - Empty room list ve 1+ installed room senaryosu

### Task 1.4: Add Bundle Validator and Fixture Room
- **Location**: `scripts/rooms/validate-room-bundle.mjs`, `scripts/rooms/validate-room-folder.mjs`, `scripts/tests/room-bundle-validator-regressions.test.ts`, `scripts/test-fixtures/rooms/hello-room/`, `scripts/test-fixtures/rooms/hello-room.hevroom.json`
- **Description**: Room klasörü ve bundle doğrulama script'leri ekle. Minimal fixture room klasörü oluştur ve aynı kaynaktan bundle türet. Bu fixture AI içermeyen basit bir oda ile host pipeline'ını kanıtlasın.
- **Complexity**: 5
- **Dependencies**: Task 1.1
- **Acceptance Criteria**:
  - Folder validator geçerli/geçersiz room klasörlerini ayırır.
  - Validator CLI geçerli/geçersiz paketleri ayırır.
  - Fixture paket Sprint 2 ve Sprint 3 testlerinde tekrar kullanılabilir.
- **Validation**:
  - Folder validator smoke test
  - CLI smoke test
  - Invalid manifest fixture testleri

## Sprint 2: Dynamic Navigation and Isolated Room Runtime
**Goal**: Room’ların menüye otomatik eklenmesi ve UI tarafının host’tan izole biçimde mount edilmesi.
**Demo/Validation**:
- Install edilen room menüde görünür.
- Tıklanınca `page-roomId` açılır.
- Room UI kendi CSS/JS’iyle çalışır, host stillerini bozmaz.

### Task 2.1: Make Navigation Registry-Driven for Extra Rooms
- **Location**: `src/index.html`, `src/js/app/navigation.ts`, `src/js/app/page-init.ts`
- **Description**: Çekirdek sayfaları koruyup ek odaları registry’den render eden bir side-nav ve page-shell üretimi ekle. `showPage()` mevcut generic yapıda kalmalı, sadece dinamik room button ve page shell eklenmeli.
- **Description**: Çekirdek sayfaları koruyup ek odaları registry’den render eden bir side-nav ve page-shell üretimi ekle. `showPage()` mevcut generic yapıda kalmalı, sadece dinamik room button ve page shell eklenmeli. Event binding tek seferlik statik query yerine delegated veya incremental insertion dostu hale getirilmeli.
- **Complexity**: 7
- **Dependencies**: Task 1.3
- **Acceptance Criteria**:
  - Oda eklendiğinde menu bağlantısı otomatik oluşur.
  - Core page navigation davranışı regresyona uğramaz.
  - Startup sırasında kayıtlı room’lar nav içine güvenle eklenir.
- **Validation**:
  - Navigation regression testleri
  - Startup render sonrası DOM snapshot testi

### Task 2.2: Add Room Page Controller Contract
- **Location**: `src/js/app/types.ts`, `src/js/modules/rooms/room-controller.ts`, `src/js/modules/rooms/room-page-factory.ts`
- **Description**: `PageController` ile uyumlu dinamik room controller katmanı ekle. Bu katman room lifecycle (`init`, `onShow`, `onHide`, `dispose`) ve registry verisini yönetsin.
- **Complexity**: 6
- **Dependencies**: Task 2.1
- **Acceptance Criteria**:
  - Her room page core controller’larla aynı lifecycle düzenine oturur.
  - Lazy init ve tekrar gösterimde state korunumu kuralları netleşir.
- **Validation**:
  - Controller lifecycle unit testleri
  - Tekrar aç/kapat smoke testi

### Task 2.3: Build Room Webview Host
- **Location**: `src/js/modules/rooms/room-webview-host.ts`, `src/js/modules/rooms/room-bridge.ts`, `electron/room-webview-preload.cjs`, `electron/window-manager.ts`
- **Description**: Room UI’yi bağımsız bir room `webview` içinde çalıştır. Mevcut `opencode-ui` ve slot webview yaklaşımına benzer şekilde, room bundle’dan çözülen runtime entry URL/web content yüklenmeli. Room için ayrı minimal preload ve ayrı navigation policy tanımlanmalı; mevcut genel `webview-preload.cjs` tekrar kullanılmamalı. Host ile room UI arasında yalnızca `sendToHost`/IPC köprüsü üzerinden `++cmd` string alışverişi yapan bir bridge kur.
- **Complexity**: 8
- **Dependencies**: Task 2.2
- **Acceptance Criteria**:
  - Room CSS/JS host renderer sayfalarını etkileyemez.
  - Room runtime ana renderer build zincirinden bağımsız yüklenebilir.
  - Room `webview` için kullanılacak preload/bridge yüzeyi açıkça whitelist edilmiş olur; ana `electronAPI` yüzeyi komple açılmaz.
  - Room `webview` local/runtime entry dışındaki navigasyonları kapatır veya açıkça policy ile sınırlar.
  - Host ve room arasındaki mesajlar sadece command text formatında akar.
- **Validation**:
  - Webview mount/unmount regression testi
  - Host API yüzeyi smoke testi
  - Bridge handshake smoke testi

### Task 2.4: Mount a Hello Room End-to-End
- **Location**: `scripts/test-fixtures/rooms/hello-room/`, `scripts/test-fixtures/rooms/hello-room.hevroom.json`, `scripts/tests/room-runtime-mount-regressions.test.ts`
- **Description**: Basit bir “hello room” klasörü ile install -> nav render -> page open -> room command dispatch akışını tamamla. Aynı fixture’dan bundle üretimi de doğrulansın.
- **Complexity**: 4
- **Dependencies**: Task 2.3
- **Acceptance Criteria**:
  - Room UI yüklenir ve host’tan komut alır.
  - Room UI host’a komut gönderebilir.
- **Validation**:
  - End-to-end install/open smoke testi

## Sprint 3: Room Command and Protocol Registries
**Goal**: Room paketlerinden gelen `++cmd` ve protokolleri sistemde dinamik olarak register etmek.
**Demo/Validation**:
- Room-specific command AI mesajından yakalanıp handler’a düşer.
- Room-specific protocol key Archives ekranında görünür.
- Hot install sonrası restart gerekmeksizin command/protocol aktifleşir.

### Task 3.1: Replace Hardcoded Protocol Mapping with Protocol Registry
- **Location**: `src/js/modules/protocol-handler.ts`, `src/js/modules/protocol-message-composer.ts`, `electron/file-manager.ts`, `src/js/pages/archives/protocol-editor.ts`
- **Description**: Bugünkü `if (room === "analyze")` / sabit key yaklaşımını registry tabanlı hale getir. Core protokoller ve room protokolleri aynı kayıt katmanında çözülsün.
- **Complexity**: 8
- **Dependencies**: Task 1.3
- **Acceptance Criteria**:
  - `ProtocolHandler.buildPayload()` hardcoded branchlerden çıkmış olur.
  - Room paketinden gelen protocol key’ler `protocols.json` ile birlikte yönetilebilir.
  - Archives sayfası dinamik protocol key’leri listeleyebilir.
- **Validation**:
  - Core protocol backward-compatibility testleri
  - Dynamic room protocol load/save testleri

### Task 3.2: Add Room Command Registry on Top of ServerCommands
- **Location**: `src/js/modules/server-commands.ts`, `src/js/modules/rooms/room-command-registry.ts`, `src/js/modules/core/whisper-actions.ts`
- **Description**: Mevcut `ServerCommands.register()` kabiliyetini room lifecycle ile bağla. Room install sırasında command tanımları kaydedilsin, uninstall sırasında temizlensin. Sadece runtime handler kaydı değil; dynamic catalog, metadata, scope access, `known command` kontrolü ve disabled-command cleanup akışları da room command’leri tanısın. Room command isimleri namespace’li ve çakışma kontrollü olsun.
- **Complexity**: 7
- **Dependencies**: Task 1.3, Task 2.3
- **Acceptance Criteria**:
  - AI tarafından dönen room-specific `++cmd` komutları yakalanıp ilgili room handler’a düşer.
  - Command name collision install aşamasında reddedilir.
  - `ServerCommands.list()/getCatalog()/has()/check access` zinciri room command’leri bilir.
  - Oda kaldırılınca handler, metadata ve disabled-command kalıntıları temizlenir.
- **Validation**:
  - `CatchManager` -> `handleCaughtCommandWithContext()` -> `ServerCommands.run()` zincir testi
  - Collision ve uninstall testleri

### Task 3.3: Define Room Host Adapter Contract
- **Location**: `shared/rooms.ts`, `src/js/modules/rooms/room-host-runtime.ts`, `docs/room-host-api.md`
- **Description**: Paket içindeki host adapter modülünün kullanacağı sınırlı context API’yi tanımla. Bu context; protocol gönderme, AI’ye mesaj gönderme, room state okuma/yazma, room UI’ye `++cmd` dispatch etme ve logger erişimi sağlamalı. Ayrıca host adapter’ın hangi process/runtime tarafında execute edileceği açıkça seçilip dokümante edilmeli; packaged modda `data/rooms/...` altından güvenli yükleme yolu net olmalı.
- **Complexity**: 7
- **Dependencies**: Task 3.1, Task 3.2
- **Acceptance Criteria**:
  - Room host adapter core modüllere doğrudan import yapmadan çalışabilir.
  - Host adapter loader tarafı (main/preload/renderer sandbox) tek ve net bir karar olarak uygulanır.
  - Room mantığı host extension point üzerinden yürür.
- **Validation**:
  - Contract typing testleri
  - Hello room host adapter smoke testi

### Task 3.4: Add Live Refresh for Install/Remove/Upgrade
- **Location**: `src/js/modules/rooms/room-registry.ts`, `src/js/app/index.ts`, `src/js/app/navigation.ts`
- **Description**: Room install/remove/upgrade işlemlerinden sonra registry, nav, controller ve protocol/command kayıtlarının canlı güncellenmesini sağla.
- **Complexity**: 6
- **Dependencies**: Task 3.2
- **Acceptance Criteria**:
  - Restart olmadan oda görünür/gizlenir.
  - Upgrade sonrası yeni command/protocol sürümü register olur.
- **Validation**:
  - Hot install/uninstall integration testi

### Task 3.5: Define Room Command Wire Format
- **Location**: `shared/rooms.ts`, `docs/room-command-wire-format.md`, `src/js/modules/catch-manager.ts`
- **Description**: Room command argümanları için güvenli bir wire format tanımla. Mevcut regex ve tek-string parser ile uyumlu olacak şekilde JSON-string, compact key-value veya base64-JSON gibi bir format seç ve örnekleri standardize et.
- **Complexity**: 5
- **Dependencies**: Task 1.1
- **Acceptance Criteria**:
  - `XOXSyncState` gibi stateful komutlar parser kırmadan taşınabilir.
  - Room authoring template’i bu formatı varsayılan kullanır.
- **Validation**:
  - Komut parse fixture testleri
  - Uzun/özel karakterli payload testleri

## Sprint 4: XOX Reference Room
**Goal**: Hesaba bağlı AI ile XOX oynanan referans odayı üretmek ve altyapıyı gerçek senaryoda kanıtlamak.
**Demo/Validation**:
- Kullanıcı bir AI slotu bağlar.
- Oyun başlatılırken AI’ye room-specific protocol gönderilir.
- Kullanıcı hamlesi sonrası güncel board state AI’ye iletilir.
- AI’nin `++cmd` hamlesi görsel olarak tahtaya işlenir.

### Task 4.1: Create Room Workspace and Bundle Build Script
- **Location**: `rooms/xox/manifest.json`, `rooms/xox/ui/index.html`, `rooms/xox/ui/index.js`, `rooms/xox/ui/style.css`, `rooms/xox/host/index.js`, `scripts/rooms/build-room-bundle.mjs`
- **Description**: XOX odasını proje kökündeki `rooms/xox/` klasöründe, host uygulamadan bağımsız bir workspace altında geliştir. Bu klasörü kaynak alıp `.hevroom.json` çıktısı üreten build script ekle.
- **Complexity**: 6
- **Dependencies**: Task 1.4, Task 3.3
- **Acceptance Criteria**:
  - `rooms/xox/` klasörü odanın canonical kaynağı olur.
  - XOX oda kaynakları Hayalet Ev ana renderer dosyalarına gömülü kalmaz.
  - Tek komutla bundle üretilebilir.
- **Validation**:
  - Build script smoke testi
  - Bundle validator testi

### Task 4.2: Implement XOX Room State Machine
- **Location**: `rooms/xox/host/index.js`, `rooms/xox/ui/index.js`
- **Description**: Tahta durumu, aktif sıra, kullanıcı sembolü, AI sembolü, bağlı slot, oyun sonucu ve bekleyen hamle durumlarını yöneten room state machine kur.
- **Complexity**: 7
- **Dependencies**: Task 4.1
- **Acceptance Criteria**:
  - Geçersiz kullanıcı hamleleri engellenir.
  - Aynı hücreye ikinci kez oynanamaz.
  - Kazanma/beraberlik durumları tek yerden hesaplanır.
- **Validation**:
  - Saf oyun mantığı unit testleri
  - UI render state smoke testleri

### Task 4.3: Register XOX Protocols and Commands
- **Location**: `rooms/xox/manifest.json`, `rooms/xox/host/index.js`
- **Description**: XOX için room-specific protocol ve command setini tanımla. Önerilen minimum komutlar: `XOXStartGame`, `XOXUserMove`, `XOXAIMove`, `XOXSyncState`, `XOXResetGame`, `XOXShowResult`.
- **Complexity**: 8
- **Dependencies**: Task 4.2, Task 3.2, Task 3.3
- **Acceptance Criteria**:
  - Oyun başlangıcında AI’ye XOX oyun protokolü gönderilir.
  - Kullanıcı hamlesi sonrası AI’ye güncel board prompt’u gider.
  - AI hamlesi `++cmd` olarak döner ve room UI bunu uygular.
- **Validation**:
  - Mock AI cevaplarıyla integration testi
  - Real connected slot smoke testi

### Task 4.4: Add XOX Failure Recovery and Guardrails
- **Location**: `rooms/xox/host/index.js`, `rooms/xox/ui/index.js`, `scripts/tests/xox-room-regressions.test.ts`
- **Description**: Geçersiz AI hamlesi, duplicate reply, disconnect, stale board ve protocol gönderilememesi senaryoları için toparlayıcı akışlar ekle.
- **Complexity**: 7
- **Dependencies**: Task 4.3
- **Acceptance Criteria**:
  - Host stale board veya illegal AI move tespit edebilir.
  - Disconnect sırasında room kullanıcıya net state gösterir.
  - Oyun gerektiğinde `XOXSyncState` ile yeniden hizalanabilir.
- **Validation**:
  - Error-path regresyon testleri
  - AI illegal move fixture testleri

## Sprint 5: Authoring Protocol and Assistant Workflow
**Goal**: Gelecekte yeni oda eklerken asistan AI’nin uygulayacağı net bir room authoring/install protokolü oluşturmak.
**Demo/Validation**:
- Room template ile yeni oda scaffold edilir.
- Room protocol checklist’i izlenerek validator’dan geçen bir paket üretilebilir.
- Asistan için oda ekleme süreci dokümante edilir.

### Task 5.1: Create Room Template and Scaffold Script
- **Location**: `rooms/template/`, `scripts/rooms/create-room.mjs`
- **Description**: Yeni oda oluşturmak için proje kökündeki `rooms/<roomId>/` yapısını üreten bir template üret. Template; manifest, UI, host adapter, protocols, assets ve package config örneklerini içersin. Scaffold script room id ve isim alıp bu yapıyı kopyalasın.
- **Complexity**: 5
- **Dependencies**: Task 4.1
- **Acceptance Criteria**:
  - Yeni oda üretmek manuel kopyalama gerektirmez.
  - Yeni oda doğrudan `rooms/<roomId>/` altında oluşur.
  - Template command/protocol namespace kurallarını içerir.
- **Validation**:
  - Scaffold smoke testi
  - Template bundle validator testi

### Task 5.2: Write Room Addition Protocol for Assistant AI
- **Location**: `.rovo/05-ROOM-PROTOCOL.md`, `AGENTS.md`
- **Description**: Asistan AI’nin yeni oda eklerken izleyeceği kuralları yaz. Maddeler: bağımsız workspace, yalnızca `++cmd` iletişimi, room command namespace, protocol package zorunluluğu, hot import/export, test checklist, rollback.
- **Complexity**: 6
- **Dependencies**: Sprint 1-4 çıktıları
- **Acceptance Criteria**:
  - Yeni oda ekleme işi için canonical bir checklist oluşur.
  - AGENTS.md yalnızca özet/pointer taşır; detay ayrı dokümanda kalır.
- **Validation**:
  - Doküman review
  - Örnek room üretim denemesi

### Task 5.3: Add Room Management UX
- **Location**: `src/pages/server.html`, `src/js/pages/server.ts`, `src/js/modules/rooms/room-management.ts`
- **Description**: Import/export/install/remove işlemleri için ilk yönetim yüzünü ekle. Bu UI minimal olabilir; ana amaç `rooms/` klasöründeki odaları görmek, klasörden install etmek, klasöre export etmek ve gerekirse bundle üretmektir.
- **Complexity**: 6
- **Dependencies**: Task 1.2, Task 3.4
- **Acceptance Criteria**:
  - Kullanıcı `rooms/<roomId>/` klasöründen room install edebilir.
  - Kurulu odaları listeleyebilir ve `rooms/<roomId>/` formatında export edebilir.
  - İsteğe bağlı olarak tek dosya bundle export da alabilir.
- **Validation**:
  - UI smoke testi
  - Import/export round-trip testi

### Task 5.4: Add Room Observability and Rollback Hooks
- **Location**: `src/js/modules/logger/`, `src/js/modules/rooms/room-registry.ts`, `scripts/tests/room-install-rollback-regressions.test.ts`
- **Description**: Install, register, protocol load, command dispatch ve room runtime bridge olaylarını logla. Başarısız install/upgrade durumunda otomatik rollback ekle.
- **Complexity**: 6
- **Dependencies**: Task 3.4, Task 5.3
- **Acceptance Criteria**:
  - Room install hataları izlenebilir olur.
  - Kısmi install sonrası sistem kirli durumda kalmaz.
- **Validation**:
  - Rollback regresyon testleri
  - Log assertion testleri

## Testing Strategy
- Unit:
  - Room schema validation
  - Command/protocol registry behavior
  - XOX oyun state machine
- Integration:
  - Install -> registry refresh -> menu render -> page open
  - AI `++cmd` yakalama -> room command dispatch
  - Protocol save/load with dynamic keys
- UI/Smoke:
  - Hello room runtime mount
  - XOX room basic playthrough
  - Import/export round-trip
- Regression focus:
  - Existing core rooms (`entrance`, `analyze`, `archives`, `server`, `whisper`, `asistan`)
  - Existing analyze relay protocols
  - Existing `CatchManager` regex behavior
  - AI0 catch path (`RelayManager`) ile AI1/AI2 catch path (`ConversationSyncer`) uyumu

## Potential Risks & Gotchas
- Mevcut `CatchManager` ve parser regex’i command isimlerinde tire/nokta desteklemiyor; room namespace buna göre tasarlanmalı.
- `protocols.json` bugün sabit key mantığıyla çalışıyor; dynamic room protocol kayıtları için storage ve save validation mutlaka genellenmeli.
- `page-init.ts` ve `src/index.html` şu an compile-time static; runtime room yükleme için Vite import zincirine güvenilemez.
- Room shell navigation dinamikleştirilebilir, fakat room UI’nin kendisini `pages-container` içine doğrudan gömmek bugünkü MPA/Vite düzeniyle yüksek sürtünmelidir; v1 host olarak webview tercih edilmeli.
- `ServerCommands` erişim kontrolü provider category eksenli; room-origin command’ler için ayrı scope modeli gerekebilir.
- AI0 tarafında `++cmd` yakalama AI1/AI2 gibi doğrudan syncer içinden değil, `RelayManager` özel akışından geçiyor; room komutları AI0 hedefleyecekse iki catch yolunun da desteklenmesi gerekir.
- Mevcut `PageController` sözleşmesinde ortak `dispose/destroy` lifecycle yok; hot room unload için bu eksik kapatılmalı.
- Webview izolasyonu bağımsızlık için iyi, fakat preload yüzeyi ve IPC mesajları fazla geniş bırakılırsa güvenlik açığı doğurur; room bridge dar tutulmalı.
- `ServerCommands.register()` tek başına yeterli değil; katalog, metadata, access control ve uninstall cleanup aynı anda çözülmezse room command’ler yarım entegre kalır.
- Hot room load için nav event binding statik query mantığından delegated/incremental yapıya alınmazsa geç install mevcut DOM’u kırabilir.
- Paketli modda (`app.isPackaged`) path çözümü farklıdır; room asset persistence sadece `data/` ve `config/` altında yapılmalı.
- `rooms/` klasörü geliştirme kaynağı olduğu için runtime install kopyası ile source klasör arasında drift oluşabilir; sync yönü ve overwrite kuralları açık tanımlanmalı.
- Room host adapter’a fazla yetki verilirse “bağımsız ama güvenli değil” bir tasarım oluşur; API yüzeyi dar tutulmalı.

## Rollback Plan
- Room sistemi feature flag ile açılmalı; ilk aşamada core sayfa akışı korunmalı.
- Room registry sorun çıkarırsa dinamik room yükleme devre dışı bırakılıp sadece çekirdek sayfalarla açılış mümkün olmalı.
- Install edilen room paketleri `data/rooms/<roomId>/` altında bağımsız tutulmalı; uninstall ile temiz geri dönüş yapılabilmeli.
- Dynamic protocol migration sorununda core protocol listesi fallback olarak korunmalı.
- XOX room referans paketi kaldırıldığında host uygulama command/protocol registry’sinde dangling kayıt bırakmamalı.
