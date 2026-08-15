# 🔧 Repair Room

Repair Room, Hayalet Ev içinde elektronik onarım çalışmalarını tek bir oturumda tutan oda tabanlı bir çalışma tezgâhıdır.

Amaç yalnızca bir PCB görüntüsüne bakmak veya AI'ya soru sormak değildir. Cihaz bilgisi, semptomlar, araştırma kaynakları, ölçümler, görsel işaretler, riskler, konuşma geçmişi ve onarım zaman çizgisini aynı proje bağlamında birleştirmektir.

## Güncel Kapsam

`repair-workbench` güncel manifestte aktif özellik yüzeyidir.

Workbench bugün şu alanları aynı oturumda yönetir:

- repair session oluşturma, seçme, güncelleme, arşivleme ve silme,
- cihaz bilgisi, semptom ve risk seviyesi,
- Assistant AI destekli evidence araştırması,
- schematic, board image, datasheet, thread ve not gibi knowledge kaynakları,
- common failure ve test-point kayıtları,
- PCB/kamera çalışma alanı,
- annotation, measurement, freeze-frame ve overlay araçları,
- timeline event ve scrub/focus akışları,
- AI chat ve hedef AI slotu seçimi,
- operator profile ve novice/advanced çalışma yoğunluğu,
- dictation, ambient listening ve TTS tercihleri,
- Android Companion kamera, photo capture ve torch kontrolleri,
- spatial/investigation overlay ve knowledge-region odaklama akışları.

Bu yüzeylerin bazıları bağlı AI slotu, Android Companion veya merkezi capture/TTS runtime gibi dış çalışma bileşenleri gerektirir.

## Repair Session

Repair Room her çalışmayı bir session olarak ele alır.

Session içinde örneğin şu bağlam korunabilir:

- cihaz/board kimliği,
- bildirilen semptomlar,
- risk seviyesi,
- seçili evidence ve knowledge pack,
- ölçümler,
- annotation ve AI mark olayları,
- timeline kayıtları,
- sohbet bağlamı,
- operator çalışma tercihleri.

Amaç onarım sürecinin bir dizi kopuk ekran görüntüsü veya sohbet mesajına dönüşmesini önlemektir.

## Evidence ve Knowledge Pack

Yeni session akışı Assistant AI ile evidence araştırması başlatabilir veya kullanıcı bu adımı atlayabilir.

Knowledge katmanı şu tür bilgileri session'a bağlayabilir:

- schematic,
- board image,
- datasheet,
- forum/thread kaynağı,
- operator notu,
- bilinen/common failure,
- rail veya probe/test point.

Kullanıcı hangi evidence parçalarının arşive gireceğini seçebilir, kendi kaynaklarını ekleyebilir ve gereksiz öğeleri çıkarabilir.

Bu yapı AI araştırmasını son karar yerine **kanıt paketi** olarak ele alır.

## PCB / Kamera Workbench

Workbench canlı veya sabitlenmiş board görüntüsü üzerinde çalışmak üzere tasarlanmıştır.

Mevcut komut yüzeyi:

- aktif aracı seçme,
- freeze-frame açma/kapatma,
- grid, AI mark, annotation ve pin gibi overlay katmanlarını açma/kapatma,
- viewport zoom/pan durumunu güncelleme,
- investigation entity/region odaklama,
- live edge'e geri dönme

gibi davranışları destekler.

Android Companion bağlıysa telefon kamerası Repair Room için capture kaynağı olarak kullanılabilir.

## Measurement ve Timeline

Ölçüm sonucu yalnızca ekranda görünen geçici sayı değildir; aktif session'a kayıt olarak eklenebilir.

Timeline katmanı annotation, measurement, note, AI mark veya risk flag gibi yapılandırılmış olayları taşıyabilir. Kullanıcı belirli bir olaya atlayabilir veya timeline üzerinde zaman aralığını/scrub konumunu değiştirebilir.

Bu yaklaşım özellikle uzun onarım çalışmalarında “hangi ölçüm ne zaman ve hangi görsel bağlamda alındı?” sorusunu cevaplanabilir tutmayı hedefler.

## Assistant AI

Repair Room Assistant akışları tek bir genel prompt yerine ayrı protokol görevlerine bölünmüştür.

Manifestteki mevcut protokoller:

- `repair-room-assistant-evidence` — evidence araştırması,
- `repair-room-assistant-observation` — gözlem/çalışma alanı yorumu,
- `repair-room-assistant-chat` — session-bound sohbet,
- `repair-room-assistant-risk-scan` — risk taraması.

Workbench içinden hedef AI slotu seçilebilir ve sohbet turn'leri session bağlamında tutulabilir.

AI çıktısı ölçümün veya operatör kararının yerine geçmez; çalışma bağlamına eklenen bir yardımcı katman olarak ele alınır.

## Hands-free Kullanım

Repair Room, ellerin meşgul olduğu çalışma senaryoları için merkezi capture runtime ile entegre olabilir.

Desteklenen kontrol yüzeyleri arasında:

- dictation başlatma/durdurma,
- ambient listener başlatma/durdurma,
- TTS guidance başlatma/durdurma,
- kamera feed başlatma/durdurma,
- photo capture,
- camera torch kontrolü

bulunur.

Room ayrıca AI interruption/attention budget gibi sakin rehberlik tercihlerini session/workbench ayarlarında tutabilir.

## Operator Profile

Repair Room her kullanıcıyı aynı ekipmana ve deneyime sahip varsaymaz.

Operator profile ve operational density ayarları;

- araçlar,
- beceriler,
- çalışma tercihleri,
- novice/advanced görünüm yoğunluğu,
- hands-free tercihleri

gibi bilgilerin workbench davranışına bağlanmasına izin verir.

## Spatial Investigation

Investigation mode, overlay üzerindeki semantik entity ve region'ları komutla odaklanabilir hale getiren çalışma katmanıdır.

Knowledge pack içindeki spatial reference geçici olarak odaklanabilir veya canonical investigation region event'e dönüştürülebilir. Amaç bilgi kartları ile board üzerindeki fiziksel bölge arasındaki ilişkiyi kaybetmemektir.

## Room Boundary

Repair Room kaynak kodunun sahibi `rooms/repair-room` ağacıdır.

- `manifest.json` feature, command ve protocol kontratlarını tanımlar.
- `host/` oda host runtime'ını kurar.
- `main-functions/` workbench'e ait protokol ve domain parçalarını taşır.
- `shared/` room-local ortak tip/yardımcı/asset katmanıdır.
- `ui/` workbench kullanıcı yüzeyini taşır.
- `i18n/` Repair Room'a ait çevirileri tutar.

Core, Repair Room'un iş mantığını sahiplenmemelidir. Oda core ile desteklenen room/SlotBridge/command sınırları üzerinden konuşmalıdır.

## Doğrulama

Room değişikliklerinden sonra en azından room typecheck/test yüzeylerini ve tam repository kalite kapısını çalıştırın:

```bash
npm run rooms:typecheck
npm run rooms:test
npm run check:all
```

## Amaç

Repair Room'un hedefi “AI ile cihaz tamir etmek” gibi tek cümlelik bir otomasyon değildir.

Hedef; operatörün gözlemini, gerçek ölçümleri, kaynak/evidence bilgisini ve AI desteğini birbirinin yerine koymadan aynı onarım günlüğünde birleştirmektir.

> AI önerir, ölçüm doğrular, operatör karar verir; session bütün izi saklar.
