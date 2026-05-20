# İz Sürme Odası v2 / Pattern Room v2 — Faz 0 Manifestosu

## 1. Odanın Amacı

Araştırma sürecini görünür kılmak. Kullanıcı bir konu, soru veya problem getirdiğinde bunu kanıt toplama, analiz etme, yorum üretme ve belirsizlikleri işaretleme adımlarıyla yapılandırılmış şekilde işlemek. Oda kesin doğru üretme iddiası taşımaz; sürecin kendisini şeffaf ve takip edilebilir yapar.

Metafor: near-future dedektif ofisi — bir pano, bir masa, bir arşiv. Araştırmacının düşünce akışını somutlaştıran bir çalışma alanı.

## 2. Odanın Ne Olmadığı

- **Arama motoru değil.** Sorguya tek bir cevap döndürmez.
- **Sohbet odası değil.** Serbest akış konuşma için tasarlanmamıştır.
- **Doğruluk makinesi değil.** "Kesin cevap" garantisi vermez; belirsizliği açıkça kabul eder.
- **Yeni bir provider/relay altyapısı değil.** Mevcut sistemi kullanır; kendi iletişim katmanını kurmaz.
- **Laboratory Room'un klonu değil.** Farklı amaç, farklı akış, farklı sınırlar.

## 3. Temel Kullanıcı Deneyimi

1. Kullanıcı bir araştırma konusu tanımlar.
2. Araştırma panosu açılır — konu merkeze yerleşir.
3. Kullanıcı ve AI birlikte kanıt toplar, analiz üretir, yorum ekler.
4. Her bilgi parçası türüne göre etiketlenir: kanıt / analiz / yorum / belirsizlik.
5. Kullanıcı istediğinde 10. Adam modunu manuel olarak etkinleştirir.
6. Süreç sonunda pano, araştırmanın tüm katmanlarını tek bakışta gösterir.

Akış doğrusaldır ama katı değildir; kullanıcı her zaman panoya dönebilir, parçaları yeniden düzenleyebilir veya yeni dal açabilir.

## 4. Ana Bileşenler

| Bileşen | Rol |
|---|---|
| **Dedektif Panosu** | Araştırmanın merkez görünümü. Tüm parçalar (kanıt, analiz, yorum, belirsizlik) burada görselleşir. |
| **Araştırma Masası** | Aktif çalışma alanı. Kullanıcı ve AI burada kanıt inceler, analiz üretir. |
| **Arşiv / Kaynak Alanı** | Toplanan kaynakların ve referansların tutulduğu alan. Araştırma masasından bağımsızdır. İleride eski metinler, dini metinler, gazeteler, altyazılar, sayı analizi çıktıları ve Laboratory sonuçları buraya bağlanacaktır. Faz 1'de gerçek arşiv olmayacak; sadece dummy/görsel kaynak alanı olacak. |
| **10. Adam Cihazı** | Mevcut bulgulara sistematik karşı-argüman üreten mod. Yalnızca kullanıcı isteğiyle etkinleşir. |
| **Rapor / İz Kaydı** | Araştırma sürecinin kronolojik özeti ve son durum raporu. |

Bu 5 bileşen kesinleşmiştir. Faz 1'de hepsi dummy UI olarak yer alacak; gerçek yetenek faz faz eklenecek.

## 5. Kanıt / Analiz / Yorum / Belirsizlik Ayrımı

Odanın temel tasarım kararı: her bilgi parçası dört kategoriden birine atanır.

| Kategori | Tanım | Örnek |
|---|---|---|
| **Kanıt** | Doğrudan gözlem, kaynak veya veri. Yorumsuz. | "X raporu şunu söylüyor." |
| **Analiz** | Kanıtlar arası mantıksal bağlantı veya çıkarım. | "A ve B birlikte şunu gösteriyor." |
| **Yorum** | Öznel değerlendirme veya olası senaryo. | "Bu muhtemelen şu anlama geliyor." |
| **Belirsizlik** | Eksik bilgi, çelişki veya doğrulanamayan nokta. | "Bu noktada yeterli veri yok." |

Bu ayrım görsel olarak pano üzerinde belirgin şekilde işaretlenecek. Kategori karışıklığı odanın en büyük riski olduğu için UI seviyesinde net ayrım zorunludur.

## 6. 10. Adam Modu — Üst Seviye Akış

