# Gaia Room · 01-C · Kanonik veri modeli ve mimari kontratlar

**Durum — 01-C/D tasarım ve bağımsız audit tamamlandı.** Hayalet Ev tabanı `960064b1`. Audit kararı 2: sınırlı kontrat düzeltmelerinden sonra 02-A açılabilir. P0 kararları aşağıda işlendi; çalışma zamanı kanıtları 02-A kabulüne tabidir.

| Statü         | Bu belgeyi okurken anlamı                                                                                                                                                                                                                                           |
| ------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Kabul edilmiş | Gaia mekânsal verinin otoritesidir. Oda local-first çalışır. Genel Görünüm ve Modelleme Atölyesi ayrıdır. OpenPlan3D + Three.js koşullu ilk seçimdir. Geliştirme ve kalite için 17 kuralın tamamı geçerlidir. [Ana kararlar ve kurallar](GAIA.md)                   |
| Gözlenmiş     | Aşağıdaki kaynak okumaları belirtilen OpenPlan3D commit'ine aittir. Önceki deneyde üç kotlu plan kaydedilip açıldı. Genişletilmiş iki deney JSON'unda `floors` eşit, yalnız `updatedAt` farklı. Deneyin kapsamı ve sınırları [01-B2/B3 kaydında](GAIA.md) yer alır. |
| Öneri         | Aşağıdaki tipler ve invariantlar 01-C tasarımını, 01-D ile netleşen sınırları ve uygulamada doğrulanacak başlangıç önerilerini içerir.                                                                                                                              |
| Doğrulanacak  | Gerçek UI hareketlerinden güvenilir değişiklik çıkarma, bağımsız viewer entegrasyonu, çevrimdışı paket, kaynak bütçesi ve hide/dispose davranışı 02-A deneyleri gerektirir.                                                                                         |

02 milestone'unun güncel Linux kabul kaydı ana belgededir. Aşağıdaki 01-C/D taslağı ve 02-C/D uygulama kontratı mekânsal dünya ve oda yazıcısının sınırlarını tarif eder. Fiziksel Client için tel şeması, kimlik ve merkezde kabul sırası 03-A/3 belgesindedir. [Gaia durum kaydı](GAIA.md) · [Saha kontratı](GAIA-CLIENT-PROTOCOL.md)

## 1. Sorumluluk ve bağımlılık yönü

| Gaia capability | İlk dilim                                                                                         | Genişleme sınırı                                                                                                                  |
| --------------- | ------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------- |
| Spatial         | Proje → arazi → yapı → kat çerçeveleri, bölge, nokta, hacim, düz duvar, güzergâh, referans, ölçüm | Yeni geometri veya koordinat sistemi kendi veri ve doğrulama kuralıyla eklenir.                                                   |
| Devices         | Mantıksal cihaz, rol, bildirilen yetenek, yerleştirme ve sanal kaynak                             | Fiziksel donanım eşlemesi, sensör ve aktüatör profili                                                                             |
| Connectivity    | Sanal/veri yok durumunun gösterimi                                                                | Client, Router veya standart cihaz sağlayıcısı kimlik ve bağlantı görünümü verir. İlk eşleme ve HTTPS/mTLS tasarımı 03-A/3'tedir. |
| Telemetry       | Sentetik durumun viewer'a okunur girdisi                                                          | Zaman damgalı gözlem, tazelik ve geçmiş sorgusu                                                                                   |
| Automation      | İleride cihaz kimliği ve yetenekle adresleme                                                      | Doğrulanmış komut, yetki, teyit ve saha güvenliği                                                                                 |
| Intelligence    | İleride seçilmiş bağlamı okuma                                                                    | AI0/AI1 ve izinli araçlar üzerinden öneri                                                                                         |

Bağımlılık okları **kullanan → kullanılan kontrat** yönündedir. Bileşim oda içinde tek noktada yapılır. Ağaç dağıtım veya süreç topolojisi tarif etmez.

```text
Gaia Room
├─ Genel Görünüm → Spatial okuma + Devices yerleşimi + canlı durum okuma
├─ Modelleme Atölyesi → OpenPlan3D adaptörü → Spatial değişiklik doğrulayıcısı
├─ proje işlemleri → Spatial + Devices + proje deposu portu
├─ room-storage adaptörü → proje deposu portu + izinli host dosya işlemleri
├─ Connectivity sağlayıcıları → Devices kimlik ve capability kontratı
├─ Telemetry → cihaz/capability kimliği + gözlem kaynağı
├─ Automation → cihaz capability + gözlem + yetkili komut portu
└─ Intelligence → seçilmiş okuma kontratları + yetkili Hayalet Ev araçları
```

Spatial yalnız kendi veri tiplerini tanır. Devices bir Spatial noktasına kimliğiyle bağlanabilir. Svelte, Three.js, OpenPlan3D, Electron, dosya yolları ve donanım SDK'ları domain'e import edilmez. Client ve Router bağımsız saha yazılımları olarak ilerler. İleride ortak saha mesajı gerekirse oda içi şemanın tamamını paylaşmaya gerek yoktur.

Core odayı keşfeder. Tema, TR/EN, oda komutları, capture, STT/TTS, Companion ve AI0/AI1 gibi hazır yetenekler gerektiğinde mevcut host sınırından kullanılır. Oda başka bir odanın kodunu veya kurulumunu aramaz. Gerçek ortak ihtiyaç çıkarsa sürümlü ve izinli capability mevcut Room Registry / Room Tools / SlotBridge üzerinden isteğe bağlı keşfedilir. Sağlayıcı yokken Gaia'nın yerel işlevleri yürür. UI komutları desteklenen `roomAPI.sendCommand` yolundan geçer. Fiziksel komutun yetki ve güvenlik kararı renderer veya AI'da alınamaz. [Oda kontratı](rooms/README.md) · [SlotBridge](.rovo/slot-bridge-contract.md)

## 2. Dünya kaydı ve koordinatlar

Her proje bir yerel Kartezyen dünyadır. Orijin kullanıcı tarafından seçilen sabit proje referansıdır. İlk arazinin seçilen başlangıç noktası varsayılan orijin olabilir. Yeni arazi eklemek veya bir yapıyı taşımak dünyayı yeniden merkezlemez. +X planda sağa (yerel doğu), +Y yukarı (yerel kuzey), +Z yukarıya bakar. Sağ elli sistemde metre kullanılır. Kuzey, coğrafi kalibrasyon yapılana kadar proje yönüdür. Farklı projelerdeki noktaları doğrudan karşılaştırmayız.

Her düğümün ötelemesi ve düşey eksen etrafındaki dönüşü üst çerçevesine göredir. İlk dilimde düşey hacimler için tek açı yeterlidir. `yaw` derecedir, +Z'den bakınca saat yönünün tersine artar, yazım aralığı [0,360). Hat eğimi gerçek XYZ köşelerinden gelir. Pitch/roll, kesme, hiyerarşik ölçek ve jeodezik koordinatlar ancak somut ihtiyaçla eklenir. Boyutlar nesnenin kendi eksenlerinde metredir.

Bir yerel nokta için `pÜst = t + Rz(yaw) · pYerel`. Burada `Rz(a)(x,y,z) = (x cos a − y sin a, x sin a + y cos a, z)`, trigonometrik hesapta açı radyana çevrilir. Kökten düğüme matris çarpımı `Wçocuk = Wüst · T(t) · Rz(yaw)`. Arazinin üst çerçevesi dünyanın birim matrisidir. Ters dönüşüm üstten yerele `Rz(−yaw) · (pÜst − t)` ile yapılır. Üst değiştirilirken dünya pozu korunacaksa yeni yerel poz `inverse(WyeniÜst) · WeskiNesne` olur. Kat kotu katın yerel Z ötelemesidir. Dünya kotu ataların ötelemelerini de içerir. Negatif değer geçerlidir.

Dünya noktaları A ve B için yatay mesafe `hypot(Δx,Δy)`, doğrudan mesafe `hypot(Δx,Δy,Δz)`, güzergâh uzunluğu ise sıralı dünya köşelerinin ardışık 3D mesafeleri toplamıdır. Her ölçüm türü ve birimiyle gösterilir. Ölçülen, tahmin edilen ve geometriden hesaplanan değerler ayırt edilir. RSSI için kaynak bağlantı ölçümüdür.

### Şema taslağı

Aşağıdaki tipler sürüm 1 belgesinin JSON veri biçimini tarif eder. Harita anahtarları kalıcı, opak kimliklerdir. İsim, etiket, koordinat, indeks ve üretici seri numarası kimlik türetmek için kullanılmaz. Gaia her yeni kayıt için kalıcı kimlik üretir. Fixture okunur sabit kimlikler kullanır.

