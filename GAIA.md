# Gaia Room

> **Durum** — 02-B/1 Linux kapsamında, 02-B/2 gerçek arazi kullanımıyla kabul edildi. 02-C günlük cihaz yönetimi Linux kapsamında kabul edildi. Sıradaki 02-D kapanış denetimi. [Gaia mimari kontratları](GAIA-ARCHITECTURE.md)

Referans uygulama commit'i: `d0e47947` (Hayalet Ev 5.4.0). Bu belge Gaia için mimari karar, proje hafızası, araştırma özeti, açık konular ve geliştirme planının tek başlangıç kaynağıdır. Hayalet Ev’de Gaia projeleri Genel Görünüm’de açılır ve Modelleme Atölyesi’nde düzenlenir.

## 1. Vizyon ve kapsam

Gaia Room kullanıcının fiziksel yaşam alanını modellemesini, elindeki donanımlarla gözlemlemesini, yönetmesini ve AI ile analiz etmesini sağlayan bağımsız, local-first bir odadır. Bir ev, sera, bahçe, kümes, atölye veya çok yapılı arazi aynı genel modelle temsil edilir. İlk gerçek saha kendi arazimizdir; hiçbir adres, arazi, mesafe, cihaz markası veya telefon modeli uygulamaya sabitlenmez.

Kullanıcı CAD, elektronik veya yazılım mühendisliği bilmek zorunda kalmamalı. Hazır ve doğrulanmış UI davranışları tercih edilir; gelişmiş ayrıntılar gerektiğinde açılır. İlk çalışan sürüm hiçbir fiziksel cihaz olmadan da yararlı olmalıdır.

Teknik adlar: `gaia-room`, `gaia-client`, `gaia-router`; ortak saha kontratı için çalışma adı `gaia-protocol`. Bunlar paket/klasör yapısının henüz uygulandığı anlamına gelmez.

## 2. Mimari sınırlar (kabul edilen kararlar)

- Gaia Room kendi mekânsal domain'inin, cihaz ilişkilerinin, gözlem kayıtlarının ve otomasyon kurallarının sahibidir. Hayalet Ev merkezi yönetim otoritesi ve ortak capability sağlayıcısıdır.
- Oda diğer odaların kurulu olmasına, kaynaklarına, runtime'ına veya veritabanlarına bağımlı olmayacak. Repair Room, Laboratory ve Game Room örnek teşkil eder; çalışma zamanı bağımlılığı oluşturmaz. Core da Gaia kimliğine özel domain davranışı edinmemeli.
- Genel bir ihtiyaç gerçekten ortaya çıkarsa mevcut Room Registry / Room Tools / SlotBridge üzerinden, oda kimliğine değil sürümlü capability kontratına dayalı, isteğe bağlı paylaşım mekanizması değerlendirilir. Sağlayıcı yoksa tüketici oda normal çalışır; keşif, izin, geçerlilik ve hata davranışı açık olur. Şimdilik yeni registry, event bus veya odalar arası entegrasyon geliştirilmeyecek.
- Gaia Client bağımsız uç yazılımıdır; sensör, kamera, ses ve gerektiğinde aktüatör yeteneklerini ilan eder. Gaia Router ayrı ağ geçidi yazılımıdır; doğrudan Client bağlantısı da mümkündür. Router'ın Android üzerinde fiziksel repeater/mesh olabilmesi araştırma konusudur.
- Mevcut Android Companion mobil kurulum ve yönetim yardımcısıdır; Client veya Router yerine geçmez ve sürekli bağlı olması gerekmez.
- UI yaşam döngüsü fiziksel görev yaşam döngüsünden ayrılır. Oda gizlenince grafik ve UI abonelikleri durur; yetkili otomasyon, gerektiğinde ekran kapalıyken de çalışır. Hayalet Ev kapalıyken saha güvenliği Client/Router veya fiziksel kontrol katmanının sorumluluğudur.
- Fiziksel komutlar AI çıktısına veya renderer'a doğrudan teslim edilmez. Dar yetki sınırı, deterministik doğrulama ve saha güvenlik kuralları gerekir.

### Capability ağacı

| Capability   | Sorumluluk                                                                                 |
| ------------ | ------------------------------------------------------------------------------------------ |
| Spatial      | Metrik dünya modeli, geometriler, hiyerarşi, kalibrasyon, ölçüm, editör/viewer adaptörleri |
| Devices      | Fiziksel/sanal cihaz kimliği, yetenekler, mekânsal bağlantılar, donanım profilleri         |
| Connectivity | Eşleme, kimlik doğrulama, transport, ağ topolojisi, RSSI ve bağlantı durumu                |
| Telemetry    | Zaman damgalı ölçümler, gözlem, kamera/ses, durum ve geçmiş                                |
| Automation   | Kurallar, zamanlama, komut/teyit, yerel güvenlik, manuel durdurma                          |
| Intelligence | AI0/AI1 üzerinden seçilmiş bağlam, analiz ve doğal dil; yetkili araç sınırı                |

Bunlar mantıksal değişim eksenleridir; ayrı servis veya sürekli çalışan süreç anlamına gelmez. Sağlayıcı, transport, grafik motoru ve persistence değişimleri kendi adaptör sınırlarında tutulur.

## 3. Mevcut Hayalet Ev yetenekleri

01-A incelemesi `d0e47947` üzerinde salt okunur yapıldı. Kullanıcı TTS, STT, Companion kamera yönetimi, AI1'e LLM hesabı atama ve kurulu bir yerel LLM olduğunu doğruladı. Kod incelemesinde ayrıca wake word, capture, scrcpy, ADB, Room Tools, Operations Service, AI0, tema/i18n, oda paketleme ve komut kontratları bulundu.

| Alan              | Referans ve sınır                                                                                                                                        |
| ----------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Room host         | `src/js/modules/rooms/room-host-runtime.ts`, `rooms/README.md`, `.rovo/slot-bridge-contract.md`; mevcut oda API'si kullanılmalı                          |
| Kamera, STT/TTS   | `electron/capture-service.ts`, `electron/capture/`, `ANDROIDCOMPANION.md`; mevcut USB capture yeniden kullanılabilir, çoklu bağımsız oturum kanıtlanmadı |
| Kaynak sahipliği  | `electron/operations-service.ts`, `electron/room-tool-service.ts`; mevcut kilit capability bazlı, fiziksel yetki veya cihaz bazlı oturum garantisi değil |
| AI                | `electron/ai0/runtime-host.ts`, `shared/ai0-runtime.ts`, `docs/ai0-runtime.md`; AI1 yerel LLM deneyi ile AI0 görev çağrıları ayrı değerlendirilecek      |
| Oda yaşam döngüsü | `src/js/pages/room-page.ts`, `src/js/app/navigation.ts`; gizleme/dispose davranışı özellikle doğrulanmalı                                                |
| Grafik            | Yahtzee Babylon.js, Repair Konva örnekleri; Gaia bunları diğer odalardan import etmeyecek                                                                |
| Saklama           | `electron/paths.ts`, `rooms/README.md`; oda source/runtime/storage ayrımı korunacak                                                                      |
| Relay / US1       | İnsan ve AI iletişimi için mevcut; saha telemetrisi/komut transportu olarak otomatik benimsenmeyecek                                                     |

OpenCode'un localhost üzerinde çalışması model çıkarımının yerel olduğunu kanıtlamaz. Local-only seçildiğinde bulut modele sessiz fallback olmamalı. Mevcut Companion HTTP köprüsü ADB reverse/localhost için tasarlanmıştır; LAN'a doğrudan açılmayacak. Merkezi kalıcı otomasyon zamanlayıcısının hazır olduğu doğrulanmadı.

## 4. Mekânsal model ve UI

Gaia kanonik veri otoritesidir. Editör ve viewer yalnızca projeksiyon/adaptör tüketicileridir. Koordinat, geometri ve ilişkilerin başlangıç şeması [GAIA-ARCHITECTURE.md](GAIA-ARCHITECTURE.md) içinde; çalışma zamanı kabulü 02-A'da.

- Yerel metre cinsinden gerçek X/Y/Z; Z yükseklik ve negatif Z derinlik. Eksen yönü, orijin, rotasyon ve renderer dönüşümleri kontratta açıkça tanımlanır.
- Arazi → yapı → kat/bölge → nesne hiyerarşisi; birden fazla bağımsız yapı, yer altı nesneleri, bağımsız konumlar, boyutlar, ilişkiler ve üç boyutlu altyapı hatları.
- Kalıcı kimlikler; fiziksel cihaz ile mekânsal yer tutucu ayrı. Cihaz değişse bile mekân modeli anlamlı kalır.
- Uydu görüntüsü/kroki isteğe bağlı referans katmanıdır. İki nokta ve bilinen mesafeyle ölçekleme, hizalama/döndürme ve kalıcı dönüşüm; görsel yokken de model çalışır. Gerçek konum/georeferans opsiyonel; ölçülen, tahmin edilen ve hesaplanan veri ayrılır.
- Yatay mesafe, doğrudan 3D mesafe ve hat güzergâhı uzunluğu ayrı anlamlara sahiptir. RSSI mesafeden uydurulmaz, cihazdan ölçülür.
- Basit parametrik geometriler ve nesne şablonları; 2D, hafif izometrik/2.5D ve isteğe bağlı orbit 3D aynı veriyi kullanır. Yer altı/kat görünürlüğü, kesit veya şeffaflık gerçek ihtiyaca göre.
- Editörün tanımadığı Gaia semantiği (cihaz yeteneği, kapasite, bağlantılar, kimlikler) editör kaydetmesinde kaybolmaz. Düzenleme değişikliği açık eşleme ile yalnız ilgili alanlara uygulanır; silme ve ilişki değişiklikleri doğrulanır.
- İlk saklama için sürümlü küçük proje kaydı ve ayrı medya varlıkları yeterli; hacim ve sorgu gereksinimi doğarsa Gaia'ya ait SQLite değerlendirilir. Oda paketi kullanıcı projesinin otoritesi değildir.

