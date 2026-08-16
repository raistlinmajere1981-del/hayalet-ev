👻 Hayalet Ev

Hayalet Ev bir uygulama değil.

Bir masa, bir alan, bir akış.

İnsan ve yapay zekânın yalnızca konuştuğu değil; birlikte düşündüğü, tartıştığı, araştırdığı, ürettiği, onardığı ve oyun kurduğu yerel bir dijital ortam.

Hayalet Ev'in temel fikri basit:

AI'lar yalnızca kullanılan araçlar değil, aynı çalışma alanını paylaşan katılımcılardır.

Bu fikir, uygulamanın yalnızca sohbet ekranını değil; odalarını, hafızasını, oyunlarını, araştırma akışlarını ve mimarisini belirler.

🧠 Hayalet Ev Nedir?

Hayalet Ev, local-first çalışan çok-ajanlı bir çalışma ortamıdır.

Burada farklı AI slotları, insan kullanıcı ve desteklenen uzak kullanıcılar aynı çalışma bağlamının parçaları olabilir.

AI1 / AI2 — aynı probleme farklı zihinlerden bakabilen AI katılımcıları
AI0 — yerel araçlara, hafızaya ve çalışma akışlarına erişebilen yardımcı katman
US1 — desteklenen akışlarda başka bir Hayalet Ev kullanıcısına açılan uzak katılımcı
USER — sistemin dışında duran bir operatör değil, çalışma ortamının doğrudan katılımcısı

Slotların amacı belirli bir AI ürününü merkeze koymak değildir.

Amaç, farklı zihinlerin aynı bağlam üzerinde çalışabilmesini sağlamaktır.

🌒 Neden Var?

Klasik AI kullanımı çoğunlukla şöyle çalışır:

insan → prompt → AI → cevap

Hayalet Ev bu akışın yeterli olmadığı düşüncesinden doğdu.

Gerçek bir çalışma çoğu zaman tek bir cevaptan oluşmaz.

Bir fikir ortaya çıkar.
Bir başkası onu sorgular.
Başka bir kaynak bulunur.
Bir ölçüm yapılır.
Bir çelişki ortaya çıkar.
Bir karar verilir.
Sonuç başka bir çalışmaya aktarılır.

Hayalet Ev bu süreci tek tek sohbet pencerelerine bölmek yerine aynı ortamda tutmaya çalışır.

insan
  ↕
AI1 ↔ AI2
  ↕
çalışma alanı
  ↕
kaynaklar / ölçümler / oyunlar / araçlar / hafıza

Bu yüzden Hayalet Ev'in asıl ürünü bir chatbot değildir.

Çalışma ortamıdır.

🏠 Ev Fikri

“Hayalet Ev” yalnızca görsel bir metafor değildir.

Uygulamanın yapısı gerçekten bir ev fikrini takip eder:

Entrance — giriş
Analyze — ortak masa
Rooms — uzmanlaşmış çalışma alanları
Archives — hafıza

Odalar yalnızca uygulama sayfaları değildir.

Her biri belirli bir iş için kurulmuş çalışma alanıdır.

Laboratory'de medya incelenir.
Forge Room'da fikirler iş paketlerine dönüştürülür.
Repair Room'da fiziksel cihazlarla çalışılır.
Pattern Room'da araştırma ve belirsizlikler düzenlenir.
Game Room'da insanlar ve AI'lar aynı oyun kurallarına girer.

Scene Mode ise bu odaları gerçekten bir mekânın parçaları gibi yaşatır.

Listeye bakmak yerine evin içinde dolaşabilirsin.

✨ Bugün Neler Yapabiliyor?

Güncel main dalında Hayalet Ev yalnızca çoklu-AI sohbeti değildir.

Ana çalışma yüzeyleri:

