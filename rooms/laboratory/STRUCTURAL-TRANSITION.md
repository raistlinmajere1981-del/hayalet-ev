# Structural Transition + ROI Stabilization

Bu belge Laboratory `Appearance / Disappearance Transition` akışına eklenen yapısal ölçüm katmanını açıklar.

Amaç bir videonun gerçekliği veya mekanizması hakkında hüküm vermek değildir. Ölçüm soruları şunlardır:

> PRE fazında bulunan görüntü yapısı EVENT ve POST sırasında ne kadar korunuyor ve bu kayıp Target'a mı, Control'e mi, yoksa sahne geneline mi yayılıyor?

> Target PRE yapısını kaybederken aynı görüntü bölgesi kullanıcı tarafından tanımlanmış temiz arka plan referansına yapısal olarak yaklaşıyor mu; yakınlaşma zamana nasıl yayılıyor?

## Kanonik Transition sonucu

Source/ROI doğrulaması ve tracking cache hazırlığından sonra fotometrik Transition Probe şu pencereleri ölçer:

- PRE: event -1.0 → -0.2 s
- EVENT: event -0.2 → +0.2 s
- POST: event +0.2 → +1.0 s

Target / Background visibility, luma, chroma, near-black, recovered-dark, edge ve temporal metrikleri aynı kayıt içinde korunur.

Fotometrik ve Structural ölçümler tek kanonik Transition sonucunda birleştirilip history'ye bir kez yazılır. Structural aşama çalışamazsa aynı sonuçta açık `unavailable` durumu ve hata bilgisi bulunur; ölçülmüş fotometrik alanlar korunur.

## Üç spatial ROI

Visual Stress yüzeyi video için üç seçim rolü destekler:

- **Target ROI** — incelenen hedef.
- **Control ROI** — opsiyonel, hedef dışında mümkün olduğunca benzer başlangıç görüntü özelliklerine sahip sabit sahne alanı.
- **Background ROI** — yakın fiziksel arka plan / diferansiyel ve motion referansı.

Store eşlemesi:

- Target = active selection ROI
- Control = `comparisonRois.primary`
- Background = `comparisonRois.reference`

Control zorunlu değildir. Control yoksa structural scene baseline Background üzerinden kurulabilir; Target-Control alanları `null` / `—` kalır.

## Control comparability

PRE fazında Target ve Control arasında yalnız ölçüm kalitesini anlatan bir karşılaştırılabilirlik skoru üretilir.

İlk sürüm:

- mean luma
- luma spread
- chroma distance
- edge energy
- ROI alan oranı

kullanır.

Çıktı `high / medium / low` ve 0–100% skordur. Bu değer Control ROI'nin semantik olarak doğru fiziksel yüzey olduğunu iddia etmez.

## Structural baseline

PRE penceresinin orta noktasına yakın `event -0.6 s` kare structural template olarak kullanılır.

Her spatial ROI kendi baseline'ına sahiptir:

- Target PRE template
- Control PRE template (varsa)
- Background PRE template

Kareler FFmpeg ile source medyadan non-destructive biçimde çıkarılır ve ölçüm için `64×64` grayscale normalize edilir.

## Structural metrikler

Her timeline noktasında PRE template'e göre:

- structural similarity
- normalized pixel correlation
- raw Pearson pixel correlation
- normalized mean absolute pixel difference
- edge-map similarity
- structural persistence

hesaplanır.

### Structural similarity

İlk sürüm ağır bir CV framework kullanmaz. Global grayscale mean / variance / covariance üzerinden deterministik bir **SSIM-benzeri** skor hesaplanır.

Bu değer canonical windowed SSIM değildir; UI ve Markdown raporunda `SSIM-like` olarak etiketlenir.

### Pixel correlation

Grayscale pikseller üzerinde Pearson correlation hesaplanır. Compact rapor için `[-1,+1]` correlation ayrıca `[0,1]` aralığına normalize edilir.

### Edge similarity

Yatay/dikey yerel gradient büyüklüklerinden hafif bir edge-map üretilir; baseline ve current edge-map'leri correlation ile karşılaştırılır.