İlk UI iki çalışma biçiminden oluşur: **Genel Görünüm** (arazi → yapı → kat/bölge → cihaz; günlük durum ve gerektiğinde ayrıntı) ve **Modelleme Atölyesi** (referans, çizim, seçim, taşıma, ölçüm, katman, undo/redo). Boş gelecek sekmeleri eklenmez. Cihaz ve otomasyon yönetimi ilgili milestone'da açılır. Grafik motoru ihtiyaç halinde yüklenir, görünüm gizlenirken render durdurulur, kapatılırken kaynaklar bırakılır. Gelişmiş görsel efektler zorunlu değildir.

## 5. Açık kaynak araştırması ve teknoloji kararı

01-B, 01-B2 ve 01-B3 sonucunda **OpenPlan3D + Three.js koşullu ilk seçim**; NextFloor günlük yönetim UI'si ve kalibrasyon referansı, Pascal alternatif adaydır. Gaia dağıtımı mevcut diğer odalara veya Home Assistant'a bağlı olmayacak.

| Aday                                                                 | Lisans ve rol                                  | Bulgular                                                                                                                                           |
| -------------------------------------------------------------------- | ---------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| [OpenPlan3D](https://github.com/laanlabs/openPlan3D)                 | MIT; SvelteKit/Canvas/Three.js; editör adayı   | Yerel çizim ve 3D açıldı; üç kotlu JSON round-trip test edildi. Kat merkezli şema için Gaia adaptörü gerekli.                                      |
| [Pascal](https://github.com/pascalorg/editor)                        | MIT; React/Three.js/Fiber; alternatif          | Ayrı viewer çalıştı; editor menüleri uyarlamayla açıldı, tam çizim/kayıt turu tamamlanmadı. Singleton ve uzak varlık/decoder yolları açık maliyet. |
| [NextFloor](https://github.com/therealMRBK/NextFloor)                | MIT; Lit/Three.js; UI ve kalibrasyon referansı | Mock demo ve editör açıldı. Home Assistant bağımlılığı taşınmayacak. Saf kalibrasyon fonksiyonları dar yeniden kullanım adayı.                     |
| [NeonPlan 3D](https://github.com/Mastershort/neonplan3d)             | MIT çekirdek; ayrı ücretli içerikler           | Mock 3D açıldı, editör turu tamamlanmadı. Kat/oda yönetimi için referans.                                                                          |
| [Easy Floorplan](https://github.com/nicosandller/easy-floorplan)     | MIT; SVG/Lit                                   | İki nokta kalibrasyonu ve hafif yönetim yaklaşımı; yerel UI testi yapılmadı.                                                                       |
| [Open Garden Planner](https://github.com/cofade/open-garden-planner) | GPL-3.0; yalnız UX referansı                   | Arazi, bahçe, kroki ve ölçeklendirme. Kaynak kodu Gaia'ya aktarılmayacak.                                                                          |

Diğer araştırma referansları: farmOS, Home Assistant/ESPHome, MQTT, RTSP/ONVIF, Modbus, CROP, FarmscapeOS ve OpenRemote. Bunlar seçilmiş bağımlılıklar değildir. Gerçek cihaz ihtiyacı, lisans ve bağımsız çalışma koşulu ortaya çıktığında tekrar değerlendirilebilir.

### 01-B2 doğrulanmış deneyler

- OpenPlan3D: iki bağımsız yapı ayak izi, -3/0/+3 m katlar, üç yükseklikte cihaz yer tutucusu içe alındı. Proje adı düzenlendi, kaydedildi, yeniden açıldı ve JSON dışa aktarıldı. Test edilen kimlikler, koordinatlar ve kotlar korundu. 40 × 60 m sınır ve ölçeği önceden atanmış sentetik görsel kullanıldı. Depo mobilya, hat not olarak temsil edildi; gerçek domain türleri değildir. UI kalibrasyonu ve kapsamlı geometri düzenleme round-trip'i doğrulanmadı.
- OpenPlan3D dış ağ engelliyken kayıt ve 3D açılışı, Electron 43.3.0 / Chromium 150 WebGL 2 çalışması doğrulandı. Bağımsız viewer, gizlenme ve tam kaynak temizliği doğrulanmadı. Firebase/Analytics başlangıç istekleri gözlendi.
- Pascal ayrı salt okunur viewer, örnek ev sahnesi ve WebGL fallback çalıştı; WebGPU cihazı bulunamadı. Dış ağ engelliyken temel geometri açıldı, eksik yerel dokular yüklenmedi. Tam editör kayıt turu ve Gaia fixture'ı tamamlanmadı. Unmount sonrası canvas kaldırıldı; gizleme sırasında render durduğu kanıtlanmadı.
- Performans: 1280 × 720 gizli Electron penceresinde, farklı sahnelerle tek örnek renderer working set yaklaşık 182 MB (OpenPlan3D boş 3D) ve 273 MB (Pascal örnek viewer). CPU boşta %0 ve %0,62; GPU süreç working set yaklaşık 161 ve 183 MB. Bunlar eşit sahne benchmark'ı değildir; GPU kullanım yüzdesi/VRAM ölçülmedi. Kaynak üstünlüğü çıkarılamaz.
- Araştırma kopyaları ve ekran görüntüleri `/tmp/gaia-editor-research/` altında üretildi; geçici ve repo dışında, kalıcı kaynak veya dağıtım girdisi değil. Deney sunucuları kapatıldı, repo değişmedi.

### 01-B3 — Pascal son fizibilite deneyi

- Pascal 1.1.6 resmi Next.js editör host'u ve MCP servisi izole geçici veri dizininde çalıştı. Çizim, kat, ölçüm, seçim, 2D/3D ve gezinme kontrolleri görünür oldu; etkileşimli davranışları doğrulanmadı.
- MCP ile 40 × 60 m arazi sınırı, farklı kotlarda ev alanları, sera ve kümes oda geometrileri oluşturuldu ve otomatik kayıt sonrası yeniden yüklendi. Sera/kümes bağımsız building düğümleri değildi; evde başlangıçtan kalan ek katlar vardı. Açık save_scene checkpoint çağrıları kimlik ve version_conflict nedeniyle reddedildi. Otomatik kalıcılık, editör UI düzenleme–kayıt–yeniden açma kabulünün yerine geçmez.
- Site → building → level hiyerarşisi, bağımsız viewer ve özel düğüm/panel eklenti mekanizması kaynak ve belgelerde doğrulandı. Tek aktif sahne singleton sınırı sürüyor. Özel cihaz düğümü/paneli, harici durum güncellemesi, negatif kotlu depo, bağımsız yapıların tam sahnesi, kesit/odaklanma ve aynı sahnenin ayrı viewer'da açılması test edilmedi.
- İlk resmi host kurulumu 127,6 MB runtime indirdi. Kurulu resmi host'un tam çevrimdışı çalışması ve eşit sahneli Electron performans karşılaştırması yapılmadı. Bu miktar kurulu uygulamanın RAM tüketimi değildir. Transitif lisans/varlık denetimi iki adayda da tamamlanmadı.
- Karar: OpenPlan3D + Three.js ilk uygulama için koşullu olarak korunur. Pascal'ın mimari avantajları geçerlidir ancak mevcut kanıtlar teknoloji değişikliği veya kesin performans/bakım üstünlüğü ilan etmek için yeterli değildir. Araştırma bu noktada kapanır; Pascal yalnız 02-A kabul koşullarında belirlenen vazgeçme nedenlerinden biri somut olarak gerçekleşirse yeniden değerlendirilir. Yeni bağımlılık veya kod eklenmedi; deney servisleri kapatıldı ve araştırma sırasında repo temiz kaldı.

### Uygulama koşulları

OpenPlan3D seçimi hazır editörün yeniden kullanımını hedefler; sırf kütüphane seçilmiş diye bütün çizim araçlarını tekrar yazmayız. Upstream sürüm/commit sabitlenmeli, değişiklik sınırı ve üçüncü taraf bildirimleri tutulmalı. Gaia bağımsız yönetim viewer'ının nasıl oluşturulacağı uygulamada doğrulanacak; mevcut OpenPlan3D viewer API'sinin bağımsız paket olduğu varsayılmayacak. NextFloor'un [kalibrasyon matematiği](https://github.com/therealMRBK/NextFloor/blob/main/frontend/src/components/editor/ops/background.ts) incelenmiş, kod henüz aktarılmamıştır. Pascal [viewer kontratı](https://github.com/pascalorg/editor/blob/main/packages/viewer/README.md) alternatif için referanstır.

Vazgeçme koşulları: kimlik/kat/ilişki kaybı, Gaia'nın tanınmayan alanlarının kaybı, günlük viewer'ın editöre aşırı bağımlılığı, kabul edilemez kaynak kullanımı veya local-first/lisans koşulunun karşılanamaması. Bunlardan biri gerçekleşirse Pascal'ın referans host'unda tam kayıt turu ve eşit sahne testi ile yeniden değerlendir. Yeni geniş aday araştırması planlanmıyor.

## 6. Donanım envanteri

| Cihaz                   | Bilinen durum                                                                             | İlk olası rol                              |
| ----------------------- | ----------------------------------------------------------------------------------------- | ------------------------------------------ |
| Kişisel Samsung J7      | Rootlu LineageOS, sürekli USB bağlı; kişisel veriler korunacak                            | Companion yönetim ve mevcut capture deneyi |
| Samsung SM-J701F        | Ekran arızalı; scrcpy ve kamera çalışıyor                                                 | Gelişmiş Client adayı                      |
| Beyaz Samsung GT-I8200Q | Android 4.2.2/API 17; harici beslemeyle açıldı, yalnız güç bağlantısı; USB veri tanınmadı | Düşük kaynaklı Client deneyi               |
| Siyah Samsung GT-I8200Q | Açılır durumda, kamera durumu belirsiz                                                    | İkinci düşük kaynaklı Client/ağ deneyi     |
| Sony Xperia             | Tepkisiz; kesin model belirsiz                                                            | İsteğe bağlı donanım kurtarma deneyi       |

Bunlar kesin görev atamaları değildir. Mevcut Companion minSdk 28 olduğundan API 17 cihazlar ayrı Client fizibilitesi gerektirir; eski Android tüm mimarinin zorunlu hedefi değildir. Root, kamera, mikrofon, ekran kapalı çalışma, yeniden başlatma, Wi-Fi, enerji, sıcaklık ve güvenli taşıma gerçek cihazda doğrulanacak.

Harici besleme devresi ve gerilim/akım ölçülmeden uzun süreli kullanım onaylanmış sayılmaz. Eski Android cihazlar internetten izole edilir; kişisel telefonun verileri ve mevcut işlevleri korunur. Donanım deneyleri yazılım milestone'larını bloke etmemeli.

## 7. Saha verisi ve güvenlik ilkeleri

Gözlem: cihaz/yetenek kimliği, zaman damgası, birim, kaynak, kalite ve tazelik; son bilinen değer canlı ölçüm gibi gösterilmez. Talep edilen durum, komut sonucu ve ölçülen fiziksel durum ayrıdır.

Fiziksel kontrol öncesi komut yetkisi, izinli eylem, önkoşul, süre sonu, idempotency/tekrar teslim, cihaz teyidi, manuel durdurma, bağlantı kaybı, yeniden başlatma ve cihaza uygun güvenli durum simülasyonla sınanır. Yerel fiziksel güvenlik AI veya merkezi bağlantıya bağlı değildir. Şebeke elektriği ve pompa/vanalarda uygun koruma ve donanım doğrulaması gerekir. AI önerisi deterministik yetki ve kural katmanını atlayamaz.

LAN protokolü, eşleme/kimlik doğrulama ve iletişim güvenliği Client deneyinde seçilecek. MQTT, Matter veya diğer protokoller önceden zorunlu tutulmaz. Kamera ve ses açıkça etkinleştirilen görevlerde kullanılır; saklama ve paylaşım tercihi kullanıcıya aittir.

## 8. Milestone planı ve mevcut durum

| Milestone  | Durum                               | Çıkış kriteri                                                                               |
| ---------- | ----------------------------------- | ------------------------------------------------------------------------------------------- |
| 00         | Tamamlandı                          | Temiz referans repo; full check 1962 pass / 0 fail / 2 skipped, Fate Knots 282 CSS baseline |
| 01-A       | Tamamlandı                          | Mevcut mimarinin salt okunur keşfi                                                          |
| 01-B/B2/B3 | Tamamlandı (koşullu seçim)          | Açık kaynak/UI araştırması ve yerel fizibilite; eksikler 02-A kabul koşulu                  |
| 01-C       | Tamamlandı                          | Kanonik şema, koordinat/kimlik/ilişki kuralları, editör/viewer kontratları ve fixture       |
| 01-D       | Tamamlandı (P0 kontratları işlendi) | Bağımsız mimari audit, agent dağılımı ve ilk uygulama planı                                 |
| 02-A       | Tamamlandı (Linux)                  | İlk çalışan bağımsız oda, yerel editör ve günlük viewer sınırı; kayıpsız round-trip         |
| 02-B       | 02-B/1 ve 02-B/2 kabul              | Modelleme Atölyesi, kalibrasyon, düzenleme ve ölçüm                                         |
| 02-C       | Tamamlandı (Linux)                  | Günlük genel görünüm, hiyerarşik gezinme ve sanal cihazlar                                  |
| 02-D       | Sıradaki                            | Kullanılabilirlik, performans, paket/lisans ve mimari audit                                 |
| 03         | Bekliyor                            | Bağımsız Client, gerçek/sanal gözlem ve cihaz yetenekleri                                   |
| 04         | Bekliyor                            | Router, saha ağı ve Companion yönetimi                                                      |
| 05         | Bekliyor                            | Elektronik ve deterministik otomasyon; güvenli test düzeneği                                |
| 06         | Bekliyor                            | Yerel AI0/AI1 entegrasyonu; doğrulanmış araçlar ve kaynak tüketimi                          |
| 07         | Bekliyor                            | Gerçek saha ve uzun süreli çalışma; veri koruma dönemine geçiş değerlendirmesi              |

### 02-A kabul kriterleri

- Gaia diğer odalar kurulu olmadan açılıyor; mevcut tema, TR/EN, oda paketi ve host sınırları korunuyor.
- OpenPlan3D yerel ve çevrimdışı; analytics, Firebase ve ihtiyaç duyulmayan uzak yollar kapalı. Ağ engelli test yapılıyor.
- Ortak sentetik fixture: 40 × 60 m alan, iki bağımsız yapı, iki normal kat ve negatif kotlu bodrum, sera, yer altı deposu, üç farklı yükseklikte cihaz noktaları, altyapı hattı ve referans görseli. Fixture gerçek kullanıcı arazisi değildir.
- Gaia → editör → düzenleme → kayıt → yeniden yükleme; kimlikler, XYZ, yapı/kat ilişkileri, kalibrasyon ve editörün tanımadığı Gaia alanları korunuyor. Gerçek geometri düzenleme, taşıma ve silme davranışı sınanıyor.
- Aynı model editörden bağımsız günlük yönetim görünümünde açılıyor; sanal cihaz durumu geometriyi değiştirmeden güncellenebiliyor.
- Aynı görünür pencere, çözünürlük, sahne ve süreyle CPU/RAM ve mümkünse GPU ölçülüyor; 2D fallback, boşta/etkileşim, gizleme ve dispose davranışı ayrı sınanıyor. Hedefler gerçek donanım ölçümüne göre belirleniyor.
- Dağıtılan kod, transitif bağımlılık ve varlıkların lisansları ve notice dosyaları doğrulanıyor; oda paketi ve Electron smoke testi geçiyor.

### 02-A/1 — İlk çalışan editör veri turu

02-A/1 gizli bir workspace dizininde, bellekte yayımlanan sentetik modelle doğrulandı. Aynı editörün geliştirici girişi artık `rooms/gaia-room/scripts/editor` altında. Bağımsız sunucuda **Open temporary example workshop** ile geçici örnek açılır. Üretim odasının proje seçimi aşağıda açıklanmıştır.

```bash
npm --prefix rooms/gaia-room/scripts/editor ci --ignore-scripts
npm --prefix rooms/gaia-room/scripts/editor run dev
```

Editör [127.0.0.1:4177](http://127.0.0.1:4177/) adresinde açılır. İlk hazırlık sabit OpenPlan3D commit'ini GitHub'dan sığ ve seyrek bir checkout ile alır. Sonraki açılışlar hazır checkout'u ve kilitli npm bağımlılıklarını kullanır.

**Kabul sonuçları**

| Senaryo                     | Sonuç                                                                                                                                                                                                                                                                                                                                                                          |
| --------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Düz duvar ve masa veri turu | Gerçek tuvalde `partition` duvarının iki ucu ayrı hareket ettirildi. İlk kayıtta uzunluk 3 m → 4 m oldu. Yeni düz duvar `ground` altında yeni UUID aldı. `bench` masası taşındı, tutamaçla döndürüldü ve genişliği yaklaşık 1,50 m'ye çıkarıldı. Gaia yerel pozu (3,1,0) m ve yaw 90°, dünya pozu (11,17,0) m ve yaw 180° oldu. Yeniden açılış aynı kayıttan geometriyi kurdu. |
| Bağlı duvar ve geçmiş       | Ortak uç birlikte hareket etti. Upstream undo/redo tek jesti geri alıp yineledi. İki kaydedilmiş duvarın ortak uç hareketi bir Gaia partisinde mevcut iki kimliğiyle yayımlandı.                                                                                                                                                                                               |
| Kopya, dal ve silme         | Bağlam menüsünden masa çoğaltıldı ve kopya silindi. Undo/redo aynı editör kimliğini, oturum testi aynı ayrılmış Gaia kimliğini doğruladı. Yeni geçmiş dalındaki masa ayrı kimlik aldı. Kaydedilmiş yeni masa sonraki kayıtta tek bir `remove` işlemiyle silindi.                                                                                                               |
| İzin profili                | Alt ile orta tutamacı sürükleme, algılanan oda için menüden silme ve Delete, oda sürükleme, grup kısayolu ve menüsü, açıklık kısayolu ve açıklık/katalog drop girişleri taslağı veya geçmişi değiştirmedi. Teste özel ikinci kat seçimi yalnız aktif katı değiştirdi. Kat taşıma kontrolü yoktu ve başka kattan yapıştırma reddedildi.                                         |
| Kayıt ve kayıp denetimi     | Ctrl/Cmd+S ve araç çubuğu Gaia'ya gitti. Devam eden sürüklemede kayıt durdu. Değişikliksiz kayıt revizyonu artırmadı. `bench` silme denemesi bağlı `bed` nedeniyle beklenen hatayı verdi, model, taslak ve geçmiş korundu. Ham negatif scale, eğri/eğimli duvar, açıklık, malzeme ve desteklenmeyen arka plan normalizasyondan önce reddedildi.                                |
| İlişkiler ve yerel çalışma  | `bench → ground`, `bench → bed`, `c2 → mc2 → ground` ve `mc2 → bed` ilişkileri, cihaz yeteneği, ölçüm kaynağı, envanter, saha işareti ve proje `survey` alanı korundu. Dış ağ engelliyken kayıt turu geçti ve IndexedDB açma veya silme çağrısı gözlenmedi.                                                                                                                    |

Son Chromium koşumunda yeni duvar `ccc2b7c2-36a7-4c10-afe0-00d0ed5a563a` kimliğini aldı ve ortak uç düzenlemesinde aynı kimlikle kaldı. Masa genişliği `1.50099693046586` m olarak kaydedildi ve yeniden açılışta korundu. Ayrı deneyde oluşturulan `54ce3bed-5fe5-4d0f-ac4a-8fe0773675d8` masası bir sonraki Gaia kaydında aynı kimlikle silindi.

Upstream [`771c9e1a` patch'i](rooms/gaia-room/scripts/editor/openplan3d.patch) dört dosyaya dokunuyor. Yama tuval ve bağlam menüsündeki izinleri, yazım öncesi store kontrolünü ve jest/undo sınırlarını kapsıyor. Yerel giriş kayıt komutunu Gaia oturumuna veriyor. Undo snapshot'larını OpenPlan3D tutuyor. Başlıca bakım riski bir upstream güncellemesinin kısayol, gesture veya store'a yeni yazım yolları eklemesi. Commit değişiminde patch'in yeniden uygulanması ve gerçek UI izin testlerinin tekrar çalışması gerekiyor. Üretim derlemesinde ana JS yaklaşık 510,6 kB, gzip ile 154,3 kB. Vite varsayılan 500 kB parça eşiğini raporladı.

Vite ve Svelte derlemesi upstream ana kabuğunu, Firebase'i, analytics'i, agent bridge'i ve IndexedDB datastore'u yüklemiyor. Üretim çıktısı kaynak içi 2D çizimleri taşıyor. Model, fotoğraf dokusu ve font katalogları dışarıda. [Üçüncü taraf bildirimleri](THIRD_PARTY_NOTICES.md#gaia-02-a1-yerel-openplan3d-editörü)

```bash
npm run rooms:test:file -- rooms/gaia-room/scripts/tests/round-trip.test.ts
npm --prefix rooms/gaia-room/scripts/editor exec -- playwright install chromium --only-shell
npm --prefix rooms/gaia-room/scripts/editor run test:ui
npm --prefix rooms/gaia-room/scripts/editor run check
./node_modules/.bin/tsc --noEmit -p rooms/gaia-room/scripts/tsconfig.json
```

Dört Chromium UI ve dört veri testi geçti. Electron 43.3.0’da üretim derlemesinde fareyle masa eklendi, Ctrl+S ile kaydedildi ve aynı Gaia modelinden yeniden açıldı. Strict TypeScript, Svelte ve hedefli lint/format kontrolleri geçti.

### 02-A/2 — Oda ve güvenilen kayıt

**02-A/2 açılışı.** Hayalet Ev’in klasik yan menüsünde **Gaia Room**’u açın. Yeni kurulumda görünmüyorsa **Oda Yönetimi → gaia-room → Yükle** yolunu kullanıp uygulamayı yeniden başlatın. Küçük Latin harfleri, rakam ve kısa çizgiyle bir proje kimliği girip **Proje oluştur**’u seçin. İlk model tahmini 10 × 10 m arazi, bir yapı ve boş zemin katıyla açılır. **Deney projesi oluştur** ayrı bir seçimdir. Modelleme Atölyesi’nde masa veya düz duvar ekleyip **Gaia’ya kaydet**’i seçin. Uygulamayı yeniden başlatınca **Kayıtlı projeler → Projeyi aç** aynı projeyi yükler.

**Sınırlar.** Manifest, host, protokol ve TR/EN katalogları odadadır. Atölye, uygulamanın dilini ve tema renklerini oda bağlamından alır. Tek düzenlenebilir Svelte kaynağından üretilen `ui/` ve lisansları çevrimdışı oda paketinin girdisidir. Standart builder `scripts/` altındaki geliştirici kaynaklarını pakete almaz. Son oda runtime’ı `rooms/.build/gaia-room/runtime` altında oluşur. Editörü değiştirdikten sonra `npm --prefix rooms/gaia-room/scripts/editor run build` ile paket girdisini yenileyin.

**Yazıcı.** GaiaProjects, GaiaCreate, GaiaOpen ve GaiaSave komutları mevcut SlotBridge oda yolundan geçer. Preload istek içeriğini çağıran webview’de tutar. Electron main, üst pencereyi, ana frame’i, oda partition’ını, kurulu runtime girişini ve manifest komut kapsamını denetler. Güvenilen Gaia sağlayıcısı uygulama derlemesine bağlanır. Yeni bir .hevroom kurulumu main sürecine kod yükleyemez. Main storage kökünü çözer. Oda sağlayıcısı açık atölyeyi, taban revizyonunu, düzenlenebilir Gaia kimliklerini, işlem türlerini, alanları ve ilişkileri doğrular.

**Kalıcılık.** `data/room-storage/gaia-room/projects/<id>/world.json` dünya ile son başarılı işlemin kimliğini, SHA-256 istek özetini ve sonuç revizyonunu birlikte taşır. PNG baytları proje altındaki `assets/` dizininde ayrı saklanır. Eksik PNG adı gösterilir ve dünya açılır. Okunamayan proje hata verir. Yazıcı proje başına sıralar, masaüstü süreçleri arasında işletim sistemine ait adlandırılmış bir kilit kullanır, geçici dosyayı tamamlar ve aynı dizinde rename ile yayımlar. Bu güvence süreç kesintisini kapsar. Güç kaybı dayanıklılığı ölçülmedi. Yayın öncesi kesinti geçici dosya veya referanssız PNG bırakabilir. Deney projesini yeniden oluşturma aynı PNG baytlarını güvenle kullanır.

**Onay kaybı.** Taslak ve undo geçmişi onay gelene kadar korunur. Aynı düzenlemeyle Kaydet’e tekrar basmak aynı işlem kimliğini kullanır. Son başarılı farklı kayıt önceki işlemin teyit penceresini kapatır. Eski istek belirsiz sonuçla döner. Kullanıcı güncel revizyonu açıkça yeniden açar. Otomatik birleştirme yoktur.

**Doğrulama.** 12 Gaia veri/kayıt testi ve 27 oda altyapısı regresyonu geçti. Saf adaptör, domain ve gerçek dosya testlerine eşzamanlı kayıt, işlem tekrarı ve çakışması, eski onay, disk hatası, rename öncesi çocuk süreç kesintisi, eksik PNG, bozuk JSON, yetkisiz kapsam ve symlink senaryoları dahildir. Chromium’da önceki dört editör senaryosu ve kayıt kilidi/onay kaybı testi geçti. Linux Electron smoke testi boş profilde yalnız Gaia paketini kurdu, oda ağını engelledi, gerçek tuvalde masa ekledi ve uygulamayı ikinci süreçte açtı. Dünya, masa kimliği, geometri ve ilişkiler eşleşti. Başka oda partition’ından gelen erişim reddedildi. Windows koşumu ve kullanıcı görseli içe aktarma bu kabulde doğrulanmadı.

```bash
npm run rooms:test:file -- rooms/gaia-room/scripts/tests/*.test.ts
npm --prefix rooms/gaia-room/scripts/editor run test:ui
npm --prefix rooms/gaia-room/scripts/editor run check
npm run build && npm run electron:build
TSX_TSCONFIG_PATH=src/tsconfig.json node --import tsx scripts/tests/gaia-room.electron-smoke.mjs
```

### 02-A/3 — Ortak arazi planı ve bağımsız Genel Görünüm

**Açılış.** Gaia Room’da bir proje açılınca salt okunur Genel Görünüm gelir. Standart yeni proje boş açılır. **Deney projesi oluştur** seçeneği 40 × 60 m araziyi, Sera ve Kümes’i, negatif kotlu bodrumu, su deposunu, cihazları ve XYZ hatlarını oluşturur. Mimari örnekteki 400 × 600 px kalibrasyon fixture’ı proje varlığı olarak saklanır. Plan üzerinde referans görseliyle çalışma 02-B kapsamındadır.

**Görünüm.** Katman listesi ve özellik paneli OpenPlan3D ve NextFloor araştırmasındaki gezinme düzenini izler. 2B plan ve 3B yörünge aynı Gaia kimliklerini, metrik dünya pozlarını, seçim ve kadraj sınırlarını kullanır. Yapı ve kat filtreleri hiyerarşiyi izler. Yer altı filtresi her arazinin kendi Z=0 düzlemine göre katları gizler ve hattın görünen kısmını kırpar. Three.js yalnız 3B seçildiğinde, OpenPlan3D yalnız bir yapının iç planı açıldığında yüklenir.

**Atölye.** Sınır köşeleri ve yapı konumu fareyle veya sayısal alandan düzenlenir. Yapı boyutları ve yönü, kat kotu, cihaz konumu ve hat köşeleri özellik panelindedir. Yeni altyapı hattı her köşe için ayrı kot alır. Yapıyı taşımak çocuklarının yerel pozunu korur. Yeniden bağlama komutunda dünya veya yerel pozu koruma açıkça seçilir. Silmede etkilenen çocuklar ve yerleşimden çıkarılacak cihazlar gösterilir. Geriye referans bırakan işlem reddedilir. Site çerçevesindeki hat kendi koordinatlarını korur. İç plana geçişte ve geri dönüşte kirli taslak için kaydetme, vazgeçme ve düzenlemeye dönme seçenekleri vardır. [Oda kayıt kontratı](rooms/gaia-room/protocols/gaia-project.md)

**Durum ve yaşam döngüsü.** Yeni cihaz noktası kanonik bir sanal sensöre bağlanır. Örnek ölçümler cihaz kimliğiyle oturum belleğinde tutulur ve ölçümün kaynağı, bağlantısı, zamanı ve tazeliği gösterilir. Güncelleme dünya revizyonunu ve geometrisini değiştirmez. Oda değişiminde host görünürlük sinyali gönderir. Gaia UI aboneliklerini, 2B çizim yüzeyini, 3B kontrollerini ve bekleyen kareleri bırakır. Askıdaki 3B görünüm kamera pozunu ve WebGL bağlamını korur. 3B modundan çıkıldığında veya oda kapandığında renderer kaynakları bırakılır.

**Kontroller.** 17 Gaia veri ve kayıt testi, 8 Chromium UI testi ve 408 oda altyapısı testi geçti. Oda altyapısında 1 senaryo atlandı. Svelte, TypeScript, hedefli ESLint ve Prettier kontrolleri ile oda, renderer ve Electron derlemeleri geçti. Dependency Cruiser mevcut Game Room dosyaları için 14 yetim modül uyarısı bildirdi, hata bildirmedi.

**Electron ve ekran görüntüleri.** Linux Electron 43.3.0’da kurulu Gaia paketiyle ve Gaia webview’inde dış ağ kapalıyken iki yapı birlikte açıldı. 2B ve 3B tıklamaları `coop` kimliğini döndürdü. Forge Room’a geçişte 3B çizim ve kontroller askıya alındı, hızlı geçişlerde tek görünüm döndü ve 3B’den çıkışta WebGL bağlamı bırakıldı. Yapı sürükleme, yön ve boyut değişikliği, bodrum kotu, yeni kat, cihaz ve iki kotlu hat revizyon 8’e kaydedildi. OpenPlan3D’de eklenen masa revizyon 9’da yeniden açıldı. Yeni kimlikler, cihaz bağlantıları ve hat köşeleri Electron yeniden başladıktan sonra doğrulandı. [Electron deneyi](scripts/tests/gaia-room.electron-smoke.mjs)

- [Genel Görünüm 2B](rooms/.build/gaia-room/evidence/gaia-overview-2d.png) ve [Genel Görünüm 3B](rooms/.build/gaia-room/evidence/gaia-overview-3d.png), Electron webview.
- [Arazi Atölyesi](rooms/.build/gaia-room/evidence/chromium/gaia-site-workshop.png) ve [OpenPlan3D iç planı](rooms/.build/gaia-room/evidence/chromium/gaia-interior-workshop.png), Chromium kabul koşumu.

**Kabul incelemesi.** Kaynak incelemesinde ortak kayıt ve görünürlük sınırları kontrol edildi; 17 Gaia veri/kayıt testi bağımsız olarak tekrar geçti. Chromium, oda altyapısı ve Electron deneyleri uygulama agent'ının kayıtlı sonuçlarına dayanır. 02-A/4 açılabilir.

**Lisans ve açık riskler.** Three.js 0.187.0 ve OrbitControls MIT lisanslıdır. TypeScript tipleri ve tip paketinin transitif girdileri geliştirme bağımlılıklarıdır. 3B parçası yaklaşık 579 kB, gzip ile 146 kB ve Vite’ın varsayılan parça boyutu uyarısını aşıyor. Donanım GPU’su, diğer masaüstü platformları ve uzun süreli kaynak tüketimi 02-A/4’te doğrulanacak. [Üçüncü taraf bildirimleri](THIRD_PARTY_NOTICES.md#gaia-02-a3-threejs-görünümü)

### 02-A/4 — Bağımsız paket, performans ve kalite kabulü

Başlangıç `2337379b`. Linux x86_64 üzerinde ayrı geçici uygulama profilleri ve 40 × 60 m deney projesi kullanıldı. 02-A/4 değişiklikleri de kurulu paket ve güvenilen uygulama derlemesinde sınandı.

#### Kabul matrisi

| Alan                                           | Sonuç         | Gözlem                                                                                                                                                                                                                                                                                                                                                                     |
| ---------------------------------------------- | ------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Geometri ve kimlik                             | Doğrulandı    | Döndürülmüş serada `mc1=(11,16,−2)` ve `mr1=(11,15,4.8)` m. Güvenilen yazıcı üzerinden 100 açma ve değişikliksiz kayıt turunda dünya, kimlikler ve revizyon aynı kaldı. Dünya/yerel dönüşümü 10⁻⁶ m toleransını sağladı.                                                                                                                                                   |
| Hat mesafesi                                   | Doğrulandı    | Sahne izdüşümündeki su hattı 5 m yatay, √34 m doğrudan ve 8 m güzergâh uzunluğuna sahip. Döndürülmüş ve ötelenmiş arazi ile yer altı kırpması kanonik köşeleri korudu. Ölçüm aracı 02-B kapsamındadır.                                                                                                                                                                     |
| Arazi ve yapı kapsamı                          | Doğrulandı    | Ötelenip döndürülen ikinci araziye eş kotlu bağımsız kat eklendi. Sera iç plan kaydı diğer araziyi, katı ve katsız Kümes’i aynı bıraktı. Kurulu odada Sera taşındı, bodrum kotu değişti, yeni kat, cihaz noktası ve iki kotlu hat kaydedildi.                                                                                                                              |
| Pozitif OpenPlan3D turu                        | Doğrulandı    | Chromium’da gerçek duvar/masa jestleri, duvar uçları, bağlı uç, boyut ve döndürme Gaia’dan yeniden projekte edildi. Beklenen 4 m duvar ve masa dünya pozu/180° veri testinde eşleşti. Değişikliksiz kayıt revizyonu artırmadı. Kurulu Electron yeniden başlatıldığında eklenen masa aynı kimlikle açıldı.                                                                  |
| Kopya, silme, geri al/ileri al                 | Doğrulandı    | Chromium ve veri testlerinde kopya yeni kimlik aldı, geri al/ileri al aynı nesnenin kimliğini korudu, yeni tarihçe dalı ayrı kimlik kullandı ve silme tek hedefe uygulandı.                                                                                                                                                                                                |
| İlişki, izinli düzenleme ve kayıp              | Doğrulandı    | Çakışan kimlik, eksik kat snapshot’ı, örtük kat geçişi, bağlı hedef silme ve izin dışı geometri atomik reddedildi. Açık yeniden bağlama dünya veya yerel pozu korudu. Geçerli hareketle birleşen yasak değişiklik de yayımlanmadı.                                                                                                                                         |
| Sentetik referans                              | Doğrulandı    | 400 × 600 PNG’nin baytları, referans kimliği ve 10 m kontrol noktaları yapı kaydı sonrası korundu. Saklanan veriden merkez (1600, 800) cm ve +90° editör açısı hesaplandı. Çakışan ve görsel dışındaki kontrol noktaları reddedildi. Eksik PNG ile dünya açıldı.                                                                                                           |
| Gerçek referans içe aktarma ve UI kalibrasyonu | Kapsam dışı   | 02-B.                                                                                                                                                                                                                                                                                                                                                                      |
| Saklama ve tekrar teslim                       | Doğrulandı    | Aynı revizyona yarışan kayıtlar, kayıp onay, aynı işlemin tekrarı, içerik çakışması, eski onay, disk hatası ve süreç kesintisi test edildi. UI taslak ve geri alma geçmişini sakladı.                                                                                                                                                                                      |
| Oda yetkilendirme sınırı                       | Doğrulandı    | Kurulu Electron’da farklı oda partition’ından gelen istek reddedildi. Dosya testleri proje/varlık yolu ve symlink denetimlerini doğruladı.                                                                                                                                                                                                                                 |
| Sanal cihaz ve geometri                        | Doğrulandı    | Yerleşim bağı ve iki bölge üyeliği korundu. Örnek okuma değişirken plan içeriği, dünya revizyonu ve mekânsal izdüşüm sabit kaldı.                                                                                                                                                                                                                                          |
| Fiziksel eşleme, donanım değiştirme ve geçmiş  | Kapsam dışı   | Client, Router ve telemetri aşamaları.                                                                                                                                                                                                                                                                                                                                     |
| Editörsüz Genel Görünüm ve WebGL’siz 2B        | Doğrulandı    | Soğuk 2B açılışta OpenPlan3D veya Three.js parçası istenmedi. Ağaç/2B/3B aynı Kümes kimliğini seçti. Kat, tank, bodrum ve kırpılmış hat durumları doğrulandı. Chromium ve kurulu Electron’da WebGL devre dışıyken 2B seçim ve kayıt çalıştı.                                                                                                                               |
| Yaşam döngüsü                                  | Doğrulandı    | Forge’a geçişte Gaia’nın WebGL çizim ve animasyon karesi sayaçları durdu. Tazelik zamanlayıcısı kaldırıldı, Chromium’da host mesajı aboneliği gizliyken 0, dönünce 1 oldu. Hızlı gezinmede tek canvas kaldı. 3B modundan çıkış bağlamı kaybetti ve oda kapanışı renderer’ı sonlandırdı. Geciktirilmiş grafik modülü kapanıştan sonra WebGL bağlamı oluşturmadı.            |
| Kurulum, tema, TR/EN ve çevrimdışı işlem       | Doğrulandı    | Temiz profilde tek kurulu oda Gaia idi. Yalnız loopback arayüzüyle proje oluşturuldu, arazi ve iç plan düzenlendi, revizyon 9 yeni Electron sürecinde birebir açıldı. Gaia partition’ında dış HTTP(S)/WebSocket isteği görülmedi. Obsidian → Ivory Lab yüzey rengi aktarımı ve TR → EN açılış etiketleri doğrulandı. İç plan tuvali Türkçe etiketi Chromium’da doğrulandı. |
| Windows, macOS ve diğer GPU’lar                | Doğrulanamadı | Mevcut koşum Linux/X11 (KDE Wayland oturumunda XWayland) ve Intel GPU ile sınırlı.                                                                                                                                                                                                                                                                                         |

#### Paket ve lisans

- `npm ci` ve `npm run build` iki ayrı dizinde çalıştırıldı. Node 26.13.1 ve npm 12.2.3 ile OpenPlan3D 0.9.0 için `771c9e1ad30bd1c3cc7584d6eca74deb2e14943d` commit’i, dört dosyalı patch ve kilit dosyası kullanıldı. Svelte CSS kapsamı ortak kaynak köküne bağlandı. Vite UI baytları ve normal oda builder’ından çıkan 18 paket girdisi eşleşti. `.hevroom` zarfındaki `exportedAt` üretim zamanını gösterir.
- Paket 1.311.844 bayt, çözülmüş dosyalar 981.482 bayt. Manifest, derlenmiş host, iki dil kataloğu, saklama protokolü, göreli yollu UI, dokuz JS/CSS varlığı ve üç lisans dosyası taşıyor. Model/doku/font kataloğu, test dosyası, upstream checkout, `node_modules`, fixture PNG veya kullanıcı projesi arşivde bulunmadı. PNG, deney projesi oluşturulduğunda izole uygulama deposunda üretildi. Üretim iç plan parçası 468 kB’dan yaklaşık 258 kB’a, gzip ile 138 kB’dan 82 kB’a indi. 3B parçası 579 kB, gzip ile 146 kB. Vite 500 kB eşiği uyarısı sürüyor.
- Dağıtım lisansları MIT. OpenPlan3D 0.9.0 © 2026 theLodgeStudio, Svelte 5.57.0 © 2016–2025 Svelte Contributors, esm-env 1.2.2 © 2022 Benjamin McCann, Three.js 0.187.0 ve OrbitControls © 2010–2026 three.js authors, Tailwind CSS 4.1.18 © Tailwind Labs. Svelte, esm-env ve Three.js lisansları Vite notice’ında. OpenPlan3D ve Tailwind lisansları ayrı dosyalarda. Vite, Svelte Check, Playwright, TypeScript ve Three tip ağacı derleme/test girdisi olarak kaldı. [Üçüncü taraf bildirimleri](THIRD_PARTY_NOTICES.md) · [Oda bağımlılık lisansları](rooms/gaia-room/ui/DEPENDENCY-LICENSES.md)
- **Core uyumluluğu.** Gaia 0.2.0 paketinin çalışması için güvenilen Gaia storage sağlayıcısını ve oda görünürlük IPC’sini içeren bu çalışma ağacından derlenmiş Hayalet Ev 5.4.0 gerekir. Paket manifesti genel oda şemasını kullanır. Electron main sağlayıcısı uygulama derlemesinde kaydolur. Oda paketi yalnız renderer/host kaynakları ve metadata taşır. [Saklama kontratı](rooms/gaia-room/protocols/gaia-project.md)

Üretim ve ayrı kabul kontrolleri için depo kökünden aşağıdaki komutlar çalıştırıldı.

```bash
npm --prefix rooms/gaia-room/scripts/editor ci
npm --prefix rooms/gaia-room/scripts/editor run build
npm run rooms:bundle -- gaia-room --output /tmp/gaia.hevroom
npm --prefix rooms/gaia-room/scripts/editor run check
npm --prefix rooms/gaia-room/scripts/editor run test:ui
npm run check:all
```

Çevrimdışı Electron turu Linux ağ ad alanında yalnız loopback ile çalıştırıldı. Test derlenmiş Electron main ve renderer çıktısını geçici profile kopyalar. [Kurulu oda deneyi](scripts/tests/gaia-room.electron-smoke.mjs)

```bash
unshare --user --map-root-user --net sh -c '
  ip link set lo up &&
  xvfb-run -a -s "-screen 0 1920x1080x24" env TSX_TSCONFIG_PATH=src/tsconfig.json \
    node --import tsx scripts/tests/gaia-room.electron-smoke.mjs --standalone
'
```

#### Mimari ve hedefli düzeltmeler

- `Workspace.svelte` taslak, seçim ve görünüm geçişini koordine eder. Katman listesi, özellik formu, plan ve orbit ayrı bileşenlerdir. Geometri ve ilişki doğrulaması `spatial/`, uygulama sınırı ve atomik kayıt `storage/` altındadır. `Workshop.svelte` ile projeksiyon ve oturum modülleri, OpenPlan3D hareketlerini doğrulanabilir partiye çevirir. Bu incelemede dosya boyuna bağlı refactor gerekmedi.
- Kanonik otorite `world.json` ve aynı yayındaki işlem makbuzudur. OpenPlan3D store ve undo geçmişi geçici taslak tutar. Viewer aynı revizyondan türetilir. Sanal ölçümler oturum belleğinde kalır. Kayıtlı proje ad alanı ile proje içi nesne kimlikleri ayrıldı. Böylece `bench` adlı deney projesi özgün `bench` nesne kimliğini korur. Sentetik referansın yerel veri doğrulaması sıkılaştırıldı.
- Core’un storage taşıyıcısı oda kimliğini güvenilen sağlayıcıdan alır. Webview türü, ana frame, üst pencere, partition, kurulu giriş ve komut kapsamı main’de kontrol edilir. Gaia’nın core bileşimine bağlandığı yer `scripts/rooms/electron-main.mjs`. Genel görünürlük sinyali mevcut room host köprüsünden geçer. Gaia başka bir odanın kaynak veya verisini kullanmaz. Forge ile gerçek görünürlük/tur ve tam repo testleri diğer oda akışlarını kapsadı.
- OpenPlan3D patch’i dört dosyada tuval, bağlam menüsü, store ve kısayol izinlerine odaklanır. Yerel Vite girdi filtresi kullanılmayan mobilya, entourage, şablon ve Portekizce sözlük verisini çıkardı. İzinli masa ve çizim yardımcıları upstream’den kalır. Görünür iç plan kontrolleri için Gaia TR bağlamı kullanılır. `scripts/editor` düzenlenebilir, `ui/` yeniden üretilen paket girdisidir.
- Gaia’nın renk ve boyutları oda token’larına taşındı. CSS denetimi yinelenen minified derlemeler yerine düzenlenebilir Svelte ve CSS kaynağını da tarıyor. Oda sınırı testi kurulmuş üçüncü taraf `node_modules` dizinlerine girmiyor. Knip, gerçek Electron bileşimi ve Gaia’nın bağımsız editor manifestini izliyor. 19 Gaia veri/kayıt testi tam test keşfine bağlı.

#### Gerçek masaüstü ölçümleri

Görünür ve odaklı Electron 43.3.0 (Chromium 150.0.7871.212), Intel i7-4510U, 1920 × 1080 masaüstü, 1350 × 850 içerik alanı, DPR 1 ve 795 × 453 WebGL tuvali. Tüm satırlarda aynı 40 × 60 m dünya kullanıldı. ANGLE OpenGL, WebGL 2 bağlamını Mesa 26.3.1 üzerindeki Intel HD Graphics 4400 ile açtı. Donanım hızlandırma, GPU compositing ve rasterization etkin. Electron’un cihaz listesi GeForce 840M’yi de gösterdi. Ölçülen bağlamın WebGL renderer adı ve GPU sürecinin `i915` açık dosyaları Intel yolunu doğruladı. Ayrı Chromium 153.0.8010.12 UI koşumunda ANGLE Vulkan SwiftShader/Subzero yazılım renderer’ı kullanıldı.

Tablo hücreleri **ortalama CPU % / medyan RSS MiB**. CPU için %100 bir mantıksal çekirdek, örnek aralığı yaklaşık bir saniye. Durağan senaryolarda örneklemeden önce 1,8 saniye beklendi. Kamera sürüklemesi ve masa önizlemesinde girdi boyunca örnek alındı. Son satır 20 çevrim sonrasındaki 24 örneği izleyen 45 saniyelik beklemeden sonra alındı. Yardımcı süreç RSS’i yaklaşık 85 MiB ve ölçülen CPU’su %0,0. RSS paylaşılan sayfaları süreç başına sayar.

| Senaryo                             | Örnek |         Main | Kabuk renderer | Gaia renderer |   GPU süreci | Forge renderer | i915 yerleşik sistem belleği (MiB) |
| ----------------------------------- | ----: | -----------: | -------------: | ------------: | -----------: | -------------: | ---------------------------------: |
| Gaia açılmadan                      |    12 |  0,2 / 318,7 |    0,1 / 211,2 |             — |  0,1 / 147,9 |              — |                              133,3 |
| Genel Görünüm 2B, boşta             |    12 |  3,0 / 343,9 |    0,9 / 215,6 |   0,0 / 113,1 |  0,2 / 149,0 |              — |                               96,9 |
| Genel Görünüm 3B, boşta             |    12 |  0,2 / 276,1 |    0,8 / 190,8 |   0,0 / 122,4 |  0,0 / 151,8 |              — |                              112,6 |
| Genel Görünüm 3B, kamera hareketi   |    12 | 13,3 / 276,3 |   13,9 / 195,4 |   7,3 / 126,1 | 21,9 / 152,5 |              — |                              105,6 |
| Arazi Atölyesi, açık                |    12 |  0,3 / 276,0 |    0,2 / 195,7 |   0,1 / 127,3 |  0,1 / 150,8 |              — |                               91,9 |
| OpenPlan3D iç plan, boşta           |    12 |  0,3 / 276,7 |    0,2 / 193,8 |   0,0 / 138,1 |  0,0 / 151,1 |              — |                              116,6 |
| OpenPlan3D masa yerleşim önizlemesi |    12 |  9,9 / 277,2 |   11,6 / 196,1 |   7,1 / 138,1 | 19,9 / 152,0 |              — |                               88,7 |
| Gaia gizli, Forge açık              |    12 |  0,3 / 278,8 |    0,1 / 198,4 |   0,7 / 136,7 |  0,2 / 156,3 |    0,0 / 112,8 |                              172,7 |
| Gaia tamamen kapalı                 |    12 |  0,3 / 277,9 |    0,1 / 197,2 |             — |  0,1 / 155,0 |    0,0 / 112,9 |                              107,5 |
| 20 aç–gizle–kapat çevrimi sonrası   |    24 |  0,3 / 280,8 |    0,1 / 209,3 |             — |  0,0 / 161,0 |    0,0 / 114,8 |                              124,1 |
| Bekleme sonrası                     |    12 |  0,4 / 280,3 |    0,2 / 209,3 |             — |  0,4 / 160,7 |    0,0 / 114,8 |                              114,7 |

GPU süreci sütunu işletim sistemi süreç ölçümüdür. `i915` sütunu aynı süreç için DRM istemci kimliğiyle tekilleştirilen `drm-resident-system0` ölçümüdür. GPU busy sayacı erişimi işletim sistemi tarafından reddedildi. GPU kullanım yüzdesi ve ayrık VRAM ölçümü alınamadı.

- 3B boşta ve Forge görünürken WebGL çizim ve animasyon karesi artışı sıfırdı. Görünür Gaia’da yaklaşık 32 saniyelik tazelik zamanlayıcısı varken oda geçişi sonrasında bekleyen zamanlayıcı sayısı sıfır oldu. Gizleme WebGL bağlamını sakladı. 3B modunu kapatma bağlamı kaybetti ve Gaia kapatıldığında renderer 20 turun tamamında sonlandı.
- Gaia renderer yeniden açılış örnekleri 124,0–126,7 MiB aralığında kaldı. İlk kapanış 155,0 MiB olan paylaşılan GPU süreci 20 tur sonunda 161,0 MiB, bekleme sonrası 160,7 MiB medyan RSS kullandı. Aynı aşamalarda i915 yerleşik sistem belleği 107,5 → 124,1 → 114,7 MiB oldu. Yeniden açılan Gaia süreçlerinde birikim görülmedi. Paylaşılan süreçlerde kalan düşük RSS artışı daha uzun oturumlar için açık gözlem. Kapanış sırasında Chromium SharedImage mailbox kayıtları görüldü. Bağlam bırakma, ikinci açılış veya renderer sonlanması testlerinde işlevsel hata görülmedi.
- Kamera hareketi sırasında GPU süreci CPU ortalaması %21,9, bir saniyelik tepe %24,7 oldu. İç plan masa önizlemesinde GPU süreci ortalama %19,9 CPU kullandı. Durağan ve gizli görünümde sürekli çizim görülmedi. Bu fixture’da kaynak odaklı bir render optimizasyonunu gerektiren kalıcı tüketim doğrulanmadı. [Yerel ham ölçümler](rooms/.build/gaia-room/evidence/02-a4/performance-raw.json)

#### Kalite zinciri ve karar

- `npm run check:all` geçti. Format, strict lint, TypeScript, 1.981 başarılı test ve 2 mevcut atlama, tasarım denetimleri, Dependency Cruiser, Knip, oda runtime üretimi ve uygulamanın renderer/Electron/MCP/Ghost Agent derlemeleri tamamlandı. Fate Knots için 282 CSS baseline bulgusu ve Game Room için 14 dependency uyarısı bulundu, hata yok. 19 Gaia veri ve kayıt testi bu toplamın içinde. [Tam koşum günlüğü](logs/check-all.log)
- Svelte Check 0 hata ve 0 uyarı, ayrı Chromium koşumu 9 başarılı test. Kurulu Electron’da Forge ile gerçek navigasyon ve yalnız Gaia ile ağsız tur tamamlandı.
- **02-A Linux kapsamı kapanabilir.** OpenPlan3D’nin izinli çizim profili ve Three.js’in talep üzerine bağımsız 3B yaklaşımı ilk milestone için kabul ölçütlerini karşılıyor. Güncellemede upstream patch ve gerçek UI izin testleri yeniden doğrulanmalı. Büyük sahneler, uzun oturumlar, yüksek çözünürlük ve DPR, diğer sürücüler, Windows ve macOS açık. Tam uygulama installer’ı bu oda kabulünde çalıştırılmadı.

### 02-B/1 — Referans görüntüsü, kalibrasyon ve ölçüm

- Modelleme Atölyesi’ndeki **Referanslar** paneli yerel PNG, JPEG ve sıkıştırılmamış 24/32 bit BMP kabul eder. Üst sınır 32 MiB, 32 milyon piksel ve kenar başına 32.768 pikseldir. Dosya adı ve uzantısı görsel biçimini belirlemez. Güvenilen yazıcı özgün baytları ayrı varlık olarak saklar. Yeniden üretilen önizlemenin en uzun kenarı 1.800 pikseldir. Kalibrasyon özgün piksel boyutlarını kullanır.
- Boş proje, proje koordinatlarında bir görüntüyle başlayabilir. Referanslar arazi, yapı, kat veya bölgeye bağlanabilir. Çerçeve değişikliğinde kalibrasyonun dünyadaki konumu ve yönü korunur. Yerleşim kilitlenebilir. Görünürlük, opaklık ve kilit proje kaydında saklanır. Görüntüyü değiştirmek yeni varlık kimliği oluşturur ve aynı katmanda yeni kalibrasyon açar. Mevcut geometriler yerinde kalır.
- Görüntüde A ve B seçilir, bilinen mesafe metreyle girilir, A’nın çerçeveye göre konumu ve A→B doğrultusu ayarlanır. **Planda önizle** ve **Kalibrasyonu onayla** iki ayrı adımdır. A’nın yatay konumu planda da seçilebilir. Saklanan ham noktalar daha sonra yeniden düzenlenebilir.
- Genel Görünüm ve Atölye’nin 2B planı aynı katmanları gösterir. Arazi sınırı, yapı, cihaz ve güzergâh araçları planın metrik koordinatlarını kullanır. OpenPlan3D, aktif katla ilişkili referansları kilitli altlık olarak çizer. Bu projeksiyon katın ofseti, açısı ve kotunu Gaia’dan çözer.
- **Ölçüm** aracı planda geçici XYZ noktalarından yatay mesafeyi, doğrudan 3B mesafeyi veya toplam 3B güzergâhı hesaplar. Seçili arazi ve bölgenin yatay alanı, nesnenin boyut ve kotu ve kayıtlı hattın tam uzunluğu Özellikler’de görünür. Geçici ölçümler proje revizyonunu artırmaz.

**Linux kabul deneyleri**

| Deney                    | Sonuç                                                                                                                                                                                                                                                                                                                                                                                                                       |
| ------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| İçe aktarma ve iki nokta | Kurulu odada 2.400 × 1.800 sentetik PNG ve yerel progresif JPEG içe alındı. Büyük PNG’nin özgün piksel boyutları önizlemeden bağımsız kaldı. İki çakışan nokta, negatif mesafe ve bozuk dosya arayüzde reddedildi. Sınır dışı piksel ve sıfır mesafe veri testinde reddedildi. [İçe aktarma](rooms/.build/gaia-room/evidence/02-b1/00-import.png) · [Kalibrasyon](rooms/.build/gaia-room/evidence/02-b1/01-calibration.png) |
| Ortak plan ve ölçek      | A noktası (12, 8, 0) m, A→B yönü 15° ve bilinen mesafe 20 m olarak kaydedildi. Zoom ve pan kamera değerlerini değiştirdi, altlığın metrik dönüşümü aynı kaldı. Görsel üzerinden arazi sınırı, yapı, cihaz noktası ve üç noktalı, değişken kotlu hat çizildi. [Ortak 2B plan](rooms/.build/gaia-room/evidence/02-b1/02-site-plan.png)                                                                                        |
| Ölçüm                    | Geçici iki nokta için yatay ve doğrudan 3B mesafe ile geçici güzergâh, proje revizyonu değişmeden hesaplandı. Döndürülmüş fixture’da kayıtlı boru 5 m yatay, √34 m doğrudan ve 8 m güzergâh verdi. Arazi alanı 2.400 m², bölge alanı 48 m². [Geçici ölçümler](rooms/.build/gaia-room/evidence/02-b1/03-measurement.png)                                                                                                     |
| İç plan                  | 35° döndürülmüş yapı ve −3 m kotlu katta PNG ve JPEG altlıklarının tuvale çizildiği doğrulandı. Veri testi ayrıca ofsetli ve döndürülmüş katın yerel XYZ dönüşümünü sınadı. [Kilitli OpenPlan3D önizlemesi](rooms/.build/gaia-room/evidence/02-b1/04-locked-interior.png)                                                                                                                                                   |
| Kayıt ve varlık ömrü     | Electron kapatılıp yeniden açıldı. Orijinal PNG ve JPEG baytları, ham A/B noktaları ve kanonik dünya eşleşti. Görünürlük, kilit ve %40 opaklık değişiklikleri kaydedildi. Görüntü değişimi mevcut geometri ve cihaz kayıtlarını korudu. Eksik ve bozuk varlıklar kendi durumlarıyla gösterildi. [Çevrimdışı Electron günlüğü](rooms/.build/gaia-room/evidence/02-b1/electron-offline.log)                                   |

24 Gaia veri testi, 27 oda sözleşmesi testi ve 9 Chromium arayüz testi geçti. Hedefli strict ESLint, Prettier, Gaia ve oda TypeScript kontrolleri ile script TypeScript kontrolü geçti. Svelte Check 0 hata ve 0 uyarı verdi. Oda ve Electron üretim çıktıları yenilendi. Referans deneyleri Linux ağ ad alanında yalnız loopback açıkken çalıştı. Ayrı kurulu 02-A turu Forge gezinmesi ve 3B yaşam döngüsünü kapsadı. BMP dönüştürücüsü Electron’da ayrıca piksel ve boyut açısından doğrulandı. [Gaia veri günlüğü](rooms/.build/gaia-room/evidence/02-b1/data.log) · [Chromium günlüğü](rooms/.build/gaia-room/evidence/02-b1/browser.log)

### 02-B/2 — Gerçek arazi kullanımı

Kullanıcı kendi arazisinde uydu görüntüsünü kalibre etti, çokgen sınırı çizdi, bağımsız yapıları ve katları modelledi, OpenPlan3D iç planını düzenledi, cihaz yerleştirdi, negatif kotlu altyapı hattı çizdi ve 3B görünümü kullandı. Kullanıcı bu turu kabul etti. Modelleme araçlarının ince ayarları, kalibrasyon sihirbazının kullanılabilirliği ve gerçek arazi deneyimindeki sürtünmeler 02-D değerlendirmesinde ele alınacak. Gerçek proje veya görseller kabul fixture’ına alınmadı.

### 02-C — Günlük yönetim ve cihaz yönetimi

Uygulama tabanı `e3c5fdc5`.

- Genel Görünüm, açılır katman ağacını, nesne türü filtrelerini ve kadrajı 2B planla 3B yörüngede paylaşır. Ağaç ve harita aynı Gaia kimliğini seçer. Filtre kapalıysa **Göster ve kadrajla** seçimin gereken görünürlüğünü açar ve bunu bildirir. Bir montaj noktasındaki cihazların ayrı rozetleri aynı koordinattan türetilir.
- Yönetim paneli arazi, yapı, kat, bölge, montaj noktası, cihaz ve altyapı hattına göre değişir. Proje envanteri yerleşmemiş cihazları da sayar. Arazi özeti proje envanterinin toplamını ve o araziye yerleşik cihazların sayısını gösterir. Bağlantı ve dikkat listesi seçilen araziyi kapsar. Bölge üyelikleri tekrarlı sayım üretmez. Altyapı hattı tam geometrisinden hesaplanan uzunluğu, uç mesafelerini, kot aralığını ve güzergâhı gösterir.
- Cihaz oluşturma, düzenleme, bağlama, taşıma, ayırma ve silme mevcut doğrulanmış `GaiaSave` akışında atomik çalışır. Plana yeni montaj noktası eklemekle cihazı bu noktaya bağlamak tek işlemde kaydedilir. Cihaz silme onayı bağlı noktayı ve varsa donanım eşlemesini açıklar. Yerleşim değişse de cihaz kimliği, rol, marka/model ve capability alanları korunur. Sürüm 1 projelerde mevcut tek rol ve adsız cihaz kayıtları okunmaya devam eder.
- `GaiaStatus` yalnız etkin proje oturumundan sanal bağlantı veya ölçüm girdisi alır. Sağlayıcı, capability ve kaynak kimliğiyle doğrulanan son durumları `device-status.json` içine yazar. Ölçümün zamanı, birimi, kaynağı, geçerliliği ve tazeliği ayrı görünür. Canlı simülasyon güncellemeleri dünya dosyasının baytlarını, revizyonunu ve mesh geometrisini korur. Bağlantı kesilince önceki ölçüm son bilinen olarak gösterilir. Yeniden bağlanınca güncel veri için yeni örnek gerekir.
- Oda görünürleştiğinde son durum tekrar okunur. Tazelik için bir sonraki süre dolumuna kadar tek zamanlayıcı kurulur. Gizlenince görünüm ve host dinleyicileri durur. Three.js yalnız 3B açılınca, OpenPlan3D yalnız İç Plan açılınca yüklenir.

**Linux kabul deneyleri**

- Chromium’da boş projede fiziksel, çok rollü ve çok yetenekli cihaz oluşturuldu. Örnek arazide sanal cihaz mevcut montaj noktalarına taşındı, 2B planda bodrum kotuna yeni bir nokta eklendi, cihaz ayrılıp tekrar bağlandı ve nokta korunarak silindi. Ağaç, 2B ve 3B aynı cihazı seçti. Proje ve yerleşik cihaz sayıları ile yapı ve bölge özetleri doğrulandı. [Envanter](rooms/.build/gaia-room/evidence/02-c/browser-empty-inventory.png) · [Chromium günlüğü](rooms/.build/gaia-room/evidence/02-c/browser.log)
- Kurulu Electron odasında sanal bağlantı ve nem ölçümü girildi. Bağlantı kesilince %52 nem son bilinen ölçüm olarak kaldı. Aynı durum 2B ve 3B’de ve Electron yeniden başlatıldıktan sonra görüldü. Dünya dosyası durum değişimlerinde bayt düzeyinde eşleşti. Forge’a geçişte Gaia görünümü durdu ve dönüşte yeniden etkinleşti. Oda kapatma, PNG/JPEG referansları, kalibrasyon, negatif kotlu iç plan ve kayıt sonrası geri açma da geçti. [Arazi özeti](rooms/.build/gaia-room/evidence/02-c/electron-site-overview.png) · [3B cihaz durumu](rooms/.build/gaia-room/evidence/02-c/electron-orbit-device.png) · [Electron günlüğü](rooms/.build/gaia-room/evidence/02-c/electron.log)
- 27 Gaia veri, 31 oda sözleşmesi ve 11 Chromium arayüz testi geçti. Gaia ve oda TypeScript, uygulama TypeScript zinciri, hedefli ESLint, Prettier ve oda tasarım token kontrolü geçti. Svelte Check sıfır hata ve sıfır uyarı verdi. Oda kaynaklarından çalışma alanı runtime’ı, Electron main ve renderer üretim çıktıları alındı. [Veri testleri](rooms/.build/gaia-room/evidence/02-c/data.log) · [Oda sözleşmeleri](rooms/.build/gaia-room/evidence/02-c/room-contracts.log) · [Oda build’i](rooms/.build/gaia-room/evidence/02-c/room-build.log)

Gerçek Client/Router entegrasyonu, donanım eşleme ve büyük sahnelerde performans ölçümü açık. Oda build’i tembel yüklenen Three.js parçası için Vite boyut uyarısını sürdürüyor.

## 9. Geliştirme ve kalite kuralları

Yeni proje başlangıcı için kabul edilen 17 kural bu mevcut monorepo'ya uyarlanır.

1. **Temiz repo:** Yeni repo açılmayacak; doğrulanmış main referansı, branch/release/CI ve Actions kotası gözetilecek. Oda ve bağımsız saha yazılımlarının paket sınırı 01-C/D'de netleşecek.
2. **Agent iş bölümü:** Güçlü reasoning/kod modelleri mimari, kritik refactor, güvenlik ve bağımsız audit; ekonomik modeller fixture, standart test, çeviri ve tekrar işleri. Gerçek kotalara göre planla; kullanıcı LLM'si ile geliştirme agent'ını karıştırma.
3. **UI önce araştırılır:** Hazır editör, navigation, bilgi hiyerarşisi, varsayılanlar ve progressive disclosure; teknik olmayan kullanıcı esas.
4. **Capability önce:** Domain/değişim sınırları, adapter/provider ve tek kayıt/composition noktası; yeni özellik eski koda gömülmez.
5. **Küçüklük mazeret değil:** İkinci sağlayıcı/platform/davranış ihtimali olan parça sınır kazanır; kullanılmayan soyutlama üretilmez.
6. **AGENTS.md:** Mevcut kök kurallar geçerli. Oda oluşturulduğunda gerekli yerel kurallar/komutlar/invariantlar eklenir.
7. **Kalite baştan:** Strict TS, lint, format, Knip, test, dependency ve architecture kontrolü mevcut zincire dahil.
8. **Katmanlı kontrol:** Geliştirmede typecheck/lint/hedefli test; commit/PR'da uygun smoke/contract/Knip; release ve geniş değişiklikte `npm run check:all` ve platform/build. Küçük değişiklikte pahalı full test zorunlu değil.
9. **Proje hafızası:** Bu belge ilk mimari/karar/current-state/known-issues kaynağı. Büyüdükçe ayrı belge veya ADR; tekrar eden paralel dosyalar yok. Kararın nedenini kaydet.
10. **Otomatik invariant:** Import sınırları, protokol, round-trip, lifecycle, lisans ve dead-code mümkün olduğunca test veya lint ile zorlanır.
11. **Tek çalışan kopya:** Yalnız yeni Gaia deney verileri harcanabilir. Migration/backup/compatibility gerektiği ana kadar ertelenebilir. Mevcut Hayalet Ev ve kişisel veriler kapsam dışı.
12. **Dönem çıkışı:** Gerçek kullanıcı verisi, ikinci kurulum, release veya korunması gereken dış bağımlılık oluştuğunda açık karar; migration, backup/restore, rollback, bütünlük ve upgrade zorunlu.
13. **God file:** Satır sayısı değil değişim sebepleri; UI, domain, persistence, network ve orchestration ayrımı.
14. **Milestone audit:** En çok değişen dosyalar, bağımlılık yönü ve değişim eksenleri incelenir.
15. **Tekrarlayan hata:** İkinci benzer sorun, önleyici test veya süreç/mimari kuralı gerektirir.
16. **Scope:** Şimdi/sonra/deneysel ayrı; her fikir aktif milestone'a otomatik girmez.
17. **Öncelik sırası:** Erken hız, sadelik, mimari; olgun aşama güvenlik, veri koruma ve dayanıklılık. Fiziksel güvenlik ve temel ağ yetkisi ilk gerçek etkileşimden önce sağlanır.

### Kapsam havuzu

- 02-D’de gerçek arazi deneyimindeki modelleme ince ayarları, kalibrasyon sihirbazı ve günlük yönetim kullanılabilirliği değerlendirilecek.
- Sonra: gelişmiş hayvan/kamera analizi, toprak nemi haritası, güneş enerjisi/invertör, sulama optimizasyonu, hazır protokol adaptörleri, görsel atmosfer.
- Deneysel: Android mesh/repeater, bataryasız ve ekransız anakartlar, fiziksel kamera/mikrofon taşıma, manyetik/RF haritası, otomatik mekânsal çıkarım, dağıtık görüntü işleme. Başarısızlık ana projeyi bloke etmez.

## 10. Lisans ve dağıtım

Hayalet Ev'in özgün kodu MIT kalır. MIT/BSD/ISC ve uygun Apache-2.0 bileşenleri öncelikli; telif, LICENSE ve NOTICE korunur. GPL/AGPL/LGPL/MPL gibi farklı yükümlülükleri olan projeler ancak koşulları ayrı değerlendirilerek fikir referansı veya uygun bağımsız entegrasyon olabilir; izinsiz kaynak aktarımı yapılmaz. Lisansı belirsiz veya dağıtımı yasak kod/varlık kullanılmaz.

Adayların ana depo lisansı uygun olsa bile transitif paketler, model/doku/font, decoder, görsel, uydu verisi, firmware ve model ağırlıkları ayrı denetlenir. Kullanıcının içe aktardığı görsel dağıtım varlığı sayılmaz. Upstream kaynak ve sabit sürüm kaydedilir. `THIRD_PARTY_NOTICES.md` ve oda paketindeki notice dosyaları gerçek bağımlılık eklenince güncellenir. 02-A/1 yerel editörünün kaynak ve lisans envanteri bildirim dosyasına işlendi.

## 11. Açık konular / sonraki session

02-A Linux kapsamı kapatıldı. Bağımsız kapanış incelemesinde tam kalite günlüğü (1981 pass, 0 fail, 2 skip), paket/ölçüm raporu ve kaynak denetimi değişiklikleri incelendi. Ölçüm ve UI deneyleri uygulama agent'ının kayıtlı sonuçlarına dayanır; full test yeniden çalıştırılmadı. 02-B/1 Linux kapsamında kabul edildi. Bağımsız incelemede referans, ölçüm ve kayıt kaynakları incelendi; 24 Gaia veri testi yeniden geçti. Chromium, Electron ve oda sözleşmesi deneyleri uygulama agent'ının kayıtlı sonuçlarına dayanır. 02-B/2 gerçek arazi kullanımıyla kabul edildi. 02-C Linux kapsamında kabul edildi. Bağımsız kaynak incelemesinde cihaz, gözlem ve kayıt sınırları kontrol edildi; 27 Gaia veri testi yeniden geçti. UI ve Electron sonuçları uygulama agent'ının kayıtlı deneylerine dayanır. 02-D'de özellikle Workspace.svelte değişim eksenleri, durum verisinin yaşam döngüsü ve tam kalite zinciri değerlendirilecek. Kalibrasyon sihirbazı zorunlu kapanış koşulu değildir; modelleme ince ayarları somut ihtiyaçlara göre ertelenebilir. Gerçek cihaz ve ağ davranışı Client ve Router aşamalarındadır. Windows/macOS kurulumu, farklı GPU/sürücüler ve uzun süreli büyük sahnelerde kaynak davranışı açık doğrulama alanlarıdır. Yerel LLM’nin modeli ve çevrimdışı davranışı kendi entegrasyonunda ele alınacak.
