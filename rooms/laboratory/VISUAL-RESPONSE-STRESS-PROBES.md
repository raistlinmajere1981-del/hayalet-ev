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

Diferansiyel testler iki ROI kullanır:

- **Background / Reference ROI** — hedefin hemen yanında, mümkün olduğunca benzer fiziksel arka plan.
- **Target ROI** — iddia edilen hedef yapı.

Mevcut Motion Reference kilidi Background ROI olarak da kullanılır.

Önerilen akış:

1. timeline aralığını seç,
2. hedefin yanındaki sabit arka plan ROI'sini seç,
3. **Reference / Background ROI Lock** ile kilitle,
4. Target ROI'yi seç,
5. response veya transition testini çalıştır.

Motion Probe aynı kilidi kamera hareketi referansı olarak kullanmaya devam eder.

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

aynı Target ROI üzerinde çalıştırılır. Background ROI kilitliyse aynı ladder Background üzerinde de çalışır ve diferansiyel degradation sonucu üretilir.

## İnsan-dili yorum sınırı

UI şu tür ifadeler kullanabilir:

- target ve background birlikte değişiyor,
- değişim target'a lokalize görünüyor,
- davranış düşük ışık / sensör açıklamasıyla uyumlu,
- global sensör cevabı tek başına target/background ayrışmasını açıklamıyor,
- codec degradation hedefi çevreden daha hızlı bozuyor,
- hedef fiziksel çevre yapılarıyla benzer response gösteriyor,
- hedef farklı response gösteriyor,
- örnek yetersiz,
- sonuç belirsiz.

Bu ifadeler mekanizma kanıtı değildir.

Özellikle şu çıkarım yapılmaz:

```text
farklı response = paranormal
```

veya bunun herhangi bir eşdeğeri.

## Sonuç yüzeyi

Live Results mümkün olduğunca aynı kayıt üzerinden şunları görünür tutar:

- Target curve
- Background curve
- diferansiyel curve
- Target / Background ROI koordinatları
- response tablosu
- transition PRE / EVENT / POST tablosu
- codec ladder tablosu
- insan-dili yorum

Source / Transform / Difference preview mevcut transform preview yüzeyinde korunur.

Bu ilk sürüm Target/Background ROI için ayrı crop thumbnail artifact üretmez; ROI konumu ve ölçüm eğrileri sonuç kaydında tutulur. Görsel crop artifact'leri gerekirse sonraki turda aynı provenance zincirine eklenebilir.

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
- yorum sınıfı

ile birlikte tutulur.

## Doğrulama

Yeni regression dosyası:

```bash
npm run rooms:test:file -- scripts/tests/laboratory-visual-response-regressions.test.ts
```

Tam Laboratory gate:

```bash
node rooms/laboratory/scripts/laboratory-check.mjs
```
