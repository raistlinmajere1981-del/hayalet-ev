# Gaia Client · 03-A/3 saha protokolü

**Kabul edilen tasarım, taban `708072cb`.** V1'in teslim ettiği şey, eşlenmiş tek bir fiziksel Client'ın güncel durumudur. Hayalet Ev çalıştığı sürece Gaia Room hiç açılmadan alım yapılabilir. Bu belge 03-B uygulamasının kontratıdır. SM-J701F'de kanıtlananlar API 28/ARM32 üzerinde rootsuz toplama, kısa HOME/ekran kapalı deneyi ve ADB reverse üzerinden beş aktarımla sınırlıdır. Wi-Fi, saha TLS'i, açık Stop ve uzun Doze davranışı ayrı kabul gerektirir. [Ölçüm ve kaynak denetimi](gaia-diagnostic/MEASUREMENT_REPORT.md)

## 1. Dağıtım ve taşıma kararı

| Seçenek                                      | Bu cihaz ve iş yükü için karşılığı                                                                                                                                                                                                                                                |
| -------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **HTTPS POST + JSON, karşılıklı TLS (mTLS)** | Yaklaşık 10 saniyede bir küçük durum, bir istek ve yazıcıdan bir yanıt. Android HTTPS ve Keystore kullanabilir. HTTP keep-alive bağlantı kurma maliyetini azaltabilir. Her istek kendi başına yetkilendirilir. **V1 seçimi.** [HTTP](https://www.rfc-editor.org/rfc/rfc9110.html) |
| Güvenli WebSocket                            | Çift yönlü ve sık mesaj için uygun. Bu işte sürekli soket, ping/pong, yeniden bağlanma ve uygulama düzeyinde kayıt teyidi gerekir. İlk Client'a merkezden komut akışı yok. [RFC 6455](https://www.rfc-editor.org/rfc/rfc6455.html)                                                |
| MQTT/TLS                                     | Birçok üretici/tüketici için topic ve QoS sağlar. Broker, topic ACL'leri ve retained/session ömrü yönetimi getirir. Broker teyidi proje yazıcısının kaydını kanıtlamaz. V1 tek alıcıyla çalışır. [OASIS MQTT](https://docs.oasis-open.org/mqtt/mqtt/v5.0/mqtt-v5.0.html)          |

Client bağımsız APK'dır ve doğrudan Hayalet Ev'e çıkar. İsteğe bağlı Router IP trafiğini taşıyabilir. TLS iki uçta sonlanır. Router kaynağı yeniden imzalama, topluca başkası adına gönderme veya yetki verme hakkı edinmez. Companion kullanıcının taşınabilir kurulum/yönetim aracıdır. Sahadan ayrılabilir. Hayalet Ev eşlemeyi onaylar ve geri alır. Kamera, ses, aktüatör, Cloud ve geçmiş yayını için v1'de uç nokta yoktur.

Merkezde ayrı bir Gaia HTTPS dinleyicisi yalnız yönetici etkinleştirince, seçilmiş yerel arayüz ve portta açılır. Hedef adres kurulumda sabitlenir. Companion HTTP köprüsü kendi loopback/ADB reverse amacında kalır. SSRF yüzeyi açacak callback URL'si, yönlendirme takibi, istemciden dosya yolu, proxy kimlik başlığı veya uzaktan kurulum komutu kabul edilmez. [Companion dinleyicisi](electron/capture-service.ts)

## 2. Kimlik ve eşleme

| Kimlik                    | Sahibi, kapsamı ve ömrü                                                                                                                                                                                                                                                                                                          |
| ------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `projectId + deviceId`    | Envanterdeki mantıksal Gaia cihazı. Projeler aynı yerel cihaz adını kullanabilir. Telefon değişince cihaz ve ilişkileri korunabilir.                                                                                                                                                                                             |
| `installationId`          | İlk kurulumda Client'ın ürettiği rastgele UUID. Uygulama güncellemesi ve reboot boyunca sabit. Yedeğe girmez. Uygulama verisi silinince yeni kimlik oluşur.                                                                                                                                                                      |
| `hardwareId`              | Merkezin fiziksel örneğe atadığı opak Gaia kimliği. Aynı telefona ait olduğuna yönetici fiziksel olarak karar verir. Üretici seri numarası, ADB, IP veya MAC bu bağı ispatlamaz. Aynı anda bir aktif atama.                                                                                                                      |
| Kimlik doğrulama anahtarı | Client'ın Android Keystore içinde ürettiği dışarı aktarılamayan EC P-256 özel anahtarı. İspat TLS el sıkışmasında yapılır. Merkez izin kaydını istemci sertifikasının SHA-256 DER parmak izine bağlar. Donanım destekli Keystore ayrıca ölçülür. [Android Keystore](https://developer.android.com/privacy-and-security/keystore) |
| `runId` ve `sessionId`    | Client her servis başlangıcında yeni UUID üretir. Bu, bir boot'tan daha kısa olabilen örnekleme dönemidir. Merkez her protokol oturumuna yeni, tahmin edilemez UUIDv4 verir. TCP bağlantısı kapanınca HTTPS oturumu başka bir soketten sürebilir.                                                                                |
| `mount`                   | Dünya içindeki isteğe bağlı mekânsal noktanın kimliği. Cihaz taşınabilir veya konumsuz olabilir. Noktayı bilmek gönderim hakkı vermez.                                                                                                                                                                                           |

**İlk kurulum.** V1 için fiziksel erişimli, çevrimdışı kayıt seçilir. LAN üzerinde eşleme servisi gerekmez.

1. Kullanıcı merkezde bir projeyi ve fiziksel envanter cihazını seçer, mevcut donanım bağını görür. Client yerelde anahtar üretir ve imzalı PKCS#10 talebiyle kurulum UUID'sini dışarı verir. Kullanıcı talebi fiziksel olarak seçtiği Client'tan USB üzerinden aktarır, açık anahtarın SHA-256 parmak izini iki uçta karşılaştırır. Ekranı bozuk J701F için yerel USB/scrcpy kullanılabilir.
2. Merkez talep imzasını ve karşılaştırmayı doğrular. Yönetici cihazı, donanım örneğini ve izin verilen capability listesini onaylar. Saha CA'sı `clientAuth` amaçlı sertifika verir. Client'a yalnız sertifika/zincir, beklenen HTTPS adı/portu, güvenilen saha CA'sı ve atama kimlikleri yüklenir. CA parmak izi güvenilen merkez ekranından doğrulanır. Client sertifikasının yerel açık anahtarla eşleşmesi zorunludur. Kurulum, CA'nın imzalama anahtarını Client'a veya Companion'a vermez.
3. Merkezin özel yetki kaydı bir sertifikayı **tek** kurulum, proje, cihaz, donanım ve bağlama nesline bağlar. Aynı kurulum veya donanım için ikinci etkin atama reddedilir. Seri numarası, sertifikanın görünen adı veya JSON'daki kimlik alanı ile atama yaratılmaz. İlk başarılı mTLS ve kurallara uyan ilk paket ayrı olaylardır.
4. Envantere yazma, yetki verme ve iptal yalnız yerel yönetici işlemidir. Yarım kurulum beklemede kalır. Tekrar aynı onay tamamlanabilir. Ağdan gelen capability ilanı envanter kaydetmez.

**Yenileme ve iptal.** Anahtar değişiminde aynı telefon/kurulum için yeni anahtar ve sertifika yerel onaydan geçer. Eski iznin kalıcı iptali, oturumların düşmesi ve yeni neslin etkinleşmesi sıralıdır. Donanım değişiminde yeni `hardwareId` atanır, mantıksal cihaz ve mount korunur. Proje değişiminde eski yetki önce kapatılır. Uygulama silme/veri temizleme veya fabrika sıfırlamasından sonra Client eşlenmemiş başlar. Merkez sıfırlamayı uzaktan bilemez. Yönetici eski izni iptal eder, aynı fiziksel örnek doğrulanırsa hardwareId korunabilir. Eski sertifika, run veya örnek yeni kurulum adına devam edemez. Cihaz kaybında merkezden iptal yeterlidir. Aynı kalıcı TLS bağlantısı ve yeniden başlatılan main dahil her istekte etkin izin yeniden kontrol edilir. Parmak izi onayı yalnız merkezde oturum açmış, yerel yönetim yetkisi olan kullanıcıya sunulur. Saha dinleyicisi izin yönetimi çağrısı kabul etmez.

**Güven sınırı.** LAN dinlenebilir, paket geciktirilebilir ve bir düğüm başka cihazı taklit edebilir. Client yalnız yapılandırılan CA'ya, geçerli zincire, sunucu kullanım amacına ve hedefin SAN adına/IP'sine uyan uçla konuşur. Merkez istemci zincirini, geçerlilik tarihlerini, kullanım amacını ve güncel izin kaydını doğrular. TLS 1.2 tabanı (ECDHE + AEAD), desteklenirse 1.3, erken veri (0-RTT) kapalıdır. Geçerlilik ve iptal kontrolleri havuzlanmış bağlantıda da sürer. TLS sırları, kimlik dosyaları ve ham paketler loglanmaz. Ele geçirilmiş, yetkili bir Client kendi cihazı adına yanlış ölçüm bildirebilir. mTLS ölçüm doğruluğuna veya işletim sisteminin bütünlüğüne kefil olmaz. İptal bu cihazın erişimini keser. [TLS uygulama profili](https://www.rfc-editor.org/rfc/rfc9325.html)

**2017 saatiyle ilk bağlantı.** API 28'de önkoşul hem merkezde hem telefonda yaklaşık doğru sistem tarihidir. Sertifika henüz başlamamış veya süresi geçmiş görünüyorsa Client yerelde saat/sertifika hatasını gösterir, telemetri bekler. Kullanıcı güncel zamanı güvenilen merkez ekranıyla karşılaştırır ve Android Ayarlar'da düzeltir (gerekirse USB/scrcpy ile). Ardından zincir, ad ve tarih dahil normal doğrulamayla yeni TLS bağlantısı kurulur. Saat doğruysa hata sertifika/CA yenileme işine gider. LAN'dan doğrulanmamış saat alma, sertifika tarihini atlama, trust-all veya HTTP'ye düşme yoktur. Geri/ileri saat sıçraması açık bağlantıyı da kapatıp yeni doğrulama gerektirir. Bu düzeltme sensör örnek zamanını değiştirmez. [X.509 doğrulaması](https://www.rfc-editor.org/rfc/rfc5280.html#section-6)

## 3. Tel kontratı ve teslim

V1'de iki POST vardır. Her ikisi mTLS, UTF-8 `application/json` ve `Cache-Control: no-store` kullanır. İki uçta zamanlar ms cinsinden negatif olmayan JSON güvenli tamsayılarıdır. Unix zamanları UTC, seq 1…2⁵³−1 aralığındadır. Sınırda yeni oturum gerekir. Aşağıdaki örneklerde aynı fiziksel cihaz için sekiz capability onaylanmıştır.

**Oturum açma.** `POST /gaia/v1/sessions`. Kimlikler yalnızca sertifikadan çözülen atamayı karşılaştırmak içindir. `offered` bu run'ın ilanıdır. Sunucu yalnız bilinen v1 saha kataloğu ∩ ilan ∩ envanter ∩ merkez iznini döndürür. Bilinmeyen ama sözdizimi geçerli ilan listeden çıkarılır. İzin genişletmek yerel onay ve yeni oturum gerektirir.

```json
{
  "v": 1,
  "projectId": "sera",
  "deviceId": "client-1",
  "installationId": "5f86a875-96ee-48d4-868a-72d18645fabb",
  "runId": "ffd55103-4beb-494d-8a86-02665d15a3db",
  "offered": [
    "battery.level.v1",
    "battery.pack-temperature.v1",
    "battery.voltage.v1",
    "battery.charge-state.v1",
    "accelerometer.xyz.v1",
    "proximity.state.v1",
    "network.state.v1",
    "signal.read.v1"
  ]
}
```

```json
{
  "v": 1,
  "sessionId": "ab7d90f6-124b-487a-a512-2441b5540978",
  "accepted": [
    "battery.level.v1",
    "battery.pack-temperature.v1",
    "battery.voltage.v1",
    "battery.charge-state.v1",
    "accelerometer.xyz.v1",
    "proximity.state.v1",
    "network.state.v1",
    "signal.read.v1"
  ],
  "intervalMs": 10000,
  "timeoutMs": 35000
}
```

`201` ile açılan oturum RAM'de izin nesline, run'a ve o anki `statusEpoch`'a bağlanır. Cihaz başına tek oturum vardır. Etkin oturum varken ikinci açma `409 session_busy` ve kalan bekleme süresini verir. Açma yanıtı kaybolursa Client süre dolunca yeniden açar. Açma tek başına online yapmaz. Yetki veya epoch değişince oturum kapanır.

**Durum ve heartbeat.** `POST /gaia/v1/observations`. Her paket, kabul edilen listenin tamamı için o andaki görünümü taşır. Kabul kümesi boşsa boş dizi de heartbeat'tir. Bir capability için eski olayın hâlâ son olay olduğu bildirilebilir. Merkez yeni örnek üretmez.

```json
{
  "v": 1,
  "sessionId": "ab7d90f6-124b-487a-a512-2441b5540978",
  "seq": 1,
  "sentMonoMs": 1814000,
  "deviceWallMs": 1795647910000,
  "samples": [
    {
      "id": "battery.level.v1",
      "quality": "valid",
      "sampleMonoMs": 1813000,
      "unit": "%",
      "value": 83
    },
    {
      "id": "battery.pack-temperature.v1",
      "quality": "valid",
      "sampleMonoMs": 1813000,
      "unit": "°C",
      "value": 19.9
    },
    {
      "id": "battery.voltage.v1",
      "quality": "valid",
      "sampleMonoMs": 1813000,
      "unit": "mV",
      "value": 4312
    },
    {
      "id": "battery.charge-state.v1",
      "quality": "valid",
      "sampleMonoMs": 1813000,
      "unit": "1",
      "value": "charging"
    },
    {
      "id": "accelerometer.xyz.v1",
      "quality": "valid",
      "sampleMonoMs": 1813970,
      "unit": "m/s²",
      "value": [-0.09, -0.47, 9.68]
    },
    {
      "id": "proximity.state.v1",
      "quality": "valid",
      "sampleMonoMs": 1810000,
      "unit": "1",
      "value": "far"
    },
    {
      "id": "network.state.v1",
      "quality": "valid",
      "sampleMonoMs": 1813980,
      "unit": "1",
      "value": { "transport": "wifi", "internetCapable": true, "validated": false }
    },
    { "id": "signal.read.v1", "quality": "missing", "unit": "dBm", "value": null }
  ]
}
```

**Teyit.** Yalnız eşleşen HTTP 200 ve tam şemalı yanıt o paketin ACK'idir. `acceptedAt` merkezde yeni pakete atanan UTC Unix ms'dir. ACK, tüm örnekler ve link aynı yan dosya yayınında kabul edilince verilir. Örneğin taze/geçerli olduğu, UI'ın gördüğü veya güç kaybında diske mutlaka dayanacağı anlamına gelmez.

```json
{
  "v": 1,
  "sessionId": "ab7d90f6-124b-487a-a512-2441b5540978",
  "seq": 1,
  "acceptedAt": 1795647910913
}
```

Client bir oturumda 1'den başlayan ardışık `seq` kullanır. Bir istek sonuçlanmadan yenisi gönderilmez. ACK kaybında aynı dondurulmuş UTF-8 gövde aynı seq ile yeniden gönderilebilir. Merkez son başarılı seq, gövde SHA-256 özeti ve ACK'i oturum başına tutar. Güncel yetki/oturum geçerliyken birebir son tekrar aynı ACK'i alır. Disk yazısı, son temas, tazelik ve timeout değişmez. Aynı seq farklı bayt, daha küçük seq veya boşluk atomik reddedilir. Oturum kapanınca eski ACK kurtarılmaz. Yeni oturumda eski gövde atılır ve güncel görünüm yeniden toplanır.

| Sonuç                                                      | Client ve merkez davranışı                                                                                          |
| ---------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------- |
| TLS başarısız                                              | HTTP yanıtı beklenmez. Kimlik/sertifika/saat hatası kurulum ekranında gösterilir.                                   |
| 400 `invalid_packet`, 415 `media_type`, 413 `too_large`    | Sürüm, alan, tür, boyut veya kodlama hatası. Paketin tamamı reddedilir. Bozuk gövde tekrar döndürülmez.             |
| 403 `not_authorized`                                       | Atama, iptal veya capability ihlali. Erişim durur, yerel atama yeniden okunur. Karşı projenin envanteri açıklanmaz. |
| 409 `session_expired`, `session_busy`, `sequence_conflict` | Eski/uyumsuz oturumu kullanma. Busy için bekle, sonra yeni oturum ve yeni durum.                                    |
| 429 `rate_limited`, 503 `unavailable`                      | `Retry-After` (tam saniye) ve geri çekilmeye uy. Yazıcı meşgul, bozuk yan dosya veya başarısız yayın ACK üretmez.   |
| EOF, timeout, 3xx, 204, yanlış seq/oturum veya bozuk 200   | Teslim belirsizdir. Sıra ilerlemez. Geçerli süre içinde aynı gövde tekrar denenebilir.                              |

Hata gövdesi örneği `{"v":1,"error":"sequence_conflict"}`. Ağ hatası kısmi başarı döndürmez. İki uçta gövde ve yanıt üst sınırı 16 KiB, başlıklar 8 KiB, derinlik 5, en çok 32 benzersiz capability. Sıkıştırma kapalı. Akışta okunan bayt da sayılır. Açık alan listeleri uygulanır. Yinelenen JSON anahtarı, ekstra alan, tekrar/eksik capability, prototip anahtarı, yol parçası veya güvenli tamsayı dışı zaman/sıra reddedilir. Proje/cihaz segmentleri mevcut `segment` doğrulayıcısına, capability adları `capabilityId` kuralına (1–96 ASCII karakter), tüm UUID'ler küçük harf UUIDv4 biçimine uyar. Başarılı açma yanıtında accepted, offered'ın tekrarsız alt kümesi olmalıdır. Oturum başına tek uçuş, Client başına 12 istek/dk (burst 3), IP başına 30 TLS açılışı/dk ve toplam 16 eşzamanlı bağlantı ilk bütçedir. TLS/başlık/gövde bekleme süresi 5'er saniye, tüm istek için 10 saniye. Kuyruk dolduğunda yük reddedilir. IP limiti yalnız kaynak tüketimini sınırlar.

## 4. Zaman, kalite ve oturum yaşamı

| Saat / sayaç                              | Kullanım                                                                                                                                                                                                                                                                                  |
| ----------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `sampleMonoMs`                            | Sensör olayındaki `SensorEvent.timestamp` ns değerinin ms'ye aşağı yuvarlanmış hali. Boot boyunca uykuyu da sayan elapsed realtime ekseninde. OS durum okumalarının anlamı aşağıda ayrıdır. [SensorEvent](https://developer.android.com/reference/android/hardware/SensorEvent#timestamp) |
| `deviceWallMs`                            | Paketi hazırlarken alınan cihaz UTC Unix ms. Yalnız tanı. Merkezin geleceğinde veya geçmişinde olması, kurulmuş güvenli bir oturumdaki örnek sırasını ve yaşını belirlemez.                                                                                                               |
| `sentMonoMs`                              | İlk gönderim için gövdeyi dondurma anı. Tekrarda sabit. `0 ≤ sampleMonoMs ≤ sentMonoMs`; yeni seq'de gönderim saati gerilemez.                                                                                                                                                            |
| `acceptedAt` ve merkezin monotonik sayacı | İlki insan için UTC kayıt zamanı, ikincisi oturum süresi, bekleme ve tazelik hesabı içindir. Bağlantının kurulması, ilk baytın varışı ve kabul farklı anlardır.                                                                                                                           |
| `seq`, run ve oturum                      | Seq paket sırasıdır. Örnekler aynı run ve oturum içinde capability bazında sıralanır. Yeni seq daha eski örneği ezemez. Reboot, süreç ölümü ve yeni bağlantı oturumu karşılaştırma sınırıdır.                                                                                             |

**Yaş hesabı.** V1 kesin örnek UTC'si üretmez. Client yeni paketini önceki ACK'i (ilk pakette oturum yanıtını) aldıktan sonra dondurur. Merkez `W` olarak bu yanıtın ilk yayınından yeni paketin kabulüne kadar geçen monotonik ms'yi alır. Kabul anında yaş için ihtiyatlı üst tahmin `A = (sentMonoMs − sampleMonoMs) + W` olur. Ağ gecikmesi, tekrar ve yazıcı beklemesi bu sınırın içindedir. Örneğin 30 ms önce örneklenmiş ivme ve 10.000 ms yanıt aralığı için üst yaş 10.030 ms'dir. Arayüz tahmini ölçüm zamanını kullanıyorsa `at = acceptedAt − A` olarak etiketler, ham zamanları korur. Sonraki yaşa merkezde geçen monotonik süre eklenir. 60.000 ms sınırında son bilinen/stale gösterilir. W bilinmiyorsa fresh verilemez. Bu hesap dürüst Client'ın elapsed realtime sayacının sürekliliğini varsayar. Sayaç geriler veya süreklilik bozulursa oturum kapatılır. Merkez uyku/uyanma veya saat sürekliliği kaybında oturumları kapatır. Merkez saati ileri/geri atlayınca sıralama wall clock ile yapılmaz.

**Merkezi saat ve UI sınırı (kabul notu).** Atomik yayından önce proje kilidi altında aday durum için tek monotonik zaman çıpası alınır; `acceptedAt` bu mantıksal kabul anının UTC karşılığıdır. ACK yalnız yayın başarılı olduktan sonra çıkar. Yayın ve sonraki aktarımda geçen süre de gözlem yaşına eklenir; ACK gecikmesi veya disk beklemesi yaşı sıfırlamaz. Yaş hesabı güvenli tamsayı sınırını aşarsa fresh üretme. İlk yanıt çıpası, yanıtın istemciye ulaşabileceği en erken merkezi gönderim anını aşmamalı. Measured görünümde merkez, monotonik yaşa göre kalan fresh/online sürelerini hesaplar; renderer kendi monotonik saatiyle (istek gidiş-dönüş süresini de ihtiyatlı olarak düşerek) bu süreleri azaltır. Cihaz veya merkez UTC tarihinden yeni bir fresh/online süresi türetilmez. UI okuma yolu, iptal edilmiş veya nesli uyuşmayan izni geçerli göstermez; yan dosya yazımı başarısız olsa bile yetki denetimi kapalı davranır. Simulated zaman semantiği korunur.

Aynı capability ve örnek zamanı yeniden taşındığında aynı değer/kalite şarttır. İlk örnek zaman izdüşümü ve yaşlanma devam eder. Çelişen veya gerileyen örnek bütün paketi reddettirir. Araya missing girse bile alıcı, oturumda kabul ettiği son örneğin zamanını ve içeriğini karşılaştırma için tutar. Yeni oturumda Client eski paketi/önbelleği bırakır, aboneliği yeniler ve yalnız oturum yanıtı alındıktan sonraki kanıtı kullanır. Android'in toplu teslim ettiği eski sensör olayı bu monotonik alt sınıra göre elenir. Aynı ms içinde gelen olaylar paket hazırlanırken son değere indirgenir. Daha önce gönderilmiş ms'ye düşen çelişkili bir olayda Client aboneliği yeniler ve ilk yeni kanıta kadar missing bildirir. Önceki oturumun paketini gecikmiş teslim etmek bağlantıyı canlandırmaz.

- **Sürekli ivme.** Her gerçek callback'in zamanı ve tek XYZ üçlüsü birlikte tutulur. En son örnek tekrar gönderilebilir, eski ivme fresh olamaz. Ekran kapanınca wake-up olmayan K2HH durabilir.
- **On-change yakınlık.** Başarılı abonelikten ve ilk olaydan sonra son bildirilen near/far durumu tutulur. Hareketsizken yeni olay gerekmeyebilir. Arayüz abonelik sürerken “son bildirilen durum” ve olay yaşını gösterir. Olay 60 saniye sonra taze ölçüm sayılmaz. Sessizlik kendi başına sensör arızası veya kopma kanıtı değildir. Unregister, yeniden kayıt veya süreç ölümünde yeni ilk olaya kadar missing. Kalıcı yakınlık kanıtı olarak heartbeat kullanılmaz.
- **OS durumu.** Batarya yayınındaki alanlar Android'in bildirdiği paket durumudur. Yeni yayın teslimi yerel monotonik zamanla etiketlenir. Başlangıçtaki sticky verinin fiziksel örnek zamanı bilinmez. Yeni teslimata kadar eski sticky ölçüm missing tutulur. Aynı cache'i her tick yeniden tarihleme yasaktır. Ağ snapshot'ında zaman, geçerli OS ağ durumu sorgusunun anıdır. RSSI, Wi-Fi sürücüsünün bildirdiği son değerdir. Tekrarlanan önbellek sorgusu yeni radyo ölçümü sayılmaz. Zamanı belirlenemiyorsa missing, yeni RSSI bildirimi varsa bildirim zamanı kullanılır.

| Olay                                                 | Merkezde ve uçta geçiş                                                                                                                                                                                                                                  |
| ---------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Eşleme yok / eşlenmiş ama hiç paket yok              | `unbound` / `unknown`. Doğru TLS ve oturum açılması ilk paketi bekletir.                                                                                                                                                                                |
| Yeni seq kabul edildi                                | `online`. Son temas kabul zamanıdır. Bütün değerler missing/invalid olsa da bağlantı kuruludur.                                                                                                                                                         |
| Son yeni kabulden (ilk pakete kadar açılıştan) ≥35 s | Merkez oturumu emekliye ayırır. Daha önce online ise `offline` ve son kopuş kaydedilir. Zamanlayıcı ve her istek kilit altında aynı deadline'ı kontrol eder. Eski timer yeni oturumu kapatamaz.                                                         |
| Kesinti / Client uykusu                              | Client kapasite başına RAM'de tek güncel örnek ve toplam bir sabit istek tutar. Disk kuyruğu yoktur. Geçici hata sonrası üst sınırı 1, 2, 4, 8…60 s olan rastgele gecikme (tam jitter), varsa daha uzun Retry-After. Başarılı yeni ACK sayacı sıfırlar. |
| Merkez kapanıp açıldı                                | Uygulama kapanınca alım durur. Başlangıçta canlı oturum ve tekrar makbuzu yoktur. Eski online işareti gösterilmez. Bağlı cihaz yeni kanıta dek unknown, kayıtlı ölçümler son bilinen/stale'dir. Yeni sessionId ve seq=1 gerekir.                        |
| Açık Stop, iptal veya yeni atama                     | Stop ağ yokken de derhal yerelde tamamlanır. Merkez en geç timeout ile offline görür. İptal ise merkezde derhal işler. Yeni kurulum eski gözlemi tazelemez.                                                                                             |

Bağlantı, kalite ve yaş bağımsız alanlardır. Örneğin online + invalid batarya gerilimi + stale ivme mümkündür. Offline geçişinden önceki ölçüm sonraki heartbeat ile fresh olmaz.

## 5. Capability kataloğu ve değerler

`World.devices[id].capabilities` merkezce kabul edilmiş envanterdir. Fiziksel olarak bulunma, Android kaydının başarılı olması, yerel izin ve bu anda bir değerin okunabilmesi ayrı bilgilerdir. Sensör hiç yoksa ilan edilmez. Tanınan sensör geçici olarak okunamıyorsa ilanda kalabilir ve örneği missing olur. Sunucu `accepted` dışında hiçbir gözlemi veya Client'ın sunduğu bir `source`, `hardwareId`, `statusEpoch` ya da mount alanını kabul etmez.

| Tel kimliği                   | Geçerli değer ve birim                                                 | Örnekleme anlamı                                                                                                                                                                                                |
| ----------------------------- | ---------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `battery.level.v1`            | 0–100 dahil tamsayı, `%`                                               | Android level/scale yüzdesi, scale > 0 ve 0 ≤ level ≤ scale.                                                                                                                                                    |
| `battery.pack-temperature.v1` | Sonlu sayı, `°C`                                                       | Batarya paketinin onda derece alanı / 10. Ortam sıcaklığına yazılmaz.                                                                                                                                           |
| `battery.voltage.v1`          | Negatif olmayan güvenli tamsayı, `mV`                                  | Batarya gerilimi. Eksik Android alanı veya -1 missing üretilmesine yol açar.                                                                                                                                    |
| `battery.charge-state.v1`     | `charging / discharging / full / not_charging` değerlerinden biri, `1` | Android batarya durum kodu. USB takılı olması tek başına charging yapmaz.                                                                                                                                       |
| `accelerometer.xyz.v1`        | Tam üç sonlu sayı [x,y,z], `m/s²`                                      | Android cihaz eksenlerinde, yerçekimi dahil, tek callback'ten. Ekran dönüşü eksenleri değiştirmez.                                                                                                              |
| `proximity.state.v1`          | `near / far`, `1`                                                      | V1 iki durumlu Android profilinde geçerli 0 ≤ okuma < maximumRange yakın, maximumRange uzak. Sonlu ve pozitif aralık gerekir. J701F'de yalnız uzak uç (8 cm) gözlendi. Sürekli mesafe hassasiyeti ilan edilmez. |
| `network.state.v1`            | Tam nesne `{transport, internetCapable, validated}`, `1`               | transport = none/wifi/cellular/other, diğer ikisi boolean. Aktif varsayılan ağ, Android INTERNET ve VALIDATED bitleri. none için ikisi false. LAN'a ulaşılabilirlik mTLS kabulüyle ayrıca gözlenir.             |
| `signal.read.v1`              | Wi-Fi için -126…0 dahil tamsayı, `dBm`                                 | Mevcut sinyal capability'sinin ilk fiziksel profili. Aktif ilgili Wi-Fi ve bilinen RSSI gerekir. -127 geçerli sinyal değildir. SSID, BSSID, MAC, IP veya komşu ağlar gönderilmez.                               |

Her girdide `id, unit, quality, value` zorunludur. **valid** için katalog türünde değer ve olay/okuma zamanı gerekir. **invalid** için `value:null` ve hatalı okumanın `sampleMonoMs` zamanı gerekir. Örneğin `{"id":"battery.level.v1","unit":"%","quality":"invalid","sampleMonoMs":1813000,"value":null}`. **missing** için `value:null`, örnek zamanı yoktur. İzin eksikse, Wi-Fi kapalıysa, ilk sensör olayı bekleniyorsa veya batarya extra'sı yoksa missing kullanılır. Gerçek bir teslimatta gelen çelişkili/aralık dışı değer invalid, Android'in açık “bilinmiyor” sentineli missing olarak kodlanır. Merkez aralık dışı bir `valid` değeri kendiliğinden düzeltmez. 0, false ve [0,0,0] kendi tipinde geçerli olabilir. Missing son snapshot'ta noData, invalid son hatalı ölçüm olarak görünür. Önceki değeri güncel değer alanında göstermezler.

Bugünkü katalog `number | boolean | media`, gözlem değeri `number | boolean | null`, kalite `valid | invalid` kabul eder. `temperature.read.v1` ortam/paket ayrımını, `motion.read.v1` ivme vektörünü, `link.status.v1` OS ağ bilgisini temsil etmek için kullanılmayacak. 03-B'de katalog türüne kapalı enum, sabit XYZ ve kapalı ağ nesnesi doğrulayıcıları eklenir. Mevcut birimler ve sanal cihazların giriş biçimi korunur. `recordStatus`'un tek skaler güncellemesini ağ paketindeki her alan için çağırmak kısmi kayıt ve yanlış saat sırası yaratır. Ölçülmüş snapshot için ayrı atomik domain işlemi ve v3 okuma/yazma gerekir. [Katalog](rooms/gaia-room/scripts/devices/capabilities.ts) · [Durum modeli](rooms/gaia-room/scripts/devices/status.ts) · [Yan dosya](rooms/gaia-room/scripts/storage/status-store.ts)

## 6. Android çalışma kontratı

- Ayrı `gaia-client/` uygulaması, minSdk 28, armeabi-v7a üzerinde çalışabilen Kotlin/Android API'leri. Kullanıcı görünür Activity'den Başlat'a basar. Servis hemen kalıcı bildirimle foreground olur. Tek servis tek örnekleyici ve gönderici sahibidir. Activity sadece izler. Tekrar Başlat, bind veya ekran dönüşü yeni iş başlatmaz. Exported launcher'dan gelen start/stop extras işleme alınmaz, servis exported değildir.
- V1 `START_NOT_STICKY` kullanır. Süreç ölümü, reboot, force-stop ve açık Stop sonrasında tekrar başlatma kullanıcıya aittir. OS'nin onDestroy çağırmasına güvenilmez. Her başlangıç boş cache, yeni run ve oturumla yapılır. Activity kapanması veya unbind, kullanıcının başlattığı servisi durdurmaz. İzleme için kullanılan bind sayısı dengelenir. Bekleyen bind, Stop sonrası servis oluşturmamalıdır.
- Bildirim ve Activity aynı idempotent Stop yolunu kullanır. Yeni tick'i engelle, gecikme/retry ve ağ çağrısını iptal et, açık response/body/stream'i ve bağlantıyı kapat, callback/receiver/sensör aboneliklerini bırak, kanalları ve cache'i temizle, foreground bildirimiyle servisi sonlandır. Geç dönen callback/ACK kapatılan run'a aitse düşer. Blocking I/O, coroutine iptalinde de kesilebilir olmalı. Prototipin timeout, EOF veya herhangi bir satırı başarı sayması taşınmaz.
- Sensör kayıt dönüşünü kontrol et, olayın değerlerini ve orijinal timestamp'ini birlikte kopyala. Başarısız kayıt, güvenilmez doğruluk veya sonlu olmayan değer “0”a dönüştürülmez. Düşük sıklıkta (`SENSOR_DELAY_NORMAL`) dinle, her callback'i göndermek yerine son örneği al. Sensör veya ağ değişince abonelik ve geçerliliği yeniden değerlendir.
- API 28 için asgari manifest izinleri `FOREGROUND_SERVICE`, `INTERNET`, `ACCESS_NETWORK_STATE`, Wi-Fi RSSI okunacaksa `ACCESS_WIFI_STATE`. Konum/SSID taraması, kamera, mikrofon, BOOT_COMPLETED, kalıcı wake lock veya root gerektiren yol yoktur. Yeni Android hedeflerinde bildirim görünürlüğü ve kullanılan foreground service türünün izin/süre kuralları platforma göre ayrıca karşılanır. `dataSync` kesintisiz çalışma garantisi vermez. [Android FGS süreleri](https://developer.android.com/develop/background-work/services/fgs/timeout)
- Ekran kapalıyken Android örnekleme ve ağı erteleyebilir. Zamanlayıcı gecikirse tek güncel snapshot gönderilir. Kaçan tick'ler telafi edilmez. Kullanıcının güç ayarlarını sessiz değiştirme, root veya uyanık tutma yoluna gidilmez. Ayrı bir yeteneğe geçiş için önce ölçülmüş ihtiyaç gerekir. Kısa USB deneyi sürekli pil performansı kanıtı sağlamaz. [Prototip kaynakları](gaia-diagnostic/app/src/main/kotlin/com/hayaletev/gaiadiagnostic) · [Manifest](gaia-diagnostic/app/src/main/AndroidManifest.xml)

## 7. Merkezi alıcı ve kalıcılık

**Giriş sınırı.** Uygulamaya derlenmiş, incelenmiş Gaia sağlayıcısını Electron main başlatır. Bileşim noktasında sağlayıcıya güvenilir oda storage kökü ve uygulama başlat/kapat olayları verilir. Arayüz açıkken başlatmaya, sahte webContents/owner üretmeye veya bir oda paketinden keyfî main kodu yüklemeye gerek yoktur. Alan doğrulayıcıları ve protokol Gaia'ya aittir. Core yalnız genel yaşam döngüsü ve güvenli kök çözümlemesi sağlar. `executeRoomStorage` webview ana frame, partition, URL, manifest ve komut kapsamını doğrulamayı sürdürür. `GaiaStatus` okuması yetkili oda oturumunda hem gerçek hem sanal görünümü alabilir. Yazma komutu yalnız sanal güncellemeyi ayrıştırır ve `source:"simulated"` değerini main koyar. Fiziksel alıcı IPC komutu olarak kaydedilmez. [Bileşim](scripts/rooms/electron-main.mjs) · [IPC sınırı](electron/rooms/storage-commands.ts) · [Oda sağlayıcısı](rooms/gaia-room/scripts/storage/provider.ts)

**Bir paketin kabulü**

1. HTTPS katmanı bütçeleri, TLS istemci kimliğini ve tel şemasını doğrular. Sertifika kaydından sabit `projectId/deviceId/hardwareId/installationId` çözülür. Proje dizini sunucunun oda kökünden ve doğrulanmış segmentten bulunur. Dizin yaratma veya istemcinin yolunu kullanma yoktur.
2. Mevcut `serialized(dir, work)` ve çapraz süreç kilidi içinde kanonik `world.json` tekrar okunur. Yetki nesli, son kullanma/iptal, etkin oturum, timeout, epoch, fiziksel kaynak ve hardwareId, accepted kümesi ile seq **burada** yeniden kontrol edilir. Paralel iki paket veya eşzamanlı envanter kaydı girişteki bir kontrole dayanarak yayın yapamaz. Link timeout ve iptal de aynı sıra sınırını kullanır. Kayıt kilidi alınamazsa sınırlı bekleme veya 503 uygulanır. [Tek yazıcı ve atomik yayın](rooms/gaia-room/scripts/storage/files.ts)
3. Main `measured` kökenini ve bağlamı ekler. Bütün örnekler, zamanlar ve son bağlantı tek aday durum olarak doğrulanır. Kimliği doğrulanmış önceki durumdaki diğer cihazlar korunur. `device-status.json` tek geçici dosya + atomik rename ile yayımlanır. Ancak bundan sonra, kilit bırakılmadan RAM'deki son seq/özet/ACK ilerler. Ana süreç tam bu arada ölürse eski oturum sona erer, sonraki oturum güncel snapshot ile yakınsar. Gözlem dünya revizyonu, envanter, mount, geometri, `lastOperation` veya `statusEpoch` yazmaz.
4. UI görünürken mevcut oda oturumundan ilk snapshot hemen, devamı en çok 10 s aralıklı tek uçuşlu durum okumasıyla alınır. Gizlenme bekleyen isteği geçersiz kılar. Yeniden açılış aynı proje ve kayıtlı dünya revizyonuna ait en yeni snapshot'ı gösterir. Hata eski belleği temizler. Main kabulü veya timeout için UI timer'ı gerekmez. [Görünürlük ve istek sırası](rooms/gaia-room/scripts/editor/site/status-session.ts)

**Bağlamayı yayımlama.** Yerel yönetim, özel bir merkezi izin deposunda sertifika izi ve bağlama neslini saklar. Ağ ve renderer bu depoyu okuyup yazamaz. CA anahtarı, TLS özel anahtarı ve yönetici yetkisi dünyadan/yan dosyadan ayrıdır. İzin deposu güncellemeleri tek merkezi yönetim yazıcısında sıralanır. Atamayı etkileyen işlemler hedef proje kilidinde güncel izinle tekrar karşılaştırılıp atomik yayımlanır. Kilit sırası proje → kısa süreli yetki deposu kilididir. İstek yönlendirmek için yapılan ilk izin okuması proje kilidi beklerken kilit tutmaz. Birden fazla proje varsa eski projede iptal tamamlanır, sonra yeni projede etkinleştirilir. Aynı kilitler ters sırayla veya yeniden alınmaz. Tek merkez örneği özel yetki deposunun yazarıdır. İkinci örnek alıcı/yönetim sahipliğini alamaz.

Yönetici donanım bağlama değişikliğini beklenen dünya revizyonu ve mevcut bağla yapar. Eski izin önce kalıcı olarak etkisizleştirilir. Dünya normal proje yazıcısıyla yayımlanır, yan dosya eşitlenir, yeni izin yalnız tekrar okunan doğru dünya için etkinleşir. Yarım işlem en fazla yetkisiz bir envanter kaydı bırakır. Otomatik geri yetkilendirme yapılmaz. İptal yan dosya arızasına bağlı değildir. İptalli veya nesli değişmiş bağa ait link fresh/online görünemez.

**Envanter yarışı.** Mevcut kuralda cihaz ID/kaynak/hardwareId/sıralanmış capability kümesi değişirse zarfın `statusEpoch`'u aday revizyona ilerler, salt ad, mount veya sıra değişiminde sabit kalır. Dünya önce yayımlanır, sonra önceki kimlikten geçerli kayıtlar süzülür. İzin kaydı hedef proje epoch'unu da taşır. Dünya değişimini işleyen yazıcı yalnız doğruladığı önceki epoch'tan, aynı fiziksel atama sürüyorsa izni yeni epoch'a taşıyabilir. İzin kümesini genişletmez. Silinen/değiştirilen atamanın izni kapatılır. Ara adım kaçırılmışsa eski izin kendiliğinden geçerli olmaz. Bilinmeyen nesilde yerel onay gerekir. Bu kontrol dinleyici kapalıyken yapılan envanter kaydına da uygulanır. İzin deposu erişilemezse kanonik dünya kaydı geçerli kalır ve fiziksel alım kapalı kalır. Böylece A→B→A, silip aynı ID'yi oluşturma ve kilitte bekleyen eski paket yeni cihaza örnek bağlayamaz. Aynı projede ilgisiz bir cihaz epoch'u artırırsa etkin Client da yeni oturum açar. Bu maliyet ilk sürümde kabul edilir.

**Yan dosya v3 geçişi.** Zarf `schemaVersion, identity, devices` alanlarını tutar. `identity` mevcut `deviceStatusIdentity(world, epoch)` hesabıdır. V3 measured satırı cihaz başına hardwareId, installationId, izin nesli, run/session, son paket seq, sentMonoMs/deviceWallMs ve merkezi temas/kopuş bilgisini tutar. Capability başına yalnız son görünüm, özgün örnek zamanı, örneğin ilk kabul zamanı ve ilk yaş üst tahmini tutulur. Cihaz satırı son yeni paketin merkezi kabul zamanını, capability satırı ise örneğin ilk kabul edildiği paketteki gönderim zamanını ve ilk yaş tahminini korur. Eksik girdide örnek zamanı yoktur. Oturumda tekrar denetimi ve yaş hesabı için kullanılan monotonik sayaçlar RAM'dedir. Açılışta RAM sürekliliği veya etkin bağ olmadan v3 satırı canlı gösterilmez. Reboot sonrası eski wall timestamp'ten fresh hesaplanmaz.

- Geçerli v2 kimliği bugünkü dünya/epoch ile eşleşiyorsa sanal skaler kayıtlar kayıpsız okunur. V2 measured için v3 oturum/yaş kanıtı yoktur, en fazla son bilinen olarak okunur. V2 sanal girişteki `at ≤ receivedAt` ve skaler tip doğrulaması aynı kalır. V3 measured sırası için bu alanlara cihaz wall clock'u yerleştirilmez. Geçiş ilk başarılı yazıda atomiktir. V1'in kimliksiz geçmişi, v2/v3'ün uyuşmayan kimliği güvenilir örnek üretmez. Okunabilir ama eşleşmeyen yan dosya ilk başarılı güncellemeyle yalnız doğrulanmış durumdan kurulur.
- Silinen cihaz/donanım, kaldırılan capability, emekli izin nesli tekrar etkin gösterilmez. Ad ve mount değişikliği geçerli örneği korur. Dünya yayınlanamazsa durum eşitlenmez. Dünya yayınlandıktan sonra yan dosya eşitlemesi başarısızsa dünya kalır, eski kimlik görünmez. Bozuk JSON, bilinmeyen şema, güvensiz yol/symlink veya okunamayan yan dosyada durum hatası verilir. Dosyanın üstüne boş durum yazılmaz. Dünya açılabilir ve düzenlenebilir. Disk hatasında ACK ve seq ilerlemez.
- Son durum yayımları düşük frekanstadır. Geçmiş tablosu, broker, sınırsız log veya ham sensör kuyruğu kurulmaz. Şema değişimi için v2 okuma fixture'ı ve downgrade davranışı gerekir. Eski yazılım v3'ü durum hatasıyla korur. Dünya formatının ve proje kurtarma davranışının testi bağımsızdır.

## 8. 03-B iş paketleri ve kabul

Aşağıdaki yollar yeni modüller için önerilen sahiplik sınırlarıdır. Her satır tek başına DeepSeek veya Nexa'ya verilebilir. “Girdi” sütunu hazır olması gereken kontrat veya sahte bağımlılığı belirtir. Üretime bağlama son iki pakettedir.

| Paket                           | Girdi → teslim / dosya sınırı                                                                                                                 | Tek başına geçme ölçütü                                                                                                 |
| ------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------- |
| B1 · Tel fixture'ları           | Bu belgedeki iki POST → `gaia-protocol/v1/` altında ortak şema, JSON istek/yanıt ve hata fixture'ları                                         | Her iki dilde kullanılabilir sekiz tip, sürüm, limit, missing ve invalid örnekleri (T1, T2).                            |
| B2 · Son durum modeli           | B1 fixture → `rooms/gaia-room/scripts/devices/{capabilities,status}.ts` ve `storage/status-store.ts`                                          | Geçici dizin ve sahte saatle atomik snapshot, v1/v2/v3, iki kaçırılmış eşitleme, sanal regresyon (T2, T5, T8).          |
| B3 · Yerel yetki ve bağlama     | Sahte sertifika izi + geçici proje → Gaia'ya ait `scripts/field/enrollment.ts` (oda altında), `storage/provider.ts` içinde dar yönetim işlemi | CSR/onay, tek etkin bağ, revoke/rebind, bekleyen işlem ve kesinti testleri (T3, T7).                                    |
| B4 · Oturum ve teslim           | B1, sahte izin/yazıcı/saat → oda altında `scripts/field/session.ts`                                                                           | Seq, ACK kaybı, yaş, deadline ve restart salt durum testi (T4–T6).                                                      |
| B5 · Android servis ve toplama  | B1, sahte gönderici → bağımsız `gaia-client/app/` içinde service ve hardware                                                                  | API 28 yaşam döngüsü, minimum izin ve kanıt zamanları (T2, T9).                                                         |
| B6 · Android mTLS ve ACK        | B1, yerel test CA'sı → `gaia-client/app/` içinde enrollment ve transport                                                                      | Keystore CSR/sertifika içe alma, SAN/tarih, doğru ACK, iptal/cleanup; J701F uyumluluğu hedefli doğrulanır (T3, T4, T9). |
| B7 · Main entegrasyonu          | B2–B4 → oda altında `scripts/field/receiver.ts`, mevcut storage ve `scripts/rooms/electron-main.mjs` bileşimi                                 | İzole kökte tek HTTPS dinleyici, gerçek kilit/yan dosya ve UI'sız ingest (T3, T6–T8, T10).                              |
| B8 · Görünüm ve uçtan uca kabul | B5–B7 → mevcut `scripts/editor/site/status-session.ts` ve durum panelleri, TR/EN; Nexa izole Client/merkez kabulü                             | T1–T10 sonuçları ve ölçülmeyenlerin kaydı. Gerçek izole Wi-Fi, şarjsız uzun çalışma ve saha maliyeti 03-C'ye gider.     |

**B1 uygulama sınırı:** Ortak tel şeması ve iki dilin kullanabileceği pozitif/negatif fixture'lar tek otoriteden üretilecek. JSON şemasının nesneye ayrıştırma öncesi yinelenen anahtarı, UTF-8 hatasını, ham bayt sınırını veya oturum bağlamını tek başına doğruladığı varsayılmaz. Bunlar için ham gövde fixture'ları ve B4/B6/B7'ye açık doğrulama yükümlülüğü bulunur. Yeni genel parser veya ağ framework'ü B1'in hedefi değildir. Test girişleri mevcut kalite zincirine bağlanır; kökteki yeni dizinin format/type/test kapsamına kendiliğinden girdiği varsayılmaz.

**B2 kabul sınırı:** `projectPhysicalSnapshot(dir, world, epoch, input, previousLive?)` son başarılı cihaz satırının RAM kanıtını açıkça alır. `PhysicalLiveProof.identity` güncel envanter/epoch ile ve canlı satırın kalıcı izdüşümü disk satırıyla eşleşmelidir. B4 bu kanıtı yalnız başarılı yayından sonra günceller, oturum veya epoch değişince bırakır. İlk pakette önceki kanıt kullanılmaz; aynı kayıtlı oturum canlı kanıt olmadan sürdürülemez. B4/B7 sıralama, ilk seq=1, yetki, epoch, timeout ve ACK tekrarını ayrıca doğrular. Bu API gizli global durum önbelleği oluşturmaz. UI okuma sırasında canlı kanıt birleştirme ve monotonik kalan süre B7/B8 işidir.

**B3/1 · yerel otorite.** İlk güvenilir kurulum `provisionAuthorizationStore` ile özel kökte yapılır. `<storageRoot>/.field-provisioned` yalnız ilk kurulum işaretidir; yetki veya yedek taşımaz. `field/authorization.json` (yetki şeması 2) tek yetki geçmişidir. Normal okuma/yazma eksik geçmiş oluşturmaz. Eksik, bozuk, tanınmayan veya güvenli olmayan kayıt fiziksel kararı kapatır; dünya açılır ve düzenlenebilir. Kabul öncesi yetki şeması 1'den onay türetilmez. POSIX'te kanonik özel kök, işaret, `field` ve kayıt kullanıcıya ait ve özel olmalıdır. Symlink ve çok bağlantılı yetki dosyası reddedilir. İşaret ve dosya yerel yöneticiye karşı bir imza veya geri sarma koruması değildir.

**Onay ve tekrar.**

- `begin` donanımı ilk kez dünyaya yazacaksa, işlem kimliğini ve onay özetini önce merkezi depoda ayırır. Bu rezervasyon da `pending` de gönderim hakkı vermez. `complete` güncel dünya, epoch ve varsa etkin yenileme öncülünü doğrular. İptal edilmiş nesil ve sertifika tarihçede kalır. Yalnız bekleyen yenilemeyi iptal etmek ebeveyni açık bırakır; sonraki nesil iptal edilen numarayı kullanmaz.
- `rebindHardware`/`reassign` eski yetkiyi kapatırken **aynı atomik yayında** işlem kimliğini, tam kanonik istek özetini (beklenen revizyonlar dahil), çözümlenmiş hedef bağı, sertifikayı, izin kümesini, gözlenen hedef revizyonunu ve halef neslini kaydeder. Projeler arası taşımada hedef gözlemi ve kaynak iptali ayrı kilitlerde yapılır. Hedef yayını güncel kilitli dünyayı tekrar doğrular. Envanter ara adımının makbuzu yalnız aynı işlem kimliği, özet ve tam sonuç revizyonuyla geçerlidir.
- **Tekrar** aynı onaydır. Tamamlanmış tekrar ilgili proje kilidinde yeniden okunan satırı döndürür; dönmüş bir makbuz gönderim yetkisi değildir. Yarım taşımada değişmiş alan veya revizyon kabul edilmez. Hedefte ilk onay anında bulunmayan bir revizyon daha sonra aynı sayıya ulaşsa da geçerli olmaz. **Çatışma** eski işlemi yeni revizyona taşımaz. **Yeniden onay** için güncel envanter okunur; yarım taşıma iptal edilir ve yeni işlem kimliği, yeni sertifika, açık `begin` ve `complete` ile **yeni yetki** verilir. Bu yeni lineage eski izni geri getirmez.
- Açık iptal henüz bitmemiş taşımayı ve ayrılmış hedef sertifikasını kapatır. Taşıma veya yenileme önce tamamlanmışsa iptal, aynı lineage'taki tamamlanmış halefe gidip onun proje kilidinde yeniden doğrulanır; varsa bekleyen yenilemesi de kapanır. İptal makbuzunun tekrarı yeni bir iptal kararı üretmez. İptal dünya veya v3 yan dosyasının okunabilirliğine bağlı değildir.

**Sahiplik ve fiziksel yayın.** Güvenilen main `openFieldAuthority(storageRoot)` sahibini alır; ikinci süreç istekler arasında da aynı kökün sahibi olamaz. `close()` başlamış işleri bitirir. `enrollmentCommand` ve `withVerifiedAssignment` bu sahibin metotlarıdır; oda/renderer komutu değildir. Dünya kaydı ve mutabakat mevcut proje yazıcısında kalır. `statusEpoch` değişince yalnız doğrulanmış önceki epoch'ta süren aynı donanım bağı taşınır; mevcut izinler yalnız daraltılır. B4/B7 açık oturumdaki her işlemde **oturuma sabitlenmiş** `authorizationGeneration` ve `statusEpoch` değerlerini `withVerifiedAssignment`'a verir. Karar ve yan dosya yayını aynı proje kilidinde kalır. B4 oturumun geçerliliğini, deadline, seq, ACK ve `PhysicalLiveProof` yaşamını ayrıca denetler. B7 mTLS eş kimliğini çözer ve bu sınırı UI'dan bağımsız kullanır.

### 03-B3/2 · Yerel saha PKI ve USB paketi v1

**İlk merkez kurulumu.** Güvenilen yönetici yeni, kanonik ve kullanıcıya özel bir kökte önce `provisionAuthorizationStore`, ardından sahibi kapalıyken `provisionFieldCa` çağırır. İkinci işlem boş şema 2 geçmişi ister. Merkeze özgü, kendinden imzalı CA'nın DER sertifikası `field/pki/ca.der`, bağımsız sabitlenen SHA-256 izi `.field-provisioned/x509/sha256` içindedir. Bu iki dosya ayrı denetlenir. Tüm parmak izleri küçük harfli, ayraçsız 64 hex karakterdir. Sertifika için DER'in, anahtar karşılaştırması için DER SubjectPublicKeyInfo'nun SHA-256 özeti alınır.

İmzalama ortamı merkez diski, Git çalışma ağacı, oda kaynağı ve yedekleme kapsamları dışında, yöneticinin çıkarıp sakladığı özel bir dizindir. CA anahtarı `gaia-signing/ca.key` içinde passphrase ile şifrelenmiş PKCS#8 olarak tutulur. Yönetici güçlü, benzersiz passphrase'i ayrı saklar ve yalnız imza sırasında sağlar. Alıcıya ortam yolu veya passphrase verilmez. Ortam eksikken geçerli kurulu çiftler çalışabilir. `rotateFieldServer` bağımsız sunucu anahtarı ve sertifikasını tek atomik `field/pki/server.pem` yayınında değiştirir. Alıcı bu çifti ve **açık** CA'yı okur. Sunucu anahtarının disk koruması işletim sistemi hesabına dayanır. Özel dizinler 0700, dosyalar 0600 oluşturulur. Mevcut nesnelerde sahiplik, grup/diğer erişimi, kanonik dizin, symlink ve dosya bağlantı sayısı denetlenir. B7 bu kökleri yalnız güvenilen yerel yapılandırmadan alır. Aynı işletim sistemi hesabını ele geçiren bir süreç bu korumanın dışındadır.

| Profil  | Anahtar ve imza                              | X.509 v3 uzantıları                                                                            | Ömür ve yenileme                                                             |
| ------- | -------------------------------------------- | ---------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------- |
| Saha CA | Merkezde EC P-256, ECDSA/SHA-256             | Kritik Basic Constraints CA=true, pathLen=0; kritik KU keyCertSign; SKI                        | 3650 gün. Son 365 günde yeni güven köküyle fiziksel yeniden kurulumu planla. |
| Sunucu  | Merkezde ayrı EC P-256, CA imzası            | Kritik CA=false ve KU digitalSignature; yalnız serverAuth EKU; SKI, AKI ve tek DNS veya IP SAN | En çok 365 gün. Son 30 günde yönetici anahtar ve sertifikayı değiştirir.     |
| Client  | Cihazda Android Keystore EC P-256, CA imzası | Kritik CA=false ve KU digitalSignature; yalnız clientAuth EKU; SKI ve AKI                      | En çok 365 gün. Son 30 günde yeni anahtar, yeni CSR ve açık yenileme onayı.  |

Yıllık uç sertifikası bir saha bakım ziyaretiyle yenilenebilir. 30 gün bu ziyareti planlamak için pay bırakır. Başlangıç merkez UTC saatinde imza saniyesidir. Geri tarihleme yapılmaz. Uç sertifikası CA'dan sonra bitemez; kalan CA ömrü 30 gün veya daha azsa yeni uç imzalanmaz. İki uç da yaprağın ve kökün geçerlilik aralığını denetler. Uygulama profili her iki sınırı dahil eder. Sunucu SAN'ı kurulumdaki kanonik HTTPS origin'in host kısmıdır. DNS tam adla, IP ikili iPAddress SAN ile karşılaştırılır. Wildcard, CN fallback, kullanıcı bilgisi, yol, sorgu ve fragment kabul edilmez. Port kurulum onayına bağlıdır. TLS el sıkışması özel anahtara sahipliği ayrıca ispatlar. [X.509](https://www.rfc-editor.org/rfc/rfc5280.html) · [PKCS#10](https://www.rfc-editor.org/rfc/rfc2986.html)

**USB sözleşmesi.** Dosyalar UTF-8 JSON nesneleridir. Alan adları ve sürüm birebir doğrulanır. DER alanı tek bir nesnenin standart, dolgulu Base64 kodlamasıdır (en çok 24.000 karakter). Aktarımda özel anahtar, PIN, passphrase veya dosya yolu alanı bulunmaz.

1. B6, yerel Keystore alias'ında P-256 anahtarı oluşturur. USB istek nesnesi `{version: 1, installationId, csr}` taşır. CSR v0, namedCurve P-256, sıkıştırılmamış nokta ve ECDSA/SHA-256 kullanır. Attributes alanı boş `[0]` olur. `inspectUsbRequest` özgün imzalı talep baytlarını doğrular ve SPKI izini döndürür. CSR konusu serbesttir. Extension veya başka attribute isteyen talep reddedilir.
2. Yönetici fiziksel telefondaki SPKI izini ve kurulum UUID'sini merkezde karşılaştırır. Yönetim adaptörü bağımsız olarak seçilen envanter ve karşılaştırılan değerlerle `InstallationApproval` oluşturur. `issueLocalInstallation` güncel dünya revizyonunu ve donanım bağını okur. Onay, işlem UUID'sini, proje, cihaz, donanım ve kurulum kimliğini, capability kümesini, revizyonu, açık anahtar ve CA izlerini, HTTPS hedefini ve işlemin türünü bağlar. `renew`, `rebindHardware` ve `reassign` öncül atama ID'sini, `reassign` ayrıca kaynak dünya revizyonunu taşır.
3. Yanıt `{version: 1, approval, clientCertificate, caCertificate}` biçimindedir. Doğrudan zincir sırası `[clientCertificate, caCertificate]` olur. Client sertifikasının merkezce üretilen tek CN değeri onay özetidir. Bu alan USB paketinin bütünlüğünü doğrular. Gönderim yetkisinin otoritesi şema 2 geçmişindeki DER sertifika izidir.
4. B6, güvenilen merkez ekranında okunan **CA izini**, cihazın kendi installationId'sini ve Keystore alias'ının **açık** anahtarını kullanarak `verifyClientInstallation` denetimlerini uygular. Kendi anahtarını dışarı aktarmadan zinciri bu alias'a bağlar. İçe alma ve Android TLS sağlayıcısı B6 kabulüne aittir.
5. Yerel yönetim sahibi `enrollLocalInstallation` ile aynı imzalı paketi yayımlar. İlk bağ ve yenileme `pending` döner. Yönetici kurulum doğrulandıktan sonra ayrı bir `complete` işlemiyle etkinleştirir. Rebind ve reassign mevcut B3/1 iptal, taşıma ve nesil sırasını kullanır. Tamamlanmış makbuz her yeni istekte güncel yetki denetimi gerektirir.

B6 için onay özeti, aşağıdaki dizinin boşluksuz ECMAScript `JSON.stringify` kodlamasının UTF-8 baytları üzerinden SHA-256'dır. Capability'ler benzersiz ASCII anahtarlardır ve artan sıraya dizilir. Revision alanları JSON güvenli tamsayılarıdır. Değişmeyen UTF-8 metinler yeniden normalize edilmez.

```text
["gaia-install-v1", operationId, projectId, deviceId, hardwareId, installationId,
 capabilities, expectedRevision, publicKeyFingerprint, caFingerprint, httpsOrigin,
 change.kind, predecessorAssignmentIdOrNull, expectedSourceRevisionOrNull]
```

**Kesinti ve iptal.** Merkez, imzalı sertifikayı USB'ye döndürmeden önce `field/pki/issued.json` içinde işlem UUID'si altında atomik yayımlar. Bu kayıt yeniden denemede ilk sertifikayı buldurur; etkin atama yaratmaz. Aynı onayı tekrar sunmak ilk sertifikayı döndürür. İçeriği değişen onay eski sertifikanın imzalı özetiyle eşleşmez. Henüz atamaya dönüşmemiş üretim `discardUnpublishedInstallation(operationId)` ile kalıcı olarak kapatılabilir. Sonraki başvuru yeni işlem kimliği gerektirir. Atama veya taşıma rezervasyonu yayımlandıktan sonra B3/1 `revoke` kullanılır. Üretim ve kurulum işlemleri PKI dizininde, envanter ve yetki yayınları mevcut proje → yetki kilidi sırasında yürür. Telemetri yayını PKI yönetim kilidini almaz.

**B4/B7 sınırı.** B7 `openFieldAuthority(root, {certificatesRequired: true})` ile sahipliği alır ve `readFieldServerIdentity` ile başlangıç kimliğini yükler. mTLS katmanında CA'ya doğrulanmış soketten aldığı eş DER'ini her istekte `withVerifiedClient(project, peerDer, expected, work)` üzerinden taşır. Bu çağrı dünya, güncel atama, DER izi, amaç, CA ve tarihleri proje kilidinde denetler. B4 açık oturumda `expected.authorizationGeneration` ve `expected.statusEpoch` değerlerini sabitler. İlk oturum açılışında henüz nesil bilinmediğinden boş beklenti kullanılabilir. B7 sunucu sertifikası süresi, saat sıçraması, yeniden yükleme ve güven değişikliğinde havuzlanmış bağlantıları da kapatır. Temel çalışma zamanı Node kriptografisi, PKI.js ve ASN1js'tir. Harici OpenSSL yürütülebilir dosyasının PATH, DLL, sürüm veya platform kurulumu üretim önkoşulu değildir. Windows ACL adaptörü ve paketlenmiş Electron main doğrulaması tamamlanana kadar B3/2'nin özel anahtar kurulumu Linux kabulüyle sınırlıdır.

#### Kayıp ve güvenli yeniden kurulum

| Olay                                                        | Yerel yönetim kararı                                                                                                                                                                                                                                                                                                                                                           |
| ----------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| CA imzalama ortamı veya passphrase kayıp                    | Mevcut geçerli sertifikalar ömürleri ve etkin izinleri boyunca kullanılabilir. Yeni üretim durur. Korunan çevrimdışı yedek ve ayrı saklanan passphrase varsa CA açık anahtarı ile merkez izini eşleştirerek aynı imzalayıcıyı geri getir. Yoksa yeni CA ile fiziksel kurulum yap.                                                                                              |
| CA anahtarı ele geçirilmiş veya güveni belirsiz             | Alıcıyı durdur, oturumları kapat. Eski köke güveni merkezden ve telefonlardan kaldır. Temiz kökte yeni CA ve sunucu anahtarı oluştur. Her telefonu fiziksel olarak yeniden karşılaştır, yeni anahtar/CSR ve yeni izin ver. Eski CA'ya dayalı paketleri yeniden kullanma.                                                                                                       |
| Sunucu anahtarı kayıp                                       | Alıcı kapalıyken sağlam CA ile aynı onaylı host için yeni çift üret, yeniden yükle ve eski soketleri kapat. Anahtarın çalınması olasıysa eski sunucu sertifikası ömrü dolana kadar taklit riski sürer; bu profilde güven kökünü değiştirerek yeniden kur.                                                                                                                      |
| Telefon kayıp veya sıfırlanmış                              | İlgili atamayı merkezde iptal et. Cihazın geri gelmesini bekleme. Sıfırlanan telefonda yeni installationId, Keystore anahtarı, CSR ve yerel onay gerekir. Yalnız fiziksel örnek yeniden tanınırsa hardwareId korunabilir.                                                                                                                                                      |
| Uç sertifikası veya kök süresi dolmuş                       | Alımı durdur. Saat doğruysa uç sertifikası için açık yerel yenileme yap; kök süresi dolduysa yeni köke geç. Telefon 2017 gösteriyorsa güvenilen merkez saatine göre Android Ayarlar'da düzeltip normal zincir ve SAN denetimiyle bağlan.                                                                                                                                       |
| Yetki geçmişi eksik, bozuk veya yedeğin güncelliği belirsiz | Fiziksel alımı kapalı tut, bozuk dosyaları inceleme için ayrı koru. Yerel dünya/proje kullanılabilir. Bu sürümde geri sarılmadığı kanıtlanabilen yetki geri yükleme mekanizması yoktur. Boş depo oluşturarak onarma veya eski izni etkinleştirme. Yeni özel kökte **yeni CA, yeni yetki geçmişi ve her cihaz için fiziksel yeniden onay** kullan. Dünya envanterini ayrı taşı. |
| İlk CA kurulumu yarım, CA/pin veya üretim makbuzu bozuk     | Eksik alanları otomatik oluşturma. Yeni imzalama ve paket uygulamasını durdur. Hiç tamamlanmamış ilk kurulumu ayrı yeni köklerde başlat. Mevcut merkezde güven geçmişinin bütünlüğü belirsizse fiziksel yeniden kurulum yolunu izle.                                                                                                                                           |

**Genel geri yükleme sınırı (B3/2-R).** Güncel hedef kökte `field` veya `.field-provisioned` mevcutsa (bozuk/kısmi nesneler dahil), eski genel yedeklerden `projects/*/world.json` ve `device-status.json` dosyaları geri yüklenmez. Dünya epoch'unun geri sarılması, kaçırılmış mutabakat sonrası eski atamayı canlandırabilir. Yetki alanı ve işaretleri her durumda genel backup/restore ve Drive dosya seçiminin dışındadır. Normal, henüz provision edilmemiş kökte restore ilk saha kurulumuyla ortak merkez sahipliği kilidi altında sıralanır. Meşgul kilitte Gaia durum dosyaları atlanır. Önizleme ve uygulama aynı güncel hedef politikasını kullanır; atlama sayısı kullanıcıya bildirilir. Fiziksel merkezde dünya kurtarma ayrı, açıkça yetkilendirilen yeniden kurulum süreci gerektirir; normal restore bunu yapmaz. Bu koruma genel uygulama yolu içindir; işletim sistemi yöneticisinin disk geri sarma işlemlerine güvenlik garantisi vermez.

CA yedeği yalnız imza kabiliyetini kurtarır. Güncel iptalleri ispatlamaz. Genel veri yedeği dünya ve normal proje verilerini taşıyabilir. Saha yetki dizini ve kurulum işaretleri güncel yedekleme ve geri yükleme filtrelerinde dışarıda kalır. Normal proje veya oda ihracına anahtar eklenmez. Yerel yöneticinin tüm disk görüntüsünü geri almasına karşı monotonic donanım sayacı yoktur. [İmzalayıcı](rooms/gaia-room/scripts/storage/field-issuer.ts) · [USB paketi](rooms/gaia-room/scripts/field/installation.ts) · [Merkez sahibi](rooms/gaia-room/scripts/storage/enrollment-service.ts)

### 03-B4 · Oturum, heartbeat ve güvenilir teslim

**Uygulama sınırı.** Oturum durum makinesi `rooms/gaia-room/scripts/field/session.ts` içindedir; dosya sistemi, ağ, Electron ve Android bağımlılığı yoktur. B1 şemaları ve semantik yardımcıları yeniden kullanılır. B7 güvenilen yetkiyi, proje kilidi altında yayını ve monotonik saat/timer adaptörlerini enjekte eder. B4 oturum başına yalnız tek ACK, tek gövde özeti, tek canlı kanıt ve tek timer tutar; paket geçmişi, tekrar listesi veya örnek kuyruğu yoktur. Varsayılan üst sınır 256 oturumdur. `closeAll` yeni işi durdurur; oturumları, timer'ları ve kanıtları temizleyip bekleyen işlerin bitmesini bekler.

**Oturum açma.** İstemci kimliği yalnız mTLS sınırından gelen küçük harfli SHA-256 DER parmak izidir; JSON gövdesindeki proje/cihaz/kurulum alanları yetki otoritesi değildir. `SessionAuthority.transact` parmak izini B3 atamasına çözer. B4 istekteki `projectId`, `deviceId` ve `installationId` değerlerini atamayla; atamayı güncel dünyadaki `source:"physical"` cihaz ve `hardwareId` ile; `statusEpoch` değerini de yayın bağlamıyla karşılaştırır. Kabul edilen küme v1 kataloğu ∩ ilan ∩ güncel envanter ∩ merkez iznidir. `sessionId` merkezde UUIDv4 üretilir; `runId` istemciden gelir. Yanıt sabit `intervalMs=10000` ve `timeoutMs=35000` taşır. İlk gözlem yalnız `seq=1` olabilir. `projectId+deviceId` başına tek etkin oturum vardır; ikinci açılış kalan süreyle `session_busy` döner. Yetki nesli ve epoch açık oturuma sabitlenir; sonraki her işlem bu iki değerle yeniden doğrulanır.

**Sıra ve ACK.** Oturum başına yalnız ardışık `seq` kabul edilir. Son başarılı paketin özgün UTF-8 gövdesinin SHA-256 özeti, `seq` ve ACK RAM'de tutulur. Aynı son `seq` ve birebir aynı gövde, yetki ve oturum hâlâ geçerliyse aynı ACK'i döndürür; yeni yayın yapmaz, son teması, tazeliği veya deadline'ı yenilemez. Tekrar yolunda yetki yine proje kilidi altında doğrulanır; ACK üretimi yeni bir kabul değildir. Aynı `seq` farklı gövde, eski `seq`, atlanan `seq` ve başka istemciye/oturuma ait paket reddedilir. Paket; yinelenen capability, kabul kümesi dışı örnek, eksik capability, `sentMonoMs` sonrası örnek veya gerileyen gönderim zamanı içeriyorsa tamamı reddedilir. Başarısız atomik yayın ACK üretmez; `seq`, özet, son temas ve kanıt ilerlemez. İlk paket dahil her yeni kabul, B3 yetki doğrulaması ve `projectPhysicalSnapshot` yayınıyla aynı proje kilidinde yürür; kilit dışında doğrula-sonra-yaz yolu yoktur.

**PhysicalLiveProof.** B2'nin `{ identity, status }` RAM kanıtı yalnız başarılı yayından sonra oturuma alınır. Başarısız yayında önceki kanıt korunur; tekrar ACK yolunda yeni yayın yapılmaz. Oturum kapanınca, epoch/yetki nesli/kimlik değişince veya yeni oturum açılınca kanıt bırakılır ve yeni oturuma devralınmaz. Kanıtın kimliği güncel envanter/epoch ile eşleşmelidir.

**Zaman.** `acceptedAt` yalnız tanısal UTC'dir; deadline, bekleme ve yaş merkezi monotonik sayaçla hesaplanır. `previousResponseMonoMs` yanıtın/ACK'in ilk yayın anı, `acceptedMonoMs` paketin kilit altındaki kabul anıdır. B2 yaş formülü `A = (sentMonoMs − sampleMonoMs) + W` korunur; ACK kaybı, birebir tekrar veya yazıcı beklemesi yaşı sıfırlamaz. Monotonik sayaç geri giderse yeni yayın yapılmaz; süreklilik kaybında B7 `handleClockDiscontinuity` ile tüm oturumları kanıtlarıyla kapatır. Duvar saati sıralama, yaş veya timeout için kullanılmaz.

**Heartbeat ve kapanış.** İlk paketi bekleyen oturum açılıştan, canlı oturum son başarılı yeni kabulden 35.000 ms sonra emekliye ayrılır; 34.999 ms sınırında canlıdır. Kabul kümesi boşsa boş `samples` dizisi, değilse tüm kabul edilen kimlikleri missing taşıyan paket heartbeat'tir; yeni kabuldür ve oturumu `online` yapar. Timer oturum kimliği ve jetonla korunur; eski timer yeni oturumu kapatamaz. Timer ile kabul yarışında kabulün kilit altındaki anı deadline'dan önceyse paket kazanır; kilit beklemesi deadline'ı aşarsa yayın yapılmaz. İptal veya değişmiş yetki bir sonraki kullanımda derhal reddedilir ve oturum kapatılır. `markOffline` isteğe bağlıdır; başarısızlığı oturumu yaşatmaz. Merkez yeniden başlatıldığında oturumlar ve ACK'ler yoktur; yeni `sessionId` ve `seq=1` gerekir. Emekliye ayrılan oturumun geç yanıtı yeni oturumu canlandırmaz.

| B4 kodu             | Anlam                                                                          | B7 eşlemesi                        |
| ------------------- | ------------------------------------------------------------------------------ | ---------------------------------- |
| `invalid_packet`    | Şema, yinelenen/eksik capability, kabul dışı örnek veya gönderim zamanı ihlali | 400 `invalid_packet`               |
| `not_authorized`    | Kimlik, atama, iptal, capability veya epoch artık geçerli değil                | 403 `not_authorized`               |
| `session_busy`      | Aynı proje/cihaz için etkin oturum var                                         | 409 `session_busy` + `Retry-After` |
| `session_expired`   | Oturum yok, emekliye ayrıldı veya deadline geçti                               | 409 `session_expired`              |
| `sequence_conflict` | Aynı `seq` farklı gövde, eski/atlanan `seq` veya ilk paket `seq ≠ 1`           | 409 `sequence_conflict`            |
| `unavailable`       | Yetki okuması, saat, kapasite veya atomik yayın başarısız                      | 503 `unavailable`                  |

`Retry-After` tam saniyedir; `rate_limited` B7'nin hız bütçesine aittir. Başarısız atomik yayın ACK üretmez ve `seq` ilerletmez; ACK yalnız başarılı yayından sonra üretilir. ACK kaybında aynı gövde aynı `seq` ile tekrar denenir.

**B7 adaptör kontratı.** B7, `withVerifiedClient(project, peerDer, expected, work)` çağrısını `SessionAuthority.transact` olarak sarar. `expected` açık oturumun sabit `projectId`, `deviceId`, `hardwareId`, `installationId`, `authorizationGeneration` ve `statusEpoch` değerlerini taşır; ilk açılışta yalnız proje ve cihaz bilinir. Dönen atama `TrustedProjectTransaction` içinde taşınır. `publish(input, previousLive)` kilit altında `projectPhysicalSnapshot(dir, world, epoch, input, previousLive)` çağırır ve `{ identity: deviceStatusIdentity(world, epoch), status: statuses[deviceId] }` döndürür. Yetki hatası `AuthorizationError` olarak eşlenir; diğer hatalar `unavailable` olur ve ACK/`seq` ilerletmez. Ham UTF-8, yinelenen anahtar, 16 KiB gövde ve TLS/başlık bütçeleri B7'de kalır. `SessionClock` duvar saatini yalnız tanı için, sürekliliği korunan `monoMs` değerini deadline, bekleme ve yaş için verir; `SessionTimers` tek oturum timer'ını iptal edilebilir biçimde kurar. `markOffline(client, retired, at)` yalnız canlı oturum emekliye ayrıldığında çağrılır; `shutdown` nedeninde çağrılmaz.

**B4 kabul sınırı.** `session.test.ts` içindeki 21 test T4–T6 kapsamını; ACK kaybı ve birebir tekrarı, farklı gövdeyi, eski/atlanan sırayı, başarısız yayını, eşzamanlı paketleri, yetki/epoch değişimini, yayın beklerken timeout'u, eski timer/yeni oturum yarışını, monotonik yaşı, missing sıra belleğini, merkez yeniden başlatmayı, kaynak sınırını ve temiz kapanışı doğrular. Gerçek mTLS, ham gövde doğrulaması, gerçek proje kilidi, Electron yaşam döngüsü ve UI görünürlüğü B7/B8 kabulüdür; B4 bunları taklit etmez.

**B4 bağımsız kabul netleştirmesi.** Busy ve oturum kapasitesi yalnız güncel kimlik/atama doğrulamasından sonra bildirilir. Geçersiz veya gerileyen merkezi monotonik sayaç saptandığında bütün mevcut oturumlar emekliye ayrılır. Kapanış çağrıları aynı drain sözünü paylaşır. Atomik yayının kendisi yeni kabulden itibaren 35 s sınırını da aşarsa kalıcı yazı geri alınmaz, fakat oturum emekliye ayrılır ve ACK yerine session_expired döner. B7, `observe` için özgün geçerli UTF-8 gövdeyi ve tam olarak o gövdeden tek kez ayrıştırılmış nesneyi birlikte verir. B4 içindeki seri kuyruk ağdan sınırsız iş kabul etme izni değildir; B7 tek uçuş, toplam bağlantı ve giriş bütçeleriyle bekleyen işlemleri sınırlar. `markOffline` ayrı gecikmiş bir işlem olduğundan proje kilidi altında son yayımlanmış sessionId, seq, bağ/epoch/izin nesli yeniden kontrol edilir; yeni oturumu veya yeni ölçümü offline yapamaz. Uygulama kapanırken B7 önce yeni istekleri durdurur, sonra B4 drain ve merkezi sahiplik kapanışını sıralar.

### Pozitif ve negatif kabul senaryoları

| ID  | Deney                                                                                                                                                                                                | Beklenen sonuç                                                                                                                                                                                                 |
| --- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| T1  | Sekiz ilanla oturum aç. Bir ilanı envanterden, diğerini merkez izninden çıkar. Bilinmeyen ilan ekle.                                                                                                 | Sadece kesişim döner. Eksik/tekrarlı veya onaysız örnek içeren paket hiçbir satır yazmaz.                                                                                                                      |
| T2  | Batarya %0, [0,0,0], validated=false, Wi-Fi yok, sentinel, missing ve invalid gönder. Yanlış birim, string sayı, sonsuzluk, hatalı vektör veya 9 cm'yi 8 cm aralıklı sensöre ver.                    | Doğru sıfırlar korunur. Üç kalite ayırt edilir. Geçersiz sensör okuması Client'ta invalid olur. Hatalı tel şeması atomik reddedilir.                                                                           |
| T3  | Güvenilen iki uç ve doğru saatle bağlan. Sonra 2017/ileri saat, yanlış SAN/CA, süresi geçmiş sertifika, başka proje/cihaz, kopya UUID, özel anahtarsız sertifika ve iptal edilmiş açık soketle dene. | Doğru bağ çalışır. Diğerleri yeni temas/ölçüm üretemez. Saat düzeltmesi sonrası normal TLS geçer. LAN'daki Router kimlik beyanıyla geçemez.                                                                    |
| T4  | Yazıdan sonra ACK'i düşür, aynı gövdeyi tekrarla, aynı seq farklı gövde, atlanan seq, çok eski seq gönder. Alıcı EOF, 200 yanlış seq ve timeout da üretsin.                                          | Tek yayın ve aynı kabul zamanı. Tekrarda deadline uzamaz. Hatalı ACK göndericiyi ilerletmez. Yeni oturum eski paketi reddeder.                                                                                 |
| T5  | Ayrı koşularda 5 Hz ivmeyi durdur, tek far olayından sonra 65 s heartbeat gönder, aboneliği yenile, paketi geciktir ve telefon saatini ileri/geri al.                                                | İvme ve proximity olay zamanı sabit. Link online kalabilir. Yakınlık son durumdur, yeni kayıt ilk olayı bekler. Gecikmiş veri yaşlanır. Saat sıçramasında TLS yeniden denetlenir, wall clock veriyi öne almaz. |
| T6  | Son kabulden 34.999 ms ve 35.000 ms sonra oku. Kesintide çok sayıda tick geçir. Main'i ACK öncesi ve sonrası yeniden başlat.                                                                         | Sınırda offline. Backoff ve bellek sınırlı. Önceki online/fresh kalkar. Yeni oturum güncel durumu verir. Eski timeout callback'i yeni linki kapatamaz.                                                         |
| T7  | Gözlem ile ad/mount kaydını, capability çıkar/geri ekle, donanım değiştir, iptal ve cihaz sil/yeniden oluştur işlemlerini yarıştır. Eşlemenin her yayın sınırında süreci kes.                        | Gerçek kilit sırası geçerlidir. Ad/mount ölçümü korur. Yetkisiz ara durum yazamaz. A→B→A ve fabrika sıfırlaması eski izni/örneği canlandıramaz.                                                                |
| T8  | v1, eşleşen/uyuşmayan v2, kesilmiş v3, bilinmeyen sürüm, disk dolu ve dünya sonrası yan dosya hatası kullan.                                                                                         | Dünya açılır. Eski kimlik güvenilmez. Hasarlı dosya korunur. Başarısız gözleme ACK yoktur. Başarılı v2 geçişi diğer cihazın sanal örneğini korur.                                                              |
| T9  | Start → HOME → ekran kapalı → tekrar bind → bildirimden Stop. Ağ okuması beklerken Stop, süreç ölümü, force-stop ve reboot'u ayrı uygula.                                                            | Tek bildirim/abonelik, Stop sonrası socket/timer/listener kalmaz. Yeniden başlama kullanıcı eylemi ister. Ekran kapalıyken örnek gelmeyebilir ve UI doğru yaş gösterir.                                        |
| T10 | Oda hiç açılmadan paket gönder, aç/gizle/göster. Simulated komuta measured/source ekle, başka webview'dan çağır. Fazla bayt, aşırı hız, sıkıştırma, yol veya symlink dene.                           | İlk açılış ve dönüş doğru revizyonu okur. UI kapalıyken kabul sürer. Yetkisiz talepler dünya, yan dosya ve son temasa dokunamaz. Sınır aşımı yazıcıyı doldurmaz.                                               |

### Açık kararlar ve kanıt kapıları

- B3/2 yerel CA, USB biçimi, ömür ve kurtarma kontratını belirledi. B6 iki uçtaki fiziksel parmak izi karşılaştırmasını, Keystore zincir içe alımını ve gerçek cihazda hata gösterimini doğrulayacak.
- J701F üzerinde Keystore anahtarıyla gerçek mTLS, zincir içe alma, hostname ve yerel tarih düzeltmesinin reboot sonrası kalıcılığı sınanacak. Wi-Fi RSSI olayının erişilebilirliği, yakın uç okuması, gerçek radyo, güç ve Doze ölçümü 03-C kanıtıdır. 10 s / 35 s ilk ayarlardır; mevcut v1 tel profilinde oturum yanıtında bu iki değer sabittir. İleride değiştirilecekse iki uçtaki şema, zamanlayıcı ve hız bütçeleri birlikte güncellenir.
- Birden fazla merkezi kurulum, yedekten izin deposu geri döndürme ve CA devri bu tek merkezli v1'in kabulünden önce vaat edilmez. Eski yetki yedeği doğrudan etkinleştirilmez. Saha dağıtımında geri yükleme/iptal prosedürü ayrıca kabul edilir. Broker, Router yönetimi, API 17, yüksek frekans ve geçmiş için yeni ihtiyaç ve ayrı karar gerekir.
