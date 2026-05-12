# Forge Room

Forge Room, Hayalet Ev icinde fikirleri uygulanabilir is paketlerine donusturen
uretim odasidir.

Bir hedefi alip onu dogrudan "yap" komutuna cevirmek yerine once sekillendirir:

- hedefi kaydeder
- baglami kontrol eder
- gorev taslagi uretir
- rollere dagitir
- cevaplari toplar
- celiskileri gorunur kilar
- tek bir senteze indirir
- gerekirse hedef odaya devir paketi uretir

Bu yuzden Forge Room bir chat ekrani degildir.
Bir karar ve uretim tezgahidir.

---

## Temel Fikir

Bir iste en zor kisim her zaman yapmak degildir.
Bazen asil zorluk, neyin yapilacagini dogru parcalara ayirmaktir.

Forge Room bu ara bolge icin vardir.

Kullanicinin elindeki hedef henuz belirsiz olabilir.
AI'lar farkli yaklasimlar onerebilir.
Hangi cevap daha iyi, hangi risk gercek, hangi adim once gelmeli sorulari
hemen net olmayabilir.

Forge bu belirsizligi tek bir akisa sokar.

---

## Forge Workbench

Odanin ana fonksiyonu `forge-workbench`tir.

Workbench, koordinatorden bakar.
Yani amaci her seyi tek AI'ya yaptirmak degil, isi yonetilebilir hale
getirmektir.

Temel akisi:

1. oturum olustur veya yukle
2. hedefi tanimla
3. operator baglamini sec
4. preflight calistir
5. taslak gorev dagilimi uret
6. taslagi duzenle ve onayla
7. gorevleri slotlara dagit
8. yanitlari ve celiskileri incele
9. sentez uret
10. devir paketini disari aktar

Bu akis lineer gibi gorunur, ama her adim onceki karari koruyarak ilerler.

---

## Oturum Mantigi

Forge Room her calismayi bir oturum olarak saklar.

Oturum icinde:

- hedef
- taslak gorevler
- onayli gorevler
- assignment kayitlari
- AI yanitlari
- celiskiler
- sentezler
- secili sentez
- export kayitlari
- karar izi
- preflight durumu

birlikte tutulur.

Bu sayede uretim bir mesaj dizisi olarak kaybolmaz.
Kaydedilebilir, yuklenebilir ve kaldigi yerden surdurulebilir bir is parcasina
donusur.

---

## Hedef

Forge hedefi yalnizca bir baslik degildir.

Hedefte su bilgiler beklenir:

- kisa ozet
- detayli brief
- kisitlar
- kabul kriterleri
- hedef room id

Hedef room id onemlidir.
Cunku Forge'un urettigi sonuc bazen baska bir odaya devredilecek sekilde
paketlenir.

Ornegin bir fikir Game Room, Laboratory veya Repair Room icin hazirlanabilir.

---

## Operator Baglami

Forge, kullaniciyi bos bir soyut aktor gibi varsaymaz.

Operator profili ve run-local secimler ile sunlari hesaba katabilir:

- kullanicinin beceri seviyesi
- mevcut ekipman
- calisma tercihi
- risk toleransi
- gecici kosullar
- bu calismaya ozel notlar

Bu bilgiler her zaman zorunlu degildir.
Ama secildiginde AI'ya giden baglami etkiler.

Amac, "mukemmel teorik plan" yerine uygulanabilir plan uretmektir.

---

## Preflight

Preflight, Forge'un ilk ciddi kontrol noktasidir.

Bir hedef kaydedildikten sonra sistem:

- operator baglamina bakar
- kisitlari okur
- hedef oda baglamini toplar
- run signature ve context digest uretir
- gerekirse AI0 pre-analysis isteyebilir

Preflight bir plan degildir.
Bir gozlemdir.

Eksik bilgi, uyari veya baglam riski varsa bunlari erken gorunur yapar.

Forge'da preflight tazelik bilgisi onemlidir.
Hedef, operator profili veya run override degisirse eski preflight stale hale
gelebilir.
Bu durumda sonraki AI asamalari eski baglamla devam etmez.

---

## Taslak Gorev Dagilimi

Draft asamasinda Forge, hedefi 3 ile 7 arasinda top-level goreve boler.

