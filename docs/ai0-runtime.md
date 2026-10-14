# Ortak AI0 Runtime — Aşama 2

Aşama 2.1 OAuth görsel eklentisi denetimi: [`opencode-imagen@0.1.0` kurulu v2.0.21 içinde aktive olamadı](ai0-imagen-audit.md). Gerçek sağlayıcı çağrısı yapılmadı; görsel üretimi ve eski servisleri kaldırma koşulları hâlâ bekliyor. Bu sonuç OAuth hesabının görsel erişimini değerlendirmez.

Ortak sahip `electron/ai0/runtime-host.ts` içindeki `Ai0RuntimeHost`'tur. Normal runtime sohbeti, görsel görevler ve Fate Knots NPC/görsel adaptörleri bu servisi çağırır. Geliştirme Asistan sunucusunun start/stop/status işlemleri de host üzerinden mevcut OpenCode process manager'a devredilir. Geliştirme yüzeyi ayrı bir güvenlik kapsamıdır; eski OpenCode UI istemcisinin tüm v1 uç noktaları bu aşamada V2'ye taşınmış değildir.

## İzolasyon kararı

Kurulu binary canlı olarak `opencode v2.0.21` doğrulandı. V1 `/global/health` yolu bu sürümde HTTP 200 ile HTML SPA döndürür. Bu yanıt sağlık veya araç desteği değildir. V2 `/api/info` ve host sınır eklentisinin RPC readiness cevabı kimlik doğrulamalı JSON olarak kontrol edilir. V2 süreçleri parola gerektirir; host her süreç için rastgele özel parola üretir ve renderer'a döndürmez.

