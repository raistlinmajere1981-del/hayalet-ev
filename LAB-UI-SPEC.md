# 👻 Hayalet Ev — LAB-UI-SPEC v1

## 1. SAYFA AMACI (INTENT)

Laboratuvar sayfası bir **dashboard değildir**.

Bu sayfa:

* Kullanıcıya proje kurulum ve analiz akışını **adım adım** yaptıran bir çalışma alanıdır
* Aynı anda **tek bir ana işe odaklanır**
* Kullanıcıyı bilgiyle boğmak yerine yönlendirir

### Ana prensip:

> Kullanıcı ilk 5 saniyede ne yapacağını anlamalıdır.

---

## 2. ANTI-GOALS (YAPILMAYACAKLAR)

Aşağıdakiler kesinlikle yapılmamalıdır:

* Aynı anda birden fazla “önemli panel” gösterme
* Teknik metrikleri ana ekranda sürekli görünür yapma
* Aynı bilgiyi farklı kartlarda tekrar etme
* Dashboard gibi “her şeyi gösteren” bir yapı kurma
* Her boş alanı içerikle doldurma
* Tek kart içinde hem özet + aksiyon + detay bulundurma

---

## 3. SAYFA YAPISI (LAYOUT ARCHITECTURE)

Sayfa maksimum **3 kolon + 1 alt katman** olacak şekilde tasarlanır:

### SOL — Navigation Layer

* Süreç adımları (stepper)
* Minimal görsel ağırlık
* Sadece navigasyon amaçlı

---

### ORTA — Work Layer (ANA ODAK)

* Sayfanın en büyük ve en önemli alanı
* Aynı anda **sadece 1 aktif çalışma kartı**
* Kullanıcı burada işlem yapar

Örnek içerikler:

* Proje seçimi / oluşturma
* Kaynak seçimi (video / ses / görüntü)
* Modül seçimi

---

### SAĞ — Context Layer

* Kısa bağlam ve durum özeti
* Orta panelle **yarışmaz**
* Maksimum 2 kart içerir

Örnek:

* Aktif proje özeti
* Aktif modül bilgisi

---

### ALT — Diagnostics Layer (DEFAULT: KAPALI)

* Olay akışı (logs)
* Teknik metrikler
* Readiness detayları
* Bağımlılık detayları

> Varsayılan olarak collapse durumda olmalıdır
> Kullanıcı açmadan görünmez

---

## 4. BİLGİ HİYERARŞİSİ

Her element şu 3 seviyeden birine ait olmalıdır:

### 1. Primary (Ana iş)

* Kullanıcının şu an yaptığı işlem
* Sadece orta panelde bulunur

### 2. Secondary (Bağlam)

* Durum bilgisi
* Sağ panelde bulunur

### 3. Tertiary (Detay / Teknik)

* Loglar, metrikler, sistem detayları
* Alt panel veya drawer içinde

> Aynı bilgi birden fazla seviyede yer alamaz

---

## 5. COMPONENT KURALLARI

Her component **tek bir amaca** hizmet eder:

| Component          | Amaç              |
| ------------------ | ----------------- |
| Stepper            | Süreç navigasyonu |
| Work Card          | Aktif işlem       |
| Summary Card       | Kısa bilgi        |
| Action Button      | Tekil aksiyon     |
| Inspector / Drawer | Detay             |
| Event Log          | Sistem olayları   |

### Kural:

> Bir kart ya aksiyon içerir ya bilgi — ikisini birlikte taşımaz

---

## 6. DENSITY (YOĞUNLUK) KURALLARI

* Aynı anda max **1 primary kart**

* Aynı anda max **2 secondary kart**

* Bir kart içinde:

  * 1 başlık
  * 1 kısa açıklama
  * 1 aksiyon (opsiyonel)

* Aynı satırda max **3 veri noktası**

* Aynı sayfada max **2 vurgu rengi**

* Aynı bilgi tekrar edemez

---

## 7. GÖRSEL HİYERARŞİ

* Orta panel = en yüksek kontrast
* Sağ panel = daha düşük kontrast
* Sol panel = en düşük dikkat seviyesi

### Renk kullanımı:

* Accent renk sadece:

  * aktif adım
  * ana aksiyon
    için kullanılır

---

## 8. BOŞLUK (SPACING)

* Kartlar arasında net boşluk bırak
* Görsel nefes alanı oluştur
* Kenarlara yapışık yoğun bloklar oluşturma

### Kural:

> Boşluk bir eksiklik değil, yönlendirme aracıdır

---

## 9. DAVRANIŞ KURALLARI

* Kullanıcı bir adımı tamamlamadan diğerine geçmez
* Gereksiz paneller otomatik açılmaz
* Detaylar:

  * drawer
  * modal
  * collapse panel
    içinde gösterilir

---

## 10. DEFAULT STATE

Sayfa ilk açıldığında:

GÖRÜNENLER:

* Sol stepper
* Orta aktif adım
* Sağ kısa özet

GÖRÜNMEYENLER:

* Olay akışı
* Teknik metrikler
* Bağımlılık detayları

---

## 11. ACCEPTANCE TEST (KABUL KRİTERLERİ)

Tasarım aşağıdaki soruları geçmelidir:

* Kullanıcı ilk bakışta ne yapacağını anlıyor mu?
* Ekranda tek bir odak noktası var mı?
* Aynı bilgi birden fazla yerde görünüyor mu?
* Sağ panel ana panelle yarışıyor mu?
* Loglar varsayılan kapalı mı?
* Sayfa dashboard gibi mi hissediyor?

> Eğer herhangi bir cevap “evet (problemli)” ise tasarım reddedilir

---

## 12. CODEX TALİMATI

* Yeni panel ekleme
* Bilgi tekrar etme
* Teknik metrikleri ana yüzeye taşıma
* Tasarım kararı alma

### Sadece şunu yap:

> Bu dokümandaki kurallara birebir uyan UI oluştur

---

## SON NOT

Bu sayfa bir “kontrol paneli” değil, bir **çalışma ritüelidir**.

Kullanıcıyı yönlendirmeli, yormamalı.

