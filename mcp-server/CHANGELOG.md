# Changelog

Tüm önemli değişiklikler bu dosyada belgelenecektir.

## [1.9.0] - 2026-01-28

### ✨ Yeni Özellikler

#### Syntax Checker Tool
Dosyalarda syntax hataları ve parantez dengesi kontrolü için yeni tool eklendi.

**Tool: `hev_dev_check_syntax`**

**Yetenekler:**
- ✅ **Bracket Balance Check**: `()`, `{}`, `[]` parantez dengesi kontrolü
- ✅ **ESLint Integration**: JavaScript/TypeScript syntax hataları (opsiyonel)
- ✅ **TypeScript Check**: Type kontrolü (opsiyonel)
- ✅ **JSON Validation**: JSON dosyaları için parse kontrolü

**Kullanım Senaryoları:**
- Multi-line edit sonrası hızlı syntax kontrolü
- Refactoring sonrası doğrulama
- JSON dosyalarının geçerliliğini kontrol etme
- Parantez dengesizliği tespiti

**Örnek Çıktı:**
```
🔍 Syntax Kontrolü: test.js
──────────────────────────────────────────────────
❌ Parantez Dengesi: BOZUK
   Süslü Parantez: 4 açık / 5 kapalı
──────────────────────────────────────────────────
❌ 1 hata bulundu
```

### 🔧 Teknik Değişiklikler

**Yeni Fonksiyonlar:**
- `tools/dev-tools.ts`: `checkSyntax()` fonksiyonu eklendi
- Parametreler: `projectRoot`, `filePath`, `options` (checkBrackets, checkESLint, checkTS)

**Handler Güncellemeleri:**
- `core/handlers.ts`: `hev_dev_check_syntax` handler eklendi
- ESLint ve TypeScript entegrasyonu

**Bug Fixes:**
- `PROJECT_ROOT` hesaplaması düzeltildi (`__dirname` yerine `process.cwd()`)
- MCP config `npx` yerine `node` komutu ile düzeltildi

### 📝 Dokümantasyon

- README.md güncellendi (v1.9.0)
- AGENTS.md'ye syntax checker bölümü eklendi
- Tool sayısı: 66 → 67

### 🎯 Faydalar

- ✅ AI'lar edit sonrası anında syntax kontrolü yapabilir
- ✅ Parantez dengesizliği gibi yaygın hataları otomatik yakalar
- ✅ JSON dosyalarının geçerliliğini doğrular
- ✅ Context Preview ile birlikte çalışarak kod kalitesini artırır

---

## [1.8.0] - 2026-01-28

### ✨ Yeni Özellikler

#### Context Preview Mekanizması
Edit operasyonlarına otomatik context preview desteği eklendi. Artık tüm kod değişikliklerinde değişiklik bölgesinin ±5 satır önü ve sonrası gösteriliyor.

**Etkilenen Tool'lar:**
- `hev_dev_edit_lines` (insert, replace, delete operasyonları)
- `hev_fs_find_and_replace`

**Faydaları:**
- ✅ AI'lar değişikliklerin doğru yere yapıldığını görsel olarak doğrulayabilir
- ✅ Yanlış satıra ekleme/silme hataları minimuma iner
- ✅ Değişikliğin mantıksal context'ini görerek daha iyi karar verilir
- ✅ Tüm edit operasyonlarında otomatik olarak çalışır

**Örnek Çıktı:**
```
✅ 1 satır eklendi

Context Preview (±5 lines):
──────────────────────────────────────────────────
    3 │ function example() {
    4 │   const x = 1;
┌─[CHANGE START]─────────────────────
►   5 │   // Yeni eklenen satır
└─[CHANGE END]───────────────────────
    6 │   return x;
    7 │ }
──────────────────────────────────────────────────
```

### 🔧 Teknik Değişiklikler

**Yeni Fonksiyonlar:**
- `utils/file-utils.ts`: `getContextPreview()` helper fonksiyonu eklendi
- Parametreler: `filePath`, `startLine`, `endLine`, `contextLines` (default: 5)

**Güncellenen Fonksiyonlar:**
- `tools/dev-tools.ts`: `editLines()` fonksiyonu async yapıldı
- `tools/filesystem-tools.ts`: `findAndReplaceCode()` context preview desteği eklendi

**Type Güncellemeleri:**
- `EditLinesResult` interface'ine `contextPreview?: string` eklendi
- `ReplaceResult` interface'ine `contextPreview?: string` eklendi

**Handler Güncellemeleri:**
- `core/handlers.ts`: `hev_dev_edit_lines` handler eklendi
- Context preview otomatik olarak çıktıya dahil ediliyor

### 📝 Dokümantasyon

- README.md güncellendi (v1.8.0)
- Context Preview özelliği için yeni bölüm eklendi
- Örnek çıktılar ve kullanım senaryoları eklendi

---

## [1.7.0] - 2026-01-24

### Özellikler
- CDP (Chrome DevTools Protocol) desteği
- Filesystem operasyonları
- Dev Tools entegrasyonu
- Recycle Bin sistemi
- Diff araçları
- Provider validation

---

**Format:** [Semantic Versioning](https://semver.org/)
- **Major**: Breaking changes
- **Minor**: Yeni özellikler (geriye uyumlu)
- **Patch**: Bug fixes (geriye uyumlu)
