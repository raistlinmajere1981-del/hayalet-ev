# 🚀 Hayalet-ev Quick Reference for AI Agents

> **📚 Full Documentation:** [.rovo/01-AGENTS.md](.rovo/01-AGENTS.md)  
> **🔧 MCP Server Details:** [mcp-server/AGENTS.md](mcp-server/AGENTS.md)  
> **⚡ Quick Start (5 min):** [.rovo/00-QUICK-START.md](.rovo/00-QUICK-START.md)

---

## 🏥 Health Check (Always Start Here)

```typescript
// 1. Verify MCP is running
hev_mcp_health()
// → ✅ Should show: Healthy, v1.12.0, 77 tools

// 2. List all available tools
hev_list_tools()

// 3. Project health snapshot
hev_dev_typescript_dashboard()
```

---

## 🎯 Top 10 Most Used Tools

| Tool | Use Case | When |
|------|----------|------|
| `hev_fs_show` | Read file with line numbers | Always before editing |
| `hev_dev_edit_lines` | Multi-line safe edit | Primary edit method |
| `hev_dev_check_syntax` | Verify syntax/brackets | After every edit |
| `hev_fs_find_and_replace` | Simple string replace | Single-line changes |
| `hev_dev_typescript_dashboard` | Error analytics | Session start |
| `hev_dev_safe_batch_refactor` | Batch refactoring (50+ errors) | Large-scale fixes |
| `hev_dev_fix_typescript_batch` | Auto-fix TS errors | 20-30 similar errors |
| `hev_read_electron_logs` | Debug Electron app | When debugging |
| `hev_fs_bash` | Run shell commands | Build/test/git |
| `hev_mcp_health` | Check MCP status | Troubleshooting |

---

## 🛡️ Critical Safety Rules

### ❌ NEVER Use These (Duplicate Risk!)
```typescript
find_and_replace_code(...)  // ← Rovo built-in (BUGGY!)
expand_code_chunks(...)     // ← Use hev_* versions only
```

### ✅ Safe Edit Workflow (4 Steps)
```typescript
// 1. SHOW: Inspect current content
hev_fs_show({ file_path: 'file.ts', start_line: 100, end_line: 120 })

// 2. EDIT: Make changes
hev_dev_edit_lines({ 
  file_path: 'file.ts',
  operation: 'replace',
  start_line: 110,
  end_line: 115,
  content: '...',
  safe_mode: true  // ← Auto-rollback on error
})

// 3. CHECK: Verify syntax
hev_dev_check_syntax({ file_path: 'file.ts' })

// 4. VERIFY: Confirm no duplicates
hev_fs_show({ file_path: 'file.ts', start_line: 105, end_line: 125 })
```

**⚠️ If duplicate detected:** `git checkout -- path/to/file.ts`

---

## 🎭 Tool Selection Guide (Tier System)

| Tier | Tool | Use When | Example |
|------|------|----------|----------|
| **1** | `hev_fs_find_and_replace` | Single-line, simple string | Change variable name |
| **2** | `hev_dev_edit_lines` | Multi-line blocks (RECOMMENDED) | Function refactor |
| **3** | `hev_dev_safe_batch_refactor` | 50+ similar changes | Pattern replacement |
| **4** | `hev_fs_bash` | Complex batch operations | `sed` across files |

**Rule:** Always use lowest tier that solves the problem.

---

## 🚀 Common Workflows

### Workflow 1: Fix TypeScript Errors (100+ errors)
```typescript
// Step 1: Baseline
hev_dev_typescript_dashboard()
// → Output: 517 errors, TS2722 most common

// Step 2: Batch fix top error
hev_dev_safe_batch_refactor({
  file_path: 'event-handlers.ts',
  operations: [{ pattern: '...', replace_with: '...' }],
  verify_after_each: true,
  auto_rollback_on_error: true
})
// → -52 errors

// Step 3: Progress check
hev_dev_typescript_dashboard()
// → 465 errors (-10%)
```

### Workflow 2: Create New File
```typescript
// Step 1: Create
hev_fs_create_file({ 
  file_path: 'src/new-module.ts',
  initial_content: '...' 
})

// Step 2: Verify
hev_fs_show({ file_path: 'src/new-module.ts' })

// Step 3: Syntax check
hev_dev_check_syntax({ file_path: 'src/new-module.ts' })
```

### Workflow 3: Debug Issue
```typescript
// Step 1: Check logs
hev_read_electron_logs({ type: 'console', tail: 50 })

// Step 2: Inspect element
hev_inspect_element({ selector: '#problem-element' })

// Step 3: Take screenshot
hev_take_cdp_screenshot({ format: 'png', savePath: '/tmp/debug.png' })
```

---

## 🗣️ Language Policy

- **User ↔ AI:** Turkish only
- **UI Text:** Turkish only  
- **Code (variables/functions/comments):** English only

---

## 📦 Tool Categories (77 Total)

