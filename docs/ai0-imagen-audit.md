# AI0 OAuth görsel eklentisi denetimi — Aşama 2.1

**Tarihsel kayıt (Ekim 2026).** Buradaki native eklenti ve önceki sağlayıcı denemeleri artık kullanılmıyor. 24 Kasım 2026 itibarıyla etkin mimari ve canlı kabul için [ai0-runtime.md](ai0-runtime.md) geçerlidir.

2026-10-14 tarihinde kurulu `opencode v2.0.21` ile `opencode-imagen@0.1.0` denetlendi. Sonuç: eklenti bu runtime'da aktive olamadı. Uygulama görsel görevine kurulmadı; global yapılandırma değişmedi. Gerçek görsel sağlayıcı isteği yapılmadı, PNG üretilmedi veya açılmadı. Fate Knots canlı materializer doğrulaması ve eski servislerin kaldırılması bekliyor.

## Kaynak ve bağımlılıklar

İncelenen upstream commit: [`b002f41e8b89859ef032ecf1055721f06a289d0e`](https://github.com/mpsuesser/opencode-imagen/tree/b002f41e8b89859ef032ecf1055721f06a289d0e). Kaynak, testler, `bun.lock` ve npm'deki yayımlanmış paket incelendi; npm tarball'larının SHA-512 integrity değerleri doğrulandı. Denetim paketleri yalnız repository'nin ignore edilen `tmp/imagen-audit/` dizinine kuruldu; lifecycle scriptleri çalıştırılmadı. Uygulamanın `package.json`/lock dosyaları değiştirilmedi.

[Eklenti manifesti](https://github.com/mpsuesser/opencode-imagen/blob/b002f41e8b89859ef032ecf1055721f06a289d0e/package.json) `@opencode-ai/plugin` ve `@opencode-ai/schema` sürümlerini `0.0.0-next-17444`, Effect ve Bun platformunu `4.0.0-beta.101` olarak sabitler. [OpenCode v2.0.21](https://github.com/anomalyco/opencode/blob/v2.0.21/package.json) ise `effect@4.0.0-rc.112` ve `@opencode/plugin`/`@opencode/schema` workspace paketlerini kullanır. Basit Effect işlemleri iki sürüm arasında çalışsa da bu, plugin lifecycle ve scope/context uyumluluğunu kanıtlamaz.

İki ayrı yükleme kontrolü yapıldı:

- Yayımlanan paketin temiz npm çözümlemesinde `@effect/platform-bun@4.0.0-beta.101` içindeki `@effect/platform-node-shared:^4.0.0-beta.101` bağımlılığı `4.0.4` sürümüne çözüldü. Import, beta Effect içinde bulunmayan `effect/dist/process/ChildProcess.js` nedeniyle başarısız oldu. Kurulum `--ignore-scripts --omit=dev --legacy-peer-deps` ile yapıldı; bu kontrol OpenCode/Bun aktivasyonunun yerine geçmez.
- Upstream `bun.lock` ile aynı `@effect/platform-node-shared@4.0.0-beta.101` kullanılarak asıl OpenCode binary'sinde tekrar denendi. Mevcut ortak `startAi0Process` mekanizması, repository dışındaki özel çalışma alanı ve yalnız `imagen` izinli denetim kapsamı kullanıldı. `/api/plugin` eklentiyi `failed`, mevcut sınır eklentisini `active` gösterdi. Aktivasyon hatası: `TypeError: undefined is not an object (evaluating 'r.base.get')`; stack, bundled OpenCode `setContext` ile eklentinin `effect/dist/internal/effect.js` çağrısını içeriyordu. Sınır RPC'sinin gerçek araç listesi boştu. Denetim süreçleri kapatıldı; alternatif sunucu/runtime eklenmedi.

Bu bulgu, mevcut sürümde eklenti aktivasyonunun başarısız olduğunu doğrular. OAuth hesabının görsel erişimi hakkında bir sonuç değildir; sağlayıcı çağrısı aşamasına ulaşılmadı.

Doğrulama: ortak host, profil registry, komut/IPC ve Fate Knots sınırlarını kapsayan 45 hedefli test geçti. `npm run typecheck`, uygulama/MCP/scripts lint ve iki runtime belgesinin Prettier kontrolü başarılı oldu. Full test paketi çalıştırılmadı. Test PNG fixture'ları canlı görsel üretimi kanıtı değildir.

## OAuth, model ve dosya sınırı

[Eklenti uygulaması](https://github.com/mpsuesser/opencode-imagen/blob/b002f41e8b89859ef032ecf1055721f06a289d0e/src/plugin.ts) OpenCode'un `integration.connection.active("openai")` ve `resolve` mekanizmasını kullanır. API-key credential'ı reddeder; ücretli API sağlayıcısına fallback yoktur. Uygulama kodumuz OAuth credential store'unu okumadı, loglamadı, kopyalamadı veya değiştirmedi. Aktivasyon başarısız olduğu için denetimde eklentinin tool-execute/credential-resolution yolu çağrılmadı.

Eklenti, tool içinde OAuth access token'ını çözüp `Redacted` olarak tutar ve hesap id'sini token claim'inden çıkarır. [Codex isteği](https://github.com/mpsuesser/opencode-imagen/blob/b002f41e8b89859ef032ecf1055721f06a289d0e/src/codex.ts), `chatgpt.com/backend-api/codex/responses` adresine doğrudan gönderilir. Görsel modeli `gpt-image-2`, dispatcher modeli ise session modelinden bağımsız sabit `gpt-5.5` olur. İleride bağlanırsa seçili session modeli ile bu gerçek görsel sağlayıcı/model ayrımı açıkça gösterilmelidir.

Eklenti hatalarda neden zincirini `Effect.logError` ve `Tool.Error` içine taşır; HTTP başarısızlığında response body mesaj içine eklenir. Effect HTTP request JSON çıktısı authorization header'ını redakte eder; bu denetim gerçek token sızıntısı göstermedi. Buna rağmen bağlantı/HTTP nedenlerini ve response body'yi uygulama loglarına veya renderer'a taşımayan bir hata sınırı gereklidir.

[`imagen` sözleşmesi](https://github.com/mpsuesser/opencode-imagen/blob/b002f41e8b89859ef032ecf1055721f06a289d0e/src/domain.ts) serbest `referencePaths`, isteğe bağlı `outputPath` ve PNG/WebP/JPEG seçimi içerir. [Dosya katmanı](https://github.com/mpsuesser/opencode-imagen/blob/b002f41e8b89859ef032ecf1055721f06a289d0e/src/image-store.ts) path'leri cwd'ye göre resolve eder ve `wx` ile mevcut dosyanın üzerine yazmaz; tek başına çalışma alanı dışına erişimi engellemez. Mevcut host sınırı `image_generate` + zorunlu, session'a ayrılmış `output_path` ister. Aktivasyon kanıtlanmadığı için isim/parametre adaptörü eklenmedi ve izin listesi gevşetilmedi.

## Küçük ve güvenli sonraki adım

Upstream eklentinin OpenCode `v2.0.21` SDK/Effect sürümleriyle native bir sürümünü yayımlaması; dolaylı platform bağımlılıklarını da kilitlemesi ve gerçek OpenCode lifecycle'ında yükleme testini eklemesi gerekir. Eski beta runtime'ı taşıyan bir compatibility shim veya credential store'u doğrudan okuyan alternatif yazılmamalıdır.

Bu sürüm hazır olduğunda yalnız ortak host'un görsel kapsamına bağlanan adaptör, `imagen` aracını `image_generate` olarak sunmalı; `outputPath` değerini host'un rezervasyonundan üretmeli, PNG'yi zorunlu kılmalı ve `referencePaths` erişimini kapatmalıdır. Normal/NPC kapsamları bu eklentiyi yüklememeli. Önce gerçek session probe'u ve hedefli testler, sonra hesap kullanım limitlerine tabi tek canlı görsel denemesi yapılmalıdır. Asistan PNG açma ve aynı artifact üzerinden Fate Knots materialization doğrulanmadan eski servisler silinmemelidir.

## Aşama 2.2 — Hayalet Ev native V2 eklentisi

2026-10-14'te upstream main yeniden kontrol edildi: aynı `b002f41e8b89859ef032ecf1055721f06a289d0e` commit ve npm `0.1.0` yayımlanmıştı. Uyumlu güncelleme bulunmadığından `electron/ai0/native-image-plugin.ts` oluşturuldu. Denetlenmiş Codex request/SSE yaklaşımı esas alındı; üçüncü taraf Effect/SDK veya token saklama kodu taşınmadı. Native Promise API'nin sürüm kaynağı [OpenCode v2.0.21 adaptörü](https://github.com/anomalyco/opencode/blob/v2.0.21/packages/plugin/src/promise/adapter.ts) ve [integration sözleşmesidir](https://github.com/anomalyco/opencode/blob/v2.0.21/packages/plugin/src/promise/integration.ts).

Eklenti yalnız Node built-in'leri ve bundle içine alınan uygulama PNG doğrulayıcısını kullanır; dış/dolaylı runtime bağımlılığı yoktur. Böylece SDK/Effect sürüm kayması ortadan kalkar; host'un çalıştırdığı tam `v2.0.21` sürümünün native adaptörü kullanılır. Yeni sunucu sahibi, paralel runtime veya global eklenti kurulumu eklenmedi. Var olan ortak host, gerekli görsel süreçlerine bu uygulama bundle'ını yükler.

Canlı doğrulama sonuçları birbirinden ayrıdır:

| Kontrol             | Sonuç                                                                                                                                                                                                                                        |
| ------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Eklenti aktivasyonu | `image-generator` ve `fate-knots-image` kapsamlarında `/api/plugin`: `hev.ai0.image` ve `hev.ai0.boundary` `active`.                                                                                                                         |
| Gerçek araç keşfi   | Yeni root session'ın pre-provider generate hook snapshot'ında yalnız `image_generate`, zorunlu `prompt`/`output_path`, `additionalProperties:false`. Normal AI0 ve Fate Knots NPC snapshot'ları boş; bu kapsamlarda image plugin yüklenmedi. |
| Gerçek PNG üretimi  | Asistan AI0 panelinden `openai/gpt-5.5` ile bir kere denendi. OpenCode `provider.invalid-request` döndürdü; HTTP status yoktu ve image tool çağrı sayısı sıfırdı. Artifact dizininde PNG oluşmadı, panelde açma düğmesi kapalı kaldı.        |

OpenCode'un kendi session API'sinden yalnız başarısız Hayalet Ev oturumu için hata türü/durum ve tool çağrı sayısı alındı; credential store/SQLite doğrudan okunmadı. Ham hata mesajı, provider response body ve kimlik bilgileri loglanmadı. Hata mesajında yalnız sabit `model` ve `not supported` sınıflandırıcıları eşleşti; seçilen dispatcher modeline ilişkin ret vardır. Görsel tool çalışmadığı için native eklentinin OAuth çözümleme/gerçek Codex görsel HTTP yolu henüz canlı sınanmış değildir. Hesabın görsel erişimine ilişkin başarı veya yetki reddi sonucu çıkarılamaz. İkinci üretim denemesi ya da alternatif credential yapılmadı.

33 hedefli test geçti; typecheck, hedefli lint, Electron bundle build ve belge format kontrolleri uygulandı. Testler rezervasyon/session izolasyonu, değiştirilen prompt/path, ek/reference parametreler, tek sağlayıcı denemesi, 403/transport/credential hata temizliği, symlink kaçışı, SSE completion ve PNG bytes doğrulamasını kapsar. Fixture PNG'leri canlı sağlayıcı kanıtı sayılmaz; full test çalıştırılmadı.

PNG oluşmadığından Asistan açma ve Fate Knots canlı materializer doğrulaması yapılmadı. Eski çalışan servis kaynakları korundu. Sonraki adım, hesaba açık dispatcher modelini OpenCode tarafında doğrulayıp yeni bir izinli tek PNG denemesine geçmektir; credential yöntemi veya güvenlik sınırı değiştirilmemelidir.

## Aşama 2.3 — Native Codex Images rotası (canlı sonuç bekleniyor)

`CODEX_HTTP_400` hatası, `tool_choice` düzeltmesinden sonra da tekrarlandı. Topluluk yeniden üretimleri ve güncel OpenAI Codex kaynağı, görsel üretimin eski `POST /backend-api/codex/responses` içindeki hosted `image_generation` aracına güvenmek yerine ayrı `POST /backend-api/codex/images/generations` yolu üzerinden yürütüldüğünü doğruluyor. Codex referansı: [`codex-rs/codex-api/src/endpoint/images.rs`](https://github.com/openai/codex/blob/main/codex-rs/codex-api/src/endpoint/images.rs) ve [`codex-rs/codex-api/src/images.rs`](https://github.com/openai/codex/blob/main/codex-rs/codex-api/src/images.rs).

Native AI0 eklentisinde yalnız görsel üretim isteği ve yanıt sözleşmesi değişti: `prompt`, `model=gpt-image-2`, `n=1`, `quality`, `size`, `background` gönderiliyor; `data[0].b64_json` içinden tek gerçek PNG doğrulanıyor. Chat dispatcher modelini hosted-image aracına zorlayan eski Responses isteği kaldırıldı. OpenCode OAuth bağlantısı, ayrı çalışma alanı, `image_generate` araç izni, host-reserved prompt/path, dosya doğrulaması ve güvenli hata kodu sınıflandırması korundu. Sağlayıcının gerçek görsel modeli, çözünürlüğü ve kalite seviyesi gönderilen isteğe rağmen değişebilir; istemci bunları kanıtlanmış kabul etmez.

16 hedefli test, Electron typecheck ve bundle build geçti; `git diff --check` temiz. Bu yeni rota üzerinden henüz canlı görsel isteği yapılmadı. PNG başarıyla oluşmadan Fate Knots materializer veya legacy kaldırma tamamlanmış sayılmıyor. Native Codex Images bir uygulama içi OAuth rotasıdır; kararlı kamu API sözleşmesi değildir ve hesap bazlı erişim farklı olabilir.
