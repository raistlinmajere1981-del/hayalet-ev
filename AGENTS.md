# Hayalet-ev Development Guide

## ⚠️ ZORUNLU: Mode Status Bar (Her Cevabın Başında)

**Her cevabın başında aktif modu gösteren status bar kullanılmalıdır:**

| Mod | Status Bar | Ne Zaman |
|-----|------------|----------|
| ⚡ QUICK | `╔══ ⚡ QUICK MODE ══╗` | Basit syntax, trivial işler |
| 🔧 STANDARD | `┏━━ 🔧 STANDARD MODE ━━┓` | Normal geliştirme |
| 🔬 RESEARCH | `┌── 🔬 RESEARCH MODE ──┐` | Web araştırma gerekli |
| 🧠 ULTRATHINK | `╔══ 🧠 ULTRATHINK MODE ══╗` | Kritik kararlar, mimari |

**Mod geçişlerinde:** `━━━ MOD DEĞİŞİKLİĞİ: STANDARD → RESEARCH ━━━`

> Detaylı kurallar: `.rovodev/auto-triggers.md` ve `.rovodev/persona.md`

---

## 🗣️ Dil Politikası (ZORUNLU)

- **Asistan ↔ Kullanıcı iletişimi:** Tamamen Türkçe.
- **Hayalet-ev UI metinleri:** Tamamen Türkçe.
- **Kod tarafı:** Değişken/fonksiyon/class adları ve yorumlar **tamamen İngilizce** olmalı.

---

## 📋 Project Overview

**Hayalet-ev** (Ghost House) Electron tabanlı multi-AI chat platformudur.

- **Yetenekler:** Multi-AI, AI↔AI protokolü, Google Drive arşiv, Whisper, MCP entegrasyonu
- **Tech Stack:** Electron 39+ (Node.js ESM), TypeScript (strict), Vite 7.3, SQLite
- **Mimari:** Main + Renderer + Webviews
- **Sürüm:** `5.5.0`

---

## 🚨 MCP Tool Kullanım Direktifi (KRİTİK)

**Dosya ve geliştirme işlemleri için SADECE `hayalet-ev` MCP server kullanılmalıdır.**

- Tüm tool listesi: `hev_list_tools`
- Çalıştırma formatı: `mcp__hayalet_ev__invoke_tool` ile `hev_*` tool’ları
- **❌ Hayalet-ev Mcp Sunucusu Aktif Olduğu Sürece Kullanma:** `open_files`, `grep`, `bash`, `expand_folder`, `create_file`

### Sık Kullanılan Prefix’ler
- `hev_fs_*` (dosya)
- `hev_dev_*` (dev araçları)
- `hev_context_*` (context)
- `hev_git_*` (git/PR)
- `hev_web_*` (web search)
- `hev_run_*` (workflow)
- `hev_*` (Electron/CDP)

---

## 🏗️ Architecture Overview

> Detaylı rehber: `.rovodev/architecture.md`

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
| TrafficManager | `src/js/modules/traffic-manager.ts` | State tracking |
| DatabaseManager | `electron/database/index.ts` | SQLite yönetimi |
| SettingsManager | `electron/settings-manager.ts` | JSON config |
| ErrorBoundary | `src/js/modules/error-boundary.ts` | Global hata yakalama |
| IPC Client | `src/js/modules/ipc-client.ts` | Type-safe IPC wrapper |

---

## ⚠️ Dikkat Edilmesi Gerekenler

### Silinmemesi Gereken Modüller
| Modül | Not |
|-------|-----|
| `file-utils.ts` | Tüm file upload metodları için kritik - **SİLME!** |
| `url-utils.ts` | URL işlemleri için kritik |
| `provider-registry.ts` | 10+ dosya tarafından kullanılıyor |

### IPC Üzerinden Çağrılan Modüller
Doğrudan import edilmez, `electron/main.ts` IPC handler’ları üzerinden çağrılır:
- `device-manager.ts`, `screenshot-manager.ts`, `whisper-manager.ts`
- `googledrive-manager.ts`, `server-commands.ts`

### Provider Config’leri
AI siteleri DOM yapılarını sık değiştirir. Selector değişikliğinde manuel test yap:
- `providers/chatgpt/config.ts`
- `providers/gemini/config.ts`
- `providers/grok/config.ts`

---

## 🔑 Key Concepts (Özet)

> Detaylı rehber: `.rovodev/concepts.md`

