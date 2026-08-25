# Visual Response Stress Probes

Bu belge Laboratory'deki target/background diferansiyel görsel stres testlerinin çalışma kontratını açıklar.

Amaç bir görüntü için “gerçek” veya “sahte” kararı vermek değildir. Amaç aynı sahne parçasının kontrollü dönüşümlere verdiği cevabı ölçmek ve farklı açıklamaların beklenen davranışlarını birbirinden ayırmaya yardımcı olacak veri üretmektir.

## Açık tutulan modeller

Laboratory bu araçlarda üç açıklama ailesini açık tutar:

- **H0 — normal sahne + kamera/sensör/codec davranışı**
- **H1 — kasıtlı veya sonradan oluşturulmuş görüntü**
- **H2 — optik/sensör zincirinin normal görüşte erişilemeyen gerçek bir çevresel sinyali görünür hale getirmesi**

Bir test sonucunun “farklı response” göstermesi H2 anlamına gelmez. Aynı şekilde sensör davranışıyla uyumlu görünmesi de tek başına H0'ı kanıtlamaz. Çıktılar yalnızca ölçülen davranış sınıfını tarif eder.

## ROI kontratı

Diferansiyel testler iki bağımsız ROI kullanır:

- **Target ROI** — iddia edilen hedef yapı.
- **Background ROI** — hedefin hemen yanında, mümkün olduğunca benzer fiziksel arka plan.

Visual Stress Probes panelinde iki ayrı seçim rolü vardır:

- `Target ROI`
- `Background ROI`

Önerilen akış:

1. timeline aralığını seç,
2. **Target ROI** rolünü seçip hedef alanını çiz veya yeniden boyutlandır,
3. **Background ROI** rolünü seçip yakın arka plan alanını çiz veya yeniden boyutlandır,
4. iki ROI'nin ekranda aynı anda görünür olduğunu kontrol et,
5. response, transition veya codec ladder testini çalıştır.

Target ROI mevcut Laboratory seçim ROI'sidir ve temporal request içine taşınır. Background ROI ayrı workspace ROI slotunda tutulur; Target yeniden çizildiğinde Background kaybolmaz veya Target'ın üzerine yazılmaz.

Görsel ayrım için Target ve Background farklı çerçeve stilleri kullanır. Aktif seçim rolü panelde ayrıca belirtilir.

Motion Reference ROI artık diferansiyel testler için zorunlu değildir. Eski proje kayıtlarıyla uyumluluğu korumak amacıyla host tarafında yalnızca explicit Background ROI bulunmadığında legacy fallback olarak kabul edilir. Motion Probe kendi reference-lock davranışını kullanmaya devam eder.

Kaynak değiştirildiğinde workspace ROI durumu kaynakla birlikte sıfırlanır; böylece önceki videodan kalan Background ROI yeni kaynağa sessizce taşınmaz.

## ROI geometrisi ve responsive layout

ROI koordinatları kaynak görüntüye göre normalize edilmiş `0..1` uzayında tutulur. Preview alanının piksel boyutu bu koordinatların anlamını değiştirmez.

Laboratory tek-media preview'da ROI overlay'ini panel kutusuna değil, `object-fit: contain` sonrasında gerçekten çizilen video / image alanına bağlar. Media geometry binder:

- gerçek media aspect ratio'sunu okur,
- letterbox / pillarbox alanlarını hesaba katar,
- ROI çizim frame'ini gerçek media rect'ine yerleştirir,
- Target ve Background overlay'lerini aynı frame'e bağlar,
- `ResizeObserver` ile layout değişimini izler,
- preview zoom / transform ölçeğini local koordinata geri çevirir.

Bu nedenle Live Results açılması, drawer değişimi, pencere resize/maximize veya benzeri bir panel düzeni değişikliği için ayrı ROI yamaları gerekmez. Aynı geometry authority bütün layout değişikliklerini kapsar.

## Visibility / Contrast Response Probe

Her koşu tek bir ekseni tarar. Böylece eksenler birbirine karışmaz ve sonuç bir response curve olarak okunabilir.

Desteklenen sweep eksenleri:

- exposure: `-3, -2, -1, 0, +1, +2, +3`
- gamma
- brightness
- black level
- contrast
- local contrast
- blur
- denoise
- sharpen

Her sweep basamağında Target ve Background aynı transform değeriyle ayrı ölçülür.

Temel metrikler:

