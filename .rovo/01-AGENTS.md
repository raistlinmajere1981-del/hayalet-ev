# 🤖 Hayalet-ev Agent Development Guide

**Version:** 6.0.0 (Enhanced Tool Management System)
**Last Updated:** 2026-01-31
**Tool Count:** 99

---

## 🎯 TOP 10 Most Important Tools

These tools cover 80% of daily tasks:

### 1. `hev_session_bootstrap` ⚡ **NEW!**

**Description:** Yeni session başlatma - tüm context'i otomatik yükle (AGENTS.md, MCP health, project status). Session başında agent'ı anında 'ready' duruma getirir.

**Priority:** critical | **Complexity:** simple | **Risk:** low

**Use Cases:**
- Session başlangıcında context load
- Agent hazırlığı
- Project status quick check

**⚠️ Agent Guidance:** Her yeni session başında MUTLAKA çalıştır. `mode: "quick"` yeterli. Agent 10 iterasyon yerine 2 iterasyonda hazır olur.

**Parameters:**
- `mode`: "minimal" | "quick" (default) | "full"
- `auto_fix_mcp`: boolean (default: false)
- `return_format`: "summary" (default) | "detailed" | "json"

**Example:**
```typescript
// Session başında
hev_session_bootstrap({ mode: "quick" })
// → ✅ Session ready! MCP healthy (101 tools). Hayalet-ev v5.4.0 on feature/css-centralization.
```

**Related Tools:** `hev_mcp_health`, `hev_dev_analyze_project`, `hev_dev_typescript_dashboard`

---

### 2. `hev_mcp_health`

**Description:** Hayalet-ev MCP'nin sağlık durumunu kontrol et. Eğer bu tool çalışıyorsa, MCP aktif ve built-in override sistemi çalışıyor demektir.

**Priority:** critical | **Complexity:** simple | **Risk:** low

**Use Cases:**
- Session başlangıcında MCP sağlığını kontrol et
- Tool çalışmıyorsa troubleshoot

**⚠️ Agent Guidance:** Her session başında veya tool hatası aldığında kullan. MCP çalışmazsa built-in toollar aktif olur (RISKLI!).

**Related Tools:** `hev_list_tools`, `hev_session_bootstrap`

---

### 3. `hev_suggest_tool`

**Description:** AI agent'a tool önerisi yap (intent-based discovery). Ne yapmak istediğini söyle, sana en uygun toolları önerir.

**Priority:** critical | **Complexity:** simple | **Risk:** low

**Use Cases:**
- Tool karar verme
- Workflow planlama
- 97 tool arasında yol bulma

**⚠️ Agent Guidance:** 97 tool arasında kayboluyorsan bu tool'u kullan. Intent-based smart search.

**Related Tools:** `hev_tool_workflow`, `hev_list_tools`

---

### 4. `hev_list_tools`

**Description:** Hayalet-ev MCP tool'larını kategorize ederek listele (97 tool)

**Priority:** high | **Complexity:** simple | **Risk:** low

**Use Cases:**
- Tool keşfetme
- Kategori bazlı araştırma
- Tool count doğrulama

**⚠️ Agent Guidance:** Tüm toolları görmek yerine hev_suggest_tool veya kategori bazlı arama kullan. 97 tool çok fazla!

**Related Tools:** `hev_suggest_tool`, `hev_tool_workflow`

---

### 5. `hev_tool_workflow`

**Description:** Belirli bir senaryo için önerilen tool workflow'unu göster. Step-by-step guide sağlar.

**Priority:** high | **Complexity:** simple | **Risk:** low

**Use Cases:**
- Karmaşık senaryolar için adım adım kılavuz
- Workflow planlama

**⚠️ Agent Guidance:** TypeScript/refactor gibi karmaşık işlemler için workflow kullan.

**Related Tools:** `hev_suggest_tool`

---

### 6. `hev_dev_register_tool`

**Description:** Yeni tool otomatik olarak handlers, registry ve index'e ekler (boilerplate automation)

**Priority:** high | **Complexity:** complex | **Risk:** medium

**Use Cases:**
- Register new tool with boilerplate automation
- Auto-add to handlers, registry, and index
- Streamline tool development workflow

**⚠️ Agent Guidance:** Use this for adding new MCP tools. Combines with npm run tool:register for full workflow. Automates handler/registry registration.

**Related Tools:** `hev_dev_analyze_project`, `hev_fs_show`

---

## 🔍 Tool Discovery System

Don't memorize 99 tools! Use intent-based discovery:

```typescript
// What do you want to do?
hev_suggest_tool({ intent: "TypeScript hatalarını düzelt" })
// → Returns: recommended tools + workflows

// Need step-by-step guide?
hev_tool_workflow({ scenario: "typescript-fix-large" })
// → Returns: detailed workflow with mandatory steps
```

## 📚 Tool Categories (4 categories)

### 💚 core (4 tools)

- ⭐ `hev_mcp_health` - Hayalet-ev MCP'nin sağlık durumunu kontrol et. Eğer bu tool çalışıyorsa, MCP aktif ve built-in override sistemi çalışıyor demektir.
- 🔥 `hev_list_tools` - Hayalet-ev MCP tool'larını kategorize ederek listele (97 tool)
- ⭐ `hev_suggest_tool` - AI agent'a tool önerisi yap (intent-based discovery). Ne yapmak istediğini söyle, sana en uygun toolları önerir.
- 🔥 `hev_tool_workflow` - Belirli bir senaryo için önerilen tool workflow'unu göster. Step-by-step guide sağlar.

### ⚡ electron (1 tools)

- ✅ `hev_test_electron` - Hayalet-ev Electron uygulamasını test et

### 🔹 uncategorized (93 tools)

- ✅ `hev_read_electron_logs` - Electron console ve error loglarını oku. Gelişmiş filtreleme: source (MAIN, RENDERER, WEBVIEW-AI1, etc.), level (LOG, WARN, ERROR), içerik arama, correlation ID ile işlem takibi.
- ✅ `hev_list_log_sessions` - Mevcut log session'larını listele. Her session bir uygulama çalıştırmasını temsil eder.
- ✅ `hev_get_error_hints` - Belirli bir hata mesajı için AI debugging ipuçları al. Bilinen hata pattern'lerini eşleştirir ve çözüm önerileri sunar.
- ✅ `hev_get_session_summary` - Belirli bir session'ın özet bilgilerini al (hata sayısı, süre, son durum)
- ✅ `hev_collect_error_context` - Hata bağlamını toplayıp özetler (komut, log, kategori, öneri)
- ...and 88 more

### 🔧 development (1 tools)

- 🔥 `hev_dev_register_tool` - Yeni tool otomatik olarak handlers, registry ve index'e ekler (boilerplate automation)

## 🛡️ Safety Rules (MANDATORY)

### Before ANY Edit
```typescript
❌ WRONG: hev_dev_edit_lines({ ... })

✅ RIGHT:
hev_fs_show({ file_path: 'file.ts', start_line: 100, end_line: 120 })
// Then edit...
hev_dev_edit_lines({ ... })
```

### After ANY Edit
```typescript
hev_dev_edit_lines({ ... })
hev_dev_check_syntax({ file_path: 'file.ts' })  // ← MANDATORY
```

---
**Full Reference:** [mcp-server/AGENTS.md](../mcp-server/AGENTS.md)
**Tool List:** [.rovo/_metadata/TOOL-LIST.md](./_metadata/TOOL-LIST.md)
