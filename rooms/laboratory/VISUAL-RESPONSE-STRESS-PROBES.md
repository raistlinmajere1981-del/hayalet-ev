# Visual Response Stress Probes

Bu belge Laboratory'deki diferansiyel görsel stress-testlerin çalışma kontratını açıklar.

Amaç bir görüntü için “gerçek” veya “sahte” kararı vermek değildir. Amaç aynı sahne parçasının kontrollü dönüşümlere verdiği cevabı ölçmek ve farklı açıklamaların beklenen davranışlarını birbirinden ayırmaya yardımcı olacak veri üretmektir.

## Açık tutulan modeller

Laboratory bu araçlarda üç açıklama ailesini açık tutar:

- **H0 — normal sahne + kamera/sensör/codec davranışı**
- **H1 — kasıtlı veya sonradan oluşturulmuş görüntü**
- **H2 — optik/sensör zincirinin normal görüşte erişilemeyen gerçek bir çevresel sinyali görünür hale getirmesi**

Bir test sonucunun “farklı response” göstermesi H2 anlamına gelmez. Aynı şekilde sensör davranışıyla uyumlu görünmesi de tek başına H0'ı kanıtlamaz. Çıktılar yalnızca ölçülen davranış sınıfını tarif eder.

## ROI kontratı

Visual Stress video akışında üç seçim rolü bulunabilir:

- **Target ROI** — incelenen hedef yapı.
- **Control ROI** — opsiyonel, hedef dışında benzer başlangıç görüntü özelliklerine sahip sabit sahne alanı.
- **Background ROI** — hedefin hemen yanında veya aynı sahne içinde fiziksel arka plan / diferansiyel referans.

Visibility Response ve codec karşılaştırmaları Target + Background ile çalışmaya devam eder. Appearance / Disappearance Transition ise Control seçiliyse üçüncü ROI'yi de ölçer.

Visual Stress Probes panelindeki roller:

- `Target ROI`
- `Control ROI`
- `Background ROI`

Önerilen transition akışı:

1. timeline aralığını seç,
2. **Target ROI** ile hedef alanını çiz,
3. mümkünse **Control ROI** ile hedef dışındaki benzer koyuluk / doku seviyesine sahip sabit sahne alanını çiz,
4. **Background ROI** ile yakın fiziksel arka planı çiz,
5. üç overlay'in aynı gerçek media frame üzerinde kaldığını kontrol et,
6. Appearance / Disappearance Transition Probe'u çalıştır.

Target mevcut Laboratory seçim ROI'sidir. Control ve Background ayrı workspace comparison ROI slotlarında tutulur; biri yeniden çizildiğinde diğerleri Target'ın üzerine yazılmaz.

Control ROI zorunlu değildir ve semantic doğruluk iddiası taşımaz. PRE fazı sonrasında üretilen comparability değeri yalnız measurement-quality göstergesidir.

Motion Reference ROI diferansiyel testler için zorunlu değildir. Structural Transition stabilization sırasında aynı source için güncel Motion Reference lock varsa translation reference olarak tercih edilir; yoksa Background ROI kullanılabilir. Motion Probe kendi reference-lock davranışını korur.

Kaynak değiştirildiğinde workspace ROI durumu kaynakla birlikte sıfırlanır; böylece önceki videodan kalan ROI yeni kaynağa sessizce taşınmaz.

## ROI geometrisi ve responsive layout

ROI koordinatları kaynak görüntüye göre normalize edilmiş `0..1` uzayında tutulur. Preview alanının piksel boyutu bu koordinatların anlamını değiştirmez.

Laboratory tek-media preview'da ROI overlay'ini panel kutusuna değil, `object-fit: contain` sonrasında gerçekten çizilen video / image alanına bağlar. Media geometry binder:

- gerçek media aspect ratio'sunu okur,
- letterbox / pillarbox alanlarını hesaba katar,
- ROI çizim frame'ini gerçek media rect'ine yerleştirir,
- Target / Control / Background overlay'lerini aynı frame'e bağlar,
- `ResizeObserver` ile layout değişimini izler,
- preview zoom / transform ölçeğini local koordinata geri çevirir.

Bu nedenle Live Results açılması, drawer değişimi, pencere resize/maximize veya benzeri bir panel düzeni değişikliği için ayrı ROI yamaları gerekmez.

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

## ROI comparability gate

“Target ve Background farklı eğri verdi” cümlesi tek başına güçlü bir sonuç değildir. İki ROI başlangıçta birbirine yeterince benzemiyorsa response farkının nedeni yalnız ROI seçimi olabilir.

Rapor assessment'i sweep ekseninin nötr noktasında şu sinyalleri birlikte kullanır:

- Target / Background ROI alan oranı,
- mean luma farkı,
- luma spread farkı,
- edge-energy farkı,
- temporal-persistence farkı,
- chroma farkı,
- Background ROI içi luma heterojenliği.

Sonuç `high`, `moderate` veya `low` comparability olarak saklanır.

Özellikle ROI alan oranı `0.25` altındaysa karşılaştırma düşük güvene zorlanır. Bu eşik fiziksel bir yasa değildir; aşırı farklı ROI ölçeklerinin güçlü yorum üretmesini önleyen konservatif bir guardrail'dir.

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

`target-response-differs` sınıfı için ROI comparability düşük olmamalı, visibility separation yeterince güçlü olmalı ve en az iki destekleyici metrik ailesi eşlik etmelidir.

Bu sınıf da yalnız ölçülen response ayrışmasını tarif eder; nedenini belirlemez.

## Recovered dark

Near-black tek başına “bilgi yok” anlamına gelmez.

Response Probe source ölçümüne ek olarak luma'yı 8x yükselten, sıfırı koruyan bir kontrol geçişi çalıştırır.