AI1, AI2, AI0 ve desteklenen US1 akışları arasında slot tabanlı çalışma
kalıcı konuşma ve çalışma bağlamları için Archive sistemi
bağımsız geliştirilebilen ve .hevroom olarak paketlenebilen Room mimarisi
medya, görüntü ve ses inceleme/analizi için Laboratory
fikirleri görev, cevap, çelişki ve sentez akışına dönüştüren Forge Room
elektronik onarım oturumlarını evidence, ölçüm, kamera ve AI desteğiyle birleştiren Repair Room
AI ve uzak kullanıcılarla oynanabilen Game Room
araştırma materyalini evidence, analysis, interpretation ve uncertainty katmanlarında düzenleyen Pattern Room
odaları fiziksel bir mekân gibi sunan Scene Mode
kamera, capture ve yerel konuşma özellikleri için Android Companion
yerel araçlara ve masaüstü iş akışlarına erişim sağlayan MCP tabanlı yardımcı servisler

Bazı özellikler FFmpeg, model dosyaları, Android/ADB veya harici AI servisleri gibi ek sistem bileşenleri gerektirebilir.

README uygulanmış çalışma yüzeyini özetler; özelliklerin ayrıntılı sınırları ilgili oda belgelerinde bulunur.

🚪 Yerleşik Odalar

Oda	Durum	Rolü
Laboratory	Uygulanmış	Medya ve ses kaynaklarını hazırlamak, incelemek, analiz etmek ve bulguları raporlamak
Forge Room	Uygulanmış	Belirsiz hedefleri uygulanabilir iş paketlerine dönüştürmek
Repair Room	Uygulanmış	Fiziksel elektronik onarım sürecini AI, evidence ve gerçek ölçümlerle aynı oturumda tutmak
Game Room	Uygulanmış / gelişiyor	İnsan, AI ve uzak kullanıcıları ortak oyun kurallarında buluşturmak
Pattern Room	Prototip / gelişiyor	Kaynak, kanıt, yorum, çelişki ve belirsizlikleri araştırma bağlamında düzenlemek

Ayrıntılar: rooms/README.md.

🧪 Laboratory

Laboratory bir medya oynatıcı değildir.

Bir çalışma kaynağını projeye alır, gerekli araçları ve modelleri kontrol eder, medya veya sesi işler, insan incelemesine açar, annotation ve karşılaştırma imkânı sağlar ve sonuçları tekrar kullanılabilir bir çalışma bağlamında tutar.

Temel akış:

Kaynak
  ↓
Hazırlık
  ↓
İnceleme
  ↓
Analiz
  ↓
Karşılaştırma / Annotation
  ↓
Rapor / Export
  ↓
AI ile devam

Detay: LABORATORY.md.

🔥 Forge Room

Forge Room bir chat ekranı değildir.

Belirsiz bir hedefi alır ve onu:

hedef
  ↓
preflight
  ↓
görev taslağı
  ↓
AI assignment
  ↓
yanıtlar
  ↓
çelişkiler
  ↓
sentez
  ↓
handoff

akışına dönüştürür.

AI cevaplarını nihai karar olarak değil, üretim sürecinin parçaları olarak ele alır.

Detay: FORGEROOM.md.

🔧 Repair Room

Repair Room elektronik onarım için proje tabanlı bir çalışma tezgâhıdır.

Cihaz bilgisi, semptomlar, riskler, evidence, schematic/datasheet kaynakları, PCB görüntüsü, ölçümler, annotation, timeline, AI sohbeti ve kamera akışları aynı repair session içinde tutulabilir.

Temel ilke:

AI önerir, ölçüm doğrular, operatör karar verir; session bütün izi saklar.

Detay: rooms/repair-room/README.md.

🎮 Game Room

Game Room AI'yı yalnızca oyun hakkında konuşan bir yardımcı olmaktan çıkarıp oyunun kurallarına tabi bir katılımcı haline getirir.

Tavla

Kullanıcı AI1, AI2 veya desteklenen US1 uzak kullanıcısıyla oynayabilir.

Legal hamleler host tarafından hesaplanır. AI kendi hamlesini icat etmez; geçerli hamleler arasından seçim yapar.

Team Tetris

USER, AI1, AI2 ve US1 dört koltuklu bir takım oyununda aynı motorun içinde yer alabilir.

Hidden pair yapısı ve path tabanlı hamleler oyunun mevcut çekirdeğinin parçasıdır.

Detaylar:

