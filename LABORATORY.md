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
- feature-consensus ROI Tracking / Stabilization ile `dx`, `dy`, rotation ve scale tahmini,
- Background Reference event↔reference hizalama ve convergence ölçümü,
- Tracking Preview ile raw / stabilized ROI karşılaştırması,
- CRF `18 → 24 → 30 → 36 → 42` recompression ladder

bulunur.

Diferansiyel görsel testlerde Target ve Background birbirinden bağımsız ROI olarak seçilir. Transition analizi için ayrıca opsiyonel bir **Control ROI** seçilebilir. Control, hedef dışında mümkün olduğunca benzer başlangıç görüntü özelliklerine sahip sabit bir sahne bölgesi olarak kullanılır; Laboratory bunun semantik olarak doğru kontrol nesnesi olduğunu iddia etmez.

Response sweep eksenleri exposure, gamma, brightness, black level, contrast, local contrast, blur, denoise ve sharpen'dır. Luma dağılımı, chroma, near-black, recovered/persistent dark, edge energy/persistence, frame-change, temporal persistence, signal/noise-benzeri değer ve visibility score gibi metrikler birlikte kaydedilir.

Transition Probe seçim orta noktasını olay zamanı olarak kullanır ve yaklaşık olarak PRE / EVENT / POST pencerelerini karşılaştırır. Mevcut fotometrik sonuçlara ek olarak Structural Transition, PRE içindeki temsilî görüntüyü baseline alıp event çevresinde SSIM-benzeri similarity, pixel correlation, normalized pixel difference, edge similarity ve structural persistence üretir.

Structural timeline yaklaşık `-1.0 → +1.0 s` arasında kısa örnekler tutar. Target, Control ve Background structural loss değerleri ayrı kalır; Target-Control ve Target-Background diferansiyelleri ayrıca raporlanır.

### ROI Tracking / Stabilization

Kamera hareketi nedeniyle sabit ekran koordinatındaki bir ROI fiziksel sahne bölgesinden ayrılabilir. Güncel tracking katmanı bu kirliliği azaltmak için tek bir hareketli Target'ı kamera referansı kabul etmek yerine çoklu sabit görüntü özelliklerinden consensus üretir.

Tracking modeli similarity transform kullanır ve şu bileşenleri tahmin eder:

- `dx`,
- `dy`,
- rotation,
- scale/zoom.

Target global kamera-feature tahmininden çıkarılır; Control verilmişse o da çıkarılır. Background/Reference bölgesi gerektiğinde yerel fallback referansı olarak kullanılabilir. Feature count, inlier ratio, forward/backward consistency ve residual error birlikte confidence/quality değerlendirmesine girer.

Tracking kalitesi yetersizse yanlış transform sessizce uygulanmaz; fixed-ROI fallback açıkça raporlanır. Bu fallback geriye dönük uyumluluk değil, ölçüm güvenliği davranışıdır.

Structural Transition, kalite gate'i geçtiğinde Target/Control/Background ölçüm koordinatlarını bu camera transform ile taşır. Kaynak medya değiştirilmez; yalnız ölçüm koordinatları değişir.

Perspective/homography güncel modelin parçası değildir. Rotation uygulanmış bir ROI crop için axis-aligned bounding box ile temsil edilebilir; bu nedenle yüksek perspective veya büyük rotation içeren sahneler ayrıca temkinli yorumlanmalıdır.

Tracking Preview raw ROI ile stabilize edilmiş ROI davranışını görsel olarak karşılaştırmak için diagnostik bir yüzeydir; sayısal confidence insan görsel kontrolünün yerine geçmez.

### Background Reference

Appearance / Disappearance çalışmasında kullanıcı Target'ın bulunduğu fiziksel bölgenin hedef yokken görünen temiz halini farklı bir zamanda Background Reference olarak işaretleyebilir.

Laboratory event anındaki Target bölgesini referans zamanına camera transform üzerinden hizalamaya çalışır ve Target yapısı azalırken görüntünün temiz arka plan referansına yakınsayıp yakınsamadığını ölçer.

Reference transform kalite gate'ini geçmezse convergence sonucu güçlü bir çıkarım için kullanılmaz ve sınırlı/güvenilmez hizalama olarak raporlanır.

### Fotometrik koordinat sınırı

Mevcut fotometrik PRE / EVENT / POST ve Visibility Response ölçümleri hâlen fixed-ROI koordinatlarıyla örneklenir. Tracking burada provenance ve kalite gate'i sağlayabilir, fakat bu sonuçlar dinamik stabilize fotometri olarak tarif edilmemelidir. Gerçek per-frame stabilize fotometrik sampling ayrı bir geliştirme konusudur.

Bu katman “gerçek/sahte” veya mekanizma kararı vermez. Sonuç dili hedef ile kontrol/arka planın birlikte değişmesi, target'a lokalize ek değişim, sahne-geneli değişim, ROI tracking kalitesi, reference convergence veya belirsizlik gibi ölçüm sınıflarıyla sınırlıdır.

Ayrıntılı kontratlar:

- [rooms/laboratory/VISUAL-RESPONSE-STRESS-PROBES.md](rooms/laboratory/VISUAL-RESPONSE-STRESS-PROBES.md)
- [rooms/laboratory/STRUCTURAL-TRANSITION.md](rooms/laboratory/STRUCTURAL-TRANSITION.md)
- [rooms/laboratory/ROI-TRACKING-STABILIZATION-V2.md](rooms/laboratory/ROI-TRACKING-STABILIZATION-V2.md)

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
- tracking/provenance bilgisini,
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
- tracking kalite/provenance bilgisini,
- AI'nin yeniden değerlendirebileceği teknik bağlamı

taşıyabilir.

Görsel stress-test sonuç kartlarında desteklenen akışlar structured Markdown kopyalama / dışa aktarma sağlayabilir. Structural Transition export'u ROI'leri, fotometrik fazları, structural timeline'ı, Target-Control diferansiyelini, Background Reference durumunu ve ROI tracking/stability bilgisini aynı AI-handoff metninde koruyabilir.

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
- tracking/stabilization kaynak medyayı değiştirmez,
- araç/model hazırlığı görünür tutulur,
- sonuç kaynak ve proje bağlamından koparılmaz,
- UI, runtime ve host ownership sınırları korunur,
- düşük tracking kalitesi güçlü sonuca dönüştürülmez,
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

Güncel agresif bakım/canonicalization hedefi: [rooms/laboratory/ARCHITECTURE-RESET.md](rooms/laboratory/ARCHITECTURE-RESET.md).

## ✅ Doğrulama

```bash
node rooms/laboratory/scripts/laboratory-check.mjs
npm run check:all
```

Yeni structural / tracking / diferansiyel regression'ları doğrudan çalıştırmak için:

```bash
npm run rooms:test:file -- scripts/tests/laboratory-camera-tracking-v2-regressions.test.ts
npm run rooms:test:file -- scripts/tests/laboratory-structural-transition-regressions.test.ts
npm run rooms:test:file -- scripts/tests/laboratory-visual-stress-dual-roi-regressions.test.ts
npm run rooms:test:file -- scripts/tests/laboratory-visual-response-regressions.test.ts
```