Bu taslak:

- uygulanabilir gorevler icermelidir
- gerekirse checklist alt adimlari tasiyabilir
- hedef room'a devir icin fazla genislememelidir
- kabul kriterleriyle uyumlu olmalidir

Taslak AI tarafindan uretilebilir.
Ama kullanici tarafindan duzenlenebilir.

Forge burada AI ciktisini kutsal kabul etmez.
Dogru is paketine gelene kadar taslak elle temizlenebilir.

---

## Onay ve Dagitim

Taslak onaylandiginda gorevler assignment kuyruguna donusur.

Her gorev:

- tek bir seat'e verilebilir
- karsilastirma modunda birden fazla seat'e gonderilebilir
- role ve persona bilgisiyle zenginlestirilebilir
- context capsule ile daha dar baglam alabilir

Seat'ler AI1, AI2 veya ileride uygun olan diger slotlar olabilir.

Burada Forge'un gucu ortaya cikar:
ayni hedef farkli zihinlerden cevap alabilir.

---

## Yanitlar ve Celiskiler

Assignment cevaplari JSON kontratiyla yakalanir.

Her cevap:

- ozet
- govde
- artifact referanslari
- archive ref
- gorev baglantisi

tasir.

Birden fazla cevap ayni goreve geldiginde Forge celiskileri gruplayabilir:

- yaklasim celiskisi
- kapsam celiskisi
- risk celiskisi
- sira / oncelik celiskisi

Celiski hata degildir.
Forge icin celiski, karar verilmesi gereken yerdir.

Kullanici veya koordinasyon katmani bir cevabi tercih edebilir, not ekleyebilir
ve celiskiyi cozulmus hale getirebilir.

---

## Sentez

Sentez, Forge'un "artik tek cevap gerekiyor" dedigi asamadir.

Sentez uretimi:

- tamamlanan yanitlari okur
- cozulmus celiskileri dikkate alir
- secili cevaplari one alir
- kabul kriterlerini netlestirir
- acik sorulari sadece deger katiyorsa tutar

Sentez, tum cevaplarin ham birlestirmesi degildir.
Asagi akisa en uygun tek sonuc adayidir.

Bir sentez secildiginde export icin aday hale gelir.

---

## Handoff / Devir Paketi

Forge Room'un en onemli cikislarindan biri handoff paketidir.

Bu paket hedef odaya veya sonraki calisma akisine sunlari tasir:

- hedef ozeti
- brief
- kisitlar
- gorev grafigi
- secili sentez
- celiski kayitlari
- acik sorular
- kabul kriterleri
- repo referanslari
- artifact referanslari
- karar izi
- preflight uyarilari

Boylece Forge'da uretilen is, baska bir odaya yalnizca metin olarak degil,
baglamli bir paket olarak devredilir.

---

## Roller

Forge Room icinde roller isi daha okunur hale getirir.

Baslica roller:

- Architect: ilk gorev dagilimini kurar
- Challenger: varsayimlari zorlar
- External Perspective: dis bakis getirir
- Coordinator: akisi, karar izini ve cikisi toparlar

Bu roller insan karakteri gibi degil, uretim sorumlulugu gibi dusunulur.

---

## Neden Var?

Hayalet Ev'de birden fazla AI olmasi tek basina yeterli degildir.

Birden fazla AI:

- ayni seyi tekrarlayabilir
- farkli yonlere dagilabilir
- guzel ama uygulanamaz cevaplar uretebilir
- karar yukunu kullaniciya geri yikabilir

Forge Room bu daginikligi islenebilir hale getirmek icin vardir.

AI cevaplarini bir fikir yagmuru olarak degil, bir uretim hattinin parcasi
olarak ele alir.

---

## Son Soz

Forge Room'un sorusu "bunu kim yapacak?" degildir.

Daha once sunu sorar:

> Bu is gercekte hangi parcalardan olusuyor?

Sonra cevaplari toplar.
Celiskileri yuzeye cikarir.
Karari daraltir.
Ve sonunda isi baska bir yere tasinabilir hale getirir.

Forge'un adi buradan gelir:

ham fikir burada isinir,
sekil alir,
ve elde tutulabilir bir is paketine donusur.
