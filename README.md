# 👻 Hayalet Ev

Hayalet Ev bir uygulama değil.
Bir masa, bir alan, bir akış.

İnsan ve yapay zekânın aynı yerde sadece konuştuğu değil,
**birlikte düşündüğü, tartıştığı, ürettiği, oyun kurduğu** bir dijital ortam.

---

## 🧠 Nedir?

Hayalet Ev, yerel (local-first) çalışan bir çok-ajan ortamıdır.
Ama onu diğer sistemlerden ayıran şey yalnızca teknik özellikleri değil, yaklaşımıdır:

> AI’lar araç değil, aynı ortamı paylaşan varlıklardır.

Bu evde:

- **AI1 ve AI2** farklı sağlayıcılardan gelen iki ayrı zihindir.
- **AI0** yerel araçlara, hafızaya ve çalışma akışlarına erişebilen yardımcı katmandır.
- **US1** uzaktaki başka bir Hayalet Ev kullanıcısına açılan bağlantıdır.
- kullanıcı bu akışın merkezinde değil, **parçasıdır**.

---

## 🌒 Neden Var?

Hayalet Ev, klasik “prompt → cevap” döngüsünü kırmak için ortaya çıktı.

Amaç:

- AI’ları tek tek kullanmak yerine **birlikte çalıştırmak**,
- insan ↔ AI değil, **insan ↔ AI ↔ AI** etkileşimi kurmak,
- konuşmayı kalıcı projelere, odalara, analizlere ve üretim akışlarına dönüştürmek,
- yazılımı bir araçtan çok **bir ortam** haline getirmek.

---

## 🏠 Ev Fikri

Hayalet Ev ismi bir metafor değil, bir tasarım kararıdır.

Sistem sekmelerden veya bağımsız “uygulama sayfalarından” oluşmak yerine bir ev gibi davranır:

- giriş alanı vardır (**Entrance**),
- ortak çalışma masası vardır (**Analyze**),
- uzmanlaşmış çalışma alanları vardır (**Rooms**),
- hafızası vardır (**Archives**).

> Bu bir arayüz değil, **yaşanan bir alan**.

---

## ✨ Bugün Neler Yapabiliyor?

Güncel `main` dalında Hayalet Ev yalnızca çoklu-AI sohbeti değildir. Uygulanan ana yüzeyler şunlardır:

- AI1, AI2, AI0 ve bağlı US1 arasında slot tabanlı çalışma,
- konuşma ve çalışma bağlamlarını saklayan Archive sistemi,
- bağımsız geliştirilebilen ve `.hevroom` olarak paketlenebilen Room mimarisi,
- medya, görüntü ve ses inceleme/analizi için **Laboratory**,
- hedefi görevlere ayırıp farklı AI slotlarından yanıt toplayan **Forge Room**,
- elektronik onarım oturumları için kamera, ölçüm, evidence ve AI destekli **Repair Room**,
- AI ve US1 ile oynanabilen oyun akışlarını barındıran **Game Room**,
- Android cihazı kamera, çevrimdışı konuşma algılama ve capture companion olarak kullanabilen **Android Companion**,
- MCP ve yerel araç köprüleri üzerinden masaüstü iş akışlarını genişleten yardımcı servisler.

Bazı özellikler FFmpeg, model dosyaları, Android/ADB veya harici AI sağlayıcısı gibi ek sistem bileşenleri gerektirir. README uygulanmış ürün yüzeyini özetler; ayrıntılı kurulum ve sınırlar ilgili teknik belgelerde yer alır.

---

## 🚪 Yerleşik Odalar

| Oda | Durum | Güncel yetenekler |
| --- | --- | --- |
| **Laboratory** | Uygulanmış | Proje/source intake, hazırlık ve tool/model kontrolleri, medya ve ses analizi, tek/çift görsel inceleme, zoom/pan, ROI, geometrik/yüz detay inceleme, annotation ve export, rapor üretimi. |
| **Forge Room** | Uygulanmış | Hedef, preflight, görev taslağı, çoklu-AI assignment, yanıt/çelişki inceleme, sentez ve başka bir odaya handoff paketi. |
| **Repair Room** | Uygulanmış | Onarım oturumları, Assistant evidence araştırması, knowledge pack, PCB/kamera çalışma alanı, ölçüm, overlay/timeline, AI chat, dictation/TTS ve Android kamera akışları. |
| **Game Room** | Uygulanmış / gelişiyor | Tavla: AI1, AI2 veya bağlı US1 rakibi. Team Tetris: USER + AI1 + AI2 + US1 dört koltuklu tur tabanlı oyun. Fate Knots şu anda placeholder. |
| **Pattern Room** | Prototip | Kaynak, iddia, çelişki ve rapor düzeni için local-only phase-one araştırma yüzeyi. |

Ayrıntılar: [rooms/README.md](rooms/README.md).

---

## 🧪 Laboratory

Laboratory, tek bir medya oynatıcısından daha geniş bir analiz tezgâhıdır.