V2, session bazında izinlerle araç snapshot'ını daraltır; bununla birlikte server config directory, çevre ve plugin kayıtları host/süreç kapsamındadır. Gereken config/plugin/çevre izolasyonu tek sunucuda kanıtlanmadığı için farklı görev kapsamlarını tek süreçte birleştirmedik. Tek uygulama host'u, ayrı süreçleri yönetir. Bu kararın kaynakları: [V2 session context](https://github.com/anomalyco/opencode/blob/v2.0.21/packages/core/src/session/context.ts), [server composition](https://github.com/anomalyco/opencode/blob/v2.0.21/packages/server/src/routes.ts), [CLI server config](https://github.com/anomalyco/opencode/blob/v2.0.21/packages/cli/src/server-process.ts).

Runtime çalışma alanları repository dışındaki `Paths.getAi0RuntimeRoot()` altında oluşur. Config dizini ve OpenCode test-home her süreç için özeldir; project config discovery kapalıdır. Global kullanıcı plugin/skill/MCP/AGENTS kaynakları kopyalanmaz. Başlatmada inherited `OPENCODE_*` config, simulation, CDP ve Node inspector ayarları temizlenir. Sağlayıcı anahtarları kopyalanmaz/değiştirilmez; OpenCode kendi credential store'unu kendi API'si içinde kullanır. Uygulama OpenCode SQLite dosyasına doğrudan erişmez.

Host'un V2 eklentisi araç registry'sini ve model bağlamını sınırlar. NPC ve normal runtime sohbetinde araç listesi boştur. Görsel görevde yalnız `image_generate` izinlidir; farklı tool çalıştırma girişimleri ve ayrılan dosyadan farklı `output_path` reddedilir. Görsel eklentisi sağlanacaksa yalnız uygulamanın açıkça ayrılmış `data/shared/ai0-plugins/image_generate/` paket dizininden yüklenir. Kullanıcının bütün global eklentileri görsel runtime'a taşınmaz. Bu paket güvenilir kod olmalıdır; model tool izinleri plugin kodu için bir OS sandbox değildir.

## Model, profil ve lifecycle

Görev bazlı model seçimleri uygulamanın `app.db` dosyasındaki `ai0_runtime_models` tablosundadır. Açık görev seçimi yoksa ortak normal AI0 seçimi, o da yoksa mevcut Asistan UI model tercihi kullanılır. Bu, tek host'un çözümleme sırasıdır; model seçiminde gerçek runtime model envanteri kontrol edilir. Model listeleri renderer'a yalnız id, provider, name ve capabilities alanlarıyla döndürülür; request/header/credential verileri döndürülmez.

Agent Profile Registry talimatları V2 session instruction entry üzerinden verilir. Profil/katman hash'i veya model değişirse eski süreç ve oturum geçersizleşir. Eski session id ile devam isteği reddedilir. Aktif profile/model seçim değişiklikleri host bağlamlarını ve yetenek attestasyonunu geçersiz kılar. Görev devam ederken değişmiş kimliğin eski sonucu yayımlanmaz.

Normal sohbet aynı kimlikte aynı oturumu sürdürebilir. NPC ve görsel görevler her istekte yeni root session kullanır ve sonunda silinir; parent session kullanılmaz. HTTP timeout, sunucu agent loop'unu kendiliğinden iptal etmediği için hatalı/timeout sürecinin tamamı durdurulur. İdle süreçler on dakika sonra kapanır; uygulama kapanışı ortak host süreçlerini sonlandırır. Signal ile kapanmış süreçlerin ikinci kez durdurulması idempotenttir.

Fate Knots adaptörü, dialogue/combat paketlerini izinli alanlarla yeniden kurar. Bilinmeyen alanlar, nested hidden commits/canon ve geliştirme memory alanları prompt'a taşınmaz. Mevcut gameplay response parser ve legality gate korunur. NPC/görsel başlangıç seçimleri registry'ye kapsam bazında kaydedilir; kullanıcının açık seçimi üzerine yazılmaz.

## Gerçek yetenek ve PNG

Capability probe gerçek session oluşturur. V2 session `generate` hook'u seçilen modeli ve o oturumun effective tool definitions snapshot'ını yakalar; provider request'inden önce probe kesilir. Ek model-request guard'ı probe'un LLM/ücretli sağlayıcı çağrısına dönüşmesini engeller. Model gerçek envanterde bulunmalı ve tool calling desteklemelidir. `image_generate` gerçek snapshot içinde `prompt` ve `output_path` schema alanlarıyla bulunmalıdır. Registry veya skill etiketi araç desteği olarak kabul edilmez.

Görsel üretim success'i, tam bir completed `image_generate` tool olayı ve yeni ayrılan path'te gerçek PNG gerektirir. Dosya sınır, symlink, boyut, signature, chunk checksum, IHDR/IEND ve decompress edilmiş pixel/scanline yapısıyla kontrol edilir. Mevcut doğrulayıcı interlace ve indexed color içermeyen PNG kabul eder; unsupported encoding hata verir. Doğrulanmış dosya ve manifest `data/shared/ai0-images/` altında kalıcı saklanır. Açarken dosya hash'i yeniden kontrol edilir ve Electron native decoder görüntüyü okuyabilmelidir. Metinsel başarı yanıtı veya önceki bir dosya başarı sayılmaz.

## Kullanım ve doğrulama

Asistan sayfasındaki AI0 butonu ortak runtime panelini açar: sohbet/görsel görevi, gerçek model listesi, registry karakter profili, yeni oturum, yetenek kontrolü ve doğrulanmış PNG açma işlemleri vardır.

Mevcut ortak komut catalog'unda:

- `++cmd:AI0ImageStatus`
- `++cmd:AI0ImageGenerate("a blue ghost", "1:1")`

Fate Knots'un mevcut room-tool sözleşmesi aynı shared host adaptörüne bağlanmıştır. Yeni paralel komut sistemi veya başarısızlıkta eski worker'a fallback yoktur.

Canlı smoke komutları:

```bash
TSX_TSCONFIG_PATH=src/tsconfig.json node --import tsx scripts/ai0-runtime-smoke.ts --models
TSX_TSCONFIG_PATH=src/tsconfig.json node --import tsx scripts/ai0-runtime-smoke.ts --chat --model=ollama/qwen2.5:7b
TSX_TSCONFIG_PATH=src/tsconfig.json node --import tsx scripts/ai0-runtime-smoke.ts --model=ollama/qwen2.5:7b
TSX_TSCONFIG_PATH=src/tsconfig.json node --import tsx scripts/ai0-runtime-smoke.ts --image
```

`--chat`/`--image` gerçek model/sağlayıcı çağrısı yapar; `--models` ve capability probe sağlayıcı inference çağrısı yapmaz. `--model` yalnız belirtilen görev kapsamının model seçimini kaydeder.

2026-10-14 canlı sonuçları: yerel `ollama/qwen2.5:7b` üzerinden normal AI0 sohbeti `AI0 runtime verified.` yanıtını verdi. Aynı modelin gerçek görsel session probe'u `No real image_generate tool with a prompt + output_path contract is available in this AI0 session` döndürdü. Kayıtlı `openai:gpt-5.6-terra-fast` seçimi bu izole envanterde unavailable çıktı. Bu koşulda gerçek görsel üretilmedi ve PNG açma canlı kabul koşulu sağlanmış sayılmadı. Testte üretilen PNG fixture'ları gerçek sağlayıcı üretimi kanıtı değildir.

Bu nedenle eski `fate-knots-ai0-runtime-service.ts`, `fate-knots-ai0-image-worker-service.ts`, barrel ve özel model helper kaynakları silinmedi. Aktif ortak room-tool yolu bu kaynaklara fallback yapmaz. Tam cutover/kaynak silme, kullanılabilir gerçek image tool ile ortak üretim ve Fate Knots materialization akışı canlı doğrulandığında yapılmalıdır. Aşama 2'nin görsel üretim ve eski servisleri kaldırma kabul koşulları henüz tamamlanmamıştır.
