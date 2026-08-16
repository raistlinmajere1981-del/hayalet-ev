🧩 Pattern Room / İz Sürme Odası

Pattern Room, araştırma materyalini tek bir doğru cevaba dönüştürmek yerine nasıl bir sonuca ulaşıldığını görünür tutmak için tasarlanmış yerel-öncelikli Hayalet Ev odasıdır.

Kaynakları, kanıtları, iddiaları, yorumları, belirsizlikleri ve aralarındaki ilişkileri aynı araştırma çalışma alanında düzenler.

Durum: Prototype / evolving

Pattern Room işlevseldir ancak tamamlanmış veya bağımsız bir doğrulama ürünü olarak değerlendirilmemelidir.

🧭 Temel Yaklaşım

Pattern Room araştırma materyalini dört temel katmana ayırır:

Evidence / Kanıt

Doğrudan kaynak parçası, veri, gözlem veya seçilmiş materyal.

Analysis / Analiz

Mevcut materyalden türetilen temkinli çıkarım.

Interpretation / Yorum

Olası açıklama, senaryo veya anlamlandırma.

Uncertainty / Belirsizlik

Eksik, çelişkili, doğrulanmamış veya daha fazla bağlam gerektiren nokta.

Bu ayrım Pattern Room'un temel epistemik sınırıdır.

Bir yorum kanıt değildir.
Bir bağlantı doğrulama değildir.
Confidence doğruluk puanı değildir.
AI cevabı nihai karar değildir.

📂 Research Case

Her çalışma bir konu/vaka etrafında tutulur.

Case:

başlık
araştırma sorusu
kaynaklar
evidence
araştırma notları
belirsizlikler
bağlantılar
inceleme oturumları
rapor izleri

gibi parçaları aynı bağlama getirir.

🧭 Overview

Overview araştırmanın mevcut durumunu hızlı biçimde gösterir.

Kaynak, evidence, board note, relationship ve review gibi metrikler çalışma alanının durumunu anlamaya yardımcı olur.

🧩 Pattern Board

Pattern Board araştırma materyalinin ana çalışma yüzeyidir.

Öğeler evidence, analysis, interpretation veya uncertainty olarak tutulabilir.

Amaç:

Ham materyal ile ondan türetilen düşüncenin birbirine karışmasını engellemek.

📚 Source Archive

Araştırmaya eklenen kaynakların incelendiği alandır.

Mevcut source producer altyapısı:

kullanıcı kaynaklarını
yapıştırılmış metni
uzun metinleri

çalışma alanına alabilir.

Uzun metinler daha küçük segmentlere ayrılabilir.

Kaynak türleri arasında:

kitap
dini metin
gazete
altyazı arşivi
web arşivi
görsel materyal
Laboratory sonucu
sayı analizi
kişisel not
bilinmeyen kaynak

gibi sınıflar bulunabilir.

🔗 Relationship Graph

Araştırma nesneleri arasında açık ilişkiler kurulabilir.

Temel ilişki türleri:

supports
contradicts
references
derived_from
inspired_by
questions
needs_review

Bir relationship yalnızca iki nesne arasındaki kayıtlı ilişkiyi gösterir.

Tek başına doğrulama veya nedensellik kanıtı değildir.

👥 Case Review

Pattern Room farklı rollerin aynı araştırmayı sorgulamasına izin veren Case Review sistemi kullanır.

AI0 — Araştırmacı / Düzenleyici

Kaynakları, evidence parçalarını, bağlantıları ve açık soruları ayrıştırır.

AI1 — Savunucu / Güçlü Yorum Testçisi

Mevcut yorumun en güçlü savunulabilir biçimini test eder.

AI2 — 10. Adam

Varsayımları zorlar.

Alternatif açıklamalar, karşı argümanlar ve gözden kaçan sorular arar.

US1 — Hakem / Son Gözden Geçiren

İnsan veya uzak katılımcı olarak bulguları ve açık seçenekleri gözden geçirebilir.

Karar alanı kullanıcıda kalır.

📦 Case Packet

Review sırasında bütün araştırmanın kontrolsüz biçimde gönderilmesi yerine sınırlı bir Case Packet oluşturulur.

Packet:

mevcut observations
seçilmiş evidence
açık sorular
uncertainty
araştırma sınırları
ilgili identity'ler

taşıyabilir.

Case Packet doğrulanmış gerçeklerin listesi değildir.

🤖 AI Yanıtları

AI incelemeleri mümkün olduğunda yapılandırılmış Pattern Room formatında döner.

Kategoriler:

observation
evidence
analysis
counter argument
missing information
open questions
confidence notes

AI tarafından önerilen ilişkiler ancak bilinen Pattern Room nesneleriyle eşleştirilebildiğinde uygulanabilir.

🔄 Review Lifecycle

Review session'ları ayrı runtime state olarak takip edilir:

preview
→ dispatching
→ waiting-reply
→ ready
→ applied

Ayrıca:

failed
timed-out
cancelled

durumları bulunabilir.

Review geçmişi rol, istek, deneme, packet hash ve response hash gibi bilgiler taşıyabilir.

📊 Raporlama

Pattern Room araştırma durumundan okunabilir bir rapor oluşturabilir.

Rapor:

evidence
analysis
interpretation
uncertainty
açık sorular
araştırma izi

gibi katmanları birlikte gösterebilir.

Rapor:

doğrulanmış nihai sonuç değil, araştırma çalışma çıktısıdır.

💾 Kalıcılık

Pattern Room snapshot tabanlı persistence kullanır.

Temel işlemler:

save
load
list
delete

Snapshot migration katmanı eski kayıtların açılabilmesini destekler.

Mutable araştırma verisi source tree içinde tutulmaz.

Hedef storage:

data/room-storage/pattern-room
🧱 Dizin Yapısı
rooms/pattern-room/
├── manifest.json
├── host/
├── i18n/
├── protocols/
├── shared/
│   ├── adapters/
│   ├── assets/
│   ├── data/
│   ├── source-producers/
│   ├── source-workbench/
│   ├── state/
│   └── types/
└── ui/
    └── panels/
🧭 Room Sınırı

Pattern Room bir Hayalet Ev odasıdır.

Core uygulamasının içine gömülmüş ikinci bir uygulama değildir.

Room implementation mümkün olduğunca:

rooms/pattern-room

sınırında tutulur.

Core implementasyonlarına doğrudan import yerine desteklenen:

room command
host API
protocol
SlotBridge

sınırları kullanılır.

📦 Paketleme

Dağıtılabilir room formatı:

.hevroom

Mutable araştırma verisi room paketinin parçası değildir.

✅ Validation
npm run rooms:typecheck
npm run rooms:test:core
npm run deps:check
npm run rooms:build
npm run check:all
🎯 Geliştirme İlkeleri
Room implementasyonunu rooms/pattern-room sınırında tut.
Core implementation'larını doğrudan import etme.
Evidence, analysis, interpretation ve uncertainty katmanlarını ayır.
Confidence değerlerini doğruluk puanı olarak kullanma.
AI bilgisini kullanıcı kaynağı veya doğrulanmış kanıt gibi gösterme.
Relationship contract'ını yeni ilişki türleriyle birlikte güncelle.
Protocol değişikliklerinde parser, types ve regression testlerini birlikte güncelle.
Snapshot değişikliklerinde migration yolunu koru.
