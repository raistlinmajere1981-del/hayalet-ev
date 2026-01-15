# Hayalet-ev Log Sistemi Rehberi

Bu rehber, AI agent'ların Hayalet-ev projesinde log eklemesi ve test süreçlerinde log analizi yapması için gerekli talimatları içerir.

## 🎯 AI Agent'lar İçin Log Kuralları

### ⚠️ ZORUNLU: console.log Kullanma!

Renderer process'te (`src/js/`) **kesinlikle** `console.log`, `console.error`, `console.warn` kullanma. Bunun yerine `LogManager` kullan.

```javascript
// ❌ YANLIŞ - Kullanma!
console.log("Mesaj gönderildi");
console.error("Hata oluştu:", error);

// ✅ DOĞRU - LogManager kullan
import { LogManager } from "./modules/log-manager.js";

LogManager.addEvent("webview", "info", "Mesaj gönderildi");
LogManager.addEvent("webview", "error", `Hata oluştu: ${error.message}`);
```

### İstisna: executeJavaScript İçi

Webview'da `executeJavaScript` ile çalıştırılan kodlar **istisnadır** - orada LogManager erişilemez:

```javascript
// Bu kabul edilebilir - webview context'inde çalışıyor
webview.executeJavaScript(`
  try {
    // kod...
  } catch (e) {
    console.error('[Hayalet-Inject] Failed:', e);  // ✅ Kabul edilir
  }
`);
```

---

## 📝 LogManager API

### Import

```javascript
import { LogManager } from "./modules/log-manager.js";
// veya göreceli path
import { LogManager } from "../log-manager.js";
```

### Temel Kullanım

```javascript
// Basit log
LogManager.addEvent(source, type, message);

// Context ile log (tercih edilen)
LogManager.addEvent(source, type, message, { context: { key: value } });
```

### Parametreler

| Parametre | Tip | Açıklama | Örnekler |
|-----------|-----|----------|----------|
| `source` | string | Log kaynağı/modülü | `"webview"`, `"database"`, `"entrance"`, `"file-upload"`, `"relay"`, `"traffic"` |
| `type` | string | Log seviyesi | `"info"`, `"warning"`, `"error"`, `"debug"` |
| `message` | string | Log mesajı | `"Mesaj gönderildi"`, `"Sync tamamlandı"` |
| `meta` | object | Ek bilgiler | `{ context: { provider: "chatgpt", url: "..." } }` |

### Log Seviyeleri

| Seviye | Kullanım | Örnek |
|--------|----------|-------|
| `error` | Kritik hatalar, işlem başarısız | `"Database bağlantı hatası"` |
| `warning` | Uyarılar, potansiyel sorunlar | `"Selector bulunamadı, fallback kullanılıyor"` |
| `info` | Genel bilgi, işlem tamamlandı | `"3 dosya yüklendi"` |
| `debug` | Detaylı debug bilgisi | `"IPC yanıtı alındı"` |

---

## 🔧 Modüle Göre Log Örnekleri

### Database İşlemleri

```javascript
// Başarılı işlem
LogManager.addEvent("database", "info", `${messages.length} mesaj senkronize edildi`);

// Hata
LogManager.addEvent("database", "error", `Sync hatası: ${err.message}`, { 
  context: { accountId, webUrl } 
});
```

### Dosya Yükleme

```javascript
// Başlangıç
LogManager.addEvent("file-upload", "debug", "Upload başlatılıyor", { 
  context: { service: "catbox", fileCount: files.length } 
});

// Tamamlandı
LogManager.addEvent("file-upload", "info", `Upload tamamlandı: ${count} başarılı, ${errors} hata`);

// Hata
LogManager.addEvent("file-upload", "error", `Upload hatası: ${err.message}`);
```

### Webview İşlemleri

```javascript
// Sayfa yüklendi
LogManager.addEvent("webview", "info", "Sayfa yüklendi", { 
  context: { provider: "chatgpt", url } 
});

// Selector hatası
LogManager.addEvent("webview", "warning", `Selector bulunamadı: ${selector}`, { 
  context: { provider, action: "click" } 
});

// Genel hata
LogManager.addEvent("webview", "error", `İşlem hatası: ${err.message}`, { 
  context: { provider, action } 
});
```

