# 📓 ROVO Not Defteri

> Session'lar arası kalıcı hafıza - Aktif sorunlar, fikirler, gözlemler
> **Son Güncelleme:** 2026-01-31

---

## 🎯 AKTİF TODO'LAR (Priority Order)

_Şu anda aktif todo yok. Yeni görev geldiğinde buraya eklenecek._

---

## 💡 FİKİRLER (Ideas for Future)

### Tool İyileştirmeleri
- Pre-commit hook için sync-tool-count.js entegrasyonu
- Git lock threshold'u configurable yap (şu an 5 dakika sabit)
- Duplicate detection için daha fazla pattern (JSDoc, test fixtures)
- `hev_fs_merge_files` tool'u (automatic strategy selection: bash vs chunk)
- Git integration - Auto checkpoint after major operations
- Progress tracking - Todo integration with tool results

### Dokümantasyon Gaps
- `.rovo/guides/reference/87-TOOL-LIMITS.md` oluştur (tool size limits, best practices)
- Tool usage analytics - Track which tools are used most
- Workflow templates - Pre-defined workflows for common tasks

---

## 🐛 BİLİNEN SORUNLAR (Known Issues)

_Şu anda aktif sorun yok. Tool hatası tespit edildiğinde buraya eklenecek._

---

## 📊 SESSION İSTATİSTİKLERİ (Statistics)

**Son Session (2026-01-31):**
- Tool Fixes: 2 (scope-validator, find_and_replace)
- Total Iterations: 24
- Success Rate: 100%
- Test Coverage: 5/5 passed

**Toplam Başarı Oranı:** ~98.5%  
**En Çok Kullanılan Tool:** hev_fs_show, hev_fs_find_and_replace, hev_dev_edit_lines

---

## 🎓 KEY LEARNINGS (Best Practices)

### Pattern 1: Large File Operations
```typescript
// 1. Try chunk system first
// 2. If chunk fails → bash fallback
// 3. Verify result (wc -l)
// 4. Commit immediately
```

### Pattern 2: Safe Editing Workflow
```typescript
// Before ANY Edit: hev_fs_show
// Edit: hev_fs_find_and_replace or hev_dev_edit_lines
// After ANY Edit: hev_dev_check_syntax
```

### Pattern 3: TypeScript Error Fixing
```typescript
// 1. hev_dev_typescript_dashboard (get overview)
// 2. Group by error type
// 3. Fix systematically
// 4. Verify after each batch
```

### Discovered Limits
- Output token limit: 8192 tokens
- Tool call parameter limit: ~15KB
- Safe chunk size: 10KB per chunk
- Recommended: 400-500 lines per chunk

---

**📖 Kullanım Kılavuzu:** [.rovo/guides/reference/85-NOTEBOOK.md](.rovo/guides/reference/85-NOTEBOOK.md)

