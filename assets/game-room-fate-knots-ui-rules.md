# UI Rules — Kader Düğümleri v1

## Amaç

Bu dosya, `game-room` içine eklenecek Kader Düğümleri oyununun UI uygulama kurallarını tanımlar.

Bu oyunun UI’si:
- web uygulaması gibi görünmemeli
- dashboard gibi yorumlanmamalı
- scene-first bir oyun yüzeyi olarak uygulanmalı

SVG wireframe dosyaları ana referanstır.
Bu kurallar, SVG’lerin nasıl yorumlanacağını sabitler.

---

# 1. Ana UI Prensibi

## Scene-first layout

Bu oyunun ana odak noktası sahnedir.

UI şu sırayla hissedilmelidir:

1. sahne
2. oyuncu kararı
3. durum bilgisi

Kartlar, log, status paneli ve butonlar sahneyi bastırmamalıdır.

---

# 2. Yasak Görsel Yorumlar

Aşağıdaki yorumlar kesinlikle yapılmamalıdır:

- SaaS panel görünümü
- admin dashboard görünümü
- modern web app görünümü
- centered landing page hissi
- büyük boşluklu responsive marketing page görünümü
- glassmorphism
- neon cyberpunk dili
- parlak mobil oyun HUD hissi
- aşırı yuvarlak “app card” tasarımı
- collectible card game (Hearthstone / MTG benzeri) süs estetiği

Bu proje bir web paneli değil, sahne-merkezli dijital oyun yüzeyidir.

---

# 3. Genel Görsel Dil

## Hedef estetik

- koyu, mat ve atmosferik
- hafif yaşanmış malzeme hissi
- ahşap / metal / parşömen çağrışımı olabilir
- ama aşırı süslü, ağır medieval dekorasyon olmamalı
- temiz, okunabilir, işlevsel ve sahneye bağlı bir dil kurulmalı

## Renk yaklaşımı

- düşük doygunluk
- muted sıcak kahve / bronz / dumanlı gri tonları
- vurgu renkleri sınırlı kullanılmalı
- önemli seçim, aktif durum ve combat hedefleri için kontrollü sıcak vurgu kullanılabilir

---

# 4. Yerleşim Kuralları

## 4.1 Lobby / Ready Screen

SVG referansı: `ui_wireframe_lobby.svg`

Kurallar:
- ana harita ekranın merkezinde ve baskın alanda olmalı
- oyuncu / katılımcı paneli sağ tarafta dar ama net bir bilgi rayı gibi durmalı
- başlat butonu alt sağ bölgede güçlü aksiyon noktası olmalı
- bu ekran dashboard gibi değil, “oyun başlamadan önce harita başında toplanma” hissi vermeli

## 4.2 Character Creation

SVG referansı: `ui_wireframe_character_create.svg`

Kurallar:
- seçim yoğunluğu solda toplanmalı
- seçili karakter özeti sağ tarafta daha sakin bir panelde gösterilmeli
- karakter yaratma ekranı form doldurma hissi vermemeli
- kart seçimi ve özet paneli birlikte bir “hazırlık masası” gibi hissettirmeli

## 4.3 Scenario Screen

SVG referansı: `ui_wireframe_scenario.svg`

Kurallar:
- sahne görüntüsü ve anlatı üst/orta bölgede baskın olmalı
- log / diyalog sol alt bölgede kalmalı
- choice + card hand sağ alt bölgede kalmalı
- log alanı chat uygulaması gibi görünmemeli
- choice alanı buton listesi gibi değil, sahneye bağlı karar katmanı gibi görünmeli

## 4.4 Combat Screen

SVG referansı: `ui_wireframe_combat.svg`

Kurallar:
- combat, ayrı bir oyun ekranı gibi değil; aynı dünyanın savaş modu gibi görünmeli
- düşmanlar üst sahnede görünmeli
- kart eli altta genişlemeli
- combat log solda kalmalı
- sahne üstte görünür kalmalı, combat ekranı tablo / dashboard’a dönmemeli

---

# 5. Panel Kullanım Kuralları

