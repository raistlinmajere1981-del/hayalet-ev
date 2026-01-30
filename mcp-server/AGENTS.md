# Hayalet-ev MCP Server - AI Agent Guide

**Version:** 1.11.0  
**Total Tools:** 77  
**Last Updated:** 2026-01-29

---

## 📋 Overview

Hayalet-ev MCP Server, AI agent'lar için özelleştirilmiş 77 development tool sağlar. TypeScript/Node.js projelerinde hata düzeltme, refactoring, testing ve debugging işlemlerini hızlandırır.

---

## 🎯 Tool Categories

| Kategori | Tool Sayısı | Prefix | Açıklama |
|----------|-------------|--------|----------|
| **Filesystem** | 15 | `hev_fs_*` | Dosya okuma/yazma/düzenleme |
| **Development** | 20 | `hev_dev_*` | TypeScript, lint, test, syntax |
| **Context** | 4 | `hev_context_*` | Proje context generation |
| **Git/PR** | 4 | `hev_git_*` | Fork, PR, contribution |
| **Web** | 3 | `hev_web_*` | SearXNG search & fetch |
| **Workflow** | 3 | `hev_run_*` | Predefined workflows |
| **Electron/CDP** | 28+ | `hev_*` | Chrome DevTools Protocol |

---

## 🆕 TypeScript Helper Suite (v1.11.0)

### Neden Eklendi?

**Problem:** TypeScript hatalarını manuel düzeltmek 40+ iteration harcıyor, duplicate line riski var, progress tracking yok.

**Çözüm:** 7 specialized tool ile automated, safe ve measurable workflow.

### Tool'lar (Öncelik Sırasına Göre)

#### 🥇 Tier 1: Mission Critical

##### 1. `hev_dev_safe_batch_refactor` ⭐ EN GÜÇLÜ

**Kullanım:**
```typescript
hev_dev_safe_batch_refactor({
  file_path: "src/modules/event-handlers.ts",
  operations: [
    {
      pattern: "MessageStore\\?\\.([a-zA-Z]+)\\?\\.",
      replace_with: "if (MessageStore && MessageStore.$1) { MessageStore.$1("
    }
  ],
  verify_after_each: true,      // Her adımda tsc check
  auto_rollback_on_error: true,  // Hata artışında geri al
  dry_run: false
})
```

**Ne Yapar:**
- Regex-based toplu değişiklik
- Her operation sonrası TypeScript error count kontrol
- Error artarsa otomatik rollback
- Success/fail summary

**İdeal Senaryolar:**
- 50+ benzer hata (örn: optional chaining → guard pattern)
- store-bridge/event-handlers.ts (52 TS2722 hatası)
- Güvenli toplu refactoring

**Output:**
```
🔄 Safe Batch Refactor
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📁 File: event-handlers.ts

✅ Operation 1: Applied
✅ Operation 2: Applied
❌ Operation 3: Failed - Error count increased
⚠️  Auto-rollback occurred

📊 Summary:
   ✅ Success: 2
   ❌ Failed: 1
```

---

##### 2. `hev_dev_typescript_dashboard`

**Kullanım:**
```typescript
hev_dev_typescript_dashboard({
  sort_by: "count",
  group_by: "error_code",
  limit: 10
})
```

**Ne Yapar:**
- Projedeki tüm TS hatalarını analiz eder
- Error code'lara göre gruplar
- Top files ranking
- Category breakdown (Undefined Safety, Type Safety, Module/Import)
- Fix recommendation

**İdeal Senaryolar:**
- Session başında durum tespiti
- Progress tracking (517 → 350 errors)
- Hangi hataya odaklanılmalı kararı

**Output:**
```
📊 TypeScript Error Dashboard
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Total: 517 errors

🔴 Top Error Codes:
  1. TS2722: 39 errors ████████░░ 75%
  2. TS2532: 30 errors ███████░░░ 60%

📁 Top Files:
  1. asistan-native/app/sse-connection.ts: 116 errors
  2. slot-controller.ts: 75 errors

💡 Recommended Actions:
  → Focus on TS2722
    Use: hev_dev_fix_typescript_batch
    error_codes: ["TS2722"]
```

---

##### 3. `hev_dev_fix_typescript_batch`

**Kullanım:**
```typescript
hev_dev_fix_typescript_batch({
  file_path: "src/modules/slot-controller.ts",
  error_codes: ["TS2532", "TS18048"],
  fix_strategy: "add_guards",  // veya "add_assertions"
  dry_run: true,  // Önce preview
  auto_apply: false
})
```