### Structural persistence

Şu dört bileşenin ortalamasıdır:

- SSIM-like
- normalized pixel correlation
- edge similarity
- `1 - normalized absolute difference`

Tek bir fiziksel büyüklük değildir; görüntü yapısının template'e benzerliğini kompakt göstermek için kullanılan birleşik ölçüm skorudur.

## Event timeline

Structural analiz event çevresinde şu offsetleri örnekler:

```text
-1.0
-0.8
-0.6
-0.4
-0.2
 0.0
+0.2
+0.4
+0.6
+0.8
+1.0 s
```

Kaynak başlangıcı/sonu güvenli biçimde clamp edilir; aynı gerçek zamana clamp edilen tekrar noktaları çıkarılır.

Her noktada:

- Target similarity / correlation / edge similarity / persistence
- Control persistence (varsa)
- Background persistence
- Target-Control structural-loss differential
- Target-Background structural-loss differential
- Background Reference seçilmişse aynı Target ROI'nin reference convergence değeri

saklanır.

PRE / EVENT / POST structural özetleri timeline'dan yaklaşık `-0.6 / 0.0 / +0.6 s` noktalarını kullanır. Fotometrik PRE/EVENT/POST pencere ortalamaları ayrı alanlarda korunur.

## Differential structural loss

Bir ROI için:

```text
structural loss = 1 - structural persistence
```

olarak okunur.

Structural sonuçta:

- Target structural loss
- Control structural loss
- Background structural loss
- scene structural loss
- Target-specific structural loss

saklanır.

Control varsa scene loss, Control ve Background loss ortalamasıdır. Control yoksa Background loss kullanılır.

```text
Target-specific structural loss
≈ Target loss - scene loss
```

Bu bir fiziksel düzeltme veya nedensellik hesabı değildir; yalnız diferansiyel görüntü ölçümüdür.

## Temkinli structural assessment

Kullanılabilecek sınıflar:

- `target-and-control-structurally-similar`
- `structural-change-target-localized`
- `structural-change-scene-wide-with-target-excess`
- `structural-change-scene-wide`
- `roi-drift-may-affect-result`
- `structural-result-uncertain`

Bu sınıflar mekanizma veya gerçeklik hükmü değildir.

## ROI tracking diagnostic

Structural Transition event çevresindeki global kamera hareketini çoklu özellik, consensus ve outlier rejection kullanan similarity transform ile tahmin eder. Target ve Control kamera özelliği seçiminden dışlanır; Background ROI uygun olduğunda tercih edilen referans bölgedir.

Raporlanan alanlar:

- raw camera dx / dy, rotation ve scale,
- feature ve inlier sayısı/oranı,
- residual alignment error,
- forward/backward consistency,
- tracking quality,
- Target ROI minimum boyutuna göre normalized drift ratio,
- risk: negligible / low / moderate / high.

## Similarity-transform stabilization

Kanonik tracker:

- translation dx/dy uygular,
- rotation modeller,
- uniform scale modeller,
- perspective/homography modellemez.

Tracking quality gate geçtiğinde aynı baseline-relative similarity transform Target / Control / Background structural ROI'lerine uygulanır.

Confidence düşükse:

```text
ROI stabilization: off
fallback: fixed ROI
reason: tracking-confidence-low
```

Stabilizasyon şu anda **structural timeline ölçümlerine** uygulanır. Fotometrik PRE/EVENT/POST ve Visibility Response ölçümleri fixed ROI kullanır.

## Background Reference Capture

Background Reference, spatial `Background ROI` ile aynı şey değildir.

Amaç başka bir fiziksel bölgenin görüntüsünü Target ile karşılaştırmak değil, **aynı Target ROI koordinatının hedef görünmüyorken nasıl göründüğünü** template olarak tanımlamaktır.

Kullanım:

1. Event aralığını ve Target ROI'yi seç.
2. Videoda aynı kamera açısından, hedefin olmadığı ve beklenen arka planın görüldüğü bir kareye git.
3. `Arka Plan Referansını Al` düğmesine bas.
4. Gerekirse `Temizle` ile referansı kaldır.
5. `Appearance / Disappearance Transition` çalıştır.

