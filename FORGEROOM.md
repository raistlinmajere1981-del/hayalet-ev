🔥 Forge Room

Forge Room, Hayalet Ev içinde ham fikirleri uygulanabilir işlere dönüştüren üretim odasıdır.

Bir hedefi doğrudan “yap” komutuna çevirmek yerine önce onun ne olduğunu anlamaya, parçalamaya ve farklı zihinlerin değerlendirmesine açar.

Temel akış:

Hedef
 ↓
Preflight
 ↓
Görev taslağı
 ↓
Assignment
 ↓
Yanıtlar
 ↓
Çelişkiler
 ↓
Sentez
 ↓
Handoff

Forge Room'un temel fikri:

Birden fazla AI'ya cevap sordurmak yeterli değildir. Onları aynı işin farklı parçalarına yerleştirmek gerekir.

🧱 Forge Workbench

Ana özellik:

forge-workbench

Workbench bir koordinasyon yüzeyidir.

Temel akış:

oturum oluştur veya yükle
hedefi tanımla
operator bağlamını seç
preflight çalıştır
görev taslağı oluştur
taslağı düzenle
onayla
görevleri slotlara dağıt
yanıtları incele
çelişkileri ele al
sentez oluştur
handoff üret

Bu akış gerektiğinde geri dönülebilir bir çalışma zinciri olarak ele alınır.

🧠 Oturum

Forge her çalışmayı bir session olarak saklar.

Session içinde:

hedef
brief
kısıtlar
kabul kriterleri
görevler
assignments
AI yanıtları
çelişkiler
sentezler
seçili sentez
export
karar izi
preflight durumu

tutulabilir.

Böylece üretim bir mesaj dizisi olarak kaybolmaz.

🎯 Hedef

Hedef yalnızca başlık değildir.

Hedef:

kısa özet
detaylı brief
kısıtlar
kabul kriterleri
hedef room id

gibi bilgiler taşıyabilir.

Hedef room id, üretilen çalışmanın daha sonra başka bir odaya aktarılabilmesini sağlar.

👤 Operator Context

Forge kullanıcının gerçek çalışma koşullarını hesaba katabilir.

Örneğin:

beceri seviyesi
mevcut ekipman
çalışma tercihi
risk toleransı
geçici koşullar
run-local notlar

AI'ya giden bağlamı etkileyebilir.

Amaç teorik olarak kusursuz bir plan değil:

uygulanabilir bir plan üretmektir.

🔎 Preflight

Preflight plan değildir.

Bir hedefin çalışılabilir durumunu anlamaya yarayan erken kontrol aşamasıdır.

Şunları inceleyebilir:

operator context
kısıtlar
hedef oda
run signature
context digest
eksik bilgi
bağlam riskleri

Hedef veya çalışma bağlamı değişirse eski preflight stale hale gelebilir.

Bu sayede sonraki aşamalar eski bağlama körü körüne devam etmez.

🧩 Görev Taslağı

Forge hedefi 3–7 arasında top-level göreve ayırabilir.

Görevler:

uygulanabilir
kabul kriterleriyle ilişkili
hedef room'a uygun
gerektiğinde alt adımlara bölünebilir

olmalıdır.

Taslak AI tarafından üretilebilir.

Ama kullanıcı tarafından düzenlenebilir.

Bu ayrım Forge için önemlidir:

AI taslak üretir; işin ne olduğuna insan karar verir.

🪑 Assignment

Onaylanan görevler assignment'lara dönüşür.

Bir görev:

tek seat'e
karşılaştırma için birden fazla seat'e
belirli role/persona bilgisiyle
daraltılmış context capsule ile

gönderilebilir.

Böylece farklı AI katılımcıları aynı hedefe farklı açılardan yaklaşabilir.

⚖️ Yanıtlar ve Çelişkiler

Assignment cevapları yapılandırılmış biçimde yakalanır.

Birden fazla cevap geldiğinde Forge bunlar arasındaki farklılıkları görünür hale getirebilir:

yaklaşım
kapsam
risk
sıra/öncelik

çelişkileri.

Forge için çelişki hata değildir.

Çelişki, karar verilmesi gereken yerdir.

🧠 Sentez

Sentez, artık aşağı akış için daha dar bir sonuç gerektiğinde oluşturulur.

Sentez:

tamamlanan yanıtları
çözülmüş çelişkileri
seçilmiş cevapları
kabul kriterlerini
gerekli açık soruları

birlikte değerlendirir.

Sentez bütün cevapların mekanik birleşimi değildir.

Bir sonraki aşama için en kullanışlı sonuç adayıdır.

📦 Handoff

Forge'un önemli çıktılarından biri handoff paketidir.

Paket:

hedef özeti
brief
kısıtlar
görev grafiği
seçili sentez
çelişkiler
açık sorular
kabul kriterleri
repo referansları
artifact referansları
karar izi
preflight uyarıları

taşıyabilir.

Böylece bir odada yapılan çalışma başka bir odaya yalnızca metin olarak değil, bağlamıyla aktarılabilir.

🎭 Roller

Forge içinde roller üretim sorumluluğunu temsil eder:

Architect — ilk görev dağılımını kurar
Challenger — varsayımları zorlar
External Perspective — farklı bakış getirir
Coordinator — akışı ve karar izini toparlar

Bunlar insan karakterleri değil, çalışma rolleridir.

🧭 Neden Var?

Birden fazla AI'nın aynı ortamda bulunması tek başına işbirliği yaratmaz.

AI'lar:

aynı şeyi tekrar edebilir
farklı yönlere dağılabilir
uygulanamaz çözümler önerebilir
karar yükünü kullanıcıya geri bırakabilir

Forge Room bu dağınıklığı bir üretim akışına dönüştürmek için vardır.

🎯 Amaç

Forge'un sorusu:

“Bunu hangi AI yapacak?”

değildir.

Önce şunu sorar:

“Bu iş gerçekte hangi parçalardan oluşuyor?”

Sonra farklı zihinleri o parçaların etrafına yerleştirir.

Cevapları toplar.
Çelişkileri gösterir.
Sentezler.
Ve işi başka bir yere taşınabilir hale getirir.
