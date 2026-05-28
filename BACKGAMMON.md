# Backgammon / Tavla

Backgammon, Game Room'un ilk tamamlanmis ana fonksiyonudur.

Disaridan bakinca klasik Tavla'dir:
iki taraf, yirmi dort nokta, zar, bar, toplama ve legal hamleler.

Ama Hayalet Ev icinde asil rolu sudur:

> insan, AI slotlari ve uzak kullanici ayni oyun kontrati uzerinden sirali bir
> karar alanina girer.

---

## Nedir?

Backgammon, Game Room icinde `backgammon` feature'i olarak calisir.

Oyuncu:

- AI1'e karsi oynayabilir
- AI2'ye karsi oynayabilir
- bagli US1 uzak kullanicisiyle oynayabilir

Baslangicta rakip ve kimin baslayacagi secilir.
Sonra oyun, host tarafindan uretilen legal hamleler uzerinden ilerler.

Bu odada "hamle uydurmak" yoktur.
Sistem her tur icin izin verilen hamleleri hesaplar.
Kullanici veya AI bu listeden bir hamle secer.

---

## Kural Cercevesi

Oyun klasik Backgammon / Tavla mantigina dayanir.

Bu surumde:

- doubling cube yoktur
- her oyuncuda 15 pul vardir
- kullanici 24. noktadan 1. noktaya dogru ilerler
- rakip taraf 1. noktadan 24. noktaya dogru ilerler
- kirik pullar bar'dan oyuna girmek zorundadir
- tum pullar kendi ev alanina gelmeden toplama yapilmaz
- kazanma puani mars / katmerli mars durumuna gore hesaplanir

Zar her tur host tarafindan uretilir.
AI tarafina hamle secmesi icin zar, tahta, bar/off durumu, turn token ve legal
hamle id'leri gonderilir.

---

## Legal Hamle Kontrati

Backgammon'da esas guvenlik noktasi `legalMoveId` kontratidir.

Host her turda:

- tahtayi normalize eder
- zar sirasina gore olasi hamle dizilerini hesaplar
- yalnizca en uzun ve kurala uygun dizileri tutar
- her legal hamleye deterministik bir id verir

Kullanici UI'dan bir hamle secer.
AI ise verilen listeden bir `legalMoveId` dondurur.

AI cevap formati tek satirdir:

```text
++cmd:SlotBridge({"action":"room.command","payload":{"commandName":"GameRoomBackgammonAiMove","legalMoveId":"move_id","turnToken":"token","turnIndex":0}})
```

Komuttaki `move_id`, `token` ve `turnIndex` host tarafindan verilen aktif tur
bilgileriyle ayni kalmalidir.

Komut disinda duz yazi, aciklama, markdown veya ikinci komut beklenmez.
Yalnizca son assistant mesajindaki komut parse edilir.

---

## Tur Akisi

Tipik AI mac akisi soyledir:

1. Kullanici rakibi ve baslangici secer.
2. Host yeni mac state'i olusturur.
3. Sira kullanicidaysa UI legal hamleleri gosterir.
4. Kullanici hamle yapar.
5. Host sonucu uygular, yeni zar atar ve AI tur paketini gonderir.
6. AI `GameRoomBackgammonAiMove` komutuyla legal hamle id'si dondurur.
7. Host hamleyi uygular ve sirayi yeniden kullaniciya verir.

Bir taraf 15 pulunu topladiginda mac biter.
Mac sonucu gecmise yazilir.

---

## US1 ile Uzak Tavla

US1 maclari AI maclarindan daha siki bir transport kontrati kullanir.

Cunku uzak kullanici tarafinda mesaj gec gelebilir, yinelenebilir veya stale
kalabilir.

Bu yuzden uzak hamlelerde su alanlar korunur:

- `matchId`: uzak macin sabit kimligi
- `inviteId`: uyumluluk icin matchId ile aynalanan davet kimligi
- `turnIndex`: hamle oncesi tur indeksi
- `boardHashBeforeMove`: hamle oncesi kompakt tahta hash'i
- `turnToken`: aktif tur token'i
- `legalMoveId`: host'un legal hamle listesinden secilen id

Bu alanlardan biri eslesmezse hamle tahtayi degistirmez.
Yinelenen veya stale mesajlar guvenli sekilde yoksayilir.

---

## Davet Sistemi

US1 icin oyun dogrudan baslamaz.
Once davet akisi vardir.

Uzak taraf:

- daveti kabul edebilir
- reddedebilir
- aktif maci reset ile bitirebilir

Davet notu, AI protokol preface'i gibi degil, uzak davet mesajinin parcasi
olarak tasinir.

Bu ayrim onemlidir:

- AI1 / AI2 seciliyken not ilk protokol mesajinin basina eklenir
- US1 seciliyken not davet maili veya oda transport mesajinda kullanilir

---

## UI Deneyimi

Backgammon UI iki sunum moduna uyum saglar.

Klasik modda daha genis bir masa duzeni vardir.
Scene View modunda ise tahta, oda sahnesindeki transparent window alanina
sigacak sekilde daha kompakt calisir.

UI sunlari gosterir:

- rakip slotlari
- baslangic secimi
- davetler
- mac durumu
- zar
- bar ve toplanan pul sayilari
- legal hamleler
- gorsel tahta
- mac gecmisi

Gorsel tahta yuklenemezse legal hamle dugmeleri yedek akisi korur.

---

## AI Icin Anlamı

Backgammon, AI'ya serbest strateji yazdiran bir oyun degildir.

AI'nin gorevi:

- verilen tahta durumunu okumak
- legal hamle listesini degerlendirmek
- tam olarak bir legalMoveId secmek
- turn token'i ve turnIndex'i bozmadan komutu dondurmek

Yani AI burada hakem degil.
Oyuncudur.

Hakem host'tur.

---

## Neden Onemli?

Backgammon, Hayalet Ev icin basit bir oyun eklemesinden fazlasidir.

Cunku burada:

- oda manifest'i
- ana fonksiyon runtime'i
- AI protokol yakalama
- US1 transport
- scene-view sunumu
- room-local i18n
- mac state'i ve gecmis

tek bir canli deneyimde birlesir.

Bu nedenle Backgammon, Game Room'un hem oynanabilir ilk masasi hem de room
feature mimarisinin referans orneklerinden biridir.

---

## Son Soz

Tavla burada zar sansindan ibaret degil.

Her turda sistem sunu sorar:

> Bu durumda gercekten hangi hamle mumkun?

Kullanici, AI veya uzak kullanici fark etmez.
Herkes ayni cevap bicimine gelir:

Bir legal hamle sec.
Sirani tamamla.
Tahtanin yeni haline razi ol.
