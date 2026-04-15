# Repair Room Ön Analiz

Tarih: 2026-04-15
Durum: Kod yazılmadan önce mimari ön analiz
Hedef: Hayalet Ev için TS-first, local-first, AI-slot uyumlu yeni bir oda tasarımı

## 1. Executive Summary

`Repair Room`, mevcut repo yapısına en temiz şekilde yeni bir bağımsız oda paketi olarak
oturur: `rooms/repair-room`. Bunu `Laboratory` içine feature olarak eklemek yerine ayrı
oda yapmak daha doğru; çünkü iş akışı medya-analiz değil, canlı cihaz bağlantısı +
snapshot + anotasyon + AI konsültasyon + session arşivleme ekseninde dönüyor.

Repo'da zaten hazır olan ana omurgalar var: room manifest/install/runtime zinciri,
room-local storage, external tool orchestration ve AI slot fan-out. Bu oda bunların
üstüne kurulmalı; primary store olarak global archive DB değil, room-local session
klasörleri kullanılmalı. v1 için en güçlü minimum kapsam: embedded canlı görüntü,
snapshot, vector annotation, AI1/AI2 paralel analiz ve session arşivi.

## 2. Repo Uyum Analizi

Room kontratı ve install zinciri hazır:

- `src/types/room-manifest-types.ts`
- `src/types/room-installed-types.ts`
- `electron/rooms/installed-room-builder.ts`
- `src/js/modules/rooms/room-host-runtime.ts`

Bu zincir fiilen `manifest.json -> InstalledRoomRecord -> room page runtime -> room host runtime`
olarak çalışıyor.

Mevcut reuse adayları iki tarafta çok net:

- `rooms/laboratory/manifest.json` ve `rooms/laboratory/shared/host/project-paths.ts`
  workbench ve room-local storage kalıbını veriyor.
- `rooms/game-room/manifest.json` ve `src/js/modules/commands/slot-bridge.ts`
  room command/protocol/AI slot sınırlarını veriyor.

TS-first oda inşası zaten destekleniyor:

- `electron/rooms/workspace-room-build-support.ts`
- `rooms/tsconfig.rooms.json`
- `package.json` içindeki `rooms:build` ve `rooms:typecheck`

Bu yüzden yeni oda JS ile başlamamalı; doğrudan TS ile kurulmalı.

Repo içindeki iki önemli uyarı:

- `storageNamespace` tip ve validation yüzeyinde var, ama repo genelinde aktif kullanılan
  bir depolama sözleşmesi gibi görünmüyor. Buna güvenilmemeli.
- `src/js/ui/canvas-manager.ts` placeholder. Ortak annotation canvas altyapısı varmış gibi
  davranılmamalı; annotation katmanı room-local tasarlanmalı.

## 3. Önerilen Mimari

Öneri: `Repair Room` bağımsız oda olsun, içinde ilk ve tek ana fonksiyon
`repair-session` olsun.

Oda seviyesi sorumluluklar:

- manifest
- scene entry
- page/runtime shell
- i18n
- tool manifest
- storage root
- AI command/protocol yüzeyi

Ana fonksiyon seviyesi sorumluluklar:

- canlı görüntü
- snapshot
- anotasyon
- AI dispatch
- session lifecycle

Katman ayrımı şu şekilde olmalı:

- Room shell: navigation, scene, page bootstrap, runtime wiring
- Host domain: device connection, capture orchestration, session store, archive/export
- UI domain: live surface, snapshot timeline, annotation editor, AI inspector
- Shared types: session/device/snapshot/annotation/AI result sözleşmeleri
- External integration: `adb`, `scrcpy`, ileride `uvc` veya `ip camera` adapter'ları

Bu oda, mevcut `archive` veya `analyze` sayfalarının uzantısı gibi davranmamalı; ama
onlarla konuşabilecek kadar temiz boundary bırakmalı.

## 4. Yeni Modül / Servis Sınırları

Yeni servisleri ayrı ve küçük tutmak en sağlıklısı:

- `RepairSessionService`: session create/load/update/archive
- `DeviceConnectionService`: USB/wireless pairing, connect/disconnect, device state
- `CaptureService`: active stream, freeze-frame, stream lifecycle
- `SnapshotService`: snapshot asset üretimi ve metadata
- `AnnotationService`: vector annotation CRUD, render/export
- `AiDispatchService`: context packet oluşturma, AI1/AI2 fan-out, result normalize etme
- `RepairArchiveService`: session folder finalization, export manifest, derived previews
- `SafetyPolicyService`: risk flags, operator confirmation gates