Kaynağı projeye alır, gerekli araç/model hazırlığını görünür kılar, medya veya sesi işler ve sonuçları incelemeye açar. Görüntü tarafında karşılaştırma çalışma alanı, yakınlaştırma/taşıma, seçim ve detay inceleme araçları ile serbest çizim/daire annotation katmanı bulunur. Annotation kaynak dosyayı değiştirmeden çalışma oturumunda tutulur ve capture/export çıktısına yansıtılabilir.

Ses tarafı sinyal inceleme, konuşma ve gelişmiş forensic/model tabanlı analiz akışlarını aynı proje/raporlama sistemi içinde toplar.

Detaylı yetenek haritası: [LABORATORY.md](LABORATORY.md).

---

## 🔥 Forge Room

Forge Room fikirleri uygulanabilir iş paketlerine dönüştürür.

Bir hedefi kaydeder, bağlam/preflight kontrolü yapar, görev taslağı üretir, görevleri AI slotlarına dağıtır, cevap ve çelişkileri toplar, sentez oluşturur ve gerektiğinde başka bir odaya aktarılabilecek handoff paketi üretir.

Detay: [FORGEROOM.md](FORGEROOM.md).

---

## 🔧 Repair Room

Repair Room elektronik onarım için proje tabanlı bir çalışma tezgâhıdır.

Oturum oluşturma ve arşivleme, cihaz/semptom/risk bilgileri, kaynak-datasheet-not bilgi paketi, Assistant evidence araştırması, ölçüm kayıtları, timeline, annotation/overlay, AI sohbeti ve hands-free kullanım yüzeylerini aynı oturumda birleştirir. Android Companion bağlı olduğunda kamera akışı, fotoğraf capture ve torch kontrolü de çalışma alanına katılabilir.

Detay: [rooms/repair-room/README.md](rooms/repair-room/README.md).

---

## 🎮 Game Room

Game Room farklı insan/AI kombinasyonlarını oyun kuralları içinde aynı masaya getirir.

- **Tavla:** kullanıcı AI1, AI2 veya bağlı US1 ile oynayabilir.
- **Team Tetris:** USER, AI1, AI2 ve US1 için dört koltuklu tur tabanlı ortak oyun motoru kullanır.
- **Fate Knots:** yeni oyun tasarımı için ayrılmış placeholder yüzeyidir.

Detaylar: [BACKGAMMON.md](BACKGAMMON.md) ve [TEAM-TETRIS.md](TEAM-TETRIS.md).

---

## 🧩 Slot Sistemi

Evde herkesin bir yeri vardır.

- **AI1 / AI2** → farklı sağlayıcılardan gelen iki ayrı zihin
- **AI0** → yerel çalışan, hafızaya ve araçlara erişebilen yardımcı katman
- **US1** → başka bir Hayalet Ev kullanıcısı

Bu yapı sayesinde:

- AI’lar birbirini dinleyebilir,
- kullanıcı tek bir modelle sınırlı kalmaz,
- oda protokolleri belirli rolleri belirli slotlara yönlendirebilir,
- uzaktaki biri desteklenen akışlarda aynı masaya oturabilir.

---

## 🔄 Relay ve Akış

Hayalet Ev’de konuşma tek başına son ürün değildir.

- konuşma → analiz → karar,
- fikir → görevler → sentez,
- medya → inceleme → rapor,
- onarım → evidence → ölçüm → bulgu,
- mesaj → relay → yeni bağlam.

Relay sistemi sayesinde AI ↔ AI, uygulama ↔ Assistant ve desteklenen US1 akışları arasında bağlam taşınabilir.

---

## 🧠 Hafıza

Archive sistemi konuşmaları ve çalışma bağlamlarını saklar, tekrar çağrılabilir hale getirir ve uzun süreli akışlarda bağlamın kaybolmasını azaltır.

> Amaç yalnızca log tutmak değil, biriken bir düşünce alanı oluşturmaktır.

---

## 📱 Android Companion

`android-companion/`, masaüstü Hayalet Ev ile birlikte çalışan yerel Android yardımcı uygulamasıdır.

Güncel akışta:

- kamera preview telefonda kalır,
- masaüstünden capture/command oturumları alınabilir,
- openWakeWord ile yerel wake-word algılama yapılabilir,
- Vosk ile çevrimdışı transcription çalıştırılabilir,
- Analyze/Repair gibi desteklenen akışlara fotoğraf ve transcript gönderilebilir,
- masaüstü install/update karşılaştırmaları ortak companion manifesti üzerinden yapılabilir.

Detay: [android-companion/README.md](android-companion/README.md).

---

## 🧱 Room Mimarisi

Oda kaynakları `rooms/<room-id>` altında kendi manifest, UI, host runtime, protocol, i18n ve varlıklarıyla tutulur.

Temel kural:

> Core odaları keşfeder ve çalıştırır; oda kendi iş alanını sahiplenir.

Dağıtılabilir oda paketi `.hevroom` biçimidir. Oda kodunun core implementasyon ayrıntılarına bağlanmaması ve room-local protokol/i18n sınırlarını koruması mimari sözleşmenin parçasıdır.