```ts
type Id = string;
type V2 = [number, number];
type V3 = [number, number, number];
type Geometry =
  | { kind: "point" }
  | { kind: "footprint"; ring: V2[] }
  | { kind: "box"; size: V3 }
  | { kind: "cylinder"; radius: number; height: number }
  | { kind: "wall"; length: number; thickness: number; height: number }
  | { kind: "path"; vertices: V3[] };

interface SpatialNode {
  kind: "site" | "building" | "floor" | "zone" | "object" | "mount" | "route";
  name: string;
  parent: Id | null;
  p: V3;
  yaw: number;
  geometry?: Geometry;
  role?: string;
  level?: number;
  zoneIds?: Id[];
  basis?: "measured" | "estimated" | "computed";
}

interface ReferenceLayer {
  frame: Id | null;
  asset: Id;
  opacity: number;
  name?: string;
  visible?: boolean;
  locked?: boolean;
  calibration?: {
    pixels: [V2, V2];
    distanceM: number;
    anchor: V3;
    bearingDeg: number;
  };
}

interface Device {
  role: "router" | "client" | "sensor" | "actuator" | "external";
  source: "virtual" | "physical";
  capabilities: string[];
  mount?: Id;
  hardwareId?: Id;
}

interface World {
  schemaVersion: 1;
  id: Id;
  revision: number;
  nodes: Record<Id, SpatialNode>;
  devices: Record<Id, Device>;
  assets: Record<Id, { mime: string; pixels?: V2; sha256?: string }>;
  references: Record<Id, ReferenceLayer>;
}
```

- Proje tüm kayıtların sahibidir. `parent` yalnız dönüşüm ve mekânsal hiyerarşi kurar. Kökler `site`, üstleri `null` olur. Yapı bir araziye, kat bir yapıya bağlanır. Alanlar arazi, yapı veya kat altında bulunabilir. Nesne, nokta ve hat arazi/yapı/kat/bölge çerçevesinde serbestçe durabilir. Çocuk ve referans aynı projede çözülür. Döngü, eksik üst ve tür uyuşmazlığı reddedilir. Kat için `level` aynı yapıda benzersiz tamsayı sıralama anahtarıdır. Kotla aritmetik ilişki kurulmaz.
- `zoneIds` aynı arazideki bölgelerle çoktan çoğa semantik ilişkidir. Bir hat bölgelerden geçebilir, bir cihaz noktası birden fazla alanı izleyebilir. Üye olmak bir bölgenin dönüşümünü miras almak anlamına gelmez. Bir bölge taşınırsa yalnız çerçeve çocukları taşınır. Bölge üyeliği koordinattan yeniden tahmin edilmez.
- Arazi veya bölge için basit XY sınırı yeterlidir. Halka en az üç ayrı nokta, sıfırdan büyük alan, kendini kesmeyen ve son kenarı örtük kapanan CCW sınır içerir. Yapı ayrıntısız bir kutuyla veya yalnız çocuklarıyla geçerlidir. Kutu ve silindirin pivotu alt yüz merkezi, yukarı yön +Z'dir. Duvar pivotu başlangıç alt orta noktasıdır, orta çizgisi yerel +X boyunca uzanır. Hat düğümü en az iki yerel XYZ köşesi taşır, ardışık köşeler farklıdır. `mount` bir noktadır. Alan/kat görünürlüğü için kullanıcı sınıfı ve geometrinin gerçek kot aralığı ayrı okunur.
- Nesne, cihaz, varlık ve referans kimlikleri proje içinde benzersizdir ve ömür boyu başka kayda atanmaz. Proje kimliği depodaki projeyi adresler ve kendi ad alanına sahiptir. Üst/isim değişince kimlik korunur. Sayılar sonlu, uzunluk ve boyutlar pozitif, revizyon negatif olmayan güvenli tamsayıdır. `level` yalnız katta bulunur. `basis` yoksa köken bilinmiyor kabul edilir. Bir çerçevenin kaldırılması çocuklar, üyelikler, referanslar ve cihaz yerleştirmesi için açık çözüm gerektirir. Yeniden bağlama, yerinden çıkarma veya silme aynı atomik işlemde doğrulanır.
- `role` içinde ilk eşlenen anlamlar `wall`, `table`, `water` ve `electricity` gibi domain terimleridir. Editör katalog anahtarlarının çevirisi adaptördedir. Bilinmeyen bir rol kendi geometrisiyle görüntülenebilir. İzinli düzenlemeler var olan kaydın ilgili alanlarına uygulanır. Okuyucunun güvenli yorumlayamadığı yeni şema sürümünde yazma engellenir.

### Referans ve kalibrasyon

Görsel isteğe bağlıdır. `asset` değişmez orijinali, `frame` arazi veya başka bir yatay çerçeveyi gösterir. `null` proje koordinatlarını kullanır ve ilk arazi çizilmeden önce referans eklenebilir. Eski kayıtlarda görünürlük varsayılan olarak açık, yerleşim kilidi kapalıdır. Sürekli piksel koordinatında sol üst kenar (0,0), sağ alt kenar (genişlik,yükseklik), +v aşağıdır. İki farklı piksel A, B, pozitif bilinen mesafe d, A'nın çerçevedeki konumu ve A→B doğrultusunun +X'e göre açısı saklanır. İki tıklama ve mesafe tek başına konum ve yönü belirlemez. Hizalama kullanıcıdan ya da açık seçilmiş proje ekseninden gelir.

`q(u,v)=(u,−v)`, `s=d/|B−A|` m/px, `θ=bearing−arg(q(B)−q(A))`. Her pikselin yatay konumu `anchor.xy + s · R(θ) · (q(pixel)−q(A))`, Z değeri `anchor.z` olur. Böylece kalıcı benzerlik dönüşümü verilenlerden yeniden üretilebilir. Piksel orijini resmin sol üst kenarıdır, u sağa ve v aşağı artar. bearingDeg, ilk işaretten ikinciye çerçevenin +X eksenine göre pozitif saat yönü tersinde ölçülür. Piksel boyutları pozitif tamsayı, işaretler görüntü içinde ve farklı, distanceM pozitif, opaklık [0,1] aralığında ve dönüşüm sonlu olmalıdır. Kalibrasyonsuz referans önizlemesi ölçüm kaynağı olamaz. Kamera pan/zoom'u dönüşüme katılmaz.

### Cihaz kimliği ve sağlayıcı sınırı

`mount` fiziksel konumu tutan Spatial kimliğidir. Cihaz yerleştirilmeden envanterde durabilir, boş montaj noktası da sahada kalabilir. Donanım bulunmadan oluşturulan fiziksel cihazda `hardwareId` yoktur. Sanal cihazda bu alan yasaktır. Gerçek donanım eşlendiğinde sağlayıcı değişmez bir donanım örneği kimliği verir. Fiziksel cihaz çevrimdışı olsa bile bu eşleme sürer. Donanım değişiminde mantıksal cihaz ve nokta korunur, donanım örneği değişir. Eski gözlem geldiğinde kaydedilen donanım kimliği sonradan yeniden yazılmaz. Bir fiziksel örnek aynı anda iki mantıksal cihaza atanamaz.

Capability anahtarı rolün altında çalışan sürümlü bir işlevi tanımlar (ör. `temperature.read.v1`). Bir Client birden fazla yetenek sunabilir. Harici standart protokol cihazı da aynı kimlik ve capability yüzeyini kullanır. Marka, adres, protokol, kimlik bilgisi, ağ topolojisi ve telemetri dizileri Spatial'da yer almaz. Sağlayıcı ve bağlantı ayrıntıları Connectivity'ye, geçmiş Telemetry'ye aittir. Aşağıdaki iki okuma tipi 01-C'deki ilk görünüm taslağıdır. Uygulanan durum modeli için 02-C, fiziksel tel şeması için 03-A/3 kontratı geçerlidir.

```ts
type LinkView = { deviceId: Id; state: "unbound" | "online" | "offline" | "unknown" };
type Observation = {
  deviceId: Id;
  hardwareId?: Id;
  capability: string;
  at: string;
  value: number | boolean | string;
  unit?: string;
  source: "simulated" | "measured";
  quality: "valid" | "uncertain";
};
```

Viewer, bağlantı durumu, sanal kaynak, gözlem zamanı ve tazeliği ayrı gösterir. Yeni örnek gelmeyince son ölçümün yaşı artar. İstenen aktüatör durumu, komut teyidi ve ölçülen fiziksel sonuç ayrı tutulur. İlk dilimde sanal girdiler yeterlidir. Mesaj protokolü, firmware, kural dili ve zaman serisi tablosu sonraki milestone'lara aittir.

### 02-C uygulama kontratı