- mean / median luma
- low / high / min / max luma dağılımı
- luma spread / contrast benzeri değer
- chroma distance
- near-black fraction
- persistent near-black fraction
- recovered dark fraction
- edge energy
- edge persistence
- frame-difference energy
- temporal persistence
- signal/noise-benzeri oran
- visibility score

Her metrik için ayrıca:

```text
Target - Background
```

farkı saklanır.

Bu sayede tüm kameranın exposure değişimi ile hedefe lokalize response birbirinden ayrılmaya çalışılır.

## ROI comparability gate

“Target ve Background farklı eğri verdi” cümlesi tek başına güçlü bir sonuç değildir. İki ROI başlangıçta birbirine yeterince benzemiyorsa response farkının nedeni yalnız ROI seçimi olabilir.

Bu nedenle rapor assessment'i sweep ekseninin nötr noktasında şu karşılaştırılabilirlik sinyallerini birlikte kullanır:

- Target / Background ROI alan oranı,
- mean luma farkı,
- luma spread farkı,
- edge-energy farkı,
- temporal-persistence farkı,
- chroma farkı,
- Background ROI içi luma heterojenliği.

Sonuç `high`, `moderate` veya `low` comparability olarak saklanır.

Özellikle ROI alan oranı `0.25` altındaysa karşılaştırma düşük güvene zorlanır. Bu eşik fiziksel bir yasa değildir; ilk sürümde aşırı farklı ROI ölçeklerinin güçlü yorum üretmesini önleyen konservatif bir guardrail'dir.

Comparability düşükse sınıflandırma:

```text
background-not-comparable
```

olur ve visibility eğrisi güçlü ayrılsa bile `target-response-differs` verilmez.

## Corroboration gate

Visibility score birleşik ve heuristic bir metriktir; tek başına mekanizma yorumu üretmez.

Visibility ayrışmasının yanında dört bağımsız destek ailesi izlenir:

- edge-energy response range,
- recovered-dark response range,
- temporal-persistence response range,
- chroma response range.

Karşılaştırılabilir ROI'lerde güçlü visibility ayrışması var fakat bu ailelerden en fazla biri destek veriyorsa sonuç:

```text
visibility-only-separation
```

olarak tutulur.

`target-response-differs` sınıfı için:

- ROI comparability düşük olmamalı,
- visibility separation yeterince güçlü olmalı,
- en az iki destekleyici metrik ailesi eşlik etmelidir.

Bu sınıf da yalnız ölçülen response ayrışmasını tarif eder; nedenini belirlemez.

## Recovered dark

Near-black tek başına “bilgi yok” anlamına gelmez.

Bu nedenle Response Probe source ölçümüne ek olarak luma'yı 8x yükselten, sıfırı koruyan bir kontrol geçişi çalıştırır.

- source near-black
- 8x lift sonrası persistent near-black
- ikisinin farkı olan recovered dark

ayrı tutulur.

Bu metrik Photometric Attenuation Probe ile aynı kavramsal dili kullanır.

## Appearance / Disappearance Transition Probe

Kullanıcının timeline seçiminin orta noktası olay zamanı olarak kabul edilir.

Varsayılan pencereler:

```text
PRE   = event -1.0 s → event -0.2 s
EVENT = event -0.2 s → event +0.2 s
POST  = event +0.2 s → event +1.0 s
```

Kaynak başı/sonunda pencereler güvenli biçimde kırpılır.

Her fazda Target ve Background paralel ölçülür.

Özellikle izlenen değişimler:

- visibility delta
- luma / contrast
- chroma
- near-black / recovered dark
- frame-difference energy
- edge energy
- edge persistence
- temporal persistence

Sonuç örneğin “target ve background birlikte değişiyor”, “değişim target'a lokalize görünüyor” veya “sonuç belirsiz” şeklinde sınıflandırılabilir.

## Response curve comparison

Live Results son birden fazla Visibility Response kaydını birlikte tutar.

Bu sayede aynı eksende farklı ROI veya sahneler çalıştırılarak örneğin:

- iddia edilen hedef,
- insan,
- ağaç/kaya,
- karanlık arka plan

response curve'leri karşılaştırılabilir.

Karşılaştırmanın anlamlı olması için mümkün olduğunca aynı sweep ekseni, benzer zaman penceresi ve benzer ROI ölçeği kullanılmalıdır.

## Sensor / Codec stress

Paired degradation kontrollerine şunlar eklenmiştir:

