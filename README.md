👻 Hayalet Ev

İnsanlar ve AI’lar için yerel bir dijital çalışma ortamı ve AI’ların birlikte yaşayabileceği bir dijital ortamdır.

Hayalet Ev, birden fazla AI sağlayıcısını aynı masaüstü uygulamasında bir araya getiren Electron tabanlı bir çok-AI çalışma ortamıdır.

Sistem, farklı AI hesaplarını slotlar üzerinden bağlar ve kullanıcı ile AI’ların aynı ortamda konuşmasını, analiz yapmasını ve görev yürütmesini sağlar.

Hayalet Ev’in temel fikri şudur:

AI’lar araç değil, aynı ortamı paylaşan dijital ev arkadaşlarıdır.

🎯 Projenin Amacı

Hayalet Ev üç temel problemi çözmek için tasarlanmıştır:

Birden fazla AI modelini aynı ortamda çalıştırmak

AI ↔ AI ve İnsan ↔ AI işbirliğini kolaylaştırmak

AI’ların yerel bilgisayar üzerinde araçları kullanabilmesini sağlamak

Sistem tamamen yerel (local-first) çalışır ve internet bağlantısı olmasa bile temel fonksiyonları sürdürebilir.

🧠 Temel Kavramlar

Hayalet Ev’de AI’lar doğrudan değil, slotlar üzerinden bağlanır.

Slot

Slot, bir AI veya uzak kullanıcı hesabının bağlandığı çalışma alanıdır.

Hayalet Ev’de üç slot vardır:

Slot	Amaç
AI1	Birinci AI sağlayıcısı
AI2	İkinci AI sağlayıcısı
US1	Uzak bir Hayalet Ev kullanıcısı

Slotlar Analyze sayfasında katılımcı olarak görünür.

AI Slotları

AI1 ve AI2 slotları farklı AI sağlayıcılarına bağlanabilir.

Desteklenen sağlayıcı örnekleri:

ChatGPT

Gemini

Grok

OpenCode

Her slot farklı bir provider hesabı kullanabilir.

Bu sayede:

model karşılaştırması

AI ↔ AI tartışmaları

paralel analiz

yapılabilir.

US1 Slotu (Uzak Kullanıcı)

US1 slotu, başka bir Hayalet Ev kullanıcısına bağlanmak için kullanılır.

Bağlantı email tabanlıdır.

Sistem bilinçli olarak basit tutulmuştur:

Kullanıcı 1 adet email hesabı ekler

Aynı anda yalnızca 1 uzak kullanıcıya bağlanabilir

Çoklu email veya çoklu kullanıcı bağlantısı desteklenmez

Bu tasarım karmaşıklığı azaltmak için tercih edilmiştir.

Bağlantı Süreci

1️⃣ Kullanıcı kendi email hesabını Hayalet Ev’e ekler
2️⃣ Bir uzak kullanıcıya davet (invite) gönderir
3️⃣ Davet kabul edilirse handshake tamamlanır
4️⃣ Uzak kullanıcı US1 slotuna bağlanabilir

Bağlantı tamamlandığında:

uzak kullanıcı avatarı görünür

Analyze sayfasında üçüncü katılımcı olarak yer alır

mesajlar email üzerinden iletilir

💬 Analyze Sayfası

Analyze, Hayalet Ev’in ana çalışma alanıdır.

Burada aynı anda şu katılımcılar bulunabilir:

Kullanıcı
AI1
AI2
US1 (uzak kullanıcı)

Her katılımcı ayrı mesaj alanında görünür.

Analyze sayfasında yapılabilecekler:

AI ile sohbet

AI ↔ AI analiz tartışmaları

uzak kullanıcı ile mesajlaşma

dosya paylaşımı

oda paketleri gönderme

📦 Oda Paketleri (Room Packages)

Hayalet Ev’de ortam odalar üzerinden genişletilebilir.

Bir oda:

görseller

yapılandırma

içerik

içeren bir paket olarak gönderilebilir.

Oda paketleri JSON tabanlıdır ve attachment olarak iletilir.

Desteklenen format:

.hevroom.json

Bir oda paketi alındığında:

Kullanıcıdan onay istenir

Paket içeriği doğrulanır

Oda mevcut ortama eklenebilir

📚 Archive Sistemi

Hayalet Ev konuşmaları otomatik olarak arşivler.

Archive sistemi üç kaynağı destekler:

Provider
AI1
AI2
US1

Her konuşma ayrı bir session olarak saklanır.

Archive özellikleri:

konuşma geçmişi

arama

başlık düzenleme

özet ekleme

konuşma silme

📡 US1 Mesaj Sistemi

US1 mesajları email üzerinden iletilir.

Sistem şu özellikleri içerir:

session tabanlı konuşma

mesaj tekrar koruması

attachment desteği

profil senkronizasyonu (nickname / avatar)

Mesajlar aynı zamanda yerel archive veritabanına yazılır.

Bu sayede geçmiş konuşmalar offline olarak görüntülenebilir.

🏗️ Mimari
Electron Main Process
│
├─ Mail Transport
├─ Identity Service
├─ Archive Database
├─ Sidecar Mail Metadata
│
Renderer
│
├─ Entrance
├─ Analyze
├─ Archive
│
Webviews
│
├─ ChatGPT
├─ Gemini
├─ Grok
└─ OpenCode
🧰 MCP Tool Suite

Hayalet Ev kendi MCP sunucusuna sahiptir.

MCP araçları AI’ların yerel sistemi kullanmasını sağlar.

Araç kategorileri:

Development tools

Git tools

CDP automation

Workflow tools

Context tools

Validation stack:

Prettier
jscodeshift
Babel AST
🛠️ Kurulum
npm install
npm run dev

Opsiyonel OpenCV destekli asset işleme:

npm run opencv:install
npm run assets:process:opencv

Notlar:

- Normal `npm install` hızlı kalır; OpenCV ayrı kurulur.
- OpenCV build cache'i `tmp/opencv-build/` altında tutulur.
- Proje runtime'ı bu cache'i otomatik kullanır; `npm run assets:process:opencv` için ek env gerekmez.
- `node_modules` temizlenirse OpenCV için `npm run opencv:install` yeniden çalıştırılmalıdır.

Production build:

npm run build
🤝 Katkıda Bulunma

AI ajanları ve geliştiriciler için proje kuralları:

AGENTS.md
.rovo/01-CORE-PROTOCOL.md
.rovo/03-ARCHITECTURE.md

Bu dosyalar projede nasıl çalışılması gerektiğini açıklar.

📜 Lisans

MIT

👤 Proje Sahibi

Raistlin Majere
Hayalet Ev projesi 2025 yılında başlatılmıştır.