- `World.devices` kalıcı cihaz kimliği, kaynak, yerleşim ve capability listelerinin otoritesidir. İlk `role` alanı korunur. `roles`, `name`, `manufacturer` ve `model` eski sürüm 1 kayıtlarında isteğe bağlıdır. Marka/model envanter metadatasıdır. Sürümlü capability kataloğu ölçülebilir yetenekler için değer türünü ve birimi tarif eder. Kamera ve mikrofon katalogda özellik olarak ilan edilebilir.
- `recordStatus` dar gözlem girişidir. Cihazın ilan ettiği capability, cihaz ve kaynak uyumu, fiziksel donanım kimliği, değer türü, birim, kalite ve ölçüm zamanı doğrulanır. `GaiaStatus` oda çağrıları kaynak olarak yalnız `simulated` kullanır. Son bağlantı, son iletişim, örnek ve kabul zamanları ayrı tutulur. Geçerli örnek 60 saniye yaşlandığında, bağlantı kesildiğinde veya son kopuştan eskiyse son bilinen veri olarak gösterilir. Hatalı örnek değer taşımaz.
- Günlük yönetim tek proje yazıcısını kullanır. Projenin yanındaki sürümlü `device-status.json` dosyasında capability başına yalnız son gözlem ve güncel bağlantı bilgisi saklanır. Proje açma yan dosyaya bağımlı değildir. Silinen cihaz, değiştirilmiş donanım veya artık desteklenmeyen capability için kayıt görünümde çözülmez. Son durum okuma ve yayın arayüzün görünürlük olaylarından bağımsız yürüyebilir. Taze snapshot görünürken alınır ve durum girişi yalnız durum rozetlerini ve panelleri günceller. 02-D/1 ile yan dosya schemaVersion 2 ve kanonik dünya zarfındaki statusEpoch ile kimliklendirilir. Epoch cihaz kimliği/kaynak/donanım/yetenek kümesi değişiminde ilerler; ad, yerleşim ve yetenek sırası değişiminde sabit kalır. Dünya yayını önce gelir; kaçırılan eşitlemede eski durum kimliği geçersizdir (A→B→A dahil). V1 durum örnekleri yeniden kullanılmaz; bozuk yan dosya korunur ve durum okuması hata verir. Renderer snapshot'ı proje ve kayıtlı revizyonla eşleşmelidir.

### 03-A/3 fiziksel gözlem sınırı (kabul edilen tasarım)

Bağımsız Client doğrudan Hayalet Ev'e HTTPS/mTLS ile bağlanır. Saha CA'sı ve cihaz başına yerel izin, proje/cihaz/kurulum/donanım bağını doğrular. İlk örnekte Router yalnız ağ yolunda bulunabilir. Companion kurulum ve yönetim aracıdır. Core, saha protokolünü veya envanter semantiğini sahiplenmez.

Güvenilen main alıcısı oda oturumu açmadan aynı proje yazıcısına girer. Güncel izin, dünya ve epoch kilit altında yeniden doğrulanır. Measured paket tek yayında bağlantı ve son örnekleri günceller. Dünya revizyonu ve epoch yalnız envanter/dünya kayıt kurallarına tabidir. Renderer tarafında `GaiaStatus` güncellemesinin kaynağı daima `simulated` kalır. Tasarlanan v3 yan dosya, v2 kimlik denetimini, bozuk dosyanın korunmasını ve dünya önce yayın sırasını sürdürür. Sürekli örnek, on-change olayı, bağlantı tazeliği ve ölçüm geçerliliği ayrı gösterilir. [Kimlik, tel şeması ve depolama kuralları](GAIA-CLIENT-PROTOCOL.md)