- denoise
- gamma stress
- black crush
- highlight clipping
- chroma suppression
- mevcut noise / blur / sharpen / low-light
- paired recompression

Ayrıca codec ladder:

```text
CRF 18 → 24 → 30 → 36 → 42
```

aynı Target ROI üzerinde çalıştırılır. Background ROI seçiliyse aynı ladder Background üzerinde de çalışır ve diferansiyel degradation sonucu üretilir.

## İnsan-dili yorum sınırı

UI şu tür ifadeler kullanabilir:

- target ve background birlikte değişiyor,
- Background ROI diferansiyel yorum için yeterince karşılaştırılabilir değil,
- visibility eğrileri ayrışıyor fakat destekleyici metrikler zayıf,
- target/background eğrileri birden fazla metrikte ayrışıyor; neden açık bırakılıyor,
- değişim target'a lokalize görünüyor,
- davranış düşük ışık / sensör açıklamasıyla uyumlu,
- global sensör cevabı ölçülen çoklu-metrik ayrışmayı tek başına açıklamakta yetersiz,
- codec degradation hedefi çevreden daha hızlı bozuyor,
- hedef fiziksel çevre yapılarıyla benzer response gösteriyor,
- örnek yetersiz,
- sonuç belirsiz.

Bu ifadeler mekanizma kanıtı değildir.

Özellikle şu çıkarım yapılmaz:

```text
farklı response = paranormal
```

veya bunun herhangi bir eşdeğeri.

## Sonuç yüzeyi ve Nexa'ya aktarım

Live Results mümkün olduğunca aynı kayıt üzerinden şunları görünür tutar:

- Target curve
- Background curve
- diferansiyel curve
- Target / Background ROI koordinatları
- ROI comparability ve destekleyen metrik sayısı
- response tablosu
- transition PRE / EVENT / POST tablosu
- codec ladder tablosu
- insan-dili yorum

Her Visual Response / Transition / Codec rapor kartında:

- **Kopyala / Copy**
- **MD Dışa Aktar / Export MD**

aksiyonları bulunur.

Kopyalama DOM'daki görsel tabloyu düz metne çevirmek yerine doğrudan yapılandırılmış Markdown üretir. Export aynı metni UTF-8 `.md` dosyası olarak verir. Bu format özellikle raporu bir AI sohbetine taşımak için tasarlanmıştır ve şunları içerir:

- rapor türü ve sweep ekseni,
- source / oluşturma zamanı,
- Target ve Background ROI,
- zaman seçimi,
- konservatif assessment,
- comparability bilgisi,
- sensör uyumluluk notu varsa bu not,
- düzgün Markdown ölçüm tablosu.

Source / Transform / Difference preview mevcut transform preview yüzeyinde korunur.

Bu sürüm Target ve Background ROI'yi çalışma alanında ayrı ve eşzamanlı overlay olarak gösterir. Ayrı crop thumbnail artifact hâlâ üretilmez; ROI konumu ve ölçüm eğrileri sonuç kaydında tutulur. Görsel crop artifact'leri gerekirse sonraki turda aynı provenance zincirine eklenebilir.

## Performans notu

Response Probe her sweep basamağında her ROI için üç ölçüm geçişi kullanır:

1. source signal/luma/chroma/near-black,
2. edge pass,
3. 8x lifted-dark pass.

Bu nedenle sıradan tek filtre preview'ından daha ağırdır. Sweep'ler bilinçli olarak tek eksen ve kısa temporal selection üzerinde çalışır.

## Kaynak dosya ve provenance

Probe'lar source medyayı değiştirmez.

Sonuç kayıtları proje `temporalStressTests` geçmişine eklenir ve kullandıkları:

- source path,
- zaman aralığı,
- Target ROI,
- Background ROI,
- sweep ekseni/değerleri,
- metrikler,
- comparability / corroboration assessment,
- yorum sınıfı

ile birlikte tutulur.

## Doğrulama

Dual ROI regression:

```bash
npm run rooms:test:file -- scripts/tests/laboratory-visual-stress-dual-roi-regressions.test.ts
```

Visual response regression:

```bash
npm run rooms:test:file -- scripts/tests/laboratory-visual-response-regressions.test.ts
```

Geometry / report / conservative assessment regression:

```bash
npm run rooms:test:file -- scripts/tests/laboratory-visual-report-geometry-regressions.test.ts
```

Tam Laboratory gate:

```bash
node rooms/laboratory/scripts/laboratory-check.mjs
```