- source near-black
- 8x lift sonrası persistent near-black
- ikisinin farkı olan recovered dark

ayrı tutulur.

## Appearance / Disappearance Transition Probe

Kullanıcının timeline seçiminin orta noktası olay zamanı olarak kabul edilir.

Varsayılan legacy fotometrik pencereler:

```text
PRE   = event -1.0 s → event -0.2 s
EVENT = event -0.2 s → event +0.2 s
POST  = event +0.2 s → event +1.0 s
```

Target ve Background mevcut fotometrik metriklerle paralel ölçülür. Control seçiliyse aynı PRE / EVENT / POST pencerelerinde Control fotometrisi de eklenir ve Target-Control diferansiyeli ayrıca tutulur.

Structural Transition bu legacy sonucu değiştirmez; aynı Transition kaydını yapısal timeline, diferansiyel structural loss ve ROI stability alanlarıyla zenginleştirir.

Structural katmanın ayrıntılı kontratı:

[STRUCTURAL-TRANSITION.md](./STRUCTURAL-TRANSITION.md)

## Response curve comparison

Live Results son birden fazla Visibility Response kaydını birlikte tutar.

Bu sayede aynı eksende farklı ROI veya sahneler çalıştırılarak örneğin hedef, insan, ağaç/kaya veya karanlık arka plan response curve'leri karşılaştırılabilir.

Karşılaştırmanın anlamlı olması için mümkün olduğunca aynı sweep ekseni, benzer zaman penceresi ve benzer ROI ölçeği kullanılmalıdır.

## Sensor / Codec stress

Paired degradation kontrollerine şunlar dahildir:

- denoise
- gamma stress
- black crush
- highlight clipping
- chroma suppression
- noise / blur / sharpen / low-light
- paired recompression

Codec ladder:

```text
CRF 18 → 24 → 30 → 36 → 42
```

aynı Target ROI üzerinde çalıştırılır. Background seçiliyse aynı ladder Background üzerinde de çalışır ve diferansiyel degradation sonucu üretilir.

## İnsan-dili yorum sınırı

UI şu tür ifadeler kullanabilir:

- target ve background birlikte değişiyor,
- Background ROI diferansiyel yorum için yeterince karşılaştırılabilir değil,
- visibility eğrileri ayrışıyor fakat destekleyici metrikler zayıf,
- target/background eğrileri birden fazla metrikte ayrışıyor; neden açık bırakılıyor,
- target ve control benzer yapısal değişim gösteriyor,
- değişimin bir bölümü sahne geneline yayılıyor; target'ta ek yapısal değişim ölçülüyor,
- structural değişim target'a ağırlıklı lokalize,
- kamera / ROI drift'i sonucu etkileyebilecek düzeyde,
- davranış düşük ışık / sensör açıklamasıyla uyumlu,
- codec degradation hedefi çevreden daha hızlı bozuyor,
- örnek yetersiz,
- sonuç belirsiz.

Bu ifadeler mekanizma kanıtı değildir.

Özellikle şu çıkarımlar yapılmaz:

```text
farklı response = paranormal
structural loss = gerçek nesnenin kaybolması
```

## Sonuç yüzeyi ve Nexa'ya aktarım

Live Results mevcut Response / Transition / Codec kartlarının yanında Structural Transition kartını da gösterebilir.

Structural kartta:

- Target / Control / Background ROI koordinatları,
- Control comparability,
- fotometrik PRE / EVENT / POST,
- structural PRE / EVENT / POST,
- event çevresi structural timeline,
- Target-Control / Target-Background structural loss,
- ROI stabilization mode,
- tracking confidence,
- net dx/dy ve peak displacement,
- drift risk,
- temkinli assessment

bulunur.

Visual Response / Transition / Codec ve Structural Transition rapor kartlarında desteklenen akışlar **Kopyala / Copy** ve **MD Dışa Aktar / Export MD** kullanır.

Kopyalama DOM'daki görsel tabloyu düz metne çevirmek yerine yapılandırılmış Markdown üretir. Structural export yöntem sınırlarını da taşır; örneğin SSIM-benzeri skorun canonical windowed SSIM olmadığı ve stabilization'ın translation-only olduğu raporda kaybolmaz.

Source / Transform / Difference preview mevcut transform preview yüzeyinde korunur.

Ayrı crop thumbnail artifact hâlâ üretilmez; ROI konumu ve ölçüm eğrileri sonuç kaydında tutulur.

## Performans notu

Response Probe her sweep basamağında her ROI için üç ölçüm geçişi kullanır:

1. source signal/luma/chroma/near-black,
2. edge pass,
3. 8x lifted-dark pass.

Structural Transition ek olarak event çevresinde küçük grayscale frame'ler çıkarır ve reference drift analizi çalıştırır. İşler sequential tutulur; kaynak medya değiştirilmez.

## Kaynak dosya ve provenance

Probe'lar source medyayı değiştirmez.

Sonuç kayıtları proje `temporalStressTests` geçmişine eklenir ve kullandıkları source path, zaman aralığı, ROI'ler, sweep/transition metrikleri, comparability, structural timeline, stability bilgisi ve yorum sınıflarıyla birlikte tutulur.

## Doğrulama

```bash
npm run rooms:test:file -- scripts/tests/laboratory-structural-transition-regressions.test.ts
npm run rooms:test:file -- scripts/tests/laboratory-visual-stress-dual-roi-regressions.test.ts
npm run rooms:test:file -- scripts/tests/laboratory-visual-response-regressions.test.ts
npm run rooms:test:file -- scripts/tests/laboratory-visual-report-geometry-regressions.test.ts
node rooms/laboratory/scripts/laboratory-check.mjs
```
