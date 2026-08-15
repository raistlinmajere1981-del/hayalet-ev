# 🧪 Laboratory

Laboratory bir araç ekranı değil.
Bir çalışma tezgâhı.

Buradaki amaç bir medya dosyasına yalnızca bakmak değil; kaynağı projeye almak, gerekli araçları hazırlamak, ayrıntıyı incelemek, analiz etmek, bulguyu kaydetmek ve gerektiğinde AI ile devam edilebilecek bir rapora dönüştürmektir.

---

## 🔬 Bugünkü Laboratory

Güncel Laboratory iki ana özellik yüzeyini tek guided workbench altında toplar:

- **Media Analysis** — görüntü/video intake, hazırlık, inceleme, karşılaştırma, işleme ve raporlama
- **Audio Analysis** — ses odaklı hazırlık, sinyal/speech/forensic/model analizleri ve raporlama

Bu yüzden Laboratory yalnızca bir player, editör veya rapor ekranı değildir.

> Kaynak → Hazırlık → İnceleme → Analiz → Karşılaştırma/Annotation → Rapor/Export → AI ile devam

akışının tamamını aynı proje içinde tutmaya çalışır.

---

## 📥 Kaynak ve Proje Intake

Laboratory çalışma durumunu tek seferlik bir prompt gibi bırakmaz; proje olarak saklar.

Mevcut source katmanı yerel medya kaynaklarının yanında URL/YouTube gibi intake akışlarını da destekleyecek şekilde ayrılmıştır. Proje katmanı kaynak, türetilen varlıklar, analiz durumu, rapor ve export kayıtlarını aynı çalışma bağlamında tutar.

Bu yaklaşımın amacı:

- aynı kaynağa tekrar dönebilmek,
- analiz adımlarını kaybetmemek,
- türetilen dosyaları kaynakla ilişkilendirmek,
- raporu yalnızca son çıktı değil çalışma geçmişinin özeti haline getirmektir.

---

## 🧰 Readiness, Araçlar ve Modeller

Laboratory bir işlem başlatmadan önce arka plandaki zemini görünür kılar.

Room-local toolchain ve readiness akışları:

- hangi aracın gerekli olduğunu,
- aracın sistemde hazır olup olmadığını,
- hangi model veya runtime'ın eksik olduğunu,
- hangi bileşenin otomatik hazırlanabildiğini,
- hangi adımın sistem bağımlılığı nedeniyle kullanıcı müdahalesi istediğini

göstermek için kullanılır.

Bu yüzden “çalıştır” düğmesi tek başına sihirli bir kara kutu değildir. Hazırlık durumu projenin parçasıdır.

---

## 🖼️ Görüntü ve Video İnceleme

Media Analysis çalışma alanı medya oynatma/inceleme ile proje araçlarını aynı yüzeyde birleştirir.

Güncel görüntü çalışma akışında desteklenen başlıca yetenekler:

- tek görsel inceleme,
- iki görseli karşılaştırma çalışma alanı,
- görseli çalışma alanı içinde taşıma ve yakınlaştırma,
- karşılaştırma tarafları arasında aktif taraf/seçim yönetimi,
- ROI/seçim tabanlı ayrıntı inceleme,
- detay/geometri odaklı yardımcı inceleme yüzeyleri,
- karşılaştırma anını capture/export etme,
- iki görseli yan yana tek PNG çıktısı olarak dışa aktarma.

Video kaynakları aynı proje ve timeline altyapısı içinde incelenebilir; medya kontrolleri ve türetilen analiz sonuçları proje durumuyla birlikte yönetilir.

---

## ✏️ Annotation / Çizim Katmanı

Görüntü karşılaştırma çalışma alanında room-local bir annotation katmanı bulunur.

Mevcut çizim araçları:

- serbest kalem,
- daire/elips işaretleme,
- çizgi kalınlığı,
- çizgi rengi,
- temizleme/sıfırlama.

Annotation işaretleri kaynak dosyayı kalıcı olarak değiştirmez. Primary/reference tarafına bağlı çalışma işaretleri olarak tutulur ve ekrandaki transform ile birlikte hizalanır.

Capture/export sırasında annotation katmanı PNG overlay olarak kompozit çıktıya yansıtılabilir. Böylece kullanıcı ekranda işaretlediği bölgeleri kaydedilen karşılaştırma görselinde de koruyabilir.

---

## 🔊 Audio Analysis

Audio Analysis, Laboratory'nin ayrı bir uygulaması değil aynı proje/araç/raporlama mantığını kullanan ses odaklı yüzeyidir.

Kaynak ağacındaki mevcut analiz pipeline'ları temel/local analizlerin yanında gelişmiş forensic ve model tabanlı runner'lar içerir. Bunlar arasında örneğin:

- sinyal ve yerel analiz/probe akışları,
- speech/transcript ile ilişkili hazırlıklar,
- gelişmiş forensic analiz runner'ları,
- music/rhythm model analizi,
- sound-event model analizi,
- source-separation model akışı

bulunur.

