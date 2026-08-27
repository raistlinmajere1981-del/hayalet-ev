# Laboratory — ROI Tracking / Stabilization v2

Bu katman Target / Control / Background ROI ölçümlerinde kamera hareketinin görüntü bölgesiyle karışmasını azaltmak için eklenmiştir.

Amaç görüntü içeriğinin mekanizması hakkında hüküm vermek değildir. Kaynak medya immutable kalır; yalnız measurement coordinates dönüştürülür.

## Neden v2?

Eski tracker küçük bir reference ROI üzerinde grayscale translation block matching kullanıyordu. Karanlık, düşük dokulu veya hareketli içeriğe sahip sahnelerde confidence sık sık düşüyor ve fixed ROI fallback oluşuyordu.

v2 kamera hareketini hareket eden Target içeriğinden değil, mümkün olduğunca daha geniş sabit sahne geometrisinden tahmin eder.

## Transform modeli

İlk v2 sürümü **similarity transform** kullanır:

- dx
- dy
- rotation
- uniform scale / zoom

Perspective / homography modellenmez.

Bu bilinçli bir sınırdır. Hafif el kamerası hareketlerini düzeltirken zayıf feature setlerinde aşırı serbest bir perspektif modelinin yanlış düzeltme üretmesini önlemek amaçlanır.

## Feature consensus

Tracking frame'i kaynak görüntünün aspect ratio'su korunarak en fazla 224 px ana boyuta grayscale küçültülür.

Feature adayları yüksek yerel gradient / corner benzeri bölgelerden seçilir. Tek bir template score'a güvenilmez.

Akış:

1. geniş/global frame üzerinde feature seçimi
2. normalized patch correspondence
3. forward A→B eşleşmesi
4. backward B→A kontrolü
5. kötü forward/backward eşleşmelerinin atılması
6. similarity-transform RANSAC consensus
7. inlier set ile transform refinement
8. residual ölçümü

Global feature coverage yetersizse Background / Reference ROI çevresindeki sabit geometri tercih edilir. Bu da güvenilir değilse sistem transform uygulamak yerine fixed ROI fallback'e döner.

## Exclusion mask

Camera motion estimation sırasında:

- Target ROI hariç tutulur.
- Control ROI varsa hariç tutulur.
- Background ROI feature fallback için tercih edilen sabit alan olarak kullanılabilir.

Bunun amacı hareket eden foreground / hedef içeriğinin camera motion sanılmasını önlemektir.

## Confidence / quality

Her transform point en az şu diagnostics alanlarını taşır:

- feature count
- inlier count
- inlier ratio
- forward/backward consistency
- residual error
- numeric confidence
- quality: high / medium / low / unreliable

İlk eşikler:

- high ≥ 0.76
- medium ≥ 0.56
- low ≥ 0.38
- unreliable < 0.38

Cache genel kalitesi ayrıca usable transform coverage ve ortalama confidence üzerinden değerlendirilir.

Tracking yeterli coverage üretmezse:

```text
mode: fixed-roi-fallback
fallbackUsed: true
```

olur. Yanlış transform sessizce uygulanmaz.

## Transform cache

Tracking her probe için sıfırdan hesaplanmaz.

Project edit state içinde sınırlı sayıda cache tutulur:

```text
edit.cameraTrackingCaches
```

Cache identity şu bağlamları içerir:

- source path
- anchor/reference event time
- exclusion ROI seti
- preferred Background/Reference ROI
- algorithm version

Aynı bağlam ve sample times daha önce hesaplanmışsa cache yeniden kullanılabilir.

Provenance:

```text
algorithm: feature-similarity-ransac-v2
version: 2
transformModel: similarity-dx-dy-rotation-scale
cacheId: ...
anchorSeconds: ...
mode: global-feature-similarity | reference-feature-similarity | fixed-roi-fallback
quality: high | medium | low | unreliable
fallbackUsed: ...
transformSeries: [...]
```

## Structural Transition

Structural Transition v2 gerçek stabilized ROI coordinates kullanır.

Kullanıcı Target / Control / Background ROI'lerini event frame bağlamında tanımlar. Her timeline zamanı için event-anchor camera transformu ROI'lere uygulanır.

Böylece PRE / EVENT / POST structural örnekleri mümkün olduğunca aynı fiziksel sahne alanını takip eder.

Her point kendi kullanılan transformed ROI'sini ve tracking point'ini provenance olarak taşır.

Tracking quality `high` veya `medium` değilse güçlü structural classification engellenir ve:

```text
roi-tracking-quality-limits-structural-result
```

üretilir.

## Background Reference alignment

