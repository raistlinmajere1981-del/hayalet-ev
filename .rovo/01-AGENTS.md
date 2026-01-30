# 📋 Hayalet-ev Development Guide

> **Quick Reference:** [AGENTS.md](../AGENTS.md) - 5 dakikalık özet  
> **MCP Server:** [mcp-server/AGENTS.md](../mcp-server/AGENTS.md) - TypeScript Suite detayları

---

## 🔖 Quick Links

| Başlık | Okuma Süresi | Açıklama |
|--------|--------------|----------|
| [Quick Start](00-QUICK-START.md) | 5 dakika | 5 dakikada başla |
| [Atlas Orchestration](02-ATLAS-ORCHESTRATION.md) | 10 dakika | Orchestration sistemi |
| [MCP Tools](guides/development/10-MCP-TOOLS.md) | 15 dakika | Tool ekosistemi |
| [TypeScript Suite](guides/development/20-TYPESCRIPT-SUITE.md) | 20 dakika | TS Helper Suite |
| [Architecture](guides/architecture/40-ARCHITECTURE.md) | 15 dakika | Mimari detaylar |
| [Concepts](guides/architecture/50-CONCEPTS.md) | 20 dakika | Key concepts |

---

## 📖 1. Dil Politikası (ZORUNLU)

- **Asistan ↔ Kullanıcı:** Tamamen Türkçe
- **Hayalet-ev UI metinleri:** Tamamen Türkçe
- **Kod tarafı:** Değişken/fonksiyon/class adları ve yorumlar **tamamen İngilizce**

---

## 🏗️ 2. Project Overview

**Hayalet-ev** Electron tabanlı multi-AI chat platformudur.

- **Tech Stack:** Electron 39+ (Node.js ESM), TypeScript (strict), Vite 7.3, SQLite
- **Sürüm:** 5.5.0
- **MCP Server:** v1.12.0 (97 tools)

**Mimari:** Main Process → Renderer Process → AI Provider Webviews + IPC Bridge

**Detaylı mimari:** [guides/architecture/40-ARCHITECTURE.md](guides/architecture/40-ARCHITECTURE.md)

---

## 🚨 3. MCP Tool Kullanım (KRİTİK)

**Dosya ve geliştirme işlemleri için SADECE `hayalet-ev` MCP server kullanılmalıdır.**

### Tool Kategorileri

| Kategori | Prefix | Count | Link |
|----------|--------|-------|------|
| Filesystem | `hev_fs_*` | 15 | [Details](guides/development/10-MCP-TOOLS.md) |
| Development | `hev_dev_*` | 21 | [Details](guides/development/10-MCP-TOOLS.md) |
| Context | `hev_context_*` | 4 | [Details](guides/development/10-MCP-TOOLS.md) |
| Git/PR | `hev_git_*` | 4 | [Details](guides/development/10-MCP-TOOLS.md) |
| Web | `hev_web_*` | 3 | [Details](guides/development/10-MCP-TOOLS.md) |
| Workflow | `hev_run_*` | 3 | [Details](guides/development/10-MCP-TOOLS.md) |
| Electron/CDP | `hev_*` | 28+ | [Details](guides/testing/70-CDP.md) |

**⚠️ Not:** Rovo built-in tool'larını kullanma (duplicate riski!)

---

## 🎯 4. TypeScript & ESLint Suite

**10 specialized tool - Error fixing workflow'unu 10x hızlandırır.**

### Top 6 Must-Know Tools

**TypeScript:**
1. **`hev_dev_typescript_dashboard`** - Project-wide error analytics
2. **`hev_dev_safe_batch_refactor`** - Batch refactoring with rollback
3. **`hev_dev_fix_typescript_batch`** - Auto-fix undefined checks

