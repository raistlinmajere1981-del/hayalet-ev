# Hayalet-ev Development Guide

## 📋 Project Overview

**Hayalet-ev** (Ghost House) is an Electron-based multi-AI chat interface platform that enables:
- **Multi-AI Integration:** ChatGPT, Gemini, Grok, and extensible for other providers
- **AI-to-AI Communication:** Protocol-based AI conversation system
- **Conversation Archiving:** Automatic conversation storage with Google Drive sync
- **Plugin System:** Extensible architecture for custom commands and features
- **Voice & Screenshots:** Whisper integration for voice input, screenshot capture
- **MCP Server:** Model Context Protocol server for AI assistant integration

### Tech Stack
- **Runtime:** Electron 39+ with Node.js (ESM modules)
- **Language:** TypeScript (strict mode)
- **Build Tool:** Vite 7.3
- **Architecture:** Multi-process (Main + Renderer + Webviews)
- **Storage:** SQLite + Google Drive API

### Version
Current: `5.4.0`

---

## 🚨 MCP Tool Kullanım Direktifi (KRİTİK)

**Bu projede dosya ve geliştirme işlemleri için SADECE `hayalet-ev` MCP server kullanılmalıdır.**

### Neden?
- `hayalet-ev` MCP server proje için özelleştirilmiş 34 tool içerir
- Collapsed view, code parsing, proje analizi gibi özel özellikler sunar
- Default MCP'ler (filesystem-tools vb.) bu projede verimsiz çalışır

### Kullanılacak Tool Prefix'leri
| Prefix | Açıklama | Örnek |
|--------|----------|-------|
| `fs_*` | Dosya işlemleri | `fs_open_files`, `fs_grep`, `fs_bash` |
| `dev_*` | Geliştirme araçları | `dev_analyze_project`, `dev_find_unused` |
| CDP tools | Electron kontrolü | `check_electron_connection`, `take_cdp_screenshot` |

### ❌ KULLANMA
- `open_files` → Yerine `fs_open_files` kullan
- `grep` → Yerine `fs_grep` kullan  
- `bash` → Yerine `fs_bash` kullan
- `expand_folder` → Yerine `fs_expand_folder` kullan
- `create_file` → Yerine `fs_create_file` kullan

### ✅ KULLAN
```
mcp__hayalet_ev__invoke_tool ile:
- fs_open_files, fs_create_file, fs_delete_file, fs_move_file
- fs_expand_code_chunks, fs_find_and_replace, fs_grep
- fs_expand_folder, fs_bash, fs_create_plan
- dev_analyze_project, dev_bootstrap_context, dev_find_unused
- dev_generate_diagram, dev_update_cache, dev_edit_lines
```

---

## 🏗️ Architecture Overview

> **Detaylı rehber:** `.rovodev/architecture.md`

```
Main Process (electron/main.ts)
├── Renderer Process (src/index.html → CoreEngine)
├── AI Provider Webviews (isolated contexts)
└── IPC Bridge (preload.cjs)
```

### Kritik Modüller
| Modül | Konum | Rol |
|-------|-------|-----|
| CoreEngine | `src/js/modules/core-engine.ts` | Ana koordinatör |
| SlotController | `src/js/modules/slot-controller.ts` | Slot lifecycle + State machine |
| WebviewManager | `src/js/modules/webview-manager.ts` | Webview lifecycle |
| TrafficManager | `src/js/modules/traffic-manager.ts` | State tracking (race-condition korumalı) |
| DatabaseManager | `electron/database/index.ts` | SQLite yönetimi |
| SettingsManager | `electron/settings-manager.ts` | JSON config |
| ErrorBoundary | `src/js/modules/error-boundary.ts` | Global hata yakalama |
| IPC Client | `src/js/modules/ipc-client.ts` | Type-safe IPC wrapper |

---

## ⚠️ Dikkat Edilmesi Gerekenler

### Silinmemesi Gereken Modüller
Bu modüller "kullanılmıyor" gibi görünebilir ama kritik bağımlılıkları var:

| Modül | Not |
|-------|-----|
| `file-utils.ts` | Tüm file upload metodları için kritik - **SİLME!** |
| `url-utils.ts` | URL işlemleri için kritik |
| `provider-registry.ts` | 10+ dosya tarafından kullanılıyor |