Background Reference artık yalnız aynı ekran koordinatından alınmaz.

Event Target ROI → user-selected Background Reference time arasında Camera Tracking v2 transformu hesaplanır.

Reference frame'deki template ROI bu transformla taşınır. Aynı transform sistemi convergence timeline noktalarına da uygulanır.

Reference-time transform güvenilir değilse:

```text
reference-alignment-tracking-unreliable
```

classification kullanılır ve convergence sonucu güçlü yorum için uygun sayılmaz.

## Visibility Response / legacy photometry sınırı

İlk v2 entegrasyonda mevcut photometric pipeline geriye dönük ölçüm semantiğini korur.

Bu nedenle:

- legacy Transition photometric PRE/EVENT/POST: fixed ROI
- Visibility Response metric sweep: fixed ROI

olarak ölçülmeye devam eder.

Ancak aynı selection için Camera Tracking v2 cache üretilir ve provenance / quality gate sonuca eklenir.

Tracking düşükse Visibility Response insan-dili assessment'i:

```text
roi-tracking-quality-limits-response-result
```

ile sınırlandırılır ve eski classification `ungatedClassification` olarak saklanır.

Bu ayrım raporda açıkça:

```text
photometricCoordinateMode: fixed-roi-legacy
structuralCoordinateMode: camera-tracking-v2-similarity
```

şeklinde tutulur.

Dinamik per-frame photometric ROI sampling daha sonraki bir genişletme olabilir; v2'nin ilk amacı Structural ve Background Reference gibi camera drift'e en hassas küçük-ROI ölçümlerini güvenilir coordinate tracking'e geçirmek ve diğer probe'ların kalite kapısını doğru kurmaktır.

## Drift / residual report

Structural v2 raporu hem ham camera transformunu hem corrected residual diagnostics'i saklar.

Raw:

- dx / dy
- rotation
- scale
- peak displacement
- peak rotation
- peak scale delta

Corrected residual:

- dx / dy
- rotation
- scale
- residual error px

Ek olarak:

- tracking quality
- confidence
- inlier ratio
- forward/backward consistency
- feature count
- fallback
- mode
- cache id

raporlanır.

## Tracking Preview

Visual Stress panelinde Camera Tracking v2 cache üretildikten sonra **Tracking Preview** kullanılabilir.

Preview yeni analiz başlatmaz. Mevcut cache'i okur.

Video oynarken:

- mevcut ROI çerçeveleri raw / event-anchor koordinatını gösterir,
- dashed overlay v2 transformla hesaplanan stabilized konumu gösterir.

Target, Control ve Background için görünür ROI'ler doğrulanabilir.

Preview status satırında current time için:

- quality
- confidence
- inlier ratio
- forward/backward consistency
- dx/dy
- rotation
- scale
- residual error

gösterilir.

Cache transformları arasında preview için lineer interpolation uygulanır. Bu yalnız visual verification içindir; ölçüm runtime kendi sampled transform point'lerini kullanır.

## Axis-aligned ROI sınırı

Rotation uygulanmış ROI ilk v2 sürümünde transformed dört köşenin axis-aligned bounding box'ı olarak crop edilir.

Bu küçük rotation'larda pratik ve hafiftir ancak döndürülmüş dikdörtgenin dışındaki az miktarda çevre pikselini crop'a dahil edebilir.

Daha ileri bir sürümde affine-warped crop uygulanabilir. Bu sınır provenance içinde saklanır; perspective/homography yoktur.

## Regression / benchmark

Sentetik benchmark dosyası:

```bash
npm run rooms:test:file -- scripts/tests/laboratory-camera-tracking-v2-regressions.test.ts
```

Kapsanan senaryolar:

1. horizontal translation
2. vertical translation
3. translation + small rotation
4. mild zoom
5. moving foreground + static camera
6. moving foreground + moving camera
7. low-texture / dark scene
8. Background Reference ROI mapping
9. static camera + strong Target motion false-displacement regression

Özellikle kamera sabitken hareket eden Target nedeniyle 80+ px sahte camera displacement oluşmaması regression olarak kilitlenir.

## Doğrulama

```bash
npm run rooms:typecheck
npm run rooms:lint:strict
npm run rooms:test:file -- scripts/tests/laboratory-camera-tracking-v2-regressions.test.ts
npm run rooms:test:file -- scripts/tests/laboratory-structural-transition-regressions.test.ts
npm run rooms:test:file -- scripts/tests/laboratory-transform-stack-live-regressions.test.ts
npm run rooms:test:file -- scripts/tests/laboratory-stress-report-history-regressions.test.ts
node rooms/laboratory/scripts/laboratory-check.mjs
```