| Kavram | Dosya | Açıklama |
|--------|-------|----------|
| Settings | `electron/settings-manager.ts` | `./config/settings.json` yönetimi |
| IPC | `electron/preload.cjs` | `window.electronAPI.*` metodları |
| Typed IPC | `src/js/modules/ipc-client.ts` | Type-safe IPC wrapper |
| Providers | `src/js/modules/webview/providers/` | ChatGPT, Grok, Gemini, OpenCode |
| Database | `electron/database/` | SQLite, accountId bazlı |
| Traffic | `src/js/modules/traffic/` | Loading, thinking, send tracking |
| SlotState | `src/js/modules/slot/state-machine.ts` | Robust state machine |
| URL Utils | `src/js/modules/webview/methods/shared/url-utils.ts` | URL validation (`isSlotUrlExcluded`) |

**IPC Quick Reference:** `src/js/global.d.ts`
- Settings: `loadSettings()`, `saveSettings()`, `createAccount()`, `assignAccountToSlot()`
- Database: `dbGetConversations()`, `dbGetMessages()`, `dbSyncMessages()`, `dbSaveConversation()`
- Window: `windowMinimize()`, `windowMaximize()`, `windowClose()`

**Not:** `window.electronAPI?.getSettings()` yoktur → **`loadSettings()`** kullan.

---

## 🧾 Log Sistemi (Özet)

> Detaylı rehber: `.rovodev/logging.md`

- **Console yerine:** `LogManager.addEvent()` kullan.
- **Birleşik log:** `console-001.log` (Main + Renderer).
- **Visibility seviyeleri:** Toast / Panel / Verbose.

---

## 🎯 Development Guidelines

- **Async:** `async/await` kullan, callback yok
- **Error Handling:** tüm async işlemler `try/catch`
- **Naming:** camelCase / PascalCase
- **Documentation:** Markdown dosyaları Türkçe
- **IPC Safety:** `ipcRenderer.invoke()` + input validate

---

## ⚙️ Günlük Komutlar (Özet)

```bash
npm start
npm run lint
npm run check-types
npm run check
```

Test timeout detayları: `.rovodev/testing.md`

---

## 🛠️ Tool Kullanım Best Practices (Özet)

> Detaylı rehber: `.rovodev/auto-triggers.md`

| Tier | Tool | Ne Zaman |
|------|------|---------|
| 1 | `hev_fs_find_and_replace` | Tek satır, basit string |
| 2 | `hev_dev_edit_lines` | Multi-line blok |
| 3 | `hev_fs_bash` | Batch değişiklik |

**Kural:** Önce dry-run + preview + syntax validation.

---

## 🔍 Syntax Checker (YENİ - v1.9.0)

Edit işlemlerinden sonra dosyalarda syntax hatası kontrolü:

### `hev_dev_check_syntax`

**Ne Zaman Kullan:**
- Multi-line edit sonrası
- Refactoring sonrası
- Parantez/bracket dengesi şüphesi
- JSON dosyası validation

**Yetenekler:**
- ✅ Parantez dengesi: `()`, `{}`, `[]`
- ✅ ESLint syntax check (JS/TS)
- ✅ TypeScript type check
- ✅ JSON validation

**Örnek Kullanım:**
```javascript
// Edit yaptıktan sonra:
await hev_dev_edit_lines('file.js', { operation: 'replace', ... });

// Hemen kontrol et:
await hev_dev_check_syntax('file.js', { 
  check_brackets: true,
  check_eslint: true 
});
```

**Çıktı:**
```
🔍 Syntax Kontrolü: file.js
──────────────────────────────────────────────────
❌ Parantez Dengesi: BOZUK
   Süslü Parantez: 4 açık / 5 kapalı
──────────────────────────────────────────────────
❌ 1 hata bulundu
```

---

## 🛠️ Troubleshooting (Özet)

- Electron başlamıyor → `rm -rf node_modules && npm install`
- CDP bağlantı yok → `npm start` ile app açık mı kontrol et
- IPC çalışmıyor → preload.cjs ve main.ts channel isimleri

Detaylar: `.rovodev/testing.md`

---

## 🧙 ROVO - AI Asistan Protokolleri

- Modlar ve tetikleyiciler: `.rovodev/auto-triggers.md`
- Persona detayları: `.rovodev/persona.md`
- Not defteri: `.rovodev/notebook.md`

---

## 🔗 Quick Links

- `.rovodev/context.md` - Session context
- `.rovodev/architecture.md` - Mimari detaylar
- `.rovodev/concepts.md` - Key concepts
- `.rovodev/cdp.md` - CDP tool’ları
- `.rovodev/logging.md` - Log sistemi
- `.rovodev/testing.md` - Test workflow’ları
- `.rovodev/persona.md` - ROVO karakter profili
- `.rovodev/auto-triggers.md` - Mod kuralları
- `.rovodev/notebook.md` - ROVO not defteri

---

**Last Updated:** 2026-01-28  
**Version:** 5.5.0