**ESLint (YENİ!):**
4. **`hev_dev_eslint_dashboard`** - ESLint rule analytics & clustering
5. **`hev_dev_lint_project`** - Batch ESLint with glob patterns
6. **`hev_dev_eslint_batch_fix`** - Rule-based auto-fix with verification

**Full guide:** [guides/development/20-TYPESCRIPT-SUITE.md](guides/development/20-TYPESCRIPT-SUITE.md)  
**Technical details:** [mcp-server/AGENTS.md](../mcp-server/AGENTS.md)

---

## 🎭 5. Mod Sistemi

ROVO otomatik mod değiştirir. Status bar ile takip et:

| Mod | Status Bar | Kullanım |
|-----|------------|----------|
| ⚡ QUICK | `╔══ ⚡ QUICK MODE ══╗` | Basit syntax, trivial işler |
| 🔧 STANDARD | `┏━━ 🔧 STANDARD MODE ━━┓` | Normal geliştirme |
| 🔬 RESEARCH | `┌── 🔬 RESEARCH MODE ──┐` | Web araştırma gerekli |
| 🧠 ULTRATHINK | `╔══ 🧠 ULTRATHINK MODE ══╗` | Kritik kararlar, mimari |

**Detaylı kurallar:** [guides/reference/80-AUTO-TRIGGERS.md](guides/reference/80-AUTO-TRIGGERS.md)

---

## 🛠️ 6. Development Guidelines

- **Async:** `async/await` (no callbacks)
- **Error Handling:** All async with `try/catch`
- **Naming:** camelCase (vars), PascalCase (classes), UPPER_SNAKE_CASE (constants)
- **IPC Safety:** `ipcRenderer.invoke()` + input validation

---

## 🏗️ 7. Architecture (Quick)

| Modül | Konum | Rol |
|-------|-------|-----|
| CoreEngine | `src/js/modules/core-engine.ts` | Ana koordinatör |
| SlotController | `src/js/modules/slot-controller.ts` | State machine |
| WebviewManager | `src/js/modules/webview-manager.ts` | Webview lifecycle |
| TrafficManager | `src/js/modules/traffic-manager.ts` | State tracking |

**Full details:** [guides/architecture/40-ARCHITECTURE.md](guides/architecture/40-ARCHITECTURE.md)

---

## ⚠️ 8. Dikkat Edilmesi Gerekenler

### Silinmemesi Gereken Modüller

- `file-utils.ts` - Tüm file upload metodları
- `url-utils.ts` - URL işlemleri
- `provider-registry.ts` - 10+ dosya dependency

### Provider Configs

AI siteleri DOM yapılarını sık değiştirir:
- `providers/chatgpt/config.ts`
- `providers/gemini/config.ts`
- `providers/grok/config.ts`

---

## 🔑 9. Key Concepts

| Kavram | Dosya | Açıklama |
|--------|-------|----------|
| Settings | `electron/settings-manager.ts` | JSON config |
| IPC | `electron/preload.cjs` | `window.electronAPI.*` |
| Providers | `src/js/modules/webview/providers/` | ChatGPT, Grok, Gemini |
| Database | `electron/database/` | SQLite |

**Full guide:** [guides/architecture/50-CONCEPTS.md](guides/architecture/50-CONCEPTS.md)

---

## ⚙️ 10. Günlük Komutlar

```bash
npm start              # Uygulamayı başlat
npm run lint           # ESLint kontrolü
npm run check-types    # TypeScript kontrolü
npm run check          # Tüm kontroller
```

---

## 🛡️ 11. Safe Editing (KRİTİK)

### Tool Tier Selection

| Tier | Tool | Use When |
|------|------|----------|
| 1 | `hev_fs_find_and_replace` | Single-line, simple string |
| 2 | `hev_dev_edit_lines` | Multi-line blocks (RECOMMENDED) |
| 3 | `hev_fs_bash` | Batch operations |

### ❌ NEVER Use

```typescript
find_and_replace_code(...)  // Rovo built-in (BUGGY!)
expand_code_chunks(...)     // Use hev_* only
```