### IPC Üzerinden Çağrılan Modüller
Bu modüller doğrudan import edilmez, `electron/main.ts`'de IPC handler'ları üzerinden çağrılır:
- `device-manager.ts`, `screenshot-manager.ts`, `whisper-manager.ts`
- `googledrive-manager.ts`, `server-commands.ts`

### Provider Config'leri
AI siteleri DOM yapılarını sık değiştiriyor. Selector değişikliği yapmadan önce ilgili AI sitesinde manuel test yap:
- `providers/chatgpt/config.ts`
- `providers/gemini/config.ts`
- `providers/grok/config.ts`

---

## 🔑 Key Concepts

> **Detaylı rehber:** `.rovodev/concepts.md`

| Kavram | Dosya | Açıklama |
|--------|-------|----------|
| Settings | `electron/settings-manager.ts` | `./config/settings.json` yönetimi |
| IPC | `electron/preload.cjs` | `window.electronAPI.*` metodları |
| Typed IPC | `src/js/modules/ipc-client.ts` | Type-safe IPC wrapper (`IPC.invoke()`) |
| IPC Types | `src/js/types/ipc-channels.ts` | IPC channel tip tanımları |
| Providers | `src/js/modules/webview/providers/` | ChatGPT, Grok, Gemini, OpenCode |
| Database | `electron/database/` | SQLite, accountId bazlı |
| Traffic | `src/js/modules/traffic/` | Loading, thinking, send tracking |
| Relay | `src/js/modules/relay/` | AI↔AI, AI↔Asistan |
| SlotState | `src/js/modules/slot/state-machine.ts` | Robust state machine (EMPTY→CONNECTED) |
| ErrorBoundary | `src/js/modules/error-boundary.ts` | Global hata yakalama |
| URL Utils | `src/js/modules/webview/methods/shared/url-utils.ts` | Merkezi URL validation (`isSlotUrlExcluded`) |

### IPC API Quick Reference (ÖNEMLİ!)

> **Tam tanımlar:** `src/js/global.d.ts`

Renderer'da `window.electronAPI.*` metodları kullanılır. **Dikkat:** Metod isimlerini doğru kullan!

| Kategori | Metod | Açıklama |
|----------|-------|----------|
| **Settings** | `loadSettings()` | Ayarları yükle (❌ `getSettings` değil!) |
| | `saveSettings(settings)` | Ayarları kaydet |
| | `createAccount(data)` | Yeni hesap oluştur |
| | `assignAccountToSlot(slot, accountId)` | Hesabı slota ata |
| **Database** | `dbGetConversations({ accountId })` | Konuşmaları getir → `{ success, data: [...] }` |
| | `dbGetMessages({ accountId, conversationId })` | Mesajları getir → `{ success, data: [...] }` |
| | `dbSyncMessages({ ... })` | Mesajları senkronize et |
| | `dbSaveConversation(conv)` | Konuşma kaydet |
| **Window** | `windowMinimize()` | Pencereyi küçült |
| | `windowMaximize()` | Pencereyi büyüt |
| | `windowClose()` | Pencereyi kapat |

```typescript
// ❌ YANLIŞ - metod yok!
const settings = await window.electronAPI?.getSettings?.();

// ✅ DOĞRU
const settings = await window.electronAPI?.loadSettings?.();
const accounts = settings?.accounts || [];

// Database sonuçları { success, data } formatında döner
const result = await window.electronAPI?.dbGetConversations?.({ accountId });
const conversations = result?.data || [];  // ❌ result direkt array değil!
```

### Log Sistemi (ZORUNLU)

> **Detaylı rehber:** `.rovodev/logging.md`

```typescript
// ❌ YANLIŞ
console.log("mesaj");

// ✅ DOĞRU  
import { LogManager } from "./modules/log-manager.ts";
LogManager.addEvent("source", "info", "mesaj");

// ✅ DAHA İYİ - Visibility ile
LogManager.toast("entrance", "success", "Bağlandı");     // Seviye 1 - Toast
LogManager.panel("system", "info", "Init tamamlandı");  // Seviye 2 - Panel
LogManager.verbose("traffic", "debug", "State change"); // Seviye 3 - Debug
```

### Log Analizi (ÖNEMLİ!)

**`console-001.log` artık birleşik log dosyasıdır (Main + Renderer)!**

