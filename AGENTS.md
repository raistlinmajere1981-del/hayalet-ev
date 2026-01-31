# 🚀 Hayalet-ev Quick Reference for AI Agents

> **📚 Full Documentation:** [.rovo/01-AGENTS.md](.rovo/01-AGENTS.md)
> **🔧 MCP Server Details:** [mcp-server/AGENTS.md](mcp-server/AGENTS.md)
> **⚡ Quick Start (5 min):** [.rovo/00-QUICK-START.md](.rovo/00-QUICK-START.md)

---

## 📚 SESSION BAŞLATMA PROTOKOLÜ (ZORUNLU)

**⚠️ KRITIK: Yeni bir session başladığında, kullanıcıya cevap vermeden ÖNCE bu adımları tamamla:**

### 1. Context Loading (MANDATORY)
```typescript
// Step 1: Read full documentation
await open_files([
  ".rovo/01-AGENTS.md",      // 156 satır - TOP 10 tools + workflows
  "mcp-server/AGENTS.md"     // 493 satır - TypeScript suite + use cases
])

// Step 2: Verify MCP health
hev_mcp_health()
// → ✅ Expected: Healthy, v1.11.0+, 99 tools

// Step 3: Get project status (optional but recommended)
hev_dev_analyze_project({ mode: "quick" })
```

### 2. Ne Bilmelisin?

Session başında bu bilgilere sahip olmalısın:

- ✅ **Proje:** Hayalet-ev = Electron-based AI asistan (multi-provider: ChatGPT, Gemini, Grok, OpenCode)
- ✅ **Mimari:** Webview-based slot system + traffic tracking + relay system
- ✅ **Tool Count:** 99 (filesystem, dev, context, git, web, workflow, CDP, electron)
- ✅ **TypeScript Status:** ~500+ errors (normal, incremental fix)
- ✅ **Top Modules:** asistan, slot, traffic, webview, relay
- ✅ **Safety Rules:** ÖNCE `hev_fs_show()` → SONRA edit → SONRA `hev_dev_check_syntax()`

### 3. İlk Mesaj Kontrolü

```typescript
// Eğer bu bilgileri bilmiyorsan:
if (!知道("Hayalet-ev nedir?") || !知道("TypeScript suite tools")) {
  // 🚨 DUR! Yukarıdaki dosyaları OKU!
  await open_files([".rovo/01-AGENTS.md", "mcp-server/AGENTS.md"])
}
```

---

## 🎯 Always Start Here

```typescript
// 1. Verify MCP is running
hev_mcp_health()
// → ✅ Should show: Healthy, v1.10.0, 99 tools

// 2. Discover tools by intent
hev_suggest_tool({ intent: "TypeScript hatalarını düzelt" })

// 3. Get workflow guide
hev_tool_workflow({ scenario: "file-edit-safe" })
```

## ⭐ TOP 10 Most Important Tools

### 🔥 Tier 1: Mission Critical (3 tools)

#### 1. `hev_mcp_health` ⚡ FIRST THING TO RUN
Hayalet-ev MCP'nin sağlık durumunu kontrol et. MCP aktif ve built-in override sistemi çalışıyor demektir.

**Use When:** Her session başında, tool hatası aldığında
**Risk:** MCP çalışmazsa built-in toollar aktif olur (DUPLICATE LINES!)

#### 2. `hev_suggest_tool` 🎯 TOOL DISCOVERY
AI agent'a tool önerisi yap (intent-based discovery). Ne yapmak istediğini söyle, sana en uygun toolları önerir.

**Use When:** 99 tool arasında kaybolduğunda, workflow planlarken
**Example:** `hev_suggest_tool({ intent: "TypeScript hatalarını toplu düzelt" })`

#### 3. `hev_tool_workflow` 📋 STEP-BY-STEP GUIDE
Belirli bir senaryo için önerilen tool workflow'unu göster. Karmaşık işlemler için adım adım kılavuz.

**Use When:** TypeScript fix, refactoring, safe editing gibi karmaşık işlemler
**Example:** `hev_tool_workflow({ scenario: "typescript-fix-large" })`

### 🚀 Tier 2: Development Suite (7 tools)

#### 4. `hev_dev_typescript_dashboard` 📊 ERROR OVERVIEW
Projedeki tüm TS hatalarını analiz eder, error code'lara göre gruplar, top files ranking.