FORGEROOM.md

🧩 Pattern Room

Pattern Room araştırmayı tek bir “doğru cevap” üretme sürecine indirgemez.

Araştırma materyalini:

Evidence
Analysis
Interpretation
Uncertainty

katmanlarına ayırır.

Bir yorum kanıt değildir.
Bir bağlantı doğrulama değildir.
Bir confidence değeri doğruluk puanı değildir.
Bir AI cevabı nihai karar değildir.

Pattern Room'un amacı araştırmayı kesinleştirmekten önce araştırmanın nasıl yapıldığını görünür tutmaktır.

Detay: PATTERNROOM.md.

🎭 Scene Mode

Scene Mode, odaları menü veya kart listesinden çıkarıp Hayalet Ev'in fiziksel mekânına yerleştirir.

Klasik modda bir oda açılır.

Scene Mode'da ise:

Bir odaya gidilir.

Koridorlar, kapılar, masalar, hotspot'lar ve yakın görünümler aynı sahne içinde çalışır.

Bir oda açıldığında ana fonksiyonları da sahnedeki fiziksel nesneler gibi konumlandırılabilir.

Scene Mode yalnızca görsel bir tema değildir.

Hayalet Ev'in “ev” fikrini kullanıcı deneyimine taşıyan katmandır.

Detay: SCENEMODE.md.

🧩 Slot Sistemi

Evde herkesin bir yeri vardır.

AI1 / AI2 — farklı AI katılımcıları
AI0 — yerel yardımcı katman
US1 — uzak kullanıcı
USER — çalışma ortamının insan katılımcısı

Slot sistemi belirli bir AI sağlayıcısına bağımlı olmak için değil, katılımcıları çalışma akışlarından ayırmak için kullanılır.

Böylece bir oda:

“Şu AI ile konuş”

demek yerine:

“Bu rolü bu katılımcıya ver”

diyebilir.

🔄 Akış

Hayalet Ev'de konuşma tek başına son ürün değildir.

Bir konuşma başka bir şeye dönüşebilir:

konuşma → analiz → karar
fikir → görevler → sentez
medya → inceleme → rapor
onarım → evidence → ölçüm → bulgu
oyun → hamle → durum → sonuç
mesaj → relay → yeni bağlam

Bu nedenle çalışma nesneleri ve session'lar önemlidir.

Bir iş yalnızca ekranda görünür olduğu sürece değil, tekrar açılabildiği ve bağlamıyla birlikte devam ettirilebildiği sürece yaşar.

🧠 Hafıza

Archive sistemi konuşmaları ve çalışma bağlamlarını saklar.

Amaç yalnızca log tutmak değildir.

Bir çalışmanın geçmişte ne söylendiğini, hangi bağlamdan geldiğini ve gerektiğinde nereden devam edilebileceğini korumaktır.

Hafıza, geçmiş mesajların deposundan çok biriken çalışma alanıdır.

📱 Android Companion

android-companion/, masaüstü Hayalet Ev ile birlikte çalışan yerel Android yardımcı uygulamasıdır.

Güncel akışlarda:

kamera preview
masaüstünden capture/command
yerel wake-word algılama
çevrimdışı transcription
desteklenen Analyze/Repair akışlarına fotoğraf ve transcript aktarımı
companion install/update kontrolü

kullanılabilir.

Detay: ANDROIDCOMPANION.md.

🧱 Room Mimarisi

Oda kaynakları rooms/<room-id> altında kendi:

manifest
UI
host runtime
protocol
i18n
asset

katmanlarıyla yaşar.

Temel kural:

Core odaları keşfeder ve çalıştırır; oda kendi iş alanını sahiplenir.

Room kodu mümkün olduğunca core implementasyon ayrıntılarına bağlanmaz.

Dağıtılabilir oda formatı .hevroom'dur.

Kaynak/runtime/storage ayrımı için rooms/README.md.

🤖 Assistant / AI0

AI0, Hayalet Ev'in yerel yardımcı katmanıdır.

Araçlara erişebilir, oda protokollerinde görev alabilir ve gerektiğinde çalışma bağlamı veya hafıza üzerinden devreye girebilir.