```bash
# ✅ DOĞRU - Birleşik loglar (main + renderer)
cat logs/SESSION_ID/console-001.log | tail -50

# MCP tool ile (default: console)
read_electron_logs --tail 100

# JSON analizi için structured log
read_electron_logs --type structured --tail 100
```

| Dosya | İçerik | Kullanım |
|-------|--------|----------|
| `console-001.log` | Birleşik loglar (Main + Renderer) | ✅ Ana analiz |
| `structured.jsonl` | JSON format (detaylı analiz) | Programatik analiz |
| `error.log` | Sadece hatalar | Hızlı kontrol |

### 3 Seviyeli Visibility

| Seviye | Ad | Görünüm | Kullanım |
|--------|-----|---------|----------|
| 1 | Toast | Toast+Panel+Modal | Bağlantı, hata, başarı |
| 2 | Panel | Panel+Modal | Init, db, sync |
| 3 | Verbose | Sadece Modal | Debug, state, traffic |

---

## 🎯 Development Guidelines

> **Detaylı rehber:** `.rovodev/concepts.md`

### Code Style
- **Language:** TypeScript (ES2022+, ESM modules, strict mode)
- **Async:** Always use `async/await`, never callbacks
- **Error Handling:** Always wrap async operations in try-catch
- **Naming:** camelCase for functions, PascalCase for classes
- **Documentation:** All Markdown files in Turkish

### File Naming
- `*-manager.ts` → Singleton services
- `*-handler.ts` → Event processors
- `*-utils.ts` → Helper functions
- `index.ts` → Barrel exports

### IPC Safety
- **Never** use `remote` module
- **Always** use `ipcRenderer.invoke()` for async operations
- **Always** validate input in main process handlers

---

## 🔷 TypeScript

Proje **%100 TypeScript** ve **strict mode** ile çalışıyor.

| Bileşen | Strict Mode |
|---------|-------------|
| Renderer (src/js) | ✅ `strict: true` |
| Electron (electron/) | ✅ `strict: true` |
| MCP Server (mcp-server/) | ✅ `strict: true` |
| Preload (.cjs) | CommonJS (zorunlu) |

### Kontrol Komutları
```bash
npm run lint          # ESLint + TypeScript
npm run check-types   # tsc --noEmit
npm run check         # lint + check-types
```

### Yeni IPC Metodu Ekleme
`src/js/global.d.ts`'i güncelle:
```typescript
interface Window {
  electronAPI?: {
    myNewMethod: (param: string) => Promise<{ success: boolean }>;
  };
}
```

---

## 🚀 Common Tasks

> **Detaylı rehber:** `.rovodev/testing.md`

### Temel Komutlar
```bash
npm start              # Uygulamayı başlat
npm run lint           # Kod kontrolü
npm run pre-commit     # Commit öncesi kontrol
```

### Test Timeout Süreleri
| Komut | Timeout | Açıklama |
|-------|---------|----------|
| `npm start` | 40 sn | Electron + Vite başlatma |
| `npm run lint` | 80 sn | ESLint tüm proje |
| `npm run check-types` | 80 sn | TypeScript type-check |
| `npm run check` | 120 sn | lint + check-types |

**Not:** Bu süreler AI asistan testleri için önerilen minimum bekleme süreleridir.

### Yeni Session Başlangıcı
```bash
cat .rovodev/context.md   # Context dosyasını oku
# veya MCP tool kullan:
dev_bootstrap_context     # Session context oluştur
```

---

## 🎯 CDP & MCP Tools

> **Detaylı rehber:** `.rovodev/cdp.md`

MCP Server v1.7.0 - **47 tool** (CDP + Filesystem + Dev Tools + Recycle Bin + Diff)

### CDP Tools (Electron kontrolü)
```
check_electron_connection, click_element_by_selector, take_cdp_screenshot
```

### Filesystem Tools (Dosya işlemleri)
```
fs_open_files, fs_create_file, fs_grep, fs_bash, fs_expand_folder
fs_show              # Dosya içeriğini satır numaralarıyla göster
```

### Recycle Bin & Backup (Güvenli dosya işlemleri)
```
fs_delete_file       # Silme (çöp kutusuna, geri alınabilir)
fs_trash_list        # Çöp kutusunu listele
fs_restore           # Silinen dosyayı geri yükle
fs_trash_empty       # Çöp kutusunu boşalt
fs_backup            # Dosya yedeği al (timestamped)
fs_undo              # Son işlemi geri al
fs_history           # İşlem geçmişi
```