**Use When:** Session başında durum tespiti, progress tracking
**Output:** 517 errors → TS2722: 39 errors, TS2532: 30 errors

#### 5. `hev_dev_safe_batch_refactor` 🛡️ SAFEST EDIT METHOD
Regex-based toplu değişiklik + her adımda TypeScript check + hata artarsa auto-rollback.

**Use When:** 50+ benzer hata (optional chaining → guard pattern)
**Safety:** `verify_after_each: true`, `auto_rollback_on_error: true`

#### 6. `hev_dev_fix_typescript_batch` 🔧 AUTO-FIX
Toplu TypeScript hatalarını otomatik düzeltir (undefined checks, optional chaining).

**Use When:** TS2532, TS2722 gibi tekrarlayan hatalar
**Options:** `fix_strategy: "conservative"`, `dry_run: true`

#### 7. `hev_dev_check_syntax` ✅ MANDATORY AFTER EDIT
Dosyada syntax hatalar, parantez dengesi, ESLint, TypeScript kontrolleri.

**Use When:** HER EDIT SONRASI (zorunlu!)
**Checks:** Syntax, brackets, ESLint, TypeScript errors

#### 8. `hev_fs_show` 👁️ MANDATORY BEFORE EDIT
Dosya içeriğini satır numaralarıyla gösterir (context before edit).

**Use When:** HER EDIT ÖNCESI (zorunlu!)
**Why:** Duplicate lines ve yanlış edit önleme

#### 9. `hev_dev_analyze_project` 📁 PROJECT STATUS
Proje analizi: dosya sayıları, satır sayıları, bağımlılıklar, git durumu.

**Use When:** Session başında, durum tespiti
**Mode:** `quick` (fast) veya `full` (detailed)

#### 10. `hev_dev_register_tool` 🔨 TOOL DEVELOPMENT
Yeni tool otomatik olarak handlers, registry ve index'e ekler.

**Use When:** Yeni MCP tool geliştirirken
**Auto:** Handler registration, registry update, index update

## 📊 Quick Stats

- **Total Tools:** 99
- **With Metadata:** 6
- **Critical Priority:** 2
- **High Priority:** 3
- **Requires Confirmation:** 0

## 🛡️ SAFETY RULES (MANDATORY)

### Golden Rule: SHOW → EDIT → CHECK

```typescript
// ❌ WRONG: Direct edit
hev_dev_edit_lines({ file_path: "file.ts", ... })

// ✅ RIGHT: Safe workflow
// 1. SHOW
hev_fs_show({ file_path: "file.ts", start_line: 100, end_line: 120 })

// 2. EDIT
hev_dev_edit_lines({ 
  file_path: "file.ts",
  operation: "replace",
  start_line: 105,
  end_line: 110,
  content: "new code"
})

// 3. CHECK (MANDATORY!)
hev_dev_check_syntax({ file_path: "file.ts" })
```

### Risk Levels

| Risk | Action | Tools |
|------|--------|-------|
| 🟢 **LOW** | Read-only | `hev_fs_show`, `hev_dev_analyze_project` |
| 🟡 **MEDIUM** | Single file edit | `hev_dev_edit_lines` + `hev_dev_check_syntax` |
| 🟠 **HIGH** | Batch edit | `hev_dev_safe_batch_refactor` (auto-verify) |
| 🔴 **CRITICAL** | Multi-file refactor | `hev_dev_safe_batch_refactor` + manual review |

### Common Mistakes

1. **Duplicate Lines** → Always use `hev_fs_show` before edit
2. **Broken Syntax** → Always use `hev_dev_check_syntax` after edit
3. **TypeScript Error Increase** → Use `hev_dev_safe_batch_refactor` (auto-rollback)
4. **Tool Overload** → Use `hev_suggest_tool` for discovery

## 🚨 Emergency Troubleshooting

| Issue | Quick Fix |
|-------|-----------|
| MCP not responding | `hev_mcp_health()` → Check error |
| Duplicate lines | `git checkout -- file.ts` OR `hev_fs_undo()` |
| TypeScript errors | `hev_dev_typescript_dashboard()` → prioritize |
| Tool overload | `hev_suggest_tool({ intent: "..." })` |
| Syntax broken | `hev_dev_check_syntax()` → fix → re-check |

---
**Last Updated:** 2026-01-31
**Tool Count:** 99
**Generated:** Auto (scripts/generate-tool-docs.js)