Reuse edilmesi gereken mevcut yüzeyler:

- external tool çalıştırma için `src/types/room-tools.ts` ve `electron/room-tool-service.ts`
- AI slot fan-out için `src/js/modules/commands/slot-bridge.ts`,
  `src/js/modules/core-engine.ts`, `src/js/modules/core/send-actions.ts`
- room storage root için `electron/paths.ts`

## 5. Capture Katmanı Kararı

Önerilen karar: hybrid mimari.

- `adb` bağlantı ve pair/connect/disconnect katmanı binary/system-command olarak yönetilsin
- canlı frame akışı ve oda içi render katmanı TypeScript tarafında scrcpy protocol client ile
  çözülsün
- resmi `scrcpy` binary, primary viewer değil; debug veya fallback tool olarak opsiyonel kalsın

Bu kararın gerekçesi:

- Oda içinde gömülü canlı görüntü v1 gereksinimi var
- saf `scrcpy` subprocess modeli doğal olarak ayrı pencere semantiğine yakın
- snapshot alma, frame freeze ve UI overlay senaryoları TS client tarafında daha temiz
  kontrol edilir
- buna rağmen ADB tarafında binary/system-command yönetimi düşük riskli ve platformlar
  arası tutarlı

Wireless için önerilen yaklaşım:

- Android 11+ pairing akışı öncelikli
- eski cihazlar için USB bootstrap + `adb tcpip` fallback
- UI'de paired/unpaired, USB/wireless, `ip:port`, reconnect/disconnect ve forget-state
  görünür olmalı

v1 için düşük riskli capture profili:

- tek aktif cihaz
- tek aktif stream
- video-only
- H.264 default
- audio yok

Capture adapter sınırı ilk günden konmalı:

- `CaptureAdapter`
- `ScrcpyCaptureAdapter`
- ileride `UvcCaptureAdapter`
- ileride `IpCameraCaptureAdapter`

## 6. UI / Annotation Kararı

UI, `Laboratory` gibi dense bir workbench olmalı; ama medya pipeline değil, tamir istasyonu
mantığında.

Önerilen düzen:

- sol panel: cihaz + session özeti + bağlantı durumu
- orta alan: canlı görüntü veya seçili snapshot
- sağ panel: AI sonuçları + risk + notes inspector

v1 interaction kararı:

- canlı görüntü sadece gözlem yüzeyi
- anotasyon yalnızca frozen snapshot üzerinde
- aynı snapshot birden fazla revisable annotation katmanı taşıyabilmeli
- kullanıcı anotasyonu ve AI anotasyonu ayrı katmanlarda tutulmalı

Veri ve render kararı:

- normalized coordinate system zorunlu
- source of truth vector annotation JSON olmalı
- rendered overlay PNG türev artifact olmalı
- AI annotation ile user annotation aynı temel şemayı paylaşmalı ama `authorKind`,
  `sourceJobId`, `confidence` alanlarıyla ayrılmalı

## 7. Session ve Veri Modeli Önerisi

TypeScript-first domain modeli şu çekirdekle kurulmalı:

- `DeviceRecord`: `id`, `connectionType`, `adbSerial`, `brand`, `model`, `serialNumber`,
  `androidVersion`, `notes`
- `RepairSessionRecord`: `id`, `status`, `deviceId`, `symptom`, `operatorNotes`,
  `riskProfile`, `startedAt`, `endedAt`
- `SnapshotRecord`: `id`, `sessionId`, `captureSource`, `assetId`, `width`, `height`,
  `takenAt`, `frameContext`
- `AnnotationRecord`: `id`, `snapshotId`, `tool`, `geometry`, `style`, `text`,
  `authorKind`, `authorSlot`, `confidence`, `createdAt`
- `MeasurementRecord`: `id`, `sessionId`, `kind`, `value`, `unit`, `locationRef`,
  `createdAt`
- `AiJobRecord`: `id`, `sessionId`, `snapshotId`, `targets`, `promptProfile`, `status`,
  `submittedAt`
- `AiResultRecord`: `id`, `jobId`, `slot`, `text`, `suggestedAnnotations`,
  `derivedAssetIds`, `riskFlags`, `followupRequests`