### Diff Tools (Karşılaştırma)
```
fs_diff              # İki dosyayı karşılaştır (unified diff)
fs_diff_content      # İki içeriği karşılaştır
```

### Dev Tools (Geliştirme araçları)
```
dev_analyze_project    # Proje analizi
dev_bootstrap_context  # Context üret
dev_find_unused        # Unused exports
dev_generate_diagram   # Bağımlılık diagramı
dev_update_cache       # Cache güncelle
dev_edit_lines         # Satır bazlı düzenleme
dev_git_diff           # Git değişikliklerini göster
dev_lint_file          # Tek dosyada ESLint
dev_search_symbol      # Projede sembol ara
dev_test_run           # Test çalıştır
```

### Provider Tools (Selector Doğrulama)

AI provider selector'larını canlı test etmek için araçlar:

```
list_provider_webviews       # Provider ve webview listesi
list_provider_selectors      # Config'deki selector'ları listele
validate_provider_selectors  # Selector'ları canlı webview'da test et
inspect_provider_element     # Webview'da element inspect et
```

**Kullanım örneği:**
```bash
# ChatGPT selector'larını doğrula
validate_provider_selectors provider=chatgpt

# Belirli element inspect et
inspect_provider_element provider=chatgpt selector='[data-message-author-role="user"]'
```

### MCP Server Logging
MCP tool çağrıları ve hatalar `mcp-server/logs/mcp-server.log` dosyasına kaydedilir.

```bash
# MCP log'larını görüntüle
cat mcp-server/logs/mcp-server.log | tail -20

# JSON formatında - jq ile parse
cat mcp-server/logs/mcp-server.log | jq -r 'select(.level=="error")'
```

**Not:** `fs_create_file` için maksimum içerik boyutu 500KB. 10KB üzeri dosyalar otomatik olarak bash heredoc ile yazılır (LLM token limit sorunlarını önler).

### Web Tools (Arama ve İçerik)

**Araçlar:**
```
web_search             # SearXNG ile web araması (Google, Bing, DuckDuckGo, GitHub, StackOverflow)
web_fetch              # URL'den sayfa içeriği çek (temiz markdown)
web_search_and_fetch   # Arama yap + ilk N sonucun içeriğini çek (detaylı araştırma)
```

**Kurulum:** SearXNG gerektirir:
```bash
sudo docker compose -f docker-compose.searxng.yml up -d
```

#### 🎯 Web Search Kullanım Stratejisi

**MUTLAKA KULLAN - Bu durumlarda web search zorunlu:**

| Durum | Neden | Örnek Sorgu |
|-------|-------|-------------|
| Spesifik hata mesajı | Güncel çözümler değişir | `"ECONNREFUSED" Docker Node.js solution` |
| Versiyon-spesifik soru | API'ler değişir | `React 19 useOptimistic example` |
| "Güncel/en son/2024/2025" içeren sorular | Eski bilgi geçersiz | `TypeScript 5.4 new features` |
| Bilinmeyen kütüphane/teknoloji | Yerleşik bilgi yetersiz | `Bun runtime vs Node.js` |
| Best practices sorusu | Standartlar değişir | `Docker security best practices 2025` |
| Performans karşılaştırması | Benchmark'lar güncellenir | `Vite vs Webpack build speed` |

**KULLANMA - Bu durumlarda gereksiz:**

| Durum | Neden |
|-------|-------|
| Temel syntax soruları | Yerleşik bilgi yeterli |
| Proje-spesifik kod analizi | Cevap projede, internette değil |
| Basit algoritma soruları | Değişmeyen bilgi |
| Bu projenin kendi dosyaları hakkında | `fs_grep`, `fs_open_files` kullan |

#### 🔍 Arama Stratejisi

```
1. HIZLI KONTROL (emin değilsen):
   web_search query="konu" limit=5
   → Link listesi al, genel fikir edin

2. DETAYLI ARAŞTIRMA (çözüm gerekiyorsa):
   web_search_and_fetch query="konu" fetch_count=3
   → Tam içerik çek, analiz et

3. BİLİNEN KAYNAK (dokümantasyon):
   web_fetch url="https://docs.example.com/api"
   → Direkt içerik çek
```

