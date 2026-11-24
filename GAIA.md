# Gaia Room

> Durum: Ön planlama ve araştırma tamamlandı. 01-C/D tasarımı ve bağımsız audit tamamlandı; P0 kontratları netleşti. Sıradaki 02-A/1 dar editör entegrasyonu. Teknoloji seçimi koşullu. [Gaia mimari kontratları](GAIA-ARCHITECTURE.md)

Referans uygulama commit'i: `d0e47947` (Hayalet Ev 5.4.0). Bu belge Gaia için mimari karar, proje hafızası, araştırma özeti, açık konular ve geliştirme planının tek başlangıç kaynağıdır. Yeni oda, Client veya Router henüz oluşturulmadı.

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
| 02-A       | Bekliyor                            | İlk çalışan bağımsız oda, yerel editör ve günlük viewer sınırı; kayıpsız round-trip         |
| 02-B       | Bekliyor                            | Modelleme Atölyesi, kalibrasyon, düzenleme ve ölçüm                                         |
| 02-C       | Bekliyor                            | Günlük genel görünüm, hiyerarşik gezinme ve sanal cihazlar                                  |
| 02-D       | Bekliyor                            | Kullanılabilirlik, performans, paket/lisans ve mimari audit                                 |
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

- Şimdi: 02-A/1 dar editör veri turu, ardından diğer 02-A paketleri; modelleme, bağımsız veri, hazır editör ve viewer. Sonraki milestone'lar kendi kapsamıyla açılır.
- Sonra: gelişmiş hayvan/kamera analizi, toprak nemi haritası, güneş enerjisi/invertör, sulama optimizasyonu, hazır protokol adaptörleri, görsel atmosfer.
- Deneysel: Android mesh/repeater, bataryasız ve ekransız anakartlar, fiziksel kamera/mikrofon taşıma, manyetik/RF haritası, otomatik mekânsal çıkarım, dağıtık görüntü işleme. Başarısızlık ana projeyi bloke etmez.

## 10. Lisans ve dağıtım

Hayalet Ev'in özgün kodu MIT kalır. MIT/BSD/ISC ve uygun Apache-2.0 bileşenleri öncelikli; telif, LICENSE ve NOTICE korunur. GPL/AGPL/LGPL/MPL gibi farklı yükümlülükleri olan projeler ancak koşulları ayrı değerlendirilerek fikir referansı veya uygun bağımsız entegrasyon olabilir; izinsiz kaynak aktarımı yapılmaz. Lisansı belirsiz veya dağıtımı yasak kod/varlık kullanılmaz.

Adayların ana depo lisansı uygun olsa bile transitif paketler, model/doku/font, decoder, görsel, uydu verisi, firmware ve model ağırlıkları ayrı denetlenir. Kullanıcının içe aktardığı görsel dağıtım varlığı sayılmaz. Upstream kaynak ve sabit sürüm kaydedilir. `THIRD_PARTY_NOTICES.md` ve oda paketindeki notice dosyaları gerçek bağımlılık eklenince güncellenir; bu plan henüz yeni üçüncü taraf kodu içermiyor.

## 11. Açık konular / sonraki session

Sıradaki aşama 02-A/1. 01-D karar 2 ile tamamlandı: ortak arazi planı, mutasyon öncesi izin profili ve güvenilen tek yazıcı kontratları mimari belgeye işlendi. P1 kabul senaryoları ve P2 erteleme kararları aynı belgede. İlk paket gerçek editör hareketi ve küçük upstream patch ile kayıpsız veri turunu kanıtlar; sonraki paketler bu kapıdan sonra açılır. Teknoloji seçimi koşullu, performans hedefi henüz ölçülmedi. Çok yapılı hiyerarşi ve gerçek hat geometrisi, ayrı viewer, gerçek kalibrasyon, çevrimdışı varlık envanteri, görünürlük/dispose, Android/Router ve yerel model ölçümleri açık. Yerel LLM'nin modeli ve gerçek offline davranışı doğrulanmadı. Son full check referansındaki iki atlanan test ve 282 Fate Knots CSS borcu Gaia işi değildir.

Yeni bir araştırma turu açmak yerine doğrulanabilir en küçük uygulama dilimini hedefle. Şu aşamada oda, manifest, dependency, Client/Router kodu, cihaz kurulumu veya release yoktur.