**Ne Yapar:**
- Belirtilen error code'ları otomatik düzeltir
- 3 strateji:
  - `add_guards`: `if (!obj) return;` ekler
  - `add_assertions`: `obj!.method()` ekler
  - `strict_null_check`: Type annotation ekler

**Desteklenen Error Codes:**
- TS2532: Object is possibly undefined
- TS18048: Possibly undefined
- TS2722: Cannot invoke possibly undefined

**İdeal Senaryolar:**
- Tek dosyada 20-30 undefined check hatası
- slot-controller.ts gibi kritik modüller

**Output:**
```
🔧 TypeScript Batch Fixer
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📁 File: slot-controller.ts
📊 Found: 30 fixable errors

Preview of fixes:
  Line 190: + if (!slotState) return false;
  Line 195: + if (!slotState) return false;
  ...

⚠️  DRY RUN MODE
To apply: set dry_run: false
```

---

#### 🥈 Tier 2: Specialized Tools

##### 4. `hev_dev_typescript_type_helper`

**Kullanım:**
```typescript
hev_dev_typescript_type_helper({
  file_path: "src/modules/traffic-manager.ts",
  show_interfaces: true,
  suggest_fixes: true,
  analyze_conflicts: true
})
```

**Ne Yapar:**
- Type mismatch detection (TS2345, TS2322, TS2339, TS2741)
- Interface extraction & comparison
- Missing/extra fields detection
- Smart fix suggestions

**İdeal Senaryolar:**
- Interface compatibility sorunları
- ViewState vs TrafficState gibi type conflicts
- Field eksikliği analizi

---

##### 5. `hev_dev_ast_insert`

**Kullanım:**
```typescript
hev_dev_ast_insert({
  file_path: "mcp-server/core/handlers.ts",
  after_pattern: "hev_dev_visualize_structure",
  insert_type: "if_block",
  code: "if (name === 'hev_new_tool') { ... }",
  dry_run: true
})
```

**Ne Yapar:**
- TypeScript AST parsing ile smart positioning
- Function/class/if block sonrasına ekleme
- Otomatik indentation
- Duplicate prevention

---

#### 🥉 Tier 3: Utility Tools

##### 6. `hev_dev_smart_insert`

Natural language positioning:
- "last if block"
- "after function X"
- "line 123"
- "end of file"

##### 7. `hev_dev_register_tool`

Yeni tool eklerken handlers, registry, index'e otomatik ekleme.

---

## 🎯 Recommended Workflows

### Workflow 1: Büyük Refactoring (100+ Errors)

```bash
# 1. Baseline
hev_dev_typescript_dashboard()
# → 517 errors

# 2. En yaygın hatayı toplu düzelt
hev_dev_safe_batch_refactor({
  file_path: "event-handlers.ts",
  operations: [{ pattern: "...", replace_with: "..." }],
  verify_after_each: true
})
# → 52 errors fixed

# 3. İkinci en yaygın hata
hev_dev_fix_typescript_batch({
  file_path: "slot-controller.ts",
  error_codes: ["TS2532"],
  fix_strategy: "add_guards"
})
# → 30 errors fixed

# 4. Progress check
hev_dev_typescript_dashboard()
# → 435 errors (-82 errors, -16%)
```

