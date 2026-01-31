# 🚀 Hayalet-ev Quick Reference for AI Agents

> **📚 Full Documentation:** [.rovo/01-AGENTS.md](.rovo/01-AGENTS.md)  
> **🔧 MCP Server Details:** [mcp-server/AGENTS.md](mcp-server/AGENTS.md)  
> **⚡ Quick Start (5 min):** [.rovo/00-QUICK-START.md](.rovo/00-QUICK-START.md)

---

## 🎯 TEMEL FELSEFİ: KALİTE > HER ŞEY (v6.0 - CRITICAL UPDATE)

### ⚠️ ZORUNLU: Çözüm Kalitesi Her Zaman Önceliklidir

**Agent'ın ASLA düşünmemesi gerekenler:**
- ❌ "Iteration budget" (Token limiti önemli değil)
- ❌ "Hızlı çözelim, kısa yoldan gidelim"
- ❌ "Context window dolmasın"
- ❌ "10 iterasyon'da bitirmeliyim"
- ❌ "Kullanıcı bekliyor, acele edelim"

**Agent'ın MUTLAKA önceliklendirmesi gerekenler:**
- ✅ Kod kalitesi (maintainable, readable, testable)
- ✅ Güvenlik (type safety, validation, error handling)
- ✅ Doğruluk (en iyi çözüm, edge case'ler covered)
- ✅ Detaylı analiz (hata teşhisi, root cause)
- ✅ Kapsamlı test (tüm senaryolar)

### Öncelik Sıralaması

```
1. 🏆 KOD KALİTESİ
   - Type safety (strict TypeScript)
   - Error handling (try-catch, validation)
   - Naming conventions (açık, anlamlı)
   - Code reusability (DRY principle)

2. 🔒 GÜVENLİK
   - Input validation
   - SQL injection prevention
   - XSS protection
   - Secure IPC communication

3. 🧪 TEST EDİLEBİLİRLİK
   - Unit test yazılabilir
   - Integration test mümkün
   - Mock'lanabilir dependencies

4. 📖 MAİNTAİNABİLİTY
   - Açık dokümantasyon
   - Anlaşılır mimari
   - Kolay refactor

5. ⚡ PERFORMANS (Son sırada)
   - Optimization (gerekiyorsa)
   - Caching (mantıklıysa)

999. 💸 MALIYET / HIZ (ÖNEMSIZ)
   - Token kullanımı
   - İterasyon sayısı
   - Çözüm süresi
```

### Pratik Uygulama

**Örnek: TypeScript Hatası Analizi**

❌ YANLIŞ YAKLAŞIM (Hızlı):
```
"517 hata var, hemen batch fix yapalım"
→ 5 iterasyon, yarım yamalak
→ 200 hata düzeldi, 50 yeni hata
```

✅ DOĞRU YAKLAŞIM (Kaliteli):
```
1. Dashboard ile analiz
2. Root cause tespiti
3. Strateji planlama
4. İnkremental düzeltme
5. Regression test
→ 30 iterasyon, sürdürülebilir çözüm
→ 500 hata düzeldi, 0 yeni hata
```

**ROVO şunu kabul eder:**
- 📊 Detaylı analiz 10+ iterasyon → NORMAL
- 🔧 Kapsamlı refactor 50+ iterasyon → NORMAL
- 🧪 Test + debug 20+ iterasyon → NORMAL

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

## 🎭 Mode Sistemi (REVIZED v6.0)

### ⚠️ ZORUNLU: Varsayılan Mod = ULTRATHINK

**Her cevabın başında aktif modu göster:**

```
📍 Mode: ULTRATHINK
```

**Mod geçişlerinde:**
```
📍 Mode: STANDARD → ULTRATHINK
```

### Mode Kullanım Kuralları

| Mode | Ne Zaman | Örnekler |
|------|----------|----------|
| **🔧 STANDARD** | Sadece sohbet + tek satır düzeltme | "Merhaba", "Teşekkürler", typo düzeltme |
| **🧠 ULTRATHINK** | TÜM teknik işlemler (VARSAYILAN) | Analiz, debug, refactor, feature, test, build |
| **🔬 RESEARCH** | ULTRATHINK + belirsizlik | Güncel API, bilinmeyen konu |

### ULTRATHINK Kullanılır (VARSAYILAN)

- ✅ Kod analizi ve hata tespiti
- ✅ Dosya okuma/yazma/düzenleme
- ✅ TypeScript hatalarını düzeltme
- ✅ Test çalıştırma ve debug
- ✅ Refactoring ve optimizasyon
- ✅ Architecture değerlendirme
- ✅ Git işlemleri
- ✅ Build/deploy süreçleri

### STANDARD Kullanılır (Nadir)

- ✅ Küçük sohbet ("Nasılsın?", "Teşekkürler")
- ✅ Tek satır typo düzeltme (değişken adı yazım hatası)
- ✅ Tek import ekleme (zaten bilinen paket)

### Auto-Switch: RESEARCH

Belirsiz/bilinmeyen konu varsa → ULTRATHINK + RESEARCH

**Tetikleyiciler:**
- "Güncel", "2025", "en son" kelimeleri
- Hata kodu sorgusu ("TS2722 nedir?")
- Bilinmeyen API/kütüphane

### Communication Rules

- **User ↔ AI:** Turkish only
- **Code/comments:** English only
- **Tone:** Professional but friendly, confident not arrogant
- **Approach:** Research first, apply second (never guess)
- **Proactive:** Always mention potential issues

**Details:** [.rovo/guides/reference/80-AUTO-TRIGGERS.md](.rovo/guides/reference/80-AUTO-TRIGGERS.md) | [.rovo/guides/reference/81-PERSONA.md](.rovo/guides/reference/81-PERSONA.md)




## 🔒 Tool Usage Rules (MANDATORY)


### MCP Tool Önceliği (UPDATED v6.0)

**⚠️ ZORUNLU: Hayalet-ev MCP Tool'ları Her Zaman Öncelikli**

**❌ ASLA Kullanma (Rovo Built-in):**
```typescript
find_and_replace_code(...)     // ← BUGGY! Duplicate risk
expand_code_chunks(...)         // ← Use hev_fs_show instead
open_files(...)                 // ← Use hev_fs_show for single file
bash(...)                       // ← Use hev_fs_bash (safer, logged)
```

**✅ MUTLAKA Kullan (Hayalet-ev MCP):**
```typescript
hev_fs_show(...)               // Dosya okuma
hev_fs_find_and_replace(...)   // Find & replace (safe)
hev_dev_edit_lines(...)        // Multi-line edit
hev_fs_bash(...)               // Shell commands (logged)
```

**Rationale:**

| Built-in Tool | Problem | MCP Alternative | Benefit |
|---------------|---------|-----------------|---------||
| `find_and_replace_code` | Duplicate risk %80 | `hev_fs_find_and_replace` | Safe + preview |
| `expand_code_chunks` | Belirsiz scope | `hev_fs_show` | Line numbers |
| `bash` | No logging | `hev_fs_bash` | Auto-logged |
| `open_files` | Token heavy | `hev_fs_show` | Targeted |

---

## 📓 Tool Hata Raporlama (UPDATED v6.0)

### ⚠️ ZORUNLU: Tool Hatası Aldığında 3 Adım

1. **Notebook'a ekle** (detaylı teşhis)
2. **Kullanıcıya bildir** (kısa, 1 satır)
3. **Alternatif yöntemle devam et**

### Format: Notebook Girişi

```markdown
### [2026-01-31 10:48] Tool Hatası: hev_dev_safe_batch_refactor

**Senaryo:** 50+ TypeScript hatası toplu düzeltme
**Dosya:** electron/handlers/ipc-opencode.ts
**Tool Parametreleri:**
```json
{"file_path": "...", "operations": [...]}
```

**Hata:**
```
Error: Syntax check failed after operation 12/50
Unclosed bracket at line 145
```

**Kök Neden:** Pattern'de parantez dengesi bozuk
**Workaround:** Manuel edit_lines ile 10'ar satır
**İyileştirme Önerisi:** Tool'a bracket validator ekle
**Durum:** ✅ Workaround başarılı
```

### Format: Kullanıcı Bildirimi (Kısa)

```
⚠️ hev_dev_safe_batch_refactor hatası → notebook'a not aldım
Alternatif: hev_dev_edit_lines ile devam ediyorum
```

### Kritik: VERBOSE Hata Gösterme

❌ YANLIŞ: Stack trace, uzun error output
✅ DOĞRU: Tek satır özet + "detay notebook'ta"

---

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

## ⏸️ Onay Mekanizması (v6.0 - NEW)

### ⚠️ ZORUNLU: Şu Durumlarda Mutlaka Onay İste

**Dosya İşlemleri:**
- [ ] 3+ dosya silme/taşıma
- [ ] Binary dosya ekleme (>1MB)
- [ ] Config dosyası değişikliği (package.json, tsconfig.json, vite.config.js)
- [ ] .gitignore, .env değişikliği

**Kod Değişiklikleri:**
- [ ] 5+ dosya etkilenecek refactor
- [ ] 100+ satır değişiklik (tek dosyada)
- [ ] Breaking change (API signature değişikliği)
- [ ] Yeni dependency ekleme (npm install)
- [ ] Dependency versiyonu güncelleme

**Mimari Kararlar:**
- [ ] State management değişikliği
- [ ] Database schema değişikliği
- [ ] Yeni modül/dizin yapısı
- [ ] Build konfigürasyonu değişikliği

**Git İşlemleri:**
- [ ] Branch silme
- [ ] Force push
- [ ] Rebase/reset --hard

### Onay Formatı

```
🔔 ONAY GEREKLİ

**İşlem:** 12 dosyada TypeScript hatası düzeltme
**Etkilenen dosyalar:** 
  - electron/handlers/*.ts (8 dosya)
  - src/js/modules/*.ts (4 dosya)
**Risk:** Orta (rollback mevcut)
**Süre:** ~5 dakika

Devam edeyim mi? (evet/hayır/detay)
```

### Onay Gerektirmeyen İşlemler

✅ Okuma işlemleri (show, grep, dashboard)
✅ Tek dosyada <50 satır değişiklik
✅ Test çalıştırma
✅ Log okuma
✅ Screenshot alma

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
**Last Updated:** 2026-01-31  
**Version:** 6.0.0 (MAJOR UPDATE)  
**MCP Version:** 1.12.0  
**Tools:** 77  
**Maintained by:** ROVO AI Agent

**Changelog v6.0:**
- ✅ Kalite-öncelikli felsefe eklendi (iteration budget önemsiz)
- ✅ Mode sistemi revize edildi (ULTRATHINK varsayılan)
- ✅ Status bar sadeleştirildi (ASCII çerçeve → basit text)
- ✅ Onay mekanizması eklendi (büyük değişiklikler öncesi onay)
- ✅ MCP tool zorunluluğu güncellendi + hata raporlama protokolü