| Prefix | Category | Count | Examples |
|--------|----------|-------|----------|
| `hev_fs_*` | Filesystem | 15 | read, write, delete, move |
| `hev_dev_*` | Development | 20 | lint, test, typescript, syntax |
| `hev_context_*` | Context Gen | 4 | generate, status, module |
| `hev_git_*` | Git/PR | 4 | fork, create-pr, check-guidelines |
| `hev_web_*` | Web Search | 3 | search, fetch, search-and-fetch |
| `hev_run_*` | Workflows | 3 | workflow, steps, list-workflows |
| `hev_*` | Electron/CDP | 28+ | click, screenshot, inspect |

**Details:** [.rovo/guides/development/10-MCP-TOOLS.md](.rovo/guides/development/10-MCP-TOOLS.md)

---

## 🎯 TypeScript Helper Suite (Quick)

**For detailed guide:** [.rovo/guides/development/20-TYPESCRIPT-SUITE.md](.rovo/guides/development/20-TYPESCRIPT-SUITE.md)

| Tool | One-Line Description |
|------|----------------------|
| `hev_dev_typescript_dashboard` | Error analytics + recommendations |
| `hev_dev_safe_batch_refactor` | Batch refactor with rollback |
| `hev_dev_fix_typescript_batch` | Auto-fix undefined checks |
| `hev_dev_typescript_type_helper` | Type conflict analysis |
| `hev_dev_ast_insert` | AST-based code insertion |
| `hev_dev_smart_insert` | Natural language positioning |
| `hev_dev_register_tool` | Auto-register new MCP tool |

---

## 🎭 Mode System

**⚠️ ZORUNLU: Her cevabın başında aktif modu status bar ile göster:**

### Mode Formats

**⚡ QUICK Mode** (Syntax fixes, trivial tasks):
```
╔══════════════════════════════════════╗
║  ⚡ QUICK MODE                       ║
╚══════════════════════════════════════╝
```

**🔧 STANDARD Mode** (Normal development - DEFAULT):
```
┏━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┓
┃  🔧 STANDARD MODE                    ┃
┗━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┛
```

**🔬 RESEARCH Mode** (Web research needed):
```
┌──────────────────────────────────────┐
│  🔬 RESEARCH MODE                    │
│  🌐 Web araştırma aktif...           │
└──────────────────────────────────────┘
```

**🧠 ULTRATHINK Mode** (Critical decisions, architecture):
```
╔══════════════════════════════════════╗
║  🧠 ULTRATHINK MODE                  ║
║  ⚠️  Derin analiz aktif...           ║
╚══════════════════════════════════════╝
```

### Auto-Switch Triggers

| Trigger Pattern | Auto Mode | Examples |
|----------------|-----------|----------|
| Syntax fix, import add, typo | ⚡ QUICK | "Add missing import", "Fix typo" |
| Normal feature, bug fix, test | 🔧 STANDARD | "Create component", "Fix login bug" |
| Error messages, "güncel", unknown API | 🔬 RESEARCH | "TS2722 nedir?", "En güncel Next.js" |
| Architecture, breaking changes | 🧠 ULTRATHINK | "State management seçimi", "Refactor" |

**Mode transitions:** `━━━ MOD DEĞİŞİKLİĞİ: STANDARD → RESEARCH ━━━`

### Communication Rules

- **User ↔ AI:** Turkish only
- **Code/comments:** English only
- **Tone:** Professional but friendly, confident not arrogant
- **Approach:** Research first, apply second (never guess)
- **Proactive:** Always mention potential issues

**Details:** [.rovo/guides/reference/80-AUTO-TRIGGERS.md](.rovo/guides/reference/80-AUTO-TRIGGERS.md) | [.rovo/guides/reference/81-PERSONA.md](.rovo/guides/reference/81-PERSONA.md)



## 🔒 Tool Usage Rules (MANDATORY)

### Before ANY Edit
**⚠️ ZORUNLU:** Dosya düzenlemeden ÖNCE mutlaka `hev_fs_show` kullan.

```typescript
❌ YANLIŞ:
hev_dev_edit_lines({ file_path: 'file.ts', ... })

✅ DOĞRU:
hev_fs_show({ file_path: 'file.ts', start_line: 100, end_line: 120 })
// Then edit...
hev_dev_edit_lines({ file_path: 'file.ts', ... })
```

### After ANY Edit
**⚠️ ZORUNLU:** Her düzenlemeden SONRA syntax check.

```typescript
hev_dev_edit_lines({ ... })
hev_dev_check_syntax({ file_path: 'file.ts' })  // ← ZORUNLU
```

### TypeScript Errors
**⚠️ ZORUNLU:** TypeScript hatası varsa önce dashboard.

```typescript
❌ YANLIŞ: Direkt fix'e geçmek

✅ DOĞRU:
hev_dev_typescript_dashboard()  // ← 1. Durum tespiti
// Then choose fix strategy
```

### Error Recovery

**Scenario 1: Duplicate Lines Detected**
```bash
# Immediate rollback
git checkout -- path/to/file.ts
# Alternative
hev_fs_undo()
```