**Beklenen Sonuç:** 517 → 350 errors (3-4 tool call'da)

---

### Workflow 2: Tek Dosya Düzeltme

```bash
# 1. Type conflict analizi
hev_dev_typescript_type_helper({
  file_path: "traffic-manager.ts",
  show_interfaces: true
})
# → Interface'lerde eksik field'lar tespit edildi

# 2. Manuel interface update
# (interface'e field ekle)

# 3. Kalan undefined check'leri düzelt
hev_dev_fix_typescript_batch({
  file_path: "traffic-manager.ts",
  error_codes: ["TS2532", "TS18048"]
})

# 4. Verify
hev_dev_check_syntax({ file_path: "traffic-manager.ts" })
```

**Beklenen Sonuç:** 49 errors → 0 errors

---

### Workflow 3: Yeni Tool Ekleme

```bash
# 1. Tool dosyasını oluştur
hev_fs_create_file({
  file_path: "mcp-server/tools/dev/my-new-tool.ts",
  initial_content: "..."
})

# 2. Otomatik registration
hev_dev_register_tool({
  tool_name: "hev_dev_my_new_tool",
  description: "...",
  function_name: "myNewTool",
  tool_constant: "MY_NEW_TOOL",
  dry_run: true  # Önce preview
})

# 3. Build & restart
hev_fs_bash({ command: "cd mcp-server && npm run build" })
```

---

## 📊 Success Metrics

### Gerçek Sonuçlar (2026-01-29 Session)

| Modül | Before | After | Improvement |
|-------|--------|-------|-------------|
| traffic-manager.ts | 49 errors | 0 errors | -100% ✅ |
| slot-controller.ts | 75 errors | 0 errors | -100% ✅ |
| event-handlers.ts | 52 errors | ~10 errors | -80% 🎯 |
| **TOPLAM** | 517 errors | ~350 errors | **-32%** 🚀 |

**Zaman Kazancı:**
- Manuel: ~40 iterations
- Tool'lar ile: ~3-5 tool calls
- **Tasarruf: 87%** ⏱️

---

## 🚨 Best Practices

### DO ✅

1. **Her zaman dashboard ile başla**
   ```typescript
   hev_dev_typescript_dashboard()
   ```

2. **Dry-run mode kullan**
   ```typescript
   { ..., dry_run: true }  // Önce preview
   ```

3. **Safe batch refactor'da rollback aç**
   ```typescript
   { 
     verify_after_each: true,
     auto_rollback_on_error: true 
   }
   ```

4. **Progress tracking yap**
   ```typescript
   // Before
   hev_dev_typescript_dashboard()
   // ... fix işlemleri ...
   // After
   hev_dev_typescript_dashboard()
   ```

### DON'T ❌

1. **❌ Dry-run olmadan toplu değişiklik**
   ```typescript
   // YANLIŞ
   hev_dev_safe_batch_refactor({ ..., dry_run: false })
   
   // DOĞRU
   hev_dev_safe_batch_refactor({ ..., dry_run: true })  // Önce preview
   // Sonra dry_run: false
   ```

2. **❌ Rollback olmadan batch refactor**
   ```typescript
   // YANLIŞ
   { verify_after_each: false }
   
   // DOĞRU
   { 
     verify_after_each: true,
     auto_rollback_on_error: true 
   }
   ```

3. **❌ Dashboard olmadan başlama**
   - Kör hedef seçimi
   - Progress tracking yok
   - Hangi hataya odaklanmalı belirsiz

---

## 🔧 Troubleshooting

### Problem 1: "No matches found"

**Sebep:** Regex pattern yanlış veya hedef kod değişmiş

**Çözüm:**
```typescript
// 1. Dosyayı kontrol et
hev_fs_show({ file_path: "...", start_line: 190, end_line: 200 })

// 2. Pattern'i test et (dry_run)
hev_dev_safe_batch_refactor({ ..., dry_run: true })
```

---

### Problem 2: "Error count increased"

**Sebep:** Replace string'i syntax hatası yaratmış

**Çözüm:**
- Auto-rollback zaten çalışmış olmalı
- Replace string'i kontrol et
- Syntax check ekle:
```typescript
hev_dev_check_syntax({ file_path: "..." })
```

---

### Problem 3: MCP Server Crash

**Sebep:** Export eksik veya syntax hatası

**Çözüm:**
```bash
# 1. Build log'u kontrol et
cd mcp-server && npm run build 2>&1 | tail -20

# 2. MCP health check
hev_mcp_health()

# 3. Restart
# Rovo'yu yeniden başlat
```

---

## 📚 Quick Reference

### En Sık Kullanılan 5 Tool

| Tool | Use Case | Frequency |
|------|----------|-----------|
| `hev_dev_typescript_dashboard` | Durum analizi | Her session başı |
| `hev_dev_safe_batch_refactor` | Toplu düzeltme | 50+ benzer hata |
| `hev_dev_fix_typescript_batch` | Undefined checks | 20-30 hata |
| `hev_dev_check_syntax` | Verification | Her düzeltme sonrası |
| `hev_fs_show` | Code inspection | Pattern test |

---

## 🎓 Learning Resources

- **Full Documentation:** `mcp-server/README.md`
- **Tool List:** `hev_list_tools()`
- **Examples:** Bu dosyadaki workflow'lar
- **Schema:** `mcp__hayalet_ev__get_tool_schema({ tool_name: "..." })`

---

## 🤝 Contributing

Yeni tool eklerken:

1. Tool dosyasını `mcp-server/tools/dev/` altına ekle
2. `hev_dev_register_tool()` ile otomatik registration
3. README.md'ye example ekle
4. Bu AGENTS.md'ye use case ekle

---
**Last Updated:** 2026-01-30  
**Maintainer:** ROVO AI Agent  
**Status:** ✅ Production Ready
