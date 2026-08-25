# 🧪 Laboratory

Laboratory bir araç ekranı değil, bir çalışma tezgâhıdır.

Amaç bir medya dosyasını yalnızca açmak veya bir AI'ya analiz ettirmek değildir. Kaynağı çalışma alanına almak, gerekli zemini hazırlamak, insan gözüyle incelemek, otomatik analizleri uygulamak, bulguları işaretlemek ve sonucu tekrar kullanılabilir bir çalışma bağlamına dönüştürmektir.

```text
Kaynak
  ↓
Hazırlık
  ↓
İnceleme
  ↓
Analiz
  ↓
Karşılaştırma / Annotation
  ↓
Rapor / Export
  ↓
AI ile devam
```

> Otomatik analiz insan incelemesinin yerine geçmez; onunla aynı çalışma alanında bulunur.

## 🔬 Bugünkü Laboratory

Güncel Laboratory iki ana özellik yüzeyini aynı guided workbench içinde toplar:

- **Media Analysis**
- **Audio Analysis**

Bu nedenle Laboratory yalnızca player, editör veya rapor ekranı değildir. Kaynak, araç, işlem, sonuç ve rapor aynı proje bağlamında tutulur.

## 📥 Kaynak ve Proje

Laboratory çalışmayı tek seferlik bir işlem olarak değil, proje olarak ele alır.

Kaynak katmanı yerel medya kaynaklarının yanında desteklenen URL/YouTube intake akışlarını da barındırabilir.

Proje katmanı şu ilişkileri korur:

- kaynak,
- türetilmiş varlıklar,
- analiz durumu,
- sonuçlar,
- rapor,
- export kayıtları.

Böylece aynı kaynağa daha sonra geri dönülebilir ve analiz süreci yalnızca son dosyadan ibaret kalmaz.

## 🧰 Readiness

Bir analiz başlamadan önce Laboratory mümkün olduğunca çalışma zemininin durumunu görünür kılar.

Room-local readiness akışı:

- gerekli araçları,
- model/runtime bağımlılıklarını,
- eksik bileşenleri,
- otomatik hazırlanabilecek parçaları,
- kullanıcı müdahalesi gerektiren adımları

gösterebilir.

Bu yaklaşım ağır medya ve model işlemlerini kara kutu haline getirmemeyi amaçlar.

## 🖼️ Görüntü ve Video

Media Analysis çalışma alanında güncel olarak:

- tek görsel inceleme,
- iki görsel karşılaştırması,
- zoom/pan,
- aktif karşılaştırma tarafı,
- ROI/seçim,
- detay/geometri odaklı inceleme,
- capture/export,
- iki görseli tek PNG çıktısında birleştirme

gibi yüzeyler bulunur.

Video kaynakları aynı proje ve timeline altyapısıyla çalışır.

## 🧪 Görsel Stress Testleri

Video çalışma alanındaki kontrollü stress-test katmanı kaynak medyayı değiştirmeden aynı timeline/ROI bağlamında tekrar üretilebilir ölçümler yapar.

Mevcut yüzeyler arasında:

- Ordered Visual Transform Stack,
- Source / Transform / Difference preview,
- Temporal Scan,
- Photometric Attenuation Probe,
- Motion Vector / Impact Probe,
- Sensor / Codec Destruction Controls,
- Target / Background Differential Photometry,
- Visibility / Contrast Response Curve,
- Appearance / Disappearance Transition Probe,
- optional Target / Control / Background ROI workflow,
- Structural Transition timeline,
- ROI drift diagnostic ve confidence-gated translation stabilization,
- CRF `18 → 24 → 30 → 36 → 42` recompression ladder

bulunur.

Diferansiyel görsel testlerde Target ve Background birbirinden bağımsız ROI olarak seçilir. Transition analizi için ayrıca opsiyonel bir **Control ROI** seçilebilir. Control, hedef dışında mümkün olduğunca benzer başlangıç görüntü özelliklerine sahip sabit bir sahne bölgesi olarak kullanılır; Laboratory bunun semantik olarak doğru kontrol nesnesi olduğunu iddia etmez.

Response sweep eksenleri exposure, gamma, brightness, black level, contrast, local contrast, blur, denoise ve sharpen'dır. Luma dağılımı, chroma, near-black, recovered/persistent dark, edge energy/persistence, frame-change, temporal persistence, signal/noise-benzeri değer ve visibility score gibi metrikler birlikte kaydedilir.

Transition Probe seçim orta noktasını olay zamanı olarak kullanır ve yaklaşık olarak PRE / EVENT / POST pencerelerini karşılaştırır. Mevcut fotometrik sonuçlara ek olarak Structural Transition, PRE içindeki temsilî görüntüyü baseline alıp event çevresinde SSIM-benzeri similarity, pixel correlation, normalized pixel difference, edge similarity ve structural persistence üretir.

Structural timeline yaklaşık `-1.0 → +1.0 s` arasında kısa örnekler tutar. Target, Control ve Background structural loss değerleri ayrı kalır; Target-Control ve Target-Background diferansiyelleri ayrıca raporlanır.

ROI stabilization ilk sürümde translation-only'dir. Mevcut Motion Reference lock varsa reference olarak kullanılır; yoksa Background ROI üzerinden translation tahmini denenebilir. Tracking confidence düşükse sessizce correction uygulanmaz ve fixed-ROI fallback raporlanır. Rotation, zoom ve perspective bu ilk sürümün kapsamı dışındadır.

Bu katman “gerçek/sahte” veya mekanizma kararı vermez. Sonuç dili hedef ile kontrol/arka planın birlikte değişmesi, target'a lokalize ek değişim, sahne-geneli değişim, ROI drift riski veya belirsizlik gibi ölçüm sınıflarıyla sınırlıdır.