Bu modüllerin kullanılabilirliği gerekli yerel araç/model durumuna bağlıdır; readiness katmanı bu nedenle Laboratory'nin temel parçalarından biridir.

---

## 📈 Timeline, Sonuçlar ve Keşif

Laboratory sonuçları yalnızca “başarılı/başarısız” şeklinde göstermez.

Çalışma alanı ve drawer katmanları:

- türetilen varlıkları,
- analiz sonuçlarını,
- zaman/timeline bağlamını,
- seçili kapsam ve bölgeleri,
- sonuç keşif yüzeylerini

aynı proje içinde tekrar açılabilir halde tutar.

Amaç ham çıktı dosyalarının arasından elle anlam çıkarmak yerine, bulguyu kaynak ve çalışma bağlamıyla birlikte görünür kılmaktır.

---

## ⚙️ Process

Bir analiz koşusu başladığında Laboratory süreci proje durumuna bağlar.

Kullanıcı için önemli olan yalnızca “bitti” mesajı değildir:

- hangi aşamanın çalıştığı,
- hangi varlığın üretildiği,
- hangi aracın kullanıldığı,
- neyin eksik kaldığı,
- hangi adımın tekrar denenebileceği

gibi bilgiler mümkün olduğunca görünür tutulur.

Bu, özellikle ağır medya ve model işlemlerinde sonucu yeniden üretilebilir ve yorumlanabilir hale getirir.

---

## 📊 Rapor ve AI Handoff

Laboratory raporu, işlem bittikten sonra eklenen dekoratif bir özet değildir.

Rapor katmanı:

- neyin bulunduğunu,
- neyin eksik veya belirsiz kaldığını,
- hangi koşullarda çalışıldığını,
- kullanıcı için okunabilir özeti,
- AI'nin tekrar yorumlayabileceği teknik bağlamı

taşımayı hedefler.

Desteklenen akışlarda rapor veya seçili çalışma bağlamı AI slotuna aktarılabilir. Böylece analiz sonucu ayrı bir sohbet başlatmak yerine mevcut proje bağlamının devamı olur.

---

## 💾 Export

Laboratory'de export yalnızca ham kaynak kopyalamak değildir.

Güncel görüntü akışında:

- tek çalışma anı,
- iki görsel karşılaştırması,
- annotation katmanı uygulanmış karşılaştırma çıktısı

PNG artifact olarak üretilebilir.

Export edilen dosya çalışma projesinin bir sonucu olarak ele alınır; kaynak dosyanın kendisini destructive biçimde değiştirmek hedeflenmez.

---

## 🧭 Çalışma İlkeleri

Laboratory geliştirilirken birkaç sınır özellikle korunur:

1. **Kaynak dosya ile çalışma durumu ayrıdır.** İnceleme/annotation kaynak medyayı sessizce değiştirmemelidir.
2. **Araç/model hazırlığı görünürdür.** Eksik dependency başarısız analize dönüşmeden önce anlaşılmalıdır.
3. **Sonuç proje içinde yaşar.** Analiz, export ve rapor birbirinden kopuk geçici dosyalar olmamalıdır.
4. **UI, runtime ve host katmanları ayrıdır.** Room ownership sınırları yeni özelliklerde korunmalıdır.
5. **Deneysel araç uygulanmış özellik gibi belgelenmez.** Bu dosya güncel `main` üzerinde karşılığı bulunan çalışma yüzeylerini tarif eder.

---

## 🧱 Kaynak Yapısı

Laboratory'nin editable source of truth'u `rooms/laboratory` altındadır.

Önemli katmanlar:

- `features/media-analysis/` — medya source/process/export ve ilgili host davranışları
- `features/audio-analysis/` — ses analiz pipeline'ları
- `shared/host/` — ortak IO, project, process, report ve yardımcı host katmanı
- `runtime/` — browser-side state, event ve execution koordinasyonu
- `ui/` — workbench UI, renderer, binder, overlay ve drawing davranışları
- `tools/` — room-local toolchain metadata ve dinamik tool payload'ları

Ayrıntılı ownership ve cleanup kuralları: [rooms/laboratory/README.md](rooms/laboratory/README.md).

---

## ✅ Doğrulama

Laboratory değişiklikleri için tam room gate:

```bash
node rooms/laboratory/scripts/laboratory-check.mjs
```

Tüm repository kalite kapısı:

```bash
npm run check:all
```

---

## 🎯 Amaç

Laboratory'nin amacı yalnızca bir analiz işlemini tamamlamak değildir.

Amaç:

- kaynağın nereden geldiğini bilmek,
- analize hazır olup olmadığını görmek,
- ayrıntıyı gerektiğinde insan gözüyle incelemek ve işaretlemek,
- otomatik analizleri aynı bağlama eklemek,
- sonucu tekrar açılabilir, export edilebilir ve AI ile tartışılabilir hale getirmektir.

> Ham veri burada yalnızca açılmaz; hazırlanır, incelenir, işlenir, işaretlenir ve bağlamlı bir bulguya dönüşür.