- paneller sahneden kopuk yüzüyormuş gibi görünmemeli
- paneller arayüzün yapısal parçaları olmalı
- aşırı derin gölge kullanılmamalı
- panel köşeleri çok yuvarlak olmamalı
- çizgi ve border dili hafif yaşanmış ama okunabilir olmalı
- tüm paneller tek bir UI ailesinin parçaları gibi görünmeli

---

# 6. Kart Kuralları

## Kartlar ne değildir

- trading card değildir
- koleksiyon kartı vitrini değildir
- görsel şov alanı değildir

## Kartlar ne olmalıdır

- veri taşıyıcı
- eylem taşıyıcı
- seçim nesnesi
- sistemle oyuncu arasında protokol yüzeyi

## Kart uygulama kuralları

- tüm kartlar ortak iskelet ailesini paylaşmalı
- kartlar 2:3 dikey oran mantığını korumalı
- metin kısa ve kontrollü olmalı
- image slot mantığı korunmalı
- hover / selected / disabled halleri asset + css katmanlarıyla oluşturulmalı
- kartlar sahneyi bastırmamalı

---

# 7. Buton ve Etkileşim Kuralları

- butonlar web form butonu gibi görünmemeli
- hover etkisi hafif olmalı
- selected state net ama abartısız olmalı
- disabled state okunur ama pasif görünmeli
- ana aksiyon butonu ile ikincil buton açıkça ayrılmalı
- butonlar çok parlak veya plastik görünmemeli

---

# 8. Log / Konuşma Alanı Kuralları

- chat app görünümü yasak
- comic konuşma balonu hissi yasak
- diyalog alanı, hikâye akışı ve oyuncu iletişimini taşıyan sakin bir yüzey olmalı
- konuşan karakter / oyuncu net ayırt edilmeli
- log alanı ekranın ana odağını çalmamalı

---

# 9. Status / HUD Kuralları

- sağ panel veya ilgili küçük alanlarda kullanılan status öğeleri net olmalı
- health, mana/energy, buff/debuff gibi öğeler küçük ama anlaşılır olmalı
- iconlar küçük ölçekte okunabilir olmalı
- HUD dili sade tutulmalı
- oyun hissi için yeterli olmalı, ama “MMO arayüzü” gibi kalabalıklaşmamalı

---

# 10. Combat Feedback Kuralları

- combat feedback hızlı ve anlaşılır olmalı
- küçük flash, ring, badge, indicator kullanılabilir
- particle sistemi gerekmez
- sürekli animasyon yasak
- efektler karar hissini desteklemeli, sahneyi boğmamalı

---

# 11. Motion Kuralları

## İzin verilen hareketler

- kısa fade
- kısa hover glow
- küçük scale / yükselme
- seçili kartın hafif öne çıkması
- küçük target ring pulse

## Yasak hareketler

- sürekli parlayan öğeler
- büyük bounce animasyonları
- agresif camera-like zoom
- gereksiz motion blur
- uzun animasyon zincirleri

Motion, dikkat çekmek için değil, durum bildirmek için kullanılmalıdır.

---

# 12. Asset Kullanım Kuralları

UI assetleri:
- compose edilebilir katmanlar halinde kullanılmalı
- frame + overlay + icon + text mantığı korunmalı
- tek parça dev arka planlara gömülmemeli
- assetler runtime’da farklı ekranlarda tekrar kullanılabilecek şekilde düşünülmeli

---

# 13. Uygulama İlkesi

Codex:
- SVG wireframe’leri ana kompozisyon referansı olarak almalı
- bu wireframe’leri “ilham” değil, “yerleşim kılavuzu” olarak yorumlamalı
- yalnızca teknik zorunluluk varsa küçük oran düzeltmeleri yapmalı
- kendi başına yeni bir layout dili icat etmemeli

---

# 14. Son Kural

Bu oyunun UI’si şunu hissettirmelidir:

- kullanıcı bir yazılım paneline bakmıyor
- bir sahnenin içinde karar veriyor
- sistem ona araç sunuyor ama sahne merkezde kalıyor

Kısacası:

scene first, system second, decoration last.
Not: uygulamanın scene ve scene:debug modu içn ana fonksiyon arka plan "assets/team-fate-knots.webp" kullanılacak.