Referans zamanı source bazında UI oturumunda tutulur ve Transition request'ine `backgroundReferenceSeconds` olarak eklenir. Tam analiz sonucunda referans zamanı request/provenance içinde kalır.

Referans seçilmezse mevcut Structural Transition davranışı değişmez ve `revealedBackground.status = not-assessed` kalır.

## Background Reference Convergence

Referans seçilmişse yeni runtime:

- kullanıcı seçili referans zamanda aynı normalized Target ROI'den `64×64` grayscale template çıkarır,
- event timeline'ın her noktasında yine aynı Target ROI bölgesini çıkarır,
- event görüntüsünü PRE template'e değil bu clean background template'e karşılaştırır.

Her noktada:

- reference structural similarity
- reference normalized pixel correlation
- reference edge similarity
- reference structural persistence

üretilir.

Compact anlamda:

```text
Reference convergence = Target bölgesinin user-captured background template'e structural persistence değeri
```

Rapor ayrıca:

- PRE convergence
- EVENT convergence
- POST convergence
- peak POST convergence
- PRE → peak convergence gain
- edge convergence gain
- peak convergence anındaki Target structural loss

alanlarını saklar.

### Convergence assessment

Temkinli sınıflar:

- `target-loss-with-reference-convergence`
- `reference-convergence-without-strong-target-loss`
- `target-loss-without-reference-convergence`
- `reference-convergence-uncertain`

Örneğin ilk sınıf yalnız şunu anlatır:

> Target bölgesi PRE template'e benzerliğini kaybederken kullanıcı tarafından tanımlanmış background template'e benzerliği artıyor.

Bu ölçüm tek başına fiziksel nesne, opacity/fade, compositing veya başka bir mekanizma arasında karar vermez.

### Transition shape

Event sonrası convergence eğrisinin zamansal biçimi betimleyici olarak:

- `gradual`
- `abrupt`
- `mixed`
- `weak-or-nonconvergent`

şeklinde sınıflanır.

Bu sınıflama yalnız eğrinin şeklini tarif eder. `abrupt = fiziksel`, `gradual = compositing` gibi bir anlam taşımaz.

### İlk sürüm sınırı

Background Reference convergence aynı normalized Target ROI koordinatını referans zamanda kullanır.

**Event ile background-reference zamanı arasındaki kamera translation/rotation/zoom ayrıca hizalanmaz.** Bu nedenle referans kare mümkün olduğunca aynı kamera açısına ve düşük harekete sahip bir bölümden seçilmelidir.

Bu sınır Markdown raporunda açıkça yazılır.

## Live Results / Export

Compact Report History tam tabloları panelde sürekli göstermez; ancak Structural Transition'ın **Kopyala / MD Dışa Aktar** çıktısı şunları taşır:

- Target / Control / Background ROI
- event zamanı
- Background Reference zamanı (varsa)
- Control comparability
- photometric PRE / EVENT / POST
- structural PRE / EVENT / POST
- structural timeline
- reference convergence timeline
- Target-Control ve Target-Background diferansiyelleri
- convergence gain / edge gain
- transition shape
- ROI stabilization / drift
- yöntem sınırları

## Kaynak / provenance

Source medya değiştirilmez.

Structural ve convergence extraction geçici grayscale raw frame dosyaları üzerinden yapılır. Proje sonucunda source path, event zamanı, ROI'ler, referans zamanı, structural timeline, convergence timeline, drift/stabilization raporu, method açıklaması ve assessment birlikte tutulur.

## Doğrulama

```bash
npm run rooms:typecheck
npm run rooms:lint:strict
npm run rooms:test:file -- scripts/tests/laboratory-structural-transition-regressions.test.ts
npm run rooms:test:file -- scripts/tests/laboratory-visual-stress-dual-roi-regressions.test.ts
node rooms/laboratory/scripts/laboratory-check.mjs
```
