# Safe Editing Guide - Duplicate Önleme

## 🔴 PROBLEM: Duplicate Satır Oluşumu

Rovodev'in built-in `find_and_replace_code` tool'u fuzzy matching yapıyor ama silme işlemini düzgün yapmıyor. Bu, özellikle büyük dosyalarda duplicate satırlara ve cascade hatalara yol açıyor.

---

## ✅ GÜVENLİ WORKFLOW

### 1. Hayalet-ev MCP Tool'larını Kullan

**❌ KULLANMA:**
```
find_and_replace_code(...)  // Rovodev built-in (buggy)
```

**✅ KULLAN:**
```
hev_fs_find_and_replace(...)  // Hayalet-ev MCP (güvenli + context preview)
hev_dev_edit_lines(...)        // Satır bazlı edit (en güvenli)
```

---

### 2. Edit Workflow (4 Adımlı)

```
┌─────────────────────────────────────────┐
│  1. ÖNCE KONTROL ET                     │
│  hev_fs_show('file.ts', start, end)    │
│  → Mevcut içeriği gör                   │
└─────────────────────────────────────────┘
              ↓
┌─────────────────────────────────────────┐
│  2. EDİT YAP                            │
│  hev_dev_edit_lines('file.ts', {...})  │
│  → Context preview otomatik gelir       │
└─────────────────────────────────────────┘
              ↓
┌─────────────────────────────────────────┐
│  3. SYNTAX KONTROL                      │
│  hev_dev_check_syntax('file.ts')       │
│  → Parantez dengesi + ESLint           │
└─────────────────────────────────────────┘
              ↓
┌─────────────────────────────────────────┐
│  4. YAPI KONTROL (şüpheli durumlarda)   │
│  hev_dev_visualize_structure('file.ts')│
│  → Scope hierarchy + bracket analysis   │
└─────────────────────────────────────────┘
```

---

### 3. Büyük Dosya Stratejisi

**Büyük dosyalarda (>500 satır):**

1. **Partial Edit Yapma** - Tüm dosyayı yeniden yaz
2. **Context Preview'a Güvenme** - Mutlaka `hev_fs_show` ile doğrula
3. **Incremental Edit** - Küçük adımlarla, her adımda kontrol et

**Örnek:**
```typescript
// ❌ Kötü: Büyük blok replace
hev_dev_edit_lines('manager.ts', { startLine: 1, endLine: 500, content: '...' })

// ✅ İyi: Küçük parçalar halinde
hev_dev_edit_lines('manager.ts', { startLine: 10, endLine: 30, content: '...' })
// Kontrol et
hev_dev_check_syntax('manager.ts')
// Sonraki blok
hev_dev_edit_lines('manager.ts', { startLine: 50, endLine: 70, content: '...' })
```

---

### 4. Cascade Hata Önleme

**Cascade hata başladığında:**

```bash
# 1. DURDUR! Devam etme
# 2. Working tree'yi temizle
git checkout -- path/to/file.ts

# 3. Stratejini değiştir:
#    - Daha küçük editler
#    - Her edit sonrası syntax check
#    - Context preview'a güvenme, show ile doğrula
```

---

## 🛡️ En Güvenli Tool: `hev_dev_edit_lines`

**Neden:**
- ✅ Satır bazlı işlem (duplicate riski minimal)
- ✅ Context preview otomatik
- ✅ Dry-run desteği
- ✅ Syntax validation opsiyonel

**Kullanım:**
```typescript
// INSERT
hev_dev_edit_lines('file.ts', {
  operation: 'insert',
  startLine: 10,
  content: 'new code'
})

// REPLACE
hev_dev_edit_lines('file.ts', {
  operation: 'replace',
  startLine: 10,
  endLine: 20,
  content: 'new code block'
})

// DELETE
hev_dev_edit_lines('file.ts', {
  operation: 'delete',
  startLine: 10,
  endLine: 20
})
```

---

## 📋 Checklist (Her Edit Öncesi)

- [ ] Dosya büyük mü? (>500 satır) → Küçük parçalara böl
- [ ] `hev_fs_show` ile mevcut içeriği gördün mü?
- [ ] `hev_dev_edit_lines` kullanıyor musun? (built-in değil)
- [ ] Edit sonrası `hev_dev_check_syntax` çalıştırıldı mı?
- [ ] Context preview doğru mu? (show ile çapraz kontrol)

---

## 🚨 Acil Durum (Dosya Bozuldu)

```bash
# Working tree'yi temizle
cd /home/raistlin/hayalet-ev
git checkout -- path/to/broken/file.ts

# Veya tüm değişiklikleri geri al
git checkout -- .
```

---

## 💡 Best Practices Özet

| Durum | Önerilen Tool | Neden |
|-------|---------------|-------|
| Küçük tek satır değişiklik | `hev_fs_find_and_replace` | Basit ve hızlı |
| Multi-line edit | `hev_dev_edit_lines` | Context preview + güvenli |
| Büyük dosya refactoring | `hev_dev_edit_lines` (incremental) | Cascade hata önleme |
| Şüpheli durum | `hev_fs_show` + manuel kontrol | En güvenli |

---

**Son Güncelleme:** 2026-01-28  
**Version:** 1.0
