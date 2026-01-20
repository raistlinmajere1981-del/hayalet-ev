# Hayalet-ev Log Sistemi Rehberi

Bu rehber, AI agent'ların Hayalet-ev projesinde log eklemesi ve test süreçlerinde log analizi yapması için gerekli talimatları içerir.

---

## 🚨 KRİTİK: Log Dosyalarını Okuma

**`structured.jsonl` dosyası asıl logların bulunduğu dosyadır!**

```bash
# ✅ DOĞRU - Detaylı loglar (visibility, correlationId, context dahil)
cat logs/SESSION_ID/structured.jsonl | tail -50

# veya MCP tool ile:
read_electron_logs --type structured --tail 100

# ⚠️ EKSIK - Sadece main process console çıktıları
cat logs/SESSION_ID/console-001.log
```

| Dosya | İçerik | Kullanım |
|-------|--------|----------|
| `structured.jsonl` | **TÜM loglar** (JSON format, visibility dahil) | ✅ Ana analiz dosyası |
| `console-001.log` | Main process console çıktıları | Debug için |
| `error.log` | Sadece error/warning logları | Hızlı hata kontrolü |
| `summary.json` | Session özeti | Genel durum |

---

## 🎯 3 Seviyeli Visibility Sistemi

Loglar 3 seviyede kategorize edilir:

| Seviye | Ad | Görünüm | Kullanım |
|--------|-----|---------|----------|
| **1** | Toast | Toast + Panel + Modal | Kullanıcı bildirimleri (bağlantı, hata, başarı) |
| **2** | Panel | Panel + Modal | Süreç durumu (init, db, sync) |
| **3** | Verbose | Sadece Modal | Debug (state, traffic, probe) |

### Visibility Kullanımı

```typescript
// Yeni API (tercih edilen)
LogManager.toast("entrance", "success", "AI1 bağlandı");     // Seviye 1
LogManager.panel("system", "info", "Uygulama başlatıldı");    // Seviye 2
LogManager.verbose("traffic", "debug", "Probe completed");  // Seviye 3

// Manuel visibility
LogManager.addEvent("source", "info", "mesaj", { visibility: 1 });
```

### Otomatik Visibility (_inferVisibility)

Visibility belirtilmezse otomatik belirlenir:

**Seviye 1 (Toast):**
- `type: "success"` → Her zaman toast
- `type: "error"` + kaynak: entrance, asistan, server, analyze, whisper

**Seviye 2 (Panel):**
- Kaynaklar: system, slot-controller, relay, core, db, sync, lifecycle
- `type: "warning"` → Her zaman panel

**Seviye 3 (Verbose):**
- `type: "debug"` → Her zaman verbose
- Kaynaklar: traffic, probe, state-machine, slot-ai*, renderer, toast, modal
- **Default** → Bilinmeyen kaynaklar verbose

---

## ⚠️ ZORUNLU: console.log Kullanma!

Renderer process'te (`src/js/`) **kesinlikle** `console.log`, `console.error`, `console.warn` kullanma. Bunun yerine `LogManager` kullan.

```typescript
// ❌ YANLIŞ - Kullanma!
console.log("Mesaj gönderildi");
console.error("Hata oluştu:", error);

// ✅ DOĞRU - LogManager kullan
import { LogManager } from "./modules/log-manager.ts";

LogManager.addEvent("webview", "info", "Mesaj gönderildi");
LogManager.addEvent("webview", "error", `Hata oluştu: ${error.message}`);

// ✅ DAHA İYİ - Visibility ile
LogManager.toast("entrance", "success", "Bağlandı");  // Kullanıcıya göster
LogManager.panel("db", "info", "Database açıldı");     // Panel'de göster
LogManager.verbose("traffic", "debug", "State changed"); // Sadece debug
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

```typescript
import { LogManager } from "./modules/log-manager.ts";
```

### Metodlar

| Metod | Visibility | Kullanım |
|-------|------------|----------|
| `toast(source, type, message, meta?)` | 1 | Kullanıcı bildirimleri |
| `panel(source, type, message, meta?)` | 2 | Süreç durumu |
| `verbose(source, type, message, meta?)` | 3 | Debug |
| `addEvent(source, type, message, meta?)` | Otomatik | Genel kullanım |

### Parametreler

| Parametre | Tip | Açıklama | Örnekler |
|-----------|-----|----------|----------|
| `source` | string | Log kaynağı/modülü | `"entrance"`, `"slot-controller"`, `"traffic"` |
| `type` | string | Log tipi | `"info"`, `"success"`, `"warning"`, `"error"`, `"debug"` |
| `message` | string | Log mesajı | `"Bağlantı başarılı"` |
| `meta` | object | Ek bilgiler | `{ visibility: 1, correlationId: "...", context: {...} }` |

### Log Tipleri

| Tip | Kullanım | Default Visibility |
|-----|----------|--------------------|
| `success` | İşlem başarılı | 1 (Toast) |
| `error` | Kritik hata | 1 veya 2 (kaynağa göre) |
| `warning` | Uyarı | 2 (Panel) |
| `info` | Genel bilgi | 2 veya 3 (kaynağa göre) |
| `debug` | Debug detayı | 3 (Verbose) |

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

**3. Log dosyalarını incele (ÖNEMLİ: structured.jsonl kullan!):**

```bash
# ✅ ASİL LOGLAR - structured.jsonl
cat "logs/$LATEST_LOG/structured.jsonl" | tail -50

# JSON formatında okunabilir gösterim
cat "logs/$LATEST_LOG/structured.jsonl" | tail -20 | jq .

# Sadece seviye 1-2 logları (panel görünümü)
cat "logs/$LATEST_LOG/structured.jsonl" | jq 'select(.visibility <= 2)'

# Sadece hatalar
cat "logs/$LATEST_LOG/structured.jsonl" | jq 'select(.type == "error")'

# Belirli kaynak
cat "logs/$LATEST_LOG/structured.jsonl" | jq 'select(.source | contains("slot"))'

# Hızlı hata kontrolü
cat "logs/$LATEST_LOG/error.log" 2>/dev/null || echo "Hata yok ✅"
```

**4. Session özetini kontrol et:**
```bash
cat "logs/$LATEST_LOG/summary.json"
# endReason: "normal" olmalı
```

### Başarılı Test Kriterleri

- ✅ `error.log` boş veya sadece bilinen uyarılar içermeli
- ✅ `summary.json` → `endReason: "normal"` olmalı
- ✅ Beklenen işlemler `structured.jsonl`'da görünmeli
- ✅ Çift işlem (duplicate) olmamalı (correlationId kontrolü)
- ✅ Visibility seviyeleri doğru olmalı

### MCP Server ile Log Okuma

```bash
# ✅ ÖNERİLEN - Structured loglar (detaylı, visibility dahil)
read_electron_logs --type structured --tail 100

# Sadece hataları göster
read_electron_logs --type error

# Belirli bir kaynağı filtrele
read_electron_logs --type structured --source "slot"

# Session listesi
list_log_sessions --limit 5

# Session özeti
get_session_summary

# Console logları (main process, daha az detaylı)
read_electron_logs --type console --tail 50
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
