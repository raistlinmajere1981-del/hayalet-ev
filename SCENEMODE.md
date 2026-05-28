# Scene Mode

Scene Mode, Hayalet Ev'in oda listesini bir menuden cikarip yasanan bir mekana
donusturen sunum bicimidir.

Klasik modda odalar kart olarak gorunur.
Scene Mode'da ise ayni odalar bir koridorda, kapilarda, masalarda ve yakin
gorunumlerde karsina cikar.

Bu yuzden Scene Mode yalnizca gorsel bir tema degildir.
Uygulamanin "ev" fikrini tasiyan ana katmandir.

---

## Temel Fikir

Hayalet Ev'de bir oda, sadece acilan bir sayfa degildir.

Her oda:

- bir mekana sahiptir
- bir giris noktasina sahiptir
- kendi ana fonksiyonlarini sahnede gosterebilir
- gerekirse kendi yakin gorunumunu acar
- AI, kullanici ve uzak kullanici varligini sahne uzerinde tasir

Scene Mode bu parcalari tek bir akista birlestirir.

Kullanici bir kart secmez.
Bir yere gider.

---

## Klasik Mod ile Farki

Klasik mod islevseldir.
Scene Mode mekansaldir.

Klasik modda:

- odalar liste veya kart olarak gosterilir
- acma eylemi dogrudan sayfa gecisidir
- arayuz daha sade ve operasyoneldir

Scene Mode'da:

- odalar sahnedeki tiklanabilir hedeflerdir
- arka plan, karakterler ve hotspot'lar ayni projeksiyonda hizalanir
- oda icinde ana fonksiyonlar da sahne hedefi olabilir
- bir ana fonksiyon acildiginda yakin gorunum ve runtime yuzeyi birlikte gelir

Bu iki mod ayni room kayitlarini kullanir.
Fark, verinin nasil yasandigidir.

---

## Rooms Koridoru

Rooms sayfasi Scene Mode aktifken bir koridor gibi davranir.

Kurulu odalar burada:

- manifest icindeki `scene.roomsHotspot` alanindan kapisini alir
- aktif tema arka planina yansitilir
- tiklaninca ilgili room page'e goturur
- karakter roster'i ile AI1, AI2, kullanici veya US1 varligini gosterebilir

Yani odalar sisteme sonradan eklense bile sahneye bir hedef olarak
yerlestirilebilir.

---

## Oda Sahnesi

Bir oda acildiginda Scene Mode iki katman kurar:

1. Odanin genel sahnesi
2. Ana fonksiyonun yakin gorunumu

Genel sahnede oda arka plani, geri donus hedefi ve ana fonksiyon hotspot'lari
bulunur.

Bir ana fonksiyon secildiginde oda, yakin gorunume gecer.
Bu yakin gorunumde:

- `backgroundSrc` ana sahne gorselini verir
- `transparentWindow` runtime yuzeyinin sahnede nereye oturacagini belirler
- room runtime UI bu pencerenin icinde calisir
- geri hedefi kullaniciyi tekrar oda sahnesine dondurur

Bu sayede bir oyun tahtasi, laboratuvar paneli veya forge tezgahi yalnizca
HTML yuzeyi gibi degil, odanin icindeki fiziksel bir parca gibi davranir.

---

## Hotspot Mantigi

Scene Mode'da tiklanabilir alanlar dekor degildir.
Her hotspot bir kontrattir.

Bir hotspot:

- sahnedeki dikdortgen alanini bilir
- label metnini tasir
- hangi oda veya ana fonksiyona gittigini bilir
- debug/editor akisi icin kaynak manifest'e geri yazilabilir

Oda seviyesinde iki temel hotspot vardir:

- `roomsHotspot`: Rooms koridorundan odaya giris hedefi
- `backHotspot`: odadan koridora veya onceki sahneye donus hedefi

Ana fonksiyon seviyesinde ise `feature.scene.hotspot` ve
`feature.scene.view` birlikte calisir.

---

## Runtime ile Iliski

Scene Mode, room runtime'ini yeniden yazmaz.
Onu farkli bir sunum baglaminda calistirir.

Room runtime'a giden context icinde presentation bilgisi bulunur:

- `classic`: oda normal uygulama yuzeyi icinde calisir
- `scene-view`: oda yakin sahne penceresinde calisir

Bu bilgi sayesinde ayni ana fonksiyon:

- klasik modda daha genis panel duzeni kullanabilir
- scene-view modunda daha kompakt, sahneye gomulu bir layout kullanabilir

Game Room Tavla ve Team Tetris bu ayrimi kullanan orneklerdir.

---

## Sahne Debug ve Editor

Scene Mode'un gucu sadece son kullanici gorunumunde degil, duzenlenebilir
olmasindadir.

Scene debug/editor katmani:

- hotspot konumlarini duzenleyebilir
- karakter anchor'larini ayarlayabilir
- transparent window alanlarini kontrol edebilir
- sahne asset hedeflerini kaynak manifest'e geri tasiyabilir

Bu, oda ekleme surecinde onemlidir.
Cunku bir oda yalnizca kodla degil, sahnedeki yeriyle de tamamlanir.

---

## Kaynak Zinciri

Scene Mode'da source of truth room manifest'tir.

Tipik zincir su sekildedir:

manifest -> installed room record -> room page payload -> scene runtime -> room UI

Bu zincirde kayma olursa sahne dogru gorunse bile runtime yanlis baglam alabilir.
Bu yuzden oda veya ana fonksiyon eklerken sahne alanlari, runtime payload'i ve
UI presentation davranisi birlikte dusunulur.

---

## Neden Var?

Scene Mode'un amaci arayuzu suslemek degildir.

Amaci:

- Hayalet Ev'in oda fikrini hissedilir yapmak
- AI ve kullanici varligini ayni mekana yerlestirmek
- odalar arasinda zihinsel harita kurmak
- ana fonksiyonlari "ekran" yerine "nesne" gibi hissettirmek

Bu yuzden Scene Mode, Hayalet Ev'in atmosferik tarafi oldugu kadar mimari bir
katmanidir.

---

## Son Soz

Scene Mode acildiginda uygulama ayni uygulamadir.

Ama kullanma bicimi degisir.

Listeye bakmazsin.
Koridorda yurursun.

Butona basmazsin.
Bir seyin yanina gidersin.

Hayalet Ev'in ev gibi hissettigi yer burasidir.