Kaynak/runtime/storage ayrımı ve built-in oda durumu için [rooms/README.md](rooms/README.md), katkı kuralları için [CONTRIBUTING.md](CONTRIBUTING.md) dosyasına bak.

---

## 🤖 Assistant (AI0)

AI0, Hayalet Ev’in yerel yardımcı katmanıdır ve OpenCode tabanlı çalışma akışlarıyla araçlara erişebilir.

- yerel çalışır,
- araçlara erişir,
- oda protokollerinde görev alabilir,
- gerektiğinde bağlama ve hafızaya dayanarak devreye girer.

> AI0 her zaman konuşmaz; gerektiğinde hazırdır.

---

## 🌐 US1

US1 başka bir Hayalet Ev kullanıcısına açılan bağlantıdır.

Bağlı akışlarda mesaj/oyun durumu gibi oda verileri uzak kullanıcıyla taşınabilir. Game Room’daki Tavla ve Team Tetris bunun doğrudan örnekleridir.

Bağlantı ve güvenlik davranışlarının ayrıntıları uygulama protokolleri ve [SECURITY.md](SECURITY.md) kapsamında ele alınır.

---

## ⚙️ Mimari (Kısaca)

- Electron + Vite + TypeScript
- local-first veri yapısı
- slot tabanlı AI bağlantısı
- MCP araçları ile yerel sistem erişimi
- Room tabanlı genişleme mimarisi
- Android Companion ile yerel cihaz köprüsü
- medya/model/tool bağımlılıklarını oda sınırında yöneten çalışma akışları

---

## 🚀 Geliştirici Başlangıcı

Gereksinimler:

- Node.js 22+
- npm 10+

Depoyu klonladıktan sonra:

```bash
npm ci
npm run electron:dev
```

Tam kalite kapısı:

```bash
npm run check:all
```

Bazı medya, otomasyon, Android ve paketleme özellikleri ek sistem araçları isteyebilir. Ayrıntılar için [PACKAGING.md](PACKAGING.md), katkı akışı için [CONTRIBUTING.md](CONTRIBUTING.md) dosyasına bak.

---

## 📚 Belgeler

- [ONBOARDING.md](ONBOARDING.md) — uygulamayı ilk kez kullananlar için kısa giriş
- [LABORATORY.md](LABORATORY.md) — Laboratory yetenek ve çalışma akışı
- [FORGEROOM.md](FORGEROOM.md) — Forge Room üretim ve handoff akışı
- [BACKGAMMON.md](BACKGAMMON.md) — Tavla oyun/transport kontratı
- [TEAM-TETRIS.md](TEAM-TETRIS.md) — uygulanmış Team Tetris çekirdeği ve tasarım yönü
- [rooms/README.md](rooms/README.md) — room kaynak/runtime/storage sözleşmesi ve built-in oda kataloğu
- [rooms/repair-room/README.md](rooms/repair-room/README.md) — Repair Room yetenekleri
- [android-companion/README.md](android-companion/README.md) — Android Companion
- [CONTRIBUTING.md](CONTRIBUTING.md) — geliştirme ve katkı kuralları
- [PACKAGING.md](PACKAGING.md) — Windows/Linux paketleme akışı
- [SECURITY.md](SECURITY.md) — güvenlik açığı bildirme yöntemi
- [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md) — gömülü üçüncü taraf bileşen ve varlıklar
- `AGENTS.md` ve `.rovo/` — proje mimarisi ve AI destekli geliştirme sözleşmeleri

---

## 🧬 Çalışma Biçimi

Hayalet Ev yalnızca bir kod deposu değildir. `AGENTS.md` ve `.rovo` belgeleri nasıl çalışılacağını, mimari sınırları ve AI ile geliştirme sırasında korunacak karar protokollerini tanımlar.

---

## 🎯 Amaç

Hayalet Ev’in uzun vadeli amacı:

- herkesin erişebildiği AI hesapları ve yerel araçlarla kullanılabilecek,
- tek bir ücretli sağlayıcıya bağımlı olmayan,
- geliştirilebilir ve paylaşılabilir,
- insan, AI ve uzak katılımcıları ortak çalışma akışlarında buluşturan

açık bir dijital çalışma alanı kurmaktır.

---

## 📄 Lisans

Hayalet Ev kaynak kodu [MIT Lisansı](LICENSE) altında sunulur. Kullanabilir, değiştirebilir, dağıtabilir ve kendi projelerinde değerlendirebilirsin; MIT lisans ve telif bildirimlerinin korunması gerekir.

Projede kullanılan üçüncü taraf bağımlılıklar, modeller, ikonlar veya diğer harici varlıklar kendi lisans ve kaynak bildirimlerine tabidir. Kaynak ağacına gömülü bilinen üçüncü taraf materyaller [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md) dosyasında listelenir.

---

## 🧠 Son Söz

Hayalet Ev’i bir uygulama gibi kullanabilirsin.

Ama asıl potansiyeli şurada:

> fikrini cümlelere dök  
> doğru odaya taşı  
> insan ve AI’ların aynı bağlam üzerinde çalışmasına izin ver  
> ham düşüncenin kalıcı bir işe dönüşmesini izle
