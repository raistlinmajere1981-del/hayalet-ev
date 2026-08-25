# Structural Transition + ROI Stabilization

Bu belge Laboratory `Appearance / Disappearance Transition` akışına eklenen yapısal ölçüm katmanını açıklar.

Amaç bir videonun gerçekliği veya mekanizması hakkında hüküm vermek değildir. Ölçüm sorusu şudur:

> PRE fazında bulunan görüntü yapısı EVENT ve POST sırasında ne kadar korunuyor ve bu kayıp Target'a mı, Control'e mi, yoksa sahne geneline mi yayılıyor?

## Mevcut Transition davranışı korunur

Mevcut fotometrik Transition Probe değişmeden önce çalışır:

- PRE: event -1.0 → -0.2 s
- EVENT: event -0.2 → +0.2 s
- POST: event +0.2 → +1.0 s

Target / Background visibility, luma, chroma, near-black, recovered-dark, edge ve temporal metrikleri aynı kayıt içinde korunur.

Yeni structural analiz bu sonuca **enrichment** olarak eklenir. Structural aşama herhangi bir nedenle çalışamazsa eski fotometrik Transition sonucu yine geçerlidir ve kaybolmaz.

## Üç ROI

Visual Stress yüzeyi video için üç seçim rolü destekler:

- **Target ROI** — incelenen hedef.
- **Control ROI** — opsiyonel, hedef dışında mümkün olduğunca benzer başlangıç görüntü özelliklerine sahip sabit sahne alanı.
- **Background ROI** — yakın fiziksel arka plan / diferansiyel referans.

Store şeması büyütülmeden mevcut workspace alanları yeniden kullanılır:

- Target = active selection ROI
- Control = `comparisonRois.primary`
- Background = `comparisonRois.reference`

Bu anlam yalnız video Visual Stress modu aktifken kullanılır; mevcut image-comparison davranışı değiştirilmez.

Control ROI zorunlu değildir. Control yoksa structural scene baseline Background üzerinden kurulabilir; Target-Control alanları `null` / `—` kalır.

## Control comparability

PRE fazında Target ve Control arasında yalnız ölçüm kalitesini anlatan bir karşılaştırılabilirlik skoru üretilir.

İlk sürüm şu aileleri kullanır:

- mean luma
- luma spread / dağılım genişliği
- chroma distance
- edge energy
- ROI alan oranı

Çıktı:

- high
- medium
- low

ve 0–100% skorudur.

Bu değer Control ROI'nin semantik olarak doğru fiziksel nesne olduğunu iddia etmez; yalnız görüntü özellikleri bakımından karşılaştırmanın ne kadar uygun olduğunu tarif eder.

## Structural baseline

PRE penceresinin orta noktasına yakın `event -0.6 s` kare structural template olarak kullanılır.

Her ROI kendi baseline'ına sahiptir:

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

Bu değer canonical windowed SSIM değildir; UI ve Markdown raporunda açıkça `SSIM-like` olarak etiketlenir.

### Pixel correlation

Grayscale pikseller üzerinde Pearson correlation hesaplanır. Compact rapor için `[-1,+1]` correlation ayrıca `[0,1]` aralığına normalize edilir.

### Edge similarity

Yatay/dikey yerel gradient büyüklüklerinden hafif bir edge-map üretilir; baseline ve current edge-map'leri correlation ile karşılaştırılır.

### Structural persistence

İlk sürümde şu dört bileşenin ortalamasıdır:

- SSIM-like
- normalized pixel correlation
- edge similarity
- `1 - normalized absolute difference`

Tek bir fiziksel büyüklük değildir; yapının PRE template'e ne kadar benzediğini kompakt göstermek için kullanılan birleşik ölçüm skorudur.

## Event timeline

Structural analiz event çevresinde şu varsayılan offsetleri örnekler:

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

Her noktada en az:

- Target structural similarity / correlation / edge similarity / persistence
- Control persistence (varsa)
- Background persistence
- Target-Control structural-loss differential
- Target-Background structural-loss differential

saklanır.

