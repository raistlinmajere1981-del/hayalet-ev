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
> **YENİ:** Duplicate önleme rehberi: `.rovodev/safe-editing.md`

| Tier | Tool | Ne Zaman |
|------|------|---------|
| 1 | `hev_fs_find_and_replace` | Tek satır, basit string |
| 2 | `hev_dev_edit_lines` | Multi-line blok (ÖNERİLEN) |
| 3 | `hev_fs_bash` | Batch değişiklik |

**Kural:** Önce dry-run + preview + syntax validation.

### 🚨 KRİTİK UYARI: DUPLICATE SATIR SORUNU

**❌❌❌ ROVODEV BUILT-IN TOOL'LARI KULLANMA! ❌❌❌**

**PROBLEM:**
- Rovodev'in `find_and_replace_code` tool'u **BUGGY!**
- Tek satır replace bile **duplicate** oluşturuyor!
- Context preview **YANILTICI** - güzel görünüyor ama dosya **BOZULUYOR!**
- Özellikle büyük dosyalarda **CASCADE HATA** başlıyor
- 12+ edit sonunda 8 hata → 97 hata olabiliyor!

**❌ ASLA KULLANMA:**
```python
find_and_replace_code(...)      # ← DUPLICATE OLUŞTURUR!
expand_code_chunks(...)         # ← Güvenilmez
```

**✅ SADECE BUNLARI KULLAN:**
```python
# Tier 1: Küçük değişiklikler
hev_fs_find_and_replace(...)    # MCP tool (güvenli)

# Tier 2: Multi-line edit (EN GÜVENLİ)
hev_dev_edit_lines(...)         # Context preview + syntax check

# Tier 3: Önce göster, sonra karar ver
hev_fs_show(...)                # Dosyayı incele
```

**🛡️ ZORUNLU WORKFLOW (4 ADIM):**

```
1️⃣ ÖNCE GÖSTER:
   hev_fs_show('file.ts', startLine, endLine)
   → Mevcut içeriği GÖR, satır numaralarını KONTROL ET

2️⃣ EDIT YAP:
   hev_dev_edit_lines('file.ts', {
     operation: 'replace',
     startLine: X,
     endLine: Y,
     content: '...'
   })
   → Context preview otomatik gelir AMA güvenme!

3️⃣ SYNTAX KONTROL:
   hev_dev_check_syntax('file.ts')
   → Parantez dengesi + ESLint

4️⃣ DOĞRULAMA:
   hev_fs_show('file.ts', startLine-5, endLine+5)
   → Duplicate VAR MI kontrol et!
```

**🚨 DUPLICATE TESPİTİ:**
Eğer context preview'da şöyle bir şey görüyorsan:
```
24 │ const MyClass = {
25 │   const MyClass = {    ← DUPLICATE!
```
**HEMEN DURDUR! Git checkout yap!**

```bash
cd /home/raistlin/hayalet-ev
git checkout -- path/to/file.ts
```

**📖 Detaylı Rehber:**
→ `.rovodev/safe-editing.md`

---

## 🔍 Syntax Checker (v1.9.0)

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

## 🏗️ Structure Visualizer (YENİ - v1.10.0)

"Parantez cehennemi" sorunlarını çözmek için dosya yapısını görselleştir:

### `hev_dev_visualize_structure`

**Ne Zaman Kullan:**
- ❌ Parantez dengesizliği tespit edildiğinde
- 🔥 "Parantez cehennemi" durumlarında
- 🏗️ Büyük refactoring sonrası yapı kontrolü
- 🐛 Hangi scope'un kapanmadığını bulmak için
- 📊 Dosya yapısını anlamak için

**Yetenekler:**
- ✅ **AST Parsing**: Function, class, if, for, while, try, switch hierarchy
- ✅ **Scope Tree**: Nested yapı görselleştirmesi (satır aralıkları)
- ✅ **Bracket Analysis**: Kapanmamış/fazla parantezler (satır + sütun)
- ✅ **Comment Blocks**: Single/multi-line, unclosed detection
- ✅ **Intelligent Fallback**: Syntax hatası varsa token-based

**Örnek Kullanım:**
```javascript
// Parantez problemi tespit edildi:
await hev_dev_check_syntax('file.js');
// → ❌ Parantez Dengesi: BOZUK

// Yapıyı görselleştir:
await hev_dev_visualize_structure('file.js', {
  show_scopes: true,
  show_brackets: true,
  show_comments: true
});
```

**Çıktı:**
```
🔍 Dosya Yapısı: file.js
══════════════════════════════════════════════════

📦 SCOPE HIERARCHY:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
3-14     │ ⚡ processData               ❌ UNCLOSED
  7-10     │ ├─ 🔀 if statement              ✅
  12-?     │ └─ 🔁 for loop                  ❌ UNCLOSED
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

🔗 BRACKET ANALYSIS:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
❌ Kapanmamış parantezler (2):
   Line 3, Col 23: '{' kapanmamış (processData)
   Line 12, Col 30: '{' kapanmamış (for loop)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

💬 COMMENT BLOCKS:
   Line 14: /* ... ❌ UNCLOSED
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

⚠️  ISSUES DETECTED:
   • Line 3: function processData - MISSING closing brace
   • Line 12: for loop - MISSING closing brace
   • Line 14: Unclosed multi-line comment
```

**Workflow:**
```
1. Edit yaptım
2. checkSyntax() → Parantez bozuk!
3. visualizeStructure() → Hangi satırda eksik göster
4. Context Preview ile düzelt
5. Tekrar checkSyntax() → ✅ OK!
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