### Entrance/Settings

```javascript
LogManager.addEvent("entrance", "info", "Hesap oluşturuldu", { context: { accountId } });
LogManager.addEvent("entrance", "error", `Avatar yükleme hatası: ${err.message}`);
```

---

## 📂 Log Dosya Yapısı

Her uygulama oturumu `logs/` altında tarih-saat formatında klasör oluşturur:

```
logs/
└── DD-MM-YYYY_HH-MM-SS/           # Örnek: 15-01-2026_14-30-22
    ├── meta.json                  # Session başlangıç bilgileri
    ├── console-001.log            # Ana console logları
    ├── structured.jsonl           # JSON formatında eventler
    ├── error.log                  # Sadece hatalar (varsa)
    └── summary.json               # Session özeti (kapanışta)
```

---

## 🔍 Test Sürecinde Log Analizi

### AI Agent'lar İçin Test Workflow

**1. Uygulamayı başlat ve test et:**
```bash
npm start
# Test işlemlerini yap...
# Uygulamayı kapat
```

**2. En son log session'ını bul:**
```bash
LATEST_LOG=$(ls logs/ | sort -r | head -1)
echo "Session: $LATEST_LOG"
```

**3. Log dosyalarını incele:**

```bash
# Önce hataları kontrol et (en önemli)
cat "logs/$LATEST_LOG/error.log" 2>/dev/null || echo "Hata yok ✅"

# Ana log dosyasını incele
cat "logs/$LATEST_LOG/console-001.log"

# Son N satırı göster
tail -50 "logs/$LATEST_LOG/console-001.log"

# Belirli bir pattern ara
grep -i "error\|fail\|exception" "logs/$LATEST_LOG/console-001.log"

# Belirli bir modülü filtrele
grep "webview\|database" "logs/$LATEST_LOG/console-001.log"
```

**4. Session özetini kontrol et:**
```bash
cat "logs/$LATEST_LOG/summary.json"
# endReason: "normal" olmalı
```

### Başarılı Test Kriterleri

- ✅ `error.log` boş veya sadece bilinen uyarılar içermeli
- ✅ `summary.json` → `endReason: "normal"` olmalı
- ✅ Beklenen işlemler `console-001.log`'da görünmeli
- ✅ Kritik hata mesajı olmamalı

### MCP Server ile Log Okuma

CDP bağlantısı aktifken MCP tool'larını kullan:

```bash
# Tüm logları oku
read_electron_logs --type all --tail 100

# Sadece hataları göster
read_electron_logs --type error

# Belirli bir kaynağı filtrele
read_electron_logs --source "WEBVIEW-*" --type error

# Session listesi
list_log_sessions --limit 5

# Session özeti
get_session_summary
```

---

## 🚨 Yaygın Hatalar ve Çözümleri

### "LogManager is not defined"

**Sebep:** Import eksik.

```javascript
// ✅ Dosyanın başına ekle
import { LogManager } from "./modules/log-manager.js";
```

### "Cannot read property 'message' of undefined"

**Sebep:** Error object'i undefined olabilir.

```javascript
// ❌ Riskli
LogManager.addEvent("x", "error", `Hata: ${error.message}`);

// ✅ Güvenli
const errorMsg = error?.message || String(error);
LogManager.addEvent("x", "error", `Hata: ${errorMsg}`);
```

### Log dosyası oluşmuyor

**Sebep:** Electron main process başlamamış veya logs/ klasörü yok.

```bash
# Klasörü kontrol et
ls -la logs/

# Electron'u yeniden başlat
npm start
```

---

## 📋 Yeni Kod Yazarken Checklist

- [ ] `console.log` yerine `LogManager.addEvent` kullanıldı mı?
- [ ] Error log'larına context (provider, url, selector vb.) eklendi mi?
- [ ] try-catch bloklarında error message güvenli şekilde alınıyor mu?
- [ ] LogManager import edildi mi?
- [ ] Test sonrası log dosyaları incelendi mi?

---

## 🔗 İlgili Dosyalar

- `src/js/modules/log-manager.js` - LogManager implementasyonu
- `electron/console-logger.js` - Main process log orchestrator
- `electron/logger/` - Log writer, reader, session manager
- `mcp-server/tools/log-tools.js` - MCP log tool'ları