**Full guide:** [guides/reference/84-SAFE-EDITING.md](guides/reference/84-SAFE-EDITING.md)

---

## 🔍 12. Syntax Checker

**Use after:** Multi-line edit, refactoring, bracket issues

```typescript
hev_dev_check_syntax({ file_path: 'file.ts' })
```

**Checks:** Brackets, ESLint, TypeScript, JSON

---

## 🛠️ 13. Troubleshooting

| Issue | Fix |
|-------|-----|
| Electron crash | `rm -rf node_modules && npm install` |
| CDP down | `npm start` (app must be running) |
| MCP crash | `hev_mcp_health()` |

**Full guide:** [guides/testing/75-TROUBLESHOOTING.md](guides/testing/75-TROUBLESHOOTING.md)

---

## 🧙 14. ROVO - ROVO Protokolü

### 14.1 Not Defteri (Basitleştirilmiş)

**Ne not alınır?**

1. ❌ Tool crash / Unexpected errors
2. 💡 Tool eksikliği fark edildiğinde
3. ⚠️ Workaround gerektiren durumlar

**Format (Minimal):**

```markdown
## [YYYY-MM-DD] [Category: tool-error | idea | workaround]

**Tool:** hev_xxx
**Issue:** [One line description]
**Workaround:** [Optional, if found]
```

**Örnek:**

```markdown
## 2026-01-30 [tool-error]

**Tool:** hev_dev_safe_batch_refactor
**Issue:** Error count increased after replace (52→54)
**Workaround:** Used dry_run first, verified pattern with hev_dev_check_syntax
```

**Not Defteri:** [guides/reference/85-NOTEBOOK.md](guides/reference/85-NOTEBOOK.md)

**Neden basitleştirildi?**
- Önceki format çok detaylı (256 satır kurallar)
- AI agent workflow'unu yavaşlatıyordu
- MCP tool output'ları zaten detaylı error loglama yapıyor
- Sadece pattern detection için minimal not yeterli

---

### 14.2 Diğer Protokoller

- **Modlar:** [guides/reference/80-AUTO-TRIGGERS.md](guides/reference/80-AUTO-TRIGGERS.md)
- **Persona:** [guides/reference/81-PERSONA.md](guides/reference/81-PERSONA.md)
- **Logging:** [guides/reference/82-LOGGING.md](guides/reference/82-LOGGING.md)

---

## 🔗 15. Quick Reference

### Top 10 MCP Tools

1. `hev_fs_show` - Read file
2. `hev_dev_edit_lines` - Safe edit
3. `hev_dev_check_syntax` - Verify
4. `hev_dev_typescript_dashboard` - Error analytics
5. `hev_dev_safe_batch_refactor` - Batch refactor
6. `hev_fs_find_and_replace` - Simple replace
7. `hev_read_electron_logs` - Debug
8. `hev_fs_bash` - Shell commands
9. `hev_list_tools` - Tool list
10. `hev_mcp_health` - Health check

### Common Workflows

**TypeScript Fix:** dashboard → safe_batch_refactor → check_syntax  
**New File:** create_file → show → check_syntax  
**Debug:** read_electron_logs → inspect_element → screenshot

---

## 📦 16. Additional Resources

### Guides
- [Development](guides/development/) - MCP tools, TypeScript suite
- [Architecture](guides/architecture/) - System design
- [Testing](guides/testing/) - Test workflows, CDP
- [Reference](guides/reference/) - Auto-triggers, persona, logging

### Auto-Generated
- [Tool List](_metadata/TOOL-LIST.md) - All 97 tools
- [Version Info](_metadata/VERSION-INFO.md) - Version tracking

---
**Last Updated:** 2026-01-30  
**Version:** 3.0 (Simplified)  
**Status:** ✅ Production Ready  
**Maintained by:** ROVO AI Agent