- `RepairEvent`: `type`, `sessionId`, `entityId`, `payload`, `createdAt`
- `AssetDescriptor`: `id`, `kind`, `mimeType`, `path`, `sha256`, `width`, `height`,
  `createdAt`

Local-first storage önerisi:

- primary store dosya sistemi olsun
- root: `data/room-storage/repair-room/sessions/<sessionId>/`
- içerik: `session.json`, `events.jsonl`, `assets/`, `snapshots/`, `ai/`, `exports/`
- hızlı listeleme için oda seviyesinde ince bir `session-index.json` tutulabilir
- global SQLite archive yalnızca AI konuşma ekleri ve cross-room archive için secondary
  surface kalsın

## 8. AI Slot Entegrasyonu

Repo'da aynı payload'ı çoklu hedefe gönderme zaten var; `slot-bridge` attachment varsa
veya hedef sayısı birden fazlaysa batch yoluna geçiyor. Bu yüzden bu oda için yeni bir
parallel send motoru yazmak gerekmiyor.

Önerilen normalize context paketi:

- kısa session özeti
- cihaz özeti
- seçili snapshot asset ref
- seçili annotation listesi
- operatör notu
- risk seviyesi
- istenen cevap modu: `text`, `markup`, `derived-image`, `followup-request`

AI sonucu şu üç formu birlikte desteklemeli:

- `text`
- `suggestedAnnotations[]`
- `derivedAssetIds[]`

`++cmd` sınırı dar olmalı. Güvenli komut ailesi:

- `RepairRoomAddAiAnnotation`
- `RepairRoomRequestCloseup`
- `RepairRoomSetRiskFlag`
- `RepairRoomAppendSessionNote`
- `RepairRoomAskMeasurement`

AI'nin yeni yakın plan istemesi desteklenmeli, ama yalnızca yapılandırılmış
`request-closeup` önerisi olarak. AI doğrudan capture başlatmamalı, bağlantı
değiştirmemeli, session state'i sessizce mutate etmemeli.

## 9. Güvenlik / Risk / Onay Modeli

Bu oda bilgi-yardımcısıdır; repair automation yüzeyi değildir.

Risk sınıfları açık tanımlanmalı:

- `info`
- `caution`
- `high-risk`
- `stop-and-confirm`

Aşağıdaki sınıflar explicit operator acknowledgement istemeli:

- batarya sökme veya açma
- powered-board müdahalesi
- sıcak hava veya havya önerisi
- kısa devre ihtimali
- bilinmeyen bileşene gerilim verilmesi

Wireless ADB için UI'de görünür connection state zorunlu. Session sonunda paired device
state'i korunuyor mu siliniyor mu, bu da görünür karar olmalı.

`Tool inventory` tam sistem olarak v1 için şart değil; ama güvenli öneri filtresi için en
azından opsiyonel `availableTools` metadata alanı bırakılmalı.

## 10. v1 Kapsamı

- TS-first yeni oda paketi ve scene/runtime entegrasyonu
- tek ana fonksiyon: `repair-session`
- tek cihaz, tek session, local-first session klasörü
- USB + wireless device connect/disconnect görünürlüğü
- oda içinde embedded canlı görüntü
- snapshot capture
- annotation araçları: ok, kutu, serbest çizim, metin
- aynı snapshot/context'in AI1 ve AI2'ye paralel gönderimi
- AI text + suggested annotation + returned image kaydı
- session sonunda arşivlenebilir folder export

## 11. v2 Kapsamı

- service manual veya official document lookup
- seri no veya model üzerinden knowledge retrieval
- multi-device karşılaştırma
- UVC veya IP camera adapter'ları
- ölçüm entegrasyonları: multimetre, termal kamera, USB tester
- zaman tabanlı video clip capture ve timeline scrub
- OCR veya component label extraction
- structured tool inventory ve skill-aware AI filtering
- cross-session search ve case similarity
- semi-automatic repair checklist flows

## 12. Yapılmaması Gerekenler

- Bu odayı `Laboratory` içine sıkıştırmak
- JS veya mixed JS/TS ile başlamak
- `archive.db`'yi primary session store yapmak
- anotasyonu yalnızca flatten edilmiş PNG olarak saklamak
- AI'ye geniş yetkili `room.command` açmak
- canlı görüntü stream mantığını React component'lerine gömmek
- `storageNamespace` veya placeholder canvas altyapısına güvenmek
- v1'de service-doc crawler, measurement hardware ve multi-device'ı aynı pakete doldurmak

