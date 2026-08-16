🎲 Backgammon / Tavla

Backgammon, Game Room'un tamamlanmış ana fonksiyonlarından biridir.

Dışarıdan klasik Tavla gibi görünür:

iki taraf
24 nokta
zar
bar
toplama
legal hamleler

Ama Hayalet Ev içindeki asıl rolü farklıdır:

İnsan, AI ve uzak kullanıcı aynı oyun kontratının içinde aynı kurallara tabi olur.

🎯 Nedir?

Backgammon, Game Room içinde backgammon feature'ı olarak çalışır.

Oyuncu:

AI1
AI2
bağlı US1

ile oynayabilir.

Başlangıçta rakip ve kimin başlayacağı seçilir.

Sonrasında oyun host tarafından hesaplanan legal hamleler üzerinden ilerler.

Burada önemli ayrım:

AI hakem değildir. Oyuncudur.

🎲 Kural Çerçevesi

Bu sürümde:

doubling cube yoktur
her oyuncuda 15 pul vardır
kullanıcı 24. noktadan 1. noktaya ilerler
rakip 1. noktadan 24. noktaya ilerler
kırık pullar bar'dan oyuna girmek zorundadır
tüm pullar ev alanına gelmeden toplama yapılmaz
sonuç mars/katmerli mars durumuna göre hesaplanır

Zar host tarafından üretilir.

AI'ya:

zar
tahta
bar/off durumu
turn token
legal move id'leri

gönderilir.

⚖️ Legal Move Contract

Backgammon'un güvenlik merkezinde:

legalMoveId

bulunur.

Host:

tahtayı normalize eder
zar sırasına göre olası hamle dizilerini hesaplar
kurala uygun ve en uzun dizileri tutar
her legal hamleye deterministik ID verir

Kullanıcı bir hamle seçer.

AI ise verilen legal hamleler arasından bir legalMoveId seçer.

AI'nin görevi kendi hamlesini icat etmek değil:

mevcut oyun durumunda mümkün olan hamlelerden birini seçmektir.

🔄 Tur Akışı

Tipik AI oyunu:

Kullanıcı rakibi seçer.
Host match state oluşturur.
Kullanıcı turundaysa legal hamleler gösterilir.
Kullanıcı hamle yapar.
Host sonucu uygular.
Yeni zar ve AI turn packet oluşturulur.
AI legal move seçer.
Host hamleyi doğrular ve uygular.
Sıra devam eder.

15 pulunu ilk toplayan taraf oyunu kazanır.

🌐 US1 ile Uzak Tavla

Uzak kullanıcı hamlesi AI hamlesinden daha sıkı transport kontrolüne tabidir.

Hamlelerde:

matchId
inviteId
turnIndex
boardHashBeforeMove
turnToken
legalMoveId

gibi alanlar korunur.

Bunlardan biri aktif state ile uyuşmazsa hamle uygulanmaz.

Bu sayede stale veya duplicate mesajlar tahtayı değiştiremez.

✉️ Davet Sistemi

US1 oyunu doğrudan başlamaz.

Önce davet akışı vardır.

Uzak kullanıcı:

daveti kabul edebilir
reddedebilir
aktif maçı reset ile bitirebilir

Davet notu uzak transport mesajının parçasıdır.

AI protokol preface'i ile aynı mekanizma değildir.

🖼️ UI

Backgammon iki sunum moduna uyabilir.

Classic

Daha geniş masa düzeni.

Scene View

Tahta, oda sahnesindeki transparent window alanına uyacak biçimde kompakt hale gelir.

UI:

rakip slotları
başlangıç seçimi
davetler
maç durumu
zar
bar/off
legal hamleler
tahta
geçmiş

yüzeylerini içerir.

Görsel tahta yüklenemezse legal hamle butonları yedek akışı korur.

🤖 AI İçin Anlamı

AI:

oyun durumunu okur
legal hamle listesini değerlendirir
bir legalMoveId seçer
aktif turn bilgilerini korur

Host ise:

kuralları uygular
hamleyi doğrular
oyunun gerçek state'ini tutar

Bu ayrım bilinçlidir.

AI karar verendir; host hakemdir.

🏠 Neden Game Room İçinde Önemli?

Tavla yalnızca bir oyun eklemek için yapılmadı.

Aynı deneyimde:

room manifest
runtime
AI protocol
US1 transport
Scene Mode
i18n
match state
history

birleşir.

Bu nedenle Backgammon, Game Room mimarisinin referans uygulamalarından biridir.

🎯 Amaç

Tavla burada yalnızca zar şansı değildir.

Her turda aynı soru sorulur:

Bu durumda gerçekten hangi hamle mümkün?

İnsan, AI veya uzak kullanıcı fark etmez.

Herkes aynı oyun kontratına gelir:

Legal bir hamle seç.
Sıranı tamamla.
Yeni oyun durumuyla devam et.