**Scenario 2: Syntax Error After Edit**
```typescript
1. hev_fs_undo()  // Rollback last edit
2. hev_fs_show({ ... })  // Verify rollback
3. Fix and retry
```

**Scenario 3: Tool Error/Unexpected Behavior**
```typescript
// 1. IMMEDIATELY log to notebook
// 2. Document: tool name, scenario, error message, input params
// 3. Continue with alternative approach
```

### 📓 Notebook Protocol (MANDATORY)

**⚠️ ZORUNLU: Şu durumlarda `.rovo/notebook.md`'ye not ekle:**

1. **Tool hatası aldığında:**
   ```markdown
   ### [YYYY-MM-DD HH:MM] Tool Hatası: {tool_name}
   
   **Senaryo:** {Ne yapmaya çalıştın}
   **Tool:** `{tool_name}({ params })`
   **Hata:** {Error message}
   **Input:** 
   ```json
   {actual input params}
   ```
   **Beklenen:** {Ne olmasını bekliyordun}
   **Gerçekleşen:** {Ne oldu}
   **Workaround:** {Nasıl çözdün}
   **İyileştirme Önerisi:** {Tool nasıl geliştirilebilir}
   ```

2. **Tool beklenmedik sonuç verdiğinde:**
   ```markdown
   ### [YYYY-MM-DD HH:MM] Beklenmeyen Davranış: {tool_name}
   
   **Durum:** {Kısa açıklama}
   **Beklenen:** {Expected behavior}
   **Gerçekleşen:** {Actual behavior}
   **Impact:** {Sorun yarattı mı?}
   **Not:** {Ek gözlemler}
   ```

3. **Yeni pattern/iyileştirme farkettiysen:**
   ```markdown
   ### [YYYY-MM-DD HH:MM] İyileştirme Fikri: {alan}
   
   **Gözlem:** {Neyi farketttin}
   **Öneri:** {Nasıl iyileştirilebilir}
   **Potansiyel Impact:** {Fayda tahmini}
   ```

**Not Ekleme:**
```typescript
hev_fs_bash({ 
  command: "echo '\n### [$(date +\%Y-\%m-\%d\ \%H:\%M)] Tool Hatası: hev_dev_edit_lines\n...' >> .rovo/notebook.md" 
})
```

---

---

## 🏗️ Architecture (Quick)

```
Main Process (electron/main.ts)
├── Renderer Process (src/index.html → CoreEngine)
├── AI Provider Webviews (isolated contexts)
└── IPC Bridge (preload.cjs)
```

**Key Modules:**
- `CoreEngine` - Main coordinator
- `SlotController` - State machine
- `WebviewManager` - Webview lifecycle
- `TrafficManager` - State tracking

**Details:** [.rovo/guides/architecture/40-ARCHITECTURE.md](.rovo/guides/architecture/40-ARCHITECTURE.md)

---

## 🛠️ Troubleshooting

| Issue | Quick Fix |
|-------|----------|
| MCP not responding | `hev_mcp_health()` → Check error |
| Duplicate lines | `git checkout -- file.ts` |
| TypeScript errors | `hev_dev_typescript_dashboard()` |
| Electron crash | `hev_read_electron_logs()` |
| Build failed | `cd mcp-server && npm run build` |

---

## 📚 Full Documentation Tree

**Start Here:**
- [.rovo/00-QUICK-START.md](.rovo/00-QUICK-START.md) - 5 minute onboarding
- [.rovo/01-AGENTS.md](.rovo/01-AGENTS.md) - Complete development guide

**Guides:**
- Development: [.rovo/guides/development/](.rovo/guides/development/)
- Architecture: [.rovo/guides/architecture/](.rovo/guides/architecture/)
- Testing: [.rovo/guides/testing/](.rovo/guides/testing/)
- Reference: [.rovo/guides/reference/](.rovo/guides/reference/)

**Metadata:**
- [.rovo/_metadata/TOOL-LIST.md](.rovo/_metadata/TOOL-LIST.md) - All 77 tools
- [.rovo/_metadata/VERSION-INFO.md](.rovo/_metadata/VERSION-INFO.md) - Version tracking

---

## 🚨 Emergency Contacts

**If something goes wrong:**

1. **MCP Server Down**
   ```bash
   cd mcp-server && npm run build
   # Restart Rovo session
   ```

2. **File Corrupted (Duplicate Lines)**
   ```bash
   git checkout -- path/to/file.ts
   # Review: .rovo/guides/reference/84-SAFE-EDITING.md
   ```

3. **TypeScript Explosion**
   ```typescript
   hev_dev_typescript_dashboard()
   // Focus on top error code
   // Use safe_batch_refactor with rollback
   ```

---
**Last Updated:** 2026-01-30  
**Version:** 5.5.0  
**MCP Version:** 1.12.0  
**Tools:** 77  
**Maintained by:** ROVO AI Agent