10. Adam, mevcut araştırma sonuçlarına sistematik muhalefet üretme modudur.

**Tetikleme:** Yalnızca kullanıcı isteğiyle açılır. Sistem ileride çelişki veya gerilim algılarsa "10. Adam modu önerisi" sunabilir, ancak otomatik başlatmaz. Kullanıcının kontrol hissi korunur.

**Akış:**

1. Kullanıcı 10. Adam modunu manuel olarak etkinleştirir.
2. Panodaki mevcut kanıt, analiz ve yorumlar karşı-argüman girdisi olarak sunulur.
3. AI, her ana sonuca karşı en güçlü itirazı üretir.
4. Karşı-argümanlar panoda ayrı bir katman olarak görünür — orijinal bulgularla yan yana.
5. Kullanıcı karşı-argümanları kabul eder, reddeder veya araştırmaya yeni dal olarak ekler.

10. Adam araştırmayı bozmaz; mevcut yapının üzerine eklenir. Kullanıcı istediğinde kapatabilir.

**Faz 1:** Sadece manuel tetikleme. Kullanıcı 10. Adam cihazına tıklayarak dummy hazırlık ekranını açar.

## 7. Capability Yaklaşımı

Laboratory Room'dan alınan ders: sonradan ekleme ve entegrasyon sorunlarından kaçınmak için oda baştan capability sınırlarıyla tasarlanacak.

- **Faz 1:** Dummy UI — tüm bileşenler görsel olarak yerinde, etkileşim minimal.
- **Faz 2+:** Her capability tek tek, tanımlı kontratla eklenir.
- Yeni capability eklemek, mevcut bileşenlerin kontratını değiştirmemeli.
- Bir capability hazır olmadan "kısmen çalışır" durumda bırakılmaz; ya dummy, ya tam işlevsel.
- Her capability'nin sınırı (ne yapar, ne yapmaz) eklenmeden önce yazılır.

## 8. Mevcut Provider / Relay Sistemiyle İlişki

- Oda, mevcut 2 AI provider ve relay/iletişim sistemini kullanır.
- Yeni provider, yeni relay kanalı veya yeni iletişim protokolü oluşturulmaz.
- AI etkileşimleri (analiz üretme, 10. Adam karşı-argümanları vb.) mevcut asistan ve provider altyapısı üzerinden çalışır.
- Odanın provider'a özel bağımlılığı olmaz; hangi provider aktifse o kullanılır.

## 9. Şimdilik Yapılmayacaklar

- Gerçek veri kaynağına bağlanma (web arama, API entegrasyonu vb.)
- Çoklu araştırma oturumu yönetimi
- Araştırmalar arası çapraz referans
- Dışa aktarım (PDF, markdown export vb.)
- Çok kullanıcılı eş zamanlı araştırma
- Özel eğitilmiş modeller veya fine-tuning
- Doğruluk skorlama veya güvenilirlik puanlama sistemi
- Tam kalıcı araştırma veritabanı / arşivi
- Otomatik 10. Adam tetikleme

## 10. Kalıcılık Prensibi

Araştırma oturumu kapanınca tamamen silinmez. "Son oturum / taslak durum" seviyesinde korunur. Bu kalıcı arşiv değil; kullanıcının çalışmayı yanlışlıkla kaybetmemesi için geçici devamlılıktır.

Fazlara göre yaklaşım:

- **Faz 1:** Mock / session state — gerçek storage yok
- **Sonraki fazlar:** Son oturumu geri getirme yeteneği
- **İleri fazlar:** Tam kalıcı araştırma arşivi

## 11. Faz 1'e Geçiş Kriterleri

Faz 0 tamamlanmış sayılır ve Faz 1 dummy UI çalışmasına başlanabilir, eğer:

- [ ] Bu manifesto gözden geçirildi ve onaylandı
- [ ] 5 bileşen listesi kesinleşti
- [ ] Kanıt / Analiz / Yorum / Belirsizlik ayrımı kabul edildi
- [ ] 10. Adam modu akışı (manuel tetikleme) kabul edildi
- [ ] Kalıcılık prensibi (son oturum korunması) kabul edildi
- [ ] Mevcut provider/relay kullanımı üzerinde anlaşıldı
- [ ] "Yapılmayacaklar" listesi üzerinde anlaşıldı
- [ ] Room manifest tipi ve temel room kontratı taslak olarak hazırlandı