03-B6 Android tarafında kurulum anahtarı Android Keystore’da, doğrulanmış sertifika ve atama uygulamanın yedekleme dışı deposunda tutulur. `TransportProvider` saha adaptörünü B5 toplama motoruna bağlar. Deney alıcısı yalnız test kaynaklarında çalışır. [Android taşıma sözleşmesi](GAIA-CLIENT-PROTOCOL.md#03-b6--android-kurulum-ve-gönderim)

03-B7’de Electron main, güvenilen Gaia storage kökünde sertifika zorunlu tek merkez sahibini alır. Odanın açılması saha alımının önkoşulu değildir. B4, etkin atamanın proje kilidi altında B2 fiziksel snapshot yazıcısına girer. Gecikmiş kopuş da aynı kilidi alır ve yeni oturumun ilk paketi henüz diske ulaşmamış olsa bile RAM sahipliğini gözetir. Alıcı kontrolü ve PKI yalnız main’de bulunur. [Alıcı kontratı](GAIA-CLIENT-PROTOCOL.md#03-b7--electron-main-saha-alıcısı)

## 3. Kabul fixture'ı · sera ve kümes

Aşağıdaki YAML, `World` kaydının kısa yazımıdır. Sentetik arazideki iki bağımsız yapı, bodrum teknik hacmi ve iki yetiştirme katı olan sera ile yalnız dış hacmi çizilen kümestir. Bölge, duvar, masa ve cihaz noktasının ayrı kimlikleri vardır. Bu girdi yalnız test kurulumu içindir. Yeni kullanıcı projesi kendi arazisiyle başlar.

<!-- prettier-ignore -->
```yaml
schemaVersion: 1
id: demo
revision: 7
nodes:
  plot: { kind: site, name: Deney arazisi, parent: null, p: [0,0,0], yaw: 0, geometry: {kind: footprint, ring: [[0,0],[40,0],[40,60],[0,60]]} }
  glass: { kind: building, name: Sera, parent: plot, p: [12,14,0], yaw: 90, geometry: {kind: box, size: [12,8,6]} }
  coop: { kind: building, name: Kümes, parent: plot, p: [28,38,0], yaw: 0, geometry: {kind: box, size: [6,4,2.8]} }
  cellar: { kind: floor, name: Teknik bodrum, parent: glass, level: -1, p: [0,0,-3], yaw: 0, geometry: {kind: box, size: [12,8,3]} }
  ground: { kind: floor, name: Yetiştirme, parent: glass, level: 0, p: [0,0,0], yaw: 0 }
  upper: { kind: floor, name: Fide katı, parent: glass, level: 1, p: [0,0,3], yaw: 0 }
  bed: { kind: zone, name: Fide bölgesi, parent: ground, p: [0,0,0], yaw: 0, geometry: {kind: footprint, ring: [[-4,-3],[4,-3],[4,3],[-4,3]]} }
  yard: { kind: zone, name: Bakım alanı, parent: plot, p: [0,0,0], yaw: 0, geometry: {kind: footprint, ring: [[8,10],[31,10],[31,40],[8,40]]} }
  partition: { kind: object, role: wall, name: Bölme, parent: ground, p: [-4,0,0], yaw: 0, geometry: {kind: wall, length: 3, thickness: 0.12, height: 2.4} }
  bench: { kind: object, role: table, name: Çalışma masası, parent: ground, p: [2,1,0], yaw: 30, geometry: {kind: box, size: [1.2,0.6,0.8]}, zoneIds: [bed] }
  tank: { kind: object, role: waterTank, name: Su deposu, parent: plot, p: [10,12,-3], yaw: 0, geometry: {kind: cylinder, radius: 1, height: 2} }
  pipe: { kind: route, role: water, name: Depo çıkış hattı, parent: plot, p: [0,0,0], yaw: 0, zoneIds: [yard,bed], geometry: {kind: path, vertices: [[10,12,-2],[13,16,-2],[13,16,1]]} }
  cable: { kind: route, role: electricity, name: Kümes beslemesi, parent: plot, p: [0,0,0], yaw: 0, zoneIds: [yard,bed], geometry: {kind: path, vertices: [[12,14,0.5],[12,14,-0.6],[28,38,-0.6],[28,38,1.2]]} }
  mr1: { kind: mount, name: Sera ağ noktası, parent: upper, p: [1,1,1.8], yaw: 0, geometry: {kind: point} }
  mr2: { kind: mount, name: Kümes ağ noktası, parent: coop, p: [0,0,2], yaw: 0, geometry: {kind: point} }
  mc1: { kind: mount, name: Bodrum, parent: cellar, p: [2,1,1], yaw: 0, geometry: {kind: point} }
  mc2: { kind: mount, name: Yatak izleme, parent: bed, p: [1,1,0.4], yaw: 0, zoneIds: [bed,yard], geometry: {kind: point} }
  mc3: { kind: mount, name: Üst kat, parent: upper, p: [-1,2,0.8], yaw: 0, geometry: {kind: point} }
  mc4: { kind: mount, name: Su seviyesi, parent: plot, p: [10,12,-1.5], yaw: 0, geometry: {kind: point} }
  mc5: { kind: mount, name: Kümes içi, parent: coop, p: [1,0,0.6], yaw: 0, geometry: {kind: point} }
devices:
  r1: { role: router, source: virtual, mount: mr1, capabilities: [link.status.v1] }
  r2: { role: router, source: virtual, mount: mr2, capabilities: [link.status.v1] }
  c1: { role: client, source: virtual, mount: mc1, capabilities: [temperature.read.v1] }
  c2: { role: client, source: virtual, mount: mc2, capabilities: [humidity.read.v1] }
  c3: { role: client, source: virtual, mount: mc3, capabilities: [temperature.read.v1] }
  c4: { role: client, source: virtual, mount: mc4, capabilities: [level.read.v1] }
  c5: { role: client, source: virtual, mount: mc5, capabilities: [temperature.read.v1] }
assets:
  grid: { mime: image/png, pixels: [400,600] }
references:
  survey: { frame: plot, asset: grid, opacity: 0.5, calibration: {pixels: [[20,30],[120,30]], distanceM: 10, anchor: [2,57,0], bearingDeg: 0} }
```

Fixture kurulurken `grid` için 400 × 600 px beyaz PNG üzerinde 10 px aralıklı gri ızgara ve iki kalibrasyon noktasında farklı renkli işaret üretilir. Dış görsel gerekmez. Piksel (20,30) dünya (2,57,0), (120,30) dünya (12,57,0), resim merkezi (200,300) dünya (20,30,0) verir. Böylece ölçek 0,1 m/px ve arazi kapsamı tam 40 × 60 m olur.

`mc1` için (2,1,1) önce bodrum kotuyla (2,1,−2), sonra seranın +90° dönüşü ve ötelemesiyle dünya (11,16,−2) olur. `mr1` dünya (11,15,4.8) konumundadır. Su hattının uçları arasında yatay mesafe 5 m, doğrudan 3D mesafe √34 m, hattın kendisi 5 + 3 = 8 m'dir. Depo ve iki hat, sera oturumu açıkken de özgün türleriyle projede kalır.

## 4. OpenPlan3D adaptörü

### Kaynakta gözlenen davranış

İnceleme yerel araştırma kopyasının `771c9e1ad30bd1c3cc7584d6eca74deb2e14943d` commit'ine dayanır. Aşağıdaki bağlantılar aynı sürümü sabitler. Geçici kopya veya eski fixture dağıtım girdisi değildir.

| Yüzey                                                                                   | Adaptör açısından sonucu                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| --------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `Project.floors[]`, `activeFloorId`, kat başına `walls/doors/windows/rooms/furniture/…` | Yapı üst kimliği yoktur. Duvarın iki XY ucu, kalınlık ve yüksekliği vardır. Açıklık aynı kattaki `wallId`'ye, Room duvar kimliklerine bağlıdır. Negatif `Floor.elevation` cm geçerlidir. Eksik kotta `level × 300` kullanılır. [Tipler](https://github.com/laanlabs/openPlan3D/blob/771c9e1ad30bd1c3cc7584d6eca74deb2e14943d/src/lib/models/types.ts) · [Kot hesabı](https://github.com/laanlabs/openPlan3D/blob/771c9e1ad30bd1c3cc7584d6eca74deb2e14943d/src/lib/utils/floors.ts)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| Plan XY ve nesne tabanı                                                                 | Canvas dönüşümünde ekran Y aşağı büyür. Mobilya konumu plan merkezidir. Etkin genişlik/derinlik/yükseklik, override veya katalog boyutunun sırasıyla mutlak scale.x/y/z ile çarpımıdır. Taban yüksekliği kata göredir, geçerli aralık 0–10000 cm'dir. Katalog varsayılanı ve 1,5 cm çizim ofseti ayrı kavramlardır. [Boyut](https://github.com/laanlabs/openPlan3D/blob/771c9e1ad30bd1c3cc7584d6eca74deb2e14943d/src/lib/utils/furnitureCatalog.ts) · [Taban kotu](https://github.com/laanlabs/openPlan3D/blob/771c9e1ad30bd1c3cc7584d6eca74deb2e14943d/src/lib/utils/furnitureElevation.ts)                                                                                                                                                                                                                                                                                                                                                                                                                 |
| `Floor.backgroundImage`                                                                 | Tek görseli data URL, merkez, cm/px ölçek, derece, opaklık ve kilitle taşır. Canvas merkeze göre çizer. İki tıklamalı UI mesafeyi cm alır, yalnız ölçeği günceller ve noktaları temizler. [Canvas çizimi ve kalibrasyon](https://github.com/laanlabs/openPlan3D/blob/771c9e1ad30bd1c3cc7584d6eca74deb2e14943d/src/lib/components/editor/FloorPlanCanvas.svelte)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| Editör store'u                                                                          | `mutate` aktif katta çalışır. Sürükleme bir undo grubunda toplanabilir. Undo/redo serileştirilmiş proje snapshot'larını geri yükler. `loadProject` geçmişi temizler. Duvar silinince bağlı açıklıklar da silinebilir. Kopya yeni ID alır, duvarla gelen açıklıkların referansları değişir. Katlar arası taşımada hedef ID çakışırsa yeni ID verilir. [Store](https://github.com/laanlabs/openPlan3D/blob/771c9e1ad30bd1c3cc7584d6eca74deb2e14943d/src/lib/stores/project.ts) · [Kopyalama](https://github.com/laanlabs/openPlan3D/blob/771c9e1ad30bd1c3cc7584d6eca74deb2e14943d/src/lib/utils/duplicateSelection.ts) · [Kat taşıma](https://github.com/laanlabs/openPlan3D/blob/771c9e1ad30bd1c3cc7584d6eca74deb2e14943d/src/lib/utils/moveToFloor.ts)                                                                                                                                                                                                                                                       |
| Açma ve kaydetme                                                                        | `openProject` önce `readProject` ile aday kopyayı doğrular. Çakışmada proje ID'si değişebilir. Store'a yükleme ve autosave izler. Debounce'lu autosave ve manuel kayıt proje JSON'unu IndexedDB'de sürüm çakışmasını denetleyerek saklar. Manuel kayıt ayrıca snapshot alır. JSON indirme o anki `Project`'i serileştirir. [Açma](https://github.com/laanlabs/openPlan3D/blob/771c9e1ad30bd1c3cc7584d6eca74deb2e14943d/src/lib/services/projectOpening.ts) · [Doğrulama](https://github.com/laanlabs/openPlan3D/blob/771c9e1ad30bd1c3cc7584d6eca74deb2e14943d/src/lib/utils/projectValidation.ts) · [Kayıt durumu](https://github.com/laanlabs/openPlan3D/blob/771c9e1ad30bd1c3cc7584d6eca74deb2e14943d/src/lib/stores/saveStatus.ts) · [Datastore](https://github.com/laanlabs/openPlan3D/blob/771c9e1ad30bd1c3cc7584d6eca74deb2e14943d/src/lib/services/datastore.ts) · [JSON çıkışı](https://github.com/laanlabs/openPlan3D/blob/771c9e1ad30bd1c3cc7584d6eca74deb2e14943d/src/lib/utils/projectBackup.ts) |

### Projeksiyon ve alan sahipliği

Bir Atölye oturumu bir Gaia projesinden **bir yapının** katlarını alır. Gaia tüm yapıları Genel Görünüm'de birlikte çizer. Sera katları −300, 0, +300 cm kotlarıyla ayrı `Floor` kayıtlarıdır. Kümesin düz hacmini açmak için otomatik duvar veya kat oluşturulmaz. Önce Gaia'da gerçek kat eklenirse o kat düzenlenebilir. Bu kapsam üst ilişkilerini kat adına, koordinata veya dış kontura bakarak tahmin etme ihtiyacını kaldırır.

Seçilen yapının yereline `inverse(Wyapı)` ile dönülür. Katın ofseti ve dönüşü uygulanmış yapı-yerel (x,y,z) için plan `(100x,−100y)`, kat kotu `100·zKat`, mobilya tabanı `100·(z−zKat)` olur. Editör açısı, yapı-yerel toplam yaw'ın negatifinin 360'a göre normalize edilmiş halidir. Tersi cm'yi 100'e böler, plan Y işaretini çevirir, taban kotuna kat kotunu bir kez ekler, hedef üst çerçevenin tersini uygular. OpenPlan3D'nin Three sahnesi plan XY'yi XZ'ye açar. Gaia'nın bağımsız Three adaptörü dünya (x,y,z) için metreyle (x,z,−y) kullanabilir.

| Gaia alanı veya editör eylemi                                                                    | İlk düzenleme yetkisi ve geri dönüş                                                                                                                                                                                                                                                                                                                                                                                 |
| ------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Yapı, kat, bölge                                                                                 | Yapı/kat ekleme, silme, kat kotu ve mekânsal üst Gaia komutudur. Editörde kat değiştirme yalnız oturum seçimini değiştirir. Katlar arasında taşıma, kaynak/hedef ve kimliği belli açık Gaia işlemidir. Tek başına kaybolup beliren editör satırından çıkarılmaz.                                                                                                                                                    |
| Düz, sabit kesitli, katta duran gerçek duvar                                                     | Aktif kattaki gerçek duvar OpenPlan3D `Wall` olur. Uçlardan taban başlangıcı, yön ve uzunluk hesaplanır. Kalınlık ve eşit uç yükseklikleri aktarılır. Duvar çizme, taşıma, döndürme, uzatma ve silme desteklenmesi önerilen işlemlerdir. Eğri, eğimli üst kenar, split/join ve açıklık ekleme ilk eşlemenin dışındadır.                                                                                             |
| Katta duran gerçek masa                                                                          | Gaia `object/table + box` ↔ izinli `furniture/catalogId=table`. Konum, yaw, taban yüksekliği ve üç etkin boyut düzenlenebilir. Çıkışta boyut override'ları cm ve çarpanlar 1 yazılır. Girişte pozitif çarpanlar bir kez uygulanır. Aynalama, katalog değişimi ve temsil sınırını aşan yükseklik reddedilir.                                                                                                         |
| Donanım, montaj noktaları, arazi, bölge üyelikleri, bodrum hacmi, depo, yollar ve diğer hacimler | Gaia'ya ait. Gerekirse editörün üstünde kimlikli salt okunur katman olarak gösterilir. Düzenleme Gaia'nın kendi mekânsal komutlarıyla yapılır. Sınır duvarı, sandalye, `Room` veya not üretip bunlardan domain kaydı türetilmez.                                                                                                                                                                                    |
| Referans                                                                                         | Seçilen tek kalibre katman planda kilitli önizlemedir. Çerçeveden yapı yereline dönüştürülen resim merkezi, `100s` cm/px, plan yönüne çevrilmiş açı, opaklık ve geçici data URL yazılır. Fixture'ın zemin katında merkez (1600,800) cm, dönüş +90°, ölçek 10 cm/px olur. Diğer referanslar, kaynak baytları ve kalibrasyon Gaia'da kalır. Değiştirme veya yeniden kalibrasyon Gaia'da kaynak pikselleriyle yapılır. |
| Kamera, aktif kat, seçim ve UI zaman damgası                                                     | Oturum verisidir. Algılanan odalar kalıcı Gaia bölgesine dönüşmez. Yeni materyal, grup, not, açıklık veya desteklenmeyen kalıcı editör alanı için kullanıcıya kayıptan önce neden bildirilir.                                                                                                                                                                                                                       |

İlk düzenlenebilir profil, üstü doğrudan eşlenen kat olan duvar ve masayla sınırlıdır. Gaia'nın desteklediği ancak bu profile girmeyen nesne Atölye'ye girerken listelenir ve salt okunur kalır. Aktif araçlar bu kapsamı yansıtmalıdır. Standart çizim ve seçim kontrolleri upstream'den kullanılır. Adaptör ikinci bir çizim editörü geliştirmeyi gerektirirse 02-A'da maliyet yeniden değerlendirilir.

### Arazi ve yapı düzenleme yüzeyi (01-D/P0-1)

Modelleme Atölyesi tek kullanıcı çalışma alanıdır; arazi planı ve yapı içi düzenleme iki bağlamıdır. Arazi planı Genel Görünüm'ün aynı 2D projeksiyon, seçim, pan/zoom ve kadraj altyapısını kullanır. Salt okunur Genel Görünüm'de düzenleme komutları etkin değildir. Atölye'de kullanıcı arazi sınır köşelerini, yapı hacmi/pozunu, cihaz noktalarının XYZ'sini ve güzergâhın sıralı XYZ köşelerini düzenleyebilir. Basit tıklama/sürükleme ve sayısal kot girişi yeterlidir; ikinci bir CAD, duvar/snap veya geçmiş motoru kurulmaz. Yapı ve kat oluşturma, taşıma, dönme ve silme Gaia komutlarıdır; seçilen yapının iç planı için OpenPlan3D açılır. Yapı/kat bağlamı görünür kalır. Kirli taslakla kapsam değişiminde kaydet/vazgeç/düzenlemeye dön seçenekleri vardır; başarısız kayıt geçişi durdurur. Atölye ve Genel Görünüm aynı kanonik dünyayı kullanır.

02-A'da iki yapı birlikte görünür; biri taşınır, bir cihaz noktası ve kotlu hat yerleştirilir. Duvar/masa ilk fizibilite profilidir, ürünün kalıcı araç sınırı değildir.

### İzinli editör profili (01-D/P0-2)

Sabit upstream commit'ten küçük, yerel Gaia editör giriş noktası kullanılır. İzin profili toolbar ile sınırlı değildir: menü, özellik paneli, kısayol, gesture ve mutasyon sınırında aynı karar uygulanır. İzin dışı işlemler taslağa girmeden durdurulur; son snapshot doğrulaması savunma katmanı olarak kalır. Pan/zoom, seçim, snap, düz duvar ve uç düzenleme, masa pozu/boyutu, kat seçimi, upstream undo/redo ilk yeniden kullanım adaylarıdır. Alt+sürükleme ile eğri duvar, oda silmenin duvarları kaldırması, split/join, açıklık, eğim, aynalama, kalıcı ölçü/not, grup, serbest katalog, import, kat düzenleme ve katlar arası taşıma ilk profilde engellenir. Kat seçimi taşıma değildir. Kayıt kısayolu dahil bütün kayıt girişleri Gaia komutuna gider; IndexedDB autosave/manualSave, agent bridge ve uzak başlangıç yolları Gaia oturumunda devre dışı bırakılır veya izole edilir. Kullanıcıya desteklenmeyen araç ve neden önceden gösterilir. Patch kapsamı ölçülür; kapsamlı fork gerektiriyorsa kabul kapısı yeniden değerlendirilir.

### Oturum, kimlik ve doğrulanmış kayıt

Atölye açılırken adaptör Gaia revizyonunu, seçili yapıyı, kapsamdaki kimlikleri, normalize edilmiş ilk projeksiyonu ve iki yönlü kimlik tablosunu bellekte tutar. Anahtar `(sessionId, editorFloorId, collection, editorId)` olur. Kat ve proje eşlemeleri ayrıca tutulur. Var olan nesnelerin editör kimlikleri Gaia kimliğinden deterministik üretilebilir. Kapsam ve tablo yine doğrulanır. Yeni editör nesnesine ilk kabul edilen oluşturma hareketinde yeni Gaia kimliği ayrılır. Aynı oturumdaki geri alma için bu eşleme korunur. Proje açılırken upstream'in yeniden verdiği proje kimliği Gaia projesinin kimliğini değiştiremez.

```ts
type WallSpec = Extract<Geometry, { kind: "wall" }>;
type TableSpec = Extract<Geometry, { kind: "box" }>;
type EditableShape = WallSpec | TableSpec;

type Edit =
  | { op: "create"; id: Id; floor: Id; p: V3; yaw: number; geometry: EditableShape }
  | { op: "pose"; id: Id; p: V3; yaw: number }
  | { op: "geometry"; id: Id; geometry: EditableShape }
  | { op: "remove"; id: Id };

interface EditBatch {
  project: Id;
  building: Id;
  session: Id;
  baseRevision: number;
  operationId: Id;
  edits: Edit[];
}
type ApplyResult =
  | { ok: true; revision: number }
  | { ok: false; reason: "conflict" | "identity" | "loss" | "invalid" | "storage"; targets: Id[] };
```

1. **Taslak.** Host, projeksiyonu yerel editör store'una verir. Ham OpenPlan3D JSON indirmesi veya IndexedDB autosave'i Gaia kaydı sayılmaz. Gaia host'unda `Kaydet` komutu adaptöre bağlanır. Editörün yerel kütüphane/import, otomatik kalıcılık ve uzak başlangıç yolları bu oturumda devre dışı tutulur veya ayrıştırılır. Sürükleme devam ederken son durum alınmaz. Jest tamamlanınca izinli oluştur/sil/kopyala için yalnız hedef kimlikleri ve gerekli eşleme kaydedilir; kayıt anında açılış ve son tam snapshot karşılaştırılır. Upstream geçmişi tekrar üretilmez. Kayıt yanıtı gelene kadar mutasyon kısa süreli kilitlenir; hata halinde taslak ve geçmiş korunur.
2. **Kimlik.** Snapshot nesneleri kimlik ve koleksiyona göre eşlenir. Ekleme yalnız bilinen oluştur/kopyala eylemi ve izinli sınıfla kabul edilir. Kopya yeni Gaia kimliğiyle yalnız izinli geometriyi alır, cihazı, donanım eşlemesini veya bölge ilişkilerini çoğaltmaz. Silme açık silme niyeti, tam kapsam ve özgün eşleme gerektirir. Filtrelenmiş görünüm, farklı yapı açma, sıra değişikliği veya eksik kat silme sinyali olamaz. Çakışan ID, beklenmedik yeniden anahtarlama veya kanıtlanamayan niyette tüm parti reddedilir.
3. **Değişiklik çıkarımı.** Önce ham farkta değişen her alan sınıflandırılır, sonra `readProject` ve Gaia kurallarıyla normalize edilir. Böylece bir varsayılanın kayıplı düzeltmeyi gizlemesi önlenir. Aktif kat, seçim, tarih ve doğrulanmış görsel varsayılanlar atlanabilir. Diğer farkların tamamı ya izinli bir işleme karşılık gelir ya da kayıt durur. Desteklenmeyen kalıcı bir alanın kaldırılması da fark sayılır. Bir duvar değiştiğinde beraber oynayan komşu uçlar dahil tüm değişen ID'ler incelenir.
4. **Doğrulama.** Host oturumu, yapı, kat ve kayıtlı Gaia kimliğini kendi tablosunda doğrular. Oluşturmada doğrulanan duvar/masa profilinden türü ve rolü, eşlenen kattan üstü belirler. Geometri güncellemesi mevcut türü korur. Konum/geometri güncellemesi mevcut Gaia kaydına dar alan yazımıdır. Editörün gönderdiği sahiplik, rol veya bölgeler kabul edilmez. Kaynak ve hedef aynı açık kapsamda olmalıdır. Sayılar, boyutlar, duvar uçları, kat kotu, asset ve ilişki bütünlüğü geçici dünya kopyasında sınanır. Silme dış referans bırakıyorsa hedefler kullanıcıya gösterilir. Gerekli yeniden bağlamayı Gaia komutu çözer. Zincirleme silme çıkarımı yapılmaz.
5. **Kayıp denetimi.** Önerilen dünyayı tekrar projekte edip izinli alanları son editör durumuyla karşılaştır. Ham negatif scale/aynalama gibi yasak alanları normalizasyondan önce reddet; yalnız açık izinli varsayılanları yok say. Boyutları etkin cm ve açı farkını dairesel karşılaştır. Snap ve UI yuvarlaması ayrı kurallardır; değişmeyen kanonik değerleri yeniden hesaplayıp yazma. Önerilen salt sayısal tolerans konum/boyutta 0,000001 m, yönde 0,000001°'dir. Ekran yuvarlaması kayda geri yazılmaz. ID, üyelik, sınıf, üst, kaynak referans ve kapsam dışındaki kayıtlar başlangıca göre tam eşit olmalıdır (açık oluşturma/silme hariç). Bilinmeyen Gaia alanları dahil dokunulmayan anahtarlar saklanır. Temsil edilemeyen bir fark varsa ilgili ID ve alanla hata döner.
6. **Uygulama.** Host tek proje yazıcısında güncel revizyonu tekrar okur. `baseRevision` eskiyse taslak korunur, kullanıcı yeni revizyonda düzenlemeyi yeniden ele alır. Birleşim veya üzerine yazma otomatik yapılmaz. Tüm parti tek kayıtla uygulanır ve revizyon bir artar. Boş fark yazım yapmaz. Onay ancak kalıcı kayıt başarılı olduğunda döner. Aynı operationId ve aynı içerik son işlem kaydı üzerinden sorgulanabilir; aynı ID farklı içerikle reddedilir. İlk dilimde yalnız son başarılı işlem (kimlik, istek özeti, sonuç revizyonu) dünya ile atomik saklanır. Yeniden deneme güvencesi bir sonraki başarılı farklı işleme kadardır; daha eski/sonucu bilinmeyen istek otomatik tekrar uygulanmaz, durum belirsiz olarak bildirilir ve güncel dünya okunur. Eski baseRevision ile ikinci uygulama engellenir.
7. **Geri alma ve yeniden açma.** Kaydetmeden önce undo/redo, OpenPlan3D'nin kendi jest grupları ve snapshot geçmişiyle çalışır. Adaptör son snapshot'ı başlangıca göre yeniden değerlendirir, ayrılmış kimlikleri aynı geçmiş dalında tekrar kullanır. Yeni dalda bağımsız oluşturma yeni kimlik alır. Kaydet ve yeniden aç, açık bir geçmiş sınırıdır. Başarılı kayıtta projeksiyon ve eşleme yeni revizyondan kurulur, undo geçmişi sıfırlanır. Başarısız kayıtta taslak ve geçmiş kalır. Yeniden yükleme kanonik dünya ve varlıklarını okur. Yarım kalan editör taslağı varsa ayrı bir kullanıcı tercihidir.

**Fixture'da bir kayıt.** Revizyon 7'de `ground ↔ f-ground` ve `(f-ground,furniture,e-table) ↔ bench` eşlemelerini kur. Mevcut masanın editör konumu (200,−100) cm, açısı 330°, boyutları (120,60,80) cm olur. Masayı (300,−100) cm'ye taşı, editör açısını 270° ve enini 150 cm yap. Gaia'ya dönen değerler yerelde (3,1,0) m, yaw 90°, boyut (1.5,0.6,0.8) m, dünyada (11,17,0) m ve yaw 180°'dir. Kopya ayrı ID alır. Kopyayı silip geri alırken aynı kopya döner. Silmeyi yineleyip kaydettiğinde revizyon 8'de yalnız `bench` değişmiştir, `zoneIds: [bed]` korunur. Var olan `partition` duvarının ucunu 1 m uzatma ve yeni duvar çizme ayrı geometri testleridir. Editör JSON'unda görünmeyen `c1`, su hattı ve `survey` kontrol noktaları Gaia kaydında aynen bulunur.

## 5. Genel Görünüm kontratı

Genel Görünüm, proje deposundan doğrulanmış dünyanın salt okunur görünümünü alır. Seçim ve kamera durumu her görünüm örneğine aittir. Ağaçtan seçilen kimlik ile sahnede tıklanan kimlik aynı kaydı açar. Odaklanma seçilen nesnenin ve gerekiyorsa alt öğelerinin dünya sınırlarını kadraja alır. Noktalar için asgari kadraj yarıçapı uygulanır. Gizli kattaki nesneyi odaklama görünürlük değişikliğini kullanıcıya bildirir.

```ts
interface ViewFilter {
  site: Id;
  building?: Id;
  floors?: Id[];
  underground: boolean;
}
interface Badge {
  deviceId: Id;
  link: LinkView["state"];
  last?: Observation;
  stale: boolean;
}
interface GaiaViewer {
  show(world: Readonly<World>, filter: ViewFilter): void;
  setFilter(filter: ViewFilter): void;
  select(id: Id | null): void;
  focus(id: Id): void;
  updateStatus(batch: readonly Badge[]): void;
  hide(): void;
  dispose(): void;
}
```

- **Gösterim.** Arazi, yapı, kat, bölge, nesne ve noktalar için aynı dünya dönüşümleri 2D planı, hafif izometrik görünümü ve isteğe bağlı orbit 3D'yi besler. Üst-alt gezinme `parent`, alan üyeliği `zoneIds` üzerinden yapılır. Aynı noktaya bağlı cihazların rozetleri kendi cihaz kimlikleriyle seçilir. Cihaz seçimi noktasına odaklanır, konumsuzsa envanter bilgisi açılır. Detaysız kümes doğrudan bir kutu olarak görünür.
- **Görünürlük.** Kapalı bir katın çerçeve çocukları gizlenir. Araziye bağlı tank ve hatlar belirli bir katın çocuğu sayılmaz. İlk yer altı filtresinin referansı arazinin yerel Z=0 düzlemidir. Yer altı kapalıyken bir hattın düzlemi kesen segmenti kesişme noktasında kırpılır. Açıldığında tank ve bodrum seçilebilir. Bu işlem kanonik köşelere dokunmaz. Topografya/eğim için yüzey modeli gelecekteki karardır.
- **Canlı güncelleme.** `deviceId → mount → sahne örneği` indeksi renk, simge ve zaman etiketini günceller. Sanal, fiziksel eşlenmemiş, çevrimdışı ve son bilinen durum okunabilir etiket taşır. Güncelleme mesh üretmez, dünya revizyonu veya geometri tamponları değişmez.
- **Yaşam döngüsü.** Görünür olunca gerekli motor tembel yüklenir. Tek abonelik takımı kurulur ve en yeni dünya/durum alınır. Oda veya sekme gizlenince animasyon karesi, kontroller, zamanlayıcılar, UI abonelikleri ve render tetikleyicileri durur. Bekleyen yüklemeler iptal edilir veya görünüm nesliyle denetlenir. Yeniden gösterme sırasındaki snapshot ve sonraki olaylar sıralanır. Kapanışta dinleyiciler, observer'lar, GPU geometry/material/texture/render target, kontroller, renderer, canvas ve tutulan referanslar bırakılır. Geç dönen yüklemeler de temizlenir. `hide` ve `dispose` tekrarlanabilir, dispose edilen görünüm yeniden kullanılmaz. UI dışındaki yetkili fiziksel görevlerin ömrü ayrıdır.
- **Host sinyali.** `RoomPage.onShow` ve `disposeRoom` kaynakta vardır. Sayfa gizleme yalnız CSS sınıfıyla gerçekleşebildiğinden görünür pencere içinde başka odaya geçiş ayrıca sınanır. Oda içi sekme kapatma, uygulama görünürlüğü ve gerçek oda navigasyonundan aynı görünüm sözleşmesine sinyal verilmesi 02-A kabulüdür. [RoomPage](src/js/pages/room-page.ts) · [RoomHostRuntime](src/js/modules/rooms/room-host-runtime.ts)

**Kaynakta ayrılabilen parçalar.** `frameScene(camera,bounds,target)` Three nesneleri alır, `createRoomSlabGeometry(polygon,thickness,holes)` doğrudan geometri döndürür. İkisi de editör store'una bağlanmadan çağrılabilecek adaylardır. Slab'ın cm, eksen ve bellek sahipliği ile kadrajın cm ölçeğindeki sabitleri Gaia adaptöründe hesaba katılmalıdır. `ThreeViewer.svelte` aktif kat, seçim, katalog, ayarlar ve AI UI'sine bağlıdır. Talep üzerine render ve unmount temizleme kodu içermesi tek başına bağımsız viewer kanıtı sağlamaz. Gaia sahne ağacı, cihaz rozetleri, çok yapılı seçim, yer altı filtresi, görünürlük bağlantısı ve 2D fallback Gaia'ya aittir. Kabul deneyi editör/store yüklenmeden soğuk açılışı ölçer. [Kadraj](https://github.com/laanlabs/openPlan3D/blob/771c9e1ad30bd1c3cc7584d6eca74deb2e14943d/src/lib/utils/frameScene.ts) · [Döşeme geometrisi](https://github.com/laanlabs/openPlan3D/blob/771c9e1ad30bd1c3cc7584d6eca74deb2e14943d/src/lib/utils/roomSlabGeometry.ts) · [Viewer bileşeni](https://github.com/laanlabs/openPlan3D/blob/771c9e1ad30bd1c3cc7584d6eca74deb2e14943d/src/lib/components/viewer3d/ThreeViewer.svelte)

## 6. Room-storage ve veri ömrü

### Güvenilen tek yazıcı sınırı (01-D/P0-3)

Oda host modülünün renderer'da çalışması güvenilir dosya işlemi sınırı değildir. UI, roomAPI/SlotBridge ile proje kimliği, revizyon, işlem kimliği ve dar doğrulanabilir alan değişiklikleri gönderir; mutlak yol veya yetki beyanı göndermez. Oda domain'i aday dünyayı ve editör semantiğini doğrular. Yetkili Electron main dosya işlemi sınırı çağıran oda/komut kapsamını, oda storage kökünü ve proje kimliğini güvenilir bağlamdan çözer; proje başına tek kuyrukta mevcut revizyon/işlem kimliği kontrolü, varlık yayını ve atomik kayıt işlemini birlikte gerçekleştirir. Renderer'dan gelen adayın şema/domain doğrulaması oda kontratına göre güvenilir yürütme yolunda sağlanır; core Gaia'nın domain kurallarını sahiplenmez. Mevcut host API bu atomik işlemi sunmuyorsa yalnız gereken genel room-storage yeteneği eklenir; uygulanabilirliği 02-A/2'de kanıtlanır. `internal` katalog görünürlüğü yetkilendirme değildir. Dosya yolu, symlink ve oda kapsamı doğrulaması zorunludur; bu sınır tek başına OS sandbox iddiası değildir.

Atomik rename süreç kesintisinde yarım JSON'u önlemeyi hedefler; güç kaybına dayanıklılık kanıtı değildir. Bozuk JSON boş proje olarak açılmaz; son işlem bilgisi ve world revizyonu aynı yayındadır. Sahipsiz varlık temizliği aynı proje yazıcısıyla sıralanır.

İlk dönemde bir proje için tek sürümlü UTF-8 JSON ve ayrı yerel varlıklar yeterlidir. Renderer yalnız oda komutlarıyla okur/yazar. Host, güvenilir runtime bilgisindeki oda storage kökünü çözer. Yol uygulama çalışma dizinine, kullanıcı girdisiyle seçilmiş bir üst dizine veya hesap arşivine bağlanmaz. [Room-storage ayrımı](rooms/README.md) · [Yol çözümlemesi](electron/paths.ts)

| Konum                                                  | İçerik ve ömür                                                                                                                                                                                                                                                              |
| ------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `rooms/gaia-room`, `rooms/.build/gaia-room/runtime`    | İleride kaynak ve üretilebilir runtime. `data/rooms` eski paket kopyasıdır. Kullanıcı dünyası ve medya oda paketine yazılmaz.                                                                                                                                               |
| `data/room-storage/gaia-room/projects/<id>/world.json` | Kanonik proje, yerleşim, sanal envanter ve varlık referansları. Başlangıçta tek yazıcı, şema sürümü ve proje revizyonu yeterlidir.                                                                                                                                          |
| Aynı projenin `assets/<assetId>` alanı                 | Referans görüntüleri ve kalıcı proje medyası özgün baytlarıyla kalır. İçeriği değiştirmek yeni asset kimliği gerektirir. JSON içindeki MIME ve piksel boyutları açılışta doğrulanır. Eksik görselde geometriler açılır, katman eksik gösterilir ve referansı korunur.       |
| Ayrı medya ve geçici durum                             | İleride gözlem medyası kullanıcı saklama tercihiyle tutulur. Proje ile paylaşılan varlık son referans kalkana kadar korunur. Kamera, seçim, kimlik tablosu, undo ve editör JSON'u oturum belleğinde tutulabilir. Yeniden üretilebilen önbellek proje olmadan da atılabilir. |

Yazıcı önce değişmez yeni asset'i aynı proje içinde tamamlar. Aday JSON'u doğrular, aynı dizinde geçici dosyayı tamamlayıp atomik yeniden adlandırma ile yayınlar. Yayından önce hata olursa önceki kayıt ve varlıkları açılır. Yayından sonra yalnız yeni revizyon görünür. Başarısız yazımın bıraktığı referanssız yeni varlık daha sonra yalnız o proje içinde temizlenebilir. Tek yazıcı revizyon kontrolünden yayın sonuna kadar işlemleri sıralar. Kimlikten yol üretirken kök dışına çıkış ve sembolik bağla kaçış engellenir. Uygulamada bu işlemleri sağlayan mevcut yetkili host yüzeyi doğrulanır.

Bu dönemde yalnız yeni Gaia deney projeleri açıkça yeniden oluşturulabilir. Şema uyumsuzluğunda dosya otomatik sıfırlanmaz. Mevcut Hayalet Ev verileri ve kişisel medya bu kapsama girmez. Hacim/geçmiş sorguları gerektirirse Gaia'ya ait SQLite değerlendirilir. Gerçek kullanıcı verisi, ikinci kurulum, release veya korunacak dış bağımlılık oluşunca GAIA.md kural 12 uygulanır. Migration, yedekleme/geri yükleme, rollback, bütünlük ve yükseltme o dönem kararına bağlanır.

## 7. Kabul matrisi

Her satır bağımsız bir senaryodur ve aksi belirtilmedikçe revizyon 7 ile başlar. 01-C'deki belge ve örnek hesap kontrolleri entegrasyon deneyi sayılmaz.

| Alan                    | Girdi / eylem                                                                                                                       | Geçme koşulu                                                                                                                                                                                                           |
| ----------------------- | ----------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Geometri                | Döndürülmüş serada bodrum ve üst kat noktalarını dünya → yerel → dünya taşı                                                         | `mc1=(11,16,−2)`, `mr1=(11,15,4.8)` m. Ters dönüşüm ve yinelenen 100 kayıt/açma ilk değere tanımlı toleransta döner.                                                                                                   |
| Mesafe                  | Su hattı ve iki ucu                                                                                                                 | Yatay 5, doğrudan √34, güzergâh 8 m. Kamera, görünürlük veya rota düğümünün rijit dönüşümü değerleri değiştirmez.                                                                                                      |
| Kapsam                  | İkinci ötelemeli/dönük araziyi ve serayla aynı kotta bağımsız katı ekle, yalnız serayı düzenle                                      | Kimlik, üyelik ve dünya dönüşümleri doğru arazide çözülür. Diğer yapı ve yeni arazinin kayıtları tam eşit kalır. Katsız kümes soğuk açılışta görünür.                                                                  |
| Pozitif round-trip      | Duvarı UI'da çiz, iki ucunu ayrı hareket ettir. Fixture masasını taşı, döndür, ölçekle, kaydet ve Gaia'dan yeniden yükle            | `partition` uzatılınca uzunluk 4 m olur. Masa için yukarıdaki (11,17,0), 180° ve boyutlar elde edilir. Düzenlenen kimlikler sabittir, ikinci değişikliksiz kayıt revizyonu artırmaz.                                   |
| Kopya, silme, undo/redo | Masayı çoğalt, kopyayı sil, geri al, yinele. Geri alıp yeni dalda başka masa ekle                                                   | Orijinal ID sabit, redo aynı nesneyi geri getirdiği adımda aynı ID'yi kullanır. Yeni dal farklı ID alır. Açık silme yalnız hedefi kaldırır. Undo sonrası kayıtta son görünür taslak geçerlidir.                        |
| İlişki ve kimlik        | Çakışan editör kimliği, kat taşıma sırasında yeniden verilen ID, filtreli snapshot, bağlı öğesi olan silme                          | Belirsiz hareket atomik reddedilir. Aynı yapıdaki iki kata açık Gaia taşımasında seçilen dünya pozu korunur, ID ve cihaz bağı sürer. Açık işlem olmadan çocuk, bölge bağı veya cihaz silinmez.                         |
| Kayıp                   | Eğri/eğimli duvar, kapı, negatif scale veya kilitli arka planın silinmesiyle birlikte geçerli bir masa hareketi gönder              | Her denemede ilgili alan/ID görünür hata verir. Geçerli hareket dahil hiçbir değişiklik yayımlanmaz. Salt okunur alanlar, özel Gaia alanı, cihazlar ve hat köşeleri birebir kalır.                                     |
| Kalibrasyon             | PNG, iki kontrol noktası, dönük yapı ve farklı kamera zoom'u ile kayıt/yeniden açma                                                 | İki nokta arası 10 m, görsel merkezi ve +90° editör yönü korunur. PNG baytları, asset ID ve ham noktalar aynı kalır. Çakışık noktalar reddedilir. Eksik PNG ile dünya açılır.                                          |
| Saklama                 | Aynı revizyondan iki kayıt, disk dolu, asset sonrası ve JSON yayını öncesi kesinti, onay kaybı ve tekrar                            | Tek geçerli revizyon yayımlanır. Eski dünya veya tamamlanmış yeni dünya açılır. Çift ekleme ve eksik varlığa yeni referans oluşmaz. Hata taslağı düzenlenebilir bırakır.                                               |
| Cihaz                   | Sanal, yerleşmemiş, eşlenmemiş, eşlenmiş çevrimdışı, sonra değiştirilmiş donanım. İki bölgeye üye `mc2`                             | Rozet kaynağı/tazeliği doğru gösterir. Donanım değişiminde mount ve mantıksal ID sabittir. Önceki gözlem eski donanımda kalır. Telemetri akışı mesh sayısını, geometri özetini ve revizyonu değiştirmez.               |
| Görünüm                 | Editör hiç yüklenmeden projeyi aç, ağaçtan ve plandan seç, odakla, kat ve yer altını aç/kapat                                       | Seçimler aynı Gaia ID'sini döndürür. Tank, bodrum, hat kesiti ve kümes doğru görünür. Filtre sonucu sahneyle sınırlı kalır. WebGL yokken 2D plan ve seçim çalışır.                                                     |
| Yaşam döngüsü           | Aynı görünür Electron penceresinde oda/sekme değiştir, hızlı gizle–göster, yükleme sürerken kapat, çevrimi tekrarla                 | Gizliyken Gaia render çağrısı ve aktif UI aboneliği sıfırdır. Yeniden gösterirken tek abonelik ve en yeni durum vardır. Dispose sonrası canvas, dinleyici, bekleyen kare ve sahip olunan GPU kaynakları bırakılır.     |
| Dağıtım ve maliyet      | Aynı fixture, çözünürlük ve süreyle görünür boşta, etkileşim, gizleme ve kapatma ölç. Dış ağı engelleyip paketlenmiş odada çalıştır | CPU/RAM, mümkünse GPU ve tekrar açılış eğilimi kaydedilir. Başka oda gerekmeksizin TR/EN, tema, kayıt ve viewer çalışır. Firebase/analytics isteği, uzaktan zorunlu varlık ve lisansı belirsiz dağıtım girdisi kalmaz. |

### 01-D ek kabul senaryoları

- Kind–geometry–parent uyumu açık doğrulama tablosuyla kesinleşir. Yeniden bağlama dünya veya yerel pozu açık seçer; arazi değişiminde geçersiz zoneIds aynı işlemde çözülür. Silmede etkilenen çocuk/üyelik/referans/mount gösterilir; kopya yalnız izinli alanları alır. Fixture'a ayrı XY ofsetli ve yaw'lı kat testi eklenir; mevcut fixture hesapları değişmez. Kot yalnız bir kez eklenir.
- Alt+sürükleme, oda silme, kat seçimi/taşıma ayrımı, kayıt kısayolu, IndexedDB ve diğer yasak mutasyonlar gerçek UI yolunda taslağı değiştirmez. Bağlı duvar uçları, kopya ve undo/redo tam snapshot ile tek atomik partide doğrulanır. Kayıt beklerken jest yapılamaz.
- Kayıp onay, aynı işlem kimliğiyle tekrar, farklı içerikle kimlik çakışması, eski işlemden sonra başka kayıt ve disk/süreç hatası ayrı testlerdir. Son işlem güvencesinin sınırı kullanıcıya açıktır. Yetkisiz oda, kök dışı yol, symlink ve eşzamanlı yazma reddedilir.
- Viewer için Three.js primitifleri, Raycaster, OrbitControls, Box3 ve gerekirse saf upstream yardımcıları tercih edilir. Kadraj cm sabitleri metreye uyarlanır. Gerçek oda navigasyonunda onHide/onShow sinyali mevcut host köprüsü üzerinden webview'e taşınır; gizleme/dispose ve geç yükleme ölçülür.
- Paketleme: sabit upstream commit ve tekrarlanabilir bağımsız bundle; room builder'ın SvelteKit'i otomatik bundle ettiği varsayılmaz. Göreli asset yolları, patch envanteri, lisans/notice, temiz profilde kurulu .hevroom ve ağ engelli editör kayıt turu kabul şartıdır.

P2: çizilmiş hat gerçek fiziksel bağlantı değildir; ilk dilimde hat kendi çerçevesinde kalır, taşınan bina ucunu otomatik sürüklemez. Port/uç referansı, sağlayıcı kapsamlı hardwareId ve geçmiş protokolü gerçek ihtiyaçta eklenir. Jeoreferans, pitch/roll, topografya, SQLite, çoklu sağlayıcı ve otomasyon altyapısı ertelenir.

## 8. Uygulama sırası ve karar kapıları

01-D bağımsız audit tamamlandı: karar 2 (sınırlı düzeltmelerden sonra hazır). P0 kontratları yukarıda kabul edildi; P1 kabul senaryolarına, P2 sonraki ihtiyaçlara bağlandı. Audit fixture kimlik, ilişki ve hesaplarını doğruladı, çalışma zamanı entegrasyonu veya full test yapmadı.

| Paket  | Agent/model ve reasoning önerisi               | Çıkış                                                                                                                                                                                          |
| ------ | ---------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 02-A/1 | GPT-6.2 Sol / xhigh                            | Dar fixture, gerçek duvar ve masa UI hareketleri, kimlikli değişiklik ve yeniden projeksiyon, kopya/undo, izin profili, upstream patch maliyeti. Tam domain veya oda iskeleti öncesi ilk kapı. |
| 02-A/2 | GPT-6.2 Astra / xhigh                          | İlk tur gerçek oda komutu ve güvenilen tek yazıcıyla kalıcı; revizyon/işlem kimliği, hata ve varlık testleri.                                                                                  |
| 02-A/3 | GPT-6.2 Sol / high                             | Ortak arazi planı, yapı taşıma, cihaz ve hat yerleştirme, editörsüz viewer, sanal rozet ve hide/dispose.                                                                                       |
| 02-A/4 | GPT-6.2 Sol / high; fixture/TR-EN/smoke medium | Kurulu oda, offline, notice, diğer odalardan bağımsızlık, kaynak ölçümü ve bağımsız kabul.                                                                                                     |

Model adları öneridir; CLI'da gerçekten kullanılabilir model seçilir. İlk paketin çıkışından önce sonraki paketlere başlanmaz. 02-B/C/D ancak 02-A kabulünden sonra açılır. Ağ, cihaz ve fiziksel güvenlik kendi milestone'unda ele alınır.

**02-A'da kanıt gerektiren riskler.** Upstream giriş noktalarında işlem niyetini tüm UI yollarından (klavye, menü, drag ve undo dahil) yakalama, IndexedDB/uzak yolları ayırma, store'suz viewer, görünmeyen oda sinyali, atomik host dosya işlemi ve transitif varlık lisansları açıktır. Kaynak incelemesi bunların davranış testini karşılamaz. Performans hedefleri eş sahnede hedef donanım ölçümüyle belirlenir.

**Teknoloji seçiminden vazgeçme koşulu.** Desteklenen düzenlemede kimlik, kat, ilişki, kalibrasyon veya bilinmeyen Gaia alanları kaybolursa, Genel Görünüm editör runtime'ına mecbur kalırsa, ölçülen kaynak tüketimi hedef donanımda kabul edilemezse ya da çevrimdışı/lisans koşulları sağlanamazsa 02-A geçmez. Nedeni aynı fixture ile yeniden gösterilir. Bu durumda mevcut karar uyarınca yalnız Pascal'ın referans host'unda tam UI düzenleme–kayıt–yeniden açma ve eş sahne deneyi tekrar değerlendirilir. Gaia dünyası ve kabul ölçütleri bu karşılaştırmada ortak kalır.
