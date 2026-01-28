# 📓 ROVO Not Defteri

> Session'lar arası kalıcı hafıza - Sorunlar, fikirler, gözlemler

---

## 🐛 BUGS - Tool Hataları & Beklenmeyen Davranışlar

<!-- Format:
### [Tarih] Başlık
- **Durum:** Açık/Çözüldü
- **Öncelik:** Yüksek/Orta/Düşük
- **Komut:** `hev_*` çağrısı veya çalıştırılan komut
- **Hata Çıktısı:** Kısa özet + gerekirse log/parça
- **Teşhis:** Neden/varsayım
- **Çözüm/Workaround:** Varsa geçici çözüm
-->

### [2026-01-24] create_file Tool Hatası
- **Durum:** Gözlemlendi
- **Öncelik:** Orta
- **Detay:** Uzun içerikli dosya oluşturmada "Failed to generate LLM response" hatası
- **Workaround:** bash heredoc ile dosya oluşturma çalışıyor

---

## 💡 IDEAS - Yeni Tool & İyileştirme Fikirleri

<!-- Format:
### [Tarih] Fikir Başlığı
- **Kategori:** Tool/Protokol/UI/DX
- **Öncelik:** Yüksek/Orta/Düşük
- **Detay:** Açıklama
-->

### [2026-01-24] Rovo Dev CLI Web Entegrasyonu
- **Kategori:** UI
- **Öncelik:** Orta (OpenCode UI tamamlandıktan sonra)
- **Detay:** Atlassian Rovo Dev CLI'nin server mode'u var (`acli rovodev server`). HTTP API + SSE stream ile webview üzerinden kullanılabilir. OpenCode UI tamamlandıktan sonra kopyası üzerine Rovo entegrasyonu yapılacak.
- **API:** `http://localhost:8123/v3/chat/stream` (SSE)
- **Döküman:** https://support.atlassian.com/rovo/docs/use-server-mode-in-rovo-dev-cli/

### [2026-01-27] AST-based Code Editing Tool
- **Kategori:** Tool / DX
- **Öncelik:** Orta
- **Detay:** `hev_edit_code_block` - TypeScript/JavaScript için AST-based kod düzenleme tool'u. Regex pattern matching yerine TypeScript parser kullanır.
- **Avantajlar:**
  - %100 doğru syntax parsing
  - Semantic editing (fonksiyon, class, method bazlı)
  - Otomatik formatting
  - Zero false positives
- **Kullanım Örneği:**
  ```typescript
  hev_edit_code_block({
    file: "question-modal.ts",
    block: "switch (question.type)",  // AST selector
    transformation: {
      addBraces: ["confirm", "select", "text"]  // case'lere {} ekle
    }
  })
  ```
- **Implementation:** `@typescript-eslint/parser` veya `ts-morph` library

### [2026-01-27] Batch Operations Tool
- **Kategori:** Tool / DX
- **Öncelik:** Düşük
- **Detay:** `hev_batch_edit` - Birden fazla benzer değişiklik için özel tool. Sed/awk alternatifi.
- **Kullanım Örneği:**
  ```typescript
  hev_batch_edit({
    files: ["*.ts"],
    operations: [
      { type: "rename", from: "oldName", to: "newName" },
      { type: "add-import", module: "@types/node" },
      { type: "wrap-cases", pattern: "switch.*case" }
    ]
  })
  ```
- **Avantajlar:**
  - Declarative API
  - Batch processing
  - Progress tracking
  - Rollback support

### [2026-01-24] Multi-Agent Orchestration Sistemi
- **Kategori:** Mimari / Büyük Özellik
- **Öncelik:** Uzun vadeli (Asistan sayfası tamamlandıktan sonra)
- **Detay:** Büyük projelerde paralel AI worker koordinasyonu:
  - Ana session: Orchestrator (proje analizi, task dağıtımı, izleme)
  - Worker session'lar: Her biri bir task üzerinde çalışır
  - Shared state: `.temp/tasks/*.json` dosyaları ile koordinasyon
  - Otomatik spawn: Hayalet-ev asistan UI üzerinden (terminal yerine)
- **Neden Hayalet-ev?**
  - Zaten multi-AI altyapısı var (slot sistemi)
  - Webview + IPC altyapısı hazır
  - OpenCode UI + Rovo entegrasyonu ile genişletilebilir
  - Her asistan slot'u bir "worker" olabilir
- **Temel Konsept:**
  ```
  Asistan Sayfası (Orchestrator)
  ├── Slot 1: OpenCode Worker → Task-001
  ├── Slot 2: Rovo Worker → Task-002  
  ├── Slot 3: OpenCode Worker → Task-003
  └── Merkezi izleme + koordinasyon paneli
  ```
- **Gereksinimler:**
  1. Asistan sayfası + OpenCode UI tamamlanmalı
  2. Rovo Dev entegrasyonu yapılmalı
  3. Task management sistemi tasarlanmalı
  4. Worker arası iletişim protokolü

---

## 🔧 TODO - Sonra Yapılacaklar

<!-- Format:
- [ ] [Öncelik] Açıklama (Tarih)
-->

- [ ] [Orta] create_file hatası araştırılacak (2026-01-24)

---

## 📝 OBSERVATIONS - Pattern'ler & Tekrarlayan Sorunlar

<!-- Format:
### [Tarih] Gözlem Başlığı
- **Sıklık:** Nadir/Ara sıra/Sık
- **Detay:** Açıklama
- **Öneri:** Ne yapılmalı
-->

*Henüz not yok*

---

## 📊 İstatistikler

| Kategori | Açık | Çözüldü |
|----------|------|---------|
| Bugs | 1 | 0 |
| Ideas | 0 | - |
| Todos | 1 | 0 |
| Observations | 0 | - |

---

**Son Güncelleme:** 2026-01-27