PRE / EVENT / POST structural özetleri timeline'dan sırasıyla yaklaşık `-0.6 / 0.0 / +0.6 s` noktalarını kullanır. Eski fotometrik PRE/EVENT/POST pencere ortalamaları ayrı olarak korunur.

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

Control varsa ilk sürüm scene loss, Control ve Background loss ortalamasıdır. Control yoksa Background loss kullanılır.

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

Özellikle şu tür çıkarımlar yapılmaz:

```text
structural change = paranormal
structural persistence loss = gerçek nesnenin kaybolması
```

## ROI drift diagnostic

Structural Transition event çevresinde reference ROI'nin translation hareketini mevcut Motion Probe block-match algoritmasını yeniden kullanarak tahmin eder.

Raporlanan alanlar:

- net dx
- net dy
- peak displacement
- pair count
- tracking confidence
- Target ROI minimum boyutuna göre normalized drift ratio
- risk: negligible / low / moderate / high

Drift riski Target ROI ölçeğine göre normalize edilir; aynı piksel hareketi küçük ROI'de daha yüksek risk üretir.

## Translation-only stabilization

İlk sürüm:

- translation dx/dy uygular,
- rotation modellemez,
- zoom modellemez,
- perspective modellemez.

Reference seçimi:

1. aynı source için mevcut Motion Reference lock varsa onu kullan,
2. yoksa Background ROI'yi translation reference olarak kullan.

Tracking confidence yeterliyse baseline-relative dx/dy, Target / Control / Background structural ROI'lerine aynı global camera translation olarak uygulanır.

Confidence düşükse sessizce düzeltme yapılmaz:

```text
ROI stabilization: off
fallback: fixed ROI
reason: tracking-confidence-low
```

### Önemli ilk-sürüm sınırı

Stabilizasyon şu anda **structural timeline ölçümlerine** uygulanır.

Mevcut legacy fotometrik PRE/EVENT/POST ölçümleri geriye dönük davranışı korumak için fixed ROI olarak bırakılmıştır. Böylece eski Transition sonuçları değişmez; structural kart hangi katmanın stabilize edildiğini raporda açıklar.

Visibility Response sweep de bu turda yeniden örneklenerek stabilize edilmez. Structural Transition'ın drift diagnostic/stabilization altyapısı ileride Response sweep'e aynı provenance ile genişletilebilir.

## Revealed background / convergence

İlk sürüm doğrudan `POST → beklenen fiziksel background` yakınlaşması hakkında semantik bir skor üretmez.

Ancak structural sonuç şemasında şu alan ayrılmıştır:

```text
revealedBackground.status = not-assessed
revealedBackground.futureField = post-to-reference-convergence
```

Böylece daha sonra açıkça tanımlanmış bir reference/background template ile convergence eklenebilir; mevcut kayıt şeması yeniden kırılmaz.

## Live Results / Export

Structural Transition kartı mevcut fotometrik Transition kartının yanında görünür.

Kartta:

- Target / Control / Background ROI
- Control comparability
- photometric PRE / EVENT / POST
- structural PRE / EVENT / POST
- structural timeline
- Target-Control ve Target-Background diferansiyelleri
- ROI stabilization mode
- tracking confidence
- dx / dy / peak displacement
- drift risk
- kısa structural assessment

bulunur.

Kartın kendi **Kopyala** ve **MD Dışa Aktar** düğmesi vardır. Markdown export ölçüm tablosunu ve yöntem sınırlarını korur; raporun analiz sohbetine doğrudan aktarılabilmesi amaçlanır.

## Kaynak / provenance

Source medya değiştirilmez.

Structural extraction geçici grayscale raw frame dosyaları üzerinden yapılır. Son proje kaydında source path, event zamanı, ROI'ler, structural timeline, drift/stabilization raporu, method açıklaması ve assessment birlikte tutulur.

## Doğrulama

```bash
npm run rooms:test:file -- scripts/tests/laboratory-structural-transition-regressions.test.ts
npm run rooms:test:file -- scripts/tests/laboratory-visual-stress-dual-roi-regressions.test.ts
node rooms/laboratory/scripts/laboratory-check.mjs
```
