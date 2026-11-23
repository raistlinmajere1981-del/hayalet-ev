# Ortak AI0 — OpenCode 2.3 Görsel Yeteneği (2026-11-23)

## Mimari karar

OpenCode'un kurulumu, sağlayıcı bağlantısı, ChatGPT/Codex OAuth, model erişimi, kullanıcı ayarları, skill ve plugin yönetimi **kullanıcının sorumluluğundadır**. Hayalet Ev ikinci bir OpenCode hesabı/konfigürasyon deposu, gizli anahtar kopyası veya özel bir görsel plugin'i oluşturmaz.

Tek uygulama sahibi `electron/ai0/runtime-host.ts` içindeki `Ai0RuntimeHost`'tur. Asistan ve odalar buradan hizmet alır. OpenCode API ve model detayları odalardan saklanır.

- `electron/ai0/opencode-process.ts`: kurulu OpenCode binary'sini normal kullanıcı konfigürasyonuyla başlatır; eski `v2.0.21` kilidi kalkmıştır. Task workspace'leri yalnız **çalışma dosyaları ve session yönetimi** için ayrıdır; ayrı kullanıcı hesabı, home, global config, skill/plugin kurulumunu yönetmez. Bağlı hesaplar OpenCode'un mevcut bağlantı deposundan okunur. Geliştirme sunucusu `opencodeServerManager` üzerinden ayrıca yönetilir.
- Başlatılan görev sunucusu localhost üzerindedir ve her süreç için yeni bir parola kullanır. `OPENCODE_PASSWORD` ve `OPENCODE_SERVER_PASSWORD` birlikte ayarlanır; kullanıcının ortamındaki eski parola bu sürece karışmaz.
- Kullanıcı ayarlarının/eklenti kodunun yüklenmesi uygulamanın onu işletim sistemi düzeyinde izole ettiği anlamına gelmez. Normal sohbet ve NPC oturumlarında araç izinleri session seviyesinde `deny-all` olur. Fate-Knots NPC prompt'larına yalnız izin verilen kamuya açık paket alanları taşınır. Kullanıcıya ait kötü niyetli plugin kodları için ayrı OS sandbox iddiası yoktur.

## Yerleşik görsel API

OpenCode 2.3.2 üzerinde kimlik doğrulamalı canlı API keşfiyle `POST /api/experimental/generate/image` ve `opencode.config.image` dahili eklentisi doğrulandı. Bu endpoint stateless çalışır ve `model: {providerID,id}`, `prompt`, `aspect`, `resolution` alır; `data.images` içinde base64 görüntü döndürür. **Keşif gerçek görsel üretildiği veya Plus hesabının ilgili modele eriştiği anlamına gelmez.** Görsel üretim denemesi kota yenilenince yapılacaktır.

`electron/ai0/native-image-service.ts` endpoint'i seçilen **açık modelle** çağırır; model/sağlayıcı fallback veya otomatik tekrar deneme yoktur. Tam bir PNG, base64 ve PNG yapısı doğrulanmadan sonuç başarı sayılmaz. `Ai0RuntimeHost.generateImage` onaylı görseli `data/shared/ai0-images/` altına hash ve manifest ile saklar; açma işleminde yeniden doğrular.

`imageStatus` sadece dahili görsel API'nin **aktif** olduğunu denetler. `verified=false` ilk gerçek PNG üretilene kadar kalır; `available=true` ile karıştırılmaz. Model envanterinde görsel modeller metin modelleri arasında listelenmeyebilir. Görsel model ataması bu nedenle metin modeli listesiyle sınırlandırılmaz.

## Model atamaları ve UI

`shared/ai0-runtime.ts` ve `app.db` / `ai0_runtime_models` üzerinden görev bazlı model seçimi:

- `AI0_ASSISTANT_SCOPE`: AI0 sohbeti (atanmamışsa Asistan UI modeli).
- `AI0_ROOM_SCOPE`: odaların ortak metin modeli; eski oda-özel seçimlerin önündedir. Atama yoksa oda-özel kayıt ve sohbet varsayılanı kullanılabilir.
- `AI0_IMAGE_SCOPE`: bütün odaların varsayılan görsel modeli; ilk aday `openai:gpt-image-2`. Fate-Knots resim isteği de aynı seçimi kullanır.

Asistan içindeki OpenCode UI'nin mevcut **Model Ayarları** modalına üç görev seçimi ve görsel durum göstergesi eklendi. Asistan AI0 test penceresi model seçimi, görsel deneme ve doğrulanmış görsel açmayı sürdürür. Kullanıcı OpenCode kurulumu veya OAuth girişini Hayalet Ev'den yönetmez.

## Oda köprüsü

`room-tools-call` işlemleri `ai0-image-status` ve `ai0-image-generate` olarak genelleştirildi; `roomId`, `requestId`, üretimde `jobId`, `prompt`, `sourceAspectRatio` taşınır. Fate-Knots `electron-bridge.ts` yalnız genel oda yeteneğini çağırır; oyun içi World Forge plan, kırpma, dosya terfisi ve canonical state kendisine aittir. Metin NPC çağrısının oyun paketlerine özel güvenlik doğrulaması korunur.

Eski `electron/ai0/native-image-plugin.ts`, Fate-Knots özel image worker ve eski özel image IPC yolları **geçiş dönemi için** depoda tutulmaktadır; aktif yeni üretim yoluna fallback yapılmaz. Canlı endpoint ve World Forge dosya üretimi doğrulanınca kaldırılabilir. Tarihsel v2.0.21 tespitleri için [eski görsel eklentisi analizi](ai0-imagen-audit.md).

## Kabul ve smoke

- Yerel API sözleşmesi / aktif dahili plugin: **doğrulandı, ücretli istek yok**.
- Sahte provider/PNG ile host, hata ve görsel güvenlik testleri: **doğrulandı**.
- Gerçek ChatGPT/Codex hesabıyla tek PNG: **bekliyor**.
- Gerçek PNG'nin Electron ile açılması ve Fate-Knots World Forge üzerinden kalıcı materyale terfisi: **bekliyor**.
- Eski özel servisleri kaldırma: **bekliyor**.

Gerçek provider çağrısı yapmadan modelleri göstermek:

```bash
TSX_TSCONFIG_PATH=src/tsconfig.json node --import tsx scripts/ai0-runtime-smoke.ts --models
```

Asistan'dan seçilen gerçek görsel modeli ile test etmek (kota kullanabilir):

```bash
TSX_TSCONFIG_PATH=src/tsconfig.json node --import tsx scripts/ai0-runtime-smoke.ts --image
```

**Not:** `--image` ancak görüntü modeli atanmış ve yetkili provider bu API'de çalışabilir olduğunda başarılı olur. Bu koşullar canlı test edilmedi.