## 13. Önerilen Klasörleme / Dosya Sınırları

- `rooms/repair-room/manifest.json`
- `rooms/repair-room/i18n/*`
- `rooms/repair-room/ui/index.html`
- `rooms/repair-room/ui/index.ts`
- `rooms/repair-room/ui/repair-room-ui-runtime.ts`
- `rooms/repair-room/ui/panels/*`
- `rooms/repair-room/ui/annotation/*`
- `rooms/repair-room/host/index.ts`
- `rooms/repair-room/host/runtime.ts`
- `rooms/repair-room/host/session-runtime.ts`
- `rooms/repair-room/host/capture-runtime.ts`
- `rooms/repair-room/host/device-connection-runtime.ts`
- `rooms/repair-room/host/ai-runtime.ts`
- `rooms/repair-room/host/archive-runtime.ts`
- `rooms/repair-room/shared/types/*`
- `rooms/repair-room/shared/host/*`
- `rooms/repair-room/shared/ui/*`
- `rooms/repair-room/shared/data/tools/toolchain.manifest.json`
- `rooms/repair-room/main-functions/repair-session/protocols/*`
- `rooms/repair-room/main-functions/repair-session/assets/*`

## 14. Codex'in Bir Sonraki Aşamada Sorması Gereken Kritik Teknik Sorular

- Embedded canlı görüntü v1'de kesin zorunlu mu, yoksa geçici external viewer fallback kabul
  edilir mi?
- Kamera kaynağı yalnızca Android kamera mı olacak, yoksa screen mirroring de desteklenecek mi?
- Wireless hedefi Android 11+ pairing akışı mı, yoksa Android 10 ve altı için de resmi destek
  beklenecek mi?
- v1'de tek aktif cihaz sınırı kabul ediliyor mu?
- AI çıktısı için canonical cevap formatı ne olacak: serbest metin mi, yapılandırılmış JSON mu,
  ikisi birden mi?
- AI'nin döndürdüğü annotation'lar otomatik uygulanacak mı, yoksa `review then apply` mi olacak?
- Session arşivi insan okunur klasör olarak mı, yoksa app içi queryable indeks olarak mı
  önceliklenecek?
- Tool inventory v1'de güvenlik için gerekli mi, yoksa opsiyonel metadata yeterli mi?
- H.265 veya HEVC istemi var mı; yoksa Windows uyumluluğu için H.264'e sabit kalınabilir mi?

## 15. Sonuç ve Önerilen Uygulama Sırası

En sağlıklı yol, `Repair Room`'u bağımsız ve TS-first bir room package olarak açmak;
`Laboratory`'den workbench/storage kalıplarını, `Game Room`'dan AI/protocol sınırlarını
ödünç almak. Capture tarafında en temiz çözüm hybrid: `adb` host yönetimi binary/system-command,
embedded görüntü ve snapshot hattı TS scrcpy client.

Önerilen sıra:

1. v1 gereksinim kontratını netleştir: embedded feed, wireless matrix, AI response format
2. room manifest + feature/protocol/command sınırlarını tanımla
3. session/storage/annotation tiplerini finalize et
4. capture adapter kararını kilitle ve version pin planı çıkar
5. live view + snapshot pipeline kur
6. annotation model + renderer kur
7. AI1/AI2 normalize packet ve result mapping ekle
8. archive/export ve risk gating tamamla
9. room/page/tool/protocol regression setlerini ekle

## Repo Referansları

Bu analiz hazırlanırken özellikle şu dosya ve yüzeyler baz alındı:

- `src/types/room-manifest-types.ts`
- `src/types/room-installed-types.ts`
- `electron/rooms/installed-room-builder.ts`
- `src/js/modules/rooms/room-host-runtime.ts`
- `src/js/modules/commands/slot-bridge.ts`
- `src/js/modules/core/send-actions.ts`
- `src/js/modules/core-engine.ts`
- `electron/room-tool-service.ts`
- `electron/paths.ts`
- `rooms/laboratory/manifest.json`
- `rooms/laboratory/shared/host/project-paths.ts`
- `rooms/game-room/manifest.json`
- `electron/rooms/workspace-room-build-support.ts`
- `rooms/tsconfig.rooms.json`
- `src/js/ui/canvas-manager.ts`