#### 📝 Etkili Sorgu Yazma

```bash
# ❌ KÖTÜ - çok genel
web_search query="React error"

# ✅ İYİ - spesifik hata + context
web_search query="React useEffect cleanup function memory leak"

# ✅ İYİ - versiyon belirt
web_search query="Node.js 20 fetch API native"

# ✅ İYİ - çözüm odaklı
web_search query="Docker container cannot connect to host network solution"
```

#### 🏷️ Kategori ve Engine Seçimi

```bash
# Kod/programlama soruları
web_search query="..." categories="it" engines="github,stackoverflow"

# Genel bilgi
web_search query="..." categories="general"

# Akademik/bilimsel
web_search query="..." categories="science" engines="google scholar"

# Haberler/güncel
web_search query="..." categories="news" time_range="month"
```

#### ⚡ Performans İpuçları

| Parametre | Hızlı Kontrol | Detaylı Araştırma |
|-----------|---------------|-------------------|
| `limit` | 3-5 | 10 |
| `fetch_count` | - | 2-3 |
| `max_content_length` | - | 10000 |

**Dil Stratejisi:**
- Teknik terimler için **İngilizce** sorgu (daha fazla sonuç)
- Türkçe kaynak gerekirse `language="tr-TR"` ekle

### Progress Göstergesi
Uzun süren işlemler (analiz, lint, test) stderr'e progress mesajları yazar:

```
[PROGRESS] ⏳ Proje analizi başladı...
[PROGRESS] [33%] electron taranıyor...
[PROGRESS] ✅ Proje analizi 175 dosya analiz edildi (0.1s)
```

Progress destekleyen tool'lar:
- `dev_analyze_project`
- `dev_find_unused`
- `dev_lint_file`
- `dev_test_run`
- `fs_create_file`
- `fs_find_and_replace`

---

## 📁 Important Files

| Dosya | Açıklama |
|-------|----------|
| `electron/main.ts` | Ana process, IPC handlers |
| `electron/preload.cjs` | contextBridge API |
| `src/js/modules/core-engine.ts` | Renderer koordinatör |
| `src/js/modules/slot-controller.ts` | Slot lifecycle + state machine |
| `src/js/modules/error-boundary.ts` | Global hata yakalama |
| `src/js/modules/ipc-client.ts` | Type-safe IPC wrapper |
| `src/js/types/ipc-channels.ts` | IPC channel tip tanımları |
| `src/js/modules/slot/state-machine.ts` | Robust state machine |
| `electron/handlers/ipc-database.ts` | Modüler database IPC handlers |
| `mcp-server/index.ts` | MCP protocol server |

---

## 🔒 Security

- ✅ `contextIsolation: true`
- ✅ `nodeIntegration: false`
- ✅ `sandbox: true`
- IPC kanalları main process'te validate edilir

---

## 🛠️ Troubleshooting

| Sorun | Çözüm |
|-------|-------|
| Electron başlamıyor | `rm -rf node_modules && npm install` |
| CDP bağlantı yok | `npm start` ile uygulama çalışıyor mu? |
| IPC çalışmıyor | preload.cjs ve main.ts channel isimlerini kontrol et |

> Detaylı troubleshooting: `.rovodev/testing.md`

---

## 🚀 Özel Protokoller

| Komut | Dosya | Açıklama |
|-------|-------|----------|
| `ULTRATHINK` | `.rovodev/ultrathink.md` | Derin analiz modu - kısa cevaplar yerine çok boyutlu analiz |

**Kullanım:** Herhangi bir sorudan önce `ULTRATHINK:` yazın.

**Örnek:**
```
ULTRATHINK: Bu mimarinin avantajları ve dezavantajları neler?
```

---

## 🔗 Quick Links

- `.rovodev/context.md` - **YENİ SESSION İÇİN ÖNCE BUNU OKU**
- `.rovodev/architecture.md` - Mimari detayları
- `.rovodev/concepts.md` - Key concepts detayları
- `.rovodev/cdp.md` - CDP tool'ları
- `.rovodev/logging.md` - Log sistemi
- `.rovodev/testing.md` - Test workflow'ları
- `.rovodev/ultrathink.md` - ULTRATHINK protokol detayları

---

**Last Updated:** 2026-01-18  
**Version:** 5.4.0