Ayrıntılı kontratlar:

- [rooms/laboratory/VISUAL-RESPONSE-STRESS-PROBES.md](rooms/laboratory/VISUAL-RESPONSE-STRESS-PROBES.md)
- [rooms/laboratory/STRUCTURAL-TRANSITION.md](rooms/laboratory/STRUCTURAL-TRANSITION.md)

## ✏️ Annotation

Görüntü çalışma alanında room-local annotation katmanı bulunur.

Desteklenen araçlar:

- serbest kalem,
- daire/elips,
- çizgi kalınlığı,
- çizgi rengi,
- temizleme/sıfırlama.

Annotation kaynak dosyayı değiştirmez. İşaretler çalışma oturumunun parçası olarak tutulur ve capture/export sırasında çıktıya yansıtılabilir.

Bu ayrım önemlidir: kaynak veri ile insanın çalışma sırasında üzerine koyduğu işaret aynı şey değildir.

## 🔊 Audio Analysis

Audio Analysis, Laboratory'nin ayrı bir uygulaması değildir. Aynı proje, readiness, işlem ve raporlama yaklaşımını kullanır.

Mevcut pipeline'lar arasında:

- sinyal ve yerel analiz/probe,
- speech/transcript hazırlıkları,
- forensic analiz,
- music/rhythm model analizi,
- sound-event model analizi,
- source-separation model akışları

bulunabilir.

Kullanılabilirlik gerekli araç ve model durumuna bağlıdır.

## 📈 Sonuçlar

Laboratory sonuçları yalnızca “başarılı” veya “başarısız” olarak ele almaz.

Çalışma alanı ve sonuç yüzeyleri:

- türetilmiş varlıkları,
- analiz sonuçlarını,
- timeline bağlamını,
- seçili kapsamı,
- çalışma bölgelerini,
- keşif sonuçlarını

aynı proje içinde tutar.

Amaç bulguyu kaynağından koparmamaktır.

## ⚙️ Process

Bir analiz koşusu başladığında süreç proje durumuna bağlanır.

Mümkün olduğunca şu bilgiler görünür tutulur:

- hangi aşamanın çalıştığı,
- hangi aracın kullanıldığı,
- hangi varlığın üretildiği,
- neyin eksik kaldığı,
- hangi adımın yeniden denenebileceği.

Bu, özellikle uzun süren medya/model işlemlerinde önemlidir.

## 📊 Rapor ve AI Handoff

Laboratory raporu yalnızca işlemin sonunda üretilen dekoratif bir özet değildir.

Rapor:

- neyin bulunduğunu,
- neyin bulunamadığını,
- hangi koşullarda çalışıldığını,
- seçilen çalışma bağlamını,
- insan incelemesinin önemli noktalarını,
- AI'nin yeniden değerlendirebileceği teknik bağlamı

taşıyabilir.

Görsel stress-test sonuç kartlarında desteklenen akışlar structured Markdown kopyalama / dışa aktarma sağlayabilir. Structural Transition export'u ROI'leri, fotometrik fazları, structural timeline'ı, Target-Control diferansiyelini ve ROI stability bilgisini tek AI-handoff metninde korur.

Desteklenen akışlarda rapor veya seçili çalışma bağlamı AI slotuna aktarılabilir. Böylece yeni bir sohbet başlatmak yerine mevcut çalışmanın devamı oluşturulur.

## 💾 Export

Güncel görüntü akışında export:

- tek çalışma anı,
- iki görsel karşılaştırması,
- annotation uygulanmış karşılaştırma,
- desteklenen görsel stress-test kartlarında structured Markdown rapor

gibi çıktılar üretebilir.

Export kaynak dosyayı destructive biçimde değiştirmez.

## 🧭 Çalışma İlkeleri

Laboratory geliştirilirken:

- kaynak dosya ile çalışma durumu ayrılır,
- annotation kaynak medyayı sessizce değiştirmez,
- araç/model hazırlığı görünür tutulur,
- sonuç kaynak ve proje bağlamından koparılmaz,
- UI, runtime ve host ownership sınırları korunur,
- deneysel özellikler uygulanmış özellik gibi belgelenmez,
- AI çıktısı otomatik olarak doğrulanmış bulgu kabul edilmez.

## 🧱 Kaynak Yapısı

Laboratory'nin editable source of truth'u `rooms/laboratory` altındadır.

Önemli katmanlar:

- `features/media-analysis/`
- `features/audio-analysis/`
- `shared/host/`
- `runtime/`
- `ui/`
- `tools/`

Ayrıntılı ownership kuralları: [rooms/laboratory/README.md](rooms/laboratory/README.md).

## ✅ Doğrulama

```bash
node rooms/laboratory/scripts/laboratory-check.mjs
npm run check:all
```

Yeni structural / diferansiyel regression'ları doğrudan çalıştırmak için:

```bash
npm run rooms:test:file -- scripts/tests/laboratory-structural-transition-regressions.test.ts
npm run rooms:test:file -- scripts/tests/laboratory-visual-stress-dual-roi-regressions.test.ts
npm run rooms:test:file -- scripts/tests/laboratory-visual-response-regressions.test.ts
```

## 🎯 Amaç

Laboratory'nin amacı yalnızca bir analiz işlemini tamamlamak değildir; kaynağı açmak değil, onunla çalışmaktır.

Kaynak hazırlanır. İnsan inceler. Araçlar analiz eder. İşaretler eklenir. Bulgular kaydedilir. Rapor oluşur. Çalışma gerektiğinde AI ile başka bir aşamaya taşınabilir.