AI0 her zaman konuşmaz; gerektiğinde hazırdır.

🌐 US1

US1 başka bir Hayalet Ev kullanıcısına açılan bağlantıdır.

Desteklenen akışlarda uzak kullanıcı:

mesajlaşabilir,
oyunlara katılabilir,
ortak çalışma bağlamının bir parçası olabilir.

Game Room'daki Tavla ve Team Tetris bunun doğrudan örnekleridir.

Bağlantı ve güvenlik davranışları SECURITY.md kapsamında ele alınır.

⚙️ Mimari

Hayalet Ev'in temel teknik yapısı:

Electron
Vite
TypeScript
local-first veri yapısı
slot tabanlı AI bağlantısı
MCP araçları
Room tabanlı genişleme mimarisi
Android Companion
oda sınırlarında yönetilen medya/model/tool bağımlılıkları

Mimari ayrıntılar rooms/README.md ve geliştirme belgelerinde açıklanır.

🚀 Geliştirici Başlangıcı

Gereksinimler:

Node.js 22+
npm 10+
npm ci
npm run electron:dev

Tam kalite kapısı:

npm run check:all

Bazı medya, otomasyon, Android ve paketleme özellikleri ek sistem araçları gerektirebilir.

📚 Belgeler

ONBOARDING.md — ilk kullanım
LABORATORY.md — Laboratory
FORGEROOM.md — Forge Room
BACKGAMMON.md — Tavla
TEAM-TETRIS.md — Team Tetris
PATTERNROOM.md — Pattern Room
SCENEMODE.md — Scene Mode
rooms/README.md — Room mimarisi
rooms/repair-room/README.md — Repair Room
android-companion/README.md — Android Companion
CONTRIBUTING.md — katkı kuralları
PACKAGING.md — paketleme
SECURITY.md — güvenlik
THIRD_PARTY_NOTICES.md — üçüncü taraf materyaller

🧬 Çalışma Biçimi

Hayalet Ev yalnızca kod deposu değildir.

AGENTS.md ve .rovo/ belgeleri mimari sınırları, geliştirme yöntemlerini ve AI destekli çalışma sırasında korunacak kararları tanımlar.

Bu belgeler projenin nasıl geliştirileceğini anlatır.

README ise neden böyle bir şey yapıldığını anlatır.

🎯 Amaç

Hayalet Ev'in uzun vadeli amacı:

tek bir AI sağlayıcısına bağımlı olmayan,
farklı AI'ların aynı çalışma alanında birlikte bulunabilmesini sağlayan,
yerel araçlarla çalışabilen,
geliştirilebilir ve paylaşılabilir,
insan, AI ve uzak katılımcıları ortak çalışma akışlarında buluşturan

açık bir dijital çalışma ortamı oluşturmaktır.

📄 Lisans

Hayalet Ev kaynak kodu MIT Lisansı altında sunulur.

Kullanabilir, değiştirebilir, dağıtabilir ve kendi projelerinde değerlendirebilirsin; MIT lisans ve telif bildirimlerinin korunması gerekir.

Projede kullanılan üçüncü taraf bağımlılıklar, modeller, ikonlar veya diğer harici varlıklar kendi lisans ve kaynak bildirimlerine tabidir.

🧠 Son Söz

Hayalet Ev'i bir uygulama gibi kullanabilirsin.

Ama fikir biraz daha farklıdır.

Bir konu geldiğinde konuşursun.
Bir sorun çıktığında doğru odaya götürürsün.
Bir araştırma gerektiğinde kaynakları masaya koyarsın.
Bir iş yapılacaksa parçalara ayırırsın.
Bir cihaz bozulduğunda ölçer ve kaydedersin.
Bir oyun açıldığında aynı kurallara girersin.

AI cevap verir.

Başka bir AI itiraz eder.

İnsan ölçer, seçer, değiştirir veya reddeder.

Ve bütün bunlar aynı yerde kalır.

Hayalet Ev, AI kullanmak için yapılmış bir uygulama değil; insan ve AI'ların birlikte çalışabileceği bir dijital ortam denemesidir.
