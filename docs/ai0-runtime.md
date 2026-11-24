# Ortak AI0 — OpenCode görsel ve metin yetenekleri (2026-11-24)

## Mimari

Hayalet Ev yalnızca OpenCode üzerinden AI0 görevlerini yürütür. OpenCode kurulumu, kullanıcı ayarları, hesap bağlantıları, skill ve plugin yönetimi kullanıcıya aittir. AI0 ayrı hesap veya kimlik bilgisi saklamaz. Görev sunucuları mevcut kullanıcı yapılandırmasını devralır; çalışma alanı ve oturum yetkileri göreve göre ayrılır. Sunucular localhost üzerinde, süreç başına parola ile açılır.

## Görsel üretimi

OpenCode 2.3.2 ve kullanıcının kurduğu **opencode-gpt-imagegen** eklentisi doğrulandı. Kullanıcı bu eklentiyi OpenCode'da kurar ve uygun OpenAI bağlantısını kendisi sağlar. Mevcut kurulumda legacy OAuth bağlantısı ile üretim başarılıdır. Hayalet Ev hesap bağlantısı yapmaz veya eklentinin sağlayıcı protokolünü kopyalamaz.

Görsel görevinde Asistan'ın aktif sohbet modeli, ayrı ve kısa ömürlü bir OpenCode oturumunda eklentinin **gpt_imagegen** aracını çağırır. Yalnız bu araca izin verilir. Normal sohbet/NPC görevleri deny-all araç kuralını korur. Bu, kullanıcı tarafından yüklenen plugin koduna karşı işletim sistemi sandbox garantisi değildir.

AI0 desteklenen boyutlardan istenen en-boy oranına en yakın olanını seçer; eklenti gerçek çıktı boyutunu belirler. Tek tamamlanmış araç çağrısı, beklenen benzersiz yerel çıktı yolu, PNG yapısı ve SHA-256 doğrulanır. Sonuç ortak `data/shared/ai0-images/` arşivine PNG ve manifest olarak aktarılır. Farklı sağlayıcıya otomatik geçiş veya otomatik yeniden deneme yoktur. Eski Codex CLI adaptörü ve Hayalet Ev'in kendi görsel plugin'i kaldırıldı.

## Asistan ayarları

- Aktif model: OpenCode görsel aracını çağıran model.
- AI0 sohbet ve oda metin çağrısı seçimleri: ayrı görev atamaları olarak korunur.
- Ayrı görsel model seçimi yoktur. Eski görsel model kayıtları okunmaz.
- Görsel durum kontrolü eklentinin aktifliğini ve model envanterini doğrular; yalnız gerçek PNG üretildikten sonra doğrulanmış durum gösterilir. Test düğmesi gerçek üretim çağrısı yapar.

## Oda köprüsü

Odalar ortak `ai0-image-status` ve `ai0-image-generate` işlemlerini kullanır. Fate-Knots kendi World Forge planlama, kırpma, dosya terfisi ve oyun durumunu yönetir. Oda tarafından OpenCode eklentisi veya hesap seçilmez.

## Kabul

24 Kasım 2026: Kullanıcının OpenCode TUI testi, AI0 sunucusundaki gerçek gpt_imagegen çağrısı ve ortak AI0 arşivine 1254 × 1254 PNG kaydetme/hash doğrulama başarılı. Aktif model `openai:gpt-5.6-terra-fast` ile ortak host smoke testi geçti. Electron içindeki gerçek görsel testi ve Fate-Knots World Forge üretimi doğrulandı: 37/37 görsel, 36 mevcut görselin hash değerleri değişmeden eksik işten devam, nihai evren kaydı. Gerçek NPC konuşması ve AI0 kontrollü rakiple savaş da başarılı.

Model listesi:

```bash
TSX_TSCONFIG_PATH=src/tsconfig.json node --import tsx scripts/ai0-runtime-smoke.ts --models
```

Aktif modelle gerçek görsel üretim (kota kullanabilir):

```bash
TSX_TSCONFIG_PATH=src/tsconfig.json node --import tsx scripts/ai0-runtime-smoke.ts --image
```

Eski v2.0.21 araştırması yalnız tarihsel kayıt olarak [ai0-imagen-audit.md](ai0-imagen-audit.md) dosyasındadır. Eski Fate-Knots özel worker ve model okuyucuları canlı kabul sonrası kaldırıldı; tek etkin sahip ortak AI0 host. Kullanıcının OpenCode ayarları ve mevcut oyun verileri korunur.
